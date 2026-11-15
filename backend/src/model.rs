//! TerraShift rotation simulator (v0.2) — indices computed from real data.
//!
//! | Index | Method | Data |
//! |---|---|---|
//! | Scenarios (dry / typical / wet) | Terciles of the driest month of the season (Nov–Mar, "veranico") | NASA POWER monthly rain |
//! | Gross revenue (R$/ha) | Detrended municipal yield × scenario ratio × recent implied price | IBGE PAM 5457 × NASA POWER |
//! | Climate risk | Share of analog seasons with a yield ≥15 % below trend | IBGE PAM 5457 × NASA POWER |
//! | Water demand / balance | Crop ETc (FAO-56 Penman–Monteith × Kc) vs effective rain (USDA-SCS); balance index 50 = rain exactly meets ETc | NASA POWER |
//! | Soil protection / loss | RUSLE: R (Lombardi Neto) × K (Williams/EPIC) × LS (Wischmeier–Smith) × C | NASA POWER, SoilGrids, SRTM |
//!
//! Literature coefficients (Kc, C factor, slope length) are listed in `CropParams` and returned
//! to the UI as assumptions. Costs of production are not included: revenue is gross.

use serde::{Deserialize, Serialize};

pub use crate::crops::CropId;
use crate::crops::{self, CropSpec, CustomParams};
use crate::sources::{Climate, Pam, PamYear, RainSeries, Soil, Terrain, DAYS_IN_MONTH};

pub const PLAN_YEARS: [i32; 3] = [2027, 2028, 2029];
/// A season counts as a crop failure when yield falls this much below its trend.
pub const LOSS_THRESHOLD: f64 = 0.85;
/// Assumed slope length for the LS factor (m).
pub const SLOPE_LENGTH_M: f64 = 100.0;

/// Straw from a cover crop lowers the C factor of the next crop.
const COVER_RESIDUE_C_MULT: f64 = 0.7;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Objective {
    Lucro,
    Solo,
    Seguranca,
    Equilibrio,
}

