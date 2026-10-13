import { expect, test, type Page } from "@playwright/test";

async function playLocalStream(page: Page, width: number, height: number, letterboxed = false) {
  await page.locator("video").evaluate(async (video: HTMLVideoElement, size) => {
    if (video.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#369";
    const pictureHeight = size.letterboxed ? size.width / 2.39 : size.height;
    context.fillRect(0, (size.height - pictureHeight) / 2, size.width, pictureHeight);
    video.muted = true;
    video.srcObject = canvas.captureStream(1);
    await video.play();
  }, { width, height, letterboxed });
}

async function expectRatio(page: Page, ratio: number) {
  await expect.poll(() => page.locator("video").evaluate((video) => {
    const bounds = video.getBoundingClientRect();
    return bounds.width / bounds.height;
  })).toBeCloseTo(ratio, 2);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/sources?*", (route) => route.fulfill({
    json: { sources: ["cine4k"] },
  }));
  // Hold the external resolver while a deterministic local stream supplies frames.
  await page.route("**/api/resolve?*", () => {});
  const resolving = page.waitForRequest("**/api/resolve?*");
  await page.goto("/en/watch/353486");
  await resolving;
});

test("player fits video dimensions and resets to the loading ratio", async ({ page }) => {
  const video = page.locator("video");
  await expectRatio(page, 16 / 9);

  await playLocalStream(page, 960, 400);
  await expectRatio(page, 2.4);
  await expect(video).toHaveCSS("object-fit", "contain");
  await expect(video).not.toHaveAttribute("controls");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectRatio(page, 2.4);

  await playLocalStream(page, 640, 480);
  await expectRatio(page, 4 / 3);
  await video.evaluate((element: HTMLVideoElement) => {
    element.pause();
    if (element.srcObject instanceof MediaStream) {
      element.srcObject.getTracks().forEach((track) => track.stop());
    }
    element.srcObject = null;
    element.removeAttribute("src");
    element.load();
  });
  await expectRatio(page, 16 / 9);
});

test("crop removes encoded bars and stays enabled in container fullscreen", async ({ page }) => {
  const crop = page.getByRole("button", { name: "Crop black bars" });
  await expect(crop).toBeDisabled();
  await playLocalStream(page, 960, 540, true);
  await expectRatio(page, 16 / 9);
  const video = page.locator("video");
  await expect(crop).toHaveAttribute("aria-pressed", "false");
  await crop.click();
  await expect(crop).toHaveAttribute("aria-pressed", "true");
  await expectRatio(page, 2.39);
  await expect(video).toHaveCSS("object-fit", "cover");

  const playbackTime = await video.evaluate((element: HTMLVideoElement) => element.currentTime);
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.contains(document.querySelector("video")))).toBe(true);
  await expectRatio(page, 2.39);
  await expect.poll(() => video.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return Math.abs(bounds.top - (innerHeight - bounds.height) / 2);
  })).toBeLessThan(1);
  await expect(crop).toBeVisible();
  await expect(crop).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThanOrEqual(playbackTime);
  await crop.click();
  await expectRatio(page, 16 / 9);
  await crop.click();
  await expectRatio(page, 2.39);

  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(page.getByRole("button", { name: "Enter fullscreen" })).toBeFocused();
  await expectRatio(page, 2.39);
  await crop.focus();
  await page.keyboard.press("Space");
  await expect(crop).toHaveAttribute("aria-pressed", "false");
  await expectRatio(page, 16 / 9);
  await expect(video).toHaveCSS("object-fit", "contain");
});

test("crop keeps already widescreen video intact and resets when emptied", async ({ page }) => {
  await playLocalStream(page, 960, 400);
  const crop = page.getByRole("button", { name: "Crop black bars" });
  await crop.click();
  await expectRatio(page, 2.4);
  await page.locator("video").evaluate((video: HTMLVideoElement) => {
    if (video.srcObject instanceof MediaStream) {
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
    video.srcObject = null;
    video.load();
  });
  await expect(crop).toHaveAttribute("aria-pressed", "false");
  await expect(crop).toBeDisabled();
  await expectRatio(page, 16 / 9);
});

test("fullscreen failure leaves the cropped player usable", async ({ page }) => {
  await playLocalStream(page, 960, 540, true);
  await page.getByRole("button", { name: "Crop black bars" }).click();
  await page.evaluate(() => {
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new Error("Fullscreen denied"));
  });
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.getByText("Fullscreen unavailable")).toBeVisible();
  await expectRatio(page, 2.39);
  await page.getByRole("button", { name: "Crop black bars" }).click();
  await expectRatio(page, 16 / 9);
});

