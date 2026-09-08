# @dwg7/maplibre-gl-atlas

A [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/) control that drives
the **browser's native `window.print()`** pipeline to produce a print-ready,
multi-sheet **atlas** — a sequence of map "sheets" laid out with CSS named
`@page` rules, mixing portrait and landscape, with an optional index/overview
sheet up front.

## Why not jsPDF?

Existing MapLibre print plugins
([`@watergis/maplibre-gl-export`](https://www.npmjs.com/package/@watergis/maplibre-gl-export),
[`opengeos/maplibre-gl-components`](https://github.com/opengeos/maplibre-gl-components)'s
PrintControl) all do the same thing: snapshot the *current view* to a canvas
and hand it to [jsPDF](https://github.com/parallax/jsPDF) to assemble a
single-page PDF file for download.

This library does something different: it builds a real, multi-page
**print job** — several sheets, mixed orientations, a shared print-margin
layout — and hands it to the browser's own print pipeline
(`window.print()`), the same pipeline "Save as PDF" and physical printers
already use. No PDF-encoding library is bundled; page geometry, fonts, and
rasterization are the browser's job. If you just need "export the current
view as a PDF," reach for one of the plugins above instead — this one is for
when you're printing an **atlas**, not a screenshot. See
[adr/0001](adr/0001-window-print-not-jspdf.md) for the full rationale, which
traces back to [dwg7/zukaku](https://github.com/dwg7/zukaku)'s "Print in
Browser" feature this library was extracted from.

## Install

```bash
npm install @dwg7/maplibre-gl-atlas maplibre-gl
```

`maplibre-gl` is a peer dependency — bring your own version (v6.x).

## Usage

```ts
import { Map } from "maplibre-gl";
import { AtlasControl } from "@dwg7/maplibre-gl-atlas";

const map = new Map({ container: "map", style: "https://demotiles.maplibre.org/style.json", center: [0, 0], zoom: 2 });

map.addControl(
  new AtlasControl({
    sheets: () => [
      {
        role: "index",
        style: "https://demotiles.maplibre.org/style.json",
        bounds: [
          [-10, 45],
          [10, 55],
        ],
        headerLeft: "My Atlas",
        headerRight: "Index",
        renderScale: { x: 2, y: 1 }, // e.g. this index covers 2 detail sheets side by side
        decorate: (map) => {
          // Draw your own grid overlay / index labels here — this hook has
          // no restrictions, and the control has no opinion on what a
          // "grid" is. See dwg7/zukaku's addOverviewGridLayers() for a
          // real example this hook was generalized from.
        },
      },
      {
        role: "detail",
        style: "https://demotiles.maplibre.org/style.json",
        bounds: [
          [-10, 45],
          [0, 55],
        ],
        headerLeft: "My Atlas",
        headerRight: "A1",
      },
      {
        role: "detail",
        style: "https://demotiles.maplibre.org/style.json",
        bounds: [
          [0, 45],
          [10, 55],
        ],
        headerLeft: "My Atlas",
        headerRight: "A2",
      },
    ],
  }),
);
```

Clicking the control's print button (or calling `atlasControl.print()`
yourself, e.g. from your own UI with `showButton: false`) builds the print
DOM and opens the browser's print dialog. See
[`examples/basic/index.html`](examples/basic/index.html) for a complete,
runnable page (3 detail sheets + 1 index sheet, no build step, no API key —
it uses MapLibre's own public demo style).

## API

```ts
class AtlasControl implements IControl {
  constructor(options: AtlasControlOptions);
  onAdd(map: MapLibreMap): HTMLElement;
  onRemove(): void;
  print(): Promise<void>;   // build the print DOM, then window.print()
  prepare(): Promise<void>; // build the print DOM only — for driving via Playwright's page.pdf() instead
  cleanup(): void;
}

function isLikelyWindows(): boolean;
function choosePrintStrategy(): "mixed" | "rotate";

interface AtlasControlOptions {
  sheets: () => AtlasSheet[] | Promise<AtlasSheet[]>;
  pageSize?: { width: number; height: number };   // mm, default A4 { width: 210, height: 297 }
  margin?: number | { top: number; right: number; bottom: number; left: number }; // mm, default 15
  strategy?: "auto" | "mixed" | "rotate"; // default "auto"
  showButton?: boolean;      // default true
  injectStyles?: boolean;    // default true
  onBeforePrint?: () => void | Promise<void>;
  onAfterPrint?: () => void | Promise<void>;
  onError?: (err: unknown) => void;
}

interface AtlasSheet {
  style: string | StyleSpecification;
  bounds?: LngLatBoundsLike;
  center?: [number, number]; zoom?: number;
  padding?: number | { top: number; right: number; bottom: number; left: number };
  bearing?: number;   // default 0 — fully supported, orthographic rotation only
  pitch?: number;     // default 0 — see warning below
  terrain?: boolean;  // default false -> map.setTerrain(null)
  orientation?: "portrait" | "landscape"; // default "portrait"
  renderScale?: { x: number; y: number };
  role?: "detail" | "index";  // pure annotation, does not affect control behavior
  headerLeft?: string; headerRight?: string;
  footer?: "scale" | false; // default "scale"
  decorate?: (map: MapLibreMap) => void | Promise<void>;
  className?: string;
}
```

### `bearing` and `pitch`

`bearing` is fully supported — MapLibre's bearing is an orthographic,
top-down screen rotation, so it doesn't conflict with the orthogonal-page
assumption an atlas depends on.

`pitch` is different: it introduces a perspective projection, so a sheet's
scale is no longer uniform across its own area, and its edges won't line up
with a neighboring sheet's. If you print more than one sheet and any of them
has a non-zero `pitch`, `AtlasControl` logs a single `console.warn` — it does
not block printing. Reserve `pitch` for a standalone sheet not meant to sit
edge-to-edge with others (a decorative cover page, say).

## Browser compatibility

This control's print layout depends on CSS named `@page` rules, which are
**effectively Chromium-only** today:

| Browser | `@page` size/margin | Mixed orientations in one job |
|---|---|---|
| Chromium-based (Chrome, Edge, Brave, …) | Stable | Verified working |
| Firefox | Honored in print preview, but **not in the saved PDF** ([mdn/browser-compat-data#22946](https://github.com/mdn/browser-compat-data/issues/22946)) | Not usable in practice |
| Safari | `@page` size/margin ignored in both preview and output; iPadOS ignores margin even with experimental flags on | Not usable |

The map imagery itself (`canvas.toDataURL()` snapshots) is browser-agnostic,
but the print layout (page size, margins, mixed orientation) will not come
out correctly outside Chromium-based browsers.

## What this is not

- **Not a jsPDF-based single-view exporter.** See "Why not jsPDF?" above.
- **Not a grid/tiling calculator.** This control has no concept of rows,
  columns, or how to split a region into cells — it only knows about a flat
  list of `AtlasSheet`s. That computation lives entirely in the caller (see
  [CLAUDE.md](CLAUDE.md)).
- **Not an N-up imposition tool.** Placing multiple atlases onto one
  physical sheet is out of scope.

## Docs

- [CLAUDE.md](CLAUDE.md) — scope (what v1 includes, and what stays out
  forever)
- [HANDOVER.md](HANDOVER.md) — current state, what's next
- [DECISIONS.md](DECISIONS.md) — index of design decisions
- [adr/](adr/) — full decision records

## License

MIT — see [LICENSE](LICENSE).
