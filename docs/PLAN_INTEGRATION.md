# Plan: the next five

Execution plan for **B6, A1, B2, B8, B3** from `docs/INTEGRATION_CANDIDATES.md`, in
the order requested. Written 28 July 2026. **Nothing here has been started** — an
AO bake is running in the `priceless-lamarr-dcd5c9` worktree and this plan
deliberately touches none of it.

Every step below was checked against the code rather than assumed. Where planning
turned up something that changes the shape of an item, it is called out as a
**finding** rather than buried in the steps.

---

## Status, 28 July 2026

| | |
|---|---|
| **B6** | **Asset built and verified.** Placement, attribution and the provenance email outstanding. |
| **A1** | **Done — by PR #1, not by this plan.** One piece left: the asset on `main` is stale and needs a rebuild. |
| **B2, B8** | **Done.** The female CT body and the schematic eye both ship. |
| **B3** | **Done, 29 July — and it answers D4.** All 12 OpenEar structures carry photographic colour and it renders as an organ overlay, placed by a landmark fit at 1.27 mm. |

The ordering warning below is **resolved** and kept only because it explains why
A1 is not this plan's work. PR #1 landed the branch it was waiting on *and*
completed A1 in the same merge.

<details>
<summary>The prerequisite, as it stood before PR #1 landed</summary>

The requested order was **B6 → A1, B2 → B8, B3**. Four of the five were
independent and could run in that order as written. **A1 could not.**

`docs/DECISIONS.md` D12b describes per-structure provenance tagging, a
`licences.json` register and a `check:licences` gate that reads the shipped GLB.
**None of that exists on `main`** — verified: no `licences.json`, no
`docs/LICENCE_LOG.md`, no `check:licences` script in `package.json`, and
`build-z-anatomy.mjs` mentions the non-commercial components only in a source
comment, not as a per-structure `component`/`licence` field. It all lives in the
`priceless-lamarr-dcd5c9` worktree, which is the tree currently baking.

A1 imports `NervousSystem100.fbx` and `VisceralSystem100.fbx`. Those carry the
CC BY-NC-SA Dundee inner ear, the **unlicensed** University of Washington white
matter, and the CC BY-NC kidney. Running A1 on `main` today would put all three
into the shipped asset **with no per-structure record and no gate to catch it** —
which is precisely the failure D12 documents: *"The scan was skipped on the first
pass and the contamination went straight into `z-anatomy.glb`."*

**So: B6 first, as requested. Then land the `priceless-lamarr` branch. Then A1.**
B2, B8 and B3 have no such dependency and can proceed whenever.

</details>

**What actually happened:** B6 was built first as requested, and PR #1 merged
during that work — bringing the provenance machinery *and* the completed A1
together. So the overnight queue is now **B2, B8, B3**, plus a rebuild of the
Z-Anatomy asset on `main`.

---

## B6 — The beating heart

