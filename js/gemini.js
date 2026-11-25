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

const RATE_LIMIT_STORAGE_KEY = 'reels_lab_api_usage_v1';
let memoryRateLimitStore = { models: {} };

export const MODEL_RATE_LIMIT_CATALOG = [
  {
    id: 'gemini-4-hydrogen',
    name: 'Gemini 4 Hydrogen',
    tierLabel: 'Grátis & Pago',
    free: { rpm: 5, tpm: 250000, rpd: 20 },
    tier1: { rpm: 1000, tpm: 1000000, rpd: 10000 }
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    tierLabel: 'Grátis & Pago',
    free: { rpm: 5, tpm: 250000, rpd: 20 },
    tier1: { rpm: 1000, tpm: 1000000, rpd: 10000 }
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    tierLabel: 'Grátis & Pago',
    free: { rpm: 5, tpm: 250000, rpd: 20 },
    tier1: { rpm: 1000, tpm: 1000000, rpd: 10000 }
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash-Lite',
    tierLabel: 'Alto Volume',
    free: { rpm: 15, tpm: 250000, rpd: 500 },
    tier1: { rpm: 2000, tpm: 4000000, rpd: 20000 }
  },
  {
    id: 'gemini-4-neon',
    name: 'Gemini 4 Neon',
    tierLabel: 'API Paga',
    free: null,
    tier1: { rpm: 150, tpm: 2000000, rpd: 10000 }
  },
  {
    id: 'gemini-4-argon',
    name: 'Gemini 4 Argon',
    tierLabel: 'API Paga',
    free: null,
    tier1: { rpm: 300, tpm: 1000000, rpd: 10000 }
  },
  {
    id: 'gemini-4-carbon',
    name: 'Gemini 4 Carbon',
    tierLabel: 'API Paga',
    free: null,
    tier1: { rpm: 100, tpm: 1000000, rpd: 5000 }
  }
];

function readRateLimitStore() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.models) {
          memoryRateLimitStore = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // Fallback em memória se localStorage estiver indisponível
  }
  if (!memoryRateLimitStore || typeof memoryRateLimitStore !== 'object' || !memoryRateLimitStore.models) {
    memoryRateLimitStore = { models: {} };
  }
  return memoryRateLimitStore;
}

function writeRateLimitStore(store) {
  memoryRateLimitStore = store;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // Ignora erro de quota do localStorage
  }
}

export function getPacificDateKey(nowMs = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date(nowMs));
    const map = {};
    parts.forEach((p) => { map[p.type] = p.value; });
    if (map.year && map.month && map.day) {
      return `${map.year}-${map.month}-${map.day}`;
    }
  } catch {
    // Fallback UTC-8
  }
  return new Date(nowMs - (8 * 60 * 60 * 1000)).toISOString().slice(0, 10);
}

export function getTimeUntilPacificReset(nowMs = Date.now()) {
  let hourPT = null;
  let minutePT = null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(new Date(nowMs));
    const map = {};
    parts.forEach((p) => { map[p.type] = p.value; });
    const h = Number(map.hour);
    const m = Number(map.minute);
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      hourPT = h === 24 ? 0 : h;
      minutePT = m;
    }
  } catch {
    // Fallback abaixo
  }

  if (hourPT === null || minutePT === null) {
    const dt = new Date(nowMs - (8 * 60 * 60 * 1000));
    hourPT = dt.getUTCHours();
    minutePT = dt.getUTCMinutes();
  }

  const totalRemainingMin = Math.max(1, (24 * 60) - (hourPT * 60 + minutePT));
  const hours = Math.floor(totalRemainingMin / 60);
  const minutes = totalRemainingMin % 60;
  const resetTimestamp = nowMs + (totalRemainingMin * 60 * 1000);
  let localResetTime = '';
  try {
    localResetTime = new Date(resetTimestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    localResetTime = '';
  }

  return {
    hours,
    minutes,
    totalRemainingMin,
    resetTimestamp,
    localResetTime,
    label: `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}min`
  };
}

export function isDailyQuotaErrorMessage(msg = '') {
  const txt = String(msg || '');
  return /GenerateRequestsPerDay|RequestsPerDay|requests per day|per[\s_-]*day|\bRPD\b|daily limit|limit:\s*0|free_tier_requests.*limit:\s*0|exceeded your current quota/i.test(txt);
}

