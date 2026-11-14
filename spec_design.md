# TerraShift — Especificação de Design UI/UX
**Projeto:** TerraShift — Agricultural Future Simulator  
**Entregável:** Protótipo de alta fidelidade no Pencil  
**Plataformas:** Web responsiva (desktop-first) e mobile  
**Idioma da interface:** Português brasileiro  
**Estilo:** Geospatial SaaS, Climate Tech, Scientific Storytelling

---

## 1. Visão do produto

Criar o design de uma aplicação web chamada **TerraShift**, uma plataforma inteligente que utiliza dados de satélites da NASA, informações climáticas, características do solo e simulações agrícolas para ajudar produtores a explorar diferentes estratégias de rotação de culturas.

A proposta central é permitir que qualquer pessoa visualize e compare possíveis futuros de uma propriedade rural.

**Tagline:** "O futuro da sua terra começa nas escolhas de hoje."

O produto não deve parecer um software agrícola tradicional, um painel administrativo ou um ERP.

A experiência deve lembrar uma combinação de:

- Google Earth — exploração geográfica intuitiva.
- Apple Weather — apresentação elegante de informações ambientais.
- Linear — precisão visual, acabamento e qualidade dos componentes.
- Arc Browser — interface contemporânea e fluida.
- Simuladores interativos — experimentação de cenários em tempo real.

### Princípios de experiência

1. **Visual first:** priorizar imagens, mapas, linhas do tempo e visualizações.
2. **Progressive disclosure:** apresentar informações complexas apenas quando necessárias.
3. **One decision at a time:** cada etapa deve exigir poucas decisões.
4. **Show, don't tell:** demonstrar resultados visualmente, evitando explicações extensas.
5. **Scientific transparency:** diferenciar observações reais, estimativas, hipóteses e projeções.

O usuário nunca deve precisar conhecer conceitos como NDVI, GPM, SMAP ou otimização multiobjetivo para utilizar o aplicativo.

---

## 2. Design System

### 2.1. Identidade visual

Criar uma identidade sofisticada, contemporânea e acolhedora, inspirada em agricultura, natureza, observação da Terra e tecnologia científica.

**Paleta:**

| Token | Cor | Aplicação |
|---|---|---|
| Forest 900 | #153E2F | Cor principal, header, títulos e fundos escuros |
| Forest 700 | #245A43 | Elementos interativos e estados ativos |
| Lime 400 | #A8D66D | Destaques, botões e seleção |
| Sand 50 | #F6F5EE | Fundo principal |
| Earth 400 | #D9A65E | Informações relacionadas a solo |
| Sky 400 | #75B9DF | Água e dados climáticos |
| Surface | #FFFFFF | Cartões e painéis |
| Ink | #1C2923 | Texto principal |
| Muted | #728078 | Texto secundário |
| Border | #E2E8DF | Bordas discretas |

Utilizar vermelho e amarelo de alerta apenas quando houver informações de risco ou avisos relevantes.

O verde deve transmitir tecnologia ambiental, sem recorrer a uma estética infantil ou exageradamente orgânica.

### 2.2. Tipografia

- Fonte principal: **Manrope**
- Fonte alternativa: Inter
- H1: 56–64 px, semibold, line-height 1.08
- H2: 36–40 px, semibold
- H3: 24–28 px, semibold
- Card title: 18–20 px, semibold
- Body: 15–16 px, regular
- Caption: 12–13 px
- Dados numéricos: 28–40 px, semibold, tabular numbers

Utilizar textos curtos, linguagem simples e espaçamento generoso.

### 2.3. Layout

Desktop:
- Frame: 1440 × 900 px
- Grid de 12 colunas
- Container de até 1280 px
- Margens de 64–80 px
- Gutter: 24 px
- Header: 72 px
- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 px

Mobile:
- Frame: 390 × 844 px
- Margens laterais de 20 px
- Cards de largura total
- Navegação simplificada
- Bottom sheets sobre mapas
- Botões com área de toque mínima de 44 × 44 px

### 2.4. Componentes

Criar componentes reutilizáveis e editáveis:

