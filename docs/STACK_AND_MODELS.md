# Open Twin XR — technical stack, models, and publishability

**Snapshot: 29 July 2026.** Describes the build currently deployed at
A gated presentation behind basic auth. ⚠️ The host is deliberately not named
here — see the box at the top of `DEPLOY.md`; substitute your own `$SITE`.

> ⚠️ **This is a point-in-time export, not a maintained table.** The living sources
> of truth are generated from the shipped assets and cannot drift:
> `docs/LICENCE_LOG.md` (`npm run check:licences`) and `docs/ONTOLOGY_MAP.md`
> (`npm run gen:ontology`). If this document and those disagree, they win. Every
> figure below was read out of the shipped GLBs on the date above.

---

## 1. What this is

A web-based **human body viewer** with WebXR — the same anatomical scene in a
browser or a headset. Its subject is the body: anatomy, geometry, materials,
lighting, and eventually personalisation from a person's own imaging.

It is **not** a health dashboard. Health-data mapping and scoring live upstream in
`etzm/open-twin`; this app consumes an already-scored contract and asks no
questions about how the numbers were reached. The bundled sample is fictional.

---

## 2. Technical stack

### Runtime — what ships to the browser

| component | version | role |
|---|---|---|
| **three.js** | 0.169.0 | WebGL renderer |
| **@react-three/fiber** | 8.18.0 | React reconciler for three.js |
| **@react-three/drei** | 9.122.0 | Loaders and helpers (`useGLTF`, `useAnimations`) |
| **@react-three/xr** | 6.6.30 | WebXR session, controllers, hand tracking |
| **React** | 18.3.1 | UI |
| **Zustand** | 5.0.14 | State (selection, visibility, explode, x-ray, overlays) |
| **Tailwind CSS** | 3.4.19 | Styling |
| **three-mesh-bvh** | 0.7.8 | Hover picking — 311 ms → 0.1 ms per raycast |
| **Recharts** | 2.15.4 | Charts (unmounted with the scoring UI) |
| **Inter** | 4.1 variable, self-hosted | Typeface, SIL OFL 1.1. The COMPLETE font (344 KB), not a subset — a `unicode-range` silently sent `→` and `≈` to the system font |

### Build and asset pipeline — build-time only, never shipped

| component | version | role |
|---|---|---|
| **Vite** | 5.4.21 | Dev server and bundler |
| **TypeScript** | 5.9.3 | Types; `tsc -b` gates the build |
| **glTF-Transform** | 4.4.2 | Assemble, weld, simplify, meshopt, WebP |
| **meshoptimizer** | 1.0.1 | `EXT_meshopt_compression` |
| **xatlas** | via glTF-Transform | UV unwrapping for the textured ear |
| **MOOSE 3.2** (ENHANCE-PET) | — | CT → labelmap, ~120 classes |
| **VTK** `vtkSurfaceNets3D` | — | Multi-label meshing with shared boundaries |
| **SimpleITK** | — | NRRD/NIfTI and ITK transform handling |

### Techniques worth naming

- **Per-structure identity without per-structure draw calls.** A `uint16`
  `_STRUCTURE` id on every vertex plus a table in the asset's `extras`. 3,614
  Z-Anatomy structures are individually nameable inside **11 draw calls**.
- **Per-vertex ambient occlusion** baked offline into `COLOR_0` (three-mesh-bvh,
  32 rays/vertex). Single-threaded and slow — ~52 min for Z-Anatomy, ~2 h for HRA.
- **Vertex-shader exploded view and x-ray**, injected via `onBeforeCompile` with
  `customProgramCacheKey` variants, so no geometry is duplicated.
- **Organ overlays** mounted as siblings of the atlas in a canonical frame
  (1.7 m, centred, feet at y=0), with **per-atlas measured placement** — the same
  organ sits 29.3 mm apart between two donors.
- **Honest absence.** No data renders as "no data", never 0. A surface with no
  colour source stays neutral grey. A missing asset degrades to "not installed".

### Deployment

Static build on Debian 12 (2 vCPU / 3.8 GB) behind **Caddy** with automatic HTTPS
and a basic-auth wall; administered over **Tailscale**. All rendering happens in
the visitor's browser — the server touches no geometry.

---

## 3. Models included

Ten assets: seven anatomy sources (five donors) and three organ overlays. Figures
are from the shipped files.

