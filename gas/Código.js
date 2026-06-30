// --- CONFIGURAÇÕES ---
const SHEET_ID = "1S_rJTdcqvzvUD_-qa-Q-GWrMb9DTScQPbilqa8EzAKE";
/** Fallback legado — abas reais vêm de _core_listScheduleTabs_ (H1.2024, H2.2026, etc.) */
const MAIN_TAB_NAME = "H1.2026";
const SCHEDULE_TAB_HALF1 = 1;
const SCHEDULE_TAB_HALF2 = 2;

function _core_halfFromTabName_(name) {
  const n = String(name || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^H2([._\-]|$)/.test(n) || n === 'H2') return SCHEDULE_TAB_HALF2;
  if (/^H1([._\-]|$)/.test(n) || n === 'H1') return SCHEDULE_TAB_HALF1;
  if (n.indexOf('H2') === 0) return SCHEDULE_TAB_HALF2;
  if (n.indexOf('H1') === 0) return SCHEDULE_TAB_HALF1;
  return 0;
}

function _core_detectHalfFromSheetWeeks_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const lastCol = Math.min(12, sheet.getLastColumn());
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  const headers = headerRange.getDisplayValues()[0];
  const headersRaw = headerRange.getValues()[0];
  const cols = _core_mapSheetColumns_(headers, headersRaw);
  if (cols.semana < 0) return 0;
  const numRows = Math.min(Math.max(0, lastRow - 1), 800);
  if (numRows < 1) return 0;
  const colData = sheet.getRange(2, cols.semana + 1, numRows, 1).getDisplayValues();
  let maxW = 0;
  colData.forEach(function (r) {
    const w = parseInt(_core_parseWeekNum_(r[0]) || '0', 10);
    if (w > maxW) maxW = w;
  });
  if (maxW >= 27) return SCHEDULE_TAB_HALF2;
  if (maxW >= 1) return SCHEDULE_TAB_HALF1;
  return 0;
}

/** Só abas H1/H2 pelo nome (H1.2026, H2.2026). Inferência por SEMANA só se faltar H1 ou H2. */
function _core_listScheduleTabs_(ss) {
  const byHalf = { 1: null, 2: null };

  ss.getSheets().forEach(function (sh) {
    const name = sh.getName().trim();
    const half = _core_halfFromTabName_(name);
    if (!half) return;
    const entry = { sheet: sh, half: half, name: name, year: _core_tabYearScore_(name) };
    const cur = byHalf[half];
    if (!cur || entry.year > cur.year || (entry.year === cur.year && entry.name.length < cur.name.length)) {
      byHalf[half] = entry;
    }
  });

  if (!byHalf[1] || !byHalf[2]) {
    ss.getSheets().forEach(function (sh) {
      const name = sh.getName().trim();
      if (_core_halfFromTabName_(name)) return;
      const half = _core_detectHalfFromSheetWeeks_(sh);
      if (half === 1 && !byHalf[1]) {
        byHalf[1] = { sheet: sh, half: 1, name: name, year: 0 };
      } else if (half === 2 && !byHalf[2]) {
        byHalf[2] = { sheet: sh, half: 2, name: name, year: 0 };
      }
    });
  }

  const out = [];
  if (byHalf[1]) out.push(byHalf[1]);
  if (byHalf[2]) out.push(byHalf[2]);
  return out;
}

function _core_findScheduleTab_(ss, half) {
  const tabs = _core_listScheduleTabs_(ss).filter(function (t) { return t.half === half; });
  return tabs.length ? tabs[0].sheet : null;
}

function _core_tabYearScore_(name) {
  const m = String(name || '').match(/(20\d{2})/);
  return m ? parseInt(m[1], 10) : 0;
}

function _core_mainTabName_() {
  const h1 = _core_findScheduleTab_(_core_getSpreadsheet_(), SCHEDULE_TAB_HALF1);
  return h1 ? h1.getName() : MAIN_TAB_NAME;
}

const DETAILS_TAB_NAME = "Base_Detalhes";
const SLOT_START_COL_INDEX = 8; // Coluna I

