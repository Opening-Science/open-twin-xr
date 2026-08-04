#!/usr/bin/env python
r"""
Multi-label NIfTI (MOOSE segmentation) -> one GLB, one named node per structure.

    .venv/bin/python labelmap2glb.py \
        --seg out/clin_CT_organs_segmentation_ct.nii.gz \
        --seg out/clin_CT_ribs_segmentation_ct.nii.gz \
        --out public/models/ct-atlas-f.glb \
        --target-triangles 380000

Everything below that looks like an arbitrary choice is a correction to a
specific, known-expensive failure. Read the reasons before changing them.


1. WHY vtkSurfaceNets3D AND NOT MARCHING CUBES
----------------------------------------------
SurfaceNets3D meshes *every* label in one pass and emits ONE polygon per
inter-organ interface, tagged with the pair of labels it separates. So adjacent
organs share their boundary exactly: liver and right kidney cannot gap and
cannot interpenetrate, because there is only one surface between them and both
structures reference it. Marching cubes run per label produces two independent
surfaces that agree only to within the contouring tolerance.

The corollary is a rule that is easy to break by accident: **do not smooth each
label separately.** Gaussian-smoothing label A and label B and contouring each
at 0.5 pulls both surfaces back from the interface they used to share — gaps at
concave interfaces, interpenetration at convex ones. All smoothing here happens
inside the SurfaceNets filter, on the shared net, before anything is split.


2. THE BoundaryLabels CONVENTION, AND WHY HALF THE ORGANS WOULD BE INSIDE-OUT
-----------------------------------------------------------------------------
The output carries a 2-component cell array `BoundaryLabels`, and the winding of
each polygon faces **out of `BoundaryLabels[0]` and into `BoundaryLabels[1]`**.
So for a structure L:

  cells where BoundaryLabels[:,0] == L  -> already outward, keep winding
  cells where BoundaryLabels[:,1] == L  -> inward, REVERSE winding

Get that backwards and roughly half of each organ renders inside-out — which,
with backface culling and a lit material, looks like holes rather than like an
error.

⚠️ **Do not assume the pair is sorted ascending.** Measured on VTK 9.6.2, the
background label goes SECOND regardless of value — the pairs emitted for the
neck test were `(12, 0)`, `(13, 0)`, `(19, 0)` for the label-vs-background
surfaces, and `(17, 18)`, `(18, 19)` for the label-vs-label ones. So a
structure's outer surface lands almost entirely in component 0, and component 1
holds only the faces it shares with a *higher-numbered* neighbour. Reading only
one component gets most organs right and quietly loses every shared interface.

`_extract_label()` handles both and it is proved rather than assumed: a closed
mesh with consistent outward winding has POSITIVE signed volume, and every
structure's mesh volume is compared against the voxel count it came from. The
thyroid lobes are the case that exercises the label-vs-label half — 17 comes out
of component 0 and 18 out of component 1 — and both land within 4 % of their
label volume.


3. THE COORDINATE TRANSFORM, AND THE MIRROR TRAP
------------------------------------------------
Three frames, composed into one 4x4:

  scaled-index -> RAS mm      A . diag(1/s, 1)     s = voxel sizes
  RAS mm       -> glTF m      (x, y, z) -> (-x, z, y) * 0.001

The second is the one people get wrong. The naive axis swap (x, y, z) -> (x, z, y)
has determinant -1 and **silently mirrors the body**: liver on the left, heart
apex on the right, everything else still perfectly plausible. Negating X gives
determinant +1, winding and normals preserved, no flip needed.

But the NIfTI affine has its own handedness and it is NOT always positive.
Measured on the ENHANCE.PET CTs used to develop this script: axcodes ('L','A','S'),
**det = -2.861**. That grid is left-handed relative to RAS, so the composed
transform has negative determinant and the winding of every triangle must be
reversed. This is not a hypothetical — it is the normal case for clinical CT.
`_transform()` computes det of the *composed* matrix and reverses when negative,
and `verify()` — which runs by default; `--no-verify` turns it off — independently
confirms the result with the signed-volume test and
with a laterality assertion against MOOSE's own left/right class labels.


4. NODE NAMES ARE ONTOLOGY IDS, NEVER LABEL INTEGERS
-----------------------------------------------------
nnU-Net label integers are an artefact of how a model was trained and get
renumbered on retraining; the class NAMES are stable and the UBERON term is
stabler still. So a node is `UBERON_0002107`, and where UBERON has no lateral
term (femur, rib, scapula, hip bone) it is `UBERON_0000981.left`.

**The separator is a dot on purpose.** AtlasBody's CURIE regex is
`\b(UBERON|FMA|CL|ASCTB)[:_]?(\d+)\b`, and `\b` after the digits needs a
NON-word character. `UBERON_0000981_left` does not match at all — underscore is
a word character — so the term would silently fail to resolve and the structure
would render as unassigned grey. `UBERON_0000981.left` parses correctly.
The unambiguous CURIE also always travels in `extras.ontologyid`, which
AtlasBody reads first.


5. THE extras CONTRACT
-----------------------
Matches what `src/scene/AtlasBody.tsx` and `src/scene/anatomySources.ts` already
read for BodyParts3D (written by `scripts/build-bodyparts3d.mjs`):

    ontologyid  CURIE, e.g. "UBERON:0002107"   (AtlasBody.readTerm)
    label       human-readable                 (AtlasBody, credits, tooltips)
    system      one of the 9 SystemIds         (anatomySources.groupKey)
    layer       organ | connective | muscle | bone

plus two of our own, which nothing reads but every debugging session wants:

    moose_class the MOOSE class name, the only key that survives a retrain
    side        left | right, because ontologyid alone cannot say which femur
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import nibabel as nib
import numpy as np
import vtk
from vtk.util import numpy_support as vtknp

REPO = Path(__file__).resolve().parents[2]
DEFAULT_CROSSWALK = REPO / "docs" / "moose-uberon-crosswalk.tsv"

# RAS millimetres -> glTF metres. (x, y, z) -> (-x, z, y) * 0.001.
# det = +1 before the uniform 0.001 scale; see the module docstring.
RAS_TO_GLTF = np.array(
    [
        [-0.001, 0.0, 0.0, 0.0],
        [0.0, 0.0, 0.001, 0.0],
        [0.0, 0.001, 0.0, 0.0],
        [0.0, 0.0, 0.0, 1.0],
    ]
)

# MOOSE writes `clin_CT_<region>_segmentation_<stem>.nii.gz`.
_SEG_RE = re.compile(r"^(clin|preclin)_(CT|PT|MR)_(?P<region>.+?)_segmentation_", re.I)

# A PYTHON MIRROR OF THE REGEX IN src/scene/AtlasBody.tsx (`CURIE`). Kept here so
# that a change to the node-naming convention fails the build instead of quietly
# producing an atlas whose structures all render as unresolved grey. If the two
# ever drift, this is the copy that is wrong.
_ATLASBODY_CURIE = re.compile(r"\b(UBERON|FMA|CL|ASCTB)[:_]?(\d+)\b", re.I)


# --------------------------------------------------------------------------- #
# crosswalk + label names
# --------------------------------------------------------------------------- #
def read_crosswalk(path: Path) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    header: list[str] | None = None
    for raw in path.read_text().splitlines():
        if raw.startswith("#") or not raw.strip():
            continue
        cells = raw.split("\t")
        if header is None:
            header = cells
            continue
        cells += [""] * (len(header) - len(cells))
        row = {k: v.strip() for k, v in zip(header, cells)}
        rows[row["moose_class"]] = row
    return rows


def drop_stray_components(
    arr: np.ndarray,
    names: dict[int, str],
    spacing: tuple[float, float, float],
    si_axis: int,
    max_mm: float,
) -> np.ndarray:
    """Remove connected components sitting in a different REGION OF THE BODY.

    WHY NOT `--min-voxels`, AND WHY NOT CENTROID DISTANCE
    -----------------------------------------------------
    `--min-voxels` is per LABEL and catches specks. This catches something else: a
    substantial blob of the right label in the wrong body part. Measured on
    Healthy-Total-Body-CTs subject 003, `Toes` is two clusters — 10,458 voxels at
    the feet and **666 voxels up among the fingers**, mislabelled finger phalanges.
    No voxel count separates those, because 666 voxels is a plausible real toe.

    ⚠️ AND 3-D CENTROID DISTANCE DOES NOT SEPARATE THEM EITHER. A first version of
    this used it with a 300 mm threshold and **deleted an entire humerus** (77,530
    voxels at 353 mm) and an ulna (19,908 at 308 mm). The reason is the property
    this whole corpus is defined by: labels merge LEFT AND RIGHT, so the two
    instances of a paired bone are an arm span apart. Distance from the midline is
    normal anatomy, not damage.

    What actually distinguishes the defect is position along the body's LONG axis,
    compared against the main component's RANGE rather than its centre:

      a paired bone      left and right overlap almost entirely in head-to-toe
                         position -> gap 0 -> kept
      the ribs, carpals  adjacent or overlapping along the body axis -> small gap
                         -> kept
      the stray toes     ~1,700 mm above the real toes -> dropped

    So the test is the head-to-toe GAP between a component and the main mass, and
    every drop is printed. A silent version of this would be worse than the bug it
    fixes — as the deleted humerus demonstrates.
    """
    from scipy import ndimage

    out = arr
    for value, cls in sorted(names.items()):
        mask = arr == value
        if not mask.any():
            continue
        lab, n = ndimage.label(mask)
        if n < 2:
            continue
        sizes = ndimage.sum(mask, lab, index=range(1, n + 1))
        main = int(np.argmax(sizes)) + 1

        # Head-to-toe span of each component, in millimetres.
        def si_range(comp: int) -> tuple[float, float]:
            idx = np.where(np.any(lab == comp, axis=tuple(a for a in range(3) if a != si_axis)))[0]
            return float(idx.min()) * spacing[si_axis], float(idx.max()) * spacing[si_axis]

        lo_main, hi_main = si_range(main)
        dropped: list[tuple[int, float]] = []
        for comp in range(1, n + 1):
            if comp == main:
                continue
            lo, hi = si_range(comp)
            # 0 when the two spans overlap at all; otherwise the empty distance.
            gap = max(0.0, lo - hi_main, lo_main - hi)
            if gap > max_mm:
                if out is arr:
                    out = arr.copy()
                out[lab == comp] = 0
                dropped.append((int(sizes[comp - 1]), gap))
        if dropped:
            worst = max(dropped, key=lambda t: t[1])
            print(
                f"  [stray] {cls}: dropped {len(dropped)} component(s), "
                f"{sum(v for v, _ in dropped)} voxels, furthest {worst[0]} voxels "
                f"{worst[1]:.0f} mm along the body axis from the main mass"
            )
    return out


def read_label_map(path: Path) -> dict[int, str]:
    """int -> class name, from an explicit TSV. `index<TAB>name`, `#` comments.

    WHY THIS EXISTS
    ---------------
    Everything below assumes MOOSE ran locally: the filename is matched against
    `_SEG_RE` to recover a model id, the model id is looked up in a hard-coded
    table, and the label names are read out of that model's own `dataset.json`
    inside the venv.

    That chain cannot serve a PRE-SEGMENTED corpus. TCIA's Healthy-Total-Body-CTs
    ships finished segmentations whose filenames do not match `_SEG_RE`, and whose
    36 labels are a COARSER, GROUPED scheme of its own -- one `Ribcage`, one
    `Spine` -- not MOOSE's per-rib and per-vertebra classes. Renaming the files to
    satisfy the regex would be the dangerous fix: the integers would then be
    resolved through MOOSE's table and silently mean the wrong structures.

    So the label source becomes explicit and the corpus brings its own map. See
    `docs/healthy-total-body-cts-labels.tsv`, transcribed from that collection's
    own spreadsheet.
    """
    out: dict[int, str] = {}
    for raw in path.read_text().splitlines():
        if raw.startswith("#") or not raw.strip():
            continue
        cells = raw.split("\t")
        if len(cells) < 2:
            raise SystemExit(f"{path}: expected `index<TAB>name`, got {raw!r}")
        try:
            idx = int(cells[0])
        except ValueError:
            # A header row is the likely cause and is not worth failing over.
            continue
        out[idx] = cells[1].strip()
    if not out:
        raise SystemExit(f"{path}: no label rows found")
    return out


def model_id_for(seg_path: Path) -> str | None:
    m = _SEG_RE.match(seg_path.name)
    if not m:
        return None
    # "organs" -> clin_ct_organs ; "peripheral_bones" -> clin_ct_peripheral_bones
    return f"{m.group(1).lower()}_{m.group(2).lower()}_{m.group('region')}"


def label_names(model_id: str) -> dict[int, str]:
    """int -> class name, read from the downloaded model's own dataset.json.

    dataset.json is authoritative and the only source that is guaranteed current.
    The ENHANCE.PET bucket's labels.json is a convenience copy and was measured
    to be STALE: it omits `trachea` from clin_ct_organs and contains a JSON
    trailing comma. Never key off it.
    """
    root = Path(__file__).parent / ".venv" / "lib"
    folders = {
        "clin_ct_body": "Dataset001_body",
        "clin_ct_lungs": "Dataset333_HMS3dlungs",
        "clin_ct_organs": "Dataset123_Organs",
        "clin_ct_ribs": "Dataset444_Ribs",
        "clin_ct_muscles": "Dataset555_Muscles",
        "clin_ct_peripheral_bones": "Dataset666_Peripheral-Bones",
        "clin_ct_vertebrae": "Dataset111_Vertebrae",
        "clin_ct_cardiac": "Dataset888_Cardiac",
        "clin_ct_digestive": "Dataset999_Digestive",
        "clin_ct_body_composition": "Dataset778_Body_composition",
    }
    folder = folders.get(model_id)
    if folder is None:
        raise SystemExit(f"unknown MOOSE model id '{model_id}' — extend labelmap2glb.label_names()")
    hits = list(root.glob(f"python3.*/site-packages/moosez/models/nnunet_trained_models/{folder}/*/dataset.json"))
    if not hits:
        raise SystemExit(
            f"no dataset.json for {model_id}. Run run_moose.py once so MOOSE downloads the weights."
        )
    labels = json.loads(hits[0].read_text())["labels"]
    return {int(v): k for k, v in labels.items() if k != "background"}


# --------------------------------------------------------------------------- #
# VTK
# --------------------------------------------------------------------------- #
def pad_background(arr: np.ndarray, affine: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """One voxel of background on every face, with the affine corrected to match.

    WHY THIS IS NOT OPTIONAL. Any label that touches the edge of the volume
    produces an OPEN surface — SurfaceNets has nothing on the far side to build
    a face against. That happens constantly in practice: a neck slab cuts the
    lungs, a whole-body CT cuts the arms at the field-of-view edge. An open mesh
    breaks two things at once: it renders as a hole under backface culling, and
    its signed volume is meaningless, which would make the winding check in
    `verify()` report failures that are not winding failures at all. Measured
    before this was added: the two lung lobes in the neck test came out with
    NEGATIVE volume purely from being truncated.

    Padding puts a background shell around everything, so every structure is
    closed by construction and a truncated organ gets an honest flat cap exactly
    where the scan stopped.

    The affine must move with it: index (0,0,0) of the padded array is index
    (-1,-1,-1) of the original, so translate by the affine's own -1 step.
    """
    padded = np.pad(arr, 1, mode="constant", constant_values=0)
    shift = np.eye(4)
    shift[:3, 3] = -1.0
    return padded, affine @ shift


def to_vtk_image(arr: np.ndarray, spacing: tuple[float, float, float]) -> vtk.vtkImageData:
    """numpy (I,J,K) -> vtkImageData in *scaled index* space (mm-correct, axis-aligned).

    Spacing is set to the real voxel sizes rather than 1, so the smoothing
    constraint distance is isotropic in millimetres even on 0.98 x 0.98 x 3.0 mm
    clinical CT. The rotation/flip part of the affine is applied afterwards, as
    a rigid transform on the extracted polygons.
    """
    img = vtk.vtkImageData()
    img.SetDimensions(*arr.shape)
    img.SetSpacing(*spacing)
    img.SetOrigin(0.0, 0.0, 0.0)
    flat = np.ascontiguousarray(arr.transpose(2, 1, 0)).ravel()  # VTK wants x fastest
    vtk_arr = vtknp.numpy_to_vtk(flat.astype(np.uint16), deep=True, array_type=vtk.VTK_UNSIGNED_SHORT)
    vtk_arr.SetName("labels")
    img.GetPointData().SetScalars(vtk_arr)
    return img


def surface_nets(img: vtk.vtkImageData, labels: list[int], smooth_iters: int) -> vtk.vtkPolyData:
    sn = vtk.vtkSurfaceNets3D()
    sn.SetInputData(img)
    sn.SetBackgroundLabel(0)
    sn.SetOutputStyleToDefault()
    sn.SetOutputMeshTypeToTriangles()
    sn.SetNumberOfLabels(len(labels))
    for i, v in enumerate(labels):
        sn.SetLabel(i, float(v))
    if smooth_iters > 0:
        sn.SmoothingOn()
        sn.GetSmoother().SetNumberOfIterations(smooth_iters)
        # Constrain displacement to a fraction of the voxel diagonal so smoothing
        # cannot walk a surface off its own segmentation. VTK's automatic mode
        # derives this from the spacing, which is why spacing had to be real mm.
        sn.AutomaticSmoothingConstraintsOn()
        sn.SetConstraintScale(0.5)
    else:
        sn.SmoothingOff()
    sn.Update()
    return sn.GetOutput()


def _extract_label(net: vtk.vtkPolyData, label: int) -> vtk.vtkPolyData:
    """The closed, outward-wound surface of one label, from the shared net.

    Two halves, per the BoundaryLabels convention (module docstring section 2):
    component 0 == label is already outward; component 1 == label is inward and
    is reversed.
    """
    parts = []
    for comp, reverse in ((0, False), (1, True)):
        th = vtk.vtkThreshold()
        th.SetInputData(net)
        th.SetInputArrayToProcess(0, 0, 0, vtk.vtkDataObject.FIELD_ASSOCIATION_CELLS, "BoundaryLabels")
        th.SetSelectedComponent(comp)
        th.SetLowerThreshold(label - 0.5)
        th.SetUpperThreshold(label + 0.5)
        th.SetThresholdFunction(vtk.vtkThreshold.THRESHOLD_BETWEEN)
        gf = vtk.vtkGeometryFilter()
        gf.SetInputConnection(th.GetOutputPort())
        gf.Update()
        piece = gf.GetOutput()
        if piece.GetNumberOfCells() == 0:
            continue
        if reverse:
            rs = vtk.vtkReverseSense()
            rs.SetInputData(piece)
            rs.ReverseCellsOn()
            rs.ReverseNormalsOff()
            rs.Update()
            piece = rs.GetOutput()
        parts.append(piece)

    if not parts:
        return vtk.vtkPolyData()
    app = vtk.vtkAppendPolyData()
    for p in parts:
        app.AddInputData(p)
    clean = vtk.vtkCleanPolyData()  # weld the seam between the two halves
    clean.SetInputConnection(app.GetOutputPort())
    clean.PointMergingOn()
    clean.Update()
    return clean.GetOutput()


def _transform(poly: vtk.vtkPolyData, matrix: np.ndarray) -> vtk.vtkPolyData:
    m = vtk.vtkMatrix4x4()
    for r in range(4):
        for c in range(4):
            m.SetElement(r, c, float(matrix[r, c]))
    tf = vtk.vtkTransform()
    tf.SetMatrix(m)
    tp = vtk.vtkTransformPolyDataFilter()
    tp.SetTransform(tf)
    tp.SetInputData(poly)
    tp.Update()
    out = tp.GetOutput()

    # A negative-determinant transform mirrors the geometry, which inverts every
    # triangle's winding. vtkTransformPolyDataFilter does not fix that for us.
    if np.linalg.det(matrix[:3, :3]) < 0:
        rs = vtk.vtkReverseSense()
        rs.SetInputData(out)
        rs.ReverseCellsOn()
        rs.ReverseNormalsOn()
        rs.Update()
        out = rs.GetOutput()
    return out


def _decimate(poly: vtk.vtkPolyData, target_tris: int) -> tuple[vtk.vtkPolyData, str]:
    """Quadric decimation with volume preservation, backing off if it opens holes.

    vtkQuadricDecimation has no topology guarantee: collapsing an edge can leave
    a boundary edge behind, and a hole in a closed organ is worse than a few
    thousand extra triangles. Measured on a whole-body run at reduction 0.49,
    two of eighteen organs came out with 2 and 4 boundary edges respectively.

    So: walk a ladder of reductions, and at each rung try capping whatever it
    opened before backing off. The holes are one or two triangles across, and
    capping them is much cheaper than surrendering the reduction — backing off
    instead cost 40 % of the triangle budget and left one lung lobe entirely
    undecimated at 96 k triangles. Returns the mesh and a note for the report.
    """
    n = poly.GetNumberOfCells()
    if n <= target_tris or target_tris <= 0:
        return poly, "kept"

    reduction = 1.0 - target_tris / n
    for r in (reduction, reduction * 0.75, reduction * 0.5, reduction * 0.25):
        dec = vtk.vtkQuadricDecimation()
        dec.SetInputData(poly)
        dec.SetTargetReduction(r)
        dec.VolumePreservationOn()
        dec.Update()
        out = dec.GetOutput()
        if open_edges(out) == 0:
            return out, f"reduction={r:.3f}"
        # The holes it opens are tiny — one or two triangles, sub-millimetre.
        # Capping them is far cheaper than giving up the reduction: measured on
        # organs + ribs, backing off instead cost 40 % of the triangle budget and
        # left one lung lobe completely undecimated at 96 k triangles.
        # A badly wound cap would show up in the mesh-vs-label volume check in
        # `verify()`, so this is not an unchecked repair.
        fill = vtk.vtkFillHolesFilter()
        fill.SetInputData(out)
        fill.SetHoleSize(0.01)  # metres at this point; 1 cm is generous
        fill.Update()
        filled = fill.GetOutput()
        if open_edges(filled) == 0:
            return filled, f"reduction={r:.3f}+filled"
    return poly, "undecimated (every reduction opened holes that would not cap)"


def _with_normals(poly: vtk.vtkPolyData) -> vtk.vtkPolyData:
    """Smooth vertex normals, WITHOUT letting the filter touch the winding.

    ⚠️ ConsistencyOn is off deliberately, and this cost real debugging time.
    The winding coming out of `_extract_label` + `_transform` is already correct
    and independently checked by signed volume. vtkPolyDataNormals' consistency
    pass walks the surface propagating an orientation from an arbitrary seed
    cell, and on a SurfaceNets mesh — which has non-manifold edges at
    three-label corners — that walk can terminate early and leave the surface
    flipped relative to where it started. Measured on the neck test scan: a lung
    lobe went from +0.146 L before this filter to -0.315 L after it, with the
    extraction itself provably correct. AutoOrientNormals has the same failure
    mode with a nicer name.

    So: compute normals from the winding we already trust, change nothing else,
    and let `verify()` keep proving the winding independently.
    """
    nf = vtk.vtkPolyDataNormals()
    nf.SetInputData(poly)
    nf.SplittingOn()
    nf.SetFeatureAngle(60.0)
    nf.ConsistencyOff()
    nf.AutoOrientNormalsOff()
    nf.FlipNormalsOff()
    nf.ComputePointNormalsOn()
    nf.ComputeCellNormalsOff()
    nf.Update()
    return nf.GetOutput()


def poly_to_arrays(poly: vtk.vtkPolyData) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    pts = vtknp.vtk_to_numpy(poly.GetPoints().GetData()).astype(np.float32)
    nrm = poly.GetPointData().GetNormals()
    normals = vtknp.vtk_to_numpy(nrm).astype(np.float32) if nrm else np.zeros_like(pts)
    conn = vtknp.vtk_to_numpy(poly.GetPolys().GetConnectivityArray()).astype(np.uint32)
    return pts, normals, conn.reshape(-1, 3)


def signed_volume(pts: np.ndarray, tris: np.ndarray) -> float:
    """Signed volume in the mesh's own units. Positive == outward winding."""
    a, b, c = pts[tris[:, 0]], pts[tris[:, 1]], pts[tris[:, 2]]
    return float(np.einsum("ij,ij->i", a, np.cross(b, c)).sum() / 6.0)


