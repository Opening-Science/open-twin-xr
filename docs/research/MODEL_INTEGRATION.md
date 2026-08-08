# Adding open parametric body models to open-twin-xr

**Purpose:** Claude-Code-executable instructions for bringing ANNY, MHR and MPFB2 into the `open-twin-xr` asset pipeline as additional, exploratory anatomy sources.
**Expands:** the integration-feasibility column in `RESEARCH.md` §2.1, which marks ANNY, MHR and MPFB2 as the three feasible entries. §2.4 is the narrower licence recommendation (build on ANNY, with MHR available for the skeleton and LOD tiers) and rejects the SMPL family. This document is the working detail behind both.
**Verified:** 7 August 2026. Figures marked **[M]** were measured by installing the package or downloading and parsing the release asset, not read from documentation. Where documentation and measurement disagree, the measured value is given and the disagreement noted.

---

## 0. The honest framing, before any code

**These models are body envelopes, not anatomy.** ANNY, MHR, SOMA-X, SMPL and every other model in `RESEARCH.md` §2.1 produce a skin surface and a skeleton. None of them contains organs. The repo's seven registered atlases contain organs and no parametric control; these models are the exact complement, and confusing the two would be the first mistake.

So the question is not "should we replace the atlas". It is "what job does a parametric envelope do that the atlases cannot", and there are two real answers in this repo's own documents.

**Answer 1: two of the seven sources have no skin.** Decision **D14** in `docs/DECISIONS.md` is titled "The glass hull is per-atlas, because two of seven sources have no skin", and `useHasHull()` in `src/ui/SceneDock.tsx` disables the Glass hull control with an inline "no skin" note whenever no active source supplies `integumentary`. A parametric body is a skin generator. This is a gap the repo has already measured and worked around, and it is the cheapest genuine win available here.

**Answer 2: Roadmap Phase 7 is "Personalisation from imaging".** A parametric envelope with interpretable phenotype axes is the standard vehicle for that, and it is the thing the repo does not have. Fitting a parametric body to a person's own scan is a different and much better-posed problem than deforming an atlas.

**What this is not.** It is not a route to personalised organs, it is not a measurement instrument, and its shape space is artist priors rather than anthropometric ground truth. Do not attach body-composition or ergonomic claims to it. If the proposals fork ever renders a body-shape statement, `FORK_PLAN.md` §3.5 governs the framing (function and trend only, never aesthetic), and whether to ship shape proposals at all is an open question recorded there as §7 question 3, where the conservative answer is to exclude them from v1.

---

## 1. Which model for which job

| Job | Model | Why |
|---|---|---|
| Skin envelope for the skinless atlases | **ANNY**, static GLB per phenotype preset | Only permissive model with infant-to-elder coverage. `notoes_collapse5pc` at 615 verts **[M]** is cheap enough to add to any scene |
| Age and body-shape exploration in-app | **ANNY**, baked preset set or a future morph-target build | Interpretable axes, no scan provenance, no registration |
| Skeleton and LOD reference | **MHR** | 127 joints, 7 LODs down to 595 verts, Apache-2.0 including assets **[M]** |
| Highest-fidelity one-off bodies with textures | **MPFB2** in Blender | The only path here that yields a textured, rigged, morphable glTF in one export |
| Motion retargeting across backends, later | SOMA-X | Not now. See §7 |

---

## 2. Licence facts to record in the registry

All verified by reading the licence files in the installed package or the downloaded release.

| Model | Code | Assets | Attribution obligation | Trap |
|---|---|---|---|---|
| ANNY | Apache-2.0 (root `LICENSE`, "Anny, Copyright (C) 2025 NAVER Corporation") | `src/anny/data/mpfb2/` **CC0-1.0** (full CC0 text present **[M]**), `data/faceunits01` CC0, `data/soma` **Apache-2.0** (adapted from NVlabs SOMA-X) | Apache-2.0 notice retention; cite arXiv:2511.03589 | **Three licence buckets in one package.** The registry entry needs all three, not one |
| MHR | Apache-2.0 | Apache-2.0, `assets/LICENSE.txt` inside the v1.0.1 assets zip **[M]** | Apache-2.0 notice retention; cite arXiv:2511.15586 | v1.0.0 assets shipped with **no licence file**; issue #62 prompted the fix. Use v1.0.1 or later and record which |
| MPFB2 | **GPLv3** (`LICENSE.CODE.md` **[M]**) | **CC0-1.0** (`LICENSE.ASSETS.md` **[M]**) | None on the assets | The GPL is on the addon, not on characters you export. The project FAQ answers "Yes" to closed-source use and states "All core assets (the base mesh, targets, skins) are shared under CC0". Third-party asset packs carry their own terms |

