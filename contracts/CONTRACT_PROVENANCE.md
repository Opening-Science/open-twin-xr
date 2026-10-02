# Interpretation contract provenance

These files are pinned, read-only copies from `Opening-Science/open-twin`.

## Schema

- Upstream commit: `ffdf8997f76d15c8bed901043d340650aad0af08`
- Upstream path: `docs/contracts/interpretation-contract.v0.2.schema.json`
- Local path: `contracts/interpretation-contract.v0.2.schema.json`
- Schema `$id`: `https://open-twin.org/contracts/interpretation-contract.v0.2.schema.json`
- SHA256: `785a05a1a02d1e157ab9ae53d92c3e98fc2fad58f916c60ae25a39331e88a5cd`

## Acceptance fixture

- Upstream commit: `84305d105a30ca5bbc3c9e4d7bace2d9ce5aa2ce`
- Upstream path: `packages/interpretation-contract/fixtures/accept/minimal.valid.json`
- Local path: `contracts/fixtures/minimal.valid.json`
- SHA256: `679e6a306960a489afe55f1421293ee6dde4ea930122a55275ec8e20c7d3cda3`

The fixture is synthetic. `subject_ref` is an opaque test reference and must not be
shown as a person's name. It lives beside the schema rather than under `public/`
because only the tests read it: anything in `public/` is copied into every build,
and a fictional health state has no business being served from a deployed viewer.

## Reject fixture

- Upstream commit: `ffdf8997f76d15c8bed901043d340650aad0af08`
- Upstream path: `packages/interpretation-contract/fixtures/reject/duplicate-system-id.json`
- Local path: `contracts/fixtures/duplicate-system-id.json`
- SHA256: `6f69beecf37b60ac63f306b8020bd7c668692767e82f3699d5f5c2f74d4cb419`

The upstream JSON Schema is the contract source of truth. The browser does not load
or compile it at runtime; `src/data/interpretationContract.ts` implements the same
boundary using hand-written guards, matching this repository's existing validation
style. Refresh the schema, fixture, checksums, validator, and tests together.

That instruction is enforced, not remembered. `src/data/interpretationContract.test.ts`
re-hashes every `Local path` above and fails if it no longer matches the `SHA256`
line in the same section, and it compares each enum in the validator with the
matching `$defs` enum in the vendored schema. Refreshing a file without updating
this record — or the schema without the validator — fails `npm run test`.
