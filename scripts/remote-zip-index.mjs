#!/usr/bin/env node
/**
 * List a remote ZIP's contents over HTTP range requests, without downloading it.
 *
 *   node scripts/remote-zip-index.mjs <url> <byte-length> > index.json
 *
 * Written for OpenEar (B3), where each specimen is one 3.9-14 GB zip and the part
 * that matters is a few hundred MB. Reusable for any large remote archive: the
 * same problem recurs every time a corpus ships as one file per subject.
 *
 * OpenEar ships one 3.87-64 GB zip per specimen containing raw imaging, voxel data
 * AND the surface models. Only the last of those is wanted, so pulling the whole
 * archive to reach a few hundred MB of meshes would be wasteful. ZIP puts its
 * index at the END, which makes this possible: read the End of Central Directory,
 * then the central directory, then range-fetch only the members needed.
 */
const U = process.argv[2]
const size = Number(process.argv[3])

async function range(lo, hi) {
  const r = await fetch(U, { headers: { Range: `bytes=${lo}-${hi}` } })
  if (!r.ok && r.status !== 206) throw new Error(`range ${lo}-${hi}: HTTP ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

// End of Central Directory lives in the last 64 KB (comment can be up to 64 KB).
const tailLen = Math.min(70_000, size)
const tail = await range(size - tailLen, size - 1)
const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
if (eocd < 0) throw new Error('no EOCD found')
let cdEntries = tail.readUInt16LE(eocd + 10)
let cdSize = tail.readUInt32LE(eocd + 12)
let cdOff = tail.readUInt32LE(eocd + 16)

// ZIP64 takes over when any field is saturated.
const z64loc = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x06, 0x07]))
if (z64loc >= 0 && (cdOff === 0xffffffff || cdSize === 0xffffffff || cdEntries === 0xffff)) {
  const z64Off = Number(tail.readBigUInt64LE(z64loc + 8))
  const z64 = await range(z64Off, z64Off + 55)
  cdEntries = Number(z64.readBigUInt64LE(32))
  cdSize = Number(z64.readBigUInt64LE(40))
  cdOff = Number(z64.readBigUInt64LE(48))
}
console.error(`# central directory: ${cdEntries} entries, ${(cdSize / 1e6).toFixed(1)} MB at ${cdOff}`)

const cd = await range(cdOff, cdOff + cdSize - 1)
const out = []
let p = 0
while (p < cd.length - 4 && cd.readUInt32LE(p) === 0x02014b50) {
  const method = cd.readUInt16LE(p + 10)
  let csize = cd.readUInt32LE(p + 20)
  let usize = cd.readUInt32LE(p + 24)
  const nameLen = cd.readUInt16LE(p + 28)
  const extraLen = cd.readUInt16LE(p + 30)
  const commentLen = cd.readUInt16LE(p + 32)
  let localOff = cd.readUInt32LE(p + 42)
  const name = cd.slice(p + 46, p + 46 + nameLen).toString('utf8')
  // ZIP64 extended information, when the 32-bit fields are saturated.
  if (usize === 0xffffffff || csize === 0xffffffff || localOff === 0xffffffff) {
    let e = p + 46 + nameLen
    const end = e + extraLen
    while (e < end - 3) {
      const id = cd.readUInt16LE(e)
      const sz = cd.readUInt16LE(e + 2)
      if (id === 0x0001) {
        let q = e + 4
        if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8 }
        if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8 }
        if (localOff === 0xffffffff) { localOff = Number(cd.readBigUInt64LE(q)); q += 8 }
      }
      e += 4 + sz
    }
  }
  out.push({ name, method, csize, usize, localOff })
  p += 46 + nameLen + extraLen + commentLen
}
console.log(JSON.stringify(out))
