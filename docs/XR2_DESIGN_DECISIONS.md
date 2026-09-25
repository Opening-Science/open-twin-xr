# XR-2 design decisions

Status: defaults approved by Martin on 25 September 2026, with the amendments
recorded below. This document defines semantics and tests only. It does not
authorize XR-2 implementation while PR #18 remains unmerged.

Scope is governed by
[D27](DECISIONS.md#d27--research-and-wellness-interpretation-ui-is-in-scope):
this repository may present supplied scoring and interpretation states for
research and wellness purposes, but it does not perform health interpretation
in a medical sense.

Contract source reviewed: `interpretation-contract.v0.2` at PR #18 head
`817e7e353dc2544226c6560b863c4db1e37279f7`.

## 1. Contract summary

### SystemId

JSON path: `#/$defs/SystemId/enum`

> `musculoskeletal | cardiovascular | nervous | respiratory | metabolic | digestive | endocrine | integumentary | reproductive`

The enum is closed. XR consumes these nine identifiers and must not add a tenth.

### Severity

JSON path: `#/$defs/Severity/enum`

> `none | borderline | mild | moderate | marked | indeterminate`

JSON path: `#/$defs/Severity/description`

> Ordinal severity (D-i). Not a float — a float implies a calibration the rules do not have.

Severity is categorical and must never be converted into the existing numeric
0–10 metric.

### Confidence

JSON path: `#/$defs/SystemState/properties/confidence/description`

> RULE-SUPPORT in [0,1], defined as completeness × recency × rule_strength. This is NOT a probability of disease and must not be rendered as risk.

JSON path: `#/$defs/UnrenderableState/properties/confidence/description`

> RULE-SUPPORT in [0,1] — completeness × recency × rule_strength; NOT probability of disease (D-j).

Confidence describes support for the rule result. It is not a likelihood, risk,
severity, score or clinical probability.

### Contributor status

JSON path: `#/$defs/ContributorStatus/enum`

> `present | missing | stale | no_reference_interval | unit_incommensurable`

JSON path: `#/$defs/SystemState/properties/contributing/description`

> Every marker the rule read, INCLUDING missing ones (D-k).

Missing and unusable inputs remain visible evidence; they are not silently dropped.

### Unrenderable reason

JSON path: `#/$defs/UnrenderableReason/enum`

> `no_system_id_upstream | not_anatomical | system_excluded_upstream`

JSON path: `#/properties/unrenderable/description`

> States that must not be painted onto anatomy. Never drop; never reroute into a neighbouring SystemId (D-g).

## 2. Decision table

In this document, **Agent A** is an LLM-based recommendation tool acting in an
advisory role; Martin decides.

| Decision | Options (2–3, concrete) | Recommended default | Invariant it must satisfy | Who decides |
|---|---|---|---|---|
| a. Severity palette or texture | 1. A violet ordinal family with increasing saturation plus texture redundancy. 2. Texture-only categories over one neutral base colour. 3. Several categorical hues explicitly excluding traffic-light red, amber and green. | Use a violet ordinal family with a distinct texture for every category. Select exact tokens only after desktop, greyscale and headset contrast checks. | Interpretation must be visibly distinct from the existing 0–10 blue-grey ramp. It must not use red/amber/green traffic-light semantics, and it must remain distinguishable without hue. | Martin |
| b. Rendering severity `none` | 1. Pale violet with a fine dot texture and label `No interpreted severity`. 2. Outline only with no filled state colour. 3. The first step of the severity family with a persistent `none` label. | Use a dedicated pale-violet fine-dot token with the visible label `No interpreted severity`. | `none` must be recognisable as a rule result, not as healthy, all-clear, absent data or insufficient input. | Martin |
| c. Rendering `indeterminate` | 1. Neutral-violet crosshatch with label `Indeterminate`. 2. Alternating stripe texture with no ordinal placement. 3. Outline plus an `Indeterminate` badge in the panel only. | Use neutral-violet crosshatch plus the visible label `Indeterminate`; do not place it on the ordinal lightness sequence. | `indeterminate` must not look like `none`, a midpoint severity, or missing data. | Martin |
| d. Rendering `sufficient_data: false` | 1. Existing warm no-data hatch plus text `Not enough input data` and the supplied reason. 2. Double hatch with lower opacity and reason text. 3. No anatomy fill, with panel-only reason. | Use the existing warm no-data hatch plus `Not enough input data` and show `insufficient_reason` in the detail surface. This state overrides the severity token. | Insufficient input must never look like `none`, a measured severity or reassurance. Its reason must remain available. | Martin, with Agent A confirming contract semantics |
| e. Systems absent from `states[]` | 1. Render exactly as the no-data token and add an evidence-card note. 2. Render as no data and emit a console warning. 3. Use a separate `Not supplied` visual. | Render identically to no data and add `No interpretation state supplied` to the evidence card; anatomy must use the same no-data token. | Absence must never become a value, a severity or a healthy default. Because the contract normally emits insufficient states, an omission must also be surfaced rather than silently normalised. | Martin |
| f. Confidence display | 1. Hide confidence everywhere. 2. Show a decimal in details as `Rule support: 0.62`. 3. Show categorical `Rule support: low / medium / high` bands defined upstream. | Hide confidence entirely in v1; do not encode or display it on anatomy or in details. | Never call confidence risk, probability or likelihood; never show it as a percentage; never map it to colour, opacity, glow or severity. | Martin |
| g. FMA-to-atlas joining | 1. Exact `fma_id` match against the atlas, with the curated bridge used only to check an optional `uberon_id`. 2. Exact FMA match followed by an upstream-approved hierarchy walk. 3. Direct optional UBERON fallback. | Place the state on an exact `fma_id` match against the atlas. Use the curated bridge only to check that `uberon_id`, if present, agrees; never drive placement from UBERON. No match creates a visible unrenderable row. | Never choose a nearest structure, neighbouring system, name similarity or reverse UBERON→FMA guess. An absent FMA match must remain explicit, and an optional UBERON disagreement must be surfaced without changing placement. | Martin and Agent A |
| h. Third colour mode vs separate view | 1. Add `interpretation` as a third colour mode. 2. Add a dedicated Interpretation view using the same scene. 3. Overlay interpretation tokens on anatomical mode. | Implement D27 with a dedicated Interpretation view that reuses the scene but has separate controls and is mutually exclusive with numeric metrics mode. | Numeric metrics and categorical interpretation must never share a legend, blend, or imply a conversion between contracts. The view must remain within D27's research/wellness boundary. | Martin |
| i. `unrenderable[]` panel | 1. Persistent right-rail card with count and expandable rows. 2. Persistent bottom drawer. 3. Count badge opening a modal. | Use an always-mounted right-rail card headed `Evidence not placed on anatomy`, showing the count even when zero and listing label, reason and contributor status when non-zero. | Unrenderable evidence must always remain discoverable, must never be silently dropped, and must never be painted onto anatomy. `subject_ref` must not be shown. | Martin |
| j. Research-use footer wording | 1. `Research-use visualisation only. This viewer renders supplied interpretation states and does not provide medical advice.` 2. `For research and education. Supplied interpretation states are shown without recommendations.` 3. `Research display only. This viewer shows upstream states and does not evaluate or recommend actions.` | Use option 1, approved by Martin, provided `npm run lint:claims` passes. | The footer must be persistent in Interpretation view, pass claim lint, avoid the banned word used in the contract field name, and make no medical-purpose or reassurance claim. | Martin |

## 3. What XR-2 will not do

XR-2 will not:

- convert ordinal severity into the existing 0–10 score;
- render confidence as risk, probability, likelihood or a percentage;
- encode confidence through anatomy colour, opacity, glow or severity;
- render an absent state or insufficient input as healthy, fine or all-clear;
- hide, discard or silently suppress `unrenderable[]`;
- reroute unrenderable evidence to a neighbouring or nearest system;
- add, infer or alias a tenth `SystemId`;
- use LOINC's specimen System axis as anatomy;
- perform FHIR scoring or clinical interpretation in the browser;
- call live vendor APIs from XR;
- import packages or runtime types across repositories;
- display `subject_ref` as a name or identifier;
- change the existing TwinMetrics demo contract in the same PR;
- combine XR-2 with OpenSplat, World Labs or unrelated rendering work.

## 4. XR-2 acceptance tests

- Severity styling: every severity token is distinct from the existing blue-grey metric ramp, avoids red/amber/green traffic-light semantics, and remains distinguishable in greyscale.
- `none`: severity `none` uses the dedicated measured-none token and label, and is visually different from no data and insufficient input.
- `indeterminate`: `indeterminate` uses its non-ordinal crosshatch and label, distinct from `none`, measured severities and no data.
- Insufficient input: every `sufficient_data: false` state uses the no-data treatment regardless of severity and exposes `insufficient_reason`.
- Absent state: a canonical system omitted from `states[]` produces exactly the same anatomy style as no data, never receives a default severity, and creates a visible `No interpretation state supplied` evidence-card note.
- Confidence: confidence is absent from v1 anatomy, details, labels and legends, and anatomy output is identical for confidence `0`, `0.5` and `1`.
- Geometry join: an exact atlas `fma_id` match places the state; an unmatched FMA creates a visible unrenderable row; optional UBERON is checked only for agreement, never drives placement, and disagreement is surfaced without relocating the state.
- View separation: Interpretation and numeric metrics are mutually exclusive, have separate legends, switching views performs no severity-to-score conversion, and Interpretation view contains no affordance outside D27's research/wellness boundary.
- Unrenderable panel: the panel is always present in Interpretation view, shows a zero count when empty, lists every supplied unrenderable group when populated, and paints none of them onto anatomy.
- Research footer: footer option 1 is persistently present in Interpretation view and `npm run lint:claims` reports zero errors and warnings for its copy.

## 5. Current viewer audit

One current user-facing string violates the proposed non-traffic-light invariant:

- `src/ui/StructurePanel.tsx:118` describes numeric metrics as `red to green`, although the implemented metric ramp is sequential blue-grey. XR-2 must correct this stale tooltip in its own focused implementation PR.
- `src/store.ts:330` repeats `red/amber/green` in an internal comment. It is not user-facing, but should be corrected alongside the tooltip so documentation matches behavior.

The current renderer does not fabricate a value for an absent TwinMetrics system:

- `src/scene/AtlasBody.tsx:1116-1123` resolves a missing system entry to `score = null` and classifies it as unresolved or no data.
- `src/scene/AtlasBody.tsx:1171-1172` applies the no-data opacity treatment rather than a numeric value.
- `src/scene/metricColor.ts:101-109` maps `null` to the dedicated no-data colour rather than onto the 0–10 ramp.
- `src/scene/metricColor.ts:97-98` provides the non-value hatch used by DOM swatches.

Therefore the existing absence behavior is compatible with XR-2's invariant; the stale traffic-light tooltip is the only current violation identified in this read-only audit.
