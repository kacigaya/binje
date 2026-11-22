import { act, render } from "@testing-library/react-native";
import type { VideoPlayer } from "expo-video";
import * as client from "../../../api/client";
import { Captions } from "../Captions";
import { indexCues, fetchCues, fetchTitleSubtitles, subtitleUrl, trackLabels } from "../subtitles";

jest.mock("../../../api/client", () => ({ apiRequest: jest.fn() }));
const request = client.apiRequest as jest.Mock;
const cues = [{ start: 1, end: 3, text: "One" }, { start: 2, end: 4, text: "Two" }];

test("shows every cue that covers the position", () => {
  const cueAt = indexCues(cues);
  expect(cueAt(0.5).text).toBe("");
  expect(cueAt(2.5).text).toBe("One\nTwo");
  expect(cueAt(3).text).toBe("Two");
});

test("numbers repeated labels and names unlabeled tracks", () => {
  const tracks = [{ file: "https://a.test/1.vtt", label: "English" }, { file: "https://a.test/2.vtt", label: " English " }, { file: "https://a.test/3.vtt" }];
  expect(trackLabels(tracks, (index) => `Track ${index}`)).toEqual(["English", "English 2", "Track 3"]);
});

test("asks the proxy to convert SRT files", () => {
  expect(subtitleUrl({ file: "https://a.test/1.vtt" })).toMatch(/\/api\/hls\?url=https%3A%2F%2Fa\.test%2F1\.vtt$/);
  expect(subtitleUrl({ file: "https://a.test/1.srt", format: "srt" })).toMatch(/&format=srt$/);
});

test("keeps only valid title-wide tracks", async () => {
  request.mockResolvedValue({ tracks: [{ file: "https://a.test/1.srt", label: "French", format: "srt" }, { file: "javascript:alert(1)", label: "Bad" }, { file: "https://a.test/2.ass", format: "ass" }] });
  await expect(fetchTitleSubtitles({ type: "tv", id: 9, title: "Show", year: "2024", season: 1, episode: 2 })).resolves.toEqual([{ file: "https://a.test/1.srt", label: "French", format: "srt" }]);
  expect(request).toHaveBeenCalledWith("/api/subtitles", expect.objectContaining({ query: expect.objectContaining({ season: 1, episode: 2 }) }));
});

test("parses fetched cues and rejects a failed download", async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ ok: true, text: async () => "WEBVTT\n\n00:01.000 --> 00:02.000\nHello\n" })
    .mockResolvedValueOnce({ ok: false }) as jest.Mock;
  await expect(fetchCues({ file: "https://a.test/1.vtt" })).resolves.toEqual([{ start: 1, end: 2, text: "Hello" }]);
  await expect(fetchCues({ file: "https://a.test/1.vtt" })).rejects.toThrow("unavailable");
});

test("captions follow the player position", () => {
  let onTime: (event: { currentTime: number }) => void = () => {};
  const player = { currentTime: 1.5, playing: false, playbackRate: 1, addListener: jest.fn((_name: string, listener: typeof onTime) => { onTime = listener; return { remove: jest.fn() }; }) };
  const view = render(<Captions player={player as unknown as VideoPlayer} cues={cues} />);
  expect(view.getByText("One", { includeHiddenElements: true })).toBeTruthy();
  act(() => onTime({ currentTime: 3.5 }));
  expect(view.getByText("Two", { includeHiddenElements: true })).toBeTruthy();
  act(() => onTime({ currentTime: 5 }));
  expect(view.queryByText(/One|Two/, { includeHiddenElements: true })).toBeNull();
});

test("finds the next cue edge", () => {
  const cueAt = indexCues(cues);
  expect(cueAt(0).edge).toBe(1);
  expect(cueAt(2.5).edge).toBe(3);
  expect(cueAt(4).edge).toBeUndefined();
});

test("keeps long overlapping cues active across seeks", () => {
  const cueAt = indexCues([
    { start: 0, end: 90, text: "Long" },
    { start: 10, end: 11, text: "Short" },
    { start: 20, end: 21, text: "Later" },
  ]);
  expect(cueAt(50)).toEqual({ text: "Long", edge: 90 });
  expect(cueAt(10)).toEqual({ text: "Long\nShort", edge: 11 });
  expect(cueAt(90)).toEqual({ text: "", edge: undefined });
});

test("captions show a cue that starts and ends between position reports", () => {
  jest.useFakeTimers();
  let onTime: (event: { currentTime: number }) => void = () => {};
  const player = { currentTime: 1, playing: true, playbackRate: 1, addListener: jest.fn((_name: string, listener: typeof onTime) => { onTime = listener; return { remove: jest.fn() }; }) };
  const view = render(<Captions player={player as unknown as VideoPlayer} cues={[{ start: 1.05, end: 1.2, text: "Quick" }]} />);
  act(() => onTime({ currentTime: 1 }));
  player.currentTime = 1.06;
  act(() => { jest.advanceTimersByTime(60); });
  expect(view.getByText("Quick", { includeHiddenElements: true })).toBeTruthy();
  player.currentTime = 1.21;
  act(() => { jest.advanceTimersByTime(150); });
  expect(view.queryByText("Quick", { includeHiddenElements: true })).toBeNull();
  jest.useRealTimers();
});
