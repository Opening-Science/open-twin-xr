# Roadmap

Written 27 July 2026, after the Z-Anatomy adoption landed. Ordered by what
unblocks the most, not by what is easiest.

The subject of this repository is the **body**: anatomy, geometry, materials,
lighting, XR, and eventually personalisation from a person's own imaging.
Health-data mapping stays part of the long-term plan but the data side lives
upstream in `etzm/open-twin` and the two reconcile later.

---

## Phase 1 — Structure identity

**This is the bottleneck. Almost everything below improves once it exists.**

### The problem

Every atlas is merged for draw-call budget, and merging throws the structure
names away:

| atlas | source structures | shipped meshes |
|---|---|---|
| Z-Anatomy | 2,077 | 3 |
| BodyParts3D | 2,235 | 11 |
| HRA (female) | 956 | 96 |

So hover reports `musculoskeletal / muscle` rather than `biceps brachii`;
clicking selects a whole system; the exploded view separates systems rather than
organs; and there is nothing to hang an ontology id on, which is what the
health-data join will eventually need.

Un-merging is not the answer: 2,077 draw calls is an order of magnitude over the
Quest budget, and draw calls are why the merge exists.

### Design

Keep one draw call. Add identity as data.

1. **`_STRUCTURE`, a per-vertex `uint16`.** 2,077 structures fits comfortably in
   65,535. Measured cost: 1.53 MB raw on Z-Anatomy, 2.61 MB on BodyParts3D,
   2.34 MB on HRA — before meshopt, which compresses an index-like attribute
   well.
2. **A side table in the glTF `extras`**, one entry per structure:
   `{ name, side, system, layer, centroid }`, plus `attachment` where the mesh is
   a muscle footprint. Index ranges are deliberately NOT in it — see below.
3. **Hover**: the raycast already returns `faceIndex`; read `_STRUCTURE` at any
   vertex of that face and look the entry up. Constant time, no search.
4. **Selection highlight**: index ranges per structure, derived at load by one
   pass over the id attribute, then `setDrawRange` on a second mesh sharing the
   geometry. One extra draw call, and only while something is selected.

### What the build actually taught us — status: DONE for Z-Anatomy

Two things in the plan above were wrong, and measuring beat reasoning both times.

**Ranges cannot be shipped in the table.** The first build recorded each
structure's `[firstIndex, indexCount]` during the merge. Downstream
`gltf-transform optimize --simplify` then rewrites the index buffer, so every
range is stale in the shipped asset — silently, with selection highlighting the
wrong geometry. Ranges are now derived at load from the attribute, which cannot
go stale because it *is* the geometry.

**Simplifying per part, before the merge, does not work.** It was built and
measured. Z-Anatomy's parts arrive **unwelded** — the connective group is 358,028
triangles across 1,074,084 vertices, exactly three per triangle — so no triangle
shares an edge with another and the simplifier has nothing to collapse. With
`LockBorder` it removed 0 %; without, 1.2 %; welding first only reached 61 %
unique. Against the 65 % the merged pipeline achieves, that is not a trade worth
making.

**And it turned out to be unnecessary.** Merge-then-simplify is safe *because*
the attribute exists: `weld` hashes every attribute, so two coincident vertices
in different structures differ in `_STRUCTURE` and are never merged. That leaves
structures topologically disconnected, so no collapse can cross a boundary and no
id is ever blended. The original pipeline order stands unchanged.

Measured on the shipped asset: 2,077 structures, every id carried by real
vertices, worst centroid drift 17.8 % of the structure's own extent, 4.74 MB →
5.15 MB for the ids. `npm run check:structures` asserts all of it.

