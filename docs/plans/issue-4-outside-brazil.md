# Fields Outside Brazil (#4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A field outside Brazil gets an honest, global diagnosis and no strategy simulation; results built on the offline fallback place are labelled offline everywhere.

**Architecture:** The Nominatim reverse geocode becomes a typed outcome (`Found` / `OutsideBrazil` / error). `gather` resolves the place first and returns a `Coverage` (`Full` with place, rain and PAM, or `DiagnosisOnly` with the foreign place). `/api/diagnosis` answers both; `/api/simulate` returns 422 `outside_coverage` for `DiagnosisOnly`. The frontend reads `coverage`, swaps the Diagnosis "next step" panel for a coverage panel, and redirects the later steps back to the diagnosis.

**Tech Stack:** Rust (axum 0.7, tokio, serde, reqwest), React 18 + TypeScript 5.6 + Vite. Backend tests: `cargo test` (in-module `#[cfg(test)]`). Frontend has no test runner; the type-check in `npm run build` is the guard.

**Spec:** `docs/specs/issue-4-outside-brazil-coverage.md` (spec 1) and `docs/specs/issue-4-diagnosis-outside-brazil.md` (spec 2, which replaces parts of spec 1; where they differ, spec 2 wins).

## Global Constraints

- Base branch: `dev` (7a055fa). Commands run from the worktree root; backend commands from `backend/`, frontend from `frontend/`.
- `OutsideBrazil` is **never cached** (memory or disk). Only `Found` places with `live && ibge_code.is_some()` are cached, as today.
- Existing `cache/place-*.json` files (a bare `Place`) must still deserialize.
- Unsure (no `country_code`, missing municipality in Brazil, network error) → fallback place, labelled offline. Never refuse on uncertainty.
- API errors keep `{"error": "<Portuguese text>"}`; the outside-coverage error adds `"code": "outside_coverage"` with HTTP 422.
- 422 text (backend): `A simulação de estratégias cobre apenas o Brasil por enquanto.`
- Every new i18n key exists in both `pt` and `en` in `frontend/src/lib/i18n.tsx` (the file is typed; a missing key fails the build).
- The demo farm (`DEMO_POLYGON`) behaves as before when online. Spec 1 §4.3 option (a) applies: no special-casing of the demo polygon.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Nominatim answers `country_code: "br"` but no municipality/city/town/village (rural point) → must be a failed lookup (offline fallback), not `OutsideBrazil`. Test in Task 1.
2. Country codes in upper case (`"BR"`, `"US"`) → treated like lower case. Test in Task 1.
3. A foreign answer with only a country (no name, no state) → `OutsideBrazil` with `name`/`region` `None`; the header shows just the country. Test in Task 1; header handled in Task 5.
4. A browser session saved before this change (diagnosis without `coverage`) → treated as `full`; pages must not crash or redirect. `isDiagnosisOnly` in Task 5 returns false for a missing field; checked manually in Task 7.
5. English user hits the 422 from `/simulate` (e.g. stale tab) → sees the coverage message, not "We could not reach the server." Covered by the helper in Task 4; checked manually in Task 7.

---

### Task 1: Typed reverse geocode and `PlaceLookup`

**Files:**
- Modify: `backend/src/sources.rs` (types near `Place` ~line 127; `place`/`fetch_place` ~359-386; tests module at the end)

**Interfaces:**
- Produces (all in `sources.rs`, `pub` unless noted):
  - `#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)] #[serde(rename_all = "camelCase")] pub struct ForeignPlace { pub name: Option<String>, pub region: Option<String>, pub country_code: String }`
  - `#[derive(Debug, Clone, Serialize, Deserialize)] #[serde(untagged)] pub enum PlaceLookup { Found(Place), OutsideBrazil(ForeignPlace) }` (`Found` first so a legacy bare `Place` deserializes as `Found`)
  - private `enum Reverse { Brazil { name: String, uf: String }, Outside(ForeignPlace) }`
  - private `fn parse_reverse(v: &Value) -> Result<Reverse>`
  - private `fn place_cacheable(l: &PlaceLookup) -> bool`
  - `DataClient::place(&self, p: Point) -> PlaceLookup` (was `-> Place`)

