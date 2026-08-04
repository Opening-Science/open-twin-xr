import { useEffect, useMemo } from 'react'
import { useXR } from '@react-three/xr'
import {
  BufferGeometry,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  LinearFilter,
} from 'three'
import { useTwin } from '../store'

/**
 * The stage the body stands on: a ground ring, a soft floor pool, and a
 * background falloff. Decoration only — nothing here is selectable, nothing here
 * carries data, and none of it may be read as a measurement.
 *
 * All three pieces live in the canonical frame (`AtlasBody` normalises every
 * atlas to it: centred in x and z, feet on y=0, 1.70 m tall), so they are
 * correct for every atlas and for `composed` with no per-asset table.
 *
 * ⚠️ THIS IS NOT POST-PROCESSING, AND IT CANNOT BE.
 * The obvious implementation of a vignette is an `EffectComposer` pass, and that
 * route is closed to this repo: `docs/RESOURCES.md:70` records
 * `postprocessing` / `@react-three/postprocessing` as ⛔ — "**Does not work in a
 * WebXR session** — pmndrs/postprocessing#677 open since Jan 2025, pmndrs/xr#128
 * renders nothing in VR." So the falloff is geometry (an inward-facing sphere)
 * for the world-space part and a DOM overlay (`.scene-vignette` in
 * `src/styles.css`) for the screen-space part. Both survive an immersive session,
 * for different reasons — see `useStageVisibility` and the note in `App.tsx`.
 */

/** Brand. The only colour in the stage; everything else is its alpha. */
const STAGE_INK = '#c0beb2'

/**
 * Ring radii, in metres, on a golden progression (×1.618 each step).
 *
 * ⚠️ THE UNEVEN SPACING IS THE POINT. Evenly spaced concentric circles are how
 * every CAD package, every scale bar and every drei `<Grid>` draws a *ruler*, and
 * a viewer who reads this floor as graduated will start measuring an organ
 * against it. Nothing here is calibrated to anything: the atlases are
 * bounding-box registered to one stature (`AtlasBody`, "not good enough to claim
 * anatomical alignment"), so an implied scale would be a lie told in geometry.
 * Accelerating spacing reads as a plinth instead. Never label these, never make
 * the steps equal, and never derive them from the body's dimensions.
 *
 * ⚠️ THE WIDTHS ARE PAINTED-MARKING WIDTHS, NOT HAIRLINES, AND THAT IS MEASURED.
 * The first version of this used 2–7 mm, which is what "subtle" looks like in a
 * plan view and is INVISIBLE here. The default camera sits at eye height 2.5 m
 * out, so the floor is seen at about 12° of incidence: a 7 mm ring foreshortens to
 * 1.5 mm, which at that distance is well under one pixel, and MSAA turns it into a
 * grey smear at a fraction of the intended alpha. Confirmed by screenshot — the
 * rings did not appear at all. Subtlety belongs in the alpha, where foreshortening
 * cannot eat it; the width has to survive the projection.
 */
const RINGS: readonly { radius: number; width: number; light: number; dark: number }[] = [
  { radius: 0.42, width: 0.05, light: 0.42, dark: 0.26 },
  { radius: 0.68, width: 0.035, light: 0.32, dark: 0.19 },
  { radius: 1.1, width: 0.022, light: 0.22, dark: 0.13 },
  { radius: 1.78, width: 0.014, light: 0.14, dark: 0.085 },
]

/** Segments per ring. 128 keeps the largest — 11 m round — smooth, at 9 cm a step. */
const RING_SEGMENTS = 128

/**
 * All four rings as ONE geometry, with each ring's opacity baked into per-vertex
 * alpha.
 *
 * Four `<ringGeometry>` meshes would be four draw calls for 1,024 triangles of
 * decoration — and in an immersive session that is four *per eye*, against a
 * 13.9 ms budget at the 72 Hz `frameRate: 'low'` this scene asks for. three.js
 * defines `USE_COLOR_ALPHA` whenever `material.vertexColors` is on and the colour
 * attribute has `itemSize === 4` (`WebGLPrograms`), and `color_fragment` is then
 * `diffuseColor *= vColor` — alpha included. So the fade per ring costs an
 * attribute, not a draw call.
 *
 * Built in the XZ plane at y=0 rather than as a plane rotated -90°, because the
 * canonical frame is the thing this has to agree with and a rotation is one more
 * place for it to disagree.
 *
 * Vertex colours are NOT colour-managed by three — they are consumed in the
 * linear working space exactly as written. `Color.setStyle` does convert
 * (sRGB → linear, `ColorManagement` is on by default), so reading `.r/.g/.b`
 * off a `Color` built from the hex is the conversion, and `toneMapped={false}`
 * on the material below means the encode step hands back precisely #c0beb2.
 */
