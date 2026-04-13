import { expect, test, type Browser, type Page } from "@playwright/test";

const PWA_DISMISS_KEY = "factorynerve:pwa-install-dismissed:v1";

const VIEWPORTS = [
  { width: 390, height: 844, label: "390" },
  { width: 768, height: 1024, label: "768" },
] as const;

async function createManagerContext(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.addInitScript((dismissKey) => {
    window.localStorage.setItem(dismissKey, "1");
  }, PWA_DISMISS_KEY);

  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}-reports`;
  const email = `qa_reports_${seed}@example.com`;
  const password = "StrongPassw0rd!";

  const register = await page.request.post("/api/auth/register", {
    headers: { "Content-Type": "application/json" },
    data: {
      name: "QA Reports Manager",
      email,
      password,
      role: "manager",
      factory_name: `QA Factory ${seed}`,
      phone_number: "+910000000000",
    },
  });
  expect(register.ok(), `Registration failed: ${register.status()} ${await register.text()}`).toBeTruthy();

  const registerPayload = await register.json();
  const verificationUrl = new URL(String(registerPayload?.verification_link || ""));
  const verificationToken =
    verificationUrl.searchParams.get("token") ||
    verificationUrl.searchParams.get("verification_token");
  expect(verificationToken, `Verification token missing: ${JSON.stringify(registerPayload)}`).toBeTruthy();

  const verify = await page.request.post("/api/auth/email/verify", {
    headers: { "Content-Type": "application/json" },
    data: { token: verificationToken },
  });
  expect(verify.ok(), `Verification failed: ${verify.status()} ${await verify.text()}`).toBeTruthy();

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
      if (!contextResponse.ok()) return "";
      const payload = await contextResponse.json();
      return payload?.user?.role || "";
    })
    .toBe("manager");

  return { context, page };
}

async function topOffset(locator: ReturnType<Page["locator"]>) {
  return locator.evaluate((element) => element.getBoundingClientRect().top);
}

test.describe("reports mobile structure", () => {
  for (const viewport of VIEWPORTS) {
    test(`reports keeps trust-first mobile ordering at ${viewport.label}px`, async ({ browser }) => {
      test.setTimeout(180_000);
      const { context, page } = await createManagerContext(browser, viewport);

      await page.goto("/reports", { waitUntil: "networkidle" });

      const trustCard = page.getByRole("heading", { name: "Current report period must clear trust before export" });
      const filterCard = page.getByRole("heading", { name: "Current report scope" });
      const resultsCard = page.getByRole("heading", { name: /\d+ rows on this page/ });
      const exportCard = page.getByRole("heading", { name: "Send trusted output" });

      await expect(trustCard).toBeVisible();
      await expect(filterCard).toBeVisible();
      await expect(resultsCard).toBeVisible();
      await expect(exportCard).toBeVisible();

      const [trustTop, filterTop, resultsTop, exportTop] = await Promise.all([
        topOffset(trustCard),
        topOffset(filterCard),
        topOffset(resultsCard),
        topOffset(exportCard),
      ]);

      expect(trustTop).toBeLessThan(filterTop);
      expect(filterTop).toBeLessThan(resultsTop);
      expect(resultsTop).toBeLessThan(exportTop);

      const trustAction = page.getByRole("button", { name: /Review OCR|Open Review Queue/ });
      const trustActionBottom = await trustAction.evaluate((element) => element.getBoundingClientRect().bottom);
      expect(trustActionBottom).toBeLessThan(viewport.height);

      await expect(page.getByText("AI summary gate")).toBeHidden();
      await page.getByRole("button", { name: "Show AI Summary" }).click();
      await expect(page.getByText("AI summary gate")).toBeVisible();

      await page.getByRole("button", { name: /^Filter/ }).click();
      await expect(page.getByRole("dialog", { name: "Report filters" })).toBeVisible();

      await context.close();
    });
  }
});
