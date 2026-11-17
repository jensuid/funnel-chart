import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useEffect } from "react";
import { EChartsWrapper, getChartInstance } from "../src/funnel-analysis/components/EChartsWrapper";
import { echarts } from "../src/funnel-analysis/charts/echartsSetup";
import { createFunnelOption } from "../src/funnel-analysis/charts/createFunnelOption";
import { computeStageViewModels } from "../src/funnel-analysis/metrics/calculateFunnelMetrics";
import { standardFunnelFixture } from "./fixtures";

afterEach(cleanup);

const stageVms = computeStageViewModels(
  standardFunnelFixture.stages,
  standardFunnelFixture.periods[0]!.stages,
);
const option = createFunnelOption({
  stages: stageVms,
  selectedStageIds: [],
  hoveredStageId: null,
  showDropOffIndicators: false,
});

describe("EChartsWrapper lifecycle", () => {
  it("creates one chart instance on mount", () => {
    const { container } = render(<EChartsWrapper option={option} />);
    const instance = getChartInstance(container.querySelector("div")!);
    expect(instance).not.toBeNull();
  });

  it("reuses the same instance across option updates (never re-inits)", () => {
    const { container, rerender } = render(<EChartsWrapper option={option} />);
    const div = container.querySelector("div")!;
    const first = getChartInstance(div)!;

    const nextOption = createFunnelOption({
      stages: stageVms,
      selectedStageIds: ["cart"],
      hoveredStageId: null,
      showDropOffIndicators: false,
    });
    rerender(<EChartsWrapper option={nextOption} />);
    expect(getChartInstance(div)).toBe(first);
  });

  it("disposes the instance on unmount (no lingering listeners)", () => {
    const { container, unmount } = render(<EChartsWrapper option={option} />);
    const div = container.querySelector("div")!;
    const instance = getChartInstance(div)!;
    const disposeSpy = vi.spyOn(instance, "dispose");
    unmount();
    expect(disposeSpy).toHaveBeenCalledOnce();
    expect(getChartInstance(div)).toBeNull();
  });

  it("applies option updates via setOption with notMerge", () => {
    const { container, rerender } = render(<EChartsWrapper option={option} />);
    const div = container.querySelector("div")!;
    const instance = getChartInstance(div)!;
    const setOptionSpy = vi.spyOn(instance, "setOption");

    const nextOption = createFunnelOption({
      stages: stageVms,
      selectedStageIds: ["views"],
      hoveredStageId: null,
      showDropOffIndicators: false,
    });
    rerender(<EChartsWrapper option={nextOption} />);
    expect(setOptionSpy).toHaveBeenCalled();
    const call = setOptionSpy.mock.calls.at(-1)!;
    expect(call[1]).toMatchObject({ notMerge: true });
  });

  it("forwards ECharts click events to onEvents handlers", () => {
    const onClick = vi.fn();
    const { container } = render(
      <EChartsWrapper option={option} onEvents={{ click: onClick }} />,
    );
    const instance = getChartInstance(container.querySelector("div")!)!;
    // Simulate a chart-internal event (jsdom cannot produce real pointer events on canvas/svg).
    instance.trigger("click", {
      type: "click",
      componentType: "series",
      seriesId: "funnel-stages",
    } as never);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire handlers after unmount", () => {
    const onClick = vi.fn();
    const { container, unmount } = render(
      <EChartsWrapper option={option} onEvents={{ click: onClick }} />,
    );
    const instance = getChartInstance(container.querySelector("div")!)!;
    unmount();
    expect(() => instance.trigger("click", {} as never)).not.toThrow();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("exposes an accessible label on the container", () => {
    const { container } = render(
      <EChartsWrapper option={option} ariaLabel="Funnel overview chart" />,
    );
    const div = container.querySelector("div")!;
    expect(div.getAttribute("role")).toBe("img");
    expect(div.getAttribute("aria-label")).toBe("Funnel overview chart");
  });
});

describe("echartsSetup", () => {
  it("registers funnel and line charts", () => {
    // getInstanceByDom returning a working instance proves registration.
    const div = document.createElement("div");
    document.body.appendChild(div);
    const instance = echarts.init(div, undefined, { renderer: "svg" });
    expect(() =>
      instance.setOption({ series: [{ type: "funnel", data: [] }] }),
    ).not.toThrow();
    expect(() =>
      instance.setOption(
        {
          xAxis: { type: "category", data: [] },
          yAxis: { type: "value" },
          series: [{ type: "line", data: [] }],
        },
        { notMerge: true },
      ),
    ).not.toThrow();
    instance.dispose();
    div.remove();
  });
});
