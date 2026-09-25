/**
 * Browser trust boundary for the pinned interpretation-contract.v0.2 schema.
 *
 * This module validates and types the upstream document; it does not score,
 * interpret, colour anatomy, or display subject_ref. The vendored JSON Schema
 * remains the source of truth.
 *
 * v0.2 does not declare states unique by system_id. This validator therefore
 * does not add a consumer-only uniqueness rule; that constraint must be added
 * and versioned upstream before XR enforces it.
 *
 * The enum constants below are copied from the schema by hand, so they are
 * exported for `interpretationContract.test.ts`, which compares each one with
 * the vendored schema's `$defs` — a refresh that changes an enum there and not
 * here fails the tests instead of shipping a validator that disagrees.
 */
export const SYSTEM_IDS = [
  'musculoskeletal',
  'cardiovascular',
  'nervous',
  'respiratory',
  'metabolic',
  'digestive',
  'endocrine',
  'integumentary',
  'reproductive',
] as const

export const SEVERITIES = ['none', 'borderline', 'mild', 'moderate', 'marked', 'indeterminate'] as const

export const CONTRIBUTOR_STATUSES = [
  'present',
  'missing',
  'stale',
  'no_reference_interval',
  'unit_incommensurable',
] as const

export const UNRENDERABLE_REASONS = [
  'no_system_id_upstream',
  'not_anatomical',
  'system_excluded_upstream',
] as const

/**
 * RFC 3339 `date-time` (section 5.6). The separator and `Z` may be lower case,
 * and a leap second (`:60`) is valid — both are legal RFC 3339 that a producer
 * may emit, so rejecting them would make this consumer stricter than the
 * contract. `Date.parse` is deliberately not used: it rejects `:60` and its
 * handling of lower-case separators varies by engine.
 */
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/

export type InterpretationSystemId = (typeof SYSTEM_IDS)[number]
export type Severity = (typeof SEVERITIES)[number]
export type ContributorStatus = (typeof CONTRIBUTOR_STATUSES)[number]
export type UnrenderableReason = (typeof UNRENDERABLE_REASONS)[number]

export interface Contributor {
  biomarker_id: string
  loinc_code?: string
  status: ContributorStatus
  observed_at?: string | null
  reference_interval_id?: string | null
}

export interface InterpretationGeometry {
  fma_id: string
  uberon_id?: string
}

export interface InterpretationSystemState {
  system_id: InterpretationSystemId
  severity: Severity
  confidence: number
  sufficient_data: boolean
  insufficient_reason?: string
  contributing: Contributor[]
  interpretive_anatomy_source: 'curated_table'
  geometry: InterpretationGeometry
}

export interface UnrenderableState {
  id: string
  label?: string
  reason: UnrenderableReason
  severity: Severity
  confidence: number
  sufficient_data: boolean
  insufficient_reason?: string
  contributing: Contributor[]
}

export interface InterpretationDocumentV02 {
  schema_version: 'interpretation-contract.v0.2'
  intended_use: 'research_hypothesis_generation_n_of_1'
  not_for_diagnostic_use: true
  subject_ref: string
  as_of: string
  states: InterpretationSystemState[]
  unrenderable: UnrenderableState[]
}

type JsonObject = Record<string, unknown>

function hasOwn(object: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function fail(path: string, expectation: string): never {
  throw new Error(`Interpretation document ${path} ${expectation}`)
}

function objectAt(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object')
  }
  return value as JsonObject
}

function onlyKeys(object: JsonObject, allowed: readonly string[], path: string): void {
  const known = new Set(allowed)
  const unknown = Object.keys(object).find((key) => !known.has(key))
  if (unknown) fail(`${path}.${unknown}`, 'is not allowed by interpretation-contract.v0.2')
}

function required(object: JsonObject, keys: readonly string[], path: string): void {
  const missing = keys.find((key) => !hasOwn(object, key))
  if (missing) fail(`${path}.${missing}`, 'is required')
}

function nonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) fail(path, 'must be a non-empty string')
}

function optionalString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string') fail(path, 'must be a string')
}