**A third finding:** 637 of the 2,077 structures — 31 % — are muscle
**attachment sites**, the origin and insertion footprints Z-Anatomy paints onto
bone (`Extensor_digitorum_longuse1`–`e4` are its four toe slips). They ship
inside SkeletalSystem100, so they arrive labelled `layer: 'bone'`, and with the
side letter stripped their names read as typos ("Sartorius musclee"). Unlike the
`i`/`j` landmark markers these are genuine anatomy, so they are kept, named for
the muscle they belong to, and flagged `attachment: 'origin' | 'insertion'`.
**Open:** they are decals lying on the bone surface and probably want their own
toggleable layer rather than counting as bone. Left to the UI.

**A correction to that finding.** The 637 undercounts; it is 701.
Classification required the muscle name to exist once the suffix was stripped —
a deliberate guard, because real structures end in `e` — and when it failed the
mangled name shipped: hover on `z-anatomy.ao.glb` showed "Quadriceps femoris
musclee" and "Massetero" on 64 structures across 32 names. The guard is not
wrong, the muscle is missing: these are **composite muscles MuscularSystem100
only ships as their parts** — the quadriceps as rectus femoris plus three vasti,
the masseter as a deep and a superficial part, pronator teres as two heads — so
the base name genuinely does not exist and the lookup cannot succeed.
`build-z-anatomy.mjs` now falls back twice, each an existence check of its own
rather than a bare suffix match: the base ending in a tissue noun ("...musclee"
is not a plausible name in its own right), and the base's last word ending a
soft-tissue name elsewhere ("Masseter" from "Superficial part of masseter").
Each is counted in the build log. 32 structures by each rule, 637/637 previous
classifications unchanged. Two footprints are still named for their suffix by
choice — `Erector spinaeo` and `Trochanteric insertione`; catching two names
needs a rule loose enough to reach real structures.

The asset was rebuilt from the FBX for this — `npm run build:z-anatomy -- --src
~/Downloads/z-anatomy-fbx` then `npm run convert:z-anatomy`, ~20 min of which
15.5 is the AO bake — so the shipped `z-anatomy.ao.glb` carries the corrected
names. That source path is the one preserved off scratch below. Diffing its structure
table against the previous asset: **exactly 64 entries changed, every one a
`name`/`attachment` field, and zero differences in layer, mesh, side or
centroid.** The geometry is untouched; only the naming moved. `check:structures`
and `check:winding` both pass, and no name matches
`/(muscle|ligament|tendon|aponeurosis|fascia)[eo]\d*$/` any more.

If a future change to the classification needs re-verifying, the build log line
is the quick signal — `attachments: 701 (637 by name lookup, 32 by tissue noun,
32 by final word)`.

**A fourth finding, same importer, different rule.** Laterality is a name suffix
in Z-Anatomy — `l` and `r` — and stripping it blindly is wrong for the same
reason the attachment suffix was: a name can simply END in that letter. `Vomer`
is the case here. The vomer is a single midline bone, and reading its `r` as a
side shipped it as `{ name: "Vome", side: "right" }` — a structure name that does
not exist, plus a false claim about which side of the body it is on.

The fix is measured rather than a hardcoded exception, because the geometry
separates the two populations cleanly. For each l/r-suffixed mesh, take the share
of its own width lying on the thinner side of the midline: 0.5 for something
perfectly centred, ~0 for something lateral. Across all 1,971 such meshes:

```
Vomer                             0.500   midline bone, mis-split
Interspinales_lumborum_muscles*   0.137   highest genuine — paravertebral
Parietal_bone*                    0.091   meet at the sagittal suture
trapezius / platysma / latissimus 0.011-0.029
```

Everything from 0.011 to 0.137 is a real paraspinal or scalp muscle that merely
reaches across the midline, and each arrives as a mirrored `l`+`r` pair. Only the
vomer sits in the centred band, so the threshold goes in the empty gap — 1.8x
above the highest genuine value, 2x below the measured midline one. The build
logs what it caught (`midline: 1 l/r-suffixed mesh(es) are centred`), so a new
atlas shows its own count rather than inheriting this one's assumption.

