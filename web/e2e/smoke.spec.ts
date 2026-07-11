import { test, expect } from "@playwright/test";

/**
 * @smoke
 * Basic smoke test: verify the login page loads and has expected elements.
 */
test.describe("Smoke Tests", { tag: "@smoke" }, () => {
  test("login page loads and renders key elements", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/login/i);
  });
});
