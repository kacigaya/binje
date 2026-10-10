import { devices, expect, test, type Page } from "@playwright/test";

// Browser type stays with the project; `use` cannot override it per file.
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } =
  devices["Pixel 7"];
test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

const BROWSE = "/en/movies";

/**
 * Records full prefetches (`prefetch={true}`). App Shell prefetches from
 * `prefetch="auto"` carry a segment header; full ones do not.
 */
function recordFullPrefetches(page: Page) {
  const paths: string[] = [];
  page.on("request", (request) => {
    const headers = request.headers();
    if (
      headers["next-router-prefetch"] &&
      !headers["next-router-segment-prefetch"]
    ) {
      paths.push(new URL(request.url()).pathname);
    }
  });
  return paths;
}

async function openBrowse(page: Page) {
  await page.goto(BROWSE, { waitUntil: "networkidle" });
  // Lets the dwell timers for cards already in the band fire.
  await page.waitForTimeout(1500);
}

/** Fully visible card links below the dwell band, not yet prefetched. */
async function cardsBelowBand(page: Page, skip: string[]) {
  return page.evaluate((skip) =>
    [...document.querySelectorAll<HTMLAnchorElement>("a[href*='/movie/']")]
      .map((a) => ({ path: new URL(a.href).pathname, rect: a.getBoundingClientRect() }))
      .filter(
        ({ path, rect }) =>
          rect.top > innerHeight * 0.6 &&
          rect.bottom < innerHeight &&
          rect.left >= 0 &&
          rect.right <= innerWidth &&
          !skip.includes(path),
      )
      .map(({ path, rect }) => ({
        path,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })),
  skip);
}

test("cards prefetch once scrolling stops, not while it runs", async ({ page }) => {
  await openBrowse(page);
  const prefetched = recordFullPrefetches(page);

  for (let step = 0; step < 12; step++) {
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(250);
  }
  expect(prefetched).toEqual([]);

  await expect.poll(() => prefetched.length, { timeout: 3000 }).toBeGreaterThan(0);
  expect(prefetched.every((path) => path.startsWith("/en/movie/"))).toBe(true);
});

test("dwell is skipped when the user saves data", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "connection", {
      get: () => ({ saveData: true }),
    });
  });
  await openBrowse(page);
  const prefetched = recordFullPrefetches(page);

  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(2000);
  expect(prefetched).toEqual([]);
});

test("a held touch prefetches, a swipe does not", async ({ page }) => {
  await openBrowse(page);
  await page.mouse.wheel(0, 1000);
  await page.waitForTimeout(1500);
  const prefetched = recordFullPrefetches(page);
  const cdp = await page.context().newCDPSession(page);
  const [held, swiped] = await cardsBelowBand(page, prefetched);
  if (!held || !swiped) throw new Error("need two visible cards below the dwell band");

  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: held.x, y: held.y }],
  });
  await expect.poll(() => prefetched, { timeout: 1000 }).toContain(held.path);
  // Cancel instead of lifting so the press does not navigate.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });

  // Finger moving down scrolls the page up, carrying the card further below
  // the dwell band, so only the touch handlers could prefetch it.
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
  expect(prefetched).not.toContain(swiped.path);
});
