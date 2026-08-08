#!/usr/bin/env node
/**
 * Scan this repository's own user-facing copy for health-claim creep.
 *
 *   npm run lint:claims
 *
 * WHY THIS RUNS IN CI AND THE OTHER `check:*` SCRIPTS DO NOT
 * ----------------------------------------------------------
 * The asset gates (`check:winding`, `check:structures`, `check:licences`) read
 * shipped GLBs, and no asset is committed here, so CI has nothing to read. This
 * one reads SOURCE, which CI always has. It is the only gate in this repository
 * that can run there, and it guards the thing that is easiest to lose by
 * accident: the claim surface.
 *
 * ⚠️ WHAT IS SCANNED, AND WHY IT IS NOT EVERYTHING. Only string and template
 * literals in `src/ui/**` and `src/scene/**`, plus `index.html`. That is
 * approximately "what a viewer can read". Comments are deliberately EXCLUDED —
 * this file is full of the word "disease" and so is every decision record, and a
 * lint that cannot tell an explanation from a claim would have to be switched
 * off. The trade is real: a claim smuggled in through a comment is not caught,
 * but a comment is not shown to anyone.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { lintClaims } from './claims/lexicon.mjs'

const ROOTS = ['src/ui', 'src/scene', 'src/App.tsx', 'index.html']
const EXT = /\.(tsx?|html)$/

function walk(p, out = []) {
  const s = statSync(p, { throwIfNoEntry: false })
  if (!s) return out
  if (s.isFile()) {
    if (EXT.test(p)) out.push(p)
    return out
  }
  for (const name of readdirSync(p)) walk(join(p, name), out)
  return out
}

/**
 * Pull out the string literals, with their line numbers.
 *
 * A regex rather than a parser, and the limitation is worth stating: it cannot
 * tell a string inside a comment from a string in code, so comments are stripped
 * first. Block comments go first, then line comments, then JSX comment braces.
 * Getting this wrong in the safe direction (stripping too much) costs coverage;
 * getting it wrong the other way costs credibility, so it errs toward stripping.
 */
/**
 * Is this a Tailwind class list rather than a sentence?
 *
 * ⚠️ THE FIRST VERSION OF THIS RULE SILENTLY DISABLED THE WHOLE LINT, and it is
 * worth recording because the failure was invisible. It skipped anything
 * matching `^[a-z0-9-]+(\s+[a-z0-9:[\]/.-]+){3,}$` — intending "class soup", but
 * actually matching ANY lowercase sentence of five or more words. So
 * "use this to diagnose disease" was skipped, and the scanner reported a clean
 * repository while catching nothing. It was caught by planting a violation and
 * watching the lint pass, which is the only way this kind of bug shows up.
 *
 * The rule now keys on what actually distinguishes the two: utility classes are
 * dense in `-`, `:` and `/` and contain no sentence punctuation, where prose is
 * the reverse. A sentence has to survive this, so the test is deliberately
 * conservative — it needs a MAJORITY of tokens to look like utilities.
 */
function isClassSoup(text) {
  const tokens = text.trim().split(/\s+/)
  if (tokens.length < 3) return false
  // Any sentence punctuation and it is prose, whatever else it contains.
  if (/[.,;!?—]/.test(text)) return false
  const utility = tokens.filter((t) => /[-:/]/.test(t) || /^\d/.test(t)).length
  return utility / tokens.length > 0.5
}

function literals(src) {
  const withoutComments = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' ')

  const out = []
  const lines = withoutComments.split('\n')
  lines.forEach((line, i) => {
    // Single- and double-quoted strings, plus template literals without
    // interpolation (an interpolated chunk is scanned as its literal parts).
    const re = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g
    let m
    while ((m = re.exec(line)) !== null) {
      const text = m[2]
      // Skip anything that is obviously not prose: import paths, class-name
      // soups, hex colours, urls. They generate noise and carry no claim.
      if (!/[a-z]{3}/i.test(text)) continue
      if (/^[./@#]/.test(text)) continue
      if (/^https?:/.test(text)) continue
      if (isClassSoup(text)) continue
      out.push({ line: i + 1, text })
    }
  })
  return out
}

const files = ROOTS.flatMap((r) => walk(r))
let errors = 0
let warnings = 0

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  for (const { line, text } of literals(src)) {
    for (const v of lintClaims(text)) {
      const where = `${relative(process.cwd(), file)}:${line}`
      const label = v.severity === 'error' ? 'ERROR' : 'warn '
      if (v.severity === 'error') errors++
      else warnings++
      console.log(`${label} ${where}  [${v.category}] "${v.term}"`)
      console.log(`        ${text.slice(0, 120)}`)
    }
  }
}

console.log(
  `\nscanned ${files.length} files — ${errors} error(s), ${warnings} warning(s)`,
)

if (errors > 0) {
  console.log(
    '\nA user-facing string is making a health claim this repository does not support.\n' +
      'Either reword it, or — if it is genuinely correct — add it to ALLOWED_CONTEXTS in\n' +
      'scripts/claims/lexicon.mjs with a comment saying why.',
  )
  process.exit(1)
}
