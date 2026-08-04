# Next work — planned, not started

> ## ▶️ PHASE 0 AND PHASE 1 EXECUTED — 29 July 2026
>
> Every code-only item is done and pushed. Phase 1's rebuilds ran for
> BodyParts3D and HRA. **Phase 2 (items 19–21) is untouched.**
>
> | | |
> |---|---|
> | done | 2, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 17, 18 |
> | dropped by decision | 3 |
> | no action needed | 4, 8, 10 |
> | shipped as decided, prune before public | 1 |
> | **not started** | **19, 20, 21** |
>
> Findings that changed the work are recorded against the items below.

Decisions recorded against each item are the ones taken on 28 July, so execution
does not have to re-litigate them.

---

## Ordering, and why

Two facts drive the sequence:

- **Rebuilds are the expensive thing.** A full AO bake is ~52 min for Z-Anatomy
  and ~2 h for HRA, single-threaded (measured: 99.3 % of one core). Everything
  that needs the same asset rebuilt must be batched into ONE bake or the day
  disappears.
- **Most items are code-only.** They land immediately and can all be done first,
  which also means the batched rebuild happens once, with every change already in.

So: **all code first, then one rebuild per atlas, then the bigger bets.**

---

## Phase 0 — code only, no rebuild

Everything here lands without touching an asset.

| # | item | decision | notes |
|---|---|---|---|
| 2 | Inner-ear over-attribution | **correct** | `Tympanic_membrane` and `Auditory_tube` are MIDDLE ear; Dundee's component is the INNER ear. Almost certainly Z-Anatomy's own — remove from the `COMPONENTS` pattern. Tags only change in the asset on the next Z-Anatomy rebuild. |
| 4 | Ear ossicles provenance | **ok as recorded** | Leave the doubt in `licences.json`. No action. |
| 5 | Release + fetch, and **citations in the UI** | **improve** | Where a source has a formal citation, render it in `AtlasAttribution` — HRA has *Nature Methods* 2024, BodyParts3D has Mitsuhashi et al. *Nucleic Acids Res* 2009. Add a `citation` field to `AnatomySource`. |
| 10 | `CardioVascular41` | **keep default** | Stays Z-Anatomy in `COMPOSED_SOURCE`. No change. |
| 11 | `ct-atlas-f.glb` | **register** | Add to `ANATOMY_SOURCES` so the built CT atlas is actually loadable. |
| 13 | `transmission` transparency | **add as an option, for intestine** | Non-dithered alternative to `alphaHash`. Scope to intestine first. ⚠️ Costs a full-screen pass and can read glassy; keep `alphaHash` as the XR fallback. |
| 14 | HRA's 38 unresolved meshes | **use hraGroups mapping** | Extend `hraGroups` so they resolve to systems instead of rendering grey. Biggest visible win in Phase 0. |
| 15 | Attachment decals drift ~5 cm on explode | **execute** | Anchor each decal to its nearest bone at load — 637 × 344 distances, trivial, no rebuild. |
| 16 | Body regions render grey | **execute** | Give surface regions their own palette treatment. They correctly resolve to no system; that should not mean colourless. |
| 17 | `npm run lint` broken repo-wide | **execute** | No eslint config exists anywhere. Add one or remove the script — a permanently failing check trains people to ignore checks. |
| 18 | Inter font from Google Fonts CDN | **execute** | Self-host. Only external runtime fetch, and a GDPR exposure with German case law behind it. |
| 12 | Liver white patches | **try to resolve** | Established NOT ambient occlusion. Hypothesis: adjacent organ interpenetrating the liver in HRA's source. Verify before fixing — this one has already burned six wrong diagnoses. |

### Item 3 — dropped, deliberately

**Cranial Nerves and Foramina (Univ. of Dundee CAHID, CC BY 4.0) will NOT be
tagged per structure.** Dropped on 28 July to avoid a judgement call that cannot
be made safely from names alone.

The pattern would have to catch Dundee's cranial nerves without swallowing
Z-Anatomy's own nerve geometry, and that distinction has already caused one error
in this codebase: a substring match on `cochlea` catches the cochlear NERVE and
the cochlear NUCLEI, which are Z-Anatomy's work, not Dundee's. Guessing produces
a log that is confidently wrong, which is worse than one that is incomplete and
says so.

