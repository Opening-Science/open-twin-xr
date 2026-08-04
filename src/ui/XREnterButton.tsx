import { useEffect, useState } from 'react'
import { xrStore } from '../scene/BodyScene'

/**
 * "View your twin in VR" button. Feature-detects WebXR immersive-vr and only
 * enables when a runtime is present (Quest browser, Vision Pro, desktop +
 * tethered headset). On unsupported browsers (notably iOS Safari) it stays
 * disabled with a hint. This is the browser-side entry to the OpenXR path.
 */
export function XREnterButton() {
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(m: string): Promise<boolean> } }).xr
    if (!xr) return
    xr.isSessionSupported('immersive-vr').then(setSupported).catch(() => setSupported(false))
  }, [])

  return (
    <button
      disabled={!supported}
      onClick={() => xrStore.enterVR()}
      title={supported ? 'Enter VR' : 'No WebXR VR runtime detected in this browser'}
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
