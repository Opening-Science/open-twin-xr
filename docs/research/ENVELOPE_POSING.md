# Posing the ANNY envelope — implementation strategy

> ## Status, 18 August 2026 — BUILT, all but one Phase 5 item
>
> **This document is now history.** `docs/DECISIONS.md` **D25** (the posed
> overlay) and **D26** (the position sliders) are the current record and win
> wherever they and this disagree.
>
> - **Phases 0–4 — the posed overlay.** The envelope is posed to the atlas on
>   screen, per-atlas, prebaked. In D16's own metric the Z-Anatomy span error
>   went from **+0.456 m to +0.013 m** and containment from 33 % to 74 %.
> - **Phase 5 — the standalone position sliders.** Four sliders (arms out,
>   elbows, stance, knees) over a 395 KB baked rig, with the measurements taken
>   at rest so a pose cannot move a stated height. See D26 for the defects
>   that each failed silently on the way.
>
> **One item from Phase 5 was NOT built: the glass-hull toggle for the
> standalone body.** It was reviewed and approved, and then simply not reached;
> the parametric body still renders opaque. Nothing depends on it.
>
> ### What shipped
>
> | | |
> |---|---|
> | `scripts/anny/check_pose_conventions.py` | measures ANNY's four pose conventions before anything relies on them |
> | `scripts/anny/measure_atlas_pose.mjs` | fits limb axes per atlas → generated `atlas-poses.json` (`npm run measure:atlas-pose`) |
> | `scripts/anny/bake.py --pose <id>` | aims ANNY's bones along those axes |
> | `scripts/anny/convert-posed.sh` | `npm run convert:anny:posed` |
> | `scripts/gen-envelope-poses.mjs` | generated `src/scene/envelopePoses.ts` (`npm run gen:envelope-poses`) |
> | `scripts/anny/check_posed_fit.mjs` | the acceptance metrics |
> | 8 GLBs, ~850 KB | 4 poses × 2 adult presets, credited in `licences.json` |
>
> Nine modes resolve to four poses; `ct-atlas-f` stays unposed by measurement.
>
> ### Where the plan below was WRONG, corrected by measurement
>
> 1. **The pose count.** Estimated 4–5 distinct poses "plus sharing"; measured
>    **four**, because BodyParts3D and Z-Anatomy agree to 3.6° and the regions
>    atlas inherits its declared twin.
> 2. **"`hra.glb` has stray geometry."** It does not. Both the depth anomaly and
>    the 65,534-unit bodies came from **reading node transforms incompletely** —
>    twice, once ignoring rotation and once ignoring everything. With full
>    transforms HRA measures a normal 1.658 m. ⚠️ The plan's §1 table was
>    measured on the wrong files entirely: the registry loads `.ao.glb`, not
>    `.glb`, for five of seven sources.
> 3. **"Fall back to a declared default."** Reviewed and approved, then measured
>    and REVERSED. Borrowing the standing atlas's arms for HRA was 34 cm wrong;
>    an unmeasurable limb now keeps ANNY's rest pose, and HRA's arms are measured
>    from its skin instead. See D25.
> 4. **BodyParts3D names its right femur "right thigh"** — the left is "left
>    femur". Not anticipated; found by a segment reporting absent.

**Original strategy, as reviewed.** Researched 18 August 2026 against `anny`
upstream (`github.com/naver/anny`) and the shipped assets; revised the same day
to the maintainer's scope directives.

## 0. The directives this revision encodes, and how they were read

The maintainer's instructions, restated so the review can catch a misreading:

1. **Prebake posed overlay variants for ALL atlas entries.** (This corrects the
   first instruction of 18 Aug, which scoped the overlay to the composed modes
   only; the maintainer withdrew that restriction the same day.) The envelope
   row stays offered exactly where it is today — every mode except
   `parametric` — and on each mode it loads the variant posed like that mode's
   body. The composed modes take the pose of whichever atlas supplies their
   `musculoskeletal` system, since that is the geometry that defines limb pose.
2. *(withdrawn — see 1.)*
3. **"The envelope itself should also be implemented … under the top Atlas
   pills, and there sliders for change of body position"** → the standalone
   parametric mode (already a switcher entry since D18) gains **pose sliders** —
   live control of body position, which prebaked GLBs cannot provide, so this
   half is runtime posing.
   - "Just as the hull" was confirmed at review to mean the rendering too: the
     standalone body gains a glass-hull **toggle** (opaque stays the default),
     reusing the envelope's material path.
