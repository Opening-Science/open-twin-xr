#!/usr/bin/env node
/**
 * OpenEar temporal bone -> a glTF with PHOTOGRAPHIC colour baked to texture (B3).
 *
 * This is the D4 pilot: does real tissue colour, photographed from a cadaver by
 * micro-slicing, survive this project's mesh pipeline? OpenEar is the small
 * version of that question — one temporal bone rather than a whole body, and
 * CC BY 4.0.
 *
 * ⚠️ THE COLOUR IS NOT IN THE MESHES. Every OpenEar PLY carries `x y z` and a face
 * list, and nothing else: no vertex colour, no UVs, no texture. The colour is a
 * separate 8-bit RGB volume, `Microslicing_Zeta.nrrd`, at 50 µm in plane and
 * 150 µm between slices. So this is a volume-to-surface bake, not an import, and
 * that is exactly why it is a fair rehearsal for D4.
 *
 * ALIGNMENT, WHICH IS THE PART THAT LOOKED HARD AND WAS NOT
 * --------------------------------------------------------
 * The meshes are in **RAS**; every volume is in **LPS**. So the mapping is
 * negate-x-and-y — which is precisely what the archive's own `FlipXY.h5` holds,
 * `diag(-1, -1, 1)`. Verified rather than assumed: after the flip, 400/400 sampled
 * vertices of all twelve meshes fall inside the segmentation volume (0–49 before),
 * and 6,985 of 7,200 fall inside the colour block.
 *
 * The CBCT `BrainsFit`/`InitialGuess` transforms are NOT needed. `05_Registred_
 * Slicer_Volumes` means what it says: those volumes are already resampled into one
 * frame. Composing them would have been the largest correctness risk here, and it
 * turned out to be work that had already been done upstream.
 *
 * A pleasing consequence: the flip's two negations cancel against the volume's own
 * negative x/y direction cosines, so a mesh millimetre maps to a voxel index by
 * plain division. The code below still derives that from the header rather than
 * hardcoding it — the cancellation is a check, not an assumption.
 *
 * SEPARATION, NOT PRE-MULTIPLICATION
 * ----------------------------------
 * Ambient occlusion is deliberately NOT baked into this colour. The atlases carry
 * AO per-vertex in `COLOR_0`, and folding it into the photograph would destroy the
 * measurement this pilot exists to make: you could no longer tell whether the
 * colour survived, because the shading would be inseparable from it. Colour goes
 * to `baseColorTexture`; occlusion stays a separate channel and multiplies at
 * render time.
 *
 * WHERE THERE IS NO COLOUR, SAY SO
 * --------------------------------
 * The micro-sliced block is ~39.6 x 39.6 x 51.8 mm, smaller than the CBCT, so some
 * structures run out of it — the dural sinus most of all. Those texels get a
 * neutral grey and are COUNTED, per structure, into the report and the asset's
 * extras. Inventing a plausible colour there would be the texture equivalent of
 * fabricating a score for a system with no connector.
 *
 * Usage:
 *   node scripts/build-openear.mjs --src ~/Downloads/openear-zeta
 *   node scripts/build-openear.mjs --src DIR --texture 2048
 */
