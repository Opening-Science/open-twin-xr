#!/usr/bin/env node
/**
 * Z-Anatomy FBX -> one GLB per the atlas contract.
 *
 * Z-Anatomy is BodyParts3D retopologised by medical illustrators, which is the
 * whole reason to want it: the raw BodyParts3D meshes have documented holes and
 * non-manifold geometry, and that cleanup is exactly the work Z-Anatomy already
 * did. See D11 in docs/DECISIONS.md for what it costs.
 *
 * ⚠️ LICENCE — READ BEFORE ADDING A FILE HERE
 * -------------------------------------------
 * Z-Anatomy is an AGGREGATE. Its README shows a blanket CC BY-SA 4.0 badge and
 * its own `Resources/Models/License.txt` contradicts it — FOUR components come
 * from third parties on other terms:
 *
 *     Anatomy of the Inner Ear     CC BY-NC-SA 4.0    University of Dundee
 *     Cranial Nerves and Foramina  CC BY 4.0          University of Dundee, CAHID
 *     Kidney (lissiecowley)        CC BY-NC 4.0
 *     "Brainder / White matter"    upstream credit WRONG — resolved, see below
 *
 * ⚠️ THREE OF THE FOUR ARE IN `COMPONENTS`; THE CAHID CRANIAL NERVES ARE NOT, AND
 * THAT IS DELIBERATE (docs/PLAN_NEXT.md item 3). Their geometry is not separable
 * from Z-Anatomy's own nerves by name, and a guessed pattern once caught the
 * cochlear NERVE along with the cochlea. A confidently wrong tag is worse than an
 * honest gap. What is NOT foregone is the credit: CC BY 4.0 requires attribution,
 * so the component is named in `COPYRIGHT_MAIN` below, in `licences.json`, and in-app
 * by `AtlasAttribution`. It was missing from the first two until 17 August 2026 —
 * i.e. from exactly the two credits that travel with the file.
 *
 * **Per D12b this script imports all of it.** The project is not becoming a
 * commercial product, stays open source, and renders every attribution its
 * sources require, so a complete body with an accurate record beats a partial
 * body. Each affected structure is tagged in the structure table via
 * `COMPONENTS` below, and `npm run check:licences` turns those tags into
 * `docs/LICENCE_LOG.md` for pre-publication due diligence.
 *
 * ⚠️ The "one item attribution cannot settle" is SETTLED (D20, 17 August 2026).
 * The upstream credit — "'Brainder' and 'White matter' from the University of
 * Washington", no licence — spent three weeks as this build's one
 * undistributable component. Then its named source answered: Anderson M.
 * Winkler of brainder.org denies any UW affiliation, ever, and the measured
 * geometry splits the component in two. The telencephalon pair is a
 * Brainder-style grey/white boundary surface — CC BY-SA 3.0, see
 * `white-matter-brainder` in `COMPONENTS`. The spinal-cord tube cannot be his
 * (Brainder is cortex-only) and returns to Z-Anatomy's own default — see the
 * note where its tag used to be. Nothing in this file is excluded by
 * `--publishable` any more; the flag stays, for the next unlicensed component.
 *
 * ⚠️ Three of the four systems added on 28 July — Nervous, CardioVascular and
 * Lymphoid — were NEVER licence-blocked. They are plain CC BY-SA and were simply
 * unbuilt; D11's "take only skeletal and muscular" was a statement about what was
 * needed then, and got read for months afterwards as if it were a licence
 * boundary.
 *
 * Usage:
 *   node scripts/build-z-anatomy.mjs --src ~/Downloads/z-anatomy
 *   node scripts/build-z-anatomy.mjs --src DIR --no-merge   # keep structures apart
 */
import { createRequire } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { Document, NodeIO } = require('@gltf-transform/core')
const THREE = require('three')

// FBXLoader is written for the browser and reaches for `self`. It needs nothing
// else — no DOM, no fetch — because we hand it an ArrayBuffer via `parse()`.
globalThis.self = globalThis
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')

/**
 * Which files to take, and what they mean in our contract.
 *
 * `system` is free here. BodyParts3D needed an offline walk of the FMA IS-A and
 * PART-OF trees to work out which system a mesh belonged to; Z-Anatomy ships one
 * file per system, so the answer is the filename.
 */
const SOURCES = [
  { file: 'SkeletalSystem100.fbx', system: 'musculoskeletal', layer: 'bone' },
  { file: 'MuscularSystem100.fbx', system: 'musculoskeletal', layer: 'muscle' },
  { file: 'Joints100.fbx', system: 'musculoskeletal', layer: 'connective' },
  /**
   * Carries two third-party components among 578 structures of Z-Anatomy's own
   * nervous geometry: the Dundee inner ear (CC BY-NC-SA) and the University of
   * Washington white matter (no licence stated). `docs/ROADMAP.md` Phase 3
   * predicted this and a name scan confirmed it. Both are imported and tagged —
   * see COMPONENTS.
   */
  { file: 'NervousSystem100.fbx', system: 'nervous', layer: 'organ' },
  // ⚠️ Version suffix 41, where every other file is 100. Z-Anatomy's convention
  // appears to encode completeness, so treat this as possibly partial and check
  // what it actually contains rather than assuming full vascular coverage.
  { file: 'CardioVascular41.fbx', system: 'cardiovascular', layer: 'organ' },
  // Spleen, thymus, palatine tonsil and ~106 lymph node groups.
  //
  // `lymphoid` is NOT in `SystemId` (src/data/schema.ts) and that is deliberate.
  // SystemId is the HEALTH-DATA contract, and D8 put health mapping upstream in
  // etzm/open-twin; adding a system here for a purely geometric reason would
  // drift this repo's copy of a contract it does not own. `systemForGroup`
  // therefore returns null for these meshes and `AtlasBody` renders them
  // unresolved — visible, hoverable and named, just not score-coloured, which is
  // exactly right for a body viewer that no longer does scoring.
  //
  // Mapping them onto an existing system instead would be a fabrication: the
  // spleen is not cardiovascular and the thymus is not endocrine.
  { file: 'LymphoidOrgans100.fbx', system: 'lymphoid', layer: 'organ' },
  /**
   * Contains the CC BY-NC kidney (lissiecowley), imported and tagged.
   *
   * Also the one file where "one FBX per system" breaks: viscera span digestive,
   * respiratory, endocrine, reproductive and urinary, so the system comes from
   * the mesh name via `visceralSystem()` rather than from the filename.
   */
  { file: 'VisceralSystem100.fbx', system: visceralSystem, layer: 'organ' },
  /**
   * SURFACE TOPOGRAPHY — a different KIND of atlas, so its own GLB.
   *
   * ⚠️ This is not the licence quarantine that D12b removed. It is a separate
   * file because it is separate SUBJECT MATTER: 256 named regions of the body
   * SURFACE — cubital fossa, carotid triangle, deltoid region, the parts of the
   * auricle — which lie on the skin and would occlude every organ if merged into
   * the anatomy. As its own atlas source it is one click in the switcher.
   *
   * `system: 'regions'` resolves to no `SystemId` on purpose, exactly like
   * `lymphoid`: a topographic region is not a body system, and mapping the
   * carotid triangle onto "cardiovascular" would be a fabrication. It renders
   * unresolved — visible, hoverable, named, not score-coloured.
   *
   * NO `layer` either. Bone / muscle / connective / organ are tissue depths and a
   * surface region is none of them, so it is left undefined rather than forced
   * into the nearest one. `AtlasBody` already treats a layer-less mesh as never
   * hidden by the layer chips, which is the right behaviour here.
   */
  {
    file: 'Regions of human body100.fbx',
    system: 'regions',
    layer: undefined,
    asset: 'regions',
  },
]