- [ ] **Step 1: Write the failing tests** (in `mod tests`, using `serde_json::json!` fixtures trimmed from the live responses in spec 1 §4.1)

```rust
#[test]
fn reverse_us_is_outside_brazil() {
    let v = json!({"address": {"municipality": "Worth Township", "county": "Boone County", "state": "Iowa",
        "ISO3166-2-lvl4": "US-IA", "country": "Estados Unidos da América", "country_code": "us"}});
    match parse_reverse(&v).unwrap() {
        Reverse::Outside(f) => assert_eq!(f, ForeignPlace { name: Some("Worth Township".into()), region: Some("Iowa".into()), country_code: "us".into() }),
        _ => panic!("expected Outside"),
    }
}

#[test]
fn reverse_br_gives_name_and_uf() {
    let v = json!({"address": {"municipality": "Londrina", "state": "Paraná", "ISO3166-2-lvl4": "BR-PR", "country": "Brasil", "country_code": "br"}});
    match parse_reverse(&v).unwrap() {
        Reverse::Brazil { name, uf } => { assert_eq!(name, "Londrina"); assert_eq!(uf, "PR"); }
        _ => panic!("expected Brazil"),
    }
}

#[test]
fn reverse_upper_case_codes() {
    let br = json!({"address": {"town": "X", "ISO3166-2-lvl4": "BR-BA", "country_code": "BR"}});
    assert!(matches!(parse_reverse(&br).unwrap(), Reverse::Brazil { .. }));
    let us = json!({"address": {"country_code": "US"}});
    assert!(matches!(parse_reverse(&us).unwrap(), Reverse::Outside(ForeignPlace { ref country_code, .. }) if country_code == "us"));
}

#[test]
fn reverse_country_only_has_no_name() {
    let v = json!({"address": {"country": "Argentina", "country_code": "ar"}});
    assert!(matches!(parse_reverse(&v).unwrap(), Reverse::Outside(ForeignPlace { name: None, region: None, .. })));
}

#[test]
fn reverse_unknown_is_an_error() {
    assert!(parse_reverse(&json!({"error": "Unable to geocode"})).is_err());
    // Brazil without a municipality: failed lookup (fallback), never "outside".
    assert!(parse_reverse(&json!({"address": {"state": "Bahia", "ISO3166-2-lvl4": "BR-BA", "country_code": "br"}})).is_err());
}

#[test]
fn legacy_place_cache_still_reads() {
    let s = r#"{"live":true,"municipality":"Luís Eduardo Magalhães","uf":"BA","ibgeCode":"2919553"}"#;
    let l: PlaceLookup = serde_json::from_str(s).unwrap();
    assert!(matches!(l, PlaceLookup::Found(ref p) if p.uf == "BA"));
    assert!(place_cacheable(&l));
}

#[test]
fn outside_brazil_is_not_cached() {
    let l = PlaceLookup::OutsideBrazil(ForeignPlace { name: None, region: None, country_code: "us".into() });
    assert!(!place_cacheable(&l));
    assert!(!place_cacheable(&PlaceLookup::Found(fallback_place())));
}
```

