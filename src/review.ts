import { LngLatBounds } from "maplibre-gl";
import type { AtlasSheet, Orientation } from "./types";

const SOURCE_ID = "__maplibre-gl-atlas-review__";
const FILL_LAYER_ID = "__maplibre-gl-atlas-review-fill__";
const LINE_LAYER_ID = "__maplibre-gl-atlas-review-lines__";
const PANEL_CLASS = "maplibre-gl-atlas-review-panel";
const TOGGLE_CLASS = "maplibre-gl-atlas-review-toggle";

/**
 * The narrow slice of MapLibre's `Map` this module actually calls — kept as
 * its own interface (rather than depending on `maplibre-gl`'s `Map` type
 * directly) so tests can pass a plain mock instead of a real WebGL-backed
 * instance, matching this project's existing "no real MapLibre map in
 * Vitest" policy (see snapshot.ts's own tests, which are deliberately
 * absent for the same reason).
 */
export interface ReviewMapLike {
  addSource(id: string, source: unknown): unknown;
  removeSource(id: string): unknown;
  getSource(id: string): unknown;
  addLayer(layer: unknown): unknown;
  removeLayer(id: string): unknown;
  getLayer(id: string): unknown;
  project(lngLat: [number, number]): { x: number; y: number };
  getContainer(): HTMLElement;
  on(type: string, listener: () => void): unknown;
  off(type: string, listener: () => void): unknown;
}

export interface ReviewPanelOptions {
  /**
   * The live map `AtlasControl` was added to. Sheets get a small circular
   * ×/+ toggle button anchored directly over them (bounds center, or the
   * sheet's own `center` when there's no bounds) — the same interaction
   * dwg7/zukaku's Save Paper feature uses (ADR 0008): click the button to
   * drop a sheet, click again to bring it back, no separate list to
   * cross-reference. Pass `undefined` to skip the map overlay (e.g. the
   * control hasn't been added to a map yet) — falls back to a plain
   * checkbox list so the panel still functions without one.
   */
  map: ReviewMapLike | undefined;
  sheets: AtlasSheet[];
  onConfirm: (selected: AtlasSheet[]) => void;
  onCancel: () => void;
}

interface Row {
  sheet: AtlasSheet;
  included: boolean;
  checkbox?: HTMLInputElement; // fallback path only (no map)
  toggleEl?: HTMLButtonElement; // map-anchored path
  anchor?: [number, number]; // lng/lat this row's toggle tracks
}

/**
 * The interactive "here's what's about to print — adjust before printing"
 * step `AtlasControl.review()` shows. Deliberately built from nothing but
 * `AtlasSheet`'s existing generic fields (`bounds`/`center`/`orientation`/
 * `headerLeft`/`headerRight`/`role`) — no grid/row/column concept is
 * introduced here, matching the rest of this library's design principle
 * (see CLAUDE.md, DECISIONS.md D4). See adr/0002 for why this is a
 * separate opt-in step rather than something built into `print()` itself,
 * and its 2026-09-09 addendum for why selection happens via on-map toggle
 * buttons (mirroring dwg7/zukaku's Save Paper) rather than a checkbox list.
 */
