# Could this be published on an app store, and under what licence?

**4 August 2026.** Written against the shipped asset set recorded in
[`../LICENCE_LOG.md`](../LICENCE_LOG.md) and [`../../licences.json`](../../licences.json).

⚠️ **This is engineering analysis of stated licence terms and published store policies,
not legal advice.** Three of the findings below turn on questions only a lawyer or the
rights holders can close, and they are marked as such. Nothing here should be treated as
clearance to publish.

---

## The answer in one paragraph

**In its current form this cannot go on the Apple App Store at all, and cannot go on any
commercial store without removing eight structures and resolving one provenance
question.** The blocker is not a store rule — it is the licences of the anatomy. Every
Creative Commons asset here forbids applying DRM to it, which is what the App Store does
to every app it distributes; and eight structures inside the Z-Anatomy build are
non-commercial. The **Meta Horizon Store is the realistic route**, and it is a genuine
one: it accepts WebXR experiences packaged as PWAs, which is what this already almost is.
Nothing about the code needs relicensing — MIT is correct and should stay.

---

## 1. The DRM clause, which is the largest and least obvious blocker

Every CC 4.0 licence — **not only ShareAlike** — carries this, at
**CC BY 4.0 §2(a)(5)(ii)**:

> You may not offer or impose any additional or different terms or conditions on, or
> apply any Effective Technological Measures to, the Licensed Material if doing so
> restricts exercise of the Licensed Rights by any recipient of the Licensed Material.

"Effective Technological Measures" is defined at §1(4) as measures that "may not be
circumvented under laws fulfilling obligations under Article 11 of the WIPO Copyright
Treaty". App Store DRM is squarely that. Creative Commons' own guidance is explicit: if
you remix a CC-licensed work and want to put it on a platform that applies digital
copy-restriction to everything uploaded, **you may not do so without express permission
from the licensor.**

This matters far more than the ShareAlike question people expect to be the problem,
because it applies to the plain **CC BY 4.0** assets too — which is nearly all of them:

| asset | licence | hits the ETM clause |
|---|---|---|
| `bodyparts3d` | CC BY 4.0 | yes |
| `hra`, `hra-m` | CC BY 4.0 | yes |
| `htb-ct-f` | CC BY 4.0 | yes |
| `openear-zeta` | CC BY 4.0 | yes |
| `z-anatomy`, `z-anatomy-regions` | CC BY-SA 4.0 | yes, and share-alike as well |
| `biv-heart` | Apache-2.0 | no — Apache has no ETM clause |
| `schematic-eye` | generated here | no — but see §6 |

**What this rules out.** Any store that encrypts or wraps the app binary. Apple's App
Store is the clear case. **What it does not rule out:** a store that distributes a signed
but unencrypted package. Google Play signs and may wrap, and Meta Horizon distributes an
Android App Bundle — whether either constitutes an ETM applied *to the licensed material*
is exactly the kind of question a lawyer must answer, and it is the single most important
one to ask before committing to a store route.

⚠️ **The clean fix is not technical.** It is written permission from each rights holder to
distribute their asset through a DRM-applying channel. HRA, BodyParts3D and the CT set
are institutional and reachable; Z-Anatomy is a single maintainer. That is a slow path but
not a closed one.

## 2. Non-commercial components — a hard stop on any commercial store

The shipped `z-anatomy` build is an aggregate, and eight of its 3,614 structures are
non-commercial:

| structures | licence | component | holder |
|---|---|---|---|
| 4 | CC BY-NC-SA 4.0 | Anatomy of the Inner Ear | University of Dundee School of Medicine |
| 4 | CC BY-NC 4.0 | Kidney | lissiecowley |

⚠️ **`--publishable` does not remove these, and was never meant to.** That gate drops the
three University of Washington white-matter structures, which carry *no licence statement
at all*. The non-commercial ones are deliberately kept, because the project's declared
stance is non-commercial open publication, where NC costs nothing.

