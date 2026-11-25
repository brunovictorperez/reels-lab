/**
 * Motor de Inteligência Artificial do Reels Lab (Google Gemini API + Modo Offline Inteligente)
 * Combina as regras do "Meu Modelo de Reels" (Leislin) + "Código Viral" + "DNA do Criador".
 */

import { SERIES_MODELS, VIRAL_CODE } from './data-professions.js';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function buildCreatorContext(creator) {
  if (!creator) return 'Criador genérico de conteúdo no Instagram.';
  return [
    `CRIADOR: ${creator.name} (${creator.handle || '@perfil'})`,
    `NICHO / PROFISSÃO: ${creator.niche}`,
    `POSICIONAMENTO: ${creator.positioning}`,
    `PÚBLICO-ALVO / PERSONA: ${creator.audience} (Prefixo de identificação: "${creator.targetGroupPrefix || 'A pessoa que'}")`,
    `PRINCIPAIS DORES DO PÚBLICO:\n${creator.pains}`,
    `MAIORES DESEJOS DO PÚBLICO:\n${creator.desires}`,
    `OBJEÇÕES COMUNS:\n${creator.objections}`,
    `COMUNICAÇÃO E TOM DE VOZ: Usar pronome "${creator.pronoun || 'você'}". Estilo: ${creator.tone}.`,
    `PALAVRAS PROIBIDAS (NUNCA USAR): ${creator.forbiddenWords || 'oi gente tudo bem'}`,
    `PRODUTO / SERVIÇO / CTA: ${creator.product} | Palavra-chave Direct/ManyChat: ${creator.manychatKeyword || 'EUQUERO'}`,
    `IDENTIDADE VISUAL DAS CAPAS: Cor ${creator.brandColor || '#EC4899'} | Estilo: ${creator.visualStyle || 'Moderno e limpo'}`
  ].join('\n');
}

function cleanJsonResponse(text) {
  let cleaned = String(text || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error('A resposta da IA não veio em JSON válido.');
  }
  const start = (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) ? firstBracket : firstBrace;
  const endChar = start === firstBracket ? ']' : '}';
  const end = cleaned.lastIndexOf(endChar);
  return JSON.parse(cleaned.slice(start, end + 1));
}

const REQUEST_TIMEOUT_MS = 35000;
let discoveredModelsCache = { key: '', models: [], categorized: null };

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Tempo limite (${Math.round(timeoutMs / 1000)}s) excedido por alta demanda no servidor do Google.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isInvalidKeyError(status, msg) {
  return (status === 400 || status === 401 || status === 403) &&
    /api_key_invalid|api key not valid|invalid api key|key expired|permission_denied/i.test(msg);
}

function isTransientServiceError(err) {
  const msg = String(err?.message || '');
  return Boolean(err?.transient) ||
    /high demand|overloaded|unavailable|try again|temporarily|quota|rate limit|resource_exhausted|tempo limite|timeout|aborted|failed to fetch|network|503|429|500|502|504/i.test(msg);
}

const MODEL_DISPLAY_MAP = {
  'gemini-4-hydrogen': 'Gemini 4 Hydrogen',
  'gemini-4-neon': 'Gemini 4 Neon',
  'gemini-4-argon': 'Gemini 4 Argon',
  'gemini-4-carbon': 'Gemini 4 Carbon',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'gemini-3.6-flash': 'Gemini 3.6 Flash',
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite'
};

export function resolveSelectedModel(modelName = 'gemini-4-hydrogen') {
  const preferred = String(modelName || '').trim();
  if (
    !preferred ||
    preferred === 'auto-gemini-4' ||
    /^(?:gemini-2\.|gemini-3\.8-flash-lite|gemini-3\.8-pro|gemini-flash-lite-latest)/i.test(preferred)
  ) {
    return 'gemini-4-hydrogen';
  }
  if (preferred === 'auto-gemini-4-pro') {
    return 'gemini-4-neon';
  }
  return preferred;
}

export function formatModelDisplayName(modelName = 'gemini-4-hydrogen') {
  const resolved = resolveSelectedModel(modelName);
  if (MODEL_DISPLAY_MAP[resolved]) return MODEL_DISPLAY_MAP[resolved];
  return resolved
    .replace(/^gemini-/i, 'Gemini ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function getOrchestratorQueue(modelName = 'gemini-4-hydrogen') {
  return [resolveSelectedModel(modelName)];
}

function scoreDiscoveredModel(name) {
  const n = String(name || '').toLowerCase();
  if (n === 'gemini-4-hydrogen') return 0;
  if (n === 'gemini-4-neon') return 1;
  if (n === 'gemini-4-argon') return 2;
  if (n === 'gemini-4-carbon') return 3;
  if (/^gemini-4/.test(n)) return 4;
  if (n === 'gemini-3.8-flash') return 10;
  if (n === 'gemini-3.6-flash') return 11;
  if (n === 'gemini-3.5-flash-lite') return 12;
  if (n === 'gemini-3.1-flash-lite') return 13;
  if (/^gemini-3/.test(n)) return 15;
  if (/-latest$/i.test(n)) return 50;
  return 25;
}

async function discoverActiveGeminiModels(apiKey, forceRefresh = false) {
  if (!apiKey) return [];
  if (!forceRefresh && discoveredModelsCache.key === apiKey && discoveredModelsCache.models.length) {
    return discoveredModelsCache.models;
  }
  try {
    const res = await fetchWithTimeout(`${BASE_URL}?key=${encodeURIComponent(apiKey)}`, { method: 'GET' }, 10000);
    if (!res.ok) return [];
    const data = await res.json();
    const rawModels = data?.models || [];

    const textModels = rawModels
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((name) =>
        name &&
        /^gemini-/i.test(name) &&
        !/embedding|aqa|tts|live|transcribe|robotics|computer-use|image|vision|1\.0|1\.5|2\.0-flash(?:-|$)/i.test(name)
      )
      .sort((a, b) => scoreDiscoveredModel(a) - scoreDiscoveredModel(b));

    const imageModels = rawModels
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((name) => /nano-banana|image/i.test(name));

    discoveredModelsCache = {
      key: apiKey,
      models: textModels,
      categorized: {
        gemini4: textModels.filter((n) => /^gemini-4/i.test(n)),
        gemini3: textModels.filter((n) => /^gemini-3/i.test(n)),
        image: imageModels,
        other: textModels.filter((n) => !/^gemini-(?:4|3)/i.test(n))
      }
    };
    return textModels;
  } catch {
    return [];
  }
}

export async function listAvailableApiModels(apiKey) {
  if (!apiKey) {
    throw new Error('Cole e salve sua Gemini API Key antes de verificar os modelos disponíveis.');
  }
  const res = await fetchWithTimeout(`${BASE_URL}?key=${encodeURIComponent(apiKey)}`, { method: 'GET' }, 12000);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `HTTP ${res.status} ao consultar modelos da chave.`);
  }
  await discoverActiveGeminiModels(apiKey, true);
  return discoveredModelsCache.categorized || { gemini4: [], gemini3: [], image: [], other: [] };
}

