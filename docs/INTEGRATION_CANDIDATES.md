# Integration candidates

What is worth adding next, ranked by payoff against cost. Written 28 July 2026
out of `docs/GEOMETRY_SOURCES_SURVEY.md` and `docs/SIMULATION_SOURCES.md`, both
of which are landscape documents; this one is the shortlist.

**Not a roadmap.** `docs/ROADMAP.md` is the live plan and its phases are ordered
by what unblocks the most. This list is the opposite question: what is cheap,
already unblocked, and currently sitting unclaimed. Where an item belongs to a
phase, it says so.

**Cost figures are grounded, not guessed.** A Z-Anatomy rebuild is ~20 minutes of
which 15.5 is the AO bake, measured. "One afternoon" means a spike with a known
question to answer. Anything larger is called out as such.

**The licence column reads under D12b, not D7.** Take everything, record
everything: nothing here is import-blocked. What varies is the *publication*
consequence, so that is what the column states. ⚠️ **D12 and D12b are not yet on
`main`** — they were written in a parallel session and `docs/DECISIONS.md` here
ends at D11b. See the forward-reference note at the top of
`docs/GEOMETRY_SOURCES_SURVEY.md`. Nothing in this list changes if that branch
never lands, except that NC sources move from "record it" to "evaluate privately,
keep out of the shipped artifact".

**Five of these are planned in execution order.** `docs/PLAN_INTEGRATION.md` works
out **B6, A1, B2, B8, B3** against the actual code — files touched, steps,
verification gates, and the findings that changed each one. Read it before starting
any of them; in particular **A1 has a prerequisite that is not on `main`.**

## If you only do three

1. **B2 — Healthy-Total-Body-CTs.** The biggest result here. An **85 MB ungated
   CC BY 4.0** segmentation set, 16 female subjects, measured at a **1,941 mm field
   of view** — genuinely head to feet — carrying every bone the female atlas
   lacks, and generated with the segmenter this project already chose. The
   integration is a label-alias map, not a pipeline. **Phase 6 is not blocked on
   finding a source; it is blocked on nobody having rendered this one.**
2. **A1 — import the four Z-Anatomy files already on disk.** One rebuild, four
   body systems, no new source and no licence question. Three of the four were
   never licence-blocked; that was a scope note misread as a boundary. The one
   catch is that lymphoid has no `SystemId` to belong to.
3. **B6 — the beating heart.** Hours of work, and it *reduces* the triangle count
   while splitting a merged node into three labelled surfaces. Gated on one email
   about the donor's provenance, with a CC0 fallback (C3) if the answer is wrong.

Then **A2**, which is now a bigger correction than when it was written: the roadmap
describes the female body as an unsolved sourcing problem, while a built female CT
atlas sits in the working tree *and* an open head-to-toe source turns out to exist.

---

## Tier A — cheap, unblocked, no new source

Nothing in this tier needs a download, a licence question or a decision.

### A1. Import the four Z-Anatomy system files we already have

**Cost: one rebuild (~20 min compute). Payoff: four body systems.**

Z-Anatomy ships seven per-system FBX files and `build-z-anatomy.mjs` imports
three. D12 established that **Cardiovascular, Nervous and Lymphoid were never
licence-blocked** — D11's "take only skeletal and muscular" was a scope note about
which two files were needed at the time, and it was read for months afterwards as
if it were a licence boundary. D12b then removed the exclusion on Visceral too.

The source is on disk (`~/Downloads/z-anatomy-fbx/`, 85 MB). The importer already
handles laterality, attachment footprints, landmark stripping and per-structure
provenance tagging. This is the highest payoff-to-cost item in the repository and
it needs no research at all.

Caveat that is already handled, not a blocker: the inner ear (CC BY-NC-SA) and
white matter (no licence) ride in `NervousSystem100.fbx`, and the kidney
(CC BY-NC) in `VisceralSystem100.fbx`. D12b's per-structure `component` and
`licence` tagging is what makes importing them recordable rather than reckless.
The white matter still needs written permission before publication — that is D12b's
top action item and importing more of the file does not change it.

**⚠️ One of the four is not just a rebuild: `LymphoidOrgans100.fbx` has nowhere to
go.** `SystemId` in `src/data/schema.ts` is a closed union of nine members —
cardiovascular, respiratory, nervous, digestive, musculoskeletal, endocrine,
reproductive, metabolic, integumentary — and **there is no lymphatic member.**
`build-z-anatomy.mjs` assigns a `system` per FBX file and `systemForGroup`
validates against that closed set, so lymphoid structures would resolve to `null`
and be dropped or silently bucketed into whatever system the importer was told to
write.

