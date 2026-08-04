# Report 02 — Generating anatomy from imaging: the CT-to-mesh pipeline

Dated 29 July 2026. Two atlases in this project were produced this way, and the
pipeline is the route to personalisation from a person's own imaging.

---

## Abstract

Every hand-modelled atlas comes with a donor you did not choose and cannot change.
This pipeline takes the other route: **segment a CT volume, mesh the labelmap, ship
the result as a glTF atlas**. It produced two of the seven anatomy sources here, and
it is the only mechanism in the project that could ever render *the viewer's own*
anatomy rather than a stranger's.

It works end to end. The largest build is **109 structures in one GLB with an
ontology term on every one of them** — the only atlas in this project where the
term join D11 asks for already exists.

The report records three things worth more than the output: where the time actually
goes (not where you would guess), a heuristic that deleted a bone and why it was
plausible, and a licence trap that has no technical fix.

---

## Method

```
CT volume  →  MOOSE 3.2  →  labelmap  →  vtkSurfaceNets3D  →  decimate  →  glTF
             (segmentation)             (multi-label meshing)
```

| stage | tool | licence |
|---|---|---|
| Segmentation | **MOOSE 3.2** (ENHANCE-PET), ~120 classes | Apache-2.0 code, **CC BY 4.0 weights** |
| Meshing | **VTK** `vtkSurfaceNets3D` | BSD-3-Clause |
| Compression | glTF-Transform + meshoptimizer | MIT |

`vtkSurfaceNets3D` is the load-bearing choice. It meshes **all labels in one pass
with shared boundaries**, so adjacent organs meet exactly instead of interpenetrating
or leaving a gap — which is what marching cubes per label gives you, and what then
has to be repaired by hand.

The transform chain is `scaled-index → RAS mm → glTF metres`, applied so that
asymmetric structures land on the correct anatomical side. That is verified rather
than assumed: getting it wrong mirrors the body, and a mirrored liver is not
obviously wrong until someone notices the heart too.

---

## Findings

### 1. The cost is entirely in segmentation, and decimation is second

Timed on a 75 M-voxel whole-body CT (512 × 512 × 287, 3 mm slices):

| stage | time |
|---|---|
| Segmentation, `clin_ct_organs`, 19 labels | **~7 minutes** (weights cached) |
| **Meshing — all 19 labels, one pass** | **0.37 s** → 684,978 triangles |
| Decimation (3 budget passes with a back-off ladder) | tens of seconds |

**Segmentation is roughly 1,000× the cost of meshing; decimation is about 50×.**
This is worth stating because it is counter-intuitive and it says where effort
belongs: if the meshing stage ever needs optimising, it is the decimation, never
`vtkSurfaceNets3D`.

Practical consequences: MOOSE needs ~4.3 GB RSS steady-state and downloads ~240 MB
of weights per model on first use, landing **inside the installed package**, so
deleting the virtualenv deletes the weights with it. All gitignored.

### 2. The largest build: 109 structures, every one with a term

| | |
|---|---|
| Structures / draw calls | **109** |
| `ontologyid` coverage | **109 / 109** |
| `label` / `system` / `layer` | 109 / 109 each |
| `side` recorded | 69 |

This makes it the **only atlas in the project carrying UBERON ids per structure**
straight out of the pipeline, because MOOSE's own class names crosswalk to UBERON
(`docs/moose-uberon-crosswalk.tsv`, 139 rows, hand-checked). Every other atlas here
is addressed by name — see Report 04 for what that costs.

### 3. A heuristic that deleted a humerus

The TCIA labelmaps contain stray voxels — small disconnected blobs of a label far
from the organ. A `--max-stray-mm` option was added to drop components whose centroid
sits further than a threshold from the main body of that label.

**It deleted an entire humerus** — 77,530 voxels at 353 mm — and an ulna, 19,908
voxels at 308 mm.

The cause: the corpus **merges left and right into one label**. A paired bone's two
halves are an arm span apart, so a 3-D centroid distance between them is enormous
and entirely normal. Distance from the midline is anatomy, not damage, and **no
threshold fixes it** — tightening it only changes which bone dies.

The rule now measures the gap along the **head-to-toe axis against the main
component's range**, with the axis read from the volume's own `axcodes`. That
separates the cases on their physics: paired bones overlap in head-to-toe position
(gap 0, kept), ribs and carpals are adjacent (small gap, kept), stray toe fragments
sit far below everything (large gap, dropped).

Two things made this recoverable, and both are process rather than code:

- **Every drop is printed.** A silent filter would have shipped a one-armed atlas.
- The bilateral label grouping was **documented three times** in the crosswalk header
  and the heuristic was still written against a plausible general principle. Writing
  a fact down does not stop it being contradicted by an assumption made later.

### 4. Fitting a posed body, and why "scale to height" was wrong

