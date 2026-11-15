import { SERIES_MODELS, VIRAL_CODE, PROFESSIONS, EXTRA_1_FAQ } from './data-professions.js';
import {
  uid,
  loadState,
  saveState,
  exportBackupJson,
  syncToGoogleDrive,
  loadFromGoogleDrive
} from './storage.js';
import {
  generateCompleteEpisode,
  generateSeriesIdeas,
  searchHotTopics,
  analyzeScript,
  generateCoverBackground
} from './gemini.js';
import { COVER_TEMPLATES, renderCoverCanvas, downloadDataUrl } from './cover-studio.js';

let state = null;
let currentEditingEpisodeId = null;
let currentCoverBgDataUrl = '';
let lastAnalysisImprovedScript = '';

// Teleprompter state
let tpInterval = null;
let tpFsInterval = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  state = await loadState();

  populateStaticSelects();
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
    await updateCoverPreview();
  }
});

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
  }, 3800);
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
  // Professions selector in Tab 1
  const profSel = document.getElementById('importProfessionSelect');
  profSel.innerHTML = PROFESSIONS.map((p) => `<option value="${p.id}">${p.category} — ${p.name}</option>`).join('');

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

  // Cover Templates
  document.getElementById('cov_template').innerHTML = COVER_TEMPLATES
    .map((t) => `<option value="${t.id}">${t.name}</option>`)
    .join('');

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
  document.querySelectorAll('.subtab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.tab-panel, .card');
      const targetId = btn.dataset.subtab;
      parent.querySelectorAll('.subtab').forEach((b) => b.classList.remove('active'));
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
  if (tabId === 'tab-library') renderSeriesFolders();
  if (tabId === 'tab-planner') renderWeeklyGrid();
}