Two honest options, and it is a decision rather than a detail. Extend `SystemId`
with `lymphatic`, which touches the data contract, `metricColor.ts`,
`anatomyPalette.ts` and the UI — the contract is shared with the health-data join
that lives upstream, so it is not a local change. Or file lymphoid under
`cardiovascular` on the "circulatory system" reading, which is defensible in
textbooks and still a fudge: the lymphatic system has no pump, drains rather than
circulates, and is the system a viewer would look for by name. Recommend
extending the union; note it as a contract change so it is not made accidentally.

Worth knowing what the shipping atlas's system balance actually is before
deciding, measured from `docs/bodyparts3d-system-map.tsv` (1,839 mapped
structures):

| system | structures | | system | structures |
|---|---|---|---|---|
| cardiovascular | 754 | | metabolic | 73 |
| musculoskeletal | 563 | | endocrine | **3** |
| respiratory | 283 | | reproductive | **1** |
| nervous | 86 | | integumentary | **1** |
| digestive | 74 | | lymphatic | **not representable** |

Three of the nine systems are effectively unrepresented — reproductive is a single
prostate, integumentary a single structure, endocrine three — and there is no
lymphatic coverage at all, nor a way to record it. Also absent entirely from the
map: tendon, sheath, meniscus, larynx, dermis, epidermis, tooth, tympanic
membrane and cochlea. So "import the remaining files" is the cheapest coverage
win, and it lands against a contract that was written for a health dashboard
rather than for an anatomy atlas.

→ ROADMAP Phase 3, which already scopes this and says to scan the FBX rather than
trust the licence file. The scan is what D12 did.

### A2. Reconcile ROADMAP Phase 6 with CT_ATLAS_PIPELINE §6a

**Cost: an edit. Payoff: stops the project's hardest problem being described
wrongly.**

The two documents disagree about the female body, and the one with measurements
in it is not the one being read as current.

**Phase 6 says:** "No open female musculoskeletal source has been found. The
options are to segment a female CT with MRSegmentator or TotalSegmentator and
mesh the result (which reopens the licence questions those tools carry)."

**`docs/CT_ATLAS_PIPELINE.md` §6a says a female CT has already been segmented end
to end**, with **MOOSE** — Apache-2.0 code and CC BY 4.0 weights, chosen in D5
precisely so that no licence question arises — and it produced skull, ribs,
**sternum**, clavicle, scapula, humerus, radius, ulna, femur and the complete
C1–L5 column plus sacrum and both hip bones. 109 structures in one GLB, each with
its own ontology id, from a female subject, with no donor model involved.

So both halves of Phase 6's claim are wrong: a female musculoskeletal source *has*
been produced, and the licence concern belongs to tools that were not used.

**And the asset is on disk.** Verified 28 July 2026 by reading the GLB's JSON
chunk: `public/models/ct-atlas-f.glb`, 12.6 MB, **109 meshes / 109 primitives,
110 nodes**, `generator: "open-twin-openXR labelmap2glb (MOOSE 3.2 +
vtkSurfaceNets3D)"`. It carries `POSITION` and `NORMAL` at 100 % and a single
`tissue` material — so it is built but not yet AO-baked or given per-structure
ids, which is what would put it on the same footing as the other atlases. It is
not on `main` at the time this was written — it existed only in the tree that had
just produced it. A document saying no female source has been found, in a tree that
already contained a built female atlas, is the clearest possible case for D12b's
rule that a log must be generated from the artifact rather than maintained beside
it. (Both the CT female body and a second, TCIA-derived one now ship; see
`docs/reports/`.)

**The real blocker is field of view, and it is narrower and more tractable than
"no source exists".** Measured: the 28 sampled ENHANCE.PET subjects span 45–63 %
of standing height — oncology PET/CT, skull base to mid-thigh — and the VHP frozen
CT reaches head-to-knees with **nothing below the knee** and exams that abut
without overlapping, so the join cannot be verified by correlation (D9a). The
missing anatomy is specifically **tibia, fibula, patella, tarsals, metatarsals,
toes and most of the hand**.

Restating Phase 6 as *"find one head-to-toe open CT"* turns an unsolved sourcing
problem into a search with a clear success test. It also changes what the survey
is worth to this project: its most valuable contribution is not an atlas at all
but a possible head-to-toe corpus — see B2.

### A3. Correct RESOURCES.md on what Open3Dmodel actually buys

**Cost: an edit. Payoff: stops a cross-donor graft being attempted.**

