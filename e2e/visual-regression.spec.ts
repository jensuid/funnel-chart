import { test, expect } from "@playwright/test";

/**
 * WP-08 — 10 visual regression scenarios against the dev server
 * (`pnpm dev`). Golden snapshots are created with
 * `pnpm exec playwright test --update-snapshots`.
 *
 * The demo page mounts <FunnelAnalysis> with each fixture; scenario ids
 * match docs/TEST-SPEC.md §visual-regression.
 */

const SCENARIOS: { id: string; url: string; hover?: boolean }[] = [
  { id: "01-success-default", url: "/?fixture=standard" },
  { id: "02-stage-selected", url: "/?fixture=standard&select=cart" },
  { id: "03-transition-selected", url: "/?fixture=standard&select=visitors->views" },
  { id: "04-legend-filtered", url: "/?fixture=standard&legend=off:cart->checkout" },
  { id: "05-hover-tooltip", url: "/?fixture=standard", hover: true },
  { id: "06-date-range-filtered", url: "/?fixture=standard&from=2026-01-05" },
  { id: "07-partial-data", url: "/?fixture=incomplete" },
  { id: "08-zero-volume", url: "/?fixture=zero" },
  { id: "09-invalid-data", url: "/?fixture=invalid" },
  { id: "10-dark-compact", url: "/?fixture=standard&theme=dark&layout=compact" },
];

for (const { id, url, hover } of SCENARIOS) {
  test(`visual: ${id}`, async ({ page }) => {
    await page.goto(url);
    await expect(page.getByTestId("funnel-analysis")).toBeVisible();
    // Let entrance animations settle before snapshotting (durationMs 800
    // + ECharts label layout pass; 1200ms proved flaky on slower runs).
    await page.waitForTimeout(2500);
    if (hover) {
      // Real pointer hover over the funnel chart area → tooltip.
      await page
        .getByRole("img", { name: /Funnel overview chart/ })
        .hover({ position: { x: 200, y: 200 } });
      await page.waitForTimeout(400);
    }
    await expect(page).toHaveScreenshot(`${id}.png`, { fullPage: true });
  });
}
