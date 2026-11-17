import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FunnelAnalysis } from "../src/funnel-analysis/components/FunnelAnalysis";
import { largeFixture } from "./fixtures";

/**
 * WP-08 performance checks — the `large-funnel` fixture (12 stages,
 * 104 periods) must render without blowing the time budget and without
 * NaN/Infinity leaking into the DOM. Memoized pipeline (validation,
 * normalize, aggregate, view model, options) keeps re-renders cheap.
 */
describe("FunnelAnalysis — performance (large fixture)", () => {
  it("renders the 12-stage funnel within the time budget", () => {
    const start = performance.now();
    const { container } = render(<FunnelAnalysis data={largeFixture} />);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(10_000); // generous CI-safe budget
    expect(screen.getByLabelText("Funnel overview")).toBeTruthy();
    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).not.toContain("Infinity");
  });

  it("data table renders all 12 stages with computed metrics", () => {
    const { container } = render(
      <FunnelAnalysis data={largeFixture} config={{ showDataTable: true }} />,
    );
    const table = screen.getByRole("table", { name: "Funnel data table" });
    const rows = table.querySelectorAll("tbody tr");
    expect(rows.length).toBe(12);
    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).not.toContain("Infinity");
  });

  it("trend covers all 104 periods", () => {
    // Sanity: aggregation over 104 weekly periods produces a full trend.
    render(<FunnelAnalysis data={largeFixture} />);
    const summary = screen.getByLabelText("Trend summary");
    expect(summary.textContent).toContain("104");
  });
});