`RESOURCES.md` says of Open3Dmodel: "**And it covers exactly what HRA does not.**
HRA has no skull, ribs, clavicle, scapula, humerus, radius, ulna, hands or feet …
Open3Dmodel ships a skull, an upper limb and a hand."

True as coverage, misleading as a plan. Open3Dmodel is the BodyParts3D lineage, so
its donor is **TARO** — the same body Z-Anatomy depicts, and a different person
from HRA's Visible Human Female. Grafting it onto HRA is precisely the cross-donor
registration problem D3a is blocked on, and `anatomySources.ts` already records
why that failed once: "two different donors in two different poses, and
bounding-box registration cannot fix a pose difference."

What Open3Dmodel actually offers this repo is a **quality upgrade on the
musculoskeletal path we already ship** — the same asset as Z-Anatomy, remeshed in
full and reviewed by university anatomists, under a licence D7 already accepts. It
fills Z-Anatomy's *quality* gap, not HRA's *coverage* gap. Worth having; worth
describing correctly.

---

### A4. Drop the share-alike exclusions from PERMISSIVE_ANATOMY.md

**Cost: an edit. Payoff: two usable sources stop being listed as avoidable.**

`docs/PERMISSIVE_ANATOMY.md` lists **VerSe** and the **Medical Segmentation
Decathlon** under "Avoid — share-alike". That reasoning was correct under the
commercial criterion the project held on 26 July and **D7 reversed it**: CC BY-SA
is Open Definition conformant and *recommended*, so share-alike costs an
openness-bound project nothing. D7 already flagged MSD as "Tier 1 now"; the
avoid-list was never updated to match.

VerSe is worth the correction specifically: **CC BY-SA 4.0** on the data with MIT
code, 374 scans across 355 patients, cervical through lumbar, with **ungated direct
downloads** rather than a challenge gate. One trap to record while doing it — a
Zenodo record titled "Large Scale Vertebrae Segmentation Challenge" is **CC BY-ND
4.0** and is the *challenge design document*, not the dataset. Searching Zenodo for
VerSe surfaces the ND record first, which looks fatal and is not the data.

## Tier B — one afternoon each, one open question each

### B1. Open3Dmodel: does `overview-skeleton` share Z-Anatomy's origin?

**Cost: one afternoon. Payoff: anatomist-reviewed geometry on the shipping path.**

Both gating questions are already resolved (`RESOURCES.md`): the GLB zips download
(0.2–6.2 MB, all HTTP 200), derivative use is explicitly invited, and the offered
set is musculoskeletal-only so it cannot reintroduce Z-Anatomy's NC components.

What is left is a measurement, not a question of permission. These are **regional**
exports — skeleton, vertebrae, skull, upper limb, hand, lower limb — where
`build-z-anatomy.mjs` consumes whole-body FBX files. So the importer would have to
*place* them rather than merge them, and nothing guarantees they share Z-Anatomy's
origin. The test is cheap and the repo already has the instrument: measure
depth-to-height ratio and compare against the 0.148 / 0.149 agreement already
established between the Z-Anatomy and BodyParts3D skeletons.

### B2. Healthy-Total-Body-CTs — this is the head-to-toe CT, and it is 85 MB

**Cost: a ~36-row label-alias map. Payoff: closes the female-body gap.**

**Promote this to Tier A once someone has looked at the meshes.** It is filed here
only because nobody has rendered it yet, not because anything is unresolved.

Given A2, the one thing this project needed was a genuinely head-to-toe open CT
with recorded sex. It exists, it is on TCIA, and almost none of the expected
friction is real:

- **Segmentations and clinical data are CC BY 4.0.** The CT *images* are gated
  ("TCIA Restricted", on facial-reconstruction grounds) — **and are not needed.**
  The segmentation archive is a single ungated **85 MB** zip.
- **30 living healthy adults, 16 female and 14 male**, ages 26–78, with per-subject
  sex, age, weight, height and BMI in a CC BY 4.0 spreadsheet.
- **It is genuinely head-to-feet.** Verified by reading a female subject's NIfTI
  directly: 512 × 512 × 828 voxels at 0.965 × 0.965 × 2.344 mm, a field of view of
  494 × 494 × **1,941 mm**. That is the measurement that ENHANCE.PET failed at
  45–63 % of standing height and that the VHP frozen CT failed below the knee.
- **Every bone the female atlas lacks is in it**: skull, ribcage, clavicle,
  scapula, humerus, radius, ulna, carpal, metacarpal, fingers, tarsal, metatarsal
  and toes, plus spine, pelvis, sternum, femur, patella, tibia and fibula. Also 12
  organs, skeletal muscle, subcutaneous and torso fat, psoas.
