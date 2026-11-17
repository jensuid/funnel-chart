import { useMemo, useState } from "react";
import "../demo/demo.css";
import { FunnelAnalysis } from "../funnel-analysis/components/FunnelAnalysis";
import type {
  FunnelAnalysisConfig,
  FunnelAnalysisSelection,
} from "../funnel-analysis/types/api.types";
import type { Granularity } from "../funnel-analysis/types/funnelAnalysis.types";
import {
  standardFunnelFixture,
  highDropoffFixture,
  zeroVolumeFixture,
  nonMonotonicFixture,
  incompleteFixture,
  largeFixture,
} from "../../tests/fixtures";
import { Section, Toggle, Num, Choice, Text, Row } from "./controls";
import { resolveStagePalette } from "../funnel-analysis/charts/chartTheme";

/**
 * Interactive playground — every supported FunnelAnalysisConfig option,
 * dataset switcher, filters and controlled selection.
 *
 * Initial state can be seeded from the URL (used by e2e visual regression):
 *   ?fixture=standard&select=cart&legend=off:cart->checkout&from=...&theme=dark&layout=compact
 */

const invalidFixture = {
  ...standardFunnelFixture,
  periods: [
    { period: "2026-W01", stages: [{ stageId: "visitors", count: -3 }] },
  ],
};

const FIXTURES: Record<string, typeof standardFunnelFixture> = {
  standard: standardFunnelFixture,
  highDropoff: highDropoffFixture,
  zero: zeroVolumeFixture,
  nonMonotonic: nonMonotonicFixture,
  incomplete: incompleteFixture,
  large: largeFixture,
  invalid: invalidFixture,
};

const GRANULARITIES = ["daily", "weekly", "monthly"] as const;

function seedFromUrl(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return Object.fromEntries(new URLSearchParams(window.location.search));
}

