# Report 01 — Does photographic tissue colour survive this pipeline?

**Answers decision D4.** Dated 29 July 2026. Verdict: **yes, with one condition.**

---

## Abstract

This project renders anatomy in flat per-system colours because no source it had
carried real tissue colour. **D4** asked whether photographic colour — tissue as
actually photographed from a cadaver — would survive retopology, decimation,
compression and an ambient-occlusion bake, or whether it would arrive as mud.

Testing that on the Visible Human cryosection set would have meant handling
hundreds of gigabytes. The OpenEar library is the same experiment at roughly
1/100th the scale: one temporal bone, CC BY 4.0, with registered true-colour
micro-slicing photography.

**The answer is yes.** All twelve structures now carry colour sampled from the
specimen's own photographs, **71.5 % of the surface by area** has a real colour
source, and the remainder is neutral grey that is counted rather than invented.
The condition is that last clause: the pipeline must be able to say where it has no
data, or the result stops being a measurement.

Two things went differently from the plan, and both are more useful than the
result. The registration everyone expected to be hard was a single axis flip. The
step nobody flagged — UV unwrapping — failed silently on eleven of twelve
structures for a reason that had nothing to do with the hypothesis recorded at the
time.

---

## Source material

| | |
|---|---|
| Dataset | OpenEar, specimen **ZETA** — one right temporal bone |
| Rights holder | MED-EL / University of Bern |
| Licence | **CC BY 4.0** (re-confirmed from the Zenodo API) |
| Record | <https://zenodo.org/record/1473724> |
| Geometry | 12 structures as PLY, 139.7 MB |
| Colour | `Microslicing_Zeta.nrrd`, 305 MB, 8-bit RGB, **50 µm in plane, 150 µm between slices** |

**⚠️ The colour is not in the meshes.** Every OpenEar PLY declares `property float
x/y/z` and a face list and nothing else — no vertex colour, no UVs, no texture
reference. The colour and the geometry are registered *to each other*, in a stated
coordinate space, with the transforms shipped — but the colour is not attached to
the surface. So this is a **volume-to-surface bake**, not an import, which is
precisely what makes it a fair rehearsal for D4.

### Fetching 303 MB out of a 7.3 GB release

The specimen archive is 7.3 GB and the interesting parts are a fraction of it.
`scripts/remote-zip-index.mjs` reads a remote ZIP's central directory over HTTP
range requests and pulls individual members, so **303.1 MB was transferred instead
of 7.3 GB**. The tooling is reusable and matters more for the larger specimens in
the same release (GAMMA and DELTA are 13.5 and 14 GB).

---

## Method

### 1. Registration — the part expected to be hard

The meshes are in **RAS**; every volume is in **LPS**. The mapping is therefore
negate-x-and-y, which is exactly what the archive's own `FlipXY.h5` contains:
`diag(−1, −1, 1)`.

Two quantitative gates, both run because a browser could not be used to eyeball it:

| gate | raw mesh coordinates | after `FlipXY` |
|---|---|---|
| vertices inside `Segmentation.seg.nrrd` | 0–49 of 400 | **400 / 400**, all twelve meshes |
| landing on a labelled voxel | 4 % | **54–96 %** |
| vertices inside `Microslicing_Zeta.nrrd` | — | **6,985 / 7,200 = 97 %** |
| of those, on non-black tissue | — | essentially all; mean RGB ≈ (165, 155, 110) |

The 54–96 % spread on labelled voxels is not misalignment: the low end is the three
ossicles, and a *surface* vertex sits on a label boundary by definition, so at
0.125 mm voxels it lands on the background side about as often as not. The warm pale
mean is what micro-slicing photographs of a temporal bone should look like.

**The CBCT registration chain turned out to be unnecessary**, which is the
simplification worth recording. Composing `BrainsFit` with `InitialGuess` and
getting the direction convention right was the single largest correctness risk in
the whole exercise. The folder name `05_Registred_Slicer_Volumes` was the clue: the
volumes in it are already resampled into one common frame, so the entire transform
question collapses to a coordinate-convention flip.

