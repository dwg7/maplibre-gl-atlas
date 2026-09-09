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

const map = new Map({ container: "map", style: "https://stars.optgeo.org/style/positron", center: [0, 0], zoom: 2 });

map.addControl(
  new AtlasControl({
    sheets: () => [
      {
        role: "index",
        style: "https://stars.optgeo.org/style/positron",
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
        style: "https://stars.optgeo.org/style/positron",
        bounds: [
          [-10, 45],
          [0, 55],
        ],
        headerLeft: "My Atlas",
        headerRight: "A1",
      },
      {
        role: "detail",
        style: "https://stars.optgeo.org/style/positron",
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

Clicking the control's print button opens an interactive **review panel**
first: a small circular ×/+ toggle button anchored to each sheet directly on
the live map (for sheets with `bounds` or `center`), so you can drop any of
them before printing — plus a compact panel showing the selected count and
Print/Cancel. (A caller with no `map` reference falls back to a checkbox
list.) This is what most users need: they decide what actually gets printed,
not just how many pages a caller pre-computed. Set `confirm: false` if your
own UI already lets people choose what to print and this step would be
redundant — the button then calls `print()` directly, same as before. Calling
`atlasControl.print()`/`.prepare()` yourself (e.g. from your own UI with
`showButton: false`, or headlessly via Playwright) never shows the review
panel either way — see [adr/0002](adr/0002-print-review-step.md). Both build
the print DOM and (for `print()`) open the browser's print dialog. See
[`examples/basic/index.html`](examples/basic/index.html) for a complete,
runnable page (3 detail sheets + 1 index sheet, no build step, no API key —
it uses [stars.optgeo.org](https://stars.optgeo.org)'s `positron` style, the
same global OSM-planet style [dwg7/zukaku](https://github.com/dwg7/zukaku)
offers). A live version of this same example is published at
[dwg7.unopengis.org/maplibre-gl-atlas](https://dwg7.unopengis.org/maplibre-gl-atlas/)
via [docs/index.html](docs/index.html).

## API

```ts
class AtlasControl implements IControl {
  constructor(options: AtlasControlOptions);
  onAdd(map: MapLibreMap): HTMLElement;
  onRemove(): void;
  review(): Promise<void>;  // show the review panel; prints the user-confirmed subset, or nothing on cancel
  print(): Promise<void>;   // build the print DOM, then window.print() — never shows the review panel
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
  confirm?: boolean;         // default true — button opens review() instead of calling print() directly
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

[CC0 1.0 Universal](LICENSE) (public domain dedication) — matching
[dwg7/zukaku](https://github.com/dwg7/zukaku), the project this library was
extracted from. See [DECISIONS.md](DECISIONS.md) D3/D5 for why this differs
from most MapLibre plugins, which use MIT.
