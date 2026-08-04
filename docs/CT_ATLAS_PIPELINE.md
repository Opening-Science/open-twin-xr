# CT-derived dual-sex anatomical atlas

**Status: the toolchain works end to end and is verified — a 109-structure,
441 k-triangle GLB was built from one CT with every orientation and closure check
passing (§6). But the atlas that ships cannot come from the dataset used to
develop it: those scans stop at the skull base and mid-thigh. §7 is the finding
that most affects what happens next.**

This is the pipeline D7b calls for: instead of choosing a donor model and
inheriting whatever that donor happens to be, generate the atlas from CT
segmentation so that **sex is a build parameter**. It closes three gaps at once
— the missing skeleton above the pelvis, the absence of a female
musculoskeletal donor, and the per-structure ontology identity `eebfa24` spent.

Read `docs/DECISIONS.md` D5, D7, D7a and D7b first. This document is the
implementation, not the argument for it.

---

## 1. What exists

| Path | What |
|---|---|
| `scripts/ct-atlas/requirements.txt` | Pinned Python deps. Nothing goes in `package.json`. |
| `scripts/ct-atlas/run_moose.py` | One CT → one multi-label NIfTI per MOOSE model. |
| `scripts/ct-atlas/labelmap2glb.py` | Multi-label NIfTI(s) → one GLB, one node per structure, with the `extras` AtlasBody reads. Self-verifying. |
| `scripts/ct-atlas/verify_crosswalk.py` | Checks every UBERON id against EBI OLS4 and every `system`/`layer` against the TypeScript source. |
| `docs/moose-uberon-crosswalk.tsv` | 139 rows. MOOSE class → UBERON → our `SystemId` and `AnatomyLayer`. |

Nothing under `src/` was touched.

## 2. Setup

```bash
uv venv --python 3.12 scripts/ct-atlas/.venv
VIRTUAL_ENV=$PWD/scripts/ct-atlas/.venv uv pip install -r scripts/ct-atlas/requirements.txt
```

Python 3.12 rather than the 3.13 on this machine: `moosez` declares `>=3.10`
and classifies up to 3.13, but 3.12 is where every transitive wheel
(`nnunetv2`, `dicom2nifti`, `dcm2niix`) is known good on arm64.

The venv grows to **~5 GB** once the eight whole-body CT models are cached —
torch is about 1 GB of that and MOOSE's weights are the rest. Note where the
weights land: **inside the installed package**, at
`moosez/models/nnunet_trained_models/`, roughly 240 MB compressed per model and
~500 MB unpacked. Deleting the venv deletes the weights with it. All gitignored.

## 3. Running it

```bash
# 1. segment. Downloads ~240 MB of weights per model on first use.
scripts/ct-atlas/.venv/bin/python scripts/ct-atlas/run_moose.py \
    --ct /path/to/ct.nii.gz --out work/subject-f

# 2. mesh. Pass every segmentation in ONE invocation so the triangle budget is global.
scripts/ct-atlas/.venv/bin/python scripts/ct-atlas/labelmap2glb.py \
    $(for f in work/subject-f/*_segmentation_*.nii.gz; do echo --seg $f; done) \
    --out public/models/ct-atlas-f.glb \
    --report work/subject-f/atlas-report.json

# 3. re-check the crosswalk whenever it changes
scripts/ct-atlas/.venv/bin/python scripts/ct-atlas/verify_crosswalk.py
```

`labelmap2glb.py` exits non-zero if any verification check fails, so it can gate
a build.

### The GLB does not render until it is registered

Producing the file is not the last step. `AtlasBody` only draws atlases listed in
`ANATOMY_SOURCES` (`src/scene/anatomySources.ts`), which this workstream does not
own. The entry needed is small, and looks like BodyParts3D's because the
`extras` contract is deliberately identical — the system is pre-resolved offline,
so there is no runtime guessing:

```ts
'ct-atlas-f': {
  id: 'ct-atlas-f',
  label: 'CT atlas (female)',
  url: '/models/ct-atlas-f.glb',
  licence: 'CC BY 4.0',                       // set by the SOURCE IMAGE, not the weights
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Segmented with MOOSE 3.2 (ENHANCE-PET), models CC BY 4.0. Source CT: <name the scan>.',
  shareAlike: false,
  donor: { sex: 'female', label: '<subject id>', derivedFrom: '<scan>', heightM: <h> },
  termSystem: 'UBERON',
  groupKey: (ud) => (typeof ud.system === 'string' ? ud.system : null),
  systemForGroup: (key) => (SYSTEM_IDS.has(key) ? (key as SystemId) : null),
},
```

