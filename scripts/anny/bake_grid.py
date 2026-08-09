#!/usr/bin/env python3
"""
Bake ANNY's phenotype space to a shape GRID the browser can interpolate.

This is what makes the envelope's sliders live rather than a set of five fixed
presets. It produces one binary file the app loads and evaluates in JavaScript —
no PyTorch in the browser, and no per-frame model call.

⚠️ READ THIS BEFORE CHANGING THE SAMPLING. THREE APPROACHES WERE MEASURED AND
TWO OF THEM FAIL BADLY. The obvious ones are the bad ones.

  per-axis linear deltas (glTF morph targets, 12 targets)     103 mm worst error
  multilinear over the 2^6 hypercube corners (64 bakes)       284 mm worst error
  THIS: each axis sampled at ITS OWN STOPS, tent-basis         22 mm worst error

Measured as maximum vertex displacement against the true model at random
interior slider positions, on a 1.7 m body.

WHY THE FIRST TWO FAIL, because it is the same reason twice. MakeHuman's macro
system is a TENSOR of pre-combined targets — the files are named
`universal-{gender}-{age}-{muscle}-{weight}.target.gz`, so the combinations are
baked rather than composed. Independent per-axis deltas therefore miss every
cross-term, and they miss them badly: a single two-axis combination
(gender 0, age 0.75) is already 74 mm off.

And corner interpolation additionally ignores the shape of each axis BETWEEN its
ends. `age` has five stops — newborn, baby, child, young, old — so interpolating
straight from newborn to old puts age 0.5 at about 1.24 m where the model says
1.63 m. Nearly 40 cm of nonsense in one axis.

Sampling at the model's own stops fixes both: the tent basis is exact AT every
stop, and between stops it interpolates over a span the model actually varies
smoothly across.

WHAT IS AND IS NOT IN THE GRID
------------------------------
A full tensor at natural stops — 2 x 5 x 3 x 3 x 2 x 2 = 360 points:

    gender 2   age 5   muscle 3   weight 3   height 2   proportions 2

⚠️ ALL SIX ARE REAL DIMENSIONS, and the cheaper alternative was tried first.
Carrying `height` and `proportions` as separable additive corrections keeps the
grid at 90 points, and MEASURED WORSE THAN FIVE TIMES the error: 22 mm core-only
became 116 mm once those two were applied additively. They interact with the
core, so they get dimensions. 360 points, ~30 MB quantised — the same order as
`htb-ct-003.glb` (27 MB), which this app already ships.

⚠️ `race` IS DELIBERATELY NOT BAKED. ANNY excludes it from `phenotypes="default"`
and so does this. "african / asian / caucasian" as interpolable shape axes is a
claim about human variation this project has no basis to make, and it is not the
kind of thing to ship because the data happened to contain it. `cupsize` and
`firmness` are excluded for a different reason: they are body-shape controls of
the sort `docs/research/FORK_PLAN.md` §7 flags for their disordered-eating
association, on a rendered 3D body which is already a body-image surface.

⚠️ THE GRID CARRIES ITS OWN TOPOLOGY, AND THAT IS NOT AN OPTIMISATION.

The first version shipped positions only and took the index buffer from
`anny-adult-f.glb`, on the reasoning that the topology is identical at every
grid point so shipping it once was enough. That is true of the MODEL and false
of the ASSET: `npm run convert:anny` runs meshopt, which REORDERS vertices for
cache locality, so the compressed GLB numbers its vertices differently from the
model the grid was baked from. Pairing the two scrambled every triangle.

It was invisible three ways over. Positions come from the grid, so height and
every slider read exactly correct; the scrambled surface still covers the body's
silhouette, so a "does it render" pixel count passed; and the vertex COUNT
matches on both sides, so the obvious assertion passes too. What catches it is
signed volume — 0.56 L against the 51.20 L the same positions give under the
model's own face order — which is why this script now asserts on it below.

OUTPUT FORMAT
-------------
One `.bin`, an `.idx`, little-endian, plus a JSON sidecar describing them:

    neutral positions      float32 [V*3]      the grid's centre shape
    grid deltas            int16   [N][V*3]   quantised, delta from neutral
    correction deltas      int16   [C][V*3]   height/proportions, same encoding

and separately, `anny-grid.idx`:

    triangle indices       uint32  [T*3]      ANNY's own face order, outward-wound

int16 rather than float32 halves the file and costs about 0.03 mm of precision
at the quantisation scale recorded in the sidecar — three orders of magnitude
below the interpolation error above, so it is not the limiting term.
"""

