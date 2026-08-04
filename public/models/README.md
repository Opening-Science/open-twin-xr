# public/models

The app runs with a **procedural placeholder body** and needs nothing here to
start.

To use a real atlas, place the assembled and compressed files here. **One GLB per
atlas** — never merged, see the licence note below. The filenames are not
arbitrary: they must match the `url` each atlas declares in
`src/scene/anatomySources.ts`, which is what the app probes for.

| Atlas | Raw export | What the app loads | Assemble | Compress (+ bake AO) |
|---|---|---|---|---|
| BodyParts3D | `bodyparts3d.glb` | `bodyparts3d.ao.glb` | `npm run build:bodyparts3d` | `npm run convert:bodyparts3d` |
| Z-Anatomy | `z-anatomy.glb` | `z-anatomy.ao.glb` | `npm run build:z-anatomy -- --src DIR` | `npm run convert:z-anatomy` |
| Z-Anatomy regions | `z-anatomy-regions.glb` | `z-anatomy-regions.ao.glb` | same build, written as a second asset | `npm run convert:z-anatomy-regions` |
| HuBMAP HRA (female) | `hra.glb` | `hra.ao.glb` | — (download) | `npm run convert:hra` |
| HuBMAP HRA (male) | `hra-m.glb` | `hra-m.ao.glb` | — (download) | `npm run convert:hra-m` |
| CT (female), TCIA | — | `htb-ct-003.glb` | `scripts/ct-atlas/labelmap2glb.py --labels …` | none — already small |
| CT atlas, MOOSE | — | `ct-atlas-f.glb` | see `docs/CT_ATLAS_PIPELINE.md` | none — already small |

**Organ overlays** are separate single-organ assets, loaded on top of whichever
atlas is showing. They need no AO bake — see the note on the ear below.

| Overlay | What the app loads | Build |
|---|---|---|
| Beating heart | `biv-heart.glb` | `node scripts/build-biv-heart.mjs --src DIR` |
| Schematic eye | `eye.glb` | `node scripts/build-eye.mjs` — needs no download at all |
| Ear (photographic) | `openear-zeta.glb` | `npm run build:openear -- --src DIR` then `npm run convert:openear` |

The `.ao.glb` step is not cosmetic bookkeeping: it bakes per-vertex ambient
occlusion into `COLOR_0`, and `AtlasBody` switches `vertexColors` on per mesh
according to whether that attribute is present. Load an `.opt.glb` where the app
expects `.ao.glb` and you simply get an unoccluded, flatter body.

After building, run both checks:

```bash
npm run check:winding && npm run check:structures
```

**These cannot run in CI, and that is not an oversight to fix.** Every GLB here
is gitignored — the atlases are large and separately licensed — so a CI runner
has no assets to check. CI builds the app; asset integrity is gated on whoever
regenerates an atlas running these locally before committing anything that
depends on the result. Treat a green CI as saying nothing whatever about the
geometry.

`check:structures` guards per-structure identity. Z-Anatomy ships a `_STRUCTURE`
id on every vertex plus a table on the scene extras, which is what lets hover
name "Biceps brachii" rather than the merged group. Nothing in the compression
pipeline announces damage to it: a simplify that crosses a structure boundary
blends ids, a weld that ignores the attribute merges across one, and a
quantiser that touches it corrupts it outright. Each shows up as hover naming
the wrong structure, which reads like a mapping bug and is not one. The check
asserts every id is carried by real vertices and that no structure's vertices
have drifted off the centroid recorded at build time.

**⚠️ Simplification settings are per atlas, and they are not interchangeable.**
`--simplify-error` is a distance in METRES that a vertex may drift. HRA shipped
at `0.01` — a full centimetre on a 1.7 m body — against Z-Anatomy's `0.0005`.
Judge the error bound against the thinnest wall in the atlas, not the average
structure: a thick bone tolerates loose simplification and a thin membrane does
not. Current settings:

| atlas | ratio | error |
|---|---|---|
| Z-Anatomy | 0.35 | 0.0005 |
| HRA | 0.5 | 0.001 |
| BodyParts3D | 0.5 | 0.005 |

> **⚠️ Correction, same day.** An earlier version of this note claimed HRA's
> loose setting was TEARING the viscera and that this was why they rendered as
> speckles. **That was wrong on both counts.** Tightening the error 10× made
> measured hole counts go *up*, not down — because the mesh gained triangles, so
> the holes were in the source geometry all along and were never the cause. The
> speckle was a material problem: organs with no health score were ghosted to
> 45 % opacity, which `alphaHash` renders as a dither. See **D13**.
>
> The tighter setting was kept anyway, but on its own merits — 1 cm of vertex
> drift is sloppy for an anatomy viewer and HRA was 20× looser than every other
> atlas — **not** because it fixed anything visible. It doubles the asset from
> 7.5 MB to 13.3 MB, so revert it if that size matters more than the precision.

