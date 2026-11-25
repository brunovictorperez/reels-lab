import { SERIES_MODELS, VIRAL_CODE, PROFESSIONS, EXTRA_1_FAQ } from './data-professions.js';
import {
  uid,
  loadState,
  saveState,
  exportBackupJson,
  syncToGoogleDrive,
  loadFromGoogleDrive,
  getEffectiveDriveWebhook,
  buildFilteredDriveState,
  mergeDriveBackupState,
  upsertImportedProfile,
  removeCreatorFromState,
  listDriveProfiles,
  loadDriveProfile,
  deleteDriveProfile,
  parseCreatorFieldItems,
  addCreatorFieldItem,
  removeCreatorFieldItem
} from './storage.js';
import {
  resolveSelectedModel,
  formatModelDisplayName,
  GOOGLE_NEWS_CATEGORIES,
  inferCreatorDefaultCategory,
  fetchGoogleNewsPortal,
  generateAnglesFromSelectedNews,
  X_TREND_DAY_FILTERS,
  fetchBrazilXTrends,
  generateAnglesFromXTrends,
  detectBestSeriesModelId,
  formatTrendDate,
  generateCompleteEpisode,
  generateSeriesIdeas,
  searchHotTopics,
  analyzeScript,
  generateCoverBackground,
  generateCreatorDnaQuickFill,
  listAvailableApiModels
} from './gemini.js';
import {
  COVER_TEMPLATES,
  renderCoverCanvas,
  renderCleanCoverExport,
  saveCoverImage,
  triggerBlobDownload
} from './cover-studio.js';

let state = null;
let currentEditingEpisodeId = null;
let currentCoverBgDataUrl = '';
let lastAnalysisOriginalScript = '';
let lastAnalysisImprovedScript = '';
let lastCoverExportFallback = null;
const expandedSeriesIds = new Set();
const expandedEpisodeIds = new Set();
const openMoveEpisodeIds = new Set();
const selectedPortalArticleUrls = new Set();
const portalCategoryCache = new Map();
let activePortalCategory = 'brasil';
let activePortalSubCategory = 'todas';
let activePortalDateFilter = 'any';
let activePortalSearchQuery = '';
let currentAttachedNews = null;
let driveProfilesCache = [];
let activeRadarPortalMode = 'google';
let activeXDayFilter = 'all';
let xTrendsCache = { items: [], days: [], fetchedFrom: '', fetchedAt: '' };
const selectedXTrendIds = new Set();

// Teleprompter state
let tpInterval = null;
let tpFsInterval = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  state = await loadState();
  applyTheme(state.settings.theme || 'light');

  populateStaticSelects();
  wireThemeToggle();
  wireNavigation();
  wireModals();
  wireCreatorTab();
  wireRadarTab();
  wireFactoryTab();
  wireClubAndTeleprompter();
  wireLibraryTab();
  wirePlannerTab();

  refreshAllUI();

  // Load latest episode of active creator into factory if available
  const activeEp = getCreatorEpisodes()[0];
  if (activeEp) {
    loadEpisodeIntoFactory(activeEp);
  } else {
    const firstSeries = getCreatorSeries()[0];
    if (firstSeries) {
      document.getElementById('f_seriesSelect').value = firstSeries.id;
      document.getElementById('f_modelSelect').value = firstSeries.modelId || 'serie_01';
      document.getElementById('cov_seriesLabel').value = firstSeries.name;
      updateModelRuleHint();
    }
    renderSeriesPartsStrip();
    await updateCoverPreview();
  }
});

function applyTheme(theme) {
  const mode = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', mode);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', mode === 'dark' ? '#000000' : '#F5F5F7');
  }
  const icon = document.getElementById('themeToggleIcon');
  const label = document.getElementById('themeToggleLabel');
  if (icon && label) {
    if (mode === 'dark') {
      icon.textContent = '☀';
      label.textContent = 'Claro';
    } else {
      icon.textContent = '☾';
      label.textContent = 'Escuro';
    }
  }
  const tplSel = document.getElementById('cov_template');
  if (tplSel && (tplSel.value === 'apple_light' || tplSel.value === 'apple_dark')) {
    tplSel.value = mode === 'dark' ? 'apple_dark' : 'apple_light';
    updateCoverPreview();
  }
}

function wireThemeToggle() {
  document.getElementById('themeToggleBtn').addEventListener('click', async () => {
    const next = (state.settings.theme || 'light') === 'light' ? 'dark' : 'light';
    state.settings.theme = next;
    applyTheme(next);
    await persist();
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

async function persist() {
  await saveState(state);
  updateMemoryStats();
}

function getActiveCreator() {
  return state.creators.find((c) => c.id === state.activeCreatorId) || state.creators[0];
}

function getCreatorSeries() {
  const cId = getActiveCreator()?.id;
  return state.series.filter((s) => s.creatorId === cId);
}

function getCreatorEpisodes() {
  const cId = getActiveCreator()?.id;
  return state.episodes
    .filter((e) => e.creatorId === cId)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

function showToast(msg, type = 'info') {
  const box = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : ''}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 4400);
}

function buildLoadingMarkup(statusText, useModelPrefix = true) {
  const hasKey = Boolean(state?.settings?.geminiKey);
  const modelName = hasKey && useModelPrefix ? formatModelDisplayName(state.settings.geminiModel) : '';
  let text = String(statusText || 'Carregando...');
  if (modelName) {
    if (text === modelName) {
      text = `${modelName} · Gerando...`;
    } else if (!text.includes(modelName)) {
      text = `${modelName} · ${text}`;
    }
  }
  return `<span class="ai-loading-inline"><span class="ai-spinner" aria-hidden="true"></span><span>${escapeHtml(text)}</span></span>`;
}

async function runWithStatusTicker(buttons, initialStatus, asyncFn, options = {}) {
  const list = (Array.isArray(buttons) ? buttons : [buttons]).filter(Boolean);
  const snapshots = list.map((b) => ({ el: b, html: b.innerHTML }));
  const useModelPrefix = options?.showModelName !== false;

  const renderLabel = (statusText) => {
    const html = buildLoadingMarkup(statusText, useModelPrefix);
    list.forEach((b) => {
      b.disabled = true;
      b.innerHTML = html;
    });
  };

  renderLabel(initialStatus);

  try {
    return await asyncFn((nextStatus) => {
      if (nextStatus) {
        renderLabel(nextStatus);
      }
    });
  } finally {
    snapshots.forEach(({ el, html }) => {
      el.disabled = false;
      el.innerHTML = html;
    });
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// STATIC POPULATORS & NAVIGATION
// ============================================================================

function populateStaticSelects() {
  // Professions selector in Tab 1 and Quick Fill in Factory
  const profOptions = PROFESSIONS.map((p) => `<option value="${p.id}">${p.category} — ${p.name}</option>`).join('');
  document.getElementById('importProfessionSelect').innerHTML = profOptions;
  document.getElementById('qfProfSelect').innerHTML = profOptions;

  // Series Models in Factory
  const modelOptions = SERIES_MODELS.map((m) => `<option value="${m.id}">${m.code}: ${m.shortName}</option>`).join('');
  document.getElementById('f_modelSelect').innerHTML = modelOptions;
  document.getElementById('ns_model').innerHTML = modelOptions;

  // Funnel Stages & Viral Goals
  document.getElementById('f_funnelStage').innerHTML = VIRAL_CODE.funnelStages
    .map((f) => `<option value="${f.id}">${f.label}</option>`)
    .join('');
  document.getElementById('f_viralGoal').innerHTML = VIRAL_CODE.hierarchies
    .map((h) => `<option value="${h.id}">${h.label}</option>`)
    .join('');

  const tplSel = document.getElementById('cov_template');
  tplSel.innerHTML = COVER_TEMPLATES
    .map((t) => `<option value="${t.id}">${t.name}</option>`)
    .join('');
  tplSel.value = (state?.settings?.theme || 'light') === 'dark' ? 'apple_dark' : 'apple_light';

  // Pre-record Checklist in Tab 4
  document.getElementById('preRecordChecklist').innerHTML = VIRAL_CODE.preRecordChecklist
    .map((item, idx) => `
      <label class="check-item">
        <input type="checkbox" id="chk_${idx}" />
        <span>${escapeHtml(item)}</span>
      </label>
    `).join('');
}

function wireNavigation() {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
      sidebar.classList.remove('open');
    });
  });

  // Scoped subtabs (so Factory and Library subtabs work independently)
  document.querySelectorAll('.subtab[data-subtab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.tab-panel, .card');
      const targetId = btn.dataset.subtab;
      if (!targetId) return;
      parent.querySelectorAll('.subtab[data-subtab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      parent.querySelectorAll('.subtab-panel').forEach((p) => {
        p.classList.toggle('active', p.id === targetId);
      });
      if (targetId === 'out-cover') {
        updateCoverPreview();
      }
    });
  });

  // Copy buttons
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const target = document.getElementById(btn.dataset.copy);
      if (!target) return;
      await copyText(target.value || target.textContent);
    });
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text || '');
    showToast('Copiado para a área de transferência!', 'ok');
  } catch {
    showToast('Não foi possível copiar automaticamente — selecione e copie manualmente.', 'err');
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('active', p.id === tabId);
  });
  if (tabId === 'tab-library') {
    renderSeriesFolders();
    renderUnfiledEpisodes();
  }
  if (tabId === 'tab-planner') renderWeeklyGrid();
}

function refreshAllUI() {
  renderCreatorSelect();
  loadCreatorIntoForm();
  renderFactoryContextBar();
  renderFactorySeriesSelect();
  renderSeriesPartsStrip();
  renderQuickFillFactory();
  updateModelRuleHint();
  renderSeriesFolders();
  renderUnfiledEpisodes();
  renderCatalog();
  renderWeeklyGrid();
  renderFaqAccordion();
  renderCachedHotTopics();
  updateStatusIndicators();
  updateMemoryStats();
}

function updateStatusIndicators() {
  const aiDot = document.getElementById('aiStatusDot');
  const aiText = document.getElementById('aiStatusText');
  if (state.settings.geminiKey) {
    aiDot.className = 'dot dot-ok';
    const shortEngine = formatModelDisplayName(state.settings.geminiModel).replace(/^Gemini\s+/i, '');
    aiText.textContent = `IA: ${shortEngine}`;
  } else {
    aiDot.className = 'dot dot-warn';
    aiText.textContent = 'IA: Local';
  }

  const activeCreator = getActiveCreator();
  const activeDriveUrl = getEffectiveDriveWebhook(state, activeCreator);
  const driveDot = document.getElementById('driveStatusDot');
  const driveText = document.getElementById('driveStatusText');
  if (activeDriveUrl) {
    driveDot.className = 'dot dot-ok';
    driveText.textContent = 'Drive Ativo';
  } else {
    driveDot.className = 'dot dot-local';
    driveText.textContent = 'Drive';
  }

  const syncInfo = document.getElementById('driveLastSyncInfo');
  const lastSync = activeCreator?.driveLastSync || state.settings.lastDriveSync;
  if (syncInfo) {
    syncInfo.textContent = lastSync ? `Última sincronização deste perfil: ${new Date(lastSync).toLocaleString('pt-BR')}` : '';
  }
}

function updateMemoryStats() {
  const cCount = state.creators.length;
  const sCount = state.series.length;
  const eCount = state.episodes.length;
  document.getElementById('memoryStatsText').textContent = `${cCount} perfil(is) • ${sCount} séries • ${eCount} episódios salvos`;
}

// ============================================================================
// MODALS: GEMINI AI & GOOGLE DRIVE / BACKUP
// ============================================================================