### 2. UV unwrapping — the part nobody flagged

`gltf-transform unwrap` (xatlas) produced usable UVs for **exactly one of twelve**
structures. The other eleven came back with a correctly-sized `TEXCOORD_0` accessor
in which **every value was NaN**, so every triangle rasterised to nothing and eleven
textures baked empty.

The hypothesis recorded at the time was that the unwrap packs all primitives into
one shared atlas and only the largest survives — plausible, because the one that
worked was the largest mesh by an order of magnitude. **It was tested and it is
wrong:**

| attempt | usable UVs |
|---|---|
| all twelve in one file (`--group-by mesh`, the default) | 1 / 12 |
| `--group-by primitive` | 1 / 12 |
| `--group-by scene` | 1 / 12 |
| **each structure in its own single-mesh file** | **1 / 12** |

It is a **units** problem. The build converted millimetres to metres before
unwrapping. A malleus is about 2 mm across, so at metre scale it spans 0.002 model
units and its triangles have areas near 1e-8 — under xatlas's internal epsilon for a
degenerate face. It finds no chart to build and writes NaN. Measured directly:

| positions in | usable UVs |
|---|---|
| metres | **1 / 12** |
| centimetres | 12 / 12 |
| millimetres | **12 / 12** |

The fix is one multiplication moved: unwrap in the source units, convert to metres
after the bake. UVs are scale-invariant, so it costs nothing.

**The lesson generalises past this asset.** A plausible explanation that fits the
observation is not a diagnosis. The shared-atlas theory explained why the *largest*
mesh survived just as well as the true cause did, and would have sent the next
person to rewrite the unwrap stage.

### 3. Texture sizing derived from the source, not chosen

A flat texture size is wrong in both directions when structures differ by two
orders of magnitude in area. The micro-slicing is 50 µm in plane, so a structure of
area *A* mm² holds at most *A* / 0.05² distinguishable samples:

| structure | area | samples the source justifies | a flat 1024² gives |
|---|---|---|---|
| Stapes | 23.1 mm² | 9,239 | 1,048,576 — **113× oversampled** |
| Malleus | 42.8 mm² | 17,135 | 1,048,576 |
| Sinus Dura | 7,652.7 mm² | 3,061,063 | 1,048,576 — **under-sampled** |

Sizes are therefore computed per structure from surface area and the voxel pitch,
with 1.5× headroom for xatlas's chart packing, rounded to a power of two and clamped
to [128, 1024]. Result: **128²–1024², 3.9 M texels against 12.6 M** for a flat
1024². Where the clamp binds rather than the source, the asset records that, so
"as sharp as the photograph gets" and "as sharp as we allowed" stay distinguishable.

### 4. Compression chosen by measurement

This is a colour-fidelity pilot, so the codec was selected with data rather than a
default. KTX2/Basis was the plan; it needs a `ktx` binary that was not available, so
WebP was measured instead — decoded back to raw and compared texel-for-texel against
the PNG bake:

| setting | size | mean \|ΔRGB\| | worst structure |
|---|---|---|---|
| PNG (baseline) | 11.40 MB | 0.00 | — |
| **WebP lossless** | **9.14 MB** | **0.00** | — |
| WebP q95 | 7.72 MB | 0.93 / 255 | Chorda Tympani 1.48 |
| WebP q90 | 7.55 MB | 1.16 / 255 | Scala Vestibuli 1.79 |
| WebP q80 | 7.40 MB | 1.57 / 255 | Chorda Tympani 2.36 |

**Lossless wins here, and the reason is instructive.** Lossy saves surprisingly
little — 1.4 MB from lossless to q95 — because a large share of the texture area is
flat: uncovered background, dilated seams, and the neutral grey where there is no
colour source. Those compress almost perfectly without loss. Paying measurable
colour error for 1.4 MB, in an experiment whose entire purpose is to measure whether
colour survives, would be the wrong trade.

### 5. Occlusion kept separate, deliberately

