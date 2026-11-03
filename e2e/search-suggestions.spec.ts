import { expect, test } from "@playwright/test";

for (const width of [320, 398, 1280]) {
  test.describe(`search panel at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("binje:cookie-consent", "dismissed"));
      await page.route("**/api/search?**", (route) => route.fulfill({
        json: { results: [
          { id: 603, media_type: "movie", title: "The Matrix", poster_path: null, release_date: "1999-03-31" },
          { id: 604, media_type: "movie", title: "The Matrix Reloaded", poster_path: null, release_date: "2003-05-15" },
        ] },
      }));
      await page.goto("/en/privacy", { waitUntil: "networkidle" });
      const trigger = page.getByRole("button", { name: "Open search", exact: true });
      await expect(trigger).toHaveAttribute("aria-controls", "navbar-search-panel");
      await trigger.click();
    });

    test("shares the header surface, fits the viewport, and dismisses", async ({ page }) => {
      const input = page.getByRole("searchbox");
      await expect(input).toBeFocused();
      const panel = page.locator("#navbar-search-panel");
      await expect(panel.getByRole("link", { name: "Movies", exact: true })).toBeVisible();
      await input.fill("matrix");
      const results = page.getByRole("list", { name: "Results" });
      await expect(results.getByRole("link")).toHaveCount(2);
      const bounds = await page.locator("nav").first().boundingBox();
      const resultBounds = await results.boundingBox();
      expect(bounds).not.toBeNull();
      expect(resultBounds).not.toBeNull();
      expect(resultBounds!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(resultBounds!.x + resultBounds!.width).toBeLessThanOrEqual(width - 12);
      expect(resultBounds!.y + resultBounds!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
      await input.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Open search", exact: true })).toBeFocused();
      await page.getByRole("button", { name: "Open search", exact: true }).click();
      await expect(input).toHaveValue("");
      await page.locator("main").click({ position: { x: 20, y: 500 } });
      await expect(panel).toHaveCount(0);
    });

    test("empty results recover to page shortcuts", async ({ page }) => {
      await page.route("**/api/search?**", (route) => route.fulfill({ json: { results: [] } }));
      const input = page.getByRole("searchbox");
      await input.fill("missing");
      await expect(page.getByText("No results found", { exact: true })).toBeVisible();
      await input.clear();
      const shortcut = page.locator("#navbar-search-panel").getByRole("link", { name: "Watchlist", exact: true });
      await shortcut.click();
      await expect(page).toHaveURL(/\/en\/watchlist$/);
      await expect(page.locator("#navbar-search-panel")).toHaveCount(0);
    });

    test("arrow selection opens the selected title", async ({ page }) => {
      const input = page.getByRole("searchbox");
      await input.fill("matrix");
      await expect(page.getByRole("list", { name: "Results" }).getByRole("link")).toHaveCount(2);
      await input.press("ArrowUp");
      await input.press("Enter");
      await expect(page).toHaveURL(/\/en\/movie\/604$/);
      await expect(page.locator("#navbar-search-panel")).toHaveCount(0);
    });

    test("search button submits the query", async ({ page }) => {
      await page.getByRole("searchbox").fill("matrix");
      await page.getByRole("button", { name: "Search movies & TV…", exact: true }).click();
      await expect(page).toHaveURL(/\/en\/search\?q=matrix$/);
      await expect(page.locator("#navbar-search-panel")).toHaveCount(0);
    });
  });
}
