import { act, render } from "@testing-library/react-native";
import type { VideoPlayer } from "expo-video";
import * as client from "../../../api/client";
import { Captions } from "../Captions";
import { activeCueText, fetchCues, fetchTitleSubtitles, subtitleUrl, trackLabels } from "../subtitles";

jest.mock("../../../api/client", () => ({ apiRequest: jest.fn() }));
const request = client.apiRequest as jest.Mock;
const cues = [{ start: 1, end: 3, text: "One" }, { start: 2, end: 4, text: "Two" }];

test("shows every cue that covers the position", () => {
  expect(activeCueText(cues, 0.5)).toBe("");
  expect(activeCueText(cues, 2.5)).toBe("One\nTwo");
  expect(activeCueText(cues, 3)).toBe("Two");
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
  const player = { currentTime: 1.5, addListener: jest.fn((_name: string, listener: typeof onTime) => { onTime = listener; return { remove: jest.fn() }; }) };
  const view = render(<Captions player={player as unknown as VideoPlayer} cues={cues} />);
  expect(view.getByText("One", { includeHiddenElements: true })).toBeTruthy();
  act(() => onTime({ currentTime: 3.5 }));
  expect(view.getByText("Two", { includeHiddenElements: true })).toBeTruthy();
  act(() => onTime({ currentTime: 5 }));
  expect(view.queryByText(/One|Two/, { includeHiddenElements: true })).toBeNull();
});
