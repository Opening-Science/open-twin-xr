# Open Twin XR

An open-source, web-based **human body viewer** with WebXR — the same anatomical
scene in a browser or on a headset. Its subject is the body: anatomy, geometry,
materials, lighting, and eventually personalisation from a person's own imaging.

![The viewer on first load: the BodyParts3D male donor on the dark theme, the arterial
tree and the viscera read through a glass skin whose edge is lit where it turns away
from the camera, with the control dock grouping atlas, donor, overlays and appearance,
the framing column, and the required attribution beside it](docs/preview.png)

> **It is not a health dashboard.** Health-data mapping and scoring live upstream
> in [`etzm/open-twin`](https://github.com/etzm/open-twin) and the two reconcile
> later (decision **D8**). This app consumes an already-scored `TwinMetrics`
> and asks no questions about how the numbers were reached. The bundled sample is
> **fictional** and must never be presented as anyone's measured health.

## Quick start

```bash
npm install && npm run dev
```

It runs immediately on **procedural placeholder geometry** — no assets required.
Atlases are large and separately licensed, so they are gitignored; the app probes
for them and falls back honestly, and the switcher says "not installed" rather
than silently substituting.

To render real anatomy see [`public/models/README.md`](public/models/README.md)
and [`docs/MODEL_PIPELINE.md`](docs/MODEL_PIPELINE.md). For a headset, WebXR needs
a secure context — expose over HTTPS on your LAN via a tunnel or a local cert.

## What it does

- **Seven registered anatomy sources, five donors, switchable side by side** —
  and it names whose body you are looking at, because switching atlas switches the
  *person*. "Best per system" composes the best-covered atlas for each body system,
  with a separate map per sex.
- **Three organ overlays**, each a different person again, sitting on top of
  whichever body is showing: a **beating heart** with a 25-phase cardiac cycle and
  an adjustable rate, a **schematic optical eye** generated from published
  parameters, and a **photographically coloured ear** — one temporal bone whose
  surface colour is sampled from that same specimen's micro-slicing photographs.
- **Per-structure identity.** A `uint16` id on every vertex plus a table in the
  asset, so hover names "biceps brachii" rather than the merged group — without
  giving up the single draw call that makes it affordable on a headset.
- **Separable layers.** Skeleton, muscle and organs toggle and select
  independently.
- **Per-structure exploded view**, computed on load and applied in the vertex
  shader.
- **X-ray** — a Fresnel fade that clears where a surface faces you and stays
  solid at its silhouette, so you can see into an organ without losing its shape.
- **Honest rendering of absence.** Missing data is "no data" — never 0, never a
  midpoint — and it never dissolves the anatomy. A surface with no colour source is
  left neutral grey rather than given a plausible colour, and an overlay is drawn at
  its own measured size rather than scaled to fit the body it sits in.
- **Its own provenance, in the app.** "All models and sources" under the credits
  lists every model, what it was built from, and how much source data went into it —
  derived from the registries and measured from the server, not hand-written.

## Contributing

Start with [`CONTRIBUTING.md`](CONTRIBUTING.md). It is short on process and long on
the handful of things that cost a day if nobody mentions them — the gates that
cannot run in CI, the two generated documents that must not be hand-edited, and why
an asset must never be committed.

**The initial implementation was AI-assisted.** Scope, licensing decisions and every
judgement about what may be published were made by people; much of the
implementation and almost all of the inline documentation was written with an AI
coding agent, under review. This is stated because it explains the unusual comment
density — about 44 % of the lines in `src/` and `scripts/` — which is deliberate:
the comments carry *why*, including the places where an obvious approach was tried
and reverted.

## Documentation

**[`docs/README.md`](docs/README.md) is the documentation index** — it gives a
reading order and says which documents are current and which are historical. The
short version:

| | |
|---|---|
| [`docs/HANDOVER.md`](docs/HANDOVER.md) | **Start here.** Written for someone picking the repo up cold |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the code is arranged, and why |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | D1–D13: what was decided, and what was reversed and why. Read before proposing a change |
| [`docs/MODEL_PIPELINE.md`](docs/MODEL_PIPELINE.md) | Getting real anatomy on screen |
| [`docs/ONTOLOGY_MAP.md`](docs/ONTOLOGY_MAP.md) | Generated: organ systems ↔ UBERON/FMA, and which assets carry a term |
| [`docs/LICENCE_LOG.md`](docs/LICENCE_LOG.md) | Generated due-diligence record |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Shipping it |

## Resources

Everything this project builds on. See [`licences.json`](licences.json) for the
machine-readable register, and `docs/RESOURCES.md` for what was evaluated and
rejected.

### Anatomy

| source | licence | use |
|---|---|---|
| [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/) — DBCLS | CC BY 4.0 ⚠️ | Default atlas. FMA-indexed, TARO donor |
| [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) | CC BY-SA 4.0 (aggregate) | Musculoskeletal, nervous, cardiovascular, lymphoid, viscera, surface regions |
| [HuBMAP HRA](https://humanatlas.io/) | CC BY 4.0 | Organ-scale, UBERON-rich, both sexes |
| [Visible Human Project](https://www.nlm.nih.gov/research/visible/) — US NLM | Public domain | The donors HRA derives from |
| [Healthy-Total-Body-CTs](https://www.cancerimagingarchive.net/collection/healthy-total-body-cts/) — TCIA | CC BY 4.0 | The first complete female body here. Subject 003, at her measured size |
| [biv-me](https://github.com/UOA-Heart-Mechanics-Research/biv-me) — Univ. of Auckland | Apache-2.0 | Beating heart overlay, 25 cardiac phases. Donor: a CARDIOHANCE participant, shared with local ethics approval (confirmed by the authors — D21). Cite Dillon et al. 2026, *Med Image Anal* 114:104252 |
| [OpenEar](https://zenodo.org/record/1473724) — MED-EL / Univ. of Bern | CC BY 4.0 | Temporal bone with **photographic** surface colour from micro-slicing |
| [Arizona eye model](https://doi.org/10.1364/JOSAA.14.002884) — Schwiegerling | Parameters, not a work | The schematic eye is generated from published radii and conics, so this project owns the mesh outright |
| [AnatomyTOOL / Open3Dmodel](https://anatomytool.org/open3dmodel-about) — Leiden UMC | CC BY-SA | Verified importable — shares our exact frame. Not yet imported |

Third-party components inside Z-Anatomy — the inner ear (Univ. of Dundee,
CC BY-NC-SA 4.0), the kidney (lissiecowley, CC BY-NC 4.0), Cranial Nerves and
Foramina (Univ. of Dundee CAHID, CC BY 4.0), and the white matter boundary
surfaces (Brain for Blender, Anderson M. Winkler, CC BY-SA 3.0 — upstream
miscredits them to the University of Washington, which their author denies;
see D20) — are credited in-app and recorded per structure. See the generated
table in `docs/HANDOVER.md`.

### Segmentation and mesh pipeline

| tool | licence | use |
|---|---|---|
| [MOOSE 3.2](https://github.com/ENHANCE-PET/MOOSE) — ENHANCE-PET | Apache-2.0 / CC BY 4.0 weights | CT → labelmap, ~120 classes |
| [TotalSegmentator](https://github.com/wasserth/TotalSegmentator) | Apache-2.0 / mixed | MR segmentation |
| [VTK](https://vtk.org/) `vtkSurfaceNets3D` | BSD-3 | Multi-label meshing with shared boundaries |
| [glTF-Transform](https://gltf-transform.dev/) | MIT | Compression, simplification, meshopt |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) | MIT | `EXT_meshopt_compression` |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT | AO bake and hover picking |

### Rendering

| package | licence |
|---|---|
| [three.js](https://threejs.org/) | MIT |
| [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) · [drei](https://github.com/pmndrs/drei) · [xr](https://github.com/pmndrs/xr) | MIT |
| [React](https://react.dev/) · [Zustand](https://github.com/pmndrs/zustand) · [Vite](https://vite.dev/) · [Tailwind](https://tailwindcss.com/) · [Recharts](https://recharts.org/) | MIT |
| [Inter](https://rsms.me/inter/) | SIL OFL 1.1 — self-hosted, no CDN |

### Citations

- Börner K, et al. *HuBMAP 3D Human Reference Atlas construction and usage.*
  Nature Methods (2024).
- Mitsuhashi N, et al. *BodyParts3D: 3D structure database for anatomical
  concepts.* Nucleic Acids Research 37 (2009) D782–D785.

## Licensing

**Source code is MIT.** The anatomy assets are separate works under their own
terms, kept as one file per atlas so each licence stays scoped to the geometry
that carries it. `docs/COMMERCIAL_LICENSES.md` covers the paid alternatives that
were considered and rejected; `ASSETS_LICENSE.md` has the credit text.

⚠️ **The bundled result is open source, *non-commercial*** — not Open Definition
conformant — because Z-Anatomy includes CC BY-NC and CC BY-NC-SA components.
State that plainly rather than badging a release CC BY-SA.

⚠️ **One component grants nothing.** The University of Washington white matter
carries no licence statement, and attribution cannot manufacture a grant. Build
with `--publishable` to drop exactly that and keep the rest. Serving behind a
login is still distribution.

Run `npm run check:licences` before publishing anything; it regenerates
`docs/LICENCE_LOG.md` from the shipped assets and prints an action list.

## Status

Seven anatomy sources building and rendering, three organ overlays, and
per-structure identity on BodyParts3D, Z-Anatomy and HRA. A complete female body
landed with the TCIA CT subject — HRA's female donor has no skeleton above the
pelvis, so that gap is now closed. Photographic tissue colour is answered too: the
OpenEar temporal bone carries colour sampled from its own micro-slicing volume, on
71.5 % of its surface, with the remainder left honestly grey.

⚠️ **This section has now been wrong TWICE, in opposite directions, which is the
argument for never stating coverage here by hand.** It first claimed terms were
"complete on BodyParts3D (FMA)". That was corrected to "BodyParts3D and Z-Anatomy
carry none at all" — true when written, and false within days of it.

Measured on the shipped assets: BodyParts3D **1,838 of 1,838**, Z-Anatomy
**1,840 of 3,614**, HRA 89 %, both CT atlases 100 %. Run `npm run gen:ontology`
before believing any of those numbers, including these.
[`docs/ONTOLOGY_MAP.md`](docs/ONTOLOGY_MAP.md) has the full picture and is
generated, so it cannot drift the way that sentence did.

The remainder of the Z-Anatomy crosswalk and personalisation from imaging are in
[`docs/ROADMAP.md`](docs/ROADMAP.md); the immediate queue is at the top of
[`docs/HANDOVER.md`](docs/HANDOVER.md).

The AI layer is deliberately **not** built here: `src/ui/ChatbotStub.tsx` is a
visual stub and there are no LLM calls in this repository.
