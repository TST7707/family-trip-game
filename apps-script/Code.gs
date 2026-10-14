/**
 * 家族任務遊戲：照片上傳、分數、留言、讚、主辦人後台、12/7 自動重新開始
 * 這段程式貼在一份 Google 試算表的「擴充功能 → Apps Script」裡。
 * 只要改下面三行，其他都不用動。
 */
const FOLDER_ID = '請貼上共享雲端硬碟資料夾的 ID';     // 資料夾網址最後那一串英數字（不要貼整段網址）
const FAMILY_CODE = '請自己設一組家庭密碼';             // 家人加入時要用
const ADMIN_CODE = '請設一組只有主辦人知道的後台密碼';   // 後台刪人、清空、設定截止時間用
const RESET_AT = '2026-12-07T00:00:00+08:00';         // 台灣時間 12/7 00:00 自動清空一次

/* ---------- 以下不用改 ---------- */

const SHEETS = {
  '分數': ['id', 'player', 'points', 'label', 'cardId', 'date', 'ts'],
  '照片': ['id', 'player', 'kind', 'slot', 'city', 'cardId', 'cardTitle', 'theme', 'date', 'fileId', 'ts'],
  '讚': ['factId', 'player', 'ts'],
  '留言': ['id', 'fileId', 'player', 'text', 'ts'],
  '設定': ['key', 'value'],
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.code !== FAMILY_CODE) return json_({ ok: false, error: '家庭密碼不對' });
  if (p.action === 'ping') return json_({ ok: true, version: 2 });
  if (p.action === 'feed') return json_(feed_(p.date || ''));
  if (p.action === 'image') return json_(image_(p.id));
  return json_({ ok: false, error: 'unknown action' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (body.code !== FAMILY_CODE) return json_({ ok: false, error: '家庭密碼不對' });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    switch (body.action) {
      case 'score': return json_(saveScores_(body.entries || []));
      case 'photo': return json_(savePhoto_(body));
      case 'comment': return json_(saveComment_(body));
      case 'like': return json_(saveLike_(body));
      case 'admin': return json_(admin_(body));
      default: return json_({ ok: false, error: 'unknown action' });
    }
  } finally {
    lock.releaseLock();
  }
}

/* 第一次用：在編輯器上方選 setup 再按「執行」。會建立工作表、檢查資料夾，並排好 12/7 自動清空。 */
function setup() {
  Object.keys(SHEETS).forEach((n) => sheet_(n, SHEETS[n]));
  const folder = DriveApp.getFolderById(FOLDER_ID);
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'resetAll') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('resetAll').timeBased().at(new Date(RESET_AT)).create();
  Logger.log('設定完成，照片會存到：' + folder.getName() + '。12/7 00:00（台灣時間）會自動清空。');
}

/* 排程會在 12/7 自動呼叫這一支。也可以在後台按「清空全部測試資料」達到同樣效果。 */
function resetAll() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { resetCore_(); } finally { lock.releaseLock(); }
}

function resetCore_() {
  Object.keys(SHEETS).forEach((n) => {
    const sh = sheet_(n, SHEETS[n]);
    const last = sh.getLastRow();
    if (last > 1) sh.deleteRows(2, last - 1);
  });
  setSetting_('deleted', '[]');   // 被刪掉的玩家名單也清空
  const root = DriveApp.getFolderById(FOLDER_ID);
  const it = root.getFolders();
  while (it.hasNext()) it.next().setTrashed(true);   // 日期資料夾整包丟到垃圾桶
  const props = PropertiesService.getScriptProperties();
  props.setProperty('EPOCH', String(Number(props.getProperty('EPOCH') || 0) + 1));
}

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function existingIds_(sh) {
  const n = sh.getLastRow();
  if (n < 2) return new Set();
  return new Set(sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return String(r[0]); }));
}

function dataRows_(sh, ncols) {
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, ncols).getValues();
}

