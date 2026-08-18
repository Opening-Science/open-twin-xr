# Plan — Anatomed: take the Latin names, derive the adjacency, copy none of the code

**Proposal, not a record.** Nothing below is implemented. Written 18 August 2026
after measuring [`pitfa19/anatomed-mcp`](https://github.com/pitfa19/anatomed-mcp)
(at `b34375d`) against the shipped assets.

> ## ✅ EXECUTED 18 August 2026 — see D24 and D24a
>
> Phase 0, 1 and 3 are **done**: the Latin nomenclature is joined, applied to both
> Z-Anatomy assets, declared on `StructureEntry`, rendered in the card, searchable
> as a label with its own `via: 'latin'`, credited in the register and in-app, and
> counted by `gen:ontology` so no figure here needs believing. Phase 2 **ran and
> was rejected on its own measurement** — the box-gap graph reproduces the very
> defect that disqualified Anatomed's (91.9 % of edges at distance zero against
> their 96.3 %), so nothing ships and `scripts/build-adjacency.mjs` remains as the
> spike that proved it. D24a records what would actually work.
>
> The figures below were the estimates that justified the work; every one of them
> was confirmed exactly by the build. Kept as written.

> **Status: nothing started. The licence question is parked on purpose.**
> Anatomed's author relicensed his whole project because the Z-Anatomy author
> objected to an MIT-code-over-BY-SA-model split — which is *our* arrangement. That
> conversation is open at `Z-Anatomy/Models-of-human-anatomy#7` and is tracked in
> [`OUTREACH.md`](OUTREACH.md), **not here**. ⚠️ Nothing in this plan depends on how
> it is answered; see "The licence position this assumes" below.

**Numbers here are measured, not guessed**, on the assets as shipped on 18 August
2026, and every one of them is a count — **no structure id appears in this
document**, per D18. Re-derive with `npm run gen:ontology` before quoting any of
them anywhere else. The measurement method is recorded at the bottom.

## What Anatomed is, and why most of it is already here

An MCP server plus an R3F widget that renders region-isolated 3D anatomy inline in
a Claude conversation. Well made, and its comments are unusually honest about its
own failure modes. It is also built on **Z-Anatomy — the same atlas this repository
already ships**, re-exported.

Two facts settle most of the question before any comparison:

- Its GLBs are **gitignored** and served from a Supabase bucket. Cloning the repo
  gets you data files, not geometry.
- Its catalogue carries **no ontology terms at all**. Its part records hold `id`,
  `system`, `name_en`, `name_lat` and `side` — nothing else. So it contributes
  nothing directly to the crosswalk work in [`PLAN_IDENTITY.md`](PLAN_IDENTITY.md).

| | this repo | Anatomed |
|---|---|---|
| structures | 3,617 | 3,540 |
| carrying an FMA/UBERON term | 1,946 | **0** |
| carrying a Latin name | **0** | 2,385 |
| ambient occlusion baked | yes | no |

That table is the whole argument. There is exactly one column where they have
something we do not.

## Why the Latin names and not the rest

Measured per target asset, **after excluding the attachment rows
`apply-crosswalk.mjs` already skips** — attachment sites are named for their muscle
and inherit its identity, so giving them their own Latin name would assert
something false:

| target asset | structures | gain a Latin name | …of which are termless today |
|---|---|---|---|
| `z-anatomy.ao.glb` | 3,617 | 2,117 | 851 |
| `z-anatomy-regions.ao.glb` | 257 | 218 | 218 |
| **total** | **3,874** | **2,335** | **1,069** |

627 attachment rows matched a Latin name and were correctly excluded.

Two things make this unusually clean:

1. **Zero conflicts.** Across all 2,335 rows, no `(name, side)` pair draws two
   different Latin strings. The crosswalk is a function. Exact matching needs no
   tie-breaking and no terminology judgement — which is the opposite of the
   remaining FMA work, where D19 records how slow honest judgement is.