An app store is a commercial marketplace. A free listing on it is still commercial
distribution in the sense NC is aimed at, and Meta, Apple and Google all take a
commercial position in the transaction. **So a store build needs a third tier:** drop the
unlicensed component *and* the NC components. That is a build-flag change and a
regeneration, not a redesign — the machinery already exists, and the component tags that
would drive it already live in the asset's own structure table.

The cost is knowable and small: 8 structures out of 3,614, being one inner ear and one
kidney, both of which have alternatives.

## 3. Two provenance questions that block publication anywhere

Both are already recorded in the licence log; neither is new here.

- **`biv-heart` — marked BLOCKS PUBLICATION.** Apache-2.0 sits at the upstream repo root,
  but the FIMH 2025 paper (doi:10.1007/978-3-031-94562-5_34) thanks "the study
  participants of the UK Biobank and CARDIOHANCE". If the bundled `patient1` derives from
  UK Biobank, redistribution of derived geometry is almost certainly barred by their
  access terms, and a repo-root Apache licence cannot override the authors' own
  obligations. **This is a question for the authors, and the draft email already exists.**
  The Sunnybrook CC0 fitted models are the identified replacement.
- **`ct-atlas-f` — recorded as unresolved.** Also: if that pipeline is ever re-run with
  TotalSegmentator's gated subtasks, the output becomes non-commercial and would join §2.

## 4. Which store, and what each one adds

### Meta Horizon Store — the realistic route

WebXR experiences are packaged as PWAs via **Bubblewrap** into an Android App Bundle,
launched through a Trusted Web Activity. This is a first-class, documented path, and since
Connect 2024 such apps can even use in-app payments.

What this app is missing to take it:

1. **No `manifest.json`.** Required, with at minimum `name`, `short_name`, `start_url`,
   and `display` set to `standalone` or `fullscreen`.
2. **No service worker.** Needed for the PWA definition and for any offline behaviour.
3. **No app icons** at store sizes.
4. **A startup-time budget the assets currently blow.** The store applies
   `Quest.Performance.3`, and the trap is specific: because WebXR PWAs launch *directly
   into immersive mode*, **assets pre-loaded before the session count against the startup
   requirement.** Meta's own guidance is to load as much as possible *after* the session
   starts.

   This app does the opposite. It fetches a 10–15 MB GLB before anything but the
   procedural placeholder appears, and the landing state's own store field records that
   `composed` downloads **both** atlases in full — 5,808,472 triangles, of which 2.56 M
   are never drawn. That waste is already a known roadmap item; a store submission
   promotes it from inefficiency to a **conformance failure**.

### Apple App Store — blocked, and for more than one reason

- **§1** the ETM clause above.
- **§4.2 minimum functionality:** "Your app should include features, content, and UI that
  elevate it beyond a repackaged website." A TWA-style wrap of a web app is precisely the
  shape this guideline exists to catch. Defensible for a real WebXR viewer, but it is a
  review risk rather than a formality.
- **§2.3.8 metadata must be 4+ appropriate** "even if your app is rated higher". The store
  listing's screenshots are the problem, not the app: the BodyParts3D and HRA hulls are
  anatomically complete nude bodies including genitalia. The current
  [`docs/preview.png`](../preview.png) **could not be used as a store screenshot.** Store
  imagery needs framing that avoids it — and §1.1.4 concerns "overtly sexual or
  pornographic" material, which anatomical rendering is not, so the body itself in-app is
  a rating question rather than a prohibition.

### Google Play

Same PWA/TWA packaging. Adds a **Data safety** declaration, and its Health apps policy —
see §5. Whether Play's signing constitutes an ETM is the open question from §1.

## 5. The health-claim problem, which is bigger than it looks

Apple **§1.4.1**:

> Medical apps that could provide inaccurate data or information, or that could be used
> for diagnosing or treating patients may be reviewed with greater scrutiny. Apps must
> clearly disclose data and methodology to support accuracy claims relating to health
> measurements, and **if the level of accuracy or methodology cannot be validated, we will
> reject your app.** […] Apps should remind users to check with a doctor.