/**
 * Which body system a visceral structure belongs to, from its name.
 *
 * Built by reading all 103 distinct structures in `VisceralSystem100.fbx` rather
 * than from a general anatomy prior, so it covers that file exactly. Order
 * matters — first match wins — because several patterns overlap: the pharynx
 * segments are respiratory *and* digestive by different conventions, and the
 * segmental bronchi carry lung-lobe words that would otherwise catch on
 * digestive terms.
 *
 * `urinary` maps to **metabolic**, which is not a guess: it is the convention
 * already established by `docs/bodyparts3d-system-map.tsv`, where the offline FMA
 * walk assigned left/right kidney, both ureters and the urinary bladder to
 * `metabolic`. Matching it keeps the two atlases mutually substitutable, which is
 * the entire point of `COMPOSED_SOURCE`.
 */
const VISCERAL_SYSTEM = [
  // `nasopharynx` must precede the digestive `pharynx`; laryngo- and oropharynx
  // fall through to digestive, which is the convention BodyParts3D uses.
  [/bronch|lung|trachea|pleura|epiglottis|nasal_cavity|nasopharynx/i, 'respiratory'],
  [/prostate|testis|epididym|ductus_deferens|ejaculatory|seminal|corpus_cavernosum|corpus_spongiosum|glans_penis/i, 'reproductive'],
  // ⚠️ ENDOCRINE MUST PRECEDE METABOLIC. "Suprarenal_gland" contains "renal", so
  // the urinary pattern below claims the adrenal gland if it runs first — and the
  // result is an endocrine organ silently coloured as a kidney.
  [/hypophysis|pineal|thyroid|parathyroid|suprarenal/i, 'endocrine'],
  [/kidney|renal|ureter|urethra|urinary/i, 'metabolic'],
  [
    /liver|gallbladd|bile|pancrea|stomach|duoden|jejun|ileum|colon|caec|appendix|oesophag|tongue|gingiva|palate|uvula|parotid|submandibular|sublingual|omentum|mesocolon|meso-appendix|taenia|pharynx/i,
    'digestive',
  ],
]

/**
 * PROVENANCE, NOT EXCLUSION.
 *
 * Z-Anatomy is an aggregate: most of it is the authors' own CC BY-SA work, but a
 * few components come from third parties on different terms. An earlier version
 * of this script quarantined those into separate GLBs so a publish gate could
 * refuse them. **That approach was reversed** — see D12b. The project takes
 * everything the atlas offers and records what each piece is, so the licence
 * position is a fact on file rather than a hole in the body.
 *
 * Each entry tags matching structures with the component they came from. The tag
 * travels into the structure table, so every downstream consumer — the
 * attribution bar, the due-diligence log, a future publish review — reads the
 * same source of truth instead of re-deriving it from mesh names.
 *
 * ⚠️ The name tests are anchored with `^...$` on purpose. A substring test on
 * "cochlea" also catches "Anterior cochlear nucleus" and "Cochlear nerve", which
 * are Z-Anatomy's own brainstem and nerve geometry, not Dundee's sense organ.
 * Getting this backwards over-attributes, which is its own kind of wrong.
 */
const COMPONENTS = [
  {
    id: 'inner-ear-dundee',
    /**
     * ⚠️ INNER ear only. `Tympanic_membrane` and `Auditory_tube` were tagged here
     * and should not have been — those are MIDDLE ear structures, and Dundee's
     * component is "Anatomy of the Inner Ear". Tagging them marked geometry that
     * is almost certainly Z-Anatomy's own as non-commercial, which needlessly
     * constrains it. Over-attribution is its own kind of wrong.
     *
     * The inner ear is the bony labyrinth: cochlea and vestibule (and the
     * semicircular canals, which this atlas does not name separately).
     */
    match: /^(Cochlea|Vestibule)[lr]?$/i,
    licence: 'CC BY-NC-SA 4.0',
    holder: 'University of Dundee School of Medicine',
    title: 'Anatomy of the Inner Ear',
    note:
      'Non-commercial and share-alike. Attribution is required and is rendered by ' +
      'AttributionBar. The sense organ only — the cochlear and vestibular NERVES and ' +
      'NUCLEI are Z-Anatomy’s own and are not tagged.',
  },
  {
    id: 'kidney-lissiecowley',
    match: /^(Kidney|Renal_pelvis)[lr]?$/i,
    licence: 'CC BY-NC 4.0',
    holder: 'lissiecowley',
    title: 'Kidney',
    note: 'Non-commercial. Attribution required.',
  },
  {
    id: 'white-matter-brainder',
    /**
     * ⚠️ TELENCEPHALON ONLY — the spinal cord is deliberately NOT here (below).
     *
     * This component was `white-matter-uw`, `NONE STATED`, University of
     * Washington, and `--publishable` dropped it. Re-identified and relicensed
     * on 17 August 2026 (D20) on three legs, each independent of the others:
     *
     *   1. Z-Anatomy's own licence file names the component "Brainder" — and
     *      Brainder IS brainder.org, Anderson M. Winkler's project. The
     *      "University of Washington" half of that credit is DENIED by Winkler
     *      himself, in writing: neither he nor Brainder was ever affiliated
     *      with UW.
     *   2. Winkler's discriminator: Brainder ships CORTICAL surfaces — pial,
     *      and a "white" surface that is the grey/white BOUNDARY. Measured on
     *      this very FBX: each hemisphere is one closed folded shell,
     *      sphericity 0.219 (folded-cortical range), gyri and sulci throughout,
     *      smooth medial wall — exactly a FreeSurfer-style white surface, and
     *      nothing like tract geometry.
     *   3. Left and right are exact mirrors of one source hemisphere, which is
     *      how you use a downloaded reference model, not how you sculpt.
     *
     * WHY PUBLISHABLE EITHER WAY: if derived from Brain for Blender, the grant
     * is CC BY-SA 3.0, and §4(b) of that licence permits distributing
     * adaptations under a later version — our CC BY-SA 4.0 asset qualifies. If
     * instead it was "used as reference" only (upstream's other phrasing), the
     * geometry is Z-Anatomy's own CC BY-SA 4.0. BOTH branches carry a licence;
     * the only reading that blocked distribution — an unlicensed UW release —
     * is the one the named source denies. Winkler's confirmation from the
     * renders decides the CREDIT WORDING, not the publishability.
     */
    match: /^White_matter_of_telencephalon[lr]?$/i,
    licence: 'CC BY-SA 3.0',
    holder: 'Anderson M. Winkler (Brainder)',
    title: 'Brain for Blender — white (grey/white boundary) surface',
    note:
      'The grey/white BOUNDARY surface of the cerebral hemispheres, not white matter ' +
      'proper — Winkler’s own distinction, and the measured geometry agrees. Credit ' +
      'wording awaits his preference; the identification and the licence do not.',
  },
  /**
   * ⚠️ `White_matter_of_spinal_cord` is NO LONGER TAGGED, and that is a
   * decision, not an oversight (D20). It was swept into `white-matter-uw` by a
   * name regex, but it is a different object entirely: an open smooth tube
   * following the vertebral canal — measured 255 boundary edges, no folding.
   * Brainder is cortex-only by its author's statement, so it cannot be his;
   * and the only line ever tying it to a third party was the UW credit that
   * source denies. With that line discredited, the mesh returns to the file's
   * default: Z-Anatomy's own CC BY-SA 4.0 work, like every other untagged
   * structure. Tagging it to ANY component now would be over-attribution — the
   * inner-ear pattern's mistake again. Item 2 of docs/OUTREACH.md asks
   * upstream to confirm.
   */
]

/**
 * Z-Anatomy name+side -> FMA term, from `docs/z-anatomy-fma.tsv`.
 *
 * Z-Anatomy ships no ontology ids of its own, which D11 records as the reason
 * the term join is outstanding. `scripts/build-crosswalk.mjs` closes part of the
 * gap by joining against BodyParts3D — the atlas Z-Anatomy was retopologised
 * FROM, so the two describe the same body and a name match is a real
 * correspondence rather than a guess.
 *
 * Optional by design: a missing file is not an error, it just means no terms.
 * Partial coverage is expected and correct — roughly a thousand Z-Anatomy
 * structures are finer-grained than anything BodyParts3D names, and those stay
 * termless rather than being assigned something approximate.
 */
