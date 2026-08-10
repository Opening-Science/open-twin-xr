#!/usr/bin/env node
/**
 * Is this PR safe to merge? Exits 0 only if every gate is satisfied.
 *
 *   npm run pr:gate            the current branch's PR
 *   npm run pr:gate -- 12      a specific PR
 *   npm run pr:gate -- 12 --merge   ...and squash-merge it if so
 *
 * ⚠️ WHY THIS EXISTS RATHER THAN GITHUB AUTO-MERGE.
 *
 * Two facts, both measured rather than assumed:
 *
 *   1. Branch protection and rulesets both return 403 on this repository —
 *      "Upgrade to GitHub Pro or make this repository public". So there are NO
 *      required checks and NO required reviews. Native auto-merge has nothing to
 *      wait for; a PR is mergeable the moment it opens.
 *
 *   2. CodeRabbit's status check reports `pass` — "Review completed" — even when
 *      it has findings. On PR #11 it left THIRTEEN inline comments, including a
 *      real anatomical error and a documentation rule this repo had just written
 *      and then broken, and the check was green throughout. Its review state was
 *      COMMENTED, never CHANGES_REQUESTED.
 *
 * Together those mean native auto-merge would merge past review, which is the
 * opposite of what it was asked for. This gate waits for the review to EXIST,
 * then refuses while any of its threads is unresolved.
 *
 * ⚠️ IT IS DISCIPLINE, NOT ENFORCEMENT. Nothing stops a human pressing Merge.
 * Making the repository public, or moving to a plan with rulesets, is what would
 * turn this into a rule GitHub applies.
 */
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const MERGE = args.includes('--merge')
const prArg = args.find((a) => /^\d+$/.test(a))

const gh = (jsonArgs) => {
  try {
    return JSON.parse(execFileSync('gh', jsonArgs, { encoding: 'utf8' }))
  } catch (e) {
    console.error(`✗ gh ${jsonArgs.join(' ')} failed: ${e.message.split('\n')[0]}`)
    process.exit(2)
  }
}

const REPO = 'Opening-Science/open-twin-xr'
let number = prArg
if (!number) {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  const prs = gh(['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'])
  if (!prs.length) {
    console.error(`✗ no open PR for branch ${branch}`)
    process.exit(2)
  }
  number = String(prs[0].number)
}

const pr = gh([
  'pr',
  'view',
  number,
  '--json',
  'number,title,isDraft,mergeable,mergeStateStatus,statusCheckRollup,reviewDecision',
])

const failures = []
const notes = []

console.log(`PR #${pr.number} — ${pr.title}\n`)

// --- 1. draft -----------------------------------------------------------------
if (pr.isDraft) failures.push('it is still a draft')

// --- 2. every check green -----------------------------------------------------
const checks = (pr.statusCheckRollup ?? []).filter((c) => c.__typename !== 'StatusContext' || c.state)
const state = (c) => c.conclusion || c.state || 'PENDING'
const bad = checks.filter((c) => !['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(state(c)))
for (const c of checks) console.log(`  ${state(c).padEnd(9)} ${c.name || c.context}`)
if (!checks.length) failures.push('no status checks reported yet')
for (const c of bad) {
  const s = state(c)
  failures.push(
    s === 'PENDING' || s === 'IN_PROGRESS' || s === 'QUEUED'
      ? `check "${c.name || c.context}" is still running`
      : `check "${c.name || c.context}" is ${s}`,
  )
}

// --- 3. CodeRabbit must have actually reviewed --------------------------------
const reviews = gh(['api', `repos/${REPO}/pulls/${number}/reviews`])
const rabbit = reviews.filter((r) => r.user?.login === 'coderabbitai[bot]')
if (!rabbit.length) {
  failures.push('CodeRabbit has not reviewed yet — its check going green is not the same thing')
} else {
  const last = rabbit[rabbit.length - 1]
  notes.push(`CodeRabbit reviewed ${rabbit.length}x, last state ${last.state}`)
  if (last.state === 'CHANGES_REQUESTED') {
    failures.push('CodeRabbit requested changes')
  }
}

/**
 * --- 4. no unresolved CodeRabbit threads --------------------------------------
 *
 * ⚠️ THIS IS THE GATE THAT DOES THE WORK, because of fact 2 above. A COMMENTED
 * review with thirteen open threads is the normal case, not the exception, and
 * it is exactly what a check-based gate waves through.
 *
 * "Addressed" means the thread is RESOLVED on GitHub. Replying is not enough —
 * the point is a deliberate decision per finding, whether that is a fix or a
 * stated reason for declining.
 */
const threads = gh([
  'api',
  'graphql',
  '-f',
  `query=query { repository(owner: "Opening-Science", name: "open-twin-xr") {
      pullRequest(number: ${number}) {
        reviewThreads(first: 100) {
          nodes { isResolved isOutdated comments(first: 1) { nodes { author { login } path } } }
        } } } }`,
])
const nodes = threads?.data?.repository?.pullRequest?.reviewThreads?.nodes ?? []
const rabbitThreads = nodes.filter(
  (t) => t.comments?.nodes?.[0]?.author?.login === 'coderabbitai[bot]',
)
const open = rabbitThreads.filter((t) => !t.isResolved && !t.isOutdated)
notes.push(`CodeRabbit threads: ${rabbitThreads.length} total, ${open.length} unresolved`)
if (open.length) {
  failures.push(`${open.length} unresolved CodeRabbit thread(s)`)
  for (const t of open.slice(0, 10)) {
    console.log(`    unresolved: ${t.comments.nodes[0].path ?? '(file-level)'}`)
  }
}

// --- verdict ------------------------------------------------------------------
console.log('')
for (const n of notes) console.log(`  · ${n}`)
console.log('')

if (failures.length) {
  console.error(`✗ NOT ready to merge — ${failures.length} blocker(s):`)
  for (const f of failures) console.error(`   ${f}`)
  console.error(
    '\n  Resolve each CodeRabbit thread deliberately: fix it, or reply with why it\n' +
      '  does not apply and resolve it. An unread thread is the failure mode this\n' +
      '  gate exists for.',
  )
  process.exit(1)
}

console.log('✓ ready to merge: checks green, CodeRabbit reviewed, no unresolved threads')
if (MERGE) {
  console.log(`\nmerging #${number} …`)
  execFileSync('gh', ['pr', 'merge', number, '--squash', '--delete-branch'], { stdio: 'inherit' })
}
