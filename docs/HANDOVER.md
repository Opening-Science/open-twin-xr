# Handover

Written for someone — or something — picking this repository up cold. It assumes
no memory of the conversations that produced it.

Read this before `CLAUDE.md`, whose top box is accurate but whose body predates
the scope change.

> ## ⚠️ START HERE — two plan documents, and two decisions not to re-litigate
>
> Two lines of work ran in parallel in July 2026 and were merged; nothing was
> dropped. **There are two plan documents and they cover different things:**
>
> | doc | covers | state |
> |---|---|---|
> | `docs/PLAN_NEXT.md` | the 21 numbered repo-quality items | phases 0–1 done, **19–21 not started** |
> | `docs/reports/` | five technical reports | the findings from the finished geometry queue, plus the licence and ontology positions |
>
> Two things the merge decided, so they do not get re-litigated:
>
> - **`AnatomySource.heightFrom` no longer exists.** `registration` replaced it —
>   see the `fit` memo in `src/scene/AtlasBody.tsx` for why, and note that
>   `PLAN_INTEGRATION.md` describes the field it replaced.
> - **Organ overlays are a separate mechanism from atlases** and live in
>   `src/scene/organOverlays.ts`. They supersede atlas geometry by node where the
>   atlas has one (HRA) and by a per-vertex `_STRUCTURE` shader mask where it does
>   not (Z-Anatomy). **BodyParts3D can now be masked too**, since its 8 August 2026
>   rebuild gave it `_STRUCTURE` and a structure table; this line used to say it
>   could not.
>
> **B3 is now done and D4 is answered** — photographic tissue colour survives this
> pipeline. The OpenEar temporal bone renders as an organ overlay with colour
> sampled from its own micro-slicing photographs. The unwrap that blocked it was a
> units bug, not the shared-atlas problem the notes predicted; the whole finding is
> in `docs/PLAN_INTEGRATION.md` (B3).
>
> **~~One email to send~~ SENT AND ANSWERED, 18 August 2026 (D21).** The beating
> heart's demo case is a CARDIOHANCE participant with local ethics approval to
> share online and no restrictions — confirmed in writing by the corresponding
> author. It ships publicly, crediting the repo and Dillon et al. 2026,
> *Medical Image Analysis* 114:104252. See the `biv-heart` entry in `licences.json`.
>
> **~~Known limitation worth picking up:~~ FIXED, 8 August 2026 — and the
> predicted fix was the wrong one, which is the interesting part.** The one-sided
> ear overlay could not mask the structures it replaces without blanking the other
> ear. This note used to say ontology terms were the fix. **They are not:
> measured on the shipped asset, not one of the eight ear structures carries an
> `ontologyid` at all.** What every one of them does carry is `side`.
>
> Two things had to change, and neither was the crosswalk. `supersedesStructures`
> gained a `side` filter; and the mask stopped being a contiguous id RANGE, because
> the two ears interleave — the right ossicles are 451, 455 and 456 — so no
> `{lo, hi}` could ever have expressed one ear. It is now a per-structure texture
> (`src/scene/structureMask.ts`), which also carries the per-structure tint.
>
> **Also corrected:** this note claimed Z-Anatomy carries none of the crosswalk
> terms in the shipped asset. It carries **1,048 of 3,614**, written by
> `scripts/apply-crosswalk.mjs`, and `docs/ONTOLOGY_MAP.md` had been generated
> against an older build and said zero. Nothing in `src/` read the field, which is
> why the contradiction survived. Both are fixed: the map is regenerated, and the
> app now reads and displays the term.
>
> **And one conflict that document found:** the schematic eye was built on the
> premise that no atlas here contains an eyeball. That stopped being true when
> Z-Anatomy's nervous system was imported — it has a complete bilateral globe — so
> switching the eye on over Z-Anatomy currently draws two overlapping eyeballs. The
> masking is feasible (20 contiguous structures) and is deliberately not wired up,
> because it would trade anatomy for optics; see the note on `schematic-eye` in
> `src/scene/organOverlays.ts`.