def open_edges(poly: vtk.vtkPolyData) -> int:
    """Count of boundary edges. Zero means the surface is closed.

    Reported per structure because it is the cheapest possible proof that the
    SurfaceNets + BoundaryLabels extraction did what section 1 of the docstring
    claims. A non-zero count on a padded volume means the extraction dropped
    cells, not that the organ was truncated.
    """
    fe = vtk.vtkFeatureEdges()
    fe.SetInputData(poly)
    fe.BoundaryEdgesOn()
    fe.FeatureEdgesOff()
    fe.NonManifoldEdgesOff()
    fe.ManifoldEdgesOff()
    fe.Update()
    return int(fe.GetOutput().GetNumberOfCells())


# --------------------------------------------------------------------------- #
# GLB
# --------------------------------------------------------------------------- #
def write_glb(
    structures: list[dict], out_path: Path, generator: str, copyright: str
) -> None:
    """Write the atlas GLB.

    ``copyright`` is required rather than optional on purpose. glTF's
    ``asset.copyright`` is the only credit that travels *inside* the file, and
    this atlas shipped without one until ``check-licences.mjs`` caught it — the
    in-app attribution bar covered the rendering case, but a GLB lifted out of
    ``public/models/`` carried nothing. Making the argument mandatory means a new
    output cannot be added without someone deciding what its credit says.

    ⚠️ If this pipeline is ever re-run against TotalSegmentator's GATED subtasks
    (``tissue_types``, ``appendicular_bones``, ``face``), the credit AND the
    licence tier both change — those weights are non-commercial, which makes the
    output tier 2. Register it under a new id in ``licences.json`` rather than
    overwriting the tier 1 entry.
    """
    from pygltflib import (
        GLTF2,
        Accessor,
        Asset,
        Attributes,
        Buffer,
        BufferView,
        Material,
        Mesh,
        Node,
        PbrMetallicRoughness,
        Primitive,
        Scene,
    )

    blob = bytearray()
    views: list[BufferView] = []
    accessors: list[Accessor] = []
    meshes: list[Mesh] = []
    nodes: list[Node] = []

    def push(data: bytes, target: int) -> int:
        while len(blob) % 4:  # glTF requires 4-byte alignment
            blob.append(0)
        off = len(blob)
        blob.extend(data)
        views.append(BufferView(buffer=0, byteOffset=off, byteLength=len(data), target=target))
        return len(views) - 1

    ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER = 34962, 34963
    FLOAT, UNSIGNED_INT = 5126, 5125

    for s in structures:
        pts, nrm, tris = s["pts"], s["normals"], s["tris"]

        v_pos = push(pts.astype("<f4").tobytes(), ARRAY_BUFFER)
        accessors.append(
            Accessor(
                bufferView=v_pos, componentType=FLOAT, count=len(pts), type="VEC3",
                min=pts.min(axis=0).tolist(), max=pts.max(axis=0).tolist(),
            )
        )
        a_pos = len(accessors) - 1

        v_nrm = push(nrm.astype("<f4").tobytes(), ARRAY_BUFFER)
        accessors.append(Accessor(bufferView=v_nrm, componentType=FLOAT, count=len(nrm), type="VEC3"))
        a_nrm = len(accessors) - 1

        v_idx = push(tris.astype("<u4").ravel().tobytes(), ELEMENT_ARRAY_BUFFER)
        accessors.append(
            Accessor(bufferView=v_idx, componentType=UNSIGNED_INT, count=tris.size, type="SCALAR")
        )
        a_idx = len(accessors) - 1

        meshes.append(
            Mesh(
                name=s["node_name"],  # so scripts/atlas-stats.mjs can name the heavy ones
                primitives=[Primitive(attributes=Attributes(POSITION=a_pos, NORMAL=a_nrm), indices=a_idx, material=0)],
            )
        )
        nodes.append(Node(name=s["node_name"], mesh=len(meshes) - 1, extras=s["extras"]))

    root = Node(name="ct_atlas", children=list(range(len(nodes))))
    nodes.append(root)

    gltf = GLTF2(
        asset=Asset(version="2.0", generator=generator, copyright=copyright),
        scene=0,
        scenes=[Scene(nodes=[len(nodes) - 1])],
        nodes=nodes,
        meshes=meshes,
        accessors=accessors,
        bufferViews=views,
        buffers=[Buffer(byteLength=len(blob))],
        materials=[
            # One shared placeholder. AtlasBody replaces every material at runtime
            # (`e.mesh.material = materialFor(...)`), so per-structure materials
            # here would be dead weight in the file.
            Material(
                name="tissue",
                pbrMetallicRoughness=PbrMetallicRoughness(
                    baseColorFactor=[0.8, 0.75, 0.72, 1.0], metallicFactor=0.0, roughnessFactor=0.6
                ),
                doubleSided=False,
            )
        ],
    )
    gltf.set_binary_blob(bytes(blob))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    gltf.save_binary(str(out_path))


