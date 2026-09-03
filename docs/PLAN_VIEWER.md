# Plan — viewer affordances

**Origin: a review of <https://anatomy101.in/> on 18 August 2026.** It renders the
same Z-Anatomy geometry we do, for the same audience of students, and it is worth
reading precisely because it is *not* better than this repository at anatomy. It
is better at letting a person *do* something with anatomy. Every item below is a
gap that review exposed; every item it exposed that turned out not to apply to us
is recorded under "Rejected", with the measurement that rejected it.

> **Status: proposal. Nothing here is started.**
> This is a sibling of `docs/PLAN_IDENTITY.md`, not a replacement — that plan's
> search interface (its item 3) should land first, because items 1 and 3 here
> both consume it.

## What the comparison actually measured

| | Anatomy101 | here |
|---|---|---|
| atlases | Z-Anatomy only, male only | 7 sources, both sexes |
| structures | 1,466, left/right merged | 3,617 Z-Anatomy + 1,838 BodyParts3D + 96 HRA |
| structure identity | **mesh-node name strings** | ontology CURIEs in glTF extras |
| deep links | `?part=` `?system=` `?cam=` `?layers=` `?condition=` | none but `?tune` |
| cross-section | 3 axes, depth, flip | none |
| synonyms / other languages | English + Hindi labels | none |
| attribution | the string `model by - Z-anatomy` | licence named per source, in-app |
| XR | none | WebXR |

Their stack is three.js r165 from a CDN import map, no bundler, no minifier — so
the deployed site is its own source, and `/scripts/gen-anatomy.mjs` and
`/docs/anatomy-taxonomy.json` are served by accident. There is no public
repository: GitHub code search for their own identifiers (`anatomy101-loaded`,
`__anatomy101`) returns zero. Nothing was copied; this plan cites what was read.

⚠️ **Their identity model is the one this repository forbids.** `loader.js` walks
each mesh up to its nearest named ancestor, then runs a `labelFingerprint` hash
to *undo* GLTFLoader's sanitisation of `Angular artery` into `Angular_arteryr`.
That is the "mesh-node name strings" join `CLAUDE.md` rules out, and their
fingerprint hack is the best available argument for the structure table we put on
`scene.extras` instead. It is also why they merge left and right into one label
and lose `side` — the same information loss that produced our one-sided ear.

---

## Item 1 — deep links, keyed by TERM and not by index

**The gap.** A lecturer cannot send anyone a link to the liver. `?tune` is the
only query parameter this app reads (`src/scene/tuning.ts:124`).

**The work.** A pure `encodeViewState` / `decodeViewState` pair over a subset of
`src/store.ts`, plus one effect that reads the URL on mount and one that writes it
back with `history.replaceState` on change.

Carry: `anatomyMode`, `sex`, the selected structure, `hiddenSystems`,
`hiddenLayers`, `colourMode`, and camera. Do not carry the material tunables —
they are a debugging surface, and `?tune` already gates them.

⚠️ **A link must address the structure by its ontology term, never by its
`structureId`.** Those ids are assigned at build time, and a rebuild reassigns
them: this is exactly the failure D18 records, where `ONTOLOGY_MAP.md` carried
hand-typed eye-globe ids that a rebuild silently moved, so a mask built from
them would have hidden the wrong anatomy (D18 has the two ranges, as evidence
rather than as ids to use). A link is a hand-typed id with a longer life than a
document. So:

```
?m=z-anatomy&x=male&s=FMA:7197        # resolves through searchStructures()
```

Structures with no term — 1,671 of Z-Anatomy's when this plan was written on
18 August 2026; `npm run gen:ontology` measures the current figure — cannot be
linked stably. Fall
back to `?n=<name>` and accept that it is asset-bound, rather than pretending an
index is a name. If neither resolves, say *which* of the three states it is; the
empty states `PLAN_IDENTITY.md` item 4 already requires apply unchanged here.

