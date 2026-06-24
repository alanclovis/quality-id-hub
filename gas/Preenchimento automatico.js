/**
 * Dimensionamento Quality — Google Apps Script
 * Menu: Dimensionamento > Preencher semana…
 * Instalação: cole SOMENTE este arquivo em Code.gs (formulário já embutido)
 */

const ABAS_PERIODO = {
  'H1.2026': 'H1.2026',
  'H2.2026': 'H2.2026',
};

/** Semanas fixas por semestre (evita leitura lenta da planilha no dialog) */
const SEMANAS_POR_ABA = {
  'H1.2026': { min: 1, max: 26 },
  'H2.2026': { min: 27, max: 53 },
};

function getSemanasListaParaAba_(aba) {
  const cfg = SEMANAS_POR_ABA[aba] || SEMANAS_POR_ABA['H1.2026'];
  const semanas = [];
  for (let n = cfg.min; n <= cfg.max; n++) semanas.push(n);
  return semanas;
}

function buildCotasPadrao_() {
  return [
    { distrito: DISTRITO_TODOS, slot: 'GS - ID',  quantidade: 0, semanaInteira: false },
    { distrito: DISTRITO_TODOS, slot: 'GS - VP',  quantidade: 0, semanaInteira: false },
    { distrito: DISTRITO_TODOS, slot: 'CSAT',     quantidade: 0, semanaInteira: false },
  ];
}

/** GS por distrito → todos elegíveis ao slot (ex.: Gamers + GS-GM → rose, lucas, gisele) */
function cotaUsaElegiveisGlobais_(c) {
  const distrito = String(c.distrito || '').trim();
  if (!distrito || distrito === DISTRITO_TODOS || distrito.indexOf('Todos') >= 0) return true;
  const slot = String(c.slot || '').trim();
  if (slot.indexOf('GS -') === 0 && GS_POR_DISTRITO[distrito] === slot) return true;
  return false;
}

function analistaTemLinhaNaSemana_(data, cols, semana, analista) {
  for (let r = 1; r < data.length; r++) {
    if (parseSemana_(data[r][cols.semana]) !== semana) continue;
    if (String(data[r][cols.analista] || '').trim() === analista) return true;
  }
  return false;
}

function ordemDia_(dia) {
  const map = { segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5 };
  return map[normalizarDia_(dia)] || 99;
}

function normalizarSemanasPayload_(cfg) {
  const raw = cfg.semanas || (cfg.semana != null ? [cfg.semana] : []);
  const out = [];
  const seen = {};
  raw.forEach(function (s) {
    const n = parseInt(s, 10);
    if (!isNaN(n) && n > 0 && !seen[n]) {
      seen[n] = true;
      out.push(n);
    }
  });
  return out.sort(function (a, b) { return a - b; });
}

/** Slots exibidos no dialog (lista curta — evita quebrar o HTML) */
const SLOTS_COTA_DIALOG = [
  'GS - ID', 'GS - VP', 'CSAT',
  'FR', 'FRDO', 'FLG', 'FLG-H',
  'Onb Qlt',
];

function escapeHtmlAttr_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function buildSelectOptionsHtml_(items, selected) {
  return items.map(function (item) {
    const s = escapeHtmlAttr_(item);
    const sel = item === selected ? ' selected' : '';
    return '<option value="' + s + '"' + sel + '>' + s + '</option>';
  }).join('');
}

function buildSemanaOptionsHtml_(aba) {
  const cfg = SEMANAS_POR_ABA[aba] || SEMANAS_POR_ABA['H1.2026'];
  const parts = [];
  for (let n = cfg.min; n <= cfg.max; n++) {
    const sel = n === cfg.max ? ' selected' : '';
    parts.push('<option value="' + n + '"' + sel + '>Semana ' + n + '</option>');
  }
  return parts.join('');
}

function buildCotaRowHtml_(c) {
  const distOpts = buildSelectOptionsHtml_(DISTRITOS_LISTA, c.distrito);
  const slotOpts = buildSelectOptionsHtml_(SLOTS_COTA_DIALOG, c.slot);
  const chk = c.semanaInteira ? ' checked' : '';
  return (
    '<tr>' +
    '<td><select class="d-distrito">' + distOpts + '</select></td>' +
    '<td><select class="d-slot">' + slotOpts + '</select></td>' +
    '<td class="col-qtd"><input type="number" class="d-qtd" min="0" value="' + (c.quantidade || 0) + '"></td>' +
    '<td class="col-check"><label title="Preenche todos os blocos disponiveis da semana">' +
    '<input type="checkbox" class="d-semana-inteira"' + chk + ' onchange="toggleSemanaInteira(this)"></label></td>' +
    '<td><button type="button" class="secondary" onclick="removerLinha(this)">×</button></td>' +
    '</tr>'
  );
}

function buildCotasBodyHtml_() {
  return buildCotasPadrao_().map(buildCotaRowHtml_).join('');
}

function buildAnalistasCheckboxesHtml_() {
  return Object.keys(ANALISTAS).sort().map(function (id) {
    const label = escapeHtmlAttr_(id.split('.')[0]);
    const val = escapeHtmlAttr_(id);
    return (
      '<label class="analista-item">' +
      '<input type="checkbox" class="a-ativo" value="' + val + '" checked> ' + label +
      '</label>'
    );
  }).join('');
}

function criarSetAnalistasAtivos_(cfg) {
  const lista = cfg.analistasAtivos;
  if (lista && lista.length) {
    const set = {};
    lista.forEach(function (a) {
      set[String(a).trim()] = true;
    });
    return set;
  }
  const set = {};
  Object.keys(ANALISTAS).forEach(function (a) {
    set[a] = true;
  });
  return set;
}

