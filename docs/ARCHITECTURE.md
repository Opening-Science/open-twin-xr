# Architecture

> **Revised after reading the upstream tree.** Read `SCHEMA_VERIFICATION.md`
> first. This file previously described a direct `open-twin data -> adapter ->
> viewer` path with no server tier. That is wrong in a way that matters: the
> connectors cannot run in a browser, they emit raw Observations rather than
> scores, and there is no published package to install. Sections 0 and 1 below
> are the corrected picture, verified by reading the upstream working tree
> (<https://github.com/etzm/open-twin>).

## 0. One-line model

```
[vendor APIs]
  -> @open-twin/* connectors      SERVER-SIDE ONLY. Hold credentials.
  -> FHIR R4 Bundle of raw Observations (+ OperationOutcome)
  -> scoring step                 DOES NOT EXIST YET. Blocking. Spec section 5a.
  -> TwinMetrics JSON
  -> (HTTP) -> browser app        this repo
                -> adapter -> store -> { 3D scene, dashboard UI }
                                        + WebXR bridge, same scene graph
```

**This repository is only the last two lines.** Everything above the final HTTP
hop is a server you have to build; it does not exist in this repo and is not
importable from a browser. The viewer's whole job is to render an
already-scored `TwinMetrics` faithfully — including rendering "no data" as
"no data".

## 1. The upstream boundary (what open-twin actually gives you)

This is the part most likely to be assumed wrong, so it is stated concretely.

### It is not installable yet

- **Nothing is published to npm.** All eight `@open-twin/*` packages return
  E404 on the public registry. There are no git tags, and the publish workflow
  is a manual `workflow_dispatch` that has never been run.
- **`dist/` is gitignored and not committed**, and the build hook is
  `prepublishOnly`, not `prepare`. npm and pnpm do not run `prepublishOnly` on a
  git install, so **a plain git dependency installs with no `dist/` and fails to
  resolve `main`/`types`.** This is a real trap; do not plan around it.
- Realistic consumption today: add the upstream `packages/*` to your server's
  pnpm workspace and depend via `workspace:*`, or use a `file:`/`link:`
  dependency against a local checkout. Either way run `pnpm -r build` **before**
  any type check — dependents resolve each other through `dist/index.d.ts`.
- The packages are **ESM-only** (`"type": "module"`, no CJS output, no `require`
  condition) and require **Node >= 20**. Your server tier inherits both.

### It cannot run in a browser — and not only because of credentials

`fhir-core/src/identity.ts` imports `node:crypto`, and every other package
depends on `fhir-core`. Vitronic's client imports `node:stream`.
`provider-google-health` pulls in the `googleapis` SDK. So even the pure mapper
functions transitively import Node builtins. On top of that, Oura, Google Health
and VITRONIC all take a client secret (VITRONIC: a plaintext username and
password) at construction time. The browser is a renderer. This is not a
preference.

### The connectors are **not** stateless, and `TokenStore`/`CursorStore` do not exist

Upstream decision D8 describes connectors as stateless libraries with token and
cursor persistence delegated to host-implemented `TokenStore` / `CursorStore`
interfaces. **That is a design intent, not code.** Those identifiers appear
exactly once in the whole repository — in the prose of `DECISIONS.md`. There is
no interface, no type, no implementation.

What actually exists is mutable in-process state:

- **Oura** — `TokenHandler` is a class with private mutable `tokenContainer`,
  `expiresAt`, `refreshInFlight`. Its README says you must persist the tokens
  yourself, but `tokenContainer` is private **with no getter**, so there is no
  supported way to read refreshed tokens back out. Treat this as an open
  integration problem, not a solved one.
- **Google Health** — `GoogleHealthClient` holds an `oauth2Client` and mutates
  itself in `initialize(code)`.
- **VITRONIC** — `BodyLoopClient` caches a token; config carries a plaintext
  username and password.
- **Open Wearables** — genuinely stateless, because it does no I/O at all.

Your server tier owns token lifecycle. Budget for it.

### The call shape is not uniform — `{ bundle, issues }` is only mostly true

| Package | Bundle entry point | Returns |
|---|---|---|
| `@open-twin/provider-oura` | `getFhirBundleFromOuraData(request, tokenHandler, opts)` | `{ bundle, issues? }` |
| `@open-twin/provider-vitronic` | `getFhirBundleFromVitronicData(client, viatarId, scopes, opts)` | `{ bundle, issues? }` |
| `@open-twin/provider-google-health` | `getFhirBundleFromGoogleHealthData(req)` | `{ bundle, issues?, unmapped: string[] }` |
| `@open-twin/open-wearables` | `buildOpenWearablesBundle(sync, options)` — **sync, no client** | `{ bundle, issues? }` |

Three things to note:

1. **`unmapped` is a third, non-optional field on Google Health.** A consumer
   destructuring `{ bundle, issues }` silently drops it — and it is the only
   signal that a declared data type arrived and was thrown away. Do not drop it.
2. **`issues` is optional** (`issues?`) and absent on the fully-happy path.
   Absence of `issues` means success, not "no information".
3. **The package is `@open-twin/open-wearables`**, not
   `@open-twin/provider-open-wearables` — the directory and the package name
   differ. It has **no HTTP client**: you fetch the pages and hand it the bodies.
   It is also the only route to Apple Health and Google Health Connect, which
   are on-device sources a server-side Node connector cannot reach directly.

Also worth knowing: `provider-vitronic` is not read-only — `createProband` and
`startScan` are POSTs against the BodyLoop API.

### There is no scoring, anywhere

Confirmed by exhaustive search: no score computation, no biological age, no
per-system aggregate. Every occurrence of "score" upstream is a UCUM annotation
constant, a pass-through of a vendor-computed number (Oura readiness/sleep/
activity scores), or a comment warning against fabricating one. Even
`derivedObservation()` in `fhir-core` **selects** a source Observation and
records the policy as free text — it does not compute.

This is a deliberate boundary, not a gap: upstream consistently refers to "the
interpretation layer" as something living above it. Building that layer is
`HANDOVER_SPEC.md` section 5a, and it is blocking for Phase 1.

### Ground truth for the adapter

`SCHEMA_VERIFICATION.md` warns not to code against the committed test snapshots,
which encode known defects. What you *should* code against, besides
`DECISIONS.md`:

- **`out/*.json` in the upstream tree** — nine reference bundles emitted by
  `verify/emit-bundles.ts` and validated in CI against the pinned HL7 validator,
  including `oura-sync`, `google-health-sync` and `vitronic-scan`. These are the
  best available examples of real output.
- **`@open-twin/fhir-core/referenceRange.ts`** — four interval types
  (`normal`, `recommended`, `treatment`, `pre` — note the code is `pre`, not
  `pre-therapy`), each carrying a source `url`, `publisher` and `retrieved` date.
  Caveat: those fields are mandatory in TypeScript but **not validated at
  runtime** — `referenceInterval()` only checks that a bound exists and that
  low <= high. An empty source string produces an extension with empty strings
  and no error. If scoring depends on provenance, validate it yourself.

## 2. Layers in this repository

### Data (`src/data/`)
- `schema.ts` is the contract (`TwinMetrics`). The rest of the app depends
  only on this.
- `adapter.ts` is the only code that knows upstream shapes. `loadTwin()` fetches
  an already-scored payload and runs it through `assertTwinMetrics()`, which
  throws if a system carries `hasData: false` with a non-null score — a
  fabricated number must not reach the renderer. `fromFhirBundle()` is the
  server-side seam and is deliberately unimplemented rather than faked.

### State (`src/store.ts`)
- Zustand store holding the loaded `data`, the `selectedSystem`, and a
  `journeyT` scrubber value. Both the 3D scene and the UI read/write here, which
  is what makes list<->body selection two-way with no prop drilling.

### Scene (`src/scene/`)
- `BodyScene.tsx`: a single `@react-three/fiber` `<Canvas>` wrapping the scene
  in `<XR>`. The same graph serves the browser and WebXR.
- `Body.tsx`: the placeholder anatomy. A translucent silhouette plus one organ
  blob per `SystemId`, positioned by a layout table, coloured by score,
  clickable. This is the component you replace with an HRA GLB loader that
  resolves structures by ontology ID (`docs/MODEL_PIPELINE.md`).
- `metricColor.ts`: pure score->colour, ->emissive and ->opacity functions on a
  perceptually-separated red-amber-green scale. **A null score is a distinct
  input**, rendered neutral — never 0, never a midpoint.

### UI (`src/ui/`)
- Presentational React + Tailwind pieces mirroring the mockup: `Sidebar`,
  `MetricsStatusCard`, `TrendChart`, `SystemScoreList`, `ConnectedSources`,
  `DetailPanel`, `ChatbotStub`, `XREnterButton`. `App.tsx` composes the grid.
- The UI renders three honest states, not two: measured, proxy-derived (badged),
  and no data (chip, neutral organ). See the table in `DATA_CONTRACT.md`.

## 3. Why this shape

- **Adapter isolation** means the upstream shape can change without touching 3D
  or UI. Only `adapter.ts` moves. Given that upstream is pre-1.0, unpublished,
  and has four non-identical return types across four providers, this boundary
  is doing real work.
- **Server tier is forced, not chosen.** Node builtins, client secrets, and the
  missing scoring layer all land on the same side of the line.
- **Placeholder-first geometry** lets the whole interaction and data path be
  built and reviewed before any licensed model enters, and guarantees a
  zero-asset boot. The real model is HRA under CC BY 4.0 (attribution, no
  share-alike).
- **Single Canvas + `<XR>`** means the browser view and the OpenXR/headset view
  are literally the same scene, so there is no second renderer to maintain. The
  glTF twin is the one portable artifact across tab and headset.

## 4. Portability note (the OpenXR path)

WebXR is exposed on the Meta Quest browser and on Vision Pro (visionOS 2+),
and on desktop Chrome/Edge with a tethered headset. It is NOT exposed on iOS
Safari, where the app degrades to the non-immersive 3D view. If iPhone AR
placement is ever needed, add a USDZ export alongside the GLB and use
`<model-viewer>` / AR Quick Look for that platform only. See the planning
report in `docs/` for the full landscape.