function useRingGeometry(theme: 'light' | 'dark'): BufferGeometry {
  const geometry = useMemo(() => {
    const ink = new Color(STAGE_INK)
    const position: number[] = []
    const color: number[] = []
    const index: number[] = []

    for (const ring of RINGS) {
      const base = position.length / 3
      const alpha = theme === 'dark' ? ring.dark : ring.light
      const inner = ring.radius - ring.width / 2
      const outer = ring.radius + ring.width / 2

      for (let i = 0; i <= RING_SEGMENTS; i++) {
        const t = (i / RING_SEGMENTS) * Math.PI * 2
        const cos = Math.cos(t)
        const sin = Math.sin(t)
        position.push(cos * inner, 0, sin * inner)
        position.push(cos * outer, 0, sin * outer)
        color.push(ink.r, ink.g, ink.b, alpha)
        color.push(ink.r, ink.g, ink.b, alpha)
      }
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const a = base + i * 2
        index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3)
      }
    }

    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(position, 3))
    // itemSize 4 — this is what switches on USE_COLOR_ALPHA. Three components
    // here would silently drop the per-ring fade and draw all four at full alpha.
    g.setAttribute('color', new Float32BufferAttribute(color, 4))
    g.setIndex(index)
    return g
  }, [theme])

  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/**
 * A CSS colour for one point on a ramp, as OPAQUE GREY.
 *
 * ⚠️ THE RAMP MUST NOT LIVE IN THE CANVAS ALPHA CHANNEL, AND THIS IS THE WHOLE
 * REASON THIS HELPER EXISTS. The obvious way to author an alpha ramp is
 * `rgba(255,255,255,a)` stops — and it does not work. A 2D canvas stores
 * premultiplied pixels, `texImage2D` uploads with `premultiplyAlpha = false`
 * (three's default), so the browser un-premultiplies on the way out and every
 * pixel with a > 0 comes back with its colour channels restored to ~255. Since
 * `alphamap_fragment` is `diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g`,
 * the sampled ramp is then a near-BINARY mask: full strength everywhere the
 * gradient is not exactly transparent, plus the 8-bit rounding noise of the
 * un-premultiply. That noise is what showed up as horizontal stripes across the
 * background, and it is the ONLY thing that caused them — raising the sphere's
 * tessellation from 20 to 128 segments first, on a Mach-band theory, changed
 * nothing at all.
 *
 * Putting the ramp in the colour channels at alpha 1 removes premultiplication
 * from the question entirely. The texture's `colorSpace` is deliberately left at
 * the default `NoColorSpace`: three would otherwise pick an sRGB internal format
 * and the hardware would decode the values, and these are not colours — they are
 * coefficients, authored directly in the space the shader multiplies in.
 */
function ramp(v: number): string {
  const g = Math.round(v * 255)
  return `rgb(${g},${g},${g})`
}

/**
 * The floor pool's falloff, as a 256² alpha ramp.
 *
 * An `alphaMap`, not a colour map: three samples the GREEN channel
 * (`alphamap_fragment`), so the texture never enters colour management and the
 * pool's tint stays a single `color` on the material — one place to retune, and
 * no chance of the texture and the material disagreeing about colour space.
 *
 * The stops are not a linear ramp. A linear alpha ramp across a disc reads as a
 * hard-edged cone with a visible rim; front-loading the falloff gives the
 * quadratic shoulder that reads as light rather than as a shape.
 *
 * ⚠️ THE ALPHA MUST REACH ZERO BEFORE THE GEOMETRIC RIM. It hits 0 at 0.9 of the
 * texture radius and the last tenth is transparent padding, which looks like waste
 * and is the fix for a real artefact: at 12° of incidence the outer tenth of the
 * disc's radius compresses into a few dozen pixels, so a falloff that is smooth in
 * texture space becomes a visible hard arc across the frame — a saucer edge, not a
 * pool of light. It showed up as a distinct rim in the first screenshot. Fading out
 * early means the compressed band is already fully transparent.
 */
