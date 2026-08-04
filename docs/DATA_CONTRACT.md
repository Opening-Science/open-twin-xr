# Data contract: open-twin -> viewer

> **Revised after verification.** Read `SCHEMA_VERIFICATION.md` first. The
> original version of this file assumed open-twin supplies per-system scores. It
> does not. It supplies raw FHIR R4 Observations.

The viewer reads exactly one type: `TwinMetrics` (`src/data/schema.ts`).
Everything upstream is the adapter's problem (`src/data/adapter.ts`).

## Production topology

```
[vendor APIs]
  -> @open-twin/provider-*        (stateless libs, hold credentials)
  -> FHIR R4 Bundle of Observations + OperationOutcome
  -> scoring step                 (reference intervals -> 0-10 per system)
  -> TwinMetrics JSON
  -> (HTTP) -> browser app
```

Everything above the last arrow is **server-side**. The browser only fetches an
already-scored `TwinMetrics`.

## The shape

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
