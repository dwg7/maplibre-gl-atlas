import { describe, expect, it } from "vitest";
import {
  choosePrintStrategy,
  computeBaseOrientation,
  generateStrategyCss,
  isLikelyWindows,
  resolveStrategy,
} from "../src/strategy";

function fakeNav(overrides: Partial<Navigator> & { userAgentData?: { platform: string } }): Navigator {
  return { userAgent: "", ...overrides } as Navigator;
}

describe("isLikelyWindows", () => {
  it("returns true when userAgentData.platform is Windows", () => {
    const nav = fakeNav({ userAgentData: { platform: "Windows" }, userAgent: "should not matter" });
    expect(isLikelyWindows(nav)).toBe(true);
  });

  it("returns false when userAgentData.platform is a non-Windows platform", () => {
    const nav = fakeNav({ userAgentData: { platform: "macOS" } });
    expect(isLikelyWindows(nav)).toBe(false);
  });

  it("falls back to the userAgent regex when userAgentData is absent (Windows UA)", () => {
    const nav = fakeNav({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });
    expect(isLikelyWindows(nav)).toBe(true);
  });

  it("falls back to the userAgent regex when userAgentData is absent (non-Windows UA)", () => {
    const nav = fakeNav({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    });
    expect(isLikelyWindows(nav)).toBe(false);
  });

  it("returns false when no navigator is available at all", () => {
    expect(isLikelyWindows(undefined as unknown as Navigator)).toBe(false);
  });
});

describe("choosePrintStrategy / resolveStrategy", () => {
  it("resolveStrategy passes an explicit strategy straight through", () => {
    expect(resolveStrategy("mixed")).toBe("mixed");
    expect(resolveStrategy("rotate")).toBe("rotate");
  });

  it("resolveStrategy('auto') and no-arg both defer to choosePrintStrategy()", () => {
    expect(resolveStrategy("auto")).toBe(choosePrintStrategy());
    expect(resolveStrategy(undefined)).toBe(choosePrintStrategy());
  });
});

describe("computeBaseOrientation", () => {
  it("picks the majority orientation", () => {
    expect(computeBaseOrientation(["landscape", "landscape", "portrait"])).toBe("landscape");
    expect(computeBaseOrientation(["portrait", "portrait", "landscape"])).toBe("portrait");
  });

  it("ties go to portrait, matching dwg7/zukaku's preparePrintPages()", () => {
    expect(computeBaseOrientation(["portrait", "landscape"])).toBe("portrait");
    expect(computeBaseOrientation([])).toBe("portrait");
  });
});

describe("generateStrategyCss", () => {
  const a4 = { width: 210, height: 297 };

  it("mixed strategy: each orientation gets its own named @page at the given pageSize", () => {
    const css = generateStrategyCss(a4, "mixed");
    expect(css).toContain("@page atlas-portrait { size: 210mm 297mm; margin: 0; }");
    expect(css).toContain("@page atlas-landscape { size: 297mm 210mm; margin: 0; }");
    expect(css).toContain("strategy-mixed .print-page.portrait-page { page: atlas-portrait; width: 210mm; height: 297mm; }");
    expect(css).not.toContain("rotate(90deg)");
  });

  it("rotate strategy: a single base @page per orientation, and the minority orientation is rotated", () => {
    const css = generateStrategyCss(a4, "rotate");
    expect(css).toContain("@page atlas-base-portrait { size: 210mm 297mm; margin: 0; }");
    expect(css).toContain("@page atlas-base-landscape { size: 297mm 210mm; margin: 0; }");
    expect(css).toContain("transform: rotate(90deg)");
    // Derivation from ADR 0007's addendum: the rotated inner box is offset
    // left by the base page's own width before rotating — both the
    // portrait-base and landscape-base rule sets are always emitted (which
    // one applies at runtime is decided by the class AtlasControl puts on
    // #print-root, from the actual sheets being printed — see strategy.ts).
    expect(css).toContain("base-portrait .print-page-inner.rotated {\n    position: absolute; top: 0; left: 210mm;");
    expect(css).toContain("base-landscape .print-page-inner.rotated {\n    position: absolute; top: 0; left: 297mm;");
  });

  it("respects a non-A4 pageSize", () => {
    const letter = { width: 215.9, height: 279.4 }; // US Letter
    const css = generateStrategyCss(letter, "mixed");
    expect(css).toContain("@page atlas-portrait { size: 215.9mm 279.4mm; margin: 0; }");
    expect(css).toContain("@page atlas-landscape { size: 279.4mm 215.9mm; margin: 0; }");
  });

  it("shaves 1mm off a landscape page's own declared height (both strategies) to avoid a Chromium print-to-PDF quirk that spills a near-blank trailing page (ADR 0013)", () => {
    const mixed = generateStrategyCss(a4, "mixed");
    expect(mixed).toContain("strategy-mixed .print-page.landscape-page { page: atlas-landscape; width: 297mm; height: calc(210mm - 1mm); }");
    // Portrait is unaffected — the bug is landscape-specific.
    expect(mixed).toContain("strategy-mixed .print-page.portrait-page { page: atlas-portrait; width: 210mm; height: 297mm; }");

    const rotate = generateStrategyCss(a4, "rotate");
    expect(rotate).toContain("strategy-rotate.base-landscape .print-page { page: atlas-base-landscape; width: 297mm; height: calc(210mm - 1mm); }");
    expect(rotate).toContain("strategy-rotate.base-portrait .print-page { page: atlas-base-portrait; width: 210mm; height: 297mm; }");
  });
});
