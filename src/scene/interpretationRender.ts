import {
  INTERPRETATION_STYLES,
  type InterpretationVisualKey,
} from '../data/interpretationPresentation'
import type { SystemId } from '../data/schema'
import type { ViewerMode } from '../store'
import { structureTerm, type StructureEntry } from './structureEntry'

/** Same see-through token as the metrics muscle ghost in `AtlasBody.materialFor`. */
export const INTERPRETATION_NO_DATA_OPACITY = 0.22

export const PARAMETRIC_VIEWER_COLOR = '#d8c3b4'

export const XR_PANEL_WIDTH_PX = 768
export const XR_VIEWER_PANEL_HEIGHT_PX = 208
export const XR_INTERPRETATION_PANEL_HEIGHT_PX = 320
export const XR_VIEWER_PANEL_WORLD_HEIGHT = 0.136
export const XR_INTERPRETATION_PANEL_WORLD_HEIGHT = 0.21

const PATTERN_DARK = 0.74
const PATTERN_LIGHT = 1.08
const PATTERN_SCALE = 0.008

export interface InterpretationOpacityArgs {
  maskThis: boolean
  isShell: boolean
  visualKey: InterpretationVisualKey
  hullOpacity: number
}

export function interpretationOpacity({
  maskThis,
  isShell,
  visualKey,
  hullOpacity,
}: InterpretationOpacityArgs): number {
  if (isShell) return hullOpacity
  if (maskThis) return 1
  if (visualKey === 'no_data') return INTERPRETATION_NO_DATA_OPACITY
  return 1
}

export interface MeshVisibilityArgs {
  hiddenGroup?: boolean
  systemId: SystemId | null
  layer?: string
  hiddenSystems: readonly string[]
  hiddenLayers: readonly string[]
}

/** Visibility controls apply in every view, including Interpretation. */
export function meshIsVisible({
  hiddenGroup,
  systemId,
  layer,
  hiddenSystems,
  hiddenLayers,
}: MeshVisibilityArgs): boolean {
  if (hiddenGroup) return false
  if (layer && hiddenLayers.includes(layer)) return false
  if (systemId && hiddenSystems.includes(systemId)) return false
  return true
}

export function maskHiddenForInterpretation<T>(
  interpretationMode: boolean,
  hiddenIds: T | null,
): T | null {
  return interpretationMode ? null : hiddenIds
}

export interface RenderedFmaMesh {
  directTerm: string | null
  structureIds: readonly number[] | null
}

/** Exact FMA terms on geometry that is actually drawn after composition. */
export function availableFmaFromRendered(
  visible: readonly RenderedFmaMesh[],
  structures: readonly StructureEntry[] | null,
): string[] {
  const out = new Set<string>()
  for (const mesh of visible) {
    if (mesh.structureIds && mesh.structureIds.length > 0) {
      for (const id of mesh.structureIds) {
        const term = structureTerm(structures?.[id])
        if (term?.startsWith('FMA:')) out.add(term)
      }
      continue
    }
    if (mesh.directTerm?.startsWith('FMA:')) out.add(mesh.directTerm)
  }
  return [...out]
}

export function uniqueStructureIds(values: ArrayLike<number>): number[] {
  const ids = new Set<number>()
  for (let i = 0; i < values.length; i++) {
    const id = values[i]
    if (Number.isFinite(id)) ids.add(id)
  }
  return [...ids]
}

export function parametricInterpretationMaterial(viewerMode: ViewerMode): {
  color: string
  patternToken: number | null
} {
  if (viewerMode === 'interpretation') {
    return {
      color: INTERPRETATION_STYLES.no_data.color,
      patternToken: INTERPRETATION_STYLES.no_data.patternToken,
    }
  }
  return { color: PARAMETRIC_VIEWER_COLOR, patternToken: null }
}

function fract(value: number): number {
  return value - Math.floor(value)
}

function step(edge: number, value: number): number {
  return value >= edge ? 1 : 0
}

