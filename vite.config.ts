import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Keep build intermediates out of the deployed bundle.
 *
 * The model pipeline reads and writes inside `public/models/`, so that directory
 * holds the downloaded sources and every intermediate as well as the four assets
 * the app actually fetches. Vite copies `public/` verbatim, which made `dist`
 * **1.7 GB** — `hra.stripped.glb` alone is 399 MB — to serve about 32 MB.
 *
 * The pipeline is not moved out of `public/` because the scripts, the docs and
 * `npm run convert:*` all agree on those paths, and a rename touches all three
 * for no gain. Pruning the copy is the smaller change and it fixes the artefact
 * that actually ships.
 *
 * Deliberately a whitelist read from `anatomySources.ts` rather than a
 * blacklist of known-big names: a new intermediate must not be able to reach the
 * bundle by simply not matching a pattern.
 */
function pruneUnshippedModels(): Plugin {
  return {
    name: 'prune-unshipped-models',
    apply: 'build',
    closeBundle() {
      const dir = join(__dirname, 'dist', 'models')
      /**
       * ⚠️ EVERY REGISTRY. THREE OF THEM NOW, AND THE LIST HAS ALREADY BEEN
       * INCOMPLETE ONCE.
       *
       * Overlays live in their own file because they are single organs rather
       * than whole-body atlases, and body envelopes in a third because they are
       * generated surfaces with no donor (D16). Reading only `anatomySources`
       * would silently prune every overlay and every envelope out of the build —
       * the exact failure this whitelist exists to prevent, just from the other
       * direction.
       *
       * That is not hypothetical. `bodyEnvelopes.ts` was added on 8 August 2026
       * and NOT added here, so all five ANNY envelopes were pruned from `dist`
       * and the feature shipped as five "not installed" pills. It was invisible
       * in development, because `npm run dev` serves `public/` directly and never
       * runs this plugin at all — so the only way to catch it is to look in
       * `dist/models` after a build.
       *
       * A new registry file MUST be added to this list. And its urls must be
       * written as literal strings: the regex below cannot see a template
       * literal, which is the second half of the same bug.
       */
      let sources = ''
      for (const f of ['anatomySources.ts', 'organOverlays.ts', 'bodyEnvelopes.ts']) {
        try {
          sources += readFileSync(join(__dirname, 'src', 'scene', f), 'utf8')
        } catch {
          // A registry that is not there yet is not an error; a missing one only
          // means fewer names to keep. The `keep.size === 0` guard below is what
          // catches the case where NOTHING was found.
        }
      }
      const keep = new Set(
        [...sources.matchAll(/\/models\/([A-Za-z0-9._-]+\.glb)/g)].map((m) => m[1]),
      )
      if (keep.size === 0) {
        // Better to ship too much than to ship an empty models directory because
        // a refactor changed how urls are written.
        this.warn('prune-unshipped-models: found no model urls; leaving dist/models alone')
        return
      }
      /**
       * ⚠️ `closeBundle` ALSO RUNS WHEN THE BUILD FAILED, and without this guard
       * that turns every real build error into a misleading one.
       *
       * Rollup calls `closeBundle` during teardown on the error path too, before
       * any output has been written — so `dist/models` does not exist, the
       * `readdirSync` below threw ENOENT, and Vite reported THAT instead of the
       * error that actually stopped the build. It cost a diagnosis: a genuine
       * failure elsewhere presented as "no such file or directory, scandir
       * dist/models", which points at the assets and not at the cause.
       *
       * Returning quietly is right here. If the directory is absent there is
       * nothing to prune, and on a successful build it is always present because
       * `public/models/README.md` is copied even when no atlas is installed.
       */
      if (!existsSync(dir)) return

      let freed = 0
      let removed = 0
      for (const f of readdirSync(dir)) {
        if (keep.has(f)) continue
        const p = join(dir, f)
        freed += statSync(p).size
        rmSync(p, { force: true })
        removed++
      }
      if (removed) {
        console.log(
          `\x1b[32m✓\x1b[0m pruned ${removed} unshipped model file(s) from dist, ` +
            `freeing ${(freed / 1e9).toFixed(2)} GB`,
        )
      }
    },
  }
}


