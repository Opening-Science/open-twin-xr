# Asset licenses

The **source code** of this repository is MIT (see `LICENSE`). The **3D anatomy
assets** are a separate work under a different license. Read this before
shipping.

> ## ⚠️ THIS FILE IS PROSE. `licences.json` IS THE AUTHORITY.
>
> Updated 28 July 2026. Everything here is context and obligation text; the
> machine-readable register of what is actually on disk, at what tier, is
> **`/licences.json`**, and the gate is:
>
> ```bash
> npm run check:licences             # what tier is this build?
> npm run check:licences -- --public # assert it is publishable
> ```
>
> **Per D12 this is a private research build, so tier 2 (non-commercial) assets
> are permitted on disk and blocked at publish instead of at import.** If you are
> preparing anything public, the `--public` gate is the check that matters, not
> this document — a table in a document is what went stale here twice before.
>
> ## Current state, 27 July 2026
>
> The sections below are a layered record of superseded decisions. **What the
> app actually ships today:**
>
> | Atlas | Licence | Used for |
> |---|---|---|
> | **BodyParts3D** (DBCLS) | **CC BY 4.0** | every system except musculoskeletal |
> | **Z-Anatomy** | **CC BY-SA 4.0** | musculoskeletal (bone, muscle, joints) |
> | HuBMAP HRA | CC BY 4.0 | standalone comparison option only |
>
> **Z-Anatomy is shipped, not a fallback.** Its share-alike obligations are live.
> Each atlas stays a **separate GLB**, which is what keeps the share-alike off
> the CC BY 4.0 geometry and off the MIT code — do not merge them.
>
> **Only the skeletal, muscular and joint files are taken.** Z-Anatomy's own
> `Resources/Models/License.txt` contradicts its blanket CC BY-SA badge: the
> inner ear is CC BY-NC-SA and the kidney CC BY-NC. Non-commercial is not Open
> Definition conformant, so the visceral and ear models are excluded and viscera
> stay on BodyParts3D. See D11.
>
> > ⚠️ **Corrected 28 July 2026 (D12).** That mitigation was read for a long time
> > as though it were a licence boundary around three files. It is not.
> > Z-Anatomy ships **seven** per-system FBX files and the NC components are
> > **only** the kidney (Visceral) and the inner ear. **Cardiovascular, Nervous
> > and Lymphoid are plain CC BY-SA 4.0 — Tier 1, never blocked, simply
> > unbuilt.** Only Visceral is genuinely tier 2, and under D12 it may be built
> > in this private phase provided it goes to a separately named asset that the
> > publish gate can see.
>
> **The "CC BY 4.0 end to end" goal below no longer applies.** It was pursued to
> keep commercial and dual-licensing options open; **D7 rejects that criterion**
> — the project is bound to openness, not commercial reusability, and CC BY-SA
> is Open Definition conformant. Where a passage below prefers a permissive
> source *for commercial reasons*, that reasoning is dead; where it prefers one
> on coverage or quality grounds, it still stands.

## Primary: HuBMAP Human Reference Atlas (HRA)

- **License: CC BY 4.0** (Creative Commons Attribution 4.0 International).
- Source: the HuBMAP CCF 3D Reference Object Library,
  <https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html>.

### What CC BY 4.0 requires

1. **Attribution.** Credit the source wherever the model or a rendering of it is
   distributed — in the app footer and in `public/models/NOTICE.txt`. Use the
   citation the release itself specifies; **confirm the exact required wording
   when you download it**, since it was not verifiable from the portal (which is
   client-rendered). Absent a more specific instruction, credit the HuBMAP
   Consortium's Human Reference Atlas and cite:

   > 3D anatomical structures from the HuBMAP Human Reference Atlas (HRA),
   > CC BY 4.0. HuBMAP CCF 3D Reference Object Library —
   > https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html

   Supporting publications: *HuBMAP 3D Human Reference Atlas construction and
   usage* (Nature Methods, 2024) and *Cell Type Populations for 3D Anatomical
   Structures of the Human Reference Atlas* (Scientific Data).

2. **Indicate changes.** If you decimate, retopologise, split or recolour the
   meshes, say so alongside the credit. This is a CC BY requirement and is
   easily satisfied by a line in `NOTICE.txt`.

3. **No share-alike.** A modified HRA-derived model does **not** have to be
   released under CC BY 4.0, and nothing propagates to the application code.
   This is the practical reason HRA is preferred over Z-Anatomy.

4. **Separation still applies.** Keep geometry as a distinct asset in
   `public/models/`. Never bake model geometry into a source file.

### Cost

**No license fee.** CC BY 4.0 is free for commercial and non-commercial use. The
only obligations are attribution and indicating changes.

## SUPERSEDED — the project no longer needs share-alike at all

