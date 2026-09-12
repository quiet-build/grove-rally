import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testIgnore: "*component.spec.ts", outputDir: "test-results/standalone", timeout: 45000, workers: 1,
  use: { launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }, baseURL: "http://127.0.0.1:5188", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: { command: "pnpm dev --port 5188 --strictPort", url: "http://127.0.0.1:5188", reuseExistingServer: false },
});
