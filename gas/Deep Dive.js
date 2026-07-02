/**
 * Deep Dive — painel único de utilização de escala (modal, estilo Quality Insights)
 * Bound à planilha Dimensionamento. Dados carregam no próprio painel — sem abas extras.
 */

var DD_SHEET_TABS = ['H1.2026', 'H2.2026'];
var DD_MAX_ROWS = 5000;
var DD_SLOT_START = 8;
var DD_PROPS_KEY = 'DD_LAST_FILTERS';

var DD_DISTRITO_MAP = {
  ID: 'Identity',
  VP: 'Victims Prevention',
  Csat: 'Csat',
};

var DD_DISTRITO_LABEL = {
  Identity: 'ID',
  'Victims Prevention': 'VP',
  Csat: 'Csat',
};

// ─── Menu ───────────────────────────────────────────────────────────────────

function installDeepDiveMenu_(ui) {
  ui = ui || SpreadsheetApp.getUi();
  ui.createMenu('Deep Dive')
    .addItem('Abrir painel…', 'showDeepDiveDialog')
    .addToUi();
}

function showDeepDiveDialog() {
  try {
    var html = HtmlService.createHtmlOutputFromFile('DeepDivePanel')
      .setWidth(960)
      .setHeight(720);
    SpreadsheetApp.getUi().showModalDialog(html, 'Deep Dive');
  } catch (e) {
    try {
      var sidebar = HtmlService.createHtmlOutputFromFile('DeepDivePanel')
        .setTitle('Deep Dive')
        .setWidth(420);
      SpreadsheetApp.getUi().showSidebar(sidebar);
    } catch (e2) {
      SpreadsheetApp.getUi().alert('Deep Dive', 'Não foi possível abrir o painel: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  }
}

function contarItensPorDistritoPorSemana() {
  showDeepDiveDialog();
}

// ─── API para o painel ──────────────────────────────────────────────────────

function getDeepDiveDialogBootstrap() {
  var defaults = getDeepDiveDefaults_();
  var dates = resolvePresetDates_(defaults.preset, defaults.dataInicio, defaults.dataFim);
  defaults.dataInicio = dates.dataInicio;
  defaults.dataFim = dates.dataFim;
  return { defaults: defaults };
}

function executarDeepDive(payload) {
  var runId = deepDiveFase1_PrepararFiltros_(payload);
  deepDiveFase2_LerEscala_(runId);
  deepDiveFase3_Enriquecer_(runId);
  return deepDiveFase4_MontarRelatorio_(runId);
}

/** Fase 1 — normaliza e persiste filtros */
function deepDiveFase1_PrepararFiltros(payload) {
  return deepDiveFase1_PrepararFiltros_(payload);
}

function deepDiveFase1_PrepararFiltros_(payload) {
  var filters = normalizeDeepDiveFilters_(payload);
  PropertiesService.getDocumentProperties().setProperty(DD_PROPS_KEY, JSON.stringify(filters));
  var runId = Utilities.getUuid();
  dd_cachePut_(runId, 'filters', filters);
  return runId;
}

/** Fase 2 — lê H1/H2 e filtra período */
function deepDiveFase2_LerEscala(runId) {
  return deepDiveFase2_LerEscala_(runId);
}

function deepDiveFase2_LerEscala_(runId) {
  var filters = dd_cacheGet_(runId, 'filters');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var filtered = applyDeepDiveFilters_(buildDeepDiveFacts_(ss, filters), filters);
  dd_cachePut_(runId, 'facts', dd_serializeFacts_(filtered));
  return { runId: runId, rowCount: filtered.length };
}

/** Fase 3 — dicionário Controle de Slots */
function deepDiveFase3_Enriquecer(runId) {
  return deepDiveFase3_Enriquecer_(runId);
}

function deepDiveFase3_Enriquecer_(runId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var raw = dd_deserializeFacts_(dd_cacheGet_(runId, 'facts'));
  var enriched = enrichFactsWithDictionary_(ss, raw);
  dd_cachePut_(runId, 'facts', dd_serializeFacts_(enriched));
  return { runId: runId, rowCount: enriched.length };
}

/** Fase 4 — agrega KPIs e insights */
function deepDiveFase4_MontarRelatorio(runId) {
  return deepDiveFase4_MontarRelatorio_(runId);
}

function deepDiveFase4_MontarRelatorio_(runId) {
  var filters = dd_cacheGet_(runId, 'filters');
  var facts = dd_deserializeFacts_(dd_cacheGet_(runId, 'facts'));
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  dd_cacheClearRun_(runId);
  return buildDeepDiveReportFromFacts_(facts, filters, ss);
}

function buildDeepDiveReport_(filters) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var allFacts = buildDeepDiveFacts_(ss, filters);
  var filtered = applyDeepDiveFilters_(allFacts, filters);
  var facts = enrichFactsWithDictionary_(ss, filtered);
  return buildDeepDiveReportFromFacts_(facts, filters, ss);
}

function buildDeepDiveReportFromFacts_(facts, filters, ss) {
  var totalSlots = dd_sum_(facts, 'slots');
  var totalHoras = +(totalSlots / 2).toFixed(1);
  var itensDistintos = dd_unique_(facts, 'item').length;

  var porSlotAll = dd_groupSum_(facts, 'item', 'slots').map(function (r) {
    return {
      label: r.key,
      slots: r.slots,
      horas: +(r.slots / 2).toFixed(1),
      pct: totalSlots ? +(r.slots / totalSlots * 100).toFixed(1) : 0,
    };
  }).sort(function (a, b) { return b.slots - a.slots; });
  var porSlot = porSlotAll.slice(0, 15);

  var detalhes = buildDeepDiveDetalhesData_(ss, filters).slice(0, 12);
  var analistaLabel = (filters.analistas && filters.analistas.length === 1) ? filters.analistas[0] : '';
  var kpis = {
    totalSlots: totalSlots,
    totalHoras: totalHoras,
    itensDistintos: itensDistintos,
  };

  return {
    ok: true,
    updatedAt: new Date().toISOString(),
    period: {
      inicio: filters.dataInicio || '',
      fim: filters.dataFim || '',
      label: dd_filterPeriodLabel_(filters),
      distritos: filters.distritos || [],
      analista: analistaLabel,
    },
    kpis: kpis,
    insight: buildDeepDiveInsightLine_(filters, porSlotAll),
    porSlot: porSlot,
    porSlotTotal: porSlotAll.length,
    detalhes: detalhes,
    rowCount: facts.length,
  };
}

function listDeepDiveAnalistas(distritos, dataInicio, dataFim) {
  return listDeepDiveAnalistas_(distritos, dataInicio, dataFim);
}

// ─── Cache de execução por fases ────────────────────────────────────────────

var DD_CACHE_PREFIX = 'dd_run_';

function dd_cacheKey_(runId, suffix) {
  return DD_CACHE_PREFIX + runId + '_' + suffix;
}

function dd_cachePut_(runId, suffix, data) {
  var json = JSON.stringify(data);
  if (json.length > 95000) {
    throw new Error('Volume de dados grande demais para o painel. Reduza o período ou filtre um analista.');
  }
  CacheService.getDocumentCache().put(dd_cacheKey_(runId, suffix), json, 600);
}

function dd_cacheGet_(runId, suffix) {
  var raw = CacheService.getDocumentCache().get(dd_cacheKey_(runId, suffix));
  if (!raw) throw new Error('Sessão expirada — clique em analisar novamente.');
  return JSON.parse(raw);
}

function dd_cacheClearRun_(runId) {
  ['filters', 'facts'].forEach(function (s) {
    try { CacheService.getDocumentCache().remove(dd_cacheKey_(runId, s)); } catch (e) { /* ignore */ }
  });
}

function dd_serializeFacts_(facts) {
  return facts.map(function (r) {
    return [
      r.semana,
      dd_formatIso_(r.dia),
      r.distrito,
      r.item,
      r.analista,
      r.slots,
      r.atividade || '',
      r.classificacao || '',
      r.mapeado ? 1 : 0,
    ];
  });
}

function dd_deserializeFacts_(rows) {
  if (!rows || !rows.length) return [];
  return rows.map(function (p) {
    var dia = dd_coerceDate_(p[1]);
    return {
      semana: p[0],
      mes: dia ? dia.getMonth() + 1 : 0,
      dia: dia,
      distrito: p[2],
      item: p[3],
      analista: p[4],
      slots: p[5],
      horas: +(p[5] / 2).toFixed(1),
      atividade: p[6] || '',
      classificacao: p[7] || '',
      mapeado: !!p[8],
    };
  });
}

function buildDeepDiveDetalhesData_(ss, filters) {
  var sh = ss.getSheetByName('Base_Detalhes');
  if (!sh || sh.getLastRow() < 2) return [];

  var inicio = filters.dataInicio ? dd_startOfDay_(new Date(filters.dataInicio + 'T12:00:00')) : null;
  var fim = filters.dataFim ? dd_endOfDay_(new Date(filters.dataFim + 'T12:00:00')) : null;
  var distValues = (filters.distritos || []).map(function (k) { return DD_DISTRITO_MAP[k]; }).filter(Boolean);
  var analistaFilter = filters.analistas || [];
  var analistaDistrito = dd_buildAnalistaDistritoMap_(ss);
  var data = sh.getDataRange().getValues();
  var agg = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var slot = String(row[0] || '').trim();
    var qtd = Number(row[1]) || 0;
    var dataVal = dd_coerceDate_(row[2]);
    var analista = String(row[4] || '').trim();
    var acao = String(row[5] || '').trim();
    var projeto = String(row[6] || '').trim();
    if (!slot || !qtd) continue;
    if (inicio && dataVal && dataVal < inicio) continue;
    if (fim && dataVal && dataVal > fim) continue;
    if (!dd_analistaMatchesFilter_(analista, analistaFilter)) continue;
    var distrito = analistaDistrito[analista] || analistaDistrito[dd_normalizeAnalystKey_(analista)] || '';
    if (distValues.length && distValues.indexOf(distrito) < 0) continue;

    var key = slot + '|||' + acao + '|||' + projeto;
    if (!agg[key]) agg[key] = { slot: slot, acao: acao, projeto: projeto, qtd: 0, analistas: {} };
    agg[key].qtd += qtd;
    agg[key].analistas[analista] = true;
  }

  return Object.keys(agg).map(function (k) {
    var a = agg[k];
    return {
      label: a.slot + (a.acao ? ' · ' + a.acao : ''),
      sub: a.projeto || '',
      slots: a.qtd,
      analistas: Object.keys(a.analistas).length,
    };
  }).sort(function (a, b) { return b.slots - a.slots; });
}

// ─── Panel HTML → gas/Deep Dive.html ────────────────────────────────────────

function resolveDeepDivePresetDates(preset) {
  return resolvePresetDates_(preset, '', '');
}

// ─── Defaults & presets ─────────────────────────────────────────────────────

function getDeepDiveDefaults_() {
  var raw = PropertiesService.getDocumentProperties().getProperty(DD_PROPS_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch (e) { /* fall through */ }
  }
  return {
    distritos: ['ID'],
    analistas: [],
    preset: 'ESTA_SEMANA',
    dataInicio: '',
    dataFim: '',
    incluirBreak: true,
    incluirAusencia: true,
  };
}

function resolvePresetDates_(preset, dataInicio, dataFim) {
  var today = dd_startOfDay_(new Date());
  var monday = dd_mondayOfWeek_(today);
  var out = { dataInicio: '', dataFim: '' };

  if (preset === 'PERSONALIZADO') {
    out.dataInicio = dataInicio || '';
    out.dataFim = dataFim || '';
    return out;
  }
  if (preset === 'HOJE') {
    out.dataInicio = dd_formatIso_(today);
    out.dataFim = dd_formatIso_(today);
    return out;
  }
  if (preset === 'ESTA_SEMANA' || preset === 'ESTA SEMANA') {
    out.dataInicio = dd_formatIso_(monday);
    out.dataFim = dd_formatIso_(dd_addDays_(monday, 4));
    return out;
  }
  if (preset === 'ESTE_MES' || preset === 'ESTE MES') {
    out.dataInicio = dd_formatIso_(new Date(today.getFullYear(), today.getMonth(), 1));
    out.dataFim = dd_formatIso_(dd_lastDayOfMonth_(today));
    return out;
  }
  if (preset === 'H2_2026') {
    out.dataInicio = '2026-07-01';
    out.dataFim = '';
    return out;
  }
  if (preset === 'H1_2026') {
    out.dataInicio = '2026-01-01';
    out.dataFim = '2026-06-30';
    return out;
  }
  if (preset === 'SEMANA_PASSADA') {
    var prev = dd_addDays_(monday, -7);
    out.dataInicio = dd_formatIso_(prev);
    out.dataFim = dd_formatIso_(dd_addDays_(prev, 4));
    return out;
  }
  if (preset === 'ULTIMO_MES') {
    out.dataFim = dd_formatIso_(today);
    out.dataInicio = dd_formatIso_(dd_addDays_(today, -30));
    return out;
  }
  out.dataInicio = dataInicio || dd_formatIso_(monday);
  out.dataFim = dataFim || dd_formatIso_(dd_addDays_(monday, 4));
  return out;
}

function normalizeDeepDiveFilters_(payload) {
  var f = payload || getDeepDiveDefaults_();
  var preset = f.preset || f.presetMode || 'ESTA_SEMANA';
  if (f.dataInicio && f.dataFim && !f.preset) preset = 'PERSONALIZADO';
  var dates = resolvePresetDates_(preset, f.dataInicio, f.dataFim);
  f.preset = preset;
  f.dataInicio = dates.dataInicio;
  f.dataFim = dates.dataFim;
  if (!f.distritos) f.distritos = [];
  if (!f.analistas) f.analistas = [];
  f.incluirBreak = f.incluirBreak !== false;
  f.incluirAusencia = f.incluirAusencia !== false;
  return f;
}

// ─── Fact builder ───────────────────────────────────────────────────────────

function buildDeepDiveFacts_(ss, filters) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var inicio = null;
  var fim = null;
  if (filters) {
    if (filters.dataInicio) inicio = dd_startOfDay_(new Date(filters.dataInicio + 'T12:00:00'));
    if (filters.dataFim) fim = dd_endOfDay_(new Date(filters.dataFim + 'T12:00:00'));
  }
  var agg = {};
  DD_SHEET_TABS.forEach(function (tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    dd_aggregateSheetFacts_(sheet, tabName, agg, inicio, fim);
  });
  return dd_aggToFactRows_(agg);
}

