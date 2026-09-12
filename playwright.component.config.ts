import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests", testMatch: ["component.spec.ts", "controls.component.spec.ts"], outputDir: "test-results/component", workers: 1, timeout: 90000,
  expect: { timeout: 15000 },
  use: { baseURL: "http://127.0.0.1:5304", viewport: { width: 1280, height: 1000 },
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"], channel: "chromium", executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }, trace: "retain-on-failure" },
  webServer: [
    { command: "pnpm exec vite preview --host 127.0.0.1 --port 5303 --strictPort", url: "http://127.0.0.1:5303" },
    { command: "node tests/component-host.mjs", url: "http://127.0.0.1:5304" },
  ],
});
