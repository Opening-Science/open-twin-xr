# Documentation index

There are a lot of documents here, written over a fortnight of fairly intense
work, and they are not all equally current. This page says which to read, in what
order, and which are historical.

**If you read only one, read [`HANDOVER.md`](HANDOVER.md).** It is written for
someone picking this repository up cold and assumes no memory of the
conversations that produced it.

---

## Reading order for someone new

| # | read | why |
|---|---|---|
| 1 | [`../README.md`](../README.md) | What the project is, and `npm install && npm run dev` |
| 2 | [`HANDOVER.md`](HANDOVER.md) | The orientation document. What this is, what it is *not*, where everything lives |
| 3 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the code is arranged and why |
| 4 | [`MODEL_PIPELINE.md`](MODEL_PIPELINE.md) | How to get real anatomy on screen instead of the placeholder |
| 5 | [`DECISIONS.md`](DECISIONS.md) | D1–D15. **Read this before proposing a change** — several obvious ideas were tried and reversed, and the reversals are recorded |

After that, follow whatever you are actually working on — and read
[`reports/`](reports/README.md) for the five areas where the reasoning matters more
than the result.

## Current — these describe how things are now

| doc | what it is |
|---|---|
| [`HANDOVER.md`](HANDOVER.md) | Orientation, layout, and what to pick up next |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Code layout, the scene graph, state |
| [`DECISIONS.md`](DECISIONS.md) | The decision log, including reversals |
| [`MODEL_PIPELINE.md`](MODEL_PIPELINE.md) | Downloading, converting and baking an atlas |
| [`HRA_ASSETS.md`](HRA_ASSETS.md) | HRA download URLs, confirmed by request |
| [`CT_ATLAS_PIPELINE.md`](CT_ATLAS_PIPELINE.md) | CT → labelmap → mesh, with MOOSE. The heaviest pipeline here |
| [`ONTOLOGY_MAP.md`](ONTOLOGY_MAP.md) | **Generated.** Organ systems ↔ UBERON/FMA, and which assets actually carry a term |
| [`LICENCE_LOG.md`](LICENCE_LOG.md) | **Generated.** Pre-publication due diligence, read from the shipped assets |
| [`DATA_CONTRACT.md`](DATA_CONTRACT.md) | `TwinMetrics`, the one boundary between this repo and the data upstream |
| [`RESOURCES.md`](RESOURCES.md) | Every resource evaluated, with licence and standing |
| [`DEPLOY.md`](DEPLOY.md) | Shipping it, including the publishable-build gate |
| [`reports/`](reports/README.md) | **Five technical reports** — photographic colour (answers D4), the CT pipeline, the geometry survey, ontology identity, the licence position |
| [`STACK_AND_MODELS.md`](STACK_AND_MODELS.md) | Dated snapshot: the stack, all ten models, and how publishable each is as presented. Point-in-time — the generated docs above win on conflict |
| [`ROADMAP.md`](ROADMAP.md) | Phases and their state |
| [`PLAN_NEXT.md`](PLAN_NEXT.md) | Numbered repo-quality queue; items 19–21 are open |

⚠️ **One live plan now.** `PLAN_NEXT.md` is the repo-quality queue; items 19–21 are
open. The new-geometry queue is finished — `PLAN_INTEGRATION.md` moved to Historical
below, and its findings are in [`reports/`](reports/README.md).

## Research and survey — read when you need the background

These are snapshots of investigation, dated, and not maintained. They are kept
because the reasoning is worth more than the conclusion.

| doc | what it is |
|---|---|
| [`GEOMETRY_SOURCES_SURVEY.md`](GEOMETRY_SOURCES_SURVEY.md) | Survey of open anatomy geometry, with a reconciliation section correcting it |
| [`INTEGRATION_CANDIDATES.md`](INTEGRATION_CANDIDATES.md) | Tiered shortlist of things worth importing, A1–C4 |
| [`SIMULATION_SOURCES.md`](SIMULATION_SOURCES.md) | Drug biodistribution, a beating heart, FEM movement — and why two of the three are one feature |
| [`PERMISSIVE_ANATOMY.md`](PERMISSIVE_ANATOMY.md) | Could the whole model be CC BY, with no share-alike? |
| [`PHOTOREALISM_AND_PERSONALISATION.md`](PHOTOREALISM_AND_PERSONALISATION.md) | Materials, lighting, and personalisation from a person's own imaging |
| [`COMMERCIAL_LICENSES.md`](COMMERCIAL_LICENSES.md) | The paid alternatives, considered and rejected |

