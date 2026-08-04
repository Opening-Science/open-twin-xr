# Report 03 — What open human anatomy geometry actually exists

Dated 29 July 2026. A survey conducted to answer one question: what can an
open-source body viewer lawfully render, and where are the gaps?

---

## Abstract

There is more open human geometry than expected, and it is **unevenly distributed
in a way that maps onto how each dataset was made**. Bone and vasculature are richly
covered; the special senses are barely covered at all; and the single scarcest thing
is not a body part but a *property* — a complete female body.

The survey also found that the framing usually applied to this material is wrong for
a project like this one. The standard question, "is it permissively licensed?",
turns out to be the wrong filter. The filter that matters is **"does a grant exist
at all?"** — and those two questions exclude very different sets.

---

## How to compare sources

Six axes decide whether a dataset is usable here, and only the first is about
licensing:

1. **Does a grant exist?** Not "how permissive" — whether *any* permission was
   given. Silence is the fatal case.
2. **Mesh-native or volume?** A labelmap needs a meshing pipeline (Report 02); a
   mesh set can be imported.
3. **Per-structure identity, or merged groups?** Anonymous merged geometry cannot be
   named, selected or masked.
4. **Ontology terms present?** Names are strings; terms are joinable. See Report 04.
5. **Whose body, and is it stated?** Every atlas is one real donor.
6. **Complete body, or a region?** A partial atlas cannot be fitted from its bounds.

---

## Findings

### 1. The licence framing everyone uses is the wrong one here

The instinct is to prefer permissive licences and treat share-alike as a
complication. For this project that is inverted, and decisions **D7** and **D12b**
record why:

| licence class | actual consequence here |
|---|---|
| CC BY, CC0, public domain | Fine. Attribution and indication of changes. |
| **CC BY-SA** | **Fine.** Share-alike attaches to the adapted asset; this project is open source anyway. Kept as separate files so the obligation does not spread to the CC BY geometry or the MIT code. |
| **CC BY-NC / CC BY-NC-SA** | **Usable**, and the real cost is a labelling duty: the bundle becomes "open source, non-commercial", not Open Definition conformant. Say so; do not badge a release CC BY-SA. |
| **No licence statement** | **Fatal.** No grant exists, and attribution cannot create one. This is stricter than NC, which is the opposite of the intuitive ordering. |
| Signed MTA / proprietary EULA | Not reachable by any decision of ours — a contract with someone else. |

**The trap is the fourth row.** An unstated licence *looks* like the least
restrictive case — nobody said no — and is in fact the most restrictive. The
practical rule this project adopted (**D12b**): import everything, tag provenance
per structure inside the asset, generate the licence record from the shipped file,
and exclude only the no-grant case from anything served.

### 2. Coverage is uneven in a way that tracks provenance

Measured against this project's own assembled atlas rather than guessed:

| body system | open coverage | why |
|---|---|---|
| Skeleton | **excellent** | bone is high-contrast in CT and easy to segment; every corpus has it |
| Vasculature | **excellent** | angiography and contrast studies; Z-Anatomy alone has 208 named FMA-mapped vessels |
| Muscle | good | Z-Anatomy retopologised BodyParts3D; the Denver lower-extremity set adds 76 muscles per side |
| Viscera | good but coarse | segmentable in CT, though low-dose non-contrast blurs boundaries |
| Nervous | patchy | brain well covered as *volume*, poorly as clean mesh; peripheral nerves rare |
| **Special senses** | **very poor** | the eye and inner ear are small, high-detail, and need dedicated imaging |
| Lymphoid | thin | only Z-Anatomy, and outside the `SystemId` contract |

**The special-senses gap is the one worth noting**, because it explains two of the
three organ overlays in this project. It was cheaper to *generate* a schematic eye
from published optical parameters — owning the result outright — than to find one
that could be redistributed. And the only usable ear was a single cadaveric temporal
bone from a surgical-simulation dataset (Report 01).

### 3. The scarcest thing is a complete female body

This is the finding that most changed the project's plan. Of the whole-body atlases:

- **HRA's female donor has no skeleton above the pelvis** — no skull, ribs,
  clavicle, scapula, humerus, radius, ulna, carpals or phalanges. Measured, not
  assumed. On her own she renders as torso-and-legs.
- **BodyParts3D and Z-Anatomy are both TARO** — the same adult Japanese male voxel
  phantom, retopologised. Two atlases, one donor.