const CROSSWALK = (() => {
  const m = new Map()
  try {
    const tsv = require('node:fs').readFileSync('docs/z-anatomy-fma.tsv', 'utf8')
    for (const line of tsv.split('\n').slice(1)) {
      const [name, side, fma] = line.split('\t')
      if (name && fma) m.set(`${name}|${side || ''}`, fma)
    }
  } catch {
    /* no crosswalk yet — structures simply carry no term */
  }
  return m
})()

/** The component a structure came from, or null for Z-Anatomy's own geometry. */
function componentOf(name) {
  return COMPONENTS.find((c) => c.match.test(name)) ?? null
}

/** True when this mesh may not be distributed and the build is a publishable one. */
function excludedForPublication(name) {
  if (!PUBLISHABLE) return false
  const c = componentOf(name)
  return c ? /none stated|unlicensed|unknown/i.test(c.licence) : false
}

function visceralSystem(name) {
  for (const [re, system] of VISCERAL_SYSTEM) if (re.test(name)) return system
  // Deliberately fatal. A visceral structure quietly defaulting to one system
  // would colour a lung as a liver, and nothing downstream would report it —
  // the same class of silent-wrongness the winding and structure checks exist
  // to catch. Add the pattern above instead.
  throw new Error(
    `visceralSystem: no system matches "${name}". Add it to VISCERAL_SYSTEM — ` +
      `do NOT let it default, a mis-systemed organ is invisible downstream.`,
  )
}

/** Scene furniture, not anatomy. Z-Anatomy ships clipping helpers in every file. */
const HELPER = /^(Cross_Section|Reference|Plane|Axis|Grid|Camera|Light|Take_a_picture)/i

/**
 * Landmark markers and their leader lines — annotation, not anatomy.
 *
 * Z-Anatomy labels named *surface features* of bones (the soleal line, the
 * medial malleolus, gnathion, the infrasternal angle). These are ridges, points
 * and angles ON a bone, not separate structures, so they are drawn as small
 * marker boxes with a stick pointing out to where the label text would sit. The
 * sticks are what rendered as thin needles radiating out through the skin.
 *
 * The suffix is the reliable signal, and the measurements say it is safe to
 * trust: in SkeletalSystem100 these are 966 meshes carrying 12,318 triangles —
 * 0.75 % of the file — and the two largest, `Gnathionj` (618 v) and
 * `Superior_thyroid_notchj` (558 v), are a craniometric point and a notch, so
 * both are correctly annotation. MuscularSystem100 and Joints100 contain no
 * i/j-suffixed mesh at all, so this rule cannot touch muscle or ligament
 * geometry even by accident.
 *
 * Do NOT widen this to "36 vertices", which was the tempting version: Joints100
 * has 52 genuine 36-vertex ligaments (`Dorsal_cuboideonavicular_ligamentl` and
 * friends) that a size-based rule would silently delete.
 */
const ANNOTATION = /[ij]$/

/**
 * Above this many vertices, an `i`/`j` suffix is overruled and the mesh is kept.
 *
 * 618 is the largest genuine annotation marker measured across all seven files
 * (`Gnathionj`), so 700 is that with headroom. See the rationale at the use site
 * — this exists because `Falx_cerebri` is 44,172 vertices of real dura.
 */
const ANNOTATION_MAX_VERTS = 700

/**
 * Construction geometry — axes, meridians, curves, paths, cross-section
 * profiles. Diagram scaffolding, not anatomy.
 *
 * Z-Anatomy ships these to build its own illustrations: the optical axis of the
 * eyeball, its equator and meridians, the ciliary body and zonular fibre
 * *curves*, a medulla *path*, an oesophagus *profile*. They are lines and open
 * sheets with essentially no volume.
 *
 * They were caught by `check-structures.mjs`, not by inspection: 8 of the 9
 * structures the simplifier collapsed to nothing were these. That is the
 * simplifier behaving correctly — there is no volume to preserve — but it left
 * the structure table advertising 8 structures the geometry no longer contained,
 * which is exactly the drift that check exists to catch. Dropping them at import
 * keeps the table honest.
 *
 * ⚠️ `axis` alone would be a disastrous pattern: the **axis** is the C2 vertebra.
 * The `_of_` is load-bearing in all three of the first group.
 */
const CONSTRUCTION = /(^|_)(axis|equator|meridians)_of_|-(curve|path|profile)[lr]?$/i

/**
 * Real anatomy that cannot survive the compression pipeline. Dropped so the
 * structure table does not advertise geometry the asset does not contain.
 *
 * `Mucosa of stomach` is the stomach's inner lining, modelled as a thin surface
 * geometrically COINCIDENT with the stomach wall. Weld merges the two into one
 * surface and simplify then collapses it: it was the last entry
 * `check-structures.mjs` reported with no vertices, and it survived neither
 * `--simplify-error 0.001` nor `0.0005`.
 *
 * ⚠️ THIS IS A PIPELINE LIMIT, NOT AN ANATOMICAL JUDGEMENT — the difference
 * matters if anyone revisits it. Nothing is wrong with the source mesh, and
 * `Mucosa of nasal cavity` from the same file comes through fine because it is
 * not coincident with anything. Recovering this one needs its own
 * non-simplified path, not a different threshold; the alternative considered and
 * rejected was pruning orphaned table entries after simplification, which means
 * remapping ids across 1.6 M vertices to rescue a single structure.
 */
const UNSHIPPABLE = /^Mucosa_of_stomach$/i

/** Every atlas is normalised to this standing height so sources line up. */
const CANONICAL_HEIGHT_M = 1.7

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? fallback : argv[i + 1]
}
const SRC = arg('src')
const OUT = arg('out', 'public/models/z-anatomy.glb')
const MERGE = !argv.includes('--no-merge')
/**
 * `--publishable` drops components that carry NO LICENCE STATEMENT.
 *
 * D12b's rule is import everything, record everything — and that is right,
 * because the constraint is on DISTRIBUTION, not on import. Nothing stops us
 * holding, viewing or measuring geometry locally.
 *
 * Publishing is where it bites, and a login wall does not change that: serving
 * to authenticated users is still distribution. Attribution answers a licence's
 * conditions; it cannot manufacture a grant that was never made. So the research
 * build keeps everything and the deployed build drops what cannot lawfully
 * travel — one flag, rather than two divergent pipelines.
 *
 * It deliberately drops only the NO-LICENCE case. The CC BY-NC and CC BY-NC-SA
 * components stay: non-commercial is compatible with this project's stated
 * stance (open source, not sold), and they need attribution rather than removal.
 */
const PUBLISHABLE = argv.includes('--publishable')

if (!SRC) {
  console.error(
    'Usage: node scripts/build-z-anatomy.mjs --src <dir with Z-Anatomy FBX> [--out FILE] [--no-merge]\n\n' +
      'Get the FBX from:\n' +
      '  https://github.com/LluisV/Z-Anatomy/tree/PC-Version/Resources/Models/FBX\n',
  )
  process.exit(1)
}

/**
 * Every raw mesh name in the import, filled during collection.
 *
 * Needed because laterality cannot be decided from one name in isolation — see
 * `splitName`. Populated before any call to `splitName`, which is safe because
 * all three call sites run after the SOURCES loop finishes.
 */
const rawNames = new Set()