export function App() {
  const [params] = useState(seedFromUrl);

  // --- dataset & top-level flags -------------------------------------------
  const [fixture, setFixture] = useState(params.fixture ?? "standard");
  const [showHeader, setShowHeader] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  const [showDropOff, setShowDropOff] = useState(true);
  const [showTrendSummary, setShowTrendSummary] = useState(true);
  const [showStageLabels, setShowStageLabels] = useState(true);
  const [showCumulativeConversion, setShowCumulativeConversion] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showTooltips, setShowTooltips] = useState(true);
  const [showDataTable, setShowDataTable] = useState(true);
  const [layout, setLayout] = useState<"default" | "compact" | "stacked">(
    (params.layout as "default" | "compact" | "stacked") ?? "default",
  );
  const [loading, setLoading] = useState(false);

  // --- funnel chart ---------------------------------------------------------
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [sort, setSort] = useState<"descending" | "ascending" | "none">("descending");
  const [gap, setGap] = useState(5);
  const [minSize, setMinSize] = useState(0);
  const [maxSize, setMaxSize] = useState(100);
  const [labelPosition, setLabelPosition] = useState<"inside" | "outside">("inside");
  const [labelStrategy, setLabelStrategy] = useState<"auto" | "fixed">("auto");
  const [labelOutsideThreshold, setLabelOutsideThreshold] = useState(15);
  const [showValues, setShowValues] = useState(true);
  const [showPercentages, setShowPercentages] = useState(true);
  const [showDropOffIndicators, setShowDropOffIndicators] = useState(true);
  const [selectedStageEmphasis, setSelectedStageEmphasis] = useState(true);
  const [colorMode, setColorMode] = useState<"palette" | "ramp">("palette");
  const [baseColor, setBaseColor] = useState("#3B82F6");
  const [fillGradient, setFillGradient] = useState(false);

  // --- trend chart ------------------------------------------------------------
  const [smooth, setSmooth] = useState(false);
  const [showSymbols, setShowSymbols] = useState(true);
  const [showArea, setShowArea] = useState(false);
  const [showDataLabels, setShowDataLabels] = useState(false);
  const [connectNulls, setConnectNulls] = useState(false);
  const [lineWidth, setLineWidth] = useState(2);
  const [symbolSize, setSymbolSize] = useState(6);
  const [legendPosition, setLegendPosition] = useState<"top" | "bottom">("top");
  const [showZoom, setShowZoom] = useState(false);

  // --- insights ---------------------------------------------------------------
  const [improvingPp, setImprovingPp] = useState(1);
  const [decliningPp, setDecliningPp] = useState(-1);
  const [anomalySigma, setAnomalySigma] = useState(2);

  // --- animation & theme --------------------------------------------------------
  const [animEnabled, setAnimEnabled] = useState(true);
  const [animDuration, setAnimDuration] = useState(800);
  const [themeMode, setThemeMode] = useState<"light" | "dark">(
    params.theme === "dark" ? "dark" : "light",
  );
  const [borderRadius, setBorderRadius] = useState(8);

  // --- filters -----------------------------------------------------------------
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [from, setFrom] = useState(params.from ?? "");
  const [to, setTo] = useState(params.to ?? "");

  // --- controlled selection -----------------------------------------------------
  const data = FIXTURES[fixture] ?? standardFunnelFixture;
  const stageOptions = useMemo(() => data.stages.map((s) => s.id), [data]);
  const transitionIds = useMemo(
    () => data.stages.slice(0, -1).map((s, i) => `${s.id}->${data.stages[i + 1]!.id}`),
    [data],
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(
    params.select && !params.select.includes("->") ? params.select : null,
  );
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(
    params.select?.includes("->") ? params.select : null,
  );
  const [hiddenSeries, setHiddenSeries] = useState<string[]>(() =>
    params.legend?.startsWith("off:") ? [params.legend.slice(4)] : [],
  );

  const [events, setEvents] = useState<string[]>([]);
  const logEvent = (msg: string) =>
    setEvents((prev) => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 8));

  const config: FunnelAnalysisConfig = {
    layout,
    showHeader,
    showInsights,
    showDropOff,
    showTrendSummary,
    showStageLabels,
    showCumulativeConversion,
    showLegend,
    showTooltips,
    showDataTable,
    funnel: {
      orientation,
      sort,
      gap,
      minSize,
      maxSize,
      labelPosition,
      labelStrategy,
      labelOutsideThreshold,
      showValues,
      showPercentages,
      showDropOffIndicators,
      selectedStageEmphasis,
      colorMode,
      baseColor: colorMode === "ramp" ? baseColor : undefined,
      fillGradient,
    },
    trend: {
      smooth,
      showSymbols,
      showArea,
      showDataLabels,
      connectNulls,
      lineWidth,
      symbolSize,
      legendPosition,
      showZoom,
    },
    insights: { thresholds: { improvingPp, decliningPp }, anomalySigma },
    animation: { enabled: animEnabled, durationMs: animDuration },
    theme: { mode: themeMode, borderRadius },
  };

  const selection: FunnelAnalysisSelection = {
    selectedStageId,
    selectedTransitionId,
    visibleSeriesIds: transitionIds.filter((id) => !hiddenSeries.includes(id)),
  };

  const resetInteraction = () => {
    setSelectedStageId(null);
    setSelectedTransitionId(null);
    setHiddenSeries([]);
    setFrom("");
    setTo("");
    logEvent("reset");
  };

  return (
    <div className="demo-root">
      <aside className="demo-sidebar">
        <h1>FunnelAnalysis Playground</h1>
        <p className="demo-sub">Semua setting yang didukung komponen.</p>

        <Section title="Dataset" open>
          <Choice
            label="Dataset"
            value={fixture}
            options={Object.keys(FIXTURES)}
            onChange={(v) => {
              setFixture(v);
              setSelectedStageId(null);
              setSelectedTransitionId(null);
              setHiddenSeries([]);
            }}
          />
          <Toggle label="loading" value={loading} onChange={setLoading} />
          <button className="demo-btn demo-btn-primary" onClick={resetInteraction}>
            Reset interaksi & filter
          </button>
        </Section>

        <Section title="Panels & flags" open>
          <Toggle label="showHeader" value={showHeader} onChange={setShowHeader} />
          <Choice label="layout" value={layout} options={["default", "compact", "stacked"] as const} onChange={setLayout} />
          <Toggle label="showInsights" value={showInsights} onChange={setShowInsights} />
          <Toggle label="showDropOff" value={showDropOff} onChange={setShowDropOff} />
          <Toggle label="showTrendSummary" value={showTrendSummary} onChange={setShowTrendSummary} />
          <Toggle label="showStageLabels" value={showStageLabels} onChange={setShowStageLabels} />
          <Toggle label="showCumulativeConversion" value={showCumulativeConversion} onChange={setShowCumulativeConversion} />
          <Toggle label="showLegend" value={showLegend} onChange={setShowLegend} />
          <Toggle label="showTooltips" value={showTooltips} onChange={setShowTooltips} />
          <Toggle label="showDataTable" value={showDataTable} onChange={setShowDataTable} />
        </Section>

        <Section title="Funnel chart">
          <Choice label="orientation" value={orientation} options={["vertical", "horizontal"] as const} onChange={setOrientation} />
          <Choice label="sort" value={sort} options={["descending", "ascending", "none"] as const} onChange={setSort} />
          <Num label="gap" value={gap} onChange={setGap} min={0} max={40} />
          <Num label="minSize (%)" value={minSize} onChange={setMinSize} min={0} max={100} />
          <Num label="maxSize (%)" value={maxSize} onChange={setMaxSize} min={0} max={100} />
          <Choice label="labelPosition" value={labelPosition} options={["inside", "outside"] as const} onChange={setLabelPosition} />
          <Choice label="labelStrategy" value={labelStrategy} options={["auto", "fixed"] as const} onChange={setLabelStrategy} />
          {labelStrategy === "auto" && (
            <Num label="labelOutsideThreshold (%)" value={labelOutsideThreshold} onChange={setLabelOutsideThreshold} min={0} max={100} />
          )}
          <Toggle label="showValues" value={showValues} onChange={setShowValues} />
          <Toggle label="showPercentages" value={showPercentages} onChange={setShowPercentages} />
          <Toggle label="showDropOffIndicators" value={showDropOffIndicators} onChange={setShowDropOffIndicators} />
          <Toggle label="selectedStageEmphasis" value={selectedStageEmphasis} onChange={setSelectedStageEmphasis} />
          <Choice label="colorMode" value={colorMode} options={["palette", "ramp"] as const} onChange={setColorMode} />
          {colorMode === "ramp" && (
            <Row label="baseColor">
              <input
                type="color"
                value={baseColor}
                onChange={(e) => setBaseColor(e.target.value)}
              />
            </Row>
          )}
          <Toggle label="fillGradient" value={fillGradient} onChange={setFillGradient} />
          <div className="demo-row" style={{ gap: 4 }}>
            {resolveStagePalette(
              (FIXTURES[fixture] ?? standardFunnelFixture).stages.length,
              undefined,
              {
                colorMode,
                baseColor: colorMode === "ramp" ? baseColor : undefined,
              },
            ).map((c, i) => (
              <span
                key={i}
                title={c}
                style={{
                  width: 22,
                  height: 14,
                  borderRadius: 3,
                  background: c,
                  display: "inline-block",
                }}
              />
            ))}
          </div>
        </Section>

        <Section title="Trend chart">
          <Toggle label="smooth" value={smooth} onChange={setSmooth} />
          <Toggle label="showSymbols" value={showSymbols} onChange={setShowSymbols} />
          <Toggle label="showArea" value={showArea} onChange={setShowArea} />
          <Toggle label="showDataLabels" value={showDataLabels} onChange={setShowDataLabels} />
          <Toggle label="connectNulls" value={connectNulls} onChange={setConnectNulls} />
          <Num label="lineWidth" value={lineWidth} onChange={setLineWidth} min={1} max={8} />
          <Num label="symbolSize" value={symbolSize} onChange={setSymbolSize} min={0} max={20} />
          <Choice label="legendPosition" value={legendPosition} options={["top", "bottom"] as const} onChange={setLegendPosition} />
          <Toggle label="showZoom" value={showZoom} onChange={setShowZoom} />
        </Section>

        <Section title="Insights">
          <Num label="improvingPp (≥)" value={improvingPp} onChange={setImprovingPp} step={0.5} />
          <Num label="decliningPp (≤)" value={decliningPp} onChange={setDecliningPp} step={0.5} />
          <Num label="anomalySigma" value={anomalySigma} onChange={setAnomalySigma} min={0.5} max={5} step={0.5} />
        </Section>

        <Section title="Animation & theme">
          <Toggle label="animation.enabled" value={animEnabled} onChange={setAnimEnabled} />
          <Num label="durationMs" value={animDuration} onChange={setAnimDuration} min={0} max={5000} step={100} />
          <Choice label="theme.mode" value={themeMode} options={["light", "dark"] as const} onChange={setThemeMode} />
          <Num label="borderRadius" value={borderRadius} onChange={setBorderRadius} min={0} max={24} />
        </Section>

        <Section title="Filters">
          <Choice label="granularity" value={granularity} options={GRANULARITIES} onChange={setGranularity} />
          <Text label="dateRange.from" value={from} onChange={setFrom} type="date" />
          <Text label="dateRange.to" value={to} onChange={setTo} type="date" />
        </Section>

        <Section title="Selection (controlled)">
          <Choice
            label="selectedStageId"
            value={selectedStageId ?? ""}
            options={["", ...stageOptions] as unknown as readonly string[]}
            onChange={(v) => {
              setSelectedStageId(v || null);
              setSelectedTransitionId(null);
              logEvent(`stage.select ${v || "(null)"}`);
            }}
          />
          <Choice
            label="selectedTransitionId"
            value={selectedTransitionId ?? ""}
            options={["", ...transitionIds]}
            onChange={(v) => {
              setSelectedTransitionId(v || null);
              setSelectedStageId(null);
              logEvent(`transition.select ${v || "(null)"}`);
            }}
          />
          {transitionIds.map((id) => (
            <Toggle
              key={id}
              label={`visible: ${id}`}
              value={!hiddenSeries.includes(id)}
              onChange={(v) =>
                setHiddenSeries((prev) =>
                  v ? prev.filter((x) => x !== id) : [...prev, id],
                )
              }
            />
          ))}
        </Section>

        <Section title="Event log">
          <pre className="demo-events">
            {events.length === 0 ? "— klik chart untuk melihat event —" : events.join("\n")}
          </pre>
        </Section>
      </aside>

      <main className="demo-main">
        <FunnelAnalysis
          data={data}
          config={config}
          filters={{
            dateRange: from || to ? { from: from || "1900-01-01", to: to || "2999-12-31" } : undefined,
            granularity,
          }}
          selection={selection}
          loading={loading}
          onStageSelect={(stage) => {
            setSelectedStageId(stage?.id ?? null);
            setSelectedTransitionId(null);
            logEvent(`stage.select ${stage?.id ?? "(null)"}`);
          }}
          onTransitionSelect={(t) => {
            setSelectedTransitionId(t?.id ?? null);
            setSelectedStageId(null);
            logEvent(`transition.select ${t?.id ?? "(null)"}`);
          }}
          onSeriesVisibilityChange={(ids) => {
            setHiddenSeries(transitionIds.filter((id) => !ids.includes(id)));
            logEvent(`series.visibility ${ids.length} visible`);
          }}
          onFilterChange={(f) => logEvent(`filter.change ${JSON.stringify(f)}`)}
          onReset={() => {
            resetInteraction();
            logEvent("selection.reset");
          }}
        />
      </main>
    </div>
  );
}
