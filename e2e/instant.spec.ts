import { expect, test } from "@playwright/test";
import { instant } from "@next/playwright";

test("TV watch shell is available before request-time data", async ({
  page,
  baseURL,
}) => {
  await instant(
    page,
    async () => {
      await page.goto("/en/watch/tv/1399?s=1&e=1");

      await expect(page.getByTestId("watch-tv-shell")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: "TV" })).toBeVisible();
      await expect(page.getByTestId("watch-tv-player-frame")).toBeVisible();
      await expect(page.getByTestId("watch-tv-data")).toHaveCount(0);
      await expect(page.getByTestId("watch-tv-player")).toHaveCount(0);
    },
    { baseURL },
  );
});
