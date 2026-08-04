/**
 * Data adapter: the ONLY place that knows about upstream shapes.
 *
 * READ docs/SCHEMA_VERIFICATION.md FIRST. The original scaffold assumed
 * `etzm/open-twin` hands over per-system scores. It does not.
 *
 * What open-twin actually is
 * --------------------------
 * A pnpm monorepo of connectors (`@open-twin/provider-oura`,
 * `@open-twin/provider-google-health`, `@open-twin/provider-vitronic`,
 * `@open-twin/open-wearables`, on `@open-twin/fhir-core`) that translate vendor
 * APIs into **FHIR R4 Bundles of raw `Observation` resources**.
 *
 * Bundle entry points return `{ bundle, issues? }`, where `issues` is a FHIR
 * `OperationOutcome` and is ABSENT on the fully-happy path — with one exception:
 * `getFhirBundleFromGoogleHealthData()` returns a third, NON-optional field,
 * `unmapped: string[]`. It lists declared data types that arrived and were
 * dropped, and it is the only signal that this happened. Destructuring
 * `{ bundle, issues }` silently discards it. See docs/ARCHITECTURE.md section 1.
 *
 * Two consequences that shape this file:
 *
 * 1. SCORING DOES NOT EXIST YET. Something must turn Observations into the
 *    0-10 per-system scores the viewer renders. That is a clinical judgement,
 *    not a mapping detail. Recommended home: a new `@open-twin/scoring`
 *    package upstream, next to the terminology and reference-range machinery it
 *    depends on. `@open-twin/fhir-core/referenceRange.ts` is the honest basis:
 *    it attaches typed reference intervals (normal / recommended / treatment)
 *    with a mandatory source URL and publisher.
 *
 * 2. THIS RUNS SERVER-SIDE, and it is a hard technical constraint rather than a
 *    preference. `@open-twin/fhir-core` imports `node:crypto` and every package
 *    depends on it, so nothing here loads in a browser at all. The network
 *    providers additionally take a client secret (VITRONIC: a plaintext
 *    username and password) at construction. The browser fetches an already
 *    scored `TwinMetrics` JSON from your own backend.
 *
 *    Note the connectors are NOT stateless, despite upstream D8 describing them
 *    that way: Oura, Google Health and VITRONIC each hold mutable in-process
 *    token state, and the `TokenStore` / `CursorStore` interfaces D8 delegates
 *    persistence to DO NOT EXIST in the code. Token lifecycle is your server's
 *    unsolved problem — Oura in particular offers no getter for refreshed
 *    tokens.
 *
 * So the production topology is:
 *
 *    [vendor APIs] -> open-twin connectors -> FHIR Bundle
 *                  -> scoring (reference ranges) -> TwinMetrics JSON
 *                  -> (HTTP) -> this browser app
 *
 * `fromFhirBundle()` below is the seam for step two. It is deliberately
 * unimplemented rather than faked, because a plausible-looking wrong score is
 * worse than an obvious gap.
 */
import type { TwinMetrics } from './schema'

const SCORED_TWIN_URL = '/data/sample-twin.json'

/**
 * Minimal structural view of what the connectors emit. Intentionally loose:
 * do not rebuild FHIR types here, use `@types/fhir` (`fhir/r4`) server-side,
 * which open-twin already depends on.
 */
export interface OpenTwinResult {
  /** FHIR R4 Bundle of Observation resources. */
  bundle: unknown
  /** FHIR OperationOutcome. Absence of data is never an exception upstream. */
  issues?: unknown
  /**
   * Google Health only, and NOT optional there: declared data types that
   * arrived and were dropped by the mapper. Empty is the healthy case. Surface
   * it — a silently dropped type looks identical to a type with no data, and
   * the two must not both render as "no data".
   */
  unmapped?: string[]
}

/**
 * SERVER-SIDE. Turn a FHIR R4 Bundle into the viewer contract.
 *
 * DELIBERATELY UNIMPLEMENTED HERE, AND IT SHOULD STAY THAT WAY.
 *
 * This repository renders a human. It is not where health data is interpreted.
 * Turning Observations into scores needs reference intervals, terminology
 * mapping and a named clinical reviewer for the aggregation weights — all of
 * which live next to the machinery they depend on, in
 * **<https://github.com/etzm/open-twin>**. `HANDOVER_SPEC` section 5a says the
 * same: the home is a `@open-twin/scoring` package upstream, not `src/` here.
 *
 * A full implementation was written against this seam and then removed for
 * exactly that reason. If it is useful upstream, lift it from commit
 * **6c6e125** — it covers reference-interval normalisation, the four honest
 * score states, and a `systemWeighting()` that refuses to construct without a
 * named reviewer. It is pure and imports nothing from the viewer.
 *
 * What must not change whichever repo implements it: missing data is
 * `hasData: false, score: null`, never zero and never a midpoint.
 * `assertTwinMetrics()` below enforces that at the boundary, and it is the
 * one guarantee this repo does keep.
 */
export function fromFhirBundle(_result: OpenTwinResult): TwinMetrics {
  throw new Error(
    'fromFhirBundle() is not implemented here by design. Scoring belongs to ' +
      'github.com/etzm/open-twin; this app consumes an already-scored TwinMetrics. ' +
      'See the note above and docs/SCHEMA_VERIFICATION.md.',
  )
}

/** Validate that a payload matches the viewer contract before rendering it. */
export function assertTwinMetrics(raw: unknown): TwinMetrics {
  const data = raw as TwinMetrics
  if (!data || !data.profile || !Array.isArray(data.systems)) {
    throw new Error('Payload does not match the TwinMetrics contract')
  }
  for (const s of data.systems) {
    if (!s.hasData && s.score !== null) {
      throw new Error(`System "${s.id}" has no data but carries a score. Refusing to render a fabricated value.`)
    }
  }
  return data
}

/**
 * Load an already-scored twin. In production this points at your own backend
 * endpoint, which runs the connectors and the scoring step server-side. In
 * development it serves the fictional bundled sample.
 */
export async function loadTwin(url: string = SCORED_TWIN_URL): Promise<TwinMetrics> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load twin data: ${res.status}`)
  return assertTwinMetrics(await res.json())
}
