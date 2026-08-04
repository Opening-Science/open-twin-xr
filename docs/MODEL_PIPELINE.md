# Anatomy model pipeline (placeholder -> real HRA)

> **Revised after verification.** Read `SCHEMA_VERIFICATION.md` first. This file
> previously described a Z-Anatomy pipeline keyed on mesh-node name strings.
> `HANDOVER_SPEC.md` sections 2 and 5 supersede that: the primary anatomy model
> is the **HuBMAP Human Reference Atlas (HRA)** under **CC BY 4.0**, and organs
> are resolved by **ontology ID**, never by node name. Z-Anatomy survives only as
> the musculoskeletal contingency documented at the bottom of this file.

The app ships with a **procedural placeholder body** (primitives in
`src/scene/Body.tsx`) so it runs with no binary assets. Swap in the real model
when ready.

## Why a placeholder first

- Zero-asset boot: `npm install && npm run dev` shows the full interaction.
- No license entanglement while iterating on UI and data.
- The interaction contract (select system -> colour organ) is identical, so the
  swap is localised.

## Why HRA rather than Z-Anatomy

- **The join survives a model swap.** HRA structures carry ASCT+B / UBERON / FMA
  terms, so `SystemScore.structures` addresses organs by ontology ID
  (`UBERON:0000948`) rather than by a string like `sys_cardiovascular_heart`
  that only exists inside one artist's Blender file.
- **Attribution only, no share-alike.** CC BY 4.0 imposes no copyleft on a
  modified model. CC-BY-SA does.
- **Coverage is not the constraint.** HRA v2.3 provides 73 reference organs and
  1,283 3D anatomical structures, with male and female variants. The bottleneck
  in this project is the data side, not the anatomy side — see the system table
  in `SCHEMA_VERIFICATION.md`.

## Getting the real model

1. **Source.** The HuBMAP CCF 3D Reference Object Library. Current release is
   **HRA collection v2.5** (2026-06-09), 38 organ groups across 83 GLB files.
   Format is **GLB only** (`model/gltf-binary`) — no OBJ or STL from HRA.
   Licensed **CC BY 4.0**. Paths below were verified by HTTP request on
   26 July 2026.

   **Portal (client-rendered — a fetch returns an empty `<hra-portal>` shell,
   so use a browser):**
   <https://humanatlas.io/3d-reference-library>, deep-linkable as
   `?version=2.5&organ=Heart`.

   **Machine-readable manifest** the portal itself loads, listing every asset
   URL — this is the reliable way to enumerate the release:
   <https://humanatlas.io/assets/content/3d-reference-library-page/data.yaml>

   **Whole-body GLB (one file, everything).** Simplest starting point, but
   large — budget for decimation:
   - Female — `https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb` (357 MB, 875 named nodes)
   - Male — `https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.10/assets/3d-vh-m-united.glb` (230 MB, 851 named nodes)

   **Per-organ GLB.** Versions are per-organ and independent; there is no single
   version across the library:
   ```
   https://cdn.humanatlas.io/digital-objects/ref-organ/{organ}-{sex}[-{side}]/{version}/assets/{file}.glb
   ```
   e.g. `.../ref-organ/heart-female/v1.3/assets/3d-vh-f-heart.glb` (1.7 MB),
   `.../ref-organ/lung-female/v1.4/assets/3d-vh-f-lung.glb` (22 MB).
   The filename prefix records provenance: `3d-vh-` Visible Human,
   `3d-allen-` Allen brain, `3d-nih-`, `3d-sbu-`.

   **Browsable digital objects** (content-negotiated; returns 404 to a bare
   `curl` with `Accept: */*`, which is a negotiation gap, not a dead link):
   <https://purl.humanatlas.io/ref-organ>

   > The DOI printed in HRA's own crosswalk (`10.48539/HBM626.BRWN.943`)
   > resolves at doi.org but its target 404s. Cite the purl instead.

2. **Take the crosswalk CSV — this is how nodes become ontology terms.**
   Every organ ships one, and there is a master file for all models:
   ```
   https://cdn.humanatlas.io/digital-objects/ref-organ/{organ}/{version}/assets/crosswalk.csv
   https://cdn.humanatlas.io/digital-objects/ref-organ/asct-b-3d-models-crosswalk/v1.10/assets/asct-b-3d-models-crosswalk.csv
   ```
   Columns are `node_name, OntologyID, label` (2,295 node rows in the master).
   This is exactly the node -> ontology mapping `AtlasBody` needs, and it is
   more reliable than reading terms out of glTF `extras`. Generate the term
   lookup from this CSV at build time rather than hand-writing it.