4. **"I agree with the pre-build approach for the overlay"** → overlay = baked
   static GLBs; runtime skinning is only for the standalone sliders.

With the overlay per-atlas, D14/D16's original motivation stays served — the
skinless atlases keep the envelope as their only hull, and now one that
actually encloses them.

---

## 1. The problem, measured

D16 measured the mismatch on Z-Anatomy: envelope 1.124 m across the arms against
the atlas's 0.646 m — angular, not dimensional, so no uniform scale fixes it.

Re-measured 18 Aug 2026 across every shipped body (POSITION min/max over all
primitives, `@gltf-transform/core`; width/height ratio is the pose signature):

| asset | W/H | reading |
|---|---|---|
| z-anatomy | 0.393 | arms at the sides |
| z-anatomy-regions | 0.390 | same pose as z-anatomy (same source export) |
| bodyparts3d | 0.388 | arms at the sides |
| htb-ct-003 | 0.247 | arms tight to the body (supine CT) |
| ct-atlas-f | 0.437 | **partial body** (H 0.861 m, torso) — not comparable |
| hra-m | 0.572 | arms part-abducted |
| hra | 0.744 | ⚠️ bbox poisoned — D 2.037 m says stray geometry; do not trust |
| anny-adult-f | 0.618 | ANNY rest pose: wide A-pose |
| anny-adult-m | 0.651 | ANNY rest pose: wide A-pose |

With the overlay per-atlas, the distinct pose *targets* are fewer than the mode
list suggests, because poses are shared:

- **`z-anatomy`** — measured from its long bones; expected to also cover
  `z-anatomy-regions` (0.393 vs 0.390 — the script must *confirm* the share,
  not assume it) and **`composed`**, whose musculoskeletal system Z-Anatomy
  supplies (BodyParts3D, the other contributor, agrees at 0.388 — both TARO).
- **`bodyparts3d`** — measured from its FMA-termed bones; likely within a few
  degrees of z-anatomy, and if the measured deltas all fall under the ~5°
  driving threshold the two collapse to one pose id.
- **`htb-ct-003`** — the strongest mismatch (0.247, supine CT); its own pose.
- **`hra-m`** — part-abducted (0.572), the mildest mismatch; its own pose.
- **`hra`** (and with it **`composed-f`**, which is all-HRA): ⚠️ two problems
  the plan must own. `hra.glb`'s bounding box is poisoned by stray geometry
  (investigate before believing any measurement of it), and **HRA female has no
  upper-limb skeleton at all** — no clavicle, scapula, humerus, radius or ulna
  (measured; see the `COMPOSED_SOURCE_F` commentary) — so her arm pose cannot
  be measured from bones. Arm vasculature/nerves may serve as the axis source
  if they reach into the arms; otherwise the arms take a declared default
  recorded as `"source": "default"` — never a silent guess.
- **`ct-atlas-f`** — a torso; whether any pose applies is for the measurement
  script to state ("no limbs found, rest pose") rather than for anyone to guess.

These ratios must be re-derived by script during implementation, never copied
from this table.

## 2. What upstream actually provides

Verified in the `naver/anny` source (Apache-2.0), primarily
`tutorials/pose_parameterization.py`, `src/anny/models/rigged_model.py`,
`src/anny/utils/pose.py`, `src/anny/skinning/`:

- The forward pass takes `pose_parameters` — one **4×4 rigid transform per
  bone**, dict keyed by bone label or stacked `(batch, bone_count, 4, 4)`.
  Identity everywhere = rest pose. FK and linear-blend skinning are internal;
  the output carries `vertices`, `bone_poses`, `rest_bone_poses`,
  `rest_vertices`.
- `rig="anny"` (what `bake.py` already uses) has 104 bones with MakeHuman-style
  labels: `shoulder01.L`, `upperarm01.L`, `upperarm02.L`, `lowerarm01.L`, …
  Limb segments are split in two (twist bones); the tutorial poses both halves
  with the same rotation.