`AnatomySourceId` is a closed union, so it needs widening too. Note the male and
female atlases are **two entries, not one with a flag** — that is the point of
D3, and `soleDonor()`/`donorsDisagree()` already do the right thing with it.

### The `if __name__ == "__main__"` guard is load-bearing

macOS spawns rather than forks. Without the guard, nnU-Net's segmentation-export
worker re-imports the calling module and re-runs inference in every child.
Measured: **peak 5.2 GB and a crash on a 2.6 MB single-slab CT**, reported as

> `RuntimeError: Segmentation export worker died. It was likely killed by your
> OS because of insufficient available CPU RAM.`

which reads like an out-of-memory problem and is not one. Same script with the
guard: 21.8 s, 1.85 GB.

## 4. Measured performance — Apple M1 Max, 64 GB, macOS 26.5.1

10 CPU cores (8 performance, 2 efficiency), 64 GB unified memory.

**MPS works.** `torch.backends.mps.is_available()` is true, and MOOSE's own
`system.get_accelerator_information()` returns `{'accelerator': 'mps'}` and
`check_device()` returns `('mps', None)`. It is **not** falling back to CPU.
torch 2.13.0.

| Scan | Voxels | Model | Wall clock | Peak RSS |
|---|---|---|---|---|
| MOOSE's own test slab (2.6 MB, 159×155×30) | 0.74 M | `clin_ct_organs` | **21.8 s** | 1.85 GB |
| ENHANCE.PET whole-body CT (71 MB, 512×512×287, 3 mm slices) | 75 M | see per-model table | | 4.3 GB RSS steady-state |

Per model on that whole-body CT, from output timestamps. First use of a model
also downloads ~240 MB of weights, which is included in the elapsed column and
called out separately because it is one-off:

| model | classes | elapsed incl. weight download | inference alone |
|---|---|---|---|
| `clin_ct_organs` | 19 | 7 min (weights cached) | ~7 min |
| `clin_ct_ribs` | 27 | 8 min | ~6 min |
| `clin_ct_vertebrae` | 28 | 9 min | ~7 min |
| `clin_ct_peripheral_bones` | 31 | 6 min | ~4 min |
| `clin_ct_cardiac` | 13 | 5 min | ~4 min |
| `clin_ct_muscles` | 10 | 6 min | ~5 min |
| **six models, wall clock** | **128** | **41 min** | |

Extrapolating the remaining two (`clin_ct_digestive`, `clin_ct_body`, both small)
puts a full eight-model subject at roughly **55 minutes** on this machine,
first-run, including every weight download. A second subject skips the downloads
and should come in around 35–40 minutes.

**Meshing is essentially free compared with segmentation**, and the split is
worth knowing because it says where to spend effort. Timed on the 75 M-voxel
whole-body `clin_ct_organs` label map:

| stage | time |
|---|---|
| load NIfTI + pad | 0.05 s |
| numpy → vtkImageData | 0.03 s |
| **`vtkSurfaceNets3D`, all 19 labels in one pass** | **0.37 s** → 684,978 triangles |
| split all 19 labels out of the shared net + transform | 0.75 s |
| decimation (3 budget passes × a back-off ladder) | tens of seconds — **the only slow part** |

So Kitware's published figure holds up: sub-second for a whole-body multi-label
volume. Segmentation is ~1,000× the cost of meshing, and decimation is ~50×.
If the meshing stage ever needs optimising, it is the decimation, never the
contouring.

**Practical planning number:** budget **~55 minutes for the first subject** and
**~40 for each one after** on this machine, for the eight whole-body CT models.
Fine for a handful of reference builds; painful for a sweep. A CUDA box will be
substantially faster — MPS is usable and genuinely engaged, but nnU-Net is not
optimised for it.

**⚠️ Two honest caveats on these numbers.** They were taken with the machine
otherwise near-idle for the first six models, but meshing jobs were run
concurrently later, so the last models' figures are softer. And **no CPU-only
baseline was measured**, so "MPS is faster than CPU here" is stated on the
strength of MPS being selected and engaged, not on a measured ratio. If that
ratio matters, run `run_moose.py --accelerator cpu` against the same scan.

## 5. The mirroring check — result

**Passed.** This is the check that had to be empirical, because a mirrored twin
is a silent, clinically meaningful bug.