**The one that will bite you:** selecting `topology="smpl"` or `topology="smplx"` in ANNY triggers a **runtime download** of `download.europe.naverlabs.com/humans/Anny/noncommercial.zip` via `download_noncommercial_data()` in `anny/paths.py` **[M]**. It unpacks its own `LICENSE.txt` and is non-commercial only. Because it happens at runtime rather than at install time, **a dependency audit will not catch it**. The same applies to SOMA-X's SMPL and SMPL-X backends.

---

## 3. The tasks

### M1. Decide the source class before writing any code

**Files:** `src/scene/anatomySources.ts`, `docs/DECISIONS.md`

The registry's `AnatomySource` type carries `donor: { label, derivedFrom, sex }`, `termSystem` and `registration`. A parametric body has **no donor** (it is scan-free, which `RESEARCH.md` §2.4 argues is an ethical feature) and **no ontology terms at all**.

Two options, and this is a real decision rather than a detail:

- **(a) Extend `AnatomySource`** with a `synthetic: true` discriminator and make `donor` optional. Cheapest, but it puts a body with no structures into a registry whose whole purpose is structure identity, and `sourceBreakdown()` and `AtlasAttribution` both assume a donor.
- **(b) A separate `BODY_ENVELOPES` registry** in a new `src/scene/bodyEnvelopes.ts`, following the precedent of `ORGAN_OVERLAYS` in `src/scene/organOverlays.ts`, which is already "a separate mechanism from atlases" per `docs/HANDOVER.md`.

**Recommendation: (b).** The repo has already made this exact call once, for overlays, and for the same reason. It also keeps `AnatomySource` from growing a field that is meaningless for seven of its eight entries.

Write it up as a decision entry, in the house style: what was decided, why, and what it costs.

**Acceptance:** the decision exists in `docs/DECISIONS.md` before any asset is committed.

---

### M2. Bake ANNY phenotype presets to GLB

**Files:** `scripts/build-anny.mjs` or `scripts/anny/bake.py` (new), `public/models/anny-*.glb`

The export path is verified working end to end: `Anny()` with phenotype kwargs, then `trimesh.Trimesh(vertices, faces).export()`, produces a 494 KB GLB **[M]**.

```python
# scripts/anny/bake.py
# ANNY: Apache-2.0 code, CC0 assets. NEVER pass topology="smpl" or "smplx":
# both trigger a runtime download of a non-commercial archive.
import numpy as np, trimesh
from anny import Anny

PRESETS = {
    "adult-f":   dict(phenotype_kwargs={"gender": 0.0, "age": 0.5}),
    "adult-m":   dict(phenotype_kwargs={"gender": 1.0, "age": 0.5}),
    "child":     dict(phenotype_kwargs={"gender": 0.5, "age": 0.15}),
    "elder":     dict(phenotype_kwargs={"gender": 0.5, "age": 0.95}),
    "pregnant":  dict(phenotype_kwargs={"gender": 0.0, "age": 0.5},
                      local_changes_kwargs={"stomach-pregnant-incr": 1.0}),
}

# local_changes="default" loads 254 MakeHuman targets and is REQUIRED for the
# pregnant preset. Pregnancy is a local-change target, not a phenotype macro.
model = Anny(topology="anny", rig="anny", local_changes="default")

# ANNY is metres, Z-up. glTF is Y-up. Rotate -90 degrees about X.
R = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])

for name, kwargs in PRESETS.items():
    out = model(**kwargs)
    v = out["vertices"][0].detach().cpu().numpy()
    m = trimesh.Trimesh(vertices=v, faces=model.faces, process=False)
    m.apply_transform(R)
    m.export(f"public/models/anny-{name}.raw.glb")
```

