import { expect, test, type Page } from "@playwright/test";

async function gotoStable(page: Page, path: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(400);
    }
  }
  throw lastError;
}

test.describe("Plans page public access", () => {
  test("PLANS-01: /plans renders pricing page without authentication", async ({ page }) => {
    test.setTimeout(60_000);

    // Ensure no auth cookies are present
    await page.context().clearCookies();

    // Navigate to /plans without any session
    await gotoStable(page, "/plans");

    // Verify we are NOT redirected to /access (the login gate)
    await expect(page).toHaveURL(/\/plans/);

    // Verify the page rendered with pricing content
    await expect(page.getByText("Plans built for real factory operations")).toBeVisible();
    await expect(page.getByText("Factory Pilot")).toBeVisible();
    await expect(page.getByText("Factory")).toBeVisible();
    await expect(page.getByText("Operator")).toBeVisible();
    await expect(page.getByText("Enterprise")).toBeVisible();

    // Verify CTA buttons are visible (key interactive elements)
    await expect(page.getByText("Start Your Pilot")).toBeVisible();
    await expect(page.getByText("Talk to Sales")).toBeVisible();

    // Verify no "Please login" text is shown
    await expect(page.getByText("Please login to continue.")).toHaveCount(0);

    // Verify billing toggle works (interaction test)
    await expect(page.getByRole("switch")).toBeVisible();
    await page.getByRole("switch").click();
    // After toggling to Annual, the annual pricing should appear
    await expect(page.getByText("Save 17%").first()).toBeVisible();
  });

  test("PLANS-02: /plans loads with zero page errors", async ({ page }) => {
    test.setTimeout(60_000);
    await page.context().clearCookies();

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await gotoStable(page, "/plans");
    await expect(page.locator("main").first()).toBeVisible();

    // Wait a moment for any async loading to complete
    await page.waitForTimeout(1_000);

    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("PLANS-03: protected route /dashboard redirects unauthenticated users to /access", async ({ page }) => {
    test.setTimeout(60_000);
    await page.context().clearCookies();

    await gotoStable(page, "/dashboard");

    // Unauthenticated access to /dashboard should redirect to /access
    await expect(page).toHaveURL(/\/access\?next=%2Fdashboard/);
  });

  test("PLANS-04: /plans pricing cards display plan features", async ({ page }) => {
    test.setTimeout(60_000);
    await page.context().clearCookies();

    await gotoStable(page, "/plans");

    // Verify plan cards render with feature information
    const factoryCard = page.getByText("Factory").first();
    await expect(factoryCard).toBeVisible();

    // Verify key feature labels are present on the page
    await expect(page.getByText("Users")).toBeVisible();
    await expect(page.getByText("AI Operations")).toBeVisible();
    await expect(page.getByText("Uptime SLA")).toBeVisible();
  });

  test("PLANS-05: OCR packs section is visible on /plans", async ({ page }) => {
    test.setTimeout(60_000);
    await page.context().clearCookies();

    await gotoStable(page, "/plans");

    // OCR packs section should be visible
    await expect(page.getByText("OCR PACKS")).toBeVisible();
    await expect(page.getByText("Add more scanning power when you need it")).toBeVisible();

    // OCR pack names should be visible
    await expect(page.getByText("Starter Digitization")).toBeVisible();
    await expect(page.getByText("Production Digitization")).toBeVisible();
    await expect(page.getByText("Operations Digitization")).toBeVisible();
    await expect(page.getByText("Plant Digitization")).toBeVisible();
  });

  test("PLANS-06: WhatsApp packs section is visible on /plans", async ({ page }) => {
    test.setTimeout(60_000);
    await page.context().clearCookies();

    await gotoStable(page, "/plans");

    // WhatsApp packs section should be visible
    await expect(page.getByText("WHATSAPP PACKS")).toBeVisible();
    await expect(page.getByText("Add messaging capacity when you need it")).toBeVisible();

    // WhatsApp pack names should be visible
    await expect(page.getByText("WhatsApp Boost")).toBeVisible();
    await expect(page.getByText("WhatsApp Scale")).toBeVisible();
    await expect(page.getByText("WhatsApp Operations")).toBeVisible();
  });

  test("PLANS-07: public legal and info pages are also accessible without auth", async ({ page }) => {
    test.setTimeout(60_000);
    await page.context().clearCookies();

    // Verify a few key public pages are also accessible
    const publicPages = ["/privacy", "/terms", "/faq", "/contact"];

    for (const route of publicPages) {
      await gotoStable(page, route);
      // Should render the page, not redirect to /access
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, "\\/")));
      await expect(page.getByText("Please login to continue.")).toHaveCount(0);
    }
  });
});
