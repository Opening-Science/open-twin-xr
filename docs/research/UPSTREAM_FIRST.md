# What to land in `open-twin-xr` before forking

**Question answered:** which of the work in `FORK_PLAN.md` and `MODEL_INTEGRATION.md` belongs in the parent repository rather than in a fork, and should therefore be done first.

**Short answer:** roughly a third of it, and not because it is convenient. Several of the "fork prerequisites" are items already on the parent's own roadmap, written there before this exercise started. Doing them upstream is not borrowing against the fork; it is returning work to where it was already scheduled.

**Date:** 7 August 2026. Verified against `open-twin-xr` at commit `0758de4`.

---

## 1. The test that decides where a change goes

The parent draws the line itself, in decision **D8**:

> **What stays here.** The `anatomical` / `health` colour modes, those are rendering, not interpretation. `assertTwinMetrics()` also stays: this repo still refuses to render a fabricated score at the boundary, which is the one data guarantee a viewer can meaningfully keep.

So the test is **rendering versus interpretation**, and it is sharper than "does it touch health data". A capability that can colour, label, anchor or highlight a structure is rendering, whichever number drives it. A decision about *what a number means* is interpretation.

That yields three destinations, not two.

| Repository | Owns | Governing text |
|---|---|---|
| **`open-twin-xr`** (parent) | Anatomy, geometry, materials, lighting, XR, structure identity, personalisation from imaging | `docs/HANDOVER.md`: "An open-source human body viewer with WebXR" |
| **`etzm/open-twin`** (health data) | Connectors, FHIR, scoring, **terminology mapping, code to system assignment** | D8 |
| **The fork** | Rule engine, evidence corpus, model call, lexicon, proposal rendering, regulatory posture | This exercise |

**One correction to my own earlier recommendation.** `REFERENCES.md` §2.4 sets out an ICD-10 to UBERON pipeline and does not say where it lives. Under D8 it is **terminology mapping**, so it belongs in `etzm/open-twin`, not in the viewer and not in the fork. The fork consumes the resulting CURIEs; the viewer resolves them to meshes. Putting a disease-to-anatomy table in a rendering repository would repeat exactly the drift D8 was written to stop.

Note the asymmetry that follows: **anatomy-to-anatomy crosswalks (FMA to UBERON, Z-Anatomy name to UBERON) are viewer work**, because they are about what a structure *is*. **Disease-to-anatomy crosswalks are health-repo work**, because they are about what a code *means*. The parent's `docs/ONTOLOGY_MAP.md` and `scripts/build-crosswalk.mjs` are already on the first side of that line.

---

## 2. What lands upstream, and why the parent already wants it

### 2.1 Structure identity (`FORK_PLAN` T7)

**This is Phase 5 of the parent's own roadmap**, not a fork prerequisite. `docs/ROADMAP.md`:

> ## Phase 5, Structure name to UBERON crosswalk
> Z-Anatomy carries no ontology terms ... a crosswalk is what lets the three atlases agree on what a structure *is*, **and is the join the health data will eventually need.**

And `CLAUDE.md` names it as the current milestone:

> **The next milestone is identity, not more geometry.** Structures are addressed by NAME, and that is now the thing holding the interesting work back ... the first concrete step is writing the FMA crosswalks this repo already holds into the Z-Anatomy and BodyParts3D assets at build time.

So T7 was scheduled upstream before anyone thought about proposals. Doing it there is the correct home, and it unblocks the parent's own outstanding problem: overlay superseding currently matches structures by name, which is why the one-sided ear overlay cannot mask the ossicles it replaces without blanking the other ear.

Scope upstream: extend `StructureEntry` (`AtlasBody.tsx:203`) to declare `ontologyid`, `mesh`, `component` and `licence`, which the built asset already carries on 1,048 of 3,614 Z-Anatomy structures; add the structure-table fallback to the node-to-term resolution in `readTerm()` and `termChain()`; regenerate `docs/ONTOLOGY_MAP.md`, which currently claims Z-Anatomy carries zero terms and contradicts the asset.

**Beyond what the fork needed:** the parent's real Phase 5 goal is writing the crosswalks into BodyParts3D too, which has no structure table at all. That is a build-pipeline change to `scripts/build-bodyparts3d.mjs`, it is out of scope for the fork, and it is the thing that would let the permissive atlas carry structure-level work. See §4.

