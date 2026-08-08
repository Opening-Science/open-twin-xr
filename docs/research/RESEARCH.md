# OpenTwin: Landscape Research Appendix

**Prepared for:** Open Science Foundation, Matten bei Interlaken
**Scope:** anatomical model and data foundations; product and UX landscape
**Date:** 7 August 2026
**Status:** research input for `open-twin` and `open-twin-xr`. Most licence claims carry their source URL, but two tables do not: the red-light table in 3.2 and the licensing column in 5.2 state licences without one. Treat those two as leads to verify rather than as sourced claims. Unresolved items are flagged explicitly rather than guessed.

---

## 0. How to read this

This appendix is the evidence base. `FORK_PLAN.md`, `CLAUDE.fork.md`, `MODEL_INTEGRATION.md` and `REFERENCES.md` translate it into repo-specific actions.

The single organising finding is this: **in this field, licensing is architecture.** The choice of body model, segmentation dataset, anatomical ontology and mesh corpus each carries redistribution terms that either permit or forbid the thing an open-science WebXR project must do, which is serve those assets to an anonymous browser. Several of the most technically attractive options in the space fail that test, and a few of them fail it silently. Sections 2, 3 and 5 are therefore ordered by legal viability first and technical merit second.

A secondary finding: the incumbent's advantage is not its geometry. It is its embed, its API and its authoring tool. That shapes what an open competitor should actually build (section 6).

---

## 1. Corrections to the seed sources

Two of the six seed links do not say what the framing assumed. Both are still useful, but for different reasons than expected.

### 1.1 arXiv 2406.06464 is not a body-model paper

`https://arxiv.org/html/2406.06464v3` is *Transforming Wearable Data into Personal Health Insights using Large Language Model Agents* (Merrill, Paruchuri, Rezaei, Kovacs, Althoff, McDuff, Liu; Google and University of Washington). It introduces **PHIA**, a ReAct-style agent doing code generation and retrieval over wearable time series (steps, sleep, heart rate), evaluated on 4,000+ benchmark questions with 650 hours of expert review, reporting 84% accuracy on objective numerical questions.

It contains nothing about mesh topology, parametric shape, or anatomy.

Its relevance to OpenTwin is on the **physiological signal and reasoning layer**, not the geometry layer. If OpenTwin is ever to be a twin rather than an atlas, something like PHIA is the pattern for "what do we do with the longitudinal data once we have a body to hang it on." Keep it, recategorise it.

- https://arxiv.org/abs/2406.06464

**If the intent was the ANNY paper**, that is *Human Mesh Modeling for Anny Body* (Brégier et al., NAVER LABS Europe, November 2025):

- https://arxiv.org/abs/2511.03589

### 1.2 PMC12524217 is a usability study built on the proprietary incumbent

`https://pmc.ncbi.nlm.nih.gov/articles/PMC12524217/` is *Visualization of Medical Record with 3D Human Body Models* (Liu, Lai, Chiang; *Healthcare* Basel, 23 September 2025, DOI 10.3390/healthcare13192393).

It is a usability study of a WebGL EMR front-end mapping ICD-10 diagnosis codes onto 3D anatomy. Participants: 34 total (5 physicians, 8 nurses, 21 students). SUS score 70.42, described as "moderate to good." **No comparison against a conventional EMR.**

Critically, **the 3D models are BioDigital Human's**, roughly 1,200 proprietary models. So this is a paper documenting a workflow on top of the closed incumbent, not an open alternative.

What is genuinely useful in it:

1. It is a citable precedent for the **ICD-10 to anatomical structure mapping** pattern, which matters for OpenTwin's semantic layer. Note carefully what it is *not*: the paper describes an "ICD-to-model logic layer" cross-referencing an "embedded model registry", but **publishes no mapping table, no curation process, no curator count and no coverage figure**, and its data-availability statement offers raw data only on request. It gives you the architecture and the evaluation instrument, not a reusable artefact. `REFERENCES.md` §2, and specifically §2.4, works out what to build instead.
2. It documents a limitation OpenTwin will inherit: conditions with no localisable anatomical substrate (psychiatric, autoimmune, many genetic syndromes) cannot be represented on a body model at all. Any condition-browsing UI needs a designed answer for that, not a blank scene.
3. It reports WebGL performance problems at model scale, which is direct evidence for the compression and streaming decisions in section 7.

**Do not cite it as evidence for digital twin feasibility.** It is a UI study.

### 1.3 The Usine Nouvelle article is historical, not current

`https://www.usinenouvelle.com/article/modeling-the-human-body.N322517` is a French trade-press survey from roughly 2014 to 2015 covering the Human Brain Project, BRAIN Initiative, Visible Patient (IRCAD Strasbourg spin-off, patient-specific models from scans, ~15 hospitals and 2,500 patients at the time), the Virtual Liver Network, AirProm, INRIA Bordeaux tumour-growth models, HeartFlow, ARTreat, and the 2014 launch of Dassault's Living Heart.

Its value is as a reminder of how long the human digital twin has been roughly five years away. Its 2016 to 2018 predictions largely did not land on schedule. Use it for framing, not for current state.

---

## 2. Parametric body models: the foundation decision

### 2.1 Comparison

Figures marked **[M]** were measured directly by installing the package or downloading and parsing the release asset on 7 August 2026, not read from documentation. Where a documented figure and a measured one disagree, the measured one is given and the discrepancy noted.

| Model | Models what | Age coverage | Licence | Commercial | Registration | Browser-shippable | **Integration feasibility in `open-twin-xr`** |
|---|---|---|---|---|---|---|---|
| **ANNY** (NAVER LABS Europe) | Surface mesh **13,718 verts / 27,420 tris [M]**, LBS. Rigs selectable: `anny` 104 bones (default), `makehuman` **163**, `mixamo` 52, `soma` 78 **[M]**. Topologies incl. `notoes_collapse5pc` **615 verts [M]** and `soma` 18,056 **[M]** | **Infant to elder**, unified space. Phenotype macros: gender, age, muscle, weight, height, proportions **[M]**. Pregnancy is **not** a macro; it is the MakeHuman local-change target `stomach-pregnant-incr`, available with `local_changes="default"` **[M]** | **Apache-2.0** code; **CC0-1.0** assets (MakeHuman via MPFB2, Face Units); `data/soma` is Apache-2.0 **[M]** | **Yes** | **No** (`pip install anny`) | **Yes, legally.** No JS runtime exists yet | **HIGH, static.** A ~20-line Python bake via `trimesh.Trimesh(...).export()` produces a GLB (verified end to end, 494 KB). Z-up, so rotate minus 90 degrees about X. No glTF exporter for rig or morph targets exists; that needs custom code. No skin texture ships |
| **MHR** (Meta) | **127-joint** skeleton decoupled from shape **[M]**, 7 LODs 73,639 → 595 verts **[M]**, **117 blendshape channels per LOD [M]**, MLP pose correctives | Adults; 7,110 scans. Paediatric not documented | **Apache-2.0**, including assets (`LICENSE.txt` added inside the v1.0.1 assets zip) **[M]** | **Yes** | **No** | **Yes**, after conversion | **MEDIUM.** Binary FBX 7700, centimetres, Y-up **[M]**. Path is Blender import then glTF export, not a direct converter: upstream FBX2glTF's last release was 2019 (Godot fork is the maintained one). Blendshape channels are named `shape_c_0…116` and the identity/expression split is not in the file. **No materials or textures at all [M]** |
| **SOMA-X** (NVIDIA) | Canonical unifying topology, **78-joint** rig (user-facing pose is 77) **[M]**, retargeting pivot between MHR, ANNY, SMPL | Uses **ANNY as the sole sub-18 backend** | **Apache-2.0**, HF card states "ready for commercial use" | **Yes** (excluding SMPL backend) | **No** | **No.** Ships `.npz`, `.pt` and `.usda` only | **LOW as an asset, and unnecessary.** PyTorch plus Warp plus usd-core at runtime; no viewer-loadable mesh is distributed **[M]**. Its value is future retargeting. For SOMA-compatible geometry today, **ANNY already ships the SOMA topology and rig** as `Anny(topology="soma", rig="soma")` under Apache-2.0 **[M]** |
| **MakeHuman / MPFB2** | Base mesh plus thousands of morph targets, skeletons, proxies. Origin of ANNY's shape space | Full lifespan, pregnancy, aged morphs | Code: MakeHuman is **AGPL-3.0**, MPFB2 is **GPL-3.0**. Both repos call that file `LICENSE.CODE.md`, so the same filename carries two different licences; check which repo you are reading. **Assets CC0-1.0** in both (`LICENSE.ASSETS.md`) **[M]** | **Yes** for assets | **No** | **Yes** (assets only) | **MEDIUM, highest fidelity.** Blender addon, then Blender's native glTF exporter gives rig, morph targets and a textured material in one step. Requires a human in Blender, so it is not reproducible in CI. Delete helper geometry before export; "Apply Modifiers" silently destroys shape keys |
| **SMPL** | Surface only, 6,890 verts | Adults, CAESAR-derived, <5,000 subjects, ~18 to 65 | Non-commercial research licence | **No** | Yes | **No** | **BLOCKED** by licence, see 2.2 |
| **SMPL-X** | Body, hands, face; 10,475 verts, 54 joints | Adults; kid via SMIL-X | Non-commercial | **No** | Yes | **No** | **BLOCKED** |
| **STAR** | Surface, sparse local blendshapes | Adults | Non-commercial | **No** | Yes | **No** | **BLOCKED** |
| **SUPR** | Part-based body, head, hand, foot | Adults | Non-commercial | **No** | Yes | **No** | **BLOCKED** |
| **SMIL** | Infant surface | **Infants only** | Fraunhofer/MPI non-commercial, bans web services explicitly | **No** | Click-through | **No** | **BLOCKED** |
| **SKEL / BSM** | Biomechanical skeleton inside SMPL, OpenSim `.osim` | Adults | Non-commercial | **No** | Yes | **No** | **BLOCKED** |
| **GHUM / GHUML** (Google) | Nonlinear VAE shape and pose, surface | Adults | Undisclosed, request-gated | Unknown | Yes | **No** | **BLOCKED**, and the terms are not even published |

