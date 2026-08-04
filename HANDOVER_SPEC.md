# Open Twin XR - Handover Specification

Authoritative build spec for Claude Code. Prepared 26 July 2026, revised after
schema verification. This document supersedes and extends `CLAUDE.md`,
`docs/ARCHITECTURE.md` and `docs/DATA_CONTRACT.md` where they differ; read those
for detail, read this for the plan, the constraints, and the order of work.

> **Revision note.** `docs/SCHEMA_VERIFICATION.md` records what the real
> `etzm/open-twin` tree actually contains, read directly rather than assumed. It
> overturned two premises in the first draft of this spec: open-twin emits raw
> FHIR Observations and **no scores at all**, and the VITRONIC connector targets
> **BodyLoop (posture geometry)**, not a VITUS surface scanner. Read that file
> before this one. Sections 1, 3 and 5 below are corrected accordingly.

**Where open-twin lives.** This spec cites `open-twin/DECISIONS.md` and
`@open-twin/fhir-core` as authorities. They are in a separate repository, not
vendored here: <https://github.com/etzm/open-twin> (canonical upstream:
<https://github.com/Opening-Science/open-twin>). Clone it separately to follow the
references below. `DECISIONS.md` is at its root and
`referenceRange.ts` at `packages/fhir-core/src/`.

## 0. What you are building, in one paragraph

An open-source, web-first 3D human-body **health digital twin**. A person's
health is shown as an interactive 3D body: organ systems are colored by a health
score, surrounded by the dashboard from the product mockups (biological and
cardiovascular age, an overall score ring, a trend chart, a per-system score
list, connected data sources, and a visual-only AI bubble). Data comes from the
`etzm/open-twin` project. The same 3D scene is WebXR-ready, so it can be entered
immersively on a headset through the device OpenXR runtime. The AI layer is out
of scope for this repository.

## 1. The twin is three layers, not one model

Do not think of HRA, MRI and the Vitronic scan as competing model choices. They
are complementary layers of one twin, each optional, each degrading gracefully:

1. **Shell layer (outer body surface).** Rendered translucent, this is the
   frosted body in the mockup. The VITRONIC connector targets **BodyLoop**,
   which measures posture geometry (joint angles, axes, cross-sections, markers,
   heights) — but it **will also produce renderable geometry** via its unmapped
   `/api/v2/viatars/{id}/models/` endpoint (confirmed by the product owner;
   payload format still to establish). That work is **deferred to a later
   phase**. Until then the shell is the procedural silhouette already in the
   repo, or a parametric body (MakeHuman/MPFB2, CC0), and the twin runs on
   mockup data.
2. **Interior layer (organs).** Either **patient-specific** organs segmented
   from **MRI**, or the **HRA reference atlas**. This is what gets coloured by
   score. HRA v2.3 provides 73 reference organs / 1,283 anatomical structures,
   so anatomy coverage is not the constraint.
3. **Data layer (scores and metadata).** `open-twin` supplies **raw FHIR
   Observations**, not scores. A scoring step (section 5a) turns them into
   per-system scores. BodyLoop posture data makes **musculoskeletal** the
   best-evidenced system in the whole dataset.

Every layer resolves to the same two outputs the viewer already consumes: a
`TwinMetrics` object and a GLB. The viewer never learns which source
produced them.

## 2. Design decisions (ratified) and risks (own these)

Ratified: web-first React + three.js + `@react-three/xr`; placeholder-first
geometry; the single `TwinMetrics` contract with one adapter; **HRA (CC BY
4.0) as the anatomy model**, joined on ontology IDs rather than mesh-node name
strings.

**Anatomy source decision (26 July 2026): HRA by default, Z-Anatomy registered
but not adopted.** The atlas is a swappable source rather than a hardcoded
assumption — `src/scene/anatomySources.ts` holds a registry, per-system
composition table, and mode switch, so changing atlas is configuration, not a
refactor. Z-Anatomy is registered and the UI can switch to it for visual
comparison, but **nothing defaults to it**, for three reasons:

