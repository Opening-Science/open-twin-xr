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
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import trimesh
from anny import Anny

# ---------------------------------------------------------------------------
# POSING — matching the envelope to the atlas it is drawn around
# ---------------------------------------------------------------------------
#
# D16 measured that the envelope encloses the torso and NOT the limbs, and that
# the difference is ANGULAR: ANNY rests in a wide A-pose (measured width/height
# 0.642) while Z-Anatomy stands with its arms at its sides (0.393). No uniform
# scale closes an angle, which is why D16 recorded the gap as unfixable "without
# rigging the envelope and posing it per atlas".
#
# That is what `--pose` does. `scripts/anny/measure_atlas_pose.mjs` measures each
# atlas's limb axes from its own bone geometry and writes `atlas-poses.json`;
# this reads that file and aims ANNY's bones along the same directions.
#
# ⚠️ THE POSE SPEC IS A GENERATED FILE. Never hand-edit it, and never type an
# axis into this script. D18's rule, for D18's reason: a hand-typed vector in a
# generated document is invisible when it goes stale, and a mis-posed body looks
# exactly like a correctly posed one.
#
# ⚠️ CONVENTIONS ARE CHECKED, NOT ASSUMED. Four of them matter here and every one
# is silent when wrong. `scripts/anny/check_pose_conventions.py` measures all
# four against the installed package; run it if anything below is touched:
#
#   - ANNY is Z-up, glTF is Y-up, and the export rotation below is what converts
#     between them. A direction measured in glTF converts BACK as (x,y,z)->(x,-z,y).
#   - `world-orient` takes a world-space orientation per bone and resolves
#     position by forward kinematics, so a limb can be aimed without composing a
#     chain by hand.
#   - column 1 of a bone's rest frame is its long axis.
#   - ⚠️ ANNY's `.L` bones are the +x side, and so is anatomical left in every
#     atlas here (measured two ways in the measurement script). The sides
#     therefore need NO flip — but a mirrored body is entirely plausible-looking,
#     so this is stated rather than left to be rediscovered.

#: ANNY (Z-up) -> glTF (Y-up). The same rotation applied at export, as a 3x3.
R_ANNY_TO_GLTF = np.array([[1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, -1.0, 0.0]])

#: Below this, a bone is left in its rest pose. Matches the measurement script's
#: threshold for calling two atlas poses the same: a difference too small to be
#: worth a separate asset is too small to be worth driving a bone for.
MIN_DRIVE_DEG = 5.0


def gltf_dir_to_anny(v):
    """A direction measured in an atlas's glTF frame, expressed in ANNY's."""
    v = np.asarray(v, dtype=float)
    return R_ANNY_TO_GLTF.T @ v


def minimal_rotation(a, b):
    """
    The rotation matrix taking unit vector `a` onto unit vector `b`.

    ⚠️ ROLL ABOUT THE LIMB AXIS IS UNCONSTRAINED, DELIBERATELY. An atlas bone
    gives a DIRECTION, not a frame — a humerus says where the arm points, not
    how the elbow is twisted about it. The minimal (geodesic) rotation is the
    honest reading of that: it changes nothing it was not told about. The cost
    is that a hand may sit at an odd roll; the alternative is inventing a twist
    the measurement never contained.
    """
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    s = float(np.linalg.norm(v))
    if s < 1e-9:
        # Parallel, or antiparallel. Antiparallel has no minimal rotation — any
        # axis perpendicular to `a` does — so pick one deterministically rather
        # than returning a matrix with a NaN in it.
        if c > 0:
            return np.eye(3)
        axis = np.array([1.0, 0.0, 0.0])
        if abs(a[0]) > 0.9:
            axis = np.array([0.0, 1.0, 0.0])
        axis = np.cross(a, axis)
        axis /= np.linalg.norm(axis)
        x, y, z = axis
        K = np.array([[0, -z, y], [z, 0, -x], [-y, x, 0]])
        return np.eye(3) + 2 * K @ K  # 180 degrees about `axis`
    x, y, z = v
    K = np.array([[0, -z, y], [z, 0, -x], [-y, x, 0]])
    return np.eye(3) + K + K @ K * ((1 - c) / (s * s))


def load_pose_spec(path, pose_id):
    """Read one pose out of the generated spec, or fail loudly."""
    spec = json.loads(Path(path).read_text())
    poses = spec.get("poses", {})
    if pose_id not in poses:
        raise SystemExit(
            f"unknown pose '{pose_id}'. The spec defines: {', '.join(sorted(poses))}\n"
            f"Re-run `node scripts/anny/measure_atlas_pose.mjs` if it looks stale."
        )
    digest = hashlib.sha256(Path(path).read_bytes()).hexdigest()[:12]
    return spec, poses[pose_id], digest


