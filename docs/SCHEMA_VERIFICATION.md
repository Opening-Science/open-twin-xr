# Schema verification: open-twin -> TwinMetrics -> HRA

Verified 26 July 2026 by reading the actual `etzm/open-twin` working tree
(`OpenTwin_Private`), not by assumption. Read this before implementing the
adapter: **the scaffold's data contract is based on a wrong premise and must
change.**

## What open-twin actually is

A **pnpm monorepo of health-data connectors that translate vendor APIs into FHIR
R4 bundles**. MIT licensed, owned by Opening-Science, developed under the Open
Science Foundation.

| Package | Source |
|---|---|
| `@open-twin/fhir-core` | Shared FHIR building blocks, terminology, unit policy, reference ranges |
| `@open-twin/provider-oura` | Oura Ring v2 API |
| `@open-twin/provider-google-health` | `health.googleapis.com/v4` (next-gen Fitbit Web API, **not** Health Connect) |
| `@open-twin/provider-vitronic` | VITRONIC **BodyLoop** body scanner |
| `fhir-r4`, `hl7v2`, `genomics-vcf`, `provider-open-wearables` | Additional format/provider packages |

## Finding 1 (critical): open-twin does not produce scores

`TwinMetrics` in the scaffold assumes open-twin supplies per-system scores
(0-10), an overall score (0-100), a biological age and a cardiovascular age.
**It supplies none of these.** It emits `Bundle` resources containing FHIR
`Observation`s carrying raw measurements with LOINC/SNOMED or vendor-local codes
and UCUM units.

Consequence: **a scoring layer has to be built, and it does not exist yet.**
Where it lives is a genuine decision, not a detail:

- **Option A (recommended): a new `@open-twin/scoring` package upstream.**
  Scoring is a health-domain concern, it is reusable beyond this viewer, and it
  belongs next to the terminology and reference-range machinery it depends on.
- **Option B: a `src/scoring/` module in this repo.** Faster, but it buries
  clinical logic inside a rendering app and makes it unreusable.

Either way the scoring rules and their provenance must be written down, because
aggregating biomarkers into a "cardiovascular score of 7" is a clinical
judgement, not a technical one. `open-twin/DECISIONS.md` already insists on a
named clinical reviewer for weaker claims than this.

**Good news:** `@open-twin/fhir-core/referenceRange.ts` is the honest foundation.
It attaches reference intervals to the Observation (0..*, distinguished by
`type`: `normal`, `recommended`, `treatment`, `pre`) and carries a mandatory
source URL and publisher in a declared extension. Value-versus-interval is a
defensible basis for a score; inventing thresholds is not.

## Finding 2: transport is a library, and it must stay server-side

Not a static JSON file and not an HTTP API. The connectors are libraries; bundle
entry points return `{ bundle, issues }` where `issues` is a FHIR
`OperationOutcome` (D6).

> **Correction, second verification pass.** This finding originally read that the
> connectors are *stateless*, with token and cursor persistence delegated to host
> `TokenStore` / `CursorStore` interfaces (D8). Both halves are wrong, and D8 is
> the source of the error — it describes an intended design that was never built.
> `TokenStore` and `CursorStore` appear **exactly once in the entire upstream
> repository: in the prose of `DECISIONS.md`.** There is no interface, type, or
> implementation. In reality Oura, Google Health and VITRONIC each hold mutable
> in-process token state, and Oura's `TokenHandler` keeps `tokenContainer`
> private with no getter, so refreshed tokens cannot be persisted through any
> supported API. Only `@open-twin/open-wearables` is genuinely stateless, because
> it performs no I/O. Also corrected: the `{ bundle, issues }` shape is not
> uniform — Google Health adds a non-optional `unmapped: string[]`. Full detail
> in `ARCHITECTURE.md` section 1.

Consequence: **the connectors hold vendor API credentials and must never run in
the browser.** A server or serverless function runs open-twin, scores the
bundle, and serves the viewer a small `TwinMetrics` JSON. This preserves the
architecture rule already in the spec: the browser is a pure renderer.

## Finding 3: Vitronic is BodyLoop (posture geometry), not VITUS (surface scan)

