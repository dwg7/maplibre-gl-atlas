import type { Orientation, PageSize, PrintStrategy, PrintStrategyOption } from "./types";
import { resolvePageSize } from "./layout";

/**
 * Ported as-is from dwg7/zukaku's `docs/index.html` (ADR 0007's addendum,
 * 2026-08-31): `navigator.userAgentData.platform` first, falling back to a
 * `navigator.userAgent` regex on browsers that don't implement User-Agent
 * Client Hints. Accepts an optional `nav` override purely so tests can pass
 * a fake navigator without mutating the jsdom global.
 */
export function isLikelyWindows(nav?: Navigator): boolean {
  const navigator_ = nav ?? (typeof navigator !== "undefined" ? navigator : undefined);
  if (!navigator_) return false;
  const uaData = (navigator_ as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (uaData && uaData.platform) {
    return uaData.platform === "Windows";
  }
  return /Windows/i.test(navigator_.userAgent || "");
}

/**
 * `"rotate"` on Windows, `"mixed"` everywhere else. See adr/0001 and
 * dwg7/zukaku's ADR 0007: Windows print drivers (e.g. "Microsoft Print to
 * PDF") are known to mishandle a per-page `@page` orientation switch inside
 * one print job, so a single physical page + CSS-rotated minority-orientation
 * content sidesteps the driver entirely there, while other platforms keep
 * the simpler, already-correct per-page `@page` behavior unchanged.
 */
export function choosePrintStrategy(): PrintStrategy {
  return isLikelyWindows() ? "rotate" : "mixed";
}

/** Resolves an `AtlasControlOptions.strategy` value, defaulting `"auto"` to `choosePrintStrategy()`. */
export function resolveStrategy(strategy?: PrintStrategyOption): PrintStrategy {
  if (!strategy || strategy === "auto") return choosePrintStrategy();
  return strategy;
}

/**
 * Majority vote across all sheets' orientations, ties going to portrait —
 * ported from dwg7/zukaku's `preparePrintPages()`
 * (`landscapeCount > pages.length - landscapeCount ? "landscape" : "portrait"`).
 * Only meaningful for the `"rotate"` strategy, which needs exactly one
 * physical `@page` for the whole job.
 */
export function computeBaseOrientation(orientations: Orientation[]): Orientation {
  const landscapeCount = orientations.filter((o) => o === "landscape").length;
  return landscapeCount > orientations.length - landscapeCount ? "landscape" : "portrait";
}

function portraitDimsMm(pageSize: PageSize): { width: number; height: number } {
  return {
    width: Math.min(pageSize.width, pageSize.height),
    height: Math.max(pageSize.width, pageSize.height),
  };
}

/**
 * Generates the named `@page` rules and `.print-page`/`.print-page-inner`
 * sizing CSS for one strategy, parameterized by `pageSize` (unlike zukaku's
 * hardcoded 210mm/297mm — see DECISIONS.md D3). This must be regenerated
 * per print job (not a static stylesheet) whenever `pageSize` changes —
 * though not because of `baseOrientation`: like dwg7/zukaku's static CSS,
 * both the `.base-portrait` and `.base-landscape` rule sets are always
 * emitted unconditionally; which one actually applies is decided at print
 * time by which class name `index.ts` puts on `#print-root`, computed from
 * the actual sheets being printed (`computeBaseOrientation()` below).
 *
 * Mirrors dwg7/zukaku's `docs/index.html` print CSS (ADR 0007) line for
 * line, generalizing only the page dimensions:
 *   - `"mixed"`: each `.print-page` carries its own `@page` — unchanged
 *     macOS/Linux/non-Windows behavior.
 *   - `"rotate"`: the whole job shares one physical `@page`
 *     (`baseOrientation`); a `.print-page-inner` whose own orientation
 *     disagrees gets the `rotated` class, positioned via
 *     `transform: rotate(90deg)` around its top-left corner after being
 *     offset by the base page's own width — see ADR 0007's addendum for the
 *     rotation-matrix derivation of the `left: <baseWidth>` offset.
 */
export function generateStrategyCss(pageSize: PageSize, strategy: PrintStrategy): string {
  const { width: w, height: h } = portraitDimsMm(resolvePageSize(pageSize));

  if (strategy === "mixed") {
    return `
@page atlas-portrait { size: ${w}mm ${h}mm; margin: 0; }
@page atlas-landscape { size: ${h}mm ${w}mm; margin: 0; }
@media print {
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page.portrait-page { page: atlas-portrait; width: ${w}mm; height: ${h}mm; }
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page.landscape-page { page: atlas-landscape; width: ${h}mm; height: ${w}mm; }
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page-inner { position: absolute; inset: 0; }
}
`;
  }

  return `
@page atlas-base-portrait { size: ${w}mm ${h}mm; margin: 0; }
@page atlas-base-landscape { size: ${h}mm ${w}mm; margin: 0; }
@media print {
  #maplibre-gl-atlas-print-root.strategy-rotate.base-portrait .print-page { page: atlas-base-portrait; width: ${w}mm; height: ${h}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-landscape .print-page { page: atlas-base-landscape; width: ${h}mm; height: ${w}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner.portrait-page { width: ${w}mm; height: ${h}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner.landscape-page { width: ${h}mm; height: ${w}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner:not(.rotated) { position: absolute; top: 0; left: 0; }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-portrait .print-page-inner.rotated {
    position: absolute; top: 0; left: ${w}mm;
    transform-origin: 0 0; transform: rotate(90deg);
  }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-landscape .print-page-inner.rotated {
    position: absolute; top: 0; left: ${h}mm;
    transform-origin: 0 0; transform: rotate(90deg);
  }
}
`;
}
