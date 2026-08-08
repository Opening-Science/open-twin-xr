/**
 * A claim lexicon for this repository's own user-facing copy.
 *
 * WHY A VIEWER NEEDS ONE
 * ----------------------
 * This repository is deliberately NOT a medical device and not a health
 * product. D8 moved scoring and interpretation upstream, D15 was an exercise in
 * removing health language from the interface, and `CLAUDE.md` opens by saying
 * the bundled sample must never be presented as anyone's measured health.
 *
 * All of that is currently protected by nobody writing the wrong sentence. That
 * is not a control — it is a hope. Claim creep does not arrive as a decision; it
 * arrives as one helpful tooltip. Under MDR Article 2(1) the INTENDED PURPOSE is
 * inferred from what you say the thing is for, and a UI string is exactly that
 * kind of evidence.
 *
 * So this exists to make a claim a thing that fails a build rather than a thing
 * somebody notices later. It is a lint over static copy, not a proposals engine:
 * the interpretation layer belongs elsewhere entirely.
 *
 * ⚠️ WHAT IT DOES NOT DO. A banned-token pass cannot see an unhedged causal
 * claim that happens to contain no listed word, and it will never understand
 * context. Passing this lint is evidence of nothing except that the obvious
 * mistakes are absent. It is a floor, not a certificate.
 *
 * Plain ESM rather than TypeScript so that both the CI scanner and the test
 * suite can import it with no build step, and so it never enters the app bundle.
 */

/**
 * MDR Article 2(1): each of these implies a MEDICAL PURPOSE — diagnosis,
 * prevention, monitoring, prediction, prognosis, treatment or alleviation of
 * disease. A viewer that says any of them about the body on screen is making a
 * claim it is not built to support.
 */
export const BANNED_MEDICAL = [
  'diagnose',
  'diagnosis',
  'diagnostic',
  'disease',
  'disorder',
  'dysfunction',
  'syndrome',
  'symptom',
  'treat',
  'treatment',
  'therapy',
  'cure',
  'pathological',
  'pathology',
  'deficiency',
  'insufficiency',
  'screen for',
  'rule out',
  'you have',
  'you are at risk',
  'medication',
  'prescribe',
  'clinically',
]

/**
 * MDR Rule 11, second paragraph: framing that reads as MONITORING physiological
 * processes. The permitted forms are neutral verbs about data the viewer
 * supplied — `track`, `log`, `show` — which state what the software does
 * without implying it is watching for something.
 */
export const BANNED_MONITORING = [
  'monitor',
  'monitoring',
  'surveillance',
  'abnormality detected',
  'early warning',
]

/**
 * Unsafe reassurance. The mirror image of a warning and worse, because it
 * invites someone to not seek care. There is no compliant version of these —
 * the correct behaviour is to say nothing about health at all.
 */
export const BANNED_REASSURANCE = [
  'looks healthy',
  'is fine',
  'nothing to worry about',
  'no cause for concern',
  'all clear',
  'you are healthy',
  'normal for your age',
  'within a healthy band',
]

/**
 * Terms that are legitimate ANATOMY words and also clinical red flags depending
 * on how they are used. `normal` is the one that matters: "normal anatomy" is
 * ordinary anatomical English, while "normal range" is a clinical reference
 * interval and a claim. Flagged as a warning rather than an error, because a
 * blanket ban would reject correct anatomical writing.
 */
export const REVIEW_TERMS = ['normal range', 'reference range', 'abnormal', 'healthy range']

/**
 * ⚠️ WORDS THIS REPOSITORY LEGITIMATELY USES, and which a naive list would trip
 * over. Every one of them is anatomy or licensing vocabulary, not a health
 * claim, and excluding them is what keeps the lint credible enough to stay on.
 *
 *   `metabolic`, `endocrine`, `lymphoid`  — organ system names, from `SystemId`
 *   `metrics`, `score`                    — the supplied-value colour mode, D8
 *   `healthy-total-body-cts`              — the literal name of a TCIA dataset
 *   `donor`, `cadaver`, `specimen`        — provenance, which must be stated
 */
export const ALLOWED_CONTEXTS = [
  /healthy[- ]total[- ]body/i,
  /Healthy-Total-Body-CTs/i,
  /health(-| )data/i,
  /health mapping/i,
]

const CATEGORIES = [
  { name: 'medical', terms: BANNED_MEDICAL, severity: 'error' },
  { name: 'monitoring', terms: BANNED_MONITORING, severity: 'error' },
  { name: 'reassurance', terms: BANNED_REASSURANCE, severity: 'error' },
  { name: 'review', terms: REVIEW_TERMS, severity: 'warn' },
]

/** Escape a term for use inside a word-boundary regex. */
function pattern(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // `\b` on both ends so `treat` does not match `treatment` twice or `retreat`
  // at all, and multi-word terms still anchor on their outer edges.
  return new RegExp(`\\b${escaped}\\b`, 'i')
}

const COMPILED = CATEGORIES.map((c) => ({
  ...c,
  patterns: c.terms.map((t) => ({ term: t, re: pattern(t) })),
}))

/**
 * Lint one string.
 *
 * @param {string} text
 * @returns {{term: string, category: string, severity: string}[]}
 */
export function lintClaims(text) {
  if (typeof text !== 'string' || !text.trim()) return []
  // A string that is entirely an allowed proper noun is exempt before any term
  // matching, so `Healthy-Total-Body-CTs` cannot be split into a banned word.
  let scan = text
  for (const re of ALLOWED_CONTEXTS) scan = scan.replace(new RegExp(re, 'gi'), ' ')

  const out = []
  for (const c of COMPILED) {
    for (const { term, re } of c.patterns) {
      if (re.test(scan)) out.push({ term, category: c.name, severity: c.severity })
    }
  }
  return out
}
