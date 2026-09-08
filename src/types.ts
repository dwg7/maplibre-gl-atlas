import type {
  LngLatBoundsLike,
  Map as MapLibreMap,
  PaddingOptions,
  StyleSpecification,
} from "maplibre-gl";

/** Millimeters. Used throughout for physical page geometry. */
export type Millimeters = number;

export interface PageSize {
  width: Millimeters;
  height: Millimeters;
}

export interface Margin {
  top: Millimeters;
  right: Millimeters;
  bottom: Millimeters;
  left: Millimeters;
}

export type MarginInput = Millimeters | Partial<Margin>;

export type Orientation = "portrait" | "landscape";

export type PrintStrategy = "mixed" | "rotate";

export type PrintStrategyOption = "auto" | PrintStrategy;

/**
 * One sheet of the atlas — a single printed page built from an offscreen
 * MapLibre GL JS instance. The control has no idea whether a given sheet is
 * a "detail" cell or an "index"/"overview" page; `role` is a caller-facing
 * label only (see types.ts's `role` doc comment and DECISIONS.md D-series
 * for why it doesn't drive behavior).
 */
export interface AtlasSheet {
  /** MapLibre style — a URL/style ID string, or an inline StyleSpecification. */
  style: string | StyleSpecification;

  /**
   * Geographic bounds this sheet should fit. Mutually exclusive with
   * `center`/`zoom` — provide one or the other, not both.
   */
  bounds?: LngLatBoundsLike;

  /** Camera center, used together with `zoom` instead of `bounds`. */
  center?: [number, number];

  /** Camera zoom, used together with `center` instead of `bounds`. */
  zoom?: number;

  /** Padding (px) applied around `bounds` when fitting the camera. */
  padding?: number | PaddingOptions;

  /**
   * Map bearing in degrees. Fully supported: MapLibre's bearing is an
   * orthographic, top-down screen rotation, not a perspective change, so it
   * doesn't conflict with the terrain/perspective concerns below (see
   * adr/0001-window-print-not-jspdf.md and dwg7/zukaku's ADR 0004, which
   * this project's terrain policy is inherited from).
   * @default 0
   */
  bearing?: number;

  /**
   * Map pitch in degrees. Unlike `bearing`, pitch introduces a perspective
   * projection: the map's scale is no longer uniform across the sheet, and
   * a tilted sheet's edges won't line up with a neighboring sheet's. This
   * breaks the "constant scale, physically adjoinable sheets" assumption a
   * field atlas depends on. `pitch` is left in the API for a standalone,
   * non-tiled sheet (e.g. a decorative cover page) — do not use it on a
   * sheet meant to sit edge-to-edge with others. `AtlasControl` emits a
   * single `console.warn` when more than one sheet is being printed and any
   * of them has a non-zero pitch; it does not block printing.
   * @default 0
   */
  pitch?: number;

  /**
   * Whether to keep the style's own `terrain` (if any). `false` forces
   * `map.setTerrain(null)` — matching dwg7/zukaku's ADR 0004: a physically
   * adjoined print atlas needs an orthographic top-down view, and terrain's
   * perspective tilt breaks alignment at the seams between sheets, same
   * root cause as pitch above.
   * @default false
   */
  terrain?: boolean;

  /** @default "portrait" */
  orientation?: Orientation;

  /**
   * Inflates the offscreen staging container by this factor per axis before
   * fitting the camera, so a sheet covering a much larger area (e.g. an
   * index/overview sheet) can be rendered from the same vector-tile zoom
   * level detail sheets use, then shrunk back down to the sheet's normal
   * physical size. Ported from dwg7/zukaku's ADR 0009 ("zoom-level shift").
   * Leave unset for an ordinary sheet.
   */
  renderScale?: { x: number; y: number };

  /**
   * Pure annotation. AtlasControl's own behavior never branches on this
   * value — it exists only so a caller building an atlas out of "detail"
   * and "index" sheets (the common shape) has a natural vocabulary word for
   * it, for their own logging/debugging/readability. See
   * DECISIONS.md for why this stayed in scope despite adding no behavior.
   */
  role?: "detail" | "index";

  /** Text shown at the top-left of the header band. */
  headerLeft?: string;

  /** Text shown at the top-right of the header band (e.g. a sheet reference). */
  headerRight?: string;

  /** @default "scale" */
  footer?: "scale" | false;

  /**
   * Called with the offscreen MapLibre `Map` instance after `style.load`
   * (terrain has already been resolved) and before the `idle` wait that
   * precedes the canvas snapshot — so any layers/sources added here are
   * guaranteed to be rendered into the snapshot. This is the only seam for
   * atlas-specific drawing (e.g. an index sheet's grid overlay); the
   * control itself has no built-in decoration and no idea what a "grid" is
   * (see dwg7/zukaku's `addOverviewGridLayers()`, which this hook
   * generalizes).
   */
  decorate?: (map: MapLibreMap) => void | Promise<void>;

  /** Extra class name(s) applied to this sheet's `.print-page` element. */
  className?: string;
}

export interface AtlasControlOptions {
  /**
   * Produces the flat list of sheets that make up the atlas. Called once
   * per `print()`/`prepare()`. AtlasControl has no concept of rows, columns,
   * or grid math — that's entirely the caller's responsibility; this
   * function is the only seam.
   */
  sheets: () => AtlasSheet[] | Promise<AtlasSheet[]>;

  /** Physical page size in millimeters, portrait orientation. @default A4 (210×297) */
  pageSize?: PageSize;

  /** Uniform margin, or one value per side, in millimeters. @default 15 */
  margin?: MarginInput;

  /**
   * Which named-@page CSS strategy to use for mixing portrait/landscape
   * sheets in one print job. `"auto"` (default) picks `"rotate"` on
   * Windows and `"mixed"` everywhere else — see adr/0001 and
   * dwg7/zukaku's ADR 0007 for why the platforms need different strategies.
   * @default "auto"
   */
  strategy?: PrintStrategyOption;

  /**
   * Whether `onAdd()` renders a built-in print-trigger button. Set to
   * `false` to drive `print()`/`prepare()` from your own UI instead.
   * @default true
   */
  showButton?: boolean;

  /**
   * Whether the built-in button opens the interactive `review()` panel
   * (letting the user see how many sheets will print and where, and
   * deselect any before proceeding) instead of calling `print()` directly.
   * Set to `false` if your own UI already lets the user choose what to
   * print and the confirmation step would just be redundant. Has no effect
   * on `print()`/`prepare()` themselves — calling those directly never
   * shows the review panel, so programmatic/headless callers (e.g. a
   * Playwright-driven `prepare()`) are unaffected either way.
   * @default true
   */
  confirm?: boolean;

  /**
   * Whether AtlasControl injects the `<style>` element its print layout
   * needs. Set to `false` if you'd rather own that (e.g. to inline it into
   * a build step) — see layout.ts/strategy.ts for the CSS it would
   * otherwise generate.
   * @default true
   */
  injectStyles?: boolean;

  /** Called once, before sheets are resolved and the print DOM is built. */
  onBeforePrint?: () => void | Promise<void>;

  /** Called once `window.print()` returns (the `afterprint` event fires). Not called by `prepare()`. */
  onAfterPrint?: () => void | Promise<void>;

  /**
   * Called on any error raised while resolving sheets, constructing an
   * offscreen map, or running a `decorate` hook. When omitted, errors are
   * logged with `console.error` and rethrown from `print()`/`prepare()`.
   */
  onError?: (err: unknown) => void;
}