> ### ✅✅ In the app, 28 July 2026 — toggleable, placed, rate-controlled
>
> Wired into the main WebXR scene as an **organ overlay**, a new concept in its own
> registry (`src/scene/organOverlays.ts`) rather than a fifth atlas, because an
> atlas is a choice of *body* and this is additive on top of any of them —
> including **Best per system** (renamed from "Best of both" on 29 July, once
> there were six sources rather than two). Toggle sits in its own pill row under the atlas
> switcher, so the row can grow as more organs arrive.
>
> **Placement came out of anatomy and is exact.** Position is HRA's own heart node
> pushed through the same fit `AtlasBody` applies: it lands at **73.9 % of body
> height, 3.7 cm left of midline, mid-depth** — behind the sternum at T7–T8,
> displaced left, which is where a heart is. Rotation maps this asset's measured
> base→apex axis onto HRA's measured one, resolving roll by putting the right
> ventricle to the anatomical right and slightly anterior: **0.000° residual on
> both axes, determinant +1**. HRA's apex direction came out (0.777, −0.536,
> 0.330) — left, inferior, anterior, the textbook description, which independently
> confirms +X is anatomical left.
>
> **One placement works for every atlas.** `AtlasBody` fits each atlas into one
> canonical frame (centred x/z, y=0 at the feet, 1.7 m), so overlays mount as
> *siblings* of `AtlasBody` and need no per-atlas table. Not scaled to fit: this
> heart is 13 × 9 × 12 cm against HRA's 15 × 12 × 11 cm, partly because biv-me has
> no atria, and stretching a real person's organ to match would be fabrication.
>
> **Heart rate is a control, and it is the seam for real data.** 40–200 bpm,
> driving `timeScale`; verified 40 → 1.50 s, 60 → 1.00 s, 120 → 0.50 s, 200 →
> 0.30 s. It lives in the store precisely so a wearable series or a recorded
> session can set it later without reaching into the scene. The panel states that
> it is playback, not measurement, and that scaling the cycle evenly is wrong in
> one specific way: rising rate shortens diastole more than systole.
>
> **The duplicate-heart problem is solved only for HRA**, which ships the heart as
> its own node. BodyParts3D and Z-Anatomy merge the whole cardiovascular system
> into one draw call, so suppressing their heart needs the draw-range surgery Phase
> 1 built for highlighting. Until then those atlases show their static heart too.
>
> **A build bug fixed on the way:** `vite.config.ts` whitelists shipped models by
> reading `anatomySources.ts`, so every overlay asset would have been silently
> pruned from production. It now reads both registries — confirmed by a real build
> that keeps `biv-heart.glb` and still frees 1.68 GB.
>
> Still outstanding: the provenance email before publication, and per-structure
> hover for overlay meshes (they carry `_STRUCTURE` but `AtlasBody`'s hover path
> does not see them).
>
> ### ✅ Asset built and verified, 28 July 2026
>
> `scripts/build-biv-heart.mjs` → `public/models/biv-heart.glb` (3.8 MB,
> gitignored like every other asset; rebuild with
> `node scripts/build-biv-heart.mjs`).
>
> **11,616 triangles, 6,030 vertices, 3 surfaces, 24 morph targets each**, one
> `cardiac-cycle` animation over morph weights, 26 keyframes, LINEAR. It replaces a
> **25,773-triangle static** heart node, so the beating version costs 14,157 fewer
> triangles.
>
> **Verified, not asserted:**
>
> | Check | Result |
> |---|---|
> | Topology identical across all 25 frames | asserted in the build; it fails loudly if a future release remeshes |
> | Round-trip: base + morph target 8 vs source frame 9 | **max error 0.005 µm** — float32 rounding only |
> | glTF spec: min/max on every POSITION accessor | 75 of 75 present |
> | Loop closure | 0.55 % bbox-volume drift, last frame to first |
> | LV ejection fraction | **59.5 %** (EDV 175.7 mL, ESV 71.1 mL) |
> | End-systole | **frame 9 of 25 = 36 % of the cycle** |
>
> **The physiology is the real verification.** Those figures were not tuned to
> anything — they fall out of the source geometry — and all three land inside
> Petersen et al. 2017 (n=800, CC BY 4.0), which gives male LVEF 58 ± 5 %, LVEDV
> 166 ± 32 mL and LVESV 69 ± 16 mL. End-systole at 36 % independently matches
> Alhakak et al. 2023 at 35 %. The diastolic limb shows rapid filling, a diastasis
> plateau near 149 mL and a distinct atrial kick — the three-phase structure the
> parametric route explicitly **could not source**. Here it is measured.
>
> **Two findings from building it.** The surfaces are **open at the valve planes**
> — 72 boundary edges on the LV forming one clean ring, 232 on the RV, 144 on the
> epicardium — so they are genuine anatomy rather than mesh damage, and the
> material is `doubleSided` because culling would render the openings as
> see-through holes. Capping them would mean inventing geometry the source does not
> contain. And **no AO is baked**, deliberately: a single bake is stale at 24 of 25
> phases, so the heart will read flatter than the atlas until `COLOR_0` is morphed
> too.
>
> **What remains, in order:** rotate base→apex onto the anatomical apex direction
> (the axis is measured and carried in the asset's `placement.lv_long_axis`; +X is
> anatomical left, derived from the shipped structure table) — this needs **one
> visual confirmation** and is deliberately not hardcoded; hide the static heart;
> give the source a home in attribution; and send the provenance email before
> anything is published.
>
> **⚠️ A1 landing changed the "hide the static heart" step, and made it harder.**
> There are now **three** static hearts, not one: HRA's `#VHFHeartV1.1` as a single
> node, BodyParts3D's inside a merged cardiovascular group, and — new as of PR #1 —
> Z-Anatomy's, which ships the chambers **individually named**: left and right
> ventricle, left and right atrium, and four papillary muscles, all inside the
> merged `cardiovascular/organ` node. Individually *identifiable* is not
> individually *hideable*: they share one draw call, so suppressing them means
> draw-range surgery, the same problem Phase 1 solved for highlighting. **HRA
> remains the right pilot**, because there the static heart is its own node.
>
> **And a donor question the plan did not anticipate.** Z-Anatomy's chambers are
> TARO; biv-me's are an unrelated subject. So substituting the beating heart puts
> *one person's heart inside another person's body* — precisely what
> `AnatomyDonor`, `donorsDisagree` and `soleDonor` exist to disclose rather than
> hide. Whatever the placement, the UI has to say whose heart it is.
>
> **Minor colour divergence, deliberately left alone.** The new viscera nodes carry
> `layer: 'organ'`, and `anatomicalColor` checks layer before system, so
> Z-Anatomy's heart chambers render at the generic viscera brown `#bd8a72` while
> this asset — which declares no layer — renders at the cardiovascular red
> `#c4362a`. The red is the more truthful colour for a heart and the palette's own
> comment calls `organ` a "fallback for viscera with no system tint", which
> cardiovascular is not. Flagging rather than matching: the divergence is worth a
> look at the Z-Anatomy end, not a silent conform at this one.
>
> `package.json` was deliberately **not** touched — it is modified in the worktree
> currently baking, and a `build:biv-heart` script there would conflict on merge.
> Add it when that branch lands.

**Inputs verified today.** `UOA-Heart-Mechanics-Research/biv-me` is **Apache-2.0**
per GitHub's own licence detection, and
`demo/fitted-models/example/patient1/obj-meshes` contains **exactly 75 files** —
25 frames × 3 surfaces — at ~145 KB each, roughly 11 MB of OBJ in total.

| Surface | verts | tris |
|---|---|---|
| Epicardial | 2,502 | 4,864 |
| LV endocardial | 1,572 | 3,072 |
| RV endocardial | 1,956 | 3,680 |

Topology is byte-identical across frames, so this is the glTF morph-target
contract with no remeshing. Units are millimetres. It is a full cycle that loops.

**Deliverable.** `public/models/biv-heart.glb` — three meshes, each with frame 000
as base geometry plus 24 morph targets, and a glTF animation driving the morph
weights so exactly two are active at a time.

### Steps

1. **New script `scripts/build-biv-heart.mjs`**, following
   `build-z-anatomy.mjs`'s established pattern: `@gltf-transform/core`
   `Document` + `NodeIO().write()`. No three.js exporter needed.
2. Parse the 75 OBJs, group by surface, sort by frame index. Assert the face-index
   block is identical across all 25 frames of a surface before proceeding — if it
   ever stops being identical, the morph-target approach is invalid and the build
   must fail loudly rather than emit garbage.
3. Convert **millimetres to metres** (×0.001).
4. Emit `POSITION` on frame 000, `POSITION` deltas on 24 morph targets, plus
   `NORMAL` and `NORMAL` deltas — see the finding below.
5. Add `_STRUCTURE` with three values and a three-entry structure table in
   `extras`, matching the Z-Anatomy convention, so hover names *epicardium*,
   *LV endocardium*, *RV endocardium* rather than reporting a group.
6. Register the source for attribution — see the finding below.
7. Place it in the scene. **It must not be fitted.** `AtlasBody` scales an atlas by
   `CANONICAL_HEIGHT_M / boundingBox.height`; applying that to a heart would
   inflate it to human height. The heart needs positioning against the atlas's
   own frame.

### Findings that change the work

**Morph target count is not a problem.** three.js 0.169.0 uses
`morphTargetsTexture` (`WebGLMorphtargets.js`), so the historical eight-target cap
does not apply on WebGL2. 24 targets is fine.