**⚠️ This does not drop the credit, and that distinction matters.** The component
is already rendered by `AtlasAttribution` and embedded in the asset's
`asset.copyright`. CC BY 4.0 asks for attribution, and attribution is given. What
is foregone is per-structure provenance — so the generated log shows the
component with no structure count, and that gap is intentional rather than drift.

If it is ever picked up: the answer is not a better regex, it is the Phase 5
ontology crosswalk, which identifies structures by term rather than by spelling.

---

## Phase 1 — one batched rebuild per atlas

**Do not start these individually.** Land every Phase 0 change first, then bake.

### HRA (female + male) — one pass

| # | item | decision |
|---|---|---|
| 6 | Sexes built differently | **take the smaller** — align female DOWN to the male's `0.3/0.01`, returning it to ~8 MB |
| 7 | `_STRUCTURE` ids | **implement** — this is roadmap Phase 1's remainder |
| 9 | AO `--strength` | **do** — settle a number. `restrength-ao.mjs` makes trying values instant, so decide by eye, then bake once |

### BodyParts3D — one pass

| # | item | decision |
|---|---|---|
| 7 | `_STRUCTURE` ids | **implement** |

**Highest user-visible item on the list.** BodyParts3D is the *default* atlas and
still has no per-structure hover and no per-structure explode — hover says
"musculoskeletal / muscle" instead of naming the structure.

### Z-Anatomy — only if something else forces a rebuild

| # | item | decision |
|---|---|---|
| 8 | `Mucosa of stomach` | **do not build for this alone** |

The drop is already in the build script. It, and the #2 tag correction, land
free whenever Z-Anatomy is next rebuilt for another reason. Until then
`check:structures` reports one known, named, understood entry.

## What executing it turned up

Three things worth knowing before Phase 2.

**The ontology join is most of the way back, as a side effect.** Adding
`_STRUCTURE` to BodyParts3D and HRA meant writing a structure table, and both
atlases carry ontology terms per structure — FMA on all 1,838 BodyParts3D
structures, UBERON on HRA and the CT atlas. D11 records the join as outstanding
because a merge spent it; for three of four atlases it was only ever lost in the
merge. **Only Z-Anatomy still lacks terms**, which sharpens Phase 5 from "build a
crosswalk" to "build a crosswalk for one atlas".

**The CT atlas has no provenance, and that is a licence gap.**
`CT_ATLAS_PIPELINE.md` is explicit that its licence is set by the source image,
not the MOOSE weights — and the source scan is recorded nowhere. Registered with
the gap declared rather than a donor invented. Resolve before it is published.

**#12 was coincident geometry, not shading.** HRA models the liver at three
levels at once and renders all of them. Two prior diagnoses blamed ambient
occlusion; measuring bounding-box overlap named the culprit in one step. The
lesson is the one D13 already records — when the asset passes its checks, the
fault is elsewhere.

## Phase 2 — the bigger bets

| # | item | decision | note |
|---|---|---|---|
| 19 | **Phase 5 — UBERON crosswalk** | **execute** | The durable moat per your own survey, and the prerequisite for health-marker mapping (see the handover doc below) |
| 20 | **Open3Dmodel / AnatomyTOOL (Leiden LUMC)** | **execute** | CC BY-SA, remeshed and anatomist-reviewed Z-Anatomy. Both gating questions already resolved in `docs/RESOURCES.md`. Best quality-per-effort item here |
| 21 | **Female body** | **execute** | BodyParts3D and Z-Anatomy are both TARO and male; female currently only via HRA, which lacks the upper skeleton |

## Item 1 — the licence decision, recorded

**Decision: ship, do not let it block. Prune before public release.**

The University of Washington white matter carries no licence statement. The
`--publishable` flag already drops it and nothing else, so the prune mechanism
exists and is one flag.

Recorded plainly so the position is deliberate rather than forgotten: a
login-walled preview is still distribution, and no grant exists for those 3
structures. The decision is to accept that for a private preview and prune before
anything public. `docs/DEPLOY.md` documents the flag; `licences.json` carries the
gate note.