function analistaEstaAtivo_(analista, ativosSet) {
  if (!ativosSet || !Object.keys(ativosSet).length) return true;
  return !!ativosSet[analista];
}
const DISTRITO_TODOS = '— Todos (elegíveis ao slot) —';
const MAX_SLOTS_DIA = 18;
const SUBSTITUIR_AVLB = true;

const GS_POR_DISTRITO = {
  'Identity':           'GS - ID',
  'Victims Prevention': 'GS - VP',
  'Csat':               'CSAT',
};

const DISTRITOS_LISTA = [
  DISTRITO_TODOS,
  'Identity',
  'Victims Prevention',
  'Csat',
];

/** Famílias de monitoria que cada analista pode executar */
const ANALISTA_FAMILIAS = {
  'alan.clovis':        ['ID'],
  'tiago.genangello':   ['ID'],
  'matheus.santos2':    ['ID' ,'VP'],
  'livia.lyra':         ['ID'],
  'luciana.ramos':      ['ID'],
  'evelyn.marconi':     ['CSAT'],
  'felipe.rosado':      ['CSAT'],
  'mayara.kin':         ['CSAT'],
};

/**
 * Sem. inteira com 2+ famílias: proporção e ordem de intercalação por dia.
 * ordem[0] = família do 1º dia; proporcoes = base para semana de 5 dias (escala automaticamente).
 */
const ANALISTA_DISTRIBUICAO_SEMANA = {
  'matheus.santos2': {
    ordem: ['ID', 'VP'],
    proporcoes: { ID: 4, VP: 1 },
  },
};

/** Prioridade de preenchimento (menor = antes) */
const PRIORIDADE_SLOTS = [
  'MA - CR',
  'GS - MA',
  'GS - ID',
  'GS - VP',
  'GS - GM',
  'GS - TR',
];

const SLOTS_VALIDOS = [
  'Extraction', 'GS - ID', 'GS - VP', 'CSAT', 'ProjCSAT',
  'JR - Contest ID', 'JR - Contest VP',
  'JR - Loss ID', 'JR - Loss VP', 'JR - Request',
  'Deep Dive', 'Docs', 'Inv. Brain', 'Planilha', 'Playbook', 'RFC', 'Slides',
  'Calibration', 'Calibration Packs', 'Onb Qlt', 'Shadowing Qlt', 'Stk Talk',
  'HUB', 'Mission Control', 'Project Meet', 'Talk IC4', 'Talk Quality', 'Weekly',
  'Drive', 'Confluence', 'Jira/Atlassian', 'Databricks', 'Quicksight', 'Workflow (Slack)', 'Playvox',
  'AVLB', 'DTQ', 'Quality Monitoring', 'Support',
  'Break', '1:1', 'MEET-DT', 'Monthly', 'CoffeeBreak', 'Mandatorios',
  'DIM_QLT', 'DIM_Csat',
  'FLC', 'Appeal Flow', 'Pangaea', 'Reversals', 'CSAT-HE', 'OBF',
  'FUP Legal', 'Reativação OBF', 'Triagem OBF', 'Projeto Csat',
  'ProjFLC', 'ProjAF', 'ProjRVS', 'ProjONB', 'ProjOPS', 'ProjQLT',
  'Doc Csat', 'Reunião Csat', 'Weekly Csat', 'Sync RVS', 'Sync Legal',
  'Sync OPS', 'Sync FLC', 'Sync AF', 'Sync QLT', 'Sync ONB',
  'OPS Projeção', 'OPS Ajustes', 'Onboarding', 'Prática', 'Buddy',
  'Reciclagem', 'Quality', 'RVS DD', 'Legal DD', 'OPS DD', 'FLC DD',
  'AF DD', 'QLT DD', 'QR Csat', 'UPDATES',
];

const ANALISTAS = {
  'alan.clovis':        { distrito: 'Identity',           entrada: '07:00', saida: '16:00', break_inicio: '12:00' },
  'tiago.genangello':   { distrito: 'Identity',           entrada: '09:00', saida: '18:00', break_inicio: '13:00' },
  'matheus.santos2':    { distrito: 'Identity',           entrada: '07:00', saida: '16:00', break_inicio: '13:00' },
  'livia.lyra':         { distrito: 'Identity',           entrada: '07:00', saida: '16:00', break_inicio: '12:00' },
  'luciana.ramos':      { distrito: 'Identity',           entrada: '11:00', saida: '20:00', break_inicio: '15:00' },
  'evelyn.marconi':     { distrito: 'Csat',               entrada: '07:00', saida: '16:00', break_inicio: '12:00' },
  'felipe.rosado':      { distrito: 'Csat',               entrada: '08:00', saida: '17:00', break_inicio: '12:00' },
  'mayara.kin':         { distrito: 'Csat',               entrada: '09:00', saida: '18:00', break_inicio: '13:00' },
};

const PROTECTED_EXACT = ['Break', 'Weekly', 'Mission Control'];
const PROTECTED_PREFIXES = ['JR - Loss', 'JR - Contest'];
const PROTECTED_OPS = [
  'FR', 'FLG', 'FRDO', 'AT', 'AT-H', 'AUS', 'EDF', 'ESCL', 'ITP', 'RT', 'DEV', 'OCI', 'FLD',
];

// --- Menu ---

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Dimensionamento')
    .addItem('Preencher semana…', 'showDimensionarDialog')
    .addSeparator()
    .addItem('Ver turnos configurados', 'menuVerTurnos')
    .addToUi();
}

function showDimensionarDialog() {
  const html = HtmlService.createHtmlOutput(getDialogHtml_())
    .setWidth(660)
    .setHeight(860);
  SpreadsheetApp.getUi().showModalDialog(html, 'Dimensionamento Quality');
}

