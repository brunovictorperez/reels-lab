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

export function getOrchestratorQueue(modelName = 'auto-gemini-4', taskType = 'creative') {
  const preferred = String(modelName || '').trim();
  const isLegacy = !preferred || /^(?:gemini-2\.|gemini-3\.8-flash-lite|gemini-3\.8-pro|gemini-flash-lite-latest)/i.test(preferred);

  if (isLegacy || preferred === 'auto-gemini-4') {
    return [
      'gemini-4-hydrogen',
      'gemini-4-neon',
      'gemini-4-argon',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite'
    ];
  }

  if (preferred === 'auto-gemini-4-pro') {
    if (taskType === 'fast' || taskType === 'radar') {
      return [
        'gemini-4-neon',
        'gemini-4-hydrogen',
        'gemini-4-argon',
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite'
      ];
    }
    return [
      'gemini-4-neon',
      'gemini-4-argon',
      'gemini-4-carbon',
      'gemini-4-hydrogen',
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite'
    ];
  }

  return [
    preferred,
    'gemini-4-hydrogen',
    'gemini-4-neon',
    'gemini-4-argon',
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite'
  ].filter((v, i, a) => v && a.indexOf(v) === i);
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

async function callGemini({ apiKey, modelName = 'auto-gemini-4', taskType = 'creative', prompt, systemInstruction = '', useSearch = false, expectJson = true, onStatus = null }) {
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const baseQueue = getOrchestratorQueue(modelName, taskType);
  const tried = new Set();
  const queue = [...baseQueue];
  let didDiscover = false;
  let lastError = null;

  for (let i = 0; i < queue.length; i++) {
    const model = queue[i];
    if (!model || tried.has(model)) continue;
    tried.add(model);

    if (typeof onStatus === 'function') {
      const shortModel = model.replace(/^gemini-/, '');
      onStatus(i === 0 ? `Gemini ${shortModel}...` : `Alternando p/ ${shortModel}...`);
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
          throw Object.assign(new Error(msg), { fatal: true });
        }
        if (useSearch && (res.status === 400 || res.status === 403 || res.status === 429 || /search|grounding|billing|tier|tool|permission|not available|free|unsupported/i.test(msg))) {
          throw Object.assign(new Error(msg), { searchUnsupported: true });
        }

        const errObj = Object.assign(new Error(msg), {
          transient: res.status === 503 || res.status === 429 || res.status >= 500 ||
            /high demand|overloaded|unavailable|try again|temporarily|quota|rate limit|resource_exhausted/i.test(msg)
        });
        lastError = errObj;

        if (!didDiscover) {
          didDiscover = true;
          const discovered = await discoverActiveGeminiModels(apiKey);
          discovered.forEach((dm) => {
            if (!tried.has(dm) && !queue.includes(dm)) queue.push(dm);
          });
        }
        continue;
      }

      const candidate = data?.candidates?.[0];
      const text = (candidate?.content?.parts || []).map((p) => p.text || '').join('\n').trim();
      if (!text) {
        lastError = new Error(`Resposta vazia de ${model}.`);
        continue;
      }
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((c) => c?.web ? { title: c.web.title, uri: c.web.uri } : null)
        .filter(Boolean);

      return { text, modelUsed: model, sources };
    } catch (err) {
      if (err?.fatal || err?.searchUnsupported) throw err;
      lastError = Object.assign(err, { transient: true });

      if (!didDiscover) {
        didDiscover = true;
        const discovered = await discoverActiveGeminiModels(apiKey);
        discovered.forEach((dm) => {
          if (!tried.has(dm) && !queue.includes(dm)) queue.push(dm);
        });
      }
    }
  }

  throw lastError || new Error('Erro ao conectar com a API do Google Gemini.');
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
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function parseRssXmlItems(xmlText, defaultSource = 'Google News', limit = 6) {
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
        if (cleanTitle) {
          items.push({
            title: decodeXmlEntities(cleanTitle),
            link,
            pubDate,
            sourceName: decodeXmlEntities(sourceName),
            summary: desc.slice(0, 240),
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
    if (cleanTitle) {
      items.push({
        title: cleanTitle,
        link,
        pubDate,
        sourceName,
        summary: desc.slice(0, 240),
        channel: defaultSource
      });
    }
  }
  return items;
}

async function fetchSingleRssFeed(feed) {
  try {
    const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
    const res = await fetchWithTimeout(rss2jsonUrl, { method: 'GET' }, 10000);
    if (res.ok) {
      const data = await res.json();
      if (data?.status === 'ok' && Array.isArray(data.items) && data.items.length) {
        return data.items.slice(0, 6).map((item) => {
          const rawTitle = String(item.title || '').trim();
          const cleanTitle = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
          const inferredSrc = rawTitle.match(/\s+-\s+([^-]+)$/)?.[1]?.trim();
          return {
            title: decodeXmlEntities(cleanTitle),
            link: String(item.link || '').trim(),
            pubDate: String(item.pubDate || '').trim(),
            sourceName: decodeXmlEntities(item.author || inferredSrc || feed.label),
            summary: decodeXmlEntities(item.description || '').slice(0, 240),
            channel: feed.label
          };
        }).filter((it) => it.title);
      }
    }
  } catch {
    // Tenta proxy XML direto abaixo
  }

  try {
    const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feed.url)}`;
    const res = await fetchWithTimeout(allOriginsUrl, { method: 'GET' }, 10000);
    if (res.ok) {
      const xml = await res.text();
      return parseRssXmlItems(xml, feed.label, 6);
    }
  } catch {
    // Sem acesso via proxy
  }

  return [];
}

function dedupeTrendItems(rawItems = []) {
  const seen = new Map();
  for (const item of rawItems) {
    const key = String(item.link || item.title || '').toLowerCase().trim();
    if (!key || !item.title || seen.has(key)) continue;
    seen.set(key, item);
  }
  return Array.from(seen.values()).slice(0, 15);
}

export async function fetchLiveInternetTrends({ focusQuery = '', niche = '', driveWebhookUrl = '', onStatus = null } = {}) {
  const cleanNiche = String(niche || '').replace(/[\/|,;]+/g, ' ').trim().split(/\s+/).slice(0, 5).join(' ');
  const baseTopic = String(focusQuery || '').trim() || cleanNiche || 'tendencias redes sociais brasil';

  if (driveWebhookUrl) {
    if (typeof onStatus === 'function') onStatus('Buscando notícias reais via Radar Drive...');
    try {
      const res = await fetchWithTimeout(driveWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'fetch_trends', query: focusQuery, niche: cleanNiche })
      }, 12000);
      if (res.ok) {
        const data = await res.json();
        if (data?.ok && Array.isArray(data.items) && data.items.length) {
          const items = dedupeTrendItems(data.items);
          const channelsUsed = [...new Set(items.map((it) => it.channel || 'Google News'))];
          return { items, channelsUsed };
        }
      }
    } catch {
      // Apps Script desatualizado ou indisponível: cai automaticamente nos feeds públicos no navegador
    }
  }

  if (typeof onStatus === 'function') onStatus('Coletando notícias reais, Google Trends e X (BR)...');

  const feeds = [
    {
      label: 'Google News Brasil',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${baseTopic} when:7d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
    },
    {
      label: 'Google Trends BR',
      url: 'https://trends.google.com/trending/rss?geo=BR'
    },
    {
      label: 'X / Viral Brasil',
      url: `https://news.google.com/rss/search?q=${encodeURIComponent(`(${baseTopic}) (viral OR twitter OR X OR polemica OR reels OR tiktok) when:5d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
    }
  ];

  const results = await Promise.allSettled(feeds.map((feed) => fetchSingleRssFeed(feed)));
  const collected = [];
  const channelsUsed = [];

  results.forEach((res, idx) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value) && res.value.length) {
      collected.push(...res.value);
      channelsUsed.push(feeds[idx].label);
    }
  });

  return {
    items: dedupeTrendItems(collected),
    channelsUsed: channelsUsed.length ? channelsUsed : ['Internet RSS']
  };
}