2. **`z-anatomy-regions` is the quiet win.** It carries names and nothing else
   today — zero terms across all 257 structures. This gives 218 of them their first
   formal identity, which no FMA work currently on the table would have done.

For a structure with no FMA term, a Terminologia-style Latin name is the only
formal identity it has. That is a real advance on the identity milestone from a
direction [`PLAN_IDENTITY.md`](PLAN_IDENTITY.md) did not anticipate.

### What the join actually costs

Their ids are `Name.l` / `Name.r`; ours are `name` + `side`. Joining them:

| join | parts matched of 3,540 | what the gap was |
|---|---|---|
| raw id, main atlas only | 2,296 | — |
| + ordinal normalisation | 2,332 | they write "1st metacarpal bone"; we normalise to "First" |
| + our regions asset | 2,558 | their 258 "regions" are our separate regions file |

The residual is **not missing anatomy**. 724 of the unmatched are muscle
insertions, which this repository models as an `attachment` field on the bone —
a deliberate granularity difference, not a gap.

## ⚠️ The licence position this assumes

Everything below acts on data that is **already CC BY-SA and already ours to
ship**. `licences.json` registers `z-anatomy.ao.glb` as a *"CC BY-SA 4.0 aggregate"*
and share-alike on it is live either way. Anatomed's catalogue derives from the
same Z-Anatomy.

**So this plan adds one attribution line and no new tier.** It does not enlarge our
licence exposure, and it does not become wrong if the answer to the MIT question
comes back the way we would rather it did not.

⚠️ **The one irreversible act is pasting their code, and Phase 3 forbids it.**
CC BY-SA 4.0 cannot be relicensed to MIT. Deleting the file afterwards does not
undo it.

---

## Phase 0 — record the provenance first (~1 hour)

Take everything, record everything (D12b). Recording comes first here because what
is being taken is small enough to slip in unrecorded.

**0.1 — settle whose names these are, but do not block on it.** The catalogue is
CC BY-SA 4.0 © Fabijan Pitlović, but the Latin strings are very likely Z-Anatomy's
own labels that his pipeline extracted rather than authored. That changes who is
credited first, not whether we may use them. **Credit both** — Z-Anatomy for the
nomenclature, Anatomed for the extraction — which is correct under either answer.

**0.2 — add the record.** A `kind: "data"` entry in `licences.json` naming
Anatomed, its terms, the commit taken from, and the derivation chain already
recorded there for Z-Anatomy. Extend the `z-anatomy` asset's `attribution` string
so `src/ui/AttributionBar.tsx` renders the added credit — attribution is a licence
condition, not a nicety. Then `npm run check:licences` to regenerate
[`LICENCE_LOG.md`](LICENCE_LOG.md) and confirm the tier has not moved.

## Phase 1 — take: Latin names onto both Z-Anatomy assets (~1 afternoon)

**1.1 — `scripts/build-latin-crosswalk.mjs`.**

- Takes `--src <path-to-parts-catalog.json>`. The catalogue is an **input, not a
  vendored file** — the same treatment `build-z-anatomy.mjs` gives the FBX source.
  This keeps a third-party BY-SA blob out of the tree while the TSV it produces
  stays committed and reviewable.
- Joins their `id` to our `(name, side)` by **ordinal normalisation only**, then
  exact match. ⚠️ **No fuzzy matching, at any confidence** — see D18 and the
  standing rule at the top of `src/scene/structureSearch.ts`.
- Emits `docs/z-anatomy-latin.tsv`, header `name / side / latin`, mirroring
  `z-anatomy-fma.tsv` so both crosswalks read alike.
- **Hard-fails** if any `(name, side)` draws conflicting Latin. It is zero today;
  the gate exists so a future catalogue revision cannot introduce one silently.

**1.2 — generalise `apply-crosswalk.mjs` rather than write a second applier.**