function removeRows_(sh, ncols, pred) {
  const rows = dataRows_(sh, ncols);
  for (let i = rows.length - 1; i >= 0; i--) {
    if (pred(rows[i])) sh.deleteRow(i + 2);
  }
}

function deletedSet_() {
  try { return new Set(JSON.parse(getSetting_('deleted') || '[]')); } catch (e) { return new Set(); }
}

function getSetting_(k) {
  const sh = sheet_('設定', SHEETS['設定']);
  const row = dataRows_(sh, 2).find((r) => String(r[0]) === k);
  return row ? String(row[1]) : '';
}

function setSetting_(k, v) {
  const sh = sheet_('設定', SHEETS['設定']);
  const rows = dataRows_(sh, 2);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === k) { sh.getRange(i + 2, 2).setValue(v); return; }
  }
  sh.appendRow([k, v]);
}

function sanitize_(s) {
  return String(s || '').replace(/[\/\\:*?"<>|]/g, '·').slice(0, 60) || '未命名';
}

function saveScores_(entries) {
  const sh = sheet_('分數', SHEETS['分數']);
  const seen = existingIds_(sh);
  const deleted = deletedSet_();
  const rows = [];
  entries.forEach(function (x) {
    if (!x || !x.id || seen.has(String(x.id)) || deleted.has(x.player)) return;
    seen.add(String(x.id));
    rows.push([x.id, x.player, Number(x.points) || 0, x.label || '', x.cardId || '', "'" + (x.date || ''), x.ts || Date.now()]);
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, SHEETS['分數'].length).setValues(rows);
  return { ok: true, added: rows.length };
}

function subfolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function savePhoto_(b) {
  const sh = sheet_('照片', SHEETS['照片']);
  if (existingIds_(sh).has(String(b.id))) return { ok: true, duplicate: true };
  if (deletedSet_().has(b.player)) return { ok: true, skipped: true };
  const root = DriveApp.getFolderById(FOLDER_ID);
  const day = subfolder_(root, b.date || 'unknown');
  const place = subfolder_(day, sanitize_((b.city || '') + '｜' + (b.cardTitle || '')));
  const folder = subfolder_(place, sanitize_(b.theme || '九宮格'));
  const suffix = b.kind === 'collage' ? '-九宮格' : (b.kind === 'task' ? '-任務' : '-' + b.slot);
  const name = (b.player || '家人') + suffix + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.mime || 'image/jpeg', name);
  const file = folder.createFile(blob);
  if (b.kind === 'collage') {
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) { /* 管理員不允許也沒關係，網頁會改用縮圖 */ }
  }
  sh.appendRow([b.id, b.player, b.kind, b.slot, b.city, b.cardId, b.cardTitle, b.theme, "'" + (b.date || ''), file.getId(), Date.now()]);
  return { ok: true, fileId: file.getId() };
}

function saveComment_(b) {
  const sh = sheet_('留言', SHEETS['留言']);
  if (!b.id || existingIds_(sh).has(String(b.id))) return { ok: true, duplicate: true };
  if (deletedSet_().has(b.player)) return { ok: true, skipped: true };
  sh.appendRow([b.id, b.fileId, b.player, String(b.text || '').slice(0, 80), b.ts || Date.now()]);
  return { ok: true };
}

function saveLike_(b) {
  const sh = sheet_('讚', SHEETS['讚']);
  if (deletedSet_().has(b.player)) return { ok: true, skipped: true };
  const n = sh.getLastRow();
  const rows = dataRows_(sh, 3);
  const exists = rows.some((r) => String(r[0]) === String(b.factId) && String(r[1]) === String(b.player));
  if (b.on && !exists) sh.appendRow([b.factId, b.player, Date.now()]);
  if (!b.on && exists) removeRows_(sh, 3, (r) => String(r[0]) === String(b.factId) && String(r[1]) === String(b.player));
  return { ok: true };
}

/* 主辦人後台：刪人、設定截止時間、清空全部。需要 ADMIN_CODE。 */
function admin_(b) {
  if (String(b.admin) !== ADMIN_CODE) return { ok: false, error: '後台密碼不對' };
  if (b.op === 'check') return { ok: true };
  if (b.op === 'setCutoff') {
    const v = String(b.value || '').trim();
    if (v && !/^\d{1,2}:\d{2}$/.test(v)) return { ok: false, error: '時間格式請寫成 21:30' };
    setSetting_('cutoff', v);
    return { ok: true };
  }
  if (b.op === 'deletePlayer') {
    const name = String(b.name || '');
    if (!name) return { ok: false, error: '沒有名字' };
    const deleted = Array.from(deletedSet_());
    if (deleted.indexOf(name) < 0) deleted.push(name);
    setSetting_('deleted', JSON.stringify(deleted));
    removeRows_(sheet_('分數', SHEETS['分數']), 7, (r) => r[1] === name);
    removeRows_(sheet_('留言', SHEETS['留言']), 5, (r) => r[2] === name);
    removeRows_(sheet_('讚', SHEETS['讚']), 3, (r) => r[1] === name);
    removeRows_(sheet_('照片', SHEETS['照片']), 11, function (r) {
      if (r[1] !== name) return false;
      try { DriveApp.getFileById(String(r[9])).setTrashed(true); } catch (err) { /* 檔案已不在就略過 */ }
      return true;
    });
    return { ok: true };
  }
  if (b.op === 'wipe') {
    resetCore_();
    return { ok: true };
  }
  return { ok: false, error: 'unknown op' };
}

function feed_(date) {
  const deleted = deletedSet_();
  const players = {};
  const scoreRows = dataRows_(sheet_('分數', SHEETS['分數']), 7).filter((r) => !deleted.has(r[1]));
  scoreRows.forEach(function (r) {
    const name = r[1];
    const p = players[name] || (players[name] = { name: name, total: 0, today: 0 });
    p.total += Number(r[2]) || 0;
    if (dateStr_(r[5]) === date) p.today += Number(r[2]) || 0;
  });
  const recent = scoreRows.slice(-40).reverse().map(function (r) {
    return { player: r[1], label: r[3], points: Number(r[2]) || 0, date: dateStr_(r[5]) };
  });
  const collages = [];
  const photoRows = dataRows_(sheet_('照片', SHEETS['照片']), 11);
  for (let i = photoRows.length - 1; i >= 0 && collages.length < 60; i--) {
    const r = photoRows[i];
    if (r[2] !== 'collage' || deleted.has(r[1])) continue;
    collages.push({ player: r[1], city: r[4], cardTitle: r[6], theme: r[7], date: dateStr_(r[8]), fileId: r[9] });
  }
  const likes = {};
  dataRows_(sheet_('讚', SHEETS['讚']), 3).forEach(function (r) {
    if (deleted.has(r[1])) return;
    (likes[r[0]] = likes[r[0]] || []).push(r[1]);
  });
  const comments = {};
  dataRows_(sheet_('留言', SHEETS['留言']), 5).forEach(function (r) {
    if (deleted.has(r[2])) return;
    (comments[r[1]] = comments[r[1]] || []).push({ player: r[2], text: r[3] });
  });
  Object.keys(comments).forEach(function (k) { comments[k] = comments[k].slice(-10); });
  const list = Object.keys(players).map(function (k) { return players[k]; }).sort(function (a, b) { return b.total - a.total; });
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    players: list,
    collages: collages,
    recent: recent,
    likes: likes,
    comments: comments,
    cutoff: getSetting_('cutoff'),
    epoch: Number(props.getProperty('EPOCH') || 0),
  };
}

function image_(id) {
  const ph = sheet_('照片', SHEETS['照片']);
  const ids = dataRows_(ph, 10).map(function (r) { return String(r[9]); });
  if (ids.indexOf(String(id)) < 0) return { ok: false, error: 'not found' };
  const file = DriveApp.getFileById(id);
  const blob = file.getBlob();
  return { ok: true, dataUrl: 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}

function dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
