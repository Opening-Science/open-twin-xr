#!/usr/bin/env python3
"""
Bake what the browser needs to POSE the parametric body, beside the shape grid.

The shape grid (`bake_grid.py`) lets the browser evaluate ANNY's six phenotype
axes without PyTorch. This adds the other half: the rig, so the six SHAPE sliders
can be joined by POSITION sliders that bend the arms and legs.

    scripts/anny/bake_rig.py --out public/models/anny-grid

⚠️ WHY THE POSE CANNOT JUST BE ANOTHER GRID DIMENSION. The shape grid is a full
tensor over its axes — 360 points, 28 MB. Adding even three stops of one joint
angle multiplies that by three, and there are eight joints. Posing is linear
blend skinning, which is exact and costs a weight table; sampling it would be an
approximation that costs gigabytes.

WHAT IS IN THE FILE, AND WHY EACH PIECE
---------------------------------------
  weights      per vertex, every (bone, weight) influence — see TOP_K for why
  joints       per GRID POINT, the world rest position of every driven joint
  chains       per bone, which driven joints are its ancestors

The middle one is the part that is easy to get wrong by leaving out. A joint's
position is a function of the SHAPE — a child's elbow is not where an adult's is
— so a single rest skeleton would bend a tall body at a short body's knees. The
joints interpolate on exactly the same tent basis as the vertices, so they stay
consistent with whatever shape the sliders are showing.

⚠️ THE THIRD PIECE IS WHAT MAKES THE RUNTIME CHEAP, and it is worth stating
because it looks like an odd way to express a skeleton. A slider rotates a joint
about a pivot; every bone below that joint inherits the rotation. So a bone's
skinning matrix is just the product of the pivot rotations of its driven
ancestors — no local rest frames, no per-frame forward kinematics, no
quaternion algebra in the browser. Storing the ancestor chain per bone is
storing that product's terms.

⚠️ VERTEX ORDER IS THE GRID'S, NOT A GLB'S. `npm run convert:anny` runs meshopt,
which REORDERS vertices; pairing these weights with a compressed GLB's vertices
would scramble the skinning exactly as it once scrambled the topology. This file
is written against the model's own vertex order, which is the order
`bake_grid.py` bakes and the runtime evaluates.
"""

import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np
import torch
from anny import Anny

AXES = ["gender", "age", "muscle", "weight", "height", "proportions"]
STOPS = {"gender": 2, "age": 5, "muscle": 3, "weight": 3, "height": 2, "proportions": 2}
CORE = list(AXES)

#: The joints the position sliders drive.
#:
#: ⚠️ ARMS AND LEGS ONLY, BY REVIEWED DECISION. Head, neck and spine were offered
#: and declined for this first cut: they are the most artefact-prone under linear
#: blend skinning (the neck especially, where a single ring of vertices spans a
#: large rotation) and they are not what the atlas mismatch is about.
#:
#: Each entry is (slider, joint bone, axis in the canonical Y-up frame, mirrored).
#: `mirrored` flips the sign on the right side, which is what makes "abduction"
#: mean *away from the body* on both sides rather than *towards +x* on both.
DRIVEN = [
    # shoulder abduction: swings the arm away from the trunk, in the coronal plane
    ("armAbduct", "upperarm01.L", (0.0, 0.0, 1.0), True),
    ("armAbduct", "upperarm01.R", (0.0, 0.0, 1.0), True),
    # elbow flexion: sagittal plane, so about the mediolateral axis
    ("elbow", "lowerarm01.L", (1.0, 0.0, 0.0), False),
    ("elbow", "lowerarm01.R", (1.0, 0.0, 0.0), False),
    # hip abduction: stance width
    ("hipAbduct", "upperleg01.L", (0.0, 0.0, 1.0), True),
    ("hipAbduct", "upperleg01.R", (0.0, 0.0, 1.0), True),
    # knee flexion
    ("knee", "lowerleg01.L", (1.0, 0.0, 0.0), False),
    ("knee", "lowerleg01.R", (1.0, 0.0, 0.0), False),
]