The transform is `scaled-index → RAS mm → glTF m`, with
`(x, y, z)_RAS → (−x, z, y) × 0.001`. Determinant of that second step is **+1**,
so it does not mirror. But the NIfTI's own affine has its own handedness, and
**on the real data it is negative**:

```
enhance_1032_F.nii.gz   axcodes = LAS   det(affine) = −2.861
```

so the composed transform has determinant −1e-9 and `labelmap2glb.py` reverses
the winding of every triangle. That is the normal case for clinical CT, not an
edge case — do not assume the positive-determinant path is the one that runs.

Verified three independent ways, all on a real whole-body CT:

**(a) Asymmetric structures land on the correct side.** In glTF space
`x = −x_RAS`, so a structure on the subject's right has negative x:

| structure | centroid x (m) | expected side | |
|---|---|---|---|
| liver | **−0.0487** | right | ✅ |
| gallbladder | **−0.0413** | right | ✅ |
| spleen | **+0.0750** | left | ✅ |
| stomach | **+0.0509** | left | ✅ |
| heart myocardium | **+0.0601** | left — the apex | ✅ |

The midline those signs are measured against is the atlas's own bounding-box
centre, not `x = 0`. A CT's RAS origin is the scanner isocentre and the patient
is usually but not always centred in the bore, and "usually" is not something to
hang a mirror check on.

**(b) Every left/right pair is ordered correctly against MOOSE's own class
labels** — `kidney_left +0.0467 > kidney_right −0.0863`, `adrenal_gland_left
+0.0228 > right −0.0491`, `thyroid_left +0.0012 > right −0.0146`,
`heart_ventricle_left +0.0543 > heart_ventricle_right +0.0350`,
`heart_atrium_left +0.0015 > heart_atrium_right −0.0191`, all five lung lobes,
and ribs 5 left/right. Eleven checks on the organs + cardiac build; all passed.

Note the heart pair is the sharpest test in the set: **both** ventricles sit at
positive x because the whole heart lies left of the midline, so this check only
passes if the sign convention *and* the relative ordering are both right. A
mirror would put them both negative.

**(c) The up axis and the facing axis.** `y = z_RAS` (superior) and `z = y_RAS`
(anterior), so the asset faces **+Z**, which is glTF's *asset* convention. The
−Z convention people remember is the **camera's**, and `HANDOVER_SPEC` has it
backwards.

Checks (a) and (b) are both needed. (b) alone would still pass if the whole body
were mirrored *and* the left/right class labels swapped consistently; (a) is
what rules that out.

## 6. Mesh quality — measured, not asserted

### The largest build done: 109 structures, one GLB, everything green

Six MOOSE models over one female whole-body CT, meshed in a single invocation so
the triangle budget is global:

| | |
|---|---|
| structures / draw calls | **109** |
| triangles | **441,540** (from 2,824,816 raw surface-net triangles) |
| vertices | 297,917 |
| file size | **12.6 MB** uncompressed, no meshopt yet |
| systems represented | musculoskeletal 77, cardiovascular 14, metabolic 6, respiratory 6, endocrine 4, nervous 1, digestive 1 |
| layers | bone 67, organ 32, muscle 10 |
| `extras` coverage | `ontologyid` 109/109, `label` 109/109, `system` 109/109, `layer` 109/109, `side` 69 |
| structures with open edges | **0** |
| orientation checks | **17, all passed** |
| structures skipped | 0 |

Read back with the project's own `scripts/atlas-stats.mjs`, i.e. through
gltf-transform's `NodeIO` — the same loader path the app uses — so the `extras`
contract is verified against a real reader rather than against my own writer.

**That file is on disk at `public/models/ct-atlas-f.glb`** (gitignored, like
every other model). It will not render until someone adds the `ANATOMY_SOURCES`
entry above, and it is a partial body — see §7 before drawing conclusions from
how it looks.

### Per-structure numbers

From one whole-body `clin_ct_organs` run, 19 structures, 407,840 triangles after
decimation to a 380 k budget:

- **Every structure is closed.** Zero boundary edges on all 19, verified with
  `vtkFeatureEdges`. This is `vtkSurfaceNets3D` doing what it promises: one
  polygon per inter-organ interface, shared by both structures, so adjacent
  organs cannot gap or interpenetrate.
