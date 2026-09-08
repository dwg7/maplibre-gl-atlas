var w = Object.defineProperty;
var $ = (t, e, n) => e in t ? w(t, e, { enumerable: !0, configurable: !0, writable: !0, value: n }) : t[e] = n;
var g = (t, e, n) => $(t, typeof e != "symbol" ? e + "" : e, n);
import { Map as v, ScaleControl as E } from "maplibre-gl";
const x = { width: 210, height: 297 }, c = 15;
function u(t) {
  return t ?? x;
}
function C(t) {
  return t == null ? { top: c, right: c, bottom: c, left: c } : typeof t == "number" ? { top: t, right: t, bottom: t, left: t } : {
    top: t.top ?? c,
    right: t.right ?? c,
    bottom: t.bottom ?? c,
    left: t.left ?? c
  };
}
function P() {
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
function M(t) {
  const e = C(t), n = e.top / 3, r = e.top / 3, a = e.bottom / 5;
  return `
@media print {
  #maplibre-gl-atlas-print-root .print-page-inner .print-map {
    position: absolute;
    top: ${e.top}mm; left: ${e.left}mm; right: ${e.right}mm; bottom: ${e.bottom}mm;
    box-sizing: border-box;
    border: 0.75pt solid #000;
    overflow: hidden;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-map img {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-header {
    position: absolute;
    top: 0; left: ${e.left}mm; right: ${e.right}mm; height: ${e.top}mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-brand { font: bold ${n}mm/1 sans-serif; color: #222; }
  #maplibre-gl-atlas-print-root .print-page-inner .print-ref { font: bold ${r}mm/1 sans-serif; color: #222; text-align: right; }
  #maplibre-gl-atlas-print-root .print-page-inner .print-footer {
    position: absolute;
    bottom: 0; left: ${e.left}mm; right: ${e.right}mm; height: ${e.bottom}mm;
    display: flex;
    align-items: center;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-footer .maplibregl-ctrl-scale { margin: 0; font-size: ${a}mm; }
}
`;
}
function S(t) {
  const e = t ?? (typeof navigator < "u" ? navigator : void 0);
  if (!e) return !1;
  const n = e.userAgentData;
  return n && n.platform ? n.platform === "Windows" : /Windows/i.test(e.userAgent || "");
}
function A() {
  return S() ? "rotate" : "mixed";
}
function N(t) {
  return !t || t === "auto" ? A() : t;
}
function R(t) {
  const e = t.filter((n) => n === "landscape").length;
  return e > t.length - e ? "landscape" : "portrait";
}
function z(t) {
  return {
    width: Math.min(t.width, t.height),
    height: Math.max(t.width, t.height)
  };
}
function L(t, e) {
  const { width: n, height: r } = z(u(t));
  return e === "mixed" ? `
@page atlas-portrait { size: ${n}mm ${r}mm; margin: 0; }
@page atlas-landscape { size: ${r}mm ${n}mm; margin: 0; }
@media print {
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page.portrait-page { page: atlas-portrait; width: ${n}mm; height: ${r}mm; }
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page.landscape-page { page: atlas-landscape; width: ${r}mm; height: ${n}mm; }
  #maplibre-gl-atlas-print-root.strategy-mixed .print-page-inner { position: absolute; inset: 0; }
}
` : `
@page atlas-base-portrait { size: ${n}mm ${r}mm; margin: 0; }
@page atlas-base-landscape { size: ${r}mm ${n}mm; margin: 0; }
@media print {
  #maplibre-gl-atlas-print-root.strategy-rotate.base-portrait .print-page { page: atlas-base-portrait; width: ${n}mm; height: ${r}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-landscape .print-page { page: atlas-base-landscape; width: ${r}mm; height: ${n}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner.portrait-page { width: ${n}mm; height: ${r}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner.landscape-page { width: ${r}mm; height: ${n}mm; }
  #maplibre-gl-atlas-print-root.strategy-rotate .print-page-inner:not(.rotated) { position: absolute; top: 0; left: 0; }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-portrait .print-page-inner.rotated {
    position: absolute; top: 0; left: ${n}mm;
    transform-origin: 0 0; transform: rotate(90deg);
  }
  #maplibre-gl-atlas-print-root.strategy-rotate.base-landscape .print-page-inner.rotated {
    position: absolute; top: 0; left: ${r}mm;
    transform-origin: 0 0; transform: rotate(90deg);
  }
}
`;
}
const _ = 96, O = 25.4;
function f(t) {
  return t * _ / O;
}
function T(t, e) {
  const n = u(t), r = Math.min(n.width, n.height), a = Math.max(n.width, n.height), s = f(r), i = f(a);
  return e === "landscape" ? { width: Math.round(i), height: Math.round(s) } : { width: Math.round(s), height: Math.round(i) };
}
function B(t, e, n) {
  const r = T(t, e);
  return n ? {
    width: r.width * n.x,
    height: r.height * n.y
  } : r;
}
async function D(t, e) {
  const n = t.orientation === "landscape" ? "landscape" : "portrait", r = B(e, n, t.renderScale), a = document.createElement("div");
  a.setAttribute("aria-hidden", "true"), a.setAttribute("data-maplibre-gl-atlas-stage", ""), a.style.cssText = `position:fixed; top:0; left:0; opacity:0; pointer-events:none; width:${r.width}px; height:${r.height}px;`, document.body.appendChild(a);
  const s = {
    container: a,
    style: t.style,
    bearing: t.bearing ?? 0,
    pitch: t.pitch ?? 0,
    interactive: !1,
    attributionControl: !1,
    fadeDuration: 0
  };
  t.bounds ? (s.bounds = t.bounds, s.fitBoundsOptions = { padding: t.padding ?? 0, animate: !1 }) : (s.center = t.center, s.zoom = t.zoom);
  const i = new v(s);
  i.addControl(new E({ maxWidth: 100, unit: "metric" }), "bottom-left");
  try {
    await new Promise((o, d) => {
      i.on("error", (h) => d(h.error ?? h)), i.on("load", () => {
        var h;
        i.setProjection({ type: "mercator" }), t.terrain || i.setTerrain(null), Promise.resolve((h = t.decorate) == null ? void 0 : h.call(t, i)).then(() => {
          i.once("idle", () => o());
        }).catch(d);
      });
    });
    const p = i.getCanvas().toDataURL("image/png"), l = i.getContainer().querySelector(".maplibregl-ctrl-scale");
    if (l && t.renderScale) {
      const o = Math.max(t.renderScale.x, t.renderScale.y), d = parseFloat(l.style.width);
      Number.isNaN(d) || (l.style.width = `${d / o}px`);
    }
    const m = l ? l.outerHTML : "";
    return { dataUrl: p, scaleHtml: m, orientation: n };
  } finally {
    i.remove(), a.remove();
  }
}
const b = "maplibre-gl-atlas-print-root";
class U {
  constructor(e) {
    g(this, "options");
    g(this, "container");
    g(this, "printRoot");
    g(this, "styleEl");
    if (typeof document > "u")
      throw new Error(
        "AtlasControl requires a DOM (`document` is undefined) — it cannot be constructed outside a browser."
      );
    if (!e || typeof e.sheets != "function")
      throw new Error("AtlasControl requires `options.sheets: () => AtlasSheet[] | Promise<AtlasSheet[]>`.");
    this.options = {
      ...e,
      pageSize: u(e.pageSize),
      margin: e.margin ?? 15,
      strategy: e.strategy ?? "auto",
      showButton: e.showButton ?? !0,
      injectStyles: e.injectStyles ?? !0
    };
  }
  // The IControl contract hands us the map instance, but this control never
  // needs it: every sheet gets its own offscreen MapLibre instance
  // (snapshot.ts), independent of whatever map this control was added to.
  onAdd(e) {
    const n = document.createElement("div");
    if (n.className = "maplibregl-ctrl maplibregl-ctrl-group maplibre-gl-atlas-ctrl", this.options.showButton) {
      const r = document.createElement("button");
      r.type = "button", r.className = "maplibre-gl-atlas-ctrl-button", r.title = "Print atlas", r.setAttribute("aria-label", "Print atlas"), r.textContent = "🖨", r.addEventListener("click", () => {
        this.print().catch((a) => this.handleError(a));
      }), n.appendChild(r);
    }
    return this.container = n, n;
  }
  onRemove() {
    var e, n;
    (e = this.container) == null || e.remove(), this.container = void 0, this.cleanup(), (n = this.styleEl) == null || n.remove(), this.styleEl = void 0;
  }
  /** Builds the print DOM (sheets resolved, snapshotted, and laid out) without calling `window.print()`. */
  async prepare() {
    var e, n;
    try {
      await ((n = (e = this.options).onBeforePrint) == null ? void 0 : n.call(e));
      const r = await this.options.sheets();
      H(r);
      const a = N(this.options.strategy), s = r.map(y), i = R(s);
      this.options.injectStyles && this.injectStyles(a);
      const p = this.getOrCreatePrintRoot();
      p.innerHTML = "", p.className = a === "rotate" ? `strategy-rotate base-${i}` : "strategy-mixed";
      for (const l of r) {
        const m = y(l), { dataUrl: o, scaleHtml: d } = await D(l, this.options.pageSize), h = a === "rotate" && m !== i;
        p.appendChild(j(l, m, h, o, d));
      }
    } catch (r) {
      throw this.handleError(r), r;
    }
  }
  /** `prepare()`, then triggers `window.print()` and waits for it to finish (the `afterprint` event). */
  async print() {
    var e, n;
    await this.prepare(), await new Promise((r) => {
      const a = () => {
        window.removeEventListener("afterprint", a), r();
      };
      window.addEventListener("afterprint", a), window.print();
    });
    try {
      await ((n = (e = this.options).onAfterPrint) == null ? void 0 : n.call(e));
    } catch (r) {
      this.handleError(r);
    } finally {
      this.cleanup();
    }
  }
  /** Empties the print DOM and removes any offscreen staging elements left behind by a failed snapshot. */
  cleanup() {
    this.printRoot && (this.printRoot.innerHTML = ""), document.querySelectorAll("[data-maplibre-gl-atlas-stage]").forEach((e) => e.remove());
  }
  injectStyles(e) {
    const n = [
      P(),
      L(this.options.pageSize, e),
      M(this.options.margin)
    ].join(`
`);
    this.styleEl || (this.styleEl = document.createElement("style"), document.head.appendChild(this.styleEl)), this.styleEl.textContent = n;
  }
  getOrCreatePrintRoot() {
    var n;
    if ((n = this.printRoot) != null && n.isConnected) return this.printRoot;
    let e = document.getElementById(b);
    return e || (e = document.createElement("div"), e.id = b, e.setAttribute("aria-hidden", "true"), document.body.appendChild(e)), this.printRoot = e, e;
  }
  handleError(e) {
    this.options.onError ? this.options.onError(e) : console.error("[maplibre-gl-atlas]", e);
  }
}
function y(t) {
  return t.orientation === "landscape" ? "landscape" : "portrait";
}
function H(t) {
  if (t.length <= 1) return;
  t.some((n) => !!n.pitch) && console.warn(
    "[maplibre-gl-atlas] One or more sheets have a non-zero `pitch`. Pitch introduces perspective distortion — the map scale varies across the sheet, and physical edges won't line up with neighboring sheets. Reserve `pitch` for a standalone sheet (e.g. a cover page) that isn't meant to be tiled edge-to-edge with the others."
  );
}
function j(t, e, n, r, a) {
  const s = document.createElement("section");
  s.className = `print-page ${e}-page${t.className ? ` ${t.className}` : ""}`;
  const i = document.createElement("div");
  i.className = `print-page-inner ${e}-page${n ? " rotated" : ""}`;
  const p = document.createElement("div");
  if (p.className = "print-header", t.headerLeft) {
    const o = document.createElement("div");
    o.className = "print-brand", o.textContent = t.headerLeft, p.appendChild(o);
  }
  if (t.headerRight) {
    const o = document.createElement("div");
    o.className = "print-ref", o.textContent = t.headerRight, p.appendChild(o);
  }
  i.appendChild(p);
  const l = document.createElement("div");
  l.className = "print-map";
  const m = document.createElement("img");
  if (m.src = r, m.alt = "", l.appendChild(m), i.appendChild(l), t.footer !== !1) {
    const o = document.createElement("div");
    o.className = "print-footer", o.innerHTML = a, i.appendChild(o);
  }
  return s.appendChild(i), s;
}
export {
  U as AtlasControl,
  A as choosePrintStrategy,
  S as isLikelyWindows
};
//# sourceMappingURL=maplibre-gl-atlas.js.map
