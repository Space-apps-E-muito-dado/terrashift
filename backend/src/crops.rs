//! Crops the simulator can place in a rotation: the built-in catalog, fallow, and farmer-defined
//! ("custom") crops described in plain words.
//!
//! A custom crop is turned into model parameters from its type and a few answers. Every number in
//! `TYPES` is taken from a published FAO table (cited per row); nothing is invented per species.
//!
//! - Kc: FAO Irrigation and Drainage Paper 56 (Allen et al., 1998), Chapter 6, Table 12.
//! - Stage lengths: FAO-56, Chapter 6, Table 11.
//! - Ky (seasonal): FAO Irrigation and Drainage Paper 66 (Steduto et al., 2012), Table 1, p. 6,
//!   which reproduces FAO Paper 33 (Doorenbos & Kassam, 1979).
//! - C factor (RUSLE): the same reference no-till values used for the built-in crops
//!   (soybean 0.20, maize 0.12, cover 0.04); bare fallow C = 1 by definition of the RUSLE unit plot
//!   (Wischmeier & Smith, 1978).

use serde::{Deserialize, Serialize};

use crate::sources::DAYS_IN_MONTH;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CropId {
    Soja,
    Milho,
    Cobertura,
    /// Field left idle for the season ("Deixei parada").
    Pousio,
}

impl CropId {
    pub fn key(self) -> &'static str {
        match self {
            CropId::Soja => "soja",
            CropId::Milho => "milho",
            CropId::Cobertura => "cobertura",
            CropId::Pousio => "pousio",
        }
    }
    fn from_key(k: &str) -> Option<Self> {
        Some(match k {
            "soja" => CropId::Soja,
            "milho" => CropId::Milho,
            "cobertura" => CropId::Cobertura,
            "pousio" => CropId::Pousio,
            _ => return None,
        })
    }
}

/// Everything the simulator needs to know about one crop in one season.
#[derive(Debug, Clone)]
pub struct CropSpec {
    pub key: String,
    pub name: String,
    pub builtin: Option<CropId>,
    /// Mean crop coefficient per calendar month (Jan..Dec); 0 outside the cycle.
    pub kc: [f64; 12],
    /// Fraction of each calendar month inside the crop cycle (scales the rain that counts).
    pub cover: [f64; 12],
    /// RUSLE cover-management factor.
    pub c_factor: f64,
    /// Leaves enough straw to protect the next crop (cover crop, or "a lot of straw").
    pub leaves_straw: bool,
    /// A cash crop is harvested (revenue and failure risk apply).
    pub harvest: bool,
    /// FAO-33 seasonal yield response factor, custom crops only.
    pub ky: Option<f64>,
    /// Parameters estimated from the farmer's description.
    pub estimated: bool,
}

// ---------------------------------------------------------------- built-in crops

/// Reference no-till C factors (typical Brazilian literature values; see README).
pub const C_SOY: f64 = 0.20;
pub const C_MAIZE: f64 = 0.12;
pub const C_COVER: f64 = 0.04;
/// RUSLE unit plot: continuous clean-tilled fallow has C = 1 (Wischmeier & Smith, 1978).
pub const C_BARE: f64 = 1.0;

fn builtin(c: CropId) -> CropSpec {
    // Kc per calendar month (Jan..Dec), FAO-56 Table 12 stages for a November sowing.
    let (name, kc, c_factor) = match c {
        // ~120 days, Nov → Feb
        CropId::Soja => ("Soja", [1.15, 0.75, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.9], C_SOY),
        // ~140 days, Nov → Mar
        CropId::Milho => ("Milho", [1.2, 1.1, 0.6, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4, 0.8], C_MAIZE),
        // Millet / brachiaria cover, ~110 days, Nov → Feb
        CropId::Cobertura => ("Cobertura vegetal", [1.0, 0.6, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4, 0.8], C_COVER),
        CropId::Pousio => ("Pousio", [0.0; 12], C_BARE),
    };
    let mut cover = [0.0; 12];
    for m in 0..12 {
        if kc[m] > 0.0 {
            cover[m] = 1.0;
        }
    }
    CropSpec {
        key: c.key().into(),
        name: name.into(),
        builtin: Some(c),
        kc,
        cover,
        c_factor,
        leaves_straw: c == CropId::Cobertura,
        harvest: matches!(c, CropId::Soja | CropId::Milho),
        ky: None,
        estimated: false,
    }
}