- **Mesh volume matches the voxel count to 0.1–2.5 %.** Liver 1.3609 L mesh vs
  1.3614 L label. Kidneys 0.1326/0.1265 vs 0.1333/0.1273. That agreement is the
  evidence that smoothing did not walk the surfaces off their segmentation.

Three failures were found and fixed while building this, all of which would have
shipped silently:

1. **Truncated organs are open surfaces.** Any label touching the edge of the
   volume has no far side to build a face against. `pad_background()` adds one
   background voxel on every face and corrects the affine to match. Before it,
   two lung lobes in the test slab had negative "volume" purely from being cut.
2. **`vtkPolyDataNormals` with `ConsistencyOn` reverses the winding.** Its
   consistency pass walks the surface from an arbitrary seed, and on a
   SurfaceNets mesh — which has non-manifold edges at three-label corners — that
   walk can leave the surface flipped. Measured: a lung lobe went from **+0.146 L
   before the filter to −0.315 L after**, with the extraction provably correct.
   `ConsistencyOff`, `AutoOrientNormalsOff`, and a guard that fails the build if
   adding normals changes any volume.
3. **`vtkQuadricDecimation` can open holes.** No topology guarantee. At
   reduction 0.49, two of eighteen organs came back with 2 and 4 boundary edges.
   The script now walks a ladder of reductions, caps any hole it does open with
   `vtkFillHolesFilter`, and only falls back to the undecimated mesh if every
   rung fails — reporting per structure which happened.

### The triangle budget is a target, not a guarantee — and this matters at scale

`SetTargetReduction` is a *request*. Quadric decimation stops early rather than
create non-manifold geometry, and SurfaceNets output has non-manifold edges at
every three-label corner, so the achievable reduction is bounded by the mesh, not
by the ask. **The relationship is not even monotonic:** a harder request opens
more holes, the ladder backs off further, and the result comes out *larger*.
Measured, organs + ribs, 1,082,792 raw triangles against a 380 k budget:

| requested factor | achieved |
|---|---|
| 0.351 | 520,160 |
| 0.244 | **449,200** |
| 0.196 | 494,282 |

So the script runs three passes and keeps the **best**, not the last. 449,200 for
44 structures is inside the 300–450 k target — but that is **two of eight
models**. A full eight-model atlas will not fit this budget by decimation alone;
the practical floor is roughly 40–45 % of the raw surface-net count.

**⚠️ And the aggregate number hides a worse problem: the density comes out wildly
uneven.** Because the ladder backs off *per structure*, a structure that resists
decimation keeps its triangles while one that decimates easily is stripped, and
the global factor then pushes even harder to compensate. From the organs +
cardiac build at a 200 k budget:

| structure | triangles | achieved reduction |
|---|---|---|
| lung_lower_lobe_right (0.76 L) | **72,884** | 0.242 |
| lung_middle_lobe_right | 30,502 | 0.484 |
| **liver (1.36 L)** | **4,900** | 0.967 |
| aorta | 1,948 | 0.967 |

The liver is nearly twice the volume of that lung lobe and ends up with **1/15th
the triangles**. It will read as visibly faceted next to a smooth lung. Fixing it
properly means allocating the budget by *surface area* with a per-structure
density floor rather than one global factor, and/or moving to a decimator with a
topology guarantee (`vtkDecimatePro` with `PreserveTopologyOn`) so the back-off
that causes the unevenness is never needed. **Not solved here** — it is the
first thing to fix if the output looks wrong.

## 6a. Coverage against D7b — what this actually produced

D7b's table said every donor atlas fails a requirement, and that HRA-male in
particular has **no ribs, skull, clavicle, scapula, humerus, radius, ulna, hands,
feet, sternum or manubrium**. Measured on one ENHANCE.PET female CT:

| MOOSE model | classes found | note |
|---|---|---|
| `clin_ct_cardiac` | **13 / 13** | All four heart chambers plus myocardium, aorta, IVC, pulmonary artery, both iliac arteries and veins. **These are the classes TotalSegmentator licence-gates** (`heartchambers_highres`). D5's reason for choosing MOOSE holds up in the output, not just in the README. |
| `clin_ct_vertebrae` | **27 / 28** | The complete column C1–C7, T1–T12, L1–L5, plus sacrum and both hip bones. The only absentee is `vertebra_L6`, which is the anatomical variant this crosswalk flags as having no UBERON term. |
| `clin_ct_ribs` | 25 / 27 | 24 ribs plus the **sternum** — the bone HRA-male does not have at all. Absent: the two 13th-rib variant classes. |
| `clin_ct_organs` | 19 / 19 | Including `trachea`, which the ENHANCE.PET bucket's `labels.json` omits. |
| `clin_ct_muscles` | **10 / 10** | Erector spinae (autochthon), all three glutei and iliopsoas, both sides. The `muscle` layer AtlasBody already toggles. |
| `clin_ct_peripheral_bones` | 16 / 31 | Skull, humerus, scapula, clavicle, radius, ulna, femur. **The 15 absentees are a field-of-view problem, not a model problem** — see §7. |

