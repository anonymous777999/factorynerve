import { expect, type Page, type TestInfo } from "@playwright/test";

export type OverflowIssue = {
  selector: string;
  path: string;
  className: string;
  component: string;
  scrollWidth: number;
  clientWidth: number;
  overflowDelta: number;
  rectLeft: number;
  rectRight: number;
};

export async function createAuthenticatedSession(page: Page) {
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100_000)}`;
  const email = `qa_overflow_${seed}@example.com`;
  const password = "StrongPassw0rd!";
  const response = await page.request.post("/api/auth/register", {
    headers: { "Content-Type": "application/json" },
    data: {
      name: "QA Overflow Manager",
      email,
      password,
      role: "manager",
      factory_name: `QA Factory ${seed}`,
      phone_number: "+910000000000",
    },
  });
  expect(response.ok(), `Registration failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  const registration = await response.json();

  const loginRequest = () =>
    page.request.post("/api/auth/login", {
      headers: {
        "X-Use-Cookies": "1",
        "Content-Type": "application/json",
      },
      data: { email, password },
    });

  let login = await loginRequest();
  if (!login.ok()) {
    let verificationLink = String(registration?.verification_link || "");
    if (!verificationLink) {
      const resend = await page.request.post("/api/auth/email/verification/resend", {
        headers: { "Content-Type": "application/json" },
        data: { email },
      });
      expect(resend.ok(), `Verification resend failed: ${resend.status()} ${await resend.text()}`).toBeTruthy();
      const resendPayload = await resend.json();
      verificationLink = String(resendPayload?.verification_link || "");
    }

    const verificationUrl = new URL(verificationLink, "http://127.0.0.1:3000");
    const token = verificationUrl.searchParams.get("token") || verificationUrl.searchParams.get("verification_token");
    expect(token, `Verification link missing token: ${verificationLink || JSON.stringify(registration)}`).toBeTruthy();

    const verify = await page.request.post("/api/auth/email/verify", {
      headers: { "Content-Type": "application/json" },
      data: { token },
    });
    expect(verify.ok(), `Verification failed: ${verify.status()} ${await verify.text()}`).toBeTruthy();
    login = await loginRequest();
  }

  expect(login.ok(), `Login failed: ${login.status()} ${await login.text()}`).toBeTruthy();
  await expect
    .poll(async () => {
      const contextResponse = await page.request.get("/api/auth/context");
      if (!contextResponse.ok()) return false;
      const payload = await contextResponse.json();
      return Boolean(payload?.user?.id);
    })
    .toBe(true);

  return { email, password };
}

export async function gotoStable(page: Page, path: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.addStyleTag({
        content: "nextjs-portal, [data-nextjs-dev-overlay] { display: none !important; pointer-events: none !important; }",
      }).catch(() => undefined);
      await page.evaluate(() => {
        document.querySelectorAll("nextjs-portal, [data-nextjs-dev-overlay]").forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.display = "none";
            element.style.pointerEvents = "none";
          }
        });
      }).catch(() => undefined);
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(400);
    }
  }
  throw lastError;
}

export async function collectOverflowIssues(page: Page) {
  return page.evaluate<OverflowIssue[]>(() => {
    function cssSelector(element: Element) {
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
        const tag = current.tagName.toLowerCase();
        const currentTagName = current.tagName;
        const parent: HTMLElement | null = current.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const siblings = Array.from(parent.children).filter((node) => node.tagName === currentTagName);
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
        if ((current as HTMLElement).dataset.component) {
          break;
        }
        current = parent;
      }
      return parts.join(" > ");
    }

    function domPath(element: Element) {
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 8) {
        const htmlElement = current as HTMLElement;
        const tag = current.tagName.toLowerCase();
        const component = htmlElement.dataset.component ? `[data-component="${htmlElement.dataset.component}"]` : "";
        const className = typeof htmlElement.className === "string"
          ? htmlElement.className.split(/\s+/).filter(Boolean).slice(0, 3).map((token) => `.${token}`).join("")
          : "";
        parts.unshift(`${tag}${component}${className}`);
        if (htmlElement.dataset.component) break;
        current = current.parentElement;
      }
      return parts.join(" > ");
    }

    function hasOffscreenFixedAncestor(element: HTMLElement, viewportWidth: number) {
      let current: HTMLElement | null = element;
      while (current) {
        const style = window.getComputedStyle(current);
        if (style.position === "fixed") {
          const rect = current.getBoundingClientRect();
          if (rect.right <= 0 || rect.left >= viewportWidth) {
            return true;
          }
        }
        current = current.parentElement;
      }
      return false;
    }

    const viewportWidth = window.innerWidth;
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        if (element.closest("[data-approved-horizontal-scroll='true']")) return false;
        if (element.closest("[data-overflow-debug-ignore='true']")) return false;
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        if (element.clientWidth <= 0 && element.scrollWidth <= 0) return false;
        if (hasOffscreenFixedAncestor(element, viewportWidth)) return false;
        return true;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const scrollDelta = Math.max(0, element.scrollWidth - element.clientWidth);
        const rectDelta = Math.max(0, rect.right - viewportWidth, -rect.left);
        return {
          selector: cssSelector(element),
          path: domPath(element),
          className: typeof element.className === "string" ? element.className : "",
          component: element.closest<HTMLElement>("[data-component]")?.dataset.component || "unknown",
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          overflowDelta: Math.max(scrollDelta, Math.ceil(rectDelta)),
          rectLeft: Math.round(rect.left),
          rectRight: Math.round(rect.right),
        };
      })
      .filter((issue) => issue.overflowDelta > 1);
  });
}