**Order of restoration matters.** `anatomyMode` and `sex` decide which atlas
loads; the selection can only resolve once that atlas's structure table exists.
Restore mode and sex synchronously, defer selection to the load.

**Camera.** `makeCameraCommands` already owns framing and `RESET_FRAMING`. Encode
target-y, distance and two angles at two decimal places — enough to reproduce a
view, short enough to survive a chat client's line wrap.

**Tests.** Round-trip encode/decode, unknown-parameter tolerance, and a malformed
CURIE resolving to the honest empty state rather than throwing. All pure, none
needing a browser or an asset, like `structureSearch.test.ts`.

---

## Item 2 — cross-section clipping

**The gap.** No way to see inside without hiding a system. Anatomy101 slices on
three axes with a depth slider and a flip. It is the single feature of theirs a
student would miss most here.

**The work.** `renderer.localClippingEnabled = true`, one `Plane` in store state,
assigned to the shared materials in `materialFor`.

⚠️ **Verify three's clipping chunks survive our `onBeforeCompile`.** Materials in
`AtlasBody.tsx` are patched for the `_STRUCTURE` mask; three injects clipping via
the same shader-chunk mechanism. If the patch drops the chunk the plane silently
does nothing. Test on one material before wiring the UI.

⚠️ **And here is the honest-rendering problem, which Anatomy101 has and does not
mention.** These meshes are SHELLS, not solids. Cut a Z-Anatomy liver and you see
its hollow inside — and a viewer reads that as *the liver is empty*, which is a
false anatomical claim made by a rendering choice. This repository does not get
to ship that quietly. Two acceptable resolutions:

1. **Cap the cut** with the standard stencil-buffer pass, so a cut surface reads
   as cut tissue. Correct-looking, and honest only if the cap is flat colour and
   claims no internal structure it does not have.
2. **Label the plane** — the cut surface is drawn in a distinct non-tissue colour
   with a one-line note that these atlases model surfaces, not volumes.

Prefer (1) with the cap colour taken from `anatomyPalette`, and take (2) if the
stencil pass fights the mask. Do not ship an unlabelled hollow cut.

---

## Item 3 — part-of rollup, so "heart" finds the heart

**The gap.** A viewer types `heart`; Z-Anatomy names `Left ventricle`,
`Right atrium`, `Myocardium`. `searchStructures()` matches labels and terms, so
the coarse concept returns a thin result while its member structures sit
unfound. Anatomy101 solves this with `groups.js`: hand-written regex lists per
friendly label. It works and it is unmaintainable, and it is beneath what we
already have.

**The work.** Both ontologies publish the relation. `scripts/build-definitions.mjs`
already downloads `uberon.obo` and `fma.owl` — `part_of` is `BFO:0000050` in the
OBO, and FMA carries the same relation. Extend that script to emit
`docs/fma-part-of.tsv` alongside the definitions, compile it like the bridge, and
have a concept resolve to its parts as well as itself.

⚠️ **This is a TERM relation and must stay exact.** It is safe for the same reason
the bridge is safe and `groups.js` is not: it is a curated assertion by the
ontology, not a regex over a label. D18's prohibition is untouched — no fuzzy
matching enters here.

**Honest empty state, again.** A concept present in the ontology with no member
structure in the loaded atlas is "not modelled here", which is different from "no
term yet" and from "not installed". Anatomy101 gets this right in its own crude
way (`modelled: false` renders as *not individually modelled*) and deserves the
credit for it.

---

## Item 4 — synonyms, which `PLAN_IDENTITY.md` already flagged

Folded in here because it is the same download and the same parse as item 3. Both
vocabularies publish synonym lists; without them a label search misses
`Eustachian tube` for `Pharyngotympanic tube` — one of the three concepts
`CLAUDE.md` records as deliberately left termless. Ingest them, do not invent
them. Doing this with item 3 costs one extra column and no extra fetch.

---

## Item 5 — per-structure colour separation

