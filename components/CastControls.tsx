"use client";

import { Cast, LoaderCircle, Pause, Play } from "lucide-react";
import type { RefObject } from "react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Menu } from "@/components/ui/menu";
import {
  loadGoogleCast,
  type GoogleCastApi,
  type RemotePlayer,
  type RemotePlayerController,
} from "@/lib/google-cast";
import { selectCastTransport } from "@/lib/cast-transport";
import type { TranslationKey } from "@/lib/i18n";
import {
  TabCastError,
  tabCastProvider,
  type CastDevice,
  type TabCastErrorCode,
} from "@/lib/tab-cast";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/use-locale";

type Track = { file: string; label?: string };
type CastStatus = "disconnected" | "connecting" | "connected";
type AirPlayVideo = HTMLVideoElement & {
  webkitCurrentPlaybackTargetIsWireless?: boolean;
  webkitShowPlaybackTargetPicker?: () => void;
};
type AirPlayAvailabilityEvent = Event & {
  availability: "available" | "not-available";
};

const TAB_CAST_ACTIVE_POLL_MS = 5000;
const TAB_CAST_IDLE_POLL_MS = 20000;

const TAB_CAST_MESSAGES: Record<Exclude<TabCastErrorCode, "unreachable">, TranslationKey> = {
  "chrome-unavailable":
    "Chrome tab casting is unavailable. Restart Chrome with remote debugging enabled.",
  "tab-not-found": "Chrome could not find this tab. Reload the page and try again.",
  "sink-unavailable": "That device is no longer available.",
  "already-casting": "This tab is already casting to another device.",
  "cast-failed": "Tab casting failed. Try again.",
};

function castProxyUrl(url: string, token: string) {
  const proxyUrl = new URL("/api/hls", window.location.origin);
  proxyUrl.searchParams.set("url", url);
  proxyUrl.searchParams.set("castToken", token);
  return proxyUrl.href;
}

async function requestCastToken(signal: AbortSignal) {
  const response = await fetch("/api/cast", { method: "POST", signal });
  if (!response.ok) throw new Error("Cast authorization failed.");
  const data = (await response.json()) as { token?: unknown };
  if (typeof data.token !== "string") throw new Error("Invalid Cast authorization response.");
  return data.token;
}