function wireModals() {
  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', () => {
      document.getElementById(el.dataset.close).classList.add('hidden');
    });
  });

  document.getElementById('openAiModalBtn').addEventListener('click', () => {
    document.getElementById('m_geminiKey').value = state.settings.geminiKey || '';
    const modelSel = document.getElementById('m_geminiModel');
    const savedModel = resolveSelectedModel(state.settings.geminiModel);
    if (!Array.from(modelSel.options).some((o) => o.value === savedModel)) {
      const opt = document.createElement('option');
      opt.value = savedModel;
      opt.textContent = `${savedModel} (Personalizado)`;
      modelSel.appendChild(opt);
    }
    modelSel.value = savedModel;
    document.getElementById('apiModelsResultBox').classList.add('hidden');
    document.getElementById('aiModal').classList.remove('hidden');
  });

  document.getElementById('checkApiModelsBtn').addEventListener('click', async () => {
    const key = document.getElementById('m_geminiKey').value.trim();
    if (!key) {
      showToast('Cole sua Gemini API Key acima primeiro.', 'err');
      return;
    }
    state.settings.geminiKey = key;
    await persist();

    const btn = document.getElementById('checkApiModelsBtn');
    const resultBox = document.getElementById('apiModelsResultBox');
    try {
      const categorized = await runWithStatusTicker(btn, 'Consultando chave...', () => listAvailableApiModels(key), { showModelName: false });
      const groups = [
        { label: '⚡ Linha Gemini 4 (Recomendado)', items: categorized.gemini4 || [], selectable: true },
        { label: '✨ Linha Gemini 3', items: categorized.gemini3 || [], selectable: true },
        { label: '🎨 Geração de Imagem (Nano Banana)', items: categorized.image || [], selectable: false },
        { label: 'Outros modelos compatíveis', items: (categorized.other || []).slice(0, 6), selectable: true }
      ].filter((g) => g.items.length);

      resultBox.classList.remove('hidden');
      if (!groups.length) {
        resultBox.innerHTML = `<div class="muted-sm">Nenhum modelo encontrado nesta chave no momento.</div>`;
        return;
      }

      resultBox.innerHTML = `<div class="muted-xs mb-12"><strong>Modelos liberados na sua API agora</strong> (clique em um modelo de texto para selecionar):</div>` +
        groups.map((g) => `
          <div class="mb-12">
            <div class="muted-xs" style="font-weight:700;">${escapeHtml(g.label)}</div>
            <div class="model-pill-list">
              ${g.items.map((id) => g.selectable
                ? `<button type="button" class="model-pill pick-model-pill" data-model="${escapeHtml(id)}">${escapeHtml(id)}</button>`
                : `<span class="badge-pill">${escapeHtml(id)}</span>`
              ).join('')}
            </div>
          </div>
        `).join('');

      resultBox.querySelectorAll('.pick-model-pill').forEach((pBtn) => {
        pBtn.addEventListener('click', () => {
          const sel = document.getElementById('m_geminiModel');
          const id = pBtn.dataset.model;
          if (!Array.from(sel.options).some((o) => o.value === id)) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `${id} (Verificado na API)`;
            sel.appendChild(opt);
          }
          sel.value = id;
          showToast(`Modelo "${id}" selecionado! Clique em Salvar Chave IA.`, 'ok');
        });
      });
    } catch (err) {
      resultBox.classList.remove('hidden');
      resultBox.innerHTML = `<div class="muted-sm" style="color:var(--red);">Erro ao consultar chave: ${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('saveAiSettingsBtn').addEventListener('click', async () => {
    state.settings.geminiKey = document.getElementById('m_geminiKey').value.trim();
    state.settings.geminiModel = document.getElementById('m_geminiModel').value;
    await persist();
    updateStatusIndicators();
    document.getElementById('aiModal').classList.add('hidden');
    showToast('Configurações do Google Gemini salvas!', 'ok');
  });

  document.getElementById('coverExportDirectDownloadBtn').addEventListener('click', () => {
    if (!lastCoverExportFallback) return;
    triggerBlobDownload(lastCoverExportFallback.blob, lastCoverExportFallback.dataUrl, lastCoverExportFallback.filename);
    showToast('Arquivo PNG baixado!', 'ok');
  });

  document.getElementById('openDriveModalBtn').addEventListener('click', () => {
    openDriveModalForActiveCreator();
  });

  document.getElementById('refreshDriveProfilesBtn').addEventListener('click', () => {
    loadAndRenderDriveProfiles({ silent: false });
  });

  document.getElementById('saveDriveUrlBtn').addEventListener('click', async () => {
    const active = getActiveCreator();
    const url = document.getElementById('m_driveUrl').value.trim();
    const onlyActive = document.getElementById('m_driveOnlyActiveCreator').checked;
    if (active) {
      active.driveWebhookUrl = url;
      active.driveOnlyActive = onlyActive;
      if (active.id === state.creators[0]?.id) {
        state.settings.driveWebhookUrl = url;
      }
    }
    await persist();
    updateStatusIndicators();
    showToast(`URL do Google Drive salva para "${active?.name || 'Perfil'}"!`, 'ok');
    if (url) {
      loadAndRenderDriveProfiles({ silent: true });
    }
  });

  document.getElementById('exportBackupBtn').addEventListener('click', () => {
    exportBackupJson(state);
    showToast('Backup .json baixado com sucesso!', 'ok');
  });

  document.getElementById('importBackupInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const imported = JSON.parse(txt);
      if (!imported.creators || !Array.isArray(imported.creators)) {
        throw new Error('Arquivo de backup inválido.');
      }
      state = imported;
      state.settings.geminiModel = resolveSelectedModel(state.settings?.geminiModel);
      applyTheme(state.settings?.theme || 'light');
      await persist();
      refreshAllUI();
      showToast('Backup restaurado com sucesso!', 'ok');
      document.getElementById('driveModal').classList.add('hidden');
    } catch (err) {
      showToast(err.message || 'Erro ao importar backup.', 'err');
    }
    e.target.value = '';
  });

  document.getElementById('syncDriveNowBtn').addEventListener('click', async () => {
    const active = getActiveCreator();
    const url = document.getElementById('m_driveUrl').value.trim();
    const onlyActive = document.getElementById('m_driveOnlyActiveCreator').checked;
    if (active) {
      active.driveWebhookUrl = url;
      active.driveOnlyActive = onlyActive;
      if (active.id === state.creators[0]?.id) {
        state.settings.driveWebhookUrl = url;
      }
    }
    await persist();
    const btn = document.getElementById('syncDriveNowBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Sincronizando...';
    try {
      const payloadState = buildFilteredDriveState(state, active?.id, onlyActive);
      const res = await syncToGoogleDrive(payloadState, url);
      const syncedAt = res.syncedAt || new Date().toISOString();
      if (active) {
        active.driveLastSync = syncedAt;
        active.driveFolderUrl = res.folderUrl || '';
      }
      state.settings.lastDriveSync = syncedAt;
      state.settings.driveFolderUrl = res.folderUrl || '';
      await persist();
      updateStatusIndicators();
      loadAndRenderDriveProfiles({ silent: true });
      showToast(
        onlyActive
          ? `Perfil "${active?.name}" salvo no Google Drive (sincronização bidirecional ativa)!`
          : 'Salvo na pasta "Reels Lab - Studio" do Google Drive!',
        'ok'
      );
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '☁️ Salvar no Drive Agora';
    }
  });

  document.getElementById('loadDriveNowBtn').addEventListener('click', async () => {
    const active = getActiveCreator();
    const url = document.getElementById('m_driveUrl').value.trim();
    const onlyActive = document.getElementById('m_driveOnlyActiveCreator').checked;
    if (active) {
      active.driveWebhookUrl = url;
      active.driveOnlyActive = onlyActive;
    }
    await persist();
    const btn = document.getElementById('loadDriveNowBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Carregando...';
    try {
      const res = await loadFromGoogleDrive(url);
      if (!res.found || !res.data) {
        showToast('Nenhum backup encontrado neste Google Drive ainda.', 'err');
      } else {
        state = mergeDriveBackupState(state, res.data, active?.id, onlyActive);
        const updatedActive = getActiveCreator();
        if (updatedActive) {
          updatedActive.driveWebhookUrl = url;
          updatedActive.driveOnlyActive = onlyActive;
        }
        applyTheme(state.settings?.theme || 'light');
        await persist();
        refreshAllUI();
        showToast('Dados carregados do Google Drive!', 'ok');
      }
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '📥 Puxar do Drive';
    }
  });

  document.getElementById('copyAppsScriptBtn').addEventListener('click', async () => {
    try {
      const res = await fetch('./google-apps-script.gs');
      const code = await res.text();
      await copyText(code);
    } catch {
      showToast('Abra o arquivo google-apps-script.gs na pasta do projeto para copiar.', 'err');
    }
  });
}

function getDriveModalUrl() {
  const modalUrl = document.getElementById('m_driveUrl')?.value.trim() || '';
  return modalUrl || getEffectiveDriveWebhook(state, getActiveCreator());
}

function openDriveModalForActiveCreator() {
  const active = getActiveCreator();
  const label = document.getElementById('driveProfileLabel');
  if (label) label.textContent = `${active?.name || 'Criador Ativo'} (${active?.handle || '@perfil'})`;
  const webhook = getEffectiveDriveWebhook(state, active);
  document.getElementById('m_driveUrl').value = webhook;
  document.getElementById('m_driveOnlyActiveCreator').checked = active?.driveOnlyActive !== false;
  updateStatusIndicators();
  document.getElementById('driveModal').classList.remove('hidden');
  if (webhook) {
    loadAndRenderDriveProfiles({ silent: true });
  } else {
    renderDriveProfilesList();
  }
}

async function loadAndRenderDriveProfiles({ silent = false } = {}) {
  const listEl = document.getElementById('driveProfilesList');
  const btn = document.getElementById('refreshDriveProfilesBtn');
  const webhook = getDriveModalUrl();
  if (!webhook) {
    driveProfilesCache = [];
    renderDriveProfilesList();
    if (!silent) {
      showToast('Cole a URL do Google Apps Script acima antes de listar os perfis do Drive.', 'err');
    }
    return;
  }

  if (listEl) {
    listEl.innerHTML = `<div class="sub-card"><span class="ai-loading-inline"><span class="ai-spinner" aria-hidden="true"></span><span>Consultando perfis salvos no Google Drive...</span></span></div>`;
  }

  try {
    driveProfilesCache = await runWithStatusTicker(
      btn,
      'Listando...',
      () => listDriveProfiles(webhook),
      { showModelName: false }
    );
    renderDriveProfilesList();
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = `<div class="muted-sm" style="color:var(--red);">${escapeHtml(err.message)}</div>`;
    }
    if (!silent) showToast(err.message, 'err');
  }
}

function renderDriveProfilesList() {
  const listEl = document.getElementById('driveProfilesList');
  if (!listEl) return;
  const webhook = getDriveModalUrl();
  if (!webhook) {
    listEl.innerHTML = `<div class="muted-sm">Conecte a URL do Google Apps Script acima para listar, resgatar ou excluir perfis no Google Drive.</div>`;
    return;
  }

  if (!driveProfilesCache.length) {
    listEl.innerHTML = `<div class="muted-sm">Nenhum perfil salvo individualmente no Google Drive ainda. Clique em <strong>☁️ Salvar no Drive Agora</strong> para enviar o perfil ativo.</div>`;
    return;
  }

  listEl.innerHTML = driveProfilesCache.map((prof) => {
    const existsLocal = state.creators.some((c) => c.id === prof.id);
    const updatedText = prof.updatedAt ? formatTrendDate(prof.updatedAt) : 'Recente';
    return `
      <div class="drive-profile-row" data-id="${escapeHtml(prof.id)}">
        <div class="drive-profile-meta">
          <div class="drive-profile-title">
            <span>${escapeHtml(prof.name)}</span>
            <span class="muted-xs">${escapeHtml(prof.handle || 'sem @')}</span>
            <span class="badge-pill">${existsLocal ? '✓ No App e no Drive' : '☁️ Somente no Drive'}</span>
          </div>
          <div class="muted-xs">
            ${escapeHtml(prof.niche || 'Sem nicho')} • ${Number(prof.seriesCount || 0)} série(s) • ${Number(prof.episodesCount || 0)} roteiro(s) • 🕒 ${escapeHtml(updatedText)}
          </div>
        </div>
        <div class="drive-profile-actions">
          <button type="button" class="btn btn-primary btn-xs restore-drive-profile-btn" data-id="${escapeHtml(prof.id)}">
            ${existsLocal ? '🔄 Atualizar do Drive' : '📥 Resgatar p/ o App'}
          </button>
          <button type="button" class="btn btn-danger-outline btn-xs delete-drive-profile-btn" data-id="${escapeHtml(prof.id)}" data-name="${escapeHtml(prof.name)}">
            🗑️ Excluir do Drive
          </button>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.restore-drive-profile-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.id;
      const url = getDriveModalUrl();
      try {
        const res = await runWithStatusTicker(btn, 'Resgatando...', () => loadDriveProfile(url, targetId), { showModelName: false });
        if (!res.found || !res.profile) {
          showToast('Perfil não encontrado no Google Drive.', 'err');
          return;
        }
        state = upsertImportedProfile(state, res.profile, { driveWebhookUrl: url });
        currentEditingEpisodeId = null;
        await persist();
        refreshAllUI();
        const firstEp = getCreatorEpisodes()[0];
        if (firstEp) loadEpisodeIntoFactory(firstEp);
        else clearFactoryFields();
        renderDriveProfilesList();
        showToast(`Perfil "${res.profile.creator?.name}" resgatado do Google Drive para o App!`, 'ok');
      } catch (err) {
        showToast(err.message, 'err');
      }
    });
  });

  listEl.querySelectorAll('.delete-drive-profile-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.id;
      const targetName = btn.dataset.name || 'Perfil';
      const url = getDriveModalUrl();
      if (!confirm(`Excluir permanentemente o perfil "${targetName}" do Google Drive (backup e pasta na nuvem)?`)) {
        return;
      }
      try {
        await runWithStatusTicker(
          btn,
          'Excluindo...',
          () => deleteDriveProfile(url, { creatorId: targetId, creatorName: targetName, deleteReadableFolder: true }),
          { showModelName: false }
        );
        driveProfilesCache = driveProfilesCache.filter((p) => p.id !== targetId);

        const existsLocal = state.creators.some((c) => c.id === targetId);
        if (existsLocal && state.creators.length > 1) {
          if (confirm(`O perfil "${targetName}" também está salvo neste aparelho. Deseja removê-lo do App também?`)) {
            state = removeCreatorFromState(state, targetId);
            currentEditingEpisodeId = null;
            await persist();
            refreshAllUI();
            const nextEp = getCreatorEpisodes()[0];
            if (nextEp) loadEpisodeIntoFactory(nextEp);
            else clearFactoryFields();
          }
        }
        renderDriveProfilesList();
        showToast(`Perfil "${targetName}" excluído do Google Drive!`, 'ok');
      } catch (err) {
        showToast(err.message, 'err');
      }
    });
  });
}

// ============================================================================
// TAB 1: DNA DO CRIADOR (MULTI-PERFIS)
// ============================================================================

function renderCreatorSelect() {
  const sel = document.getElementById('activeCreatorSelect');
  sel.innerHTML = state.creators
    .map((c) => `<option value="${c.id}" ${c.id === state.activeCreatorId ? 'selected' : ''}>${escapeHtml(c.name)} (${escapeHtml(c.handle || 'sem @')})</option>`)
    .join('');
}

function loadCreatorIntoForm() {
  const c = getActiveCreator();
  if (!c) return;
  document.getElementById('c_name').value = c.name || '';
  document.getElementById('c_handle').value = c.handle || '';
  document.getElementById('c_niche').value = c.niche || '';
  document.getElementById('c_positioning').value = c.positioning || '';
  document.getElementById('c_brandColor').value = c.brandColor || '#EC4899';
  document.getElementById('c_visualStyle').value = c.visualStyle || '';
  document.getElementById('c_targetGroupPrefix').value = c.targetGroupPrefix || 'A pessoa que';
  document.getElementById('c_audience').value = c.audience || '';
  document.getElementById('c_pains').value = c.pains || '';
  document.getElementById('c_desires').value = c.desires || '';
  document.getElementById('c_pronoun').value = c.pronoun || 'você';
  document.getElementById('c_tone').value = c.tone || '';
  document.getElementById('c_forbiddenWords').value = c.forbiddenWords || '';
  document.getElementById('c_product').value = c.product || '';
  document.getElementById('c_objections').value = c.objections || '';
  document.getElementById('c_manychatKeyword').value = c.manychatKeyword || '';
}

function wireCreatorTab() {
  document.getElementById('activeCreatorSelect').addEventListener('change', async (e) => {
    state.activeCreatorId = e.target.value;
    await persist();
    currentEditingEpisodeId = null;
    refreshAllUI();
    const firstEp = getCreatorEpisodes()[0];
    if (firstEp) loadEpisodeIntoFactory(firstEp);
    else clearFactoryFields();
    showToast(`Perfil ativo: ${getActiveCreator().name}`, 'ok');
  });

  document.getElementById('openDriveProfilesBtn').addEventListener('click', () => {
    openDriveModalForActiveCreator();
  });

  document.getElementById('saveCreatorBtn').addEventListener('click', async () => {
    const active = syncFormToActiveCreator();
    await persist();
    renderCreatorSelect();
    renderFactoryContextBar();
    renderQuickFillFactory();
    await updateCoverPreview();

    const webhook = getEffectiveDriveWebhook(state, active);
    if (webhook) {
      try {
        const payloadState = buildFilteredDriveState(state, active?.id, active?.driveOnlyActive !== false);
        const res = await syncToGoogleDrive(payloadState, webhook, { mergeProfiles: true });
        if (active) {
          active.driveLastSync = res.syncedAt || new Date().toISOString();
          active.driveFolderUrl = res.folderUrl || active.driveFolderUrl || '';
          await persist();
          updateStatusIndicators();
        }
        showToast(`DNA de "${active.name}" salvo no App e sincronizado no Google Drive!`, 'ok');
        return;
      } catch {
        showToast('DNA salvo na memória do aparelho! (Não foi possível enviar ao Drive agora.)', 'ok');
        return;
      }
    }
    showToast('DNA do Criador salvo na memória!', 'ok');
  });

  document.getElementById('quickFillActiveCreatorBtn').addEventListener('click', async () => {
    await handleQuickFillActiveCreator();
  });

  document.getElementById('newCreatorBtn').addEventListener('click', async () => {
    const newId = uid('creator');
    state.creators.push({
      id: newId,
      name: `Novo Criador ${state.creators.length + 1}`,
      handle: '@novoperfil',
      niche: '',
      positioning: '',
      targetGroupPrefix: 'A pessoa que',
      audience: '',
      pains: '',
      desires: '',
      objections: '',
      pronoun: 'você',
      tone: 'Conversa natural e direta, sem parecer seminário.',
      forbiddenWords: 'oi gente tudo bem, outrossim',
      product: '',
      manychatKeyword: 'QUERO',
      brandColor: '#8B5CF6',
      visualStyle: 'Minimalista editorial estilo Apple, luz natural limpa',
      driveWebhookUrl: '',
      driveOnlyActive: true,
      driveLastSync: null,
      driveFolderUrl: ''
    });
    state.activeCreatorId = newId;
    await persist();
    refreshAllUI();
    clearFactoryFields();
    showToast('Novo perfil criado! Use o Preenchimento Rápido ou preencha abaixo.', 'ok');
  });

  document.getElementById('deleteCreatorBtn').addEventListener('click', async () => {
    if (state.creators.length <= 1) {
      showToast('Você precisa manter pelo menos 1 perfil de criador.', 'err');
      return;
    }
    const active = getActiveCreator();
    if (!confirm(`Excluir o perfil "${active.name}" e suas séries/roteiros?`)) return;

    const webhook = getEffectiveDriveWebhook(state, active);
    let removedFromDrive = false;
    if (webhook && confirm(`Deseja também excluir "${active.name}" do Google Drive (backup e pasta na nuvem)?\n\nOK = Excluir do App e do Google Drive\nCancelar = Excluir apenas deste aparelho`)) {
      try {
        await deleteDriveProfile(webhook, {
          creatorId: active.id,
          creatorName: active.name,
          deleteReadableFolder: true
        });
        removedFromDrive = true;
      } catch (err) {
        showToast(`Removido localmente, mas falhou no Drive: ${err.message}`, 'err');
      }
    }

    state = removeCreatorFromState(state, active.id);
    currentEditingEpisodeId = null;
    await persist();
    refreshAllUI();
    const nextEp = getCreatorEpisodes()[0];
    if (nextEp) loadEpisodeIntoFactory(nextEp);
    else clearFactoryFields();
    showToast(removedFromDrive ? 'Perfil removido do App e do Google Drive!' : 'Perfil removido deste aparelho.', 'ok');
  });

  document.getElementById('applyProfessionBtn').addEventListener('click', async () => {
    const profId = document.getElementById('importProfessionSelect').value;
    await importProfessionForActiveCreator(profId);
  });
}

function syncFormToActiveCreator() {
  const c = getActiveCreator();
  if (!c) return c;
  c.name = document.getElementById('c_name').value.trim() || 'Criador Sem Nome';
  c.handle = document.getElementById('c_handle').value.trim();
  c.niche = document.getElementById('c_niche').value.trim();
  c.positioning = document.getElementById('c_positioning').value.trim();
  c.brandColor = document.getElementById('c_brandColor').value;
  c.visualStyle = document.getElementById('c_visualStyle').value.trim();
  c.targetGroupPrefix = document.getElementById('c_targetGroupPrefix').value;
  c.audience = document.getElementById('c_audience').value.trim();
  c.pains = document.getElementById('c_pains').value.trim();
  c.desires = document.getElementById('c_desires').value.trim();
  c.pronoun = document.getElementById('c_pronoun').value;
  c.tone = document.getElementById('c_tone').value.trim();
  c.forbiddenWords = document.getElementById('c_forbiddenWords').value.trim();
  c.product = document.getElementById('c_product').value.trim();
  c.objections = document.getElementById('c_objections').value.trim();
  c.manychatKeyword = document.getElementById('c_manychatKeyword').value.trim().toUpperCase();
  return c;
}

