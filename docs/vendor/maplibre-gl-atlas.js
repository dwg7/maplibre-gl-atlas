var w = Object.defineProperty;
var $ = (e, t, n) => t in e ? w(e, t, { enumerable: !0, configurable: !0, writable: !0, value: n }) : e[t] = n;
var h = (e, t, n) => $(e, typeof t != "symbol" ? t + "" : t, n);
import { Map as v, ScaleControl as E } from "maplibre-gl";
const C = { width: 210, height: 297 }, c = 15;
function u(e) {
  return e ?? C;
}
function x(e) {
  return e == null ? { top: c, right: c, bottom: c, left: c } : typeof e == "number" ? { top: e, right: e, bottom: e, left: e } : {
    top: e.top ?? c,
    right: e.right ?? c,
    bottom: e.bottom ?? c,
    left: e.left ?? c
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
function M(e) {
  const t = x(e), n = t.top / 3, r = t.top / 3, a = t.bottom / 5;
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
  #maplibre-gl-atlas-print-root .print-page-inner .print-brand { font: bold ${n}mm/1 sans-serif; color: #222; }
  #maplibre-gl-atlas-print-root .print-page-inner .print-ref { font: bold ${r}mm/1 sans-serif; color: #222; text-align: right; }
  #maplibre-gl-atlas-print-root .print-page-inner .print-footer {
    position: absolute;
    bottom: 0; left: ${t.left}mm; right: ${t.right}mm; height: ${t.bottom}mm;
    display: flex;
    align-items: center;
  }
  #maplibre-gl-atlas-print-root .print-page-inner .print-footer .maplibregl-ctrl-scale { margin: 0; font-size: ${a}mm; }
}
`;
}
function S(e) {
  const t = e ?? (typeof navigator < "u" ? navigator : void 0);
  if (!t) return !1;
  const n = t.userAgentData;
  return n && n.platform ? n.platform === "Windows" : /Windows/i.test(t.userAgent || "");
}
function A() {
  return S() ? "rotate" : "mixed";
}
function R(e) {
  return !e || e === "auto" ? A() : e;
}
function N(e) {
  const t = e.filter((n) => n === "landscape").length;
  return t > e.length - t ? "landscape" : "portrait";
}
function z(e) {
  return {
    width: Math.min(e.width, e.height),
    height: Math.max(e.width, e.height)
  };
}
function L(e, t) {
  const { width: n, height: r } = z(u(e));
  return t === "mixed" ? `
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
function f(e) {
  return e * _ / O;
}
function T(e, t) {
  const n = u(e), r = Math.min(n.width, n.height), a = Math.max(n.width, n.height), s = f(r), i = f(a);
  return t === "landscape" ? { width: Math.round(i), height: Math.round(s) } : { width: Math.round(s), height: Math.round(i) };
}
function B(e, t, n) {
  const r = T(e, t);
  return n ? {
    width: r.width * n.x,
    height: r.height * n.y
  } : r;
}
async function D(e, t) {
  const n = e.orientation === "landscape" ? "landscape" : "portrait", r = B(t, n, e.renderScale), a = document.createElement("div");
  a.setAttribute("aria-hidden", "true"), a.setAttribute("data-maplibre-gl-atlas-stage", ""), a.style.cssText = `position:fixed; top:0; left:0; opacity:0; pointer-events:none; width:${r.width}px; height:${r.height}px;`, document.body.appendChild(a);
  const s = {
    container: a,
    style: e.style,
    bearing: e.bearing ?? 0,
    pitch: e.pitch ?? 0,
    interactive: !1,
    attributionControl: !1,
    fadeDuration: 0
  };
  e.bounds ? (s.bounds = e.bounds, s.fitBoundsOptions = { padding: e.padding ?? 0, animate: !1 }) : (s.center = e.center, s.zoom = e.zoom);
  const i = new v(s);
  i.addControl(new E({ maxWidth: 100, unit: "metric" }), "bottom-left");
  try {
    await new Promise((o, g) => {
      i.on("error", (d) => g(d.error ?? d)), i.on("load", () => {
        var d;
        i.setProjection({ type: "mercator" }), e.terrain || i.setTerrain(null), Promise.resolve((d = e.decorate) == null ? void 0 : d.call(e, i)).then(() => {
          i.once("idle", () => o());
        }).catch(g);
      });
    });
    const l = i.getCanvas().toDataURL("image/png"), p = i.getContainer().querySelector(".maplibregl-ctrl-scale"), m = p ? p.outerHTML : "";
    return { dataUrl: l, scaleHtml: m, orientation: n };
  } finally {
    i.remove(), a.remove();
  }
}
const b = "maplibre-gl-atlas-print-root";
class U {
  constructor(t) {
    h(this, "options");
    h(this, "container");
    h(this, "printRoot");
    h(this, "styleEl");
    if (typeof document > "u")
      throw new Error(
        "AtlasControl requires a DOM (`document` is undefined) — it cannot be constructed outside a browser."
      );
    if (!t || typeof t.sheets != "function")
      throw new Error("AtlasControl requires `options.sheets: () => AtlasSheet[] | Promise<AtlasSheet[]>`.");
    this.options = {
      ...t,
      pageSize: u(t.pageSize),
      margin: t.margin ?? 15,
      strategy: t.strategy ?? "auto",
      showButton: t.showButton ?? !0,
      injectStyles: t.injectStyles ?? !0
    };
  }
  // The IControl contract hands us the map instance, but this control never
  // needs it: every sheet gets its own offscreen MapLibre instance
  // (snapshot.ts), independent of whatever map this control was added to.
  onAdd(t) {
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
    var t, n;
    (t = this.container) == null || t.remove(), this.container = void 0, this.cleanup(), (n = this.styleEl) == null || n.remove(), this.styleEl = void 0;
  }
  /** Builds the print DOM (sheets resolved, snapshotted, and laid out) without calling `window.print()`. */
  async prepare() {
    var t, n;
    try {
      await ((n = (t = this.options).onBeforePrint) == null ? void 0 : n.call(t));
      const r = await this.options.sheets();
      H(r);
      const a = R(this.options.strategy), s = r.map(y), i = N(s);
      this.options.injectStyles && this.injectStyles(a);
      const l = this.getOrCreatePrintRoot();
      l.innerHTML = "", l.className = a === "rotate" ? `strategy-rotate base-${i}` : "strategy-mixed";
      for (const p of r) {
        const m = y(p), { dataUrl: o, scaleHtml: g } = await D(p, this.options.pageSize), d = a === "rotate" && m !== i;
        l.appendChild(j(p, m, d, o, g));
      }
    } catch (r) {
      throw this.handleError(r), r;
    }
  }
  /** `prepare()`, then triggers `window.print()` and waits for it to finish (the `afterprint` event). */
  async print() {
    var t, n;
    await this.prepare(), await new Promise((r) => {
      const a = () => {
        window.removeEventListener("afterprint", a), r();
      };
      window.addEventListener("afterprint", a), window.print();
    });
    try {
      await ((n = (t = this.options).onAfterPrint) == null ? void 0 : n.call(t));
    } catch (r) {
      this.handleError(r);
    } finally {
      this.cleanup();
    }
  }
  /** Empties the print DOM and removes any offscreen staging elements left behind by a failed snapshot. */
  cleanup() {
    this.printRoot && (this.printRoot.innerHTML = ""), document.querySelectorAll("[data-maplibre-gl-atlas-stage]").forEach((t) => t.remove());
  }
  injectStyles(t) {
    const n = [
      P(),
      L(this.options.pageSize, t),
      M(this.options.margin)
    ].join(`
`);
    this.styleEl || (this.styleEl = document.createElement("style"), document.head.appendChild(this.styleEl)), this.styleEl.textContent = n;
  }
  getOrCreatePrintRoot() {
    var n;
    if ((n = this.printRoot) != null && n.isConnected) return this.printRoot;
    let t = document.getElementById(b);
    return t || (t = document.createElement("div"), t.id = b, t.setAttribute("aria-hidden", "true"), document.body.appendChild(t)), this.printRoot = t, t;
  }
  handleError(t) {
    this.options.onError ? this.options.onError(t) : console.error("[maplibre-gl-atlas]", t);
  }
}
function y(e) {
  return e.orientation === "landscape" ? "landscape" : "portrait";
}
function H(e) {
  if (e.length <= 1) return;
  e.some((n) => !!n.pitch) && console.warn(
    "[maplibre-gl-atlas] One or more sheets have a non-zero `pitch`. Pitch introduces perspective distortion — the map scale varies across the sheet, and physical edges won't line up with neighboring sheets. Reserve `pitch` for a standalone sheet (e.g. a cover page) that isn't meant to be tiled edge-to-edge with the others."
  );
}
function j(e, t, n, r, a) {
  const s = document.createElement("section");
  s.className = `print-page ${t}-page${e.className ? ` ${e.className}` : ""}`;
  const i = document.createElement("div");
  i.className = `print-page-inner ${t}-page${n ? " rotated" : ""}`;
  const l = document.createElement("div");
  if (l.className = "print-header", e.headerLeft) {
    const o = document.createElement("div");
    o.className = "print-brand", o.textContent = e.headerLeft, l.appendChild(o);
  }
  if (e.headerRight) {
    const o = document.createElement("div");
    o.className = "print-ref", o.textContent = e.headerRight, l.appendChild(o);
  }
  i.appendChild(l);
  const p = document.createElement("div");
  p.className = "print-map";
  const m = document.createElement("img");
  if (m.src = r, m.alt = "", p.appendChild(m), i.appendChild(p), e.footer !== !1) {
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
