import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewPanel, generateReviewCss, type ReviewMapLike } from "../src/review";
import type { AtlasSheet } from "../src/types";

function fakeMap(): ReviewMapLike & { sources: Record<string, unknown>; layers: string[] } {
  const sources: Record<string, unknown> = {};
  const layers: string[] = [];
  return {
    sources,
    layers,
    addSource: vi.fn((id: string, source: unknown) => {
      sources[id] = { ...(source as object), setData: vi.fn((data: unknown) => ((source as { data: unknown }).data = data)) };
    }),
    removeSource: vi.fn((id: string) => delete sources[id]),
    getSource: vi.fn((id: string) => sources[id]),
    addLayer: vi.fn((layer: unknown) => layers.push((layer as { id: string }).id)),
    removeLayer: vi.fn((id: string) => {
      const i = layers.indexOf(id);
      if (i >= 0) layers.splice(i, 1);
    }),
    getLayer: vi.fn((id: string) => (layers.includes(id) ? { id } : undefined)),
  };
}

function sheet(overrides: Partial<AtlasSheet> = {}): AtlasSheet {
  return { style: "https://example.com/style.json", ...overrides };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ReviewPanel", () => {
  it("renders one row per sheet, all checked by default, and reports the full count", () => {
    const sheets = [sheet({ headerRight: "A1" }), sheet({ headerRight: "A2" }), sheet({ role: "index" })];
    new ReviewPanel({ map: undefined, sheets, onConfirm: vi.fn(), onCancel: vi.fn() });

    const checkboxes = document.querySelectorAll<HTMLInputElement>(".maplibre-gl-atlas-review-panel input[type=checkbox]");
    expect(checkboxes).toHaveLength(3);
    expect(Array.from(checkboxes).every((c) => c.checked)).toBe(true);
    expect(document.querySelector(".maplibre-gl-atlas-review-panel-count")?.textContent).toBe("3 / 3 sheets selected");
  });

  it("unchecking a sheet updates the count and excludes it from onConfirm's selection", () => {
    const sheets = [sheet({ headerRight: "A1" }), sheet({ headerRight: "A2" })];
    const onConfirm = vi.fn();
    new ReviewPanel({ map: undefined, sheets, onConfirm, onCancel: vi.fn() });

    const checkboxes = document.querySelectorAll<HTMLInputElement>(".maplibre-gl-atlas-review-panel input[type=checkbox]");
    checkboxes[0].checked = false;
    checkboxes[0].dispatchEvent(new Event("change"));

    expect(document.querySelector(".maplibre-gl-atlas-review-panel-count")?.textContent).toBe("1 / 2 sheets selected");

    document.querySelector<HTMLButtonElement>(".maplibre-gl-atlas-review-panel-confirm")?.click();
    expect(onConfirm).toHaveBeenCalledWith([sheets[1]]);
  });

  it("disables the confirm button and blocks confirming when every sheet is deselected", () => {
    const sheets = [sheet()];
    const onConfirm = vi.fn();
    new ReviewPanel({ map: undefined, sheets, onConfirm, onCancel: vi.fn() });

    const checkbox = document.querySelector<HTMLInputElement>(".maplibre-gl-atlas-review-panel input[type=checkbox]")!;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));

    const confirmButton = document.querySelector<HTMLButtonElement>(".maplibre-gl-atlas-review-panel-confirm")!;
    expect(confirmButton.disabled).toBe(true);
  });

  it("calls onCancel and removes the panel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    new ReviewPanel({ map: undefined, sheets: [sheet()], onConfirm: vi.fn(), onCancel });

    document.querySelector<HTMLButtonElement>(".maplibre-gl-atlas-review-panel-cancel")?.click();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(document.querySelector(".maplibre-gl-atlas-review-panel")).toBeNull();
  });

  it("calls onCancel on Escape", () => {
    const onCancel = vi.fn();
    new ReviewPanel({ map: undefined, sheets: [sheet()], onConfirm: vi.fn(), onCancel });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("draws an outline+label source/layer only for sheets with bounds, and cleans up on dispose", () => {
    const map = fakeMap();
    const sheets = [
      sheet({ bounds: [[0, 0], [1, 1]] }),
      sheet({ center: [10, 10], zoom: 5 }), // no bounds — not drawable
    ];
    const panel = new ReviewPanel({ map, sheets, onConfirm: vi.fn(), onCancel: vi.fn() });

    expect(map.addSource).toHaveBeenCalledOnce();
    const [, sourceArg] = (map.addSource as ReturnType<typeof vi.fn>).mock.calls[0];
    const featureCollection = sourceArg.data as GeoJSON.FeatureCollection;
    // One sheet has bounds -> one polygon + one point feature; the
    // center/zoom sheet contributes nothing (no bounding box to draw).
    expect(featureCollection.features).toHaveLength(2);
    expect(map.layers).toEqual(
      expect.arrayContaining(["__maplibre-gl-atlas-review-lines__", "__maplibre-gl-atlas-review-labels__"]),
    );

    panel.dispose();
    expect(map.layers).toHaveLength(0);
    expect(Object.keys(map.sources)).toHaveLength(0);
  });

  it("dispose() is idempotent (safe to call twice)", () => {
    const map = fakeMap();
    const panel = new ReviewPanel({ map, sheets: [sheet({ bounds: [[0, 0], [1, 1]] })], onConfirm: vi.fn(), onCancel: vi.fn() });
    panel.dispose();
    expect(() => panel.dispose()).not.toThrow();
  });

  it("falls back to a role- or index-based label when no header text is set", () => {
    new ReviewPanel({
      map: undefined,
      sheets: [sheet({ role: "index" }), sheet()],
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    });
    const labels = Array.from(document.querySelectorAll(".maplibre-gl-atlas-review-panel-label")).map((el) => el.textContent);
    expect(labels).toEqual(["index 1", "Sheet 2"]);
  });
});

describe("generateReviewCss", () => {
  it("scopes all rules under the review panel class and never touches @media print", () => {
    const css = generateReviewCss();
    expect(css).toContain(".maplibre-gl-atlas-review-panel {");
    expect(css).not.toContain("@media print");
  });
});
