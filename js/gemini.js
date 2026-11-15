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

async function callGemini({ apiKey, modelName = 'gemini-2.5-flash', prompt, systemInstruction = '', useSearch = false, expectJson = true }) {
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const modelsToTry = [modelName, 'gemini-2.5-flash', 'gemini-2.0-flash'].filter((v, i, a) => v && a.indexOf(v) === i);
  let lastError = null;

  for (const model of modelsToTry) {
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

      const res = await fetch(`${BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        // If search tool is unsupported on a model/tier, retry without search if possible
        if (useSearch && /search|tool/i.test(msg)) {
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      const candidate = data?.candidates?.[0];
      const text = (candidate?.content?.parts || []).map((p) => p.text || '').join('\n').trim();
      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((c) => c?.web ? { title: c.web.title, uri: c.web.uri } : null)
        .filter(Boolean);

      return { text, modelUsed: model, sources };
    } catch (err) {
      lastError = err;
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
    modelName
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

  const { text, modelUsed } = await callGemini({ apiKey, modelName, prompt, systemInstruction, expectJson: true });
  const parsed = cleanJsonResponse(text);
  return { ...parsed, generatedBy: `IA (${modelUsed})` };
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

export async function generateSeriesIdeas({ creator, modelId, seriesName, existingTitles = [], apiKey, modelName }) {
  const modelObj = SERIES_MODELS.find((m) => m.id === modelId) || SERIES_MODELS[0];

  if (!apiKey) {
    return {
      ideas: [
        { topic: `O erro silencioso número 1 em ${creator?.niche || 'sua área'} que atrasa seus resultados`, problem: 'Hábito automático errado', learn: 'Como substituir em 2 minutos', lifeChange: 'Resultado visível já na semana' },
        { topic: `O ajuste de 5 minutos antes de começar a semana`, problem: 'Falta de organização prática', learn: 'Checklist rápido de domingo', lifeChange: 'Zero correria na segunda-feira' },
        { topic: `O mito que te contaram sobre ${creator?.product || 'seu objetivo'}`, problem: 'Crença limitante comum', learn: 'O que realmente funciona na prática', lifeChange: 'Economiza tempo e dinheiro' },
        { topic: `O que fazer quando você acha que não tem tempo para isso`, problem: 'Rotina apertada', learn: 'Versão mínima viável do hábito', lifeChange: 'Mantém constância mesmo nos dias difíceis' },
        { topic: `A dúvida que todo mundo me manda no WhatsApp sobre isso`, problem: 'Insegurança na execução', learn: 'Passo claro de aplicação', lifeChange: 'Mais confiança para agir hoje' }
      ],
      generatedBy: 'Sugestões Locais'
    };
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

  const { text, modelUsed } = await callGemini({ apiKey, modelName, prompt, expectJson: true });
  const parsed = cleanJsonResponse(text);
  return { ...parsed, generatedBy: `IA (${modelUsed})` };
}

// ============================================================================
// 3. RADAR DE TEMAS QUENTES (TIMING + PESQUISA GOOGLE)
// ============================================================================

export async function searchHotTopics({ creator, focusQuery = '', apiKey, modelName }) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  if (!apiKey) {
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
      generatedBy: 'Modo Demonstração (Configure sua chave Gemini para buscar notícias reais do Google)'
    };
  }

  const prompt = `Hoje é ${today}.
Use a Pesquisa Google (se disponível) para encontrar 4 notícias ATUAIS, assuntos quentes em alta no Brasil ou tendências virais de redes sociais desta semana que possam ser recicladas pelo método "O Timing" do Código Viral ("Ataque outras bolhas sem sair da sua").
${focusQuery ? `Foco adicional pedido pelo criador: "${focusQuery}".` : ''}

CONTEXTO DO CRIADOR:
${buildCreatorContext(creator)}

Para cada uma das 4 notícias/tendências, gere 3 ângulos de Reels conectados ao nicho do criador (Topo=Descoberta <30s, Meio=Conexão 30-45s, Fundo=Venda 45-60s), escolhendo o melhor modelo entre: serie_01, serie_02, serie_03, serie_04, serie_05, codigo_viral.

Responda APENAS com um JSON válido no formato:
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
      prompt,
      useSearch: true,
      expectJson: false
    });
    const parsed = cleanJsonResponse(text);
    return { ...parsed, sources, generatedBy: `Google Search + IA (${modelUsed})` };
  } catch (err) {
    // Fallback without googleSearch tool in case the user's tier/model restricts search grounding
    const { text, modelUsed } = await callGemini({
      apiKey,
      modelName,
      prompt,
      useSearch: false,
      expectJson: true
    });
    const parsed = cleanJsonResponse(text);
    return { ...parsed, sources: [], generatedBy: `IA (${modelUsed})` };
  }
}

// ============================================================================
// 4. CLUBE DE ANÁLISE IA (EXTRA 3 + RETENÇÃO DO CÓDIGO VIRAL)
// ============================================================================

export async function analyzeScript({ script, creator, modelId = 'serie_03', apiKey, modelName }) {
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

  const { text, modelUsed } = await callGemini({ apiKey, modelName, prompt, expectJson: true });
  const parsed = cleanJsonResponse(text);
  return { ...parsed, generatedBy: `Clube IA (${modelUsed})` };
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
// 5. GERADOR DE IMAGEM DE FUNDO PARA CAPA VIA GEMINI / IMAGEN
// ============================================================================

export async function generateCoverBackground({ imagePrompt, apiKey }) {
  if (!apiKey) {
    throw new Error('Configure sua chave da API Gemini para gerar fundos inéditos com IA (você também pode usar os templates do Estúdio ou subir uma foto).');
  }

  // 1. Try Imagen 3 endpoint
  try {
    const res = await fetch(`${BASE_URL}/imagen-3.0-generate-002:predict?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: `${imagePrompt}. Vertical 9:16 aspect ratio, clean high contrast studio lighting, NO text or words in the image.` }],
        parameters: { sampleCount: 1, aspectRatio: '9:16' }
      })
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data?.predictions?.[0]?.bytesBase64Encoded;
      if (b64) return `data:image/png;base64,${b64}`;
    }
  } catch (_) {}

  // 2. Fallback to Gemini multimodal image generation models
  const imgModels = ['gemini-2.0-flash-exp-image-generation', 'gemini-2.5-flash-image'];
  for (const m of imgModels) {
    try {
      const res = await fetch(`${BASE_URL}/${m}:generateContent?key=${encodeURIComponent(apiKey)}`, {
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
      });
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

  throw new Error('Seu plano/região da chave Gemini não habilitou geração de imagem via API neste momento. Use o botão "Copiar Prompt da Capa" para gerar no Gemini/ImageFX ou use os Fundos Estúdio / Upload de Foto aqui no app!');
}
