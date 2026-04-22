import { test } from "@playwright/test";

import {
  assertNoHorizontalOverflow,
  createAuthenticatedSession,
  exerciseHorizontalScrollAreas,
  gotoStable,
  verifyEdgeControlsAreClickable,
} from "./overflow-helpers";

const CORE_ROUTES = [
  "/dashboard",
  "/work-queue",
  "/attendance",
  "/tasks",
  "/entry",
  "/ocr/scan",
  "/steel",
  "/steel/charts",
  "/steel/invoices",
  "/steel/dispatches",
  "/attendance/reports",
  "/reports",
  "/analytics",
  "/premium/dashboard",
  "/plans",
  "/billing",
  "/profile",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

test.describe("mobile overflow hardening", () => {
  test("core routes stay within viewport and keep edge actions usable", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await createAuthenticatedSession(page);

    for (const route of CORE_ROUTES) {
      await gotoStable(page, route);
      await exerciseHorizontalScrollAreas(page);
      await verifyEdgeControlsAreClickable(page);
      await assertNoHorizontalOverflow(page, route, testInfo);
    }
  });
});