function doGet(e) {
  if (e && e.parameter && e.parameter.view === 'bridge') {
    return HtmlService.createHtmlOutputFromFile('Bridge')
      .setTitle('Dim Bridge')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  if (e && e.parameter && e.parameter.api) {
    const json = dimApiCall(e.parameter.api, e.parameter.payload || '{}');
    if (e.parameter.callback) {
      const cb = String(e.parameter.callback).replace(/[^a-zA-Z0-9_$]/g, '');
      if (cb) {
        return ContentService.createTextOutput(cb + '(' + json + ');')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Dimensionamento ID Quality/Csat')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function _core_getSpreadsheet_() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      if (active.getId() !== SHEET_ID) {
        console.log('AVISO: planilha ativa (' + active.getId() + ') difere de SHEET_ID (' + SHEET_ID + '). Usando planilha ativa.');
      }
      return active;
    }
  } catch (e) { /* web app sem contexto ativo */ }
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (e1) {
    const msg = String(e1.message || e1);
    console.log('openById falhou (' + SHEET_ID + '): ' + msg);
    if (msg.indexOf('permiss') >= 0 || msg.indexOf('permission') >= 0 || msg.indexOf('authorization') >= 0) {
      throw new Error(
        'Sem permissão para acessar a planilha. Abra o app pelo link oficial, clique em "Recarregar e autorizar" ' +
        'e aceite o acesso ao Google Sheets. Se persistir, peça ao admin para compartilhar a planilha com seu e-mail.'
      );
    }
    throw e1;
  }
}

function _core_sheetNameForWeek_(weekNum) {
  const w = _core_parseWeekNum_(weekNum);
  if (!w) return _core_mainTabName_();
  const half = parseInt(w, 10) >= 27 ? SCHEDULE_TAB_HALF2 : SCHEDULE_TAB_HALF1;
  const sheet = _core_findScheduleTab_(_core_getSpreadsheet_(), half);
  if (sheet) return sheet.getName();
  return _core_mainTabName_();
}

function _core_getScheduleWeek_(schedule, weekKey) {
  if (!schedule || typeof schedule !== 'object') return {};
  weekKey = _core_parseWeekNum_(weekKey);
  if (!weekKey) return {};
  if (schedule[weekKey]) return schedule[weekKey];
  const num = Number(weekKey);
  if (!isNaN(num) && schedule[num]) return schedule[num];
  for (const k of Object.keys(schedule)) {
    if (_core_parseWeekNum_(k) === weekKey) return schedule[k];
  }
  return {};
}

function _core_headerToTimeKey_(displayVal, rawVal) {
  let k = _core_normalizeTimeStr(displayVal);
  if (k) return k;
  if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
    return String(rawVal.getHours()).padStart(2, '0') + ':' + String(rawVal.getMinutes()).padStart(2, '0');
  }
  if (typeof rawVal === 'number' && isFinite(rawVal)) {
    const fraction = rawVal >= 1 ? (rawVal % 1) : rawVal;
    if (fraction >= 0 && fraction < 1) {
      const totalMin = Math.round(fraction * 24 * 60);
      return String(Math.floor(totalMin / 60)).padStart(2, '0') + ':' + String(totalMin % 60).padStart(2, '0');
    }
  }
  return '';
}

function _core_readTimeHeadersFromRow_(headerDisplay, headerRaw, slotStart) {
  const out = [];
  for (let i = slotStart; i < headerDisplay.length; i++) {
    const raw = headerRaw && headerRaw.length > i ? headerRaw[i] : headerDisplay[i];
    const key = _core_headerToTimeKey_(headerDisplay[i], raw);
    out.push(key || String(headerDisplay[i] || ''));
  }
  return out;
}

function _core_timeHeadersHaveSlots_(timeHeaders) {
  return timeHeaders.some(function (h) { return _core_headerToTimeKey_(h, h) || _core_normalizeTimeStr(h); });
}

function _core_cellToTaskLabel_(displayVal, rawVal) {
  const d = displayVal != null ? String(displayVal).trim() : '';
  if (d) return d;
  if (rawVal == null || rawVal === '') return '';
  if (typeof rawVal === 'string') return rawVal.trim();
  return String(rawVal).trim();
}

function _core_readSlotRow_(sheet, sheetRow, slotStart, numCols) {
  if (!numCols || sheetRow < 2) return [];
  const range = sheet.getRange(sheetRow, slotStart + 1, 1, numCols);
  const display = range.getDisplayValues()[0] || [];
  const raw = range.getValues()[0] || [];
  const out = [];
  for (let i = 0; i < numCols; i++) {
    out.push(_core_cellToTaskLabel_(display[i], raw[i]));
  }
  return out;
}

function _core_loadH1TimeHeaders_(ss, slotStart) {
  const h1 = _core_findScheduleTab_(ss, 1);
  if (!h1 || h1.getLastColumn() <= slotStart) return [];
  const h1HeaderRange = h1.getRange(1, 1, 1, h1.getLastColumn());
  const h1Headers = h1HeaderRange.getDisplayValues()[0];
  const h1HeadersRaw = h1HeaderRange.getValues()[0];
  const h1Cols = _core_mapSheetColumns_(h1Headers, h1HeadersRaw);
  const start = h1Cols.slotStart >= 0 ? h1Cols.slotStart : slotStart;
  return _core_readTimeHeadersFromRow_(h1Headers, h1HeadersRaw, start);
}

