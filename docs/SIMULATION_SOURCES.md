# A body that does something

Sources and mechanisms for three capabilities this repo does not have: **drug
biodistribution**, a **beating heart**, and **musculoskeletal movement with the
forces named**. Written 28 July 2026, prompted by
`docs/GEOMETRY_SOURCES_SURVEY.md`, which covers static geometry and stops there.

All three are out of scope for the current milestone — the definition of done in
`CLAUDE.md` is the body, and `docs/ROADMAP.md` Phases 1–7 do not include motion.
This document exists so that when they are in scope, the architectural question
is already answered and the sourcing is already verified.

---

## The finding that matters most: two of the three are one feature

Before any sourcing question, there is a structural one, and it collapses most of
the work.

**Drug concentration per organ over time and muscle force per structure over time
are the same data shape**: a scalar per structure, indexed by time. So they are
the same rendering feature, and it is a feature this repo is already most of the
way to building.

Phase 1 shipped `_STRUCTURE`, a per-vertex `uint16` naming which structure each
vertex belongs to, with a side table in the glTF `extras`. Phase 4 then plans to
put **structure centroids in a `DataTexture` indexed by `_STRUCTURE`** and read it
in the vertex shader via `onBeforeCompile`, to make the exploded view act per
structure instead of per merged group.

That `_STRUCTURE`-indexed `DataTexture` is the whole mechanism. Once it exists:

| Put in the texture | Read it in | Get |
|---|---|---|
| structure centroid | vertex shader | per-structure explode — ROADMAP Phase 4 |
| a scalar per structure | fragment shader | **organ coloured by drug concentration** |
| a scalar per structure | fragment shader | **muscle coloured by force or activation** |
| a rigid transform per structure | vertex shader | **skeletal motion, see below** |

So the honest cost of biodistribution is not "build a biodistribution feature". It
is "build Phase 4's texture, then supply a different array into it, plus a time
slider and a colour ramp". The data itself is kilobytes: a compartment model emits
one number per organ per timestep.

**And the same trick gives skeletal motion without a rig.** Rigging 2,077
structures is not an afternoon's work, and skinning weights are the reason it
would not be. But **bones are rigid bodies** — bone motion is not deformation, it
is one rigid transform per bone — and the atlas already knows which structures are
bones: `build-z-anatomy.mjs` tags every structure with `layer: 'bone' | 'muscle' |
'connective'`, and `Joints100.fbx` is imported, so joint geometry is present too.
A `_STRUCTURE`-indexed texture of per-bone matrices, applied in the vertex shader,
moves the skeleton with **no skinning weights, no rig and no extra draw calls**.
Muscles deform and are genuinely harder. Bones are not.

The remaining problem there is registration, but a much smaller one than usual:
joint *centres*, not whole meshes. A kinematic source describes rotations about
its own joint centres in its own skeleton, and those centres have to be located in
the atlas's frame. That is a handful of landmarks, not a Dice score.

---

## The honesty constraint, which is stricter here than for geometry

Geometry is a depiction and everyone reads it as one. A number on an organ is a
claim, and this project has a hard rule against fabricating those:
`assertTwinMetrics()` requires missing data to be `hasData: false, score: null`
and render as "no data" — never zero, never a midpoint.

Everything in this document produces **simulation output, not measurement.** A
PBPK concentration is a model's prediction for a reference body; a muscle force
from inverse dynamics is an estimate from an optimisation with a cost function
somebody chose. Both are legitimate and neither is an observation of the viewer.
Three consequences, and they are not optional:

1. **Name the model and its parameters wherever the number is shown**, the way
   `@open-twin/fhir-core`'s `referenceRange.ts` requires a source URL and a
   publisher for every reference interval.
2. **Lumped compartments must not be drawn as anatomy they do not represent.** A
   PBPK model has one "muscle" compartment and one "rest of body"; the atlas has
   hundreds of named muscles. Colouring all of them from one number implies a
   spatial resolution the model does not have. Either render at the compartment's
   own granularity or state the aggregation.
3. **"Rest of body" is `hasData: false`.** It is the exact case the existing rule
   was written for.

---

## How much of the below is verified

Everything stated as a licence here was read from the primary artefact on
**28 July 2026** — a `LICENSE` file over the GitHub or GitLab API, or a project's
own licence page — not from a search result. Where I could not reach the primary
source, the row says so rather than repeating a secondary claim. That distinction
is the whole point of D2: the stale licence is always the easier one to find.

**Verified from the primary artefact:** OpenSim and its per-model SimTK licences,
Moco, SCONE, OpenCap, FEBio, Chaste, AddBiomechanics, VIVA+, PIPER, Open Knee(s),
SKEL, AMASS, the motion-capture datasets, openCARP, the cardiac mesh cohorts,
`biv-me`, the Sunnybrook models, SlicerHeart, ACDC, MMWHS, and PK-Sim. Several
were confirmed by downloading and parsing the files, not by reading the landing
page — which is how both of §2's working artefacts were found and how three
plausible-looking ones were eliminated.