#: How far each slider may travel, in degrees, at each end.
#:
#: ⚠️ A RANGE CAP IS HONEST; A BROKEN SHOULDER IS NOT. Linear blend skinning
#: collapses the volume at a joint as the angle grows — the "candy wrapper"
#: artefact — and ANNY's weights are authored for plausible poses rather than for
#: extremes. These stop short of where that shows. The knee is one-sided because
#: a knee does not extend past straight.
LIMITS = {
    "armAbduct": (-25.0, 60.0),
    "elbow": (0.0, 110.0),
    "hipAbduct": (-10.0, 35.0),
    "knee": (0.0, 100.0),
}

#: Keep EVERY influence. ANNY's weight table is 9 wide.
#:
#: ⚠️ TRUNCATION WAS THE PLAN AND THE MEASUREMENT KILLED IT. "Top-4 influences"
#: is the standard move for real-time skinning, and here it drops up to 22 % of
#: one vertex's weight — a vertex that would then deform to somewhere the model
#: does not put it. Measured worst-case drop per K:
#:
#:     top-3  39.68 %      top-6   5.72 %
#:     top-4  21.96 %      top-7   1.53 %
#:     top-5  12.35 %      top-8   0.10 %      top-9  0.00 %  (all)
#:
#: Only the full table is exact, and the full table is 362 KB — against a 28 MB
#: shape grid sitting beside it. Approximating to save a rounding error of the
#: total download would be trading correctness for nothing.
TOP_K = 9