**Verified parameters [M]:** phenotype macros are `gender, age, muscle, weight, height, proportions`, all floats 0 to 1 defaulting to 0.5. Setting `phenotypes="all"` adds `cupsize, firmness, african, asian, caucasian`. `extrapolate_phenotypes=True` allows out-of-range values.

**Traps:**

1. **Z-up.** ANNY is metres and Z-up **[M]**; the bundled demo applies the same minus-90-degrees-X rotation before GLB export, with the comment that the Gradio Model3D component does not use a Z-up camera by default. Skipping this gives you a body lying on its back.
2. **Pregnancy needs `local_changes="default"`.** With the constructor default of `"none"`, `local_changes_kwargs` has nothing to act on and the preset silently produces a non-pregnant body.
3. **No skin texture ships.** UVs exist (`model.texture_coordinates`, shape (21,334, 2), plus `face_texture_coordinate_indices` **[M]**) but they are per-corner, so a glTF export needs vertices split at UV seams. The layout is MakeHuman's, so CC0 skins from the MakeHuman asset packs apply. Ship untextured first.
4. **`process=False` on the Trimesh constructor.** Trimesh merges vertices by default, which will silently change the vertex count and break any later assumption that indices line up with ANNY's.

**Acceptance:** five GLBs in `public/models/`, loading in the viewer without error, each with a height that matches its preset rather than a single target. The three adult presets should land near 1.7 m; **`child` at `age: 0.15` and `elder` should not**, and if they do, the `age` parameter is not reaching the model. That height spread is the check that the phenotype axis is actually doing something, so do not assert a uniform 1.7 m across all five.

---

### M3. Run the presets through the existing conversion pipeline

**Files:** `package.json` scripts

The repo's convention is `optimize --compress meshopt` then `bake-ao.mjs`. For **static** ANNY presets this works unchanged, because there are no morph targets to damage:

```json
"convert:anny": "for f in adult-f adult-m child elder pregnant; do gltf-transform optimize public/models/anny-$f.raw.glb public/models/anny-$f.opt.glb --compress meshopt --join false --instance false --weld true --simplify true --simplify-ratio 0.5 --simplify-error 0.005 && node scripts/bake-ao.mjs public/models/anny-$f.opt.glb --out public/models/anny-$f.ao.glb; done"
```

**If you ever ship a morphable body, `--simplify` must be turned off.** See §5, which is the single most important technical finding in this document.

**Acceptance:** the winding check passes on the new files. Note that `npm run check:winding` will **not** cover them as written: the script takes explicit file arguments and `package.json` hard-codes a list of eight GLB paths. Add the new files to that list, or the acceptance criterion passes without ever reading them.

---

### M4. Wire ANNY in as a skin envelope

**Files:** `src/scene/bodyEnvelopes.ts` (new, per M1), `src/scene/Body.tsx`, `src/ui/SceneDock.tsx`

The integration point is the canonical frame in `src/scene/Body.tsx` (the group at lines 77 to 114), which is centred in x and z with y = 0 at the feet and 1.7 m tall. `ORGAN_OVERLAYS` already mount there, and the file's own comment explains why one placement is correct for every atlas.

Render the envelope as a sibling of the `AtlasBody` list, and copy the material discipline the repo applies to the glass hull. **Note carefully which way round that is, because the hull is the exception rather than the rule.** `AtlasBody.tsx` sets `alphaHash: opacity < 1 && !isShell` and `transparent: isShell && (opacity < 1 || glassOn)`: stochastic transparency is the default for anatomy, and the shell gets **real alpha blending** instead. The comment above it gives the reason: blending fails for the atlas at large because mutually enclosing meshes have no valid draw order, but the hull is a single object that must never occlude anything, so `depthWrite: false` on it is correct where it was wrong as a blanket rule.