---

## What this is, and what it is not

**An open-source human body viewer with WebXR.** Anatomy, geometry, materials,
lighting, and eventually personalisation from a person's own imaging.

**It is not a health dashboard, and this trips people up.** The repo *looks* like
one — there is a `SystemScore`, a health colour mode, a scoring UI under
`src/ui/` — but scoring moved upstream to
[`etzm/open-twin`](https://github.com/etzm/open-twin) under **D8**. This app
consumes an already-scored `TwinMetrics` and asks no questions about how the
numbers were reached. The unmounted scoring components are kept for a later
iteration; do not rebuild them here.

The bundled `public/data/sample-twin.json` is **fictional**. Never present it as
anyone's measured health.

## Getting it running

```bash
npm install && npm run dev
```

It runs with **no assets at all**, on procedural placeholder geometry. Atlases
are gitignored — see "Assets" below. A missing atlas is a supported state: the
app falls back and the switcher says "not installed".

```bash
npm run typecheck   # tsc -b
npm run build       # tsc + vite, prunes unshipped models from dist
```

```bash
npm run lint          # eslint
npm run test          # vitest — the lexicon tests
npm run lint:claims   # health-claim creep in user-facing copy
```

⚠️ **This section used to say "there is no linter".** That was stale: eslint is
installed and `npm run lint` passes, and the `eslint-disable-next-line` comments
in the source are load-bearing rather than inert — `AtlasBody`'s material effect
depends on one.

`vitest` and `lint:claims` were added on 8 August 2026. The claim lint is the
only gate that can run in CI (the asset gates need GLBs, which are not
committed), and it guards the repository's SCOPE: D8 moved health interpretation
upstream and D15 took health language out of the interface, and nothing
previously stopped either creeping back through a helpful tooltip.

The warning about dependencies still stands — `npm install` re-resolves every
caret range, which is how this app has broken before. vitest was added with
`--save-exact` and the lockfile diffed to confirm **zero** pre-existing packages
moved.

## Layout

| path | what lives there |
|---|---|
| `src/scene/` | Three.js. `BodyScene` is the Canvas + `<XR>`; `AtlasBody` loads and renders an atlas; `anatomySources.ts` is the atlas registry |
| `src/scene/organOverlays.ts` | The overlay registry — single organs placed on top of any atlas. `OrganOverlay.tsx` mounts them |
| `src/ui/` | One file per panel. `App.tsx` composes them. `AttributionBar.tsx` is the switcher **and** the credits; `SourcesModal.tsx` is the full provenance dialog |
| `src/data/` | `schema.ts` is the contract boundary; `adapter.ts` maps upstream shapes to it |
| `src/store.ts` | Zustand: selection, visibility, explode, x-ray, colour mode |
| `scripts/` | Asset pipeline. Node ESM, run by hand, never in CI |
| `licences.json` | The rights register. Authoritative |

## The atlases

Seven registered sources, five donors, and **they are different people** —
switching atlas switches whose body you are looking at. `anatomySources.ts`
declares each donor so the UI can say so rather than leaving a viewer to notice.

The **terms** column is split deliberately, because the difference is the thing
currently blocking the next milestone: a crosswalk in `docs/` is not a join the app
can make. Only what is in the asset is reachable at runtime.

| atlas | donor | terms in the ASSET | crosswalk in `docs/` | notes |
|---|---|---|---|---|
| BodyParts3D | TARO, adult Japanese male, 2 mm MRI | **FMA, 1,838 of 1,838 (100 %)** | FMA, 1,838 rows | The default, **rebuilt 8 August 2026**. Every structure carries an FMA id and a centroid, so hover names "right adductor magnus" rather than "musculoskeletal / muscle". Still 11 draw calls — the ids ride in the structure table and `_STRUCTURE`, not the node graph. Load 2.9 s → 4.3 s; the per-structure explode precompute that this atlas previously skipped is now deferred to an idle callback (1.54 s, off the first-paint path). See ROADMAP Phase 5 |
| Z-Anatomy | TARO again, retopologised | **FMA, 1,048 of 3,614 (29 %)** | FMA, 676 rows | **3,614** structures across 7 system files in the shipped `--publishable` build; 3,617 in the full research build. Written by `apply-crosswalk.mjs`; the rest of the table is unmapped crosswalk, not a pipeline failure |
| Z-Anatomy regions | TARO | none | none | 257 named body-SURFACE regions |
| HuBMAP HRA (f + m) | Visible Human Female / Male, 0.33 mm | **UBERON, 89 %** | via HRA's own crosswalk CSVs | No skeleton above the pelvis |
| CT (female) | TCIA Healthy-Total-Body-CTs subject 003, F 26 | **UBERON, 100 %** | UBERON, 33 rows | The first complete female body. Real scale, arms raised, grouped labels |
| CT atlas | ⚠️ unidentified | **UBERON, 100 %** | UBERON, 139 rows | Segmented with MOOSE. Source scan unrecorded, so not publishable |

## The organ overlays

A newer mechanism, and a different one: an atlas is a choice of *body*, an overlay
is additive on top of whichever body is showing. They live in
`src/scene/organOverlays.ts` and mount as siblings of `AtlasBody`.

⚠️ **Every overlay is a different person from the body it sits in**, and that is
stated in the UI rather than left to be noticed. They are drawn at their own
measured size, never scaled to fit.

| overlay | donor | what it adds that no atlas here has |
|---|---|---|
| Beating heart | biv-me demo subject, cine MRI | **Time.** 25 cardiac phases as morph targets, with an adjustable rate. ⚠️ Provenance unconfirmed upstream — not publishable |
| Schematic eye | nobody — generated | The only asset here this project owns outright, computed from published radii and conics |
| Ear (photographic) | OpenEar specimen ZETA, one right temporal bone | **Real colour.** Surface colour sampled from the specimen's own micro-slicing photographs at 50 µm |

Placement is per-atlas and **measured**, not eyeballed — the canonical frame makes
atlases the same *size*, not the same *person*, and the same organ sits 29.3 mm
apart between two donors. `scripts/place-overlay.mjs` fits an overlay to an atlas
from corresponding landmarks and can re-verify a stored placement:

```bash
node scripts/place-overlay.mjs --overlay public/models/openear-zeta.glb \
  --atlas public/models/z-anatomy.ao.glb --pairs ear \
  --verify "-0.0288,1.5886,-0.047" "0.155467,0.02999,0.981562,0.107081"
```

## The asset pipeline

```
FBX / OBJ  →  build-*.mjs   →  gltf-transform optimize  →  bake-ao.mjs  →  *.ao.glb
                (assemble)       (simplify + meshopt)        (per-vertex AO)
```

**Rebuilds are expensive and that shapes everything.** A full AO bake is ~52 min
for Z-Anatomy and ~2 h for HRA, and it is **single-threaded** — measured at 99.3 %
of one core, so more cores do not make one bake faster. Batch every change that
needs the same asset into ONE bake.

⚠️ **Do not run two conversions concurrently.** The constraint is RAM, not cores:
`gltf-transform optimize` holds decoded geometry plus working copies, 1–2 GB for
a 400–550 MB source. Two at once died silently here.

`scripts/restrength-ao.mjs` re-maps a baked asset to a different AO `--strength`
**without re-casting a ray**, because the term is a linear function of the
occlusion fraction. Never bake an hour to move that number.

## The invariants, and what breaks if you ignore them

Each of these exists because it already went wrong once.

**`_STRUCTURE` identity.** Every atlas ships a per-vertex `uint16` id plus a table
on the scene extras. It is what lets hover name "biceps brachii" rather than the
merged group. Simplify can blend ids across a boundary, weld can merge across
one, and a quantiser can corrupt them outright — none of which fail loudly.
`npm run check:structures` asserts it.

⚠️ **The structure table is addressed BY POSITION.** `_STRUCTURE` holds an index
into `scene.extras.structures`; entries carry no explicit `id`. Deleting or
reordering a row silently renumbers every structure after it — the worst class of
bug this asset can have, because it produces confidently wrong names rather than
an error. Append, or rebuild. Never splice.

⚠️ **A mesh without `_STRUCTURE` is usually FINE, and misreading that costs
hours.** The attribute exists to recover identity that *joining* destroys. A mesh
that was never joined never lost anything — it keeps its own node, name and
extras, `ontologyid` included — so `strip-atlas.mjs` deliberately leaves
single-node groups alone. HRA has 52 such meshes. They are reported with `·`, not
`✗`. Only an *unnamed* mesh with no id is genuinely anonymous.

**Metadata changes do not need a rebuild.** An ontology term lives in the JSON
chunk and says nothing about geometry, so `scripts/apply-crosswalk.mjs` edits
that chunk and copies the BIN chunk through byte for byte. Rebuilding instead
would cost an AO bake *and* push every vertex back through simplify, weld and
quantise — each of which can corrupt `_STRUCTURE` without failing loudly. Run
`check:structures` before and after: the numbers should be identical.

**Winding.** No atlas ships a `NORMAL` attribute; normals are computed from
triangle winding at load. An importer that bakes a mirrored transform without
reversing triangle order leaves half the body inside-out, which reads as a
lighting bug. `npm run check:winding` asserts it.

**Canonical frame.** Everything is metres, +Y up, facing +Z, feet at y=0, scaled
to 1.70 m. Measure that scale over the BODY only — including the surface-region
patches once stretched the bounds and shrank the skeleton 2 %.

**Licence provenance.** Per-structure `component` tags, written into the asset.
`npm run check:licences` reads them back out of the shipped GLB to regenerate
`docs/LICENCE_LOG.md`.

⚠️ **What the checks do NOT guarantee.** They validate the *asset*. During one
investigation `check:winding` and `check:structures` were green throughout while
the abdomen rendered as a point cloud — and they were right. The fault was in the
render path (see D13). **When the asset passes its checks, look at the renderer.**

## Rights

Every atlas here is redistributable, but not identically, and Z-Anatomy is an
**aggregate** — most of it is its authors' CC BY-SA work, and a few components
are not.

<!-- BEGIN GENERATED COMPONENT TABLE -->

<!-- generated by scripts/gen-component-table.mjs — do not edit by hand -->

| component | rights holder | licence | structures | publishable |
|---|---|---|---|---|
| bodyparts3d — own geometry | The Database Center for Life Science (DBCLS) | CC BY 4.0 | 1,838 | yes |
| z-anatomy — own geometry | Z-Anatomy authors | CC BY-SA 4.0 | 3,607 | yes |
| Anatomy of the Inner Ear | University of Dundee School of Medicine | CC BY-NC-SA 4.0 | 4 | non-commercial only |
| Kidney | lissiecowley | CC BY-NC 4.0 | 4 | non-commercial only |
| Brain for Blender — white (grey/white boundary) surface | Anderson M. Winkler (Brainder) | CC BY-SA 3.0 | 2 | yes |
| z-anatomy-regions — own geometry | Z-Anatomy authors | CC BY-SA 4.0 | 257 | yes |
| hra — own geometry | HuBMAP Consortium | CC BY 4.0 | no table | yes |
| hra-m — own geometry | HuBMAP Consortium | CC BY 4.0 | no table | yes |
| ct-atlas-f — own geometry | University Hospital Leipzig contribution to ENHANCE.PET 1.6k (subject 1032); ENHANCE.PET consortium | CC BY 4.0 | no table | yes |
| htb-ct-f — own geometry | TCIA Healthy-Total-Body-CTs collection authors | CC BY 4.0 | no table | yes |
| biv-heart — own geometry | University of Auckland Heart Mechanics Research Group | Apache-2.0 | 3 | yes |
| schematic-eye — own geometry | open-twin-openXR (this project) | None required — generated by this project | 3 | yes |
| openear-zeta — own geometry | MED-EL / University of Bern (Sieber et al.) | CC BY 4.0 | no table | yes |

Counts are read from the shipped GLB, not from the register — they are what
actually ships. Regenerate with `node scripts/gen-component-table.mjs`.

<!-- END GENERATED COMPONENT TABLE -->

Three rules that are easy to get wrong:

1. **A login wall is not an exemption.** Serving to authenticated users is
   distribution.
2. **"Open source" and "non-commercial" are different claims.** The CC BY-NC
   components mean the bundle is *open source, non-commercial* — **not** Open
   Definition conformant. Say so; do not badge it CC BY-SA.
3. **Attribution cannot create a grant.** A component with no licence statement
   grants nothing, however well you credit it. `--publishable` drops exactly
   those and keeps the rest.

## How health markers map to organs

The part most likely to be misread, because the repo looks like it does this and
currently cannot do it fully.

**1. Where data comes from.** `etzm/open-twin` emits **FHIR R4 Bundles of raw
Observations and no scores**. Scoring and terminology mapping belong there (D8).

**2. The boundary.** This app consumes `TwinMetrics` (`src/data/schema.ts`):
a list of `SystemScore`, each with `id`, `score`, `hasData`, and a `structures`
array of **ontology ids** — `{ id: "UBERON:0002107", label: "liver" }`. Never
mesh-node names: the join must survive a model swap.

**3. What works today — marker → system.** `AtlasBody` builds a term→system map
from `data.systems[].structures[]`, then resolves each mesh in this order:

```
ontology term (from the health data)   ← preferred, cross-atlas
  → the atlas's own group key          ← e.g. HRA's anatomical_structure_of
  → the atlas's own term table         ← fills gaps, e.g. HRA's renal calyces
```

A resolved mesh takes its system's colour in health mode. **Whole system, not
structure** — clicking the liver selects "digestive".

**4. What is missing — marker → structure.** Highlighting the *liver* rather than
the digestive system needs an ontology id per structure. The state of that:

| atlas | per-structure terms |
|---|---|
| BodyParts3D | ✅ FMA on all 1,838 |
| HRA | ✅ UBERON |
| CT atlas | ✅ UBERON |
| Z-Anatomy | ⚠️ **FMA on 1,048 of 3,614 (29 %)** — the rest are termless |

Z-Anatomy was the whole gap; it is now a partial one.
`scripts/build-crosswalk.mjs` closes it by joining against **BodyParts3D — the
atlas Z-Anatomy was retopologised from**, so the two describe the same donor and
a name match is a real correspondence rather than a guess. It emits
`docs/z-anatomy-fma.tsv`; `scripts/apply-crosswalk.mjs` writes those terms into a
built asset.

**Exact matches only, after normalising punctuation, case and a short fixed
synonym list. No fuzzy matching, ever** — a wrong ontology id is worse than a
missing one, because missing is visibly missing and wrong is silently trusted.
Laterality is the subtle part: BodyParts3D embeds "left"/"right" in the label
while Z-Anatomy keeps a separate `side`, and FMA gives left and right *different*
ids, so they are matched per side rather than collapsed. Missing that is what
held the first attempt at 7 %.

⚠️ **Two numbers here were wrong, and in different ways — re-measure before
quoting them.** This table said "676 of 2,916 (23 %)". `676` is the ROW count of
`z-anatomy-fma.tsv`, not the number of structures tagged: one row is a name+side
pair and tags every structure matching it, so 676 rows carry **1,048** structures.
And `2,916` predates the `NervousSystem100.fbx` import — the asset ships **3,614**.
`npm run gen:ontology` prints all of these from the shipped GLB.

**29 % is closer to the ceiling than it looks.** BodyParts3D names only 1,838
structures against Z-Anatomy's 3,614, so about 1,776 — nearly half — have no
counterpart to match at any quality of matcher. **The name-join ceiling is
therefore ~51 %**, and 29 % of it is already taken. Two shortfalls are real findings rather than
matcher bugs: BodyParts3D contains **no patella at all**, and the atlases differ
on terminology the synonym list does not yet cover. The remaining route to full
coverage is a dedicated FMA/UBERON pass, not a better string algorithm.

The geometry side was already done — `_STRUCTURE` ids exist, so once a structure
has a term, highlighting it is a lookup.

**5. The honesty rules that must survive.** Missing data is `hasData: false,
score: null`, rendered as "no data" — **never 0, never a midpoint**.
`assertTwinMetrics()` enforces it; do not weaken it.

And **absent data must not change the anatomy**. Unscored organs were once
ghosted to 45 % opacity, which the `alphaHash` dither rendered as a cloud of
specks — the body dissolving because a number was missing (D13). Ghosting now
happens only in `health` colour mode. Do not make it a default again.

## Where to look next

`docs/README.md` is the documentation index and says which documents are current.
`docs/DECISIONS.md` records what was decided and, more usefully, what was
reversed and why — read it before proposing a change, because several obvious ideas
were tried and undone. `docs/DEPLOY.md` covers shipping it.

⚠️ **This paragraph used to name the live queues, and it was wrong on both
counts** — it said "D1–D13" when the log had reached D26, and called
`PLAN_INTEGRATION.md` live long after all five of its items had landed. The same
box in `CLAUDE.md` went stale the same way, twice. **A count and a plan list are
exactly the things that rot in prose**, so neither is restated here: the index
has them, and it is maintained.

If you change anything in the pipeline, run all three checks and read
`docs/LICENCE_LOG.md`'s action list before publishing anything.

## Good first tasks

Ordered by how much you learn per hour spent, not by importance. Each is real work
that is genuinely wanted, and each is small enough to finish.

**1. Write the FMA terms into the Z-Anatomy asset.** *(the highest-value item here)*
`docs/z-anatomy-fma.tsv` maps 676 structures to FMA and `build-z-anatomy.mjs`
already writes a per-structure table into the GLB — it just does not carry the
term. Join the two on name + side and add an `fma` field. Then the same for
BodyParts3D, whose crosswalk covers all 1,838 source meshes. This is what unblocks
everything in `docs/ONTOLOGY_MAP.md`, and it teaches you the asset pipeline
end to end. ⚠️ Needs a Z-Anatomy rebuild, so read the bake warnings above first.

**2. Make overlay superseding side-aware.** Overlays hide the anatomy they replace
by matching structure NAMES, and Z-Anatomy names both ears' ossicles identically —
so the one-sided ear overlay cannot hide anything without blanking the other ear.
The structure table already carries `side`. Smaller than task 1 and it fixes a
visible defect.

**3. Decide the schematic eye conflict.** Switching the eye overlay on over
Z-Anatomy currently draws two overlapping eyeballs, because Z-Anatomy gained a full
globe when its nervous system was imported and nobody re-checked the overlay's
assumption. The masking is feasible — 20 contiguous structures — but doing it trades
anatomy for optics. Read the note on `schematic-eye` in `organOverlays.ts` and make
the call. **A judgement task, not a coding one**, which is why it is worth doing.

**4. Tidy the switcher at narrow widths.** The atlas pill row overlaps the
appearance and region controls when the 3D pane is narrow — observed at 824 px wide
and clear by 1440 px, so the breakpoint is somewhere between. Pure front-end,
self-contained, and you will have the app running and understood by the end of it.
When it looks right, regenerate the README image with `npm run gen:preview`: it is a
photograph of the running app, so it goes stale with the UI.

**5. Give `openear-zeta` its own ambient occlusion.** Every atlas gets a per-vertex
AO bake; the ear does not, because its colour is photographic and folding occlusion
into the photograph would destroy the measurement. Keeping them in separate channels
and multiplying at render time is the intended answer — `bake-ao.mjs` and the note
at the top of `build-openear.mjs` are the starting points.

Two things deliberately **not** on this list: do not build the AI layer
(`ChatbotStub.tsx` is a visual stub on purpose, and there are no LLM calls in this
repository), and do not rebuild the scoring UI — those components are unmounted
under `src/ui/` on purpose and belong to a later iteration.