test("video fullscreen is used without container fullscreen support", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false });
    Object.assign(HTMLVideoElement.prototype, {
      webkitEnterFullscreen() {
        document.body.dataset.videoFullscreen = "true";
      },
    });
  });
  const resolving = page.waitForRequest("**/api/resolve?*");
  await page.reload();
  await resolving;
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator("body")).toHaveAttribute("data-video-fullscreen", "true");
  await playLocalStream(page, 960, 540, true);
  await page.getByRole("button", { name: "Crop black bars" }).click();
  await expectRatio(page, 2.39);
});

test("controls hide while playing and return on pointer or keyboard input", async ({ page }) => {
  // Installed first so the idle timer started by playback is a fake one too.
  await page.clock.install();
  await playLocalStream(page, 960, 540, true);
  const controls = page.locator("[data-player-controls]");
  const crop = page.locator("button[aria-label='Crop black bars']");
  await page.locator("video").dispatchEvent("pointermove", { pointerType: "mouse" });
  await page.clock.runFor(2700);
  await expect(controls).toHaveCSS("opacity", "0");
  await expect(controls).toHaveAttribute("inert", "");
  await expect(controls).toHaveAttribute("aria-hidden", "true");

  await page.locator("video").dispatchEvent("pointermove", { pointerType: "mouse" });
  await expect(controls).toHaveCSS("opacity", "1");
  await expect(controls).not.toHaveAttribute("inert", "");
  await page.clock.runFor(2700);
  await expect(controls).toHaveCSS("opacity", "0");

  await page.keyboard.press("Tab");
  await crop.focus();
  await expect(controls).toHaveCSS("opacity", "1");
  await page.clock.runFor(2700);
  await expect(controls).toHaveCSS("opacity", "1");

  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  await page.locator("video").evaluate((video: HTMLVideoElement) => video.pause());
  await page.clock.runFor(2700);
  await expect(controls).toHaveCSS("opacity", "1");
});

test("seek bar stops painting while controls are hidden and resumes when shown", async ({ page }) => {
  await page.clock.install();
  await page.evaluate(() => {
    const setProperty = CSSStyleDeclaration.prototype.setProperty;
    let paints = 0;
    document.body.dataset.seekPaints = "0";
    CSSStyleDeclaration.prototype.setProperty = function (property, value, priority) {
      if (property === "--progress") document.body.dataset.seekPaints = String(++paints);
      return setProperty.call(this, property, value, priority);
    };
  });
  await playLocalStream(page, 960, 540);
  const video = page.locator("video");
  const controls = page.locator("[data-player-controls]");
  const paints = () => page.locator("body").getAttribute("data-seek-paints");

  await video.dispatchEvent("pointermove", { pointerType: "mouse" });
  await page.clock.runFor(500);
  expect(Number(await paints())).toBeGreaterThan(1);
  await page.clock.runFor(2200);
  await expect(controls).toHaveAttribute("aria-hidden", "true");
  const hiddenPaints = await paints();
  await video.dispatchEvent("timeupdate");
  await video.dispatchEvent("progress");
  await video.dispatchEvent("playing");
  await page.clock.runFor(1000);
  expect(await paints()).toBe(hiddenPaints);
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(false);

  await video.dispatchEvent("pointermove", { pointerType: "mouse" });
  await expect(controls).toHaveAttribute("aria-hidden", "false");
  await page.clock.runFor(500);
  expect(Number(await paints())).toBeGreaterThan(Number(hiddenPaints) + 1);
});

test("desktop controls play, seek, and mute", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await playLocalStream(page, 960, 540);
  const video = page.locator("video");
  const isPaused = () => video.evaluate((element: HTMLVideoElement) => element.paused);

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(isPaused).toBe(true);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(isPaused).toBe(false);

  // The test stream starts muted.
  await page.getByRole("button", { name: "Unmute", exact: true }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(false);
  await page.getByRole("button", { name: "Mute", exact: true }).click();
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);

  // A click on the picture toggles playback; keyboard shortcuts work from the page.
  await video.click({ force: true });
  await expect.poll(isPaused).toBe(true);
  await page.locator("body").press("k");
  await expect.poll(isPaused).toBe(false);
  await page.locator("body").press("m");
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(false);
});

