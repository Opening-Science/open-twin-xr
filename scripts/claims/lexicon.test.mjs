import { describe, expect, it } from 'vitest'
import { lintClaims } from './lexicon.mjs'

/**
 * The first tests in this repository.
 *
 * They are deliberately about the LEXICON rather than about the renderer. The
 * geometry is verified by the `check:*` scripts against real assets, which is
 * the right tool for it — a unit test asserting that a triangle count is what a
 * previous run produced tests nothing. What genuinely benefits from tests is
 * this: a pure string function whose failure mode is silent and whose whole job
 * is to be trusted by CI.
 */
describe('lintClaims', () => {
  it('passes ordinary anatomical copy', () => {
    const ok = [
      'Hover a structure to identify it',
      'Bone, cartilage and ligament',
      'Render the skin as glass so the body keeps its outline',
      'Named regions of the body surface — cubital fossa, carotid triangle',
      'This structure comes from a third-party component under different terms',
      'A generated surface — no organs, no donor, no scan of anyone.',
    ]
    for (const s of ok) expect(lintClaims(s), s).toEqual([])
  })

  it('catches a medical purpose', () => {
    const v = lintClaims('This view helps diagnose liver disease.')
    expect(v.map((x) => x.category)).toContain('medical')
    expect(v.map((x) => x.term)).toEqual(expect.arrayContaining(['diagnose', 'disease']))
  })

  it('catches monitoring framing, which is MDR Rule 11', () => {
    expect(lintClaims('Monitor your heart over time.').map((x) => x.category)).toContain(
      'monitoring',
    )
    // The permitted alternatives must NOT trip it, or the rule is unusable.
    expect(lintClaims('Track and log the values you supply.')).toEqual([])
  })

  it('catches unsafe reassurance', () => {
    for (const s of ['Your liver looks healthy.', 'Nothing to worry about here.']) {
      expect(lintClaims(s).map((x) => x.category), s).toContain('reassurance')
    }
  })

  it('flags clinical reference-range language for review rather than banning it', () => {
    const v = lintClaims('This sits inside the normal range.')
    expect(v.length).toBeGreaterThan(0)
    expect(v.every((x) => x.severity === 'warn' || x.severity === 'error')).toBe(true)
    expect(v.map((x) => x.term)).toContain('normal range')
  })

  it('does not trip on the words this repository legitimately uses', () => {
    // ⚠️ This is the test that keeps the lint switched on. A linter that cries
    // wolf on organ-system names, on a real dataset's title, or on the repo's
    // own scope sentence gets disabled within a week, and then protects nothing.
    const legitimate = [
      'Metabolic',
      'Endocrine',
      'Lymphoid organs render unresolved, deliberately',
      'TCIA Healthy-Total-Body-CTs subject 003',
      'Health-data mapping lives upstream in etzm/open-twin',
      'Colour by the supplied per-system metric',
      'One right temporal bone from one cadaver — not a population',
    ]
    for (const s of legitimate) expect(lintClaims(s), s).toEqual([])
  })

  it('matches on word boundaries, not substrings', () => {
    // `treat` must not fire inside `retreat`, and `is fine` must not fire inside
    // `this finer detail`. Substring matching is how a lint like this becomes
    // noise, so it is asserted rather than assumed.
    expect(lintClaims('a strategic retreat')).toEqual([])
    expect(lintClaims('this finer detail')).toEqual([])
  })

  it('returns nothing for empty or non-string input', () => {
    expect(lintClaims('')).toEqual([])
    expect(lintClaims('   ')).toEqual([])
    expect(lintClaims(undefined)).toEqual([])
    expect(lintClaims(null)).toEqual([])
  })
})
