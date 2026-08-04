# Report 05 — The licence position, and what may actually be published

Dated 29 July 2026. The report a reviewer, funder or lawyer is most likely to ask
for, and the one whose conclusions are enforced in code rather than asserted.

---

## Abstract

This project assembles ten anatomy assets from seven rights holders under six
different licences, plus one asset it owns outright. The resulting bundle is **open
source, non-commercial** — not Open Definition conformant — and that is a
consequence of the material rather than a choice.

The report sets out the position asset by asset, the four outstanding questions and
who must answer them, and the two mechanisms that make the position *checkable*
rather than a matter of belief.

Two conclusions are worth stating up front because they are counter-intuitive:

1. **An unstated licence is stricter than a non-commercial one.** No grant exists,
   and attribution cannot manufacture one.
2. **A login wall does not change what may lawfully be sent.** Serving to
   authenticated users is distribution.

---

## Method: the position is generated, not maintained

Two mechanisms, because a hand-maintained licence table in this repository went
stale twice without anyone noticing.

**`licences.json` is the register.** It holds what a machine cannot derive from a
file: why a source was chosen, what is unverified, what is closed by contract. Every
asset on disk needs an entry whether or not it renders.

**`docs/LICENCE_LOG.md` is generated from the shipped GLBs** by
`npm run check:licences`. It reads the per-structure component tags that
`build-z-anatomy.mjs` writes *into the asset*, so the structure counts in the log
cannot drift from what actually ships. `verify` fields in the register become
checkboxes on a pre-publication action list.

The consequence worth noting: **third-party provenance travels inside the geometry**,
not beside it. Each structure that came from someone else carries a `component` tag,
so the log counts real structures rather than trusting a note.

### Why nothing is excluded on licence grounds (D12b)

An earlier approach (**D12**) used licence tiers to gate what was imported. It was
replaced. The current rule: **import everything each atlas offers, tag provenance
per structure, render every required attribution, and keep the position knowable.**
Exclusion is reserved for the single case where no grant exists at all.

The reason is practical. Cutting non-commercial components out of an atlas produced
holes in the anatomy and a licence story that was harder to verify, not easier —
because what had been removed was recorded nowhere. Importing and tagging means the
asset can answer the question itself.

---

## Findings: the position asset by asset

Assessed for the build now deployed — Z-Anatomy is the `--publishable` build, behind
a login wall.

| asset | licence | publishable | condition |
|---|---|---|---|
| BodyParts3D | CC BY 4.0 | ✅ | attribution + indicate changes |
| Z-Anatomy — own geometry (3,606 structures) | CC BY-SA 4.0 | ✅ | **share-alike attaches to this asset** |
| ↳ Dundee inner ear (4) | CC BY-NC-SA 4.0 | ⚠️ non-commercial | attribution + share-alike |
| ↳ lissiecowley kidney (4) | CC BY-NC 4.0 | ⚠️ non-commercial | attribution |
| ↳ UW white matter (**0 — excluded**) | **none stated** | ⛔ | absent by `--publishable` |
| Z-Anatomy regions (257) | CC BY-SA 4.0 | ✅ | cleanest asset here — no third-party components |
| HuBMAP HRA, female + male | CC BY 4.0 | ✅ | derived from NLM Visible Human, public domain since 2019 |
| CT (female), TCIA subject 003 | CC BY 4.0 | ✅ | attribution + DOI |
| CT atlas (MOOSE) | **unresolved** | ⛔ | source scan never recorded |
| Beating heart (biv-me) | Apache-2.0 at repo root | ⛔ | subject cohort unidentified |
| Schematic eye | none required — generated here | ✅ | must be described as schematic optics |
| Ear (OpenEar) | CC BY 4.0 | ✅ | attribution |
| Inter typeface | SIL OFL 1.1 | ✅ | self-hosted, complete font |
| Application code | MIT | ✅ | — |

### The bundle's position

> **Open source, non-commercial. Not Open Definition conformant.**

Because CC BY-NC and CC BY-NC-SA components are present, the assembled result cannot
be offered under terms permitting commercial reuse. **State this plainly wherever the
work is described.** Do not badge a release "CC BY-SA" and leave it — that would be
accurate about the largest component and wrong about the whole.

Share-alike attaches to the Z-Anatomy-derived asset specifically. **This is why each
atlas ships as its own file and is never merged into one GLB** — merging would spread
the obligation to the CC BY geometry and, arguably, toward the MIT code.

### The one exclusion, and why a login wall does not help

