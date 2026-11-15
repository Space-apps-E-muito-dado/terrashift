//! Clients for the open data sources used by TerraShift.
//!
//! - NASA POWER: monthly climatology (temperature, humidity, wind, radiation, rain)
//!   and the monthly rain series used to build dry / typical / wet analog seasons.
//! - ISRIC SoilGrids (250 m): soil texture and organic carbon.
//! - OpenTopoData SRTM 30 m: elevation and slope of the field.
//! - OpenStreetMap Nominatim + IBGE Localidades: which municipality the field is in.
//! - IBGE SIDRA, PAM table 5457: yearly yield, harvested area and production value
//!   of soybean and maize for that municipality.
//!
//! Every fetch has an offline fallback so the demo keeps working without network;
//! responses carry a `live` flag so the UI can tell real-time data from fallback data.
//! Successful responses are cached in memory and on disk.

use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Duration};

use anyhow::{anyhow, Context, Result};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::Mutex;

use crate::{
    geo::{LatLng, Point},
    pam_fallback,
};

const MONTH_KEYS: [&str; 12] = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
pub const MONTH_LABELS: [&str; 12] = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
pub const DAYS_IN_MONTH: [f64; 12] = [31.0, 28.25, 31.0, 30.0, 31.0, 30.0, 31.0, 31.0, 30.0, 31.0, 30.0, 31.0];

/// Monthly rain series requested from NASA POWER (calendar years).
/// The first year only provides Oct–Dec for the first season.
pub const SERIES_START: i32 = 2000;
pub const SERIES_END: i32 = 2025;