// ---------------------------------------------------------------- crop types (custom crops)

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CropType {
    Cereal,
    Legume,
    Oilseed,
    Root,
    Forage,
    Cover,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Water {
    Pouca,
    Media,
    Muita,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Straw {
    Pouca,
    Muita,
}

pub struct TypeRow {
    pub kc_ini: f64,
    pub kc_mid: (f64, f64),
    pub kc_end: f64,
    /// Initial, development, mid-season and late fractions of the cycle.
    pub stages: [f64; 4],
    pub ky: Option<f64>,
    pub default_water: Water,
    pub default_straw: Straw,
    pub source: &'static str,
}

const fn fr(a: f64, b: f64, c: f64, d: f64) -> [f64; 4] {
    let t = a + b + c + d;
    [a / t, b / t, c / t, d / t]
}

/// One row per crop type. Kc_mid range = lowest and highest Kc mid of the listed crops.
/// Ky = mean of the listed crops' seasonal Ky. Default answers are the builder's judgement
/// (medium water = centre of the range; straw by typical residue) and can be changed in the form.
pub fn type_row(t: CropType) -> TypeRow {
    match t {
        CropType::Cereal => TypeRow {
            kc_ini: 0.3,
            kc_mid: (1.00, 1.20),
            kc_end: 0.4,
            stages: fr(30.0, 50.0, 60.0, 40.0),
            ky: Some((1.25 + 0.9 + 1.15 + 1.05) / 4.0),
            default_water: Water::Media,
            default_straw: Straw::Muita,
            source: "FAO-56 Tab. 12 (cereals group: Kc ini 0.3, Kc end 0.4; Kc mid millet 1.00 – maize 1.20), Tab. 11 (maize 30/50/60/40 d); FAO-66 Tab. 1 p. 6 (Ky maize 1.25, sorghum 0.9, spring wheat 1.15, winter wheat 1.05)",
        },
        CropType::Legume => TypeRow {
            kc_ini: 0.4,
            kc_mid: (1.05, 1.15),
            kc_end: 0.55,
            stages: fr(20.0, 30.0, 40.0, 20.0),
            ky: Some((1.15 + 0.70 + 0.85) / 3.0),
            default_water: Water::Media,
            default_straw: Straw::Pouca,
            source: "FAO-56 Tab. 12 (legumes group: Kc ini 0.4, Kc end 0.55; Kc mid cowpea 1.05 – dry beans, groundnut, soybean 1.15), Tab. 11 (dry beans 20/30/40/20 d); FAO-66 Tab. 1 p. 6 (Ky beans 1.15, groundnuts 0.70, soybean 0.85)",
        },
        CropType::Oilseed => TypeRow {
            kc_ini: 0.35,
            kc_mid: (1.00, 1.15),
            kc_end: 0.35,
            stages: fr(25.0, 35.0, 45.0, 25.0),
            ky: Some((0.95 + 0.8) / 2.0),
            default_water: Water::Media,
            default_straw: Straw::Pouca,
            source: "FAO-56 Tab. 12 (oil crops group: Kc ini 0.35, Kc end 0.35; Kc mid sunflower 1.0–1.15, sesame 1.10), Tab. 11 (sunflower 25/35/45/25 d); FAO-66 Tab. 1 p. 6 (Ky sunflower 0.95, safflower 0.8)",
        },
        CropType::Root => TypeRow {
            kc_ini: 0.5,
            kc_mid: (0.80, 1.15),
            kc_end: 0.95,
            stages: fr(15.0, 30.0, 50.0, 30.0),
            ky: Some(1.1),
            default_water: Water::Media,
            default_straw: Straw::Pouca,
            source: "FAO-56 Tab. 12 (roots and tubers group: Kc ini 0.5, Kc end 0.95; Kc mid cassava yr 1 0.80 – potato, sweet potato 1.15), Tab. 11 (sweet potato, tropics 15/30/50/30 d); FAO-66 Tab. 1 p. 6 (Ky potato 1.1; cassava not listed)",
        },
        CropType::Forage => TypeRow {
            kc_ini: 0.40,
            kc_mid: (0.85, 1.05),
            kc_end: 0.85,
            stages: fr(25.0, 25.0, 15.0, 10.0),
            ky: Some(1.1),
            default_water: Water::Media,
            default_straw: Straw::Muita,
            source: "FAO-56 Tab. 12 (grazing pasture, rotated: Kc ini 0.40, Kc mid 0.85–1.05, Kc end 0.85), Tab. 11 (Sudan grass 25/25/15/10 d); FAO-66 Tab. 1 p. 6 (Ky alfalfa 1.1)",
        },
        CropType::Cover => TypeRow {
            kc_ini: 0.3,
            kc_mid: (1.00, 1.10),
            kc_end: 0.30,
            stages: fr(15.0, 25.0, 40.0, 25.0),
            ky: None,
            default_water: Water::Media,
            default_straw: Straw::Muita,
            source: "FAO-56 Tab. 12 (cereals group Kc ini 0.3; millet Kc mid 1.00, Kc end 0.30; sorghum grain Kc mid 1.00–1.10), Tab. 11 (millet 15/25/40/25 d). Not harvested: no Ky",
        },
    }
}

/// Request entry for a farmer-defined crop.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomCropReq {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: CropType,
    pub cycle_months: u32,
    pub planting_month: u32,
    pub water: Option<Water>,
    pub straw: Option<Straw>,
}

/// Derived parameters, returned so the UI can show where each number came from.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomParams {
    pub key: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: CropType,
    pub cycle_days: u32,
    pub planting_month: u32,
    pub water: Water,
    pub straw: Straw,
    pub kc_mid: f64,
    pub ky: Option<f64>,
    pub c_factor: f64,
    pub source: String,
}