/**
 * The same names under a punctuation-insensitive key, for the pairing test.
 *
 * Z-Anatomy's two sides are not always spelled identically. The middle cerebral
 * artery ships as `Middle_cerebral_artery_(M3-segment)r` and
 * `Middle_cerebral_artery_(M3_segment)l` — hyphen against underscore — and its
 * insular branches as `(M2)r` against `(M2-segment)l`. An exact-match pairing
 * test reads those as four unpaired structures and declines to give any of them a
 * side, even though they are plainly the left and right of the same vessel.
 *
 * Collapsing case and `-_ ` before comparing fixes it. The risk of over-matching
 * is negligible here: it would take two genuinely different structures whose
 * names differ ONLY in punctuation and a final l/r.
 *
 * Built lazily because `rawNames` is not complete until the SOURCES loop is.
 */
let rawKeys = null
const pairKey = (s) => s.toLowerCase().replace(/[-_ ]/g, '')

/**
 * Structures that genuinely end in `l`/`r` AND genuinely sit on one side.
 *
 * The pairing rule below cannot distinguish these from a midline structure whose
 * name merely ends in the letter, because neither has a counterpart. Both
 * measured off `z-anatomy.ao.glb`: x = -0.017 and x = +0.241, so both really are
 * lateral, and both really are modelled for one side only.
 *
 * Keep this list SHORT and evidence-based. Anything added here is a laterality
 * claim nothing else in the build verifies.
 */
const ONE_SIDED = new Set(['Intra-articular_ligament_of_head_of_ribl', 'Ulnopisiform_ligamentl'])

/**
 * Mesh names whose trailing `l`/`r` is part of the WORD, not a side.
 *
 * Filled from geometry once the body's bounds are known — see `findMidline()`.
 * Declared here so it reads next to the rule it corrects; it is empty until
 * then, and nothing calls `splitName` before it is filled.
 */
const MIDLINE = new Set()

/**
 * Laterality is a name suffix in Z-Anatomy: `l` and `r`.
 *
 * ⚠️ THE SUFFIX ALONE IS NOT ENOUGH, and reading it that way shipped a bug.
 * `Vomer` is a single midline bone; the naive rule `/^(.*?)([lr])$/` stripped its
 * final `r` and emitted `{ name: "Vome", side: "right" }` — a structure name that
 * does not exist plus a laterality claim that is false.
 *
 * TWO INDEPENDENT KINDS OF EVIDENCE, and both are needed. They were developed
 * separately and neither subsumes the other:
 *
 * 1. **Geometry** (`MIDLINE`, measured by `findMidline`). A mesh that straddles
 *    the body's midline by a meaningful share of its own width is not a lateral
 *    structure whatever its name ends in. Measured rather than hardcoded, so a
 *    different atlas gets the same protection.
 * 2. **Pairing.** A trailing `l`/`r` is laterality only when the OTHER side also
 *    exists in the import. `Femurl` pairs with `Femurr`; `Vomer` has no `Vomel`.
 *
 * Neither alone is sufficient once viscera are imported. The midline test misses
 * `Gallbladder`, which sits entirely to the right and so straddles nothing — it
 * would still ship as "Gallbladde", side right. The pairing test in turn cannot
 * see geometry at all, so it would accept a midline structure that happened to
 * have a counterpart-shaped name. Together they cover both.
 *
 * It fails safe either way. An unpaired structure keeps its full name and gets NO
 * side, which is at worst an odd-looking label; the old behaviour invented an
 * anatomy term and asserted a side. A false claim about the body is the worse
 * outcome. `ONE_SIDED` then buys back the two structures measured to be genuinely
 * one-sided.
 *
 * An earlier version read a trailing `j` as "one object spanning both sides".
 * That was wrong too — `j` marks a label leader line (see ANNOTATION), so those
 * meshes are dropped at import and never reach here.
 */
function splitName(raw, useAttachmentEvidence = false) {
  // Geometry wins outright: a mesh crossing the midline is not one side of a pair.
  if (MIDLINE.has(raw)) return { name: raw.replace(/_/g, ' ').trim(), side: undefined }

  const m = raw.match(/^(.*?)([lr])$/)
  if (!m) return { name: raw.replace(/_/g, ' ').trim(), side: undefined }

  if (!rawKeys) rawKeys = new Set([...rawNames].map(pairKey))
  const paired = rawKeys.has(pairKey(`${m[1]}${m[2] === 'l' ? 'r' : 'l'}`))
  /**
   * Third kind of evidence: stripping the letter exposes an ATTACHMENT SITE.
   *
   * Attachment sites compose two suffixes — `<muscle><o|e><slip?><l|r>`, e.g.
   * `Serratus_posterior_superior_musclee3l`. Roughly 25 are modelled for one side
   * only, so the pairing test finds no counterpart and they would keep the
   * trailing `l`. That is not merely ugly: with the `l` attached, `attachmentOf`
   * no longer sees the `e3` pattern and the structure loses its attachment
   * metadata entirely.
   *
   * It cannot rescue the false positives this function exists to prevent:
   * `Vomer` -> "Vome" would need a structure called "Vom", `Liver` -> "Live"
   * would need "Liv". Neither exists, so both correctly stay whole.
   */
  const attachmentEvidence =
    useAttachmentEvidence &&
    !paired &&
    // `quiet` — this is an existence test for laterality evidence, not a real
    // attachment classification, and counting it would inflate the tally the
    // build reports for the secondary rules.
    attachmentOf(m[1].replace(/_/g, ' ').trim(), undefined, true) !== null

  const lateral = paired || ONE_SIDED.has(raw) || attachmentEvidence
  const name = (lateral ? m[1] : raw).replace(/_/g, ' ').trim()
  const side = lateral ? { l: 'left', r: 'right' }[m[2]] : undefined
  return { name, side }
}

/**
 * Which l/r-suffixed meshes are actually centred on the midline.
 *
 * A structure that genuinely belongs to one side lies (almost) wholly on that
 * side; one that is centred on the midline straddles it evenly. So measure how
 * much of a mesh's own width sits on the THINNER side of the midline: exactly
 * 0.5 for something perfectly centred, near 0 for something lateral.
 *
 * The two populations separate cleanly, which is what makes this safe. Measured
 * across all 1,971 l/r-suffixed meshes in the three imported files:
 *
 *     Vomer                             0.500   the midline bone, mis-split
 *     Interspinales_lumborum_muscles*   0.137   highest genuine — paravertebral
 *     Parietal_bone*                    0.091   meet at the sagittal suture
 *     Trapezius / platysma / latissimus 0.011-0.029
 *
 * Everything between 0.011 and 0.137 is a real paraspinal or scalp muscle that
 * merely reaches across the midline, and every one of those arrives as a mirrored
 * `l`+`r` PAIR. Only the vomer sits in the centred band. The threshold is placed
 * in the empty gap between the two populations — 1.8x above the highest genuine
 * value and 2x below the measured midline one — so it is not tuned to one name.
 *
 * Note this cannot catch a midline structure that Z-Anatomy models as two
 * halves; that is a different thing and correctly sided.
 */
const MIDLINE_FRACTION = 0.25

function findMidline(groups, centreX) {
  const found = []
  for (const g of groups.values()) {
    for (const p of g.parts) {
      if (!/[lr]$/.test(p.name)) continue
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < p.positions.length; i += 3) {
        const x = p.positions[i] - centreX
        if (x < lo) lo = x
        if (x > hi) hi = x
      }
      const width = hi - lo
      if (width <= 0) continue
      // How far the mesh reaches past the midline, as a share of its own width.
      const across = Math.min(hi, -lo)
      if (across > 0 && across / width > MIDLINE_FRACTION) {
        MIDLINE.add(p.name)
        found.push(`${p.name} (${(across / width).toFixed(3)} centred)`)
      }
    }
  }
  return found
}