It already does exactly the right thing: skips attachments, matches exactly, never
guesses, rewrites the glTF JSON chunk while copying the BIN chunk through byte for
byte, and writes via temp-and-rename. Only the input path and target field are
hardcoded.

- Add `--tsv` and `--field`, defaulting to `docs/z-anatomy-fma.tsv` and
  `ontologyid` so today's invocation is unchanged.
- Read the TSV **by header** rather than by column position, which it does now.
- Keep the attachment skip.

```bash
node scripts/apply-crosswalk.mjs \
  public/models/z-anatomy.ao.glb \
  public/models/z-anatomy-regions.ao.glb \
  --tsv docs/z-anatomy-latin.tsv --field name_lat
```

No rebuild, no ~52-minute AO bake, and no vertex passing back through simplify,
weld or quantise — the three steps [`HANDOVER.md`](HANDOVER.md) records as able to
corrupt `_STRUCTURE` ids *without failing loudly*.

**1.3 — declare `name_lat` on `StructureEntry`.** In `src/scene/structureEntry.ts`,
alongside the other fields that sat in the assets undeclared. ⚠️ Until the type
declares it, nothing in `src/` can read it — the exact trap that hid 1,048 FMA
CURIEs for an entire milestone. Point the doc comment at the generator for its
counts; do not type a number into it.

**1.4 — render it, and decide the search question deliberately.**

- `src/ui/SelectedStructureCard.tsx` already calls `structureTerm()`. Add the Latin
  name as a secondary italic line under the English name — a label, presented as a
  label, visually distinct from the ontology term.
- **The decision to make explicitly:** should `structureSearch.ts` match on Latin?
  D18 permits substring and prefix matching on a **label** and forbids approximate
  matching onto a **term**. Latin is a label, so matching it is permitted — but it
  deserves its own `via: 'latin'` so the route is shown, exactly as `'name'`,
  `'term'` and `'bridge'` are now.

> ⚠️ **The one thing that would break D18.** Do **not** use Latin names to infer FMA
> terms for the 1,671 structures still lacking one. Matching a Latin string against
> FMA's Latin synonyms is approximate matching onto a *term* — precisely what
> produced 32 FMA ids shared across different structures the one time this
> discipline lapsed. It may well be good work. It is *separate* work, needs exact
> matching and `check:crosswalk` as its gate, and must not ride along inside this
> change.

## Phase 2 — derive: structure adjacency from our own geometry (spike, then a decision)

Anatomed's neighbour graph is **not worth ingesting**: **96.3 % of its 84,360 edges
have a distance of exactly zero**, so the distance carries almost no signal, and it
joins to only 2,292 of our structures. We can compute a better one, over all 3,617,
from an asset we already own.

**2.1 — per-structure bounds.** Structures live inside merged meshes, indexed by the
`_STRUCTURE` vertex attribute. Group `POSITION` by that id for an axis-aligned box
per structure. New `scripts/build-adjacency.mjs`, reading `z-anatomy.ao.glb`.

**2.2 — adjacency by box gap, not centroid distance.** Neighbours when boxes overlap
or the gap falls below a threshold in metres — the assets are canonical metres, so
the threshold is a real quantity rather than a tuning constant. Boxes matter rather
than centroids because **the centroid of a sciatic nerve sits nowhere near either
end of it**, and centroid distance would rank a long structure's neighbours
arbitrarily. This is where our version beats theirs rather than merely matching it.

**2.3 — measure the payload, *then* choose where it lives.** At their K of 30 this is
roughly 108,000 edges. In the structure table that inflates the JSON chunk of an
atlas the app already spends ~40 s parsing.

⚠️ **Decision gate.** If the added payload exceeds a stated budget, ship adjacency as
a separate artifact fetched on demand instead of inside the atlas. **Measure before
deciding** — do not assume either answer. And because it is derived from Z-Anatomy
geometry the output is BY-SA adapted data: it travels with the asset, never into
`src/`.