async function handleQuickFillActiveCreator() {
  const creator = syncFormToActiveCreator();
  if (!creator) return;

  if (!creator.niche && !creator.positioning) {
    showToast('Digite pelo menos o Nicho ou Posicionamento do Criador Ativo no formulário (ou escolha uma das 33 Profissões).', 'err');
    switchTab('tab-creator');
    document.getElementById('c_niche').focus();
    return;
  }

  const btns = [
    document.getElementById('quickFillActiveCreatorBtn'),
    document.getElementById('factoryQuickFillDnaBtn')
  ].filter(Boolean);

  try {
    const filled = await runWithStatusTicker(btns, 'Gerando DNA do Criador...', (onStatus) =>
      generateCreatorDnaQuickFill({
        creator,
        apiKey: state.settings.geminiKey,
        modelName: state.settings.geminiModel,
        onStatus
      })
    );

    creator.niche = filled.niche || creator.niche;
    creator.positioning = filled.positioning || creator.positioning;
    creator.targetGroupPrefix = filled.targetGroupPrefix || creator.targetGroupPrefix || 'A pessoa que';
    creator.audience = filled.audience || creator.audience;
    creator.pains = filled.pains || creator.pains;
    creator.desires = filled.desires || creator.desires;
    creator.objections = filled.objections || creator.objections;
    creator.pronoun = filled.pronoun || creator.pronoun || 'você';
    creator.tone = filled.tone || creator.tone;
    creator.forbiddenWords = filled.forbiddenWords || creator.forbiddenWords;
    creator.product = filled.product || creator.product;
    creator.manychatKeyword = (filled.manychatKeyword || creator.manychatKeyword || 'EUQUERO').toUpperCase();
    creator.visualStyle = filled.visualStyle || creator.visualStyle;

    let addedSeries = 0;
    (filled.seriesSuggestions || []).forEach((s) => {
      const exists = state.series.some((ex) => ex.creatorId === creator.id && ex.name === s.title);
      if (!exists && s.title) {
        const sId = uid('serie');
        state.series.push({
          id: sId,
          creatorId: creator.id,
          name: s.title,
          modelId: s.modelId || 'serie_01',
          description: `Série personalizada para ${creator.name}`,
          color: creator.brandColor || '#8B5CF6',
          createdAt: new Date().toISOString()
        });
        (s.parts || []).forEach((partTitle, idx) => {
          state.episodes.push({
            id: uid('ep'),
            creatorId: creator.id,
            seriesId: sId,
            partNumber: idx + 1,
            title: partTitle,
            onScreenText: `${s.title} • Parte ${idx + 1}`,
            headlines: [String(partTitle).slice(0, 48)],
            funnelStage: idx === 2 ? 'meio' : 'topo',
            viralGoal: 'share',
            status: 'ideia',
            script: '',
            caption: '',
            editingPrompt: '',
            coverImagePrompt: '',
            coverDataUrl: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
        addedSeries++;
      }
    });

    await persist();
    refreshAllUI();
    const note = filled.fallbackReason ? ' (Gemini congestionado no Google — contingência aplicada)' : '';
    showToast(`DNA de "${creator.name}" completado (${filled.generatedBy}) + ${addedSeries} séries!${note}`, 'ok');
  } catch (err) {
    showToast(`Erro no preenchimento rápido: ${err.message}`, 'err');
  }
}

async function importProfessionForActiveCreator(profId) {
  const prof = PROFESSIONS.find((p) => p.id === profId);
  if (!prof) return;
  const creator = syncFormToActiveCreator();

  creator.professionId = prof.id;
  creator.niche = `${prof.name} (${prof.category})`;
  creator.positioning = prof.subtitle;

  // Populate full DNA fields from the selected profession's scenarios & desires
  const s3Parts = prof.series.find((s) => s.modelId === 'serie_03')?.parts || [];
  const s5Parts = prof.series.find((s) => s.modelId === 'serie_05')?.parts || [];
  const firstS3 = s3Parts[0] || '';
  const detectedPrefix = ['A mulher que', 'A mãe que', 'O homem que', 'A empreendedora que', 'O profissional que']
    .find((pref) => firstS3.startsWith(pref)) || 'A pessoa que';

  creator.targetGroupPrefix = detectedPrefix;
  creator.audience = `Público interessado em ${prof.name} que se identifica com: "${prof.subtitle}"`;
  creator.pains = (s3Parts.length ? s3Parts : prof.series.slice(0, 3).map((s) => s.parts[0]))
    .slice(0, 3)
    .map((txt, i) => `${i + 1}. ${txt}`)
    .join('\n');
  creator.desires = (s5Parts.length ? s5Parts : prof.series.slice(2, 5).map((s) => s.parts[0]))
    .slice(0, 3)
    .map((txt, i) => `${i + 1}. ${txt}`)
    .join('\n');
  creator.objections = `"Não tenho tempo para aplicar isso agora", "Acho difícil manter consistência", "Já tentei outras dicas de ${prof.name} antes".`;
  creator.pronoun = 'você';
  creator.tone = `Direto, acolhedor e prático — conversa leve como com uma amiga sobre ${prof.name}.`;
  creator.forbiddenWords = 'oi gente tudo bem, olá pessoal, outrossim, hodiernamente, jargões técnicos complicados';
  creator.product = `Consultoria / Atendimento Especializado em ${prof.name}`;
  creator.manychatKeyword = prof.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 8) || 'GUIA';
  creator.visualStyle = 'Minimalista editorial estilo Apple, luz natural limpa e contraste nítido';

  let importedSeriesCount = 0;
  prof.series.forEach((s) => {
    const exists = state.series.some((ex) => ex.creatorId === creator.id && ex.name === s.title);
    if (!exists) {
      const sId = uid('serie');
      state.series.push({
        id: sId,
        creatorId: creator.id,
        name: s.title,
        modelId: s.modelId,
        description: `Série oficial de ${prof.name} (Guia 33 Profissões)`,
        color: creator.brandColor || '#8B5CF6',
        createdAt: new Date().toISOString()
      });
      // Import Parts 1, 2, 3 as ready-to-generate Idea cards
      s.parts.forEach((partTitle, idx) => {
        state.episodes.push({
          id: uid('ep'),
          creatorId: creator.id,
          seriesId: sId,
          partNumber: idx + 1,
          title: partTitle,
          onScreenText: `${s.title} • Parte ${idx + 1}`,
          headlines: [partTitle.slice(0, 48)],
          funnelStage: 'topo',
          viralGoal: 'share',
          status: 'ideia',
          script: '',
          caption: '',
          editingPrompt: '',
          coverImagePrompt: '',
          coverDataUrl: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });
      importedSeriesCount++;
    }
  });

  await persist();
  refreshAllUI();
  showToast(`DNA preenchido com "${prof.name}" + ${importedSeriesCount} séries oficiais importadas!`, 'ok');
}

// ============================================================================
// TAB 2: RADAR DE TEMAS QUENTES (PORTAL GOOGLE NEWS + TIMING)
// ============================================================================

function getPortalCacheKey(catId, subCatId, dateFilter, focusQuery = '') {
  const normSub = catId === 'entretenimento' ? (subCatId || 'todas') : 'all';
  const normQ = catId === 'busca' ? String(focusQuery || '').trim().toLowerCase() : '';
  return `${catId || 'brasil'}::${normSub}::${dateFilter || 'any'}::${normQ}`;
}

function getCurrentPortalArticlesList() {
  const cId = getActiveCreator()?.id;
  const cached = state.hotTopicsCache?.[cId];
  const focusQ = activePortalSearchQuery || cached?.focusQuery || document.getElementById('radarPortalSearchInput')?.value.trim() || document.getElementById('radarQueryInput')?.value.trim() || '';
  const key = getPortalCacheKey(activePortalCategory, activePortalSubCategory, activePortalDateFilter, focusQ);
  if (portalCategoryCache.has(key)) {
    return portalCategoryCache.get(key) || [];
  }
  if (cached && cached.activeCategory === activePortalCategory && (cached.dateFilter || 'any') === activePortalDateFilter) {
    return cached.portalArticles || [];
  }
  return [];
}

function updatePortalSelectionUI() {
  const count = selectedPortalArticleUrls.size;
  const countEl = document.getElementById('radarSelectionCount');
  const clearBtn = document.getElementById('clearSelectedNewsBtn');
  const genBtn = document.getElementById('generateSelectedNewsBtn');
  if (countEl) {
    countEl.textContent = count > 0
      ? `${count} notícia(s) selecionada(s) para gerar conteúdo`
      : 'Selecione notícias abaixo para gerar roteiros extras';
  }
  if (clearBtn) clearBtn.classList.toggle('hidden', count === 0);
  if (genBtn) genBtn.disabled = count === 0;
}

async function loadPortalCategoryArticles() {
  const listEl = document.getElementById('radarPortalList');
  const refreshBtn = document.getElementById('refreshPortalBtn');
  const cId = getActiveCreator()?.id;
  const cached = state.hotTopicsCache?.[cId];
  const focusQ = activePortalCategory === 'busca'
    ? (activePortalSearchQuery || document.getElementById('radarPortalSearchInput')?.value.trim() || cached?.focusQuery || document.getElementById('radarQueryInput').value.trim())
    : '';

  if (listEl) {
    listEl.innerHTML = `<div class="sub-card"><span class="ai-loading-inline"><span class="ai-spinner" aria-hidden="true"></span><span>Carregando notícias reais do Google Notícias...</span></span></div>`;
  }

  try {
    const portal = await runWithStatusTicker(refreshBtn, 'Atualizando...', () =>
      fetchGoogleNewsPortal({
        categoryId: activePortalCategory === 'busca' ? 'brasil' : activePortalCategory,
        subCategoryId: activePortalSubCategory,
        focusQuery: focusQ,
        dateFilter: activePortalDateFilter,
        driveWebhookUrl: getEffectiveDriveWebhook(state, getActiveCreator())
      }),
      { showModelName: false }
    );
    const key = getPortalCacheKey(activePortalCategory, activePortalSubCategory, activePortalDateFilter, focusQ);
    portalCategoryCache.set(key, portal.items || []);
    selectedPortalArticleUrls.clear();
    renderRadarPortal();
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = `<div class="sub-card"><p class="muted-sm" style="color:var(--red);">Não foi possível atualizar esta editoria agora: ${escapeHtml(err.message)}</p></div>`;
    }
  }
}

function wireRadarTab() {
  const topDateSel = document.getElementById('radarDateFilter');
  const portalDateSel = document.getElementById('radarPortalDateFilter');

  topDateSel.addEventListener('change', () => {
    activePortalDateFilter = topDateSel.value || 'any';
    portalDateSel.value = activePortalDateFilter;
  });

  portalDateSel.addEventListener('change', () => {
    activePortalDateFilter = portalDateSel.value || 'any';
    topDateSel.value = activePortalDateFilter;
    loadPortalCategoryArticles();
  });

  document.getElementById('refreshPortalBtn').addEventListener('click', () => {
    loadPortalCategoryArticles();
  });

  const portalSearchInput = document.getElementById('radarPortalSearchInput');
  const clearPortalSearchBtn = document.getElementById('clearPortalSearchBtn');

  const triggerPortalSearch = () => {
    const q = (portalSearchInput?.value || '').trim();
    if (!q) {
      activePortalSearchQuery = '';
      if (clearPortalSearchBtn) clearPortalSearchBtn.classList.add('hidden');
      activePortalCategory = inferCreatorDefaultCategory(getActiveCreator());
      const defaultKey = getPortalCacheKey(activePortalCategory, activePortalSubCategory, activePortalDateFilter, '');
      if (portalCategoryCache.has(defaultKey)) {
        renderRadarPortal();
      } else {
        loadPortalCategoryArticles();
      }
      return;
    }
    activePortalSearchQuery = q;
    activePortalCategory = 'busca';
    if (clearPortalSearchBtn) clearPortalSearchBtn.classList.remove('hidden');
    loadPortalCategoryArticles();
  };

  document.getElementById('radarPortalSearchBtn').addEventListener('click', triggerPortalSearch);
  portalSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerPortalSearch();
    }
  });
  portalSearchInput.addEventListener('input', () => {
    if (!portalSearchInput.value.trim() && activePortalSearchQuery) {
      triggerPortalSearch();
    }
  });
  clearPortalSearchBtn.addEventListener('click', () => {
    portalSearchInput.value = '';
    activePortalSearchQuery = '';
    clearPortalSearchBtn.classList.add('hidden');
    activePortalCategory = inferCreatorDefaultCategory(getActiveCreator());
    const defaultKey = getPortalCacheKey(activePortalCategory, activePortalSubCategory, activePortalDateFilter, '');
    if (portalCategoryCache.has(defaultKey)) {
      renderRadarPortal();
    } else {
      loadPortalCategoryArticles();
    }
  });

  document.getElementById('clearSelectedNewsBtn').addEventListener('click', () => {
    selectedPortalArticleUrls.clear();
    renderRadarPortal();
  });

  document.getElementById('generateSelectedNewsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('generateSelectedNewsBtn');
    const articles = getCurrentPortalArticlesList();
    const chosen = articles.filter((a) => selectedPortalArticleUrls.has(a.link || a.title));
    if (!chosen.length) {
      showToast('Selecione pelo menos uma notícia no portal abaixo.', 'err');
      return;
    }

    try {
      const activeCreator = getActiveCreator();
      const cId = activeCreator.id;
      const existingCache = state.hotTopicsCache[cId] || { topics: [], sources: [], portalArticles: articles };
      const res = await runWithStatusTicker(btn, 'Gerando conteúdos selecionados...', (onStatus) =>
        generateAnglesFromSelectedNews({
          creator: activeCreator,
          articles: chosen,
          focusQuery: activePortalCategory === 'busca' ? (existingCache.focusQuery || '') : '',
          count: chosen.length,
          apiKey: state.settings.geminiKey,
          modelName: state.settings.geminiModel,
          onStatus
        })
      );

      const newSources = res.topics
        .filter((t) => t.sourceUrl)
        .map((t) => ({ title: `${t.trendTitle} (${t.sourceName})`, uri: t.sourceUrl }));
      const mergedSources = [...newSources, ...(existingCache.sources || [])].filter(
        (s, idx, arr) => s.uri && arr.findIndex((x) => x.uri === s.uri) === idx
      );
      const mergedUsed = [...new Set([...(res.usedArticleLinks || []), ...(existingCache.usedArticleLinks || [])])];

      state.hotTopicsCache[cId] = {
        ...existingCache,
        topics: [...res.topics, ...(existingCache.topics || [])],
        sources: mergedSources,
        usedArticleLinks: mergedUsed,
        generatedBy: `Google Notícias (Selecionadas) + ${formatModelDisplayName(res.modelUsed)}`
      };

      selectedPortalArticleUrls.clear();
      await persist();
      renderCachedHotTopics();
      document.getElementById('radarResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast(`${res.topics.length} conteúdo(s) gerado(s) a partir das notícias selecionadas!`, 'ok');
    } catch (err) {
      showToast(`Erro ao gerar das selecionadas: ${err.message}`, 'err');
    }
  });

  document.getElementById('searchTrendsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('searchTrendsBtn');
    const query = document.getElementById('radarQueryInput').value.trim();
    const dateFilter = document.getElementById('radarDateFilter').value || 'any';
    activePortalDateFilter = dateFilter;
    document.getElementById('radarPortalDateFilter').value = dateFilter;

    try {
      const activeCreator = getActiveCreator();
      const result = await runWithStatusTicker(btn, 'Buscando no Google Notícias...', (onStatus) =>
        searchHotTopics({
          creator: activeCreator,
          focusQuery: query,
          categoryId: query ? 'busca' : '',
          subCategoryId: activePortalSubCategory,
          dateFilter,
          apiKey: state.settings.geminiKey,
          modelName: state.settings.geminiModel,
          driveWebhookUrl: getEffectiveDriveWebhook(state, activeCreator),
          onStatus
        })
      );

      const cId = activeCreator.id;
      activePortalSearchQuery = query;
      const portalSearchInput = document.getElementById('radarPortalSearchInput');
      const clearPortalSearchBtn = document.getElementById('clearPortalSearchBtn');
      if (portalSearchInput) portalSearchInput.value = query;
      if (clearPortalSearchBtn) clearPortalSearchBtn.classList.toggle('hidden', !query);

      activePortalCategory = result.activeCategory || (query ? 'busca' : inferCreatorDefaultCategory(activeCreator));
      activePortalSubCategory = result.activeSubCategory || 'todas';
      if (result.portalByCategory && typeof result.portalByCategory === 'object') {
        Object.entries(result.portalByCategory).forEach(([catId, items]) => {
          const catKey = getPortalCacheKey(catId, 'todas', dateFilter, '');
          portalCategoryCache.set(catKey, items || []);
        });
      }
      if (activePortalCategory === 'busca' || !result.portalByCategory) {
        const cacheKey = getPortalCacheKey(activePortalCategory, activePortalSubCategory, dateFilter, query);
        portalCategoryCache.set(cacheKey, result.portalArticles || []);
      }
      selectedPortalArticleUrls.clear();

      state.hotTopicsCache[cId] = result;
      await persist();
      renderCachedHotTopics();
      showToast('Radar atualizado com 5 conteúdos reais do Google Notícias!', 'ok');
    } catch (err) {
      const banner = document.getElementById('radarStatusBanner');
      if (banner) {
        banner.classList.remove('hidden');
        banner.innerHTML = `⚠️ <strong>Erro no Radar:</strong> ${escapeHtml(err.message)}`;
      }
      showToast(`Erro no Radar: ${err.message}`, 'err');
    }
  });

  document.getElementById('radarModeGoogleBtn').addEventListener('click', () => {
    setRadarPortalMode('google');
  });

  document.getElementById('radarModeXBtn').addEventListener('click', () => {
    setRadarPortalMode('x');
  });

  document.getElementById('refreshXTrendsBtn').addEventListener('click', () => {
    loadBrazilXTrends();
  });

  document.getElementById('radarXFilterInput').addEventListener('input', () => {
    renderRadarXTrends();
  });

  document.getElementById('clearSelectedXTrendsBtn').addEventListener('click', () => {
    selectedXTrendIds.clear();
    renderRadarXTrends();
  });

  document.getElementById('generateSelectedXTrendsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('generateSelectedXTrendsBtn');
    const chosen = (xTrendsCache.items || []).filter((it) => selectedXTrendIds.has(it.id));
    if (!chosen.length) {
      showToast('Selecione pelo menos 1 assunto do X Trending Topics abaixo.', 'err');
      return;
    }

    try {
      const activeCreator = getActiveCreator();
      const cId = activeCreator.id;
      const existingCache = state.hotTopicsCache[cId] || { topics: [], sources: [] };
      const res = await runWithStatusTicker(btn, 'Gerando roteiros do X...', (onStatus) =>
        generateAnglesFromXTrends({
          creator: activeCreator,
          trends: chosen,
          apiKey: state.settings.geminiKey,
          modelName: state.settings.geminiModel,
          onStatus
        })
      );

      const newSources = res.topics
        .filter((t) => t.sourceUrl)
        .map((t) => ({ title: `${t.trendTitle} (${t.sourceName})`, uri: t.sourceUrl }));
      const mergedSources = [...newSources, ...(existingCache.sources || [])].filter(
        (s, idx, arr) => s.uri && arr.findIndex((x) => x.uri === s.uri) === idx
      );

      state.hotTopicsCache[cId] = {
        ...existingCache,
        topics: [...res.topics, ...(existingCache.topics || [])],
        sources: mergedSources,
        generatedBy: `𝕏 Trending Topics Brasil (3 dias) + ${formatModelDisplayName(res.modelUsed)}`
      };

      selectedXTrendIds.clear();
      await persist();
      renderCachedHotTopics();
      renderRadarXTrends();
      document.getElementById('radarResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast(`${res.topics.length} roteiro(s) gerado(s) a partir do X Brasil!`, 'ok');
    } catch (err) {
      showToast(`Erro ao gerar do X: ${err.message}`, 'err');
    }
  });
}

