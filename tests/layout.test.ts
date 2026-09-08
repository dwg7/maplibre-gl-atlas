import { describe, expect, it } from "vitest";
import { generateBaseCss, generateLayoutCss, resolveMargin, resolvePageSize } from "../src/layout";

describe("resolvePageSize", () => {
  it("defaults to A4", () => {
    expect(resolvePageSize(undefined)).toEqual({ width: 210, height: 297 });
  });

  it("passes an explicit pageSize through unchanged", () => {
    expect(resolvePageSize({ width: 100, height: 150 })).toEqual({ width: 100, height: 150 });
  });
});

describe("resolveMargin", () => {
  it("defaults to 15mm on all sides", () => {
    expect(resolveMargin(undefined)).toEqual({ top: 15, right: 15, bottom: 15, left: 15 });
  });

  it("applies a single number to all four sides", () => {
    expect(resolveMargin(20)).toEqual({ top: 20, right: 20, bottom: 20, left: 20 });
  });

  it("fills in unspecified sides from the default when given a partial object", () => {
    expect(resolveMargin({ top: 10, left: 5 })).toEqual({ top: 10, right: 15, bottom: 15, left: 5 });
  });
});

describe("generateBaseCss", () => {
  it("hides the print root outside of @media print and shows it inside", () => {
    const css = generateBaseCss();
    expect(css).toContain("#maplibre-gl-atlas-print-root { display: none; }");
    expect(css).toContain("@media print");
    expect(css).toContain("#maplibre-gl-atlas-print-root { display: block; }");
  });
});

describe("generateLayoutCss", () => {
  it("uses the 15mm-default numbers matching dwg7/zukaku's fixed layout", () => {
    const css = generateLayoutCss(15);
    expect(css).toContain("top: 15mm; left: 15mm; right: 15mm; bottom: 15mm;");
    expect(css).toContain("height: 15mm;"); // header/footer band height
    expect(css).toContain("font: bold 5mm/1 sans-serif"); // 15/3
    expect(css).toContain("font-size: 3mm;"); // 15/5
    expect(css).toContain("object-fit: contain");
  });

  it("scales header/footer bands and font sizes for a different margin", () => {
    const css = generateLayoutCss(30);
    expect(css).toContain("top: 30mm; left: 30mm; right: 30mm; bottom: 30mm;");
    expect(css).toContain("height: 30mm;");
    expect(css).toContain("font: bold 10mm/1 sans-serif"); // 30/3
    expect(css).toContain("font-size: 6mm;"); // 30/5
  });

  it("supports independent per-side margins", () => {
    const css = generateLayoutCss({ top: 20, right: 10, bottom: 8, left: 12 });
    expect(css).toContain("top: 20mm; left: 12mm; right: 10mm; bottom: 8mm;");
    // Header band height tracks the top margin, footer band the bottom margin.
    expect(css).toContain("top: 0; left: 12mm; right: 10mm; height: 20mm;");
    expect(css).toContain("bottom: 0; left: 12mm; right: 10mm; height: 8mm;");
  });
});
