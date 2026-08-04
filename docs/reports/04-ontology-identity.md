# Report 04 — Structures are addressed by name, and what that costs

Dated 29 July 2026. The next milestone for this project, and the reason it is a
milestone rather than a chore.

---

## Abstract

This viewer can name 3,614 individual anatomical structures while drawing them in
eleven draw calls. That is the achievement the body milestone was about. But those
structures are addressed by **name** — by string — and this report is about what
that costs, now that the interesting work has started running into it.

The finding that matters: **the crosswalks exist and the assets do not carry them.**
This repository holds 1,408 distinct ontology terms mapping structures to FMA and
UBERON. The two richest atlases carry **none of them** in the shipped file. A
crosswalk in `docs/` is not a join an application can make.

That gap is not research. It is a change to two build scripts.

---

## Method

`docs/ONTOLOGY_MAP.md` is **generated** by `npm run gen:ontology`, which reads the
four crosswalk TSVs and then opens every shipped GLB to check what the asset
actually carries. The distinction between those two sources is the whole point of
the exercise.

The generator also reads each overlay asset's own structure names and matches them
against the crosswalks, so the report can say what an overlay *could* declare rather
than what someone believes it could.

---

## Findings

### 1. Two nomenclatures, because there are two lineages

Not a design choice. BodyParts3D and its derivative Z-Anatomy are addressed in
**FMA**; everything segmented from imaging — the CT atlases and HRA — speaks
**UBERON**. Any cross-atlas operation therefore needs both, or an FMA↔UBERON bridge
this repository does not yet have.

| crosswalk | vocabulary | rows | distinct terms |
|---|---|---|---|
| `bodyparts3d-system-map.tsv` | FMA | 1,838 | 1,295 |
| `z-anatomy-fma.tsv` | FMA | 676 | 618 |
| `moose-uberon-crosswalk.tsv` | UBERON | 139 | 103 |
| `healthy-total-body-cts-crosswalk.tsv` | UBERON | 33 | 33 |

**1,408 distinct terms across 9 body systems** after deduplication.

### 2. The gap: the richest atlases carry no terms at all

| asset | structures | carry a term | where the term is |
|---|---|---|---|
| `hra` | 96 mesh nodes | 85 (**89 %**) | node `extras.ontologyid` |
| `hra-m` | 85 mesh nodes | 76 (**89 %**) | node `extras.ontologyid` |
| `htb-ct-f` | 33 | 33 (**100 %**) | node `extras.ontologyid` |
| `ct-atlas-f` | 109 | 109 (**100 %**) | node `extras.ontologyid` |
| **`z-anatomy`** | **3,614** | **0** | **nowhere — name only** |
| **`bodyparts3d`** | 11 merged nodes | **0** | **nowhere — name only** |
| `z-anatomy-regions` | 257 | 0 | nowhere |

The two atlases with the most structures are the two with no terms in the asset.
BodyParts3D's FMA ids were **dropped when its 1,838 meshes were merged to eleven
draw calls** for the draw-call budget — the identity survived as a name, the term did
not. Z-Anatomy never had them written in, though the crosswalk for 618 of its
structures sits in `docs/`.

**So the terms exist and are unreachable at runtime**, which is the worst of both
positions: the work of mapping has been done and none of it is usable.

### 3. What name-addressing actually breaks

This is not hypothetical. Three concrete failures, all live:

**a) A one-sided overlay cannot mask its own side.** Z-Anatomy names the left and
right ossicles **identically** — `Malleus`, `Malleus`. A name test cannot distinguish
them, so the OpenEar overlay, which is a single right temporal bone, cannot hide the
structures it stands in for without blanking the *other* ear too. It therefore hides
nothing and renders alongside the atlas's own ear. The structure table already
carries `side`; a term carries side natively.

**b) Many-to-one correspondences are invisible.** Z-Anatomy has one `Cochlea` where
OpenEar has two — `Scala Tympani` and `Scala Vestibuli`. A string comparison sees no
relationship. In both FMA and UBERON the scalae are *parts of* the cochlea, which is
exactly the kind of relation an ontology expresses and a name cannot.

**c) Cross-atlas mapping has to go through strings.** Composing systems from
different atlases, or mapping a health marker to an organ, currently joins on names
that were never designed to agree between two independent modelling efforts.