function setRadarPortalMode(mode = 'google') {
  activeRadarPortalMode = mode === 'x' ? 'x' : 'google';
  const googleBtn = document.getElementById('radarModeGoogleBtn');
  const xBtn = document.getElementById('radarModeXBtn');
  const googleSection = document.getElementById('radarPortalSection');
  const xSection = document.getElementById('radarXSection');

  if (googleBtn) googleBtn.classList.toggle('active', activeRadarPortalMode === 'google');
  if (xBtn) xBtn.classList.toggle('active', activeRadarPortalMode === 'x');
  if (googleSection) googleSection.classList.toggle('hidden', activeRadarPortalMode !== 'google');
  if (xSection) xSection.classList.toggle('hidden', activeRadarPortalMode !== 'x');

  if (activeRadarPortalMode === 'x') {
    if (!xTrendsCache.items.length) {
      loadBrazilXTrends();
    } else {
      renderRadarXTrends();
    }
  }
}

function updateXSelectionUI() {
  const count = selectedXTrendIds.size;
  const countEl = document.getElementById('radarXSelectionCount');
  const clearBtn = document.getElementById('clearSelectedXTrendsBtn');
  const genBtn = document.getElementById('generateSelectedXTrendsBtn');
  if (countEl) {
    countEl.textContent = count > 0
      ? `${count} assunto(s) do X selecionado(s) para gerar conteúdo`
      : 'Selecione assuntos do X abaixo para gerar roteiros';
  }
  if (clearBtn) clearBtn.classList.toggle('hidden', count === 0);
  if (genBtn) genBtn.disabled = count === 0;
}

async function loadBrazilXTrends() {
  const listEl = document.getElementById('radarXTrendsList');
  const btn = document.getElementById('refreshXTrendsBtn');
  if (listEl) {
    listEl.innerHTML = `<div class="sub-card"><span class="ai-loading-inline"><span class="ai-spinner" aria-hidden="true"></span><span>Buscando Trending Topics reais do X Brasil (últimos 3 dias)...</span></span></div>`;
  }

  try {
    const result = await runWithStatusTicker(
      btn,
      'Atualizando X...',
      () => fetchBrazilXTrends({
        driveWebhookUrl: getEffectiveDriveWebhook(state, getActiveCreator())
      }),
      { showModelName: false }
    );
    xTrendsCache = result;
    selectedXTrendIds.clear();
    renderRadarXTrends();
  } catch (err) {
    if (listEl) {
      listEl.innerHTML = `<div class="sub-card"><p class="muted-sm" style="color:var(--red);">${escapeHtml(err.message)}</p></div>`;
    }
    updateXSelectionUI();
  }
}

function renderRadarXTrends() {
  const dayTabsEl = document.getElementById('radarXDayTabs');
  const metaEl = document.getElementById('radarXMetaInfo');
  const listEl = document.getElementById('radarXTrendsList');
  const filterQ = (document.getElementById('radarXFilterInput')?.value || '').trim().toLowerCase();
  if (!dayTabsEl || !listEl) return;

  const allItems = Array.isArray(xTrendsCache.items) ? xTrendsCache.items : [];

  dayTabsEl.innerHTML = X_TREND_DAY_FILTERS.map((df) => {
    const count = df.id === 'all' ? allItems.length : allItems.filter((it) => it.dayKey === df.id).length;
    return `
      <button type="button" class="portal-tab-btn x-day-tab-btn ${activeXDayFilter === df.id ? 'active' : ''}" data-day="${escapeHtml(df.id)}">
        ${escapeHtml(df.label)}${allItems.length ? ` (${count})` : ''}
      </button>
    `;
  }).join('');

  dayTabsEl.querySelectorAll('.x-day-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeXDayFilter = btn.dataset.day || 'all';
      renderRadarXTrends();
    });
  });

  if (metaEl) {
    metaEl.textContent = allItems.length
      ? `📡 Fonte: ${xTrendsCache.fetchedFrom || 'X Brasil'} • Atualizado em ${formatTrendDate(xTrendsCache.fetchedAt)}`
      : 'Clique em "🔄 Atualizar X Trends" para carregar os assuntos em alta no X Brasil nos últimos 3 dias.';
  }

  const filtered = allItems.filter((it) => {
    if (activeXDayFilter !== 'all' && it.dayKey !== activeXDayFilter) return false;
    if (filterQ && !`${it.topic} ${it.sourceName}`.toLowerCase().includes(filterQ)) return false;
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="sub-card">
        <p class="muted-sm">${allItems.length ? 'Nenhum assunto do X corresponde a este filtro.' : 'Nenhum Trending Topic carregado ainda. Clique em 🔄 Atualizar X Trends acima.'}</p>
      </div>`;
    updateXSelectionUI();
    return;
  }

  listEl.innerHTML = filtered.map((it) => {
    const isSelected = selectedXTrendIds.has(it.id);
    const openUrl = it.xSearchUrl || it.sourceUrl || '#';
    return `
      <div class="portal-news-card ${isSelected ? 'selected' : ''}" data-x-id="${escapeHtml(it.id)}">
        <div>
          <div class="portal-news-top">
            <label class="portal-check-wrap">
              <input type="checkbox" class="x-trend-check" data-x-id="${escapeHtml(it.id)}" ${isSelected ? 'checked' : ''} />
              <span>Selecionar</span>
            </label>
            <div class="inline-controls">
              <span class="x-trend-rank">#${Number(it.rank || 1)}</span>
              <span class="badge-pill">${escapeHtml(it.dayLabel || '3 dias')}</span>
            </div>
          </div>
          <div class="x-trend-topic mt-8">${escapeHtml(it.topic)}</div>
          ${it.volume ? `<div class="x-trend-volume mt-6">🔥 ${escapeHtml(it.volume)}</div>` : ''}
        </div>
        <div class="portal-news-footer">
          <span>𝕏 ${escapeHtml(it.sourceName || 'X Brasil')}</span>
          <a class="btn btn-secondary btn-xs" href="${escapeHtml(openUrl)}" target="_blank" rel="noopener noreferrer">↗ Ver no X</a>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.x-trend-check').forEach((chk) => {
    chk.addEventListener('change', () => {
      const id = chk.dataset.xId;
      if (chk.checked) selectedXTrendIds.add(id);
      else selectedXTrendIds.delete(id);
      chk.closest('.portal-news-card')?.classList.toggle('selected', chk.checked);
      updateXSelectionUI();
    });
  });

  updateXSelectionUI();
}

function renderRadarPortal() {
  const cId = getActiveCreator()?.id;
  const cached = state.hotTopicsCache?.[cId];
  const tabsEl = document.getElementById('radarCategoryTabs');
  const subBarEl = document.getElementById('radarSubCategoryBar');
  const listEl = document.getElementById('radarPortalList');
  const dateSel = document.getElementById('radarPortalDateFilter');
  if (!tabsEl || !subBarEl || !listEl) return;

  if (dateSel && dateSel.value !== activePortalDateFilter) {
    dateSel.value = activePortalDateFilter;
  }

  const portalSearchInput = document.getElementById('radarPortalSearchInput');
  const clearPortalSearchBtn = document.getElementById('clearPortalSearchBtn');
  const effectiveSearchQ = activePortalSearchQuery || cached?.focusQuery || '';
  if (portalSearchInput && portalSearchInput.value !== effectiveSearchQ && effectiveSearchQ) {
    portalSearchInput.value = effectiveSearchQ;
  }
  if (clearPortalSearchBtn) {
    clearPortalSearchBtn.classList.toggle('hidden', !(portalSearchInput?.value.trim() || effectiveSearchQ));
  }

  const tabs = [...GOOGLE_NEWS_CATEGORIES];
  if (effectiveSearchQ) {
    tabs.unshift({ id: 'busca', label: `🔍 Busca: ${effectiveSearchQ}` });
  } else if (activePortalCategory === 'busca') {
    activePortalCategory = inferCreatorDefaultCategory(getActiveCreator());
  }

  tabsEl.innerHTML = tabs.map((cat) => `
    <button type="button" class="portal-tab-btn ${activePortalCategory === cat.id ? 'active' : ''}" data-cat="${escapeHtml(cat.id)}">
      ${escapeHtml(cat.label)}
    </button>
  `).join('');

  tabsEl.querySelectorAll('.portal-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activePortalCategory = btn.dataset.cat;
      if (activePortalCategory !== 'entretenimento') {
        activePortalSubCategory = 'todas';
      }
      const focusQ = activePortalCategory === 'busca' ? effectiveSearchQ : '';
      const cacheKey = getPortalCacheKey(activePortalCategory, activePortalSubCategory, activePortalDateFilter, focusQ);
      if (portalCategoryCache.has(cacheKey)) {
        selectedPortalArticleUrls.clear();
        renderRadarPortal();
      } else {
        loadPortalCategoryArticles();
      }
    });
  });

  const entCat = GOOGLE_NEWS_CATEGORIES.find((c) => c.id === 'entretenimento');
  if (activePortalCategory === 'entretenimento' && entCat?.subcategories?.length) {
    subBarEl.classList.remove('hidden');
    subBarEl.innerHTML = entCat.subcategories.map((sub) => `
      <button type="button" class="portal-subtab-btn ${activePortalSubCategory === sub.id ? 'active' : ''}" data-sub="${escapeHtml(sub.id)}">
        ${escapeHtml(sub.label)}
      </button>
    `).join('');

    subBarEl.querySelectorAll('.portal-subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activePortalSubCategory = btn.dataset.sub;
        const cacheKey = getPortalCacheKey('entretenimento', activePortalSubCategory, activePortalDateFilter, '');
        if (portalCategoryCache.has(cacheKey)) {
          selectedPortalArticleUrls.clear();
          renderRadarPortal();
        } else {
          loadPortalCategoryArticles();
        }
      });
    });
  } else {
    subBarEl.classList.add('hidden');
    subBarEl.innerHTML = '';
  }

  const articles = getCurrentPortalArticlesList();
  const usedSet = new Set(cached?.usedArticleLinks || []);

  if (!articles.length) {
    listEl.innerHTML = `
      <div class="sub-card">
        <p class="muted-sm">Nenhuma notícia carregada nesta editoria/período ainda. Clique em <strong>🔄 Atualizar Categoria</strong> acima ou faça uma busca principal.</p>
      </div>`;
    updatePortalSelectionUI();
    return;
  }

  listEl.innerHTML = articles.map((art) => {
    const key = art.link || art.title;
    const isSelected = selectedPortalArticleUrls.has(key);
    const isAlreadyUsed = art.link && usedSet.has(art.link);
    const dateLabel = art.publishedAt || formatTrendDate(art.pubDate);

    return `
      <div class="portal-news-card ${isSelected ? 'selected' : ''}" data-key="${escapeHtml(key)}">
        <div>
          <div class="portal-news-top">
            <label class="portal-check-wrap">
              <input type="checkbox" class="portal-news-check" data-key="${escapeHtml(key)}" ${isSelected ? 'checked' : ''} />
              <span>Selecionar</span>
            </label>
            <div class="inline-controls">
              ${isAlreadyUsed ? `<span class="badge-pill">✓ Nos roteiros</span>` : ''}
              <span class="badge-pill">${escapeHtml(art.sourceName || 'Google Notícias')}</span>
            </div>
          </div>
          <div class="portal-news-title mt-8">${escapeHtml(art.title)}</div>
          ${art.summary ? `<p class="muted-xs mt-6">${escapeHtml(art.summary)}</p>` : ''}
        </div>
        <div class="portal-news-footer">
          <span>🕒 ${escapeHtml(dateLabel)}</span>
          ${art.link ? `<a class="btn btn-secondary btn-xs" href="${escapeHtml(art.link)}" target="_blank" rel="noopener noreferrer">↗ Abrir notícia</a>` : ''}
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.portal-news-check').forEach((chk) => {
    chk.addEventListener('change', () => {
      const k = chk.dataset.key;
      if (chk.checked) {
        selectedPortalArticleUrls.add(k);
      } else {
        selectedPortalArticleUrls.delete(k);
      }
      chk.closest('.portal-news-card')?.classList.toggle('selected', chk.checked);
      updatePortalSelectionUI();
    });
  });

  updatePortalSelectionUI();
}

function renderCachedHotTopics() {
  const cId = getActiveCreator()?.id;
  const cached = state.hotTopicsCache?.[cId];
  const container = document.getElementById('radarResults');
  const banner = document.getElementById('radarStatusBanner');
  const sourcesBox = document.getElementById('radarSources');

  if (cached) {
    activePortalCategory = cached.activeCategory || inferCreatorDefaultCategory(getActiveCreator());
    activePortalSubCategory = cached.activeSubCategory || 'todas';
    activePortalDateFilter = cached.dateFilter || 'any';
    const topDateSel = document.getElementById('radarDateFilter');
    if (topDateSel) topDateSel.value = activePortalDateFilter;
    if (cached.portalByCategory && typeof cached.portalByCategory === 'object') {
      Object.entries(cached.portalByCategory).forEach(([catId, items]) => {
        const catKey = getPortalCacheKey(catId, 'todas', activePortalDateFilter, '');
        if (!portalCategoryCache.has(catKey)) {
          portalCategoryCache.set(catKey, items || []);
        }
      });
    }
    if (Array.isArray(cached.portalArticles)) {
      const key = getPortalCacheKey(activePortalCategory, activePortalSubCategory, activePortalDateFilter, cached.focusQuery || '');
      if (!portalCategoryCache.has(key)) {
        portalCategoryCache.set(key, cached.portalArticles);
      }
    }
  } else {
    activePortalCategory = inferCreatorDefaultCategory(getActiveCreator());
  }

  if (!cached || !cached.topics?.length) {
    banner.classList.add('hidden');
    sourcesBox.classList.add('hidden');
    container.innerHTML = `
      <div class="card">
        <h3>Pronto para caçar notícias reais 🔥</h3>
        <p class="muted-sm mt-6">Clique no botão acima para carregar as manchetes reais do Google Notícias, gerar 5 conteúdos conectados ao DNA de <strong>${escapeHtml(getActiveCreator()?.name)}</strong> e explorar todas as editorias abaixo.</p>
      </div>`;
    renderRadarPortal();
    return;
  }

  banner.classList.remove('hidden');
  banner.innerHTML = `📡 <strong>Fonte:</strong> ${escapeHtml(cached.generatedBy || 'Google Notícias')} — Clique em <em>"Criar na Fábrica"</em> em qualquer ângulo abaixo para gerar roteiro, capa e legenda prontos.`;

  container.innerHTML = cached.topics.map((topic, tIdx) => {
    const hasMeta = Boolean(topic.sourceName || topic.publishedAt || topic.sourceUrl);
    const metaHtml = hasMeta ? `
      <div class="trend-source-row">
        <span>📰 <strong>${escapeHtml(topic.sourceName || 'Google Notícias')}</strong>${topic.publishedAt ? ` • 🕒 ${escapeHtml(topic.publishedAt)}` : ''}</span>
        ${topic.sourceUrl ? `<a class="btn btn-secondary btn-xs" href="${escapeHtml(topic.sourceUrl)}" target="_blank" rel="noopener noreferrer">↗ Abrir notícia</a>` : ''}
      </div>` : '';
    return `
    <div class="card trend-card">
      <div>
        <div class="inline-controls">
          <span class="badge-pill">TIMING QUENTE #${tIdx + 1}</span>
          ${topic.categoryLabel ? `<span class="badge-pill">${escapeHtml(topic.categoryLabel)}</span>` : ''}
        </div>
        <h3 class="mt-8">${escapeHtml(topic.trendTitle)}</h3>
        <p class="muted-sm mt-6">${escapeHtml(topic.timingWhy)}</p>
        ${metaHtml}
        <div class="rule-hint mt-8">🎯 <strong>Ponte para sua bolha:</strong> ${escapeHtml(topic.bubbleBridge)}</div>
      </div>
      <div>
        ${(topic.angles || []).map((ang) => {
          const funnelTag = ang.funnel === 'fundo' ? 'tag-fundo' : ang.funnel === 'meio' ? 'tag-meio' : 'tag-topo';
          const funnelLabel = ang.funnel === 'fundo' ? 'FUNDO (Venda)' : ang.funnel === 'meio' ? 'MEIO (Conexão)' : 'TOPO (Alcance <30s)';
          const resolvedModelId = detectBestSeriesModelId({
            title: ang.title || '',
            funnel: ang.funnel || '',
            suggestedModelId: ang.modelId || '',
            bridge: topic.bubbleBridge || ''
          });
          const resolvedModelObj = SERIES_MODELS.find((m) => m.id === resolvedModelId);
          return `
            <div class="angle-item">
              <span class="angle-tag ${funnelTag}">${funnelLabel}${resolvedModelObj ? ` • ${escapeHtml(resolvedModelObj.code)}` : ''}</span>
              <div class="angle-title">${escapeHtml(ang.title)}</div>
              <button class="btn btn-secondary btn-sm mt-6 use-trend-btn"
                data-title="${escapeHtml(ang.title)}"
                data-model="${escapeHtml(resolvedModelId)}"
                data-funnel="${escapeHtml(ang.funnel || 'topo')}"
                data-bridge="${escapeHtml(topic.bubbleBridge || '')}"
                data-news-url="${escapeHtml(topic.sourceUrl || '')}"
                data-news-title="${escapeHtml(topic.trendTitle || '')}"
                data-news-source="${escapeHtml(topic.sourceName || '')}"
                data-news-date="${escapeHtml(topic.publishedAt || '')}"
                data-news-summary="${escapeHtml(topic.timingWhy || '')}">
                🎬 Criar na Fábrica
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
  }).join('');

  container.querySelectorAll('.use-trend-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearFactoryFields({ keepSeriesFree: true });
      setFactorySourceNews({
        url: btn.dataset.newsUrl || '',
        title: btn.dataset.newsTitle || '',
        sourceName: btn.dataset.newsSource || '',
        publishedAt: btn.dataset.newsDate || '',
        summary: btn.dataset.newsSummary || ''
      });
      const bestModelId = detectBestSeriesModelId({
        title: btn.dataset.title || '',
        funnel: btn.dataset.funnel || '',
        suggestedModelId: btn.dataset.model || '',
        bridge: btn.dataset.bridge || ''
      });
      const bestModelObj = SERIES_MODELS.find((m) => m.id === bestModelId);
      document.getElementById('f_modelSelect').value = bestModelId;
      document.getElementById('f_funnelStage').value = btn.dataset.funnel;
      document.getElementById('f_topic').value = btn.dataset.title;
      document.getElementById('f_qProblem').value = btn.dataset.bridge;
      updateModelRuleHint();
      switchTab('tab-factory');
      showToast(`Notícia anexada com modelo ${bestModelObj?.code || bestModelId}! Gere sem pasta ou escolha no Passo 1.`, 'ok');
    });
  });

  if (cached.sources && cached.sources.length) {
    sourcesBox.classList.remove('hidden');
    sourcesBox.innerHTML = `<strong>🔗 Notícias oficiais usadas do Google Notícias:</strong> ` +
      cached.sources.slice(0, 8).map((s) => `<a href="${escapeHtml(s.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || s.uri)}</a>`).join(' • ');
  } else {
    sourcesBox.classList.add('hidden');
  }

  renderRadarPortal();
}

// ============================================================================
// TAB 3: FÁBRICA DE SÉRIES & ROTEIROS + ESTÚDIO DE CAPA 9:16
// ============================================================================

function renderFactoryContextBar() {
  const c = getActiveCreator();
  if (!c) return;
  const nameEl = document.getElementById('factoryCreatorContextName');
  const nicheEl = document.getElementById('factoryCreatorContextNiche');
  if (nameEl) nameEl.textContent = `${c.name} (${c.handle || '@perfil'})`;
  if (nicheEl) nicheEl.textContent = c.niche ? `• ${c.niche}` : '• Clique em Preencher Rápido para configurar o nicho';
}

function renderSeriesPartsStrip() {
  const strip = document.getElementById('seriesPartsStrip');
  const seriesId = document.getElementById('f_seriesSelect').value;
  if (!strip) return;
  if (!seriesId) {
    strip.innerHTML = '';
    return;
  }

  const eps = state.episodes
    .filter((ep) => ep.seriesId === seriesId)
    .sort((a, b) => (Number(a.partNumber) || 0) - (Number(b.partNumber) || 0));

  const nextPart = eps.reduce((m, e) => Math.max(m, Number(e.partNumber) || 0), 0) + 1;

  strip.innerHTML = eps.map((ep) => {
    const isActive = ep.id === currentEditingEpisodeId;
    const hasScript = Boolean((ep.script || '').trim());
    return `
      <button type="button" class="part-pill ${isActive ? 'active' : ''} ${hasScript ? 'has-script' : ''}" data-ep-id="${ep.id}" title="${escapeHtml(ep.title)}">
        Parte ${ep.partNumber}
      </button>
    `;
  }).join('') + `
    <button type="button" class="part-pill ${!currentEditingEpisodeId ? 'active' : ''}" id="stripNewPartBtn">
      + Parte ${nextPart}
    </button>
  `;

  strip.querySelectorAll('[data-ep-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ep = state.episodes.find((item) => item.id === btn.dataset.epId);
      if (ep) loadEpisodeIntoFactory(ep);
    });
  });

  const newPartBtn = document.getElementById('stripNewPartBtn');
  if (newPartBtn) {
    newPartBtn.addEventListener('click', () => {
      clearFactoryFields();
    });
  }
}

