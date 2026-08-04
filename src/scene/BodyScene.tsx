import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { AgXToneMapping, PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { SCENE_DEFAULTS, registerScene, type DevSceneHandle } from './tuning'
import { useTwin } from '../store'
import { XR, createXRStore, useXR } from '@react-three/xr'
import { Body } from './Body'
import { XRInfoPanel } from './XRInfoPanel'
import { StageBackdrop, StageGround } from './Stage'

/**
 * The 3D stage. One <Canvas> renders the twin for the browser AND for WebXR:
 * the same scene graph is presented immersively when the user enters VR/AR.
 * This is the OpenXR path in embryo. On a Quest browser or Vision Pro, the
 * "Enter VR" button hands off to the device's OpenXR runtime via WebXR.
 */
/**
 * `frameRate: 'low'` — and the previous value here was chosen against a number
 * the library does not produce.
 *
 * This said `'mid'`, described as 72 Hz and a 13.8 ms budget. It is neither.
 * `@pmndrs/xr/dist/store.js` maps the setting to a multiplier — `'high'` 1,
 * `'mid'` 0.5, otherwise 0 — and indexes the headset's own list:
 * `supportedFrameRates[Math.ceil((len - 1) * multiplier)]`. A Quest 3 reports
 * `[72, 80, 90, 120]`, so `'mid'` selects **90 Hz**, an 11.1 ms budget. The
 * comment was describing `'low'`.
 *
 * 72 Hz is what this scene actually wants. It is vertex-bound at over two
 * million triangles, and the whole point of the setting is to stop the runtime
 * asking for a rate the renderer cannot hold — missing 90 Hz reprojects, which
 * looks far worse than holding 72.
 */
/**
 * ⚠️ `emulate` IS THE LARGEST THING IN THE BUNDLE, AND IT IS A DEV TOOL.
 *
 * Left at its default, `createXRStore` pulls in IWER — the Immersive Web Emulation
 * Runtime — plus five pre-built synthetic rooms. Measured in a production build:
 *
 *   emulate      1,320 KB      music_room     2,038 KB
 *   living_room  1,464 KB      office_large     534 KB
 *   meeting_room   399 KB      office_small      95 KB
 *
 * That is **5.7 MB against 1.3 MB for the entire application** — the app was 16 %
 * of its own JavaScript. The rooms are IWER scene-understanding fixtures, not
 * anatomy and not lighting; `semanticLabel_META: "COUCH"` is what is in them.
 *
 * The emulator only ever ACTIVATES "if WebXR is not supported and on localhost",
 * so production never used it. It was shipped anyway, because the option is
 * referenced statically and the bundler cannot know the runtime condition.
 *
 * Tied to `import.meta.env.DEV` rather than deleted, because it is genuinely
 * useful: it is how you enter VR from a laptop with no headset attached. Vite
 * replaces the constant with `false` when building, so the whole subtree drops out
 * of a production bundle and stays available in `npm run dev`.
 */
export const xrStore = createXRStore({ frameRate: 'low', emulate: import.meta.env.DEV })

/**
 * Orbit controls whose target follows the focus height.
 *
 * The target used to be pinned to the chest with panning disabled, so the head
 * and feet were unreachable at any zoom — you could orbit and dolly, but never
 * look at the skull. Now the target tracks `focusY`, dragging with the right
 * button (or two fingers) pans and writes the new height back, and `minDistance`
 * is small enough to get inside a single organ.
 */
function FocusControls() {
  const ref = useRef<OrbitControlsImpl>(null)
  const spin = useTwin((s) => s.spin)
  const focusY = useTwin((s) => s.focusY)
  const focusDistance = useTwin((s) => s.focusDistance)
  const setFocusY = useTwin((s) => s.setFocusY)

  // Follow the slider, without fighting a pan the user is performing.
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dy = focusY - c.target.y
    if (Math.abs(dy) > 0.001) {
      c.target.y = focusY
      c.object.position.y += dy
    }
    // A preset also frames the region; free panning leaves distance alone.
    if (focusDistance != null) {
      const dir = c.object.position.clone().sub(c.target).normalize()
      c.object.position.copy(c.target).addScaledVector(dir, focusDistance)
    }
    c.update()
  }, [focusY, focusDistance])

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      /*
       * Turntable. Rotating the camera rather than the body is what keeps every
       * other feature honest: the structures stay where they are in world space,
       * so the exploded offsets, the selection highlight and the raycast all go
       * on addressing the same geometry. Spinning the body instead would move
       * geometry out from under a highlight that is parented to it.
       *
       * Slow on purpose. This is for reading a body from all sides, not a
       * showreel, and a fast turntable makes structure hard to follow.
       *
       * `autoRotate` needs `update()` every frame, which drei's OrbitControls
       * already calls in its own `useFrame`, so nothing else is required here.
       */
      autoRotate={spin}
      autoRotateSpeed={0.6}
      enablePan
      screenSpacePanning
      minDistance={0.15}
      maxDistance={5}
      target={[0, focusY, 0]}
      onEnd={() => {
        const c = ref.current
        if (c) setFocusY(Number(c.target.y.toFixed(3)))
      }}
    />
  )
}

