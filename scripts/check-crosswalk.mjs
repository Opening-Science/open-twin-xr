#!/usr/bin/env node
/**
 * Guard the Z-Anatomy FMA crosswalk against the failure it was measured to have.
 *
 *   npm run check:crosswalk
 *
 * ⚠️ WHAT THIS CATCHES, AND WHY IT IS NOT HYPOTHETICAL. On 9 August 2026 the
 * crosswalk was measured to assign ONE FMA id to SEVERAL DIFFERENT STRUCTURES —
 * 32 ids across 79 rows. `Axillary artery`, `Axillary nerve` and `Axillary vein`
 * all carried FMA:13330/13331; the femoral, radial, ulnar, obturator, plantar and
 * gluteal bundles were collapsed the same way, as were `Trapezoid bone` with
 * `Trapezoid ligament` and `Occipital artery` with `Occipital bone`.
 *
 * These are anatomically distinct structures that merely share a name stem, and
 * the ids had already travelled into the shipped asset. The consequence is the
 * one this repository states everywhere: selecting the femoral artery would
 * identify the femoral NERVE — a wrong ontology id hides the wrong structure, and
 * unlike a missing id it looks authoritative.
 *
 * A term is an IDENTITY. Two structures sharing one is a contradiction in the
 * data, not a rounding error, so this exits non-zero.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const FILE = join(ROOT, 'docs/z-anatomy-fma.tsv')

/**
 * Structures FMA legitimately names ONCE while Z-Anatomy splits the mesh in two.
 *
 * ⚠️ Only unpaired midline anatomy belongs here. The medulla and the pons are
 * single midline structures — Z-Anatomy carries a left and a right half for
 * geometric reasons and FMA has one term for the organ, so both halves sharing it
 * is correct rather than a collapse. This list must never be used to silence a
 * genuine artery/vein/nerve collision; those are different structures.
 */
const MIDLINE_SHARED = new Set(['medulla oblongata', 'pons', 'artery of central sulcus'])

if (!existsSync(FILE)) {
  console.log('no crosswalk on disk — nothing to check')
  process.exit(0)
}

const lines = readFileSync(FILE, 'utf8').split('\n')
const rows = lines
  .filter((l) => l.trim() && !l.startsWith('#'))
  .map((l) => l.split('\t'))
  .filter((c) => c.length >= 3)
  .slice(1)

const byId = new Map()
for (const c of rows) {
  const [name, side, fma] = [c[0].trim(), (c[1] ?? '').trim(), c[2].trim()]
  if (!fma) continue
  if (!byId.has(fma)) byId.set(fma, [])
  byId.get(fma).push({ name, side })
}

const errors = []
const notes = []
for (const [fma, uses] of byId) {
  const names = [...new Set(uses.map((u) => u.name.toLowerCase()))]
  if (names.length > 1) {
    errors.push(
      `${fma} is used for ${names.length} DIFFERENT structures: ${names.join(', ')}. ` +
        `A term is an identity — two structures cannot share one.`,
    )
    continue
  }
  const sides = new Set(uses.map((u) => u.side.toLowerCase()).filter(Boolean))
  if (sides.has('left') && sides.has('right')) {
    if (MIDLINE_SHARED.has(names[0])) {
      notes.push(`${fma} (${names[0]}) spans both sides — allowed: unpaired midline structure`)
    } else {
      errors.push(
        `${fma} (${names[0]}) is used for BOTH left and right. FMA gives left and right ` +
          `different ids, so this collapses laterality — the property the overlays depend on.`,
      )
    }
  }
}

console.log(`crosswalk: ${rows.length} rows, ${byId.size} distinct FMA ids`)
for (const n of notes) console.log(`  · ${n}`)
if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`)
  for (const e of errors) console.error(`  ${e}`)
  process.exit(1)
}
console.log('✓ every FMA id identifies exactly one structure, laterality preserved')