An envelope is a hull, so follow the shell branch, not the anatomy branch: alpha blending, `side: DoubleSide` (BodyParts3D's skin is not a closed manifold and front-face culling turns any defect into a window through the body), and `depthWrite` only while fully opaque (`opacity >= 1 && !glassOn`). Getting this backwards produces grain on the envelope and a body that reads as full of holes at full hull opacity.

Then relax `useHasHull()` in `src/ui/SceneDock.tsx`. Today it disables the Glass hull control when no active source supplies `integumentary`. With an envelope available it should enable the control and fall back to the envelope. That is the D14 gap closed.

**Trap:** ANNY is a whole body at a fixed height. The atlases are scaled to canonical height inside their own groups by the `fit` logic in `AtlasBody.tsx`. Verify the envelope actually encloses the atlas rather than intersecting it, per atlas, and expect to need a small per-atlas scale. The `placements?: Partial<Record<AnatomySourceId, readonly OverlayInstance[]>>` pattern in `organOverlays.ts` is the established way to express that, and it exists precisely because a 29.3 mm divergence was measured between two sources.

**Acceptance:** the Glass hull control is enabled on an atlas that has no skin, and the envelope encloses the anatomy without z-fighting.

---

### M5. MHR: FBX to glTF

**Files:** `scripts/build-mhr.md` (documentation, not a script, see below)

Download `assets.zip` from the **v1.0.1** release or later (190 MB, unpacking to 4.5 GB **[M]**).

**Verified contents [M]:**

| File | Size | Note |
|---|---|---|
| `assets/LICENSE.txt` | 11 KB | Apache-2.0, full text |
| `assets/lod0.fbx` … `lod6.fbx` | 30.4 MB … 0.66 MB | binary FBX **7700** (FBX 2020) |
| `assets/corrective_blendshapes_lod0.npz` | **2.65 GB** | lod1 664 MB, lod2 384 MB, lod3 176 MB, lod4 89 MB, lod5 35 MB, lod6 21 MB |
| `assets/mhr_model.pt` | 696 MB | TorchScript, LOD 1 only per the README |
| `assets/compact_v6_1.model` | 31 KB | ASCII "Momentum Model Definition V1.0" |

**Verified FBX internals [M]:** 127 skinned joints (1 `Root` named `body_world` plus 126 `LimbNode`) with 127 skin clusters, plus 77 `Null` locators. **117 BlendShapeChannels per LOD**, named `shape_c_0` through `shape_c_116`. Vertex counts lod0 73,639 (147,274 tris), lod1 18,439, lod2 10,661, lod3 4,899, lod4 2,461, lod5 971, lod6 595, matching the paper exactly. **Zero Material, Texture or Video objects**, so the body is untextured, though UVs are present.

**The conversion path is Blender, not a converter binary.** Upstream `facebookincubator/FBX2glTF`'s last release is **v0.9.7 dated 2019-08-10**; the maintained fork is `godotengine/FBX2glTF` (up to v0.13.1), and Godot itself moved off FBX2glTF to ufbx in 4.3. Blender import then Blender glTF export is the reliable route, and both paths convert FBX blendshape channels to glTF morph targets.

**Traps:**

1. **Units.** The FBX is centimetres (UnitScaleFactor 1.0, mesh bbox Y max 172.58 **[M]**). Blender applies a 0.01 conversion on import. **Acceptance check: the exported GLB must be about 1.73 m tall in metres.** If it is 173, the conversion was skipped.
2. **Blender's legacy importer self-describes as "FBX 7.1.0 to 7.4.0" but has no upper-bound rejection**, switching parse behaviour at version ≥ 7500. MHR's 7700 files load through it without a hard error, but 7700-specific handling is not guaranteed. Blender 4.5 LTS ships a new C++ ufbx-based importer (experimental in 4.5) that is 5 to 20 times faster and fixes about 20 importer bugs. Prefer it if available, and record which importer produced a committed asset.
3. **Bone orientation.** FBX joints carry no bone tails, so Blender synthesises them, and the "Automatic Bone Orientation" option is the subject of long-standing bug reports (blender-addons issues 53620 and 76800). Inverse bind matrices survive, so **skinning stays correct**; what changes is bone local axes, which matters only if you later hand-author animation or retarget in Blender. Expect visually odd octahedrons on MHR's twist bones and do not treat that as a failure.
4. **Blendshape names are opaque.** `shape_c_0` through `shape_c_116` covers 45 identity plus 72 FACS expression shapes per the paper, but **the split is not in the file** and is an open issue (#57). Do not guess which is which.
5. **The repo's own coordinate documentation contains an error** (issue #59 reports the stated handedness is inconsistent). Trust the measured Y-up, not the prose.

**Why documentation rather than a script:** this step requires a human in Blender and a 190 MB download, so it is not reproducible in CI. Write down the exact Blender version, importer and export settings used, in the spirit of the repo's existing `docs/MODEL_PIPELINE.md`.

**Acceptance:** a `mhr-lod2.glb` about 1.73 m tall, with 10,661 vertices, a 127-joint skin, and 117 morph targets whose names survive in `extras.targetNames`.

---

### M6. MPFB2 in Blender, for the textured case

**Files:** `docs/MODEL_PIPELINE.md` (extend)

Blender ≥ 4.2 addon. Workflow: MPFB tab in the N-shelf, "New human", "From scratch", set the phenotype dropdowns, Create. **The scale factor is chosen at creation and cannot be changed afterwards.**

Then export with **Blender's native glTF exporter**, not MPFB2's FBX exporter, because glTF gives you the armature as a glTF skin and shape keys as morph targets in one step.

**Traps:**

1. **Delete the helper geometry.** The MPFB basemesh carries invisible helper geometry that will otherwise export. MPFB2's own documentation names this step.
2. **"Apply Modifiers" in the glTF exporter silently destroys shape keys.** Reported as blender issues T69622 and 73724. If you want a morphable body, leave it off.
3. **MPFB2's documented "bake shapekeys" step collapses shape keys into the mesh.** Do that for a static body, skip it for a morphable one. These two are easy to conflate.
4. **GPL applies to the addon, not to your export.** Confirmed by the project FAQ. Third-party asset packs carry their own licences, so record what you loaded.

**Acceptance:** a textured, rigged GLB, and a note in `docs/MODEL_PIPELINE.md` recording the Blender version, MPFB2 version and every asset pack used.

---

## 4. Registry entry shape

Whichever structure M1 chooses, each entry needs the fields the repo already demands of an atlas, plus the licence buckets a parametric package introduces.

```ts
export interface BodyEnvelope {
  id: 'anny-adult-f' | 'anny-child' | 'mhr-lod2' | string
  url: string
  /** No donor. These are scan-free, which is the point. */
  synthetic: true
  /** Every licence in the package, not just the headline one. */
  licences: ReadonlyArray<{
    covers: string          // 'code' | 'shape assets' | 'soma topology' | ...
    spdx: string            // 'Apache-2.0' | 'CC0-1.0' | 'GPL-3.0-only'
    url: string
  }>
  attribution: string
  citation?: string
  /** Exact build inputs, so the asset can be regenerated. */
  provenance: {
    package: string         // 'anny==0.6.0'
    topology: string        // 'anny' | 'notoes_collapse5pc'
    rig: string             // 'anny' | 'makehuman'
    parameters: Record<string, number>
    script: string          // 'scripts/anny/bake.py'
  }
  /** Parametric bodies carry NO ontology terms. State it rather than leaving it undefined. */
  termSystem: 'none'
}
```

The `provenance` block is the part worth insisting on. The repo already regenerates `docs/LICENCE_LOG.md` and `docs/ONTOLOGY_MAP.md` from scripts precisely because hand-maintained ancestors went stale. A baked body with unrecorded parameters is the same failure waiting to happen, and unlike an atlas it is cheap to regenerate if you know the inputs.

Extend `scripts/check-licences.mjs` to walk the new registry, so `npm run check:licences` covers envelopes too.

---

## 5. The pipeline traps, in detail

These are the findings most likely to cost a day if discovered late. All were measured against `@gltf-transform/cli` 4.4.2 and three.js r169.

### 5.1 `gltf-transform simplify` destroys morph-heavy meshes, silently

`simplify` **does** process meshes that carry morph targets and **does** remap the target deltas onto surviving vertices, so targets are not dropped. But the error metric is computed from **base POSITION only**: `simplifyPrimitive` passes only the position array to `MeshoptSimplifier.simplify`. Nothing about the morph deltas reaches the decision about which vertices to collapse.

The consequence was demonstrated **[M]**: a flat 1,681-vertex plane whose entire detail lived in its morph deltas collapsed to 21 vertices, destroying the morphs, because the base mesh looked flat to the simplifier.

**And `optimize` runs `--simplify true` by default**, along with `--simplify-error 0.0001`, `--simplify-ratio 0`, `--weld true`, `--compress meshopt`, `--sparse true`, `--join true`.

**Rule: any morphable body must be converted with `--simplify false`, or pre-decimated in the DCC.** Verified with `--simplify false`: vertex count preserved, targets and names intact **[M]**. Attribute-aware simplification is an open discussion upstream (glTF-Transform discussion #992).

Two related facts, both benign:

- **`weld` is morph-safe.** v4's weld is exact-bitwise only and its vertex hash includes morph-target attributes, so vertices that are identical in the base but differ in any target are not merged **[M]**.
- **`join` auto-skips primitives with morph targets**, stating that they cannot currently be joined.

### 5.2 Quantization, skinning and a version floor

Morph target accessors are quantized too (i16 normalized under `KHR_mesh_quantization`), and for skinned meshes the dequantization transform is **folded into the inverse bind matrices** rather than into node transforms **[M]**. That is correct, because glTF ignores node transforms on skinned meshes.

**glTF-Transform 4.0.0 and 4.0.1 produced invalid skin weights under quantization** (issue #1404), fixed in 4.0.2. The repo pins `^4.1.0`, so it is already clear, but pin the floor explicitly if the dependency is ever loosened.

Morph target names round-trip through `optimize` via `mesh.extras.targetNames` **[M]**, and `GLTFLoader` in r169 builds `mesh.morphTargetDictionary` from them.

### 5.3 three.js r169 morph target cost

r169 has **only** the texture path for morph targets; the old 8-attribute limit is gone, and the renderer has been WebGL2-only since r163. Per morphed mesh, three builds a `DataArrayTexture` in Float32 RGBA with **one layer per morph target**, sized `position.count * vertexDataCount` wide, where `vertexDataCount` is 1 for positions only, 2 if morph normals are exported, 3 if morph colors are.

Computed from that formula at 16 bytes per vertex per target, positions only:

| Asset | Vertices | Targets | VRAM |
|---|---|---|---|
| MHR lod0 | 73,639 | 117 | **~138 MB** |
| MHR lod1 | 18,439 | 117 | ~34.5 MB |
| MHR lod2 | 10,661 | 117 | ~20 MB |

Double each if morph normals are exported.

There is a second cost that is easy to miss: **the vertex shader loops over all `MORPHTARGETS_COUNT` targets per vertex** with a zero-influence branch skip, so cost grows with target count even when every weight is zero.

**For a Quest-class headset: use lod2 or lod3, turn off "Shape Key Normals" in the Blender exporter, and ship only the targets you actually drive.** Shipping all 117 identity-plus-expression channels to a headset to use four of them is the mistake this table exists to prevent.

### 5.4 Nothing extra is needed for meshopt in drei

`useGLTF` in drei 9.122 has the signature `useGLTF(path, useDraco = true, useMeshopt = true, extendLoader?)` and calls `setMeshoptDecoder` automatically. Meshopt decoding in `GLTFLoader` is a transparent buffer-view decode, so skinning and morphs behave exactly as uncompressed afterwards. No open three.js issue was found for the meshopt-plus-skin-plus-morph combination in r169, though absence of a search result is not proof of absence.

One operational note: **meshopt-compressed files require the decoder to be registered when re-read in Node**, which matters for any build script that round-trips an asset.

### 5.5 ANNY skin weights exceed the glTF layout

`model.vertex_bone_weights` has shape (13718, **9**) **[M]**: nine bone influences per vertex. glTF's `JOINTS_0`/`WEIGHTS_0` carries four. A skinned ANNY export therefore needs either two joint sets (`JOINTS_0` plus `JOINTS_1`) or top-four pruning with renormalisation.

This only matters if you build a rigged export. **The static bake in M2 avoids it entirely**, which is one reason to start there.

---

## 6. Sequencing

| Step | Task | Effort | Blocks |
|---|---|---|---|
| 1 | M1 registry decision | small, writing | everything |
| 2 | M2 ANNY static bake | small, verified working | M3 |
| 3 | M3 pipeline conversion | small | M4 |
| 4 | M4 skin envelope wiring | medium, the real win | nothing |
| 5 | M5 MHR conversion | medium, needs Blender and 190 MB | nothing |
| 6 | M6 MPFB2 textured body | medium, needs a human | nothing |

M2 through M4 close the D14 skin gap and are worth doing on their own. M5 and M6 are exploratory and should be treated as such, in a branch, until there is a job for them.

---

## 7. What not to do

1. **Do not select ANNY's `smpl` or `smplx` topology**, or SOMA-X's SMPL backends. Runtime download, non-commercial, invisible to a dependency audit.
2. **Do not run `gltf-transform optimize` with default flags on a morphable body.** `--simplify` is on by default and the error metric cannot see morph deltas.
3. **Do not add SOMA-X to the critical path.** It distributes no viewer-loadable mesh, requires PyTorch, Warp and usd-core at runtime, and is unnecessary for geometry: **ANNY already ships the SOMA topology and rig** as `Anny(topology="soma", rig="soma")` at 18,056 vertices and 78 bones under Apache-2.0 **[M]**. Note in passing that the SOMA-X Hugging Face card says roughly 18,095 vertices and 77 joints while the installed package reports 18,056 and 78 including a virtual root; the discrepancy is unexplained and is a reason to prefer ANNY's copy.
4. **Do not present a parametric envelope as anatomy**, in the UI or in attribution. It has no structures and no ontology terms, and the repo's whole current milestone is structure identity.
5. **Do not port MPFB2's Python.** The addon is GPLv3; only the assets are CC0. ANNY is clean precisely because NAVER wrote fresh Apache-2.0 code against CC0 assets, and that is the pattern to copy.
6. **Do not commit a baked body without its `provenance` block.** An asset nobody can regenerate is worse than no asset.

---

## 8. Sources

**ANNY** https://github.com/naver/anny · https://pypi.org/project/anny/ · paper https://arxiv.org/abs/2511.03589 · blog https://europe.naverlabs.com/blog/anny-a-free-to-use-3d-human-parametric-model-for-all-ages/
**MHR** https://github.com/facebookresearch/MHR · release v1.0.1 https://github.com/facebookresearch/MHR/releases/tag/v1.0.1 · paper https://arxiv.org/abs/2511.15586 · PyPI https://pypi.org/project/mhr/ · open issues #57 (blendshape naming), #59 (coordinates), #62 (asset licence)
**SOMA-X** https://github.com/NVlabs/SOMA-X · https://huggingface.co/nvidia/SOMA-X · https://pypi.org/project/py-soma-x/
**MPFB2 / MakeHuman** https://github.com/makehumancommunity/mpfb2 · code licence https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.CODE.md · asset licence https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.ASSETS.md · closed-source FAQ https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html · exporting https://static.makehumancommunity.org/mpfb/docs/exporting.html
**glTF-Transform** https://github.com/donmccurdy/glTF-Transform · attribute-aware simplification discussion #992 · morph remapping issue #700 · quantized skin weights issue #1404
**three.js r169** morph targets https://github.com/mrdoob/three.js/blob/r169/src/renderers/webgl/WebGLMorphtargets.js · shader chunk https://github.com/mrdoob/three.js/blob/r169/src/renderers/shaders/ShaderChunk/morphtarget_vertex.glsl.js
**drei 9.122** https://github.com/pmndrs/drei/blob/v9.122.0/src/core/Gltf.tsx
**FBX conversion** https://github.com/facebookincubator/FBX2glTF/releases/tag/v0.9.7 · https://github.com/godotengine/FBX2glTF/releases · Blender ufbx importer https://aras-p.info/blog/2025/05/08/Blender-FBX-importer-via-ufbx/ · bone orientation https://projects.blender.org/blender/blender-addons/issues/53620 and /76800 · shape keys and Apply Modifiers https://developer.blender.org/T69622 and https://projects.blender.org/blender/blender/issues/73724
