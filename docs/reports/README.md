# Technical reports

Six reports on the parts of this project where the reasoning matters more than the
result. Each stands alone, states its own method, and ends with its limitations.

They were written on **29 July 2026** from work done that month. Unlike the two
generated documents, these are **dated snapshots**: they record what was measured
and concluded at the time. Where a report and a generated document disagree, the
generated one wins — it is read from the shipped assets.

| # | report | answers |
|---|---|---|
| 01 | [Does photographic tissue colour survive this pipeline?](01-photographic-tissue-colour.md) | **Decision D4.** Yes — 71.5 % of the ear's surface by area carries colour sampled from the specimen's own micro-slicing photographs, and the rest is grey that is counted rather than invented. |
| 02 | [Generating anatomy from imaging: the CT-to-mesh pipeline](02-ct-to-mesh-pipeline.md) | How two of the seven atlases were built, where the time actually goes, and the licence trap that has no technical fix. |
| 03 | [What open human anatomy geometry actually exists](03-open-anatomy-geometry.md) | What can lawfully be rendered, where the gaps are, and why "is it permissive?" is the wrong filter. |
| 04 | [Structures are addressed by name, and what that costs](04-ontology-identity.md) | The next milestone. 1,408 ontology terms exist in this repo and the two richest atlases carry none of them. |
| 05 | [The licence position, and what may actually be published](05-licence-and-publishability.md) | Asset by asset, the four open questions, and who must answer each. |
| 06 | [Could this be published on an app store, and under what licence?](06-app-store-publication.md) | **No, not as it stands** — and the blocker is the anatomy's licences, not any store rule. Every CC asset here forbids the DRM an app store applies. What would strictly have to change, per store. |

## Three findings that generalise past this project

**A plausible explanation that fits the observation is not a diagnosis.** The UV
unwrap failed on eleven of twelve structures and the recorded hypothesis — a shared
texture atlas — explained the evidence perfectly. It was wrong. The cause was
units, and the wrong theory would have sent the next person to rewrite the unwrap
stage. Report 01, §2.

**A silent filter will eventually delete something real.** A stray-component
heuristic removed an entire humerus, because the corpus merges left and right and a
paired bone's halves are an arm span apart. It was recoverable only because every
drop was printed. Report 02, §3.

**An unstated licence is stricter than a non-commercial one.** This inverts the
intuitive ordering and is the single most important thing in Report 05. Silence
grants nothing, and attribution cannot create a grant.
