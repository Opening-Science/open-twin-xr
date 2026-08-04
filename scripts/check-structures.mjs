#!/usr/bin/env node
/**
 * Validate per-structure identity in an atlas GLB.
 *
 * Run this on the FINAL compressed asset, not the raw build output. The point is
 * to catch the pipeline damaging the ids after they were written correctly:
 *
 *  - **Simplification** run after the merge collapses vertices across structure
 *    boundaries, blending ids and shifting every index range.
 *  - **Welding** merges vertices that match on all attributes. A differing
 *    `_STRUCTURE` should prevent a merge across a boundary — this asserts that
 *    rather than trusting it.
 *  - **Quantisation** should leave `_STRUCTURE` alone (gltf-transform only
 *    quantises POSITION/TEXCOORD/JOINTS/WEIGHTS/COLOR), but a toolchain bump
 *    could change that, and a quantised id is a silently wrong id.
 *
 * None of those fail loudly. The symptom is hover naming the wrong structure,
 * which looks like a mapping bug and is not one. Hence a check that can gate a
 * build.
 *
 * Usage:
 *   node scripts/check-structures.mjs public/models/z-anatomy.ao.glb
 *
 * Exits non-zero on any inconsistency.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const files = process.argv.slice(2)
if (!files.length) {
  console.error('Usage: node scripts/check-structures.mjs <file.glb> [more.glb ...]')
  process.exit(1)
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

let failures = 0
const fail = (msg) => {
  console.error(`  ✗ ${msg}`)
  failures++
}

for (const file of files) {
  console.log(`\n=== ${file}`)
  const doc = await io.read(file)
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0]
  const extras = scene?.getExtras() ?? {}
  const table = extras.structures

  if (!Array.isArray(table) || table.length === 0) {
    console.log('  no structure table — atlas predates phase 1, skipping')
    continue
  }
  console.log(`  table: ${table.length.toLocaleString()} structures`)

  // --- ids present, in range, and every table entry actually used ------------
  const seen = new Set()
  let vertexTotal = 0
  // Meshes that were never joined, so never needed an id. Reported, not failed.
  let unjoined = 0
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    for (const prim of mesh.listPrimitives()) {
      const attr = prim.getAttribute('_STRUCTURE')
      if (!attr) {
        /**
         * ⚠️ NOT A FAILURE, AND CALLING IT ONE COSTS HOURS.
         *
         * `_STRUCTURE` exists to recover identity that JOINING destroys. A mesh
         * that was never joined never lost anything: it keeps its own node, its
         * own name and its own extras — `ontologyid` included — so hover names
         * it correctly with no id at all. `strip-atlas.mjs` leaves single-node
         * groups alone for exactly this reason and says so.
         *
         * Reporting these as ✗ made HRA look like it had 52 broken meshes. It
         * had none; it had 52 meshes that never needed an id. The distinction
         * is between identity LOST and identity NEVER TAKEN AWAY, so an
         * unnamed one is still worth flagging — that genuinely is anonymous.
         */
        if (node.getName()) unjoined++
        else fail(`${node.getName() || '<unnamed>'}: no _STRUCTURE attribute and no name — anonymous`)
        continue
      }
      const pos = prim.getAttribute('POSITION')
      if (attr.getCount() !== pos.getCount()) {
        fail(
          `${node.getName()}: _STRUCTURE has ${attr.getCount()} entries but POSITION has ${pos.getCount()}`,
        )
      }
      vertexTotal += attr.getCount()
      for (let i = 0; i < attr.getCount(); i++) {
        const id = attr.getScalar(i)
        if (!Number.isInteger(id) || id < 0 || id >= table.length) {
          fail(`${node.getName()}: vertex ${i} has out-of-range id ${id}`)
          break
        }
        seen.add(id)
      }
    }
  }

  if (seen.size !== table.length) {
    // An id in the table that no vertex carries means geometry was dropped or
    // merged away after the table was written.
    fail(`${table.length - seen.size} table entr(ies) have no vertices — ids were lost downstream`)
  } else {
    console.log(`  ✓ every one of ${seen.size.toLocaleString()} ids is carried by real vertices`)
  }

  // --- structures stay topologically separate --------------------------------
  // The real risk is a downstream simplify collapsing an edge that joins two
  // structures, which blends their ids. That shows up as a structure whose
  // vertices have scattered into another's territory, so check that each id's
  // vertices still form one compact cluster near the centroid recorded at build
  // time. A blended id drags the cluster far off it.
  const centroidOf = new Map()
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    for (const prim of mesh.listPrimitives()) {
      const attr = prim.getAttribute('_STRUCTURE')
      const pos = prim.getAttribute('POSITION')
      if (!attr || !pos) continue
      // Quantised assets keep the real scale and offset on the NODE, not in the
      // accessor. Reading raw elements reported every structure as having moved
      // by the same ~94 cm, which is the node translation, not any drift.
      const s = node.getScale()
      const t = node.getTranslation()
      const el = [0, 0, 0]
      for (let i = 0; i < attr.getCount(); i++) {
        const id = attr.getScalar(i)
        pos.getElement(i, el)
        const x = el[0] * s[0] + t[0]
        const y = el[1] * s[1] + t[1]
        const z = el[2] * s[2] + t[2]
        const acc = centroidOf.get(id) ?? [0, 0, 0, 0, Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
        acc[0] += x
        acc[1] += y
        acc[2] += z
        acc[3]++
        if (x < acc[4]) acc[4] = x
        if (y < acc[5]) acc[5] = y
        if (z < acc[6]) acc[6] = z
        if (x > acc[7]) acc[7] = x
        if (y > acc[8]) acc[8] = y
        if (z > acc[9]) acc[9] = z
        centroidOf.set(id, acc)
      }
    }
  }
  let drifted = 0
  let worst = 0
  for (const [id, acc] of centroidOf) {
    const want = table[id]?.centroid
    if (!want || !acc[3]) continue
    const d = Math.hypot(acc[0] / acc[3] - want[0], acc[1] / acc[3] - want[1], acc[2] / acc[3] - want[2])
    // Judge drift against the structure's OWN size, not an absolute distance.
    // An absolute 2 cm threshold flagged 16 long thin structures — fibula,
    // plantaris, vastus medialis — where decimating unevenly along a 35 cm bone
    // legitimately moves the centroid a few cm. What is NOT legitimate is the
    // centroid leaving the structure: that means it absorbed another's vertices.
    const diag = Math.hypot(acc[7] - acc[4], acc[8] - acc[5], acc[9] - acc[6])
    const rel = diag > 0 ? d / diag : 0
    worst = Math.max(worst, rel)
    if (rel > 0.25) {
      if (drifted < 5) {
        fail(
          `"${table[id].name}" centroid moved ${(d * 100).toFixed(1)} cm, ` +
            `${(rel * 100).toFixed(0)}% of its own ${(diag * 100).toFixed(1)} cm extent`,
        )
      }
      drifted++
    }
  }
  if (!drifted) {
    console.log(`  \u2713 every structure's vertices still cluster on its centroid (worst drift ${(worst * 100).toFixed(1)}% of extent)`)
  } else if (drifted >= 5) {
    console.error(`  ... and ${drifted - 5} more`)
  }

  console.log(`  ${vertexTotal.toLocaleString()} vertices carry an id`)
  if (unjoined) {
    console.log(
      `  · ${unjoined.toLocaleString()} named mesh(es) were never joined, so carry no id — ` +
        `they keep their own name and extras. Expected, not a fault.`,
    )
  }
}

if (failures) {
  console.error(`\n${failures} problem(s). See docs/ROADMAP.md phase 1.`)
  process.exit(1)
}
console.log('\nStructure identity intact.')
