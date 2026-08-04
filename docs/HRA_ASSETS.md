# HRA 3D assets: verified download paths and coverage

Every URL here was confirmed by HTTP request on **26 July 2026** against HRA
collection **v2.5** (released 2026-06-09). Licence is **CC BY 4.0** throughout;
see `ASSETS_LICENSE.md` for the credit line.

The full machine-checked list of all **83 per-organ assets** is
[`hra-assets.tsv`](./hra-assets.tsv) — columns `slug, version, glb_url,
crosswalk_url`. Regenerate it from HRA's own manifest (see the bottom of this
file) rather than hand-editing.

## Start here: you probably want the whole-body file, not per-organ

HRA ships one GLB containing every reference organ. It is the simplest path and
it is what `MODEL_PIPELINE.md` assumes:

| | URL | Size | Nodes |
|---|---|---|---|
| Female | `https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb` | 357 MB | 875 |
| Male | `https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.10/assets/3d-vh-m-united.glb` | 230 MB | 851 |

Master node→ontology crosswalk for all models (2,295 rows,
`node_name, OntologyID, label`):
`https://cdn.humanatlas.io/digital-objects/ref-organ/asct-b-3d-models-crosswalk/v1.10/assets/asct-b-3d-models-crosswalk.csv`

Per-organ files are only worth fetching if you want to keep the payload small by
shipping a subset. There is **no single version across the library** — each
organ is versioned independently, which is why a URL pattern with a `{version}`
placeholder is not usable by hand. Take the exact URLs from the TSV.

## Per-organ assets this project actually uses

All verified live. Each also has `crosswalk.csv` in the same `assets/` directory.

| Structure | System | Female | Male |
|---|---|---|---|
| heart | cardiovascular | `heart-female/v1.3` — 1.7 MB | `heart-male/v1.3` — 3.9 MB |
| blood vasculature | cardiovascular | `blood-vasculature-female/v1.3` — 17.0 MB | `blood-vasculature-male/v1.3` — 17.2 MB |
| lung | respiratory | `lung-female/v1.4` — 22.2 MB | `lung-male/v1.4` — 10.4 MB |
| trachea / main bronchus | respiratory | `trachea-female`, `main-bronchus-female` | `trachea-male`, `main-bronchus-male` |
| brain | nervous | `brain-female/v1.4` — 11.4 MB | `brain-male/v1.4` — 11.4 MB |
| spinal cord | nervous | `spinal-cord-female/v1.1` — 7.3 MB | `spinal-cord-male/v1.1` — 0.5 MB |
| liver | metabolic | `liver-female/v1.2` — 1.7 MB | `liver-male/v1.2` — 1.1 MB |
| pancreas | metabolic / endocrine | `pancreas-female/v1.3` — 0.7 MB | `pancreas-male/v1.3` — 2.0 MB |
| large intestine | digestive | `large-intestine-female/v1.3` — 0.4 MB | `large-intestine-male/v1.3` — 0.7 MB |
| small intestine | digestive | `small-intestine-female/v1.2` — 0.8 MB | `small-intestine-male/v1.2` — 0.6 MB |
| kidney (L/R) | renal | `kidney-female-left|right/v1.3` — 1.3 MB ea. | `kidney-male-left|right/v1.3` — 1.5 MB ea. |
| skin | integumentary | `skin-female/v1.5` — 15.3 MB | `skin-male/v1.4` — 19.0 MB |
| spleen | — | `spleen-female/v1.3` — 0.3 MB | `spleen-male/v1.3` — 0.5 MB |

Prefix each with
`https://cdn.humanatlas.io/digital-objects/ref-organ/` and append
`/assets/<file>.glb` — or just read the TSV, which has them complete.

## How the meshes actually resolve to systems (verified against the asset)

Parsed from `3d-vh-f-united.glb` and `3d-vh-m-united.glb` on 26 July 2026.

**The files are Y-up and in metres** — the female model measures 1.658 m tall in
world space — which matches the canonical frame. **But the origin sits mid-body,
0.793 m above the lowest point**, not at the feet. `AtlasBody` measures the
loaded bounding box and grounds the model automatically, so male, female and any
future atlas all land correctly without per-asset tuning.

Every mesh node's glTF `extras` carries:

| key | example | notes |
|---|---|---|
| `ontologyid` | `UBERON:0002097`, `FMA:73166` | `"-"` when the node has no term |
| `representation_of` | `http://purl.obolibrary.org/obo/UBERON_0002097` | same term as a purl |
| `label` | `skin of body` | human-readable |
| `anatomical_structure_of` | `#VHFLiver`, `#VHMHeartV1.1` | organ-group key |

**Ontology ids alone do not work, and this is the important finding.** 742 of
956 female meshes carry a term (429 UBERON, 313 FMA) — but at *structure*
granularity, not system granularity: `VH_F_nipple_L` is `UBERON:0013772`, not
`UBERON:0002097`. Mapping those up to a body system needs the UBERON part-of
closure, and HRA writes terms only onto mesh leaves, so walking ancestors finds
nothing either. Matching system-level UBERON terms directly resolved **4 of 956
meshes — 0%**. The whole body would have rendered neutral grey.

`anatomical_structure_of` is the handle that works. Mapping its 62 group keys to
systems (`src/scene/anatomy/hraGroups.ts`) resolves:

