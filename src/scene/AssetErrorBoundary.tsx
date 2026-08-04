import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Keeps a bad asset from taking the whole app down.
 *
 * `Body.tsx` already treats an **absent** GLB as a normal state: `useAtlasAvailability`
 * probes for the file and the procedural body renders until one appears. That probe is
 * a HEAD request, so it answers "is something there", not "can it be parsed" — and the
 * gap between those two is a real failure mode:
 *
 *   - a download interrupted part-way leaves a truncated GLB that passes the probe
 *   - a file saved in the wrong format, or the raw GLB where the compressed one belongs
 *   - a meshopt/Draco-compressed file whose decoder failed to load
 *
 * In all of those `useGLTF` throws during render. **Suspense does not catch errors** —
 * it catches promises — so without a boundary React unwinds the entire tree and the
 * visitor gets a blank canvas with the reason only in the console. For something shown
 * in a presentation that is the worst of the available outcomes: nothing renders, and
 * nothing says why.
 *
 * With this boundary the same failure degrades to the procedural body — a working,
 * honest, zero-asset human — and the console names the file that could not be read.
 *
 * ⚠️ **The UI stays quiet on purpose.** The procedural body is a legitimate state that
 * the app is designed to sit in, not an error screen, and it is already what a visitor
 * sees when no assets are installed. Surfacing "atlas failed to parse" in the interface
 * would need the atlas switcher to distinguish *absent* from *unreadable*, which means
 * routing this through the availability channel in the store. That is worth doing and
 * is not done here: the probe re-publishes availability on its own schedule and would
 * overwrite whatever the boundary wrote. Doing it properly means teaching the probe
 * about parse failures, not patching the result after the fact.
 */
export class AssetErrorBoundary extends Component<
  {
    children: ReactNode
    /** Rendered instead of `children` once a load has failed. */
    fallback: ReactNode
    /** What failed, for the console message — an asset URL or a source id. */
    label: string
    /**
     * What the reader now sees instead, e.g. "the procedural body took over" or
     * "that overlay is hidden". Required rather than defaulted, because `fallback`
     * is a `ReactNode` this class cannot describe on its own: an earlier version
     * hardcoded "was replaced by the procedural body" and so said exactly that when
     * an overlay failed to `fallback={null}` — the body was still there, only the
     * overlay had gone. A diagnostic that misdescribes the outcome sends the reader
     * looking in the wrong place.
     */
    consequence: string
    /**
     * Change this to give the subtree another attempt. Switching atlas must not be
     * permanently poisoned by an earlier atlas having been unreadable, and a boundary
     * with no reset would do exactly that: React keeps the errored state until the
     * component is remounted or told otherwise.
     */
    resetKey?: string
  },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false })
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Loud, and specific about which file. The generic React message names a
    // component, which is no help when the cause is one GLB out of ten.
    console.error(
      `[asset] ${this.props.label} failed to load — ${this.props.consequence}.\n` +
        `Check the file is a valid GLB and fully downloaded — a truncated file passes the ` +
        `presence probe and fails here. See docs/MODEL_PIPELINE.md.\n${error.message}`,
      info.componentStack,
    )
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