function buildDialogDefaults_() {
  return {
    abas: ['H1.2026', 'H2.2026'],
    aba: 'H1.2026',
    semanasPorAba: SEMANAS_POR_ABA,
    distritos: DISTRITOS_LISTA,
    slots: SLOTS_VALIDOS,
    cotasDistrito: buildCotasPadrao_(),
  };
}

function getDialogHtml_() {
  const semanasH1 = buildSemanaOptionsHtml_('H1.2026');
  const cotasBody = buildCotasBodyHtml_();
  const analistasHtml = buildAnalistasCheckboxesHtml_();
  return `<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 12px; color: #202124; }
    h2 { font-size: 15px; margin: 0 0 8px; color: #5c0f73; }
    label { display: block; margin-top: 10px; font-weight: 600; }
    input, select { width: 100%; padding: 6px; box-sizing: border-box; margin-top: 4px; }
    .row { display: flex; gap: 8px; margin-top: 6px; }
    .row > * { flex: 1; }
    .muted { color: #5f6368; font-size: 12px; margin-top: 4px; line-height: 1.4; }
    .box { border: 1px solid #dadce0; border-radius: 8px; padding: 10px; margin-top: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border-bottom: 1px solid #eee; padding: 4px 2px; vertical-align: middle; }
    th { font-size: 11px; color: #5f6368; }
    td select, td input { margin-top: 0; }
    td.col-check { width: 88px; text-align: center; white-space: nowrap; }
    td.col-check input { width: auto; margin: 0; }
    td.col-qtd { width: 72px; }
    td.col-qtd input { width: 100%; }
    select[multiple] { min-height: 120px; }
    .analistas-grid {
      display: flex; flex-wrap: wrap; gap: 6px 14px;
      max-height: 110px; overflow-y: auto; margin-top: 6px;
    }
    .analista-item {
      display: flex; align-items: center; gap: 4px;
      font-size: 12px; white-space: nowrap; font-weight: 400;
    }
    .analista-item input { width: auto; margin: 0; }
    .btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn-row button.secondary { margin-top: 8px; }
    button {
      margin-top: 14px; padding: 10px 16px; border: none; border-radius: 6px;
      background: #820ad1; color: #fff; font-weight: 600; cursor: pointer; width: 100%;
    }
    button:disabled { background: #ccc; }
    button.secondary { background: #f1f3f4; color: #202124; margin-top: 8px; width: auto; }
    .status { margin-top: 10px; font-size: 12px; min-height: 18px; white-space: pre-wrap; }
    .err { color: #c5221f; }
    .ok { color: #137333; }
  </style>
</head>
<body>
  <h2>Dimensionar semana</h2>
  <p class="muted">Cotas = blocos de 30 min <strong>por analista elegível</strong> na semana. Prioridade: MA-CR → GS (Global).</p>

  <div class="row">
    <div>
      <label>Período (aba)</label>
      <select id="aba" onchange="carregarSemanas()">
        <option value="H1.2026">H1.2026</option>
        <option value="H2.2026">H2.2026</option>
      </select>
    </div>
    <div>
      <label>Semana <span class="muted" style="font-weight:400">(Ctrl/Cmd + clique)</span></label>
      <select id="semana" multiple size="8">${semanasH1}</select>
    </div>
  </div>

  <div class="box">
    <strong>Analistas</strong>
    <p class="muted">Desmarque quem <strong>não</strong> deve ser alterado nesta execução (férias, ausência etc.).</p>
    <div class="analistas-grid" id="analistasGrid">${analistasHtml}</div>
    <div class="btn-row">
      <button type="button" class="secondary" onclick="marcarTodosAnalistas(true)">Marcar todos</button>
      <button type="button" class="secondary" onclick="marcarTodosAnalistas(false)">Desmarcar todos</button>
    </div>
  </div>

  <div class="box">
    <strong>Cotas por distrito</strong>
    <p class="muted">Linhas padrão: <strong>MA-CR</strong> + GS (Todos elegíveis). GS-GM/GS-MA etc. vão para <em>todos</em> que fazem aquele slot (ex.: GM → rose, lucas, gisele). Vários slots &quot;Sem. inteira&quot; no mesmo analista são <strong>intercalados por dia</strong> conforme <code>ANALISTA_DISTRIBUICAO_SEMANA</code> (ex.: Lucas seg=GM, ter=MA…). <strong>Ctrl/Cmd+clique</strong> para várias semanas.</p>
    <table>
      <thead>
        <tr><th>Distrito</th><th>Slot</th><th class="col-qtd">Qtd/sem</th><th class="col-check">Sem. inteira</th><th></th></tr>
      </thead>
      <tbody id="cotasDistrito">${cotasBody}</tbody>
    </table>
    <button type="button" class="secondary" onclick="addLinha()">+ Linha</button>
  </div>

  <button id="btnRun" onclick="executar()">Aplicar na planilha</button>
  <div id="status" class="status"></div>

  <script>
    function marcarTodosAnalistas(marcar) {
      document.querySelectorAll('.a-ativo').forEach(function (cb) {
        cb.checked = marcar;
      });
    }

    function carregarSemanas() {
      var aba = document.getElementById('aba').value;
      var min = aba === 'H2.2026' ? 27 : 1;
      var max = aba === 'H2.2026' ? 53 : 26;
      var sel = document.getElementById('semana');
      var selecionados = [];
      Array.prototype.forEach.call(sel.options, function (o) {
        if (o.selected) selecionados.push(parseInt(o.value, 10));
      });
      sel.innerHTML = '';
      for (var n = min; n <= max; n++) {
        var o = document.createElement('option');
        o.value = String(n);
        o.textContent = 'Semana ' + n;
        if (selecionados.indexOf(n) >= 0) o.selected = true;
        sel.appendChild(o);
      }
      if (!sel.selectedOptions.length) {
        sel.options[sel.options.length - 1].selected = true;
      }
    }

    function toggleSemanaInteira(cb) {
      var qtd = cb.closest('tr').querySelector('.d-qtd');
      if (!qtd) return;
      qtd.disabled = cb.checked;
      if (cb.checked) qtd.value = '0';
    }

    function removerLinha(btn) {
      var tr = btn.closest('tr');
      if (tr) tr.remove();
    }

    function addLinha() {
      var tbody = document.getElementById('cotasDistrito');
      if (!tbody || !tbody.rows.length) return;
      var origem = tbody.rows[tbody.rows.length - 1];
      var nova = origem.cloneNode(true);
      nova.querySelector('.d-qtd').value = '0';
      nova.querySelector('.d-qtd').disabled = false;
      var cb = nova.querySelector('.d-semana-inteira');
      if (cb) cb.checked = false;
      tbody.appendChild(nova);
    }

    function coletarPayload() {
      var cotas = [];
      document.querySelectorAll('#cotasDistrito tr').forEach(function (tr) {
        var semanaInteira = tr.querySelector('.d-semana-inteira').checked;
        var q = parseInt(tr.querySelector('.d-qtd').value, 10) || 0;
        if (!semanaInteira && q <= 0) return;
        cotas.push({
          distrito: tr.querySelector('.d-distrito').value,
          slot: tr.querySelector('.d-slot').value,
          quantidade: q,
          semanaInteira: semanaInteira,
        });
      });
      return {
        aba: document.getElementById('aba').value,
        semanas: Array.prototype.map.call(
          document.getElementById('semana').selectedOptions,
          function (o) { return parseInt(o.value, 10); }
        ).filter(function (n) { return !isNaN(n); }),
        analistasAtivos: Array.prototype.map.call(
          document.querySelectorAll('.a-ativo:checked'),
          function (cb) { return cb.value; }
        ),
        cotasDistrito: cotas,
      };
    }

    function executar() {
      var btn = document.getElementById('btnRun');
      var st = document.getElementById('status');
      btn.disabled = true;
      st.className = 'status';
      st.textContent = 'Processando…';
      var payload = coletarPayload();
      if (!payload.semanas.length) {
        showErr('Selecione ao menos uma semana (Ctrl/Cmd + clique).');
        btn.disabled = false;
        return;
      }
      if (!payload.analistasAtivos.length) {
        showErr('Marque ao menos um analista para aplicar alterações.');
        btn.disabled = false;
        return;
      }
      if (!payload.cotasDistrito.length) {
        showErr('Informe Qtd/sem ou marque Sem. inteira em pelo menos uma linha.');
        btn.disabled = false;
        return;
      }
      google.script.run
        .withSuccessHandler(function (msg) {
          st.className = 'status ok';
          st.textContent = msg;
          btn.disabled = false;
        })
        .withFailureHandler(function (e) {
          showErr(e.message || e);
          btn.disabled = false;
        })
        .executarDimensionamento(payload);
    }

    function showErr(e) {
      document.getElementById('status').className = 'status err';
      document.getElementById('status').textContent = String(e);
      document.getElementById('btnRun').disabled = false;
    }
  </script>
</body>
</html>
`;
}


