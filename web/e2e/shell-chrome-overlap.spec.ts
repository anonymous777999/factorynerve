import { expect, test, type Browser, type Page } from "@playwright/test";

const PWA_DISMISS_KEY = "factorynerve:pwa-install-dismissed:v1";

const VIEWPORTS = [
  { width: 390, height: 844, label: "390" },
  { width: 430, height: 932, label: "430" },
  { width: 768, height: 1024, label: "768" },
  { width: 1365, height: 900, label: "1365" },
] as const;

const ROUTE_GROUPS = [
  {
    role: "operator",
    routes: ["/dashboard", "/attendance", "/entry", "/tasks"],
  },
  {
    role: "supervisor",
    routes: ["/approvals", "/reports"],
  },
  {
    role: "admin",
    routes: ["/premium/dashboard"],
  },
] as const;

type AuditResult = {
  chrome: Array<{ tag: string; top: number; bottom: number; left: number; right: number }>;
  overlaps: Array<{ tag: string; label: string; top: number; bottom: number; left: number; right: number }>;
  route: string;
  viewport: string;
};

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

async function createAuthenticatedContext(
  browser: Browser,
  options: {
  role: string;
  viewport: { width: number; height: number };
},
) {
  const { role, viewport } = options;
  const context = await browser.newContext({
    viewport,
  });
  const page = await context.newPage();
  await page.addInitScript((dismissKey) => {
    window.localStorage.setItem(dismissKey, "1");
  }, PWA_DISMISS_KEY);

  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}-${role}`;
  const email = `qa_shell_${seed}@example.com`;
  const password = "StrongPassw0rd!";

  const response = await page.request.post("/api/auth/register", {
    headers: { "Content-Type": "application/json" },
    data: {
      name: `QA ${role}`,
      email,
      password,
      role,
      factory_name: `QA Factory ${seed}`,
      phone_number: "+910000000000",
    },
  });
  expect(response.ok(), `Registration failed for ${role}: ${response.status()} ${await response.text()}`).toBeTruthy();
  const registerPayload = await response.json();
  const verificationLink = String(registerPayload?.verification_link || "");
  expect(verificationLink, `Verification link missing for ${role}: ${JSON.stringify(registerPayload)}`).toBeTruthy();

  const verificationUrl = new URL(verificationLink);
  const token =
    verificationUrl.searchParams.get("token") ||
    verificationUrl.searchParams.get("verification_token");
  expect(token, `Verification token missing for ${role}: ${verificationLink}`).toBeTruthy();

  const verify = await page.request.post("/api/auth/email/verify", {
    headers: { "Content-Type": "application/json" },
    data: { token },
  });
  expect(verify.ok(), `Email verification failed for ${role}: ${verify.status()} ${await verify.text()}`).toBeTruthy();

  const login = await page.request.post("/api/auth/login", {
    headers: {
      "X-Use-Cookies": "1",
      "Content-Type": "application/json",
    },
    data: { email, password },
  });
  expect(login.ok(), `Login failed for ${role}: ${login.status()} ${await login.text()}`).toBeTruthy();

  await expect
    .poll(async () => {
      const contextResponse = await page.request.get("/api/auth/context");
      if (!contextResponse.ok()) return false;
      const payload = await contextResponse.json();
      return Boolean(payload?.user?.id);
    })
    .toBe(true);

  return { context, page };
}

async function auditBottomChrome(page: Page, route: string, viewportLabel: string) {
  await gotoStable(page, route);
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.getByText("Please login to continue.")).toHaveCount(0);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(200);

  const audit = await page.evaluate(
    ({ currentRoute, currentViewport }) => {
      const main = document.querySelector("main");
      if (!main) {
        return {
          chrome: [],
          overlaps: [{ tag: "main", label: "Missing main element", top: 0, bottom: 0, left: 0, right: 0 }],
          route: currentRoute,
          viewport: currentViewport,
        };
      }

      const isVisible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) return false;
        const style = window.getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") return false;
        return true;
      };

      const intersects = (
        a: { top: number; bottom: number; left: number; right: number },
        b: { top: number; bottom: number; left: number; right: number },
      ) => !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);

      const fixedChrome = Array.from(document.body.querySelectorAll("*"))
        .filter((element) => {
          if (!isVisible(element)) return false;
          const style = window.getComputedStyle(element);
          if (style.position !== "fixed") return false;
          if (style.pointerEvents === "none") return false;
          const zIndex = Number.parseInt(style.zIndex || "0", 10);
          if (!Number.isFinite(zIndex) || zIndex < 20) return false;
          const rect = element.getBoundingClientRect();
          return rect.bottom > window.innerHeight - 240;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tag: element.tagName.toLowerCase(),
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
          };
        });

      const candidates = Array.from(
        main.querySelectorAll("button, a, input, textarea, select, [role='button'], article, li"),
      )
        .filter((element) => {
          if (!isVisible(element)) return false;
          const style = window.getComputedStyle(element);
          if (style.position === "fixed") return false;
          const rect = element.getBoundingClientRect();
          return rect.bottom > window.innerHeight - 260;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const text = (
            element.getAttribute("aria-label") ||
            element.getAttribute("placeholder") ||
            element.textContent ||
            element.getAttribute("href") ||
            element.tagName
          )
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80);

          return {
            tag: element.tagName.toLowerCase(),
            label: text,
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
          };
        });

      const overlaps = candidates.filter((candidate) =>
        fixedChrome.some((chrome) => intersects(candidate, chrome)),
      );

      return {
        chrome: fixedChrome,
        overlaps,
        route: currentRoute,
        viewport: currentViewport,
      };
    },
    { currentRoute: route, currentViewport: viewportLabel },
  );

  expect(
    audit.overlaps,
    `Fixed chrome overlap on ${audit.route} @ ${audit.viewport}px\n${JSON.stringify(audit as AuditResult, null, 2)}`,
  ).toEqual([]);
}

test.describe("Shell chrome overlap audit", () => {
  test("mobile and tablet shells keep bottom content clear", async ({ browser }) => {
    test.setTimeout(240_000);

    for (const viewport of VIEWPORTS) {
      for (const group of ROUTE_GROUPS) {
        const { context, page } = await createAuthenticatedContext(browser, {
          role: group.role,
          viewport,
        });

        try {
          for (const route of group.routes) {
            await auditBottomChrome(page, route, viewport.label);
          }
        } finally {
          await context.close();
        }
      }
    }
  });
});