## Historical — accurate when written, superseded since

Do not act on these without checking against the current documents. They are here
because they record how the project got its shape.

| doc | status |
|---|---|
| [`../HANDOVER_SPEC.md`](../HANDOVER_SPEC.md) | The original build plan, from when this was a health dashboard. **Superseded** — see the box at the top of `../CLAUDE.md` |
| [`SCHEMA_VERIFICATION.md`](SCHEMA_VERIFICATION.md) | What the upstream `open-twin` tree actually contained, 26 July 2026. Overturned two premises of the original plan |
| [`PLANNING_REPORT.md`](PLANNING_REPORT.md) | The first planning report, 26 July 2026 |
| [`PLAN_INTEGRATION.md`](PLAN_INTEGRATION.md) | The new-geometry queue (B6, A1, B2, B8, B3), **all five landed**. Kept for its working notes and the biv-me provenance email; its findings are now in [`reports/`](reports/README.md). References branches and a PR that no longer exist |

The `.pdf` exports of these three were **removed on 29 July 2026**, after checking
that nothing lived only in them: each was a 26 July snapshot and each markdown file
is a later revision of the same document — `SCHEMA_VERIFICATION.md` even corrects a
claim its own PDF still made. The only PDF-only sentence concerned Vitronic and
Anthroscan licensing, and it rested on the VITUS-scanner premise that the
verification overturned. The markdown is the source.

## Data files

Tab-separated, and the machine-readable authority for the mappings that
`ONTOLOGY_MAP.md` presents by system.

| file | rows | what it maps |
|---|---|---|
| [`bodyparts3d-system-map.tsv`](bodyparts3d-system-map.tsv) | 1,838 | BodyParts3D mesh → system, layer, FMA |
| [`z-anatomy-fma.tsv`](z-anatomy-fma.tsv) | 676 | Z-Anatomy structure + side → FMA |
| [`moose-uberon-crosswalk.tsv`](moose-uberon-crosswalk.tsv) | 139 | MOOSE class → UBERON |
| [`healthy-total-body-cts-crosswalk.tsv`](healthy-total-body-cts-crosswalk.tsv) | 33 | TCIA labelmap class → UBERON |
| [`healthy-total-body-cts-labels.tsv`](healthy-total-body-cts-labels.tsv) | 35 | The TCIA label map itself |
| [`hra-assets.tsv`](hra-assets.tsv) | 83 | HRA reference-organ GLB and crosswalk URLs |
| [`bodyparts3d-musculoskeletal.txt`](bodyparts3d-musculoskeletal.txt) | — | Working list behind `PERMISSIVE_ANATOMY.md` |

## Generated documents — do not edit by hand

Two documents are written by scripts, because both had hand-maintained ancestors
that went stale without anyone noticing. If a table here is wrong, fix the script
or the asset, not the markdown.

```bash
npm run check:licences   # -> docs/LICENCE_LOG.md, read from the shipped GLBs
npm run gen:ontology     # -> docs/ONTOLOGY_MAP.md, read from the crosswalks + assets
npm run gen:preview      # -> docs/preview.png, photographed from the running app
```

`gen:preview` needs `npm run dev` running first, because it photographs the real
app rather than a build. It drives headless Chrome over the DevTools protocol —
nothing is installed and no browser is downloaded — and waits for the app's own
"an atlas is credited" signal rather than a fixed delay. `--click` presses a
control first, so `npm run gen:preview -- --click Z-Anatomy` shoots a different
atlas. Regenerate it after any change to the UI; the README's image is a claim
about what the app looks like, and it had gone stale before.

`HANDOVER.md` also contains one generated block, the component/licence table,
written by `node scripts/gen-component-table.mjs` between its marker comments.