- **It was generated with MOOSE** — the segmenter D5 already chose. So
  `docs/moose-uberon-crosswalk.tsv` already speaks this vocabulary and
  `scripts/ct-atlas/labelmap2glb.py` already consumes label volumes. The
  integration is a label-alias map, not a pipeline.

**Three caveats, and the first one matters for Phase 1.** The labels are
**grouped** — one `Ribcage`, one `Spine`, one `Carpal`, one `Fingers` — so there
are no individual ribs or vertebrae, which is exactly the structure identity Phase
1 exists to provide. Because the images are restricted, it cannot be re-segmented
at finer granularity. Slice thickness is 2.34 mm and will stair-step in z. And the
scans are low-dose non-contrast, so **D10's organ-contrast objection partly
applies to the organ masks**: take the bones with confidence and treat the viscera
as lower-confidence than an illustrator atlas. Bone-to-air contrast is unaffected.

Worth recording a tension in the source's own risk posture: TCIA restricted the
images citing facial reconstruction, then released the **skull mask** openly — and
this repo's own crosswalk flags skull-plus-soft-tissue as the privacy-critical
structure.

**The complement, for the granularity Phase 1 wants.** The TotalSegmentator CT
dataset (CC BY 4.0, already in `RESOURCES.md`) is **510 female / 716 male** and
ships **all 24 ribs and C1–L5 individually** — but contains no radius, ulna,
carpals, metacarpals, phalanges, patella, tibia, fibula or tarsals at all. So the
two sources are complementary rather than competing: one gives the distal limbs and
true head-to-toe extent merged, the other gives per-rib and per-vertebra identity
and stops at the knee.

**And the candidate I expected to recommend is dead.** The **New Mexico Decedent
Image Database** has ~15,000 whole-body CT scans of both sexes and is decisively
closed: its data-use agreement bars the recipient from "**create derivative works
from**" the database, which reaches the mesh itself rather than only its
redistribution, and it separately prohibits research that reconstructs a face for
public viewing — which is close to a description of a body viewer. Record it as
rejected on contract, alongside UK Biobank and NAKO.

### B2a. The same-donor female lower limb, as ready-made meshes

**Cost: a download and a placement check. Payoff: real female muscle geometry,
with no registration problem.**

The Denver Visible Human lower-extremity dataset (Andreassen, Hume et al.) is
**CC BY 4.0** and ships **130 named structures per side, 260 per subject: 76
muscles, 28 bones, 16 cartilages, 8 ligaments, 2 fat** — as separate named STL
files, overlap-corrected to a 0.05 mm gap and stated as usable without further
processing. The whole final mesh set is **87.8 MB**. Donors: **Visible Human
Female, 59, 157 cm** and Visible Human Male, 39, 180 cm.

**Why this is unusually valuable here: it is the same donor HRA is.** HRA's female
reference organs were modelled from the Visible Human Female, so grafting these
onto HRA-female is not cross-donor registration — the objection that killed mixing
HRA with BodyParts3D does not apply. It is the same body. That makes it the one
graft onto HRA that is geometrically defensible, and it supplies female muscle,
ligament and cartilage that exists nowhere else openly.

**And it partly reopens D10, which is worth being precise about.** D10 concluded
that cadaver imaging cannot yield an organ atlas, on the measured grounds that the
Visible Human CT has ~60 HU of noise against the 10–30 HU separating soft-tissue
organs, and that a cadaver has no circulation and therefore no contrast. Both true
— **of CT**. This dataset was segmented from the **cryosection colour
photographs**, supplemented by CT, and colour photography of real tissue has
genuine contrast. 76 female lower-limb muscles under CC BY 4.0 are the existence
proof. D10's conclusion holds for CT and does not generalise to the cryosections —
which is also D4's whole premise.

Two practical notes: cite the Digital Commons record, because the SimTK mirror of
the same data states **no licence at all**; and scripted download 403s, so a
browser is needed. Note also what is *not* included, having been checked: **the
menisci**.

For the foot specifically, **BMFToolkit** is **zlib-licensed** — OSI-approved,
permits modification and redistribution — and ships **63 individual bone meshes as
both OBJ and STL** from the Visible Human Female CT, including a complete foot
skeleton per side. One donor, one coordinate frame, so it avoids the multi-donor
chimera problem `docs/PERMISSIVE_ANATOMY.md` already documents for loose scanned
bones.

### B2b. CADS — 167 structures, and it fills most of the §G gaps

**Cost: a segmentation run. Payoff: the systems no atlas here covers.**

