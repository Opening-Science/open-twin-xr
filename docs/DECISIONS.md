# Decision log

Decisions taken for **open-twin-openXR**, in the same spirit as upstream
open-twin's `DECISIONS.md`: what was decided, why, and — the part that matters
six months later — **what it commits us to**.

Nothing here is implemented yet. These are recorded so the next session starts
from the decision rather than re-litigating it.

**Read D7 first.** It changes the criterion the earlier entries were decided
under, and supersedes part of their reasoning.

---

## D1 — The reference twin is **male**

**Decided 27 July 2026.** Switch the primary HRA asset from the Visible Human
Female (`3d-vh-f-united.glb`) to the Visible Human **Male**
(`3d-vh-m-united.glb`).

**Why.** BodyParts3D is male-only (TARO), so a male HRA makes both atlases the
same sex and stops the atlas switcher silently changing the person. It also
matches the sample twin ("John"). And it removes the full-term placenta at
source rather than by exclusion rule.

**What was weighed.** The Visible Human **Male donor was an executed prisoner**
(Joseph Paul Jernigan, executed by lethal injection in Texas in 1993, who
donated his body). The dataset is legally unencumbered — US public domain, no
licence required since 2019 — and this was considered and accepted, not
overlooked. `docs/PERMISSIVE_ANATOMY.md` flags it; that flag now resolves to
"accepted, knowingly". A future reader should not treat this as an oversight,
and should keep the provenance visible rather than quietly inherited.

**Committed to:** the 241 MB male model is already downloaded at
`public/models/hra-m.glb`. Rebuilding it through `convert:hra` and repointing
`ANATOMY_SOURCES.hra.url`. The female model is **retained**, not deleted — see
D3.

---

## D2 — BodyParts3D licence provenance: record it, don't block on it

**Decided 27 July 2026.** Keep the licence ambiguity as a written note. No
further action for the open-source release.