function dd_aggregateSheetFacts_(sheet, tabName, agg, inicio, fim) {
  var lastCol = Math.max(sheet.getLastColumn(), 9);
  var lastRow = Math.min(Math.max(sheet.getLastRow(), 1), DD_MAX_ROWS);
  if (lastRow < 2) return;

  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var header = values[0].map(function (h) { return String(h || '').trim().toUpperCase(); });
  var cols = dd_mapSheetColumns_(header);

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var semana = dd_parseWeekNum_(row[cols.semana]);
    var distrito = String(row[cols.distrito] || '').trim();
    var analista = String(row[cols.analista] || '').trim();
    var email = String(row[cols.email] || '').trim();
    if (!semana || !distrito || !analista) continue;
    var dia = dd_coerceDate_(row[cols.data]);
    if (!dia) continue;
    if (inicio && dia < inicio) continue;
    if (fim && dia > fim) continue;

    for (var c = cols.slotStart; c < row.length; c++) {
      var item = String(row[c] || '').trim();
      if (!item) continue;
      var key = semana + '|||' + dia.getTime() + '|||' + distrito + '|||' + item + '|||' + analista + '|||' + email + '|||' + tabName;
      agg[key] = (agg[key] || 0) + 1;
    }
  }
}

function dd_aggToFactRows_(agg) {
  var rows = [];
  Object.keys(agg).forEach(function (key) {
    var p = key.split('|||');
    var dia = new Date(Number(p[1]));
    rows.push({
      semana: parseInt(p[0], 10),
      mes: dia.getMonth() + 1,
      dia: dia,
      distrito: p[2],
      item: p[3],
      analista: p[4],
      email: p[5],
      abaOrigem: p[6],
      slots: agg[key],
      horas: +(agg[key] / 2).toFixed(1),
      atividade: '',
      classificacao: '',
      significado: '',
    });
  });
  return rows;
}