**2.4 — only then wire a feature.** "Related structures" in the structure panel, and
translucent surrounding context in the viewer. Worth building only once 2.3 has
answered where the data lives.

## Phase 3 — copy none: write the rule down (~20 min)

**No file from `pitfa19/anatomed-mcp`'s `src/` or `widget/` enters this
repository.** Named specifically because they are the tempting ones:
`vendor/fuzzy.ts`, `vendor/resolveParts.ts`, `region.ts`, `widget/RegionViewer.tsx`.

Their fuzzy matcher is genuinely good, and its comments record the same class of
accident D18 does. Read it for the reasoning; do not paste it. If an MCP endpoint is
ever built here, it is written against the MCP specification — their server is a
reference for *what* to build, never for *how it is written*.

Land as a numbered decision in [`DECISIONS.md`](DECISIONS.md) and as a line in
`CLAUDE.md`'s hard constraints. ⚠️ **Read off the next free number when you write
it, do not trust one quoted here** — this plan was drafted saying "D23" while a
parallel session was already writing D23 into the working copy. Which is, exactly,
the failure mode D18 exists to prevent, in miniature.

⚠️ The reason to write the rule down at all is that the person
most likely to breach it is a future agent that finds a well-written fuzzy matcher
and has no idea why this repository does not have one.

---

## Gates — no new tooling required

| command | asserts |
|---|---|
| `npm run check:structures` | `_STRUCTURE` ids intact. Should be **identical** to the pre-run result — the applier touches no geometry, and this proves it. ⚠️ **Hardcoded to `z-anatomy.ao.glb` only**; Phase 1 patches the regions asset too, so extend the npm script or invoke `scripts/check-structures.mjs` on it explicitly |
| `npm run gen:ontology` | Regenerates [`ONTOLOGY_MAP.md`](ONTOLOGY_MAP.md). **Extend it to count Latin coverage** so that number is generated and never hand-typed (D18) |
| `npm run check:licences` | Regenerates [`LICENCE_LOG.md`](LICENCE_LOG.md) with the added attribution; confirms the tier has not moved |
| `npm run check:crosswalk` | No term shared across structures that are not the same structure. Unchanged by this work — run it to prove Latin did not leak into term resolution |
| `npm run lint:claims` | The claim surface is untouched. Scans `src/ui`, `src/scene`, `App.tsx`, `index.html` only |

## Deliberately excluded

- **Their geometry.** Same Z-Anatomy; ours has AO baked and 1,946 FMA terms attached.
- **Their English names and system labels.** Ours are normalised and mapped to
  `SystemId`; theirs follow Z-Anatomy's per-file split (`skeleton`, `muscles`,
  `nerves`, `vessels`, `organs`, `joints`, `insertions`, `regions`).
- **Their neighbour graph as data.** Superseded by Phase 2.
- **Their insertion parts.** We model these as `attachment`. A granularity
  difference, not a gap.
- **Latin → FMA inference.** Separate work. See the warning in Phase 1.
- **An MCP endpoint of our own.** The most interesting idea here and it needs no
  ingest at all — but it is a *deployment* change (the site is static today), not a
  build change, and belongs in its own plan.
- **The licence question.** Parked until the Z-Anatomy issue is answered.

## How the figures were measured

Read `public/models/z-anatomy.ao.glb` and `z-anatomy-regions.ao.glb` through
`@gltf-transform/core` with `ALL_EXTENSIONS` and the meshopt decoder registered —
the same setup `scripts/gen-ontology-map.mjs` uses — and take
`scene.getExtras().structures`. Join to `assets/parts-catalog.json` and
`assets/parts-neighbors.json` from `pitfa19/anatomed-mcp` at `b34375d`, keying their
`id` against our `name` + `side` under ordinal normalisation. Yields exclude rows
carrying `attachment`, matching what the applier skips.

⚠️ These are point-in-time counts. The generated documents win on conflict, and
`npm run gen:ontology` is what regenerates them.