**Also verified, in §1:** BioModels including per-model ontology annotation resolved
against EBI OLS4, PK-Sim and its physiology database, httk, OpenDose, OpenDose3D,
MIRDcalc, QUADRA_HC and autoPET. **The ICRP 89 question is answered** — openly
licensed machine-readable reference physiology exists in two places.

**Not verified:** IDAC-Dose 2.1 and OLINDA/EXM, and a full sweep of TCIA's
PET-modality collections. The remaining ones are region-limited rather than
whole-body, so they fail on coverage regardless of licence. ICRP's own formal reuse
terms remain unread — treat that as "no open licence found", not as a quoted
prohibition.

---

## 1. Drug biodistribution

The visualisation is per-organ concentration over time, which is the easy data
shape above. The work is not rendering, it is the join: a whole-body PBPK model
carries on the order of 15 lumped compartments — liver, kidney, gut, muscle,
adipose, bone, brain, heart, lung, skin, spleen, plasma, rest of body — against
the atlas's thousands of structures. That is the Phase 5 crosswalk problem at a
granularity where it is genuinely tractable, because fifteen mappings can be
written by hand and reviewed.

And there is a structural reason the measured side is thin, worth stating before
the table: **you cannot serially biopsy organs.** Per-organ concentration over time
in a living human is not measurable by any ordinary means, so openly licensed
*measured* per-organ time series barely exists. Dynamic total-body PET could supply
it and is not openly released. Everything time-resolved below is therefore a model.

