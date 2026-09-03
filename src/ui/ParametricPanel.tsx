import { useTwin } from '../store'
import {
  ANNY_AXES,
  ANNY_AXIS_INFO,
  BODY_DENSITY_KG_PER_M3,
  type AnnyAxis,
} from '../scene/annyGrid'
import { poseLimits, POSE_SLIDERS, type PoseSlider } from '../scene/annyRig'

/**
 * What each position slider means, in plain words.
 *
 * ⚠️ NAMED FOR THE MOVEMENT, NOT THE JOINT. "Arms out" says what the slider
 * does; "shoulder abduction, 0-60 deg" says what the rig does. The shape sliders
 * above make the same choice for the same reason — a control the reader has to
 * decode invites them to guess, and guessing is what put the gender axis
 * backwards in the notes this feature was built from.
 */
const POSE_SLIDER_INFO: Record<PoseSlider, { label: string; ends: [string, string] }> = {
  armAbduct: { label: 'Arms out', ends: ['down', 'raised'] },
  elbow: { label: 'Elbows', ends: ['straight', 'bent'] },
  hipAbduct: { label: 'Stance', ends: ['together', 'apart'] },
  knee: { label: 'Knees', ends: ['straight', 'bent'] },
}

/**
 * The parametric body's controls: six phenotype sliders and what the resulting
 * shape measures.
 *
 * ⚠️ THE SLIDERS NAME PARAMETERS, NOT PEOPLE, and the interface has to carry
 * that rather than leaving it in a comment. The shape space is MakeHuman artist
 * priors — not anthropometric ground truth — so a position in it is a shape, not
 * a person, and nothing here supports a measurement, body-composition or health
 * claim about anybody.
 *
 * Each slider names its own ENDS (`male`/`female`, `newborn`/`old`) rather than
 * showing a bare 0..1 number, because two of the six are counter-intuitive and
 * both were wrong in the notes this was built from: `gender` runs male to female,
 * and `age` spans five MakeHuman stops, so 0.75 is the adult and 0.5 an
 * adolescent. A number alone invites the reader to guess, and guessing is what
 * produced the error.
 *
 * ⚠️ THREE AXES ARE DELIBERATELY ABSENT and their absence is stated below rather
 * than left to be noticed. `race` is not an interpolable shape axis this project
 * will ship — ANNY excludes it from its own defaults too. `cupsize` and
 * `firmness` are body-shape controls on what is already a body-image surface.
 */
export function ParametricPanel() {
  const params = useTwin((s) => s.annyParams)
  const setParam = useTwin((s) => s.setAnnyParam)
  const reset = useTwin((s) => s.resetAnnyParams)
  const m = useTwin((s) => s.bodyMeasurements)

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-panel p-4 backdrop-blur-panel">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">Shape</h3>
        <button
          onClick={reset}
          className="text-[11px] text-muted transition hover:text-ink"
          title="Return every axis to the middle of the shape space"
        >
          reset
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {ANNY_AXES.map((axis: AnnyAxis) => {
          const info = ANNY_AXIS_INFO[axis]
          const v = params[axis]
          return (
            <div key={axis} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between text-[11px]">
                <label htmlFor={`anny-${axis}`} className="text-ink/80">
                  {info.label}
                </label>
                <span className="font-mono text-[10px] text-muted">{v.toFixed(2)}</span>
              </div>
              <input
                id={`anny-${axis}`}
                type="range"
                min={0}
                max={100}
                value={Math.round(v * 100)}
                onChange={(e) => setParam(axis, Number(e.target.value) / 100)}
                className="h-1.5 w-full accent-[#4f9c84]"
                // The ends are the meaning; the number is not self-describing.
                aria-label={`${info.label}, ${info.ends[0]} to ${info.ends[1]}`}
                aria-valuetext={`${v.toFixed(2)} between ${info.ends[0]} and ${info.ends[1]}`}
              />
              <div className="flex justify-between text-[9px] leading-none text-muted/70">
                <span>{info.ends[0]}</span>
                <span>{info.ends[1]}</span>
              </div>
            </div>
          )
        })}
      </div>

      <PositionControls />

      {/*
        What the shape measures.

        ⚠️ TWO OF THESE FIVE ARE NOT MEASURED. Height, waist and volume are read
        off the mesh. Mass and BMI are DERIVED from volume by assuming one uniform
        density — a real body is not uniform — so they are properties of a shape
        under a stated assumption. The assumption is printed rather than buried,
        which is the difference between a derived figure and a claim.
      */}
      {m && (
        <div className="flex flex-col gap-1 border-t border-line pt-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            <Row label="Height" value={`${(m.heightM * 100).toFixed(1)} cm`} />
            <Row label="Waist" value={`${m.waistCm.toFixed(1)} cm`} />
            <Row label="Volume" value={`${m.volumeL.toFixed(1)} L`} />
            <Row label="Mass" value={`${m.massKg.toFixed(1)} kg`} derived />
            <Row label="BMI" value={m.bmi.toFixed(1)} derived />
          </div>
          <p className="text-[9px] leading-snug text-muted/70">
            Height, waist and volume are measured from the surface. Mass and BMI are derived from
            volume at an assumed uniform {BODY_DENSITY_KG_PER_M3} kg/m³ — a body is not uniform, so
            they describe this generated shape and not a person.
          </p>
        </div>
      )}

      <p className="border-t border-line pt-2 text-[9px] leading-snug text-[#8a6d3b]">
        A generated surface with no organs, no donor and no scan of anyone. The shape space is
        artist priors from MakeHuman rather than measured population data, so no position in it is
        a measurement of a human body. Skin tone, ancestry and chest-shape axes are deliberately
        not offered.
      </p>
    </div>
  )
}