import argparse
import itertools
import json
import struct
import sys
from pathlib import Path

import numpy as np
import trimesh
from anny import Anny

AXES = ["gender", "age", "muscle", "weight", "height", "proportions"]

# Each axis's own number of MakeHuman stops. This is the whole trick — see the
# module docstring. Do not "simplify" these to a uniform number.
STOPS = {"gender": 2, "age": 5, "muscle": 3, "weight": 3, "height": 2, "proportions": 2}

# ⚠️ ALL SIX AXES, AS ONE TENSOR. `height` and `proportions` were first carried as
# separable additive corrections, to keep the grid at 90 points — and it was
# measured and rejected: worst-case error went from 22 mm (core only) to 116 mm
# once those two were applied that way. They interact with the core, so they get
# real dimensions. 2 x 5 x 3 x 3 x 2 x 2 = 360 points, ~30 MB quantised, which is
# the same order as `htb-ct-003.glb` (27 MB) that this app already ships.
CORE = ["gender", "age", "muscle", "weight", "height", "proportions"]
CORRECTIONS: list[str] = []


def stop_values(axis: str) -> list[float]:
    n = STOPS[axis]
    return [i / (n - 1) for i in range(n)]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="public/models/anny-grid")
    ap.add_argument(
        "--verify",
        type=int,
        default=8,
        help="random interior points to measure interpolation error at (0 to skip)",
    )
    args = ap.parse_args()

    print("loading ANNY (topology=anny, rig=anny)")
    model = Anny(topology="anny", rig="anny", local_changes="none")

    def verts(p: dict) -> np.ndarray:
        """
        ⚠️ ROTATED Z-UP -> Y-UP HERE, matching `bake.py` and every other asset in
        this repository.

        ANNY is metres and Z-up. The first version of this script stored the raw
        model output, so the grid was Z-up while the GLBs beside it were Y-up —
        which validates as a 1.67 m per-vertex disagreement and renders as a body
        lying on its back. Caught by evaluating the grid at a preset's parameters
        and diffing against the GLB baked independently from the same numbers;
        with the rotation applied the difference drops to 3 mm, which is the
        known interpolation residual rather than a frame error.

        Doing it at bake time rather than at load keeps ONE frame convention in
        the repository instead of a file that needs a correction applied by
        whoever reads it.
        """
        v = model(phenotype_kwargs=p)["vertices"][0].detach().cpu().numpy()
        # (x, y, z) -> (x, z, -y)
        return np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)

    neutral_params = {a: 0.5 for a in AXES}
    neutral = verts(neutral_params)
    n_v = neutral.shape[0]
    print(f"neutral: {n_v:,} vertices")

    # ⚠️ TOPOLOGY IS PART OF THE GRID. See the module docstring for what borrowing
    # it from the compressed GLB did instead.
    #
    # `fix_normals()` is required, not tidiness: ANNY's winding is inconsistent as
    # it comes out of the model (13,706 triangles one way against 13,714 the
    # other), which makes any signed-volume integral cancel and leaves half the
    # computed vertex normals pointing inward. It reorders FACES only, never the
    # vertex array, so the vertex-indexed grid above still lines up exactly.
    topo = trimesh.Trimesh(vertices=neutral, faces=model.faces, process=False)
    topo.fix_normals()
    faces = np.asarray(topo.faces, dtype="<u4")

    # The check that would have caught the scramble. A closed body at this scale
    # is tens of litres; a mismatched face order integrates to roughly nothing,
    # and an inverted one to the same magnitude negative.
    tv = neutral[faces]
    vol = float(np.einsum("ij,ij->i", tv[:, 0], np.cross(tv[:, 1], tv[:, 2])).sum() / 6.0)
    print(f"neutral: {len(faces):,} triangles, signed volume {vol * 1000:+.2f} L")
    if not 0.005 < vol < 0.5:
        print(
            f"  ✗ signed volume {vol * 1000:+.2f} L is not a body. Face order or winding\n"
            f"    is wrong, and the grid must not be shipped in this state.",
            file=sys.stderr,
        )
        return 1

    combos = list(itertools.product(*[stop_values(a) for a in CORE]))
    print(f"baking {len(combos)} core grid points ({' x '.join(str(STOPS[a]) for a in CORE)})")
    grid = []
    for i, c in enumerate(combos):
        p = dict(neutral_params)
        p.update(dict(zip(CORE, c)))
        grid.append(verts(p) - neutral)
        if (i + 1) % 15 == 0:
            print(f"  {i + 1}/{len(combos)}")

    print(f"baking {len(CORRECTIONS) * 2} separable corrections")
    corrections = []
    corr_meta = []
    for a in CORRECTIONS:
        for v in (0.0, 1.0):
            p = dict(neutral_params)
            p[a] = v
            corrections.append(verts(p) - neutral)
            corr_meta.append({"axis": a, "value": v})

    # One quantisation scale for everything, from the largest delta present.
    alld = np.concatenate([np.asarray(grid).ravel(), np.asarray(corrections).ravel()])
    scale = float(np.abs(alld).max()) / 32767.0
    print(f"quantisation scale: {scale:.8f} m/unit  (max delta {np.abs(alld).max():.4f} m)")

    def q(arr):
        return np.clip(np.rint(arr / scale), -32768, 32767).astype("<i2")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out.with_suffix(".bin"), "wb") as f:
        f.write(neutral.astype("<f4").tobytes())
        for g in grid:
            f.write(q(g).tobytes())
        for c in corrections:
            f.write(q(c).tobytes())

    # Its own file rather than a tail block on the `.bin`: the topology is small
    # (321 KB against 28 MB) and has a different lifetime — it changes only if
    # ANNY's mesh does, while the deltas change on any sampling edit.
    out.with_suffix(".idx").write_bytes(faces.tobytes())

    meta = {
        "vertices": int(n_v),
        "triangles": int(len(faces)),
        "axes": AXES,
        "stops": STOPS,
        "core": CORE,
        "coreCombos": [list(c) for c in combos],
        "corrections": corr_meta,
        "scale": scale,
        "package": "anny==0.6.0",
        "topology": "anny",
        "frame": "Y-up, metres, ANNY native origin (not grounded)",
        "script": "scripts/anny/bake_grid.py",
        "excluded": {
            "race": "ANNY excludes it from phenotypes=default; not an interpolable shape axis this project will ship",
            "cupsize/firmness": "body-shape controls on a body-image surface; see docs/research/FORK_PLAN.md §7",
        },
    }

    if args.verify:
        import random

        random.seed(4)

        def interp(p):
            o = np.zeros_like(neutral)
            for gi, c in enumerate(combos):
                w = 1.0
                for i, a in enumerate(CORE):
                    step = 1.0 / (STOPS[a] - 1)
                    w *= max(0.0, 1.0 - abs(p[a] - c[i]) / step)
                if w > 0:
                    o += grid[gi] * w
            for ci, cm in enumerate(corr_meta):
                v = p[cm["axis"]]
                w = (v - 0.5) / 0.5 if cm["value"] == 1.0 else (0.5 - v) / 0.5
                if w > 0:
                    o += corrections[ci] * w
            return neutral + o

        errs = []
        print(f"\nverifying against the true model at {args.verify} random points:")
        for _ in range(args.verify):
            p = {a: round(random.random(), 2) for a in AXES}
            e = np.linalg.norm(interp(p) - verts(p), axis=1) * 1000
            errs.append(float(e.max()))
            print(f"  max {e.max():6.2f} mm  mean {e.mean():5.2f}")
        meta["measuredErrorMm"] = {
            "worst": round(max(errs), 2),
            "median": round(float(np.median(errs)), 2),
            "points": args.verify,
            "note": "max vertex displacement vs the true ANNY model at random interior slider positions",
        }
        print(f"\nWORST {max(errs):.2f} mm   MEDIAN {np.median(errs):.2f} mm")

    out.with_suffix(".json").write_text(json.dumps(meta, indent=2) + "\n")
    size = out.with_suffix(".bin").stat().st_size / 1048576
    idx_kb = out.with_suffix(".idx").stat().st_size / 1024
    print(
        f"\nwrote {out.with_suffix('.bin')} ({size:.1f} MB), "
        f"{out.with_suffix('.idx')} ({idx_kb:.0f} KB) and {out.with_suffix('.json')}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