function applyDeepDiveFilters_(facts, filters) {
  var distValues = (filters.distritos || []).map(function (k) { return DD_DISTRITO_MAP[k]; }).filter(Boolean);
  if (!distValues.length) return [];
  var inicio = filters.dataInicio ? dd_startOfDay_(new Date(filters.dataInicio + 'T12:00:00')) : null;
  var fim = filters.dataFim ? dd_endOfDay_(new Date(filters.dataFim + 'T12:00:00')) : null;
  var analistas = filters.analistas || [];

  return facts.filter(function (row) {
    if (distValues.indexOf(row.distrito) < 0) return false;
    if (analistas.length && analistas.indexOf(row.analista) < 0) return false;
    if (inicio && row.dia < inicio) return false;
    if (fim && row.dia > fim) return false;
    if (!filters.incluirBreak && row.item === 'Break') return false;
    if (!filters.incluirAusencia && (row.item === 'AVLB' || row.item === 'AUS')) return false;
    return true;
  });
}

function listDeepDiveAnalistas_(distritos, dataInicio, dataFim) {
  var filters = normalizeDeepDiveFilters_({
    distritos: distritos || [],
    preset: 'PERSONALIZADO',
    dataInicio: dataInicio,
    dataFim: dataFim,
    analistas: [],
    incluirBreak: true,
    incluirAusencia: true,
  });
  var facts = applyDeepDiveFilters_(buildDeepDiveFacts_(SpreadsheetApp.getActiveSpreadsheet(), filters), filters);
  var seen = {};
  var out = [];
  facts.forEach(function (r) {
    if (!seen[r.analista]) {
      seen[r.analista] = true;
      out.push(r.analista);
    }
  });
  out.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  return out;
}