This corrects an assumption in `docs/PLANNING_REPORT.md` and
`HANDOVER_SPEC.md`, which described a VITUS laser scanner producing a point
cloud plus Anthroscan measurements.

`provider-vitronic` targets **VITRONIC BodyLoop**, whose API scopes are
`angle`, `distance`, `marker`, `axis`, `cross_section`, `height`, `properties`,
over `/api/v2/viatars/{id}/...`. That is **posture and body-geometry analysis**:
joint angles, body axes, cross-sections, surface markers, heights. Not a dense
surface point cloud.

Two consequences:

1. **Musculoskeletal is the best-evidenced system in the whole dataset**, driven
   by real joint-angle and posture measurements. It should be treated as a
   first-class system, not an afterthought.
2. **The Phase 2 "shell layer" premise needs revisiting.** BodyLoop does not
   obviously yield a renderable body surface. However, the client exposes
   `MODELS: /api/v2/viatars/{id}/models/` and `MODEL: .../models/{name}`, which
   is **not currently mapped by any FHIR mapper**. Investigate whether that
   endpoint returns 3D geometry before designing the shell layer. If it does not,
   the shell stays parametric/procedural and Phase 2 is re-scoped.

Also note `D10`: the BodyLoop API returns **radians**, converted to degrees by
the mappers. `marker.normal` is a dimensionless direction vector (UCUM `1`), not
an angle.

## Finding 4: the committed snapshot is stale, do not code against it

`provider-vitronic/src/tests/integration/__snapshots__/bundleBuilder.integration.test.ts.snap`
shows output that predates the remediation recorded in `DECISIONS.md`:

- `"subject": { "reference": "Scan/scan-1" }` — `Scan` is not a FHIR resource
  type; D1 replaces this with a caller-supplied `subject` or a `urn:uuid:`
  fallback plus a `Patient` entry.
- `"system": "https://www.vitronic.com/bodyloop/measurements"` — D3 replaces
  vendor URLs with `http://opentwin.ch/fhir/CodeSystem/vitronic`.
- `"value": 1.4816... , "unit": "degree"` — this is the exact
  radians-labelled-as-degrees defect D10 fixes (an 84.9° angle published as
  1.48).

**Code the adapter against `DECISIONS.md` (the target state), then verify against
freshly generated bundles.** open-twin's own `CLAUDE.md` warns that a green test
run is not evidence of correctness, because several tests asserted the defects as
intended behaviour.

## Finding 5: the system-to-data-to-HRA mapping

The anatomy side is **not** the bottleneck. HRA v2.3 provides **73 reference
organs with 1,283 3D anatomical structures**, with male and female variants,
including heart, lung, brain, kidney, intestine, skin, spleen, lymph node and
retina. HRA can cover essentially every system we care about.

**The bottleneck is the data side.** Several systems in the scaffold's sample
data have no connector producing them at all:

| SystemId | Data in open-twin today? | Source | HRA organ available? | Verdict |
|---|---|---|---|---|
| `cardiovascular` | **Yes, strong** | Oura: `cardiovascular`, `heartrate`, `vo2max`, `spo2` | Yes (heart, vasculature) | **Ship in Phase 1** |
| `musculoskeletal` | **Yes, strong** | Vitronic BodyLoop angles/axes/cross-sections; Oura `workout`, `daily` | Partial (verify bone/muscle coverage) | **Ship in Phase 1** |
| `respiratory` | Partial | Oura `spo2`, respiratory rate | Yes (lung) | Ship, clearly caveated |
| `nervous` | **Proxy only** | Oura `sleep`, `stress`, `resilience`, `readiness` | Yes (brain) | Ship only if relabelled, see below |
| `metabolic` | Partial | Oura `vo2max`, `daily`; Google Health glucose (code unresolved, see DECISIONS) | Yes (liver, pancreas) | Ship, clearly caveated |
| `digestive` | **No data** | none | Yes (intestine) | **Do not ship** |
| `endocrine` | **No data** | none | Yes (thyroid, pancreas, adrenal) | **Do not ship** |
| `reproductive` | **No data** | none | Yes | **Do not ship** |
| `integumentary` | **No data** (skin temp deviation at best) | Oura temperature deviation (vendor-local code) | Yes (skin) | **Do not ship** |

