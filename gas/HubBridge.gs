/**
 * Ponte Hub ↔ Dim Quality ID (Código.gs de produção)
 * Adicionar junto com Bridge.html — NÃO substituir Código.gs
 */

function dimApiCall(action, payloadJson) {
  var payload = payloadJson ? JSON.parse(payloadJson) : {};
  try {
    var data = hubHandleAction_(action, payload);
    return JSON.stringify({ ok: true, data: data });
  } catch (err) {
    return JSON.stringify({
      ok: false,
      error: String(err.message || err),
      validationRejected: String(err.message || err).toLowerCase().indexOf('valid') >= 0
    });
  }
}

function hubHandleAction_(action, payload) {
  switch (action) {
    case 'ping':
      return { pong: true };
    case 'getSessionInfo':
      return hubGetSessionInfo_();
    case 'getUserSchedule':
      return hubGetUserSchedule_(payload && payload.week);
    case 'saveBatchData':
      return hubSaveBatchData_(payload || {});
    case 'getPendingDetails':
      return hubGetPendingDetails_(payload && payload.week);
    case 'saveDetail':
      return hubSaveDetail_(payload || {});
    case 'getSlotDictionary':
      return hubGetSlotDictionary_();
    case 'getSlotColors':
      return hubGetSlotColors_();
    case 'getConfig':
      return hubGetConfig_();
    case 'runAutoDimensionamento':
      return hubRunAutoDim_(payload || {});
    case 'runDeepDive':
      return hubRunDeepDive_(payload || {});
    default:
      throw new Error('Ação desconhecida: ' + action);
  }
}

function hubGetSessionInfo_() {
  var email = Session.getActiveUser().getEmail().toLowerCase().trim();
  return {
    email: email,
    analystKey: email.split('@')[0],
    isLeader: false
  };
}