Rebuilt and diffed against the previous asset: **exactly one table entry changed,
`Vome` -> `Vomer`, plus its `side` dropping; centroids identical and attachments
still 701.** Both gates pass. `build-bodyparts3d.mjs` needs no equivalent — it
carries no laterality suffix rule at all, because FMA names spell the side out
("left eleventh rib").

Three structures still carry a side and sit within 2 mm of the midline — the
procerus, longissimus thoracis and rectus capitis posterior minor footprints —
and that is correct: they do not straddle it, and the source labels them left.

### Verification

- Distinct `_STRUCTURE` values equals the number of parts merged. ✅
- Every table entry is carried by real vertices. ✅
- No structure's vertices drift off its own centroid — the signature of a
  blended id. ✅
- Triangle count and file size stay within a few percent. ✅
- Names, ids and positions are mutually consistent: 9 of 9 anatomical landmarks
  sit in the expected band of the body (frontal bone y=1.63, femur 0.65,
  calcaneus 0.03), with paired structures correctly showing two instances. ✅

### Runtime — also done

`AtlasBody` reads the ids back: hover names the structure under the pointer, and
selection highlights it with a second mesh sharing the same `BufferAttribute`
objects and a derived `drawRange`. Atlases without the attribute keep the old
per-group behaviour.

Ranges are derived at load, not shipped, for the reason above. Measured: all
2,077 structures survive simplification as a single contiguous run, so the
highlight draws exactly the structure — worst over-selection 1.0x.

**Not verified: interactive hover.** The automated browser pane delivers no
pointer events to the canvas — synthetic ones carry no `offsetX/offsetY`, which
is what r3f reads, and injected ones never arrive at all. The lookup it depends
on is verified above; the React wiring rests on the typecheck and on review.
Worth a human click.

### Still to do

Ids exist only in the Z-Anatomy importer. BodyParts3D and HRA still ship without
them, so hover there names the merged group. Both are gated behind a fresh AO
bake, roughly an hour per atlas.

**Both source atlases are already on this machine.** Preserved off scratch on
28 July 2026, because the Z-Anatomy FBX existed only under `/private/tmp`, which
gets cleaned — losing it would have cost a re-download for no reason:

```
~/Downloads/z-anatomy-fbx/          85 MB   SkeletalSystem100 / MuscularSystem100 /
                                            Joints100 / References100
~/Downloads/isa_BP3D_4.0_obj_99/    2,234 .obj files, one per structure
```

An earlier version of this section said the BodyParts3D source needed fetching
"— it is not on this machine". That was wrong; it had already been downloaded.
The archive below is the record of where it came from, not a step still to do:

```
https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/
  isa_BP3D_4.0_obj_99.zip      142.9 MB   one OBJ per structure, is-a tree
  partof_BP3D_4.0_obj_99.zip    64.9 MB   part-of tree
  isa_parts_list_e.txt           0.1 MB   FMA id -> file id -> English name
```

**Decide which release before downloading.** v4.0 has roughly twice the
structures but ships ONLY at 99 % decimation; v3.0 additionally offers a 95 %
build (`BodyParts3D_3.0_obj_95.zip`, 522 MB) with far better geometry. The
most-used community mirror deliberately stayed on v3.0, reporting that v4.0
"appears to have intersecting skin/muscle areas". Given the goal here is
identifiable individual structures, v4.0's coverage probably wins — but that is
a judgement to make by looking at the meshes, not from the release notes.

The parts list is already the join this project wants: `FMA7197 → liver`. That
makes BodyParts3D ids a crosswalk feed for phase 5 as well as a hover fix.

### Staging

**1a** — ids, table, hover and selection. No change to the exploded view.
**1b** — per-structure explode (see Phase 4), which needs the shader work.

---

## Phase 2 — Ambient occlusion for both HRA builds

