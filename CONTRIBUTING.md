# Contributing

Read this before your first change. It is short on process and long on the three
or four things that will actually cost you a day if nobody tells you.

**Orientation, in order:** [`README.md`](README.md) → [`docs/HANDOVER.md`](docs/HANDOVER.md)
→ [`docs/README.md`](docs/README.md) (the documentation index, which says what is
current and what is historical).

---

## How this was built, so the code makes sense

**The initial implementation was AI-assisted.** Scope, licensing decisions and
every judgement about what may be published were made by people; a large amount of
the implementation and almost all of the inline documentation was written with an AI
coding agent, under review.

Two things follow, and both are why this file exists:

1. **The comment density is unusual — about 44 % of the lines in `src/` and
   `scripts/`.** That is deliberate, not filler. The comments carry *why*, and in
   particular they carry **corrections**: places where an obvious approach was tried,
   failed, and was reverted. Those notes are the most valuable thing in the
   repository. Do not tidy them away because they read as long.
2. **Do not trust a comment over the code, and do not trust either over a
   measurement.** Several comments in this repo were wrong at some point and were
   caught by a check, not by review. If a comment states a number, it was measured
   when written — re-measure before relying on it.

If you use an AI agent yourself, [`CLAUDE.md`](CLAUDE.md) is the brief it should
read first. It is not required reading for humans.

---

## Getting it running

```bash
npm install
npm run dev
```

**Node 20 or newer.** One script — `npm run gen:preview` — needs Node 22, because
it uses the built-in `WebSocket`; it fails with a clear message on older versions.

**It runs with no assets at all**, on procedural placeholder geometry. That is a
supported state, not a broken one: the anatomy assets are large and separately
licensed, so they are gitignored. The app probes for them, falls back, and the
switcher says "not installed" rather than silently substituting.

To render real anatomy, follow [`public/models/README.md`](public/models/README.md).
Budget time: the ambient-occlusion bake is **single-threaded** and takes about
52 minutes for Z-Anatomy and two hours for HRA. See the warnings below before you
start one.

---

## The things that will bite you

Each of these has already gone wrong once. They are ordered by how much time they
cost when ignored.

### 1. Never commit an asset

`public/models/*.glb` is gitignored. The raw atlases are 100–550 MB and one
accidental `git add` is effectively unrecoverable from history. Everything under
`public/models/` is rebuildable from `scripts/`.

The same applies to third-party reference documents. If you drop a PDF or a spec
into the repo to read it, `.gitignore` it *first* — untracking it later does **not**
remove it from history.

### 2. Two documents are generated. Do not hand-edit them

| file | regenerate with |
|---|---|
| `docs/LICENCE_LOG.md` | `npm run check:licences` |
| `docs/ONTOLOGY_MAP.md` | `npm run gen:ontology` |
| the component table inside `docs/HANDOVER.md` | `node scripts/gen-component-table.mjs` |
| `docs/preview.png` | `npm run gen:preview` (needs `npm run dev` running) |

Both generated documents had hand-maintained ancestors that went stale without
anyone noticing — which is the whole reason they are generated. **If a table in one
of them is wrong, fix the script or the asset, not the markdown.**

### 3. Run the three gates after touching the pipeline

Two of these run anywhere. The three `check:*` gates need the assets.

```bash
npm run typecheck
npm run lint               # correctness rules only — see below
npm run check:structures   # per-structure identity survived compression
npm run check:winding      # no inside-out geometry
npm run check:licences     # regenerates the log, prints the action list
```

**`lint` is deliberately not a style checker.** There is no Prettier and no
stylistic rule set: this codebase carries a lot of long-form comment explaining why
something is the way it is, and a formatter would churn that for no correctness
gain. What is enabled is the set that catches defects — the React hooks rules,
unused bindings, and typescript-eslint's recommended checks. It runs in CI ahead of
the build, so a hooks violation fails the build rather than shipping.

Two things it will not let you get away with, both of which were live in this
repository until it was added: a dependency array missing something it closes over,
and an `eslint-disable` that no longer suppresses anything (one had been placed
above a comment rather than the line it meant to cover, so the warning it existed
to silence had been showing all along). If you genuinely need a disable, put it
immediately above the reported line and say why in the comment.

**These cannot run in CI, and that is not an oversight.** Every GLB is gitignored,
so a CI runner has no geometry to check. CI builds the app; asset integrity is on
whoever regenerated an asset. **Treat a green CI as saying nothing whatever about
the geometry.**

Why each exists:

- **`check:structures`** — every atlas carries a `uint16` `_STRUCTURE` id on every
  vertex plus a table in the glTF `extras`. That is what lets hover name "biceps
  brachii" rather than a merged group, inside a single draw call. Nothing in the
  compression pipeline announces damage to it: a simplify across a structure
  boundary blends ids, a weld that ignores the attribute merges across one, and a
  quantiser corrupts it outright. Each shows up as hover naming the *wrong*
  structure, which looks like a mapping bug and is not one.
- **`check:winding`** — none of these GLBs carry a `NORMAL` attribute, because
  stripping it is what lets vertex welding build a manifold that can actually be
  simplified. Normals are computed at load from triangle winding, so an importer
  that bakes a mirrored transform without reversing triangle order leaves half the
  body inside-out. It renders as a smooth washed-out half with a seam down the
  midline, and reads as a lighting bug.