So the mechanism works: **skull, ribs, sternum, clavicle, scapula, humerus and
the full vertebral column all came out of a single CT**, each with its own
ontology id, from a female subject, with no donor model involved. That is D7b's
gap closed in principle. §7 is why it is not closed in practice yet.

## 7. ⚠️ The finding that changes the plan: "whole-body" PET/CT is not whole body

The pipeline was developed against **ENHANCE.PET 1.6k**, MOOSE's own reference
corpus (public S3, `s3://enhance-pet-1-6k`, no account needed). It looked ideal:
1,597 subjects, and `PT-details.xlsx` records **sex, age, height and weight**,
which is exactly what makes sex a build parameter. 583 of those subjects are
CC BY 4.0 (University Hospital Leipzig and Careggi), **397 M / 186 F**.

Then I measured the field of view of 28 of them by reading only the NIfTI header
over an HTTP range request:

| | z-extent | as % of the subject's recorded standing height |
|---|---|---|
| 28 CC BY 4.0 subjects, M and F | 744–1092 mm | **45 – 63 %** |

**Not one is head to toe.** They are oncology PET/CT — skull base to mid-thigh.

**Confirmed in the segmentation itself, which is the part that removes all doubt.**
`clin_ct_peripheral_bones` has 31 classes. On subject 1032 it found **16**:

| | |
|---|---|
| **Present** | femur, humerus, scapula, clavicle, radius, ulna, skull, and traces of carpal/fingers |
| **Absent — 15 classes** | **tibia, fibula, patella, tarsal, metatarsal, toes** (both sides), metacarpals, and most of the hand |

So the entire **lower leg, knee and foot are simply not in the scan**, and the
hands are barely there. The `skull` mask is 26,676 voxels against the ~200,000
a whole cranium would occupy at this spacing — it is the skull *base*, not the
vault. The `brain` mask is **1 mL**.

That is precisely the anatomy `clin_ct_peripheral_bones` exists for and precisely
the gap D7b wants closed. This corpus does not close it.

This also breaks AtlasBody silently rather than loudly. `AtlasBody.tsx` fits an
atlas by scaling `CANONICAL_HEIGHT_M / boundingBox.height`, so a half-height
atlas would be **stretched to 1.7 m** and look like a plausible, wrong body.

Slice thickness is a second, smaller problem: **3.0 mm** in every sampled scan,
against 0.977 mm in plane. That anisotropy is what the mesh detail is limited
by, and no amount of smoothing recovers it.

### The strongest available answer, and it is already in the project

**The Visible Human Project CT.** Verified at nlm.nih.gov: *"axial CT scans of
the entire body taken at 1 mm intervals"*, for **both** the male and the female
donor, and **no licence has been required since 2019**.

That is head-to-toe, dual-sex, 1 mm isotropic-ish, and unencumbered — every
property the ENHANCE.PET corpus lacks. It is also **the same two donors** HRA's
meshes and D4's cryosection bake use, so a VHP-CT atlas would be donor-consistent
with work already decided.

Two honest caveats, neither of which is a blocker:

- **It is cadaver CT.** MOOSE is trained on living clinical CT. Post-mortem
  attenuation, collapsed lungs, absent contrast and cadaver posture are all
  out of distribution, and segmentation quality on it is **unvalidated**. This
  needs a look at the output, not an assumption.
- **D1's provenance note travels with it.** The Visible Human Male donor was an
  executed prisoner. DECISIONS D1 records that this was considered and accepted;
  it must stay visible rather than be quietly inherited a second time.

## 8. The crosswalk

139 rows in `docs/moose-uberon-crosswalk.tsv`, covering **nine** MOOSE models —
`clin_ct_organs` (19), `clin_ct_cardiac` (13), `clin_ct_muscles` (10),
`clin_ct_vertebrae` (28), `clin_ct_ribs` (27), `clin_ct_peripheral_bones` (31),
`clin_ct_digestive` (4), `clin_ct_body` (4), `clin_ct_body_composition` (3).
**129 mapped confidently, 10 flagged.** `verify_crosswalk.py` runs four checks
and all four pass:

