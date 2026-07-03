// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";


// BASE_PATH lets the same build work in Lovable preview ("/") and on
// GitHub Pages project sites ("/<repo>/"). The Pages workflow sets it.
const basePath = process.env.BASE_PATH || "/";

/**
 * The Lovable sandbox forces Nitro's `cloudflare-module` preset. That preset
 * emits `dist/server/index.mjs` whose default export expects to be invoked as
 * `fetch(request, env, ctx)` with an `env.ASSETS` binding. TanStack Start's
 * prerender step spins up a preview server that:
 *   1. imports `dist/server/<serverInputBasename>.js` (expects `.js`, not `.mjs`)
 *   2. calls `serverBuild.fetch(request)` with no env
 *
 * Both assumptions break in the sandbox → the prerender crawl of `/` 500s.
 *
 * This plugin writes a small ESM wrapper at `dist/server/server.js` that
 * re-exports a Cloudflare-shaped handler filled in with a stub `env.ASSETS`
 * and empty `ctx`, so the preview server can boot it and render the SPA shell.
 */
function shimNitroServerEntry() {
  return {
    name: "shim-nitro-server-entry",
    apply: "build" as const,
    closeBundle: {
      order: "post" as const,
      handler() {
        const dir = resolve(process.cwd(), "dist/server");
        const src = resolve(dir, "index.mjs");
        const dst = resolve(dir, "server.js");
        if (!existsSync(src) || existsSync(dst)) return;
        try {
          // Wrapper that adapts Cloudflare Workers module → srvx-style fetch(request).
          writeFileSync(
            dst,
            [
              `import mod from "./index.mjs";`,
              `const stubAssets = { fetch: async () => new Response("", { status: 404 }) };`,
              `const stubCtx = { waitUntil() {}, passThroughOnException() {} };`,
              `export default {`,
              `  fetch(request, env, ctx) {`,
              `    return mod.fetch(request, env ?? { ASSETS: stubAssets }, ctx ?? stubCtx);`,
              `  },`,
              `};`,
              ``,
            ].join("\n"),
          );
          writeFileSync(
            resolve(dir, "package.json"),
            JSON.stringify({ type: "module" }),
          );
        } catch {
          /* ignore */
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
