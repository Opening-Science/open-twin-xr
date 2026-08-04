import { useMemo, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { BufferGeometry } from 'three'
import type { SystemId, SystemScore } from '../data/schema'
import { useTwin, type AnatomyLayer } from '../store'
import { scoreToColor, scoreToEmissive } from './metricColor'
import { anatomicalColor, scoreLift } from './anatomyPalette'
import { ORGAN_PARTS, type OrganPart } from './anatomy/layout'
import { setHoverCursor, useHoverRelease } from './hoverCursor'

/**
 * The zero-asset human twin.
 *
 * Renders every body system from procedurally-generated anatomical geometry
 * (`anatomy/organGeometry.ts`), coloured by health score. This is what the app
 * shows until a real atlas GLB is dropped in; `AtlasBody` takes over then, and
 * the interaction contract is identical either way.
 *
 * Three rendering states, matching the three honest data states:
 *   measured        full colour on the red-amber-green scale
 *   proxy-derived   same, and the UI badges it elsewhere
 *   no data         neutral grey, semi-transparent, still selectable
 */

/** Geometry is expensive to build; do it once per part, not per render. */
function useOrganGeometry(): Map<string, BufferGeometry> {
  return useMemo(() => {
    const m = new Map<string, BufferGeometry>()
    for (const part of ORGAN_PARTS) m.set(part.term, part.build())
    return m
  }, [])
}

function Organ({
  part,
  geometry,
  system,
}: {
  part: OrganPart
  geometry: BufferGeometry
  system?: SystemScore
}) {
  const selectedSystem = useTwin((s) => s.selectedSystem)
  const select = useTwin((s) => s.selectSystem)
  const colourMode = useTwin((s) => s.colourMode)
  const hullOpacity = useTwin((s) => s.hullOpacity)
  const [hovered, setHovered] = useState(false)
  const anatomical = colourMode === 'anatomical'

  const selected = selectedSystem === part.system
  // Something else is selected: recede so the selection reads clearly.
  const dimmed = selectedSystem !== null && !selected

  // Missing system is "no data", NOT a middling score. Never default to 5.
  const score = system?.hasData ? system.score : null
  const color = anatomical ? anatomicalColor(part.system, undefined) : scoreToColor(score)
  const emissive = anatomical ? scoreLift(score) : scoreToEmissive(score)
  const noData = score === null

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    select(selected ? null : part.system)
  }
  // `hovered` is local state and dies with the component; the cursor does not.
  // Declared before the handlers because they need the token it returns.
  const hoverToken = useHoverRelease()
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
    setHoverCursor(true, hoverToken)
  }
  const onOut = () => {
    setHovered(false)
    setHoverCursor(false, hoverToken)
  }

  if (part.shell) {
    // The skin. Always translucent so the organs read through it; brightens
    // when integumentary is the selected system.
    return (
      <mesh
        geometry={geometry}
        position={part.position}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerOut={onOut}
      >
        <meshStandardMaterial
          color={selected || hovered ? color : '#bcd3e6'}
          transparent
          opacity={selected ? Math.max(hullOpacity, 0.3) : hullOpacity}
          roughness={0.12}
          metalness={0}
          emissive={color}
          emissiveIntensity={selected ? emissive * 0.6 : 0}
          depthWrite={false}
        />
      </mesh>
    )
  }

  const scale = selected || hovered ? 1.04 : 1

  // Selection wins over everything: a selected structure is always solid, even
  // one that normally recedes so the viewer can see past it.
  const base = part.baseOpacity ?? 1
  const opacity = selected
    ? 1
    : noData
      ? dimmed
        ? 0.14
        : 0.34
      : dimmed
        ? base * 0.35
        : hovered
          ? Math.min(1, base + 0.35)
          : base

  return (
    <mesh
      geometry={geometry}
      position={part.position}
      scale={scale}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerOut={onOut}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered && !selected ? emissive + 0.15 : emissive}
        roughness={0.42}
        metalness={0.02}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  )
}

export function ProceduralBody() {
  const data = useTwin((s) => s.data)
  const geometry = useOrganGeometry()
  // The placeholder must obey the same controls as the atlas. It used to ignore
  // them entirely, so while the atlas was still loading every toggle looked
  // dead — which read as the whole feature being broken rather than as the
  // fallback simply not implementing it.
  const hiddenSystems = useTwin((s) => s.hiddenSystems)
  const hiddenLayers = useTwin((s) => s.hiddenLayers)

  const byId = useMemo(
    () => new Map<SystemId, SystemScore>((data?.systems ?? []).map((s) => [s.id, s])),
    [data],
  )

  return (
    <group>
      {ORGAN_PARTS.map((part) => {
        const geo = geometry.get(part.term)
        if (!geo) return null
        if (hiddenSystems.includes(part.system)) return null
        // The procedural body has no muscle; its skeleton stands in for bone.
        const layer: AnatomyLayer | null =
          part.system === 'musculoskeletal' ? 'bone' : part.shell ? null : 'organ'
        if (layer && hiddenLayers.includes(layer)) return null
        return (
          <Organ key={part.term} part={part} geometry={geo} system={byId.get(part.system)} />
        )
      })}
    </group>
  )
}
