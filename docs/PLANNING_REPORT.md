# Open Twin XR - Planning Report

Prepared 26 July 2026, for the open-source, web-first build of a 3D human-body
health digital twin, handed over to Claude Code for implementation.

> **Superseded in several places.** This report was written before the
> `etzm/open-twin` tree was read directly. It is kept as the original planning
> record; where it disagrees with `HANDOVER_SPEC.md`, `docs/ARCHITECTURE.md` or
> `docs/SCHEMA_VERIFICATION.md`, **those win.** Corrections, in order of
> consequence:
>
> 1. **open-twin emits raw FHIR Observations and no scores.** A scoring layer
>    must be built and it is blocking (spec section 5a).
> 2. **The connectors cannot run in a browser and are not installable.** They
>    hold vendor credentials, `@open-twin/fhir-core` imports `node:crypto`, and
>    no `@open-twin/*` package is published to npm. A server tier is mandatory.
>    Section 4's "stays client-side" framing is wrong; see `ARCHITECTURE.md`
>    section 1.
> 3. **The VITRONIC connector targets BodyLoop** (posture geometry: joint
>    angles, axes, cross-sections, markers, heights), **not** a VITUS laser
>    scanner producing a point cloud. Read any mention of VITUS, Anthroscan or
>    scanner surface data with that correction in mind.
> 4. **The anatomy model is HRA (CC BY 4.0), not Z-Anatomy (CC-BY-SA).** Organs
>    resolve by ontology ID, not mesh-node name. Z-Anatomy is now only the
>    fallback if HRA's bone and muscle coverage proves insufficient. Sections 2,
>    3 and 6 below predate that decision; the share-alike analysis in section 3
>    applies only to the fallback.
> 5. **Section 6's next steps are stale.** The repo exists and is pushed. The
>    current order is in `CLAUDE.md`.
>
> The portability analysis (section 5) is unaffected and still accurate.

## 1. What we are building

A web application that renders a person's health as an interactive 3D human
body. Each organ system (cardiovascular, respiratory, nervous, digestive,
musculoskeletal, endocrine, reproductive, metabolic) carries a health score,
and that score colours the corresponding organ on the body. Around the body sit
the dashboard elements from the product mockups: biological and cardiovascular
age, an overall score ring, a health-trend chart, a per-system score list, a
connected-data-sources panel, and a placeholder AI chatbot bubble. The data
comes from the existing open-twin project. The AI layer is planned but is
explicitly not built in this repository.

This is the web-first, open-source foundation for what will later become the
OpenXR (headset) experience. The design choice that makes that future cheap is
that the browser view and the headset view are the same 3D scene: a single
WebGL/WebXR canvas. On a Meta Quest browser or an Apple Vision Pro the user
enters the same twin immersively through the device's OpenXR runtime, with no
second renderer to maintain.

## 2. The stack, and why

Everything in the default stack is open source and free. The reasoning behind
each choice:

The rendering core is three.js through React Three Fiber, with drei helpers and
@react-three/xr for the WebXR bridge. three.js is the most widely used web 3D
library, its skinned-mesh and glTF paths are the most heavily exercised in the
ecosystem, and @react-three/xr gives the OpenXR/WebXR entry with almost no extra
code. React plus Vite plus TypeScript is the application shell, Zustand holds
the small amount of shared state (the loaded data and the selected system) so
the 3D scene and the dashboard stay in sync without prop drilling, Recharts
draws the trend chart, and Tailwind CSS produces the soft, glassy clinical look
of the mockups quickly.

The asset and interchange layer is glTF/GLB with meshopt compression via
gltf-transform. glTF 2.0 is a ratified ISO standard and the correct delivery
format for a real-time, XR-portable body, and meshopt keeps the model inside the
frame budget of a headset. The anatomy model itself is Z-Anatomy, the open 3D
atlas derived from BodyParts3D.

The one deliberate deviation from a "use the real model immediately" approach is
that the app ships with a procedural placeholder body built from primitives. The
placeholder lets the whole data path and interaction be built, reviewed and
demonstrated with zero binary assets and no licensing entanglement, and the swap
to the real model is a single localised change in one component. The running
screenshot in this folder was produced entirely from that placeholder.

## 3. Licensing, and where money would enter

The headline is that this first web version needs no paid licenses. The full
breakdown lives in COMMERCIAL_LICENSES.md; the essentials are these.

