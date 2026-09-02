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
 *   1. When this was written, branch protection and rulesets both returned 403 —
 *      "Upgrade to GitHub Pro or make this repository public" — so there were NO
 *      required checks and NO required reviews, and a PR was mergeable the moment
 *      it opened. The repository has since gone public and a ruleset now guards
 *      `main`: one approving review, code-owner review and signed commits. None
 *      of that reads CodeRabbit's threads, so fact 2 still stands on its own.
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
 * ⚠️ IT IS DISCIPLINE, NOT ENFORCEMENT. Nothing stops a human pressing Merge past
 * an unresolved thread; the ruleset enforces reviews and signatures, not this.
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
const failuresEarly = []
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
  'number,title,isDraft,mergeable,mergeStateStatus,statusCheckRollup,reviewDecision,headRefName,headRefOid',
])

/**
 * ⚠️ THE STALENESS CHECK, AND THE FIRST RUN OF THIS GATE NEEDED IT.
 *
 * `gh pr view` reports a `statusCheckRollup` without saying which COMMIT it
 * describes, and GitHub's PR object lags a push by a noticeable window. Measured:
 * seconds after pushing `da9df2b`, the remote branch was already at `da9df2b`
 * while the PR still reported head `17438eb`, no CI run existed for the new
 * commit at all, and CodeRabbit had reviewed only the old one. The gate printed
 * "✓ ready to merge" against results for a SUPERSEDED commit — precisely the
 * failure it exists to prevent.
 *
 * So the authority is the branch ref on the server, not the PR object and not the
 * local checkout. Everything below must correspond to that SHA.
 */
const branchRef = gh(['api', `repos/${REPO}/git/ref/heads/${pr.headRefName}`])
const tip = branchRef?.object?.sha
if (!tip) {
  console.error('✗ could not read the remote branch tip')
  process.exit(2)
}
if (tip !== pr.headRefOid) {
  failuresEarly.push(
    `the PR object is STALE — branch is at ${tip.slice(0, 7)} but the PR reports ` +
      `${pr.headRefOid.slice(0, 7)}. GitHub has not caught up with the push yet; ` +
      'every check and review below describes the older commit.',
  )
}

const failures = []
const notes = []
for (const f of failuresEarly) failures.push(f)

console.log(`PR #${pr.number} — ${pr.title}`)
console.log(`branch tip ${tip.slice(0, 7)}\n`)

// --- 1. draft -----------------------------------------------------------------
if (pr.isDraft) failures.push('it is still a draft')

// --- 2. every check green -----------------------------------------------------
const checks = (pr.statusCheckRollup ?? []).filter((c) => c.__typename !== 'StatusContext' || c.state)
const state = (c) => c.conclusion || c.state || 'PENDING'
const bad = checks.filter((c) => !['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(state(c)))
// A green check that ran on an older commit says nothing about this one.
const runs = gh(['run', 'list', '--branch', pr.headRefName, '--limit', '20', '--json', 'headSha,status,conclusion'])
if (runs.length && !runs.some((r) => r.headSha === tip)) {
  failures.push(`no CI run exists for the current commit ${tip.slice(0, 7)} — the green build below ran on an earlier one`)
}
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
  notes.push(
    `CodeRabbit reviewed ${rabbit.length}x, last state ${last.state} on ` +
      `${String(last.commit_id).slice(0, 7)}`,
  )
  /**
   * ⚠️ A review of an EARLIER commit is not a review of this one. Same reasoning
   * as the branch-tip check above: the run that exposed this had CodeRabbit's
   * only review pointing at the superseded commit while the gate passed.
   */
  if (!rabbit.some((r) => r.commit_id === tip)) {
    failures.push(
      `CodeRabbit has not reviewed the current commit ${tip.slice(0, 7)} — its latest ` +
        `review is of ${String(last.commit_id).slice(0, 7)}`,
    )
  }
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