Every atlas in this project carries per-vertex ambient occlusion in `COLOR_0`. This
asset **does not**, and that is the point: folding occlusion into the photograph
would make the two inseparable, and the measurement this report exists to make
would no longer be possible. Colour goes to `baseColorTexture`; occlusion belongs in
its own channel, multiplied at render time.

---

## Findings

**Photographic tissue colour survives the pipeline.** Twelve of twelve structures
carry baked colour and the asset renders as an organ overlay in the live app.

**Coverage, reported two ways because one of them misleads:**

| measure | value |
|---|---|
| **Surface with a real colour source (area-weighted)** | **71.5 %** |
| Texels from the photograph (texel-weighted) | 89.1 % |

The texel figure is the tempting one and it is a poor quality metric: it moved from
96.0 % to 89.1 % when the textures were resized, though nothing about the colour
changed. Area weighting answers the question actually being asked — what fraction of
this ear's surface has a photograph behind it. Both are printed so neither can be
mistaken for the other.

**Where the grey is, is exactly where the physics says it should be:**

| structure | colour from photograph |
|---|---|
| Sinus Dura | 63.8 % |
| Cochleovestibular Nerve | 96.4 % |
| Carotis Interna | 97.8 % |
| the other nine | **100 %** |

The micro-sliced block is about **39.6 × 39.6 × 51.8 mm**, smaller than the CBCT
field. The three structures with incomplete colour are precisely the three that
extend beyond it. That the shortfall lands there, and only there, is the strongest
evidence that the registration and sampling are correct.

**Shipped asset:** 12 structures, 0.23 M triangles, 12 WebP textures, **9.1 MB**.

---

## Limitations

State all of these wherever the asset is shown.

1. **One cadaveric temporal bone, not a population.** Specimen ZETA is a single
   right ear. Nothing about it is a normative range.
2. **It is ~14 % larger than the body's own ear, and is left unscaled.** Scaling a
   real specimen to fit a different donor would be fabrication; the mismatch is
   disclosed instead.
3. **Grey means "no source", not "this colour".** 28.5 % of the surface by area has
   no photograph behind it. Any downstream use must preserve that distinction —
   interpolating it away would convert an honest absence into an invented
   measurement.
4. **No ambient occlusion.** Deliberate, per §5, but it means the ear renders
   flatter than the atlases beside it until occlusion is added as a separate
   channel.
5. **It does not yet hide the anatomy it replaces.** Overlay superseding matches
   structures by name, and Z-Anatomy names both ears' ossicles identically, so a
   one-sided overlay cannot mask its own side without blanking the other. The ear
   currently renders *alongside* Z-Anatomy's ear. See Report 04.
6. **WebP, not KTX2.** WebP must be fully decompressed in GPU memory, where
   KTX2/Basis would stay compressed. For twelve textures this is acceptable; for a
   whole-body colour bake it would not be, which matters for the D4 sequel.

## What this implies for the Visible Human sequel

The mechanism transfers: a registered colour volume plus a surface, sampled through
a stated transform, with texture resolution derived from the source's own sampling
rate. Three things would need to change at whole-body scale — GPU-compressed
textures rather than WebP, a texture budget across thousands of structures rather
than twelve, and an occlusion channel from the start.

---

## Reproducing this

```bash
npm run build:openear -- --src DIR   # DIR holds the PLYs + Microslicing_*.nrrd
npm run convert:openear              # lossless WebP
```

The build **exits non-zero** if any structure bakes zero texels. That guard is why
the unwrap bug was caught at all: the first run reported "59.3 % of texels came from
the photograph" and read like a partial success, when in fact eleven of twelve
structures had contributed nothing and the percentage was computed over the one that
worked. An average across structures hides a structure that is entirely missing.

## References

- Sieber D, et al. *The OpenEar library of 3D models of the human temporal bone.*
  **Scientific Data** (2018). <https://doi.org/10.1038/sdata.2018.297>
- Zenodo record 1473724 — <https://zenodo.org/record/1473724>
- `scripts/build-openear.mjs`, `scripts/remote-zip-index.mjs`,
  `scripts/remote-zip-extract.mjs`
- `docs/DECISIONS.md` — D4
