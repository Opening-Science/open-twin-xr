#!/usr/bin/env bash
#
# Compress every posed envelope bake that exists on disk.
#
# The rest-pose equivalent is the `convert:anny` npm script, which spells its
# five presets out inline. This one discovers its inputs instead, because the
# posed set is not a fixed list: `scripts/anny/measure_atlas_pose.mjs` decides
# how many DISTINCT poses the atlases actually need, and that number changes
# when an atlas is added, re-registered or re-measured. A hardcoded list here
# would silently stop converting a pose the moment the measurement produced a
# new one.
#
# ⚠️ SAME PIPELINE AS THE REST-POSE BAKE, DELIBERATELY IDENTICAL. meshopt with
# `--weld true --simplify false`, then AO, then the copyright string. A posed
# body that went through a different pipeline would differ from its rest-pose
# sibling in ways that have nothing to do with the pose.
#
#     npm run convert:anny:posed
#
set -euo pipefail

cd "$(dirname "$0")/../.."

CREDIT="ANNY — NAVER LABS Europe / NAVER Corporation. Apache-2.0 code over CC0-1.0 \
MakeHuman-derived shape assets. arXiv:2511.03589. Baked by open-twin-openXR \
scripts/anny/bake.py; no scan of any person. Posed to match an atlas — see \
scripts/anny/atlas-poses.json."

shopt -s nullglob
raws=(public/models/anny-*.pose-*.raw.glb)

if [ ${#raws[@]} -eq 0 ]; then
  echo "No posed bakes found. Run, for each pose id in scripts/anny/atlas-poses.json:"
  echo "  python3 scripts/anny/bake.py --out public/models --pose <id> --only adult-f,adult-m"
  exit 1
fi

for raw in "${raws[@]}"; do
  base="${raw%.raw.glb}"
  echo "converting $(basename "$raw")"
  gltf-transform optimize "$raw" "$base.opt.glb" \
    --compress meshopt --join false --instance false --weld true --simplify false
  node scripts/bake-ao.mjs "$base.opt.glb" --out "$base.glb"
  node scripts/set-copyright.mjs "$base.glb" "$CREDIT"
done

echo
echo "converted ${#raws[@]} posed bake(s):"
ls -la public/models/anny-*.pose-*.glb | grep -v '\.raw\.\|\.opt\.' | awk '{printf "  %-52s %6.0f KB\n", $NF, $5/1024}'
