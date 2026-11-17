import { describe, it, expect } from "vitest";
import {
  buildFunnelViewModel,
  calculateCumulativeConversion,
  calculateDropOff,
  calculateOverallConversion,
  calculateStageConversion,
  computeStageViewModels,
  findHighestDropOff,
} from "../src/funnel-analysis/metrics/calculateFunnelMetrics";
import {
  standardFunnelFixture,
  zeroVolumeFixture,
} from "./fixtures";

describe("calculateFunnelMetrics — golden dataset (Week 1)", () => {
  const week1 = standardFunnelFixture.periods[0]!;
  const vm = buildFunnelViewModel(standardFunnelFixture, week1.stages);

  it("calculates overall conversion = 7%", () => {
    expect(vm.overallConversion).toBeCloseTo(7, 10);
  });

  it("calculates stage-to-stage conversion", () => {
    // visitors→views 70, views→cart 50, cart→checkout 50, checkout→purchase 40
    expect(vm.transitions.map((t) => t.conversionRate)).toEqual([
      70, 50, 50, 40,
    ]);
  });

  it("calculates drop-off as complement", () => {
    expect(vm.transitions.map((t) => t.dropOffRate)).toEqual([30, 50, 50, 60]);
  });

  it("calculates cumulative conversion per stage", () => {
    const expected = [100, 70, 35, 17.5, 7];
    vm.stages.forEach((s, i) => {
      expect(s.cumulativeConversion).toBeCloseTo(expected[i]!, 10);
    });
  });

  it("identifies highest drop-off transition (60%)", () => {
    const worst = findHighestDropOff(vm.transitions);
    expect(worst?.id).toBe("checkout->purchase");
    expect(worst?.dropOffRate).toBeCloseTo(60, 10);
  });
});

describe("calculateFunnelMetrics — golden dataset (Week 2)", () => {
  const week2 = standardFunnelFixture.periods[1]!;
  const vm = buildFunnelViewModel(standardFunnelFixture, week2.stages);

  it("calculates overall conversion = 10%", () => {
    expect(vm.overallConversion).toBeCloseTo(10, 10);
  });

  it("calculates stage-to-stage conversion", () => {
    expect(vm.transitions.map((t) => t.conversionRate?.toFixed(2))).toEqual([
      "70.00",
      "57.14",
      "50.00",
      "50.00",
    ]);
  });
});

describe("zero denominators and missing values", () => {
  it("returns null for zero denominator", () => {
    expect(calculateStageConversion(0, 0)).toBeNull();
    expect(calculateCumulativeConversion(5, 0)).toBeNull();
    expect(calculateOverallConversion(10, 0)).toBeNull();
  });

  it("returns null for missing values", () => {
    expect(calculateStageConversion(undefined, 100)).toBeNull();
    expect(calculateStageConversion(50, undefined)).toBeNull();
  });

  it("calculates drop-off correctly (80/100 → 20)", () => {
    expect(calculateDropOff(80, 100)).toBeCloseTo(20, 10);
  });

  it("zero-volume funnel: all rates null, never NaN/Infinity/0", () => {
    const vm = buildFunnelViewModel(
      zeroVolumeFixture,
      zeroVolumeFixture.periods[0]!.stages,
    );
    expect(vm.overallConversion).toBeNull();
    for (const t of vm.transitions) {
      expect(t.conversionRate).toBeNull();
      expect(t.dropOffRate).toBeNull();
    }
    for (const s of vm.stages) {
      expect(s.cumulativeConversion).toBeNull();
    }
  });
});

describe("computeStageViewModels", () => {
  it("respects stage order regardless of observation order", () => {
    const stages = standardFunnelFixture.stages;
    const reversed = [...standardFunnelFixture.periods[0]!.stages].reverse();
    const vm = computeStageViewModels(stages, reversed);
    expect(vm.map((s) => s.stage.id)).toEqual([
      "visitors",
      "views",
      "cart",
      "checkout",
      "purchase",
    ]);
  });

  it("treats missing observation as count 0 with null rates", () => {
    const vm = computeStageViewModels(standardFunnelFixture.stages, [
      { stageId: "visitors", count: 1000 },
      { stageId: "views", count: 700 },
    ]);
    const purchase = vm.find((s) => s.stage.id === "purchase")!;
    expect(purchase.count).toBe(0);
    expect(purchase.stageToStageConversion).toBeNull();
    expect(purchase.cumulativeConversion).toBeCloseTo(0, 10);
  });
});
