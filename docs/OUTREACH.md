# Pre-publication outreach — the letters owed before this goes public

**Compiled 17 August 2026.** Every question below is already recorded somewhere in
this repository; nothing here is new policy. What this file adds is a *recipient*, a
*findable address* and a *sendable text* for each one, so the pre-publication action
list can be worked through rather than re-derived.

Sources, in order of authority:

- [`../licences.json`](../licences.json) — the register. `verify` fields are the questions.
- [`LICENCE_LOG.md`](LICENCE_LOG.md) — **generated**; its "Action list before publishing"
  is the same set. `npm run check:licences`.
- [`reports/05-licence-and-publishability.md`](reports/05-licence-and-publishability.md)
  — "The four open questions, and who answers them".
- [`STACK_AND_MODELS.md`](STACK_AND_MODELS.md) §4 — "Outreach needed — in priority order".
- [`DEPLOY.md`](DEPLOY.md) — the build-time gate that outreach does **not** replace.

> ### Four things to know before you send anything
>
> 1. **The drafts quote no counts, ids or percentages, deliberately.** `docs/README.md`
>    forbids typing one into prose anywhere in `docs/`, because a hand-typed figure went
>    wrong before and a mask built from it would have hidden the wrong anatomy (D18). If
>    a recipient asks for exact figures, run `npm run check:licences` and read them off
>    `LICENCE_LOG.md` on the day you reply. Square brackets in the drafts mark a *name*
>    or a *credit line* to paste in, never a number to invent.
> 2. **The site and the main repository are PUBLIC** (since 18 August 2026:
>    <https://opentwin.opening.science> and `Opening-Science/open-twin-xr`;
>    `etzm/open-twin-openXR` remains private). Drafts may link both — a recipient who
>    can read `licences.json` and see their credit rendered answers faster.
> 3. **Verify each address at its source before sending.** Where an address was read
>    off the rights holder's own page it is marked ✅ *verified*; where it is a channel
>    rather than a mailbox it is marked ⚠️. Two of the addresses below are not
>    published anywhere findable, and that is recorded rather than guessed at.
> 4. **A letter cannot substitute for the build flag.** Serving to logged-in users is
>    still distribution. `npm run build:z-anatomy -- --publishable` is what keeps the
>    unlicensed component out; see the internal list at the end of this file.

---

## Who has to be written to, and what turns on it