All the code libraries (three.js, React Three Fiber, drei, @react-three/xr,
React, Vite, Zustand, Recharts, Tailwind, gltf-transform) are MIT. The formats
and standards (glTF, meshopt, Draco, KTX2, WebXR) are open and royalty-free. The
Inter font is under the SIL Open Font License.

The one asset with a copyleft obligation is the anatomy model. Z-Anatomy is
CC-BY-SA 4.0, derived from BodyParts3D which is CC-BY-SA 2.1 Japan. There is no
fee, but there are two duties: attribution, meaning the credit line must appear
wherever the model or a rendering of it is distributed, and share-alike, meaning
any modified model must itself be published under CC-BY-SA 4.0. Crucially, that
share-alike attaches to the model asset only, not to the application code, as
long as the geometry stays a separate asset rather than being baked into a
source file. Keeping the code MIT and the model CC-BY-SA as separate works is a
deliberate structural decision in the repo layout.

Money only becomes unavoidable in scenarios outside this first version. Higher
fidelity than Z-Anatomy would mean a commercial anatomy platform such as
BioDigital Human, or paid marketplace models whose licenses often forbid
redistribution and so conflict with an open-source repo. Photoreal, scan-driven
body shape, meaning mapping a real person's outer body from a 3D scan rather than
scoring organs, would pull in the SMPL or SMPL-X parametric body model, which is
research and non-commercial licensed and needs a paid license from Meshcapade
for commercial use, with MakeHuman/MPFB2 (CC0 output) as the free alternative.
Neither applies to the organ-system health twin here. The AI layer and any
wearable-data connectors carry their own provider costs and terms but no upfront
license, and the AI layer is out of scope regardless.

So the plan is to ship version one entirely free, with the only ongoing
obligation being the CC-BY-SA attribution and share-alike on the anatomy mesh.

## 4. How the data connects

The viewer depends on exactly one type, TwinMetrics, and never touches the
upstream shape directly. A single adapter module is the only place that knows
how the open-twin project publishes its data, and it maps that into
TwinMetrics; the 3D scene and the dashboard read only the mapped result. This
means the open-twin schema can change and only the adapter moves.

Because the open-twin repository is private and was not readable from the
session that produced this scaffold, the app currently runs on a bundled sample
that is already in-contract and reproduces the mockup exactly. When Claude Code
runs with access to the real repository, the open items to resolve are the
transport (whether open-twin exposes a static JSON file, an API, or an
importable library), the score semantics (open-twin's native range and
direction, mapped to 0-10 per system and 0-100 overall, and where scoring lives
if open-twin stores raw biomarkers), the system taxonomy (mapping open-twin's
categories onto the fixed set of system ids), and the organ-to-mesh mapping once
the real model is in. These are listed as a checklist in DATA_CONTRACT.md. A
standing constraint throughout is that health data is sensitive personal data
under GDPR, so it stays client-side or behind the user's own authentication, is
never logged, and the sample data stays fictional.

## 5. Portability and the OpenXR path

The same glTF twin is the one portable artifact across a browser tab and a
headset. WebXR is available on the Meta Quest browser, on Vision Pro since
visionOS 2, and on desktop Chrome or Edge with a tethered headset, and the app
already feature-detects it and only enables the enter-VR control when a runtime
is present. The permanent asterisk is Apple handhelds: iPhone and iPad Safari do
not expose WebXR, so on those devices the twin degrades gracefully to the
non-immersive 3D view. If iPhone AR placement is ever required, the route is a
USDZ export alongside the GLB, shown through model-viewer and AR Quick Look on
that platform only. None of this changes the core, because the core is standards
based: OpenXR on the native and headset side, WebXR in the browser, glTF as the
shared asset.

## 6. Status and next steps

The scaffold is complete and verified: dependencies install, the TypeScript
build passes, and the app runs and matches the mockup on placeholder anatomy, as
shown in preview.png. The handover checklist in CLAUDE.md then takes it forward
in order: create the public GitHub repository named open-twin-openXR, verify the
build, wire the real open-twin data through the adapter, swap the Z-Anatomy model
in behind the same interaction contract, fill the organ-to-mesh mapping, and
polish the in-headset WebXR interaction. The AI layer stays stubbed until it is
taken up as a separate, deliberate decision.
