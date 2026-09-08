import { afterEach, describe, expect, it } from "vitest";
import { AtlasControl } from "../src/index";
import type { Map as MapLibreMap } from "maplibre-gl";

// onAdd() only stores the map reference and touches the DOM (button/style
// element) — it never calls a WebGL-dependent method — so a minimal fake
// stands in for the real MapLibre `Map` here, consistent with this
// project's "no real MapLibre instance in Vitest" policy (snapshot.ts,
// review.test.ts).
function fakeMap(): MapLibreMap {
  return {} as MapLibreMap;
}

afterEach(() => {
  document.body.innerHTML = "";
  document.head.querySelectorAll("style").forEach((el) => el.remove());
});

describe("AtlasControl construction", () => {
  it("throws without a sheets() function", () => {
    expect(() => new AtlasControl({} as never)).toThrow(/sheets/);
  });
});

describe("AtlasControl.onAdd", () => {
  it("renders a visible control-group button by default (showButton: true)", () => {
    const control = new AtlasControl({ sheets: () => [] });
    const container = control.onAdd(fakeMap());
    expect(container.className).toContain("maplibregl-ctrl-group");
    expect(container.querySelector("button")).not.toBeNull();
  });

  it("returns an unstyled, empty element when showButton is false — no stray control-group box", () => {
    const control = new AtlasControl({ sheets: () => [], showButton: false });
    const container = control.onAdd(fakeMap());
    // No maplibregl-ctrl-group class: that class alone (per maplibregl's own
    // CSS) draws a background/shadow box even with nothing inside it.
    expect(container.className).toBe("");
    expect(container.children).toHaveLength(0);
  });

  it("injects print/review CSS regardless of showButton, so review() is already styled the first time it opens", () => {
    new AtlasControl({ sheets: () => [], showButton: false });
    const control2 = new AtlasControl({ sheets: () => [] });
    control2.onAdd(fakeMap());
    expect(document.head.querySelector("style")?.textContent).toContain("maplibre-gl-atlas-review-panel");
  });
});