/** Flatten an FBX scene to world-space triangle soup, one entry per mesh. */
function collect(root) {
  const out = []
  let dropped = 0
  let mirrored = 0
  const rescued = []
  let construction = 0
  let unpublishable = 0
  root.updateMatrixWorld(true)
  root.traverse((o) => {
    if (!o.isMesh || HELPER.test(o.name)) return
    if (CONSTRUCTION.test(o.name) || UNSHIPPABLE.test(o.name)) {
      construction++
      return
    }
    if (excludedForPublication(o.name)) {
      unpublishable++
      return
    }
    if (ANNOTATION.test(o.name)) {
      /**
       * Size is a VETO on the suffix, not a rule of its own.
       *
       * Every annotation marker measured is a small box; the largest across all
       * seven files is 618 vertices. So anything substantially bigger is not a
       * marker, whatever it ends in — and the previous version of this dropped it
       * anyway and merely warned, which meant a build could print a warning
       * nobody read and ship missing anatomy.
       *
       * ⚠️ IMPORTING THE NERVOUS SYSTEM PROVED THIS. `NervousSystem100.fbx` has
       * exactly two `i`-suffixed meshes and BOTH are real: `Falx_cerebri` (44,172
       * verts, the dural fold between the hemispheres) and `Septal_nuclei`
       * (1,644). The `i` convention collides head-on with Latin anatomical names
       * — cerebri, nuclei, gemelli — so on that file the rule was wrong 100 % of
       * the time. The other 120 dropped there are `j` leader lines, which is the
       * convention working exactly as D11a described.
       *
       * This is strictly safer than the D11a rule: it can only ever KEEP more
       * geometry, never delete more. D11a's warning against a size-based rule
       * still stands and is not contradicted — that was about using size INSTEAD
       * of the suffix, which would have deleted 52 genuine 36-vertex ligaments.
       * Here size only ever rescues.
       */
      const verts = o.geometry.getAttribute('position')?.count ?? 0
      if (verts <= ANNOTATION_MAX_VERTS) {
        dropped++
        return
      }
      rescued.push(`${o.name} (${verts} verts)`)
      // fall through — this is anatomy, not a label
    }
    const g = o.geometry
    const pos = g.getAttribute('position')
    if (!pos) return
    const idx = g.getIndex()
    const m = o.matrixWorld
    const v = new THREE.Vector3()

    // Bake the world transform in. Z-Anatomy nests up to seven deep, and the
    // GLB is written flat, so the hierarchy has to be resolved here or every
    // structure lands at the origin.
    const positions = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m)
      positions[i * 3] = v.x
      positions[i * 3 + 1] = v.y
      positions[i * 3 + 2] = v.z
    }
    const indices = idx
      ? Uint32Array.from(idx.array)
      : Uint32Array.from({ length: pos.count }, (_, i) => i)

    /**
     * Mirrored structures must have their winding reversed.
     *
     * Z-Anatomy builds the body's second side by MIRRORING the first — a
     * negative-determinant transform. Baking that matrix into vertex positions
     * (above) moves the vertices correctly but reverses each triangle's
     * orientation, so the mirrored half ends up wound backwards.
     *
     * That matters here specifically because the GLB carries no NORMAL
     * attribute, so `AtlasBody` calls `computeVertexNormals()`, which derives
     * normals from winding. Backwards winding therefore produces normals
     * pointing INTO the body, and since non-shell materials use `side:
     * FrontSide`, the whole mirrored half gets back-face culled: you see
     * through it to the inside of the far wall. On screen that reads as one
     * smooth, washed-out half of the body with a hard seam down the midline —
     * which is exactly what it did before this line existed.
     *
     * Caught by signed volume: the two halves of the merged bone and muscle
     * meshes came out with opposite signs (+0.0040 vs -0.0027), while every
     * BodyParts3D mesh agreed. Triangle counts and surface area were symmetric
     * to within 0.4 %, so nothing simpler than orientation was wrong.
     */
    if (m.determinant() < 0) {
      for (let i = 0; i < indices.length; i += 3) {
        const t = indices[i + 1]
        indices[i + 1] = indices[i + 2]
        indices[i + 2] = t
      }
      mirrored++
    }

    out.push({ name: o.name, positions, indices })
  })
  out.dropped = dropped
  out.mirrored = mirrored
  out.rescued = rescued.length
  out.construction = construction
  out.unpublishable = unpublishable
  if (rescued.length) {
    // Informational, not a warning: the rule did its job. Worth printing because
    // a name ending in i/j that is NOT a label is exactly the case where someone
    // should eyeball whether ANNOTATION still describes this file at all.
    console.log(
      `[z-anatomy]   kept ${rescued.length} i/j-suffixed mesh(es) as anatomy, too large to be labels:` +
        `\n           ${rescued.slice(0, 8).join('\n           ')}`,
    )
  }
  return out
}

console.log(`[z-anatomy] source ${SRC}`)
const groups = new Map() // key -> { system, layer, parts: [] }
let totalMeshes = 0
let totalTris = 0

for (const src of SOURCES) {
  const path = join(SRC, src.file)
  if (!existsSync(path)) {
    // A missing file is a silently short atlas, which is the failure mode this
    // project keeps hitting. Say so loudly rather than producing a partial body.
    console.warn(`[z-anatomy] MISSING ${src.file} — skipping. The atlas will be incomplete.`)
    continue
  }
  const buf = require('node:fs').readFileSync(path)
  const t0 = Date.now()
  const root = new FBXLoader().parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
  )
  const parts = collect(root)
  const tris = parts.reduce((a, p) => a + p.indices.length / 3, 0)
  totalMeshes += parts.length
  totalTris += tris
  const perMesh = typeof src.system === 'function'
  console.log(
    `[z-anatomy] ${src.file}: ${parts.length} meshes, ${Math.round(tris).toLocaleString()} tris ` +
      `(${((Date.now() - t0) / 1000).toFixed(1)}s) -> ` +
      `${perMesh ? 'per-mesh' : src.system}/${src.layer}` +
      (parts.dropped ? `  [dropped ${parts.dropped} annotation]` : '') +
      (parts.construction ? `  [dropped ${parts.construction} construction]` : '') +
      (parts.unpublishable ? `  [dropped ${parts.unpublishable} UNLICENSED — publishable build]` : '') +
      (parts.mirrored ? `  [rewound ${parts.mirrored} mirrored]` : ''),
  )

  for (const p of parts) {
    // Laterality needs to see every name before it can decide any of them, so
    // record first and split later. See `splitName`.
    rawNames.add(p.name)

    // Viscera resolve their system from the mesh name; every other file gets it
    // from the filename. `visceralSystem` throws rather than defaulting.
    const system = perMesh ? src.system(p.name) : src.system

    // Merging by (system, layer) matches how the app colours, toggles and
    // selects, and matches what build-bodyparts3d.mjs already produces. The cost
    // is per-structure hover; --no-merge keeps it at the price of ~2,600 draw
    // calls, which is over the Quest budget on its own.
    //
    // The mesh NAME is system/layer (or just system where the source declares no
    // layer, as surface regions do). The map KEY additionally carries the target
    // asset, because two assets may legitimately contain the same system/layer
    // and must not share a mesh.
    const base = src.layer ? `${system}/${src.layer}` : system
    const name = MERGE ? base : `${base}/${p.name}`
    const asset = src.asset ?? 'main'
    const key = `${asset}::${name}`
    if (!groups.has(key)) groups.set(key, { name, system, layer: src.layer, asset, parts: [] })
    groups.get(key).parts.push(p)
  }
}

if (!groups.size) {
  console.error('[z-anatomy] nothing collected — check --src points at the FBX directory')
  process.exit(1)
}
console.log(
  `[z-anatomy] ${totalMeshes} meshes, ${Math.round(totalTris).toLocaleString()} triangles ` +
    `-> ${groups.size} group(s)${MERGE ? '' : ' (merge disabled)'}`,
)

