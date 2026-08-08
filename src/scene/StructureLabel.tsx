import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, LinearFilter, type Group } from 'three'
import { useTwin } from '../store'
import { structureTerm } from './structureEntry'

/**
 * A label floating at the selected structure, in the scene rather than in the DOM.
 *
 * WHY IT CAN EXIST NOW AND COULD NOT BEFORE
 * -----------------------------------------
 * `selectedStructure` was component-local `useState` inside `AtlasBody`, so
 * nothing mounted as a sibling could see what was selected. Publishing it is
 * what makes any in-scene annotation possible; this is the first consumer.
 *
 * ⚠️ THE ANCHOR IS FREE, AND THAT IS THE WHOLE TRICK. `StructureEntry.centroid`
 * is the structure's mean vertex position at build time IN CANONICAL METRES, and
 * `AtlasBody` scales every atlas into that same canonical frame inside its own
 * group. `Body.tsx` mounts this at that level, so the centroid can be used as a
 * world position directly — no per-atlas offset table, exactly as the organ
 * overlays need none.
 *
 * ⚠️ ONLY ATLASES WITH A STRUCTURE TABLE CAN BE ANCHORED, and that is a real
 * limit rather than an oversight. `selectedStructure` is published only where a
 * structure table exists, which today is Z-Anatomy and the regions atlas (and
 * BodyParts3D once its asset is rebuilt from the current pipeline). On the
 * node-termed atlases — HRA, HRA-M, both CT builds — a click selects a SYSTEM
 * rather than a structure, and a system has no single position worth pointing at.
 * The label simply does not appear there, rather than pointing somewhere wrong.
 *
 * The text is drawn to a 2D canvas and used as a texture, copying
 * `XRInfoPanel`'s technique exactly: no font file to ship, no CDN fetch at
 * runtime, and no SDF text dependency added for one label.
 */

const W = 512
const H = 128

export function StructureLabel() {
  const selected = useTwin((s) => s.selectedStructure)
  const show = useTwin((s) => s.structureLabel)
  const explode = useTwin((s) => s.explode)
  const ref = useRef<Group>(null)

  const texture = useMemo(() => {
    if (!selected) return null
    const e = selected.entry
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const title = e.name + (e.side ? ` (${e.side})` : '')
    const term = structureTerm(e)

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.94)'
    ctx.beginPath()
    ctx.roundRect(0, 0, W, H, 20)
    ctx.fill()
    // The selection green, matching the highlight on the geometry itself so the
    // label reads as belonging to the thing that just lit up.
    ctx.fillStyle = '#5ad2a8'
    ctx.beginPath()
    ctx.roundRect(0, 0, 10, H, 5)
    ctx.fill()

    ctx.textBaseline = 'top'
    ctx.fillStyle = '#1e2a32'
    let size = 34
    ctx.font = `600 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`
    while (size > 18 && ctx.measureText(title).width > W - 60) {
      size -= 2
      ctx.font = `600 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`
    }
    ctx.fillText(title, 30, 26)

    if (term) {
      ctx.fillStyle = '#5c6b78'
      ctx.font = '400 22px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillText(term, 30, 30 + size + 6)
    }

    const tex = new CanvasTexture(canvas)
    tex.minFilter = LinearFilter
    tex.magFilter = LinearFilter
    tex.needsUpdate = true
    return tex
  }, [selected])

  useEffect(() => () => texture?.dispose(), [texture])

  /**
   * Billboard it.
   *
   * `XRInfoPanel` is fixed-rotation, which is right for a panel parked beside
   * the body and wrong for something pinned to an organ: a fixed label goes
   * edge-on and disappears as soon as the turntable moves. Copying that
   * component's transform would have looked correct only in the pose it was
   * written in.
   */
  useFrame(({ camera }) => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion)
  })

  const centroid = selected?.entry.centroid
  if (!show || !selected || !texture || !centroid) return null

  /**
   * ⚠️ HIDDEN WHILE THE EXPLODED VIEW IS OPEN, deliberately.
   *
   * Per-structure explode is a VERTEX SHADER displacement (`aExplode` in
   * `AtlasBody`), so the geometry moves on the GPU and the scene graph never
   * learns about it. A label placed at the build-time centroid would therefore
   * stay where the structure used to be, pointing confidently at empty space —
   * which is worse than no label, because it looks authoritative.
   *
   * The alternative is to recompute the same offset on the CPU, which means
   * duplicating `EXPLODE_GAIN`, the y damping AND the body centre that
   * `AtlasBody` derives at load across every mesh. Two copies of that rule would
   * drift, and the drift would show up as a label slightly off its organ — the
   * hardest kind of bug to notice. Hiding is the honest option until the offset
   * is published rather than recomputed.
   */
  if (explode > 0.001) return null

  const aspect = W / H
  const height = 0.055

  return (
    <group ref={ref} position={[centroid[0], centroid[1] + 0.06, centroid[2]]}>
      <mesh
        // Decoration: never hit-testable, or it would swallow the click that
        // deselects it and would appear in the hover readout as a structure.
        raycast={() => {}}
        userData={{ __label: true }}
        renderOrder={1000}
      >
        <planeGeometry args={[height * aspect, height]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          // Draw over the anatomy rather than inside it. A label at an organ's
          // centroid is by definition buried in geometry, so depth-testing it
          // would hide the label exactly when it is wanted.
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