function enrichFactsWithDictionary_(ss, facts) {
  var dict = loadSlotDictionaryMap_(ss);
  return facts.map(function (row) {
    var key = String(row.item || '').toLowerCase();
    var d = dict[key] || {};
    return {
      semana: row.semana,
      mes: row.mes,
      dia: row.dia,
      distrito: row.distrito,
      item: row.item,
      analista: row.analista,
      email: row.email,
      abaOrigem: row.abaOrigem,
      slots: row.slots,
      horas: row.horas,
      atividade: d.atividade || '',
      classificacao: d.classificacao || '',
      significado: d.significado || '',
      mapeado: !!dict[key],
    };
  });
}

// ─── Insights ───────────────────────────────────────────────────────────────

function buildDeepDiveInsightLine_(filters, porSlot) {
  var periodWord = 'Período';
  var preset = filters.preset || '';
  if (preset === 'ESTA_SEMANA' || preset === 'ESTA SEMANA') periodWord = 'Semana';
  else if (preset === 'HOJE') periodWord = 'Hoje';
  else if (preset === 'ESTE_MES' || preset === 'ESTE MES') periodWord = 'Mês';

  var dist = (filters.distritos || []).join(', ') || 'todos';
  var line = periodWord + ' ' + dist;
  if (filters.analistas && filters.analistas.length === 1) {
    line += ' · ' + filters.analistas[0];
  }
  line += ': ';

  var topParts = (porSlot || []).slice(0, 3).map(function (s) {
    return Math.round(s.pct) + '% ' + s.label;
  });
  line += topParts.length ? topParts.join(', ') + '.' : 'sem dados de slot.';
  return line;
}