| Source | What it is | Licence | Standing |
|---|---|---|---|
| **BioModels** `BIOMD0000001028` / `1029` | Zake et al. metformin whole-body PBPK, human. SBML L3V1, 35 reactions all with kinetic laws, 94 parameters, one dose event — genuinely simulable. | **CC0 1.0** | **The find of this section, and it is a zero-friction join.** All 21 compartments are annotated with `bqbiol:is` — 15 UBERON, 4 NCIT, 2 BTO — including `UBERON:0002107` for liver, which is **the exact identifier form `AtlasBody.tsx` already normalises.** Eight are mesh-mappable whole organs: liver, heart, muscle, brain, adipose tissue, lung, portal vein, stomach. Integrate offline, emit `{ uberonId, t[], c[] }`, and colour eight organs with no licence friction at all. Limitation to state plainly in the UI: **one drug, and it is a model.** |
| **BioModels** generally | ~3,611 models, 1,096 manually curated | **CC0 1.0** | ⚠️ **Ontology annotation is a per-model lottery and curation does not predict it.** Of nine models checked: two human metformin models 21/21 annotated, one mouse model 20/20, but another mouse model 0/20, Sluka's acetaminophen PBPK 0/9, and a third 0/1. Several König models score as annotated only via the generic `SBO:0000290` "physical compartment", which is no anatomical ontology at all. Check each model, never the collection. Also: the CC0 paper trail is broken — the licensing page redirects to a login wall and per-model JSON reports `license: None`, so the citable statement is the 2015 BioModels paper rather than the site. |
| **PK-Sim** (Open Systems Pharmacology) | The open whole-body PBPK simulator | **GPL-2.0 with a "clarifying addendum"** | Runs as a separate application whose *output* we consume, so the MIT code is untouched. ⚠️ **OSPSuite-R is Windows and Linux only — no macOS**, needing rSharp and .NET 8. Output shape is good: one column per path like `Organism|Liver|A`, so the organ is path segment 2. |
| **`PKSimDB.sqlite`** — PK-Sim's physiology database | **This answers the ICRP 89 question.** 39,077 rows, of which 24,491 are human organ volumes and specific blood-flow rates, stratified by age, sex and population (`European_ICRP_2002`, three NHANES cohorts, Japanese, Asian, Preterm, Pregnant), with **both sexes for all but Pregnant**. 18 organs with mean, standard deviation and distribution type — muscle 32.34 L, fat 14.87, liver 2.36, brain 1.51, gonads 0.040. | **GPL-2.0 — it inherits, it is not separately licensed**, being a 30.7 MB file inside the GPL repo at `src/Db/PKSimDB.sqlite` | So openly licensed machine-readable ICRP 89 reference physiology **does** exist, which the survey's ICRP row implies it does not. Two defects recorded: there are **no ontology columns anywhere** in the schema, organs being free-text CamelCase; and the DOI attached to its own ICRP 89 citation resolves to **Publication 23 (1979)** instead. |
| **httk** (US EPA) | `tissue.data`: 406 rows, tidy long format, volume, flow, density and composition per tissue, derived from ICRP. PBTK model exposing gut, liver, kidney, lung, arterial, venous, rest and plasma over time. | **MIT + file LICENSE** (CRAN 2.7.4) | **The easiest thing here to actually run**: pure R and C, no .NET, works on this machine today. Coarser than PK-Sim's 18 organs, and the better choice for the physiology substrate unless the age and sex stratification is needed. |
| **QUADRA_HC** | **135-tissue per-organ SUV table** as XLSX, sex-stratified, mean ± standard deviation over 48 healthy controls, alongside SUV-normalised PET and **MOOSE** masks | **CC BY 4.0** | **The best genuinely measured per-organ data found.** Per-organ scalars are the easy case — no segmentation, no voxel resampling. ⚠️ **Static**: 62 minutes of listmode were acquired and only the 57–62 minute frame released. Cost is a 135-row free-text-to-UBERON crosswalk, reusable because MOOSE naming is a de-facto standard. |
| **OpenDose** | Specific absorbed fractions and S-values for the ICRP 110 adult male and female phantoms — 141 source regions, 172 targets, 1,252 radionuclides | **CC BY-SA 4.0** — ⚠️ **and the same page adds "educational and research purposes only"**, a field-of-use restriction bolted onto a licence that forbids exactly that. Worth one email rather than a guess. | **It is bulk-downloadable, contrary to what a first pass concluded.** An async export on the SAFs page (`POST /safs/request-download/`, poll, then fetch) produces an **87.6 MB zip: 1,348 TSVs, 231 MB uncompressed, ~20.6 million values** — 167 and 168 source regions for the two phantoms, 169 targets each, across 91 energy points from 5 keV to 10 MeV. Confirmed by running it end to end; generation takes about 6½ minutes. **Do not sweep the S-value pages instead**: each query is ~7 s and 3.79 MB, of which 3.62 MB is inlined plotting library and the server sends no compression, so a full sweep would be roughly 29 days and 1.3 TB. Take the zip and derive S-values locally. |
| OpenDose, the caveats | | | Four, and they compound. **The export is SAFs only, not S-values** — S-values are derived from them using ICRP 107 decay data. **Electrons and photons only, no alphas.** **The numeric region id is deliberately commented out of the delivered HTML**, so the only join key is a free-text name, and the names mix two colliding conventions (ICRP-110 elementary regions against OpenDose compound ones) and contain at least one live typo, `LBreast-a + LBresat-g` — so pin the version, because an upstream typo fix silently breaks a name-keyed join. And **there is no Zenodo or DOI deposit**: this is one university host whose certificate expired on 3 April 2026, which is why it refused connections earlier in this session. Vendor the zip with a retrieval date; never fetch at build time. |
| **MIRDcalc's S-value database** | 1,224 radionuclides × **12 ICRP phantoms — both sexes at newborn, 1, 5, 10, 15 and adult** | **No licence, inheriting the site's non-commercial footer** | Recorded because the age coverage is far better than OpenDose's two adults, and because two extraction routes are ungated: a ~548 MB CSV archive at a direct URL needing no login, and an unscrambled on-disk database since v1.23. Also a correction worth having: **MIRDcalc has no FDA author** — copyright is asserted by Memorial Sloan Kettering and the University of Florida, so the US-government public-domain provision does not apply to it. |
| **autoPET** | PET/CT corpus | **Fails twice**: CC BY-**NC** on the challenge copy, and the TCIA copy is now under NIH Controlled/Limited access | Rejected. A newer find is cleaner but does not help: **TCIA PSMA-PET-CT-Lesions is CC BY 4.0 and public** — de-faced, which is presumably why it could be released openly — but it carries **lesion masks only, no organ masks**. |
| **MIRDcalc** | The reference dosimetry tool, actively developed | **Non-commercial *and* no-derivatives *and* no redistribution**, verbatim | The cautionary example. Its own December 2025 announcement claims the revised terms "incorporate elements similar to the MIT License"; the operative text says the software "may not be reproduced, distributed, altered, or used in any manner beyond your own personal and noncommercial use". Believe the terms, not the announcement. Its authors also concede embedding third-party copyrighted material under a fair-use theory, which corroborates that ICRP data has no clean open path. |

**Open dynamic whole-body PET with per-organ time series does not exist.** UDPET
requires a signed data-transfer agreement, DEEP-PSMA is CC BY-NC, the Lu-177
DOTATATE organ volumes of interest are CC BY-NC, and OpenNeuro's PET is CC0 but
brain-only. That is the gap that keeps this feature a simulation.

**One licence note worth a `DECISIONS.md` entry.** Extracting numeric reference
values from `PKSimDB.sqlite` into our own file neither contains nor links GPL
software, so the MIT code is unaffected — but **redistributing the SQLite file
verbatim would carry GPL-2.0**. Facts are not copyrightable; a compilation of them
may still attract EU database rights. The OpenDose share-alike-versus-"research
only" conflict deserves the same treatment.

### ⚠️ The dosimetry pipeline splits open from closed, and the split is structural

If the goal is ever *dose* rather than concentration, this is the finding that
decides it. Absorbed dose needs two halves multiplied together:

- **The physics half is open.** Specific absorbed fractions and S-values — how
  energy emitted in one organ deposits in another — are OpenDose's own Monte Carlo
  output under CC BY-SA 4.0, and 20.6 million of them download in one 87.6 MB zip.