# --------------------------------------------------------------------------- #
# laterality / mirroring verification
# --------------------------------------------------------------------------- #
#
# In glTF space x' = -x_RAS. RAS +x points to the subject's RIGHT, so a
# right-sided structure has x' < 0 and a left-sided one x' > 0. y' = z_RAS
# (superior, up) and z' = y_RAS (anterior), i.e. the asset faces +Z, which is
# glTF's asset convention (the -Z convention people remember is the CAMERA's).
#
# Each pair is (left_class, right_class): the LEFT one must have the greater x'.
LATERALITY_PAIRS = [
    ("kidney_left", "kidney_right"),
    ("adrenal_gland_left", "adrenal_gland_right"),
    ("lung_upper_lobe_left", "lung_upper_lobe_right"),
    ("thyroid_left", "thyroid_right"),
    ("heart_ventricle_left", "heart_ventricle_right"),
    ("heart_atrium_left", "heart_atrium_right"),
    ("humerus_left", "humerus_right"),
    ("femur_left", "femur_right"),
    ("rib_left_5", "rib_right_5"),
    ("scapula_left", "scapula_right"),
]

# Asymmetric single structures: (class, side) where side is which half of the
# body it must sit in. These are the checks that catch a mirror even when the
# left/right *pairs* are consistently swapped with each other.
ASYMMETRIC = [
    ("liver", "right"),
    ("spleen", "left"),
    ("stomach", "left"),
    ("gallbladder", "right"),
]

