// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

// BASE_PATH lets the same build work in Lovable preview ("/") and on
// GitHub Pages project sites ("/<repo>/"). The Pages workflow sets it.
// GitHub Pages needs "/target-tracker-pro/"; Lovable/Netlify need "/".
// The Pages workflow sets BASE_PATH, everything else stays at root.
const basePath = process.env.BASE_PATH || "/";

/**
 * Why this shim exists (the "Cannot find module dist/server/server.js" /
 * "Failed to fetch /: Internal Server Error" build failure):
 *
 * TanStack Start's SPA shell prerender ALWAYS runs — `prerender.enabled: false`
 * does not turn it off. It boots a preview server that imports
 * `dist/server/server.js` and calls `serverBuild.fetch(request)`.
 * Nitro's `cloudflare-module` preset can emit `.output/server/index.mjs`
 * instead of `dist/server/server.js`, with a `fetch(request, env, ctx)`
 * signature and an `env.ASSETS` binding.
 *
 * This plugin writes the missing `dist/server/server.js` as a thin ESM adapter
 * over Nitro's real `index.mjs`, supplying a stub `env.ASSETS` and `ctx`, so
 * TanStack's SPA shell prerender can complete cleanly.
 */
function shimNitroServerEntry() {
  const projectRoot = process.cwd();
  const tanstackPreviewDir = resolve(projectRoot, "dist/server");
  const nitroServerDirs = [
    resolve(projectRoot, "dist/server"),
    resolve(projectRoot, ".output/server"),
  ];

  return {
    name: "shim-nitro-server-entry",
    apply: "build" as const,
    closeBundle: {
      order: "post" as const,
      handler() {
        const realServerDir = nitroServerDirs.find((dir) =>
          existsSync(resolve(dir, "index.mjs")),
        );
        if (!realServerDir) return;

        const src = resolve(realServerDir, "index.mjs");
        const dst = resolve(tanstackPreviewDir, "server.js");
        if (existsSync(dst)) return;

        try {
          mkdirSync(tanstackPreviewDir, { recursive: true });
          const importPath = relative(tanstackPreviewDir, src)
            .split(sep)
            .join("/");

          writeFileSync(
            dst,
            [
              `import mod from "${importPath.startsWith(".") ? importPath : `./${importPath}`}";`,
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
            resolve(tanstackPreviewDir, "package.json"),
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
    // Do not let TanStack discover/crawl additional static routes. The app is
    // deployed as one SPA shell, so only the explicit SPA shell is rendered.
    prerender: {
      autoStaticPathsDiscovery: false,
      crawlLinks: false,
      retryCount: 0,
    },
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

  nitro: {
    preset: "cloudflare-module",
    output: {
      dir: "dist",
      serverDir: "dist/server",
      publicDir: "dist/client",
    },
  },

  vite: {
    base: basePath,
    plugins: [shimNitroServerEntry()],
  },
});
