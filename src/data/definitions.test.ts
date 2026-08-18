import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * The definitions loader, which exists to be quiet when there is nothing to say.
 *
 * Coverage of the ontologies is uneven by nature — UBERON defines nearly
 * everything it names, FMA almost nothing — so "no definition" is the common
 * path, not the error path, and it is the one worth pinning.
 */
async function fresh() {
  vi.resetModules()
  return import('./definitions')
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('definitionFor', () => {
  it('returns the definition for a term the file carries', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          definitions: {
            'UBERON:0002107': {
              text: 'An exocrine gland which secretes bile.',
              label: 'liver',
              source: 'UBERON',
              licence: 'CC BY 3.0',
            },
          },
        }),
      })),
    )
    const { definitionFor } = await fresh()
    expect((await definitionFor('UBERON:0002107'))?.text).toMatch(/exocrine gland/)
    expect(await definitionFor('FMA:99999')).toBeNull()
  })

  it('returns null for a structure with no term, without fetching', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { definitionFor } = await fresh()
    expect(await definitionFor(null)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('degrades to silence when the file is absent — the repo must run with zero built assets', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    const { definitionFor } = await fresh()
    expect(await definitionFor('UBERON:0002107')).toBeNull()
  })

  it('degrades to silence when the fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    const { definitionFor } = await fresh()
    expect(await definitionFor('UBERON:0002107')).toBeNull()
  })

  it('fetches once for many lookups — a 404 must not become one request per selection', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ definitions: {} }) }))
    vi.stubGlobal('fetch', fetchSpy)
    const { definitionFor } = await fresh()
    await Promise.all([
      definitionFor('UBERON:1'),
      definitionFor('UBERON:2'),
      definitionFor('FMA:3'),
    ])
    await definitionFor('UBERON:4')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