This repository has been careful about exactly this — `assertTwinMetrics()` refuses a
fabricated score, and the scoring UI was deliberately unmounted. But three things still
present as health claims to a reviewer who has read none of that:

1. ✅ **FIXED since this report was written.** The page title was
   `Open Twin OpenXR - Human Health Digital Twin` — the first string a reviewer reads,
   and the last survivor of the old scope, saying "health" in the app's own name while
   every document said body viewer. It is now
   `Open Twin XR — open-source human body viewer`, and the product is named **Open Twin
   XR** throughout.
2. ✅ **RENAMED.** The colour mode is `metrics`, not `health`, and the contract type is
   `TwinMetrics`, not `HealthTwinData`. The toggle reads "Metrics".
3. ⚠️ **STILL OPEN, and renaming does not close it.** The mode still colours anatomy on a
   red-amber-green scale from a supplied per-system value, and the bundled sample is
   still fictional. A reviewer applying §1.4.1 asks what the scale *means*; "metrics" is
   an honest label rather than a defence. There is no validated methodology to disclose
   because there deliberately is not one yet — D8 puts scoring upstream.

   ⚠️ Note also that **"medical" would have been the wrong replacement word.** It implies
   clinical use, which is what §1.4.1 and the medical-device regimes are aimed at, so it
   would have *raised* the claim rather than lowered it. "Metrics" says only that a number
   was supplied and mapped to a colour, which is all this actually does.

**Strictly, for a store:** either ship with the health mode removed and the title fixed —
which matches the documented scope and costs nothing — or supply the validated methodology
§1.4.1 demands, which does not exist yet.

⚠️ **Separately, and outside store policy:** anything that scores a person's health can
engage **EU MDR** or **FDA** software-as-a-medical-device rules. An anatomy viewer with no
patient data is very unlikely to be in scope. A viewer that colours a body by a health
score derived from someone's own measurements is the case where that line is actually
argued, and it is a question for a regulatory adviser, not for this document.

## 6. The licence question: MIT, Apache-2.0, CC BY 4.0, or CC0?

The short answer: **keep MIT for the code, do not put a CC licence on code, and the
distribution as a whole cannot carry a single licence.** The separation this repository
already maintains is the correct structure and flattening it would lose information.

### For the code — MIT (current) or Apache-2.0. Not CC.

Both are fine and both are OSI-approved. The difference worth knowing:

| | MIT | Apache-2.0 |
|---|---|---|
| length | a paragraph | several pages |
| express patent grant | **no** | **yes** (§3) |
| patent retaliation | no | yes — the grant terminates for a party that sues |
| attribution mechanics | keep the notice | keep the notice, plus `NOTICE` file handling |
| contributor terms | implicit | explicit (§5) |

**Recommendation: no change is required.** Switch to Apache-2.0 only if OSF wants the
express patent grant and retaliation clause — which is a reasonable institutional
preference for a foundation publishing software others will build on. Note that
relicensing needs the agreement of every copyright holder in the file history, so it is
easiest to do now, while that is one person, than later.

⚠️ **Do not use CC BY 4.0 or CC0 for the code.** Creative Commons recommends against CC
licences for software: they grant no patent rights and do not address source-versus-object
distribution, which is what software licences exist to handle.

### For the assets — not ours to choose

Each atlas keeps its own terms and they travel with the file. Two consequences:

- **Z-Anatomy is CC BY-SA 4.0, and our GLB is an Adaptation, not a mere copy.** The build
  converts, welds, simplifies and bakes ambient occlusion. So the shipped
  `z-anatomy.ao.glb` must itself be offered under CC BY-SA 4.0. The repo already states
  this; it is an obligation met, not one outstanding.
- **Share-alike does not reach the MIT code.** The code is a separate work that loads the
  asset at runtime; the geometry is never pasted into source — which is exactly why
  `CLAUDE.md` forbids doing so, and that rule is what preserves this. This is the standard
  reading of "Collection" versus "Adaptation" rather than a settled court question, and it
  is worth a lawyer's eye before a commercial release specifically.

