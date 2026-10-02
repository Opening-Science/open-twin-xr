# Data contracts at the viewer boundary

The viewer accepts two deliberately separate document types:

- `interpretation-contract.v0.2` is the canonical Open Twin → XR seam. The
  pinned schema, fixture and provenance are under `contracts/`; validation is
  in `src/data/interpretationContract.ts`. Its categorical states drive only
  the dedicated research/wellness interpretation view.
- `TwinMetrics` (`src/data/schema.ts`) remains the legacy fictional demo model
  for the existing anatomical/metrics viewer. It is not converted into, or
  treated as authority for, the interpretation contract.

The browser does not score FHIR observations or convert interpretation severity
or confidence into a numeric metric.

## Production topology

```
[vendor APIs]
  -> upstream FHIR ingestion and interpretation
  -> interpretation-contract.v0.2 JSON
  -> viewer validation
  -> categorical interpretation view
```

Any future network integration remains outside XR-2; its current entry point is
a local JSON file selected by the user.

## Legacy TwinMetrics shape

```
TwinMetrics
  schemaVersion : string
  profile       : { name,
                    biologicalAge: DerivedValue,     // not produced by ANY connector
                    cardiovascularAge: DerivedValue, // Oura "vascular age", vendor-local code
                    overallScore: number|null, status: string|null, statusMessage }
  systems[]     : { id(SystemId), name,
                    score: number|null,      // null when no connector measures it
                    hasData: boolean,
                    proxy?: boolean,         // inferred, not measured
                    provenance: Provenance[],
                    summary,
                    structures?: AnatomicalStructure[] }  // ontology ids, e.g. UBERON:0000948
  trend[]       : { date(ISO), score(0-100) }
  connectedSources[] : { name, status, lastSync, provenance }
  journey[]     : { date(ISO), title, detail }
```

`SystemId` is a closed set: `cardiovascular | respiratory | nervous | digestive
| musculoskeletal | endocrine | reproductive | metabolic | integumentary`.

`Provenance` is `oura | google-health | vitronic-bodyloop | open-wearables |
derived`.

## The three honest states

| State | Encoding | UI |
|---|---|---|
| Measured | `hasData: true`, `score: n`, `proxy` unset | Number, colour-scaled |
| Proxy-derived | `hasData: true`, `score: n`, `proxy: true` | Number + "proxy-derived" badge |
| No data | `hasData: false`, `score: null` | "No data" chip, neutral grey organ |

`assertTwinMetrics()` throws if `hasData: false` carries a non-null score.
That guard is deliberate: a fabricated number reaching the renderer is the
failure this project most needs to avoid.

## Which systems have data today

Verified against the actual connector set:

- **Strong:** cardiovascular (Oura), musculoskeletal (VITRONIC BodyLoop + Oura)
- **Partial:** respiratory (SpO2), metabolic (VO2max, activity; glucose blocked
  on an unresolved LOINC choice upstream)
- **Proxy only:** nervous (sleep, stress, resilience - not nervous-system
  measurements)
- **No data at all:** digestive, endocrine, reproductive, integumentary

## Rules for the adapter

1. Code against `open-twin/DECISIONS.md`, not the committed test snapshots.
   Those snapshots predate remediation and show `Scan/scan-1` subjects, vendor
   URL code systems, and radians labelled as degrees. open-twin is a separate
   repo — <https://github.com/etzm/open-twin> — with `DECISIONS.md` at its root.
2. Missing data is not zero. Upstream models this with `dataAbsentReason`.
3. Resolve organs by ontology id, never by mesh-node name string.
4. Never put an API response body in an error or a log.
5. Health data is GDPR special-category. Keep it server-side or behind the
   user's own auth. Sample data stays fictional.