function usePoolTexture(): CanvasTexture | null {
  const texture = useMemo(() => {
    const S = 256
    const canvas = document.createElement('canvas')
    canvas.width = S
    canvas.height = S
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, ramp(1))
    g.addColorStop(0.22, ramp(0.55))
    g.addColorStop(0.45, ramp(0.2))
    g.addColorStop(0.68, ramp(0.055))
    g.addColorStop(0.9, ramp(0))
    g.addColorStop(1, ramp(0))
    ctx.fillStyle = g
    // Black first: the disc is inscribed in the square, and the corners the
    // gradient never reaches would otherwise be whatever the canvas initialised
    // to. Outside the disc they are unsampled by `circleGeometry`'s UVs, but a
    // future `planeGeometry` here would pick them up as a bright square.
    ctx.fillStyle = ramp(0)
    ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)

    const t = new CanvasTexture(canvas)
    // A smooth gradient has no high frequencies to alias, so mipmaps buy nothing
    // and cost a chain plus the upload.
    t.minFilter = LinearFilter
    t.magFilter = LinearFilter
    t.generateMipmaps = false
    t.wrapS = t.wrapT = ClampToEdgeWrapping
    return t
  }, [])

  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

/**
 * The background falloff's ramp, as a 1×256 strip.
 *
 * One pixel wide on purpose: the sphere below is UV-mapped equirectangularly, so
 * u is longitude and v is latitude. A ramp that varies only in v therefore has no
 * seam to align and no orientation — which matters here, because the camera is a
 * turntable (`autoRotate` in `FocusControls`) and any horizontal variation would
 * sweep across the view as it spins and read as the room moving.
 *
 * `CanvasTexture` sets `flipY = true`, so canvas row 0 is v=1. `SphereGeometry`
 * pushes `uv.y = 1 - v` with theta starting at the north pole, so v=1 is the
 * zenith: **canvas top = above the head, canvas bottom = below the feet.**
 */
function useBackdropTexture(theme: 'light' | 'dark'): CanvasTexture | null {
  const texture = useMemo(() => {
    const H = 256
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const g = ctx.createLinearGradient(0, 0, 0, H)
    if (theme === 'dark') {
      // A lift, not a shade: on a near-black scene the body needs something
      // brighter behind it to separate against, and darkening a dark background
      // does nothing except crush the rim light.
      g.addColorStop(0, ramp(0))
      g.addColorStop(0.36, ramp(0.5))
      g.addColorStop(0.52, ramp(0.75))
      g.addColorStop(0.72, ramp(0.4))
      g.addColorStop(1, ramp(0))
    } else {
      // A cove: darker above and below, clear at chest height, so the body reads
      // against the untouched `--scene` colour where it matters.
      //
      // The clear band sits at 0.50, which is the sphere's equator and — with the
      // sphere lifted to BACKDROP_Y — the body's own centre of mass. The stops
      // either side are 0.22 apart rather than adjacent, because the visible 38°
      // of frame only covers about a fifth of this ramp: any tighter and the
      // falloff finishes before it reaches the edge of the picture.
      g.addColorStop(0, ramp(1))
      g.addColorStop(0.28, ramp(0.44))
      g.addColorStop(0.5, ramp(0))
      g.addColorStop(0.72, ramp(0.4))
      g.addColorStop(1, ramp(1))
    }
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1, H)

    const t = new CanvasTexture(canvas)
    t.minFilter = LinearFilter
    t.magFilter = LinearFilter
    t.generateMipmaps = false
    t.wrapS = t.wrapT = ClampToEdgeWrapping
    return t
  }, [theme])

  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

/**
 * Which stage pieces are safe in the current session.
 *
 * ⚠️ A BACKGROUND MESH IN A PASSTHROUGH SESSION PAINTS OVER THE ROOM. In
 * `immersive-ar` the compositor blends the framebuffer with the camera feed, so a
 * 12 m sphere around the viewer is not a backdrop — it is a bag over their head.
 * `XRSession.environmentBlendMode` is the flag that distinguishes the two:
 * `'opaque'` is a VR headset with nothing to occlude, `'alpha-blend'` and
 * `'additive'` are passthrough.
 *
 * The floor goes with it. `@react-three/xr` uses a `local-floor` reference space,
 * so y=0 IS the physical floor and a ring would land on it — but the pool is a
 * fake shadow, and a fake shadow on a real floor next to a real shadow is worse
 * than none. Undefined `environmentBlendMode` is treated as opaque so a runtime
 * that does not implement the AR module still gets the backdrop in VR; if you
 * would rather be strict, `if (session) return { floor: false, backdrop: false }`
 * is the one-line version and matches what `GroundShadow` already does.
 */