- Header / App Navigation
- Primary Button / Secondary Button / Ghost Button
- Progress Stepper
- Satellite Map Container
- Map Layer Selector
- Environmental Metric Card
- Crop Card
- Objective Selection Card
- Timeline Slider
- Climate Scenario Selector
- Strategy Result Card
- Confidence / Data Source Label
- Comparison Metric
- Tooltip
- Bottom Sheet
- Floating Action Panel
- Loading Skeleton
- Empty State
- Error State
- Insight Card

**Estilo dos componentes:**

- Cards: 16–20 px de border-radius
- Botões: 12 px de border-radius
- Bordas finas e discretas
- Sombras suaves, nunca pesadas
- Ícones Lucide, consistentes e minimalistas
- Transições de 200–350 ms
- Imagens reais de satélite quando disponíveis; imagens conceituais claramente identificadas

---

# 3. Fluxo principal

Criar sete telas desktop, organizadas lado a lado no canvas, seguindo a jornada:

**Landing → Seleção de área → Diagnóstico → Objetivos → Simulação → Comparação → Plano agrícola**

Desenhar as telas com dados fictícios, mas plausíveis, da seguinte propriedade de demonstração:

**Fazenda Horizonte**
- Região: Cerrado brasileiro
- Área hipotética: 120 hectares
- Objetivo inicial: equilibrar lucro, saúde do solo e risco climático
- Horizonte: 2027–2029
- Culturas ilustrativas: soja, milho e culturas de cobertura

Todos os indicadores quantitativos simulados devem ser identificados como "Dados de demonstração". Não apresentar métricas fictícias como se tivessem sido obtidas efetivamente da NASA.

---

# 4. Tela 01 — Landing Page

**Frame:** `01 - Landing`  
**Dimensão:** 1440 × 900

### Objetivo

Criar um momento de encantamento imediato, comunicando que a plataforma permite explorar os futuros possíveis de uma fazenda.

### Layout

**Header superior:**
- Logotipo TerraShift à esquerda.
- Navegação: "Como funciona", "Tecnologia", "Sobre".
- Botão no canto direito: "Explorar minha terra".
- Header com fundo claro ou transparente.

**Hero Section:**
Layout dividido em duas áreas.

Lado esquerdo — aproximadamente 45% da largura:
- Eyebrow: "INTELIGÊNCIA AGRÍCOLA COM DADOS ESPACIAIS"
- Título grande:

  "E se você pudesse ver o futuro da sua terra?"

- Descrição:

  "Explore diferentes estratégias de cultivo, antecipe riscos climáticos e descubra novas possibilidades para sua propriedade."

- Botão primário: "Explorar minha terra"
- Botão secundário: "Experimentar demonstração"
- Pequena mensagem: "Sem cadastro. Comece pelo mapa."

Lado direito — aproximadamente 55% da largura:
- Imagem aérea cinematográfica de campos agrícolas.
- Sobreposição de linhas sutis delimitando talhões.
- Pequenos elementos flutuantes representando clima, água e cobertura vegetal.
- Um controle discreto com a inscrição "Hoje → 2029".
- Aparência de produto interativo, não de imagem publicitária genérica.

### Detalhe especial

A hero deve sugerir uma transição entre dois estados de uma propriedade agrícola, com uma linha divisória que representa o presente e um cenário futuro.

Se possível, criar um mockup com a linha de comparação na metade da imagem.

### Sensação desejada

Imersivo, tecnológico, confiável e inspirador.

---

# 5. Tela 02 — Encontre sua terra

**Frame:** `02 - Seleção de Área`  
**Dimensão:** 1440 × 900

### Objetivo

Permitir que o usuário selecione uma propriedade diretamente em um mapa.

### Layout

**Header de aplicação:**
- Logotipo TerraShift
- Progresso: "1 de 4 — Sua terra"
- Ícone de ajuda

**Área central:**
- Mapa de satélite ocupando aproximadamente 75% da largura.
- Mapa com aparência realista, grande e visualmente dominante.
- Um polígono verde-lima delimitando um talhão.
- Pequenos controles de zoom no canto inferior direito.
- Ferramenta flutuante de seleção.