---

## Documentation deliverables

Requested alongside the code work. Specified here so execution is mechanical.

### 1. README — rewrite

- What the project is: an open-source human body viewer with WebXR, **not** a
  health dashboard (scoring moved upstream to `etzm/open-twin`, D8)
- Quick start, and the fact that it runs with no assets at all on the procedural
  body
- **All resources as references** — every atlas, tool, dataset and dependency
  with its licence and a link, drawn from `docs/RESOURCES.md` and `licences.json`
- Current state: 4 atlases, 3,617 Z-Anatomy structures, 257 surface regions
- Honest licence line: **open source, non-commercial** — not Open Definition
  conformant, because of the CC BY-NC components

### 2. `docs/HANDOVER.md` — for an LLM picking this up cold

Must stand alone. Contents:

- Architecture: `src/scene/` vs `src/ui/` vs `src/data/`, and the atlas registry
- The build pipeline end to end: FBX → `build-z-anatomy` → `optimize` → `bake-ao`,
  with the measured costs so nobody starts a bake casually
- The invariants that are easy to break, each with the failure it prevents:
  `_STRUCTURE` identity, winding, canonical frame, licence provenance
- **A component/licence table** (below)
- **How health markers map to organs** (below)
- What the checks actually guarantee — and what they do not: `check:winding` and
  `check:structures` were green throughout the point-cloud investigation and were
  right; the fault was in the render path

### 3. Component and licence table

In the handover doc. One row per component, not per atlas — the point is that
Z-Anatomy is an aggregate:

| component | holder | licence | structures | publishable |
|---|---|---|---|---|
| Z-Anatomy own geometry | Z-Anatomy authors | CC BY-SA 4.0 | 3,602 | yes |
| Anatomy of the Inner Ear | Univ. of Dundee School of Medicine | CC BY-NC-SA 4.0 | 8 | non-commercial only |
| Kidney | lissiecowley | CC BY-NC 4.0 | 4 | non-commercial only |
| Brainder / white matter | Univ. of Washington | **none stated** | 3 | **no** |
| BodyParts3D | DBCLS | CC BY 4.0 | — | yes |
| HuBMAP HRA (f + m) | HuBMAP Consortium | CC BY 4.0 | — | yes |
| Cranial Nerves and Foramina | Univ. of Dundee CAHID | CC BY 4.0 | *untagged by decision — credited, not counted* | yes |

Generate it from `licences.json` + the asset roster rather than typing it, so it
cannot drift. Counts above are from the current build and should be regenerated.

### 4. How health markers map to organs

The part most likely to be misunderstood by whoever picks this up, because the
repo *looks* like it does scoring and does not.

Explain, in the handover doc:

1. **Where the data comes from.** `etzm/open-twin` emits FHIR R4 Bundles of raw
   Observations. **No scores.** Scoring and terminology mapping belong there
   (D8), not here.
2. **The boundary.** This repo consumes `TwinMetrics` (`src/data/schema.ts`)
   and asks no questions about how numbers were reached. Missing data is
   `hasData: false, score: null` — never 0, never a midpoint.
3. **The join, and why it does not work yet.** A marker names a *structure*
   (UBERON/FMA); geometry currently carries `system`, `layer` and `label` but
   **no ontology IDs** — BodyParts3D's FMA terms were lost in the merge and
   Z-Anatomy never had any (D11). So the only join available today is
   marker → system → whole system coloured.
4. **What closes it: Phase 5.** A structure-name → UBERON crosswalk gives
   marker → structure → *that structure* highlighted. `_STRUCTURE` per-vertex ids
   already exist on Z-Anatomy, so the geometry side is ready; the crosswalk is
   the missing half.
5. **The honesty rule that must survive.** Never fabricate a score, and never let
   absent data change the anatomy — D13: unscored organs render solid in the
   atlas view, and only `health` mode ghosts them. Do not reintroduce ghosting as
   a default.

---

## Item 19 — the crosswalk, done and measured

**676 of 2,916 Z-Anatomy structures (23 %) now carry an FMA term**, joined
against BodyParts3D — the atlas Z-Anatomy was retopologised from — and applied to
the built asset without a rebuild. Detail in `docs/HANDOVER.md`; the yield ceiling
and the two genuine findings (BodyParts3D has no patella; terminology differs)
are recorded there rather than repeated here.