1. Every one of the **103 distinct UBERON CURIEs** resolves at EBI OLS4 and its
   `rdfs:label` matches the label written in the file. This is the check that
   catches a plausible-but-wrong id, which UBERON's non-contiguous numbering
   makes easy to produce.
2. Every `system` is in the `SystemId` union, parsed out of `src/data/schema.ts`
   rather than duplicated, so the crosswalk cannot drift from the contract.
3. Every `layer` is in `ANATOMY_LAYERS`, parsed out of `src/store.ts`.
4. **Both directions of the class-name join**, against each downloaded model's
   own `dataset.json`: no crosswalk row names a class MOOSE does not emit, and
   no class MOOSE emits lacks a row. Currently green for seven of the nine
   models — everything except `clin_ct_body` and `clin_ct_body_composition`,
   whose weights were not needed for this run.

No SNOMED shortcut was attempted: MOOSE ships `moosez/mappings/SNOMED.py`, but
UBERON cross-references SNOMED *entire* concepts while segmenters use SNOMED
*structure* concepts, and the join returns zero rows (already recorded in
`PHOTOREALISM_AND_PERSONALISATION.md` §5.4).

### The ten flagged rows, and what has to be decided about each

| class | why |
|---|---|
| `spleen` | Term certain, **system** is a judgement call. Lymphoid/haematological organ; our closed set has no lymphatic id. Filed under `cardiovascular`; `metabolic` is equally defensible. |
| `portal_splenic_vein` | MOOSE merges **two** vessels into one class. UBERON has no union term (portal = UBERON:0001639, splenic = UBERON:0003713). Shipping it as "hepatic portal vein" overstates what the mask contains. |
| `subcutaneous_fat` | Term exact. `integumentary` (hypodermis) vs `metabolic` (what a body-composition score would feed) is a real choice. |
| `vertebra_L6` | **No UBERON term exists.** Transitional anatomy (lumbarised S1). Rare. Not invented. |
| `rib_left_13`, `rib_right_13` | **No UBERON term.** Not standard human anatomy; the label set tolerates variants. |
| `body`, `head`, `arms`, `legs` (`clin_ct_body`) | Region **envelopes**, not structures. All four now carry region terms — `trunk`, `head`, `arm`, `leg` — deliberately *not* `UBERON:0002097` (skin of body), which would claim a tissue the mask does not delineate. Together they are the integumentary hull, and AtlasBody already has first-class handling for that: `systemId === 'integumentary'` gets `DoubleSide`, the user's `hullOpacity`, and the depth-write rule. The residual problem is that `arms` and `legs` each put **both** limbs in one label against a singular UBERON term. |

Flagged rows **still ship by default**, with a warning printed per structure —
dropping the spleen out of an anatomical atlas because its system assignment
needs a reviewer would be the wrong failure mode. `--strict` excludes them.
Rows with no CURIE at all are excluded by default (`--include-unmapped` overrides).

### Two traps in UBERON worth knowing before anyone extends this table

- **The numbering is not contiguous, and extrapolating it silently gives the
  wrong bone.** Thoracic vertebrae 1–7 are `UBERON:0004626–0004632` and 9–12
  resume at `0004633`, but **T8 is `UBERON:0011050`**. Identically, ribs 1–7 are
  `0004601–0004607`, ribs 9–12 are `0004608–0004611`, and **rib 8 is
  `UBERON:0010757`**. Gluteus maximus is `0001370` and medius is `0001371`, not
  the order anyone guesses.
- **C1 and C2 are not called cervical vertebrae.** They are `vertebral bone 1`
  and `vertebral bone 2`, with "C1 vertebra"/"atlas" only as synonyms. C3–C7 are
  `mammalian cervical vertebra 3–7`.

### Node naming

Node name is the ontology id, never a label integer — nnU-Net renumbers labels
on retraining. UBERON's laterality coverage is patchy (left/right terms exist for
kidney, adrenal and clavicle; not for femur, rib, scapula or hip bone), so paired
structures get a suffix: **`UBERON_0000981.left`**.

**The dot is deliberate.** AtlasBody's CURIE regex is
`\b(UBERON|FMA|CL|ASCTB)[:_]?(\d+)\b`, and `\b` after the digits needs a
non-word character. `UBERON_0000981_left` matches **nothing** — underscore is a
word character — so the structure would resolve to no term and render as
unassigned grey. The unambiguous CURIE also always travels in
`extras.ontologyid`, which AtlasBody reads first.

