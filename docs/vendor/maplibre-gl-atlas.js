var L = Object.defineProperty;
var P = (n, t, e) => t in n ? L(n, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : n[t] = e;
var p = (n, t, e) => P(n, typeof t != "symbol" ? t + "" : t, e);
import { Map as M, ScaleControl as R, LngLatBounds as N } from "maplibre-gl";
const _ = { width: 210, height: 297 }, g = 15;
function x(n) {
  return n ?? _;
}
function A(n) {
  return n == null ? { top: g, right: g, bottom: g, left: g } : typeof n == "number" ? { top: n, right: n, bottom: n, left: n } : {
    top: n.top ?? g,
    right: n.right ?? g,
    bottom: n.bottom ?? g,
    left: n.left ?? g
  };
}
function k() {
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
function B(n) {
  const t = A(n), e = t.top / 3, i = t.top / 3, o = t.bottom / 5;
  return `
@media print {
  #maplibre-gl-atlas-print-root .print-page-inner .print-map {
    position: absolute;
    top: ${t.top}mm; left: ${t.left}mm; right: ${t.right}mm; bottom: ${t.bottom}mm;
    box-sizing: border-box;
    border: 0.75pt solid #000;
    overflow: hidden;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-map img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-header {
    position: absolute;
    top: 0; left: ${t.left}mm; right: ${t.right}mm; height: ${t.top}mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-brand { font: bold ${e}mm/1 sans-serif; color: #222; }
  #maplibre-gl-atlas-print-root .print-page-inner .print-ref { font: bold ${i}mm/1 sans-serif; color: #222; text-align: right; }
  #maplibre-gl-atlas-print-root .print-page-inner .print-footer {
    position: absolute;
    bottom: 0; left: ${t.left}mm; right: ${t.right}mm; height: ${t.bottom}mm;
    display: flex;
    align-items: center;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-footer .maplibregl-ctrl-scale { margin: 0; font-size: ${o}mm; }
}
`;
}
function z(n) {
  const t = n ?? (typeof navigator < "u" ? navigator : void 0);
  if (!t) return !1;
  const e = t.userAgentData;
  return e && e.platform ? e.platform === "Windows" : /Windows/i.test(t.userAgent || "");
}
function D() {
  return z() ? "rotate" : "mixed";
}
function E(n) {
  return !n || n === "auto" ? D() : n;
}
function O(n) {
  const t = n.filter((e) => e === "landscape").length;
  return t > n.length - t ? "landscape" : "portrait";
}
function T(n) {
  return {
    width: Math.min(n.width, n.height),
    height: Math.max(n.width, n.height)
  };
}
function j(n, t) {
  const { width: e, height: i } = T(x(n));
  return t === "mixed" ? `
@page atlas-portrait { size: ${e}mm ${i}mm; margin: 0; }
@page atlas-landscape { size: ${i}mm ${e}mm; margin: 0; }
@media print {
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page.portrait-page { page: atlas-portrait; width: ${e}mm; height: ${i}mm; }
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page.landscape-page { page: atlas-landscape; width: ${i}mm; height: ${e}mm; }
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page-inner { position: absolute; inset: 0; }
}
` : `
@page atlas-base-portrait { size: ${e}mm ${i}mm; margin: 0; }
@page atlas-base-landscape { size: ${i}mm ${e}mm; margin: 0; }
@media print {
  #maplibre-gl-atlas-print-root.strategy-rotate.base-portrait .print-page { page: atlas-base-portrait; width: ${e}mm; height: ${i}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-landscape .print-page { page: atlas-base-landscape; width: ${i}mm; height: ${e}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner.portrait-page { width: ${e}mm; height: ${i}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner.landscape-page { width: ${i}mm; height: ${e}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner:not(.rotated) { position: absolute; top: 0; left: 0; }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-portrait .print-page-inner.rotated {
    position: absolute; top: 0; left: ${e}mm;
    transform-origin: 0 0; transform: rotate(90deg);
  }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-landscape .print-page-inner.rotated {
    position: absolute; top: 0; left: ${i}mm;
    transform-origin: 0 0; transform: rotate(90deg);
  }
}
`;
}
const F = 96, I = 25.4;
function $(n) {
  return n * F / I;
}
function H(n, t) {
  const e = x(n), i = Math.min(e.width, e.height), o = Math.max(e.width, e.height), a = $(i), r = $(o);
  return t === "landscape" ? { width: Math.round(r), height: Math.round(a) } : { width: Math.round(a), height: Math.round(r) };
}
function U(n, t, e) {
  const i = H(n, t);
  return e ? {
    width: i.width * e.x,
    height: i.height * e.y
  } : i;
}
async function W(n, t) {
  const e = n.orientation === "landscape" ? "landscape" : "portrait", i = U(t, e, n.renderScale), o = document.createElement("div");
  o.setAttribute("aria-hidden", "true"), o.setAttribute("data-maplibre-gl-atlas-stage", ""), o.style.cssText = `position:fixed; top:0; left:0; opacity:0; pointer-events:none; width:${i.width}px; height:${i.height}px;`, document.body.appendChild(o);
  const a = {
    container: o,
    style: n.style,
    bearing: n.bearing ?? 0,
    pitch: n.pitch ?? 0,
    interactive: !1,
    attributionControl: !1,
    fadeDuration: 0
  };
  n.bounds ? (a.bounds = n.bounds, a.fitBoundsOptions = { padding: n.padding ?? 0, animate: !1 }) : (a.center = n.center, a.zoom = n.zoom);
  const r = new M(a);
  r.addControl(new R({ maxWidth: 100, unit: "metric" }), "bottom-left");
  try {
    await new Promise((l, m) => {
      r.on("error", (u) => m(u.error ?? u)), r.on("load", () => {
        var u;
        r.setProjection({ type: "mercator" }), n.terrain || r.setTerrain(null), Promise.resolve((u = n.decorate) == null ? void 0 : u.call(n, r)).then(() => {
          r.once("idle", () => l());
        }).catch(m);
      });
    });
    const d = r.getCanvas().toDataURL("image/png"), c = r.getContainer().querySelector(".maplibregl-ctrl-scale");
    if (c && n.renderScale) {
      const l = Math.max(n.renderScale.x, n.renderScale.y), m = parseFloat(c.style.width);
      Number.isNaN(m) || (c.style.width = `${m / l}px`);
    }
    const h = c ? c.outerHTML : "";
    return { dataUrl: d, scaleHtml: h, orientation: e };
  } finally {
    r.remove(), o.remove();
  }
}
const f = "__maplibre-gl-atlas-review__", y = "__maplibre-gl-atlas-review-lines__", w = "__maplibre-gl-atlas-review-labels__", s = "maplibre-gl-atlas-review-panel";
class G {
  constructor(t) {
    p(this, "options");
    p(this, "rows", []);
    p(this, "panel");
    p(this, "countEl");
    p(this, "confirmButton");
    p(this, "previouslyFocused");
    p(this, "onKeyDown", (t) => {
      t.key === "Escape" && this.cancel();
    });
    p(this, "disposed", !1);
    this.options = t, this.previouslyFocused = document.activeElement, this.panel = document.createElement("div"), this.panel.className = s, this.panel.setAttribute("role", "dialog"), this.panel.setAttribute("aria-label", "Review atlas before printing"), this.panel.setAttribute("tabindex", "-1");
    const e = document.createElement("div");
    e.className = `${s}-header`;
    const i = document.createElement("strong");
    i.textContent = "Review atlas", this.countEl = document.createElement("span"), this.countEl.className = `${s}-count`, e.append(i, this.countEl);
    const o = document.createElement("ul");
    o.className = `${s}-list`, t.sheets.forEach((d, c) => {
      const h = document.createElement("li"), l = document.createElement("label"), m = document.createElement("input");
      m.type = "checkbox", m.checked = !0, m.addEventListener("change", () => this.handleToggle());
      const u = document.createElement("span");
      u.className = `${s}-label`, u.textContent = v(d, c);
      const b = document.createElement("span");
      b.className = `${s}-orientation`, b.textContent = q(d), l.append(m, u, b), h.appendChild(l), o.appendChild(h), this.rows.push({ sheet: d, checkbox: m });
    });
    const a = document.createElement("div");
    a.className = `${s}-actions`;
    const r = document.createElement("button");
    r.type = "button", r.className = `${s}-cancel`, r.textContent = "Cancel", r.addEventListener("click", () => this.cancel()), this.confirmButton = document.createElement("button"), this.confirmButton.type = "button", this.confirmButton.className = `${s}-confirm`, this.confirmButton.addEventListener("click", () => this.confirm()), a.append(r, this.confirmButton), this.panel.append(e, o, a), document.body.appendChild(this.panel), document.addEventListener("keydown", this.onKeyDown), this.addMapOverlay(), this.handleToggle(), this.panel.focus();
  }
  handleToggle() {
    const t = this.rows.filter((e) => e.checkbox.checked);
    this.countEl.textContent = `${t.length} / ${this.rows.length} sheets selected`, this.confirmButton.textContent = `Print ${t.length} sheet${t.length === 1 ? "" : "s"}`, this.confirmButton.disabled = t.length === 0, this.updateMapOverlay();
  }
  confirm() {
    if (this.disposed) return;
    const t = this.rows.filter((e) => e.checkbox.checked).map((e) => e.sheet);
    this.dispose(), this.options.onConfirm(t);
  }
  cancel() {
    this.disposed || (this.dispose(), this.options.onCancel());
  }
  addMapOverlay() {
    const t = this.options.map;
    t && (t.addSource(f, { type: "geojson", data: this.overlayGeoJson() }), t.addLayer({
      id: y,
      type: "line",
      source: f,
      paint: {
        "line-color": "#1a73e8",
        "line-width": ["case", ["get", "included"], 2.5, 1],
        "line-opacity": ["case", ["get", "included"], 1, 0.3]
      }
    }), t.addLayer({
      id: w,
      type: "symbol",
      source: f,
      layout: {
        "text-field": ["get", "label"],
        "text-size": 14,
        "symbol-placement": "point"
      },
      paint: {
        "text-color": "#1a73e8",
        "text-halo-color": "#fff",
        "text-halo-width": 1.5,
        "text-opacity": ["case", ["get", "included"], 1, 0.3]
      }
    }));
  }
  updateMapOverlay() {
    var i;
    const t = this.options.map;
    if (!t) return;
    const e = t.getSource(f);
    (i = e == null ? void 0 : e.setData) == null || i.call(e, this.overlayGeoJson());
  }
  overlayGeoJson() {
    const t = [];
    return this.rows.forEach(({ sheet: e, checkbox: i }, o) => {
      const a = J(e.bounds);
      if (!a) return;
      const r = K(a);
      t.push({
        type: "Feature",
        properties: { included: i.checked, label: v(e, o) },
        geometry: { type: "Polygon", coordinates: [a] }
      }), t.push({
        type: "Feature",
        properties: { included: i.checked, label: v(e, o) },
        geometry: { type: "Point", coordinates: r }
      });
    }), { type: "FeatureCollection", features: t };
  }
  /** Removes the panel DOM, the map overlay (if any), and the Escape listener. Idempotent. */
  dispose() {
    if (this.disposed) return;
    this.disposed = !0, this.panel.remove(), document.removeEventListener("keydown", this.onKeyDown);
    const t = this.options.map;
    t && (t.getLayer(w) && t.removeLayer(w), t.getLayer(y) && t.removeLayer(y), t.getSource(f) && t.removeSource(f)), this.previouslyFocused instanceof HTMLElement && this.previouslyFocused.focus();
  }
}
function q(n) {
  return n.orientation === "landscape" ? "landscape" : "portrait";
}
function v(n, t) {
  const e = [n.headerLeft, n.headerRight].filter((i) => !!i);
  return e.length ? e.join(" — ") : n.role ? `${n.role} ${t + 1}` : `Sheet ${t + 1}`;
}
function J(n) {
  if (!n) return null;
  const t = N.convert(n), e = t.getWest(), i = t.getSouth(), o = t.getEast(), a = t.getNorth();
  return [
    [e, a],
    [o, a],
    [o, i],
    [e, i],
    [e, a]
  ];
}
function K(n) {
  const t = n.map((i) => i[0]), e = n.map((i) => i[1]);
  return [(Math.min(...t) + Math.max(...t)) / 2, (Math.min(...e) + Math.max(...e)) / 2];
}
function Y() {
  return `
.${s} {
  position: fixed; top: 10px; right: 10px; z-index: 10;
  width: 260px; max-height: calc(100vh - 20px); overflow-y: auto;
  background: #fff; color: #222; border-radius: 6px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  font: 13px/1.4 system-ui, sans-serif;
  padding: 10px;
}
.${s}-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
.${s}-count { color: #555; font-size: 12px; }
.${s}-list { list-style: none; margin: 0 0 10px; padding: 0; }
.${s}-list li { border-bottom: 1px solid #eee; }
.${s}-list label { display: flex; align-items: center; gap: 6px; padding: 6px 2px; cursor: pointer; }
.${s}-label { flex: 1; }
.${s}-orientation { color: #888; font-size: 11px; }
.${s}-actions { display: flex; justify-content: flex-end; gap: 8px; }
.${s}-actions button { font: inherit; padding: 6px 12px; border-radius: 4px; border: 1px solid #ccc; background: #f5f5f5; cursor: pointer; }
.${s}-confirm { background: #1a73e8; border-color: #1a73e8; color: #fff; }
.${s}-confirm:disabled { background: #9ec1f2; border-color: #9ec1f2; cursor: not-allowed; }
`;
}
const C = "maplibre-gl-atlas-print-root";
class tt {
  constructor(t) {
    p(this, "options");
    p(this, "map");
    p(this, "container");
    p(this, "printRoot");
    p(this, "styleEl");
    p(this, "activeReview");
    if (typeof document > "u")
      throw new Error(
        "AtlasControl requires a DOM (`document` is undefined) — it cannot be constructed outside a browser."
      );
    if (!t || typeof t.sheets != "function")
      throw new Error("AtlasControl requires `options.sheets: () => AtlasSheet[] | Promise<AtlasSheet[]>`.");
    this.options = {
      ...t,
      pageSize: x(t.pageSize),
      margin: t.margin ?? 15,
      strategy: t.strategy ?? "auto",
      showButton: t.showButton ?? !0,
      confirm: t.confirm ?? !0,
      injectStyles: t.injectStyles ?? !0
    };
  }
  // Sheets themselves are always rendered via their own offscreen MapLibre
  // instance (snapshot.ts), independent of this map — but review() draws
  // sheet-bounds outlines onto it, so (unlike before the review feature)
  // the control now needs to hold onto it.
  onAdd(t) {
    this.map = t, this.options.injectStyles && this.injectStyles(E(this.options.strategy));
    const e = document.createElement("div");
    if (this.options.showButton) {
      e.className = "maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-atlas-ctrl";
      const i = document.createElement("button");
      i.type = "button", i.className = "maplibre-gl-atlas-ctrl-button", i.title = "Print atlas", i.setAttribute("aria-label", "Print atlas"), i.textContent = "🖨", i.addEventListener("click", () => {
        (this.options.confirm ? this.review() : this.print()).catch((a) => this.handleError(a));
      }), e.appendChild(i);
    }
    return this.container = e, e;
  }
  onRemove() {
    var t, e, i;
    (t = this.activeReview) == null || t.dispose(), this.activeReview = void 0, (e = this.container) == null || e.remove(), this.container = void 0, this.cleanup(), (i = this.styleEl) == null || i.remove(), this.styleEl = void 0, this.map = void 0;
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
  async review() {
    var e;
    (e = this.activeReview) == null || e.dispose();
    const t = await this.options.sheets();
    await new Promise((i, o) => {
      this.activeReview = new G({
        map: this.map,
        sheets: t,
        onConfirm: (a) => {
          this.activeReview = void 0, this.printSheets(a).then(i, o);
        },
        onCancel: () => {
          this.activeReview = void 0, i();
        }
      });
    });
  }
  /** Builds the print DOM (sheets resolved, snapshotted, and laid out) without calling `window.print()`. Never shows the review panel. */
  async prepare() {
    const t = await this.options.sheets();
    await this.buildPrintDom(t);
  }
  /** `prepare()`, then triggers `window.print()` and waits for it to finish (the `afterprint` event). Never shows the review panel. */
  async print() {
    const t = await this.options.sheets();
    await this.printSheets(t);
  }
  /** Shared by `print()` and `review()`'s confirm handler: an already-resolved (and possibly user-filtered) sheet list, straight through to printing. */
  async printSheets(t) {
    var e, i;
    await this.buildPrintDom(t), await new Promise((o) => {
      const a = () => {
        window.removeEventListener("afterprint", a), o();
      };
      window.addEventListener("afterprint", a), window.print();
    });
    try {
      await ((i = (e = this.options).onAfterPrint) == null ? void 0 : i.call(e));
    } catch (o) {
      this.handleError(o);
    } finally {
      this.cleanup();
    }
  }
  async buildPrintDom(t) {
    var e, i;
    try {
      await ((i = (e = this.options).onBeforePrint) == null ? void 0 : i.call(e)), X(t);
      const o = E(this.options.strategy), a = t.map(S), r = O(a);
      this.options.injectStyles && this.injectStyles(o);
      const d = this.getOrCreatePrintRoot();
      d.innerHTML = "", d.className = o === "rotate" ? `strategy-rotate base-${r}` : "strategy-mixed";
      for (const c of t) {
        const h = S(c), { dataUrl: l, scaleHtml: m } = await W(c, this.options.pageSize), u = o === "rotate" && h !== r;
        d.appendChild(Z(c, h, u, l, m));
      }
    } catch (o) {
      throw this.handleError(o), o;
    }
  }
  /** Empties the print DOM and removes any offscreen staging elements left behind by a failed snapshot. */
  cleanup() {
    this.printRoot && (this.printRoot.innerHTML = ""), document.querySelectorAll("[data-maplibre-gl-atlas-stage]").forEach((t) => t.remove());
  }
  injectStyles(t) {
    const e = [
      k(),
      j(this.options.pageSize, t),
      B(this.options.margin),
      Y()
    ].join(`
`);
    this.styleEl || (this.styleEl = document.createElement("style"), document.head.appendChild(this.styleEl)), this.styleEl.textContent = e;
  }
  getOrCreatePrintRoot() {
    var e;
    if ((e = this.printRoot) != null && e.isConnected) return this.printRoot;
    let t = document.getElementById(C);
    return t || (t = document.createElement("div"), t.id = C, t.setAttribute("aria-hidden", "true"), document.body.appendChild(t)), this.printRoot = t, t;
  }
  handleError(t) {
    this.options.onError ? this.options.onError(t) : console.error("[maplibre-gl-atlas]", t);
  }
}
function S(n) {
  return n.orientation === "landscape" ? "landscape" : "portrait";
}
function X(n) {
  if (n.length <= 1) return;
  n.some((e) => !!e.pitch) && console.warn(
    "[maplibre-gl-atlas] One or more sheets have a non-zero `pitch`. Pitch introduces perspective distortion — the map scale varies across the sheet, and physical edges won't line up with neighboring sheets. Reserve `pitch` for a standalone sheet (e.g. a cover page) that isn't meant to be tiled edge-to-edge with the others."
  );
}
function Z(n, t, e, i, o) {
  const a = document.createElement("section");
  a.className = `print-page ${t}-page${n.className ? ` ${n.className}` : ""}`;
  const r = document.createElement("div");
  r.className = `print-page-inner ${t}-page${e ? " rotated" : ""}`;
  const d = document.createElement("div");
  if (d.className = "print-header", n.headerLeft) {
    const l = document.createElement("div");
    l.className = "print-brand", l.textContent = n.headerLeft, d.appendChild(l);
  }
  if (n.headerRight) {
    const l = document.createElement("div");
    l.className = "print-ref", l.textContent = n.headerRight, d.appendChild(l);
  }
  r.appendChild(d);
  const c = document.createElement("div");
  c.className = "print-map";
  const h = document.createElement("img");
  if (h.src = i, h.alt = "", c.appendChild(h), r.appendChild(c), n.footer !== !1) {
    const l = document.createElement("div");
    l.className = "print-footer", l.innerHTML = o, r.appendChild(l);
  }
  return a.appendChild(r), a;
}
export {
  tt as AtlasControl,
  G as ReviewPanel,
  D as choosePrintStrategy,
  z as isLikelyWindows
};
//# sourceMappingURL=maplibre-gl-atlas.js.map