// --- LEITURA DE DADOS ---
function getUserSchedule(payload) {
  payload = payload || {};
  try {
    const userEmail = _core_resolveUserEmail_(payload);
    
    // LOG DE DEBUG — remover após resolver problema da Mayara
    console.log("=== getUserSchedule ===");
    console.log("Session.getActiveUser: " + Session.getActiveUser().getEmail());
    console.log("Session.getEffectiveUser: " + Session.getEffectiveUser().getEmail());
    console.log("Email resolvido: " + userEmail);

    const ss = _core_getSpreadsheet_();
    console.log('Planilha SHEET_ID: ' + ss.getId() + ' | abas: ' + ss.getSheets().map(function (s) { return s.getName(); }).join(', '));

    if (!userEmail) {
      return {
        error: 'Google não identificou seu e-mail. Abra o app logado com sua conta @nubank.com.br e autorize o acesso.',
        schedule: {},
        userEmail: ''
      };
    }

    const targetWeek = payload.week != null ? _core_parseWeekNum_(payload.week) : '';
    const detailsMap = _core_loadDetailsForUser_(ss, userEmail);
    const result = {};

    const scheduleTabs = _core_listScheduleTabs_(ss);
    console.log('Abas escala encontradas: ' + (scheduleTabs.length
      ? scheduleTabs.map(function (t) { return t.name; }).join(', ')
      : 'nenhuma'));

    if (!scheduleTabs.some(function (t) { return t.half === SCHEDULE_TAB_HALF2; })) {
      console.log('AVISO: nenhuma aba H2 (H2.2024, H2.2026, H2…) — semanas 27+ não serão lidas.');
    }

    for (const tabInfo of scheduleTabs) {
      if (targetWeek) {
        const tw = parseInt(targetWeek, 10);
        if (tw >= 27 && tabInfo.half !== SCHEDULE_TAB_HALF2) continue;
        if (tw < 27 && tabInfo.half !== SCHEDULE_TAB_HALF1) continue;
      }
      const sheet = tabInfo.sheet;
      const tabName = tabInfo.name;

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow < 2) continue;

      const headerRange = sheet.getRange(1, 1, 1, lastCol);
      const headers = headerRange.getDisplayValues()[0];
      const headersRaw = headerRange.getValues()[0];
      const cols = _core_mapSheetColumns_(headers, headersRaw);
      let slotStart = cols.slotStart >= 0 ? cols.slotStart : SLOT_START_COL_INDEX;
      if (slotStart < SLOT_START_COL_INDEX) slotStart = SLOT_START_COL_INDEX;
      let timeHeaders = _core_readTimeHeadersFromRow_(headers, headersRaw, slotStart);
      if (!_core_timeHeadersHaveSlots_(timeHeaders) || lastCol <= slotStart + 1) {
        const fallbackHeaders = _core_loadH1TimeHeaders_(ss, slotStart);
        if (fallbackHeaders.length) timeHeaders = fallbackHeaders;
      }
      const physicalCols = Math.max(0, lastCol - slotStart);
      const readNumCols = physicalCols > 0 ? physicalCols : timeHeaders.length;
      const resolvedTime = _core_resolveTimeColMap_(ss, sheet, headers, headersRaw, slotStart);
      const timeColMap = resolvedTime.map;
      slotStart = resolvedTime.slotStart;
      console.log('Aba ' + tabName + ': slotStart=' + slotStart + ', colunasHorario=' + Object.keys(timeColMap).length);
      const numDataRows = Math.max(0, lastRow - 1);

      const idColEnd = Math.min(lastCol, Math.max(cols.dia, cols.data, cols.semana, cols.analista, cols.email, 0) + 1);
      const idData = numDataRows > 0
        ? sheet.getRange(2, 1, numDataRows, idColEnd).getDisplayValues()
        : [];
      const matchMeta = [];

      for (let i = 0; i < idData.length; i++) {
        const row = idData[i];
        const rowEmail = cols.email >= 0 && row[cols.email] ? String(row[cols.email]).toLowerCase().trim() : '';
        const rowAnalyst = cols.analista >= 0 && row[cols.analista] ? String(row[cols.analista]).toLowerCase().trim() : '';
        
        if (!_core_rowMatchesUser_(rowEmail, rowAnalyst, userEmail)) continue;

        const dayName = _core_dayNameFromRow_(row, null, cols.dia);
        if (!_core_isWeekdayName_(dayName)) continue;

        let weekNum = cols.semana >= 0 ? _core_parseWeekNum_(row[cols.semana]) : '';
        let dateIso = cols.data >= 0 ? _core_formatDateToISO(row[cols.data]) : '';
        if (!dateIso) dateIso = _core_dateFromWeekAndDay_(weekNum, dayName);
        if (!dateIso) continue;

        const dateObj = _core_parseDate(dateIso);
        if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) continue;

        if (!weekNum) weekNum = _core_getWeekNumber(dateObj);
        weekNum = _core_parseWeekNum_(weekNum);
        if (!weekNum) continue;
        if (targetWeek && weekNum !== targetWeek) continue;

        matchMeta.push({ sheetRow: i + 2, weekNum, dayName, dateIso });
      }

      console.log("Aba " + tabName + ": " + matchMeta.length + " linhas encontradas para " + userEmail);

      if (!matchMeta.length) continue;

      let filledInTab = 0;
      matchMeta.forEach(function (meta) {
        if (!result[meta.weekNum]) result[meta.weekNum] = {};
        if (!result[meta.weekNum][meta.dayName]) result[meta.weekNum][meta.dayName] = {};

        const slotRow = Object.keys(timeColMap).length > 0
          ? _core_readSlotRow_(sheet, meta.sheetRow, slotStart, Object.keys(timeColMap).length)
          : [];

        Object.keys(timeColMap).forEach(function (timeKey) {
          const colIdx = timeColMap[timeKey] - (slotStart + 1);
          if (colIdx < 0 || colIdx >= slotRow.length) return;
          const cellValue = slotRow[colIdx] || '';
          if (!cellValue) return;
          const key = meta.dateIso + '_' + timeKey;
          result[meta.weekNum][meta.dayName][timeKey] = {
            task: cellValue,
            details: detailsMap[key] || null
          };
          filledInTab++;
        });
      });
      console.log("Aba " + tabName + ": " + filledInTab + " slots preenchidos");
    }

    const semanas = Object.keys(result);
    console.log("Semanas encontradas: " + (semanas.length ? semanas.join(', ') : 'nenhuma'));

    let metaFilled = 0;
    if (targetWeek && result[targetWeek]) {
      Object.keys(result[targetWeek]).forEach(function (day) {
        Object.keys(result[targetWeek][day] || {}).forEach(function () { metaFilled++; });
      });
    }

    return { schedule: result, userEmail: userEmail, meta: { targetWeek: targetWeek || null, filledSlots: metaFilled } };

  } catch (e) {
    console.log("ERRO em getUserSchedule: " + e.toString());
    return { error: "Erro no Backend: " + e.toString(), userEmail: Session.getActiveUser().getEmail() };
  }
}

