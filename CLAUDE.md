# Handover brief for Claude Code

> ## ⚠️ SCOPE CHANGED — read this before anything below
>
> **This repository is an open-source human BODY VIEWER.** Anatomy, geometry,
> materials, lighting, XR, and eventually personalisation from a person's own
> imaging. That is the whole subject.
>
> **Health-data mapping and scoring are NOT built here.** They moved to
> <https://github.com/etzm/open-twin> and the two reconcile later. The scoring
> UI that used to live here — per-system scores, the detail card, connected
> sources, the dashboard — has been removed from the app on purpose; the
> components remain unmounted under `src/ui/` for a later iteration. Do not
> rebuild them, and do not present the bundled fictional sample as anyone's
> measured health.
>
> **Read `docs/HANDOVER.md` first**, then `docs/README.md` for the documentation
> index — it says which documents are current and which are historical. Decisions
> and their reversals are in `docs/DECISIONS.md` (D1–D15). There are **two live
> plans, deliberately**: `docs/PLAN_NEXT.md` for repo quality and
> `docs/PLAN_INTEGRATION.md` for new geometry. `docs/ROADMAP.md` holds the phases.
>
> **Two documents are generated and must not be hand-edited** —
> `docs/LICENCE_LOG.md` (`npm run check:licences`) and `docs/ONTOLOGY_MAP.md`
> (`npm run gen:ontology`). Both had hand-maintained ancestors that went stale
> without anyone noticing. If a table in them is wrong, fix the script or the
> asset.
>
> Everything below this box predates the scope change. It is kept because its
> constraints on licensing, privacy and honest rendering still hold, but its
> ordering and its "blocking" scoring work do not. **Where this box and anything
> below disagree, this box wins.**

<details>
<summary>Original handover brief (superseded — expand for the still-valid constraints)</summary>

> **START HERE:** Read `docs/SCHEMA_VERIFICATION.md`, then `HANDOVER_SPEC.md`.
> The verification records what the real `etzm/open-twin` tree contains and
> overturned two premises of the original plan: open-twin emits **raw FHIR
> Observations and no scores** (a scoring layer must be built, and it is
> blocking), and the VITRONIC connector is **BodyLoop posture geometry**, not a
> VITUS surface scanner. The spec is the plan; this file is the short brief.
> Where this file and `HANDOVER_SPEC.md` disagree, **the spec wins.**

You are picking up a scaffolded, running MVP of **Open Twin XR**, a
web-based 3D human-body health digital twin. This file tells you what exists,
what is deliberately stubbed, and the exact next steps in order. Read
`README.md`, `docs/ARCHITECTURE.md`, and `docs/DATA_CONTRACT.md` first.

## Ground truth

- The app **already runs** on a procedural placeholder body and a bundled
  in-contract sample (`public/data/sample-twin.json`). Do `npm install &&
  npm run dev` to see it before changing anything.
- The design target is the product mockup: dashboard + 3D body coloured by
  organ-system health score + connected sources + (visual-only) AI bubble.
- The single data boundary is `TwinMetrics` in `src/data/schema.ts`. Do not
  spread upstream shapes into UI/scene code; keep all mapping in
  `src/data/adapter.ts`.

## The upstream data source

The data comes from **open-twin**, a separate repository. It is not vendored
here, and several rules below cite it as the authority:

- **Repo:** <https://github.com/etzm/open-twin> (fork origin; the canonical
  upstream is <https://github.com/Opening-Science/open-twin>).
- **Locally:** clone it beside this repo. The paths below are relative to its root.
- **The files that matter:**
  - `DECISIONS.md` — the target-state decision log (D1, D3, D6, D8, D10, ...).
    **Code the adapter against this**, not against open-twin's committed test
    snapshots, which predate remediation and encode known defects.
  - `packages/fhir-core/src/referenceRange.ts` — typed reference intervals with
    mandatory source URL and publisher. This is the required basis for any
    scoring work (`HANDOVER_SPEC.md` section 5a).
  - `CLAUDE.md` — upstream's own brief, which warns that a green test run there
    is not evidence of correctness.

## Hard constraints

1. **Do NOT build the AI layer.** The chatbot is a visual stub on purpose
   (`src/ui/ChatbotStub.tsx`). No LLM calls in this repo.
2. **Keep code (MIT) and anatomy assets separate.** The primary anatomy model is
   **HRA, CC BY 4.0 — attribution required, no share-alike**. Never paste model
   geometry into source; keep it in `public/models/`. See `ASSETS_LICENSE.md`,
   and note that the Z-Anatomy fallback described there is **CC-BY-SA** and
   re-attaches a share-alike obligation if used (`docs/MODEL_PIPELINE.md`).
3. **Health data is sensitive (GDPR Article 9).** The connectors hold vendor API
   credentials, so they and the scoring step run **server-side** — never in the
   browser. The browser fetches an already-scored `TwinMetrics` and nothing
   else. Keep it on infrastructure the user controls or behind their own auth,
   never a third party. Never log it, and never put an API response body into an
   error message. Sample data must stay fake.
4. **No paid dependencies** without flagging first. The whole v1 is free; see
   `docs/COMMERCIAL_LICENSES.md`.
5. **Never fabricate a score.** Missing data is `hasData: false, score: null`,
   rendered as "no data" — never 0, never a midpoint.
   `assertTwinMetrics()` enforces this; do not weaken it.

## Do these in order

1. **Get CI green — it is currently red.** The repo already exists at
   `github.com/etzm/open-twin-openXR` and the scaffold is pushed; `main` tracks
   `origin/main`. Creating and pushing the repo is done — do not redo it.

   Both CI runs to date failed in ~15s with `Dependencies lock file is not
   found`. `package-lock.json` has never been committed, so `actions/setup-node`
   cannot prime its npm cache and `npm ci` could not run anyway. It is not
   gitignored, just untracked. Commit it:
   ```
   git add package-lock.json && git commit -m "ci: commit lockfile so npm ci can run"
   ```
   Do not "fix" this by switching CI to `npm install` — the lockfile is what
   makes the build reproducible, and `package.json` pins are approximate.
