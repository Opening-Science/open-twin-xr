#!/usr/bin/env python3
"""
Visible Human Project CT -> NIfTI.

The VHP CT is not DICOM. It is GE "Zeus" raw: a 3,416-byte proprietary header
followed by 512x512 big-endian 16-bit pixels, Unix-`compress`ed one file per
slice, with a separate human-readable header dump beside it. MOOSE cannot read
any of that, so this is the missing first step of the CT-atlas pipeline.

Everything below was verified against real slices before it was written — see D9
in docs/DECISIONS.md. The three findings that shape this file:

1. **HU = stored - 1024, big-endian.** Air lands on exactly 0 in the stored data
   and the range runs to about +1531 HU at bone. Read little-endian and you get
   byte-swapped noise that still has a plausible-looking histogram, so the
   endianness is asserted rather than assumed.

2. **Slices are NOT in filename order.** `c_vm1006` is at location -20 mm,
   `c_vm1300` at -314 mm, `c_vm1900` at -220 mm. The frozen CT is several series
   and the numbering does not track position. Sorting by filename yields a
   scrambled body that still stacks into a valid-looking volume — the failure
   mode that does not announce itself. Slices are ordered by the header's
   `Image location` and nothing else.

3. **Geometry comes from the header, per slice.** 1 mm thickness and spacing,
   512 matrix, 480 mm field of view -> 0.9375 mm in-plane. Read rather than
   hard-coded, because a series with a different FOV would otherwise be silently
   rescaled.

Usage:
    python scripts/ct-atlas/vhp_to_nifti.py --donor male --series frozen \\
        --out public/models/ct/vhp-male-frozen.nii.gz

    # de-risk on a subset first; --limit takes every Nth slice
    python scripts/ct-atlas/vhp_to_nifti.py --donor male --series frozen \\
        --stride 10 --out /tmp/vhp-male-preview.nii.gz

Licence: NLM Terms and Conditions. No registration required since 2019.
Note the female README still carries the pre-2019 "written license agreement"
wording and calls its own contents "male images" — NLM's error; the 2019 Terms
govern both donors.
"""
from __future__ import annotations

import argparse
import gzip
import re
import shutil
import struct
import sys
import zlib
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import urlopen

import numpy as np
import nibabel as nib

BASE = "https://data.lhncbc.nlm.nih.gov/public/Visible-Human"

# Verified on real slices: 3416 + 512*512*2 == 527704, exactly the file size.
HEADER_BYTES = 3416
COLS = ROWS = 512
# GE stores CT with a fixed offset so the data is unsigned. Air sits on 0.
HU_OFFSET = 1024

SERIES = {
    # donor  series  -> (directory, header directory, filename suffix)
    ("male", "frozen"): ("radiological/frozenCT", "radiological/frozenCTHeaders", ".fro"),
    ("male", "normal"): ("radiological/normalCT", "radiological/normalCTHeaders", ".fre"),
    # The female has no frozen CT published — see D9. Her cryosections therefore
    # need registering to a different scan than her geometry comes from.
    ("female", "normal"): ("radiological/normalCT", "radiological/normalCTHeaders", ".fre"),
}


@dataclass
class Slice:
    name: str
    location: float
    thickness: float
    fov_mm: float
    matrix: int
    exam: str
    series: str
    entry: str
    landmark: float | None

    @property
    def pixel_mm(self) -> float:
        return self.fov_mm / self.matrix


