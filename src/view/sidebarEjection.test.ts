import { describe, expect, it } from "vitest";
import {
  railPanelBorderRightWidth,
  sidebarEjectionPlan,
} from "./sidebarEjection";

describe("Design Studio sidebar ejection", () => {
  it("keeps the studio content canvas-only when neither rail is bound", () => {
    expect(
      sidebarEjectionPlan({ libraryRail: false, inspectorRail: false }),
    ).toEqual({ library: "absent", inspector: "absent" });
  });

  it("renders each sidebar only through its bound rail", () => {
    expect(
      sidebarEjectionPlan({ libraryRail: true, inspectorRail: false }),
    ).toEqual({ library: "rail", inspector: "absent" });
    expect(
      sidebarEjectionPlan({ libraryRail: false, inspectorRail: true }),
    ).toEqual({ library: "absent", inspector: "rail" });
  });

  it("leaves the rail's outer boundary to the core frame", () => {
    expect(railPanelBorderRightWidth({ fill: true })).toBe(0);
    expect(railPanelBorderRightWidth({ fill: false })).toBe(1);
  });
});