function loadSlotDictionaryMap_(ss) {
  var map = {};
  var sh = ss.getSheetByName('Controle de Slots');
  if (!sh || sh.getLastRow() < 2) return map;
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 5)).getValues();
  values.forEach(function (row) {
    var tipo = String(row[1] || row[0] || '').trim();
    if (!tipo) return;
    map[tipo.toLowerCase()] = {
      atividade: String(row[0] || ''),
      significado: String(row[2] || ''),
      classificacao: String(row[3] || ''),
    };
  });
  return map;
}

function dd_buildAnalistaDistritoMap_(ss) {
  var map = {};
  DD_SHEET_TABS.forEach(function (tab) {
    var sh = ss.getSheetByName(tab);
    if (!sh || sh.getLastRow() < 2) return;
    var vals = sh.getRange(2, 1, Math.min(sh.getLastRow(), DD_MAX_ROWS), 7).getValues();
    vals.forEach(function (row) {
      var a = String(row[6] || '').trim();
      var d = String(row[5] || '').trim();
      if (a && d) {
        map[a] = d;
        map[dd_normalizeAnalystKey_(a)] = d;
      }
    });
  });
  return map;
}

function dd_normalizeAnalystKey_(s) {
  return String(s || '').toLowerCase().trim().replace(/@.*$/, '');
}