function refreshAllUI() {
  renderCreatorSelect();
  loadCreatorIntoForm();
  renderFactorySeriesSelect();
  updateModelRuleHint();
  renderSeriesFolders();
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
    aiText.textContent = 'IA: Gemini Conectado';
  } else {
    aiDot.className = 'dot dot-warn';
    aiText.textContent = 'IA: Modo Local (Clique p/ Chave)';
  }

  const driveDot = document.getElementById('driveStatusDot');
  const driveText = document.getElementById('driveStatusText');
  if (state.settings.driveWebhookUrl) {
    driveDot.className = 'dot dot-ok';
    driveText.textContent = 'Drive Conectado';
  } else {
    driveDot.className = 'dot dot-local';
    driveText.textContent = 'Memória & Drive';
  }

  const syncInfo = document.getElementById('driveLastSyncInfo');
  if (state.settings.lastDriveSync) {
    syncInfo.textContent = `Última sincronização: ${new Date(state.settings.lastDriveSync).toLocaleString('pt-BR')}`;
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
    document.getElementById('m_geminiModel').value = state.settings.geminiModel || 'gemini-2.5-flash';
    document.getElementById('aiModal').classList.remove('hidden');
  });

  document.getElementById('saveAiSettingsBtn').addEventListener('click', async () => {
    state.settings.geminiKey = document.getElementById('m_geminiKey').value.trim();
    state.settings.geminiModel = document.getElementById('m_geminiModel').value;
    await persist();
    updateStatusIndicators();
    document.getElementById('aiModal').classList.add('hidden');
    showToast('Configurações do Google Gemini salvas!', 'ok');
  });

  document.getElementById('openDriveModalBtn').addEventListener('click', () => {
    document.getElementById('m_driveUrl').value = state.settings.driveWebhookUrl || '';
    document.getElementById('driveModal').classList.remove('hidden');
  });

  document.getElementById('saveDriveUrlBtn').addEventListener('click', async () => {
    state.settings.driveWebhookUrl = document.getElementById('m_driveUrl').value.trim();
    await persist();
    updateStatusIndicators();
    showToast('URL do Google Drive salva!', 'ok');
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
    const url = document.getElementById('m_driveUrl').value.trim();
    state.settings.driveWebhookUrl = url;
    await persist();
    const btn = document.getElementById('syncDriveNowBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Sincronizando...';
    try {
      const res = await syncToGoogleDrive(state, url);
      state.settings.lastDriveSync = res.syncedAt || new Date().toISOString();
      state.settings.driveFolderUrl = res.folderUrl || '';
      await persist();
      updateStatusIndicators();
      showToast('Salvo na pasta "Reels Lab - Studio" do seu Google Drive!', 'ok');
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '☁️ Salvar no Drive Agora';
    }
  });

  document.getElementById('loadDriveNowBtn').addEventListener('click', async () => {
    const url = document.getElementById('m_driveUrl').value.trim();
    state.settings.driveWebhookUrl = url;
    await persist();
    const btn = document.getElementById('loadDriveNowBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Carregando...';
    try {
      const res = await loadFromGoogleDrive(url);
      if (!res.found || !res.data) {
        showToast('Nenhum backup encontrado no seu Google Drive ainda.', 'err');
      } else {
        state = res.data;
        state.settings.driveWebhookUrl = url;
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

  document.getElementById('saveCreatorBtn').addEventListener('click', async () => {
    const c = getActiveCreator();
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

    await persist();
    renderCreatorSelect();
    await updateCoverPreview();
    showToast('DNA do Criador salvo na memória!', 'ok');
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
      visualStyle: 'Fundo editorial limpo, luz natural'
    });
    state.activeCreatorId = newId;
    await persist();
    refreshAllUI();
    clearFactoryFields();
    showToast('Novo perfil criado! Preencha os dados ou importe uma profissão.', 'ok');
  });

  document.getElementById('deleteCreatorBtn').addEventListener('click', async () => {
    if (state.creators.length <= 1) {
      showToast('Você precisa manter pelo menos 1 perfil de criador.', 'err');
      return;
    }
    const active = getActiveCreator();
    if (!confirm(`Excluir o perfil "${active.name}" e suas séries/roteiros?`)) return;
    state.creators = state.creators.filter((c) => c.id !== active.id);
    state.series = state.series.filter((s) => s.creatorId !== active.id);
    state.episodes = state.episodes.filter((e) => e.creatorId !== active.id);
    state.activeCreatorId = state.creators[0].id;
    await persist();
    refreshAllUI();
    showToast('Perfil removido.', 'ok');
  });

  document.getElementById('applyProfessionBtn').addEventListener('click', async () => {
    const profId = document.getElementById('importProfessionSelect').value;
    await importProfessionForActiveCreator(profId);
  });
}

async function importProfessionForActiveCreator(profId) {
  const prof = PROFESSIONS.find((p) => p.id === profId);
  if (!prof) return;
  const creator = getActiveCreator();

  creator.professionId = prof.id;
  if (!creator.niche) creator.niche = prof.name;
  creator.niche = `${prof.name} (${prof.category})`;
  creator.positioning = prof.subtitle;

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
        color: creator.brandColor || '#EC4899',
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
  showToast(`Profissão "${prof.name}" aplicada e ${importedSeriesCount} séries importadas para suas Pastas!`, 'ok');
}

// ============================================================================
// TAB 2: RADAR DE TEMAS QUENTES (TIMING + NOTÍCIAS)
// ============================================================================

function wireRadarTab() {
  document.getElementById('searchTrendsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('searchTrendsBtn');
    const query = document.getElementById('radarQueryInput').value.trim();
    btn.disabled = true;
    btn.innerHTML = '⏳ Pesquisando tendências &amp; conectando ao seu nicho...';

    try {
      const result = await searchHotTopics({
        creator: getActiveCreator(),
        focusQuery: query,
        apiKey: state.settings.geminiKey,
        modelName: state.settings.geminiModel
      });

      const cId = getActiveCreator().id;
      state.hotTopicsCache[cId] = result;
      await persist();
      renderCachedHotTopics();
      showToast('Radar atualizado com sugestões virais!', 'ok');
    } catch (err) {
      showToast(`Erro no Radar: ${err.message}`, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>🔍 Buscar Notícias &amp; Gerar Ângulos Virais</span>';
    }
  });
}

function renderCachedHotTopics() {
  const cId = getActiveCreator()?.id;
  const cached = state.hotTopicsCache?.[cId];
  const container = document.getElementById('radarResults');
  const banner = document.getElementById('radarStatusBanner');
  const sourcesBox = document.getElementById('radarSources');

  if (!cached || !cached.topics?.length) {
    banner.classList.add('hidden');
    sourcesBox.classList.add('hidden');
    container.innerHTML = `
      <div class="card">
        <h3>Pronto para caçar assuntos quentes 🔥</h3>
        <p class="muted-sm mt-6">Clique no botão acima para a IA cruzar notícias de hoje e tendências virais com o DNA de <strong>${escapeHtml(getActiveCreator()?.name)}</strong>.</p>
      </div>`;
    return;
  }

  banner.classList.remove('hidden');
  banner.innerHTML = `📡 <strong>Fonte:</strong> ${escapeHtml(cached.generatedBy || 'IA')} — Clique em <em>"Criar na Fábrica"</em> em qualquer ângulo abaixo para gerar roteiro, capa e legenda prontos.`;

  container.innerHTML = cached.topics.map((topic, tIdx) => `
    <div class="card trend-card">
      <div>
        <span class="badge-pill">TIMING QUENTE #${tIdx + 1}</span>
        <h3 class="mt-8">${escapeHtml(topic.trendTitle)}</h3>
        <p class="muted-sm mt-6">${escapeHtml(topic.timingWhy)}</p>
        <div class="rule-hint mt-8">🎯 <strong>Ponte para sua bolha:</strong> ${escapeHtml(topic.bubbleBridge)}</div>
      </div>
      <div>
        ${(topic.angles || []).map((ang) => {
          const funnelTag = ang.funnel === 'fundo' ? 'tag-fundo' : ang.funnel === 'meio' ? 'tag-meio' : 'tag-topo';
          const funnelLabel = ang.funnel === 'fundo' ? 'FUNDO (Venda)' : ang.funnel === 'meio' ? 'MEIO (Conexão)' : 'TOPO (Alcance <30s)';
          return `
            <div class="angle-item">
              <span class="angle-tag ${funnelTag}">${funnelLabel}</span>
              <div class="muted-sm" style="color:#fff;font-weight:600;">${escapeHtml(ang.title)}</div>
              <button class="btn btn-secondary btn-sm mt-6 use-trend-btn"
                data-title="${escapeHtml(ang.title)}"
                data-model="${escapeHtml(ang.modelId || 'codigo_viral')}"
                data-funnel="${escapeHtml(ang.funnel || 'topo')}"
                data-bridge="${escapeHtml(topic.bubbleBridge || '')}">
                🎬 Criar na Fábrica
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.use-trend-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      clearFactoryFields();
      document.getElementById('f_modelSelect').value = btn.dataset.model;
      document.getElementById('f_funnelStage').value = btn.dataset.funnel;
      document.getElementById('f_topic').value = btn.dataset.title;
      document.getElementById('f_qProblem').value = btn.dataset.bridge;
      updateModelRuleHint();
      switchTab('tab-factory');
      showToast('Tema enviado para a Fábrica! Clique em "Gerar Pacote Completo".', 'ok');
    });
  });

  if (cached.sources && cached.sources.length) {
    sourcesBox.classList.remove('hidden');
    sourcesBox.innerHTML = `<strong>🔗 Fontes consultadas no Google:</strong> ` +
      cached.sources.slice(0, 6).map((s) => `<a href="${escapeHtml(s.uri)}" target="_blank" rel="noopener">${escapeHtml(s.title || s.uri)}</a>`).join(' • ');
  } else {
    sourcesBox.classList.add('hidden');
  }
}

