# Getting to an all-CC BY anatomy model

**Question:** can the whole anatomy model be CC BY — permissive, no share-alike —
so a commercial product can be built on it and the assets dual-licensed?

**Answer: yes — and more easily than expected. BodyParts3D is now CC BY 4.0.**

## The headline: the share-alike premise was out of date

**DBCLS relicensed BodyParts3D from CC BY-SA 2.1 Japan to CC BY 4.0 on
2025-02-27.** Verified 27 July 2026 by fetching two independent authoritative
sources:

- <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html> — *"The license
  for this database is specified in the Creative Commons Attribution 4.0
  International."* Page states "Last updated: 2025/02/27".
- The README bundled **inside the LATEST data distribution**
  (`/data/bodyparts3d/LATEST/README_e.html`) — same CC BY 4.0 statement, so the
  change propagated into the payload rather than sitting only in metadata.

Required credit: *"BodyParts3D, © The Database Center for Life Science licensed
under CC Attribution 4.0 International"*. Also cite Mitsuhashi N. et al.,
*Nucleic Acids Res.* 2008, PMID 18835852.

**What it contains:** 2,235 meshes (Wavefront OBJ), FMA-indexed — full skeleton
including ribs, cranium, mandible, clavicle, scapula, humerus, radius, ulna,
metacarpals, phalanges; **411 skeletal muscle meshes**; and the **diaphragm**
(FMA13295), which exists under no other permissive licence and which HRA also
lacks. FMA indexing joins directly to the terms HRA already uses.

**So the project can be CC BY 4.0 end to end, with no copyleft anywhere.** This
supersedes the earlier decision to accept share-alike — that decision was
reasonable on what was then known, but its premise is gone.

> Two caveats that matter. **Go direct to DBCLS, not via Z-Anatomy**: Z-Anatomy's
> own retopology work is separately CC-BY-SA by its authors' choice, so the
> downstream copy remains share-alike even though the upstream no longer is.
> And **raw BodyParts3D mesh quality is poor** — documented holes and
> non-manifold geometry. Cleaning that up is precisely the work Z-Anatomy did,
> and it is the real price of the permissive route.

> ⚠️ **The mesh files contradict the licence page. Read this before shipping.**
> Every one of the 2,234 `.obj` files carries this header, verified after
> downloading:
>
> > *"The license for this database is specified in the Creative Commons
> > Attribution-Share Alike 2.1 Japan… "BodyParts3D, (c) The Database Center for
> > Life Science licensed under CC Attribution-Share Alike 2.1 Japan"."*
>
> The files are dated 2013 — DBCLS relicensed the database in 2025 without
> regenerating the geometry, which is normal (relicensing does not require new
> data) but leaves every file asserting the old terms.
>
> The reading that resolves it: the header itself defers to a URL —
> `dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html` — and **that page now says
> CC BY 4.0**. So the file points at the canonical licence statement, and the
> statement has changed. A rights holder may relicense their own work, and CC
> licences are non-exclusive.
>
> That is a defensible reading, not a certainty. **Get written confirmation from
> DBCLS before commercial distribution**, and do not strip or rewrite the
> embedded headers until you have it. Anyone auditing the raw files will see
> BY-SA and will ask.