// WebXR requires a secure context. `vite dev` on localhost counts as secure,
// but to test on a Quest / phone over LAN you need HTTPS. Run with `--https`
// or put a self-signed cert behind a tunnel (e.g. `cloudflared`, `ngrok`).
/**
 * Drop the WebXR emulator from production builds.
 *
 * `createXRStore({ emulate: import.meta.env.DEV })` in `BodyScene.tsx` stops the
 * emulator RUNNING in a build, and that alone halved the JavaScript a visitor
 * downloads — measured on a production build served from localhost, **746 KB to
 * 368 KB**, because IWER was being fetched and executed only to then discover a
 * native WebXR runtime was already present.
 *
 * It did not remove the code. `@pmndrs/xr` imports IWER statically, so the module
 * graph kept it and `dist` still carried **5.7 MB** across six chunks: the IWER
 * runtime plus five pre-built synthetic rooms (`music_room`, `living_room`,
 * `office_large`, `meeting_room`, `office_small`). Those rooms are WebXR
 * scene-understanding fixtures — `semanticLabel_META: "COUCH"` is the sort of thing
 * in them. Neither anatomy nor lighting, and the application itself was 1.3 MB, so
 * the app was 16 % of its own JavaScript.
 *
 * Aliasing the IWER packages to an inert stub when building removes them. Dev is
 * untouched, so entering VR from a laptop with no headset still works.
 *
 * ⚠️ Done here, in a command-aware config, and NOT as a plugin with a `config()`
 * hook. That was tried: returning a partial config from a plugin hook reorders the
 * public-directory copy relative to `pruneUnshippedModels`' `closeBundle`, and the
 * build died on a missing `dist/models`. This form has no hook-ordering question.
 */
const IWER_STUB = join(__dirname, 'scripts', 'stubs', 'iwer-empty.ts')

export default defineConfig(({ command }) => ({
  plugins: [react(), pruneUnshippedModels()],
  resolve:
    command === 'build'
      ? {
          alias: [
            { find: /^iwer$/, replacement: IWER_STUB },
            { find: /^iwer\//, replacement: IWER_STUB },
            { find: /^@iwer\/devui$/, replacement: IWER_STUB },
            { find: /^@iwer\/sem$/, replacement: IWER_STUB },
          ],
        }
      : undefined,
  server: {
    host: true, // expose on LAN so a headset on the same network can load it
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
    // Rollup warns above 500 kB and the single app chunk is ~1.33 MB (376 kB
    // gzipped). That was measured rather than assumed, from the build's own
    // sourcemap, and it is the floor for this application rather than slack:
    //
    //   three            1,468 kB   the renderer; 53 % of the bundle on its own
    //   three-stdlib       195 kB   pulled in by the drei controls we use
    //   three-mesh-bvh     146 kB   the raycast accelerator — 311 ms to 0.1 ms
    //   react-dom          138 kB
    //   fiber + xr + …     ~350 kB
    //   this application   ~200 kB
    //
    // drei is tree-shaking correctly — it does not appear as a package, only the
    // pieces the imported components need. So there is no dead weight to remove
    // and the warning has no action behind it.
    //
    // ⚠️ Resist "fixing" this with `manualChunks`. Splitting three.js into a
    // vendor chunk moves bytes between files without removing any: first load
    // fetches the same total, and it introduces a module-initialisation ordering
    // question across react / fiber / drei that the single chunk does not have.
    // It is a caching strategy, not an optimisation, and worth doing only if
    // deploy frequency ever makes cache reuse the bottleneck.
    //
    // The real reduction was the emulator, documented above: 7.0 MB to 1.3 MB.
    chunkSizeWarningLimit: 1500,
  },
}))