**Painel lateral esquerdo (aproximadamente 350 px):**
- Título: "Onde fica sua terra?"
- Descrição: "Vamos começar encontrando sua propriedade no mapa."
- Campo de busca: "Digite uma cidade ou localização"
- Opção: "Desenhar área no mapa"
- Opção: "Usar fazenda de exemplo"

Depois de selecionar:
- Card "Área selecionada"
- Nome: Fazenda Horizonte
- Área: 120 ha
- Região: Cerrado brasileiro
- Botão: "Analisar minha terra"

### Detalhe especial

A área selecionada deve ter um contorno verde-lima de 3 px e preenchimento translúcido.

A interface deve transmitir a sensação de que o usuário está explorando a Terra com uma ferramenta de observação espacial.

### Estados

1. Nenhuma área selecionada.
2. Área sendo desenhada.
3. Área selecionada.
4. Análise em andamento.

Na etapa de análise, exibir uma animação discreta de varredura sobre o mapa e mensagens como "Consultando informações ambientais".

---

# 6. Tela 03 — Raio-X da sua terra

**Frame:** `03 - Diagnóstico`  
**Dimensão:** 1440 × 900

### Objetivo

Apresentar informações ambientais de forma compreensível, criando a impressão de que o aplicativo está revelando características invisíveis da propriedade.

### Layout

Header:
- Breadcrumb: "Sua terra / Diagnóstico"
- Nome da propriedade
- Botão: "Continuar"

**Título:**
"Conheça sua terra."

Subtítulo:
"Combinamos informações ambientais para entender as condições da sua região."

**Área principal:**
Layout de aproximadamente 65% mapa e 35% painel de dados.

Mapa:
- Imagem de satélite grande.
- Contorno da propriedade.
- Seletor horizontal de camadas sobreposto na parte inferior.

Camadas:
1. Visão real
2. Água
3. Vegetação
4. Solo

Cada camada deve alterar a representação visual sobre o mapa.

Painel direito:
Quatro cards compactos.

**Card 1 — Chuva**
- Ícone de nuvem com chuva
- Título: "Histórico de chuva"
- Mini gráfico de precipitação
- Texto: "Padrões históricos da região"

**Card 2 — Temperatura**
- Ícone de termômetro
- Mini gráfico de variação
- Texto: "Condições ao longo do ano"

**Card 3 — Vegetação**
- Ícone de folha
- Sparkline de evolução da vegetação
- Texto: "Mudanças observadas na cobertura"

**Card 4 — Solo**
- Ícone de camadas
- Texto: "Características estimadas"
- Nota: "Pode exigir análise local para maior precisão"

### Insight principal

Card de destaque ao final do painel:

"Vamos explorar quais estratégias de cultivo podem funcionar melhor para esta terra."

Botão: "Explorar possibilidades"

### Regras de confiabilidade

Os cards devem possuir pequenos rótulos de origem:
- Observado por satélite
- Dado regional
- Estimativa
- Informado pelo usuário

As diferentes camadas precisam representar a mesma propriedade e manter o mesmo enquadramento geográfico.

### Detalhe especial

Uma barra deslizante de comparação "Antes / Depois" pode revelar duas camadas ambientais sobre o mesmo mapa, criando uma interação visual impactante.

---

# 7. Tela 04 — Escolha seus objetivos

**Frame:** `04 - Objetivos`  
**Dimensão:** 1440 × 900

### Objetivo

Traduzir a otimização multiobjetivo em uma pergunta simples.

### Layout

Tela clean, com fundo Sand 50 e conteúdo centralizado em largura máxima de 960 px.

**Título:**
"O que você deseja para o futuro da sua terra?"

**Subtítulo:**
"Não existe uma única escolha perfeita. Vamos encontrar as opções que fazem mais sentido para você."

Abaixo, criar um grid 2 × 2 com quatro cards grandes:

**Card A — Ganhar mais**
- Ícone trending-up
- Descrição: "Priorizar retorno econômico."
- Ilustração abstrata discreta de crescimento

**Card B — Cuidar da terra**
- Ícone sprout
- Descrição: "Priorizar conservação do solo."
- Ilustração abstrata com folhas