The University of Washington "Brainder" white-matter component — 3 structures — has
**no licence statement**. Silence grants nothing. Attribution satisfies a licence's
conditions; it cannot create permission that was never given.

`npm run build:z-anatomy -- --publishable` drops exactly that component and keeps the
non-commercial ones, because those need attribution rather than removal. The deployed
build's roll-call reads:

```
0 structures  NONE STATED   Brainder / White matter (University of Washington)
                            <- excluded by --publishable
```

**A login wall was considered and does not change this.** Limiting *who* sees a work
does not alter what may lawfully be sent to them; serving to authenticated users is
still distribution. So the exclusion is done at build time, not at the door.

---

## The four open questions, and who answers them

| # | question | who | consequence |
|---|---|---|---|
| 1 | Which cohort is the biv-me `patient1` demo case? | biv-me authors — Joshua R. Dillon (Auckland), Charlène Mauger (KCL) | **Blocks any public release of the heart** |
| 2 | Permission for the UW white matter | University of Washington | Nothing today — it is excluded. Needed only to restore it |
| 3 | Do the Z-Anatomy ossicles belong to the Dundee component? | Z-Anatomy upstream `License.txt` | Attribution accuracy |
| 4 | Written confirmation of the BodyParts3D relicence | DBCLS | Removes reliance on an unconfirmed reading |

**Question 1 is the live one.** The FIMH 2025 paper's acknowledgements thank "the
study participants of the **UK Biobank** and **CARDIOHANCE**", and its abstract says
the pipeline was tested on data from two centres — so UK Biobank involvement is
established, not inferred. The repository carries no data statement and bundles input
DICOMs for a case named `patient1`. If that case is UK Biobank, redistribution of
derived geometry is almost certainly barred by their access terms, and **Apache-2.0
at a repo root cannot override the authors' own obligations to a data provider.** A
ready-to-send email is in `docs/PLAN_INTEGRATION.md` under B6; the fallback is the
Sunnybrook CC0 fitted models.

**Question 4 has no third party at all.** The CT atlas derives from a scan nobody
recorded. There is nobody to ask; it is a record that was never kept, and the fix is
either to establish the provenance or to regenerate the asset from a scan with a
known licence.

### An asset with no upstream rights holder

The schematic eye is worth its own note as a pattern. It is **generated from published
radii, conic constants, thicknesses and refractive indices** — measurements, which are
not copyrightable expression. The mesh is this project's outright, with no licence, no
attribution chain and no provenance question. Crediting Schwiegerling for the
parameters is scholarship, not a licence condition.

**Reach for this whenever a structure is fully specified in the literature.** It is
the only category of asset here that carries no rights risk whatsoever. The generator
is validated by reproducing Le Grand's published 59.94 D system power exactly.

---

## Limitations

1. **These are our readings, not legal advice.** Where a reading is contested it is
   recorded as unconfirmed rather than settled — the BodyParts3D relicence being the
   clearest case.
2. **The register is only as good as what was recorded at build time.** `ct-atlas-f`
   is the standing proof: the pipeline ran, the asset is fine, and the one fact that
   mattered was not written down. **Record the source in the asset, where
   `check:licences` will read it back.**
3. **`check:licences` walks the directory, not the register**, so it catches an
   unregistered file on disk — but it cannot detect a *wrong* entry. A confidently
   incorrect `licence` field passes every gate.
4. **Component tagging is by name pattern.** The Dundee inner-ear tag was over-broad
   until the pattern was narrowed to exclude the middle ear, dropping it from 8
   structures to 4. A pattern that drifts silently stops being accurate, which is why
   the generator reports a count of **0** for a component rather than omitting it —
   zero means "the pattern matched nothing", and that needs investigating.
5. **Publishability here means rights, not readiness.** OpenEar is fully publishable
   and is still one cadaveric specimen rather than a population; the schematic eye is
   publishable and is still not an anatomical eye. Rights and fitness for purpose are
   different columns.

---

## References

- Register: [`../../licences.json`](../../licences.json)
- Generated record and pre-publication action list:
  [`../LICENCE_LOG.md`](../LICENCE_LOG.md) — `npm run check:licences`
- Required credit text: [`../../ASSETS_LICENSE.md`](../../ASSETS_LICENSE.md)
- Paid alternatives considered and rejected:
  [`../COMMERCIAL_LICENSES.md`](../COMMERCIAL_LICENSES.md)
- Deployment gate: [`../DEPLOY.md`](../DEPLOY.md)
- `docs/DECISIONS.md` — D2, D7, D12, D12b
