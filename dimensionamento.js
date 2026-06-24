/**
 * Dimensionamento ID Quality/Csat — cliente Hub + ponte Apps Script
 */
(function (global) {
  'use strict';

  const DIM_DAY_KEYS = ['seg', 'ter', 'qua', 'qui', 'sex'];
  const DIM_DAY_LABELS = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex' };

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
    bridgePopup: null
  };

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

  function dimCanUseAdmin() {
    return typeof canManageAccess === 'function' && canManageAccess();
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

  async function dimLoadWeek(week) {
    dimState.week = week;
    const label = document.getElementById('dimWeekLabel');
    if (label) label.textContent = 'Semana ' + week + (week <= 26 ? ' · H1' : ' · H2');
    try {
      const [schedule, dictionary] = await Promise.all([
        dimCall('getUserSchedule', { week: week }),
        dimState.dictionary ? Promise.resolve(dimState.dictionary) : dimCall('getSlotDictionary', {})
      ]);
      dimState.schedule = schedule;
      dimState.dictionary = dictionary;
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
    if (tab === 'controle') dimRenderControle();
  }

  function dimGetColors() {
    return (dimState.schedule && dimState.schedule.colors) || {};
  }

  function dimColorFor(slot) {
    const c = dimGetColors()[slot];
    return c || { bg: '#f3f4f6', text: '#374151', category: '' };
  }

  function dimRenderAll() {
    dimRenderGrid();
    dimRenderSummary();
    if (dimState.activeTab === 'ajustes') dimRenderAjustes();
    if (dimState.activeTab === 'controle') dimRenderControle();
    const adminBar = document.getElementById('dimAdminBar');
    if (adminBar) adminBar.classList.toggle('visible', dimCanUseAdmin());
  }

  function dimFindDay(dayKey) {
    const days = (dimState.schedule && dimState.schedule.days) || [];
    return days.find(function (d) { return d.day === dayKey; }) || null;
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
        html += ' style="background:' + col.bg + ';color:' + col.text + '"';
        html += ' title="' + escapeHtml(val || 'Vazio') + '" onclick="dimOnSlotClick(this)">';
        html += escapeHtml(val || '·');
        html += '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
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
      html += '<span class="dim-summary-chip" style="background:' + col.bg + ';color:' + col.text + '">';
      html += escapeHtml(k) + ' <strong>' + summary[k] + '</strong></span>';
    });
    html += '</div>';
    el.innerHTML = html;
  }

  function dimOnSlotClick(cell) {
    if (!dimState.schedule) return;
    const dayKey = cell.dataset.day;
    const time = cell.dataset.time;
    const day = dimFindDay(dayKey);
    if (!day) {
      dimShowToast('Dia não encontrado na planilha para esta semana', true);
      return;
    }
    dimOpenDropdown(cell, day, time, day.slots[time] || '');
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

    const options = (dimState.schedule.config.slotOptions || []).slice();
    dd.innerHTML =
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
          '<span class="dim-dropdown-swatch" style="background:' + col.bg + '"></span>' +
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

  function dimApplySlot(value) {
    if (!dimState.dropdown) return;
    const { day, time, current } = dimState.dropdown;
    const newVal = value ? String(value) : '';
    dimCloseDropdown();
    if (newVal === current) return;

    dimPushUndo({ day: day.day, date: day.date, time: time, prev: current, next: newVal });

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

    dimRenderGrid();
    dimRenderSummary();
    dimQueueSave(day.date, time, newVal);

    const detailSlots = dimState.schedule.config.detailSlots || [];
    if (detailSlots.indexOf(newVal) >= 0) {
      dimOpenDetailModal({ slot: newVal, date: day.date, time: time, day: day.day });
    }
  }

  function dimPushUndo(entry) {
    if (dimState.undoTimer) clearTimeout(dimState.undoTimer);
    dimState.undo = entry;
    const bar = document.getElementById('dimUndoBar');
    if (bar) {
      bar.classList.add('active');
      bar.querySelector('.dim-undo-label').textContent =
        'Alterado ' + entry.time + ' → ' + (entry.next || '(vazio)');
    }
    dimState.undoTimer = setTimeout(function () {
      dimState.undo = null;
      if (bar) bar.classList.remove('active');
    }, 4000);
  }

  function dimUndoLast() {
    const u = dimState.undo;
    if (!u) return;
    const day = dimFindDay(u.day);
    if (!day) return;
    day.slots[u.time] = u.prev;
    dimState.undo = null;
    document.getElementById('dimUndoBar')?.classList.remove('active');
    if (dimState.undoTimer) clearTimeout(dimState.undoTimer);
    dimRenderGrid();
    dimRenderSummary();
    dimQueueSave(u.date, u.time, u.prev || '');
  }

  function dimQueueSave(date, time, value) {
    if (!dimState.pendingSaves[date]) dimState.pendingSaves[date] = {};
    dimState.pendingSaves[date][time] = value;
    dimState.saveQueue.push(date);
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
        slots: slots
      });
      if (res && res.validationRejected) {
        dimShowToast('Planilha rejeitou slot(s): verifique validação de dados', true);
      }
    } catch (e) {
      dimShowToast('Erro ao salvar: ' + e.message, true);
    }

    dimState.saving = false;
    dimUpdateStatus();
    if (dimState.saveQueue.length) dimProcessSaveQueue();
  }

  function dimShouldPauseReload() {
    return dimState.editingCell || dimState.modalOpen || dimState.saving ||
      dimState.saveQueue.length > 0 || Object.keys(dimState.pendingSaves).length > 0;
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

  function dimOpenDetailModal(ctx) {
    dimState.modalOpen = true;
    dimState.detailDraft = ctx;
    const bd = document.getElementById('dimDetailBackdrop');
    if (!bd) return;
    document.getElementById('dimDetailTitle').textContent = ctx.slot + ' — ' + ctx.date + ' ' + ctx.time;
    document.getElementById('dimDetailAcao').value = ctx.acao || '';
    document.getElementById('dimDetailProjeto').value = ctx.projeto || '';
    document.getElementById('dimDetailSpec').value = ctx.especificacao || '';
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
    const payload = {
      tipo: ctx.slot,
      slot: ctx.slot,
      date: ctx.date,
      hora: ctx.time,
      time: ctx.time,
      acao: document.getElementById('dimDetailAcao').value.trim(),
      projeto: document.getElementById('dimDetailProjeto').value.trim(),
      especificacao: document.getElementById('dimDetailSpec').value.trim()
    };
    try {
      await dimCall('saveDetail', payload);
      dimShowToast('Detalhe salvo em Base_Detalhes');
      dimCloseDetailModal();
      await dimLoadWeek(dimState.week);
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
    if (!el || !dimState.dictionary) return;
    const q = (document.getElementById('dimControleSearch')?.value || '').toLowerCase();
    const items = (dimState.dictionary.items || []).filter(function (it) {
      if (!q) return true;
      const hay = [it.atividade, it.tipoSlot, it.significado, it.classificacao].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    const groups = {};
    items.forEach(function (it) {
      const cat = it.classificacao || (it.color && it.color.category) || 'Outros';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(it);
    });
    const order = dimState.dictionary.categories || Object.keys(groups);
    let html = '';
    order.forEach(function (cat) {
      if (!groups[cat] || !groups[cat].length) return;
      html += '<div class="dim-controle-group"><h4>' + escapeHtml(cat) + '</h4>';
      html += '<table class="dim-controle-table"><thead><tr><th>Slot</th><th>Significado</th><th>Conversão</th></tr></thead><tbody>';
      groups[cat].forEach(function (it) {
        html += '<tr><td><span class="dim-dropdown-swatch" style="background:' + (it.color && it.color.bg || '#eee') + ';display:inline-block;vertical-align:middle;margin-right:6px"></span>' +
          escapeHtml(it.tipoSlot) + '</td><td>' + escapeHtml(it.significado || '—') + '</td><td>' + escapeHtml(it.conversao || '—') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    });
    el.innerHTML = html || '<p style="color:var(--text3)">Nenhum slot encontrado.</p>';
  }

  async function dimRunAutoDim() {
    if (!dimCanUseAdmin()) return;
    try {
      const res = await dimCall('runAutoDimensionamento', { week: dimState.week });
      dimShowToast('Dimensionamento automático: ' + (res.slotsFilled || 0) + ' slots');
      await dimLoadWeek(dimState.week);
    } catch (e) {
      dimShowToast(e.message, true);
    }
  }

  async function dimRunDeepDive() {
    if (!dimCanUseAdmin()) return;
    try {
      const res = await dimCall('runDeepDive', { week: dimState.week });
      dimShowToast('DeepDive gerado: ' + (res.rows || 0) + ' linhas na aba DeepDive Slots');
    } catch (e) {
      dimShowToast(e.message, true);
    }
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
  global.dimOnSlotClick = dimOnSlotClick;
  global.dimApplySlot = dimApplySlot;
  global.dimCloseDropdown = dimCloseDropdown;
  global.dimUndoLast = dimUndoLast;
  global.dimOpenDetailModal = dimOpenDetailModal;
  global.dimCloseDetailModal = dimCloseDetailModal;
  global.dimSaveDetail = dimSaveDetail;
  global.dimEditPending = dimEditPending;
  global.dimEditPendingByIndex = dimEditPendingByIndex;
  global.dimRenderControle = dimRenderControle;
  global.dimRunAutoDim = dimRunAutoDim;
  global.dimRunDeepDive = dimRunDeepDive;
  global.dimConnectBridge = dimConnectBridge;
  global.dimManualRefresh = dimManualRefresh;
  global.dimGetBridgeUrl = dimGetBridgeUrl;
  global.dimSetBridgeUrl = dimSetBridgeUrl;

})(typeof window !== 'undefined' ? window : this);
