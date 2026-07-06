/**
 * Quality ID Hub — Pack Bridge (sem planilha)
 * Token do Gist fica em Propriedades do script (GIST_ID, GITHUB_PACK_TOKEN).
 * Deploy como Web App (executar como: Eu, acesso: Qualquer pessoa no domínio ou Anônimo conforme política Nubank).
 */

var PACK_FILENAME_DEFAULT_ = 'quality-hub-data.json';

function doGet(e) {
  e = e || {};
  var p = e.parameter || {};
  if (p.pack) {
    var json = packApiCall_(p.pack, p.payload || '{}');
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
    JSON.stringify({ ok: true, data: { service: 'quality-pack-bridge', version: 1 } })
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
  var action = body.pack || body.action || (e.parameter && e.parameter.pack);
  var payload = body.payload != null ? body.payload : (e.parameter && e.parameter.payload) || {};
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload); } catch (e2) { payload = {}; }
  }
  var json = packApiCall_(action, JSON.stringify(payload));
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/** Rode uma vez no editor: packConfigureSecrets('a82a...', 'ghp_...') */
function packConfigureSecrets(gistId, githubToken, feriasSheetId, feriasBridgeUrl) {
  var props = PropertiesService.getScriptProperties();
  if (gistId) props.setProperty('GIST_ID', String(gistId).trim());
  if (githubToken) props.setProperty('GITHUB_PACK_TOKEN', String(githubToken).trim());
  if (feriasSheetId) props.setProperty('FERIAS_SHEET_ID', String(feriasSheetId).trim());
  if (feriasBridgeUrl) props.setProperty('FERIAS_BRIDGE_URL', String(feriasBridgeUrl).trim());
  props.setProperty('PACK_FILENAME', PACK_FILENAME_DEFAULT_);
}

function packApiCall_(action, payloadJson) {
  try {
    var payload = payloadJson ? JSON.parse(payloadJson) : {};
    var data = packHandleAction_(action, payload);
    return JSON.stringify({ ok: true, data: data });
  } catch (err) {
    return JSON.stringify({
      ok: false,
      error: String(err.message || err)
    });
  }
}

function packHandleAction_(action, payload) {
  switch (action) {
    case 'ping':
      return { pong: true, ts: new Date().toISOString() };
    case 'getPack':
      return packGetPack_(payload);
    case 'saveFerias':
      return packSaveFerias_(payload);
    case 'saveProfile':
      return packSaveProfile_(payload);
    case 'patchPack':
      return packPatchPack_(payload);
    case 'patchPriorities':
      return packPatchPriorities_(payload);
    case 'patchAccessUsers':
      return packPatchAccessUsers_(payload);
    default:
      throw new Error('Ação desconhecida: ' + action);
  }
}

function packGetProps_() {
  var props = PropertiesService.getScriptProperties();
  var gistId = props.getProperty('GIST_ID');
  var token = props.getProperty('GITHUB_PACK_TOKEN');
  var filename = props.getProperty('PACK_FILENAME') || PACK_FILENAME_DEFAULT_;
  if (!gistId || !token) {
    throw new Error('Bridge não configurada. Defina GIST_ID e GITHUB_PACK_TOKEN nas propriedades do script.');
  }
  return { gistId: gistId, token: token, filename: filename };
}

function packFetchGist_() {
  var cfg = packGetProps_();
  var url = 'https://api.github.com/gists/' + cfg.gistId;
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'token ' + cfg.token, Accept: 'application/vnd.github+json' },
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('Gist indisponível (' + code + ')');
  var json = JSON.parse(res.getContentText());
  var file = json.files[cfg.filename];
  if (!file || !file.content) throw new Error('Arquivo não encontrado no Gist');
  var parsed = JSON.parse(file.content);
  packSanitizeAuthConfig_(parsed);
  return { pack: parsed, updatedAt: json.updated_at || null };
}

