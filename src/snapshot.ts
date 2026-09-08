import { Map as MapLibreMap, ScaleControl } from "maplibre-gl";
import type { AtlasSheet, Orientation, PageSize } from "./types";
import { stagedPixelSize } from "./render-scale";

export interface SnapshotResult {
  /** `canvas.toDataURL("image/png")` of the rendered sheet. */
  dataUrl: string;
  /** The MapLibre `ScaleControl`'s own markup, re-homed into the print footer. */
  scaleHtml: string;
  orientation: Orientation;
}

/**
 * Renders one `AtlasSheet` offscreen and returns a snapshot of it. This is
 * the single most load-bearing piece of ported logic in this project — see
 * dwg7/zukaku's `docs/index.html` `preparePrintPages()` and
 * `scripts/render/page.html`, and ADR 0002/0007/0009 for three of the four
 * bugs fixed here that must not regress:
 *
 *  1. The staging container is hidden with `position: fixed; opacity: 0;
 *     pointer-events: none`, NOT parked at a large negative offset
 *     (`left: -99999px`) — dwg7/zukaku issue #4 traced a real browser print
 *     pipeline's RGB-fringed, garbled scale-bar text specifically to an
 *     extreme off-screen offset; keeping the container near the normal
 *     document flow (just invisible) removed it.
 *  2. WebGL canvas content does not reliably survive Chromium's print-to-PDF
 *     pipeline — the canvas is snapshotted via `canvas.toDataURL("image/png")`
 *     and swapped in as a plain `<img>` by the caller (see index.ts), which
 *     the pipeline handles fine.
 *  3. `decorate()` runs inside the `load` handler, before the `idle` wait —
 *     layers/sources it adds must be present before `idle` fires so they're
 *     actually rendered into the snapshot.
 *  4. `setProjection()`/`setTerrain()` are called inside the `load` handler,
 *     never synchronously right after the constructor — maplibre-gl v6's
 *     `Style` methods call `_checkLoaded()` internally and throw `Error:
 *     Style is not done loading.` if the style hasn't finished loading yet.
 *     Found by clicking through this repo's own `docs/index.html` demo in a
 *     real browser (HANDOVER.md, 2026-09-08) — a static read of the source
 *     alone would not have caught it.
 */
export async function snapshotSheet(sheet: AtlasSheet, pageSize: PageSize): Promise<SnapshotResult> {
  const orientation: Orientation = sheet.orientation === "landscape" ? "landscape" : "portrait";
  const pxSize = stagedPixelSize(pageSize, orientation, sheet.renderScale);

  const stage = document.createElement("div");
  stage.setAttribute("aria-hidden", "true");
  stage.setAttribute("data-maplibre-gl-atlas-stage", "");
  stage.style.cssText = `position:fixed; top:0; left:0; opacity:0; pointer-events:none; width:${pxSize.width}px; height:${pxSize.height}px;`;
  document.body.appendChild(stage);

  const mapOptions: ConstructorParameters<typeof MapLibreMap>[0] = {
    container: stage,
    style: sheet.style,
    bearing: sheet.bearing ?? 0,
    pitch: sheet.pitch ?? 0,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
  };

  if (sheet.bounds) {
    mapOptions.bounds = sheet.bounds;
    mapOptions.fitBoundsOptions = { padding: sheet.padding ?? 0, animate: false };
  } else {
    mapOptions.center = sheet.center;
    mapOptions.zoom = sheet.zoom;
  }

  const pageMap = new MapLibreMap(mapOptions);
  // Scale bar only, relocated into the print footer by the caller — no
  // compass, since an atlas control has no opinion on whether rotation is
  // locked; that's a caller-level concern (see README).
  pageMap.addControl(new ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");

  try {
    await new Promise<void>((resolve, reject) => {
      pageMap.on("error", (e) => reject((e as { error?: unknown }).error ?? e));
      pageMap.on("load", () => {
        // ADR 0004 (dwg7/zukaku): mercator only, never globe — an atlas
        // depends on an orthogonal top-down page, same reasoning that rules
        // out terrain below. maplibre-gl v6 has no constructor-time
        // `projection` option; `setProjection()` is the supported way to
        // force it regardless of what the style itself declares. It must be
        // called after `load` — calling it synchronously right after the
        // constructor throws "Style is not done loading."
        pageMap.setProjection({ type: "mercator" });
        if (!sheet.terrain) {
          pageMap.setTerrain(null);
        }
        Promise.resolve(sheet.decorate?.(pageMap))
          .then(() => {
            pageMap.once("idle", () => resolve());
          })
          .catch(reject);
      });
    });

    const dataUrl = pageMap.getCanvas().toDataURL("image/png");
    const scaleEl = pageMap.getContainer().querySelector(".maplibregl-ctrl-scale");
    const scaleHtml = scaleEl ? scaleEl.outerHTML : "";

    return { dataUrl, scaleHtml, orientation };
  } finally {
    pageMap.remove(); // free the WebGL context before the next sheet
    stage.remove();
  }
}