export class ReviewPanel {
  private readonly options: ReviewPanelOptions;
  private readonly rows: Row[] = [];
  private readonly panel: HTMLElement;
  private readonly countEl: HTMLElement;
  private readonly confirmButton: HTMLButtonElement;
  private readonly previouslyFocused: Element | null;
  private readonly hasMap: boolean;
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.cancel();
  };
  private readonly repositionToggles = (): void => {
    const map = this.options.map;
    if (!map) return;
    const containerRect = map.getContainer().getBoundingClientRect();
    for (const row of this.rows) {
      if (!row.toggleEl || !row.anchor) continue;
      const p = map.project(row.anchor);
      row.toggleEl.style.left = `${containerRect.left + p.x}px`;
      row.toggleEl.style.top = `${containerRect.top + p.y}px`;
    }
  };
  private disposed = false;

  constructor(options: ReviewPanelOptions) {
    this.options = options;
    this.hasMap = !!options.map;
    this.previouslyFocused = document.activeElement;

    options.sheets.forEach((sheet) => {
      const ring = boundsToRing(sheet.bounds);
      const anchor = ring ? ringCenter(ring) : sheet.center;
      this.rows.push({ sheet, included: true, anchor });
    });

    this.panel = document.createElement("div");
    this.panel.className = PANEL_CLASS;
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-label", "Review atlas before printing");
    this.panel.setAttribute("tabindex", "-1");

    const header = document.createElement("div");
    header.className = `${PANEL_CLASS}-header`;
    const title = document.createElement("strong");
    title.textContent = "Review atlas";
    this.countEl = document.createElement("span");
    this.countEl.className = `${PANEL_CLASS}-count`;
    header.append(title, this.countEl);

    const actions = document.createElement("div");
    actions.className = `${PANEL_CLASS}-actions`;
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = `${PANEL_CLASS}-cancel`;
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", () => this.cancel());
    this.confirmButton = document.createElement("button");
    this.confirmButton.type = "button";
    this.confirmButton.className = `${PANEL_CLASS}-confirm`;
    this.confirmButton.addEventListener("click", () => this.confirm());
    actions.append(cancelButton, this.confirmButton);

    if (this.hasMap) {
      // The map itself is the only selection surface — no redundant list to
      // keep in sync with it (the previous checkbox-list design this
      // replaces required looking at two places at once).
      this.panel.append(header, actions);
      this.buildMapToggles();
      this.addMapOverlay();
      this.options.map?.on("move", this.repositionToggles);
      this.options.map?.on("resize", this.repositionToggles);
      this.repositionToggles();
    } else {
      // No map to anchor buttons to (e.g. review() called before the
      // control was added to one) — a plain checkbox list still lets the
      // panel work, just without the on-map preview.
      const list = document.createElement("ul");
      list.className = `${PANEL_CLASS}-list`;
      this.rows.forEach((row, index) => {
        const item = document.createElement("li");
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true;
        checkbox.addEventListener("change", () => {
          row.included = checkbox.checked;
          this.handleToggle();
        });
        const text = document.createElement("span");
        text.className = `${PANEL_CLASS}-label`;
        text.textContent = sheetLabel(row.sheet, index);
        const orientation = document.createElement("span");
        orientation.className = `${PANEL_CLASS}-orientation`;
        orientation.textContent = sheetOrientation(row.sheet);
        label.append(checkbox, text, orientation);
        item.appendChild(label);
        list.appendChild(item);
        row.checkbox = checkbox;
      });
      this.panel.append(header, list, actions);
    }

    document.body.appendChild(this.panel);
    document.addEventListener("keydown", this.onKeyDown);

    this.handleToggle();
    this.panel.focus();
  }

  private buildMapToggles(): void {
    this.rows.forEach((row) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = TOGGLE_CLASS;
      this.paintToggle(button, row.included);
      button.addEventListener("click", () => {
        row.included = !row.included;
        this.paintToggle(button, row.included);
        this.handleToggle();
      });
      document.body.appendChild(button);
      row.toggleEl = button;
    });
  }

  private paintToggle(button: HTMLButtonElement, included: boolean): void {
    button.textContent = included ? "×" : "+";
    button.title = included ? "Exclude this sheet from printing" : "Include this sheet in printing";
    button.setAttribute("aria-label", button.title);
    button.classList.toggle(`${TOGGLE_CLASS}-excluded`, !included);
  }

  private handleToggle(): void {
    const selected = this.rows.filter((r) => r.included);
    this.countEl.textContent = `${selected.length} / ${this.rows.length} sheets selected`;
    this.confirmButton.textContent = `Print ${selected.length} sheet${selected.length === 1 ? "" : "s"}`;
    this.confirmButton.disabled = selected.length === 0;
    this.updateMapOverlay();
  }

  private confirm(): void {
    if (this.disposed) return;
    const selected = this.rows.filter((r) => r.included).map((r) => r.sheet);
    this.dispose();
    this.options.onConfirm(selected);
  }

  private cancel(): void {
    if (this.disposed) return;
    this.dispose();
    this.options.onCancel();
  }

  private addMapOverlay(): void {
    const map = this.options.map;
    if (!map) return;
    map.addSource(SOURCE_ID, { type: "geojson", data: this.overlayGeoJson() });
    // Grey fill on an excluded sheet — same visual language as dwg7/zukaku's
    // Save Paper (ADR 0008): the outline stays, a grey wash says "omitted".
    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      paint: {
        "fill-color": "#000",
        "fill-opacity": ["case", ["get", "included"], 0, 0.35],
      },
    });
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#1a73e8",
        "line-width": ["case", ["get", "included"], 2.5, 1],
        "line-opacity": ["case", ["get", "included"], 1, 0.5],
      },
    });
  }

  private updateMapOverlay(): void {
    const map = this.options.map;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as { setData?: (data: unknown) => void } | undefined;
    source?.setData?.(this.overlayGeoJson());
  }

  private overlayGeoJson(): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];
    this.rows.forEach((row) => {
      const ring = boundsToRing(row.sheet.bounds);
      if (!ring) return; // center/zoom-only sheets get a toggle button but no fill/outline to draw
      features.push({
        type: "Feature",
        properties: { included: row.included },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
    });
    return { type: "FeatureCollection", features };
  }

  /** Removes the panel DOM, on-map toggles/layers, and event listeners. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.panel.remove();
    document.removeEventListener("keydown", this.onKeyDown);
    for (const row of this.rows) {
      row.toggleEl?.remove();
    }
    const map = this.options.map;
    if (map) {
      map.off("move", this.repositionToggles);
      map.off("resize", this.repositionToggles);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    }
    if (this.previouslyFocused instanceof HTMLElement) this.previouslyFocused.focus();
  }
}

function sheetOrientation(sheet: AtlasSheet): Orientation {
  return sheet.orientation === "landscape" ? "landscape" : "portrait";
}

function sheetLabel(sheet: AtlasSheet, index: number): string {
  const parts = [sheet.headerLeft, sheet.headerRight].filter((s): s is string => !!s);
  if (parts.length) return parts.join(" — ");
  if (sheet.role) return `${sheet.role} ${index + 1}`;
  return `Sheet ${index + 1}`;
}

/** Normalizes any `AtlasSheet.bounds` shape into a closed 5-point ring, or `null` if there's no `bounds` to draw. */
function boundsToRing(bounds: AtlasSheet["bounds"]): [number, number][] | null {
  if (!bounds) return null;
  const b = LngLatBounds.convert(bounds);
  const w = b.getWest();
  const s = b.getSouth();
  const e = b.getEast();
  const n = b.getNorth();
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
    [w, n],
  ];
}