test("seek bar seeks on commit and formats time", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("video").evaluate(async (video: HTMLVideoElement) => {
    // A silent one-minute WAV gives a finite, seekable duration.
    const rate = 8000;
    const samples = rate * 60;
    const buffer = new ArrayBuffer(44 + samples);
    const view = new DataView(buffer);
    const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, "RIFF");
    view.setUint32(4, 36 + samples, true);
    text(8, "WAVEfmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    text(36, "data");
    view.setUint32(40, samples, true);
    new Uint8Array(buffer, 44).fill(128);
    video.src = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
    await new Promise((resolve) => video.addEventListener("loadedmetadata", resolve, { once: true }));
  });
  const seek = page.getByRole("slider", { name: "Seek" });
  await expect(seek).toBeEnabled();
  await expect(seek).toHaveAttribute("aria-valuetext", "0:00 / 1:00");
  await seek.focus();
  await page.keyboard.press("End");
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(59);
  await page.keyboard.press("Home");
  await expect.poll(() => page.locator("video").evaluate((video: HTMLVideoElement) => video.currentTime)).toBe(0);
  await expect(seek).toHaveAttribute("aria-valuetext", "0:00 / 1:00");
});

test("sources without subtitles borrow the title's, off at first, in the viewer's language", async ({ page }) => {
  await page.route("**/api/subtitles?*", (route) => route.fulfill({
    json: {
      tracks: [
        { file: "https://subs.test/ar.vtt", label: "Arabic" },
        { file: "https://subs.test/en.vtt", label: "English" },
        { file: "https://subs.test/fr.vtt", label: "French" },
        { file: "https://subs.test/fr2.vtt", label: "French" },
      ],
    },
  }));
  // A source without tracks: the request waits for it. Its stream is held.
  await page.unroute("**/api/resolve?*");
  await page.route("**/api/resolve?*", (route) => route.fulfill({
    json: { url: "https://cdn.test/master.m3u8", tracks: [] },
  }));
  await page.route("**/api/hls?*", () => {});
  const fetching = page.waitForRequest("**/api/subtitles?*");
  await page.goto("/fr/watch/353486");
  await fetching;
  const modes = () => page.locator("video track").evaluateAll((tracks: HTMLTrackElement[]) =>
    tracks.map((track) => `${track.label}:${track.track.mode}`));
  await expect.poll(modes).toEqual(["Français:disabled", "Français 2:disabled", "Anglais:disabled", "Arabic:disabled"]);

  await page.getByRole("button", { name: "Sous-titres" }).click();
  await page.getByText("Français 2", { exact: true }).click();
  await page.keyboard.press("Escape");
  await expect.poll(modes).toEqual(["Français:disabled", "Français 2:showing", "Anglais:disabled", "Arabic:disabled"]);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("c");
  await expect.poll(modes).toEqual(["Français:disabled", "Français 2:disabled", "Anglais:disabled", "Arabic:disabled"]);
});

test("other providers' subtitles join the source's own, which stays on", async ({ page }) => {
  await page.route("**/api/subtitles?*", (route) => route.fulfill({
    json: {
      tracks: [
        { file: "https://subs.test/fr.vtt", label: "French" },
        { file: "https://subs.test/en.vtt", label: "English" },
        { file: "https://subs.test/en2.vtt", label: "English" },
        { file: "https://subs.test/ko.vtt", label: "Korean" },
      ],
    },
  }));
  await page.unroute("**/api/resolve?*");
  await page.route("**/api/resolve?*", (route) => route.fulfill({
    json: {
      url: "https://cdn.test/master.m3u8",
      tracks: [{ file: "https://subs.test/en.vtt", label: "English" }, { file: "https://subs.test/own2.vtt", label: "English 2" }],
    },
  }));
  await page.route("**/api/hls?*", () => {});
  await page.reload();
  const modes = () => page.locator("video track").evaluateAll((tracks: HTMLTrackElement[]) =>
    tracks.map((track) => `${track.label}:${track.track.mode}`));
  // The source's file is listed once, first within its language, and on.
  await expect.poll(modes).toEqual(["English:showing", "English 2:disabled", "English 3:disabled", "French:disabled", "Korean:disabled"]);
});