### 2.2 Publishing the selected structure (`FORK_PLAN` T8)

`selectedStructure` is component-local `useState` at `AtlasBody.tsx:1506` and is never published, so nothing mounted in `Body.tsx` can see which structure the user clicked. That is a plain architectural wart with no health semantics whatsoever. Lifting it into the store unblocks in-scene labelling for the parent as much as for the fork.

### 2.3 Per-structure tinting and the anchor primitive (`FORK_PLAN` T15, T16)

Both are rendering capabilities, and D8 puts rendering here.

**T16, per-structure tint.** Today the parent can tint per organ on HRA and the CT atlases (via the `group` key already in the material cache key) and only per system on Z-Anatomy. Closing that gap is a viewer capability that the parent's own exploded view and overlay mask already imply. Build it upstream as "tint a structure by id", with no opinion about what the colour means.

**T15, in-scene anchor.** Split it. A generic billboarded label anchored to a structure centroid, in the canonical frame in `Body.tsx`, is viewer work and reuses `XRInfoPanel`'s canvas-texture technique with no new dependency. Anchoring a *proposal* to it is fork work. Ship the primitive upstream and consume it downstream.

### 2.4 XR (`FORK_PLAN` T17)

XR is named in the parent's own scope sentence. Two of the three items are straightforward upstream bug fixes: `XRInfoPanel` renders nothing when a structure resolves to no system, which silently covers all 257 body regions and every lymphoid organ; and `meshRef` is assigned and never read.

The third, carrying 2D scene state into the XR session unchanged, is the differentiating one and it is entirely a viewer feature. Nobody in the field does it. It belongs upstream on merit.

### 2.5 Accessibility (`FORK_PLAN` T18)

The most obviously upstream item in the whole set, with zero fork dependency. The parent has `aria-pressed` on toggles and essentially nothing else: no focus styles at all, no keyboard route to the canvas, no live region, no `prefers-reduced-motion` while the turntable defaults on. For a viewer aimed at education and public institutions this is a procurement problem under EN 301 549 long before it is a proposals problem.

### 2.6 The claim linter over static copy (`FORK_PLAN` T5, partial)

The fork needs `lintProposalText()` for generated text. The parent would benefit from the same word lists run over its own user-facing strings, because **claim creep enters through static UI copy at least as often as through model output**, and the parent's D15 was precisely an exercise in removing health language from those strings. A `npm run lint:claims` script upstream protects the parent's non-regulated status. That is a gift to the parent rather than a fork prerequisite.

### 2.7 The skin envelope (`MODEL_INTEGRATION` M1 to M4)

D14 measured the gap and accepted it:

> | `z-anatomy`, `z-anatomy-regions` | **0** |
> | `ct-atlas-f`, `htb-ct-f` | **0** |
> So the effect is unavailable on three of the selectable sources, including Z-Anatomy, which has the richest musculoskeletal and nervous coverage. **The best anatomy is exactly where the best-looking hull is impossible.**

An ANNY-derived envelope closes that, is Apache-2.0 plus CC0, and is squarely inside "anatomy, geometry, materials". It also seeds Roadmap Phase 7, personalisation from imaging, for which a parametric envelope is the standard vehicle. Nothing about it is health interpretation.

---

## 3. What stays in the fork, without exception

Everything that assigns meaning: the rule engine, the evidence corpus and its licence segregation, the model call, the validator, the safety gate, the proposal schema, the lexicon's *health* word lists, `INTENDED_PURPOSE.md`, `docs/PRIVACY.md` and the DPIA, the eval harness, and the clinical reviewer requirement.

Also fork-only, and easy to misfile: **the metrics colour ramp decision** (`FORK_PLAN` T6). The ramp lives in the parent's `metricColor.ts`, but replacing red-amber-green because red on an organ reads as a clinical alert is a regulatory judgement, not a rendering fix. The parent already knows the question is open, in D15:

> Renaming is not a regulatory answer. The metrics mode still colours anatomy on a red-amber-green scale from a supplied value ... for any public or store distribution, the question is what the scale *means*.

So **raise it upstream as an issue with the reasoning, do not change it in a PR framed as fork groundwork.** It is @etzm's call. Note the dependency: `NO_DATA_COLOR` is justified relationally, as "deliberately outside the red-amber-green scale", so any ramp change forces a no-data colour change with it.

