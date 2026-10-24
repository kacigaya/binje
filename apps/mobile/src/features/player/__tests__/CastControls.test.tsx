import { act, render } from "@testing-library/react-native";
import { useMediaStatus, useRemoteMediaClient, useStreamPosition } from "react-native-google-cast";
import NativeCastControls from "../CastControls.native";
import type { NativeCastControlsProps } from "../CastControls.types";
import { CAST_RENEWAL_MS, requestCastToken } from "../cast";

jest.mock("react-native-google-cast", () => ({
  CastButton: () => null,
  MediaPlayerState: { PLAYING: "playing" },
  useMediaStatus: jest.fn(), useRemoteMediaClient: jest.fn(), useStreamPosition: jest.fn(),
}));
const mockTranslate = (key: string) => key;
const mockToast = { show: jest.fn() };
jest.mock("../../../providers/LocaleProvider", () => ({ useLocale: () => ({ t: mockTranslate }) }));
jest.mock("../../../providers/ToastProvider", () => ({ useToast: () => mockToast }));
jest.mock("../cast", () => ({ ...jest.requireActual("../cast"), requestCastToken: jest.fn() }));

test.each([false, true])("renews native Cast and preserves state, including a transient failure: %s", async (failRenewal) => {
  jest.useFakeTimers();
  const client = { loadMedia: jest.fn().mockResolvedValue(undefined), setActiveTrackIds: jest.fn().mockResolvedValue(undefined) };
  jest.mocked(useRemoteMediaClient).mockReturnValue(client as never);
  jest.mocked(useMediaStatus).mockReturnValue({ mediaInfo: { streamDuration: 900 }, playerState: "playing", activeTrackIds: [1] } as never);
  jest.mocked(useStreamPosition).mockReturnValue(0);
  jest.mocked(requestCastToken).mockResolvedValue("a".repeat(32));
  const props: NativeCastControlsProps = {
    player: { duration: 900, currentTime: 12, playing: true, pause: jest.fn() } as never,
    mediaKey: "movie:1", source: "https://cdn.test/master.m3u8",
    tracks: [{ file: "https://subs.test/en.vtt" }], title: "Example",
    onCastingChange: jest.fn(), onDisconnect: jest.fn(), onRemoteProgress: jest.fn(),
  };
  const view = render(<NativeCastControls {...props} />);
  try {
    await act(async () => {});
    expect(client.loadMedia).toHaveBeenCalledTimes(1);
    expect(client.loadMedia).toHaveBeenLastCalledWith(expect.objectContaining({ startTime: 12, autoplay: true }));
    jest.mocked(useMediaStatus).mockReturnValue({ mediaInfo: { streamDuration: 900 }, playerState: "paused", activeTrackIds: [] } as never);
    jest.mocked(useStreamPosition).mockReturnValue(123);
    view.rerender(<NativeCastControls {...props} />);
    if (failRenewal) client.loadMedia.mockRejectedValueOnce(new Error("Temporary receiver failure"));
    await act(async () => { await jest.advanceTimersByTimeAsync(CAST_RENEWAL_MS); });
    expect(client.loadMedia).toHaveBeenCalledTimes(2);
    if (failRenewal) await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expect(client.loadMedia).toHaveBeenLastCalledWith(expect.objectContaining({ startTime: 123, autoplay: false }));
    expect(client.setActiveTrackIds).toHaveBeenLastCalledWith([]);
    expect(requestCastToken).toHaveBeenLastCalledWith(props.source, props.tracks, expect.any(AbortSignal));
    view.unmount();
    await act(async () => { await jest.advanceTimersByTimeAsync(CAST_RENEWAL_MS); });
    expect(client.loadMedia).toHaveBeenCalledTimes(failRenewal ? 3 : 2);
  } finally {
    view.unmount();
    jest.useRealTimers();
    jest.clearAllMocks();
  }
});