function ringCenter(ring: [number, number][]): [number, number] {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}

/**
 * CSS for the review panel — injected alongside the print layout CSS when
 * `injectStyles` is true (see index.ts). Deliberately screen-only, not
 * `@media print` — the panel is never meant to appear in the printed output
 * itself (it's disposed before `print()` ever builds the print DOM).
 */
export function generateReviewCss(): string {
  return `
.${PANEL_CLASS} {
  position: fixed; top: 10px; right: 10px; z-index: 10;
  width: 220px; max-height: calc(100vh - 20px); overflow-y: auto;
  background: #fff; color: #222; border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  font: 13px/1.4 system-ui, sans-serif;
  padding: 10px;
}
.${PANEL_CLASS}-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.${PANEL_CLASS}-count { color: #555; font-size: 12px; }
.${PANEL_CLASS}-list { list-style: none; margin: 0 0 10px; padding: 0; }
.${PANEL_CLASS}-list li { border-bottom: 1px solid #eee; }
.${PANEL_CLASS}-list label { display: flex; align-items: center; gap: 6px; padding: 6px 2px; cursor: pointer; }
.${PANEL_CLASS}-label { flex: 1; }
.${PANEL_CLASS}-orientation { color: #888; font-size: 11px; }
.${PANEL_CLASS}-actions { display: flex; justify-content: flex-end; gap: 8px; }
.${PANEL_CLASS}-actions button { font: inherit; padding: 6px 12px; border-radius: 4px; border: 1px solid #ccc; background: #f5f5f5; cursor: pointer; }
.${PANEL_CLASS}-confirm { background: #1a73e8; border-color: #1a73e8; color: #fff; }
.${PANEL_CLASS}-confirm:disabled { background: #9ec1f2; border-color: #9ec1f2; cursor: not-allowed; }

/* On-map toggle button — a circle with ×/+, anchored over each sheet's
   center (dwg7/zukaku's Save Paper cell-toggle, ADR 0008). Positioned via
   left/top set in JS (repositionToggles), tracking the map's own pan/zoom. */
.${TOGGLE_CLASS} {
  position: fixed; transform: translate(-50%, -50%);
  z-index: 11; width: 26px; height: 26px; border-radius: 50%;
  border: 1px solid rgba(0,0,0,0.5); background: rgba(255,255,255,0.92);
  font: bold 15px/24px system-ui, sans-serif; text-align: center; color: #333;
  cursor: pointer; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.${TOGGLE_CLASS}-excluded { background: rgba(255,255,255,0.6); color: #666; }
`;
}