pub const MAX_NAME: usize = 40;
pub const CYCLE_MONTHS: std::ops::RangeInclusive<u32> = 2..=6;

/// FAO-56 four-stage Kc curve on day `d` of a cycle of `len` days.
fn kc_on_day(row: &TypeRow, kc_mid: f64, d: f64, len: f64) -> f64 {
    let [a, b, c, _] = row.stages;
    let (l1, l2, l3) = (a * len, (a + b) * len, (a + b + c) * len);
    if d < l1 {
        row.kc_ini
    } else if d < l2 {
        row.kc_ini + (kc_mid - row.kc_ini) * (d - l1) / (l2 - l1).max(1.0)
    } else if d < l3 {
        kc_mid
    } else {
        kc_mid + (row.kc_end - kc_mid) * (d - l3) / (len - l3).max(1.0)
    }
}

/// Monthly Kc and month coverage for a cycle starting on the 15th of `planting_month`.
/// A cycle that crosses December wraps around the calendar (same season frame as the built-in
/// November sowings).
pub fn monthly_kc(row: &TypeRow, kc_mid: f64, cycle_days: u32, planting_month: u32) -> ([f64; 12], [f64; 12]) {
    let mut month_of_day = Vec::with_capacity(365);
    for (m, d) in DAYS_IN_MONTH.iter().enumerate() {
        for _ in 0..d.round() as usize {
            month_of_day.push(m);
        }
    }
    let n = month_of_day.len();
    let start: usize = DAYS_IN_MONTH[..(planting_month as usize - 1)].iter().map(|d| d.round() as usize).sum::<usize>() + 14;
    let (mut sum, mut days) = ([0.0; 12], [0.0; 12]);
    for d in 0..cycle_days as usize {
        let m = month_of_day[(start + d) % n];
        sum[m] += kc_on_day(row, kc_mid, d as f64, cycle_days as f64);
        days[m] += 1.0;
    }
    let (mut kc, mut cover) = ([0.0; 12], [0.0; 12]);
    for m in 0..12 {
        let dim = DAYS_IN_MONTH[m].round();
        kc[m] = sum[m] / dim;
        cover[m] = days[m] / dim;
    }
    (kc, cover)
}

