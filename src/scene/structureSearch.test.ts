import { describe, expect, it } from 'vitest'
import {
  equivalentTerms,
  explainEmpty,
  parseTerm,
  searchStructures,
} from './structureSearch'
import { FMA_UBERON_BRIDGE } from './bridgeData'
import type { StructureEntry } from './structureEntry'

/**
 * Structure search, tested without a browser or an asset.
 *
 * The fixture mimics what a loaded atlas actually carries: a table where the
 * INDEX is the structure id the mask consumes, entries repeat by name and differ
 * by side, and only some carry an ontology term.
 */
const atlas: StructureEntry[] = [
  { name: 'Tibia', side: 'right', system: 'musculoskeletal', ontologyid: 'FMA:24477' },
  { name: 'Tibia', side: 'left', system: 'musculoskeletal', ontologyid: 'FMA:24478' },
  { name: 'Tibialis anterior', side: 'right', system: 'musculoskeletal' },
  { name: 'Left lobe of liver', side: 'left', system: 'digestive' },
  { name: 'Stomach', system: 'digestive', ontologyid: 'FMA:7148' },
  { name: 'Cochlea', side: 'right', system: 'nervous', ontologyid: 'FMA:60202' },
  { name: 'Vestibule', side: 'right', system: 'nervous', ontologyid: 'FMA:60184' },
  // Latin nomenclature (D24): one structure that also has a term, and one that
  // has Latin and NOTHING else — the regions case, where Latin is its only
  // formal identity.
  { name: 'Stomach', side: 'left', system: 'digestive', name_lat: 'Gaster' },
  { name: 'Nuchal region', system: 'regions', name_lat: 'Regio nuchalis' },
]

describe('parseTerm', () => {
  it.each([
    ['FMA:24477', 'FMA:24477'],
    ['fma:24477', 'FMA:24477'],
    ['UBERON_0002107', 'UBERON:0002107'],
    ['uberon:0002107', 'UBERON:0002107'],
    ['FMA 24477', 'FMA:24477'],
  ])('parses %s', (input, expected) => {
    expect(parseTerm(input)).toBe(expected)
  })

  it.each(['liver', 'FMA:', 'GO:0008150', ''])('rejects %s', (input) => {
    expect(parseTerm(input)).toBeNull()
  })
})

describe('equivalentTerms', () => {
  it('returns the term itself even with no bridge entry', () => {
    const { terms } = equivalentTerms('FMA:999999')
    expect(terms).toEqual(['FMA:999999'])
  })

  it('expands a UBERON term to the FMA terms UBERON cross-references', () => {
    const withFma = FMA_UBERON_BRIDGE.find((b) => b.fma.length > 0)!
    const { terms } = equivalentTerms(withFma.uberon)
    expect(terms).toContain(withFma.uberon)
    for (const f of withFma.fma) expect(terms).toContain(f)
  })

  it('expands in the reverse direction too', () => {
    const b = FMA_UBERON_BRIDGE.find((x) => x.fma.length > 0)!
    const { terms } = equivalentTerms(b.fma[0])
    expect(terms).toContain(b.uberon)
  })

  it('carries the ambiguous flag through rather than resolving it', () => {
    // A one-to-many correspondence is a fact about the source. If the bridge ever
    // gains an ambiguous row, the flag must reach the caller.
    const amb = FMA_UBERON_BRIDGE.find((b) => b.ambiguous)
    if (!amb) return
    expect(equivalentTerms(amb.uberon).ambiguous).toBe(true)
  })
})

describe('searchStructures — by name', () => {
  it('returns nothing for a blank or one-character query', () => {
    // 3,614 results is not an answer.
    for (const q of ['', ' ', 'a']) expect(searchStructures(atlas, q)).toEqual([])
  })

  it('finds both sides of a structure and reports the id the mask consumes', () => {
    const hits = searchStructures(atlas, 'tibia')
    const tibiae = hits.filter((h) => h.entry.name === 'Tibia')
    expect(tibiae).toHaveLength(2)
    expect(tibiae.map((h) => h.id).sort()).toEqual([0, 1])
    expect(new Set(tibiae.map((h) => h.entry.side))).toEqual(new Set(['left', 'right']))
  })

  it('ranks an exact label above a prefix above a substring', () => {
    const hits = searchStructures(atlas, 'tibia')
    // `Tibia` exact, then `Tibialis anterior` by prefix.
    expect(hits[0].entry.name).toBe('Tibia')
    expect(hits.at(-1)!.entry.name).toBe('Tibialis anterior')
  })

  it('matches inside a label, not only at the start', () => {
    const hits = searchStructures(atlas, 'liver')
    expect(hits.map((h) => h.entry.name)).toEqual(['Left lobe of liver'])
  })

  it('ignores case and punctuation without stemming', () => {
    expect(searchStructures(atlas, 'LEFT-LOBE of  liver')).toHaveLength(1)
  })

  it('does NOT match approximately', () => {
    // The whole discipline in one test. `tibea` is a typo, not a tibia.
    expect(searchStructures(atlas, 'tibea')).toEqual([])
    expect(searchStructures(atlas, 'stomache')).toEqual([])
  })

  it('honours a limit', () => {
    expect(searchStructures(atlas, 'tibia', { limit: 1 })).toHaveLength(1)
  })
})