export async function searchHotTopics({ creator, focusQuery = '', apiKey, modelName, driveWebhookUrl = '', onStatus = null }) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  if (!apiKey) {
    return buildOfflineHotTopics(creator);
  }

  const liveFeed = await fetchLiveInternetTrends({
    focusQuery,
    niche: creator?.niche || '',
    driveWebhookUrl,
    onStatus
  });

  if (liveFeed.items.length > 0) {
    const formattedFeed = liveFeed.items.map((item, idx) =>
      `[${idx + 1}] ${item.title} | Fonte: ${item.sourceName || item.channel} | Data: ${formatTrendDate(item.pubDate)} | Canal: ${item.channel}${item.summary ? ` | Resumo: ${item.summary}` : ''}`
    ).join('\n');

    const groundedPrompt = `Hoje é ${today}.
Abaixo estão ${liveFeed.items.length} NOTÍCIAS E TRENDS REAIS COLETADAS DA INTERNET AGORA (Google News Brasil, Google Trends BR e repercussões do X/redes sociais):

${formattedFeed}

${focusQuery ? `Foco pedido pelo criador: "${focusQuery}".` : ''}

CONTEXTO DO CRIADOR:
${buildCreatorContext(creator)}

REGRAS ESTRITAS:
1. Baseie-se 100% NOS ASSUNTOS REAIS NUMERADOS ACIMA ([1] a [${liveFeed.items.length}]). É PROIBIDO inventar notícias, eventos ou dados que não estejam na lista acima.
2. Escolha os 4 assuntos reais mais fortes para reciclar pelo método "O Timing" do Código Viral ("Ataque outras bolhas sem sair da sua"), preferindo notícias recentes e virais com boa ponte para o nicho do criador.
3. Em cada um dos 4 itens, informe exatamente o "sourceIndex" correspondente (número de 1 a ${liveFeed.items.length}).
4. Para cada assunto escolhido, crie 3 ângulos de Reels conectados ao nicho do criador (Topo=Descoberta <30s, Meio=Conexão 30-45s, Fundo=Venda 45-60s), usando: serie_01, serie_02, serie_03, serie_04, serie_05 ou codigo_viral.

Responda APENAS com um JSON válido no formato:
{
  "topics": [
    {
      "sourceIndex": 1,
      "trendTitle": "Título fiel à notícia/trend real [sourceIndex]",
      "timingWhy": "Por que está em alta agora segundo a matéria/trend (1-2 frases)",
      "bubbleBridge": "Como conectar esse assunto real com o nicho do criador sem virar página de fofoca",
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
      prompt: groundedPrompt,
      useSearch: false,
      expectJson: true,
      onStatus
    });

    const parsed = cleanJsonResponse(text);
    const groundedTopics = (parsed.topics || []).map((t, idx) => {
      const refIdx = Number(t.sourceIndex);
      const matched = (refIdx >= 1 && refIdx <= liveFeed.items.length)
        ? liveFeed.items[refIdx - 1]
        : (liveFeed.items[idx] || liveFeed.items[0]);
      return {
        ...t,
        sourceName: matched?.sourceName || matched?.channel || 'Internet',
        publishedAt: formatTrendDate(matched?.pubDate),
        sourceUrl: matched?.link || ''
      };
    });

    const sources = [];
    const seenUri = new Set();
    groundedTopics.forEach((t) => {
      if (t.sourceUrl && !seenUri.has(t.sourceUrl)) {
        seenUri.add(t.sourceUrl);
        sources.push({
          title: `${t.trendTitle} (${t.sourceName})`,
          uri: t.sourceUrl
        });
      }
    });
    liveFeed.items.forEach((it) => {
      if (it.link && !seenUri.has(it.link) && sources.length < 8) {
        seenUri.add(it.link);
        sources.push({
          title: `${it.title} (${it.sourceName})`,
          uri: it.link
        });
      }
    });

    return {
      topics: groundedTopics,
      sources,
      generatedBy: `Internet ao Vivo (${liveFeed.channelsUsed.join(' + ')}) + IA (${modelUsed})`
    };
  }

  // Fallback exclusivo para chaves pagas com Google Search Grounding nativo caso os feeds RSS estejam bloqueados
  const searchPrompt = `Hoje é ${today}.
Use a Pesquisa Google para encontrar 4 notícias ATUAIS reais desta semana no Brasil (portais de notícias, Google Trends ou assuntos em alta no X/Twitter) que possam ser recicladas pelo método "O Timing" do Código Viral ("Ataque outras bolhas sem sair da sua").
${focusQuery ? `Foco adicional pedido pelo criador: "${focusQuery}".` : ''}

CONTEXTO DO CRIADOR:
${buildCreatorContext(creator)}

Retorne APENAS JSON válido no formato:
{
  "topics": [
    {
      "trendTitle": "Nome da notícia / trend atual real",
      "timingWhy": "Por que está em alta agora (1-2 frases)",
      "bubbleBridge": "Como conectar esse assunto quente com o nicho do criador sem virar página de fofoca",
      "angles": [
        { "funnel": "topo", "modelId": "codigo_viral", "title": "Ideia de título/gancho para Descoberta (<30s)" },
        { "funnel": "meio", "modelId": "serie_03", "title": "Ideia de episódio para Conexão (30-45s)" },
        { "funnel": "fundo", "modelId": "serie_05", "title": "Ideia de episódio para Venda / Quebra de objeção" }
      ]
    }
  ]
}`;

  try {
    const { text, modelUsed, sources } = await callGemini({
      apiKey,
      modelName,
      taskType: 'radar',
      prompt: searchPrompt,
      useSearch: true,
      expectJson: false,
      onStatus
    });
    if (!sources || !sources.length) {
      throw new Error('A pesquisa não retornou fontes reais verificáveis da Internet.');
    }
    const parsed = cleanJsonResponse(text);
    const enrichedTopics = (parsed.topics || []).map((t, idx) => {
      const s = sources[idx] || sources[0];
      return {
        ...t,
        sourceName: s?.title || 'Google Search',
        publishedAt: 'Agora',
        sourceUrl: s?.uri || ''
      };
    });
    return { topics: enrichedTopics, sources, generatedBy: `Google Search ao Vivo + IA (${modelUsed})` };
  } catch (err) {
    if (err?.fatal) throw err;
    throw new Error('Não foi possível carregar notícias reais da Internet agora (feeds RSS bloqueados nesta rede e Google Search Grounding indisponível na chave gratuita). Tente novamente em instantes ou atualize o Google Apps Script.');
  }
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
