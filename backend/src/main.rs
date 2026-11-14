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
use model::{AnalogYears, Objective, RecentCrop};
use sources::{Climate, DataClient, Pam, Place, RainSeries, Soil, Terrain};

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

struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

fn bad_request(msg: &str) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, msg.to_string())
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
    centroid: Point,
    area_ha: f64,
    climate: Climate,
    rain_series: RainSeries,
    analog_years: AnalogYears,
    soil: Soil,
    terrain: Terrain,
    place: Place,
    yield_source: String,
    yield_level: String,
    yield_place: String,
    yields_live: bool,
    crops: Vec<CropHistory>,
    sources: Vec<SourceInfo>,
}

struct Gathered {
    climate: Climate,
    rain: RainSeries,
    soil: Soil,
    terrain: Terrain,
    place: Place,
    pam: Pam,
}

async fn gather(data: &DataClient, poly: &[LatLng]) -> Gathered {
    let c = geo::centroid(poly);
    let (climate, rain, soil, terrain, place) =
        tokio::join!(data.climate(c), data.rain_series(c), data.soil(c), data.terrain(poly), data.place(c));
    let pam = data.pam(&place).await;
    Gathered { climate, rain, soil, terrain, place, pam }
}

fn sources_for(g: &Gathered) -> Vec<SourceInfo> {
    vec![
        SourceInfo { kind: "regional", dataset: "NASA POWER".into(), detail: format!("Chuva, temperatura, umidade, vento e radiação · {}", g.climate.period), live: g.climate.live },
        SourceInfo { kind: "regional", dataset: "NASA POWER".into(), detail: format!("Chuva mensal {}–{} → safras secas, típicas e chuvosas", sources::SERIES_START, sources::SERIES_END), live: g.rain.live },
        SourceInfo { kind: "regional", dataset: "IBGE PAM".into(), detail: format!("Produtividade, área e valor da produção de soja e milho · {} ({})", g.pam.place, g.pam.level), live: g.pam.live },
        SourceInfo { kind: "estimate", dataset: "ISRIC SoilGrids".into(), detail: "Textura e carbono orgânico · 250 m".into(), live: g.soil.live },
        SourceInfo { kind: "satellite", dataset: "SRTM".into(), detail: format!("Elevação e declividade ({:.1} %) · 30 m", g.terrain.slope_pct), live: g.terrain.live },
        SourceInfo { kind: "satellite", dataset: "MODIS Terra NDVI".into(), detail: "Camada de vegetação, composição de 16 dias · NASA GIBS".into(), live: true },
        SourceInfo { kind: "satellite", dataset: "SMAP L4".into(), detail: "Umidade do solo na zona radicular · ~9 km · NASA GIBS".into(), live: true },
        SourceInfo { kind: "satellite", dataset: "Copernicus Sentinel-2".into(), detail: "Imagem base sem nuvens (EOX s2cloudless) · 10 m".into(), live: true },
    ]
}

async fn diagnosis(State(st): State<AppState>, Json(req): Json<PolygonReq>) -> Result<Json<Diagnosis>, ApiError> {
    if !geo::valid_polygon(&req.polygon) {
        return Err(bad_request("Desenhe uma área com pelo menos 3 pontos."));
    }
    let g = gather(&st.data, &req.polygon).await;
    let analog = model::analog_years(&g.rain);
    let sources = sources_for(&g);
    Ok(Json(Diagnosis {
        centroid: geo::centroid(&req.polygon),
        area_ha: geo::area_ha(&req.polygon).round(),
        sources,
        analog_years: analog,
        yield_source: g.pam.source.clone(),
        yield_level: g.pam.level.clone(),
        yield_place: g.pam.place.clone(),
        yields_live: g.pam.live,
        crops: vec![CropHistory { crop: "soja", years: g.pam.soja }, CropHistory { crop: "milho", years: g.pam.milho }],
        climate: g.climate,
        rain_series: g.rain,
        soil: g.soil,
        terrain: g.terrain,
        place: g.place,
    }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SimulateReq {
    polygon: Vec<LatLng>,
    objective: Objective,
    /// Collected on the "Objetivos" screen; not used by the v0.2 indices.
    #[allow(dead_code)]
    recent_crop: RecentCrop,
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
    let c = geo::centroid(&req.polygon);
    let g = gather(&st.data, &req.polygon).await;
    let analog = model::analog_years(&g.rain);
    let sim = model::simulate(model::SimInput {
        climate: &g.climate,
        analogs: &analog,
        soil: &g.soil,
        terrain: &g.terrain,
        pam: &g.pam,
        lat: c.lat,
        objective: req.objective,
    });
    let any_offline = !(g.climate.live && g.rain.live && g.soil.live && g.terrain.live && g.pam.live);
    let pct = (model::LOSS_THRESHOLD * 100.0).round();
    let assumptions = vec![
        format!("Cenários: {}. Cada cenário usa a média mensal de chuva das safras desse terço.", analog.criterion.to_lowercase()),
        format!("Receita bruta = tendência de produtividade de {} (IBGE PAM, até {}) × razão média observada nas safras análogas × preço médio implícito dos 3 anos mais recentes. Custos de produção não incluídos.",
            g.pam.place, sim.calibration.crops.iter().map(|c| c.last_year).max().unwrap_or(0)),
        format!("Risco climático = parcela das safras análogas em que a produtividade ficou {}% ou mais abaixo da tendência.", 100.0 - pct),
        "Água = evapotranspiração da cultura (FAO-56 Penman–Monteith com dados NASA POWER × Kc da FAO para semeadura em novembro) comparada à chuva efetiva (USDA-SCS) do cenário. No índice de folga hídrica, 50 significa chuva efetiva igual à necessidade da cultura.".into(),
        format!("Solo = RUSLE: erosividade R (Lombardi Neto, chuva NASA POWER), erodibilidade K (Williams, SoilGrids), LS com declividade SRTM de {:.1}% e rampa de {} m, fator C de referência para plantio direto (soja 0,20; milho 0,12; cobertura 0,04; palhada reduz o C da cultura seguinte em 30%).", g.terrain.slope_pct, model::SLOPE_LENGTH_M),
        "Uma safra principal por ano (outubro a março); safrinha e irrigação não modeladas. Cobertura vegetal não gera receita direta.".into(),
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
            tracing::info!(
                climate = g.climate.live,
                rain = g.rain.live,
                soil = g.soil.live,
                terrain = g.terrain.live,
                yields = g.pam.live,
                place = %g.pam.place,
                "demo farm data warmed"
            );
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