// ---------------------------------------------------------------- scenarios

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonRain {
    /// Harvest year (season Oct of year-1 → Sep of year).
    pub year: i32,
    pub oct_mar_mm: f64,
    /// Rain of the driest month between November and March (mm).
    pub driest_month_mm: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioProfile {
    /// Mean monthly rain of the analog seasons, calendar order Jan..Dec.
    pub months: Vec<f64>,
    pub oct_mar_mm: f64,
    pub driest_month_mm: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalogYears {
    pub criterion: String,
    pub seco: Vec<i32>,
    pub tipico: Vec<i32>,
    pub chuvoso: Vec<i32>,
    pub seasons: Vec<SeasonRain>,
    pub profile_seco: ScenarioProfile,
    pub profile_tipico: ScenarioProfile,
    pub profile_chuvoso: ScenarioProfile,
}

fn season_months(series: &RainSeries, y: i32) -> Option<[f64; 12]> {
    let mut out = [0.0; 12];
    for (m, slot) in out.iter_mut().enumerate() {
        let year = if m >= 9 { y - 1 } else { y };
        *slot = series.month(year, m)?;
    }
    Some(out)
}

/// Split the real seasons into terciles of the driest month (Nov–Mar).
pub fn analog_years(series: &RainSeries) -> AnalogYears {
    let first = series.years.iter().map(|y| y.year).min().unwrap_or(2000) + 1;
    let last = series.years.iter().map(|y| y.year).max().unwrap_or(2024);
    let mut seasons: Vec<(SeasonRain, [f64; 12])> = (first..=last)
        .filter_map(|y| {
            let m = season_months(series, y)?;
            let oct_mar = m[9] + m[10] + m[11] + m[0] + m[1] + m[2];
            let driest = [m[10], m[11], m[0], m[1], m[2]].into_iter().fold(f64::INFINITY, f64::min);
            Some((SeasonRain { year: y, oct_mar_mm: oct_mar.round(), driest_month_mm: driest.round() }, m))
        })
        .collect();
    seasons.sort_by(|a, b| a.0.driest_month_mm.total_cmp(&b.0.driest_month_mm).then(a.0.year.cmp(&b.0.year)));
    let n = seasons.len();
    let third = (n / 3).max(1);
    let groups = [&seasons[..third], &seasons[third..n - third], &seasons[n - third..]];
    let profile = |g: &[(SeasonRain, [f64; 12])]| {
        let k = g.len().max(1) as f64;
        let months: Vec<f64> = (0..12).map(|m| (g.iter().map(|s| s.1[m]).sum::<f64>() / k * 10.0).round() / 10.0).collect();
        ScenarioProfile {
            oct_mar_mm: (g.iter().map(|s| s.0.oct_mar_mm).sum::<f64>() / k).round(),
            driest_month_mm: (g.iter().map(|s| s.0.driest_month_mm).sum::<f64>() / k).round(),
            months,
        }
    };
    let years = |g: &[(SeasonRain, [f64; 12])]| {
        let mut v: Vec<i32> = g.iter().map(|s| s.0.year).collect();
        v.sort();
        v
    };
    let mut all: Vec<SeasonRain> = seasons.iter().map(|s| s.0.clone()).collect();
    all.sort_by_key(|s| s.year);
    AnalogYears {
        criterion: "Mês mais seco entre novembro e março (veranico), em terços da série".into(),
        seco: years(groups[0]),
        tipico: years(groups[1]),
        chuvoso: years(groups[2]),
        profile_seco: profile(groups[0]),
        profile_tipico: profile(groups[1]),
        profile_chuvoso: profile(groups[2]),
        seasons: all,
    }
}

// ---------------------------------------------------------------- water (FAO-56)

const MID_MONTH_DOY: [f64; 12] = [15.0, 46.0, 74.0, 105.0, 135.0, 162.0, 198.0, 228.0, 258.0, 288.0, 318.0, 344.0];

/// Monthly reference evapotranspiration (mm/day), FAO-56 Penman–Monteith with monthly means.
pub fn et0_mm_day(climate: &Climate, lat: f64) -> [f64; 12] {
    let phi = lat.to_radians();
    let z = climate.elevation_m;
    let pressure = 101.3 * ((293.0 - 0.0065 * z) / 293.0).powf(5.26);
    let gamma = 0.665e-3 * pressure;
    let mut out = [0.0; 12];
    for (i, m) in climate.months.iter().enumerate().take(12) {
        let t = m.temp_c;
        let j = MID_MONTH_DOY[i];
        let dr = 1.0 + 0.033 * (2.0 * std::f64::consts::PI * j / 365.0).cos();
        let delta = 0.409 * (2.0 * std::f64::consts::PI * j / 365.0 - 1.39).sin();
        let ws = (-phi.tan() * delta.tan()).clamp(-1.0, 1.0).acos();
        let ra = 24.0 * 60.0 / std::f64::consts::PI
            * 0.0820
            * dr
            * (ws * phi.sin() * delta.sin() + phi.cos() * delta.cos() * ws.sin());
        let rso = (0.75 + 2e-5 * z) * ra;
        let rs = m.radiation_mj.min(rso);
        let es = 0.6108 * (17.27 * t / (t + 237.3)).exp();
        let ea = es * m.rh_pct / 100.0;
        let rnl = 4.903e-9 * (t + 273.16).powi(4) * (0.34 - 0.14 * ea.sqrt()) * (1.35 * rs / rso - 0.35);
        let rn = 0.77 * rs - rnl;
        let slope = 4098.0 * es / (t + 237.3).powi(2);
        let u2 = m.wind_ms;
        let et0 = (0.408 * slope * rn + gamma * 900.0 / (t + 273.0) * u2 * (es - ea)) / (slope + gamma * (1.0 + 0.34 * u2));
        out[i] = et0.max(0.0);
    }
    out
}

/// USDA-SCS monthly effective rainfall (mm).
pub fn effective_rain(p: f64) -> f64 {
    if p <= 250.0 {
        p * (125.0 - 0.2 * p) / 125.0
    } else {
        125.0 + 0.1 * p
    }
}

// ---------------------------------------------------------------- soil (RUSLE)

/// Rainfall erosivity R (MJ·mm·ha⁻¹·h⁻¹·yr⁻¹), Lombardi Neto & Moldenhauer (1992).
pub fn erosivity(months: &[f64]) -> f64 {
    let p: f64 = months.iter().sum();
    if p <= 0.0 {
        return 0.0;
    }
    months.iter().map(|r| 67.355 * (r * r / p).powf(0.85)).sum()
}

/// Soil erodibility K (t·ha·h·ha⁻¹·MJ⁻¹·mm⁻¹), Williams (1995) EPIC equation.
pub fn erodibility(sand: f64, silt: f64, clay: f64, oc_pct: f64) -> f64 {
    let fcsand = 0.2 + 0.3 * (-0.256 * sand * (1.0 - silt / 100.0)).exp();
    let fclsi = (silt / (clay + silt).max(1e-6)).powf(0.3);
    let forgc = 1.0 - 0.25 * oc_pct / (oc_pct + (3.72 - 2.95 * oc_pct).exp());
    let sn1 = 1.0 - sand / 100.0;
    let fhisand = 1.0 - 0.7 * sn1 / (sn1 + (-5.51 + 22.9 * sn1).exp());
    fcsand * fclsi * forgc * fhisand * 0.1317
}

/// Topographic factor LS, Wischmeier & Smith (1978).
pub fn ls_factor(slope_pct: f64, length_m: f64) -> f64 {
    let theta = (slope_pct / 100.0).atan();
    let m = if slope_pct < 1.0 {
        0.2
    } else if slope_pct < 3.5 {
        0.3
    } else if slope_pct < 5.0 {
        0.4
    } else {
        0.5
    };
    let s = theta.sin();
    (length_m / 22.13).powf(m) * (65.41 * s * s + 4.56 * s + 0.065)
}

// ---------------------------------------------------------------- yields (IBGE PAM)

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioYield {
    pub ratio: f64,
    pub loss_seasons: usize,
    pub seasons: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CropCalibration {
    pub crop: CropId,
    pub first_year: i32,
    pub last_year: i32,
    pub years: usize,
    pub trend_yield_kg_ha: f64,
    pub trend_gain_kg_ha_yr: f64,
    pub price_brl_kg: f64,
    pub price_years: Vec<i32>,
    pub seco: ScenarioYield,
    pub tipico: ScenarioYield,
    pub chuvoso: ScenarioYield,
}

fn calibrate(crop: CropId, rows: &[PamYear], a: &AnalogYears) -> Option<CropCalibration> {
    let rows: Vec<&PamYear> = rows.iter().filter(|r| r.yield_kg_ha > 0.0).collect();
    if rows.len() < 6 {
        return None;
    }
    let n = rows.len() as f64;
    let mx = rows.iter().map(|r| r.year as f64).sum::<f64>() / n;
    let my = rows.iter().map(|r| r.yield_kg_ha).sum::<f64>() / n;
    let sxx: f64 = rows.iter().map(|r| (r.year as f64 - mx).powi(2)).sum();
    let sxy: f64 = rows.iter().map(|r| (r.year as f64 - mx) * (r.yield_kg_ha - my)).sum();
    let b = if sxx > 0.0 { sxy / sxx } else { 0.0 };
    let intercept = my - b * mx;
    let trend = |y: i32| (intercept + b * y as f64).max(1.0);
    let ratio = |r: &PamYear| r.yield_kg_ha / trend(r.year);
    let last = rows.iter().map(|r| r.year).max()?;
    let first = rows.iter().map(|r| r.year).min()?;
    let recent: Vec<&&PamYear> = rows.iter().rev().take(3).collect();
    let price = recent.iter().map(|r| r.value_thousand_brl * 1000.0 / (r.yield_kg_ha * r.area_ha)).sum::<f64>()
        / recent.len() as f64;
    let scen = |years: &[i32]| {
        let rs: Vec<f64> = rows.iter().filter(|r| years.contains(&r.year)).map(|r| ratio(r)).collect();
        if rs.is_empty() {
            return ScenarioYield { ratio: 1.0, loss_seasons: 0, seasons: 0 };
        }
        ScenarioYield {
            ratio: (rs.iter().sum::<f64>() / rs.len() as f64 * 1000.0).round() / 1000.0,
            loss_seasons: rs.iter().filter(|x| **x < LOSS_THRESHOLD).count(),
            seasons: rs.len(),
        }
    };
    let mut price_years: Vec<i32> = recent.iter().map(|r| r.year).collect();
    price_years.sort();
    Some(CropCalibration {
        crop,
        first_year: first,
        last_year: last,
        years: rows.len(),
        trend_yield_kg_ha: trend(last).round(),
        trend_gain_kg_ha_yr: b.round(),
        price_brl_kg: (price * 100.0).round() / 100.0,
        price_years,
        seco: scen(&a.seco),
        tipico: scen(&a.tipico),
        chuvoso: scen(&a.chuvoso),
    })
}

// ---------------------------------------------------------------- outputs

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YearOutcome {
    pub year: i32,
    /// Crop key: built-in id ("soja", …) or a farmer-defined id ("custom-1").
    pub crop: String,
    pub crop_name: String,
    pub season_rain_mm: f64,
    /// 0–100 indices used by the bars. `None` = not available (custom crops have no price or yield).
    pub return_idx: Option<f64>,
    pub water_demand_idx: f64,
    /// Water balance: 50 when effective rain equals crop ETc, 100 with ≥50 % surplus, 0 with ≥50 % deficit.
    pub water_balance_idx: f64,
    pub soil_idx: f64,
    pub risk_idx: f64,
    /// Physical values behind the indices.
    pub revenue_brl_ha: Option<f64>,
    pub yield_kg_ha: Option<f64>,
    pub etc_mm: f64,
    pub eff_rain_mm: f64,
    pub deficit_mm: f64,
    pub soil_loss_t_ha: f64,
    pub loss_seasons: usize,
    pub analog_seasons: usize,
    pub harvest: bool,
    /// Parameters estimated from the farmer's description.
    pub estimated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    /// `None` when any season of the rotation has no revenue estimate.
    pub return_idx: Option<f64>,
    pub water_saving_idx: f64,
    pub soil_idx: f64,
    pub resilience_idx: f64,
    pub revenue_brl_ha: Option<f64>,
    pub soil_loss_t_ha: f64,
    pub deficit_mm: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioResult {
    pub years: Vec<YearOutcome>,
    pub summary: Summary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScenarioSet {
    pub seco: ScenarioResult,
    pub tipico: ScenarioResult,
    pub chuvoso: ScenarioResult,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Strategy {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub sequence: Vec<String>,
    pub tagline: String,
    /// Contains at least one farmer-defined crop.
    pub estimated: bool,
    pub scenarios: ScenarioSet,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoilCalibration {
    pub k_factor: f64,
    pub ls_factor: f64,
    pub slope_pct: f64,
    pub r_factor_tipico: f64,
    pub slope_length_m: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Calibration {
    pub yield_source: String,
    pub yield_level: String,
    pub yield_place: String,
    pub crops: Vec<CropCalibration>,
    pub soil: SoilCalibration,
    /// Reference evapotranspiration Nov–Mar (mm).
    pub et0_season_mm: f64,
    pub loss_threshold: f64,
}

/// The strategy aligned with each objective chosen on the "Objetivos" screen.
/// The model does not pick a winner: it measures the trade-offs of every option.
pub fn aligned_strategy(o: Objective) -> &'static str {
    match o {
        Objective::Lucro => "retorno",
        Objective::Solo => "sustentavel",
        Objective::Seguranca => "resiliencia",
        Objective::Equilibrio => "equilibrada",
    }
}

pub struct SimInput<'a> {
    pub climate: &'a Climate,
    pub analogs: &'a AnalogYears,
    pub soil: &'a Soil,
    pub terrain: &'a Terrain,
    pub pam: &'a Pam,
    pub rain: &'a RainSeries,
    pub lat: f64,
    pub objective: Objective,
    /// The farmer's declared rotation, repeated over the plan years.
    pub current: Vec<CropSpec>,
    /// The rotation the farmer built ("Minha rotação"), if any.
    pub mine: Option<Vec<CropSpec>>,
    pub customs: Vec<CustomParams>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimOutput {
    pub baseline: Strategy,
    pub strategies: Vec<Strategy>,
    pub recommended: &'static str,
    pub calibration: Calibration,
    /// Derived parameters of the farmer-defined crops, with sources.
    pub custom_params: Vec<CustomParams>,
}

struct Ctx<'a> {
    rain: &'a RainSeries,
    analogs: &'a AnalogYears,
    et0: [f64; 12],
    k: f64,
    ls: f64,
    soja: Option<&'a CropCalibration>,
    milho: Option<&'a CropCalibration>,
    revenue_ref: f64,
}

#[derive(Clone, Copy)]
enum Scen {
    Seco,
    Tipico,
    Chuvoso,
}

fn r0(x: f64) -> f64 {
    x.round()
}

/// FAO-33 yield response over the real analog seasons: share of seasons in which the relative
/// yield 1 − Ky·(1 − ETa/ETc) falls below `LOSS_THRESHOLD`. ETa = min(ETc, effective rain) month by
/// month, with no soil-water carry-over (conservative).
fn ky_risk(crop: &CropSpec, ky: f64, scen: Scen, ctx: &Ctx) -> (usize, usize) {
    let years = match scen {
        Scen::Seco => &ctx.analogs.seco,
        Scen::Tipico => &ctx.analogs.tipico,
        Scen::Chuvoso => &ctx.analogs.chuvoso,
    };
    let (mut loss, mut n) = (0, 0);
    for &y in years {
        let Some(months) = season_months(ctx.rain, y) else { continue };
        let (mut etc, mut eta) = (0.0, 0.0);
        for m in 0..12 {
            let need = crop.kc[m] * ctx.et0[m] * DAYS_IN_MONTH[m];
            etc += need;
            eta += need.min(effective_rain(months[m]) * crop.cover[m]);
        }
        if etc <= 0.0 {
            continue;
        }
        n += 1;
        if 1.0 - ky * (1.0 - eta / etc) < LOSS_THRESHOLD {
            loss += 1;
        }
    }
    (loss, n)
}

fn run(seq: &[CropSpec], scen: Scen, profile: &ScenarioProfile, ctx: &Ctx) -> ScenarioResult {
    let r_factor = erosivity(&profile.months);
    let mut prev: Option<&CropSpec> = None;
    let mut years = Vec::new();
    for (i, crop) in seq.iter().enumerate() {
        // Water balance over the crop months.
        let (mut etc, mut pe) = (0.0, 0.0);
        for m in 0..12 {
            etc += crop.kc[m] * ctx.et0[m] * DAYS_IN_MONTH[m];
            pe += effective_rain(profile.months[m]) * crop.cover[m];
        }
        let deficit = (etc - pe).max(0.0);
        // Revenue and risk: municipal yield history for soybean and maize; FAO-33 Ky for custom crops.
        let cal = match crop.builtin {
            Some(CropId::Soja) => ctx.soja,
            Some(CropId::Milho) => ctx.milho,
            _ => None,
        };
        let (yield_kg, revenue, loss, n) = match (cal, crop.estimated) {
            (Some(c), _) => {
                let s = match scen {
                    Scen::Seco => &c.seco,
                    Scen::Tipico => &c.tipico,
                    Scen::Chuvoso => &c.chuvoso,
                };
                let y = c.trend_yield_kg_ha * s.ratio;
                (Some(y), Some(y * c.price_brl_kg), s.loss_seasons, s.seasons)
            }
            (None, true) => {
                let (loss, n) = match (crop.harvest, crop.ky) {
                    (true, Some(ky)) => ky_risk(crop, ky, scen, ctx),
                    _ => (0, 0),
                };
                (None, None, loss, n)
            }
            (None, false) => (Some(0.0), Some(0.0), 0, 0),
        };
        let risk = if n > 0 { 100.0 * loss as f64 / n as f64 } else { 0.0 };
        // Soil loss (RUSLE) with residue carry-over from a previous straw-leaving crop.
        let c_eff = if prev.is_some_and(|p| p.leaves_straw) && !crop.leaves_straw {
            crop.c_factor * COVER_RESIDUE_C_MULT
        } else {
            crop.c_factor
        };
        let loss_t = r_factor * ctx.k * ctx.ls * c_eff;
        years.push(YearOutcome {
            year: PLAN_YEARS[i],
            crop: crop.key.clone(),
            crop_name: crop.name.clone(),
            season_rain_mm: profile.oct_mar_mm,
            return_idx: revenue.map(|r| r0((100.0 * r / ctx.revenue_ref).clamp(0.0, 100.0))),
            water_demand_idx: r0((100.0 * etc / pe.max(1.0)).clamp(0.0, 100.0)),
            water_balance_idx: if etc > 0.0 { r0((50.0 + 100.0 * (pe - etc) / etc).clamp(0.0, 100.0)) } else { 100.0 },
            soil_idx: r0((100.0 * (1.0 - c_eff)).max(0.0)),
            risk_idx: r0(risk),
            revenue_brl_ha: revenue.map(|r| (r / 10.0).round() * 10.0),
            yield_kg_ha: yield_kg.map(r0),
            etc_mm: r0(etc),
            eff_rain_mm: r0(pe),
            deficit_mm: r0(deficit),
            soil_loss_t_ha: (loss_t * 100.0).round() / 100.0,
            loss_seasons: loss,
            analog_seasons: n,
            harvest: crop.harvest,
            estimated: crop.estimated,
        });
        prev = Some(crop);
    }
    let n = years.len() as f64;
    let avg = |f: fn(&YearOutcome) -> f64| years.iter().map(f).sum::<f64>() / n;
    let avg_opt = |f: fn(&YearOutcome) -> Option<f64>| -> Option<f64> {
        let v: Option<Vec<f64>> = years.iter().map(f).collect();
        v.map(|v| v.iter().sum::<f64>() / n)
    };
    let summary = Summary {
        return_idx: avg_opt(|y| y.return_idx).map(r0),
        water_saving_idx: r0(avg(|y| y.water_balance_idx)),
        soil_idx: r0(avg(|y| y.soil_idx)),
        resilience_idx: r0(100.0 - avg(|y| y.risk_idx)),
        revenue_brl_ha: avg_opt(|y| y.revenue_brl_ha).map(|r| (r / 10.0).round() * 10.0),
        soil_loss_t_ha: (avg(|y| y.soil_loss_t_ha) * 100.0).round() / 100.0,
        deficit_mm: r0(avg(|y| y.deficit_mm)),
    };
    ScenarioResult { years, summary }
}

pub fn simulate(inp: SimInput) -> SimOutput {
    let a = inp.analogs;
    let soja = calibrate(CropId::Soja, &inp.pam.soja, a);
    let milho = calibrate(CropId::Milho, &inp.pam.milho, a);
    let typical_rev =
        |c: &Option<CropCalibration>| c.as_ref().map(|c| c.trend_yield_kg_ha * c.tipico.ratio * c.price_brl_kg).unwrap_or(0.0);
    let revenue_ref = typical_rev(&soja).max(typical_rev(&milho)).max(1.0);

    let top = inp.soil.topsoil();
    let oc_pct = inp.soil.soc_g_kg.unwrap_or(10.0) / 10.0;
    let k = erodibility(top.sand_pct, top.silt_pct, top.clay_pct, oc_pct);
    let ls = ls_factor(inp.terrain.slope_pct, SLOPE_LENGTH_M);
    let et0 = et0_mm_day(inp.climate, inp.lat);
    let et0_season: f64 = [10usize, 11, 0, 1, 2].iter().map(|&m| et0[m] * DAYS_IN_MONTH[m]).sum();

    let ctx = Ctx { rain: inp.rain, analogs: a, et0, k, ls, soja: soja.as_ref(), milho: milho.as_ref(), revenue_ref };

    let make = |id: &str, name: &str, icon: &str, tagline: &str, seq: Vec<CropSpec>| {
        let scenarios = ScenarioSet {
            seco: run(&seq, Scen::Seco, &a.profile_seco, &ctx),
            tipico: run(&seq, Scen::Tipico, &a.profile_tipico, &ctx),
            chuvoso: run(&seq, Scen::Chuvoso, &a.profile_chuvoso, &ctx),
        };
        Strategy {
            id: id.into(),
            name: name.into(),
            icon: icon.into(),
            sequence: seq.iter().map(|c| c.key.clone()).collect(),
            tagline: tagline.into(),
            estimated: seq.iter().any(|c| c.estimated),
            scenarios,
        }
    };
    let b = |c: CropId| crops::spec(c);
    use CropId::*;

    let baseline = make("atual", "Rotação atual", "history", "A rotação que você informou, repetida.", inp.current);
    let mut strategies = vec![
        make("retorno", "Maior retorno", "trending-up", "Mais receita, solo mais exposto.", vec![b(Soja), b(Milho), b(Milho)]),
        make("equilibrada", "Equilibrada", "scale", "Duas safras comerciais e uma de proteção do solo.", vec![b(Soja), b(Milho), b(Cobertura)]),
        make("resiliencia", "Maior resiliência", "shield-check", "Palhada antes do milho: menos erosão.", vec![b(Soja), b(Cobertura), b(Milho)]),
        make("sustentavel", "Mais sustentável", "sprout", "Prioriza a proteção do solo.", vec![b(Cobertura), b(Soja), b(Cobertura)]),
    ];
    if let Some(mine) = inp.mine {
        strategies.push(make("minha", "Minha rotação", "user-round", "A rotação que você montou.", mine));
    }

    let calibration = Calibration {
        yield_source: inp.pam.source.clone(),
        yield_level: inp.pam.level.clone(),
        yield_place: inp.pam.place.clone(),
        crops: [soja.clone(), milho.clone()].into_iter().flatten().collect(),
        soil: SoilCalibration {
            k_factor: (k * 10000.0).round() / 10000.0,
            ls_factor: (ls * 1000.0).round() / 1000.0,
            slope_pct: inp.terrain.slope_pct,
            r_factor_tipico: erosivity(&a.profile_tipico.months).round(),
            slope_length_m: SLOPE_LENGTH_M,
        },
        et0_season_mm: et0_season.round(),
        loss_threshold: LOSS_THRESHOLD,
    };
    SimOutput { baseline, strategies, recommended: aligned_strategy(inp.objective), calibration, custom_params: inp.customs }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sources::{MonthClimate, RainSeries, SoilLayer, YearRain, MONTH_LABELS};

    fn climate() -> Climate {
        let pr = [205.0, 165.0, 160.0, 75.0, 12.0, 2.0, 1.0, 3.0, 20.0, 85.0, 175.0, 210.0];
        Climate {
            live: false,
            source: String::new(),
            period: String::new(),
            months: (0..12)
                .map(|i| MonthClimate {
                    month: MONTH_LABELS[i].to_string(),
                    precip_mm: pr[i],
                    temp_c: 24.5,
                    rh_pct: 70.0,
                    wind_ms: 1.9,
                    radiation_mj: 21.0,
                })
                .collect(),
            annual_precip_mm: pr.iter().sum(),
            mean_temp_c: 24.5,
            elevation_m: 780.0,
        }
    }

    /// 25 calendar years; February rain varies so seasons differ in their driest month.
    fn rain() -> RainSeries {
        let base = [205.0, 165.0, 160.0, 75.0, 12.0, 2.0, 1.0, 3.0, 20.0, 85.0, 175.0, 210.0];
        RainSeries {
            live: false,
            source: String::new(),
            years: (2000..=2024)
                .map(|y| {
                    let mut m = base;
                    m[1] = 20.0 + 10.0 * (y % 8) as f64;
                    YearRain { year: y, total_mm: m.iter().sum(), months: m.to_vec() }
                })
                .collect(),
        }
    }

    fn soil() -> Soil {
        Soil {
            live: false,
            source: String::new(),
            layers: vec![SoilLayer { depth: "0–5 cm".into(), clay_pct: 30.0, sand_pct: 49.0, silt_pct: 21.0 }],
            soc_g_kg: Some(22.9),
            texture_class: "Franco-arenoso".into(),
        }
    }

    fn pam() -> Pam {
        // Yields grow 50 kg/ha/yr; seasons with a dry February lose 25 %.
        let r = rain();
        let rows = |base: f64| -> Vec<PamYear> {
            (2001..=2024)
                .map(|y| {
                    let feb = r.month(y, 1).unwrap();
                    let f = if feb < 40.0 { 0.75 } else { 1.0 };
                    PamYear {
                        year: y,
                        yield_kg_ha: (base + 50.0 * (y - 2001) as f64) * f,
                        area_ha: 1000.0,
                        value_thousand_brl: (base + 50.0 * (y - 2001) as f64) * f * 2.0,
                    }
                })
                .collect()
        };
        Pam { live: false, source: String::new(), level: "município".into(), place: "Teste".into(), soja: rows(3000.0), milho: rows(6000.0) }
    }

    #[test]
    fn penman_monteith_is_in_a_plausible_range() {
        let et0 = et0_mm_day(&climate(), -12.1);
        for v in et0 {
            assert!((3.0..7.0).contains(&v), "{et0:?}");
        }
    }

    #[test]
    fn rusle_factors_are_plausible() {
        let k = erodibility(49.0, 21.0, 30.0, 2.29);
        assert!((0.008..0.03).contains(&k), "K = {k}");
        assert!(ls_factor(0.3, 100.0) < ls_factor(5.0, 100.0));
        let r = erosivity(&climate().months.iter().map(|m| m.precip_mm).collect::<Vec<_>>());
        assert!((3000.0..12000.0).contains(&r), "R = {r}");
    }

    #[test]
    fn analog_years_use_the_driest_month() {
        let a = analog_years(&rain());
        assert_eq!(a.seco.len() + a.tipico.len() + a.chuvoso.len(), 24);
        assert!(a.profile_seco.driest_month_mm < a.profile_tipico.driest_month_mm);
        assert!(a.profile_tipico.driest_month_mm < a.profile_chuvoso.driest_month_mm);
    }

    fn soy3() -> Vec<CropSpec> {
        vec![crops::spec(CropId::Soja), crops::spec(CropId::Soja), crops::spec(CropId::Soja)]
    }

    #[allow(clippy::too_many_arguments)]
    fn input<'a>(
        c: &'a Climate, a: &'a AnalogYears, s: &'a Soil, t: &'a Terrain, p: &'a Pam, r: &'a RainSeries,
        current: Vec<CropSpec>, mine: Option<Vec<CropSpec>>, customs: Vec<CustomParams>,
    ) -> SimInput<'a> {
        SimInput { climate: c, analogs: a, soil: s, terrain: t, pam: p, rain: r, lat: -12.1, objective: Objective::Equilibrio, current, mine, customs }
    }

    fn terrain() -> Terrain {
        Terrain { live: false, source: String::new(), elevation_m: 780.0, slope_pct: 2.0, samples: 5 }
    }

    fn cowpea(id: &str) -> crops::CustomCropReq {
        crops::CustomCropReq {
            id: id.into(), name: format!("Caupi {id}"), kind: crops::CropType::Legume, cycle_months: 3, planting_month: 11, water: None, straw: None,
        }
    }

    #[test]
    fn baseline_comes_from_the_declared_rotation() {
        let (c, r, s, p, t) = (climate(), rain(), soil(), pam(), terrain());
        let a = analog_years(&r);
        let keys: Vec<String> = ["soja", "milho", "pousio"].iter().map(|k| k.to_string()).collect();
        let res = crops::resolve(&keys, None, &[]).unwrap();
        let out = simulate(input(&c, &a, &s, &t, &p, &r, res.current, None, vec![]));
        assert_eq!(out.baseline.sequence, keys);
        let y = &out.baseline.scenarios.tipico.years;
        assert_eq!(y[2].crop, "pousio");
        assert!(!y[2].harvest && y[2].etc_mm == 0.0);
        // Bare fallow loses far more soil than a crop.
        assert!(y[2].soil_loss_t_ha > 3.0 * y[0].soil_loss_t_ha);
        assert!(out.strategies.iter().all(|x| x.id != "minha"));
    }

    #[test]
    fn custom_crops_have_no_revenue_and_are_marked_estimated() {
        let (c, r, s, p, t) = (climate(), rain(), soil(), pam(), terrain());
        let a = analog_years(&r);
        let mine: Vec<String> = ["custom-1", "milho", "custom-2"].iter().map(|k| k.to_string()).collect();
        let res = crops::resolve(&["soja".into(), "soja".into(), "soja".into()], Some(&mine), &[cowpea("custom-1"), cowpea("custom-2")]).unwrap();
        let out = simulate(input(&c, &a, &s, &t, &p, &r, res.current, res.mine, res.customs));
        let m = out.strategies.iter().find(|x| x.id == "minha").unwrap();
        assert!(m.estimated && !out.baseline.estimated);
        for sc in [&m.scenarios.seco, &m.scenarios.tipico, &m.scenarios.chuvoso] {
            assert!(sc.summary.revenue_brl_ha.is_none() && sc.summary.return_idx.is_none());
            assert!(sc.years[0].estimated && sc.years[0].revenue_brl_ha.is_none() && sc.years[0].yield_kg_ha.is_none());
            assert!(sc.years[1].revenue_brl_ha.is_some() && !sc.years[1].estimated);
            // Same answers → same results (expected; the UI must not rank them).
            assert_eq!(sc.years[0].etc_mm, sc.years[2].etc_mm);
            assert_eq!(sc.years[0].analog_seasons, sc.years[2].analog_seasons);
        }
        assert_eq!(out.custom_params.len(), 2);
    }

    #[test]
    fn ky_risk_is_higher_in_dry_seasons() {
        // Cowpea sown in January: its cycle covers February, the month that drives the scenarios.
        let (c, r, s, p, t) = (climate(), rain(), soil(), pam(), terrain());
        let a = analog_years(&r);
        let mut req = cowpea("custom-1");
        req.planting_month = 1;
        req.water = Some(crops::Water::Muita);
        let res = crops::resolve(&["custom-1".into(), "soja".into(), "soja".into()], None, &[req]).unwrap();
        let out = simulate(input(&c, &a, &s, &t, &p, &r, res.current, None, res.customs));
        let dry = &out.baseline.scenarios.seco.years[0];
        let wet = &out.baseline.scenarios.chuvoso.years[0];
        assert!(dry.analog_seasons > 0);
        assert!(dry.risk_idx >= wet.risk_idx, "dry {} wet {}", dry.risk_idx, wet.risk_idx);
        assert!(dry.deficit_mm >= wet.deficit_mm);
    }

    #[test]
    fn dry_seasons_reduce_revenue_and_raise_risk() {
        let (c, r, s, p) = (climate(), rain(), soil(), pam());
        let a = analog_years(&r);
        let t = terrain();
        let out = simulate(input(&c, &a, &s, &t, &p, &r, soy3(), None, vec![]));
        let soja = out.calibration.crops.iter().find(|c| c.crop == CropId::Soja).unwrap();
        assert!(soja.seco.ratio < soja.chuvoso.ratio, "{soja:?}");
        assert!((soja.price_brl_kg - 2.0).abs() < 0.01);
        let base = &out.baseline.scenarios;
        assert!(base.seco.summary.revenue_brl_ha.unwrap() < base.chuvoso.summary.revenue_brl_ha.unwrap());
        assert!(base.seco.summary.resilience_idx < base.chuvoso.summary.resilience_idx);
        // Cover crops protect the soil and need less water.
        let sus = out.strategies.iter().find(|x| x.id == "sustentavel").unwrap();
        assert!(sus.scenarios.tipico.summary.soil_loss_t_ha < base.tipico.summary.soil_loss_t_ha);
        assert!(sus.scenarios.tipico.summary.water_saving_idx > base.tipico.summary.water_saving_idx);
        assert_eq!(out.recommended, "equilibrada");
    }
}