2. **Select the structures you need.** Only the systems that ship in Phase 1 need
   geometry: cardiovascular, musculoskeletal, respiratory, metabolic, and
   nervous. Systems rendering as "no data" (digestive, endocrine, reproductive,
   integumentary) still need geometry if you want to grey them out — decide that
   deliberately rather than by omission.

3. **Record the ontology ID for every structure you keep.** This is the load-
   bearing step. Each structure's ASCT+B / UBERON / FMA term goes into the
   corresponding system's `structures` array in the data (see
   `DATA_CONTRACT.md`). Do **not** invent a node-naming convention; do not rely
   on the GLB's node names for anything except debugging.

4. **Budget the geometry.** Target under ~150k triangles total for smooth
   mobile and standalone-headset rendering. Decimate in Blender or via
   `gltf-transform simplify` if the HRA meshes exceed that.

5. **Export / assemble GLB.** Metres, **+Y up**, subject facing **+Z**, single
   shared origin at the pelvis root — the canonical world convention from
   `HANDOVER_SPEC.md` section 5, which the viewer assumes. HRA is already
   to-scale; align its root to that origin rather than rescaling it. Save to
   `public/models/hra.glb`.

6. **Compress — and do NOT let it join meshes:**
   ```
   npm run convert:hra   # meshopt + webp, with --join false --instance false
   ```
   This writes `public/models/hra.opt.glb`, the path the `hra` entry in
   `src/scene/anatomySources.ts` declares and the app probes for. Drop it in and
   reload — no code change. (`npm run convert:z-anatomy` is the equivalent for
   the second atlas.)

   > **`--join false` is load-bearing, not a tuning flag.** `gltf-transform
   > optimize` runs a mesh-joining pass by default to cut draw calls. On the HRA
   > whole-body model that collapsed **956 organ meshes into 11**, discarding
   > every per-structure `extras` block with them. The app still loaded and still
   > rendered a body — it just resolved 11 meshes and coloured whole regions by
   > whichever organ's metadata happened to survive. Nothing errored. If you ever
   > see a body with implausibly few, implausibly large coloured masses, check
   > the mesh count in the `[AtlasBody]` console report first.
   >
   > Measured cost of keeping structures separate: 45.9 MB joined vs **66.8 MB
   > unjoined**, from a 374 MB source. Worth every megabyte — per-organ selection
   > and per-system colouring are the product.

7. **Budget check — the whole-body atlas does NOT fit.** The shipped asset is
   **7.19 million triangles** against the ~150k target in step 4: about 48×
   over. Decimation alone will not close it — `--simplify-ratio 0.08` with a
   loose error tolerance reached only 4.67M triangles (56 MB), because these are
   many small separate surfaces rather than a few dense ones. Vertex share:
   digestive 34%, nervous 21%, musculoskeletal 14%, reproductive 12%.

   So **subset to the structures the product shows** rather than shipping the
   whole atlas. Two levers, in order of payoff:
   - Drop or heavily decimate systems that render as a single colour anyway.
     The Allen brain is 374 of 948 meshes for one system.
   - Join meshes *within* a system before export. Structures inside one system
     share a colour and select as a unit, so joining there is safe — unlike the
     global `--join`, which destroys the cross-system metadata.

   Until that is done, expect a ~15 second load with the procedural body showing
   as the Suspense fallback.

## Wiring it in

Replace `<ProceduralOrgans/>` usage in `src/scene/Body.tsx` with a component
that resolves meshes to systems **through the ontology IDs in the data**, not
through node names:

```tsx
import { useGLTF } from '@react-three/drei'

const { scene } = useGLTF('/models/anatomy.opt.glb')

// Build ontology id -> SystemId once from the data, not from node names:
//   data.systems.flatMap(s => (s.structures ?? []).map(st => [st.id, s.id]))
// Then traverse the GLB, read each mesh's ontology id from its node extras
// (confirm where HRA puts the term on download — see step 1), look up its
// SystemId, and set material.color = scoreToColor(score) plus onClick.
```

Two rules the renderer must honour, both already enforced upstream of it:

- A system with `hasData: false` has `score: null`. Pass the null through to
  `scoreToColor` so it renders neutral grey. **Never substitute 0 or a midpoint.**
- A structure whose ontology ID is not present in any system's `structures` is
  unmapped, not unhealthy. Render it neutral and log the ID at debug level, so
  gaps in the mapping are visible during the swap.

Keep `metricColor.ts`, the store, and the UI unchanged. Only the geometry source
and the resolution step change.

## Attribution