function useStageVisibility(): { floor: boolean; backdrop: boolean } {
  const session = useXR((s) => s.session)
  // ⚠️ Hidden in ANY session, not only in passthrough.
  //
  // The passthrough test — `environmentBlendMode` of 'alpha-blend' or 'additive' —
  // is the technically precise one, and it would keep the backdrop in an opaque VR
  // headset where there is nothing to occlude. Two reasons not to:
  //
  //   1. `GroundShadow` in `BodyScene.tsx` already returns null for any session. A
  //      floor treatment that half appears in VR — rings and pool but no contact
  //      shadow — is a worse floor than none.
  //   2. None of this has been seen in a real headset. A 12 m sphere centred on the
  //      viewer is the kind of thing that is fine in a browser and disorienting at
  //      1:1 scale, and that judgement cannot be made from a screenshot.
  //
  // The precise version is one line away when someone can test it:
  //   const blend = session?.environmentBlendMode
  //   const passthrough = blend === 'alpha-blend' || blend === 'additive'
  const visible = !session
  return { floor: visible, backdrop: visible }
}

/**
 * ⚠️ EVERY MESH HERE MUST STAY OUT OF `ContactShadows`' BAKE, AND THE ONLY THING
 * KEEPING IT OUT IS GEOMETRY.
 *
 * drei bakes the pool by setting `scene.overrideMaterial = depthMaterial` and
 * rendering the WHOLE scene through its own orthographic camera
 * (`drei/core/ContactShadows.js`). `overrideMaterial` replaces materials
 * wholesale, so `transparent`, `opacity` and `alphaMap` are all discarded during
 * the bake: anything inside that frustum contributes as SOLID geometry. A
 * backdrop sphere caught by it bakes a black square under the body.
 *
 * As mounted in `BodyScene`, that camera sits at y=0.005 inside a group with
 * `rotation-x = +π/2`, which points its local −Z at world **+Y** — it looks
 * straight up — with `near=0`, `far=2` and a 2.4 × 2.4 lateral extent. So the
 * baked volume is exactly:
 *
 *     x ∈ [−1.2, 1.2]    y ∈ [0.005, 2.005]    z ∈ [−1.2, 1.2]
 *
 * Two rules follow, and both are load-bearing:
 *   1. FLOOR PIECES SIT BELOW y=0.005. Orthographic near-plane clipping removes
 *      them. `RING_Y` and `POOL_Y` below are 1 mm and 2 mm; raising either above
 *      the shadow plane bakes it into its own shadow.
 *   2. THE BACKDROP RADIUS EXCEEDS ~2.4 m. At radius 12 no part of the sphere's
 *      surface is simultaneously within ±1.2 laterally and under 2 m up, so it
 *      contributes nothing. Shrink it below about 2.5 and it will.
 */
const POOL_Y = 0.001
const RING_Y = 0.002

/** Radius of the backdrop sphere, metres. See rule 2 above before changing it. */
const BACKDROP_RADIUS = 12

/**
 * Centred on the body, not on the origin. The sphere's equator is where the ramp
 * is clearest, and the origin is the FEET in this frame — so an uncentred sphere
 * puts the clear band on the floor and the dark cap over the chest.
 */
const BACKDROP_Y = 0.85

/**
 * Ground ring + floor pool.
 *
 * `renderOrder` is explicit because all three floor layers are transparent with
 * `depthWrite: false`, and they are 1–4 mm apart: three sorts transparent objects
 * by `renderOrder` first and only then by depth, so leaving it to a 3 mm depth
 * difference is leaving the stacking order to floating point. Pool (−3) under
 * ring (−2) under `ContactShadows` (0, drei's default) — the shadow is the
 * topmost floor element, because it is the one that plants the feet.
 *
 * `raycast={() => null}` on both. Decoration must not answer a pointer: it would
 * take hover away from the structure behind it, and the invisible deselect plane
 * in `Body.tsx` is what handles clicks on empty space.
 */
