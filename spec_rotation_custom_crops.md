# Spec: Current rotation and farmer-defined crops

Written Sat 2026-11-14 from a working session. It supersedes handoff.md section 5 where they differ. Deadline: Sun 2026-11-15 23:59 (America/Sao_Paulo).

**Implemented 2026-11-14 (evening).** Defaults taken for the open questions in §11: the rotation screen (04a) is its own step, so the stepper now has 5 steps; root depth is dropped; the cycle is capped at 6 months; custom crops get the Ky-based risk; "Minha rotação" is opened from the Laboratório. The type defaults table (§6.2) is filled in `backend/src/crops.rs` (`type_row`). Its Kc values and stage lengths come from FAO-56 Tables 11 and 12. Its Ky values come from FAO-66 (Steduto et al. 2012) Table 1, p. 6, which reproduces FAO-33 Table 24. Each row cites its source. C factors reuse the built-in reference values (little straw 0.20, a lot 0.12, cover 0.04), and fallow is C = 1.

Tags: **[DECIDED]** the user chose it. **[PROPOSED]** the builder's recommendation, not yet confirmed. **[TO SOURCE]** a number that must come from a cited document, never from memory.

---

## 1. Why

The challenge asks the tool to compare at least three rotation strategies, **including the farmer's existing one**. Today the baseline is hard-coded as soy every year (`backend/src/model.rs`, `simulate`, `"atual"`). The "O que foi plantado recentemente?" answer is collected but ignored (`backend/src/main.rs`, `SimulateReq.recent_crop`).

The user also wants the tool to work for any farmer, whatever crops they plant. Their words, paraphrased: without this, the tool leans too heavily on static data.

## 2. Scope

### Goals

1. The farmer states their real rotation for the last three seasons. "Rotação atual" (current rotation) uses it.
2. The farmer can add a crop that is not in the catalog by answering a few plain questions.
3. The farmer can build one rotation of their own ("Minha rotação") from built-in and custom crops, and compare it with the fixed strategies.
4. Every result that involves a custom crop is visibly marked as an estimate.

### Non-goals

- Income for custom crops. **[DECIDED]** No income is ever shown, and the form has no yield or price fields.
- An uncertainty band. **[DECIDED]** Show a single value plus the "estimado" tag.
- The tool generating candidate rotations with custom crops. **[DECIDED]** The farmer builds them.
- A nitrogen, pest or organic-matter index. The model doesn't have one (see §6.5).
- More than one crop per year (safrinha, the second crop). One main crop per season, as in the current model.
- Saving or sharing crops on the server.

### Constraints

- **[DECIDED]** Extend the existing Rust and React app. Don't rewrite it.
- **[DECIDED]** The form must be minimal and usable by farmers with low formal education. This drives every design choice below.
- Stateless backend, no database. Custom crops are sent with each request.
- Every model parameter is traceable to a cited source (FAO-56, FAO-33 or published C factors).

---

## 3. User flow

```
Diagnóstico → [04a Sua rotação atual] → 04 Objetivos → Laboratório → Comparar → Plano
                     │
                     └─ "+ Outra cultura" → [04b Adicionar cultura] (side panel) → back to 04a
```

The designs are in `../pencil/nasa.pen`: frame **04a - Sua rotação atual** (`W4uuH3`) and frame **04b - Adicionar cultura** (`CidIm`).

**Open:** should 04a be its own step (the stepper becomes "x de 5") or replace the crop-question row on 04 Objetivos? **[PROPOSED]** Make it its own step. The row on 04 has no room for three seasons and a picker.

---

## 4. Screen 04a: Sua rotação atual (current rotation)

**Question:** "O que você plantou nos últimos 3 anos?" (What did you plant in the last 3 years?)

