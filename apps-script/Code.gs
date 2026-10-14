/**
 * 家族任務遊戲：照片上傳與分數同步
 * 這段程式貼在一份 Google 試算表的「擴充功能 → Apps Script」裡。
 * 只要改下面兩行，其他都不用動。
 */
const FOLDER_ID = '請貼上共享雲端硬碟資料夾的 ID';   // 資料夾網址最後那一串英數字
const FAMILY_CODE = '請自己設一組家庭密碼';           // 家人加入時要用

/* ---------------- 以下不用改 ---------------- */

const SCORE_HEADERS = ['id', 'player', 'points', 'label', 'cardId', 'date', 'ts'];
const PHOTO_HEADERS = ['id', 'player', 'kind', 'slot', 'city', 'cardId', 'cardTitle', 'theme', 'date', 'fileId', 'ts'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.code !== FAMILY_CODE) return json_({ ok: false, error: '家庭密碼不對' });
  if (p.action === 'ping') return json_({ ok: true, version: 1 });
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
    if (body.action === 'score') return json_(saveScores_(body.entries || []));
    if (body.action === 'photo') return json_(savePhoto_(body));
    return json_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}

/* 第一次用：在編輯器上方選 setup 再按「執行」，會建立兩張工作表並檢查資料夾 */
function setup() {
  sheet_('分數', SCORE_HEADERS);
  sheet_('照片', PHOTO_HEADERS);
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('設定完成，照片會存到：' + folder.getName());
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

function saveScores_(entries) {
  const sh = sheet_('分數', SCORE_HEADERS);
  const seen = existingIds_(sh);
  const rows = [];
  entries.forEach(function (x) {
    if (!x || !x.id || seen.has(String(x.id))) return;
    seen.add(String(x.id));
    rows.push([x.id, x.player, Number(x.points) || 0, x.label || '', x.cardId || '', "'" + (x.date || ''), x.ts || Date.now()]);
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, SCORE_HEADERS.length).setValues(rows);
  return { ok: true, added: rows.length };
}

function subfolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function savePhoto_(b) {
  const sh = sheet_('照片', PHOTO_HEADERS);
  if (existingIds_(sh).has(String(b.id))) return { ok: true, duplicate: true };
  const root = DriveApp.getFolderById(FOLDER_ID);
  const day = subfolder_(root, b.date || 'unknown');
  const place = subfolder_(day, (b.city || '') + '｜' + (b.cardTitle || ''));
  const folder = subfolder_(place, b.theme || '九宮格');
  const name = (b.player || '家人') + (b.kind === 'collage' ? '-九宮格' : '-' + b.slot) + '.jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(b.data), b.mime || 'image/jpeg', name);
  const file = folder.createFile(blob);
  if (b.kind === 'collage') {
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) { /* 管理員不允許也沒關係，網頁會改用縮圖 */ }
  }
  sh.appendRow([b.id, b.player, b.kind, b.slot, b.city, b.cardId, b.cardTitle, b.theme, "'" + (b.date || ''), file.getId(), Date.now()]);
  return { ok: true, fileId: file.getId() };
}

function feed_(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const players = {};
  const sc = ss.getSheetByName('分數');
  if (sc && sc.getLastRow() > 1) {
    sc.getRange(2, 1, sc.getLastRow() - 1, SCORE_HEADERS.length).getValues().forEach(function (r) {
      const name = r[1];
      const p = players[name] || (players[name] = { name: name, total: 0, today: 0 });
      p.total += Number(r[2]) || 0;
      if (dateStr_(r[5]) === date) p.today += Number(r[2]) || 0;
    });
  }
  const collages = [];
  const ph = ss.getSheetByName('照片');
  if (ph && ph.getLastRow() > 1) {
    const rows = ph.getRange(2, 1, ph.getLastRow() - 1, PHOTO_HEADERS.length).getValues();
    for (let i = rows.length - 1; i >= 0 && collages.length < 60; i--) {
      const r = rows[i];
      if (r[2] !== 'collage') continue;
      collages.push({ player: r[1], city: r[4], cardTitle: r[6], theme: r[7], date: dateStr_(r[8]), fileId: r[9] });
    }
  }
  const list = Object.keys(players).map(function (k) { return players[k]; }).sort(function (a, b) { return b.total - a.total; });
  return { ok: true, players: list, collages: collages };
}

function image_(id) {
  const ph = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('照片');
  const ids = ph && ph.getLastRow() > 1 ? ph.getRange(2, 10, ph.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
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
