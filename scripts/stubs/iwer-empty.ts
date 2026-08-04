/**
 * Production stub for IWER, the WebXR emulator.
 *
 * `createXRStore({ emulate: import.meta.env.DEV })` already prevents the emulator
 * from RUNNING in a build — but `@pmndrs/xr` imports it statically, so the module
 * graph still pulled in 5.7 MB of IWER runtime and synthetic-room fixtures. Vite
 * aliases the three IWER packages to this file when building, which removes them.
 *
 * Nothing here is ever called. The emulate branch is dead code in a production
 * build, so these exports exist only to satisfy the import.
 *
 * ⚠️ If a future version of `@pmndrs/xr` reaches for a different IWER export, the
 * build fails loudly on the missing name rather than shipping a broken emulator —
 * which is the outcome we want. Add the export here and keep it inert.
 */
export class XRDevice {
  constructor() {
    throw new Error(
      'IWER is stubbed out of production builds. The WebXR emulator is a dev-only ' +
        'tool — run `npm run dev` to use it.',
    )
  }
}
/** From `@iwer/devui` — the emulator's on-screen control panel. */
export class DevUI {
  constructor() {
    throw new Error('IWER DevUI is stubbed out of production builds.')
  }
}

/** From `@iwer/sem` — loads the synthetic rooms that made up 4.5 MB of the bundle. */
export class SyntheticEnvironmentModule {
  constructor() {
    throw new Error('IWER synthetic environments are stubbed out of production builds.')
  }
}

export const metaQuest3 = {}
export const metaQuest2 = {}
export const metaQuestPro = {}
export const oculusQuest1 = {}
export default {}
