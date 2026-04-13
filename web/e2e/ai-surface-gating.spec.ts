import { expect, test, type Page } from "@playwright/test";

async function createOwnerSession(page: Page) {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const factoryName = `QA Factory ${seed}`;
  const adminEmail = `qa_admin_${seed}@example.com`;
  const ownerEmail = `qa_owner_${seed}@example.com`;
  const adminPassword = "StrongPassw0rd!";

  const register = await page.request.post("/api/auth/register", {
    headers: { "Content-Type": "application/json" },
    data: {
      name: "QA Admin",
      email: adminEmail,
      password: adminPassword,
      role: "admin",
      factory_name: factoryName,
      phone_number: "+910000000000",
    },
  });
  expect(register.ok(), `Admin registration failed: ${register.status()} ${await register.text()}`).toBeTruthy();

  const registerPayload = await register.json();
  const verificationUrl = new URL(String(registerPayload?.verification_link || ""));
  const verificationToken =
    verificationUrl.searchParams.get("token") ||
    verificationUrl.searchParams.get("verification_token");
  expect(verificationToken, `Admin verification token missing: ${JSON.stringify(registerPayload)}`).toBeTruthy();

  const verify = await page.request.post("/api/auth/email/verify", {
    headers: { "Content-Type": "application/json" },
    data: { token: verificationToken },
  });
  expect(verify.ok(), `Admin verification failed: ${verify.status()} ${await verify.text()}`).toBeTruthy();

  const adminLogin = await page.request.post("/api/auth/login", {
    headers: {
      "X-Use-Cookies": "1",
      "Content-Type": "application/json",
    },
    data: {
      email: adminEmail,
      password: adminPassword,
    },
  });
  expect(adminLogin.ok(), `Admin login failed: ${adminLogin.status()} ${await adminLogin.text()}`).toBeTruthy();

  const csrfToken = adminLogin.headers()["x-csrf-token"];
  expect(csrfToken, "Missing CSRF token after admin login.").toBeTruthy();

  const invite = await page.request.post("/api/settings/users/invite", {
    headers: {
      "X-CSRF-Token": csrfToken,
      "Content-Type": "application/json",
    },
    data: {
      name: "QA Owner",
      email: ownerEmail,
      role: "owner",
      factory_name: factoryName,
    },
  });
  expect(invite.ok(), `Owner invite failed: ${invite.status()} ${await invite.text()}`).toBeTruthy();

  const invitePayload = await invite.json();
  const ownerPassword = String(invitePayload?.temp_password || "");
  expect(ownerPassword, `Owner temp password missing: ${JSON.stringify(invitePayload)}`).toBeTruthy();

  const login = await page.request.post("/api/auth/login", {
    headers: {
      "X-Use-Cookies": "1",
      "Content-Type": "application/json",
    },
    data: {
      email: ownerEmail,
      password: ownerPassword,
    },
  });
  expect(login.ok(), `Owner login failed: ${login.status()} ${await login.text()}`).toBeTruthy();

  await expect
    .poll(async () => {
      const contextResponse = await page.request.get("/api/auth/context");
      if (!contextResponse.ok()) return "";
      const payload = await contextResponse.json();
      return payload?.user?.role || "";
    })
    .toBe("owner");
}

test.describe("AI surface gating", () => {
  test("owner routes show the intentional AI gate instead of unfinished scaffolds", async ({ page }) => {
    test.setTimeout(180_000);
    await createOwnerSession(page);

    await page.goto("/ai", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/premium\/dashboard\?notice=ai-coming-soon$/, { timeout: 30_000 });
    await expect(page.getByText("AI Insights \u2014 coming soon")).toBeVisible();
    await expect(
      page.getByText("We are training your factory's intelligence model. You will be notified when insights are ready."),
    ).toBeVisible();
    await expect(page.locator('a[href="/ai"]')).toHaveCount(0);

    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.locator('a[href="/ai"]')).toHaveCount(0);
    await expect(page.getByText("Open AI Insights")).toHaveCount(0);

    await page.goto("/reports", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Executive AI Summary" })).toBeVisible();
    await expect(page.getByText("AI Insights \u2014 coming soon")).toBeVisible();
    await expect(page.getByText("Generate a management summary for the currently selected date range.")).toHaveCount(0);
    await expect(page.getByText("Owner summary lane")).toHaveCount(0);
  });
});
