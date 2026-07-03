// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// BASE_PATH lets the same build work in Lovable preview ("/") and on
// GitHub Pages project sites ("/<repo>/"). The Pages workflow sets it.
const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  tanstackStart: {
    // Ship as a static SPA — no server functions are used (localStorage only),
    // so we render a single shell and hydrate client-side. Works on any static host.
    spa: {
      enabled: true,
      maskPath: "/",
      prerender: {
        // Static hosts need a real index.html at the publish root.
        outputPath: "/index",
      },
    },
  },

  vite: {
    base: basePath,
  },
});