- **The biokinetics half is not.** Converting an S-value into a real dose needs
  time-integrated activity coefficients per radiopharmaceutical, which is **ICRP
  Publication 128** — and **no open machine-readable version of it exists
  anywhere.** Verified as a negative across ICRP's own site, its Electronic Annex
  programme (which covers Publications 130, 134, 137, 141, 151, 158, 116, 144 and
  136 — but not 128 and not 133), Zenodo, figshare and GitHub. The only
  machine-readable copy found is inside MIRDcalc, behind registration, unlicensed,
  and modified.

**So an end-to-end open radiopharmaceutical dosimetry pipeline is not currently
possible from open data alone**, and it is not a licence that could be negotiated
around one dataset — it is a missing artefact.

**And this settles the ICRP question generally.** ICRP states, verbatim on its own
site: *"ICRP retains copyrights on all its publications; even free to access
publications require permission for reuse"*, with permission judged case by case
and possibly conditioned. That is a bespoke permission regime, not a licence — so
free-to-read ICRP material is not open, and the only licence ICRP and its publisher
ever registered is a text-and-data-mining one, which does not carry redistribution.
It also answers the ICRP 145 mesh-phantom question left open in
`docs/GEOMETRY_SOURCES_SURVEY.md` §V: **ask, do not assume.** One practical route
around the decay-data corner: substitute public-domain NNDC/ENSDF data for ICRP
107 rather than inheriting ICRP's terms.

**The honest framing for this feature.** A PBPK curve is a prediction for a
reference body from a model with chosen parameters, and this project's whole
posture is that a rendered number carries a claim. Presenting a simulated hepatic
concentration on an organ mesh, next to a real person's health data, would imply a
measurement of them that does not exist. Either fence it as an explicitly
labelled pharmacology demonstration on the reference body, or do not build it. It
is a genuinely good demonstration of what the `_STRUCTURE` architecture can do; it
is not a feature of somebody's twin.

## 2. A beating heart

**A redistributable, openly licensed, time-resolved cardiac mesh sequence exists.
Two of them do.** Both were found by looking past the cardiac-simulation
literature, and both were confirmed by downloading and parsing the files rather
than reading the landing page. This inverts the expected conclusion: the
pragmatic-looking option — animate a static mesh from published population
averages — is the **worse** choice, not the fallback, because real measured motion
is available under CC0 and Apache-2.0.

### What the renderer imposes, regardless of source

Two constraints, both already established here, and one of them turns out not to
bind:

