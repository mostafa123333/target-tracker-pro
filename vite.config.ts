// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// BASE_PATH lets the same build work in Lovable preview ("/") and on
// GitHub Pages project sites ("/<repo>/"). The Pages workflow sets it.
const basePath = process.env.BASE_PATH || "/";

/**
 * TanStack Start's preview-server-plugin (used by the prerender step) imports
 * `dist/server/<inputBasename>.js`, but Nitro emits `dist/server/index.mjs`.
 * This tiny shim mirrors the file into the expected name so prerender can
 * boot the SSR handler.
 */
function shimNitroServerEntry() {
  return {
    name: "shim-nitro-server-entry",
    apply: "build" as const,
    closeBundle: {
      order: "post" as const,
      handler() {
        const src = resolve(process.cwd(), "dist/server/index.mjs");
        const dst = resolve(process.cwd(), "dist/server/server.js");
        if (existsSync(src) && !existsSync(dst)) {
          try {
            copyFileSync(src, dst);
          } catch {
            /* ignore */
          }
        }
      },
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Ship as a static SPA — no server functions are used (localStorage only),
    // so we render a single shell and hydrate client-side. Works on any static host.
    spa: {
      enabled: true,
    },
  },

  vite: {
    base: basePath,
    plugins: [shimNitroServerEntry()],
  },
});