function slotParaFamilia_(slot) {
  const s = String(slot || '').trim();
  if (s === 'MA - CR' || s === 'GS - MA' || s === 'PlanilhaMA' || s === 'MA') return 'MA';
  if (s === 'GS - ID' || s === 'PlanilhaID' || s === 'ID') return 'ID';
  if (s === 'GS - VP' || s === 'PlanilhaVP' || s === 'VP') return 'VP';
  if (s === 'GS - GM' || s === 'PlanilhaGM' || s === 'GM') return 'GM';
  if (s === 'GS - TR' || s === 'PlanilhaTR' || s === 'TR') return 'TR';
  return null;
}

function analistaPodeSlot_(analista, slot) {
  const fam = slotParaFamilia_(slot);
  if (!fam) return true;
  const allowed = ANALISTA_FAMILIAS[analista];
  return !!(allowed && allowed.indexOf(fam) >= 0);
}

function prioridadeSlot_(slot) {
  const i = PRIORIDADE_SLOTS.indexOf(slot);
  if (i >= 0) return i;
  if (slot === 'MA - CR') return 0;
  if (String(slot).indexOf('GS -') === 0) return 20;
  return 100;
}

function escalarProporcoesSemana_(ordem, proporcoes, numDias) {
  let totalWeight = 0;
  ordem.forEach(function (f) {
    totalWeight += proporcoes[f] || 0;
  });
  if (totalWeight <= 0 || numDias <= 0) return {};

  const counts = {};
  const restos = [];
  let assigned = 0;
  ordem.forEach(function (f) {
    const exact = (proporcoes[f] || 0) / totalWeight * numDias;
    const c = Math.floor(exact);
    counts[f] = c;
    assigned += c;
    restos.push({ familia: f, resto: exact - c });
  });

  restos.sort(function (a, b) {
    if (b.resto !== a.resto) return b.resto - a.resto;
    return ordem.indexOf(a.familia) - ordem.indexOf(b.familia);
  });

  let remaining = numDias - assigned;
  for (let i = 0; remaining > 0 && i < restos.length; i++) {
    counts[restos[i].familia]++;
    remaining--;
  }
  return counts;
}