| Element | Behaviour |
|---|---|
| Three season cards: 2023/24, 2024/25, 2025/26 | Crop photo or icon, crop name, and a "Trocar" link (change). Tapping a card opens the picker for that season and highlights the card. |
| Picker: "O que você plantou na safra 2024/25?" | Large tiles: Soja, Milho, Cobertura, each custom crop (with an **estimado** tag), **Deixei parada** (left idle), and **+ Outra cultura** (opens 04b). One tap selects the crop and closes the picker. |
| Hint "Só a safra principal (verão)" | Says that only the main (summer) crop counts. |
| Note | "Em 'Rotação atual', vamos repetir Soja → Milho → Soja de 2027 a 2029. Não lembra? Deixe como está." (In "Rotação atual", we repeat Soy → Maize → Soy from 2027 to 2029. Don't remember? Leave it as is.) Updates live. |
| Default | Soja, Soja, Soja, the same as today's behaviour, so skipping the screen changes nothing. |
| Footer | "Voltar ao diagnóstico" (back) and "Continuar" (continue). |

**Baseline rule [PROPOSED]:** the plan years 2027, 2028 and 2029 repeat the three declared seasons in order. Season 1 maps to 2027, season 2 to 2028, season 3 to 2029.

The same picker, with the title "Monte a sua rotação" (build your rotation) and years 2027–2029, is used to build **Minha rotação** from the Laboratório or Comparar screen. The entry point is not drawn yet.

## 5. Screen 04b: Adicionar cultura (the form)

A side panel on desktop and a full-screen sheet on mobile. There are four numbered questions and nothing else is required.

| # | Question (PT) | Input | Stored as |
|---|---|---|---|
| 1 | Qual o nome da planta? (plant name) | Text field | `name` |
| 2 | Que tipo de planta é? (plant type) | Six tiles, each with an icon, a name and familiar examples | `type` |
| 3 | Quanto tempo do plantio até a colheita? (time from planting to harvest) | Chips: 2, 3, 4, 5 meses (months), "6 ou mais" (6 or more). Helper text: "Mais ou menos N dias." (about N days) | `cycle_months` (2–6) |
| 4 | Em que mês você planta? (planting month) | 12 month chips in two rows | `planting_month` (1–12) |

**Type tiles:**

| Tile (PT) | `type` | Examples shown |
|---|---|---|
| Grão | `cereal` | milho, arroz, trigo |
| Feijões | `legume` | feijão, amendoim |
| Dá óleo | `oilseed` | girassol, gergelim |
| Raiz | `root` | mandioca, batata |
| Pasto | `forage` | capim, sorgo |
| Cobertura | `cover` | braquiária, milheto |

**Defaults box (collapsed):** "Para feijões, já usamos o comum:" (for beans, we use the usual) followed by value pills, for example "Água: média · Palha: pouca". A **Mudar** link (change) expands each pill into a three-way choice:

- water: pouca / média / muita (little / medium / a lot)
- straw: pouca / muita (little / a lot)

The expanded state is not drawn yet. The defaults come from the type defaults table (§6.2).

**Root depth [PROPOSED: drop it].** The design shows "Raiz: curta" (root: shallow), but the current monthly model has no soil-water reserve, so root depth would change nothing. Remove the pill rather than ask a question that has no effect. Bring it back only if a soil-water reserve is added (§6.5).

**Estimate warning** above the buttons, always visible: "Os resultados desta planta são uma estimativa feita a partir das suas respostas. Converse com um técnico agrícola antes de decidir." (The results for this plant are an estimate based on your answers. Talk to an agricultural technician before deciding.)

**Buttons:** "Cancelar" (cancel) and "Adicionar cultura" (add crop). On success, close the panel, add the crop to the picker and select it for the season being edited.

### Validation

Error messages appear next to the field, in plain words, in PT and EN. "Adicionar cultura" stays enabled; tapping it shows the errors.

| Rule | Message (PT) |
|---|---|
| Name empty after trimming | "Escreva o nome da planta." (Write the plant's name.) |
| Name longer than 40 characters | "Use um nome mais curto." (Use a shorter name.) |
| Name matches a built-in or custom crop, ignoring case and accents | "Você já tem uma planta com esse nome." (You already have a plant with this name.) |
| No type chosen | "Escolha o tipo de planta." (Choose the plant type.) |
| No cycle chosen | "Escolha quanto tempo leva." (Choose how long it takes.) |
| No month chosen | "Escolha o mês de plantio." (Choose the planting month.) |

Editing and deleting a custom crop: tile menu → "Editar" or "Apagar" (delete). Deleting a crop that is used in a rotation puts that season back to its default (Soja in the baseline, empty in Minha rotação) and shows a short notice.

### Storage

- Custom crops go in `localStorage` under `terrashift-crops-v1`, so they survive a reload and disappear when browser storage is cleared. Wrap every access in try/catch; the store already does this for `sessionStorage`.
- Both rotations live in the existing session state (`frontend/src/lib/store.tsx`), replacing `recentCrop`.
- All strings go in `frontend/src/lib/i18n.tsx`.

---

## 6. Model changes (`backend/src/model.rs`)

### 6.1 Crop identity

Replace `CropId` as the sequence element with a crop reference that can name a built-in or custom crop:

- built-in: `soja`, `milho`, `cobertura`, and the new **`pousio`** (fallow, "Deixei parada")
- custom: `custom-<n>`, resolved against `custom_crops` in the request

Fields that are currently `&'static str` (`Strategy.id`, `name`, `tagline`, `YearOutcome.crop_name`) become `String`, so they can carry the farmer's names.

### 6.2 Type defaults table [TO SOURCE]

Fill this table from FAO-56 (Allen et al., 1998) Tables 11 and 12 and FAO-33 (Doorenbos & Kassam, 1979). Record the table and page for every value. Rows must not be filled from memory.

| type | Kc_ini | Kc_mid low / high | Kc_end | stage fractions (ini/dev/mid/late) | Ky | C factor, little / a lot of straw | default water | default straw | source |
|---|---|---|---|---|---|---|---|---|---|
| cereal | | | | | | | | | |
| legume | | | | | | | | | |
| oilseed | | | | | | | | | |
| root | | | | | | | | | |
| forage | | | | | | | | | |
| cover | | | | | | | | | |
| *pousio* | 0 | — | — | — | — | bare soil | — | — | |

### 6.3 Turning answers into parameters

1. **Cycle:** `cycle_days = cycle_months × 30`. "6 ou mais" gives 180 days. **[PROPOSED]** Cap it there. Longer crops such as cassava are a known limitation and should be stated in the UI copy for the Raiz type.
2. **Kc curve:** use the FAO-56 four-stage curve. The stage lengths are the type's fractions × `cycle_days`, starting on the 15th of `planting_month`. The water answer splits the type's Kc_mid range into three equal parts, and the model uses the midpoint of the chosen part. Average the daily Kc into the existing 12-slot calendar-month array, so `run()` handles the crop exactly like a built-in one. A cycle that crosses December wraps around within the same season (Oct of year y−1 to Sep of year y), the same way the built-in November sowings already do.
3. **Erosion:** the C factor comes from the type row and the straw answer. A custom crop with a lot of straw gives the next crop the same `COVER_RESIDUE_C_MULT` carry-over that `Cobertura` gives today.
4. **Built-in crops are unchanged.** Their hand-written Kc arrays and IBGE calibration stay as they are.

### 6.4 Results for custom crops

| Output | Built-in crop | Custom crop |
|---|---|---|
| Water demand, water balance, deficit | ETc vs effective rain | Same method, using the generated Kc |
| Soil loss and soil index | RUSLE | Same method, using the type and straw C factor |
| Revenue and `return_idx` | IBGE PAM calibration | **Not available**: `null`, never 0 |
| Yield | IBGE PAM calibration | Not shown |
| Climate risk | Share of analog seasons with yield at least 15 % below trend (IBGE) | **[PROPOSED]** Run each analog season's real monthly rain through the FAO-33 response `1 − Ya/Ym = Ky × (1 − ETa/ETc)`, with `ETa = min(ETc, Pe)`. Risk is the share of seasons where `Ya/Ym < LOSS_THRESHOLD` (0.85). This uses NASA POWER and the FAO-33 Ky only, with no invented yields. |
| `estimated` | `false` | `true` |

**Fallow (`pousio`):** no water demand, no revenue, no risk, the bare-soil C factor, and `harvest: false`.

**A rotation that contains any custom crop:**
- `estimated: true` on the strategy and on each affected year
- its revenue summary is `null` ("não disponível", not available), not an average over the known years
- it is excluded from any income-based ordering or "best for profit" highlight, with a note saying why

**Expected behaviour, not a bug:** two custom crops with the same answers give identical results. The UI must not rank them against each other.

### 6.5 Known model limits to state in the UI

- No nitrogen index. A legume is not credited with nitrogen fixation in the numbers. The explanation may say "feijões costumam deixar nitrogênio no solo (não calculado)" (beans usually leave nitrogen in the soil; not calculated).
- No soil-water reserve: monthly rain is compared directly to crop demand. That is why root depth is dropped.
- One main crop per season.
- Custom-crop parameters represent the type, not the species. Within one type, peak water demand varies between species. **[TO SOURCE]** The size of that spread, from the FAO-56 tables.

---

## 7. API contract (`POST /simulate`)

```jsonc
// request
{
  "polygon": [...],
  "objective": "equilibrio",
  "currentRotation": ["soja", "milho", "custom-1"],   // replaces recentCrop
  "myRotation": ["custom-1", "cobertura", "milho"],   // optional
  "customCrops": [{
    "id": "custom-1",
    "name": "Feijão-caupi",
    "type": "legume",
    "cycleMonths": 3,
    "plantingMonth": 2,
    "water": "media",      // optional; type default if absent
    "straw": "pouca"       // optional; type default if absent
  }]
}
```

The response keeps its current shape, with these changes:
- `baseline` is built from `currentRotation`.
- When `myRotation` is present, `strategies` gains `{ "id": "minha", "name": "Minha rotação", ... }`.
- `estimated: bool` is added to `Strategy` and `YearOutcome`.
- `revenueBrlHa`, `returnIdx` and `yieldKgHa` become `null` for custom crops, and `revenueBrlHa` becomes `null` in the summary of any estimated strategy.
- `params` is added to each custom crop's year: the derived Kc_mid, Ky and C values with their source tags, for the "Fontes e hipóteses" (sources and assumptions) panel.

The server rejects these with HTTP 400: an unknown crop id, a `customCrops` entry with missing fields, `cycleMonths` outside 2–6, `plantingMonth` outside 1–12, or rotations that are not exactly 3 crops long.

---

## 8. Labelling (everywhere a custom crop appears) [DECIDED]

- An **estimado** tag (amber, `#E8B03E` at 15 % on `#8A5F12` text) on picker tiles, season cards, strategy cards, timeline years, comparison rows and the plan.
- Explanation text built from the numbers, e.g. "Feijão-caupi foi estimado a partir da sua descrição. Revise com um técnico agrícola." (Feijão-caupi was estimated from your description. Review it with an agricultural technician.)
- Income cells read "não disponível" / "not available", with the tooltip "Não sabemos o preço nem a produtividade desta planta." (We don't know this plant's price or yield.)
- The exported report carries the same tags and note.

---

## 9. Acceptance checks

1. Skipping 04a gives exactly today's results (baseline Soja ×3).
2. Setting 04a to Soja, Milho, Soja makes "Rotação atual" show Soja → Milho → Soja for 2027–29.
3. A crop entered with only the four questions can be added, placed in either rotation and simulated without error.
4. Every place that shows a custom crop shows the **estimado** tag.
5. Any rotation that contains a custom crop shows income as "não disponível", never a number or R$ 0, and is excluded from profit ordering.
6. Two custom crops with identical answers give identical results.
7. A custom crop survives a page reload and disappears after clearing site data.
8. Each invalid input from §5 shows its message next to its field. The API returns 400 for the cases in §7.
9. "Deixei parada" simulates as no harvest with high soil loss.
10. Every value in the type defaults table has a citation in the code and in the sources panel.
11. All new strings exist in both PT and EN.
12. `cargo test` covers: Kc curve generation (shape, wrap-around across December), the Ky risk calculation on a synthetic dry series, the null revenue path, and baseline construction from input.

## 10. Build order

1. **Baseline from input:** the 04a screen and `currentRotation` in the API. Smallest change and closes the challenge requirement.
2. **`pousio` (fallow)**, and moving names and ids to `String`.
3. **Type defaults table**, sourced and cited.
4. **Custom crop in the model:** Kc generation, C factor, Ky risk, null revenue, plus tests.
5. **Form 04b** with validation and `localStorage`.
6. **"Minha rotação"** entry point and card.
7. **Labelling pass** across Laboratório, Comparar, Plano and the export.

## 11. Open questions

1. Is 04a a separate step, or does it replace the crop row on 04 Objetivos? (§3)
2. Drop the root-depth pill? (§5)
3. Is it acceptable to cap the cycle at 6 months, leaving long crops like cassava out? (§6.3)
4. Use the Ky-based risk for custom crops, or show risk as "não disponível" too? (§6.4)
5. Where does the farmer open "Monte a sua rotação": Laboratório, Comparar or both? This screen is not designed yet.
6. Mobile versions of 04a and 04b are not designed yet.