> **One stale page to ignore:** DBCLS's own Anatomography site
> (<https://lifesciencedb.jp/bp3d/info/license/index.html>) still shows CC BY-SA
> 2.1 JP, as does the frozen 2011 snapshot path under `/data/bodyparts3d/20110915/`.
> The Anatomography page explicitly defers to the LSDB Archive licence, and the
> archive is both authoritative and newer. Most third-party citations of
> "BodyParts3D is CC BY-SA" are quoting these stale paths. Worth one
> confirmation email to DBCLS before shipping commercially.

> Not legal advice. The DRM/OEM-redistribution and dual-licensing points are
> worth confirming with counsel before you commit to a commercial structure.

## If you did need to relicense a CC BY-SA work

You cannot. CC BY-SA 4.0 §3(b)(1) requires an adapter's licence to carry the
same elements — CC BY has no ShareAlike element, so it is excluded. Only the
rights holder can offer other terms. That is why the route is *going upstream to
the rights holder's own permissive release*, not relicensing a derivative.

CC BY-SA 4.0 is one-way compatible with **GPLv3**, but that pulls your
application into GPLv3 and does not help.

CC BY-SA 4.0 is one-way compatible with **GPLv3**, but that pulls your
application into GPLv3 and does not help.

**One nuance worth banking:** §3(b) triggers only if you *share adapted
material*. Shipping an unmodified CC BY-SA asset **alongside** your own is
aggregation, not adaptation, and does not infect anything. Merging Z-Anatomy
geometry into a combined GLB *would*. This is the concrete reason
`anatomySources.ts` keeps one GLB per atlas.

## The pull list

### 1. Tool — TotalSegmentator

Repo: <https://github.com/wasserth/TotalSegmentator> · Code: **Apache-2.0**

Default weights (`total`, `total_mr`) are stated in the README as *"Openly
available for any usage (Apache-2.0 license)"*.

**Apache-2.0 attaches no conditions to model outputs.** So the licence of a mesh
you generate is set solely by the licence of the *input image*:

| Input CT | Resulting mesh | Can you dual-license it? |
|---|---|---|
| Your own scans | **You own it outright** | Yes — anything, including proprietary |
| CC BY 4.0 dataset | Adapted Material, **CC BY 4.0** | No, but attribution-only: drops cleanly into an MIT repo, no copyleft |

### 2. Data — TotalSegmentator CT v2

<https://zenodo.org/records/10047292> — **`cc-by-4.0`** (verified via Zenodo
API, DOI `10.5281/zenodo.10047292`). 1,228 CT studies with labels included.

> ⚠️ **Trap: use the CT dataset, not the MRI one.** Same project, same
> publisher, different terms — the MRI dataset
> (DOI `10.5281/zenodo.11367005`) is **`cc-by-nc-sa-2.0`**: non-commercial
> *and* share-alike. It would defeat the entire point.