import { createRequire } from 'node:module'
import { readFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs'
import { gunzipSync, deflateSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { join, basename } from 'node:path'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const { Document, NodeIO } = require('@gltf-transform/core')

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i === -1 ? d : argv[i + 1]
}
const SRC = arg('src')
// The RAW bake, with PNG textures. `npm run convert:openear` compresses it to the
// shipped `openear-zeta.glb`; see that script for why lossless.
const OUT = arg('out', 'public/models/openear-zeta.raw.glb')
const TEX = Number(arg('texture', '1024'))
const MM_TO_M = 0.001

if (!SRC || !existsSync(SRC)) {
  console.error('Usage: node scripts/build-openear.mjs --src <dir with OpenEar PLYs + Microslicing_*.nrrd>')
  process.exit(1)
}

// --------------------------------------------------------------------------- //
// NRRD
// --------------------------------------------------------------------------- //
/** Read a gzip-encoded NRRD into a flat buffer plus the physical->index mapping. */
function readNrrd(path) {
  const buf = readFileSync(path)
  const split = buf.indexOf(Buffer.from('\n\n'))
  const head = buf.slice(0, split).toString('latin1')
  const field = (k) => {
    const m = head.match(new RegExp(`^${k}: *(.*)$`, 'm'))
    return m ? m[1].trim() : null
  }
  const sizes = field('sizes').split(/\s+/).map(Number)
  if (field('encoding') !== 'gzip') throw new Error(`unsupported encoding ${field('encoding')}`)
  if (field('type') !== 'unsigned char') throw new Error(`unsupported type ${field('type')}`)
  // `sizes: 3 X Y Z` with `kinds: vector domain domain domain` — the leading 3 is
  // the RGB component, so it is the fastest-varying axis.
  const [comps, X, Y, Z] = sizes
  if (comps !== 3) throw new Error(`expected 3 colour components, got ${comps}`)

  // `space directions: none (a,0,0) (0,b,0) (0,0,c)` — `none` belongs to the
  // component axis. Only the diagonal is used; a rotated volume would need the
  // full 3x3 inverse and this throws rather than quietly mis-sampling.
  const dirs = [...field('space directions').matchAll(/\(([-\d.eE,\s]+)\)/g)].map((m) =>
    m[1].split(',').map(Number),
  )
  if (dirs.length !== 3) throw new Error('expected 3 space directions')
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (i !== j && Math.abs(dirs[i][j]) > 1e-9) throw new Error('volume is rotated; only axis-aligned is handled')
  const step = [dirs[0][0], dirs[1][1], dirs[2][2]]
  const origin = (field('space origin') || '(0,0,0)').replace(/[()]/g, '').split(',').map(Number)

  const data = gunzipSync(buf.slice(split + 2))
  const expect = comps * X * Y * Z
  if (data.length !== expect) throw new Error(`volume is ${data.length} bytes, header implies ${expect}`)
  return { data, X, Y, Z, step, origin, space: field('space') }
}

/**
 * Trilinear RGB at a point given in MESH millimetres.
 *
 * Mesh (RAS) -> volume (LPS) is the FlipXY negation, then LPS -> index is the
 * inverse of the header's origin and step. Both are applied here so the two
 * conventions cannot drift apart in separate places.
 */
function makeSampler(vol) {
  const { data, X, Y, Z, step, origin } = vol
  const idxOf = (p) => [
    (-p[0] - origin[0]) / step[0],
    (-p[1] - origin[1]) / step[1],
    (p[2] - origin[2]) / step[2],
  ]
  const at = (x, y, z, c) => data[((z * Y + y) * X + x) * 3 + c]
  return (p, rgb) => {
    const [fx, fy, fz] = idxOf(p)
    const x0 = Math.floor(fx)
    const y0 = Math.floor(fy)
    const z0 = Math.floor(fz)
    if (x0 < 0 || y0 < 0 || z0 < 0 || x0 + 1 >= X || y0 + 1 >= Y || z0 + 1 >= Z) return false
    const tx = fx - x0
    const ty = fy - y0
    const tz = fz - z0
    for (let c = 0; c < 3; c++) {
      const c00 = at(x0, y0, z0, c) * (1 - tx) + at(x0 + 1, y0, z0, c) * tx
      const c10 = at(x0, y0 + 1, z0, c) * (1 - tx) + at(x0 + 1, y0 + 1, z0, c) * tx
      const c01 = at(x0, y0, z0 + 1, c) * (1 - tx) + at(x0 + 1, y0, z0 + 1, c) * tx
      const c11 = at(x0, y0 + 1, z0 + 1, c) * (1 - tx) + at(x0 + 1, y0 + 1, z0 + 1, c) * tx
      rgb[c] = ((c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz) | 0
    }
    return true
  }
}

// --------------------------------------------------------------------------- //
// PLY
// --------------------------------------------------------------------------- //
function readPly(path) {
  const buf = readFileSync(path)
  const he = buf.indexOf(Buffer.from('end_header\n')) + 'end_header\n'.length
  const head = buf.slice(0, he).toString('latin1')
  if (!/format binary_little_endian/.test(head)) throw new Error(`${path}: not binary LE`)
  const nV = Number(head.match(/element vertex (\d+)/)[1])
  const nF = Number(head.match(/element face (\d+)/)[1])
  const props = [...head.matchAll(/^property (?!list)\w+ (\w+)$/gm)].map((m) => m[1])
  if (props.slice(0, 3).join() !== 'x,y,z') throw new Error(`${path}: props are ${props}`)
  const stride = props.length * 4
  const pos = new Float32Array(nV * 3)
  let o = he
  for (let i = 0; i < nV; i++) {
    pos[i * 3] = buf.readFloatLE(o)
    pos[i * 3 + 1] = buf.readFloatLE(o + 4)
    pos[i * 3 + 2] = buf.readFloatLE(o + 8)
    o += stride
  }
  const idx = new Uint32Array(nF * 3)
  for (let f = 0; f < nF; f++) {
    const n = buf.readUInt8(o)
    o += 1
    if (n !== 3) throw new Error(`${path}: face with ${n} vertices`)
    for (let k = 0; k < 3; k++) idx[f * 3 + k] = buf.readUInt32LE(o + k * 4)
    o += 12
  }
  return { pos, idx }
}

function normals(pos, idx) {
  const n = new Float32Array(pos.length)
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3
    const b = idx[i + 1] * 3
    const c = idx[i + 2] * 3
    const ux = pos[b] - pos[a]
    const uy = pos[b + 1] - pos[a + 1]
    const uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a]
    const vy = pos[c + 1] - pos[a + 1]
    const vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const t of [a, b, c]) {
      n[t] += nx
      n[t + 1] += ny
      n[t + 2] += nz
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
    n[i] /= l
    n[i + 1] /= l
    n[i + 2] /= l
  }
  return n
}

