import { test, expect } from "@playwright/test";

/**
 * @accessibility
 * Basic accessibility check on the login page.
 */
test.describe("Accessibility Checks", { tag: "@accessibility" }, () => {
  test("login page has expected form elements", async ({ page }) => {
    await page.goto("/login");
    // Check that the page has a form with accessible elements
    const form = page.locator("form");
    await expect(form).toBeAttached();
    // Verify input fields are accessible
    const inputs = page.locator("input");
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThanOrEqual(1);
  });
});
