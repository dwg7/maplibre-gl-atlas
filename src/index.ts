import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import { generateBaseCss, generateLayoutCss, resolvePageSize } from "./layout";
import { computeBaseOrientation, generateStrategyCss, resolveStrategy } from "./strategy";
import { snapshotSheet } from "./snapshot";
import { ReviewPanel, generateReviewCss } from "./review";
import type { AtlasControlOptions, AtlasSheet, Orientation, PrintStrategy } from "./types";

export type {
  AtlasControlOptions,
  AtlasSheet,
  Margin,
  MarginInput,
  Millimeters,
  Orientation,
  PageSize,
  PrintStrategy,
  PrintStrategyOption,
} from "./types";
export { isLikelyWindows, choosePrintStrategy } from "./strategy";
export { ReviewPanel } from "./review";
export type { ReviewMapLike, ReviewPanelOptions } from "./review";

const PRINT_ROOT_ID = "maplibre-gl-atlas-print-root";

interface ResolvedOptions extends AtlasControlOptions {
  pageSize: NonNullable<AtlasControlOptions["pageSize"]>;
  margin: NonNullable<AtlasControlOptions["margin"]>;
  strategy: NonNullable<AtlasControlOptions["strategy"]>;
  showButton: boolean;
  confirm: boolean;
  injectStyles: boolean;
}

/**
 * A `map.addControl()`-style MapLibre GL JS control that drives the
 * browser's native `window.print()` pipeline to produce a print-ready,
 * multi-sheet map atlas — CSS named `@page` rules mixing portrait/landscape
 * sheets in one job, plus an offscreen-snapshot technique per sheet. See the
 * README for how this differs from jsPDF-based single-view exporters, and
 * adr/0001 for the full rationale.
 */
export class AtlasControl implements IControl {
  private readonly options: ResolvedOptions;
  private map?: MapLibreMap;
  private container?: HTMLElement;
  private printRoot?: HTMLElement;
  private styleEl?: HTMLStyleElement;
  private activeReview?: ReviewPanel;

  constructor(options: AtlasControlOptions) {
    if (typeof document === "undefined") {
      throw new Error(
        "AtlasControl requires a DOM (`document` is undefined) — it cannot be constructed outside a browser.",
      );
    }
    if (!options || typeof options.sheets !== "function") {
      throw new Error("AtlasControl requires `options.sheets: () => AtlasSheet[] | Promise<AtlasSheet[]>`.");
    }

    this.options = {
      ...options,
      pageSize: resolvePageSize(options.pageSize),
      margin: options.margin ?? 15,
      strategy: options.strategy ?? "auto",
      showButton: options.showButton ?? true,
      confirm: options.confirm ?? true,
      injectStyles: options.injectStyles ?? true,
    };
  }

  // Sheets themselves are always rendered via their own offscreen MapLibre
  // instance (snapshot.ts), independent of this map — but review() draws
  // sheet-bounds outlines onto it, so (unlike before the review feature)
  // the control now needs to hold onto it.
  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map;
    // Injected here (not just inside buildPrintDom) so review()'s panel is
    // already styled the first time it opens — buildPrintDom's own call is
    // still there too (idempotent) since the strategy/pageSize/margin CSS
    // genuinely belongs to the print job, not the control's lifecycle.
    if (this.options.injectStyles) {
      this.injectStyles(resolveStrategy(this.options.strategy));
    }

    const container = document.createElement("div");
    container.className = "maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-atlas-ctrl";