// --------------------------------------------------------------------------- //
// PNG, written by hand
// --------------------------------------------------------------------------- //
/** Minimal RGB8 PNG. No dependency, and the encoder is 20 lines. */
function encodePng(w, h, rgb) {
  const crcTable = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })()
  const crc = (b) => {
    let c = -1
    for (const byte of b) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(body.length)
    const td = Buffer.concat([Buffer.from(type, 'latin1'), body])
    const cr = Buffer.alloc(4)
    cr.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, cr])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // truecolour RGB
  // Filter type 0 on every scanline: no prediction. Bigger than an optimal
  // encoder would make it, and this is an intermediate that KTX2 replaces.
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// --------------------------------------------------------------------------- //
// Build
// --------------------------------------------------------------------------- //
const plys = readdirSync(SRC)
  .filter((f) => f.toLowerCase().endsWith('.ply'))
  .sort()
if (!plys.length) throw new Error(`no .ply files in ${SRC}`)
const nrrd = readdirSync(SRC).find((f) => /Microslicing.*\.nrrd$/i.test(f))
if (!nrrd) throw new Error(`no Microslicing_*.nrrd in ${SRC}`)

console.log(`[openear] reading ${nrrd}`)
const vol = readNrrd(join(SRC, nrrd))
console.log(
  `[openear]   ${vol.X}x${vol.Y}x${vol.Z} RGB, step ${vol.step.map((s) => Math.abs(s)).join(' x ')} mm, ${vol.space}`,
)
const sample = makeSampler(vol)

/**
 * The finest detail the colour source actually holds, in millimetres.
 *
 * Read from the volume rather than written down, because it is what sets every
 * texture size below. In-plane is the limit that matters — this specimen is 50 µm
 * across a slice and 150 µm between them, and a surface bake resolves whichever
 * is finer along the surface.
 */
const VOXEL_MM = Math.min(Math.abs(vol.step[0]), Math.abs(vol.step[1]))