**Why that is right for the open-source case.** The uncertainty is whether
BodyParts3D is CC BY 4.0 (as NBDC's current page says, updated 2025-02-27) or
still CC BY-SA 2.1 JP (as lifesciencedb.jp, the popular GitHub mirror, and the
headers embedded in all 2,234 `.obj` files say). **Both licences permit
redistribution with attribution**, which is all an open-source release needs. So
the assumption holds: for shipping the repo publicly, there is no problem under
either reading.

**Where it does bite, and why the note has to survive.** The two readings diverge
on exactly two things, and both are downstream of open source:

1. **Share-alike.** If it is BY-SA, any *adapted* asset carries copyleft — which
   would reach a fused GLB, though not our code, and not a separately-shipped
   file. This is why `anatomySources.ts` keeps one GLB per atlas.
2. **Commercial distribution.** BY-SA does not prevent it, but it changes what
   we owe downstream.

**Committed to:** archive the NBDC licence page with a retrieval date so the
claim is evidenced at a point in time, and get written confirmation from DBCLS
**before** any commercial distribution — not before release. Do not strip or
rewrite the embedded 2013 headers until that confirmation exists.

---

## D3 — Add `sex` to the contract; ship **both** sexes and match them

**Decided 27 July 2026.** `TwinMetrics` gains a sex field, and the project
deliberately carries **both a female and a male anatomical model**, selected to
match the twin.

**Why.** D1 picks a default; it does not make the twin male. A health record
about a woman rendered on a male body is wrong in a way that is both clinically
and personally obvious. Sex-discordant structures can then be *filtered* rather
than merely disclosed — the same mechanism `HIDDEN_GROUPS` already uses for the
placenta, which is the honest version of what `68fc336` could only announce.

**⚠️ The constraint this runs into, which needs solving before it can be
delivered in full: BodyParts3D has no female donor.** TARO is a single male
phantom; there is no female counterpart. So:

- **HRA can honour D3 today** — it ships both `3d-vh-f-united` and
  `3d-vh-m-united`, which is precisely why D1 keeps the female model rather than
  replacing it.
- **BodyParts3D cannot.** A female twin selecting BodyParts3D would still get
  male anatomy. Options are to fall back to HRA for female twins, to hide the
  sex-specific structures and present the rest as sex-neutral, or to source a
  female musculoskeletal set separately — see D6, which may help here.

**Committed to:** a schema change, so it needs the care `HANDOVER_SPEC` demands
of the contract. Note the field describes **which body to render**, which is not
always the same question as clinical sex — decide explicitly whether it is
anatomical sex, and say so in the field's documentation rather than leaving a
reader to assume.

---

### D3a — Amendment: SPL becomes the preferred atlas; keep the others as options

**Decided 27 July 2026.** Move toward the Brigham & Women's SPL atlas (D6) as the
preferred anatomical source, while **retaining HRA and BodyParts3D as selectable
options** rather than removing them. Stated intent for this stage: evaluate
several models side by side, and be open to **merging or interpolating** between
them later for the best result.

**⚠️ Merging atlases has already been tried here, and abandoned.**
`src/scene/anatomySources.ts` records why, and it is not a tuning problem:

> "Mixing HRA viscera with a BodyParts3D skeleton put two different donors in two
> different poses inside one body: the arms and legs sat at visibly different
> angles and the proportions did not match. Bounding-box registration cannot fix
> a pose difference."

That is why all nine entries of `COMPOSED_SOURCE` currently resolve to a single
atlas. **The instinct is right; the mechanism was wrong.** Scene-level
composition cannot work, because the atlases are different people in different
poses and the only registration in place is a bounding box. Two mechanisms
actually can:

1. **Register everything to one canonical template** — landmark or thin-plate-
   spline, which is what `HANDOVER_SPEC` section 6 already calls for and which
   nothing has implemented yet.
2. **Interpolate in a shape space rather than in the scene.** A statistical shape
   model is literally "interpolate between anatomies", done principledly: every
   intermediate is a valid anatomy rather than a linear blend of two unrelated
   meshes. See `docs/PHOTOREALISM_AND_PERSONALISATION.md` §5.8, including the
   warning that scale normalisation changes the mode count by a factor of forty.

**So: keep the multi-atlas switcher for evaluation — that is cheap and useful.
Do not re-attempt scene-level merging until one of the two mechanisms above
exists.** Re-enabling `COMPOSED_SOURCE` mixing without registration will
reproduce the mismatched-limbs result exactly.

**To check before SPL can answer D3:** whether the SPL atlases provide both a
female and a male donor. If SPL is single-sex, it inherits the same gap
BodyParts3D has, and D3's matching requirement still needs HRA underneath.

---

## D4 — Try the Visible Human cryosection texture bake

**Decided 27 July 2026.** Prototype it. Liver first.

**Why.** It is the largest quality jump available and it is licence-free. The
VHP cryosections are colour photographs of real tissue at 0.33 mm, public domain
since 2019 — and HRA's organ meshes were modelled from that same donor, so
geometry and colour are already registered to one body. This is restoring the
source imagery, not inventing a texture.

**Note the interaction with D1:** we are switching to the male donor, so the bake
should use the **male** cryosection set to stay donor-consistent. Mixing female
cryosections onto male geometry would reintroduce exactly the mismatch D1 exists
to remove.

**Confirmed 27 July 2026:** proceed, and use the **male** cryosections per D1.

**Committed to:** an offline bake only — the volume is tens of GB and must never
be a runtime asset. Expect a colour-grading pass: cryosection tissue is
post-mortem and frozen, so it reads duller and browner than living tissue. Plan
for de-staircasing and inter-slice alignment. **Stop after the liver and look at
it** before generalising to all organs.

**Licence caveat to carry:** NLM publishes VHP under its own Terms & Conditions,
*not* a CC licence. It needs its own sentence in `ASSETS_LICENSE.md` rather than
being folded into the CC BY framing.

---

## D5 — Segmentation stack is **MOOSE 3.2**, not TotalSegmentator

**Decided 27 July 2026.**

**Why.** The cleanest licence position available: **Apache-2.0 code and CC BY 4.0
weights** — attribution only, no non-commercial clause, no share-alike. It also
gives away free what TotalSegmentator charges for: heart chambers, peripheral
bones, and body composition are all licence-gated in TotalSegmentator and all
open in MOOSE. ~120 classes across 12 chainable CT models.

**⚠️ The consequence that constrains the roadmap: MOOSE has no human MRI model.**
It is CT-only. `HANDOVER_SPEC` Phase 3 is "patient MRI interior", so this
decision does not cover the stated Phase 3 path. Three ways out, to be decided
separately and *before* Phase 3 starts:

- **MRSegmentator** — Apache-2.0 code, Apache-2.0 + CC BY 4.0 weights, 40 classes
  in MR *and* CT. Licence-clean, and the natural companion to MOOSE.
- **TotalSegmentator `total_mr`** — 50 MR classes, offered as Apache-2.0, but its
  training data is CC BY-NC-SA 2.0 and whether weights are a derivative of
  training data is legally unsettled. Would need written comfort.
- **Restrict Phase 3 to CT.** Honest, and much cheaper.

**Also committed to:** the ~117-row `class → UBERON` crosswalk must be built
against **MOOSE's** class names. This is the real integration cost of the
pipeline and it does not transfer between segmenters — which is exactly why the
tool was chosen before the crosswalk was written rather than after.

**Watch:** MOOSE's sibling **FALCON is GPL-3.0**. Separate binary is fine;
linking is not.

### D5a — Sub-decision: MR coverage. **Recommendation: CT-first, plus MRSegmentator's body-composition only**

**Recommended 27 July 2026, not yet accepted.**

The obvious answer was "MRSegmentator, because it is licence-clean". **Checking
that claim changed it.** Verified today:

| | MRSegmentator | TotalSegmentator `total_mr` | TotalVibeSegmentator |
|---|---|---|---|
| MR classes | 40 (+10 body comp) | 50 | 72 |
| Dice, 40 shared structures | **0.759** | **0.862** | — |
| Code | Apache-2.0 | Apache-2.0 | Apache-2.0 |
| **Base weights** | **no licence stated** | offered Apache-2.0, training data CC BY-NC-SA 2.0 | **no licence stated** |
| Body-comp weights | **CC BY 4.0** (Zenodo 21211879) | n/a | — |
| Also does CT | yes | no | no |

**MRSegmentator's base weights carry no explicit licence.** The repo states
Apache-2.0 for the code and says only that "Weights are automatically downloaded
to `~/.mrsegmentator`". So it does **not** actually deliver the property MOOSE was
chosen for in D5 — and it is ~10 Dice points behind TotalSegmentator on MR. The
two reasons to prefer it both weaken on inspection.

Meanwhile TotalSegmentator's `total_mr` at least *states* Apache-2.0 for weights;
its risk is the unsettled question of whether weights are a derivative of
CC BY-NC-SA training data.

**So no MR option is currently clean, and that is the finding.** The
recommendation is to split by purpose rather than force a single pick:

- **Body composition (VAT / SAT / muscle) → MRSegmentator `--body_comp`.** These
  weights *are* explicitly CC BY 4.0, verified on Zenodo. This is also the
  MRI-derived capability with by far the strongest evidence behind it — visceral
  adipose from imaging is a real clinical signal, where organ *position* from
  imaging mostly is not. It is the piece that is both licence-clean and
  scientifically defensible today.
  (Trained on NAKO and UK Biobank, which are contract-gated — but the MTA vests
  IPR in findings and a trained network holds no participant-level data, which is
  why CC BY 4.0 weights are consistent here.)
- **Whole-organ MR → defer. Make Phase 3 CT-first via MOOSE.** MOOSE gives ~120
  classes on CT with CC BY 4.0 weights and no open questions. And the modality
  gap is inherent, not a tool artefact: MR tops out around **0.84 Dice against
  ~0.97 for CT**, so MR was always the weaker tier. Shipping CT first is honest,
  cheap, and unblocked.

**The action that actually resolves this is not more analysis — it is two
emails.** Both maintainers are reachable and both repos are active. Ask Häntze
for an explicit licence on the MRSegmentator base weights, and ask Wasserthal
whether `total_mr` weights are cleared for commercial use given the NC-SA
training data. Either answer collapses the decision immediately.

**If forced to choose one today with no email sent:** MRSegmentator, on the
grounds that it also covers CT (so it can cross-check MOOSE), its body-comp half
is unambiguous, and an unstated licence is a gap to close rather than a
restriction to violate. But do not describe that as the clean option, because it
is not.

---

## D6 — Adopt the SPL / Open Anatomy atlases

**Decided 27 July 2026.** Bring in the Brigham & Women's SPL atlases, starting
with **SPL Abdomen** (34.8 MB, 94 named `.vtk` surface meshes).

**Why.** It is the strongest coverage-per-licence-risk option found. The meshes
are already segmented and already named — muscles, skeleton, vertebrae, organs
(`Model_133_right_quadratus_lumborum_muscle`,
`Model_241_left_gluteus_maximus_muscle`, `Model_555_L2-L1-IntervertebralDisc`).
This is a direct candidate to close **open question 3** (HRA has no ribcage,
skull, or skeletal muscle), and it may also help D3's female-musculoskeletal gap.

**The licence is more permissive than what we already accept.** "3D Slicer
License section B" is a BSD-style grant that explicitly covers *data*, permits
commercial use, permits incorporation into proprietary programs, and is
**sublicensable** — strictly broader than the CC BY 4.0 the project already
relies on.

**Committed to** three conditions that must travel with any copy: the licence
text must accompany it, prefaced with the sentence the licence specifies;
attributions must be preserved; modified versions must be clearly marked. Also
note the carve-out — the grant "does not grant any rights with respect to third
party software", so third-party content inside an atlas remains our
responsibility to check.

**Also available if useful:** SPL/NAC Brain (300+ structures), Liver, Inner Ear,
Knee, Thorax.

---

## D7 — The governing criterion changes: **open, not commercial**

**Decided 27 July 2026. This supersedes the reasoning behind D2, D5, D5a, and the
2026-07-26 decision to reject Z-Anatomy.**

Commercial viability is **not** part of the foundation's purpose. The project is
bound to openness. The binding constraint becomes:

> the result of the combination we build must be **bundleable and shareable** as
> new knowledge and a relevant research tool.

Permissions will be sought wherever needed. Within that, use every resource
available to get the best possible result now.

### ⚠️ The new line is not "no line" — and it is not where you'd expect

Dropping commercial intent removes the *share-alike* objection entirely. It does
**not** remove the non-commercial objection, and this is the part worth being
precise about, because it inverts the intuition.

Verified against [opendefinition.org/licenses](https://opendefinition.org/licenses/):
**CC BY-SA 4.0 is Open Definition conformant, and listed as *recommended*.
CC BY-NC and CC BY-NC-SA are not conformant.** Non-commercial licences are not
"open" under the Open Definition, the OSI, or the Debian guidelines.

So an NC-derived asset bundled into the twin would make the twin itself
non-open — which contradicts the very commitment that motivated this change.
**Share-alike is now free to us; non-commercial is now the thing to police.**

### The tiers that replace the old commercial test

| Tier | Licences | Use |
|---|---|---|
| **1 — Open, bundleable** | CC0, CC BY, **CC BY-SA**, MIT, Apache-2.0, BSD, US public domain | Ship it. Share-alike is now aligned, not a cost. |
| **2 — Research-usable, NOT bundleable** | CC BY-NC, CC BY-NC-SA, and non-commercial research licences (SMPL family, HIT, OSSO, SKEL) | Compute with it, learn from it, validate against it. **Keep it out of the shipped artifact** or the twin stops being open. Many also forbid redistribution outright. |
| **3 — Still unusable** | Any **ND** (forbids sharing adaptations at all), and **unstated / all-rights-reserved** (no grant to redistribute) | Excluded regardless of intent. ND and "no licence" are not fixed by being non-commercial. |

Tier 3 is why D5a's finding still stands: MRSegmentator's unstated base-weights
licence is a **bundling** problem, not a commercial one, and dropping commercial
intent does not resolve it.

### What this reverses

**Z-Anatomy: adopt it.** The 2026-07-26 rejection was correct under the old
criterion and is wrong under this one. Z-Anatomy is BodyParts3D retopologised by
medical illustrators — it fixes the documented holes and non-manifold geometry
that `anatomySources.ts` warns we would otherwise have to pay for ourselves. Its
CC BY-SA 4.0 is Tier 1. The retopology *is* the quality we want.

**And it unlocks D3a.** The reason `anatomySources.ts` insists on one GLB per
atlas — "compose in the scene graph, never in the asset" — was to stop share-alike
reaching the CC BY geometry. Under D7 that no longer matters: a fused atlas may
simply be CC BY-SA. **Merging is no longer licence-blocked.** It remains
*geometrically* blocked until registration exists (D3a) — that objection was never
about licensing and still stands.

**D5 should probably flip to TotalSegmentator.** MOOSE was chosen for weights
licence over capability. The licence advantage largely evaporates here, because
TotalSegmentator's gated subtasks are **free for non-commercial use** via
`backend.totalsegmentator.com/license-academic/`. That unlocks exactly what was
missing: `tissue_types` (subcutaneous fat, torso fat, **skeletal muscle**),
`heartchambers_highres`, `appendicular_bones` (hands and feet),
`thigh_shoulder_muscles`, and **`face`/`face_mr`** — the defacing mask, which is
the privacy primitive D-series work needs. `brain_aneurysm` (CC BY-NC, no
commercial option) also becomes usable. On top of Apache-2.0 `total` (117 CT) and
`total_mr` (50 MR), where `total_mr` at 0.862 Dice beats MRSegmentator's 0.759.

**⚠️ Must be checked before flipping:** whether the academic licence permits
**redistributing the outputs**. The meshes are the shareable artifact, so
output terms — not weights terms — are what decide this. Read the licence text.

**Personalisation opens up substantially.** MakeHuman/MPFB2 (CC0) was the only
option under commercial intent. Now the whole Max Planck line is available *as a
research tool*: **SMPL / SMPL-X / STAR / SUPR**, **OSSO** (skeleton from body
surface), **SKEL**, and **HIT** (internal tissue from the body surface, CVPR
2024) with its dataset. These are Tier 2 — use them to build and validate, but
note most **forbid redistribution outright**, so SMPL-derived geometry cannot go
into the shipped twin. MakeHuman remains the shippable exterior.

**Datasets that reopen:** CHAOS, AbdomenAtlas, TotalSegmentator-MRI (CC BY-NC-SA
2.0), MSD (CC BY-SA — Tier 1 now). **Still closed:** 3D-IRCADb and MedShapeNet,
both CC BY-NC-**ND**; UK Biobank and NAKO, blocked by contract rather than
licence.

**D2 is simplified.** If BodyParts3D turns out to be CC BY-SA 2.1 JP rather than
CC BY 4.0, that is now Tier 1 either way. The note stays for provenance, but it
stops being a risk to manage.

### D7a — Checked: TotalSegmentator's academic licence and output rights

**Checked 27 July 2026. Result: the terms are not published, and for the main
path the question does not need answering.**

**The terms could not be obtained.** `backend.totalsegmentator.com/license-academic/`
is a Streamlit app — its content arrives over a websocket, so there is no static
licence text to read. The repository contains **only the Apache-2.0 code
`LICENSE`**; there is no licence text for the gated weights anywhere public. The
mechanism is a pure technical gate: `totalseg_set_license.py` accepts an 18-char
key beginning `aca_` and validates it against a server. So the terms are shown at
request time or emailed, and **an email is the only way to read them.**

**For the Apache-2.0 tasks, though, the answer is clear and favourable.**
Apache-2.0 is a copyright licence over the licensed work. Running software does
not make its output a derivative of that software — the same reasoning by which
GCC's output is not GPL. So segmentations from `total`, `total_mr` and `body`
carry **no conditions from the weights at all**: the mesh's licence is set solely
by the licence of the input image. Feed it TotalSegmentator's own CC BY 4.0
dataset and the resulting mesh is CC BY 4.0, cleanly Tier 1.

**And the gated tasks are mostly not needed, which is the useful finding.**
Enumerated from `map_to_binary.py`, the Apache-2.0 `total` task is **117 classes**:

| | count | includes |
|---|---|---|
| skeleton | **63** | full vertebral column C1–S1, all 24 ribs, skull, humerus, scapula, clavicula, sternum, hip, femur |
| organs | 27 | liver, spleen, kidneys, pancreas, stomach, duodenum, bowel, colon, oesophagus, gallbladder, thyroid, adrenals, prostate, bladder, heart, lungs, brain, spinal cord, trachea |
| vessels | 17 | aorta, vena cava, pulmonary vein, carotids, subclavians, brachiocephalics, iliacs |
| muscle | 10 | gluteus max/med/min, iliopsoas, autochthon |

**That is already a more complete skeleton than HRA has** — HRA has no ribcage, no
skull, and no clavicle, scapula or humerus at all (open question 3).

Verified absent from `total`, i.e. genuinely gated: **hands and feet bones**, and
**heart chambers**. Plus fat/muscle tissue types and the additional muscle groups.

### The architecture that sidesteps the question

- **Bundled reference atlas → build from `total` / `total_mr` only.** Outputs are
  unencumbered, so the shipped artifact stays Tier 1 with no unread licence in its
  provenance.
- **Per-user personalisation → gated tasks are fine.** Nothing is redistributed:
  the output is the user's own anatomy, produced on infrastructure they control
  and shown back to them. Output-redistribution terms cannot bite when there is no
  redistribution. This covers exactly the two gated tasks that matter most —
  `tissue_types` for body composition, and `face`/`face_mr` for defacing.
- The question only becomes **binding** if hands, feet or heart chambers are
  wanted **in the shipped atlas**.

### Which changes the D5 answer again — to "both, for different jobs"

The flip to TotalSegmentator is not clean after all, because the two tools gate
different things:

- **MOOSE 3.2 gives heart chambers and peripheral bones free under CC BY 4.0** —
  precisely the two things TotalSegmentator gates. For a *bundled* atlas that
  wants hands, feet and heart chambers, **MOOSE is the better source**, and
  needs no licence request at all.
- **TotalSegmentator covers MR (`total_mr`, 50 classes, Apache-2.0), which MOOSE
  cannot do at all** — MOOSE is CT-only.

So: **MOOSE for the bundled CT atlas** (D5 stands, for that job), **TotalSegmentator
`total_mr` for the MR path** (answering D5a without needing MRSegmentator's
unstated weights licence), and **gated TotalSegmentator tasks only in the
per-user path** where redistribution never happens.

That resolves D5a without waiting on any email. An email is still worth sending
for completeness, but nothing is blocked on it.

### D7b — Checked: HRA-male's skeleton, and whether SPL ships both sexes

**Checked 27 July 2026. Both answers are negative, and together they mean D3
cannot be delivered by choosing an atlas.**

**HRA male has no upper-body skeleton — and is WORSE than the female.**
Enumerated from `hra-m.glb`, 52 groups. Present: vertebrae (24 nodes),
intervertebral disks (43), pelvis with fused sacrum and coccyx, the knee and its
ligaments. **Absent: ribs, skull, clavicle, scapula, humerus, radius, ulna, hands,
feet — and, unlike the female model, no sternum and no manubrium either.**

So D1's switch to male costs the only thoracic bone HRA had. Confirmed on the
credit side: the male carries prostate, seminal vesicle and deferent ducts, and
no uterus, ovaries, mammary glands or placenta — so D1's claim that switching
removes the placenta at source does hold.

**SPL does not ship both sexes, and is not whole-body.** Five of its six atlases
state no donor demographics at all; the only one that does is SPL/NAC Brain,
*"a healthy 42 year old male volunteer"*. There is no female counterpart to any
of them. And SPL Abdomen is exactly that — abdomen: *"Derived from a clinical
quality CT scan, this SPL Abdominal Atlas features the skeletal system,
vasculature, muscles, and abdominal organs."*

**This corrects D3a and D6.** SPL cannot be "the preferred atlas" — it is a
high-quality *regional* supplement, not a whole-body source, and it cannot close
open question 3 on its own.

### Where that leaves D3

Every single-atlas option now fails at least one requirement:

| | both sexes | whole-body skeleton | muscle |
|---|---|---|---|
| **HRA** | ✅ | ❌ none above the pelvis | ❌ |
| **BodyParts3D / Z-Anatomy** | ❌ male only | ✅ | ✅ |
| **SPL** | ❌ male where stated | ❌ abdomen only | ✅ regional |

**So D3 as decided cannot be satisfied by picking a donor model at all.** The
options are to give female twins an atlas with no skeleton, to give them male
anatomy and say so, or to stop choosing between donors.

**Which promotes the D7a route from "an option" to "the only route that
satisfies D3".** TotalSegmentator's Apache-2.0 `total` task yields 63 skeletal
classes — ribs, skull, scapula, humerus, clavicle, the full column — and CT
datasets contain both sexes. Pick female subjects, get a female atlas; male
subjects, a male atlas. Same pipeline, same ontology, both CC BY 4.0,
anatomically consistent by construction, and per-structure labelled — which also
returns the ontology join `eebfa24` spent.

It is a month of work rather than a configuration change. But it is now the only
path that delivers what D3 asks for, and it happens to also deliver open question
3 and the per-structure identity in the same pass.

### What this does not change

D1 (male donor), D3 (sex field), D4 (cryosection bake), D6 (SPL) are unaffected —
none turned on commercial intent. D3a's geometric objection to merging stands
untouched.

---

## D7c — Built, and two corrections from actually running it

**27 July 2026.** The CT-derived atlas pipeline exists and runs end to end.
Verified independently against `scripts/atlas-stats.mjs`: **109 structures,
441,540 triangles, 12.6 MB, `ontologyid` on 109/109 nodes** with `label`,
`system`, `layer`. See `docs/CT_ATLAS_PIPELINE.md`. Two things it found overturn
what was written earlier.

### ⚠️ Correction to D5: MOOSE has the same weights question TotalSegmentator has

D5 chose MOOSE partly for having "no open questions". That was too strong. MOOSE
does carry a separate `MODEL_LICENSE` stating **CC BY 4.0 for the weights, "even
commercially"** — primary source, better evidence than D5 had. But its
`DATA_CARD.md` §6 shows **1,014 of 1,597 training subjects are AutoPET, which is
CC BY-NC 4.0**. So MOOSE inherits precisely the unsettled weights-are-a-derivative
question D5a raised *against* TotalSegmentator.

D7a's reasoning still defuses it — output licence follows the input image, not
the weights — but the two tools are now level on this axis rather than MOOSE
being clean. (Also noted: `dataset.json` contains `"licence": "hands off!"`,
which is nnU-Net's placeholder and not a licence.)

### ⚠️ "Whole-body" PET/CT is not whole body — and it removes the reason we came

Measured across 28 CC BY 4.0 ENHANCE.PET subjects by reading only the NIfTI
headers: **every one covers 45–63 % of the subject's recorded standing height.**
Confirmed in the output — `clin_ct_peripheral_bones` resolved 16 of 31 classes,
and **tibia, fibula, patella, tarsals, metatarsals and toes are entirely
absent**. The skull is the base only; the brain is 1 mL.

That is exactly the anatomy **D7b** wanted this route for. A half-body atlas does
not fix HRA's missing skeleton.

**And it is a live hazard in our own code**: `AtlasBody`'s `fit` scales any atlas
to `CANONICAL_HEIGHT_M` from its bounding box, so it would stretch a half-height
body to 1.7 m and render it without a word of complaint.

**Recommended source instead: the Visible Human Project CT** — whole-body axial
at 1 mm for *both* donors, no licence required since 2019, and the same donors
HRA and the D4 cryosection bake already use. Caveat: it is cadaver CT, and MOOSE
on cadaver CT is unvalidated.

### Still open on this track

Only the **female** subject was built end to end, so dual-sex is demonstrated
architecturally rather than by two atlases. **Decimation density is very uneven**
— verified on the shipped file: median 480 triangles against a heaviest of 76,458
— because hole-avoidance backs off per structure. It needs area-proportional
budgeting. ⚠️ The agent's report cited the liver at 4,900 triangles; the file on
disk has it at 76,458, so treat that report's per-structure figures as stale.
No `reproductive` coverage at all — MOOSE has no prostate or uterus class.

---

## D9 — Source scan: Visible Human Project CT, cadaver imaging accepted

**Decided 27 July 2026**, resolving the fork D7c opened. Clinical PET/CT is
abandoned as the atlas source because it covers only 45–63 % of standing height.

**This extends D1's provenance decision from geometry to imaging.** The male
donor was an executed prisoner; that was weighed and accepted for the HRA meshes,
and it now applies to the CT as well. Deliberate, not inherited by accident.

### Measured, not assumed

The agent flagged the CT-only size as unmeasured and NLM's "about 40 GB" as
misleading. Read from NLM's own `INDEX` manifests:

| | Male | Female |
|---|---|---|
| `frozenCT` | **513 MB**, 1,878 slices | *(none published)* |
| `normalCT` | 120 MB, 523 slices | **459 MB**, 1,735 slices |
| MRI | 69 MB | 63 MB |
| *(cryosections, for scale)* | *18.6 GB* | — |

**~1 GB for both donors' CT.** The 40 GB figure is cryosections. The download is
not a constraint and never was.

### Format verified on real slices

Downloaded three male slices and decoded them rather than trusting the spec.

- Unix `compress`; `gunzip -c` restores them.
- **3,416-byte header + 512×512×2 bytes = 527,704**, exactly as documented.
- **Big-endian**, and **HU = stored − 1024** — air sits at exactly 0 and the range
  runs to ~1531 HU at bone. Little-endian reads as byte-swapped garbage, so this
  is worth asserting in code rather than discovering later.
- Geometry from the per-slice header: **1 mm slice thickness, 1 mm spacing,
  512², 480 mm FOV → 0.9375 mm in-plane.** Genuinely whole-body 1 mm.

### ⚠️ Three traps found while checking

**Slices are not in filename order.** `c_vm1006` is at location −20 mm,
`c_vm1300` at −314, `c_vm1900` at −220. The frozen CT is several series and file
numbering does not track position. **Sort by the header's `Image location`, never
by filename** — naive ordering yields a scrambled body that still looks like a
volume.

**It is not DICOM.** GE "Zeus" raw with a proprietary header. A GE-raw → NIfTI
converter has to be written before MOOSE can see it; that step does not exist.

**The female README is stale.** It cites "the written license agreement", which is
the pre-2019 wording, and its own text says "The full set of normal CT **male**
images" — NLM's copy-paste error. The 2019 Terms and Conditions govern both.

### Asymmetry to design around

The male has **frozenCT** (1,878 slices, of the frozen cadaver, so spatially
registered to the cryosections **D4** wants to project) *and* normalCT (523
slices, fresh). The female has **only normalCT**. So male geometry and male
colour can come from one physical state, while the female needs the cryosections
registered to a different scan. Prefer male frozenCT for the D4 pairing; expect
freezing artefacts and treat MOOSE on cadaver CT as unvalidated either way.

---

### D9a — What the male frozen CT actually contains, and why it cannot be auto-registered

**Measured 27 July 2026** by building each exam and rendering it. Images in
`docs/img/`.

| Exam | Covers | Extent |
|---|---|---|
| **32** Reformatted, Head First | **head → pelvis** — skull, cervical spine, full ribcage, both humeri, lumbar spine, iliac crests | 844 mm |
| **34** "Scout Series", Feet First | **pelvis → knees** — femoral heads, both femurs, knee joints | 812 mm |
| **646** Retrospective | **knees only**, a detail study | 224 mm |

**Exam 34 is not a scout.** The label said "Scout Series" and a scout is one or
two projection images; this is 809 axial slices of real anatomy. The label is an
archiving artefact and the data is diagnostic. Excluding it on the label alone
would have discarded the entire lower body.

**⚠️ Coverage is head → knees, roughly 1,650 mm. There is nothing below the
knee** — no tibia, fibula, ankle or foot. So the VHP frozen CT is not
"whole-body" in the sense D9 assumed when choosing it over clinical PET/CT. It is
substantially better — head to knees against a mid-thigh cut-off, and it has the
skull and ribcage HRA lacks — but the feet are still missing and D7b's complaint
is only partly answered.

**The exams abut; they do not overlap.** The alignment search returns a peak of
**r = 0.299 over 5 slice pairs**, and correlation *falls* monotonically as more
pairs are admitted. That is the signature of no shared anatomy, not of a
registration that was missed: genuinely matching slices correlate near 1, and
0.3 is exactly what two unrelated slices scored before any of this was built.

**So the join cannot be verified the way this pipeline verifies everything else.**
`vhp_align_exams.py` was written to register by correlating overlapping anatomy,
and there is no overlapping anatomy to correlate. The offset must instead come
from the table-landmark arithmetic or from anatomical continuity at the pelvis —
both of which are judgements rather than measurements, and neither of which the
correlation check can confirm. The script therefore reports and refuses rather
than reporting a number it cannot stand behind.

---

## D10 — The CT route is right for personalisation and wrong for the reference atlas

**27 July 2026. This substantially walks back D7b, which was my argument.**

Rendering an abdominal slice at a standard soft-tissue window settles it. The
**ribs and vertebrae are crisp** — bone segments from this data without
difficulty. The **soft tissue is featureless grey**: no liver edge, no spleen, no
kidney, no bowel wall, heavy horizontal streak artefact across the whole slice,
and dark voids that are post-mortem gas.

The measurement agrees with the picture. Within the organ range (−100..200 HU)
the **standard deviation is 60 HU**. In a contrast-enhanced clinical CT the
*differences between organs* are roughly 10–30 HU — liver ~55, spleen ~45, kidney
cortex ~30. So here the noise is larger than the signal being segmented. **Organ
boundaries sit below the noise floor.**

### Why this cannot be fixed

Not a 1993 technology limit — a **cadaver limit**. Organ differentiation in CT
depends on iodinated contrast, which requires circulation. A body with no
circulation cannot be contrast-enhanced, so this would be equally true of a
cadaver scanned on a modern scanner. Freezing artefact and post-mortem gas make
it worse, but they are not the cause.

**Which means no cadaver CT will ever yield a good organ atlas**, and D9's choice
between VHP CT and clinical PET/CT was a choice between two options that both
fail — one for coverage, the other for contrast.

### What follows

**The reference atlas should stay artist-derived.** BodyParts3D, Z-Anatomy, SPL
and HRA are hand-built by medical illustrators precisely because segmenting
organs out of imaging does not produce clean anatomy. The body already rendering
in the app is better than anything marching cubes over this data would give.
**D7 already decided to adopt Z-Anatomy** — retopologised by illustrators, full
skeleton including hands and feet, CC BY-SA which is Tier 1 under D7. That is the
answer to the missing skeleton, not this.

**The segmentation pipeline is not wasted — it was aimed at the wrong target.**
It is the *personalisation* pipeline, where the input is a living patient's
contrast-enhanced CT and the contrast problem does not exist. Everything built
holds there: the GE→NIfTI converter is VHP-specific and would be dropped, but
MOOSE, `labelmap2glb.py`, the 139-row UBERON crosswalk, the mirroring check and
the shared-boundary meshing are all exactly what Phase 3 needs.

**Bone may still be worth taking from VHP CT.** Bone-air contrast is enormous and
needs no iodine; the ribcage and skull HRA lacks are clearly segmentable here.
That is a narrow, well-evidenced use, unlike the organ ambition.

### What this costs D3

Dual-sex was the other reason for D7b, and it does not survive either: the female
has no frozen CT, different coverage, and the same contrast problem. **Sex-matched
anatomy remains unsolved**, and the honest position is that no available source
solves it — HRA has both sexes and no skeleton, BodyParts3D and Z-Anatomy have a
skeleton and one male donor, SPL is single-sex and regional.

---

## D11 — Z-Anatomy: what adopting it actually costs

**Measured 27 July 2026**, before building anything.

### ⚠️ It is not uniformly CC BY-SA, and the repo badge is wrong

The README shows a blanket CC BY-SA 4.0 shield. `Resources/Models/License.txt`
in the same repository lists the components, and two of them are not:

> "Anatomy of the Inner Ear — by University of Dundee School of Medicine —
> **CC-BY-NC-SA 4.0**"
> "Kidney — by lissiecowley — **CC-BY-NC 4.0**"

Under **D7**, NC is **Tier 2 — research-usable, not bundleable**. Shipping either
would make the twin itself non-open, which is the commitment that motivated D7 in
the first place. This is the MedShapeNet pattern again: a top-level licence claim
that the project's own component list contradicts. **Trust the component file,
not the badge.**

**Mitigation is easy, because of how the files are split.** Z-Anatomy ships one
FBX per system, and the NC content sits in Visceral (kidney) and the ear. Taking
**only `SkeletalSystem100.fbx` and `MuscularSystem100.fbx`** — which is exactly
what D7b wanted Z-Anatomy for — avoids both entirely. Viscera stay on
BodyParts3D, which is CC BY 4.0.

### The distribution is better than expected

| | |
|---|---|
| Format | **FBX**, in-repo, plus .blend on Drive |
| Split | **one file per system** — skeletal, muscular, cardiovascular, nervous, visceral, joints, lymphoid |
| Tooling | three.js `FBXLoader` **parses it in Node** — 2.3 s for 41 MB, zero new dependencies |

The per-system split is a real simplification: `system` comes free from the
filename, where BodyParts3D needed an offline FMA hierarchy walk to derive it.

### The cost, measured

| | Skeletal | Muscular |
|---|---|---|
| Meshes | 1,952 | 686 |
| Triangles | 1.65 M | **2.32 M** |
| Distinct structures (after l/r merge) | **1,477** | 347 |

Two things follow.

**~4 M triangles for skeleton and muscle alone**, against 2.6 M for the entire
body we ship today. Decimation is not optional. Note the muscular file is the
denser one despite having a third of the meshes.

**⚠️ No ontology IDs.** Names are Terminologia Anatomica-style English with
`l`/`r` laterality suffixes — `Submental_nodesl`, `Lateral_condyle_of_tibia`.
(An earlier draft of this row also listed `j` as laterality. It is not; see the
correction in **D11a**.)
`userData` carries only `originalName`, `transformData` and `unitScaleFactor`.
BodyParts3D had FMA baked into every mesh; Z-Anatomy has nothing, so the
name→UBERON crosswalk is **~1,824 structures**, an order of magnitude beyond the
139-row MOOSE one.

**That crosswalk is deferred, not skipped, and it does not block adoption.** The
merged atlas has carried no ontology IDs since `eebfa24` and the app runs; D8
moved the health-data join upstream. So `system`, `layer` and `label` — all free
from Z-Anatomy — are enough for the viewer today, and the crosswalk can be built
progressively, major structures first.

The granularity is worth the price for a body viewer: 1,477 skeletal structures
includes named landmarks like `Anterior_intercondylar_area` and
`Inferior_articular_surface_of_tibia`, which is atlas-grade detail HRA and
BodyParts3D do not have.

> **⚠️ This last paragraph is wrong.** Those "named landmarks" are annotation
> markers, not geometry, and roughly half the skeletal mesh count with them. See
> **D11a**.

---

## D11a — Half the Z-Anatomy skeleton is annotation, and it rendered as needles

**Measured 27 July 2026**, after the first composed render.

The first "Best of both" build drew thin straight needles radiating out of the
body and crossing the skin. They came entirely from Z-Anatomy — no BodyParts3D
mesh has a single vertex outside the skin hull.

### What they are

Z-Anatomy labels named **surface features** of bones: the soleal line, the medial
malleolus, gnathion, the infrasternal angle. These are ridges, points and angles
*on* a bone, not separate structures, so the atlas draws each as a small marker
box with a stick pointing out to where the label text would sit. The sticks are
the needles.

They are suffixed `i` or `j`, and the suffix is a reliable signal:

| | SkeletalSystem100 | MuscularSystem100 | Joints100 |
|---|---|---|---|
| Meshes ending `i`/`j` | **966** | 0 | 0 |
| Their share of triangles | **0.75 %** | — | — |
| Largest two | `Gnathionj` (618 v), `Superior_thyroid_notchj` (558 v) | — | — |

Gnathion is a craniometric point and the superior thyroid notch is a notch, so
even the largest two are correctly annotation. Because the muscular and joint
files contain none, the filter cannot touch muscle or ligament geometry.

**Do not widen the rule to "36 vertices".** That was the tempting version — 958
of the 1,952 skeletal meshes are exactly 36 vertices — but Joints100 has 52
*genuine* 36-vertex ligaments (`Dorsal_cuboideonavicular_ligamentl` and family)
that a size-based rule would silently delete.

Also dropped: `Take_a_picture`, a zero-vertex camera helper the `HELPER` regex
missed.

### Two corrections to D11

1. **`j` is not laterality.** It marks a leader line. `splitName()` mapped it to
   "spans both sides", which was invented rather than observed.
2. **The structure counts were inflated by annotation.** Skeletal is **981**
   meshes, not 1,952, and the "atlas-grade named landmarks" praised above are
   marker boxes, not modelled geometry. The granularity argument for Z-Anatomy
   rests on its **retopologised muscle**, which is real and excellent — not on a
   structure count that was half labels.

### It also settles the registration question

Before the filter, the Z-Anatomy skeleton measured 14 % wider and **44 % deeper**
than the BodyParts3D skin hull — apparently damning for composing the two. After
it, proportions relative to height:

| | width / height | depth / height |
|---|---|---|
| BodyParts3D skin hull | 0.388 | 0.170 |
| Z-Anatomy skeleton | 0.394 | **0.158** |

The skeleton now sits **inside** the skin, which is what "same donor" predicts.
The entire anomaly was label sticks. What remains is ~0.4 % of vertices at hand
height, where Z-Anatomy's fingers splay about 4.6 cm wider than BodyParts3D's
skin — a genuine minor pose difference, and not worth registering away. It was
invisible at the 10 % hull that was the default when this was written; the landing
state now opens at 80 % with the glass rim, so the fingers are the one place the
mismatch can be seen. Still only in `composed`, which is no longer the default
either, and still not worth registering away.

**Lesson for the next atlas import: count what you are importing before praising
its granularity.** A teaching atlas ships teaching furniture, and it is named
like anatomy.

---

## D11b — Half the Z-Anatomy body was inside-out

**Measured 27 July 2026**, immediately after D11a, on the same import.

With the needles gone the composed body still had a hard seam down the midline:
one half showed proper muscle relief, the other was smooth and washed out. The
seam stayed fixed to the body when the camera orbited behind it, so it was
geometry, not lighting.

### Cause

Z-Anatomy builds the body's second side by **mirroring** the first — a
negative-determinant transform. `collect()` in `scripts/build-z-anatomy.mjs`
bakes each mesh's world matrix into its vertex positions, which places the
vertices correctly but **reverses each triangle's orientation**. The winding was
never flipped back.

That is invisible until something reads the winding. Two things do:

1. The GLB carries no `NORMAL`, so `AtlasBody` calls `computeVertexNormals()`,
   which derives normals from winding. The mirrored half got normals pointing
   *into* the body, and since non-shell materials use `side: FrontSide`, that
   half was back-face culled — you saw through it to the inside of the far wall.
2. `bake-ao.mjs` orients its sampling hemisphere by the normal, so the first AO
   bake fired its rays inward on that half and its occlusion was meaningless.

Roughly **half of every file** was affected, as a bilateral body built by
mirroring would be: 460/981 skeletal meshes, 339/683 muscular, 181/413 joints.

### How it was caught

Not by triangle count or surface area — those were symmetric to within 0.4 %,
which is exactly why the bug survived the D11a checks. **Signed volume per half**
(divergence theorem, tetrahedra to the origin) is the test that finds it:

| mesh | −x half | +x half | |
|---|---|---|---|
| bone, before | +0.00308 | −0.00167 | opposite |
| muscle, before | +0.04042 | −0.02735 | opposite |
| bone, after | +0.00310 | +0.00296 | consistent |
| muscle, after | +0.04048 | +0.03902 | consistent |

Every BodyParts3D mesh agreed in sign throughout, which is what made Z-Anatomy's
disagreement conclusive rather than merely odd.

**Keep this check.** Any future import that bakes transforms into vertices can
reintroduce it, and the failure mode looks like a shading or lighting problem
rather than a geometry one.

---

## D8 — Scope: this repo renders a human, it does not interpret health data

**Decided 27 July 2026.**

Scoring, terminology mapping and code→system assignment are **out of scope here**
and belong to <https://github.com/etzm/open-twin>, where the reference-interval
and terminology machinery already lives. The two will be reconciled later.

**Why this is the right split and not just a preference.** `HANDOVER_SPEC`
section 5a already said the home is a `@open-twin/scoring` package upstream. The
work also cannot be done well in isolation: verified during this session, **no
wearable connector attaches a reference interval to anything** — zero call sites
across all four providers — so scoring built here would be scoring against data
that upstream has not yet made scorable. Fixing that means changing the
connectors, which is upstream's repo by definition.

**What was removed.** A complete scoring layer written against the
`fromFhirBundle()` seam, plus a drafted code→system map with proposed weights.
Both are preserved in history at **commit `6c6e125`** and **`0d2388a`**, and the
scoring module is pure — it imports nothing from the viewer, so it lifts
unchanged if it is useful upstream. Worth carrying across if so:

- reference-interval normalisation that returns `null` with a reason rather than
  a number wherever a number would be a guess
- four honest score states, distinguishing "no connector" from "measurements we
  are not entitled to summarise"
- `systemWeighting()` refusing to construct without a named clinical reviewer,
  mirroring how `referenceInterval()` already refuses without a source URL

**What stays here.** The `anatomical` / `health` colour modes — those are
rendering, not interpretation. `assertTwinMetrics()` also stays: this repo
still refuses to render a fabricated score at the boundary, which is the one data
guarantee a viewer can meaningfully keep.

**What this repo is about**, restated so the next session does not drift: the
human. Anatomy, geometry, materials, lighting, XR, and personalisation from
imaging and body scans. It consumes an already-scored `TwinMetrics` and asks
no questions about how the numbers were reached.

---

## D12 — The licence gate moves from import time to publish time

**Decided 28 July 2026. Amends the operation of D7, not its criterion.**

This repository is a **private, non-public, experimental build** whose purpose is
to learn which models and tools actually produce the best body. D7's tier table
already anticipated this case — Tier 2 reads *"compute with it, learn from it,
validate against it. Keep it out of the shipped artifact."* What was missing is
the observation that **this build is not a shipped artifact**, so nothing was
being kept out of anything.

So the rule changes shape rather than relaxing:

> **Before:** a non-open asset may not be imported.
> **Now:** a non-open asset may be imported, and may not be **published**.

**D7's criterion is untouched.** The twin still has to be open when it ships.
What changes is *when* that is enforced, and the entire safety of the change
rests on the enforcement being mechanical rather than remembered.

### What makes this safe, and what would make it unsafe

`licences.json` is the register and `npm run check:licences` is the gate.

```bash
npm run check:licences             # report the tier of the current build
npm run check:licences -- --public # assert publishable; exit 1 if not
```

Three properties matter, and all three are tested:

1. **It walks the directory, not the register.** An asset that arrives on disk
   with no entry fails the check and is treated as tier 3. An undocumented
   download is the exact failure this decision has to prevent, and it is
   invisible to a register-driven walk.
2. **Tier 4 exists and no phase flag reaches it.** D12 relaxes *our licence
   policy*. It cannot relax *someone else's contract*. Zygote's EULA and the UK
   Biobank and NAKO material transfer agreements bind regardless of whether we
   intend to publish, and they are recorded separately for that reason.
3. **NC geometry goes in a separately named file.** The one thing the gate cannot
   see is a tier 2 mesh merged *into* a tier 1 GLB — the result carries one name
   and looks like one asset. So `z-anatomy-nc.ao.glb` stays distinct from
   `z-anatomy.ao.glb` even though the app would rather load one file. **The
   separation has to exist in the filename, because the filename is all the gate
   has to go on.**

The way this decision goes wrong is not someone deliberately publishing NC
geometry. It is someone merging viscera into the musculoskeletal GLB for a
legitimate performance reason, eighteen months from now, with no idea that the
filename was load-bearing. Hence this paragraph.

### ⚠️ The most important finding is not about NC at all

Reviewing the stack against the register turned up something that **needed no
relaxation whatsoever**: Z-Anatomy ships **seven** per-system FBX files and
`build-z-anatomy.mjs` imports **three**.

The NC components are the kidney (Visceral) and the inner ear. That is all.
**Cardiovascular, Nervous and Lymphoid carry no NC component and are plain
CC BY-SA 4.0 — Tier 1 under D7 as originally written.** They were never
licence-blocked. They are simply unbuilt, and D11's "take only skeletal and
muscular" mitigation was read for years afterwards as if it were a licence
boundary when it was only ever a statement about which two files were needed at
the time.

So the headline result of relaxing the policy is that **most of what was
unlocked was never locked.** Worth remembering the next time a constraint is
inherited rather than checked.

### ⚠️ And the same audit found the opposite error, which is the worse one

Checking the other direction — not "what is needlessly excluded" but "what is
wrongly included" — found that `NervousSystem100.fbx` was **not** tier 1, and
importing it wholesale put two kinds of non-open geometry into the asset marked
publishable:

- **Inner ear** — Cochlea, Vestibule, Tympanic membrane, Auditory tube — the
  CC BY-NC-SA Dundee component. Tier 2.
- **White matter** of telencephalon and spinal cord — the University of
  Washington "Brainder" component, listed in Z-Anatomy's own licence file with
  **no licence at all**. Tier 3, which is stricter: NC withholds commercial use,
  silence withholds everything.

`docs/ROADMAP.md` Phase 3 had flagged exactly this and said "do not take this on
the licence file's word — scan the FBX first". The scan was skipped on the first
pass and the contamination went straight into `z-anatomy.glb`. It was caught by
reading the roadmap afterwards, not by any check.

**This is the argument for the register being machine-readable and the gate being
mechanical.** Both errors — needlessly excluding three open files, and wrongly
including two non-open components — came from a prose note being read as a
licence boundary years after it was written as a scope note. `build-z-anatomy.mjs`
now assigns tier **per structure**, and writes `z-anatomy.glb`,
`z-anatomy-nc.glb` and `z-anatomy-unlicensed.glb` so the boundary is a filename
rather than a memory.

**A relaxation is not only permission to add. It is an obligation to re-audit
what was already there**, because the reasoning that wrongly excluded three files
is the same reasoning that wrongly waved through two components.

### What the relaxation genuinely unlocks

| | Now usable | Tier | Why it was blocked |
|---|---|---|---|
| **Z-Anatomy Visceral** | retopologised organs vs BodyParts3D's documented holes | 2 | the kidney is CC BY-NC |
| **TotalSegmentator gated tasks** | `tissue_types` (fat + skeletal muscle), `appendicular_bones` (hands, feet), `heartchambers_highres`, `face` (the defacing mask) | 2 | academic weights are non-commercial |
| **MedShapeNet, 3D-IRCADb** | 100k+ ready meshes for evaluation | 3 | ND — adapt privately, never redistribute |
| **CHAOS, AbdomenAtlas, TotalSegmentator-MRI** | more segmentation training data | 2 | NC-SA |
| **SMPL / SMPL-X / STAR / SUPR, OSSO, SKEL, HIT** | parametric bodies; **HIT is the closest published work to this project's ambition** | 2 | non-commercial research licences |

### And what it does not unlock

- **Zygote** — proprietary, five figures. A purchase and a contract, not a tier.
- **UK Biobank, NAKO** — signed MTAs forbidding sublicensing, with derived
  results returning to the holder.
- **MRSegmentator base weights** — no licence statement *at all*. Unstated is not
  the same as permissive: it grants nothing. Running them privately is a
  calculated risk; anything derived from them can never be distributed.

### ⚠️ The gate described above lasted about an hour — see **D12b**

D12's findings all stand. Its *mechanism* — quarantining non-open geometry into
separate GLBs behind a publish gate — was replaced the same day. Read D12b
before implementing anything from this section.

---

## D12b — Take everything, record everything. No licence exclusions.

**Decided 28 July 2026. Replaces D12's mechanism; keeps its findings.**

> "Do include everything available in each of the models' visualisations, but
> keep a log file for any licence-related information on all of those, so when
> time comes to publish we have this for due diligence. This will not become a
> commercial product, we will remain open source and make all attributions
> needed."

So the question stops being *"may we include this?"* and becomes *"do we know
exactly what we included, and have we credited it?"* Every atlas is imported in
full. There are no licence-driven holes in the body.

### Why the D12 mechanism had to go

It cut the body up to satisfy a check. Z-Anatomy ended up as three GLBs —
`z-anatomy.glb`, `-nc.glb`, `-unlicensed.glb` — so that a filename-matching gate
could refuse two of them. That bought a machine-verifiable publish check and paid
for it with an atlas that no longer rendered a complete human: the viscera, the
inner ear and the white matter all lived in files the app was not allowed to
load. **For a body viewer, a body with holes in it is the worse defect.**

And the premise was wrong anyway. Non-commercial licences do not prohibit this
project's actual use — they prohibit *selling* it, which is not the plan.

### What replaces it

**Per-structure provenance, carried inside the asset.** `build-z-anatomy.mjs`
tags every structure that came from a third-party component (`component` and
`licence` fields in the structure table) and writes the component roster into the
scene extras. `npm run check:licences` reads that back out of the *shipped GLB*
and regenerates **`docs/LICENCE_LOG.md`**.

Reading the asset rather than a table is the point. Two documents in this repo
had already gone stale — `docs/RESOURCES.md` was asserting Z-Anatomy was "not yet
pulled in" while it supplied the entire musculoskeletal system. A log derived
from the artifact cannot drift from the artifact. If a component's name pattern
stops matching, its count drops to zero and the log says so in the action list.

Current state: **3,617 structures, of which 3,602 are Z-Anatomy's own CC BY-SA
work.** The other 15 are the Dundee inner ear (8), the lissiecowley kidney (4)
and the University of Washington white matter (3). All credited in
`AttributionBar`, in each asset's `asset.copyright`, and in the log.

### Two things to be straight about when publishing

1. **"Open source" and "non-commercial" are not the same claim.** CC BY-NC and
   CC BY-NC-SA components cannot be re-offered under a licence that permits
   commercial reuse, so the bundled result is **open source, non-commercial** —
   not Open Definition conformant, which is what D7 originally aimed at. That is
   a fine thing to be; it just has to be *said* rather than implied. Do not badge
   the release CC BY-SA and leave it there.

2. **The white matter is the one item attribution does not fix.** The University
   of Washington component is listed by Z-Anatomy with no licence at all, and
   silence grants nothing — a credit line satisfies a licence's conditions, it
   cannot manufacture permission that was never given. It ships in the build as
   instructed and sits at the top of the log's action list. Either get written
   permission, or replace those 3 structures with CT-segmented white matter from
   MOOSE (Apache-2.0). This is a task with a deadline of "before publication",
   not a blocker on the build.

### What is still excluded, and why it is not a licence decision

- **`Regions of human body100.fbx`** — plain CC BY-SA, no licence issue at all.
  Left out because it is body *regions* (thorax, arm, leg) that duplicate
  geometry already present and would render a second body inside the first.
  Include it the day a region-based navigation control wants it.
- **Zygote, UK Biobank, NAKO** — closed by a proprietary EULA and by signed
  material transfer agreements. D12b is a decision about our own licence policy;
  it cannot reach an agreement with somebody else.

---

## D13 — "No health data" must not dissolve the anatomy

**Decided 28 July 2026.** A one-word fix behind a long misdiagnosis, recorded
because the misdiagnosis is the instructive part.

### The symptom

HRA's abdomen rendered as a **point cloud** — liver, intestines and bladder as a
dust of dots, while the pelvis and femurs stayed solid.

### The cause

`AtlasBody` ghosted anything with `score === null` to 45 % opacity, and
non-shell materials use `alphaHash` — **stochastic transparency, which dithers by
discarding fragments**. At 45 % that throws away more than half of them, so a
thin organ wall breaks into scattered specks. The scored musculoskeletal system
(score 9) stayed at opacity 1 and looked perfect, which is exactly what made it
look like a per-organ geometry defect.

In the bundled sample, `digestive`, `endocrine`, `reproductive` and
`integumentary` all carry `score: null`. HRA additionally leaves 38 of its 96
meshes unresolved, and unresolved took the same 45 %.

**The rule was right when this was a health dashboard** — an unmeasured system
should look unmeasured. But **D8 moved scoring upstream and this repository
became a body viewer**, so most systems now legitimately have no score, and the
rule had quietly become "dissolve most of the body". The ghost is now scoped to
the `metrics` colour mode (called `health` until D15), matching what the muscle rule
on the line above already did. `anatomical` renders solid.

### ⚠️ Six wrong diagnoses first, and why each was wrong

Worth keeping, because every one of them was *plausible* and each was refuted by
measuring rather than by arguing:

| # | hypothesis | what killed it |
|---|---|---|
| 1 | AO strength too high | local vertex-to-vertex AO variance was **0.006** on HRA against **0.031** on BodyParts3D, which looks fine — HRA's AO was five times *smoother* |
| 2 | AO bimodal / needs smoothing | smoothing landed and the dots were unchanged |
| 3 | simplification tearing the meshes | tightening `--simplify-error` 10× made hole counts go **up** (more triangles), so the holes were in the source |
| 4 | duplicate/coincident geometry | only 4 duplicate bounding boxes, all genuine left/right pairs |
| 5 | primitives rendering as `POINTS` | all 96 primitives are `TRIANGLES` |
| 6 | inconsistent or inverted winding | 0.0 % winding conflicts on the affected organs, all 96 meshes outward-wound — and the *pelvis*, at 18 % conflicts, rendered solid |

What finally located it was forcing `side: DoubleSide` as a throwaway experiment:
the dots vanished. That made no sense for correctly-wound geometry — until the
reason became clear, which is that DoubleSide submits twice the fragments, so
twice as many survive a stochastic discard. **The workaround pointed at the
mechanism even though it was the wrong fix.**

### What to take from it

- **A material can look exactly like a broken mesh.** Nothing in the geometry was
  wrong. Six measurements of the asset could not find a fault in the asset.
- **Check the render path before the asset**, when the asset passes its checks.
  `check:winding` and `check:structures` were green throughout, and they were
  right.
- `alphaHash` is deliberate and documented (it avoids the sort artifacts alpha
  blending has here), but **it converts opacity into noise**. Any opacity between
  roughly 0.3 and 0.7 on thin geometry will read as speckle. Treat a fractional
  opacity on anatomy as a visual decision, not a free one.

---

## What is *not* decided

- ~~Which MR segmenter covers Phase 3~~ — **answered in D7a**: MOOSE for the
  bundled CT atlas, TotalSegmentator `total_mr` (Apache-2.0) for MR, gated tasks
  in the per-user path only. Nothing is blocked on a licence request.
  *(Segmentation stays in scope under D8 — it generates anatomy, which is this
  repo's subject. Scoring does not.)*
- ~~Whether to formally re-adopt Z-Anatomy and rebuild against it~~ — **done.**
  It ships, and `COMPOSED_SOURCE` takes musculoskeletal from it. What remains
  open is *how much* of it: three of its seven system files are imported, and
  per **D12** three of the four missing ones were never licence-blocked.
- **Whether the SPL atlases provide both sexes.** If single-sex, D3's matching
  requirement still needs HRA underneath (see D3a).
- **How a female twin gets musculoskeletal anatomy**, given BodyParts3D is
  male-only (see D3, possibly answered by D6).
- **Whether the merged-atlas draw-call win is recovered with per-vertex structure
  IDs**, restoring the ontology join that `eebfa24` spent. Analysis done; no
  decision taken.
- **Which registration mechanism** unlocks the multi-atlas merging D3a wants —
  landmark/TPS to a common template, or shape-space interpolation. Nothing is
  implemented; scene-level merging is blocked until one exists.

---

## D14 — The glass hull is per-atlas, because two of seven sources have no skin

**Decided 4 August 2026.** Recorded because the app now looks different depending on
which atlas is loaded, and that is a property of the data rather than a bug to chase.

### The finding

A Fresnel rim on the body hull needs a hull. Counted in the shipped assets:

| atlas | integumentary meshes |
|---|---|
| `bodyparts3d` | **1** — the skin, 101,690 triangles |
| `hra`, `hra-m` | **2** — the skin, plus an abdominal adipose depot |
| `composed` | 1 (male, from BodyParts3D) or 2 (female, from HRA) |
| `z-anatomy`, `z-anatomy-regions` | **0** |
| `ct-atlas-f`, `htb-ct-f` | **0** |

So the effect is unavailable on three of the selectable sources — including Z-Anatomy,
which has the richest musculoskeletal and nervous coverage. **The best anatomy is
exactly where the best-looking hull is impossible.**

### The decision

The toggle **disables itself and says "no skin"** rather than appearing to work. Same
rule the atlas pills already apply to a missing GLB: a control that silently does
nothing is worse than one that says it cannot. Availability is read from
`presentSystemsBySource`, published by `AtlasBody` from the asset actually loaded, so it
cannot drift from a hand-kept table.

### Two traps found while implementing it, both worth knowing

**HRA's integumentary system has two members**, and the second is not the envelope. A
rim keyed on `systemId === 'integumentary'` lights the adipose depot as a glowing mass
inside the abdomen. `isBodyHull()` is the envelope test; `isShell` remains the system
test, and the two are not interchangeable. The same distinction later fixed the depot
taking the hull's 80 % opacity.

**`customProgramCacheKey` must include the flag.** three.js uses it to decide whether two
materials may share a compiled program, and a new material matching an existing key is
handed that program with **`onBeforeCompile` never called** — so an injection is built,
assigned and silently discarded. The symptom misleads: the toggle does nothing on the
atlas already loaded and works perfectly on the next one switched to, because a fresh
mount has no program to reuse.

---

## D15 — No user-facing "health", and the product is Open Twin XR

**Decided 4 August 2026.** Completes the scope change D8 began, in the one place it had
never reached: the words.

### What changed

`HealthTwinData` → **`TwinMetrics`**. `colourMode: 'health'` → **`'metrics'`**, so the
toggle reads "Metrics". `healthColor.ts` → `metricColor.ts`. The page title was
`Open Twin OpenXR - Human Health Digital Twin` and is now
`Open Twin XR — open-source human body viewer`. The product is **Open Twin XR**
throughout — which also stops the name claiming OpenXR, a Khronos standard this app does
not use; it uses **WebXR**.

### Why not "medical data"

It was the proposed replacement and it is the wrong direction. **"Medical" implies
clinical use, which is precisely what invites medical-device reading** — Apple's
guideline 1.4.1, and the EU MDR and FDA software-as-a-medical-device regimes. It would
have raised the claim while appearing to lower it. "Metrics" says only what is true: a
number was supplied and mapped to a colour.

### What deliberately still says "health", and why renaming it would be worse

- **GDPR references.** The regulation's own term at Article 9 is "data concerning
  health". Writing "medical" there would make the citation wrong.
- **The safeguard warnings** — "must never be presented as anyone's measured health".
  That sentence exists to forbid a health claim. Weakening its wording weakens the guard.
- **The historical record.** This *was* a health dashboard. D8, D13 and the dormant
  components under `src/ui/` say so, and rewriting that history would make the log false.
- **Proper nouns.** TCIA's `Healthy-Total-Body-CTs`, and `Google Health` as a connector
  name.

### What this does not fix

⚠️ **Renaming is not a regulatory answer.** The metrics mode still colours anatomy on a
red-amber-green scale from a supplied value, and the bundled sample is still fictional.
See [`reports/06-app-store-publication.md`](reports/06-app-store-publication.md) §5 —
for any public or store distribution, the question is what the scale *means*, and an
honest label is not a substitute for a validated methodology. This is currently an
internal tool, which is why that question is deferred rather than answered.

---

## D16 — Parametric body envelopes live in their own registry, and are not atlases

**7–8 August 2026.** Closes the gap D14 measured, and refuses the obvious way of
doing it.

### The gap

D14 recorded that the glass hull is a per-atlas capability because two of seven
sources ship no skin. It is now three of seven — `z-anatomy`,
`z-anatomy-regions` and both CT atlases carry no `integumentary` geometry at all —
and `useHasHull()` disabled the control with an inline "no skin" note. So **the
richest anatomy in the repository was exactly where the best-looking hull was
impossible**, which is an unsatisfying place to leave a rendering feature.

A parametric human body model is a skin generator. **ANNY** (NAVER LABS Europe,
Apache-2.0 code over CC0 MakeHuman-derived shape assets) is the only permissive
one with infant-to-elder coverage, and its static bake is 13,718 vertices — cheap
enough to add to any scene.

### The decision

**A separate `BODY_ENVELOPES` registry in `src/scene/bodyEnvelopes.ts`, not an
eighth `AnatomySource`.**

`AnatomySource` requires `donor: { label, derivedFrom, sex }`, and both
`sourceBreakdown()` and `AtlasAttribution` assume one. A parametric body has **no
donor** — it is scan-free, which is an ethical feature rather than a gap — and
**no ontology terms at all**, in a registry whose entire current purpose is
structure identity. Making `donor` optional for the sake of one entry would
weaken a field seven entries depend on.

This repository has already made this exact call once, for organ overlays, which
`docs/HANDOVER.md` describes as "a separate mechanism from atlases". Same
reasoning, same answer.

### What it costs, and this is the part that matters

**The envelope does not follow the atlas's pose, and cannot be made to.** ANNY
bakes in its own rest pose; every atlas here has its own. Measured on Z-Anatomy:

| | across the arms | front to back |
|---|---|---|
| envelope | 1.124 m | 0.436 m |
| atlas | 0.646 m | 0.242 m |

It encloses the torso and it does not enclose the limbs. A uniform scale cannot
fix that, because the difference is angular, not dimensional — and the atlas even
protrudes ~5 mm behind the envelope's back.

So the envelope is presented as **a reference silhouette, not as this body's
skin**, and the interface says so in those words rather than only in a comment.
Rendering it as clear glass with a lit rim rather than as opaque skin is the
visual half of the same statement. Fixing it properly means rigging the envelope
and posing it per atlas, which is real work and is not done here.

### Two corrections to the source material, both measured

The research notes this was built from had ANNY's preset table wrong twice, and
both errors would have shipped a body labelled as something it is not.

1. **`gender` runs male (0) to female (1)**, not the reverse. Confirmed three
   ways: `PHENOTYPE_VARIATIONS` in the package declares `gender=["male","female"]`
   and the scalar interpolates that ordered list; `shape_distribution.py` splits
   with `torch.where(gender <= 0.5, boys_height, girls_height)`; and measured
   stature falls monotonically 1.697 m → 1.560 m as the value goes 0 → 1. The
   notes' `pregnant` preset was `gender: 0.0`, which is a **male** body.
2. **`age: 0.5` is an adolescent, not an adult.** ANNY's five age stops are spaced
   uniformly over 0..1, unlike MakeHuman's macro where 0.5 means 25 years.
   Measured at neutral gender, height climbs to a plateau at **0.75** (1.831 m)
   and declines slightly to 1.0 (1.812 m) — growth, then age-related stature
   loss. The adult presets sit at 0.75.

`scripts/anny/bake.py` carries the measurements; the registry carries the
corrected parameters, and every preset records its own provenance so the bake can
be reproduced.

### The licence trap

**ANNY is three licence buckets in one package**, and recording only the headline
Apache-2.0 would misstate what is on screen: the code is Apache-2.0, the shape
assets this geometry derives from are **CC0-1.0**, and a SOMA topology ships
alongside under Apache-2.0. All three are declared in the registry and rendered
in-app.

⚠️ **Never select `topology="smpl"` or `"smplx"`.** Both trigger a **runtime**
download of a non-commercial archive from NAVER's CDN inside
`download_noncommercial_data()`. Because it happens at runtime rather than at
install time, **a dependency audit does not catch it**. `scripts/anny/bake.py`
hardcodes the safe topology and exposes no flag for it.

### D16a — Amendment: the envelope is STANDALONE, and the pairing is now checked

**8 August 2026, same day.** Two things the entry above did not say, both of which
came out of the question "does this mean it is kinda standalone?".

**It is standalone, measurably.** `BodyEnvelope` reads four store fields —
`bodyEnvelope`, `envelopeAvailability`, `hullOpacity`, `glassHull`. **Not one says
anything about which atlas is loaded, whose body it is, or which sex.** The only
thing the two share is the canonical frame and a scale to 1.7 m. It is a shape
drawn *around* the anatomy, not a shape the anatomy participates in.

⚠️ **Which means a parametric envelope would be MORE standalone, not less** — and
that reverses the obvious next step. A continuously morphable envelope lets you
dial up "child" while the organs inside stay adult male TARO. A fixed adult
envelope around adult anatomy is at least coherent; a child envelope around adult
organs is a claim the geometry cannot support. **Morph targets would make a better
shape browser and a worse body.** Not built, deliberately.

**The pairing was unchecked, which was out of character for this app.** You could
select "Adult male" while viewing the female CT donor and nothing said a word —
while `AttributionBar` carries three separate donor-mismatch warnings for atlases
and overlays. Fixed: `envelopeSex()` derives a preset's sex from
`provenance.parameters.gender` (not from its label, so a mislabelled bake cannot
lie), the envelope swaps to the donor's sex when the ATLAS changes, and a
deliberate mismatch is labelled rather than undone.

⚠️ **The trap in that fix, because it is not obvious.** Keying the swap effect on
`envelopeId` re-runs it on a pill click, sees the mismatch the click just created,
and swaps straight back — so the override becomes impossible and the warning
becomes unreachable code. It is keyed on the DONOR alone, with the envelope read
through `getState()`. Caught by testing the override, not by reading the code:
the first version's own comment claimed it did not fire on a click, and it did.

**What would genuinely couple the two is Phase 7, and it is hard for a stateable
reason:** deforming organs by a skin-surface transform yields a *wrong* organ, not
a personalised one, because organ shape is not a function of skin shape. That is
the same class of objection D10 used to reject cadaver CT. Specified as future
work in [`research/ORGAN_SHAPE_MODELS.md`](research/ORGAN_SHAPE_MODELS.md).
