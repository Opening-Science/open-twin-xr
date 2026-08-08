import { useEffect, useMemo } from 'react'
import { useXR } from '@react-three/xr'
import { CanvasTexture, LinearFilter } from 'three'
import { useTwin } from '../store'
import { anatomicalColor } from './anatomyPalette'
import { structureTerm } from './structureEntry'

/**
 * In-headset label for the selected system.
 *
 * The panel is DOM, so none of it exists inside an immersive session — a user in
 * VR who ray-selects an organ would otherwise get highlight-and-nothing. This
 * names the selected structure as world-space geometry.
 *
 * It used to mirror `DetailPanel`: a score out of ten, a prose health summary,
 * and a SOURCE line naming Oura and VITRONIC BodyLoop. That was removed along
 * with the DOM panel — this viewer shows anatomy, and a fictional sample must
 * not be presented in-headset as though it were the wearer's own health record.
 * What remains is identification, which is an anatomy affordance.
 *
 * Text is drawn to a 2D canvas and used as a texture rather than going through
 * an SDF text library. That keeps the panel self-contained: no font file to
 * ship and no font fetched from a CDN at runtime, matching the same
 * offline-friendly rule that keeps an HDRI out of `BodyScene`.
 */

// Widened from 150 to carry three lines rather than one: the structure name, its
// system/layer/term, and a licence line where the structure has its own. A
// headset cannot scroll a texture, so the panel has to be tall enough for
// everything it may need to say.
const W = 768
const H = 260
const PAD = 44

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function XRInfoPanel() {
  const session = useXR((s) => s.session)
  const data = useTwin((s) => s.data)
  const selected = useTwin((s) => s.selectedSystem)
  const selectedStructure = useTwin((s) => s.selectedStructure)

  const sys = useMemo(
    () => (data && selected ? (data.systems.find((s) => s.id === selected) ?? null) : null),
    [data, selected],
  )

  /**
   * What to show, and this gate is the bug fix.
   *
   * ⚠️ IT USED TO GATE ON `sys` ALONE, WHICH MADE THE PANEL SILENTLY BLANK FOR A
   * LARGE PART OF THE ATLAS. `sys` comes from `data.systems.find(...)` against
   * `selectedSystem`, so any structure resolving to `systemId === null` produced
   * nothing at all in the headset — and unresolved geometry is a DELIBERATE
   * category here, not a mapping failure. That covers all 257 structures of the
   * body-regions atlas and every lymphoid organ: exactly the things a viewer is
   * most likely to point at and ask "what is this".
   *
   * With `selectedStructure` published to the store (it was component-local
   * until now, which is why this could not be fixed before), the structure's own
   * name is available and is the better answer anyway — "Biceps brachii (left)"
   * rather than "Musculoskeletal". The system is the fallback, not the source.
   */
  const title = selectedStructure
    ? selectedStructure.entry.name +
      (selectedStructure.entry.side ? ` (${selectedStructure.entry.side})` : '')
    : (sys?.name ?? null)

  /** The line under the title: system, layer, and the ontology term if there is one. */
  const subtitle = useMemo(() => {
    if (!selectedStructure) return null
    const e = selectedStructure.entry
    const bits = [e.system, e.layer].filter(Boolean) as string[]
    const term = structureTerm(e)
    if (term) bits.push(term)
    return bits.length ? bits.join('  ·  ') : null
  }, [selectedStructure])

  /**
   * The licence, in the headset.
   *
   * Non-commercial components are a per-structure fact (see `structureEntry.ts`),
   * and a viewer in a headset has no credits panel to consult — the DOM does not
   * render in an immersive session at all. If the interface states the licence on
   * a flat screen and not in XR, then the headset is the surface where the
   * obligation quietly goes unmet.
   */
  const licence = selectedStructure?.entry.licence ?? null

  // Accent from the system where there is one; the neutral is for the
  // deliberately-unresolved structures the old gate dropped entirely.
  const accent = sys ? '#' + anatomicalColor(sys.id).getHexString() : '#8e9caa'

  const texture = useMemo(() => {
    if (!title) return null
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    roundRect(ctx, 0, 0, W, H, 34)
    ctx.fill()

    ctx.fillStyle = accent
    roundRect(ctx, 0, 0, 14, H, 7)
    ctx.fill()

    ctx.textBaseline = 'top'
    ctx.fillStyle = '#1e2a32'
    ctx.font = '600 44px system-ui, -apple-system, Segoe UI, sans-serif'
    // Long structure names are common ("Rectus capitis posterior minor"), and a
    // headset gives no way to scroll a texture, so measure and step down rather
    // than let it run off the edge.
    let size = 44
    while (size > 26 && ctx.measureText(title).width > W - PAD * 2) {
      size -= 2
      ctx.font = `600 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`
    }
    ctx.fillText(title, PAD, PAD)

    if (subtitle) {
      ctx.fillStyle = '#5c6b78'
      ctx.font = '400 26px system-ui, -apple-system, Segoe UI, sans-serif'
      ctx.fillText(subtitle, PAD, PAD + size + 12)
    }

    if (licence) {
      ctx.fillStyle = '#8a6d3b'
      ctx.font = '600 24px system-ui, -apple-system, Segoe UI, sans-serif'
      ctx.fillText(licence, PAD, H - PAD - 24)
    }

    const tex = new CanvasTexture(canvas)
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    tex.needsUpdate = true
    return tex
  }, [title, subtitle, licence, accent])

  useEffect(() => () => texture?.dispose(), [texture])

  // Only inside an immersive session: on a flat screen the Anatomy panel's hover
  // readout already identifies structures, and a second copy floating in the
  // scene is noise.
  if (!session || !title || !texture) return null

  // Height follows the canvas so the text never stretches. The panel is now
  // three lines rather than one, so it is taller in metres — but the WIDTH is
  // what has to stay bounded, and at this aspect it is 0.62 m, about an arm's
  // width beside the body rather than the 1.7 m the original 0.34 m would have given.
  const aspect = W / H
  const height = 0.21

  return (
    <mesh position={[0.62, 1.25, -0.15]} rotation={[0, -0.42, 0]}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}