**Card C — Ter mais segurança**
- Ícone shield-check
- Descrição: "Reduzir riscos ligados ao clima."
- Ilustração abstrata climática

**Card D — Equilibrar tudo**
- Ícone scale
- Descrição: "Combinar retorno, conservação e segurança."
- Estado selecionado por padrão

### Comportamento visual

- Card selecionado recebe borda verde de 2 px.
- Fundo recebe tom verde muito suave.
- Aparece um check circular no topo direito.
- Interação de hover com elevação discreta.

Abaixo dos cards:
- Pergunta: "O que foi plantado recentemente?"
- Campo de seleção: Soja / Milho / Outra cultura / Não sei
- Opção de adicionar outras informações
- Botão principal: "Simular meus futuros"

Evitar formulários longos. A informação adicional deve ser solicitada somente quando indispensável para a simulação.

---

# 8. Tela 05 — Laboratório de Futuros

**Frame:** `05 - Laboratório de Futuros`  
**Dimensão:** 1440 × 900

**ESTA É A TELA MAIS IMPORTANTE DO PROJETO. DEDICAR O MAIOR NÍVEL DE REFINAMENTO VISUAL.**

### Conceito

O usuário explora o futuro da fazenda por meio de uma visualização geográfica, uma linha do tempo e cenários climáticos.

A tela deve transmitir uma sensação de exploração científica interativa.

### Layout principal

**Header — 72 px**
- Logo TerraShift
- Fazenda Horizonte
- "Laboratório de Futuros"
- Ação: "Comparar resultados"

**Coluna esquerda — 300 px**
Painel de controles.

Título:
"Explore diferentes futuros"

Descrição:
"Veja como escolhas de cultivo e condições climáticas podem transformar os resultados da sua terra."

**Seção 1: Estratégia**
- Select ou cards compactos:
  - Maior retorno
  - Mais sustentável
  - Mais resiliente
  - Equilibrada

**Seção 2: Cenário climático**
Controle de três opções com ícones:
- Ano seco — sol
- Ano típico — sol com nuvem
- Ano chuvoso — nuvem com chuva

**Seção 3: Culturas**
Pequenos chips com ícones de:
- Soja
- Milho
- Cobertura vegetal

**Centro — área visual dominante**
- Imagem aérea da propriedade.
- Contorno da área agrícola.
- Representação das culturas do cenário selecionado.
- Sombras sutis e overlays discretos.
- Pequena legenda: "Visualização ilustrativa do cenário futuro".

Sobre o mapa:
- Pequeno card flutuante: "2028 — Milho"
- Chip indicando "Cenário: Ano típico"
- Ação para ampliar mapa

**Painel direito — 280 px**
Título:
"Resultados deste futuro"

Quatro indicadores:
- Retorno econômico estimado
- Demanda de água
- Conservação do solo
- Risco climático

Cada card:
- Ícone
- Nome do indicador
- Valor ou índice ilustrativo
- Mini barra comparativa
- Tooltip explicativo

Valores devem mudar conforme o cenário selecionado, com indicadores visuais de comparação. Não inventar ganhos percentuais atribuídos à NASA.

### Linha do tempo

Criar uma timeline grande horizontal abaixo da imagem geográfica.

Anos:
2027 — 2028 — 2029

Requisitos:
- Linha com nós circulares.
- Ano ativo destacado em verde-lima.
- Slider arrastável.
- Nome da cultura de cada etapa.
- Botões discretos de anterior/próximo.
- Card indicando a cultura e o cenário selecionados.

Exemplo ilustrativo:
- 2027: Soja
- 2028: Milho
- 2029: Cobertura vegetal

### Microinterações

Ao mudar o ano:
- A representação agrícola muda.
- O nome da cultura é atualizado.
- Os indicadores são substituídos.
- O ponto ativo da timeline se desloca suavemente.

Ao selecionar "Ano seco":
- A interface mantém a área geográfica.
- Os valores simulados e indicadores de risco mudam.
- O estado climático selecionado aparece como chip sobre o mapa.

Ao selecionar outra estratégia:
- A sequência de culturas e os resultados mudam.
- Um microtexto informa: "Nova estratégia aplicada".

