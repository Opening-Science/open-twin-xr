# Plan — cross-atlas structure search and selection

**The next milestone.** Chosen 10 August 2026 over "finish ontology coverage" and
"personalisation from imaging", on the grounds that the identity work is now
substantial and entirely invisible: 3,800 structures carry a term and nothing in
the interface lets anyone use one.

> **Status: resolution layer landed, interface not built.**
> `src/scene/structureSearch.ts` and the bundled bridge exist and are tested; no
> search box is wired into the UI yet. Everything under "Shape of the work" below
> that is not marked ✅ is still a proposal.

## Why this and not more coverage

Measured on the shipped assets:

| | |
|---|---|
| structures carrying a term | 1,842 Z-Anatomy + 1,838 BodyParts3D + 323 UBERON-side |
| UBERON ids that reach FMA geometry | 89 of 153, via `docs/fma-uberon-bridge.tsv` |
| what a user can do with any of it | **nothing** |

Finishing the remaining 1,772 Z-Anatomy structures would raise a number in a
generated document. It would not let anyone find the liver. The 34 % hit rate of
the automated sweep also says the remainder is mostly terminology judgement
rather than more automation — see D19 for three worked examples of how slow that
is to do honestly.

## What it should do

Type `liver`, get every structure any installed atlas holds for that concept,
select one, and have the view frame and identify it — **in whichever atlas is
currently loaded**, without the user knowing that BodyParts3D speaks FMA and HRA
speaks UBERON.

That last clause is the whole point, and it is the thing that was impossible
before the bridge existed.

## Shape of the work

**1. ~~A search index, generated~~ — ✅ done, and the plan was WRONG here.**

This proposed generating a static index joining label → term → structure. That
was the wrong shape, and building it revealed why: **every loaded atlas already
carries exactly that table inside its own GLB** — `name`, `side`, `system` and
`ontologyid` per structure. It is always in step with the geometry because it
travels in the same file, and it costs nothing to search.

A generated index would have had to be rebuilt whenever an asset changed, could
not be committed (the assets are gitignored), and would have been one more thing
to go stale — in a repository that has now corrected stale generated numbers
three times. `searchStructures()` reads the live table instead.

The one piece that DOES have to ship separately is the bridge, because it maps
between two vocabularies rather than describing one atlas. It is compiled into
`src/scene/bridgeData.ts` by `npm run gen:bridge-module` and bundled — 143 rows,
committed, so it can never be "not installed".

⚠️ **Still open: the synonyms the vocabularies publish.** FMA and UBERON both
carry synonym lists, and a label search will miss `Eustachian tube` for
`Pharyngotympanic tube` without them. Ingest them, do not invent them.

**2. ~~Resolution through the bridge~~ — ✅ done.**
A query resolves to a *concept*, then to structures in the loaded atlas. Where
only the other vocabulary has it, the bridge translates. ⚠️ `fma-uberon-bridge.tsv`
marks rows `ambiguous` where UBERON lists several FMA terms; a search result must
carry that through rather than silently picking the first. Prefer showing two
candidates over inventing certainty.

**3. Selection reusing what exists.**
`selectedStructure` is already in the store, `structureMask.ts` already
highlights arbitrary id sets, and `StructureLabel` already anchors a label. This
step should mostly be wiring, and if it is not, that is a signal the abstraction
is wrong rather than a reason to add another one.

**4. Honest empty states.**
"No atlas here models the scala tympani" is a real and common answer — the
overlay table already reports 8 such parts. It must be distinguishable from "no
term for it yet" and from "not installed", because those have different fixes.
The three states already exist in the data; the UI needs to say which one it is.

## Tests

✅ 25 tests in `src/scene/structureSearch.test.ts`, none needing a browser or an
asset: CURIE parsing, both bridge directions, the `ambiguous` flag, ranking,
punctuation folding, the three empty-state reasons, and — the one that guards the
discipline — that `tibea` matches nothing.

Still to test once the interface exists: selection actually masking the right
ids, and an atlas that is not installed.

## What it must not do

⚠️ **No fuzzy matching.** The crosswalks were built exact-only, and the one place
that discipline lapsed produced 32 FMA ids shared across different structures —
`Axillary artery`, `Axillary nerve` and `Axillary vein` on one term. A search box
is exactly where "close enough" feels harmless and is not: it would let someone
select the femoral nerve believing it is the artery. Prefix and substring
matching on a LABEL is fine; approximate matching onto a TERM is not.

⚠️ **No new health claim.** Search finds anatomy. It does not annotate, score or
interpret it — D8 and D15 still hold, and `npm run lint:claims` will fail the
build if the copy drifts.

## Afterwards

The two deferred options remain, in this order:

1. **Finish ontology coverage** — 1,772 Z-Anatomy structures and
   `z-anatomy-regions` at 0 of 257. Regions may not want FMA terms at all; they
   are topography, and that question should be settled before any sweep.
2. **Personalisation from imaging** — the stated long-term goal in `CLAUDE.md`.
   Large, and it needs decisions about data handling that touch GDPR Article 9
   before any code.