Add `use serde_json::json;` to the tests module.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && cargo test`
Expected: compile errors (`parse_reverse`, `ForeignPlace`, `PlaceLookup` not found).

- [ ] **Step 3: Implement `parse_reverse`, the types, `place_cacheable`, and the new `place`/`fetch_place`**

`parse_reverse` rules, in order: read `address.country_code` (lower-cased); missing → `Err("no country in reverse geocode")`. Not `"br"` → `Outside` with `name` = first of `municipality`/`city`/`town`/`village`/`county`, `region` = `state`. `"br"` → `name` from `municipality`/`city`/`town`/`village` (missing → `Err`), `uf` = `ISO3166-2-lvl4` stripped of `BR-` (missing → `Err`).
`fetch_place(&self, p) -> Result<PlaceLookup>`: same URL as today; `Outside(f)` → `Ok(OutsideBrazil(f))`; `Brazil{name, uf}` → the existing IBGE municipality-list lookup → `Ok(Found(Place{..}))`.
`place()` calls `self.cached("place", &key(p), || self.fetch_place(p), || PlaceLookup::Found(fallback_place()), place_cacheable)`. `cached` takes `fallback: fn() -> T`, so pass a named `fn fallback_lookup() -> PlaceLookup`.

- [ ] **Step 4: Keep `main.rs` compiling with today's behaviour**

Make `fallback_place` `pub(crate)`. In `gather`, after the `join!`, map the lookup back to a `Place`: `PlaceLookup::Found(p) => p`, `PlaceLookup::OutsideBrazil(_) => sources::fallback_place()`. This is exactly the current behaviour (outside Brazil → offline fallback); Task 3 replaces it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && cargo test`
Expected: the 7 new tests and all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/sources.rs backend/src/main.rs
git commit -m "Tell 'outside Brazil' apart from a failed reverse geocode (#4)"
```

---

### Task 2: PAM for a non-live place is the local copy

**Files:**
- Modify: `backend/src/sources.rs` (`pam()` ~line 389; tests)

**Interfaces:**
- Consumes: `fallback_place()`, `fallback_pam()`.
- Produces: `DataClient::pam(&self, place: &Place) -> Pam` returns `fallback_pam()` (with `live: false`) without network when `!place.live`.

- [ ] **Step 1: Write the failing test**

```rust
#[tokio::test]
async fn pam_for_offline_place_is_offline() {
    let pam = DataClient::new().pam(&fallback_place()).await;
    assert!(!pam.live);
    assert!(pam.source.contains("cópia local"));
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && cargo test pam_for_offline_place_is_offline`
Expected: FAIL on `assert!(!pam.live)`. Needs network for the red step (SIDRA answers live for code 2919553); offline, the fallback makes it pass by accident. After Step 3 it passes with or without network. If a disk cache entry `cache/pam-2919553.json` exists, run with `CACHE_DIR=$(mktemp -d)` so the red step isn't masked.

- [ ] **Step 3: Implement** — first line of `pam()`: `if !place.live { return fallback_pam(); }`

- [ ] **Step 4: Run tests** — `cd backend && cargo test` → all pass.

- [ ] **Step 5: Commit** — `git commit -am "Use the local PAM copy when the place is the offline fallback (#4)"`

---

### Task 3: Coverage in `gather`, API responses and the 422

**Files:**
- Modify: `backend/src/main.rs` (`ApiError` ~40-50, `Diagnosis` ~95-112, `Gathered`/`gather`/`sources_for` ~113-141, `diagnosis` ~143-166, `simulate` ~199-240, warm-up ~249-260; new tests module)
- Modify: `backend/src/sources.rs` (make `fallback_climate`, `fallback_rain`, `fallback_soil`, `fallback_terrain`, `fallback_pam` `pub(crate)` for tests; `fallback_place` already is, from Task 1)

**Interfaces:**
- Consumes: `PlaceLookup`, `ForeignPlace` (Task 1); `pam()` (Task 2).
- Produces:
  - `struct ApiError { status: StatusCode, msg: String, code: Option<&'static str> }`; body `{"error": msg}` plus `"code"` only when `Some`. `fn bad_request(msg: &str) -> ApiError` unchanged in behaviour; new `fn outside_coverage() -> ApiError` (422, constraint text, `Some("outside_coverage")`).
  - `enum Coverage { Full { place: Place, rain: RainSeries, pam: Pam }, DiagnosisOnly { foreign: ForeignPlace } }`
  - `struct Gathered { climate: Climate, soil: Soil, terrain: Terrain, coverage: Coverage }`
  - `async fn gather(data: &DataClient, poly: &[LatLng]) -> Gathered` — place first; `Found` → `join!(climate, rain_series, soil, terrain)` then `pam`; `OutsideBrazil` → `join!(climate, soil, terrain)` only.
  - `fn require_full(g: &Gathered) -> Result<(&Place, &RainSeries, &Pam), ApiError>` — `DiagnosisOnly` → `Err(outside_coverage())`.
  - `fn sources_for(g: &Gathered) -> Vec<SourceInfo>` — `Full`: the current 8 entries; `DiagnosisOnly`: 6 (drops the rain-series and IBGE PAM entries).
  - `fn build_diagnosis(poly: &[LatLng], g: Gathered) -> Diagnosis`
  - `Diagnosis` JSON (camelCase): `coverage: "full" | "diagnosis_only"`, `place: Place | null`, `foreignPlace: ForeignPlace | null`, `rainSeries | null`, `analogYears | null`, `yieldSource | null`, `yieldLevel | null`, `yieldPlace | null`, `yieldsLive: bool | null`, `crops` (`[]` when diagnosis-only), other fields unchanged. Fields are `Option<_>` serialized as `null` (no `skip_serializing_if`).

- [ ] **Step 1: Write the failing tests** (new `#[cfg(test)] mod tests` in `main.rs`; build `Gathered` from the `sources::fallback_*` functions)

```rust
fn outside() -> Gathered {
    Gathered { climate: fallback_climate(), soil: fallback_soil(), terrain: fallback_terrain(),
        coverage: Coverage::DiagnosisOnly { foreign: ForeignPlace { name: Some("Worth Township".into()), region: Some("Iowa".into()), country_code: "us".into() } } }
}
fn brazil() -> Gathered {
    Gathered { climate: fallback_climate(), soil: fallback_soil(), terrain: fallback_terrain(),
        coverage: Coverage::Full { place: fallback_place(), rain: fallback_rain(), pam: fallback_pam() } }
}

#[tokio::test]
async fn outside_coverage_is_422_with_code() {
    let res = outside_coverage().into_response();
    assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);
    let body: serde_json::Value = serde_json::from_slice(&axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert_eq!(body["code"], "outside_coverage");
    assert!(body["error"].as_str().unwrap().contains("Brasil"));
}

#[tokio::test]
async fn bad_request_has_no_code() {
    let res = bad_request("x").into_response();
    let body: serde_json::Value = serde_json::from_slice(&axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap()).unwrap();
    assert!(body.get("code").is_none());
}

#[test]
fn simulate_refuses_diagnosis_only() {
    assert!(require_full(&outside()).is_err());
    assert!(require_full(&brazil()).is_ok());
}

#[test]
fn sources_outside_brazil_have_no_ibge_or_rain_series() {
    let s = sources_for(&outside());
    assert_eq!(s.len(), 6);
    assert!(s.iter().all(|x| x.dataset != "IBGE PAM" && !x.detail.starts_with("Chuva mensal")));
    assert_eq!(sources_for(&brazil()).len(), 8);
}

#[test]
fn diagnosis_only_serializes_nulls() {
    let v = serde_json::to_value(build_diagnosis(&DEMO_POLYGON, outside())).unwrap();
    assert_eq!(v["coverage"], "diagnosis_only");
    assert!(v["place"].is_null() && v["analogYears"].is_null() && v["rainSeries"].is_null() && v["yieldsLive"].is_null());
    assert_eq!(v["crops"], serde_json::json!([]));
    assert_eq!(v["foreignPlace"]["countryCode"], "us");
    let f = serde_json::to_value(build_diagnosis(&DEMO_POLYGON, brazil())).unwrap();
    assert_eq!(f["coverage"], "full");
    assert_eq!(f["yieldsLive"], false); // fallback place → offline yields
}
```

- [ ] **Step 2: Run to verify they fail** — `cd backend && cargo test` → compile errors for the new names.

- [ ] **Step 3: Implement the interfaces above.** In `simulate`: keep `crops::resolve` first; then `let g = gather(...).await; let (place, rain, pam) = require_full(&g)?;`; `analog_years(rain)`; `SimInput { pam, rain, .. }`; `any_offline = !(g.climate.live && rain.live && g.soil.live && g.terrain.live && pam.live && place.live)`; assumptions use `pam.place`. `diagnosis` handler: validate polygon, `Ok(Json(build_diagnosis(&req.polygon, gather(..).await)))`. Warm-up: log `place`/`yields`/`rain` in the `Full` arm as today; in the `DiagnosisOnly` arm, `tracing::warn!("demo farm resolved outside Brazil")`. Remove the temporary mapping added in Task 1 Step 4.

- [ ] **Step 4: Run** — `cd backend && cargo test && cargo build` → all pass, no warnings about unused imports.

- [ ] **Step 5: Smoke test against live APIs** (backend running on :8080)

```bash
curl -s -XPOST localhost:8080/api/diagnosis -H 'content-type: application/json' \
  -d '{"polygon":[[41.98,-93.86],[41.98,-93.84],[41.97,-93.84],[41.97,-93.86]]}' | jq '{coverage, foreignPlace, place, yieldsLive}'
curl -s -o /dev/null -w '%{http_code}\n' -XPOST localhost:8080/api/simulate -H 'content-type: application/json' \
  -d '{"polygon":[[41.98,-93.86],[41.98,-93.84],[41.97,-93.84],[41.97,-93.86]],"objective":"equilibrio"}'
```
Expected: `coverage: "diagnosis_only"`, `foreignPlace.countryCode: "us"`, `place: null`; second command prints `422`. The demo farm diagnosis gives `coverage: "full"`, `yieldsLive: true`.

- [ ] **Step 6: Commit** — `git commit -am "Diagnosis-only coverage outside Brazil; 422 from simulate (#4)"`

---

### Task 4: Frontend error codes

**Files:**
- Modify: `frontend/src/lib/api.ts` (`call()` ~196-214)
- Create: `frontend/src/lib/errors.ts`
- Modify: `frontend/src/lib/i18n.tsx` (pt and en dictionaries)
- Modify: `frontend/src/pages/Objectives.tsx:33-34`, `frontend/src/components/MyRotationDialog.tsx:42-43`

**Interfaces:**
- Produces:
  - `export class ApiError extends Error { constructor(message: string, readonly code?: string) }` in `api.ts`; `call()` throws it, with `code` taken from the JSON body when it is a string. Message logic unchanged (PT shows the body's `error`, EN the generic text).
  - `export function errorMessage(e: unknown, t: T): string` in `errors.ts`: `ApiError` with `code === 'outside_coverage'` → `t('error.outsideCoverage')`; otherwise `(e as Error).message`.
  - i18n key `error.outsideCoverage`: PT `A simulação de estratégias cobre apenas o Brasil por enquanto.` / EN `Strategy simulation covers Brazil only for now.`

- [ ] **Step 1: Implement** the three items, then replace `setError((e as Error).message)` in Objectives and MyRotationDialog with `setError(errorMessage(e, t))` (both already have `t` from `useI18n()`).
- [ ] **Step 2: Verify** — `cd frontend && npm run build` → exits 0.
- [ ] **Step 3: Commit** — `git commit -am "Map API error codes to translated messages (#4)"`

---

### Task 5: Diagnosis screen for both coverages

**Files:**
- Modify: `frontend/src/lib/api.ts` (`Diagnosis` interface ~62-78)
- Modify: `frontend/src/lib/geo.ts` (add `countryName`)
- Modify: `frontend/src/lib/i18n.tsx`
- Modify: `frontend/src/pages/Diagnosis.tsx` (header action ~51, eyebrow ~56, insight panel ~149-158)

**Interfaces:**
- Produces:
  - In `api.ts`: `export type Coverage = 'full' | 'diagnosis_only'`; `export interface ForeignPlace { name: string | null; region: string | null; countryCode: string }`; `Diagnosis` gains `coverage?: Coverage` (optional: sessions saved before this change) and `foreignPlace?: ForeignPlace | null`; `place`, `rainSeries`, `analogYears`, `yieldSource`, `yieldLevel`, `yieldPlace`, `yieldsLive` become `| null`.
  - `export const isDiagnosisOnly = (d?: Diagnosis) => d?.coverage === 'diagnosis_only'` in `api.ts`.
  - `export function countryName(code: string, lang: Lang): string` in `geo.ts`: `new Intl.DisplayNames([lang === 'pt' ? 'pt-BR' : 'en'], { type: 'region' }).of(code.toUpperCase())`, falling back to `code.toUpperCase()` on throw or `undefined`.
  - i18n keys (exact copy from spec 2 §4.4):
    - `diag.coverageTitle` — PT `A simulação de estratégias cobre apenas o Brasil por enquanto.` / EN `Strategy simulation covers Brazil only for now.`
    - `diag.coverageBody` — PT `Ela depende da produtividade das lavouras e do calendário agrícola da região, que o TerraShift só tem para o Brasil. Os dados acima valem para qualquer lugar.` / EN `It needs local crop yields and a local crop calendar, which TerraShift only has for Brazil. The data above is valid anywhere.`
    - `diag.coverageAction` — PT `Desenhar outra área` / EN `Draw another field`

- [ ] **Step 1: Change the types** in `api.ts`; run `cd frontend && npm run build` and confirm the only errors are in `Diagnosis.tsx` (the Brazil assumptions).
- [ ] **Step 2: Update `Diagnosis.tsx`**, with `only = isDiagnosisOnly(d)`:
  - Eyebrow: full → `{municipality} ({uf})` as today, plus `<DemoBadge label={t('common.offlineExample')} />` when `d.place && !d.place.live`; diagnosis-only → `[name, region].filter(Boolean).join(', ')`, then ` · ` + `countryName(countryCode, lang)` (omit the separator when both are null).
  - Header `action`: `undefined` when `only`.
  - Insight panel: when `only`, same `insight` container with eyebrow `diag.coverageTitle`, paragraph `diag.coverageBody`, and an accent `Button` to `/terra` labelled `diag.coverageAction`; otherwise unchanged (use `d.analogYears!`/`d.yieldPlace!` only inside the full branch, or guard).
- [ ] **Step 3: Verify** — `npm run build` exits 0. With the Task 3 backend running and `npm run dev`, draw the Iowa field: header reads "Worth Township, Iowa · United States" (EN) / "… · Estados Unidos" (PT); coverage panel shown; no Continue button. Demo farm screen unchanged.
- [ ] **Step 4: Commit** — `git commit -am "Diagnosis-only screen for fields outside Brazil (#4)"`

---

### Task 6: Route guards for the simulation steps

**Files:**
- Modify: `frontend/src/pages/Rotation.tsx:24`, `Objectives.tsx:23`, `Lab.tsx:118`, `Compare.tsx:28`, `Plan.tsx:113`

**Interfaces:**
- Consumes: `isDiagnosisOnly` (Task 5).

- [ ] **Step 1: Implement** — directly above each existing guard line (all hooks are already above it), add `if (isDiagnosisOnly(s.diagnosis)) return <Navigate to="/diagnostico" replace />`.
- [ ] **Step 2: Verify** — `npm run build` exits 0. With the Iowa diagnosis in the store, typing `/rotacao`, `/objetivos`, `/laboratorio`, `/comparar`, `/plano` each lands on `/diagnostico`. With the demo farm, all five behave as before.
- [ ] **Step 3: Commit** — `git commit -am "Keep fields outside Brazil out of the simulation steps (#4)"`

---

### Task 7: README and end-to-end checks

**Files:**
- Modify: `README.md` (near the data-source table / limitations list)

- [ ] **Step 1:** Add one line to the limitations list: PT `**Cobertura:** o diagnóstico funciona em qualquer lugar; a simulação de estratégias cobre apenas o Brasil.`
- [ ] **Step 2: Run the manual checks** from spec 2 §6 and spec 1 §6, and note results for the PR:
  1. Iowa (41.98, -93.85), PT and EN: real climate (~866 mm/yr, ~9.5 °C), coverage panel, no IBGE/R$/Luís Eduardo Magalhães; `/api/simulate` → 422.
  2. Pergamino, Argentina (about -33.89, -60.57): same diagnosis-only behaviour.
  3. Demo farm and Londrina (-23.30, -51.17): same as `dev`, `demo: false`, `yieldsLive: true`.
  4. Warm the demo farm once online on this build (climate cache kind is now `climate4`), then restart with `HTTPS_PROXY=http://127.0.0.1:1`: demo farm works with `demo: false`.
  5. Same proxy, cold cache, a new Brazilian field: offline badges in Compare/Lab/Plan, offline marker in the Diagnosis header, IBGE source marked as local copy.
  6. Restore a session saved on `dev` (open the app on `dev` with the demo farm, switch build, reload): no crash, no redirect (Review Focus 4).
  7. In EN, load the demo farm's diagnosis, then in devtools edit `sessionStorage['terrashift-state-v2']` so `farm.polygon` is the Iowa polygon (the stored diagnosis stays `full`, so the guards let you through). Go to `/objetivos` and simulate: the banner shows "Strategy simulation covers Brazil only for now." Repeat from the Lab's "My rotation" dialog (Review Focus 5).
- [ ] **Step 3:** `cd backend && cargo test` and `cd frontend && npm run build` both pass.
- [ ] **Step 4: Commit** — `git commit -am "README: coverage is Brazil-only for the simulation (#4)"`