HRA is **CC BY 4.0: attribution only, no share-alike**. Add the credit line to
the app footer and to a `public/models/NOTICE.txt`. Attribution is a release
requirement, not a nicety — it is in the definition of done in `CLAUDE.md`.

Because CC BY 4.0 carries no copyleft, the modified GLB does **not** have to be
redistributed under the same license, and no obligation reaches the MIT source
code. Still keep the asset as a distinct file in `public/models/`; never bake
geometry into a source file.

## The atlas is swappable

`src/scene/anatomySources.ts` is the registry: each atlas declares its GLB url,
licence, credit line, share-alike flag and term system, and `COMPOSED_SOURCE`
maps each `SystemId` to an atlas. `AttributionBar` renders the credits for
whichever atlas is active and offers a switch for visual comparison.

Two consequences for this pipeline:

- **Produce one GLB per atlas**, named to match the registry
  (`public/models/hra.opt.glb`, `public/models/z-anatomy.ao.glb`). Do not merge
  them — see the licence rule below.
- Adding an atlas means adding a registry entry and its GLB, not touching the
  scene, the store or the UI.

## Musculoskeletal: HRA cannot cover it (verified)

**Open question 3 is resolved, and the answer is negative.** Verified 26 July
2026 against the 875 nodes of the whole-body female GLB and the 2,295-row master
crosswalk — by enumerating nodes, not by reading prose.

**Skeletal structures HRA HAS:** the full vertebral column (C1-C7, T1-T12,
L1-L5, with intervertebral disks), the bony pelvis (sacrum, coccyx, ilium,
ischium, pubis, with compact and trabecular bone differentiated), sternum and
manubrium, and a detailed knee (femur, tibia, fibula, patella, meniscus,
cruciate and collateral ligaments). Plus hyoid and the laryngeal/tracheal
cartilages.

**Skeletal structures HRA LACKS** — zero hits across all 2,295 nodes:

> ribs, skull, cranium, mandible, maxilla, clavicle, scapula, humerus, radius,
> ulna, carpals, metacarpals, phalanges, tarsals, metatarsals

So no ribcage, no skull, no arms, no hands, no feet. The `VH_F_skeletal_system`
node exists but contains only spine, pelvis, sternum and knee.

**Muscle coverage is near-zero.** The entire skeletal-muscle inventory is
rectus femoris and the quadriceps tendon, the extraocular and ciliary muscles,
and the laryngeal muscles. No biceps, deltoid, pectoralis, gluteus, hamstrings,
gastrocnemius, trapezius, latissimus, psoas, rectus abdominis, erector spinae —
and **no diaphragm**.

This matters because musculoskeletal is one of the two best-evidenced systems in
the dataset (BodyLoop posture geometry plus Oura workload). HRA gives excellent
ontology-tagged viscera and a usable spine and pelvis; it cannot render the
system your strongest data describes.

**Therefore Z-Anatomy (CC-BY-SA 4.0, from BodyParts3D) is the source for
musculoskeletal**, and this stops being a contingency. Flip `musculoskeletal` to
`'z-anatomy'` in `COMPOSED_SOURCE` (`src/scene/anatomySources.ts`) and select
the `composed` mode.

**Licensing is settled: share-alike is accepted project policy** (26 July 2026),
because this project is open source. See `ASSETS_LICENSE.md` for what that still
obliges. The notes below are therefore engineering considerations, not blockers:

- **Publish the adapted model under CC-BY-SA 4.0** with a NOTICE file, and say
  what you changed. Expected, not a surprise.
- **Keep the atlases as separate GLB files.** Merging is now legally permitted
  (CC BY material may be remixed into a CC-BY-SA work), but separate files keep
  each credit attached to its own geometry and let either atlas be swapped
  without rebuilding the other.
- **Resolving Z-Anatomy to systems probably does NOT need a UBERON->FMA term
  crosswalk.** Z-Anatomy organises its content into per-system collections —
  skeleton, muscles, vascular, nervous, organs — labelled per Terminologia
  Anatomica. That is the same shape as HRA's `anatomical_structure_of` group
  keys, which reached 94% coverage, so add a `zAnatomyGroups.ts` alongside
  `hraGroups.ts` rather than building a term mapping. Confirm against the real
  export before committing to it.
- **If a term mapping does turn out to be needed**, do not hand-write it: UBERON
  publishes `xref: FMA:…` cross-references, so a UBERON<->FMA table can be
  generated from the ontology. Both are attribution-only (FMA is CC-BY-3.0), so
  deriving a mapping is unproblematic. Expect it to be lossy — FMA is
  human-specific and far finer-grained, and it models laterality as distinct
  classes (`Right femur`) where UBERON generally does not.
