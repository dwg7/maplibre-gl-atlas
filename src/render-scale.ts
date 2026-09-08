import type { Orientation, PageSize } from "./types";
import { resolvePageSize } from "./layout";

/** CSS pixels are defined as 1/96 inch, and 1 inch = 25.4mm. */
export const CSS_PX_PER_INCH = 96;
export const MM_PER_INCH = 25.4;

export function mmToPx(mm: number): number {
  return (mm * CSS_PX_PER_INCH) / MM_PER_INCH;
}

export interface PixelSize {
  width: number;
  height: number;
}

/**
 * The plain (unscaled) pixel footprint of a page in the given orientation —
 * matches dwg7/zukaku's hardcoded `viewportPxFor()` (794×1123 for A4) except
 * derived from `pageSize` instead of a fixed 210×297.
 */
export function pageSizePx(pageSize: PageSize, orientation: Orientation): PixelSize {
  const resolved = resolvePageSize(pageSize);
  const portraitWidth = Math.min(resolved.width, resolved.height);
  const portraitHeight = Math.max(resolved.width, resolved.height);
  const width = mmToPx(portraitWidth);
  const height = mmToPx(portraitHeight);
  return orientation === "landscape"
    ? { width: Math.round(height), height: Math.round(width) }
    : { width: Math.round(width), height: Math.round(height) };
}

/**
 * The offscreen staging container's pixel size for one sheet: the plain
 * page footprint, inflated per-axis by `renderScale` when present. Ported
 * from dwg7/zukaku's ADR 0009 ("zoom-level shift") —
 * `pxSize.width *= spec.renderScale.x; pxSize.height *= spec.renderScale.y;`
 * — generalized from the hardcoded A4 pixel size to `pageSize`.
 */
export function stagedPixelSize(
  pageSize: PageSize,
  orientation: Orientation,
  renderScale?: { x: number; y: number },
): PixelSize {
  const base = pageSizePx(pageSize, orientation);
  if (!renderScale) return base;
  return {
    width: base.width * renderScale.x,
    height: base.height * renderScale.y,
  };
}