// --- normalise into the canonical frame -----------------------------------
// Derived from the loaded bounds rather than assumed, so a source in different
// units or a different up-axis still lands correctly.
//
// ⚠️ MEASURED OVER THE `main` ASSET ONLY, and every asset is then scaled by that
// one factor. The surface-region patches sit ON the skin, so including them
// stretched the measured bounds from 170.9 to 174.4 and scaled the whole
// SKELETON down by 2 % to compensate — which silently misaligned Z-Anatomy
// against BodyParts3D and HRA, each independently normalised to 1.7 m.
//
// The canonical height is a property of the BODY. Regions inherit the body's
// scale rather than redefining it, which is also what keeps the two files
// overlaying exactly.
const min = [Infinity, Infinity, Infinity]
const max = [-Infinity, -Infinity, -Infinity]
for (const g of groups.values())
  for (const p of (g.asset === 'main' ? g.parts : []))
    for (let i = 0; i < p.positions.length; i += 3)
      for (let a = 0; a < 3; a++) {
        const val = p.positions[i + a]
        if (val < min[a]) min[a] = val
        if (val > max[a]) max[a] = val
      }
const size = max.map((v, i) => v - min[i])
const upAxis = size.indexOf(Math.max(...size))
console.log(`[z-anatomy] bounds ${size.map((s) => s.toFixed(1)).join(' x ')} (longest axis ${'XYZ'[upAxis]})`)

const scale = CANONICAL_HEIGHT_M / size[upAxis]
const swapZY = upAxis === 2 // Blender/FBX exports are commonly Z-up

// Needs the bounds, because the midline is the centre of the body's own x
// extent — the same centre the write below subtracts — not wherever x=0
// happens to fall in the source file.
const midline = findMidline(groups, (min[0] + max[0]) / 2)
console.log(
  `[z-anatomy] midline: ${midline.length} l/r-suffixed mesh(es) are centred, ` +
    `so the suffix is part of the word` +
    (midline.length ? `\n           ${midline.join('\n           ')}` : ''),
)
console.log(
  `[z-anatomy] scaling by ${scale.toExponential(3)} to ${CANONICAL_HEIGHT_M} m` +
    (swapZY ? ', rotating Z-up -> Y-up' : ''),
)

// --- write ------------------------------------------------------------------
/**
 * ONE DOCUMENT. Everything the atlas offers goes in.
 *
 * This reverses the three-file split that stood for about an hour on 28 July
 * (see D12b). That version quarantined the non-CC-BY-SA components into
 * `-nc.glb` and `-unlicensed.glb` so a publish gate could refuse them by
 * filename. The reason it is gone: the project is not going to be a commercial
 * product, it stays open source, and it will carry every attribution its sources
 * ask for — so the useful artifact is a COMPLETE body plus an accurate record,
 * not a body with holes in it.
 *
 * The record is per structure. `componentOf()` tags each one with the third-party
 * component it came from, that tag lands in the structure table, and
 * `check-licences.mjs` reads it back out to generate `docs/LICENCE_LOG.md`. So
 * "which parts of this file are not plain CC BY-SA" is answerable from the
 * shipped asset itself, at any point in the future, without re-running the FBX
 * import.
 */
/**
 * `asset.copyright` names every rights holder whose geometry is in THAT file —
 * two strings, because the two assets do not contain the same work.
 *
 * These are the credits that travel INSIDE the assets when everything around them
 * is lost. The in-app `AttributionBar` renders the same sets.
 *
 * ⚠️ `COPYRIGHT_MAIN` IS THE FULL SET FROM UPSTREAM'S `License.txt`, NOT THE SET
 * IN `COMPONENTS`. The CAHID cranial nerves are credited here and never tagged per
 * structure — see the licence note at the top of this file. Deriving this string
 * from `COMPONENTS` would therefore drop a required credit, which is how it went
 * missing in the first place.
 */
const ZA_AND_BP3D =
  'Z-Anatomy - The open source atlas of anatomy - CC-BY-SA 4.0; '
const DERIVED_FROM =
  'derived from BodyParts3D - The Database Center for Life Science - CC-BY-SA 2.1 Japan'

const COPYRIGHT_MAIN =
  ZA_AND_BP3D +
  'incl. Anatomy of the Inner Ear by University of Dundee School of Medicine (CC-BY-NC-SA 4.0), ' +
  'Cranial Nerves and Foramina by University of Dundee, CAHID (CC-BY 4.0), ' +
  'Kidney by lissiecowley (CC-BY-NC 4.0), ' +
  'and white matter boundary surfaces from Brain for Blender by Anderson M. Winkler, brainder.org (CC-BY-SA 3.0); ' +
  DERIVED_FROM

/**
 * ⚠️ THE REGIONS ASSET GETS A NARROWER CREDIT, AND MUST.
 *
 * `Regions of human body100.fbx` contains none of the four third-party
 * components — it is body-surface topography and the cleanest asset in the set,
 * which is what `licences.json` records for `z-anatomy-regions`. Both assets were
 * given the aggregate string until 17 August 2026, so the regions file claimed a
 * non-commercial inner ear and an unlicensed white matter that are not in it.
 *
 * That is over-attribution, and over-attribution is its own kind of wrong: it
 * marks geometry as more restricted than it is, and the same mistake in the
 * opposite direction — an over-broad inner-ear tag — is already recorded in
 * `COMPONENTS` above. A credit should name what is actually inside the file.
 */
const COPYRIGHT_REGIONS = ZA_AND_BP3D + DERIVED_FROM

const ASSET_OUT = {
  main: OUT,
  regions: OUT.replace(/\.glb$/, '-regions.glb'),
}

function makeAsset(id) {
  const doc = new Document()
  doc.createBuffer()
  const scene = doc.createScene(id === 'regions' ? 'Z-Anatomy surface regions' : 'Z-Anatomy')
  doc.getRoot().getAsset().copyright = id === 'regions' ? COPYRIGHT_REGIONS : COPYRIGHT_MAIN
  return { id, doc, scene, structures: [] }
}

const assets = new Map()
for (const g of groups.values()) if (!assets.has(g.asset)) assets.set(g.asset, makeAsset(g.asset))

/**
 * The structure table: what the merge would otherwise throw away.
 *
 * Ids are GLOBAL across the file, not per mesh, so one flat table serves the
 * whole atlas and a lookup needs no idea which mesh it came from. 2,077
 * structures against uint16's 65,535 leaves plenty of head-room.
 *
 * NO INDEX RANGES HERE, deliberately. The obvious design is to record each
 * structure's `[firstIndex, indexCount]` while merging and highlight with
 * `setDrawRange`. It was built that way first and it is wrong: downstream
 * `gltf-transform optimize --simplify` rewrites the index buffer, so every range
 * is stale by the time the asset ships, and nothing errors — selection just
 * highlights the wrong geometry. The runtime derives ranges from the id
 * attribute instead, which cannot go stale because it IS the geometry.
 *
 * The attempted fix — simplify per part, before the merge, so ranges survive —
 * was measured and abandoned. Z-Anatomy's parts arrive unwelded (the connective
 * group is 358,028 triangles across 1,074,084 vertices, exactly 3 per triangle),
 * so no triangle shares an edge with another and a per-part simplifier has
 * nothing to collapse: it removed 1.2 % against the 65 % the merged pipeline
 * achieves. Welding first only reaches 61 % unique, which is not enough.
 *
 * Keeping the merge-then-simplify order is safe precisely BECAUSE this attribute
 * exists. `weld` hashes every attribute, so two coincident vertices belonging to
 * different structures differ in `_STRUCTURE` and are never merged. That leaves
 * the structures topologically disconnected, so a collapse cannot cross a
 * boundary and no id is ever blended. `check-structures.mjs` asserts it rather
 * than trusting it.
 *
 * One flat table PER OUTPUT ASSET — `_STRUCTURE` indexes into the table on that
 * asset's own scene, so a shared table would make every id in the second file
 * point at the wrong structure.
 */