function hubGetCurrentWeek_() {
  var d = new Date();
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

var HUB_DAY_MAP_ = {
  'segunda': 'seg', 'terça': 'ter', 'quarta': 'qua', 'quinta': 'qui', 'sexta': 'sex',
  'segunda-feira': 'seg', 'terça-feira': 'ter', 'quarta-feira': 'qua', 'quinta-feira': 'qui', 'sexta-feira': 'sex'
};

/** Mapa dia da semana (segunda…) → ISO yyyy-mm-dd a partir da planilha */
function hubGetWeekDateMap_(weekKey, userEmail) {
  var map = {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = typeof MAIN_TAB_NAME !== 'undefined' ? MAIN_TAB_NAME : 'H1.2026';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return map;

  userEmail = String(userEmail || '').toLowerCase().trim();
  weekKey = String(weekKey);
  var dayNames = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  var rows = sheet.getRange(2, 4, sheet.getLastRow(), 8).getDisplayValues();

  rows.forEach(function (row) {
    var email = String(row[4] || '').toLowerCase().trim();
    if (email !== userEmail) return;
    var weekNum = row[1] ? String(row[1]).trim() : '';
    if (weekNum !== weekKey) return;
    var dateIso = _core_formatDateToISO(row[0]);
    if (!dateIso) return;
    var d = _core_parseDate(dateIso);
    if (!d || isNaN(d.getTime())) return;
    var dayName = dayNames[d.getUTCDay()];
    if (dayName) map[dayName] = dateIso;
  });
  return map;
}

/** Fallback: mesma lógica de getDatesForWeek do Config_Slots.html */
function hubComputeDateForWeekDay_(weekNum, dayKey) {
  var keyMap = { seg: 0, ter: 1, qua: 2, qui: 3, sex: 4 };
  var idx = keyMap[String(dayKey || '').substring(0, 3)] ;
  if (idx == null) return '';

  var simpleYear = 2026;
  var d = new Date(simpleYear, 0, 1 + (Number(weekNum) - 1) * 7);
  var day = d.getDay();
  var diff = d.getDate() - day + (day === 0 ? -6 : 1);
  var monday = new Date(d.getFullYear(), d.getMonth(), diff);
  var current = new Date(monday);
  current.setDate(monday.getDate() + idx);
  var yyyy = current.getFullYear();
  var mm = String(current.getMonth() + 1);
  if (mm.length < 2) mm = '0' + mm;
  var dd = String(current.getDate());
  if (dd.length < 2) dd = '0' + dd;
  return yyyy + '-' + mm + '-' + dd;
}

/** Adapta { schedule, userEmail } do seu getUserSchedule() para o formato do Hub */
function hubGetUserSchedule_(week) {
  var raw = getUserSchedule();
  if (raw.error) throw new Error(raw.error);

  var weekKey = String(week != null ? week : hubGetCurrentWeek_());
  var weekData = (raw.schedule && raw.schedule[weekKey]) || {};
  var userEmail = raw.userEmail || Session.getActiveUser().getEmail().toLowerCase().trim();
  var dateByDayName = hubGetWeekDateMap_(weekKey, userEmail);

  var days = [];
  var summary = {};

  Object.keys(weekData).forEach(function (dayName) {
    var dayKey = HUB_DAY_MAP_[dayName] || String(dayName).substring(0, 3);
    var daySlots = weekData[dayName];
    var slots = {};
    var filledCount = 0;
    var dateIso = dateByDayName[dayName] || hubComputeDateForWeekDay_(weekKey, dayKey);

    Object.keys(daySlots).forEach(function (time) {
      var cell = daySlots[time];
      var task = cell && cell.task ? String(cell.task) : '';
      slots[time] = task;
      if (task) {
        summary[task] = (summary[task] || 0) + 1;
        filledCount++;
      }
    });

    days.push({
      day: dayKey,
      dayLabel: dayName,
      date: dateIso,
      slots: slots,
      filledCount: filledCount
    });
  });

  var order = ['seg', 'ter', 'qua', 'qui', 'sex'];
  days.sort(function (a, b) { return order.indexOf(a.day) - order.indexOf(b.day); });

  return {
    week: Number(weekKey),
    sheetName: typeof MAIN_TAB_NAME !== 'undefined' ? MAIN_TAB_NAME : 'H1.2026',
    identity: hubGetSessionInfo_(),
    config: hubGetConfig_(),
    colors: hubGetSlotColors_(),
    days: days,
    summary: summary,
    rawSchedule: raw.schedule
  };
}

/** Adapta payload do Hub → saveBatchData({ slots: [{dayDate,time,task}] }) */
function hubSaveBatchData_(payload) {
  var slotItems = [];
  var userEmail = Session.getActiveUser().getEmail().toLowerCase().trim();

  if (payload.slots && Array.isArray(payload.slots)) {
    slotItems = payload.slots;
  } else if (payload.slots && typeof payload.slots === 'object') {
    var date = payload.date || '';
    if (!date && payload.day) {
      date = hubComputeDateForWeekDay_(payload.week, payload.day);
      var map = hubGetWeekDateMap_(String(payload.week || ''), userEmail);
      var dayNameMap = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta' };
      var dn = dayNameMap[payload.day] || payload.day;
      if (map[dn]) date = map[dn];
    }
    if (!date) throw new Error('Data do dia inválida — recarregue a semana e tente de novo.');
    Object.keys(payload.slots).forEach(function (time) {
      slotItems.push({
        dayDate: date,
        time: time,
        task: payload.slots[time] || ''
      });
    });
  }

  if (!slotItems.length) throw new Error('Nenhum slot para salvar.');

  var details = payload.details || [];
  if (payload.detail && payload.detailSlot) {
    details = [hubDetailToLegacy_(payload.detail, payload.detailSlot)];
  }

  var result = saveBatchData({ slots: slotItems, details: details });
  if (result && result.error) throw new Error(result.error);
  return Object.assign({ ok: true }, result || {});
}

function hubDetailToLegacy_(detail, slot) {
  return {
    slot: slot || detail.tipo || detail.slot,
    quantity: detail.quantidade || 1,
    date: detail.date,
    startTime: detail.hora || detail.time,
    action: detail.acao || detail.action || '',
    project: detail.projeto || detail.project || '',
    other: detail.especificacao || detail.other || ''
  };
}

function hubGetPendingDetails_(week) {
  var sched = hubGetUserSchedule_(week);
  var detailTypes = hubGetConfig_().detailSlots || [];
  var pending = [];

  sched.days.forEach(function (day) {
    Object.keys(day.slots).forEach(function (time) {
      var slot = day.slots[time];
      if (detailTypes.indexOf(slot) < 0) return;
      pending.push({
        date: day.date || '',
        day: day.day,
        time: time,
        slot: slot,
        acao: '',
        projeto: '',
        especificacao: ''
      });
    });
  });

  return { pending: pending, week: sched.week };
}

function hubSaveDetail_(payload) {
  var legacy = hubDetailToLegacy_(payload, payload.tipo || payload.slot);
  var result = saveBatchData({ slots: [], details: [legacy] });
  if (result && result.error) throw new Error(result.error);
  return { ok: true };
}

function hubGetSlotDictionary_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Controle de Slots');
  if (!sh || sh.getLastRow() < 2) return { items: [], categories: [] };
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 5)).getValues();
  var items = values.map(function (row) {
    return {
      atividade: String(row[0] || ''),
      tipoSlot: String(row[1] || row[0] || ''),
      significado: String(row[2] || ''),
      classificacao: String(row[3] || ''),
      conversao: String(row[4] || '')
    };
  }).filter(function (x) { return x.tipoSlot; });
  return { items: items, categories: [] };
}

