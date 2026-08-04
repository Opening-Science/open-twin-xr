#!/usr/bin/env python3
"""
Find how the Visible Human CT exams sit in one frame — by measurement, not by
reading the GE manual.

`vhp_to_nifti.py` refuses to merge exams because `Image location` is relative to
each exam's table landmark and its direction flips with Patient Entry. This
solves that, and it solves it empirically: the correct alignment is the one where
the anatomy in the overlap actually matches.

WHY NOT JUST APPLY THE LANDMARK ARITHMETIC
------------------------------------------
Because a plausible formula that is subtly wrong is exactly the failure this
pipeline keeps producing. Sorting by filename gave a scrambled body that looked
like a body; sorting by location gave a half body that looked like a body. A
landmark formula off by a sign would give a third. Correlation over real pixels
cannot be fooled the same way: if two slices are the same anatomy they correlate
near 1, and if they are not they sit near 0.3, which is what the two exams
measured at before this existed.

WHAT IT SEARCHES
----------------
For each non-reference exam, every combination of:

  * z direction        +1 or -1     (Patient Entry flips it)
  * in-plane transform identity / flip L-R / flip A-P / both
  * z offset           swept over a range, at 1 mm

and it keeps the combination whose overlapping slices correlate best. All four
in-plane options are tried rather than assumed, because a Feet First acquisition
may or may not already be stored corrected, and getting that wrong mirrors the
body — the single worst outcome available here, since a mirrored twin is
anatomically wrong in a way that still looks completely normal.

    python scripts/ct-atlas/vhp_align_exams.py --donor male --series frozen
    python scripts/ct-atlas/vhp_align_exams.py --donor male --series frozen \\
        --write out.nii.gz --preview out.png
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import nibabel as nib

sys.path.insert(0, str(Path(__file__).parent))
import vhp_to_nifti as V  # noqa: E402

# Coarse enough to search quickly, fine enough that a mirrored body cannot pass.
SEARCH_DOWNSAMPLE = 4  # 512 -> 128 in plane
MIN_OVERLAP_SLICES = 12
# Below this, "aligned" is not a claim worth making. Genuinely matching slices of
# the same anatomy sit far above it; the mismatch that started all this was 0.33.
MIN_CORRELATION = 0.80

FLIPS = {
    "identity": lambda a: a,
    "flip-LR": lambda a: a[:, ::-1],
    "flip-AP": lambda a: a[::-1, :],
    "flip-both": lambda a: a[::-1, ::-1],
}


@dataclass
class Fit:
    exam: str
    sign: int
    flip: str
    offset: float
    correlation: float
    overlap: int


def load_exam(donor: str, series: str, exam: str, stride: int, cache: Path):
    """Header-ordered slices for one exam, downsampled, as {global_z: image}."""
    ct_dir, hdr_dir, _ = V.SERIES[(donor, series)]
    root = f"{V.BASE}/{donor.capitalize()}-Images"
    names = V.list_slices(donor, series)

    slices = []
    for n in names:
        f = cache / "hdr" / f"{n}.txt"
        if not f.exists():
            try:
                V.fetch(f"{root}/{hdr_dir}/{n}.txt", f)
            except Exception:
                continue
        s = V.parse_header(f.read_text(errors="replace"), n)
        if s and (s.exam or "?").split()[0] == exam:
            slices.append(s)

    # One reconstruction per location within an exam.
    best: dict[float, V.Slice] = {}
    for s in slices:
        best.setdefault(round(s.location, 3), s)
    ordered = sorted(best.values(), key=lambda s: s.location)[::stride]

    out: dict[float, np.ndarray] = {}
    for s in ordered:
        raw = V.fetch(f"{root}/{ct_dir}/{s.name}.Z", cache / "ct" / f"{s.name}.Z")
        img = V.read_pixels(V.decompress(raw), s.name).astype(np.float32)
        out[s.location] = img[::SEARCH_DOWNSAMPLE, ::SEARCH_DOWNSAMPLE]
    return out, ordered


def correlate(a: np.ndarray, b: np.ndarray) -> float:
    """Correlation over soft tissue and bone, ignoring the air that dominates.

    Air is most of a CT slice and it is identical everywhere, so including it
    inflates every comparison toward 1 and makes a wrong alignment look right.
    """
    m = (a > -500) | (b > -500)
    if m.sum() < 200:
        return 0.0
    x, y = a[m], b[m]
    if x.std() < 1e-6 or y.std() < 1e-6:
        return 0.0
    return float(np.corrcoef(x, y)[0, 1])


def fit_exam(ref: dict[float, np.ndarray], mov: dict[float, np.ndarray], exam: str) -> Fit | None:
    ref_z = np.array(sorted(ref))
    mov_z = np.array(sorted(mov))
    # Match tolerance has to track the ACTUAL slice spacing after striding, not a
    # fixed millimetre. Hard-coding 1 mm while the strided slices sit 8 mm apart
    # means almost no candidate pair ever forms, every offset scores on a handful
    # of coincidental hits, and the search reports "no overlap" for data that
    # overlaps perfectly well.
    spacing = float(np.median(np.diff(ref_z))) if len(ref_z) > 1 else 1.0
    tol = max(1.0, spacing / 2 + 0.01)
    step_mm = max(1.0, spacing / 2)
    # Sweep every offset that could put the two ranges in contact at all.
    span = (ref_z.max() - ref_z.min()) + (mov_z.max() - mov_z.min())
    best: Fit | None = None

    for sign in (1, -1):
        base = sign * mov_z
        for flip_name, flip in FLIPS.items():
            moved = {sign * z: flip(img) for z, img in mov.items()}
            lo = ref_z.min() - base.max() - span * 0.1
            hi = ref_z.max() - base.min() + span * 0.1
            for off in np.arange(lo, hi, step_mm):  # coarse pass
                pairs, tot = 0, 0.0
                for z, img in moved.items():
                    zz = z + off
                    i = int(np.abs(ref_z - zz).argmin())
                    if abs(ref_z[i] - zz) > tol:
                        continue
                    tot += correlate(ref[ref_z[i]], img)
                    pairs += 1
                if pairs >= MIN_OVERLAP_SLICES:
                    c = tot / pairs
                    if best is None or c > best.correlation:
                        best = Fit(exam, sign, flip_name, float(off), c, pairs)

    if best is None:
        return None
    # Fine pass at 1 mm around the coarse winner.
    moved = {best.sign * z: FLIPS[best.flip](img) for z, img in mov.items()}
    for off in np.arange(best.offset - spacing, best.offset + spacing, 1.0):
        pairs, tot = 0, 0.0
        for z, img in moved.items():
            zz = z + off
            i = int(np.abs(ref_z - zz).argmin())
            if abs(ref_z[i] - zz) > tol:
                continue
            tot += correlate(ref[ref_z[i]], img)
            pairs += 1
        if pairs >= MIN_OVERLAP_SLICES and tot / pairs > best.correlation:
            best = Fit(exam, best.sign, best.flip, float(off), tot / pairs, pairs)
    return best


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--donor", choices=("male", "female"), required=True)
    ap.add_argument("--series", choices=("frozen", "normal"), default="frozen")
    ap.add_argument("--reference", help="exam to hold fixed (default: the one with most slices)")
    ap.add_argument("--stride", type=int, default=6, help="slice stride while searching")
    ap.add_argument("--cache", type=Path, default=Path("scripts/ct-atlas/.cache"))
    ap.add_argument("--write", type=Path, help="write the merged volume if the fit is good")
    ap.add_argument("--preview", type=Path, help="write a coronal PNG to eyeball")
    a = ap.parse_args()

    cache = a.cache / a.donor / a.series
    ct_dir, hdr_dir, _ = V.SERIES[(a.donor, a.series)]
    root = f"{V.BASE}/{a.donor.capitalize()}-Images"

    # Which exams exist.
    names = V.list_slices(a.donor, a.series)
    hdrs = []
    for n in names:
        f = cache / "hdr" / f"{n}.txt"
        if not f.exists():
            try:
                V.fetch(f"{root}/{hdr_dir}/{n}.txt", f)
            except Exception:
                continue
        s = V.parse_header(f.read_text(errors="replace"), n)
        if s:
            hdrs.append(s)
    groups = V.group_by_exam(hdrs)
    print(f"[align] exams: " + ", ".join(f"{k} ({len(v)})" for k, v in sorted(groups.items())))

    ref_exam = a.reference or max(groups, key=lambda k: len(groups[k]))
    print(f"[align] reference exam {ref_exam}; loading at stride {a.stride}\n")

    ref, ref_slices = load_exam(a.donor, a.series, ref_exam, a.stride, cache)
    fits: list[Fit] = []
    for exam in sorted(groups):
        if exam == ref_exam:
            continue
        mov, _ = load_exam(a.donor, a.series, exam, a.stride, cache)
        f = fit_exam(ref, mov, exam)
        if f is None:
            print(f"  exam {exam:<5} no offset gives {MIN_OVERLAP_SLICES}+ overlapping slices — disjoint")
            continue
        verdict = "OK" if f.correlation >= MIN_CORRELATION else "REJECT"
        print(
            f"  exam {f.exam:<5} z*{f.sign:+d}  {f.flip:<10} offset {f.offset:+8.1f} mm  "
            f"r={f.correlation:+.3f} over {f.overlap:>3} slices   {verdict}"
        )
        fits.append(f)

    good = [f for f in fits if f.correlation >= MIN_CORRELATION]
    print(
        f"\n[align] {len(good)}/{len(fits)} exam(s) aligned above r={MIN_CORRELATION}. "
        f"Reference {ref_exam} is the frame."
    )
    if not good:
        print(
            "[align] Nothing met the bar. Either the exams do not overlap — in which case\n"
            "        they must be butted together on body continuity, which correlation\n"
            "        cannot verify — or the search space is missing the right transform."
        )

    if not (a.write or a.preview):
        return

    # --- assemble at full resolution ---------------------------------------
    print("\n[align] assembling at full resolution…")
    placed: dict[float, np.ndarray] = {}
    order = [(ref_exam, 1, "identity", 0.0)] + [(f.exam, f.sign, f.flip, f.offset) for f in good]
    for exam, sign, flip, off in order:
        _, slices = load_exam(a.donor, a.series, exam, 1, cache)
        for s in slices:
            raw = V.fetch(f"{root}/{ct_dir}/{s.name}.Z", cache / "ct" / f"{s.name}.Z")
            img = FLIPS[flip](V.read_pixels(V.decompress(raw), s.name))
            z = round(sign * s.location + off, 1)
            # First exam placed at a position wins; the reference goes first.
            placed.setdefault(z, img)
        print(f"[align]   exam {exam}: {len(slices)} slices, total now {len(placed)}")

    zs = np.array(sorted(placed))
    step = float(np.median(np.diff(zs)))
    pixel = ref_slices[0].pixel_mm
    vol = np.stack([placed[z] for z in zs], axis=-1).astype(np.int16)
    print(
        f"[align] volume {vol.shape}, z {zs.min():.0f}..{zs.max():.0f} mm "
        f"({zs.max() - zs.min():.0f} mm), step {step:.2f} mm"
    )

    if a.preview:
        # Coronal mean projection through the middle third — enough to see whether
        # the body is continuous and the right way up.
        mid = vol.shape[0] // 2
        cor = vol[mid - 40 : mid + 40, :, :].mean(axis=0)
        cor = np.clip((cor + 200) / 1200, 0, 1)
        cor = (cor[:, ::-1].T * 255).astype(np.uint8)
        try:
            from PIL import Image

            Image.fromarray(cor).save(a.preview)
            print(f"[align] wrote {a.preview} ({cor.shape[1]}x{cor.shape[0]})")
        except ImportError:
            np.save(a.preview.with_suffix(".npy"), cor)
            print(f"[align] Pillow missing; wrote {a.preview.with_suffix('.npy')}")

    if a.write:
        affine = np.array(
            [
                [-pixel, 0, 0, pixel * V.COLS / 2],
                [0, -pixel, 0, pixel * V.ROWS / 2],
                [0, 0, abs(step), float(zs.min())],
                [0, 0, 0, 1],
            ]
        )
        img = nib.Nifti1Image(vol, affine)
        img.header.set_xyzt_units("mm")
        img.header["descrip"] = f"VHP {a.donor} {a.series} CT merged, HU".encode()[:79]
        a.write.parent.mkdir(parents=True, exist_ok=True)
        nib.save(img, str(a.write))
        print(f"[align] wrote {a.write} ({a.write.stat().st_size / 1e6:.0f} MB)")
        print(
            "[align] Laterality is NOT verified by this script. Check it downstream against\n"
            "        a known-asymmetric structure — liver right, spleen left, heart apex left."
        )


if __name__ == "__main__":
    main()