function renderQuickFillFactory() {
  const creator = getActiveCreator();
  const chipsEl = document.getElementById('qfCreatorChips');
  const profSel = document.getElementById('qfProfSelect');

  if (chipsEl && creator) {
    const items = [];
    parseCreatorFieldItems(creator.pains, 'pain').forEach((line) =>
      items.push({ kind: 'pain', label: 'Dor', text: line, modelId: 'serie_03', funnel: 'topo' })
    );
    parseCreatorFieldItems(creator.desires, 'desire').forEach((line) =>
      items.push({ kind: 'desire', label: 'Desejo', text: line, modelId: 'serie_05', funnel: 'fundo' })
    );
    parseCreatorFieldItems(creator.objections, 'objection').forEach((line) =>
      items.push({ kind: 'objection', label: 'Objeção', text: line, modelId: 'codigo_viral', funnel: 'fundo' })
    );

    if (!items.length) {
      chipsEl.innerHTML = `<div class="muted-xs">Escreva uma dor ou desejo personalizado abaixo para salvar e usar na hora.</div>`;
    } else {
      chipsEl.innerHTML = items.map((it) => `
        <div class="qf-chip-row">
          <button type="button" class="qf-chip" data-kind="${it.kind}" data-text="${escapeHtml(it.text)}" data-model="${it.modelId}" data-funnel="${it.funnel}">
            <span class="qf-chip-tag">${escapeHtml(it.label)}</span>${escapeHtml(it.text)}
          </button>
          <button type="button" class="qf-chip-del" data-kind="${it.kind}" data-text="${escapeHtml(it.text)}" title="Remover item">×</button>
        </div>
      `).join('');

      chipsEl.querySelectorAll('.qf-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          applyQuickFillChoiceToFactory(btn.dataset.kind, btn.dataset.text, btn.dataset.model, btn.dataset.funnel);
          showToast('Tema do Criador Ativo preenchido na Fábrica!', 'ok');
        });
      });

      chipsEl.querySelectorAll('.qf-chip-del').forEach((delBtn) => {
        delBtn.addEventListener('click', async () => {
          const active = getActiveCreator();
          if (removeCreatorFieldItem(active, delBtn.dataset.kind, delBtn.dataset.text)) {
            await persist();
            loadCreatorIntoForm();
            renderQuickFillFactory();
            showToast('Item removido deste perfil.', 'ok');
          }
        });
      });
    }
  }

  if (profSel) {
    if (creator?.professionId) {
      profSel.value = creator.professionId;
    }
    renderQuickFillProfIdeas(profSel.value);
  }
}

function applyQuickFillChoiceToFactory(kind, text, modelId, funnelStage) {
  document.getElementById('f_topic').value = text;
  document.getElementById('f_modelSelect').value = modelId;
  document.getElementById('f_funnelStage').value = funnelStage;
  if (kind === 'desire') {
    document.getElementById('f_qLifeChange').value = text;
  } else {
    document.getElementById('f_qProblem').value = text;
  }
  updateModelRuleHint();
}

async function handleAddCustomQuickFill() {
  const inputEl = document.getElementById('qfCustomInput');
  const typeEl = document.getElementById('qfCustomType');
  const text = (inputEl?.value || '').trim();
  const kind = typeEl?.value || 'pain';

  if (!text) {
    showToast('Escreva uma dor, desejo ou objeção antes de adicionar.', 'err');
    inputEl?.focus();
    return;
  }

  const preset = kind === 'desire'
    ? { modelId: 'serie_05', funnel: 'fundo' }
    : kind === 'objection'
    ? { modelId: 'codigo_viral', funnel: 'fundo' }
    : { modelId: 'serie_03', funnel: 'topo' };

  const active = getActiveCreator();
  addCreatorFieldItem(active, kind, text);
  applyQuickFillChoiceToFactory(kind, text, preset.modelId, preset.funnel);

  inputEl.value = '';
  await persist();
  loadCreatorIntoForm();
  renderQuickFillFactory();
  showToast('Item personalizado salvo no perfil e aplicado no roteiro!', 'ok');
}

function renderQuickFillProfIdeas(profId) {
  const box = document.getElementById('qfProfIdeas');
  const prof = PROFESSIONS.find((p) => p.id === profId) || PROFESSIONS[0];
  if (!box || !prof) return;

  const list = [];
  prof.series.forEach((s) => {
    (s.parts || []).forEach((pt, idx) => {
      list.push({ modelId: s.modelId, seriesTitle: s.title, partNumber: idx + 1, title: pt });
    });
  });

  box.innerHTML = list.map((item) => `
    <button type="button" class="qf-chip"
      data-topic="${escapeHtml(item.title)}"
      data-model="${item.modelId}"
      data-part="${item.partNumber}"
      data-series="${escapeHtml(item.seriesTitle)}">
      <span class="qf-chip-tag">P.${item.partNumber}</span>${escapeHtml(item.title)}
    </button>
  `).join('');

  box.querySelectorAll('.qf-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bestModelId = detectBestSeriesModelId({
        title: btn.dataset.topic || '',
        suggestedModelId: btn.dataset.model || ''
      });
      document.getElementById('f_topic').value = btn.dataset.topic;
      document.getElementById('f_modelSelect').value = bestModelId;
      document.getElementById('f_partNumber').value = btn.dataset.part;
      // Match existing series folder if imported
      const matchingSerie = getCreatorSeries().find((s) => s.name === btn.dataset.series);
      if (matchingSerie) {
        document.getElementById('f_seriesSelect').value = matchingSerie.id;
        document.getElementById('cov_seriesLabel').value = matchingSerie.name;
      }
      updateModelRuleHint();
      renderSeriesPartsStrip();
      showToast('Ideia da profissão preenchida!', 'ok');
    });
  });
}

function renderFactorySeriesSelect({ preserveSelection = true } = {}) {
  const sel = document.getElementById('f_seriesSelect');
  const prevVal = preserveSelection ? sel.value : '';
  const series = getCreatorSeries();

  sel.innerHTML = `<option value="">— Sem pasta definida (Roteiro avulso) —</option>` +
    series.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

  if (prevVal && series.some((s) => s.id === prevVal)) {
    sel.value = prevVal;
  }
}

function setFactorySourceNews(newsObj = null) {
  const urlInput = document.getElementById('f_sourceNewsUrl');
  const openLink = document.getElementById('f_sourceNewsOpenLink');
  const clearBtn = document.getElementById('clearSourceNewsBtn');
  const preview = document.getElementById('f_sourceNewsPreview');

  const url = String(newsObj?.url || '').trim();
  if (newsObj && (url || newsObj.title)) {
    currentAttachedNews = {
      url,
      title: String(newsObj.title || '').trim(),
      sourceName: String(newsObj.sourceName || '').trim(),
      publishedAt: String(newsObj.publishedAt || '').trim(),
      summary: String(newsObj.summary || '').trim()
    };
  } else {
    currentAttachedNews = null;
  }

  if (urlInput) urlInput.value = url;
  if (openLink) {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      openLink.href = url;
      openLink.classList.remove('hidden');
    } else {
      openLink.href = '#';
      openLink.classList.add('hidden');
    }
  }
  if (clearBtn) {
    clearBtn.classList.toggle('hidden', !(currentAttachedNews || url));
  }
  if (preview) {
    if (currentAttachedNews?.title) {
      const metaParts = [currentAttachedNews.sourceName, currentAttachedNews.publishedAt].filter(Boolean).join(' • ');
      preview.innerHTML = `📌 <strong>${escapeHtml(currentAttachedNews.title)}</strong>${metaParts ? ` <span class="muted-xs">(${escapeHtml(metaParts)})</span>` : ''}`;
      preview.classList.remove('hidden');
    } else {
      preview.innerHTML = '';
      preview.classList.add('hidden');
    }
  }
}

function getFactorySourceNews() {
  const typedUrl = document.getElementById('f_sourceNewsUrl')?.value.trim() || '';
  if (!typedUrl && !currentAttachedNews?.title) return null;
  return {
    url: typedUrl || currentAttachedNews?.url || '',
    title: currentAttachedNews?.title || '',
    sourceName: currentAttachedNews?.sourceName || '',
    publishedAt: currentAttachedNews?.publishedAt || '',
    summary: currentAttachedNews?.summary || ''
  };
}

function updateModelRuleHint() {
  const modelId = document.getElementById('f_modelSelect').value;
  const m = SERIES_MODELS.find((item) => item.id === modelId) || SERIES_MODELS[0];
  document.getElementById('modelRuleHint').innerHTML = `
    <strong>${escapeHtml(m.code)} (${escapeHtml(m.trigger)}):</strong> ${escapeHtml(m.nameRule)}<br/>
    <span class="muted-xs">Fluxo: ${escapeHtml(m.structureFlow)}</span>
  `;
}