/** Mesma lista RAW_OPTIONS do Config_Slots.html (dropdown da escala) */
function hubRawSlotOptions_() {
  return [
    'Break', '1:1', 'AT', 'AT-H', 'AVLB', 'AUS', 'AI Agent', 'Calibration', 'Calibration Packs',
    'CoffeeBreak', 'Confluence', 'CSAT', 'ProjCSAT', 'Databricks', 'Deep Dive', 'DEV', 'Docs', 'Drive',
    'DTQ', 'EDF', 'ESCL', 'Extraction', 'FLG', 'FLG-H', 'FR', 'FRDO', 'GS - ID', 'GS - VP',
    'HUB', 'ID', 'Inv. Brain', 'ITP',
    'Jira/Atlassian', 'JR - Contest ID', 'JR - Contest VP',
    'JR - Loss ID', 'JR - Loss VP', 'JR - Request',
    'Mandatorios', 'MEET-DT', 'Mission Control', 'Monthly', 'Move Pratica', 'Move Teoria',
    'OCI', 'Onb Qlt', 'Playbook', 'Playvox', 'Planilha', 'PlanilhaID', 'PlanilhaVP',
    'Pratica', 'Project Meet', 'Qulture Rocks',
    'qlt', 'qlt-HE', 'Quality Monitoring', 'Quicksight', 'RFC', 'Reuniao', 'Reciclagem',
    'RT', 'Slides', 'Shadowing Qlt', 'Stk Talk', 'Support', 'Talk IC4', 'Talk Quality', 'Trainer', 'TESTE-DT',
    'VP', 'Weekly', 'Workflow (Slack)', 'FLC', 'Appeal Flow', 'Pangaea', 'Reversals', 'CSAT-HE', 'OBF',
    'FUP Legal', 'Reativação OBF', 'Triagem OBF', 'Projeto Csat',
    'ProjFLC', 'ProjAF', 'ProjRVS', 'ProjONB', 'ProjOPS', 'ProjQLT',
    'Doc Csat', 'Reunião Csat', 'Weekly Csat', 'Sync RVS', 'Sync Legal',
    'Sync OPS', 'Sync FLC', 'Sync AF', 'Sync QLT', 'Sync ONB',
    'OPS Projeção', 'OPS Ajustes', 'Onboarding', 'Prática', 'Buddy', 'Quality', 'RVS DD', 'Legal DD', 'OPS DD', 'FLC DD',
    'AF DD', 'QLT DD', 'QR Csat', 'UPDATES', 'DIM_QLT', 'DIM_Csat'
  ];
}

function hubGetSlotOptions_() {
  var dict = hubGetSlotDictionary_();
  var seen = {};
  var fromSheet = [];
  (dict.items || []).forEach(function (it) {
    var t = String(it.tipoSlot || '').trim();
    if (t && !seen[t]) {
      seen[t] = true;
      fromSheet.push(t);
    }
  });
  if (fromSheet.length >= 20) {
    return fromSheet.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
  }
  return hubRawSlotOptions_();
}

function hubGetSlotColors_() {
  return {};
}

function hubGetConfig_() {
  var slots = [];
  for (var h = 6; h <= 23; h++) {
    slots.push((h < 10 ? '0' : '') + h + ':00');
    slots.push((h < 10 ? '0' : '') + h + ':30');
  }
  return {
    timeSlots: slots,
    days: ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira'],
    slotOptions: hubGetSlotOptions_(),
    detailSlots: ['Planilha', 'Deep Dive', 'Docs', 'Playbook', 'RFC', 'Slides', 'Jira/Atlassian', 'Drive', 'Project Meet', 'Databricks', 'Quicksight'],
    minSlotsAlert: 18
  };
}

function hubRunAutoDim_(payload) {
  if (typeof runAutoDimensionamento === 'function') return runAutoDimensionamento(payload);
  throw new Error('runAutoDimensionamento não encontrada');
}

function hubRunDeepDive_(payload) {
  if (typeof contarItensPorDistritoPorSemana === 'function') {
    return contarItensPorDistritoPorSemana(payload && payload.week);
  }
  throw new Error('contarItensPorDistritoPorSemana não encontrada');
}