/** Strip OpenEar's numeric prefix: `03_Malleus.ply` -> `Malleus`. */
const label = (f) => basename(f, '.ply').replace(/^\d+_/, '').replace(/_/g, ' ')

/**
 * Stage 1: geometry only, so `gltf-transform unwrap` can add UVs.
 *
 * ⚠️ IN MILLIMETRES, AND THAT IS THE WHOLE FIX. This stage used to convert to
 * metres here, and xatlas then produced usable UVs for exactly ONE of the twelve
 * structures — `Sinus Dura`, the largest. The other eleven came back with a
 * correctly-sized `TEXCOORD_0` accessor in which **every value was NaN**, so every
 * triangle rasterised to nothing and eleven textures baked empty.
 *
 * It is a units problem, not a topology one. A malleus is about 2 mm across, so
 * at metre scale it spans 0.002 model units and its triangles have areas around
 * 1e-8 — under xatlas's internal epsilon for a degenerate face. It finds no chart
 * to build and writes NaN. Measured, by unwrapping the same twelve meshes at three
 * scales:
 *
 *   | positions in | usable UVs |
 *   |---|---|
 *   | metres       | **1 / 12** |
 *   | centimetres  | 12 / 12    |
 *   | millimetres  | **12 / 12** |
 *
 * The earlier note here blamed a shared atlas and proposed unwrapping each
 * structure as its own single-mesh file. That was tested and does NOT help — one
 * mesh per file still gives 1/12, and `--group-by primitive|mesh|scene` all give
 * 1/12 too. Only the scale matters. Recorded because the plausible explanation
 * cost a night and the real one is one multiplication.
 *
 * UVs are scale-invariant, so unwrapping in the source units costs nothing: the
 * positions are converted to metres after the bake, just before writing.
 */
const doc = new Document()
doc.getRoot().getAsset().generator = 'open-twin-openXR build-openear'
const buffer = doc.createBuffer()
const scene = doc.createScene('openear')
doc.getRoot().setDefaultScene(scene)
const acc = (a, t) => doc.createAccessor().setArray(a).setType(t).setBuffer(buffer)

const parts = []
for (const f of plys) {
  const { pos, idx } = readPly(join(SRC, f))
  const nrm = normals(pos, idx)
  const prim = doc
    .createPrimitive()
    .setIndices(acc(idx, 'SCALAR'))
    // Millimetres, as read. See the note above — metres here is what broke it.
    .setAttribute('POSITION', acc(Float32Array.from(pos), 'VEC3'))
    .setAttribute('NORMAL', acc(nrm, 'VEC3'))
  const name = label(f)
  const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim))
  node.setExtras({ label: name, source: 'openear' })
  scene.addChild(node)
  parts.push({ name, prim, mmPos: pos, idx })
  console.log(`[openear]   ${name.padEnd(28)} ${(pos.length / 3).toString().padStart(7)}v ${(idx.length / 3).toString().padStart(7)}f`)
}

const tmp = mkdtempSync(join(tmpdir(), 'openear-'))
const preUv = join(tmp, 'pre.glb')
const postUv = join(tmp, 'post.glb')
await new NodeIO().write(preUv, doc)
console.log(`[openear] unwrapping UVs with xatlas…`)
execFileSync('npx', ['gltf-transform', 'unwrap', preUv, postUv, '--overwrite'], { stdio: 'inherit' })

const uvDoc = await new NodeIO().read(postUv)
const meshes = uvDoc.getRoot().listMeshes()

/** Surface area in mm², from millimetre-scale positions. */
function surfaceAreaMm2(pm, ix) {
  let area = 0
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 3
    const b = ix[t + 1] * 3
    const c = ix[t + 2] * 3
    const ux = pm[b] - pm[a], uy = pm[b + 1] - pm[a + 1], uz = pm[b + 2] - pm[a + 2]
    const vx = pm[c] - pm[a], vy = pm[c + 1] - pm[a + 1], vz = pm[c + 2] - pm[a + 2]
    area += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
  }
  return area
}