// ============================================================================
// TAB 3: FÁBRICA DE SÉRIES & ROTEIROS + ESTÚDIO DE CAPA 9:16
// ============================================================================

function renderFactorySeriesSelect() {
  const sel = document.getElementById('f_seriesSelect');
  const series = getCreatorSeries();
  if (!series.length) {
    sel.innerHTML = `<option value="">-- Crie sua primeira série --</option>`;
  } else {
    sel.innerHTML = series.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  }
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
  document.getElementById('f_modelSelect').addEventListener('change', updateModelRuleHint);

  document.getElementById('f_seriesSelect').addEventListener('change', (e) => {
    const serie = state.series.find((s) => s.id === e.target.value);
    if (serie) {
      document.getElementById('f_modelSelect').value = serie.modelId || 'serie_01';
      updateModelRuleHint();
      // Auto-suggest next part number
      const eps = state.episodes.filter((ep) => ep.seriesId === serie.id);
      const maxPart = eps.reduce((max, ep) => Math.max(max, Number(ep.partNumber) || 0), 0);
      document.getElementById('f_partNumber').value = maxPart + 1;
      document.getElementById('cov_seriesLabel').value = serie.name;
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
      color: getActiveCreator().brandColor || '#EC4899',
      createdAt: new Date().toISOString()
    });
    await persist();
    renderFactorySeriesSelect();
    document.getElementById('f_seriesSelect').value = newId;
    document.getElementById('f_modelSelect').value = modelId;
    document.getElementById('f_partNumber').value = 1;
    document.getElementById('cov_seriesLabel').value = name;
    document.getElementById('ns_name').value = '';
    document.getElementById('newSeriesBox').classList.add('hidden');
    updateModelRuleHint();
    updateCoverPreview();
    showToast(`Pasta "${name}" criada!`, 'ok');
  });

  // Suggest 5 Part ideas
  document.getElementById('suggestIdeasBtn').addEventListener('click', async () => {
    const btn = document.getElementById('suggestIdeasBtn');
    const box = document.getElementById('ideasSuggestionBox');
    btn.disabled = true;
    btn.textContent = '⏳ Gerando ideias...';
    try {
      const seriesId = document.getElementById('f_seriesSelect').value;
      const serie = state.series.find((s) => s.id === seriesId);
      const existingTitles = state.episodes.filter((e) => e.seriesId === seriesId).map((e) => e.title);
      const res = await generateSeriesIdeas({
        creator: getActiveCreator(),
        modelId: document.getElementById('f_modelSelect').value,
        seriesName: serie?.name || 'Minha Série',
        existingTitles,
        apiKey: state.settings.geminiKey,
        modelName: state.settings.geminiModel
      });

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
          box.classList.add('hidden');
        });
      });
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '💡 Sugerir 5 Ideias de Partes';
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
    const canvas = document.getElementById('coverCanvas');
    // Render without safe-zone guides for clean PNG export
    const exportUrl = await renderCoverCanvas(canvas, {
      ...getCoverOptions(),
      showSafeZone: false
    });
    const part = document.getElementById('f_partNumber').value || 1;
    downloadDataUrl(exportUrl, `capa-reels-parte-${part}.png`);
    // Restore preview with current checkbox
    await updateCoverPreview();
    showToast('Capa 1080×1920 PNG baixada!', 'ok');
  });

  // Save Episode into Series Folder
  document.getElementById('saveEpisodeBtn').addEventListener('click', saveCurrentEpisode);
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
  btn.disabled = true;
  btn.textContent = '⏳ Gerando roteiro, capa, legenda e prompt IA...';

  try {
    let seriesId = document.getElementById('f_seriesSelect').value;
    if (!seriesId) {
      // Auto-create default series folder if none exists
      const mId = document.getElementById('f_modelSelect').value;
      const mObj = SERIES_MODELS.find((m) => m.id === mId) || SERIES_MODELS[0];
      seriesId = uid('serie');
      state.series.push({
        id: seriesId,
        creatorId: getActiveCreator().id,
        name: mObj.shortName,
        modelId: mId,
        color: getActiveCreator().brandColor || '#EC4899',
        createdAt: new Date().toISOString()
      });
      renderFactorySeriesSelect();
      document.getElementById('f_seriesSelect').value = seriesId;
    }

    const serie = state.series.find((s) => s.id === seriesId);
    const partNumber = Number(document.getElementById('f_partNumber').value) || 1;
    const modelId = document.getElementById('f_modelSelect').value;

    const generated = await generateCompleteEpisode({
      creator: getActiveCreator(),
      modelId,
      seriesName: serie?.name || 'Minha Série',
      partNumber,
      topic: document.getElementById('f_topic').value.trim(),
      funnelStage: document.getElementById('f_funnelStage').value,
      viralGoal: document.getElementById('f_viralGoal').value,
      validation: {
        problem: document.getElementById('f_qProblem').value.trim(),
        learn: document.getElementById('f_qLearn').value.trim(),
        lifeChange: document.getElementById('f_qLifeChange').value.trim()
      },
      apiKey: state.settings.geminiKey,
      modelName: state.settings.geminiModel
    });

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
    document.getElementById('cov_seriesLabel').value = serie?.name || 'SÉRIE';

    updateScriptTimerBadge();
    await updateCoverPreview();
    showToast(`Pacote gerado via ${generated.generatedBy}!`, 'ok');
  } catch (err) {
    showToast(`Erro ao gerar roteiro: ${err.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '⚡ Gerar Pacote Completo & Viral';
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
  const text = document.getElementById('o_script').value || '';
  const words = text.replace(/\[.*?\]/g, '').trim().split(/\s+/).filter(Boolean).length;
  const secs = Math.round(words / 2.3);
  const badge = document.getElementById('scriptTimerBadge');
  badge.textContent = `~${words} palavras • ~${secs}s`;
  badge.style.color = secs > 60 ? '#fca5a5' : '#ddd6fe';
}

function getCoverOptions() {
  const seriesId = document.getElementById('f_seriesSelect').value;
  const serie = state.series.find((s) => s.id === seriesId);
  const creator = getActiveCreator();

  return {
    headline: document.getElementById('cov_headline').value || document.getElementById('o_selectedHeadline').value || document.getElementById('o_title').value || 'HEADLINE VIRAL DO SEU REELS',
    seriesName: document.getElementById('cov_seriesLabel').value || serie?.name || 'SÉRIE',
    partNumber: Number(document.getElementById('f_partNumber').value) || 1,
    handle: creator?.handle || '@seuperfil',
    accentColor: creator?.brandColor || '#EC4899',
    templateId: document.getElementById('cov_template').value || 'gradient_glow',
    bgDataUrl: currentCoverBgDataUrl,
    showSafeZone: document.getElementById('cov_safeZoneToggle').checked
  };
}

async function updateCoverPreview() {
  const canvas = document.getElementById('coverCanvas');
  if (!canvas) return;
  await renderCoverCanvas(canvas, getCoverOptions());
}

async function saveCurrentEpisode() {
  const seriesId = document.getElementById('f_seriesSelect').value;
  if (!seriesId) {
    showToast('Selecione ou crie uma pasta de série antes de salvar.', 'err');
    return;
  }

  const canvas = document.getElementById('coverCanvas');
  const cleanCoverUrl = await renderCoverCanvas(canvas, { ...getCoverOptions(), showSafeZone: false });
  await updateCoverPreview();

  const existing = currentEditingEpisodeId ? state.episodes.find((e) => e.id === currentEditingEpisodeId) : null;
  const chips = Array.from(document.querySelectorAll('#headlinesChips .headline-chip')).map((c) => c.dataset.hl);
  const selectedHl = document.getElementById('o_selectedHeadline').value.trim();
  const headlines = chips.length ? chips : (selectedHl ? [selectedHl] : []);

  const payload = {
    id: existing ? existing.id : uid('ep'),
    creatorId: getActiveCreator().id,
    seriesId,
    partNumber: Number(document.getElementById('f_partNumber').value) || 1,
    title: document.getElementById('o_title').value.trim() || document.getElementById('f_topic').value.trim() || 'Episódio sem título',
    onScreenText: document.getElementById('o_onScreenText').value.trim(),
    headlines,
    funnelStage: document.getElementById('f_funnelStage').value,
    viralGoal: document.getElementById('f_viralGoal').value,
    status: document.getElementById('o_status').value,
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
  renderSeriesFolders();
  showToast('Episódio + Capa 9:16 salvos na Pasta da Série!', 'ok');
}

function loadEpisodeIntoFactory(ep) {
  currentEditingEpisodeId = ep.id;
  currentCoverBgDataUrl = ep.coverBgDataUrl || '';

  const serie = state.series.find((s) => s.id === ep.seriesId);
  if (serie) {
    document.getElementById('f_seriesSelect').value = serie.id;
    document.getElementById('f_modelSelect').value = serie.modelId || 'serie_01';
    updateModelRuleHint();
  }
  document.getElementById('f_partNumber').value = ep.partNumber || 1;
  document.getElementById('f_topic').value = ep.title || '';
  document.getElementById('f_funnelStage').value = ep.funnelStage || 'topo';
  document.getElementById('f_viralGoal').value = ep.viralGoal || 'share';
  document.getElementById('f_qProblem').value = ep.validation?.problem || '';
  document.getElementById('f_qLearn').value = ep.validation?.learn || '';
  document.getElementById('f_qLifeChange').value = ep.validation?.lifeChange || '';

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
  document.getElementById('cov_seriesLabel').value = serie?.name || 'SÉRIE';

  updateScriptTimerBadge();
  updateCoverPreview();
}

function clearFactoryFields() {
  currentEditingEpisodeId = null;
  currentCoverBgDataUrl = '';
  const seriesId = document.getElementById('f_seriesSelect').value;
  const serie = state.series.find((s) => s.id === seriesId);
  const eps = state.episodes.filter((ep) => ep.seriesId === seriesId);
  const maxPart = eps.reduce((m, e) => Math.max(m, Number(e.partNumber) || 0), 0);

  document.getElementById('f_partNumber').value = maxPart + 1;
  document.getElementById('f_topic').value = '';
  document.getElementById('f_qProblem').value = '';
  document.getElementById('f_qLearn').value = '';
  document.getElementById('f_qLifeChange').value = '';
  document.getElementById('o_title').value = '';
  document.getElementById('o_status').value = 'roteiro';
  document.getElementById('o_onScreenText').value = serie ? `${serie.name} • Parte ${maxPart + 1}` : '';
  document.getElementById('o_script').value = '';
  document.getElementById('o_caption').value = '';
  document.getElementById('o_editingPrompt').value = '';
  document.getElementById('o_coverImagePrompt').value = '';
  document.getElementById('headlinesChips').innerHTML = '';
  document.getElementById('o_selectedHeadline').value = '';
  document.getElementById('cov_headline').value = '';
  document.getElementById('cov_seriesLabel').value = serie?.name || '';
  updateScriptTimerBadge();
  updateCoverPreview();
}

// ============================================================================
// TAB 4: CLUBE DE ANÁLISE IA & TELEPROMPTER
// ============================================================================

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
    btn.disabled = true;
    btn.textContent = '⏳ Analisando com olhar do Clube...';

    try {
      const res = await analyzeScript({
        script,
        creator: getActiveCreator(),
        modelId: document.getElementById('f_modelSelect').value,
        apiKey: state.settings.geminiKey,
        modelName: state.settings.geminiModel
      });

      document.getElementById('clubResultBox').classList.remove('hidden');
      document.getElementById('clubScoreValue').textContent = `${res.score}%`;
      const badge = document.getElementById('clubScoreBadge');
      badge.textContent = res.score >= 70 ? '✅ Passou no Filtro 70% — Pode Gravar!' : '⚠️ Abaixo de 70% — Ajuste antes de gravar';
      document.getElementById('clubVerdict').textContent = `${res.verdict} (${res.generatedBy})`;

      document.getElementById('clubKeepList').innerHTML = (res.keep || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
      document.getElementById('clubAdjustList').innerHTML = (res.adjust || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
      document.getElementById('clubBlockerList').innerHTML = (res.blockers || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
      lastAnalysisImprovedScript = res.improvedScript || script;
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      btn.disabled = false;
      btn.textContent = '🔎 Analisar Roteiro Agora';
    }
  });

  document.getElementById('applyClubFixBtn').addEventListener('click', () => {
    if (!lastAnalysisImprovedScript) return;
    document.getElementById('club_scriptInput').value = lastAnalysisImprovedScript;
    document.getElementById('o_script').value = lastAnalysisImprovedScript;
    updateScriptTimerBadge();
    updateTeleprompterText(lastAnalysisImprovedScript);
    showToast('Roteiro otimizado aplicado na Fábrica e Teleprompter!', 'ok');
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

function renderSeriesFolders() {
  const grid = document.getElementById('seriesFoldersGrid');
  const detail = document.getElementById('seriesDetailPanel');
  const series = getCreatorSeries();

  if (!series.length) {
    grid.innerHTML = `<div class="card"><h3>Nenhuma pasta de série ainda</h3><p class="muted-sm mt-6">Crie uma série na Fábrica de Roteiros ou importe uma profissão no DNA do Criador.</p></div>`;
    detail.classList.add('hidden');
    return;
  }

  grid.innerHTML = series.map((s) => {
    const eps = state.episodes.filter((e) => e.seriesId === s.id);
    const model = SERIES_MODELS.find((m) => m.id === s.modelId);
    const pct = Math.min(100, Math.round((eps.length / 15) * 100));
    return `
      <div class="card series-card" style="border-top-color:${escapeHtml(s.color || '#EC4899')}" data-series-id="${s.id}">
        <div class="label-between">
          <span class="badge-pill">${escapeHtml(model?.code || 'Série')}</span>
          <span class="muted-xs">${eps.length} / 15 partes</span>
        </div>
        <h3 class="mt-8">📁 ${escapeHtml(s.name)}</h3>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="muted-xs">${eps.length >= 15 ? '🏆 Meta de consistência (15 partes) atingida!' : `Faltam ${15 - eps.length} partes p/ maturidade do algoritmo`}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.series-card').forEach((card) => {
    card.addEventListener('click', () => openSeriesDetail(card.dataset.seriesId));
  });
}