Other permissive options: **AMOS** (CC BY 4.0,
<https://zenodo.org/records/7262581>), **CT-ORG** (CC BY **3.0**, not 4.0),
**SAROS** (CC BY 4.0 masks, but only every 5th slice annotated).

**Avoid — non-commercial:** TotalSegmentator MRI, autoPET, RibFrac, CTSpine1K,
AbdomenAtlas, CT-RATE. **Avoid — share-alike:** VerSe, Medical Segmentation
Decathlon. **Do not trust MedShapeNet's licence table** — it lists SkullBreak /
SkullFix as CC BY 4.0, but they derive from CQ500, which is CC BY-NC-SA 4.0.

## What this gets you, and what it does not

**Covered by the open Apache-2.0 weights** — verified by reading
`totalsegmentator/map_to_binary.py` on master, not the docs:

- `total`: **ribs** (`rib_left_1`–`12`, `rib_right_1`–`12`), **skull**,
  **humerus**, **scapula**, **clavicula**, **sternum**, full vertebrae, hip,
  femur, and muscles `gluteus_maximus/medius/minimus`, `iliopsoas`, `autochthon`
- `craniofacial_structures`: **mandible**, teeth, sinuses
- `abdominal_muscles`: 22 trunk muscles — pectoralis major, rectus abdominis,
  serratus anterior, latissimus dorsi, trapezius, obliques, erector spinae,
  psoas major, quadratus lumborum
- `headneck_muscles`: 23 muscles incl. sternocleidomastoid, scalenes

That is essentially every gap in `HRA_ASSETS.md` — ribcage, skull and upper-limb
bones included.

**Gated behind a licence key** (free for non-commercial; commercial contact in
the README):

- `appendicular_bones` → **hands, feet, radius, ulna**
- `thigh_shoulder_muscles` → deltoid, rotator cuff, quadriceps, triceps

**Does not exist permissively at all: the diaphragm.** Zero hits across
TotalSegmentator's whole class map, and no CC BY/CC0 diaphragm mesh was found
anywhere. If the twin needs one, it must be modelled by hand or licensed. Note
HRA has no diaphragm either.

Also verified: **`brain_aneurysm` weights are CC BY-NC 4.0 with no commercial
licence available** — do not enable that sub-task in a commercial build.

## Two things to weigh before committing

**The triangle budget is the real constraint, not the licence.** The HRA
whole-body model is **7.19 million triangles** in the shipped asset, against the
~150k target `MODEL_PIPELINE.md` sets for headset rendering — roughly 48× over.
Decimation alone does not close that: `--simplify-ratio 0.08` with a loose error
tolerance only reached 4.67M triangles (56 MB). By vertex share the cost is
digestive 34%, nervous 21%, musculoskeletal 14%, reproductive 12%. Adding
segmentation-derived bone and muscle makes this worse, so **plan on subsetting
to the structures the product actually shows**, not on shipping a whole atlas.

**Provenance of the Visible Human data.** HRA's models are `3d-vh-f-` and
`3d-vh-m-` — they *are* Visible Human Project derivatives, so this already
applies to the male atlas in this repo. NLM dropped the licence requirement in
2019 and the data is US-government public domain, so there is no legal issue.
There is a reputational one: the male donor was an executed prisoner, which NLM
does not disclose on the dataset pages and which no licence addresses. Worth a
deliberate decision in a consumer health product rather than discovering it
later. The female dataset does not carry this issue.

## Extraction manifest — worked out, ready to use

The index files have been pulled and the FMA hierarchy resolved to this
project's nine systems. Two artifacts are committed:

- [`bodyparts3d-system-map.tsv`](./bodyparts3d-system-map.tsv) — 1,838 rows,
  `mesh_file · system · fma_id · label`, e.g.
  `FJ3226.obj · musculoskeletal · FMA8532 · left eleventh rib`
- [`bodyparts3d-musculoskeletal.txt`](./bodyparts3d-musculoskeletal.txt) — the
  563 filenames to extract for Phase 1

**Pull these (small text files, no meshes):**

```
https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_parts_list_e.txt
https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_element_parts.txt
https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_inclusion_relation_list.txt
https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_element_parts.txt
https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_inclusion_relation_list.txt
```

Meshes live in `isa_BP3D_4.0_obj_99.zip` (136 MB, 99 % polygon-reduced OBJ).

**How the mapping works, because the two trees do different jobs.** `partof_*`
is anatomical containment — what sits inside what — and `isa_*` is
classification, what *kind* of thing something is. Neither alone is enough:

- **Musculoskeletal comes from IS-A**, rooted at `bone organ` (FMA5018),
  `muscle organ` (FMA5022), joint, ligament and cartilage. Containment fails
  here because BodyParts3D's `musculoskeletal system` PART-OF root yields only
  138 meshes, against **563** by kind.
- **Everything else comes from PART-OF**, rooted at each system concept
  (`FMA7161` cardiovascular, `FMA7158` respiratory, and so on).
- **Vessels and nerves need extra IS-A roots** (`artery` FMA50720, `vein`
  FMA50723, `nerve` FMA65132) plus the separate vascular-tree roots, because the
  peripheral tree is not under the cardiovascular system node.

Resolution order matters: specific systems claim first, vasculature last, so the
vessels threading through an organ do not swallow the organ.

| System | Meshes | Note |
|---|---|---|
| cardiovascular | 754 | includes the full arterial/venous tree |
| **musculoskeletal** | **563** | bone, muscle, joint, ligament, cartilage — **the Phase 1 target** |
| respiratory | 283 | |
| digestive | 141 | |
| nervous | 86 | |
| metabolic | 6 | shallow here — keep using HRA |
| endocrine | 3 | shallow here — keep using HRA |
| integumentary | 1 | whole-body skin |
| reproductive | 1 | shallow here — keep using HRA |

1,838 of 2,234 meshes assigned (82 %). The unassigned remainder is mostly
regional subdivisions and connective tissue with no single system home.

**The diaphragm is `FJ3131.obj` (FMA13295)**, classified under musculoskeletal.
That single file is the structure nothing else permissive supplies.

**Only extract musculoskeletal.** The shallow systems above are exactly the ones
HRA already covers well and with richer ontology, so the composed configuration
in `anatomySources.ts` — HRA for viscera, BodyParts3D for musculoskeletal — is
what the data supports. Extracting 563 of 2,234 meshes is also the subsetting
the triangle budget demands.

## Building it

```bash
# 1. Download and unzip isa_BP3D_4.0_obj_99.zip (136 MB) from
#    https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/

# 2. Filter, tag and normalise into a GLB
npm run build:bodyparts3d -- --src /path/to/unzipped/objs

# 3. Compress (decimates; --join false is mandatory, see MODEL_PIPELINE step 6)
npm run convert:bodyparts3d
```

`scripts/build-bodyparts3d.mjs` keeps only the systems you ask for (default
`musculoskeletal`), writes each mesh's FMA term and resolved system into the
glTF node `extras`, and normalises the geometry. It derives the units and
up-axis from the geometry rather than assuming them — BodyParts3D documents
neither — reporting what it detected so you can sanity-check it, then grounds
the model so the feet sit at y=0 and scales to `--height` (default 1.7 m).

The `extras` it writes are exactly what `AtlasBody` reads: `ontologyid` in the
same CURIE spelling HRA uses, plus `system` carrying the pre-resolved answer, so
no runtime guessing is needed. The licence credit is baked into the GLB's asset
copyright field as well as rendered in-app.

It warns loudly when manifest entries have no matching `.obj` — a silently
short atlas renders perfectly well and is simply missing bones, which is the
failure mode this project keeps hitting.

Options: `--systems a,b` to take more than musculoskeletal, `--out` to change
the target, `--height` to change the normalisation target.

## Why not assemble it from individually-scanned bones?

There *are* clean CC BY 4.0 bone scans, and they are real laser scans rather than
models — but they are the wrong shape of asset for a twin, for a reason that is
easy to miss.

Two donor-based university osteology collections on Wikimedia Commons, both
verified `{{cc-by-4.0}}` from raw wikitext:

- **Eric Bauer / Elon University** (19 files) —
  <https://commons.wikimedia.org/wiki/Category:Media_from_Eric_Bauer> —
  clavicle, scapula ×2, humerus ×2, radius, ulna, femur, fibula, tibia, hip
  bone, pelvis, atlas, axis, cervical/thoracic/lumbar vertebrae, ethmoid,
  occipital. Credit: *"Eric Bauer and the donor-based undergraduate human
  anatomy lab at Elon University"*.
- **UNCG Imaging Lab** (15 files) —
  <https://commons.wikimedia.org/wiki/Category:Media_from_UNCG_Imaging_Lab> —
  humerus, radius, ulna, clavicle, scapula, calcaneus, talus ×2, frontal and
  occipital bones, sacrum, vertebrae. Scanned from the UNCG Anthropology
  osteology collection.

Plus a full skull (`3D-Schädel eines Menschen.stl`) and a male/female pelvis
pair, both CC BY 4.0.

**The problem is registration and consistency.** These are loose bones, scanned
individually at arbitrary orientations, **from different donors**. Building a
skeleton from them means manually articulating ~34 separate meshes into one
coordinate frame — and even done perfectly the result is a chimera of several
people's proportions, which will not sit correctly inside one body shell. A
whole-body CT segmentation gives every structure in a single consistent frame
from one individual, which is exactly what the twin needs.

So: **use segmentation as the source, and treat these as gap-fillers only.**
Usefully, they are not even needed for the main gaps — TotalSegmentator covers
ribs and trunk muscle, which Commons cannot supply at all.

If you do use them, note CC BY attribution is mandatory and non-waivable, and
these are scans of real human remains from teaching collections; the Elon and
UNCG credit lines would have to ship in-app.

## Dead ends, so nobody re-searches them

- **Smithsonian Open Access / 3d.si.edu.** CC0 is real but assigned per item,
  and the 3D collection mixes CC0 with "Usage conditions apply". More decisively
  there is **no modern human skeletal anatomy in it at any licence** — the
  hominin material is lender-restricted and not downloadable, and Human Origins
  primate scans are explicitly non-commercial.
- **Wikimedia Commons, for ribs, hands, feet or muscle.** Every option is
  share-alike: the whole BodyParts3D set is CC BY-SA 2.1 JP, and the best skull
  and rib models are CC BY-SA 4.0. A Commons search for muscle STLs returns
  nothing at all.
- **MedShapeNet's licence table** — unreliable, see above.

Two traps worth knowing. Commons category pages carry a footer saying "All
structured data from the file namespace is available under CC0" — that refers to
Wikidata metadata, **not** the file. And `{{3dpatent}}`, which appears beside
many of these, is a design-patent warning, not a licence.

## Unresolved

SPL / Open Anatomy Project atlas licences, and a broader CC0 sweep
(Sketchfab, Smithsonian, OpenSim), were not completed. NIH 3D is **not**
blanket CC0 — its terms state licences are per-model and must be checked
individually. Artec 3D's "Human skeleton HD" is genuinely CC BY 4.0 but is a
single unsplit scan, so it works as a visual shell and not for per-organ
picking.
