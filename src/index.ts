import type { IControl, Map as MapLibreMap } from "maplibre-gl";
import { generateBaseCss, generateLayoutCss, resolvePageSize } from "./layout";
import { computeBaseOrientation, generateStrategyCss, resolveStrategy } from "./strategy";
import { snapshotSheet } from "./snapshot";
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

const PRINT_ROOT_ID = "maplibre-gl-atlas-print-root";

interface ResolvedOptions extends AtlasControlOptions {
  pageSize: NonNullable<AtlasControlOptions["pageSize"]>;
  margin: NonNullable<AtlasControlOptions["margin"]>;
  strategy: NonNullable<AtlasControlOptions["strategy"]>;
  showButton: boolean;
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
  private container?: HTMLElement;
  private printRoot?: HTMLElement;
  private styleEl?: HTMLStyleElement;

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
      injectStyles: options.injectStyles ?? true,
    };
  }

  // The IControl contract hands us the map instance, but this control never
  // needs it: every sheet gets its own offscreen MapLibre instance
  // (snapshot.ts), independent of whatever map this control was added to.
  onAdd(_map: MapLibreMap): HTMLElement {
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
        this.print().catch((err) => this.handleError(err));
      });
      container.appendChild(button);
    }

    this.container = container;
    return container;
  }

  onRemove(): void {
    this.container?.remove();
    this.container = undefined;
    this.cleanup();
    this.styleEl?.remove();
    this.styleEl = undefined;
  }

  /** Builds the print DOM (sheets resolved, snapshotted, and laid out) without calling `window.print()`. */
  async prepare(): Promise<void> {
    try {
      await this.options.onBeforePrint?.();

      const sheets = await this.options.sheets();
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

  /** `prepare()`, then triggers `window.print()` and waits for it to finish (the `afterprint` event). */
  async print(): Promise<void> {
    await this.prepare();

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
