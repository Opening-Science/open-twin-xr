#!/usr/bin/env node
/**
 * Triangle-winding check for atlas GLBs.
 *
 * Run this after any build that bakes node transforms into vertex positions.
 * Anatomy atlases build the body's second side by MIRRORING the first, and a
 * mirrored (negative-determinant) transform reverses triangle orientation. If
 * the importer flattens the hierarchy without flipping the index order, half the
 * body ends up wound backwards.
 *
 * Why it is worth a dedicated script: the damage is invisible to every obvious
 * check. Triangle counts, vertex counts and surface area all stay symmetric to a
 * fraction of a percent, because a mirrored copy really does have the same
 * amount of geometry. It only shows up once something reads the winding — here,
 * `computeVertexNormals()` in AtlasBody (the GLBs carry no NORMAL) and the
 * hemisphere orientation in `bake-ao.mjs`. On screen it reads as a shading or
 * lighting problem: one smooth, washed-out half of the body with a hard seam
 * down the midline, because `side: FrontSide` culls the inverted faces and you
 * see through to the interior. See D11b.
 *
 * The test: for a closed surface wound outward, the signed volume — the
 * divergence theorem summed over tetrahedra to the origin — is positive. Split
 * the mesh at the midline and compare the two halves. Neither half is closed, so
 * the magnitudes are approximate, but the SIGN is not: two halves of one body
 * disagreeing means one of them is inside-out.
 *
 * SCOPE, honestly: this is a coarse screen for one specific failure — a whole
 * mirrored half being inverted — and it is good at that, because such a half is
 * large and its two sides come out with comparable magnitudes and opposite
 * signs. It is NOT a general winding validator. Signed volume is undefined for
 * open surfaces, so tubes and sheets are excluded by the size floor below rather
 * than judged, and a mesh with a handful of individually flipped triangles will
 * pass. Treat a clean run as "no half is inside-out", not "all winding correct".
 *
 * Usage:
 *   node scripts/check-winding.mjs public/models/*.glb
 *
 * Exits non-zero if any mesh is inconsistent, so it can gate a build.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Usage: node scripts/check-winding.mjs <file.glb> [more.glb ...]')
  process.exit(1)
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

let bad = 0
let checked = 0
let skipped = 0

for (const file of files) {
  const doc = await io.read(file)
  console.log(`\n=== ${file}`)
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    // Quantised assets carry the real scale on the node, not in the accessor.
    const s = node.getScale()
    const t = node.getTranslation()
    let lVol = 0
    let rVol = 0

    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      const idx = prim.getIndices()
      const count = idx ? idx.getCount() : pos.getCount()
      const a = [0, 0, 0]
      const b = [0, 0, 0]
      const c = [0, 0, 0]
      const get = (i, out) => {
        pos.getElement(i, out)
        for (let k = 0; k < 3; k++) out[k] = out[k] * s[k] + t[k]
      }
      for (let i = 0; i < count; i += 3) {
        get(idx ? idx.getScalar(i) : i, a)
        get(idx ? idx.getScalar(i + 1) : i + 1, b)
        get(idx ? idx.getScalar(i + 2) : i + 2, c)
        const v =
          (a[0] * (b[1] * c[2] - b[2] * c[1]) +
            a[1] * (b[2] * c[0] - b[0] * c[2]) +
            a[2] * (b[0] * c[1] - b[1] * c[0])) /
          6
        if ((a[0] + b[0] + c[0]) / 3 < 0) lVol += v
        else rVol += v
      }
    }

    /**
     * Only compare halves that are both substantial.
     *
     * A structure sitting wholly on one side of the midline (a kidney, an eye)
     * has nothing to compare against. So does one that merely clips the midline
     * — the sliver on the far side is dominated by the open cross-section rather
     * than by any real enclosed volume, and its sign is noise. Without this,
     * HRA's `#VHFMainBronchus` and `#VHFNervesLeftEye` report as inverted on
     * volumes of 2e-5, which would block a build over nothing.
     *
     * The real defect this script exists for is not subtle: when a whole
     * mirrored half is inside-out, both halves are large and their magnitudes
     * are comparable (Z-Anatomy's muscle was +0.040 against -0.027).
     */
    const big = Math.max(Math.abs(lVol), Math.abs(rVol))
    const small = Math.min(Math.abs(lVol), Math.abs(rVol))
    // 1e-4 m³ = 100 ml. Below that the signed volume is not trustworthy: many
    // small structures are OPEN surfaces — tubes like the main bronchus, sheets
    // like fascia — and signed volume is undefined for anything not closed, at
    // any size. The floor excludes them rather than pretending to judge them.
    const comparable = small > 0.1 * big && big > 1e-4
    const agree = lVol > 0 === rVol > 0
    const verdict = !comparable
      ? 'one-sided — not comparable'
      : agree
        ? 'consistent'
        : 'OPPOSITE SIGNS'
    if (comparable && !agree) bad++
    if (comparable) checked++
    else skipped++
    console.log(
      `  ${node.getName().padEnd(28)} -x ${lVol.toFixed(5).padStart(10)}   ` +
        `+x ${rVol.toFixed(5).padStart(10)}   ${verdict}`,
    )
  }
}

if (bad) {
  console.error(
    `\n${bad} mesh(es) have mirrored halves wound in opposite directions.\n` +
      `The importer is baking a negative-determinant transform without reversing\n` +
      `triangle order. See D11b in docs/DECISIONS.md.`,
  )
  process.exit(1)
}
/**
 * ⚠️ SAY WHAT WAS ACTUALLY TESTED, NOT "all meshes consistently wound".
 *
 * That old summary claimed far more than this script measures, and it MISLED in
 * practice: ANNY's mesh has 13,706 triangles wound one way against 13,714 the
 * other — inconsistent enough to cancel a signed-volume integral to nothing —
 * and this reported clean throughout, because it never looked.
 *
 * What it compares is the signed volume of the -x half against the +x half. That
 * is a MIRROR-SYMMETRY test for the specific importer bug in D11b, where a
 * negative-determinant transform is baked without reversing triangle order. It
 * is not an orientation check and not a manifold check, and a structure with no
 * mirrored counterpart is skipped entirely rather than judged.
 */
console.log(
  `\nNo mirrored-half inversion detected — ${checked} mesh(es) compared, ${skipped} skipped ` +
    `(one-sided or under the 100 ml floor, so a signed volume says nothing about them).`,
)
console.log(
  '⚠️  This is a MIRROR-SYMMETRY test only. It does not verify that a mesh is\n' +
    '   consistently wound or closed — ANNY passed it while half its triangles\n' +
    '   faced inward. See D18.',
)
