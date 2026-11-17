import type { FunnelStageViewModel } from "../types/funnelAnalysis.types";
import type { FunnelChartConfig, FunnelAnalysisTheme } from "../types/api.types";
import type { EChartsCoreOption } from "./echartsSetup";
import { resolveTheme, stageColor, accessibleStroke, resolveStagePalette, barGradient, readableTextColor } from "./chartTheme";
import { buildTransitionLabelSeries } from "./dropOffIndicators";

/**
 * Funnel option factory — pure function from view model + state to ECharts option.
 * No business logic lives here (spec §6: factory functions, not inline config).
 *
 * D3: labels are rendered from the VIEW MODEL (name + count + cumulative %),
 * not from ECharts '{b}\n{c}' templates.
 */

export interface FunnelStageDatum {
  id: string;
  name: string;
  value: number;
  cumulativeConversion: number | null;
  stageToStageConversion: number | null;
  dropOff: number | null;
  selected: boolean;
  /** Precomputed label text (tiered content in auto mode). */
  labelText?: string;
  /** Per-datum label overrides (auto placement / contrast-aware color). */
  label?: Record<string, unknown>;
  itemStyle: {
    color: string | Record<string, unknown>;
    borderColor?: string;
    borderWidth?: number;
  };
}

export interface CreateFunnelOptionInput {
  stages: FunnelStageViewModel[];
  /** Stages to emphasize: selected stage, or both stages of a selected transition. */
  selectedStageIds: string[];
  hoveredStageId: string | null;
  theme?: FunnelAnalysisTheme;
  /** Effective stage palette resolved by the composite (ramp/override aware). */
  stagePalette?: string[];
  config?: FunnelChartConfig;
  showCumulativeConversion?: boolean;
  showValues?: boolean;
  /** Render the outside transition-metrics series (D3). */
  showDropOffIndicators?: boolean;
  animation?: boolean;
  animationDurationMs?: number;
}

