#!/usr/bin/env node
/**
 * Screenshot the running app into `docs/preview.png` — the README's hero image.
 *
 * WHY A SCRIPT AND NOT A MANUAL SCREENSHOT
 * ---------------------------------------
 * The image README shows is a claim about what the app looks like, and it had gone
 * stale: it showed the procedural placeholder long after real atlases were
 * rendering, with alt text that said so. A hand-taken screenshot goes out of date
 * silently and at a different rate from the code. This makes regenerating it one
 * command, so a UI change can carry its own picture.
 *
 * It also earns its keep as a check. The first full-page capture immediately
 * exposed a CSS bug invisible in normal use — the closed `<dialog>` was rendering
 * inline below the fold, because an unqualified `display: grid` beats the UA
 * stylesheet's `dialog:not([open]) { display: none }`.
 *
 * HOW
 * ---
 * Headless Chrome driven over the DevTools protocol. No new dependencies: Node has
 * `fetch` and `WebSocket` built in, and Chrome is already on the machine. Nothing
 * is installed and no browser is downloaded.
 *
 * ⚠️ It needs the dev server already running — `npm run dev` — because it
 * photographs the real app rather than a build. It waits for an atlas to be
 * CREDITED rather than for a fixed delay, since that is the app's own signal that
 * the availability probe resolved and geometry is in the scene. With no atlases
 * installed you get the honest placeholder view instead, which is also a true
 * picture, just not the one the README wants.
 *
 * Usage:
 *   npm run gen:preview
 *   node scripts/gen-preview.mjs --url http://localhost:5173 --out docs/preview.png
 *   node scripts/gen-preview.mjs --click Z-Anatomy --width 1600 --height 1000
 *   CHROME_PATH=/path/to/chrome node scripts/gen-preview.mjs
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i === -1 ? d : argv[i + 1]
}
const has = (n) => argv.includes(`--${n}`)

if (has('help')) {
  console.log(
    'Usage: node scripts/gen-preview.mjs [--url URL] [--out FILE] [--click LABEL]\n' +
      '                                   [--width N] [--height N] [--scale N] [--keep-raw]\n\n' +
      '  --click LABEL   press a control before shooting, by its exact visible text\n' +
      '                  (e.g. "Z-Anatomy", "Male", "♥Beating heart")\n' +
      '  --scale N       capture at N× then downsample, for crisp text. Default 2\n' +
      '  --keep-raw      also keep the full-resolution capture beside the output\n\n' +
      'Requires `npm run dev` to already be running.',
  )
  process.exit(0)
}

const URL_ = arg('url', 'http://localhost:5173')
const OUT = arg('out', 'docs/preview.png')
const CLICK = arg('click', '')
const W = Number(arg('width', '1600'))
const H = Number(arg('height', '1000'))
const SCALE = Number(arg('scale', '2'))

/**
 * Find a Chromium-family browser.
 *
 * `CHROME_PATH` wins, so this is not a macOS-only script; otherwise try the usual
 * install locations and then the PATH. It reports what it looked for on failure,
 * because "Chrome not found" without a list is a dead end.
 */
