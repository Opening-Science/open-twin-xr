import { useEffect, useMemo, useRef } from 'react'
import { useXR } from '@react-three/xr'
import { CanvasTexture, LinearFilter, type Mesh } from 'three'
import { useTwin } from '../store'
import { anatomicalColor } from './anatomyPalette'

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

const W = 768
const H = 150
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
  const meshRef = useRef<Mesh>(null)

  const sys = useMemo(
    () => (data && selected ? (data.systems.find((s) => s.id === selected) ?? null) : null),
    [data, selected],
  )

  const texture = useMemo(() => {
    if (!sys) return null
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.96)'
    roundRect(ctx, 0, 0, W, H, 34)
    ctx.fill()

    // Tissue hue, matching the body and the swatches in the DOM panel.
    const accent = '#' + anatomicalColor(sys.id).getHexString()
    ctx.fillStyle = accent
    roundRect(ctx, 0, 0, 14, H, 7)
    ctx.fill()

    ctx.textBaseline = 'top'
    ctx.fillStyle = '#1e2a32'
    ctx.font = '600 44px system-ui, -apple-system, Segoe UI, sans-serif'
    ctx.fillText(sys.name, PAD, PAD)

    const tex = new CanvasTexture(canvas)
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    tex.needsUpdate = true
    return tex
  }, [sys])

  useEffect(() => () => texture?.dispose(), [texture])

  // Only inside an immersive session: on a flat screen the Anatomy panel's hover
  // readout already identifies structures, and a second copy floating in the
  // scene is noise.
  if (!session || !sys || !texture) return null

  // Height follows the canvas, which is now a single line of text rather than a
  // card — at the old 0.34 m this would hang 1.7 m wide beside the body.
  const aspect = W / H
  const height = 0.12

  return (
    <mesh ref={meshRef} position={[0.62, 1.25, -0.15]} rotation={[0, -0.42, 0]}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}
