import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  CastButton,
  MediaPlayerState,
  useMediaStatus,
  useRemoteMediaClient,
  useStreamPosition,
} from "react-native-google-cast";
import { useLocale } from "../../providers/LocaleProvider";
import { useToast } from "../../providers/ToastProvider";
import { colors, fonts } from "../../theme";
import { CAST_RENEWAL_MS, createCastLoadRequest, requestCastToken } from "./cast";
import type { NativeCastControlsProps } from "./CastControls.types";

export default function NativeCastControls({
  player,
  mediaKey,
  source,
  tracks,
  title,
  onCastingChange,
  onDisconnect,
  onRemoteProgress,
}: NativeCastControlsProps) {
  const { t } = useLocale();
  const toast = useToast();
  const client = useRemoteMediaClient();
  const mediaStatus = useMediaStatus();
  const streamPosition = useStreamPosition(1000);
  const loadAbortRef = useRef<AbortController | null>(null);
  const renewalRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renewalRetriesRef = useRef(0);
  const lastLoadedRef = useRef<string | null>(null);
  const lastMediaKeyRef = useRef<string | null>(null);
  const hadClientRef = useRef(false);
  const remoteSnapshotRef = useRef({ position: 0, duration: 0, playing: false });
  const [error, setError] = useState<string | null>(null);
  const [renewal, setRenewal] = useState(0);
  const lastRenewalRef = useRef(0);
  const activeTrackIdsRef = useRef<number[] | undefined>(undefined);
  const loadKey = useMemo(
    () => `${mediaKey}\n${source ?? ""}\n${tracks.map((track) => track.file).join("\n")}`,
    [mediaKey, source, tracks],
  );

  useEffect(() => {
    const duration = mediaStatus?.mediaInfo?.streamDuration ?? player.duration;
    const position = streamPosition ?? mediaStatus?.streamPosition ?? 0;
    remoteSnapshotRef.current = {
      position,
      duration,
      playing: mediaStatus?.playerState === MediaPlayerState.PLAYING,
    };
    activeTrackIdsRef.current = mediaStatus?.activeTrackIds;
    if (client && duration > 0 && position >= 0) onRemoteProgress(position, duration);
  }, [client, mediaStatus, onRemoteProgress, player.duration, streamPosition]);

  useEffect(() => {
    onCastingChange(Boolean(client));
    if (client) {
      hadClientRef.current = true;
      return;
    }
    if (!hadClientRef.current) return;

    hadClientRef.current = false;
    lastLoadedRef.current = null;
    lastMediaKeyRef.current = null;
    const snapshot = remoteSnapshotRef.current;
    onDisconnect(snapshot.position, snapshot.playing);
  }, [client, onCastingChange, onDisconnect]);

  useEffect(() => {
    const renewing = renewal !== lastRenewalRef.current && lastLoadedRef.current === loadKey;
    if (!client || !source || (!renewing && lastLoadedRef.current === loadKey)) return;
    if (!renewing) renewalRetriesRef.current = 0;

    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const remoteAlreadyLoaded = lastLoadedRef.current !== null;
    const sameMedia = lastMediaKeyRef.current === null || lastMediaKeyRef.current === mediaKey;
    let activeTrackIds = [1];
    void requestCastToken(source, tracks, controller.signal)
      .then((token) => {
        if (controller.signal.aborted) return;
        const startTime = remoteAlreadyLoaded
          ? sameMedia ? remoteSnapshotRef.current.position : 0
          : player.currentTime;
        const autoplay = remoteAlreadyLoaded ? remoteSnapshotRef.current.playing : player.playing;
        activeTrackIds = renewing ? activeTrackIdsRef.current ?? [1] : [1];
        return client.loadMedia(
          createCastLoadRequest({
            source,
            token,
            title,
            tracks,
            startTime,
            duration: player.duration,
            autoplay,
          }),
        );
      })
      .then(async () => {
        if (controller.signal.aborted) return;
        if (tracks.length > 0) await client.setActiveTrackIds(activeTrackIds);
        if (controller.signal.aborted) return;
        lastLoadedRef.current = loadKey;
        lastMediaKeyRef.current = mediaKey;
        lastRenewalRef.current = renewal;
        renewalRetriesRef.current = 0;
        player.pause();
        setError(null);
      })
      .catch((thrown: unknown) => {
        if (controller.signal.aborted) return;
        if (renewing && renewalRetriesRef.current < 2) {
          renewalRetriesRef.current++;
          renewalRetryRef.current = setTimeout(() => setRenewal((value) => value + 1), 15_000);
        }
        const message = thrown instanceof Error ? thrown.message : t("castUnavailable");
        setError(message);
        toast.show({ message });
      })
      .finally(() => {
        if (loadAbortRef.current === controller) loadAbortRef.current = null;
      });

    return () => {
      controller.abort();
      if (renewalRetryRef.current) clearTimeout(renewalRetryRef.current);
      renewalRetryRef.current = null;
    };
  }, [client, loadKey, mediaKey, player, renewal, source, t, title, toast, tracks]);

  useEffect(() => {
    if (!client) return;
    const timer = setInterval(() => {
      renewalRetriesRef.current = 0;
      setRenewal((value) => value + 1);
    }, CAST_RENEWAL_MS);
    return () => clearInterval(timer);
  }, [client]);

  useEffect(() => () => {
    loadAbortRef.current?.abort();
    onCastingChange(false);
  }, [onCastingChange]);

  return (
    <View style={styles.container}>
      <CastButton
        accessibilityLabel={client ? t("stopCasting") : t("castToDevice")}
        accessibilityRole="button"
        style={styles.button}
        tintColor={client ? colors.accent : colors.text}
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" numberOfLines={2} style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "flex-end" },
  button: { width: 38, height: 30 },
  error: {
    position: "absolute",
    top: 34,
    right: 0,
    width: 210,
    color: colors.destructive,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontFamily: fonts.body,
  },
});