async function callGemini({ apiKey, modelName = 'gemini-4-hydrogen', prompt, systemInstruction = '', useSearch = false, expectJson = true, onStatus = null }) {
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const model = resolveSelectedModel(modelName);
  const modelLabel = formatModelDisplayName(model);

  if (typeof onStatus === 'function') {
    onStatus(modelLabel);
  }

  try {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.78
      }
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }
    if (useSearch) {
      body.tools = [{ googleSearch: {} }];
    } else if (expectJson) {
      body.generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetchWithTimeout(`${BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, REQUEST_TIMEOUT_MS);

    const data = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      if (isInvalidKeyError(res.status, msg)) {
        throw Object.assign(new Error(`${modelLabel}: ${msg}`), { fatal: true });
      }
      throw Object.assign(new Error(`${modelLabel}: ${msg}`), {
        transient: res.status === 503 || res.status === 429 || res.status >= 500 ||
          /high demand|overloaded|unavailable|try again|temporarily|quota|rate limit|resource_exhausted/i.test(msg)
      });
    }

    const candidate = data?.candidates?.[0];
    const text = (candidate?.content?.parts || []).map((p) => p.text || '').join('\n').trim();
    if (!text) {
      throw new Error(`${modelLabel}: Resposta vazia do modelo.`);
    }
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    const sources = groundingChunks
      .map((c) => c?.web ? { title: c.web.title, uri: c.web.uri } : null)
      .filter(Boolean);

    return { text, modelUsed: model, sources };
  } catch (err) {
    if (err?.fatal) throw err;
    const baseMsg = String(err?.message || 'Erro ao conectar com a API do Google Gemini.');
    const formattedMsg = baseMsg.startsWith(modelLabel) ? baseMsg : `${modelLabel}: ${baseMsg}`;
    throw Object.assign(new Error(formattedMsg), {
      transient: Boolean(err?.transient) || isTransientServiceError(err)
    });
  }
}

// ============================================================================
// 1. GERADOR DE EPISÓDIO COMPLETO (ROTEIRO + HEADLINE + LEGENDA + EDIÇÃO IA)
// ============================================================================

export async function generateCompleteEpisode(params) {
  const {
    creator,
    modelId,
    seriesName,
    partNumber = 1,
    topic,
    funnelStage = 'topo',
    viralGoal = 'share',
    validation = {},
    apiKey,
    modelName,
    onStatus = null
  } = params;

  const modelObj = SERIES_MODELS.find((m) => m.id === modelId) || SERIES_MODELS[0];
  const funnelObj = VIRAL_CODE.funnelStages.find((f) => f.id === funnelStage) || VIRAL_CODE.funnelStages[0];
  const hierarchyObj = VIRAL_CODE.hierarchies.find((h) => h.id === viralGoal) || VIRAL_CODE.hierarchies[0];

  if (!apiKey) {
    return buildOfflineEpisode({ creator, modelObj, seriesName, partNumber, topic, funnelObj, hierarchyObj, validation });
  }

  const systemInstruction = `Você é o Diretor Criativo do "Reels Lab", especialista supremo nos dois métodos:
1. "O Meu Modelo de Reels" (Leislin Eduarda):
- Todo vídeo pertence a uma SÉRIE numerada (Parte ${partNumber}).
- REGRA DE OURO DO COMEÇO: A primeira frase falada É LITERALMENTE o nome da série/gancho. PROIBIDO cumprimentar ("oi gente", "tudo bem", "olá pessoal"), PROIBIDO se apresentar, PROIBIDO dizer "hoje eu vim falar de".
- TESTE DA CONVERSA: Escreva como quem conversa com uma amiga no WhatsApp/café. Zero linguagem acadêmica ou de seminário. Respeite o pronome (${creator?.pronoun || 'você'}) e nunca use as palavras proibidas.
- DURAÇÃO: Máximo 1 minuto (~110 a 145 palavras no total; se Topo/Descoberta <30s, ~65 a 85 palavras).
- 1 ÚNICA ORIENTAÇÃO por vídeo: resolva um único problema concreto.

2. "Código Viral":
- GANCHO (0-3s) + BENEFÍCIO imediato.
- O DIRETO: Sem enrolação entre gancho e entrega.
- MOSTRE, NÃO SÓ EXPLIQUE: Dê exemplos visuais ou situações cotidianas concretas.
- TÍTULO / HEADLINE DA CAPA: Deve ter 3 ingredientes (Específico + Curioso + Urgente) usando palavras que despertam curiosidade (Segredo, Truque, Isso, Entenda, Veja, Razão, Como, Pare).
- CTA ESTRATÉGICA + PORTA NA CARA: Terminar com chamada alinhada ao objetivo viral (${hierarchyObj.label}) e corte seco imediato sem despedida.`;

  const prompt = `Crie um pacote COMPLETO de Reels para o criador abaixo:

${buildCreatorContext(creator)}

PARÂMETROS DO EPISÓDIO:
- Série: "${seriesName}" (Parte ${partNumber})
- Modelo Escolhido: ${modelObj.code} — "${modelObj.name}"
  Regra de título deste modelo: ${modelObj.nameRule}
  Fluxo obrigatório do roteiro: ${modelObj.structureFlow}
  Esqueleto base: ${JSON.stringify(modelObj.template)}
- Tema / Situação deste episódio: ${topic || 'Escolha uma dor específica de alto impacto do público do criador'}
- Etapa do Funil: ${funnelObj.label} (${funnelObj.focus})
- Objetivo Viral Principal: ${hierarchyObj.label} (${hierarchyObj.hint})
- Pré-respostas do criador (se houver): Problema="${validation.problem || ''}", Aprendizado="${validation.learn || ''}", Mudança="${validation.lifeChange || ''}"

Retorne EXATAMENTE um JSON com esta estrutura:
{
  "title": "Título curto e memorável do episódio",
  "onScreenText": "Texto exato para colocar escrito acima da cabeça no início do vídeo (com Parte ${partNumber})",
  "headlines": [
    "Headline Viral 1 para capa (curta, max 7 palavras, específica + curiosa + urgente)",
    "Headline Viral 2 (alternativa com palavra de curiosidade)",
    "Headline Viral 3 (alternativa direta)"
  ],
  "validation": {
    "problem": "1. Qual problema específico esse Reels aborda?",
    "learn": "2. Qual é a ÚNICA orientação prática que a pessoa aprende?",
    "lifeChange": "3. O que isso muda concretamente na vida dela?"
  },
  "script": "Roteiro completo pronto para ler no Teleprompter, separado em blocos com marcações de tempo [00-03s | GANCHO + BENEFÍCIO], [03-18s | DESENVOLVIMENTO], [18-35s | SOLUÇÃO / MOSTRE!], [35-45s | QUEBRA DE OBJEÇÃO / FINALIZAÇÃO + CTA + CORTE PORTA NA CARA]. Escreva exatamente as palavras faladas na voz natural do criador.",
  "caption": "Legenda estratégica completa pronta para Instagram (se o objetivo for Gancho + Leia a Legenda, entregue 3 parágrafos ricos; inclua CTA para comentários/Direct com palavra-chave ${creator?.manychatKeyword || 'EUQUERO'} se fizer sentido + 4 hashtags do nicho).",
  "editingPrompt": "Prompt detalhado e técnico para colar em editores de vídeo com IA (CapCut AI / Opus / editor humano), com marcações segundo a segundo de: texto na tela, cortes secos (jump cuts), sugestões de B-Roll visual, zoom-in nas palavras-chave, estilo de legenda dinâmica, efeitos sonoros e corte seco final Porta na Cara.",
  "coverImagePrompt": "Prompt em português (rico em detalhes visuais, iluminação, enquadramento vertical 9:16 com espaço limpo no topo/centro para texto) para gerar a imagem de fundo da capa por IA."
}`;

  try {
    const { text, modelUsed } = await callGemini({ apiKey, modelName, taskType: 'creative', prompt, systemInstruction, expectJson: true, onStatus });
    const parsed = cleanJsonResponse(text);
    return { ...parsed, generatedBy: `IA (${modelUsed})` };
  } catch (err) {
    if (!err?.fatal && isTransientServiceError(err)) {
      const offline = buildOfflineEpisode({ creator, modelObj, seriesName, partNumber, topic, funnelObj, hierarchyObj, validation });
      return {
        ...offline,
        generatedBy: 'Motor Inteligente de Contingência (Pico de demanda no Google Gemini)',
        fallbackReason: err.message
      };
    }
    throw err;
  }
}

function buildOfflineEpisode({ creator, modelObj, seriesName, partNumber, topic, funnelObj, hierarchyObj, validation }) {
  const pronoun = creator?.pronoun || 'você';
  const prefix = creator?.targetGroupPrefix || 'A pessoa que';
  const keyword = creator?.manychatKeyword || 'EUQUERO';
  const niche = creator?.niche || 'seu dia a dia';
  const cleanTopic = (topic || '').trim() || `quer melhorar em ${niche} sem complicação`;

  let hookLine = '';
  if (modelObj.id === 'serie_01') {
    hookLine = `O que toda pessoa que ${cleanTopic.replace(/^o que toda.*?deveria fazer,?\s*mas não faz\.?/i, '').trim()} deveria fazer, mas não faz.`;
  } else if (modelObj.id === 'serie_02') {
    hookLine = cleanTopic.toLowerCase().startsWith('comece a') ? cleanTopic : `Comece a ${cleanTopic.charAt(0).toLowerCase() + cleanTopic.slice(1)}.`;
  } else if (modelObj.id === 'serie_03') {
    hookLine = cleanTopic.toLowerCase().startsWith('a ') || cleanTopic.toLowerCase().startsWith('o ')
      ? cleanTopic
      : `${prefix} ${cleanTopic} não deveria achar que isso é normal.`;
  } else if (modelObj.id === 'serie_04') {
    hookLine = `${seriesName} (parte ${partNumber}). Faz desse jeito aqui: ${cleanTopic}.`;
  } else if (modelObj.id === 'serie_05') {
    hookLine = cleanTopic.toLowerCase().startsWith('quem') ? cleanTopic : `Quem quer ${cleanTopic} deveria fazer isso aqui.`;
  } else {
    hookLine = `Poucas pessoas sabem, mas ${cleanTopic} é o motivo de você estar travando.`;
  }

  const ctaLine = hierarchyObj.id === 'comment'
    ? `Comenta "${keyword}" aqui embaixo que eu te mando no Direct o passo a passo completo.`
    : hierarchyObj.id === 'share'
    ? `Manda esse vídeo no Direct de quem precisa destravar isso hoje.`
    : hierarchyObj.id === 'read_caption'
    ? `Eu deixei os 3 passos exatos escritos aqui na legenda — salva e lê agora.`
    : `Salva esse vídeo para aplicar ainda hoje e segue para a parte ${Number(partNumber) + 1}.`;

  const script = `[00-03s | GANCHO + BENEFÍCIO]
${hookLine} E nos próximos segundos eu vou te mostrar exatamente o que ${pronoun} pode ajustar hoje para destravar isso.

[03-18s | DESENVOLVIMENTO / IDENTIFICAÇÃO]
Eu sei que na correria ${pronoun} tenta resolver tudo do jeito mais difícil, olha o que os outros fazem e acaba se frustrando porque parece que nada funciona na sua rotina real. Só que quando ${pronoun} continua repetindo esse mesmo hábito sem perceber, o resultado só atrasa.

[18-35s | SOLUÇÃO PRÁTICA — MOSTRE!]
Eu, no seu lugar, faria assim — olha na prática: escolha um único ajuste simples ligado a ${cleanTopic} e aplique por 7 dias antes de querer mudar tudo de uma vez. Mostre na câmera ou no exemplo real como fica fácil quando tira a complicação.

[35-45s | QUEBRA DE OBJEÇÃO + CTA + PORTA NA CARA]
Porque ${pronoun} pode ter certeza: não é falta de tempo nem de capacidade, é só falta do método certo. ${ctaLine} [CORTE SECO IMEDIATO]`;

  return {
    title: cleanTopic.slice(0, 70),
    onScreenText: `${seriesName} • Parte ${partNumber}`,
    headlines: [
      `O SEGREDO: ${cleanTopic.slice(0, 34)} 🤯`,
      `ENTENDA por que isso trava você`,
      `${seriesName.slice(0, 28)} (Parte ${partNumber})`
    ],
    validation: {
      problem: validation.problem || `Dificuldade cotidiana ligada a ${cleanTopic}.`,
      learn: validation.learn || `Como aplicar uma mudança imediata e simples em ${niche}.`,
      lifeChange: validation.lifeChange || `Mais clareza, consistência e resultado real sem complicar a rotina.`
    },
    script,
    caption: `${hookLine}\n\nA maioria das pessoas acha que precisa de uma fórmula mirabolante para resolver isso, quando na verdade o segredo está no ajuste básico feito com consistência.\n\n📌 Resumo para salvar:\n1. Identifique o erro invisível da sua rotina.\n2. Aplique uma única ação prática ainda hoje.\n3. Acompanhe a evolução nas próximas partes desta série.\n\n${ctaLine}\n\n#${(creator?.niche || 'conteudo').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')} #dicaspraticas #reelsviral`,
    editingPrompt: `PROMPT DE EDIÇÃO (CAPCUT / EDITOR IA) — ${funnelObj.label}:\n1. [00-03s]: Sem cumprimento. Coloque título fixo no topo acima da cabeça: "${seriesName} (Parte ${partNumber})". Zoom-in leve (100% -> 112%) + som sutil de "pop".\n2. [03-35s]: Cortes secos removendo todas as pausas de respiração. Legenda dinâmica centralizada em fonte Bold branca com palavras-chave em amarelo (#FDE047).\n3. [18-35s]: Insira B-Roll / gravação mostrando a ação prática na tela enquanto narra.\n4. [Final]: Corte abrupto imediatamente após a última palavra da CTA (efeito "Porta na Cara" para aumentar loop e retenção).\n5. Música de fundo instrumental sutil em -24dB.`,
    coverImagePrompt: `Foto vertical 9:16 estilo editorial de estúdio em ${creator?.niche || 'lifestyle'}, pessoa expressiva em ambiente natural bem iluminado, espaço limpo no terço superior/central para headline grande, cores vibrantes combinando com ${creator?.brandColor || '#EC4899'}.`,
    generatedBy: 'Motor Local (Adicione sua chave Gemini para IA generativa avançada)'
  };
}