| # | model | donor | contributes | structures | triangles | size |
|---|---|---|---|---|---|---|
| 1 | **BodyParts3D** | TARO — adult Japanese male voxel phantom, 2 mm MRI | Default body; respiratory, metabolic, digestive, skin hull | 11 merged nodes (1,838 source meshes) | 2.61 M | 10.8 MB |
| 2 | **Z-Anatomy** | TARO, retopologised by medical illustrators | Musculoskeletal, nervous, cardiovascular, reproductive, endocrine, lymphoid, viscera | **3,614** individually named | 3.09 M | 12.1 MB |
| 3 | **Z-Anatomy regions** | TARO | 257 named body-*surface* regions (topography, not anatomy) | 257 | 0.07 M | 0.3 MB |
| 4 | **HuBMAP HRA (female)** | Visible Human Female, 0.33 mm cryosection | Whole body except upper skeleton; uterus, ovaries, mammary glands | 96 nodes | 4.03 M | 15.4 MB |
| 5 | **HuBMAP HRA (male)** | Visible Human Male, 0.33 mm cryosection | Same atlas, male donor | 85 nodes | 2.06 M | 8.5 MB |
| 6 | **CT (female)** | TCIA Healthy-Total-Body-CTs subject 003 — F, 26, 1.7018 m | The only **complete female body**; at her measured size, arms raised | 33 grouped labels | 0.98 M | 27.0 MB |
| 7 | **CT atlas** | ⚠️ unidentified CT subject | The only atlas with UBERON ids on every structure | 109 nodes | 0.44 M | 12.6 MB |
| 8 | **Beating heart** (biv-me) | biv-me demo subject, cine MRI | **Time** — 25 cardiac phases as morph targets, adjustable rate | 3 surfaces | 0.01 M | 3.8 MB |
| 9 | **Schematic eye** | nobody — generated | Optics: cornea, lens, retina from published radii and conics | 3 surfaces | 0.05 M | 1.2 MB |
| 10 | **Ear (photographic)** | OpenEar specimen ZETA — one right temporal bone | **Real colour** sampled from the specimen's own micro-slicing photographs at 50 µm | 12 structures | 0.23 M | 9.1 MB |

Every overlay is a **different person from the body it sits inside**, shown at its
own measured size rather than scaled to fit. The app states this rather than
leaving it to be noticed.

---

## 4. Publishability — as we currently present them

Assessed **for the build now deployed**: Z-Anatomy is the `--publishable` build.
⚠️ Snapshot drift: when this was written the site sat behind a login wall; **since
18 August 2026 (D21) it is public**, the heart's provenance having been answered
(CARDIOHANCE, local ethics approval) and the one unresolved asset (`ct-atlas-f`)
withheld from `dist` mechanically.

**A login wall limits *who* sees the work; it does not change what may lawfully be
sent to them.** Serving to logged-in users is still distribution — which is why
going public changed less here than it might seem: the same rights bar applied
throughout.

**(!) marks where contacting the creators or rights holders is necessary.**