function _core_loadDetailsForUser_(ss, userEmail) {
  const detailsMap = {};
  const detailsSheet = ss.getSheetByName(DETAILS_TAB_NAME);
  if (!detailsSheet || detailsSheet.getLastRow() < 2) return detailsMap;

  const detailsData = detailsSheet.getDataRange().getDisplayValues();
  for (let d = 1; d < detailsData.length; d++) {
    const row = detailsData[d];
    if (!row[4]) continue;
    const rowAnalyst = String(row[4]).toLowerCase().trim();
    if (!_core_rowMatchesUser_(rowAnalyst, rowAnalyst, userEmail)) continue;
    const keyDate = _core_formatDateToISO(row[2]);
    const keyTime = _core_normalizeTimeStr(row[3]);
    const key = keyDate + '_' + keyTime;
    detailsMap[key] = {
      action: row[5],
      project: row[6],
      otherSpec: row[7],
      quantity: row[1]
    };
  }
  return detailsMap;
}

function _core_resolveUserEmail_(payload) {
  const fromPayload = payload && payload.userEmail ? String(payload.userEmail).toLowerCase().trim() : '';
  if (fromPayload) return fromPayload;
  const active = Session.getActiveUser().getEmail().toLowerCase().trim();
  if (active) return active;
  return Session.getEffectiveUser().getEmail().toLowerCase().trim();
}

function _core_findCol_(header, names) {
  const targets = names.map(function (n) { return String(n).trim().toUpperCase(); });
  for (let i = 0; i < header.length; i++) {
    const h = String(header[i] || '').trim().toUpperCase();
    if (targets.indexOf(h) >= 0) return i;
  }
  return -1;
}

function _core_mapSheetColumns_(header, headerRaw) {
  let colDia = _core_findCol_(header, ['DIA SEMANA', 'DIA_SEMANA', 'DIA DA SEMANA', 'DIA']);
  if (colDia < 0 && header.length > 2) colDia = 2;
  let colData = _core_findCol_(header, ['DATA', 'DATE']);
  if (colData < 0 && header.length > 3) colData = 3;
  let colSemana = _core_findCol_(header, ['SEMANA', 'WEEK']);
  if (colSemana < 0 && header.length > 4) colSemana = 4;
  let colAnalista = _core_findCol_(header, ['ANALISTA', 'ANALYST']);
  if (colAnalista < 0 && header.length > 6) colAnalista = 6;
  let colEmail = _core_findCol_(header, ['E-MAIL', 'EMAIL', 'E_MAIL']);
  if (colEmail < 0 && header.length > 7) colEmail = 7;

  let slotStart = typeof SLOT_START_COL_INDEX !== 'undefined' ? SLOT_START_COL_INDEX : 8;
  for (let j = slotStart; j < header.length; j++) {
    const raw = headerRaw && headerRaw.length > j ? headerRaw[j] : header[j];
    if (_core_headerToTimeKey_(header[j], raw)) {
      slotStart = j;
      break;
    }
  }

  return { dia: colDia, data: colData, semana: colSemana, analista: colAnalista, email: colEmail, slotStart: slotStart };
}

function _core_parseWeekNum_(val) {
  if (val === '' || val == null) return '';
  if (typeof val === 'number' && isFinite(val)) return String(Math.round(val));
  const s = String(val).trim().replace(',', '.');
  const m = s.match(/\d+/);
  return m ? String(parseInt(m[0], 10)) : '';
}

function _core_dayKeyFromName_(dayName) {
  const d = String(dayName || '').toLowerCase();
  if (d.indexOf('segunda') >= 0 || d === 'seg') return 'seg';
  if (d.indexOf('terça') >= 0 || d.indexOf('terca') >= 0 || d === 'ter') return 'ter';
  if (d.indexOf('quarta') >= 0 || d === 'qua') return 'qua';
  if (d.indexOf('quinta') >= 0 || d === 'qui') return 'qui';
  if (d.indexOf('sexta') >= 0 || d === 'sex') return 'sex';
  return '';
}

