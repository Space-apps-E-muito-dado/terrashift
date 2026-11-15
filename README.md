# TerraShift — Agricultural Future Simulator (v0.1)

Protótipo para o desafio **NASA Space Apps 2026 · Field Shift: Adapting Farms with NASA Data**.
O usuário escolhe uma área no mapa, vê um diagnóstico ambiental feito com dados abertos e compara estratégias de rotação de culturas para 2027–2029 em anos secos, típicos e chuvosos.

```
frontend/   React 18 + TypeScript + Vite + Leaflet
backend/    Rust (Axum) — API, clientes de dados e modelo de simulação
spec_design.md   especificação de UI/UX (o design está em nasa.pen, no Pencil)
```

## Como rodar

Pré-requisitos: Node 18+ e Rust (`rustup`, cargo 1.80+).

```bash
# 1) API (porta 8080)
cd backend
cargo run

# 2) Frontend em modo dev (porta 5173, com proxy de /api para a 8080)
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173 e clique em **Experimentar demonstração**.

### Um processo só (para apresentar)

```bash
cd frontend && npm run build
cd ../backend && cargo run --release   # serve ../frontend/dist em http://localhost:8080
```

Variáveis do backend: `PORT` (padrão 8080), `FRONTEND_DIST` (padrão `../frontend/dist`), `CACHE_DIR` (padrão `cache`), `RUST_LOG`.

### Testes

```bash
cd backend && cargo test
```

## Idiomas / Languages

A interface está em **português e inglês**. O idioma inicial segue o navegador, a escolha feita no seletor **PT | EN** (cabeçalho e landing) fica salva, e a troca vale na hora, inclusive para os números e o relatório exportado. Todos os textos ficam em `frontend/src/lib/i18n.tsx`. A API devolve só dados e identificadores; fontes e hipóteses são montadas no frontend (`frontend/src/lib/explain.ts`).

The interface is available in **Portuguese and English**. The initial language follows the browser; the **PT | EN** switch (header and landing page) is remembered and applies instantly, including number formats and the exported report. All strings live in `frontend/src/lib/i18n.tsx`.

## De onde vem cada dado

| Na interface | Fonte | Como é usado |
|---|---|---|
| Imagem base do mapa | Copernicus Sentinel-2 cloudless 2024 (EOX), 10 m | Tiles WMTS |
| Camada Vegetação | MODIS Terra NDVI 16 dias, 250 m (NASA GIBS) | Tiles WMTS |
| Camada Água | SMAP L4 umidade na zona radicular, ~9 km (NASA GIBS) | Tiles WMTS |
| Camada Relevo | SRTM Color Index (NASA GIBS) | Tiles WMTS |
| Clima mensal | NASA POWER climatologia 2001–2025 (`T2M`, `PRECTOTCORR`, `RH2M`, `WS10M` convertido a 2 m por FAO-56 eq. 47 (× 0,748), `ALLSKY_SFC_SW_DWN`) | API REST, no backend |
| Safras secas / típicas / chuvosas | NASA POWER chuva mensal 2000–2025 | API REST, no backend |
| Produtividade, área e valor da produção | IBGE PAM, tabela 5457 (soja e milho), via SIDRA | API REST, no backend |
| Município da área | OpenStreetMap Nominatim (reverso) + IBGE Localidades | API REST, no backend |
| Solo (textura, carbono) | ISRIC SoilGrids 250 m | API REST, no backend |
| Elevação e declividade | SRTM 30 m via OpenTopoData | API REST, no backend |
| Busca de cidades | OpenStreetMap Nominatim | Chamado pelo navegador |

As respostas ficam guardadas em `backend/cache/`. Depois da primeira consulta, a demo funciona sem internet para aquela área (a imagem do mapa ainda precisa de rede). Na subida, o servidor já pré-carrega os dados da fazenda de exemplo. Se uma fonte falhar, a API usa valores de exemplo, marca `live: false` e a interface avisa "Inclui dados offline". Para o IBGE, o fallback é uma cópia local da série real de Luís Eduardo Magalhães (`backend/src/pam_fallback.rs`).

## Como os índices são calculados (backend/src/model.rs)

| Índice | Método | Dados |
|---|---|---|
| Cenários seco / típico / chuvoso | Terços das safras pelo **mês mais seco entre novembro e março** (veranico). Para a soja em LEM, esse indicador explica mais as quebras (r = 0,48) que o total de chuva da safra (r = 0,26) | NASA POWER |
| Receita bruta (R$/ha) | Tendência linear da produtividade municipal × razão média observada nas safras análogas × preço implícito médio dos 3 anos mais recentes (valor ÷ produção) | IBGE PAM × NASA POWER |
| Risco climático | Parcela das safras análogas em que a produtividade ficou ≥ 15% abaixo da tendência | IBGE PAM × NASA POWER |
| Demanda de água | Evapotranspiração da cultura (FAO-56 Penman–Monteith × Kc da FAO, semeadura em novembro) vs chuva efetiva (USDA-SCS) das safras análogas. A folga hídrica vale 50 quando a chuva efetiva iguala a necessidade | NASA POWER |
| Perda de solo (t/ha/ano) | RUSLE: R (Lombardi Neto & Moldenhauer), K (Williams/EPIC), LS (Wischmeier & Smith, rampa de 100 m), C de referência para plantio direto | NASA POWER, SoilGrids, SRTM |

Resultado para a fazenda de exemplo (Luís Eduardo Magalhães, BA):
- **Soja:** tendência de 4.316 kg/ha, preço implícito de R$ 2,00/kg, receita bruta típica de ~R$ 8,5 mil/ha. Quebras em 2 de 8 safras com veranico forte e em 1 de 9 típicas.
- **Erosão:** a declividade medida é de 0,5% (chapadão), o que dá perdas de solo de 0,8 a 2,6 t/ha/ano conforme a rotação.

**Limitações:**
- **Amostras pequenas:** 8–9 safras por cenário. As contagens aparecem na interface.
- **Receita bruta:** os custos de produção (CONAB) ainda não entram.
- **Uma safra principal por ano:** safrinha e irrigação não são modeladas.
- **Cobertura vegetal:** não gera receita. O efeito da palhada na produtividade da safra seguinte não é estimado; só o efeito na erosão.
- **Coeficientes de literatura:** os valores de Kc e do fator C vêm da literatura e merecem revisão agronômica.
- **Rotação atual e culturas do produtor:** a tela "Sua rotação" define a rotação atual (repetida em 2027–2029). Culturas descritas pelo produtor usam valores do tipo de planta (Kc da FAO-56, Ky da FAO-33 via FAO-66) e não têm receita; aparecem sempre como "estimado". Ver `spec_rotation_custom_crops.md` e `backend/src/crops.rs`.

## Próximos passos sugeridos

- Custos de produção (CONAB) para passar de receita bruta a margem.
- Série de NDVI por talhão (AppEEARS ou Sentinel-2) para validar os anos de quebra no próprio talhão.
- Segunda safra (safrinha) e efeito da palhada na produtividade.
- Importar o limite do imóvel do CAR.