// ---------------------------------------------------------------- types

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthClimate {
    pub month: String,
    pub precip_mm: f64,
    pub temp_c: f64,
    /// Relative humidity at 2 m (%).
    pub rh_pct: f64,
    /// Wind speed at 2 m (m/s), derived from POWER `WS10M` (FAO-56 eq. 47).
    pub wind_ms: f64,
    /// All-sky shortwave radiation (MJ/m²/day).
    pub radiation_mj: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Climate {
    pub live: bool,
    pub source: String,
    pub period: String,
    pub months: Vec<MonthClimate>,
    pub annual_precip_mm: f64,
    pub mean_temp_c: f64,
    pub elevation_m: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YearRain {
    pub year: i32,
    pub total_mm: f64,
    /// Jan..Dec, mm per month.
    pub months: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RainSeries {
    pub live: bool,
    pub source: String,
    pub years: Vec<YearRain>,
}

impl RainSeries {
    pub fn month(&self, year: i32, month0: usize) -> Option<f64> {
        self.years.iter().find(|y| y.year == year).and_then(|y| y.months.get(month0).copied())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoilLayer {
    pub depth: String,
    pub clay_pct: f64,
    pub sand_pct: f64,
    pub silt_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Soil {
    pub live: bool,
    pub source: String,
    pub layers: Vec<SoilLayer>,
    pub soc_g_kg: Option<f64>,
    pub texture_class: String,
}

impl Soil {
    pub fn topsoil(&self) -> &SoilLayer {
        &self.layers[0]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Terrain {
    pub live: bool,
    pub source: String,
    pub elevation_m: f64,
    pub slope_pct: f64,
    pub samples: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub live: bool,
    pub municipality: String,
    pub uf: String,
    pub ibge_code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PamYear {
    pub year: i32,
    pub yield_kg_ha: f64,
    pub area_ha: f64,
    pub value_thousand_brl: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pam {
    pub live: bool,
    pub source: String,
    /// "município" or "estado"
    pub level: String,
    pub place: String,
    pub soja: Vec<PamYear>,
    pub milho: Vec<PamYear>,
}

// ---------------------------------------------------------------- client

#[derive(Clone)]
pub struct DataClient {
    http: reqwest::Client,
    cache_dir: PathBuf,
    mem: Arc<Mutex<HashMap<String, Value>>>,
}

fn key(p: Point) -> String {
    // ~1 km grid: finer than the native resolution of the gridded sources.
    format!("{:.2},{:.2}", p.lat, p.lng)
}

impl DataClient {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(45))
            .user_agent("TerraShift/0.1 (hackathon prototype)")
            .build()
            .expect("http client");
        let cache_dir = PathBuf::from(std::env::var("CACHE_DIR").unwrap_or_else(|_| "cache".into()));
        Self { http, cache_dir, mem: Default::default() }
    }

    async fn get_json(&self, url: &str) -> Result<Value> {
        let res = self.http.get(url).send().await?.error_for_status()?;
        Ok(res.json::<Value>().await?)
    }

    /// Memory → disk → network, with a fallback that is never cached.
    async fn cached<T, F, Fut>(&self, kind: &str, k: &str, fetch: F, fallback: fn() -> T, is_live: fn(&T) -> bool) -> T
    where
        T: Serialize + DeserializeOwned + Clone,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<T>>,
    {
        let id = format!("{kind}-{k}");
        if let Some(v) = self.mem.lock().await.get(&id) {
            if let Ok(t) = serde_json::from_value::<T>(v.clone()) {
                return t;
            }
        }
        let path = self.cache_dir.join(format!("{id}.json"));
        if let Some(t) = std::fs::read_to_string(&path).ok().and_then(|s| serde_json::from_str::<T>(&s).ok()) {
            if let Ok(v) = serde_json::to_value(&t) {
                self.mem.lock().await.insert(id, v);
            }
            return t;
        }
        let t = match fetch().await {
            Ok(t) => t,
            Err(e) => {
                tracing::warn!("{kind} failed: {e:#}");
                fallback()
            }
        };
        if is_live(&t) {
            if let Ok(v) = serde_json::to_value(&t) {
                let _ = std::fs::create_dir_all(&self.cache_dir);
                let _ = std::fs::write(&path, v.to_string());
                self.mem.lock().await.insert(id, v);
            }
        }
        t
    }

    // ---------- NASA POWER: monthly climatology ----------

    pub async fn climate(&self, p: Point) -> Climate {
        self.cached("climate4", &key(p), || self.fetch_climate(p), fallback_climate, |c| c.live).await
    }

    async fn fetch_climate(&self, p: Point) -> Result<Climate> {
        let url = format!(
            "https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,PRECTOTCORR,RH2M,WS10M,ALLSKY_SFC_SW_DWN&community=AG&longitude={:.4}&latitude={:.4}&format=JSON",
            p.lng, p.lat
        );
        let v = self.get_json(&url).await?;
        let params = &v["properties"]["parameter"];
        let years: Vec<&str> = v["header"]["range"]
            .as_str()
            .unwrap_or_default()
            .split(|c: char| !c.is_ascii_digit())
            .filter(|t| t.len() == 4 && (t.starts_with("19") || t.starts_with("20")))
            .collect();
        let period = match (years.first(), years.last()) {
            (Some(a), Some(b)) => format!("climatologia {a}–{b}"),
            _ => "climatologia 2001–2025".into(),
        };
        let months = parse_months(params)?;
        let elevation = v["geometry"]["coordinates"][2].as_f64().unwrap_or(500.0);
        Ok(build_climate(true, period, months, elevation))
    }

    // ---------- NASA POWER: monthly rain series ----------

    pub async fn rain_series(&self, p: Point) -> RainSeries {
        self.cached("rain3", &key(p), || self.fetch_rain(p), fallback_rain, |r| r.live).await
    }

    async fn fetch_rain(&self, p: Point) -> Result<RainSeries> {
        let url = format!(
            "https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=PRECTOTCORR&community=AG&longitude={:.4}&latitude={:.4}&start={SERIES_START}&end={SERIES_END}&format=JSON",
            p.lng, p.lat
        );
        let v = self.get_json(&url).await?;
        let obj = v["properties"]["parameter"]["PRECTOTCORR"].as_object().context("missing PRECTOTCORR series")?;
        let mut years = Vec::new();
        for y in SERIES_START..=SERIES_END {
            let months: Option<Vec<f64>> = (1..=12)
                .map(|m| {
                    obj.get(&format!("{y}{m:02}"))
                        .and_then(|x| x.as_f64())
                        .filter(|x| *x >= 0.0)
                        .map(|x| round1(x * DAYS_IN_MONTH[m - 1]))
                })
                .collect();
            if let Some(months) = months {
                years.push(YearRain { year: y, total_mm: months.iter().sum::<f64>().round(), months });
            }
        }
        if years.len() < 10 {
            return Err(anyhow!("too few complete years"));
        }
        Ok(RainSeries { live: true, source: "NASA POWER · PRECTOTCORR mensal".into(), years })
    }

    // ---------- ISRIC SoilGrids ----------

    pub async fn soil(&self, p: Point) -> Soil {
        self.cached("soil", &key(p), || self.fetch_soil(p), fallback_soil, |s| s.live).await
    }

    async fn fetch_soil(&self, p: Point) -> Result<Soil> {
        let url = format!(
            "https://rest.isric.org/soilgrids/v2.0/properties/query?lon={:.4}&lat={:.4}&property=clay&property=sand&property=silt&property=soc&depth=0-5cm&depth=15-30cm&depth=60-100cm&value=mean",
            p.lng, p.lat
        );
        let v = self.get_json(&url).await?;
        let layers = v["properties"]["layers"].as_array().context("missing layers")?;
        let mut by_name: HashMap<String, Vec<Option<f64>>> = HashMap::new();
        for l in layers {
            let name = l["name"].as_str().unwrap_or_default().to_string();
            let d = l["unit_measure"]["d_factor"].as_f64().unwrap_or(10.0);
            let vals = l["depths"]
                .as_array()
                .map(|ds| ds.iter().map(|d0| d0["values"]["mean"].as_f64().map(|x| x / d)).collect())
                .unwrap_or_default();
            by_name.insert(name, vals);
        }
        let get = |n: &str, i: usize| by_name.get(n).and_then(|v| v.get(i).copied()).flatten();
        let labels = ["0–5 cm", "15–30 cm", "60–100 cm"];
        let mut out = Vec::new();
        for (i, lab) in labels.iter().enumerate() {
            let (Some(c), Some(s), Some(si)) = (get("clay", i), get("sand", i), get("silt", i)) else {
                return Err(anyhow!("SoilGrids has no data here (water/urban?)"));
            };
            out.push(SoilLayer { depth: (*lab).into(), clay_pct: round1(c), sand_pct: round1(s), silt_pct: round1(si) });
        }
        let texture = texture_class(&out[0]);
        Ok(Soil {
            live: true,
            source: "ISRIC SoilGrids · 250 m".into(),
            soc_g_kg: get("soc", 0).map(round1),
            layers: out,
            texture_class: texture,
        })
    }

    // ---------- SRTM elevation & slope (OpenTopoData) ----------

    pub async fn terrain(&self, poly: &[LatLng]) -> Terrain {
        let c = crate::geo::centroid(poly);
        let pts: Vec<LatLng> = poly.iter().copied().chain(std::iter::once([c.lat, c.lng])).take(90).collect();
        let k = format!("{}-{}", key(c), pts.len());
        self.cached("terrain", &k, || self.fetch_terrain(pts.clone()), fallback_terrain, |t| t.live).await
    }

    async fn fetch_terrain(&self, pts: Vec<LatLng>) -> Result<Terrain> {
        let locs = pts.iter().map(|p| format!("{:.6},{:.6}", p[0], p[1])).collect::<Vec<_>>().join("|");
        let v = self.get_json(&format!("https://api.opentopodata.org/v1/srtm30m?locations={locs}")).await?;
        let res = v["results"].as_array().context("missing results")?;
        let samples: Vec<(f64, f64, f64)> = res
            .iter()
            .filter_map(|r| Some((r["location"]["lat"].as_f64()?, r["location"]["lng"].as_f64()?, r["elevation"].as_f64()?)))
            .collect();
        if samples.len() < 3 {
            return Err(anyhow!("too few elevation samples"));
        }
        let slope = plane_slope_pct(&samples);
        let elev = samples.iter().map(|s| s.2).sum::<f64>() / samples.len() as f64;
        Ok(Terrain {
            live: true,
            source: "SRTM 30 m · OpenTopoData".into(),
            elevation_m: elev.round(),
            slope_pct: (slope * 100.0).round() / 100.0,
            samples: samples.len(),
        })
    }

    // ---------- Municipality (Nominatim reverse + IBGE Localidades) ----------

    pub async fn place(&self, p: Point) -> Place {
        self.cached("place", &key(p), || self.fetch_place(p), fallback_place, |x| x.live && x.ibge_code.is_some())
            .await
    }

    async fn fetch_place(&self, p: Point) -> Result<Place> {
        let url = format!(
            "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat={:.5}&lon={:.5}&zoom=10&accept-language=pt-BR",
            p.lat, p.lng
        );
        let v = self.get_json(&url).await?;
        let a = &v["address"];
        let name = ["municipality", "city", "town", "village"]
            .iter()
            .find_map(|k| a[*k].as_str())
            .context("no municipality in reverse geocode")?
            .to_string();
        let uf = a["ISO3166-2-lvl4"].as_str().and_then(|s| s.strip_prefix("BR-")).context("not in Brazil")?.to_string();
        let list = self.get_json(&format!("https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios")).await?;
        let target = normalize(&name);
        let code = list
            .as_array()
            .and_then(|ms| ms.iter().find(|m| m["nome"].as_str().map(normalize).as_deref() == Some(target.as_str())))
            .and_then(|m| m["id"].as_i64())
            .map(|id| id.to_string());
        Ok(Place { live: true, municipality: name, uf, ibge_code: code })
    }

    // ---------- IBGE SIDRA · PAM (tabela 5457) ----------

    pub async fn pam(&self, place: &Place) -> Pam {
        let k = place.ibge_code.clone().unwrap_or_else(|| format!("uf-{}", place.uf));
        let pl = place.clone();
        self.cached("pam", &k, || self.fetch_pam(pl), fallback_pam, |p| p.live).await
    }

    async fn fetch_pam(&self, place: Place) -> Result<Pam> {
        let code = place.ibge_code.clone().context("municipality code unknown")?;
        let (soja, milho) = self.sidra("n6", &code).await?;
        if soja.len() >= 10 {
            return Ok(Pam {
                live: true,
                source: "IBGE PAM · tabela 5457".into(),
                level: "município".into(),
                place: format!("{} ({})", place.municipality, place.uf),
                soja,
                milho,
            });
        }
        // Too little soybean history in the municipality: use the state.
        let (soja, milho) = self.sidra("n3", &code[..2]).await?;
        Ok(Pam { live: true, source: "IBGE PAM · tabela 5457".into(), level: "estado".into(), place: place.uf.clone(), soja, milho })
    }

    async fn sidra(&self, level: &str, code: &str) -> Result<(Vec<PamYear>, Vec<PamYear>)> {
        let url = format!("https://apisidra.ibge.gov.br/values/t/5457/{level}/{code}/v/112,215,216/p/last%2025/c782/40122,40124");
        let v = self.get_json(&url).await?;
        let rows = v.as_array().context("SIDRA: not an array")?;
        // (crop, year) -> [yield, area, value]
        let mut acc: HashMap<(&'static str, i32), [Option<f64>; 3]> = HashMap::new();
        for r in rows.iter().skip(1) {
            let val = r["V"].as_str().and_then(|s| s.parse::<f64>().ok());
            let year = r["D3C"].as_str().and_then(|s| s.parse::<i32>().ok());
            let (Some(val), Some(var), Some(year), Some(prod)) = (val, r["D2C"].as_str(), year, r["D4C"].as_str()) else {
                continue;
            };
            let crop = match prod {
                "40124" => "soja",
                "40122" => "milho",
                _ => continue,
            };
            let e = acc.entry((crop, year)).or_insert([None; 3]);
            match var {
                "112" => e[0] = Some(val),
                "216" => e[1] = Some(val),
                "215" => e[2] = Some(val),
                _ => {}
            }
        }
        let mut soja = Vec::new();
        let mut milho = Vec::new();
        for ((crop, year), v) in acc {
            if let [Some(y), Some(a), Some(val)] = v {
                if y > 0.0 && a > 0.0 && val > 0.0 {
                    let row = PamYear { year, yield_kg_ha: y, area_ha: a, value_thousand_brl: val };
                    if crop == "soja" {
                        soja.push(row)
                    } else {
                        milho.push(row)
                    }
                }
            }
        }
        soja.sort_by_key(|r| r.year);
        milho.sort_by_key(|r| r.year);
        Ok((soja, milho))
    }
}

// ---------------------------------------------------------------- helpers

fn normalize(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ã' | 'Á' | 'À' | 'Â' | 'Ã' => 'a',
            'é' | 'ê' | 'É' | 'Ê' => 'e',
            'í' | 'Í' => 'i',
            'ó' | 'ô' | 'õ' | 'Ó' | 'Ô' | 'Õ' => 'o',
            'ú' | 'ü' | 'Ú' | 'Ü' => 'u',
            'ç' | 'Ç' => 'c',
            c => c.to_ascii_lowercase(),
        })
        .filter(|c| c.is_ascii_alphanumeric())
        .collect()
}

/// Least-squares plane through (lat, lng, elevation) samples; returns slope in %.
fn plane_slope_pct(s: &[(f64, f64, f64)]) -> f64 {
    let n = s.len() as f64;
    let lat0 = s.iter().map(|p| p.0).sum::<f64>() / n;
    let lng0 = s.iter().map(|p| p.1).sum::<f64>() / n;
    let r = 6_371_008.8_f64;
    let k = lat0.to_radians().cos();
    let pts: Vec<(f64, f64, f64)> =
        s.iter().map(|p| ((p.1 - lng0).to_radians() * r * k, (p.0 - lat0).to_radians() * r, p.2)).collect();
    let mz = pts.iter().map(|p| p.2).sum::<f64>() / n;
    let (mut sxx, mut syy, mut sxy, mut sxz, mut syz) = (0.0, 0.0, 0.0, 0.0, 0.0);
    for (x, y, z) in &pts {
        let dz = z - mz;
        sxx += x * x;
        syy += y * y;
        sxy += x * y;
        sxz += x * dz;
        syz += y * dz;
    }
    let det = sxx * syy - sxy * sxy;
    if det.abs() < 1e-9 {
        return 0.0;
    }
    let a = (sxz * syy - syz * sxy) / det;
    let b = (syz * sxx - sxz * sxy) / det;
    (a * a + b * b).sqrt() * 100.0
}

fn build_climate(live: bool, period: String, months: Vec<MonthClimate>, elevation_m: f64) -> Climate {
    let annual: f64 = months.iter().map(|m| m.precip_mm).sum();
    let mean_t = months.iter().map(|m| m.temp_c).sum::<f64>() / 12.0;
    Climate {
        live,
        source: "NASA POWER · T2M, PRECTOTCORR, RH2M, WS10M (→ 2 m, FAO-56), ALLSKY_SFC_SW_DWN".into(),
        period,
        months,
        annual_precip_mm: annual.round(),
        mean_temp_c: round1(mean_t),
        elevation_m,
    }
}

/// Simplified texture class (subset of the Brazilian/USDA triangle).
pub fn texture_class(l: &SoilLayer) -> String {
    if l.clay_pct >= 60.0 {
        "Muito argiloso"
    } else if l.clay_pct >= 35.0 {
        "Argiloso"
    } else if l.sand_pct >= 70.0 {
        "Arenoso"
    } else if l.sand_pct >= 45.0 {
        "Franco-arenoso"
    } else {
        "Franco (médio)"
    }
    .into()
}

/// FAO-56 eq. 47 for a 10 m anemometer over short grass: u2 = u10 · 4.87 / ln(67.8·10 − 5.42).
const WIND_10M_TO_2M: f64 = 0.748;

/// Builds the 12 monthly records from the `properties.parameter` object of a POWER climatology response.
fn parse_months(params: &serde_json::Value) -> Result<Vec<MonthClimate>> {
    let get = |name: &str, mk: &str| {
        params[name][mk].as_f64().filter(|x| *x > -900.0).ok_or_else(|| anyhow!("missing {name} {mk}"))
    };
    let mut months = Vec::with_capacity(12);
    for (i, mk) in MONTH_KEYS.iter().enumerate() {
        months.push(MonthClimate {
            month: MONTH_LABELS[i].to_string(),
            precip_mm: round1(get("PRECTOTCORR", mk)? * DAYS_IN_MONTH[i]),
            temp_c: round1(get("T2M", mk)?),
            rh_pct: round1(get("RH2M", mk)?),
            // POWER's WS2M is near zero in some cells; derive the 2 m wind from WS10M instead.
            wind_ms: round2(get("WS10M", mk)? * WIND_10M_TO_2M),
            radiation_mj: get("ALLSKY_SFC_SW_DWN", mk)?,
        });
    }
    Ok(months)
}

pub fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

// ---------------------------------------------------------------- offline fallbacks
// Approximate values for the demo field (western Bahia). Never cached; flagged live=false.

fn fallback_climate() -> Climate {
    let pr = [205.0, 165.0, 160.0, 75.0, 12.0, 2.0, 1.0, 3.0, 20.0, 85.0, 175.0, 210.0];
    let t = [24.6, 24.7, 24.6, 24.5, 23.8, 22.9, 22.8, 24.4, 26.4, 26.6, 25.0, 24.6];
    let rh = [73.0, 74.0, 74.0, 68.0, 57.0, 50.0, 47.0, 40.0, 40.0, 52.0, 68.0, 73.0];
    let ws = [1.8, 1.8, 1.7, 1.9, 2.2, 2.5, 2.6, 2.6, 2.3, 2.0, 1.8, 1.8];
    let rad = [21.8, 21.5, 20.8, 20.6, 19.8, 19.0, 20.1, 22.0, 23.0, 22.5, 21.0, 21.2];
    let months = (0..12)
        .map(|i| MonthClimate {
            month: MONTH_LABELS[i].to_string(),
            precip_mm: pr[i],
            temp_c: t[i],
            rh_pct: rh[i],
            wind_ms: ws[i],
            radiation_mj: rad[i],
        })
        .collect();
    let mut c = build_climate(false, "exemplo offline".into(), months, 780.0);
    c.source = "Exemplo offline (NASA POWER indisponível)".into();
    c
}

fn fallback_rain() -> RainSeries {
    // Climatological monthly shape scaled by an illustrative yearly factor.
    let shape = [205.0, 165.0, 160.0, 75.0, 12.0, 2.0, 1.0, 3.0, 20.0, 85.0, 175.0, 210.0];
    let f = [
        1.1, 0.95, 1.15, 1.2, 1.0, 1.1, 0.85, 1.05, 1.15, 0.9, 1.1, 0.8, 1.0, 0.95, 0.78, 1.05, 1.0, 1.15, 0.97, 1.1, 0.9,
        1.2, 1.05, 0.85, 0.95, 1.0,
    ];
    let years = (SERIES_START..=SERIES_END)
        .enumerate()
        .map(|(i, y)| {
            let months: Vec<f64> = shape.iter().enumerate().map(|(m, s)| round1(s * f[(i + m) % f.len()])).collect();
            YearRain { year: y, total_mm: months.iter().sum::<f64>().round(), months }
        })
        .collect();
    RainSeries { live: false, source: "Exemplo offline (NASA POWER indisponível)".into(), years }
}

fn fallback_soil() -> Soil {
    let layers = vec![
        SoilLayer { depth: "0–5 cm".into(), clay_pct: 30.0, sand_pct: 49.0, silt_pct: 21.0 },
        SoilLayer { depth: "15–30 cm".into(), clay_pct: 32.0, sand_pct: 47.0, silt_pct: 21.0 },
        SoilLayer { depth: "60–100 cm".into(), clay_pct: 38.0, sand_pct: 41.0, silt_pct: 21.0 },
    ];
    let texture = texture_class(&layers[0]);
    Soil { live: false, source: "Exemplo offline (SoilGrids indisponível)".into(), layers, soc_g_kg: Some(12.0), texture_class: texture }
}

fn fallback_terrain() -> Terrain {
    Terrain { live: false, source: "Exemplo offline (SRTM indisponível)".into(), elevation_m: 790.0, slope_pct: 1.0, samples: 0 }
}

fn fallback_place() -> Place {
    Place { live: false, municipality: "Luís Eduardo Magalhães".into(), uf: "BA".into(), ibge_code: Some("2919553".into()) }
}

fn fallback_pam() -> Pam {
    let conv = |rows: &[(i32, f64, f64, f64)]| {
        rows.iter().map(|&(year, y, a, v)| PamYear { year, yield_kg_ha: y, area_ha: a, value_thousand_brl: v }).collect()
    };
    Pam {
        live: false,
        source: "IBGE PAM · tabela 5457 (cópia local)".into(),
        level: "município".into(),
        place: "Luís Eduardo Magalhães (BA)".into(),
        soja: conv(pam_fallback::FALLBACK_PAM_SOJA),
        milho: conv(pam_fallback::FALLBACK_PAM_MILHO),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_portuguese_names() {
        assert_eq!(normalize("Luís Eduardo Magalhães"), normalize("Luis Eduardo Magalhaes"));
        assert_eq!(normalize("São Desidério"), "saodesiderio");
    }

    #[test]
    fn plane_slope_of_tilted_plane() {
        // 10 m rise over ~1.11 km northwards → ~0.9 %.
        let s = [(0.0, 0.0, 100.0), (0.01, 0.0, 110.0), (0.0, 0.01, 100.0), (0.01, 0.01, 110.0)];
        let pct = plane_slope_pct(&s);
        assert!((pct - 0.9).abs() < 0.05, "{pct}");
    }

    fn power_params(with_ws10m: bool, ws10m: f64) -> serde_json::Value {
        let mut p = serde_json::Map::new();
        let mut put = |name: &str, v: f64| {
            let m: serde_json::Map<String, serde_json::Value> =
                MONTH_KEYS.iter().map(|k| (k.to_string(), serde_json::json!(v))).collect();
            p.insert(name.into(), m.into());
        };
        put("PRECTOTCORR", 3.0);
        put("T2M", 24.0);
        put("RH2M", 70.0);
        put("ALLSKY_SFC_SW_DWN", 20.0);
        put("WS2M", 0.1); // must be ignored
        if with_ws10m {
            put("WS10M", ws10m);
        }
        p.into()
    }

    #[test]
    fn wind_is_derived_from_ws10m() {
        let m = parse_months(&power_params(true, 1.0)).unwrap();
        assert_eq!(m[0].wind_ms, 0.75);
        let m = parse_months(&power_params(true, 4.04)).unwrap();
        assert_eq!(m[5].wind_ms, 3.02);
    }

    #[test]
    fn missing_ws10m_is_an_error() {
        assert!(parse_months(&power_params(false, 0.0)).is_err());
    }
}