/**
 * Muscle attachment sites, which are 637 of the 2,077 structures — 31 %.
 *
 * Z-Anatomy models where each muscle meets bone as its own mesh, named after the
 * muscle with `o` (origin) or `e` (insertion) appended, numbered when a tendon
 * splits: `Extensor_digitorum_longuse1` through `e4` are its four toe slips.
 * They live in SkeletalSystem100, so they arrive labelled `layer: 'bone'`, and
 * with the side letter stripped their names read as typos — "Sartorius musclee".
 *
 * They are genuine anatomy, unlike the `i`/`j` landmark markers dropped at
 * import, so they are kept, named properly, and flagged. What to DO with them —
 * they are decals lying on the bone surface, and probably want their own
 * toggleable layer rather than counting as bone — is left to the UI.
 *
 * The suffix alone is not enough to classify on: plenty of real structures end
 * in `e` ("Sartorius muscle" itself). A mesh is an attachment site only if
 * removing the suffix leaves the name of a structure that actually exists, which
 * is why this needs every name up front.
 *
 * That existence check is right but incomplete, and when it fails the mangled
 * name is what ships: 64 structures across 32 names reached the table reading
 * "Quadriceps femoris musclee" and "Massetero", and hover showed exactly that.
 * The cause is not a bad rule, it is a missing muscle. Z-Anatomy models these
 * footprints for COMPOSITE muscles that MuscularSystem100 only ships as their
 * parts — the quadriceps as rectus femoris plus the three vasti, the masseter as
 * a deep and a superficial part, pronator teres as two heads — so the whole
 * muscle has no mesh, the base name genuinely does not exist, and no amount of
 * care in the lookup can find it.
 *
 * So two fallbacks below, each an existence check of its own rather than a bare
 * suffix match, and each counted at the end of the run so a future atlas import
 * can see how much work they are doing.
 *
 * Two footprints are still named for their suffix and are left that way:
 * `Erector spinaeo` (the erector spinae ships as its three columns, and no name
 * in the atlas ends in "spinae") and `Trochanteric insertione`. Catching two
 * names needs a rule loose enough to reach real structures, which is a worse
 * trade than two odd hover labels.
 */
const allNames = new Set()
/**
 * Final words of soft-tissue names — the vocabulary a muscle name ends in.
 *
 * Bone-layer names are excluded on purpose; that is what makes the second rule
 * safe. See `attachmentOf`.
 */
const softFinalWords = new Set()
for (const g of groups.values()) {
  for (const p of g.parts) {
    const { name } = splitName(p.name)
    allNames.add(name)
    if (g.layer !== 'bone') softFinalWords.add(name.split(' ').pop().toLowerCase())
  }
}

/** Tissue nouns a muscle-attachment base can legitimately end in. */
const TISSUE_NOUN = /(muscle|ligament|tendon|aponeurosis|fascia)$/i

const bySecondaryRule = { noun: 0, word: 0 }

function attachmentOf(name, layer, quiet = false) {
  const m = name.match(/^(.*?)([oe])(\d+)?$/)
  if (!m) return null
  const hit = { base: m[1], kind: m[2] === 'o' ? 'origin' : 'insertion', slip: m[3] ? Number(m[3]) : undefined }
  if (allNames.has(m[1])) return hit

  // Fallback 1 — the base ends in a tissue noun. "...musclee" and "...ligamento"
  // are not plausible structure names in their own right, whatever else is in
  // the file, so this cannot swallow a real structure: "Anconeus muscle" strips
  // to "Anconeus muscl", which the noun test rejects. Covers the 16 names where
  // Z-Anatomy spelled the tissue out (Quadriceps femoris, Triceps surae,
  // Patellar ligament, Common flexor tendon).
  if (TISSUE_NOUN.test(m[1])) {
    if (!quiet) bySecondaryRule.noun++
    return hit
  }

  // Fallback 2 — the other 16 names, where Z-Anatomy used the bare Latin form
  // and there is no tissue noun to test (`Massetero`, `Pronator tereso`,
  // `Flexor digitorum superficialise3`, `Levator anio`). The base is absent as a
  // whole name but its LAST word ends a soft-tissue name elsewhere in the atlas:
  // "Masseter" from "Superficial part of masseter", "pronator teres" from "Deep
  // head of pronator teres". That is the same existence check as the primary
  // rule, one word coarser.
  //
  // Both conditions are load-bearing. Restricting candidates to the bone layer
  // is not a guess about where footprints live but a guard measured against this
  // atlas: all 637 primary-rule attachments are bone-layer meshes, while dropping
  // the condition also swallows "Tensor fasciae latae" and "Intermuscular
  // gluteal bursae" — real soft tissue whose Latin genitive strips to a real
  // singular. Building the index from soft tissue only is what keeps "Levator
  // scapulae" out of reach of the scapula. A future atlas that ships footprints
  // outside the skeletal file fails this rule closed — a mangled name, not a
  // wrong one.
  if (layer === 'bone' && softFinalWords.has(m[1].split(' ').pop().toLowerCase())) {
    if (!quiet) bySecondaryRule.word++
    return hit
  }

  return null
}

/** Parts that arrived with no geometry at all. Reported, not hidden. */
const emptyParts = []

for (const [, g] of groups) {
  // The display/mesh name, WITHOUT the asset prefix the map key carries.
  const key = g.name
  const { doc, scene, structures } = assets.get(g.asset)
  const nVerts = g.parts.reduce((a, p) => a + p.positions.length / 3, 0)
  const positions = new Float32Array(nVerts * 3)
  const indices = new Uint32Array(g.parts.reduce((a, p) => a + p.indices.length, 0))
  // Per-vertex structure id. This is what survives the merge and gives hover
  // something to name; see docs/ROADMAP.md phase 1.
  const structureIds = new Uint16Array(nVerts)
  let vo = 0
  let io = 0
  for (const p of g.parts) {
    /**
     * A part with no vertices cannot be a structure.
     *
     * It would take an id that no vertex carries, and its centroid would be
     * `0/0` — NaN, which JSON-serialises to `null`. `Mucosa of stomach` is the
     * real case: a thin inner surface that arrives from the FBX empty. Shipping
     * it made `npm run check:structures` fail with "ids were lost downstream",
     * which pointed at the simplifier when nothing had been lost at all —
     * there was never any geometry to lose.
     *
     * Skipping BEFORE the push is what keeps ids contiguous, because the id is
     * `structures.length`. Counted rather than silently dropped, so the build
     * log shows what the atlas does not contain.
     */
    if (p.positions.length === 0) {
      emptyParts.push(p.name)
      continue
    }
    const base = vo / 3
    const id = structures.length
    if (id > 65535) throw new Error('more than 65,536 structures — _STRUCTURE needs to be uint32')
    const centroid = [0, 0, 0]

    for (let i = 0; i < p.positions.length; i += 3) {
      const x = p.positions[i]
      const y = p.positions[i + 1]
      const z = p.positions[i + 2]
      // Y-up, and grounded so the feet sit on y=0 like every other atlas.
      positions[vo] = (x - (min[0] + max[0]) / 2) * scale
      positions[vo + 1] = ((swapZY ? z : y) - min[swapZY ? 2 : 1]) * scale
      positions[vo + 2] = ((swapZY ? -y : z) - (min[swapZY ? 1 : 2] + max[swapZY ? 1 : 2]) / 2) * scale
      centroid[0] += positions[vo]
      centroid[1] += positions[vo + 1]
      centroid[2] += positions[vo + 2]
      structureIds[vo / 3] = id
      vo += 3
    }
    for (let i = 0; i < p.indices.length; i++) indices[io++] = p.indices[i] + base

    const n = p.positions.length / 3
    const { name, side } = splitName(p.name, true)
    const att = attachmentOf(name, g.layer)
    // Third-party component provenance, when this structure is not Z-Anatomy's
    // own work. Absent on the ~99% that are, so the table does not grow by a
    // field that would be null nearly everywhere.
    const comp = componentOf(p.name)
    const finalName = att ? att.base : name
    structures.push({
      // An attachment site is named for the muscle it belongs to, not the
      // mangled suffix form: "Gracilis muscle" + attachment: "insertion",
      // never "Gracilis musclee".
      name: finalName,
      // The FMA term, where the crosswalk found a real correspondence. Absent
      // otherwise — never approximated.
      ...(CROSSWALK.has(`${finalName}|${side ?? ''}`)
        ? { ontologyid: CROSSWALK.get(`${finalName}|${side ?? ''}`) }
        : {}),
      ...(att ? { attachment: att.kind, ...(att.slip ? { slip: att.slip } : {}) } : {}),
      ...(side ? { side } : {}),
      ...(comp ? { component: comp.id, licence: comp.licence } : {}),
      mesh: key,
      system: g.system,
      layer: g.layer,
      // Kept now because deriving it later means re-reading every vertex; the
      // per-structure exploded view (roadmap phase 4) indexes it by id.
      centroid: centroid.map((c) => +(c / n).toFixed(4)),
    })
  }

  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions))
    // Custom attributes must be `_`-prefixed per the glTF spec. three's
    // GLTFLoader lowercases anything it does not recognise, so this arrives as
    // `geometry.attributes._structure`.
    .setAttribute('_STRUCTURE', doc.createAccessor().setType('SCALAR').setArray(structureIds))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices))
  const mesh = doc.createMesh(key).addPrimitive(prim)

  const sample = splitName(g.parts[0].name, true)
  const node = doc.createNode(key).setMesh(mesh).setExtras({
    // The contract AtlasBody reads. `ontologyid` is absent on purpose: Z-Anatomy
    // carries no ontology terms at all (D11), and writing a guessed one would be
    // worse than writing none.
    label: MERGE ? key.replace('/', ' / ') : sample.name,
    system: g.system,
    layer: g.layer,
    merged_from: g.parts.length,
    ...(MERGE ? {} : { side: sample.side }),
    source: 'z-anatomy',
  })
  scene.addChild(node)
  console.log(
    `[z-anatomy]   ${key}: ${g.parts.length} parts, ` +
      `${Math.round(indices.length / 3).toLocaleString()} tris`,
  )
}

