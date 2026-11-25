# Reels Lab — Guia de Arquitetura e Regras para Desenvolvimento (Antigravity)

> Leia este arquivo sempre que abrir o projeto em um novo computador para manter continuidade total sem depender do histórico local de outro PC.

## 1. Visão Geral
- **App**: **Reels Lab** — PWA estático em HTML/CSS/ES Modules (zero build, compatível com GitHub Pages).
- **Estética**: Minimalista estilo Apple (glassmorphism claro/escuro com cantos arredondados e gradiente roxo suave nos botões principais).
- **Persistência**: IndexedDB (`ReelsLabDB`) com espelho em `localStorage` (`reels_lab_fallback_v1`) + sincronização bidirecional opcional com Google Drive via Google Apps Script (`google-apps-script.gs`).
- **PWA / Ícones**: Ícones PNG pretos minimalistas (`favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`). Não recriar `icon.svg`. No topo do app não há ícone ao lado de *Reels Lab Studio*.

## 2. Mapa de Arquivos
- `index.html`: Estrutura completa das 6 abas (`tab-creator`, `tab-radar`, `tab-factory`, `tab-club`, `tab-library`, `tab-planner`) e modais (`aiModal`, `driveModal`, `coverExportModal`).
- `styles.css`: Tema claro/escuro, responsividade mobile e estilos do Portal Google News, X Trends, prévia inline nas pastas e tabela de Rate Limits.
- `sw.js`: Service Worker (`CACHE_NAME = 'reels-lab-v14'`). **Sempre incrementar a versão (`v15`, `v16`...) quando editar HTML/CSS/JS.**
- `manifest.json`: Metadados PWA.
- `google-apps-script.gs`: Backend gratuito na conta Google do usuário. **Sempre orientar atualizar no `script.google.com` e publicar "Nova versão" quando esse arquivo mudar.**
- `js/data-professions.js`: Modelos estruturais (`SERIES_MODELS`), Código Viral (`VIRAL_CODE`), catálogo das 33 profissões (`PROFESSIONS`) e Guia Destrava (`EXTRA_1_FAQ`).
- `js/storage.js`: Persistência IndexedDB/localStorage + helpers de backup e sincronização bidirecional com Drive (`syncToGoogleDrive`, `loadFromGoogleDrive`, `listDriveProfiles`, `loadDriveProfile`, `deleteDriveProfile`, `upsertImportedProfile`, `removeCreatorFromState`).
- `js/gemini.js`: Cliente Gemini API, telemetria local de Rate Limit (`MODEL_RATE_LIMIT_CATALOG`, `getRateLimitDashboard`, `probeModelAvailability`, `recordModelApiEvent`), Google Notícias (`fetchGoogleNewsPortal`, `fetchGoogleNewsAllCategories`), X Trends Brasil 3 dias (`fetchBrazilXTrends`, `generateAnglesFromXTrends`) e detectores (`detectBestSeriesModelId`).
- `js/cover-studio.js`: Renderização e exportação das capas 9:16 (1080×1920) em Canvas.
- `js/app.js`: Orquestração da UI, eventos, modais e fluxos entre abas.

## 3. Regras Inegociáveis do Produto
1. **Motor de IA Fixo (Nunca alternar automaticamente)**:
   - O modelo escolhido em **Configurar Gemini AI** (`state.settings.geminiModel`) deve ser usado em **todos** os recursos (Fábrica, Radar Google News, Radar X, Clube IA, Quick Fill DNA).
   - **Proibido** trocar automaticamente de modelo ou exibir contador de segundos durante o carregamento. Use apenas o spinner CSS (`.ai-spinner`) + nome do motor trabalhando.
   - Em erros transitórios (`503 high demand` ou pico breve de `429 RPM`), `callGemini` insiste com backoff exponencial (`GEMINI_RETRY_CONFIG.maxAttempts = 10`). Em erro explícito de **cota diária esgotada (`RPD` / `limit: 0`)**, falha imediatamente registrando o bloqueio na aba **📊 Limites & Uso (Rate Limit)** para o usuário trocar o motor manualmente.
2. **Radar de Trends 100% Real**:
   - **Google Notícias**: busca manchetes reais (`https://news.google.com/rss/...`) via Google Apps Script (`fetch_google_news`) + fallback CORS RSS. Nunca inventar notícias quando feeds falham. Possui caixa de busca no portal, filtros de data (`any`, `1h`, `24h`, `7d`, `1y`), categorias, seleção múltipla e links externos.
   - **𝕏 Trending Topics Brasil (3 dias)**: aba dedicada no Radar (`Hoje`, `Ontem`, `Há 2 dias`) via `fetch_x_trends` (GetDayTrends + Trends24 + fallback RSS real de repercussão no X Brasil), com busca local, link `↗ Ver no X` e multiseleção para gerar roteiros.
   - Botão **Criar na Fábrica** anexa o link de referência no Passo 2 (`f_sourceNewsUrl`), detecta automaticamente o melhor modelo estrutural (`detectBestSeriesModelId`) e deixa a pasta opcional.
3. **Perfis Bidirecionais no Google Drive**:
   - Snapshots individuais ficam em `Reels Lab - Studio/_perfis/profile_<creatorId>.json`, além do `reels-lab-database.json` mesclado e das pastas legíveis por criador/série.
   - Dentro de **Memória & Google Drive**, o usuário pode listar, resgatar qualquer perfil para o App (`load_profile`) e excluir do Drive e/ou do App (`delete_profile`).
4. **Pastas, Roteiros Avulsos e Prévia Inline**:
   - Roteiros podem ser salvos sem pasta (**Sem Pasta Definida**) e movidos/renumerados inline depois (`📁 Mover / Parte`).
   - Nas pastas, múltiplos roteiros podem ser expandidos/minimizados simultaneamente e copiados sem redirecionar para a Fábrica.

## 4. Verificação e Deploy entre Computadores
- Neste ambiente macOS (`node` e `rg` podem não estar instalados), valide sintaxe e módulos ES usando JavaScriptCore:
  `/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m <arquivo.js>`
- Verifique integridade de IDs DOM entre `index.html` e `js/app.js` com `python3`.
- **Fluxo entre computadores**: sempre dê `git pull` ao iniciar no outro PC e `git push` ao terminar; lembrar o usuário quando precisar atualizar `google-apps-script.gs` no Apps Script ("Nova versão") e quais arquivos enviar ao GitHub.