**⚠️ Baked per-vertex ambient occlusion is wrong on a deforming mesh.** Measured:
all three shipped atlases carry **`POSITION` and `COLOR_0` only — no `NORMAL`, no
`UV`** — and `COLOR_0` is the baked AO. AO baked at one cardiac phase is stale at
the other 24. Three options, in increasing cost: ship no AO and accept the heart
reads flatter than the atlas around it; bake at a mid-systolic frame and record
the measured error at the extremes; or morph `COLOR_0` as well, which three.js
supports and which is the only correct answer. **Recommend the middle option for
the first cut, with the error measured rather than assumed.**

**⚠️ Normals cannot be left to be computed.** Since the shipped assets carry no
`NORMAL`, normals are currently derived at load — which is fine for static
geometry and wrong for morphing geometry, because a deforming surface's normals
change and a single computed set will shade the contraction incorrectly. Supply
`NORMAL` plus `NORMAL` morph deltas.

**⚠️ There will be two hearts unless one is hidden.** A heart already exists inside
BodyParts3D's merged cardiovascular group, and in HRA as its own node
`#VHFHeartV1.1` at 25,773 triangles. Hiding one node in HRA is easy; hiding a
sub-range of a merged BodyParts3D mesh is not. **Pilot on HRA**, where the static
heart is separable, and treat the BodyParts3D case as follow-on work.

**⚠️ Attribution has nowhere to put this.** `AttributionBar` derives everything
from `ANATOMY_SOURCES` filtered by installed availability. biv-me is a different
licence (Apache-2.0), a different donor, and **not an atlas**. Either add a
registry entry that covers only `cardiovascular`, or add a parallel overlay-source
list that `AttributionBar` also renders. Apache-2.0 requires preserving the
notice, so this is a licence condition, not presentation.

### The gate: one provenance question — now precise

**Resolved from the sources on 29 July 2026, so this is no longer a suspicion.**
The FIMH 2025 paper (`doi:10.1007/978-3-031-94562-5_34`) states in its own
acknowledgements: *"We gratefully acknowledge the study participants of the **UK
Biobank** and **CARDIOHANCE**"*, and its abstract says the pipeline was tested on
"CMR data contributed from **two centres**". UK Biobank involvement is therefore
established, not inferred from Steffen Petersen's co-authorship.

The repository still carries **no data statement, no ethics text and no consent
text**, and it bundles input DICOMs under `demo/dicoms` for a case named
`patient1`.

**So exactly one question is open: which of the two cohorts is `patient1`?**

| answer | consequence |
|---|---|
| **UK Biobank** | Almost certainly **cannot** be redistributed. Their access terms require derived data to return to UK Biobank rather than be published onward, and Apache-2.0 at a repo root cannot override the authors' own obligations to them. Drop to **C3**. |
| **CARDIOHANCE** (Auckland) | Turns on that study's consent and ethics approval — which the authors know and we do not. May be fine with their say-so in writing. |
| **No reply** | Treat as unresolved: the heart stays out of any public release. |

**Who to ask** — both are listed as contacts in the repo README:

- **joshua.dillon@auckland.ac.nz** — Joshua R. Dillon, corresponding author,
  Auckland Bioengineering Institute
- **charlene.1.mauger@kcl.ac.uk** — Charlène Mauger, King's College London

**Draft:**

