# Photorealism and personalisation

Research session, 27 July 2026. Six parallel research tracks plus direct
measurement of this repo's own assets and shipped code.

Everything here is either **measured** (from the files in `public/models/`, the
three.js source, or a benchmark run on this machine) or **sourced** (primary
documents, linked). Where a claim is inferred, it says so.

---

## 0. TL;DR

**The clip-art look is not a geometry problem, and it is not an asset-licensing
problem. It is three specific bugs in our own shading, and they are fixed in
`3a484c5`.** The single largest was that we had no environment map, and three.js
computes indirect specular *only* inside `#ifdef USE_ENVMAP` — so it was exactly
zero, and every wet-tissue material property would have been a silent no-op if we
had set it first.

**The best photoreal upgrade available to us costs nothing and is public
domain**: the Visible Human Female cryosections are colour photographs of real
tissue at 0.33 mm, and HRA's organ meshes were modelled from *that same donor*.
Projecting those photographs back onto the meshes derived from them is not "find
a liver texture and hope" — it is restoring the source imagery. Section 4.

**The personalisation roadmap needs one premise corrected.** The best published
model of organ position from body surface (BOSS, Siemens + FAU, 2023) reports
**8.11 mm mean error from height/weight/sex alone, and 8.68 mm from the full 3D
skin surface** — the scan is *slightly worse*. A body scan gives you a real
exterior and genuinely good fat-compartment volumes; it does not tell you where
someone's organs are. Section 6. ⚠️ Both figures are **whole-model and
vertex-weighted**, dominated by well-fitting bone; **organs alone are ~15–25 mm**.
See the correction in §6.1.

**Four systems currently marked "no data" can be filled in a weekend**, without
any mesh work, from one CT through Apache-2.0-licensed TotalSegmentator tasks.
Section 5.1.

---

## 1. What changed tonight

Three commits, each independently revertable.

| Commit | What |
|---|---|
| `be25930` | The placenta was rendering again. Regression from `eebfa24`. |
| `68fc336` | Each atlas now declares its donor; the credits panel states it. |
| `3a484c5` | IBL, wet-tissue materials, stochastic transparency, BVH picking. |

New diagnostic scripts, all standalone: `scripts/atlas-stats.mjs` (what an asset
actually contains), `scripts/glb-header.mjs` (reads a GLB's JSON chunk without
loading its 400 MB payload), `scripts/bake-ao.mjs` (see §3.3).

**Caveat on `3a484c5`: it is typechecked and builds, but was never seen on a
screen.** The browser pane could not paint during this session — `document.hidden`
was true and `requestAnimationFrame` never fired, so every screenshot captured an
unpainted canvas. I spent an hour bisecting a rendering bug that did not exist.
Look at it on a live display first; the material constants are literature
starting points, not values tuned by eye.

---

## 2. Why it looked like clip-art

Measured against the three.js r169 source, not guessed.

**(a) No environment map ⇒ indirect specular is literally zero.**
`ShaderChunk/lights_fragment_maps.glsl.js` populates `radiance` and
`clearcoatRadiance` only inside `#ifdef USE_ENVMAP`. With no IBL, every
non-metal loses the reflection that makes wet things look wet. `clearcoat`,
`sheen`, `iridescence` and `specularColor` are *all* indirect-specular effects,
so setting any of them before adding IBL does nothing at all. **This is why
lighting had to come before materials.**

**(b) Emissive is added completely unlit.** The last line of the physical shader
is `outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance`. We set
`emissive` to the *same colour as the albedo* at intensity 0.15–0.50, which adds
15–50 % of each organ's own colour back as a flat, shadeless wash. It was a
deliberate contrast-removal filter over the entire body.

**(c) The light rig was 43 % form-destroying fill.** `ambient 0.8 + hemisphere
0.5 = 1.30` of view-independent light against `1.2 + 0.5 = 1.70` of directional.
Ambient is a constant added to irradiance — it cannot produce a gradient, so it
cannot describe a surface.

Fix all three and the app looks different before any new asset, any texture, or
any shader is written. That is what `3a484c5` does.

---

## 3. Rendering: ranked plan

Ordered by visual gain per hour. Phase 1 is done; the rest is not.

### Phase 1 — done in `3a484c5`

IBL via `RoomEnvironment` + `PMREMGenerator` (procedural, zero bytes, no new
dependency); ambient 0.8 → 0.05, hemisphere deleted, key 2.2; `AgXToneMapping`
(already in r169 — and it holds red hue into the highlights where ACES pushes
liver and muscle toward orange and clips); `metalness` 0.02 → 0; `ior` 1.38;
per-tissue `clearcoat`; `alphaHash`; `<Bvh firstHitOnly>`.

**On `alphaHash`, because it replaced a hack that could never have worked.**
three.js sorts transparent objects by the projected centre of their bounding
sphere. The skin hull's bounding sphere is centred on the same point as the
liver's. One scalar per object cannot express "this mesh encloses that one", so a
correct draw order **does not exist** for mutually enclosing geometry — this is
not a tuning problem. `alphaHash` (r154+, present in r169) discards fragments
against a hash of *object-space* position: the dither is glued to the surface, so
it does not crawl under orbit, and both eyes in a headset see the same pattern,
so there is no binocular rivalry. Meshes stay in the opaque queue and write
depth, so depth is finally correct for everything downstream.

### Phase 2 — the bakes (~20 h)

**3.1 Vertex ambient occlusion into `COLOR_0`.** The highest-impact item
remaining, and the one that most needs explaining.

Screen-space AO (GTAO/N8AO) is the usual answer and it is closed to us:
**post-processing does not work in a WebXR session.** `pmndrs/postprocessing`
issue #677 is open since Jan 2025 with the maintainer stating the composer needs
`setAnimationLoop` and a non-XR camera; `pmndrs/xr#128` reports `EffectComposer`
in VR rendering nothing at all. Beyond implementation, SSAO computes
independently per eye and produces *different* results per eye — binocular
rivalry, which is actively uncomfortable.

