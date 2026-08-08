# OpenTwin research and planning set

Prepared 7 August 2026 for the Open Science Foundation.

Read in this order.

| File | What it is |
|---|---|
| `UPSTREAM_FIRST.md` | **Start here.** Which of the planned work belongs in `open-twin-xr` itself rather than in a fork, in what order, and the conflict already on the board. |
| `FORK_PLAN.md` | 23 numbered Claude-Code-executable tasks for a fork adding an actionable-health-proposals layer. Section 7 holds eleven open questions that need a human decision. |
| `CLAUDE.fork.md` | Drop-in `CLAUDE.md` for that fork. Rename it when you use it. |
| `RESEARCH.md` | Landscape and licensing evidence base: parametric body models, anatomical data, ontologies, product and UX, WebXR, accessibility, positioning. |
| `MODEL_INTEGRATION.md` | Instructions for adding open parametric body models (ANNY, MHR, MPFB2) to the viewer's asset pipeline. |
| `REFERENCES.md` | Annotated bibliography of the whole space, including a deep dive on ICD-10 to anatomical structure mapping. |

## Verification status, so you know what to trust

These documents went through an adversarial review: ten independent skeptics, then five
verifiers on the repairs. Around 130 findings were raised and 53 confirmed ones were fixed,
including a fabricated quotation, a licence error that ran through one whole document, and
three claims that were wrong about the repository's own assets.

Confidence is not uniform, and the documents say so where it is not:

- Figures marked **[M]** were measured or computed directly, not read from documentation.
- Items marked **[?]** could not be verified and should be checked before they carry weight.
- `RESEARCH.md` section 11 and `REFERENCES.md` section 12 are uncertainty registers. Read them.
- `MODEL_INTEGRATION.md` and `REFERENCES.md` had one consistency pass, not the full review the
  other three received. Treat their unmarked claims as less settled.

Nothing here is legal advice. `INTENDED_PURPOSE.md`, described in `FORK_PLAN.md` task T2,
needs a lawyer before any public release.
