import type { Margin, MarginInput, PageSize } from "./types";

export const DEFAULT_PAGE_SIZE: PageSize = { width: 210, height: 297 };
export const DEFAULT_MARGIN_MM = 15;

export function resolvePageSize(pageSize?: PageSize): PageSize {
  return pageSize ?? DEFAULT_PAGE_SIZE;
}

/** Normalizes a uniform-number-or-per-side `margin` option into all four sides. */
export function resolveMargin(margin?: MarginInput): Margin {
  if (margin == null) {
    return { top: DEFAULT_MARGIN_MM, right: DEFAULT_MARGIN_MM, bottom: DEFAULT_MARGIN_MM, left: DEFAULT_MARGIN_MM };
  }
  if (typeof margin === "number") {
    return { top: margin, right: margin, bottom: margin, left: margin };
  }
  return {
    top: margin.top ?? DEFAULT_MARGIN_MM,
    right: margin.right ?? DEFAULT_MARGIN_MM,
    bottom: margin.bottom ?? DEFAULT_MARGIN_MM,
    left: margin.left ?? DEFAULT_MARGIN_MM,
  };
}

/**
 * Structural CSS that doesn't depend on `pageSize`/`margin` — the
 * `#print-root` visibility toggle and the base `@media print` skeleton
 * (`.print-page` sizing itself comes from strategy.ts's per-job CSS).
 * Ported from dwg7/zukaku's `docs/index.html` print CSS (ADR 0007).
 */
export function generateBaseCss(): string {
  return `
#maplibre-gl-atlas-print-root { display: none; }
@media print {
  body > *:not(#maplibre-gl-atlas-print-root) { display: none !important; }
  #maplibre-gl-atlas-print-root { display: block; }
  #maplibre-gl-atlas-print-root .print-page {
    position: relative;
    box-sizing: border-box;
    break-after: page;
    overflow: hidden;
  }
}
`;
}

/**
 * Header/footer/neatline band layout, generalized from dwg7/zukaku's
 * hardcoded 15mm-everywhere print CSS (ADR 0007/0009) to `pageSize`/`margin`
 * runtime options. The header and footer bands are as tall as the top/bottom
 * margin respectively; their font sizes keep the same ratio zukaku's fixed
 * numbers had (15mm margin → 5mm brand/ref text, 3mm scale-bar text), so the
 * default options reproduce zukaku's exact pixel output.
 *
 * `object-fit: contain` (not `fill`) on the snapshot `<img>` is load-bearing,
 * not cosmetic — see dwg7/zukaku's ADR 0009 addendum (issue #7): a
 * `renderScale`d sheet's offscreen canvas only shares this box's aspect
 * ratio when `renderScale.x === renderScale.y`; `fill` would visibly warp
 * the map for any other grid shape, `contain` letterboxes instead.
 */
export function generateLayoutCss(margin?: MarginInput): string {
  const m = resolveMargin(margin);
  const brandFontMm = m.top / 3;
  const refFontMm = m.top / 3;
  const scaleFontMm = m.bottom / 5;

  return `
@media print {
  #maplibre-gl-atlas-print-root .print-page-inner .print-map {
    position: absolute;
    top: ${m.top}mm; left: ${m.left}mm; right: ${m.right}mm; bottom: ${m.bottom}mm;
    box-sizing: border-box;
    border: 0.75pt solid #000;
    overflow: hidden;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-map img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-header {
    position: absolute;
    top: 0; left: ${m.left}mm; right: ${m.right}mm; height: ${m.top}mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-brand { font: bold ${brandFontMm}mm/1 sans-serif; color: #222; }
  #maplibre-gl-atlas-print-root .print-page-inner .print-ref { font: bold ${refFontMm}mm/1 sans-serif; color: #222; text-align: right; }
  #maplibre-gl-atlas-print-root .print-page-inner .print-footer {
    position: absolute;
    bottom: 0; left: ${m.left}mm; right: ${m.right}mm; height: ${m.bottom}mm;
    display: flex;
    align-items: center;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-footer .maplibregl-ctrl-scale { margin: 0; font-size: ${scaleFontMm}mm; }
}
`;
}