function packPatchGist_(packObject) {
  packSanitizeAuthConfig_(packObject);
  var cfg = packGetProps_();
  var url = 'https://api.github.com/gists/' + cfg.gistId;
  var body = {
    files: {}
  };
  body.files[cfg.filename] = { content: JSON.stringify(packObject, null, 2) };
  var res = UrlFetchApp.fetch(url, {
    method: 'patch',
    headers: {
      Authorization: 'token ' + cfg.token,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('Erro ao salvar no Gist (' + code + ')');
  return true;
}

function packSanitizeAuthConfig_(pack) {
  if (!pack) return;
  if (!pack.authConfig) pack.authConfig = {};
  if (pack.authConfig.packToken) delete pack.authConfig.packToken;
}

function packNormalizeInviteCode_(code) {
  return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
}

function packNormalizeNameKey_(name) {
  return String(name || '').trim().toLowerCase();
}

function packNamesMatch_(a, b) {
  if (!a || !b) return false;
  var na = packNormalizeNameKey_(a);
  var nb = packNormalizeNameKey_(b);
  if (na === nb) return true;
  if (na.indexOf(nb + ' ') === 0 || nb.indexOf(na + ' ') === 0) return true;
  return na.split(/\s+/)[0] === nb.split(/\s+/)[0];
}

function packFindUserByCode_(pack, inviteCode) {
  return packFindUserByCodeInList_(packGetAccessRoster_(pack), inviteCode);
}

function packFindUserByCodeInList_(users, inviteCode) {
  var norm = packNormalizeInviteCode_(inviteCode);
  if (!norm) return null;
  users = users || [];
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (u.status === 'active' && u.inviteCode && packNormalizeInviteCode_(u.inviteCode) === norm) return u;
  }
  return null;
}

/** Gist roster → aba Membros → Planilha Hub bridge (getMembers). */
function packGetAccessRoster_(pack) {
  var users = (pack && pack.accessUsers) || [];
  if (users.length) return users;
  users = packReadMembersFromSheet_();
  if (users.length) return users;
  return packFetchMembersViaFeriasBridge_(pack);
}

function packNormalizeExecUrl_(raw) {
  return String(raw || '').replace(/\/dev$/, '/exec').replace(/\?.*$/, '').replace(/\/+$/, '');
}

function packFetchMembersViaFeriasBridge_(pack) {
  var props = PropertiesService.getScriptProperties();
  var url = (pack && pack.feriasBridge && pack.feriasBridge.url) || props.getProperty('FERIAS_BRIDGE_URL') || '';
  url = packNormalizeExecUrl_(url);
  if (!url) return [];
  try {
    var fetchUrl = url + '?ferias=getMembers&payload=' + encodeURIComponent('{}');
    var res = UrlFetchApp.fetch(fetchUrl, { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) return [];
    var json = JSON.parse(res.getContentText());
    if (json.ok && json.data && Array.isArray(json.data.accessUsers)) return json.data.accessUsers;
    return [];
  } catch (err) {
    return [];
  }
}

function packReadMembersFromSheet_() {
  var props = PropertiesService.getScriptProperties();
  var sheetId = String(props.getProperty('FERIAS_SHEET_ID') || '1xv0WyTghWTCiQON16nATiAW7kCqiTpcsK-nKvXWkubA').trim();
  if (!sheetId) return [];
  try {
    var ss = SpreadsheetApp.openById(sheetId);
    var sheet = ss.getSheetByName('Membros');
    if (!sheet || sheet.getLastRow() < 2) return [];
    var values = sheet.getRange(2, 1, sheet.getLastRow(), 6).getValues();
    var out = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      if (!row[0]) continue;
      out.push({
        id: String(row[0]).trim(),
        name: String(row[1]).trim(),
        role: String(row[3] || 'member').trim().toLowerCase() || 'member',
        status: String(row[4] || 'active').trim() || 'active',
        inviteCode: String(row[5] || '').trim()
      });
    }
    return out;
  } catch (err) {
    return [];
  }
}

function packValidateMember_(inviteCode, memberName, opts) {
  opts = opts || {};
  var remote = packFetchGist_();
  var serverRoster = packGetAccessRoster_(remote.pack);
  var u = packFindUserByCodeInList_(serverRoster, inviteCode);
  if (!u && !serverRoster.length && opts.fallbackRoster && opts.fallbackRoster.length) {
    u = packFindUserByCodeInList_(opts.fallbackRoster, inviteCode);
  }
  if (!u) {
    if (!serverRoster.length && !(opts.fallbackRoster && opts.fallbackRoster.length)) {
      throw new Error('Roster de acesso vazio. Confira a aba Membros na planilha e feriasBridge.url no Gist (URL da Planilha Hub em Técnico).');
    }
    throw new Error('Código inválido ou usuário inativo');
  }
  if (u.role === 'visitor') throw new Error('Visitantes não podem publicar no pack');
  if (memberName && !packNamesMatch_(u.name, memberName)) {
    throw new Error('Código não corresponde a este perfil');
  }
  if (opts.requireEditor && u.role !== 'admin' && u.role !== 'editor') {
    throw new Error('Permissão insuficiente para editar o pack');
  }
  return { user: u, remote: remote };
}

function packGetPack_(payload) {
  var remote = packFetchGist_();
  return { pack: remote.pack, updatedAt: remote.updatedAt };
}

function packMergeFeriasForMember_(remoteList, localList, memberName) {
  var map = {};
  (remoteList || []).forEach(function (f) {
    if (f && f.id && !packNamesMatch_(f.nome, memberName)) map[f.id] = f;
  });
  (localList || []).forEach(function (f) {
    if (f && f.id && packNamesMatch_(f.nome, memberName)) map[f.id] = f;
  });
  return Object.keys(map).map(function (k) { return map[k]; });
}

function packSaveFerias_(payload) {
  payload = payload || {};
  var memberName = payload.memberName || payload.name || '';
  var ctx = packValidateMember_(payload.inviteCode, memberName);
  var localList = payload.ferias;
  if (!Array.isArray(localList)) throw new Error('Lista de férias inválida');
  var pack = ctx.remote.pack;
  pack.ferias = packMergeFeriasForMember_(pack.ferias, localList, ctx.user.name);
  packPatchGist_(pack);
  return { ferias: pack.ferias, savedAt: new Date().toISOString() };
}

function packMergeProfile_(existing, incoming) {
  if (!existing) return incoming;
  if (!incoming) return existing;
  var exAt = existing.updatedAt || 0;
  var inAt = incoming.updatedAt || 0;
  return exAt >= inAt ? Object.assign({}, incoming, existing) : Object.assign({}, existing, incoming);
}

function packSaveProfile_(payload) {
  payload = payload || {};
  var name = payload.name || payload.memberName || '';
  var profile = payload.profile;
  var email = payload.email ? String(payload.email).toLowerCase().trim() : '';
  if (!email && profile && profile.email) email = String(profile.email).toLowerCase().trim();
  if (!name || !profile) throw new Error('Perfil inválido');
  var ctx = packValidateMember_(payload.inviteCode, name);
  var pack = ctx.remote.pack;
  if (!pack.profiles) pack.profiles = {};
  if (email) profile.email = email;
  var oldName = payload.oldName || '';
  if (oldName && oldName !== name && pack.profiles[oldName]) {
    var merged = packMergeProfile_(pack.profiles[oldName], profile);
    pack.profiles[name] = packMergeProfile_(pack.profiles[name], merged) || merged;
    delete pack.profiles[oldName];
    (pack.ferias || []).forEach(function (f) {
      if (packNamesMatch_(f.nome, oldName)) f.nome = name;
    });
    if (pack.accessUsers) {
      pack.accessUsers.forEach(function (u) {
        if (packNamesMatch_(u.name, oldName)) u.name = name;
      });
    }
  } else {
    pack.profiles[name] = packMergeProfile_(pack.profiles[name], profile) || profile;
  }
  packEnsureMemberRegistered_(pack, name);
  if (email && pack.accessUsers) {
    for (var j = 0; j < pack.accessUsers.length; j++) {
      if (packNamesMatch_(pack.accessUsers[j].name, name)) {
        pack.accessUsers[j].email = email;
        break;
      }
    }
  }
  packPatchGist_(pack);
  return { profiles: pack.profiles, accessUsers: pack.accessUsers, name: name, savedAt: new Date().toISOString() };
}

function packEnsureMemberRegistered_(pack, name) {
  if (!pack.accessUsers) pack.accessUsers = [];
  var found = false;
  for (var i = 0; i < pack.accessUsers.length; i++) {
    if (packNamesMatch_(pack.accessUsers[i].name, name)) {
      found = true;
      break;
    }
  }
  if (!found) {
    pack.accessUsers.push({
      id: 'u' + Date.now(),
      name: name,
      role: 'member',
      status: 'active',
      joinedAt: new Date().toISOString(),
      autoRegistered: true
    });
  }
}

function packPatchPack_(payload) {
  payload = payload || {};
  var incoming = payload.pack;
  if (!incoming || !incoming.sections) throw new Error('Dados do pack inválidos');
  packValidateMember_(payload.inviteCode, payload.memberName || '', { requireEditor: true });
  var remote = packFetchGist_();
  var pack = incoming;
  packSanitizeAuthConfig_(pack);
  if (remote.pack.ferias && !pack.ferias) pack.ferias = remote.pack.ferias;
  packPatchGist_(pack);
  return { savedAt: new Date().toISOString() };
}

function packPatchPriorities_(payload) {
  payload = payload || {};
  var incoming = payload.priorities;
  if (!incoming || typeof incoming !== 'object') throw new Error('Dados de prioridades inválidos');
  var remote = packFetchGist_();
  var pack = remote.pack;
  pack.priorities = incoming;
  if ((!pack.accessUsers || !pack.accessUsers.length) && Array.isArray(payload.accessUsers) && payload.accessUsers.length) {
    pack.accessUsers = payload.accessUsers;
  }
  packPatchGist_(pack);
  return { priorities: pack.priorities, savedAt: new Date().toISOString() };
}

function packPatchAccessUsers_(payload) {
  payload = payload || {};
  var incoming = payload.accessUsers;
  if (!Array.isArray(incoming)) throw new Error('Lista de usuários inválida');
  var ctx = packValidateMember_(payload.inviteCode, payload.memberName || '', {});
  if (ctx.user.role !== 'admin') throw new Error('Somente admins podem alterar usuários');
  var pack = ctx.remote.pack;
  pack.accessUsers = incoming;
  packPatchGist_(pack);
  return { accessUsers: pack.accessUsers, savedAt: new Date().toISOString() };
}
