/**
 * The registries that name shipped model files — THE ONE LIST.
 *
 * Two consumers, and they have to agree or a build ships a feature dead:
 * `pruneUnshippedModels` in `vite.config.ts` keeps only the files these name,
 * and `scripts/check-dist-assets.mjs` verifies what survived. They were two
 * hand-copied lists, and both missed `envelopePoses.ts` and `annyRig.ts` on
 * 18 August 2026, so a build pruned eight posed GLBs and two rig files while
 * the check reported success over the eighteen assets it knew about. One list,
 * imported by both, cannot drift.
 *
 * If you add a registry under `src/scene/`, add it here in the same commit.
 */
export const MODEL_REGISTRIES = [
  'anatomySources.ts',
  'organOverlays.ts',
  'bodyEnvelopes.ts',
  'annyGrid.ts',
  'envelopePoses.ts',
  'annyRig.ts',
]