/**
 * Texture size PER STRUCTURE, derived from the colour source's own resolution.
 *
 * A flat size is wrong in both directions here, and the structures differ by more
 * than two orders of magnitude in area. The micro-slicing is 50 µm in plane, so a
 * structure of area A mm² holds at most A / 0.05² distinguishable samples — and
 * the stapes, at 23 mm², justifies about 9,000. Giving it 1024² (1,048,576) would
 * not make it sharper; it would resample 9,000 measurements into a million texels
 * and invent every one of the rest. Meanwhile `Sinus Dura` at 7,653 mm² justifies
 * 3.06M and 1024² UNDER-samples it.
 *
 * So the size follows the source. 1.5× headroom because xatlas leaves roughly a
 * third of an atlas empty between charts, rounded up to a power of two, and
 * clamped: never below 128 (a tiny texture reads as blurry regardless of what the
 * data supports) and never above `--texture`, which is a VRAM budget rather than a
 * statement about the data. Where the cap binds it is recorded per structure, so
 * "this is as sharp as the source" and "this is as sharp as we allowed" stay
 * distinguishable.
 */
function textureSideFor(areaMm2) {
  const justified = areaMm2 / (VOXEL_MM * VOXEL_MM)
  let side = 128
  while (side < TEX && side * side < justified * 1.5) side *= 2
  return Math.min(TEX, side)
}

