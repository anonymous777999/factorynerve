import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const BASE_URL = process.env.SCREENSHOT_BASE_URL || "http://127.0.0.1:3000";
const PASSWORD = process.env.SCREENSHOT_PASSWORD || "StrongPassw0rd!";
const TIMESTAMP = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const OUTPUT_DIR = path.resolve(process.cwd(), "..", "docs", "tab-screenshots", TIMESTAMP);

const routePlan = [
  { role: "operator", path: "/dashboard", label: "dashboard-operator" },
  { role: "operator", path: "/work-queue", label: "work-queue" },
  { role: "operator", path: "/attendance", label: "attendance" },
  { role: "operator", path: "/tasks", label: "tasks" },
  { role: "operator", path: "/entry", label: "shift-entry" },
  { role: "operator", path: "/ocr/scan", label: "document-desk" },

  { role: "manager", path: "/steel", label: "steel-operations" },
  { role: "manager", path: "/steel/charts", label: "steel-charts-manager" },
  { role: "manager", path: "/steel/dispatches", label: "dispatch" },
  { role: "manager", path: "/analytics", label: "analytics" },

  { role: "supervisor", path: "/attendance/review", label: "attendance-review" },
  { role: "supervisor", path: "/approvals", label: "review-queue" },
  { role: "supervisor", path: "/ocr/verify", label: "review-documents" },
  { role: "supervisor", path: "/steel/reconciliations", label: "stock-review" },

  { role: "accountant", path: "/attendance/reports", label: "attendance-reports" },
  { role: "accountant", path: "/reports", label: "reports-exports" },
  { role: "accountant", path: "/steel/customers", label: "customers" },
  { role: "accountant", path: "/steel/invoices", label: "sales-invoices" },

  { role: "owner", path: "/premium/dashboard", label: "owner-desk" },
  { role: "owner", path: "/control-tower", label: "factory-network" },
  { role: "owner", path: "/email-summary", label: "scheduled-updates" },
  { role: "owner", path: "/ai", label: "ai-insights" },
  { role: "owner", path: "/steel/charts", label: "steel-charts-owner" },

  { role: "admin", path: "/settings/attendance", label: "attendance-admin" },
  { role: "admin", path: "/settings", label: "factory-admin" },
  { role: "admin", path: "/plans", label: "subscription" },
  { role: "admin", path: "/billing", label: "billing" },
  { role: "admin", path: "/profile", label: "profile" },
];

function emailForRole(role) {
  return `screenshots_${role}@example.com`;
}

async function ensureDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function waitForStableUi(page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1400);
}

async function gotoStable(page, url) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1200);
    }
  }
  throw lastError;
}

async function login(page, role) {
  await gotoStable(page, `${BASE_URL}/login`);
  await page.locator('input[type="email"]').first().fill(emailForRole(role));
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1800);
}

async function captureRoute(page, item) {
  await gotoStable(page, `${BASE_URL}${item.path}`);
  await waitForStableUi(page);
  const safeRole = item.role.replace(/[^a-z0-9_-]+/gi, "-");
  const safeLabel = item.label.replace(/[^a-z0-9_-]+/gi, "-");
  const filePath = path.join(OUTPUT_DIR, `${safeRole}__${safeLabel}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return {
    role: item.role,
    path: item.path,
    file: filePath,
  };
}

async function main() {
  await ensureDir();
  const browser = await chromium.launch({ headless: true });
  const manifest = [];

  try {
    for (const role of [...new Set(routePlan.map((item) => item.role))]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1024 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      console.log(`Logging in as ${role}...`);
      await login(page, role);

      for (const item of routePlan.filter((entry) => entry.role === role)) {
        console.log(`Capturing ${item.path} as ${role}...`);
        const result = await captureRoute(page, item);
        manifest.push(result);
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  const manifestPath = path.join(OUTPUT_DIR, "manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Saved ${manifest.length} screenshots to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
