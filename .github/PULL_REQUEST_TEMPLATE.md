## What this changes

<!-- One or two sentences. If it fixes something, say what was wrong. -->

## Why

<!-- Link the decision if there is one: docs/DECISIONS.md D1-D13. If this reverses
     an earlier choice, say so — reversals are recorded here on purpose. -->

## Checks

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`

**Asset pipeline** — only if you touched `scripts/` or rebuilt a GLB. These cannot
run in CI, because every asset is gitignored, so a green CI says nothing about
geometry.

- [ ] `npm run check:structures` — per-structure identity survived compression
- [ ] `npm run check:winding` — nothing inside-out
- [ ] `npm run check:licences` — log regenerated, action list read

Answer honestly. **"Not run" is a fine answer; a wrong "yes" is not** — these exist
because each failure mode is silent and looks like a different bug.

## Generated files

`docs/LICENCE_LOG.md`, `docs/ONTOLOGY_MAP.md`, `docs/preview.png` and the component
table inside `docs/HANDOVER.md` are **generated**.

- [ ] I did not hand-edit a generated file
- [ ] Or: I did, and I have moved the change into the script that writes it

## Rights

Only if this adds, replaces or rebuilds an asset.

- [ ] `licences.json` has an entry, with `holder` and `ownLicence`
- [ ] Attribution renders in-app where the licence requires it
- [ ] If anything carries no licence statement, it is excluded from a
      `--publishable` build — attribution cannot create a grant