/** Hatch / crosshatch factor in object space. Token 0 is a single 45° hatch. */
export function patternFactor(
  token: number,
  objectPos: { x: number; y: number; z: number },
): number {
  const u = (objectPos.x + objectPos.y) / PATTERN_SCALE
  const v = (objectPos.x - objectPos.y) / PATTERN_SCALE
  const rounded = Math.floor(token + 0.5)
  if (rounded < 1) {
    return step(0.72, fract(u))
  }
  if (rounded > 5) {
    return Math.max(step(0.42, fract(u)), step(0.42, fract(v)))
  }
  if (rounded === 1) {
    const fx = fract(objectPos.x / (PATTERN_SCALE * 0.75)) - 0.5
    const fy = fract(objectPos.y / (PATTERN_SCALE * 0.75)) - 0.5
    return 1 - step(0.17, Math.hypot(fx, fy))
  }
  if (rounded === 2) return step(0.74, fract(v * 0.8))
  if (rounded === 3) return step(0.72, fract(objectPos.x / PATTERN_SCALE))
  if (rounded === 4) return step(0.72, fract(objectPos.y / PATTERN_SCALE))
  return step(0.58, fract(u / 0.75))
}

function mix(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

function channelLuminance(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string, modulation = 1): number {
  const [r, g, b] = hexToRgb(hex).map((c) => channelLuminance(Math.min(1, c * modulation)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Greyscale luminance of a categorical colour after its object-space pattern. */
export function patternMod(
  token: number,
  objectPos: { x: number; y: number; z: number },
): number {
  const style =
    token < 0.5
      ? INTERPRETATION_STYLES.no_data
      : token > 5.5
        ? INTERPRETATION_STYLES.indeterminate
        : INTERPRETATION_STYLES.none
  const modulation = mix(PATTERN_DARK, PATTERN_LIGHT, patternFactor(token, objectPos))
  return relativeLuminance(style.color, modulation)
}

export function wrapLines(
  text: string,
  widthOf: (line: string) => number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && widthOf(next) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

export function interpretationPatternFragment(tokenExpression: string): string {
  return `
    float otPatternToken = floor(${tokenExpression} + 0.5);
    float otU = (vOtPatternPos.x + vOtPatternPos.y) / ${PATTERN_SCALE.toFixed(4)};
    float otV = (vOtPatternPos.x - vOtPatternPos.y) / ${PATTERN_SCALE.toFixed(4)};
    float otDot = 1.0 - step(
      0.17,
      length(fract(vOtPatternPos.xy / ${(PATTERN_SCALE * 0.75).toFixed(4)}) - vec2(0.5))
    );
    float otPattern = step(0.72, fract(otU));
    if (otPatternToken > 0.5 && otPatternToken < 1.5) {
      otPattern = otDot;
    } else if (otPatternToken > 1.5 && otPatternToken < 2.5) {
      otPattern = step(0.74, fract(otV * 0.8));
    } else if (otPatternToken > 2.5 && otPatternToken < 3.5) {
      otPattern = step(0.72, fract(vOtPatternPos.x / ${PATTERN_SCALE.toFixed(4)}));
    } else if (otPatternToken > 3.5 && otPatternToken < 4.5) {
      otPattern = step(0.72, fract(vOtPatternPos.y / ${PATTERN_SCALE.toFixed(4)}));
    } else if (otPatternToken > 4.5 && otPatternToken < 5.5) {
      otPattern = step(0.58, fract(otU / 0.75));
    } else if (otPatternToken > 5.5) {
      otPattern = max(step(0.42, fract(otU)), step(0.42, fract(otV)));
    }
    diffuseColor.rgb *= mix(${PATTERN_DARK.toFixed(2)}, ${PATTERN_LIGHT.toFixed(2)}, otPattern);
  `
}

export function applyInterpretationPatternVaryings(shader: {
  vertexShader: string
  fragmentShader: string
}): void {
  if (!shader.vertexShader.includes('vOtPatternPos')) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOtPatternPos;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvOtPatternPos = transformed;',
      )
  }
  if (!shader.fragmentShader.includes('varying vec3 vOtPatternPos;')) {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vOtPatternPos;',
    )
  }
}