// ============================================================================
// 2. GERADOR DE 5 IDEIAS DE EPISÓDIOS PARA A SÉRIE
// ============================================================================

function buildOfflineSeriesIdeas(creator, generatedBy = 'Sugestões Locais') {
  return {
    ideas: [
      { topic: `O erro silencioso número 1 em ${creator?.niche || 'sua área'} que atrasa seus resultados`, problem: 'Hábito automático errado', learn: 'Como substituir em 2 minutos', lifeChange: 'Resultado visível já na semana' },
      { topic: `O ajuste de 5 minutos antes de começar a semana`, problem: 'Falta de organização prática', learn: 'Checklist rápido de domingo', lifeChange: 'Zero correria na segunda-feira' },
      { topic: `O mito que te contaram sobre ${creator?.product || 'seu objetivo'}`, problem: 'Crença limitante comum', learn: 'O que realmente funciona na prática', lifeChange: 'Economiza tempo e dinheiro' },
      { topic: `O que fazer quando você acha que não tem tempo para isso`, problem: 'Rotina apertada', learn: 'Versão mínima viável do hábito', lifeChange: 'Mantém constância mesmo nos dias difíceis' },
      { topic: `A dúvida que todo mundo me manda no WhatsApp sobre isso`, problem: 'Insegurança na execução', learn: 'Passo claro de aplicação', lifeChange: 'Mais confiança para agir hoje' }
    ],
    generatedBy
  };
}

export async function generateSeriesIdeas({ creator, modelId, seriesName, existingTitles = [], apiKey, modelName, onStatus = null }) {
  const modelObj = SERIES_MODELS.find((m) => m.id === modelId) || SERIES_MODELS[0];

  if (!apiKey) {
    return buildOfflineSeriesIdeas(creator);
  }

  const prompt = `Com base no DNA do criador abaixo e no modelo de série "${modelObj.code}: ${modelObj.name}" (Série chamada "${seriesName}"), crie 5 ideias inéditas de próximos episódios (Partes) para essa série.
Evite repetir estes temas já criados: ${existingTitles.join(' | ') || 'Nenhum ainda'}.

${buildCreatorContext(creator)}

Retorne EXATAMENTE um JSON:
{
  "ideas": [
    {
      "topic": "Frase/gancho específico da parte seguindo a regra do modelo (${modelObj.titlePattern})",
      "problem": "Qual problema real aborda",
      "learn": "O que a pessoa aprende",
      "lifeChange": "O que muda na vida dela"
    }
  ]
}`;

  try {
    const { text, modelUsed } = await callGemini({ apiKey, modelName, taskType: 'dna', prompt, expectJson: true, onStatus });
    const parsed = cleanJsonResponse(text);
    return { ...parsed, generatedBy: `IA (${modelUsed})` };
  } catch (err) {
    if (!err?.fatal && isTransientServiceError(err)) {
      return {
        ...buildOfflineSeriesIdeas(creator, 'Sugestões Inteligentes de Contingência (Pico de demanda no Gemini)'),
        fallbackReason: err.message
      };
    }
    throw err;
  }
}

// ============================================================================
// 3. RADAR DE TEMAS QUENTES (TIMING + PESQUISA GOOGLE)
// ============================================================================

function buildOfflineHotTopics(creator, generatedBy = 'Modo Demonstração (Configure sua chave Gemini para buscar notícias reais do Google)') {
  return {
    topics: [
      {
        trendTitle: 'Mudanças nos hábitos digitais e excesso de telas / rotina acelerada',
        timingWhy: 'Assunto altamente comentado nas redes hoje sobre produtividade, cansaço e busca por praticidade.',
        bubbleBridge: `Conectar o cansaço atual com soluções rápidas dentro de ${creator?.niche || 'seu nicho'}.`,
        angles: [
          { funnel: 'topo', modelId: 'serie_03', title: `${creator?.targetGroupPrefix || 'A pessoa que'} passa horas rolando o feed procurando solução e nunca aplica` },
          { funnel: 'meio', modelId: 'serie_04', title: `Como resolver isso em 10 minutos por dia sem complicar sua rotina` },
          { funnel: 'fundo', modelId: 'serie_05', title: `Quem quer resultado real com ${creator?.product || 'acompanhamento'} deveria fazer isso aqui` }
        ]
      },
      {
        trendTitle: 'Polêmica das "dicas milagrosas" que viralizam no TikTok / Reels',
        timingWhy: 'Vídeos desmentindo modinhas da internet têm altíssima taxa de compartilhamento e comentários.',
        bubbleBridge: `Usar sua autoridade em ${creator?.niche || 'sua profissão'} para mostrar o que é mito vs. o que funciona.`,
        angles: [
          { funnel: 'topo', modelId: 'codigo_viral', title: `A maior mentira que estão contando sobre ${creator?.niche || 'isso'} essa semana` },
          { funnel: 'meio', modelId: 'serie_01', title: `O que toda pessoa que vê dica na internet deveria conferir antes, mas não confere` },
          { funnel: 'fundo', modelId: 'serie_02', title: `Comece a aplicar esse critério simples antes de gastar dinheiro errado` }
        ]
      },
      {
        trendTitle: 'Tendência de "Economia Inteligente / Fazer Melhor com Menos"',
        timingWhy: 'As pessoas estão buscando formas práticas de evitar desperdício de tempo e dinheiro agora.',
        bubbleBridge: `Mostrar como a sua metodologia evita erros caros no dia a dia da persona.`,
        angles: [
          { funnel: 'topo', modelId: 'serie_04', title: `Como ter resultado em ${creator?.niche || 'sua meta'} sem gastar rios de dinheiro` },
          { funnel: 'meio', modelId: 'serie_03', title: `${creator?.targetGroupPrefix || 'A pessoa que'} tenta economizar cortando o essencial não deveria estranhar depois` },
          { funnel: 'fundo', modelId: 'serie_05', title: `Quem quer parar de jogar dinheiro fora deveria fazer isso aqui` }
        ]
      }
    ],
    sources: [],
    generatedBy
  };
}

