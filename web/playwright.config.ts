import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-320",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 320, height: 568 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "mobile-360",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "android-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      command: "python run.py",
      cwd: "..",
      url: "http://127.0.0.1:8765/health",
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...process.env,
        FASTAPI_HOST: "127.0.0.1",
        FASTAPI_PORT: "8765",
        DPR_NO_RELOAD: "1",
        EMAIL_VERIFICATION_EXPOSE_LINK: "1",
        PASSWORD_RESET_EXPOSE_LINK: "1",
      },
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: "http://127.0.0.1:3000/login",
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_HOST: "127.0.0.1",
        NEXT_PUBLIC_API_PORT: "8765",
      },
    },
  ],
});
