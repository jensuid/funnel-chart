import { describe, it, expect } from "vitest";
import { validateFunnelData } from "../src/funnel-analysis/validation/validateFunnelData";
import {
  nonMonotonicFixture,
  standardFunnelFixture,
  zeroVolumeFixture,
} from "./fixtures";

describe("validateFunnelData — valid datasets", () => {
  it("accepts the golden fixture", () => {
    const result = validateFunnelData(standardFunnelFixture);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("zero-volume funnel is valid with ZERO_DENOMINATOR info", () => {
    const result = validateFunnelData(zeroVolumeFixture);
    expect(result.valid).toBe(true);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("ZERO_DENOMINATOR");
    expect(result.issues.every((i) => i.severity !== "error")).toBe(true);
  });
});

describe("validateFunnelData — structural & numerical (always strict)", () => {
  it("rejects negative count", () => {
    const data = {
      ...standardFunnelFixture,
      periods: [
        {
          period: "2026-W01",
          stages: [{ stageId: "visitors", count: -5 }],
        },
      ],
    };
    const result = validateFunnelData(data);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "NEGATIVE_COUNT")).toBe(true);
  });

  it("rejects unknown stage reference", () => {
    const data = {
      ...standardFunnelFixture,
      periods: [
        {
          period: "2026-W01",
          stages: [{ stageId: "ghost-stage", count: 10 }],
        },
      ],
    };
    const result = validateFunnelData(data);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "UNKNOWN_STAGE_REFERENCE")).toBe(true);
  });

  it("rejects duplicate stage id", () => {
    const data = {
      ...standardFunnelFixture,
      stages: [
        ...standardFunnelFixture.stages,
        { id: "visitors", label: "Visitors Copy", order: 6 },
      ],
    };
    const result = validateFunnelData(data);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "DUPLICATE_STAGE_ID")).toBe(true);
  });

  it("rejects invalid stage order", () => {
    const data = {
      ...standardFunnelFixture,
      stages: standardFunnelFixture.stages.map((s, i) =>
        i === 0 ? { ...s, order: 0 } : s,
      ),
    };
    const result = validateFunnelData(data);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "INVALID_STAGE_ORDER")).toBe(true);
  });

  it("rejects dataset with no stages", () => {
    const result = validateFunnelData({ ...standardFunnelFixture, stages: [] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "MISSING_STAGE")).toBe(true);
  });
});

describe("validateFunnelData — non-monotonic policy", () => {
  it("default policy: warning, dataset stays valid", () => {
    const result = validateFunnelData(nonMonotonicFixture);
    expect(result.valid).toBe(true);
    const nm = result.issues.find((i) => i.code === "NON_MONOTONIC_FUNNEL");
    expect(nm?.severity).toBe("warning");
  });

  it("strict policy: dataset rejected", () => {
    const result = validateFunnelData(nonMonotonicFixture, {
      nonMonotonicPolicy: "strict",
    });
    expect(result.valid).toBe(false);
    expect(
      result.issues.some(
        (i) => i.code === "NON_MONOTONIC_FUNNEL" && i.severity === "error",
      ),
    ).toBe(true);
  });

  it("allow policy: downgraded to info", () => {
    const result = validateFunnelData(nonMonotonicFixture, {
      nonMonotonicPolicy: "allow",
    });
    expect(result.valid).toBe(true);
    const nm = result.issues.find((i) => i.code === "NON_MONOTONIC_FUNNEL");
    expect(nm?.severity).toBe("info");
  });
});

describe("validateFunnelData — missing period data", () => {
  it("warns when a period lacks stage observations", () => {
    const data = {
      ...standardFunnelFixture,
      periods: [
        {
          period: "2026-W01",
          stages: [{ stageId: "visitors", count: 1000 }],
        },
      ],
    };
    const result = validateFunnelData(data);
    expect(result.valid).toBe(true);
    const missing = result.issues.filter((i) => i.code === "MISSING_PERIOD_DATA");
    expect(missing.length).toBeGreaterThanOrEqual(4);
  });

  it("warns when dataset has no periods", () => {
    const result = validateFunnelData({ ...standardFunnelFixture, periods: [] });
    expect(result.valid).toBe(true);
    expect(result.issues.some((i) => i.code === "MISSING_PERIOD_DATA")).toBe(true);
  });
});
