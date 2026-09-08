import { LngLatBounds } from "maplibre-gl";
import type { AtlasSheet, Orientation } from "./types";

const SOURCE_ID = "__maplibre-gl-atlas-review__";
const LINE_LAYER_ID = "__maplibre-gl-atlas-review-lines__";
const LABEL_LAYER_ID = "__maplibre-gl-atlas-review-labels__";
const PANEL_CLASS = "maplibre-gl-atlas-review-panel";

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
}

export interface ReviewPanelOptions {
  /**
   * The live map `AtlasControl` was added to. Sheets with `bounds` get an
   * outline drawn on it so the user can see *where* they're about to print,
   * not just how many. Sheets defined via `center`/`zoom` alone are listed
   * but not outlined (there's no bounding box to derive without actually
   * constructing a camera at that zoom — left for a future version).
   * Pass `undefined` to skip the map overlay entirely (e.g. the control
   * hasn't been added to a map yet).
   */
  map: ReviewMapLike | undefined;
  sheets: AtlasSheet[];
  onConfirm: (selected: AtlasSheet[]) => void;
  onCancel: () => void;
}

/**
 * The interactive "here's what's about to print — adjust before printing"
 * step `AtlasControl.review()` shows. Deliberately built from nothing but
 * `AtlasSheet`'s existing generic fields (`bounds`/`orientation`/
 * `headerLeft`/`headerRight`/`role`) — no grid/row/column concept is
 * introduced here, matching the rest of this library's design principle
 * (see CLAUDE.md, DECISIONS.md D4). See adr/0002 for why this is a
 * separate opt-in step rather than something built into `print()` itself.
 */
export class ReviewPanel {
  private readonly options: ReviewPanelOptions;
  private readonly rows: { sheet: AtlasSheet; checkbox: HTMLInputElement }[] = [];
  private readonly panel: HTMLElement;
  private readonly countEl: HTMLElement;
  private readonly confirmButton: HTMLButtonElement;
  private readonly previouslyFocused: Element | null;
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") this.cancel();
  };
  private disposed = false;

  constructor(options: ReviewPanelOptions) {
    this.options = options;
    this.previouslyFocused = document.activeElement;

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

    const list = document.createElement("ul");
    list.className = `${PANEL_CLASS}-list`;
    options.sheets.forEach((sheet, index) => {
      const item = document.createElement("li");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = true;
      checkbox.addEventListener("change", () => this.handleToggle());
      const text = document.createElement("span");
      text.className = `${PANEL_CLASS}-label`;
      text.textContent = sheetLabel(sheet, index);
      const orientation = document.createElement("span");
      orientation.className = `${PANEL_CLASS}-orientation`;
      orientation.textContent = sheetOrientation(sheet);
      label.append(checkbox, text, orientation);
      item.appendChild(label);
      list.appendChild(item);
      this.rows.push({ sheet, checkbox });
    });

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

    this.panel.append(header, list, actions);
    document.body.appendChild(this.panel);
    document.addEventListener("keydown", this.onKeyDown);

    this.addMapOverlay();
    this.handleToggle();
    this.panel.focus();
  }

  private handleToggle(): void {
    const selected = this.rows.filter((r) => r.checkbox.checked);
    this.countEl.textContent = `${selected.length} / ${this.rows.length} sheets selected`;
    this.confirmButton.textContent = `Print ${selected.length} sheet${selected.length === 1 ? "" : "s"}`;
    this.confirmButton.disabled = selected.length === 0;
    this.updateMapOverlay();
  }

  private confirm(): void {
    if (this.disposed) return;
    const selected = this.rows.filter((r) => r.checkbox.checked).map((r) => r.sheet);
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
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      paint: {
        "line-color": "#1a73e8",
        "line-width": ["case", ["get", "included"], 2.5, 1],
        "line-opacity": ["case", ["get", "included"], 1, 0.3],
      },
    });
    map.addLayer({
      id: LABEL_LAYER_ID,
      type: "symbol",
      source: SOURCE_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 14,
        "symbol-placement": "point",
      },
      paint: {
        "text-color": "#1a73e8",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
        "text-opacity": ["case", ["get", "included"], 1, 0.3],
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
    this.rows.forEach(({ sheet, checkbox }, index) => {
      const ring = boundsToRing(sheet.bounds);
      if (!ring) return;
      const center = ringCenter(ring);
      features.push({
        type: "Feature",
        properties: { included: checkbox.checked, label: sheetLabel(sheet, index) },
        geometry: { type: "Polygon", coordinates: [ring] },
      });
      features.push({
        type: "Feature",
        properties: { included: checkbox.checked, label: sheetLabel(sheet, index) },
        geometry: { type: "Point", coordinates: center },
      });
    });
    return { type: "FeatureCollection", features };
  }

  /** Removes the panel DOM, the map overlay (if any), and the Escape listener. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.panel.remove();
    document.removeEventListener("keydown", this.onKeyDown);
    const map = this.options.map;
    if (map) {
      if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
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
  width: 260px; max-height: calc(100vh - 20px); overflow-y: auto;
  background: #fff; color: #222; border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  font: 13px/1.4 system-ui, sans-serif;
  padding: 10px;
}
.${PANEL_CLASS}-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
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
`;
}