## Item 20 — Open3Dmodel: verified importable, not yet imported

The one open judgement is closed, favourably, by measurement rather than
argument — see `docs/RESOURCES.md`. In short: the regional exports share a single
world frame, are already in **metres, +Y up, feet at 0, 1.705 m**, and carry no
node transforms at all, so assembly is concatenation and not placement.

Two things the importer must handle: regions **overlap** the overview skeleton
rather than tiling it (one hand is 312 k verts against 290 k for the whole
skeleton, so substitute or treat as LOD — do not merge both), and compression is
Draco where the pipeline is meshopt.

## Item 21 — the female body is blocked on provenance, not on geometry

**Measured, not assumed.** HRA female has spine, pelvis and legs and is missing
skull, ribs, clavicle, scapula, humerus, radius, ulna, carpals, phalanges and
calcaneus — it renders as torso-and-legs, which is the complaint.

The parts exist. Three candidate completions, **each with a declared defect**:

| source | supplies | defect |
|---|---|---|
| CT atlas (`ct-atlas-f`) | skull, clavicle, scapula, humerus, carpals, phalanges, ribs 1–12, sternum | **donor unrecorded** |
| Open3Dmodel | complete, anatomist-reviewed upper skeleton, in our exact frame | TARO-derived — **male** |
| HRA male | complete-ish | a different person, and male |

⚠️ **The CT atlas is declared `sex: 'female'` in `anatomySources.ts` while its
donor is recorded as "Unidentified CT subject, source scan not recorded".**
Nothing verifies that sex claim. Completing the female body from it would mean
building a body whose skeleton is asserted female on no evidence — the same class
of mistake as fabricating a score, and D13's honesty rule applies by analogy.

**Recommended path, and it is not a graft: segment the Visible Human Female.**
She is already the donor HRA female derives from, the VHP data is **public
domain**, and the MOOSE pipeline that produced the CT atlas is already in this
repo with a UBERON crosswalk. That is the only route that yields a skeleton
belonging to *her body* rather than borrowed from someone else — ribs that sit
around her lungs because they are hers. Everything else needs registration or
warping between two different people and will look wrong at the joins.

### Built: a composite per sex, and the donor mix was tried and rejected

"Best of both" is now **two maps** — `COMPOSED_SOURCE` (male) and
`COMPOSED_SOURCE_F` (female) — and the sex toggle switches between them instead
of being inert. The credit panel names every contributing source, its donor, and
**which systems it supplies**, because crediting two atlases side by side leaves
the join invisible and the join is what matters in a composite.

⚠️ **The composite-and-label-honestly option was implemented, looked at, and
reverted.** Pointing female `musculoskeletal` at the CT atlas rendered a floating
skull, detached arms, and a ribcage and pelvis grossly out of scale with the
organs inside them — HRA's pelvis sits at y≈0.02 where the CT atlas's is at
y≈−1.5, and they are different people besides. Labelling would not have made that
body honest, only annotated.

So the female composite is **HRA throughout: one donor, correctly proportioned,
missing the upper skeleton**, and the credit panel states the absence in words
rather than leaving a viewer to think the app failed to draw her arms. The
tie-break rule that argued for borrowing bones ("coverage wins when the gap is
material") was written to choose between two atlases of the *same* donor and does
not extend across people — that limit is now recorded where the rule lives.

**What remains open is only the route that fixes it properly**: segment the
Visible Human Female with the MOOSE pipeline already here, so the skeleton is
hers and registers by construction. That still needs your go-ahead, since it
means acquiring and processing the VHP female volume.

---

## What is NOT in this plan

- The deploy itself — DNS, Caddy, credentials are yours (`docs/DEPLOY.md`)
- `PLAN_INTEGRATION.md` items **B6, B2, B8, B3** — a separate track from `main`,
  not reconciled with this list
- **A1 is done** and `PLAN_INTEGRATION.md`'s ordering section is now stale: it
  gates A1 on this branch landing, which has happened. Rewrite it before anyone
  follows it.