export function StageGround() {
  const theme = useTwin((s) => s.theme)
  const { floor } = useStageVisibility()
  const ringGeometry = useRingGeometry(theme)
  const poolTexture = usePoolTexture()

  if (!floor) return null

  return (
    <group>
      {poolTexture && (
        <mesh
          position={[0, POOL_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={-3}
          raycast={() => null}
        >
          {/* 1.8 m radius, of which the ramp only uses 0.9 → 1.62 m of visible
              pool: wider than the shadow's 1.2 m half-extent, so the falloff
              carries on past where the shadow stops rather than ending on the same
              edge and drawing attention to it. */}
          <circleGeometry args={[1.8, 96]} />
          <meshBasicMaterial
            // Same two tints as `GroundShadow`, for the same reason recorded
            // there: a cool ink that grounds on a pale floor becomes a hole on a
            // dark one, so dark mode gets the brand tone lifting instead.
            color={theme === 'dark' ? STAGE_INK : '#2a3a46'}
            alphaMap={poolTexture}
            transparent
            opacity={theme === 'dark' ? 0.1 : 0.18}
            depthWrite={false}
            // DoubleSide because nothing limits the polar angle in
            // `FocusControls` — the viewer can and does orbit under the floor.
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      )}

      <mesh geometry={ringGeometry} position={[0, RING_Y, 0]} renderOrder={-2} raycast={() => null}>
        <meshBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          side={DoubleSide}
          // The rings are a stage affordance, not tissue. AgX would desaturate
          // the brand tone towards grey along with everything else; skipping tone
          // mapping is what keeps #c0beb2 recognisably itself. The trade is that
          // they do not respond to the exposure slider in `MaterialTuner`.
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/**
 * The background falloff — an inward-facing sphere, which is the whole trick.
 *
 * A flat backdrop plane is the cheaper answer and it does not survive this
 * camera: `FocusControls` is a turntable that orbits a full 360°, so a plane
 * would present its edge and then its back. A sphere has no back.
 *
 * `side={DoubleSide}` rather than `BackSide`, because `ContactShadows` is not the
 * only thing that reasons about this mesh — leaving it double-sided means it
 * still reads if the camera is ever pushed outside it, and a texture-less
 * fragment shader has no per-side cost to save.
 *
 * The alpha is zero at both poles by construction, and the ramp never states an
 * absolute colour: it modulates whatever `--scene` already is, through
 * `SceneBackground`. That is deliberate — hard-coding the scene colour here is
 * exactly the drift `SceneBackground`'s own comment refuses to allow, and an
 * alpha ramp does not need to know it.
 */
export function StageBackdrop() {
  const theme = useTwin((s) => s.theme)
  const { backdrop } = useStageVisibility()
  const texture = useBackdropTexture(theme)

  if (!backdrop || !texture) return null

  return (
    <mesh
      position={[0, BACKDROP_Y, 0]}
      // Drawn before everything, including the transparent tissue that would
      // otherwise sort against it at 12 m. −1000 leaves room for anything that
      // wants to sit between the backdrop and the floor.
      renderOrder={-1000}
      raycast={() => null}
      // The bounding sphere encloses the camera, so a frustum test can only ever
      // say "keep it". Skipping the test saves the work of asking.
      frustumCulled={false}
    >
      {/*
        128 height segments, and the honest history is worth recording because the
        first explanation was wrong. Visible horizontal stripes across the chest
        were blamed on tessellation — a UV interpolates linearly across a triangle
        while latitude-to-screen is a cosine, so each band contributes a derivative
        kink, and the eye reads a derivative discontinuity as a Mach band. Raising
        20 segments to 128 CHANGED NOTHING. The stripes were the premultiplied-alpha
        bug in `ramp()`, and fixing that removed them completely.

        The segments stay high anyway: the sphere is 12 m out, so the visible 38° of
        frame covers only about a fifth of the ramp, which is where it is steepest —
        the kink argument is sound even though it was not this bug. 32×128 ≈ 8,200
        triangles, and the vertex cost is irrelevant next to the fill cost, since
        this covers the whole framebuffer, twice in stereo. `widthSegments` stays at
        32 despite u being unused, because a coarser one makes each latitude circle
        a polygon and reintroduces horizontal variation.
      */}
      <sphereGeometry args={[BACKDROP_RADIUS, 32, 128]} />
      <meshBasicMaterial
        color={theme === 'dark' ? STAGE_INK : '#2a3a46'}
        alphaMap={texture}
        transparent
        opacity={theme === 'dark' ? 0.12 : 0.22}
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}