- Z-Anatomy is better than HRA in exactly **one** respect — whole-body skeletal
  and muscular geometry inherited from BodyParts3D. That respect matters, since
  musculoskeletal is one of the two best-evidenced systems. But whether HRA
  actually falls short there is **unverified** (open question 3).
- Adopting it attaches **CC-BY-SA share-alike** permanently to the derived
  asset, which is the obligation choosing HRA was meant to avoid.
- `SystemScore.structures` carries **UBERON**; BodyParts3D is **FMA**-keyed, so
  Z-Anatomy needs a UBERON->FMA crosswalk that does not exist. Its misses fail
  silently as missing geometry rather than as errors. Two atlases of different
  vintage also risk looking like a collage.

Settle open question 3 against the real HRA release first. If HRA's bone and
muscle coverage is genuinely thin, flipping `musculoskeletal` to `'z-anatomy'`
in `COMPOSED_SOURCE` is a one-line change and the machinery already handles the
licence separation.

Risks you must actively manage:

- **Scope.** Ship Phase 1 (reference atlas + open-twin data) before building any
  patient-specific layer. Do not build MRI or Vitronic ingest until Phase 1 is
  green and merged.
- **Registration.** Cross-source alignment into one coordinate frame is the
  hardest part of Phases 2 and 3. See section 6. Where organs are not measured
  from the person's own imaging, the twin MUST label them as an estimate.
- **Compliance.** MRI and body scans are GDPR Article 9 special-category data.
  Non-diagnostic framing only, unless a regulated-device pathway is chosen
  deliberately. See section 8.
- **HRA coverage.** HRA is curated (organ-scale), not an exhaustive whole-body
  atlas. Verify every `SystemId` in the live open-twin data has a corresponding
  HRA reference object before relying on it (section 9, open question 2).

## 3. Phased delivery plan

Build in this order. Each phase is independently shippable and testable.

### Phase 0 - Repo up (done)
Scaffold exists, builds, and renders the mockup on placeholder anatomy. First
action: create the public GitHub repo `open-twin-openXR`, push, get CI green
(commands in `CLAUDE.md`).

### Phase 1 - MVP: reference twin (this is the original ask)
- **Blocking first:** settle the scoring decision (section 5a). Nothing else in
  Phase 1 can be finished without it.
- Wire real `open-twin` data through `src/data/adapter.ts` into `TwinMetrics`.
  This means consuming a **FHIR R4 Bundle** and scoring it server-side, not
  reading a pre-scored payload.
- Ship only the systems that have data: **cardiovascular** and
  **musculoskeletal** (strong), **respiratory** and **metabolic** (partial,
  caveated), **nervous** (proxy-flagged). Render digestive, endocrine,
  reproductive and integumentary as "no data". Do not invent scores.
- Replace the procedural organs with the **HRA** GLB. Load with `useGLTF`, and
  color each structure by its system score, resolving structures via ontology
  IDs (section 5).
- Keep the dashboard, selection, trend chart, connected sources, and the WebXR
  enter button as they are.
- Definition of done: real scores flowing, HRA organs colored and clickable, CC
  BY attribution shown in-app, CI green, runs in the Quest browser via WebXR.

### Phase 2 - Shell layer: BodyLoop-informed body surface
**Confirmed but deferred.** Open question 4 is resolved: BodyLoop *will* produce
renderable geometry, so the shell has a real source. The product owner has
deferred this to a later phase — **until it is picked up, the twin runs on mockup
data and the procedural silhouette.** Do not start it before Phase 1 is green.

When it is picked up:

- Add a server-side ingest for the BodyLoop geometry that produces a cleaned,
  watertight, translucent body-shell GLB (metres, Y-up, pelvis-root origin) plus
  an anthropometrics table. Establish the `/models/` payload format first — no
  FHIR mapper consumes that endpoint today, so this is new work.
- Where the shell is fitted rather than measured — including the
  MakeHuman/MPFB2 (CC0) parametric fallback driven by BodyLoop heights,
  cross-sections and axes — it is an *estimate* and must carry
  `measured: false`.

Either way:
- Feed the BodyLoop measurements into the data layer as additional inputs to the
  musculoskeletal and metabolic scores. This is the part that pays off
  regardless of how the geometry question resolves, because BodyLoop posture
  data makes musculoskeletal the best-evidenced system in the dataset.
