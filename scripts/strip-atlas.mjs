#!/usr/bin/env node
/**
 * Strip render data an anatomy atlas ships but this app never reads.
 *
 * `AtlasBody` replaces every material with a `meshStandardMaterial` whose colour
 * comes from the system's health score. So the atlas's own materials, textures,
 * UVs and vertex colours are never sampled — they are pure payload.
 *
 * On HRA that is measurable: of 195 MB of raw attribute data, TEXCOORD_0 is
 * 20.5 % and COLOR_0 a further 3.9 %, none of it reachable. Positions, indices
 * and normals are kept — normals drive the lighting.
 *
 * Run before the compression step:
 *   node scripts/strip-atlas.mjs public/models/hra.glb public/models/hra.stripped.glb
 */
import { createRequire } from 'node:module'
import { statSync, readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { NodeIO } = require('@gltf-transform/core')

const [src, dst] = process.argv.slice(2)
const joinIdx = process.argv.indexOf('--join-by')
/**
 * Optional: merge every mesh sharing this `extras` key into one.
 *
 * The app selects and colours by SYSTEM, never by individual organ, and each of
 * HRA's `anatomical_structure_of` groups maps wholly to one system — so meshes
 * within a group already behave identically and can be merged with no
 * behavioural change. It is worth doing because 956 small watertight surfaces
 * barely simplify (meshoptimizer cannot collapse across mesh boundaries),
 * whereas 62 large ones do.
 *
 * The cost is that per-organ picking becomes impossible later. Leave it off if
 * you ever want to select a single bone rather than a system.
 */
const JOIN_BY = joinIdx !== -1 ? process.argv[joinIdx + 1] : null

if (!src || !dst) {
  console.error(
    'Usage: node scripts/strip-atlas.mjs <in.glb> <out.glb> [--join-by <extras-key>]',
  )
  process.exit(1)
}

/** Kept because the renderer needs them; everything else goes. */
const KEEP = process.argv.includes('--drop-normals')
  ? new Set(['POSITION'])
  : new Set(['POSITION', 'NORMAL'])

const io = new NodeIO()
const doc = await io.read(src)
const root = doc.getRoot()

let dropped = 0
const droppedNames = new Set()
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    // Materials first: while one references a texture, its UVs count as "used".
    prim.setMaterial(null)
    for (const name of prim.listSemantics()) {
      if (KEEP.has(name)) continue
      prim.setAttribute(name, null)
      droppedNames.add(name)
      dropped++
    }
  }
}

// Now genuinely unreferenced, so these dispose cleanly.
for (const t of root.listTextures()) t.dispose()
for (const m of root.listMaterials()) m.dispose()

/* ------------------------------------------------------- optional join -- */

let joinedFrom = 0
let joinedTo = 0
/**
 * Per-structure identity, preserved across the join.
 *
 * Joining by organ group is what makes HRA affordable to render, and it is also
 * what throws the structure names away — 956 meshes become 96, and hover can
 * only name the group. A per-vertex `_STRUCTURE` id plus a table on the scene
 * gives them back at no draw-call cost.
 *
 * ⚠️ HRA carries `ontologyid` (UBERON) and `label` on every source node, so
 * unlike Z-Anatomy this table can hold the ontology term directly. D11 records
 * the term join as outstanding; for this atlas it is only outstanding because
 * the join discarded it, and this puts it back.
 */
const structures = []