test("mobile playback buttons sit at the player's center", async ({ page }) => {
  await page.unroute("**/api/resolve?*");
  await page.route("**/api/resolve?*", (route) => route.fulfill({
    json: { url: "https://cdn.test/master.m3u8", tracks: [{ file: "https://subs.test/en.vtt", label: "English" }] },
  }));
  await page.route("**/api/hls?*", () => {});
  await page.reload();
  const play = page.locator("[data-player-controls] button[aria-label='Play']").last();
  await expect(play).toBeVisible();
  const player = (await page.locator("video").boundingBox())!;
  const button = (await play.boundingBox())!;
  expect(Math.abs(button.x + button.width / 2 - (player.x + player.width / 2))).toBeLessThan(1);
  expect(Math.abs(button.y + button.height / 2 - (player.y + player.height / 2))).toBeLessThan(1);
});

async function playerWithSubtitle(page: Page, vtt: string) {
  await page.route("**/api/subtitles?*", (route) => route.fulfill({ json: { tracks: [] } }));
  await page.unroute("**/api/resolve?*");
  await page.route("**/api/resolve?*", (route) => route.fulfill({
    json: { url: "https://cdn.test/master.m3u8", tracks: [{ file: "https://subs.test/en.vtt", label: "English" }] },
  }));
  // Only the subtitle file loads; the stream is held.
  await page.route("**/api/hls?*", (route) => route.request().url().includes("subs.test")
    ? route.fulfill({ contentType: "text/vtt", body: vtt })
    : undefined);
  await page.reload();
}

const cueStarts = (page: Page) => page.locator("video track").first().evaluate((track: HTMLTrackElement) =>
  Array.from(track.track.cues ?? []).map((cue) => Math.round(cue.startTime * 100) / 100));

test("subtitle delay moves the lines, by menu or G and H, and is remembered", async ({ page }) => {
  await playerWithSubtitle(page, "WEBVTT\n\n00:10.000 --> 00:12.000\nOne\n\n00:20.000 --> 00:22.000\nTwo\n");
  await expect.poll(() => cueStarts(page)).toEqual([10, 20]);

  await page.getByRole("button", { name: "Subtitles" }).click();
  await page.getByRole("button", { name: "Subtitles later" }).click();
  await page.getByRole("button", { name: "Subtitles later" }).click();
  await expect(page.locator("output")).toHaveText("+1 s");
  await expect.poll(() => cueStarts(page)).toEqual([11, 21]);
  await page.keyboard.press("Escape");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("g");
  await expect(page.getByRole("status").filter({ hasText: "Subtitle delay: +0.9 s" })).toBeVisible();
  await expect.poll(() => cueStarts(page)).toEqual([10.9, 20.9]);

  await page.reload();
  await expect.poll(() => cueStarts(page)).toEqual([10.9, 20.9]);
  await page.getByRole("button", { name: "Subtitles" }).click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect.poll(() => cueStarts(page)).toEqual([10, 20]);
});

test("auto-sync applies the offset and scale the server finds", async ({ page }) => {
  const sent: { query?: URLSearchParams } = {};
  await page.route("**/api/subtitles/sync?*", (route) => {
    sent.query = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { offset: -2.5, scale: 1 } });
  });
  await playerWithSubtitle(page, "WEBVTT\n\n00:10.000 --> 00:12.000\nOne\n");
  await expect.poll(() => cueStarts(page)).toEqual([10]);
  await page.getByRole("button", { name: "Subtitles" }).click();
  await page.getByRole("button", { name: "Auto-sync" }).click();
  await expect(page.getByText("Synced to the audio.")).toBeVisible();
  await expect.poll(() => cueStarts(page)).toEqual([7.5]);
  expect(sent.query?.get("stream")).toBe("https://cdn.test/master.m3u8");
  expect(sent.query?.get("file")).toBe("https://subs.test/en.vtt");
});

test("a delay set during auto-sync wins over its late answer", async ({ page }) => {
  let answer: () => void = () => {};
  await page.route("**/api/subtitles/sync?*", (route) => {
    answer = () => void route.fulfill({ json: { offset: -2.5, scale: 1 } }).catch(() => undefined);
  });
  await playerWithSubtitle(page, "WEBVTT\n\n00:10.000 --> 00:12.000\nOne\n");
  await expect.poll(() => cueStarts(page)).toEqual([10]);
  await page.getByRole("button", { name: "Subtitles" }).click();
  await page.getByRole("button", { name: "Auto-sync" }).click();
  await page.getByRole("button", { name: "Subtitles later" }).click();
  answer();
  await page.waitForTimeout(500);
  await expect.poll(() => cueStarts(page)).toEqual([10.5]);
  await expect(page.locator("output")).toHaveText("+0.5 s");
});