function openSeriesDetail(seriesId) {
  const serie = state.series.find((s) => s.id === seriesId);
  if (!serie) return;
  const detail = document.getElementById('seriesDetailPanel');
  const eps = state.episodes
    .filter((e) => e.seriesId === seriesId)
    .sort((a, b) => (a.partNumber || 0) - (b.partNumber || 0));
  const nextPart = eps.reduce((m, e) => Math.max(m, Number(e.partNumber) || 0), 0) + 1;

  detail.classList.remove('hidden');
  detail.innerHTML = `
    <div class="card-row mb-12">
      <div>
        <h3>📂 Pasta: ${escapeHtml(serie.name)}</h3>
        <p class="muted-sm">${eps.length} episódio(s) salvo(s)</p>
      </div>
      <div class="inline-controls">
        <button id="createNextPartBtn" class="btn btn-gradient btn-sm">➕ Criar Parte ${nextPart}</button>
        <button id="deleteSeriesBtn" class="btn btn-danger-outline btn-sm">🗑️ Excluir Pasta</button>
      </div>
    </div>
    ${eps.length ? eps.map((ep) => `
      <div class="episode-row">
        <div class="inline-controls" style="gap:12px;">
          ${ep.coverDataUrl ? `<img class="ep-thumb" src="${ep.coverDataUrl}" alt="Capa" />` : `<div class="ep-thumb" style="display:grid;place-items:center;font-size:11px;color:#94a3b8;">P.${ep.partNumber}</div>`}
          <div>
            <strong>Parte ${ep.partNumber}: ${escapeHtml(ep.title)}</strong>
            <div class="muted-xs mt-6">Status: <strong>${escapeHtml(ep.status || 'roteiro')}</strong> • ${ep.script ? 'Roteiro pronto' : 'Ideia aguardando geração'}</div>
          </div>
        </div>
        <div class="inline-controls">
          <button class="btn btn-primary btn-sm open-ep-btn" data-id="${ep.id}">✏️ Abrir / Gerar</button>
          <button class="btn btn-danger-outline btn-sm del-ep-btn" data-id="${ep.id}">✕</button>
        </div>
      </div>
    `).join('') : `<p class="muted-sm">Nenhum episódio nesta pasta ainda.</p>`}
  `;

  document.getElementById('createNextPartBtn').addEventListener('click', () => {
    document.getElementById('f_seriesSelect').value = serie.id;
    document.getElementById('f_modelSelect').value = serie.modelId;
    clearFactoryFields();
    document.getElementById('f_partNumber').value = nextPart;
    updateModelRuleHint();
    switchTab('tab-factory');
  });

  document.getElementById('deleteSeriesBtn').addEventListener('click', async () => {
    if (!confirm(`Excluir a pasta "${serie.name}" e todos os seus episódios?`)) return;
    state.series = state.series.filter((s) => s.id !== serie.id);
    state.episodes = state.episodes.filter((e) => e.seriesId !== serie.id);
    await persist();
    detail.classList.add('hidden');
    renderFactorySeriesSelect();
    renderSeriesFolders();
    showToast('Pasta excluída.', 'ok');
  });

  detail.querySelectorAll('.open-ep-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ep = state.episodes.find((e) => e.id === btn.dataset.id);
      if (ep) {
        loadEpisodeIntoFactory(ep);
        switchTab('tab-factory');
      }
    });
  });

  detail.querySelectorAll('.del-ep-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      state.episodes = state.episodes.filter((e) => e.id !== btn.dataset.id);
      await persist();
      openSeriesDetail(seriesId);
      renderSeriesFolders();
      showToast('Episódio removido.', 'ok');
    });
  });

  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
      document.getElementById('f_modelSelect').value = btn.dataset.model;
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