| model | licence as presented | publishable? | conditions | outreach |
|---|---|---|---|---|
| **BodyParts3D** | CC BY 4.0 | ✅ Yes | Attribution + indicate changes | **(!)** DBCLS have not confirmed the 2025 relicence in writing; several upstream pages still say CC BY-SA 2.1 JP |
| **Z-Anatomy** — own geometry, 3,606 structures | CC BY-SA 4.0 | ✅ Yes | Attribution, indicate changes, **share-alike attaches to this asset** | — |
| ↳ Dundee inner ear — 4 structures (cochlea, vestibule, per side) | CC BY-NC-SA 4.0 | ⚠️ Non-commercial only | Attribution + share-alike; must not be sold | — attribution suffices |
| ↳ Dundee CAHID cranial nerves and foramina — **credited, not counted** | CC BY 4.0 | ✅ Yes | Attribution. Deliberately not tagged per structure — Dundee's nerves and Z-Anatomy's own are not separable by name (`PLAN_NEXT.md` item 3), so no row of this table can carry a count for it | — attribution suffices. ⚠️ It was missing from the register and the assets' embedded copyright until 17 August 2026 |
| ↳ lissiecowley kidney — 4 structures | CC BY-NC 4.0 | ⚠️ Non-commercial only | Attribution; must not be sold | — attribution suffices |
| ↳ white matter boundary surfaces — **restored** (was "UW, no licence, excluded") | CC BY-SA 3.0 (Brain for Blender, Anderson M. Winkler) | ✅ Yes, since D20 (17 Aug 2026) | Attribution + share-alike; BY-SA 3.0 §4(b) permits the BY-SA 4.0 aggregate. Upstream's UW credit is denied by the named source; the spinal-cord mesh proved to be Z-Anatomy's own | — credit wording awaits Winkler's reply; publishability does not |
| ↳ ossicles in `SkeletalSystem100.fbx` (incus, stapes, malleus) | assumed Z-Anatomy's own, **untagged** | ⚠️ Attribution unresolved | Currently credited as Z-Anatomy's | **(!)** verify against upstream `License.txt` — they may belong to the Dundee component |
| **Z-Anatomy regions** | CC BY-SA 4.0 | ✅ Yes | Attribution + share-alike. Cleanest asset in the set — no third-party components | — |
| **HuBMAP HRA** (female + male) | CC BY 4.0 | ✅ Yes | Attribution + indicate changes. Derived from NLM Visible Human, public domain since 2019 | — |
| **CT (female)** — TCIA | CC BY 4.0 | ✅ Yes | Attribution + DOI. Two properties must travel: labels are **grouped**, and it is low-dose non-contrast CT so bone is trustworthy and soft tissue is not | — |
| **CT atlas** — MOOSE | ⚠️ **unresolved** | ⛔ **No — internal/research only** | MOOSE weights are CC BY 4.0, but the licence of a segmentation follows its **source image**, and that scan was never recorded | **(!)** provenance must be established, or the asset regenerated from a scan with a known licence. *Not a creator problem — an internal record problem.* |
| **Beating heart** — biv-me | Apache-2.0 | ✅ **Yes, since D21 (18 Aug 2026)** | Attribution names the cohort and ethics basis; cite the repo and Dillon et al. 2026, *Med Image Anal* 114:104252 | ~~(!)~~ **Answered by the corresponding author:** `patient1` is a **CARDIOHANCE** participant, local ethics approval to share online, no restrictions on further use. The UK Biobank branch is dead. |
| **Schematic eye** | none required — ours | ✅ Yes, unconditionally | Must always be described as a **schematic optical** model: no sclera, iris, ciliary body, extraocular muscles, optic nerve or vasculature | — the only asset with no upstream rights holder at all |
| **Ear (photographic)** — OpenEar | CC BY 4.0 | ✅ Yes | Attribution. Three properties travel: **71.5 %** of the surface has photographed colour and the rest is honest grey; it is **one cadaveric temporal bone**, not a population; it is ~14 % larger than the body's own ear and left unscaled | — |
| **Inter** (typeface) | SIL OFL 1.1 | ✅ Yes | Self-hosted complete font — no CDN, so no visitor IP disclosure. `OFL.txt` ships beside it, verified byte-identical to upstream | — |
| **Application code** | MIT | ✅ Yes | — | — |

### The bundle's overall position

> **Open source, non-commercial — not Open Definition conformant.**

Because CC BY-NC and CC BY-NC-SA components are present, the assembled result
cannot be offered under terms permitting commercial reuse. Say that plainly
wherever the work is described; do not badge a release "CC BY-SA" and leave it
there. Share-alike attaches to the Z-Anatomy-derived asset specifically — which is
why **each atlas ships as its own file and is never merged into one model**, keeping
the obligation off the CC BY geometry and off the MIT code.

### Outreach needed — in priority order

1. ~~**(!) biv-me authors**~~ — **asked and answered, 18 Aug 2026 (D21).** Joshua
   Dillon confirmed the `patient1` demo case is a **CARDIOHANCE** participant with
   local ethics approval to share online and no restrictions on further use, and
   asked that the credit cite the repository and the 2026 *Medical Image Analysis*
   paper (doi:10.1016/j.media.2026.104252) rather than the superseded FIMH one.
   Nothing blocks the heart; the Sunnybrook fallback is history.
2. ~~**(!) University of Washington**~~ — **resolved without them (D20, 17 Aug
   2026).** Brainder's author denies any UW affiliation; the cortical pair is his
   CC BY-SA 3.0 boundary surface, restored to the build, and the spinal cord is
   Z-Anatomy's own. Only the credit wording still waits on his reply.
3. **(!) Z-Anatomy upstream** — check `License.txt` on the ossicle attribution, so
   the incus, stapes and malleus are credited to whoever actually owns them — and
   tell them their "'Brainder' / University of Washington" credit is wrong, per D20.
4. **(!) DBCLS** — written confirmation of the BodyParts3D CC BY 4.0 relicence.
5. **(!) Internal** — establish or replace the CT atlas's source scan. No third
   party to contact; this is a record that was never kept.

---

## 5. References

### Anatomy sources

- **BodyParts3D** — The Database Center for Life Science (DBCLS), Japan.
  Licence: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>
  Mitsuhashi N, et al. *BodyParts3D: 3D structure database for anatomical
  concepts.* **Nucleic Acids Research** 37 (2009) D782–D785.
  <https://doi.org/10.1093/nar/gkn613>