`CADS` is code **Apache-2.0** with **licence-stratified weights**, and the
stratification is the point: the `open` weight release is **CC BY-SA 4.0 and
explicitly permits redistributing derived weights**, including commercially, under
share-alike. It is downloadable today with no gate. Under D7 that is Tier 1.

**167 structures, head to knee**, and it covers much of what
`docs/GEOMETRY_SOURCES_SURVEY.md` §G lists as missing: **eyeballs** with anterior
and posterior segments, **rectus eye muscles**, **optic nerve and chiasm**,
**lacrimal glands**, **larynx, glottis, supraglottis, arytenoid cartilage,
cricopharyngeus**, **mandible**, **cochlea**, **spinal cord**, **mammary gland**,
plus individual ribs 1–12 and vertebrae C1–L5. No hands or feet.

Two things to respect. Its `reference` and `research` weights are *not* the open
ones — `research` is CC BY-NC-SA 4.0 and `reference` passes through several
challenge agreements, which the authors document themselves. And its companion
*dataset* spans CC BY 3.0, CC BY 4.0, CC BY-SA 4.0, CC BY-NC-SA 4.0 **and CC
BY-NC-ND 4.0** — do not mesh the ND subsets. Worth noting that CADS ships
per-source folders each carrying its own README and upstream agreement text, which
is close to what D12b's provenance workflow wants and worth copying.

### B3. OpenEar as the D4 texture pilot

**Cost: 7.3 GB (one specimen), then a bake. Payoff: settles D4 cheaply.**

D4 is "try the Visible Human cryosection texture bake" — real tissue colour
registered to real geometry. That is an expensive experiment on a whole body.

**OpenEar is the same experiment at 1/100th the scale, and already registered.**
Verified CC BY 4.0 on Zenodo record 1473724: eight temporal bones from combined
cone-beam CT and micro-slicing, *with real colour data*, built explicitly for VR
surgical simulation. It answers "does colour-from-photography survive our
retopology, decimation and AO bake" on an asset small enough to iterate on in an
afternoon, before that question is asked of a whole body.

Practical note the survey omits: the download is **8 zips totalling 59.1 GB**
because raw imaging ships alongside the models. Take one specimen, not the set.

### B4. Visible Korean — verified, and thinner than the survey suggests

**Cost: 3D PDF extraction. Payoff: a female pelvis and heart. Modest.**

Verified 28 July 2026, and the correction matters because this is the survey's
main hope for open female anatomy. The distribution point is `anatomy.co.kr`,
which is a **Google Sites page linking to Google Drive** (note: `www.anatomy.co.kr`
does not resolve; the bare host does).

**A female whole body exists only inside a 813 MB browsing-software bundle.** The
downloadable *surface models* are male for everything except two items: a **female
pelvis** (20 MB) and a **female heart** (45 MB), both as 3D PDF. So the survey's
"Visible Korean has female whole-body and pelvis surface models" is half right —
the whole body is sectioned images inside an application, not a mesh.

**And the download page carries no licence statement of any kind.** The
free-for-non-commercial grant appears in the published papers, not at the point of
download. Under trap 9 (silence grants nothing) that puts it alongside the
Z-Anatomy white matter: usable now under D12b, needing written permission before
publication. Formats are 3D PDF (U3D) for surfaces and NII.GZ for volumes — the
NIfTI labelmaps would drop straight into the existing `labelmap2glb.py`, but only
the male ones exist.

### B5. MakeHuman / MPFB2 as the body envelope

**Cost: a build plus a shader decision. Payoff: organs stop floating in space.**

Already evaluated in `RESOURCES.md` and the licence is the cleanest in the entire
survey: **assets CC0**, including the morph targets, with the "official unmodified
build only" caveat obsolete. Quad-only topology, subdivision-friendly, ~15k
vertices, and parametric — so sex is a slider rather than a second donor.

It is an outer shell with no viscera, which is exactly what is wanted: a
translucent envelope for the atlas to sit inside. The open question is rendering,
not sourcing — how a skin surface reads in XR without occluding the anatomy it
contains, which is a depth-and-transparency problem this renderer has not faced
yet.

### B6. A beating heart that costs negative triangles

**Cost: hours. Payoff: the most visible feature in the list. Gated on one email.**

This is the surprise of the survey and the details are in
`docs/SIMULATION_SOURCES.md` §2. The `biv-me` project (Apache-2.0) commits 25
frames × 3 surfaces of a fitted biventricular heart as OBJ, and the topology is
**byte-identical across every frame** — verified by hashing the face-index blocks
— which is precisely the glTF morph-target contract. Parse 75 OBJs, emit one glTF
with 25 morph targets, animate the weights.