SUPERIOR_INFERIOR = [("skull", "femur_left"), ("brain", "bladder")]
ANTERIOR_POSTERIOR = [("sternum", "vertebra_T8")]


def verify(by_class: dict[str, dict]) -> list[str]:
    """Return a list of failures. Empty list means every applicable check passed."""
    fails: list[str] = []
    checked = 0

    for left, right in LATERALITY_PAIRS:
        if left in by_class and right in by_class:
            checked += 1
            lx, rx = by_class[left]["centroid"][0], by_class[right]["centroid"][0]
            if not lx > rx:
                fails.append(
                    f"MIRROR: {left} x={lx:+.4f} should be GREATER than {right} x={rx:+.4f}"
                )

    # Midline from the geometry, not from x = 0. A CT's RAS origin is the scanner
    # isocentre and the patient is USUALLY centred in the bore — but "usually" is
    # not a thing to hang a mirror check on, and an off-centre subject would make
    # this test either falsely fail or, worse, falsely pass. The atlas bounding
    # box is also exactly what AtlasBody centres on, so this matches what renders.
    xs = [x for s in by_class.values() for x in (s["pts"][:, 0].min(), s["pts"][:, 0].max())]
    midline = (min(xs) + max(xs)) / 2 if xs else 0.0

    for cls, side in ASYMMETRIC:
        if cls in by_class:
            checked += 1
            x = by_class[cls]["centroid"][0]
            ok = x > midline if side == "left" else x < midline
            if not ok:
                fails.append(
                    f"MIRROR: {cls} sits at x={x:+.4f} but is on the subject's {side}, "
                    f"which is {'right' if side == 'left' else 'left'} of the midline x={midline:+.4f}"
                )

    for sup, inf in SUPERIOR_INFERIOR:
        if sup in by_class and inf in by_class:
            checked += 1
            if not by_class[sup]["centroid"][1] > by_class[inf]["centroid"][1]:
                fails.append(f"UP AXIS: {sup} should be above {inf} in +Y")

    for ant, post in ANTERIOR_POSTERIOR:
        if ant in by_class and post in by_class:
            checked += 1
            if not by_class[ant]["centroid"][2] > by_class[post]["centroid"][2]:
                fails.append(f"FACING: {ant} should be in front of {post} in +Z (asset faces +Z)")

    for cls, s in by_class.items():
        if s["signed_volume"] <= 0:
            fails.append(f"WINDING: {cls} has non-positive signed volume ({s['signed_volume']:.3e} m^3)")
        if s["open_edges"]:
            fails.append(f"OPEN SURFACE: {cls} has {s['open_edges']} boundary edges; it should be closed")
        if "normals_changed_volume" in s:
            pre, post = s["normals_changed_volume"]
            fails.append(f"NORMALS: {cls} volume moved {pre:.4e} -> {post:.4e} while adding normals")
        # A mesh whose volume is wildly unlike the voxel count it came from is
        # not a rendering nuisance, it is a broken extraction. 25% is loose on
        # purpose: smoothing genuinely inflates thin structures.
        lv = s["label_volume_m3"]
        if lv > 1e-7 and not (0.5 * lv <= abs(s["signed_volume"]) <= 1.6 * lv):
            fails.append(
                f"VOLUME: {cls} mesh {abs(s['signed_volume'])*1000:.3f} L vs label {lv*1000:.3f} L"
            )

    print(f"[verify] ran {checked} orientation checks over {len(by_class)} structures")
    return fails