A baked AO *texture* is also closed to us: it needs UVs, and neither atlas has
any (§4.1).

Vertices we do have — 1.31 M of them. `COLOR_0` multiplies base colour when
`material.vertexColors` is true (`diffuseColor *= vColor;`), which is exactly
what an AO term should do. Costs 3 bytes/vertex, survives meshopt, needs no
shader change, works identically on desktop and in a headset.

`scripts/bake-ao.mjs` implements this. It builds one BVH over every triangle in
the file (structures must occlude *each other* — that is the whole point), then
casts a cosine-weighted Hammersley hemisphere per vertex. **Rays are short by
default (2.5 cm on a 1.7 m body)**, which makes it cavity AO rather than global
AO — deliberately, for two reasons: the app lets you hide whole layers, and
global AO would bake one fixed visibility into the vertices so anything under the
skin would stay dark after the skin is switched off; and short-range contact
shadow is the part that actually reads as "solid", where long-range occlusion
just reads as "dim".

A bake was running when this was written. Measured throughput on this machine:
~1,400 vertices/s single-threaded at 24 rays. Worth parallelising across
`worker_threads` before it becomes a routine build step.

**3.2 Fresnel ghost hull for the skin.** Do not alpha-blend it. Render it as a
shell that is near-opaque at silhouettes and near-invisible face-on — the
recognisable medical-visualisation look, and because alpha is ≈0 face-on it
barely triggers dither grain. Two-pass back-then-front (`BackSide` then
`FrontSide`, consecutive `renderOrder`) lets the far body wall glow faintly
through the near one for one extra draw call. Use `NormalBlending`, not additive
— additive never darkens, blows out where rims overlap, and cannot render a dark
skin tone.

**3.3 Thickness + curvature into a `_TISSUE` vertex attribute**, then cheap
subsurface scattering. three.js's own `SubsurfaceScatteringShader` implements the
Barré-Brisebois GDC 2011 approximation — ~5 ALU ops inside the direct-lighting
loop, no extra render pass. Patch it in via `onBeforeCompile` at the
`reflectedLight.directDiffuse += irradiance * BRDF_Lambert(...)` anchor.

⚠️ **`material.customProgramCacheKey` is mandatory here.** three.js keys the
shader program cache on material parameters, not on your patch, so without it
every organ silently gets the first organ's SSS tint. (The old
`material.type = 'unique-string'` trick is dead — `type` became read-only in
r170.)

Thickness is baked the same way as AO but casting *into* the surface along `-n`:
"how much meat is behind this point", which is exactly what the term wants.

**3.4 Triplanar detail without UVs.** Project world position on three axes, blend
by the squared normal, and perturb **roughness and clearcoatRoughness only —
never albedo**, or organs look like granite. Scale ≈ 60–120 for 1–2 cm features
on a 1.7 m body. Feeding baked cavity into the same slot makes crevices both
darker and duller, which is the combination that sells "wet".

### Phase 3 — desktop-only polish, and the pipeline

An `isPresenting`-guarded composer on desktop (N8AO with `aoRadius` in **world
units** ≈ 0.08 — leaving it at the default is the classic mistake — plus Bloom,
AgX, SMAA). And two pipeline corrections:

- **`--simplify-error 0.01` is 100× looser than meshoptimizer's default.** Error
  is a fraction of mesh extent, so on a 15 cm organ that permits ~1.5 mm of
  surface deviation — comparable to the features we are trying to render. Try
  `0.001`. One character, one rebuild.
- **`meshopt_SimplifyPermissive`** (meshoptimizer 1.2+) plus
  `simplifyWithAttributes` lets the simplifier keep the original split normals
  and account for shading error when collapsing across seams. That deletes the
  whole drop-normals → weld → simplify → recompute dance.

### Explicitly do not do

**`transmission` / `MeshTransmissionMaterial`.** When any transmissive object
exists, `WebGLRenderer.renderTransmissionPass()` re-renders the *entire opaque
scene* — and in XR it does so **once per eye**. At our triangle count that is
9.3 M tris/frame on a Quest 3 against a 13.8 ms budget. Organs are not
refractive; they are *scattering*, which is a different phenomenon needing a
different approximation (§3.3).

**Normal-map baking.** Our source has high polygon count, not high surface
detail — it is segmentation- and illustration-derived. Baking would capture
decimation error as a texture.

**`iridescence`** anywhere. It is thin-film interference. There is no anatomical
structure it describes and it reads as an oil slick.

**Gaussian splats.** No per-organ picking, no per-organ recolour, and — decisive
— splats bake `material × illumination` into per-Gaussian spherical harmonics, so
score-driven recolouring is impossible without retraining. That is the product's
entire premise.

**Volume raymarching as the primary view.** A volume has no organ identity, the
stock `VolumeShader` writes no `gl_FragDepth` (so it cannot interleave correctly
with our meshes), and Nyquist-rate marching of a 256³ volume over a quarter of
the Quest 3 stereo view consumes ~100 % of the device's 68 GB/s memory bandwidth
before a single mesh is drawn. Fine as a desktop-only inspection mode later.

### Performance reality

| | Measured | Quest 3 budget | |
|---|---|---|---|
| Draw calls | **11** | < 200 | comfortable |
| Triangles | **2.61 M** (5.23 M stereo) | < 1.5 M/frame | **3.5× over** |

Draw calls are a non-issue since `eebfa24` merged to 11 meshes — so instancing,
`BatchedMesh` and merge-by-material are all pointless here. **Decimation is the
only lever.** Ship a separate XR asset at ratio ≈ 0.3.

Two XR knobs worth knowing: foveation already defaults to 1.0 (maximum) in
`WebXRManager`, so there is no free win there; and `dpr`/`setPixelRatio` do
nothing in XR — the lever is `setFramebufferScaleFactor`, set before the session.