function findChrome() {
  if (process.env.CHROME_PATH) {
    // Checked rather than trusted: an unspawnable path raises an unhandled 'error'
    // event and prints a stack trace, which reads as a bug in this script.
    if (!existsSync(process.env.CHROME_PATH)) {
      console.error(`CHROME_PATH is set to ${process.env.CHROME_PATH}, which does not exist.`)
      process.exit(1)
    }
    return process.env.CHROME_PATH
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ]
  for (const c of candidates) if (existsSync(c)) return c
  console.error(
    'No Chromium-family browser found. Set CHROME_PATH, or install one of:\n  ' +
      candidates.join('\n  '),
  )
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Node 22 or newer, because of one global.
 *
 * This script talks to Chrome over the DevTools protocol using the built-in
 * `WebSocket`, which is unflagged only from Node 22 — Node 20, which CI pins, does
 * not have it. Without this check the failure is `WebSocket is not defined` at the
 * moment Chrome is already running, which reads as a browser problem rather than a
 * runtime-version one.
 */
if (typeof WebSocket === 'undefined') {
  console.error(
    `This script needs Node 22+ for the built-in WebSocket. You are on ${process.version}.\n` +
      'Nothing else in the repo does — only this one, because it speaks CDP.',
  )
  process.exit(1)
}

// Fail early and clearly if the dev server is not up — the alternative is a
// screenshot of Chrome's error page, which looks like a bug in the app.
try {
  const res = await fetch(URL_, { method: 'GET' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
} catch (e) {
  console.error(`Cannot reach ${URL_} (${e.message}). Start the dev server first: npm run dev`)
  process.exit(1)
}

const CHROME = findChrome()
const profile = mkdtempSync(join(tmpdir(), 'openxr-preview-'))
const port = 9500 + Math.floor(Math.random() * 400)

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`,
    '--hide-scrollbars',
    // WebGL in headless goes through SwiftShader; without these the canvas is blank.
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
)
chrome.stderr.on('data', () => {}) // Chrome is chatty on stderr even when healthy
chrome.on('error', (e) => {
  console.error(`Could not launch ${CHROME}: ${e.message}`)
  process.exit(1)
})

const cleanup = () => {
  try { chrome.kill() } catch {}
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
}
process.on('exit', cleanup)

const target = await (async () => {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const p = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (p) return p
    } catch {}
    await sleep(250)
  }
  console.error('Chrome never exposed a DevTools target.')
  process.exit(1)
})()

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = () => rej(new Error('could not attach to Chrome'))
})

let seq = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
}
const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++seq
    pending.set(id, res)
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  return r.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: W,
  height: H,
  deviceScaleFactor: SCALE,
  mobile: false,
})
await send('Page.navigate', { url: URL_ })

for (let i = 0; i < 200 && !(await evaluate('!!document.querySelector("canvas")')); i++) await sleep(250)

if (CLICK) {
  const hit = await evaluate(
    `(() => { const b = [...document.querySelectorAll('button')]
        .find(e => e.textContent.trim() === ${JSON.stringify(CLICK)});
      if (b) b.click(); return !!b })()`,
  )
  if (!hit) console.warn(`[preview] no control labelled ${JSON.stringify(CLICK)} — shooting the default view`)
  await sleep(500)
}

/**
 * Wait for the app's own readiness signal rather than a fixed sleep.
 *
 * The credits panel falls back to "No atlas installed" until the availability
 * probe resolves, so anything else means an atlas is loaded and being credited.
 * With no assets on disk that never becomes true, hence the bounded wait and the
 * note rather than a hang.
 */
let credited = false
for (let i = 0; i < 240; i++) {
  credited = await evaluate(`(() => {
    const h = [...document.querySelectorAll('h3')].find(x => /Anatomy credits/.test(x.textContent));
    const t = h?.parentElement?.textContent || '';
    return t.length > 0 && !/No atlas installed/.test(t);
  })()`)
  if (credited) break
  await sleep(500)
}
if (!credited) {
  console.warn(
    '[preview] no atlas was credited — shooting the procedural placeholder. Install an atlas\n' +
      '          (public/models/README.md) if you want real anatomy in the image.',
  )
}
// Meshes still have to upload and the first frames to draw after that.
await sleep(6000)

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
const raw = Buffer.from(shot.result.data, 'base64')
const rawPath = `${OUT.replace(/\.png$/, '')}.raw.png`

/**
 * Downsample the high-DPI capture, if `sharp` is reachable.
 *
 * Capturing at 2× and halving gives visibly crisper text than capturing at 1×, and
 * a smaller file than shipping the 2× image. `sharp` arrives with
 * `@gltf-transform/cli` rather than being declared here, so it is treated as
 * optional: without it the 2× capture is written as-is and says so, rather than the
 * script failing over an image-quality nicety.
 */
let wrote = null
try {
  const sharp = require('sharp')
  const out = await sharp(raw).resize(W).png({ compressionLevel: 9 }).toBuffer()
  writeFileSync(OUT, out)
  if (has('keep-raw')) writeFileSync(rawPath, raw)
  wrote = `${W}x${H} (downsampled from ${W * SCALE}x${H * SCALE})`
} catch {
  writeFileSync(OUT, raw)
  wrote = `${W * SCALE}x${H * SCALE} — sharp unavailable, so not downsampled`
}

console.log(`[preview] wrote ${OUT} — ${wrote}, ${(statSync(OUT).size / 1024).toFixed(0)} KB`)
ws.close()
process.exit(0)