Running now. Both HRA builds ship `POSITION` only, so they render flatter than
BodyParts3D and Z-Anatomy, and switching atlas visibly changes the lighting.
`scripts/bake-ao.mjs` on each, then point `anatomySources` at the `.ao.glb`.

No new code, ~20 minutes of compute each. The cheapest visible win here.

---

## Phase 3 — Z-Anatomy cardiovascular and lymphoid — **DONE, 28 July 2026**

Done, and it went further than the phase asked: **all four** remaining system
files are imported, not two. See **D12** for the licence decision that permitted
the fourth.

| file | outcome |
|---|---|
| `CardioVascular41.fbx` | tier 1, imported. ⚠️ suffix `41` not `100` — possibly a partial model, coverage unchecked |
| `LymphoidOrgans100.fbx` | tier 1, imported. Renders unresolved: `SystemId` has no `lymphoid`, deliberately |
| `NervousSystem100.fbx` | **split per structure** — see below |
| `VisceralSystem100.fbx` | tier 2, to `z-anatomy-nc.glb`. Needed per-mesh system classification; viscera span five systems |

**The warning below was right, and the scan it demanded found real
contamination.** `NervousSystem100.fbx` carries, alongside 578 good CC BY-SA
structures:

- 8 meshes of **inner-ear apparatus** — Cochlea, Vestibule, Tympanic membrane,
  Auditory tube — the CC BY-NC-SA Dundee component → tier 2
- 3 meshes of **white matter** — telencephalon and spinal cord — the University
  of Washington component with **no licence at all** → tier 3

`build-z-anatomy.mjs` now assigns tier per structure and writes three files.
Taking the file wholesale at tier 1, which is what "Z-Anatomy is CC BY-SA" invites
you to do, would have put both into the publishable asset.

Note the distinction that matters: the cochlear and vestibular **nerves and
nuclei** are Z-Anatomy's own and stay tier 1. Only the **sense organ** is the
licensed component. A substring match on "cochlea" quarantines brainstem anatomy
that is perfectly open.

> **Original phase text, kept because its instruction was the load-bearing part:**
>
> From the licence file, the non-open components are the **kidney** (CC BY-NC
> 4.0) and the **inner ear** (CC BY-NC-SA 4.0), plus "Brainder"/"White matter"
> from the University of Washington, which are listed with **no licence at all**
> — worse than NC for bundling, since silence is not permission.
>
> **Do not take this on the licence file's word.** The mapping from component to
> file is an inference. Scan both FBX files for kidney, renal, cochlea, labyrinth
> and white-matter mesh names first, and only import if they are absent.

**Still unresolved:** `SkeletalSystem100.fbx` contains Incus, Stapes and Malleus.
They are middle-ear bones and belong in a skeleton, so they are probably
Z-Anatomy's own — but they are also ear geometry, and nobody has checked the
component-to-file mapping against upstream's `License.txt`. They have been in the
shipping tier 1 asset since D11a. Recorded in `licences.json`; resolve before any
public release.

---

## Phase 4 — Per-structure exploded view — **DONE, 28 July 2026**

The explode slider now moves individual structures on any atlas carrying
`_STRUCTURE`, which is Z-Anatomy and the body-regions atlas. The whole-mesh CPU
path remains for atlases without per-vertex ids (BodyParts3D, HRA) and stands
down where the per-structure path is available, so the two never add up.

**Offsets are precomputed at load and written as a per-vertex attribute**
(`aExplode`), so the vertex shader is one line — `transformed += aExplode *
uExplode` — and dragging the slider writes a single shared uniform. No per-frame
CPU work, no material rebuild.

### ⚠️ Why an attribute and not the centroid texture this phase proposed

