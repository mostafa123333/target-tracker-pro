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
    // Pure static SPA: no server functions are used (localStorage only).
    // The internal prerender crawler is DISABLED — it boots a local server from
    // dist/server/server.js, which Nitro's cloudflare-module preset never emits
    // (ERR_MODULE_NOT_FOUND / "Failed to fetch /: Internal Server Error").
    // SPA mode still emits the hydration shell, which the deploy step copies to
    // index.html / 404.html.
    spa: {
      enabled: true,
      prerender: {
        enabled: false,
        crawlLinks: false,
        retryCount: 0,
      },
    },
  },
  vite: {
    base: basePath,
  },
});
