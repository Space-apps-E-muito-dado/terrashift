import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type Lang = 'pt' | 'en'
type Params = Record<string, string | number>
type Entry = string | ((p: Params) => string)

// ------------------------------------------------------------------ dictionaries

const pt = {
  // common
  'common.demoFarm': 'Fazenda de exemplo',
  'common.help': 'Ajuda',
  'common.home': 'TerraShift — início',
  'common.newProperty': 'Nova propriedade',
  'common.continue': 'Continuar',
  'common.realData': 'dados reais + modelo',
  'common.offlineIncluded': 'Inclui dados offline',
  'common.offlineExample': 'exemplo offline',
  'common.offlineTitle': 'Fonte indisponível agora: exibindo valores de exemplo',
  'common.language': 'Idioma',
  'common.zoomIn': 'Aproximar',
  'common.zoomOut': 'Afastar',
  'common.serverDown': 'Não conseguimos falar com o servidor.',
  'common.stepOf': (p: Params) => `${p.n} de ${p.total} — ${p.name}`,
  'common.stepAria': (p: Params) => `Etapa ${p.n} de ${p.total}`,
  'steps.0': 'Sua terra',
  'steps.1': 'Diagnóstico',
  'steps.2': 'Objetivos',
  'steps.3': 'Futuros',

  // source labels
  'src.satellite': 'Observado por satélite',
  'src.regional': 'Dado regional',
  'src.estimate': 'Estimativa',
  'src.user': 'Informado por você',

  // crops
  'crop.soja': 'Soja',
  'crop.milho': 'Milho',
  'crop.cobertura': 'Cobertura vegetal',
  'cropShort.soja': 'Soja',
  'cropShort.milho': 'Milho',
  'cropShort.cobertura': 'Cobertura',
  'role.cover': 'Protege e recupera o solo entre safras.',
  'role.maizeAfterSoy': 'Aproveita o nitrogênio deixado pela soja.',
  'role.maizeAfterCover': 'Planta sobre a palhada, que guarda umidade.',
  'role.maizeAfterMaize': 'Repete o milho: mais receita, mais desgaste do solo.',
  'role.maize': 'Cultura de maior potencial de receita.',
  'role.soyAfterCover': 'Planta sobre a palhada e fixa nitrogênio.',
  'role.soyAfterSoy': 'Repete a soja: simples, mas favorece pragas e doenças.',
  'role.soy': 'Fixa nitrogênio e abre o ciclo com boa liquidez.',

  // strategies
  'strategy.atual': 'Rotação atual',
  'strategy.retorno': 'Maior retorno',
  'strategy.equilibrada': 'Equilibrada',
  'strategy.resiliencia': 'Maior resiliência',
  'strategy.sustentavel': 'Mais sustentável',
  'tagline.atual': 'Soja todos os anos.',
  'tagline.retorno': 'Mais receita, solo mais exposto.',
  'tagline.equilibrada': 'Duas safras comerciais e uma de proteção do solo.',
  'tagline.resiliencia': 'Palhada antes do milho: menos erosão.',
  'tagline.sustentavel': 'Prioriza a proteção do solo.',
  'strategy.chip': (p: Params) => `Estratégia ${p.name}`,

  // scenarios
  'scenario.seco': 'Ano seco',
  'scenario.tipico': 'Ano típico',
  'scenario.chuvoso': 'Ano chuvoso',

  // objectives
  'objective.lucro.title': 'Ganhar mais',
  'objective.lucro.desc': 'Priorizar retorno econômico.',
  'objective.solo.title': 'Cuidar da terra',
  'objective.solo.desc': 'Priorizar conservação do solo.',
  'objective.seguranca.title': 'Ter mais segurança',
  'objective.seguranca.desc': 'Reduzir riscos ligados ao clima.',
  'objective.equilibrio.title': 'Equilibrar tudo',
  'objective.equilibrio.desc': 'Combinar retorno, conservação e segurança.',

  // map
  'map.s2Caption': 'Imagem: Copernicus Sentinel-2 (EOX s2cloudless) · 10 m',
  'map.ndvi': 'NDVI · MODIS Terra 16 dias · 250 m',
  'map.smap': 'Umidade do solo · SMAP L4 · ~9 km',
  'map.srtm': 'Elevação · SRTM · 30 m',

  // landing
  'landing.how': 'Como funciona',
  'landing.tech': 'Tecnologia',
  'landing.about': 'Sobre',
  'landing.cta': 'Explorar minha terra',
  'landing.demo': 'Experimentar demonstração',
  'landing.eyebrow': 'Inteligência agrícola com dados espaciais',
  'landing.title': 'E se você pudesse ver o futuro da sua terra?',
  'landing.desc': 'Explore diferentes estratégias de cultivo, antecipe riscos climáticos e descubra novas possibilidades para sua propriedade.',
  'landing.note': 'Sem cadastro. Comece pelo mapa.',
  'landing.visualAria': 'Comparação ilustrativa entre hoje e um cenário futuro',
  'landing.heroAlt': 'Vista aérea de lavouras no Cerrado',
  'landing.today': 'HOJE',
  'landing.future': '2029 · CENÁRIO',
  'landing.climate': 'Clima',
  'landing.typicalYear': 'Ano típico',
  'landing.soilWater': 'Água no solo',
  'landing.stableMoisture': 'Umidade estável',
  'landing.cover': 'Cobertura vegetal',
  'landing.coverNote': 'Solo protegido em 2029',
  'landing.rangeToday': 'Hoje',
  'landing.rangeAria': 'Comparar hoje e 2029',
  'landing.stripLead': 'Dados abertos de observação da Terra',
  'landing.stripSat': 'Satélites: Sentinel-2 · MODIS',
  'landing.stripClimate': 'Clima: NASA POWER',
  'landing.stripSoil': 'Solo e água: SMAP · SRTM · SoilGrids',
  'landing.stripYield': 'Produção: IBGE PAM',

  // select area
  'select.page': 'Sua terra',
  'select.title': 'Onde fica sua terra?',
  'select.lead': 'Vamos começar encontrando sua propriedade no mapa.',
  'select.search': 'Digite uma cidade ou localização',
  'select.searchAria': 'Buscar local',
  'select.draw': 'Desenhar área no mapa',
  'select.drawSub': 'Clique nos cantos do talhão',
  'select.demo': 'Usar fazenda de exemplo',
  'select.demoSub': 'Fazenda Horizonte · Cerrado',
  'select.needPoints': (p: Params) => `Marque pelo menos 3 pontos (${p.n}/3)`,
  'select.points': (p: Params) => `${p.n} pontos · ${p.ha} ha`,
  'select.undo': 'Desfazer',
  'select.finish': 'Concluir área',
  'select.selected': 'Área selecionada',
  'select.redraw': 'Redesenhar área',
  'select.area': 'Área',
  'select.region': 'Região',
  'select.demoField': 'Talhão de exemplo',
  'select.analyze': 'Analisar minha terra',
  'select.analyzing': 'Analisando…',
  'select.drawHint': 'Clique no mapa para marcar os cantos da área',
  'select.progressTitle': 'Consultando informações ambientais',
  'select.step.climate': 'Consultando clima',
  'select.step.soil': 'Analisando solo e relevo',
  'select.step.yield': 'Buscando produtividade do município',
  'select.serverDown': 'Servidor indisponível. Verifique se a API está rodando.',
  'select.myProperty': 'Minha propriedade',
  'select.drawnRegion': 'Área desenhada no mapa',
  'select.demoRegion': 'Cerrado brasileiro · oeste da Bahia',

  // diagnosis
  'diag.page': 'Diagnóstico',
  'diag.title': 'Conheça sua terra.',
  'diag.lead': 'Combinamos informações ambientais para entender as condições da sua região.',
  'diag.layer.real': 'Visão real',
  'diag.layer.agua': 'Água',
  'diag.layer.vegetacao': 'Vegetação',
  'diag.layer.solo': 'Solo',
  'diag.layer.relevo': 'Relevo',
  'diag.layersAria': 'Camadas do mapa',
  'diag.soilCaption': (p: Params) => `Solo: ${p.texture} · SoilGrids 250 m (ponto central)`,
  'diag.reliefCaption': (p: Params) => `Elevação · SRTM · 30 m · declividade média ${p.slope}%`,
  'diag.rain': 'Histórico de chuva',
  'diag.perYear': '/ano',
  'diag.rainAria': 'Chuva média mensal',
  'diag.rainNote': 'Média mensal 2001–2025, em mm',
  'diag.temp': 'Temperatura',
  'diag.mean': 'média',
  'diag.tempNote': (p: Params) => `Média mensal de ${p.min} a ${p.max} °C`,
  'diag.veg': 'Vegetação',
  'diag.vegNote': 'Índice de vegetação (NDVI) mais recente, composição de 16 dias. Veja na camada',
  'diag.little': 'Pouca',
  'diag.lots': 'Muita',
  'diag.soil': 'Solo',
  'diag.soilLayer': (p: Params) => `${p.clay}% argila · ${p.sand}% areia`,
  'diag.soilNote': 'Estimativa por modelo: confirme com análise local.',
  'diag.next': 'Próximo passo',
  'diag.insight': 'Vamos explorar quais estratégias de cultivo podem funcionar melhor para esta terra.',
  'diag.insightNote': (p: Params) => `Cada estratégia será testada com ${p.n} safras reais de chuva (NASA POWER) e a produtividade de soja e milho em ${p.place} (IBGE).`,
  'diag.explore': 'Explorar possibilidades',
  'months.short': 'J,F,M,A,M,J,J,A,S,O,N,D',
  'months.long': 'Jan,Fev,Mar,Abr,Mai,Jun,Jul,Ago,Set,Out,Nov,Dez',
  'texture.Muito argiloso': 'Muito argiloso',
  'texture.Argiloso': 'Argiloso',
  'texture.Arenoso': 'Arenoso',
  'texture.Franco-arenoso': 'Franco-arenoso',
  'texture.Franco (médio)': 'Franco (médio)',

  // objectives
  'obj.page': 'Objetivos',
  'obj.title': 'O que você deseja para o futuro da sua terra?',
  'obj.lead': 'Não existe uma única escolha perfeita. Vamos encontrar as opções que fazem mais sentido para você.',
  'obj.aria': 'Objetivo',
  'obj.recentQ': 'O que foi plantado recentemente?',
  'obj.recentNote': 'Ajuda a entender o histórico da área.',
  'obj.recentAria': 'Cultura recente',
  'obj.recent.soja': 'Soja',
  'obj.recent.milho': 'Milho',
  'obj.recent.outra': 'Outra cultura',
  'obj.recent.naosei': 'Não sei',
  'obj.back': 'Voltar ao diagnóstico',
  'obj.simulate': 'Simular meus futuros',
  'obj.simulating': 'Simulando…',

  // lab
  'lab.page': 'Laboratório de Futuros',
  'lab.compare': 'Comparar resultados',
  'lab.title': 'Explore diferentes futuros',
  'lab.lead': 'Veja como escolhas de cultivo e condições climáticas podem transformar os resultados da sua terra.',
  'lab.strategy': 'Estratégia',
  'lab.yourGoal': 'Seu objetivo',
  'lab.applied': 'Nova estratégia aplicada',
  'lab.climate': 'Cenário climático',
  'lab.analog.seco': 'Safras com veranico forte',
  'lab.analog.tipico': 'Safras com veranico moderado',
  'lab.analog.chuvoso': 'Safras sem veranico',
  'lab.analogNote': (p: Params) => `${p.kind} (mês mais seco de nov–mar, NASA POWER): ${p.years}.`,
  'lab.crops': 'Culturas no plano',
  'lab.dataNote': 'Calculado com NASA POWER, IBGE PAM, SoilGrids e SRTM. Receita bruta: custos de produção não incluídos.',
  'lab.scenarioChip': (p: Params) => `Cenário: ${p.name}`,
  'lab.seasonRain': (p: Params) => `${p.year} · chuva da safra ${p.mm} mm`,
  'lab.illustration': 'Ilustração do cenário · base Sentinel-2',
  'lab.whatIf': 'E se eu mudar o clima?',
  'lab.prevYear': 'Ano anterior',
  'lab.nextYear': 'Próximo ano',
  'lab.yearAria': 'Ano da simulação',
  'lab.results': 'Resultados deste futuro',
  'lab.thisFuture': 'este futuro',
  'lab.current': 'rotação atual',
  'lab.diffCurrent': 'Diferença para a rotação atual',
  'lab.about': (p: Params) => `Sobre ${p.name}`,
  'lab.revenue': 'Receita bruta estimada',
  'lab.revenueCaption': (p: Params) => `${p.yield} kg/ha × R$ ${p.price}/kg · IBGE PAM ${p.place}`,
  'lab.revenueNone': 'Cobertura vegetal não gera receita direta',
  'lab.revenueTip': (p: Params) => `Produtividade de tendência do município (IBGE PAM ${p.years}) ajustada pelo desempenho médio nas safras análogas, × preço médio implícito dos últimos 3 anos. Receita bruta: custos não incluídos.`,
  'lab.water': 'Demanda de água',
  'lab.waterUnit': (p: Params) => `${p.etc} de ${p.pe} mm`,
  'lab.waterDeficit': (p: Params) => `Déficit de ${p.mm} mm · FAO-56 com NASA POWER`,
  'lab.waterOk': 'Chuva efetiva cobre a necessidade · FAO-56 com NASA POWER',
  'lab.waterTip': 'Evapotranspiração da cultura no ciclo (Penman–Monteith FAO-56 com dados NASA POWER × Kc) comparada com a chuva efetiva (USDA-SCS) das safras análogas.',
  'lab.level.water': 'Baixa,Média,Alta',
  'lab.soil': 'Perda de solo estimada',
  'lab.soilUnit': 't/ha/ano',
  'lab.soilCaption': (p: Params) => `RUSLE · solo SoilGrids, declividade SRTM ${p.slope}%, chuva NASA POWER`,
  'lab.soilTip': (p: Params) => `Barra = proteção do solo pela cobertura (1 − fator C). Perda = R ${p.r} × K ${p.k} × LS ${p.ls} × C.`,
  'lab.risk': 'Risco climático',
  'lab.riskValue': (p: Params) => `${p.n} de ${p.total}`,
  'lab.riskUnit': (p: Params) => `safras com quebra · ${p.level}`,
  'lab.noHarvest': 'Sem colheita',
  'lab.level.risk': 'risco baixo,risco moderado,risco alto',
  'lab.riskCaption': (p: Params) => `Quebra = produtividade ${p.pct}% abaixo da tendência · IBGE PAM × NASA POWER`,
  'lab.riskTip': (p: Params) => `Em quantas safras parecidas com este cenário (${p.years}) a produtividade do município caiu ${p.pct}% ou mais abaixo da tendência.`,

  // compare
  'cmp.page': 'Comparação',
  'cmp.title': 'Qual futuro combina mais com você?',
  'cmp.hint': 'Toque em um futuro para escolher',
  'cmp.strategiesAria': 'Estratégias',
  'cmp.row.revenue': 'Receita',
  'cmp.row.water': 'Água',
  'cmp.row.soil': 'Solo',
  'cmp.row.climate': 'Clima',
  'cmp.tip.revenue': 'Receita bruta média por hectare e ano (IBGE PAM)',
  'cmp.tip.water': 'Folga hídrica: 50 = chuva efetiva igual à necessidade da cultura',
  'cmp.tip.soil': 'Perda de solo média (t/ha/ano, RUSLE); barra = proteção',
  'cmp.tip.climate': '100 − % de safras análogas com quebra de produtividade',
  'cmp.today': 'Hoje · rotação atual',
  'cmp.twoFutures': 'Mesma terra, dois futuros',
  'cmp.soilText': (p: Params) => `Em 2029, com a estratégia ${p.name}, a perda de solo estimada é de ${p.loss} t/ha, contra ${p.base} t/ha se a rotação atual continuar.`,
  'cmp.note': 'RUSLE com SoilGrids, SRTM e NASA POWER · imagem base Sentinel-2',
  'cmp.seePlan': (p: Params) => `Ver plano · ${p.name}`,
  'cmp.adjust': 'Ajustar no laboratório',

  // plan
  'plan.page': 'Meu plano agrícola',
  'plan.title': 'Seu plano para os próximos anos.',
  'plan.revenue': 'Receita bruta média na safra típica',
  'plan.perHaYear': '/ha/ano',
  'plan.soil': (p: Params) => `Perda de solo estimada (rotação atual: ${p.base} t)`,
  'plan.seasons': 'safras',
  'plan.risk': (p: Params) => `Safras com veranico em que a produtividade de ${p.crop} quebrou`,
  'plan.noHarvest': 'Nenhuma cultura comercial exposta ao veranico',
  'plan.how': 'Como calculamos esses resultados?',
  'plan.confidence': 'Confiabilidade',
  'plan.conf.moderate': 'Moderada',
  'plan.conf.low': 'Baixa',
  'plan.calib': (p: Params) => `Calibração com ${p.place} (${p.level}, ${p.source})`,
  'plan.level.município': 'município',
  'plan.level.estado': 'estado',
  'plan.th.crop': 'Cultura',
  'plan.th.series': 'Série',
  'plan.th.trend': 'Tendência',
  'plan.th.price': 'Preço',
  'plan.th.dry': 'Safras secas',
  'plan.th.typical': 'Típicas',
  'plan.th.wet': 'Chuvosas',
  'plan.trend': (p: Params) => `${p.y} kg/ha (+${p.g}/ano)`,
  'plan.ratio': (p: Params) => `${p.pct}% da tendência · ${p.loss}/${p.n} quebras`,
  'plan.soilCalib': (p: Params) => `Solo (RUSLE): K ${p.k} · LS ${p.ls} (declividade ${p.slope}%, rampa ${p.len} m) · R típico ${p.r} MJ·mm/ha·h·ano. ET₀ nov–mar: ${p.et0} mm.`,
  'plan.data': 'Dados utilizados',
  'plan.assumptions': 'Hipóteses e limitações',
  'plan.disclaimer': 'Estimativas com amostras pequenas (8–9 safras por cenário): não substituem análise agronômica local nem garantem resultados.',
  'plan.back': 'Voltar ao simulador',
  'plan.compare': 'Comparar outra estratégia',
  'plan.export': 'Exportar relatório',
  'plan.file': 'plano',

  // sources (built from data)
  'source.powerClimate': (p: Params) => `Chuva, temperatura, umidade, vento e radiação · climatologia ${p.period}`,
  'source.powerRain': 'Chuva mensal 2000–2025 → safras secas, típicas e chuvosas',
  'source.ibge': (p: Params) => `Produtividade, área e valor da produção de soja e milho · ${p.place} (${p.level})`,
  'source.soilgrids': 'Textura e carbono orgânico · 250 m',
  'source.srtm': (p: Params) => `Elevação e declividade (${p.slope}%) · 30 m`,
  'source.modis': 'Camada de vegetação, composição de 16 dias · NASA GIBS',
  'source.smap': 'Umidade do solo na zona radicular · ~9 km · NASA GIBS',
  'source.s2': 'Imagem base sem nuvens (EOX s2cloudless) · 10 m',

  // assumptions (built from data)
  'assume.scenarios': 'Cenários: mês mais seco entre novembro e março (veranico), em terços da série. Cada cenário usa a média mensal de chuva das safras desse terço.',
  'assume.revenue': (p: Params) => `Receita bruta = tendência de produtividade de ${p.place} (IBGE PAM, até ${p.last}) × razão média observada nas safras análogas × preço médio implícito dos 3 anos mais recentes. Custos de produção não incluídos.`,
  'assume.risk': (p: Params) => `Risco climático = parcela das safras análogas em que a produtividade ficou ${p.pct}% ou mais abaixo da tendência.`,
  'assume.water': 'Água = evapotranspiração da cultura (FAO-56 Penman–Monteith com dados NASA POWER × Kc da FAO para semeadura em novembro) comparada à chuva efetiva (USDA-SCS) do cenário. No índice de folga hídrica, 50 significa chuva efetiva igual à necessidade da cultura.',
  'assume.soil': (p: Params) => `Solo = RUSLE: erosividade R (Lombardi Neto, chuva NASA POWER), erodibilidade K (Williams, SoilGrids), LS com declividade SRTM de ${p.slope}% e rampa de ${p.len} m, fator C de referência para plantio direto (soja 0,20; milho 0,12; cobertura 0,04; palhada reduz o C da cultura seguinte em 30%).`,
  'assume.season': 'Uma safra principal por ano (outubro a março); safrinha e irrigação não modeladas. Cobertura vegetal não gera receita direta.',

  // report
  'report.title': (p: Params) => `Plano de rotação — ${p.name}`,
  'report.area': (p: Params) => `Área: ${p.ha} ha · ${p.region}`,
  'report.strategy': (p: Params) => `Estratégia: ${p.name} (${p.seq})`,
  'report.disclaimer': 'Estimativas calculadas com dados públicos (NASA POWER, IBGE PAM, SoilGrids, SRTM). Não substituem análise agronômica local nem garantem resultados. Receita bruta: custos de produção não incluídos.',
  'report.rotation': 'Rotação 2027–2029 (safra típica)',
  'report.rotationHead': '| Ano | Cultura | Produtividade (kg/ha) | Receita bruta (R$/ha) | ETc / chuva efetiva (mm) | Perda de solo (t/ha) | Safras análogas com quebra |',
  'report.byScenario': 'Resumo por cenário climático',
  'report.byScenarioHead': '| Cenário | Safras de referência | Receita média (R$/ha/ano) | Folga hídrica | Perda de solo (t/ha/ano) | Resiliência |',
  'report.calibHead': '| Cultura | Série IBGE | Tendência (kg/ha) | Preço (R$/kg) | Razão seca / típica / chuvosa |',
  'report.sources': 'Fontes',
  'report.assumptions': 'Hipóteses',
  'report.of': 'de',
  'source.ibgeName': (p: Params) => `IBGE PAM · tabela 5457${p.offline ? ' (cópia local)' : ''}`,
}