/**
 * The position sliders — where the limbs are, as opposed to what shape the body
 * is.
 *
 * ⚠️ SEPARATE GROUP FROM "SHAPE", AND NOT A COSMETIC SPLIT. The two answer
 * different questions and only one of them feeds the measurements below: height,
 * waist, volume, mass and BMI are all taken on the REST shape, before any of
 * these are applied (see `ParametricBody`). A body with bent knees is not
 * shorter, and letting a pose slider move a stated height would be inventing a
 * measurement out of a rotation.
 *
 * ⚠️ THE PANEL HIDES ITSELF WHEN THE RIG IS NOT INSTALLED. `anny-grid.rig` is an
 * optional asset like every binary here, and a control that renders but cannot
 * act is this repository's named failure — the hull pill says "no skin" rather
 * than sitting inert. Absent rig, the shape sliders work and this group is
 * simply not there. The same holds for a rig baked for a different grid: the
 * body refuses it and publishes nothing, so no slider appears that could not act.
 *
 * The rig is read from the store rather than fetched here. `ParametricBody` is
 * the one component that has the grid to check a rig against, and it used to be
 * that this panel fetched and decoded a second copy of the same file for the
 * sake of four number pairs.
 */
function PositionControls() {
  const pose = useTwin((s) => s.annyPose)
  const setPose = useTwin((s) => s.setAnnyPose)
  const resetPose = useTwin((s) => s.resetAnnyPose)
  const rig = useTwin((s) => s.annyRig)

  if (!rig) return null
  const limits = poseLimits(rig)
  const posed = POSE_SLIDERS.some((s) => Math.abs(pose[s]) > 0.5)

  return (
    <div className="flex flex-col gap-2 border-t border-line pt-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">Position</h3>
        <button
          onClick={resetPose}
          className="text-[11px] text-muted transition hover:text-ink"
          title="Return every limb to the model's own rest pose"
        >
          reset
        </button>
      </div>

      {POSE_SLIDERS.map((slider) => {
        const info = POSE_SLIDER_INFO[slider]
        const [lo, hi] = limits[slider]
        const v = pose[slider]
        return (
          <div key={slider} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between text-[11px]">
              <label htmlFor={`pose-${slider}`} className="text-ink/80">
                {info.label}
              </label>
              <span className="font-mono text-[10px] text-muted">{v.toFixed(0)}°</span>
            </div>
            <input
              id={`pose-${slider}`}
              type="range"
              min={lo}
              max={hi}
              step={1}
              value={v}
              onChange={(e) => setPose(slider, Number(e.target.value))}
              className="h-1.5 w-full accent-[#4f9c84]"
              aria-label={`${info.label}, ${lo} to ${hi} degrees`}
              aria-valuetext={`${v.toFixed(0)} degrees`}
            />
            <div className="flex justify-between text-[9px] leading-none text-muted/70">
              <span>{info.ends[0]}</span>
              <span>{info.ends[1]}</span>
            </div>
          </div>
        )
      })}

      {/*
        ⚠️ THE RANGE CAP IS STATED, because a slider that stops is otherwise read
        as a bug. It stops where linear blend skinning starts to pinch the joint,
        which is a limit of the deformation method and not of any body.
      */}
      <p className="text-[9px] leading-snug text-muted/70">
        Left and right move together. The ranges stop short of where the surface starts to pinch at
        a joint — a limit of the skinning, not of a body — and none of this is range-of-motion or
        ergonomic data.
        {posed && ' The measurements below are taken at rest, so posing does not change them.'}
      </p>
    </div>
  )
}

function Row({ label, value, derived }: { label: string; value: string; derived?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted">
        {label}
        {derived && (
          <span className="text-muted/60" title="derived from volume, not measured">
            {' '}
            ·
          </span>
        )}
      </span>
      <span className="font-mono text-[10px] text-ink/80">{value}</span>
    </div>
  )
}