- Add a shell/no-shell mode switch. Fallback stays the silhouette.
- Definition of done: a body shell derived from a real subject's BodyLoop data
  renders with HRA organs inside it, correctly scaled, in the same frame, and
  the UI states plainly whether that shell was measured or estimated.

### Phase 3 - Interior layer: patient-specific MRI
- Add a server-side imaging pipeline: DICOM/NIfTI in, auto-segment organs, mesh
  them, export per-organ GLB tagged to anatomy IDs (section 7).
- Add a "reference vs patient" interior mode and the measured/estimated flag.
- Register the MRI organs into the shell (section 6).
- Definition of done: for a subject with both a scan and an MRI, patient organs
  sit correctly inside the patient shell, flagged as measured.

### Phase 4 - WebXR interaction polish
- Ray-select organs in-headset, an in-VR info panel, comfortable scale and
  placement. Same scene, no second renderer.

### Out of scope (do not build here)
The AI chatbot stays a visual stub. Any LLM integration is a separate,
deliberate decision in a different repo.

## 4. Architecture boundaries

- **Browser does rendering and interaction only.** three.js/R3F scene, dashboard
  UI, WebXR entry. No heavy geometry or model-fitting in the browser.
- **All heavy work is server-side preprocessing** that emits a GLB plus
  `TwinMetrics`. Segmentation, reconstruction, parametric fitting, and
  registration all live here.
- **One adapter is the only code that knows upstream shapes** (`src/data/
  adapter.ts`). Sources: open-twin (data), Vitronic (shell + measurements), MRI
  (interior). Each maps into the same contract.

## 5a. The scoring decision (BLOCKING - settle before building Phase 1)

open-twin emits raw FHIR `Observation`s. Nothing produces the 0-10 per-system
scores, the 0-100 overall score, or a biological age. A scoring layer must be
built. Where it lives is a real decision:

- **Option A (recommended): a new `@open-twin/scoring` package upstream.**
  Scoring is a health-domain concern, reusable beyond this viewer, and belongs
  beside the terminology and reference-range machinery it depends on.
- **Option B: `src/scoring/` in this repo.** Faster, but buries clinical logic
  in a rendering app and makes it unreusable.

Whichever is chosen, the basis must be
`@open-twin/fhir-core/referenceRange.ts`: typed reference intervals (`normal`,
`recommended`, `treatment`, `pre`) each carrying a mandatory source URL and
publisher. Value-against-interval is defensible; invented thresholds are not.
Aggregation weights across biomarkers are a **clinical judgement** and need a
named reviewer, exactly as `open-twin/DECISIONS.md` already requires for weaker
claims.

Two values need explicit handling: **cardiovascular age** exists in Oura as
"vascular age" but under a vendor-local code with no standard LOINC or SNOMED
concept, and **biological age** is not produced by any connector at all. Both
are modelled as `DerivedValue` with a caveat in `src/data/schema.ts`.

## 5. Data contract and conventions

The viewer reads only `TwinMetrics` (`src/data/schema.ts`). Extend it, do not
bypass it.

Additions for the multi-source design:

**Already implemented** in `src/data/schema.ts` (v0.2.0):

- Organ-to-system mapping uses **ontology IDs** (`AnatomicalStructure`), not
  mesh-node name strings, e.g. `{ id: "UBERON:0002107", label: "liver" }`. HRA
  structures carry ASCT+B / UBERON / FMA terms, so the join survives model swaps.
- `SystemScore.score` is `number | null`, with `hasData: boolean`. **Missing data
  is not zero** - the same rule open-twin enforces with `dataAbsentReason`.
- `SystemScore.proxy` marks scores inferred from indirect signals.
- `SystemScore.provenance` records which connectors contributed.
- `Profile.biologicalAge` / `cardiovascularAge` are `DerivedValue` with an
  `available` flag and a `caveat`.
- `assertTwinMetrics()` in the adapter throws if a system has `hasData:
  false` but a non-null score, so a fabricated value cannot reach the renderer.