function extractReportedRpdLimit(errorData = null, msg = '') {
  const details = Array.isArray(errorData?.error?.details) ? errorData.error.details : [];
  for (const d of details) {
    const violations = Array.isArray(d?.violations) ? d.violations : [];
    for (const v of violations) {
      const idStr = `${v?.quotaId || ''} ${v?.quotaMetric || ''}`;
      if (/PerDay|RPD|daily/i.test(idStr) && v?.quotaValue !== undefined && v?.quotaValue !== null) {
        const parsed = Number(v.quotaValue);
        if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
      }
    }
  }
  const msgStr = String(msg || '');
  if (/PerDay|per[\s_-]*day|RPD|daily|free_tier_requests/i.test(msgStr)) {
    const m = msgStr.match(/limit:\s*(\d+)/i);
    if (m) {
      const parsed = Number(m[1]);
      if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

export function recordModelApiEvent({
  model,
  status = 'ok',
  inputTokens = 0,
  outputTokens = 0,
  totalTokens = 0,
  errorMessage = '',
  retryAfterSec = 0,
  isDailyQuota = false,
  reportedRpdLimit = null,
  nowMs = Date.now()
} = {}) {
  const modelId = resolveSelectedModel(model || 'gemini-4-hydrogen');
  const store = readRateLimitStore();
  if (!store.models[modelId]) {
    store.models[modelId] = { events: [] };
  }
  const entry = store.models[modelId];
  const ptDay = getPacificDateKey(nowMs);
  const cutoffMs = nowMs - (48 * 60 * 60 * 1000);

  const inTok = Math.max(0, Number(inputTokens) || 0);
  const totTok = Math.max(inTok + (Number(outputTokens) || 0), Number(totalTokens) || 0);

  const existingEvents = Array.isArray(entry.events)
    ? entry.events.filter((ev) => ev && ev.ts >= cutoffMs)
    : [];

  existingEvents.push({
    ts: nowMs,
    ptDay,
    status,
    inputTokens: inTok,
    totalTokens: totTok
  });

  if (existingEvents.length > 500) {
    entry.events = existingEvents.slice(-500);
  } else {
    entry.events = existingEvents;
  }

  entry.lastUsedAt = nowMs;
  entry.lastStatus = status;

  if (typeof reportedRpdLimit === 'number' && !Number.isNaN(reportedRpdLimit) && reportedRpdLimit >= 0) {
    entry.detectedRpdLimit = reportedRpdLimit;
    entry.detectedRpdPtDay = ptDay;
  }

  if (status === 'ok') {
    entry.lastError = '';
    entry.cooldownUntil = 0;
    if (entry.dailyBlockedPtDay === ptDay) {
      entry.dailyBlockedPtDay = '';
    }
  } else {
    entry.lastError = String(errorMessage || '').slice(0, 220);
    if (status === 'rate_limited') {
      if (isDailyQuota) {
        entry.dailyBlockedPtDay = ptDay;
      } else {
        const waitMs = Math.max(15000, (Number(retryAfterSec) || 60) * 1000);
        entry.cooldownUntil = nowMs + waitMs;
      }
    }
  }

  writeRateLimitStore(store);
  return entry;
}

export function clearRateLimitUsage() {
  writeRateLimitStore({ models: {} });
}

export function getRateLimitDashboard({
  selectedModel = 'gemini-4-hydrogen',
  tier = 'free',
  extraModels = [],
  availableApiModels = null,
  nowMs = Date.now()
} = {}) {
  const store = readRateLimitStore();
  const ptDay = getPacificDateKey(nowMs);
  const oneMinAgo = nowMs - 60000;
  const reset = getTimeUntilPacificReset(nowMs);
  const normalizedSelected = resolveSelectedModel(selectedModel);
  const useTier1 = tier === 'tier1';
  const availableSet = Array.isArray(availableApiModels) && availableApiModels.length
    ? new Set(availableApiModels)
    : null;

  const catalogIds = new Set(MODEL_RATE_LIMIT_CATALOG.map((m) => m.id));
  const extraIds = [...(extraModels || []), normalizedSelected]
    .map((id) => resolveSelectedModel(id))
    .filter((id) => id && !catalogIds.has(id));
  const uniqueExtra = Array.from(new Set(extraIds));

  const allModels = [
    ...MODEL_RATE_LIMIT_CATALOG,
    ...uniqueExtra.map((id) => ({
      id,
      name: formatModelDisplayName(id),
      tierLabel: 'Personalizado / API',
      free: { rpm: 15, tpm: 250000, rpd: 250 },
      tier1: { rpm: 1000, tpm: 1000000, rpd: 10000 }
    }))
  ];

  const rows = allModels.map((spec) => {
    const entry = store.models?.[spec.id] || { events: [] };
    const events = Array.isArray(entry.events) ? entry.events : [];
    const lastMinEvents = events
      .filter((ev) => ev && ev.ts >= oneMinAgo)
      .sort((a, b) => a.ts - b.ts);
    const todayEvents = events.filter((ev) => ev && ev.ptDay === ptDay);

    const rpmUsed = lastMinEvents.length;
    const tpmUsed = lastMinEvents.reduce((sum, ev) => sum + (Number(ev.totalTokens) || 0), 0);
    const rpdUsed = todayEvents.length;
    const tokensToday = todayEvents.reduce((sum, ev) => sum + (Number(ev.totalTokens) || 0), 0);
    const windowResetSec = lastMinEvents.length
      ? Math.max(1, Math.ceil((lastMinEvents[0].ts + 60000 - nowMs) / 1000))
      : 0;

    const limits = useTier1 ? spec.tier1 : spec.free;
    const dailyBlocked = entry.dailyBlockedPtDay === ptDay;
    const cooldownActive = Number(entry.cooldownUntil || 0) > nowMs;
    const paidOnlyOnFree = !useTier1 && !spec.free;

    const reportedRpd = entry.detectedRpdPtDay === ptDay && typeof entry.detectedRpdLimit === 'number'
      ? entry.detectedRpdLimit
      : null;

    const rpmLimit = limits?.rpm ?? 0;
    const tpmLimit = limits?.tpm ?? 0;
    const rpdLimit = reportedRpd !== null ? reportedRpd : (limits?.rpd ?? 0);

    const rpmRemaining = Math.max(0, rpmLimit - rpmUsed);
    const tpmRemaining = Math.max(0, tpmLimit - tpmUsed);
    const rpdExceededOnServer = dailyBlocked && rpdLimit > 0 && rpdUsed < rpdLimit;
    const rpdDisplayUsed = rpdExceededOnServer ? rpdLimit : rpdUsed;
    const rpdRemaining = dailyBlocked ? 0 : Math.max(0, rpdLimit - rpdUsed);

    const rpmPct = rpmLimit ? Math.min(100, Number(((rpmUsed / rpmLimit) * 100).toFixed(1))) : 0;
    const tpmPct = tpmLimit ? Math.min(100, Number(((tpmUsed / tpmLimit) * 100).toFixed(1))) : 0;
    const rpdPct = rpdLimit > 0
      ? (dailyBlocked ? 100 : Math.min(100, Number(((rpdUsed / rpdLimit) * 100).toFixed(1))))
      : 0;
    const isOverRpd = dailyBlocked || (rpdLimit > 0 && rpdUsed >= rpdLimit);

    const inApiKeyCatalog = availableSet ? availableSet.has(spec.id) : null;

    let status = 'ok';
    let statusLabel = 'Disponível';
    if (dailyBlocked) {
      status = 'blocked';
      statusLabel = `Cota diária esgotada (renova em ${reset.label})`;
    } else if (cooldownActive) {
      const waitSec = Math.max(1, Math.ceil((entry.cooldownUntil - nowMs) / 1000));
      status = 'warn';
      statusLabel = `Pausa RPM (${waitSec}s)`;
    } else if (paidOnlyOnFree) {
      status = 'paid';
      statusLabel = 'Somente API Paga';
    } else if (inApiKeyCatalog === false) {
      status = 'paid';
      statusLabel = 'Não listado na chave';
    } else if (entry.lastStatus === 'high_demand' && (nowMs - (entry.lastUsedAt || 0)) < 5 * 60 * 1000) {
      status = 'warn';
      statusLabel = 'Alta demanda recente';
    } else if (rpdPct >= 80 || rpmPct >= 80 || tpmPct >= 80) {
      status = 'warn';
      statusLabel = 'Perto do limite';
    } else if (rpmUsed > 0 || rpdUsed > 0) {
      status = 'ok';
      statusLabel = rpmUsed > 0 ? 'Em consumo na janela' : 'Ativo hoje';
    } else if (inApiKeyCatalog === true) {
      status = 'ok';
      statusLabel = 'Liberado na chave';
    }

    return {
      id: spec.id,
      name: spec.name,
      tierLabel: spec.tierLabel,
      isSelected: spec.id === normalizedSelected,
      limits,
      rpmLimit,
      tpmLimit,
      rpdLimit,
      rpmUsed,
      tpmUsed,
      rpdUsed,
      rpdDisplayUsed,
      rpdExceededOnServer,
      isOverRpd,
      rpmRemaining,
      tpmRemaining,
      rpdRemaining,
      tokensToday,
      rpmPct,
      tpmPct,
      rpdPct,
      windowResetSec,
      dailyBlocked,
      inApiKeyCatalog,
      status,
      statusLabel,
      lastError: entry.lastError || '',
      lastUsedAt: entry.lastUsedAt || 0
    };
  });

  const activeRow = rows.find((r) => r.isSelected) || rows[0] || null;

  return {
    ptDay,
    tier: useTier1 ? 'tier1' : 'free',
    reset,
    updatedAt: nowMs,
    activeRow,
    rows
  };
}

export async function syncAvailableModelsForKey(apiKey) {
  if (!apiKey) return { textModels: [], imageModels: [], imagenModels: [], categorized: null };
  const textModels = await discoverActiveGeminiModels(apiKey, true);
  const categorized = discoveredModelsCache.categorized || { gemini4: [], gemini3: [], image: [], imagen: [], other: [] };
  return {
    textModels,
    imageModels: categorized.image || [],
    imagenModels: categorized.imagen || [],
    categorized
  };
}

export async function probeAllModelsAvailability({ apiKey, models = [], onProgress = null }) {
  if (!apiKey) {
    throw new Error('Cole e salve sua Gemini API Key antes de testar os motores.');
  }
  const uniqueModels = Array.from(new Set((models || []).map((m) => resolveSelectedModel(m)).filter(Boolean)));
  const results = [];
  for (let i = 0; i < uniqueModels.length; i++) {
    const modelId = uniqueModels[i];
    if (typeof onProgress === 'function') {
      onProgress({ index: i + 1, total: uniqueModels.length, modelId, modelName: formatModelDisplayName(modelId) });
    }
    try {
      const res = await probeModelAvailability({ apiKey, modelName: modelId });
      results.push(res);
    } catch (err) {
      results.push({ ok: false, model: modelId, status: 'error', message: err.message });
    }
  }
  return results;
}

export async function probeModelAvailability({ apiKey, modelName = 'gemini-4-hydrogen' }) {
  if (!apiKey) {
    throw new Error('Cole e salve sua Gemini API Key antes de testar um modelo.');
  }
  const model = resolveSelectedModel(modelName);
  const modelLabel = formatModelDisplayName(model);

  const res = await fetchWithTimeout(`${BASE_URL}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
      generationConfig: { maxOutputTokens: 1, temperature: 0 }
    })
  }, 12000);

  const data = await res.json();
  if (res.ok) {
    const usage = data?.usageMetadata || {};
    recordModelApiEvent({
      model,
      status: 'ok',
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
      totalTokens: usage.totalTokenCount || 0
    });
    return { ok: true, model, status: 'ok', message: `${modelLabel}: disponível e respondendo normalmente!` };
  }

  const msg = data?.error?.message || `HTTP ${res.status}`;
  const retryAfter = Number(res.headers?.get?.('retry-after') || 0);
  if (res.status === 429) {
    const daily = isDailyQuotaErrorMessage(msg);
    const reportedRpdLimit = extractReportedRpdLimit(data, msg);
    recordModelApiEvent({
      model,
      status: 'rate_limited',
      errorMessage: msg,
      retryAfterSec: retryAfter,
      isDailyQuota: daily,
      reportedRpdLimit
    });
    return {
      ok: false,
      model,
      status: 'rate_limited',
      isDailyQuota: daily,
      message: daily ? `${modelLabel}: Cota diária esgotada (${msg})` : `${modelLabel}: Limite por minuto atingido (${msg})`
    };
  }

  if (res.status >= 500) {
    recordModelApiEvent({ model, status: 'high_demand', errorMessage: msg });
    return { ok: false, model, status: 'high_demand', message: `${modelLabel}: Alta demanda no Google (${msg})` };
  }

  recordModelApiEvent({ model, status: 'error', errorMessage: msg });
  return { ok: false, model, status: 'error', message: `${modelLabel}: ${msg}` };
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

    const imagenModels = rawModels
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('predict'))
      .map((m) => String(m.name || '').replace(/^models\//, ''))
      .filter((name) => /^imagen-/i.test(name));

    discoveredModelsCache = {
      key: apiKey,
      models: textModels,
      categorized: {
        gemini4: textModels.filter((n) => /^gemini-4/i.test(n)),
        gemini3: textModels.filter((n) => /^gemini-3/i.test(n)),
        image: [...imageModels, ...imagenModels],
        imageGenerateContent: imageModels,
        imagen: imagenModels,
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

export const GEMINI_RETRY_CONFIG = {
  maxAttempts: 10,
  baseDelayMs: 1500,
  maxDelayMs: 10000
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeRetryDelayMs(attempt, retryAfterHeader = null) {
  const { baseDelayMs, maxDelayMs } = GEMINI_RETRY_CONFIG;
  if (retryAfterHeader !== null && retryAfterHeader !== undefined && retryAfterHeader !== '') {
    const secs = Number(retryAfterHeader);
    if (!Number.isNaN(secs) && secs > 0) {
      return Math.min(maxDelayMs, Math.max(400, Math.round(secs * 1000)));
    }
  }
  const exp = Math.min(maxDelayMs, Math.round(baseDelayMs * Math.pow(1.55, Math.max(0, attempt - 1))));
  const jittered = Math.round(exp * (0.85 + Math.random() * 0.3));
  return Math.min(maxDelayMs, Math.max(0, jittered));
}

async function callGemini({ apiKey, modelName = 'gemini-4-hydrogen', prompt, systemInstruction = '', useSearch = false, expectJson = true, onStatus = null }) {
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const model = resolveSelectedModel(modelName);
  const modelLabel = formatModelDisplayName(model);
  const maxAttempts = Math.max(1, Number(GEMINI_RETRY_CONFIG.maxAttempts) || 10);
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (typeof onStatus === 'function') {
      onStatus(attempt === 1 ? modelLabel : `${modelLabel} · Alta demanda, insistindo...`);
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

        const isTransient = res.status === 429 || res.status >= 500 ||
          /high demand|overloaded|unavailable|try again|temporarily|quota|rate limit|resource_exhausted|busy|capacity/i.test(msg);
        const retryAfter = res.headers?.get?.('retry-after');
        const dailyQuotaHit = (res.status === 429 || /quota|resource_exhausted/i.test(msg)) && isDailyQuotaErrorMessage(msg);

        if (dailyQuotaHit) {
          recordModelApiEvent({
            model,
            status: 'rate_limited',
            errorMessage: msg,
            retryAfterSec: Number(retryAfter || 0),
            isDailyQuota: true,
            reportedRpdLimit: extractReportedRpdLimit(data, msg)
          });
          throw Object.assign(
            new Error(`${modelLabel}: Limite diário da API atingido (${msg}). Abra "Configurar IA → 📊 Limites & Uso" para acompanhar e trocar de motor.`),
            { fatal: true }
          );
        }

        if (res.status === 429) {
          recordModelApiEvent({
            model,
            status: 'rate_limited',
            errorMessage: msg,
            retryAfterSec: Number(retryAfter || 0),
            isDailyQuota: false
          });
        } else if (isTransient) {
          recordModelApiEvent({ model, status: 'high_demand', errorMessage: msg });
        } else {
          recordModelApiEvent({ model, status: 'error', errorMessage: msg });
        }

        lastError = Object.assign(new Error(`${modelLabel}: ${msg}`), { transient: isTransient });

        if (isTransient && attempt < maxAttempts) {
          await sleep(computeRetryDelayMs(attempt, retryAfter));
          continue;
        }
        throw lastError;
      }

      const candidate = data?.candidates?.[0];
      const text = (candidate?.content?.parts || []).map((p) => p.text || '').join('\n').trim();
      if (!text) {
        lastError = Object.assign(new Error(`${modelLabel}: Resposta vazia do modelo.`), { transient: true });
        if (attempt < maxAttempts) {
          await sleep(computeRetryDelayMs(attempt));
          continue;
        }
        throw lastError;
      }

      const usageMeta = data?.usageMetadata || {};
      recordModelApiEvent({
        model,
        status: 'ok',
        inputTokens: usageMeta.promptTokenCount || 0,
        outputTokens: usageMeta.candidatesTokenCount || 0,
        totalTokens: usageMeta.totalTokenCount || 0
      });

      const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
      const sources = groundingChunks
        .map((c) => c?.web ? { title: c.web.title, uri: c.web.uri } : null)
        .filter(Boolean);

      return { text, modelUsed: model, sources };
    } catch (err) {
      if (err?.fatal) throw err;
      const baseMsg = String(err?.message || 'Erro ao conectar com a API do Google Gemini.');
      const formattedMsg = baseMsg.startsWith(modelLabel) ? baseMsg : `${modelLabel}: ${baseMsg}`;
      const isTransient = Boolean(err?.transient) || isTransientServiceError(err);
      lastError = Object.assign(new Error(formattedMsg), { transient: isTransient });

      if (isTransient && attempt < maxAttempts) {
        await sleep(computeRetryDelayMs(attempt));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error(`${modelLabel}: Erro ao conectar com a API do Google Gemini.`);
}

// ============================================================================
// 1. GERADOR DE EPISÓDIO COMPLETO (ROTEIRO + HEADLINE + LEGENDA + EDIÇÃO IA)
// ============================================================================

function extractArticleFromHtml(html = '') {
  const src = String(html || '');
  if (!src.trim()) return { title: '', excerpt: '' };
  const titleMatch = src.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaMatch = src.match(/<meta[^>]+(?:name=["']description["']|property=["']og:description["'])[^>]+content=["']([\s\S]*?)["']/i);
  const cleanedBody = src
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRegex.exec(cleanedBody)) !== null && paragraphs.length < 16) {
    const text = decodeXmlEntities(pm[1]);
    if (text.length >= 45) paragraphs.push(text);
  }
  const excerpt = [metaMatch ? decodeXmlEntities(metaMatch[1]) : '', ...paragraphs]
    .filter(Boolean)
    .join('\n')
    .slice(0, 2400);
  return {
    title: titleMatch ? decodeXmlEntities(titleMatch[1]) : '',
    excerpt
  };
}

export async function fetchNewsArticleContext({ url = '', driveWebhookUrl = '' } = {}) {
  const targetUrl = String(url || '').trim();
  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    return null;
  }

  if (driveWebhookUrl) {
    try {
      const res = await fetchWithTimeout(driveWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'fetch_article', url: targetUrl })
      }, 8000);
      if (res.ok) {
        const data = await res.json();
        if (data?.ok && data?.excerpt) {
          return {
            title: data.title || '',
            excerpt: String(data.excerpt).slice(0, 2400),
            finalUrl: data.finalUrl || targetUrl,
            via: 'Apps Script'
          };
        }
      }
    } catch {
      // Fallback para relays do navegador
    }
  }

  const encoded = encodeURIComponent(targetUrl);
  try {
    return await raceFirstNonEmpty([
      (async () => {
        const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encoded}`, { method: 'GET' }, 7500);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const extracted = extractArticleFromHtml(data?.contents || '');
        if (!extracted.excerpt) throw new Error('empty');
        return { ...extracted, finalUrl: targetUrl, via: 'AllOrigins' };
      })(),
      (async () => {
        const res = await fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encoded}`, { method: 'GET' }, 7500);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const extracted = extractArticleFromHtml(html);
        if (!extracted.excerpt) throw new Error('empty');
        return { ...extracted, finalUrl: targetUrl, via: 'CodeTabs' };
      })()
    ]);
  } catch {
    return null;
  }
}

export async function generateCompleteEpisode(params) {
  const {
    creator,
    modelId,
    seriesName = '',
    partNumber = null,
    topic,
    funnelStage = 'topo',
    viralGoal = 'share',
    validation = {},
    customInstructions = '',
    sourceNews = null,
    driveWebhookUrl = '',
    apiKey,
    modelName,
    onStatus = null
  } = params;

  const modelObj = SERIES_MODELS.find((m) => m.id === modelId) || SERIES_MODELS[0];
  const funnelObj = VIRAL_CODE.funnelStages.find((f) => f.id === funnelStage) || VIRAL_CODE.funnelStages[0];
  const hierarchyObj = VIRAL_CODE.hierarchies.find((h) => h.id === viralGoal) || VIRAL_CODE.hierarchies[0];
  const cleanSeries = String(seriesName || '').trim();
  const hasSeries = Boolean(cleanSeries);
  const validPart = Number(partNumber) >= 1 ? Number(partNumber) : null;
  const cleanCustomInstructions = String(customInstructions || '').trim();

  if (!apiKey) {
    return buildOfflineEpisode({ creator, modelObj, seriesName: cleanSeries, partNumber: validPart, topic, funnelObj, hierarchyObj, validation, customInstructions: cleanCustomInstructions, sourceNews });
  }

  let articleContext = null;
  if (sourceNews?.url) {
    if (typeof onStatus === 'function') onStatus('Lendo notícia anexada...');
    articleContext = await fetchNewsArticleContext({ url: sourceNews.url, driveWebhookUrl });
  }

  const hasNews = Boolean(sourceNews?.url || sourceNews?.title);
  const newsBlock = hasNews ? `

NOTÍCIA REAL ANEXADA (REFERÊNCIA FACTUAL OBRIGATÓRIA):
- Título da matéria: ${articleContext?.title || sourceNews?.title || 'Notícia anexada'}
- Veículo: ${sourceNews?.sourceName || 'Portal de notícias'} | Data: ${sourceNews?.publishedAt || 'Recente'}
- Link oficial: ${sourceNews?.url || 'Não informado'}
${sourceNews?.summary ? `- Resumo inicial: ${sourceNews.summary}` : ''}
${articleContext?.excerpt ? `- Trecho real extraído da notícia:\n${articleContext.excerpt}` : ''}
REGRA FACTUAL: Use as informações reais, fatos, contexto e números dessa notícia para fundamentar o roteiro com precisão, sem inventar dados que contradigam a matéria.` : '';

  const seriesRule = hasSeries
    ? `- Este vídeo pertence à SÉRIE "${cleanSeries}"${validPart ? ` (Parte ${validPart})` : ''}.`
    : `- Este vídeo ainda está SEM PASTA/SÉRIE definida (roteiro avulso para ser encaixado depois) — portanto NÃO invente "Parte 1" nem texto artificial de numeração.`;

  const systemInstruction = `Você é o Diretor Criativo do "Reels Lab", especialista supremo nos dois métodos:
1. "O Meu Modelo de Reels" (Leislin Eduarda):
${seriesRule}
- REGRA DE OURO DO COMEÇO: A primeira frase falada É LITERALMENTE o gancho/título forte do vídeo. PROIBIDO cumprimentar ("oi gente", "tudo bem", "olá pessoal"), PROIBIDO se apresentar, PROIBIDO dizer "hoje eu vim falar de".
- TESTE DA CONVERSA: Escreva como quem conversa com uma amiga no WhatsApp/café. Zero linguagem acadêmica ou de seminário. Respeite o pronome (${creator?.pronoun || 'você'}) e nunca use as palavras proibidas.
- DURAÇÃO: Máximo 1 minuto (~110 a 145 palavras no total; se Topo/Descoberta <30s, ~65 a 85 palavras).
- 1 ÚNICA ORIENTAÇÃO por vídeo: resolva um único problema concreto.

2. "Código Viral":
- GANCHO (0-3s) + BENEFÍCIO imediato.
- O DIRETO: Sem enrolação entre gancho e entrega.
- MOSTRE, NÃO SÓ EXPLIQUE: Dê exemplos visuais ou situações cotidianas concretas.
- TÍTULO / HEADLINE DA CAPA: Deve ter 3 ingredientes (Específico + Curioso + Urgente) usando palavras que despertam curiosidade (Segredo, Truque, Isso, Entenda, Veja, Razão, Como, Pare).
- CTA ESTRATÉGICA + PORTA NA CARA: Terminar com chamada alinhada ao objetivo viral (${hierarchyObj.label}) e corte seco imediato sem despedida.`;

  const customInstructionsBlock = cleanCustomInstructions ? `

INSTRUÇÕES PERSONALIZADAS DO CRIADOR PARA ESTA GERAÇÃO (PRIORIDADE ALTA — APLIQUE FIELMENTE SEM ALTERAR O DNA PRINCIPAL):
${cleanCustomInstructions}` : '';

  const prompt = `Crie um pacote COMPLETO de Reels para o criador abaixo:

${buildCreatorContext(creator)}

PARÂMETROS DO EPISÓDIO:
- Série / Pasta: ${hasSeries ? `"${cleanSeries}"${validPart ? ` (Parte ${validPart})` : ''}` : 'Sem pasta definida ainda (Roteiro avulso)'}
- Modelo Escolhido: ${modelObj.code} — "${modelObj.name}"
  Regra de título deste modelo: ${modelObj.nameRule}
  Fluxo obrigatório do roteiro: ${modelObj.structureFlow}
  Esqueleto base: ${JSON.stringify(modelObj.template)}
- Tema / Situação deste episódio: ${topic || 'Escolha uma dor específica de alto impacto do público do criador'}
- Etapa do Funil: ${funnelObj.label} (${funnelObj.focus})
- Objetivo Viral Principal: ${hierarchyObj.label} (${hierarchyObj.hint})
- Pré-respostas do criador (se houver): Problema="${validation.problem || ''}", Aprendizado="${validation.learn || ''}", Mudança="${validation.lifeChange || ''}"${newsBlock}${customInstructionsBlock}

Retorne EXATAMENTE um JSON com esta estrutura:
{
  "title": "Título curto e memorável do episódio",
  "onScreenText": "${validPart ? `Texto exato para colocar escrito acima da cabeça no início do vídeo (com Parte ${validPart})` : 'Texto curto e direto para colocar escrito acima da cabeça no início do vídeo'}",
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
    return {
      ...parsed,
      articleUsed: Boolean(articleContext?.excerpt),
      generatedBy: `IA (${modelUsed})`
    };
  } catch (err) {
    if (!err?.fatal && isTransientServiceError(err)) {
      const offline = buildOfflineEpisode({ creator, modelObj, seriesName: cleanSeries, partNumber: validPart, topic, funnelObj, hierarchyObj, validation, customInstructions: cleanCustomInstructions, sourceNews });
      return {
        ...offline,
        generatedBy: 'Motor Inteligente de Contingência (Pico de demanda no Google Gemini)',
        fallbackReason: err.message
      };
    }
    throw err;
  }
}

function buildOfflineEpisode({ creator, modelObj, seriesName = '', partNumber = null, topic, funnelObj, hierarchyObj, validation, customInstructions = '', sourceNews = null }) {
  const pronoun = creator?.pronoun || 'você';
  const prefix = creator?.targetGroupPrefix || 'A pessoa que';
  const keyword = creator?.manychatKeyword || 'EUQUERO';
  const niche = creator?.niche || 'seu dia a dia';
  const cleanTopic = (topic || '').trim() || `quer melhorar em ${niche} sem complicação`;
  const cleanSeries = String(seriesName || '').trim();
  const partSuffix = partNumber ? ` (Parte ${partNumber})` : '';
  const seriesLabel = cleanSeries ? `${cleanSeries}${partSuffix}` : cleanTopic.slice(0, 38);

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
    hookLine = `${cleanSeries || cleanTopic}${partNumber ? ` (parte ${partNumber})` : ''}. Faz desse jeito aqui: ${cleanTopic}.`;
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
    : partNumber
    ? `Salva esse vídeo para aplicar ainda hoje e segue para a parte ${Number(partNumber) + 1}.`
    : `Salva esse vídeo para aplicar ainda hoje e me segue para os próximos conteúdos.`;

  const newsRefLine = sourceNews?.title ? ` (Baseado na notícia: ${sourceNews.title})` : '';
  const customNote = customInstructions ? `\n\n[DIREÇÃO PERSONALIZADA APLICADA]: ${customInstructions}` : '';
  const script = `[00-03s | GANCHO + BENEFÍCIO]
${hookLine} E nos próximos segundos eu vou te mostrar exatamente o que ${pronoun} pode ajustar hoje para destravar isso.

[03-18s | DESENVOLVIMENTO / IDENTIFICAÇÃO]
Eu sei que na correria ${pronoun} tenta resolver tudo do jeito mais difícil${newsRefLine}, olha o que os outros fazem e acaba se frustrando porque parece que nada funciona na sua rotina real. Só que quando ${pronoun} continua repetindo esse mesmo hábito sem perceber, o resultado só atrasa.

[18-35s | SOLUÇÃO PRÁTICA — MOSTRE!]
Eu, no seu lugar, faria assim — olha na prática: escolha um único ajuste simples ligado a ${cleanTopic} e aplique por 7 dias antes de querer mudar tudo de uma vez. Mostre na câmera ou no exemplo real como fica fácil quando tira a complicação.

[35-45s | QUEBRA DE OBJEÇÃO + CTA + PORTA NA CARA]
Porque ${pronoun} pode ter certeza: não é falta de tempo nem de capacidade, é só falta do método certo. ${ctaLine} [CORTE SECO IMEDIATO]${customNote}`;

  return {
    title: cleanTopic.slice(0, 70),
    onScreenText: cleanSeries ? `${cleanSeries}${partNumber ? ` • Parte ${partNumber}` : ''}` : cleanTopic.slice(0, 48),
    headlines: [
      `O SEGREDO: ${cleanTopic.slice(0, 34)} 🤯`,
      `ENTENDA por que isso trava você`,
      seriesLabel.slice(0, 38)
    ],
    validation: {
      problem: validation.problem || `Dificuldade cotidiana ligada a ${cleanTopic}.`,
      learn: validation.learn || `Como aplicar uma mudança imediata e simples em ${niche}.`,
      lifeChange: validation.lifeChange || `Mais clareza, consistência e resultado real sem complicar a rotina.`
    },
    script,
    caption: `${hookLine}\n\nA maioria das pessoas acha que precisa de uma fórmula mirabolante para resolver isso, quando na verdade o segredo está no ajuste básico feito com consistência.\n\n📌 Resumo para salvar:\n1. Identifique o erro invisível da sua rotina.\n2. Aplique uma única ação prática ainda hoje.\n3. Acompanhe os próximos conteúdos aqui no perfil.\n\n${ctaLine}\n\n#${(creator?.niche || 'conteudo').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '')} #dicaspraticas #reelsviral`,
    editingPrompt: `PROMPT DE EDIÇÃO (CAPCUT / EDITOR IA) — ${funnelObj.label}:\n1. [00-03s]: Sem cumprimento. Coloque título fixo no topo acima da cabeça: "${seriesLabel}". Zoom-in leve (100% -> 112%) + som sutil de "pop".\n2. [03-35s]: Cortes secos removendo todas as pausas de respiração. Legenda dinâmica centralizada em fonte Bold branca com palavras-chave em amarelo (#FDE047).\n3. [18-35s]: Insira B-Roll / gravação mostrando a ação prática na tela enquanto narra.\n4. [Final]: Corte abrupto imediatamente após a última palavra da CTA (efeito "Porta na Cara" para aumentar loop e retenção).\n5. Música de fundo instrumental sutil em -24dB.`,
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

export function detectBestSeriesModelId({ title = '', funnel = '', suggestedModelId = '', bridge = '' } = {}) {
  const cleanTitle = String(title || '').trim();
  const combined = `${cleanTitle} ${String(bridge || '')}`;

  // 1. Padrão estrutural explícito no título/gancho
  if (/o que tod[oa]s? .*deveria|deveriam? fazer.*mas n[ãa]o|todo mundo .*deveria .*mas n[ãa]o/i.test(cleanTitle)) {
    return 'serie_01';
  }
  if (/^\s*comece a\b|\bcomece a\b|primeiro passo para|aplique hoje|passo simples para come[çc]ar/i.test(cleanTitle)) {
    return 'serie_02';
  }
  if (/^\s*a (?:pessoa|mulher|m[ãa]e|profissional|cliente|dona|empres[áa]ri[ao]) que\b|^\s*o (?:homem|cliente|pai|profissional|dono|corretor|m[ée]dico|advogado|arquiteto) que\b|\bn[ãa]o deveria (?:achar|estranhar|fazer|reclamar)/i.test(cleanTitle)) {
    return 'serie_03';
  }
  if (/^\s*como\b.*\bsem\b|\bsem precisar\b|\bsem gastar\b|\bsem sofrer\b|\bsem complicar\b/i.test(cleanTitle)) {
    return 'serie_04';
  }
  if (/^\s*quem quer\b|deveria fazer isso aqui|\bquem busca\b.*deveria/i.test(cleanTitle)) {
    return 'serie_05';
  }

  // 2. Normalização do modelId sugerido pela IA ou catálogo
  const raw = String(suggestedModelId || '').trim().toLowerCase();
  if (raw) {
    const serieMatch = raw.match(/s[ée]rie[\s_-]*0?([1-5])|serie[\s_-]*0?([1-5])/i);
    if (serieMatch) {
      const num = serieMatch[1] || serieMatch[2];
      return `serie_0${num}`;
    }
    if (/c[óo]digo[\s_-]*viral|timing|viral/i.test(raw)) {
      return 'codigo_viral';
    }
    if (SERIES_MODELS.some((m) => m.id === raw)) {
      return raw;
    }
  }

  // 3. Fallback por intenção e funil
  const normFunnel = String(funnel || '').toLowerCase();
  if (/urgente|alerta|cuidado|segredo|verdade|mentira|muda tudo|nova lei|nova regra|taxa|por que ningu[ée]m/i.test(combined) || normFunnel === 'topo') {
    return 'codigo_viral';
  }
  if (normFunnel === 'fundo') return 'serie_05';
  if (normFunnel === 'meio') return 'serie_03';
  return 'codigo_viral';
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
4. Para cada notícia escolhida, faça uma "bubbleBridge" conectando esse assunto real à bolha do criador sem parecer página de fofoca, e crie 3 ângulos de Reels (Topo=Descoberta <30s, Meio=Conexão 30-45s, Fundo=Venda 45-60s).
5. Escolha EXATAMENTE o "modelId" mais fiel ao estilo do título/ângulo criado:
- "codigo_viral": notícia quente, alerta, segredo, quebra de padrão, descoberta rápida (<30s).
- "serie_01": formato "O que toda pessoa que [situação] deveria fazer, mas não faz".
- "serie_02": formato "Comece a [ação prática imediata]...".
- "serie_03": formato "A pessoa que [situação cotidiana]..." (identificação extrema).
- "serie_04": formato "Como [resultado] sem [dificuldade comum]".
- "serie_05": formato "Quem quer [desejo específico] deveria fazer isso aqui" (ótimo para fundo/venda).

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
    const normalizedAngles = (t.angles || []).map((ang) => ({
      ...ang,
      modelId: detectBestSeriesModelId({
        title: ang?.title || '',
        funnel: ang?.funnel || '',
        suggestedModelId: ang?.modelId || '',
        bridge: t?.bubbleBridge || ''
      })
    }));
    return {
      ...t,
      angles: normalizedAngles,
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

export const X_TREND_DAY_FILTERS = [
  { id: 'all', label: 'Todos (3 dias)' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'ontem', label: 'Ontem' },
  { id: '2dias', label: 'Há 2 dias' }
];

export function getBrazilRecentDays(nowMs = Date.now()) {
  const offsets = [
    { offset: 0, dayKey: 'hoje', prefix: 'Hoje' },
    { offset: -1, dayKey: 'ontem', prefix: 'Ontem' },
    { offset: -2, dayKey: '2dias', prefix: 'Há 2 dias' }
  ];
  return offsets.map(({ offset, dayKey, prefix }) => {
    const dt = new Date(nowMs - (3 * 60 * 60 * 1000) + (offset * 24 * 60 * 60 * 1000));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return {
      dayKey,
      iso: `${y}-${m}-${d}`,
      br: `${d}/${m}`,
      dayLabel: `${prefix} (${d}/${m})`
    };
  });
}

export function parseXTrendsHtml(html, { dayKey = 'hoje', dayLabel = 'Hoje', dateIso = '', sourceHint = 'X Brasil' } = {}) {
  const src = String(html || '');
  if (!src.trim()) return [];
  const items = [];
  const seen = new Set();

  const addTopic = (rawTopic, rawVol = '', rawHref = '') => {
    const topic = decodeXmlEntities(rawTopic);
    if (!topic || topic.length < 2 || topic.length > 80) return;
    if (/^(brazil|brasil|worldwide|trends24|getdaytrends|login|about|privacy|home|more|view all|sign in)$/i.test(topic)) return;
    const key = topic.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const vol = decodeXmlEntities(rawVol).replace(/\s+/g, ' ').trim();
    const xSearchUrl = `https://x.com/search?q=${encodeURIComponent(topic)}&src=trend_click&vertical=trends`;
    items.push({
      id: `${dayKey}::${key}`,
      rank: items.length + 1,
      topic,
      volume: vol,
      dayKey,
      dayLabel,
      dateIso,
      publishedAt: dayLabel,
      sourceName: sourceHint,
      xSearchUrl,
      sourceUrl: rawHref || xSearchUrl
    });
  };

  // GetDayTrends table rows
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(src)) !== null && items.length < 25) {
    const row = trMatch[1];
    const linkMatch = row.match(/<a\b[^>]*href=["']([^"']*\/trend\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (linkMatch) {
      const href = linkMatch[1].startsWith('http') ? linkMatch[1] : `https://getdaytrends.com${linkMatch[1]}`;
      const volMatch = row.match(/<span\b[^>]*class=["'][^"']*(?:small|desc|count)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        || row.match(/(\d[\d.,]*\s*[KkMm]?\s*(?:tweets?|posts?)?)\s*<\/td>/i);
      addTopic(linkMatch[2], volMatch ? volMatch[1] : '', href);
    }
  }

  // Trends24 ordered list items
  if (!items.length) {
    const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(src)) !== null && items.length < 25) {
      const liBlock = liMatch[1];
      if (!/trend-link|twitter\.com\/search|x\.com\/search/i.test(liBlock)) continue;
      const aMatch = liBlock.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (aMatch) {
        const countMatch = liBlock.match(/<span\b[^>]*class=["'][^"']*tweet-count[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
        addTopic(aMatch[2], countMatch ? countMatch[1] : '', aMatch[1]);
      }
    }
  }

  return items;
}

async function fetchHtmlViaCorsRelay(targetUrl) {
  const encoded = encodeURIComponent(targetUrl);
  const tryAllOrigins = async () => {
    const res = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encoded}`, { method: 'GET' }, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data?.contents) throw new Error('empty');
    return data.contents;
  };
  const tryRelay = async (proxyUrl) => {
    const res = await fetchWithTimeout(proxyUrl, { method: 'GET' }, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    if (!txt || txt.length < 200) throw new Error('empty');
    return txt;
  };
  return raceFirstNonEmpty([
    tryAllOrigins(),
    tryRelay(`https://api.codetabs.com/v1/proxy?quest=${encoded}`),
    tryRelay(`https://api.allorigins.win/raw?url=${encoded}`)
  ]);
}

export async function fetchBrazilXTrends({ driveWebhookUrl = '', onStatus = null } = {}) {
  const days = getBrazilRecentDays();
  if (typeof onStatus === 'function') {
    onStatus('Buscando Trending Topics do X (Brasil · 3 dias)...');
  }

  let appsScriptDiag = 'no_url';
  if (driveWebhookUrl) {
    try {
      const res = await fetchWithTimeout(driveWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'fetch_x_trends' })
      }, 16000);
      if (res.ok) {
        const data = await res.json();
        const errText = [data?.error, ...(Array.isArray(data?.errors) ? data.errors : [])].filter(Boolean).join(' | ');
        if (data?.needsAuth || /permiss|external_request|UrlFetchApp|autoriz|auth/i.test(errText)) {
          appsScriptDiag = 'needs_auth';
        } else if (/ação desconhecida|unknown action/i.test(errText)) {
          appsScriptDiag = 'outdated_deployment';
        } else if (data?.ok && Array.isArray(data.items) && data.items.length) {
          return {
            items: data.items,
            days: Array.isArray(data.days) && data.days.length ? data.days : days,
            fetchedFrom: 'Google Apps Script (X Brasil ao vivo)',
            fetchedAt: data.fetchedAt || new Date().toISOString()
          };
        }
      }
    } catch {
      appsScriptDiag = 'script_unreachable';
    }
  }

  // Fallback via proxies CORS no navegador
  const byDay = { hoje: [], ontem: [], '2dias': [] };
  const daySeen = { hoje: new Set(), ontem: new Set(), '2dias': new Set() };
  const pushItems = (dayKey, list) => {
    for (const item of list || []) {
      const key = String(item.topic || '').toLowerCase().trim();
      if (!key || daySeen[dayKey].has(key) || byDay[dayKey].length >= 25) continue;
      daySeen[dayKey].add(key);
      byDay[dayKey].push({
        ...item,
        rank: byDay[dayKey].length + 1
      });
    }
  };

  const scrapeSpecs = [
    { day: days[0], sourceHint: 'X / GetDayTrends', url: 'https://getdaytrends.com/brazil/' },
    { day: days[0], sourceHint: 'X / Trends24', url: 'https://trends24.in/brazil/' },
    { day: days[1], sourceHint: 'X / GetDayTrends', url: `https://getdaytrends.com/brazil/${days[1].iso}/20/` },
    { day: days[2], sourceHint: 'X / GetDayTrends', url: `https://getdaytrends.com/brazil/${days[2].iso}/20/` }
  ];

  const scraped = await Promise.allSettled(
    scrapeSpecs.map(async (spec) => {
      const html = await fetchHtmlViaCorsRelay(spec.url);
      return {
        dayKey: spec.day.dayKey,
        items: parseXTrendsHtml(html, {
          dayKey: spec.day.dayKey,
          dayLabel: spec.day.dayLabel,
          dateIso: spec.day.iso,
          sourceHint: spec.sourceHint
        })
      };
    })
  );

  scraped.forEach((res) => {
    if (res.status === 'fulfilled' && res.value?.items?.length) {
      pushItems(res.value.dayKey, res.value.items);
    }
  });

  // Fallback real via Google News Brasil para repercussões do X nos dias sem resposta de scraper
  const missingDays = days.filter((d) => !byDay[d.dayKey].length);
  if (missingDays.length) {
    try {
      const rssFeed = {
        label: 'Repercussão no X Brasil',
        categoryId: 'x',
        url: `https://news.google.com/rss/search?q=${encodeURIComponent('("no X" OR "no Twitter" OR "trending topics" OR viralizou) Brasil when:3d')}&hl=pt-BR&gl=BR&ceid=BR:pt`
      };
      const rssItems = await fetchSingleRssFeed(rssFeed, 30);
      for (const it of rssItems) {
        const dt = it.pubDate ? new Date(it.pubDate) : null;
        let dayObj = days[0];
        if (dt && !Number.isNaN(dt.getTime())) {
          const brIso = new Date(dt.getTime() - (3 * 60 * 60 * 1000)).toISOString().slice(0, 10);
          const matchedDay = days.find((d) => d.iso === brIso);
          if (matchedDay) dayObj = matchedDay;
        }
        if (byDay[dayObj.dayKey].length < 15) {
          pushItems(dayObj.dayKey, [{
            id: `${dayObj.dayKey}::rss::${it.title.toLowerCase().slice(0, 40)}`,
            rank: 1,
            topic: it.title,
            volume: it.sourceName || '',
            dayKey: dayObj.dayKey,
            dayLabel: dayObj.dayLabel,
            dateIso: dayObj.iso,
            publishedAt: dayObj.dayLabel,
            sourceName: `Repercussão no X · ${it.sourceName || 'Google Notícias'}`,
            xSearchUrl: `https://x.com/search?q=${encodeURIComponent(it.title.slice(0, 60))}&src=trend_click&vertical=trends`,
            sourceUrl: it.link || ''
          }]);
        }
      }
    } catch {
      // Ignora erro de fallback secundário
    }
  }

  const allItems = [...byDay.hoje, ...byDay.ontem, ...byDay['2dias']];
  if (!allItems.length) {
    if (appsScriptDiag === 'outdated_deployment') {
      throw new Error('Atualize seu google-apps-script.gs para a versão v13 e publique "Nova versão" para buscar os Trending Topics do X direto pelos servidores do Google.');
    }
    throw new Error('Não foi possível acessar os Trending Topics do X Brasil nesta rede agora. Conecte ou atualize o Google Apps Script v13 no botão Drive Ativo e tente novamente.');
  }

  const hasDirectScrapers = allItems.some((it) => String(it.sourceName || '').startsWith('X /'));
  return {
    items: allItems,
    days,
    fetchedFrom: hasDirectScrapers ? 'X Brasil (Agregadores ao vivo)' : 'X Brasil (Repercussão em tempo real)',
    fetchedAt: new Date().toISOString()
  };
}

export async function generateAnglesFromXTrends({ creator, trends = [], apiKey, modelName = 'gemini-4-hydrogen', onStatus = null }) {
  if (!apiKey) {
    throw new Error('Configure sua Gemini API Key antes de gerar roteiros a partir do X.');
  }
  if (!Array.isArray(trends) || !trends.length) {
    throw new Error('Selecione pelo menos 1 assunto do X Trending Topics.');
  }

  const slice = trends.slice(0, 15);
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const formattedTrends = slice.map((item, idx) =>
    `[${idx + 1}] Assunto no X: "${item.topic}" | Período: ${item.dayLabel || item.publishedAt || 'Últimos 3 dias'}${item.volume ? ` | Volume: ${item.volume}` : ''} | Fonte: ${item.sourceName || 'X Brasil'}`
  ).join('\n');

  const prompt = `Hoje é ${today}.
Abaixo estão ${slice.length} TRENDING TOPICS REAIS DO X (ANTIGO TWITTER) NO BRASIL DOS ÚLTIMOS 3 DIAS:

${formattedTrends}

CONTEXTO DO CRIADOR:
${buildCreatorContext(creator)}

REGRAS ESTRITAS:
1. Baseie-se 100% NOS TRENDING TOPICS NUMERADOS ACIMA ([1] a [${slice.length}]). É PROIBIDO inventar trends fora da lista.
2. Gere EXATAMENTE ${slice.length} card(s) de conteúdo (um para cada trend selecionado acima, sem repetir "sourceIndex").
3. Em cada card, faça uma "bubbleBridge" conectando esse assunto viral do X à bolha e ao público do criador sem parecer página de fofoca, e crie 3 ângulos de Reels (Topo=Descoberta <30s, Meio=Conexão 30-45s, Fundo=Venda 45-60s).
4. Escolha EXATAMENTE o "modelId" mais fiel ao estilo do título/ângulo criado:
- "codigo_viral": assunto quente, debate, alerta, quebra de padrão, descoberta rápida (<30s).
- "serie_01": formato "O que toda pessoa que [situação] deveria fazer, mas não faz".
- "serie_02": formato "Comece a [ação prática imediata]...".
- "serie_03": formato "A pessoa que [situação cotidiana]..." (identificação extrema).
- "serie_04": formato "Como [resultado] sem [dificuldade comum]".
- "serie_05": formato "Quem quer [desejo específico] deveria fazer isso aqui" (ótimo para fundo/venda).

Responda APENAS com JSON válido no formato:
{
  "topics": [
    {
      "sourceIndex": 1,
      "trendTitle": "Nome do trend do X [sourceIndex] conectado ao tema",
      "timingWhy": "Por que esse assunto está em alta no X Brasil agora (1-2 frases)",
      "bubbleBridge": "Ponte inteligente desse trend do X para o nicho do criador",
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
  const rawTopics = Array.isArray(parsed?.topics) ? parsed.topics.slice(0, slice.length) : [];
  const usedIndexes = new Set();

  const groundedTopics = rawTopics.map((t, idx) => {
    let refIdx = Number(t.sourceIndex);
    if (!(refIdx >= 1 && refIdx <= slice.length) || usedIndexes.has(refIdx)) {
      const nextUnused = slice.findIndex((_, i) => !usedIndexes.has(i + 1));
      refIdx = nextUnused !== -1 ? nextUnused + 1 : ((idx % slice.length) + 1);
    }
    usedIndexes.add(refIdx);
    const matched = slice[refIdx - 1];
    const normalizedAngles = (t.angles || []).map((ang) => ({
      ...ang,
      modelId: detectBestSeriesModelId({
        title: ang?.title || '',
        funnel: ang?.funnel || '',
        suggestedModelId: ang?.modelId || '',
        bridge: t?.bubbleBridge || ''
      })
    }));
    return {
      ...t,
      angles: normalizedAngles,
      sourceIndex: refIdx,
      sourceName: matched?.sourceName || 'X Brasil',
      publishedAt: matched?.dayLabel || matched?.publishedAt || 'Últimos 3 dias',
      sourceUrl: matched?.xSearchUrl || matched?.sourceUrl || '',
      categoryLabel: `𝕏 Brasil · ${matched?.dayLabel || '3 dias'}`
    };
  });

  return {
    topics: groundedTopics,
    modelUsed,
    usedTrendIds: slice.map((t) => t.id).filter(Boolean)
  };
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
// 5. GERADOR DE IMAGEM DE FUNDO PARA CAPA VIA NANO BANANA / GEMINI IMAGE / IMAGEN
// ============================================================================

export async function generateCoverBackground({ imagePrompt, apiKey, onStatus = null }) {
  if (!apiKey) {
    throw new Error('Configure sua chave da API Gemini para gerar fundos inéditos com IA (você também pode usar os templates do Estúdio ou subir uma foto).');
  }

  // Descobre modelos de imagem realmente liberados nesta chave (generateContent e Imagen predict)
  if (typeof onStatus === 'function') onStatus('Consultando modelos de imagem na chave...');
  await discoverActiveGeminiModels(apiKey, false);
  const discoveredGenContent = discoveredModelsCache.categorized?.imageGenerateContent || [];
  const discoveredImagen = discoveredModelsCache.categorized?.imagen || [];

  const defaultGenContentModels = [
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-image-preview',
    'gemini-3.1-flash-image-preview',
    'gemini-3.1-flash-image',
    'gemini-3-pro-image-preview',
    'gemini-3-pro-image',
    'gemini-nano-banana-2.1',
    'gemini-2.0-flash-preview-image-generation'
  ];

  const defaultImagenModels = [
    'imagen-4.0-fast-generate-001',
    'imagen-4.0-generate-001',
    'imagen-3.0-generate-002'
  ];

  const genContentCandidates = Array.from(new Set([...discoveredGenContent, ...defaultGenContentModels]));
  const imagenCandidates = Array.from(new Set([...discoveredImagen, ...defaultImagenModels]));
  const diagnostics = [];

  const cleanPrompt = String(imagePrompt || '').trim() || 'Modern vertical editorial studio background with soft dramatic lighting';

  // 1) Tenta modelos Gemini Native Image via :generateContent (responseModalities: TEXT + IMAGE)
  for (const m of genContentCandidates) {
    if (typeof onStatus === 'function') onStatus(`Testando ${m}...`);
    let useImageConfig = true;

    for (let imgAttempt = 1; imgAttempt <= 2; imgAttempt++) {
      try {
        const generationConfig = {
          responseModalities: ['TEXT', 'IMAGE']
        };
        if (useImageConfig) {
          generationConfig.imageConfig = { aspectRatio: '9:16' };
        }

        const res = await fetchWithTimeout(`${BASE_URL}/${m}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `Create a vertical 9:16 editorial background image without any text, letters, numbers, logos, or watermarks: ${cleanPrompt}` }]
            }],
            generationConfig
          })
        }, 35000);

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const errMsg = data?.error?.message || `HTTP ${res.status}`;
          // Se o modelo não aceita imageConfig, tenta 1x sem imageConfig
          if (res.status === 400 && useImageConfig && /imageConfig|aspectRatio|Unknown name/i.test(errMsg)) {
            useImageConfig = false;
            continue;
          }
          diagnostics.push({ model: m, endpoint: ':generateContent', status: res.status, message: errMsg });

          if (isInvalidKeyError(res.status, errMsg)) {
            throw Object.assign(new Error(`Chave da API Gemini inválida ou sem permissão (${errMsg}).`), {
              category: 'invalid_key',
              diagnostics
            });
          }

          if (res.status === 503 && imgAttempt < 2) {
            await sleep(Math.min(1500, GEMINI_RETRY_CONFIG.baseDelayMs));
            continue;
          }
          break;
        }

        const parts = data?.candidates?.[0]?.content?.parts || [];
        const imgPart = parts.find((p) => p.inlineData?.data);
        if (imgPart) {
          const usage = data?.usageMetadata || {};
          recordModelApiEvent({
            model: m,
            status: 'ok',
            inputTokens: usage.promptTokenCount || 0,
            outputTokens: usage.candidatesTokenCount || 0,
            totalTokens: usage.totalTokenCount || 0
          });
          const mime = imgPart.inlineData.mimeType || 'image/png';
          return {
            dataUrl: `data:${mime};base64,${imgPart.inlineData.data}`,
            modelUsed: m,
            endpoint: ':generateContent'
          };
        }
        diagnostics.push({ model: m, endpoint: ':generateContent', status: 200, message: 'Resposta sem imagem inlineData.' });
        break;
      } catch (err) {
        if (err?.category === 'invalid_key') throw err;
        diagnostics.push({ model: m, endpoint: ':generateContent', status: 0, message: err?.message || 'Erro de rede' });
        if (imgAttempt < 2) {
          await sleep(Math.min(1500, GEMINI_RETRY_CONFIG.baseDelayMs));
          continue;
        }
        break;
      }
    }
  }

  // 2) Fallback oficial: modelos Imagen via endpoint :predict
  for (const m of imagenCandidates) {
    if (typeof onStatus === 'function') onStatus(`Testando ${m} (:predict)...`);
    try {
      const res = await fetchWithTimeout(`${BASE_URL}/${m}:predict?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{
            prompt: `Vertical 9:16 editorial background photography, no text, no letters, no watermark: ${cleanPrompt}`
          }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '9:16'
          }
        })
      }, 35000);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        diagnostics.push({ model: m, endpoint: ':predict', status: res.status, message: errMsg });
        continue;
      }

      const pred = data?.predictions?.[0];
      const b64 = pred?.bytesBase64Encoded || pred?.image?.bytesBase64Encoded;
      if (b64) {
        recordModelApiEvent({ model: m, status: 'ok', inputTokens: 0, outputTokens: 0, totalTokens: 0 });
        const mime = pred?.mimeType || 'image/png';
        return {
          dataUrl: `data:${mime};base64,${b64}`,
          modelUsed: m,
          endpoint: ':predict'
        };
      }
      diagnostics.push({ model: m, endpoint: ':predict', status: 200, message: 'Predição retornou sem bytesBase64Encoded.' });
    } catch (err) {
      diagnostics.push({ model: m, endpoint: ':predict', status: 0, message: err?.message || 'Erro de rede' });
    }
  }

  // 3) Diagnóstico técnico claro baseado nos erros reais retornados pela API do Google
  const allMsgs = diagnostics.map((d) => `${d.status} ${d.message}`).join(' | ');
  let category = 'unknown';
  let userMessage = '';

  if (/limit:\s*0|free_tier|billing|billed|paid tier|enable billing|plan and billing|quota/i.test(allMsgs)) {
    category = 'billing_required';
    userMessage = 'A geração de imagem via API Gemini/Imagen exige faturamento ativo (Tier 1 / API Paga) no projeto do Google AI Studio — no plano gratuito a cota de imagem via API vem zerada (limit: 0).';
  } else if (/country|region|location is not supported|not available in your/i.test(allMsgs)) {
    category = 'region_restricted';
    userMessage = 'A API do Google retornou restrição geográfica/região para geração de imagem nesta chave.';
  } else if (diagnostics.length && diagnostics.every((d) => d.status === 404)) {
    category = 'model_not_found';
    userMessage = 'Nenhum dos modelos de imagem testados foi encontrado/liberado para esta chave na API v1beta.';
  } else {
    userMessage = 'Não foi possível gerar a imagem via API Gemini/Imagen com esta chave neste momento.';
  }

  throw Object.assign(new Error(userMessage), {
    category,
    diagnostics,
    discoveredImageModels: [...discoveredGenContent, ...discoveredImagen]
  });
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
