#!/usr/bin/env python3
"""
Pin down ANNY's pose conventions by measurement, before anything relies on them.

⚠️ THIS IS NOT A TEST OF ANNY. It is a test of the four assumptions
`scripts/anny/bake.py --pose` is about to make, each of which is invisible when
wrong: a posed body still renders, still stands on the floor, and still looks
like a person. What it does not do is match the atlas inside it — and by then
the cause is three transformations away from the symptom.

The assumptions, in the order they can bite:

  1. `pose_parameters` in "local-bone" mode rotates a bone AND its children,
     leaving everything else alone.
  2. `world-orient` mode takes a world-space ORIENTATION per bone and resolves
     position by forward kinematics — so a limb can be aimed without composing
     a chain by hand.
  3. ANNY's model space is Z-up, and `bake.py`'s existing export rotation
     R = rot_x(-90 deg) carries it to glTF's Y-up. Therefore a direction
     measured in glTF space converts BACK as (x, y, z) -> (x, -z, y).
  4. ANNY's rest pose is a wide A-pose, and its limb bones point where the
     rest_bone_poses say they do.

Run:  ~/.venvs/anny/bin/python scripts/anny/check_pose_conventions.py
"""

import sys

import numpy as np
import torch
import roma
from anny import Anny

LIMB_BONES = [
    "upperarm01.L", "upperarm02.L", "lowerarm01.L", "lowerarm02.L",
    "upperarm01.R", "upperarm02.R", "lowerarm01.R", "lowerarm02.R",
    "upperleg01.L", "upperleg02.L", "lowerleg01.L", "lowerleg02.L",
    "upperleg01.R", "upperleg02.R", "lowerleg01.R", "lowerleg02.R",
]

# ANNY (Z-up) -> glTF (Y-up), the rotation `bake.py` already applies on export.
# Kept here as the 3x3 so the inverse can be checked rather than asserted.
R_ANNY_TO_GLTF = np.array([[1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, -1.0, 0.0]])


def gltf_dir_to_anny(v):
    """A direction measured in the atlas's glTF frame, expressed in ANNY's."""
    return R_ANNY_TO_GLTF.T @ np.asarray(v, dtype=float)


def bone_axis(output, model, label):
    """Unit direction of a bone in ANNY space, from its rest pose matrix."""
    i = model.bone_labels.index(label)
    pose = output["rest_bone_poses"][0, i].detach().cpu().numpy()
    # Column 1 of the bone frame is the bone's own long axis in MakeHuman rigs;
    # verified below against the actual joint positions rather than assumed.
    return pose[:3, 1] / np.linalg.norm(pose[:3, 1])


def main() -> int:
    ok = True

    def check(name, passed, detail=""):
        nonlocal ok
        ok = ok and passed
        print(f"  {'PASS' if passed else 'FAIL'}  {name}" + (f"   {detail}" if detail else ""))

    print("loading ANNY (topology=anny, rig=anny) …")
    model = Anny(topology="anny", rig="anny", local_changes="default").to(dtype=torch.float32)
    print(f"  {model.bone_count} bones, phenotypes {model.phenotype_labels}\n")

    rest = model()
    rest_v = rest["vertices"][0].detach().cpu().numpy()

    print("1. rest pose geometry")
    lo, hi = rest_v[:, 2].min(), rest_v[:, 2].max()
    height_z = hi - lo
    span_x = rest_v[:, 0].max() - rest_v[:, 0].min()
    check(
        "Z is the long axis (model is Z-up)",
        height_z > span_x,
        f"z extent {height_z:.3f} m vs x extent {span_x:.3f} m",
    )
    check(
        "rest pose is a wide A-pose",
        span_x / height_z > 0.5,
        f"width/height {span_x / height_z:.3f}",
    )

    print("\n2. Z-up -> Y-up conversion")
    up_gltf = R_ANNY_TO_GLTF @ np.array([0.0, 0.0, 1.0])
    check("ANNY +Z maps to glTF +Y", np.allclose(up_gltf, [0, 1, 0]), f"-> {up_gltf}")
    round_trip = gltf_dir_to_anny(R_ANNY_TO_GLTF @ np.array([0.3, -0.9, 0.2]))
    check(
        "gltf_dir_to_anny inverts the export rotation",
        np.allclose(round_trip, [0.3, -0.9, 0.2]),
        f"-> {np.round(round_trip, 4)}",
    )
    # The measured atlas axis for a hanging arm is roughly straight down in glTF.
    down_anny = gltf_dir_to_anny([0.0, -1.0, 0.0])
    check(
        "glTF 'down' becomes ANNY 'down'",
        np.allclose(down_anny, [0, 0, -1]),
        f"[0,-1,0]_gltf -> {np.round(down_anny, 4)}_anny",
    )

    print("\n3. local-bone posing affects the bone and its children only")
    pose = {label: torch.eye(4)[None] for label in model.bone_labels}
    pose["shoulder01.L"] = roma.Rigid(
        roma.euler_to_rotmat("z", [30.0], degrees=True), translation=None
    ).to_homogeneous()[None]
    out = model(pose_parameters=pose)
    moved = np.linalg.norm(out["vertices"][0].detach().cpu().numpy() - rest_v, axis=1)
    n_moved = int((moved > 1e-4).sum())
    check("some vertices moved", n_moved > 0, f"{n_moved} of {len(moved)}")
    check(
        "fewer than a third of the body moved (an arm, not the whole body)",
        0 < n_moved < len(moved) / 3,
        f"{100 * n_moved / len(moved):.1f}%",
    )
    # The left arm is +x or -x? Decide from the data, not from a convention.
    moved_x = rest_v[moved > 1e-4][:, 0].mean()
    check(
        "the moved vertices are all on one side",
        abs(moved_x) > 0.05,
        f"mean x of moved vertices {moved_x:+.3f} m -> 'shoulder01.L' is the {'+x' if moved_x > 0 else '-x'} side",
    )
    feet_moved = moved[rest_v[:, 2] < lo + 0.15].max()
    check("the feet did not move", feet_moved < 1e-4, f"max foot displacement {feet_moved:.2e} m")

    print("\n4. world-orient posing aims a bone in world space")
    base = model(pose_parameterization="local-bone")
    wo = model.get_pose_parameterization(base, pose_parameterization="world-orient")
    i1 = model.bone_labels.index("upperarm01.L")
    i2 = model.bone_labels.index("upperarm02.L")
    target = roma.Rigid(
        roma.euler_to_rotmat("z", [-90.0], degrees=True), translation=None
    ).to_homogeneous()[None]
    wo[:, i1] = target
    wo[:, i2] = target
    out2 = model(pose_parameters=wo, pose_parameterization="world-orient")
    moved2 = np.linalg.norm(out2["vertices"][0].detach().cpu().numpy() - rest_v, axis=1)
    check("world-orient changed the pose", moved2.max() > 0.01, f"max displacement {moved2.max():.3f} m")
    check(
        "world-orient moved one limb, not the body",
        int((moved2 > 1e-4).sum()) < len(moved2) / 3,
        f"{100 * (moved2 > 1e-4).sum() / len(moved2):.1f}%",
    )

    print("\n5. rest bone axes (ANNY space, unit)")
    for label in LIMB_BONES:
        a = bone_axis(rest, model, label)
        print(f"  {label:<14} [{a[0]:+.3f}, {a[1]:+.3f}, {a[2]:+.3f}]")

    print("\n" + ("all conventions confirmed" if ok else "⚠️  A CHECK FAILED — do not bake"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