function decodeXmlEntities(str = '') {
  return String(str)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatTrendDate(rawDate = '') {
  if (!rawDate) return 'Recente';
  const dt = new Date(rawDate);
  if (Number.isNaN(dt.getTime())) return String(rawDate).slice(0, 22);
  const datePart = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timePart = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

export const GOOGLE_NEWS_CATEGORIES = [
  { id: 'brasil', label: 'Brasil', topic: 'NATION' },
  { id: 'mundo', label: 'Mundo', topic: 'WORLD' },
  { id: 'negocios', label: 'Negócios', topic: 'BUSINESS' },
  { id: 'ciencia_tech', label: 'Ciência e tecnologia', topics: ['TECHNOLOGY', 'SCIENCE'] },
  {
    id: 'entretenimento',
    label: 'Entretenimento',
    topic: 'ENTERTAINMENT',
    subcategories: [
      { id: 'todas', label: 'Todas', topic: 'ENTERTAINMENT' },
      { id: 'filmes_series', label: 'Filmes/Séries', query: 'cinema filmes séries streaming' },
      { id: 'musica', label: 'Música', query: 'música shows lançamentos álbuns' },
      { id: 'tv', label: 'TV', query: 'televisão novelas programas tv' },
      { id: 'arte_design', label: 'Arte e design', query: 'arte design exposições cultura' },
      { id: 'celebridades', label: 'Celebridades', query: 'celebridades famosos entretenimento' },
      { id: 'games', label: 'Games', query: 'games videogames jogos playstation xbox nintendo' }
    ]
  },
  { id: 'esportes', label: 'Esportes', topic: 'SPORTS' },
  { id: 'saude', label: 'Saúde', topic: 'HEALTH' }
];

export const GOOGLE_NEWS_DATE_FILTERS = [
  { id: 'any', label: 'Qualquer data', ms: 0, whenToken: '' },
  { id: '1h', label: 'Última hora', ms: 60 * 60 * 1000, whenToken: 'when:1h' },
  { id: '24h', label: 'Últimas 24 horas', ms: 24 * 60 * 60 * 1000, whenToken: 'when:1d' },
  { id: '7d', label: 'Última semana', ms: 7 * 24 * 60 * 60 * 1000, whenToken: 'when:7d' },
  { id: '1y', label: 'Último ano', ms: 365 * 24 * 60 * 60 * 1000, whenToken: 'when:1y' }
];

export function inferCreatorDefaultCategory(creator) {
  const blob = `${creator?.niche || ''} ${creator?.positioning || ''} ${creator?.audience || ''}`;
  if (/sa[úu]de|nutri|m[eé]dic|odont|psicolog|terap|fisioterap|bem[- ]estar|alimenta|emagrec/i.test(blob)) return 'saude';
  if (/esport|futebol|fitness|treino|academia|corrida|atleta|muscula/i.test(blob)) return 'esportes';
  if (/tecnolog|ci[êe]ncia|intelig[êe]ncia artificial|\bia\b|software|program|tech|gadget|digital/i.test(blob)) return 'ciencia_tech';
  if (/neg[óo]cio|finan[çc]|invest|im[óo]ve|imobili[áa]r|advoc|direito|marketing|vendas|empreend|contabil|econom/i.test(blob)) return 'negocios';
  if (/entreten|cinema|filme|s[ée]rie|m[úu]sica|\btv\b|arte|design|celebrid|game|moda|beleza|cultura/i.test(blob)) return 'entretenimento';
  if (/mundo|internacional|viagem|turismo|geopol/i.test(blob)) return 'mundo';
  return 'brasil';
}

export function parseRssXmlItems(xmlText, defaultSource = 'Google Notícias', limit = 20) {
  const xml = String(xmlText || '');
  if (!xml.trim()) return [];
  const items = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(xml, 'text/xml');
      const nodes = Array.from(doc.querySelectorAll('item')).slice(0, limit);
      for (const node of nodes) {
        const rawTitle = node.querySelector('title')?.textContent?.trim() || '';
        const link = node.querySelector('link')?.textContent?.trim() || '';
        const pubDate = node.querySelector('pubDate')?.textContent?.trim() || '';
        const sourceTag = node.querySelector('source')?.textContent?.trim() || '';
        const desc = decodeXmlEntities(node.querySelector('description')?.textContent || '');
        const cleanTitle = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
        const sourceName = sourceTag || (rawTitle.match(/\s+-\s+([^-]+)$/)?.[1]?.trim()) || defaultSource;
        const summary = desc && desc.toLowerCase() !== cleanTitle.toLowerCase() ? desc.slice(0, 240) : '';
        if (cleanTitle) {
          items.push({
            title: decodeXmlEntities(cleanTitle),
            link,
            pubDate,
            publishedAt: formatTrendDate(pubDate),
            sourceName: decodeXmlEntities(sourceName),
            summary,
            channel: defaultSource
          });
        }
      }
      if (items.length) return items;
    } catch {
      // Fallback para regex caso o parser XML não esteja disponível
    }
  }

  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const readTag = (tag) => {
      const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? decodeXmlEntities(m[1]) : '';
    };
    const rawTitle = readTag('title');
    const link = readTag('link');
    const pubDate = readTag('pubDate');
    const sourceTag = readTag('source');
    const desc = readTag('description');
    const cleanTitle = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
    const sourceName = sourceTag || (rawTitle.match(/\s+-\s+([^-]+)$/)?.[1]?.trim()) || defaultSource;
    const summary = desc && desc.toLowerCase() !== cleanTitle.toLowerCase() ? desc.slice(0, 240) : '';
    if (cleanTitle) {
      items.push({
        title: cleanTitle,
        link,
        pubDate,
        publishedAt: formatTrendDate(pubDate),
        sourceName,
        summary,
        channel: defaultSource
      });
    }
  }
  return items;
}

export function filterNewsByDate(items = [], dateFilter = 'any', nowMs = Date.now()) {
  const filterObj = GOOGLE_NEWS_DATE_FILTERS.find((f) => f.id === dateFilter) || GOOGLE_NEWS_DATE_FILTERS[0];
  const withTime = (items || []).map((item) => {
    const ts = item?.pubDate ? Date.parse(item.pubDate) : NaN;
    return { item, ts };
  });

  const filtered = filterObj.ms > 0
    ? withTime.filter(({ ts }) => !Number.isNaN(ts) && (nowMs - ts) <= filterObj.ms && (ts - nowMs) <= 10 * 60 * 1000)
    : withTime;

  filtered.sort((a, b) => {
    if (Number.isNaN(a.ts) && Number.isNaN(b.ts)) return 0;
    if (Number.isNaN(a.ts)) return 1;
    if (Number.isNaN(b.ts)) return -1;
    return b.ts - a.ts;
  });

  return filtered.map(({ item }) => ({
    ...item,
    publishedAt: item.publishedAt || formatTrendDate(item.pubDate)
  }));
}

function buildGoogleNewsFeedSpecs({ categoryId = 'brasil', subCategoryId = 'todas', focusQuery = '', dateFilter = 'any' } = {}) {
  const filterObj = GOOGLE_NEWS_DATE_FILTERS.find((f) => f.id === dateFilter) || GOOGLE_NEWS_DATE_FILTERS[0];
  const whenSuffix = filterObj.whenToken ? ` ${filterObj.whenToken}` : '';
  const trimmedQuery = String(focusQuery || '').trim();

  if (trimmedQuery) {
    return {
      displayCategoryLabel: `Busca: ${trimmedQuery}`,
      feeds: [
        {
          label: `Google Notícias · ${trimmedQuery}`,
          url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${trimmedQuery}${whenSuffix}`)}&hl=pt-BR&gl=BR&ceid=BR:pt`
        }
      ]
    };
  }

  const cat = GOOGLE_NEWS_CATEGORIES.find((c) => c.id === categoryId) || GOOGLE_NEWS_CATEGORIES[0];
  if (cat.id === 'entretenimento' && subCategoryId && subCategoryId !== 'todas') {
    const sub = (cat.subcategories || []).find((s) => s.id === subCategoryId);
    if (sub?.query) {
      return {
        displayCategoryLabel: `Entretenimento · ${sub.label}`,
        feeds: [
          {
            label: `${cat.label} · ${sub.label}`,
            url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${sub.query}${whenSuffix}`)}&hl=pt-BR&gl=BR&ceid=BR:pt`
          }
        ]
      };
    }
  }

  if (Array.isArray(cat.topics) && cat.topics.length) {
    return {
      displayCategoryLabel: cat.label,
      feeds: cat.topics.map((topic) => ({
        label: cat.label,
        url: `https://news.google.com/rss/headlines/section/topic/${topic}?hl=pt-BR&gl=BR&ceid=BR:pt`
      }))
    };
  }

  return {
    displayCategoryLabel: cat.label,
    feeds: [
      {
        label: cat.label,
        url: `https://news.google.com/rss/headlines/section/topic/${cat.topic}?hl=pt-BR&gl=BR&ceid=BR:pt`
      }
    ]
  };
}

function raceFirstNonEmpty(promises) {
  if (typeof Promise.any === 'function') {
    return Promise.any(promises);
  }
  return new Promise((resolve, reject) => {
    let remaining = promises.length;
    if (!remaining) return reject(new Error('empty'));
    promises.forEach((p) => {
      Promise.resolve(p).then(resolve, () => {
        remaining -= 1;
        if (remaining === 0) reject(new Error('all failed'));
      });
    });
  });
}