- **Z-Anatomy** — Lluís Vinent et al. CC BY-SA 4.0.
  <https://github.com/LluisV/Z-Anatomy> · <https://www.z-anatomy.com/>
  Derived from BodyParts3D. Contains **four** third-party components, per its own
  `Resources/Models/License.txt`: *Anatomy of the Inner Ear* (University of Dundee
  School of Medicine, CC BY-NC-SA 4.0), *Cranial Nerves and Foramina* (University of
  Dundee, CAHID, CC BY 4.0), *Kidney* (lissiecowley, CC BY-NC 4.0), and the white
  matter boundary surfaces (*Brain for Blender*, Anderson M. Winkler, CC BY-SA 3.0 —
  miscredited upstream to a "University of Washington" the author disclaims; D20).

- **HuBMAP Human Reference Atlas (HRA)** — CC BY 4.0.
  <https://humanatlas.io/> ·
  <https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html>
  Börner K, et al. *HuBMAP 3D Human Reference Atlas construction and usage.*
  **Nature Methods** (2024). <https://doi.org/10.1038/s41592-024-02184-y>

- **Visible Human Project** — U.S. National Library of Medicine. Public domain
  since July 2019. <https://www.nlm.nih.gov/research/visible/visible_human.html>
  The donors HRA derives from.

- **Healthy-Total-Body-CTs** — The Cancer Imaging Archive. CC BY 4.0.
  <https://www.cancerimagingarchive.net/collection/healthy-total-body-cts/>
  DOI: <https://doi.org/10.7937/NC7Z-4F76>
  Subject 003 used here. Segmentations and clinical demographics are CC BY 4.0;
  the CT images themselves sit behind the NIH Controlled Data Access Policy and
  were not needed.

- **biv-me** — University of Auckland Heart Mechanics Research Group. Apache-2.0
  at the repository root; **subject provenance unconfirmed**.
  <https://github.com/UOA-Heart-Mechanics-Research/biv-me>

- **OpenEar** — MED-EL / University of Bern. CC BY 4.0.
  Zenodo record 1473724: <https://zenodo.org/record/1473724>
  Sieber D, et al. *The OpenEar library of 3D models of the human temporal bone.*
  **Scientific Data** (2018), publisher MED-EL / University of Bern.
  <https://doi.org/10.1038/sdata.2018.297>

- **Arizona eye model** — parameters only; the mesh is generated by this project
  and carries no upstream rights.
  Schwiegerling J. <https://doi.org/10.1364/JOSAA.14.002884>
  The generator is validated against Le Grand's theoretical eye: the same routine
  reproduces its published 59.94 D system power exactly.

### Segmentation and mesh pipeline

- **MOOSE** (ENHANCE-PET) — Apache-2.0 code, CC BY 4.0 weights.
  <https://github.com/ENHANCE-PET/MOOSE>
- **TotalSegmentator** — Apache-2.0, mixed weights.
  <https://github.com/wasserth/TotalSegmentator>
- **VTK** — BSD-3-Clause. <https://vtk.org/>
- **glTF-Transform** — MIT. <https://gltf-transform.dev/>
- **meshoptimizer** — MIT. <https://github.com/zeux/meshoptimizer>
- **xatlas** — MIT. <https://github.com/jpcy/xatlas>
- **three-mesh-bvh** — MIT. <https://github.com/gkjohnson/three-mesh-bvh>

### Rendering and application

- **three.js** — MIT. <https://threejs.org/>
- **React Three Fiber / drei / xr** — MIT. <https://github.com/pmndrs>
- **React** — MIT. <https://react.dev/>
- **Zustand** — MIT. <https://github.com/pmndrs/zustand>
- **Vite** — MIT. <https://vite.dev/>
- **Tailwind CSS** — MIT. <https://tailwindcss.com/>
- **Inter** — SIL Open Font License 1.1. <https://rsms.me/inter/>
- **Caddy** — Apache-2.0. <https://caddyserver.com/>
- **Tailscale** — BSD-3-Clause (client). <https://tailscale.com/>

### Ontologies

- **FMA** — Foundational Model of Anatomy, University of Washington Structural
  Informatics Group. <http://si.washington.edu/projects/fma>
- **UBERON** — cross-species anatomy ontology, CC BY 3.0.
  <https://uberon.github.io/>
  Mungall CJ, et al. *Uberon, an integrative multi-species anatomy ontology.*
  **Genome Biology** 13, R5 (2012). <https://doi.org/10.1186/gb-2012-13-1-r5>
- **EBI OLS4** — used to resolve every term in the crosswalks.
  <https://www.ebi.ac.uk/ols4/>

### This project

- Repository: <https://github.com/etzm/open-twin-openXR> — code MIT, assets under
  their own terms.
- Upstream health data: <https://github.com/etzm/open-twin> (canonical:
  <https://github.com/Opening-Science/open-twin>).
- Generated licence record: `docs/LICENCE_LOG.md`.
- Generated ontology map: `docs/ONTOLOGY_MAP.md`.