The cost is negative: **11,616 triangles for the whole beating heart against the
25,773-triangle merged `#VHFHeartV1.1` node already in `hra.opt.glb`.** And it
splits the heart into epicardium, LV endocardium and RV endocardium, which serves
the current milestone's "individual structures identifiable rather than merged"
requirement directly rather than incidentally.

**The gate is provenance, not licence.** The repo carries no data statement,
ethics or consent text of any kind, the README mentions bundled input DICOMs, and
UK Biobank's CMR lead is a co-author on the paper. Apache-2.0 at the repo root
cannot grant rights the licensor does not hold. Ask the authors before publishing
anything derived from it; if the answer is UK Biobank, fall through to C3, which
has no such question.

### B8. Generate the eye instead of sourcing it

**Cost: an afternoon of maths. Payoff: an organ we own outright.**

Every other item in this document is somebody else's asset under somebody else's
terms. The eye is the exception, and it is worth doing partly to prove the pattern.

The classical schematic optical eyes — Gullstrand-LeGrand, Liou-Brennan,
Escudero-Sanz & Navarro, Arizona, Atchison — are **fully published as radii, conic
constants, thicknesses and refractive indices**, with the Arizona and Atchison
models also publishing accommodation formulas, so the geometry varies correctly
with focus. Those numbers are measurements, not copyrightable expression. A
surface-of-revolution mesh generated from the conic sag equation is therefore
**ours under no upstream licence at all** — no attribution chain, no share-alike, no
provenance question. `visisipy` (MIT, Leiden UMC) already implements two of the
models if a reference is wanted.

Two honest notes. Liou-Brennan decentres the pupil 0.5 mm nasally and so is not
strictly rotationally symmetric; a surface of revolution approximates it. And a
schematic eye is an *optical* model — cornea, aqueous, lens, vitreous, retina —
not an anatomical one, so it has no sclera, muscles, or vasculature and must be
labelled as a schematic rather than presented as a donor's eye.

For the orbit around it, **TOM500 is CC0** — the most permissive licence in this
entire survey — with 500 patients, **333 of them female**, and nine segmented
orbital structures including the optic nerve, lacrimal gland, orbital fat and all
the extraocular muscles. Voxel masks needing a meshing pass, which
`labelmap2glb.py` already does.

### B9. Drug biodistribution on eight organs, CC0, on rails that already exist

**Cost: an offline integration plus a colour ramp. Payoff: a capability nothing
else in this space has.**

`docs/SIMULATION_SOURCES.md` §1 has the detail. What makes this cheap is that every
expensive piece is already built: `AtlasBody.tsx` already normalises
`UBERON:0002107`-style identifiers, `docs/moose-uberon-crosswalk.tsv` is already
hand-verified against OLS4, and `store.ts` already carries `journeyT` as a 0–1
scrub that can serve as the time axis.

The source is **BioModels `BIOMD0000001028`, CC0** — a human whole-body
physiologically-based pharmacokinetic model of metformin whose 21 compartments are
annotated with real ontology terms, **eight of them mesh-mappable whole organs**.
Integrate it offline, emit `{ uberonId, t[], c[] }`, and feed it into the same
`_STRUCTURE`-indexed texture Phase 4 needs anyway.

**Three things must be said in the UI, not just here.** It is **one drug**. It is a
**model prediction for a reference body**, not a measurement of the viewer — the
same distinction `referenceRange.ts` enforces upstream by demanding a source URL
and publisher. And the compartments that are *not* organs — plasma, "residual",
"tissue", "vascular" — are `hasData: false`, which is exactly the case the existing
rule was written for.

One concrete trap, already found: the model annotates `Feces` as
`UBERON:00001245`, which has **eight digits and is malformed**. Trimming it to seven
resolves cleanly to **"anus"**, which is wrong and would look plausible. Validate
every identifier against OLS4 rather than normalising it into something that
resolves.

If measured data is wanted instead of modelled, **QUADRA_HC is CC BY 4.0** with 135
per-organ uptake values, sex-stratified over 48 healthy controls — but it is a
single static time frame, so it colours the body without animating it.

### B7. Write the `.sto` reader

**Cost: ~30 lines. Payoff: unlocks every OpenSim result in existence.**

OpenSim's output format is 11 header lines terminated by `endheader`, then a
tab-separated table with `time` first and one named column per muscle. A real
file from its own Hamner pipeline is 5.5 MB for 92 muscles × 3,470 samples, and
the same directory ships fibre forces, pennation angles, activations and
`JointReaction` — the joint reaction forces — all already computed, on a
CC BY 3.0 dataset.