- **Three pose parameterizations**, selectable per call: `local-bone` (relative
  to parent, in the bone's rest frame), `world` (absolute 4×4), and
  **`world-orient`** — you give each bone a world-space orientation and FK
  resolves its location. `world-orient` is what the overlay bake wants: aim a
  bone along a direction measured from atlas geometry, no chain composition.
- `model.get_bone_ends(...)` / `rest_bone_poses` give rest bone directions, so
  "rotate rest direction onto target" is computable per bone.
- **Skinning weights are computable** (`scripts/compute_skinning_weights.py`,
  `src/anny/skinning/skinning.py`) — the ingredient the standalone pose sliders
  need to export.
- `local-bone` parameterization is the natural encoding for slider-driven
  runtime FK: a slider maps to a local rotation of named joints.

Licence position unchanged: same Apache-2.0 code / CC0 shape assets already in
`bodyEnvelopes.ts`. ⚠️ The `topology="smpl"`/`"smplx"` runtime non-commercial
download trap (D16) applies exactly as before; nothing here touches topology.

⚠️ **The bake environment no longer exists.** No local venv or conda env carries
`anny` (checked `~/.venvs`, miniconda envs, system python, 18 Aug 2026).
Recreate it first, pinning what provenance records: `python3 -m venv
~/.venvs/anny && pip install anny==0.6.0 trimesh roma`. If 0.6.0 no longer
resolves, the bump is itself a change to record in `anny-provenance.json`.

## 3. The two deliverables, and why they use different mechanisms

**A. The overlay (composed modes): prebaked posed GLBs.** Agreed approach. The
pose set is tiny and static — two composed poses — a shipped envelope GLB is
**106 KB**, and every pipeline step (`convert:anny`, AO, copyright stamp,
availability probe) is reused unchanged.

**B. The standalone mode: runtime posing over the shape grid.** Sliders are
continuous; you cannot prebake a continuum. The mechanism is the one the shape
grid already established — bake once in Python, evaluate cheaply in JS:

- `bake_grid.py` additionally exports, **against the grid's own vertex order**
  (never a GLB's — meshopt reorders):
  1. per-vertex skinning weights, top-4 influences, quantised
     (uint8 bone index + normalised weight) — ~110 KB for 13,718 vertices;
  2. the driven-bone hierarchy (parents, labels) and **per-grid-point rest
     joint transforms** — joints move with shape, so they interpolate with the
     same tent basis as the vertices (~a few hundred KB for 360 points ×
     the driven subset of 104 bones);
- at runtime, on a slider change and never per frame: evaluate shape →
  interpolate joint rests → FK from the sliders' local joint rotations → LBS →
  `computeVertexNormals()`. Same cost order as the existing grid evaluation
  (a few ms), on top of the same effect that already runs it.

Rejected alternatives, for the record: per-region scale/shear hacks (D16 proved
the difference is angular); posing the *atlas* (registered donors do not move to
meet a synthetic surface); a pose-dimension in the shape grid itself
(28 MB × pose stops — combinatorial explosion for no accuracy gain over LBS);
shipping a skinned GLB and posing in three.js (right shape for the overlay only
if the pose set ever stops being small — it now never needs to, since per-atlas
poses are gone).

## 4. The plan, phased

### Phase 0 — environment + convention check (half a day)

Recreate the venv (above). A throwaway script reproduces the tutorial's
`shoulder01.L` +30° pose and asserts only arm vertices moved — pinning direct
transforms, column vectors, Z-up model space, `world-orient` semantics, and the
Y-up↔Z-up conversion below with a known vector. Every downstream rotation
leans on these.

### Phase 1 — measure every atlas's pose (1–2 days)

New script `scripts/anny/measure_atlas_pose.mjs` (node, `@gltf-transform/core`,
same stack as `check-winding.mjs`):

- Per atlas, locate humerus, radius+ulna, femur, tibia+fibula, left and right,
  by the atlas's own naming — structure names for Z-Anatomy and HRA, FMA terms
  for BodyParts3D; principal axis per segment (PCA), oriented proximal→distal,
  expressed in the canonical frame after the atlas's registered scale/anchor.
- HRA female: first understand `hra.glb`'s stray-geometry bbox anomaly; then
  legs from her femur/tibia, arms from arm vasculature if present, else the
  declared default above.
- Composed modes inherit the pose of their `musculoskeletal` source (read from
  `composedMap()`, not hand-typed): `composed` → z-anatomy's pose,
  `composed-f` → hra's.
- Output `scripts/anny/atlas-poses.json`: per pose id, per driven segment, a
  unit vector plus its source — one of `"measured"` (with the structures
  used), `"default"`, or `"visual"` for a hand-tuned value — and a `sharedBy`
  list where measurement shows two atlases within the driving threshold.
  **Generated, never hand-edited** (D18's rule). The script also re-derives the
  W/H signature table in §1.

⚠️ **Frame trap:** axes are measured in glTF Y-up canonical space; ANNY's model
space is Z-up (`bake.py` applies `rot_x(-90°)` at export). Every measured axis
goes through the inverse rotation before becoming a `world-orient` target. This
is the silent-wrongness spot of the overlay half; Phase 0 asserts it.

### Phase 2 — bake the posed overlay variants (1 day)

Extend `bake.py` with `--pose <pose-id>` reading `atlas-poses.json`:

- Start from identity `world-orient` parameters (via
  `get_pose_parameterization` on a rest forward pass, as the tutorial does).
  For each driven segment — `upperarm01/02.{L,R}` → humerus axis,
  `lowerarm01/02.{L,R}` → forearm, `upperleg01/02.{L,R}` → femur,
  `lowerleg01/02.{L,R}` → tibia — the minimal rotation from ANNY's rest bone
  direction onto the target; drive only segments whose delta exceeds ~5°.
  Confirm labels from `model.bone_labels` at runtime; never hand-type the list.
- ⚠️ Minimal rotation leaves **roll about the limb axis unconstrained** —
  acceptable for a translucent silhouette; if hands read wrong, add a palm
  heuristic later rather than complicating the first pass.
- Everything downstream is the existing pipeline verbatim: `fix_normals()`
  (winding trap unchanged), rotate, ground feet, export, `convert:anny`
  extended over the new names.
- **Bake matrix**: `anny-adult-{f,m}.pose-<pose-id>.raw.glb` per distinct pose
  id — with the expected sharing (z-anatomy covering the regions atlas and
  `composed`; hra covering `composed-f`), roughly 4–5 distinct poses, so
  ~8–10 shipped GLBs at 106 KB each (~1 MB). **Both adult sexes are baked per
  pose** (decided at review): the deliberate sex-mismatch override D16a allows
  stays posed instead of silently dropping to the rest pose. Child,
  elder and pregnant get no posed variants — they are shape studies, and a
  posed child around adult organs is still the pairing D16a refuses.
- `anny-provenance.json` records per posed bake: pose id, driven bones with
  angular deltas, and the hash/date of `atlas-poses.json` used.

### Phase 3 — wire the app (1 day)

- `bodyEnvelopes.ts`: posed variants join the registry, every URL **written out
  literally** (`pruneUnshippedModels` regex-scans source; template literals
  already silently pruned this feature once).
- `BodyEnvelope` reads the resolved anatomy mode, maps it to its pose id (the
  composed modes via their musculoskeletal source), and loads that variant —
  falling back to the rest-pose bake when the posed GLB is absent (probed like
  every asset; "not installed", never a 404 in the Canvas). The envelope row
  stays offered on every mode it is offered on today.
- ⚠️ **This deliberately relaxes D16a's "reads no atlas state".** D16a's point
  was that the envelope must not *claim* to be the donor's body — sex, age,
  identity. Reading the mode to align *frames* makes the pairing more honest,
  not less; it is the same move as the donor-sex swap D16a itself added.
- Wording: the dock caption and the `BodyEnvelope.tsx` comments that justify
  the glass rim by the pose mismatch get updated — the rim *stays* (the surface
  is still generated, still nobody's skin), its stated reason changes.
- **Record the decision**: next free entry in `docs/DECISIONS.md` — per-atlas
  posed variants, the pose join, and the D16a relaxation, with before/after
  span numbers included.

### Phase 4 — acceptance for the overlay, measured not eyeballed (half a day)

Per (preset, pose), printed by the bake and recorded in provenance:

1. **Span delta**: envelope across-the-arms extent vs the target body's, both
   in the canonical frame — the D16 metric. Target: within a few cm, from
   today's ~0.48 m error on Z-Anatomy.
2. **Containment**: fraction of the target body's surface vertices inside the
   envelope (`trimesh.contains`; valid because `fix_normals()` leaves a closed,
   consistently wound manifold) at canonical scale including the 1.5 % pad.
   D16 measured ~5 mm of back protrusion, so the target is a high fraction with
   named worst offenders, not 100 %. Where a body has no arms (`ct-atlas-f`,
   HRA female's missing upper skeleton), the metric covers what exists.

Plus one visual pass per mode; containment does not catch "encloses but looks
wrong".

### Phase 5 — standalone pose sliders (3–5 days, the new scope)

The parametric mode keeps its shape sliders and gains a **position group**:

- **Bake side** (`bake_grid.py` extension): weights + hierarchy + per-grid-point
  joint rests as in §3B. Weights come from the model's own skinning machinery,
  exported for the driven subset of bones only.
- **Runtime** (`annyGrid.ts` + `ParametricBody.tsx`): FK + LBS in JS on slider
  change, as in §3B. The existing "evaluate on change, never per frame" rule
  and the rethrow-on-load-failure rule both carry over; the three grid files
  become four-or-five, all probed (a partial set fails confusingly — the
  existing lesson).
- **Slider set, decided at review**: arms (shoulder abduction, elbow flexion)
  and legs (hip stance, knee flexion) — sides linked, ranges limited to where
  LBS stays clean (candy-wrapper artefacts appear at extreme angles; a range
  cap is honest, a broken shoulder is not). Head and spine were offered and
  **declined** for the first cut.
- **Rendering, decided at review**: the standalone body gains the glass-hull
  treatment as a toggle, opaque remaining the default, reusing the envelope
  material path and honouring the existing hull controls.
- ⚠️ **`measureBody` runs on the REST-POSE vertices, never the posed ones.**
  Height, span and volume are stature-and-shape claims; the height of a body
  with bent knees is not a stature, and LBS blending perturbs volume. Measure
  before skinning, display the posed shape.
- ⚠️ Grounding: re-ground on the *posed* min-y so feet stay on the floor, but
  compute it from the leg-driven pose only — an arm-raise must not bob the body.
- `ParametricPanel`'s existing honesty text extends: position sliders are
  artist-rig articulation, not range-of-motion or ergonomic data.

### Deferred, priced

- **Shape matching beyond pose** (fit phenotype axes to a donor): upstream
  `src/anny/examples/mesh_to_params.py` is the template. Roadmap Phase 7
  territory; not smuggled in here.
- Skinned-GLB overlay, per-single-atlas poses, spine/head/hand articulation:
  none currently justified.

## 5. Traps checklist (each already bitten once in this repo)

- Literal `/models/…` URLs in registry source, or the prune plugin ships
  nothing.
- Meshopt **reorders vertices**: weights and joint data pair only with the
  grid's own vertex order; never with any GLB's.
- `fix_normals()` before every export; keep the signed-volume sanity check.
- Provenance for every asset, or it cannot be regenerated.
- Pose specs and measurements are **generated files**; no id, count or vector
  hand-typed into prose or code (D18).
- `topology="anny"` only; smpl/smplx trigger the runtime non-commercial
  download.
- Extend the `check:winding` list in `package.json` with each new GLB.
- Zero-asset rule: the app must run, and say "not installed", with no posed
  variants and no pose-grid files present.
- A control that renders but cannot act is the repo's named failure (dead-pill
  rule): the position sliders must not appear when the pose data files are
  absent.

## 6. Decisions taken at review (18 August 2026, maintainer)

All five open questions were decided; none remain. Recorded here so
implementation cannot re-litigate them silently:

1. **HRA female arms:** try vasculature-derived axes; fall back to the declared
   arms-at-sides default. Either way the pose spec labels the source.
2. **"Just as the hull":** confirmed to include rendering — the standalone body
   gets the glass-hull treatment **as a toggle**, opaque by default.
3. **Slider set:** arms (shoulder abduction, elbow flexion) and legs (hip
   stance, knee flexion), side-linked, range-capped. Head and spine declined
   for the first cut.
4. **Bake matrix:** both adult sexes per pose (~8–10 GLBs, ~1 MB), so the
   deliberate sex-mismatch override stays posed.
5. **`hra.glb` stray geometry:** investigated **within Phase 1** — the
   measurement script's first job on HRA is identifying it, so the anomaly and
   the measurement land together and nothing is measured from polluted data.

Implementation has not started; the maintainer will say when.

*(As the plan was written. It started and shipped the same day — see the status
box at the top, which is the current record. The sentence stays as what the plan
said.)*
