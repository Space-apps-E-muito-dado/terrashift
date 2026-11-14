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

use crate::sources::{Climate, Pam, PamYear, RainSeries, Soil, Terrain, DAYS_IN_MONTH};

pub const PLAN_YEARS: [i32; 3] = [2027, 2028, 2029];
/// A season counts as a crop failure when yield falls this much below its trend.
pub const LOSS_THRESHOLD: f64 = 0.85;
/// Assumed slope length for the LS factor (m).
pub const SLOPE_LENGTH_M: f64 = 100.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CropId {
    Soja,
    Milho,
    Cobertura,
}

struct CropParams {
    name: &'static str,
    /// Crop coefficient per calendar month (Jan..Dec), FAO-56 Table 12 stages for a November sowing.
    kc: [f64; 12],
    /// RUSLE cover-management factor under no-till (typical Brazilian literature values).
    c_factor: f64,
}

fn params(c: CropId) -> CropParams {
    match c {
        // ~120 days, Nov → Feb
        CropId::Soja => CropParams {
            name: "Soja",
            kc: [1.15, 0.75, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.9],
            c_factor: 0.20,
        },
        // ~140 days, Nov → Mar
        CropId::Milho => CropParams {
            name: "Milho",
            kc: [1.2, 1.1, 0.6, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4, 0.8],
            c_factor: 0.12,
        },
        // Millet / brachiaria cover, ~110 days, Nov → Feb
        CropId::Cobertura => CropParams {
            name: "Cobertura vegetal",
            kc: [1.0, 0.6, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4, 0.8],
            c_factor: 0.04,
        },
    }
}

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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecentCrop {
    Soja,
    Milho,
    Outra,
    Naosei,
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
    pub crop: CropId,
    pub crop_name: &'static str,
    pub season_rain_mm: f64,
    /// 0–100 indices used by the bars.
    pub return_idx: f64,
    pub water_demand_idx: f64,
    /// Water balance: 50 when effective rain equals crop ETc, 100 with ≥50 % surplus, 0 with ≥50 % deficit.
    pub water_balance_idx: f64,
    pub soil_idx: f64,
    pub risk_idx: f64,
    /// Physical values behind the indices.
    pub revenue_brl_ha: f64,
    pub yield_kg_ha: f64,
    pub etc_mm: f64,
    pub eff_rain_mm: f64,
    pub deficit_mm: f64,
    pub soil_loss_t_ha: f64,
    pub loss_seasons: usize,
    pub analog_seasons: usize,
    pub harvest: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub return_idx: f64,
    pub water_saving_idx: f64,
    pub soil_idx: f64,
    pub resilience_idx: f64,
    pub revenue_brl_ha: f64,
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
    pub id: &'static str,
    pub name: &'static str,
    pub icon: &'static str,
    pub sequence: Vec<CropId>,
    pub tagline: &'static str,
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
    pub lat: f64,
    pub objective: Objective,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimOutput {
    pub baseline: Strategy,
    pub strategies: Vec<Strategy>,
    pub recommended: &'static str,
    pub calibration: Calibration,
}

struct Ctx<'a> {
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

fn run(seq: &[CropId], scen: Scen, profile: &ScenarioProfile, ctx: &Ctx) -> ScenarioResult {
    let r_factor = erosivity(&profile.months);
    let mut prev: Option<CropId> = None;
    let mut years = Vec::new();
    for (i, &crop) in seq.iter().enumerate() {
        let p = params(crop);
        // Water balance over the crop months.
        let (mut etc, mut pe) = (0.0, 0.0);
        for m in 0..12 {
            if p.kc[m] > 0.0 {
                etc += p.kc[m] * ctx.et0[m] * DAYS_IN_MONTH[m];
                pe += effective_rain(profile.months[m]);
            }
        }
        let deficit = (etc - pe).max(0.0);
        // Revenue and risk from the municipal yield history.
        let cal = match crop {
            CropId::Soja => ctx.soja,
            CropId::Milho => ctx.milho,
            CropId::Cobertura => None,
        };
        let (yield_kg, revenue, loss, n) = match cal {
            Some(c) => {
                let s = match scen {
                    Scen::Seco => &c.seco,
                    Scen::Tipico => &c.tipico,
                    Scen::Chuvoso => &c.chuvoso,
                };
                let y = c.trend_yield_kg_ha * s.ratio;
                (y, y * c.price_brl_kg, s.loss_seasons, s.seasons)
            }
            None => (0.0, 0.0, 0, 0),
        };
        let risk = if n > 0 { 100.0 * loss as f64 / n as f64 } else { 0.0 };
        // Soil loss (RUSLE) with residue carry-over from a previous cover crop.
        let c_eff = if prev == Some(CropId::Cobertura) && crop != CropId::Cobertura {
            p.c_factor * COVER_RESIDUE_C_MULT
        } else {
            p.c_factor
        };
        let loss_t = r_factor * ctx.k * ctx.ls * c_eff;
        years.push(YearOutcome {
            year: PLAN_YEARS[i],
            crop,
            crop_name: p.name,
            season_rain_mm: profile.oct_mar_mm,
            return_idx: r0((100.0 * revenue / ctx.revenue_ref).clamp(0.0, 100.0)),
            water_demand_idx: r0((100.0 * etc / pe.max(1.0)).clamp(0.0, 100.0)),
            water_balance_idx: r0((50.0 + 100.0 * (pe - etc) / etc.max(1.0)).clamp(0.0, 100.0)),
            soil_idx: r0(100.0 * (1.0 - c_eff)),
            risk_idx: r0(risk),
            revenue_brl_ha: (revenue / 10.0).round() * 10.0,
            yield_kg_ha: r0(yield_kg),
            etc_mm: r0(etc),
            eff_rain_mm: r0(pe),
            deficit_mm: r0(deficit),
            soil_loss_t_ha: (loss_t * 100.0).round() / 100.0,
            loss_seasons: loss,
            analog_seasons: n,
            harvest: cal.is_some(),
        });
        prev = Some(crop);
    }
    let n = years.len() as f64;
    let avg = |f: fn(&YearOutcome) -> f64| years.iter().map(f).sum::<f64>() / n;
    let summary = Summary {
        return_idx: r0(avg(|y| y.return_idx)),
        water_saving_idx: r0(avg(|y| y.water_balance_idx)),
        soil_idx: r0(avg(|y| y.soil_idx)),
        resilience_idx: r0(100.0 - avg(|y| y.risk_idx)),
        revenue_brl_ha: (avg(|y| y.revenue_brl_ha) / 10.0).round() * 10.0,
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

    let ctx = Ctx { et0, k, ls, soja: soja.as_ref(), milho: milho.as_ref(), revenue_ref };

    use CropId::*;
    let make = |id, name, icon, tagline, seq: Vec<CropId>| {
        let scenarios = ScenarioSet {
            seco: run(&seq, Scen::Seco, &a.profile_seco, &ctx),
            tipico: run(&seq, Scen::Tipico, &a.profile_tipico, &ctx),
            chuvoso: run(&seq, Scen::Chuvoso, &a.profile_chuvoso, &ctx),
        };
        Strategy { id, name, icon, sequence: seq, tagline, scenarios }
    };

    let baseline = make("atual", "Rotação atual", "history", "Soja todos os anos.", vec![Soja, Soja, Soja]);
    let strategies = vec![
        make("retorno", "Maior retorno", "trending-up", "Mais receita, solo mais exposto.", vec![Soja, Milho, Milho]),
        make("equilibrada", "Equilibrada", "scale", "Duas safras comerciais e uma de proteção do solo.", vec![Soja, Milho, Cobertura]),
        make("resiliencia", "Maior resiliência", "shield-check", "Palhada antes do milho: menos erosão.", vec![Soja, Cobertura, Milho]),
        make("sustentavel", "Mais sustentável", "sprout", "Prioriza a proteção do solo.", vec![Cobertura, Soja, Cobertura]),
    ];

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
    SimOutput { baseline, strategies, recommended: aligned_strategy(inp.objective), calibration }
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

    #[test]
    fn dry_seasons_reduce_revenue_and_raise_risk() {
        let (c, r, s, p) = (climate(), rain(), soil(), pam());
        let a = analog_years(&r);
        let t = Terrain { live: false, source: String::new(), elevation_m: 780.0, slope_pct: 2.0, samples: 5 };
        let out = simulate(SimInput { climate: &c, analogs: &a, soil: &s, terrain: &t, pam: &p, lat: -12.1, objective: Objective::Equilibrio });
        let soja = out.calibration.crops.iter().find(|c| c.crop == CropId::Soja).unwrap();
        assert!(soja.seco.ratio < soja.chuvoso.ratio, "{soja:?}");
        assert!((soja.price_brl_kg - 2.0).abs() < 0.01);
        let base = &out.baseline.scenarios;
        assert!(base.seco.summary.revenue_brl_ha < base.chuvoso.summary.revenue_brl_ha);
        assert!(base.seco.summary.resilience_idx < base.chuvoso.summary.resilience_idx);
        // Cover crops protect the soil and need less water.
        let sus = out.strategies.iter().find(|x| x.id == "sustentavel").unwrap();
        assert!(sus.scenarios.tipico.summary.soil_loss_t_ha < base.tipico.summary.soil_loss_t_ha);
        assert!(sus.scenarios.tipico.summary.water_saving_idx > base.tipico.summary.water_saving_idx);
        assert_eq!(out.recommended, "equilibrada");
    }
}