async function fetchSingleRssFeed(feed, limit = 15) {
  const encodedUrl = encodeURIComponent(feed.url);
  const tagItems = (items) =>
    items.map((it) => ({
      ...it,
      categoryId: feed.categoryId || '',
      categoryLabel: it.categoryLabel || feed.label || 'Google Notícias'
    }));

  const tryXmlRelay = async (proxyUrl) => {
    const res = await fetchWithTimeout(proxyUrl, { method: 'GET' }, 7500);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRssXmlItems(xml, feed.label, limit);
    if (!items.length) throw new Error('empty');
    return tagItems(items);
  };

  const tryAllOriginsJson = async () => {
    const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodedUrl}`, { method: 'GET' }, 7500);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = parseRssXmlItems(data?.contents || '', feed.label, limit);
    if (!items.length) throw new Error('empty');
    return tagItems(items);
  };

  const tryRss2Json = async () => {
    const res = await fetchWithTimeout(`https://api.rss2json.com/v1/api.json?rss_url=${encodedUrl}`, { method: 'GET' }, 7500);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.status !== 'ok' || !Array.isArray(data.items) || !data.items.length) {
      throw new Error('empty');
    }
    const mapped = data.items.slice(0, limit).map((item) => {
      const rawTitle = String(item.title || '').trim();
      const cleanTitle = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
      const inferredSrc = rawTitle.match(/\s+-\s+([^-]+)$/)?.[1]?.trim();
      const desc = decodeXmlEntities(item.description || '');
      return {
        title: decodeXmlEntities(cleanTitle),
        link: String(item.link || '').trim(),
        pubDate: String(item.pubDate || '').trim(),
        publishedAt: formatTrendDate(item.pubDate),
        sourceName: decodeXmlEntities(item.author || inferredSrc || feed.label),
        summary: desc && desc.toLowerCase() !== cleanTitle.toLowerCase() ? desc.slice(0, 240) : '',
        channel: feed.label
      };
    }).filter((it) => it.title);
    if (!mapped.length) throw new Error('empty');
    return tagItems(mapped);
  };

  try {
    return await raceFirstNonEmpty([
      tryAllOriginsJson(),
      tryXmlRelay(`https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`),
      tryRss2Json(),
      tryXmlRelay(`https://api.allorigins.win/raw?url=${encodedUrl}`),
      tryXmlRelay(`https://corsproxy.io/?${encodedUrl}`)
    ]);
  } catch {
    return [];
  }
}

function dedupePortalItems(rawItems = [], maxItems = 40) {
  const seen = new Map();
  for (const item of rawItems) {
    const key = String(item.link || item.title || '').toLowerCase().trim();
    if (!key || !item.title || seen.has(key)) continue;
    seen.set(key, item);
  }
  return Array.from(seen.values()).slice(0, maxItems);
}

async function fetchViaAppsScript({ urls = [], labels = [], categoryIds = [], query = '', dateFilter = 'any', driveWebhookUrl = '' }) {
  if (!driveWebhookUrl) return { items: [], diag: 'no_url', detail: '' };
  try {
    const res = await fetchWithTimeout(driveWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'fetch_google_news',
        query,
        dateFilter,
        urls,
        labels,
        categoryIds
      })
    }, 16000);
    if (!res.ok) {
      return { items: [], diag: 'script_error', detail: `Apps Script HTTP ${res.status}` };
    }
    const data = await res.json();
    const errText = [data?.error, ...(Array.isArray(data?.errors) ? data.errors : [])].filter(Boolean).join(' | ');
    if (data?.needsAuth || /permiss|external_request|UrlFetchApp|autoriz|auth/i.test(errText)) {
      return { items: [], diag: 'needs_auth', detail: errText };
    }
    if (/ação desconhecida|unknown action/i.test(errText)) {
      return { items: [], diag: 'outdated_deployment', detail: errText };
    }
    if (data?.ok && Array.isArray(data.items) && data.items.length) {
      return {
        items: data.items.map((it) => ({
          ...it,
          publishedAt: it.publishedAt || formatTrendDate(it.pubDate),
          categoryId: it.categoryId || '',
          categoryLabel: it.channel || 'Google Notícias'
        })),
        diag: 'ok',
        detail: ''
      };
    }
    if (!data?.version) {
      return { items: [], diag: 'outdated_deployment', detail: 'Implantação anterior retornou 0 itens.' };
    }
    return { items: [], diag: 'script_error', detail: errText || 'Nenhum item retornado.' };
  } catch (err) {
    return { items: [], diag: 'script_unreachable', detail: String(err?.message || 'Erro de rede') };
  }
}

function throwDetailedRadarError({ rawCount = 0, dateFilter = 'any', appsScriptDiag = '', appsScriptDetail = '' }) {
  if (rawCount > 0 && dateFilter !== 'any') {
    throw new Error('Nenhuma notícia encontrada neste período no Google Notícias. Tente ampliar o filtro de data (ex: "Últimas 24 horas" ou "Qualquer data").');
  }
  if (appsScriptDiag === 'needs_auth') {
    throw new Error('Seu Google Apps Script precisa de permissão para acessar o Google Notícias: abra script.google.com, selecione a função "autorizarGoogleNoticias" no menu superior, clique em ▶ Executar uma vez para autorizar e depois faça Implantar → Gerenciar implantações → Editar → Nova versão.');
  }
  if (appsScriptDiag === 'outdated_deployment') {
    throw new Error('Seu Google Apps Script ainda está executando a versão antiga: abra script.google.com, cole o novo google-apps-script.gs v9, execute "autorizarGoogleNoticias" 1x e publique em Implantar → Gerenciar implantações → Editar → Nova versão.');
  }
  throw new Error(`Não foi possível acessar as notícias reais do Google Notícias nesta rede agora (${appsScriptDetail || 'proxies RSS públicos indisponíveis'}). Atualize e autorize o Google Apps Script v9 ou tente novamente em instantes.`);
}

export async function fetchGoogleNewsPortal({ categoryId = 'brasil', subCategoryId = 'todas', focusQuery = '', dateFilter = 'any', driveWebhookUrl = '', onStatus = null } = {}) {
  const { feeds, displayCategoryLabel } = buildGoogleNewsFeedSpecs({ categoryId, subCategoryId, focusQuery, dateFilter });
  const taggedFeeds = feeds.map((f) => ({ ...f, categoryId }));

  if (typeof onStatus === 'function') onStatus(`Google Notícias (${displayCategoryLabel})...`);

  const scriptRes = await fetchViaAppsScript({
    urls: taggedFeeds.map((f) => f.url),
    labels: taggedFeeds.map((f) => f.label),
    categoryIds: taggedFeeds.map((f) => f.categoryId),
    query: focusQuery,
    dateFilter,
    driveWebhookUrl
  });

  if (scriptRes.diag === 'ok' && scriptRes.items.length) {
    const normalized = dedupePortalItems(scriptRes.items.map((it) => ({
      ...it,
      categoryLabel: it.categoryLabel || displayCategoryLabel
    })));
    const filtered = filterNewsByDate(normalized, dateFilter);
    return {
      items: filtered,
      rawCount: normalized.length,
      fetchedFrom: 'Google Apps Script',
      appsScriptDiag: 'ok',
      appsScriptDetail: '',
      categoryId,
      subCategoryId,
      displayCategoryLabel,
      focusQuery,
      dateFilter
    };
  }

  const results = await Promise.allSettled(taggedFeeds.map((feed) => fetchSingleRssFeed(feed, 20)));
  const collected = [];
  results.forEach((res) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length) {
      res.value.forEach((item) => {
        collected.push({
          ...item,
          categoryLabel: item.categoryLabel || displayCategoryLabel
        });
      });
    }
  });

  const normalized = dedupePortalItems(collected, 40);
  const filtered = filterNewsByDate(normalized, dateFilter);
  return {
    items: filtered,
    rawCount: normalized.length,
    fetchedFrom: 'Google News RSS',
    appsScriptDiag: scriptRes.diag,
    appsScriptDetail: scriptRes.detail,
    categoryId,
    subCategoryId,
    displayCategoryLabel,
    focusQuery,
    dateFilter
  };
}