/**
 * Image-based lighting from three.js's own `RoomEnvironment`.
 *
 * Deliberately NOT an .hdr or .exr file. The obvious route — drei's
 * `<Environment preset>` — fetches from a CDN, which breaks the offline
 * constraint; and shipping an HDRI as a base64 data URI means a new dependency,
 * which on this project means `npm i` re-resolving every caret range in
 * `package.json` at the same time. `RoomEnvironment` is a procedural studio box
 * built from plain meshes, already in three.js, costing zero bytes over the wire
 * and zero new dependencies.
 *
 * The trade is that it is a neutral grey room rather than an authored studio, so
 * reflections carry less character. For anatomy that is close to what you want:
 * the job here is soft directional occlusion and a specular lobe with structure
 * in it, not recognisable surroundings mirrored in a liver.
 *
 * Swapping in a real HDRI later is a one-line change to this component.
 */
function StudioEnvironment({ intensity = SCENE_DEFAULTS.environmentIntensity }: { intensity?: number }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  // `makeDefault` on OrbitControls publishes it here.
  const controls = useThree((s) => s.controls)

  // Dev-only handle for headless checks; see DevSceneHandle in scene/tuning.ts
  // for why a hidden pane makes this necessary.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const w = window as unknown as { __openTwin?: DevSceneHandle }
    w.__openTwin = {
      gl,
      scene,
      camera,
      render: () => gl.render(scene, camera),
      controls: controls as unknown as DevSceneHandle['controls'],
    }
    return () => {
      delete w.__openTwin
    }
  }, [gl, scene, camera, controls])

  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    // Prefiltering happens once, on the GPU, at mount.
    const target = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = target.texture
    scene.environmentIntensity = intensity
    // Dev affordance only; see scene/tuning.ts.
    registerScene({
      getEnvironmentIntensity: () => scene.environmentIntensity,
      setEnvironmentIntensity: (v) => {
        scene.environmentIntensity = v
      },
      getExposure: () => gl.toneMappingExposure,
      setExposure: (v) => {
        gl.toneMappingExposure = v
      },
    })

    return () => {
      scene.environment = null
      target.dispose()
      pmrem.dispose()
      registerScene(null)
    }
  }, [gl, scene, intensity])

  return null
}

/**
 * The canvas clear colour, following the UI theme.
 *
 * Read from the same CSS variable the panels use rather than duplicated as a
 * hex literal here, so the 3D background and the page around it cannot drift
 * apart when one of them is retuned.
 */
function SceneBackground() {
  const theme = useTwin((s) => s.theme)
  const colour = useMemo(() => {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--scene').trim()
    return v || (theme === 'dark' ? '#0e1319' : '#eef3f7')
  }, [theme])
  return <color attach="background" args={[colour]} />
}

/**
 * The soft pool under the feet — rendered ONCE per body change, and never in XR.
 *
 * drei's `ContactShadows` defaults to `frames = Infinity`
 * (`drei/core/ContactShadows.js:9`), which re-renders the WHOLE scene into a
 * render target through `scene.overrideMaterial`, plus two blur passes, on every
 * single frame. Against this atlas that is 2.6 M triangles of shadow pass on top
 * of 2.6 M triangles of beauty pass, for a blob that only changes when the body
 * does. `frames={1}` renders it once; the `key` re-runs that one render when the
 * body actually changes shape.
 *
 * In an immersive session it is not merely expensive, it is WRONG. three's
 * `render()` does `camera = xr.getCamera()` unconditionally while presenting
 * (WebGLRenderer.js), so the orthographic shadow camera drei passes in is
 * discarded and the texture is rendered from the headset's stereo camera
 * instead. Better no shadow than a shadow of the wrong projection, and the
 * frame budget is the tightest there anyway.
 */