### 4. A conflict the generated map found

The schematic-eye overlay was built and documented on the premise that **no atlas
here contains an eyeball**. That was true of the three-file Z-Anatomy build, and
stopped being true when `NervousSystem100.fbx` was imported. Nothing re-checked it
until this map was generated.

Z-Anatomy carries a complete bilateral globe under `nervous`: cornea, lens, retina,
sclera, iris, vitreous body, zonular fibres, both segments and the anterior chamber —
**20 structures at ids 2631–2650, which are contiguous** and could therefore be
masked exactly by the existing mechanism. There is no left/right obstacle either,
because the eye overlay already places two instances.

It is deliberately **not** wired up: the schematic models three refracting surfaces,
while Z-Anatomy models the sclera and iris it lacks. Superseding would render *less*
anatomy in exchange for correct optics, contradicting the overlay's own note that it
is "not a substitute for an anatomical eye". The decision is recorded rather than
taken. Until then, the eye over Z-Anatomy draws two overlapping globes.

**Narrowing the mask to just cornea, lens and retina is not available** — those sit
at ids 2631, 2635, 2641, 2644, 2648 and 2649, which are not contiguous, and the
masking mechanism takes a range.

### 5. Why ids are never pinned

A tempting shortcut is to record structure id ranges and use them directly. This
project refuses to, for a measured reason: **the ids are positional and they move.**
The seven-file Z-Anatomy import renumbered them, and a later fix moved them again
when a zero-vertex part stopped being emitted (3,626 → 3,617 → 3,614 for the
publishable build). An id list would have gone silently wrong and masked the wrong
organ.

Everything therefore resolves **from the asset at load time, by name**, and warns on
a count mismatch. Terms would remove the fragility without reintroducing the
pinning: a term is stable across rebuilds in a way an index is not.

---

## The next step, and it is small

**Write the FMA crosswalk into the Z-Anatomy structure table at build time.**
`build-z-anatomy.mjs` already writes a per-structure table into the GLB — name, side,
system, layer, centroid, component, licence. It simply does not write a term. Join
`docs/z-anatomy-fma.tsv` on name + side and add the field.

Then the same for BodyParts3D, whose crosswalk covers all 1,838 source meshes and
whose terms need carrying through the merge rather than being dropped by it.

⚠️ Both need an asset rebuild, so read the bake warnings in `CONTRIBUTING.md` first:
the AO bake is single-threaded and takes about 52 minutes for Z-Anatomy.

After that, overlay superseding can move from name tests to term sets, and (a), (b)
and (c) above stop being structural problems.

---

## Limitations

1. **Coverage is partial even where crosswalks exist.** 618 of 3,614 Z-Anatomy
   structures have an FMA term — **17 %**. Writing them in makes those 618 joinable;
   it does not make the atlas fully termed.
2. **No FMA↔UBERON bridge here.** Cross-lineage joins remain out of reach even after
   the terms are written in. That is a separate piece of work with its own accuracy
   questions.
3. **The overlay matching in the generated map is by name**, so "adds an organ" in
   that table means "no structure with this name" and is not proof the anatomy is
   absent — the `Cochlea` / scalae case above is exactly that false negative.
4. **`SystemId` is not ours to widen.** It has nine values and is the health-data
   contract, owned upstream under **D8**. Systems outside it (`lymphoid`, `sensory`)
   render unresolved rather than score-coloured, deliberately. A term mapping does
   not change that and must not be used as an argument to change it.

---

## References

- Generated inventory: [`../ONTOLOGY_MAP.md`](../ONTOLOGY_MAP.md) —
  `npm run gen:ontology`
- `scripts/gen-ontology-map.mjs`
- **FMA** — <http://si.washington.edu/projects/fma>
- **UBERON** — <https://uberon.github.io/>; Mungall CJ, et al. *Uberon, an
  integrative multi-species anatomy ontology.* **Genome Biology** 13, R5 (2012).
  <https://doi.org/10.1186/gb-2012-13-1-r5>
- Terms resolved via **EBI OLS4** — <https://www.ebi.ac.uk/ols4/>
- `docs/DECISIONS.md` — D8, D11