def _num(text: str, label: str) -> float | None:
    """Pull a numeric field out of the header dump.

    The dump pads names with dots to a fixed width — `Slice Thickness (mm).....: 1`
    — so the separator is a run of dots and a colon rather than a clean delimiter.
    """
    m = re.search(rf"{re.escape(label)}[.\s]*:\s*(-?[\d.eE+]+)", text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _text(text: str, label: str) -> str:
    m = re.search(rf"{re.escape(label)}[.\s]*:\s*(.+)", text)
    return m.group(1).strip() if m else ""


def parse_header(text: str, name: str) -> Slice | None:
    loc = _num(text, "Image location")
    if loc is None:
        return None
    thickness = _num(text, "Slice Thickness (mm)") or 1.0
    fov = _num(text, "Display Field of view - X (mm)") or 480.0
    matrix = int(_num(text, "Image matrix size - X") or COLS)
    return Slice(
        name=name,
        location=loc,
        thickness=thickness,
        fov_mm=fov,
        matrix=matrix,
        # The fields that make `Image location` meaningful. Without them it is a
        # number in an unstated frame — see `group_by_exam`.
        exam=_text(text, "Exam Number"),
        series=_text(text, "Series Number"),
        entry=_text(text, "Patient Entry"),
        landmark=_num(text, "Horizontal Landmark"),
    )


def fetch(url: str, dest: Path) -> bytes:
    """Download once, then serve from the cache. The full series is ~3,800 files."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest.read_bytes()
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url, timeout=120) as r:
        data = r.read()
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(data)
    tmp.replace(dest)
    return data


def list_slices(donor: str, series: str) -> list[str]:
    """Slice basenames, from the server's own directory index."""
    ct_dir, _, suffix = SERIES[(donor, series)]
    url = f"{BASE}/{donor.capitalize()}-Images/{ct_dir}/index.html"
    with urlopen(url, timeout=120) as r:
        html = r.read().decode("utf-8", "replace")
    names = re.findall(rf"href='([^']+{re.escape(suffix)}\.Z)'", html)
    return sorted({n.rsplit("/", 1)[-1][: -len(".Z")] for n in names})


def decompress(raw: bytes) -> bytes:
    """Unix `compress` (LZW). Python has no stdlib decoder, so shell out to gzip.

    gzip/gunzip handles `.Z`; zlib and gzip.decompress do not, and fail with a
    bad-magic error that reads like a corrupt download rather than a wrong codec.
    """
    if raw[:2] == b"\x1f\x9d":  # .Z magic
        gz = shutil.which("gzip") or shutil.which("gunzip")
        if not gz:
            raise RuntimeError("gzip is required to decode Unix-compressed .Z slices")
        import subprocess

        p = subprocess.run([gz, "-dc"], input=raw, capture_output=True)
        if p.returncode != 0 or not p.stdout:
            raise RuntimeError(f"failed to decompress: {p.stderr[:200]!r}")
        return p.stdout
    if raw[:2] == b"\x1f\x8b":  # plain gzip, just in case
        return gzip.decompress(raw)
    try:
        return zlib.decompress(raw)
    except zlib.error:
        return raw  # already uncompressed


def read_pixels(blob: bytes, name: str) -> np.ndarray:
    """One slice, as HU."""
    want = HEADER_BYTES + COLS * ROWS * 2
    if len(blob) != want:
        raise ValueError(f"{name}: expected {want} bytes, got {len(blob)}")
    px = np.frombuffer(blob, dtype=">i2", count=COLS * ROWS, offset=HEADER_BYTES)
    hu = px.astype(np.int16) - HU_OFFSET
    # The endianness check that matters. Read the wrong way round and the volume
    # still has a plausible histogram, so assert on physics instead: a CT slice
    # of a body in air must contain a lot of air, and air is -1024 HU.
    if not (-1100 < int(hu.min()) < -900):
        raise ValueError(
            f"{name}: minimum {int(hu.min())} HU is not air. Expected about -1024. "
            "Byte order or the header size is wrong — refusing to build a volume "
            "from data that is not CT."
        )
    return hu.reshape(ROWS, COLS)


def group_by_exam(slices: list[Slice]) -> dict[str, list[Slice]]:
    """Split on exam number, which is the only field that identifies a frame."""
    g: dict[str, list[Slice]] = {}
    for s in slices:
        key = (s.exam or "?").split()[0]
        g.setdefault(key, []).append(s)
    return g


def build(
    donor: str, series: str, out: Path, cache: Path, stride: int, workers: int, exam: str | None
) -> None:
    ct_dir, hdr_dir, suffix = SERIES[(donor, series)]
    root = f"{BASE}/{donor.capitalize()}-Images"

    names = list_slices(donor, series)
    if stride > 1:
        names = names[::stride]
    print(f"[vhp] {donor}/{series}: {len(names)} slices")

    # --- headers first: they decide the order, and they are small -----------
    def get_header(name: str) -> Slice | None:
        try:
            raw = fetch(f"{root}/{hdr_dir}/{name}.txt", cache / "hdr" / f"{name}.txt")
        except HTTPError:
            return None
        return parse_header(raw.decode("utf-8", "replace"), name)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        slices = [s for s in pool.map(get_header, names) if s is not None]
    if not slices:
        sys.exit("[vhp] no usable headers — nothing to build")
    print(f"[vhp] {len(slices)} headers parsed")

    # --- exams, and why this cannot just be sorted ---------------------------
    #
    # `Image location` is NOT a global position. It is relative to the exam's own
    # table landmark, and the direction it runs depends on `Patient Entry`. The
    # male frozen CT holds three groups:
    #
    #   exam 32  Reformatted    Head First  landmark  -84.0   842 slices
    #   exam 34  "Scout Series" Feet First  landmark  981.7   804 slices
    #   exam 646 Retrospective  Feet First  landmark 1027.8   224 slices
    #
    # Two slices reporting the same location in different exams are DIFFERENT
    # ANATOMY — verified by correlating their pixels, which came out at +0.33.
    # Sorting the pooled set and de-duplicating by location therefore throws away
    # roughly half the body and interleaves the rest, and the result still stacks
    # into a volume that looks entirely plausible.
    #
    # Placing exams in a common frame needs the landmark and entry direction
    # resolved and then checked against overlapping anatomy. That is not done
    # here, so rather than guess, this refuses.
    groups = group_by_exam(slices)
    if exam is None and len(groups) > 1:
        print("\n[vhp] This series contains more than one exam:\n")
        for key, g in groups.items():
            locs_g = [x.location for x in g]
            print(
                f"      --exam {key:<6} {g[0].series[:24]:<26} {g[0].entry[:12]:<13} "
                f"landmark {str(g[0].landmark):>8}  {len(g):>4} slices  "
                f"{min(locs_g):8.1f}..{max(locs_g):8.1f} mm"
            )
        sys.exit(
            "\n[vhp] Refusing to merge them. `Image location` is relative to each exam's\n"
            "      table landmark and its direction flips with Patient Entry, so pooling\n"
            "      them silently produces a wrong body that still looks like a body.\n"
            "      Build one exam at a time with --exam, or implement cross-exam\n"
            "      registration and verify it against overlapping anatomy.\n"
        )
    if exam is not None:
        if exam not in groups:
            sys.exit(f"[vhp] no exam {exam}; have {sorted(groups)}")
        slices = groups[exam]
        print(f"[vhp] exam {exam}: {slices[0].series} / {slices[0].entry}, {len(slices)} slices")

    slices.sort(key=lambda s: s.location)

    # Within ONE exam, a repeated location is a genuine duplicate reconstruction
    # (the same slice at a different field of view), so keeping one is correct.
    seen: dict[float, Slice] = {}
    dupes = 0
    for s in slices:
        key = round(s.location, 3)
        if key in seen:
            dupes += 1
            continue
        seen[key] = s
    slices = list(seen.values())
    if dupes:
        print(f"[vhp] dropped {dupes} duplicate reconstruction(s) within this exam")

    locs = np.array([s.location for s in slices])
    gaps = np.diff(locs)
    step = float(np.median(gaps)) if len(gaps) else slices[0].thickness
    print(
        f"[vhp] location {locs.min():.1f} to {locs.max():.1f} mm "
        f"({locs.max() - locs.min():.0f} mm of body), median step {step:.3f} mm"
    )
    if len(gaps) and (gaps.max() > step * 3):
        print(
            f"[vhp] WARNING largest gap is {gaps.max():.1f} mm against a {step:.2f} mm step — "
            "the series has a hole in it and the volume will be squashed there"
        )

    pixel_mm = slices[0].pixel_mm
    if len({round(s.pixel_mm, 4) for s in slices}) > 1:
        print("[vhp] WARNING slices disagree on pixel size; using the first")
    print(f"[vhp] voxel {pixel_mm:.4f} x {pixel_mm:.4f} x {abs(step):.3f} mm")

    # --- pixels -------------------------------------------------------------
    def get_pixels(idx_s):
        i, s = idx_s
        raw = fetch(f"{root}/{ct_dir}/{s.name}.Z", cache / "ct" / f"{s.name}.Z")
        return i, read_pixels(decompress(raw), s.name)

    vol = np.zeros((ROWS, COLS, len(slices)), dtype=np.int16)
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for i, plane in pool.map(get_pixels, enumerate(slices)):
            vol[:, :, i] = plane
            done += 1
            if done % 200 == 0:
                print(f"[vhp]   {done}/{len(slices)}")

    # --- affine -------------------------------------------------------------
    # Axial CT, rows running anterior->posterior and columns left->right in the
    # stored order, stacked inferior->superior once sorted by location. The
    # negative x and y put it in RAS, which is what NIfTI declares.
    #
    # A determinant check is not enough on its own — a mirrored body has a
    # positive determinant too if two axes flip. Verify laterality downstream
    # against a known-asymmetric structure (liver right, spleen left) exactly as
    # labelmap2glb.py does; this affine is a starting point, not a guarantee.
    affine = np.array(
        [
            [-pixel_mm, 0, 0, pixel_mm * COLS / 2],
            [0, -pixel_mm, 0, pixel_mm * ROWS / 2],
            [0, 0, abs(step), float(locs.min())],
            [0, 0, 0, 1],
        ],
        dtype=np.float64,
    )

    img = nib.Nifti1Image(vol, affine)
    img.header.set_xyzt_units("mm")
    # Say out loud that these are Hounsfield units; MOOSE assumes CT and a
    # mislabelled intensity scale is the kind of thing that segments silently
    # and wrongly.
    img.header["descrip"] = f"VHP {donor} {series} CT, HU".encode()[:79]
    out.parent.mkdir(parents=True, exist_ok=True)
    nib.save(img, str(out))

    mb = out.stat().st_size / 1e6
    print(
        f"[vhp] wrote {out} — {vol.shape[0]}x{vol.shape[1]}x{vol.shape[2]}, "
        f"{mb:.1f} MB, HU {int(vol.min())}..{int(vol.max())}"
    )
    if stride > 1:
        print(f"[vhp] NOTE this is a stride-{stride} preview, not the full series")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--donor", choices=("male", "female"), required=True)
    ap.add_argument("--series", choices=("frozen", "normal"), default="frozen")
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--cache", type=Path, default=Path("scripts/ct-atlas/.cache"))
    ap.add_argument("--stride", type=int, default=1, help="take every Nth slice, to preview cheaply")
    ap.add_argument("--workers", type=int, default=8, help="parallel downloads; be polite to NLM")
    ap.add_argument("--exam", help="build one exam. Run without it to list what a series contains.")
    a = ap.parse_args()

    if (a.donor, a.series) not in SERIES:
        sys.exit(
            f"[vhp] no {a.series} CT published for the {a.donor} donor. "
            f"Available: {sorted(k for k in SERIES)}"
        )
    build(a.donor, a.series, a.out, a.cache / a.donor / a.series, a.stride, a.workers, a.exam)


if __name__ == "__main__":
    main()
