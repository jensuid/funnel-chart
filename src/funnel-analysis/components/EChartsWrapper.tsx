import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { EChartsCoreOption, EChartsInstance } from "../charts/echartsSetup";
import { echarts } from "../charts/echartsSetup";

/**
 * Controlled ECharts wrapper.
 *
 * Contract (spec §7 Performance):
 * - One chart instance per mount; `setOption` on updates, never re-init.
 * - Event listeners attached ONCE at mount; handlers read through a ref so
 *   they always call the latest callbacks without re-subscribing.
 * - ResizeObserver drives chart resize.
 * - Full cleanup on unmount (dispose → no lingering listeners).
 */

export type EChartsEventName =
  | "click"
  | "mouseover"
  | "mouseout"
  | "legendselectchanged"
  | "datazoom";

export interface EChartsWrapperProps {
  option: EChartsCoreOption;
  /** Event name → handler. Handlers may change every render; safe. */
  onEvents?: Partial<Record<EChartsEventName, (params: unknown) => void>>;
  /**
   * Replace the whole option on every update (default true). Our options are
   * always generated in full from state, so merge would only risk staleness.
   */
  notMerge?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible description of the chart for screen readers. */
  ariaLabel?: string;
  /** Rendered inside the container as an accessible fallback. */
  role?: "img" | "application";
}

const ALL_EVENTS: EChartsEventName[] = [
  "click",
  "mouseover",
  "mouseout",
  "legendselectchanged",
  "datazoom",
];

export function EChartsWrapper({
  option,
  onEvents,
  notMerge = true,
  className,
  style,
  ariaLabel,
  role = "img",
}: EChartsWrapperProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);
  const handlersRef = useRef(onEvents);
  handlersRef.current = onEvents;

  // Mount: create instance once, subscribe once, observe resize.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = echarts.init(container, undefined, { renderer: "svg" });
    chartRef.current = chart;

    const dispatch =
      (chart: EChartsInstance, eventName: EChartsEventName) =>
      (...args: unknown[]) => {
        // echarts dispose() does not synchronously detach handlers — guard here
        // so no application handler ever fires after unmount (spec: no stale listeners).
        if (chart.isDisposed()) return;
        handlersRef.current?.[eventName]?.(args[0]);
      };
    // echarts handlers live on the instance and are removed by dispose().
    for (const name of ALL_EVENTS) chart.on(name, dispatch(chart, name));

    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => chart.resize());
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Update: setOption only — never re-init.
  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge });
  }, [option, notMerge]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", ...style }}
      role={role}
      aria-label={ariaLabel}
      data-testid="echarts-container"
    />
  );
}

/** Test/advanced hook: access the live chart instance. */
export function getChartInstance(
  container: HTMLElement | null,
): EChartsInstance | null {
  if (!container) return null;
  return (echarts.getInstanceByDom(container) as EChartsInstance | undefined) ?? null;
}
