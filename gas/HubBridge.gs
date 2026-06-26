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
      return hubGetSessionInfo_(payload || {});
    case 'getUserSchedule':
      return hubGetUserSchedule_(payload || {});
    case 'saveBatchData':
      return hubSaveBatchData_(payload || {});
    case 'getPendingDetails':
      return hubGetPendingDetails_(payload || {});
    case 'getAdjustments':
      return hubGetAdjustments_(payload || {});
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

function hubGetSessionInfo_(payload) {
  payload = payload || {};
  var fromPayload = payload.userEmail ? String(payload.userEmail).toLowerCase().trim() : '';
  var email = Session.getActiveUser().getEmail().toLowerCase().trim();
  if (!email) email = fromPayload;
  return {
    email: email,
    analystKey: email ? email.split('@')[0] : '',
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
  var ss = _core_getSpreadsheet_();
  var half = parseInt(_core_parseWeekNum_(weekKey), 10) >= 27 ? 2 : 1;
  var sheet = _core_findScheduleTab_(ss, half);
  if (!sheet || sheet.getLastRow() < 2) return map;

  userEmail = String(userEmail || '').toLowerCase().trim();
  weekKey = _core_parseWeekNum_(weekKey);
  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(8, sheet.getLastColumn());
  var headerRange = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol) : null;
  var headers = headerRange ? headerRange.getDisplayValues()[0] : [];
  var headersRaw = headerRange ? headerRange.getValues()[0] : [];
  var cols = _core_mapSheetColumns_(headers, headersRaw);
  var idColEnd = Math.max(cols.dia, cols.data, cols.semana, cols.analista, cols.email, 0) + 1;
  var numDataRows = Math.max(0, lastRow - 1);
  var rows = numDataRows > 0 ? sheet.getRange(2, 1, numDataRows, idColEnd).getDisplayValues() : [];

  rows.forEach(function (row) {
    var email = cols.email >= 0 && row[cols.email] ? String(row[cols.email]).toLowerCase().trim() : '';
    var analyst = cols.analista >= 0 && row[cols.analista] ? String(row[cols.analista]).toLowerCase().trim() : '';
    if (!_core_rowMatchesUser_(email, analyst, userEmail)) return;
    var weekNum = cols.semana >= 0 ? _core_parseWeekNum_(row[cols.semana]) : '';
    if (weekNum !== weekKey) return;
    var dateIso = cols.data >= 0 ? _core_formatDateToISO(row[cols.data]) : '';
    var dayName = _core_dayNameFromRow_(row, null, cols.dia);
    if (!dateIso) dateIso = _core_dateFromWeekAndDay_(weekNum, dayName);
    if (!dateIso) return;
    var d = _core_parseDate(dateIso);
    if (!dayName || !_core_isWeekdayName_(dayName)) dayName = _core_dayNameFromRow_(row, d, cols.dia);
    if (_core_isWeekdayName_(dayName)) map[dayName] = dateIso;
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
function hubGetUserSchedule_(payload) {
  payload = payload || {};
  var raw = getUserSchedule(payload);
  if (raw.error) throw new Error(raw.error);

  var weekKey = _core_parseWeekNum_(payload.week != null ? payload.week : hubGetCurrentWeek_());
  var weekData = _core_getScheduleWeek_(raw.schedule, weekKey);
  var userEmail = raw.userEmail || _core_resolveUserEmail_(payload);
  if (!userEmail) {
    throw new Error('E-mail não identificado. Conecte à planilha no Hub ou abra o app GAS logado com sua conta @nubank.com.br.');
  }
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
      var normTime = hubNormalizeTime_(time);
      slots[normTime] = task;
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

  var config = hubGetConfig_(weekKey);
  var adjustments = hubBuildAdjustmentsFromWeekData_(
    weekKey,
    weekData,
    userEmail,
    config.detailSlots || [],
    config.timeSlots || []
  );

  return {
    week: Number(weekKey),
    sheetName: _core_sheetNameForWeek_(weekKey),
    identity: hubGetSessionInfo_(),
    config: config,
    colors: hubGetSlotColors_(),
    days: days,
    summary: summary,
    rawSchedule: raw.schedule,
    adjustments: adjustments.records,
    pendingCount: adjustments.pendingCount
  };
}

/** Adapta payload do Hub → saveBatchData({ slots: [{dayDate,time,task}] }) */
function hubSaveBatchData_(payload) {
  payload = payload || {};
  var slotItems = [];
  var userEmail = String(payload.userEmail || Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  if (!userEmail) throw new Error('Usuário não autenticado. Conecte à planilha no Hub e tente salvar de novo.');

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

  var result = saveBatchData({ slots: slotItems, details: details, userEmail: userEmail });
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

var HUB_DETAIL_REQUIRES_PROJECT_ = {
  'Planilha': true, 'Deep Dive': true, 'Docs': true, 'Playbook': true, 'RFC': true, 'Slides': true,
  'Project Meet': true, 'Databricks': true, 'Quicksight': true
};

function hubDetailRequiresSpec_(action, project) {
  return action === 'Outro' || project === 'Outro' ||
    project === 'MMP (Projeto não mapeado)' || project === 'NMP (Projeto não mapeado)';
}

function hubParseCellDetails_(detailsRaw) {
  if (!detailsRaw) return { action: '', project: '', otherSpec: '' };
  if (typeof detailsRaw === 'object') {
    return {
      action: String(detailsRaw.action || '').trim(),
      project: String(detailsRaw.project || '').trim(),
      otherSpec: String(detailsRaw.otherSpec || detailsRaw.other || '').trim()
    };
  }
  try {
    var parsed = JSON.parse(String(detailsRaw));
    return hubParseCellDetails_(parsed);
  } catch (e) {
    return { action: '', project: '', otherSpec: '' };
  }
}

function hubIsDetailIncomplete_(slot, details) {
  var d = hubParseCellDetails_(details);
  if (!d.action) return true;
  if (HUB_DETAIL_REQUIRES_PROJECT_[slot] && !d.project) return true;
  if (hubDetailRequiresSpec_(d.action, d.project) && !d.otherSpec) return true;
  return false;
}

function hubNormalizeDetailsForComparison_(details) {
  var d = hubParseCellDetails_(details);
  return JSON.stringify({ action: d.action, project: d.project, otherSpec: d.otherSpec });
}

function hubHourToIndex_(timeStr) {
  var parts = String(timeStr || '').split(':');
  var hh = parseInt(parts[0], 10);
  var mm = parseInt(String(parts[1] || '0').replace(/\D/g, ''), 10);
  if (isNaN(hh)) return 0;
  if (isNaN(mm)) mm = 0;
  return hh * 2 + (mm >= 30 ? 1 : 0);
}

/** Garante timeSlots cobrindo todos os horários presentes na semana */
function hubEnsureTimeSlotsForWeek_(weekData, timeSlots) {
  var slots = (timeSlots || []).slice().map(hubNormalizeTime_).filter(Boolean);
  var seen = {};
  slots.forEach(function (s) { seen[s] = true; });
  var days = ['segunda', 'terça', 'quarta', 'quinta', 'sexta'];
  days.forEach(function (day) {
    Object.keys(weekData[day] || {}).forEach(function (h) {
      var n = hubNormalizeTime_(h);
      if (n && !seen[n]) {
        seen[n] = true;
        slots.push(n);
      }
    });
  });
  slots.sort(function (a, b) { return hubHourToIndex_(a) - hubHourToIndex_(b); });
  return slots;
}

/** Espelha getGroupedRecords() de App_Logica.html — agrupa slots consecutivos com herança de detalhes */
function hubGetGroupedRecords_(weekData, timeSlots, filterTask) {
  var days = ['segunda', 'terça', 'quarta', 'quinta', 'sexta'];
  timeSlots = hubEnsureTimeSlotsForWeek_(weekData, timeSlots);
  var flatRecords = [];

  days.forEach(function (day) {
    var daySlots = weekData[day];
    if (!daySlots) return;
    Object.keys(daySlots).forEach(function (hour) {
      var data = daySlots[hour];
      var taskName = (typeof data === 'string') ? data : (data && data.task);
      if (!taskName || taskName === 'Break') return;
      if (filterTask && taskName !== filterTask) return;
      var normHour = hubNormalizeTime_(hour);
      var hourIndex = timeSlots.indexOf(normHour);
      if (hourIndex < 0) hourIndex = hubHourToIndex_(normHour);
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
    var dayDiff = days.indexOf(a.day) - days.indexOf(b.day);
    return dayDiff !== 0 ? dayDiff : a.hourIndex - b.hourIndex;
  });

  if (!flatRecords.length) return [];

  var emptyJson = '{"action":"","project":"","otherSpec":""}';
  var groups = [];
  var currentGroup = {
    day: flatRecords[0].day,
    hour: flatRecords[0].hour,
    hourIndex: flatRecords[0].hourIndex,
    data: flatRecords[0].data,
    taskName: flatRecords[0].taskName,
    count: 1,
    endHourIndex: flatRecords[0].hourIndex
  };

  for (var i = 1; i < flatRecords.length; i++) {
    var rec = flatRecords[i];
    var prev = currentGroup;

    var isSameDay = rec.day === prev.day;
    var isSameTask = rec.taskName === prev.taskName;

    var recStr = hubNormalizeDetailsForComparison_(rec.data && rec.data.details);
    var prevStr = hubNormalizeDetailsForComparison_(prev.data && prev.data.details);
    var isRecEmpty = recStr === emptyJson;
    var isPrevFull = prevStr !== emptyJson;

    var isSameDetails = recStr === prevStr;
    if (isSameTask && isSameDay && isRecEmpty && isPrevFull) isSameDetails = true;
    if (isSameTask && isSameDay && !isRecEmpty && isPrevFull && isRecEmpty) isSameDetails = true;

    var gap = rec.hourIndex - prev.endHourIndex;
    var isConsecutiveLogic = false;
    if (gap === 1) {
      isConsecutiveLogic = true;
    } else if (gap > 1 && isSameDay) {
      var currentDayBreaks = Object.keys(weekData[rec.day] || {}).filter(function (h) {
        var c = weekData[rec.day][h];
        var t = (typeof c === 'string') ? c : (c && c.task);
        return t === 'Break';
      }).map(hubNormalizeTime_);
      var allBreaksInGap = true;
      for (var k = prev.endHourIndex + 1; k < rec.hourIndex; k++) {
        if (timeSlots[k] && currentDayBreaks.indexOf(timeSlots[k]) < 0) {
          allBreaksInGap = false;
          break;
        }
      }
      isConsecutiveLogic = allBreaksInGap;
    }

    if (isSameDay && isSameTask && isConsecutiveLogic && isSameDetails) {
      currentGroup.count++;
      currentGroup.endHourIndex = rec.hourIndex;
    } else {
      groups.push(currentGroup);
      currentGroup = {
        day: rec.day,
        hour: rec.hour,
        hourIndex: rec.hourIndex,
        data: rec.data,
        taskName: rec.taskName,
        count: 1,
        endHourIndex: rec.hourIndex
      };
    }
  }
  groups.push(currentGroup);
  return groups;
}

function hubFormatVisualDate_(dateIso) {
  if (!dateIso || String(dateIso).indexOf('-') < 0) return '';
  var p = String(dateIso).split('-');
  return p[2] + '/' + p[1];
}

function hubBuildAdjustmentsFromWeekData_(weekKey, weekData, userEmail, detailTypes, timeSlots) {
  var dateByDayName = hubGetWeekDateMap_(weekKey, userEmail);
  var groups = hubGetGroupedRecords_(weekData, timeSlots, null);
  var records = [];
  var pending = [];

  groups.forEach(function (g) {
    if (detailTypes.indexOf(g.taskName) < 0) return;

    var dayKey = HUB_DAY_MAP_[g.day] || String(g.day).substring(0, 3);
    var dateIso = dateByDayName[g.day] || hubComputeDateForWeekDay_(weekKey, dayKey);
    var details = hubParseCellDetails_(g.data && g.data.details);
    var isPending = hubIsDetailIncomplete_(g.taskName, details);

    var record = {
      slot: g.taskName,
      day: dayKey,
      dayLabel: g.day,
      date: dateIso,
      dateVisual: hubFormatVisualDate_(dateIso),
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

  return {
    records: records,
    pending: pending,
    pendingCount: pending.length,
    week: Number(weekKey)
  };
}

function hubGetAdjustments_(payload) {
  payload = payload || {};
  var raw = getUserSchedule({ week: payload.week, userEmail: payload.userEmail });
  if (raw.error) throw new Error(raw.error);

  var weekKey = _core_parseWeekNum_(payload.week != null ? payload.week : hubGetCurrentWeek_());
  var weekData = _core_getScheduleWeek_(raw.schedule, weekKey);
  var userEmail = raw.userEmail || _core_resolveUserEmail_(payload);
  var config = hubGetConfig_(weekKey);
  return hubBuildAdjustmentsFromWeekData_(
    weekKey,
    weekData,
    userEmail,
    config.detailSlots || [],
    config.timeSlots || []
  );
}

function hubGetPendingDetails_(payload) {
  var adj = hubGetAdjustments_(payload || {});
  return {
    pending: adj.pending,
    pendingCount: adj.pendingCount,
    week: adj.week
  };
}

function hubSaveDetail_(payload) {
  payload = payload || {};
  var userEmail = String(payload.userEmail || Session.getActiveUser().getEmail() || '').toLowerCase().trim();
  if (!userEmail) throw new Error('Usuário não autenticado. Conecte à planilha no Hub e tente salvar de novo.');
  var legacy = hubDetailToLegacy_(payload, payload.tipo || payload.slot);
  var result = saveBatchData({ slots: [], details: [legacy], userEmail: userEmail });
  if (result && result.error) throw new Error(result.error);
  return { ok: true };
}

function hubReadSlotDictionaryFromSheet_() {
  var ss = _core_getSpreadsheet_();
  var sh = ss.getSheetByName('Controle de Slots');
  if (!sh || sh.getLastRow() < 2) return [];
  var values = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), 5)).getValues();
  return values.map(function (row) {
    return {
      atividade: String(row[0] || ''),
      tipoSlot: String(row[1] || row[0] || ''),
      significado: String(row[2] || ''),
      classificacao: String(row[3] || ''),
      conversao: String(row[4] || '')
    };
  }).filter(function (x) { return x.tipoSlot; });
}

/** Mescla planilha (customizações) sobre STATIC_SLOT_DATA do Config_Slots.html */
function hubMergeSlotDictionaries_(sheetItems, staticItems) {
  var map = {};
  (staticItems || []).forEach(function (it) {
    var key = String(it.tipoSlot || '').toLowerCase();
    if (key) map[key] = it;
  });
  (sheetItems || []).forEach(function (it) {
    var key = String(it.tipoSlot || '').toLowerCase();
    if (key) map[key] = it;
  });
  var merged = Object.keys(map).map(function (k) { return map[k]; });
  merged.sort(function (a, b) {
    var act = String(a.atividade || '').localeCompare(String(b.atividade || ''), 'pt-BR');
    if (act !== 0) return act;
    return String(a.tipoSlot || '').localeCompare(String(b.tipoSlot || ''), 'pt-BR');
  });
  return merged;
}

function hubGetSlotDictionary_() {
  var staticData = hubGetStaticSlotDictionary_();
  var staticItems = (staticData && staticData.items) || [];
  var sheetItems = hubReadSlotDictionaryFromSheet_();
  return {
    items: hubMergeSlotDictionaries_(sheetItems, staticItems),
    categories: []
  };
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

function hubNormalizeTime_(t) {
  if (!t) return '';
  var str = String(t).trim();
  var parts = str.split(':');
  if (parts.length >= 2) {
    var hh = parseInt(parts[0], 10);
    if (isNaN(hh)) return str;
    var mm = String(parts[1]).replace(/\D/g, '').substring(0, 2);
    if (mm.length < 2) mm = mm.padStart(2, '0');
    return String(hh).padStart(2, '0') + ':' + mm;
  }
  return str;
}

/** Lê horários do cabeçalho da planilha (coluna I em diante) */
function hubGetTimeSlotsFromSheet_(weekKey) {
  var startCol = typeof SLOT_START_COL_INDEX !== 'undefined' ? SLOT_START_COL_INDEX : 8;
  var ss = _core_getSpreadsheet_();
  var half = weekKey != null && parseInt(_core_parseWeekNum_(weekKey), 10) >= 27 ? 2 : 1;
  var sheet = _core_findScheduleTab_(ss, half);
  if (!sheet) return null;
  var lastCol = sheet.getLastColumn();
  var headerRange = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol) : null;
  var headers = headerRange ? headerRange.getDisplayValues()[0] : [];
  var headersRaw = headerRange ? headerRange.getValues()[0] : [];
  var cols = _core_mapSheetColumns_(headers, headersRaw);
  var slotStart = cols.slotStart >= 0 ? cols.slotStart : startCol;
  var timeHeaders = _core_readTimeHeadersFromRow_(headers, headersRaw, slotStart);
  if (!_core_timeHeadersHaveSlots_(timeHeaders) || lastCol <= slotStart + 1) {
    var fallback = _core_loadH1TimeHeaders_(ss, slotStart);
    if (fallback.length) timeHeaders = fallback;
  }
  var slots = [];
  for (var h = 0; h < timeHeaders.length; h++) {
    var n = hubNormalizeTime_(timeHeaders[h]);
    if (n) slots.push(n);
  }
  if (!slots.length && half === 2) {
    return hubGetTimeSlotsFromSheet_('26');
  }
  return slots.length ? slots : null;
}

function hubDefaultTimeSlots_() {
  var slots = [];
  for (var h = 6; h <= 23; h++) {
    slots.push((h < 10 ? '0' : '') + h + ':00');
    slots.push((h < 10 ? '0' : '') + h + ':30');
  }
  return slots;
}
function hubGetConfig_(weekKey) {
  var slots = hubGetTimeSlotsFromSheet_(weekKey) || hubDefaultTimeSlots_();
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