describe('searchStructures — by term', () => {
  it('finds a structure by its exact CURIE', () => {
    const hits = searchStructures(atlas, 'FMA:24477')
    expect(hits).toHaveLength(1)
    expect(hits[0].entry.side).toBe('right')
    expect(hits[0].via).toBe('term')
  })

  it('reaches FMA-addressed geometry from a UBERON query, through the bridge', () => {
    // The point of the milestone: the user does not know the atlas speaks FMA.
    const stomach = FMA_UBERON_BRIDGE.find((b) => b.fma.includes('FMA:7148'))
    if (!stomach) return
    const hits = searchStructures(atlas, stomach.uberon)
    expect(hits.map((h) => h.entry.name)).toContain('Stomach')
    expect(hits[0].via).toBe('bridge')
  })

  it('returns nothing for a well-formed term no structure here uses', () => {
    expect(searchStructures(atlas, 'FMA:999999')).toEqual([])
  })

  it('never returns a structure twice', () => {
    const hits = searchStructures(atlas, 'FMA:24477')
    expect(new Set(hits.map((h) => h.id)).size).toBe(hits.length)
  })
})

describe('explainEmpty', () => {
  it('distinguishes the three reasons, because they have different fixes', () => {
    expect(explainEmpty(atlas, 'a')).toBe('too-short')
    // A name nothing here carries — this atlas may simply not model it.
    expect(explainEmpty(atlas, 'pancreas')).toBe('not-in-this-atlas')
    // A valid term nothing here uses — possibly real anatomy this atlas omits,
    // which is not the same as a term that does not exist.
    expect(explainEmpty(atlas, 'FMA:999999')).toBe('term-not-present')
  })

  it('distinguishes an atlas that carries no terms at all', () => {
    // `z-anatomy-regions` ships 257 structures and 0 terms. Every term query
    // there returns nothing however right the term is, and "not found" would
    // send someone hunting for a mapping that is not the problem.
    const untagged: StructureEntry[] = [{ name: 'Cubital fossa', system: 'region' }]
    expect(explainEmpty(untagged, 'FMA:24477')).toBe('atlas-has-no-terms')
    // A NAME search there is still an ordinary miss.
    expect(explainEmpty(untagged, 'pancreas')).toBe('not-in-this-atlas')
  })
})


describe('Latin nomenclature (D24)', () => {
  it('finds a structure by its Latin name', () => {
    const hits = searchStructures(atlas, 'Regio nuchalis')
    expect(hits.map((h) => h.entry.name)).toEqual(['Nuchal region'])
    expect(hits[0].via).toBe('latin')
  })

  it('matches Latin by prefix and substring, as a label may be', () => {
    // ⚠️ The fragment has to be one the ENGLISH name does not also contain.
    // "regio" alone is inside "Nuchal region", so the English match wins and
    // dedup keeps it — which is the intended ranking, and cost this test a
    // revision when it first asserted otherwise.
    expect(searchStructures(atlas, 'regio n').some((h) => h.via === 'latin')).toBe(true)
    expect(searchStructures(atlas, 'nuchalis').some((h) => h.via === 'latin')).toBe(true)
  })

  it('prefers the English name when a fragment matches both', () => {
    const hits = searchStructures(atlas, 'regio')
    expect(hits.find((h) => h.entry.name === 'Nuchal region')?.via).toBe('name')
  })

  it('ranks an English match above a Latin one, and never returns a structure twice', () => {
    const hits = searchStructures(atlas, 'Stomach')
    const stomachs = hits.filter((h) => h.entry.name === 'Stomach')
    expect(stomachs.every((h) => h.via === 'name')).toBe(true)
    expect(new Set(hits.map((h) => h.id)).size).toBe(hits.length)
  })

  it('does not let Latin resolve a TERM — that would be approximate matching onto an identifier', () => {
    // "Gaster" is the Latin for stomach; it must not produce an FMA resolution.
    const hits = searchStructures(atlas, 'Gaster')
    // ⚠️ Assert there IS a hit first. `every` is true of an empty array, so
    // without this the test passed whether or not Latin search returned
    // anything — a guard that cannot fail is not a guard.
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.via === 'latin')).toBe(true)
  })
})
