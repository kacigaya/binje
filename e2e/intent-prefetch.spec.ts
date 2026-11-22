import { devices, expect, test, type Page } from "@playwright/test";

// Browser type stays with the project; `use` cannot override it per file.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
  devices["Pixel 7"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

const BROWSE = "/en/movies";

function fullPrefetchLinks(page: Page) {
  return page.locator('a[data-prefetch-intent="full"][href*="/movie/"]');
}

async function openBrowse(page: Page) {
  await page.goto(BROWSE, { waitUntil: "networkidle" });
  // Lets the dwell timers for cards already in the band fire.
  await page.waitForTimeout(1500);
}

async function cardsBelowBand(page: Page) {
  return page.locator("a[href*='/movie/']").evaluateAll((links: HTMLAnchorElement[]) =>
    links.map((link, index) => ({ index, intent: link.dataset.prefetchIntent, rect: link.getBoundingClientRect() }))
      .filter(
        ({ intent, rect }) =>
          intent !== "full" &&
          rect.top > innerHeight * 0.6 &&
          rect.bottom < innerHeight &&
          rect.left >= 0 &&
          rect.right <= innerWidth,
      )
      .map(({ index, rect }) => ({
        index,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })));
}

test("cards prefetch once scrolling stops, not while it runs", async ({ page }) => {
  await openBrowse(page);
  const links = fullPrefetchLinks(page);
  const initial = await links.count();

  for (let step = 0; step < 12; step++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(250);
  }
  expect(await links.count()).toBe(initial);

  await expect.poll(() => links.count(), { timeout: 3000 }).toBeGreaterThan(initial);
});

test("dwell is skipped when the user saves data", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "connection", {
      get: () => ({ saveData: true }),
    });
  });
  await openBrowse(page);

  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(2000);
  expect(await fullPrefetchLinks(page).count()).toBe(0);
});

test("a held touch prefetches, a swipe does not", async ({ page }) => {
  await openBrowse(page);
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(1500);
  const cdp = await page.context().newCDPSession(page);
  const [held, swiped] = await cardsBelowBand(page);
  if (!held || !swiped) throw new Error("need two visible cards below the dwell band");

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: held.x, y: held.y }],
  });
  const cards = page.locator("a[href*='/movie/']");
  await expect(cards.nth(held.index)).toHaveAttribute("data-prefetch-intent", "full");
  // Cancel instead of lifting so the press does not navigate.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });

  // Scroll away from the dwell band so only touch handlers can trigger a prefetch.
  const scrollBefore = await page.evaluate(() => scrollY);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: swiped.x, y: swiped.y }],
  });
  for (let step = 1; step <= 6; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: swiped.x, y: swiped.y + step * 25 }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(scrollBefore);
  await expect(cards.nth(swiped.index)).not.toHaveAttribute("data-prefetch-intent", "full");
});