The plan below was to put structure centroids in a `DataTexture` indexed by
`_STRUCTURE`. **That does not work on the shipped asset**, and the reason is
worth keeping: the atlas uses `KHR_mesh_quantization`, and gltf-transform
quantises **per mesh**. Measured node scales on `z-anatomy.ao.glb` run from
0.0823 (reproductive) to 0.8463 (muscle), so object space differs mesh to mesh
and the structure table's canonical-metre centroids cannot be fed to a shader
shared across meshes without per-mesh correction.

Computing each offset in its own geometry's space sidesteps that. The body centre
is still computed in canonical space across every mesh, or each mesh would
explode about its own centre and the body would not separate.

Cost: 12 bytes per vertex, and one pass over positions at load.

### The "confetti" question this phase said to settle first — settled by measuring

The concern was that 2,000+ structures exploding individually is confetti rather
than an anatomical illustration, and that a grouping level above the leaf would
be needed first, possibly out of the Phase 5 crosswalk. **It does not bite.**

The only sub-structure noise is the attachment decals — 637 of 3,617 structures,
18 % — and they sit a **mean 3.1 cm** from their nearest bone's centroid (worst
10 cm). At the 1.6× explode gain that is a ~5 cm relative drift on a 1.7 m body.
So per-structure explode works directly, with no grouping level and no dependency
on Phase 5. If the decal drift ever reads badly, anchoring those 637 to their
nearest bone is computable at load — 637 × 344 distances — and needs no rebuild.

> **Original phase text, for the reasoning that still holds:**
>
> The explode offsets whole merged meshes from the CPU, displacing each by how
> far its centre sits from the body's. That works on BodyParts3D, whose eleven
> groups are organs sitting off-centre. It does **nothing at all on Z-Anatomy**:
> its three groups each span the whole body symmetrically, so each group's
> centroid lands exactly on the body axis. Measured at 45 % explode, all three
> report `offCentre: 0`, and the slider moves them not at all.

---

## Phase 5 — Structure name → UBERON crosswalk

Depends on Phase 1, which is what makes ~1,824 Z-Anatomy names reachable at all.

Z-Anatomy carries no ontology terms — names are Terminologia Anatomica English
with `l`/`r`/`j` suffixes (D11). BodyParts3D is FMA-indexed and HRA mixes UBERON
and FMA, so a crosswalk is what lets the three atlases agree on what a structure
*is*, and is the join the health data will eventually need.

Large and mostly mechanical. Worth doing incrementally: the organs that matter
first, the long tail later. It should not block Phases 1–4.

---

## Phase 6 — A complete female body

**Currently unsolved, and worth stating plainly rather than leaving implied.**

HRA is now the only atlas with a female donor, and HRA has no skull, ribs,
clavicle, scapula, humerus, radius, ulna, hands or feet — verified across node
names and `extras` in both sexes. BodyParts3D and Z-Anatomy are both TARO, and
male. So selecting *female* yields a torso-and-legs body, while a complete body
is only available male.

No open female musculoskeletal source has been found. The options are to
segment a female CT with MRSegmentator or TotalSegmentator and mesh the result
(which reopens the licence questions those tools carry), or to treat it as a
target for Phase 7 rather than an atlas-sourcing problem. Blocked on external
data either way — do not let it hold up Phases 1–5.

---

## Phase 7 — Personalisation from imaging

The original direction: deform the atlas to a specific person from their own
DICOM — MRI, CT, ultrasound, or a surface body scan — so the twin is theirs
rather than a reference body. See `docs/PHOTOREALISM_AND_PERSONALISATION.md`.

Note what was already ruled out: **cadaver CT cannot yield an organ atlas**
(D10). The Visible Human CT has ~60 HU of noise against the 10–30 HU that
separates soft-tissue organs, and a cadaver has no circulation, so no contrast.
That walked back an earlier decision of my own; do not re-propose it.

---

## In flight

A separate session is trimming the composed atlas so it stops downloading both
full atlases and hiding ~1M triangles it never draws. That touches
`AtlasBody`/`Body` loading, so it will conflict with Phase 1 — land it first.
