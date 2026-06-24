/**
 * Dimensionamento ID Quality/Csat — cliente Hub + ponte Apps Script
 */
(function (global) {
  'use strict';

  const DIM_DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex'];
  const DIM_DAY_LABELS = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex' };

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
    saving: false,
    undo: null,
    undoTimer: null,
    reloadTimer: null,
    editingCell: false,
    modalOpen: false,
    activeTab: 'escala',
    dropdown: null,
    pendingList: [],
    detailDraft: null,
    bridgePopup: null,
    slotOptionsFallback: null,
    dictionaryFallback: null,
    selection: [],
    selectionAnchor: null,
    selectDrag: false,
    selectDragMoved: false,
    gridSelectBound: false
  };

  function dimLoadDictionaryFallback() {
    if (dimState.dictionaryFallback) {
      return Promise.resolve(dimState.dictionaryFallback);
    }
    return fetch('dim-slot-dictionary.json?_=' + Date.now(), { cache: 'no-store' })
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

  function dimLoadSlotOptionsFallback() {
    if (dimState.slotOptionsFallback) {
      return Promise.resolve(dimState.slotOptionsFallback);
    }
    return fetch('dim-slot-options.json?_=' + Date.now(), { cache: 'no-store' })
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
    if (typeof data !== 'undefined' && data.dimensionamento && data.dimensionamento.bridgeUrl) {
      return String(data.dimensionamento.bridgeUrl).trim();
    }
    return (localStorage.getItem('qhub_dim_bridge_url') || '').trim();
  }

  function dimSetBridgeUrl(url) {
    const v = String(url || '').trim();
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
      if (parsed.ts && Date.now() - parsed.ts > 3600000) return null;
      return parsed.session;
    } catch (e) {
      return null;
    }
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
    if (!current || current.indexOf('view=bridge') < 0) {
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
    return raw
      .replace(/([?&])view=bridge(&|$)/g, function (m, p1, p2) { return p2 === '&' ? p1 : ''; })
      .replace(/[?&]$/, '');
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
        dimJsonpApi('getSessionInfo', {}, 20000).then(function (s) {
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

      setTimeout(tryJsonp, 6000);
    });
  }

  async function dimConnectBridge() {
    const url = dimBridgeBaseUrl();
    if (!url) {
      dimShowToast('Configure a URL da ponte em Configuração → Técnico', true);
      return;
    }
    const w = dimOpenBridgePopup();
    if (!w) {
      dimRenderError('Pop-up bloqueado. No Chrome: ícone à direita da barra de endereço → sempre permitir pop-ups neste site.');
      return;
    }
    dimReloadBridgeIframe();
    const grid = document.getElementById('dimGridWrap');
    if (grid) {
      grid.innerHTML = '<div class="dim-empty-state"><span class="dim-saving-dot"></span><p>Conectando…<br>O popup vai redirecionar e fechar sozinho.</p></div>';
    }
    dimUpdateStatus();
    try {
      await dimWaitForBridgeReady(90000);
      await dimLoadWeek(dimState.week || dimGetIsoWeek());
      dimStartReloadTimer();
    } catch (e) {
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
      if (document.getElementById('pageDimensionamento')?.classList.contains('active')) {
        const wk = dimState.week || dimGetIsoWeek();
        dimLoadWeek(wk).catch(function () {});
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

  function dimCall(action, payload, timeoutMs) {
    const url = dimGetBridgeUrl();
    if (!url) {
      return Promise.reject(new Error('URL da ponte não configurada. Admin: Configuração → Técnico → URL Dimensionamento.'));
    }
    return dimJsonpApi(action, payload, timeoutMs).catch(function () {
      return dimFetchApi(action, payload, timeoutMs).catch(function () {
        return dimCallViaPostMessage(action, payload, timeoutMs);
      });
    });
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

  function dimUpdateStatus() {
    const el = document.getElementById('dimStatus');
    if (!el) return;
    const url = dimBridgeBaseUrl();
    if (!url) {
      el.className = 'dim-status warn';
      el.innerHTML = '<i class="ti ti-alert-triangle"></i><span>Configure a URL da ponte em Configuração → Técnico</span>';
      return;
    }
    if (dimState.saving || dimState.saveQueue.length) {
      el.className = 'dim-status pending';
      el.innerHTML = '<span class="dim-saving-dot"></span><span>Salvando alterações…</span>';
      return;
    }
    if (dimState.session && dimState.session.email) {
      let html = '<i class="ti ti-circle-check"></i><span>Conectado como <strong>' + escapeHtml(dimState.session.email) + '</strong></span>';
      if (dimEmailMismatch()) {
        html += ' <span style="margin-left:8px">⚠ E-mail diferente do cadastro Hub</span>';
      }
      el.className = dimEmailMismatch() ? 'dim-status warn' : 'dim-status ok';
      el.innerHTML = html;
      return;
    }
    el.className = 'dim-status pending';
    el.innerHTML = '<span class="dim-saving-dot"></span><span>Conectando ao Google…</span>';
  }

  function dimShowToast(msg, isErr) {
    if (typeof showStatus === 'function') showStatus(msg, isErr);
    else if (isErr) console.error(msg); else console.log(msg);
  }

  async function dimInit() {
    dimBindGridSelection();
    if (dimState.week == null) dimState.week = dimGetIsoWeek();
    const url = dimGetBridgeUrl();
    if (!url) {
      dimRenderEmptySetup();
      return;
    }
    dimUpdateStatus();
    const stored = dimReadStoredSession();
    if (stored) {
      dimState.session = stored;
      dimState.bridgeReady = true;
    }
    if (dimState.session) {
      try {
        await dimLoadWeek(dimState.week);
        dimStartReloadTimer();
      } catch (e) {
        dimState.session = null;
        try { localStorage.removeItem('qhub_dim_session'); } catch (err) { /* ignore */ }
        dimRenderConnectPrompt();
      }
      return;
    }
    dimRenderConnectPrompt();
  }

  function dimRenderConnectPrompt() {
    const grid = document.getElementById('dimGridWrap');
    if (grid) {
      grid.innerHTML =
        '<div class="dim-empty-state">' +
        '<i class="ti ti-plug-connected" style="font-size:44px;opacity:.6"></i>' +
        '<p style="margin-top:14px;font-size:16px;font-weight:600">Conectar à planilha Google</p>' +
        '<p style="font-size:13px;color:var(--text3);margin-top:8px;line-height:1.5">' +
        'Clique no botão abaixo. Uma janela <strong>Dim Bridge</strong> vai abrir — ' +
        '<strong>mantenha-a aberta</strong> enquanto usa esta página.</p>' +
        '<p style="margin-top:20px">' +
        '<button type="button" class="btn primary" style="font-size:15px;padding:12px 28px" onclick="dimConnectBridge()">' +
        '<i class="ti ti-plug"></i> Conectar à planilha</button></p></div>';
    }
    const el = document.getElementById('dimStatus');
    if (el) {
      el.className = 'dim-status warn';
      el.innerHTML = '<i class="ti ti-info-circle"></i><span>Clique em <strong>Conectar à planilha</strong> para carregar sua escala</span>';
    }
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

  function dimResolveDayDate(day) {
    if (!day) return '';
    if (day.date) return day.date;
    const fallback = dimDatesForWeek(dimState.week || dimGetIsoWeek());
    return fallback[day.day] || '';
  }

  async function dimLoadWeek(week) {
    dimState.week = week;
    const label = document.getElementById('dimWeekLabel');
    if (label) label.textContent = 'Semana ' + week + (week <= 26 ? ' · H1' : ' · H2');
    try {
      const [schedule] = await Promise.all([
        dimCall('getUserSchedule', { week: week }),
        dimLoadSlotOptionsFallback(),
        dimEnsureDictionary()
      ]);
      dimState.schedule = schedule;
      dimEnsureSlotOptions(schedule);
      dimEnsureDayDates(schedule);
      dimNormalizeScheduleTimes(schedule);
      if (schedule.identity) dimState.session = schedule.identity;
      dimUpdateStatus();
      dimRenderAll();
    } catch (e) {
      dimRenderError(String(e.message || e));
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
    const wrap = document.getElementById('dimGridWrap');
    if (!wrap || !dimState.schedule) return;

    const slots = dimState.schedule.config.timeSlots || [];
    let html = '<table class="dim-grid"><thead><tr><th class="dim-day-col">Dia</th>';
    slots.forEach(function (t) {
      html += '<th>' + escapeHtml(t) + '</th>';
    });
    html += '</tr></thead><tbody>';

    DIM_DAY_KEYS.forEach(function (dayKey) {
      const day = dimFindDay(dayKey);
      const alert = day && day.filledCount < (dimState.schedule.config.minSlotsAlert || 18);
      html += '<tr><td class="dim-day-label' + (alert ? ' dim-day-alert' : '') + '">';
      html += escapeHtml(DIM_DAY_LABELS[dayKey]);
      if (day && day.date) html += '<br><span style="font-weight:400;font-size:10px;color:var(--text3)">' + escapeHtml(day.date.slice(5)) + '</span>';
      html += '</td>';
      slots.forEach(function (time) {
        const val = day && day.slots ? (day.slots[time] || '') : '';
        const col = dimColorFor(val);
        const cls = 'dim-slot' + (val ? '' : ' empty');
        html += '<td class="' + cls + '" data-day="' + dayKey + '" data-time="' + escapeHtml(time) + '"';
        html += ' style="' + dimCellStyle(col) + '"';
        html += ' title="' + escapeHtml(val || 'Vazio') + '">';
        html += escapeHtml(val || '·');
        html += '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    dimSyncSelectionVisual();
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
      const col = dimColorFor(k);
      html += '<span class="dim-summary-chip" style="' + dimCellStyle(col) + '">';
      html += escapeHtml(k) + ' <strong>' + summary[k] + '</strong></span>';
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
      '<div class="dim-dropdown-search"><input type="text" placeholder="Buscar slot…" id="dimDropdownSearch"></div>' +
      '<div class="dim-dropdown-list" id="dimDropdownList"></div>' +
      '<div class="dim-dropdown-clear" onclick="dimApplySlot(null)">Limpar slot</div>';

    document.body.appendChild(backdrop);
    document.body.appendChild(dd);
    dimState.dropdown = { backdrop: backdrop, dd: dd, anchor: anchor, day: day, time: time, current: current };

    function renderList(filter) {
      const list = dd.querySelector('#dimDropdownList');
      const q = (filter || '').toLowerCase();
      const items = options.filter(function (o) { return !q || o.toLowerCase().indexOf(q) >= 0; });
      list.innerHTML = items.map(function (opt) {
        const col = dimColorFor(opt);
        return '<div class="dim-dropdown-item" data-val="' + escapeHtml(opt) + '" onclick="dimApplySlot(this.dataset.val)">' +
          '<span class="dim-dropdown-swatch" style="background:' + col.bg + ';border:1px solid ' + (col.border || '#ddd') + '"></span>' +
          escapeHtml(opt) + '</div>';
      }).join('');
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

  function dimApplySlot(value) {
    const targets = dimGetApplyTargets();
    if (!targets.length) return;

    const newVal = value ? String(value) : '';
    const isMulti = targets.length > 1;
    dimCloseDropdown();

    const detailSlots = dimState.schedule.config.detailSlots || DIM_DETAIL_SLOTS;
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

    if (!undoBatch.length) {
      if (!isMulti && newVal && detailSlots.indexOf(newVal) >= 0) {
        const t = targets[0];
        dimOpenDetailModal({
          slot: newVal,
          date: dimResolveDayDate(t.day),
          time: t.time,
          day: t.day.day
        });
      }
      return;
    }

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
      dimOpenDetailModal(modalCtx);
    }
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

  async function dimProcessSaveQueue() {
    if (dimState.saving || !dimState.saveQueue.length) return;
    dimState.saving = true;
    dimUpdateStatus();
    const date = dimState.saveQueue.shift();
    const slots = dimState.pendingSaves[date];
    delete dimState.pendingSaves[date];

    try {
      const res = await dimCall('saveBatchData', {
        week: dimState.week,
        date: date,
        day: (dimState.pendingMeta && dimState.pendingMeta[date]) || '',
        slots: slots
      });
      if (res && res.validationRejected) {
        dimShowToast('Planilha rejeitou slot(s): verifique validação de dados', true);
      } else {
        dimShowToast('Salvo na planilha');
      }
    } catch (e) {
      dimShowToast('Erro ao salvar: ' + e.message, true);
    }

    if (dimState.pendingMeta) delete dimState.pendingMeta[date];

    dimState.saving = false;
    dimUpdateStatus();
    if (dimState.saveQueue.length) dimProcessSaveQueue();
  }

  function dimShouldPauseReload() {
    return dimState.editingCell || dimState.modalOpen || dimState.saving ||
      dimState.selectDrag || dimState.saveQueue.length > 0 ||
      Object.keys(dimState.pendingSaves).length > 0;
  }

  function dimStartReloadTimer() {
    if (dimState.reloadTimer) clearInterval(dimState.reloadTimer);
    dimState.reloadTimer = setInterval(function () {
      if (document.getElementById('pageDimensionamento')?.classList.contains('active') &&
          !dimShouldPauseReload()) {
        dimLoadWeek(dimState.week);
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

    dimDetailUpdateQtyHint();
    bd.classList.add('active');
  }

  function dimCloseDetailModal() {
    dimState.modalOpen = false;
    dimState.detailDraft = null;
    document.getElementById('dimDetailBackdrop')?.classList.remove('active');
  }

  async function dimSaveDetail() {
    const ctx = dimState.detailDraft;
    if (!ctx) return;

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
    if (!dateIso) {
      dimShowToast('Data do dia não encontrada — recarregue a semana', true);
      return;
    }

    const targets = (ctx.multiTargets && ctx.multiTargets.length > 1)
      ? ctx.multiTargets
      : [{ day: ctx.day, time: ctx.time, date: ctx.date || dateIso }];

    try {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        const tDay = dimFindDay(t.day);
        const tDate = t.date || (tDay ? dimResolveDayDate(tDay) : '');
        if (!tDate) continue;

        if (i === 0 && tDay && targets.length === 1) {
          const slotUpdates = dimApplyDetailDuration(tDay, t.time, ctx.slot, quantity, ctx.initialQuantity || 1);
          dimRenderGrid();
          dimRenderSummary();
          if (Object.keys(slotUpdates).length) {
            Object.keys(slotUpdates).forEach(function (ts) {
              dimQueueSave(tDate, dimNormalizeTime(ts), slotUpdates[ts], tDay.day);
            });
          }
        }

        await dimCall('saveDetail', {
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
      dimShowToast(targets.length > 1
        ? 'Detalhes salvos em ' + targets.length + ' slots'
        : 'Detalhe salvo em Base_Detalhes');
      dimCloseDetailModal();
      dimClearSelection();
      await dimLoadWeek(dimState.week);
      if (dimState.activeTab === 'ajustes') dimRenderAjustes();
    } catch (e) {
      dimShowToast('Erro: ' + e.message, true);
    }
  }

  async function dimRenderAjustes() {
    const el = document.getElementById('dimAjustesList');
    if (!el) return;
    try {
      const res = await dimCall('getPendingDetails', { week: dimState.week });
      const pending = res.pending || [];
      dimState.pendingList = pending;
      if (!pending.length) {
        el.innerHTML = '<p style="color:var(--text3);font-size:14px">Nenhum detalhe pendente nesta semana.</p>';
        return;
      }
      el.innerHTML = pending.map(function (p, idx) {
        return '<div class="dim-ajuste-item pending">' +
          '<div class="dim-ajuste-meta"><strong>' + escapeHtml(p.slot) + '</strong>' +
          '<span>' + escapeHtml(p.date) + ' · ' + escapeHtml(p.time) + '</span></div>' +
          '<button type="button" class="btn-sm primary" onclick="dimEditPendingByIndex(' + idx + ')">' +
          '<i class="ti ti-pencil"></i> Preencher</button></div>';
      }).join('');
    } catch (e) {
      el.innerHTML = '<p class="dim-status err">' + escapeHtml(e.message) + '</p>';
    }
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
        html += '<td><span class="dim-controle-class">' + escapeHtml(it.classificacao || '—') + '</span></td>';
        html += '<td class="dim-controle-conv"><span class="dim-controle-conv-val" title="Como esse slot irá aparecer no planilhão/DIM oficial">' +
          escapeHtml(it.conversao || '—') + '</span></td>';
        html += '</tr>';
      });
      html += '</tbody></table></div></section>';
    });
    el.innerHTML = html;
  }

  function dimManualRefresh() {
    if (dimState.session && dimGetBridgeTarget()) {
      dimLoadWeek(dimState.week || dimGetIsoWeek());
    } else {
      dimConnectBridge();
    }
  }

  // Export globals
  global.dimInit = dimInit;
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
  global.dimRenderControle = dimRenderControle;
  global.dimConnectBridge = dimConnectBridge;
  global.dimManualRefresh = dimManualRefresh;
  global.dimGetBridgeUrl = dimGetBridgeUrl;
  global.dimSetBridgeUrl = dimSetBridgeUrl;

})(typeof window !== 'undefined' ? window : this);
