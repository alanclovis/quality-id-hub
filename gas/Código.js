// --- CONFIGURAÇÕES ---
const SHEET_ID = "1S_rJTdcqvzvUD_-qa-Q-GWrMb9DTScQPbilqa8EzAKE"; 
const MAIN_TAB_NAME = "H1.2026"; 
const DETAILS_TAB_NAME = "Base_Detalhes";
const SLOT_START_COL_INDEX = 8; // Coluna I

function doGet(e) {
  // Ponte Quality ID Hub
  if (e && e.parameter && e.parameter.view === 'bridge') {
    return HtmlService.createHtmlOutputFromFile('Bridge')
      .setTitle('Dim Bridge')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // API JSON para o Hub (fetch/JSONP)
  if (e && e.parameter && e.parameter.api) {
    const json = dimApiCall(e.parameter.api, e.parameter.payload || '{}');
    if (e.parameter.callback) {
      const cb = String(e.parameter.callback).replace(/[^a-zA-Z0-9_]/g, '');
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

// --- LEITURA DE DADOS (BLINDADA) ---
function getUserSchedule(payload) {
  payload = payload || {};
  try {
    const userEmail = _core_resolveUserEmail_(payload);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (!userEmail) {
      return {
        error: 'Google não identificou seu e-mail. Abra o app logado com sua conta @nubank.com.br e autorize o acesso.',
        schedule: {},
        userEmail: ''
      };
    }
    let sheet = ss.getSheetByName(MAIN_TAB_NAME);
    if (!sheet) {
        const sheets = ss.getSheets();
        sheet = sheets.find(s => s.getName().trim() === MAIN_TAB_NAME.trim());
        if (!sheet) throw new Error(`Aba "${MAIN_TAB_NAME}" não encontrada.`);
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return { schedule: {}, userEmail: userEmail };

    const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    const cols = _core_mapSheetColumns_(headers);
    const slotStart = cols.slotStart >= 0 ? cols.slotStart : SLOT_START_COL_INDEX;
    const slotColCount = Math.max(0, lastCol - slotStart);
    const targetWeek = payload.week != null ? _core_parseWeekNum_(payload.week) : '';

    const detailsMap = _core_loadDetailsForUser_(ss, userEmail);

    const result = {};
    const idColEnd = Math.min(lastCol, Math.max(cols.dia, cols.data, cols.semana, cols.analista, cols.email, 0) + 1);
    const idData = sheet.getRange(2, 1, lastRow, idColEnd).getDisplayValues();
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

      matchMeta.push({ sheetRow: i + 2, weekNum: weekNum, dayName: dayName, dateIso: dateIso });
    }

    if (!matchMeta.length) return { schedule: {}, userEmail: userEmail };

    matchMeta.forEach(function (meta) {
      if (!result[meta.weekNum]) result[meta.weekNum] = {};
      if (!result[meta.weekNum][meta.dayName]) result[meta.weekNum][meta.dayName] = {};

      const slotRow = slotColCount > 0
        ? sheet.getRange(meta.sheetRow, slotStart + 1, 1, slotColCount).getDisplayValues()[0]
        : [];

      for (let h = 0; h < slotRow.length; h++) {
        const hdrIdx = slotStart + h;
        const timeHeader = headers[hdrIdx];
        if (!timeHeader) continue;
        const normalizedTimeKey = _core_normalizeTimeStr(timeHeader);
        if (!normalizedTimeKey) continue;
        const key = meta.dateIso + '_' + normalizedTimeKey;
        const cellValue = slotRow[h] ? String(slotRow[h]) : '';
        result[meta.weekNum][meta.dayName][normalizedTimeKey] = {
          task: cellValue,
          details: detailsMap[key] || null
        };
      }
    });

    return { schedule: result, userEmail: userEmail };

  } catch (e) {
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
  return Session.getActiveUser().getEmail().toLowerCase().trim();
}

function _core_findCol_(header, names) {
  const targets = names.map(function (n) { return String(n).trim().toUpperCase(); });
  for (let i = 0; i < header.length; i++) {
    const h = String(header[i] || '').trim().toUpperCase();
    if (targets.indexOf(h) >= 0) return i;
  }
  return -1;
}

/** Detecta colunas pelo cabeçalho; fallback nos índices padrão da aba H1.2026 */
function _core_mapSheetColumns_(header) {
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
    if (_core_normalizeTimeStr(header[j])) {
      slotStart = j;
      break;
    }
  }

  return {
    dia: colDia,
    data: colData,
    semana: colSemana,
    analista: colAnalista,
    email: colEmail,
    slotStart: slotStart
  };
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

/** Calcula yyyy-mm-dd a partir da semana ISO da planilha + nome do dia (segunda…) */
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

/** Busca semana no schedule normalizando chaves ("26", "26.0", etc.) */
function _core_getScheduleWeek_(schedule, weekKey) {
  if (!schedule) return {};
  weekKey = _core_parseWeekNum_(weekKey);
  if (schedule[weekKey]) return schedule[weekKey];
  const keys = Object.keys(schedule);
  for (let i = 0; i < keys.length; i++) {
    if (_core_parseWeekNum_(keys[i]) === weekKey) return schedule[keys[i]];
  }
  return {};
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

/** Usa coluna DIA SEMANA quando existir; senão deriva da data local */
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

// --- OPERAÇÃO EM LOTE (ESTRATÉGIA LIMPAR E SUBSTITUIR) ---
function saveBatchData(payload) {
  payload = payload || {};
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) { return { error: "Servidor ocupado." }; }

  try {
    const userEmail = _core_resolveUserEmail_(payload);
    if (!userEmail) {
      return { error: 'Usuário não autenticado. Conecte à planilha no Hub e tente salvar de novo.' };
    }
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let savedSlots = 0;
    const missedDates = [];
    
    // 1. Atualiza Grade (H1.2026)
    if (payload.slots && payload.slots.length > 0) {
      let sheet = ss.getSheetByName(MAIN_TAB_NAME);
      if (!sheet) {
          const sheets = ss.getSheets();
          sheet = sheets.find(s => s.getName().trim() === MAIN_TAB_NAME.trim());
      }

      if (sheet) {
        const lastRow = sheet.getLastRow();
        const searchData = sheet.getRange(1, 4, lastRow, 5).getDisplayValues(); 
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
        
        const timeColMap = {};
        for (let h = SLOT_START_COL_INDEX; h < headers.length; h++) {
           const cleaned = _core_normalizeTimeStr(headers[h]); 
           if (cleaned) timeColMap[cleaned] = h + 1;
        }

        const slotsByDate = {};
        payload.slots.forEach(s => {
           if (!slotsByDate[s.dayDate]) slotsByDate[s.dayDate] = [];
           slotsByDate[s.dayDate].push(s);
        });

        Object.keys(slotsByDate).forEach(dateIso => {
           let rowFound = -1;
           for (let i = searchData.length - 1; i >= 1; i--) {
              const email = String(searchData[i][4] || '').toLowerCase().trim();
              const analyst = String(searchData[i][3] || '').toLowerCase().trim();
              if (!_core_rowMatchesUser_(email, analyst, userEmail)) continue;
              const d = _core_formatDateToISO(searchData[i][0]);
              if (d === dateIso) {
                 rowFound = i + 1;
                 break;
              }
           }

           if (rowFound !== -1) {
              slotsByDate[dateIso].forEach(slotItem => {
                 const col = timeColMap[_core_normalizeTimeStr(slotItem.time)];
                 if (col) {
                    sheet.getRange(rowFound, col).setValue(slotItem.task);
                    savedSlots++;
                 }
              });
           } else {
              missedDates.push(dateIso);
           }
        });
      }
    }

    if (payload.slots && payload.slots.length > 0 && savedSlots === 0) {
      const hint = missedDates.length
        ? ' Datas não encontradas: ' + missedDates.join(', ') + '.'
        : '';
      return {
        error: 'Nenhuma célula foi gravada na planilha.' + hint +
          ' Verifique se está conectada com o e-mail correto e recarregue a semana.'
      };
    }

    // 2. Atualiza Detalhes (Base_Detalhes) - LÓGICA REVISADA
    if (payload.details && payload.details.length > 0) {
       let detSheet = ss.getSheetByName(DETAILS_TAB_NAME);
       if (!detSheet) {
          detSheet = ss.insertSheet(DETAILS_TAB_NAME);
          detSheet.appendRow(["Qual Slot utilizado?", "Quantidade de slots", "Data", "Hora de início", "Analista", "Ação Realizada", "Qual o projeto?", "Se 'Outro', favor especificar", "Carimbo de Data/Hora"]);
       }

       const detData = detSheet.getDataRange().getDisplayValues();
       const rowsToDelete = [];
       
       // Identifica quais slots específicos estamos atualizando hoje
       // Ex: Se o payload tem "Planilha", vamos limpar todas as "Planilha" desse dia/usuário e reescrever
       const targetTypesToClean = new Set();
       const targetDateIso = _core_formatDateToISO(payload.details[0].date); // Assume batch de 1 dia

       payload.details.forEach(d => targetTypesToClean.add(d.slot));

       // Passo A: Encontrar linhas para deletar (Limpeza)
       for (let i = 1; i < detData.length; i++) {
          const row = detData[i];
          if (!row[4]) continue;
          
          const rDate = _core_formatDateToISO(row[2]);
          const rSlot = String(row[0]); 
          const rAnalyst = String(row[4]).toLowerCase().trim();
          
          const isUser = (rAnalyst === userEmail || userEmail.includes(rAnalyst.split('@')[0]));

          if (rDate === targetDateIso && isUser && targetTypesToClean.has(rSlot)) {
             // Marca para deleção (do maior para o menor para não bagunçar índices)
             rowsToDelete.push(i + 1); 
          }
       }

       // Passo B: Deletar linhas antigas (de trás para frente)
       rowsToDelete.sort((a, b) => b - a);
       rowsToDelete.forEach(rowIdx => detSheet.deleteRow(rowIdx));

       // Passo C: Inserir novas linhas (apenas se quantity > 0)
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
    return { success: true, savedSlots: savedSlots, missedDates: missedDates };

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
// UTILITÁRIOS BLINDADOS (RENOMEADOS COM _CORE_)
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