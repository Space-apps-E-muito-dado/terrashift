# Outside-Brazil fields: refuse honestly, and stop labelling fallback data as real

Issue: Space-apps-E-muito-dado/terrashift#4 · Date: 2026-11-15 · Status: draft, awaiting approval
Base: `dev` (7a055fa), which includes the rotation/custom-crops work (#1) and the WS10M wind fix (#5). Line numbers below are from that commit.

## 1. Intent

TerraShift's yield data (IBGE PAM), crop calendar (November sowing) and water scenarios (November–March) only make sense in Brazil. Today a field drawn anywhere else silently gets Luís Eduardo Magalhães (BA) yields and calendar, and the UI calls the result "real data". Once the app is public (#2), anyone can draw a field anywhere, so this has to be honest before launch.

The fix has two separate parts, because the issue found two separate lies:

1. **Outside Brazil:** say so and stop. The geocoder answered, and the answer was "not Brazil".
2. **Lookup failed:** the offline fallback place is acceptable (the offline demo needs it), but everything built on it must be labelled offline. Today parts of it are not.

## 2. Goals / non-goals / anti-goals

**Goals**
- A field whose centroid is outside Brazil gets HTTP 422 `{"error", "code": "outside_coverage"}` from `/api/diagnosis` and `/api/simulate`, and a clear PT/EN message in the UI. No Luís Eduardo Magalhães numbers are produced.
- Any result built on the fallback place (geocoder unreachable) is flagged offline everywhere it is displayed: `demo`, `yieldsLive`, the PAM `SourceInfo.live`, and the Diagnosis header.
- The demo farm and other Brazilian fields behave exactly as before. With the network off and a warm cache, the demo farm still works.

**Non-goals**
- Supporting other regions (needs a yield source and crop calendar per region; for the US, NASS QuickStats and the Cropland Data Layer).
- Fields that straddle the border. Every source already keys off the centroid; so does this.
- Fixing the generic English error for *other* API errors (e.g. 400 "área inválida"). The new code-mapping mechanism makes that easy later, but it is not required here.
- Restricting the city search box to Brazil (`countrycodes=br` in `frontend/src/lib/geo.ts`). Cheap, optional follow-up.

**Anti-goals** (failures even if the checklist passes)
- Blocking a Brazilian farmer because the geocoder was ambiguous or down. When unsure, fall back and label; never refuse.
- Any path where fallback or example data is shown without an offline marker.
- Breaking the offline demo (cold or warm cache).

## 3. Current behaviour (verified in code)

- `fetch_place` (`sources.rs:364`) returns `Err` for "no municipality" and for "not in Brazil" (`:376`). `cached()` (`:187`) turns every `Err` into `fallback_place()` (`:619`, Luís Eduardo Magalhães, `live: false`). The caller cannot tell "geocoder down" from "geocoder said Iowa".
- `gather` (`main.rs:122`) runs climate, rain, soil, terrain and place concurrently with `tokio::join!`, then calls `pam(&place)`. `pam()` (`sources.rs:389`) fetches SIDRA for the fallback place's IBGE code and returns `live: true`.
- `simulate` (`main.rs:199`) first validates the rotation and custom crops with `crops::resolve` (400 on bad input), then calls `gather`.
- `any_offline` (`main.rs:220`) ignores `place.live`, and `/api/diagnosis` reports `yields_live: g.pam.live`. So even the issue's proposed "add `place.live` to `any_offline`" fixes only `simulate.demo`. The Diagnosis response and the PAM source label would still say live. (This is the gap the issue did not list.)
- `Diagnosis.tsx:56` prints `d.place.municipality (uf)` with no offline marker.
- `api.simulate` has two callers: `Objectives.tsx:30` and `MyRotationDialog.tsx:39` (re-simulates with the farmer's own rotation). Both show the thrown message in an `error-banner`.
- `call()` (`api.ts:196`) throws a generic message for every non-OK response; in English it ignores the body's `error`.
- Only successful `live` values are cached, to memory and to `CACHE_DIR/place-<lat,lng>.json`. The fallback is never cached.

## 4. Design

### 4.1 Typed place lookup (backend)

Introduce an outcome type so "outside Brazil" is a *successful answer*, not an error:

```rust
enum PlaceLookup {
    Found(Place),                       // in Brazil, resolved
    OutsideBrazil { country_code: String },
}
```

- `fetch_place` returns `Result<PlaceLookup>`. `Err` is reserved for "could not get an answer".
- Split the Nominatim response parsing into a pure function (no network) so it is unit-testable. Rules, in order:
  1. `address.country_code` present and not `"br"` → `OutsideBrazil`. (Compare case-insensitively.)
  2. `country_code == "br"` → continue as today: municipality name, `ISO3166-2-lvl4` `BR-xx`, then the IBGE municipality list.
  3. No `address` / no `country_code` (open ocean returns HTTP 200 `{"error":"Unable to geocode"}`) → `Err`, i.e. a failed lookup. **My call:** the conservative direction, because wrongly refusing a Brazilian farmer is worse than a labelled fallback. Known gap: a field in open water gets the labelled-offline Luís Eduardo Magalhães fallback.

  Response shapes were checked against live Nominatim on 2026-11-15 (`reverse?format=jsonv2&zoom=10`): Iowa gives `address.country_code: "us"`, `ISO3166-2-lvl4: "US-IA"`; Luís Eduardo Magalhães and Londrina give `"br"`, `BR-BA` / `BR-PR`, `address.municipality`; a mid-Atlantic point gives only the `error` body. Capture these three bodies as the unit-test fixtures.
- `cached()` is unchanged. Use `T = PlaceLookup`, fallback `PlaceLookup::Found(fallback_place())`, `is_live` = `Found(p)` with `p.live && p.ibge_code.is_some()`. **`OutsideBrazil` is not cached** (memory or disk). The cache key is a ~1 km cell (`{:.2}` lat/lng); a permanent "outside Brazil" entry for a cell straddling the border with Paraguay, Uruguay or Argentina would refuse Brazilian farmers for good, which is the anti-goal above. A refusal costs one Nominatim call, the same as any uncached Brazilian field. (Rate-limit abuse of a public app is a separate concern for #2.)
- **Cache compatibility (constraint):** existing `cache/place-*.json` files contain a bare `Place`. They must still be read, or a warm demo cache silently goes cold on upgrade and the offline demo breaks. Either make `PlaceLookup` deserialize a bare `Place` (e.g. `#[serde(untagged)]` with `Found` first) or write a one-time migration. Verify by reading a pre-change cache file in a test.
- `DataClient::place()` returns `PlaceLookup`.

### 4.2 Gate before the other fetches (backend)

`gather` resolves the place **first**, and returns early on `OutsideBrazil`:

```rust
async fn gather(data, poly) -> Result<Gathered, ApiError>
```

then runs climate, rain, soil, terrain concurrently, then `pam`. Both handlers propagate the error with `?`. In `simulate`, keep `crops::resolve` before `gather`: a malformed request gets its 400 without any upstream call, and a well-formed request outside Brazil gets the 422. The startup warm-up in `main` logs the `Err` instead of unwrapping.

Why before, not after (see Approaches): refuse without waiting for every upstream call, and don't spend NASA POWER / SoilGrids / OpenTopoData calls and disk-cache entries on fields we will refuse.

### 4.3 Liveness of everything built on the place (backend)

- `pam(&place)`: if `!place.live`, return `fallback_pam()` (local copy, `live: false`) without calling SIDRA. This makes `yields_live`, the PAM `SourceInfo.live` and `any_offline` correct from one place, and avoids fetching "live" SIDRA data for a place we made up.
- `any_offline` also includes `g.place.live`. After the change above this is redundant with `pam.live`, but it states the rule explicitly (the issue asks for it); keep both.
- Effect for a Brazilian field when Nominatim is down and the place is not cached: it gets the Luís Eduardo Magalhães local copy, now labelled offline everywhere (before: labelled live). This is the intended behaviour from the issue.
- **Demo-day effect (needs the owner's decision):** the same applies to the demo farm itself. If its place is not cached and Nominatim is down or rate-limited, the demo farm now uses the local PAM copy and gets `demo: true`, so Compare, Lab and Plan show "Includes offline data" even if SIDRA would have been reachable. Before this change it showed "real data". Options: (a) accept it, since the label is true and the numbers are the same; (b) short-circuit: when the polygon is the known demo polygon, resolve to the known Luís Eduardo Magalhães place as `live: true` without a geocode, so the demo never depends on Nominatim. The spec assumes (a) unless told otherwise; (b) is about ten lines.

### 4.4 API error contract (backend)

Extend `ApiError` with an optional machine code. Existing errors keep their current JSON; the new one adds `code`:

```json
HTTP 422
{ "error": "O TerraShift cobre apenas o Brasil por enquanto. Desenhe uma área dentro do território brasileiro.",
  "code": "outside_coverage" }
```

`error` stays Portuguese like the other API errors (and stays usable by any non-UI client). `code` is the stable contract. 422 (not 400) because the request is well-formed; the field is simply not serviceable.

### 4.5 Frontend

- `call()` parses the JSON body on error and throws an error object carrying `code` (e.g. `class ApiError extends Error { code?: string }`). Pages map known codes to an i18n string; unknown codes keep today's behaviour.
- Add i18n keys (both dictionaries; `i18n.tsx` is typed so a missing key in one language fails to compile):
  - PT `error.outsideCoverage`: "O TerraShift cobre apenas o Brasil por enquanto. Desenhe uma área dentro do território brasileiro."
  - EN `error.outsideCoverage`: "TerraShift currently covers Brazil only. Draw a field inside Brazil."
- Display: the existing `error-banner` on the "Sua terra" screen (`SelectArea.analyze`), where the user can redraw. Both `/simulate` callers (`Objectives.tsx:33`, `MyRotationDialog.tsx:42`) show the same message if `/simulate` returns it; put the code-to-message mapping in one helper so the two can't drift. Keep the user on the screen; don't clear the drawn field.
- `Diagnosis.tsx:56`: when `d.place.live` is false, show the municipality with the existing offline marker (`common.offlineExample` / `DemoBadge`) rather than as fact. For the demo farm with a cold cache this is true and harmless: the demo farm really is in Luís Eduardo Magalhães, and the marker only says the lookup was not live. **My call.**
- README: add one line stating coverage is Brazil only.

## 5. Approaches considered

**A. Gate after the existing `join!`.** Smallest diff: keep `gather` as is, check the place afterwards. Cost: an Iowa request still makes four upstream calls (and writes four cache files) before refusing, and takes as long as a normal request to fail.

**B. Resolve place first, then everything else. (Recommended.)** Cost: for an uncached field, the place lookup (Nominatim, then the IBGE municipality list) is no longer overlapped with the NASA POWER calls, so total latency rises by that lookup (zero when cached). That is usually about a second, but not bounded: the HTTP client timeout is 45 s, so a hanging Nominatim now delays everything instead of overlapping with it. The frontend already shows a minimum 2.2 s progress animation. Benefit: refusal without waiting for the other sources, no wasted upstream calls, no junk cache entries from a public app. Variant that keeps the concurrency: start all fetches together and use `try_join!` so a refusal drops the in-flight ones; it keeps latency but still starts the upstream calls, so it only helps a little with waste.

**C. Check the country in the browser** (via the Nominatim call the search box already makes) and never call the API. Rejected: the API is public and must enforce its own coverage, and the issue requires 422 from the API.

Recommendation is B; A is acceptable if latency on cold fields matters more than wasted calls.

## 6. Tests

Unit (backend, no network):
- Parser: Nominatim JSON with `country_code: "us"` → `OutsideBrazil`, never the fallback place (the issue's required test). Also: `"br"` + `BR-BA` → name/uf extracted; no `address` → failed lookup; `"BR"` uppercase handled.
- `PlaceLookup` deserializes a legacy bare-`Place` cache file, and `OutsideBrazil` reports not-cacheable.
- `pam()` with a non-live place returns a non-live `Pam` without network (pass a place with `live: false`).
- `ApiError` serializes `{error, code}` with status 422; existing errors serialize without `code`.

Manual (record results in the PR):
1. Iowa field (41.98, -93.85): `POST /api/diagnosis` and `/api/simulate` → 422 `outside_coverage`; in the UI, PT and EN banners; no Luís Eduardo Magalhães numbers anywhere.
2. Demo farm and a field elsewhere in Brazil (e.g. Paraná): identical output to `main` on the same cache, `demo: false`, `yieldsLive: true`.
3. Network off + warm cache. #5 renamed the climate cache kind (`climate3` → `climate4`), so a cache warmed before `dev` is cold for climate: run the demo farm once online on this build first. Then cut the network (a dead proxy such as `HTTPS_PROXY=http://127.0.0.1:1` works with reqwest): the demo farm still works with `demo: false`. An Iowa request in the same state cannot be refused (refusals are not cached and the geocoder is unreachable), so it returns a result labelled offline everywhere. That is the accepted behaviour: refusal needs the geocoder's answer.
4. Network off + cold cache, Brazilian field: result labelled offline in Compare/Lab/Plan badges, Diagnosis header marker and PAM source.

## 7. Done when

(From the issue, tightened.)
- Iowa shows the coverage message in PT and EN and no Luís Eduardo Magalhães numbers.
- The demo farm and other Brazilian fields behave as before.
- Network off + warm cache: the demo farm still works.
- No response or screen presents fallback place data as live (`demo`, `yieldsLive`, PAM source, Diagnosis header all agree).

## 8. Risks and builder notes

- **Branch drift:** the rotation work is already on `dev`, so no merge conflict is expected from it. Re-check `main.rs` (`simulate`, `gather`) and `api.ts` (`call`) against `dev` before opening the PR, since other branches may land there first.
- **Nominatim usage policy:** at most 1 req/s and a meaningful User-Agent (the current one is set). B adds no extra Nominatim calls. Refusals are not cached, so repeated outside-Brazil requests each cost one call; rate limiting belongs with the public deployment (#2).
- **Left to the builder:** exact `PlaceLookup` serde shape (as long as legacy cache files read), naming, whether `ApiError.code` is `Option<&'static str>`, and how pages map codes to strings.
