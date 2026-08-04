# Open human anatomical and organ geometry: candidate sources

> ## 📥 Incorporated survey — read this box first
>
> **Provenance.** External survey compiled July 2026, incorporated into this repo
> on **28 July 2026**. The survey's own text is **verbatim and unedited**, so it
> stays diffable against a newer revision: its opening three paragraphs sit
> directly below this box, and it resumes at **"## 1. How to compare these"** and
> runs unbroken to the end. Everything under the "Reconciliation with this
> repository" heading, and this box, is repo commentary.
>
> ⚠️ **Forward reference.** The commentary below cites **D12** and **D12b**, which
> govern the licence policy it relies on. Those entries were written in a parallel
> session and are **not yet on `main`** — `docs/DECISIONS.md` here ends at D11b and
> D8. Until that branch lands, read D12/D12b as: *take everything, record
> everything; per-structure provenance is tagged inside the asset and the licence
> log is generated from the shipped GLB; nothing is import-blocked, and the
> obligation is publication due diligence.* If it never lands, D7's tier table
> governs instead and the effect is only that NC sources move from "record it" to
> "keep it out of the shipped artifact".
>
> **Where it sits.** `docs/RESOURCES.md` remains the canonical registry of what
> this project uses, evaluated or rejected, and it wins on anything it covers.
> This file is the wider landscape — the sources we had *not* looked at. What to
> actually do about them is ranked in `docs/INTEGRATION_CANDIDATES.md`; the
> simulation-flavoured sources it raises are worked out in
> `docs/SIMULATION_SOURCES.md`.
>
> **Its licence framing is superseded — see "Licence framing" below.** Section 10
> is the most useful part of the document and also the part most out of step with
> this project. It treats share-alike as the danger and non-commercial as a
> commercial inconvenience. **D7 inverts that, and D12b then moved the gate
> entirely.** Do not act on section 10 without reading §L below.
>
> **Six of its VERIFY flags are already resolved** and two of its factual claims
> are wrong, including one of its three closing open questions. See §V and §C.

A survey of open and semi-open sources of human anatomical geometry that could be folded into a comparison library. Compiled July 2026.

Scope note: this covers **geometry** (meshes, scaffolds, CAD, parametric models) and the **imaging corpora from which geometry can be derived**. It deliberately excludes purely 2D atlases and proprietary products (Zygote, Complete Anatomy, 3D Organon, BioDigital, Anatomage, GHBMC, THUMS), except where they define the commercial baseline you are comparing against.

Every licence field below is a research note, not legal advice. Anything marked **VERIFY** needs to be checked against the current distribution terms before an asset is ingested.

---

# Reconciliation with this repository

*Added 28 July 2026. Not part of the incorporated survey.*

## §L Licence framing — the survey's section 10 is inverted, then obsolete

The survey's traps are correct as statements about the licences. They are aimed
at a project that intends to commercialise, and this one does not.