function wireFactoryTab() {
  document.getElementById('factoryEditDnaBtn').addEventListener('click', () => {
    switchTab('tab-creator');
  });

  document.getElementById('factoryQuickFillDnaBtn').addEventListener('click', async () => {
    await handleQuickFillActiveCreator();
  });

  // Segmented Quick Fill mode toggle (Active Creator DNA vs 33 Professions)
  const modeCreatorBtn = document.getElementById('qfModeCreatorBtn');
  const modeProfBtn = document.getElementById('qfModeProfBtn');
  const creatorPanel = document.getElementById('qfCreatorPanel');
  const profPanel = document.getElementById('qfProfPanel');

  modeCreatorBtn.addEventListener('click', () => {
    modeCreatorBtn.classList.add('active');
    modeProfBtn.classList.remove('active');
    creatorPanel.classList.remove('hidden');
    profPanel.classList.add('hidden');
  });

  modeProfBtn.addEventListener('click', () => {
    modeProfBtn.classList.add('active');
    modeCreatorBtn.classList.remove('active');
    profPanel.classList.remove('hidden');
    creatorPanel.classList.add('hidden');
  });

  document.getElementById('qfProfSelect').addEventListener('change', (e) => {
    renderQuickFillProfIdeas(e.target.value);
  });

  document.getElementById('qfAddCustomBtn').addEventListener('click', handleAddCustomQuickFill);
  document.getElementById('qfCustomInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddCustomQuickFill();
    }
  });

  document.getElementById('qfFillFromCreatorBtn').addEventListener('click', () => {
    const creator = getActiveCreator();
    if (!creator) return;
    // Prefer a pending idea episode of active creator, else cycle pains/desires
    const pendingEp = getCreatorEpisodes().find((ep) => !(ep.script || '').trim());
    if (pendingEp) {
      loadEpisodeIntoFactory(pendingEp);
      showToast(`Ideia pendente carregada: "${pendingEp.title.slice(0, 40)}..."`, 'ok');
      return;
    }

    const firstPain = String(creator.pains || '')
      .split('\n')
      .map((l) => l.replace(/^\d+[\.\)\-\s]+/, '').trim())
      .filter(Boolean)[0];
    const firstDesire = String(creator.desires || '')
      .split('\n')
      .map((l) => l.replace(/^\d+[\.\)\-\s]+/, '').trim())
      .filter(Boolean)[0];

    document.getElementById('f_topic').value = firstPain || creator.positioning || `Dica prática de ${creator.niche || 'seu nicho'}`;
    document.getElementById('f_qProblem').value = firstPain || creator.positioning || '';
    document.getElementById('f_qLearn').value = creator.product ? `Um ajuste simples antes de buscar ${creator.product}` : 'Uma orientação prática e imediata';
    document.getElementById('f_qLifeChange').value = firstDesire || 'Mais resultado sem complicação';
    showToast('Dor, contexto e 3 perguntas preenchidos com o Criador Ativo!', 'ok');
  });

  document.getElementById('f_modelSelect').addEventListener('change', updateModelRuleHint);

  document.getElementById('f_partNumber').addEventListener('input', (e) => {
    e.target.dataset.manual = e.target.value.trim() ? '1' : '';
    updateCoverPreview();
  });

  document.getElementById('f_sourceNewsUrl').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    const openLink = document.getElementById('f_sourceNewsOpenLink');
    const clearBtn = document.getElementById('clearSourceNewsBtn');
    if (openLink) {
      if (val.startsWith('http://') || val.startsWith('https://')) {
        openLink.href = val;
        openLink.classList.remove('hidden');
      } else {
        openLink.href = '#';
        openLink.classList.add('hidden');
      }
    }
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', !(val || currentAttachedNews?.title));
    }
  });

  document.getElementById('clearSourceNewsBtn').addEventListener('click', () => {
    setFactorySourceNews(null);
    showToast('Notícia de referência removida.', 'ok');
  });

  document.getElementById('f_seriesSelect').addEventListener('change', (e) => {
    document.getElementById('trendSeriesNotice')?.classList.add('hidden');
    const serie = state.series.find((s) => s.id === e.target.value);
    const partEl = document.getElementById('f_partNumber');
    if (serie) {
      currentEditingEpisodeId = null;
      document.getElementById('f_modelSelect').value = serie.modelId || 'serie_01';
      updateModelRuleHint();
      const eps = state.episodes.filter((ep) => ep.seriesId === serie.id);
      const maxPart = eps.reduce((max, ep) => Math.max(max, Number(ep.partNumber) || 0), 0);
      if (partEl.dataset.manual !== '1' || !partEl.value.trim()) {
        partEl.value = maxPart + 1;
      }
      document.getElementById('cov_seriesLabel').value = serie.name;
      renderSeriesPartsStrip();
      updateCoverPreview();
    } else {
      partEl.value = '';
      partEl.dataset.manual = '';
      document.getElementById('cov_seriesLabel').value = '';
      renderSeriesPartsStrip();
      updateCoverPreview();
    }
  });

  // Quick New Series Folder
  document.getElementById('quickNewSeriesBtn').addEventListener('click', () => {
    document.getElementById('newSeriesBox').classList.toggle('hidden');
  });
  document.getElementById('cancelNewSeriesBtn').addEventListener('click', () => {
    document.getElementById('newSeriesBox').classList.add('hidden');
  });
  document.getElementById('confirmNewSeriesBtn').addEventListener('click', async () => {
    const name = document.getElementById('ns_name').value.trim();
    const modelId = document.getElementById('ns_model').value;
    if (!name) {
      showToast('Digite um nome para a nova série.', 'err');
      return;
    }
    const newId = uid('serie');
    state.series.push({
      id: newId,
      creatorId: getActiveCreator().id,
      name,
      modelId,
      description: '',
      color: getActiveCreator().brandColor || '#8B5CF6',
      createdAt: new Date().toISOString()
    });
    await persist();
    renderFactorySeriesSelect({ preserveSelection: false });
    document.getElementById('f_seriesSelect').value = newId;
    document.getElementById('f_modelSelect').value = modelId;
    document.getElementById('trendSeriesNotice')?.classList.add('hidden');
    const partEl = document.getElementById('f_partNumber');
    if (partEl.dataset.manual !== '1' || !partEl.value.trim()) {
      partEl.value = 1;
    }
    document.getElementById('cov_seriesLabel').value = name;
    document.getElementById('ns_name').value = '';
    document.getElementById('newSeriesBox').classList.add('hidden');
    updateModelRuleHint();
    renderSeriesPartsStrip();
    renderSeriesFolders();
    updateCoverPreview();
    showToast(`Pasta "${name}" criada!`, 'ok');
  });

  // Suggest 5 Part ideas
  document.getElementById('suggestIdeasBtn').addEventListener('click', async () => {
    const btn = document.getElementById('suggestIdeasBtn');
    const box = document.getElementById('ideasSuggestionBox');
    try {
      const seriesId = document.getElementById('f_seriesSelect').value;
      const serie = state.series.find((s) => s.id === seriesId);
      const existingTitles = state.episodes.filter((e) => e.seriesId === seriesId).map((e) => e.title);
      const res = await runWithStatusTicker(btn, 'Gerando ideias...', (onStatus) =>
        generateSeriesIdeas({
          creator: getActiveCreator(),
          modelId: document.getElementById('f_modelSelect').value,
          seriesName: serie?.name || 'Minha Série',
          existingTitles,
          apiKey: state.settings.geminiKey,
          modelName: state.settings.geminiModel,
          onStatus
        })
      );

      box.classList.remove('hidden');
      box.innerHTML = `<div class="muted-xs">Clique em uma ideia para preencher automaticamente:</div>` +
        (res.ideas || []).map((idea) => `
          <button class="idea-pick"
            data-topic="${escapeHtml(idea.topic)}"
            data-p="${escapeHtml(idea.problem)}"
            data-l="${escapeHtml(idea.learn)}"
            data-c="${escapeHtml(idea.lifeChange)}">
            <strong>💡 ${escapeHtml(idea.topic)}</strong>
          </button>
        `).join('');

      box.querySelectorAll('.idea-pick').forEach((pBtn) => {
        pBtn.addEventListener('click', () => {
          document.getElementById('f_topic').value = pBtn.dataset.topic;
          document.getElementById('f_qProblem').value = pBtn.dataset.p;
          document.getElementById('f_qLearn').value = pBtn.dataset.l;
          document.getElementById('f_qLifeChange').value = pBtn.dataset.c;
          if (!document.getElementById('f_seriesSelect').value) {
            document.getElementById('f_modelSelect').value = detectBestSeriesModelId({
              title: pBtn.dataset.topic || '',
              suggestedModelId: document.getElementById('f_modelSelect').value,
              bridge: pBtn.dataset.p || ''
            });
            updateModelRuleHint();
          }
          box.classList.add('hidden');
        });
      });
    } catch (err) {
      showToast(err.message, 'err');
    }
  });

  // Insert random Viral Hook
  document.getElementById('pickViralHookBtn').addEventListener('click', () => {
    const hook = VIRAL_CODE.hooks[Math.floor(Math.random() * VIRAL_CODE.hooks.length)];
    const topicEl = document.getElementById('f_topic');
    topicEl.value = `${hook} ${topicEl.value}`.trim();
    showToast('Gancho do Código Viral inserido!', 'ok');
  });

  // Generate Complete Episode
  document.getElementById('generateEpisodeBtn').addEventListener('click', handleGenerateEpisode);

  // Script stats live counter
  document.getElementById('o_script').addEventListener('input', updateScriptTimerBadge);

  // Selected headline syncs with Cover Studio
  document.getElementById('o_selectedHeadline').addEventListener('input', (e) => {
    document.getElementById('cov_headline').value = e.target.value;
    updateCoverPreview();
  });

  // Cover Studio live inputs
  ['cov_headline', 'cov_seriesLabel', 'cov_template', 'cov_safeZoneToggle'].forEach((id) => {
    document.getElementById(id).addEventListener('input', updateCoverPreview);
    document.getElementById(id).addEventListener('change', updateCoverPreview);
  });

  document.getElementById('cov_uploadBg').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      currentCoverBgDataUrl = reader.result;
      updateCoverPreview();
      showToast('Foto aplicada no fundo da capa!', 'ok');
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('cov_clearBgBtn').addEventListener('click', () => {
    currentCoverBgDataUrl = '';
    updateCoverPreview();
  });

  document.getElementById('generateCoverAiBgBtn').addEventListener('click', async () => {
    const btn = document.getElementById('generateCoverAiBgBtn');
    const prompt = document.getElementById('o_coverImagePrompt').value.trim() || document.getElementById('cov_headline').value;
    btn.disabled = true;
    btn.textContent = '⏳ Gerando imagem IA...';
    try {
      const bgUrl = await generateCoverBackground({
        imagePrompt: prompt,
        apiKey: state.settings.geminiKey
      });
      currentCoverBgDataUrl = bgUrl;
      await updateCoverPreview();
      showToast('Fundo gerado por IA e aplicado à capa 9:16!', 'ok');
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Gerar Fundo com IA';
    }
  });

  document.getElementById('downloadCoverBtn').addEventListener('click', async () => {
    const btn = document.getElementById('downloadCoverBtn');
    btn.disabled = true;
    try {
      const { dataUrl, blob } = await renderCleanCoverExport(getCoverOptions());
      const part = document.getElementById('f_partNumber').value || 1;
      const filename = `capa-reels-parte-${part}.png`;
      const result = await saveCoverImage({ blob, dataUrl, filename });

      if (result.method === 'share') {
        showToast('Toque em "Salvar Imagem" para salvar no Rolo da Câmera!', 'ok');
      } else if (result.method === 'fallback_modal') {
        lastCoverExportFallback = { blob: result.blob, dataUrl, filename };
        document.getElementById('coverExportImg').src = dataUrl;
        document.getElementById('coverExportModal').classList.remove('hidden');
      } else if (result.method === 'download') {
        showToast('Capa 1080×1920 PNG salva sem guia de área segura!', 'ok');
      }
    } finally {
      btn.disabled = false;
    }
  });

  // Save Episode into Series Folder
  document.getElementById('saveEpisodeBtn').addEventListener('click', () => saveCurrentEpisode({ silent: false }));
  document.getElementById('newEpisodeBlankBtn').addEventListener('click', () => {
    clearFactoryFields();
    showToast('Pronto para criar um novo episódio!', 'ok');
  });

  // Send to Teleprompter / Club
  document.getElementById('sendToTeleprompterBtn').addEventListener('click', () => {
    const script = document.getElementById('o_script').value;
    document.getElementById('club_scriptInput').value = script;
    updateTeleprompterText(script);
    switchTab('tab-club');
  });

  document.getElementById('sendToClubBtn').addEventListener('click', () => {
    const script = document.getElementById('o_script').value;
    document.getElementById('club_scriptInput').value = script;
    updateTeleprompterText(script);
    switchTab('tab-club');
    document.getElementById('runClubAnalysisBtn').click();
  });
}

async function handleGenerateEpisode() {
  const btn = document.getElementById('generateEpisodeBtn');

  try {
    const activeCreator = getActiveCreator();
    const seriesSel = document.getElementById('f_seriesSelect');
    const seriesId = seriesSel.value || '';
    const serie = seriesId ? state.series.find((s) => s.id === seriesId) : null;
    const partInput = document.getElementById('f_partNumber');

    let partNumber = null;
    if (serie) {
      partNumber = Number(partInput.value);
      if (!partNumber || partNumber < 1) {
        const eps = state.episodes.filter((ep) => ep.seriesId === seriesId);
        partNumber = eps.reduce((max, ep) => Math.max(max, Number(ep.partNumber) || 0), 0) + 1;
        partInput.value = partNumber;
      }
    } else if (partInput.value.trim()) {
      partNumber = Math.max(1, Number(partInput.value));
    }

    const modelId = document.getElementById('f_modelSelect').value;
    const sourceNews = getFactorySourceNews();

    const generated = await runWithStatusTicker(btn, 'Gerando pacote completo...', (onStatus) =>
      generateCompleteEpisode({
        creator: activeCreator,
        modelId,
        seriesName: serie?.name || '',
        partNumber,
        topic: document.getElementById('f_topic').value.trim(),
        funnelStage: document.getElementById('f_funnelStage').value,
        viralGoal: document.getElementById('f_viralGoal').value,
        validation: {
          problem: document.getElementById('f_qProblem').value.trim(),
          learn: document.getElementById('f_qLearn').value.trim(),
          lifeChange: document.getElementById('f_qLifeChange').value.trim()
        },
        sourceNews,
        driveWebhookUrl: getEffectiveDriveWebhook(state, activeCreator),
        apiKey: state.settings.geminiKey,
        modelName: state.settings.geminiModel,
        onStatus
      })
    );

    document.getElementById('o_title').value = generated.title || '';
    document.getElementById('o_onScreenText').value = generated.onScreenText || '';
    document.getElementById('o_script').value = generated.script || '';
    document.getElementById('o_caption').value = generated.caption || '';
    document.getElementById('o_editingPrompt').value = generated.editingPrompt || '';
    document.getElementById('o_coverImagePrompt').value = generated.coverImagePrompt || '';

    if (generated.validation) {
      document.getElementById('f_qProblem').value = generated.validation.problem || '';
      document.getElementById('f_qLearn').value = generated.validation.learn || '';
      document.getElementById('f_qLifeChange').value = generated.validation.lifeChange || '';
    }

    renderHeadlineChips(generated.headlines || []);
    const primaryHeadline = (generated.headlines && generated.headlines[0]) || generated.title || '';
    document.getElementById('o_selectedHeadline').value = primaryHeadline;
    document.getElementById('cov_headline').value = primaryHeadline;
    document.getElementById('cov_seriesLabel').value = serie?.name || '';
    document.getElementById('trendSeriesNotice')?.classList.add('hidden');

    updateScriptTimerBadge();
    await updateCoverPreview();

    // Auto-save into the series folder or "Sem Pasta Definida" immediately after generation
    const saved = await saveCurrentEpisode({ silent: true });

    // Activate Roteiro & Headlines output tab and scroll into view on narrow screens
    const outPanel = document.querySelector('#tab-factory .factory-output');
    if (outPanel) {
      outPanel.querySelectorAll('.subtab').forEach((b) => b.classList.toggle('active', b.dataset.subtab === 'out-script'));
      outPanel.querySelectorAll('.subtab-panel').forEach((p) => p.classList.toggle('active', p.id === 'out-script'));
      if (window.innerWidth <= 1080) {
        outPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    const savedSuffix = saved
      ? (serie ? ` e salvo na pasta "${serie.name}" (Parte ${partNumber})!` : ' e salvo em "Sem Pasta Definida"!')
      : '!';
    if (generated.fallbackReason) {
      showToast(`Google Gemini em pico de demanda — gerado via Contingência${savedSuffix}`, 'ok');
    } else {
      showToast(`Pacote gerado via ${generated.generatedBy}${savedSuffix}`, 'ok');
    }
  } catch (err) {
    showToast(`Erro ao gerar roteiro: ${err.message}`, 'err');
  }
}

function renderHeadlineChips(headlines) {
  const container = document.getElementById('headlinesChips');
  if (!headlines || !headlines.length) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = headlines.map((h, i) => `
    <button type="button" class="headline-chip ${i === 0 ? 'selected' : ''}" data-hl="${escapeHtml(h)}">
      ${i + 1}. ${escapeHtml(h)}
    </button>
  `).join('');

  container.querySelectorAll('.headline-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.headline-chip').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('o_selectedHeadline').value = btn.dataset.hl;
      document.getElementById('cov_headline').value = btn.dataset.hl;
      updateCoverPreview();
    });
  });
}

function updateScriptTimerBadge() {
  const { words, secs } = computeScriptMetrics(document.getElementById('o_script').value);
  const badge = document.getElementById('scriptTimerBadge');
  badge.textContent = `~${words} palavras • ~${secs}s`;
  badge.style.color = secs > 60 ? 'var(--red)' : 'var(--soft-accent)';
}

function getCoverOptions() {
  const seriesId = document.getElementById('f_seriesSelect').value;
  const serie = state.series.find((s) => s.id === seriesId);
  const creator = getActiveCreator();
  const defaultTpl = (state?.settings?.theme || 'light') === 'dark' ? 'apple_dark' : 'apple_light';

  return {
    headline: document.getElementById('cov_headline').value || document.getElementById('o_selectedHeadline').value || document.getElementById('o_title').value || 'HEADLINE VIRAL DO SEU REELS',
    seriesName: document.getElementById('cov_seriesLabel').value || serie?.name || 'SÉRIE',
    partNumber: Number(document.getElementById('f_partNumber').value) || 1,
    handle: creator?.handle || '@seuperfil',
    accentColor: creator?.brandColor || '#8B5CF6',
    templateId: document.getElementById('cov_template').value || defaultTpl,
    bgDataUrl: currentCoverBgDataUrl,
    showSafeZone: document.getElementById('cov_safeZoneToggle').checked
  };
}

async function updateCoverPreview() {
  const canvas = document.getElementById('coverCanvas');
  if (!canvas) return;
  await renderCoverCanvas(canvas, getCoverOptions());
}

async function saveCurrentEpisode({ silent = false } = {}) {
  const seriesId = document.getElementById('f_seriesSelect').value || '';
  const partInput = document.getElementById('f_partNumber');
  const partNumber = seriesId
    ? Math.max(1, Number(partInput.value) || 1)
    : (partInput.value.trim() ? Math.max(1, Number(partInput.value)) : null);
  partInput.value = partNumber || '';

  const { dataUrl: cleanCoverUrl } = await renderCleanCoverExport(getCoverOptions());

  // Only overwrite existing episode when seriesId matches and (for numbered series) partNumber matches
  const candidate = currentEditingEpisodeId ? state.episodes.find((e) => e.id === currentEditingEpisodeId) : null;
  const existing = (candidate && (candidate.seriesId || '') === seriesId && (!seriesId || Number(candidate.partNumber) === partNumber))
    ? candidate
    : null;

  const chips = Array.from(document.querySelectorAll('#headlinesChips .headline-chip')).map((c) => c.dataset.hl);
  const selectedHl = document.getElementById('o_selectedHeadline').value.trim();
  const headlines = chips.length ? chips : (selectedHl ? [selectedHl] : []);

  const payload = {
    id: existing ? existing.id : uid('ep'),
    creatorId: getActiveCreator().id,
    seriesId,
    modelId: document.getElementById('f_modelSelect').value,
    partNumber,
    title: document.getElementById('o_title').value.trim() || document.getElementById('f_topic').value.trim() || 'Roteiro sem título',
    onScreenText: document.getElementById('o_onScreenText').value.trim(),
    headlines,
    funnelStage: document.getElementById('f_funnelStage').value,
    viralGoal: document.getElementById('f_viralGoal').value,
    status: document.getElementById('o_status').value,
    sourceNews: getFactorySourceNews(),
    validation: {
      problem: document.getElementById('f_qProblem').value.trim(),
      learn: document.getElementById('f_qLearn').value.trim(),
      lifeChange: document.getElementById('f_qLifeChange').value.trim()
    },
    script: document.getElementById('o_script').value,
    caption: document.getElementById('o_caption').value,
    editingPrompt: document.getElementById('o_editingPrompt').value,
    coverImagePrompt: document.getElementById('o_coverImagePrompt').value,
    coverBgDataUrl: currentCoverBgDataUrl,
    coverDataUrl: cleanCoverUrl,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    const idx = state.episodes.findIndex((e) => e.id === existing.id);
    state.episodes[idx] = payload;
  } else {
    state.episodes.push(payload);
    currentEditingEpisodeId = payload.id;
  }

  await persist();
  renderSeriesPartsStrip();
  renderSeriesFolders();
  renderUnfiledEpisodes();
  if (!silent) {
    showToast(
      seriesId
        ? `Parte ${partNumber} + Capa 9:16 salvas na Pasta da Série!`
        : 'Roteiro avulso + Capa 9:16 salvos na aba "Sem Pasta Definida"!',
      'ok'
    );
  }
  return payload;
}

function loadEpisodeIntoFactory(ep) {
  currentEditingEpisodeId = ep.id;
  currentCoverBgDataUrl = ep.coverBgDataUrl || '';
  document.getElementById('trendSeriesNotice')?.classList.add('hidden');

  const serie = ep.seriesId ? state.series.find((s) => s.id === ep.seriesId) : null;
  document.getElementById('f_seriesSelect').value = serie ? serie.id : '';
  document.getElementById('f_modelSelect').value = ep.modelId || serie?.modelId || 'codigo_viral';
  updateModelRuleHint();

  const partEl = document.getElementById('f_partNumber');
  partEl.value = ep.partNumber || (serie ? 1 : '');
  partEl.dataset.manual = ep.partNumber ? '1' : '';
  document.getElementById('f_topic').value = ep.title || '';
  document.getElementById('f_funnelStage').value = ep.funnelStage || 'topo';
  document.getElementById('f_viralGoal').value = ep.viralGoal || 'share';
  document.getElementById('f_qProblem').value = ep.validation?.problem || '';
  document.getElementById('f_qLearn').value = ep.validation?.learn || '';
  document.getElementById('f_qLifeChange').value = ep.validation?.lifeChange || '';
  setFactorySourceNews(ep.sourceNews || null);

  document.getElementById('o_title').value = ep.title || '';
  document.getElementById('o_status').value = ep.status || 'roteiro';
  document.getElementById('o_onScreenText').value = ep.onScreenText || '';
  document.getElementById('o_script').value = ep.script || '';
  document.getElementById('o_caption').value = ep.caption || '';
  document.getElementById('o_editingPrompt').value = ep.editingPrompt || '';
  document.getElementById('o_coverImagePrompt').value = ep.coverImagePrompt || '';

  renderHeadlineChips(ep.headlines || []);
  const hl = (ep.headlines && ep.headlines[0]) || ep.title || '';
  document.getElementById('o_selectedHeadline').value = hl;
  document.getElementById('cov_headline').value = hl;
  document.getElementById('cov_seriesLabel').value = serie?.name || '';

  renderSeriesPartsStrip();
  updateScriptTimerBadge();
  updateCoverPreview();
}

