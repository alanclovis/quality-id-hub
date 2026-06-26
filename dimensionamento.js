/**
 * Dimensionamento ID Quality/Csat — cliente Hub + ponte Apps Script
 */
(function (global) {
  'use strict';

  const DIM_DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex'];
  const DIM_DAY_LABELS = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex' };
  const DIM_FULL_DAY_NAMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta'];
  const DIM_KEY_TO_FULL = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta' };
  const DIM_DETAIL_REQUIRES_PROJECT = {
    'Planilha': true, 'Deep Dive': true, 'Docs': true, 'Playbook': true, 'RFC': true, 'Slides': true,
    'Project Meet': true, 'Databricks': true, 'Quicksight': true
  };

  /** Espelha Config_Slots.html — slots que exigem personalização em Base_Detalhes */
  const DIM_DETAIL_SLOTS = [
    'Planilha', 'Deep Dive', 'Docs', 'Playbook', 'RFC', 'Slides',
    'Jira/Atlassian', 'Drive', 'Project Meet', 'Databricks', 'Quicksight'
  ];

  const DIM_PROJECTS_DEFAULT = [
    'Calibration', 'Contingência', 'Dimensionamento', 'Drive', 'Inv. Brain', 'Insights Roda de conversa',
    'Jira (contestação/apontamento externo)', 'Macros', 'Métricas',
    'Onboarding', 'NPS', 'SPOT', 'Query & Dashboards', 'Scorecards', 'Quality Engagement', 'NMP (Projeto não mapeado)'
  ];

  const DIM_SLOT_DETAIL_CONFIG = {
    'Planilha': {
      actions: ['Atualização de dados', 'Atualização IDP', 'Criação de nova planilha', 'Estudo de dados', 'Extração / Coleta de dados', 'Dimensionamento', 'Revisão de dados', 'Script em Planilha', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    },
    'Deep Dive': {
      actions: ['Investigação de caso', 'Coleta e extração de dados', 'Elaboração de resultados/insights', 'Estudo de caso', 'Criação de dashboard', 'Revisão de Dados', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    },
    'Docs': {
      actions: ['Criação de novo documento', 'Atualização de conteúdo existente', 'Revisão / Comentários / Sugestões', 'Tradução de conteúdo', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    },
    'Playbook': {
      actions: ['Criação / Estruturação', 'Revisão / Validação de Conteúdo', 'Coleta / Incorporação de Feedback', 'Tradução / Adaptação de Conteúdo', 'Reformatação / Ajuste de Layout', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    },
    'RFC': {
      actions: ['Escrita da proposta inicial', 'Pesquisa de embasamento / dados', 'Coleta de feedbacks', 'Apresentação', 'Documentação da versão final', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    },
    'Slides': {
      actions: ['Criação de nova apresentação', 'Atualização de dados', 'Ajuste de layout / Template', 'Revisão de conteúdo', 'Criação de material', 'Preparação para reunião', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    },
    'Jira/Atlassian': {
      actions: ['Ajuste de Formulário / Tipo de Solicitação', 'Atualização de status', 'Acompanhamento de Épico', 'Criação / Ajuste de Automação', 'Criação de tarefas', 'Configuração de board (colunas, filtros)', 'Descrição / Detalhamento de história', 'Priorização de backlog', 'Gestão de Sprint', 'Criação de Dashboard no Jira', 'Outro'],
      hasProjectField: false
    },
    'Drive': {
      actions: ['Criação / Estruturação de novas pastas', 'Reorganização / Movimentação de arquivos e pastas', 'Ajuste / Gerenciamento de permissões de acesso', 'Padronização de nomenclatura (pastas/arquivos)', 'Upload / Inclusão de novos materiais', 'Limpeza / Arquivamento de arquivos antigos', 'Criação / Configuração de Drives Compartilhados', 'Outro'],
      hasProjectField: false
    },
    'Project Meet': {
      actions: ['Apresentação de Resultados', 'Reunião de alinhamento', 'Reunião de Kick-off', 'Reunião de Planejamento', 'Reunião de Retrospectiva', 'Reunião com outros times', 'Reunião de Brainstorming', 'Reunião de Resolução de Problemas', 'Reunião de testes', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    },
    'Databricks': {
      actions: ['Criação de Notebook', 'Manutenção de Notebook', 'Análise de Dados', 'Criação de Dashboard', 'Treinamento', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    },
    'Quicksight': {
      actions: ['Criação de novo Dashboard', 'Atualização / Manutenção de Dashboard existente', 'Criação / Atualização de Conjunto de Dados (Dataset)', 'Criação / Ajuste de Visual (Gráfico, Tabela)', 'Validação de Dados / Consistência do Dashboard', 'Análise exploratória na ferramenta', 'Outro'],
      projects: DIM_PROJECTS_DEFAULT,
      hasProjectField: true
    }
  };

  const dimState = {
    week: null,
    schedule: null,
    dictionary: null,
    session: null,
    bridgeReady: false,
    pendingSaves: {},
    saveQueue: [],
    saveFailMeta: {},
    saving: false,
    undo: null,
    undoTimer: null,
    reloadTimer: null,
    editingCell: false,
    modalOpen: false,
    activeTab: 'escala',
    dropdown: null,
    pendingList: [],
    adjustmentsList: [],
    ajustesSearch: '',
    detailDraft: null,
    clearDraft: null,
    applyDraft: null,
    bridgePopup: null,
    slotOptionsFallback: null,
    dictionaryFallback: null,
    selection: [],
    selectionAnchor: null,
    selectDrag: false,
    selectDragMoved: false,
    gridSelectBound: false,
    loadingWeek: false,
    loadWeekSeq: 0,
    lastUpdate: null,
    gridZoom: 100,
    applyConfirmOvertime: false,
    detailConfirmOvertime: false,
    keyboardBound: false,
    gridScrollBound: false,
    weekMenuBound: false,
    warming: false,
    warmupDone: false,
    refreshingWeek: false,
    silentLoadCount: 0,
    initInProgress: false,
    detailSaving: false
  };

  const DIM_WEEK_CACHE_TTL = 21600000; // 6h
  const DIM_WEEK_CACHE_VERSION = 3;
  const DIM_SESSION_TTL = 28800000; // 8h
  const DIM_GAS_EXEC_URL = 'https://script.google.com/a/macros/nubank.com.br/s/AKfycbx-u7kAIC9GsR8GO0X8zQzjwyrZlFi-HdNtjJsHkmJNItx5ivvvjd0EAExL6PEkuGVo/exec';
  const DIM_GAS_LEGACY_DEPLOY_IDS = [
    'AKfycbzj23vyenWabiFcDlqiT8-cFo4yt9UzZ0OYs8qOWpYfEonZYPUeaiE9UaCVdg13HVz1',
    'AKfycbw2KPsVk5lx50rEIcTn3suoBpZK0OsmkI_6phatgf1vB6IXpIgqZM_OJzGJieSj_2b5'
  ];

  function dimNormalizeBridgeUrl(url) {
    const v = String(url || '').trim();
    if (!v) return DIM_GAS_EXEC_URL;
    for (let i = 0; i < DIM_GAS_LEGACY_DEPLOY_IDS.length; i++) {
      if (v.indexOf(DIM_GAS_LEGACY_DEPLOY_IDS[i]) >= 0) return DIM_GAS_EXEC_URL;
    }
    return v;
  }

  function dimBootstrapSessionFromHub() {
    const email = dimGetCacheEmail();
    if (!email) return false;
    if (!dimState.session || !dimState.session.email) {
      dimState.session = {
        email: email,
        analystKey: email.split('@')[0],
        isLeader: false,
        fromHub: true
      };
      dimSaveSession(dimState.session);
    }
    dimState.bridgeReady = true;
    return true;
  }

  function dimLoadDictionaryFallback() {
    if (dimState.dictionaryFallback) {
      return Promise.resolve(dimState.dictionaryFallback);
    }
    return fetch('dim-slot-dictionary.json')
      .then(function (r) {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then(function (data) {
        dimState.dictionaryFallback = data && data.items ? data : { items: [] };
        return dimState.dictionaryFallback;
      })
      .catch(function () {
        dimState.dictionaryFallback = { items: [] };
        return dimState.dictionaryFallback;
      });
  }

  function dimMergeDictionary(apiItems, staticItems) {
    const map = new Map();
    (staticItems || []).forEach(function (it) {
      const key = String(it.tipoSlot || '').toLowerCase();
      if (key) map.set(key, it);
    });
    (apiItems || []).forEach(function (it) {
      const key = String(it.tipoSlot || '').toLowerCase();
      if (key) map.set(key, it);
    });
    const items = Array.from(map.values());
    items.sort(function (a, b) {
      const act = String(a.atividade || '').localeCompare(String(b.atividade || ''), 'pt-BR');
      if (act !== 0) return act;
      return String(a.tipoSlot || '').localeCompare(String(b.tipoSlot || ''), 'pt-BR');
    });
    return { items: items, categories: [] };
  }

  function dimEnsureDictionary() {
    return Promise.all([
      dimLoadDictionaryFallback(),
      dimCall('getSlotDictionary', {}).catch(function () { return { items: [] }; })
    ]).then(function (results) {
      const fbItems = (results[0] && results[0].items) || [];
      const apiItems = (results[1] && results[1].items) || [];
      dimState.dictionary = dimMergeDictionary(apiItems, fbItems);
      return dimState.dictionary;
    });
  }

  function dimSlotBadgeHtml(tipo) {
    const col = dimColorFor(tipo);
    return '<span class="dim-slot-badge" style="' + dimCellStyle(col) + '">' + escapeHtml(tipo) + '</span>';
  }

  function dimFormatDictionaryText(text) {
    const t = String(text || '').trim();
    if (!t) return '—';
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  }

  function dimLoadSlotOptionsFallback() {
    if (dimState.slotOptionsFallback) {
      return Promise.resolve(dimState.slotOptionsFallback);
    }
    return fetch('dim-slot-options.json')
      .then(function (r) {
        if (!r.ok) throw new Error('fetch failed');
        return r.json();
      })
      .then(function (list) {
        dimState.slotOptionsFallback = Array.isArray(list) ? list : [];
        return dimState.slotOptionsFallback;
      })
      .catch(function () {
        dimState.slotOptionsFallback = [];
        return dimState.slotOptionsFallback;
      });
  }

  function dimGetSlotOptions() {
    const fromConfig = (dimState.schedule && dimState.schedule.config && dimState.schedule.config.slotOptions) || [];
    if (fromConfig.length) return fromConfig.slice();
    if (dimState.slotOptionsFallback && dimState.slotOptionsFallback.length) {
      return dimState.slotOptionsFallback.slice();
    }
    if (dimState.dictionary && dimState.dictionary.items) {
      const seen = {};
      const out = [];
      dimState.dictionary.items.forEach(function (it) {
        const t = it.tipoSlot || it.atividade;
        if (t && !seen[t]) {
          seen[t] = true;
          out.push(t);
        }
      });
      if (out.length) return out;
    }
    return [];
  }

  function dimEnsureSlotOptions(schedule) {
    if (!schedule.config) schedule.config = {};
    if (!schedule.config.slotOptions || !schedule.config.slotOptions.length) {
      schedule.config.slotOptions = dimGetSlotOptions();
    }
  }

  function dimGetBridgeTarget() {
    const frame = document.getElementById('dimBridgeFrame');
    if (frame && frame.src && frame.src.indexOf('view=bridge') >= 0) {
      try {
        if (frame.contentWindow) return frame.contentWindow;
      } catch (e) { /* cross-origin */ }
    }
    if (dimState.bridgePopup && !dimState.bridgePopup.closed) {
      return dimState.bridgePopup;
    }
    return null;
  }

  function dimOpenBridgePopup() {
    const url = dimBridgeBaseUrl();
    if (!url) return null;
    if (dimState.bridgePopup && !dimState.bridgePopup.closed) {
      dimState.bridgePopup.focus();
      return dimState.bridgePopup;
    }
    dimState.bridgePopup = window.open(url, 'dimBridgeAuth', 'width=520,height=360');
    return dimState.bridgePopup;
  }

  function dimGetBridgeUrl() {
    let raw = '';
    if (typeof data !== 'undefined' && data.dimensionamento && data.dimensionamento.bridgeUrl) {
      raw = String(data.dimensionamento.bridgeUrl).trim();
    } else {
      raw = (localStorage.getItem('qhub_dim_bridge_url') || '').trim();
    }
    const normalized = dimNormalizeBridgeUrl(raw);
    if (normalized !== raw && normalized) {
      if (typeof dimSetBridgeUrl === 'function') dimSetBridgeUrl(normalized);
      else try { localStorage.setItem('qhub_dim_bridge_url', normalized); } catch (e) { /* ignore */ }
    }
    return normalized;
  }

  function dimSetBridgeUrl(url) {
    const v = dimNormalizeBridgeUrl(url);
    localStorage.setItem('qhub_dim_bridge_url', v);
    if (typeof data !== 'undefined') {
      if (!data.dimensionamento) data.dimensionamento = {};
      data.dimensionamento.bridgeUrl = v;
      if (typeof saveLocal === 'function') saveLocal();
    }
  }

  function dimHubReturnUrl() {
    return global.location.origin + global.location.pathname;
  }

  function dimBridgeBaseUrl() {
    const raw = dimGetBridgeUrl();
    if (!raw) return '';
    let url = raw;
    if (url.indexOf('view=bridge') < 0) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'view=bridge';
    }
    if (url.indexOf('hubReturn=') < 0) {
      url += '&hubReturn=' + encodeURIComponent(dimHubReturnUrl());
    }
    return url;
  }

  function dimSaveSession(session) {
    try {
      localStorage.setItem('qhub_dim_session', JSON.stringify({ session: session, ts: Date.now() }));
    } catch (e) { /* ignore */ }
  }

  function dimReadStoredSession() {
    try {
      const raw = localStorage.getItem('qhub_dim_session');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.session) return null;
      if (parsed.ts && Date.now() - parsed.ts > DIM_SESSION_TTL) return null;
      return parsed.session;
    } catch (e) {
      return null;
    }
  }

  function dimInferNubankEmail(nameOrKey) {
    const raw = String(nameOrKey || '').trim().toLowerCase();
    if (!raw) return '';
    if (raw.indexOf('@') >= 0) return raw;
    const key = raw.replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
    if (!key || key.indexOf('.') < 0) return '';
    return key + '@nubank.com.br';
  }

  function dimMemberEmailStorageKey() {
    const uid = localStorage.getItem('qhub_user_id');
    if (uid && uid !== 'visitor') return 'qhub_member_email_' + uid;
    if (typeof getUserName === 'function') {
      const name = getUserName();
      if (name) return 'qhub_member_email_' + String(name).trim().toLowerCase().replace(/\s+/g, '_');
    }
    return '';
  }

  function dimReadMemberEmailLocal() {
    const key = dimMemberEmailStorageKey();
    if (!key) return '';
    try { return (localStorage.getItem(key) || '').trim().toLowerCase(); } catch (e) { return ''; }
  }

  function dimGetCacheEmail() {
    const fromLocal = dimReadMemberEmailLocal();
    if (fromLocal) return fromLocal;
    if (dimState.session && dimState.session.email) {
      return dimState.session.email.toLowerCase();
    }
    const stored = dimReadStoredSession();
    if (stored && stored.email) return stored.email.toLowerCase();
    const uid = localStorage.getItem('qhub_user_id');
    if (uid && typeof getAccessUserById === 'function') {
      const u = getAccessUserById(uid);
      if (u && u.email) return u.email.toLowerCase();
    }
    if (typeof getUserName === 'function' && typeof findProfile === 'function') {
      const profile = findProfile(getUserName());
      if (profile && profile.email) return String(profile.email).toLowerCase();
    }
    if (typeof getUserName === 'function') {
      const inferred = dimInferNubankEmail(getUserName());
      if (inferred) return inferred;
    }
    return '';
  }

  function dimNormalizeWeekKey(week) {
    if (week === '' || week == null) return '';
    const m = String(week).trim().replace(',', '.').match(/\d+/);
    return m ? String(parseInt(m[0], 10)) : '';
  }

  function dimLookupRawSchedule(rawSchedule, week) {
    if (!rawSchedule) return null;
    const weekKey = dimNormalizeWeekKey(week);
    if (rawSchedule[weekKey]) return rawSchedule[weekKey];
    const keys = Object.keys(rawSchedule);
    for (let i = 0; i < keys.length; i++) {
      if (dimNormalizeWeekKey(keys[i]) === weekKey) return rawSchedule[keys[i]];
    }
    return null;
  }

  function dimWeekCacheKey(week) {
    const email = dimGetCacheEmail();
    if (!email) return null;
    return 'qhub_dim_week_' + week + '_' + email.replace(/[^a-z0-9@._-]/gi, '_');
  }

  function dimIsDimPageActive() {
    return !!document.getElementById('pageDimensionamento')?.classList.contains('active');
  }

  function dimRestoreSession() {
    const stored = dimReadStoredSession();
    if (stored) {
      dimState.session = stored;
      dimState.bridgeReady = true;
      return true;
    }
    return false;
  }

  function dimTryInstantWeek(week, options) {
    options = options || {};
    week = week || dimState.week || dimGetIsoWeek();
    const shouldRender = options.render !== false && dimIsDimPageActive();

    if (dimState.schedule && dimState.week === week) {
      if (shouldRender) dimRenderAll();
      return true;
    }
    const cached = dimReadWeekCache(week);
    if (cached) {
      dimApplySchedule(cached, { render: shouldRender });
      dimSetLastUpdate();
      return true;
    }
    return false;
  }

  function dimEnsureSessionBackground(maxMs) {
    maxMs = maxMs || 8000;
    if (dimState.session) return Promise.resolve(dimState.session);
    return dimWaitForBridgeTarget(maxMs).then(function () {
      if (!dimState.session) dimRestoreSession();
      if (dimState.session) return dimState.session;
      return dimJsonpApi('getSessionInfo', dimPayloadWithUserEmail({}), 6000).then(function (s) {
        if ((!s || !s.email) && dimGetCacheEmail()) {
          s = { email: dimGetCacheEmail(), analystKey: dimGetCacheEmail().split('@')[0], isLeader: false };
        }
        dimState.session = s;
        dimSaveSession(s);
        dimState.bridgeReady = true;
        dimUpdateStatus();
        return s;
      });
    }).catch(function () {
      dimRestoreSession();
      return dimState.session || null;
    });
  }

  function dimRefreshWeekInBackground(week) {
    week = week || dimState.week || dimGetIsoWeek();
    dimLoadWeek(week, { silent: true, skipCacheCheck: true }).catch(function () { /* ignore */ });
  }

  function dimReadWeekCache(week) {
    function readKey(key) {
      if (!key) return null;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.schedule) return null;
        if (parsed.v !== DIM_WEEK_CACHE_VERSION) return null;
        if (parsed.ts && Date.now() - parsed.ts > DIM_WEEK_CACHE_TTL) return null;
        return parsed.schedule;
      } catch (e) {
        return null;
      }
    }

    const hit = readKey(dimWeekCacheKey(week));
    if (hit) return hit;

    try {
      const prefix = 'qhub_dim_week_' + week + '_';
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) {
          const fallback = readKey(k);
          if (fallback) return fallback;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function dimInvalidateWeekCache(week) {
    week = week || dimState.week || dimGetIsoWeek();
    const key = dimWeekCacheKey(week);
    if (key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  }

  function dimSaveWeekCache(week, schedule) {
    const key = dimWeekCacheKey(week);
    if (!key || !schedule) return;
    try {
      localStorage.setItem(key, JSON.stringify({ schedule: schedule, ts: Date.now(), v: DIM_WEEK_CACHE_VERSION }));
    } catch (e) { /* ignore */ }
  }

  function dimHandleBridgeCallback() {
    if (!/\bdimBridge=1\b/.test(global.location.search)) return false;
    const match = global.location.hash.match(/#dimSession=([^&]+)/);
    if (!match) return false;
    try {
      const parsed = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(match[1])))));
      if (!parsed || !parsed.session) return false;
      dimSaveSession(parsed.session);
      if (global.opener && !global.opener.closed) {
        global.opener.postMessage({ source: 'dim-bridge', event: 'session', data: parsed.session }, global.location.origin);
      }
      document.body.innerHTML = '<p style="font-family:sans-serif;padding:20px;text-align:center">Conectado! Esta janela vai fechar…</p>';
      setTimeout(function () { global.close(); }, 500);
      return true;
    } catch (e) {
      return false;
    }
  }

  if (dimHandleBridgeCallback()) return;

  function dimEnsureIframe() {
    let frame = document.getElementById('dimBridgeFrame');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'dimBridgeFrame';
      frame.className = 'dim-bridge-frame';
      frame.title = 'Dimensionamento bridge';
      frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      document.body.appendChild(frame);
      if (!window.__dimBridgeListener) {
        window.addEventListener('message', dimOnBridgeMessage);
        window.__dimBridgeListener = true;
      }
    }
    const url = dimBridgeBaseUrl();
    if (!url) return frame;
    const current = frame.src || '';
    const execBase = dimExecBaseUrl();
    const currentExec = current ? String(current).split('?')[0] : '';
    const needReload = !current || current.indexOf('view=bridge') < 0 ||
      (execBase && currentExec && currentExec !== execBase);
    if (needReload) {
      dimState.bridgeReady = false;
      frame.src = url;
    }
    return frame;
  }

  function dimReloadBridgeIframe() {
    const frame = dimEnsureIframe();
    const url = dimBridgeBaseUrl();
    dimState.bridgeReady = false;
    if (frame && url) frame.src = url;
    return frame;
  }

  function dimExecBaseUrl() {
    const raw = dimGetBridgeUrl();
    if (!raw) return '';
    try {
      const u = new URL(raw);
      u.searchParams.delete('view');
      u.searchParams.delete('hubReturn');
      let out = u.toString();
      if (out.endsWith('?')) out = out.slice(0, -1);
      return out;
    } catch (e) {
      return String(raw).split('?')[0];
    }
  }

  function dimJsonpApi(action, payload, timeoutMs) {
    timeoutMs = timeoutMs || 45000;
    const base = dimExecBaseUrl();
    if (!base) return Promise.reject(new Error('URL da ponte não configurada.'));
    return new Promise(function (resolve, reject) {
      const cb = 'dimCb_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
      let timer;
      let script;
      function cleanup() {
        if (timer) clearTimeout(timer);
        try { delete global[cb]; } catch (e) { global[cb] = undefined; }
        if (script && script.parentNode) script.parentNode.removeChild(script);
      }
      timer = setTimeout(function () {
        cleanup();
        reject(new Error('Timeout ao comunicar com Apps Script'));
      }, timeoutMs);
      global[cb] = function (res) {
        cleanup();
        if (res && res.ok) resolve(res.data);
        else reject(new Error((res && res.error) || 'Erro na ponte'));
      };
      const sep = base.indexOf('?') >= 0 ? '&' : '?';
      script = document.createElement('script');
      script.src = base + sep +
        'api=' + encodeURIComponent(action) +
        '&payload=' + encodeURIComponent(JSON.stringify(payload || {})) +
        '&callback=' + encodeURIComponent(cb);
      script.onerror = function () {
        cleanup();
        reject(new Error('Falha na comunicação com Apps Script'));
      };
      document.head.appendChild(script);
    });
  }

  function dimFetchApi(action, payload, timeoutMs) {
    timeoutMs = timeoutMs || 45000;
    const base = dimExecBaseUrl();
    if (!base) return Promise.reject(new Error('URL da ponte não configurada.'));
    const sep = base.indexOf('?') >= 0 ? '&' : '?';
    const url = base + sep + 'api=' + encodeURIComponent(action) + '&payload=' + encodeURIComponent(JSON.stringify(payload || {}));
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    return fetch(url, {
      method: 'GET',
      credentials: 'include',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal
    }).then(function (r) {
      return r.text().then(function (text) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var res;
        try { res = JSON.parse(text); } catch (e) { throw new Error('Resposta inválida da ponte'); }
        if (!res.ok) throw new Error(res.error || 'Erro na ponte');
        return res.data;
      });
    }).finally(function () { clearTimeout(timer); });
  }

  function dimWaitForBridgeReady(ms) {
    ms = ms || 60000;
    return new Promise(function (resolve, reject) {
      let settled = false;
      let storedPoll;
      function finish(err) {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMsg);
        if (storedPoll) clearInterval(storedPoll);
        if (err) reject(err); else resolve();
      }

      const onMsg = function (ev) {
        const m = ev.data;
        if (!m || m.source !== 'dim-bridge') return;
        if (m.event === 'ready') dimState.bridgeReady = true;
        if (m.event === 'session' && m.data) {
          dimState.session = m.data;
          dimSaveSession(m.data);
          dimState.bridgeReady = true;
          dimUpdateStatus();
          finish();
        }
      };
      window.addEventListener('message', onMsg);

      storedPoll = setInterval(function () {
        if (settled) return;
        const s = dimReadStoredSession();
        if (s) {
          dimState.session = s;
          dimState.bridgeReady = true;
          dimUpdateStatus();
          finish();
        }
      }, 400);

      const deadline = Date.now() + ms;

      function tryJsonp() {
        if (settled) return;
        if (Date.now() > deadline) {
          finish(new Error('Não conectou. Permita pop-ups, clique em Conectar e aguarde o popup fechar sozinho.'));
          return;
        }
        dimJsonpApi('getSessionInfo', dimPayloadWithUserEmail({}), 20000).then(function (s) {
          if ((!s || !s.email) && dimGetCacheEmail()) {
            s = { email: dimGetCacheEmail(), analystKey: dimGetCacheEmail().split('@')[0], isLeader: false };
          }
          if (settled) return;
          dimState.session = s;
          dimSaveSession(s);
          dimState.bridgeReady = true;
          dimUpdateStatus();
          finish();
        }).catch(function () {
          setTimeout(tryJsonp, 2500);
        });
      }

      tryJsonp();
    });
  }

  async function dimConnectBridge() {
    const url = dimBridgeBaseUrl();
    if (!url) {
      dimShowToast('Configure a URL da ponte em Configuração → Técnico', true);
      return;
    }
    const week = dimState.week || dimGetIsoWeek();
    const hadInstant = dimTryInstantWeek(week);

    dimBootstrapSessionFromHub();
    dimEnsureIframe();
    dimUpdateStatus();

    if (dimGetCacheEmail()) {
      try {
        await dimLoadWeek(week);
        dimStartReloadTimer();
        dimRefreshPendingBadge();
        dimUpdateStatus();
        dimShowToast('Conectado à planilha');
        return;
      } catch (e) { /* try JSONP session + popup */ }
    }

    try {
      await dimJsonpApi('getSessionInfo', dimPayloadWithUserEmail({}), 12000).then(function (s) {
        if ((!s || !s.email) && dimGetCacheEmail()) {
          s = { email: dimGetCacheEmail(), analystKey: dimGetCacheEmail().split('@')[0], isLeader: false };
        }
        dimState.session = s;
        dimSaveSession(s);
        dimState.bridgeReady = true;
        dimUpdateStatus();
      });
    } catch (e) { /* try popup next */ }

    if (dimState.session) {
      if (hadInstant || dimState.schedule) {
        dimStartReloadTimer();
        dimRefreshWeekInBackground(week);
      } else {
        try {
          await dimLoadWeek(week);
          dimStartReloadTimer();
        } catch (err) {
          if (!dimTryInstantWeek(week)) dimRenderError(String(err.message || err));
        }
      }
      return;
    }

    const w = dimOpenBridgePopup();
    if (!w) {
      if (hadInstant) {
        dimShowToast('Pop-up bloqueado — exibindo última versão. Permita pop-ups para sincronizar.', true);
        return;
      }
      dimRenderError('Pop-up bloqueado. No Chrome: ícone à direita da barra de endereço → sempre permitir pop-ups neste site.');
      return;
    }
    dimReloadBridgeIframe();
    if (!hadInstant) {
      const grid = document.getElementById('dimGridWrap');
      if (grid) {
        grid.innerHTML = '<div class="dim-empty-state"><span class="dim-saving-dot"></span><p>Conectando…<br>O popup vai redirecionar e fechar sozinho.</p></div>';
      }
    }
    try {
      await dimWaitForBridgeReady(25000);
      if (hadInstant || dimState.schedule) {
        dimStartReloadTimer();
        dimRefreshWeekInBackground(week);
      } else {
        await dimLoadWeek(week);
        dimStartReloadTimer();
      }
    } catch (e) {
      if (dimState.schedule || dimTryInstantWeek(week)) {
        dimShowToast('Sem conexão agora — exibindo última versão salva', true);
        dimStartReloadTimer();
        return;
      }
      dimRenderError(String(e.message || e));
    }
  }

  let dimCallSeq = 0;
  const dimCallWaiters = {};

  function dimOnBridgeMessage(ev) {
    const msg = ev.data;
    if (!msg || msg.source !== 'dim-bridge') return;

    if (msg.event === 'ready') {
      dimState.bridgeReady = true;
      dimUpdateStatus();
      return;
    }
    if (msg.event === 'session' && msg.data) {
      dimState.session = msg.data;
      dimSaveSession(msg.data);
      dimState.bridgeReady = true;
      dimUpdateStatus();
      dimWarmupFetchWeek();
      if (dimIsDimPageActive()) {
        const wk = dimState.week || dimGetIsoWeek();
        if (!dimTryInstantWeek(wk)) {
          dimLoadWeek(wk, { silent: !!dimReadWeekCache(wk) }).catch(function () {});
        } else {
          dimRefreshWeekInBackground(wk);
        }
      }
      return;
    }
    if (msg.id && dimCallWaiters[msg.id]) {
      dimCallWaiters[msg.id](msg);
      delete dimCallWaiters[msg.id];
    }
  }

  function dimCallViaPostMessage(action, payload, timeoutMs) {
    return new Promise(function (resolve, reject) {
      dimEnsureIframe();
      const id = 'dim-' + (++dimCallSeq) + '-' + Date.now();
      const timer = setTimeout(function () {
        delete dimCallWaiters[id];
        reject(new Error('Timeout ao comunicar com Apps Script'));
      }, timeoutMs || 45000);

      dimCallWaiters[id] = function (msg) {
        clearTimeout(timer);
        if (msg.ok) resolve(msg.data);
        else reject(new Error(msg.error || 'Erro na ponte'));
      };

      const target = dimGetBridgeTarget();
      if (!target) {
        clearTimeout(timer);
        delete dimCallWaiters[id];
        reject(new Error('Ponte indisponível. Clique em Conectar à planilha.'));
        return;
      }
      target.postMessage({
        source: 'quality-id-hub',
        id: id,
        action: action,
        payload: payload || {}
      }, '*');
    });
  }

  function dimFirstResolved(promises) {
    return new Promise(function (resolve, reject) {
      if (!promises.length) {
        reject(new Error('Falha ao comunicar com Apps Script'));
        return;
      }
      var failures = 0;
      var lastErr = null;
      promises.forEach(function (p) {
        Promise.resolve(p).then(resolve).catch(function (err) {
          lastErr = err;
          failures++;
          if (failures >= promises.length) {
            reject(lastErr || new Error('Falha ao comunicar com Apps Script'));
          }
        });
      });
    });
  }

  function dimWaitForBridgeTarget(maxMs) {
    maxMs = maxMs || 12000;
    return new Promise(function (resolve, reject) {
      if (dimGetBridgeTarget()) return resolve(dimGetBridgeTarget());
      var deadline = Date.now() + maxMs;
      var onMsg = function (ev) {
        var m = ev.data;
        if (!m || m.source !== 'dim-bridge') return;
        if (m.event === 'ready') dimState.bridgeReady = true;
        if (m.event === 'session' && m.data) {
          dimState.session = m.data;
          dimSaveSession(m.data);
          dimState.bridgeReady = true;
        }
        if (dimGetBridgeTarget()) {
          window.removeEventListener('message', onMsg);
          clearInterval(poll);
          resolve(dimGetBridgeTarget());
        }
      };
      window.addEventListener('message', onMsg);
      var poll = setInterval(function () {
        if (dimGetBridgeTarget()) {
          window.removeEventListener('message', onMsg);
          clearInterval(poll);
          resolve(dimGetBridgeTarget());
          return;
        }
        if (Date.now() > deadline) {
          window.removeEventListener('message', onMsg);
          clearInterval(poll);
          reject(new Error('Ponte indisponível. Clique em Conectar à planilha.'));
        }
      }, 200);
    });
  }

  function dimCallTimeoutFor(action) {
    if (action === 'getUserSchedule') return 90000;
    if (action === 'saveBatchData' || action === 'saveDetail') return 45000;
    if (action === 'getPendingDetails' || action === 'getAdjustments' || action === 'getSlotDictionary') return 45000;
    return 30000;
  }

  function dimSaveUserEmail() {
    if (dimState.session && dimState.session.email) return dimState.session.email;
    if (dimState.schedule && dimState.schedule.identity && dimState.schedule.identity.email) {
      return dimState.schedule.identity.email;
    }
    return '';
  }

  function dimResolveUserEmail() {
    const fromSession = dimSaveUserEmail();
    if (fromSession) return fromSession;
    return dimGetCacheEmail() || '';
  }

  function dimPayloadWithUserEmail(payload) {
    const out = Object.assign({}, payload || {});
    if (!out.userEmail) {
      const email = dimResolveUserEmail();
      if (email) out.userEmail = email;
    }
    return out;
  }

  function dimCall(action, payload, timeoutMs) {
    timeoutMs = timeoutMs || dimCallTimeoutFor(action);
    const url = dimGetBridgeUrl();
    if (!url) {
      return Promise.reject(new Error('URL da ponte não configurada. Admin: Configuração → Técnico → URL Dimensionamento.'));
    }
    dimEnsureIframe();
    const callPayload = dimPayloadWithUserEmail(payload);
    const bridgeMs = (action === 'getUserSchedule' || action === 'saveBatchData' || action === 'saveDetail')
      ? timeoutMs
      : Math.min(timeoutMs, 45000);
    const savePayload = Object.assign({}, callPayload);
    if ((action === 'saveBatchData' || action === 'saveDetail') && dimSaveUserEmail()) {
      savePayload.userEmail = dimSaveUserEmail();
    }

    function viaBridge() {
      return dimWaitForBridgeTarget(8000).then(function (target) {
        if (!target) throw new Error('Bridge indisponível');
        return dimCallViaPostMessage(action, savePayload, bridgeMs);
      });
    }

    if (action === 'saveBatchData' || action === 'saveDetail') {
      const hasEmail = !!(savePayload.userEmail || dimResolveUserEmail());
      const paths = [];
      if (hasEmail) {
        paths.push(dimJsonpApi(action, savePayload, timeoutMs));
        paths.push(dimFetchApi(action, savePayload, Math.min(25000, timeoutMs)));
      }
      paths.push(
        dimWaitForBridgeTarget(hasEmail ? 6000 : 12000).then(function (target) {
          if (!target) {
            throw new Error(hasEmail
              ? 'Ponte indisponível — verifique a URL em Configuração → Técnico'
              : 'Conecte à planilha antes de salvar (clique em Conectar à planilha).');
          }
          return dimCallViaPostMessage(action, savePayload, timeoutMs);
        })
      );
      return hasEmail ? dimFirstResolved(paths) : paths[paths.length - 1];
    }

    if (action === 'getUserSchedule' && !callPayload.userEmail && typeof getUserName === 'function') {
      const inferred = dimInferNubankEmail(getUserName());
      if (inferred) callPayload.userEmail = inferred;
    }
    if (action === 'getUserSchedule' && !callPayload.userEmail) {
      return Promise.reject(new Error('E-mail não identificado. Atualize seu cadastro no Hub ou conecte à planilha.'));
    }

    // JSONP is most reliable from GitHub Pages when userEmail is in payload (no Google cookies)
    return dimFirstResolved([
      dimJsonpApi(action, callPayload, timeoutMs),
      viaBridge(),
      dimFetchApi(action, callPayload, Math.min(20000, timeoutMs))
    ]);
  }

  function dimGetIsoWeek(d) {
    const date = d || new Date();
    const t = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - ys) / 86400000) + 1) / 7);
  }

  function dimEmailMismatch() {
    if (!dimState.session || !dimState.session.email) return false;
    const uid = localStorage.getItem('qhub_user_id');
    if (!uid || typeof getAccessUserById !== 'function') return false;
    const u = getAccessUserById(uid);
    if (!u || !u.email) return false;
    return u.email.toLowerCase() !== dimState.session.email.toLowerCase();
  }

  function dimMinSlotsAlert() {
    return (dimState.schedule && dimState.schedule.config && dimState.schedule.config.minSlotsAlert) || 18;
  }

  function dimCountFilled(day) {
    if (!day) return 0;
    if (day.filledCount != null) return day.filledCount;
    return Object.keys(day.slots || {}).filter(function (k) { return day.slots[k]; }).length;
  }

  function dimIsBreakSlot(val) {
    return String(val || '').toLowerCase() === 'break';
  }

  function dimProjectedDayTotal(day, startTime, quantity) {
    const times = (dimState.schedule && dimState.schedule.config.timeSlots) || [];
    const startIdx = times.indexOf(dimNormalizeTime(startTime));
    if (startIdx < 0 || !day) return dimCountFilled(day);
    const currentTotal = dimCountFilled(day);
    let slotsNeeded = quantity;
    let overwrittenWorkCount = 0;
    for (let i = 0; i < times.length - startIdx; i++) {
      if (slotsNeeded <= 0) break;
      const h = times[startIdx + i];
      const existing = day.slots[h] || '';
      if (dimIsBreakSlot(existing)) continue;
      if (existing) overwrittenWorkCount++;
      slotsNeeded--;
    }
    return currentTotal - overwrittenWorkCount + quantity;
  }

  function dimSetLastUpdate() {
    dimState.lastUpdate = Date.now();
    try { localStorage.setItem('qhub_dim_last_update', String(dimState.lastUpdate)); } catch (e) { /* ignore */ }
    dimUpdateStatus();
  }

  function dimUpdateWeekLabel() {
    const week = dimState.week || dimGetIsoWeek();
    const label = document.getElementById('dimWeekLabel');
    if (label) {
      label.textContent = 'Semana ' + week + (week <= 26 ? ' · H1' : ' · H2');
    }
    const cur = document.getElementById('dimCurrentWeekNum');
    if (cur) cur.textContent = String(dimGetIsoWeek());
    dimBuildWeekMenu();
  }

  function dimBuildWeekMenu() {
    const menu = document.getElementById('dimWeekMenu');
    if (!menu || dimState.week == null) return;
    const currentIso = dimGetIsoWeek();
    const start = dimState.week <= 26 ? 1 : 27;
    const end = dimState.week <= 26 ? 26 : 53;
    let html = '';
    for (let w = start; w <= end; w++) {
      const active = w === dimState.week ? ' active' : '';
      const curMark = w === currentIso ? ' <span style="opacity:.7;font-size:11px">atual</span>' : '';
      html += '<button type="button" class="' + active.trim() + '" onclick="dimSelectWeek(' + w + ')">Semana ' + w + curMark + '</button>';
    }
    menu.innerHTML = html;
  }

  function dimToggleWeekMenu(force) {
    const menu = document.getElementById('dimWeekMenu');
    if (!menu) return;
    if (force === false) menu.classList.remove('open');
    else if (force === true) menu.classList.add('open');
    else menu.classList.toggle('open');
  }

  function dimSelectWeek(w) {
    dimToggleWeekMenu(false);
    dimLoadWeek(w);
  }

  function dimBindWeekMenuClose() {
    if (dimState.weekMenuBound) return;
    dimState.weekMenuBound = true;
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.dim-week-select-wrap')) dimToggleWeekMenu(false);
    });
  }

  function dimUpdateSelectHint() {
    const el = document.getElementById('dimSelectHint');
    if (!el) return;
    if (localStorage.getItem('qhub_dim_multi_hint_seen')) el.classList.add('hidden');
  }

  function dimHideMultiSelectHint() {
    try { localStorage.setItem('qhub_dim_multi_hint_seen', '1'); } catch (e) { /* ignore */ }
    document.getElementById('dimSelectHint')?.classList.add('hidden');
  }

  function dimUpdateAjustesBadge(count) {
    const badge = document.getElementById('dimAjustesBadge');
    if (!badge) return;
    if (count > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = String(count);
    } else {
      badge.style.display = 'none';
    }
  }

  async function dimRefreshPendingBadge() {
    if (!dimState.schedule) return;
    try {
      const res = await dimFetchAdjustmentsData();
      dimUpdateAjustesBadge(res.pendingCount != null ? res.pendingCount : (res.pending || []).length);
    } catch (e) { /* ignore */ }
  }

  function dimParseCellDetails(detailsRaw) {
    if (!detailsRaw) return { action: '', project: '', otherSpec: '' };
    if (typeof detailsRaw === 'object') {
      return {
        action: String(detailsRaw.action || '').trim(),
        project: String(detailsRaw.project || '').trim(),
        otherSpec: String(detailsRaw.otherSpec || detailsRaw.other || '').trim()
      };
    }
    try {
      return dimParseCellDetails(JSON.parse(String(detailsRaw)));
    } catch (e) {
      return { action: '', project: '', otherSpec: '' };
    }
  }

  function dimNormalizeDetailsForComparison(details) {
    const d = dimParseCellDetails(details);
    return JSON.stringify({ action: d.action, project: d.project, otherSpec: d.otherSpec });
  }

  function dimIsDetailIncomplete(slot, details) {
    const d = dimParseCellDetails(details);
    if (!d.action) return true;
    if (DIM_DETAIL_REQUIRES_PROJECT[slot] && !d.project) return true;
    if (dimDetailRequiresSpec(d.action, d.project) && !d.otherSpec) return true;
    return false;
  }

  function dimHourToIndex(timeStr) {
    const parts = String(timeStr || '').split(':');
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(String(parts[1] || '0').replace(/\D/g, ''), 10);
    if (isNaN(hh)) return 0;
    return hh * 2 + ((isNaN(mm) ? 0 : mm) >= 30 ? 1 : 0);
  }

  function dimEnsureTimeSlotsForWeek(weekData, timeSlots) {
    const slots = (timeSlots || []).slice().map(dimNormalizeTime).filter(Boolean);
    const seen = {};
    slots.forEach(function (s) { seen[s] = true; });
    DIM_FULL_DAY_NAMES.forEach(function (day) {
      Object.keys(weekData[day] || {}).forEach(function (h) {
        const n = dimNormalizeTime(h);
        if (n && !seen[n]) {
          seen[n] = true;
          slots.push(n);
        }
      });
    });
    slots.sort(function (a, b) { return dimHourToIndex(a) - dimHourToIndex(b); });
    return slots;
  }

  function dimGetGroupedRecords(weekData, timeSlots) {
    timeSlots = dimEnsureTimeSlotsForWeek(weekData, timeSlots);
    const flatRecords = [];

    DIM_FULL_DAY_NAMES.forEach(function (day) {
      const daySlots = weekData[day];
      if (!daySlots) return;
      Object.keys(daySlots).forEach(function (hour) {
        const data = daySlots[hour];
        const taskName = (typeof data === 'string') ? data : (data && data.task);
        if (!taskName || taskName === 'Break') return;
        const normHour = dimNormalizeTime(hour);
        let hourIndex = timeSlots.indexOf(normHour);
        if (hourIndex < 0) hourIndex = dimHourToIndex(normHour);
        flatRecords.push({
          day: day,
          hour: normHour,
          hourIndex: hourIndex,
          data: (typeof data === 'string') ? { task: data } : data,
          taskName: taskName
        });
      });
    });

    flatRecords.sort(function (a, b) {
      const dayDiff = DIM_FULL_DAY_NAMES.indexOf(a.day) - DIM_FULL_DAY_NAMES.indexOf(b.day);
      return dayDiff !== 0 ? dayDiff : a.hourIndex - b.hourIndex;
    });

    if (!flatRecords.length) return [];

    const emptyJson = '{"action":"","project":"","otherSpec":""}';
    const groups = [];
    let currentGroup = Object.assign({}, flatRecords[0], {
      count: 1,
      endHourIndex: flatRecords[0].hourIndex
    });

    for (let i = 1; i < flatRecords.length; i++) {
      const rec = flatRecords[i];
      const prev = currentGroup;
      const isSameDay = rec.day === prev.day;
      const isSameTask = rec.taskName === prev.taskName;
      const recStr = dimNormalizeDetailsForComparison(rec.data && rec.data.details);
      const prevStr = dimNormalizeDetailsForComparison(prev.data && prev.data.details);
      const isRecEmpty = recStr === emptyJson;
      const isPrevFull = prevStr !== emptyJson;
      let isSameDetails = recStr === prevStr;
      if (isSameTask && isSameDay && isRecEmpty && isPrevFull) isSameDetails = true;

      const gap = rec.hourIndex - prev.endHourIndex;
      let isConsecutiveLogic = gap === 1;
      if (gap > 1 && isSameDay) {
        const breaks = Object.keys(weekData[rec.day] || {}).filter(function (h) {
          const c = weekData[rec.day][h];
          const t = (typeof c === 'string') ? c : (c && c.task);
          return t === 'Break';
        }).map(dimNormalizeTime);
        isConsecutiveLogic = true;
        for (let k = prev.endHourIndex + 1; k < rec.hourIndex; k++) {
          const slotTime = timeSlots[k];
          if (slotTime && breaks.indexOf(slotTime) < 0) {
            isConsecutiveLogic = false;
            break;
          }
        }
      }

      if (isSameDay && isSameTask && isConsecutiveLogic && isSameDetails) {
        currentGroup.count++;
        currentGroup.endHourIndex = rec.hourIndex;
      } else {
        groups.push(currentGroup);
        currentGroup = Object.assign({}, rec, { count: 1, endHourIndex: rec.hourIndex });
      }
    }
    groups.push(currentGroup);
    return groups;
  }

  function dimWeekDataFromHubDays(days) {
    const weekData = {};
    (days || []).forEach(function (d) {
      const full = d.dayLabel || DIM_KEY_TO_FULL[d.day] || d.day;
      if (!full) return;
      weekData[full] = weekData[full] || {};
      Object.keys(d.slots || {}).forEach(function (t) {
        weekData[full][dimNormalizeTime(t)] = { task: d.slots[t], details: null };
      });
    });
    return weekData;
  }

  function dimBuildAdjustmentsLocal(week) {
    const schedule = dimState.schedule;
    if (!schedule) return { records: [], pending: [], pendingCount: 0 };

    const weekKey = dimNormalizeWeekKey(week != null ? week : schedule.week || dimGetIsoWeek());
    let weekData = dimLookupRawSchedule(schedule.rawSchedule, weekKey);
    if (!weekData && schedule.days) {
      weekData = dimWeekDataFromHubDays(schedule.days);
    }
    if (!weekData) {
      return { records: [], pending: [], pendingCount: 0 };
    }

    const detailTypes = (schedule.config && schedule.config.detailSlots) || DIM_DETAIL_SLOTS;
    const timeSlots = (schedule.config && schedule.config.timeSlots) || [];
    const dateFallback = dimDatesForWeek(Number(weekKey) || dimGetIsoWeek());
    const groups = dimGetGroupedRecords(weekData, timeSlots);
    const records = [];
    const pending = [];

    groups.forEach(function (g) {
      if (detailTypes.indexOf(g.taskName) < 0) return;
      const dayKey = g.day.substring(0, 3);
      const dateIso = (schedule.days || []).find(function (d) { return d.day === dayKey || d.dayLabel === g.day; });
      const resolvedDate = (dateIso && dateIso.date) || dateFallback[dayKey] || '';
      const details = dimParseCellDetails(g.data && g.data.details);
      const isPending = dimIsDetailIncomplete(g.taskName, details);
      const record = {
        slot: g.taskName,
        day: dayKey,
        dayLabel: g.day,
        date: resolvedDate,
        dateVisual: resolvedDate.length >= 10 ? resolvedDate.slice(8, 10) + '/' + resolvedDate.slice(5, 7) : '',
        time: g.hour,
        count: g.count,
        durationHours: g.count * 0.5,
        acao: details.action,
        projeto: details.project,
        especificacao: details.otherSpec,
        pending: isPending
      };
      records.push(record);
      if (isPending) pending.push(record);
    });

    return { records: records, pending: pending, pendingCount: pending.length, week: Number(weekKey) };
  }

  async function dimFetchAdjustmentsData() {
    const week = dimState.week || dimGetIsoWeek();
    const schedule = dimState.schedule;

    if (schedule && schedule.adjustments && schedule.adjustments.length &&
        String(schedule.week) === String(week)) {
      const records = schedule.adjustments;
      return {
        records: records,
        pending: records.filter(function (r) { return r.pending; }),
        pendingCount: schedule.pendingCount != null ? schedule.pendingCount : records.filter(function (r) { return r.pending; }).length,
        week: schedule.week
      };
    }

    const local = dimBuildAdjustmentsLocal(week);
    if (local.records.length) return local;

    try {
      const api = await dimCall('getAdjustments', { week: week });
      if ((api.records || []).length) return api;
    } catch (e) { /* API may be unavailable on older deploy */ }

    return dimBuildAdjustmentsLocal(week);
  }

  function dimGetSlotGroups() {
    const options = dimGetSlotOptions();
    const dict = (dimState.dictionary && dimState.dictionary.items) ? dimState.dictionary.items : [];
    const activityBySlot = {};
    dict.forEach(function (it) {
      activityBySlot[String(it.tipoSlot || '').toLowerCase()] = it.atividade || 'Outros';
    });
    const groups = {};
    const order = [];
    options.forEach(function (opt) {
      const act = activityBySlot[String(opt).toLowerCase()] || 'Outros';
      if (!groups[act]) {
        groups[act] = [];
        order.push(act);
      }
      groups[act].push(opt);
    });
    return { groups: groups, order: order };
  }

  function dimRenderAjustesTable(el, res) {
    const records = res.records || [];
    dimState.adjustmentsList = records;
    dimState.pendingList = res.pending || records.filter(function (r) { return r.pending; });
    dimUpdateAjustesBadge(res.pendingCount != null ? res.pendingCount : dimState.pendingList.length);

    const q = (dimState.ajustesSearch || '').toLowerCase().trim();
    const filtered = records.filter(function (r) {
      if (!q) return true;
      const dayLabel = (DIM_DAY_LABELS[r.day] || r.dayLabel || r.day || '').toLowerCase();
      return String(r.slot || '').toLowerCase().indexOf(q) >= 0 ||
        dayLabel.indexOf(q) >= 0 ||
        String(r.date || '').indexOf(q) >= 0;
    });

    if (!filtered.length) {
      el.innerHTML = '<p style="color:var(--text3);font-size:14px">' +
        (records.length ? 'Nenhum slot encontrado para esta busca.' : 'Nenhum slot detalhado nesta semana.') +
        '</p>';
      return;
    }

    let html = '<div class="dim-ajustes-table-wrap"><table class="dim-ajustes-table"><thead><tr>' +
      '<th>Slot / Tipo</th><th>Data / Início</th><th>Duração</th><th>Ação Realizada</th>' +
      '<th>Qual o projeto?</th><th>Outro</th><th>Ação</th></tr></thead><tbody>';

    filtered.forEach(function (r, idx) {
      const dayLabel = DIM_DAY_LABELS[r.day] || r.dayLabel || r.day || '—';
      const dateVisual = r.dateVisual || (r.date && r.date.length >= 10 ? r.date.slice(8, 10) + '/' + r.date.slice(5, 7) : '');
      const safeTime = escapeHtml(r.time).replace(/'/g, "\\'");
      const safeDay = escapeHtml(r.day || '').replace(/'/g, "\\'");
      const slotColors = dimSlotColorFromLabel(r.slot);
      const slotStyle = 'background:' + slotColors.bg + ';color:' + slotColors.text + ';border:1px solid ' + slotColors.border;

      html += '<tr>';
      html += '<td><span class="dim-ajuste-slot-badge" style="' + slotStyle + '">' + escapeHtml(r.slot) + '</span></td>';
      html += '<td><div class="dim-ajuste-day">' + escapeHtml(dayLabel) +
        (dateVisual ? ' · ' + escapeHtml(dateVisual) : '') + '</div>' +
        '<div class="dim-ajuste-time">' + escapeHtml(r.time) + '</div></td>';
      html += '<td><span class="dim-ajuste-duration">' + (r.durationHours || (r.count * 0.5)) + 'h (' +
        (r.count || 1) + ' slots)</span></td>';
      html += '<td>' + (r.acao
        ? '<span class="dim-ajuste-value">' + escapeHtml(r.acao) + '</span>'
        : '<span class="dim-ajuste-pending-label">Pendente</span>') + '</td>';
      html += '<td>' + (r.projeto
        ? '<span class="dim-ajuste-value">' + escapeHtml(r.projeto) + '</span>'
        : '<span class="dim-ajuste-muted">—</span>') + '</td>';
      html += '<td>' + (r.especificacao
        ? '<span class="dim-ajuste-spec">' + escapeHtml(r.especificacao) + '</span>'
        : '<span class="dim-ajuste-muted">—</span>') + '</td>';
      html += '<td class="dim-ajustes-actions">';
      html += '<button type="button" class="btn-sm" onclick="dimGoToSlot(\'' + safeDay + '\',\'' + safeTime + '\')" title="Ir para slot na grade"><i class="ti ti-arrow-right"></i></button>';
      html += '<button type="button" class="btn-sm primary" onclick="dimEditAdjustmentByIndex(' + idx + ')"><i class="ti ti-pencil"></i> ' +
        (r.pending ? 'Preencher' : 'Editar') + '</button>';
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  }

  function dimCountBreaks(day) {
    if (!day || !day.slots) return 0;
    let n = 0;
    Object.keys(day.slots).forEach(function (k) {
      if (dimIsBreakSlot(day.slots[k])) n++;
    });
    return n;
  }

  function dimMinBreaksAlert() {
    return (dimState.schedule && dimState.schedule.config && dimState.schedule.config.minBreaksAlert) || 2;
  }

  function dimGetDayIssues(day) {
    const minSlots = dimMinSlotsAlert();
    const minBreaks = dimMinBreaksAlert();
    const filled = dimCountFilled(day);
    const breaks = dimCountBreaks(day);
    const issues = [];
    if (filled < minSlots) issues.push('Faltam ' + (minSlots - filled) + ' slots');
    if (breaks < minBreaks) {
      const missing = minBreaks - breaks;
      issues.push(missing === 1 ? 'Falta 1 break' : 'Faltam ' + missing + ' breaks');
    }
    return issues;
  }

  function dimEnsureGridShell() {
    const wrap = document.getElementById('dimGridWrap');
    if (!wrap) return null;
    if (!wrap.querySelector('#dimGridInner')) {
      wrap.innerHTML =
        '<div class="dim-grid-zoom-bar">' +
        '<span class="zoom-label"><i class="ti ti-zoom-in"></i> Zoom da grade</span>' +
        '<button type="button" class="btn-sm" onclick="dimGridZoom(-10)"><i class="ti ti-minus"></i></button>' +
        '<span class="dim-grid-zoom-val" id="dimGridZoomVal">100%</span>' +
        '<button type="button" class="btn-sm" onclick="dimGridZoom(10)"><i class="ti ti-plus"></i></button>' +
        '<button type="button" class="btn-sm" onclick="dimGridZoom(0,true)">Reset</button>' +
        '</div>' +
        '<div class="dim-grid-scaler" id="dimGridScaler"><div id="dimGridInner"></div></div>';
      dimInitGridZoom();
      dimBindGridScrollHints();
    }
    return document.getElementById('dimGridInner');
  }

  function dimInitGridZoom() {
    const stored = parseInt(localStorage.getItem('qhub_dim_grid_zoom') || '100', 10);
    dimState.gridZoom = isNaN(stored) ? 100 : stored;
    dimApplyGridZoom();
  }

  function dimGridZoom(delta, reset) {
    if (reset) dimState.gridZoom = 100;
    else dimState.gridZoom = Math.max(80, Math.min(130, (dimState.gridZoom || 100) + delta));
    dimApplyGridZoom();
    try { localStorage.setItem('qhub_dim_grid_zoom', String(dimState.gridZoom)); } catch (e) { /* ignore */ }
  }

  function dimApplyGridZoom() {
    const scaler = document.getElementById('dimGridScaler');
    const val = document.getElementById('dimGridZoomVal');
    const z = dimState.gridZoom || 100;
    if (scaler) scaler.style.transform = 'scale(' + (z / 100) + ')';
    if (val) val.textContent = z + '%';
  }

  function dimScrollGridToTime(time) {
    const wrap = document.getElementById('dimGridWrap');
    if (!wrap) return;
    const headers = wrap.querySelectorAll('.dim-grid th:not(.dim-day-col)');
    let target = null;
    headers.forEach(function (th) {
      if (th.textContent.trim() === time) target = th;
    });
    if (target) {
      const left = target.offsetLeft - 100;
      wrap.scrollLeft = Math.max(0, left);
    }
    dimUpdateGridScrollHints();
  }

  function dimScrollGridToDefault() {
    if (!dimState.schedule) return;
    const times = dimState.schedule.config.timeSlots || [];
    let targetTime = '07:00';
    outer: for (let d = 0; d < DIM_DAY_KEYS.length; d++) {
      const day = dimFindDay(DIM_DAY_KEYS[d]);
      if (!day) continue;
      for (let t = 0; t < times.length; t++) {
        if (day.slots && day.slots[times[t]]) {
          targetTime = times[t];
          break outer;
        }
      }
    }
    dimScrollGridToTime(targetTime);
  }

  function dimScrollGrid(dir) {
    const wrap = document.getElementById('dimGridWrap');
    if (!wrap) return;
    const step = Math.max(240, wrap.clientWidth * 0.45);
    wrap.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
    setTimeout(dimUpdateGridScrollHints, 350);
  }

  function dimUpdateGridScrollHints() {
    const wrap = document.getElementById('dimGridWrap');
    if (!wrap) return;
    const max = wrap.scrollWidth - wrap.clientWidth;
    wrap.classList.toggle('can-scroll-left', wrap.scrollLeft > 4);
    wrap.classList.toggle('can-scroll-right', max > 4 && wrap.scrollLeft < max - 4);
  }

  function dimBindGridScrollHints() {
    if (dimState.gridScrollBound) return;
    const wrap = document.getElementById('dimGridWrap');
    if (!wrap) return;
    dimState.gridScrollBound = true;
    wrap.addEventListener('scroll', dimUpdateGridScrollHints);
    window.addEventListener('resize', dimUpdateGridScrollHints);
  }

  function dimAfterGridRender() {
    dimScrollGridToDefault();
    dimUpdateGridScrollHints();
  }

  function dimHighlightSlotInGrid(slotName) {
    let first = null;
    document.querySelectorAll('.dim-slot').forEach(function (cell) {
      const val = cell.getAttribute('title') || '';
      if (val.indexOf(slotName) === 0) {
        cell.classList.add('highlight-flash');
        if (!first) first = cell;
      }
    });
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setTimeout(function () {
        document.querySelectorAll('.dim-slot.highlight-flash').forEach(function (c) {
          c.classList.remove('highlight-flash');
        });
      }, 2000);
    }
  }

  function dimGoToSlot(dayKey, time) {
    dimSwitchTab('escala');
    setTimeout(function () {
      dimScrollGridToTime(time);
      const cell = document.querySelector(
        '.dim-slot[data-day="' + dayKey + '"][data-time="' + time.replace(/"/g, '\\"') + '"]'
      );
      if (cell) {
        cell.classList.add('highlight-flash');
        cell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        setTimeout(function () { cell.classList.remove('highlight-flash'); }, 2000);
      }
    }, 80);
  }

  function dimToggleHelp(force) {
    const bd = document.getElementById('dimHelpBackdrop');
    if (!bd) return;
    const open = force === undefined ? !bd.classList.contains('active') : !!force;
    if (open) bd.classList.add('active');
    else bd.classList.remove('active');
    dimState.modalOpen = open;
  }

  function dimMaybeShowOnboarding() {
    if (localStorage.getItem('qhub_dim_onboarded')) return;
    try { localStorage.setItem('qhub_dim_onboarded', '1'); } catch (e) { /* ignore */ }
    dimShowToast('Dica: conecte à planilha, clique em um slot para editar, use Desfazer após salvar.');
  }

  function dimBindKeyboard() {
    if (dimState.keyboardBound) return;
    dimState.keyboardBound = true;
    document.addEventListener('keydown', function (e) {
      const page = document.getElementById('pageDimensionamento');
      if (!page || !page.classList.contains('active')) return;
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return;

      if (e.key === 'Escape') {
        if (dimState.dropdown) dimCloseDropdown();
        else if (document.getElementById('dimHelpBackdrop')?.classList.contains('active')) dimToggleHelp(false);
        else if (document.getElementById('dimApplyBackdrop')?.classList.contains('active')) dimCloseApplyModal();
        else if (document.getElementById('dimClearBackdrop')?.classList.contains('active')) dimCloseClearModal();
        else if (document.getElementById('dimDetailBackdrop')?.classList.contains('active')) dimCloseDetailModal();
        else dimClearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const bar = document.getElementById('dimUndoBar');
        if (bar && bar.classList.contains('active')) {
          e.preventDefault();
          dimUndoLast();
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        dimChangeWeek(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        dimChangeWeek(1);
        return;
      }
      if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        dimToggleHelp(true);
      }
    });
  }

  function dimSetWeekLoading(loading) {
    dimState.loadingWeek = loading;
    const wrap = document.getElementById('dimGridWrap');
    const label = document.getElementById('dimWeekLabel');
    if (wrap) {
      wrap.classList.toggle('is-loading', loading);
      let overlay = wrap.querySelector('.dim-week-loading');
      if (loading) {
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.className = 'dim-week-loading';
          overlay.innerHTML = '<span class="dim-week-loading-spinner"></span><span class="dim-week-loading-text"></span>';
          wrap.appendChild(overlay);
        }
        const txt = overlay.querySelector('.dim-week-loading-text');
        if (txt) txt.textContent = 'Carregando semana ' + dimState.week + '…';
      } else if (overlay) {
        overlay.remove();
      }
    }
    if (label) label.classList.toggle('is-loading', loading);
    document.querySelectorAll('.dim-week-nav button, .dim-header-actions .btn-sm').forEach(function (btn) {
      btn.disabled = loading;
    });
    dimUpdateStatus();
  }

  function dimSetWeekRefreshing(refreshing) {
    if (refreshing) {
      dimState.silentLoadCount = (dimState.silentLoadCount || 0) + 1;
    } else {
      dimState.silentLoadCount = Math.max(0, (dimState.silentLoadCount || 0) - 1);
    }
    dimState.refreshingWeek = dimState.silentLoadCount > 0;
    document.getElementById('dimWeekLabel')?.classList.toggle('is-refreshing', dimState.refreshingWeek);
    dimUpdateStatus();
  }

  function dimUpdateStatus() {
    const el = document.getElementById('dimStatus');
    const badge = document.getElementById('dimHeaderBadge');
    const lastSync = document.getElementById('dimLastSync');
    if (!el) return;

    function showBar(cls, html) {
      el.className = 'dim-status visible ' + cls;
      el.innerHTML = html;
    }
    function hideBar() {
      el.className = 'dim-status';
      el.innerHTML = '';
    }
    function setBadge(cls, html, visible) {
      if (!badge) return;
      badge.className = 'dim-header-badge ' + cls;
      badge.innerHTML = html;
      badge.style.display = visible ? 'inline-flex' : 'none';
    }

    if (!dimState.lastUpdate) {
      try {
        const stored = parseInt(localStorage.getItem('qhub_dim_last_update') || '0', 10);
        if (stored) dimState.lastUpdate = stored;
      } catch (e) { /* ignore */ }
    }
    if (lastSync) {
      if (dimState.lastUpdate) {
        const d = new Date(dimState.lastUpdate);
        lastSync.textContent = 'Atualizado ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      } else {
        lastSync.textContent = '';
      }
    }

    if (dimState.loadingWeek) {
      setBadge('pending', '<span class="dim-saving-dot"></span> Carregando…', true);
      showBar('pending', '<span class="dim-saving-dot"></span><span>Carregando semana <strong>' +
        escapeHtml(String(dimState.week)) + '</strong>…</span>');
      return;
    }

    if (dimState.refreshingWeek) {
      setBadge('pending', '<span class="dim-saving-dot"></span> Atualizando…', true);
      hideBar();
      return;
    }

    const url = dimBridgeBaseUrl();
    if (!url) {
      setBadge('warn', '<i class="ti ti-alert-triangle"></i> Configurar ponte', true);
      showBar('warn', '<i class="ti ti-alert-triangle"></i><span>Configure a URL da ponte em Configuração → Técnico</span>');
      return;
    }

    if (dimState.saving || dimState.saveQueue.length) {
      setBadge('pending', '<span class="dim-saving-dot"></span> Salvando…', true);
      showBar('pending', '<span class="dim-saving-dot"></span><span>Salvando alterações…</span>');
      return;
    }

    if (dimState.session && dimState.session.email) {
      const mismatch = dimEmailMismatch();
      if (mismatch) {
        setBadge('warn', '<i class="ti ti-alert-triangle"></i> E-mail divergente', true);
        showBar('warn', '<i class="ti ti-alert-triangle"></i><span>Conectado como <strong>' +
          escapeHtml(dimState.session.email) + '</strong> — e-mail diferente do cadastro Hub</span>');
        return;
      }
      setBadge('ok', '<i class="ti ti-circle-check"></i> Salvo · ' + escapeHtml(dimState.session.email), true);
      hideBar();
      return;
    }

    setBadge('pending', '<span class="dim-saving-dot"></span> Conectando…', true);
    showBar('pending', '<span class="dim-saving-dot"></span><span>Conectando ao Google…</span>');
  }

  function dimShowToast(msg, isErr) {
    if (typeof showStatus === 'function') showStatus(msg, isErr);
    else if (isErr) console.error(msg); else console.log(msg);
  }

  async function dimInit() {
    if (typeof hasOperationalProfile === 'function' && !hasOperationalProfile()) return;
    if (dimState.initInProgress) return;
    dimState.initInProgress = true;

    try {
      dimBindGridSelection();
      dimBindKeyboard();
      dimBindWeekMenuClose();
      dimUpdateSelectHint();
      if (dimState.week == null) dimState.week = dimGetIsoWeek();
      dimUpdateWeekLabel();
      const url = dimGetBridgeUrl();
      if (!url) {
        dimRenderEmptySetup();
        return;
      }

      dimEnsureIframe();
      dimLoadSlotOptionsFallback();
      const week = dimState.week;

      dimRestoreSession();
      dimBootstrapSessionFromHub();
      const hadInstant = dimTryInstantWeek(week);
      dimUpdateStatus();

      if (hadInstant) {
        dimStartReloadTimer();
        dimRefreshPendingBadge();
        dimMaybeShowOnboarding();
        dimRefreshWeekInBackground(week);
        dimEnsureSessionBackground(8000).catch(function () { /* ignore */ });
        return;
      }

      try {
        await dimLoadWeek(week);
        dimStartReloadTimer();
        dimRefreshPendingBadge();
        dimMaybeShowOnboarding();
      } catch (e) {
        if (dimTryInstantWeek(week) || dimState.schedule) {
          dimShowToast('Não foi possível atualizar — exibindo última versão salva', true);
          dimStartReloadTimer();
          dimRefreshWeekInBackground(week);
        } else {
          dimRenderConnectPrompt();
        }
      }
    } finally {
      dimState.initInProgress = false;
    }
  }

  function dimEnsureLoaded() {
    if (!dimIsDimPageActive()) return;
    if (dimState.initInProgress || dimState.loadingWeek) return;
    const week = dimState.week || dimGetIsoWeek();
    if (dimState.schedule && dimState.week === week) {
      dimRenderAll();
      return;
    }
    if (typeof dimInit === 'function') dimInit();
  }

  function dimTeardownBridge() {
    if (dimState.reloadTimer) {
      clearInterval(dimState.reloadTimer);
      dimState.reloadTimer = null;
    }
    if (dimState.bridgePopup && !dimState.bridgePopup.closed) {
      try { dimState.bridgePopup.close(); } catch (e) { /* ignore */ }
      dimState.bridgePopup = null;
    }
    const frame = document.getElementById('dimBridgeFrame');
    if (frame) {
      frame.src = 'about:blank';
      frame.remove();
    }
    dimState.bridgeReady = false;
    dimState.warming = false;
    dimState.warmupDone = false;
  }

  function dimScheduleWarmup() {
    if (typeof isVisitor === 'function' && isVisitor()) {
      dimTeardownBridge();
      return;
    }
    setTimeout(function () {
      dimWarmup();
    }, 0);
  }

  function dimWarmupFetchWeek() {
    if (dimState.warming || dimState.loadingWeek) return;
    if (dimState.warmupDone && dimState.schedule) return;

    dimState.warming = true;
    const week = dimState.week || dimGetIsoWeek();
    dimState.week = week;

    dimLoadWeek(week, { silent: true })
      .then(function () {
        dimState.warmupDone = true;
      })
      .catch(function () { /* ignore */ })
      .finally(function () {
        dimState.warming = false;
      });

    if (!dimState.reloadTimer) dimStartReloadTimer();
  }

  function dimWarmup() {
    if (typeof isVisitor === 'function' && isVisitor()) {
      dimTeardownBridge();
      return;
    }
    if (typeof hasOperationalProfile === 'function' && !hasOperationalProfile()) return;
    if (!dimGetBridgeUrl()) return;

    dimEnsureIframe();
    dimLoadSlotOptionsFallback();
    dimEnsureDictionary().catch(function () { /* ignore */ });

    const week = dimState.week || dimGetIsoWeek();
    dimState.week = week;

    dimRestoreSession();
    dimTryInstantWeek(week, { render: false });
    dimWarmupFetchWeek();
    dimEnsureSessionBackground(8000).catch(function () { /* ignore */ });
  }

  function dimRenderConnectPrompt() {
    const grid = document.getElementById('dimGridWrap');
    const missingEmail = !dimGetCacheEmail();
    if (grid) {
      grid.innerHTML =
        '<div class="dim-empty-state">' +
        '<i class="ti ti-plug-connected" style="font-size:44px;opacity:.6"></i>' +
        (missingEmail
          ? '<p style="margin-top:14px;font-size:16px;font-weight:600">Cadastro incompleto</p>' +
            '<p style="font-size:13px;color:var(--text3);margin-top:8px;line-height:1.5">' +
            'Abra <strong>Seu perfil</strong> (ícone no canto), preencha <strong>E-mail Nubank</strong> e salve. Depois clique em Conectar.</p>'
          : '<p style="margin-top:14px;font-size:16px;font-weight:600">Conectar à planilha Google</p>' +
            '<p style="font-size:13px;color:var(--text3);margin-top:8px;line-height:1.5">' +
            'Clique no botão abaixo. Se abrir um popup <strong>Dim Bridge</strong>, aguarde fechar sozinho.</p>') +
        '<p style="margin-top:20px">' +
        '<button type="button" class="btn primary" style="font-size:15px;padding:12px 28px" onclick="dimConnectBridge()">' +
        '<i class="ti ti-plug"></i> Conectar à planilha</button></p></div>';
    }
    const el = document.getElementById('dimStatus');
    if (el) {
      el.className = 'dim-status visible warn';
      el.innerHTML = '<i class="ti ti-info-circle"></i><span>Clique em <strong>Conectar à planilha</strong> para carregar sua escala</span>';
    }
    const badge = document.getElementById('dimHeaderBadge');
    if (badge) badge.style.display = 'none';
  }

  function dimRenderEmptySetup() {
    const grid = document.getElementById('dimGridWrap');
    if (grid) {
      grid.innerHTML = '<div class="dim-empty-state"><i class="ti ti-link-off"></i><p>Configure a <strong>URL da ponte Apps Script</strong> em Configuração → Técnico para conectar à planilha de dimensionamento.</p></div>';
    }
  }

  function dimRenderError(msg) {
    const grid = document.getElementById('dimGridWrap');
    if (grid) {
      grid.innerHTML = '<div class="dim-empty-state"><i class="ti ti-alert-circle"></i><p>' + escapeHtml(msg) + '</p>' +
        '<p style="margin-top:10px;font-size:12px">Mantenha a janela <strong>Dim Bridge</strong> aberta enquanto usa esta página.</p>' +
        '<p style="margin-top:14px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">' +
        '<button type="button" class="btn primary" onclick="dimConnectBridge()"><i class="ti ti-plug"></i> Conectar à planilha</button>' +
        '<button type="button" class="btn" onclick="dimManualRefresh()"><i class="ti ti-refresh"></i> Atualizar</button>' +
        '</p></div>';
    }
    const el = document.getElementById('dimStatus');
    if (el) {
      el.className = 'dim-status err';
      el.innerHTML = '<i class="ti ti-alert-circle"></i><span>' + escapeHtml(msg) + '</span>';
    }
  }

  function dimNormalizeTime(t) {
    if (!t) return '';
    const parts = String(t).trim().split(':');
    if (parts.length >= 2) {
      const hh = String(parseInt(parts[0], 10)).padStart(2, '0');
      const mm = String(parts[1].replace(/\D/g, '').substring(0, 2)).padStart(2, '0');
      return hh + ':' + mm;
    }
    return String(t).trim();
  }

  function dimNormalizeScheduleTimes(schedule) {
    if (!schedule) return;
    if (schedule.config && schedule.config.timeSlots) {
      schedule.config.timeSlots = schedule.config.timeSlots.map(dimNormalizeTime).filter(Boolean);
    }
    (schedule.days || []).forEach(function (day) {
      if (!day.slots) return;
      const norm = {};
      Object.keys(day.slots).forEach(function (k) {
        norm[dimNormalizeTime(k)] = day.slots[k];
      });
      day.slots = norm;
    });
  }

  function dimDatesForWeek(weekNumber) {
    const simpleYear = 2026;
    const d = new Date(simpleYear, 0, 1 + (weekNumber - 1) * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    const out = {};
    for (let i = 0; i < DIM_DAY_KEYS.length; i++) {
      const current = new Date(monday);
      current.setDate(monday.getDate() + i);
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      out[DIM_DAY_KEYS[i]] = yyyy + '-' + mm + '-' + dd;
    }
    return out;
  }

  function dimEnsureDayDates(schedule) {
    const week = schedule.week || dimState.week || dimGetIsoWeek();
    const fallback = dimDatesForWeek(week);
    (schedule.days || []).forEach(function (day) {
      if (!day.date && fallback[day.day]) day.date = fallback[day.day];
    });
  }

  function dimApplySchedule(schedule, options) {
    options = options || {};
    dimState.schedule = schedule;
    dimEnsureSlotOptions(schedule);
    dimEnsureDayDates(schedule);
    dimNormalizeScheduleTimes(schedule);
    if (schedule.identity) {
      dimState.session = schedule.identity;
      dimSaveSession(schedule.identity);
    }
    if (options.render !== false) dimRenderAll();
  }

  function dimResolveDayDate(day) {
    if (!day) return '';
    if (day.date) return day.date;
    const fallback = dimDatesForWeek(dimState.week || dimGetIsoWeek());
    return fallback[day.day] || '';
  }

  async function dimLoadWeek(week, options) {
    options = options || {};
    const silent = !!options.silent;
    const loadId = ++dimState.loadWeekSeq;
    dimState.week = week;
    dimUpdateWeekLabel();

    if (!silent) {
      if (!options.skipCacheCheck) {
        const cached = dimReadWeekCache(week);
        if (cached) {
          dimApplySchedule(cached);
          dimSetLastUpdate();
          dimLoadWeek(week, { silent: true, skipCacheCheck: true }).catch(function () {});
          return;
        }
      }
      dimSetWeekLoading(true);
    } else {
      dimSetWeekRefreshing(true);
    }

    try {
      const schedule = await dimCall('getUserSchedule', {
        week: week,
        userEmail: dimResolveUserEmail() || undefined
      });
      if (loadId !== dimState.loadWeekSeq) return;
      dimApplySchedule(schedule);
      dimSaveWeekCache(week, schedule);
      dimSetLastUpdate();
      dimRefreshPendingBadge();

      dimLoadSlotOptionsFallback().then(function () {
        if (loadId !== dimState.loadWeekSeq || !dimState.schedule) return;
        dimEnsureSlotOptions(dimState.schedule);
      });
      dimEnsureDictionary().catch(function () { /* ignore */ });

      if (silent) dimUpdateStatus();
    } catch (e) {
      if (loadId !== dimState.loadWeekSeq) return;
      if (!silent) {
        const cached = dimReadWeekCache(week);
        if (dimState.schedule || cached) {
          if (cached && !dimState.schedule) dimTryInstantWeek(week);
          else if (dimState.schedule) dimRenderAll();
          dimShowToast('Atualização demorou — exibindo última versão salva', true);
        } else {
          dimRenderError(String(e.message || e));
        }
      }
    } finally {
      if (!silent) {
        dimSetWeekLoading(false);
      } else {
        dimSetWeekRefreshing(false);
      }
    }
  }

  function dimChangeWeek(delta) {
    dimLoadWeek((dimState.week || dimGetIsoWeek()) + delta);
  }

  function dimGoCurrentWeek() {
    dimLoadWeek(dimGetIsoWeek());
  }

  function dimSwitchTab(tab) {
    dimState.activeTab = tab;
    document.querySelectorAll('.dim-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.dimTab === tab);
    });
    document.querySelectorAll('.dim-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'dimPanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
    });
    if (tab === 'ajustes') dimRenderAjustes();
    if (tab === 'controle') {
      dimState.dictionary = null;
      dimEnsureDictionary().then(function () { dimRenderControle(); });
    }
  }

  function dimGetColors() {
    return (dimState.schedule && dimState.schedule.colors) || {};
  }

  /** Porta getColor() de gas/Estilos_Cores.html para hex (bg/text/border) */
  function dimSlotColorFromLabel(label) {
    const l = String(label).toLowerCase();

    if (l === 'edf') return { bg: '#11734b', text: '#ffffff', border: '#0e5c3a' };
    if (l === 'ma - cr') return { bg: '#ffcfc9', text: '#b10202', border: '#ff9e94' };
    if (l === 'break') return { bg: '#1f2937', text: '#ffffff', border: '#000000', borderWidth: '2px' };

    const darkGroup = ['avlb', 'dtq', 'quality monitoring', 'support', 'qlt', 'qlt-he'];
    if (darkGroup.indexOf(l) >= 0) return { bg: '#5C5C5C', text: '#ffffff', border: '#0f514c' };

    if (l.indexOf('jr -') === 0) return { bg: '#991b1b', text: '#ffffff', border: '#7f1d1d' };

    if (l === 'gm' || l === 'gs - gm' || l === 'planilhagm') {
      return { bg: '#8b5cf6', text: '#ffffff', border: '#7c3aed' };
    }

    const grayGroup = ['at', 'at-h', 'aus', 'escl', 'flg', 'flg-h', 'fr', 'itp', 'rt', 'oci', 'frdo'];
    if (grayGroup.indexOf(l) >= 0) return { bg: '#d1d5db', text: '#1f2937', border: '#9ca3af' };

    const beigeGroup = ['deep dive', 'docs', 'inv. brain', 'planilha', 'playbook', 'rfc', 'slides'];
    if (beigeGroup.indexOf(l) >= 0) return { bg: '#ffedd5', text: '#7c2d12', border: '#fed7aa' };

    const pinkGroup = [
      '1:1', 'meet-dt', 'monthly', 'mandatorios', 'move pratica', 'move teoria', 'pratica',
      'reciclagem', 'reuniao', 'qulture rocks', 'hub', 'mission control', 'project meet',
      'talk ic4', 'talk quality', 'weekly', 'dev', 'coffeebreak', 'teste-dt', 'trainer'
    ];
    if (pinkGroup.indexOf(l) >= 0) return { bg: '#fbcfe8', text: '#831843', border: '#f9a8d4' };

    const lilacGroup = [
      'drive', 'confluence', 'jira/atlassian', 'databricks', 'quicksight', 'workflow (slack)',
      'playvox', 'calibration', 'calibration packs', 'onb qlt', 'stk talk', 'extraction',
      'shadowing qlt', 'ai agent'
    ];
    if (lilacGroup.indexOf(l) >= 0) return { bg: '#e9d5ff', text: '#581c87', border: '#d8b4fe' };

    if (l === 'csat') return { bg: '#34d399', text: '#14532d', border: '#10b981' };
    if (l === 'projcsat') return { bg: '#6ee7b7', text: '#14532d', border: '#34d399' };
    if (l === 'id' || l === 'gs - id' || l === 'planilhaid') {
      return { bg: '#bbf7d0', text: '#14532d', border: '#86efac' };
    }
    if (l === 'id-vp') return { bg: '#5eead4', text: '#134e4a', border: '#2dd4bf' };
    if (l === 'vp' || l === 'gs - vp' || l === 'planilhavp') {
      return { bg: '#7dd3fc', text: '#0c4a6e', border: '#38bdf8' };
    }

    const csatGroup = ['flc', 'appeal flow', 'pangaea', 'reversals', 'obf', 'csat-he'];
    if (csatGroup.indexOf(l) >= 0) return { bg: '#93c5fd', text: '#1e3a8a', border: '#60a5fa' };

    if (l === 'dim_qlt') return { bg: '#e9d5ff', text: '#581c87', border: '#d8b4fe' };
    if (l === 'dim_csat') return { bg: '#bfdbfe', text: '#1e3a8a', border: '#93c5fd' };

    const projCsatGroup = [
      'fup legal', 'reativação obf', 'triagem obf', 'projeto csat', 'projflc', 'projaf', 'projrvs',
      'projonb', 'projops', 'projqlt', 'doc csat', 'reunião csat', 'weekly csat', 'sync rvs',
      'sync legal', 'sync ops', 'sync flc', 'sync af', 'sync qlt', 'sync onb', 'ops projeção',
      'ops ajustes', 'onboarding', 'prática', 'buddy', 'quality', 'rvs dd', 'legal dd', 'ops dd',
      'flc dd', 'af dd', 'qlt dd', 'qr csat', 'updates'
    ];
    if (projCsatGroup.indexOf(l) >= 0) return { bg: '#bfdbfe', text: '#1e3a8a', border: '#93c5fd' };

    return { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' };
  }

  function dimColorFor(slot) {
    if (!slot) return { bg: '#fafafa', text: '#9ca3af', border: '#e5e7eb' };
    const fromApi = dimGetColors()[slot];
    if (fromApi && fromApi.bg) return fromApi;
    return dimSlotColorFromLabel(slot);
  }

  function dimCellStyle(col) {
    let s = 'background:' + col.bg + ';color:' + col.text;
    if (col.border) {
      s += ';border-style:solid;border-color:' + col.border;
      s += ';border-width:' + (col.borderWidth || '1px');
    }
    return s;
  }

  function dimRenderAll() {
    dimRenderGrid();
    dimRenderSummary();
    if (dimState.activeTab === 'ajustes') dimRenderAjustes();
    if (dimState.activeTab === 'controle') dimRenderControle();
    dimUpdateWeekLabel();
  }

  function dimFindDay(dayKey) {
    const days = (dimState.schedule && dimState.schedule.days) || [];
    return days.find(function (d) { return d.day === dayKey; }) || null;
  }

  function dimCellKey(dayKey, time) {
    return dayKey + '|' + dimNormalizeTime(time);
  }

  function dimDayRowIndex(dayKey) {
    return DIM_DAY_KEYS.indexOf(dayKey);
  }

  function dimTimeColIndex(time) {
    const slots = (dimState.schedule && dimState.schedule.config.timeSlots) || [];
    return slots.indexOf(dimNormalizeTime(time));
  }

  function dimRectSelection(anchor, end) {
    const d0 = dimDayRowIndex(anchor.day);
    const d1 = dimDayRowIndex(end.day);
    const t0 = dimTimeColIndex(anchor.time);
    const t1 = dimTimeColIndex(end.time);
    if (d0 < 0 || d1 < 0 || t0 < 0 || t1 < 0) return [];
    const minD = Math.min(d0, d1);
    const maxD = Math.max(d0, d1);
    const minT = Math.min(t0, t1);
    const maxT = Math.max(t0, t1);
    const slots = dimState.schedule.config.timeSlots || [];
    const cells = [];
    for (let d = minD; d <= maxD; d++) {
      for (let t = minT; t <= maxT; t++) {
        if (DIM_DAY_KEYS[d] && slots[t]) {
          cells.push({ day: DIM_DAY_KEYS[d], time: slots[t] });
        }
      }
    }
    return cells;
  }

  function dimSetSelection(cells, anchor) {
    dimState.selection = cells || [];
    dimState.selectionAnchor = anchor || (cells && cells[0]) || null;
    if (dimState.selection.length > 1) dimHideMultiSelectHint();
    dimSyncSelectionVisual();
  }

  function dimClearSelection() {
    dimState.selection = [];
    dimState.selectionAnchor = null;
    dimState.selectDrag = false;
    dimState.selectDragMoved = false;
    dimSyncSelectionVisual();
  }

  function dimSyncSelectionVisual() {
    const keys = new Set((dimState.selection || []).map(function (c) {
      return dimCellKey(c.day, c.time);
    }));
    document.querySelectorAll('.dim-slot').forEach(function (cell) {
      const k = dimCellKey(cell.dataset.day, cell.dataset.time);
      cell.classList.toggle('selected', keys.has(k));
    });
  }

  function dimBindGridSelection() {
    if (dimState.gridSelectBound) return;
    const wrap = document.getElementById('dimGridWrap');
    if (!wrap) return;
    dimState.gridSelectBound = true;

    wrap.addEventListener('mousedown', function (e) {
      const cell = e.target.closest('.dim-slot');
      if (!cell || !dimState.schedule) return;
      if (e.button !== 0) return;
      e.preventDefault();

      const dayKey = cell.dataset.day;
      const time = cell.dataset.time;

      if (e.shiftKey && dimState.selectionAnchor) {
        dimSetSelection(dimRectSelection(dimState.selectionAnchor, { day: dayKey, time: time }), dimState.selectionAnchor);
        dimState.selectDrag = false;
        dimState.selectDragMoved = true;
        dimCloseDropdown();
        return;
      }

      dimState.selectDrag = true;
      dimState.selectDragMoved = false;
      dimState.selectionAnchor = { day: dayKey, time: time };
      dimSetSelection([{ day: dayKey, time: time }], dimState.selectionAnchor);
      dimCloseDropdown();
    });

    wrap.addEventListener('mouseover', function (e) {
      if (!dimState.selectDrag || !dimState.selectionAnchor) return;
      const cell = e.target.closest('.dim-slot');
      if (!cell) return;
      const cells = dimRectSelection(dimState.selectionAnchor, {
        day: cell.dataset.day,
        time: cell.dataset.time
      });
      if (cells.length > 1) dimState.selectDragMoved = true;
      dimSetSelection(cells, dimState.selectionAnchor);
    });

    document.addEventListener('mouseup', function () {
      const shouldHandle = dimState.selectDrag || dimState.selectDragMoved;
      dimState.selectDrag = false;
      if (!shouldHandle) return;

      if (dimState.selection.length === 1 && !dimState.selectDragMoved) {
        const c = dimState.selection[0];
        const anchorCell = wrap.querySelector(
          '.dim-slot[data-day="' + c.day + '"][data-time="' + c.time.replace(/"/g, '\\"') + '"]'
        );
        const day = dimFindDay(c.day);
        if (anchorCell && day) {
          dimOpenDropdown(anchorCell, day, c.time, day.slots[c.time] || '');
        }
      } else if (dimState.selection.length > 1) {
        const anchor = dimState.selectionAnchor || dimState.selection[0];
        const anchorCell = wrap.querySelector(
          '.dim-slot[data-day="' + anchor.day + '"][data-time="' + anchor.time.replace(/"/g, '\\"') + '"]'
        );
        const day = dimFindDay(anchor.day);
        if (anchorCell && day) {
          dimOpenDropdown(anchorCell, day, anchor.time, day.slots[anchor.time] || '');
        }
      }
      dimState.selectDragMoved = false;
    });

    document.addEventListener('mousedown', function (e) {
      if (!e.target.closest('#dimGridWrap') && !e.target.closest('.dim-dropdown') &&
          !e.target.closest('.dim-detail-modal-backdrop')) {
        if (!dimState.selectDrag) dimClearSelection();
      }
    });
  }

  function dimGetApplyTargets() {
    if (dimState.selection.length > 1) {
      return dimState.selection.map(function (c) {
        const day = dimFindDay(c.day);
        if (!day) return null;
        return { day: day, time: c.time, dayKey: c.day };
      }).filter(Boolean);
    }
    if (dimState.dropdown) {
      const d = dimState.dropdown.day;
      return [{ day: d, time: dimState.dropdown.time, dayKey: d.day }];
    }
    return [];
  }

  function dimRenderGrid() {
    const inner = dimEnsureGridShell();
    if (!inner || !dimState.schedule) return;

    const slots = dimState.schedule.config.timeSlots || [];
    let html = '<table class="dim-grid"><thead><tr><th class="dim-day-col">Dia</th>';
    slots.forEach(function (t) {
      html += '<th>' + escapeHtml(t) + '</th>';
    });
    html += '</tr></thead><tbody>';

    DIM_DAY_KEYS.forEach(function (dayKey) {
      const day = dimFindDay(dayKey);
      const issues = dimGetDayIssues(day);
      const hasAlert = issues.length > 0;
      const dayLabel = DIM_DAY_LABELS[dayKey];
      const dayTip = hasAlert ? issues.join(' — ') : dayLabel;
      html += '<tr class="' + (hasAlert ? 'dim-day-row-alert' : '') + '">';
      html += '<td class="dim-day-label" title="' + escapeHtml(dayTip) + '">';
      html += escapeHtml(dayLabel);
      if (day && day.date) {
        html += '<br><span style="font-weight:400;font-size:10px;color:var(--text3)">' + escapeHtml(day.date.slice(5)) + '</span>';
      }
      if (hasAlert) {
        html += '<span class="dim-day-alert-msg">' + escapeHtml(issues.join(' · ')) + '</span>';
      }
      html += '</td>';
      slots.forEach(function (time) {
        const val = day && day.slots ? (day.slots[time] || '') : '';
        const col = dimColorFor(val);
        const isBreak = dimIsBreakSlot(val);
        const cls = 'dim-slot' + (val ? '' : ' empty') + (isBreak ? ' is-break' : '');
        const tip = (val || 'Vazio') + ' · ' + time + ' · ' + dayLabel;
        html += '<td class="' + cls + '" data-day="' + dayKey + '" data-time="' + escapeHtml(time) + '"';
        html += ' style="' + dimCellStyle(col) + '"';
        html += ' title="' + escapeHtml(tip) + '">';
        html += '<span class="dim-slot-inner">' + escapeHtml(val || '·') + '</span>';
        html += '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    inner.innerHTML = html;
    dimSyncSelectionVisual();
    dimAfterGridRender();
  }

  function dimRenderSummary() {
    const el = document.getElementById('dimSummary');
    if (!el || !dimState.schedule) return;
    const summary = dimState.schedule.summary || {};
    const keys = Object.keys(summary).sort();
    if (!keys.length) {
      el.innerHTML = '<p style="color:var(--text3);font-size:13px">Nenhum slot preenchido nesta semana.</p>';
      return;
    }
    let html = '<div class="dim-summary-chips">';
    keys.forEach(function (k) {
      const count = summary[k];
      const hours = (count * 0.5).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      const col = dimColorFor(k);
      const safeK = escapeHtml(k).replace(/'/g, "\\'");
      html += '<span class="dim-summary-chip" style="' + dimCellStyle(col) + '" onclick="dimHighlightSlotInGrid(\'' + safeK + '\')" title="Clique para destacar na grade">';
      html += escapeHtml(k) + ' · <strong>' + count + '</strong> slots';
      html += ' <span class="dim-chip-hours">· ' + hours + 'h</span></span>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  function dimOpenDropdown(anchor, day, time, current) {
    dimCloseDropdown();
    dimState.editingCell = true;
    anchor.classList.add('editing');

    const backdrop = document.createElement('div');
    backdrop.className = 'dim-dropdown-backdrop';
    backdrop.onclick = dimCloseDropdown;

    const rect = anchor.getBoundingClientRect();
    const dd = document.createElement('div');
    dd.className = 'dim-dropdown';
    dd.style.top = Math.min(rect.bottom + 4, window.innerHeight - 320) + 'px';
    dd.style.left = Math.min(rect.left, window.innerWidth - 340) + 'px';

    const options = dimGetSlotOptions();
    const selCount = dimState.selection.length;
    const headerHtml = selCount > 1
      ? '<div class="dim-dropdown-header">' + selCount + ' slots selecionados</div>'
      : '';
    dd.innerHTML = headerHtml +
      '<div class="dim-dropdown-pin">' +
      '<div class="dim-dropdown-item dim-dropdown-clear-item" onclick="dimOnClearSlotClick()">' +
      '<span class="dim-dropdown-swatch dim-dropdown-swatch-clear"></span>(Limpar Slot)</div></div>' +
      '<div class="dim-dropdown-search"><input type="text" placeholder="Buscar slot…" id="dimDropdownSearch"></div>' +
      '<div class="dim-dropdown-list" id="dimDropdownList"></div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(dd);
    dimState.dropdown = { backdrop: backdrop, dd: dd, anchor: anchor, day: day, time: time, current: current };

    function renderList(filter) {
      const list = dd.querySelector('#dimDropdownList');
      const q = (filter || '').toLowerCase();
      const grouped = dimGetSlotGroups();
      let html = '';
      grouped.order.forEach(function (act) {
        const items = grouped.groups[act].filter(function (o) {
          return !q || o.toLowerCase().indexOf(q) >= 0;
        });
        if (!items.length) return;
        html += '<div class="dim-dropdown-group-label">' + escapeHtml(act) + '</div>';
        items.forEach(function (opt) {
          const col = dimColorFor(opt);
          html += '<div class="dim-dropdown-item" data-val="' + escapeHtml(opt) + '" onclick="dimApplySlot(this.dataset.val)">' +
            '<span class="dim-dropdown-swatch" style="background:' + col.bg + ';border:1px solid ' + (col.border || '#ddd') + '"></span>' +
            escapeHtml(opt) + '</div>';
        });
      });
      if (!html) {
        html = '<div style="padding:12px;color:var(--text3);font-size:13px">Nenhum slot encontrado</div>';
      }
      list.innerHTML = html;
    }
    renderList('');
    const inp = dd.querySelector('#dimDropdownSearch');
    inp.focus();
    inp.oninput = function () { renderList(inp.value); };
    inp.onkeydown = function (e) {
      if (e.key === 'Escape') dimCloseDropdown();
    };
  }

  function dimCloseDropdown() {
    if (!dimState.dropdown) return;
    dimState.dropdown.anchor.classList.remove('editing');
    dimState.dropdown.backdrop.remove();
    dimState.dropdown.dd.remove();
    dimState.dropdown = null;
    dimState.editingCell = false;
  }

  function dimApplySlotValue(day, time, current, newVal) {
    if (!day.slots) day.slots = {};
    day.slots[time] = newVal;
    if (dimState.schedule.summary) {
      if (current) {
        dimState.schedule.summary[current] = (dimState.schedule.summary[current] || 0) - 1;
        if (dimState.schedule.summary[current] <= 0) delete dimState.schedule.summary[current];
      }
      if (newVal) dimState.schedule.summary[newVal] = (dimState.schedule.summary[newVal] || 0) + 1;
    }
    day.filledCount = Object.keys(day.slots).filter(function (k) { return day.slots[k]; }).length;
  }

  function dimApplyBreakAt(day, time) {
    const times = (dimState.schedule && dimState.schedule.config.timeSlots) || [];
    const idx = times.indexOf(dimNormalizeTime(time));
    const changes = [];
    for (let i = 0; i < 2 && idx + i < times.length; i++) {
      const h = times[idx + i];
      const cur = day.slots[h] || '';
      if (cur === 'Break') continue;
      changes.push({ day: day.day, date: dimResolveDayDate(day), time: h, prev: cur, next: 'Break' });
      dimApplySlotValue(day, h, cur, 'Break');
    }
    return changes;
  }

  function dimExecuteClearCells(entries) {
    if (!entries || !entries.length) return;
    const undoBatch = [];
    const savesByDate = {};
    entries.forEach(function (entry) {
      const day = entry.day;
      const time = entry.time;
      const current = day.slots[time] || '';
      if (!current) return;
      const dateIso = dimResolveDayDate(day);
      if (!dateIso) return;
      undoBatch.push({ day: day.day, date: dateIso, time: time, prev: current, next: '' });
      dimApplySlotValue(day, time, current, '');
      if (!savesByDate[dateIso]) savesByDate[dateIso] = { dayKey: day.day, slots: {} };
      savesByDate[dateIso].slots[dimNormalizeTime(time)] = '';
    });
    if (!undoBatch.length) {
      dimShowToast('Nada para limpar', true);
      return;
    }
    dimPushUndoBatch(undoBatch);
    dimRenderGrid();
    dimRenderSummary();
    Object.keys(savesByDate).forEach(function (dateIso) {
      const meta = savesByDate[dateIso];
      Object.keys(meta.slots).forEach(function (t) {
        dimQueueSave(dateIso, t, meta.slots[t], meta.dayKey);
      });
    });
    dimClearSelection();
  }

  function dimOnClearSlotClick() {
    const targets = dimGetApplyTargets();
    if (!targets.length) return;
    dimCloseDropdown();
    if (targets.length > 1) {
      dimExecuteClearCells(targets.map(function (t) {
        return { day: t.day, time: t.time };
      }));
      return;
    }
    const t = targets[0];
    dimState.clearDraft = { day: t.day, time: t.time, dayKey: t.day.day };
    dimState.modalOpen = true;
    const bd = document.getElementById('dimClearBackdrop');
    const meta = document.getElementById('dimClearMeta');
    const qty = document.getElementById('dimClearQty');
    if (meta) {
      meta.textContent = 'Início: ' + t.time + ' · ' + (DIM_DAY_LABELS[t.dayKey] || t.dayKey);
    }
    if (qty) qty.value = '1';
    if (bd) bd.classList.add('active');
  }

  function dimCloseClearModal() {
    dimState.modalOpen = false;
    dimState.clearDraft = null;
    document.getElementById('dimClearBackdrop')?.classList.remove('active');
  }

  function dimClearQtyDelta(delta) {
    const inp = document.getElementById('dimClearQty');
    if (!inp) return;
    const cur = parseInt(inp.value, 10) || 1;
    inp.value = String(Math.max(1, Math.min(20, cur + delta)));
  }

  function dimConfirmClear() {
    const ctx = dimState.clearDraft;
    if (!ctx) return;
    const quantity = Math.max(1, Math.min(20, parseInt(document.getElementById('dimClearQty')?.value, 10) || 1));
    const times = (dimState.schedule && dimState.schedule.config.timeSlots) || [];
    const startIdx = times.indexOf(dimNormalizeTime(ctx.time));
    if (startIdx < 0) return;
    const entries = [];
    for (let i = 0; i < quantity && startIdx + i < times.length; i++) {
      entries.push({ day: ctx.day, time: times[startIdx + i] });
    }
    dimCloseClearModal();
    dimExecuteClearCells(entries);
  }

  function dimOpenApplyModal(ctx) {
    dimState.modalOpen = true;
    dimState.applyDraft = ctx;
    dimState.applyConfirmOvertime = false;
    const bd = document.getElementById('dimApplyBackdrop');
    if (!bd) return;
    document.getElementById('dimApplyTitle').textContent = ctx.slot;
    const meta = document.getElementById('dimApplyMeta');
    if (meta) {
      meta.textContent = 'Início: ' + ctx.time + ' · ' + (DIM_DAY_LABELS[ctx.dayKey] || ctx.dayKey);
    }
    const qty = document.getElementById('dimApplyQty');
    const minus = document.getElementById('dimApplyQtyMinus');
    const plus = document.getElementById('dimApplyQtyPlus');
    const initial = ctx.initialQuantity || 1;
    if (qty) {
      qty.value = String(ctx.fixedQty ? ctx.fixedQty : initial);
      qty.disabled = !!ctx.fixedQty;
      qty.oninput = function () {
        dimState.applyConfirmOvertime = false;
        dimApplyUpdateQtyHint();
      };
    }
    if (minus) minus.disabled = !!ctx.fixedQty;
    if (plus) plus.disabled = !!ctx.fixedQty;
    const ot = document.getElementById('dimApplyOvertime');
    if (ot) ot.style.display = 'none';
    dimApplyUpdateQtyHint();
    bd.classList.add('active');
  }

  function dimCloseApplyModal() {
    dimState.modalOpen = false;
    dimState.applyDraft = null;
    dimState.applyConfirmOvertime = false;
    document.getElementById('dimApplyBackdrop')?.classList.remove('active');
    const ot = document.getElementById('dimApplyOvertime');
    if (ot) ot.style.display = 'none';
  }

  function dimApplyQtyDelta(delta) {
    const draft = dimState.applyDraft;
    if (!draft || draft.fixedQty) return;
    dimState.applyConfirmOvertime = false;
    const inp = document.getElementById('dimApplyQty');
    if (!inp) return;
    const cur = parseInt(inp.value, 10) || 1;
    inp.value = String(Math.max(1, Math.min(20, cur + delta)));
    dimApplyUpdateQtyHint();
  }

  function dimApplyUpdateQtyHint() {
    const hint = document.getElementById('dimApplyQtyHint');
    const draft = dimState.applyDraft;
    const ot = document.getElementById('dimApplyOvertime');
    if (!hint || !draft) return;
    const qty = parseInt(document.getElementById('dimApplyQty')?.value, 10) || 1;
    const initial = draft.initialQuantity || 1;
    if (qty < initial) {
      hint.style.display = 'block';
      hint.textContent = 'Os slots excedentes (' + (initial - qty) + ') virarão AVLB.';
    } else {
      hint.style.display = 'none';
      hint.textContent = '';
    }
    if (ot) {
      if (dimState.applyConfirmOvertime) {
        ot.style.display = 'block';
      } else {
        const day = draft.day;
        const projected = dimProjectedDayTotal(day, draft.time, qty);
        ot.style.display = projected > dimMinSlotsAlert() ? 'block' : 'none';
      }
    }
  }

  function dimConfirmApplySlot() {
    const ctx = dimState.applyDraft;
    if (!ctx) return;
    const quantity = ctx.fixedQty || Math.max(1, Math.min(20, parseInt(document.getElementById('dimApplyQty')?.value, 10) || 1));
    const day = ctx.day;
    const projected = dimProjectedDayTotal(day, ctx.time, quantity);
    if (projected > dimMinSlotsAlert() && !dimState.applyConfirmOvertime) {
      dimState.applyConfirmOvertime = true;
      const ot = document.getElementById('dimApplyOvertime');
      if (ot) ot.style.display = 'block';
      return;
    }
    dimState.applyConfirmOvertime = false;
    const dateIso = dimResolveDayDate(day);
    if (!dateIso) {
      dimShowToast('Data do dia não encontrada — recarregue a semana', true);
      return;
    }
    const times = (dimState.schedule && dimState.schedule.config.timeSlots) || [];
    const startIdx = times.indexOf(dimNormalizeTime(ctx.time));
    if (startIdx < 0) return;
    const initialQty = ctx.initialQuantity || 1;
    const undoBatch = [];
    const savesByDate = { [dateIso]: { dayKey: day.day, slots: {} } };
    const maxSpan = Math.max(quantity, initialQty);

    for (let i = 0; i < maxSpan; i++) {
      const h = times[startIdx + i];
      if (!h) break;
      const prev = day.slots[h] || '';
      let next;
      if (i < quantity) next = ctx.slot;
      else if (i < initialQty) next = 'AVLB';
      else continue;
      if (prev === next) continue;
      undoBatch.push({ day: day.day, date: dateIso, time: h, prev: prev, next: next });
      dimApplySlotValue(day, h, prev, next);
      savesByDate[dateIso].slots[dimNormalizeTime(h)] = next;
    }

    dimCloseApplyModal();
    if (!undoBatch.length) return;

    dimPushUndoBatch(undoBatch);
    dimRenderGrid();
    dimRenderSummary();
    Object.keys(savesByDate).forEach(function (dIso) {
      const meta = savesByDate[dIso];
      Object.keys(meta.slots).forEach(function (t) {
        dimQueueSave(dIso, t, meta.slots[t], meta.dayKey);
      });
    });
  }

  function dimApplySlot(value) {
    const targets = dimGetApplyTargets();
    if (!targets.length) return;

    const newVal = value ? String(value) : '';
    const isMulti = targets.length > 1;
    dimCloseDropdown();

    const detailSlots = dimState.schedule.config.detailSlots || DIM_DETAIL_SLOTS;

    if (newVal && detailSlots.indexOf(newVal) >= 0) {
      const t = targets[0];
      const modalCtx = {
        slot: newVal,
        date: dimResolveDayDate(t.day),
        time: t.time,
        day: t.day.day
      };
      if (isMulti) {
        modalCtx.multiTargets = targets.map(function (x) {
          return {
            day: x.day.day,
            time: x.time,
            date: dimResolveDayDate(x.day)
          };
        });
      }
      const needsApply = targets.some(function (x) {
        return (x.day.slots[x.time] || '') !== newVal;
      });
      if (needsApply) {
        modalCtx.pendingApply = {
          targets: targets.map(function (x) {
            return { dayKey: x.day.day, day: x.day, time: x.time };
          }),
          newVal: newVal,
          isMulti: isMulti
        };
      }
      dimOpenDetailModal(modalCtx);
      if (isMulti) dimClearSelection();
      return;
    }

    if (!isMulti) {
      const t = targets[0];
      const current = t.day.slots[t.time] || '';
      let initialQuantity = 1;
      if (newVal && current === newVal) {
        initialQuantity = dimCountConsecutiveSlots(t.day, t.time, newVal);
      }
      if (newVal === 'Break') {
        dimOpenApplyModal({
          slot: 'Break',
          day: t.day,
          time: t.time,
          dayKey: t.day.day,
          initialQuantity: 2,
          fixedQty: 2
        });
        return;
      }
      if (newVal) {
        dimOpenApplyModal({
          slot: newVal,
          day: t.day,
          time: t.time,
          dayKey: t.day.day,
          initialQuantity: initialQuantity
        });
        return;
      }
    }

    const undoBatch = [];
    const savesByDate = {};

    function queueChange(day, time, prev, next) {
      const dateIso = dimResolveDayDate(day);
      if (!dateIso) return;
      undoBatch.push({ day: day.day, date: dateIso, time: time, prev: prev, next: next });
      if (!savesByDate[dateIso]) savesByDate[dateIso] = { dayKey: day.day, slots: {} };
      savesByDate[dateIso].slots[dimNormalizeTime(time)] = next;
    }

    if (newVal === 'Break') {
      targets.forEach(function (t) {
        dimApplyBreakAt(t.day, t.time).forEach(function (ch) {
          undoBatch.push(ch);
          const dateIso = ch.date;
          if (!dateIso) return;
          if (!savesByDate[dateIso]) savesByDate[dateIso] = { dayKey: ch.day, slots: {} };
          savesByDate[dateIso].slots[dimNormalizeTime(ch.time)] = ch.next;
        });
      });
    } else {
      targets.forEach(function (t) {
        const current = t.day.slots[t.time] || '';
        if (newVal === current) return;
        queueChange(t.day, t.time, current, newVal);
        dimApplySlotValue(t.day, t.time, current, newVal);
      });
    }

    if (!undoBatch.length) return;

    dimPushUndoBatch(undoBatch);

    dimRenderGrid();
    dimRenderSummary();

    Object.keys(savesByDate).forEach(function (dateIso) {
      const meta = savesByDate[dateIso];
      Object.keys(meta.slots).forEach(function (time) {
        dimQueueSave(dateIso, time, meta.slots[time], meta.dayKey);
      });
    });

    if (isMulti) dimClearSelection();
  }

  function dimPushUndoBatch(entries) {
    if (!entries || !entries.length) return;
    if (dimState.undoTimer) clearTimeout(dimState.undoTimer);
    dimState.undo = { batch: entries };
    const bar = document.getElementById('dimUndoBar');
    if (bar) {
      bar.classList.add('active');
      const label = entries.length > 1
        ? entries.length + ' slots alterados'
        : ('Alterado ' + entries[0].time + ' → ' + (entries[0].next || '(vazio)'));
      bar.querySelector('.dim-undo-label').textContent = label;
    }
    dimState.undoTimer = setTimeout(function () {
      dimState.undo = null;
      if (bar) bar.classList.remove('active');
    }, 4000);
  }

  function dimPushUndo(entry) {
    dimPushUndoBatch([entry]);
  }

  function dimUndoLast() {
    const u = dimState.undo;
    if (!u) return;
    const entries = u.batch || [u];
    entries.forEach(function (entry) {
      const day = dimFindDay(entry.day);
      if (!day) return;
      const cur = day.slots[entry.time] || '';
      dimApplySlotValue(day, entry.time, cur, entry.prev || '');
      const dateIso = dimResolveDayDate(day) || entry.date;
      if (dateIso) dimQueueSave(dateIso, entry.time, entry.prev || '', entry.day);
    });
    dimState.undo = null;
    document.getElementById('dimUndoBar')?.classList.remove('active');
    if (dimState.undoTimer) clearTimeout(dimState.undoTimer);
    dimRenderGrid();
    dimRenderSummary();
  }

  function dimQueueSave(date, time, value, dayKey) {
    if (!date) {
      dimShowToast('Data inválida — recarregue a semana', true);
      return;
    }
    if (!dimState.pendingSaves[date]) dimState.pendingSaves[date] = {};
    dimState.pendingSaves[date][time] = value;
    dimState.pendingMeta = dimState.pendingMeta || {};
    dimState.pendingMeta[date] = dayKey || (dimState.pendingMeta[date] || '');
    if (dimState.saveQueue.indexOf(date) < 0) dimState.saveQueue.push(date);
    dimProcessSaveQueue();
  }

  const DIM_SAVE_MAX_RETRIES = 2;
  const DIM_SAVE_RETRY_DELAY_MS = 5000;

  async function dimProcessSaveQueue() {
    if (dimState.saving || !dimState.saveQueue.length) return;
    dimState.saving = true;
    dimUpdateStatus();
    const date = dimState.saveQueue.shift();
    const slots = dimState.pendingSaves[date];
    delete dimState.pendingSaves[date];
    dimState.saveFailMeta = dimState.saveFailMeta || {};

    try {
      const res = await dimCall('saveBatchData', {
        week: dimState.week,
        date: date,
        day: (dimState.pendingMeta && dimState.pendingMeta[date]) || '',
        slots: slots,
        userEmail: dimSaveUserEmail()
      });
      delete dimState.saveFailMeta[date];
      if (res && res.validationRejected) {
        dimShowToast('Planilha rejeitou slot(s): verifique validação de dados', true);
      } else if (res && res.savedSlots === 0) {
        dimShowToast('Nada foi gravado na planilha — recarregue a semana e tente de novo', true);
      } else {
        dimInvalidateWeekCache(dimState.week);
        dimShowToast('Salvo na planilha' + (res && res.savedSlots ? ' (' + res.savedSlots + ' células)' : ''));
      }
    } catch (e) {
      const fail = dimState.saveFailMeta[date] || { count: 0 };
      fail.count++;
      fail.lastError = String(e.message || e);
      dimState.saveFailMeta[date] = fail;

      Object.keys(slots).forEach(function (time) {
        if (!dimState.pendingSaves[date]) dimState.pendingSaves[date] = {};
        dimState.pendingSaves[date][time] = slots[time];
      });

      if (fail.count <= DIM_SAVE_MAX_RETRIES) {
        if (dimState.saveQueue.indexOf(date) < 0) dimState.saveQueue.push(date);
        dimShowToast('Erro ao salvar (tentativa ' + fail.count + '/' + DIM_SAVE_MAX_RETRIES + '): ' + fail.lastError, true);
      } else {
        delete dimState.saveFailMeta[date];
        dimShowToast('Não foi possível salvar. Verifique a URL da ponte (Config → Técnico) ou use o GAS direto. ' + fail.lastError, true);
      }
    }

    if (dimState.pendingMeta) delete dimState.pendingMeta[date];

    dimState.saving = false;
    dimUpdateStatus();
    if (!dimState.saveQueue.length) return;

    const nextDate = dimState.saveQueue[0];
    const nextFail = (dimState.saveFailMeta[nextDate] && dimState.saveFailMeta[nextDate].count) || 0;
    const delay = nextFail > 0 ? DIM_SAVE_RETRY_DELAY_MS * nextFail : 0;
    setTimeout(function () { dimProcessSaveQueue(); }, delay);
  }

  function dimShouldPauseReload() {
    return dimState.editingCell || dimState.modalOpen || dimState.saving ||
      dimState.loadingWeek || dimState.selectDrag || dimState.saveQueue.length > 0 ||
      Object.keys(dimState.pendingSaves).length > 0;
  }

  function dimStartReloadTimer() {
    if (dimState.reloadTimer) clearInterval(dimState.reloadTimer);
    dimState.reloadTimer = setInterval(function () {
      if (document.getElementById('pageDimensionamento')?.classList.contains('active') &&
          !dimShouldPauseReload()) {
        dimLoadWeek(dimState.week, { silent: true });
      }
    }, 60000);
  }

  function dimGetSlotDetailConfig(slot) {
    return DIM_SLOT_DETAIL_CONFIG[slot] || null;
  }

  function dimDetailRequiresSpec(action, project) {
    return action === 'Outro' || project === 'Outro' ||
      project === 'MMP (Projeto não mapeado)' || project === 'NMP (Projeto não mapeado)';
  }

  function dimPopulateDetailSelect(el, options, selected) {
    if (!el) return;
    const opts = options || [];
    let html = '<option value="" disabled' + (selected ? '' : ' selected') + '>Selecione...</option>';
    opts.forEach(function (opt) {
      html += '<option value="' + escapeHtml(opt) + '"' + (opt === selected ? ' selected' : '') + '>' +
        escapeHtml(opt) + '</option>';
    });
    el.innerHTML = html;
  }

  function dimCountConsecutiveSlots(day, time, slotName) {
    const times = (dimState.schedule && dimState.schedule.config && dimState.schedule.config.timeSlots) || [];
    const startIdx = times.indexOf(dimNormalizeTime(time));
    if (startIdx < 0) return 1;
    let count = 0;
    for (let i = 0; i < 20; i++) {
      const h = times[startIdx + i];
      if (!h) break;
      if ((day.slots[h] || '') === slotName) count++;
      else break;
    }
    return count || 1;
  }

  function dimDetailFieldChange() {
    const acao = document.getElementById('dimDetailAcao')?.value || '';
    const projeto = document.getElementById('dimDetailProjeto')?.value || '';
    const specWrap = document.getElementById('dimDetailSpecWrap');
    if (specWrap) specWrap.style.display = dimDetailRequiresSpec(acao, projeto) ? 'block' : 'none';
  }

  function dimDetailQtyDelta(delta) {
    dimState.detailConfirmOvertime = false;
    const inp = document.getElementById('dimDetailQty');
    if (!inp) return;
    const cur = parseInt(inp.value, 10) || 1;
    const next = Math.max(1, Math.min(20, cur + delta));
    inp.value = String(next);
    dimDetailUpdateQtyHint();
  }

  function dimDetailUpdateQtyHint() {
    const hint = document.getElementById('dimDetailQtyHint');
    const draft = dimState.detailDraft;
    const ot = document.getElementById('dimDetailOvertime');
    if (!hint || !draft) return;
    const qty = parseInt(document.getElementById('dimDetailQty')?.value, 10) || 1;
    const initial = draft.initialQuantity || 1;
    if (qty < initial) {
      hint.style.display = 'block';
      hint.textContent = 'Os slots excedentes (' + (initial - qty) + ') virarão AVLB.';
    } else {
      hint.style.display = 'none';
      hint.textContent = '';
    }
    if (ot) {
      if (dimState.detailConfirmOvertime) {
        ot.style.display = 'block';
      } else if (draft.day) {
        const day = dimFindDay(draft.day);
        const projected = day ? dimProjectedDayTotal(day, draft.time, qty) : 0;
        ot.style.display = projected > dimMinSlotsAlert() ? 'block' : 'none';
      }
    }
  }

  function dimApplyDetailDuration(day, startTime, slotName, quantity, initialQuantity) {
    const times = (dimState.schedule && dimState.schedule.config && dimState.schedule.config.timeSlots) || [];
    const startIdx = times.indexOf(dimNormalizeTime(startTime));
    const slotUpdates = {};
    const maxSpan = Math.max(quantity, initialQuantity || 1);

    for (let i = 0; i < maxSpan; i++) {
      const h = times[startIdx + i];
      if (!h) break;
      const prev = day.slots[h] || '';
      let next;
      if (i < quantity) next = slotName;
      else if (i < (initialQuantity || 0)) next = 'AVLB';
      else continue;

      if (prev === next) continue;
      day.slots[h] = next;
      slotUpdates[h] = next;

      if (dimState.schedule.summary) {
        if (prev) {
          dimState.schedule.summary[prev] = (dimState.schedule.summary[prev] || 0) - 1;
          if (dimState.schedule.summary[prev] <= 0) delete dimState.schedule.summary[prev];
        }
        if (next) {
          dimState.schedule.summary[next] = (dimState.schedule.summary[next] || 0) + 1;
        }
      }
    }

    day.filledCount = Object.keys(day.slots).filter(function (k) { return day.slots[k]; }).length;
    return slotUpdates;
  }

  function dimOpenDetailModal(ctx) {
    dimState.modalOpen = true;
    dimState.detailConfirmOvertime = false;
    const config = dimGetSlotDetailConfig(ctx.slot);
    const day = ctx.day ? dimFindDay(ctx.day) : null;
    const initialQuantity = ctx.quantidade || (day ? dimCountConsecutiveSlots(day, ctx.time, ctx.slot) : 1);

    dimState.detailDraft = Object.assign({}, ctx, {
      initialQuantity: initialQuantity,
      detailConfig: config
    });

    const bd = document.getElementById('dimDetailBackdrop');
    if (!bd) return;

    document.getElementById('dimDetailTitle').textContent = ctx.slot;
    const meta = document.getElementById('dimDetailMeta');
    if (meta) {
      if (ctx.multiTargets && ctx.multiTargets.length > 1) {
        meta.textContent = ctx.multiTargets.length + ' slots selecionados · ' + ctx.slot;
      } else {
        meta.textContent = 'Início: ' + ctx.time + ' • ' + (ctx.day || '');
      }
    }

    const qtyInp = document.getElementById('dimDetailQty');
    const fieldsBlock = document.getElementById('dimDetailFieldsBlock');
    const durationBlock = document.getElementById('dimDetailDurationBlock');
    const isMulti = ctx.multiTargets && ctx.multiTargets.length > 1;
    if (isMulti) {
      if (qtyInp) { qtyInp.value = '1'; qtyInp.disabled = true; }
      if (durationBlock) durationBlock.style.display = 'none';
    } else {
      if (qtyInp) {
        qtyInp.disabled = false;
        qtyInp.value = String(initialQuantity);
      }
    }
    if (config) {
      if (fieldsBlock) fieldsBlock.style.display = 'block';
      if (durationBlock && !isMulti) durationBlock.style.display = 'block';

      dimPopulateDetailSelect(document.getElementById('dimDetailAcao'), config.actions, ctx.acao || '');
      const projetoWrap = document.getElementById('dimDetailProjetoWrap');
      if (config.hasProjectField) {
        if (projetoWrap) projetoWrap.style.display = 'block';
        dimPopulateDetailSelect(document.getElementById('dimDetailProjeto'), config.projects, ctx.projeto || '');
      } else if (projetoWrap) {
        projetoWrap.style.display = 'none';
        const projEl = document.getElementById('dimDetailProjeto');
        if (projEl) projEl.innerHTML = '<option value=""></option>';
      }

      const specEl = document.getElementById('dimDetailSpec');
      if (specEl) specEl.value = ctx.especificacao || '';
      dimDetailFieldChange();
    } else {
      if (fieldsBlock) fieldsBlock.style.display = 'none';
      if (durationBlock) durationBlock.style.display = 'none';
    }

    const ot = document.getElementById('dimDetailOvertime');
    if (ot) ot.style.display = 'none';
    if (qtyInp) qtyInp.oninput = function () {
      dimState.detailConfirmOvertime = false;
      dimDetailUpdateQtyHint();
    };
    dimDetailUpdateQtyHint();
    bd.classList.add('active');
  }

  function dimCloseDetailModal() {
    dimState.modalOpen = false;
    dimState.detailDraft = null;
    dimState.detailConfirmOvertime = false;
    document.getElementById('dimDetailBackdrop')?.classList.remove('active');
    const ot = document.getElementById('dimDetailOvertime');
    if (ot) ot.style.display = 'none';
  }

  function dimApplyPendingDetailSlots(pending) {
    if (!pending || !pending.targets || !pending.newVal) return {};
    const undoBatch = [];
    const savesByDate = {};
    pending.targets.forEach(function (t) {
      const current = t.day.slots[t.time] || '';
      const dateIso = dimResolveDayDate(t.day);
      if (!dateIso) return;
      undoBatch.push({ day: t.dayKey, date: dateIso, time: t.time, prev: current, next: pending.newVal });
      dimApplySlotValue(t.day, t.time, current, pending.newVal);
      if (!savesByDate[dateIso]) savesByDate[dateIso] = { dayKey: t.dayKey, slots: {} };
      savesByDate[dateIso].slots[dimNormalizeTime(t.time)] = pending.newVal;
    });
    if (undoBatch.length) dimPushUndoBatch(undoBatch);
    return savesByDate;
  }

  async function dimSaveDetail() {
    const ctx = dimState.detailDraft;
    if (!ctx || dimState.detailSaving) return;

    const config = ctx.detailConfig || dimGetSlotDetailConfig(ctx.slot);
    const acao = document.getElementById('dimDetailAcao')?.value || '';
    const projeto = config && config.hasProjectField ? (document.getElementById('dimDetailProjeto')?.value || '') : '';
    const especificacao = document.getElementById('dimDetailSpec')?.value.trim() || '';
    const quantity = Math.max(1, Math.min(20, parseInt(document.getElementById('dimDetailQty')?.value, 10) || 1));

    if (config) {
      if (!acao) {
        dimShowToast('Selecione a Ação Realizada.', true);
        return;
      }
      if (config.hasProjectField && !projeto) {
        dimShowToast('Selecione o Projeto.', true);
        return;
      }
      if (dimDetailRequiresSpec(acao, projeto) && !especificacao) {
        dimShowToast('Especifique os detalhes em "Se Outro, especificar".', true);
        return;
      }
    }

    const day = dimFindDay(ctx.day);
    const dateIso = ctx.date || (day ? dimResolveDayDate(day) : '');
    const targets = (ctx.multiTargets && ctx.multiTargets.length > 1)
      ? ctx.multiTargets
      : [{ day: ctx.day, time: ctx.time, date: ctx.date || dateIso }];

    if (day && targets.length === 1 && !ctx.pendingApply) {
      const projected = dimProjectedDayTotal(day, ctx.time, quantity);
      if (projected > dimMinSlotsAlert() && !dimState.detailConfirmOvertime) {
        dimState.detailConfirmOvertime = true;
        const ot = document.getElementById('dimDetailOvertime');
        if (ot) ot.style.display = 'block';
        return;
      }
    }
    dimState.detailConfirmOvertime = false;

    if (!dateIso && !ctx.pendingApply && !targets.some(function (t) {
      const d = dimFindDay(t.day);
      return t.date || (d ? dimResolveDayDate(d) : '');
    })) {
      dimShowToast('Data do dia não encontrada — recarregue a semana', true);
      return;
    }

    dimState.detailSaving = true;
    const saveBtn = document.querySelector('#dimDetailBackdrop .btn.primary');
    if (saveBtn) saveBtn.disabled = true;

    if (ctx.pendingApply) {
      const savesByDate = dimApplyPendingDetailSlots(ctx.pendingApply);
      dimRenderGrid();
      dimRenderSummary();
      Object.keys(savesByDate).forEach(function (dIso) {
        const meta = savesByDate[dIso];
        Object.keys(meta.slots).forEach(function (ts) {
          dimQueueSave(dIso, ts, meta.slots[ts], meta.dayKey);
        });
      });
    }

    const detailPayloads = [];
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const tDay = dimFindDay(t.day);
      const tDate = t.date || (tDay ? dimResolveDayDate(tDay) : '');
      if (!tDate) continue;

      if (i === 0 && tDay && targets.length === 1 && !ctx.pendingApply) {
        const slotUpdates = dimApplyDetailDuration(tDay, t.time, ctx.slot, quantity, ctx.initialQuantity || 1);
        dimRenderGrid();
        dimRenderSummary();
        if (Object.keys(slotUpdates).length) {
          Object.keys(slotUpdates).forEach(function (ts) {
            dimQueueSave(tDate, dimNormalizeTime(ts), slotUpdates[ts], tDay.day);
          });
        }
      }

      detailPayloads.push({
        tipo: ctx.slot,
        slot: ctx.slot,
        date: tDate,
        hora: t.time,
        time: t.time,
        quantidade: targets.length > 1 ? 1 : quantity,
        acao: acao,
        projeto: projeto,
        especificacao: especificacao
      });
    }

    dimCloseDetailModal();
    dimClearSelection();
    dimState.detailSaving = false;

    if (!detailPayloads.length) {
      dimShowToast('Data do dia não encontrada — recarregue a semana', true);
      return;
    }

    (async function () {
      try {
        const userEmail = dimSaveUserEmail();
        for (let i = 0; i < detailPayloads.length; i++) {
          if (userEmail) detailPayloads[i].userEmail = userEmail;
          await dimCall('saveDetail', detailPayloads[i]);
        }
        dimInvalidateWeekCache(dimState.week);
        dimShowToast(detailPayloads.length > 1
          ? 'Detalhes salvos em ' + detailPayloads.length + ' slots'
          : 'Detalhe salvo em Base_Detalhes');
        dimRefreshPendingBadge();
        if (dimState.activeTab === 'ajustes') dimRenderAjustes();
      } catch (e) {
        dimShowToast('Erro ao salvar detalhe: ' + e.message, true);
      }
    })();
  }

  async function dimRenderAjustes() {
    const el = document.getElementById('dimAjustesList');
    if (!el) return;
    if (!dimState.schedule) {
      el.innerHTML = '<p style="color:var(--text3);font-size:14px">Carregue a escala semanal primeiro.</p>';
      return;
    }
    el.innerHTML = '<div class="dim-controle-empty"><span class="dim-saving-dot"></span> Carregando ajustes…</div>';
    try {
      const res = await dimFetchAdjustmentsData();
      dimRenderAjustesTable(el, res);
    } catch (e) {
      el.innerHTML = '<p class="dim-status err">' + escapeHtml(e.message) + '</p>';
    }
  }

  function dimOnAjustesSearch(value) {
    dimState.ajustesSearch = value || '';
    dimRenderAjustes();
  }

  function dimEditAdjustmentByIndex(idx) {
    const list = dimState.adjustmentsList || [];
    const q = (dimState.ajustesSearch || '').toLowerCase().trim();
    const filtered = list.filter(function (r) {
      if (!q) return true;
      const dayLabel = (DIM_DAY_LABELS[r.day] || r.dayLabel || r.day || '').toLowerCase();
      return String(r.slot || '').toLowerCase().indexOf(q) >= 0 ||
        dayLabel.indexOf(q) >= 0 ||
        String(r.date || '').indexOf(q) >= 0;
    });
    const r = filtered[idx];
    if (!r) return;
    dimEditPending(r);
  }

  function dimEditPendingByIndex(idx) {
    const p = dimState.pendingList[idx];
    if (!p) return;
    dimEditPending(p);
  }

  function dimEditPending(p) {
    dimOpenDetailModal({
      slot: p.slot,
      date: p.date,
      time: p.time,
      day: p.day,
      quantidade: p.count || 1,
      acao: p.acao,
      projeto: p.projeto,
      especificacao: p.especificacao
    });
  }

  function dimRenderControle() {
    const el = document.getElementById('dimControleBody');
    if (!el) return;
    if (!dimState.dictionary || !dimState.dictionary.items) {
      el.innerHTML = '<div class="dim-controle-empty"><span class="dim-saving-dot"></span> Carregando definições…</div>';
      return;
    }
    const q = (document.getElementById('dimControleSearch')?.value || '').toLowerCase();
    const items = (dimState.dictionary.items || []).filter(function (it) {
      if (!q) return true;
      const hay = [it.atividade, it.tipoSlot, it.significado, it.classificacao, it.conversao].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    const groups = {};
    const order = [];
    items.forEach(function (it) {
      const atividade = it.atividade || 'Outros';
      if (!groups[atividade]) {
        groups[atividade] = [];
        order.push(atividade);
      }
      groups[atividade].push(it);
    });
    if (!order.length) {
      el.innerHTML = '<div class="dim-controle-empty"><p>Nenhum resultado encontrado.</p><p class="dim-controle-empty-sub">Tente buscar por outro termo.</p></div>';
      return;
    }
    let html = '<p class="dim-controle-meta">' + items.length + ' slots · ' + order.length + ' grupos</p>';
    order.forEach(function (atividade) {
      const rows = groups[atividade];
      html += '<section class="dim-controle-block">';
      html += '<div class="dim-controle-block-head"><span class="dim-controle-dot"></span>';
      html += '<h4>' + escapeHtml(atividade) + '</h4>';
      html += '<span class="dim-controle-count">' + rows.length + '</span></div>';
      html += '<div class="dim-controle-table-wrap"><table class="dim-controle-table">';
      html += '<thead><tr><th>Tipo de Slot</th><th>Significado / Regra</th><th>Classificação</th><th class="dim-controle-conv">Conv.</th></tr></thead><tbody>';
      rows.forEach(function (it) {
        html += '<tr>';
        html += '<td class="dim-controle-tipo">' + dimSlotBadgeHtml(it.tipoSlot) + '</td>';
        html += '<td class="dim-controle-significado">' + escapeHtml(it.significado || '—') + '</td>';
        html += '<td><span class="dim-controle-class">' + escapeHtml(dimFormatDictionaryText(it.classificacao)) + '</span></td>';
        html += '<td class="dim-controle-conv"><span class="dim-controle-conv-val" title="Como esse slot irá aparecer no planilhão/DIM oficial">' +
          escapeHtml(it.conversao || '—') + '</span></td>';
        html += '</tr>';
      });
      html += '</tbody></table></div></section>';
    });
    el.innerHTML = html;
  }

  function dimManualRefresh() {
    const week = dimState.week || dimGetIsoWeek();
    if (dimTryInstantWeek(week)) {
      dimRefreshWeekInBackground(week);
      return;
    }
    dimLoadWeek(week).catch(function () {
      dimConnectBridge();
    });
  }

  // Export globals
  global.dimInit = dimInit;
  global.dimEnsureLoaded = dimEnsureLoaded;
  global.dimWarmup = dimWarmup;
  global.dimScheduleWarmup = dimScheduleWarmup;
  global.dimTeardownBridge = dimTeardownBridge;
  global.dimChangeWeek = dimChangeWeek;
  global.dimGoCurrentWeek = dimGoCurrentWeek;
  global.dimSwitchTab = dimSwitchTab;
  global.dimApplySlot = dimApplySlot;
  global.dimCloseDropdown = dimCloseDropdown;
  global.dimUndoLast = dimUndoLast;
  global.dimOpenDetailModal = dimOpenDetailModal;
  global.dimCloseDetailModal = dimCloseDetailModal;
  global.dimSaveDetail = dimSaveDetail;
  global.dimDetailFieldChange = dimDetailFieldChange;
  global.dimDetailQtyDelta = dimDetailQtyDelta;
  global.dimEditPending = dimEditPending;
  global.dimEditPendingByIndex = dimEditPendingByIndex;
  global.dimEditAdjustmentByIndex = dimEditAdjustmentByIndex;
  global.dimOnAjustesSearch = dimOnAjustesSearch;
  global.dimRenderControle = dimRenderControle;
  global.dimOnClearSlotClick = dimOnClearSlotClick;
  global.dimCloseClearModal = dimCloseClearModal;
  global.dimClearQtyDelta = dimClearQtyDelta;
  global.dimConfirmClear = dimConfirmClear;
  global.dimCloseApplyModal = dimCloseApplyModal;
  global.dimApplyQtyDelta = dimApplyQtyDelta;
  global.dimConfirmApplySlot = dimConfirmApplySlot;
  global.dimConnectBridge = dimConnectBridge;
  global.dimManualRefresh = dimManualRefresh;
  global.dimGetBridgeUrl = dimGetBridgeUrl;
  global.dimSetBridgeUrl = dimSetBridgeUrl;
  global.dimToggleWeekMenu = dimToggleWeekMenu;
  global.dimSelectWeek = dimSelectWeek;
  global.dimGridZoom = dimGridZoom;
  global.dimHighlightSlotInGrid = dimHighlightSlotInGrid;
  global.dimGoToSlot = dimGoToSlot;
  global.dimToggleHelp = dimToggleHelp;

})(typeof window !== 'undefined' ? window : this);
