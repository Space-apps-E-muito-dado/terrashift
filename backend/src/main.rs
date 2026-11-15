mod crops;
mod geo;
mod model;
mod pam_fallback;
mod sources;

use std::{net::SocketAddr, path::PathBuf};

use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
};

use geo::{LatLng, Point};
use model::{AnalogYears, Objective};
use sources::{Climate, DataClient, ForeignPlace, Pam, Place, PlaceLookup, RainSeries, Soil, Terrain};

/// Demo field ("Fazenda Horizonte") in the western Bahia Cerrado, ~120 ha.
pub const DEMO_POLYGON: [LatLng; 4] = [
    [-12.095388, -45.918045],
    [-12.094717, -45.908089],
    [-12.104788, -45.907745],
    [-12.105459, -45.917702],
];

#[derive(Clone)]
struct AppState {
    data: DataClient,
}

struct ApiError {
    status: StatusCode,
    msg: String,
    /// Stable machine-readable code for the client; `error` stays Portuguese text.
    code: Option<&'static str>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = match self.code {
            Some(code) => json!({ "error": self.msg, "code": code }),
            None => json!({ "error": self.msg }),
        };
        (self.status, Json(body)).into_response()
    }
}

fn bad_request(msg: &str) -> ApiError {
    ApiError { status: StatusCode::BAD_REQUEST, msg: msg.to_string(), code: None }
}