## 9. Licensing — verified from primary sources, 27 July 2026

| Artefact | Licence | Where it says so |
|---|---|---|
| MOOSE code | **Apache-2.0** | `LICENSE` at the repo root |
| MOOSE **model weights** | **CC BY 4.0** | **`MODEL_LICENSE`** at the repo root, a separate file: *"The AI models in this repository are licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0)"*, explicitly permitting adaptation *"for any purpose, even commercially"*. Also badged in `README.md`. |

So D5's licence claim **holds, and is stated in its own file** rather than
inferred from a badge. Attribution is the only condition.

**⚠️ Do not be alarmed by `"licence": "hands off!"` inside the weights.** Every
downloaded model's `dataset.json` contains that string. It is nnU-Net's default
placeholder text, present in thousands of unrelated nnU-Net datasets, and it is
not a licence statement. `MODEL_LICENSE` governs.

**⚠️ The training data is not uniformly CC BY, and D5 does not mention this.**
`DATA_CARD.md` §6 licenses the ENHANCE.PET corpus per originating site:

| Source | Licence | n |
|---|---|---|
| AutoPET Challenge | **CC BY-NC 4.0** | 1,014 |
| University Hospital Leipzig | CC BY 4.0 | 384 |
| Azienda Ospedaliero Universitaria Careggi | CC BY 4.0 | 199 |

So roughly **two-thirds of MOOSE's reference corpus is non-commercial**, and
MOOSE therefore carries the *same* unsettled "are weights a derivative of their
training data" question that D5a raises against TotalSegmentator's `total_mr`.
D5's characterisation of MOOSE as having "no open questions" is too strong.

Three things keep this from blocking us:

1. Under **D7** the governing criterion is *open*, not *commercial*. The
   maintainers have granted CC BY 4.0 on the weights in writing.
2. **D7a's reasoning applies unchanged**: running software does not make its
   output a derivative of that software, so a mesh's licence is set by the
   licence of the **input image**, not the weights. Feed it a public-domain VHP
   CT and the mesh is unencumbered regardless.
3. Which makes §7's recommendation do double duty — moving off ENHANCE.PET onto
   VHP CT removes the last NC-adjacent input from the shipped artefact's
   provenance.

**FALCON, MOOSE's sibling, is GPL-3.0.** Not used here, and must not be linked
into anything we ship. A separate binary invoked as a subprocess is fine.

## 10. What is NOT solved

Honestly, in rough order of how much it matters.

1. **No head-to-toe source scan has been run through this.** §7. Everything below
   §5 is measured on a skull-base-to-mid-thigh scan. Until a VHP CT (or an
   equivalent) goes through, "the atlas is built" is not a claim anyone can make.
2. **MOOSE on cadaver CT is unvalidated.** If VHP is the source, this is the
   first thing to look at, and it may be the thing that sinks the approach.
3. **Only one sex has been segmented end to end.** A male whole-body CT
   (`enhance_1015_M`, 81 MB) is downloaded and ready, but the male run has not
   been done. The dual-sex claim is *architecturally* demonstrated — sex is a
   `--ct` argument, the crosswalk is sex-neutral, and 397 M / 186 F CC BY 4.0
   subjects exist with sex recorded — but not yet *demonstrated by two builds*.
4. **`clin_ct_body_composition` is not in the default model list.** VAT/SAT/muscle
   are three tissue masks, not selectable structures, and D5a says they are the
   most clinically defensible signal in the whole imaging track. They probably
   belong in the *scoring* path rather than the *geometry* path. Undecided.
5. **Decimation density is uneven across structures, and it is visible.** §6:
   the liver came out at 4,900 triangles while a smaller lung lobe kept 72,884,
   because the hole-avoidance back-off works per structure and the global factor
   then over-corrects on everything that decimates cleanly. Budget by surface
   area with a density floor, or use a topology-preserving decimator. This is the
   most likely reason the first render will look wrong.
6. **Decimation can still reintroduce sub-voxel gaps between organs.** The
   surface net is shared, but each structure is decimated independently after
   splitting, so a shared boundary is no longer bit-identical afterwards. The
   error is far below one voxel and no gap has been observed, but nothing
   currently *proves* it stays that way. A joint-decimation pass would.