def stop_values(axis):
    n = STOPS[axis]
    return [i / (n - 1) for i in range(n)]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="public/models/anny-grid")
    args = ap.parse_args()

    print("loading ANNY (topology=anny, rig=anny)")
    model = Anny(topology="anny", rig="anny", local_changes="none")
    labels = list(model.bone_labels)
    parents = list(model.bone_parents)
    n_bones = model.bone_count

    # Populate the lazily-built skinning caches.
    model()

    # ---------------------------------------------------------------- weights
    w = model.vertex_bone_weights.detach().cpu().numpy()
    idx = model.vertex_bone_indices.detach().cpu().numpy()
    n_v = w.shape[0]
    print(f"skinning: {n_v:,} vertices x {w.shape[1]} influences")

    k = min(TOP_K, w.shape[1])
    order = np.argsort(-w, axis=1)[:, :k]
    kept_w = np.take_along_axis(w, order, axis=1)
    kept_i = np.take_along_axis(idx, order, axis=1)
    dropped = 1.0 - kept_w.sum(axis=1)
    print(
        f"  keeping {k} of {w.shape[1]} influences: worst vertex drops "
        f"{dropped.max() * 100:.2f}% of its weight, mean {dropped.mean() * 100:.4f}%"
    )
    # The guard stays even though the current setting keeps everything: it is what
    # catches a future narrowing of the table, which is exactly the change that
    # would look free and deform a shoulder wrongly.
    if dropped.max() > 0.05:
        print(
            "  ✗ dropping more than 5% of a vertex's weight changes how it deforms.",
            file=sys.stderr,
        )
        return 1
    kept_w = kept_w / kept_w.sum(axis=1, keepdims=True)

    # ----------------------------------------------------------------- chains
    driven_labels = []
    for _, bone, _, _ in DRIVEN:
        if bone not in labels:
            print(f"✗ unknown bone {bone!r}", file=sys.stderr)
            return 1
        if bone not in driven_labels:
            driven_labels.append(bone)
    driven_ids = [labels.index(b) for b in driven_labels]

    def ancestors(bone_i):
        out = []
        cur = bone_i
        guard = 0
        while cur is not None and cur >= 0 and guard < 200:
            out.append(cur)
            nxt = parents[cur]
            cur = nxt if isinstance(nxt, int) else None
            guard += 1
        return out

    # For each bone, the driven joints above it, ordered ROOT-most first so the
    # runtime can multiply them in the same order the skeleton composes them.
    chains = []
    for b in range(n_bones):
        chain = [driven_ids.index(a) for a in reversed(ancestors(b)) if a in driven_ids]
        chains.append(chain)
    affected = sum(1 for c in chains if c)
    print(f"rig: {len(driven_ids)} driven joints, {affected}/{n_bones} bones affected")

    # ------------------------------------------------------- joints per point
    # The world rest position of each driven joint, at every grid point, so a
    # joint sits where the CURRENT shape puts it.
    combos = list(np.array(np.meshgrid(*[stop_values(a) for a in CORE], indexing="ij")).reshape(len(CORE), -1).T)
    print(f"baking joint positions at {len(combos)} grid points")
    joints = np.zeros((len(combos), len(driven_ids), 3), dtype=np.float32)
    for gi, c in enumerate(combos):
        p = {a: float(v) for a, v in zip(CORE, c)}
        out = model(phenotype_kwargs=p)
        heads = out["rest_bone_heads"][0].detach().cpu().numpy()
        # Same Z-up -> Y-up rotation the grid and every GLB here use: (x,y,z)->(x,z,-y).
        for j, bi in enumerate(driven_ids):
            h = heads[bi]
            joints[gi, j] = (h[0], h[2], -h[1])
        if (gi + 1) % 60 == 0:
            print(f"  {gi + 1}/{len(combos)}")

    # ------------------------------------------------------------------ write
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    rig_path = out.with_suffix(".rig")
    # ⚠️ WIDEST TYPE FIRST, AND THAT IS AN ALIGNMENT REQUIREMENT RATHER THAN A
    # PREFERENCE. A JavaScript `Float32Array` view over an ArrayBuffer must start
    # at a byte offset divisible by 4, and `Uint16Array` by 2. The first version
    # of this file wrote uint8 indices, then uint16 weights, then float32 joints —
    # which put the joints at byte 370,386, not a multiple of 4, and every load
    # threw a RangeError in the browser. Writing float32 first, then uint16, then
    # uint8 makes every offset legal by construction whatever the vertex count.
    with open(rig_path, "wb") as f:
        # joints: float32 [grid][joint][3]
        f.write(joints.astype("<f4").tobytes())
        # weights: uint16 (0..65535), then uint8 bone indices (n_bones <= 255)
        f.write(np.rint(kept_w * 65535).clip(0, 65535).astype("<u2").tobytes())
        f.write(kept_i.astype("<u1").tobytes())

    meta = {
        "vertices": int(n_v),
        "bones": int(n_bones),
        "influences": int(k),
        "drivenJoints": driven_labels,
        "sliders": sorted({s for s, _, _, _ in DRIVEN}),
        "limitsDeg": LIMITS,
        # Per driven joint: its axis and whether the right side mirrors.
        "jointAxes": [
            {
                "bone": bone,
                "slider": slider,
                "axis": list(axis),
                "mirrored": mirrored,
                "side": "R" if bone.endswith(".R") else "L",
            }
            for slider, bone, axis, mirrored in DRIVEN
        ],
        "chains": chains,
        "gridPoints": len(combos),
        "weightDropWorst": round(float(dropped.max()), 6),
        "package": "anny==0.6.0",
        "frame": "Y-up, metres, ANNY native origin — same as anny-grid.bin",
        "script": "scripts/anny/bake_rig.py",
        "layout": [
            f"uint8  [{n_v}][{k}]  bone indices",
            f"uint16 [{n_v}][{k}]  weights, /65535",
            f"float32[{len(combos)}][{len(driven_ids)}][3]  driven joint positions",
        ],
    }
    meta_path = out.parent / (out.name + "-rig.json")
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")

    kb = rig_path.stat().st_size / 1024
    print(f"\nwrote {rig_path} ({kb:.0f} KB)")
    print(f"wrote {meta_path}")
    print("\nNext:  npm run dev — the position sliders appear in the parametric mode")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
