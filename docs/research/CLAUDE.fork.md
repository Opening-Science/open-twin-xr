# Handover brief for Claude Code: Open Twin Proposals

> Drop this in at the root of the fork as `CLAUDE.md`, replacing the parent's.
> Do not edit the parent's file in place. Its top box is a scope statement for a
> different project and rewriting it would make the decision log false.

---

## What this repository is

A fork of [`Opening-Science/open-twin-xr`](https://github.com/Opening-Science/open-twin-xr) that adds an **interpretation layer**: it turns already-scored wellness metrics into cited, evidence-graded, actionable lifestyle suggestions, and renders them against the anatomical 3D body the parent provides.

**It is not a medical device and it must not become one.** Under EU MDR the classification of software is set by the manufacturer's stated intended purpose, which means it is set by the words in this repository. `INTENDED_PURPOSE.md` is the highest-risk file here. Read it before writing any user-facing string.

**Why a fork and not a branch.** The parent forbids this work in two places: `CLAUDE.md` hard constraint 1 ("Do NOT build the AI layer ... No LLM calls in this repo") and `HANDOVER_SPEC.md` §10 ("Do not build the AI layer here"). Decision D8 puts health interpretation upstream. The fork is the mechanism that governance implies, and it keeps the parent's claim surface clean.

**Track upstream.** `git remote add upstream https://github.com/Opening-Science/open-twin-xr.git`. The parent's anatomy pipeline is the asset you are not rebuilding. Rebase geometry work in; do not diverge.

Full task plan: `FORK_PLAN.md`. Landscape and licensing evidence: `RESEARCH.md`.

---

## The architecture in one diagram

```
TwinMetrics JSON  (server-side, already scored, unchanged from parent)
   → [1] RULE ENGINE        deterministic TypeScript. No model. Emits typed
   │                        ProposalCandidate[]; every number copied literally.
   → [2] EVIDENCE BINDING   candidate → source record ID from a local,
   │                        licence-tagged corpus. Grades attach to SOURCES.
   → [3] LLM                selects, orders, tailors, phrases. Nothing else.
   │                        Constrained decode to a fixed schema.
   → [4] VALIDATOR + LINTER hard schema check + banned-lexicon pass.
   │                        Failure drops the proposal. No silent retry.
   → [5] RENDER             2D panel + in-scene anchor + XR panel
```

Stages 1, 2 and 4 are deterministic and testable in CI with no model and no network. Stage 3 is boxed on both sides. **That property is the entire defensibility argument**, because this project cannot afford the evaluation budgets its commercial competitors have (Fitbit reports over 100,000 hours of human evaluation; the PHIA paper reports 650; you have approximately zero).

---

## Hard constraints

These are not preferences. Each one has a specific reason and a specific failure it prevents.

1. **The model never emits a number.** Every number in rendered prose must appear literally in the `ProposalCandidate` it came from. Validated in `src/proposals/validate.ts`. Reason: PHIA measured accuracy going from 22% to 74% the moment arithmetic moved out of the model.
2. **The model never emits a citation, a URL, a DOI or a PMID.** It references source IDs; the renderer resolves them. Reason: GPT-4o produced 19.9% fabricated citations across 176 references, and of the 141 non-fabricated citations 45.4% (64 of 141) contained errors.
3. **The model never assigns an evidence grade.** Grades attach to source records at ingestion, by a human.
4. **The model never adds a candidate the rule engine did not offer.**
5. **No red on organs.** Do not use red hues on organ materials. Red on an organ is an alert; alerts are an MDR Rule 11, second paragraph, framing signal (the sub-labels 11a, 11b, 11c come from MDCG 2019-11, not from the Regulation itself) and an anxiety driver in roughly 1 in 5 wearable users (Rosman et al., *J Am Heart Assoc* 2024).
6. **No unsafe reassurance.** Never say a metric is fine, healthy, or nothing to worry about. The absence of proposals must never render as an all-clear. This is the failure mode nobody else names.
7. **Compare to the user's own baseline, never to a clinical reference range.** A "normal range" is a diagnostic reference. This is better science and a regulatory firewall at once.
8. **Never fabricate a proposal for a system with `hasData: false`.** The parent's `assertTwinMetrics()` guarantee, extended one layer up. No data means no proposal, not a generic proposal.
9. **Do not widen `src/data/schema.ts`.** It is CODEOWNER-pinned as an upstream contract under D8. Proposal types go in `src/data/proposals.ts`.
10. **Do not build a Python sandbox.** PHIA needs one because it consumes raw dataframes. This repo consumes already-scored JSON. The rule engine is this system's code tool.
11. **Do not vendor PHIA's code, prompts, few-shots or benchmark files.** CC BY-NC 4.0, incompatible with MIT. A non-profit is not automatically non-commercial under NC. Re-derive the method.
12. **Raw metrics and the generation step stay server-side; rendered proposals reach the browser.** GDPR Art. 9 special-category. Sending `TwinMetrics` or generated text to a third-party LLM API is an international transfer of health data. See `docs/PRIVACY.md`. State the boundary precisely, because "health data stays server-side" is too blunt to implement against and contradicts the file map below: **server-only** are the raw metrics, the connector credentials, the model call and the whole generation path (`engine.ts`, `generate.ts`, the rule modules, the evidence corpus lookup, `safety.ts`, `lexicon.ts`, `validate.ts`); **client-side** are the already-generated `RenderedProposal` objects and the code that renders them. A `RenderedProposal` is still health data and still needs consent, transport security and retention limits, but it is the only health payload that crosses to the browser. Do not bundle the generation path into the Vite client build.
13. **Never log a health payload or put one in an error message.** Inherited from the parent, still correct.
14. **No URL state derived from health data.** The parent has no deep-linking. Here that is a decision, not an oversight: a URL encoding a health inference lands in history, logs, referrers and chat previews.
15. **Weekly, batched, user-initiated proposals. One or two live at a time.** A daily cadence trains checking behaviour, and more behaviour-change techniques do not mean more effect (Lee and Park, *npj Digital Medicine* 2025, SMD 0.324, technique count did not predict effectiveness).

---

## The lexicon

Every generated string passes `lintProposalText()` in `src/proposals/lexicon.ts`. Four banned sets:

| Set | Why | Examples |
|---|---|---|
| **Medical purpose** | MDR Art. 2(1) medical purpose. These terms assert a medical purpose and so push the stated intended purpose toward the device definition. Qualification turns on the manufacturer's stated intended purpose, not on a token appearing in a string | diagnose, disease, disorder, dysfunction, symptom, treat, therapy, cure, prevent, abnormal, deficiency, you have, you are at risk of, medication, normal range, and named conditions |
| **Monitoring** | MDR Rule 11, second paragraph, "software intended to monitor physiological processes" is Class IIa | monitor, monitoring, surveillance, alert, warning, abnormality detected. Use: track, log, trend, show, summarise |
| **Emotion** | AI Act Annex III 1(c). Recital 18 **excludes physical states** | mood, emotion, anxiety, stress level. Use: fatigue, recovery, physiological load, readiness, strain, sleep debt |
| **Reassurance** | Harm, and it is the failure mode with no external regulator | looks healthy, is fine, nothing to worry about, all clear |

The permitted claim grammar, quoting FDA's General Wellness guidance, which requires the relation be "specifically expressed as 'may help to reduce the risk of,' or 'may help living well with,' a chronic disease or condition": **"may help to reduce the risk of X"** and **"may help living well with X"**. The word "to" is part of the blessed construction. Anything stronger leaves the policy.

Run `npm run lint:claims` over static UI copy too. Claim creep enters through hard-coded strings at least as often as through model output.

---

## Traps inherited from the parent

Every one of these produces a change that appears to do nothing. All are documented in the parent's own comments, mostly because it hit them.

| Trap | Where | Symptom |
|---|---|---|
| Material assignment effect has a hand-maintained dep array behind an `eslint-disable` | `src/scene/AtlasBody.tsx:1416` | Your change works after an atlas switch and does nothing on the current atlas |
| `customProgramCacheKey` must list every shader variant | `AtlasBody.tsx:1319` | three returns a cached program and `onBeforeCompile` is never called |
| `BVH_OPTIONS.indirect: true` is correctness, not tuning | option at `AtlasBody.tsx:111-115`, measurement at `88-94` | Removing it shatters Z-Anatomy's 413 contiguous `_structure` runs into 16,051; the worst draw range then spans 1,087x its own triangle count and the highlight paints most of the mesh |
| `selectedStructure` is component-local `useState`, not store state | `AtlasBody.tsx:1506` | A component mounted in `Body.tsx` cannot see the selected structure at all. This blocks **every** in-scene annotation, which is why FORK_PLAN T8 exists. Lift it into the store first |
| Per-structure explode is a **vertex-shader** displacement | `AtlasBody.tsx:1273-1288` | Children parented to a mesh do not move with the exploded structure |
| `hoverCursor.ts` token discipline | `src/scene/hoverCursor.ts` | r3f fires no `pointerout` on unmount. Any hovering component must call `useHoverRelease()` |
| `SceneDock.tsx` and `AttributionBar.tsx` are a circular import | both | Works today because both are function declarations. Module-level state in either breaks it |
| The right rail is a hard-coded `300px` | `src/App.tsx:126` | A proposal card with a citation and an evidence badge will not fit |
| Missing `allow="xr-spatial-tracking"` on an embedding iframe | any embed | `immersive-vr` fails **silently**, with no useful error |

---

## Free wins the parent left on the table

1. **`StructureEntry` does not declare `ontologyid`, but a locally built `z-anatomy.ao.glb` carries it on 1,048 of 3,614 structures.** Nothing in `src/` reads it. Note that the GLBs are **not in the repository**: `.gitignore` line 13 excludes `public/models/*.glb` and `git ls-files public/models` returns only `README.md`, so the atlases are downloaded or built locally and these figures are a property of that build rather than of the repository. Note also that the six-line interface change at `AtlasBody.tsx:203` does **not** by itself unlock anything: adding optional fields to a TypeScript interface is a runtime no-op, and `scene.userData.structures` already carries `ontologyid` regardless. The actual unlock is the interface change **plus** the structure-table fallback in the resolution chain **plus** consumers that read it. See FORK_PLAN T7 for the full change.
2. **`StructureEntry.centroid` is in canonical metres and present on all 3,614 structures in a locally built asset.** That is a free 3D anchor requiring no per-atlas offset table, but only on `z-anatomy` and `z-anatomy-regions`: `hra` and `hra-m` are node-termed with no structure table, and `bodyparts3d` has neither. Anchors on the node-termed atlases need a second code path. See FORK_PLAN T15.
3. `docs/ONTOLOGY_MAP.md` is stale and claims Z-Anatomy carries 0 terms. Run `npm run gen:ontology`.
4. `scoreToOpacity` in `metricColor.ts` has zero importers.
5. `recharts` is 5.3 MB of runtime dependency serving one orphaned file. Remount `TrendChart` or drop both.
6. Five health UI components sit intact and unmounted under `src/ui/`, kept deliberately "for a later iteration". This is that iteration. Remount them, but rewrite their copy against the lexicon: they predate decision D15.

---

## Where things live

Living under `src/` does not make a module client-side. Per hard constraint 12, the generation path is server-only and must not enter the Vite browser bundle. The `[server]` and `[client]` tags below are load-bearing.

```
src/data/schema.ts        [shared: types only] Upstream contract. DO NOT EDIT. CODEOWNER-pinned.
                          Types are shared; a populated TwinMetrics is server-side only.
src/data/proposals.ts     Proposal types. New. Yours. [shared: types only]
src/data/sources/         Evidence corpus, segregated by licence. [server]
src/proposals/rules/      One rule per file. Registry pattern, like ANATOMY_SOURCES. [server]
src/proposals/engine.ts   Deterministic. No model. [server]
src/proposals/generate.ts The only file that talks to a model. [server]
src/proposals/validate.ts Hard schema validation. Mirrors assertTwinMetrics(). [server]
src/proposals/lexicon.ts  Banned-term linter. CODEOWNER-pinned. [server; also a build-time
                          check over static UI copy via lint:claims]
src/proposals/safety.ts   Pre-model gate. Fixed responses, never generated. [server]
src/scene/                Parent's. Touch AtlasBody.tsx carefully, see traps. [client]
src/ui/ProposalsPanel.tsx New. Right rail. Copy StructurePanel's chrome exactly. [client:
                          receives RenderedProposal objects, never TwinMetrics]
eval/                     Objective benchmark, adversarial slice, judge panel.
INTENDED_PURPOSE.md       Highest-risk file. Regulatory-impact note on any change.
docs/PRIVACY.md           DPIA, consent design, retention, transfer analysis.
docs/CLINICAL_REVIEW.md   Named reviewer per rule. Registry refuses to load without.
docs/EVIDENCE_CORPUS.md   Source licences and retrieval dates.
```

---

## Conventions to follow, taken from the parent

The parent's code culture is unusually good and worth matching rather than replacing.

- **Comments explain the decision, not the mechanics.** Every non-obvious field in `store.ts` carries a JSDoc block saying *why*, and several carry warnings about what would be wrong. Do the same.
- **The store is one flat slice with no middleware.** No `persist`, no `devtools`, no `immer`. Add fields to `TwinState`, actions at the bottom, derived hooks exported at the very bottom following `useResolvedAnatomyMode`.
- **Subscribe with one `useTwin((s) => s.field)` per field.** Never destructure, never `shallow`.
- **Registries over conditionals.** `ANATOMY_SOURCES` and `ORGAN_OVERLAYS` are `Record<Id, T>` consts rendered by mapping, so adding an entry needs no UI change. Rules and sources follow the same shape.
- **Refuse rather than guess.** `referenceInterval()` upstream refuses to construct without a source URL; `systemWeighting()` refused without a named clinical reviewer; `assertTwinMetrics()` throws on a fabricated score. The rule registry refuses to load an unreviewed rule for the same reason.
- **Generated documents are not hand-edited.** `docs/LICENCE_LOG.md` and `docs/ONTOLOGY_MAP.md` come from scripts. If a table is wrong, fix the script or the asset. `docs/EVIDENCE_CORPUS.md` joins that list.
- **Panel chrome:** `rounded-3xl border border-line bg-panel p-4 backdrop-blur-panel`, headings `text-sm font-semibold text-ink`, dividers `border-t border-line pt-3`, captions `text-[10px] uppercase tracking-wide text-muted`, accent `#4f9c84`.

---

## Two things the parent does not have and this fork must

**Tests.** The parent has zero. CI runs `lint` and `build` only. A proposals layer without tests is not shippable, and the deterministic stages are cheap to test. `vitest`, added in task T5.

**Accessibility.** The parent has `aria-pressed` on toggles and essentially nothing else: no focus styles at all, no keyboard access to the canvas, no live region, no `prefers-reduced-motion`. For an anatomy viewer that is a gap. For a health product it is a defect, and the proposals panel must be a **complete, self-sufficient DOM surface**, because iOS ignores `<canvas>` for VoiceOver entirely.

---

## Say the limitation out loud

The flagship paper in this field states, verbatim:

> "We make no claim as to the effectiveness of these insights for helping real users understand their data, facilitating behavior changes, and ultimately improving health outcomes."

> "Although our annotators have significant familiarity with the Google wearable ecosystem and Python data analysis, we did not employ health experts to assess the domain-specific validity of PHIA's recommendations."

(Both are from section 7, Limitations, of arxiv.org/html/2406.06464v3. Quote them exactly; do not paraphrase them into a blockquote.)

An open-science foundation that says the same about its own system, on its landing page, is more credible than every commercial competitor. It costs nothing but candour, and candour is the one resource this project has more of than Google does.