**There is no `.sto`, `.mot`, `.osim`, `.trc` or `.c3d` parser in JavaScript or
TypeScript.** So this is both the cheapest possible way into the biomechanics
data and a plausible small contribution back to a field that currently has none.

---

## Tier C — high payoff, real work

### C1. SPARC dataset 307 — the cross-subject correspondence primitive

**Cost: scaffold tooling, then a fitting pass. Payoff: the primitive Phases 5 and
7 both need.**

Verified via the Pennsieve Discover API: *"A 3D human whole-body model with
integrated organs vasculature musculoskeletal and nervous systems for mapping
nerves"*, licence **Creative Commons Attribution**, version 8, DOI
`10.26275/bbvg-gj86`, tagged for lungs, stomach, heart, bladder, colon, spinal
cord, systemic arteries and veins, muscle and bone. Direct download.

The survey ranks this first of its five and it is right to. A SPARC scaffold is a
coarse Hermite finite-element mesh carrying a **material coordinate system**: an
element plus local coordinates names the same piece of tissue across every
configuration of one body *and* the anatomically equivalent location across
different bodies. That is the "same location, different body" primitive, and no
mesh atlas can express it.

Why it matters here specifically: **Phase 5** is a name→UBERON crosswalk, which
gives cross-atlas agreement on what a structure *is* but says nothing about where
it is on a different body. **Phase 7** is personalisation from a person's own
imaging, and Learn2Reg's best inter-patient abdominal CT registration is Dice 0.69
— a number `RESOURCES.md` already tells us to plan around. A material coordinate
system is a different mechanism for the same job, and it comes with nerve
centrelines, which is a system no atlas in this project covers.

Cost is real: Hermite scaffolds are not triangles. Export goes through the
derivative folder (STL, VTK), the ABI Mapping Tools, or the `sparc.client` Python
library. Budget a spike to get one organ out and into the existing pipeline before
committing.

### C2. Human Organ Atlas — one hero organ

**Cost: a large download plus segmentation. Payoff: a detail tier nothing else
offers.**

Verified 28 July 2026, quoted from the portal: each dataset "is distributed under
the permissive **CC-BY-4.0** licence", with per-dataset DOIs and donor, organ and
scan-condition metadata. Currently **60 donors, 94 organs, 375 datasets**, whole
organs at ~20 µm with zooms to 0.857 µm. **Eyes were added on 11 March 2026.**

The eye is a good worked example of what this source is for, and checking it
corrected a claim I had written the other way round. **HRA does ship eyes** — four
reference organs at v1.3, `eye-{female,male}-{left,right}`, CC BY 4.0 — so the eye
is not missing from the project. It is missing from the two atlases that actually
render: BodyParts3D's 1,839 mapped structures contain no eyeball, cornea, retina,
lens, sclera or iris (only two supra-orbital nerves), and Z-Anatomy's imported
subset is musculoskeletal by construction. So HRA gives a coarse,
illustrator-authored eye and HiP-CT gives the same organ at micron resolution.
Having both is what makes a detail tier demonstrable rather than hypothetical:
there is something to zoom *from*.

The framing correction from the survey is the important part: this is **individual
excised organs from 60 different donors, imaged ex vivo.** There is no whole body
in it and there never will be, so it cannot answer the female-body question. What
it can do is give one organ a level of detail that is simply unavailable anywhere
else, at a licence that lets us ship it.

Treat it as a *detail tier*, not an atlas: pick one organ, mesh it, and let the
viewer zoom from atlas geometry into HiP-CT geometry for that one structure. That
is also a good forcing function for the LOD chain the survey correctly says nobody
publishes.

---

### C3. The CC0 beating left ventricle

**Cost: days. Payoff: a beating heart with zero licence risk.**

The fallback to B6 and the better provenance story. The Sunnybrook / Cardiac Atlas
Project fitted models are **CC0 1.0 stated three separate times**, including a
waiver file shipped inside the archive and an explicit extension to derivatives —
and the underlying MR database is CC0 too, so it can ship alongside. 45 cases × 20
frames, 40 nodes per frame, correspondence perfect by construction, and the
contraction verifiable against the cohort's own published ejection fraction.

More work than B6 because it is bicubic Hermite in prolate spheroidal coordinates
rather than OBJ, so it needs a basis evaluation and a coordinate conversion — but
that also means it tessellates to whatever density is wanted. Left ventricle only:
no right ventricle, no atria, no valves.

### C4. Movement with the forces named, from precomputed results

**Cost: real, but far less than it looks. Payoff: the whole third capability.**