**D7** (`docs/DECISIONS.md`) binds this project to openness rather than to
commercial viability. Per [opendefinition.org/licenses](https://opendefinition.org/licenses/),
CC BY-SA 4.0 is Open Definition conformant and *recommended*, while CC BY-NC and
CC BY-NC-SA are not conformant at all. So the survey's trap 1 ("ShareAlike is
contagious") describes a cost we do not pay, and its trap 5 ("Non-commercial
excludes a foundation product that might later commercialise") understates the
only licence class that was ever a real problem. Under D7 the emphasis flips:
**share-alike is free to us; non-commercial is the thing to police.**

**D12b then moved the gate from import time to publish time.** The rule now is
take everything, record everything: every atlas is imported in full, per-structure
provenance is tagged inside the asset, and `npm run check:licences` regenerates
`docs/LICENCE_LOG.md` by reading the *shipped GLB* rather than a hand-maintained
table. So the survey's traps stop being import decisions and become **publication
due-diligence items**. Re-ranked for this repo:

| Survey trap | Status here |
|---|---|
| 1 — share-alike is contagious | **Not a cost.** CC BY-SA is Tier 1. Fencing it per-asset was the old D3a reasoning; D7 retired it. |
| 2, 3 — LGPL friendly, GPL not | Holds, and matters for *code*: this repo is MIT, so GPL/LGPL model files must stay data, never linked. |
| 4 — NoDerivatives is fatal for XR | **Holds, and is the one genuinely fatal class.** ND forbids sharing adaptations at all, so an ND mesh can be evaluated privately and can never ship. Retopologise/decimate/convert-to-glTF is the whole pipeline. |
| 5 — non-commercial excludes commercialisation | **Reframed.** NC is importable and shippable here; the cost is that the bundle must then be badged *open source, non-commercial* rather than Open Definition conformant. That has to be said out loud, not implied. |
| 6 — "free of charge" is not "open" | Holds exactly. MIDA's bespoke privacy agreement grants no redistribution, which for publication is the same position as ND. |
| 7 — derived-data rules travel | Holds, and is stronger than a licence question: UK Biobank and NAKO are **signed MTAs**. D12b is a decision about our own licence policy and cannot reach someone else's contract. |
| 8 — challenge datasets are participation-scoped | Holds. Treat every challenge corpus as evaluate-only until its terms are read. |

**And one class the survey has no slot for, which is the one that actually bit
this project: an unstated licence.** Z-Anatomy ships a University of Washington
white-matter component listed with *no licence at all*, and it went into a build
marked publishable. Silence is stricter than NC — NC withholds commercial use,
silence withholds everything, and a credit line cannot manufacture permission
that was never granted. Add it to the survey's list as trap 9 and rank it above
NC. See D12 and D12b.

## §V VERIFY flags this repo has already resolved

| Survey entry | Survey says | Verified here |
|---|---|---|
| **BodyParts3D** | "CC BY-SA (Japan port) **VERIFY version**" | **CC BY 4.0.** DBCLS relicensed on **2025-02-27**, verified 27–28 July 2026 against `dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html` and the README bundled in the LATEST distribution. Four independent signals say CC BY 4.0; one stale anchor in that same README, plus all of `lifesciencedb.jp`, Wikipedia, the popular GitHub mirror and Z-Anatomy itself still cite CC BY-SA 2.1 JP. **This makes the survey's trap 1 wrong for BodyParts3D taken direct** — the share-alike in our stack comes from Z-Anatomy's own retopology, which its authors licensed CC BY-SA by choice, not from upstream. See D2. |
| **Open3DModel** (Leiden) | "CC BY-SA expected **VERIFY**" | **CC BY-SA on the models, GPL-3.0 on their Babylon.js viewer**, verified 28 July 2026 against `anatomytool.org/open3dmodel-about`. Both of our gating questions resolved the same day — see §C. |
| **OpenAnatomy / SPL** | "CC BY (per atlas) **VERIFY**" | **3D Slicer Licence §B** — BSD-like, commercial permitted, and *sublicensable*, which is broader than CC BY 4.0. SPL Abdomen ships **94 named `.vtk` meshes** including muscle and skeleton, but is **abdomen-only and single-sex** (the one atlas stating a donor says "42 year old male"). A regional supplement, not a whole-body source. See D6, D7b. |
| **Visible Human Project** | "US Government terms" | **No licence has been required since July 2019**; NLM describes it as a public-domain library. Attribution requested, not required; no share-alike; commercial use not prohibited. The catch the survey misses: **NLM ships no labels or segmentation whatsoever**, so every labelled derivative is third-party. |
| **Human Organ Atlas** | "**CC BY 4.0**" — asserted | **Confirmed verbatim, 28 July 2026:** "distributed under the permissive CC-BY-4.0 licence", with per-dataset DOIs and donor, organ and scan-condition metadata. Also **larger than the survey states — 60 donors, 94 organs, 375 datasets**, overviews at ~20 µm and zooms to 0.857 µm, and **eyes added 11 March 2026**. See §C for the shape correction. |
| **SPARC dataset 307** | "generally CC BY 4.0, **VERIFY per dataset**" | **Confirmed via the Pennsieve Discover API:** licence "Creative Commons Attribution", version 8, DOI `10.26275/bbvg-gj86`, tagged for lungs, stomach, heart, bladder, colon, spinal cord, systemic arteries and veins, muscle and bone. The survey's top recommendation checks out. |
| **OpenEar** | "**CC BY 4.0**" — asserted | **Confirmed** on Zenodo record 1473724. Practical detail the survey omits: it is **8 zips totalling 59.1 GB**, because it ships raw imaging alongside the models. Not a small download. |

**And the survey's ICRP row is now answered, from ICRP's own words.** Its
publication page states no terms for the Publication 145 phantom data, and no
secondary source states them either — but ICRP's copyright page does, verbatim:
*"ICRP retains copyrights on all its publications; even free to access publications
require permission for reuse"*, with permission judged case by case and possibly
subject to conditions. So the survey's "distributed by ICRP under its own terms
**VERIFY**" resolves to **a bespoke permission regime rather than a licence** —
free to read is not open, and the only licence ICRP and its publisher ever
registered is for text-and-data-mining, which carries no redistribution right. The
practical consequence is the same for ICRP 89, 107, 110, 128, 133 and 145: ask, and
expect conditions. See `docs/SIMULATION_SOURCES.md` §1, where this bites hardest —
the physics half of radiopharmaceutical dosimetry is open and the biokinetics half
has no open machine-readable form at all.

## §C Corrections

**1. Open question 13.1 is answered, and the answer is yes.** The survey asks
"Does anything in this list ship glTF/GLB natively other than HRA? Current answer
appears to be no". It does. Open3Dmodel ships a per-model `.glb` zip for every
model it offers — verified HTTP 200 on
`caskanatomy.info/open3dmodelfiles/<model>/<model>-glb.zip`, 0.2–6.2 MB each,
with the download page explicitly inviting derivative use: *"You can download
these to create and host your own derivative models."* NIH 3D also serves glTF
with Draco and KTX2. The survey's *conclusion* survives its wrong premise: an
ingestion pipeline is still unavoidable and still deserves to be a first-class
repo component, because what nobody ships is an **assembled, ontology-bound,
LOD'd** body. That is 13.3, and it is the right read.

**2. The Human Organ Atlas is not a route to a body.** The survey files it under
"imaging corpora for deriving your own geometry" and credits it with
future-proofing the geometry pipeline, which is fair. What the framing hides is
its shape: it is **individual excised organs from 60 different donors**, imaged ex
vivo. There is no whole body in it and never will be, so it cannot answer the
survey's own open question 13.2. What it is instead is the best substrate in
existence for *one hero organ at a detail level nothing else offers* — and it has
female donors and, since March 2026, eyes.

**3. Open question 13.2 — the female whole-body visceral atlas — is confirmed as
a genuine gap, with measurements.** The survey suspects it; this repo has counted
it. HRA is the only atlas here with a female donor and it has **no skeleton above
the pelvis** — no ribs, skull, clavicle, scapula or humerus, verified across node
names and `extras` in both sexes. HRA-male is worse, additionally lacking sternum
and manubrium. BodyParts3D and Z-Anatomy are both TARO, and male. So selecting
*female* renders a torso-and-legs body while a complete body is only available
male. That is ROADMAP Phase 6, and it is the largest open problem in the project.

**4. The BodyParts3D lineage is one asset with three levels of polish** — the
survey's own comment, and this repo agrees and has acted on it: Z-Anatomy is
adopted for musculoskeletal precisely because the retopology is the quality we
want, and Open3Dmodel is the same asset again with the remeshing done more
thoroughly and reviewed by anatomists. Where this repo goes further is the
consequence: because Z-Anatomy *is* BodyParts3D, the two share a donor, a pose
and a coordinate frame, so composing them is not registration at all. Measured
depth-to-height agreement between the two skeletons is 0.7 %. That is what makes
the one cross-atlas mix in `COMPOSED_SOURCE` safe when mixing HRA with anything
is not.

## §S Sources this repo relies on that the survey omits

Not criticism — the survey scoped itself to geometry and imaging corpora. But a
reader treating it as complete would miss the entire CT-derived track, which is
where this project's answer to sex, age and population coverage actually lies:

- **MOOSE 3.2** (Apache-2.0 code, **CC BY 4.0 weights**) — the chosen segmenter,
  ~120 classes including 27 ribs, 28 vertebrae, 31 peripheral bones and cardiac
  chambers. Gives free what TotalSegmentator gates.
- **TotalSegmentator** — `total` (117 CT) and `total_mr` (50 MR) Apache-2.0, with
  `tissue_types`, `heartchambers_highres`, `appendicular_bones` and the `face`
  defacing mask behind an academic licence.
- **MRSegmentator** — Apache-2.0 code whose **base weights carry no licence
  statement at all**: trap 9 above, in the segmentation layer.
- **TotalSegmentator CT** ([Zenodo 10047292](https://zenodo.org/records/10047292),
  CC BY 4.0, 1,228 CTs) — the actual route to dual-sex geometry, because a CT
  cohort contains both sexes and sex becomes a build parameter.
- **AMOS22** (CC BY 4.0, verified on both Zenodo records) and **TCIA SAROS /
  Healthy-Total-Body-CTs**, where TCIA licenses **per row**, so masks can be
  openly downloadable while the images stay gated.
- **MedShapeNet** — CC BY-**NC-ND**, and its own per-source licence table has
  verifiable errors with 10 of 35 sources left blank. Worth naming in a survey
  precisely because 100k+ ready meshes looks like the answer and is not.

## §G What is missing — measured against our own atlas, not guessed

The survey is organised by *source*. Read by *system*, against what this project
actually renders, the holes are larger than either document implies. Measured from
`docs/bodyparts3d-system-map.tsv`, the shipping viscera atlas maps 1,839
structures — and distributes them very unevenly:

| system | structures | | system | structures |
|---|---|---|---|---|
| cardiovascular | 754 | | metabolic | 73 |
| musculoskeletal | 563 | | endocrine | **3** |
| respiratory | 283 | | reproductive | **1** |
| nervous | 86 | | integumentary | **1** |
| digestive | 74 | | lymphatic | **not representable** |

**Three of the nine systems are effectively unrepresented** — reproductive is a
single prostate, integumentary a single structure, endocrine three. And there is
no lymphatic coverage at all, nor anywhere to put it: `SystemId` in
`src/data/schema.ts` is a closed union of nine members and lymphatic is not one of
them, so Z-Anatomy's `LymphoidOrgans100.fbx` currently has nowhere to go. That is
a contract change, not an import.

Absent from the map entirely: **tendon, sheath, meniscus, larynx, dermis,
epidermis, tooth, tympanic membrane and cochlea.** The eye is a partial exception
worth stating precisely, because it cuts against the obvious reading: HRA *does*
ship eyes — four reference organs, `eye-{female,male}-{left,right}` at v1.3,
CC BY 4.0 — so the eye is not missing from the project, only from the two atlases
that render.

Each gap was then chased to a primary source. The results split three ways.

**Solved — a source exists and is open.** The ear from **OpenEar** (CC BY 4.0, with
colour). Teeth from **Teeth3DS+**. The airway tree from **ATM'22** and
**AeroPath**. Nerve centrelines from **SPARC dataset 307** (CC BY, UBERON-annotated,
though vagus-centric — there is no human sciatic or brachial plexus scaffold).
Intervertebral discs from **SPIDER** (CC BY 4.0, and unusually **276 female / 171
male**). Larynx, glottis, arytenoid cartilage, eyeballs, optic nerve, lacrimal
gland, cochlea, mandible and spinal cord all from **CADS**, whose `open` weight
tier is **CC BY-SA 4.0 and explicitly permits redistributing derived weights**.
Vertebral and pelvic geometry as **actual triangle meshes** from the UPF
thoracolumbar repository (CC BY 4.0, 42 patient-specific STLs plus ~16,800
shape-model instances). And **cardiac muscle fibre direction fields**, which are
better served than any other fibre architecture: Roney et al.'s human atrial atlas
(CC BY 4.0) ships endocardial and epicardial surface meshes with a **measured
DT-MRI fibre vector per element**, and a 2026 four-chamber cohort (CC BY 4.0) ships
50 patient-specific meshes with fibre orientations at an **exact 25 male / 25
female split**.

**The eye deserves separate mention, because it is the one gap that can be closed
by construction rather than by sourcing.** The classical schematic optical eyes —
Gullstrand-LeGrand, Liou-Brennan, Escudero-Sanz & Navarro, Arizona, Atchison — are
**fully specified in the open literature as radii, conic constants, thicknesses and
refractive indices**, with the Arizona and Atchison models additionally publishing
accommodation formulas. Those numbers are facts rather than copyrightable
expression, so a surface-of-revolution mesh generated from them is **ours
outright, under no upstream licence at all**. `visisipy` (MIT, Leiden UMC) already
codes two of them. For the orbit around it, **TOM500 is CC0** — 500 patients, 9
segmented orbital structures including all the extraocular muscles, 333 of them
female.

**Genuine landscape negatives, checked and not merely unfound.** No open source
exists at any licence for: **fascia** (the one dedicated project has no licence and
zero downloads; no major segmenter models it), **lymphatic vessels** (nodes are
available under CC BY 3.0/4.0, vessels are not), **tendon sheaths and retinacula**,
the **temporomandibular joint disc** (checked across CBCT, MRI, FEM supplements,
shape models and 27 GitHub repos), **layered skin**, the **placenta**, and
**internally detailed hand or foot** anatomy. The **menisci** are absent even from
the Denver lower-extremity set. Skeletal-muscle and tongue fibre fields are
unfound rather than confirmed absent.

Two of these negatives are structural rather than accidental, and worth
remembering: a source built from bi-planar radiography cannot contain disc shape,
and an MRI vocal-tract corpus cannot contain sharp cartilage, whatever its licence
says.

### Brain as mesh — the survey's "mixed, several NC" resolved

Its section 6 leaves this vague, and the four candidates turn out to sit in four
different places:

- **FreeSurfer `fsaverage` is open, and the expected non-commercial clause does not
  exist.** The FreeSurfer licence grants a royalty-free, non-exclusive right to
  "use, reproduce, make derivative works of, display and distribute", with
  attribution. Commercial use is not prohibited, only unwarranted. A free
  registration is required to run the software, which is friction rather than a
  restriction on redistributing a mesh. TemplateFlow ships it as GIFTI triangle
  meshes at four densities with Desikan-Killiany, Destrieux, Yeo and Schaefer
  parcellations — although, noted for the record, `tpl-fsaverage`'s own
  `template_description.json` says `"License": "See LICENSE file"` and **there is
  no LICENSE file in that repository**. Trap 9 again, in a repo that is in
  practice fine.
- **HCP S1200 and the Glasser parcellation are DUA-gated, which is harder than
  share-alike.** Redistribution is permitted only if every downstream recipient
  independently agrees to the same terms — enforceable for a lab, not for a public
  web page. The BALSA host is login-walled and MNE-Python requires an explicit
  opt-in flag to fetch it. Do not confuse this with the `HCPpipelines` repository,
  whose `standard_mesh_atlases/` surfaces are BSD-licensed: those are registration
  templates, not subject anatomy.
- **BigBrain is CC BY-NC-SA 4.0**, confirmed from the FTP licence text and the
  EBRAINS record. The homepage's "CC BY-SA" footer refers to the website's images.
  It does ship real triangle meshes at 327,680 triangles per hemisphere. **The
  donor is a 65-year-old male**, so it does not help the female-body question.
- **MNI ICBM152 carries an X11/MIT-style permissive grant** — among the cleanest
  licences in this entire document — but it is a volume, not a mesh. **AAL** became
  GPL in April 2024. **Julich-Brain** is CC BY-NC-SA. **Allen Human Brain Atlas**
  and **FSL's Harvard-Oxford** are bespoke and non-commercial; note that FSL's
  licence is materially stricter than FreeSurfer's, so "the big neuroimaging suites"
  is not one licensing regime.

No CC0 brain surface mesh was found.

## §X What the survey gets right that is worth repeating

Its section 1 warning — that XR readiness "is the one axis that quietly kills
projects", because the scientifically excellent sources ship 10⁵–10⁷ triangle
meshes with no LODs, no UVs and inconsistent coordinate conventions — is the
correct diagnosis, and this repo has a measured answer to it rather than an
opinion. Z-Anatomy's 2,077 structures merge to **3 draw calls** for the Quest
budget; identity comes back as a per-vertex `uint16` `_STRUCTURE` attribute
costing 1.53 MB, with hover resolved in constant time off `faceIndex`. Merging
then simplifying is safe *because* the attribute exists: `weld` hashes every
attribute, so two coincident vertices in different structures never merge, which
leaves structures topologically disconnected and means no edge collapse can cross
a boundary or blend an id. See ROADMAP Phase 1.

Its section 11 manifest proposal is also right in spirit, and the honest note is
that this repo now has **three** overlapping registries — `anatomySources.ts` for
shipped sources, `docs/RESOURCES.md` for evaluated ones, and D12b's generated
`docs/LICENCE_LOG.md`. A `sources/*.yaml` directory should extend the evaluated
tier, not duplicate the code registry. And per D12b's own finding — `RESOURCES.md`
was asserting Z-Anatomy was "not yet pulled in" while it supplied the entire
musculoskeletal system — any comparison table must be **generated from something
that cannot drift from the artifact**.

---

## 1. How to compare these

Six axes are worth capturing per source, because "open anatomical model" hides very different things:

| Axis | Values |
|---|---|
| **Purpose** | canonical atlas / dosimetry phantom / biomechanical FE model / statistical shape model / registration scaffold / derived from patient data |
| **Provenance** | cryosection cadaver, CT, MRI, micro-CT, synchrotron, illustrator-authored, parametric fit |
| **Geometry type** | triangulated surface, NURBS/CAD, voxel labelmap, tetrahedral volume mesh, Hermite scaffold, parametric (PCA) model |
| **Licence class** | permissive (CC0, CC BY, Apache, MIT), copyleft (CC BY-SA, GPL, LGPL), non-commercial or no-derivatives (CC BY-NC, CC BY-NC-ND), bespoke agreement, paid |
| **Ontology binding** | FMA, UBERON, TA2, SNOMED CT, none |
| **XR readiness** | glTF/GLB available, poly budget sane, watertight, consistent scale and origin, LOD chain |

The last axis is the one that quietly kills projects. Most of the scientifically excellent sources below ship 10^5 to 10^7 triangle meshes with no LODs, no UVs and inconsistent coordinate conventions.

---

## 2. Whole-body canonical atlases (mesh-native)

These give one consistent labelled body. Most trace back to the same handful of cadavers, so they are less independent than they look.

| Source | What it is | Format | Licence |
|---|---|---|---|
| **BodyParts3D** (DBCLS, Japan) | ~3,000 segmented structures from an adult male, FMA IDs. The substrate under most open atlases. | OBJ, STL | CC BY-SA (Japan port) **VERIFY version** |
| **Z-Anatomy** (Kervyn, Zielinski) | BodyParts3D retopologised, renamed to Terminologia Anatomica 2 (2019), organised into collections, vessels and nerves as curves, multilingual labels. Over 7,000 structures. Unity import path documented. | .blend, OBJ | CC BY-SA 4.0 |
| **Open3DModel / "Open 3D Anatomical Model for Education"** (Leiden UMC, Maastricht, Utrecht, Leuven, via AnatomyTOOL) | 2022 onward rework of Z-Anatomy: all structures remeshed to remove hooked surface artefacts, teacher-facing selection sub-models. The most actively curated branch of the BodyParts3D lineage. | Blender, per-structure meshes | CC BY-SA expected **VERIFY** |
| **OpenAnatomy** (Surgical Planning Lab, Brigham / Harvard) | Atlases derived from real segmentations with structured labelling and good provenance. Companion tooling: **TA2Viewer** (official FIPAT Terminologia Anatomica 2 browser) and **Open Anatomy Explorer / OPANEX**, a WebGL atlas viewer with upload, labelling and sharing. | Slicer scenes, glTF export | CC BY (per atlas) **VERIFY** |
| **Human Reference Atlas** (HuBMAP) | Already in your stack. Strongest semantic layer (UBERON, Cell Ontology, ASCT+B), weakest geometry layer: illustrator-authored reference organs built for registration by collision detection, not for measurement. | GLB, RDF | CC BY 4.0 |
| **Visible Human Project** (US NLM) | The cryosection ground truth. Not itself geometry. | Image stacks | US Government terms |
| **Visible Korean** (Ajou University, Chung / Park / Shin) | Higher resolution true-colour sectioning than VHP (pixel size down to 0.06 mm), 937 structures outlined across 1,702 slices, whole-body and regional surface models plus real-colour volume models, five sectioned datasets 2002 to 2023. Distributed mainly as browsing software and 3D PDF, which is an ingestion obstacle. | 3D PDF (U3D), volume models | Free download, terms unclear **VERIFY** |
| **Chinese Visible Human** | Third member of the cryosection family. Derived surface models exist but distribution is fragmented. | Various | **VERIFY** |

**Comment.** The BodyParts3D lineage (BodyParts3D, Z-Anatomy, Open3DModel) is one asset with three levels of polish, not three independent sources. Treat them as a single provenance chain in the comparison table, and prefer Open3DModel as the ingest point.

---

## 3. Computational phantoms (physics-grade, built for simulation)

These carry tissue properties and regulatory standing that atlases lack. Geometry fidelity is tuned for dose and field simulation, not for visual anatomy.

| Source | What it is | Format | Licence |
|---|---|---|---|
| **ICRP Publication 145 MRCPs** | Adult male and female mesh-type reference computational phantoms, 187 organs, 53 materials, roughly 8.5 million tetrahedra, deformable, 3D-printable. The official international reference bodies in mesh form. Publication itself is free-to-access since 2023. | Polygon mesh + tetrahedral mesh | Distributed by ICRP under its own terms **VERIFY** |
| **ICRP Publication 110** | The older voxel adult male and female. Regulatory ancestor of the above. | Voxel | ICRP terms |
| **MIDA** (IT'IS Foundation + US FDA) | Multimodal imaging-based detailed anatomical model of head and neck. 153 structures at 500 µm isotropic, integrating T1/T2 MRI, MRA and DTI. CAD objects, so meshable at arbitrary resolution without losing small features. Arguably the most detailed head and neck CAD model that exists. | CAD | Free of charge but a bespoke privacy licence agreement, no open redistribution |
| **IT'IS Virtual Population (ViP)** | Duke, Ella, Billie, Thelonious and the wider family, including pregnant and posable variants. | Surface + voxel | Paid licence, academic pricing |
| **XCAT** (Segars, Duke) | 4D, beating heart and breathing motion, NURBS-based, plus imaging simulators. Still the reference for synthetic-but-faithful DICOM. | NURBS | Licence fee |
| **UF / NCI hybrid phantom family** | Paediatric and adult series scaled to ICRP 89 reference anthropometry. Fills the age range the ICRP pair does not. | Hybrid NURBS/voxel | **VERIFY** |

---

## 4. Finite element human body models (biomechanics)

The genuinely open corner of whole-body modelling, and largely absent from anatomy-atlas discussions.

| Source | What it is | Format | Licence |
|---|---|---|---|
| **VIVA+** (Chalmers, TU Graz, Ljubljana) | Four models: average female and average male, each seated and standing. First open-source average **female** model, which matters because the entire crash-safety corpus was male-anchored. Detailed ribcage, cervical spine (vertebrae split into cortical, trabecular, endplates, discs with annulus fibres and nucleus, facet joints, ligaments) and lower extremities. Certified for EuroNCAP CP550 at v2.0.1. Caveat: non-skeletal organs are deliberately simplified for solver robustness. | LS-DYNA FE mesh | **LGPL v3** (models), CC BY 4.0 (docs and validation catalogue) |
| **PIPER scalable child model** | Continuously scalable child model, roughly 1.5 to 6 years, scalable to 12 with the metadata, occupant and pedestrian versions. Paired with the PIPER kriging-based positioning and personalisation tool, which also repositions VIVA+, THUMS and GHBMC. The only credible open paediatric whole-body geometry. | FE mesh | **GPL v3** (model), CC BY 4.0 (datasets), LGPL v2.1 (AnatomyDB) |
| **OpenSim model library** (SimTK / opensim-org) | Rajagopal full-body (37 DoF, 80 muscle-tendon units, bony geometry for the whole body), Gait2392/2354, thoracolumbar spine with articulated rib cage and 552 muscle fascicles, paediatric spine variants, cervical and impact models. Bone geometry ships as separate mesh files, which is exactly what you want. | .osim + .vtp/.obj geometry | Apache 2.0 **VERIFY per model** |
| **Open Knee(s)** (Cleveland Clinic, Erdemir) | Specimen-specific knee FE models with the entire chain published: imaging, segmentation, geometry, mesh, scripts, model, plus joint mechanical testing data. Generation 1 and 2. | Geometry + FEBio models | **CC BY 4.0** |

**Comment.** VIVA+ under LGPL v3 is the single most licence-friendly whole-body geometry with real anatomical structure behind it. LGPL explicitly permits dynamic linking against proprietary models without resharing, which the project documents at length.

---

## 5. Parametric and statistical shape models

The right layer if you want to deform canonical geometry using patient-derived measurements rather than reconstructing meshes from personal scans.

| Source | What it is | Licence |
|---|---|---|
| **SKEL / BSM** (Max Planck, Keller et al., SIGGRAPH Asia 2023) | SMPL re-rigged with a biomechanically correct skeleton: real joint locations, real degrees of freedom (1 DoF knee, sliding scapula, forearm twist), bones that actually stay inside the skin. BSM ships in OpenSim .osim format. BioAmass dataset of fits included. | Research / non-commercial |
| **SMPL, SMPL-X, STAR, SUPR** | The body-surface family. Skin only, no viscera. | Research / non-commercial |
| **MPFB2 / MakeHuman** (MakeHuman Community) | Parametric human generator. Assets are **CC0**, code is GPL (MPFB2) or AGPL (MakeHuman). Quad-only topology, subdivision-friendly, roughly 15k vertices. The cleanest licence in the whole survey. Anatomically it is an outer shell, not viscera, but it is the obvious body envelope for organs to sit inside in XR. | Assets **CC0**, code GPL/AGPL |
| **ShapeWorks** (University of Utah) and **Scalismo / Statismo** | SSM construction toolchains rather than models. Relevant if you build your own population models. | Open source |
| **Paediatric lower-limb SSM** (SimTK `paed_ssm`) | Pelvis, femur, tibia/fibula for ages 4 to 18 from 333 CT scans, predicts bone shape from age, height and weight. Beats linear scaling by roughly 2x RMSE. | **VERIFY** |
| **Tibia-fibula SSM** (SimTK `ssm_tibia`) | Public surface meshes plus SSM plus code and use examples. | **VERIFY** |
| **OpenHands** | Open-source SSM of the finger bones. | **VERIFY** |
| **SICAS Medical Image Repository (SMIR) / Virtual Skeleton Database** | Whole-body CT cohorts widely used as SSM training data, including a 50-scan set. | Registration required **VERIFY** |

---

## 6. Organ-system-specific libraries

This is where the biggest quality jumps are, and where a comparison library earns its keep.

### Cardiovascular

| Source | What it is | Licence |
|---|---|---|
| **Vascular Model Repository** (vascularmodel.com, Stanford / Berkeley) | Library of computational models of normal and diseased human cardiovascular and pulmonary anatomy, with image data and inlet/outlet boundary conditions. SimVascular-compatible. Supported by NLM and NHLBI. | Site-specific terms **VERIFY** |
| **openCARP modelling resources** | Curated index including 24 volumetric four-chamber meshes from heart failure patients with region labels, rule-based fibre angles and ventricular coordinates (Zenodo, doi 10.5281/zenodo.3890033), plus the CEMRG collection: healthy four-chamber meshes, atria with DT-MRI fibres, ventricles with scar, and 1,000 synthetic four-chamber hearts. | Per-dataset **VERIFY** |
| **Cardiac digital twins from UK Biobank** (2025) | Open pipeline from cine MR to biventricular mesh, plus 1,423 released representative meshes stratified by sex, BMI and age. | UK Biobank derived-data rules apply, redistribution constrained **VERIFY** |
| **Cardiac Atlas Project** | Long-running imaging database plus statistical shape and motion atlases of normal and pathological hearts. | CC BY-NC (paper), data terms separate |
| **ASOCA, ImageCAS** | Coronary CTA segmentation corpora; ImageCAS at 1,000 scans is now the basis for open left atrial appendage work. | Challenge terms |
| **Parse2022** | Pulmonary artery segmentation corpus. | Challenge terms |

### Respiratory

| Source | What it is | Licence |
|---|---|---|
| **ATM'22** (Airway Tree Modeling) | 500 chest CTs with complete airway tree annotations, trachea to peripheral bronchioles, drawn partly from LIDC-IDRI. The largest airway geometry resource. | Challenge terms |
| **AeroPath** (Raidionics / SINTEF) | 27 CTs with severe pathology (emphysema, large tumours, collapsed segments, dilated trachea) plus trachea and bronchi annotations. The pathological complement to ATM'22, which is mostly non-distorted anatomy. | Openly available **VERIFY** |

### Head, neck, ear, brain

| Source | What it is | Licence |
|---|---|---|
| **OpenEar** (Sieber et al., MED-EL / Bern) | Eight temporal bone models from combined cone-beam CT and micro-slicing, with **real colour** data. Inner ear compartments, ossicles, tympanic membrane, nerves, vessels. Built explicitly for VR surgical simulation, which makes it unusually XR-ready. | **CC BY 4.0** |
| **MIDA** | See section 3. 153 head and neck structures in CAD. | Bespoke agreement |
| **SimNIBS head models** | Ernie, Ernie Extended (MRI + CT derived, includes shoulders), MNI152 head mesh, spherical model, five-subject cohort. Tetrahedral volume meshes with tissue labels. | Several datasets are **CC BY-NC 4.0**, which excludes commercial use |
| **Population head model repositories** | SimNIBS-derived CAD head model collections built on Human Connectome Project subjects (16-model and 50-model sets). | **VERIFY** |
| **ICBM152 / MNI templates, Allen Human Brain Atlas, BigBrain, Julich-Brain** | The brain-parcellation layer. Volumetric and probabilistic rather than mesh-native. | Mixed, several NC |

### Musculoskeletal and joints

Covered in sections 4 and 5. Add **MorphoSource** and **Smithsonian 3D Digitization** for skeletal specimens released CC0 or CC BY, and the **New Mexico Decedent Image Database** for whole-body CT with demographics.

### Dental

| Source | What it is | Licence |
|---|---|---|
| **Teeth3DS+** (MICCAI 3DTeethSeg / 3DTeethLand) | 1,800 intraoral scans from 900 patients, 23,999 annotated teeth, per-vertex instance and class labels, OBJ meshes, plus landmark annotations. Sex-balanced, 50% orthodontic and 50% prosthetic, skewed young. Updated January 2026. | **VERIFY** |
| **ToothFairy2** | CBCT with 42 annotated categories including jawbones, alveolar nerve canal, maxillary sinuses, pharynx, crowns, implants. | Challenge terms |
| **CTooth** | First large open dental CBCT voxel segmentation dataset. | **VERIFY** |
| **FDI 16 Tooth Dataset** | 7,732 meshes of the right first maxillary molar. Open meshes, no interior volume. | CC BY-NC-SA 4.0 |

### Development

| Source | What it is | Licence |
|---|---|---|
| **3D Atlas of Human Embryology** (Amsterdam UMC, de Bakker et al.) | 14 interactive 3D models, Carnegie stages 7 to 23, from roughly 15,000 manually annotated histological sections across 34 Carnegie Collection embryos, up to 150 labelled structures per specimen. Terminologia Embryologica compliant. | **CC BY-NC-ND 4.0**, so no derivatives and no commercial use. Link, do not ingest. |

---

## 7. Registration scaffolds: a category on its own

**SPARC organ scaffolds** (Auckland Bioengineering Institute, NIH SPARC) deserve separate treatment because they are neither atlas nor phantom. Each scaffold is a coarse Hermite finite element mesh built from simple connected elements, carrying a **material coordinate system**: an element plus local coordinates labels the same piece of tissue across every configuration of an individual, and the anatomically equivalent location across individuals. Regions and landmarks are annotated with standard anatomical terms.

That is exactly the primitive a digital twin needs for "same location, different body" and for longitudinal comparison, which mesh atlases cannot express.

- Generic organ scaffolds export to **STL and VTK** from the derivative folder of each dataset, or can be regenerated with the ABI Mapping Tools (Scaffold Creator, Geometry Fitter, Argon Viewer, Argon Scene Exporter) or the Python `sparc.client` library.
- Of particular note: **"A 3D human whole-body model with integrated organs, vasculature, musculoskeletal and nervous systems for mapping nerves"** (Soltani, Fisher, Nickerson, Hunter, Castaneda Ruan, 2025), SPARC dataset 307, doi 10.26275/BBVG-GJ86. Body scaffold fitted to data, organ fiducial markers embedded, nerve centrelines added. Direct zip download.
- Also mirrored on the AWS Registry of Open Data.
- Licence: SPARC datasets are generally CC BY 4.0, **VERIFY per dataset**.

---

## 8. Imaging corpora for deriving your own geometry

If the library is for comparison, it also needs the substrates other people derive from.

| Source | Why it matters | Licence |
|---|---|---|
| **Human Organ Atlas** (HiP-CT, ESRF + UCL) | Whole intact ex vivo human organs at roughly 20 µm/voxel with aligned zoom volumes down to about 1 µm (lowest achieved 0.65 µm), non-destructively. Bridges radiology and histology. Expanded browser-accessible portal released March 2026. Per-dataset DOIs, donor and scan metadata. Highest-resolution open 3D data on intact human organs currently available. | **CC BY 4.0** |
| **TotalSegmentator** | The default route from a real CT to labelled organ geometry. | Open, check model vs dataset terms |
| **AbdomenAtlas** (Johns Hopkins) | 20,460 CT volumes from 112 hospitals, 673K masks, 25 annotated structures: 16 abdominal organs, 2 lungs, 5 vascular structures, 2 femurs. AbdomenAtlas 1.0/1.1 subsets are on GitHub. The scale needed for population percentile work. | Mixed source licences **VERIFY** |
| **WORD, AMOS, CT-ORG, AbdomenCT-1K, FLARE, Medical Segmentation Decathlon, 3D-IRCADb** | The rest of the abdominal segmentation corpus, useful mainly as comparators. | Mixed |
| **NAKO, UK Biobank** | Population MRI. Reference distributions, not geometry. Already covered in your Route A plan. | Application required |

---

## 9. Aggregators and registries

| Source | Notes |
|---|---|
| **NIH 3D** (formerly NIH 3D Print Exchange) | Large collection of biomedical models including patient-MRI-derived anatomy and a substantial congenital heart disease collection. STL, VRML, X3D, Blender. Models are individually **CC-licensed or public domain**, so licence is per-model, not per-site. |
| **SimTK** | The hub for Open Knee(s), OpenSim models, the SSM projects, Z-Anatomy's project page. |
| **SPARC Portal** | See section 7. |
| **AnatomyTOOL** | Leiden-led curated index of open anatomy resources, with licence stated per item. Useful as a cross-check on your own licence findings. |
| **MorphoSource** | Skeletal and specimen CT at scale, per-item licences. |
| **Embodi3D** | Community medical STL library, user-uploaded, licence quality varies. |

---

## 10. Licence traps worth encoding in the repo

1. **ShareAlike is contagious.** BodyParts3D, Z-Anatomy and Open3DModel are CC BY-SA. Any mesh you derive from them stays CC BY-SA. If OpenTwin ships a mixed scene, keep SA assets in a separate, clearly fenced asset tier with its own LICENSE file, and never merge SA geometry into a mesh that also contains permissive geometry.
2. **LGPL is the friendly copyleft.** VIVA+ documents explicitly that dynamic linking does not force you to open your own models, and that simulation outputs do not inherit the licence.
3. **GPL v3 is not.** PIPER's child model is GPL v3. Isolate it.
4. **NoDerivatives is fatal for XR.** The embryo atlas (CC BY-NC-ND) cannot be retopologised, decimated, converted to glTF or recoloured. Link out, do not ingest.
5. **Non-commercial excludes a foundation product that might later commercialise.** SKEL, SMPL, several SimNIBS datasets, FDI 16, Cardiac Atlas Project outputs.
6. **"Free of charge" is not "open".** MIDA is free but under a bespoke privacy agreement with no redistribution right. ICRP phantom data is distributed under ICRP terms even though the publication is now free-to-access.
7. **Derived-data rules travel.** UK Biobank derived meshes cannot simply be redistributed by you even when a paper released them.
8. **Challenge datasets** (ATM'22, ToothFairy, FLARE, 3DTeethSeg) usually carry participation-scoped terms that do not authorise redistribution inside a product.

---

## 11. Suggested manifest schema

For the comparison to be machine-readable rather than a wiki page, one YAML file per source:

```yaml
id: openear
name: OpenEar Library
version: "2018"
publisher: MED-EL / University of Bern
doi: 10.1038/sdata.2018.297
purpose: organ-specific-atlas        # atlas | phantom | fe-model | ssm | scaffold | imaging-corpus
region: temporal-bone
subjects:
  n: 8
  sex: [m, f]
  age_range: adult
provenance:
  modality: [cbct, micro-slicing]
  colour: true
  resolution_um: null                # VERIFY
geometry:
  type: surface
  formats: [stl, nrrd]
  gltf_available: false
  watertight: unknown
  triangle_count: null
ontology:
  scheme: null                       # fma | uberon | ta2 | snomed | none
  coverage: 0.0
licence:
  spdx: CC-BY-4.0
  class: permissive
  redistribution: allowed
  commercial: allowed
  share_alike: false
  verified: true
  verified_on: 2026-07-28
xr:
  ingested: false
  lod_chain: false
  notes: "Built for VR surgical simulation; colour data makes texturing viable without hand-painting."
```

A single `sources/` directory of these plus a generated comparison table gives you the exhaustive library without hand-maintaining a giant markdown grid.

---

## 12. If you only add five

1. **SPARC whole-body scaffold (dataset 307)**, because material coordinates solve the cross-subject correspondence problem that nothing else on this list solves.
2. **VIVA+**, because LGPL v3 whole-body geometry with a real female baseline is unique and legally clean.
3. **OpenEar**, because it is CC BY 4.0, colour-textured, and was built for VR from the start.
4. **Human Organ Atlas**, because CC BY 4.0 synchrotron data at 1 to 20 µm is a provenance level nothing else offers, and it future-proofs the geometry pipeline.
5. **Open3DModel** (the Leiden-led Z-Anatomy branch), as the ingest point for the BodyParts3D lineage rather than BodyParts3D or Z-Anatomy directly, since the remeshing work is already done.

Then **PIPER** and the **paediatric SSM** if the twin ever needs to be anything other than an adult, which is currently the single largest gap across the entire open corpus.

---

## 13. Open questions

- Does anything in this list ship glTF/GLB natively other than HRA? Current answer appears to be no, which means an ingestion and conversion pipeline is unavoidable and should be treated as a first-class repo component rather than a preprocessing script.
- Is there a licence-clean path to a **female** whole-body visceral atlas? BodyParts3D is a single adult male. Visible Korean has female whole-body and pelvis surface models but distribution terms are unclear. VIVA+ has a female baseline but simplified viscera. This looks like a genuine gap that OSI could fund.
- Nobody appears to publish an open, versioned, ontology-bound, XR-ready organ mesh library with LODs. That is a plausible OpenTwin contribution back to the commons, and would be a natural CopyFair-licensed artefact.
