import { useEffect, useState } from 'react'
import { xrStore } from '../scene/BodyScene'

/**
 * "View your twin in VR" button. Feature-detects WebXR immersive-vr and only
 * enables when a runtime is present (Quest browser, Vision Pro, desktop +
 * tethered headset). On unsupported browsers (notably iOS Safari) it stays
 * disabled with a hint. This is the browser-side entry to the OpenXR path.
 */
/**
 * Why `navigator.xr` may be missing even on a headset.
 *
 * Three causes, and they need different messages because only one of them is
 * "your browser cannot do this".
 *
 * ⚠️ THE IFRAME CASE IS THE ONE THAT PRODUCES NO ERROR AT ALL. `immersive-vr`
 * requires the `xr-spatial-tracking` permission policy, and an embedded frame
 * whose host page does not set `allow="xr-spatial-tracking"` simply has no
 * `navigator.xr` — indistinguishable, from inside, from an unsupported browser.
 * It is the most common real-world WebXR embed failure and the hardest to
 * diagnose, because the fix belongs to a page the developer may not have
 * realised is involved. Detecting it costs one `document.featurePolicy` check
 * and turns a dead end into an instruction.
 *
 * The secure-context case is separate: `navigator.xr` does not exist outside
 * HTTPS or localhost, which bites anyone testing on a LAN address.
 */
function diagnose(): { supported: boolean; reason: string } {
  if (typeof navigator === 'undefined') return { supported: false, reason: '' }

  const embedded = typeof window !== 'undefined' && window.self !== window.top
  const fp = (
    document as Document & {
      featurePolicy?: { allowsFeature(f: string): boolean }
      permissionsPolicy?: { allowsFeature(f: string): boolean }
    }
  ).featurePolicy
  const blocked = embedded && fp ? !fp.allowsFeature('xr-spatial-tracking') : false

  if (blocked)
    return {
      supported: false,
      reason:
        'This page is embedded in a frame that does not grant xr-spatial-tracking. ' +
        'The embedding page must set allow="xr-spatial-tracking" on the iframe.',
    }
  if (!window.isSecureContext)
    return {
      supported: false,
      reason: 'WebXR needs a secure context — serve over HTTPS, or use localhost.',
    }
  return { supported: false, reason: 'No WebXR VR runtime detected in this browser' }
}

export function XREnterButton() {
  const [supported, setSupported] = useState(false)
  const [reason, setReason] = useState('No WebXR VR runtime detected in this browser')

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(m: string): Promise<boolean> } }).xr
    if (!xr) {
      setReason(diagnose().reason)
      return
    }
    xr.isSessionSupported('immersive-vr')
      .then((ok) => {
        setSupported(ok)
        if (!ok) setReason('This browser has WebXR but no immersive-vr device is available.')
      })
      .catch(() => {
        setSupported(false)
        setReason(diagnose().reason)
      })
  }, [])

  return (
    <button
      disabled={!supported}
      onClick={() => xrStore.enterVR()}
      title={supported ? 'Enter VR' : reason}
      className={
        'rounded-full px-4 py-2 text-sm font-medium shadow-sm transition ' +
        (supported
          ? 'bg-[#4f9c84] text-white hover:bg-[#438a74]'
          : 'bg-surface text-muted cursor-not-allowed')
      }
    >
      {supported ? 'View twin in VR' : 'VR not available here'}
    </button>
  )
}
