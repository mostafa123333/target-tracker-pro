// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// BASE_PATH lets the same build work in Lovable preview ("/") and on
// GitHub Pages project sites ("/<repo>/"). The Pages workflow sets it.
const basePath = process.env.BASE_PATH || "/";

/**
 * Why this shim exists (the "Cannot find module dist/server/server.js" /
 * "Failed to fetch /: Internal Server Error" build failure):
 *
 * TanStack Start's SPA shell prerender ALWAYS runs — `prerender.enabled: false`
 * does not turn it off. It boots a preview server that imports
 * `dist/server/server.js` and calls `serverBuild.fetch(request)`.
 * Nitro's `cloudflare-module` preset instead emits `dist/server/index.mjs`
 * with a `fetch(request, env, ctx)` signature and an `env.ASSETS` binding.
 *
 * This plugin writes `dist/server/server.js` as a thin ESM adapter over
 * `index.mjs`, supplying a stub `env.ASSETS` and `ctx`, so the shell renders
 * and `dist/client/index.html` is produced.
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
          writeFileSync(
            dst,
            [
              `import mod from "./index.mjs";`,
              `const stubAssets = { fetch: async () => new Response("", { status: 404 }) };`,
              `const stubCtx = { waitUntil() {}, passThroughOnException() {} };`,
              `function toPlain(req) {`,
              `  // srvx's NodeRequest exposes read-only .ip/.runtime getters that`,
              `  // the Cloudflare-module preset tries to overwrite. Reconstruct a`,
              `  // plain Request so those assignments succeed.`,
              `  const init = { method: req.method, headers: req.headers };`,
              `  if (req.method !== "GET" && req.method !== "HEAD") init.body = req.body;`,
              `  return new Request(req.url, init);`,
              `}`,
              `export default {`,
              `  fetch(request, env, ctx) {`,
              `    return mod.fetch(toPlain(request), env ?? { ASSETS: stubAssets }, ctx ?? stubCtx);`,
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
      prerender: {
        // GitHub Pages expects a real index.html at the artifact root.
        // Emitting it directly avoids a fragile post-build _shell.html copy step.
        outputPath: "/index.html",
        crawlLinks: false,
        retryCount: 0,
      },
    },
  },

  vite: {
    base: basePath,
    plugins: [shimNitroServerEntry()],
  },
});