> Subject: Provenance of the biv-me demo case (patient1) — redistribution of derived meshes
>
> Dear Dr Dillon, Dr Mauger,
>
> Thank you for releasing biv-me — the fitted biventricular meshes are the only
> open, time-resolved heart geometry we have found, and the pipeline is a pleasure
> to read.
>
> We maintain an open-source WebXR human body viewer (MIT code, separately
> licensed anatomy assets: <https://github.com/etzm/open-twin-openXR>). We have
> converted the 25-phase fitted meshes in `demo/fitted-models/example/patient1/`
> into a glTF beating-heart overlay, currently visible only behind a login wall
> while we resolve one question before any public release.
>
> Your FIMH 2025 paper acknowledges participants of both **UK Biobank** and
> **CARDIOHANCE**, and the repository carries no data statement. Could you tell us:
>
> 1. Which cohort the bundled `patient1` demo case comes from?
> 2. If UK Biobank — we assume redistribution of derived geometry is not permitted
>    under their access terms, and we will withdraw the asset. Please correct us if
>    that is wrong.
> 3. If another cohort — are you content for the fitted meshes of that case to be
>    redistributed in derived form (a decimated glTF surface, no imaging data),
>    with attribution to biv-me and a citation to the FIMH paper?
> 4. Is there a data statement you would like us to reproduce alongside it?
>
> We are happy either way: if the answer is that it cannot be redistributed, we will
> remove it and use a CC0 alternative. We would rather ask than assume.
>
> With thanks,
> [name, affiliation]

If the answer names a restricted cohort, drop to **C3** — the Sunnybrook CC0
fitted models, which carry no such question.

### Verification gate

Frame count is 25 per surface; the face-index hash is identical across all frames;
total triangles are 11,616; the bounding box contracts to a minimum and returns to
its starting extent, so the loop is seamless; scale is metres; and the heart sits
inside the atlas's thorax rather than being fitted to body height.

---

## A1 — Import the four remaining Z-Anatomy files

> ### ✅ Done by PR #1, landed 28 July 2026 — and solved better than planned
>
> The `priceless-lamarr` branch merged while B6 was being built, which both removes
> A1's prerequisite and completes A1 itself. `SOURCES` now takes **all seven**
> system files. Measured on the rebuilt asset: **3,618 structures, 3,194,817
> triangles**, eleven merged nodes instead of three — bone, muscle, connective,
> then `organ` nodes for nervous, cardiovascular, lymphoid, respiratory,
> digestive, metabolic, endocrine and reproductive. `docs/LICENCE_LOG.md` is
> generated and lists the three third-party components.
>
> **⚠️ The asset on `main` is stale.** `public/models/` is gitignored, so the
> rebuilt atlas did not travel with the merge: `main` still holds the 3-file build
> at 2,077 structures and 1,509,259 triangles, while the 7-file build exists only
> in the worktree that produced it. **Rebuild on `main` before trusting anything
> visual.** That is the one piece of A1 still outstanding, and it is compute, not
> code.
>
> **My recommendation on lymphoid was wrong, and the answer they found is better.**
> This plan said to extend `SystemId` with `lymphatic` and called filing it under
> `cardiovascular` a fudge. Both were right as far as they went and both missed a
> third option: set `system: 'lymphoid'`, a value deliberately **not** in
> `SystemId`, so `systemForGroup` returns null and `AtlasBody` renders those meshes
> **unresolved** — visible, hoverable and named, simply not score-coloured. The
> reasoning is the part worth keeping: `SystemId` is the *health-data* contract and
> D8 put health mapping upstream, so widening it for a purely geometric reason
> would drift a contract this repo does not own. And the fabrication objection is
> sharper than I put it — the spleen is not cardiovascular and the thymus is not
> endocrine. For a viewer that no longer scores, unresolved is exactly right.
>
> The triangle-budget worry was real and landed mid-range: 3.19 M against the 1.51 M
> it replaced, roughly a doubling as predicted, and 9.1 M raw before simplification.
> The `CardioVascular41` version-suffix flag was also justified — the importer now
> carries a comment warning the file may be partial.

**Inputs verified today.** All seven system files are on disk at
`~/Downloads/z-anatomy-fbx/`, and the importer's `SOURCES` array takes three of
them:

| On disk | Size | In `SOURCES`? |
|---|---|---|
| `SkeletalSystem100.fbx` | 41.3 MB | yes — bone |
| `MuscularSystem100.fbx` | 37.3 MB | yes — muscle |
| `Joints100.fbx` | 9.8 MB | yes — connective |
| **`CardioVascular41.fbx`** | **64.9 MB** | no |
| **`NervousSystem100.fbx`** | **53.9 MB** | no |
| **`VisceralSystem100.fbx`** | **18.4 MB** | no |
| **`LymphoidOrgans100.fbx`** | **2.1 MB** | no |
| `References100.fbx` | 0.3 MB | no — annotation, correctly excluded |
| `Regions/` | 4.4 MB | no — duplicates geometry (D12b) |

### Findings

**⚠️ This roughly doubles the input, and the triangle budget is already the
constraint.** The three imported files total 88.4 MB and produce **1,509,259
triangles** in `z-anatomy.ao.glb` (measured). The four additions total 139.1 MB —
more than the current input. A naive import could push this single atlas past 3 M
triangles against a body already described as at the edge of the Quest budget.
**Decide the triangle budget before running the build, not after**, and expect
`--simplify-ratio` to need retuning per system rather than globally.

**⚠️ `LymphoidOrgans100.fbx` has nowhere to go.** `SystemId` in
`src/data/schema.ts` is a closed union of nine members and lymphatic is not one.
The change is small and mostly compiler-guided: exactly **two compile-forced**
locations, `COMPOSED_SOURCE` in `anatomySources.ts:395` and `SYSTEM_COLORS` in
`anatomyPalette.ts:68`, both `Record<SystemId, …>`. Everything else keys `SystemId`
through string-keyed maps and will not break. So the work is one line in
`schema.ts`, two forced entries, a palette colour and UI labels — but it is a
**data-contract change** shared with the upstream health-data join, so it should be
a deliberate decision rather than a side effect. Recommend extending the union;
filing lymphoid under `cardiovascular` is defensible in textbooks and still wrong
for a viewer, since the lymphatic system has no pump and a user would look for it
by name.

**⚠️ And one site will accept it silently rather than erroring.** The material
switch in `anatomyPalette.ts` ends in `default:`, so lymphatic structures would
fall through to the generic viscera material — roughness 0.42, clearcoat 0.45 —
with no compile error and no warning. Lymph nodes and vessels are not
wet-clearcoat viscera, so **add the case explicitly.** This is the same class of
defect the file already documents against itself: an integumentary roughness of
0.45 that was silently shadowed and never once rendered until a live tuner read
the material instead of the source.

**Note the version oddity:** `CardioVascular41`, not `…100`. Worth a glance at
whether that file follows the same naming and collection conventions the importer
assumes, since every existing rule — laterality suffixes, attachment footprints,
landmark stripping — was written against the `…100` files.

### Steps

1. Land the `priceless-lamarr` branch so per-structure `component`/`licence`
   tagging and `check:licences` exist.
2. Extend `SystemId` with `lymphatic`; fix the two compile errors; add a palette
   colour and UI label.
3. Add the four entries to `SOURCES` with their systems and layers.
4. Import **one file at a time**, checking structure count, triangle count and the
   licence log after each, so a surprise is attributable to a single file.
5. Re-run `check:structures`, `check:winding` and `check:licences`.

### Verification gate

Every added structure carries a `component` and `licence` field; the licence log
regenerates from the shipped GLB and lists the Dundee inner ear, the lissiecowley
kidney and the University of Washington white matter with non-zero counts; no
structure name matches the attachment-suffix or laterality traps
(`/(muscle|ligament|tendon|aponeurosis|fascia)[eo]\d*$/`, and the midline check);
triangle count is inside the budget decided in step 0.

---

## B2 — Healthy-Total-Body-CTs

> ### ✅ DONE and registered, 28 July 2026 — the female-body gap is closed
>
> Ships as **"CT (female)"** in the switcher: `htb-ct-003.glb`, 975,424 triangles
> across 33 structures, 27.0 MB, **33/33 watertight**, `check:winding` and
> `check:licences` green.
>
> **The blocker below was resolved by decision: a crown-to-toe height reference.**
> `AnatomySource.heightFrom` lets an atlas name the structures that define its
> height, and `AtlasBody`'s fit uses that for the vertical ruler and for grounding
> the feet, while horizontal centring still uses the full box. Verified on the
> built asset:
>
> | ruler | height | error vs recorded 1.7018 m | scale |
> |---|---|---|---|
> | full bounding box | 1.8579 m | **+9.17 %** | 0.9150 |
> | `heightFrom` crown-to-toe | 1.7083 m | **+0.38 %** | 0.9951 |
>
> So the old fit would have rendered every organ **8.1 % small**. Nothing is
> cropped and nothing is repositioned — the raised arms stay above the head where
> they were.
>
> **⚠️ `heightFrom` NO LONGER EXISTS — the measurement above is what killed it.**
> A parallel branch had introduced `AnatomySource.registration` for the *partial*
> CT atlas, which cannot be fitted from its bounds at all, and on merging the two
> the table above answers the question for this atlas too: an implied scale of
> **0.9951** means the geometry is already life-size, so there is nothing to
> measure a scale from. `htb-ct-f` now declares `registration: { realScale: true,
> anchor: { rawY: 0.5941, worldY: 0 } }` — the lowest toe phalanx on the floor,
> re-verified against the shipped GLB — and is not rescaled at all. Same rendered
> outcome as the crown-to-toe ruler, one mechanism instead of two, and no ruler to
> be wrong about. Read `AtlasBody`'s `fit` memo, not this passage, for the code.
>
> **⚠️ And a self-inflicted bug worth keeping.** The `Toes` fix first used 3-D
> centroid distance at 300 mm and **deleted an entire humerus** (77,530 voxels at
> 353 mm) plus an ulna (19,908 at 308 mm) — because this corpus merges left and
> right, so a paired bone's two halves are an arm span apart. Distance from the
> midline is normal anatomy, not damage, and no threshold fixes that: tightening it
> just changes which bone dies. The rule now measures the gap along the
> **head-to-toe axis against the main component's range**, which separates the
> cases on their physics: paired bones overlap in head-to-toe position (gap 0,
> kept), ribs and carpals are adjacent (small gap, kept), the stray toes sit
> 1,788 mm away (dropped). The axis is read from the image's `axcodes`, not assumed.
> Post-fix volumes: Humerus −1.4 %, Ulna −3.9 %, Skull +0.9 %, Tarsal −0.1 %.
>
> **The reason it was caught is that every drop prints.** A silent filter would
> have shipped a one-armed skeleton, and the volume checks would not have flagged
> it — removing a whole component leaves the remaining mesh perfectly
> self-consistent.
>
> Still true and still recorded below: the labels are grouped, decimation starves
> the smallest structures (Toes −16.7 %, Fingers −16.2 %), and `VERIFY OK` is
> vacuous on this corpus because the orientation check needs left/right class names
> that grouped labels do not have.
>
> <details>
> <summary>The blocker as it stood before the decision</summary>
>
> `--labels` landed, the 36 labels are mapped to UBERON, and
> `public/models/htb-ct-003.glb` builds: **975,402 triangles across 33
> structures, 27.0 MB, all 33 watertight.**
>
> **Everything the survey claimed is verified at source.** Segmentations and
> clinical data are both CC BY 4.0, only the images are behind NIH controlled
> access, and they are not needed. Cohort **16 F / 14 M**; subject 003 is **F, 26,
> 1.7018 m, BMI 20.4**. All 36 labels in every file, labelled extent 1,863.5 mm,
> and `Toes` carries 24.3 mL — you cannot have toes without a head-to-toe scan.
>
> **Correctness checks that did work.** Every structure is watertight (0 open
> edges), and mesh volume matches label volume within ±1.4 % for all ten largest
> structures — lung +0.6 %, skull +0.9 %, ribcage −0.9 %, liver +0.3 %. That is
> the real evidence the meshing and the winding reversal are right.
>
> **⚠️ And one that did not: `VERIFY OK` is vacuous on this corpus.** The
> orientation check keys off MOOSE's left/right class names, and every label here
> is a bilateral group with no side, so it ran **0 checks over 33 structures** and
> printed OK anyway. A gate that looks passed and never ran is worse than a
> failing one.
>
> ### Three findings that stop it being an atlas
>
> **1. The arms are raised above the head.** Skull spans z 644–742 while the
> fingers reach 806, the whole forearm above the skull. That is why the extent
> exceeds standing height by 162 mm — and it breaks `AtlasBody`'s fit, which
> scales bounding-box height to `CANONICAL_HEIGHT_M`. Fitting toe-to-fingertip to
> 1.7 m would **shrink every organ by about 9 %**, in a pose no other atlas here
> uses. This is the blocker, and it is a decision about what the atlas is for
> rather than a bug: either a pose-aware fit (skull-to-toe, ignoring raised limbs)
> or crop the arms.
>
> **2. The `Toes` mask is contaminated.** Its 37 slices split into real toes at the
> bottom and ~660 stray voxels at z 785–804, up among the fingers — finger
> phalanges mislabelled as toes. `--min-voxels` cannot catch it because it filters
> per label, not per connected component. Rendered as-is this puts a toe floating
> by the hand.
>
> **3. Decimation starves the small structures.** The three worst volume errors are
> the smallest meshes: Toes −18.1 % at 510 triangles, Adrenal-glands −17.6 % at
> 126, Fingers −16.2 % at 790. Adrenal-glands landed on the `--min-triangles 120`
> floor exactly. And the decimator is **non-monotonic** — a smaller factor produced
> *more* triangles (pass 3: 1,188,900 against pass 2's 975,402) — so it overshot the
> 380,000 target by 2.6× and stopped at the best pass rather than the target. This
> is item 5 of `docs/CT_ATLAS_PIPELINE.md` §10 reproduced on new data: budget by
> surface area with a density floor.
>
> ### And a measurement that settled an open question
>
> Body composition is **out of the geometry path**, on numbers rather than taste. A
> first build kept the three tissue masks and produced **403 MB of 15,190,538
> triangles against a 380,000 target** — subcutaneous fat 46.1 %, skeletal muscle
> 35.3 %, torso fat 12.1 %, **93.5 % between them** against 988,246 for all 33
> others. D5a had parked this as undecided between the geometry and scoring paths;
> for geometry it is now decided. The rows stay commented in the crosswalk so the
> mapping work survives.
>
> </details>

**Deliverable.** A head-to-toe female CT-derived atlas GLB, and the same for a
male subject, from the CC BY 4.0 segmentation archive — no CT images needed.

### Finding: this is not just a crosswalk edit

`scripts/ct-atlas/labelmap2glb.py` resolves integer labels to class names through
a chain that assumes MOOSE ran locally:

```
filename → _SEG_RE  ^(clin|preclin)_(CT|PT|MR)_<region>_segmentation_
         → model_id  e.g. clin_ct_organs
         → a hard-coded map of 10 model ids → nnU-Net dataset folders
         → dataset.json inside .venv, read for its label table
         → SystemExit on anything unknown
```

TCIA's release is **pre-computed segmentations**. Its filenames will not match
`_SEG_RE`, and its label integers follow the release's own **coarser** scheme —
grouped `Ribcage`, `Spine`, `Carpal`, `Fingers` — not MOOSE's finer per-rib and
per-bone classes. So renaming files would silently map integers through the wrong
table, which is worse than failing.

**The change is a new `--labels` option** supplying an explicit integer-to-name
map read from a JSON or TSV, bypassing `label_names()` entirely. That is smaller
than adding an eleventh hard-coded branch and general enough to accept any future
pre-segmented corpus. Then crosswalk rows for the grouped names, **each verified
against EBI OLS4**, which is the discipline `moose-uberon-crosswalk.tsv` already
states for itself. Grouped names may have no single clean term; the crosswalk
already has a `status=flag` mechanism and `--strict` to express that honestly.

Everything else is existing CLI surface: `--target-triangles` (default 380,000),
`--min-triangles 120` so small bones survive decimation, `--min-voxels 20`,
`--smooth-iterations 24`, `--include-unmapped`, `--report`.

### Steps

1. Fetch the 85 MB segmentation archive and the CC BY 4.0 clinical spreadsheet.
2. **Measure the z-extent against recorded standing height** before any compute.
   This is the check that caught ENHANCE.PET at 45–63 % of height; expect ~1,941 mm
   for a genuine head-to-feet field of view.
3. Add `--labels` to `labelmap2glb.py`.
4. Write the label list and the crosswalk rows; verify every CURIE against OLS4.
5. Build one female subject, then one male, with `--report`.

### Carry these caveats into the asset, not just the plan

Slice thickness is 2.34 mm and will stair-step in z. The scans are low-dose
non-contrast, so **bones are trustworthy and viscera are less so** — D10's
contrast objection applies to the organ masks even though bone-to-air contrast is
unaffected. And the labels are grouped, so this atlas gives whole-body *coverage*
but not the per-structure identity Phase 1 exists to provide. The complement for
granularity is the TotalSegmentator CT dataset, which has per-rib and per-vertebra
labels and nothing distal to the knee.

### Verification gate

z-extent matches recorded standing height; all expected labels present; the
per-structure report shows no structure decimated below the floor; node names
carry resolvable CURIEs; `AtlasBody`'s bounding-box fit is *not* silently
stretching a partial body.

---

## B8 — Generate the eye

> ### ✅ Done, 28 July 2026 — and it is the only asset here we own outright
>
> `scripts/build-eye.mjs` → `public/models/eye.glb`, registered as an organ
> overlay and toggleable next to the heart. Cornea 18,432 triangles, lens 18,432,
> retina 9,120.
>
> **No upstream rights holder at all.** Generated from the published Arizona eye
> model's radii, conic constants, thicknesses and indices. Those are measurements,
> and measurements are not copyrightable expression, so there is no licence, no
> attribution chain and nothing to disclose. Crediting Schwiegerling is
> scholarship, not a condition. **This is the pattern to reach for whenever a
> structure is fully specified in the literature.**
>
> **Verified numerically, which is what made it safe to do unattended:**
>
> | Check | Result |
> |---|---|
> | Axial length at A=0 | **24.000 mm exactly** |
> | Paraxial routine self-test | reproduces **LeGrand's published 59.94 D** |
> | Arizona total power | 60.62 D — trusted *only* because of the line above |
> | Cornea, lens watertight | 0 boundary edges each |
> | Retina rim | one clean ring of 96 edges — the eye is open at the front |
> | Accommodation 0–10 D | all build and pass; power rises 60.6 → 72.3 D |
>
> **The self-test is the load-bearing part.** Arizona publishes no total power, so
> checking its 60.62 D against itself would be circular. Running the same routine
> over Gullstrand-LeGrand, which *does* publish 59.94 D, returns exactly that — so
> the ray transfer, the sign conventions and the millimetre-to-dioptre conversion
> are all confirmed before the Arizona figure is believed.
>
> **Two findings from building it.** The lens edge is **solved, not assumed**: the
> two lens surfaces separated by the lens thickness intersect at exactly one
> radius, so the model implies its own equator. It comes out at 11.20 mm diameter,
> which is *not* Atchison's published 9.6 mm — and should not be, because that is a
> different model with a different anterior conic. And past roughly 6 D of
> accommodation Arizona's anterior lens conic goes **positive**, so the surface
> becomes oblate and terminates before reaching the posterior one. That is a real
> property of the model, not a bug; the build closes the lens at the domain limit
> with a rim band and records `lens_edge_is_model_intersection: false` rather than
> inventing an intersection.
>
> **Placement from anatomy, in two senses.** `y` and `z` are measured off the
> shipping atlas — Z-Anatomy's `Orbital part of orbicularis oculi` averages to
> (±0.0252, 1.5839, 0.0705) per side, and the globe centre sits ~14 mm behind that
> lid plane. `x` is the population mean interpupillary distance, 63 mm, because the
> orbicularis centroid is pulled medially by its broad medial part and is not the
> pupil. The quaternion is identity and that is correct: the asset is generated with
> its optical axis along +z, the body faces +z, and the visual axes are parallel for
> distance fixation. The *orbital* axes diverge ~23°, but that is bone, not gaze.
>
> **It supersedes nothing** — no atlas loaded here contains an eyeball. Z-Anatomy's
> 3,618 structures include the orbicularis and no globe, and HRA's four eye
> reference organs are separate downloads absent from the whole-body GLB. So this
> adds an organ rather than replacing one.
>
> Registry changes it forced, both of which the next organ will want: overlays now
> carry **bilateral instances** (two independent copies, not one mirrored group,
> because mirroring inverts winding), and `system` is now `string` so a value
> outside `SystemId` renders unresolved — `sensory` here, following the `lymphoid`
> precedent rather than claiming the eye is the nervous system.

**Deliverable.** `scripts/build-eye.mjs` and `public/models/eye.glb` — geometry
this project owns outright, under no upstream licence, with no attribution chain.

### Steps

1. Implement the conic sag equation
   `z = (r²/R) / (1 + √(1 − (K+1)r²/R²))` and generate each refracting surface as
   a surface of revolution.
2. Use the **Arizona** model as the primary, because it publishes accommodation
   formulas, so radii, conics and thicknesses can vary with focus and the geometry
   animates correctly rather than being a fixed shell.
3. Write the GLB with `@gltf-transform/core`, the same path `build-z-anatomy.mjs`
   uses. Scale in metres.
4. Label it a **schematic optical model** in the structure table and in the UI.

### The honesty constraint here is a labelling one

A schematic eye is cornea, aqueous, lens, vitreous and retina. It has **no sclera,
no extraocular muscles, no vasculature and no optic nerve**. It is an optical
model, not an anatomical one, and must not be presented as a donor's eye or as
filling the anatomical gap. What it legitimately does is give the atlas an eye that
is correct as optics and honestly labelled as such.

If an anatomical orbit is wanted later, **TOM500 is CC0** with nine segmented
orbital structures including all the extraocular muscles — but it is voxel data
and therefore a B2-shaped task, not this one.

### Verification gate

Paraxial power computed from the generated surfaces reproduces the published
figure for the chosen model; axial length is ~24 mm; each surface is watertight;
the accommodation formulas produce a monotonic change in power across the
dioptre range.

---

## B3 — OpenEar as the D4 texture pilot

> ### ✅ DONE, 29 July 2026 — and **D4 is answered: the colour survives**
>
> Ships as the `openear` organ overlay: 12 structures of OpenEar specimen ZETA,
> base colour sampled from that specimen's own true-colour micro-slicing volume.
> This is the first asset in the project coloured by what the tissue *looked like*
> rather than by a palette we chose.
>
> **The blocker was one multiplication.** `gltf-transform unwrap` produced usable
> UVs for 1 of 12 meshes; the other 11 came back with a correctly-sized
> `TEXCOORD_0` in which every value was **NaN**. The recorded hypothesis — a shared
> atlas, fix by unwrapping each structure as its own file — was **tested and is
> wrong**: one mesh per file still gives 1/12, and `--group-by
> primitive|mesh|scene` all give 1/12. It is a UNITS problem. Stage 1 converted to
> metres before unwrapping, so a 2 mm malleus spanned 0.002 units with triangle
> areas near 1e-8, under xatlas's degenerate-face epsilon.
>
> | positions in | usable UVs |
> |---|---|
> | metres | **1 / 12** |
> | centimetres | 12 / 12 |
> | millimetres | **12 / 12** |
>
> UVs are scale-invariant, so unwrapping in source units is free; the conversion to
> metres moved to after the bake.
>
> **Coverage, honestly.** 71.5 % of the ear's SURFACE has a colour source. The rest
> is neutral grey where the micro-sliced block runs out, and the grey is counted per
> structure into the asset's extras — 100 % on nine structures, 96.4 % on the
> cochleovestibular nerve, 97.8 % on the carotid, 63.8 % on the dural sinus. Those
> are exactly the three predicted to extend past the ~39.6 x 39.6 x 51.8 mm block,
> which is the check worth having: the missing colour is where the physics says.
>
> ⚠️ The headline "% of texels" figure is a **bad** quality metric and is no longer
> the one reported. It moved 96.0 % → 89.1 % when the textures were resized, with
> nothing about the colour changing. Area weighting is printed instead.
>
> **Texture sizes come from the source, not from a constant.** The structures span
> two orders of magnitude in area, and 50 µm in-plane sampling caps what any of them
> can hold. A flat 1024² gave the stapes 113× more texels than its 23 mm² justifies
> — inventing every one of them — while *under*-sampling the 7,653 mm² dural sinus.
> Sizing per structure gives 3.9M texels against 12.6M, at higher fidelity where it
> matters.
>
> **KTX2 was NOT used, deliberately.** It needs the `ktx` CLI, which is not
> installed and is a new system dependency. Lossless WebP was measured against it
> instead: 9.14 MB with **zero** colour error, where q95 saves a further 1.4 MB and
> introduces error. Most of the texture area is flat background and honest grey, so
> lossy buys little — a poor trade in a pilot whose whole purpose is measuring
> whether colour survives. GPU memory is the cost: WebP decompresses in VRAM where
> KTX2 would not, so revisit for XR.
>
> **Placement is FITTED, and it is the first one here that is.**
> `scripts/place-overlay.mjs` (new, reusable) matches five landmarks present in both
> the specimen and Z-Anatomy — malleus, incus, stapes, cochlea, tympanic membrane —
> and solves Horn's absolute-orientation problem. RMS **1.27 mm** on structures a
> couple of millimetres across. The same fit established that ZETA is a **RIGHT**
> ear: 1.26 mm against the right, 2.32 mm against the left, and Horn's method cannot
> produce a reflection to hide the difference. `--verify` re-checks the stored
> numbers and reports 1.27 mm right versus 90.08 mm left, so a side swap cannot pass
> unnoticed.
>
> **Two limitations kept rather than papered over.** The specimen is ~14 % larger
> than Z-Anatomy's inner ear (optimal scale 1.136, consistent to 0.1 % across both
> side fits) and is left unscaled — and the discrepancy is at least as likely to be
> Z-Anatomy's, whose inner ear is the third-party Dundee component in TARO's skull.
> And it supersedes nothing: `supersedesStructures` matches by name, Z-Anatomy names
> both ears' ossicles identically, so hiding them would blank the left ear too.
> Side-aware masking is the fix.

> ### ✅ The hard part is solved: mesh and colour volume are aligned
>
> **`FlipXY` alone does it, and it is verified rather than argued.** The meshes are
> in **RAS** and every volume is in **LPS**, so the conversion is negate-x-and-y —
> which is exactly what the shipped `FlipXY.h5` contains, `diag(−1, −1, 1)`.
>
> Two quantitative gates, both run because the browser pane cannot render and so
> "it looks right" was never available:
>
> | gate | raw mesh coords | after `FlipXY` |
> |---|---|---|
> | vertices inside `Segmentation.seg.nrrd` | 0–49 of 400 | **400 / 400, all 12 meshes** |
> | landing on a labelled voxel | 4 % | **54–96 %** |
> | vertices inside `Microslicing_Zeta.nrrd` | — | **6,985 / 7,200 = 97 %** |
> | of those, on non-black tissue | — | **essentially all**, mean RGB ≈ (165, 155, 110) |
>
> The 54–96 % on-label spread is not misalignment: the low end is the three
> ossicles, and a *surface* vertex sits on the label boundary by definition, so at
> 0.125 mm voxels it lands on the background side about as often as not. The warm
> pale mean RGB is what micro-slicing photographs of a temporal bone should look
> like.
>
> **And no CBCT registration chain is needed**, which is the simplification worth
> recording. I expected to have to compose `BrainsFit` with `InitialGuess` and get
> the direction convention right — the single largest correctness risk in this
> item. It turns out unnecessary: the folder name `05_Registred_Slicer_Volumes` was
> the clue, and the volumes in it are already resampled into one common frame. So
> the whole transform question collapses to a coordinate-convention flip.
>
> **Coverage is partial by nature, and that is a property to carry forward.** The
> micro-sliced block is about 39.6 × 39.6 × 51.8 mm, smaller than the CBCT, so
> `Sinus Dura` (416/600 inside) and `Cochleovestibular Nerve` (582/600) run out of
> it. Any bake must mark texels with no colour source rather than inventing one —
> the same rule as `hasData: false`, applied to a texture.
>
> `gltf-transform unwrap` (xatlas) is confirmed present, so the UV stage has no new
> dependency. What remains is the rasterise-and-sample pass, KTX2, and the
> `COLOR_0` decision.
>
> ### ◐ Characterised, 28 July 2026 — and the premise needed correcting
>
> Licence re-confirmed **CC BY 4.0** from the Zenodo API. Specimen ZETA indexed
> **without downloading it**: 2,917 entries, of which the meshes are **13 PLY files
> totalling 139.7 MB** in `07_3D_Models/`. New reusable tooling for that —
> `scripts/remote-zip-index.mjs` and `scripts/remote-zip-extract.mjs` — reads a
> remote zip's central directory over range requests and pulls single members. It
> saved 3.87 GB on this specimen and will save more on GAMMA and DELTA at 13.5 and
> 14 GB.
>
> **The 13 structures are exactly the right pilot subject:** scala tympani, scala
> vestibuli, all three ossicles (malleus, incus, stapes), facial nerve, chorda
> tympani, cochleovestibular nerve, tympanic membrane, external auditory canal,
> dural sinus, internal carotid, and the temporal bone itself at 135 MB.
>
> **⚠️ THE CORRECTION: the meshes carry no colour.** Every PLY declares
> `property float x/y/z` and a face list, and nothing else — no `red`/`green`/`blue`,
> no UVs, no texture reference. So the claim that OpenEar is "already registered
> colour plus geometry" is only half right, and the wrong half was load-bearing for
> this plan. The colour and the geometry are registered *to each other*, in a stated
> space, with the transforms shipped — but the colour is **not attached to the
> mesh.**
>
> **Where the colour actually is:**
> `04_Reconstruction_Microslicing/Microslicing_Zeta.nrrd`, 305 MB, and its header
> settles what it is:
>
> ```
> type: unsigned char      dimension: 4      sizes: 3 792 792 346
> kinds: vector domain domain domain        space: left-posterior-superior
> space directions: none (-0.05,0,0) (0,-0.05,0) (0,0,0.15)
> ```
>
> A leading vector axis of 3 over `unsigned char` is **8-bit RGB**, at **50 µm in
> plane and 150 µm between slices**. That is real photographic colour at a real
> resolution, and it is the substrate a bake would sample.
>
> **So B3 is D4 in miniature after all, which is the point — but the work is a
> volume-to-surface bake, not an import.** There is no route where the mesh arrives
> coloured. That also means my earlier framing of B3 as "needs xatlas unwrap, a
> texture and KTX2" is a *conclusion* rather than a given: baking to per-vertex
> colour needs none of that and reuses the `COLOR_0` convention the AO bake already
> established. Which route to take is a real fork, and it is stated below rather
> than assumed.
>
> **The fork.** Per-vertex colour is cheap and reuses existing machinery, but
> colour resolution then equals mesh resolution — and the malleus has **2,000
> vertices**, so 50 µm colour would be thrown away almost entirely. A texture bake
> preserves it and needs the UV and KTX2 pipeline that does not exist. Either way
> there is a second decision: `COLOR_0` is already occupied by baked ambient
> occlusion, so occlusion and base colour must either be multiplied together at
> bake time or kept in separate channels.

**Deliverable.** An answer to D4 — does photographic tissue colour survive this
pipeline — on a 7 GB asset instead of a whole body.

### Finding: this is a pipeline task, not an asset task

**There is no texture pipeline at all.** Measured across all three shipped
atlases: `POSITION` and `COLOR_0` only. **No `UV`, no `NORMAL`, no textures, no
images**, and `COLOR_0` is occupied by baked ambient occlusion.

So a colour-textured asset needs, in order: UV unwrap (xatlas via
`gltf-transform unwrap`, already recorded in `RESOURCES.md` as MIT and "not needed
yet" — this is when it becomes needed), a texture image, KTX2 compression, and a
decision about how occlusion and base colour combine. Either multiply AO into the
texture at bake time, or keep AO in `COLOR_0` and have the material multiply both.
The second preserves the existing convention and keeps AO independent of texture
resolution.

**That is the honest reason this sits last**, and it is worth confirming rather
than discovering: B3 introduces the first textured asset in the project, and every
downstream step (`gltf-transform optimize`, the AO bake, `check:winding`) was
written for untextured geometry.

### Steps

1. Take **one specimen**, not the set — the full OpenEar release is 8 zips
   totalling 59.1 GB because it ships raw imaging alongside the models.
2. Get the untextured model through the existing pipeline first, to isolate
   pipeline problems from texture problems.
3. Add UV unwrap, then the texture, then KTX2.
4. Decide and document the AO-versus-base-colour composition.

### Verification gate

A measured before-and-after on the colour: does it survive retopology, decimation
and the AO bake, stated as a number rather than an impression. That *is* D4's
question, and the deliverable is the answer, not the asset.

---

## What this plan does not resolve

- **The biv-me provenance answer.** B6 is buildable today and not publishable
  until that email is answered.
- **The A1 triangle budget.** Needs a number before the build, and nobody has set
  one.
- **Whether `CardioVascular41.fbx` follows the `…100` conventions** every importer
  rule was written against.
- **Whether the grouped TCIA labels have defensible single UBERON terms**, or
  whether several should ship flagged.
- **How a non-atlas overlay source appears in attribution** — needed by B6, and it
  is the first time the registry has been asked to hold something that is not a
  whole-body atlas.
