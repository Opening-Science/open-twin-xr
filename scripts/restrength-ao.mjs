#!/usr/bin/env node
/**
 * Re-map a baked asset's ambient occlusion to a different `--strength`, without
 * re-casting a single ray.
 *
 * ⚠️ THIS EXISTS BECAUSE THE BAKE IS AN HOUR AND THE DECISION IS AESTHETIC.
 * Judging AO strength means looking at it, and looking at it meant a 52-minute
 * round trip per guess, which in practice means one guess. That is a bad way to
 * pick a number that decides how the whole atlas reads.
 *
 * It works because `bake-ao.mjs` writes a LINEAR function of the occlusion
 * fraction and nothing else:
 *
 *     ao = MIN + (1 - MIN) * (1 - occ * STRENGTH)
 *
 * so `occ` is exactly recoverable from a baked value given the constants it was
 * baked with, and can be re-applied at any other strength:
 *
 *     occ = (1 - (ao - MIN) / (1 - MIN)) / STRENGTH
 *
 * The neighbour smoothing happened BEFORE quantisation, so it survives the
 * round trip untouched — this changes contrast, not structure.
 *
 * WHAT IT CANNOT DO: change `--rays`, `--max-dist` or `--smooth`. Those alter
 * which rays were cast or which neighbours were averaged, and no remap recovers
 * information that was never sampled. Re-bake for those.
 *
 * Precision: values are already 8-bit, and lowering strength NARROWS the range,
 * so the remap cannot introduce banding that was not already there — it maps
 * more input levels onto fewer, never the reverse.
 *
 *   node scripts/restrength-ao.mjs <file.glb> --from 0.85 --to 0.5 [--min 0.35] [--out FILE]
 */
import { statSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : Number(argv[i + 1])
}
const src = argv.find((a) => !a.startsWith('--') && a.endsWith('.glb'))
const outIdx = argv.indexOf('--out')
const OUT = outIdx === -1 ? src : argv[outIdx + 1]
const FROM = flag('from', 0.85)
const TO = flag('to', 0.5)
const MIN = flag('min', 0.35)

if (!src) {
  console.error('Usage: node scripts/restrength-ao.mjs <file.glb> --from 0.85 --to 0.5 [--out FILE]')
  process.exit(1)
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const doc = await io.read(src)
let n = 0
let before = 0
let after = 0

for (const mesh of doc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const c = prim.getAttribute('COLOR_0')
    if (!c) continue
    const el = [0, 0, 0, 0]
    for (let i = 0; i < c.getCount(); i++) {
      c.getElement(i, el)
      const ao = el[0]
      // Recover the occlusion fraction this vertex was baked with, then
      // re-apply it at the new strength. Clamped because 8-bit round-off can
      // put a fully-open vertex a hair above 1.
      const occ = Math.min(1, Math.max(0, (1 - (ao - MIN) / (1 - MIN)) / FROM))
      const next = MIN + (1 - MIN) * (1 - occ * TO)
      before += ao
      after += next
      n++
      el[0] = next
      el[1] = next
      el[2] = next
      c.setElement(i, el)
    }
  }
}

if (!n) {
  console.error(`[restrength] ${src} has no COLOR_0 — nothing to re-map. Bake it first.`)
  process.exit(1)
}

await io.write(OUT, doc)
console.log(
  `[restrength] ${src} strength ${FROM} -> ${TO}: ${n.toLocaleString()} vertices, ` +
    `mean AO ${(before / n).toFixed(3)} -> ${(after / n).toFixed(3)}, ` +
    `floor ${(MIN + (1 - MIN) * (1 - FROM)).toFixed(3)} -> ${(MIN + (1 - MIN) * (1 - TO)).toFixed(3)}`,
)
console.log(`[restrength] wrote ${OUT} (${(statSync(OUT).size / 1e6).toFixed(1)} MB)`)
