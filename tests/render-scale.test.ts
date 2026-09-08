import { describe, expect, it } from "vitest";
import { mmToPx, pageSizePx, stagedPixelSize } from "../src/render-scale";

const A4 = { width: 210, height: 297 };

describe("mmToPx", () => {
  it("converts millimeters to CSS pixels at 96dpi", () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 5);
    expect(mmToPx(0)).toBe(0);
  });
});

describe("pageSizePx", () => {
  it("matches dwg7/zukaku's hardcoded A4 viewport pixel size (794x1123 portrait)", () => {
    expect(pageSizePx(A4, "portrait")).toEqual({ width: 794, height: 1123 });
  });

  it("swaps width/height for landscape", () => {
    expect(pageSizePx(A4, "landscape")).toEqual({ width: 1123, height: 794 });
  });

  it("works for a non-A4 pageSize", () => {
    const letter = { width: 215.9, height: 279.4 };
    const portrait = pageSizePx(letter, "portrait");
    const landscape = pageSizePx(letter, "landscape");
    expect(portrait.width).toBeLessThan(portrait.height);
    expect(landscape).toEqual({ width: portrait.height, height: portrait.width });
  });
});

describe("stagedPixelSize", () => {
  it("returns the plain page size when there is no renderScale", () => {
    expect(stagedPixelSize(A4, "portrait")).toEqual({ width: 794, height: 1123 });
  });

  it("inflates each axis independently per ADR 0009's zoom-level-shift technique", () => {
    expect(stagedPixelSize(A4, "portrait", { x: 3, y: 2 })).toEqual({ width: 794 * 3, height: 1123 * 2 });
  });

  it("a uniform (square-grid) renderScale keeps the base aspect ratio", () => {
    const scaled = stagedPixelSize(A4, "portrait", { x: 2, y: 2 });
    const base = pageSizePx(A4, "portrait");
    expect(scaled.width / scaled.height).toBeCloseTo(base.width / base.height, 10);
  });
});
