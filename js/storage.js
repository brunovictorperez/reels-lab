/**
 * Motor de Memória Permanente do Reels Lab
 * - Persistência automática no dispositivo via IndexedDB (com espelho em localStorage para configurações)
 * - Suporte a múltiplos perfis de criadores, pastas de séries, episódios, capas 9:16 e planejador
 * - Sincronização opcional e 100% gratuita com Google Drive via Google Apps Script
 */

const DB_NAME = 'ReelsLabDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';
const STATE_KEY = 'primary_state';
const FALLBACK_LS_KEY = 'reels_lab_fallback_v1';

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultState() {
  const creatorId = 'creator_default';
  const serie1Id = 'serie_default_1';
  const serie2Id = 'serie_default_2';

  return {
    version: 3,
    settings: {
      geminiKey: '',
      geminiModel: 'auto-gemini-4',
      theme: 'light',
      driveWebhookUrl: '',
      lastDriveSync: null,
      driveFolderUrl: ''
    },
    activeCreatorId: creatorId,
    creators: [
      {
        id: creatorId,
        name: 'Criador Principal',
        handle: '@seuperfil',
        professionId: 'nutricao',
        niche: 'Nutrição Comportamental e Emagrecimento sem Dieta Restritiva',
        positioning: 'Ajudo mulheres com rotina corrida a emagrecerem comendo o que gostam, sem terrorismo nutricional.',
        targetGroupPrefix: 'A mulher que',
        audience: 'Mulheres de 25 a 45 anos que trabalham fora, têm pouco tempo e vivem no efeito sanfona.',
        pains: '1. Chega do trabalho exausta à noite e ataca a geladeira.\n2. Começa dieta segunda-feira e desiste na sexta.\n3. Sente culpa toda vez que come um doce.',
        desires: '1. Emagrecer sem cortar pão, arroz ou chocolate.\n2. Ter uma rotina alimentar prática mesmo sem tempo.\n3. Sentir orgulho ao se olhar no espelho sem paranoia.',
        objections: '"Não tenho tempo de cozinhar marmita", "Tudo saudável é caro e sem graça", "Já tentei de tudo e nada funciona comigo".',
        pronoun: 'você',
        tone: 'Direto, acolhedor, conversa de amiga no café, zero palavras difíceis.',
        forbiddenWords: 'adesão ao planejamento alimentar, déficit calórico severo, outrossim, hodiernamente, oi gente tudo bem',
        product: 'Acompanhamento Nutricional Leveza (Consultoria + Cardápio Flexível)',
        manychatKeyword: 'LEVEZA',
        brandColor: '#EC4899',
        visualStyle: 'Estética editorial moderna, luz natural quente, fundo limpo com contraste forte para texto branco e destaque vibrante.',
        driveWebhookUrl: '',
        driveOnlyActive: true,
        driveLastSync: null,
        driveFolderUrl: ''
      }
    ],
    series: [
      {
        id: serie1Id,
        creatorId,
        name: 'A mulher que...',
        modelId: 'serie_03',
        description: 'Situações hiperespecíficas do dia a dia que geram identificação imediata.',
        color: '#EC4899',
        createdAt: new Date().toISOString()
      },
      {
        id: serie2Id,
        creatorId,
        name: 'Como emagrecer sem cortar tudo que você gosta',
        modelId: 'serie_04',
        description: 'Série fixa com alternativas práticas em cada episódio (o nome se mantém, muda a solução).',
        color: '#8B5CF6',
        createdAt: new Date().toISOString()
      }
    ],
    episodes: [
      {
        id: 'ep_demo_1',
        creatorId,
        seriesId: serie1Id,
        partNumber: 1,
        title: 'A mulher que passa o dia sem comer e ataca a geladeira à noite',
        onScreenText: 'A mulher que passa o dia sem comer... (Parte 1)',
        headlines: [
          'O SEGREDO da fome noturna 🤯',
          'A mulher que não come de dia...',
          'PARE de culpar sua força de vontade'
        ],
        funnelStage: 'topo',
        viralGoal: 'share',
        status: 'roteiro',
        score: 88,
        validation: {
          problem: 'Pular refeições na correria e descontar tudo à noite achando que é falta de disciplina.',
          learn: 'Como fazer um lanche estratégico às 16h quebra o ciclo da compulsão noturna.',
          lifeChange: 'Para de sentir culpa à noite e consegue emagrecer comendo com tranquilidade.'
        },
        script: `[00-03s | GANCHO + BENEFÍCIO]
A mulher que passa o dia inteiro sem comer e chega à noite atacando a geladeira não deveria achar que o problema é falta de força de vontade. E nos próximos 30 segundos eu vou te mostrar o ajuste simples que desliga essa fome de leão.

[03-18s | DESENVOLVIMENTO / IDENTIFICAÇÃO]
Eu sei que você sai de casa correndo, toma só um café, resolve mil pepinos no trabalho e quando vê já são cinco da tarde. Aí você passa o dia orgulhosa porque "quase não comeu". Só que quando você abre a porta de casa às oito da noite, seu corpo está em modo de emergência — e você come até o reboco da parede.

[18-32s | SOLUÇÃO PRÁTICA — MOSTRE!]
Eu, no seu lugar, não tentaria jantar uma folha de alface. Olha aqui na minha mão: duas coisas que cabem na bolsa — um iogurte proteico ou um punhado de castanhas com uma fruta às 16h. Você chega em casa com 50% menos fome e consegue escolher o que quer comer.

[32-42s | QUEBRA DE OBJEÇÃO & CTA]
Porque você pode ter certeza: emagrecer não é passar fome de dia para pagar a conta à noite. Se você já atacou a geladeira depois de um dia corrido, comenta LEVEZA aqui embaixo que eu te mando meu guia de lanches de 2 minutos no Direct. [CORTE SECO]`,
        caption: `Você também passa o dia "segurando a onda" e quando chega em casa parece que não tem fundo? 😅\n\nO nome disso não é falta de vergonha na cara. É biologia básica: quando você fica 6 a 8 horas sem energia, seu cérebro ativa o alarme de sobrevivência e vai pedir exatamente o alimento mais calórico e rápido da cozinha.\n\nO segredo não é fechar a boca à noite — é colocar um lanche inteligente no meio da tarde (mesmo sem estar morrendo de fome ainda). Comenta LEVEZA aqui embaixo que eu te envio no Direct minha lista de 5 lanches que cabem na bolsa e seguram a fome até o jantar!\n\n#emagrecimentosaudavel #nutricaosemterrorismo #rotinasaudavel #compulsaonoturna`,
        editingPrompt: `DIREÇÃO DE GRAVAÇÃO E EDIÇÃO (IA / CAPCUT):\n- Câmera na altura dos olhos (use o Teleprompter do Reels Lab).\n- [00-03s]: Comece falando SEM cumprimentar ("oi gente"). Texto grande fixo acima da cabeça: "A mulher que passa o dia sem comer... (Parte 1)". Zoom-in rápido de 105% para 115% na palavra "geladeira".\n- [03-18s]: Cortes secos removendo toda respiração/silêncio (jump cuts dinâmicos a cada frase).\n- [18-32s]: Mostre na câmera (B-Roll ou segurando na mão) o iogurte / fruta / castanhas no segundo exato em que citar.\n- [32-42s]: Legenda dinâmica palavra por palavra (estilo amarelo/branco com contorno preto) na área segura central. Efeito sonoro sutil ("pop") quando aparecer a palavra "LEVEZA".\n- FINAL (Porta na Cara): Corte o vídeo imediatamente na última sílaba de "Direct", sem sorriso longo ou despedida.`,
        coverImagePrompt: 'Fotografia editorial vertical 9:16 moderna, mulher confiante em cozinha iluminada pela luz natural da manhã segurando uma tigela colorida e saudável, fundo levemente desfocado para leitura nítida de texto no topo, paleta rosa coral e roxo suave, alta nitidez.',
        coverDataUrl: '',
        coverBgDataUrl: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    schedule: {
      [creatorId]: {
        seg: { seriesId: serie1Id, episodeId: 'ep_demo_1', timeSlot: '18h00 – 19h30', note: 'Postar Parte 1 e responder comentários na 1ª hora' },
        ter: { seriesId: serie2Id, episodeId: '', timeSlot: '12h00 – 13h00', note: 'Gravar Parte 1 da série fixa' },
        qua: { seriesId: serie1Id, episodeId: '', timeSlot: '18h00 – 19h30', note: 'Parte 2 da série A mulher que...' },
        qui: { seriesId: serie2Id, episodeId: '', timeSlot: '09h00 – 11h00', note: 'Parte 2 com foco em Salvamentos' },
        sex: { seriesId: serie1Id, episodeId: '', timeSlot: '12h00 – 13h00', note: 'Parte 3 fechando a semana' },
        sab: { seriesId: '', episodeId: '', timeSlot: '09h00 – 11h00', note: 'Opcional / Caixinha de dúvidas para novos episódios' },
        dom: { seriesId: '', episodeId: '', timeSlot: '18h00 – 19h30', note: 'Pausa estratégica / Gravar lote da semana' }
      }
    },
    hotTopicsCache: {}
  };
}

function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB indisponível'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadState() {
  try {
    const db = await openDB();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (result && result.creators && result.creators.length > 0) {
      return mergeDefaults(result);
    }
  } catch (err) {
    console.warn('Fallback para localStorage ao carregar:', err);
  }

  try {
    const raw = localStorage.getItem(FALLBACK_LS_KEY);
    if (raw) {
      return mergeDefaults(JSON.parse(raw));
    }
  } catch (_) {}

  const fresh = createDefaultState();
  await saveState(fresh);
  return fresh;
}

function mergeDefaults(loaded) {
  const def = createDefaultState();
  const mergedSettings = { ...def.settings, ...(loaded.settings || {}) };
  // Migrate deprecated/legacy Gemini model IDs saved in browser storage to the Gemini 4 Orchestrator
  if (!mergedSettings.geminiModel || /gemini-2\.|gemini-3\.8-flash-lite|gemini-3\.8-pro|gemini-flash-lite-latest/i.test(mergedSettings.geminiModel)) {
    mergedSettings.geminiModel = 'auto-gemini-4';
  }
  if (mergedSettings.theme !== 'light' && mergedSettings.theme !== 'dark') {
    mergedSettings.theme = 'light';
  }

  const creators = Array.isArray(loaded.creators) && loaded.creators.length ? loaded.creators : def.creators;
  // Migrate global Drive URL onto the first profile once so secondary profiles stay isolated
  if (mergedSettings.driveWebhookUrl && creators[0] && !creators[0].driveWebhookUrl && creators.every((c) => !c.driveWebhookUrl)) {
    creators[0] = {
      ...creators[0],
      driveWebhookUrl: mergedSettings.driveWebhookUrl,
      driveLastSync: mergedSettings.lastDriveSync || null,
      driveFolderUrl: mergedSettings.driveFolderUrl || '',
      driveOnlyActive: creators[0].driveOnlyActive !== false
    };
  }

  return {
    ...def,
    ...loaded,
    settings: mergedSettings,
    creators: creators.map((c) => ({ ...c, driveOnlyActive: c.driveOnlyActive !== false })),
    series: Array.isArray(loaded.series) ? loaded.series : def.series,
    episodes: Array.isArray(loaded.episodes) ? loaded.episodes : def.episodes,
    schedule: loaded.schedule || def.schedule,
    hotTopicsCache: loaded.hotTopicsCache || {}
  };
}

export function getEffectiveDriveWebhook(state, creator) {
  if (!state) return '';
  if (creator && creator.driveWebhookUrl) return creator.driveWebhookUrl.trim();
  // Global URL applies as fallback only for the primary creator so extra accounts don't collide
  const firstId = state.creators?.[0]?.id;
  if (!creator || creator.id === firstId) {
    return (state.settings?.driveWebhookUrl || '').trim();
  }
  return '';
}

export function buildFilteredDriveState(state, creatorId, onlyActive = true) {
  if (!onlyActive || !creatorId) return state;
  const creator = (state.creators || []).find((c) => c.id === creatorId);
  if (!creator) return state;

  return {
    ...state,
    activeCreatorId: creatorId,
    creators: [creator],
    series: (state.series || []).filter((s) => s.creatorId === creatorId),
    episodes: (state.episodes || []).filter((e) => e.creatorId === creatorId),
    schedule: state.schedule?.[creatorId] ? { [creatorId]: state.schedule[creatorId] } : {},
    hotTopicsCache: state.hotTopicsCache?.[creatorId] ? { [creatorId]: state.hotTopicsCache[creatorId] } : {}
  };
}

export function mergeDriveBackupState(currentState, loadedState, activeCreatorId, onlyActive = true) {
  if (!loadedState || !Array.isArray(loadedState.creators) || !loadedState.creators.length) {
    return currentState;
  }

  // Single-profile restore keeps other local profiles intact
  if (onlyActive && loadedState.creators.length === 1 && (currentState.creators || []).length > 1) {
    const incomingCreator = loadedState.creators[0];
    const targetId = currentState.creators.some((c) => c.id === incomingCreator.id)
      ? incomingCreator.id
      : (activeCreatorId || incomingCreator.id);

    const updatedCreator = { ...incomingCreator, id: targetId };
    const creators = currentState.creators.some((c) => c.id === targetId)
      ? currentState.creators.map((c) => (c.id === targetId ? updatedCreator : c))
      : [...currentState.creators, updatedCreator];

    const series = [
      ...(currentState.series || []).filter((s) => s.creatorId !== targetId),
      ...(loadedState.series || []).map((s) => ({ ...s, creatorId: targetId }))
    ];
    const episodes = [
      ...(currentState.episodes || []).filter((e) => e.creatorId !== targetId),
      ...(loadedState.episodes || []).map((e) => ({ ...e, creatorId: targetId }))
    ];
    const schedule = { ...(currentState.schedule || {}) };
    if (loadedState.schedule?.[incomingCreator.id]) {
      schedule[targetId] = loadedState.schedule[incomingCreator.id];
    }
    const hotTopicsCache = { ...(currentState.hotTopicsCache || {}) };
    if (loadedState.hotTopicsCache?.[incomingCreator.id]) {
      hotTopicsCache[targetId] = loadedState.hotTopicsCache[incomingCreator.id];
    }

    return mergeDefaults({
      ...currentState,
      activeCreatorId: targetId,
      creators,
      series,
      episodes,
      schedule,
      hotTopicsCache
    });
  }

  return mergeDefaults(loadedState);
}

const CREATOR_FIELD_MAP = { pain: 'pains', desire: 'desires', objection: 'objections' };

export function parseCreatorFieldItems(rawText, kind = 'pain') {
  const txt = String(rawText || '').trim();
  if (!txt) return [];
  const splitter = kind === 'objection' ? /[,;\n]+/ : /\n+/;
  return txt
    .split(splitter)
    .map((line) => line.replace(/^\d+[\.\)\-\s]+/, '').replace(/^["']|["']$/g, '').trim())
    .filter(Boolean);
}

export function addCreatorFieldItem(creator, kind, value) {
  const field = CREATOR_FIELD_MAP[kind];
  const clean = String(value || '').trim();
  if (!creator || !field || !clean) return false;

  const existing = parseCreatorFieldItems(creator[field], kind);
  if (existing.some((item) => item.toLowerCase() === clean.toLowerCase())) {
    return false;
  }
  const next = [...existing, clean];
  creator[field] = kind === 'objection'
    ? next.map((s) => `"${s}"`).join(', ')
    : next.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return true;
}

export function removeCreatorFieldItem(creator, kind, value) {
  const field = CREATOR_FIELD_MAP[kind];
  const target = String(value || '').trim().toLowerCase();
  if (!creator || !field || !target) return false;

  const existing = parseCreatorFieldItems(creator[field], kind);
  const filtered = existing.filter((item) => item.toLowerCase() !== target);
  if (filtered.length === existing.length) return false;

  creator[field] = kind === 'objection'
    ? filtered.map((s) => `"${s}"`).join(', ')
    : filtered.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return true;
}

export async function saveState(state) {
  // Always mirror lightweight version / full state safely
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(state, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar no IndexedDB, tentando localStorage:', err);
  }

  try {
    localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(state));
  } catch (quotaErr) {
    // If coverDataUrl images exceed localStorage 5MB limit, IndexedDB already saved them!
    // Save a lightweight metadata copy in localStorage just in case.
    try {
      const light = {
        ...state,
        episodes: (state.episodes || []).map((ep) => ({
          ...ep,
          coverDataUrl: '',
          coverBgDataUrl: ''
        }))
      };
      localStorage.setItem(FALLBACK_LS_KEY, JSON.stringify(light));
    } catch (_) {}
  }
}

export function exportBackupJson(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `reels-lab-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function syncToGoogleDrive(state, webhookUrl) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    throw new Error('URL do Web App do Google Apps Script inválida.');
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'sync',
      exportReadableFiles: true,
      state
    })
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('O Google Drive respondeu em formato inesperado. Verifique se o Apps Script foi implantado como "Qualquer pessoa".');
  }

  if (!json.ok) {
    throw new Error(json.error || 'Falha ao sincronizar com o Google Drive.');
  }
  return json;
}

export async function loadFromGoogleDrive(webhookUrl) {
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    throw new Error('URL do Web App do Google Apps Script inválida.');
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'load' })
  });

  const text = await res.text();
  const json = JSON.parse(text);
  if (!json.ok) {
    throw new Error(json.error || 'Falha ao carregar do Google Drive.');
  }
  return json;
}
