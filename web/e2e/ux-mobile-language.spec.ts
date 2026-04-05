import { expect, test, type Page } from "@playwright/test";

const LANGUAGE_STORAGE_KEY = "dpr:web:language";

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

async function createAuthenticatedSession(page: Page) {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `qa_ux_${seed}@example.com`;
  const password = "StrongPassw0rd!";
  const response = await page.request.post("/api/auth/register", {
    headers: { "Content-Type": "application/json" },
    data: {
      name: "QA Mobile Language",
      email,
      password,
      role: "attendance",
      factory_name: `QA Factory ${seed}`,
      phone_number: "+910000000000",
    },
  });
  expect(response.ok(), `Registration failed: ${response.status()} ${await response.text()}`).toBeTruthy();

  const login = await page.request.post("/api/auth/login", {
    headers: {
      "X-Use-Cookies": "1",
      "Content-Type": "application/json",
    },
    data: { email, password },
  });
  expect(login.ok(), `Login failed: ${login.status()} ${await login.text()}`).toBeTruthy();

  await expect
    .poll(async () => {
      const contextResponse = await page.request.get("/api/auth/context");
      if (!contextResponse.ok()) return false;
      const payload = await contextResponse.json();
      return Boolean(payload?.user?.id);
    })
    .toBe(true);
}

test.describe("UX smoke", () => {
  test("UX-01 mobile core routes render with primary actions", async ({ page }) => {
    test.setTimeout(180_000);
    await createAuthenticatedSession(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.setViewportSize({ width: 390, height: 844 });
    const routes = ["/dashboard", "/entry", "/ocr/scan", "/steel", "/reports"];

    for (const route of routes) {
      await gotoStable(page, route);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByText("Please login to continue.")).toHaveCount(0);
      await expect(page.locator("button:visible, a:visible").first()).toBeVisible();
    }

    await gotoStable(page, "/entry");
    await expect(page.locator('input[type="date"]').first()).toBeVisible();

    await gotoStable(page, "/ocr/scan");
    await expect(page.locator("main").first()).toBeVisible();
    await expect(page.getByText(/Loading scanner|Scan|Upload/i).first()).toBeVisible();
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });

  test("UX-02 Hindi and Marathi localization keeps core workflow stable", async ({ page }) => {
    test.setTimeout(180_000);
    await createAuthenticatedSession(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 1365, height: 900 });

    const languageCases = [
      { code: "hi" },
      { code: "mr" },
    ] as const;

    for (const languageCase of languageCases) {
      await gotoStable(page, "/dashboard");
      await page.evaluate(
        ({ key, value }) => window.localStorage.setItem(key, value),
        { key: LANGUAGE_STORAGE_KEY, value: languageCase.code },
      );
      await page.reload({ waitUntil: "domcontentloaded" });

      await expect
        .poll(() => page.evaluate(() => document.documentElement.lang))
        .toBe(languageCase.code);

      await gotoStable(page, "/reports");
      await expect(page).toHaveURL(/\/reports$/);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByText("Please login to continue.")).toHaveCount(0);

      await gotoStable(page, "/attendance");
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.getByText("Please login to continue.")).toHaveCount(0);
      await expect(page.locator("button:visible, a:visible").first()).toBeVisible();
    }
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(" | ")}`).toEqual([]);
  });
});
