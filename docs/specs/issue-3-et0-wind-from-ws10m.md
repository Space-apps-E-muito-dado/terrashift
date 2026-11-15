# Spec: derive ET0 wind from NASA POWER `WS10M` (issue #3)

Issue: https://github.com/Space-apps-E-muito-dado/terrashift/issues/3 (label: bug)

## Problem

`fetch_climate` requests `WS2M` from NASA POWER and passes it as `u2` to the FAO-56 Penman–Monteith ET0 (`et0_mm_day`, `backend/src/model.rs`). In some grid cells `WS2M` stays near 0.1 m/s all year, which is implausible for open cropland. Dry-season ET0 is then 6–26% too low (Mato Grosso, August: 3.59 → 4.52 mm/day). Built-in November-sown crops are barely affected (wet-season wind term is small), but farmer-defined crops with other planting months and a future safrinha are.

## Goal

Feed `et0_mm_day` a 2 m wind speed derived from `WS10M`, and make sure no cached response with the old wind is reused.

## Non-goals

- No change to the ET0 formula, `Climate`/`MonthClimate` types or the API shape. `wind_ms` keeps meaning "wind at 2 m (m/s)".
- No change to `fallback_climate` (already 1.7–2.6 m/s at 2 m).
- No change to the frontend.

## Design

### 1. Request and convert (`backend/src/sources.rs`, `fetch_climate`)

- Replace `WS2M` with `WS10M` in the `parameters=` list of the POWER URL.
- Add a named constant and helper near the top of the file:

  ```rust
  /// FAO-56 eq. 47 for a 10 m anemometer over short grass: u2 = u_z · 4.87 / ln(67.8·z − 5.42), z = 10 m.
  const WIND_10M_TO_2M: f64 = 0.748;
  ```
- In the month loop: `wind_ms: get("WS10M", mk)? * WIND_10M_TO_2M`.
- Round to 2 decimals (`(x * 100.0).round() / 100.0`) so the cache and API output are stable. Check for an existing rounding helper; `round1` is too coarse for 0.1–0.9 m/s values.

### 2. Cache invalidation

- Change the cache kind `"climate3"` to `"climate4"` in `climate()`. Old entries stay on disk unused.

### 3. Labels and docs

- `sources.rs` source string (~line 521): `WS2M` → `WS10M` (e.g. `"NASA POWER · T2M, PRECTOTCORR, RH2M, WS10M (→2 m), ALLSKY_SFC_SW_DWN"`).
- `README.md` data table (~line 58): same parameter swap, and mention the FAO-56 conversion in the row or a footnote.
- Doc comment on `Climate::wind_ms` and the module header: keep "2 m", note it is derived from `WS10M`.

### 4. Failure behaviour

Unchanged: a missing or fill-value (≤ −900) `WS10M` makes `get` return an error, and `cached` falls back to `fallback_climate`.

## Tests

Add to `sources.rs` `mod tests` (no network):

1. Extract the per-month parsing into a function that takes the POWER JSON `parameter` object (or test the conversion helper alone) and assert `WS10M = 1.0` → `wind_ms == 0.75` and `WS10M = 4.04` → `3.02`.
2. A POWER-shaped JSON fixture containing only `WS10M` (no `WS2M`) parses successfully; one missing `WS10M` returns an error.

Optional regression test in `model.rs`: ET0 for the Mato Grosso August inputs rises from about 3.59 to about 4.52 mm/day when `wind_ms` moves from 0.12 to 0.77 (tolerance ±0.05).

## Acceptance criteria

- [ ] `cargo test` passes.
- [ ] `/api/diagnosis` for a field near −11.02, −53.01 returns monthly `windMs` between 0.5 and 0.9 (fresh cache, `climate4`).
- [ ] Demo farm (LEM, −12.10, −45.91): soy ETc goes from about 458 mm to about 463 mm; ET0 Nov–Mar from about 683 to about 691 mm.
- [ ] No remaining references to `WS2M` in `backend/` or `README.md` (`grep -rn WS2M`), apart from any comment explaining why it is avoided.
- [ ] Source label and README table list `WS10M`.

## Risks and notes

- `WS10M` in POWER is also a coarse (MERRA-2) grid value; it reduces the near-zero artefact but does not make wind site-specific. The 0.748 factor is the standard FAO-56 conversion for a reference grass surface.
- The cache directory keeps stale `climate3` files; harmless, can be cleaned manually.
- `sources.rs` is identical on `feat/rotation-custom-crops`, so the same patch applies there. Merge this first or cherry-pick to avoid divergence.
- The data dictionary (`dicionario_de_dados.md`, section 1.1) already recommends this approach; it is not in this checkout, so link it from the PR if it lives elsewhere.
