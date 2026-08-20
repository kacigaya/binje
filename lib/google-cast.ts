"use client";

const CAST_SCRIPT_ID = "google-cast-sender-sdk";
const CAST_SCRIPT_URL =
  "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";

export type CastMediaTrack = {
  trackContentId?: string;
  trackContentType?: string;
  language?: string;
  name?: string;
  subtype?: string;
};

export type CastMediaInfo = {
  metadata?: { title?: string };
  tracks?: CastMediaTrack[];
};

export type CastLoadRequest = {
  autoplay: boolean;
  currentTime: number;
  activeTrackIds?: number[];
};

export type CastSession = {
  loadMedia(request: CastLoadRequest): Promise<void>;
  getCastDevice(): { friendlyName?: string };
};

export type CastContext = {
  setOptions(options: {
    receiverApplicationId: string;
    autoJoinPolicy: string;
  }): void;
  getCastState(): string;
  getCurrentSession(): CastSession | null;
  requestSession(): Promise<void>;
  endCurrentSession(stopCasting: boolean): void;
  addEventListener(type: string, listener: (event: CastEvent) => void): void;
  removeEventListener(type: string, listener: (event: CastEvent) => void): void;
};

export type CastEvent = {
  castState?: string;
  sessionState?: string;
};

export type RemotePlayer = {
  isPaused: boolean;
  currentTime: number;
  duration: number;
  isMediaLoaded: boolean;
};

export type RemotePlayerController = {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  playOrPause(): void;
};

type GoogleCastWindow = Window & {
  __onGCastApiAvailable?: (available: boolean, errorInfo?: unknown) => void;
  __binjeGoogleCastPromise?: Promise<GoogleCastApi | null>;
  __binjeGoogleCastInitialized?: boolean;
  cast?: {
    framework: {
      CastContext: { getInstance(): CastContext };
      CastContextEventType: { CAST_STATE_CHANGED: string };
      SessionStateEventType: { SESSION_STATE_CHANGED: string };
      RemotePlayer: new () => RemotePlayer;
      RemotePlayerController: new (player: RemotePlayer) => RemotePlayerController;
      RemotePlayerEventType: { ANY_CHANGE: string };
    };
  };
  chrome?: {
    cast?: {
      AutoJoinPolicy: { ORIGIN_SCOPED: string };
      media: {
        DEFAULT_MEDIA_RECEIVER_APP_ID: string;
        MediaInfo: new (contentId: string, contentType: string) => CastMediaInfo;
        LoadRequest: new (mediaInfo: CastMediaInfo) => CastLoadRequest;
        GenericMediaMetadata: new () => { title?: string };
        Track: new (trackId: number, trackType: string) => CastMediaTrack;
        TrackType: { TEXT: string };
        TextTrackType: { SUBTITLES: string };
      };
    };
  };
};

export type GoogleCastApi = {
  framework: NonNullable<GoogleCastWindow["cast"]>["framework"];
  chromeCast: NonNullable<NonNullable<GoogleCastWindow["chrome"]>["cast"]>;
  context: CastContext;
};

function getApi(castWindow: GoogleCastWindow): GoogleCastApi | null {
  const framework = castWindow.cast?.framework;
  const chromeCast = castWindow.chrome?.cast;
  if (!framework || !chromeCast) return null;
  return {
    framework,
    chromeCast,
    context: framework.CastContext.getInstance(),
  };
}

function initialize(api: GoogleCastApi, castWindow: GoogleCastWindow) {
  if (castWindow.__binjeGoogleCastInitialized) return;
  api.context.setOptions({
    receiverApplicationId: api.chromeCast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
    autoJoinPolicy: api.chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  castWindow.__binjeGoogleCastInitialized = true;
}

export function loadGoogleCast(): Promise<GoogleCastApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);

  const castWindow = window as GoogleCastWindow;
  const ready = getApi(castWindow);
  if (ready) {
    initialize(ready, castWindow);
    return Promise.resolve(ready);
  }
  if (castWindow.__binjeGoogleCastPromise) {
    return castWindow.__binjeGoogleCastPromise;
  }

  castWindow.__binjeGoogleCastPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (api: GoogleCastApi | null) => {
      if (settled) return;
      settled = true;
      if (api) initialize(api, castWindow);
      resolve(api);
    };

    const previousCallback = castWindow.__onGCastApiAvailable;
    castWindow.__onGCastApiAvailable = (available, errorInfo) => {
      try {
        previousCallback?.(available, errorInfo);
      } finally {
        finish(available ? getApi(castWindow) : null);
      }
    };

    const existing = document.getElementById(CAST_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    script.addEventListener(
      "load",
      () =>
        queueMicrotask(() => {
          const api = getApi(castWindow);
          if (api) finish(api);
        }),
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        if (settled) return;
        settled = true;
        castWindow.__binjeGoogleCastPromise = undefined;
        reject(new Error("Google Cast SDK failed to load."));
      },
      { once: true },
    );

    if (!existing) {
      script.id = CAST_SCRIPT_ID;
      script.src = CAST_SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return castWindow.__binjeGoogleCastPromise;
}