function _core_dateFromWeekAndDay_(weekNum, dayName) {
  weekNum = _core_parseWeekNum_(weekNum);
  const dayKey = _core_dayKeyFromName_(dayName);
  if (!weekNum || !dayKey) return '';
  const keyMap = { seg: 0, ter: 1, qua: 2, qui: 3, sex: 4 };
  const idx = keyMap[dayKey];
  if (idx == null) return '';
  const simpleYear = 2026;
  const d = new Date(simpleYear, 0, 1 + (Number(weekNum) - 1) * 7);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  const current = new Date(monday);
  current.setDate(monday.getDate() + idx);
  const yyyy = current.getFullYear();
  const mm = String(current.getMonth() + 1).padStart(2, '0');
  const dd = String(current.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function _core_normalizeUserKey_(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/\s+/g, '.')
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9._-]/g, '');
}

function _core_rowMatchesUser_(rowEmail, rowAnalyst, userEmail) {
  const u = String(userEmail || '').toLowerCase().trim();
  if (!u) return false;
  const uKey = _core_normalizeUserKey_(u);
  const eKey = _core_normalizeUserKey_(rowEmail);
  const aKey = _core_normalizeUserKey_(rowAnalyst);
  if (!uKey) return false;
  if (eKey && eKey === uKey) return true;
  if (aKey && aKey === uKey) return true;
  if (eKey && (eKey === uKey || uKey.indexOf(eKey) >= 0 || eKey.indexOf(uKey) >= 0)) return true;
  if (aKey && (aKey === uKey || uKey.indexOf(aKey) >= 0 || aKey.indexOf(uKey) >= 0)) return true;
  return false;
}

function _core_dayNameFromRow_(row, dateObj, diaIdx) {
  const idx = diaIdx != null && diaIdx >= 0 ? diaIdx : 2;
  const rawDia = row[idx] != null ? String(row[idx]).trim().toLowerCase() : '';
  if (rawDia.indexOf('segunda') >= 0) return 'segunda';
  if (rawDia.indexOf('terça') >= 0 || rawDia.indexOf('terca') >= 0) return 'terça';
  if (rawDia.indexOf('quarta') >= 0) return 'quarta';
  if (rawDia.indexOf('quinta') >= 0) return 'quinta';
  if (rawDia.indexOf('sexta') >= 0) return 'sexta';
  if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
    const names = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    return names[dateObj.getDay()] || '';
  }
  return '';
}

function _core_isWeekdayName_(dayName) {
  return ['segunda', 'terça', 'quarta', 'quinta', 'sexta'].indexOf(dayName) >= 0;
}

function _core_buildTimeColMap_(headers, headersRaw, slotStart) {
  const map = {};
  const start = slotStart >= 0 ? slotStart : SLOT_START_COL_INDEX;
  for (let i = start; i < headers.length; i++) {
    const key = _core_headerToTimeKey_(headers[i], headersRaw && headersRaw.length > i ? headersRaw[i] : headers[i]);
    if (key) map[key] = i + 1;
  }
  return map;
}

function _core_resolveTimeColMap_(ss, sheet, headers, headersRaw, slotStart) {
  let map = _core_buildTimeColMap_(headers, headersRaw, slotStart);
  if (Object.keys(map).length) return { map: map, slotStart: slotStart };

  const h1 = _core_findScheduleTab_(ss, SCHEDULE_TAB_HALF1);
  if (!h1) return { map: {}, slotStart: slotStart };

  const h1LastCol = h1.getLastColumn();
  const h1Range = h1.getRange(1, 1, 1, h1LastCol);
  const h1Headers = h1Range.getDisplayValues()[0];
  const h1HeadersRaw = h1Range.getValues()[0];
  const h1Cols = _core_mapSheetColumns_(h1Headers, h1HeadersRaw);
  const h1Start = Math.max(SLOT_START_COL_INDEX, h1Cols.slotStart >= 0 ? h1Cols.slotStart : SLOT_START_COL_INDEX);
  map = _core_buildTimeColMap_(h1Headers, h1HeadersRaw, h1Start);
  const useStart = slotStart >= SLOT_START_COL_INDEX ? slotStart : h1Start;
  return { map: map, slotStart: useStart };
}

function _core_findUserRowByDate_(sheet, cols, userEmail, dateIso) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const idColEnd = Math.max(cols.dia, cols.data, cols.semana, cols.analista, cols.email, 0) + 1;
  const numDataRows = Math.max(0, lastRow - 1);
  const idData = numDataRows > 0
    ? sheet.getRange(2, 1, numDataRows, idColEnd).getDisplayValues()
    : [];
  for (let i = idData.length - 1; i >= 0; i--) {
    const row = idData[i];
    const rowEmail = cols.email >= 0 && row[cols.email] ? String(row[cols.email]).toLowerCase().trim() : '';
    const rowAnalyst = cols.analista >= 0 && row[cols.analista] ? String(row[cols.analista]).toLowerCase().trim() : '';
    if (!_core_rowMatchesUser_(rowEmail, rowAnalyst, userEmail)) continue;
    const d = cols.data >= 0 ? _core_formatDateToISO(row[cols.data]) : '';
    if (d === dateIso) return i + 2;
  }
  return -1;
}