# --------------------------------------------------------------------------- #
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seg", action="append", required=True, help="MOOSE segmentation NIfTI. Repeatable.")
    ap.add_argument("--out", required=True, help="Output .glb")
    ap.add_argument("--crosswalk", default=str(DEFAULT_CROSSWALK))
    ap.add_argument(
        "--labels",
        help="Explicit `index<TAB>name` TSV, for a pre-segmented corpus whose labels are "
        "not MOOSE's. Bypasses the filename->model->dataset.json lookup entirely.",
    )
    ap.add_argument("--target-triangles", type=int, default=380_000)
    ap.add_argument("--min-triangles", type=int, default=120, help="Floor per structure, so small bones survive decimation.")
    ap.add_argument("--min-voxels", type=int, default=20, help="Drop labels with fewer voxels than this (segmentation specks).")
    ap.add_argument(
        "--max-stray-mm",
        type=float,
        default=200.0,
        help="Per label, drop connected components separated from the label's largest component "
        "by more than this along the HEAD-TO-TOE axis. 0 disables. Catches a blob of the right "
        "label in the wrong body part, without deleting the other side of a paired bone.",
    )
    ap.add_argument("--smooth-iterations", type=int, default=24)
    ap.add_argument("--strict", action="store_true", help="Exclude crosswalk rows marked status=flag instead of shipping them with a warning.")
    ap.add_argument("--include-unmapped", action="store_true", help="Also emit structures with no UBERON term (vertebra_L6, rib 13, the clin_ct_body region masks).")
    ap.add_argument("--no-verify", action="store_true")
    ap.add_argument("--report", help="Write a per-structure JSON report here.")
    args = ap.parse_args()

    cross = read_crosswalk(Path(args.crosswalk))
    structures: list[dict] = []
    by_class: dict[str, dict] = {}
    skipped: list[str] = []
    review: list[str] = []

    # Read once, outside the loop: an explicit map applies to every input.
    explicit_names = read_label_map(Path(args.labels)) if args.labels else None

    for seg in args.seg:
        seg_path = Path(seg)
        if explicit_names is not None:
            names = explicit_names
            # Still needed for the progress line below, and it should name the
            # actual source of the labels rather than a MOOSE model that was
            # never consulted.
            model_id = f"labels:{Path(args.labels).stem}"
        else:
            model_id = model_id_for(seg_path)
            if model_id is None:
                raise SystemExit(
                    f"cannot infer the MOOSE model from '{seg_path.name}'. "
                    "If this is a pre-segmented corpus rather than MOOSE output, pass --labels "
                    "with its own index->name map."
                )
            names = label_names(model_id)

        img = nib.load(str(seg_path))
        arr, affine = pad_background(np.asanyarray(img.dataobj), img.affine.astype(np.float64))
        s = np.linalg.norm(affine[:3, :3], axis=0)

        # scaled-index -> RAS mm, then RAS mm -> glTF metres.
        index_to_ras = affine @ np.diag(np.append(1.0 / s, 1.0))
        total = RAS_TO_GLTF @ index_to_ras
        det = float(np.linalg.det(total[:3, :3]))
        print(
            f"[{model_id}] {seg_path.name} shape={arr.shape} "
            f"axcodes={''.join(nib.aff2axcodes(affine))} det(nifti)={np.linalg.det(affine[:3,:3]):+.3f} "
            f"det(composed)={det:+.3e} -> winding {'REVERSED' if det < 0 else 'kept'}"
        )

        if args.max_stray_mm > 0:
            # Which voxel axis runs head-to-toe, read from the image itself rather
            # than assumed: this corpus is LAS, but the rule must not depend on it.
            codes = nib.aff2axcodes(affine)
            si_axis = next((i for i, c in enumerate(codes) if c in ("S", "I")), 2)
            arr = drop_stray_components(
                arr, names, tuple(float(x) for x in s), si_axis, args.max_stray_mm
            )

        present, counts = np.unique(arr, return_counts=True)
        keep = [
            int(v)
            for v, c in zip(present, counts)
            if v != 0 and c >= args.min_voxels and int(v) in names
        ]
        if not keep:
            print(f"  no labels above --min-voxels; skipping")
            continue

        net = surface_nets(to_vtk_image(arr, tuple(float(x) for x in s)), keep, args.smooth_iterations)
        print(f"  surface net: {net.GetNumberOfCells()} triangles over {len(keep)} labels")

        voxel_vol_m3 = float(np.prod(s)) * 1e-9
        for value in keep:
            cls = names[value]
            row = cross.get(cls)
            if row is None:
                skipped.append(f"{cls} (not in crosswalk)")
                continue
            # `status=flag` means "a human has to decide something here", which is
            # usually about the SYSTEM assignment (spleen) or about the class
            # covering more than its term claims (portal_splenic_vein). Those are
            # review items, not reasons to drop an organ out of the atlas — so
            # they ship by default, loudly, and --strict is how you exclude them.
            if row["status"] == "flag":
                if args.strict:
                    skipped.append(f"{cls} (status=flag, --strict)")
                    continue
                review.append(f"{cls}: {row['note'][:110]}")
            # A row with no CURIE cannot participate in the ontology join at all,
            # so it is off by default rather than shipped as an unaddressable node.
            if not row["uberon"] and not args.include_unmapped:
                skipped.append(f"{cls} (no UBERON term; --include-unmapped to emit anyway)")
                continue

            poly = _transform(_extract_label(net, value), total)
            if poly.GetNumberOfCells() == 0:
                skipped.append(f"{cls} (empty after extraction)")
                continue

            curie = row["uberon"]
            side = row["side"]
            base = curie.replace(":", "_") if curie else f"MOOSE_{cls}"
            node_name = f"{base}.{side}" if side and _shares_term(cross, curie) else base

            structures.append(
                {
                    "cls": cls,
                    "poly": poly,
                    "node_name": node_name,
                    "label_voxels": int((arr == value).sum()),
                    "voxel_vol_m3": voxel_vol_m3,
                    "extras": {
                        "ontologyid": curie,
                        "label": row["uberon_label"] or cls.replace("_", " "),
                        "system": row["system"],
                        "layer": row["layer"],
                        "moose_class": cls,
                        "side": side,
                    },
                }
            )

    if not structures:
        raise SystemExit("nothing to write — every label was skipped")

    # Two MOOSE models can emit the same structure (the lung lobes are in both
    # clin_ct_organs and clin_ct_lungs). Duplicate node names would make the
    # ontology join ambiguous and the second copy would z-fight the first.
    seen: dict[str, str] = {}
    for s in structures:
        # The node name must survive AtlasBody's CURIE regex, or the structure
        # resolves to no term and renders as unassigned grey with no error.
        # This is the single cheapest guard against the `.left` / `_left`
        # separator mistake described in section 4 of the module docstring.
        if s["extras"]["ontologyid"] and not _ATLASBODY_CURIE.search(s["node_name"]):
            raise SystemExit(
                f"node name '{s['node_name']}' does not parse under AtlasBody's CURIE regex. "
                "Use a NON-word character before a side suffix (a dot), not an underscore."
            )
        if s["node_name"] in seen:
            raise SystemExit(
                f"duplicate node '{s['node_name']}' from both {seen[s['node_name']]} and {s['cls']}. "
                "Two of the segmentations cover the same structure — drop one --seg."
            )
        seen[s["node_name"]] = s["cls"]

    # One global decimation budget, apportioned by size, with a floor so a rib
    # does not get decimated into a triangle while the liver keeps 40k.
    #
    # Iterated, because vtkQuadricDecimation's TargetReduction is a REQUEST and
    # not a guarantee: it stops early rather than create non-manifold geometry,
    # and thin structures have very little headroom. Measured on organs + ribs:
    # asking for factor 0.351 achieved 0.573, overshooting a 380 k budget by 63 %.
    # So: apply, measure, push the factor harder on whatever still has slack.
    raw_total = sum(s["poly"].GetNumberOfCells() for s in structures)
    factor = min(1.0, args.target_triangles / max(raw_total, 1))
    decimated_by: dict[int, tuple] = {}
    best: tuple[int, dict[int, tuple]] | None = None
    for attempt in range(3):
        pass_result: dict[int, tuple] = {}
        achieved = 0
        for i, s in enumerate(structures):
            n = s["poly"].GetNumberOfCells()
            target = max(args.min_triangles, int(round(n * factor)))
            pass_result[i] = _decimate(s["poly"], target)
            achieved += pass_result[i][0].GetNumberOfCells()
        print(f"[decimate] pass {attempt + 1}: factor {factor:.3f} -> {achieved} triangles")
        # Keep the BEST pass, not the last. Asking for more reduction can yield
        # MORE triangles: a harder request opens holes, the ladder in _decimate
        # backs off further, and the net result is coarser-request/bigger-mesh.
        # The relationship is not monotonic, so "iterate until converged" is the
        # wrong shape and "try a few and keep the smallest" is the right one.
        if best is None or achieved < best[0]:
            best = (achieved, pass_result)
        if achieved <= args.target_triangles * 1.05 or factor <= 0.01:
            break
        factor = max(0.01, factor * (args.target_triangles / achieved) * 0.95)
    decimated_by = best[1]
    print(f"[decimate] {raw_total} raw -> target {args.target_triangles}, best pass {best[0]}")

    for i, s in enumerate(structures):
        decimated, s["decimation"] = decimated_by[i]
        s["open_edges"] = open_edges(decimated)
        v_pre = signed_volume(*(lambda a: (a[0], a[2]))(poly_to_arrays(decimated)))
        poly = _with_normals(decimated)
        pts, nrm, tris = poly_to_arrays(poly)
        s.update(pts=pts, normals=nrm, tris=tris)
        s["centroid"] = pts.mean(axis=0).tolist() if len(pts) else [0, 0, 0]
        s["signed_volume"] = signed_volume(pts, tris)
        # Guard against the vtkPolyDataNormals winding regression described in
        # `_with_normals`. Adding normals must not move a single vertex.
        if abs(s["signed_volume"] - v_pre) > 1e-4 * max(abs(v_pre), 1e-9):
            s["normals_changed_volume"] = [v_pre, s["signed_volume"]]
        s["label_volume_m3"] = s["label_voxels"] * s["voxel_vol_m3"]
        del s["poly"]
        by_class[s["cls"]] = s

    tri_total = sum(len(s["tris"]) for s in structures)
    print(f"[decimate] final {tri_total} triangles across {len(structures)} structures")

    fails = [] if args.no_verify else verify(by_class)

    out = Path(args.out)
    write_glb(
        structures,
        out,
        generator="open-twin-openXR labelmap2glb (MOOSE 3.2 + vtkSurfaceNets3D)",
        # Must match the `ct-atlas-f` entry in licences.json. Both are the same
        # claim; the register is what a human reads and this is what survives the
        # file being copied somewhere else.
        copyright="Segmented with MOOSE 3.2 (ENHANCE-PET), CC BY 4.0 weights.",
    )
    print(f"[write] {out} ({out.stat().st_size / 1e6:.1f} MB)")

    if args.report:
        Path(args.report).write_text(
            json.dumps(
                {
                    "triangles": tri_total,
                    "structures": [
                        {
                            "moose_class": s["cls"],
                            "node": s["node_name"],
                            "ontologyid": s["extras"]["ontologyid"],
                            "system": s["extras"]["system"],
                            "layer": s["extras"]["layer"],
                            "triangles": len(s["tris"]),
                            "open_edges": s["open_edges"],
                            "decimation": s["decimation"],
                            "centroid_gltf_m": [round(v, 5) for v in s["centroid"]],
                            "mesh_volume_l": round(s["signed_volume"] * 1000, 4),
                            "label_volume_l": round(s["label_volume_m3"] * 1000, 4),
                        }
                        for s in structures
                    ],
                    "skipped": skipped,
                    "needs_review": review,
                    "verification_failures": fails,
                },
                indent=2,
            )
        )
        print(f"[write] {args.report}")

    if skipped:
        print(f"[skip] {len(skipped)} label(s): " + ", ".join(skipped[:12]) + (" ..." if len(skipped) > 12 else ""))
    for r in review:
        print("[review] " + r)
    for f in fails:
        print("FAIL " + f)
    print("VERIFY OK" if not fails else f"VERIFY FAILED ({len(fails)})")
    return 1 if fails else 0


def _shares_term(cross: dict[str, dict], curie: str) -> bool:
    """True when more than one MOOSE class maps to this CURIE.

    That is the case where the node name alone cannot say which structure it is
    (both femurs are UBERON:0000981), so it needs a `.left` / `.right` suffix.
    Where UBERON does have lateral terms — kidney, adrenal, clavicle, thyroid
    lobe — the id is already unique and no suffix is added.
    """
    if not curie:
        return True
    return sum(1 for r in cross.values() if r["uberon"] == curie) > 1


if __name__ == "__main__":
    sys.exit(main())
