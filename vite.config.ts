import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const entry = fileURLToPath(new URL("src/index.ts", import.meta.url));

// Dual ESM/CJS build, matching opengeos/maplibre-gl-plugin-template's
// conventions. maplibre-gl is a peerDependency (see DECISIONS.md D2), so it's
// externalized rather than bundled.
export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      include: ["src"],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry,
      name: "MaplibreGlAtlas",
      fileName: (format) => (format === "es" ? "maplibre-gl-atlas.js" : "maplibre-gl-atlas.cjs"),
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["maplibre-gl"],
      output: {
        globals: {
          "maplibre-gl": "maplibregl",
        },
      },
    },
    sourcemap: true,
  },
});