function intercalarFamiliasSemana_(ordem, counts) {
  const result = [];
  const saldo = {};
  ordem.forEach(function (f) {
    saldo[f] = counts[f] || 0;
  });

  const total = ordem.reduce(function (s, f) {
    return s + (saldo[f] || 0);
  }, 0);
  let last = null;
  let cycleIdx = 0;

  while (result.length < total) {
    let picked = null;
    let attempts = 0;

    while (attempts < ordem.length * 2) {
      const fam = ordem[cycleIdx % ordem.length];
      cycleIdx++;
      attempts++;
      if ((saldo[fam] || 0) <= 0) continue;
      if (last !== null && fam === last) {
        const alt = ordem.some(function (f) {
          return f !== last && (saldo[f] || 0) > 0;
        });
        if (alt) continue;
      }
      picked = fam;
      break;
    }

    if (!picked) {
      for (let j = 0; j < ordem.length; j++) {
        if ((saldo[ordem[j]] || 0) > 0) {
          picked = ordem[j];
          break;
        }
      }
    }
    if (!picked) break;

    result.push(picked);
    saldo[picked]--;
    last = picked;
  }
  return result;
}

function buildAtribuicaoDiasSemInt_(analista, semInt, numDias) {
  function fallback_() {
    const out = [];
    for (let di = 0; di < numDias; di++) {
      out.push(semInt[di % semInt.length].slot);
    }
    return out;
  }

  if (!semInt || semInt.length < 2 || numDias <= 0) return fallback_();

  const cfg = ANALISTA_DISTRIBUICAO_SEMANA[analista];
  if (!cfg || !cfg.ordem || !cfg.ordem.length) return fallback_();

  const familiasSemInt = {};
  semInt.forEach(function (d) {
    const f = slotParaFamilia_(d.slot);
    if (f) familiasSemInt[f] = d.slot;
  });

  const ordemFiltrada = cfg.ordem.filter(function (f) {
    return (cfg.proporcoes[f] || 0) > 0 && familiasSemInt[f];
  });
  if (ordemFiltrada.length < 2) return fallback_();

  const counts = escalarProporcoesSemana_(ordemFiltrada, cfg.proporcoes, numDias);
  const planoFamilias = intercalarFamiliasSemana_(ordemFiltrada, counts);
  if (planoFamilias.length !== numDias) return fallback_();

  const out = [];
  for (let i = 0; i < planoFamilias.length; i++) {
    const slot = familiasSemInt[planoFamilias[i]];
    if (!slot) return fallback_();
    out.push(slot);
  }
  return out;
}

function analistaTemDistritoNaSemana_(data, cols, semana, analista, distrito) {
  for (let r = 1; r < data.length; r++) {
    if (parseSemana_(data[r][cols.semana]) !== semana) continue;
    if (String(data[r][cols.analista] || '').trim() !== analista) continue;
    if (String(data[r][cols.distrito] || '').trim() === distrito) return true;
  }
  return false;
}

function getAbasPeriodoDisponiveis_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomes = ss.getSheets().map(function (s) {
    return s.getName();
  });
  const periodo = nomes.filter(function (n) {
    return /^H[12][.\s-]?\d{4}/i.test(String(n).trim());
  });
  if (periodo.length) return periodo;
  return nomes.filter(function (n) {
    const u = String(n).trim().toUpperCase();
    return u.indexOf('H1') === 0 || u.indexOf('H2') === 0;
  });
}

function getSheetByNameFuzzy_(ss, aba) {
  const alvo = String(aba || '').trim();
  if (!alvo) return null;
  let sheet = ss.getSheetByName(alvo);
  if (sheet) return sheet;
  const alvoLow = alvo.toLowerCase();
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === alvoLow) return sheets[i];
  }
  for (let j = 0; j < sheets.length; j++) {
    const nome = sheets[j].getName().trim();
    if (nome.toLowerCase().indexOf(alvoLow) >= 0) return sheets[j];
  }
  return null;
}

function findSemanaColumnInfo_(sheet) {
  const lastRow = Math.min(sheet.getLastRow(), 20);
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return null;
  const preview = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  for (let r = 0; r < preview.length; r++) {
    const header = preview[r].map(normalizeHeader_);
    const colS = findCol_(header, ['SEMANA', 'Semana', 'WEEK', 'Week']);
    if (colS >= 0) return { headerRow: r + 1, col: colS };
  }
  return null;
}

function getSemanasForAba(aba) {
  return { semanas: getSemanasListaParaAba_(aba || 'H1.2026') };
}

function menuVerTurnos() {
  const linhas = Object.keys(ANALISTAS).map(function (a) {
    const fam = (ANALISTA_FAMILIAS[a] || []).join(', ');
    const t = ANALISTAS[a];
    return a + ': ' + t.entrada + '-' + t.saida + ' | faz: ' + fam;
  });
  SpreadsheetApp.getUi().alert('Turnos e famílias de slot\n\n' + linhas.join('\n'));
}

function getDimensionamentoDefaults() {
  return buildDialogDefaults_();
}

function executarDimensionamento(payload) {
  const cfg = payload || {};
  const semanas = normalizarSemanasPayload_(cfg);
  if (!semanas.length) throw new Error('Selecione ao menos uma semana');
  const aba = cfg.aba || 'H1.2026';

  const sheet = getSheetByNameFuzzy_(SpreadsheetApp.getActiveSpreadsheet(), aba);
  if (!sheet) throw new Error('Aba não encontrada: ' + aba);

  const range = sheet.getDataRange();
  const data = range.getValues();
  if (data.length < 2) throw new Error('Planilha sem dados');

  const header = data[0].map(normalizeHeader_);
  const cols = mapColumns_(header);
  if (cols.semana < 0 || cols.analista < 0) throw new Error('Colunas SEMANA/ANALISTA não encontradas');
  if (!cols.timeIndices.length) throw new Error('Colunas de horário não encontradas');

  const stats = { processadas: 0, ignoradas: 0, semTurno: [], avisos: [], slots: {}, aba: aba, semanas: [] };
  const ativosSet = criarSetAnalistasAtivos_(cfg);
  stats.analistasAtivos = Object.keys(ativosSet).filter(function (a) { return ativosSet[a]; });

  semanas.forEach(function (semana) {
    executarModoCotas_(data, cols, header, semana, cfg, stats);
    stats.semanas.push(semana);
  });

  range.setValues(data);
  return buildReport_(semanas, stats);
}