`docs/SIMULATION_SOURCES.md` §3 has the detail. The short version is that the
expensive-sounding part is unnecessary and the encumbered part is avoidable:

- **Do not take OpenSim's geometry.** Its code is Apache-2.0 but its shipped
  geometry repo has no licence file at all, and the bone meshes trace to models
  that forbid redistributing derived results and images. This repo already has
  better geometry with per-structure identity.
- **Take kinematics and scalars instead.** Bone motion is rigid, so per-bone
  transforms in a `_STRUCTURE`-indexed texture move the skeleton with no rig and
  no skinning weights. Muscle forces are per-structure scalars — the same
  mechanism Phase 4 already needs.
- **The data is clean and already computed.** AddBiomechanics' dataset is CC BY 4.0
  with 273 subjects and 57.6 hours of motion with ground reaction forces; several
  gait datasets are CC0; one CC BY 4.0 set ships OpenSim inverse dynamics already
  run.
- **There is a reference implementation on this exact stack** —
  `opensim-org/opensim-viewer`, Apache-2.0, `@react-three/fiber` 8 + three.js +
  drei, with no XR. Its trick of encoding force vectors as rotation and scale on
  an arrow mesh is worth lifting outright, and a whole motion is 57 KB.

The join has one gotcha worth knowing before starting: OpenSim's 92 actuators
reduce to 38 base muscle names with four splitting into three compartments per
side, so forces must **aggregate** onto atlas structures rather than average.

---

## Not worth it, and why

- **ICRP 145 MRCPs, and everything else ICRP publishes.** Adult male and female
  mesh phantoms, 187 organs, ~8.5 M tetrahedra, deformable — genuinely the official
  reference bodies in mesh form, and genuinely not open. ICRP's own copyright page
  is decisive: *"ICRP retains copyrights on all its publications; even free to
  access publications require permission for reuse"*, case by case and possibly
  conditioned. That is MIDA's category — free of charge, no redistribution right —
  and it applies uniformly to Publications 89, 107, 110, 128, 133 and 145. Ask, but
  do not plan around it. The one workable pattern is what PK-Sim and httk already
  did: reproduce the *numbers* in an openly licensed database, since facts are not
  copyrightable.
- **MIDA.** 153 head and neck structures as CAD at 500 µm, and probably the most
  detailed head model that exists. Bespoke privacy agreement, no redistribution.
  Usable privately, never shippable — which for a body *viewer* is the wrong shape
  of asset.
- **3D Atlas of Human Embryology.** CC BY-NC-**ND**. ND forbids the retopologise,
  decimate and convert-to-glTF pipeline entirely, so this cannot be ingested at
  any tier. Link out. The survey says exactly this and it is right.
- **MedShapeNet, 3D-IRCADb.** Same ND wall. 100k+ ready meshes that can be
  evaluated privately and never published.
- **UK Biobank, NAKO.** Signed MTAs, not licences. D12b is a decision about our
  own licence policy and cannot reach someone else's contract.

From the simulation survey, where the reasons are worth recording because several
of these look usable until read closely:

- **SKEL / BSM.** The one thing D12b's "take everything" genuinely cannot take.
  Non-commercial **and** "No Distribution" **and** no modification without written
  permission, with scope explicitly naming 3D meshes. Shipping geometry to a
  browser is distribution to a third party, so this fails three ways at once. BSM
  is not separately licensed.
- **AMASS.** Same no-distribution clause, and it has no force data at all.
- **openCARP** the solver. Academic Public License, non-commercial. Its *datasets*
  are mostly CC BY 4.0 and separately useful as static four-chamber geometry, and
  its `carputils`/`meshtool` tooling is fine — the restriction is on the solver
  only.
- **Chaste's meshes.** The code is BSD-3-Clause; the bundled meshes carry an
  explicit request not to redistribute, no data licence at all, and the
  substantial heart geometry is rabbit.
- **SlicerHeart.** BSD-3-Clause and clean, and there is simply no anatomy in it —
  the only anatomy-shaped mesh is a viewport orientation glyph.
- **XCAT, Living Heart.** Both genuinely beating and time-resolved. Record as **no
  verifiable public redistribution grant** rather than "forbidden": no prohibition
  text exists, the terms are just unpublished. The door is "ask", not "closed".
- **ACDC, MMWHS, M&Ms, CMRxRecon, Kaggle DSB2, MITEA.** Every
  challenge-participation suspicion in the survey's trap 8 was confirmed, without
  exception. Some forbid dissemination outright; ACDC grants no licence at all and
  merely asks for a citation, which a public download does not upgrade into
  permission.
