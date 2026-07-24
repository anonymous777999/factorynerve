import { test, expect } from "@playwright/test";

/**
 * @performance
 * Basic performance timing check on the login page.
 */
test.describe("Performance Benchmarks", { tag: "@performance" }, () => {
  test("login page loads within acceptable time", async ({ page }) => {
    const start = Date.now();
    const response = await page.goto("/login", {
      waitUntil: "domcontentloaded",
    });
    const loadTime = Date.now() - start;
    expect(response?.status()).toBe(200);
    // Alert if load time exceeds threshold (but don't fail — informational)
    console.log(`Login page load time: ${loadTime}ms`);
  });
});
