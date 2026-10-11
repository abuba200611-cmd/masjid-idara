import { describe, expect, it } from "vitest";
import { FEATURES, effectiveFeatures, getFeature } from "../lib/features";

/** سجل المزايا — الافتراضيات والمفاتيح وحالات "قريباً" */
describe("سجل المزايا", () => {
  it("المفاتيح فريدة", () => {
    const keys = FEATURES.map((feature) => feature.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("المزايا الجاهزة الأربع مفعّلة افتراضياً", () => {
    for (const key of ["halaqat", "registration", "stats", "brain"]) {
      const feature = getFeature(key);
      expect(feature, key).toBeDefined();
      expect(feature?.status).toBe("ready");
      expect(feature?.defaultEnabled).toBe(true);
    }
  });

  it("المزايا القادمة (soon) لا يمكن تفعيلها", () => {
    const soonKeys = ["families", "committees", "weekly_evaluation", "badges", "weekly_schedule", "reports", "agent"];
    for (const key of soonKeys) {
      const feature = getFeature(key);
      expect(feature, key).toBeDefined();
      expect(feature?.status).toBe("soon");
      expect(feature?.defaultEnabled).toBe(false);
    }
  });

  it("مفتاح غير معروف يعطي undefined", () => {
    expect(getFeature("does_not_exist")).toBeUndefined();
  });

  it("الخريطة الفعّالة تعامل قريباً كمعطّلة حتى لو كان لها صف مفعّل", () => {
    const map = effectiveFeatures([
      { key: "stats", status: "ready", enabled: true },
      { key: "brain", status: "ready", enabled: false },
      { key: "families", status: "soon", enabled: true },
    ]);
    expect(map).toEqual({ stats: true, brain: false, families: false });
  });
});