fn custom(req: &CustomCropReq) -> (CropSpec, CustomParams) {
    let row = type_row(req.kind);
    let water = req.water.unwrap_or(row.default_water);
    let straw = req.straw.unwrap_or(row.default_straw);
    // Three equal buckets over the type's Kc mid range; the bucket midpoint is used.
    let (lo, hi) = row.kc_mid;
    let step = (hi - lo) / 3.0;
    let bucket = match water {
        Water::Pouca => 0.0,
        Water::Media => 1.0,
        Water::Muita => 2.0,
    };
    let kc_mid = ((lo + step * (bucket + 0.5)) * 1000.0).round() / 1000.0;
    let cycle_days = req.cycle_months * 30;
    let (kc, cover) = monthly_kc(&row, kc_mid, cycle_days, req.planting_month);
    let is_cover = req.kind == CropType::Cover;
    let c_factor = if is_cover {
        C_COVER
    } else if straw == Straw::Muita {
        C_MAIZE
    } else {
        C_SOY
    };
    let spec = CropSpec {
        key: req.id.clone(),
        name: req.name.trim().to_string(),
        builtin: None,
        kc,
        cover,
        c_factor,
        leaves_straw: is_cover || straw == Straw::Muita,
        harvest: !is_cover,
        ky: row.ky,
        estimated: true,
    };
    let params = CustomParams {
        key: req.id.clone(),
        name: spec.name.clone(),
        kind: req.kind,
        cycle_days,
        planting_month: req.planting_month,
        water,
        straw,
        kc_mid,
        ky: row.ky.map(|k| (k * 100.0).round() / 100.0),
        c_factor,
        source: row.source.into(),
    };
    (spec, params)
}

fn fold(s: &str) -> String {
    s.trim()
        .to_lowercase()
        .chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'ä' => 'a',
            'é' | 'ê' | 'è' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ç' => 'c',
            c => c,
        })
        .collect()
}

pub struct Resolved {
    pub current: Vec<CropSpec>,
    pub mine: Option<Vec<CropSpec>>,
    pub customs: Vec<CustomParams>,
}

/// Validates the request and turns crop keys into specs. Errors are plain Portuguese messages.
pub fn resolve(current: &[String], mine: Option<&[String]>, customs: &[CustomCropReq]) -> Result<Resolved, String> {
    let builtin_names = ["soja", "milho", "cobertura", "cobertura vegetal", "pousio"];
    let mut table: Vec<(CropSpec, CustomParams)> = Vec::new();
    for c in customs {
        let name = c.name.trim();
        if c.id.trim().is_empty() || !c.id.starts_with("custom-") {
            return Err("Identificador de cultura inválido.".into());
        }
        if name.is_empty() {
            return Err("Escreva o nome da planta.".into());
        }
        if name.chars().count() > MAX_NAME {
            return Err("Use um nome mais curto.".into());
        }
        if !CYCLE_MONTHS.contains(&c.cycle_months) {
            return Err("Tempo até a colheita deve ser de 2 a 6 meses.".into());
        }
        if !(1..=12).contains(&c.planting_month) {
            return Err("Mês de plantio inválido.".into());
        }
        let folded = fold(name);
        if builtin_names.contains(&folded.as_str()) || table.iter().any(|(s, _)| fold(&s.name) == folded) {
            return Err("Você já tem uma planta com esse nome.".into());
        }
        if table.iter().any(|(s, _)| s.key == c.id) {
            return Err("Identificador de cultura repetido.".into());
        }
        table.push(custom(c));
    }
    let lookup = |k: &String| -> Result<CropSpec, String> {
        if let Some(b) = CropId::from_key(k) {
            return Ok(builtin(b));
        }
        table.iter().find(|(s, _)| &s.key == k).map(|(s, _)| s.clone()).ok_or_else(|| format!("Cultura desconhecida: {k}"))
    };
    let seq = |ks: &[String]| -> Result<Vec<CropSpec>, String> {
        if ks.len() != 3 {
            return Err("A rotação precisa ter exatamente 3 safras.".into());
        }
        ks.iter().map(lookup).collect()
    };
    let current = seq(current)?;
    let mine = mine.map(seq).transpose()?;
    Ok(Resolved { current, mine, customs: table.into_iter().map(|(_, p)| p).collect() })
}

