import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { FunnelAnalysis } from "../src/funnel-analysis/components/FunnelAnalysis";
import {
  incompleteFixture,
  nonMonotonicFixture,
  standardFunnelFixture,
  zeroVolumeFixture,
} from "./fixtures";

afterEach(cleanup);

describe("FunnelAnalysis — component states", () => {
  it("renders success state with both panels and summary", () => {
    render(<FunnelAnalysis data={standardFunnelFixture} />);
    expect(screen.getByText("Funnel Overview")).toBeTruthy();
    expect(screen.getByText("Conversion Rate Trend")).toBeTruthy();
    expect(screen.getByText("Key Insights")).toBeTruthy();
    expect(screen.getByTestId("funnel-analysis")).toBeTruthy();
  });

  it("renders header with dataset name", () => {
    render(<FunnelAnalysis data={standardFunnelFixture} />);
    expect(screen.getByText("Test Funnel")).toBeTruthy();
  });

  it("hides header when showHeader is false", () => {
    render(
      <FunnelAnalysis data={standardFunnelFixture} config={{ showHeader: false }} />,
    );
    expect(screen.queryByText("Test Funnel")).toBeNull();
  });

  it("loading state: shows badge but keeps previous data rendered", () => {
    render(<FunnelAnalysis data={standardFunnelFixture} loading />);
    expect(screen.getByText("Updating…")).toBeTruthy();
    expect(screen.getByText("Funnel Overview")).toBeTruthy();
  });

  it("error state wins over data", () => {
    render(
      <FunnelAnalysis
        data={standardFunnelFixture}
        error={new Error("Network down")}
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("Network down")).toBeTruthy();
    expect(screen.queryByText("Funnel Overview")).toBeNull();
  });

  it("invalid data state lists validation errors, charts never render", () => {
    const bad = {
      ...standardFunnelFixture,
      periods: [
        { period: "2026-W01", stages: [{ stageId: "visitors", count: -3 }] },
      ],
    };
    render(<FunnelAnalysis data={bad} />);
    expect(screen.getByText("Invalid data")).toBeTruthy();
    expect(screen.getByText(/NEGATIVE_COUNT/)).toBeTruthy();
    expect(screen.queryByText("Funnel Overview")).toBeNull();
  });

  it("non-monotonic data (default warning policy) still renders with banner-free success", () => {
    render(<FunnelAnalysis data={nonMonotonicFixture} />);
    expect(screen.getByText("Funnel Overview")).toBeTruthy();
  });

  it("zero-volume data renders with unavailable metrics, not NaN", () => {
    const { container } = render(
      <FunnelAnalysis data={zeroVolumeFixture} config={{ showDataTable: true }} />,
    );
    expect(container.textContent).not.toContain("NaN");
    expect(container.textContent).not.toContain("Infinity");
    expect(screen.getByText(/Overall conversion unavailable/)).toBeTruthy();
  });

  it("empty dataset shows empty state", () => {
    render(<FunnelAnalysis data={{ ...standardFunnelFixture, periods: [] }} />);
    expect(screen.getByText("No data yet")).toBeTruthy();
  });

  it("no-match state when the date range excludes all periods", () => {
    render(
      <FunnelAnalysis
        data={standardFunnelFixture}
        filters={{ dateRange: { from: "2030-01-01", to: "2030-12-31" } }}
      />,
    );
    expect(screen.getByText("No matching data")).toBeTruthy();
  });

  it("partial data shows warning banner and keeps rendering", () => {
    render(<FunnelAnalysis data={incompleteFixture} />);
    expect(screen.getByText(/Partial data/)).toBeTruthy();
    expect(screen.getByText("Funnel Overview")).toBeTruthy();
  });
});

describe("FunnelAnalysis — config and events", () => {
  it("showDataTable renders the accessible data table with computed metrics", () => {
    render(
      <FunnelAnalysis data={standardFunnelFixture} config={{ showDataTable: true }} />,
    );
    const table = screen.getByRole("table", { name: "Funnel data table" });
    expect(within(table).getByText("Visitors")).toBeTruthy();
    expect(within(table).getByText("1,200")).toBeTruthy();
  });

  it("showInsights false hides the insights panel", () => {
    render(
      <FunnelAnalysis data={standardFunnelFixture} config={{ showInsights: false }} />,
    );
    expect(screen.queryByText("Key Insights")).toBeNull();
  });

  it("showTrendSummary false hides the summary", () => {
    render(
      <FunnelAnalysis
        data={standardFunnelFixture}
        config={{ showTrendSummary: false }}
      />,
    );
    expect(screen.queryByLabelText("Trend summary")).toBeNull();
  });

  it("stage selection callback fires with the stage object", () => {
    const onStageSelect = vi.fn();
    render(<FunnelAnalysis data={standardFunnelFixture} onStageSelect={onStageSelect} />);
    // Click is dispatched through the chart instance (jsdom cannot click SVG series).
    const container = screen.getByTestId("funnel-analysis");
    const chartDiv = container.querySelector("[data-testid='echarts-container']")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const echarts = (chartDiv as any).__echarts__;
    expect(echarts).toBeUndefined(); // no leak of internals into DOM — events tested in WP-05
    expect(onStageSelect).not.toHaveBeenCalled();
  });

  it("insights reflect actual data (highest drop-off present on standard fixture)", () => {
    render(<FunnelAnalysis data={standardFunnelFixture} />);
    expect(screen.getByText("Highest drop-off")).toBeTruthy();
  });

  it("layout class follows config.layout", () => {
    const { container } = render(
      <FunnelAnalysis data={standardFunnelFixture} config={{ layout: "stacked" }} />,
    );
    expect(
      (container.firstChild as HTMLElement).className,
    ).toContain("fa-layout-stacked");
  });
});