Implementation instructions for the three feasible entries are in **`MODEL_INTEGRATION.md`**, including the gltf-transform and three.js constraints that govern whether morph targets survive the existing asset pipeline.

### 2.2 Why the SMPL family is disqualified, and it is not the reason people assume

Three independent blockers. Any one is fatal for a browser-delivered open project.

**Blocker 1: non-redistribution, not non-commercial.** Every Max Planck licence in the family (SMPL, SMPL-X, MANO/SMPL-H, STAR, SUPR, SKEL) carries a materially identical non-redistribution clause. It is not one verbatim string across all of them: the opening noun phrase differs per licence, naming whatever that licence covers. The SMPL model licence reads:

> "The Software and the license herein granted shall not be copied, shared, distributed, re-sold, offered for re-sale, transferred or sub-licensed in whole or in part except that you may make one copy for archive purposes only."

The SMPL-X licence opens the same sentence "The Model & Software ...". When quoting this in anything that matters, quote the specific licence you rely on rather than a composite.

A WebXR application necessarily transmits model parameters to every client browser. **That is distribution.** There is no configuration, including a purely academic non-profit deployment, in which SMPL-X weights can legally ship in a web bundle. The grant is also single-user, non-exclusive and non-transferable, so an institution cannot acquire it once on behalf of its users.

- https://smpl.is.tue.mpg.de/modellicense.html
- https://smpl-x.is.tue.mpg.de/modellicense.html
- https://star.is.tue.mpg.de/license.html
- https://supr.is.tue.mpg.de/license.html
- https://mano.is.tue.mpg.de/license.html
- https://skel.is.tue.mpg.de/license.html

**Blocker 2: patents survive licence workarounds.** SMPL is covered by **US10395411B2** (spec WO2016207311A1), with **Meshcapade holding exclusive commercial sublicensing rights**. SMIL has its own patent, **US11127163B2**. Reimplementing the mathematics from the published paper does not clear a patent.

- https://meshcapade.com/smpl/
- https://patents.google.com/patent/US11127163B2/en

The apparent escape hatch does not work either. There is a CC-BY-4.0 release called "SMPL-Body", but it is deliberately hollowed out: it covers the mesh, rig, pose and dynamic blendshapes and **explicitly excludes the shape blendshapes and the tools to create bodies using them**. Without shape blendshapes there is no parametric model, only a rigged mannequin.

- https://smpl.is.tue.mpg.de/license.html

**Blocker 3: the contamination is viral through the tooling.** `vchoutas/smplx`, the de-facto reference implementation that most downstream work imports, does **not** carry MIT or Apache. Its `LICENSE` file is the same non-commercial model licence, extended to cover "downloading, cloning, installing, and any other use of this github repository."

- https://github.com/vchoutas/smplx/blob/main/LICENSE

**Action:** audit both repos' dependency trees for anything that transitively pulls `smplx`, `smplx-lite`, `human_body_prior`, `chumpy`, or AMASS-derived assets. This is a common accidental inheritance.

### 2.3 The scientific problem, separate from the legal one

SMPL's shape space derives from fewer than 5,000 CAESAR subjects, roughly ages 18 to 65, scanned in the early 2000s, geographically narrow. The field's standard patch for children is **SMIL-X**: a single extra shape component that linearly interpolates between an adult template and an infant template, exposed as `age='kid'` in the `smplx` API.

- https://github.com/pixelite1201/agora_evaluation/blob/master/docs/kid_model.md

For a project that must represent a four-year-old, a pregnant adult and an 85-year-old, a one-dimensional adult-to-infant interpolation is not an anatomy model. It also drags in **two** incompatible restrictive licences simultaneously (SMPL-X and SMIL).

### 2.4 Recommendation

**Build on ANNY (Apache-2.0 code, CC0 assets), with MHR (Apache-2.0) available for the skeleton and LOD tiers. Treat the entire SMPL family as reference-only: cite it, benchmark against it, never link against it or ship it.**

**SOMA-X is deliberately not a third pillar here**, despite reading like one in its own documentation. It distributes no viewer-loadable mesh, requires PyTorch and Warp at runtime, and is unnecessary for geometry anyway, because **ANNY already ships the SOMA topology and rig natively** under Apache-2.0. Keep it on the list for future motion retargeting across backends; do not put it in the critical path for a viewer.

Ranked rationale:

1. **It is the only stack that is simultaneously browser-shippable, commercially unrestricted, registration-free and covers infants through elders including pregnancy.** No SMPL-derived option satisfies even the first condition. On pregnancy specifically, note the correction in the table: it is a local-change target rather than a phenotype macro, so it is available but reached through a different API than age or weight.
2. **Registration-free matters more than it looks for open science.** Every Max Planck model requires each individual contributor and each reproducing researcher to create an account and accept a single-user grant. That is a reproducibility tax and a contributor-onboarding barrier that a foundation committed to open science should decline to impose on its own community.
3. **CC0 assets give downstream freedom that even Apache-2.0 does not.** The MakeHuman community's stated position is explicit: *"Take all mesh and target assets and build a character generator of your own, with no restriction on what license that character generator needs to have."* A from-scratch TypeScript or WASM WebXR runtime can therefore be authored with no copyleft and no attribution obligation on the resulting model files.
   - https://static.makehumancommunity.org/makehuman/faq/are_makehuman_files_free.html
4. **Scan-free construction is a defensible ethical position for a health-adjacent twin.** ANNY's shape space is artist-authored prototype interpolation, carrying no identifiable body-scan provenance. This sidesteps the consent and privacy questions attached to CAESAR-, SizeUSA- and infant-RGB-D-derived shape spaces. For a foundation, that is a position worth stating publicly, not just a convenience.
5. **The quality gap has closed.** The ANNY paper reports comparable or superior human mesh recovery benchmark performance to SMPL-X despite the simpler non-data-driven construction, and NVIDIA independently selected ANNY as SOMA's paediatric backend, which is third-party validation from a party with no incentive to flatter NAVER.

