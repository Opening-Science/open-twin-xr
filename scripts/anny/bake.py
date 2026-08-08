#!/usr/bin/env python3
"""
Bake ANNY phenotype presets to GLB body envelopes.

ANNY is a parametric human body model from NAVER LABS Europe. It produces a SKIN
SURFACE and a skeleton, and it contains NO ORGANS — it is the exact complement of
the seven organ atlases this repository already registers, not a replacement for
any of them. See `docs/DECISIONS.md` D16 for why it is registered separately from
`ANATOMY_SOURCES` rather than as an eighth atlas.

WHAT THIS IS FOR
----------------
D14 recorded that the glass hull is unavailable on three of the selectable
sources — `z-anatomy`, `z-anatomy-regions` and both CT atlases — because they
ship no integumentary geometry at all. So the best anatomy in the repository is
exactly where the best-looking hull is impossible. A parametric body is a skin
generator, which closes that gap without touching any atlas.

    scripts/anny/bake.py --out public/models

Then `npm run convert:anny`.

LICENCE — THREE BUCKETS IN ONE PACKAGE, AND THE REGISTRY NEEDS ALL THREE
-----------------------------------------------------------------------
  code                  Apache-2.0    "Anny, Copyright (C) 2025 NAVER Corporation"
  src/anny/data/mpfb2/  CC0-1.0       the MakeHuman-derived shape assets
  data/soma/            Apache-2.0    adapted from NVlabs SOMA-X

The bodies this script writes derive from the CC0 bucket, and the attribution
obligation that travels with them is Apache-2.0 notice retention on the code plus
the citation. Both are recorded in `licences.json` and rendered in-app.

⚠️ NEVER PASS topology="smpl" OR topology="smplx".
Both trigger a RUNTIME download of `noncommercial.zip` from
download.europe.naverlabs.com inside `download_noncommercial_data()`
(`anny/paths.py`), which unpacks its own non-commercial LICENSE.txt. Because it
happens at runtime rather than at install time, a dependency audit does not catch
it. `anny` and `notoes_collapse5pc` are the safe topologies; this script hardcodes
`anny` and takes no topology argument, so the trap cannot be walked into by
passing a flag.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import trimesh
from anny import Anny

# Phenotype macros are floats 0..1, all defaulting to 0.5:
#   gender, age, muscle, weight, height, proportions
#
# ⚠️ TWO CORRECTIONS TO THE PRESET TABLE IN `docs/research/MODEL_INTEGRATION.md`,
# both measured rather than reasoned, and both of which would have shipped a body
# labelled as something it is not.
#
# 1. `gender` RUNS MALE TO FEMALE, NOT FEMALE TO MALE. The source document has
#    `adult-f` at 0.0 and `adult-m` at 1.0, which is inverted — so the file named
#    for a woman contained a man, and vice versa. Three independent confirmations:
#      - `PHENOTYPE_VARIATIONS` in `anny/models/model_data.py` declares
#        `gender=["male", "female"]`, and the scalar interpolates that ORDERED list
#      - `shape_distribution.py:269` splits with
#        `torch.where(gender <= 0.5, boys_height, girls_height)`
#      - measured stature falls monotonically 1.697 m -> 1.560 m as gender goes
#        0 -> 1, at a fixed age
#    The consequence the document did not notice: its `pregnant` preset is
#    `gender: 0.0`, which under the real mapping is a MALE body.
#
# 2. `age: 0.5` IS AN ADOLESCENT, NOT AN ADULT. ANNY's five age stops
#    (`newborn, baby, child, young, old`) are spaced UNIFORMLY over 0..1, unlike
#    MakeHuman's macro where 0.5 means 25 years. Measured at neutral gender:
#
#        age  0.00  0.674 m     age  0.60  1.752 m
#        age  0.15  1.002 m     age  0.75  1.831 m   <- "young", the adult stop
#        age  0.25  1.227 m     age  0.90  1.819 m
#        age  0.40  1.499 m     age  1.00  1.812 m   <- "old"
#        age  0.50  1.625 m
#
#    Height climbs to a plateau at 0.75 and then declines slightly, which is the
#    signature of growth followed by age-related stature loss. So the adult
#    presets sit at 0.75 and the elder at 1.0.
#
# Absolute stature is recorded but not fitted to here: the runtime normalises the
# envelope to the same canonical 1.7 m frame every atlas is scaled into, so what
# these presets contribute is PROPORTION, not height. See `src/scene/bodyEnvelopes.ts`.
PRESETS = {
    "adult-m": dict(phenotype_kwargs={"gender": 0.0, "age": 0.75}),
    "adult-f": dict(phenotype_kwargs={"gender": 1.0, "age": 0.75}),
    "child": dict(phenotype_kwargs={"gender": 0.5, "age": 0.25}),
    "elder": dict(phenotype_kwargs={"gender": 0.5, "age": 1.0}),
    # Pregnancy is a LOCAL CHANGE target, not a phenotype macro, so it needs the
    # constructor's `local_changes="default"` below (254 MakeHuman targets). With
    # the constructor default of "none" this silently produces a non-pregnant body.
    # `gender: 1.0` is female — see correction 1 above.
    "pregnant": dict(
        phenotype_kwargs={"gender": 1.0, "age": 0.75},
        local_changes_kwargs={"stomach-pregnant-incr": 1.0},
    ),
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="public/models", help="output directory")
    ap.add_argument(
        "--only",
        default=None,
        help="comma-separated preset names, default all five",
    )
    args = ap.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    names = (
        [n.strip() for n in args.only.split(",")] if args.only else list(PRESETS)
    )
    unknown = [n for n in names if n not in PRESETS]
    if unknown:
        print(f"unknown preset(s): {', '.join(unknown)}", file=sys.stderr)
        return 1

    print("loading ANNY (topology=anny, rig=anny, local_changes=default)")
    model = Anny(topology="anny", rig="anny", local_changes="default")

    # ANNY is metres and Z-up; glTF is Y-up. Skipping this gives a body lying on
    # its back. The bundled ANNY demo applies the same rotation before its own
    # GLB export, for the same reason.
    R = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])

    provenance = {}
    for name in names:
        kwargs = PRESETS[name]
        out = model(**kwargs)

        verts = out["vertices"][0].detach().cpu().numpy()
        # `process=False` matters: trimesh merges vertices by default, which
        # silently changes the vertex count and breaks any later assumption that
        # indices line up with ANNY's own.
        mesh = trimesh.Trimesh(vertices=verts, faces=model.faces, process=False)
        mesh.apply_transform(R)

        lo, hi = mesh.bounds[0][1], mesh.bounds[1][1]
        height = float(hi - lo)
        # Ground the feet at y=0, matching the canonical frame every atlas in this
        # repository is normalised into (y=0 at the feet, centred in x and z).
        mesh.apply_translation([0.0, -lo, 0.0])

        path = out_dir / f"anny-{name}.raw.glb"
        mesh.export(path)
        size_kb = path.stat().st_size / 1024
        print(
            f"  {name:<9} {len(mesh.vertices):>6,} verts  "
            f"{len(mesh.faces):>6,} tris  height {height:.3f} m  {size_kb:.0f} KB"
        )

        provenance[name] = {
            "package": "anny==0.6.0",
            "topology": "anny",
            "rig": "anny",
            "local_changes": "default",
            "parameters": kwargs,
            "height_m": round(height, 4),
            "vertices": int(len(mesh.vertices)),
            "triangles": int(len(mesh.faces)),
            "script": "scripts/anny/bake.py",
        }

    # An asset nobody can regenerate is worse than no asset. This is the record
    # that makes the bake reproducible, and `src/scene/bodyEnvelopes.ts` cites it.
    manifest = out_dir / "anny-provenance.json"
    manifest.write_text(json.dumps(provenance, indent=2) + "\n")
    print(f"\nwrote {manifest}")

    heights = {n: p["height_m"] for n, p in provenance.items()}
    spread = max(heights.values()) - min(heights.values())
    print(f"height spread across presets: {spread:.3f} m")
    if len(heights) > 1 and spread < 0.05:
        # Not a hard failure — a --only run of two adults legitimately has no
        # spread — but it is the one check that proves the age axis is live.
        print(
            "  ⚠️  presets are all within 5 cm of each other. If this run included\n"
            "     `child` or `elder`, the `age` parameter is NOT reaching the model."
        )

    print("\nNext:  npm run convert:anny")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
