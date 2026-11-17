import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/**
 * Library build — bundles ONLY src/funnel-analysis as a reusable package.
 * Demo app build stays on vite.config.ts (`pnpm build`).
 *
 * Outputs (dist/):
 *   funnel-chart.js / funnel-chart.cjs  — ES / CJS bundles
 *   style.css                           — component styles
 *   *.d.ts                              — from `tsc -p tsconfig.lib.json`
 *
 * react, react-dom and echarts are externalized (peerDependencies).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/funnel-analysis/index.ts"),
      name: "FunnelAnalysis",
      formats: ["es", "cjs"],
      fileName: "funnel-chart",
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "react-dom", "echarts", /^echarts\//],
      output: {
        // Single chunk: the barrel is small and tree-shaking still applies
        // on the consumer side via package.json `sideEffects`.
        exports: "named",
      },
    },
    // Keep the CSS asset name stable.
    cssCodeSplit: false,
  },
});