The TCIA subject is scanned with **arms raised above the head**. The default fit in
this project scales an atlas so its bounding box is 1.7 m tall — and that box
measures **toe-to-fingertip**, not stature: 1,857.9 mm against a recorded height of
1,701.8 mm, a **9.2 % overshoot** that would render every organ ~9 % small.

A crown-to-toe measurement was tried first and works: 1,708.8 mm, +0.41 % of the
record. But that measurement is also the argument against needing it — an implied
scale of **0.9951** means the geometry is already life-size, because it came from a
real scan. So the atlas is **not rescaled at all**. It declares a landmark instead:
the lowest foot bone (`UBERON:0001449`, toe phalanx) at raw y **0.5941** belongs at
world y 0. Re-verified against the shipped asset; the skull vertex then lands within
7 mm of the subject's recorded stature.

The raised arms stay above the head, where they were. Nothing is cropped, rescaled
or repositioned.

### 5. Quality gate

The 33-structure TCIA build is **33/33 watertight**, and `check:winding` passes on
both CT atlases. Watertightness matters here because these surfaces come from a
labelmap rather than from an artist: a hole is a segmentation failure, not a style.

---

## The licence trap, which has no technical fix

**The licence of a segmentation follows its SOURCE IMAGE, not the model weights.**

MOOSE's weights are CC BY 4.0, and it is tempting to read the output as CC BY 4.0
because of that. It is not. The geometry is derived from a patient's scan, and
whatever terms attach to that scan attach to the mesh.

This project has one asset on the wrong side of that line. **`ct-atlas-f` was built
from a CT whose provenance was never recorded** — the GLB notes its generator and no
source, and no report of the run survives. The result:

- It renders and is registered, because an asset on disk needs an entry either way.
- Its licence is **unresolved**, its donor fields say *unidentified* rather than
  guessing, and it **must not be published** until the scan is named.
- There is no third party to ask. It is a record that was never kept.

The second CT atlas shows the contrast. `htb-ct-f` came from **TCIA
Healthy-Total-Body-CTs subject 003**, and everything about it is stated: F, 26,
1.7018 m, BMI 20.4, from the collection's own CC BY 4.0 clinical spreadsheet. The
segmentations and demographics are CC BY 4.0; only the images sit behind the NIH
Controlled Data Access Policy, which does not matter because the images are not
needed to build the atlas.

**Two clauses to carry forward:**

1. **Record the source scan at build time, in the asset.** Not in a note, not in a
   commit message — in the GLB, where `check:licences` will read it back.
2. **If the pipeline is re-run with TotalSegmentator's gated subtasks**
   (`tissue_types`, `appendicular_bones`, `face`), the output becomes
   non-commercial, because those academic weights are — and it then needs its own
   register entry rather than inheriting the existing one.

---

## Limitations

1. **Low-dose non-contrast CT means bone is trustworthy and soft tissue is not.**
   D10's contrast objection applies directly to the organ masks in `htb-ct-f`. Use
   it for skeleton and gross form; do not read fine visceral boundaries from it.
2. **Labels are grouped and cannot be ungrouped.** One `Ribcage` rather than 24
   ribs, one `Spine` rather than 24 vertebrae, every long bone merging left and
   right. Because the source images are access-controlled, it **cannot be
   re-segmented finer** by us.
3. **No ambient occlusion on either CT atlas.** They come out of the Python pipeline,
   which has no AO stage, so they render flatter than the atlases beside them. This
   is an unclaimed gap rather than a decision.
4. **Not validated against ground truth.** Watertightness and correct sidedness are
   checked; anatomical accuracy of the segmentation is MOOSE's, and inherits its
   error characteristics.
5. **Do not build on the deployment server.** Measured: `gltf-transform optimize`
   peaks at 1–2 GB for a 400–550 MB source and two concurrent runs died silently on
   4 GB; the AO bake used 99.3 % of a single core for two hours. Rescale by the hour
   instead of holding capacity that is idle.

---

## Reproducing this

Full steps, including the virtualenv and the weights, are in
[`../CT_ATLAS_PIPELINE.md`](../CT_ATLAS_PIPELINE.md). The TCIA build:

```bash
python scripts/ct-atlas/labelmap2glb.py --labels docs/healthy-total-body-cts-labels.tsv ...
npm run check:winding && npm run check:licences
```

## References

- **MOOSE** (ENHANCE-PET) — <https://github.com/ENHANCE-PET/MOOSE>
- **TotalSegmentator** — <https://github.com/wasserth/TotalSegmentator>
- **VTK** `vtkSurfaceNets3D` — <https://vtk.org/>
- **Healthy-Total-Body-CTs**, TCIA, CC BY 4.0 —
  <https://doi.org/10.7937/NC7Z-4F76>
- `docs/moose-uberon-crosswalk.tsv`, `docs/healthy-total-body-cts-crosswalk.tsv`
- `docs/DECISIONS.md` — D5, D7b, D10