fn outside_coverage() -> ApiError {
    ApiError {
        status: StatusCode::UNPROCESSABLE_ENTITY,
        msg: "A simulação de estratégias cobre apenas o Brasil por enquanto.".into(),
        code: Some("outside_coverage"),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Farm {
    name: String,
    region: String,
    polygon: Vec<LatLng>,
    centroid: Point,
    area_ha: f64,
}

async fn demo_farm() -> Json<Farm> {
    let polygon = DEMO_POLYGON.to_vec();
    Json(Farm {
        name: "Fazenda Horizonte".into(),
        region: "Cerrado brasileiro · oeste da Bahia".into(),
        centroid: geo::centroid(&polygon),
        area_ha: geo::area_ha(&polygon).round(),
        polygon,
    })
}

#[derive(Deserialize)]
struct PolygonReq {
    polygon: Vec<LatLng>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceInfo {
    kind: &'static str,
    dataset: String,
    detail: String,
    live: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CropHistory {
    crop: &'static str,
    years: Vec<sources::PamYear>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Diagnosis {
    /// "full" (Brazil) or "diagnosis_only" (outside Brazil: no yields, scenarios or simulation).
    coverage: &'static str,
    centroid: Point,
    area_ha: f64,
    climate: Climate,
    rain_series: Option<RainSeries>,
    analog_years: Option<AnalogYears>,
    soil: Soil,
    terrain: Terrain,
    place: Option<Place>,
    foreign_place: Option<ForeignPlace>,
    yield_source: Option<String>,
    yield_level: Option<String>,
    yield_place: Option<String>,
    yields_live: Option<bool>,
    crops: Vec<CropHistory>,
    sources: Vec<SourceInfo>,
}

/// What the simulation needs and only Brazil has.
enum Coverage {
    Full { place: Place, rain: RainSeries, pam: Pam },
    DiagnosisOnly { foreign: ForeignPlace },
}

struct Gathered {
    climate: Climate,
    soil: Soil,
    terrain: Terrain,
    coverage: Coverage,
}

/// Resolves the place first, so a field outside Brazil skips the Brazil-only sources
/// (monthly rain series for the Nov–Mar scenarios, IBGE PAM).
async fn gather(data: &DataClient, poly: &[LatLng]) -> Gathered {
    let c = geo::centroid(poly);
    match data.place(c).await {
        PlaceLookup::Found(place) => {
            let (climate, rain, soil, terrain) =
                tokio::join!(data.climate(c), data.rain_series(c), data.soil(c), data.terrain(poly));
            let pam = data.pam(&place).await;
            Gathered { climate, soil, terrain, coverage: Coverage::Full { place, rain, pam } }
        }
        PlaceLookup::OutsideBrazil(foreign) => {
            let (climate, soil, terrain) = tokio::join!(data.climate(c), data.soil(c), data.terrain(poly));
            Gathered { climate, soil, terrain, coverage: Coverage::DiagnosisOnly { foreign } }
        }
    }
}

fn require_full(g: &Gathered) -> Result<(&Place, &RainSeries, &Pam), ApiError> {
    match &g.coverage {
        Coverage::Full { place, rain, pam } => Ok((place, rain, pam)),
        Coverage::DiagnosisOnly { .. } => Err(outside_coverage()),
    }
}

fn sources_for(g: &Gathered) -> Vec<SourceInfo> {
    let mut v = vec![SourceInfo {
        kind: "regional",
        dataset: "NASA POWER".into(),
        detail: format!("Chuva, temperatura, umidade, vento e radiação · {}", g.climate.period),
        live: g.climate.live,
    }];
    if let Coverage::Full { rain, pam, .. } = &g.coverage {
        v.push(SourceInfo { kind: "regional", dataset: "NASA POWER".into(), detail: format!("Chuva mensal {}–{} → safras secas, típicas e chuvosas", sources::SERIES_START, sources::SERIES_END), live: rain.live });
        v.push(SourceInfo { kind: "regional", dataset: "IBGE PAM".into(), detail: format!("Produtividade, área e valor da produção de soja e milho · {} ({})", pam.place, pam.level), live: pam.live });
    }
    v.extend([
        SourceInfo { kind: "estimate", dataset: "ISRIC SoilGrids".into(), detail: "Textura e carbono orgânico · 250 m".into(), live: g.soil.live },
        SourceInfo { kind: "satellite", dataset: "SRTM".into(), detail: format!("Elevação e declividade ({:.1} %) · 30 m", g.terrain.slope_pct), live: g.terrain.live },
        SourceInfo { kind: "satellite", dataset: "MODIS Terra NDVI".into(), detail: "Camada de vegetação, composição de 16 dias · NASA GIBS".into(), live: true },
        SourceInfo { kind: "satellite", dataset: "SMAP L4".into(), detail: "Umidade do solo na zona radicular · ~9 km · NASA GIBS".into(), live: true },
        SourceInfo { kind: "satellite", dataset: "Copernicus Sentinel-2".into(), detail: "Imagem base sem nuvens (EOX s2cloudless) · 10 m".into(), live: true },
    ]);
    v
}

fn build_diagnosis(poly: &[LatLng], g: Gathered) -> Diagnosis {
    let sources = sources_for(&g);
    let Gathered { climate, soil, terrain, coverage } = g;
    let mut d = Diagnosis {
        coverage: "diagnosis_only",
        centroid: geo::centroid(poly),
        area_ha: geo::area_ha(poly).round(),
        climate,
        rain_series: None,
        analog_years: None,
        soil,
        terrain,
        place: None,
        foreign_place: None,
        yield_source: None,
        yield_level: None,
        yield_place: None,
        yields_live: None,
        crops: vec![],
        sources,
    };
    match coverage {
        Coverage::DiagnosisOnly { foreign } => d.foreign_place = Some(foreign),
        Coverage::Full { place, rain, pam } => {
            d.coverage = "full";
            d.analog_years = Some(model::analog_years(&rain));
            d.rain_series = Some(rain);
            d.place = Some(place);
            d.yield_source = Some(pam.source);
            d.yield_level = Some(pam.level);
            d.yield_place = Some(pam.place);
            d.yields_live = Some(pam.live);
            d.crops = vec![CropHistory { crop: "soja", years: pam.soja }, CropHistory { crop: "milho", years: pam.milho }];
        }
    }
    d
}

async fn diagnosis(State(st): State<AppState>, Json(req): Json<PolygonReq>) -> Result<Json<Diagnosis>, ApiError> {
    if !geo::valid_polygon(&req.polygon) {
        return Err(bad_request("Desenhe uma área com pelo menos 3 pontos."));
    }
    let g = gather(&st.data, &req.polygon).await;
    Ok(Json(build_diagnosis(&req.polygon, g)))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SimulateReq {
    polygon: Vec<LatLng>,
    objective: Objective,
    /// The farmer's last three seasons; repeated over 2027–2029 as "Rotação atual".
    #[serde(default = "default_rotation")]
    current_rotation: Vec<String>,
    /// Optional rotation built by the farmer ("Minha rotação").
    #[serde(default)]
    my_rotation: Option<Vec<String>>,
    #[serde(default)]
    custom_crops: Vec<crops::CustomCropReq>,
}

fn default_rotation() -> Vec<String> {
    vec!["soja".into(); 3]
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SimulateRes {
    #[serde(flatten)]
    sim: model::SimOutput,
    analog_years: AnalogYears,
    /// True when any index still depends on offline example data.
    demo: bool,
    assumptions: Vec<String>,
    sources: Vec<SourceInfo>,
}

async fn simulate(State(st): State<AppState>, Json(req): Json<SimulateReq>) -> Result<Json<SimulateRes>, ApiError> {
    if !geo::valid_polygon(&req.polygon) {
        return Err(bad_request("Área inválida."));
    }
    let resolved = crops::resolve(&req.current_rotation, req.my_rotation.as_deref(), &req.custom_crops).map_err(|e| bad_request(&e))?;
    let c = geo::centroid(&req.polygon);
    let g = gather(&st.data, &req.polygon).await;
    let (place, rain, pam) = require_full(&g)?;
    let analog = model::analog_years(rain);
    let sim = model::simulate(model::SimInput {
        climate: &g.climate,
        analogs: &analog,
        soil: &g.soil,
        terrain: &g.terrain,
        pam,
        rain,
        lat: c.lat,
        objective: req.objective,
        current: resolved.current,
        mine: resolved.mine,
        customs: resolved.customs,
    });
    let any_offline = !(g.climate.live && rain.live && g.soil.live && g.terrain.live && pam.live && place.live);
    let pct = (model::LOSS_THRESHOLD * 100.0).round();
    let assumptions = vec![
        format!("Cenários: {}. Cada cenário usa a média mensal de chuva das safras desse terço.", analog.criterion.to_lowercase()),
        format!("Receita bruta = tendência de produtividade de {} (IBGE PAM, até {}) × razão média observada nas safras análogas × preço médio implícito dos 3 anos mais recentes. Custos de produção não incluídos.",
            pam.place, sim.calibration.crops.iter().map(|c| c.last_year).max().unwrap_or(0)),
        format!("Risco climático = parcela das safras análogas em que a produtividade ficou {}% ou mais abaixo da tendência.", 100.0 - pct),
        "Água = evapotranspiração da cultura (FAO-56 Penman–Monteith com dados NASA POWER × Kc da FAO para semeadura em novembro) comparada à chuva efetiva (USDA-SCS) do cenário. No índice de folga hídrica, 50 significa chuva efetiva igual à necessidade da cultura.".into(),
        format!("Solo = RUSLE: erosividade R (Lombardi Neto, chuva NASA POWER), erodibilidade K (Williams, SoilGrids), LS com declividade SRTM de {:.1}% e rampa de {} m, fator C de referência para plantio direto (soja 0,20; milho 0,12; cobertura 0,04; palhada reduz o C da cultura seguinte em 30%).", g.terrain.slope_pct, model::SLOPE_LENGTH_M),
        "Uma safra principal por ano (outubro a março); safrinha e irrigação não modeladas. Cobertura vegetal não gera receita direta.".into(),
        "Culturas descritas por você: Kc pelo tipo (FAO-56, Tabelas 11 e 12), risco pela resposta à água Ky (FAO-33, via FAO-66 Tabela 1) nas safras análogas reais. Sem receita: preço e produtividade desconhecidos. Pousio = solo descoberto (fator C = 1).".into(),
    ];
    Ok(Json(SimulateRes {
        sources: sources_for(&g),
        sim,
        analog_years: analog,
        demo: any_offline,
        assumptions,
    }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .init();

    let state = AppState { data: DataClient::new() };

    // Warm the cache for the demo farm so the first demo run is fast.
    {
        let data = state.data.clone();
        tokio::spawn(async move {
            let g = gather(&data, &DEMO_POLYGON).await;
            match &g.coverage {
                Coverage::Full { place, rain, pam } => tracing::info!(
                    climate = g.climate.live,
                    rain = rain.live,
                    soil = g.soil.live,
                    terrain = g.terrain.live,
                    yields = pam.live,
                    place = place.live,
                    yield_place = %pam.place,
                    "demo farm data warmed"
                ),
                Coverage::DiagnosisOnly { .. } => tracing::warn!("demo farm resolved outside Brazil"),
            }
        });
    }
    let api = Router::new()
        .route("/health", get(|| async { Json(json!({ "ok": true })) }))
        .route("/demo-farm", get(demo_farm))
        .route("/diagnosis", post(diagnosis))
        .route("/simulate", post(simulate))
        .with_state(state);

    let mut app = Router::new().nest("/api", api).layer(CorsLayer::permissive());

    // Serve the built frontend when available (single-binary demo).
    let dist = PathBuf::from(std::env::var("FRONTEND_DIST").unwrap_or_else(|_| "../frontend/dist".into()));
    if dist.join("index.html").exists() {
        let index = dist.join("index.html");
        app = app.fallback_service(ServeDir::new(&dist).fallback(ServeFile::new(index)));
        tracing::info!("serving frontend from {}", dist.display());
    }

    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("TerraShift API on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app).await.expect("server");
}

#[cfg(test)]
mod tests {
    use super::*;
    use sources::{fallback_climate, fallback_pam, fallback_place, fallback_rain, fallback_soil, fallback_terrain, ForeignPlace};

    fn outside() -> Gathered {
        Gathered {
            climate: fallback_climate(),
            soil: fallback_soil(),
            terrain: fallback_terrain(),
            coverage: Coverage::DiagnosisOnly {
                foreign: ForeignPlace { name: Some("Worth Township".into()), region: Some("Iowa".into()), country_code: "us".into() },
            },
        }
    }

    fn brazil() -> Gathered {
        Gathered {
            climate: fallback_climate(),
            soil: fallback_soil(),
            terrain: fallback_terrain(),
            coverage: Coverage::Full { place: fallback_place(), rain: fallback_rain(), pam: fallback_pam() },
        }
    }

    async fn body(res: Response) -> serde_json::Value {
        serde_json::from_slice(&axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap()).unwrap()
    }

    #[tokio::test]
    async fn outside_coverage_is_422_with_code() {
        let res = outside_coverage().into_response();
        assert_eq!(res.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let b = body(res).await;
        assert_eq!(b["code"], "outside_coverage");
        assert!(b["error"].as_str().unwrap().contains("Brasil"));
    }

    #[tokio::test]
    async fn bad_request_has_no_code() {
        let b = body(bad_request("x").into_response()).await;
        assert!(b.get("code").is_none());
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
}