### Destaque especial

Criar um pequeno botão flutuante:

**"E se eu mudar o clima?"**

Ele deve abrir ou destacar o seletor climático.

Esse é um dos principais momentos de descoberta da experiência.

---

# 9. Tela 06 — Compare seus futuros

**Frame:** `06 - Comparação`  
**Dimensão:** 1440 × 900

### Objetivo

Transformar múltiplos resultados de simulação em uma decisão visual simples.

### Layout

Título:
"Qual futuro combina mais com você?"

Subtítulo:
"Compare diferentes estratégias e entenda os benefícios e os desafios de cada escolha."

### Área superior

Criar três cards grandes lado a lado.

**Estratégia 1 — Maior retorno**
- Ícone trending-up
- Sequência de culturas
- Principal vantagem
- Principal compromisso
- Botão "Explorar estratégia"

**Estratégia 2 — Equilibrada**
- Ícone scale
- Destacada visualmente como opção alinhada à preferência selecionada
- Sequência de culturas
- Principal vantagem
- Principal compromisso
- Botão "Explorar estratégia"

**Estratégia 3 — Maior resiliência**
- Ícone shield-check
- Sequência de culturas
- Principal vantagem
- Principal compromisso
- Botão "Explorar estratégia"

### Área inferior

Criar um gráfico comparativo elegante e fácil de interpretar.

Quatro critérios:
- Retorno econômico
- Economia de água
- Conservação do solo
- Resiliência climática

Preferir barras horizontais agrupadas por critério.

Utilizar valores de exemplo normalizados de 0 a 100, explicitamente identificados como índices fictícios de demonstração.

Evitar radar charts complexos.

### Comparação visual

Adicionar um segundo bloco com duas miniaturas da mesma propriedade:

**Estratégia atual** versus **Estratégia alternativa**

A comparação deve sugerir uma divisão visual do mapa com o mesmo enquadramento.

Adicionar pequenos textos que expliquem a diferença entre os cenários.

### Call to action

Botão principal:
"Ver meu plano de cultivo"

---

# 10. Tela 07 — Meu plano agrícola

**Frame:** `07 - Plano Agrícola`  
**Dimensão:** 1440 × 900

### Objetivo

Transformar a exploração em uma recomendação compreensível e acionável, sem apresentar projeções como garantias.

### Layout

**Título:**
"Seu plano para os próximos anos."

Subtítulo:
"Uma proposta de rotação construída a partir das condições conhecidas e dos objetivos selecionados."

### Card principal

Título:
"Plano de rotação — 2027 a 2029"

Criar uma timeline visual com três colunas:
- 2027 — Soja
- 2028 — Milho
- 2029 — Cobertura vegetal

Cada coluna:
- Ilustração ou fotografia da cultura
- Nome da cultura
- Ano
- Papel da cultura na estratégia
- Status de planejamento

### Área de insights

Título:
"Por que considerar esta estratégia?"

Três cards explicativos:
- Potencial econômico
- Gestão dos recursos naturais
- Comportamento em cenários climáticos

Os textos devem ser explicações curtas, fundamentadas nos indicadores que o simulador forneceu.

### Área de transparência

Card:
"Como calculamos esses resultados?"

Mostrar:
- Dados ambientais utilizados
- Parâmetros informados pelo usuário
- Hipóteses do modelo
- Nível de confiabilidade
- Limitações da simulação

### Rodapé

Botões:
- "Voltar ao simulador"
- "Comparar outra estratégia"
- "Exportar relatório"

O botão de exportação pode ser visual no protótipo, mas deverá representar um relatório de planejamento com dados e premissas.

---

# 11. Versões Mobile

Criar pelo menos três frames mobile em 390 × 844 px:

### Mobile 01 — Seleção de área
- Mapa ocupando aproximadamente 70% da altura.
- Header compacto.
- Busca flutuante.
- Painel inferior arrastável com dados da propriedade.
- CTA fixo no final do painel.

### Mobile 02 — Laboratório de Futuros
- Mapa grande ocupando a área principal.
- Header com nome da fazenda.
- Chip do ano ativo sobre o mapa.
- Timeline horizontal.
- Botão para alterar cenário climático.
- Indicadores organizados em cards horizontais roláveis.
- Controles avançados em bottom sheet.