2. **Verify the build.** `npm install`, `npm run build`, `npm run dev`. Fix any
   version drift in `package.json` (pins are recent-but-approximate).
3. **Settle the scoring decision, then wire the data.** This is **blocking** —
   nothing else in Phase 1 finishes without it. open-twin produces no scores at
   all, so decide where the scoring layer lives (`HANDOVER_SPEC.md` section 5a
   recommends a new `@open-twin/scoring` package upstream over a local
   `src/scoring/`). Then implement `fromFhirBundle()` in `src/data/adapter.ts`
   **server-side**, consuming a FHIR R4 Bundle. Basis for scores must be the
   upstream reference intervals; aggregation weights are a clinical judgement
   and need a named reviewer. See `docs/SCHEMA_VERIFICATION.md` for which
   systems actually have data.
4. **Swap in the real anatomy model.** Follow `docs/MODEL_PIPELINE.md`: take the
   **HRA** reference organs (CC BY 4.0), assemble a GLB in metres / +Y up /
   facing +Z, compress with `npm run convert:model`, and replace the placeholder
   in `src/scene/Body.tsx` with a `useGLTF` loader that recolours structures by
   score. Keep everything else. Resolve open question 3 (HRA musculoskeletal
   coverage) before committing to the swap.
5. **Fill `structures`** on each `SystemScore` so organ selection maps to real
   geometry. These are **ontology IDs** (`{ id: "UBERON:0002107", label:
   "liver" }`), not mesh-node name strings — the join must survive a model swap.
   There is no `meshNodes` field; that was removed from the contract.
6. **Polish WebXR.** Add ray-based organ selection in-headset and a simple
   in-VR info panel using `@react-three/xr` interaction primitives.

## Where things live

- 3D: `src/scene/` (`BodyScene.tsx` = Canvas + `<XR>`, `Body.tsx` = organs,
  `metricColor.ts` = score->colour).
- UI: `src/ui/` (one file per dashboard piece; `App.tsx` composes the layout).
- State: `src/store.ts` (Zustand: `data`, `selectedSystem`, `journeyT`).
- Data: `src/data/` (`schema.ts` contract, `adapter.ts` mapping).
- Upstream data source: see "The upstream data source" above — not in this repo.

## Definition of done for the next milestone

Real open-twin data flowing through the adapter, the real **HRA** model
rendering with organs coloured by live scores and clickable, systems with no
connector rendering as "no data" rather than as a number, CI green, and the
**CC BY 4.0** attribution shown in-app. AI still stubbed.

</details>

## Definition of done — the body milestone is MET

Superseding the section above: the milestone was the **body**, not the score, and
it is done. Real atlas geometry from seven registered sources with the donor
stated; 3,617 individually identifiable structures rather than anonymous merged
groups; both sexes offered wherever an atlas provides them, including a complete
female body; attribution rendered in-app as the licence condition it is; CI green.
Health mapping remains explicitly out of scope here.

**The next milestone is identity, not more geometry** — and as of 8 August 2026 a
good deal of it is done, with two of its premises corrected by measurement.

- **Z-Anatomy already carried 1,048 FMA CURIEs** before this milestone was worked
  on. Nothing read them: `StructureEntry` did not declare the field, and
  `docs/ONTOLOGY_MAP.md` had been generated against an older build and reported
  zero, which this file and `HANDOVER.md` then repeated. The type now declares it,
  `structureTerm()` resolves it, the UI shows it, and the map's prose is derived
  from the same measurement as its table so the two cannot disagree again.
- **BodyParts3D is DONE — the rebuild has happened.** It was listed here as
  outstanding for a while after it stopped being true. Measured on the shipped
  asset: **1,838 of 1,838 structures carry an FMA term**, the only atlas here at
  100 %. Run `npm run gen:ontology` before believing any coverage number in this
  file, including this one.
- ⚠️ **Ontology terms were NOT the fix for the one-sided ear**, which this file
  and the handover both predicted. None of the eight ear structures carries an
  `ontologyid`; `side` is what they all carry. The fix was a `side` filter plus
  replacing the contiguous-range mask with a per-structure texture
  (`src/scene/structureMask.ts`), because the two ears interleave.

- ⚠️ **`docs/ONTOLOGY_MAP.md` carried hand-typed structure IDS in a generated
  document, and they had gone wrong.** It stated the Z-Anatomy eye globe as "20
  structures at ids 2631–2650"; the asset says **22 at 2626–2647**. Ids are what
  the mask consumes, so this was not a rounding error — 2648 and 2649 are not eye
  structures, and implementing the documented mask would have hidden the wrong
  anatomy. The generator now measures them. **Never type an id into prose.**

Still open, measured on the shipped assets rather than assumed:

| gap | state |
|---|---|
| Z-Anatomy crosswalk | 1,048 / 3,614 (29 %) — 2,566 structures unmapped |
| `z-anatomy-regions` | 0 / 257, name only |
| overlay → atlas join | **0 of 18 overlay parts** resolve to a term |
| FMA ↔ UBERON bridge | does not exist |

The bridge is the one that blocks the others: BodyParts3D and Z-Anatomy are
addressed in **FMA**, while HRA and both CT atlases speak **UBERON**, so no
cross-atlas join can be made today. UBERON publishes FMA cross-references itself,
so that bridge should be *ingested and measured*, never hand-authored.

See `docs/ROADMAP.md` Phase 5 and the top of `docs/HANDOVER.md`.
