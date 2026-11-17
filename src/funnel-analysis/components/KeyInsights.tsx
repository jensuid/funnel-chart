import type { FunnelInsight } from "../types/api.types";

/**
 * Key Insights panel — renders rule-based insights from the insight engine.
 * Purely presentational; all analytics live in insights/generateInsights.ts.
 */

const SEVERITY_STYLES: Record<FunnelInsight["severity"], { border: string; badge: string }> = {
  positive: { border: "#22C55E", badge: "▲" },
  neutral: { border: "#9CA3AF", badge: "•" },
  warning: { border: "#F59E0B", badge: "▼" },
  critical: { border: "#EF4444", badge: "▼▼" },
};

export interface KeyInsightsProps {
  insights: FunnelInsight[];
  loading?: boolean;
}

export function KeyInsights({ insights, loading }: KeyInsightsProps) {
  if (loading) {
    return (
      <section className="fa-insights" aria-busy="true" aria-label="Key insights">
        <h3>Key Insights</h3>
        <p className="fa-muted">Updating insights…</p>
      </section>
    );
  }
  if (insights.length === 0) {
    return (
      <section className="fa-insights" aria-label="Key insights">
        <h3>Key Insights</h3>
        <p className="fa-muted">No insights available for the current selection.</p>
      </section>
    );
  }
  return (
    <section className="fa-insights" aria-label="Key insights">
      <h3>Key Insights</h3>
      <ul className="fa-insight-list">
        {insights.map((insight) => {
          const style = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.neutral;
          return (
            <li
              key={insight.id}
              className="fa-insight"
              style={{ borderLeftColor: style.border }}
            >
              <span className="fa-insight-badge" aria-hidden="true">
                {style.badge}
              </span>
              <div>
                <div className="fa-insight-title">{insight.title}</div>
                <div className="fa-insight-desc">{insight.description}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