// --- OPERAÇÃO EM LOTE ---
function saveBatchData(payload) {
  payload = payload || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) {
    return { error: 'Servidor ocupado — outra gravação em andamento. Tente em alguns segundos.' };
  }

  try {
    const userEmail = _core_resolveUserEmail_(payload);
    if (!userEmail) {
      return { error: 'Usuário não autenticado. Conecte à planilha no Hub e tente salvar de novo.' };
    }
    const ss = _core_getSpreadsheet_();
    let savedSlots = 0;
    const missedDates = [];
    let timeColKeys = 0;
    const validationErrors = [];
    
    if (payload.slots && payload.slots.length > 0) {
      const firstDate = Object.keys(
        payload.slots.reduce((acc, s) => { acc[s.dayDate] = true; return acc; }, {})
      )[0];
      const weekFromPayload = payload.week != null ? _core_parseWeekNum_(payload.week) : '';
      const firstWeek = weekFromPayload || _core_getWeekNumber(_core_parseDate(firstDate));
      const half = parseInt(firstWeek, 10) >= 27 ? 2 : 1;
      let sheet = _core_findScheduleTab_(ss, half);
      if (!sheet) {
        const tabs = _core_listScheduleTabs_(ss).filter(function (t) { return t.half === half; });
        sheet = tabs.length ? tabs[0].sheet : null;
      }

      if (sheet) {
        const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
        const headers = headerRange.getDisplayValues()[0];
        const headersRaw = headerRange.getValues()[0];
        const cols = _core_mapSheetColumns_(headers, headersRaw);
        let slotStart = cols.slotStart >= 0 ? cols.slotStart : SLOT_START_COL_INDEX;
        const resolvedTime = _core_resolveTimeColMap_(ss, sheet, headers, headersRaw, slotStart);
        const timeColMap = resolvedTime.map;
        slotStart = resolvedTime.slotStart;
        timeColKeys = Object.keys(timeColMap).length;

        const slotsByDate = {};
        payload.slots.forEach(s => {
           if (!slotsByDate[s.dayDate]) slotsByDate[s.dayDate] = [];
           slotsByDate[s.dayDate].push(s);
        });

        Object.keys(slotsByDate).forEach(dateIso => {
           const rowFound = _core_findUserRowByDate_(sheet, cols, userEmail, dateIso);

           if (rowFound !== -1) {
              const cellUpdates = [];
              slotsByDate[dateIso].forEach(slotItem => {
                 const col = timeColMap[_core_normalizeTimeStr(slotItem.time)];
                 if (!col) return;
                 const val = slotItem.task != null ? String(slotItem.task) : '';
                 cellUpdates.push({ col: col, val: val, time: slotItem.time });
              });

              if (cellUpdates.length) {
                const colsToWrite = cellUpdates.map(function (u) { return u.col; });
                const minCol = Math.min.apply(null, colsToWrite);
                const maxCol = Math.max.apply(null, colsToWrite);
                const width = maxCol - minCol + 1;
                const rowRange = sheet.getRange(rowFound, minCol, 1, width);
                const rowVals = rowRange.getValues()[0];
                cellUpdates.forEach(function (u) {
                  try {
                    rowVals[u.col - minCol] = u.val;
                  } catch (e) {
                    validationErrors.push({
                      date: dateIso,
                      time: u.time,
                      task: u.val,
                      error: String(e.message || e)
                    });
                  }
                });
                try {
                  rowRange.setValues([rowVals]);
                  savedSlots += cellUpdates.length;
                } catch (rowErr) {
                  cellUpdates.forEach(function (u) {
                    try {
                      if (u.val) {
                        sheet.getRange(rowFound, u.col).setValue(u.val);
                      } else {
                        sheet.getRange(rowFound, u.col).clearContent();
                      }
                      savedSlots++;
                    } catch (cellErr) {
                      validationErrors.push({
                        date: dateIso,
                        time: u.time,
                        task: u.val,
                        error: String(cellErr.message || cellErr)
                      });
                    }
                  });
                }
              }
           } else {
              missedDates.push(dateIso);
           }
        });
      }
    }

    if (payload.slots && payload.slots.length > 0 && savedSlots === 0) {
      let hint = missedDates.length
        ? ' Datas não encontradas: ' + missedDates.join(', ') + '.'
        : '';
      if (!timeColKeys) hint += ' Cabeçalhos de horário (coluna I+) não encontrados na aba.';
      return {
        error: 'Nenhuma célula foi gravada na planilha.' + hint +
          ' Verifique se está conectada com o e-mail correto e recarregue a semana.'
      };
    }

    if (payload.details && payload.details.length > 0) {
       let detSheet = ss.getSheetByName(DETAILS_TAB_NAME);
       if (!detSheet) {
          detSheet = ss.insertSheet(DETAILS_TAB_NAME);
          detSheet.appendRow(["Qual Slot utilizado?", "Quantidade de slots", "Data", "Hora de início", "Analista", "Ação Realizada", "Qual o projeto?", "Se 'Outro', favor especificar", "Carimbo de Data/Hora"]);
       }

       const detData = detSheet.getDataRange().getDisplayValues();
       const rowsToDelete = [];
       const targetTypesToClean = new Set();
       const targetDateIso = _core_formatDateToISO(payload.details[0].date);
       payload.details.forEach(d => targetTypesToClean.add(d.slot));

       for (let i = 1; i < detData.length; i++) {
          const row = detData[i];
          if (!row[4]) continue;
          const rDate = _core_formatDateToISO(row[2]);
          const rSlot = String(row[0]); 
          const rAnalyst = String(row[4]).toLowerCase().trim();
          const isUser = (rAnalyst === userEmail || userEmail.includes(rAnalyst.split('@')[0]));
          if (rDate === targetDateIso && isUser && targetTypesToClean.has(rSlot)) {
             rowsToDelete.push(i + 1); 
          }
       }

       rowsToDelete.sort((a, b) => b - a);
       rowsToDelete.forEach(rowIdx => detSheet.deleteRow(rowIdx));

       payload.details.forEach(detAction => {
           if (detAction.quantity > 0) {
               detSheet.appendRow([
                  detAction.slot,
                  detAction.quantity,
                  detAction.date,
                  detAction.startTime,
                  userEmail, 
                  detAction.action || "",
                  detAction.project || "",
                  detAction.other || "",
                  new Date()
               ]);
           }
       });
    }

    SpreadsheetApp.flush();
    return {
      success: true,
      savedSlots: savedSlots,
      missedDates: missedDates,
      validationErrors: validationErrors
    };

  } catch (e) {
    return { error: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

// --- FUNÇÕES LEGADAS ---
function saveUserSlot(request) {
  return saveBatchData({
      slots: [{ dayDate: request.dayDate, time: request.time, task: request.task }],
      details: request.details ? [request.details] : []
  });
}

function logPlanilhaDetails(data) {
    return saveBatchData({
        slots: [],
        details: [data]
    });
}

// =================================================================
// UTILITÁRIOS
// =================================================================

function _core_formatDateToISO(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
  if (s.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
     const p = s.split('/');
     return `${p[2]}-${p[1]}-${p[0]}`;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return "";
}

function _core_normalizeTimeStr(t) {
  if (!t) return "";
  const str = String(t).trim();
  const parts = str.split(':');
  if (parts.length >= 2) {
      const hh = String(parseInt(parts[0], 10)).padStart(2, '0');
      const mm = String(parts[1]).replace(/\D/g, '').substring(0, 2).padStart(2, '0');
      return `${hh}:${mm}`;
  }
  return str;
}

function _core_parseDate(dateStr) {
  if (!dateStr) return new Date();
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const p = dateStr.split('-');
    return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
  }
  return new Date(dateStr);
}

function _core_getWeekNumber(d) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return String(Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7));
}