### Version note

three.js is at **r185**; we are on r169, sixteen releases behind. R3F v8.18.0 and
drei v9.122.0 both accept r185 on React 18 — neither pins an upper bound — so the
bump is available without a React 19 migration, and r181 improved indirect
specular and PMREM for free. **WebGPU/TSL is a different matter**: it needs
`await renderer.init()`, which needs R3F v9, which needs React 19. It unlocks a
core `MeshSSSNodeMaterial` and post-processing that actually works in XR, but
sequence it after Phase 2 has proven itself.

---

## 4. Assets: what we have, and the one big opportunity

### 4.1 Measured, not assumed

| | `hra.opt.glb` | `bodyparts3d.opt.glb` |
|---|---|---|
| Meshes (= draw calls) | 96 | **11** |
| Triangles | 2.33 M | 2.61 M |
| **Primitives with UVs** | **0** | **0** |
| Textures | **0** | **0** |
| Raw source | 956 meshes, 151 materials, **0 images**, UVs on **3 %** of primitives | POSITION only |

**Neither atlas has any texture data at all, and essentially no UV
parameterisation.** Photorealism is mostly texture. We have been rendering
untextured geometry under flat light — that is the entire look.

`hra.glb`'s generator string is `babylon.js glTF exporter for Autodesk MAYA
2023.3.5`. HRA is **hand-modelled by a medical illustrator** from Visible Human
cross-sections, not marching-cubes output. That is good news for photorealism:
the topology is clean and the shapes are medically correct.

### 4.2 The two atlases are two different people

| | HRA | BodyParts3D |
|---|---|---|
| Donor | **Visible Human Female** | **TARO**, adult Japanese male |
| Derived from | cryosection photography, **0.33 mm** | whole-body MRI, **2 mm** |
| Sex-specific structures | uterus, ovaries, mammary glands, placenta | prostate, dorsal penile vessels |

This is the "it is mixed" you reported. Pressing a button in the atlas switcher
changes the donor, the sex, and a factor of six in sampling resolution. **2 mm
sampling cannot be retopologised into 0.33 mm detail** — that is a property of
the source data, not of the mesh, and it caps how good BodyParts3D can ever look
close up. It is still the only permissive source for skeletal muscle and the
diaphragm.

`68fc336` makes each source declare its donor and surfaces it in the credits.
That is the honest floor, not the fix — see §8 for the decision.

### 4.3 The commercial fallback, priced

**Zygote** is the quality benchmark: 9.9 M polygons, quad topology built for
subdivision, UVs, 2048² colour and bump maps, "generated through the use of human
specimens". Price is quote-only; the one public figure is "more than $60,000" for
the Premier Collection. **It cannot ship in a public repo under any tier** —
their terms restrict distributing the content or 3D derivatives of it. The only
viable shape is a Real-Time Software Model License with assets served from an
auth-gated CDN, never committed. Worth getting a quote so the number is known.

### 4.4 The opportunity: Visible Human cryosections

This is the strongest single idea in the whole research pass.

The VHP female dataset is **5,189 axial colour photographs of real human tissue
at 0.33 mm**, and since 2019 **no licence is required** — it is US-federal work,
effectively public domain, with attribution merely requested.

The part that makes it unusually strong: **HRA's organ meshes were modelled from
that same donor.** Geometry and colour are already spatially registered to one
body. Stack the cryosections into a 3D colour volume, then sample it at each
mesh's surface points (triplanar, so no unwrap needed) and bake to an atlas. The
result is genuinely photographic albedo with correct per-organ variation, vessel
markings and surface mottling — the exact detail flat colours cannot fake.

Plan for: cryosection colour is post-mortem and frozen, so it is duller and
browner than living tissue and needs a grading pass; slices need de-staircasing
and inter-slice alignment; the volume is tens of GB, so this is strictly an
offline bake.

**Prototype on one organ — the liver — before committing.** Two to three days. If
the liver looks convincing, the method generalises to every reference organ.

⚠️ One licence caveat: NLM publishes VHP under its own Terms & Conditions, *not*
a CC licence. It does not slot into `ASSETS_LICENSE.md`'s CC BY framing without a
sentence of its own.

### 4.5 The musculoskeletal gap has a permissive answer we missed

Open question 3 — HRA has no ribcage, skull, or skeletal muscle — has a source
nobody had checked: the **SPL / Open Anatomy Project atlases** (Brigham & Women's,
Harvard).

The **SPL Abdomen atlas** (34.8 MB) ships **94 named `.vtk` surface meshes** —
`Model_133_right_quadratus_lumborum_muscle`, `Model_241_left_gluteus_maximus_muscle`,
`Model_555_L2-L1-IntervertebralDisc` and so on. Muscles, skeleton, vertebrae,
organs, already segmented and already named. Also available: SPL/NAC Brain
(300+ structures), Liver, Inner Ear, Knee, Thorax.

**The licence is better than CC BY.** All six atlases are under "3D Slicer License
section B", a BSD-style grant that explicitly covers *data*:

> "Brigham hereby grants you, **with right to sublicense** … a royalty-free,
> non-exclusive license to **use, reproduce, make derivative works of, display and
> distribute** the Software" … including the right to "**incorporate the Software
> into proprietary programs**"

**No non-commercial restriction, no share-alike, and sublicensable** — which is
strictly more permissive than the CC BY 4.0 we already accept. Conditions are
attribution, carrying the licence text, and marking modifications.

This deserves evaluating against BodyParts3D before more work goes into the
latter, and it is the strongest candidate for closing the musculoskeletal gap.

### 4.6 Dataset licences, corrected

Three corrections to assumptions floating around this project:

- **AMOS22 is CC BY 4.0**, not CC BY-NC-SA (verified on both Zenodo records). The
  NC-SA belief is probably a conflation with **CHAOS**, which genuinely is
  CC BY-NC-SA 4.0.
- **TotalSegmentator's MRI dataset is CC BY-NC-SA 2.0** while its CT dataset is
  CC BY 4.0. Assuming they match is a trap.
- **MedShapeNet (100k+ ready meshes) is not usable** — the site's only licence
  statement is CC BY-NC-ND, ND forbids sharing adaptations at all, and its own
  per-source licence table has verifiable errors and leaves 10 of 35 sources
  blank. Treat it as a shopping list of upstream sources to verify individually,
  not as a shortcut.

Two structural points worth knowing:

**TCIA licenses per *row*, not per collection.** On several whole-body
collections the images are access-gated but **the segmentation masks are
separately CC BY 4.0 with open downloads** — including
**Healthy-Total-Body-CTs** (30 subjects, 37 tissues, whole body, *healthy*) and
**SAROS** (900 subjects). You can marching-cubes straight from those without ever
touching restricted imaging.

**CC BY 3.0 does not license sui generis database rights; CC BY 4.0 does.** For a
German project that matters — the EU database right is independent of copyright
and is exactly what protects a curated scan collection. Prefer 4.0 sources.

And one licence-detector trap worth naming, because it is the kind of thing that
silently poisons a dependency list: **Deformetrica is not MIT.** GitLab's
auto-detector reports MIT; the actual `LICENSE.txt` reads *"This is a non-free
license … prohibits commercial uses."* PyPI agrees with the file. Never trust a
forge's licence badge over the file.

---

## 5. Personalisation from imaging

### 5.1 The weekend win — no meshes, no GPU

```bash
pip install TotalSegmentator
TotalSegmentator -i ct.nii.gz -o seg --ml --fast --statistics --statistics_extra
```

**~70 seconds on CPU** yields 117 labelled structures plus a `statistics.json`
with per-organ volume in mm³ and centroids. Write an adapter from that into
`TwinMetrics` and it fills **digestive** (liver, gallbladder, pancreas,
stomach, duodenum, bowel, oesophagus, spleen), **endocrine** (thyroid, adrenals),
**reproductive** (prostate), and **integumentary** (the `body` task emits `skin`)
— four systems currently marked "no data at all" — with real measured numbers
rather than proxies.

Highest value per hour in this entire document. No mesh pipeline, no privacy
architecture (sample data only), no renderer change.

### 5.2 The licence fork you must design around

TotalSegmentator's code is Apache-2.0 throughout. **Its weights are not.**

| Free (Apache-2.0) | Licence-gated |
|---|---|
| `total` (117 CT), `total_mr` (50 MR), `body` (incl. **skin**), `lung_vessels`, `liver_segments`, `abdominal_muscles`, `craniofacial_structures`, ~28 tasks | `tissue_types` (**fat/muscle**), `heartchambers_highres`, `appendicular_bones`, `coronary_arteries`, **`face`/`face_mr`** |

The gated set is, unhelpfully, exactly what a body-composition twin wants most.
Note especially that **`face` — the anonymisation mask — is gated**, so we must
not build the privacy layer on it. `brain_aneurysm` is CC BY-NC with **no
commercial licence available at any price**.

**MOOSE 3.2 gives free what TotalSegmentator charges for**: Apache-2.0 code,
**CC BY 4.0 weights**, ~120 classes including heart chambers, peripheral bones
and body composition. Attribution only, no share-alike, no NC. It is the cleanest
licence position available and deserves a serious evaluation against
TotalSegmentator before we commit — because switching later means redoing the
ontology crosswalk (§5.4).

⚠️ Unresolved: TotalSegmentator's MR *training data* is CC BY-NC-SA 2.0 while its
`total_mr` weights are offered as Apache-2.0. Whether trained weights are a
derivative of training data is legally unsettled. Get it in writing before
commercial MR.

### 5.3 Label map → mesh

Use **`vtkSurfaceNets3D`** (VTK 9.3+, BSD-3), not marching cubes. It is the only
filter that meshes all labels in one pass *with shared boundaries* — one polygon
per inter-organ interface, tagged with a `BoundaryLabels` pair. Kitware measured
105 labelled objects from a 317²×835 volume in **~0.1 s**. Every per-organ mesh is
closed by construction, and adjacent organs cannot gap or interpenetrate.

The convention matters: cells with `BoundaryLabels[:,0] == L` face outward,
`[:,1] == L` face inward and need their winding flipped. Getting it backwards
gives half-inverted organs.

**Do not pre-smooth per-label** — Gaussian-smoothing organs A and B separately
and contouring each at 0.5 makes both surfaces retreat from the shared interface,
gapping at concave interfaces and interpenetrating at convex ones.

Two corrections to our existing assumptions:

- **glTF's asset convention is that the front faces +Z**, not −Z (that is the
  *camera* convention, inherited from OpenGL). `HANDOVER_SPEC` has this backwards.
- RAS → glTF is `(x,y,z) → (−x, z, y) × 0.001`. Determinant is **+1**, so winding
  and normals are preserved and need no flip — the reflexive "medical → graphics
  needs a winding flip" instinct is wrong. But **do check the NIfTI affine's
  determinant**: many files store voxels left-handed, and applying such an affine
  *does* mirror the geometry and invert winding.

Keep meshopt over Draco: the decoder is **29 KB vs 251 KB**, one file instead of
two, and 28–61× faster to decode.

⚠️ And keep `--join false --instance false`. `gltf-transform optimize` defaults to
`--join true --flatten true --simplify true --simplify-ratio 0.0`, which would
flatten the hierarchy and destroy the ontology-ID → node-name join.

### 5.4 The ontology join does not come free

TotalSegmentator ships a SNOMED-CT mapping. It does **not** join to UBERON:
TotalSegmentator uses SNOMED *structure* concepts (`liver` → `10200004`) while
UBERON cross-references SNOMED *entire* concepts (`UBERON:0002107` →
`181268008`). Querying EBI OLS4 for `SCTID:10200004` in UBERON returns **zero
rows**; `UBERON:0002113` (kidney) has no SCTID xref at all.

This is the same failure already documented in `hraGroups.ts`. **Hand-curate a
~117-row `class → UBERON` table, once.** It is an afternoon, and it is the real
integration cost of this pipeline.

### 5.5 Privacy — one trap worth naming

A head CT/MRI is a reconstructible face (*NEJM* 2019, 381:1684 — 3D-render the
scan, match against public photographs with off-the-shelf face recognition). A
facial surface mesh is biometric data under GDPR Art. 4(14), and Art. 9
special-category.

**The standard defacing tool chain is commercially unusable**, and this catches
almost everyone: `pydeface` is MIT — but requires FSL's FLIRT, and **FSL is
explicitly non-commercial**. FreeSurfer is not OSI-open either.

**The permissive chain is `SynthStrip → Quickshear`**: SynthStrip's weights are
MIT/CC BY 4.0 and work on CT *and* MR; Quickshear is BSD-3 with only nibabel and
numpy as dependencies. It takes an image plus a brain mask and shears off the
face. No FSL, no FreeSurfer.

Concrete rules for us: never ship a skin or face surface derived from patient
data (use the generic hull); clip or substitute head geometry; strip the
patient→atlas affine before shipping (a transform plus a mesh is closer to the
original than either alone); exclude implants and dental work.

### 5.6 The blend needs correspondence — decide this early

glTF morph targets are `POSITION` deltas, and the spec is normative: *"All morph
target accessors MUST have the same `count` as the accessors of the original
primitive"*, with no `indices` property on targets at all. So **topology is
necessarily shared**. A marching-cubes mesh of a patient liver and the HRA liver
mesh have nothing in common topologically — you cannot morph between them.

**This dictates the pipeline: do not ship the raw extracted mesh. Ship a copy of
the atlas mesh non-rigidly deformed onto the patient's segmentation.** Because
you deform the template and never remesh, vertex correspondence is preserved by
construction — which is simultaneously the morph-target precondition, the
statistical-shape-model precondition, and what keeps the ontology-ID → node
mapping alive.

**Use real glTF morph targets, not a custom attribute.** My first instinct — two
position attributes and a `t` uniform in a custom vertex shader — is wrong, for a
reason specific to this app: **three.js raycasting respects
`morphTargetInfluences`.** `Mesh.getVertexPosition()` reads the morph attributes
and applies them on the CPU, and `computeBoundingBox()` expands over them, so
picking and frustum culling stay correct mid-animation. With a custom
`aPositionTarget` the geometry visibly moves but the raycast still hits the
undeformed shape — organ picking would be silently wrong exactly while the twin
is animating. Given picking is a core feature, that settles it.

Compression cooperates: **`KHR_mesh_quantization` and `EXT_meshopt_compression`
both support morph targets explicitly** (meshopt even recommends a narrower type
for deltas); only Draco does not, and we do not use Draco. Cost is roughly
+16–32 % file size for an int8 target against +100 % for shipping a second GLB —
and the second-GLB cross-fade cannot produce a correct in-between shape anyway,
it just renders two ghosted bodies.

Plan for one gotcha: the morph texture is float32 RGBA regardless of disk
encoding, so ~21 MB VRAM at our 1.31 M vertices, and morph data is immutable
after first render.

### 5.7 Two traps that will cost a day each

**Mirroring.** RAS is right-handed; the naive `(x,y,z) → (x,z,y)` axis swap has
determinant −1 and **silently mirrors the anatomy** — liver moves to the left,
heart apex to the right. The correct conversion negates X:
`(x,y,z)_RAS → (−x, z, y) × 0.001`, determinant +1, winding preserved.
**Write it once, and test it against a known-asymmetric structure before trusting
it.** A mirrored digital twin is a catastrophic, silent, clinically meaningful
bug. Separately, check the NIfTI affine's own determinant — many files store
voxels left-handed, and applying such an affine mirrors again.

**Point transforms run backwards.** ANTs' own source says it outright: *"Points
are transformed in the OPPOSITE direction of images, therefore you should pass
the inverse of what is needed to warp the images."* Combined with the LPS/RAS
question that is two independent sign traps stacked.

### 5.8 Statistical shape models: the numbers, and one design trap

If we go the shape-model route (compact per-patient records, morphable
generic→personal, inference of unscanned organs), these are the verified figures.
Each is from a paper read in full, with its cohort size — because the mode count
means nothing without it.

| Structure | Modes | For | n |
|---|---|---|---|
| Left ventricle | **8** | 90 % | 1,093 |
| Biventricular, ED+ES together | **25** | 90 % | 38,858 |
| Hemipelvis | **15** | 90 % | 200 |
| Whole femur | **7** | 95 % | 209 |
| Acetabulum | **4–5** | 90 % | 67 |
| Lung | first 4 modes reach only **32–36 %** | — | 83 |

**The trap is scale, and it is bigger than the organ.** A 2025 scoping review
measured the same bones both ways: **one** principal component explained >90 % of
variation for *unscaled* models, against **at least 40** for Procrustes-normalised
ones. Mode 1 in an unscaled model is simply "big versus small". So decide whether
you are modelling *shape* or *shape and size* before anyone quotes a number,
because the two differ by a factor of forty.

Note also that lung is strikingly *un*compact — a useful counterexample to the
assumption that ~10 modes covers any organ.

**Abdominal organs are an evidence gap.** Despite targeted searching, there is no
open-access paper reporting a 90/95 % mode count for liver, kidney, spleen or
pancreas. If we need one we will have to measure it ourselves. Treat any such
figure quoted elsewhere as unverified.

**The right formalism for "score what we can see, infer what we cannot" is
posterior shape models** (Albrecht, Lüthi, Gerig & Vetter, *Med Image Anal* 2013).
Conditioning a shape model on partial observations yields a posterior that is
*itself a shape model in the same form*, so it drops into any existing pipeline
unchanged — and the noise term σ² is a genuine, interpretable per-observation
uncertainty, which is exactly the quantity `StructureFit.positionSigma` wants
(§6.6). The naive alternative fails outright: with fewer training shapes than
vertices the distribution is singular and assigns probability exactly zero to a
held-out real shape.

⚠️ And do **not** build a multi-organ model by concatenating organs into one
vector. It "induces anatomical inconsistencies and results in entangled shape
statistics where modes reflect both within- and between-organ variation".
Multi-level models reach 99 % variance in 15 modes where the global concatenation
needs more than 20.

**Two partial-data results worth knowing**, because they set what is achievable
from cheap inputs: biplanar X-ray (EOS) reconstructs bone to **~1.0 mm** mean
surface error; and **LiverUSRecon** (MICCAI 2024, code public) reconstructs a full
3D liver from **three partial ultrasound planes with no probe tracking**, at
6.6 mm mean surface distance, with volumetry **not statistically different from
CT** (p = 0.094). That is the shape of a genuinely cheap personalisation tier —
and it only works because the shape model supplies everything the scan does not
see.

### 5.9 The accuracy ceiling, so nobody promises more

Learn2Reg is the standard benchmark and its **Abdomen CT-CT** task is exactly our
problem: inter-patient abdominal CT, explicitly framed as providing "a canonical
atlas space". **The best method in the world scores Dice 0.69**, against 0.28 for
affine-only. ConvexAdam (Apache-2.0, `pip install convexAdam`, 2.75 s) is that
method; deedsBCV (MIT, CPU, 15–60 s) is the best classical one and beats
NiftyReg and ANTs substantially on abdomen.

Practically: a generic atlas deformed onto a patient will be roughly right for
liver, kidneys and spleen and roughly wrong for pancreas, adrenals, gallbladder
and bowel. **Do not promise per-organ anatomical fidelity from image registration
alone.**

One structural lever that helps more than any algorithm choice: **register the
labels, not the intensities.** CT soft tissue is nearly isodense (liver ≈ spleen
≈ kidney ≈ 40–60 HU), so an intensity metric has almost no signal in the abdomen,
while a TotalSegmentator label map has enormous signal. ConvexAdam has a
label-driven mode built in. A UK Biobank study adding tissue masks to whole-body
MRI registration measured **+6 pp Dice over intensity-only and +9–12 pp over
uniGradICON**.

And design around pose rather than solving it: arms-up is standard clinical CT,
arms-down is standard atlas, and no smooth deformation connects them. Mask to
TotalSegmentator's `body_trunc` (Apache-2.0), register the torso only, and leave
the atlas arms generic. No clinically meaningful signal lives in arm pose.

---

## 6. Personalisation from a body scan — the honest answer

### 6.1 The finding that reframes the roadmap

**BOSS** (Shetty et al., FAU Erlangen + Siemens Healthineers, *Computers in
Biology and Medicine* 165, 2023) is the only published model that predicts
organ-level anatomy from exterior information. Trained on 306 CT scans, built on
SMPL. Its key experiment:

> "We observe an average overall error of **8.11 mm and 8.68 mm using metadata
> and skin surface**, respectively."

**Height, weight and sex beat the full 3D skin surface.** Not by much, but the
direction is the point: the bottleneck is not input richness. Individual organ
position genuinely does not correlate with body surface beyond what body size
already tells you.

> ⚠️ **Correction, 8 August 2026 — the quote is right, this section's reading of it
> was not.** The paper was read in full and 8.11 / 8.68 mm are **whole-model,
> vertex-weighted** figures. Bone is **65,617 of the template's 104,546 vertices, 63 %**,
> and bone is the part that fits well. Read off Fig. 7b, the skin-surface error is
> ~6–7 mm for vertebrae, pelvis and skeleton but **~15–25 mm for liver, kidneys, spleen
> and heart**. **These are not organ figures**, and this document and
> `docs/RESOURCES.md` both presented them as though they were. The conclusion is
> unaffected and in fact strengthened — the true organ gap is two to three times wider
> than the headline suggests. Full assessment, including why nothing was ever released
> and what *is* reusable from the paper, in `docs/research/ORGAN_SHAPE_MODELS.md` §4c.

Corroborating: **HIT** (CVPR 2024, Max Planck) — the paper that looks like it
answers this question — lumps every organ into one undifferentiated "lean tissue"
class, explicitly drops visceral-fat localisation, and reports that its volume
predictions are "on par with the Chance baseline (or even under-performs it for
female SAT)". **OSSO** gets bone landmarks to 8.0–8.4 mm but is skeleton-only.

And the noise floor: **breathing moves the liver 1.3–2.7 cm every breath**, while
supine → upright shifts it about 1.5 mm. Posture-driven visceral repositioning
operates *below* the respiratory noise floor. Use posture to drive skeletal pose;
do not move organs with it.

### 6.2 What a scan genuinely buys

Fat compartments, and they are excellent. Klarqvist et al., *npj Digital
Medicine* 2022, **n = 40,032** UK Biobank, silhouette → CNN:

| Target | Silhouette R² | Waist alone | BMI alone |
|---|---|---|---|
| **VAT** (visceral) | **0.885** | 0.637 | 0.608 |
| **ASAT** (subcutaneous) | **0.934** | — | 0.833 |
| **GFAT** (gluteofemoral) | **0.932** | — | — |

Predicted VAT/ASAT ratio associated with T2D and CAD **independent of BMI and
waist**. This is a real, defensible, clinically meaningful product feature.

**Ship it as numbers before you ship it as geometry.**

⚠️ And be careful with BIA (smart scales): it underestimates body-fat % by
3.6–4.3 percentage points and **overestimates appendicular lean mass index by
~2.9 kg/m²** — which is 40–55 % of the entire sarcopenia diagnostic threshold, in
the direction that *hides* sarcopenia. Either device-correct it or render no
sarcopenia judgement at all.

### 6.3 The parametric body model licence wall

**Exactly one option is commercially usable: MakeHuman / MPFB2.** Its base mesh
*and its morph targets* are CC0 1.0, and the current licence explicitly covers
assets generated via scripting, not just the GUI export — the widely-repeated
"official unmodified build only" caveat is obsolete.

Everything else is closed: SMPL, SMPL-X, SMPL+H, STAR, SUPR are non-commercial
(commercial licensing via Meshcapade, price unpublished); GHUM states no licence
at all; TailorMe is CC BY-NC-SA; OSSO, SKEL, HIT and BOSS all inherit SMPL.

⚠️ **Two precisions added 8 August 2026, both verified from `LICENSE` bodies.** OSSO and
SKEL are **not merely non-commercial — they bar copying, distributing and
sub-licensing outright**, which is a different and stricter class, and the one D12b
cannot reach at all. HIT is the opposite: its *code* licence is a BSD-3 variant that
**does** permit redistribution with notice, and the real blocker is its SMPL dependency
plus registration-gated weights. ✅ And two **Apache-2.0** additions that were not on
this list: **SOMA-X** (NVIDIA), which unifies the already-shipped ANNY with MHR and SMPL
under one rig, and **MHR** (Meta). Neither has viscera.

"Targets and modifiers" is the load-bearing phrase — morph targets on a
fixed-topology base mesh *are* a parametric shape space. Reimplement blendshape
evaluation in TypeScript and the result is shippable. For statistical calibration,
regress the slider space against **ANSUR II** and **NHANES**, both public domain.

### 6.4 Correction to the spec

`HANDOVER_SPEC` describes VITRONIC BodyLoop as posture geometry rather than a
surface scanner. VITRONIC describe it as optical 3D triangulation, 360° in under
a second, outputting distances, circumferences, angles and body statics — the
successor to the VITUS line. So it gives **anthropometrics and an exterior
surface**, which is genuinely useful, and **no vertebral geometry**. Its
advertised "muscle volume change" is a *surface* volume change; do not surface it
as muscle volume.

For the ceiling on any optical spine inference: DIERS rasterstereography — the
purpose-built system — correlates with radiographic Cobb angle at R = 0.70, i.e.
**R² ≈ 0.49**.

### 6.5 The personalisation ladder

| Tier | Input | What actually changes | Honest label |
|---|---|---|---|
| 0 | none | reference anatomy, sex-specific | "Reference anatomy — not your body" |
| 1 | age, sex, height, weight | whole-body scale; organ size by allometry | "Scaled to your height and weight" |
| 2 | + DXA / BIA | SAT shell thickness and VAT fill scaled to **measured** volumes | "Fat volume measured; distribution is a typical pattern" |
| 3 | + body scan | exterior mesh is real; VAT/ASAT/GFAT measured | "Your body shape is measured. **Organ positions are still typical.**" |
| 4 | + regional imaging | true L3 muscle area, true VAT | "Measured at one level" |
| 5 | full-body MRI/CT | actual organ meshes | "Your anatomy" |

**Tier 3 does not improve organ position over tier 1.** Selling a scan as "now we
know where your organs are" would be false. Sell it as what it is.

### 6.6 Applying "never fabricate" to geometry

The existing rule (`hasData: false, score: null`, never a midpoint) has a clean
geometric analogue. **A morphed organ is an honest estimate when its displayed
uncertainty covers the truth, and a fabrication when it is rendered as crisply as
a measured one.** The failure mode is not morphing — it is drawing a ±2 cm
estimate with the same confident silhouette as an MRI-derived mesh.

Proposed contract addition, parallel to `SystemScore`:

```ts
export type GeometryTier =
  | 'reference' | 'anthropometric' | 'composition' | 'surface-scan' | 'imaging'

