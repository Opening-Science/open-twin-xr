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
import type { Provenance, SystemId, TwinMetrics } from './schema'

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

/**
 * The system ids the viewer knows how to render, as a runtime value.
 *
 * ⚠️ Kept in step with `SystemId` by the type assertion below — add an id to the
 * union without adding it here and TypeScript fails the build, rather than the
 * validator silently rejecting valid data at runtime.
 */
const SYSTEM_IDS = [
  'cardiovascular',
  'respiratory',
  'nervous',
  'digestive',
  'musculoskeletal',
  'endocrine',
  'reproductive',
  'metabolic',
  'integumentary',
] as const satisfies readonly SystemId[]

const PROVENANCES = [
  'oura',
  'google-health',
  'vitronic-bodyloop',
  'open-wearables',
  'derived',
] as const satisfies readonly Provenance[]

/**
 * The contract versions this build knows how to read.
 *
 * ⚠️ READ FROM THE DATA, NOT INVENTED. The first draft of this list said `1.0`,
 * which is the obvious guess and is wrong — the bundled sample declares `0.2.0`,
 * so the validator would have rejected the app's own payload on first load.
 * `schema.ts` documents the field but pins no value, so the shipped sample is
 * the only authority for what this build actually reads.
 */
const SUPPORTED_SCHEMA = ['0.2.0'] as const

/**
 * Validate that a payload matches the viewer contract before rendering it.
 *
 * ⚠️ THIS IS THE TRUST BOUNDARY, AND IT USED TO CHECK ALMOST NOTHING. It tested
 * that `profile` existed, that `systems` was an array, and one invariant. It
 * accepted unknown system ids, duplicate ids, a string where a score belongs, a
 * score of 47 on a 0–10 scale, `hasData: true` with a null score, an unknown
 * provenance, and any `schemaVersion` at all — including none, despite the
 * schema documenting that field as what makes migration possible.
 *
 * Why that matters here more than in most apps: a score drives the COLOUR of a
 * body part. Malformed data does not crash, it renders — as a confident green
 * organ. The whole reason `hasData: false` exists is that this project refuses
 * to show a number it does not have, and a validator that lets `score: "high"`
 * through defeats that from a different direction.
 *
 * ⚠️ HAND-WRITTEN GUARDS, NOT A SCHEMA LIBRARY, and that is deliberate. Adding
 * Zod or Valibot for one function would be a runtime dependency in a repository
 * that hand-rolls every other check — and the failure MESSAGES are the product
 * here. "System 'liver' is not a body system this viewer knows" tells you what
 * to fix; `invalid_enum_value at systems.3.id` does not.
 *
 * It throws on the FIRST problem rather than collecting them, because this runs
 * on a payload that is either from your own backend or from the bundled sample.
 * Neither case benefits from a list.
 */
export function assertTwinMetrics(raw: unknown): TwinMetrics {
  if (!raw || typeof raw !== 'object') {
    throw new Error('TwinMetrics payload is not an object')
  }
  const data = raw as TwinMetrics

  if (!data.profile || typeof data.profile !== 'object') {
    throw new Error('TwinMetrics payload has no `profile`')
  }
  if (!Array.isArray(data.systems)) {
    throw new Error('TwinMetrics payload has no `systems` array')
  }

  /**
   * ⚠️ An unsupported version is refused rather than read optimistically.
   * `schema.ts` documents `schemaVersion` as the field that makes migration
   * possible; reading an unknown version anyway is what makes migration
   * impossible, because it means old builds silently half-render new payloads.
   */
  if (typeof data.schemaVersion !== 'string' || !data.schemaVersion) {
    throw new Error('TwinMetrics payload has no `schemaVersion`')
  }
  if (!(SUPPORTED_SCHEMA as readonly string[]).includes(data.schemaVersion)) {
    throw new Error(
      `TwinMetrics schemaVersion "${data.schemaVersion}" is not supported by this build ` +
        `(supports ${SUPPORTED_SCHEMA.join(', ')}). Refusing to guess at a payload it may only ` +
        'half understand.',
    )
  }

  for (const field of ['trend', 'connectedSources', 'journey'] as const) {
    if (!Array.isArray(data[field])) {
      throw new Error(`TwinMetrics payload has no \`${field}\` array`)
    }
  }

  const seen = new Set<string>()
  for (const s of data.systems) {
    if (!s || typeof s !== 'object') throw new Error('`systems` contains a non-object entry')

    if (!(SYSTEM_IDS as readonly string[]).includes(s.id)) {
      throw new Error(
        `"${s.id}" is not a body system this viewer knows. Expected one of: ${SYSTEM_IDS.join(', ')}.`,
      )
    }
    // A duplicate silently wins or loses depending on iteration order, and the
    // one that loses is invisible. That is a data bug, not a rendering choice.
    if (seen.has(s.id)) throw new Error(`System "${s.id}" appears more than once`)
    seen.add(s.id)

    if (typeof s.hasData !== 'boolean') {
      throw new Error(`System "${s.id}" has a non-boolean \`hasData\``)
    }

    if (!s.hasData) {
      if (s.score !== null) {
        throw new Error(
          `System "${s.id}" has no data but carries a score. Refusing to render a fabricated value.`,
        )
      }
    } else {
      // The mirror of the invariant above, and the one that was missing:
      // `hasData: true` with a null score renders as "measured" while having
      // nothing to show.
      if (typeof s.score !== 'number' || !Number.isFinite(s.score)) {
        throw new Error(
          `System "${s.id}" claims to have data but its score is ${JSON.stringify(s.score)}, ` +
            'not a finite number.',
        )
      }
      if (s.score < 0 || s.score > 10) {
        throw new Error(
          `System "${s.id}" has a score of ${s.score}, outside the documented 0–10 range. ` +
            'The colour ramp would clamp it and show a confident value that is not in the data.',
        )
      }
    }

    if (s.provenance !== undefined) {
      if (!Array.isArray(s.provenance)) {
        throw new Error(`System "${s.id}" has a non-array \`provenance\``)
      }
      for (const p of s.provenance) {
        if (!(PROVENANCES as readonly string[]).includes(p)) {
          throw new Error(
            `System "${s.id}" cites an unknown provenance "${p}". Expected one of: ` +
              `${PROVENANCES.join(', ')}.`,
          )
        }
      }
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