/**
 * The table goes on the SCENE, because `AtlasBody` destructures `{ scene }` out
 * of `useGLTF` and three copies scene extras to `scene.userData`. On the glTF
 * root it would land on `gltf.userData` instead, which that component never
 * sees.
 */
for (const { id, doc, scene, structures } of assets.values()) {
  scene.setExtras({
    structures,
    structure_attribute: '_STRUCTURE',
    // The component roster — ONLY the components this asset actually contains.
    //
    // Writing the full list into every asset made `check-licences.mjs` report
    // "matched 0 structures — pattern may be stale" for all three components on
    // the regions atlas, which contains none of them: four action items that
    // looked like drift and were noise. A zero-match warning is only meaningful
    // when the asset claims to carry the component, so only claim what is there.
    components: COMPONENTS.filter((c) => structures.some((s) => s.component === c.id)).map(
      ({ match, ...rest }) => rest,
    ),
  })
  const out = ASSET_OUT[id]
  await new NodeIO().write(out, doc)
  console.log(
    `[z-anatomy] ${id}: ${structures.length.toLocaleString()} structures ` +
      `(${(JSON.stringify(structures).length / 1024).toFixed(0)} KB of JSON) ` +
      `-> ${out} (${(statSync(out).size / 1e6).toFixed(1)} MB)`,
  )
}

const structures = [...assets.values()].flatMap((a) => a.structures)

// --- parts that carried no geometry -----------------------------------------
// Printed because "the atlas does not contain X" is a fact about the atlas, and
// an empty part is the one case where a name in the source has no structure in
// the output. Silence here previously showed up as a failing check:structures
// blaming the simplifier for geometry that never existed.
if (emptyParts.length) {
  console.log(
    `[z-anatomy] ${emptyParts.length} part(s) had NO vertices and were skipped: ` +
      `${emptyParts.slice(0, 8).join(', ')}${emptyParts.length > 8 ? ', …' : ''}`,
  )
}

// --- third-party component roll-call ----------------------------------------
// Printed every build because it is the number a due-diligence review needs, and
// because a component silently matching ZERO structures means the name pattern
// has drifted from the atlas and the log has quietly stopped being true.
console.log(`[z-anatomy] third-party components carried in this asset:`)
for (const c of COMPONENTS) {
  const n = structures.filter((s) => s.component === c.id).length
  // A zero count means one of two very different things, and conflating them
  // trains people to ignore the warning: deliberately excluded from a
  // publishable build, or a name pattern that has drifted and stopped matching.
  const excluded = PUBLISHABLE && /none stated|unlicensed|unknown/i.test(c.licence)
  console.log(
    `             ${n === 0 && !excluded ? '⚠️  ' : '    '}${String(n).padStart(3)} structures  ` +
      `${c.licence.padEnd(16)} ${c.title} (${c.holder})` +
      (excluded
        ? '  <- excluded by --publishable (no licence grants redistribution)'
        : n === 0
          ? '  <- MATCHED NOTHING, pattern may be stale'
          : ''),
  )
}
console.log(
  `             ${structures.filter((s) => !s.component).length} structures are Z-Anatomy's own (CC BY-SA 4.0)`,
)
const termed = structures.filter((s) => s.ontologyid).length
console.log(
  `[z-anatomy] ontology terms: ${termed.toLocaleString()} of ${structures.length.toLocaleString()} structures ` +
    `carry an FMA id (via docs/z-anatomy-fma.tsv)` +
    (termed === 0 ? ' — run scripts/build-crosswalk.mjs --write first' : ''),
)
{
  // How much of the attachment naming rests on the fallbacks. A jump here on a
  // new atlas means its muscle coverage differs from Z-Anatomy's and the
  // fallbacks deserve re-checking against it; a drop to zero means the source
  // names whole muscles and only the primary rule is needed.
  const total = structures.filter((s) => s.attachment).length
  const fallback = bySecondaryRule.noun + bySecondaryRule.word
  console.log(
    `[z-anatomy] attachments: ${total.toLocaleString()} (${(total - fallback).toLocaleString()} by name lookup, ` +
      `${bySecondaryRule.noun} by tissue noun, ${bySecondaryRule.word} by final word)`,
  )
}

/**
 * Laterality audit.
 *
 * `splitName` only treats a trailing `l`/`r` as a side when the counterpart
 * exists, so anything listed here kept its full name and carries NO side. That is
 * the intended, safe outcome — but it is also where a genuine one-sided structure
 * would hide, so the build states it rather than leaving it to be discovered by
 * someone reading a label. Add to `ONE_SIDED` only with a measured centroid.
 */
const unpaired = [...rawNames].filter((n) => {
  const m = n.match(/^(.*?)([lr])$/)
  return (
    m &&
    !rawKeys.has(pairKey(`${m[1]}${m[2] === 'l' ? 'r' : 'l'}`)) &&
    !ONE_SIDED.has(n) &&
    !attachmentOf(m[1].replace(/_/g, ' ').trim(), undefined, true)
  )
})
console.log(
  `[z-anatomy] laterality: ${unpaired.length} name(s) end in l/r with no counterpart — ` +
    `kept whole, no side claimed:\n           ${unpaired.slice(0, 12).join(', ')}` +
    (unpaired.length > 12 ? `, ... (+${unpaired.length - 12})` : ''),
)
console.log(
  `[z-anatomy] NEXT: compress it — the raw write is uncompressed.\n` +
    `           npm run convert:z-anatomy\n` +
    `           then verify:  npm run check:winding && npm run check:structures\n` +
    `           then log:     npm run check:licences   (regenerates docs/LICENCE_LOG.md)`,
)