// Stage 2: bake. One texture per structure, sampled from the colour volume.
const rgbTmp = [0, 0, 0]
const report = []
for (const mesh of meshes) {
  const prim = mesh.listPrimitives()[0]
  const uvAttr = prim.getAttribute('TEXCOORD_0')
  if (!uvAttr) {
    console.log(`[openear]   ${mesh.getName()}: NO UVs produced — skipped`)
    continue
  }
  const posAttr = prim.getAttribute('POSITION')
  const index = prim.getIndices()
  const uv = uvAttr.getArray()
  const pm = posAttr.getArray()
  const ix = index.getArray()

  const areaMm2 = surfaceAreaMm2(pm, ix)
  const TX = textureSideFor(areaMm2)
  const sourceLimited = TX < TEX

  const img = Buffer.alloc(TX * TX * 3, 0)
  const covered = new Uint8Array(TX * TX)
  let sourced = 0
  let unsourced = 0

  const P = [0, 0, 0]
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t]
    const b = ix[t + 1]
    const c = ix[t + 2]
    // UV -> texel space. glTF UV origin is top-left, which is also this image's.
    const ax = uv[a * 2] * (TX - 1)
    const ay = uv[a * 2 + 1] * (TX - 1)
    const bx = uv[b * 2] * (TX - 1)
    const by = uv[b * 2 + 1] * (TX - 1)
    const cx = uv[c * 2] * (TX - 1)
    const cy = uv[c * 2 + 1] * (TX - 1)
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)))
    const maxX = Math.min(TX - 1, Math.ceil(Math.max(ax, bx, cx)))
    const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)))
    const maxY = Math.min(TX - 1, Math.ceil(Math.max(ay, by, cy)))
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if (Math.abs(den) < 1e-12) continue
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const sx = px + 0.5
        const sy = py + 0.5
        let w0 = ((by - cy) * (sx - cx) + (cx - bx) * (sy - cy)) / den
        let w1 = ((cy - ay) * (sx - cx) + (ax - cx) * (sy - cy)) / den
        let w2 = 1 - w0 - w1
        // A small negative tolerance closes the one-texel cracks between
        // adjacent triangles that exact containment leaves behind.
        if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue
        w0 = Math.max(0, w0); w1 = Math.max(0, w1); w2 = Math.max(0, w2)
        const s = w0 + w1 + w2 || 1
        for (let k = 0; k < 3; k++) {
          // Already MILLIMETRES, which is the volume's own unit — the conversion
          // to metres happens after the bake, so no rescaling is needed here.
          P[k] = (pm[a * 3 + k] * w0 + pm[b * 3 + k] * w1 + pm[c * 3 + k] * w2) / s
        }
        const o = (py * TX + px) * 3
        if (covered[py * TX + px]) continue
        covered[py * TX + px] = 1
        if (sample(P, rgbTmp)) {
          img[o] = rgbTmp[0]
          img[o + 1] = rgbTmp[1]
          img[o + 2] = rgbTmp[2]
          sourced++
        } else {
          // Outside the micro-sliced block. Neutral grey, and counted — never a
          // guessed colour.
          img[o] = img[o + 1] = img[o + 2] = 128
          unsourced++
        }
      }
    }
  }

  // Dilate into uncovered texels so bilinear filtering does not pull background
  // into the seams. Dilation only fills texels no triangle owns, so it cannot
  // overwrite a real sample or an honest grey.
  for (let pass = 0; pass < 4; pass++) {
    const before = covered.slice()
    for (let y = 0; y < TX; y++) {
      for (let x = 0; x < TX; x++) {
        if (before[y * TX + x]) continue
        let r = 0, g = 0, bl = 0, n = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy, xx = x + dx
            if (yy < 0 || xx < 0 || yy >= TX || xx >= TX || !before[yy * TX + xx]) continue
            const o2 = (yy * TX + xx) * 3
            r += img[o2]; g += img[o2 + 1]; bl += img[o2 + 2]; n++
          }
        if (n) {
          const o = (y * TX + x) * 3
          img[o] = (r / n) | 0; img[o + 1] = (g / n) | 0; img[o + 2] = (bl / n) | 0
          covered[y * TX + x] = 1
        }
      }
    }
  }

  const png = encodePng(TX, TX, img)
  const tex = uvDoc
    .createTexture(`${mesh.getName()} colour`)
    .setImage(png)
    .setMimeType('image/png')
  /**
   * baseColorTexture ONLY. No occlusion is folded in — see the header. The
   * baseColorFactor stays white so the photograph is not tinted by a guess.
   */
  const mat = uvDoc
    .createMaterial(mesh.getName())
    .setBaseColorTexture(tex)
    .setBaseColorFactor([1, 1, 1, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(0.55)
    .setDoubleSided(true)
  prim.setMaterial(mat)

  const total = sourced + unsourced
  report.push({
    name: mesh.getName(),
    sourced,
    unsourced,
    coverage: total ? sourced / total : 0,
    area_mm2: Number(areaMm2.toFixed(1)),
    texture_px: TX,
    // Distinguishes "as sharp as the photograph gets" from "as sharp as the VRAM
    // budget allows". Only the second is a decision of ours to revisit.
    limited_by: sourceLimited ? 'source resolution' : `--texture cap (${TEX})`,
  })
  console.log(
    `[openear]   ${mesh.getName().padEnd(28)} ${String(TX).padStart(4)}²  ` +
      `${areaMm2.toFixed(1).padStart(7)} mm²  texels ${String(total).padStart(8)}  ` +
      `from photograph ${((100 * sourced) / (total || 1)).toFixed(1).padStart(5)}%  ` +
      `no source ${String(unsourced).padStart(7)}`,
  )
}

/**
 * Millimetres -> metres, now that both the unwrap and the bake are done.
 *
 * The unwrap needs source units to find any charts at all (see stage 1) and the
 * sampler needs them to index the volume, so the conversion is deferred to here
 * rather than done on the way in. UVs are unaffected — they are scale-invariant —
 * and the scene ends up in the metres every other asset in this project uses.
 */
let scaled = 0
for (const mesh of uvDoc.getRoot().listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION')
    if (!pos) continue
    const a = pos.getArray()
    for (let i = 0; i < a.length; i++) a[i] *= MM_TO_M
    pos.setArray(a)
    scaled++
  }
}
console.log(`[openear] converted ${scaled} primitive(s) from millimetres to metres`)

