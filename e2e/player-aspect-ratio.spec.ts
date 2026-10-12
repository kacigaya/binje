import { expect, test, type Page } from "@playwright/test";

async function playLocalStream(page: Page, width: number, height: number) {
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
    video.muted = true;
    video.srcObject = canvas.captureStream(1);
    await video.play();
  }, { width, height });
}

async function expectRatio(page: Page, ratio: number) {
  await expect.poll(() => page.locator("video").evaluate((video) => {
    const bounds = video.getBoundingClientRect();
    return bounds.width / bounds.height;
  })).toBeCloseTo(ratio, 2);
}

test("player fits video dimensions and resets to the loading ratio", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/sources?*", (route) => route.fulfill({
    json: { sources: ["cine4k"] },
  }));
  // Hold the external resolver while a deterministic local stream supplies frames.
  await page.route("**/api/resolve?*", () => {});
  const resolving = page.waitForRequest("**/api/resolve?*");
  await page.goto("/en/watch/353486");
  await resolving;
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