### One real gap: our own generated asset has no licence

`licences.json` records `schematic-eye` as **"None required — generated by this project"**.
That is the wrong conclusion from a correct premise. Nobody else's permission is needed —
but a downstream user still has *no grant* unless one is stated, which is the same
"silence grants nothing" reasoning the project applies to the University of Washington
white matter. It should carry an explicit licence:

- **CC0-1.0** if the intent is maximum reuse with no obligation — appropriate for a
  schematic that embodies no creative claim worth protecting; or
- **CC BY 4.0** to keep attribution, and to be consistent with the anatomy around it.

Either is defensible. **CC0 is the better fit** for a generated schematic, and it is the
only licence in this discussion that makes the asset unambiguously reusable by anyone,
including commercially.

---

## What would strictly have to change

Ordered by whether it is a blocker or a requirement.

**Blockers — publication is not lawful or not possible until these are done**

1. Resolve `biv-heart` provenance, or replace it with the Sunnybrook CC0 models.
2. Add a store build tier that drops the 8 non-commercial structures as well as the 3
   unlicensed ones.
3. Obtain written permission from each CC rights holder to distribute through a
   DRM-applying store — **or** choose a store route that applies no ETM to the assets, and
   get that assessed. This decides whether Apple is possible at all.
4. Resolve `ct-atlas-f`.

**Store requirements — needed for a submission to pass**

5. ~~Fix the page title~~ — **done**, and the health terminology is renamed throughout
   (see §5). What remains for a store: either remove the metrics mode entirely, or
   produce the validated methodology §1.4.1 demands. Renaming reduced the claim; it did
   not remove the feature.
6. Add `manifest.json`, a service worker, and store icons.
7. Bring startup within `Quest.Performance.3` by loading assets after the XR session
   begins — which also finally pays down the composed-mode double-download.
8. Produce store screenshots that satisfy §2.3.8; the current `preview.png` cannot serve.
9. Set an age rating that reflects anatomical nudity, and complete Play's Data safety
   declaration (this app collects nothing, which makes it a short form).

**Licensing hygiene — small, and worth doing whatever happens**

10. Give `schematic-eye` an explicit licence, preferably CC0-1.0.
11. Decide MIT versus Apache-2.0 while the copyright is held by one person.

**Status note, 4 August 2026.** Items 5 (page title) and the terminology rename are done;
the product is now **Open Twin XR** and nothing user-facing says "health". This is
currently an internal tool with no public distribution, so items 2, 3, 6, 7, 8 and 9 are
not live questions — they become live only if a store route is chosen.

**Cheapest honest option.** Publishing as a **web app at a URL** — which is what
the gated preview already is — avoids items 2, 3, 6, 7, 8 and 9 entirely, because
no store DRM is applied, no marketplace is involved, and there is no listing metadata to
satisfy. Items 1, 4, 5, 10 and 11 remain, and 1 and 5 are worth doing this week whatever
the distribution route.

---

## Sources

- Creative Commons, [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en)
  — §1(4) and §2(a)(5)(ii), quoted above
- Creative Commons, [GPL compatibility use cases](https://wiki.creativecommons.org/wiki/GPL_compatibility_use_cases)
  and [FAQ](https://creativecommons.org/faq/) — DRM platforms and CC material
- Creative Commons, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Apple, [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
  — §1.4.1, §1.1.4, §2.3.8, §4.2, §4.2.2
- Meta, [Progressive Web Apps](https://developers.meta.com/horizon/documentation/web/pwa-overview/)
  and [Package a PWA for Meta Quest](https://developers.meta.com/horizon/documentation/web/pwa-packaging/)
- UploadVR, [WebXR apps on the Meta Horizon Store can now use in-app payments](https://www.uploadvr.com/webxr-apps-on-quest-meta-horizon-store-can-now-use-in-app-payments/)
- This repository: [`docs/LICENCE_LOG.md`](../LICENCE_LOG.md) (generated),
  [`licences.json`](../../licences.json), [`docs/DEPLOY.md`](../DEPLOY.md)
