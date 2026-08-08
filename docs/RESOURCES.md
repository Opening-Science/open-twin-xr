# Resources

Everything this project uses or has evaluated, with its licence and its current
standing. One table to check before adding a dependency or an asset, so the
licence question is answered once rather than re-litigated per session.

**This file is canonical for anything it covers.** Three companions cover what it
does not, added 28 July 2026:

| | |
|---|---|
| `docs/GEOMETRY_SOURCES_SURVEY.md` | An external survey of the wider open-geometry landscape, incorporated verbatim, with a reconciliation section recording which of its VERIFY flags this repo has already resolved and where it is wrong. |
| `docs/SIMULATION_SOURCES.md` | Sources for a body that *does* something rather than one that merely is: drug biodistribution, a beating heart, and musculoskeletal force simulation. |
| `docs/INTEGRATION_CANDIDATES.md` | The shortlist — what is cheap and unblocked right now, ranked. Start here if you are looking for the next thing to do. |

**Legend.** ✅ in use · 🔍 evaluated, not adopted · ⛔ rejected, with the reason ·
⚠️ needs verification before anyone relies on it.

Licence tiers follow **D7** in `docs/DECISIONS.md`: the project is bound to
openness, not to commercial viability. Per [opendefinition.org](https://opendefinition.org/licenses/),
**CC BY-SA is conformant and recommended; CC BY-NC and CC BY-NC-SA are not.**
So share-alike is free to us and non-commercial is the thing to police — the
opposite of the usual instinct.

---

## Anatomy atlases

| | Source | Licence | Standing |
|---|---|---|---|
| ✅ | **BodyParts3D** (DBCLS) — the shipping atlas | **CC BY 4.0** per NBDC, updated 2025-02-27 ⚠️ | 2,235 meshes, FMA-indexed. Derived from **TARO**, an adult Japanese **male** voxel phantom, whole-body MRI at **2 mm**. Only permissive source for skeletal muscle (411 meshes) and the diaphragm. ⚠️ lifesciencedb.jp and the GitHub mirror still say CC BY-SA 2.1 JP, and the `.obj` headers still carry the 2013 notice — see **D2**. |
| 🔍 | **HuBMAP HRA** — installed, not default | CC BY 4.0 | Visible Human **Female**, hand-modelled in Maya from **0.33 mm** cryosections; brain from the Allen Human Reference Atlas. **No skeleton above the pelvis** — verified: no ribs, skull, clavicle, scapula, humerus. The male model is *worse*: it also lacks sternum and manubrium (**D7b**). |
| ✅ | **Z-Anatomy** — shipping, supplies musculoskeletal | CC BY-SA 4.0 aggregate | BodyParts3D retopologised by medical illustrators — it fixes the holes and non-manifold geometry we would otherwise pay to redo. **28 July: extended from 3 system files to 7** (nervous, cardiovascular, lymphoid, viscera). **3,617 structures**, 9.1M raw triangles. It is an AGGREGATE: 3,602 structures are the authors' CC BY-SA work; 15 come from three third-party components (Dundee inner ear CC BY-NC-SA, lissiecowley kidney CC BY-NC, UW white matter **no licence stated**). All imported and all credited per **D12b** — see `docs/LICENCE_LOG.md`. |
| 🔍 | **SPL / Open Anatomy** (Brigham & Women's) | 3D Slicer Licence §B — BSD-like, commercial OK, **sublicensable** | Broader than CC BY 4.0. SPL Abdomen ships **94 named `.vtk` meshes** incl. muscle and skeleton. But **abdomen-only and single-sex** (the one atlas stating a donor says "42 year old male") — a regional supplement, not a whole-body source (**D7b**). |
| ✅ | **Visible Human Project** (US NLM) | **Public domain** — no licence required since 2019 ⚠️ NLM Terms, *not* a CC licence | Female: 5,189 cryosections at **0.33 mm, 24-bit colour**. The basis for **D4**: photographs of real tissue from *the same donor HRA was modelled from*, so geometry and colour are already registered. Use the **male** set per D1. |
| ⛔ | **Zygote** | Proprietary; five figures | The quality benchmark — 9.9M polys, quads, UVs, 2048² maps. Terms forbid redistributing the content or 3D derivatives, so it cannot ship in a public repo under any tier. |
| ⛔ | **MedShapeNet** | CC BY-**NC-ND** | 100k+ ready meshes, unusable: ND forbids sharing adaptations at all. Its own per-source licence table has verifiable errors and leaves 10 of 35 sources blank. |

## Segmentation — the CT-derived atlas track

| | Tool | Code / weights | Standing |
|---|---|---|---|
| ✅ | **MOOSE 3.2** (ENHANCE-PET) | Apache-2.0 / **CC BY 4.0 weights** | **The decided tool** (D5). ~120 classes: organs, ribs (27), vertebrae (28), peripheral bones (31), cardiac chambers, muscles. Gives free what TotalSegmentator gates. CT only. |
| 🔍 | **TotalSegmentator** | Apache-2.0 / mixed | `total` (117 CT) and `total_mr` (50 MR) are Apache-2.0. **Gated**: `tissue_types` (fat/muscle), `heartchambers_highres`, `appendicular_bones`, **`face`** (the defacing mask). Free for non-commercial, which under D7 we are. `brain_aneurysm` is CC BY-NC with **no commercial option**. Its `total_mr` is the MR answer (**D7a**). |
| ⚠️ | **MRSegmentator** | Apache-2.0 code / **base weights unlicensed** | 40 classes in MR *and* CT. Body-composition weights are explicitly CC BY 4.0 ([Zenodo 21211879](https://zenodo.org/records/21211879)); the **base weights carry no licence statement at all**, which is a bundling problem regardless of commercial intent. |
| ⛔ | **FALCON** (MOOSE sibling) | GPL-3.0 | Separate binary fine, linking not. |
| ⛔ | **TotalRegistrator** | CC BY-NC-**ND** | Unusable. |

## Mesh pipeline

| | Tool | Licence | Use |
|---|---|---|---|
| ✅ | **VTK / `vtkSurfaceNets3D`** (≥9.3) | BSD-3 | The meshing filter. Only one that does multi-label in one pass with **shared boundaries**, so adjacent organs cannot gap or interpenetrate. ~0.1 s for 105 objects. |
| ✅ | **glTF-Transform** 4.4.2 | MIT | Already in the build. ⚠️ `optimize` defaults to `--join --flatten --simplify` and would destroy the ontology join — always `--join false --instance false`. |
| ✅ | **meshoptimizer** | MIT | `EXT_meshopt_compression` + `KHR_mesh_quantization`. Decoder is **29 KB vs Draco's 251 KB** and 28–61× faster. |
| ✅ | **three-mesh-bvh** 0.7.8 | MIT | Powers `scripts/bake-ao.mjs` and drei's `<Bvh>`. |
| 🔍 | **xatlas** (via `gltf-transform unwrap`) | MIT | UV unwrapping. Not needed yet — the AO bake goes to vertices, not a texture. |
| ⛔ | **PyMeshLab** / **MeshFix** | GPL-3.0 / GPL + **non-commercial field-of-use** | MeshFix restricts *use*, so the "GPL CLI in a build step" reasoning does not rescue it. Not needed — VTK and trimesh cover it. |

## Rendering

| | Package | Version | Note |
|---|---|---|---|
| ✅ | **three.js** | 0.169.0 | **r185 is current** — 16 behind. r3f v8 and drei v9 both accept it on React 18; the bump is available without a React 19 migration. |
| ✅ | **@react-three/fiber** | 8.18.0 | v9 needs React 19, which is what gates WebGPU. |
| ✅ | **@react-three/drei** | 9.122.0 | `Environment`, `Bvh`, `ContactShadows`, `useGLTF`. |
| ✅ | **@react-three/xr** | 6.6.30 | The only pmndrs package still supporting r3f v8. |
| ✅ | **`RoomEnvironment`** (three examples) | MIT | The IBL source. Procedural, zero bytes, no dependency — deliberately chosen over an HDRI file after `npm i` re-resolved every caret range and broke the app. |
| ⛔ | **@pmndrs/assets** | CC0 | 144 KB studio HDRI as a data URI. Reverted: adding any dependency re-resolves the whole pmndrs stack. |
| ⛔ | **postprocessing / @react-three/postprocessing** | MIT | **Does not work in a WebXR session** — pmndrs/postprocessing#677 open since Jan 2025, pmndrs/xr#128 renders nothing in VR. SSAO also computes per eye, giving binocular rivalry. This is why AO is baked into vertices. |
| ⛔ | **Gaussian splatting** (Spark, mkkellogg) | MIT | No per-organ picking, no per-organ recolour, and lighting is baked into per-Gaussian SH — score-driven recolouring is impossible, which is the product's premise. |

## Body models and exterior→interior

| | Model | Licence | Standing |
|---|---|---|---|
| 🔍 | **MakeHuman / MPFB2** | **CC0 for assets, incl. targets** | The only parametric body shippable under any criterion. The "official unmodified build only" caveat is obsolete — the current licence covers scripted output. |
| 🔍 | **SMPL / SMPL-X / STAR / SUPR** | Non-commercial | **Tier 2 under D7**: usable as a research tool, but most forbid redistribution outright, so SMPL-derived geometry cannot ship. |
| 🔍 | **OSSO / SKEL / HIT** | Non-commercial (MPG + INRIA) | Skeleton and internal tissue from the body surface. HIT is the closest published work to our ambition — and lumps *every organ* into one "lean tissue" class, with volume predictions "on par with the Chance baseline". |
| ⛔ | **TailorMe** | CC BY-NC-SA | Non-commercial *and* share-alike; also trained against a commissioned artist template rather than real anatomy. |
| ⛔ | **XCAT / ICRP / IT'IS ViP** | Unpublished terms, quote-only | Genuinely habitus-parameterised organ meshes. None publish a licence or a price. |

## Datasets

| | Dataset | Licence | Note |
|---|---|---|---|
| ✅ | **TotalSegmentator CT** ([Zenodo 10047292](https://zenodo.org/records/10047292)) | **CC BY 4.0** | 1,228 CT, 117 structures, ~24 GB. The route to dual-sex geometry: CT cohorts contain both sexes, so sex becomes a build parameter (**D7b**). |
| ⛔ | **TotalSegmentator MRI** ([11367005](https://zenodo.org/records/11367005)) | CC BY-**NC-SA 2.0** | Not the same licence as the CT set. Assuming it is, is a trap. |
| 🔍 | **AMOS22** | **CC BY 4.0** (verified both Zenodo records) | 500 CT + 100 MRI, 15 organs. An earlier note calling it NC-SA was wrong — that is CHAOS. |
| 🔍 | **TCIA Healthy-Total-Body-CTs / SAROS** | **CC BY 4.0** segmentations | TCIA licenses **per row**: images can be gated while the masks are openly downloadable. Mesh straight from the masks. |
| ⛔ | **CHAOS**, **AbdomenAtlas**, **3D-IRCADb** | NC-SA / NC-SA / NC-**ND** | IRCADb ships ready meshes and forbids sharing adaptations. |
| ⛔ | **UK Biobank**, **NAKO** | Contract, not licence | MTA forbids sublicensing and redistribution; derived results return to the holder. No copyright analysis rescues a signed agreement. |

## Upstream

| | | |
|---|---|---|
| ✅ | **`etzm/open-twin`** — [github](https://github.com/etzm/open-twin), local at `~/OpenTwin_Private` | Emits **FHIR R4 Bundles of raw Observations and no scores**. Four connectors: Oura, Google Health, open-wearables, VITRONIC. Per **D8** all scoring and terminology mapping belongs there, not here. |
| ⚠️ | `@open-twin/fhir-core` `referenceRange.ts` | The honest basis for any future scoring: typed intervals with a **mandatory source URL and publisher**. ⚠️ **No connector attaches one** — zero call sites across all four providers. |

## Key sources worth keeping

- three.js `ShaderChunk/lights_fragment_maps.glsl.js` — the `USE_ENVMAP` guard that made indirect specular exactly zero
- **BOSS** — Shetty et al., *Comput Biol Med* 165:107383 (2023), [arXiv:2303.04923](https://arxiv.org/abs/2303.04923), PMID 37657357. **8.11 mm** from height/weight/sex vs **8.68 mm** from a full 3D body scan — three numbers beat the whole skin surface. ⚠️ Those are **whole-model, vertex-weighted** figures and bone is 63 % of the vertices; **organs alone from the skin surface are ~15–25 mm**. This line used to say "organ error" and was wrong. **Cite it, never include it** — nothing was released, and its own licence position (SMPL + BodyParts3D) was unsatisfiable. Full assessment in `docs/research/ORGAN_SHAPE_MODELS.md` §4c
- **Articulated digital twins from one full-body CT** — Zhang, Zhao & Unberath (JHU), [arXiv:2607.02156](https://arxiv.org/abs/2607.02156), July 2026, CC BY 4.0. BOSS's successor, and the architecture to copy: fit a body model as a **kinematic scaffold only**, bind the patient's own segmented anatomy to it, re-pose. Never predicts interior from exterior. ⚠️ n = 3, no code. `ORGAN_SHAPE_MODELS.md` §5a
- **SOMA-X** — NVIDIA, [arXiv:2603.16858](https://arxiv.org/abs/2603.16858), **Apache-2.0**. Unifies **ANNY** (already shipped) with MHR and SMPL under one canonical rig, plus pose correctives ANNY lacks. Surface only. ⚠️ SMPL needs an explicit `model_path`, so it cannot be tripped by accident the way ANNY's `topology="smpl"` can
- **MHR** — Meta, **Apache-2.0**. The other permissive parametric human; SOMA-X's default identity model. A skeletal rig, not bone geometry
- **HIT** — Keller et al., CVPR 2024. Read the limitations section. Its *code* licence permits redistribution with notice; the weights and dataset do not, and it needs SMPL
- **Klarqvist et al.**, *npj Digital Medicine* 2022, n=40,032 — VAT from a silhouette at **R² 0.885**
- **Comaniciu et al.**, *Med Image Analysis* 33 (2016) — Siemens Cinematic Rendering
- **Learn2Reg** ([arXiv 2112.04489](https://arxiv.org/abs/2112.04489)) — best inter-patient abdominal CT registration is **Dice 0.69**. Plan around it.
- **Albrecht et al.**, *Med Image Analysis* 17(8) 2013 — posterior shape models
- [opendefinition.org/licenses](https://opendefinition.org/licenses/) — the tier boundary D7 rests on

## Assets on disk, not in git

`public/models/*.glb` is gitignored — the raw HRA models are 240–400 MB. Rebuild
per `docs/MODEL_PIPELINE.md`.

**The app loads the `.ao.glb` build of each atlas**, never the `.opt.glb` — the
difference is per-vertex ambient occlusion in `COLOR_0`, and `AtlasBody` switches
`vertexColors` on according to whether that attribute is present. The `.opt.glb`
and `.stripped.glb` files are pipeline intermediates, kept only because
regenerating them is expensive.

Run `npm run check:licences` for the live version of this table, including the
licence tier each installed asset carries. Sizes below measured 28 July 2026.

| File | Size | |
|---|---|---|
| `bodyparts3d.ao.glb` | 10.8 MB | **Loaded.** The default atlas (`store.ts` opens on `bodyparts3d`). 11 meshes, 2.61M tris. |
| `z-anatomy.ao.glb` | 6.5 MB | **Loaded.** Supplies musculoskeletal in `composed` mode. Skeletal + muscular + joints only. |
| `hra.ao.glb` | 9.7 MB | **Loaded.** Female, joined by organ group. |
| `hra-m.ao.glb` | 8.5 MB | **Loaded.** Male. Built — the D1 download is done. |
| `ct-atlas-f.glb` | 12.6 MB | Built by the MOOSE pipeline (`docs/CT_ATLAS_PIPELINE.md`) but **not registered in `anatomySources.ts`, so nothing loads it.** |
| `bodyparts3d.opt.glb` / `z-anatomy.opt.glb` | 8.1 / 5.1 MB | Intermediates, pre-AO. |
| `hra.opt.glb` / `hra-m.opt.glb` | 7.9 / 7.0 MB | Intermediates, pre-AO. |
| `hra.glb` / `hra.stripped.glb` | 374 / 399 MB | Female raw and intermediate. |
| `hra-m.glb` / `hra-m.stripped.glb` | 241 / 259 MB | Male raw and intermediate. |
| `z-anatomy.glb` | 259 MB | Raw assembly from the FBX, pre-compression. |

## Competitive landscape — surveyed 28 July 2026

Verified against GitHub's API and live fetches rather than search results. Two
findings changed how this project should describe itself.

**There is no maintained, licensed, open-source whole-body anatomy atlas with a
real WebXR session.** `webxr anatomy` returns six repos, every one at zero stars;
`topic:webxr topic:medical` returns none. The only serious WebXR medical code is
**vtk.js** (Kitware, BSD-3), a rendering toolkit with no anatomy — and Kitware's
own viewer on top of it, VolView, deliberately stubs XR out (`webvr-empty.js` is
an empty function). Projects advertising "VR" in this space usually mean **volume
rendering**: AMI.js's `vr_crop` and `vr_singlepass` are that, and AMI has been
dead since 2020.

Dead or frozen: Open Anatomy Browser (Brigham/Harvard, the canonical academic
attempt) last committed **2018**, Angular 1, no LICENSE file at all; EPFL's
Visible Human Server ran on **Java applets** and its DNS no longer resolves.
Alive: OPANEX (Ghent, Apache-2.0, quizzes and labelling), the HRA UIs, and the
DICOM viewers — OHIF, Cornerstone3D, NiiVue, dwv — none of which carry XR.

**NIH 3D is the closest technical peer and it validates the stack.** NIAID's
<https://3d.nih.gov> is Next.js + **three.js + react-three-fiber + WebXR**
(`immersive-vr` and `immersive-ar`, shipped v2.0.0 December 2025, labelled Beta)
with Draco/KTX2 glTF — the same architecture as `src/scene/`. A US federal agency
ships this. What it is not is a body viewer: it is a per-entry previewer over a
repository, with no assembled body, no per-system composition and no cross-atlas
assembly. It also hosts an 84-model HRA collection with DOIs — **but strips the
ontology IDs** (`ontologies: []`), so `apps.humanatlas.io/hra-api/v1/reference-organs`
stays the canonical source for the structure join. Its 694 anatomy models span
**15 licences including NC and ND**, so it is not a bulk-usable pool.

### Where our donors actually come from

HRA's reference organs are derived from the **NLM Visible Human Project** — the
male released 1994, the female 1995, one cadaver each. `anatomySources.ts`
already names them and `AttributionBar` already renders it, which is the right
call: that lineage, and the contested acquisition history around it, is the
ethically loaded part of this project's provenance and should not sit behind an
acronym.

VHP's own terms changed and few noticed: **as of July 2019 no licence is required**
and NLM describes it as a public-domain library. Attribution is requested
("Courtesy of the U.S. National Library of Medicine"), commercial use is not
prohibited, and there is no share-alike — compatible with MIT code plus
attributed assets. NLM ships **no labels or segmentation whatsoever**; every
labelled derivative is third-party, and the only free, open, ontology-bound one
is HRA. The commercial alternative, VH Dissector, is >2,000 structures at
$249 for four years.

### What this project holds that the survey did not find elsewhere

1. A genuine WebXR session on an assembled whole body.
2. **Ontology IDs.** Every small viewer surveyed keys structures on mesh names or
   vendor codes — `jixiangying/anatomy` uses BodyParts3D `FJ####` — which break
   on a model swap. This is the durable moat.
3. Both sexes. BodyParts3D is male-only; Z-Anatomy's flagship is a male model.
4. Provenance stated correctly, including where upstreams contradict themselves.

Worth stealing: global cross-system search and click-to-highlight-with-auto-fade
(`jixiangying/anatomy`, the most complete of the small viewers), quizzes and
labelled-model exchange (OPANEX), shared collaborative views (OABrowser had them
and removed them in its final commit).

### AnatomyTOOL / Open3Dmodel — the most valuable lead in the survey

**Verified 28 July 2026** by fetching <https://anatomytool.org/open3dmodel-about>
and reading it directly. Quotations below are from that page.

A group of anatomists "spearheaded by the department of anatomy and embryology of
**Leiden University Medical Center**", funded by the **Dutch Ministry of
Education, Culture and Science**, started the *Open 3D Anatomical Model for
Education* project in 2022. They "built on the Z-anatomy model" and:

1. **"We remeshed ('retopologized') ALL structures"** — to remove "artificial
   'hooked' surface artefacts", explicitly described as showing up "due to the
   lighting and shadows".
2. **"We reviewed each structure for anatomical correctness and remodelled most
   structures"**, each "reviewed by one to three anatomists with expertise in the
   specific topic". The page's own estimate for how many were remodelled runs to
   roughly 70 %.

Licence: **CC BY-SA** for the models, **GPL-3.0** for their Babylon.js viewer.
Shipping steadily — skeleton including skull (July 2025), limbs (July 2025),
pelvis and perineum (Dec 2025), inguinal canal (Jan 2026), thoracic, abdominal
and back muscles (March 2026).

**Why this outranks every feature idea in this document.** Our musculoskeletal
geometry is Z-Anatomy, taken precisely because it is BodyParts3D retopologised by
illustrators (D11). This is that same asset, remeshed in full and anatomically
reviewed by university anatomists, under a licence D7 already accepts — and our
importer is already written against Z-Anatomy's structure.

The artefact they set out to remove is the one this renderer is worst placed to
hide. `BodyScene` lights the body with image-based lighting and the materials
carry clearcoat, so "hooked" surfaces that lighting accentuates would read *more*
strongly here than in the flat-shaded viewer they were comparing against.

### Both gating questions resolved, 28 July 2026

**1. The GLBs are downloadable, and derivative use is explicitly invited.** From
<https://anatomytool.org/open3dmodel-create>: *"Below are the source files of the
Open3DModel. You can download these to create and host your own derivative
models."* Each model ships three zips — `.blend` with textures, `.obj` without,
and `.glb` with textures. All verified HTTP 200:

```
https://caskanatomy.info/open3dmodelfiles/<model>/<model>-glb.zip
  overview-skeleton        3.1 MB      upper-limb    6.2 MB
  overview-colored-skull   1.0 MB      hand          2.9 MB
  vertebrae                0.2 MB      lower-limb    5.5 MB
  exploded-view-skull, colored-skull-base also present
```

**2. The NC question is moot for this set, because there are no viscera in it.**
Everything offered is musculoskeletal — skeleton, vertebrae, skull, upper limb,
hand, lower limb. Z-Anatomy's NC-encumbered components are the kidney (viscera)
and the inner ear, and neither appears here, so importing this cannot reintroduce
what D11 excludes. That is the same subset `build-z-anatomy.mjs` already takes,
for the same reason.

**And it covers exactly what HRA does not.** HRA has no skull, ribs, clavicle,
scapula, humerus, radius, ulna, hands or feet — measured, and the reason the
female body renders as torso-and-legs. Open3Dmodel ships a skull, an upper limb
and a hand.

Licence CC BY-SA 4.0 on the models, GPL-3.0 on the viewer, which we would not be
taking. Attribution chains Open3Dmodel → Z-Anatomy → BodyParts3D. Their own
disclaimer is worth quoting in any credit we render: *"Despite our best efforts
to perfect anatomical accuracy, we cannot guarantee anatomical correctness."*

### The last open question, now measured — they share a world frame

**Verified 29 July 2026** by downloading `overview-skeleton-glb.zip` and
`hand-glb.zip` and reading their glTF JSON directly. The doubt above was whether
regional exports could be assembled at all, or whether the importer would have to
*place* them by hand. It does not: the answer is concatenation.

| | overview-skeleton | hand |
|---|---|---|
| bbox x | −0.336 … 0.074 | −0.336 … −0.226 |
| bbox y | 0.009 … 1.705 | 0.699 … 0.885 |
| meshes / verts | 144 / 289,673 | 223 / 312,214 |

**The hand's box sits inside the skeleton's, exactly where a hand belongs on a
standing body** — outboard on one side, at hip height. The two share a minimum x
of −0.336 to the millimetre, because the extended fingers *are* the widest point
of the whole skeleton. That is not a coincidence two independent exports could
produce; it is one coordinate system.

Three further facts, all of which cut our way:

1. **It is already in our canonical frame.** Metres, +Y up, feet at y≈0.009, and
   a stature of **1.705 m** against the 1.70 m everything else is normalised to.
   No rescaling, no re-origining.
2. **Not one node carries a TRS** — 0 of 147 and 0 of 235. Geometry is baked to
   world space, so an importer merges buffers and is done.
3. **Per-structure nodes, cleanly named** — "Atlas (C1)", "Capitate", "1st
   metacarpal bone". `_STRUCTURE` ids fall straight out of the node list, the way
   they do for Z-Anatomy.

**Two things an importer must handle, neither of them blocking.**

⚠️ **The regions overlap the overview; they do not tile it.** `overview-skeleton`
already contains 36 carpal, metacarpal and phalanx nodes, Blender-suffixed `.r`,
and the hand model covers the same anatomy at far higher density. Merging both
blindly yields two hands inside each other. The importer must **substitute** the
regional model for the overview's coarse version, or carry them as alternate
levels of detail — a choice to make deliberately, not a merge to run.

⚠️ **Density is the real cost.** One hand is 312 k vertices — *more than the
entire skeleton*. That is the remeshing quality claim being true, and it means
assembling every region at native density would dwarf the current atlases.
Budget simplification per region rather than globally.

Compression is **Draco**, where the rest of the pipeline is meshopt;
`gltf-transform` transcodes, so this is a flag, not a problem.

**Naming lineage is confirmed but does not transfer for free.** Of 381 distinct
Open3Dmodel names, 31 match our Z-Anatomy→FMA crosswalk exactly — enough to
confirm the shared ancestry, too few to inherit terms wholesale, because
Open3Dmodel re-spells laterality as a `.r`/`.l` suffix and names many structures
the crosswalk has not reached yet. A dedicated pass would do much better.

**Verdict: import it, as its own atlas rather than as a patch to Z-Anatomy.** It
is the only source that fills HRA's missing skull, hands and upper limb in a
frame we already use.