export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${value.toFixed(1)}%`;
}

export function createFunnelOption(
  input: CreateFunnelOptionInput,
): EChartsCoreOption {
  const {
    stages,
    selectedStageIds,
    hoveredStageId,
    theme,
    config,
    showCumulativeConversion = true,
    showValues = true,
    showDropOffIndicators = true,
    animation = true,
    animationDurationMs = 300,
  } = input;

  const tokens = resolveTheme(theme);
  const gap = config?.gap ?? 5;
  const sort = config?.sort ?? "descending";
  const orient = config?.orientation ?? "vertical";
  // Single source of truth for stage colors (ramp / custom palette / default).
  const palette = resolveStagePalette(stages.length, theme, config);

  const data: FunnelStageDatum[] = stages.map((vm, index) => {
    const color = stageColor(index, theme, palette);
    const isSelected = selectedStageIds.includes(vm.stage.id);
    const isHovered = hoveredStageId === vm.stage.id;
    return {
      id: vm.stage.id,
      name: vm.stage.label,
      value: vm.count,
      cumulativeConversion: vm.cumulativeConversion,
      stageToStageConversion: vm.stageToStageConversion,
      dropOff: vm.dropOff,
      selected: isSelected,
      itemStyle: {
        color: config?.fillGradient ? barGradient(color, orient) : color,
        // WCAG 1.4.11: stroke meets 3:1 against the light background.
        borderColor: accessibleStroke(index, theme, "#FFFFFF", palette),
        borderWidth: 1,
        ...(isSelected || isHovered
          ? {
              borderColor: tokens.textColor,
              borderWidth: 2,
            }
          : {}),
      },
    };
  });

  // --- label placement (auto strategy) -------------------------------------
  // "auto": bars narrower than `labelOutsideThreshold`% of the widest bar
  // get their label moved OUTSIDE (readable on the background); the rest
  // keep the configured inside position. "fixed" always uses labelPosition.
  const labelStrategy = config?.labelStrategy ?? "auto";
  // Adaptive default: dense funnels need more labels outside. Explicit
  // config always wins. ~2% per stage, clamped to [15, 40].
  const outsideThreshold =
    config?.labelOutsideThreshold ??
    Math.min(40, Math.max(15, stages.length * 2));
  const configuredPosition = config?.labelPosition ?? "inside";
  const maxValue = Math.max(...stages.map((s) => s.count), 1);
  /** Stage ids whose label lives OUTSIDE — overlay labels blanked there. */
  const outsideStageIds = new Set<string>();

  for (let index = 0; index < data.length; index++) {
    const vm = stages[index]!;
    const relativeWidth = (vm.count / maxValue) * 100;
    const narrow = relativeWidth < outsideThreshold;
    const position =
      labelStrategy === "auto" && narrow ? "outside" : configuredPosition;
    if (position === "outside") outsideStageIds.add(vm.stage.id);
    // Tiered content: narrow bars drop the count line first (it is visually
    // redundant with bar width) to reduce crowding in dense funnels.
    const compact =
      labelStrategy === "auto" && relativeWidth < (config?.compactLabelThreshold ?? 25);
    const lines = [vm.stage.label];
    if (showValues && !compact) lines.push(formatCount(vm.count));
    if (showCumulativeConversion) lines.push(formatPercent(vm.cumulativeConversion));
    (data[index]!.label as Record<string, unknown>) = {
      position,
      // Outside → text color (visible on the background). Inside →
      // contrast-aware white/dark against the bar's own fill.
      color:
        position === "outside"
          ? tokens.textColor
          : readableTextColor(
              typeof data[index]!.itemStyle.color === "string"
                ? (data[index]!.itemStyle.color as string)
                : stageColor(index, theme, palette),
            ),
    };
    data[index]!.labelText = lines.join("\n");
  }

  const series: Record<string, unknown>[] = [
    {
      type: "funnel",
      id: "funnel-stages",
      sort,
      orient,
      minSize: `${config?.minSize ?? 0}%`,
      maxSize: `${config?.maxSize ?? 100}%`,
      gap,
      // Funnel width represents VOLUME (spec §2) — never conversion rates.
      data,
      label: {
        show: true,
        position: configuredPosition,
        // Outside → text color (visible on the background); inside → white
        // on colored fills (per-datum overrides refine this in auto mode).
        color: configuredPosition === "outside" ? tokens.textColor : "#FFFFFF",
        fontFamily: tokens.fontFamily,
        fontSize: 12,
        lineHeight: 16,
        formatter: (params: { data?: unknown }) =>
          (params.data as FunnelStageDatum | undefined)?.labelText ?? "",
      },
      // Native overlap handling — essential for dense funnels (many stages).
      labelLayout: { hideOverlap: true },
      emphasis: {
        label: { show: true, fontWeight: "bold" as const },
        itemStyle: { opacity: 0.85 },
      },
      itemStyle: {
        borderRadius: Math.min(tokens.borderRadius, 6),
      },
      animation,
      animationDuration: animationDurationMs,
    },
  ];

  if (showDropOffIndicators) {
    series.push(
      buildTransitionLabelSeries({
        stages,
        tokens,
        fontFamily: tokens.fontFamily,
        sort,
        orient,
        minSize: config?.minSize ?? 0,
        maxSize: config?.maxSize ?? 100,
        gap,
        /** Blank overlay labels where the stage label moved outside. */
        hiddenStageIds: outsideStageIds,
        /** Crowding guard: hide overlay labels on dense funnels. */
        maxLabeledStages: config?.dropOffLabelMaxStages ?? 8,
      }),
    );
  }

  return {
    animation,
    animationDuration: animationDurationMs,
    tooltip: {
      trigger: "item",
      formatter: (params: { data?: unknown }) => {
        const d = params.data as FunnelStageDatum | undefined;
        if (!d || d.id === undefined) return "";
        const lines = [
          `<strong>${d.name}</strong>`,
          `${formatCount(d.value)}`,
        ];
        if (showCumulativeConversion) {
          lines.push(`Cumulative: ${formatPercent(d.cumulativeConversion)}`);
        }
        if (d.stageToStageConversion !== null) {
          lines.push(`Stage conversion: ${formatPercent(d.stageToStageConversion)}`);
          lines.push(`Drop-off: ${formatPercent(d.dropOff)}`);
        }
        return lines.join("<br/>");
      },
    },
    series,
  };
}