export async function fetchGoogleNewsAllCategories({ dateFilter = 'any', driveWebhookUrl = '', onStatus = null } = {}) {
  if (typeof onStatus === 'function') onStatus('Buscando todas as categorias do Google Notícias...');

  const feeds = GOOGLE_NEWS_CATEGORIES.map((cat) => {
    const topic = cat.topic || (Array.isArray(cat.topics) ? cat.topics[0] : 'NATION');
    return {
      categoryId: cat.id,
      label: cat.label,
      url: `https://news.google.com/rss/headlines/section/topic/${topic}?hl=pt-BR&gl=BR&ceid=BR:pt`
    };
  });

  const byCategory = {};
  GOOGLE_NEWS_CATEGORIES.forEach((c) => { byCategory[c.id] = []; });

  let rawCollected = [];
  let fetchedFrom = 'Google News RSS';
  let appsScriptDiag = 'no_url';
  let appsScriptDetail = '';

  const scriptRes = await fetchViaAppsScript({
    urls: feeds.map((f) => f.url),
    labels: feeds.map((f) => f.label),
    categoryIds: feeds.map((f) => f.categoryId),
    dateFilter,
    driveWebhookUrl
  });
  appsScriptDiag = scriptRes.diag;
  appsScriptDetail = scriptRes.detail;

  if (scriptRes.diag === 'ok' && scriptRes.items.length) {
    rawCollected = scriptRes.items;
    fetchedFrom = 'Google Apps Script';
  } else {
    const results = await Promise.allSettled(feeds.map((feed) => fetchSingleRssFeed(feed, 12)));
    results.forEach((res) => {
      if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length) {
        rawCollected.push(...res.value);
      }
    });
  }

  let rawCount = 0;
  rawCollected.forEach((item) => {
    const cid = item.categoryId && byCategory[item.categoryId]
      ? item.categoryId
      : (GOOGLE_NEWS_CATEGORIES.find((c) => c.label === item.categoryLabel)?.id || 'brasil');
    rawCount += 1;
    byCategory[cid].push({
      ...item,
      categoryId: cid,
      categoryLabel: item.categoryLabel || GOOGLE_NEWS_CATEGORIES.find((c) => c.id === cid)?.label || 'Brasil',
      publishedAt: item.publishedAt || formatTrendDate(item.pubDate)
    });
  });

  Object.keys(byCategory).forEach((cid) => {
    const deduped = dedupePortalItems(byCategory[cid], 20);
    byCategory[cid] = filterNewsByDate(deduped, dateFilter);
  });

  const allItems = dedupePortalItems(
    GOOGLE_NEWS_CATEGORIES.flatMap((c) => byCategory[c.id] || []),
    60
  );

  return {
    byCategory,
    allItems,
    rawCount,
    fetchedFrom,
    appsScriptDiag,
    appsScriptDetail
  };
}

export async function generateAnglesFromSelectedNews({ creator, articles = [], focusQuery = '', count = 5, apiKey, modelName = 'gemini-4-hydrogen', onStatus = null }) {
  if (!apiKey) {
    throw new Error('Configure sua Gemini API Key antes de gerar roteiros.');
  }
  if (!Array.isArray(articles) || !articles.length) {
    throw new Error('Nenhuma notícia real do Google News foi fornecida para gerar conteúdos.');
  }

  const feedSlice = articles.slice(0, 24);
  const targetCount = Math.min(Math.max(1, count), feedSlice.length);
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const formattedFeed = feedSlice.map((item, idx) =>
    `[${idx + 1}] ${item.title} | Veículo: ${item.sourceName || 'Google Notícias'} | Data: ${item.publishedAt || formatTrendDate(item.pubDate)} | Editoria: ${item.categoryLabel || item.channel || 'Geral'}${item.summary ? ` | Resumo: ${item.summary}` : ''}`
  ).join('\n');

  const prompt = `Hoje é ${today}.
Abaixo estão ${feedSlice.length} NOTÍCIAS REAIS COLETADAS AGORA DO GOOGLE NOTÍCIAS BRASIL (https://news.google.com/):

${formattedFeed}

${focusQuery ? `Assunto pesquisado pelo criador: "${focusQuery}".` : ''}

CONTEXTO DO CRIADOR:
${buildCreatorContext(creator)}

REGRAS ESTRITAS:
1. Baseie-se 100% NAS NOTÍCIAS REAIS NUMERADAS ACIMA ([1] a [${feedSlice.length}]). É PROIBIDO inventar notícias, datas ou acontecimentos fora da lista.
2. ${targetCount === feedSlice.length
    ? `Gere EXATAMENTE ${targetCount} conteúdos (um para cada notícia selecionada acima).`
    : `Escolha as ${targetCount} notícias mais relevantes para conectar com a bolha e o público do criador acima (preferindo notícias com ótimo potencial de "O Timing" do Código Viral).`}
3. Em cada item, informe exatamente o "sourceIndex" correspondente (número de 1 a ${feedSlice.length}), sem repetir a mesma notícia.
4. Para cada notícia escolhida, faça uma "bubbleBridge" conectando esse assunto real à bolha do criador sem parecer página de fofoca, e crie 3 ângulos de Reels (Topo=Descoberta <30s, Meio=Conexão 30-45s, Fundo=Venda 45-60s) escolhendo entre: serie_01, serie_02, serie_03, serie_04, serie_05 ou codigo_viral.

Responda APENAS com JSON válido no formato:
{
  "topics": [
    {
      "sourceIndex": 1,
      "trendTitle": "Título fiel à notícia real [sourceIndex]",
      "timingWhy": "Por que essa notícia chama atenção agora (1-2 frases)",
      "bubbleBridge": "Ponte inteligente desse assunto real para o nicho do criador",
      "angles": [
        { "funnel": "topo", "modelId": "codigo_viral", "title": "Ideia de título/gancho para Descoberta (<30s)" },
        { "funnel": "meio", "modelId": "serie_03", "title": "Ideia de episódio para Conexão (30-45s)" },
        { "funnel": "fundo", "modelId": "serie_05", "title": "Ideia de episódio para Venda / Quebra de objeção" }
      ]
    }
  ]
}`;

  const { text, modelUsed } = await callGemini({
    apiKey,
    modelName,
    taskType: 'radar',
    prompt,
    useSearch: false,
    expectJson: true,
    onStatus
  });

  const parsed = cleanJsonResponse(text);
  const rawTopics = Array.isArray(parsed?.topics) ? parsed.topics.slice(0, targetCount) : [];
  const usedIndexes = new Set();

  const groundedTopics = rawTopics.map((t, idx) => {
    let refIdx = Number(t.sourceIndex);
    if (!(refIdx >= 1 && refIdx <= feedSlice.length) || usedIndexes.has(refIdx)) {
      const nextUnused = feedSlice.findIndex((_, i) => !usedIndexes.has(i + 1));
      refIdx = nextUnused !== -1 ? nextUnused + 1 : ((idx % feedSlice.length) + 1);
    }
    usedIndexes.add(refIdx);
    const matched = feedSlice[refIdx - 1];
    return {
      ...t,
      sourceIndex: refIdx,
      sourceName: matched?.sourceName || 'Google Notícias',
      publishedAt: matched?.publishedAt || formatTrendDate(matched?.pubDate),
      sourceUrl: matched?.link || '',
      categoryLabel: matched?.categoryLabel || matched?.channel || 'Google Notícias'
    };
  });

  const usedArticleLinks = groundedTopics.map((t) => t.sourceUrl).filter(Boolean);
  return { topics: groundedTopics, modelUsed, usedArticleLinks };
}

export async function searchHotTopics({
  creator,
  focusQuery = '',
  categoryId = '',
  subCategoryId = 'todas',
  dateFilter = 'any',
  apiKey,
  modelName = 'gemini-4-hydrogen',
  driveWebhookUrl = '',
  onStatus = null
}) {
  if (!apiKey) {
    return buildOfflineHotTopics(creator);
  }

  const trimmedFocus = String(focusQuery || '').trim();

  if (trimmedFocus) {
    if (typeof onStatus === 'function') onStatus(`Pesquisando "${trimmedFocus}" no Google Notícias...`);
    const portal = await fetchGoogleNewsPortal({
      categoryId: 'busca',
      subCategoryId: 'todas',
      focusQuery: trimmedFocus,
      dateFilter,
      driveWebhookUrl,
      onStatus: null
    });

    if (!portal.items.length) {
      throwDetailedRadarError(portal);
    }

    const generated = await generateAnglesFromSelectedNews({
      creator,
      articles: portal.items,
      focusQuery: trimmedFocus,
      count: 5,
      apiKey,
      modelName,
      onStatus
    });

    const usedLinks = new Set(generated.usedArticleLinks);
    const remainingArticles = portal.items.filter((it) => !usedLinks.has(it.link));

    const sources = [];
    const seenUri = new Set();
    generated.topics.forEach((t) => {
      if (t.sourceUrl && !seenUri.has(t.sourceUrl)) {
        seenUri.add(t.sourceUrl);
        sources.push({
          title: `${t.trendTitle} (${t.sourceName})`,
          uri: t.sourceUrl
        });
      }
    });

    return {
      topics: generated.topics,
      sources,
      portalArticles: remainingArticles.length ? remainingArticles : portal.items,
      allFetchedArticles: portal.items,
      usedArticleLinks: generated.usedArticleLinks,
      activeCategory: 'busca',
      activeSubCategory: 'todas',
      dateFilter,
      focusQuery: trimmedFocus,
      displayCategoryLabel: portal.displayCategoryLabel,
      generatedBy: `Google Notícias ("${trimmedFocus}") + ${formatModelDisplayName(generated.modelUsed)}`
    };
  }

  // Sem pesquisa específica: busca TODAS as 7 categorias do Google Notícias em paralelo
  const allPortal = await fetchGoogleNewsAllCategories({
    dateFilter,
    driveWebhookUrl,
    onStatus
  });

  if (!allPortal.allItems.length) {
    throwDetailedRadarError(allPortal);
  }

  // Monta pool balanceado com até 4 notícias mais recentes de cada uma das 7 categorias (máx 24)
  const balancedPool = [];
  const seenPool = new Set();
  for (let round = 0; round < 4 && balancedPool.length < 24; round++) {
    for (const cat of GOOGLE_NEWS_CATEGORIES) {
      const item = (allPortal.byCategory[cat.id] || [])[round];
      const key = item?.link || item?.title;
      if (item && key && !seenPool.has(key) && balancedPool.length < 24) {
        seenPool.add(key);
        balancedPool.push(item);
      }
    }
  }

  const generated = await generateAnglesFromSelectedNews({
    creator,
    articles: balancedPool.length ? balancedPool : allPortal.allItems,
    focusQuery: '',
    count: 5,
    apiKey,
    modelName,
    onStatus
  });

  const usedLinks = new Set(generated.usedArticleLinks);
  const portalByCategory = {};
  GOOGLE_NEWS_CATEGORIES.forEach((cat) => {
    const list = allPortal.byCategory[cat.id] || [];
    const remaining = list.filter((it) => !usedLinks.has(it.link));
    portalByCategory[cat.id] = remaining.length ? remaining : list;
  });

  const defaultCat = categoryId || inferCreatorDefaultCategory(creator);
  const defaultArticles = portalByCategory[defaultCat]?.length
    ? portalByCategory[defaultCat]
    : allPortal.allItems.filter((it) => !usedLinks.has(it.link));

  const sources = [];
  const seenUri = new Set();
  generated.topics.forEach((t) => {
    if (t.sourceUrl && !seenUri.has(t.sourceUrl)) {
      seenUri.add(t.sourceUrl);
      sources.push({
        title: `${t.trendTitle} (${t.sourceName})`,
        uri: t.sourceUrl
      });
    }
  });

  return {
    topics: generated.topics,
    sources,
    portalByCategory,
    portalArticles: defaultArticles.length ? defaultArticles : allPortal.allItems,
    allFetchedArticles: allPortal.allItems,
    usedArticleLinks: generated.usedArticleLinks,
    activeCategory: defaultCat,
    activeSubCategory: subCategoryId || 'todas',
    dateFilter,
    focusQuery: '',
    displayCategoryLabel: 'Todas as Categorias',
    generatedBy: `Google Notícias (Todas as Categorias) + ${formatModelDisplayName(generated.modelUsed)}`
  };
}

