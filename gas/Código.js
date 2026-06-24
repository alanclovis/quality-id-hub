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
function getUserSchedule() {
  try {
    const userEmail = Session.getActiveUser().getEmail().toLowerCase().trim();
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

    const data = sheet.getDataRange().getDisplayValues(); 
    if (data.length < 2) return { schedule: {}, userEmail: userEmail };

    const headers = data[0];
    const colEmailIdx = 7; 
    const colDataIdx = 3;  
    const colSemanaIdx = 4; 

    // 1. Carrega detalhes
    const detailsMap = {};
    const detailsSheet = ss.getSheetByName(DETAILS_TAB_NAME);
    
    if (detailsSheet && detailsSheet.getLastRow() > 1) {
      const detailsData = detailsSheet.getDataRange().getDisplayValues();
      for (let d = 1; d < detailsData.length; d++) {
        const row = detailsData[d];
        if (!row[4]) continue;

        const rowAnalyst = String(row[4]).toLowerCase().trim();
        if (rowAnalyst.includes(userEmail) || userEmail.includes(rowAnalyst.split('@')[0])) {
           const keyDate = _core_formatDateToISO(row[2]); 
           const keyTime = _core_normalizeTimeStr(row[3]); 
           const key = `${keyDate}_${keyTime}`; 
           
           detailsMap[key] = {
             action: row[5],
             project: row[6],
             otherSpec: row[7],
             quantity: row[1] 
           };
        }
      }
    }

    const result = {};
    
    // 2. Processa grade
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowEmail = row[colEmailIdx] ? String(row[colEmailIdx]).toLowerCase().trim() : "";
      const rowAnalyst = row[6] ? String(row[6]).toLowerCase().trim() : "";
      
      if (_core_rowMatchesUser_(rowEmail, rowAnalyst, userEmail)) {
          const dateVal = row[colDataIdx];
          const dateIso = _core_formatDateToISO(dateVal);
          
          if (!dateIso) continue;

          let weekNum = row[colSemanaIdx] ? String(row[colSemanaIdx]).trim() : _core_getWeekNumber(_core_parseDate(dateIso));
          const dateObj = _core_parseDate(dateIso); 
          
          if (dateObj instanceof Date && !isNaN(dateObj)) {
              const dayName = _core_dayNameFromRow_(row, dateObj);

              if (_core_isWeekdayName_(dayName)) {
                 if (!result[weekNum]) result[weekNum] = {};
                 if (!result[weekNum][dayName]) result[weekNum][dayName] = {};

                 for (let h = SLOT_START_COL_INDEX; h < headers.length; h++) {
                   const timeHeader = headers[h];
                   if (timeHeader) {
                     const normalizedTimeKey = _core_normalizeTimeStr(timeHeader);
                     if (normalizedTimeKey) {
                         const key = `${dateIso}_${normalizedTimeKey}`;
                         const cellValue = row[h] ? String(row[h]) : "";
                         
                         result[weekNum][dayName][normalizedTimeKey] = { 
                           task: cellValue, 
                           details: detailsMap[key] || null
                         };
                     }
                   }
                 }
              }
          }
      }
    }

    return { schedule: result, userEmail: userEmail };

  } catch (e) {
    return { error: "Erro no Backend: " + e.toString(), userEmail: Session.getActiveUser().getEmail() };
  }
}

function _core_resolveUserEmail_(payload) {
  const fromPayload = payload && payload.userEmail ? String(payload.userEmail).toLowerCase().trim() : '';
  const fromSession = Session.getActiveUser().getEmail().toLowerCase().trim();
  return fromPayload || fromSession;
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

/** Usa coluna DIA SEMANA (C) quando existir; senão deriva da data local */
function _core_dayNameFromRow_(row, dateObj) {
  const rawDia = row[2] != null ? String(row[2]).trim().toLowerCase() : '';
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