---

## 4. Sequencing, and a conflict already on the board

`docs/ROADMAP.md` carries a warning that governs all of this:

> ## In flight
> A separate session is trimming the composed atlas so it stops downloading both full atlases and hiding ~1M triangles it never draws. **That touches `AtlasBody`/`Body` loading, so it will conflict with Phase 1, land it first.**

Every upstream item in §2.1 to §2.3 edits `src/scene/AtlasBody.tsx`, which is the parent's largest file at 1,709 lines and its most actively developed. **Land the in-flight composed-atlas trim before starting any of this**, or you will resolve the same conflicts twice.

A workable order:

| # | Work | Touches | Note |
|---|---|---|---|
| 0 | In-flight composed-atlas trim | `AtlasBody`, `Body` | Not yours. Wait for it |
| 1 | Accessibility (§2.5) | `src/ui/**`, `styles.css`, `index.html` | Zero overlap with the above. Start here while waiting |
| 2 | Claim linter over static copy (§2.6) | new script, `ci.yml` | Also no overlap |
| 3 | Publish `selectedStructure` (§2.2) | `store.ts`, `AtlasBody` | Small, and unblocks 4 and 5 |
| 4 | Structure identity / Phase 5 (§2.1) | `AtlasBody`, `scripts/`, `docs/` | `scripts/` is CODEOWNER-pinned to @etzm |
| 5 | Anchor primitive + per-structure tint (§2.3) | `AtlasBody`, `Body`, new component | Depends on 3 and 4 |
| 6 | XR fixes and state carry-over (§2.4) | `XRInfoPanel`, `BodyScene` | Independent of 4 and 5 |
| 7 | Skin envelope (§2.7) | new registry, `Body`, `SceneDock`, `scripts/` | Independent. Also `scripts/` pinned |
| 8 | **Fork** | | Now T7, T8, T15, T16, T17, T18 are already upstream |

Two ownership notes from `.github/CODEOWNERS`: `/scripts/` is reserved to @etzm because "its failure modes are silent", and `/src/data/schema.ts` is pinned as a contract this repository does not own. Items 4 and 7 both touch `scripts/`; expect review, and use the existing `asset-pipeline.md` issue template to open them.

---

## 5. What this actually buys

**The merge burden mostly disappears.** The fork plan's own §7 question 9 flags that T7, T8 and T16 all edit the parent's largest and most active file, so every upstream geometry change would conflict. Landing them upstream first removes that entirely: the fork then adds files (`src/proposals/**`, `src/data/proposals.ts`, a panel) rather than editing the file most likely to move.

**The work survives the fork being cancelled.** Items 1 to 7 are all things the parent wants on its own terms. If the interpretation layer is never built, or `FORK_PLAN` §7 question 8 is answered with "use deterministic templates and no model", none of this is wasted.

**It keeps the fork's claim surface small**, which is the whole regulatory argument for forking. A fork that contains only the interpretation layer is much easier to describe accurately in `INTENDED_PURPOSE.md` than one that also carries half the rendering stack.

**And it is honest about provenance.** Phase 5 was the parent's next milestone before this exercise existed. Doing it in a fork and calling it fork groundwork would take credit for work that was already scheduled, and would leave the parent still blocked on the name-matching problem that its own handover document names as the thing holding the interesting work back.

---

## 6. One thing to decide before item 4

Item 4 raises the question `FORK_PLAN` §7 question 7 records and does not answer: **which atlas carries structure-level work.**

- **Z-Anatomy** has per-structure identity today (3,614 structures, 1,048 FMA CURIEs, centroids on all of them) and is CC BY-SA 4.0, with an unresolved GitHub-versus-Zenodo licence discrepancy.
- **BodyParts3D** is CC BY 4.0 since 2025-02-27 and permissive, but has no structure table in the built asset at all. The crosswalk data exists in the repo (`docs/bodyparts3d-system-map.tsv`, 1,838 rows), so this is pipeline work rather than research, and it is explicitly what Phase 5 contemplates.

If the answer is BodyParts3D, item 4 grows: it becomes "write the structure table and the FMA crosswalk into the BodyParts3D build", which is more work upstream and less licence exposure downstream. If the answer is Z-Anatomy, item 4 is small and the share-alike question follows the geometry into whatever consumes it.

That is a decision for @etzm, and it is worth making before writing the code rather than after.