type Key = keyof typeof pt

const en: Record<Key, Entry> = {
  'common.demoFarm': 'Example farm',
  'common.help': 'Help',
  'common.home': 'TerraShift — home',
  'common.newProperty': 'New property',
  'common.continue': 'Continue',
  'common.realData': 'real data + model',
  'common.offlineIncluded': 'Includes offline data',
  'common.offlineExample': 'offline example',
  'common.offlineTitle': 'Source unavailable right now: showing example values',
  'common.language': 'Language',
  'common.zoomIn': 'Zoom in',
  'common.zoomOut': 'Zoom out',
  'common.serverDown': 'We could not reach the server.',
  'common.stepOf': (p) => `${p.n} of ${p.total} — ${p.name}`,
  'common.stepAria': (p) => `Step ${p.n} of ${p.total}`,
  'steps.0': 'Your land',
  'steps.1': 'Diagnosis',
  'steps.2': 'Goals',
  'steps.3': 'Futures',

  'src.satellite': 'Satellite observation',
  'src.regional': 'Regional data',
  'src.estimate': 'Estimate',
  'src.user': 'Provided by you',

  'crop.soja': 'Soybean',
  'crop.milho': 'Maize',
  'crop.cobertura': 'Cover crop',
  'cropShort.soja': 'Soybean',
  'cropShort.milho': 'Maize',
  'cropShort.cobertura': 'Cover',
  'role.cover': 'Protects and restores the soil between seasons.',
  'role.maizeAfterSoy': 'Uses the nitrogen left by the soybean.',
  'role.maizeAfterCover': 'Planted on straw that keeps moisture in.',
  'role.maizeAfterMaize': 'Maize again: more revenue, more soil wear.',
  'role.maize': 'The crop with the highest revenue potential.',
  'role.soyAfterCover': 'Planted on straw and fixes nitrogen.',
  'role.soyAfterSoy': 'Soybean again: simple, but favours pests and diseases.',
  'role.soy': 'Fixes nitrogen and opens the cycle with good liquidity.',

  'strategy.atual': 'Current rotation',
  'strategy.retorno': 'Highest return',
  'strategy.equilibrada': 'Balanced',
  'strategy.resiliencia': 'Most resilient',
  'strategy.sustentavel': 'Most sustainable',
  'tagline.atual': 'Soybean every year.',
  'tagline.retorno': 'More revenue, more exposed soil.',
  'tagline.equilibrada': 'Two cash crops and one soil-protection season.',
  'tagline.resiliencia': 'Straw before maize: less erosion.',
  'tagline.sustentavel': 'Puts soil protection first.',
  'strategy.chip': (p) => `${String(p.name).charAt(0).toUpperCase()}${String(p.name).slice(1)} strategy`,

  'scenario.seco': 'Dry year',
  'scenario.tipico': 'Typical year',
  'scenario.chuvoso': 'Wet year',

  'objective.lucro.title': 'Earn more',
  'objective.lucro.desc': 'Prioritise economic return.',
  'objective.solo.title': 'Care for the land',
  'objective.solo.desc': 'Prioritise soil conservation.',
  'objective.seguranca.title': 'Be safer',
  'objective.seguranca.desc': 'Reduce climate-related risks.',
  'objective.equilibrio.title': 'Balance it all',
  'objective.equilibrio.desc': 'Combine return, conservation and safety.',

  'map.s2Caption': 'Imagery: Copernicus Sentinel-2 (EOX s2cloudless) · 10 m',
  'map.ndvi': 'NDVI · MODIS Terra 16-day · 250 m',
  'map.smap': 'Soil moisture · SMAP L4 · ~9 km',
  'map.srtm': 'Elevation · SRTM · 30 m',

  'landing.how': 'How it works',
  'landing.tech': 'Technology',
  'landing.about': 'About',
  'landing.cta': 'Explore my land',
  'landing.demo': 'Try the demo',
  'landing.eyebrow': 'Agricultural intelligence from space data',
  'landing.title': 'What if you could see the future of your land?',
  'landing.desc': 'Explore different cropping strategies, anticipate climate risks and discover new possibilities for your farm.',
  'landing.note': 'No sign-up. Start from the map.',
  'landing.visualAria': 'Illustrative comparison between today and a future scenario',
  'landing.heroAlt': 'Aerial view of crop fields in the Cerrado',
  'landing.today': 'TODAY',
  'landing.future': '2029 · SCENARIO',
  'landing.climate': 'Climate',
  'landing.typicalYear': 'Typical year',
  'landing.soilWater': 'Soil water',
  'landing.stableMoisture': 'Stable moisture',
  'landing.cover': 'Vegetation cover',
  'landing.coverNote': 'Protected soil in 2029',
  'landing.rangeToday': 'Today',
  'landing.rangeAria': 'Compare today and 2029',
  'landing.stripLead': 'Open Earth observation data',
  'landing.stripSat': 'Satellites: Sentinel-2 · MODIS',
  'landing.stripClimate': 'Climate: NASA POWER',
  'landing.stripSoil': 'Soil and water: SMAP · SRTM · SoilGrids',
  'landing.stripYield': 'Production: IBGE PAM',

  'select.page': 'Your land',
  'select.title': 'Where is your land?',
  'select.lead': "Let's start by finding your property on the map.",
  'select.search': 'Type a city or place',
  'select.searchAria': 'Search place',
  'select.draw': 'Draw the area on the map',
  'select.drawSub': "Click the field's corners",
  'select.demo': 'Use the example farm',
  'select.demoSub': 'Fazenda Horizonte · Cerrado',
  'select.needPoints': (p) => `Mark at least 3 points (${p.n}/3)`,
  'select.points': (p) => `${p.n} points · ${p.ha} ha`,
  'select.undo': 'Undo',
  'select.finish': 'Finish area',
  'select.selected': 'Selected area',
  'select.redraw': 'Redraw area',
  'select.area': 'Area',
  'select.region': 'Region',
  'select.demoField': 'Example field',
  'select.analyze': 'Analyse my land',
  'select.analyzing': 'Analysing…',
  'select.drawHint': "Click on the map to mark the area's corners",
  'select.progressTitle': 'Fetching environmental information',
  'select.step.climate': 'Fetching climate',
  'select.step.soil': 'Analysing soil and terrain',
  'select.step.yield': 'Fetching municipal yields',
  'select.serverDown': 'Server unavailable. Check that the API is running.',
  'select.myProperty': 'My property',
  'select.drawnRegion': 'Area drawn on the map',
  'select.demoRegion': 'Brazilian Cerrado · western Bahia',

  'diag.page': 'Diagnosis',
  'diag.title': 'Get to know your land.',
  'diag.lead': 'We combine environmental information to understand the conditions in your region.',
  'diag.layer.real': 'True colour',
  'diag.layer.agua': 'Water',
  'diag.layer.vegetacao': 'Vegetation',
  'diag.layer.solo': 'Soil',
  'diag.layer.relevo': 'Terrain',
  'diag.layersAria': 'Map layers',
  'diag.soilCaption': (p) => `Soil: ${p.texture} · SoilGrids 250 m (centre point)`,
  'diag.reliefCaption': (p) => `Elevation · SRTM · 30 m · mean slope ${p.slope}%`,
  'diag.rain': 'Rainfall history',
  'diag.perYear': '/year',
  'diag.rainAria': 'Mean monthly rainfall',
  'diag.rainNote': 'Monthly mean 2001–2025, in mm',
  'diag.temp': 'Temperature',
  'diag.mean': 'mean',
  'diag.tempNote': (p) => `Monthly mean from ${p.min} to ${p.max} °C`,
  'diag.veg': 'Vegetation',
  'diag.vegNote': 'Latest vegetation index (NDVI), 16-day composite. See it in the layer',
  'diag.little': 'Low',
  'diag.lots': 'High',
  'diag.soil': 'Soil',
  'diag.soilLayer': (p) => `${p.clay}% clay · ${p.sand}% sand`,
  'diag.soilNote': 'Model estimate: confirm with a local soil test.',
  'diag.next': 'Next step',
  'diag.insight': "Let's explore which cropping strategies could work best for this land.",
  'diag.insightNote': (p) => `Each strategy will be tested against ${p.n} real rainy seasons (NASA POWER) and soybean and maize yields in ${p.place} (IBGE).`,
  'diag.explore': 'Explore possibilities',
  'months.short': 'J,F,M,A,M,J,J,A,S,O,N,D',
  'months.long': 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec',
  'texture.Muito argiloso': 'Very clayey',
  'texture.Argiloso': 'Clayey',
  'texture.Arenoso': 'Sandy',
  'texture.Franco-arenoso': 'Sandy loam',
  'texture.Franco (médio)': 'Loam (medium)',

  'obj.page': 'Goals',
  'obj.title': 'What do you want for the future of your land?',
  'obj.lead': "There is no single perfect choice. Let's find the options that make the most sense for you.",
  'obj.aria': 'Goal',
  'obj.recentQ': 'What was planted recently?',
  'obj.recentNote': "Helps us understand the field's history.",
  'obj.recentAria': 'Recent crop',
  'obj.recent.soja': 'Soybean',
  'obj.recent.milho': 'Maize',
  'obj.recent.outra': 'Another crop',
  'obj.recent.naosei': "I don't know",
  'obj.back': 'Back to diagnosis',
  'obj.simulate': 'Simulate my futures',
  'obj.simulating': 'Simulating…',

  'lab.page': 'Futures Lab',
  'lab.compare': 'Compare results',
  'lab.title': 'Explore different futures',
  'lab.lead': "See how crop choices and climate conditions can change your land's results.",
  'lab.strategy': 'Strategy',
  'lab.yourGoal': 'Your goal',
  'lab.applied': 'New strategy applied',
  'lab.climate': 'Climate scenario',
  'lab.analog.seco': 'Seasons with a strong dry spell',
  'lab.analog.tipico': 'Seasons with a moderate dry spell',
  'lab.analog.chuvoso': 'Seasons without a dry spell',
  'lab.analogNote': (p) => `${p.kind} (driest month Nov–Mar, NASA POWER): ${p.years}.`,
  'lab.crops': 'Crops in the plan',
  'lab.dataNote': 'Computed with NASA POWER, IBGE PAM, SoilGrids and SRTM. Gross revenue: production costs not included.',
  'lab.scenarioChip': (p) => `Scenario: ${p.name}`,
  'lab.seasonRain': (p) => `${p.year} · season rain ${p.mm} mm`,
  'lab.illustration': 'Illustration · Sentinel-2 base',
  'lab.whatIf': 'What if the climate changes?',
  'lab.prevYear': 'Previous year',
  'lab.nextYear': 'Next year',
  'lab.yearAria': 'Simulation year',
  'lab.results': 'Results for this future',
  'lab.thisFuture': 'this future',
  'lab.current': 'current rotation',
  'lab.diffCurrent': 'Difference from the current rotation',
  'lab.about': (p) => `About ${p.name}`,
  'lab.revenue': 'Estimated gross revenue',
  'lab.revenueCaption': (p) => `${p.yield} kg/ha × R$ ${p.price}/kg · IBGE PAM ${p.place}`,
  'lab.revenueNone': 'A cover crop has no direct revenue',
  'lab.revenueTip': (p) => `Municipal trend yield (IBGE PAM ${p.years}) adjusted by the mean performance in analog seasons, × mean implied price of the last 3 years. Gross revenue: costs not included.`,
  'lab.water': 'Water demand',
  'lab.waterUnit': (p) => `${p.etc} of ${p.pe} mm`,
  'lab.waterDeficit': (p) => `Deficit of ${p.mm} mm · FAO-56 with NASA POWER`,
  'lab.waterOk': 'Effective rain covers the need · FAO-56 with NASA POWER',
  'lab.waterTip': 'Crop evapotranspiration over the cycle (FAO-56 Penman–Monteith with NASA POWER data × Kc) compared with the effective rain (USDA-SCS) of the analog seasons.',
  'lab.level.water': 'Low,Medium,High',
  'lab.soil': 'Estimated soil loss',
  'lab.soilUnit': 't/ha/yr',
  'lab.soilCaption': (p) => `RUSLE · SoilGrids soil, SRTM slope ${p.slope}%, NASA POWER rain`,
  'lab.soilTip': (p) => `Bar = soil protection by cover (1 − C factor). Loss = R ${p.r} × K ${p.k} × LS ${p.ls} × C.`,
  'lab.risk': 'Climate risk',
  'lab.riskValue': (p) => `${p.n} of ${p.total}`,
  'lab.riskUnit': (p) => `seasons with crop failure · ${p.level}`,
  'lab.noHarvest': 'No harvest',
  'lab.level.risk': 'low risk,moderate risk,high risk',
  'lab.riskCaption': (p) => `Failure = yield ${p.pct}% below trend · IBGE PAM × NASA POWER`,
  'lab.riskTip': (p) => `In how many seasons similar to this scenario (${p.years}) the municipal yield fell ${p.pct}% or more below trend.`,

  'cmp.page': 'Comparison',
  'cmp.title': 'Which future suits you best?',
  'cmp.hint': 'Tap a future to choose it',
  'cmp.strategiesAria': 'Strategies',
  'cmp.row.revenue': 'Revenue',
  'cmp.row.water': 'Water',
  'cmp.row.soil': 'Soil',
  'cmp.row.climate': 'Climate',
  'cmp.tip.revenue': 'Mean gross revenue per hectare per year (IBGE PAM)',
  'cmp.tip.water': 'Water margin: 50 = effective rain equals the crop need',
  'cmp.tip.soil': 'Mean soil loss (t/ha/yr, RUSLE); bar = protection',
  'cmp.tip.climate': '100 − % of analog seasons with crop failure',
  'cmp.today': 'Today · current rotation',
  'cmp.twoFutures': 'Same land, two futures',
  'cmp.soilText': (p) => `In 2029, with the ${p.name} strategy, estimated soil loss is ${p.loss} t/ha, versus ${p.base} t/ha if the current rotation continues.`,
  'cmp.note': 'RUSLE with SoilGrids, SRTM and NASA POWER · Sentinel-2 base imagery',
  'cmp.seePlan': (p) => `See plan · ${p.name}`,
  'cmp.adjust': 'Adjust in the lab',

  'plan.page': 'My farm plan',
  'plan.title': 'Your plan for the coming years.',
  'plan.revenue': 'Mean gross revenue in a typical season',
  'plan.perHaYear': '/ha/yr',
  'plan.soil': (p) => `Estimated soil loss (current rotation: ${p.base} t)`,
  'plan.seasons': 'seasons',
  'plan.risk': (p) => `Dry-spell seasons in which ${p.crop} yield failed`,
  'plan.noHarvest': 'No cash crop exposed to dry spells',
  'plan.how': 'How did we compute these results?',
  'plan.confidence': 'Confidence',
  'plan.conf.moderate': 'Moderate',
  'plan.conf.low': 'Low',
  'plan.calib': (p) => `Calibrated with ${p.place} (${p.level}, ${p.source})`,
  'plan.level.município': 'municipality',
  'plan.level.estado': 'state',
  'plan.th.crop': 'Crop',
  'plan.th.series': 'Series',
  'plan.th.trend': 'Trend',
  'plan.th.price': 'Price',
  'plan.th.dry': 'Dry seasons',
  'plan.th.typical': 'Typical',
  'plan.th.wet': 'Wet',
  'plan.trend': (p) => `${p.y} kg/ha (+${p.g}/yr)`,
  'plan.ratio': (p) => `${p.pct}% of trend · ${p.loss}/${p.n} failures`,
  'plan.soilCalib': (p) => `Soil (RUSLE): K ${p.k} · LS ${p.ls} (slope ${p.slope}%, slope length ${p.len} m) · typical R ${p.r} MJ·mm/ha·h·yr. ET₀ Nov–Mar: ${p.et0} mm.`,
  'plan.data': 'Data used',
  'plan.assumptions': 'Assumptions and limitations',
  'plan.disclaimer': 'Estimates from small samples (8–9 seasons per scenario): they do not replace local agronomic advice nor guarantee results.',
  'plan.back': 'Back to the simulator',
  'plan.compare': 'Compare another strategy',
  'plan.export': 'Export report',
  'plan.file': 'plan',

  'source.powerClimate': (p) => `Rain, temperature, humidity, wind and radiation · climatology ${p.period}`,
  'source.powerRain': 'Monthly rain 2000–2025 → dry, typical and wet seasons',
  'source.ibge': (p) => `Soybean and maize yield, area and production value · ${p.place} (${p.level})`,
  'source.soilgrids': 'Texture and organic carbon · 250 m',
  'source.srtm': (p) => `Elevation and slope (${p.slope}%) · 30 m`,
  'source.modis': 'Vegetation layer, 16-day composite · NASA GIBS',
  'source.smap': 'Root-zone soil moisture · ~9 km · NASA GIBS',
  'source.s2': 'Cloud-free base imagery (EOX s2cloudless) · 10 m',

  'assume.scenarios': 'Scenarios: driest month between November and March (dry spell), in terciles of the series. Each scenario uses the mean monthly rain of the seasons in that tercile.',
  'assume.revenue': (p) => `Gross revenue = yield trend for ${p.place} (IBGE PAM, up to ${p.last}) × mean ratio observed in analog seasons × mean implied price of the 3 most recent years. Production costs not included.`,
  'assume.risk': (p) => `Climate risk = share of analog seasons in which yield was ${p.pct}% or more below trend.`,
  'assume.water': 'Water = crop evapotranspiration (FAO-56 Penman–Monteith with NASA POWER data × FAO Kc for a November sowing) compared with the effective rain (USDA-SCS) of the scenario. In the water-margin index, 50 means effective rain equals the crop need.',
  'assume.soil': (p) => `Soil = RUSLE: erosivity R (Lombardi Neto, NASA POWER rain), erodibility K (Williams, SoilGrids), LS with SRTM slope of ${p.slope}% and ${p.len} m slope length, reference no-till C factor (soybean 0.20; maize 0.12; cover 0.04; straw lowers the next crop's C by 30%).`,
  'assume.season': 'One main season per year (October to March); second crop and irrigation not modelled. Cover crops have no direct revenue.',

  'report.title': (p) => `Rotation plan — ${p.name}`,
  'report.area': (p) => `Area: ${p.ha} ha · ${p.region}`,
  'report.strategy': (p) => `Strategy: ${p.name} (${p.seq})`,
  'report.disclaimer': 'Estimates computed from public data (NASA POWER, IBGE PAM, SoilGrids, SRTM). They do not replace local agronomic advice nor guarantee results. Gross revenue: production costs not included.',
  'report.rotation': 'Rotation 2027–2029 (typical season)',
  'report.rotationHead': '| Year | Crop | Yield (kg/ha) | Gross revenue (R$/ha) | ETc / effective rain (mm) | Soil loss (t/ha) | Analog seasons with failure |',
  'report.byScenario': 'Summary by climate scenario',
  'report.byScenarioHead': '| Scenario | Reference seasons | Mean revenue (R$/ha/yr) | Water margin | Soil loss (t/ha/yr) | Resilience |',
  'report.calibHead': '| Crop | IBGE series | Trend (kg/ha) | Price (R$/kg) | Ratio dry / typical / wet |',
  'report.sources': 'Sources',
  'report.assumptions': 'Assumptions',
  'report.of': 'of',
  'source.ibgeName': (p) => `IBGE PAM · table 5457${p.offline ? ' (local copy)' : ''}`,
}