function dateTime(value: unknown, path: string): asserts value is string {
  nonEmptyString(value, path)
  const match = DATE_TIME.exec(value)
  if (!match) fail(path, 'must be an RFC 3339 date-time')

  const [, year, month, day, hour, minute, second, offsetHour, offsetMinute] = match
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  const validCalendarDate =
    calendar.getUTCFullYear() === Number(year) &&
    calendar.getUTCMonth() === Number(month) - 1 &&
    calendar.getUTCDate() === Number(day)

  if (
    !validCalendarDate ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 60 ||
    (offsetHour !== undefined && Number(offsetHour) > 23) ||
    (offsetMinute !== undefined && Number(offsetMinute) > 59)
  ) {
    fail(path, 'must be an RFC 3339 date-time')
  }
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): asserts value is T {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of: ${values.join(', ')}`)
  }
}

function boundedNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(path, 'must be a finite number between 0 and 1')
  }
}

function booleanAt(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') fail(path, 'must be a boolean')
}

function arrayAt(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array')
  return value
}

function nullableString(value: unknown, path: string): void {
  if (value !== null && typeof value !== 'string') fail(path, 'must be a string or null')
}

function contributorAt(value: unknown, path: string): void {
  const contributor = objectAt(value, path)
  onlyKeys(
    contributor,
    ['biomarker_id', 'loinc_code', 'status', 'observed_at', 'reference_interval_id'],
    path,
  )
  required(contributor, ['biomarker_id', 'status'], path)

  nonEmptyString(contributor.biomarker_id, `${path}.biomarker_id`)
  enumValue(contributor.status, CONTRIBUTOR_STATUSES, `${path}.status`)

  if (hasOwn(contributor, 'loinc_code')) {
    optionalString(contributor.loinc_code, `${path}.loinc_code`)
  }
  if (hasOwn(contributor, 'observed_at')) {
    if (contributor.observed_at !== null) dateTime(contributor.observed_at, `${path}.observed_at`)
  }
  if (hasOwn(contributor, 'reference_interval_id')) {
    nullableString(contributor.reference_interval_id, `${path}.reference_interval_id`)
  }
}

function contributorsAt(value: unknown, path: string): void {
  const contributors = arrayAt(value, path)
  if (contributors.length === 0) fail(path, 'must contain at least one contributor')
  contributors.forEach((contributor, index) => contributorAt(contributor, `${path}[${index}]`))
}

function geometryAt(value: unknown, path: string): void {
  const geometry = objectAt(value, path)
  onlyKeys(geometry, ['fma_id', 'uberon_id'], path)
  required(geometry, ['fma_id'], path)

  if (typeof geometry.fma_id !== 'string' || !/^FMA:[0-9]+$/.test(geometry.fma_id)) {
    fail(`${path}.fma_id`, 'must match FMA:<digits>')
  }
  if (
    hasOwn(geometry, 'uberon_id') &&
    (typeof geometry.uberon_id !== 'string' || !/^UBERON:[0-9]+$/.test(geometry.uberon_id))
  ) {
    fail(`${path}.uberon_id`, 'must match UBERON:<digits>')
  }
}

function sufficientDataFields(object: JsonObject, path: string): void {
  booleanAt(object.sufficient_data, `${path}.sufficient_data`)
  if (object.sufficient_data === false && !hasOwn(object, 'insufficient_reason')) {
    fail(`${path}.insufficient_reason`, 'is required when sufficient_data is false')
  }
  if (hasOwn(object, 'insufficient_reason')) {
    nonEmptyString(object.insufficient_reason, `${path}.insufficient_reason`)
  }
}

function systemStateAt(value: unknown, path: string): void {
  const state = objectAt(value, path)
  onlyKeys(
    state,
    [
      'system_id',
      'severity',
      'confidence',
      'sufficient_data',
      'insufficient_reason',
      'contributing',
      'interpretive_anatomy_source',
      'geometry',
    ],
    path,
  )
  required(
    state,
    [
      'system_id',
      'severity',
      'confidence',
      'sufficient_data',
      'contributing',
      'interpretive_anatomy_source',
      'geometry',
    ],
    path,
  )

  enumValue(state.system_id, SYSTEM_IDS, `${path}.system_id`)
  enumValue(state.severity, SEVERITIES, `${path}.severity`)
  boundedNumber(state.confidence, `${path}.confidence`)
  sufficientDataFields(state, path)
  contributorsAt(state.contributing, `${path}.contributing`)

  if (state.interpretive_anatomy_source !== 'curated_table') {
    fail(`${path}.interpretive_anatomy_source`, 'must be curated_table')
  }
  geometryAt(state.geometry, `${path}.geometry`)
}

function unrenderableStateAt(value: unknown, path: string): void {
  const state = objectAt(value, path)
  onlyKeys(
    state,
    [
      'id',
      'label',
      'reason',
      'severity',
      'confidence',
      'sufficient_data',
      'insufficient_reason',
      'contributing',
    ],
    path,
  )
  required(
    state,
    ['id', 'reason', 'contributing', 'severity', 'confidence', 'sufficient_data'],
    path,
  )

  nonEmptyString(state.id, `${path}.id`)
  if (hasOwn(state, 'label')) optionalString(state.label, `${path}.label`)
  enumValue(state.reason, UNRENDERABLE_REASONS, `${path}.reason`)
  enumValue(state.severity, SEVERITIES, `${path}.severity`)
  boundedNumber(state.confidence, `${path}.confidence`)
  sufficientDataFields(state, path)
  contributorsAt(state.contributing, `${path}.contributing`)
}

export function assertInterpretationDocument(raw: unknown): InterpretationDocumentV02 {
  const document = objectAt(raw, '$')
  onlyKeys(
    document,
    [
      'schema_version',
      'intended_use',
      'not_for_diagnostic_use',
      'subject_ref',
      'as_of',
      'states',
      'unrenderable',
    ],
    '$',
  )
  required(
    document,
    [
      'schema_version',
      'intended_use',
      'not_for_diagnostic_use',
      'subject_ref',
      'as_of',
      'states',
      'unrenderable',
    ],
    '$',
  )

  if (document.schema_version !== 'interpretation-contract.v0.2') {
    fail('$.schema_version', 'must be interpretation-contract.v0.2')
  }
  if (document.intended_use !== 'research_hypothesis_generation_n_of_1') {
    fail('$.intended_use', 'must be research_hypothesis_generation_n_of_1')
  }
  if (document.not_for_diagnostic_use !== true) {
    fail('$.not_for_diagnostic_use', 'must be true')
  }

  nonEmptyString(document.subject_ref, '$.subject_ref')
  dateTime(document.as_of, '$.as_of')

  arrayAt(document.states, '$.states').forEach((state, index) =>
    systemStateAt(state, `$.states[${index}]`),
  )
  arrayAt(document.unrenderable, '$.unrenderable').forEach((state, index) =>
    unrenderableStateAt(state, `$.unrenderable[${index}]`),
  )

  return document as unknown as InterpretationDocumentV02
}

/**
 * Not called by the app yet: it is the seam XR-2 will use to fetch a document.
 * Kept here so the fetch path is validated and tested together with the guard.
 */
export async function loadInterpretationDocument(url: string): Promise<InterpretationDocumentV02> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to load interpretation document: HTTP ${response.status}`)
  }
  return assertInterpretationDocument(await response.json())
}
