# Organ shape models: what it would take to deform an atlas to a person

**A SPEC FOR FUTURE WORK, NOT A PLAN IN FLIGHT. Nothing here is started.**
Written 8 August 2026. Referenced by `docs/ROADMAP.md` Phase 7 and by D16a.

> ⚠️ **Provenance note, because this file's neighbours are different.** Everything
> else in `docs/research/` is an **external** input document imported on 8 August
> 2026 (see `00-SOURCE-README.md`). This one is **this repository's own**, written
> against this repository's assets and decisions. Read `research/README.md` for the
> other six; do not read their verification status onto this.

Marker convention, following the house style already used in `research/README.md`:

- **[M]** measured or computed directly in this session, against this repo's files.
- **[V]** read directly from a primary source in this session (a fetched page, a
  `LICENSE` file body, a package's own metadata).
- **[L]** a literature figure from the dedicated SSM literature review (§4a), whose
  **every DOI was checked against Crossref**.
- **[R]** verified by an earlier session of this repository and recorded in
  `docs/PHOTOREALISM_AND_PERSONALISATION.md`; **not re-verified here**.
- **[?]** unverified. Do not let it carry weight until checked.
- **[NR]** **not researched.** A named gap, not a claim. Different from **[?]**:
  `[?]` means somebody looked and could not confirm, `[NR]` means nobody looked.

⚠️ **One weakness in `[L]`, stated because it would otherwise be invisible.** The
literature review graded each figure on three levels — read in the paper itself,
read in a paper quoting it, and seen only in a search snippet — and **that per-figure
grading was not preserved when the findings reached this document.** So `[L]` is one
marker covering three confidence levels. Where the level *is* known it is stated
inline, and the four figures with known problems are called out by name in §4a. Do
not quote an `[L]` figure externally without recovering its level first; it is
register item 17.

---

## 1. Executive summary — the recommendation

**Go-if, and the "if" is one experiment.**

Split into three answers, because the question as posed contains three projects and
they have different verdicts:

1. **Deforming organs from the skin envelope: NO-GO, on quantified evidence.**
   Not an argument — a measurement. **External body dimensions explain r² ≤ 0.439 of
   adult organ axial position and r² ≤ 0.410 of adult organ volume** (Segars et al.
   2014, DOI 10.1118/1.4901554, 58 adult + 69 paediatric CT; both figures are
   *maxima*, right lung against height; weight is worse, BMI and age near-zero) [L].
   **More than half of adult internal anatomical variance is invisible from
   outside.** Everything in §4b follows from that one number, and none of it
   improves with better engineering, because the information is not in the input.
   D16a refused to build the parametric envelope for this reason and was right to.
2. **A full multi-organ statistical shape model: GO-IF — moved from "no-go for
   now" by the evidence in §4a.** The reassessment is recorded rather than quietly
   applied:

   > **What changed.** The first draft rated this no-go on an unstated assumption
   > that training data was the binding constraint. It is not. Convergence needs
   > **~200 subjects** (Audenaert et al. 2019, and that is for *bone*, which is
   > less variable than viscera) [L], while the published abdominal SSMs use
   > **18–50** [L] — and the TotalSegmentator dataset, verified CC BY 4.0, has
   > **1,228 CT** [V]. So the literature's modest accuracy is substantially a
   > sample-size artefact, not a ceiling, and the data to go past it is openly
   > licensed and already identified. ⚠️ **The gate does not move**: correspondence
   > is still unproven here, still has no automatic test, and is still the whole
   > cost. Leg 2 is now go-*if*-the-pilot-passes rather than not-now, which is a
   > change of posture, not of sequencing.

   ⚠️ **The counterweight I expected did not survive contact with the source, and the
   correction strengthens leg 2.** The first draft warned that trading 43 careful
   manual segmentations for 1,228 *model-generated* ones buys variance and pays in
   bias — because **the accuracy floor is annotation quality, not model capacity**
   (SLIVER07, §4a). But TotalSegmentator's labels are model-*assisted* and **all
   1,204 were manually reviewed** (§6, quoted). The floor argument still holds; the
   dataset does not fall foul of it.

   What survives is narrower and quantified: **only 404 of 1,204 examinations show no
   abnormality** [L]. A normative model must filter to those — and **404 still clears
   the ~200 convergence requirement with margin.** So the binding constraint on leg 2
   is not data volume, not data licence, and not annotation quality. It is
   correspondence, which is where the gate already is.
3. **Two things are GO now, and one of them may deliver most of the value.**
   - A **per-structure affine LUT** reusing `src/scene/structureMask.ts`, at
     **173 KB independent of vertex count** [M]. This gives per-organ allometric
     sizing — Tier 1 of the existing personalisation ladder — with no morph
     targets, no VRAM problem, no correspondence prerequisite, and no new asset
     pipeline. ⚠️ **Read §8 before building anything else.** It is plausible this
     is the whole feature and the SSM is never needed.
   - A **single-organ correspondence pilot on the liver**, described in §9, which
     is the cheapest experiment that would settle (2) either way.

**The one-line version:** the honest project is *"scale organs to your size and say
so"*, not *"show you your organs". The second one requires the person's own
contrast-enhanced imaging, and at that point you are meshing their scan rather than
morphing an atlas.*

### Why the objection in the brief is correct and cannot be routed around

> deforming organs by a skin-surface transform yields a WRONG organ, not a
> personalised one, because organ shape is not a function of skin shape

This is the same class of objection D10 used to reject cadaver CT: **the signal being
extracted is smaller than the noise in the input.** D10 measured 60 HU of noise
against the 10–30 HU that separates soft-tissue organs. §4b is the equivalent
measurement for this proposal, and it is now quantified from four independent
directions:

| the claim | the measurement [L] |
|---|---|
| the exterior encodes the interior | **r² ≤ 0.439** for adult organ position (Segars 2014) |
| a better external measure would fix it | error **plateaus at 17.6 %** vs 20.3 % for height+weight (Stepusin 2017) |
| an affine fit is approximately right | organ **Dice 0.2–0.6** (Fu 2021) — recognisably mislocated |
| a transform with no learned prior | **62 ± 28.5 mm** (Yao & Summers 2009) |

And the physiological floor underneath all of them is larger than the difference
between a good and a bad surface model: **the liver moves 10–25 mm in quiet
breathing** (AAPM TG-76) [L]. **Quoting an organ position to better than ~1 cm is not
meaningful for any static body model, however it was built.**

Note the direction of travel: this argument used to rest on a single citation, and now
rests on four independent lines that agree. The single citation (BOSS) is **demoted
and no longer load-bearing** — see §4c.

So a skin-driven organ transform would be rendering a ±1–3 cm estimate with the
same crisp silhouette as measured anatomy. D17 has already ruled on the general
form of that mistake for colour ("red on an organ is an alert, not a value"); the
geometric version is worse, because a silhouette reads as a fact rather than as a
scale.

---

## 2. How this connects to decisions already made

| decision | what it fixes for this spec |
|---|---|
| **D10** | Plausible geometry that misstates anatomy is worse than no geometry. The test is signal-versus-noise in the *input*, not quality of the output. Also: cadaver CT is closed, do not re-propose it. |
| **D12b** | Take everything, record everything — but **silence grants nothing**. A phantom or dataset whose licence is not published is *stricter* than a non-commercial one, not looser. §5 turns out to hinge entirely on this. |
| **D14** | Capability is per-asset and a control that silently does nothing is worse than one that says it cannot. A morph slider that does nothing on five of seven atlases must say so. |
| **D16** | The envelope is a **reference silhouette, not this body's skin**, and is presented in those words. Non-commercial runtime downloads are a real trap that dependency audits miss. |
| **D16a** | The envelope is measurably standalone, and a parametric one would be **more** standalone. Morph targets there would make "a better shape browser and a worse body". |
| **D17** | Uncertainty must be carried on a channel the data channel does not use (dither/hatch). And: recolouring is not a regulatory answer — nor is remodelling. |
| **Roadmap Phase 6** | Sex-matched complete anatomy is still unsolved. ⚠️ Do not let this spec become the answer to Phase 6 by the back door; morphing a male atlas towards female is exactly the fabrication D16a refuses. |

⚠️ **One thing this spec must not become.** `PHOTOREALISM_AND_PERSONALISATION.md`
§6.6 proposes `StructureFit` with a mandatory `positionSigma`, and the invariant
that *a structure may not carry a `scale` unless it also carries a
`positionSigma`*. Any work from this spec inherits that invariant. If an
implementation cannot state its own uncertainty, it is not ready to render.

---

## 3. Correction to the brief that commissioned this

The brief stated the atlases are **"~300k–400k vertices per merged mesh"**. Measured
on the shipped GLBs [M], that is low — it is roughly the *heaviest* merged mesh, not
the typical one, and the totals are 3–5× higher:

| atlas | vertices, total [M] | primitives | heaviest merged mesh [M] |
|---|---|---|---|
| `hra.ao.glb` (female) | **2,022,476** | 96 | median 4,102 tris |
| `z-anatomy.ao.glb` | **1,582,367** | 11 | musculoskeletal/muscle, 410,119 |
| `bodyparts3d.ao.glb` | **1,309,766** | 11 | musculoskeletal/muscle, 521,935 |
| `hra-m.ao.glb` (male) | **1,035,124** | 85 | median 1,206 tris |
| `anny-adult-m.glb` | 13,718 | 1 | 27,420 tris |

The correction cuts both ways, and the second half is the useful half. Per system
[M]:

| system/layer | z-anatomy | bodyparts3d |
|---|---|---|
| musculoskeletal/muscle | 410,119 | 521,935 |
| nervous/organ | 376,294 | 88,129 |
| cardiovascular/organ | 292,022 | 385,319 |
| musculoskeletal/bone | 287,378 | 126,691 |
| digestive/organ | **70,024** | **30,309** |
| musculoskeletal/connective | 65,130 | 15,949 |
| respiratory/organ | **46,236** | **32,649** |
| lymphoid/organ | 23,698 | — |
| reproductive/organ | 5,414 | 222 |
| metabolic/organ | **4,028** | **55,849** |
| endocrine/organ | **2,024** | **1,869** |
| integumentary/organ | — | 50,845 |

**The organs an abdominal/thoracic SSM would actually touch — digestive, metabolic,
respiratory, endocrine — total 122,312 vertices on Z-Anatomy and 120,676 on
BodyParts3D** [M]. That is a third of the brief's figure, and it changes the VRAM
answer from "infeasible" to "affordable but not free" (§7).

⚠️ Adding `cardiovascular/organ` takes it to ~414k / ~416k, because in both atlases
that mesh is mostly the vascular tree rather than the heart. **A heart SSM cannot be
paid for at heart prices** under the current merge — see §7's sparse-accessor
finding for why that is not fixable at load time.

---

## 4. The finding that reframes the project

**Vertex correspondence does not exist anywhere in this repository.**

glTF is normative that morph target accessors must have the same `count` as the base
primitive, and targets carry no `indices` at all [R] — so **shared topology is a
precondition, not an optimisation**. Both a statistical shape model and a morph
target need the same thing: N shapes with identical vertex counts, identical index
buffers, and vertex *i* meaning the same anatomical point in every one.

Measured: `hra.ao.glb` against `hra-m.ao.glb` — same publisher, same pipeline, same
release, the closest pair of assets in the repo. Label-matched 33 organs across the
two builds. **Zero of 33 share a vertex count** [M]:

| organ | female verts | male verts |
|---|---|---|
| liver | **17,203** | **7,151** |
| pancreas | 3,225 | 5,899 |
| spleen | 2,138 | 2,532 |

If two builds from one publisher have no correspondence, no pair drawn from seven
independently authored atlases will either. And the CT-derived assets are worse than
merely uncorresponded: `htb-ct-f`'s labels are **grouped** — one Ribcage rather than
24 ribs, one Spine rather than 24 vertebrae, long bones merging left and right —
and the source images sit behind the NIH Controlled Data Access Policy, so it
**cannot be re-segmented finer** (recorded in `licences.json`).

### What this means for how the project is framed

**This is a registration project with a rendering feature at the end, not a
rendering project.** The order of difficulty, hardest first:

1. Establishing correspondence across a population — the actual work.
2. Getting training data whose labels are trustworthy (§6).
3. Fitting the model to a specific person.
4. PCA. This is `numpy.linalg.svd` and is nearly free.
5. Getting it into glTF and onto a headset. Mechanical, and §7 shows the data model
   is a 1:1 match.

Every survey of this space, including the brief, implicitly puts (5) first because
that is the part with the interesting numbers. ⚠️ **The numbers in §7 are the least
load-bearing numbers in this document.**

There is exactly one honest way to get correspondence, and this repo has already
written it down [R]: **do not ship the extracted mesh — ship a copy of the atlas
mesh non-rigidly deformed onto the target.** Deform the template and never remesh,
and correspondence is preserved by construction. That single choice is
simultaneously the morph-target precondition, the SSM precondition, and what keeps
the `_STRUCTURE` → ontology-ID join alive across a personalisation step.

---

## 4a. What the literature actually reports

Added after §1–§14 were first drafted, and **it moved the recommendation** — see §1's
reassessment box. Every DOI below was checked against Crossref [L].

### The three accuracies that get conflated, all on the same 43 livers

**Lamecker, Lange & Seebass, ZIB-Report 04-09 (2004)** builds a liver SSM from
**43 CTs** and needs **21 modes for 95 % of variance** [L]. It reports three numbers
that are routinely quoted interchangeably and are not the same quantity:

| what is measured | value [L] |
|---|---|
| **reconstruction** — fit the model to a shape that was in its own training set | **0.9 mm** |
| **leave-one-out generalisation** — fit to a shape the model has never seen | **1.9 ± 0.3 mm** |
| **end-to-end segmentation** — the model driving a segmentation of a fresh image | **2.3 mm** |

⚠️ **A factor of 2.5 separates the first from the third, and papers cite whichever
flatters them.** Any accuracy figure in a commit message, a UI string or a future
revision of this document must say which of the three it is. This is the same class
of trap as the scale-versus-shape mode count in §11(3), and it is more common.

### A measured training-size curve, which is genuinely rare

From the same work, leave-one-out error against training-set size [L]:

| training shapes | LOO error |
|---|---|
| 20 | 3.0 mm |
| 30 | 2.6 mm |
| 42 | 2.3 mm |

⚠️ **And the paper states convergence was NOT observed at N = 43.** So its own
headline accuracy is a lower bound on what the method can do, not a ceiling.

**Where convergence actually sits: ~200 subjects.** Audenaert et al. 2019
(DOI 10.3389/fbioe.2019.00302), **542 datasets**, finds LOO error converging at
roughly **160 (calcaneum) to 210 (pelvis)** and explicitly recommends **a minimum of
200 training samples** [L]. ⚠️ **That is for bone, which is less variable than
viscera** — so 200 is a floor for the abdomen, not a target.

### The accuracy floor is annotation, not the model

**SLIVER07 defines average human manual liver segmentation at ASD 1.0 mm, and the
best SSM-based automatic method in that challenge reached ASD 0.95 mm** [L].

This is the single most important number in this section, and it cuts two ways:

- **Encouraging:** SSM liver pipelines reached human inter-observer agreement by
  around 2009 and have not moved much since. The achievable accuracy is *known* and
  it is excellent — **1 mm is 13–27× finer than the 1.3–2.7 cm the liver moves every
  breath** [R]. An SSM-derived liver is limited by physiology long before it is
  limited by the model.
- ⚠️ **Sobering, and it is the counterweight to the sample-size argument in §6:** if
  the floor is annotation quality, then **more labels of worse quality do not
  necessarily help.** This is exactly the trade the TotalSegmentator dataset offers.

### Organ variability is intrinsic, isolated from method

**Cerrolaza et al. 2015** (DOI 10.1016/j.media.2015.04.003) runs the same pipeline at
matched **N = 18** on abdomen and brain [L]:

| target | error |
|---|---|
| abdominal multi-organ | **3.35 ± 1.19 mm** |
| brain | **0.68 ± 0.17 mm** |

**~5× worse for the same method at the same sample size.** That isolates organ
variability from algorithm choice, and it is why "SSMs work well" from the
neuroimaging literature does not transfer.

**Per-organ ranking** — Okada et al. 2015 (DOI 10.1016/j.media.2015.06.009), **134
CTs**, Dice [L]:

| organ | Dice | verdict for this project |
|---|---|---|
| liver | **94.1** | ✅ in scope |
| spleen | ≈ liver | ✅ in scope |
| kidneys | > 92 | ✅ in scope |
| **pancreas** | **~73** | ⛔ **descope** |
| **gallbladder** | **53–72** | ⛔ **descope** |

⚠️ **Read the caveat with the table: Dice flatters large organs**, so this overstates
the shape-variability gap between liver and pancreas. The ranking is sound; the
magnitude is not. Do not quote the gap as if it were a shape metric.

This replaces a guess with evidence. §11 previously said "expect pancreas, adrenals,
gallbladder to be hopeless" citing `[R]`; that expectation is now measured, and
descoping pancreas and gallbladder is a decision the numbers support rather than a
hedge.

### There is no fitted model to download for any organ we care about

**No ready-made SSM exists for liver, spleen, pancreas, stomach or kidneys** [L]. The
only downloadable fitted models are cardiac:

- **Cardiac Atlas Project** biventricular modes. ⚠️ **The page states no licence** —
  which is the same failure mode as XCAT, ViP and ICRP 110 in §5, and it is now in
  that group in §10's table.
- **UK Digital Heart Project** model, 1,093 hearts, **100 PCs for > 99.9 % variance**
  [L]. Licence **[NR]**.

So the model has to be built. There is nothing to adopt, which removes the cheapest
imaginable shortcut and is part of why §9's pilot is the gate.

### Tooling corroboration

**ShapeWorks came out best on compactness** in the one head-to-head benchmark —
Goparaju et al. 2022 (DOI 10.1016/j.media.2021.102271) [L]. ⚠️ **That paper reports
compactness, generalisation and specificity as figures only, with no tabulated
numbers**, so the *ranking* is citable and no *number* from it is. Worth stating,
because a future reader will go looking for the table and there isn't one. It does
independently support §10's MIT recommendation.

### ⚠️ Two published figures not to propagate

Recorded rather than dropped, in the manner this repo records dead ends:

1. **Foruzan et al. 2014 reports a 0.029 mm liver reconstruction error** [L]. That is
   sub-voxel by roughly two orders of magnitude on any clinical CT and is **almost
   certainly a mislabelled unit.** Do not cite it, and do not let it into a
   comparison table as an outlier — it will be read as a target.
2. **Mesh2SSM's left-atrium Table 2 contradicts its own narrative** [L]. Same
   treatment: do not quote either the table or the narrative without resolving which
   is right.

Both are the kind of thing that survives in a literature review because nobody
re-reads the number against the physics. This document's own §13 exists for the same
reason.

---

## 4b. Is organ position predictable from the body surface?

**Partially, and nowhere near well enough.** This section is the evidence for §1(1),
and it is the most useful thing in this document because it *bounds* the project
rather than describing it. Two independent literature reviews reached this conclusion
by different routes and are consolidated here.

### Borrow the field's own vocabulary

**AAPM Report No. 246** (`aapm.org/pubs/reports/RPT_246.pdf`, p. 23) grades phantoms
in four tiers [L]: **reference** → **patient-dependent** → **patient-sculpted** →
**patient-specific**. *Patient-sculpted* means precisely *"outer body contour
reshaped to the individual, internal anatomy NOT individualized"* — which is exactly
what a skin-envelope-driven atlas would be. Using the field's own term makes the
claim arguable instead of rhetorical: **this repo would be shipping a
patient-sculpted phantom while the interface implied a patient-specific one.**

### The number the no-go rests on

**Segars et al. 2014, DOI 10.1118/1.4901554**, 58 adult + 69 paediatric CT [L]:

| predictor → target | adult r² |
|---|---|
| external body dimensions → **organ axial position** | **≤ 0.439** |
| external body dimensions → **organ volume** | **≤ 0.410** |

Both are *maxima* (right lung against height). Weight predicts worse; BMI and age are
near-zero. **More than half of adult internal anatomical variance is not encoded in
the exterior.**

### ⚠️ The asymmetry that makes the phantom literature sound optimistic

The same paper gives **children r² ≈ 0.79–0.89** for organ position against
height/age [L]. External size genuinely does predict internal anatomy *during
growth*, and poorly *in adults*.

⚠️ **Much of the encouraging phantom-matching literature is paediatric. Paediatric
results must not be read as licensing adult claims.** A surface-driven atlas would
inherit paediatric-grade plausibility and adult-grade unreliability — and this repo
ships a `child` envelope preset alongside adults (D16), so the temptation to
generalise across them is built into the UI.

### The error plateaus rather than vanishing

This kills the obvious response, *"use a better external measure"*.

**Stepusin et al. 2017, DOI 10.1002/mp.12502**, 52 patient-specific phantoms — CT
organ-dose RMS error [L]:

| matching method | RMS error |
|---|---|
| reference phantom | 39.1 % |
| height + weight | 20.3 % |
| best water-equivalent diameter | **17.6 %** |

**Roughly half the error is irreducible by external matching**, and the last
sophisticated step buys 2.7 pp. Corroborated at scale by **Ye et al. 2025,
DOI 10.1002/mp.17796**, 10,281 subjects: patient-specific organ doses span **33–164 %
of the ICRP reference**, with *"profound inter-individual variability … even when only
comparing subjects having similar BMI or WED"* [L].

**Whalen et al. 2008, DOI 10.1088/0031-9155/53/2/012**: residual organ-*volume*
uncertainty after the best external match is **14–20 %**, and **the spleen sits at
~40 % regardless of which external measure is used** [L] — a clean worked example of
an organ whose size simply is not encoded in body shape.

### The geometric number, which is the one that matters for rendering

**Fu et al. 2021 (iPhantom), DOI 10.1109/JBHI.2021.3063080**, leave-one-phantom-out
over 50 XCAT phantoms [L]:

| method | organ Dice |
|---|---|
| **affine transform of a size-matched template** | **0.2–0.6** |
| diffeomorphic registration | 0.8–0.9 |
| organ actually segmented from the patient | 0.9+ |

⚠️ **At Dice 0.2–0.6 organs come out recognisably mislocated, not approximately
right.** That framing is worth keeping, because "approximately right" is what a
reader will assume a morph slider does.

And for a transform with no learned prior at all — **Yao & Summers 2009,
DOI 10.1007/978-3-642-04271-3_2**: abdominal organ localisation error after global
spine-based alignment alone is **62 ± 28.5 mm**, falling to 5.8 ± 1.5 mm only after
optimisation against *the patient's own CT* [L]. The 62 mm is roughly what a
transform-only atlas gives; the 5.8 mm is unavailable without the scan.

### What the best possible surface-driven model achieves

**Kats et al. 2025 (arXiv:2503.23468) and 2026 (arXiv:2601.18260)**, ~10,000 German
National Cohort whole-body MRI [L]:

| | value |
|---|---|
| Dice (best model) | 0.79–0.81 |
| mean ASSD | ~8 mm |
| **95th-percentile localisation offset** | **29–36 mm** |
| liver Dice | 0.71 |
| thyroid Dice | **0.24** |
| with only 100 training examples | Dice 72.4, ASSD 10.1 mm, 95th pct 49 mm |

Three things follow, and each independently damages the skin-envelope route:

1. ⚠️ **The anterior–posterior axis is significantly degraded** while lateral and
   cranio-caudal are sub-10 mm [L]. **That is exactly the axis a skin envelope
   carries least information about**, since the skin sits at a near-constant offset
   from the front and back of the body cavity. It is also the axis a viewer rotates
   around, so the worst-predicted direction is the most-looked-at one.
2. **The accuracy is bought with ~10,000 paired internal scans, not with geometry.**
   This is a learned statistical prior, not a transform. And the cohort behind it
   (NAKO) is in this repo's `licences.json` `closed` list on signed-MTA grounds.
3. A **95th-percentile offset of 29–36 mm** is the number a user would actually
   encounter, not the 8 mm mean.

⚠️ **Cite the arXiv ids.** The 2026 preprint prints `doi:
10.59275/j.melba.2024-AAAA`, an unfilled LaTeX placeholder.

**The best-case upper bound: OSSO** (Keller et al., CVPR 2022, arXiv:2204.10129)
infers the **skeleton** from the body surface at **8.0–8.4 mm** mean landmark error,
~20 mm at the iliac crest [L]. Bone is rigid, close to the skin, and *drives* the
surface — the easiest possible target. **Soft organs must be worse than 8 mm.**

### The physiological floor underneath all of it

No static model of any construction can beat this, so it caps the whole ambition.

| motion | figure | source [L] |
|---|---|---|
| liver, quiet breathing (SI) | **10–25 mm** (range 5–40) | AAPM TG-76, Keall et al. 2006, DOI 10.1118/1.2349696 |
| pancreas, quiet breathing | 20 mm (0–35) | ″ |
| kidney, quiet breathing | 11–19 mm (5–40) | ″ |
| liver, deep breathing | 37–55 mm (21–80) | ″ |
| liver residual **deformation** after removing rigid translation | **~10 mm**, 34 mm worst location | Rohlfing et al. 2004, DOI 10.1118/1.1644513 |
| **kidneys, supine → standing** | **5–75 mm, mean 36 mm** | Reiff et al. 1999, DOI 10.1016/S0360-3016(99)00208-4 |

⚠️ **A correction to this repo's own prior research.**
`PHOTOREALISM_AND_PERSONALISATION.md` §6.1 states that *"supine → upright shifts
[the liver] about 1.5 mm"* and concludes **"do not move organs with [posture]"** [R].
Reiff measures **kidneys** shifting a mean of 36 mm supine→standing, with shape change
[L]. The two are not directly comparable — different organ, different axis — but the
*generalisation* does not survive: postural visceral repositioning is not uniformly
below the respiratory floor. Recorded rather than reconciled; register item 22.

TG-76 also states outright that *"there are no general patterns of respiratory
behavior that can be assumed for a particular patient prior to observation"* [L].

### Surface-to-internal correlation, measured by the field that cared most

Radiotherapy has spent two decades measuring this directly [L]:

| study | finding |
|---|---|
| **Zeng et al. 2022**, DOI 10.1002/acm2.13740 | Surface held to ±3 mm → **residual internal motion 3–21 mm, mean 10 ± 5 mm** |
| **Mao et al. 2022**, DOI 10.3389/fonc.2022.868076 | Diaphragm↔tumour r = 0.95 ± 0.06; **belly surface↔tumour 0.76 ± 0.29, unreliable in ~50 % of patients** |
| **Hoisak et al. 2004**, DOI 10.1016/j.ijrobp.2004.07.681 | Correlation 0.99 → 0.39; only **1 of 5** patients consistent day to day |
| **Song et al. 2022**, DOI 10.1002/acm2.13748 | Surface ROI ↔ diaphragm r = 0.28–0.67, best 0.75 (**R² ≈ 0.56**) |
| **Huijskens et al. 2018**, DOI 10.1186/s13014-018-1108-9 | **Right diaphragm ↔ right kidney R² = 0.003** (p = 0.60) |

⚠️ **The Huijskens figure is the most quotable line in this document.** If a directly
adjacent *internal* structure explains 0.3 % of kidney position, skin will not do
better. Meijer et al. 2023 (DOI 10.1186/s13014-023-02307-3, 189 children) concludes
outright that diaphragm motion *"may not be a sufficient surrogate for abdominal organ
motion"* [L].

**The single strongest negative citation** — **Freislederer et al. 2020,
DOI 10.1186/s13014-020-01629-w** [L]:

> "Several studies have shown a poor correlation between movement of the patient
> surface and movement of internal targets. Large shifts up to about 3 cm were
> observed for targets in the abdomen"

### Bottom line, as a number

**Deform an organ atlas by a skin-surface transform and expect 10–20 mm error for
large organs, 20–40 mm for small or deep ones, and 40–60 mm with no learned prior.**
Against organs that are 40–150 mm across, that is not personalisation.

---

## 4c. ⚠️ Figures that do not survive checking

Circulating numbers that look authoritative and are not. Recorded because a reader
will meet them, and because this repository's practice is to record dead ends rather
than quietly avoid them.

| figure | problem |
|---|---|
| **Foruzan et al. 2014**, liver reconstruction **0.029 mm** | Sub-voxel by ~two orders of magnitude on any clinical CT. Almost certainly a mislabelled unit. Do not cite, and do not include as an outlier — it will be read as a target. |
| **Mesh2SSM**, left-atrium Table 2 | Contradicts the paper's own narrative. Resolve which is right before quoting either. |
| **OSSO "1.68 mm feet / 1.37 mm hands"** | **Absent from the paper.** The paper's figures are 8.0–8.4 mm mean landmark error. |
| **Liver volume from BSA, "r² = 0.962"** | Contradicted by Vauthey et al. 2002 (DOI 10.1053/jlts.2002.31654), n = 292: **r² = 0.46 from BSA, 0.49 from weight**. Use Vauthey. |
| **AAPM 246's own "11 % and 15 %"** attributed to Tian et al. 2016 | ⚠️ Subtle: the figures **are** in AAPM Report 246, but those strings **do not appear in the cited paper** — a report-level mis-citation. So the report may be quoted for it, the primary may not, and it is safer to use Stepusin or Ye instead. |
| **Goparaju et al. 2022** compactness numbers | The paper reports compactness/generalisation/specificity **as figures only, with no tabulated numbers**. The *ranking* is citable; no number from it is. |

⚠️ **The BOSS citation is demoted.** §1 previously rested on BOSS (Shetty et al. 2023)
reporting 8.11 mm from metadata against 8.68 mm from the skin surface [R]. It **could
not be re-verified in this session** (search budget exhausted), and the phantom
literature review never encountered it while reaching the same conclusion by an
independent route. It is therefore **not load-bearing** — §1 stands on
Segars/Stepusin/Fu. Kept only as a pointer, and as register item 18.

---

## 5. Deformable computational phantoms — the closest prior art, and mostly unusable

This is the field that already did "an anatomical model you can deform to a person",
for radiation dosimetry. Under D12b the question is not whether they are good; it is
whether their licence is *knowable*.

**It mostly is not, and that is the finding.** Three of the four flagship families
publish **no licence text and no price** on their own distribution pages. Verified by
fetching those pages on 8 August 2026:

| phantom | page fetched | what the page states about licence/cost |
|---|---|---|
| **XCAT** (Segars, Duke CVIT) | `cvit.duke.edu/resource/xcat-phantom-program/` | **No licence terms, no cost, no redistribution statement.** The only action is a "Request Resource" link to a Duke REDCap form. Terms are communicated through the request, not published. [V] |
| **IT'IS Virtual Population (ViP)** | `itis.swiss/virtual-population/virtual-population/vip3` | **No licence terms, no pricing, no tier information.** The page routes V3-x/V4-x to the Sim4Life sales team and V1-x to the Virtual Population Group by email. [V] |
| **ICRP Publication 110** | `icrp.org/publication.asp?id=ICRP Publication 110` | Describes the reference male/female voxel phantoms and states the numerical data ships on a **CD-ROM accompanying the printed publication**. **No pricing, no licence, no redistribution terms on the page.** [V] |
| **MIDA** (IT'IS + FDA) | — | **[NR]** Not fetched. Same publisher as ViP, so expect the same request-gated pattern; do not assume it. |

### The verdict, and it is not a close call

⚠️ **Under D12b these are unusable, and the reason is precisely the one D12b already
identified as the worst case.** Report 05 in `docs/reports/` puts it as: *an
unstated licence is stricter than a non-commercial one*, because silence grants
nothing and attribution cannot manufacture a grant. This repo already carries one
such item — Z-Anatomy's University of Washington white matter, 3 structures, top of
the licence log's action list.

A request-gated resource is worse than an unstated one for this project
specifically, because:

- **What comes back is a bilateral agreement, not a public licence.** Even a
  generous one grants rights to the requester, and this repository's entire model is
  redistributing a bundled asset with credit. An agreement that does not permit
  sublicensing is not reachable by D12b — the same reason Zygote, UK Biobank and
  NAKO sit in `licences.json`'s `closed` list. D12b is a policy about our own
  licence stance; **it cannot reach an agreement with somebody else.**
- **It cannot be planned around.** A phased plan whose Phase 1 is "email Duke and
  hope" is not a plan.

**Non-commercial would have been fine** — this project is non-commercial and D12b
says so explicitly. Unstated is not fine. The distinction matters and is easy to
blur; do not write "restrictive licence" in a summary where the truth is "no licence
published".

### The structural finding, once the whole field is surveyed

**The field splits cleanly and unhelpfully in two** [L]:

- Every phantom with **deformable, organ-level geometry** is **non-redistributable**.
- Every **redistributable deformable** model has **no viscera** — skeleton, skin and
  muscle only.
- Every redistributable **organ set** is **static** geometry.

**There is no existing open deformable whole-body anatomy. The seam has to be built,
not downloaded.** That is the same conclusion §4 reaches from correspondence, arrived
at independently from licences.

### Three corrections to the brief's premises, all verified [L]

1. **ICRP 143 is not the mesh-type phantom set.** 143 is *Paediatric Computational
   Reference Phantoms* (voxel). The **adult mesh-type phantoms are ICRP 145**; the
   paediatric mesh set is **ICRP 156**.
2. **ANNY is not a MakeHuman anatomy model.** It is a parametric *body shape* model
   reusing MakeHuman/MPFB2-derived CC0 shape data. It contains **no organs** —
   consistent with D16 and with `bodyEnvelopes.ts`'s own warning.
3. ⚠️ **MakeHuman's mesh may not be simply CC0.** The repository data is reported as
   **AGPL-3.0**, with CC0 attaching only to characters exported from an *"OFFICIAL and
   UNMODIFIED version of MakeHuman"* [L]. **This directly contradicts** this repo's
   `[R]` position (`PHOTOREALISM_AND_PERSONALISATION.md` §6.3), which states the
   current licence covers assets generated via scripting and that the
   unmodified-build caveat is obsolete. ⚠️ **This touches a shipped asset** —
   `licences.json` declares ANNY's shape assets CC0-1.0 — so it outranks everything
   else in this document for urgency. Register item 19; unresolved, and **not** to be
   settled by picking the convenient reading.

### The organ-dose error measurements — register item 2, now resolved

This was named as the highest-value remaining search, and it is answered. The
dosimetry field's direct measurement of *how wrong you are when you infer organs from
outside* [L]:

| source | finding |
|---|---|
| **AAPM Report 246** uncertainty budget | *"Phantom type"* (how well the phantom resembles the patient) **3–66 %**; *"patient matching"* **10–15 %** |
| **Zhang et al. 2012**, DOI 10.1118/1.4718576 | Across four reference phantom types: **3–38 %** for fully irradiated organs, **7–66 %** partially |
| **Johnson et al. 2011**, DOI 10.1118/1.3544353 | Height/weight matching improved organ dose 50–120 % over a stylized phantom — but for lighter patients was *"not significantly better than using a reference hybrid phantom"*. Names **"anatomical error, which is inherent due to differences in organ size and location"** as a residual |
| **Stepusin 2017 / Ye 2025** | §4b — the plateau, and 33–164 % spread over 10,281 subjects |

AAPM 246's own summary of the cause is the sentence to keep: *"uncertainties were
mainly introduced by variation in organ location and spatial distribution."*

⚠️ **And the canonical "variable phantom population" was not built from
anthropometry.** Segars et al. 2013 (DOI 10.1118/1.4794178) built the 58 anatomically
variable XCAT phantoms from **segmented patient CT**, scaling only heads, arms and
legs from the reference model; validation was *qualitative inspection, with no
quantitative accuracy metrics* [L]. Even the field's flagship deformable population
needed internal imaging.

### ⚠️ The IT'IS clause that is incompatible with a browser

ViP's terms bar distributing data or derivatives (clause 2.3.2), which alone closes
it. But clause **2.3.4** is worth recording for its own sake [L]:

> "When the Model Data is loaded, it must neither be read from the computer memory or
> graphics card memory nor be intercepted on the data bus"

Read literally, **that is incompatible with rendering in a WebGL context at all.** A
genuine conflict, not a technicality.

### The recurring trap: an article's licence is not the model's

This bites three times [L] — MIDA (CC0 *paper*, restricted data), NEVA (CC0 paper,
commercial download), VIVA+ (CC BY *paper*, LGPL-3.0 model). **Cite the model's own
LICENSE file, never the paper's.** Same failure mode as §10's GitHub-badge warning.

### What is actually usable, and one of these is a serious find

Verified redistributable [L]:

| resource | licence | what it is |
|---|---|---|
| **SPARC organ scaffolds** + `scaffoldmaker` | **Apache-2.0** (© University of Auckland); datasets typically **CC BY 4.0** — verify per landing page | ⭐ **The closest structural match to this project in existence.** Per-organ cubic-Hermite FE scaffolds **fitted to specimen point clouds**, **annotated to UBERON-derived vocabularies**. Bladder, brainstem, cecum, colon, oesophagus, GI tract, heart, lung, small intestine, stomach. ⚠️ **No liver, kidney, spleen or pancreas** — the four organs §4a says are most tractable |
| **Visible Human Project** imagery | **US Government work, not subject to copyright** | The only unencumbered raw material. ⚠️ Imagery only, no segmentation, and NLM's terms **do not flow to derivatives** — verified empirically: Zubal contains VHP limbs and still forbids redistribution |
| **VIVA+ v2.0.2** / VIVA OpenHBM | **LGPL-3.0** | The only redistributable deformable whole-body FE model. ⚠️ **No viscera** — lumped Ogden cavities |
| **PIPER** framework | **GPL-2.0-or-later**; bundled anthropometry CC BY 4.0 | A working open personalisation/morphing engine, already wired to VIVA+ |
| **Rajagopal full-body** | **MIT** | Bones + muscle paths, no organs |
| **FDA VICTRE `breastPhantom`** | **CC0 1.0** | Breast only, parametric. Repo archived Jun 2026 |
| **ANNY** | Apache-2.0 + CC0 assets | Already shipped (D16) — ⚠️ subject to the MakeHuman question above |

⚠️ **SPARC deserves a decision of its own.** It is per-organ, ontology-annotated,
Apache-2.0, and *designed* to be fitted to individual specimen data — which is
precisely §4's "deform a template, never remesh". That it lacks liver, kidney, spleen
and pancreas is the catch, and it means SPARC is a **complement** to a home-built SSM
rather than a replacement for one. It is the highest-value item in this table and is
not in `licences.json`.

### The two live leads, both blocked only by paperwork

- **ICRP 145** — OBJ + MTL, both sexes, deformable, 1.75 GiB, free, **no
  registration**; technically ideal and legally all-rights-reserved. ⚠️ The **Geant4
  precedent** shows ICRP does grant redistribution to projects that ask (CERN hosts
  ICRP-110 data *"with the kind permission of the ICRP"*) — **but that permission is
  bilateral and non-transitive**, so it would not travel to anyone forking this repo.
  The thing to request from `permissions@icrp.org` is *sublicensable* redistribution,
  which as far as could be verified has never been granted publicly.
- **GDN / UFPE** (`dosimetrianumerica.org`) — four OBJ meshes, **124–138 labelled
  structures**, both sexes, free to download today, **zero licence text**, and nobody
  appears to have asked. ⚠️ **That site is an unmaintained WordPress 4.8.2 with an
  injected spam link. Treat any download with care.**

Also verified closed, so nobody re-checks: Zubal (*"do not pass along any part"*),
GSF/Helmholtz (no modify, no distribute; portal now 404s), UF/NCI (NCI Software
Transfer Agreement, non-profit only, destroy on completion, **"raw mesh format not
provided"**), RPI (built on commercial Anatomium 3D meshes whose vendor domain is now
parked for sale — rights unclearable), Toyota THUMS (free since 2021 but
registration-gated sharing only), GHBMC (proprietary), Visible Korean (destroy +
certificate of destruction), MASH/FASH (**no licence exists**), the Chinese/Korean
voxel families (paper-only, not distributed), NEVA VHP-Female (commercial).

**One published XCAT price exists**: the XCAT **Brain** Phantom at **$400 first year,
$200/yr after** [L]. The main XCAT fee remains unpublished. ICRP 110's **print** edition
is **£164.00 GBP**; the data itself is free but permission-gated.

### The closest conceptual prior art, and why it is a dead end

**Anatomy Transfer** (Dicko et al., Inria, SIGGRAPH Asia 2013) transfers bones from a
template then maps internal anatomy by harmonic deformation driven by the target skin
eroded by fat thickness — conceptually exactly the proposal under discussion. ⚠️ Its
sibling **My Corporis Fabrica** states its geometry *"are based on the Zygote human
anatomy collections"*, i.e. proprietary, and `mycorporisfabrica.org` **no longer
resolves** [L]. **iPhantom** deforms XCAT and inherits XCAT's licence problem
entirely. **XCAT 3.0 abandoned morphing** in favour of segmenting each patient's CT
directly — the *method* is open (DukeSeg, Apache-2.0), the geometry is not.

That last point is the most telling thing in this section: **the field's own flagship
moved away from morphing a template and towards segmenting the individual.** §12's
Phase 4 lands in the same place.

---

## 6. Open training data — one clean answer, and a caveat that matters more

Verified in this session:

| dataset | subjects | labels | licence | verdict |
|---|---|---|---|---|
| **TotalSegmentator Dataset v2.0.1** (Zenodo record 10047292) | **1,228 CT** | **117 structures** | **"Creative Commons Attribution 4.0 International"** [V] | ✅ **The one clean answer.** CC BY 4.0, derivatives and redistribution permitted with credit. Tier 1 under D12b. |
| **AMOS22** (`amos22.grand-challenge.org`) | **500 CT + 100 MRI** [V] | **15 organs**, named: spleen, R/L kidney, gallbladder, oesophagus, liver, stomach, aorta, IVC, pancreas, R/L adrenal, duodenum, bladder, prostate/uterus [V] | **not stated on the challenge page** [V] — hosted on Zenodo, terms unread | ⚠️ Counts good, licence **[?]**. Check the Zenodo record before use. |
| **AbdomenCT-1K** (`github.com/JunMa11/AbdomenCT-1K`) | **1000+ CT** [V] | **4 organs**: liver, kidney, spleen, pancreas [V] | **repository** Apache-2.0; **dataset licence not stated**, access via a Google Form [V]. DOI 10.1109/TPAMI.2021.3100536 [V] | ⚠️ Repo licence is not the data licence. A tracking form is not a grant. **[?]** |
| **Healthy-Total-Body-CTs** (TCIA) | already in this repo as `htb-ct-f` | grouped, 35 labels | CC BY 4.0 segmentations; images behind NIH Controlled Data Access | ⛔ **Unusable for an SSM.** Labels are grouped and cannot be re-segmented (images restricted), and it is low-dose **non-contrast** CT, so D10's contrast objection applies to the organ masks. Recorded in `licences.json`. |

**Now researched — the additional clean sources, all verified** [L]. Of ~30 candidates
these are the ones redistributable with attribution and **no** NC or ShareAlike
burden:

| dataset | licence | subjects | why it matters here |
|---|---|---|---|
| **TCIA Pancreas-CT** | **CC BY 3.0** | 80 | ✅ **the best normative source found** — 17 genuinely healthy kidney donors pre-nephrectomy + 65 screened free of major abdominal pathology |
| **TCIA C4KC-KiTS** | **CC BY 3.0** | 210 | ✅ the *same 210 cases* as KiTS19, via a permissive channel. ⚠️ KiTS19's own GitHub ships them CC BY-NC-SA — **your download provenance is your licence record** |
| **TCIA CT-ORG** | **CC BY 3.0** | 140 | ✅ liver, lungs, bladder, kidney, bones, brain. ⚠️ lungs/bones auto-segmented in the training split |
| **TCIA PSMA-PET-CT-Lesions** (autoPET-III) | **CC BY 4.0** (images, SEG *and* clinical) | 378 subj / 597 studies | ✅ **unencumbered whole-body CT imagery** — the scarce ingredient. Only lesions labelled, so generate your own |
| **SAROS** annotations | **CC BY 4.0** | 900 series / 882 patients | ✅ human-refined **body-envelope** labels. ⚠️ every 5th slice only; imagery across 28 mixed-licence collections |
| **FLARE22 50-case set** | **CC BY 4.0** | 50 | ⚠️ small, and labels re-derived from MSD (BY-SA) + AbdomenCT-1K |

**Available only at the cost of ShareAlike**: MSD/Decathlon (2,633 volumes, CC BY-SA
4.0) and VerSe (4,505 vertebrae, CC BY-SA 4.0).

**Ruled out on licence** [L]: TotalSegmentator **MR** (CC BY-NC-SA 2.0 Generic — note
the odd version), CHAOS (NC in 2 of 3 channels, and *the best healthy-organ source* —
worth an email), KiTS23, LiTS-as-LiTS, CTPelvic1K, AbdomenAtlas 1.1 (*"Redistribution
of the dataset or any portion thereof is not allowed"*), CADS, FLARE22-full/FLARE23
(no licence declared), BTCV (none found), KiTS21 (bare MIT with no data carve-out),
WORD (GPL-3.0 repo vs a README forbidding "second-development" — an SSM *is* second
development). NAKO and UK Biobank remain in `licences.json`'s `closed` list.

⚠️ **Six datasets state contradictory licences across their own official channels** —
AMOS, CHAOS, KiTS19, CTPelvic1K, LiTS and WORD [L]. Machine-readable fields at the
distribution point normally govern, but where a dataset's own paper disagrees, **do not
silently pick the convenient one.** Write to the authors and record the answer.

**MedShapeNet has no collection-level licence** — its website footer badge says
CC BY-NC-ND 4.0 (which would forbid derivatives outright) while its paper claims the
sources permit adaptation and redistribution. The operative licence is per source
dataset, and its own Table 2 conflicts with upstream in at least two places (CT-ORG as
CC0 vs TCIA's CC BY 3.0; VerSe as CC BY 4.0 vs VerSe's own CC BY-SA 4.0). **Verify per
source, never from that table.**

### ⚠️ A correction to this section, which was wrong when first drafted

The first draft of this document stated that *"TotalSegmentator's labels are partly
model-generated, and a shape model trained on them inherits the segmenter's biases as
anatomy"*, and made that the headline caveat. **That is not what the paper says.**
Verbatim [L]:

> "If an existing model for a given structure was publicly available, that model was
> used to create a first segmentation, which was then validated and refined manually"

and, decisively:

> "In the end, all 1204 CT examinations had annotations that were manually reviewed
> and corrected whenever necessary."

So the labels are **model-assisted and fully human-reviewed** for v1. The concern was
real in provenance and resolved in outcome. Recording the correction rather than
editing it away, because the wrong version would have talked the project out of its
best available dataset.

Two narrower caveats survive, and one is more serious than the original:

- **[?] v2's 13 net-new classes have no documented review procedure.** The Zenodo
  record states the paper describes v1. The v2 changelog does list systematic label
  corrections to femur, humerus, hip, aorta, liver, spleen and kidney, which is
  evidence of continued curation but not a stated protocol.
- ⚠️ **The pathology problem is real, and now quantified. Only 404 of 1,204 v1
  examinations "showed no signs of abnormality"** [L]; 645 showed tumour, vascular,
  trauma, inflammation or bleeding. A normative model built from patients scanned
  *because something was wrong* is not normative — hepatomegaly and post-surgical
  anatomy are shapes, and PCA cannot tell them from variation.

  **But the paper reports the split, so it can be filtered** — and **404 normative
  subjects still clears the ~200 convergence requirement** (§4a) with margin. That is
  the single most important number for §1's leg 2: the usable normative cohort is
  roughly 2× what the literature says is needed, from one CC BY 4.0 source.

### Annotation trustworthiness is the real filter, and it disqualifies on merit

Ranked from the same review [L]. **Fully automatic labels are disqualifying for an SSM
regardless of licence** — fitting a shape model to them measures the segmenter, and
its principal modes encode nnU-Net's systematic biases as if they were biology:

| tier | datasets | annotation |
|---|---|---|
| ✅ best | **CHAOS** | three radiologists (10/12/28 yrs), majority vote per slice |
| ✅ | **WORD**, **AMOS**, **LiTS**, **SAROS** | expert or multi-reader consensus |
| ✅ | **TotalSegmentator** | model-assisted, **all 1,204 manually reviewed** |
| ✅ | **Pancreas-CT**, **VerSe** | trainee + experienced radiologist verification |
| ⚠️ mixed | **CT-ORG** | liver/kidney/bladder/brain manual; **lungs and bones by unsupervised morphological algorithms** in the 119-case training split |
| ⛔ | **KiTS21/23** | trainee places pins, **a layperson/crowd worker delineates** |
| ⛔ | **Healthy-Total-Body-CTs** | **fully automatic via MOOSE, no stated QC** |
| ⛔ | **AbdomenAtlas 1.1**, **CADS**, **DAP Atlas** | pseudo-labels / *"expert-free dataset generation"* |

⚠️ **DAP Atlas looks like the answer to the whole-body question and is not**: no data
licence exists, the labels are explicitly expert-free model output, and the underlying
AutoPET imagery is gated. Three independent disqualifications.

### ⚠️ Two licence traps specific to this repository

**1. The ShareAlike families are mutually incompatible.** CC BY-SA 4.0 (MSD, VerSe)
and CC BY-NC-SA 4.0 (CHAOS, KiTS23, AbdomenAtlas, CTPelvic1K) cannot be combined in
one model — neither can be relicensed as the other [L]. Adopting MSD permanently
forecloses CHAOS geometry and vice versa. This repo **already** segregates a CC BY-SA
asset from its CC BY 4.0 primaries, so the same pattern applies: a **CC BY 4.0 core
model plus a separately-licensed CC BY-SA extension**, never one blended artifact.

**2. The face clause, which bites this repo harder than most.** TCIA Restricted
§3.6 [L]:

> "User will not use or further disclose any derivative works or derivative data of
> the Dataset … that could be used to reconstruct a facial image"

⚠️ **A whole-body skin envelope includes the face.** So a mesh derived from any
TCIA-Restricted or NIH-controlled head-inclusive CT is arguably exactly the prohibited
derivative — and D16 has this repo shipping skin envelopes already. This is the
strongest single argument for keeping envelopes *generated* (ANNY, scan-free) rather
than *derived*, and it is a point in favour of a decision already made.

### Answering the paired-surface question, which was register item 5

**There is a clean route, and it was not obvious** [L]:

- The **TotalSegmentator CT dataset** (CC BY 4.0) supplies 117 internal structures but
  **has no skin class** — verified against the class list.
- TotalSegmentator ships a separate **`body` task** containing `body`, `body_trunc`,
  `body_extremities`, **`skin`**, and the README lists it among the tasks *"Openly
  available for any usage (Apache-2.0 license)"* — **not** among the licence-gated
  tasks. Combined with D7a's finding that running Apache-2.0 weights imposes no
  conditions on the output, this means **Apache-2.0 weights over CC BY 4.0 imagery
  yields a co-registered skin envelope for all 1,228 subjects, cleanly CC BY 4.0.**
- ⚠️ That skin surface is then *model-derived* and must be documented as such — though
  skin is a high-contrast air/tissue boundary and far easier than an organ.
- **SAROS** is the only dataset shipping human-refined body-envelope labels
  (CC BY 4.0 annotations), but only **every 5th axial slice** is annotated and its
  source imagery spans 28 TCIA collections with mixed licences.

So paired surface-and-organ data is constructible on permissive terms. ⚠️ **Note what
that does and does not buy**: it makes §4b's question *re-testable on our own data*,
and §4b's answer says the test has already been run at 10,000 subjects and failed.
Constructing it to re-litigate leg 1 would be wasted work.

Two structural mitigations, both from this repo's own prior research [R]:

- **Register labels, not intensities.** CT soft tissue is nearly isodense (liver ≈
  spleen ≈ kidney ≈ 40–60 HU), so an intensity metric has almost no signal in the
  abdomen while a label map has a great deal. Measured elsewhere at +6 pp Dice over
  intensity-only.
- **Do not concatenate organs into one vector.** It *"induces anatomical
  inconsistencies and results in entangled shape statistics where modes reflect both
  within- and between-organ variation"*. Multi-level models reach 99 % variance in
  15 modes where global concatenation needs more than 20.

---

## 7. Runtime feasibility — verified against this repo's installed three.js

All figures in this section were read from
`node_modules/three/src/renderers/webgl/WebGLMorphtargets.js` and neighbouring files
in the installed **`three@0.169.0`** [M], not from documentation or memory.

### The brief's byte figure is right, with two corrections

```js
let vertexDataCount = 0;
if ( hasMorphPosition === true ) vertexDataCount = 1;
if ( hasMorphNormals  === true ) vertexDataCount = 2;
if ( hasMorphColors   === true ) vertexDataCount = 3;

let width = geometry.attributes.position.count * vertexDataCount;
// ... clamped to maxTextureSize, spilling into rows
const buffer  = new Float32Array( width * height * 4 * morphTargetsCount );
const texture = new DataArrayTexture( buffer, width, height, morphTargetsCount );
texture.type  = FloatType;
```

Cost is `position.count × vertexDataCount × 4 components × 4 bytes` per target. So
**16 bytes per vertex per morph target is correct — for position-only morphs.**

1. ⚠️ **`vertexDataCount` is a cascade, not a sum.** Morphing normals makes it 2
   (**32 B**); morphing colours makes it 3 (**48 B**) *whether or not normals are
   morphed*. Both big atlases carry `COLOR_0` as a base attribute, which is harmless
   — only `geometry.morphAttributes.color` trips the 3× path. But the atlases carry
   **baked AO in `COLOR_0`**, and `build-biv-heart.mjs` already records why that
   matters: AO baked at one shape is wrong at another. Fixing that properly means
   morphing `COLOR_0`, i.e. **48 B/vertex/target**. Budget for it or accept flatter
   shading, as `biv-heart` did.
2. ⚠️ **Budget the figure ~2.75×, not twice.** My first draft said twice. An
   independent read of the same source found **three** live copies for a
   position-only target:

   | copy | cost | why it persists |
   |---|---|---|
   | GPU texture (RGBA32F) | 16 B/vert/target | the actual upload |
   | CPU mirror (`texture.image.data`) | 16 B/vert/target | `WebGLTextures.js` never sets `image.data = null` after `texImage3D` |
   | source `morphAttributes` BufferAttributes | **12 B/vert/target** | retained on the geometry; must be disposed manually |

   **≈ 44 B/vert/target until you explicitly dispose the source attributes**, and on
   Quest's unified memory all three draw from the same pool.

3. ⚠️ **25 % of position-morph VRAM is padding zeros.** The writer stores
   `x, y, z, 0` into an RGBA32F texel — a VEC3 delta occupies a full 4-component
   texel. Unavoidable in three.js's path; avoidable in a custom one (§7's option C).

4. **Row-wrap padding makes the effective rate slightly worse than 16.** Replicating
   the allocation exactly gives **16.10 B/vert/target at 350k vertices and 17.48 at
   30k** (32,768 texels allocated for 30,000 vertices). At `maxTextureSize` 4096 the
   byte totals move by under 1 % — the clamp changes texture *shape*, not size.

`texture.type = FloatType` is unconditional, which kills two hoped-for savings:

- **`EXT_meshopt_compression` / `KHR_mesh_quantization` int8 deltas save download
  size only.** They are expanded to float32 in this buffer regardless.
- **glTF sparse accessors save download size only.** `GLTFLoader.js` does read them
  (~line 3128) but expands them into a dense `BufferAttribute`:
  ```js
  for ( let i = 0, il = sparseIndices.length; i < il; i ++ ) {
    const index = sparseIndices[ i ];
    bufferAttribute.setX( index, sparseValues[ i * itemSize ] );
  ```
  ⚠️ **This is the most consequential line in this section.** Runtime cost is set by
  `position.count` — the whole merged primitive — even if one liver inside it moves.
  Under the current merge, a liver morph pays for all 70,024 vertices of Z-Anatomy's
  digestive tract and a heart morph pays for all 292,022 of the cardiovascular mesh.
  **A per-organ SSM requires re-splitting the merged meshes**, which changes draw
  calls (currently 11 on Z-Anatomy) and is a real cost, not a build-flag change.

### VRAM arithmetic, position-only, `vertices × 16 × N`

| vertices | N=1 | N=8 | N=20 | N=60 |
|---|---|---|---|---|
| 30,000 (decimated organ) | 0.5 MB | 3.8 MB | 9.6 MB | 28.8 MB |
| **122,312** (z-anatomy organ subset [M]) | 2.0 MB | 15.7 MB | **39.1 MB** | 117 MB |
| 350,000 (brief's figure) | 5.6 MB | 44.8 MB | 112 MB | 336 MB |
| **1,582,367** (whole Z-Anatomy [M]) | 25.3 MB | 202 MB | **506 MB** | 1.52 GB |

Multiply by ~2.75 for all three retained copies, and by 2 or 3 again for morphed
normals or colours.

**Verdict: whole-atlas morphing is infeasible at any useful mode count. The organ
subset at 20 modes is 39 MB GPU / ~108 MB across all three copies — affordable, not
free.**

### ⚠️ But VRAM is not the binding constraint. Throughput is.

This is the correction that matters most in §7, and my first draft had it as an open
`[?]`. Vertex-shader `texelFetch` count, stereo at 72 Hz, position-only — and recall
the `!= 0.0` skip **never fires for an SSM**:

| scenario | fetches/eye/frame | fetches/sec |
|---|---|---|
| 350k × 1 | 0.35 M | 0.05 G |
| 350k × 8 | 2.80 M | 0.40 G |
| **350k × 20** | 7.00 M | **1.01 G** |
| **350k × 60** | 21.00 M | **3.02 G** |
| 122k × 20 (organ subset) | 2.44 M | 0.35 G |
| 30k × 20 | 0.60 M | 0.086 G |
| 30k × 60 | 1.80 M | 0.26 G |

**350k × 60 is infeasible on throughput, not memory.** 3 G dependent random-access
float4 fetches per second in the vertex stage, against **68 GB/s shared bandwidth**
and a **13.8 ms** frame budget, is not survivable. The 322 MB would arguably fit; the
fetches will not.

For scale: Meta's own (Unity) budget for Quest 3 is **1.3–1.8 M triangles/frame**, so
**350k vertices is already ~20–25 % of the frame triangle budget before any
morphing** [L]. ⚠️ Meta publishes **no** WebXR triangle budget and **no** per-page
memory ceiling — the 8 GB figure is an inference from the SoC, not a citable Meta
statement.

**`GL_OVR_multiview2` is present on Quest 3** [L]. It halves the vertex work and is
**essential** if this route is taken at all.

### Ceilings, now measured rather than guessed

Quest 3 / Adreno 740 driver values [L]. My first draft listed these as `[?]`:

| limit | value | bearing |
|---|---|---|
| `MAX_VERTEX_UNIFORM_VECTORS` | **256** — exactly the ES3 minimum, **zero headroom** | `morphTargetInfluences[N]` lives here, shared with the structure-mask LUT, hull flag and metrics ramp. ⚠️ Whether a float array packs 1-or-4-per-vec4 is driver-dependent; worst case this caps target count in the low hundreds. **Still `[?]` for Adreno specifically.** |
| `MAX_ARRAY_TEXTURE_LAYERS` | 2048 | One layer per target, so not binding — ⚠️ **but three.js never queries it.** Exceeding it yields a raw GL error, not a warning. |
| `MAX_TEXTURE_SIZE` | 16384 driver, **browser-clamped to 8192** on Android 14 (4096 below it) | Chromium `gpu_driver_bug_list.json` entries 456/147. **Use 4096 as the portable floor.** |
| `MAX_VERTEX_TEXTURE_IMAGE_UNITS` | 16 | Vertex texture fetch works — the whole approach depends on this |

⚠️ **One dependency remains genuinely unverified**: an RGBA32F `texelFetch` in a
*vertex* shader on real Quest Browser. No public WebGL report for Quest Browser
exists. A ~20-line test page settles it and should precede any commitment.

**glTF spec, checked**: *"The number of morph targets is not limited"*, but clients
*SHOULD* support at least **eight morphed attributes** [L]. So 20 or 60 targets is
spec-legal and **past the interoperability floor** — fine for this app, not fine for
an asset intended to load anywhere.

### Three ceilings that are not VRAM

1. `morphTargetInfluences[ MORPHTARGETS_COUNT ]` is a **vertex uniform float array**.
   WebGL2 guarantees only 256 vertex uniform vectors, shared with everything else
   this repo's shaders declare — the structure-mask LUT, the hull flag, the metrics
   ramp. `structureMask.ts`'s own comment already records choosing a texture over a
   uniform array for exactly this reason. 60 modes is a meaningful fraction of the
   guaranteed budget. **[?] on Quest specifically — needs measuring on device.**
2. The vertex shader loops `MORPHTARGETS_COUNT` times per vertex:
   ```glsl
   for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
     if ( morphTargetInfluences[ i ] != 0.0 )
       transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
   }
   ```
   The early-out makes inactive targets nearly free — ⚠️ **but a fitted SSM has no
   inactive modes.** Every coefficient is non-zero, so all N dependent
   `texelFetch`es run for every vertex, every frame, every eye. 122k × 20 = 2.4 M
   fetches per frame per eye. **[?] whether a Quest 3 sustains that at 72 Hz. This
   is the measurement §9 must make.** `biv-heart` is not evidence here: its 24
   targets are an *animation*, where one or two weights are non-zero at a time.
3. `computeBoundingBox()` / `computeBoundingSphere()` union the extremes of **every**
   morph target regardless of influence. ⚠️ With 20 modes the bounding volume becomes
   the union of all achievable shapes, so frustum culling loosens and raycast
   broad-phase gets less selective — a silent regression in exactly the feature
   (organ picking) that morph targets were chosen to protect.

### The genuinely good news

`geometry.morphTargetsRelative = true` is set by GLTFLoader for all glTF morph
targets, and the shader computes `base + Σ influenceᵢ × deltaᵢ`. **That is literally
the PCA reconstruction equation**: the mean shape is the base primitive, each scaled
eigenvector is one morph target, and `morphTargetInfluences` *are* the PCA
coefficients. three.js does **not clamp** influences (checked `Mesh.js`), so negative
coefficients work. **No custom shader is needed to evaluate an SSM.**

Raycasting stays correct too: `Mesh.getVertexPosition()` reads
`morphTargetInfluences` on the CPU, so organ picking follows the deformed shape — a
custom `aPositionTarget` attribute would break it silently while the geometry
visibly moved [R].

### Existence proof, at small scale

**`public/models/biv-heart.glb` already ships morph targets in this repo** [M]:

| surface | vertices | targets | target semantics |
|---|---|---|---|
| cardiovascular/epicardium | 2,502 | 24 | POSITION, NORMAL |
| cardiovascular/lv-endocardium | 1,572 | 24 | POSITION, NORMAL |
| cardiovascular/rv-endocardium | 1,956 | 24 | POSITION, NORMAL |

6,030 vertices × 32 B × 24 = **4.63 MB** of morph texture. So the pipeline, the
loader path, the asset build and the attribution machinery all exist and work.

⚠️ **And `build-biv-heart.mjs`'s own header records the reason it worked**, which is
the whole of §4 in one paragraph: the 25 biv-me frames are *"byte-identical in
topology and differ only in vertex
coordinates, which is exactly the glTF morph-target contract. Most 4D cardiac data
is remeshed per frame and has no vertex correspondence at all."* The build **asserts**
the correspondence rather than trusting it. That assertion is the pattern §9 should
copy, and its existence is quiet evidence that §4 is the real problem: the one
morph-target asset in this repo exists because correspondence arrived free, and
nowhere else did.

### ⚠️ The framing correction: morph targets are probably the wrong mechanism

This is the most useful thing in §7 and it arrived last. **An SSM fit is a per-person
one-off, not a per-frame parameter.** If the coefficients do not change during a
session, there is no reason for the basis to be on the GPU at all — and every number
above becomes irrelevant.

Ranked by feasibility [L]:

| option | verdict |
|---|---|
| **A. Fit offline, ship one static GLB per person** | ⭐ **Recommended.** Zero morph cost, zero per-frame cost, VRAM is just the base mesh. **The only option that keeps 350k vertices viable.** Cost is server-side fitting plus a per-person asset — which D16's privacy posture wants anyway |
| **B. CPU PCA into a `BufferAttribute` once** | ⭐ Recommended **if** coefficients must be adjustable in-session. 350k × 60 is ~21 M mul-adds — tens of ms **once**, then one 4.2 MB upload. Steady-state frame cost **zero**. Basis lives in JS heap, where quantisation *does* pay |
| **F. Split per organ, morph only what varies** | ✅ **The only thing that makes morph targets viable at all**, and this repo has 3,614 identifiable structures so the split is largely done. Note this is *not* sparse accessors — spec line 1504 forbids a partial-count morph accessor |
| **D. Transform feedback (WebGL2) / WebGPU compute** | ✅ Right shape for the problem — evaluate once into a VBO on change, then render a static mesh. ⚠️ three.js has no transform-feedback API; this is custom raw-WebGL alongside the renderer |
| **C. Custom vertex shader over a basis texture** | ⚠️ ~4× better than three.js's path (pack RGB without the wasted alpha, use RGBA16F, skip the CPU mirror) but **still O(N) fetches/vertex/frame** — same wall |
| **E. Skeletal / cage / lattice** | ⚠️ Cheap and good for **pose**, but it cannot represent a PCA basis, only approximate it. Sensible *complement* to A |

⚠️ **The WebGPU path is worse, not better**: `MorphNode.js` hardcodes
`const maxTextureSize = 4096; // @TODO` and its loop has **no zero-influence skip**,
fetching unconditionally for every target.

**So the recommended architecture is A or B, and §12's Phase 3 is rewritten
accordingly.** Reach for morph targets only if continuous coefficient animation is a
real requirement — and then combine F with D.

---

## 8. The cheap mechanism that already exists — read this before building an SSM

`src/scene/structureMask.ts` already ships a **per-structure RGBA LUT texture**
indexed by the per-vertex `_STRUCTURE` attribute. Measured [M]: `_STRUCTURE` covers
**100 % of vertices** in both `z-anatomy.ao.glb` (3,614 structures over 1,582,367
vertices) and `bodyparts3d.ao.glb` (1,838 over 1,309,766).

A per-structure **3×4 affine** in that same LUT costs **3,614 × 48 B = 173 KB**,
**independent of vertex count** [M], and gives per-organ scale, translation and shear
inside the fetch the shader already performs.

| | per-structure affine LUT | organ SSM as morph targets |
|---|---|---|
| VRAM | **173 KB**, flat [M] | 39 MB + 39 MB RAM at 20 modes on the organ subset [M] |
| correspondence needed | **none** | population-wide, and it does not exist (§4) |
| new asset pipeline | **none** | segmentation → registration → PCA → GLB |
| training data needed | anthropometric regression tables | ≥100s of trustworthy segmentations (§6) |
| meshes must be re-split | **no** | **yes** (§7 sparse finding) |
| expresses | organ **size and placement** | organ **shape** |
| honest label | "Scaled to your height and weight" | "Estimated from a population model" |

**This is Tier 1 of the personalisation ladder in
`PHOTOREALISM_AND_PERSONALISATION.md` §6.5, and Tier 3 — a body scan — does not
improve organ position over Tier 1** [R]. Which is the whole argument: the expensive
mechanism buys shape, and shape is the thing the cheap inputs cannot see.

⚠️ **The honest boundary, stated so nobody blurs it later:** an affine cannot
express shape change. A liver scaled by 1.15 is a bigger reference liver, not this
person's liver. That is a *smaller* lie than a morphed one because scale is a claim
the input actually supports — but it is only not-a-lie if it is labelled, with a
`positionSigma`, per §2.

⚠️ **And the claim it supports is weaker than "allometric sizing" sounds.** §4b's
numbers apply to this mechanism too, and they must be on the label:

| what the affine is fed | how much it explains |
|---|---|
| liver **volume** from body surface area | **r² = 0.46** (Vauthey et al. 2002, DOI 10.1053/jlts.2002.31654, n = 292) [L] |
| liver volume from weight | r² = 0.49 [L] |
| adult organ **volume** from external dimensions | **r² ≤ 0.410** (Segars 2014) [L] |
| residual organ-volume uncertainty after the *best* external match | **14–20 %** — and **~40 % for spleen regardless of measure** (Whalen et al. 2008, DOI 10.1088/0031-9155/53/2/012) [L] |

So height and weight explain roughly **half** the variance in liver volume and
essentially **none** of the variance in spleen volume. ⚠️ **Do not scale the spleen.**
An organ whose size is not encoded in body shape should stay at reference size with
`scale: null` — which is exactly what the `StructureFit` contract in §2 already makes
representable, and a good argument for enforcing it. "Scaled to your height and
weight" is honest for liver and kidneys; for spleen the honest label is "reference
size — your body shape does not predict this".

This tempering does not change the recommendation. A mechanism costing 173 KB that is
right about half the variance for some organs and declines to guess for others is
still the best value in this document.

**Recommendation: build this first, ship it labelled, and see whether anyone needs
more.** It is days of work against months, it cannot mislead about shape because it
does not change shape, and it makes the SSM's marginal value measurable instead of
assumed.

---

## 9. The cheapest thing that would tell us if this is viable

One experiment. **Liver, one organ, offline, no app changes.** Success or failure
here decides §1(2) and nothing else needs to happen first.

**The question it answers:** can we manufacture vertex correspondence across a
population, at a quality that supports a shape model, using only permissively
licensed tools and CC BY data?

**The method**, using only the ✅ rows of §10:

1. Take **30 subjects** from the TotalSegmentator dataset (CC BY 4.0 [V]), drawn from
   the **404 with no reported abnormality** (§6) — enough to see whether
   correspondence holds, far too few for a shippable model. ⚠️ Do not sample the full
   1,204; a pathological liver in a 30-shape pilot will look like a correspondence
   failure and waste the experiment.
2. Extract the liver label, mesh it. The repo's existing `labelmap2glb.py` from the
   CT atlas pipeline already does this.
3. Take **one** atlas liver as the template. Z-Anatomy or HRA — it does not matter
   which, and picking either is a decision to record.
4. Non-rigidly deform the template onto each of the 30, never remeshing:
   `trimesh.registration.nricp_amberg` (MIT, released 5.0.0 on 2026-08-01 [V]) or
   ShapeWorks `MeshWarper.build_mesh()` (MIT, v6.7.0 with prebuilt macOS arm64,
   CI green 2026-08-07 [V]).
5. **Assert the invariants, loudly, in the style `build-biv-heart.mjs` already
   uses:** identical vertex count, byte-identical face index buffer, consistent
   winding across all 30. ⚠️ This is the step that silently corrupts everything
   downstream if skipped.
6. Measure, and these are the numbers that decide it:
   - **Surface distance** from each fitted template to its target mesh — the
     honest ceiling on the whole approach. Report it as leave-one-out
     generalisation, not training reconstruction; they differ substantially.
   - **Anatomical correspondence**, not just surface agreement. Does vertex *i*
     land on the same landmark in all 30? Surface distance can be small while
     correspondence slides — a well-fitted liver whose vertices have drifted around
     the surface produces PCA modes that are pure noise. Check the porta hepatis
     and the inferior vena cava groove by eye on all 30. **There is no automatic
     test for this**; that is why the pilot is 30 subjects and not 300.
   - **Mode compactness** — how many modes for 90 %/95 %, both scaled and
     Procrustes-normalised, because [R] records those differing by a factor of
     forty (one mode versus at least forty for the same bones). Quote neither
     number without saying which it is.
7. **A cheap label-quality arm, because it settles §1's counterweight.** Repeat the
   fit for the ~20 livers that appear in **both** TotalSegmentator and TCIA
   Pancreas-CT-style expert-annotated sources, and compare the modes. If
   model-assisted labels and expert labels yield materially different principal
   modes, the SLIVER07 annotation floor is binding and the 1,228-subject argument is
   weaker than §1 claims. **A day's work to test an assumption the whole leg rests
   on.** ⚠️ **[?]** whether such an overlap exists — check before promising it.
8. **The runtime measurement, and note it may be unnecessary:** emit the mean plus
   its first 20 modes as a GLB with 20 morph targets, load it in this app on a Quest,
   set all 20 influences non-zero, and read the frame time.

   ⚠️ **But §7's revised conclusion is that morph targets are probably the wrong
   mechanism.** An SSM fit is a **per-person one-off, not a per-frame parameter** — so
   the fitted mesh can be baked offline and shipped as a static GLB, or evaluated once
   on the CPU into a `BufferAttribute`. Both remove the throughput wall entirely and
   keep 350k vertices viable. Measure the morph path only if in-session coefficient
   adjustment is actually a requirement, and **decide that before spending the day.**
   The one thing genuinely worth measuring on device regardless is an **RGBA32F
   `texelFetch` in a vertex shader on real Quest Browser** — a ~20-line page, and the
   single unverified dependency of the whole morph route.

**Effort:** roughly one to two focused weeks, mostly in step 4 and step 6's second
bullet. No app code, no new dependency in `package.json` — it is an offline script
alongside `scripts/ct-atlas/`.

**Kill criteria, written before the experiment rather than after:**

- Correspondence visibly slides on more than a few of the 30 → **stop.** No amount
  of training data fixes bad correspondence; it just averages it.
- Leave-one-out surface error is not comfortably below the ~1.3–2.7 cm respiratory
  excursion [R] → **stop.** The model would be reporting less than breathing does.
- 20 modes at 122k vertices misses 72 Hz on a Quest → the SSM may still be worth
  it, but it is a desktop feature, and D14's rule applies: the control must say so.

**A pilot that fails is a good outcome and should be recorded as one**, in the D10
manner — it converts an open-ended research ambition into a closed decision, which
is worth more than the feature would have been.

---

## 10. Licence table

### Toolkits — verified from `LICENSE` file bodies or package metadata, 8 August 2026

| toolkit | licence [V] | maintained | fixed topology? | verdict |
|---|---|---|---|---|
| **ShapeWorks** | **MIT** | commit 2026-08-07, v6.7.0 2026-04-24, CI green incl. macOS arm64 | via `MeshWarper` — first-class API, not a hack | ✅ **primary recommendation** |
| **trimesh** | MIT | commit 2026-08-01, **5.0.0** 2026-08-01 | ✅ `nricp_amberg` preserves template topology | ✅ pure-Python alternative |
| **SPHARM-PDM / SlicerSALT** | Apache-2.0 / BSD-3-Clause | commit 2026-07-20 | ✅ by construction, **genus-0 only** | ✅ for solid organs; fails on vessels, colon |
| **Scalismo** | Apache-2.0 | ⚠️ **no commit since 2024-01-23** | ✅ by construction (Gaussian Process Morphable Models) | ⚠️ cleanest concept, dead repo, JVM-only |
| **statismo** | BSD-3-Clause | ⛔ **archived**, last commit 2020-05-09 | — | ⛔ do not adopt |
| **pygltflib** | MIT, 1.16.5 (2025-07-24) | active | — | ✅ **the glTF writer to use**; own tests cover morph + sparse |
| **glTF-Blender-IO** | Apache-2.0, active 2026-07-29 | active | — | ✅ shape keys → morph targets; heaviest dependency |
| ITK / VTK / PyVista / Open3D / PyGeM / morphomatics | Apache-2.0 / BSD-3 / MIT | active (⚠️ Open3D wheel 0.19.0 is from 2025-01-08) | n/a — plumbing | ✅ |
| gias3 | MPL-2.0 | ⚠️ last commit 2022-08-19 | ✅ per bone | ⚠️ file-level weak copyleft, thin docs |
| **Deformetrica** | ⛔ **INRIA Non-Commercial License Agreement** | last commit 2020-08-25 | — | ⛔ **DISQUALIFIED** — see below |
| **pyssam** | ⛔ **AGPL-3.0** | 2025-08-21 | ❌ assumes correspondence solved | ⛔ network copyleft |
| gpytoolbox | GPL-3.0 [?] (GitHub-detected, body unread) | active | — | ⛔ MIT equivalents exist |
| **SlicerSegmentMesher** | ⛔ **no LICENSE file** | — | — | ⛔ and its README says bundled TetGen is *"only free for private, research, and educational use"*. Use Cleaver2 instead. |
| **MedShapeNet tooling** | ⛔ **no LICENSE file** (2 repos checked) | — | — | ⛔ default copyright |

⚠️ **Deformetrica is the headline trap and would have been adopted.** Its GitLab
landing page reads as permissive to a summariser; the `LICENSE.txt` body says it *"is
a non-free license that grants you the right to use Deformetrica for educational,
research or evaluation purposes only, but prohibits commercial uses"*, and clause 4
forces derivatives under the same terms. PyPI metadata corroborates
(`license: "INRIA license"`). Anything wrapping it inherits this.

⚠️ **GitHub's licence badge said "NOASSERTION" for six repos that are actually
clean** — ShapeWorks (MIT, confused by a title preamble), statismo, PyGeM (MIT in
`LICENSE.rst`), VTK (BSD-3 in `Copyright.txt`), Open3D, SlicerSALT. **Do not trust
the badge in either direction.** Read the file body. This is the same lesson D12b
learned from filename-matching gates.

**"SSM-Tools" is not a project.** The phrase traces to *On the Evaluation and
Validation of Off-the-shelf Statistical Shape Modeling Tools* (arXiv 1810.03987),
which compares ShapeWorks, SPHARM-PDM and Deformetrica. Useful as a citation; there
is nothing to adopt.

**No SSM toolkit surveyed mentions glTF at all**, and no third-party writeup
bridging PCA models to morph targets was found. The bridge is a format conversion,
not an algorithm — §7 shows the data models match 1:1 — but it is ours to write.

⚠️ **morphomatics is mismatched to the delivery format**, and this is subtle: its
value proposition is that shape variation is *not* linear in vertex coordinates,
while glTF morph targets are a linear weighted sum. Geodesic samples can be baked as
targets, but runtime interpolation between them is linear and will not follow the
geodesic.

### Data and phantoms

| resource | licence | verdict |
|---|---|---|
| **TotalSegmentator Dataset v2.0.1** | **CC BY 4.0** [V] — 1,228 CT, 117 structures | ✅ **the primary training source.** All 1,204 v1 labels manually reviewed; ⚠️ only **404 show no abnormality** — filter for a normative model (§6) |
| **TCIA Pancreas-CT** | **CC BY 3.0** [L] — 80 | ✅ ⭐ **best normative source**: 17 genuinely healthy donors |
| **TCIA C4KC-KiTS** | **CC BY 3.0** [L] — 210 | ✅ same cases KiTS19 ships as CC BY-NC-SA. Pull from TCIA |
| **TCIA CT-ORG** | **CC BY 3.0** [L] — 140 | ✅ ⚠️ lungs/bones auto-segmented in the training split |
| **TCIA PSMA-PET-CT-Lesions** | **CC BY 4.0** [L] — 378 | ✅ unencumbered **whole-body CT imagery**; lesions only, generate your own labels |
| **SAROS** annotations | **CC BY 4.0** [L] — 900 series | ✅ only human-refined **body-envelope** labels; every 5th slice; mixed image licences |
| MSD / Decathlon, VerSe | **CC BY-SA 4.0** [L] | ⚠️ usable, but ShareAlike forecloses the NC-SA family permanently (§6) |
| AMOS22 | ⚠️ **conflict**: Zenodo API `cc-by-4.0` vs the paper's "CC BY-NC-SA" [L] | ⚠️ **[?]** write to the authors; do not silently pick |
| AbdomenCT-1K | repo Apache-2.0; **dataset grant undeclared**, Google-Form access [V][L] | ⚠️ **[?]** a tracking form is not a grant |
| CHAOS | **CC BY-NC-SA 4.0** in 2 of 3 channels [L] | ⛔ as published — ⚠️ and it is the **best healthy-organ source** (3 radiologists, majority vote). Worth an email |
| TotalSegmentator **MR** | **CC BY-NC-SA 2.0 Generic** [L] | ⛔ NC + SA |
| AbdomenAtlas 1.1 | CC BY-NC-SA 4.0 **plus** *"Redistribution … is not allowed"* [L] | ⛔ explicit |
| KiTS21, BTCV, FLARE22-full/23, DAP Atlas | **no licence declared** [L] | ⛔ silence grants nothing |
| KiTS23, LiTS-as-LiTS, CTPelvic1K, CADS, WORD | NC, or self-contradictory (§6) | ⛔ |
| Healthy-Total-Body-CTs (`htb-ct-f`, already here) | CC BY 4.0 segmentations; images restricted | ⛔ grouped labels, non-contrast — D10 applies |
| **XCAT** | **none published**; REDCap request form [V]. Only published figure is the **Brain** phantom at $400/yr then $200/yr [L] | ⛔ **unusable under D12b** — silence grants nothing |
| **IT'IS ViP** | **none published**; routed to Sim4Life sales [V]. Clause 2.3.2 bars distributing derivatives; ⚠️ clause 2.3.4 bars reading model data from graphics memory [L] | ⛔ same, twice over |
| **ICRP Publication 110** | **none published**; data free but permission-gated, print **£164.00** [V][L] | ⛔ same |
| **ICRP 145** (adult mesh — *not* 143) | all rights reserved; data free, OBJ+MTL, no registration [L] | ⛔ today. ⭐ **Best ask**: request *sublicensable* redistribution (Geant4 precedent is bilateral only) |
| **Cardiac Atlas Project** biventricular modes | ⚠️ **no licence stated on the page** [L] | ⛔ **joins the XCAT/ViP/ICRP group.** The only downloadable fitted organ SSM, and it grants nothing |
| UK Digital Heart Project model (1,093 hearts, 100 PCs > 99.9 %) | **[NR]** | licence not checked |
| **SPARC organ scaffolds** + `scaffoldmaker` | **Apache-2.0** code; datasets typically **CC BY 4.0**, verify per dataset [L] | ⭐ ✅ **best structural match** — §5. No liver/kidney/spleen/pancreas |
| **Visible Human Project** imagery | **US Government work, not subject to copyright** [L] | ✅ imagery only; ⚠️ terms do not flow to derivatives |
| **VIVA+ / VIVA OpenHBM** | **LGPL-3.0** [L] | ✅ copyleft; ⚠️ **no viscera** |
| **PIPER** morphing framework | **GPL-2.0-or-later** [L] | ✅ a working open personalisation engine |
| **Rajagopal full-body** | **MIT** [L] | ✅ bones + muscle paths, no organs |
| **FDA VICTRE `breastPhantom`** | **CC0 1.0** [L] | ✅ breast only |
| UF/NCI, RPI, Zubal, GSF/Helmholtz, MASH/FASH, THUMS, GHBMC, Visible Korean, NEVA, Chinese/Korean voxel families | all closed or no licence — see §5 [L] | ⛔ verified, so nobody re-checks |
| `opensim-models` .vtp bone meshes | ⚠️ **no LICENSE file exists** [L] | ⛔ do not assume |
| MIDA, ICRP 143/156, MedShapeNet collection level | **[?]** / per-source | §5, §6 |
| MakeHuman / MPFB2 base mesh **and morph targets** | **CC0 1.0**, covering assets generated via scripting [R] | ✅ the one parametric body model that is usable; already the basis of ANNY (D16) |
| SMPL / SMPL-X / STAR / SUPR / TailorMe / OSSO / SKEL / HIT / BOSS | non-commercial or unstated [R] | ⛔ and ⚠️ **D16's runtime trap applies**: never select `topology="smpl"`/`"smplx"` in ANNY — it downloads a non-commercial archive at *runtime*, which a dependency audit does not catch |
| NAKO, UK Biobank, Zygote | signed MTA / proprietary EULA | ⛔ already in `licences.json` `closed` |

---

## 11. What would make this fail

Ordered by how likely each is to be the thing that actually kills it.

1. **Correspondence slides while surface distance looks fine.** The failure has no
   automatic test, produces healthy-looking compactness curves, and yields PCA modes
   that are noise wearing the costume of anatomy. §9 step 6 is designed around this
   and is the reason the pilot is eyeballed at n=30 rather than automated at n=300.
2. **The training labels are not anatomy.** Auto-segmentations from clinical-routine
   scans encode the segmenter's systematic errors and the patients' pathology as
   population variance (§6). A model can be internally excellent and externally
   wrong, and nothing inside it will say so.
3. **Scale-versus-shape gets quoted without qualification.** [R] records the same
   bones needing **one** mode unscaled and **at least forty** Procrustes-normalised.
   A single unqualified mode count in a commit message or a UI string is a
   forty-fold error waiting to be repeated downstream. Decide before anyone quotes a
   number.
4. **The output is more precise-looking than it is true.** The fabrication is not
   morphing; it is rendering a ±2 cm estimate with the same crisp silhouette as a
   measured mesh [R]. If `positionSigma` is not enforced (§2), this happens by
   default, silently, and looks like success.
5. **Somebody reaches for a phantom to shortcut it.** XCAT and ViP are exactly what
   this project wants and their terms are not published (§5). A bilateral agreement
   is not reachable by D12b. ⚠️ The pressure to do this will be highest at the
   moment the pilot looks hard.
6. **The merged-mesh architecture makes per-organ morphing cost per-system prices.**
   Sparse accessors do not help (§7). Re-splitting the atlases changes draw calls
   and touches `AtlasBody`, and that cost is easy to discover late.
7. **A morph slider that does nothing on five of seven atlases.** Only the two big
   artist-derived atlases carry `_STRUCTURE`; only some carry the organs. D14's rule
   is not optional: the control must disable itself and say why.
8. **Regulatory framing.** D15 and D17 both flag that this repository has no medical
   purpose and must not acquire one by implication. "Here are your organs" is a
   stronger claim than any colour ramp D17 worried about. ⚠️ A geometry personalised
   from a person's own imaging is closer to MDR Rule 11 territory than anything
   currently shipped, and that is a question for a lawyer, not for this document.
9. **It becomes the answer to Phase 6.** Morphing the male atlas towards female
   would "solve" the missing female musculoskeletal system by fabricating it. D16a
   refuses this; so must any work from this spec.
10. ⚠️ **Paediatric results get read as adult licence.** §4b: external size predicts
    organ position at r² ≈ 0.79–0.89 in **children** and ≤ 0.439 in **adults**, and
    much of the encouraging phantom literature is paediatric. This repo ships a
    `child` envelope preset beside adults, so the conflation is one UI control away.
    Any accuracy claim must state which cohort it came from.
11. **A ShareAlike choice made casually forecloses the best healthy-organ data.**
    Adopting MSD or VerSe (CC BY-SA 4.0) permanently rules out CHAOS, KiTS23,
    CTPelvic1K and AbdomenAtlas geometry (CC BY-NC-SA 4.0), and CHAOS has the best
    annotation quality of any source surveyed. Decide the output licence **before**
    ingesting the first dataset, not after.
12. ⚠️ **The face clause.** TCIA Restricted §3.6 forbids derivatives that could
    reconstruct a facial image, and a whole-body skin envelope contains a face (§6).
    Any envelope *derived* from gated imagery is a licence breach in a way that is
    easy to not notice, because the mesh looks like geometry rather than like a face.

---

## 12. Phased plan

Phases 0 and 1 are worth doing regardless. Phase 2 onward is gated on Phase 1.

| phase | what it is | what it would prove | effort | gate |
|---|---|---|---|---|
| **0** | **Per-structure affine LUT** (§8) — extend `structureMask.ts`, regress organ size against height/weight/sex from public anthropometry, label it, enforce `positionSigma` | That labelled allometric sizing is useful on its own, and how much of the perceived value of "personalisation" it already delivers | **days** | none — start here |
| **1** | **Liver correspondence pilot** (§9), 30 subjects, offline, plus the 20-mode Quest frame-time measurement | Whether correspondence is manufacturable at usable quality, and whether the runtime holds. **Decides everything after it** | **1–2 weeks** | Phase 0 shipped, so the SSM's marginal value is measurable |
| **2** | **Liver, spleen, kidneys only** — pancreas and gallbladder descoped on §4a's evidence. **≥200 subjects** (Audenaert's floor, and it is a floor for viscera), filtered to the 404 normative. Leave-one-out generalisation per organ; **multi-level, never concatenated** [R] | Per-organ accuracy in mm against §4a's 1.9 mm LOO benchmark, and whether 200 is enough for viscera when it was barely enough for bone | **1–2 months** | Phase 1 passes all three kill criteria |
| **3** | ⚠️ **Rewritten by §7.** Bake the fitted mesh **offline into a static GLB per person** (option A), or evaluate PCA once on the CPU into a `BufferAttribute` (option B). **Not morph targets**, unless in-session coefficient animation turns out to be a requirement — then split per organ (F) first | That it ships without breaking draw calls, picking, or the `_STRUCTURE` join — and at 350k vertices, which the morph path cannot sustain | **1–2 weeks** (down from 2–4: no mesh re-split, no morph asset pipeline) | Phase 2 gives a defensible accuracy figure |
| **4** | Fit to one person's own contrast-enhanced CT/MR, server-side; render with silhouette softness scaled to `positionSigma` (§2, D17) | Personalisation from imaging, honestly bounded. Roadmap Phase 7, met | **months** | Phase 3, plus a legal read on §11(8) |
| **—** | ⛔ **Never**: fitting organ shape from the skin envelope or a body scan | — | — | Killed by §1(1). Do not re-propose, in the manner of D10 |

Effort figures are **[?]** — engineering estimates, not measurements.

---

## 13. Uncertainty register

Six research streams reported into this document at different times. This register
records where each landed, because "resolved" and "never looked" must not read alike.

### Resolved since the first draft — with where the answer is

| was | now | where |
|---|---|---|
| **1.** SSM literature not read | ✅ **Resolved.** Mode counts, the three conflated accuracies, the training-size curve, the ~200-subject convergence figure, per-organ ranking | **§4a** |
| **2.** Organ-dose error under phantom substitution — named as *"the highest-value single search remaining"* | ✅ **Resolved.** AAPM 246's 3–66 % / 10–15 %, Zhang 3–38 %, Johnson, Stepusin's plateau, Ye's 33–164 % | **§5**, **§4b** |
| **3.** Most phantom families | ✅ **Resolved.** All named families surveyed; three premise corrections; the field-splits-in-two finding | **§5** |
| **4.** Most datasets | ✅ **Resolved.** ~30 candidates, six clean, per-dataset annotation-quality ranking | **§6**, **§10** |
| **5.** Whether any dataset pairs body surface with organ labels | ✅ **Resolved, and constructible** — TotalSegmentator CT (CC BY 4.0) + the Apache-2.0 `body` task; SAROS for human-refined envelopes | **§6** |
| **7.** Proportion of TotalSegmentator labels human-verified | ✅ **Resolved, and it reversed the concern** — all 1,204 v1 examinations manually reviewed | **§6** |
| **11.** Quest WebGL2 limits | ✅ **Resolved.** `MAX_VERTEX_UNIFORM_VECTORS` 256, `MAX_ARRAY_TEXTURE_LAYERS` 2048, texture size browser-clamped to 8192/4096 | **§7** |
| **12.** Whether WebXR runs the vertex shader once or twice per frame | ✅ **Resolved.** `GL_OVR_multiview2` is present on Quest 3, halves vertex work, and is essential to this route | **§7** |

### [?] — researched, could not verify. Somebody looked and could not confirm.

19. ⚠️ **MakeHuman's mesh licence, and it outranks everything else here because it
    touches a SHIPPED asset.** One source reports the repository data as **AGPL-3.0**
    with CC0 attaching only to exports from an *"official and unmodified"* build;
    this repo's own `[R]` research says that caveat is obsolete and scripted exports
    are covered. `licences.json` declares ANNY's shape assets **CC0-1.0**. **Do not
    settle this by picking the convenient reading** — it decides whether a shipped
    asset is correctly attributed. §5.
20. **Zhou et al. 2014**, DOI 10.1007/s12194-014-0261-6 — five organs at N = 50,
    **paywalled and unread.** ⭐ The highest-value single item to *buy*: it is the
    closest thing to a multi-organ abdominal mode-count reference.
21. **No paper establishes a diminishing-returns point for liver, pancreas, spleen or
    stomach specifically.** Audenaert's ~200 is bone. §4a's curve is liver but stops
    at N = 43 without converging. So the training-set size for viscera is an
    extrapolation, and §12's Phase 2 is the thing that would measure it.
6.  **Inter-subject organ centroid SDs in cm after normalising for height and
    weight.** Upgraded from `[NR]` to `[?]`: two independent searches looked and
    **found no such study.** The proxies are Yao & Summers's 62 mm and the
    population-mean baseline of > 20 mm. Would have to be measured, e.g. from NAKO or
    UK Biobank — neither redistributable.
17. ⚠️ **The `[L]` three-level grading was lost in relay** (see the legend). Each
    literature figure was graded read-in-paper / read-in-a-quoting-paper /
    search-snippet-only, and this document carries one marker for all three. Recover
    the grading before quoting any `[L]` figure externally.
18. **BOSS (Shetty et al. 2023)** could not be re-verified — search budget exhausted.
    **Demoted and not load-bearing**; §1 stands on Segars/Stepusin/Fu. §4c.
8.  ⚠️ **Six datasets state contradictory licences across their own channels** — AMOS,
    CHAOS, KiTS19, CTPelvic1K, LiTS, WORD. §6, §10. Each needs an author email.
9.  **AbdomenCT-1K's data grant** is undeclared; Apache-2.0 covers the repo only.
10. **XCAT, ViP and ICRP terms** are verified *absent from their own pages*, which is
    the finding — but the actual terms sit behind request forms and were not obtained.
24. ⚠️ **Duke's XCAT licensing pages return a bot-detection wall to every automated
    fetch** (they exist and return HTTP 200). **A human can read them in a browser in
    ten seconds.** The single highest-value human-checkable gap in this document.
25. **UK Digital Heart Project** model licence — not checked. The Cardiac Atlas
    Project's absence of one *is* verified (§10).
28. **SPARC per-dataset licences.** `scaffoldmaker` is Apache-2.0 (verified); the
    datasets are *typically* CC BY 4.0 and must be checked per landing page.
29. **The MSD ↔ LiTS relicensing chain** — NC-SA material cannot lawfully be
    relicensed BY-SA downstream, so either IRCAD granted MSD separate rights or one
    statement is defective. Unresolved.
23. **Whether a TotalSegmentator / expert-annotation subject overlap exists** for
    §9's label-quality arm. Check before promising that experiment.
22. ⚠️ **The posture correction is recorded, not reconciled.** This repo's `[R]`
    research says supine→upright shifts the liver ~1.5 mm and concludes *"do not move
    organs with posture"*. Reiff et al. 1999 measures **kidneys shifting a mean of
    36 mm** supine→standing, with shape change. Different organ and axis, so not a
    direct contradiction — but the generalisation does not hold. §4b.
26. **RGBA32F `texelFetch` in a vertex shader on real Quest Browser**, and float-array
    uniform packing on Adreno. The two remaining unverified dependencies of the morph
    route. §7, §9 step 8.
13. **gpytoolbox's GPL-3.0** — GitHub-detected, licence body unread. Moot; MIT
    equivalents exist.
14. **SlicerSALT's current installer version** — only the 2018 GitHub tag verified.
15. **morphomatics' fixed-topology requirement** — inferred from its method, not
    quoted from its docs.
27. **VISCERAL Anatomy3** — `visceral.eu` serves only the word "maintenance"; project
    appears defunct.
16. **All effort estimates in §12.**

### [NR] — not researched. Nobody looked.

30. **MIDA, ICRP 143 and ICRP 156 detail.** Named in §5 but their own pages were not
    individually fetched; ICRP archive contents (1.75 GiB / > 10 GB) were never opened
    and a README inside could change the licence conclusion.
31. **Per-file licences of the released PIPER datasets**, and OpenSim's non-uniform
    per-model licences (`Gait2392`, `Hamner`, `Arm26`).
32. **SMPL-A** (Guo et al., CVPR 2022) — person-specific organ deformation for
    arbitrary pose. No repository or licence found; existence of code unverified.

### Corrections this document makes

| corrected | was | is |
|---|---|---|
| **The commissioning brief's vertex counts** | "~300k–400k vertices per merged mesh" | Totals **1.0–2.0 M**; largest single merged mesh **521,935**; organ subset only **122,312** [M]. §3 |
| **This document's own §6, first draft** | "TotalSegmentator's labels are partly model-generated [and] a shape model inherits the segmenter's biases" | Model-*assisted* and **all 1,204 manually reviewed**. The real caveat is pathology: **404 of 1,204** normative. §6 |
| **This document's own §7, first draft** | "budget the figure twice" | **Three** live copies, ≈ **44 B/vert/target**. §7 |
| **This document's own §7, first draft** | Quest throughput was an open `[?]` | Quantified: **3.02 G fetches/s** at 350k × 60, infeasible. And **morph targets are probably the wrong mechanism** — §7's option table |
| **This document's own §1, first draft** | Leg 2 "no-go for now" | **Go-if.** Training data was never the binding constraint. §1 |
| **This document's own §11, first draft** | "expect pancreas, adrenals, gallbladder to be hopeless" `[R]` | Measured: pancreas Dice ~73, gallbladder 53–72 — **descoped on evidence**. §4a |
| **The brief's phantom premise** | ICRP 143 is the mesh-type set | 143 is **paediatric voxel**; adult mesh is **ICRP 145**, paediatric mesh **156**. §5 |
| `docs/DECISIONS.md` **D12b** | 3,617 Z-Anatomy structures | Shipped asset carries **3,614** [M]. No consequence here; noted because this repo has twice been bitten by a document disagreeing with its own asset |

---

## 14. What to read next

- `docs/DECISIONS.md` **D10** (the signal-versus-noise test), **D12b** (silence
  grants nothing), **D14** (a control that cannot must say so), **D16/D16a** (the
  envelope is standalone, and why that reverses the obvious next step).
- `docs/PHOTOREALISM_AND_PERSONALISATION.md` **§5.6–5.9** (correspondence, SSM
  numbers, the accuracy ceiling) and **§6.1–6.6** (the BOSS finding, the
  personalisation ladder, and applying "never fabricate" to geometry). Every **[R]**
  in this document points there. ⚠️ **Two of its claims are contested here** — the
  MakeHuman licence (§5, register 19) and the posture generalisation (§4b, register
  22). Neither is resolved; do not read either document as settling the other.

**Within this document, if you read only three sections:** **§4** (correspondence does
not exist — the finding that reframes everything), **§4b** (why the skin route is dead,
with numbers), and **§8** (the cheap mechanism that may make the rest unnecessary).
- `scripts/build-biv-heart.mjs` — the working morph-target pipeline, and the
  topology assertion Phase 1 should copy.
- `src/scene/structureMask.ts` — the mechanism §8 recommends extending.
- `docs/reports/05-licence-and-publishability.md` — for why §5 ends where it does.
