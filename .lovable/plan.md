## Problem

Two things are blocking the site on GitHub Pages:

1. **The workflow doesn't build the app.** `.github/workflows/static.yml` uploads the entire repo (`path: '.'`) to Pages — so visitors get the source tree, not a built site.
2. **The app is configured as an SSR worker.** TanStack Start currently targets Cloudflare Workers (Nitro), and GitHub Pages can only serve static files. The app's logic is 100% client-side (localStorage, no server functions actually called), so we can safely ship it as a static SPA.

Plus, on a *project site* (`username.github.io/<repo>`), the app lives under `/repo/`, so Vite's `base` and TanStack Router's `basepath` must match the repo name — otherwise every asset and route 404s.

## Plan

### 1. Switch the build to static SPA
- Update `vite.config.ts` to enable TanStack Start SPA mode and prerender the shell, so `vite build` emits a fully static `dist/` (no worker). Read `BASE_PATH` from env so the same config works locally and on Pages.
- Add `basepath` to the router in `src/router.tsx` using the same env value, so client-side navigation works under `/<repo>/`.
- Add an `index.html` → `404.html` copy step so client-side routes (`/entries`, `/analytics`, `/settings`) survive a hard refresh on Pages.

### 2. Rewrite the GitHub Actions workflow
Replace `.github/workflows/static.yml` with a real build pipeline:
- Checkout, set up Bun, install deps.
- Compute `BASE_PATH` from the repo name (`/${{ github.event.repository.name }}/`) and export it for the build.
- Run `bun run build`.
- Copy `dist/index.html` to `dist/404.html` and touch `dist/.nojekyll`.
- Upload `dist` (not the repo root) as the Pages artifact and deploy.

### 3. Verification
After the next push to `main`:
- Actions tab shows the workflow building successfully.
- `https://<user>.github.io/<repo>/` loads the dashboard.
- Hard-refreshing `/<repo>/entries` still loads correctly (404 fallback).
- localStorage data persists across reloads.

## Technical notes

- **Why SPA mode, not full prerender per route:** every route reads from `localStorage` on mount, so prerendering them adds no value and creates hydration mismatches. SPA mode emits a single shell that hydrates client-side — exactly what this app needs.
- **Why a `BASE_PATH` env var:** the same codebase needs `base: '/'` in Lovable preview and `base: '/<repo>/'` on Pages. Reading from env keeps both working without manual edits.
- **`.nojekyll`** prevents GitHub Pages from stripping files/folders starting with `_` (Vite emits `_assets`-style paths in some setups).
- **No code changes to features.** Only build config, router base, and workflow — all the dashboard/analytics/entries logic stays as-is.

## Files touched

- `vite.config.ts` — enable SPA mode, wire `base` from env.
- `src/router.tsx` — pass `basepath` from env.
- `.github/workflows/static.yml` — proper build + deploy.
- (New) tiny post-build step inline in the workflow for `404.html` and `.nojekyll`.