export interface StructureFit {
  term: string                 // UBERON CURIE — same join as SystemScore.structures[].id
  tier: GeometryTier
  scale: number | null         // null at 'reference' — never silently default to 1.0
  positionSigma: number        // 1-sigma placement uncertainty, METRES
  volumeCv: number             // 1-sigma relative volume uncertainty, 0-1
  provenance: Provenance[]
  caveat?: string
}
```

The invariant worth enforcing in `assertTwinMetrics()`: **a structure may not
carry a `scale` unless it also carries a `positionSigma`.** That makes "morph
without stating uncertainty" unrepresentable, exactly as the current schema makes
"score without data" unrepresentable.

For the visual cue, use **silhouette softness** — a rim-fade whose falloff width
scales with `positionSigma`. It is one shader uniform, reads pre-attentively, is
*literally true*, and degrades to nothing at zero. Avoid transparency (already
overloaded for occlusion) and colour (already carrying score). A **breathing
envelope** — animating abdominal organs through their real ±1.3 cm excursion —
turns the largest error source into an honest and rather beautiful feature.

---

## 7. Landscape

**medicinevirtual.com** — a native VR company, not a web company. Products ship
to Quest, PICO and PSVR2; the site itself has no 3D on it at all, only rendered
PNGs and MP4s. Their renders are medical-illustration aesthetic, not photoreal:
flat red-orange muscle, shadowless lighting, no specular wetness, no SSS. Their
VR DICOM viewer is **classic transfer-function direct volume rendering** with a
piecewise-linear TF editor and a Low/Medium/High step-count selector — not
cinematic rendering. Their headline efficacy study is n = 21, single-arm,
uncontrolled. **Nothing here is a competitor to Open Twin or reusable by it.**
The one useful calibration: the closest shipping analogue to "personalise from
the user's own scan" implemented it as plain DVR, not anything exotic.

**BioDigital** is the closest analogue and the most instructive. Bundle
inspection shows: custom WebGL2 engine (they moved off SceneJS), loaders.gl for
glTF + Draco + KTX2/Basis, per-platform pre-transcoded textures (ASTC 8×8 mobile,
**BC6H HDR** desktop), **9-coefficient spherical-harmonic irradiance plus a
prefiltered specular env map**, ACES, DOF, FXAA, and an artist-authored **fresnel
channel** per material for the wet-organ look. **No SSS, no SSAO, no bloom, no
shadow maps.** Their entire visual quality is good geometry + good textures + PBR
+ IBL — all reproducible in three.js. They also use `EXT_mesh_features` /
`EXT_structural_metadata` to bind per-structure IDs to geometry, which is the
standardised version of our ontology-ID join and survives `gltf-transform`
round-trips better than node names.

**Visible Body**'s free web 3D is Google `<model-viewer>` serving an
**uncompressed 7.1 MB GLB for 51 k triangles** — unwelded vertex soup, embedded
JPEGs, zero extensions. Our 8 MB atlas at 2.6 M triangles is comfortably ahead.

**Zygote Body** still runs Google's Open 3D Viewer on jQuery 1.8.3, content
frozen since 2014, diffuse-only Lambert with no PBR.

**Siemens Cinematic Rendering** is the photoreal gold standard: Monte Carlo
volumetric path tracing solving the radiative transfer equation with hundreds to
thousands of photon paths per pixel, Henyey-Greenstein phase functions, HDR
image-based lighting and a physical camera. 5–30 s per converged frame. And the
detail worth internalising: **Cinematic Anatomy's advantage is as much the data
as the renderer** — 46 µm synchrotron HiP-CT of donor organs, three orders of
magnitude finer in volume than clinical CT. The transferable insight is that
*the realism comes from the light transport, not from physically-measured tissue
optics* — their transfer function is still a hand-authored 1D HU→colour LUT.

**Nobody ships a consumer-facing personalised 3D body.** Prenuvo has the
segmentations (they report organ volumes) and chooses to render percentile curves
and a 2D heat map. Q Bio built the scanner, branded a "digital twin", and has
since dropped the twin language entirely. HeartFlow — $176 M revenue, 77 % gross
margin, 22 M-image training set — ships a colour-mapped tube. If we build the
personalised 3D body we will be first, and should be clear-eyed that being first
here means being first at something well-funded players chose not to do.

---

## 8. Decisions only you can make

**1. Which HRA donor.** Switching HRA to the male model would make both atlases
male, match the sample twin ("John"), and incidentally eliminate the placenta at
source. But the Visible Human **Male donor was an executed prisoner**. That is an
ethics decision, not a rendering one. The asset is downloaded and ready at
`public/models/hra-m.glb` if the answer is yes.

**2. BodyParts3D licence provenance.** NBDC says CC BY 4.0 (updated 2025-02-27);
lifesciencedb.jp and the popular GitHub mirror still say CC BY-SA 2.1 JP, and the
2,234 shipped `.obj` files still carry 2013 BY-SA headers. Our "CC BY end to end"
claim holds only if we pulled from NBDC. **Archive the NBDC licence page with a
retrieval date**, and get written confirmation before commercial distribution.
This licence has demonstrably changed once already.

**3. Sex in `TwinMetrics`.** There is no sex field, so nothing can filter
structures that contradict the twin. Adding one lets sex-discordant anatomy be
*hidden* rather than merely disclosed — the same mechanism the placenta uses.

**4. Whether to fund the Visible Human texture bake** (§4.4). This is the single
biggest available quality jump and it is licence-free. Two to three days for a
liver prototype.

**5. TotalSegmentator vs MOOSE** (§5.2). Pick one before building the crosswalk,
because switching means redoing it.

**6. Whether to adopt the SPL Abdomen atlas** (§4.5) for musculoskeletal
coverage. Its licence is more permissive than what we already accept, and it
ships 94 named muscle and bone meshes. This may close open question 3 outright.

---

## 9. Suggested order

**Tomorrow.** Look at `3a484c5` on a real display and tune the material constants
by eye. Try `--simplify-error 0.001`. Finish the AO bake and wire `vertexColors`.

**This week.** Fresnel ghost hull. Prototype the Visible Human liver bake. Pull
the SPL Abdomen atlas and look at its 94 meshes next to BodyParts3D. Decide donor
and licence-provenance questions.

**This month.** `statistics.json` → `TwinMetrics` (fills four dead systems).
The ~117-row UBERON crosswalk. Thickness bake + SSS. Separate XR LOD asset.

**This quarter.** Template-fitting rather than raw extraction, so generic→personal
can animate at all. De-identification and defacing boundary. `StructureFit` in the
contract, with uncertainty rendered as silhouette softness.

---

## Sources worth keeping

- three.js `ShaderChunk/lights_fragment_maps.glsl.js` — the `USE_ENVMAP` guard
- `pmndrs/postprocessing` #677, `pmndrs/xr` #128 — post-processing is not available in WebXR
- Klarqvist et al., *npj Digit Med* 2022 — VAT from silhouette, n=40,032
- Shetty et al., *Comput Biol Med* 165 (2023) — BOSS; the 8.11 vs 8.68 mm result
- Keller et al., CVPR 2024 — HIT; read the limitations section
- Kroes, Post & Botha, *PLoS ONE* 7(7):e38586 (2012) — Exposure Render
- Comaniciu et al., *Med Image Anal* 33:19–26 (2016) — Cinematic Rendering
- QIBA CT Atherosclerosis Biomarkers Profile (2024) — the model for a citable reference interval
- MakeHuman `LICENSE.md` section C — the CC0 asset grant
- NLM Visible Human terms — no licence required since 2019