function clearFactoryFields({ keepSeriesFree = false } = {}) {
  currentEditingEpisodeId = null;
  currentCoverBgDataUrl = '';
  setFactorySourceNews(null);
  const seriesSel = document.getElementById('f_seriesSelect');
  const partEl = document.getElementById('f_partNumber');
  const notice = document.getElementById('trendSeriesNotice');

  let serie = null;
  let nextPartLabel = '';

  if (keepSeriesFree) {
    seriesSel.value = '';
    partEl.value = '';
    partEl.dataset.manual = '';
    notice?.classList.remove('hidden');
  } else {
    notice?.classList.add('hidden');
    const seriesId = seriesSel.value;
    serie = seriesId ? state.series.find((s) => s.id === seriesId) : null;
    if (serie) {
      const eps = state.episodes.filter((ep) => ep.seriesId === seriesId);
      const maxPart = eps.reduce((m, e) => Math.max(m, Number(e.partNumber) || 0), 0);
      partEl.value = maxPart + 1;
      partEl.dataset.manual = '';
      nextPartLabel = `${serie.name} • Parte ${maxPart + 1}`;
    } else {
      partEl.value = '';
      partEl.dataset.manual = '';
    }
  }

  document.getElementById('f_topic').value = '';
  document.getElementById('f_qProblem').value = '';
  document.getElementById('f_qLearn').value = '';
  document.getElementById('f_qLifeChange').value = '';
  document.getElementById('o_title').value = '';
  document.getElementById('o_status').value = 'roteiro';
  document.getElementById('o_onScreenText').value = nextPartLabel;
  document.getElementById('o_script').value = '';
  document.getElementById('o_caption').value = '';
  document.getElementById('o_editingPrompt').value = '';
  document.getElementById('o_coverImagePrompt').value = '';
  document.getElementById('headlinesChips').innerHTML = '';
  document.getElementById('o_selectedHeadline').value = '';
  document.getElementById('cov_headline').value = '';
  document.getElementById('cov_seriesLabel').value = serie?.name || '';
  renderSeriesPartsStrip();
  updateScriptTimerBadge();
  updateCoverPreview();
}

// ============================================================================
// TAB 4: CLUBE DE ANÁLISE IA & TELEPROMPTER
// ============================================================================

function computeScriptMetrics(text) {
  const words = String(text || '').replace(/\[.*?\]/g, '').trim().split(/\s+/).filter(Boolean).length;
  return { words, secs: Math.round(words / 2.3) };
}

function buildWordDiffHtml(beforeText, afterText) {
  const splitTokens = (s, byLine = false) =>
    byLine
      ? String(s || '').split(/(\n+)/).filter(Boolean)
      : String(s || '').split(/(\s+)/).filter(Boolean);

  let a = splitTokens(beforeText, false);
  let b = splitTokens(afterText, false);
  if (a.length * b.length > 250000) {
    a = splitTokens(beforeText, true);
    b = splitTokens(afterText, true);
  }

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  let beforeHtml = '';
  let afterHtml = '';
  let i = 0;
  let j = 0;

  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      const safe = escapeHtml(a[i]);
      beforeHtml += safe;
      afterHtml += safe;
      i++;
      j++;
    } else if (j < n && (i === m || dp[i][j + 1] >= dp[i + 1][j])) {
      const tok = b[j++];
      afterHtml += /^\s+$/.test(tok) ? escapeHtml(tok) : `<ins class="diff-add">${escapeHtml(tok)}</ins>`;
    } else {
      const tok = a[i++];
      beforeHtml += /^\s+$/.test(tok) ? escapeHtml(tok) : `<del class="diff-del">${escapeHtml(tok)}</del>`;
    }
  }

  return { beforeHtml, afterHtml };
}

function renderClubComparison(originalScript, improvedScript) {
  const { beforeHtml, afterHtml } = buildWordDiffHtml(originalScript, improvedScript);
  const bStats = computeScriptMetrics(originalScript);
  const aStats = computeScriptMetrics(improvedScript);

  document.getElementById('clubBeforeView').innerHTML = beforeHtml || '<span class="muted-xs">(vazio)</span>';
  document.getElementById('clubAfterView').innerHTML = afterHtml || '<span class="muted-xs">(vazio)</span>';
  document.getElementById('clubBeforeStats').textContent = `${bStats.words} pal. • ~${bStats.secs}s`;
  document.getElementById('clubAfterStats').textContent = `${aStats.words} pal. • ~${aStats.secs}s`;
  document.getElementById('clubAfterTextarea').value = improvedScript;
}

function wireClubAndTeleprompter() {
  document.getElementById('loadLastEpisodeClubBtn').addEventListener('click', () => {
    const script = document.getElementById('o_script').value;
    document.getElementById('club_scriptInput').value = script;
    updateTeleprompterText(script);
    showToast('Roteiro puxado da Fábrica!', 'ok');
  });

  document.getElementById('club_scriptInput').addEventListener('input', (e) => {
    updateTeleprompterText(e.target.value);
  });

  document.getElementById('runClubAnalysisBtn').addEventListener('click', async () => {
    const script = document.getElementById('club_scriptInput').value.trim();
    if (!script) {
      showToast('Cole um roteiro primeiro para analisar.', 'err');
      return;
    }
    const btn = document.getElementById('runClubAnalysisBtn');

    try {
      const res = await runWithStatusTicker(btn, 'Analisando no Clube...', (onStatus) =>
        analyzeScript({
          script,
          creator: getActiveCreator(),
          modelId: document.getElementById('f_modelSelect').value,
          apiKey: state.settings.geminiKey,
          modelName: state.settings.geminiModel,
          onStatus
        })
      );

      document.getElementById('clubResultBox').classList.remove('hidden');
      document.getElementById('clubDiffBox').classList.remove('hidden');
      document.getElementById('clubScoreValue').textContent = `${res.score}%`;
      const badge = document.getElementById('clubScoreBadge');
      badge.textContent = res.score >= 70 ? '✅ Passou no Filtro 70% — Pode Gravar!' : '⚠️ Abaixo de 70% — Ajuste antes de gravar';
      document.getElementById('clubVerdict').textContent = `${res.verdict} (${res.generatedBy})`;

      document.getElementById('clubKeepList').innerHTML = (res.keep || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
      document.getElementById('clubAdjustList').innerHTML = (res.adjust || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
      document.getElementById('clubBlockerList').innerHTML = (res.blockers || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');

      lastAnalysisOriginalScript = script;
      lastAnalysisImprovedScript = res.improvedScript || script;

      // Reset editor toggle to diff preview and populate side-by-side comparison
      document.getElementById('clubAfterView').classList.remove('hidden');
      document.getElementById('clubAfterTextarea').classList.add('hidden');
      document.getElementById('toggleEditAfterBtn').textContent = '✏️ Editar texto final';
      renderClubComparison(lastAnalysisOriginalScript, lastAnalysisImprovedScript);
    } catch (err) {
      showToast(err.message, 'err');
    }
  });

  document.getElementById('toggleEditAfterBtn').addEventListener('click', () => {
    const viewEl = document.getElementById('clubAfterView');
    const taEl = document.getElementById('clubAfterTextarea');
    const toggleBtn = document.getElementById('toggleEditAfterBtn');
    const editing = !taEl.classList.contains('hidden');
    if (editing) {
      lastAnalysisImprovedScript = taEl.value;
      renderClubComparison(lastAnalysisOriginalScript, lastAnalysisImprovedScript);
      taEl.classList.add('hidden');
      viewEl.classList.remove('hidden');
      toggleBtn.textContent = '✏️ Editar texto final';
    } else {
      taEl.value = lastAnalysisImprovedScript;
      viewEl.classList.add('hidden');
      taEl.classList.remove('hidden');
      toggleBtn.textContent = '👁️ Ver marcações';
      taEl.focus();
    }
  });

  document.getElementById('clubAfterTextarea').addEventListener('input', (e) => {
    lastAnalysisImprovedScript = e.target.value;
    const stats = computeScriptMetrics(lastAnalysisImprovedScript);
    document.getElementById('clubAfterStats').textContent = `${stats.words} pal. • ~${stats.secs}s`;
  });

  document.getElementById('applyClubFixBtn').addEventListener('click', async () => {
    const taEl = document.getElementById('clubAfterTextarea');
    const approvedText = (!taEl.classList.contains('hidden') ? taEl.value : lastAnalysisImprovedScript) || '';
    if (!approvedText.trim()) return;
    lastAnalysisImprovedScript = approvedText;
    document.getElementById('club_scriptInput').value = approvedText;
    document.getElementById('o_script').value = approvedText;
    updateScriptTimerBadge();
    updateTeleprompterText(approvedText);

    if (currentEditingEpisodeId) {
      const ep = state.episodes.find((item) => item.id === currentEditingEpisodeId);
      if (ep) {
        ep.script = approvedText;
        ep.updatedAt = new Date().toISOString();
        await persist();
        renderSeriesFolders();
      }
    }
    showToast('Versão otimizada aprovada e aplicada na Fábrica e Teleprompter!', 'ok');
  });

  document.getElementById('discardClubFixBtn').addEventListener('click', () => {
    document.getElementById('clubDiffBox').classList.add('hidden');
    showToast('Alterações descartadas — roteiro original mantido.', 'ok');
  });

  // Teleprompter controls
  const tpViewport = document.getElementById('tpViewport');
  const tpContent = document.getElementById('tpContent');
  const tpSpeed = document.getElementById('tpSpeed');
  const tpFontSize = document.getElementById('tpFontSize');

  tpSpeed.addEventListener('input', () => {
    document.getElementById('tpSpeedVal').textContent = tpSpeed.value;
  });

  tpFontSize.addEventListener('input', () => {
    document.getElementById('tpSizeVal').textContent = tpFontSize.value;
    tpContent.style.fontSize = `${tpFontSize.value}px`;
  });

  document.getElementById('tpMirror').addEventListener('change', (e) => {
    tpContent.classList.toggle('mirrored', e.target.checked);
  });

  document.getElementById('tpPlayBtn').addEventListener('click', () => {
    if (tpInterval) {
      stopInlineTp();
    } else {
      document.getElementById('tpPlayBtn').textContent = '⏸ Pausar';
      tpInterval = setInterval(() => {
        tpViewport.scrollTop += Number(tpSpeed.value) * 0.7;
      }, 30);
    }
  });

  document.getElementById('tpResetBtn').addEventListener('click', () => {
    stopInlineTp();
    tpViewport.scrollTop = 0;
  });

  // Fullscreen teleprompter
  const fsModal = document.getElementById('tpFullscreenModal');
  const fsViewport = document.getElementById('tpFsViewport');
  const fsSpeed = document.getElementById('tpFsSpeed');

  document.getElementById('tpFullscreenBtn').addEventListener('click', () => {
    stopInlineTp();
    document.getElementById('tpFsContent').textContent = tpContent.textContent;
    fsSpeed.value = tpSpeed.value;
    fsViewport.scrollTop = 0;
    fsModal.classList.remove('hidden');
  });

  document.getElementById('tpFsPlayBtn').addEventListener('click', () => {
    if (tpFsInterval) {
      clearInterval(tpFsInterval);
      tpFsInterval = null;
      document.getElementById('tpFsPlayBtn').textContent = '▶ Play';
    } else {
      document.getElementById('tpFsPlayBtn').textContent = '⏸ Pausar';
      tpFsInterval = setInterval(() => {
        fsViewport.scrollTop += Number(fsSpeed.value) * 0.8;
      }, 30);
    }
  });

  document.getElementById('tpFsResetBtn').addEventListener('click', () => {
    fsViewport.scrollTop = 0;
  });

  document.getElementById('closeTpFsBtn').addEventListener('click', () => {
    clearInterval(tpFsInterval);
    tpFsInterval = null;
    fsModal.classList.add('hidden');
  });
}

function stopInlineTp() {
  if (tpInterval) {
    clearInterval(tpInterval);
    tpInterval = null;
  }
  document.getElementById('tpPlayBtn').textContent = '▶ Iniciar Rolagem';
}

function updateTeleprompterText(raw) {
  const clean = (raw || '').trim() || 'Carregue ou escreva um roteiro para gravar no Teleprompter.';
  document.getElementById('tpContent').textContent = clean;
  document.getElementById('tpFsContent').textContent = clean;
}

// ============================================================================
// TAB 5: PASTAS DE SÉRIES & CATÁLOGO 33 PROFISSÕES
// ============================================================================

function wireLibraryTab() {
  document.getElementById('catalogSearchInput').addEventListener('input', renderCatalog);
  document.getElementById('catalogCategoryFilter').addEventListener('change', renderCatalog);
}

function renderEpisodeCardHtml(ep, seriesList) {
  const isEpExpanded = expandedEpisodeIds.has(ep.id);
  const isMoveOpen = openMoveEpisodeIds.has(ep.id);
  const partLabel = ep.partNumber ? `Parte ${ep.partNumber}` : 'Avulso';
  const thumbBadge = ep.partNumber ? `P.${ep.partNumber}` : 'Avulso';
  const newsLinkHtml = ep.sourceNews?.url
    ? ` • <a href="${escapeHtml(ep.sourceNews.url)}" target="_blank" rel="noopener noreferrer">📰 Notícia fonte ↗</a>`
    : '';

  return `
    <div class="episode-item-wrap" data-ep-id="${ep.id}">
      <div class="episode-row">
        <div class="inline-controls" style="gap:12px;">
          ${ep.coverDataUrl ? `<img class="ep-thumb" src="${ep.coverDataUrl}" alt="Capa" />` : `<div class="ep-thumb" style="display:grid;place-items:center;font-size:11px;color:var(--text-muted);">${thumbBadge}</div>`}
          <div>
            <strong>${partLabel}: ${escapeHtml(ep.title)}</strong>
            <div class="muted-xs mt-6">Status: <strong>${escapeHtml(ep.status || 'roteiro')}</strong> • ${ep.script ? 'Roteiro pronto' : 'Ideia aguardando geração'}${newsLinkHtml}</div>
          </div>
        </div>
        <div class="inline-controls">
          <button type="button" class="btn btn-secondary btn-sm toggle-ep-preview-btn" data-id="${ep.id}" aria-expanded="${isEpExpanded}">${isEpExpanded ? '▴ Ocultar Roteiro' : '👁️ Ver Roteiro'}</button>
          ${ep.script ? `<button type="button" class="btn btn-secondary btn-sm copy-ep-script-btn" data-id="${ep.id}">📋 Copiar</button>` : ''}
          <button type="button" class="btn btn-secondary btn-sm toggle-ep-move-btn" data-id="${ep.id}">📁 Mover / Parte</button>
          <button type="button" class="btn btn-primary btn-sm open-ep-btn" data-id="${ep.id}">✏️ Editar na Fábrica</button>
          <button type="button" class="btn btn-danger-outline btn-sm del-ep-btn" data-id="${ep.id}">✕</button>
        </div>
      </div>
      ${isMoveOpen ? `
        <div class="episode-move-box" data-ep-id="${ep.id}">
          <span class="muted-xs" style="font-weight:700;">Mover para:</span>
          <select class="input input-compact move-ep-series-select" data-id="${ep.id}">
            <option value="" ${!ep.seriesId ? 'selected' : ''}>Sem pasta definida (Avulso)</option>
            ${seriesList.map((sr) => `<option value="${sr.id}" ${sr.id === ep.seriesId ? 'selected' : ''}>${escapeHtml(sr.name)}</option>`).join('')}
          </select>
          <input type="number" min="1" class="input input-compact move-ep-part-input" data-id="${ep.id}" value="${ep.partNumber || ''}" placeholder="Parte #" title="Número da parte (opcional se avulso)" />
          <button type="button" class="btn btn-primary btn-xs confirm-move-ep-btn" data-id="${ep.id}">✓ Salvar Posição</button>
          <button type="button" class="btn btn-secondary btn-xs cancel-move-ep-btn" data-id="${ep.id}">Cancelar</button>
        </div>
      ` : ''}
      ${isEpExpanded ? `
        <div class="episode-preview-box">
          ${ep.onScreenText ? `<div class="ep-preview-onscreen"><strong>Texto na tela:</strong> ${escapeHtml(ep.onScreenText)}</div>` : ''}
          ${ep.sourceNews?.url ? `<div class="ep-preview-onscreen"><strong>📰 Referência:</strong> ${escapeHtml(ep.sourceNews.title || ep.sourceNews.url)} — <a href="${escapeHtml(ep.sourceNews.url)}" target="_blank" rel="noopener noreferrer">Abrir matéria ↗</a></div>` : ''}
          ${ep.script ? `<pre class="ep-preview-script">${escapeHtml(ep.script)}</pre>` : `<p class="muted-sm">Esta parte ainda é apenas uma ideia salva. Clique em <em>Editar na Fábrica</em> para gerar o roteiro completo.</p>`}
          <div class="ep-preview-actions">
            ${ep.script ? `<button type="button" class="btn btn-secondary btn-xs copy-ep-script-btn" data-id="${ep.id}">📋 Copiar Roteiro</button>` : ''}
            ${ep.caption ? `<button type="button" class="btn btn-secondary btn-xs copy-ep-caption-btn" data-id="${ep.id}">📋 Copiar Legenda</button>` : ''}
            ${(ep.script || ep.caption || ep.onScreenText) ? `<button type="button" class="btn btn-secondary btn-xs copy-ep-all-btn" data-id="${ep.id}">📋 Copiar Pacote Completo</button>` : ''}
            <button type="button" class="btn btn-primary btn-xs open-ep-btn" data-id="${ep.id}">✏️ Abrir na Fábrica</button>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function bindEpisodeCardEvents(container, seriesList) {
  container.querySelectorAll('.toggle-ep-preview-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const epId = btn.dataset.id;
      if (expandedEpisodeIds.has(epId)) {
        expandedEpisodeIds.delete(epId);
      } else {
        expandedEpisodeIds.add(epId);
      }
      renderSeriesFolders();
      renderUnfiledEpisodes();
    });
  });

  container.querySelectorAll('.toggle-ep-move-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const epId = btn.dataset.id;
      if (openMoveEpisodeIds.has(epId)) {
        openMoveEpisodeIds.delete(epId);
      } else {
        openMoveEpisodeIds.add(epId);
      }
      renderSeriesFolders();
      renderUnfiledEpisodes();
    });
  });

  container.querySelectorAll('.cancel-move-ep-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      openMoveEpisodeIds.delete(btn.dataset.id);
      renderSeriesFolders();
      renderUnfiledEpisodes();
    });
  });

  container.querySelectorAll('.move-ep-series-select').forEach((sel) => {
    sel.addEventListener('change', () => {
      const box = sel.closest('.episode-move-box');
      const partInput = box?.querySelector('.move-ep-part-input');
      if (!partInput) return;
      const targetSeriesId = sel.value;
      if (!targetSeriesId) {
        partInput.value = '';
        return;
      }
      const epsInTarget = state.episodes.filter((e) => e.seriesId === targetSeriesId && e.id !== sel.dataset.id);
      const nextPart = epsInTarget.reduce((m, e) => Math.max(m, Number(e.partNumber) || 0), 0) + 1;
      partInput.value = nextPart;
    });
  });

  container.querySelectorAll('.confirm-move-ep-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const epId = btn.dataset.id;
      const ep = state.episodes.find((e) => e.id === epId);
      const box = btn.closest('.episode-move-box');
      if (!ep || !box) return;

      const targetSeriesId = box.querySelector('.move-ep-series-select')?.value || '';
      const rawPart = box.querySelector('.move-ep-part-input')?.value.trim() || '';
      const nextPart = targetSeriesId
        ? Math.max(1, Number(rawPart) || 1)
        : (rawPart ? Math.max(1, Number(rawPart)) : null);

      ep.seriesId = targetSeriesId;
      ep.partNumber = nextPart;
      ep.updatedAt = new Date().toISOString();
      openMoveEpisodeIds.delete(epId);
      if (targetSeriesId) expandedSeriesIds.add(targetSeriesId);

      if (currentEditingEpisodeId === epId) {
        document.getElementById('f_seriesSelect').value = targetSeriesId;
        document.getElementById('f_partNumber').value = nextPart || '';
        const targetSerie = seriesList.find((s) => s.id === targetSeriesId);
        document.getElementById('cov_seriesLabel').value = targetSerie?.name || '';
        updateCoverPreview();
      }

      await persist();
      renderFactorySeriesSelect();
      renderSeriesPartsStrip();
      renderSeriesFolders();
      renderUnfiledEpisodes();

      const targetSerie = seriesList.find((s) => s.id === targetSeriesId);
      showToast(
        targetSerie
          ? `Movido para "${targetSerie.name}" (Parte ${nextPart})!`
          : 'Movido para "Sem Pasta Definida"!',
        'ok'
      );
    });
  });

  container.querySelectorAll('.copy-ep-script-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ep = state.episodes.find((e) => e.id === btn.dataset.id);
      if (!ep?.script) {
        showToast('Este episódio ainda não possui roteiro gerado.', 'err');
        return;
      }
      await copyText(ep.script);
    });
  });

  container.querySelectorAll('.copy-ep-caption-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ep = state.episodes.find((e) => e.id === btn.dataset.id);
      if (ep?.caption) await copyText(ep.caption);
    });
  });

  container.querySelectorAll('.copy-ep-all-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ep = state.episodes.find((e) => e.id === btn.dataset.id);
      if (!ep) return;
      const parts = [
        `${ep.partNumber ? `PARTE ${ep.partNumber}` : 'ROTEIRO AVULSO'}: ${ep.title || ''}`,
        ep.onScreenText ? `\nTEXTO NA TELA:\n${ep.onScreenText}` : '',
        ep.script ? `\nROTEIRO:\n${ep.script}` : '',
        ep.caption ? `\nLEGENDA:\n${ep.caption}` : ''
      ].filter(Boolean).join('\n');
      await copyText(parts);
    });
  });

  container.querySelectorAll('.open-ep-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ep = state.episodes.find((e) => e.id === btn.dataset.id);
      if (ep) {
        loadEpisodeIntoFactory(ep);
        switchTab('tab-factory');
      }
    });
  });

  container.querySelectorAll('.del-ep-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      expandedEpisodeIds.delete(id);
      openMoveEpisodeIds.delete(id);
      state.episodes = state.episodes.filter((e) => e.id !== id);
      await persist();
      renderSeriesPartsStrip();
      renderSeriesFolders();
      renderUnfiledEpisodes();
      showToast('Episódio removido.', 'ok');
    });
  });
}