// ============================================================================
// 4. CLUBE DE ANÁLISE IA (EXTRA 3 + RETENÇÃO DO CÓDIGO VIRAL)
// ============================================================================

export async function analyzeScript({ script, creator, modelId = 'serie_03', apiKey, modelName, onStatus = null }) {
  if (!apiKey) {
    return analyzeScriptOffline(script, creator);
  }

  const modelObj = SERIES_MODELS.find((m) => m.id === modelId) || SERIES_MODELS[0];

  const prompt = `Você é a mentora do "Clube de Análise de Reels da Leislin" somada ao olhar implacável do "Código Viral".
Analise o roteiro abaixo considerando o DNA do Criador e o modelo "${modelObj.code}: ${modelObj.name}".

CRITÉRIOS DE AVALIAÇÃO:
1. Gancho nos primeiros 2 segundos? (Penalize severamente se começar com "oi gente", "tudo bem", "olá", "hoje eu vim falar").
2. Passa no Teste da Conversa? (Tem palavras formais/de seminário que ninguém fala para uma amiga?).
3. Vai direto ao ponto sem enrolação? (Tempo ideal até 60s / ~145 palavras).
4. Entrega uma única orientação clara e prática ("Mostre, não só explique")?
5. Tem CTA estratégica e corte rápido "Porta na Cara"?

DNA DO CRIADOR:
${buildCreatorContext(creator)}

ROTEIRO PARA ANALISAR:
"""
${script}
"""

Retorne EXATAMENTE este JSON:
{
  "score": 82,
  "verdict": "Resumo sincero em 1 frase",
  "keep": ["Ponto forte 1", "Ponto forte 2"],
  "adjust": ["Ajuste prático 1 (ex: trocar palavra X por Y)", "Ajuste prático 2"],
  "blockers": ["O que está impedindo de crescer / quebrando retenção (ou 'Nenhuma trava grave encontrada!')"],
  "improvedScript": "Versão reescrita e otimizada do roteiro aplicando todos os ajustes acima, mantendo o formato com marcações de tempo [00-03s], pronto para gravar."
}`;

  try {
    const { text, modelUsed } = await callGemini({ apiKey, modelName, taskType: 'analysis', prompt, expectJson: true, onStatus });
    const parsed = cleanJsonResponse(text);
    return { ...parsed, generatedBy: `Clube IA (${modelUsed})` };
  } catch (err) {
    if (!err?.fatal && isTransientServiceError(err)) {
      const offline = analyzeScriptOffline(script, creator);
      return {
        ...offline,
        generatedBy: 'Análise Local de Contingência (Pico de demanda no Gemini)',
        fallbackReason: err.message
      };
    }
    throw err;
  }
}

function analyzeScriptOffline(script, creator) {
  const raw = String(script || '').trim();
  const lower = raw.toLowerCase();
  const words = raw.split(/\s+/).filter(Boolean).length;
  const estSeconds = Math.round(words / 2.3);

  let score = 88;
  const keep = [];
  const adjust = [];
  const blockers = [];

  // Check greeting trap
  if (/^(?:\[.*?\]\s*)?(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem|fala galera)/i.test(raw.replace(/^\[.*?\]\s*/gm, ''))) {
    score -= 22;
    blockers.push('QUEBRA DE RETENÇÃO: O roteiro começa com cumprimento ("oi/olá/tudo bem"). Nos primeiros 2 segundos, comece direto no nome da série ou gancho!');
  } else {
    keep.push('Começo direto ao ponto sem cumprimentos que derrubam a retenção inicial.');
  }

  // Check length
  if (words > 165) {
    score -= 14;
    adjust.push(`Roteiro com ${words} palavras (~${estSeconds}s). Tente enxugar para no máximo 140 palavras (até 60s) ou divida o restante na próxima Parte.`);
  } else if (words < 25) {
    score -= 15;
    blockers.push('Roteiro curto demais para entregar a promessa do gancho (a menos que seja formato "Gancho + Leia a Legenda").');
  } else {
    keep.push(`Duração estimada excelente (~${estSeconds}s / ${words} palavras) dentro do limite de 1 minuto.`);
  }

  // Check forbidden or formal words
  const forbidden = (creator?.forbiddenWords || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const formalList = ['outrossim', 'adesão', 'hodiernamente', 'portanto', 'ademais', 'salientar', 'preconizar', ...forbidden];
  const foundFormal = formalList.filter((w) => w && lower.includes(w));
  if (foundFormal.length) {
    score -= 12;
    adjust.push(`Teste da Conversa: detectadas expressões formais/proibidas (${foundFormal.join(', ')}). Troque pelo jeito que você falaria com uma amiga.`);
  } else {
    keep.push('Linguagem natural e conversacional — passa no Teste da Conversa.');
  }

  // Check CTA
  if (/comenta|salva|manda|direct|compartilh|segue/i.test(lower)) {
    keep.push('Possui CTA clara conectada a engajamento.');
  } else {
    score -= 8;
    adjust.push('Adicione uma CTA estratégica no final (pedir opinião, palavra-chave no Direct ou salvamento) com corte seco "Porta na Cara".');
  }

  if (!blockers.length) {
    blockers.push('Nenhuma trava grave detectada — passou no Filtro 70%! Pronto para gravar.');
  }

  score = Math.max(15, Math.min(98, score));

  const cleanedScript = raw
    .replace(/^(oi[,!\s]*gente[,!\s]*tudo bem\??|olá pessoal[,!\s]*|bom dia[,!\s]*)/gim, '')
    .trim();

  return {
    score,
    verdict: score >= 70
      ? 'Aprovado no Filtro 70%! Pode gravar com confiança.'
      : 'Atenção: existem quebras de retenção que precisam de ajuste antes de gravar.',
    keep,
    adjust: adjust.length ? adjust : ['Revise apenas em voz alta para garantir ritmo fluido no Teleprompter.'],
    blockers,
    improvedScript: cleanedScript + (lower.includes('corte') ? '' : '\n\n[CTA + CORTE SECO PORTA NA CARA]'),
    generatedBy: 'Análise Local (Configure a chave Gemini para análise profunda por IA)'
  };
}

// ============================================================================
// 5. GERADOR DE IMAGEM DE FUNDO PARA CAPA VIA NANO BANANA / GEMINI IMAGE
// ============================================================================

export async function generateCoverBackground({ imagePrompt, apiKey }) {
  if (!apiKey) {
    throw new Error('Configure sua chave da API Gemini para gerar fundos inéditos com IA (você também pode usar os templates do Estúdio ou subir uma foto).');
  }

  const imgModels = [
    'gemini-nano-banana-2.1',
    'gemini-3.1-flash-image',
    'gemini-3-pro-image',
    'gemini-3.1-flash-lite-image',
    'gemini-2.5-flash-image'
  ];

  for (const m of imgModels) {
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/${m}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: `Create a vertical 9:16 editorial background image without any text, letters, or watermarks: ${imagePrompt}` }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT']
          }
        })
      }, 30000);
      if (!res.ok) continue;
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p) => p.inlineData?.data);
      if (imgPart) {
        const mime = imgPart.inlineData.mimeType || 'image/png';
        return `data:${mime};base64,${imgPart.inlineData.data}`;
      }
    } catch (_) {}
  }

  throw new Error('Seu plano/região da chave Gemini não habilitou geração de imagem via API (Nano Banana) neste momento. Use o botão "Copiar Prompt" para gerar no app Gemini ou use os Fundos Estúdio / Upload de Foto aqui no app!');
}

