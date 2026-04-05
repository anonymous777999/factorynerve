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