**The gap.** `anatomyPalette.ts` colours by system and layer, which is right, and
at 3,617 structures it means neighbouring bones are the same ivory and cannot be
told apart until hovered. Anatomy101 hashes each label into a hue jitter around a
per-system base, and their body reads as *many things* where ours reads as *one
material*.

**Take the trick, change the axis.** ⚠️ Jitter LIGHTNESS and saturation, never
hue. `anatomyPalette.ts` opens by explaining that the anatomical palette and the
score scale are two colour languages that collide — a hue-jittered green liver is
exactly the collision it exists to prevent. Lightness jitter separates neighbours
without ever entering the red-amber-green scale. Cheap: one hash of the structure
name, applied where the mask is written.

---

## Rejected — progressive per-system loading

The review's most attractive-looking finding, and it does not apply.

Anatomy101 splits Z-Anatomy into six GLBs (1.7–7.7 MB, 25.5 MB total) and loads
them in visibility priority, so the skeleton renders while the nervous system is
still arriving. The obvious read is that our single 12 MB atlas should do the
same.

**It should not, because our cost is not the download.** `AtlasBody.tsx:1039`
records the measurement: *"Downloading the 24 MB atlas takes 101 ms"* — the
twenty-second stall it describes was React reconciliation, already fixed by
sharing materials. What remains is CPU: the `_STRUCTURE` precompute took
BodyParts3D from 2.9 s to 6.3 s to first paint, and it is already deferred to an
idle callback for that reason. Splitting the file changes none of it.

And it would cost something real. The mask (`structureMask.ts`) indexes ONE
global `_STRUCTURE` id space. Six files means either six id spaces — which breaks
the mask, the search, and any link from item 1 — or a globally assigned id space
carried redundantly in every part. That is a large change to buy 101 ms.

**If first paint is worth attacking, attack the precompute, not the file.** The
measurement to take first is where the 3.4 s actually goes.

---

## Explicitly not taking

⚠️ **Their conditions and medications layer.** 2,587 conditions and 342
medications, 2.2 MB of JavaScript, aimed at NEET candidates, described in their
own header as a *"curated condition library"* — with no citation, no reference
interval and no named reviewer. Health mapping left this repository for
`etzm/open-twin` (see `CLAUDE.md`), D8 and D15 hold, and `npm run lint:claims`
exists to fail the build if the copy drifts back. This is the clearest case in
the whole review of a feature we could build in a day and should not build at
all.

**Their Google sign-in gate.** The atlas is behind authentication. Ours opens.

## One check, not an improvement

Anatomy101's entire attribution for the geometry is the string
`model by - Z-anatomy` — no licence named, no link, no statement of modification,
adapted GLBs not offered under BY-SA, source closed, paid tier via Razorpay.
CC BY-SA 4.0 permits the commerce and requires the rest.

We ship adapted Z-Anatomy too, so the same obligation binds us.
`src/ui/AttributionBar.tsx` already names *"CC-BY-SA 4.0 plus three third-party
components, all credited"*, which is the part they are missing. **Confirm it also
states that the geometry was MODIFIED** — decimated, re-baked, merged — because
that is a separate clause of the licence from naming it.

## Ordering

1. `PLAN_IDENTITY.md` item 3 — the search interface. Items 1 and 3 here need it.
2. Item 1, deep links. Highest value per line in the plan, and pure.
3. Items 3 + 4 together, one pipeline change.
4. Item 2, clipping — do not start it until the shell/cap question is settled.
5. Item 5, colour separation. Small, and best judged once more of the above is
   on screen.

## Open, and measured on the way in

Parsing `public/models/z-anatomy.ao.glb` directly on 18 August 2026 counted
**1,946** structures carrying a non-`-` `ontologyid`, of 3,617.
`PLAN_IDENTITY.md` states 1,842 and `CLAUDE.md` states 1,048 in one place and
1,840 in another. These may simply differ by normalisation — the generator drops
malformed CURIEs and a raw count does not. **Run `npm run gen:ontology` and
settle it in the generated document before quoting any of them.**