**Still to add for Phases 2-3:** a per-interior `provenance: "reference" |
"patient"` and `measured: boolean`, so fitted organs are never shown as imaged.

**Open product decision:** `nervous` is currently backed only by sleep, stress
and resilience. It ships with `proxy: true`; relabelling it to
`sleep_recovery` / "Sleep & Recovery" is the more honest option and is left to
the product owner.

Coordinate and unit convention (canonical world, enforced at ingest):

- **Metres, Y-up, subject facing +Z**, single shared origin (pelvis root).
- Vitronic millimetres divide by 1000. MRI: apply the DICOM/NIfTI affine, then
  reorient to Y-up metres. HRA: it is already to-scale; align its root to the
  same origin.
- Every ingest normalizes to this before export. The viewer assumes it.

## 6. Registration and coordinate frame (the hard part)

Goal: organs sit correctly inside the shell, in one frame.

- **Both scan and MRI present (best case):** register surface-to-surface. The
  MRI captures the skin boundary; ICP (Open3D or CloudCompare) aligns MRI skin to
  the Vitronic surface, then the same transform places the segmented organs.
- **Scan only (no MRI):** fit the HRA atlas into the shell by scaling and warping
  atlas organs to the person's landmarks and measurements (landmark affine or
  thin-plate-spline). Mark `measured: false`. This is an estimate, and the UI
  must say so.
- **MRI only (no scan):** use the MRI skin surface as the shell; no external
  scan to register to.
- **Neither (reference twin, Phase 1):** HRA organs in the silhouette, all
  `measured: false`.

Voxel-level image registration, if needed, uses elastix or ANTs. Keep every
transform and its provenance in the preprocessing output so results are
reproducible.

## 7. Preprocessing pipelines

All server-side, all open source, each emits GLB (metres, Y-up) plus contract data.

Imaging (MRI interior):

| Step | Tool | License |
|---|---|---|
| Ingest DICOM/NIfTI, de-identify | pydicom, nibabel, SimpleITK | MIT / MIT / Apache |
| Auto-segment organs | TotalSegmentator (CT and MR), MONAI, nnU-Net | Apache (check weights, section 9) |
| Manual/semi correction | 3D Slicer, ITK-SNAP | BSD-style / GPL |
| Label map to meshes | marching cubes (VTK, scikit-image), Slicer Segmentations | BSD / BSD |
| Meshes to web GLB | SlicerOpenAnatomy (glTF), gltf-transform + meshopt | permissive / MIT |
| Optional volume view in browser | NiiVue, VTK.js, Cornerstone3D | permissive |

Surface (shell layer) - **re-scoped, see section 1**:

| Step | Tool | License |
|---|---|---|
| Investigate BodyLoop `/models/` endpoint | n/a - unmapped upstream | - |
| Parametric shell (default path) | MakeHuman/MPFB2 (CC0) or SMPL-X (non-commercial) | see section 8 |
| Clean / retopologise if a mesh source appears | Open3D, Instant Meshes, MeshLab | MIT / BSD / GPL |
| Body geometry as DATA (not shape) | `@open-twin/provider-vitronic` angles, axes, cross-sections, heights | MIT |
| Compress and export | gltf-transform, meshopt | MIT |

Note `D10` upstream: the BodyLoop API returns **radians**, converted to degrees
by the mappers, and `marker.normal` is a dimensionless direction vector (UCUM
`1`), not an angle.

## 8. Licensing summary

The MVP (Phase 1) needs no paid licenses. Full detail in
`docs/COMMERCIAL_LICENSES.md`. The essentials:

- Code and web stack: MIT / Apache / BSD. No fee.
- HRA anatomy model: CC BY 4.0, attribution only, no share-alike. No fee.
- VITRONIC BodyLoop hardware and its analysis software: commercial, but owned by
  you; the measurement data is yours and the patient's, so no open-source
  conflict.
- Only two places a paid or restricted license can appear, both avoidable:
  SMPL-X for a clean parametric shell is non-commercial (use MakeHuman/MPFB2,
  CC0, instead); and some medical-segmentation model weights carry
  non-commercial or institutional clauses (verify TotalSegmentator weights for
  commercial use, section 9).
