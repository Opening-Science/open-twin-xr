#!/usr/bin/env python
"""
Verify docs/moose-uberon-crosswalk.tsv against the live ontology and the live code.

    .venv/bin/python verify_crosswalk.py [--crosswalk PATH] [--offline]

Four checks, all of which have caught a real error at least once:

1.  **Every UBERON CURIE resolves, and its label is the one we wrote down.**
    Fetched from EBI OLS4. This is the check that stops a plausible-looking but
    wrong id from shipping — UBERON's numbering is not contiguous (rib 8 and
    thoracic vertebra 8 both sit far outside their neighbours' range) and
    gluteus maximus/medius are not in the order anyone would guess.
2.  **`system` is in the closed SystemId set** parsed out of src/data/schema.ts.
3.  **`layer` is in the closed AnatomyLayer set** parsed out of src/store.ts.
    Both are read from the source files rather than duplicated here, so the
    crosswalk cannot drift away from the contract silently.
4.  **`moose_class` matches the class names MOOSE actually emits**, read from
    each downloaded model's dataset.json. Skipped for models not downloaded yet.
    Label integers get renumbered on retraining; the names are the stable key,
    and this is what proves we are keyed to them.

Exit code is non-zero if any check fails, so it can gate a build.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DEFAULT_CROSSWALK = REPO / "docs" / "moose-uberon-crosswalk.tsv"
OLS = "https://www.ebi.ac.uk/ols4/api/ontologies/uberon/terms?iri="


def read_crosswalk(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    header: list[str] | None = None
    for raw in path.read_text().splitlines():
        if raw.startswith("#") or not raw.strip():
            continue
        cells = raw.split("\t")
        if header is None:
            header = cells
            continue
        cells += [""] * (len(header) - len(cells))
        rows.append({k: v.strip() for k, v in zip(header, cells)})
    return rows


def ts_union(path: Path, type_name: str) -> set[str]:
    """The string literals of `export type <type_name> = 'a' | 'b' | ...`.

    Scoped to that one declaration on purpose: a loose repo-wide regex would
    also swallow the Provenance union and quietly accept an invalid system.
    """
    src = path.read_text()
    m = re.search(rf"export type {type_name}\s*=(.*?)(?:\n\n|\nexport |\n/\*\*)", src, re.S)
    return set(re.findall(r"'([a-z-]+)'", m.group(1))) if m else set()


def ts_const_array(path: Path, const_name: str) -> set[str]:
    """The string literals of `export const <const_name> = [...] as const`."""
    src = path.read_text()
    m = re.search(rf"{const_name}\s*=\s*\[(.*?)\]", src, re.S)
    return set(re.findall(r"'([a-z-]+)'", m.group(1))) if m else set()


def ols_label(curie: str) -> tuple[str, str | None]:
    iri = "http://purl.obolibrary.org/obo/" + curie.replace(":", "_")
    url = OLS + urllib.parse.quote(iri, safe="")
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                terms = json.load(r).get("_embedded", {}).get("terms", [])
            if not terms:
                return curie, None
            t = terms[0]
            return curie, ("[OBSOLETE]" if t.get("is_obsolete") else "") + (t.get("label") or "")
        except Exception:
            pass
    return curie, None


def moose_class_names() -> dict[str, set[str]]:
    """model folder -> class names, read from each downloaded dataset.json."""
    root = Path(__file__).parent / ".venv" / "lib"
    out: dict[str, set[str]] = {}
    for ds in root.glob("python3.*/site-packages/moosez/models/nnunet_trained_models/*/*/dataset.json"):
        labels = json.loads(ds.read_text()).get("labels", {})
        out[ds.parents[1].name] = {k for k in labels if k != "background"}
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--crosswalk", default=str(DEFAULT_CROSSWALK))
    ap.add_argument("--offline", action="store_true", help="Skip the OLS4 lookups.")
    args = ap.parse_args()

    rows = read_crosswalk(Path(args.crosswalk))
    systems = ts_union(REPO / "src" / "data" / "schema.ts", "SystemId")
    layers = ts_const_array(REPO / "src" / "store.ts", "ANATOMY_LAYERS")
    if not systems or not layers:
        print("FAIL could not parse SystemId / ANATOMY_LAYERS out of src/ — check the regexes")
        return 1
    print(f"SystemId={sorted(systems)}\nAnatomyLayer={sorted(layers)}")

    problems: list[str] = []
    flagged = [r for r in rows if r["status"] == "flag"]
    print(f"{len(rows)} rows, {len(rows) - len(flagged)} ok, {len(flagged)} flagged")

    # -- 2 & 3: closed sets ---------------------------------------------------
    for r in rows:
        if r["system"] not in systems:
            problems.append(f"{r['moose_class']}: system '{r['system']}' not in SystemId {sorted(systems)}")
        if r["layer"] not in layers:
            problems.append(f"{r['moose_class']}: layer '{r['layer']}' not in AnatomyLayer {sorted(layers)}")

    # -- 1: ontology round-trip ----------------------------------------------
    if not args.offline:
        curies = sorted({r["uberon"] for r in rows if r["uberon"]})
        want = {}
        for r in rows:
            if r["uberon"]:
                want.setdefault(r["uberon"], r["uberon_label"])
        with ThreadPoolExecutor(max_workers=8) as ex:
            got = dict(ex.map(ols_label, curies))
        for c in curies:
            if got[c] is None:
                problems.append(f"{c}: does not resolve in UBERON")
            elif got[c] != want[c]:
                problems.append(f"{c}: crosswalk says '{want[c]}', UBERON says '{got[c]}'")
        print(f"checked {len(curies)} distinct UBERON terms against OLS4")

    # -- 4: MOOSE class names -------------------------------------------------
    have = moose_class_names()
    if have:
        known = set().union(*have.values())
        seen_models = ", ".join(sorted(have))
        for r in rows:
            # Only assert for models whose weights are on disk; folder names do
            # not equal model ids, so match on the class-name union instead.
            if r["moose_class"] not in known and r["moose_model"] in _models_present(have):
                problems.append(f"{r['moose_class']}: not a class in any downloaded dataset.json")
        # And the other direction, which is the one that loses structures: a class
        # MOOSE emits with no crosswalk row is skipped silently by labelmap2glb.
        covered = {r["moose_class"] for r in rows}
        for folder, classes in sorted(have.items()):
            missing = sorted(classes - covered)
            if missing:
                problems.append(f"{folder}: {len(missing)} class(es) with no crosswalk row: {', '.join(missing)}")
        print(f"cross-checked class names against downloaded models: {seen_models}")
    else:
        print("no MOOSE weights downloaded yet — skipped the class-name check")

    for p in problems:
        print("FAIL " + p)
    print("OK" if not problems else f"{len(problems)} problem(s)")
    return 1 if problems else 0


# folder name -> model id is not 1:1; this is the mapping MOOSE's models.py uses.
_FOLDER_TO_MODEL = {
    "Dataset001_body": "clin_ct_body",
    "Dataset123_Organs": "clin_ct_organs",
    "Dataset444_Ribs": "clin_ct_ribs",
    "Dataset555_Muscles": "clin_ct_muscles",
    "Dataset666_Peripheral-Bones": "clin_ct_peripheral_bones",
    "Dataset111_Vertebrae": "clin_ct_vertebrae",
    "Dataset888_Cardiac": "clin_ct_cardiac",
    "Dataset999_Digestive": "clin_ct_digestive",
    "Dataset778_Body_composition": "clin_ct_body_composition",
    "Dataset333_HMS3dlungs": "clin_ct_lungs",
}


def _models_present(have: dict[str, set[str]]) -> set[str]:
    return {_FOLDER_TO_MODEL[f] for f in have if f in _FOLDER_TO_MODEL}


if __name__ == "__main__":
    sys.exit(main())