**Honest costs of ANNY.** The phenotype axes "encode by design stereotypes" (the authors' own words). It models neither clothing nor clothing deformation. It has no face or hand sub-model of its own. The shape space is artist priors rather than anthropometric ground truth, so absolute measurement fidelity against a standard like CAESAR is unvalidated. For an atlas and education product these are acceptable; for anthropometric or ergonomic claims they are not, and the project should say so.

### 2.5 Two traps to write into `CONTRIBUTING.md`

1. **Do not enable ANNY's optional `smpl` or `smplx` topologies.** Both, not just `smplx`, trigger a runtime download of `download.europe.naverlabs.com/humans/Anny/noncommercial.zip`, which unpacks its own `LICENSE.txt` and is **non-commercial only**. The path is in `anny/paths.py` as `download_noncommercial_data()`. Selecting either silently converts an Apache-2.0 project into a restricted one, and because the download happens at runtime rather than install time it will not show up in a dependency audit. The same applies to SOMA-X's SMPL and SMPL-X backends, which the NVIDIA docs note are "subject to a separate license and cannot be redistributed."
2. **CC0 assets are not CC0 code.** MakeHuman is AGPL and MPFB2 is GPLv3; only the assets are CC0. ANNY is clean precisely because NAVER wrote fresh Apache-2.0 code against CC0 assets. **Replicate that pattern; do not port MPFB2's Python.**

### 2.6 Sources

- ANNY blog: https://europe.naverlabs.com/blog/anny-a-free-to-use-3d-human-parametric-model-for-all-ages/
- ANNY paper: https://arxiv.org/abs/2511.03589
- ANNY code: https://github.com/naver/anny
- MHR: https://github.com/facebookresearch/MHR and https://arxiv.org/abs/2511.15586
- SOMA-X: https://github.com/NVlabs/SOMA-X and https://huggingface.co/nvidia/SOMA-X
- MPFB2 licence: https://github.com/makehumancommunity/mpfb2/blob/master/LICENSE.md

---

## 3. Anatomical data: what is actually usable

### 3.1 Green light: permissive, redistributable

| Resource | Contents | Licence | Notes |
|---|---|---|---|
| **TotalSegmentator dataset v2** | 1,228 CT subjects, **117 classes** | **CC BY 4.0** | https://zenodo.org/records/10047292. The single best open foundation in this brief |
| **TotalSegmentator code and core models** | nnU-Net based, 117 CT / 50 MR classes | **Apache-2.0** | https://github.com/wasserth/TotalSegmentator |
| **Visible Human Project** | Male ~15 GB (1,871 cryosections), Female ~40 GB (5,189 images at 0.33 mm), plus MRI and CT | **No licence agreement since July 2019.** NLM Terms and Conditions only | See 3.3 below. This is the inverted assumption |
| **FLARE22** | 50 labelled abdominal CT plus large unlabelled pool | **CC BY 4.0** | https://zenodo.org/records/7860267. See chain caveat in 3.4 |
| **nnU-Net v2** | Segmentation framework | **Apache-2.0** | https://github.com/MIC-DKFZ/nnUNet |
| **MONAI** | Medical DL framework | **Apache-2.0** | Framework only. **Model Zoo weights are per-model licensed, audit individually** |
| **FMA** (Foundational Model of Anatomy) | ~100k anatomical classes | **CC BY 4.0** | https://github.com/uw-sig/FMA/blob/main/LICENSE |
| **UBERON** | Cross-species anatomy, bridges FMA, MA, GO, CL | **CC BY 3.0** | https://obofoundry.org/ontology/uberon.html |
| **RadLex** (RSNA) | Radiology lexicon, RID identifiers | Royalty-free RadLex Licence v2.1 | **RIDs, names, synonyms and relations must not be altered in adaptations** |
| **Cornerstone3D** | Browser medical imaging, powers OHIF | **MIT** | https://github.com/cornerstonejs/cornerstone3D |
| **NiiVue** | WebGL2 viewer, 30+ volume and mesh formats | **BSD-2-Clause** | https://github.com/niivue/niivue. **No WebXR support documented** |
| **glTF 2.0, Draco, Meshopt, KTX2/Basis** | Web delivery | Royalty-free / Apache-2.0 / MIT | Khronos |

### 3.2 Red light: do not build on these

| Resource | Licence | Why it fails |
|---|---|---|
| **AbdomenAtlas 1.0 / 1.1 / 3.0** (JHU BodyMaps) | **CC BY-NC-SA 4.0** | NonCommercial. Research and benchmarking only, never in a shipped artefact |
| **SuPreM pretrained weights** (JHU) | **CC BY-NC-ND 4.0**, "patent pending" | NonCommercial **and** NoDerivatives. ND arguably blocks fine-tuning and certainly blocks redistribution of adapted weights |
| **SNOMED CT (full)** | Territory-based paid Affiliate licence via MLDS | Free only within member countries. Not redistributable |
| **IT'IS Virtual Population** (Duke, Ella, Billie, Thelonious) | No public licence or pricing; coupled to commercial Sim4Life | Widely and wrongly assumed free for academia |
| **XCAT / XCAT-3 phantoms** | Licensed through Duke Office of Technology Commercialization | Commercial licensing, despite marketing itself as "personalised digital twins from CT" |
| **ICRP Publication 110 / 145 phantoms, UF/NCI phantoms** | Reuse terms not published | Assume closed until written terms are in hand |
| **TotalSegmentator "starred" tasks** (tissue, brain structures, some vessels) | **Separate commercial licence required** | A trap inside an otherwise green resource. Audit per task |
| **autoPET / FDG-PET-CT-Lesions** | Imaging now under **NIH Controlled Data Access Policy**; only the clinical metadata CSVs are CC BY 4.0 | Changed status. Still widely cited as "CC BY 4.0 open" |
| **BTCV** | Synapse registration and DUA gated | Ubiquitous in papers, not a CC-licensed public dataset |
| **BioDigital Human** | Proprietary commercial | The incumbent |

### 3.3 The Visible Human Project: the assumption runs the other way

This is usually listed as a trap. It is no longer one.

> "As of July 2019, the NLM Data License has been replaced by Terms and Conditions."

No licence agreement, no registration. Historically roughly 4,000 licensees from 66 countries needed a signed licence; that requirement is gone.

- https://www.nlm.nih.gov/research/visible/getting_data.html
- Terms: https://www.nlm.nih.gov/databases/download/terms_and_conditions.html

Obligations: attribution as *"Courtesy of the U.S. National Library of Medicine"* in a clear and conspicuous manner; no implication of NLM endorsement; redistributors must either keep the data current or conspicuously state that it is not the most current NLM data. No warranties. Commercial use is not prohibited and no royalties are due.

Two residual risks worth noting in a provenance manifest. First, these are terms of use rather than a standard CC licence, so they are not SPDX-expressible and downstream relicensing is legally awkward. Second, the "currency" clause is an ongoing obligation that CC-trained developers will not expect. A DICOM conversion by NCI Imaging Data Commons is on Zenodo with the licence field reading literally "National Library of Medicine Terms and Conditions; May 21, 2019":

- https://zenodo.org/records/12690050

### 3.4 Amber: usable with viral or structural conditions

- **Medical Segmentation Decathlon**, CC BY-SA 4.0. ShareAlike is viral: derived label sets must also be CC BY-SA 4.0. http://medicaldecathlon.com/
- **FLARE22** is CC BY 4.0 but is derived from MSD (CC BY-SA 4.0) and AbdomenCT-1K. **The relicensing chain is arguably inconsistent.** Flagged, not resolved.
- **BodyParts3D**, **CC BY 4.0**, not the CC BY-SA 2.1 Japan that most secondary pages still show. DBCLS relicensed it on 2025-02-27 and the licence page (Last Updated 2025/02/27) states that "The license for this database is specified in the Creative Commons Attribution 4.0 International". **No share-alike.** The attribution string is required verbatim: *"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International."* The structural condition that keeps it in this section rather than 3.1: DBCLS have not confirmed the relicence in writing, and the stale share-alike pages are the easier ones to find, so record the licence URL and its update date in the provenance manifest.
  - Files are named by organ ID, which is the single most useful property in this whole section. DBCLS ships the individual organ models as **`.obj`**; the widely seen `FMA<ID>.stl` naming comes from a third-party conversion mirror, not from DBCLS. Note also that the naming is not universally FMA: the DBCLS README says organ IDs either begin with `FMA` or, where no FMA equivalent exists, carry a `BP` prefix.
  - 1,523 structures, distributed as two decimated packages and no undecimated one: the 95% polygon-reduction set is 521 MB (`BodyParts3D_3.0_obj_95.zip`) and the 99% set is 127 MB (`BodyParts3D_3.0_obj_99.zip`).
  - Licence: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html
  - README: https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/README_e.html
  - Third-party `.stl` conversion mirror: https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
- **Z-Anatomy**, claims CC BY-SA 4.0 on GitHub but **CC BY 4.0 on its Zenodo deposit**. See 3.5.
- **OpenUSD**, licence renamed to the Tomorrow Open Source License (TOST) at release 24.08. Terms are unchanged from the modified Apache 2.0, only the title changed at the Apache Foundation's request, but **it is not an SPDX-standard licence** and compliance tooling will flag it.
  - https://forum.aousd.org/t/upcoming-openusd-license-update/1561
- **SNOMED GPS** and **Terminologia Anatomica TA2**, both **CC BY-ND 4.0**. Ship verbatim only. No derivatives, no subsetting, no remapping without written permission.

### 3.5 The BodyParts3D relicence removes the share-alike problem, and what is left of it

This matters because Z-Anatomy is the most attractive open anatomy corpus and the obvious thing to reach for.

- **The upstream is permissive.** BodyParts3D is **CC BY 4.0** as of 2025-02-27. An earlier reading of this section rested on a CC BY-SA 2.1 Japan upstream whose ShareAlike would propagate downstream, with no valid Creative Commons 2.x to 4.0 upgrade path. That premise is false, so the conclusion built on it does not stand. There is no share-alike obligation coming from BodyParts3D at all.
- **But the dates matter, and they cut against a clean reading.** The relicence is dated 2025-02-27. The Z-Anatomy corpus that exists today was derived and published well before that: its Zenodo deposit (record 4953712) is dated 15 June 2021. **The version of BodyParts3D that Z-Anatomy actually derived from was the CC BY-SA 2.1 Japan one**, so for the existing corpus the share-alike is plausibly inherited after all, and the old question of whether a 2.x licence can be upgraded to 4.0 (Creative Commons provides a one-way path from BY-SA 3.0 to 4.0 and no mechanism from 2.x) is not closed by the upstream relicence. What the relicence does settle is the **forward** position: anything derived from BodyParts3D *now* takes CC BY 4.0 and carries no share-alike. It does not retroactively clean the 2021 derivation. Treat the existing Z-Anatomy corpus as share-alike and the fresh-derivation route as permissive.
- **The Z-Anatomy licence discrepancy is still unresolved.** It is distributed as **CC BY-SA 4.0** on GitHub and as **CC BY 4.0** on its Zenodo deposit. Those two are not the same licence and cannot both be right. The relicence upstream does not settle which of them governs.
- Z-Anatomy additionally mixes in reference models from the University of Washington, the University of Dundee and other sources, plus Wikipedia-derived definitions (CC BY-SA 4.0), with **no per-asset licence manifest**. That is unchanged and remains the substantive provenance risk.
- Z-Anatomy ships `TA2.csv`, a machine-readable extraction of Terminologia Anatomica. TA2 is CC BY-ND. **A machine-readable table extracted from an ND-licensed PDF is arguably an unauthorised derivative.**
- **Residual caveat on the upstream itself:** DBCLS have not confirmed the relicence in writing, and several upstream and mirror pages still state share-alike. Chase written confirmation before relying on the CC BY reading for anything that matters.

Sources: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html, and https://github.com/Z-Anatomy/Models-of-human-anatomy vs https://zenodo.org/records/4953712

**Recommendation, and the caveat that keeps it from being simple.** A **fresh derivation directly from BodyParts3D** is now CC BY 4.0 with no share-alike at all, attribution in the required verbatim form being the only obligation, so a project built that way stays permissive end to end and needs no separate share-alike asset package.

But that is a statement about geometry you would derive, not about the corpus that exists. **The existing Z-Anatomy corpus is a 2021 derivation of the pre-relicence BodyParts3D**, so its share-alike is plausibly inherited rather than merely chosen, and the old compatibility question still applies to it: Creative Commons provides a one-way path from BY-SA 3.0 to 4.0 and **no mechanism from 2.x to 4.0**, and the BodyParts3D conversion mirror notes the compatibility question is unaddressed. Going through Z-Anatomy therefore buys retopology quality at the price of that unresolved chain, an unexplained GitHub-versus-Zenodo licence discrepancy, and an unmanifested multi-source asset mix.

**If share-alike geometry is used anyway, that is a deliberate architectural decision and not something to stumble into.** Your derived meshes become share-alike, and the standard containment is to keep them in a separate repository and asset package from any permissively licensed core, exactly as the parent repo already keeps MIT code and CC-BY assets apart.

Note that this is a licence recommendation, not a build recommendation. Which atlas should actually carry structure-level work is a separate and currently open question, because BodyParts3D has no per-structure identity in the built asset; see `FORK_PLAN.md` §4 and §7 question 7.

### 3.6 TCIA: per-collection variance is real and unindexed

TCIA states that "most data are freely available ... under CC BY 3.0 or CC BY 4.0", but a subset of older collections carry NonCommercial restrictions, and in April 2025 collections requiring DUAs were moved to the NCI Cancer Research Data Commons and dbGaP. The browse interface exposes Public / Limited / Restricted access levels but **has no licence column and no licence filter**. Each collection page must be opened individually.

**Practical rule: never treat "it is on TCIA" as "it is CC BY." Record the exact licence string and DOI per collection in a provenance manifest.** autoPET is the live proof that these change.

- https://www.cancerimagingarchive.net/data-usage-policies-and-restrictions/

---

## 4. Ontologies and identifiers: the unoccupied ground

### 4.1 What each product exposes

| Product | Structure identifiers exposed |
|---|---|
| BioDigital Human | Proprietary opaque strings (`human_09_male_skeletal_system-bones_of_head_ID`, `maleAdult-Frontal_bone_52734`). Note the `09` and the numeric suffix: these are generation-specific and will not survive content revisions. ICD-10 lookup via `findModel(String ICD)` |
| Visible Body | None found |
| Complete Anatomy | None found |
| Primal Pictures | None found |
| Zygote Body | None found |
| Kenhub | None found |
| **BodyParts3D / Anatomography** | **FMA IDs**, under **CC BY 4.0** since 2025-02-27. `FMA13478` is the vertebral column. One canonical URL per ID. Structures with no FMA equivalent carry a `BP` prefix instead, so coverage is high but not total |
| **Z-Anatomy** | **Terminologia Anatomica 2**, ships `TA2.csv` |
| **Open Anatomy Project** | **TA2** via TA2Viewer, plus JSON-LD anchors to external knowledge bases |

**No commercial product in this space exposes a stable, resolvable anatomical identifier.** That is not an oversight on their part; opaque IDs are lock-in. It is the clearest structural opening available to an open project.

### 4.2 Licence status of the identifier systems

| System | Licence | Redistribute | Derivatives | Commercial |
|---|---|---|---|---|
| **FMA** | **CC BY 4.0** | Yes | Yes | Yes |
| **UBERON** | **CC BY 3.0** | Yes | Yes | Yes |
| **RadLex** | RadLex v2.1, royalty-free | Yes | Yes, **but RIDs, names, synonyms and relations must not be changed** | Yes |
| **SNOMED CT full** | Member-country national licence, otherwise paid Affiliate | No | No | Fee-based |
| **SNOMED CT GPS** | **CC BY-ND 4.0** | Unmodified only | **No** | Yes |
| **Terminologia Anatomica TA2** | **CC BY-ND 4.0**. Individual terms are public domain; the terminology as a work is ND | Unaltered PDF only | **No**, needs FIPAT Chair permission | Yes |

Sources: https://github.com/uw-sig/FMA/blob/main/LICENSE, https://obofoundry.org/ontology/uberon.html, https://www.rsna.org/uploadedFiles/RSNA/Content/Informatics/RadLex_License_Agreement_and_Terms_of_Use_V2_Final.pdf, https://www.snomed.org/get-snomed, https://www.snomed.org/gps, https://libraries.dal.ca/Fipat/ta2.html

### 4.3 Recommended identifier strategy

**Primary key: FMA.** It is the only fully permissive, fully derivable anatomical identifier system available, and **BodyParts3D meshes are already named by organ ID**, so the geometry-to-semantics join costs nothing. Two details to get right: DBCLS ships those models as `.obj`, and the `FMA<ID>.stl` naming seen in the wild is the third-party conversion mirror's, not DBCLS's; and IDs begin with `FMA` only where an FMA equivalent exists, otherwise with a `BP` prefix, so the join is high-coverage rather than exhaustive. The corpus itself is **CC BY 4.0** since 2025-02-27, so nothing about this route is share-alike.

**Required cross-reference: UBERON** (CC BY 3.0), which bridges to the wider OBO and biomedical world.

**Optional overlays, shipped as separate files so their terms never enter the core repository:** RadLex for radiology, SNOMED CT for clinical coding, TA2 for nomenclature.

**Do not invent your own IDs.** The moment you do, you have recreated BioDigital's problem for the same reason they have it.

**Two sleeper traps:** SNOMED GPS being ND defeats most practical mapping-table use, because a mapping table *is* a derivative. TA2 being ND means a machine-readable TA2 table is legally uncertain, which is exactly the file Z-Anatomy ships.

*On the GPS specifically, because it is widely reported wrong: https://www.snomed.org/gps states that the GPS "is produced by SNOMED International under the terms of the Creative Commons Attribution-NoDerivatives 4.0 International License" and that it "does not include SNOMED CT's relationships, hierarchies and remaining descriptions". Secondary sources describing it as CC BY 4.0 are stale or mistaken. The missing relationships matter independently of the licence: without them the GPS cannot express `finding site`, so it is unusable for disease-to-anatomy mapping whatever its terms.*

### 4.4 The gap: no standard for semantic IDs on 3D meshes

There is **no established standard for attaching anatomical semantic identifiers to 3D mesh primitives.** This is a genuine hole, verified rather than merely unfound. Current options, none standardised:

- glTF `extras` or a custom `EXT_*` vendor extension carrying FMA and UBERON CURIEs per node or primitive.
- **DICOM SEG** carries SNOMED CT-coded segment descriptions, but it is voxel-space rather than mesh-space, and its coding scheme inherits the SNOMED licence problem.
- OpenUSD custom schemas and primvars, at the authoring tier only.
- BodyParts3D's ID-in-filename convention: `FMA<ID>` on the DBCLS `.obj` models, and `FMA<ID>.stl` on the third-party conversion mirror. Crude, but a working de-facto pattern with real adoption.

**This is a plausible original standards contribution:** a small, versioned glTF extension keyed on FMA IDs with optional UBERON and RadLex cross-references. It is exactly the kind of interoperability artefact the EU Virtual Human Twin agenda is asking for, and it is cheap to specify relative to its citation value.

A related and separable opportunity: **ISCC (ISO 24138:2024)** defines similarity-preserving content identifiers with per-modality algorithms for text, image, audio, video and mixed content. Its Data-Code and Instance-Code work today on any bitstream, so a glTF, an STL or a NIfTI can be given integrity and exact-identity codes immediately. **There is no Content-Code algorithm defined for 3D geometry or volumetric medical data**, which means two glTF exports of the same liver at different decimation levels will not match perceptually. A 3D or mesh Content-Code is an unfilled extension slot in a published ISO standard, and anatomical meshes are a strong motivating case.

- https://iscc.codes/specification/
- https://www.iso.org/standard/77899.html

---

## 5. Product landscape: what the incumbents actually sell

### 5.1 BioDigital Human

**The moat is not geometry.** Anyone can get meshes; BodyParts3D is CC BY 4.0 as of 2025-02-27 and is the ancestor of most open anatomy models. What BioDigital sells is three things: an iframe you can drop into any page, a JavaScript API to drive it, and Human Studio so non-coders can author scenes. Compete with that, not with model quality.

**The free tier was materially degraded in May 2026.** Personal Plus was retired. The free Personal plan is now A&P content only, **10 model views per month, 5 saved models**, and self-service organisational trials were removed entirely, so prospects must talk to sales. Conditions, procedures and treatments content was pulled from the free tier.

- https://support.biodigital.com/hc/en-us/articles/39657133675927-May-2026-Changes-to-Individual-Plans-and-Free-Trials
- https://pricing.biodigital.com/

This is the single biggest market opening in the landscape right now, and it has a shelf life.

**Content scale:** 1,000+ mapped health conditions, 500+ A&P models on the free tier, complete male and female full-body models, claimed 5M+ education users. Distribution runs partly through Wolters Kluwer / Ovid as a "Web and VR Bundle", so their channel is library and reference procurement, not only direct sales.

**The embed model.** Base form is a plain iframe:

```html
<iframe id="myWidget"
  src="https://human.biodigital.com/widget?id=production/maleAdult/male_system_anatomy_skeletal_09&ui-info=false&ui-menu=false">
</iframe>
<script src="https://developer.biodigital.com/builds/api/human-api-3.0.0.min.js"></script>
```

Confirmed parameters: `m=` (legacy scene id), `id=` (content path), `dk=` (developer key, **domain-locked**), `ui-info`, `ui-menu`, `ui-tools`, `ui-panel`, `pre`. The public list is incomplete because the developer portal is login-gated.

**The API shifted generations, and the new one is worth copying.** v1 used property namespaces (`human.camera.flyTo(...)`, `human.annotations.create(...)`). v3 uses a message bus:

```js
var human = new HumanAPI("myWidget");
human.send("camera.set", { objectId: "human_09_male_skeletal_system-bones_of_head_ID", animate: true });
human.send("camera.orbit", { yaw: 0.4 });
```

`send("<module>.<verb>", params)` over postMessage is a clean RPC design. It makes the iframe boundary explicit and makes the entire API trivially serialisable, and therefore trivially recordable, replayable and URL-encodable. Their SDK also exposes runtime-introspectable `apiFunctions` and `apiEvents` arrays, which makes the API self-documenting and lets embedders feature-detect across versions.

**Architecture, from a BioDigital engineer's own talk:** artists author in Maya and ZBrush, an export tool converts to binary mesh arrays plus shader materials, rendered by an in-house WebGL engine, assets served from BioDigital servers, third-party sites embed via iframe, cross-origin control via `postMessage`. Explicitly called-out constraints: mobile GPU and memory limits, shader precision variance, and **a maximum of 8 texture units on some platforms**.

- http://tsherif.github.io/upenn-biodigital/
- https://developer.biodigital.com/pages/documentation/1/getting-started/intro.html

**Human Studio** is the under-appreciated piece: hide, fade and emphasise structures; a paint tool for colouring; interactive labels in sequential, circular or floating layouts; rich text with links; audio via text-to-speech or upload; video and GIF embedding; **virtual tours as interactive multi-step journeys** through systems, disease progression or treatment paths; a quiz builder; distribution via sharing links and embeds.

- https://www.biodigital.com/product/human-studio

**BioDigital VR** is, by inference, a native Meta Quest application rather than WebXR. This is not established: the Meta Store presence strongly implies native, but the product page does not say so and nothing was found that confirms it either way. It is listed as an open uncertainty in section 11. If they have not shipped WebXR, that is a direct opening for `open-twin-xr`, which is exactly why the inference should not be treated as settled.

### 5.2 The rest of the field

| Product | Interaction model | Licensing | The one thing worth taking |
|---|---|---|---|
| **Visible Body** | 3D dissection, cross-sections, animations, quizzes, AR. Cengage-owned | Institutional site licences, 1,000+ schools | **Courseware**: assignable, gradable content with LMS SSO and progress tracking. The content is the product but *assignability* is the sale |
| **Complete Anatomy** (3D4Medical / Elsevier) | Dynamic cross-sections, radiology overlay, muscle motion simulation, AR, 1,500+ videos | Student / Professional / Institutional, heavy discounting | **Dynamic Cross Sections**: an arbitrary user-placed cutting plane on a full-body model, live, not pre-baked slices. The most-copied premium feature in the field |
| **Primal Pictures** (anatomy.tv) | Layered peel-away over imaging-derived anatomy | Informa, institutional | The layer-slider dissection metaphor: continuous depth scrub rather than discrete show and hide |
| **Zygote Body** | Opacity slider peel from skin to muscle to skeleton, WebGL. Descendant of Google Body | Free viewer; mesh licences are expensive and commercial | **The opacity slider as primary navigation.** One control, whole-body depth traversal. Cheapest-to-build high-impact interaction in the entire field |
| **Kenhub** | Not primarily 3D. Atlas illustrations plus a spaced-repetition quiz engine | Subscription | The **quiz-first funnel**. Their retention comes from adaptive testing, not rendering |
| **Anatomyka** | Freemium 3D atlas, deliberately light | Freemium | Small model budget so it loads on cheap phones. A useful low-end target reference |
| **3D Organon** | 15 body systems openable **simultaneously**, Body Actions animation library, slicing, 500+ USMLE-style questions, VR ultrasound sim, **Medverse** multi-user, AI study assistant | **Guest mode: 2 hours unrestricted, then feature-limited** | That guest mode. Far better first-run UX than a monthly view counter, and a direct contrast with BioDigital's new 10-views-per-month free tier |
| **Medicalholodeck** | DICOM to 3D, AI auto-segmentation, cadaver-derived Dissection Master, **RecordXR**, **TeamXR** | Commercial. States plainly it is **"not a certified medical device"** | **RecordXR**: recording and replaying an XR session as a shareable artefact. The XR analogue of a permalink, and almost nobody does it |
| **Elucis** (Realize Medical) | VR medical image segmentation and mesh editing | Commercial | The only serious "create, do not just view" XR tool in the space |
| **Open Anatomy Project / OABrowser** | Linked 2D slice and 3D views, structure tree, transparency, search, **bookmarks as shareable URLs**, **live shared views** | **3D Slicer License** (BSD-style, commercial use permitted) | See 6.1. This, not BioDigital, is the architecture to copy |
| **BodyParts3D / Anatomography** | FMA IS-A and HAS-PART hierarchy navigation, system filters, **X/Y/Z clipping planes with numeric distances**, "Import map URL" | **CC BY 4.0** since 2025-02-27 (previously CC BY-SA 2.1 JP) | **One canonical URL per FMA ID.** A 2009-era design that still has the most semantically sound deep-linking in the field |
| **Human Protein Atlas** | Nine sub-atlases, multiplex imagery, 3D protein structures | Open access | **Every entity page is a stable citable URL with a bulk-download twin.** The browse-or-download-all duality is the open-science UX contract |
| **XR Anatomy** | 3D web viewer plus native iOS AR plus native Quest MR | **CC BY-NC-ND 4.0** | A negative lesson. NC-ND makes it unforkable and therefore dead as infrastructure |
| **Sharecare YOU** | Full-body VR explorer, BioVisions rendering lineage | Free consumer | Historically the most beautiful physiology rendering in the space. **Appears dormant.** A cautionary tale about consumer VR anatomy as a business |
| **Siemens Cinematic Reality** (Vision Pro) | Path-traced volume rendering from real patient DICOM | Commercial | **Photorealism as a credibility signal.** The opposite of the plastic look every atlas has |
| **Dassault Living Heart / Living Brain** | FEA simulation, not an atlas. Parametric whole-heart with adjustable tissue properties | Consortium membership | 2025 phase generates **thousands of synthetic virtual patients** to train AI without human subjects or privacy constraints. ENRICHMENT Playbook published after FDA collaboration |

### 5.3 Learning outcomes: the honest version

Best current synthesis is Salimi et al., *Anatomical Sciences Education* (2024), a systematic review and meta-analysis of **24 randomised controlled trials**:

- **VR: SMD 0.58 on knowledge scores, p < 0.01.** A moderate effect.
- **AR: no significant effect on knowledge, p = 0.90.**
- **No significant difference on enjoyment or ease of use**, which is worth noting because engagement is the usual marketing claim.
- **I² = 87.44%**, very high heterogeneity. Subgroup analyses and meta-regression were all non-significant, meaning the authors **could not identify what makes VR work when it works**, and they say so.

- https://pubmed.ncbi.nlm.nih.gov/39300601/
- https://anatomypubs.onlinelibrary.wiley.com/doi/10.1002/ase.2501

Complicating evidence: an AR-in-anatomy systematic review reports positive findings, in tension with the null AR result above (https://www.nature.com/articles/s41598-021-94721-4). Studies across the board are small, short, mostly single-institution, mostly immediate post-test with little retention data, and blinding is impossible. There is a strong novelty-effect confound nobody has adequately controlled.

**What an open-science foundation should do with this:** publish the SMD, the I² and the AR null result openly. Doing so buys more credibility than quoting "VR improves learning outcomes" and it differentiates OpenTwin from every commercial vendor's marketing page. Better still, instrument the platform so it can *contribute* evidence through opt-in, ethics-approved, pre-registered studies. The field's largest gap is not another app, it is adequately powered multi-site trials with retention endpoints, and a foundation with a physical research institute is unusually well placed to run one.

---

## 6. Interaction patterns worth adopting

### 6.1 Deep linking and shareable state

Three patterns exist in the wild, and they are not equally good.

**(a) BioDigital: opaque content ID plus chrome flags.** The `id` addresses an *authored scene*, not a computed state. You cannot URL-encode "camera at these angles with these twelve structures hidden and this annotation open." Runtime state is driven only through the API after load. Practical consequence: **a BioDigital link points at someone's saved scene, not at what you are currently looking at.** Combined with the domain-locked developer key, links are also non-portable across sites.

**(b) BodyParts3D / Anatomography: one URL per ontology term.** The vertebral column is `FMA13478`. Plus an exhaustive parameter set covering window size, background colour, **X/Y/Z clipping plane coordinates and distances**, volume filter thresholds, representation type, per-part visibility, surface/wireframe/points, and auto-rotate angle and interval. This is a 2009 design and it is still the most semantically sound deep-linking in the field.

**(c) Open Anatomy Browser: immutable state snapshots with UUIDs.** Every interaction produces a new immutable state object, centrally identified by UUID, held in memory or Firebase, and **URLs encode enough to fully restore a session**. On top of that, Dynamic Shared Views give real-time multi-user sync.

- https://www.frontiersin.org/journals/neuroinformatics/articles/10.3389/fninf.2017.00022/full

**Synthesised recommendation: a two-layer URL contract.**

- **Layer 1, semantic and human-writable:** `/s/FMA7148` or `/s/UBERON:0002107` resolves to "liver, sensible default camera." Survives refactoring. This is the link people paste.
- **Layer 2, complete and machine-generated:** a compact versioned state token (`?v=1&st=<base64url>`) round-tripping camera, visibility set, clip plane, annotation set and tour position. Restores exactly, survives nothing else.

Ship both. Make the semantic one the default in the share dialog.

Then three cheap additions nobody in the field has made:

1. **Adopt BioDigital's `ui-*` convention** (`ui-menu=false&ui-info=false&ui-tools=false&ui-panel=false`, plus `ui-xr=false`). Guessable, costs nothing, immediately familiar to anyone who has embedded BioDigital.
2. **Free the embed entirely.** No developer key, no registration, no domain allowlist. That alone is a category difference from every commercial option, and it is what gets OpenTwin into Wikipedia, OER textbooks and lecture slides, which *is* the distribution strategy for a foundation with no marketing budget.
3. **Ship an oEmbed endpoint and an Open Graph image renderer.** Nobody in this field does it. A pasted link that unfurls into a rendered thumbnail of *that exact view* in Slack, Discord, Notion or Mastodon is disproportionately valuable.

### 6.2 Annotation

BioDigital's model is the right one: annotations are **anchored to `objectId`, not to world coordinates**, so they survive camera changes and some scene changes. Two creation paths, user click-to-annotate and programmatic.

**Diverge on one point.** Their auto-generated IDs (`__a0`, `__a1`) are useless for versioning and merging. Use content-addressed or user-namespaced IDs so annotations can live in git and be submitted as pull requests. **An anatomy platform whose annotations are a diffable text file is a genuinely new thing**, and it is a natural fit for a foundation whose value proposition is open collaboration.

### 6.3 Dissection and cross-section

Three metaphors exist: discrete show/hide with a structure tree (BioDigital, Z-Anatomy), the continuous opacity or depth slider (Zygote Body, inherited from Google Body), and layer-slide over imaging-derived anatomy (Primal).

**Lead with the continuous slider and keep the structure tree as the power path.** Most products get this backwards and lead with the tree, which is a wall of Latin for a first-time user.

For cross-sections, Complete Anatomy's arbitrary live user-placed plane is the premium benchmark. But the pattern actually worth stealing is Anatomography's: **make the clip plane part of shareable state, with numeric values.** They proved this in 2009 and everyone since has made the plane an ephemeral UI gesture. "Here is the exact axial cut I mean" is a teaching primitive, and it is nearly free once the state token from 6.1 exists.

### 6.4 Search

Anatomography's IS-A and HAS-PART navigation over FMA is the only genuinely *structured* search in the field. Everything else is string matching over display names. BioDigital's only semantic hook is `findModel(ICD)`, which is clinically framed rather than anatomically.

Adopt FMA and UBERON part-of graph traversal as a first-class UI affordance ("show everything that is part of the mediastinum"). Then add what nobody has: search by ICD-10 **and** by anatomical term **and** by synonym or eponym **and** by non-English term, all resolving to the same structure ID. For a Swiss foundation, multilingual resolution (German, French, Italian, Latin) is both a natural fit and a genuine differentiator, since the commercial products are overwhelmingly English-first.

---

## 7. WebXR: hard constraints and what actually fails

### 7.1 Platform constraints that are not optional

From the WebXR Device API specification and MDN:

- **`navigator.xr` does not exist outside a secure context.** HTTPS or `http://localhost` only. Both document and script must load securely.
- **`requestSession()` must be called from a user event handler** (transient activation). Auto-entry is impossible by design.
- **`immersive-vr` requires the `xr-spatial-tracking` permission policy.** This means **an embedded `open-twin-xr` iframe will silently fail unless the embedding page sets `allow="xr-spatial-tracking"` on the iframe.** This is the single most common real-world WebXR embed failure and it produces no useful error.
- Gate on `await navigator.xr.isSessionSupported("immersive-vr")` and fall back to `inline`.
- Reference spaces: for immersive sessions, **`viewer` and `local` are both default-required** by the WebXR Device API, so neither has to be requested and both can be relied on (`viewer` alone is default-required for inline sessions). `local-floor`, `bounded-floor` and `unbounded` must be requested and are not guaranteed. **Requesting `unbounded` in `requiredFeatures` hard-fails on most standalone headsets.** Put ambitious spaces in `optionalFeatures` and degrade.

- https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API/Startup_and_shutdown

### 7.2 Hand tracking versus controllers: what the evidence says

Randomised between-subjects study, 30 VR-experienced postgraduates aged 22 to 56, four mini-games spanning gross and fine motor tasks: **no significant difference in interaction time across most tasks.** Controllers won only on basketball shooting (p = 0.04). Hand tracking scored descriptively higher on enjoyment (4.63 vs 4.41) and on perceived control (4.10 vs 3.83); no per-subscale significance test was reported for either. The reported satisfaction statistic is the **overall USEQ comparison, which was null: U = 110.5, p = 0.94.** Behaviourally, hand-tracking users explored more; controller users optimised for speed.

- https://link.springer.com/article/10.1007/s10055-026-01333-2

**Hand tracking is not a performance win, it is an exploration and comfort win.** For an anatomy explorer, where exploration *is* the task, that argues for hand tracking as the default. But ship controller parity, because tracking dropout on occluded and overlapping hands is real, and that is precisely what happens when both hands converge on a small organ. BioDigital's own onboarding says as much: they recommend controllers and tell users to complete the controller tutorial before attempting hand tracking.

### 7.3 BioDigital's XR interaction vocabulary, worth copying

- Reposition: hold trigger on either controller and drag. Hand equivalent: point and pinch.
- Scale: hold trigger on **both** controllers and move hands together or apart. Hand equivalent: bimanual pinch and drag apart. **Every XR anatomy product converges on bimanual scale.** It is the one universal gesture.
- Panel toggle: `B` on the right controller hides and shows the interaction panel. A dedicated hardware button to banish UI is under-appreciated and cheap.
- Five explicit modes: **Select** (pop-up label), **Hide** (layer-by-layer virtual dissection), **Move** (isolate and reposition), **Label** (multi-structure labelling for comparison), **Region Toggle** (remove skin, manipulate groups).
- **No teleportation, no ray-based locomotion documented.** The model is seated or standing and object-manipulation-centric: you move the body, not yourself.

- https://support.biodigital.com/hc/en-us/articles/23146768396311-How-to-interact-in-BioDigital-VR

### 7.4 The strongest single XR recommendation: do not build locomotion

Every serious anatomy XR product converges on a stationary object-manipulation paradigm. Locomotion is the primary cybersickness vector and an anatomy atlas has no reason to move the user. If scale changes are needed, use bimanual scale, not walking.

### 7.5 What actually fails in practice

1. Missing `allow="xr-spatial-tracking"` on the embedding iframe. Silent failure.
2. Non-HTTPS development or staging. `navigator.xr` is undefined, which reads to the developer as "no headset connected."
3. Auto-entry attempts without transient activation. Rejected promise, usually swallowed.
4. Over-broad `requiredFeatures`. The session request fails wholesale instead of degrading.
5. Memory and draw-call budget. BioDigital's engineer flagged a maximum of 8 texture units on some mobile GPUs, and standalone headsets *are* mobile GPUs. The bar to benchmark against is 3D Organon's claim of all 15 body systems loaded simultaneously with no load time on Vision Pro, which is a statement about aggressive LOD, instancing and texture atlasing, not about geometry fidelity.
6. **Transparency is the frame-rate cliff.** The opacity-slider dissection metaphor from 6.3 is expensive in XR because of sorted alpha and overdraw. Use dithered or stochastic transparency in the XR build rather than true alpha blending.

### 7.6 The differentiating XR moment nobody has built

The desktop viewer should surface an "Enter VR" affordance only after `isSessionSupported` resolves true, and **the current 2D scene state should transfer into the XR session unchanged.** Nobody does this. The state-token design from 6.1 makes it nearly free. "Look at it on your desk, then put on a headset and it is the same view, same hidden structures, same clip plane" is a genuinely differentiating first impression.

---

## 8. Accessibility: unclaimed territory

**No 3D anatomy product, commercial or open, makes a serious accessibility claim.** For an open-science foundation this is both a values fit and a procurement requirement, since public universities in Europe are bound by EN 301 549 and US institutions by Section 508.

Implementable pattern set:

- `aria-roledescription="3d model"` on the container. Without it, screen readers announce "image" or "graphic."
- `role="application"` on the canvas so arrow keys reach your handler instead of triggering screen-reader browse mode.
- Keyboard map: arrows orbit, `+` and `-` zoom, Enter or Space announces the current view, Escape resets.
- **A visible focus ring is mandatory** when the canvas holds keyboard focus.
- **Alt text per anatomical view**, not one alt text for the model. Anterior, posterior, lateral, superior.
- `role="status"` live region announcing zoom level and current structure, with `aria-hidden` toggling to avoid double announcement.
- **WCAG 2.2 pointer-gesture criterion**: gesture-only controls fail. Provide discrete buttons for rotate, zoom and reset.
- Honour `prefers-reduced-motion`: kill auto-rotate, camera fly-to animation and idle animation.
- Tested reality: VoiceOver and NVDA are usable, JAWS and Edge are worse, **iOS ignores canvas elements entirely.** Plan a non-canvas DOM fallback, a fully navigable structure tree carrying the same information, rather than pretending the canvas is accessible.

- https://scottvinkle.com/blogs/work/3d-model-accessibility

---

## 9. Positioning: OpenTwin is not a Virtual Human Twin, and should not claim to be

The word "twin" does very different work in two communities, and the name straddles them.

- **Anatomy atlas** (BioDigital, Visible Body, Complete Anatomy, Z-Anatomy): a canonical, idealised, non-personalised geometric model, for learning and communication. **Not a twin under any definition.**
- **Virtual Human Twin** (EU EDITH definition): "a digital representation of a human health or disease state", spanning cell to organ to organ system, using models and data to mimic and predict the behaviour of a physical counterpart including comorbidity response.
- **Organ-level mechanistic twin** (Dassault Living Heart): FEA simulation.
- **Imaging-derived clinical twin** (Siemens Cinematic Reality, Visible Patient, Medicalholodeck): patient-specific geometry from that patient's DICOM. Closest to the intuitive meaning, and typically **not regulated as a medical device** provided it stays in education, training, research and communication.

**Recommended position: OpenTwin is the open visualisation and interaction layer that Virtual Human Twin work currently lacks.**

Every mechanistic twin project in Europe eventually needs a way to show a clinician or a patient what the model says, and every one of them currently either builds a bespoke unshareable viewer or licenses BioDigital. That is a real, unoccupied and fundable slot, and it maps directly onto the EDITH roadmap's infrastructure agenda without overclaiming.

### 9.1 The ecosystem to align with

- **EDITH CSA**, EU Coordination and Support Action, Digital Europe programme, grant agreement 101083771. Concluded October 2025 with a Roadmap plus a Policy Brief built from 800+ stakeholders. **Roadmap DOI: 10.5281/zenodo.14769224.** Its planned infrastructure is a "federated and cloud-based repository of digital twins (data, models, algorithms, and good practices)" plus a simulation platform for combining single-organ twins. Prototype use cases: cancer, cardiovascular, intensive care, osteoporosis, brain.
  - https://www.edith-csa.eu/roadmap/
  - https://www.virtualhumantwins.eu/
  - https://digital-strategy.ec.europa.eu/en/policies/virtual-human-twins
- **VPH Institute / VPH Society**, 1,000+ members, 40+ institutions, 25 countries. VPH2026 is in Milan, 1 to 4 September. This is the obvious first community to align with, and it is free legitimacy.
  - https://vph-society.org/

**Strategic implication: align the metadata and repository schema with the EDITH federated-repository model early.** It is the most likely EU-level interoperability target and the most likely funding hook.

### 9.2 Regulatory posture, if the project ever moves toward clinical use

- **FDA final guidance**, *Assessing the Credibility of Computational Modeling and Simulation in Medical Device Submissions*, finalised November 2023. https://www.fda.gov/media/175618/download
- **ASME V&V 40** is the underlying risk-informed credibility framework: model risk equals model influence times decision consequence, which then sets the required credibility evidence.
- The EMA position on in-silico trials was **not verified** in this research pass. Do not assert one without checking.

Practical takeaway: design model cards to carry **context of use** and **model risk** fields from day one. Retrofitting credibility documentation is expensive, and it costs almost nothing to include the fields now even if they stay empty.

---

## 10. Naming: there is a collision, and it is not minor

At least two established open-source projects already use this name in the digital twin space.

1. **OPEN TWIN** (opentwin.net, GitHub org `OT-openTwin`), "a free, open-source software platform for managing digital twins in product development", integrating test and measurement data management with simulation. Active as of 2025.
   - https://opentwin.net/
   - https://github.com/OT-openTwin
2. **OpenTwins** (`ertis-research/opentwins`, University of Málaga), "an open-source framework for the development of next-gen compositional digital twins", published in *Computers in Industry* vol. 152 (2023), DOI 10.1016/j.compind.2023.104007. Also mirrored under other accounts.
   - https://github.com/ertis-research/opentwins
   - https://www.sciencedirect.com/science/article/pii/S0166361523001574

Neither is in human anatomy, so there is no direct product confusion. But both are in **digital twins**, both are **open source**, both rank for the obvious searches, and one has a peer-reviewed publication anchoring the name in the academic record. The practical consequences are discoverability (searching "OpenTwin open source" surfaces them, not you), citation ambiguity in any paper the Foundation publishes, and package-namespace collisions if either ever publishes to npm or PyPI under that name.

This is worth a deliberate decision now rather than a forced one later. Options range from doing nothing (accept the ambiguity, differentiate through domain and visual identity), through consistent qualified use in all academic and package contexts (for example "OpenTwin Human" or "OpenTwin Anatomy" as the citable name, with `opentwin-human` as any package namespace), to a rename. A trademark search in the relevant Nice classes would be a cheap input to that decision. Note also that `opentwin.ch` currently has a TLS configuration problem: fetching it fails with `TLSV1_ALERT_INTERNAL_ERROR` on the robots.txt request, which is worth checking independently since it affects crawlability and therefore discoverability.

---

## 11. Open uncertainties

Listed so that nothing above is mistaken for settled.

1. **BioDigital's full URL parameter and API method reference is not publicly accessible.** The developer portal returns only a sign-in shell to anonymous requests. Specifically unconfirmed: method names for object show/hide, dissect, isolate, x-ray and cross-section, and the complete `ui-*` list. Registering a free developer app would resolve this.
2. **Whether BioDigital's runtime scene state is URL-encodable at all.** Only content-ID addressing was found.
3. **Whether BioDigital VR is native or WebXR.** Meta Store presence strongly implies native; the product page does not say. This matters directly to `open-twin-xr`'s positioning.
4. **The Z-Anatomy licence conflict** (CC BY-SA 4.0 on GitHub vs CC BY 4.0 on Zenodo) is still open. The upstream compatibility question that used to sit alongside it is not: BodyParts3D is CC BY 4.0 as of 2025-02-27, so nothing share-alike propagates from it and Z-Anatomy's BY-SA is its authors' own choice. What remains unresolved is which Z-Anatomy licence governs, and separately whether DBCLS will confirm the relicence in writing, since several upstream pages still say share-alike. The first needs legal review, not a web search; the second needs an email to DBCLS.
5. **AMOS dataset licence.** The challenge page states no licence at all.
6. **AbdomenAtlas 1.1Mini** returns HTTP 401 on Hugging Face. Gated.
7. **CellML specification, Physiome Model Repository per-model licences, OpenCOR, SBML, FieldML.** None surfaced licence terms on their own pages. The physiology layer is culturally open but legally under-documented; budget for per-model licence review.
8. **ICRP, UF/NCI, XCAT and IT'IS phantoms.** All four required "contact us"; none publish machine-readable terms.
9. **EMA position on in-silico trials.** Not verified. The FDA side is solid.
10. **TotalSegmentator MR dataset licence, FLARE23, MONAI Label licence, Meshopt / VTK.js / itk-wasm licences.** Expected values stated above but not re-verified in this pass.
11. **TCIA per-collection licences.** No licence column, no filter. Must be checked one collection at a time.
12. **Open Anatomy Project activity level.** The site claims active development, but `openanatomy.org/atlases/` currently returns a redirect loop. Verify via commit activity on `PerkLab/SlicerOpenAnatomy` before depending on it.
13. **Anatomography maintenance status.** No deprecation notice found, but the interface is 2009-era.
14. **Sharecare YOU status.** Distribution via SideQuest and App Lab with no recent signal. Probably dormant, not verified as discontinued.
15. **How far verification actually got.** Verification of the regulatory quotations, effect sizes and study figures in this document is **known to be incomplete**. A sample was re-checked against primary sources and that sample turned up real errors, all now corrected: the BodyParts3D licence (CC BY 4.0 since 2025-02-27, not CC BY-SA 2.1 Japan), the MakeHuman AGPL-3.0 versus MPFB2 GPL-3.0 split, `.obj` rather than `.stl` as the DBCLS distribution format, the attribution of p = 0.94 to the overall USEQ comparison rather than to per-subscale tests, and the status of the `local` WebXR reference space. **The remainder was not re-checked.** The errors that were found are of a kind that plausibly recurs in the unchecked material, so treat any figure or quotation not explicitly marked as verified as provisional, and confirm it against the primary source before quoting it externally, in a grant application or in a paper.
