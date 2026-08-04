# Where a commercial license is (and is not) needed

Short answer for this first web version: **you can build and ship the entire
thing with zero paid licenses.** Everything in the default stack is MIT,
Apache-2.0, BSD, or CC BY. The only obligation is **CC BY 4.0 attribution** on
the HRA anatomy model asset — no share-alike, no fee (see `ASSETS_LICENSE.md`).
Share-alike only enters if the Z-Anatomy fallback is used.

Below is the full picture, including the optional paths where money would enter.

## Free / open (the default stack)

| Piece | License | Fee |
|---|---|---|
| three.js, @react-three/fiber, drei, @react-three/xr | MIT | none |
| React, Vite, Zustand, Recharts, Tailwind | MIT | none |
| glTF / GLB, meshopt, Draco, KTX2 | Open (Khronos / MIT / Apache) | none |
| gltf-transform (CLI for compression) | MIT | none |
| WebXR Device API | Open W3C standard | none |
| HRA (HuBMAP Human Reference Atlas) model | CC BY 4.0 | none (attribution only) |
| Z-Anatomy / BodyParts3D model (fallback) | CC-BY-SA 4.0 / 2.1 JP | none (attribution + share-alike) |
| `@open-twin/*` connectors | MIT | none (see caveat below) |
| Inter font | SIL OFL 1.1 | none |

**Caveat on the connectors:** they are MIT and free, but **not published to
npm**, and `dist/` is not committed. Integration is a workspace or `file:`
dependency plus a build step — a cost in time, not licensing. See
`docs/ARCHITECTURE.md` section 1.

## Optional paid paths (only if you choose them)

1. **Higher-fidelity anatomy than HRA.**
   - **BioDigital Human** offers a polished anatomy platform and API, but it is
     a commercial SaaS with per-seat / API pricing and its content is not
     open. Only needed if HRA quality or coverage is insufficient — and note the
     free first move is the Z-Anatomy fallback, not a paid platform.
   - **Paid Sketchfab / TurboSquid anatomy models** carry per-model royalty
     licenses. Check each model's license; many are not redistributable, which
     conflicts with an open-source repo.

2. **Photoreal, parametric body SHAPE (not organs).**
   If a later version fits a *real person's body shape* — from BodyLoop
   measurements, or from a surface source should one appear — using the
   **SMPL / SMPL-X** parametric body model, note that SMPL-X is
   **research/non-commercial licensed**; commercial use needs a **paid license
   from Meshcapade**. The open escape hatch is **MakeHuman / MPFB2**, whose
   exported assets are **CC0** (free for commercial use), and which is already
   the default path in `HANDOVER_SPEC.md` Phase 2. This only matters if you add
   a body-shape layer; the organ health twin here does not need it.

3. **Hosting, auth, and the AI layer.**
   - Static hosting (Vercel, Netlify, Cloudflare Pages, GitHub Pages) has free
     tiers; cost scales with traffic, not license.
   - The **AI integration layer is out of scope for this repo** and would carry
     its own provider cost (OpenAI/Anthropic/self-hosted). Do not wire it here.

4. **Wearable / health-data connectors.**
   Oura, Google Health, Apple Health etc. are free to integrate via their APIs
   but each has its own developer terms, rate limits, and (for some) app-review
   requirements. No license fee, but budget review/compliance time.

## Bottom line

Ship v1 free. The first time a paid license becomes *unavoidable* is if you add
a photoreal parametric body shape with SMPL-X for a commercial product. Nothing
in the organ-system health twin requires it, and MakeHuman/MPFB2 (CC0) covers
the shell layer without it.

One non-licensing cost worth naming: some medical-segmentation model weights
(TotalSegmentator among them) carry non-commercial or institutional clauses even
where the code is Apache. That only bites in Phase 3 (MRI), and it is
`HANDOVER_SPEC.md` open question 6 — verify the weight terms before shipping
patient-specific organs commercially.