// =================================================================
// TESTES
// =================================================================

function testeGetScheduleSemana27() {
  const result = getUserSchedule({ week: 27, userEmail: 'alan.clovis@nubank.com.br' });
  Logger.log('meta: ' + JSON.stringify(result.meta));
  Logger.log('semanas: ' + Object.keys(result.schedule || {}).join(', '));
  const w27 = result.schedule && result.schedule['27'];
  if (w27 && w27.segunda) {
    Logger.log('segunda 07:00 = ' + (w27.segunda['07:00'] && w27.segunda['07:00'].task));
  } else {
    Logger.log('sem dados segunda semana 27');
  }
}

function testeGetSchedule() {
  const inicio = new Date();
  const result = getUserSchedule();
  const fim = new Date();
  Logger.log(`Tempo: ${fim - inicio}ms`);
  Logger.log(`Email: ${result.userEmail}`);
  Logger.log(`Semanas encontradas: ${Object.keys(result.schedule || {}).join(', ')}`);
}

function testeSave() {
  const result = saveBatchData({
    slots: [{ dayDate: "2026-06-16", time: "07:00", task: "GS - ID" }],
    details: []
  });
  Logger.log(JSON.stringify(result));
}

function listScheduleTabsDebug() {
  const ss = _core_getSpreadsheet_();
  const payload = {
    spreadsheetId: ss.getId(),
    sheetIdConfig: SHEET_ID,
    allSheetNames: ss.getSheets().map(function (s) { return s.getName(); }),
    scheduleTabs: _core_listScheduleTabs_(ss).map(function (t) {
      return { name: t.name, half: t.half, year: t.year, lastRow: t.sheet.getLastRow(), lastCol: t.sheet.getLastColumn() };
    }),
    h1Resolved: _core_mainTabName_(),
    h2Resolved: (function () {
      const sh = _core_findScheduleTab_(ss, SCHEDULE_TAB_HALF2);
      return sh ? sh.getName() : null;
    })()
  };
  Logger.log(JSON.stringify(payload, null, 2));
  return JSON.stringify(payload, null, 2);
}