- Keep code (MIT) and any CC-licensed assets as separate works. Never bake
  model geometry into source. Show the required attribution in-app.

## 9. Open questions to resolve (checklist)

1. ~~open-twin schema.~~ **RESOLVED** - see `docs/SCHEMA_VERIFICATION.md`.
   Transport is a **library** (stateless `@open-twin/*` packages returning
   `{ bundle, issues }`), emitting **raw FHIR R4 Observations, no scores**. Must
   run server-side; the connectors hold vendor credentials.
2. **The scoring decision** (section 5a). Blocking for Phase 1.
3. ~~**HRA per-organ coverage.**~~ **RESOLVED 26 July 2026, negatively.**
   Current release is HRA v2.5 (38 organ groups, 83 GLB files, GLB only,
   CC BY 4.0). Verified by enumerating the 875 nodes of the whole-body GLB and
   the 2,295-row master crosswalk: **HRA has no ribcage, skull, clavicle,
   scapula, or any limb bone, and essentially no skeletal muscle** (no diaphragm
   either). It has the vertebral column, bony pelvis, sternum and knee, and
   excellent ontology-tagged viscera.

   **Consequence: HRA cannot render musculoskeletal**, which is one of the two
   best-evidenced systems. A second atlas is required for that system — see the
   anatomy source decision in section 2 and `docs/MODEL_PIPELINE.md`. This is a
   product/licensing decision, not an engineering one: adopting Z-Anatomy takes
   on CC-BY-SA share-alike.
4. ~~**BodyLoop `/models/` endpoint.**~~ **RESOLVED by the product owner
   (26 July 2026): BodyLoop will produce renderable geometry**, so Phase 2 has a
   real shell source. Implementation is **deliberately deferred to a later
   phase**; until then the twin runs on mockup data and the parametric/procedural
   shell. Still to establish when Phase 2 is picked up: the payload format of
   `/api/v2/viatars/{id}/models/`, and that no FHIR mapper consumes it today, so
   ingest is new work rather than a wiring job.
5. **Google Health glucose units** (LOINC 2339-0 mass vs 15074-8 substance
   concentration) - listed as open and unrecorded in `open-twin/DECISIONS.md`,
   and it gates the metabolic score.
6. **TotalSegmentator weights.** Confirm the model-weight terms for any
   commercial use before shipping Phase 3.
7. **Relabel `nervous`?** Product decision, see section 5.

## 10. Guardrails (do not violate)

- Do not build the AI layer here.
- **Do not fabricate a score for a system no connector measures.** Digestive,
  endocrine, reproductive and integumentary have no data source today. Render
  "no data". `assertTwinMetrics()` enforces this; do not weaken it.
- **Missing data is not zero.** Never default a score to 0 or to a midpoint.
- Do not run open-twin connectors in the browser. They hold vendor API
  credentials. Scoring and connector execution are server-side.
- Never put an API response body into an error message or a log. These are
  health payloads. Upstream provides `ConnectorError` for this.
- Do not put MRI, scan data, or any real patient data in the browser, in logs,
  or in sample data. Sample data stays fictional.
- Do not imply diagnosis. Non-diagnostic framing only.
- Do not present fitted or estimated organs as measured, or a proxy-derived
  score as a direct measurement. Honour the `measured` and `proxy` flags.
- Do not code the adapter against open-twin's committed test snapshots. They
  predate its remediation and encode known defects. Code against `DECISIONS.md`.
- Do not add paid dependencies without flagging first.
- Keep the browser as a pure renderer; keep heavy work server-side; keep the
  adapter the only source-aware code.

## 11. First three actions

1. ~~Create the GitHub repo and push.~~ **Done** - the repo exists and the
   scaffold is pushed. Verify CI is green.
2. **Settle the scoring decision** (section 5a). This is blocking and it is a
   clinical question as much as an engineering one.
3. Implement `fromFhirBundle()` server-side against `open-twin/DECISIONS.md`,
   then swap the HRA model in behind the existing interaction contract.

Everything else follows the phases above, in order.