| # | recipient | address | question | blocks launch? |
|---|---|---|---|---|
| 1 | **biv-me authors** — Joshua R. Dillon, Charlène Mauger | ✅ sent | **✅ ANSWERED 18 Aug 2026.** CARDIOHANCE, local ethics approval, no restrictions; cite the repo + the 2026 Med Image Anal paper (D21) | ~~YES~~ — resolved; the heart ships |
| 2 | **Z-Anatomy** — Gauthier Kervyn (the modeller), via the **models** repo | ✅ sent | **✅ SENT 18 Aug 2026** as [`Z-Anatomy/Models-of-human-anatomy#7`](https://github.com/Z-Anatomy/Models-of-human-anatomy/issues/7) — the wrong UW credit, the BodyParts3D licence question, and the #5 comparison findings. Awaiting reply | Attribution accuracy of an asset that **is** shipping |
| 3 | **Brainder** — Anderson M. Winkler | ✅ sent | **✅ ANSWERED 17 Aug 2026.** UW attribution denied; a reply with renders is drafted below | No — the component is excluded today |
| 4 | ~~**University of Washington**~~ | — | ⛔ **Do not send.** The named source denies any UW affiliation, so the premise is gone | No |
| 5 | **DBCLS** (BodyParts3D) | ✅ `bodyparts@dbcls.rois.ac.jp` | Written confirmation of the 2025-02-27 CC BY 4.0 relicence | No — but the default atlas rests on an unconfirmed reading |
| 6 | **HuBMAP HRA** — MC-IU | ✅ `infoccf@indiana.edu` | Which version-specific citation must we render? | No — but the exact wording is a CC BY condition |
| 7 | **University of Dundee** — Caroline Erolin | ✅ sent | **✅ ANSWERED 18 Aug 2026.** Both components are themselves derivatives; the fuller chains now ship (D23). One question left: the cranial-nerves page states no licence at all | No — but it changed what we print |
| 8 | **Courtesy notices** — OpenEar, TCIA, NAVER LABS Europe, lissiecowley | see §8 | None. "We are using your work, here is the credit" | No |

Nothing in this table is a licence *fee*, and nothing here is a negotiation. Items
5–8 confirm readings and wordings; items 1–4 are about whether a grant exists at all.

---

## 1. biv-me — ✅ SENT, AND ANSWERED 18 AUGUST 2026

> ### What Joshua Dillon answered, and what changed on its strength (D21)
>
> The bundled `patient1` demo case is a **CARDIOHANCE** participant, for which the
> authors hold **local ethics approval to share online**, and there are **no
> restrictions** on our further use. Requested credit: the GitHub repository plus a
> biv-me paper — preferring the **2026 Medical Image Analysis paper** over the
> superseded FIMH 2025 one this project had been citing:
>
> > Dillon, J., Mauger, C., Zhao, D., Petersen, S. E., McCulloch, A. D., Young, A. A.,
> > & Nash, M. P. (2026). biv-me: Open-source software for generating time-varying
> > biventricular meshes from cine cardiovascular magnetic resonance imaging with
> > multi-cohort validation. *Medical Image Analysis*, 114, 104252.
> > doi:10.1016/j.media.2026.104252
>
> Acted on the same day: `publishable: true` in `src/scene/organOverlays.ts`, the
> attribution and register now name the cohort, the ethics basis and the 2026
> citation, the UK Biobank withdrawal branch is dead, and the Sunnybrook CC0
> fallback stays recorded as history only. **This was the letter that blocked the
> public release, and with it answered the login wall came down** — see D21 for the
> one asset still withheld (`ct-atlas-f`) and the mechanism that now withholds it.

**Short acknowledgement to send:**

> Dear Joshua,
>
> Thank you — that answers it completely. We have updated the credit to cite the
> repository and the 2026 Medical Image Analysis paper as you prefer, and the
> interface now states the cohort and the ethics basis alongside it: "fitted to cine
> CMR of a CARDIOHANCE study participant, shared with local ethics approval." The
> beating heart is public at <https://opentwin.opening.science> — you are welcome to
> see how it is presented, and if you would like anything worded differently, say so
> and we will change it.
>
> With thanks, also to Dr Mauger,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

<details>
<summary>The original letter, sent 17 August 2026 — kept for the record</summary>

**To:** joshua.dillon@auckland.ac.nz
**Cc:** charlene.1.mauger@kcl.ac.uk
**Subject:** Provenance of the biv-me demo case (patient1) — redistribution of derived meshes

> Dear Dr Dillon, Dr Mauger,
>
> Thank you for releasing biv-me. The fitted biventricular meshes are the only open,
> time-resolved heart geometry we have been able to find, and the pipeline is a
> pleasure to read.
>
> I maintain **Open Twin XR**, an open-source WebXR human body viewer published by the
> Open Science Foundation: MIT code, with each anatomy asset kept as a separate file
> under its own licence and credited in the interface. We have converted the fitted
> meshes in `demo/fitted-models/example/patient1/` into a glTF beating-heart overlay —
> the cardiac phases as morph targets, no imaging data of any kind. It is visible today
> only behind a login wall, and we are holding it there until one question is answered.
>
> Your FIMH 2025 paper (doi:10.1007/978-3-031-94562-5_34) acknowledges "the study
> participants of the UK Biobank and CARDIOHANCE", and its abstract describes CMR data
> contributed from two centres. The repository carries no data statement, no ethics or
> consent text, and it bundles input DICOMs for the case named `patient1`. So:
>
> 1. Which of the two cohorts is the bundled `patient1` demo case?
> 2. If it is UK Biobank, we assume that redistributing geometry derived from it is not
>    permitted under their access terms — derived data returning to UK Biobank rather
>    than being published onward — and that Apache-2.0 at the repository root cannot
>    override your own obligations to them. We will withdraw the asset. Please correct
>    us if that reading is wrong.
> 3. If it is the other cohort, are you content for fitted meshes of that case to be
>    redistributed in derived form — a decimated glTF surface, no imaging data — with
>    attribution to biv-me and a citation to the FIMH paper?
> 4. Is there a data statement, ethics reference or consent wording you would like us
>    to reproduce alongside it?
>
> We are content either way. If the answer is that it cannot be redistributed we will
> remove it and use a CC0 alternative; we would much rather ask than assume. And if the
> answer is straightforwardly yes, we will say so in the interface, because a
> time-resolved heart is the only asset we have with a time dimension at all.
>
> With thanks,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland
> Open Twin XR — https://opentwin.opening.science (login-gated while this is open)

**If the answer names a restricted cohort:** drop to the Sunnybrook CC0 fitted models
([`INTEGRATION_CANDIDATES.md`](INTEGRATION_CANDIDATES.md) C3), which carry no such
question. **If there is no reply:** treat as unresolved — the heart stays out.
`publishable: false` in `src/scene/organOverlays.ts` is what enforces that today.

</details>

---

## 2. Z-Anatomy — ✅ SENT 18 AUGUST 2026, awaiting reply

> **The canonical text is the issue itself:**
> [`Z-Anatomy/Models-of-human-anatomy#7`](https://github.com/Z-Anatomy/Models-of-human-anatomy/issues/7),
> filed 18 August 2026 — a lightly tightened edit of the draft below, same claims,
> same three points, same give-back offer. What lands next depends on the reply:
> a `License.txt` correction upstream closes the white-matter miscredit at its
> source; a BodyParts3D answer decides which licence line we print; an ossicle
> correction, if any, changes one register note. None of it gates anything here.
>
> **Found after sending:** the same wrong credit is live in a third place — the
> licence panel of z-anatomy.com's own web app (Unity WebGL) shows *"'Brainder' and
> 'White matter' from the University of Washington"* and the stale
> *BodyParts3D CC-BY-SA 2.1 Japan* line. Worth a one-line follow-up comment on #7 so
> the fix reaches the app too, not only `License.txt`.

> ### Venue, in brief
>
> Post as an issue on **<https://github.com/Z-Anatomy/Models-of-human-anatomy>** — the
> models repo, where the rights holder answers (Gauthier Kervyn did the geometry;
> Lluís Vinent only the Unity app). Not the Unity repos, not the community fork.
> ⚠️ "No email exists" was wrong: the About panel of z-anatomy.com publishes
> `kervyngauthier@gmail.com` and `lluisvinentdev@gmail.com`, and a 2026 job posting
> uses `gauthier.kervyn@z-anatomy.com`. The public issue remains the right venue for
> a public correction; the addresses are the nudge channel if #7 goes quiet.
> Three things their existing threads establish: per-mesh provenance is
> **not recorded upstream** (#5 — "compare against the original model" is the answer,
> so bring comparison results rather than asking for records); introduce yourself and
> the project's non-commercial open-source stance up front, which the licence-file
> request to be informed invites anyway; and state plainly what we ship under which
> terms, with the licence text as the shared reference — that is more useful to both
> sides than asking for interpretations.

**Subject:** Your white-matter credit names the wrong source; which BodyParts3D licence should derivatives print; and the comparison #5 asked for

> Dear Gauthier, dear Z-Anatomy authors,
>
> Z-Anatomy is the richest individually-named open anatomy there is, and the source
> that made our project possible: an open-source WebXR body viewer by the Open Science
> Foundation — public at <https://opentwin.opening.science>, source at
> <https://github.com/Opening-Science/open-twin-xr>. Your licence file asks that
> derivative works inform you — this is that note. We ship glTF conversions of your
> seven system files plus the surface regions, under CC BY-SA 4.0 as separate assets,
> changes stated, both required credits and all four component credits rendered in
> the interface and embedded in the files (`licences.json` in the repo is the full
> register).
>
> Three points, all about crediting accurately:
>
> 1. **Your "Brainder / White matter — University of Washington" credit is wrong, on
>    its author's word.** Anderson M. Winkler (Brainder) told us in writing that he
>    has never been affiliated with UW — and that Brainder ships grey/white *boundary*
>    surfaces, not white matter proper. Your `White_matter_of_telencephalon` pair
>    measures as exactly that (one closed folded hemisphere, mirrored), so we credit
>    it *Brain for Blender, Anderson M. Winkler, CC BY-SA 3.0*. The spinal cord
>    cannot be his (cortex-only), so we treat it as your own work. Please correct
>    `License.txt` so the unlicensed-looking listing stops propagating downstream —
>    and correct us if either identification is wrong.
> 2. **Which BodyParts3D licence should derivatives print?** Your licence document
>    says CC BY 4.0; `License.txt` in the repos still says CC BY-SA 2.1 Japan, which
>    is what we copied. DBCLS's own page has said CC BY 4.0 since 2025-02-27 — can
>    you confirm the document is current so we print what you intend?
> 3. **We ran the comparison your answer on #5 recommends — against BodyParts3D — and
>    the findings are yours to reuse.** Method: both atlases in one frame,
>    per-structure chamfer distance across 71 name-matched structures, centroid-aligned;
>    rigid retopologies (frontal bone, sphenoid) land at ~2 mm median.
>    **(a) Ossicles and inner ear:** BodyParts3D contains no incus, stapes, malleus,
>    cochlea, vestibule — or renal pelvis. TARO is a 2 mm MRI phantom and cannot
>    resolve ossicles, so none of these can be BodyParts3D retopologies. We credit the
>    ossicles as your own modelling (middle-ear bones, and Dundee's component is the
>    *inner* ear) — correct us if they are Dundee's. Same for the CAHID nerves: credited
>    as a component, untagged per mesh, since theirs and yours are not separable by name.
>    **(b) White matter**, supporting point 1: your telencephalon pair are *exact
>    mirrors* of one another (2.4 mm median), where BodyParts3D's `cerebral white
>    matter` pair is asymmetric like any real segmentation, and the two models diverge
>    entirely — a single downloaded hemisphere, mirrored, is the natural reading.
>    **(c) The #5 kidney question:** your kidney diverges from BodyParts3D's at ~15 mm
>    median — several times the clean-retopology baseline — and the renal pelvis has no
>    BodyParts3D ancestor at all. Both consistent with your own credit of the Cowley
>    model. The one step we could not take is comparing against the Cowley model
>    itself: its Sketchfab download needs an account, so that last confirmation is
>    yours, or anyone's with a login.
>
> In return: our importer's per-structure component tags and a name → FMA crosswalk
> built against BodyParts3D — exactly the comparison material #5 asks for, yours under
> the same licence. Say the word and we will open a pull request.
>
> With thanks and admiration for the atlas,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

---

## 3. Brainder — ✅ SENT, AND ANSWERED 17 AUGUST 2026

> ### What Anderson Winkler said, and what we measured in reply
>
> **He denied the attribution outright:** *"neither me or Brainder have been affiliated
> with the Univ. of Washington, so that attribution is not correct anyway."* Upstream's
> credit is therefore wrong whatever the geometry turns out to be — and it is a credit
> we copy verbatim.
>
> **He gave a test rather than an answer.** Brainder ships *cortical* surfaces: a pial
> surface and a "white" surface, the latter being the grey/white **boundary**, not white
> matter proper. So — tracts, bundles, fasciculi → not his; a boundary shell → possibly
> his. He asked for representative screenshots, and offered a Zoom.
>
> **Measured from `NervousSystem100.fbx` rather than guessed** (the shipped build
> excludes these meshes, so the source FBX was pulled from the community fork):
>
> | | `White_matter_of_telencephalon` (l and r) | `White_matter_of_spinal_cord` |
> |---|---|---|
> | topology | closed, one dominant shell | **open**, 255 boundary edges — a tube |
> | folding | sphericity **0.219** — the folded-cortical range | 0.114, but from thinness, not folding |
> | shape | gyri and sulci throughout, smooth medial wall around the corpus callosum | smooth, follows the vertebral canal |
> | reading | **a FreeSurfer-style white surface — his description exactly** | modelled anatomy; cortex-only Brainder cannot be its source |
>
> The two hemispheres are **exact mirrors** — identical vertex and triangle counts,
> bounding boxes mirrored about x — so one source hemisphere was duplicated.
>
> **So the component was two different things, and our regex had lumped them.** Acted on
> 17 August 2026 (D20): the cortical pair is retagged *Brain for Blender, CC BY-SA 3.0*
> and **restored to the publishable build**; the spinal cord is untagged as Z-Anatomy's
> own; the asset was rebuilt and nothing is excluded any more. Publishable either way —
> if the pair is Winkler's the grant is BY-SA 3.0 (whose §4(b) allows our BY-SA 4.0
> asset), and if it was "reference only" the geometry is Z-Anatomy's own BY-SA 4.0. His
> reply to the renders decides the **credit wording** only. Item 2 tells upstream to fix
> their `License.txt`.

**Reply to send, with the two renders attached:**

> Dear Anderson,
>
> Thank you — that is exactly the discriminator I needed, and it settles half of it
> immediately.
>
> I have attached three orthographic views of each mesh, rendered straight from
> Z-Anatomy's source file with no smoothing or decimation.
>
> **`White_matter_of_telencephalon`** is not white matter proper. It is a closed,
> heavily folded surface of one hemisphere — gyri and sulci throughout, and a smooth
> medial wall around the corpus callosum. Its sphericity is 0.219, which is the folded
> cortical range rather than anything modelled by hand. Left and right are exact mirrors
> of one another, so a single source hemisphere was duplicated. To my eye it reads as a
> FreeSurfer-style white surface, which is your description of what Brainder ships — but
> you are the one who can say.
>
> **`White_matter_of_spinal_cord`** is clearly something else: an open smooth tube
> following the vertebral canal, no folding at all. Since Brainder is cortex only, that
> one cannot be yours, and I will pursue it separately with Z-Anatomy.
>
> On the strength of your answer and these measurements we have already restored the
> cortical pair to our published build, credited as *Brain for Blender, Anderson M.
> Winkler, brainder.org, CC BY-SA 3.0* — the licence your page states, rather than the
> nothing Z-Anatomy's file states. If you would like the credit worded differently, or a
> citation added, say so and we will change it; and if the pair turns out not to be
> yours after all, it reverts to Z-Anatomy's own share-alike credit.
>
> Either way I will correct our own record to say that the University of Washington
> attribution is denied by the named source, and raise it with Z-Anatomy so the error
> stops propagating to everyone downstream of them. One thing to know: our rights
> register and these working notes are public (github.com/Opening-Science/open-twin-xr),
> so your answer is recorded there in substance — tell me if you would rather it be
> worded differently, or quoted verbatim, or attributed some other way.
>
> Thank you for answering so quickly, and for the offer of a call — I will take it up if
> the screenshots leave it open.
>
> With thanks,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

<details>
<summary>The original outreach letter, sent 17 August 2026 — kept for the record</summary>

**To:** ⚠️ no contact address is published on
<https://brainder.org/research/brain-for-blender/>. Look for an "about" or contact page
on brainder.org, or reach the author through his current institutional page; do not
send to a guessed address.

**Subject:** Are the "Brainder / white matter" meshes in Z-Anatomy from Brain for Blender?

> Dear Dr Winkler,
>
> I am trying to establish the provenance of one component in a third-party atlas, and
> you are the only person who can settle it.
>
> Z-Anatomy (<https://github.com/LluisV/Z-Anatomy>) is an open 3D anatomy atlas under
> CC BY-SA 4.0. Its `Resources/Models/License.txt` lists, among its included models,
> *"'Brainder' and 'White matter' from the University of Washington"* — with **no
> licence stated**, unlike every other component in that file. We publish an
> open-source WebXR body viewer built partly on Z-Anatomy, and because silence is not a
> grant, we currently exclude those meshes from anything we serve.
>
> Your *Brain for Blender* page offers cortical surfaces including white-matter
> boundary meshes under a Creative Commons Attribution-ShareAlike 3.0 Unported licence,
> and does not mention the University of Washington. So, if you are willing:
>
> 1. Are the Z-Anatomy meshes named "White matter of telencephalon" and "White matter of
>    spinal cord" derived from your *Brain for Blender* release, to your knowledge?
> 2. If they are, is CC BY-SA 3.0 the licence that applies, and what attribution wording
>    would you like us to render?
> 3. If they are not yours, do you know whose they are likely to be? The
>    "University of Washington" attribution may point at a different release entirely.
>
> Either answer is useful to us: a licence we can honour, or a definite exclusion. As it
> stands we are excluding geometry that may well be freely licensed, which serves nobody.
>
> With thanks,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

</details>

---

## 4. University of Washington — ⛔ DO NOT SEND. The premise is gone.

**Superseded 17 August 2026 by item 3's reply.** The author of Brainder states that
neither he nor Brainder has ever been affiliated with the University of Washington, so
the attribution in Z-Anatomy's licence file names an institution with no established
connection to the work. Writing to UW would be asking a stranger for permission to use
something that is very probably not theirs — and, on the measurements, is very probably
Winkler's own CC BY-SA 3.0 cortical surface.

**What would revive this letter:** only Z-Anatomy (item 2) naming an actual UW release
that the geometry came from. If that ever happens, the draft below is kept for reuse —
and the same caution still applies, that an institution is not a rights holder and the
originating lab has to be named before anyone can answer.

<details>
<summary>Draft, kept in case item 2 names a genuine UW release</summary>

**Do not send this blind.** "The University of Washington" is an institution, not a
rights holder, and we do not know which lab or release is meant — writing to a
guessed department invites a non-answer that would then look like a refusal. Establish
the originating release first (items 2 and 3). If the answer really is a UW release
with no licence, the findable routes are the originating lab or department directly
once named, or UW's technology-transfer office (CoMotion) for a permission request
whose author cannot be identified — take the current address from their own site.

**Subject:** Permission request — white-matter 3D meshes redistributed in an open anatomy atlas

> Dear [name / office],
>
> I am seeking written permission, or a licence statement, for a set of 3D white-matter
> meshes attributed to the University of Washington.
>
> The meshes reach us indirectly. Z-Anatomy, an open 3D anatomy atlas under CC BY-SA
> 4.0, lists among its included models *"'Brainder' and 'White matter' from the
> University of Washington"*, and unlike every other component in its licence file this
> one carries **no licence at all**. We publish an open-source, non-commercial WebXR
> human body viewer for the Open Science Foundation. Our position is that attribution
> satisfies a licence's conditions but cannot manufacture a grant that was never made,
> so we exclude these meshes from every build we serve, including gated ones — a login
> wall limits who sees a work, it does not change what may lawfully be sent to them.
>
> We would like to include them, credited as you require. Specifically:
>
> 1. Does the University hold rights in these meshes, and if so which release are they?
> 2. May they be redistributed in derived form — a decimated glTF surface inside a
>    larger open-source viewer, non-commercial, fully attributed? An existing open
>    licence such as CC BY or CC BY-SA would answer this completely.
> 3. What attribution wording would you like rendered?
>
> If the answer is no, or if the meshes are not yours, we will simply continue to
> exclude them and will replace them with white matter segmented from CT under a
> permissive licence.
>
> With thanks,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

</details>

---

## 5. DBCLS — confirm the BodyParts3D relicence in writing

**To:** ✅ `bodyparts@dbcls.rois.ac.jp` — the inquiry address in DBCLS's own BodyParts3D
README (<https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/README_e.html>).
**Subject:** BodyParts3D licence — confirming CC BY 4.0, and some pages that still say CC BY-SA 2.1 Japan

> Dear BodyParts3D team,
>
> BodyParts3D is the default atlas in an open-source WebXR human body viewer we publish
> at the Open Science Foundation, and we credit it exactly as your licence page asks:
>
> > BodyParts3D, © The Database Center for Life Science licensed under CC Attribution
> > 4.0 International.
>
> We would be grateful for a one-line written confirmation of that licence, because the
> published record is not consistent and we are relying on the more permissive reading:
>
> - <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>, last updated
>   2025-02-27, states Creative Commons Attribution 4.0 International.
> - The README at
>   <https://dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/README_e.html> still
>   states Creative Commons Attribution-Share Alike 2.1 Japan, as do lifesciencedb.jp,
>   the widely used GitHub mirrors, and derivative atlases that took their credit line
>   from those pages.
>
> So: **is CC BY 4.0 the current licence for the whole BodyParts3D database, including
> the mesh data in the LATEST distribution, superseding CC BY-SA 2.1 Japan?** A reply
> saying so is all we need; we will quote it in our own licence record so that anyone
> downstream of us does not have to ask again.
>
> Two smaller things, if you have the patience for them. The `.obj` files in the LATEST
> distribution still carry a 2013 CC BY-SA notice in their headers, which is the version
> most tools will read. And derivative works that predate the relicence still carry the
> share-alike wording — we would rather point them at your confirmation than argue the
> point atlas by atlas.
>
> Thank you for BodyParts3D, and for keeping it downloadable in bulk. It is the
> substrate under most of the open anatomy in existence.
>
> With respect,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

---

## 6. HuBMAP HRA — which citation exactly

**To:** ✅ `infoccf@indiana.edu` — the feedback address on the CCF 3D Reference Object
Library page.
**Subject:** Required citation for the CCF 3D Reference Object Library in a rendered application

> Dear MC-IU team,
>
> We use the HRA reference organs — both the female and the male donor sets — in an
> open-source WebXR human body viewer published by the Open Science Foundation, and we
> render this credit in the interface and embed it in every asset we distribute:
>
> > 3D anatomical structures from the HuBMAP Human Reference Atlas (HRA), CC BY 4.0.
>
> CC BY asks for attribution in the manner the licensor specifies, and your library page
> specifies a **version-specific** citation naming the release authors and year. Two
> questions so that we get it exactly right:
>
> 1. For an interactive application — where the credit is a line of on-screen text rather
>    than a bibliography entry — is the full version-specific citation what you want
>    rendered, or is a short credit plus a link to the library acceptable?
> 2. Our record does not state which version of the library the meshes were downloaded
>    from, which is our own failing. Is there a way to identify the release from the
>    distributed GLBs themselves, so that we cite the right one rather than assume?
>
> We also indicate changes, as CC BY requires: the meshes are decimated, ambient
> occlusion is baked in, and the structures are recoloured by an application palette.
> If you would like that stated in particular words, tell us and we will use them.
>
> With thanks for making the atlas openly available,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

---

## 7. University of Dundee — ✅ SENT, AND ANSWERED 18 AUGUST 2026

> ### The answer changed what we print (D23), and left one question
>
> **Caroline Erolin** (Reader in Medical Art, `c.d.erolin@dundee.ac.uk`) replied that
> both models are themselves derivatives, and gave the wording:
>
> - **Anatomy of the Inner Ear** — a derivative of *"3D Ear"* by W. Robert J. Funnell,
>   Sam Daniel and Daren Nicholson at **McGill University**, under **CC BY-NC-SA 1.0**.
>   (Also: it belongs to the medical school's account, not CAHID's.)
> - **Cranial Nerves and Foramina** — produced by **Sophia Lappe**, based upon
>   **BodyParts3D**, © DBCLS, CC BY-SA 2.1 Japan.
>
> Both chains now ship — register, embedded copyright, and in-app under each parent
> credit via `RightsComponent.derivedFrom`. Verification added three things her mail
> did not: the McGill host is dead (the 1.0 licence is confirmed from the Internet
> Archive), behind McGill sits **uncredited** cadaver MRI from the Hensons at UNC
> Chapel Hill scanned at Duke, and CC SA 1.0 does not actually permit the 1.0 → 4.0
> step Dundee took. None of that changes our position: the NC term flows down under
> every reading and this project is non-commercial.
>
> **⚠️ Worth one more short mail.** The Cranial Nerves and Foramina Sketchfab page
> states **no licence at all** — an empty licence object, as on every model on that
> account — and is not downloadable. The CC BY 4.0 we print comes from Z-Anatomy's
> file, not from Dundee's page, and a sibling Dundee cranial-nerves model by Claire
> Cooper is listed CC BY-SA 4.0 elsewhere. She was asked about wording, not licence,
> and neither confirmed nor disputed it. Ask plainly: *is the model CC BY 4.0, and
> how did Z-Anatomy obtain a model that cannot be downloaded?* The second half is
> really a question for Z-Anatomy (issue #7), and their answer may matter more.

**Reply to send — to `c.d.erolin@dundee.ac.uk`, cc Eve (medical school) as she copied in:**

**Subject:** Re: Credit wording — both chains are live, and two questions back

> Dear Caroline,
>
> Thank you — that was exactly the detail we were missing, and both chains are now
> live at <https://opentwin.opening.science>. The credits read:
>
> > Anatomy of the Inner Ear — University of Dundee School of Medicine — CC BY-NC-SA 4.0
> > ↳ a derivative of "3D Ear" by W. Robert J. Funnell, Sam Daniel and Daren Nicholson
> >   at McGill University, used under CC BY-NC-SA 1.0
> >
> > Cranial Nerves and Foramina — University of Dundee, CAHID — produced by Sophia
> > Lappe — CC BY 4.0
> > ↳ based upon the BodyParts3D data set, © The Database Center for Life Science,
> >   licensed under CC Attribution-Share Alike 2.1 Japan
>
> They appear in the interface (open "All models and sources"), in the machine-readable
> register in the repository, and inside the asset files themselves, so the credit
> travels if a file is ever handed on without the app around it.
>
> On where they are used: they reach us through **Z-Anatomy**, not from your Sketchfab
> pages directly. Z-Anatomy publishes a Blender/FBX distribution whose licence file
> lists both of your models among its included components; we convert those files to
> glTF for the browser. That is why you could not find them on their website — the web
> app there shows only the skeleton, while the downloadable model set is the full body.
>
> Two questions back, if you have the patience for them.
>
> 1. **Is Cranial Nerves and Foramina really CC BY 4.0?** We print that on Z-Anatomy's
>    authority, but your Sketchfab page for it states no licence at all, and the model
>    is not downloadable there. (Your inner-ear page, by contrast, states CC BY-NC-SA
>    4.0 explicitly and is downloadable.) If the licence is something else — a
>    colleague's similar cranial-nerves model is listed CC BY-SA 4.0 elsewhere — we
>    would rather print what you intend. And if you know how Z-Anatomy obtained it, we
>    would be glad to know; we have an open question with them about their licence
>    file and can pass anything on.
>
> **On the NoAI marking, since you will have seen how this project is built.** Your
> cranial nerves model carries Sketchfab's NoAI tag (the inner ear does not). I want
> to be precise rather than reassuring about it.
>
> Sketchfab's marking forbids use "in datasets for, in the development of, or as
> inputs to generative AI programs". It does not restrict viewing, rendering or
> redistribution — and rendering is the whole of what we do. The geometry is converted
> by ordinary deterministic tooling — FBX to glTF, welded, decimated, compressed, with
> ambient occlusion baked per vertex — and then drawn by a WebGL renderer. It is never
> a training input, never part of a dataset, and never fed to a model.
>
> The distinction matters here because the software genuinely is written by an AI
> agent, as I mentioned. The line is this: **the agent writes the code; the anatomy is
> data that code renders.** The agent reads licence files, writes conversion scripts
> and edits the interface. No mesh passes into a model, and none will. If we ever
> wanted to do anything that did — shape learning across atlases, say — that would be
> a separate question and we would ask first, with your model excluded by default.
>
> Rather than leave that as an assurance in an email, we have written it into the
> project: the component now carries a `noAI` flag in our machine-readable rights
> register, and the interface renders "marked NoAI by its creator — rendered here,
> never used as training data or as input to a generative model" beneath your credit.
> Your request now travels with the work instead of stopping at the platform it was
> posted on. If you would rather we not display the models at all, tell us and we will
> withdraw them — but we hope the answer is that this is exactly the kind of use they
> were shared for.
> 2. **The chain behind McGill.** In verifying the "3D Ear" credit I found that the
>    McGill site (`audilab.bmed.mcgill.ca`) no longer resolves — the licence statement
>    is confirmed only from the Internet Archive — and that its own about page says the
>    models derive from MRI of a human cadaver provided by Drs O. W. Henson Jr and
>    Miriam Henson at UNC Chapel Hill, scanned at Duke. Nobody downstream credits them.
>    If you agree that is the same chain, we will add them; you are better placed than
>    we are to say whether it is right. Also, a small one: McGill spell it
>    **Nicholson** where your notice has "Nicolson" — we have followed McGill, but say
>    if you would rather we match yours.
>
> One thing you may want to know, offered as information and not as a complaint: CC
> ShareAlike **1.0** requires adaptations under exactly 1.0 — the "or later version"
> option only arrives with 2.0 — so the 1.0 → 4.0 step in the inner ear's notice is
> not something that licence offers, and Sketchfab has no 1.0 option to choose. It
> makes no difference to us, since the non-commercial term flows down under any
> reading and this project is non-commercial and open source, but it might matter for
> a future release of yours.
>
> Happy to send screenshots of how the credits render, or to change any wording you
> would prefer.
>
> With thanks,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

<details>
<summary>The letter as sent, 17 August 2026</summary>

**To:** ⚠️ no direct address confirmed. Findable routes: a message to
<https://sketchfab.com/anatomy_dundee>, where both models are published, or the
Centre's contact page at <https://www.dundee.ac.uk/cahid>.
**Subject:** Credit wording for two CAHID models redistributed inside an open anatomy viewer

> Dear CAHID colleagues,
>
> Two models of yours reach an application we publish, by way of Z-Anatomy, and I would
> like to check that we credit them as you want.
>
> Z-Anatomy's licence file lists *"Anatomy of the Inner Ear — University of Dundee
> School of Medicine — CC-BY-NC-SA 4.0"* and *"Cranial Nerves and Foramina — University
> of Dundee, CAHID — CC-BY 4.0"* among its included components. We ship a converted
> Z-Anatomy build in an open-source, non-commercial WebXR body viewer for the Open
> Science Foundation, and both components are credited in the interface and embedded in
> the asset itself. The work is not sold and will not be, so the non-commercial term on
> the inner ear costs us nothing.
>
> 1. Is the credit wording above the wording you want, or would you prefer something
>    else — a citation, the modeller's name, a link?
> 2. For the inner ear, we can identify your structures reliably by name and we tag them
>    individually. For the cranial nerves we cannot: your nerve geometry and Z-Anatomy's
>    own are not distinguishable by name, so we credit the component without claiming
>    which meshes are yours. If you can tell us which structures the model contributed,
>    we will attribute them precisely.
> 3. Are you content with the redistribution as described — decimated surfaces, no
>    imaging data, attribution rendered on screen, non-commercial?
>
> The models are good, and being able to name a source is worth more to us than any
> single mesh.
>
> With thanks,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

</details>

---

## 8. Courtesy notices — nothing outstanding, but worth sending

None of these is required: each licence's condition is attribution, and attribution is
rendered in-app and embedded in the assets. Send them anyway. They cost one paragraph,
they occasionally correct a credit line, and every one of these sources gave the project
something it could not have built.

**Recipients and channels**

| source | to | note |
|---|---|---|
| **OpenEar** (Sieber et al., MED-EL / University of Bern) | ⚠️ via the Zenodo record <https://zenodo.org/record/1473724> — corresponding-author address is in the accompanying paper | The only photographic tissue colour in the project |
| **TCIA** Healthy-Total-Body-CTs | ✅ `help@cancerimagingarchive.net` (TCIA Support) | Ask whether the collection's own citation, not just the DOI, should be rendered |
| **NAVER LABS Europe** (ANNY) | ⚠️ an issue on <https://github.com/naver/anny> | Apache-2.0 code over CC0 shape assets; we cite arXiv:2511.03589 |
| **lissiecowley** (the kidney) | ⚠️ Sketchfab message | CC BY-NC 4.0; a named individual, and the only one in the register |

**Subject:** Your [model / collection] is credited in an open human body viewer — is the wording right?

> Dear [name],
>
> A short note as a courtesy rather than a request. We publish **Open Twin XR**, an
> open-source, non-commercial WebXR human body viewer for the Open Science Foundation.
> Your work is one of its sources, and we render this credit in the interface and embed
> it in the distributed asset:
>
> > [exact credit line from docs/LICENCE_LOG.md]
>
> We also state the properties that travel with it, because we think a viewer should
> know what it is looking at: [e.g. one cadaveric right temporal bone rather than a
> population; grouped labels; low-dose non-contrast CT; a generated shape rather than a
> scan of anyone].
>
> If you would like that worded differently, or a citation added, tell us and we will
> change it. If you would like to see how your work is presented, we are glad to give
> you access.
>
> With thanks,
>
> Martin Etzrodt
> Open Science Foundation · Matten bei Interlaken, Switzerland

---

## Who does *not* need an email

Recorded so nobody re-opens them.

| source | why no letter |
|---|---|
| **UK Biobank**, **NAKO** | Closed by material transfer agreement, and nothing of theirs is in the build. The only live thread is §1, which asks whether UK Biobank data reached one asset *indirectly*. |
| **Zygote** | Proprietary, priced, and its terms forbid redistributing derivatives. A purchase, not a permission. |
| **Inter** (Rasmus Andersson) | SIL OFL 1.1, self-hosted complete font, `OFL.txt` shipped beside it. No condition unmet, no third-party request at runtime. |
| **npm dependencies** | MIT / Apache-2.0 / BSD throughout. Re-run the checker after a bump; nobody to write to. |
| **Schwiegerling / the Arizona eye model** | The schematic eye is generated from published measurements, which are not copyrightable expression. The credit is scholarship, not a licence condition. |
| **`ct-atlas-f`** | ✅ **Resolved internally, 18 Aug 2026 (D22) — still nobody to write to, which was the point.** The unrecorded source scan was re-identified from three fingerprints (scan geometry to the millimetre, class census, the pipeline doc's own trail) as ENHANCE.PET subject 1032, University Hospital Leipzig — whose contribution is CC BY 4.0 per the dataset's paper. Chain now CC BY 4.0 end to end; the asset ships. |

## What outreach cannot fix — the internal list, before launch

1. ✅ **DONE 17 August 2026, and the gate's meaning changed (D20).** The asset was
   rebuilt with `--publishable` from the upstream FBX set (fetched from
   `Z-Anatomy-Community/Z-Anatomy` → `Resources/Models/FBX/`, every file byte-verified
   against the repository tree) — and the roll-call now shows **nothing excluded**: the
   white matter that was the flag's whole caseload is licensed (item 3 / D20). The flag
   stays in the deploy procedure for the next unlicensed component, but today the
   publishable and research builds are the same build. ⚠️ Upstream's
   `Resources/Models/Readme.txt` warns the repo FBX "may not be up to date"; the daily
   Blender export in `Z-Anatomy/Models-of-human-anatomy` is newer. Taking it is a
   re-import with its own verification, not a drop-in — do it deliberately.
2. ✅ **RESOLVED FOR ONE, MECHANICAL FOR THE OTHER (D21, 18 August 2026).**
   `biv-heart` ships publicly: its donor is a CARDIOHANCE participant with local
   ethics approval to share online and no restrictions (item 1), so
   `publishable: true` and the credit cites the 2026 Medical Image Analysis paper.
   **`ct-atlas-f` is now held out by machinery instead of memory** — the gap this
   item flagged is closed: `pruneUnshippedModels` (vite.config.ts) reads
   `licences.json` and withholds from `dist` any asset whose `ownLicence` is
   unresolved or that carries a `gate`, and `scripts/check-dist-assets.mjs` fails
   the build if a withheld asset leaks through. Resolving the CT atlas's
   provenance in the register is what ships it — nothing else to remember.
3. ✅ **The Dundee CAHID credit — FIXED 17 August 2026.** It was missing from two of the
   three places it must appear: `src/scene/anatomySources.ts` listed "Cranial Nerves and
   Foramina" and the interface rendered it, but the `attribution` in
   [`../licences.json`](../licences.json) and the `COPYRIGHT` constant in
   `scripts/build-z-anatomy.mjs` named only three components — so the generated credit in
   `LICENCE_LOG.md` and the `asset.copyright` inside the shipped GLB, the two credits that
   travel *with* the file, were the two that omitted it. Attribution is a *condition* of
   CC BY 4.0. Verified against Z-Anatomy's own `Resources/Models/License.txt`, which
   lists four included components; both credits now name all four, and the built GLBs
   were corrected with `scripts/set-copyright.mjs` rather than waiting on an FBX rebuild.
   **Two consequences to know.** The component tables in `LICENCE_LOG.md` and
   `HANDOVER.md` are built from per-structure tags, and CAHID is deliberately untagged
   (`PLAN_NEXT.md` item 3), so it appears in the credit and in the register's prose but in
   no table — a missing row there means "not tagged", never "not in this asset". And the
   same pass found the regions asset carrying the whole aggregate credit, claiming a
   non-commercial inner ear and an unlicensed white matter that are not in it; the build
   script now writes a narrower `COPYRIGHT_REGIONS`. Over-attribution marks geometry as
   more restricted than it is, which is the inner-ear tag's error in the other direction.
4. **Re-run `npm run check:licences` and read the action list**, not this file, as the
   last step before publishing. This document is prose about the register; the register
   and the assets win on any disagreement.