- **`check:licences`** — reads the *shipped* GLBs, including the per-structure
  third-party component tags, and regenerates the log. Read its action list before
  publishing anything.

### 4. Do not run two asset conversions at once

The constraint is RAM, not cores. `gltf-transform optimize` holds decoded geometry
plus working copies — 1–2 GB peak for a 400–550 MB source. Two at once died silently
here. And more cores do not make one bake faster: `bake-ao` measured 99.3 % of a
single core.

`scripts/restrength-ao.mjs` re-maps a baked asset to a different AO strength
**without casting a ray**, because the term is a linear function of the occlusion
fraction. Never bake for an hour to change that number.

### 5. Licensing is a hard constraint, not a preference

- **Code is MIT. The anatomy assets are not.** Each keeps its own licence, which is
  why they stay separate files and are **never merged into one GLB** — merging a
  share-alike atlas into a permissive one imposes share-alike on both.
- `licences.json` is the register. Every asset on disk needs an entry, whether or
  not it renders.
- The bundle is **open source, non-commercial** — not Open Definition conformant,
  because CC BY-NC components are present. Say so plainly; do not badge a release
  CC BY-SA and leave it.
- **Geometry with no licence statement grants nothing**, and attribution cannot
  create a grant. Build with `npm run build:z-anatomy -- --publishable` for anything
  that will be served. Serving behind a login wall is still distribution.

### 6. Never fabricate a value

This is the project's oldest rule and it is enforced in code.

- Missing data is `hasData: false, score: null`, rendered as "no data" — never 0,
  never a midpoint. `assertTwinMetrics()` enforces it; do not weaken it.
- A surface with no colour source is left neutral grey and **counted**, not given a
  plausible colour.
- An organ overlay is shown at its own measured size, never scaled to fit the body
  it sits in, because that would misrepresent a real person's anatomy.

### 7. The canonical frame makes atlases the same size, not the same person

Every atlas is fitted into one frame — centred, feet at y=0, 1.7 m tall. It is
tempting to conclude that one overlay placement therefore works everywhere. It does
not: the atlases are **different donors**, and the same organ sits 29.3 mm apart
between two of them. Overlay placement is per-atlas and measured. See
`placements` in `src/scene/organOverlays.ts`.

---

## Two things deliberately not built

- **No AI layer.** `src/ui/ChatbotStub.tsx` is a visual stub on purpose. There are
  no LLM calls in this repository and none should be added here.
- **No scoring UI.** Health-data mapping moved upstream to
  [`etzm/open-twin`](https://github.com/etzm/open-twin) under decision **D8**. The
  scoring components remain unmounted under `src/ui/` for a later iteration. Do not
  rebuild them, and never present the bundled fictional sample as anyone's measured
  health.

  Seven files are unmounted — nothing imports them: `ChatbotStub`, `ConnectedSources`,
  `DetailPanel`, `MetricsStatusCard`, `Sidebar`, `SystemScoreList`, `TrendChart`. Each
  now says so in its own header, because reading the file gives no other clue and the
  cost of not knowing is an afternoon spent editing something that cannot appear on
  screen. They are still compiled and type-checked, so they do not rot.

  One consequence worth a decision at some point: `TrendChart` is the only importer of
  **`recharts`**, which is therefore a 5.3 MB runtime dependency (plus d3 and
  victory-vendor) installed on every `npm ci` and never shipped — an unimported module
  never enters the bundle. Keeping it is what lets the component still compile. If the
  scoring UI is ever abandoned rather than deferred, drop both together.

---

## Making a change

1. **Read [`docs/DECISIONS.md`](docs/DECISIONS.md) first** if your change touches
   architecture, licensing or the asset pipeline. It records D1–D15 and, more
   usefully, what was **reversed and why**. Several obvious improvements are in
   there as things already tried.
2. Branch off `main`. Keep the branch focused.
3. Run `npm run typecheck`, `npm run lint` and `npm run build`. Run the asset gates
   if you touched the pipeline.
4. Open a PR. The template asks which gates you ran and whether you edited a
   generated file — answer both honestly; "not run" is a fine answer, a wrong "yes"
   is not.
5. If you discover that a comment or document is wrong, **fix it in the same PR and
   say so in the body.** A correction recorded in place is worth more than a tidy
   diff.

## For whoever administers the repository

Suggested settings, and the reasoning rather than just the switch:

- **Protect `main`**: require a PR, require the CI check, and require one approving
  review. `CODEOWNERS` routes rights, pipeline and data-contract changes to the
  maintainer, because those three can each break something that a build passing
  will not reveal.
- **CI runs `npm ci && npm run lint && npm run build` on Node 20** — deliberately the lower bound of
  `engines`, so a change that needs a newer runtime fails in CI rather than on
  someone's machine. `npm run build` includes `tsc -b`, so types are gated.
- **CI cannot gate the assets.** Every GLB is gitignored, so there is nothing for a
  runner to check. Asset integrity depends on whoever regenerated an asset running
  the three gates locally and saying so in the PR.
- **Do not enable a "squash and merge only" policy without thought.** Reversals are
  part of this repository's record — `docs/DECISIONS.md` exists because knowing what
  was tried and undone is load-bearing here.

## Where to start

[`docs/HANDOVER.md`](docs/HANDOVER.md) ends with five good first tasks, ordered by
what you learn per hour rather than by importance. The first one — writing the FMA
crosswalk into the Z-Anatomy asset — is also the one that unblocks the most.