// --- Modo expediente (grade cheia GS) ---

function executarModoExpediente_(data, cols, header, semana, cfg, stats) {
  const segundaCfg = cfg.segundaMa !== false
    ? { slot: 'MA - CR', quantidade: 4, resto: 'GS - MA' }
    : null;

  for (let r = 1; r < data.length; r++) {
    if (parseSemana_(data[r][cols.semana]) !== semana) continue;
    const analista = String(data[r][cols.analista] || '').trim();
    const distritoPlanilha = cols.distrito >= 0 ? String(data[r][cols.distrito] || '').trim() : '';
    const acfg = getAnalystConfig_(analista, distritoPlanilha);
    if (!acfg) {
      stats.semTurno.push(analista);
      stats.ignoradas++;
      continue;
    }
    const dia = getDiaSemana_(data[r], cols);
    const opts = {
      segundaFeira: segundaCfg,
      gsOverride: GS_POR_DISTRITO[acfg.distrito] || null,
    };
    const resultado = aplicarDiaNaLinha_(data[r], cols.timeIndices, header, acfg, dia, stats.avisos, opts);
    commitValores_(data, r, cols.timeIndices, resultado.valores, stats);
    stats.processadas++;
  }
}

// --- Modo cotas (quantidades por analista/semana) ---

function executarModoCotas_(data, cols, header, semana, cfg, stats) {
  const demandasPorAnalista = {};
  const ativosSet = criarSetAnalistasAtivos_(cfg);

  function addDemanda(analista, slot, qtd, semanaInteira) {
    if (!analista || !slot) return;
    if (!analistaEstaAtivo_(analista, ativosSet)) return;
    if (!semanaInteira && (!qtd || qtd <= 0)) return;
    if (!analistaPodeSlot_(analista, slot)) {
      stats.avisos.push(analista + ' não executa ' + slot + ' (ignorado)');
      return;
    }
    if (!demandasPorAnalista[analista]) demandasPorAnalista[analista] = [];
    demandasPorAnalista[analista].push({
      slot: slot,
      quantidade: qtd || 0,
      semanaInteira: !!semanaInteira,
    });
  }

  function resolverCotaDistrito_(c) {
    const semInt = !!c.semanaInteira;
    if (!c.slot || (!semInt && (!c.quantidade || c.quantidade <= 0))) return;
    const distrito = String(c.distrito || '').trim();
    const global_ = cotaUsaElegiveisGlobais_(c);
    const vistos = {};
    for (let r = 1; r < data.length; r++) {
      if (parseSemana_(data[r][cols.semana]) !== semana) continue;
      const a = String(data[r][cols.analista] || '').trim();
      if (!a || vistos[a]) continue;
      if (!analistaEstaAtivo_(a, ativosSet)) continue;
      if (!analistaPodeSlot_(a, c.slot)) continue;
      if (global_) {
        if (!analistaTemLinhaNaSemana_(data, cols, semana, a)) continue;
      } else if (!analistaTemDistritoNaSemana_(data, cols, semana, a, distrito)) {
        continue;
      }
      vistos[a] = true;
      addDemanda(a, c.slot, c.quantidade, semInt);
    }
    if (!Object.keys(vistos).length) {
      stats.avisos.push('Sem elegíveis: ' + (distrito || c.slot) + ' / ' + c.slot);
    }
  }

  (cfg.cotasDistrito || []).forEach(resolverCotaDistrito_);

  const rowsPorAnalista = {};
  for (let r = 1; r < data.length; r++) {
    if (parseSemana_(data[r][cols.semana]) !== semana) continue;
    const analista = String(data[r][cols.analista] || '').trim();
    if (!rowsPorAnalista[analista]) rowsPorAnalista[analista] = [];
    rowsPorAnalista[analista].push(r);
  }

  Object.keys(rowsPorAnalista).forEach(function (analista) {
    if (!analistaEstaAtivo_(analista, ativosSet)) return;
    const acfg = getAnalystConfig_(analista, '');
    if (!acfg) {
      stats.semTurno.push(analista);
      return;
    }
    alocarDemandasAnalista_(data, cols, header, acfg, rowsPorAnalista[analista], demandasPorAnalista[analista] || [], stats, analista);
  });
}

