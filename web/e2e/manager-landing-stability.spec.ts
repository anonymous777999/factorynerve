import { expect, test, type Page } from "@playwright/test";

async function createManagerSession(page: Page) {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const factoryName = `QA Factory ${seed}`;
  const adminEmail = `qa_admin_${seed}@example.com`;
  const managerEmail = `qa_manager_${seed}@example.com`;
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
      name: "QA Manager",
      email: managerEmail,
      role: "manager",
      factory_name: factoryName,
    },
  });
  expect(invite.ok(), `Manager invite failed: ${invite.status()} ${await invite.text()}`).toBeTruthy();

  const invitePayload = await invite.json();
  const managerPassword = String(invitePayload?.temp_password || "");
  expect(managerPassword, `Manager temp password missing: ${JSON.stringify(invitePayload)}`).toBeTruthy();

  const login = await page.request.post("/api/auth/login", {
    headers: {
      "X-Use-Cookies": "1",
      "Content-Type": "application/json",
    },
    data: {
      email: managerEmail,
      password: managerPassword,
    },
  });
  expect(login.ok(), `Manager login failed: ${login.status()} ${await login.text()}`).toBeTruthy();

  await expect
    .poll(async () => {
      const contextResponse = await page.request.get("/api/auth/context");
      if (!contextResponse.ok()) return "";
      const payload = await contextResponse.json();
      return payload?.user?.role || "";
    })
    .toBe("manager");
}

test.describe("manager landing stability", () => {
  test("manager home route resolves to approvals and manager routes stay usable", async ({ page }) => {
    test.setTimeout(180_000);
    await createManagerSession(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/approvals$/, { timeout: 30_000 });
    await expect(page.getByText("You need an active session first")).toHaveCount(0);
    await expect(page.getByText("Please login to continue.")).toHaveCount(0);
    await expect(page.locator("main").first()).toContainText(/Review Queue/i);

    for (const route of ["/dashboard", "/analytics"]) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}$`));
      await expect(page.getByText("Please login to continue.")).toHaveCount(0);
      await expect(page.getByText("Open Login")).toHaveCount(0);
    }
  });
});