### Mobile 03 — Comparação
- Cards de estratégias em carrossel horizontal.
- Comparativo de indicadores em lista vertical.
- Uma estratégia por vez como foco.
- Botão fixo "Ver plano".

No mobile, preservar a experiência de exploração. Não reduzir a aplicação a um conjunto de tabelas.

---

# 12. Estados de interface

Criar variantes dos componentes para:

**Loading**
- Skeletons com shimmer discreto.
- Mapa com overlay de processamento.
- Mensagens curtas: "Consultando clima", "Analisando vegetação", "Preparando cenários".

**Sem dados suficientes**
- Mensagem: "Ainda não temos informações suficientes para esta área."
- Ação: "Escolher outra região" ou "Informar dados manualmente".

**Incerteza elevada**
- Ícone informativo.
- Texto: "Esta estimativa depende de informações ainda não confirmadas."
- Ação: "Ver premissas".

**Erro**
- Mensagem clara, sem códigos técnicos.
- Ação para tentar novamente.

**Modo demonstração**
- Etiqueta discreta "Demonstração".
- Dados simulados apresentados como exemplos.
- Separação explícita entre dados ambientais observados e projeções fictícias.

---

# 13. Critérios de qualidade

O resultado deve atender aos seguintes critérios:

1. Todas as telas devem utilizar o mesmo design system.
2. Os componentes devem ser editáveis e organizados em camadas nomeadas.
3. O produto deve apresentar hierarquia visual forte.
4. A experiência deve ser compreensível para usuários sem conhecimento técnico.
5. Os mapas devem ser os elementos visuais dominantes nas telas geográficas.
6. Evitar excesso de gráficos, bordas, tabelas e blocos de texto.
7. Preferir informações contextuais a dashboards tradicionais.
8. Utilizar o mesmo enquadramento da propriedade em comparações geográficas.
9. Todos os estados selecionados devem ser visualmente claros.
10. A navegação precisa ser evidente e consistente.
11. O design deve ser responsivo e acessível.
12. Cada tela deve parecer parte de um produto real e pronto para apresentação.

---

# 14. Instruções finais para o Pencil

Crie um arquivo de design de alta fidelidade com:

- 7 frames desktop de 1440 × 900 px.
- 3 frames mobile de 390 × 844 px.
- Uma seção separada de Design System.
- Componentes reutilizáveis.
- Variantes de estado dos componentes principais.
- Conteúdo realista em português brasileiro.
- Imagens de campos agrícolas e satélite adequadas ao contexto.
- Mapas de aparência geográfica convincente.
- Espaçamento, alinhamentos e tipografia consistentes.
- Elementos vetoriais e textos editáveis, não screenshots de interfaces inteiras.

Organize os frames no canvas na ordem da jornada do usuário.

**Prioridade de design:**
1. Laboratório de Futuros.
2. Seleção de área.
3. Comparação.
4. Diagnóstico.
5. Landing.
6. Objetivos.
7. Plano agrícola.

A tela "Laboratório de Futuros" deve ser a mais impressionante, refinada e inovadora do conjunto.

**Restrições visuais:**

- Não criar um ERP agrícola.
- Não usar dashboards genéricos com sidebar e dezenas de métricas.
- Não utilizar estética excessivamente futurista ou neon.
- Não sobrecarregar as interfaces com textos técnicos.
- Não apresentar dados demonstrativos como medições reais.
- Não substituir mapas por ilustrações abstratas em telas que precisam representar uma propriedade.
- Não utilizar gráficos sem contexto ou unidades.

**Resultado esperado:**

Um produto de Climate Tech visualmente sofisticado, intuitivo e memorável, capaz de impressionar em uma demonstração de hackathon.

O usuário deve sentir que está explorando os possíveis futuros da própria terra, e não operando um software complexo.

**Direção criativa final:**

"Transforme dados científicos complexos em uma experiência geográfica interativa, onde o futuro da agricultura pode ser explorado com a simplicidade de deslizar o dedo por uma linha do tempo."
