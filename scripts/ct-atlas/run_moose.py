#!/usr/bin/env python
"""
Run MOOSE 3.2 over one CT and write one multi-label NIfTI per model.

    .venv/bin/python run_moose.py --ct <ct.nii.gz> --out <dir> [--models a,b,c]

WHY A WRAPPER AND NOT THE `moosez` CLI
--------------------------------------
The CLI expects a directory of subject folders with nnU-Net-style file naming.
The Python entry point takes a plain path, which is what a build script wants.

**The `if __name__ == "__main__"` guard below is load-bearing, not boilerplate.**
macOS spawns rather than forks, so nnU-Net's segmentation-export worker
re-imports this module in each child process. Without the guard the child
re-runs inference, memory blows up, and nnU-Net reports

    RuntimeError: Segmentation export worker died. It was likely killed by
    your OS because of insufficient available CPU RAM.

which reads like an out-of-memory problem and is not one. Measured here: the
unguarded version peaked at 5.2 GB and died on a 2.6 MB single-slab CT.

ACCELERATOR
-----------
MOOSE picks cuda > mps > cpu itself (`moosez/system.py::get_accelerator_information`).
On Apple silicon that resolves to `mps`, and it works — see
docs/CT_ATLAS_PIPELINE.md for measured timings against `cpu` on the same scan.

OUTPUT
------
One `*_CT_<region>_<stem>.nii.gz` per model, in RAS orientation, each a
multi-label volume whose integers index that model's `dataset.json` labels.
`labelmap2glb.py` consumes those directly.
"""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path


DEFAULT_MODELS = [
    "clin_ct_organs",
    "clin_ct_ribs",
    "clin_ct_vertebrae",
    "clin_ct_peripheral_bones",
    "clin_ct_cardiac",
    "clin_ct_muscles",
    "clin_ct_digestive",
    "clin_ct_body",
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--ct", required=True, help="Path to a CT NIfTI (.nii.gz).")
    ap.add_argument("--out", required=True, help="Output directory.")
    ap.add_argument(
        "--models",
        default=",".join(DEFAULT_MODELS),
        help="Comma-separated MOOSE model names. Default: the 8 whole-body CT models.",
    )
    ap.add_argument(
        "--accelerator",
        default=None,
        choices=[None, "cpu", "mps", "cuda"],
        help="Force an accelerator. Default: let MOOSE choose (mps on Apple silicon).",
    )
    args = ap.parse_args()

    from moosez import moose  # imported late so --help stays fast

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    models = [m.strip() for m in args.models.split(",") if m.strip()]

    timings: dict[str, float] = {}

    def write_report() -> dict:
        report = {
            "ct": os.path.basename(args.ct),
            "accelerator": args.accelerator or "auto",
            "models_requested": models,
            "seconds_per_model": timings,
            "seconds_total": round(sum(timings.values()), 1),
            "complete": len(timings) == len(models),
        }
        (out / "moose_timings.json").write_text(json.dumps(report, indent=2))
        return report

    for model in models:
        t0 = time.time()
        moose(
            input_data=str(args.ct),
            model_names=model,
            output_dir=str(out),
            accelerator=args.accelerator,
        )
        timings[model] = round(time.time() - t0, 1)
        print(f"[run_moose] {model}: {timings[model]}s", flush=True)
        # Rewritten after every model, not once at the end: a full whole-body run
        # is the better part of an hour, and losing the timings because model
        # eight failed would be a silly way to lose the measurement.
        write_report()

    print(json.dumps(write_report(), indent=2))


if __name__ == "__main__":
    main()
