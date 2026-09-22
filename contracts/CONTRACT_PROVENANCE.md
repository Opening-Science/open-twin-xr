# Interpretation contract provenance

These files are pinned, read-only copies from `Opening-Science/open-twin`.

## Schema

- Upstream commit: `84305d105a30ca5bbc3c9e4d7bace2d9ce5aa2ce`
- Upstream path: `docs/contracts/interpretation-contract.v0.2.schema.json`
- Schema `$id`: `https://open-twin.org/contracts/interpretation-contract.v0.2.schema.json`
- SHA256: `ae8b4769fa9e834fe9da52441160135ae12a4ad78204ebabb1e20c5f4fc95c39`

## Acceptance fixture

- Upstream commit: `84305d105a30ca5bbc3c9e4d7bace2d9ce5aa2ce`
- Upstream path: `packages/interpretation-contract/fixtures/accept/minimal.valid.json`
- Local path: `public/data/interpretation/minimal.valid.json`
- SHA256: `679e6a306960a489afe55f1421293ee6dde4ea930122a55275ec8e20c7d3cda3`

The fixture is synthetic. `subject_ref` is an opaque test reference and must not be
shown as a person's name.

The upstream JSON Schema is the contract source of truth. The browser does not load
or compile it at runtime; `src/data/interpretationContract.ts` implements the same
boundary using hand-written guards, matching this repository's existing validation
style. Refresh the schema, fixture, checksums, validator, and tests together.