So a project offering "both sexes" was, for a while, offering one complete body and
one incomplete one. Closing that gap required going to imaging (Report 02) and taking
a real subject from TCIA — which also produced the only atlas here at a real person's
measured size rather than normalised to a canonical height.

**And borrowing across donors does not work.** Filling her missing skeleton from the
CT atlas was tried and reverted: it renders a floating skull, detached arms, and a
ribcage grossly out of scale with the organs inside it. Two different people in two
different frames — one atlas's pelvis sat at y ≈ 0.02 where the other's was at
y ≈ −1.5. **An incomplete coherent body beats a complete incoherent one**, and the
gap is disclosed in the UI rather than filled with a stranger's bones.

### 4. Rejected on contract, not on licence

Three large, tempting corpora are unreachable, and it is worth recording *why*
so nobody re-proposes them:

- **UK Biobank** and **NAKO** — access agreements under which derived data returns
  to the holder rather than being published onward.
- **New Mexico Decedent Image Database** — ~15,000 whole-body CT scans of both
  sexes, which is exactly what this project wants, and **decisively closed**. Its
  data-use agreement bars the recipient from "create derivative works from" the
  database, which reaches the mesh itself and not merely its redistribution. It
  separately prohibits research that reconstructs a face for public viewing —
  which is close to a description of a body viewer.

That last one is the clearest case in the survey: a dataset can be free of charge,
academically open, and still legally unusable for this purpose. **Read the
agreement, not the price.**

### 5. Complementary rather than competing sources

Two CT corpora look like alternatives and are not:

| | distal limbs | per-rib / per-vertebra identity | extent |
|---|---|---|---|
| TCIA Healthy-Total-Body-CTs | present | **merged** (one Ribcage, one Spine) | true head-to-toe |
| TotalSegmentator dataset (510 F / 716 M) | **absent** — no radius, ulna, carpals, metacarpals, phalanges, patella, tibia, fibula or tarsals | **all 24 ribs and C1–L5 individually** | stops at the knee |

One gives reach with merged labels; the other gives granularity and stops at the
knee. A project wanting both needs both.

### 6. Verified importable, not yet imported

**AnatomyTOOL / Open3Dmodel** (Leiden UMC, CC BY-SA) was checked and **shares this
project's exact coordinate frame** — metres, +Y up, facing +Z. That makes it the
cheapest remaining import: no registration work, only a licence obligation already
carried elsewhere in the bundle.

The **Denver Visible Human lower-extremity dataset** (CC BY 4.0) ships 130 named
structures per side — 76 muscles, 28 bones, 16 cartilages, 8 ligaments, 2 fat — as
separate named STL files, overlap-corrected to a 0.05 mm gap, 87.8 MB for the set.
Same donor lineage as HRA, so it registers by construction.

---

## Limitations of this survey

1. **It is a snapshot, dated.** Licences change — BodyParts3D was relicensed from
   CC BY-SA 2.1 JP to CC BY 4.0 in February 2025, and several upstream pages still
   say share-alike. The stale pages are the easier ones to find.
2. **Coverage was measured against this project's own assembled atlas**, not against
   an independent anatomical checklist. "Poor coverage" means poor *for a body
   viewer at this granularity*.
3. **Licence readings are ours, not legal advice.** Where a reading is contested —
   the BodyParts3D relicence has not been confirmed in writing by DBCLS — the
   register records it as unconfirmed rather than settled.
4. **Simulation-grade sources were surveyed but not assessed for accuracy.**
   Computational phantoms and finite-element body models were catalogued by licence
   and format; whether their geometry is fit for physics was out of scope.

---

## References

- Full survey with per-source detail: [`../GEOMETRY_SOURCES_SURVEY.md`](../GEOMETRY_SOURCES_SURVEY.md)
  — including a reconciliation section correcting its own licence framing.
- Tiered shortlist: [`../INTEGRATION_CANDIDATES.md`](../INTEGRATION_CANDIDATES.md)
- Every source evaluated, with standing: [`../RESOURCES.md`](../RESOURCES.md)
- Could the whole model be CC BY? [`../PERMISSIVE_ANATOMY.md`](../PERMISSIVE_ANATOMY.md)
- `docs/DECISIONS.md` — D2, D7, D7b, D12, D12b