function alocarDemandasAnalista_(data, cols, header, acfg, filas, demandas, stats, analista) {
  const dias = [];
  filas.forEach(function (r) {
    const prep = prepararLinhaBase_(data[r], cols.timeIndices, header, acfg, stats.avisos);
    commitValores_(data, r, cols.timeIndices, prep.valores, stats);
    dias.push({
      row: r,
      dia: normalizarDia_(getDiaSemana_(data[r], cols)),
      disponiveis: prep.disponiveis.slice(),
    });
    stats.processadas++;
  });
  dias.sort(function (a, b) { return ordemDia_(a.dia) - ordemDia_(b.dia); });

  const sorted = (demandas || []).slice().sort(function (a, b) {
    return prioridadeSlot_(a.slot) - prioridadeSlot_(b.slot);
  });
  const comQtd = sorted.filter(function (d) { return !d.semanaInteira; });
  const semInt = sorted.filter(function (d) { return d.semanaInteira; });

  let poolRestante = [];
  dias.forEach(function (d) {
    d.disponiveis.forEach(function (idx) {
      poolRestante.push({ row: d.row, idx: idx, ordem: d.row * 1000 + idx });
    });
  });
  poolRestante.sort(function (a, b) { return a.ordem - b.ordem; });

  comQtd.forEach(function (d) {
    let faltam = d.quantidade;
    poolRestante = poolRestante.filter(function (p) {
      if (faltam <= 0) return true;
      const ci = cols.timeIndices[p.idx];
      const cur = String(data[p.row][ci] || '').trim();
      if (canOverwrite_(cur)) {
        data[p.row][ci] = d.slot;
        stats.slots[d.slot] = (stats.slots[d.slot] || 0) + 1;
        faltam--;
        return false;
      }
      return true;
    });
    if (faltam > 0) {
      stats.avisos.push(analista + ': faltam ' + faltam + ' blocos de ' + d.slot);
    }
  });

  if (semInt.length > 1) {
    const atribuicao = buildAtribuicaoDiasSemInt_(analista, semInt, dias.length);
    dias.forEach(function (d, di) {
      const slot = atribuicao[di];
      if (!slot) return;
      d.disponiveis.forEach(function (idx) {
        const ci = cols.timeIndices[idx];
        const cur = String(data[d.row][ci] || '').trim();
        if (canOverwrite_(cur)) {
          data[d.row][ci] = slot;
          stats.slots[slot] = (stats.slots[slot] || 0) + 1;
        }
      });
    });
  } else if (semInt.length === 1) {
    const dem = semInt[0];
    poolRestante.forEach(function (p) {
      const ci = cols.timeIndices[p.idx];
      const cur = String(data[p.row][ci] || '').trim();
      if (canOverwrite_(cur)) {
        data[p.row][ci] = dem.slot;
        stats.slots[dem.slot] = (stats.slots[dem.slot] || 0) + 1;
      }
    });
  }
}

// --- Linha: base (break + fora expediente) ---

function prepararLinhaBase_(row, timeIndices, header, acfg, avisos) {
  const valores = timeIndices.map(function (ci) {
    return String(row[ci] == null ? '' : row[ci]).trim();
  });
  const timeLabels = timeIndices.map(function (ci) {
    return normalizeHeader_(header[ci]);
  });
  const expSet = {};
  indicesExpediente_(acfg.entrada, acfg.saida, timeLabels).forEach(function (i) {
    expSet[i] = true;
  });
  const brkList = indicesBreak_(acfg.break_inicio, timeLabels);

  for (let i = 0; i < timeIndices.length; i++) {
    if (!expSet[i] && !isProtected_(valores[i])) valores[i] = '';
  }
  brkList.forEach(function (i) {
    if (expSet[i] && canOverwrite_(valores[i])) valores[i] = 'Break';
  });

  const disponiveis = [];
  for (let i = 0; i < timeIndices.length; i++) {
    if (!expSet[i] || brkList.indexOf(i) >= 0) continue;
    if (isProtected_(valores[i])) continue;
    if (canOverwrite_(valores[i])) disponiveis.push(i);
  }
  return { valores: valores, disponiveis: disponiveis };
}

function aplicarDiaNaLinha_(row, timeIndices, header, acfg, diaSemana, avisos, opts) {
  opts = opts || {};
  const prep = prepararLinhaBase_(row, timeIndices, header, acfg, avisos);
  const valores = prep.valores;
  const distrito = acfg.distrito;
  const gs = opts.gsOverride || GS_POR_DISTRITO[distrito];
  if (!gs) throw new Error('Distrito sem GS: ' + distrito);

  const diaNorm = normalizarDia_(diaSemana);
  const segundaRegra = opts.segundaFeira;
  const isSegundaMA = diaNorm === 'segunda' && distrito === 'Mule Account' && segundaRegra;

  const timeLabels = timeIndices.map(function (ci) {
    return normalizeHeader_(header[ci]);
  });
  const expSet = {};
  indicesExpediente_(acfg.entrada, acfg.saida, timeLabels).forEach(function (i) {
    expSet[i] = true;
  });
  const brkList = indicesBreak_(acfg.break_inicio, timeLabels);

  const cronologicos = [];
  for (let i = 0; i < timeIndices.length; i++) {
    if (!expSet[i] || brkList.indexOf(i) >= 0) continue;
    cronologicos.push(i);
  }

  if (isSegundaMA) {
    let maRestantes = segundaRegra.quantidade;
    cronologicos.forEach(function (i) {
      if (isProtected_(valores[i]) || !canOverwrite_(valores[i])) return;
      if (maRestantes > 0) {
        valores[i] = segundaRegra.slot;
        maRestantes--;
      } else {
        valores[i] = segundaRegra.resto;
      }
    });
    if (maRestantes > 0) {
      avisos.push('Segunda MA: faltaram ' + maRestantes + ' ' + segundaRegra.slot);
    }
  } else {
    cronologicos.forEach(function (i) {
      if (isProtected_(valores[i]) || !canOverwrite_(valores[i])) return;
      valores[i] = gs;
    });
  }
  return { valores: valores };
}

function commitValores_(data, r, timeIndices, valores, stats) {
  for (let i = 0; i < timeIndices.length; i++) {
    const v = valores[i];
    data[r][timeIndices[i]] = v;
    if (v) stats.slots[v] = (stats.slots[v] || 0) + 1;
  }
}

// --- Horários ---

function gerarColunasHorario_() {
  const cols = [];
  let h = 6;
  let m = 0;
  while (h < 23 || (h === 23 && m <= 30)) {
    cols.push(padHora_(h, m));
    m += 30;
    if (m >= 60) { m = 0; h++; }
  }
  return cols;
}