function debugWeek27Alan() {
  const email = 'alan.clovis@nubank.com.br';
  const ss = _core_getSpreadsheet_();
  const sheet = ss.getSheetByName('H2.2026');
  if (!sheet) {
    Logger.log('H2.2026 não encontrada');
    return;
  }
  const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headers = headerRange.getDisplayValues()[0];
  const headersRaw = headerRange.getValues()[0];
  const cols = _core_mapSheetColumns_(headers, headersRaw);
  let slotStart = cols.slotStart >= 0 ? cols.slotStart : SLOT_START_COL_INDEX;
  const resolved = _core_resolveTimeColMap_(ss, sheet, headers, headersRaw, slotStart);
  const timeColMap = resolved.map;
  slotStart = resolved.slotStart;
  const idColEnd = Math.max(cols.dia, cols.data, cols.semana, cols.analista, cols.email, 0) + 1;
  const numDataRows = Math.max(0, sheet.getLastRow() - 1);
  const idData = sheet.getRange(2, 1, numDataRows, idColEnd).getDisplayValues();
  let rowNum = -1;
  for (let i = 0; i < idData.length; i++) {
    const row = idData[i];
    const w = cols.semana >= 0 ? _core_parseWeekNum_(row[cols.semana]) : '';
    if (w !== '27') continue;
    const rowEmail = cols.email >= 0 ? String(row[cols.email]).toLowerCase() : '';
    const rowAnalyst = cols.analista >= 0 ? String(row[cols.analista]).toLowerCase() : '';
    if (!_core_rowMatchesUser_(rowEmail, rowAnalyst, email)) continue;
    rowNum = i + 2;
    const slotRow = _core_readSlotRow_(sheet, rowNum, slotStart, Object.keys(timeColMap).length);
    const sample = {};
    ['07:00', '08:00', '09:00', '10:00'].forEach(function (t) {
      const colIdx = timeColMap[t] ? timeColMap[t] - (slotStart + 1) : -1;
      sample[t] = colIdx >= 0 ? slotRow[colIdx] : '(sem coluna)';
    });
    Logger.log(JSON.stringify({
      linha: rowNum,
      dia: row[cols.dia],
      data: row[cols.data],
      semana: row[cols.semana],
      colunasHorario: Object.keys(timeColMap).length,
      slotStart: slotStart,
      amostraSlots: sample
    }, null, 2));
    return;
  }
  Logger.log('Nenhuma linha semana 27 para ' + email);
}

function debugScheduleInspect(week, email) {
  week = week != null ? week : 27;
  email = email || 'alan.clovis@nubank.com.br';
  const ss = _core_getSpreadsheet_();
  const allTabs = _core_listScheduleTabs_(ss);
  const sheetH2 = _core_findScheduleTab_(ss, SCHEDULE_TAB_HALF2);
  const result = getUserSchedule({ week: week, userEmail: email });
  const weekKey = _core_parseWeekNum_(week);
  const weekData = result.schedule && result.schedule[weekKey] ? result.schedule[weekKey] : {};
  let filledSlots = 0;
  Object.keys(weekData).forEach(function (day) {
    Object.keys(weekData[day] || {}).forEach(function (t) {
      const task = weekData[day][t] && weekData[day][t].task;
      if (task) filledSlots++;
    });
  });
  const payload = {
    spreadsheetId: ss.getId(),
    tabNames: ss.getSheets().map(function (s) { return s.getName(); }),
    scheduleTabs: allTabs.map(function (t) { return t.name; }),
    h2Tab: sheetH2 ? sheetH2.getName() : null,
    h2LastRow: sheetH2 ? sheetH2.getLastRow() : 0,
    h2LastCol: sheetH2 ? sheetH2.getLastColumn() : 0,
    activeUser: Session.getActiveUser().getEmail(),
    effectiveUser: Session.getEffectiveUser().getEmail(),
    queryEmail: email,
    scheduleWeeks: Object.keys(result.schedule || {}),
    weekDays: Object.keys(weekData),
    filledSlots: filledSlots,
    sampleSegunda: weekData.segunda || null,
    error: result.error || null
  };
  Logger.log(JSON.stringify(payload, null, 2));
  return JSON.stringify(payload, null, 2);
}

function testeUsuarioMayara() {
  const ss = _core_getSpreadsheet_();
  const sheet = _core_findScheduleTab_(ss, 1);
  const lastRow = sheet.getLastRow();
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
  
  const resultados = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const email = String(row[7] || '').toLowerCase().trim();
    const analista = String(row[6] || '').toLowerCase().trim();
    if (email.includes('mayara') || analista.includes('mayara')) {
      resultados.push({
        linha: i + 2,
        dia: row[2],
        data: row[3],
        semana: row[4],
        analista: row[6],
        email: row[7]
      });
    }
  }
  
  Logger.log('Linhas encontradas para Mayara: ' + resultados.length);
  Logger.log(JSON.stringify(resultados.slice(0, 5), null, 2));
}