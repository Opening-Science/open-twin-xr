# External research set — INPUT DOCUMENTS, NOT PLANS FOR THIS REPOSITORY

Prepared 7 August 2026 for the Open Science Foundation and imported here on
8 August 2026, unedited, because work in this repository now cites them.

> ## ⚠️ Read this before treating anything in here as a decision
>
> **These are external inputs. They are not this repository's plans, and two of
> them describe a product this repository has deliberately decided not to be.**
>
> This repo's live plans are `docs/PLAN_NEXT.md` and `docs/PLAN_INTEGRATION.md`;
> its phases are `docs/ROADMAP.md`; its decisions are `docs/DECISIONS.md`.
> **Where any document in this folder disagrees with those, those win.**
>
> They are kept because they are the provenance for real work — `D16` and
> `scripts/anny/bake.py` both cite `MODEL_INTEGRATION.md` — and deleting the
> source of a decision makes the decision unauditable.

| File | What it is | Status here |
|---|---|---|
| `UPSTREAM_FIRST.md` | Which of the planned work belongs in this repository rather than in a fork, and in what order | **Largely implemented, 8 August 2026.** See below |
| `MODEL_INTEGRATION.md` | Adding open parametric body models (ANNY, MHR, MPFB2) to the asset pipeline | **M1–M4 implemented** as D16. M5/M6 not attempted — both need Blender and a human |
| `RESEARCH.md` | Landscape and licensing evidence base | Reference only |
| `REFERENCES.md` | Annotated bibliography, incl. ICD-10 → anatomy mapping | Reference only |
| `FORK_PLAN.md` | 23 tasks for a fork adding actionable **health proposals** | ⚠️ **OUT OF SCOPE HERE.** See below |
| `CLAUDE.fork.md` | A drop-in `CLAUDE.md` for that fork | ⚠️ **OUT OF SCOPE HERE.** Not this repo's brief |
| `00-SOURCE-README.md` | The set's own original index | Superseded by this file |

## ⚠️ `FORK_PLAN.md` and `CLAUDE.fork.md` describe a different product

They specify an interpretation layer: a rule engine, an evidence corpus, a model
call, and rendered health proposals. **D8 moved health interpretation out of this
repository** and `CLAUDE.md` opens by saying so. Nothing in those two files should
be built here. They are included so the upstream/downstream split in
`UPSTREAM_FIRST.md` can be checked against what it was splitting.

Note also that `FORK_PLAN.md` §7 records eleven open questions needing a human
decision — including whether the interpretation layer should be built at all, and
whether a fork is the right vehicle. Those are unanswered.

## What was implemented from `UPSTREAM_FIRST.md`, and what it got wrong

Implemented on 8 August 2026: the accessibility pass (T18), the claim linter over
static copy (T5, adapted — this repo needed a lint over its own UI strings, not a
proposal lexicon), publishing `selectedStructure` (T8), structure identity (T7),
per-structure tinting and an anchored in-scene label (T16/T15), the XR fixes and
2D→session state carry-over (T17), and the ANNY skin envelope (M1–M4).

**Deliberately not done:** T6, the metrics colour ramp. `UPSTREAM_FIRST.md` §3 is
right that replacing red-amber-green is a regulatory judgement rather than a
rendering fix, and says to raise it as an issue rather than change it. It remains
@etzm's call, and `docs/DECISIONS.md` D15 already records the open question.

**Three claims in the set were wrong, and all three were caught by measuring:**

1. `MODEL_INTEGRATION.md` §2's ANNY preset table has **`gender` inverted** — it
   runs male (0) to female (1), so its `pregnant` preset is a male body — and
   puts the adults at `age: 0.5`, which is an **adolescent**; the adult stop is
   0.75. Evidence in `scripts/anny/bake.py`.
2. `UPSTREAM_FIRST.md` §2.1 and `FORK_PLAN.md` §4 both say ontology terms are
   what would let the ear overlay mask one side. **They are not** — none of the
   eight ear structures carries an `ontologyid`. `side` does. See D16.
3. The set correctly notes `docs/ONTOLOGY_MAP.md` was stale, but describes
   BodyParts3D as needing pipeline work to carry structure identity. **It does
   not** — `scripts/build-bodyparts3d.mjs` already writes a structure table and
   all 1,838 FMA ids; the shipped asset merely predates the script.

The set's own `00-SOURCE-README.md` says `MODEL_INTEGRATION.md` and
`REFERENCES.md` received one consistency pass rather than the full adversarial
review, and that unmarked claims in them are less settled. That warning was
accurate: two of the three errors above are in `MODEL_INTEGRATION.md`.