uvDoc.getRoot().getAsset().generator = 'open-twin-openXR build-openear (colour from HiP micro-slicing)'
uvDoc.getRoot().getAsset().copyright =
  'OpenEar library of 3D models of the human temporal bone (Sieber et al., MED-EL / University of Bern), ' +
  'CC BY 4.0. Surface colour baked from the same specimen’s true-colour micro-slicing volume.'
uvDoc.getRoot().listScenes()[0].setExtras({
  source: 'OpenEar specimen, CC BY 4.0',
  colour: {
    from: nrrd,
    step_mm: vol.step.map((s) => Math.abs(s)),
    space: vol.space,
    mesh_to_volume: 'RAS -> LPS, i.e. negate x and y (the archive’s FlipXY)',
  },
  /** Occlusion is NOT in this texture. See the note in build-openear.mjs. */
  occlusion: 'not baked into baseColorTexture; keep it a separate channel',
  coverage: report,
})

await new NodeIO().write(OUT, uvDoc)

const tot = report.reduce((a, r) => a + r.sourced + r.unsourced, 0)
const src = report.reduce((a, r) => a + r.sourced, 0)

/**
 * A structure with zero texels is a FAILURE, not a low score.
 *
 * This guard is why the unwrap bug was found at all. The first run reported
 * "59.3 % of texels came from the photograph" and read like a partial success; it
 * was not, because eleven of twelve structures had contributed no texels and the
 * percentage was computed over the one that worked. An average across structures
 * hides a structure that is entirely missing.
 *
 * It now EXITS NON-ZERO. While the cause was unknown a warning was the honest
 * response, since the asset was still worth writing for inspection. The cause is
 * known (units — see stage 1), so a zero-texel structure means something new has
 * broken and the build should say so in a way a script cannot ignore.
 */
const empty = report.filter((r) => r.sourced + r.unsourced === 0)
if (empty.length) {
  console.error(
    `\n[openear] ✗ ${empty.length}/${report.length} structures baked ZERO texels: ` +
      `${empty.map((e) => e.name).join(', ')}\n` +
      `[openear]   Every structure unwrapped and baked before this, so this is a regression, ` +
      `not the known xatlas scale bug. Check that stage 1 still writes MILLIMETRES.`,
  )
  process.exitCode = 1
}

console.log(`\n[openear] wrote ${OUT}`)
const px = report.reduce((a, r) => a + r.texture_px * r.texture_px, 0)
console.log(
  `[openear] ${report.length} structures, textures sized from the source ` +
    `(${Math.min(...report.map((r) => r.texture_px))}²–${Math.max(...report.map((r) => r.texture_px))}², ` +
    `${(px / 1e6).toFixed(1)}M texels vs ${((report.length * TEX * TEX) / 1e6).toFixed(1)}M at a flat ${TEX}²)`,
)
/**
 * Report coverage by SURFACE AREA, not only by texel count.
 *
 * The texel figure is a bad quality metric and moved from 96.0 % to 89.1 % when
 * the textures were resized — nothing about the colour changed, only how many
 * texels each structure contributes to the average. Area weighting asks the
 * question that actually matters: what fraction of this ear's surface has real
 * photographed colour behind it? Both are printed so neither can be mistaken for
 * the other.
 */
const areaTot = report.reduce((a, r) => a + r.area_mm2, 0)
const areaSrc = report.reduce((a, r) => a + r.area_mm2 * r.coverage, 0)
console.log(
  `[openear] ${((100 * areaSrc) / (areaTot || 1)).toFixed(1)}% of the SURFACE has photographed colour ` +
    `(${((100 * src) / (tot || 1)).toFixed(1)}% of texels — texel-weighted, so it moves with texture size)`,
)
const worst = [...report].sort((a, b) => a.coverage - b.coverage).slice(0, 3)
for (const w of worst) {
  console.log(`[openear]   lowest coverage: ${w.name} ${(100 * w.coverage).toFixed(1)}%`)
}
console.log(`[openear] NEXT: npm run convert:openear — lossless WebP to public/models/openear-zeta.glb\n`)