7. **No sex-discordant filtering exists.** MOOSE has no prostate/uterus class at
   all, so this is not currently a problem — but it is also a coverage gap
   against `reproductive`, which the crosswalk therefore cannot populate.
   `clin_ct_organs` has no reproductive structure whatsoever.
8. **Compression is not wired up.** The GLB is written uncompressed (12.6 MB for
   109 structures). `PHOTOREALISM_AND_PERSONALISATION.md` §5.3 settles the choice —
   meshopt over Draco, and `--join false --instance false` so
   `gltf-transform optimize` cannot flatten the hierarchy and destroy the
   ontology-id → node-name join. That step is a `gltf-transform` invocation and
   needs a JS dependency, which was out of scope here.
9. **No registration to the existing atlases.** D3a's objection stands: this
   produces a fourth donor in a fourth pose. Bounding-box fitting will put it
   roughly in place and will not align it. Nothing here changes that.
10. **Privacy.** Everything above ran on public research data. The moment a real
   patient CT enters this pipeline, `PHOTOREALISM_AND_PERSONALISATION.md` §5.5
   applies in full — a head CT is a reconstructible face, and the `skull` and
   `head` rows in the crosswalk are exactly the structures that must not ship.

## 11. What the project owner has to do or approve

Nothing below has been done, and none of it should be done on my say-so.

1. **Choose the source scan, and approve its download.** The recommendation is
   the **Visible Human Project CT**, both donors, from NLM. This is the decision
   everything else waits on.
   - No registration and no licence agreement since July 2019. Entry points:
     `https://datadiscovery.nlm.nih.gov/Images/Visible-Human-Project/ux2j-9i9a/about_data`,
     with mirrors at `https://data.lhncbc.nlm.nih.gov/public/Visible-Human/Male-Images/`
     and `.../Female-Images/`.
   - **⚠️ The CT-only download size is NOT measured.** NLM states the *female*
     dataset is "about 40 gigabytes", but that figure is dominated by the colour
     cryosections; the radiological subset is far smaller. Those index pages are
     rendered HTML rather than plain directory listings, so the per-folder sizes
     could not be read programmatically. **Someone has to look before anyone
     commits to a download.** Arithmetic gives an order of magnitude only:
     512×512 at 12 bit over ~1,870 one-millimetre slices for the male is on the
     order of **1 GB per donor** for the CT alone — treat that as an estimate,
     not a fact.
   - If the answer is instead "stay with ENHANCE.PET", accept that the atlas
     stops at the skull base and mid-thigh, and that the missing-skeleton gap
     D7b exists to close **stays open**.
   - Downloading a single ENHANCE.PET subject needs no approval process at all
     and is ~80 MB: `s3://enhance-pet-1-6k/imaging-data/images/CT/NNNN.nii.gz`,
     anonymous. That is what the numbers in this document were measured on.
2. **Re-confirm the VHP provenance decision explicitly** (D1's note about the
   male donor), since this would extend it from geometry to imaging.
3. **Name the reviewer for the ten flagged crosswalk rows** — in particular
   whether the spleen is `cardiovascular` or `metabolic`, and whether
   subcutaneous fat is `integumentary` or `metabolic`. These are the same class
   of clinical judgement the scoring weights need, and the same person should
   probably make both calls.
4. **Reconcile the kidney contradiction.** `src/scene/anatomy/layout.ts` says
   kidney → `endocrine`; `docs/bodyparts3d-system-map.tsv` says `metabolic`. The
   crosswalk follows the manifest because the manifest drives the shipped atlas,
   but one of the two is wrong and it is not mine to change (`src/` is another
   workstream's).
5. **Decide whether hardware is worth changing.** ~45–70 min per subject on the
   M1 Max is fine for a handful of reference builds and painful for a sweep. A
   CUDA machine or a rented GPU hour would collapse it. No account or licence
   step is needed for MOOSE itself — weights download anonymously from GitHub
   releases.
6. **Approve the attribution line** that has to ship with any CT-derived atlas.
   CC BY 4.0 on the weights is attribution-only, but it *is* a condition:
   something like *"Segmentations generated with MOOSE 3.2 (ENHANCE-PET),
   models licensed CC BY 4.0"* belongs next to the existing credits in
   `src/ui/AttributionBar.tsx`, plus the source-image credit.
7. **Nothing needs an account, a key, or a signed licence.** MOOSE's weights are
   not gated, unlike TotalSegmentator's subtasks. That was the point of D5 and it
   held up.
