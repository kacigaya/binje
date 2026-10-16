import { expect, test } from "@playwright/test";

const key = "binje:cookie-consent";

test("banner is absent from server HTML before JavaScript runs", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/en/privacy");
    await expect(page.getByRole("region", { name: "Cookie consent" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

for (const choice of ["Accept", "Refuse"] as const) {
  test(`${choice} persists and prevents the banner on reload`, async ({ page }) => {
    await page.goto("/en/privacy");
    const banner = page.getByRole("region", { name: "Cookie consent" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: choice, exact: true }).click();
    await expect(banner).toHaveCount(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), key))
      .toBe(choice === "Accept" ? "accepted" : "dismissed");
    await page.reload();
    await expect(page.getByRole("button", { name: "Cookies", exact: true })).toBeVisible();
    await expect(banner).toHaveCount(0);
    await page.getByRole("button", { name: "Cookies", exact: true }).click();
    await expect(banner).toBeVisible();
  });
}

test("invalid storage does not suppress the banner", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "invalid"), key);
  await page.goto("/en/privacy");
  await expect(page.getByRole("region", { name: "Cookie consent" })).toBeVisible();
});

test("blocked storage keeps the banner usable without throwing", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() { throw new DOMException("Storage blocked", "SecurityError"); },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/privacy");
  const banner = page.getByRole("region", { name: "Cookie consent" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Refuse", exact: true }).click();
  expect(errors).toEqual([]);
});
