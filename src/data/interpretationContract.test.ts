import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  CONTRIBUTOR_STATUSES,
  SEVERITIES,
  SYSTEM_IDS,
  UNRENDERABLE_REASONS,
  assertInterpretationDocument,
  loadInterpretationDocument,
  type InterpretationSystemId,
} from './interpretationContract'
import type { SystemId } from './schema'

type MutableObject = Record<string, unknown>

const fixture = JSON.parse(
  readFileSync('contracts/fixtures/minimal.valid.json', 'utf8'),
) as MutableObject

const schema = JSON.parse(
  readFileSync('contracts/interpretation-contract.v0.2.schema.json', 'utf8'),
) as { $defs: Record<string, { enum?: string[] }> }

function valid(): MutableObject {
  return structuredClone(fixture)
}

function list(object: MutableObject, key: string): MutableObject[] {
  return object[key] as MutableObject[]
}

function state(document: MutableObject, index = 0): MutableObject {
  return list(document, 'states')[index]
}

function unrenderable(document: MutableObject, index = 0): MutableObject {
  return list(document, 'unrenderable')[index]
}

function contributors(object: MutableObject): MutableObject[] {
  return list(object, 'contributing')
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('vendored contract', () => {
  it('matches every checksum recorded in CONTRACT_PROVENANCE.md', () => {
    const record = readFileSync('contracts/CONTRACT_PROVENANCE.md', 'utf8')
    const pinned = record
      .split(/^## /m)
      .slice(1)
      .map((section) => ({
        path: /Local path: `([^`]+)`/.exec(section)?.[1],
        sha256: /SHA256: `([0-9a-f]{64})`/.exec(section)?.[1],
      }))
    expect(pinned).toHaveLength(2)

    for (const { path, sha256 } of pinned) {
      expect(path, 'every section needs a Local path').toBeDefined()
      expect(sha256, `${path} needs a SHA256`).toBeDefined()
      const actual = createHash('sha256').update(new Uint8Array(readFileSync(path!))).digest('hex')
      expect(actual, path).toBe(sha256)
    }
  })

  it.each([
    ['SystemId', SYSTEM_IDS],
    ['Severity', SEVERITIES],
    ['ContributorStatus', CONTRIBUTOR_STATUSES],
    ['UnrenderableReason', UNRENDERABLE_REASONS],
  ])('validator enum %s equals the schema', (name, values) => {
    expect([...values]).toEqual(schema.$defs[name].enum)
  })

  it('shares its system ids with the viewer contract', () => {
    // Checked by `npm run typecheck`, which compiles this file; a no-op at run time.
    expectTypeOf<InterpretationSystemId>().toEqualTypeOf<SystemId>()
  })
})

describe('assertInterpretationDocument', () => {
  it('accepts the pinned upstream fixture and returns the same object', () => {
    const document = valid()
    expect(assertInterpretationDocument(document)).toBe(document)
  })

  it('rejects a non-object payload', () => {
    expect(() => assertInterpretationDocument(null)).toThrow(/must be an object/)
    expect(() => assertInterpretationDocument([])).toThrow(/must be an object/)
  })

  it.each([
    'schema_version',
    'intended_use',
    'not_for_diagnostic_use',
    'subject_ref',
    'as_of',
    'states',
    'unrenderable',
  ])('rejects a missing top-level `%s`', (field) => {
    const document = valid()
    delete document[field]
    expect(() => assertInterpretationDocument(document)).toThrow(new RegExp(field))
  })

  it.each([
    ['schema_version', '0.2.0'],
    ['intended_use', 'consumer_wellness'],
    ['not_for_diagnostic_use', false],
  ])('rejects an altered `%s` constant', (field, value) => {
    const document = valid()
    document[field] = value
    expect(() => assertInterpretationDocument(document)).toThrow(new RegExp(field))
  })

  it('rejects an unknown system_id', () => {
    const document = valid()
    state(document).system_id = 'immune'
    expect(() => assertInterpretationDocument(document)).toThrow(/system_id/)
  })

  it('does not invent a duplicate-system rule absent from the v0.2 schema', () => {
    const document = valid()
    list(document, 'states').push(structuredClone(state(document)))
    expect(() => assertInterpretationDocument(document)).not.toThrow()
  })

  it.each(['severity', 'confidence', 'sufficient_data', 'contributing', 'geometry'])(
    'rejects a state missing `%s`',
    (field) => {
      const document = valid()
      delete state(document)[field]
      expect(() => assertInterpretationDocument(document)).toThrow(new RegExp(field))
    },
  )

  it('rejects an empty contributing array on a system state', () => {
    const document = valid()
    state(document).contributing = []
    expect(() => assertInterpretationDocument(document)).toThrow(/at least one contributor/)
  })

  it('rejects an empty contributing array on an unrenderable state', () => {
    const document = valid()
    unrenderable(document).contributing = []
    expect(() => assertInterpretationDocument(document)).toThrow(/at least one contributor/)
  })

  it('rejects an unknown contributor status', () => {
    const document = valid()
    contributors(state(document))[0].status = 'not_collected'
    expect(() => assertInterpretationDocument(document)).toThrow(/status/)
  })

  it.each([-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects confidence %s outside the contract range',
    (confidence) => {
      const document = valid()
      state(document).confidence = confidence
      expect(() => assertInterpretationDocument(document)).toThrow(/between 0 and 1/)
    },
  )

  it('requires insufficient_reason when sufficient_data is false', () => {
    const document = valid()
    const insufficient = state(document, 1)
    delete insufficient.insufficient_reason
    expect(() => assertInterpretationDocument(document)).toThrow(/insufficient_reason/)
  })

  it('rejects loinc_system_axis as an anatomy source', () => {
    const document = valid()
    state(document).interpretive_anatomy_source = 'loinc_system_axis'
    expect(() => assertInterpretationDocument(document)).toThrow(/curated_table/)
  })

  it.each([
    ['fma_id', 'UBERON:0000948'],
    ['uberon_id', 'FMA:7088'],
  ])('rejects invalid geometry `%s`', (field, value) => {
    const document = valid()
    const geometry = state(document).geometry as MutableObject
    geometry[field] = value
    expect(() => assertInterpretationDocument(document)).toThrow(new RegExp(field))
  })

  it('rejects an unknown unrenderable reason', () => {
    const document = valid()
    unrenderable(document).reason = 'nearest_system'
    expect(() => assertInterpretationDocument(document)).toThrow(/reason/)
  })

  it('rejects additional properties at every contract object boundary', () => {
    const topLevel = valid()
    topLevel.generated_at = '2026-07-28T00:00:00.000Z'
    expect(() => assertInterpretationDocument(topLevel)).toThrow(/generated_at/)

    const nested = valid()
    state(nested).risk_percentage = 42
    expect(() => assertInterpretationDocument(nested)).toThrow(/risk_percentage/)

    const contributor = valid()
    contributors(state(contributor))[0].display_name = 'hidden payload value'
    expect(() => assertInterpretationDocument(contributor)).toThrow(/display_name/)
  })

  it.each([
    '2026-07-28t00:00:00z',
    '2016-12-31T23:59:60Z',
    '2026-07-28T00:00:00.5+05:30',
  ])('accepts RFC 3339 date-time %s', (value) => {
    const document = valid()
    document.as_of = value
    expect(() => assertInterpretationDocument(document)).not.toThrow()
  })

  it.each([
    ['as_of', '2026-02-30T00:00:00Z'],
    ['as_of', '2026-07-28'],
    ['as_of', '2026-07-28T00:00:61Z'],
    ['as_of', '2026-07-28T00:00:00+24:00'],
  ])('rejects invalid `%s` date-time values', (field, value) => {
    const document = valid()
    document[field] = value
    expect(() => assertInterpretationDocument(document)).toThrow(/date-time/)
  })

  it('does not include subject_ref in validation errors', () => {
    const document = valid()
    document.subject_ref = ''
    try {
      assertInterpretationDocument(document)
      throw new Error('expected validation to fail')
    } catch (error) {
      expect(String(error)).not.toContain('11111111-2222-3333-4444-555555555555')
    }
  })
})

describe('loadInterpretationDocument', () => {
  it('fetches and validates an unknown JSON payload', async () => {
    const payload = valid()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadInterpretationDocument('/interpretation.json')).resolves.toBe(payload)
    expect(fetchMock).toHaveBeenCalledWith('/interpretation.json')
  })

  it('rejects an unsuccessful response without logging a payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ subject_ref: 'must-not-appear' }),
      })),
    )

    await expect(loadInterpretationDocument('/interpretation.json')).rejects.toThrow(/HTTP 503/)
  })

  it('rejects a fetched document with an unsupported version', async () => {
    const payload = valid()
    payload.schema_version = 'interpretation-contract.v9'
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => payload,
      })),
    )

    await expect(loadInterpretationDocument('/interpretation.json')).rejects.toThrow(
      /schema_version/,
    )
  })
})