    if (this.options.showButton) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "maplibre-gl-atlas-ctrl-button";
      button.title = "Print atlas";
      button.setAttribute("aria-label", "Print atlas");
      button.textContent = "🖨";
      button.addEventListener("click", () => {
        const action = this.options.confirm ? this.review() : this.print();
        action.catch((err) => this.handleError(err));
      });
      container.appendChild(button);
    }

    this.container = container;
    return container;
  }

  onRemove(): void {
    this.activeReview?.dispose();
    this.activeReview = undefined;
    this.container?.remove();
    this.container = undefined;
    this.cleanup();
    this.styleEl?.remove();
    this.styleEl = undefined;
    this.map = undefined;
  }

  /**
   * Shows the interactive review panel: how many sheets, where each one is
   * (outlined on the live map, for sheets with `bounds`), with a checkbox
   * per sheet to deselect it before printing. Resolves once the user either
   * confirms (after which the selected subset is printed, same as calling
   * `print()` with that subset) or cancels (nothing is printed). This is
   * what the built-in button calls by default (`confirm: true`) — see
   * adr/0002 for why `print()`/`prepare()` themselves never show this.
   */
  async review(): Promise<void> {
    this.activeReview?.dispose();
    const sheets = await this.options.sheets();
    await new Promise<void>((resolve, reject) => {
      this.activeReview = new ReviewPanel({
        map: this.map,
        sheets,
        onConfirm: (selected) => {
          this.activeReview = undefined;
          this.printSheets(selected).then(resolve, reject);
        },
        onCancel: () => {
          this.activeReview = undefined;
          resolve();
        },
      });
    });
  }

  /** Builds the print DOM (sheets resolved, snapshotted, and laid out) without calling `window.print()`. Never shows the review panel. */
  async prepare(): Promise<void> {
    const sheets = await this.options.sheets();
    await this.buildPrintDom(sheets);
  }

  /** `prepare()`, then triggers `window.print()` and waits for it to finish (the `afterprint` event). Never shows the review panel. */
  async print(): Promise<void> {
    const sheets = await this.options.sheets();
    await this.printSheets(sheets);
  }

  /** Shared by `print()` and `review()`'s confirm handler: an already-resolved (and possibly user-filtered) sheet list, straight through to printing. */
  private async printSheets(sheets: AtlasSheet[]): Promise<void> {
    await this.buildPrintDom(sheets);

    await new Promise<void>((resolve) => {
      const onAfterPrint = () => {
        window.removeEventListener("afterprint", onAfterPrint);
        resolve();
      };
      window.addEventListener("afterprint", onAfterPrint);
      window.print();
    });

    try {
      await this.options.onAfterPrint?.();
    } catch (err) {
      this.handleError(err);
    } finally {
      this.cleanup();
    }
  }

  private async buildPrintDom(sheets: AtlasSheet[]): Promise<void> {
    try {
      await this.options.onBeforePrint?.();
      warnAboutPitch(sheets);

      const strategy = resolveStrategy(this.options.strategy);
      const orientations = sheets.map(sheetOrientation);
      const baseOrientation = computeBaseOrientation(orientations);

      if (this.options.injectStyles) {
        this.injectStyles(strategy);
      }

      const printRoot = this.getOrCreatePrintRoot();
      printRoot.innerHTML = "";
      printRoot.className = strategy === "rotate" ? `strategy-rotate base-${baseOrientation}` : "strategy-mixed";

      for (const sheet of sheets) {
        const orientation = sheetOrientation(sheet);
        const { dataUrl, scaleHtml } = await snapshotSheet(sheet, this.options.pageSize);
        const rotated = strategy === "rotate" && orientation !== baseOrientation;
        printRoot.appendChild(buildSheetSection(sheet, orientation, rotated, dataUrl, scaleHtml));
      }
    } catch (err) {
      this.handleError(err);
      throw err;
    }
  }

  /** Empties the print DOM and removes any offscreen staging elements left behind by a failed snapshot. */
  cleanup(): void {
    if (this.printRoot) {
      this.printRoot.innerHTML = "";
    }
    document.querySelectorAll("[data-maplibre-gl-atlas-stage]").forEach((el) => el.remove());
  }

  private injectStyles(strategy: PrintStrategy): void {
    const css = [
      generateBaseCss(),
      generateStrategyCss(this.options.pageSize, strategy),
      generateLayoutCss(this.options.margin),
      generateReviewCss(),
    ].join("\n");

    if (!this.styleEl) {
      this.styleEl = document.createElement("style");
      document.head.appendChild(this.styleEl);
    }
    this.styleEl.textContent = css;
  }

  private getOrCreatePrintRoot(): HTMLElement {
    if (this.printRoot?.isConnected) return this.printRoot;
    let root = document.getElementById(PRINT_ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = PRINT_ROOT_ID;
      root.setAttribute("aria-hidden", "true");
      document.body.appendChild(root);
    }
    this.printRoot = root;
    return root;
  }

  private handleError(err: unknown): void {
    if (this.options.onError) {
      this.options.onError(err);
    } else {
      console.error("[maplibre-gl-atlas]", err);
    }
  }
}

function sheetOrientation(sheet: AtlasSheet): Orientation {
  return sheet.orientation === "landscape" ? "landscape" : "portrait";
}

function warnAboutPitch(sheets: AtlasSheet[]): void {
  if (sheets.length <= 1) return;
  const hasPitch = sheets.some((s) => !!s.pitch);
  if (hasPitch) {
    console.warn(
      "[maplibre-gl-atlas] One or more sheets have a non-zero `pitch`. Pitch introduces " +
        "perspective distortion — the map scale varies across the sheet, and physical edges " +
        "won't line up with neighboring sheets. Reserve `pitch` for a standalone sheet (e.g. a " +
        "cover page) that isn't meant to be tiled edge-to-edge with the others.",
    );
  }
}

function buildSheetSection(
  sheet: AtlasSheet,
  orientation: Orientation,
  rotated: boolean,
  dataUrl: string,
  scaleHtml: string,
): HTMLElement {
  const section = document.createElement("section");
  section.className = `print-page ${orientation}-page${sheet.className ? ` ${sheet.className}` : ""}`;

  const inner = document.createElement("div");
  inner.className = `print-page-inner ${orientation}-page${rotated ? " rotated" : ""}`;

  const header = document.createElement("div");
  header.className = "print-header";
  if (sheet.headerLeft) {
    const brand = document.createElement("div");
    brand.className = "print-brand";
    brand.textContent = sheet.headerLeft;
    header.appendChild(brand);
  }
  if (sheet.headerRight) {
    const ref = document.createElement("div");
    ref.className = "print-ref";
    ref.textContent = sheet.headerRight;
    header.appendChild(ref);
  }
  inner.appendChild(header);

  const mapBox = document.createElement("div");
  mapBox.className = "print-map";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "";
  mapBox.appendChild(img);
  inner.appendChild(mapBox);

  if (sheet.footer !== false) {
    const footer = document.createElement("div");
    footer.className = "print-footer";
    // scaleHtml is MapLibre's own ScaleControl markup — not user-supplied,
    // safe to carry over as static HTML (see snapshot.ts).
    footer.innerHTML = scaleHtml;
    inner.appendChild(footer);
  }

  section.appendChild(inner);
  return section;
}