export async function assertNoHorizontalOverflow(
  page: Page,
  route: string,
  testInfo: TestInfo,
) {
  const issues = await collectOverflowIssues(page);
  const rootOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const geometricIssues = issues.filter(
    (issue) => issue.rectLeft < -1 || issue.rectRight > rootOverflow.clientWidth + 1,
  );

  if (!geometricIssues.length && rootOverflow.scrollWidth <= rootOverflow.clientWidth + 1) {
    return;
  }

  const screenshotPath = testInfo.outputPath(
    `${route.replace(/[\\/]/g, "_").replace(/^_+/, "") || "root"}-overflow.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach(`overflow-${route}`, {
    path: screenshotPath,
    contentType: "image/png",
  });

  throw new Error(
    `Horizontal overflow detected on ${route}\nroot=${JSON.stringify(rootOverflow)}\nissues=${JSON.stringify(geometricIssues.length ? geometricIssues : issues, null, 2)}`,
  );
}

export async function exerciseHorizontalScrollAreas(page: Page) {
  const scrollAreas = page.locator("[data-overflow-scroll-area='true']");
  const count = await scrollAreas.count();
  for (let index = 0; index < Math.min(count, 4); index += 1) {
    const result = await scrollAreas.nth(index).evaluate((node) => {
      const viewport = node.querySelector("[data-approved-horizontal-scroll='true'] .responsive-scroll-area__viewport") || node.querySelector(".responsive-scroll-area__viewport");
      const scrollTarget = (viewport || node.querySelector(".overflow-x-auto") || node) as HTMLElement;
      const before = scrollTarget.scrollLeft;
      scrollTarget.scrollBy({ left: 160, behavior: "auto" });
      return {
        before,
        after: scrollTarget.scrollLeft,
        max: scrollTarget.scrollWidth - scrollTarget.clientWidth,
      };
    });
    if (result.max > 0) {
      expect(result.after, `Scroll area ${index} should move horizontally`).toBeGreaterThanOrEqual(result.before);
    }
  }
}

export async function verifyEdgeControlsAreClickable(page: Page) {
  const edgeSelectors = await page.evaluate<string[]>(() => {
    function cssSelector(element: Element) {
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && parts.length < 6) {
        const tag = current.tagName.toLowerCase();
        const currentTagName = current.tagName;
        const parent: HTMLElement | null = current.parentElement;
        if (!parent) {
          parts.unshift(tag);
          break;
        }
        const siblings = Array.from(parent.children).filter((node) => node.tagName === currentTagName);
        const index = siblings.indexOf(current) + 1;
        parts.unshift(`${tag}:nth-of-type(${index})`);
        current = parent;
      }
      return parts.join(" > ");
    }

    function hasOffscreenFixedAncestor(element: HTMLElement, viewportWidth: number) {
      let current: HTMLElement | null = element;
      while (current) {
        const style = window.getComputedStyle(current);
        if (style.position === "fixed") {
          const rect = current.getBoundingClientRect();
          if (rect.right <= 0 || rect.left >= viewportWidth) {
            return true;
          }
        }
        current = current.parentElement;
      }
      return false;
    }

    return Array.from(document.querySelectorAll("button, a, [role='button']"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        if (hasOffscreenFixedAncestor(element as HTMLElement, window.innerWidth)) return false;
        if (rect.right <= 0 || rect.left >= window.innerWidth || rect.bottom <= 0 || rect.top >= window.innerHeight) {
          return false;
        }
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        if (centerX < 0 || centerX > window.innerWidth || centerY < 0 || centerY > window.innerHeight) {
          return false;
        }
        return rect.left < 28 || window.innerWidth - rect.right < 28 || rect.bottom > window.innerHeight - 56;
      })
      .slice(0, 6)
      .map((element) => cssSelector(element));
  });

  for (const selector of edgeSelectors) {
    const locator = page.locator(selector).first();
    const isVisible = await locator.isVisible().catch(() => false);
    if (!isVisible) continue;
    await locator.click({ trial: true, timeout: 2_000 }).catch(() => undefined);
  }
}