if (JOIN_BY) {
  const scene = root.listScenes()[0]
  /** group key -> nodes carrying it (searching ancestors, as HRA tags leaves) */
  const groups = new Map()
  for (const node of root.listNodes()) {
    if (!node.getMesh()) continue
    let n = node
    let key = null
    while (n && key == null) {
      const v = n.getExtras()?.[JOIN_BY]
      if (typeof v === 'string' && v !== '-' && v !== '') key = v
      n = n.getParentNode?.() ?? null
    }
    if (key == null) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(node)
  }

  const buffer = root.listBuffers()[0] ?? doc.createBuffer()
  for (const [key, nodes] of groups) {
    if (nodes.length < 2) continue
    const pos = []
    const nrm = []
    const idx = []
    const ids = []
    let base = 0
    let hasNormals = true
    for (const node of nodes) {
      // One source node is one structure. Recorded before its vertices are
      // appended so the id is stable regardless of primitive count.
      const ex = node.getExtras() ?? {}
      const id = structures.length
      if (id > 65535) throw new Error('more than 65,536 structures — _STRUCTURE needs uint32')
      structures.push({
        name: typeof ex.label === 'string' ? ex.label : node.getName(),
        ...(typeof ex.ontologyid === 'string' ? { ontologyid: ex.ontologyid } : {}),
        group: key,
      })
      for (const prim of node.getMesh().listPrimitives()) {
        const P = prim.getAttribute('POSITION')
        const N = prim.getAttribute('NORMAL')
        const I = prim.getIndices()
        if (!P) continue
        const pa = P.getArray()
        // Bake the node's own transform in — merged vertices share one node.
        const m = node.getWorldMatrix?.() ?? null
        for (let i = 0; i < pa.length; i += 3) {
          let [x, y, z] = [pa[i], pa[i + 1], pa[i + 2]]
          if (m) {
            const w = [
              m[0] * x + m[4] * y + m[8] * z + m[12],
              m[1] * x + m[5] * y + m[9] * z + m[13],
              m[2] * x + m[6] * y + m[10] * z + m[14],
            ]
            ;[x, y, z] = w
          }
          pos.push(x, y, z)
        }
        // Element-wise, not spread: these arrays run to millions and `push(...)`
        // passes every element as an argument, overflowing the call stack.
        if (N) {
          const na = N.getArray()
          for (let i = 0; i < na.length; i++) nrm.push(na[i])
        } else hasNormals = false
        for (let i = 0; i < pa.length / 3; i++) ids.push(id)
        const ia = I ? I.getArray() : null
        if (ia) for (const v of ia) idx.push(v + base)
        else for (let i = 0; i < pa.length / 3; i++) idx.push(i + base)
        base += pa.length / 3
      }
    }
    if (pos.length === 0) continue

    const prim = doc
      .createPrimitive()
      .setAttribute(
        'POSITION',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer),
      )
      .setIndices(
        doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer),
      )
    if (hasNormals && nrm.length === pos.length) {
      prim.setAttribute(
        'NORMAL',
        doc.createAccessor().setType('VEC3').setArray(new Float32Array(nrm)).setBuffer(buffer),
      )
    }
    // `_`-prefixed per the glTF spec; three lowercases it to `_structure`.
    prim.setAttribute(
      '_STRUCTURE',
      doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(ids)).setBuffer(buffer),
    )
    const merged = doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(prim))
    // Carry the metadata forward, or the renderer can no longer resolve it.
    merged.setExtras({ ...nodes[0].getExtras() })
    scene.addChild(merged)
    for (const n of nodes) n.dispose()
    joinedFrom += nodes.length
    joinedTo += 1
  }
  console.log(`joined by "${JOIN_BY}": ${joinedFrom} meshes -> ${joinedTo} groups`)

  /**
   * The table goes on the SCENE — `AtlasBody` reads `scene.userData`.
   *
   * ⚠️ Only JOINED groups are represented. A group of one node is left untouched
   * above (`nodes.length < 2`), so it keeps its own mesh, its own extras and its
   * own name, and hover already names it correctly without an id. Those
   * structures are deliberately absent from this table rather than silently
   * mis-numbered, and `check-structures.mjs` tolerates it because it validates
   * the ids that exist rather than assuming every mesh carries one.
   */
  root.listScenes()[0].setExtras({
    ...(root.listScenes()[0].getExtras() ?? {}),
    structures,
    structure_attribute: '_STRUCTURE',
  })
  console.log(
    `structure table: ${structures.length.toLocaleString()} entries, ` +
      `${structures.filter((x) => x.ontologyid).length.toLocaleString()} with an ontology term`,
  )
}

// Drop accessors and buffer views left with no owner.
for (const a of root.listAccessors()) if (a.listParents().length <= 1) a.dispose()

/**
 * Stamp the credit into the asset itself.
 *
 * HuBMAP ships the raw HRA GLBs with `asset.copyright` ABSENT — verified on both
 * hra.glb and hra-m.glb, whose whole asset block is `{version, generator}` from
 * the Maya exporter. So there is nothing here to preserve; the credit has to be
 * added, and until it was, both HRA builds shipped with no notice inside the
 * file. The in-app `AttributionBar` covered the rendering case, but a GLB lifted
 * out of `public/models/` carried nothing at all, which is not what CC BY 4.0
 * asks for.
 *
 * The text comes from `licences.json` rather than a constant here, so the
 * register stays the single place a credit line is written. `check-licences.mjs`
 * asserts the result is non-empty on every asset it knows the attribution for.
 */
const existing = root.getAsset().copyright
if (existing?.trim()) {
  console.log(`copyright: preserved from source — ${existing}`)
} else {
  const register = JSON.parse(readFileSync(new URL('../licences.json', import.meta.url), 'utf8'))
  // Match on the FINAL asset name, not this intermediate: convert:hra writes
  // hra.stripped.glb here and hra.ao.glb at the end of the chain, and the
  // register is keyed on what the app actually loads.
  const stem = dst.replace(/\.(stripped|opt|ao)?\.glb$/, '').split('/').pop()
  const entry = register.assets.find((a) => a.file?.includes(`/${stem}.ao.glb`))
  if (entry?.attribution) {
    root.getAsset().copyright = entry.attribution
    console.log(`copyright: stamped from licences.json (${entry.id}) — ${entry.attribution}`)
  } else {
    // Loud, because a silently uncredited asset is a licence breach that looks
    // like nothing at all.
    console.warn(
      `⚠️  NO COPYRIGHT for ${dst}: source carries none and licences.json has no ` +
        `entry matching "${stem}". Add one — this asset will ship uncredited.`,
    )
  }
}

await io.write(dst, doc)

const before = statSync(src).size / 1048576
const after = statSync(dst).size / 1048576
console.log(
  `stripped ${dropped} attribute bindings (${[...droppedNames].join(', ') || 'none'}), ` +
    `${root.listTextures().length} textures and ${root.listMaterials().length} materials remain`,
)
console.log(`${src} ${before.toFixed(1)} MB -> ${dst} ${after.toFixed(1)} MB`)