const DICTS: Record<Lang, Record<Key, Entry>> = { pt, en }

// ------------------------------------------------------------------ number formatting

let LOCALE = 'pt-BR'
let LANG: Lang = 'pt'

const nf = (opts: Intl.NumberFormatOptions) => new Intl.NumberFormat(LOCALE, opts)
export const fmtInt = (v: number) => nf({ maximumFractionDigits: 0 }).format(v)
export const fmtDec = (v: number) => nf({ maximumFractionDigits: 2 }).format(v)
export const fmtNum = (v: number, digits: number) => nf({ maximumFractionDigits: digits }).format(v)
export const fmtOne = (v: number) => nf({ minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)
export const fmtPrice = (v: number) => nf({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
/** R$ 8.630 → "8,6 mil" (pt) / "8.6k" (en) */
export const brlMil = (v: number) => (LANG === 'pt' ? `${fmtOne(v / 1000)} mil` : `${fmtOne(v / 1000)}k`)

// ------------------------------------------------------------------ context

export type T = (key: Key, params?: Params) => string

function translate(lang: Lang): T {
  return (key, params) => {
    const e = DICTS[lang][key] ?? pt[key]
    if (e === undefined) return key
    return typeof e === 'function' ? e(params ?? {}) : e
  }
}

const STORAGE_KEY = 'terrashift-lang'

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'pt' || saved === 'en') return saved
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && !navigator.language.toLowerCase().startsWith('pt') ? 'en' : 'pt'
}

function applyLang(lang: Lang) {
  LANG = lang
  LOCALE = lang === 'pt' ? 'pt-BR' : 'en-US'
}

interface Ctx {
  lang: Lang
  setLang: (l: Lang) => void
  t: T
}

const I18nCtx = createContext<Ctx | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = initialLang()
    applyLang(l)
    return l
  })
  const setLang = useCallback((l: Lang) => {
    applyLang(l)
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* storage unavailable */
    }
  }, [])
  useEffect(() => {
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en'
  }, [lang])
  const value = useMemo<Ctx>(() => ({ lang, setLang, t: translate(lang) }), [lang, setLang])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useI18n() {
  const c = useContext(I18nCtx)
  if (!c) throw new Error('useI18n outside provider')
  return c
}

export function currentLang(): Lang {
  return LANG
}
