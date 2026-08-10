# Plan — cross-atlas structure search and selection

**The next milestone.** Chosen 10 August 2026 over "finish ontology coverage" and
"personalisation from imaging", on the grounds that the identity work is now
substantial and entirely invisible: 3,800 structures carry a term and nothing in
the interface lets anyone use one.

> **Status: not started.** This is a plan, not a record. Everything below is a
> proposal; nothing here has shipped. Contrast `docs/ONTOLOGY_MAP.md` and
> `docs/LICENCE_LOG.md`, which are generated from what actually exists.

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

**1. A search index, generated, not hand-written.**
One artefact joining label → term → {atlas, structure id, side, system}, built
from the shipped GLBs and the crosswalks by a script alongside
`gen-ontology-map.mjs`. It must be generated for the reason every other table
here is: `ONTOLOGY_MAP.md` carried hand-typed structure ids that a rebuild
silently invalidated (D18), and ids are what a selection consumes.

⚠️ **Include the synonyms the vocabularies already publish.** FMA and UBERON both
carry synonym lists; a search that only matches the primary label will miss
`Eustachian tube` for `Pharyngotympanic tube`. Ingest them, do not invent them.

**2. Resolution through the bridge.**
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

## Tests it must come with

Nothing here needs a browser to be worth testing:

- label → term resolution, including a synonym and a miss
- bridge translation, including an `ambiguous` row
- an atlas that has the concept, one that does not, one not installed
- the index regenerates identically from the same assets

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