function renderUnfiledEpisodes() {
  const listEl = document.getElementById('unfiledEpisodesList');
  const badgeEl = document.getElementById('unfiledCountBadge');
  const series = getCreatorSeries();
  const validSeriesIds = new Set(series.map((s) => s.id));
  const unfiled = getCreatorEpisodes().filter((e) => !e.seriesId || !validSeriesIds.has(e.seriesId));

  if (badgeEl) {
    badgeEl.textContent = String(unfiled.length);
  }
  if (!listEl) return;

  if (!unfiled.length) {
    listEl.innerHTML = `
      <div class="card">
        <h3>Nenhum roteiro sem pasta definida</h3>
        <p class="muted-sm mt-6">Na <strong>Fábrica de Roteiros</strong>, você pode deixar a <em>Pasta da Série</em> em branco para gerar roteiros avulsos rapidamente — eles aparecerão aqui para você revisar, copiar ou mover para qualquer pasta depois.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = `
    <div class="card">
      <div class="card-row mb-12">
        <div>
          <h3>📝 Roteiros Avulsos (${unfiled.length})</h3>
          <p class="muted-sm">Expanda quantos quiser para ler/copiar ou use <strong>Mover / Parte</strong> para organizar numa pasta de série.</p>
        </div>
        <button type="button" id="toggleAllUnfiledBtn" class="btn btn-secondary btn-sm">
          👁️ ${unfiled.every((ep) => expandedEpisodeIds.has(ep.id)) ? 'Recolher Todos' : 'Expandir Todos'}
        </button>
      </div>
      ${unfiled.map((ep) => renderEpisodeCardHtml(ep, series)).join('')}
    </div>
  `;

  document.getElementById('toggleAllUnfiledBtn')?.addEventListener('click', () => {
    const allOpen = unfiled.every((ep) => expandedEpisodeIds.has(ep.id));
    unfiled.forEach((ep) => {
      if (allOpen) expandedEpisodeIds.delete(ep.id);
      else expandedEpisodeIds.add(ep.id);
    });
    renderUnfiledEpisodes();
  });

  bindEpisodeCardEvents(listEl, series);
}

function renderSeriesFolders() {
  const grid = document.getElementById('seriesFoldersGrid');
  const series = getCreatorSeries();

  if (!series.length) {
    grid.innerHTML = `<div class="card"><h3>Nenhuma pasta de série ainda</h3><p class="muted-sm mt-6">Crie uma série na Fábrica de Roteiros ou importe uma profissão no DNA do Criador.</p></div>`;
    return;
  }

  grid.innerHTML = series.map((s) => {
    const eps = state.episodes
      .filter((e) => e.seriesId === s.id)
      .sort((a, b) => (Number(a.partNumber) || 0) - (Number(b.partNumber) || 0));
    const model = SERIES_MODELS.find((m) => m.id === s.modelId);
    const pct = Math.min(100, Math.round((eps.length / 15) * 100));
    const isExpanded = expandedSeriesIds.has(s.id);
    const nextPart = eps.reduce((m, e) => Math.max(m, Number(e.partNumber) || 0), 0) + 1;

    return `
      <div class="card series-card ${isExpanded ? 'expanded' : ''}" style="border-top-color:${escapeHtml(s.color || '#8B5CF6')}" data-series-id="${s.id}">
        <div class="series-card-header" role="button" tabindex="0" aria-expanded="${isExpanded}">
          <div class="label-between">
            <span class="badge-pill">${escapeHtml(model?.code || 'Série')}</span>
            <span class="muted-xs">${eps.length} / 15 partes</span>
          </div>
          <h3 class="mt-8">${isExpanded ? '📂' : '📁'} ${escapeHtml(s.name)}</h3>
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="label-between" style="margin-bottom:0;">
            <span class="muted-xs">${eps.length >= 15 ? '🏆 Meta de 15 partes atingida!' : `Faltam ${15 - eps.length} partes p/ maturidade`}</span>
            <span class="series-toggle-hint">${isExpanded ? '▴ Minimizar' : '▾ Abrir pasta'}</span>
          </div>
        </div>

        ${isExpanded ? `
          <div class="series-inline-body">
            <div class="card-row mb-12">
              <div class="muted-sm"><strong>${eps.length}</strong> episódio(s) nesta pasta</div>
              <div class="inline-controls">
                ${eps.length ? `<button type="button" class="btn btn-secondary btn-sm toggle-all-eps-btn" data-id="${s.id}">👁️ ${eps.every((ep) => expandedEpisodeIds.has(ep.id)) ? 'Recolher Partes' : 'Expandir Partes'}</button>` : ''}
                <button type="button" class="btn btn-gradient btn-sm create-next-part-btn" data-id="${s.id}" data-next="${nextPart}" data-model="${escapeHtml(s.modelId || 'serie_01')}">➕ Criar Parte ${nextPart}</button>
                <button type="button" class="btn btn-danger-outline btn-sm delete-series-btn" data-id="${s.id}" data-name="${escapeHtml(s.name)}">🗑️ Excluir Pasta</button>
              </div>
            </div>

            ${eps.length ? eps.map((ep) => renderEpisodeCardHtml(ep, series)).join('') : `<p class="muted-sm">Nenhum episódio nesta pasta ainda.</p>`}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.series-card-header').forEach((hdr) => {
    const toggle = () => {
      const card = hdr.closest('.series-card');
      const sId = card?.dataset.seriesId;
      if (!sId) return;
      if (expandedSeriesIds.has(sId)) {
        expandedSeriesIds.delete(sId);
      } else {
        expandedSeriesIds.add(sId);
      }
      renderSeriesFolders();
    };
    hdr.addEventListener('click', toggle);
    hdr.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  grid.querySelectorAll('.toggle-all-eps-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sId = btn.dataset.id;
      const eps = state.episodes.filter((e) => e.seriesId === sId);
      const allOpen = eps.length > 0 && eps.every((e) => expandedEpisodeIds.has(e.id));
      eps.forEach((e) => {
        if (allOpen) expandedEpisodeIds.delete(e.id);
        else expandedEpisodeIds.add(e.id);
      });
      renderSeriesFolders();
    });
  });

  grid.querySelectorAll('.create-next-part-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('f_seriesSelect').value = btn.dataset.id;
      document.getElementById('f_modelSelect').value = btn.dataset.model;
      clearFactoryFields();
      document.getElementById('f_partNumber').value = btn.dataset.next;
      updateModelRuleHint();
      switchTab('tab-factory');
    });
  });

  grid.querySelectorAll('.delete-series-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sId = btn.dataset.id;
      if (!confirm(`Excluir a pasta "${btn.dataset.name}" e todos os seus episódios?`)) return;
      expandedSeriesIds.delete(sId);
      state.episodes.filter((e) => e.seriesId === sId).forEach((e) => {
        expandedEpisodeIds.delete(e.id);
        openMoveEpisodeIds.delete(e.id);
      });
      state.series = state.series.filter((s) => s.id !== sId);
      state.episodes = state.episodes.filter((e) => e.seriesId !== sId);
      await persist();
      renderFactorySeriesSelect();
      renderSeriesPartsStrip();
      renderSeriesFolders();
      renderUnfiledEpisodes();
      showToast('Pasta excluída.', 'ok');
    });
  });

  bindEpisodeCardEvents(grid, series);
}

function renderCatalog() {
  const q = (document.getElementById('catalogSearchInput').value || '').toLowerCase();
  const cat = document.getElementById('catalogCategoryFilter').value;
  const grid = document.getElementById('catalogGrid');

  const filtered = PROFESSIONS.filter((p) => {
    if (cat && p.category !== cat) return false;
    if (!q) return true;
    const blob = `${p.name} ${p.subtitle} ${p.series.map((s) => s.title + ' ' + s.parts.join(' ')).join(' ')}`.toLowerCase();
    return blob.includes(q);
  });

  grid.innerHTML = filtered.map((p) => `
    <div class="card">
      <div class="label-between">
        <span class="badge-pill">${escapeHtml(p.category)}</span>
        <button class="btn btn-secondary btn-sm import-prof-btn" data-prof="${p.id}">➕ Importar 5 Séries</button>
      </div>
      <h3 class="mt-8">${escapeHtml(p.name)}</h3>
      <p class="muted-sm mb-12">${escapeHtml(p.subtitle)}</p>
      ${p.series.map((s) => `
        <details class="faq-item">
          <summary>${escapeHtml(s.title)}</summary>
          <div class="faq-body">
            <ul>
              ${s.parts.map((pt, i) => `
                <li style="margin-bottom:6px;">
                  <strong>Parte ${i + 1}:</strong> ${escapeHtml(pt)}
                  <button class="btn btn-secondary btn-sm use-cat-part" style="margin-left:6px;padding:2px 8px;font-size:11px;"
                    data-topic="${escapeHtml(pt)}" data-model="${s.modelId}" data-part="${i + 1}">Usar</button>
                </li>`).join('')}
            </ul>
          </div>
        </details>
      `).join('')}
    </div>
  `).join('');

  grid.querySelectorAll('.import-prof-btn').forEach((btn) => {
    btn.addEventListener('click', () => importProfessionForActiveCreator(btn.dataset.prof));
  });

  grid.querySelectorAll('.use-cat-part').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearFactoryFields();
      const bestModelId = detectBestSeriesModelId({
        title: btn.dataset.topic || '',
        suggestedModelId: btn.dataset.model || ''
      });
      document.getElementById('f_modelSelect').value = bestModelId;
      document.getElementById('f_partNumber').value = btn.dataset.part;
      document.getElementById('f_topic').value = btn.dataset.topic;
      updateModelRuleHint();
      switchTab('tab-factory');
      showToast('Ideia enviada para a Fábrica!', 'ok');
    });
  });
}

// ============================================================================
// TAB 6: PLANEJADOR SEMANAL & GUIA DESTRAVA (EXTRA 1)
// ============================================================================

const DAYS = [
  { key: 'seg', label: 'Segunda-feira' },
  { key: 'ter', label: 'Terça-feira' },
  { key: 'qua', label: 'Quarta-feira' },
  { key: 'qui', label: 'Quinta-feira' },
  { key: 'sex', label: 'Sexta-feira' },
  { key: 'sab', label: 'Sábado' },
  { key: 'dom', label: 'Domingo' }
];

function wirePlannerTab() {
  document.getElementById('saveScheduleBtn').addEventListener('click', async () => {
    const cId = getActiveCreator().id;
    const sched = {};
    DAYS.forEach((d) => {
      sched[d.key] = {
        seriesId: document.getElementById(`sch_ser_${d.key}`).value,
        timeSlot: document.getElementById(`sch_time_${d.key}`).value,
        note: document.getElementById(`sch_note_${d.key}`).value
      };
    });
    state.schedule[cId] = sched;
    await persist();
    showToast('Grade semanal de séries salva!', 'ok');
  });
}

function renderWeeklyGrid() {
  const cId = getActiveCreator()?.id;
  const sched = state.schedule?.[cId] || {};
  const series = getCreatorSeries();
  const grid = document.getElementById('weeklyGrid');

  grid.innerHTML = DAYS.map((d) => {
    const item = sched[d.key] || { seriesId: '', timeSlot: '18h00 – 19h30', note: '' };
    return `
      <div class="day-card">
        <h4>${d.label}</h4>
        <div class="form-group">
          <label>Série do Dia</label>
          <select id="sch_ser_${d.key}" class="input">
            <option value="">Pausa / Livre</option>
            ${series.map((s) => `<option value="${s.id}" ${s.id === item.seriesId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Horário Ideal</label>
          <select id="sch_time_${d.key}" class="input">
            ${VIRAL_CODE.bestHours.map((h) => `<option value="${h}" ${h === item.timeSlot ? 'selected' : ''}>${h}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label>Foco / Observação</label>
          <input type="text" id="sch_note_${d.key}" class="input" value="${escapeHtml(item.note)}" placeholder="Ex: Postar Parte X..." />
        </div>
      </div>
    `;
  }).join('');
}

function renderFaqAccordion() {
  const box = document.getElementById('faqAccordion');
  box.innerHTML = EXTRA_1_FAQ.map((item) => `
    <details class="faq-item">
      <summary>${item.num}. ${escapeHtml(item.question)}</summary>
      <div class="faq-body">
        <p><strong>Por que acontece:</strong> ${escapeHtml(item.why)}</p>
        <ul>
          ${item.actions.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}
        </ul>
        <div class="rule-hint" style="margin-bottom:0;">💡 <strong>Lembrete:</strong> ${escapeHtml(item.reminder)}</div>
      </div>
    </details>
  `).join('');
}