The scaffold's `public/data/sample-twin.json` shows `Digestive 10`,
`Reproductive 9` and `Endocrine 8`. **Those numbers cannot be derived from any
connector that exists.** Shipping them would display invented health scores to a
user, which is precisely the failure mode the non-diagnostic guardrail exists to
prevent. Either drop those systems from the UI, or render them explicitly as
"no data connected" rather than as a score.

**On `nervous`:** sleep, stress and resilience are not nervous-system
measurements. Colouring a brain by a sleep score implies a claim the data does
not support. Either relabel the system to something honest such as
`sleep_recovery`, or keep `nervous` but state in the UI that it is derived from
sleep and recovery proxies.

**On `cardiovascular age`:** available from Oura as *vascular age*, but
`DECISIONS.md` records that it has **no standard LOINC or SNOMED concept**
(verified twice) and uses a vendor-local code pending clinical sign-off.
**Biological age is not produced by any connector** and would be a derived metric
this project invents. Treat both accordingly in the UI.

## Required changes to this repository

**All six are now applied.** Kept as a record of what the verification demanded.

1. ~~**`src/data/schema.ts`**~~ **DONE** — `hasData: boolean`, `provenance`,
   `proxy`, `structures` and `DerivedValue` are in the contract (v0.2.0), and
   the UI renders "no data" as a first-class state.
2. ~~**`public/data/sample-twin.json`**~~ **DONE** — digestive, endocrine,
   reproductive and integumentary carry `hasData: false, score: null`. The file
   stays fictional.
3. ~~**`src/data/adapter.ts`**~~ **DONE**, and the function was renamed:
   the seam is **`fromFhirBundle()`**, not `fromOpenTwin()`. It consumes a FHIR
   R4 Bundle server-side and is deliberately unimplemented rather than faked.
4. ~~**Add the scoring decision**~~ **DONE** — `HANDOVER_SPEC.md` section 5a,
   flagged blocking, Option A recommended.
5. ~~**`docs/PLANNING_REPORT.md` and `HANDOVER_SPEC.md`**~~ **DONE** — both
   corrected to BodyLoop/posture-geometry, and Phase 2 is re-scoped and gated on
   the `/models/` endpoint investigation (open question 4).
6. ~~**`docs/MODEL_PIPELINE.md`**~~ **DONE** — retargeted to HRA with the
   ontology-ID join. Note the 73 organs / 1,283 structures figure remains
   *unverified against the release itself* (see below); the pipeline doc repeats
   that caveat rather than presenting it as confirmed.

## What I could not verify

- **The exact HRA per-organ file list** for the current release. The HRA portal
  is client-rendered and returned no content to a server-side fetch. The 73
  organs / 1,283 structures figure comes from the peer-reviewed *Scientific
  Data* paper, not from enumerating the release. Confirm musculoskeletal (bone
  and muscle) coverage specifically before relying on it.
- **Whether `/api/v2/viatars/{id}/models/` returns renderable 3D geometry.** No
  FHIR mapper consumes it, so its payload shape is unknown from the code alone.
- **Google Health's glucose units** (LOINC 2339-0 mass vs 15074-8 substance
  concentration), which `DECISIONS.md` lists as open and unrecorded.

## Sources

Primary: the `etzm/open-twin` working tree read directly — `CLAUDE.md`,
`DECISIONS.md`, `packages/fhir-core/src/referenceRange.ts`,
`packages/provider-vitronic/src/config/constants.ts`, the provider mapper
directories, and the committed integration snapshot.

External: [Cell Type Populations for 3D Anatomical Structures of the Human
Reference Atlas, *Scientific Data*](https://www.nature.com/articles/s41597-026-06642-4);
[HuBMAP 3D Human Reference Atlas construction and usage, *Nature
Methods*](https://www.nature.com/articles/s41592-024-02563-5);
[HuBMAP CCF 3D Reference Object Library](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html).