pub fn spec(c: CropId) -> CropSpec {
    builtin(c)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req(kind: CropType, months: u32, month: u32) -> CustomCropReq {
        CustomCropReq { id: "custom-1".into(), name: "Feijão-caupi".into(), kind, cycle_months: months, planting_month: month, water: None, straw: None }
    }

    #[test]
    fn kc_curve_has_fao_shape_and_covers_the_cycle() {
        let row = type_row(CropType::Legume);
        let (kc, cover) = monthly_kc(&row, 1.1, 90, 2);
        // Planted 15 Feb, 90 days → Feb (part), Mar, Apr, May (part).
        assert!(cover[1] > 0.4 && cover[1] < 0.6, "{cover:?}");
        assert_eq!(cover[2], 1.0);
        assert_eq!(cover[3], 1.0);
        assert!(cover[4] > 0.4 && cover[4] < 0.6);
        assert_eq!(cover[6], 0.0);
        let days: f64 = (0..12).map(|m| cover[m] * DAYS_IN_MONTH[m].round()).sum();
        assert!((days - 90.0).abs() < 0.5);
        // Initial stage low, mid-season high.
        assert!(kc[1] / cover[1] < kc[3]);
        assert!(kc[3] <= 1.1 + 1e-9);
    }

    #[test]
    fn cycle_crossing_december_wraps() {
        let row = type_row(CropType::Cereal);
        let (_, cover) = monthly_kc(&row, 1.1, 150, 11);
        assert!(cover[10] > 0.0 && cover[11] == 1.0 && cover[0] == 1.0 && cover[3] > 0.0);
        assert_eq!(cover[6], 0.0);
    }

    #[test]
    fn water_answer_moves_kc_within_the_type_range() {
        let mut r = req(CropType::Cereal, 4, 11);
        r.water = Some(Water::Pouca);
        let lo = custom(&r).1.kc_mid;
        r.water = Some(Water::Muita);
        let hi = custom(&r).1.kc_mid;
        assert!(lo < hi && lo > 1.0 && hi < 1.2, "{lo} {hi}");
    }

    #[test]
    fn validation_rejects_bad_input() {
        let ok = vec!["soja".to_string(), "custom-1".into(), "milho".into()];
        assert!(resolve(&ok, None, &[req(CropType::Legume, 3, 2)]).is_ok());
        assert!(resolve(&ok, None, &[]).is_err(), "unknown key");
        assert!(resolve(&ok[..2], None, &[req(CropType::Legume, 3, 2)]).is_err(), "length");
        assert!(resolve(&ok, None, &[req(CropType::Legume, 7, 2)]).is_err(), "cycle");
        let mut dup = req(CropType::Legume, 3, 2);
        dup.name = "  SOJA ".into();
        assert!(resolve(&ok, None, &[dup]).is_err(), "duplicate of built-in");
        let mut empty = req(CropType::Legume, 3, 2);
        empty.name = "  ".into();
        assert!(resolve(&ok, None, &[empty]).is_err(), "empty name");
    }
}