- **The heart is not currently separable.** It lives inside the merged
  cardiovascular group of `bodyparts3d.ao.glb`, one of eleven meshes. Per-vertex
  ids make it *identifiable*, not *separable* — a draw call is a draw call. So an
  animated heart wants to be its own GLB composed at scene level, which is what
  `anatomySources.ts` already does for whole atlases ("compose in the scene graph,
  never in the asset").
- **No post-processing.** `postprocessing` and `@react-three/postprocessing` do
  not work in a WebXR session at all, and SSAO computes per eye giving binocular
  rivalry — which is why AO is baked into vertex colours. Anything needing a
  screen-space pass is out. Morph targets are not.
- **The triangle budget turns out not to be a constraint here.** A morph-target
  sequence multiplies position data by the number of phases, which sounded
  prohibitive against a body already at ~2.6 M triangles. Measured against the
  actual artefact it is not: 6,030 vertices across three surfaces × 25 frames ×
  12 bytes is under 2 MB of position deltas, and the animated heart has **fewer
  triangles than the static one it replaces.**

### The two that work

**A. `biv-me` demo output — Apache-2.0, 25 frames, biventricular.** The repo
`UOA-Heart-Mechanics-Research/biv-me` commits its demo fitted models as OBJ: 75
files, 25 frames × 3 surfaces. Verified by hashing the face-index blocks across
frames 000/006/012/018/024 — **the topology is byte-identical in every frame while
the coordinates differ**, which is exactly the glTF morph-target contract, so no
remeshing is needed. Bounding boxes contract to a minimum near frame 006 and
return to the frame-000 extent by 024, so it is a **full cycle that loops**, not
systole only.

| Surface | verts | tris |
|---|---|---|
| Epicardial | 2,502 | 4,864 |
| LV endocardial | 1,572 | 3,072 |
| RV endocardial | 1,956 | 3,680 |

**11,616 triangles for the whole beating biventricular heart — fewer than the
static heart already in the atlas.** Measured on our own asset rather than
inferred: `#VHFHeartV1.1` in `hra.opt.glb` is **25,773 triangles in a single
primitive**, against a whole-atlas 2,325,936 across 96 meshes. So a beating,
three-surface heart costs *negative* triangles and splits a merged node into
labelled structures, which serves the "individual structures identifiable rather
than merged" milestone directly rather than incidentally.

⚠️ **One unresolved risk, and it is a provenance risk rather than a licence one.**
The repo has no NOTICE, no data statement, and no ethics, consent or provenance
text anywhere — searched for *Biobank*, *ethic*, *consent*, *anonym*, *deident*
and *data avail*, with no hits — while the README says the demo folder includes
input DICOMs, and UK Biobank's CMR lead is a co-author on the paper. Apache-2.0 at
the repo root cannot grant rights the licensor does not hold. **Ask the authors
about the demo case's provenance before publishing anything derived from it.** And
do not take the `biv-me-dl-models` weights submodule: `license: null`, and partly
UK Biobank-trained.

**B. Sunnybrook / Cardiac Atlas Project fitted LV models — CC0 1.0, 20 frames, and
the cleanest provenance available.** Licence verified three independent ways: the
project page states it *"including its derivatives"*, a `CC0_License.htm` ships
**inside the archive**, and the bundled README repeats it. Sunnybrook Hospital
waived all rights to the underlying MR database, which is itself CC0 and therefore
shippable alongside the meshes.

45 cases × 20 frames. Structure verified by parsing: one shared
`GlobalHermiteParam.exelem` (16 three-dimensional elements) plus one `.exnode` per
frame, **40 nodes in every frame**, six values per node in prolate spheroidal
coordinates. `theta` is bit-identical across frames while `lambda` changes at all
40 nodes — perfect correspondence by construction. Being bicubic Hermite, it
tessellates to any density smoothly, which is better than a fixed dense mesh.

And the motion is checkable against its own source. The mean-`lambda` trace puts
end-systole at frame 8 of 20 — **systole occupying 35 % of the cycle** — which
independently matches Alhakak et al. 2023 (n=1,969, CC BY 4.0): 40 ms
isovolumic contraction plus 292 ms ejection against a 952 ms cycle is also 35 %.
The relaxation limb shows the rapid-filling, diastasis and atrial-kick structure
as *measured data*. The cohort's published statistics (healthy EF 62.93 ± 3.65 %)
sit inside independent CC BY 4.0 reference ranges.

Cost: **LV only** — no right ventricle, no atria, no valves. Work required is
parsing `.exnode`/`.exelem` (trivial), evaluating the Hermite basis, converting
prolate spheroidal to Cartesian, and emitting morph targets. Of the 45 cases, 9
are normal; the rest are hypertrophy or heart failure, which is a labelling
obligation, not a defect.

### What fails, and precisely why

| Source | Verified status |
|---|---|
| **openCARP** solver | **Academic Public License v1.1** — free for non-commercial only, commercial use requires a licence from NumeriCor. Fails the Open Definition. Its ecosystem is fine: `carputils` Apache-2.0, `meshalyzer` and `meshtool` GPL-3.0. |
| **openCARP's indexed mesh datasets** | Licensed **separately from the solver, and most are CC BY 4.0** — Strocchi's 24 four-chamber heart-failure meshes (with fibre *and* sheet fields plus universal ventricular coordinates), Rodero's 20 healthy, the 1,000 synthetic cohort, and a 2026 four-chamber set of 50 patient-specific meshes at an **exact 25 male / 25 female split**, each with fibre orientations. **All static — single-phase, end-diastolic.** The Strocchi paper confirms only coarse and fine versions of the same mesh ship; no deformed geometry or displacement fields. Useful as better *static* four-chamber geometry, and as the best sex-balanced cardiac anatomy available. |
| **Roney et al. human atrial fibre atlas** | **CC BY 4.0.** The one source here with **measured rather than rule-based fibres**: 7 human atrial anatomies from high-resolution DT-MRI, as endocardial and epicardial surface triangle meshes with **a fibre vector per element** (`.vtk`, or CARP `.pts`/`.elem`/`.lon`). A per-element direction maps directly onto a glTF vertex attribute, so this is the one fibre field that is ingestible without a resampling step. Static, and atria only — but it is what an honest atrial animation would be built on. |
| **Chaste** | Code is **BSD-3-Clause** (Oxford) and clean. The meshes are not: `README.txt` asks users *"not to re-distribute the mesh"*, there is no licence grant for the data at all, and the substantial heart geometry is **rabbit**. Reject on three independent grounds. |
| **UK Biobank-derived meshes** (Zenodo 15649643) | **CC0**, 1,423 meshes — and **end-diastole only**, so the licence is moot. Worth recording that redistribution here is defensible rather than blocked, because these are ≥3-participant stratum averages rather than individual hearts. |
| **MeshHeart** (Nature MI 2025) | Specifies exactly the wanted artefact — 22,043 vertices, **50 frames per cycle** — and releases none of it. Code MIT, no weights, no template mesh. |
| **Cardiac Atlas Project** generally | No time-resolved mesh sequence; two phases at most. Several component atlases carry **no licence statement at all**, and its DETERMINE and MESA inputs are behind bespoke data-use agreements. |
| **ACDC** | *"All rights reverved"* [sic] and a citation request — **no licence grant whatsoever**. Downloadable without an account, which is not permission. ED and ES contours only. |
| **MMWHS** | *"The Recipient(s) commit to not disseminate the Data to any third party."* Snippets claiming CC BY are wrong. |
| **M&Ms / M&Ms-2** | Agreement forbids distributing, reproducing **and creating derivative works**. The CC BY-ND Zenodo records contain only the challenge design PDFs. |
| **CMRxRecon, Kaggle DSB2, MITEA** | All forbid dissemination or restrict to a competition. |
| **XCAT, Living Heart** | Both genuinely time-resolved and beating. **Record as "no verifiable public redistribution grant", not "forbidden"** — no prohibition text was found for either; the terms are simply unpublished, and access is a request form. The door is "ask", not "closed". |
| **SlicerHeart** | **BSD-3-Clause** and clean, but there is no anatomy in it: the only anatomy-shaped mesh is a view orientation glyph, and the rest of "Models" is 3D-printing mould hardware and commercial mitral-clip device CAD. Reject for absence of artefact, not licence. |

**A cross-cutting finding worth keeping.** The two obvious index pages for this
field — openCARP's modelling resources and CEMRG's model collection — between them
list roughly twenty mesh collections and **state a licence for none of them.**
Every licence above had to be pulled from the individual Zenodo record. Anyone
trusting the index would ship CC BY-NC geometry believing it open, because at
least one indexed collection is CC BY-NC 4.0.

### Why the parametric route loses, having costed it honestly

There *is* a citable open-access chain for population-average cardiac kinematics:
volumes and ejection fractions from Petersen et al. 2017 and Kawel-Boehm et al.
2020 (both CC BY 4.0), strain with a base-to-apex gradient from Peng et al. 2018,
twist from Lorenz et al. 2000 — including the one finding that would license the
key interpolation, that torsion is **linear along the long axis at r = 0.994** —
and timing from Alhakak et al. 2023.

It still loses, for reasons that are specific rather than squeamish:

- **Wall thickening magnitude, the most visually obvious part of the animation,
  has no peer-reviewed open source.** The circulating normal values trace to a
  one-page conference meeting abstract, and it cannot be recovered from radial
  strain because three sources report 36.3 %, 47.3 % and 79.0 % for the same
  quantity.
- **The diastolic filling split is unsourced.** Isovolumic relaxation time is
  published; the durations of rapid filling, diastasis and atrial contraction are
  not.
- **The two best open volume sources disagree materially** — male ejection
  fraction 58 % against 64 %, a papillary-muscle convention difference worth
  ~10 ml of end-systolic volume. Whichever is chosen has to be stated.
- **Per-vertex displacement would be ours, not measured.** Every source reports
  slice- or segment-level scalars.
- **A mesh driven by all of them is a composite no individual ever exhibited** —
  different cohorts, ages, modalities and conventions.
- And a trap worth writing down because it is easy to miss: **twist in degrees is
  not scale-invariant.** For the same torsion, twist varies with heart length and
  diameter, so a mesh scaled to `CANONICAL_HEIGHT_M` must not hold a published
  degree value constant.

Set against a named donor mesh whose 20 frames are fitted to that donor's own
cine MRI, this is strictly worse. Build it only if both routes above fail, and if
built, label it in the UI rather than only in a document. A plausible-looking
throb is trivial to write and indistinguishable, to a viewer, from measured wall
motion — which is exactly why it is not worth writing when measured motion is
available under CC0.

## 3. Movement with the forces identified

This is the best-supported of the three, and the conclusion is counter-intuitive:
**the geometry is the encumbered part, and we do not need it.**

### Playback, not solving

The distinction that decides the cost, and it is not close:

- **Running a solver in the browser is out.** LS-DYNA is commercial; FEBio, SOFA,
  CalculiX, MFEM, deal.II and Kratos have no WebAssembly build at all. MuJoCo is
  the sole exception and is discussed below.
- **Playing back precomputed results is cheap**, and is what the architecture at
  the top of this document is for. An inverse-dynamics run yields joint angles
  over time (→ per-bone rigid transforms) and muscle forces or activations over
  time (→ per-structure scalars). Both are small arrays. Neither needs a solver
  present.

So the requirement on a source is not "can we run it" but "may we redistribute
its outputs, and are the outputs published in a documented format". That is a
licence question about *results*, which is frequently different from the licence
on the solver — VIVA+ is the clearest case, where the model is LGPL-3.0 and the
project's FAQ states explicitly that simulation outputs do **not** inherit the
licence, so precomputed results are unencumbered even though no open solver can
produce them.

### ⚠️ OpenSim's code is open and its bone geometry is not

The survey says "Apache 2.0 **VERIFY per model**" and treats the separate mesh
files as a convenience. Verified per model, that is where the problem is.

The **code** is Apache-2.0 — confirmed at `opensim-org/opensim-core`. But its
`NOTICE` scopes the grant deliberately: *"The **OpenSim API** uses the open source
Apache 2.0 license"*. It says nothing about models or geometry. And
`opensim-org/opensim-models`, the repo that ships the `.osim` files and a
`Geometry/` directory of **325 files** including the bone meshes, **has no licence
file anywhere in its tree** — verified independently twice: GitHub reports
`license: null`, a code search for `LICENSE` and `COPYING` returns zero hits, and
the README contains no copyright or licence statement at all.

Per model, read from each SimTK project's own licence text:

| Model | Licence | |
|---|---|---|
| Rajagopal 2016 full body | **MIT**, © 2015 Stanford | fine |
| Thoracolumbar spine | **MIT** | fine |
| Uhlrich 2022 | **MIT** | fine |
| Hamner 2013 | **MIT** | fine |
| Hamner running simulation | **CC BY 3.0** | fine |
| **Arnold 2010 lower limb** | **non-commercial + no redistribution** | **fatal** |
| **Delp lower extremity** | **non-commercial + no redistribution** | **fatal** |
| MoBL-ARMS upper limb | BSD-3 *but* "open sourced solely for non-commercial purposes" | contradictory |
| **`opensim-models` (as shipped)** | **nothing** | trap 9 |

Arnold 2010 and Delp both say: *"You may not copy or distribute this model … This
model may be used only for non-commercial, academic work … **You may not sell the
model or results or images generated with the model.**"* That last clause reaches
**derived results and images**, which is stricter than ND.

**And the chain of title is broken, not merely unstated.** `Rajagopal2016.osim`
references 81 distinct meshes; only 9 ship in its own MIT-covered `Geometry/`
folder. The other 72 resolve to the unlicensed shared `opensim-models/Geometry/`.
Rajagopal et al. 2016 states that the model's bony geometry is taken from
**Arnold et al. 2010** — the model that forbids redistribution. Gait2392's own
documentation says the shank and foot bones are *"adopted from Stredney et al
(1982)"*, contributed by a named third party, with the ISB mirror stating *"All
data may be used and copied for non-commercial use."*

So an MIT-labelled model sits on geometry whose upstream grants nothing. It is the
same defect as Z-Anatomy's white matter, at the root of the most-used
musculoskeletal model in the field. Note also that `MyoHub/myo_sim` asserts
Apache-2.0 over 215 STL meshes converted from that same unlicensed tree —
re-badging does not fix a chain of title.

**Which is fine, because this repo has better geometry already.** Z-Anatomy ships
2,077 identified structures with per-vertex ids, and
`docs/bodyparts3d-system-map.tsv` carries 323 muscles and 203 bones with FMA ids.
**Take kinematics and scalars; never take geometry.**

### What is clean, and what it gives

| Source | Licence (verified) | What it gives |
|---|---|---|
| **OpenSim core + Moco** | **Apache-2.0** | The solver. Run it offline, once. |
| **SCONE core** | **Apache-2.0** (`tgeijten/scone-core`; the GUI `scone-studio` is GPL-3.0 because it links Qt) | Predictive simulation. |
| **AddBiomechanics dataset** | **CC BY 4.0** | **273 subjects**, 71.5 h of motion, **57.6 h with ground reaction forces**, 24 M+ frames, as per-frame kinematics **and joint torques**. Software is GPL-3.0 *plus* a Stanford data-sharing rider, but that only binds you if you run it. Two cautions: **joint torques only, no muscle forces**, and the archive is **417.7 GB** (measured) — though it serves `Accept-Ranges`, so single subjects are extractable. Exclude the `Han2023` slice: its upstream GroundLink data page publishes no licence. |
| **OpenCap** | **Apache-2.0** | Kinematics *and* estimated GRF and muscle forces **from two smartphone videos, no force plates** — 6.2 % bodyweight GRF error. The strongest personalisation route in the whole survey: someone films themselves and the twin moves like them. Honest limit: the model stays generically scaled, not their anatomy. |
| **Open Knee(s)** | **CC BY 4.0**, verbatim | **22 specimens**, and the most complete FE asset found anywhere: MRI, segmentation labels, raw and smoothed surface geometry, surface meshes at several densities, volume meshes, FEBio `.feb` templates, **and joint mechanical test data to validate against**. Generation 1 is CC BY-SA 3.0, also fine. |
| **FEBio** | **MIT for source and SDK** since v2.9 | ⚠️ The **prebuilt binaries are not MIT** — a custom licence, single machine, no redistribution, and it reports a UUID on launch. Build from source. |
| **Chaste** | **BSD-3-Clause**, Oxford | Clean *code*. ⚠️ Its bundled cardiac meshes are not — see §2, where it is rejected on the data rather than the licence. |
| **VIVA+** | **LGPL-3.0**, read verbatim from `LICENSE.md` | Four models — `50F-seated`, `50F-standing`, `50M-seated`, `50M-standing` — an average **female** baseline with a derived male. Docs and validation catalogue CC BY 4.0. LS-DYNA keyword format, which is **ASCII**, so nodes and elements are extractable without the commercial solver. |
| **PIPER** | child model **GPL-3.0**, positioning tool **GPL-2.0-or-later**, wiki CC BY 4.0 | The only credible open paediatric whole-body geometry. Tool is Windows-only, last released 2020. Fence as data, never link. |
| **Motion + force plates, CC0** | **CC0 1.0** | Lencioni 2019 (50 subjects, two force plates plus EMG, ~170 MB — the cheapest real dataset here), Moore/Hnat/van den Bogert 2015 (2.44 GB), van der Zee 2022 (1.07 GB). |
| **Motion + force plates, CC BY 4.0** | **CC BY 4.0** | Camargo 2021 (~22 GB, **with OpenSim IK and inverse dynamics already computed**), Fukuchi 2018, Horst 2019, Carter 2023, Van Criekinge 2023 (**138 able-bodied across the lifespan plus 50 stroke survivors**). |

**Rejected, with reasons.** **SKEL / BSM** is fatal three times over — non-commercial,
**"No Distribution"**, and no modification without written permission, with scope
explicitly covering *"3D meshes"*. Shipping geometry to a browser is distribution
to third parties, so this is the one thing D12b's "take everything" cannot take,
and BSM is **not** separately licensed. **AMASS** is non-commercial with the same
no-distribution clause **and has no force data at all**. Also unusable: the KIT
Whole-Body Database (no licence exists anywhere), CMU Graphics Lab (bespoke, no
resale even converted, marker-only), and STAPLE (CC BY-NC 4.0).

### There is already a reference implementation on this exact stack

**`opensim-org/opensim-viewer`, Apache-2.0, is `@react-three/fiber` 8 + three.js +
drei** — the same stack as `src/scene/`, actively pushed. Its architecture is a
two-stage precompute: a Python backend imports real OpenSim, calls
`generateDecorations()`, and emits glTF via `pygltflib`; the frontend is stock
`useGLTF` plus `AnimationMixer`. No solver in the browser, and **no
`@react-three/xr`** — so the XR gap this project already occupies extends here too.
A whole elbow-flexion motion is **57 KB**: geometry dominates, motion is nearly
free.

Two techniques worth lifting outright: **force vectors encoded as rotation and
scale on an arrow mesh**, so direction becomes a quaternion and magnitude a scale
and plain glTF TRS animation carries them with no shader at all; and muscles drawn
as animated path-point translations with a line-strip belly, handling conditional
points and wrap segments.

**And `.sto`, OpenSim's output format, is trivially parseable** — 11 header lines
terminated by `endheader`, then a tab-separated table with `time` first and one
named column per muscle. A real file from the Hamner pipeline is 5.5 MB for 92
muscles × 3,470 samples. Alongside it ship `ActiveFiberForce`,
`PassiveFiberForce`, `FiberLength`, `PennationAngle`, activations, and
**`JointReaction`** — literally the joint reaction forces. Those are the
per-structure scalars this document's first section wants, already computed, on a
CC BY 3.0 dataset.

There is **no `.osim`, `.mot`, `.sto`, `.trc` or `.c3d` parser in JavaScript or
TypeScript** — so a ~30-line `.sto` reader is both the cheapest way in and a
plausible small contribution back.

### The one genuine in-browser solver, and what it costs

**MuJoCo** is Apache-2.0 and now has **official first-party WASM bindings**
(`@mujoco/mujoco` on npm, Apache-2.0). `MyoHub/myo_sim` is Apache-2.0 and ships
`myolegs` at 20 DoF and 80 muscles, MyoBack at 18 DoF and 210 muscles, and a
full-body model; `noah-wardlow/mujoco-react` (Apache-2.0) already implements live
stepping, kinematic playback and tube-rendered tendons.

The cost is documented by its own authors: MyoLeg's forces are *"not identical"* to
OpenSim's because tendons are stiff rather than elastic, markers differ by ~1 cm,
and wrap objects were deleted for the glutes and psoas. **MuJoCo buys
interactivity; OpenSim buys defensible numbers.** For a project whose rule is not
to present a fabricated value as a measured one, that is the whole trade — and it
argues for OpenSim offline, not MuJoCo live, at least for anything labelled a
force.

### The join, and its one gotcha

OpenSim's 92 actuators reduce to **38 base muscle names**, of which four
(`glut_max`, `glut_med`, `glut_min`, `add_mag`) split into three compartments per
side. So the mapping to atlas structures is **many-to-one and forces must
aggregate** — summing compartment forces onto one named muscle, not averaging. One
TSV of the same kind as `docs/moose-uberon-crosswalk.tsv`.

**And a warning that bites before any of this works:** the shipped `.opt.glb`
merges 2,077 structures into 3 nodes, so per-muscle colouring depends on the
`_STRUCTURE` runs surviving `gltf-transform optimize`. Phase 1 established that
they do, and `npm run check:structures` is what asserts it. Do not take it on
faith after changing the optimise flags.