`check:winding` guards the other silent failure:

None of these GLBs carry a `NORMAL` attribute — normals are computed at load
from triangle winding — so an importer that bakes a mirrored transform without
reversing triangle order leaves half the body inside-out. It renders as a smooth,
washed-out half with a seam down the midline and looks like a lighting bug. See
D11b.

Z-Anatomy needs its FBX sources, which are not vendored. Get these seven from
<https://github.com/LluisV/Z-Anatomy/tree/PC-Version/Resources/Models/FBX> and
point `--src` at the directory holding them:

```
SkeletalSystem100.fbx   MuscularSystem100.fbx   Joints100.fbx
NervousSystem100.fbx    CardioVascular41.fbx    LymphoidOrgans100.fbx
VisceralSystem100.fbx
```

All of it goes into **one** `z-anatomy.glb` — 3,617 structures. Per **D12b**
nothing is excluded on licence grounds; instead every structure that came from a
third-party component is tagged with it, and `npm run check:licences` reads those
tags back out of the shipped asset to regenerate `docs/LICENCE_LOG.md`.

Three components inside Z-Anatomy are not the Z-Anatomy authors' own work and are
credited separately in-app and in each asset's `asset.copyright`:

| structures | licence | component |
|---:|---|---|
| 8 | CC BY-NC-SA 4.0 | Anatomy of the Inner Ear — University of Dundee |
| 4 | CC BY-NC 4.0 | Kidney — lissiecowley |
| 3 | **no licence stated** | Brainder / white matter — University of Washington |

⚠️ The white matter is the one item a credit line does not settle — silence
grants nothing. It ships, and it sits at the top of the log's action list until
permission is obtained or the geometry is replaced.

`Regions of human body100.fbx` **is** imported, as its own asset rather than as
part of the body. It holds 257 named regions of the body SURFACE — cubital fossa,
carotid triangle, deltoid region — which lie on the skin and would occlude every
organ behind them if merged into `z-anatomy.glb`. As a separate atlas it is one
click in the switcher. That was never a licence call: it is plain CC BY-SA.

> **⚠️ Correction.** This paragraph used to say the file was "deliberately not
> imported" because it "would render a second body inside the first". The occlusion
> problem was real; the conclusion was not. The fix was a second asset, not
> exclusion, and the note was left behind when the import landed.

HRA ships two donors and both are wired up: the switcher offers one "HuBMAP HRA"
entry and a Female/Male control picks the build. They resolve through the same
`hraGroups` adapter — `normaliseGroup` strips the `VHF`/`VHM` prefix — and
measure 58/96 and 47/85 meshes resolved respectively, the difference being the
same ungrouped remainder in both. BodyParts3D and Z-Anatomy are both TARO and
male, so for those the UI states "male donor only" instead of offering a toggle
that would do nothing.

All geometry must be in metres, +Y up, facing +Z, origin at the pelvis root, so
the atlases and the procedural body share one frame.

Nothing here is required to run the app: `Body.tsx` probes for these files and
falls back to the procedural anatomy when they are absent.

Structures carry `system`, `layer` and `label` in glTF `extras`, written by the
build scripts. **Ontology IDs are present on some assets and absent on others**, and
the split matters because only what is in the asset is usable at runtime: HRA
carries `ontologyid` on 89 % of its structures and both CT atlases on 100 %, while
BodyParts3D and Z-Anatomy carry none — BodyParts3D's FMA terms were dropped when
structures were merged for the draw-call budget, and Z-Anatomy's crosswalk exists in
`docs/z-anatomy-fma.tsv` but is never written in. Restoring that join is outstanding
(D11), and `docs/ONTOLOGY_MAP.md` is the inventory for it.

**If you redistribute a build**, add a `NOTICE.txt` with the **CC BY 4.0**
attribution for HRA and BodyParts3D — attribution plus an indication of any changes
you made, with no share-alike obligation. Z-Anatomy is **CC BY-SA 4.0** and carries
a share-alike obligation, which is why each atlas ships as its own file: keeping
them unmerged keeps the obligation off the CC BY geometry and off the MIT code. See
`/ASSETS_LICENSE.md` for the exact credit lines.

Full steps: `/docs/MODEL_PIPELINE.md`.

Do not commit `.blend` or uncompressed multi-hundred-MB exports (see
`.gitignore`).
