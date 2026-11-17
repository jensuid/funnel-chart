import * as echarts from "echarts/core";
import { FunnelChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";

/**
 * Tree-shaken ECharts registration. SVG renderer: works in jsdom for tests,
 * crisp on all DPIs, and keeps chart output inspectable for a11y tooling.
 */
echarts.use([
  FunnelChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  SVGRenderer,
]);

export { echarts };
export type EChartsInstance = echarts.ECharts;
export type EChartsCoreOption = echarts.EChartsCoreOption;