function GroundShadow({ theme }: { theme: 'light' | 'dark' }) {
  const session = useXR((s) => s.session)
  const mode = useTwin((s) => s.anatomyMode)
  const sex = useTwin((s) => s.sex)
  const explode = useTwin((s) => s.explode)
  const hiddenLayers = useTwin((s) => s.hiddenLayers)
  if (session) return null
  return (
    <ContactShadows
      // Quantised so dragging the explode slider re-bakes a handful of times
      // rather than on every input event.
      key={`${mode}|${sex}|${Math.round(explode * 4)}|${hiddenLayers.join(',')}|${theme}`}
      frames={1}
      position={[0, 0.005, 0]}
      // Lighter in dark mode: a 0.22 shadow that reads as a soft grounding pool
      // on a pale floor turns into a black hole on a dark one, and detaches the
      // feet rather than planting them.
      opacity={theme === 'dark' ? 0.5 : 0.22}
      color={theme === 'dark' ? '#000000' : '#2a3a46'}
      scale={2.4}
      blur={2.5}
      far={2}
    />
  )
}

/**
 * `firstHitOnly` on the shared raycaster — the half of drei's `<Bvh>` that was
 * doing anything here.
 *
 * three-mesh-bvh's `acceleratedRaycast` reads this flag off the raycaster: with
 * it set, a mesh reports only its nearest hit rather than every triangle the ray
 * crosses on the way through. Hover and click both want the nearest surface, so
 * collecting the rest is work thrown away.
 *
 * It lives at the scene because it is a property of the raycaster, which is
 * shared, while the bounds trees themselves are built per atlas in `AtlasBody` —
 * see the long comment there for why `<Bvh>` could not build them. Harmless for
 * meshes without a tree; nothing else reads it.
 */
function FirstHitOnly() {
  const raycaster = useThree((s) => s.raycaster)
  useEffect(() => {
    raycaster.firstHitOnly = true
    return () => {
      delete raycaster.firstHitOnly
    }
  }, [raycaster])
  return null
}

export function BodyScene() {
  const theme = useTwin((s) => s.theme)
  const stage = useTwin((s) => s.stage)
  return (
    <Canvas
      camera={{ position: [0, 0.92, 2.5], fov: 38 }}
      dpr={[1, 2]}
      // MSAA. In a WebXR session three.js builds the projection layer with
      // `samples: antialias ? 4 : 0`, so this is 4x MSAA in-headset for free —
      // the best antialiasing-per-millisecond available here, and it halves the
      // grain of the stochastic transparency below.
      gl={{ antialias: true, toneMapping: AgXToneMapping, toneMappingExposure: SCENE_DEFAULTS.exposure }}
    >
      <SceneBackground />

      {/*
        IMAGE-BASED LIGHTING — the change the rest of the shading depends on.

        Without an environment map three.js's `lights_fragment_maps` chunk never
        runs: `radiance` and `clearcoatRadiance` are populated only inside
        `#ifdef USE_ENVMAP`, so indirect specular is exactly zero. That is why
        the body read as flat regardless of material settings — and why
        `clearcoat`, `sheen` and `specularColor` would all have been no-ops if
        they had been set first. IBL has to come before the material work, not
        after it.

        The old rig was 1.30 of view-independent fill (ambient 0.8 + hemisphere
        0.5) against 1.70 of directional. Ambient light is a constant added to
        irradiance: it cannot produce a gradient, so it cannot describe a
        surface. Nearly half the light in the scene was actively erasing form.
      */}
      <StudioEnvironment />
      {/* Just enough to keep deep cavities off pure black. The HDRI does the
          work the old 0.8 was doing badly. */}
      <ambientLight intensity={0.05} />
      <directionalLight position={[2.5, 4, 3]} intensity={2.2} />
      {/* Rim only — separates the far side of the body from the background. */}
      <directionalLight position={[-3, 1.5, -2]} intensity={0.35} />

      <XR store={xrStore}>
        {/* The body stands on y=0 in the canonical frame, so no offset here:
            shifting it would break the shared origin the atlas geometry assumes. */}
        {/* Hover brute-forced a raycast against every triangle in the atlas on
            each pointermove — 2.6 M of them, 448 ms a move. The bounding volume
            hierarchy that fixes it is built in `AtlasBody`, because it has to
            follow the geometry rather than the mount; this only sets the
            raycaster flag that stops it collecting hits it would discard. */}
        <FirstHitOnly />
        <Body />
        {/* Controller ray-select comes free: @react-three/xr dispatches R3F
            pointer events from the XR ray pointers, so the same onClick that
            drives mouse selection drives in-headset selection. */}
        <XRInfoPanel />
        {/* Presentation stage, off by default. Mounted BEFORE GroundShadow so the
            contact-shadow bake — which runs once, on the frame after mount — already
            has them in the scene: they are excluded from it by geometry (the floor
            layers sit under its near plane, the backdrop outside its extent), not by
            mounting order, and having them present when it bakes is what proves it.
            See the frustum note in Stage.tsx. */}
        {stage && <StageBackdrop />}
        {stage && <StageGround />}
        <GroundShadow theme={theme} />
      </XR>
      <FocusControls />
    </Canvas>
  )
}
