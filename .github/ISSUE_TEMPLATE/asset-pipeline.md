---
name: Asset pipeline
about: A build, conversion or bake problem
labels: pipeline
---

## Which command

<!-- The exact npm script or node invocation, with flags. -->

## Which source asset, and where from

<!-- Filename and size. For Z-Anatomy, which of the seven FBX files. -->

## What the gates say

<!-- Output of check:structures / check:winding / check:licences, if it got that far. -->

## Machine

<!-- RAM matters more than cores here: `gltf-transform optimize` peaks at 1-2 GB for
     a 400-550 MB source, and two conversions at once have died silently. The AO bake
     is single-threaded, ~52 min for Z-Anatomy and ~2 h for HRA, so a "hang" may just
     be a bake. -->
