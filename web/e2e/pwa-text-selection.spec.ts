import { expect, test } from "@playwright/test";

import { createAuthenticatedSession, gotoStable } from "./overflow-helpers";

test.describe("mobile PWA text selection behavior", () => {
  test("reduces accidental selection on UI chrome while keeping data copyable", async ({ page }) => {
    test.setTimeout(120_000);
    const session = await createAuthenticatedSession(page);

    await gotoStable(page, "/settings");

    const usersTab = page.getByRole("button", { name: "Users" });
    await expect(usersTab).toBeVisible();
    await usersTab.click();

    const inviteHeading = page.getByText("Invite User").first();
    const emailValue = page.getByText(session.email, { exact: true }).first();
    const emailInput = page.locator('input[type="email"]').first();

    await expect(inviteHeading).toBeVisible();
    await expect(emailValue).toBeVisible();
    await expect(emailInput).toBeVisible();

    const usersTabSelect = await usersTab.evaluate((element) => window.getComputedStyle(element).userSelect);
    const inviteHeadingSelect = await inviteHeading.evaluate((element) => window.getComputedStyle(element).userSelect);
    const emailValueSelect = await emailValue.evaluate((element) => window.getComputedStyle(element).userSelect);
    const emailInputSelect = await emailInput.evaluate((element) => window.getComputedStyle(element).userSelect);

    expect(usersTabSelect).toBe("none");
    expect(inviteHeadingSelect).toBe("none");
    expect(emailValueSelect).toBe("text");
    expect(emailInputSelect).not.toBe("none");
  });
});
