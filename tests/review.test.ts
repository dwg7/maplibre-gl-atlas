import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewPanel, generateReviewCss, type ReviewMapLike } from "../src/review";
import type { AtlasSheet } from "../src/types";

function fakeMap(): ReviewMapLike & { sources: Record<string, unknown>; layers: string[]; listeners: Record<string, (() => void)[]> } {
  const sources: Record<string, unknown> = {};
  const layers: string[] = [];
  const listeners: Record<string, (() => void)[]> = {};
  return {
    sources,
    layers,
    listeners,
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
    project: vi.fn((lngLat: [number, number]) => ({ x: lngLat[0] * 10, y: lngLat[1] * 10 })),
    getContainer: vi.fn(() => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) as unknown as HTMLElement),
    on: vi.fn((type: string, listener: () => void) => {
      (listeners[type] ??= []).push(listener);
    }),
    off: vi.fn((type: string, listener: () => void) => {
      listeners[type] = (listeners[type] || []).filter((l) => l !== listener);
    }),
  };
}

function sheet(overrides: Partial<AtlasSheet> = {}): AtlasSheet {
  return { style: "https://example.com/style.json", ...overrides };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ReviewPanel (no map — checkbox fallback)", () => {
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
    new ReviewPanel({ map: undefined, sheets, onConfirm: vi.fn(), onCancel: vi.fn() });

    const checkbox = document.querySelector<HTMLInputElement>(".maplibre-gl-atlas-review-panel input[type=checkbox]")!;
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change"));

    const confirmButton = document.querySelector<HTMLButtonElement>(".maplibre-gl-atlas-review-panel-confirm")!;
    expect(confirmButton.disabled).toBe(true);
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

describe("ReviewPanel (with map — on-map ×/+ toggles, dwg7/zukaku Save Paper style)", () => {
  it("renders no checkbox list — the map's own toggle buttons are the only selection UI", () => {
    const map = fakeMap();
    new ReviewPanel({ map, sheets: [sheet({ bounds: [[0, 0], [1, 1]] })], onConfirm: vi.fn(), onCancel: vi.fn() });
    expect(document.querySelector(".maplibre-gl-atlas-review-panel-list")).toBeNull();
    expect(document.querySelectorAll(".maplibre-gl-atlas-review-toggle")).toHaveLength(1);
  });

  it("one toggle per sheet, defaulting to × (included), even for center/zoom-only sheets", () => {
    const map = fakeMap();
    const sheets = [sheet({ bounds: [[0, 0], [1, 1]] }), sheet({ center: [10, 10], zoom: 5 })];
    new ReviewPanel({ map, sheets, onConfirm: vi.fn(), onCancel: vi.fn() });
    const toggles = document.querySelectorAll<HTMLButtonElement>(".maplibre-gl-atlas-review-toggle");
    expect(toggles).toHaveLength(2);
    expect(Array.from(toggles).every((t) => t.textContent === "×")).toBe(true);
  });

  it("clicking a toggle flips it to + (excluded), updates the count, and drops it from onConfirm's selection", () => {
    const map = fakeMap();
    const sheets = [sheet({ bounds: [[0, 0], [1, 1]] }), sheet({ bounds: [[2, 2], [3, 3]] })];
    const onConfirm = vi.fn();
    new ReviewPanel({ map, sheets, onConfirm, onCancel: vi.fn() });

    const toggles = document.querySelectorAll<HTMLButtonElement>(".maplibre-gl-atlas-review-toggle");
    toggles[0].click();

    expect(toggles[0].textContent).toBe("+");
    expect(toggles[0].classList.contains("maplibre-gl-atlas-review-toggle-excluded")).toBe(true);
    expect(document.querySelector(".maplibre-gl-atlas-review-panel-count")?.textContent).toBe("1 / 2 sheets selected");

    document.querySelector<HTMLButtonElement>(".maplibre-gl-atlas-review-panel-confirm")?.click();
    expect(onConfirm).toHaveBeenCalledWith([sheets[1]]);
  });

  it("positions each toggle via map.project() plus the map container's own offset, and repositions on move/resize", () => {
    const map = fakeMap();
    map.getContainer = vi.fn(() => ({ getBoundingClientRect: () => ({ left: 100, top: 50 }) }) as unknown as HTMLElement);
    new ReviewPanel({ map, sheets: [sheet({ bounds: [[0, 0], [2, 2]] })], onConfirm: vi.fn(), onCancel: vi.fn() });

    const toggle = document.querySelector<HTMLButtonElement>(".maplibre-gl-atlas-review-toggle")!;
    // Center of [[0,0],[2,2]] is [1,1]; fakeMap's project() is lngLat*10.
    expect(toggle.style.left).toBe("110px"); // 100 + 1*10
    expect(toggle.style.top).toBe("60px"); // 50 + 1*10

    expect(map.on).toHaveBeenCalledWith("move", expect.any(Function));
    expect(map.on).toHaveBeenCalledWith("resize", expect.any(Function));
  });

  it("draws a fill+line layer (no label/symbol layer) only for sheets with bounds, and cleans up everything on dispose", () => {
    const map = fakeMap();
    const sheets = [
      sheet({ bounds: [[0, 0], [1, 1]] }),
      sheet({ center: [10, 10], zoom: 5 }), // no bounds — toggle only, nothing to draw
    ];
    const panel = new ReviewPanel({ map, sheets, onConfirm: vi.fn(), onCancel: vi.fn() });

    expect(map.addSource).toHaveBeenCalledOnce();
    const [, sourceArg] = (map.addSource as ReturnType<typeof vi.fn>).mock.calls[0];
    const featureCollection = sourceArg.data as GeoJSON.FeatureCollection;
    expect(featureCollection.features).toHaveLength(1); // just the boundable sheet's polygon
    expect(map.layers).toEqual(
      expect.arrayContaining(["__maplibre-gl-atlas-review-fill__", "__maplibre-gl-atlas-review-lines__"]),
    );
    expect(document.querySelectorAll(".maplibre-gl-atlas-review-toggle")).toHaveLength(2);

    panel.dispose();
    expect(map.layers).toHaveLength(0);
    expect(Object.keys(map.sources)).toHaveLength(0);
    expect(document.querySelectorAll(".maplibre-gl-atlas-review-toggle")).toHaveLength(0);
    expect(map.listeners.move ?? []).toHaveLength(0);
    expect(map.listeners.resize ?? []).toHaveLength(0);
  });

  it("dispose() is idempotent (safe to call twice)", () => {
    const map = fakeMap();
    const panel = new ReviewPanel({ map, sheets: [sheet({ bounds: [[0, 0], [1, 1]] })], onConfirm: vi.fn(), onCancel: vi.fn() });
    panel.dispose();
    expect(() => panel.dispose()).not.toThrow();
  });
});

describe("ReviewPanel (shared behavior)", () => {
  it("calls onCancel and removes the panel and toggles when Cancel is clicked", () => {
    const map = fakeMap();
    const onCancel = vi.fn();
    new ReviewPanel({ map, sheets: [sheet({ bounds: [[0, 0], [1, 1]] })], onConfirm: vi.fn(), onCancel });

    document.querySelector<HTMLButtonElement>(".maplibre-gl-atlas-review-panel-cancel")?.click();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(document.querySelector(".maplibre-gl-atlas-review-panel")).toBeNull();
    expect(document.querySelectorAll(".maplibre-gl-atlas-review-toggle")).toHaveLength(0);
  });

  it("calls onCancel on Escape", () => {
    const onCancel = vi.fn();
    new ReviewPanel({ map: undefined, sheets: [sheet()], onConfirm: vi.fn(), onCancel });

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("generateReviewCss", () => {
  it("scopes all rules under the review panel/toggle classes and never touches @media print", () => {
    const css = generateReviewCss();
    expect(css).toContain(".maplibre-gl-atlas-review-panel {");
    expect(css).toContain(".maplibre-gl-atlas-review-toggle {");
    expect(css).not.toContain("@media print");
  });
});
