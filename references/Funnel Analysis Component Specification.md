# Funnel Analysis Component Specification

**Status:** Design approved / Specification ready  
**Component:** FunnelAnalysis  
**Category:** Composite Data Visualization  
**Visualization Engine:** ECharts-compatible  
**Architecture:** Shared data model and interaction state

## 1. Product Definition

FunnelAnalysis is a composite visualization component that combines:

1. Funnel Overview — stage volume and cumulative conversion.
    
2. Conversion Rate Trend — stage-to-stage conversion over time.
    

Both panels share the same data context, filters, metric definitions, and interaction state.

## 2. Component Architecture

```
FunnelAnalysis
├── SharedFilterController
├── SharedInteractionState
├── FunnelDataAdapter
├── FunnelMetricCalculator
├── FunnelOverview
│   ├── FunnelChart
│   ├── StageMetrics
│   └── DropOffIndicators
├── KeyInsights
├── ConversionTrend
│   ├── TrendChart
│   └── InteractiveLegend
└── TrendSummary
```

## 3. Metric Definitions

### Stage Volume

Number of users or entities reaching a particular stage.

### Cumulative Conversion

CC(i) = N(i) / N(0) × 100

Measures conversion relative to the initial stage.

### Stage-to-Stage Conversion

CR(i) = N(i) / N(i-1) × 100

Measures conversion between consecutive stages.

### Stage Drop-off

DO(i) = 100% - CR(i)

Measures the proportion not progressing to the next stage.

### Overall Conversion

Overall Conversion = Final Stage / Initial Stage × 100

All calculations must handle zero denominators, missing values, and invalid stage sequences.

## 4. Data Contract

```
type FunnelStage = {
  id: string;
  label: string;
  order: number;
  count: number;
};

type FunnelTransition = {
  id: string;
  fromStageId: string;
  toStageId: string;
  conversionRate: number;
  dropOffRate: number;
};

type FunnelPeriodData = {
  period: string;
  stages: FunnelStage[];
  transitions: FunnelTransition[];
};

type FunnelAnalysisData = {
  stages: FunnelStage[];
  periods: FunnelPeriodData[];
};
```

Calculated metrics should be derived from canonical stage counts whenever possible.

## 5. Shared Interaction State

```
type FunnelAnalysisState = {
  dateRange: DateRange;
  segment: string | null;
  granularity: 'daily' | 'weekly' | 'monthly';
  selectedStageId: string | null;
  selectedTransitionId: string | null;
  visibleSeriesIds: string[];
  hoveredStageId: string | null;
};
```

## 6. Interaction Contract

|Interaction|Expected behavior|
|---|---|
|Select stage|Highlight stage and adjacent transitions|
|Hover stage|Show stage volume and metrics|
|Select transition|Highlight corresponding funnel stages|
|Hover trend point|Show period and conversion metrics|
|Toggle legend|Show/hide corresponding series|
|Change date range|Update both panels|
|Change segment|Recalculate both panels|
|Change granularity|Regroup trend data|
|Reset|Restore default filters and selections|

Selection and hover must be independent states.

## 7. Visual Specification

### Funnel Overview

- Proportional funnel widths based on stage volume.
    
- Distinct but coordinated stage colors.
    
- Stage labels and counts.
    
- Cumulative conversion percentages.
    
- Stage-to-stage drop-off indicators.
    
- Selected-stage highlighting.
    

### Key Insights

- Stage conversion performance.
    
- Highest drop-off transition.
    
- Improving and declining transitions.
    
- Overall conversion performance.
    
- Contextual explanations.
    

### Conversion Rate Trend

- One time-series per transition.
    
- X-axis: time periods.
    
- Y-axis: conversion rate (%).
    
- Interactive legend.
    
- Shared tooltip.
    
- Selected-transition highlighting.
    
- Missing periods represented as missing data, not zero.
    

### Trend Summary

Generate insights based on actual calculated metrics and comparisons.

Do not use hardcoded insight statements.

## 8. Component States

Support:

- Initial loading
    
- Loading with existing data
    
- Success
    
- Empty
    
- Partial data
    
- Error
    
- Invalid data
    
- No matching filter
    

Both visualization panels must remain synchronized.

## 9. Responsive Behavior

|Viewport|Layout|
|---|---|
|Desktop|Funnel and insights side-by-side; trend below|
|Tablet|Funnel above insights; trend below|
|Mobile|Vertically stacked panels|

Maintain chart readability and accessible interaction on all viewports.

## 10. Accessibility

- Keyboard navigation.
    
- Visible focus states.
    
- Screen-reader descriptions.
    
- WCAG 2.2 AA contrast.
    
- Non-color-only series identification.
    
- Accessible chart data summaries.
    
- Keyboard-accessible tooltips.
    

## 11. Acceptance Criteria

- Correct stage volume.
    
- Correct cumulative conversion.
    
- Correct stage-to-stage conversion.
    
- Correct drop-off calculations.
    
- Consistent data across both panels.
    
- Synchronized date and segment filters.
    
- Interactive stage selection.
    
- Interactive transition selection.
    
- Interactive legend.
    
- Correct handling of missing data and zero denominators.
    
- Complete loading, empty, and error states.
    
- Responsive behavior.
    
- Accessibility requirements.
    
- Unit tests for metric calculations.
    
- Integration tests for cross-panel interactions.
    

## 12. Implementation Principles

1. Keep business logic separate from chart rendering.
    
2. Keep the data contract independent of ECharts.
    
3. Use one shared state for cross-panel coordination.
    
4. Use derived metrics rather than duplicated stored calculations.
    
5. Keep chart components independently testable.
    
6. Avoid coupling the component to a specific dataset or business domain.
    
7. Use reusable chart configuration and design tokens.
    
8. Validate all data before rendering.
    

## 13. Implementation Modules

1. Funnel Metric Calculator
    
2. Funnel Data Adapter
    
3. Shared Interaction State
    
4. Funnel Overview
    
5. Conversion Trend
    
6. Key Insights
    
7. Composite Funnel Analysis
    
8. Unit and Integration Tests
    

**Definition of Done:** All acceptance criteria pass, both panels remain synchronized, and the component can be reused with different funnel datasets without modifying its internal business logic.