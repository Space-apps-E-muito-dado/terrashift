# Fields outside Brazil: show the diagnosis, stop before the simulation

Issue: Space-apps-E-muito-dado/terrashift#4 · Date: 2026-11-15 · Status: draft, awaiting approval
Builds on: `docs/specs/issue-4-outside-brazil-coverage.md` (spec 1). Everything in spec 1 still applies **except** the parts this document replaces, listed in §3.
Base: `dev` (7a055fa). The flow there is Sua terra → Diagnóstico → Rotação (`/rotacao`) → Objetivos → Futuros (5 steps).

## 1. Intent

Spec 1 refuses a field outside Brazil outright. This change keeps the honest part (no Luís Eduardo Magalhães yields, no "real data" label on fallback data) but gives the visitor what TerraShift *can* say about any field on Earth: climate, rain, temperature, soil, terrain and the satellite layers. Only the strategy simulation, which needs Brazilian yields (IBGE PAM), a Brazilian crop calendar (November sowing) and the Nov–Mar dry-spell scenarios, stays Brazil-only.

Why: once the app is public (#2), people will draw fields anywhere. A useful partial answer, clearly labelled, is a better first impression than an error, and it shows which parts are already global.

## 2. Goals / non-goals / anti-goals

**Goals**
- A field outside Brazil goes through "Sua terra" → "Diagnóstico" normally, showing the global data (NASA POWER climate, SoilGrids, SRTM, MODIS NDVI, SMAP, Sentinel-2).
- The Diagnosis screen says, in PT and EN, that strategy simulation covers Brazil only, and does not offer the way forward to the Rotation step.
- No Brazil-only number (IBGE yields, prices, R$, Nov–Mar scenarios) is computed or shown for such a field.
- `/api/simulate` still returns 422 `outside_coverage` for such a field (the API is public; the UI is not the only client).
- Brazilian fields, the demo farm and the offline demo behave exactly as with spec 1.

**Non-goals**
- Simulation, yields, prices or crop calendars for other regions (that is option 3: per-region model).
- Fields straddling a border: the centroid decides, as for every other source.
- Elevation outside SRTM's band (roughly 60°N to 56°S): OpenTopoData fails there and the existing offline-example fallback is used, labelled offline. Acceptable; not fixed here.
- Translating NASA POWER's period string or month labels (already Portuguese for every field today).

**Anti-goals**
- A diagnosis-only field that still shows any IBGE, R$ or "safra" wording.
- Refusing simulation to a Brazilian field because the geocoder was unsure or down (spec 1's rule stands: unsure → fallback, labelled offline).
- A route (direct URL, browser back, restored session) that reaches Rotation, Objectives, Lab, Compare or Plan for a diagnosis-only field.

## 3. What changes relative to spec 1

| Spec 1 | This spec |
|---|---|
| §4.2 `gather` returns `Err(ApiError 422)` on `OutsideBrazil` | `gather` returns a `Gathered` with `coverage = DiagnosisOnly`; no PAM, no rain series. Only `/api/simulate` turns that into 422. |
| §4.4 `/api/diagnosis` returns 422 | `/api/diagnosis` returns 200 with `coverage: "diagnosis_only"` |
| §4.5 banner on "Sua terra" | Banner is only a fallback for the 422 from `/simulate`; the main UX is on the Diagnosis screen (§4.4 below) |
| §4.1 `PlaceLookup::OutsideBrazil { country_code }` | Also carries a display name and region from Nominatim (§4.1) |

Unchanged from spec 1: the pure Nominatim parser and its three-way outcome, legacy cache compatibility, **not caching** `OutsideBrazil`, `pam()` returning the local copy for a non-live place, `place.live` in `any_offline`, the `ApiError` `code` field, the Diagnosis header offline marker, the open-ocean rule, and the demo-day decision (spec 1 §4.3).

## 4. Design

### 4.1 Place lookup carries a label (backend)

```rust
enum PlaceLookup {
    Found(Place),
    OutsideBrazil(ForeignPlace),
}
struct ForeignPlace {           // serialized camelCase
    name: Option<String>,       // first of municipality/city/town/village/county
    region: Option<String>,     // address.state
    country_code: String,       // lower-case ISO 3166-1 alpha-2, e.g. "us"
}
```

Nominatim is called with `accept-language=pt-BR`, so `address.country` would be Portuguese for an English reader. The frontend names the country from `countryCode` with `Intl.DisplayNames(lang, { type: 'region' })` instead (e.g. "United States" / "Estados Unidos"). `name` and `region` are local place names and are shown as returned.

### 4.2 Coverage in `gather` (backend)

```rust
enum Coverage { Full, DiagnosisOnly }

struct Gathered {
    coverage: Coverage,
    climate: Climate,
    soil: Soil,
    terrain: Terrain,
    place: Option<Place>,            // Brazil (or fallback)
    foreign: Option<ForeignPlace>,   // outside Brazil
    rain: Option<RainSeries>,        // Full only
    pam: Option<Pam>,                // Full only
}
```

Order (keeps spec 1's "place first", approach B):
1. Resolve the place.
2. `OutsideBrazil` → fetch climate, soil, terrain concurrently. Skip the rain series (it only feeds the Nov–Mar scenarios) and PAM.
3. `Found` (live or fallback) → as spec 1: climate, rain, soil, terrain concurrently, then `pam`.

`model::simulate` takes the rain series as well as PAM (`SimInput.rain`, added by #1 for farmer-defined crops). It is never called with a `DiagnosisOnly` `Gathered`, because the simulate handler returns 422 first (§4.3), so it can unwrap both `Option`s or receive them from a `Full`-only struct.

The startup warm-up only touches the demo farm, which is `Full`.

### 4.3 API (backend)

`/api/diagnosis` response gains one field and some become nullable:

| Field | Full (Brazil) | DiagnosisOnly |
|---|---|---|
| `coverage` | `"full"` | `"diagnosis_only"` |
| `place` | as today | `null` |
| `foreignPlace` | `null` | `{ name, region, countryCode }` |
| `climate`, `soil`, `terrain`, `centroid`, `areaHa` | as today | as today |
| `rainSeries`, `analogYears` | as today | `null` |
| `yieldSource`, `yieldLevel`, `yieldPlace` | as today | `null` |
| `yieldsLive` | as today | `null` |
| `crops` | as today | `[]` |
| `sources` | as today | without the two rain/IBGE entries: NASA POWER climatology, SoilGrids, SRTM, MODIS, SMAP, Sentinel-2 |

`sources_for` takes `&Gathered` and skips the entries whose data is absent.

`/api/simulate`: keep `crops::resolve` first (400 for a malformed rotation, as on `dev`), then gather; when `coverage` is `DiagnosisOnly`, return **422** `{"error": "...", "code": "outside_coverage"}` before calling the model (the message from spec 1 §4.4, reworded: "A simulação de estratégias cobre apenas o Brasil por enquanto."). `model::simulate` never sees a `None`.

Why nullable fields rather than a separate response type: the frontend already has one `Diagnosis` type and one screen; nullable fields keep that, and the TypeScript compiler then points at every place that assumed Brazil.

### 4.4 Diagnosis screen (frontend)

`frontend/src/lib/api.ts`: add `coverage`, `foreignPlace`, and make the fields in §4.3 nullable. Fix the resulting type errors; each one is a Brazil assumption.

On `Diagnosis.tsx` when `coverage === 'diagnosis_only'`:

```
 Field 1 · 120 ha · Worth Township, Iowa · United States          [no Continue button]

 Conheça sua terra.
 ┌ map + layers (unchanged) ┐  ┌ Rain ┐ ┌ Temp ┐ ┌ Vegetation ┐ ┌ Soil ┐   (unchanged)
 └──────────────────────────┘
                               ┌ Coverage panel (replaces the "Próximo passo" panel) ┐
                               │ Strategy simulation covers Brazil only for now.       │
                               │ It needs local crop yields and a local crop calendar, │
                               │ which TerraShift has only for Brazil. The data above  │
                               │ is global.                                            │
                               │ [ Draw another field ]  → /terra                      │
                               └───────────────────────────────────────────────────────┘
```

- Header eyebrow: `name, region · <country from Intl.DisplayNames>`, skipping missing parts.
- Header action: hide the "Continuar" button (on `dev` it goes to `/rotacao`). The step indicator stays at step 2 of 5; the later steps simply aren't reachable.
- Cards: rain, temperature, vegetation and soil cards and all map layers are unchanged; they only use global data. The rain card's "Média mensal 2001–2025" note is still correct.
- New i18n keys (PT and EN; `i18n.tsx` is typed, so a missing one fails to compile): `diag.coverageTitle`, `diag.coverageBody`, `diag.coverageAction`, and `error.outsideCoverage` from spec 1 for the 422 fallback.

Wording (proposed):
- PT: "A simulação de estratégias cobre apenas o Brasil por enquanto." / "Ela depende da produtividade das lavouras e do calendário agrícola da região, que o TerraShift só tem para o Brasil. Os dados acima valem para qualquer lugar." / "Desenhar outra área"
- EN: "Strategy simulation covers Brazil only for now." / "It needs local crop yields and a local crop calendar, which TerraShift only has for Brazil. The data above is valid anywhere." / "Draw another field"

### 4.5 Route guard (frontend)

`Rotation`, `Objectives`, `Lab`, `Compare` and `Plan` already redirect when state is missing (`Rotation.tsx:24`, `Objectives.tsx:23`, `Lab.tsx:118`, `Compare.tsx:28`, `Plan.tsx:113`). Add: if `s.diagnosis?.coverage === 'diagnosis_only'`, redirect to `/diagnostico`. One shared helper keeps the five pages consistent. `MyRotationDialog` only opens inside Lab, so Lab's guard covers it. The 422 from `/simulate` (spec 1's banner on Objectives and `MyRotationDialog`) remains as a backstop.

The session store key (`terrashift-state-v2`) holds a `diagnosis` without `coverage` from before this change. Treat a missing `coverage` as `"full"` (that was the only possible case), so no store version bump is needed. The rotation and custom crops in the store (and custom crops in localStorage) are independent of the field and stay as they are.

### 4.6 Docs

README: one line on coverage: the diagnosis works worldwide; the strategy simulation covers Brazil only.

## 5. Approaches considered

**A. Refuse outside Brazil (spec 1).** Least work, but the visitor gets nothing, although most of the diagnosis data is global.

**B. Diagnosis-only flag in the existing response. (Recommended; this spec.)** One endpoint and one screen, nullable Brazil-only fields, simulation gated in the API and the UI. About a day of work on top of spec 1, mostly the frontend type fallout.

**C. Separate `/api/diagnosis-global` endpoint and screen.** Cleaner types but duplicates the screen and its map, and the two drift apart. Not worth it for one panel's difference.

## 6. Tests

Unit (backend, no network):
- Parser: Iowa fixture → `OutsideBrazil { name: "Worth Township", region: "Iowa", country_code: "us" }` (fixtures from spec 1 §4.1).
- `sources_for` on a `DiagnosisOnly` `Gathered` lists no IBGE and no rain-series entry.
- Simulate handler on `DiagnosisOnly` → 422 with `code: "outside_coverage"` and the model not called (extract the coverage check into a function and test that).
- Diagnosis serialization: `DiagnosisOnly` has `coverage: "diagnosis_only"`, `place: null`, `analogYears: null`, `crops: []`.

Frontend: `npm run build` (type-check) passes; that is the main guard against a missed Brazil assumption.

Manual (record in the PR):
1. Iowa (41.98, -93.85), PT and EN: diagnosis shows the climate (about 866 mm/yr, 9.5 °C) and soil; header "Worth Township, Iowa · United States/Estados Unidos"; coverage panel; no Continue; no IBGE, R$ or Luís Eduardo Magalhães anywhere. Typing `/rotacao`, `/objetivos` or `/laboratorio` in the address bar returns to the diagnosis. `curl` `/api/simulate` → 422.
2. Southern hemisphere outside Brazil (e.g. Argentina, Pergamino about -33.89, -60.57): same diagnosis-only behaviour.
3. Demo farm and Londrina (-23.30, -51.17): identical to spec 1 / `main`.
4. Network off + warm cache: demo farm works. Spec 1 §6 cases 3–4 still hold (an outside-Brazil field with the geocoder down cannot be told apart and gets the offline-labelled fallback with full simulation; accepted in spec 1).

## 7. Done when

- An Iowa field shows its real diagnosis and the coverage panel in PT and EN, and no Brazil-only number or wording.
- No path in the UI or API simulates a field outside Brazil.
- Spec 1's "done when" items for Brazilian fields and the offline demo still hold.

## 8. Risks and builder notes

- **Branch drift:** the rotation work (#1) is already on `dev` and is covered above (Rotation step, `MyRotationDialog`, `crops::resolve`, `SimInput.rain`). Re-check `main.rs`, `api.ts` and the page guards against `dev` before opening the PR, since other branches may land there first.
- **Geocoder down** means an outside field cannot be recognised and gets the offline-labelled Luís Eduardo Magalhães simulation (spec 1 behaviour). If that matters later, cache `OutsideBrazil` under a finer key (about 11 m, `{:.4}`) in its own cache kind, which avoids spec 1's border-cell problem.
- **Left to the builder:** Rust type and field names, whether `Gathered` uses `Option`s or an enum per coverage, the shared route-guard helper's shape, and exact card/panel styling (reuse the existing `insight` panel).
