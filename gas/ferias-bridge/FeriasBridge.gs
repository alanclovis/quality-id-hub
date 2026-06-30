/**
 * Quality ID Hub — Férias Bridge (planilha dedicada)
 * Deploy como Web App (executar como: Eu, acesso conforme política Nubank).
 *
 * 1. Crie a planilha "Quality Hub — Férias" e copie o ID para FERIAS_SHEET_ID.
 * 2. Rode setupFeriasSheet() uma vez no editor para criar aba e cabeçalhos.
 * 3. Publique o Web App e cole a URL /exec no Hub (Config → Técnico → URL Férias).
 */

var FERIAS_SHEET_ID = '1xv0WyTghWTCiQON16nATiAW7kCqiTpcsK-nKvXWkubA';
var FERIAS_TAB_NAME = 'Férias';
var FERIAS_HEADERS = ['id', 'nome', 'email', 'inicio', 'fim', 'tipo', 'status', 'updated_at', 'updated_by'];
var FERIAS_TIMEZONE = 'America/Sao_Paulo';

function feriasGetSheetId_() {
  var fromProps = PropertiesService.getScriptProperties().getProperty('FERIAS_SHEET_ID');
  var id = String(fromProps || FERIAS_SHEET_ID || '').trim();
  return id;
}

/** Timestamp legível em horário de Brasília (sem Z/UTC). */
function feriasNow_() {
  return Utilities.formatDate(new Date(), FERIAS_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function doGet(e) {
  e = e || {};
  var p = e.parameter || {};
  if (p.ferias) {
    var json = feriasApiCall_(p.ferias, p.payload || '{}');
    if (p.callback) {
      var cb = String(p.callback).replace(/[^a-zA-Z0-9_]/g, '');
      if (cb) {
        return ContentService.createTextOutput(cb + '(' + json + ');')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
    }
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, data: { service: 'quality-ferias-bridge', version: 1 } })
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  e = e || {};
  var body = {};
  try {
    body = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
  } catch (err) {
    body = {};
  }
  var action = body.action || (e.parameter && e.parameter.ferias);
  var payload = body.payload != null ? body.payload : (e.parameter && e.parameter.payload) || {};
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch (e2) { payload = {}; }
  }
  var json = feriasApiCall_(action, JSON.stringify(payload));
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/** Rode uma vez no editor após definir FERIAS_SHEET_ID */
function setupFeriasSheet() {
  var sheetId = feriasGetSheetId_();
  if (!sheetId) throw new Error('Defina FERIAS_SHEET_ID no script ou em Propriedades do script.');
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(FERIAS_TAB_NAME);
  if (!sheet) sheet = ss.insertSheet(FERIAS_TAB_NAME);
  sheet.clear();
  sheet.getRange(1, 1, 1, FERIAS_HEADERS.length).setValues([FERIAS_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, FERIAS_HEADERS.length).setFontWeight('bold');
  Logger.log('Aba "' + FERIAS_TAB_NAME + '" pronta em ' + ss.getUrl());
  return ss.getUrl();
}

function feriasApiCall_(action, payloadJson) {
  try {
    var payload = payloadJson ? JSON.parse(payloadJson) : {};
    var data = feriasHandleAction_(action, payload);
    return JSON.stringify({ ok: true, data: data });
  } catch (err) {
    var code = err.code || 400;
    return JSON.stringify({
      ok: false,
      error: String(err.message || err),
      code: code
    });
  }
}

function feriasHandleAction_(action, payload) {
  switch (action) {
    case 'ping':
      return { pong: true, ts: feriasNow_() };
    case 'getFerias':
      return feriasGetAll_();
    case 'saveFerias':
      return feriasSave_(payload);
    case 'deleteFerias':
      return feriasDelete_(payload);
    case 'migrateFerias':
      return feriasMigrate_(payload);
    default:
      throw new Error('Ação desconhecida: ' + action);
  }
}

function feriasThrow_(message, code) {
  var err = new Error(message);
  err.code = code || 400;
  throw err;
}

function feriasNormalize_(s) {
  return String(s || '').trim().toLowerCase();
}

function feriasNamesMatch_(a, b) {
  if (!a || !b) return false;
  var na = feriasNormalize_(a);
  var nb = feriasNormalize_(b);
  if (na === nb) return true;
  if (na.indexOf(nb + ' ') === 0 || nb.indexOf(na + ' ') === 0) return true;
  return na.split(/\s+/)[0] === nb.split(/\s+/)[0];
}

function feriasIsOwner_(row, userEmail, memberName) {
  if (!row) return false;
  var email = feriasNormalize_(userEmail);
  var rowEmail = feriasNormalize_(row.email);
  if (email && rowEmail && email === rowEmail) return true;
  if (memberName && feriasNamesMatch_(row.nome, memberName)) return true;
  return false;
}

function feriasIsAdmin_(payload) {
  return !!(payload && (payload.isAdmin === true || payload.isAdmin === 'true'));
}

function feriasAssertCanModify_(row, payload) {
  if (feriasIsAdmin_(payload)) return;
  if (!feriasIsOwner_(row, payload.userEmail, payload.memberName)) {
    feriasThrow_('Sem permissão para alterar este registro.', 403);
  }
}

function feriasGetSpreadsheet_() {
  var sheetId = feriasGetSheetId_();
  if (!sheetId) feriasThrow_('FERIAS_SHEET_ID não configurado no script.', 500);
  return SpreadsheetApp.openById(sheetId);
}

function feriasGetSheet_() {
  var ss = feriasGetSpreadsheet_();
  var sheet = ss.getSheetByName(FERIAS_TAB_NAME);
  if (!sheet) feriasThrow_('Aba "' + FERIAS_TAB_NAME + '" não encontrada. Rode setupFeriasSheet().', 500);
  return sheet;
}

function feriasFormatDate_(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function feriasRowToRecord_(row) {
  if (!row || !row[0]) return null;
  var rec = {
    id: String(row[0] || '').trim(),
    nome: String(row[1] || '').trim(),
    email: String(row[2] || '').trim(),
    inicio: feriasFormatDate_(row[3]),
    fim: feriasFormatDate_(row[4]),
    tipo: String(row[5] || 'ferias').trim() || 'ferias',
    status: row[6] != null && row[6] !== '' ? String(row[6]).trim() : null,
    updated_at: row[7] ? String(row[7]) : '',
    updated_by: row[8] ? String(row[8]) : ''
  };
  if (rec.tipo !== 'ferias') delete rec.status;
  return rec;
}

function feriasReadAll_() {
  var sheet = feriasGetSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow, FERIAS_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var rec = feriasRowToRecord_(values[i]);
    if (rec && rec.id) out.push(rec);
  }
  return out;
}

function feriasFindRowIndex_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2 || !id) return -1;
  var ids = sheet.getRange(2, 1, lastRow, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return i + 2;
  }
  return -1;
}

function feriasNewId_() {
  return 'F-' + Utilities.getUuid().slice(0, 8);
}

function feriasRecordToRow_(rec) {
  return [
    rec.id,
    rec.nome,
    rec.email || '',
    rec.inicio,
    rec.fim,
    rec.tipo || 'ferias',
    rec.tipo === 'ferias' ? (rec.status || 'verde') : '',
    rec.updated_at || feriasNow_(),
    rec.updated_by || ''
  ];
}

function feriasGetAll_() {
  return { ferias: feriasReadAll_() };
}

function feriasSave_(payload) {
  payload = payload || {};
  var record = payload.record || {};
  var memberName = String(payload.memberName || '').trim();
  var userEmail = String(payload.userEmail || '').trim().toLowerCase();
  if (!memberName && !userEmail) feriasThrow_('Sessão inválida (nome ou e-mail obrigatório).', 401);

  var inicio = feriasFormatDate_(record.inicio);
  var fim = feriasFormatDate_(record.fim);
  if (!inicio || !fim) feriasThrow_('Datas de início e fim são obrigatórias.');
  if (inicio > fim) feriasThrow_('Data de início deve ser antes do fim.');

  var tipo = String(record.tipo || 'ferias').trim() || 'ferias';
  var status = tipo === 'ferias' ? (record.status || 'verde') : null;

  var sheet = feriasGetSheet_();
  var now = feriasNow_();
  var updatedBy = userEmail || memberName;
  var id = String(record.id || '').trim();

  if (!id) {
    var nome = memberName;
    var email = userEmail;
    if (!nome) feriasThrow_('Nome do membro obrigatório para novo registro.', 401);
    var newRec = {
      id: feriasNewId_(),
      nome: nome,
      email: email,
      inicio: inicio,
      fim: fim,
      tipo: tipo,
      status: status,
      updated_at: now,
      updated_by: updatedBy
    };
    sheet.appendRow(feriasRecordToRow_(newRec));
    return { record: newRec, savedAt: now };
  }

  var rowIdx = feriasFindRowIndex_(sheet, id);
  if (rowIdx < 0) feriasThrow_('Registro não encontrado: ' + id, 404);
  var existing = feriasRowToRecord_(sheet.getRange(rowIdx, 1, 1, FERIAS_HEADERS.length).getValues()[0]);
  feriasAssertCanModify_(existing, payload);

  var nomeOut = feriasIsAdmin_(payload) && record.nome ? String(record.nome).trim() : existing.nome;
  var emailOut = feriasIsAdmin_(payload) && record.email ? String(record.email).trim().toLowerCase() : existing.email;
  if (!feriasIsAdmin_(payload)) {
    nomeOut = existing.nome;
    emailOut = existing.email || userEmail;
  }

  var updated = {
    id: id,
    nome: nomeOut,
    email: emailOut,
    inicio: inicio,
    fim: fim,
    tipo: tipo,
    status: status,
    updated_at: now,
    updated_by: updatedBy
  };
  sheet.getRange(rowIdx, 1, 1, FERIAS_HEADERS.length).setValues([feriasRecordToRow_(updated)]);
  return { record: updated, savedAt: now };
}

function feriasDelete_(payload) {
  payload = payload || {};
  var id = String(payload.id || '').trim();
  if (!id) feriasThrow_('ID obrigatório.');
  var sheet = feriasGetSheet_();
  var rowIdx = feriasFindRowIndex_(sheet, id);
  if (rowIdx < 0) feriasThrow_('Registro não encontrado: ' + id, 404);
  var existing = feriasRowToRecord_(sheet.getRange(rowIdx, 1, 1, FERIAS_HEADERS.length).getValues()[0]);
  feriasAssertCanModify_(existing, payload);
  sheet.deleteRow(rowIdx);
  return { deleted: id, deletedAt: feriasNow_() };
}

/** Importação one-shot (admin). payload.records = array de registros; ignora ids já existentes */
function feriasMigrate_(payload) {
  payload = payload || {};
  if (!feriasIsAdmin_(payload)) feriasThrow_('Somente admin pode migrar.', 403);
  var records = payload.records;
  if (!Array.isArray(records)) feriasThrow_('Lista records inválida.');
  var sheet = feriasGetSheet_();
  var existingIds = {};
  feriasReadAll_().forEach(function (r) { existingIds[r.id] = true; });
  var imported = 0;
  var skipped = 0;
  records.forEach(function (raw) {
    if (!raw || !raw.inicio || !raw.fim || !raw.nome) { skipped++; return; }
    var id = String(raw.id || '').trim() || feriasNewId_();
    if (existingIds[id]) { skipped++; return; }
    var rec = {
      id: id,
      nome: String(raw.nome).trim(),
      email: String(raw.email || '').trim().toLowerCase(),
      inicio: feriasFormatDate_(raw.inicio),
      fim: feriasFormatDate_(raw.fim),
      tipo: String(raw.tipo || 'ferias').trim() || 'ferias',
      status: raw.tipo === 'ferias' || !raw.tipo ? (raw.status || 'verde') : null,
      updated_at: raw.updated_at || feriasNow_(),
      updated_by: raw.updated_by || 'migrate'
    };
    sheet.appendRow(feriasRecordToRow_(rec));
    existingIds[id] = true;
    imported++;
  });
  return { imported: imported, skipped: skipped, total: feriasReadAll_().length };
}