function dd_analistaMatchesFilter_(analista, filterList) {
  if (!filterList || !filterList.length) return true;
  var key = dd_normalizeAnalystKey_(analista);
  for (var i = 0; i < filterList.length; i++) {
    if (dd_normalizeAnalystKey_(filterList[i]) === key) return true;
  }
  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function dd_mapSheetColumns_(header) {
  var colData = dd_findCol_(header, ['DATA', 'DATE']);
  if (colData < 0 && header.length > 3) colData = 3;
  var colSemana = dd_findCol_(header, ['SEMANA', 'WEEK']);
  if (colSemana < 0 && header.length > 4) colSemana = 4;
  var colDistrito = dd_findCol_(header, ['DISTRITO', 'DISTRICT']);
  if (colDistrito < 0 && header.length > 5) colDistrito = 5;
  var colAnalista = dd_findCol_(header, ['ANALISTA', 'ANALYST']);
  if (colAnalista < 0 && header.length > 6) colAnalista = 6;
  var colEmail = dd_findCol_(header, ['E-MAIL', 'EMAIL', 'E_MAIL']);
  if (colEmail < 0 && header.length > 7) colEmail = 7;
  return {
    data: colData,
    semana: colSemana,
    distrito: colDistrito,
    analista: colAnalista,
    email: colEmail,
    slotStart: DD_SLOT_START,
  };
}

function dd_findCol_(header, names) {
  var targets = names.map(function (n) { return String(n).trim().toUpperCase(); });
  for (var i = 0; i < header.length; i++) {
    if (targets.indexOf(header[i]) >= 0) return i;
  }
  return -1;
}

function dd_parseWeekNum_(val) {
  if (val === '' || val == null) return 0;
  if (typeof val === 'number' && isFinite(val)) return Math.round(val);
  var m = String(val).match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function dd_coerceDate_(val) {
  if (val instanceof Date && !isNaN(val.getTime())) return dd_startOfDay_(val);
  if (typeof val === 'string' && val.trim()) {
    var d = new Date(val);
    if (!isNaN(d.getTime())) return dd_startOfDay_(d);
  }
  if (typeof val === 'number' && isFinite(val)) {
    var epoch = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(epoch.getTime())) return dd_startOfDay_(epoch);
  }
  return null;
}

function dd_startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dd_endOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function dd_addDays_(d, n) {
  var x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function dd_mondayOfWeek_(d) {
  var day = d.getDay();
  var diff = day === 0 ? -6 : 1 - day;
  return dd_addDays_(d, diff);
}

function dd_lastDayOfMonth_(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function dd_formatIso_(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function dd_formatBr_(d) {
  if (!d || isNaN(d.getTime())) return '';
  return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
}

function dd_filterPeriodLabel_(filters) {
  var a = filters.dataInicio ? dd_formatBr_(new Date(filters.dataInicio + 'T12:00:00')) : '—';
  var b = filters.dataFim ? dd_formatBr_(new Date(filters.dataFim + 'T12:00:00')) : 'hoje';
  return a + ' → ' + b;
}

function dd_sum_(rows, field) {
  var t = 0;
  rows.forEach(function (r) { t += Number(r[field]) || 0; });
  return t;
}

function dd_sumWhere_(rows, field, pred) {
  var t = 0;
  rows.forEach(function (r) { if (pred(r)) t += Number(r[field]) || 0; });
  return t;
}

function dd_unique_(rows, field) {
  var s = {};
  rows.forEach(function (r) {
    var v = r[field];
    if (v instanceof Date) v = dd_formatIso_(v);
    if (v) s[String(v)] = true;
  });
  return Object.keys(s);
}

function dd_groupSum_(rows, keyField, valField) {
  var m = {};
  rows.forEach(function (r) {
    var k = r[keyField];
    if (k instanceof Date) k = dd_formatIso_(k);
    if (!m[k]) m[k] = { key: k, slots: 0 };
    m[k].slots += Number(r[valField]) || 0;
  });
  return Object.keys(m).map(function (k) { return m[k]; });
}

function dd_topN_(list, n) {
  return list.slice().sort(function (a, b) { return b.slots - a.slots; }).slice(0, n);
}

function dd_topByKey_(rows, keyField, valField) {
  var g = dd_groupSum_(rows, keyField, valField);
  if (!g.length) return { key: '', val: 0 };
  g.sort(function (a, b) { return b.slots - a.slots; });
  return { key: g[0].key, val: g[0].slots };
}
