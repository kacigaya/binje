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
  await expect(video).toHaveAttribute("controls", "");
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
  await expect(video).toHaveAttribute("controls", "");

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

test("native fullscreen remains available without container fullscreen support", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { value: false });
  });
  const resolving = page.waitForRequest("**/api/resolve?*");
  await page.reload();
  await resolving;
  await expect(page.getByRole("button", { name: "Enter fullscreen" })).toHaveCount(0);
  const video = page.locator("video");
  await expect(video).not.toHaveAttribute("controlslist", "nofullscreen");
  await expect(video).not.toHaveAttribute("data-container-fullscreen", "");
  await playLocalStream(page, 960, 540, true);
  await page.getByRole("button", { name: "Crop black bars" }).click();
  await expectRatio(page, 2.39);
});