function padHora_(h, m) {
  return (h < 10 ? '0' : '') + h + ':' + (m === 0 ? '00' : '30');
}

function horaParaMinutos_(hora) {
  const p = String(hora).trim().split(':');
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function indicesExpediente_(entrada, saida, timeLabels) {
  const e0 = horaParaMinutos_(entrada);
  const e1 = horaParaMinutos_(saida);
  const out = [];
  for (let i = 0; i < timeLabels.length; i++) {
    const t = horaParaMinutos_(timeLabels[i]);
    if (t >= e0 && t < e1) out.push(i);
  }
  return out;
}

function indicesBreak_(breakInicio, timeLabels) {
  const target = horaParaMinutos_(breakInicio);
  for (let i = 0; i < timeLabels.length - 1; i++) {
    if (horaParaMinutos_(timeLabels[i]) === target) return [i, i + 1];
  }
  return [];
}

// --- Proteção ---

function isProtected_(value) {
  const v = String(value || '').trim();
  if (!v) return false;
  if (PROTECTED_EXACT.indexOf(v) >= 0) return true;
  for (let i = 0; i < PROTECTED_PREFIXES.length; i++) {
    if (v.indexOf(PROTECTED_PREFIXES[i]) === 0) return true;
  }
  if (PROTECTED_OPS.indexOf(v) >= 0) return true;
  return false;
}

function canOverwrite_(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (isProtected_(v)) return false;
  if (v === 'AVLB' && SUBSTITUIR_AVLB) return true;
  return false;
}

// --- Helpers planilha ---

function normalizeHeader_(h) {
  if (h instanceof Date) {
    return Utilities.formatDate(h, Session.getScriptTimeZone(), 'HH:mm');
  }
  return String(h).trim();
}

function mapColumns_(header) {
  const timeCols = gerarColunasHorario_();
  const timeIndices = [];
  for (let i = 0; i < header.length; i++) {
    if (timeCols.indexOf(normalizeHeader_(header[i])) >= 0) timeIndices.push(i);
  }
  let colDia = findCol_(header, ['DIA SEMANA', 'DIA_SEMANA']);
  const unitIndices = [];
  for (let i = 0; i < header.length; i++) {
    if (header[i] === 'UNIT/PACK' || header[i] === 'UNIT_PACK') unitIndices.push(i);
  }
  if (colDia < 0 && unitIndices.length >= 2) colDia = unitIndices[1];
  else if (colDia < 0 && unitIndices.length === 1) colDia = unitIndices[0];
  return {
    semana: findCol_(header, ['SEMANA']),
    analista: findCol_(header, ['ANALISTA']),
    distrito: findCol_(header, ['DISTRITO']),
    dia: colDia,
    unitPack: unitIndices.length ? unitIndices[0] : -1,
    timeIndices: timeIndices,
  };
}

function findCol_(header, names) {
  const targets = names.map(function (n) {
    return String(n).trim().toUpperCase();
  });
  for (let i = 0; i < header.length; i++) {
    const h = String(header[i]).trim().toUpperCase();
    if (targets.indexOf(h) >= 0) return i;
  }
  return -1;
}

function getDiaSemana_(row, cols) {
  if (cols.dia >= 0 && row[cols.dia]) return String(row[cols.dia]);
  if (cols.unitPack >= 0) {
    const u = String(row[cols.unitPack] || '');
    if (/segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo/i.test(u)) return u;
  }
  return '';
}

function normalizarDia_(dia) {
  const d = String(dia).toLowerCase();
  if (d.indexOf('segunda') >= 0) return 'segunda';
  if (d.indexOf('terça') >= 0 || d.indexOf('terca') >= 0) return 'terca';
  if (d.indexOf('quarta') >= 0) return 'quarta';
  if (d.indexOf('quinta') >= 0) return 'quinta';
  if (d.indexOf('sexta') >= 0) return 'sexta';
  return d;
}

function parseSemana_(val) {
  if (val === '' || val == null) return NaN;
  if (typeof val === 'number' && isFinite(val)) return Math.round(val);
  if (val instanceof Date) return NaN;
  const s = String(val).trim();
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : NaN;
}

function getAnalystConfig_(analista, distritoPlanilha) {
  if (!ANALISTAS[analista]) return null;
  const cfg = JSON.parse(JSON.stringify(ANALISTAS[analista]));
  if (distritoPlanilha) cfg.distrito = distritoPlanilha;
  return cfg;
}

function buildReport_(semanas, stats) {
  const listaSem = Array.isArray(semanas) ? semanas : [semanas];
  const lines = [
    'Aba: ' + (stats.aba || ''),
    'Semanas: ' + listaSem.join(', '),
    'Linhas processadas: ' + stats.processadas,
    'Ignoradas (sem turno): ' + stats.ignoradas,
  ];
  if (stats.analistasAtivos && stats.analistasAtivos.length) {
    lines.push('Analistas incluídos: ' + stats.analistasAtivos.join(', '));
  }
  if (stats.semTurno.length) {
    const uniq = {};
    stats.semTurno.forEach(function (a) { uniq[a] = true; });
    lines.push('Sem turno: ' + Object.keys(uniq).join(', '));
  }
  if (stats.avisos.length) {
    lines.push('Avisos: ' + stats.avisos.slice(0, 6).join('; '));
  }
  lines.push('Slots aplicados (top):');
  Object.keys(stats.slots).sort(function (a, b) {
    return stats.slots[b] - stats.slots[a];
  }).slice(0, 10).forEach(function (s) {
    lines.push('  ' + s + ': ' + stats.slots[s]);
  });
  return lines.join('\n');
}