> **Corrected 27 July 2026.** The section below accepted CC-BY-SA because
> Z-Anatomy appeared to be the only source for the ribcage, upper limbs and
> musculature HRA lacks. That premise was stale: **DBCLS relicensed BodyParts3D
> — the upstream Z-Anatomy derives from — to CC BY 4.0 on 2025-02-27**, and it
> includes the full skeleton, 411 muscle meshes and the diaphragm. Verified
> against <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html> and the
> README inside the LATEST data distribution.
>
> **The project can therefore be CC BY 4.0 end to end.** Take BodyParts3D
> direct from DBCLS: Z-Anatomy's own retopology is separately CC-BY-SA by its
> authors' choice, so only the upstream is permissive. See
> `docs/PERMISSIVE_ANATOMY.md`.
>
> The policy below is retained because Z-Anatomy remains registered as the
> higher-mesh-quality alternative — raw BodyParts3D geometry has holes and
> non-manifold faces — so if you ever choose it, these obligations apply.

## Retained policy, should a share-alike asset be used

**Decided 26 July 2026: CC-BY-SA is acceptable for anatomy assets.** This
project is open source, so copyleft on the model is aligned with its goals
rather than a constraint to engineer around. That removes the main argument
against Z-Anatomy; the remaining reasons to prefer HRA where it suffices are
technical (ontology-native structures, visual coherence, one pipeline).

What accepting share-alike still commits you to, none of it onerous:

- **Distribute the adapted model under CC-BY-SA 4.0.** If you decimate or split
  Z-Anatomy geometry, that modified GLB must be published under the same terms
  with a NOTICE file. Fine when you intend to publish it anyway.
- **Attribute and indicate changes.** Both are already rendered in-app.
- **Add no further restrictions.** You cannot wrap the asset in DRM or ship it
  under terms that forbid redistribution — including in any future closed or
  commercially-licensed bundle. The *asset* must stay redistributable even if a
  product around it is not.
- **Application code stays MIT.** The model is a separate asset, not a
  derivative of the source, so nothing propagates to `src/`.

Note CC BY 4.0 material *may* be remixed into a CC-BY-SA work — the combined
result is then CC-BY-SA. So merging HRA and Z-Anatomy into one GLB is now
permitted. It is still not recommended: separate files keep each credit line
attached to the geometry it describes and let either atlas be replaced
independently.

## Z-Anatomy / BodyParts3D

HRA covers the spine, pelvis and lower limbs but **not** the ribcage, skull,
upper limbs or musculature (`docs/HRA_ASSETS.md`). Z-Anatomy supplies those, and
carries copyleft — which, per the policy above, is acceptable here.

- Z-Anatomy: **CC-BY-SA 4.0** (Attribution-ShareAlike 4.0 International)
- BodyParts3D: **CC-BY-SA 2.1 Japan**, © DBCLS (The Database Center for Life Science)

### What CC-BY-SA 4.0 additionally requires

1. **Attribution.** Include this text wherever the model or a rendering of it is
   distributed:

   > Anatomy model based on "Z-Anatomy - The libre 3D atlas of anatomy" (CC-BY-SA 4.0),
   > derived from "BodyParts3D, The Database Center for Life Science" (CC-BY-SA 2.1 Japan).

2. **ShareAlike.** If you modify the model (retopologise, re-rig, recolour and
   bake, split into systems), the **modified model** must also be distributed
   under CC-BY-SA 4.0. Keep the modified GLB in this repo (or a linked one) under
   that license, with a NOTICE file.

3. **Separation.** ShareAlike attaches to the model asset, not to your source
   code. Application code that merely loads and displays the model is an
   "aggregate" and stays MIT. Do not bake the model geometry into a code file;
   keep it as a distinct asset in `public/models/`.

4. **Do not mix the two sources in one GLB.** If both HRA and Z-Anatomy geometry
   are needed, ship them as **separate GLB files with separate NOTICE entries**,
   so the CC-BY-SA obligation stays scoped to the asset that actually carries it
   rather than contaminating the CC BY 4.0 one.

### Cost

Also **no license fee**. CC-BY-SA is free to use commercially and
non-commercially. The obligations are attribution and share-alike on the model
asset.

## Fonts and other assets

- Inter font: SIL Open Font License 1.1 (free, **self-hosted** from
  `public/fonts/InterVariable.woff2` — see the note in `src/styles.css`; it used to be
  fetched from the Google Fonts CDN, which made every page load a third-party request).

## The Open Science Foundation mark — NOT covered by any licence here

`src/ui/OsfLogo.tsx` carries the Foundation's logo, inlined from the supplied brand
files. **It is a trade mark, and neither the MIT licence on this source nor any of the
Creative Commons grants above apply to it.**

This matters in one specific direction. Everything else in this repository is
documented so that a third party can reuse it under stated conditions; the mark is the
opposite — it identifies the publisher, and an MIT grant on the surrounding code says
nothing whatever about the right to use someone's name and mark. Attribution does not
create that right, in the same way it cannot create a licence for geometry that never
had one.

**A fork that is not an OSF project should delete `OsfLogo.tsx` and the lockup in
`App.tsx`.** Nothing else depends on it, and the header degrades to the product name
alone. Keeping it would be a claim about who published the fork.

## If you later want a different anatomy model

See `docs/COMMERCIAL_LICENSES.md` for the paid alternatives (BioDigital,
premium Sketchfab models) and the one scenario where a paid license becomes
unavoidable (photoreal parametric body shape via SMPL-X).