| Model | Meshes | Resolved | Systems |
|---|---|---|---|
| Female | 956 | **900 (94%)** | 9 / 9 |
| Male | 918 | **862 (94%)** | 9 / 9 |

Confirmed live in the running app: `892/948 meshes resolved (94%)` — 948 rather
than 956 because the 8 placenta meshes are excluded (below). The `[AtlasBody]`
console report prints this on every load, so a broken swap is visible rather
than silent.

**The Visible Human Female is a specific donor, and HRA models her faithfully —
including a full-term placenta**: 8 meshes, 25 cm wide, at roughly y=1.0 m. On a
generic health twin it renders as a large mass dominating the abdomen and reads
as a tumour or a bug. It is hidden by default (`HIDDEN_GROUPS` in
`hraGroups.ts`); nothing is deleted, so a pregnancy view could show it
deliberately. Note the male model has no equivalent.

**Conversion must not join meshes.** See `MODEL_PIPELINE.md` step 6:
`gltf-transform optimize` joins by default and collapsed 956 meshes to 11,
silently destroying the per-structure metadata. `--join false --instance false`
is required, and costs 66.8 MB instead of 45.9 MB.

The unresolved 6% is the same in both: 47 meshes with no group key at all, plus
lymph node and palatine tonsil — immune structures the contract has no system
for, deliberately left neutral rather than given a misleading home.

Two gotchas if you extend that table: the models disagree on compound word order
(female `LiverDucts` / `KneeLigamentsRight`, male `DuctsLiver` /
`LigamentsRightKnee`), and laterality appears in different positions, so
`normaliseGroup()` strips `Left`/`Right` wherever they occur.

## Coverage gaps — what HRA does NOT have

Verified by enumerating the 875 nodes of the whole-body GLB and the full 2,295-row
crosswalk, plus the 41 distinct organs in the manifest. These are **absences,
not oversights on our side** — plan around them.

**Musculoskeletal — the gap is the UPPER body, not the whole skeleton.** Be
precise here, because the group names understate what is inside them.

*Present, and more complete than it looks.* The group called `Knee` is not a
joint — it holds the **entire lower limb**: `Right femur` (FMA:24474) with its
condyles, patellar surface and articular cartilage, `Right tibia` (FMA:24477),
`Right fibula` (FMA:24480) and `Right patella` (FMA:24486), mirrored on the
left, plus the cruciate, collateral and patellar ligaments in a sibling group.
Together with the full vertebral column (C3–C7 as named cervicals, atlas and
axis as `vertebral bone 1/2`, T1–T12, L1–L5), the intervertebral disks, the
sacrum, coccyx and pelvis, HRA renders a convincing spine, hips and legs. That
is what you see standing in the viewport.

*Absent.* Skull, mandible, maxilla, **ribs**, clavicle, scapula, humerus,
radius, ulna, carpals, metacarpals, phalanges, tarsals, metatarsals — so no
ribcage, no skull, no arms, no hands, no feet. Skeletal muscle is near-absent:
rectus femoris, the quadriceps tendon, the extraocular/ciliary muscles and the
laryngeal muscles are the entire inventory, and **there is no diaphragm**.

So the honest summary is: HRA gives you spine, pelvis and legs; it cannot give
you the ribcage, the upper limbs, or musculature. That is still enough of a gap
to justify Z-Anatomy for `musculoskeletal` — but it is a narrower gap than "HRA
has no skeleton", and if the upper body matters less to you than the licence
does, HRA alone is more viable than it first appears.

Note the long bones are keyed by **FMA**, not UBERON — another reason
system resolution goes through the group keys rather than the terms.

**Missing viscera.** No **stomach**, no **thyroid gland**, no **adrenal gland**,
no pituitary. Note `src/scene/anatomy/layout.ts` currently maps `digestive` to a
stomach term and `endocrine` to a thyroid term for the procedural body; neither
has an HRA counterpart, so those parts will not resolve against the atlas. Both
systems are `hasData: false` today, so they render neutral either way — but the
mapping needs revisiting before either gets a connector.

**What HRA does have, and does well:** heart, blood vasculature, lung, trachea,
bronchus, brain, spinal cord, liver, pancreas, spleen, kidney, ureter, renal
pelvis, urinary bladder, large and small intestine, skin, adipose, lymph node,
thymus, larynx, mouth, eye, palatine tonsil, omentum, uterus, ovary, fallopian
tube, prostate, placenta, mammary gland, knee, pelvis. Every structure is
ontology-tagged, which is what makes the ontology-ID join in `AtlasBody` work.

## Regenerating this list

HRA's portal is a client-rendered Angular app — fetching it returns an empty
`<hra-portal>` shell. The manifest it loads is plain YAML and is the reliable
source:

```
curl -sSL -o hra-manifest.yaml \
  https://humanatlas.io/assets/content/3d-reference-library-page/data.yaml
```

It contains several HRA releases, so entries repeat: select the **highest
version per organ slug** or you will pick up stale URLs. `hra-assets.tsv` was
built that way.

Browsable digital objects: <https://purl.humanatlas.io/ref-organ>. These
content-negotiate — a bare `curl` with `Accept: */*` gets a 404, which is a
negotiation gap rather than a dead link; use a browser or send
`Accept: application/ld+json`.

The DOI printed inside HRA's own crosswalk (`10.48539/HBM626.BRWN.943`) resolves
at doi.org but its target 404s. Cite the purl instead.