// ============================================================================
// 6. PREENCHIMENTO RÁPIDO DO DNA DO CRIADOR ATIVO (IA + FALLBACK LOCAL)
// ============================================================================

export async function generateCreatorDnaQuickFill({ creator, apiKey, modelName, onStatus = null }) {
  const niche = (creator?.niche || '').trim() || 'Criação de Conteúdo e Posicionamento Digital';
  const name = (creator?.name || '').trim() || 'Criador(a)';
  const hintPositioning = (creator?.positioning || '').trim();
  const hintAudience = (creator?.audience || '').trim();
  const hintProduct = (creator?.product || '').trim();

  if (!apiKey) {
    return buildOfflineCreatorDna({ name, niche, hintPositioning, hintAudience, hintProduct });
  }

  const prompt = `Complete e estruture o DNA estratégico completo para um criador de conteúdo no Instagram Reels/TikTok seguindo os métodos "O Meu Modelo de Reels" (Leislin) e "Código Viral".

INFORMAÇÕES JÁ FORNECIDAS PELO CRIADOR ATIVO:
- Nome/Marca: ${name}
- @Arroba: ${creator?.handle || '@perfil'}
- Nicho / Profissão / Área de atuação: ${niche}
- Posicionamento inicial (se houver): ${hintPositioning || '(gerar a partir do nicho)'}
- Público inicial (se houver): ${hintAudience || '(gerar a partir do nicho)'}
- Produto/Serviço inicial (se houver): ${hintProduct || '(sugerir o produto/serviço mais natural do nicho)'}

Retorne EXATAMENTE este JSON válido (em português natural do Brasil, sem jargões acadêmicos):
{
  "niche": "Nome claro e específico do nicho/profissão",
  "positioning": "Frase direta de posicionamento: Quem você ajuda + qual transformação prática entrega sem complicação",
  "targetGroupPrefix": "Escolha exatamente UMA opção entre: 'A mulher que', 'A pessoa que', 'O homem que', 'A mãe que', 'A empreendedora que', 'O profissional que'",
  "audience": "Descrição clara da persona (rotina, faixa de momento de vida, o que trava)",
  "pains": "1. Dor cotidiana hiperespecífica 1\\n2. Dor cotidiana hiperespecífica 2\\n3. Dor cotidiana hiperespecífica 3",
  "desires": "1. Desejo concreto 1\\n2. Desejo concreto 2\\n3. Desejo concreto 3",
  "objections": "Objeções reais entre aspas separadas por vírgula",
  "pronoun": "você",
  "tone": "Estilo natural de conversa (como conversa com amiga no café, sem parecer seminário)",
  "forbiddenWords": "oi gente tudo bem, outrossim, hodiernamente, e mais 4 termos técnicos chatos desse nicho que travam retenção",
  "product": "Oferta principal / próximo passo natural do funil",
  "manychatKeyword": "PALAVRACHAVE",
  "visualStyle": "Minimalista editorial estilo Apple, luz natural limpa, alto contraste para tipografia",
  "seriesSuggestions": [
    { "modelId": "serie_01", "title": "O que toda pessoa que [tema do nicho] deveria fazer, mas não faz", "parts": ["Parte 1 específica", "Parte 2 específica", "Parte 3 específica"] },
    { "modelId": "serie_02", "title": "Comece a...", "parts": ["Comece a [ação prática 1]", "Comece a [ação prática 2]", "Comece a [ação prática 3]"] },
    { "modelId": "serie_03", "title": "A pessoa que...", "parts": ["A pessoa que [situação específica 1] não deveria [erro]", "A pessoa que [situação específica 2] não deveria [erro]", "A pessoa que [situação específica 3] precisa entender isso"] },
    { "modelId": "serie_04", "title": "Como [desejo do nicho] sem [dificuldade comum] (parte 1)", "parts": ["Alternativa prática 1", "Alternativa prática 2", "Alternativa prática 3"] },
    { "modelId": "serie_05", "title": "Quem quer... deveria fazer isso aqui", "parts": ["Quem quer [desejo 1] deveria fazer isso aqui.", "Quem quer [desejo 2] deveria fazer isso aqui.", "Quem quer [desejo 3] deveria fazer isso aqui."] }
  ]
}`;

  try {
    const { text, modelUsed } = await callGemini({ apiKey, modelName, taskType: 'dna', prompt, expectJson: true, onStatus });
    const parsed = cleanJsonResponse(text);
    return { ...parsed, generatedBy: `IA (${modelUsed})` };
  } catch (err) {
    if (!err?.fatal && isTransientServiceError(err)) {
      const offline = buildOfflineCreatorDna({ name, niche, hintPositioning, hintAudience, hintProduct });
      return {
        ...offline,
        generatedBy: 'Motor Inteligente de Contingência (Pico de demanda no Google Gemini)',
        fallbackReason: err.message
      };
    }
    throw err;
  }
}

function buildOfflineCreatorDna({ name, niche, hintPositioning, hintAudience, hintProduct }) {
  const shortNiche = niche.split(/[(-]/)[0].trim() || 'seu mercado';
  const keyword = shortNiche
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 8) || 'GUIA';

  return {
    niche,
    positioning: hintPositioning || `Ajudo pessoas com rotina corrida a terem resultados reais em ${shortNiche} de forma simples e sem complicação.`,
    targetGroupPrefix: 'A pessoa que',
    audience: hintAudience || `Pessoas interessadas em ${shortNiche} que já tentaram métodos complexos, têm pouco tempo no dia a dia e buscam orientação prática e direta.`,
    pains: [
      `1. Tenta aplicar dicas soltas sobre ${shortNiche} e se frustra por não ver consistência.`,
      `2. Sente que falta tempo ou clareza para saber o que realmente priorizar primeiro.`,
      `3. Fica insegura na hora de escolher ou agir e acaba adiando a decisão.`
    ].join('\n'),
    desires: [
      `1. Resolver os principais desafios de ${shortNiche} com um passo a passo simples.`,
      `2. Economizar tempo e evitar erros caros ou retrabalho.`,
      `3. Sentir confiança e autonomia para manter resultados na prática.`
    ].join('\n'),
    objections: `"Não tenho tempo para aplicar isso agora", "Acho que meu caso é difícil demais", "Já tentei outras coisas antes e não funcionou".`,
    pronoun: 'você',
    tone: `Direto, acolhedor e prático — conversa leve como com uma amiga no café, com a autoridade acessível de ${name}.`,
    forbiddenWords: 'oi gente tudo bem, olá pessoal, outrossim, hodiernamente, ademais, vale salientar',
    product: hintProduct || `Consultoria / Atendimento Personalizado em ${shortNiche}`,
    manychatKeyword: keyword,
    visualStyle: 'Minimalista editorial estilo Apple, luz natural limpa e espaço claro/escuro para leitura imediata.',
    seriesSuggestions: [
      {
        modelId: 'serie_01',
        title: `O que toda pessoa em ${shortNiche} deveria fazer, mas não faz`,
        parts: [
          `O que toda pessoa que busca resultado em ${shortNiche} deveria fazer antes de começar, mas não faz.`,
          `O que todo mundo que trava em ${shortNiche} deveria conferir toda semana, mas não confere.`,
          `O que toda pessoa que quer economizar tempo com ${shortNiche} deveria fazer, mas ignora.`
        ]
      },
      {
        modelId: 'serie_02',
        title: 'Comece a...',
        parts: [
          `Comece a ajustar esse primeiro ponto na sua rotina de ${shortNiche}.`,
          `Comece a observar esse detalhe antes de tomar qualquer decisão em ${shortNiche}.`,
          `Comece a aplicar a regra dos 10 minutos para destravar ${shortNiche}.`
        ]
      },
      {
        modelId: 'serie_03',
        title: 'A pessoa que...',
        parts: [
          `A pessoa que tenta resolver ${shortNiche} só na pressa não deveria estranhar quando trava.`,
          `A pessoa que copia tudo da internet sem adaptar para a própria rotina precisa ouvir isso.`,
          `A pessoa que acha que precisa de perfeição para começar em ${shortNiche} está perdendo resultado.`
        ]
      },
      {
        modelId: 'serie_04',
        title: `Como dominar ${shortNiche} sem complicar sua rotina (parte 1)`,
        parts: [
          `Simplificar a primeira etapa com o que você já tem hoje.`,
          `Trocar excesso de informação por uma única meta semanal.`,
          `Evitar os 2 erros invisíveis que mais consomem seu tempo.`
        ]
      },
      {
        modelId: 'serie_05',
        title: 'Quem quer... deveria fazer isso aqui',
        parts: [
          `Quem quer resultado consistente em ${shortNiche} deveria fazer isso aqui.`,
          `Quem quer parar de cometer o mesmo erro básico em ${shortNiche} deveria fazer isso aqui.`,
          `Quem quer dar o próximo passo com ${hintProduct || shortNiche} deveria fazer isso aqui.`
        ]
      }
    ],
    generatedBy: 'Preenchimento Inteligente Local (Conecte sua chave Gemini para personalização avançada por IA)'
  };
}