def build_pose_parameters(model, torch, roma, pose, verbose=True):
    """
    Aim ANNY's limb bones along the atlas's measured axes.

    Returns `(pose_parameters, driven)` where `driven` records, per bone, the
    angle it was actually rotated through — the number that goes into the
    provenance file and proves the pose did something.
    """
    rest = model()
    world_orient = model.get_pose_parameterization(rest, pose_parameterization="world-orient")
    rest_poses = rest["rest_bone_poses"][0].detach().cpu().numpy()

    driven = {}
    for seg_key, seg in pose["segments"].items():
        source = seg.get("source")
        if source not in ("measured", "default"):
            # `absent`, `fragment`, `untrusted`, `unoriented` — the measurement
            # script has already decided these carry no usable direction. A bone
            # with no target stays in the rest pose rather than being guessed.
            if verbose:
                print(f"    {seg_key:<12} skipped ({source})")
            continue
        target_anny = gltf_dir_to_anny(seg["axis"])
        target_anny /= np.linalg.norm(target_anny)
        for bone in seg["bones"]:
            i = model.bone_labels.index(bone)
            rest_R = rest_poses[i][:3, :3]
            rest_axis = rest_R[:, 1] / np.linalg.norm(rest_R[:, 1])
            deg = float(np.degrees(np.arccos(np.clip(np.dot(rest_axis, target_anny), -1, 1))))
            if deg < MIN_DRIVE_DEG:
                if verbose:
                    print(f"    {bone:<14} {deg:5.1f} deg  — below {MIN_DRIVE_DEG} deg, left at rest")
                continue
            R = minimal_rotation(rest_axis, target_anny) @ rest_R
            M = np.eye(4)
            M[:3, :3] = R
            world_orient[0, i] = torch.tensor(M, dtype=world_orient.dtype)
            driven[bone] = {"deg": round(deg, 2), "from": seg_key, "source": source}
            if verbose:
                print(f"    {bone:<14} {deg:5.1f} deg  ({source})")
    return world_orient, driven

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
    ap.add_argument(
        "--pose",
        default=None,
        help=(
            "pose id from scripts/anny/atlas-poses.json — bakes <preset>.pose-<id>. "
            "Omit for the rest-pose bake."
        ),
    )
    ap.add_argument(
        "--pose-spec",
        default=str(Path(__file__).with_name("atlas-poses.json")),
        help="the generated pose spec to read (default: beside this script)",
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

    pose_spec = pose_entry = spec_digest = None
    if args.pose:
        pose_spec, pose_entry, spec_digest = load_pose_spec(args.pose_spec, args.pose)
        covers = ", ".join(pose_entry.get("members", []))
        print(f"pose '{args.pose}' from {args.pose_spec} (sha256 {spec_digest})")
        print(f"  covers: {covers}")

    print("loading ANNY (topology=anny, rig=anny, local_changes=default)")
    model = Anny(topology="anny", rig="anny", local_changes="default")

    pose_parameters = None
    driven = {}
    if args.pose:
        # Imported here rather than at module scope: the rest-pose bake needs
        # neither, and this script is run in environments where `roma` may be
        # absent while `anny` is not.
        import torch
        import roma  # noqa: F401  (roma is what supplies ANNY's rigid helpers)

        print("building pose parameters (world-orient):")
        pose_parameters, driven = build_pose_parameters(model, torch, roma, pose_entry)
        if not driven:
            raise SystemExit(
                f"pose '{args.pose}' drove no bones at all — every segment was within "
                f"{MIN_DRIVE_DEG} deg of the rest pose. That is the rest-pose bake; "
                f"do not ship a duplicate of it under a pose name."
            )

    # ANNY is metres and Z-up; glTF is Y-up. Skipping this gives a body lying on
    # its back. The bundled ANNY demo applies the same rotation before its own
    # GLB export, for the same reason.
    R = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])

    provenance = {}
    for name in names:
        kwargs = PRESETS[name]
        if pose_parameters is not None:
            out = model(
                pose_parameters=pose_parameters,
                pose_parameterization="world-orient",
                **kwargs,
            )
        else:
            out = model(**kwargs)

        verts = out["vertices"][0].detach().cpu().numpy()
        # `process=False` matters: trimesh merges vertices by default, which
        # silently changes the vertex count and breaks any later assumption that
        # indices line up with ANNY's own.
        mesh = trimesh.Trimesh(vertices=verts, faces=model.faces, process=False)

        # ⚠️ ANNY'S TRIANGLE WINDING IS INCONSISTENT AS IT COMES OUT OF THE MODEL.
        # Measured on the shipped mesh: 13,706 triangles wound one way and 13,714
        # the other, on a topologically CLOSED manifold (0 boundary edges,
        # E = 3F/2 exactly). Two consequences, and neither is obvious:
        #
        #   - `computeVertexNormals()` averages face normals, so half of them
        #     point inward and the shading is subtly wrong rather than visibly
        #     broken.
        #   - any signed-volume integral cancels to nothing. The parametric
        #     body's volume read 0.43 L instead of ~50 L, and mass and BMI with it.
        #
        # `fix_normals()` flips windings to agree and orients them outward. It
        # reorders FACE indices only, never the vertex array, so the shape grid in
        # `bake_grid.py` — which is indexed by vertex — still lines up exactly.
        #
        # ⚠️ `npm run check:winding` does NOT catch this. That script compares -x
        # against +x, which is a left/right symmetry test, not an orientation one.
        mesh.fix_normals()

        mesh.apply_transform(R)

        lo, hi = mesh.bounds[0][1], mesh.bounds[1][1]
        height = float(hi - lo)
        # The across-the-arms extent, which is what D16 measured the mismatch in
        # and therefore what a posed bake has to be judged on.
        span_x = float(mesh.bounds[1][0] - mesh.bounds[0][0])
        # Ground the feet at y=0, matching the canonical frame every atlas in this
        # repository is normalised into (y=0 at the feet, centred in x and z).
        mesh.apply_translation([0.0, -lo, 0.0])

        suffix = f".pose-{args.pose}" if args.pose else ""
        path = out_dir / f"anny-{name}{suffix}.raw.glb"
        mesh.export(path)
        size_kb = path.stat().st_size / 1024
        print(
            f"  {name:<9} {len(mesh.vertices):>6,} verts  "
            f"{len(mesh.faces):>6,} tris  height {height:.3f} m  "
            f"span {span_x:.3f} m  {size_kb:.0f} KB"
        )

        entry = {
            "package": "anny==0.6.0",
            "topology": "anny",
            "rig": "anny",
            "local_changes": "default",
            "parameters": kwargs,
            "height_m": round(height, 4),
            "span_x_m": round(span_x, 4),
            "vertices": int(len(mesh.vertices)),
            "triangles": int(len(mesh.faces)),
            "script": "scripts/anny/bake.py",
        }
        if args.pose:
            # ⚠️ The pose is part of what this asset IS, so it is recorded with
            # the same weight as the phenotype parameters — including the spec's
            # hash, so a bake can be tied to the exact measurement that produced
            # it rather than to whatever the spec says today.
            entry["pose"] = {
                "id": args.pose,
                "spec": args.pose_spec,
                "spec_sha256_12": spec_digest,
                "covers": pose_entry.get("members", []),
                "measured_from": pose_entry.get("measuredFrom"),
                "driven_bones": driven,
            }
        provenance[f"{name}{suffix}"] = entry

    # An asset nobody can regenerate is worse than no asset. This is the record
    # that makes the bake reproducible, and `src/scene/bodyEnvelopes.ts` cites it.
    #
    # ⚠️ MERGED, NOT OVERWRITTEN. A `--pose` run bakes a subset of the assets in
    # `public/models`, and a plain write would delete the provenance of every
    # asset it did not itself produce — leaving files on disk that nothing can
    # account for. That is precisely the state this file exists to prevent.
    manifest = out_dir / "anny-provenance.json"
    existing = {}
    if manifest.exists():
        try:
            existing = json.loads(manifest.read_text())
        except json.JSONDecodeError:
            print(f"  ⚠️  {manifest} is not readable JSON; it will be replaced")
    existing.update(provenance)
    manifest.write_text(json.dumps(existing, indent=2) + "\n")
    print(f"\nwrote {manifest} ({len(provenance)} entr{'y' if len(provenance) == 1 else 'ies'} "
          f"updated, {len(existing)} total)")

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

    if args.pose:
        print(
            f"\nposed bake: {len(driven)} bones driven, "
            f"{max(d['deg'] for d in driven.values()):.1f} deg worst rotation"
        )
        print(f"Next:  npm run convert:anny:posed -- {args.pose}")
    else:
        print("\nNext:  npm run convert:anny")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