export default function CastControls({
  videoRef,
  mediaKey,
  source,
  tracks,
  title,
  onRemoteProgress,
  onGoogleCastingChange,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mediaKey: string;
  source: string | null;
  tracks: Track[];
  title: string;
  onRemoteProgress: (positionSeconds: number, durationSeconds: number) => void;
  onGoogleCastingChange: (casting: boolean) => void;
}) {
  const { t } = useTranslations();
  const noticeId = useId();
  const apiRef = useRef<GoogleCastApi | null>(null);
  const remotePlayerRef = useRef<RemotePlayer | null>(null);
  const remoteControllerRef = useRef<RemotePlayerController | null>(null);
  const remoteSnapshotRef = useRef({ currentTime: 0, duration: 0, isPaused: true });
  const loadAbortRef = useRef<AbortController | null>(null);
  const tabCastAbortRef = useRef<AbortController | null>(null);
  const castButtonRef = useRef<HTMLButtonElement>(null);
  const refocusCastButtonRef = useRef(false);
  const tabCastPendingRef = useRef(false);
  const lastLoadedRef = useRef<{ key: string; mediaKey: string } | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<CastStatus>("disconnected");
  const [airPlayAvailable, setAirPlayAvailable] = useState(false);
  const [airPlayConnected, setAirPlayConnected] = useState(false);
  const [tabCastReady, setTabCastReady] = useState(false);
  const [tabCastSink, setTabCastSink] = useState<string | null>(null);
  const [tabCastDevices, setTabCastDevices] = useState<CastDevice[]>([]);
  const [devicePickerOpen, setDevicePickerOpen] = useState(false);
  const [remotePaused, setRemotePaused] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadKey = useMemo(
    () => `${mediaKey}\n${source ?? ""}\n${tracks.map((track) => track.file).join("\n")}`,
    [mediaKey, source, tracks],
  );

  const reportError = useCallback(
    (message: string) => {
      const translated = t("Unable to cast. Try again.");
      setError(translated);
      toast.error(translated, { description: message });
    },
    [t],
  );

  const showManualCastHelp = useCallback(() => {
    const message = t("Open Chrome menu > Cast, choose Sources > Cast tab, then select your TV.");
    setError(message);
    toast.info(message);
  }, [t]);

  const reportTabCastError = useCallback(
    (thrown: unknown) => {
      if (thrown instanceof DOMException && thrown.name === "AbortError") return;
      if (!(thrown instanceof TabCastError)) {
        reportError(thrown instanceof Error ? thrown.message : String(thrown));
        return;
      }
      if (thrown.code === "unreachable") {
        // The companion went away mid-session; fall back to Chrome's own menu.
        setTabCastReady(false);
        setTabCastSink(null);
        showManualCastHelp();
        return;
      }
      const message = t(TAB_CAST_MESSAGES[thrown.code]);
      setError(message);
      toast.error(message, { description: thrown.message });
    },
    [reportError, showManualCastHelp, t],
  );

  const restoreLocalPlayback = useCallback(
    (resume: boolean) => {
      const video = videoRef.current;
      const snapshot = remoteSnapshotRef.current;
      if (!video) return;
      if (Number.isFinite(snapshot.currentTime) && snapshot.currentTime > 0) {
        video.currentTime = snapshot.currentTime;
      }
      if (resume && !snapshot.isPaused) void video.play().catch(() => undefined);
    },
    [videoRef],
  );

  useEffect(() => {
    let cancelled = false;
    let removeListeners: (() => void) | undefined;

    void loadGoogleCast()
      .then((api) => {
        if (!api || cancelled) return;
        apiRef.current = api;
        setGoogleReady(true);
        const { context, framework } = api;
        const castStateEvent = framework.CastContextEventType.CAST_STATE_CHANGED;
        const sessionStateEvent = framework.SessionStateEventType.SESSION_STATE_CHANGED;
        const remotePlayer = new framework.RemotePlayer();
        const remoteController = new framework.RemotePlayerController(remotePlayer);
        const remoteEvent = framework.RemotePlayerEventType.ANY_CHANGE;
        remotePlayerRef.current = remotePlayer;
        remoteControllerRef.current = remoteController;

        const updateRemote = () => {
          remoteSnapshotRef.current = {
            currentTime: remotePlayer.currentTime,
            duration: remotePlayer.duration,
            isPaused: remotePlayer.isPaused,
          };
          setRemotePaused(remotePlayer.isPaused);
        };
        const onCastState = (event: { castState?: string }) => {
          const state = event.castState ?? context.getCastState();
          const available = state !== "NO_DEVICES_AVAILABLE";
          setGoogleAvailable(available);
          if (available) setError(null);
          if (state === "CONNECTING") setGoogleStatus("connecting");
        };
        const onSessionState = (event: { sessionState?: string }) => {
          const state = event.sessionState ?? "";
          if (state === "SESSION_STARTING") setGoogleStatus("connecting");
          if (state === "SESSION_STARTED" || state === "SESSION_RESUMED") {
            setGoogleStatus("connected");
          }
          if (state === "SESSION_ENDED" || state === "SESSION_START_FAILED") {
            setGoogleStatus("disconnected");
            setBusy(false);
            lastLoadedRef.current = null;
            if (state === "SESSION_ENDED") restoreLocalPlayback(false);
          }
        };

        onCastState({ castState: context.getCastState() });
        if (context.getCurrentSession()) setGoogleStatus("connected");
        updateRemote();
        context.addEventListener(castStateEvent, onCastState);
        context.addEventListener(sessionStateEvent, onSessionState);
        remoteController.addEventListener(remoteEvent, updateRemote);

        removeListeners = () => {
          context.removeEventListener(castStateEvent, onCastState);
          context.removeEventListener(sessionStateEvent, onSessionState);
          remoteController.removeEventListener(remoteEvent, updateRemote);
          if (apiRef.current === api) apiRef.current = null;
          if (remotePlayerRef.current === remotePlayer) remotePlayerRef.current = null;
          if (remoteControllerRef.current === remoteController) remoteControllerRef.current = null;
        };
      })
      .catch(() => {
        // Cast is optional. A blocked or offline SDK leaves its control hidden.
      });

    return () => {
      cancelled = true;
      removeListeners?.();
    };
  }, [reportError, restoreLocalPlayback]);

  useEffect(() => {
    const video = videoRef.current as AirPlayVideo | null;
    if (!video?.webkitShowPlaybackTargetPicker) return;

    const onAvailability = (event: Event) => {
      setAirPlayAvailable(
        (event as AirPlayAvailabilityEvent).availability === "available",
      );
    };
    const onWirelessChange = () => {
      setAirPlayConnected(Boolean(video.webkitCurrentPlaybackTargetIsWireless));
    };
    video.addEventListener("webkitplaybacktargetavailabilitychanged", onAvailability);
    video.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", onWirelessChange);
    onWirelessChange();

    return () => {
      video.removeEventListener("webkitplaybacktargetavailabilitychanged", onAvailability);
      video.removeEventListener("webkitcurrentplaybacktargetiswirelesschanged", onWirelessChange);
    };
  }, [source, videoRef]);

  // Poll the local companion for as long as the player is mounted. A missing
  // companion is the normal case and stays silent, but it can also be started
  // after the page, and a receiver can be stopped from the TV or from Chrome's
  // own menu, so neither availability nor session state may be assumed once.
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const poll = async () => {
      let casting = false;
      try {
        const status = await tabCastProvider.status(controller.signal);
        if (stopped) return;
        casting = status?.casting ?? false;
        // A cast request in flight owns the state; its own result is fresher.
        if (!tabCastPendingRef.current) {
          setTabCastReady(status !== null);
          setTabCastSink(status?.sinkName ?? null);
        }
      } catch {
        // Transient failure. The next tick re-probes instead of giving up.
      }
      if (!stopped) {
        timer = setTimeout(poll, casting ? TAB_CAST_ACTIVE_POLL_MS : TAB_CAST_IDLE_POLL_MS);
      }
    };
    void poll();

    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const loadRemoteMedia = useCallback(async () => {
    const api = apiRef.current;
    const session = api?.context.getCurrentSession();
    const video = videoRef.current;
    if (!api || !session || !video || !source) return;
    if (lastLoadedRef.current?.key === loadKey) return;

    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const previous = lastLoadedRef.current;
    const sameMedia = !previous || previous.mediaKey === mediaKey;
    const remotePlayer = remotePlayerRef.current;
    const remoteHasMedia = Boolean(remotePlayer?.isMediaLoaded);
    const currentTime =
      sameMedia && remoteHasMedia ? remotePlayer!.currentTime : sameMedia ? video.currentTime : 0;
    const autoplay = remoteHasMedia ? !remotePlayer!.isPaused : !video.paused;

    try {
      const token = await requestCastToken(controller.signal);
      if (controller.signal.aborted) return;
      const mediaInfo = new api.chromeCast.media.MediaInfo(
        castProxyUrl(source, token),
        "application/vnd.apple.mpegurl",
      );
      const metadata = new api.chromeCast.media.GenericMediaMetadata();
      metadata.title = title;
      mediaInfo.metadata = metadata;

      if (tracks.length > 0) {
        mediaInfo.tracks = tracks.map((track, index) => {
          const remoteTrack = new api.chromeCast.media.Track(
            index + 1,
            api.chromeCast.media.TrackType.TEXT,
          );
          remoteTrack.trackContentId = castProxyUrl(track.file, token);
          remoteTrack.trackContentType = "text/vtt";
          remoteTrack.name = track.label ?? `${t("Subtitles")} ${index + 1}`;
          remoteTrack.language = "und";
          remoteTrack.subtype = api.chromeCast.media.TextTrackType.SUBTITLES;
          return remoteTrack;
        });
      }

      const request = new api.chromeCast.media.LoadRequest(mediaInfo);
      request.autoplay = autoplay;
      request.currentTime = Number.isFinite(currentTime) ? currentTime : 0;
      if (tracks.length > 0) request.activeTrackIds = [1];
      await session.loadMedia(request);
      if (controller.signal.aborted) return;
      lastLoadedRef.current = { key: loadKey, mediaKey };
      video.pause();
      setError(null);
    } catch (loadError: unknown) {
      if (controller.signal.aborted) return;
      const message = loadError instanceof Error ? loadError.message : "Remote media load failed.";
      reportError(message);
    } finally {
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
      setBusy(false);
    }
  }, [loadKey, mediaKey, reportError, source, t, title, tracks, videoRef]);

  useEffect(() => {
    if (googleStatus === "connected") void loadRemoteMedia();
  }, [googleStatus, loadRemoteMedia]);

  useEffect(() => {
    onGoogleCastingChange(googleStatus === "connected");
    return () => onGoogleCastingChange(false);
  }, [googleStatus, onGoogleCastingChange]);

  useEffect(() => {
    if (googleStatus !== "connected") return;
    const timer = window.setInterval(() => {
      const { currentTime, duration } = remoteSnapshotRef.current;
      if (Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0) {
        onRemoteProgress(currentTime, duration);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [googleStatus, onRemoteProgress]);

  useEffect(
    () => () => {
      loadAbortRef.current?.abort();
      tabCastAbortRef.current?.abort();
    },
    [],
  );

  // Picking a device closes the menu while the request is still in flight, and
  // the button is disabled for that moment, so focus can only come back once
  // the request settles.
  useEffect(() => {
    if (busy || !refocusCastButtonRef.current) return;
    refocusCastButtonRef.current = false;
    if (document.activeElement === document.body) castButtonRef.current?.focus();
  }, [busy]);

  const runTabCast = useCallback(
    async (action: (signal: AbortSignal) => Promise<void>) => {
      tabCastAbortRef.current?.abort();
      const controller = new AbortController();
      tabCastAbortRef.current = controller;
      tabCastPendingRef.current = true;
      setBusy(true);
      setError(null);
      try {
        await action(controller.signal);
      } catch (thrown) {
        if (!controller.signal.aborted) reportTabCastError(thrown);
      } finally {
        if (tabCastAbortRef.current === controller) {
          tabCastAbortRef.current = null;
          tabCastPendingRef.current = false;
        }
        setBusy(false);
      }
    },
    [reportTabCastError],
  );

  const startTabCast = useCallback(
    (deviceName: string) =>
      runTabCast(async (signal) => {
        const status = await tabCastProvider.start(deviceName, signal);
        setTabCastSink(status.sinkName);
        if (!status.casting) {
          const message = t("Tab casting failed. Try again.");
          setError(message);
          toast.error(message);
        }
      }),
    [runTabCast, t],
  );

  const googleConnected = googleStatus === "connected";
  const tabCastConnected = tabCastSink !== null;
  const transport = selectCastTransport({
    googleConnected,
    googleAvailable,
    airPlayConnected,
    airPlayAvailable,
    tabCastConnected,
    tabCastAvailable: tabCastReady,
  });
  const unavailable = transport === null;
  const available = !unavailable || googleReady;
  if (!available) return null;

  async function handleCast() {
    setError(null);
    if (transport === "google") {
      const api = apiRef.current;
      if (!api) return;
      if (googleConnected) {
        api.context.endCurrentSession(true);
        restoreLocalPlayback(true);
        setGoogleStatus("disconnected");
        lastLoadedRef.current = null;
        return;
      }

      setBusy(true);
      setGoogleStatus("connecting");
      try {
        await api.context.requestSession();
        setGoogleStatus("connected");
      } catch (sessionError: unknown) {
        setGoogleStatus("disconnected");
        setBusy(false);
        const message = sessionError instanceof Error ? sessionError.message : String(sessionError);
        if (!/cancel/i.test(message)) reportError(message || "Cast session failed.");
      }
      return;
    }

    if (transport === "airplay") {
      const video = videoRef.current as AirPlayVideo | null;
      video?.webkitShowPlaybackTargetPicker?.();
      return;
    }

    if (transport === "tab-cast") {
      await runTabCast(async (signal) => {
        if (tabCastSink) {
          setTabCastSink((await tabCastProvider.stop(tabCastSink, signal)).sinkName);
          return;
        }
        const devices = await tabCastProvider.getDevices(signal);
        if (signal.aborted) return;
        setTabCastDevices(devices);
        if (devices.length === 0) {
          const message = t("No Cast device found on your network.");
          setError(message);
          toast.error(message);
          return;
        }
        if (devices.length === 1) {
          const status = await tabCastProvider.start(devices[0].name, signal);
          setTabCastSink(status.sinkName);
          return;
        }
        setDevicePickerOpen(true);
      });
      return;
    }

    showManualCastHelp();
  }

  const connecting = busy || googleStatus === "connecting";
  const connected = googleConnected || airPlayConnected || tabCastConnected;
  const castLabel = connected
    ? t("Stop casting")
    : connecting
      ? t("Connecting to device…")
      : unavailable
        ? t("How to cast this tab")
        : t("Cast to a device");

  return (
    <>
      {googleConnected && (
        <button
          type="button"
          onClick={() => remoteControllerRef.current?.playOrPause()}
          aria-label={remotePaused ? t("Play on device") : t("Pause on device")}
          className="rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-accent-red/60"
        >
          {remotePaused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
      )}
      <button
        ref={castButtonRef}
        type="button"
        onClick={() => void handleCast()}
        disabled={!source || connecting}
        aria-label={castLabel}
        aria-pressed={connected}
        aria-haspopup={transport === "tab-cast" && !connected ? "menu" : undefined}
        aria-expanded={transport === "tab-cast" && !connected ? devicePickerOpen : undefined}
        aria-describedby={error ? noticeId : undefined}
        title={castLabel}
        className={cn(
          "rounded-full p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-accent-red/60 disabled:cursor-wait disabled:opacity-60",
          connected
            ? "bg-accent-red text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white",
        )}
      >
        {connecting ? (
          <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
        ) : (
          <Cast aria-hidden="true" />
        )}
      </button>
      <Menu
        open={devicePickerOpen}
        onOpenChange={setDevicePickerOpen}
        anchor={castButtonRef}
        ariaLabel={t("Choose a Cast device")}
        items={tabCastDevices.map((device) => ({
          value: device.name,
          label: device.name,
          selected: device.name === tabCastSink,
        }))}
        onSelect={(deviceName) => {
          refocusCastButtonRef.current = true;
          void startTabCast(deviceName);
        }}
      />
      {error && (
        <span
          id={noticeId}
          role="status"
          className="absolute right-0 top-12 w-max max-w-64 rounded-lg border border-white/15 bg-black px-3 py-2 text-xs text-white"
        >
          {error}
        </span>
      )}
    </>
  );
}
