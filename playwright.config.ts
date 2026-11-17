import { defineConfig } from "@playwright/test";

/**
 * WP-08 visual regression — Playwright is an optional dev dependency
 * (`pnpm add -D @playwright/test && pnpm exec playwright install chromium`).
 * These tests are NOT part of `pnpm test` (vitest); run via
 * `pnpm exec playwright test`.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    // Playwright ≥1.53 has no chromium build for macOS 13; use system Chrome.
    channel: "chrome",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
});
