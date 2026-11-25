'use strict';
/* 家族任務遊戲 — single-page app. Content comes from content.json (generated from the script). */
const APP_VERSION = '2.7.1';
const TRIP_START = '2026-12-09';
const TRIP_END = '2027-01-06';

/* ---------- small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = (s) => String(s || '').replace(/<[^>]+>/g, '');
const CHEV = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function fmtDate(iso) { const [, m, d] = iso.split('-'); return Number(m) + '/' + Number(d); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function toast(msg, ms = 2200) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, ms);
}
function taipeiMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

/* ---------- local storage ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ftg:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ftg:' + k, JSON.stringify(v)); } catch (e) { } },
};
const S = {
  get player() { return LS.get('player', ''); },
  get mode() { return LS.get('mode', 'challenge'); },
  get preview() { return LS.get('preview', false); },
  get server() { return LS.get('server', { url: '', code: '' }); },
  get family() { return LS.get('family', []); },
  get paused() { return LS.get('paused', false); },
  get familySteps() { return LS.get('family_steps', 28500); },
  set familySteps(v) { LS.set('family_steps', v); },
};
const META = { likes: {}, comments: {}, recent: [], cutoff: '' };

/* ---------- Streak & Flame computation ---------- */
function recordLogin() {
  const dates = LS.get('logins', []);
  const t = today();
  if (!dates.includes(t)) {
    dates.push(t);
    LS.set('logins', dates);
  }
}
function getStreak() {
  const dates = LS.get('logins', []);
  if (!dates.length) return 1;
  return Math.min(30, Math.max(1, dates.length));
}

/* ---------- IndexedDB ---------- */
const DB = (() => {
  let p;
  function open() {
    return p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('ftg', 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos');
        if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('pokedex')) db.createObjectStore('pokedex');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    }));
  }
  async function run(store, mode, fn) {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  }
  return {
    get: (k) => run('photos', 'readonly', (s) => s.get(k)),
    put: (k, v) => run('photos', 'readwrite', (s) => s.put(v, k)),
    del: (k) => run('photos', 'readwrite', (s) => s.delete(k)),
    qAll: () => run('queue', 'readonly', (s) => s.getAll()),
    qPut: (v) => run('queue', 'readwrite', (s) => s.put(v)),
    qDel: (id) => run('queue', 'readwrite', (s) => s.delete(id)),
    pokeGet: (k) => run('pokedex', 'readonly', (s) => s.get(k)),
    pokePut: (k, v) => run('pokedex', 'readwrite', (s) => s.put(v, k)),
    flagGet: (id) => run('pokedex', 'readonly', (s) => s.get('flag:' + id)),
    flagPut: (id, v) => run('pokedex', 'readwrite', (s) => s.put(v, 'flag:' + id)),
    flagDel: (id) => run('pokedex', 'readwrite', (s) => s.delete('flag:' + id)),
  };
})();

/* ---------- content ---------- */
let C = null;
let PRE = {};
const CARD = {};
const CITY = {};
const DATE_FOR = {};
async function loadContent() {
  const res = await fetch('content.json', { cache: 'no-cache' });
  C = await res.json();
  try { PRE = await (await fetch('preread.json', { cache: 'no-cache' })).json(); } catch (e) { PRE = {}; }
  try { SHELF = await (await fetch('shelf.json', { cache: 'no-cache' })).json(); } catch (e) { SHELF = {}; }
  for (const city of C.cities) {
    CITY[city.id] = city;
    for (const c of city.cityCards) { c.city = city.id; CARD[c.id] = c; }
    for (const c of city.spots) { c.city = city.id; CARD[c.id] = c; }
  }
  for (const [date, [cid, idx]] of Object.entries(C.unlock)) DATE_FOR[cid + '#' + idx] = date;
}
function cardDate(card) { return card.type === 'city' ? DATE_FOR[card.city + '#' + card.index] : null; }
function isUnlocked(card) {
  if (card.type !== 'city' || S.preview) return true;
  const d = cardDate(card);
  return !d || today() >= d;
}
function todayCard() {
  const u = C.unlock[today()];
  if (!u) return null;
  return CARD[u[0] + '-c' + u[1]] || null;
}
function cutoffText() { return META.cutoff || LS.get('cutoff', ''); }
function cutoffPassed() {
  const m = /^(\d{1,2}):(\d{2})$/.exec(cutoffText());
  if (!m) return false;
  return taipeiMinutes() > Number(m[1]) * 60 + Number(m[2]);
}

/* ---------- scoring ---------- */
function ledger() { return LS.get('ledger', []); }
function ledgerHas(key, player = S.player) { return ledger().some((e) => e.id === player + '|' + key); }
function award({ key, points, label, cardId = '', player = S.player, unique = true }) {
  if (!player) return false;
  const all = ledger();
  const id = unique ? player + '|' + key : player + '|' + key + '|' + uid();
  if (all.some((e) => e.id === id)) return false;
  const e = { id, player, points, label, cardId, date: today(), ts: Date.now() };
  all.push(e);
  LS.set('ledger', all);
  DB.qPut({ id: 's:' + id, type: 'score', entry: e }).then(flush);
  toast((player === S.player ? '' : player + ' ') + '+' + points + ' 分');
  return true;
}
function localTotals() {
  const map = {};
  const t = today();
  for (const e of ledger()) {
    const m = map[e.player] || (map[e.player] = { name: e.player, total: 0, today: 0 });
    m.total += e.points;
    if (e.date === t) m.today += e.points;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
}

/* ---------- server sync ---------- */
async function api(action, payload) {
  const { url, code } = S.server;
  if (!url) throw new Error('no server');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action, code }, payload)),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'server error');
  return data;
}
async function apiGet(params) {
  const { url, code } = S.server;
  if (!url) throw new Error('no server');
  const q = new URLSearchParams(Object.assign({ code }, params));
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + q.toString());
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'server error');
  return data;
}
function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
async function syncMeta(d) {
  if (!d) return;
  META.likes = d.likes || {};
  META.likeLog = d.likeLog || [];
  const wf = document.getElementById('wow-family');
  if (wf) wf.innerHTML = wowFamilyInner();
  META.comments = d.comments || {};
  META.recent = d.recent || [];
  META.cutoff = d.cutoff || '';
  LS.set('cutoff', META.cutoff);
  if (d.epoch != null) {
    const was = LS.get('epoch', null);
    if (was !== null && was !== d.epoch) {
      await wipeLocal();
      LS.set('epoch', d.epoch);
      await pullMine();
      toast('分數已重新開始');
    }
    LS.set('epoch', d.epoch);
  }
}
/* 同一個名字（不分大小寫）在不同裝置算同一個玩家：把雲端上這個名字的分數抓回來 */
const normName = (n) => String(n || '').trim().replace(/\s+/g, ' ').toLowerCase();
async function pullMine() {
  const me = S.player;
  if (!me || !S.server.url) return;
  try {
    const d = await apiGet({ action: 'mine', player: me });
    if (d.epoch != null && LS.get('epoch', null) !== null && LS.get('epoch', null) !== d.epoch) return;   // 交給 syncMeta 先清空
    const name = d.name || me;
    if (name !== me && normName(name) === normName(me)) {
      LS.set('player', name);
      LS.set('family', S.family.map((f) => (normName(f) === normName(name) ? name : f)));
    }
    const all = ledger();
    const ids = new Set(all.map((e) => e.id));
    let added = 0;
    for (const e of d.entries || []) if (!ids.has(e.id)) { all.push(e); ids.add(e.id); added++; }
    if (added) { LS.set('ledger', all); }
  } catch (e) { /* 連不上就算了，下次再抓 */ }
}
async function wipeLocal() {
  LS.set('ledger', []);
  LS.set('likes', {});
  Object.keys(localStorage).filter((k) => k.startsWith('ftg:ans:')).forEach((k) => localStorage.removeItem(k));
  for (const it of await DB.qAll()) await DB.qDel(it.id);
}

let flushing = false;
let again = false;
async function flush() {
  if (flushing) { again = true; return; }
  if (S.paused || !S.server.url || !navigator.onLine) return;
  flushing = true;
  try {
    const items = await DB.qAll();
    const scores = items.filter((i) => i.type === 'score');
    if (scores.length) {
      await api('score', { entries: scores.map((s) => s.entry) });
      for (const s of scores) await DB.qDel(s.id);
    }
    for (const l of items.filter((i) => i.type === 'like')) {
      await api('like', { factId: l.factId, player: l.player, on: l.on });
      await DB.qDel(l.id);
    }
    for (const c of items.filter((i) => i.type === 'comment')) {
      await api('comment', { id: c.id, fileId: c.fileId, player: c.player, text: c.text, ts: c.ts });
      await DB.qDel(c.id);
    }
    const photos = items.filter((i) => i.type === 'photo').sort((a, b) => a.ts - b.ts);
    let n = 0;
    for (const p of photos) {
      const blob = await DB.get(p.key);
      if (!blob) { await DB.qDel(p.id); continue; }
      n++;
      toast('上傳中 ' + n + ' / ' + photos.length, 60000);
      const data = await blobToBase64(blob);
      await api('photo', Object.assign({}, p.meta, { id: p.id, mime: blob.type || 'image/jpeg', data }));
      await DB.qDel(p.id);
      if (p.meta.kind === 'task') await DB.del(p.key);
      if (p.award) award(p.award);
    }
    if (n) toast('上傳完成，共 ' + n + ' 張');
  } catch (e) {
    if (String(e.message) !== 'no server') toast('上傳暫停，連上網路後會自動再試');
  } finally {
    flushing = false;
    if (again) { again = false; setTimeout(flush, 0); }
  }
}
async function queueCount() { return (await DB.qAll()).length; }

/* ---------- in-app browser & join links ---------- */
function inAppBrowser() {
  const ua = navigator.userAgent || '';
  return /\bLine\//i.test(ua) || /FBAN|FBAV|Instagram|MicroMessenger|KAKAOTALK/i.test(ua);
}
function externalUrl() {
  const u = new URL(location.href);
  u.searchParams.set('openExternalBrowser', '1');
  return u.toString();
}
function renderGate() {
  const isLine = /\bLine\//i.test(navigator.userAgent || '');
  $('#tabbar').hidden = true;
  $('#app').innerHTML = `<div class="gate">
    <h1>請用瀏覽器開啟</h1>
    <p>在 LINE 或其他 App 裡面打開，照片和分數可能會不見。</p>
    ${isLine ? `<a class="btn block" href="${esc(externalUrl())}">用瀏覽器開啟</a>`
             : '<p><b>請按右上角「⋯」，選「用瀏覽器開啟」或「在 Safari／Chrome 中開啟」。</b></p>'}
  </div>`;
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  return decodeURIComponent(escape(atob(s)));
}
function b64urlEncode(s) {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function handleJoin() {
  const h = location.hash;
  if (!h.startsWith('#join=')) return false;
  try {
    const j = JSON.parse(b64urlDecode(h.slice(6)));
    if (j.u) LS.set('server', { url: j.u, code: j.c || '' });
    if (Array.isArray(j.f)) LS.set('family', j.f);
    toast('已加入大家的遊戲');
  } catch (e) { toast('邀請連結看不懂，請再傳一次'); }
  history.replaceState(null, '', location.pathname + location.search + '#/');
  return true;
}

/* ---------- router ---------- */
const routes = [];
function route(pattern, fn) { routes.push([new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), fn]); }
function checkDailyStreakPopup() {
  if (!S.player) return;
  const t = today();
  if (LS.get('last_streak_dialog_date', '') === t) return;
  const streak = getStreak();
  const flagItem = (typeof FLAGS_LIST !== 'undefined' && FLAGS_LIST.length)
    ? FLAGS_LIST[Math.min(streak - 1, FLAGS_LIST.length - 1)]
    : null;
  if (!flagItem) return;
  setTimeout(() => showDailyStreakModal(streak, flagItem, t), 400);
}

function showDailyStreakModal(streak, item, todayStr) {
  if (document.getElementById('streak-modal')) return;
  const overlay = document.createElement('div');
  overlay.id = 'streak-modal';
  overlay.className = 'streak-modal-overlay';
  overlay.innerHTML = `
    <div class="streak-modal-box">
      <div class="streak-modal-header">
        <span class="chip" style="font-weight:700;color:var(--warn);background:var(--warn-bg)">🔥 連續打卡第 ${streak} 天！</span>
        <button type="button" class="streak-modal-close" id="btn-streak-close" aria-label="關閉">✕</button>
      </div>
      <h3 style="margin:12px 0 6px;font-size:18px;font-weight:800">🎉 今天為您解鎖的是：</h3>
      <div class="card" style="margin:10px 0;padding:12px;background:var(--card);border:1.5px solid var(--line)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="width:52px;height:34px;flex-shrink:0;border-radius:4px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.15)">
            ${getFlagSvg(item.id)}
          </div>
          <div>
            <span class="chip" style="font-size:11px;font-weight:700">${item.kind === 'flag' ? '🚩 真實旗幟' : '🔣 城市符碼'} No.${item.id}</span>
            <div style="font-weight:800;font-size:15px;margin-top:2px">${esc(item.title)}</div>
            <div class="sub" style="font-size:12px">📍 ${esc(item.city)}</div>
          </div>
        </div>
        <p class="sub" style="margin:0;font-size:13px;line-height:1.55;color:var(--fg)">
          ${esc(item.origin || item.spotGuide || item.trivia)}
        </p>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px">
        <button type="button" class="btn block" id="btn-streak-open" style="font-weight:800;padding:11px">
          👉 現在就開啟
        </button>
        <button type="button" class="btn block ghost" id="btn-streak-later" style="font-size:13.5px;padding:9px">
          ⏱️ 我等等自己去遊戲間查看
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const dismiss = () => {
    LS.set('last_streak_dialog_date', todayStr);
    overlay.remove();
  };

  overlay.querySelector('#btn-streak-open').onclick = () => {
    dismiss();
    location.hash = '#/flags';
  };
  overlay.querySelector('#btn-streak-later').onclick = dismiss;
  overlay.querySelector('#btn-streak-close').onclick = dismiss;
}

function render() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (inAppBrowser()) return renderGate();
  recordLogin();
  checkDailyStreakPopup();
  const rawPath = decodeURIComponent((location.hash || '#/').slice(1)) || '/';
  const path = rawPath.split('?')[0] || '/';
  if (!S.player && path !== '/onboard') { location.hash = '#/onboard'; return; }
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      const res = fn(...m.slice(1));
      const setTab = (tab) => $$('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (tab || '')));
      $('#tabbar').hidden = path === '/onboard';
      if (res && typeof res.then === 'function') res.then(setTab).catch(() => {}); else setTab(res);
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}

function view(html) {
  recordLogin();
  const topNav = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap">
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <a class="chip" href="#/flags" style="font-weight:700;color:var(--warn);background:var(--warn-bg)">🔥 連續打卡 ${getStreak()} 天</a>
      <a class="chip" href="#/pack" style="font-weight:700">🧳 行前準備</a>
      <a class="chip" href="#/airports" style="font-weight:700">✈️ 機場好好玩</a>
      <a class="chip" href="#/pokedex" style="font-weight:700">🏆 蒐集圖鑑</a>
      <a class="chip" href="#/money" style="font-weight:700">💰 記帳</a>
    </div>
    <a class="btn small ghost" href="itinerario.html" target="_blank" style="min-height:36px;font-size:13px;padding:0 10px;border-color:var(--primary);color:var(--primary)">🇪🇸 西文行程（同事專用）</a>
  </div>`;
  $('#app').innerHTML = '<div class="wrap">' + topNav + html + '</div>';
}
function back(href, label) { return `<a class="back" href="${href}"><svg class="chev" style="transform:rotate(180deg);stroke:currentColor" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>${esc(label)}</a>`; }

/* ---------- 海報風幾何圖：每座城市一個圖樣 ---------- */
const CITY_META = {
  barcelona: { no: '01', en: 'BARCELONA', coord: '41.4036° N · 2.1744° E' },
  cruise: { no: '02', en: 'MEDITERRANEAN', coord: '5 PORTS · 12.13 — 12.18' },
  sevilla: { no: '03', en: 'SEVILLA', coord: '37.3891° N · 5.9845° W' },
  guadix: { no: '04', en: 'GUADIX · GRANADA', coord: '37.2994° N · 3.1367° W' },
  cordoba: { no: '05', en: 'CÓRDOBA', coord: '37.8789° N · 4.7794° W' },
  madrid: { no: '06', en: 'MADRID', coord: '40.4168° N · 3.7038° W' },
};
const TRIP_META = { no: '00', en: 'ESPAÑA · MEDITERRÁNEO', coord: '12.09.2026 — 01.06.2027' };
function pTri(x, w, h, c, base = 118) { return `<polygon class="${c}" points="${x - w / 2},${base} ${x},${base - h} ${x + w / 2},${base}"/>`; }
function pStrip(seed) {
  const pal = ['o', 'r', 't', 'sd', 'k', 'o', 'sd', 't', 'r', 'o'];
  let s = '';
  for (let i = 0, x = 6; x < 194; i++, x += 13) {
    if ((i * 7 + seed) % 5 === 0) continue;
    s += `<rect class="${pal[(i + seed) % pal.length]}" x="${x}" y="118" width="13" height="13"/>`;
    if ((i + seed) % 3 === 0) s += `<rect class="${pal[(i + seed + 3) % pal.length]} f" x="${x}" y="131" width="13" height="10"/>`;
  }
  return s;
}
function posterSVG(kind) {
  const grid = `<g class="ln"><line x1="0" y1="34" x2="200" y2="34"/><line x1="0" y1="118" x2="200" y2="118"/><line x1="36" y1="0" x2="36" y2="150"/><line x1="164" y1="0" x2="164" y2="150"/><circle cx="100" cy="74" r="54"/><path d="M18 14h10M23 9v10"/></g>`;
  let art = '';
  if (kind === 'cruise') {
    art = `<circle class="sd" cx="100" cy="96" r="44"/><circle class="o" cx="152" cy="36" r="13"/>
      <rect class="t" x="20" y="96" width="160" height="22"/><rect class="t f" x="36" y="88" width="128" height="8"/>
      <polygon class="k" points="66,96 134,96 124,108 76,108"/>${pTri(100, 26, 40, 'o', 92)}${pTri(118, 14, 26, 'r', 92)}
      <rect class="w" x="70" y="99" width="4" height="4"/><rect class="w" x="80" y="99" width="4" height="4"/><rect class="w" x="90" y="99" width="4" height="4"/>`;
  } else if (kind === 'sevilla') {
    art = `<path class="t" d="M36 118 A46 46 0 0 1 82 72 V118 Z"/><circle class="o" cx="150" cy="38" r="12"/>
      <rect class="o" x="92" y="44" width="18" height="74"/><rect class="r" x="95" y="30" width="12" height="14"/>${pTri(101, 10, 22, 'k', 30)}
      <rect class="k f" x="96" y="56" width="10" height="6"/><circle class="t f" cx="132" cy="104" r="12"/><circle class="t" cx="146" cy="108" r="9"/><rect class="sd" x="112" y="84" width="34" height="34"/>`;
  } else if (kind === 'guadix') {
    art = `${pTri(70, 110, 66, 'k')}${pTri(132, 90, 52, 't f')}<polygon class="w" points="62,60 70,52 78,60 70,64"/>
      <circle class="o" cx="150" cy="32" r="12"/><path class="sd" d="M30 118 A30 30 0 0 1 90 118 Z"/><path class="o" d="M84 118 A26 26 0 0 1 136 118 Z"/><path class="r f" d="M128 118 A22 22 0 0 1 172 118 Z"/>
      <rect class="w" x="56" y="80" width="5" height="12"/><rect class="w" x="104" y="84" width="5" height="12"/><rect class="w" x="150" y="94" width="4" height="10"/>`;
  } else if (kind === 'cordoba') {
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 20;
      art += `<path class="${i % 2 ? 'sd' : 'r'}" d="M${x} 118 V82 A10 10 0 0 1 ${x + 18} 82 V118 Z"/><path class="w" d="M${x + 4} 118 V88 A5 5 0 0 1 ${x + 14} 88 V118 Z"/>`;
    }
    art = `<circle class="o" cx="150" cy="34" r="12"/><path class="t" d="M36 70 A40 40 0 0 1 76 30 V70 Z"/>${art}`;
  } else if (kind === 'madrid') {
    art = `<circle class="o" cx="100" cy="70" r="36"/><circle class="r f" cx="100" cy="70" r="20"/><g class="ln"><line x1="100" y1="16" x2="100" y2="124"/><line x1="46" y1="70" x2="154" y2="70"/></g>
      <rect class="t" x="132" y="86" width="16" height="16"/><rect class="sd" x="148" y="86" width="16" height="16"/><rect class="k" x="148" y="102" width="16" height="16"/><rect class="t f" x="132" y="102" width="16" height="16"/>
      <rect class="k" x="44" y="58" width="8" height="60"/>`;
  } else {
    art = `<path class="t" d="M36 118 A54 54 0 0 1 90 64 V118 Z"/><circle class="o" cx="160" cy="30" r="12"/>
      ${pTri(72, 12, 48, 'o')}${pTri(86, 14, 70, 'r')}${pTri(102, 18, 98, 'o')}${pTri(118, 14, 80, 'sd')}${pTri(132, 12, 62, 'k')}${pTri(146, 8, 40, 't')}
      <rect class="o f" x="94" y="96" width="16" height="22"/><path class="w" d="M98 118 V106 A4 4 0 0 1 106 106 V118 Z"/>`;
  }
  const seed = { barcelona: 1, cruise: 2, sevilla: 3, guadix: 4, cordoba: 5, madrid: 6 }[kind] || 0;
  return `<svg class="psvg" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${grid}${art}${pStrip(seed)}</svg>`;
}
function swatch() { return '<span class="sw"><i class="o"></i><i class="t"></i><i class="k"></i><i class="sd"></i></span>'; }
/* 使用者提供的海報插畫（docs/img/） */
const POSTER_IMG = {
  barcelona: ['img/barcelona.jpg', '巴塞隆納海報：聖家堂'], madrid: ['img/madrid.jpg', '馬德里海報：阿穆德納主教座堂與王宮'],
  segovia: ['img/segovia.jpg', '賽哥維亞海報：羅馬水道橋'], marseille: ['img/marseille.jpg', '馬賽海報：守護聖母院'],
  genoa: ['img/genoa.jpg', '利古里亞海岸的彩色房子海報'], pompeii: ['img/pompeii.jpg', '龐貝海報：維蘇威火山與遺址'],
  tunis: ['img/tunis.jpg', '突尼西亞海報：磁磚拱門'], palermo: ['img/palermo.jpg', '巴勒摩海報：主教座堂'],
  sevilla: ['img/sevilla.jpg', '塞維亞海報：西班牙廣場'], guadix: ['img/guadix.jpg', '瓜迪斯海報：洞穴屋與白色煙囪'],
  alhambra: ['img/alhambra.jpg', '格拉那達海報：阿爾罕布拉宮與雪山'], cordoba: ['img/cordoba.jpg', '哥多華海報：大清真寺的紅白拱門'],
  ship: ['img/ship.jpg', '郵輪海報'],
};
const CITY_POSTER = { barcelona: 'barcelona', cruise: 'ship', sevilla: 'sevilla', guadix: 'guadix', cordoba: 'cordoba', madrid: 'madrid' };
const SPOT_POSTER = {
  'barcelona-s1': 'barcelona', 'madrid-s2': 'madrid', 'madrid-s7': 'segovia',
  'sevilla-s3': 'sevilla', 'guadix-s1': 'guadix', 'guadix-s3': 'alhambra', 'guadix-s4': 'alhambra', 'cordoba-s1': 'cordoba',
  'cruise-s1': 'marseille', 'cruise-s2': 'marseille', 'cruise-s3': 'genoa', 'cruise-s4': 'genoa', 'cruise-s5': 'pompeii',
  'cruise-s6': 'palermo', 'cruise-s7': 'palermo', 'cruise-s8': 'tunis', 'cruise-s9': 'tunis',
};
const PORT_POSTER = { '2026-12-13': 'marseille', '2026-12-14': 'genoa', '2026-12-15': 'pompeii', '2026-12-16': 'palermo', '2026-12-17': 'tunis' };
function posterImg(key, cls = 'poster img') {
  const p = POSTER_IMG[key];
  return p ? `<figure class="${cls}"><img src="${p[0]}" alt="${esc(p[1])}" loading="lazy" decoding="async"></figure>` : '';
}
function posterBlock(kind, meta, foot) {
  if (POSTER_IMG[kind]) return posterImg(kind);
  return `<div class="poster"><div class="pmeta"><span>S / ${esc(meta.no)}</span>${swatch()}</div>${posterSVG(kind)}
    <div class="pfoot"><span>${esc(meta.en)}<br>${esc(meta.coord)}</span><span>${foot ? esc(foot) : 'N'}</span></div></div>`;
}


/* ---------- 30 TAPAS & GOOD LUCK TREATS (每日美味Tapa刮刮樂) ---------- */
const TAPAS_LIST = [
  { id: 1, icon: '🍫', name: '濃郁熱巧克力配剛出爐現炸吉拿棒', desc: '熱騰騰剛出爐的脆吉拿棒，沾滿濃到像融化布丁的熱巧克力，第一口幸福感爆發！' },
  { id: 2, icon: '🍊', name: '西班牙甜甜鮮榨柳橙汁', desc: '街邊咖啡館或超市現榨的甜橘汁，滿滿南歐陽光維他命C，好喝又解渴！' },
  { id: 3, icon: '🥪', name: '厚切香嫩馬鈴薯烘蛋', desc: '厚厚軟軟的馬鈴薯烘蛋切塊，香氣撲鼻，弟弟和爸媽都一吃就愛上！' },
  { id: 4, icon: '🍓', name: '市場買一盒鮮甜紅草莓', desc: '在水果攤挑一盒紅通通又大又甜的新鮮草莓，回旅館洗乾淨大家一起分著吃。' },
  { id: 5, icon: '🥓', name: '一片頂級伊比利火腿配烤麵包', desc: '油花在大理石花紋上發亮，放進嘴裡油脂自然融化，濃濃橡實香氣。' },
  { id: 6, icon: '🌞', name: '在廣場長椅上曬 5 分鐘冬陽', desc: '閉上眼睛，在西班牙暖呼呼的冬日陽光下靜靜坐著，放鬆心情。' },
  { id: 7, icon: '🐶', name: '向街上散步的可愛小狗微笑搖手', desc: '西班牙人超愛狗，在街頭遇到散步的小狗，對牠友善地笑一個吧！' },
  { id: 8, icon: '🍮', name: '香滑柔嫩的西班牙焦糖烤布丁', desc: '軟嫩細緻的布丁淋滿焦糖漿，入口即化，甜蜜又溫暖。' },
  { id: 9, icon: '🍨', name: '挑一球最喜歡顏色的冰淇淋', desc: '走進冰淇淋店，挑一球你最喜歡的口味（巧克力、草莓或開心果）慢慢享用！' },
  { id: 10, icon: '🔔', name: '靜靜數古老教堂的鐘聲響了幾下', desc: '噹～噹～噹～當教堂鐘聲響起時，大家一起停下腳步數數看敲了幾響。' },
  { id: 11, icon: '🍇', name: '甜甜多汁的無籽綠葡萄', desc: '洗一串冰涼香甜的無籽綠葡萄，每個人拿一顆放在嘴裡咬開！' },
  { id: 12, icon: '🥐', name: '香酥可頌配暖呼呼熱牛奶', desc: '早晨在街角咖啡館，烤得酥脆的可頌撕一塊泡一下熱牛奶，溫暖你的胃。' },
  { id: 13, icon: '🌰', name: '冬天街角紙袋裝的熱烤栗子', desc: '街頭大鐵桶碳火烤出來的熱栗子，用紙袋裝著捧在手心裡暖手又香甜。' },
  { id: 14, icon: '🥨', name: '西班牙脆脆小麥餅乾棒 (Picos)', desc: '吃火腿或前菜時一定要配的小脆棒，咬下去卡滋卡滋特別好玩。' },
  { id: 15, icon: '🧃', name: '西班牙國民巧克力奶 (Cacaolat)', desc: '玻璃瓶裝的國民巧克力牛奶，甜甜濃濃，西班牙人家喻戶曉從小喝到大。' },
  { id: 16, icon: '🍅', name: '脆烤麵包擦新鮮番茄橄欖油', desc: '現烤鄉村麵包用熟番茄擦上紅色果肉，淋金黃橄欖油撒上海鹽，簡單又極品！' },
  { id: 17, icon: '🫒', name: '多汁甜椒醃橄欖小碟', desc: '西班牙每張餐桌都會先上的一小碟醃橄欖，咬開滿嘴清香。' },
  { id: 18, icon: '🥟', name: '酥皮加利西亞鮪魚肉餡餅', desc: '金黃外皮裡面包著番茄、洋蔥與香濃鮪魚餡，切成小塊當點心最過癮。' },
  { id: 19, icon: '🥖', name: '香脆現炸魷魚圈三明治', desc: '馬德里老城最經典的平民美食，脆皮麵包夾著滿滿現炸熱魷魚圈。' },
  { id: 20, icon: '🍪', name: '香濃軟糯杏仁牛軋糖 (Turrón)', desc: '聖誕節必備傳統甜食，研磨杏仁泥加入蜂蜜，濃得像花生糖一樣香。' },
  { id: 21, icon: '🧀', name: '切片曼徹格羊乳酪 (Queso)', desc: '來自堂吉訶德故鄉的傳奇乾酪，微鹹中帶著濃郁奶香。' },
  { id: 22, icon: '🍊', name: '巧克力無花果松露球', desc: '整顆地中海乾無花果包裹香濃松露巧克力，咬下去有顆粒口感。' },
  { id: 23, icon: '🥟', name: '軟蓬蓬糖霜小炸泡芙 (Buñuelos)', desc: '圓滾滾的小泡芙炸得金黃微脆，撒上厚厚糖粉，一口一個剛剛好。' },
  { id: 24, icon: '👑', name: '三王節國王蛋糕 (Roscón de Reyes)', desc: '大大的花環麵包夾著鮮奶油，咬咬看裡面有沒有藏著幸運小國王陶偶！' },
  { id: 25, icon: '🍮', name: '加泰隆尼亞焦糖脆皮烤布蕾', desc: '用鐵片燙出玻璃般焦脆的糖殼，用小湯匙「喀」一聲敲碎，香草肉桂奶香滿溢。' },
  { id: 26, icon: '🍵', name: '一杯暖胃的洋甘菊蜂蜜熱茶', desc: '逛累了進茶館喝一杯溫熱的甘菊茶，加一小匙西班牙野生蜂蜜。' },
  { id: 27, icon: '🍬', name: '三王節大遊行搶到的水果糖', desc: '在遊行花車下倒撐雨傘接到的幸運糖果，放一顆在嘴裡甜進心坎。' },
  { id: 28, icon: '🥨', name: '千層香酥小蝴蝶餅 (Palmeritas)', desc: '烤得酥香透薄的愛心蝴蝶酥，外面刷一層焦糖脆光。' },
  { id: 29, icon: '🧇', name: '街頭熱騰騰比利時糖粒鬆餅', desc: '熱壓鐵盤出爐的鬆餅，咬得到脆脆的珍珠糖粒，香飄整條街。' },
  { id: 30, icon: '👨‍👩‍👧‍👦', name: '7 個人圍在一起笑嘻嘻大合照', desc: '找個好風景，7 個人擠在一起對著鏡頭大喊「¡Patata!」（拍下最棒的笑容）！' }
];

/* ---------- 30 REGIONAL/CITY FLAGS, LORE & SVGS ---------- */
const FLAGS_LIST = [
  {
    id: 1, kind: 'flag', city: '巴塞隆納', title: '巴塞隆納市旗（聖佐治十字＋加泰隆尼亞紅黃紋）',
    origin: '左上與右下為守護聖人聖佐治（Sant Jordi）的白底紅十字；右上與左下為加泰隆尼亞的四道紅紋。紅十字代表抵禦外敵的虔誠勇氣，四道紅紋則代表中世紀加泰隆尼亞與亞拉岡王國傳承逾千年的自治王權。',
    spotGuide: '聖雅各廣場（Plaça de Sant Jaume）的巴塞隆納市政廳主樓頂、老城巡邏警車車門徽章、以及巴塞隆納足球俱樂部（FC Barcelona）隊徽左上角，皆能親眼看見此官方標誌！',
    trivia: '相傳西元897年巴塞隆納伯爵「多毛者吉弗雷」英勇抗擊諾曼海盜重傷瀕死，法蘭克國王查理二世前來慰問，將手掌浸入伯爵胸口汩汩鮮血，在金黃色純金盾牌上一抹劃出四道血手印，封為這片土地永恆的榮譽徽章！'
  },
  {
    id: 2, kind: 'code', city: '擴建區 (Eixample)', title: '塞爾達切角街區符碼',
    origin: '象徵工程師塞爾達（Ildefons Cerdà）於1859年開創現代都市規劃（Urbanismo）的八角形切角街區。這個符碼代表著「陽光、空氣與階級平等」，主張無論貧富，每個人都該享有採光與通風的花園庭院。',
    spotGuide: '漫步米拉之家、巴特婁之家周邊，低頭看人行道幾何六角地磚，或抬頭觀察每個十字路口的45度切角建築，整座擴建區就是這個符碼的真實立體模型！',
    trivia: '塞爾達削切街角45度，在1859年汽車尚未發明的時代，是為了讓未來的蒸汽路面電車轉彎半徑更順暢，並讓每個路口都變成寬敞明亮的八角小廣場，方便街坊鄰居聚在街角曬太陽聊天！'
  },
  {
    id: 3, kind: 'flag', city: '加泰隆尼亞', title: 'Senyera 金黃紅紋旗',
    origin: '純金黃底配上四道鮮紅水平條紋，是歐洲至今仍在官方使用的最古老旗幟之一（最早文獻可追溯至1150年）。它代表加泰隆尼亞民族深厚的憲政傳統、法典制度與語言文化自豪。',
    spotGuide: '走在巴塞隆納任何街道抬頭望，老百姓民宅陽台上掛滿這面旗幟；加泰隆尼亞自治區政府大樓、蘭布拉大道書報攤與重大慶典上隨處可見。',
    trivia: '在佛朗哥獨裁統治時期（1939–1975），這面旗幟曾被嚴格禁止懸掛。加泰隆尼亞人想出妙計：把巴塞隆納足球隊的紅藍條紋球衣當成象徵，諾坎普球場也因此成為唯一能公開宣洩民族驕傲的避難所！'
  },
  {
    id: 4, kind: 'code', city: '巴塞隆納港', title: '海事領事館船錨符碼 (Consolat de Mar)',
    origin: '以船錨為象徵，源自中世紀巴塞隆納海洋領事館（Consolat de Mar）的榮光。它是西地中海歷史最悠久的海事公會，曾掌控從直布羅陀到黎凡特的黃金海上貿易網絡。',
    spotGuide: '在貝爾港（Port Vell）碼頭桅杆、港務局大樓、水上巡邏艇、以及海洋聖母聖殿（Santa María del Mar）外牆古代海員公會浮雕上均能看到。',
    trivia: '巴塞隆納在中世紀編出的《海洋領事法典》（Llibre del Consolat de Mar）是地中海最有名的海商法典之一，各地商人都拿它來解決船貨糾紛。'
  },
  {
    id: 5, kind: 'code', city: '凱旋門與城堡公園', title: '1888 世博會紅磚凱旋門符碼',
    origin: '凱旋門用新穆德哈爾式（Neo-Mudéjar）紅磚蓋成，是 1888 年世界博覽會的主要入口，象徵巴塞隆納邁向近代工業與藝術顛峰的里程碑。這座凱旋門不是為了慶祝戰爭屠殺，而是世界博覽會的大門，象徵向全球文明張開懷抱。',
    spotGuide: '沿著路易斯·孔帕尼斯大道（Passeig de Lluís Companys）走向凱旋門，正立面頂部石雕銘刻著「巴塞隆納歡迎各國（Barcelona rep les nacions）」。',
    trivia: '據傳建築大師艾菲爾最初在設計巴黎鐵塔前，曾優先向巴塞隆納市議會提案在1888世博會建造這座鐵塔，但被市議會以「造型過於古怪且鋼架昂貴」為由婉拒，轉而建造了這座典雅的紅磚凱旋門！'
  },
  {
    id: 6, kind: 'code', city: '蘭布拉大道', title: '舊河道變身的花卉大道符碼',
    origin: '蘭布拉在阿拉伯語（Ramla）原意為「乾涸沙河」，中世紀原是城牆外排洪的雨水溝渠，18世紀拆牆後蛻變為全世界最繽紛浪漫的花卉漫步大道。',
    spotGuide: '漫步蘭布拉大道中段的花攤（Flors de la Rambla）、米羅在地面鋪設的圓形彩色馬賽克地磚旁、以及百年波蓋利亞市場入口挑高拱門上方。',
    trivia: '西班牙詩人羅卡（Federico García Lorca）據說稱讚過：蘭布拉是世界上唯一一條他希望永遠走不完的街道。'
  },
  {
    id: 7, kind: 'code', city: '聖誕慶典', title: '聖誕大樂透「大胖子」金幣符碼',
    origin: '以樂透滾輪和金幣為象徵，代表全世界總獎金最高、歷史逾兩百年的西班牙聖誕彩券「El Gordo」（大胖子樂透）。',
    spotGuide: '每年12月在西班牙城鎮漫步，只要看見彩券行門口排了幾百公尺人龍、櫥窗貼滿彩券號碼與綠袍幸運小女巫（Doña Manolita），就是它的駐地！',
    trivia: '這張彩券誕生於1812年西班牙抗擊拿破崙戰爭的加的斯議會，為了籌措抗法軍費，被譽為「全天下唯一無人抱怨的自願稅」。開獎時由馬德里孤兒院孩童以獨特童聲唱號，成為全西全民年度狂歡！'
  },
  {
    id: 8, kind: 'flag', city: '法國馬賽', title: '馬賽市旗：白底天藍十字',
    origin: '純潔白底配上一道澄澈天藍色十字（Croix d\'azur sur fond blanc），純淨如普羅旺斯晴空與地中海浪花。源自11世紀十字軍東征時期，馬賽艦隊開拔前往黎凡特所佩戴的軍徽。',
    spotGuide: '郵輪靠泊馬賽舊港（Vieux-Port），眺望岸邊碼頭燈塔、守護聖母聖殿（Notre-Dame de la Garde）山頂、以及馬賽市政廳正面旗桿上隨風飄揚。',
    trivia: '馬賽是法國現存最古老的城市（西元前600年由希臘水手建立）。法國國歌《馬賽曲》便是1792年馬賽志願軍自南方向巴黎長征五百公里時一路高唱的戰歌，這座古港的血液裡刻滿了反叛與自由！'
  },
  {
    id: 9, kind: 'flag', city: '義大利熱那亞', title: '熱那亞市旗：白底紅十字（聖喬治旗）',
    origin: '純白底色配上醒目鮮紅正十字（Crux de San Zorzo），是中世紀威震西地中海的海上霸主「熱那亞海洋共和國」的驕傲圖騰。',
    spotGuide: '郵輪抵達熱那亞港口，在舊港燈塔（Lanterna）、總督宮門楣雕刻、以及聖羅倫佐大教堂正立面大理石浮雕上，處處可見此紅十字。',
    trivia: '英格蘭的聖喬治旗和熱那亞旗一模一樣。有一個流傳很廣的說法：英國船隻曾付錢給熱那亞，掛它的旗子保平安。不過歷史學家找不到可靠證據，聽聽就好。'
  },
  {
    id: 10, kind: 'flag', city: '義大利那不勒斯', title: '拿坡里市旗：金黃與紅色雙色旗',
    origin: '左半金黃、右半紅色的直式雙色旗，1821 年起成為拿坡里的城市旗。金黃與紅色常被說成象徵太陽與維蘇威火山，但這只是民間說法，顏色的真正來源眾說紛紜。',
    spotGuide: '郵輪駛入那不勒斯灣，岸邊新堡（Castel Nuovo）、平民表決廣場、甚至是傳統披薩店烤爐上的彩繪磁磚上，都能見到這抹鮮亮雙色。',
    trivia: '拿坡里是披薩的故鄉。據說 1889 年瑪格麗特王后造訪時，披薩師傅用番茄（紅）、莫札瑞拉起司（白）和羅勒（綠）做出義大利國旗三色的披薩，就是今天的瑪格麗特披薩。'
  },
  {
    id: 11, kind: 'flag', city: '西西里島巴勒摩', title: '西西里區旗（Trinacria 三腿美杜莎）',
    origin: '紅黃對角兩色，中央是古希臘的三腿符號（Trinacria）：中間一顆美杜莎頭像，伸出三條奔跑的腿，代表西西里島的三個海角。2000 年起正式成為西西里自治區的區旗。',
    spotGuide: '在巴勒摩街頭的彩繪陶盤、傳統民俗彩繪馬車（Carretto Siciliano）、以及西西里自治區政府各大歷史建物外牆隨處可尋。',
    trivia: '美杜莎頭部兩旁長出的羽毛代表時間流轉，麥穗則是羅馬帝國統治時期西西里島作為「帝國大糧倉」的富庶豐收象徵；三條腿順時針奔馳，代表四季輪迴與地中海永不熄滅的生命力！'
  },
  {
    id: 12, kind: 'flag', city: '突尼西亞', title: '突尼西亞國旗：紅底白圓新月五星',
    origin: '深紅底色中央一枚純白圓盤，環抱著紅色新月與五角星。起源於1831年突尼斯貝伊侯賽因二世統治時期，紅底紀念抗擊外敵的烈士熱血，白月與星象徵和平與伊斯蘭傳統。',
    spotGuide: '突尼斯老城麥地那（Medina）石拱門、藍白小鎮西迪布賽義德（Sidi Bou Said）白色拱門與蔚藍窗櫺旁、以及迦太基遺址海岸高處高高飄揚。',
    trivia: '藍白小鎮西迪布賽義德被譽為地中海最夢幻小鎮，當年突尼斯政府特地頒布法令：全鎮所有房屋牆面必須粉刷純白，門窗一律塗成專屬地中海鈷藍色，塗抹任何其他顏色都屬違法行為！'
  },
  {
    id: 13, kind: 'code', city: '地中海巡航', title: '航海風向羅盤符碼 (Rosa de los Vientos)',
    origin: '八個方位箭頭構成的航海風向羅盤，是古代腓尼基、希臘與熱那亞航海家征服無垠地中海的生存星盤。',
    spotGuide: '在郵輪甲板指南針觀景台、港口水文站立牌、以及巴塞隆納貝爾港海事博物館的古代航海羊皮紙海圖上皆能見其精密刻度。',
    trivia: '古代地中海水手用八個方位為風命名：東北風叫「希臘風（Greco）」、東南風叫「敘利亞風（Scirocco）」、西北風叫「大師之風（Maestrale）」。經驗豐富的老舵手只需聞風中的濕氣與泥土味，便知航向何方！'
  },
  {
    id: 14, kind: 'code', city: '蒙特惠克山', title: '蒙特惠克山要塞符碼',
    origin: '蒙特惠克山高踞海港173公尺之上，在加泰隆尼亞語意為「猶太山」，自古便是扼守海陸要道的軍事巨壁。',
    spotGuide: '搭乘蒙特惠克纜車登頂城堡砲台，俯瞰整個巴塞隆納貨櫃海港與老城區天際線，也可以看看城堡的砲台和城牆。',
    trivia: '1792 年起，法國天文學家梅尚（Méchain）曾在蒙特惠克城堡上做觀測，參與測量經線長度的計畫，那次測量就是後來定出「一公尺」有多長的依據之一。'
  },
  {
    id: 15, kind: 'code', city: '哥德區', title: '奧古斯都羅馬柱古城符碼 (Barcino)',
    origin: '以四根羅馬神廟石柱為象徵。西元前15年羅馬皇帝奧古斯都在此設立殖民古城「巴爾奇諾（Barcino）」，是巴塞隆納兩千年的城市之根。',
    spotGuide: '隱身在哥德區天堂街（Carrer del Paradís 10號）加泰隆尼亞登山會庭院內，四根保存完好的兩千年神廟巨柱直插天井，令人震撼。',
    trivia: '這四根神殿石柱深埋在中世紀民宅牆體中近一千年，直到19世紀老屋改建拆除隔間時，工人才驚愕發現自家客廳牆壁裡居然嵌著兩千年前羅馬大理石巨柱！'
  },
  {
    id: 16, kind: 'flag', city: '塞維亞', title: '塞維亞市旗：緋紅底 NO8DO',
    origin: '緋紅色旗面，中央是黃色的「NO8DO」：字母 NO、一束毛線（madeja，畫成像數字 8 的形狀）、字母 DO，連起來唸像「No me ha dejado」（她沒有離棄我）。1995 年正式成為塞維亞市旗。',
    spotGuide: '塞維亞街頭最神奇的尋寶！市政廳、復古鑄鐵路燈基座、警車標記、公車站牌、甚至腳底下的下水道人孔蓋上，100% 都能看見這串字符！',
    trivia: '1282年卡斯提爾國王阿方索十世（智者阿方索）遭親生兒子叛亂篡位，全西班牙各大城相繼背叛，唯獨塞維亞市民誓死保衛國王。老國王臨終前熱淚盈眶，將這句密碼賜為塞維亞永恆市徽！'
  },
  {
    id: 17, kind: 'code', city: '塞維亞大教堂', title: '吉拉達風向女神符碼 (El Giraldillo)',
    origin: '聳立在塞維亞大教堂鐘樓頂端、重達1.2噸的青銅風向女神雕像。它原是12世紀摩爾清真寺的喚拜樓，頂端加建文藝復興鐘樓與青銅雕像，隨風旋轉（Girar）因而得名。',
    spotGuide: '大教堂聖克里斯多福門口放置了一尊 1:1 等身復刻青銅雕像供遊客觸摸拍照；抬頭仰望104公尺高空雲端處則是真品。',
    trivia: '吉拉達鐘樓內部完全沒有樓梯台階，而是由35道寬敞平緩的斜坡盤旋而上！這是為了讓當年中世紀穆斯林教士不必徒步爬梯，而是每天騎著毛驢直接騎到百米塔頂播報祈禱時間！'
  },
  {
    id: 18, kind: 'flag', city: '安達魯西亞', title: '安達魯西亞區旗：綠白綠 (Verde, Blanca y Verde)',
    origin: '綠、白、綠三條橫紋，中央是海格力斯與兩頭獅子的徽章。由安達魯西亞自治運動的推手布拉斯・因凡特（Blas Infante）在 1918 年提出，1981 年成為自治區正式區旗。',
    spotGuide: '塞維亞西班牙廣場（Plaza de España）圓弧長廊中央、聖十字區白牆民宅中庭花園、以及隆達天生橋頭均有懸掛。',
    trivia: '徽章中海格力斯腳踩兩根石柱，代表直布羅陀海峽兩側的「海格力斯之柱」，柱上纏繞拉丁銘文「Plus Ultra」（向更遠方前進），是西班牙大航海時代打破古代「世界盡頭」禁忌的開拓精神！'
  },
  {
    id: 19, kind: 'code', city: '瓜達幾維河', title: '黃金塔與環球航行符碼 (Torre del Oro)',
    origin: '黃金塔是一座十二邊形的防禦塔，塔身原覆蓋著金色釉面磁磚，在陽光照射下如黃金般璀璨耀眼，是瓜達幾維河守護塞維亞海門的要塞。',
    spotGuide: '漫步塞維亞瓜達幾維河畔林蔭步道，黃金塔就矗立在河岸轉角處，現在館內為海事博物館。',
    trivia: '1519年8月10日，麥哲倫率領五艘帆船就是從黃金塔下的碼頭拔錨啟航展開環球航行！三年後僅剩「維多利亞號」載著18位倖存水手回到黃金塔，完成了人類史上第一次環繞地球的偉大壯舉！'
  },
  {
    id: 20, kind: 'code', city: '瓜迪斯 (Guadix)', title: '紅土高原白煙囪窯洞符碼',
    origin: '雪白內華達山脈下，千溝萬壑的赤褐色紅土高原，探出一支支圓柱形雪白煙囪。這是安達魯西亞最奇幻的人居地景，記錄了摩爾人避難與安土重遷的智慧。',
    spotGuide: '走入瓜迪斯窯洞區（Barrio de las Cuevas），站在觀景台遠眺，數百根雪白煙囪從地下鑽出地面，宛如童話小人國。',
    trivia: '瓜迪斯至今仍有兩千多戶居民長年住在地下窯洞中！由於紅土質地黏韌且具有極佳隔熱性，室外夏天高達40度酷暑或冬天下雪結冰，室內一年四季始終維持在攝氏18–20度天然恆溫！'
  },
  {
    id: 21, kind: 'flag', city: '格拉那達', title: '格拉納達市旗：緋紅與綠 (Bandera de Granada)',
    origin: '左半緋紅、右半綠色的直式雙色旗，正中央是格拉納達市徽（市徽裡有一顆石榴，Granada 在西班牙文就是石榴）。1983 年由市議會通過。',
    spotGuide: '在新廣場（Plaza Nueva）、阿爾拜辛區石板路街角柱、路燈基座、甚至是街頭鐵鑄人行路樁頂端，全是一顆顆精巧立體石榴！',
    trivia: '西班牙現行國徽最下方底部那一顆小小的金黃裂口石榴，正是天主教雙王在1492年攻克格拉那達後特地加進西班牙國徽的，象徵伊比利半島八百年收復失地運動（Reconquista）最後一塊完整拼圖！'
  },
  {
    id: 22, kind: 'code', city: '格拉那達', title: '阿爾罕布拉「唯有真主是勝者」符碼',
    origin: '阿爾罕布拉宮牆上反覆雕刻的阿拉伯文書法：«ولا غالب إلا الله»（除真主外，別無勝者），是奈斯爾王朝的格言。',
    spotGuide: '踏進阿爾罕布拉宮桃金孃中庭與獅子庭院，仔細觀察石膏雕花牆面、彩色磁磚腰線、以及木雕天花板，這句經文重複雕刻了上萬次！',
    trivia: '奈斯爾王朝開國君主穆罕默德一世攻下格拉那達時，百姓夾道歡呼稱他為「偉大的征服者」，國王謙遜搖頭回答道：「除真主外，別無勝者。」從此這句話成為王室信條，刻滿整座王宮！'
  },
  {
    id: 23, kind: 'code', city: '哥多華', title: '哥多華城徽符碼：羅馬橋與清真寺塔',
    origin: '哥多華的城徽像一枚蠟封印章，上面畫著橫跨瓜達幾維河的羅馬橋、阿拉伯時代的水車、橋門和清真寺大教堂的鐘樓。這是城市的徽章，不是一面旗子。',
    spotGuide: '在哥多華羅馬古橋頭、古城牆防衛門、百花巷入口陶罐牆面、以及哥多華市政廳頂部均可見其威嚴身影。',
    trivia: '哥多華在西元10世紀是全歐洲最大、最富庶繁華的都會，擁有百萬人口、三千座公共浴室與全歐最大的皇家圖書館（藏書四十萬冊，當時巴黎最大圖書館僅數千冊），其文明之光照亮了中世紀黑暗歐洲！'
  },
  {
    id: 24, kind: 'code', city: '哥多華', title: '清真寺雙色馬蹄拱符碼 (Mezquita)',
    origin: '白色石灰岩與紅色燒磚交替砌成的馬蹄形雙層拱券圖紋。靈感汲取自古羅馬水道橋力學結構，創造出支撐極高挑穹頂的建築奇蹟。',
    spotGuide: '踏進大清真寺主殿，眼前856根斑岩、碧玉與大理石柱排列如無邊無際的石柱森林，紅白相間的馬蹄石拱令人嘆為觀止。',
    trivia: '16世紀查理五世皇帝批准在清真寺正中心硬生生插入一座文藝復興基督教堂，但他親自前來視察完工成果時卻後悔萬分，嘆息道：「你們摧毀了世間絕無僅有的奇蹟，建造了一座在任何地方都能建的普通教堂！」'
  },
  {
    id: 25, kind: 'flag', city: '馬德里', title: '馬德里自治區旗：緋紅底七顆白星',
    origin: '緋紅色旗面上排著七顆白色五角星（上四下三），是馬德里自治區（Comunidad de Madrid）的區旗，1983 年設立。七顆星來自馬德里城徽上的星星，一般認為代表北斗七星所在的大熊座。',
    spotGuide: '在太陽門廣場的「黑熊與野草莓樹」青銅雕像旁、馬德里市政警車車門、以及各大公車站牌立柱上都能看到這七顆銀星！',
    trivia: '古代馬德里周邊山林裡曾有大量野生棕熊棲息，市徽上的黑熊站立擁抱一棵結滿紅色果實的野草莓樹（Madroño）。這棵樹的果實發酵後含有微量天然酒精，因此古時馬德里常有棕熊偷吃果實醉倒在草地上的趣味傳聞！'
  },
  {
    id: 26, kind: 'code', city: '普拉多博物館', title: '聖雅各騎士團紅十字符碼',
    origin: '紅色的劍形十字，末端像百合花。西班牙三大騎士團之一「聖雅各騎士團」的崇高榮譽徽章。',
    spotGuide: '在普拉多博物館內欣賞委拉斯蓋茲傳世國寶《宮女》（Las Meninas），注意畫中站在大畫架前的畫家本人，其胸口長袍上那枚鮮紅耀眼的十字。',
    trivia: '在17世紀西班牙，平民畫家地位卑微，委拉斯蓋茲一生渴望獲頒貴族階級的聖雅各十字勳章，直到晚年才如願。相傳在畫家逝世後，西班牙國王腓力四世親自拿起畫筆，在《宮女》真跡畫像上親手為過世的愛卿補畫上這枚紅色十字勳章！'
  },
  {
    id: 27, kind: 'flag', city: '塞哥維亞', title: '塞哥維亞市旗：天藍底水道橋城徽',
    origin: '天藍色旗面，中間是塞哥維亞市徽：羅馬水道橋，上方有一個人頭像。2011 年市議會的規章正式訂下這面旗。',
    spotGuide: '抵達阿索格霍廣場（Plaza del Azoguejo），高達28公尺的水道橋巍峨矗立眼前；在當地百年烤乳豬名店 Candido 的餐盤徽章上也能看到。',
    trivia: '這座建於西元1世紀的水道橋總共用了20,400塊巨大花崗岩石塊，最不可思議的是——整座宏偉工程「沒有使用一滴泥漿或水泥灰粉」，全憑羅馬工程師神乎其技的重力精準咬合，屹立兩千年不倒，直到20世紀中葉仍在為小鎮引水灌溉！'
  },
  {
    id: 28, kind: 'code', city: '托雷多', title: '托雷多雙頭鷹帝國城徽符碼',
    origin: '托雷多的城徽是一隻戴皇冠的黑色雙頭鷹，胸前是卡斯提爾、雷昂和格拉納達的紋章。一般認為是神聖羅馬帝國皇帝查理五世（也是西班牙國王卡洛斯一世）賜給城市的，象徵托雷多曾是帝國的重要首都。這是城徽，不是旗子。',
    spotGuide: '托雷多比薩格拉新門（Puerta Nueva de Bisagra）巨型石雕大門正中央、大馬士革刀劍工藝品工坊櫥窗、市政廳正立面懸掛。',
    trivia: '托雷多自中世紀便以鍛造全世界最銳利的大馬士革金銀鑲嵌鋼劍聞名。羅馬軍團的短劍、查理五世的精鋼盔甲、甚至《魔戒》與好萊塢史詩電影中的騎士寶劍，許多都是特地委託托雷多老工匠以古法打造！'
  },
  {
    id: 29, kind: 'flag', city: '西班牙王宮', title: '西班牙國王旗 (Guion / Estandarte Real)',
    origin: '西班牙國王個人的旗幟（Guion），緋紅底，中間是國王的紋章，集合了卡斯提爾（城堡）、雷昂（獅子）、亞拉岡（紅黃條紋）、納瓦拉（金鏈）和格拉納達（石榴）。',
    spotGuide: '王宮是國家典禮用的地方，國王平常不住這裡。國王親自出席活動時，現場才會升起這面國王旗；平常在王宮看到的是西班牙國旗。',
    trivia: '納瓦拉王國的「金鏈」徽章源自1212年托洛薩拉斯納瓦斯大戰（Las Navas de Tolosa），納瓦拉國王桑喬七世親率騎士殺入摩爾人軍帳，用巨劍斬斷穆斯林親衛隊拴住哈里發帳篷的粗壯防禦鐵鏈，從此金鏈被榮耀地刻入西班牙王室血脈！'
  },
  {
    id: 30, kind: 'code', city: '三王節 (Reyes Magos)', title: '東方三博士伯利恆之星符碼',
    origin: '指引東方三博士找到聖嬰的伯利恆之星，以及梅爾基奧、加斯帕、巴爾塔沙三位國王的王冠。',
    spotGuide: '1月5日夜晚馬德里與塞維亞街頭「三王節大遊行（Cabalgata de Reyes）」的花車主帆、街邊彩燈裝飾、以及麵包店國王蛋糕盒蓋上。',
    trivia: '1月5日夜晚是西班牙全城一年中最期盼的夜晚！睡前家家戶戶會在陽台擺好乾草和水給三位國王的駱駝解渴，並把擦得乾乾淨淨的鞋子擺在客廳。第二天醒來，鞋子裡就會塞滿三位國王送來的禮物或糖果；如果這一年表現調皮，國王就會送來黑漆漆的「煤炭糖（Carbón dulce）」！'
  }
];

function getFlagSvg(id) {
  switch (id) {
    case 1:
      return `<svg viewBox="0 0 120 80"><rect width="60" height="40" fill="#fff"/><rect y="15" width="60" height="10" fill="#C5221F"/><rect x="25" width="10" height="40" fill="#C5221F"/><rect x="60" width="60" height="40" fill="#FDD835"/><path d="M66 0v40h7V0zm14 0v40h7V0zm14 0v40h7V0zm14 0v40h7V0z" fill="#C5221F"/><rect y="40" width="60" height="40" fill="#FDD835"/><path d="M6 40v40h7V40zm14 40v-40h7v40zm14 40v-40h7v40zm14 40v-40h7v40z" fill="#C5221F"/><rect x="60" y="40" width="60" height="40" fill="#fff"/><rect x="60" y="55" width="60" height="10" fill="#C5221F"/><rect x="85" y="40" width="10" height="40" fill="#C5221F"/></svg>`;
    case 2:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#F5EFEB"/><path d="M8 8h24l6 6v14l-6 6H8l-6-6V14zm44 0h24l6 6v14l-6 6H52l-6-6V14zm44 0h24l6 6v14l-6 6H96l-6-6V14zm-88 44h24l6 6v14l-6 6H8l-6-6V58zm44 0h24l6 6v14l-6 6H52l-6-6V58zm44 0h24l6 6v14l-6 6H96l-6-6V58z" fill="#C66247"/><circle cx="20" cy="23" r="5" fill="#4B8358"/><circle cx="64" cy="23" r="5" fill="#4B8358"/><circle cx="108" cy="23" r="5" fill="#4B8358"/><circle cx="20" cy="67" r="5" fill="#4B8358"/><circle cx="64" cy="67" r="5" fill="#4B8358"/><circle cx="108" cy="67" r="5" fill="#4B8358"/></svg>`;
    case 3:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#FDD835"/><rect y="9" width="120" height="9" fill="#C5221F"/><rect y="27" width="120" height="9" fill="#C5221F"/><rect y="45" width="120" height="9" fill="#C5221F"/><rect y="63" width="120" height="9" fill="#C5221F"/></svg>`;
    case 4:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#1565C0"/><path d="M60 14a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 18v34m-20-14c4 12 16 18 20 18s16-6 20-18m-28-12h16" stroke="#FFD54F" stroke-width="4.5" fill="none" stroke-linecap="round"/></svg>`;
    case 5:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#F57C00"/><path d="M30 70V28l12-8h36l12 8v42H74V48c0-8-6-14-14-14s-14 6-14 14v22z" fill="#B71C1C"/><rect x="42" y="22" width="36" height="5" fill="#FFE082"/><circle cx="60" cy="30" r="4" fill="#FFE082"/></svg>`;
    case 6:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#FFF8E1"/><path d="M0 40c30-15 60 15 120 0v40H0z" fill="#2E7D32"/><circle cx="60" cy="30" r="10" fill="#E91E63"/><circle cx="50" cy="26" r="6" fill="#FFC107"/><circle cx="70" cy="26" r="6" fill="#FFC107"/><circle cx="60" cy="18" r="6" fill="#FFC107"/><circle cx="60" cy="30" r="4" fill="#fff"/></svg>`;
    case 7:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#880E4F"/><circle cx="60" cy="36" r="22" fill="#FFA000" stroke="#FFD54F" stroke-width="3"/><path d="M60 14v44M38 36h44m-6-15-32 30m0-30 32 30" stroke="#FFE082" stroke-width="1.5"/><rect x="52" y="58" width="16" height="12" fill="#FFA000"/><circle cx="48" cy="68" r="4" fill="#FFD54F"/><circle cx="60" cy="72" r="4" fill="#FFD54F"/><circle cx="72" cy="68" r="4" fill="#FFD54F"/></svg>`;
    case 8:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#FFFFFF"/><rect y="30" width="120" height="20" fill="#29B6F6"/><rect x="50" width="20" height="80" fill="#29B6F6"/></svg>`;
    case 9:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#FFFFFF"/><rect y="30" width="120" height="20" fill="#D32F2F"/><rect x="50" width="20" height="80" fill="#D32F2F"/></svg>`;
    case 10:
      return `<svg viewBox="0 0 120 80"><rect width="60" height="80" fill="#FFD600"/><rect x="60" width="60" height="80" fill="#D50000"/></svg>`;
    case 11:
      return `<svg viewBox="0 0 120 80"><path d="M0 0h120L0 80z" fill="#D50000"/><path d="M120 0v80H0z" fill="#FFD600"/><circle cx="60" cy="40" r="10" fill="#FFA000"/><path d="M60 30c-6-16 10-24 16-16M68 46c14 8 16 26 6 28M48 46c-12 10-24-4-20-14" stroke="#D50000" stroke-width="4.5" fill="none" stroke-linecap="round"/><circle cx="60" cy="40" r="5" fill="#FFE082"/></svg>`;
    case 12:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#E53935"/><circle cx="60" cy="40" r="20" fill="#fff"/><path d="M60 26a14 14 0 1 0 8 25.5 11 11 0 1 1-8-25.5z" fill="#E53935"/><polygon points="65,34 67,39 72,39 68,42 70,47 65,44 60,47 62,42 58,39 63,39" fill="#E53935"/></svg>`;
    case 13:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#0D47A1"/><circle cx="60" cy="40" r="28" stroke="#FFE082" stroke-dasharray="3 3" fill="none"/><polygon points="60,14 64,36 60,40" fill="#FFD54F"/><polygon points="60,14 56,36 60,40" fill="#FFF59D"/><polygon points="60,66 64,44 60,40" fill="#FFF59D"/><polygon points="60,66 56,44 60,40" fill="#FFD54F"/><polygon points="34,40 56,36 60,40" fill="#FFF59D"/><polygon points="34,40 56,44 60,40" fill="#FFD54F"/><polygon points="86,40 64,36 60,40" fill="#FFD54F"/><polygon points="86,40 64,44 60,40" fill="#FFF59D"/><circle cx="60" cy="40" r="3.5" fill="#FFD54F"/></svg>`;
    case 14:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="48" fill="#FDD835"/><rect y="48" width="120" height="32" fill="#1E88E5"/><path d="M36 48V26h12v6h6v-6h12v6h6v-6h12v22z" fill="#B71C1C"/><rect x="42" y="32" width="6" height="8" fill="#FDD835"/><rect x="72" y="32" width="6" height="8" fill="#FDD835"/><rect x="56" y="38" width="8" height="10" fill="#212121"/></svg>`;
    case 15:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#7F0000"/><polygon points="26,22 60,10 94,22" fill="#FFD54F"/><rect x="28" y="22" width="64" height="4" fill="#FFE082"/><rect x="34" y="26" width="6" height="38" fill="#FFF9C4"/><rect x="50" y="26" width="6" height="38" fill="#FFF9C4"/><rect x="64" y="26" width="6" height="38" fill="#FFF9C4"/><rect x="80" y="26" width="6" height="38" fill="#FFF9C4"/><rect x="26" y="64" width="68" height="6" fill="#FFD54F"/></svg>`;
    case 16:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#880E4F"/><text x="24" y="52" fill="#FFD54F" font-family="-apple-system,sans-serif" font-size="28" font-weight="900">NO</text><path d="M60 28c-6-10-14 0-4 12s14 4 4 12-14 0-4-12z" stroke="#FFD54F" stroke-width="4" fill="none"/><text x="76" y="52" fill="#FFD54F" font-family="-apple-system,sans-serif" font-size="28" font-weight="900">DO</text></svg>`;
    case 17:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#C28242"/><rect x="44" y="32" width="32" height="48" fill="#794628"/><rect x="48" y="22" width="24" height="10" fill="#9C5B32"/><polygon points="52,22 60,12 68,22" fill="#794628"/><circle cx="60" cy="8" r="3" fill="#FFE082"/><path d="M60 8l10-4m-10 4l-6 6" stroke="#FFE082" stroke-width="1.8"/></svg>`;
    case 18:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="26.6" fill="#007A3D"/><rect y="26.6" width="120" height="26.6" fill="#FFFFFF"/><rect y="53.3" width="120" height="26.6" fill="#007A3D"/><rect x="48" y="28" width="24" height="24" fill="#007A3D" rx="3"/><circle cx="60" cy="38" r="5" fill="#FFD54F"/><rect x="52" y="32" width="3" height="14" fill="#fff"/><rect x="65" y="32" width="3" height="14" fill="#fff"/></svg>`;
    case 19:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#0277BD"/><path d="M22 66V32l6-4h16l6 4v34zm6-38h16v-6l-3-2h-10l-3 2z" fill="#FFA000"/><path d="M68 64c8 4 28 4 36-2l-4-10H64z" fill="#5D4037"/><path d="M78 52V30l16 4v18zm14 0V34l12 4v14z" fill="#FFF9C4"/><rect x="0" y="66" width="120" height="14" fill="#01579B"/></svg>`;
    case 20:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#E0F2F1"/><polygon points="20,50 60,18 100,50" fill="#90A4AE"/><polygon points="45,30 60,18 75,30" fill="#FFFFFF"/><path d="M0 48c40 0 60-6 120 0v32H0z" fill="#A14429"/><rect x="54" y="34" width="12" height="16" fill="#FFFFFF" rx="2"/><circle cx="60" cy="34" r="7" fill="#FFFFFF"/></svg>`;
    case 21:
      return `<svg viewBox="0 0 120 80"><rect width="60" height="80" fill="#B71C1C"/><rect x="60" width="60" height="80" fill="#1B5E20"/><circle cx="60" cy="42" r="14" fill="#FFA000"/><polygon points="56,26 60,22 64,26 68,23 60,18 52,23" fill="#FFD54F"/><path d="M60 42l4 4-4 4-4-4z" fill="#B71C1C"/><circle cx="60" cy="42" r="2" fill="#fff"/></svg>`;
    case 22:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#C62828"/><polygon points="0,0 24,0 120,64 120,80 96,80 0,16" fill="#FFD54F"/><text x="40" y="44" fill="#7F0000" font-family="serif" font-size="10" font-weight="700" transform="rotate(33 60 40)">ولا غالب إلا الله</text></svg>`;
    case 23:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#FFFFFF"/><path d="M52 58c-4-8 2-14 8-16 0-8 6-12 12-14 2 4-2 8-2 10 6 2 8 8 4 12 4 4 2 10-4 12 4 4 2 8-2 8s-10-4-16-12z" fill="#C62828"/><polygon points="68,26 72,22 76,26 80,22 74,18" fill="#FFD54F"/></svg>`;
    case 24:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#FFF9C4"/><path d="M30 70V44c0-16 14-26 30-26s30 10 30 26v26h-8V44c0-12-10-20-22-20s-22 8-22 20v26z" fill="#C62828"/><path d="M38 44c0-12 10-20 22-20s22 8 22 20h-8c0-8-6-14-14-14s-14 6-14 14z" fill="#FFF8E1"/><rect x="26" y="44" width="8" height="26" fill="#E0E0E0"/><rect x="86" y="44" width="8" height="26" fill="#E0E0E0"/></svg>`;
    case 25:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#B71C1C"/><g fill="#FFFFFF"><polygon points="30,22 32,27 38,27 33,31 35,36 30,33 25,36 27,31 22,27 28,27"/><polygon points="50,22 52,27 58,27 53,31 55,36 50,33 45,36 47,31 42,27 48,27"/><polygon points="70,22 72,27 78,27 73,31 75,36 70,33 65,36 67,31 62,27 68,27"/><polygon points="90,22 92,27 98,27 93,31 95,36 90,33 85,36 87,31 82,27 88,27"/><polygon points="40,48 42,53 48,53 43,57 45,62 40,59 35,62 37,57 32,53 38,53"/><polygon points="60,48 62,53 68,53 63,57 65,62 60,59 55,62 57,57 52,53 58,53"/><polygon points="80,48 82,53 88,53 83,57 85,62 80,59 75,62 77,57 72,53 78,53"/></g></svg>`;
    case 26:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#212121"/><path d="M60 14c-4 6-10 6-6 12h8c4-6-2-6-2-12zm-22 22c6-4 6-10 12-6v8c-6 4-6-2-12-2zm44 0c-6-4-6-10-12-6v8c6 4 6-2 12-2zM56 36h8v24l-4 12-4-12z" fill="#D32F2F"/></svg>`;
    case 27:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#5DADE2"/><rect x="20" y="44" width="80" height="8" fill="#ECEFF1"/><rect x="20" y="64" width="80" height="8" fill="#ECEFF1"/><path d="M26 44v28h8V44zm16 0v28h8V44zm16 0v28h8V44zm16 0v28h8V44zm16 0v28h8V44z" fill="#CFD8DC"/><path d="M52 24h16v14H52z" fill="#ECEFF1"/></svg>`;
    case 28:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#C2185B"/><path d="M60 30c-8-12-18-10-22-4 4 6 10 4 10 10-10-2-18 8-16 16 8 8 16 0 18-6v16h20V46c2 6 10 14 18 6 2-8-6-18-16-16 0-6 6-4 10-10-4-6-14-8-22 4z" fill="#212121"/><polygon points="40,20 44,16 48,20 44,24" fill="#FFD54F"/><polygon points="72,20 76,16 80,20 76,24" fill="#FFD54F"/><circle cx="60" cy="48" r="6" fill="#C2185B" stroke="#FFD54F" stroke-width="2"/></svg>`;
    case 29:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#8E1B2A"/><g transform="translate(42,14)"><rect width="36" height="44" rx="3" fill="#F1BF00" stroke="#5a0f18" stroke-width="1.5"/><rect x="2" y="2" width="15" height="20" fill="#C8102E"/><rect x="19" y="2" width="15" height="20" fill="#ffffff"/><rect x="2" y="24" width="15" height="18" fill="#F1BF00"/><g fill="#C8102E"><rect x="4" y="24" width="2" height="18"/><rect x="8" y="24" width="2" height="18"/><rect x="12" y="24" width="2" height="18"/></g><rect x="19" y="24" width="15" height="18" fill="#C8102E"/><circle cx="18" cy="38" r="4" fill="#E57373" stroke="#2E7D32" stroke-width="1"/></g><path d="M48 12 l4-6 4 4 4-6 4 6 4-4 4 6z" fill="#F1BF00"/></svg>`;
    case 30:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#1A237E"/><polygon points="60,10 63,26 78,20 67,31 82,38 67,42 75,56 61,48 58,62 55,48 42,56 49,42 35,38 49,31 40,20 54,26" fill="#FFD54F"/><circle cx="60" cy="36" r="4" fill="#FFF9C4"/><circle cx="36" cy="64" r="5" fill="#FFA000"/><circle cx="60" cy="64" r="5" fill="#FFE082"/><circle cx="84" cy="64" r="5" fill="#FFA000"/></svg>`;
    default:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#ECE7DE"/><text x="60" y="46" font-size="28" text-anchor="middle">🚩</text></svg>`;
  }
}

/* ---------- 17 UNESCO WORLD HERITAGE SITES (此行世界文化與自然遺產圖鑑) ---------- */
const UNESCO_ITEMS = [
  {
    id: 'u01',
    icon: '⛪',
    name: '安東尼・高第建築群',
    en: 'Works of Antoni Gaudí',
    year: '1984 / 2005 擴展',
    city: '巴塞隆納',
    desc: '包含聖家堂誕生立面與地下聖堂、桂爾公園、巴特婁之家、米拉之家、桂爾宮、維森斯之家等七處傑作，展現加泰隆尼亞現代主義與自然有機結構的極致融合。',
    spot: '聖家堂、桂爾公園、米拉之家等現場拍下任何一處高第建築外觀或經典細節'
  },
  {
    id: 'u02',
    icon: '🎼',
    name: '加泰隆尼亞音樂宮與聖十字聖保羅醫院',
    en: 'Palau de la Música Catalana and Hospital de Sant Pau',
    year: '1997',
    city: '巴塞隆納',
    desc: '建築大師多明尼克（Lluís Domènech i Montaner）的新藝術雙瑰寶：花磚雕花如夢似幻的音樂宮，以及世界最大、充滿紅磚花園與彩色穹頂的花園醫院。',
    spot: '拍下加泰隆尼亞音樂宮立柱花磚，或聖保羅醫院十字庭院與彩色陶瓷圓頂'
  },
  {
    id: 'u03',
    icon: '🏢',
    name: '勒・柯比意建築作品：光芒之城',
    en: 'The Architectural Work of Le Corbusier (Cité Radieuse)',
    year: '2016',
    city: '馬賽',
    desc: '現代主義建築先驅柯比意的集合住宅里程碑「光芒之城」（Unité d\'Habitation），以粗獷混凝土、彩色陽台與空中街道重塑二戰後的現代都市生活想像。',
    spot: '馬賽城區遠眺或造訪柯比意光芒之城外觀彩色遮陽板'
  },
  {
    id: 'u04',
    icon: '🏛️',
    name: '熱那亞：新街與羅利宮殿體系',
    en: 'Genoa: Le Strade Nuove and the system of the Palazzi dei Rolli',
    year: '2006',
    city: '熱那亞',
    desc: '16 至 17 世紀熱那亞共和國黃金時代的貴族大道（加里波第街），以抽籤招待各國元首名流的「羅利宮殿群」，包括紅宮、白宮與多利亞宮。',
    spot: '在加里波第街（Via Garibaldi）拍下紅宮或白宮壯麗中庭與石雕大門'
  },
  {
    id: 'u05',
    icon: '🍕',
    name: '拿坡里歷史中心',
    en: 'Historic Centre of Naples',
    year: '1995',
    city: '拿坡里',
    desc: '歐洲最大歷史城區之一，保留西元前470年古希臘網格街道與兩千多年的地層疊加，筆直的斯帕卡拿坡里老街橫貫巴洛克教堂與市井煙火。',
    spot: '在斯帕卡老街（Spaccanapoli）或新耶穌教堂廣場拍下喧鬧歷史街景'
  },
  {
    id: 'u06',
    icon: '🌋',
    name: '龐貝、赫庫蘭尼姆及托雷安農齊亞塔考古區',
    en: 'Archaeological Areas of Pompei, Herculaneum and Torre Annunziata',
    year: '1997',
    city: '拿坡里／龐貝',
    desc: '西元 79 年維蘇威火山爆發完整封存的古羅馬繁華城鎮，石板路、熱食店、妓院、公共浴場與壁畫宛如時空膠囊，見證古代文明生動日常。',
    spot: '在龐貝古城拍下海門過街石、公共廣場或熱食店櫃檯'
  },
  {
    id: 'u07',
    icon: '👑',
    name: '阿拉伯-諾曼巴勒摩與蒙雷阿萊大教堂',
    en: 'Arab-Norman Palermo and the Cathedral Churches of Cefalú and Monreale',
    year: '2015',
    city: '巴勒摩',
    desc: '西方諾曼、拜占庭東正教與伊斯蘭阿拉伯文化在西西里島交融的璀璨奇蹟；蒙雷阿萊與帕拉提那禮拜堂內璀璨的純金馬賽克「全能基督」震撼人心。',
    spot: '拍下蒙雷阿萊主教座堂正面或巴勒摩諾曼皇宮金色馬賽克'
  },
  {
    id: 'u08',
    icon: '⚓',
    name: '迦太基考古遺址',
    en: 'Site of Carthage',
    year: '1979',
    city: '突尼斯',
    desc: '漢尼拔統帥的腓尼基海上霸主帝國首都，經歷三次布匿戰爭後被羅馬重建；比爾薩山俯瞰圓形古軍港，安東尼浴場巨大的羅馬石柱臨海而立。',
    spot: '拍下比爾薩山衛城遠眺海灣，或安東尼浴場臨海羅馬巨柱殘垣'
  },
  {
    id: 'u09',
    icon: '🕌',
    name: '突尼斯麥地那老城',
    en: 'Medina of Tunis',
    year: '1979',
    city: '突尼斯',
    desc: '北非保存最完好的伊斯蘭古城之一，以 8 世紀宰圖納大清真寺為核心，放射出數百條迷宮般的蘇克（Souk）香料、地毯與金工手工藝市集。',
    spot: '在突尼斯老城拱形石板巷或彩繪木門前拍下阿拉伯風情'
  },
  {
    id: 'u10',
    icon: '🏰',
    name: '塞維亞大教堂、阿卡薩城堡與西印度群島檔案館',
    en: 'Cathedral, Alcázar and Archivo de Indias in Seville',
    year: '1987',
    city: '塞維亞',
    desc: '世界第三大天主教教堂（哥倫布靈柩所在地）、伊斯蘭尖塔改建的吉拉達鐘樓，以及《冰與火之歌》取景的多雪萊風格穆德哈爾宮殿花園。',
    spot: '拍下吉拉達塔雄姿、塞維亞大教堂飛券或阿卡薩少女中庭'
  },
  {
    id: 'u11',
    icon: '🌺',
    name: '格拉納達：阿爾罕布拉宮、赫內拉利費宮與阿爾拜辛區',
    en: 'Alhambra, Generalife and Albayzín, Granada',
    year: '1984 / 1994 擴展',
    city: '格拉納達',
    desc: '摩爾人統治伊比利半島最後王朝奈斯爾的最高宮殿傑作，獅子庭院細緻石膏透雕、赫內拉利費夏宮噴泉花園，以及阿爾拜辛白色山城。',
    spot: '拍下獅子庭院十二石獅噴泉、香桃木中庭倒影或阿爾罕布拉宮紅堡外觀'
  },
  {
    id: 'u12',
    icon: '🕌',
    name: '哥多華歷史中心（含大清真寺）',
    en: 'Historic Centre of Córdoba',
    year: '1984 / 1994 擴展',
    city: '哥多華',
    desc: '850 根紅白相間雙層馬蹄形拱券的哥多華清真寺-主教座堂，融合伊斯蘭哈里發王朝與文藝復興天主教大教堂，羅馬橋與百花巷環繞其旁。',
    spot: '拍下大清真寺無盡延伸的紅白拱券林，或羅馬橋橫跨瓜達幾維河'
  },
  {
    id: 'u13',
    icon: '💎',
    name: '麥地那・阿扎哈拉花園宮城遺址',
    en: 'Caliphate City of Medina Azahara',
    year: '2018',
    city: '哥多華',
    desc: '西元 10 世紀後倭馬亞王朝阿卜杜拉赫曼三世建造的「光芒之城」，依山而建的三層宮殿階梯與精緻雕花大理石柱，是歐洲最壯觀的伊斯蘭考古遺址。',
    spot: '拍下阿扎哈拉宮城大理石浮雕或哈里發接待大廳拱門遺跡'
  },
  {
    id: 'u14',
    icon: '🌳',
    name: '普拉多大道與麗池公園：藝術與科學景觀',
    en: 'Paseo del Prado and Buen Retiro, a landscape of Arts and Sciences',
    year: '2021',
    city: '馬德里',
    desc: '歐洲第一條啟蒙時代融合藝術、科學與市民休閒的城市綠色林蔭大道，串聯普拉多博物館、皇家植物園與昔日皇家園林麗池公園（水晶宮）。',
    spot: '在普拉多大道林蔭、維拉斯奎茲雕像前或麗池公園人工湖畔拍照'
  },
  {
    id: 'u15',
    icon: '⛪',
    name: '埃斯科里亞爾修道院與王室遺址',
    en: 'Monastery and Site of the El Escorial, Madrid',
    year: '1984',
    city: '馬德里近郊',
    desc: '西班牙帝國「日不落」極盛期國王菲利普二世建造的世界第八大奇蹟，集修道院、宮殿、大教堂與歷代西班牙國王陵寢於一身的嚴謹幾何花崗岩巨作。',
    spot: '遠眺或近拍埃斯科里亞爾雄偉花崗岩四角塔樓'
  },
  {
    id: 'u16',
    icon: '⚔️',
    name: '托雷多歷史名城',
    en: 'Historic City of Toledo',
    year: '1986',
    city: '托雷多',
    desc: '三面環抱太加斯河斷崖之上的兩千年古都，基督徒、穆斯林與猶太人「三種文化」和平共處的縮影；葛雷柯名畫、哥德大教堂與大馬士革金銀絲細工閃爍其中。',
    spot: '在河對岸山丘眺望托雷多全景，或拍下托雷多主教座堂鐘樓'
  },
  {
    id: 'u17',
    icon: '🌉',
    name: '塞哥維亞舊城及其羅馬水道橋',
    en: 'Old Town of Segovia and its Aqueduct',
    year: '1985',
    city: '塞哥維亞',
    desc: '西元 1 世紀不用一滴水泥、以 2 萬多塊花崗岩砌成的雙層高架引水渠（高達 28 公尺），以及迪士尼白雪公主城堡原型塞哥維亞阿卡薩城堡。',
    spot: '在阿索格霍廣場仰拍巨大的雙層羅馬水道橋，或城堡崖壁全景'
  }
];

/* ---------- 30 POKEDEX COLLECTIBLES (旅行大圖鑑) ---------- */
const POKEDEX_ITEMS = [
  { id: 1, icon: '🥓', name: '伊比利大火腿架', desc: '在熟食店或餐廳拍到一整隻帶蹄的黑蹄火腿架。' },
  { id: 2, icon: '🥖', name: '吉拿棒配熱巧克力', desc: '拍一張沾滿濃黑巧克力的金黃吉拿棒。' },
  { id: 3, icon: '🦎', name: '高第彩色馬賽克蜥蜴', desc: '桂爾公園或紀念品店裡的彩色碎瓷蜥蜴（蠑螈）。' },
  { id: 4, icon: '🪵', name: '戴紅帽的 Caga Tió 木頭', desc: '畫著微笑大眼睛、戴著加泰隆尼亞紅帽子的小木頭。' },
  { id: 5, icon: '💩', name: '蹲在角落的大便陶偶 (Caganer)', desc: '聖誕馬槽市集裡蹲著大便的幽默小陶偶。' },
  { id: 6, icon: '🪟', name: '雕花彩色鐵鑄陽台', desc: '老街兩旁裝飾著花草捲紋的黑色或彩繪鐵陽台。' },
  { id: 7, icon: '🚓', name: '西班牙警車或警用機車', desc: '藍白或綠白相間、寫著 Policía 的酷炫警車。' },
  { id: 8, icon: '🕊️', name: '地中海港口飛翔海鷗', desc: '在港邊、郵輪欄杆上站著或空中滑翔的大海鷗。' },
  { id: 9, icon: '🏛️', name: '塞哥維亞羅馬水道橋', desc: '不用水泥砌成的雙層古羅馬花崗岩高大拱門。' },
  { id: 10, icon: '🏰', name: '阿爾卡薩迪士尼城堡', desc: '像一艘船艦般航行在懸崖上的尖塔童話城堡。' },
  { id: 11, icon: '⚔️', name: '托雷多大馬士革金絲鋼劍', desc: '店裡閃閃發光、鑲嵌細緻金線花紋的精工寶劍。' },
  { id: 12, icon: '🥘', name: '巨大的西班牙海鮮燉飯鍋', desc: '大大的雙耳平底平鍋，盛裝著金黃番紅花米飯。' },
  { id: 13, icon: '🍳', name: '厚切西班牙馬鈴薯烘蛋', desc: '酒吧吧台上切得方方正正、金黃誘人的厚烘蛋。' },
  { id: 14, icon: '🍊', name: '街邊結滿果實的橘子樹', desc: '綠葉間掛滿一顆顆橙黃色果實的安達魯西亞街樹。' },
  { id: 15, icon: '💃', name: '佛朗明哥紅黑荷葉大長裙', desc: '店櫥窗裡或舞者身上層層疊疊的波浪荷葉裙。' },
  { id: 16, icon: '🍷', name: '赫雷斯雪莉酒老橡木桶', desc: '酒吧角落刻有白色手寫字樣的大酒桶。' },
  { id: 17, icon: '🏺', name: '安達魯西亞彩繪幾何磁磚', desc: '牆面上繪有藍綠黃三色繁複花紋的西班牙磁磚。' },
  { id: 18, icon: '⛰️', name: '瓜迪斯白色煙囪窯洞屋', desc: '從山坡土丘裡鑽出來的一支支雪白圓形煙囪。' },
  { id: 19, icon: '🏰', name: '阿爾罕布拉宮幾何馬蹄拱', desc: '精緻得像蕾絲花邊一樣的伊斯蘭石膏雕刻拱門。' },
  { id: 20, icon: '🏛️', name: '哥多華清真寺紅白雙層石拱', desc: '像森林一樣綿延不絕的紅磚與白石交替拱門。' },
  { id: 21, icon: '🍇', name: '跨年夜 12 顆青葡萄罐或盤', desc: '超市賣的小罐裝 12 顆開運葡萄或大家分好的盤子。' },
  { id: 22, icon: '👑', name: '圓圈形三王節國王蛋糕', desc: '點綴著紅綠糖漬水果乾的大花環蛋糕與紙皇冠。' },
  { id: 23, icon: '🍬', name: '三王節遊行搶到的彩色糖果', desc: '從遊行花車上空如雨般落下的各色包裝糖果。' },
  { id: 24, icon: '🐻', name: '馬德里抱野草莓樹的黑熊雕像', desc: '太陽門廣場上站著啃草莓樹的青銅小黑熊。' },
  { id: 25, icon: '🎨', name: '普拉多博物館前的宮廷畫家雕像', desc: '拿著調色盤和畫筆坐在普拉多大門前的古典雕像。' },
  { id: 26, icon: '☕', name: '百年老咖啡館紅色戶外雨棚', desc: '路邊擺著藤椅、搭著復古紅色雨棚的戶外露天座。' },
  { id: 27, icon: '🚋', name: '馬德里老地鐵紅白菱形站牌', desc: '街角入口處寫著 METRO 的經典紅白藍菱形立牌。' },
  { id: 28, icon: '🌰', name: '街頭煙霧繚繞的熱烤栗子攤', desc: '冒著白煙、飄著炭烤焦香的冬天路邊小火爐。' },
  { id: 29, icon: '🚢', name: '地中海郵輪甲板的落日海平線', desc: '站在大船甲板上，看著金紅色夕陽慢慢沈入大海。' },
  { id: 30, icon: '👨‍👩‍👧‍👦', name: '7 個人全員到齊的燦爛笑容', desc: '我們全家人在西班牙旅途中的大合照！' }
];

/* ---------- AIRPORTS DATA (四大國際機場手帳：建築、總體經濟與文化觀察) ---------- */
const AIRPORTS_DATA = [
  {
    id: 'tpe',
    code: 'TPE',
    name: '臺灣桃園國際機場',
    nameEn: 'Taiwan Taoyuan International Airport',
    flag: '🇹🇼',
    terminal: '第一航廈 / 第二航廈 / 第三航廈北登機廊廳',
    role: '啟程出發站（2026/12/08–12/09）',
    theme: '候機門文化主題巡禮與啟程大合照',
    lore: `
      <p>桃園機場在 1979 年啟用，當年叫「中正國際機場」，是為了取代已經太擠的臺北松山機場而新蓋的國際機場；2006 年改成現在的名字。到 2024 年，它一年接待約 4,470 萬名國際旅客，在國際機場協會（ACI）的統計裡排全球第 13；航空貨運量約 227 萬公噸，排全球第 10。</p>
      <p>為什麼一個不算大的島，貨運量能排進世界前十？因為臺灣做的晶片、伺服器和電子零件又小又貴，客人又等不及，很多都是坐飛機出國的。我們出發這天，腳下這座機場也正忙著把「臺灣製造」送到全世界。</p>
      <p>機場這幾年也在長大。英國建築師事務所 RSHP 設計的第三航廈，北登機廊廳在 2025 年 12 月開始試營運，整座航廈預計 2027 年底完工。有趣的是，RSHP 就是理察・羅傑斯創辦的事務所；我們 1 月 6 日回家時，會在馬德里 T4 航廈看到他們另一件得獎作品：波浪竹天花板和彩虹色鋼柱。一趟旅程，從同一家建築師的作品出發，也在他們的作品裡回家。</p>
      <p>候機的時候別只滑手機。第二航廈有幾個用心的主題角落：木頭森林、回收玻璃做成的藍色水池、布袋戲展區，還有喝茶的空間。這些臺灣手藝，在接下來的 30 天裡，都會在西班牙和地中海遇到它們的「遠房親戚」。下面幫大家整理好了，先記在心裡，到了當地再去找找看。</p>
    `,
    architecture: `
      <b>🧭 工藝尋寶地圖：臺灣手藝 ↔ 旅途上的遠房親戚</b>
      <ul class="craft-map">
        <li><b>剪黏 ↔ 碎磚拼貼（trencadís）</b>：廟頂的龍鳳是用剪成小片的彩色瓷碗黏出來的；高第在桂爾公園用打碎的磁磚貼滿彎曲的長椅和蜥蜴。到了<b>桂爾公園</b>，找找看哪一片碎磁磚上還看得到原本的花紋。</li>
        <li><b>竹編 ↔ 西班牙草編（esparto）</b>：臺灣用竹子編籃子，西班牙南部則用一種很韌的野草「埃斯帕托草」編籃子、草鞋和地墊，已經有幾千年歷史。在<b>塞維亞、哥多華</b>的市場和雜貨店常看得到，突尼斯的市集也有類似的草編籃。</li>
        <li><b>金工 ↔ 哥多華銀絲細工（filigrana）</b>：師傅把銀拉成比頭髮粗一點的細絲，再一圈一圈盤成花朵和蕾絲般的圖案。在<b>哥多華</b>老城區的銀飾店可以近看，比照片細緻很多。</li>
        <li><b>木工 ↔ 格拉納達鑲嵌木工（taracea）</b>：用不同顏色的木片和骨片拼出星星般的幾何圖案，是從摩爾人時代傳下來的手藝。<b>阿爾罕布拉宮</b>大廳的木頭天花板也是用幾何木作拼成的，記得抬頭看。</li>
        <li><b>陶瓷 ↔ 塞維亞瓷磚（azulejo）與突尼西亞彩陶</b>：塞維亞的特里亞納區做彩繪瓷磚已經好幾百年，<b>西班牙廣場</b>的長椅就用瓷磚畫出西班牙各省；<b>突尼斯</b>的市集則可以看到藍白、黃綠色的手繪陶盤。</li>
        <li><b>偶戲 ↔ 西西里騎士偶戲（Opera dei Pupi）</b>：見下方 D7 布袋戲的說明，<b>巴勒摩</b>是重點。</li>
        <li><b>光雕 ↔ 聖家堂的彩色玻璃</b>：機場用燈光說故事，高第用太陽。<b>聖家堂</b>東側的玻璃偏藍綠、西側偏橘紅，早上和傍晚進去，教堂會是兩種顏色。</li>
      </ul>
    `,
    gates: [
      { id: 'C1', name: 'C1 木育森林候機室', desc: '實木桌椅、石虎與臺灣黑熊等特有動物，還有可以彈的鋼琴（第二航廈）', link: '木頭手藝的遠房親戚在格拉納達：鑲嵌木工（taracea）用彩色木片拼出星星圖案；到阿爾罕布拉宮記得抬頭看木頭天花板。' },
      { id: 'C2', name: 'C2 Hello Kitty 候機室', desc: '粉紅色候機室，有公車站牌和三麗鷗角色（第二航廈）', link: '喜歡可愛小人偶？12 月的馬賽舊港有「santons 市集」，賣普羅旺斯的手捏黏土小人偶；那不勒斯的聖額我略街整條都是做耶誕馬槽人偶的工坊。' },
      { id: 'C5', name: 'C5–C6 森林遊戲區', desc: '森林主題的自然藝術休憩區（第二航廈 3 樓）', link: '大自然變成建築：桂爾公園的石柱長得像樹幹、聖家堂裡的柱子會像樹枝一樣分岔，高第說他的老師是大自然。' },
      { id: 'C10', name: 'C10-1 春池琉璃藍色玻璃池', desc: '用回收玻璃做成、可以走上去的藍色「水池」（第二航廈）', link: '回收再利用的老前輩是高第：桂爾公園的碎磚拼貼用了很多磁磚工廠的瑕疵品和破瓶子。聖家堂的彩色玻璃則會讓陽光在牆上畫畫。' },
      { id: 'D7', name: 'D7 霹靂布袋戲展區', desc: '經典戲偶與戲服展示，還能用 AI 做出自己的角色照（第二航廈，2026 年 10 月新登場）', link: '西西里也有自己的「布袋戲」：巴勒摩的騎士偶戲（Opera dei Pupi）用穿金屬盔甲的木偶演查理曼騎士的故事，已被列為聯合國人類非物質文化遺產；那不勒斯則有戴黑面具的白衣小丑 Pulcinella。' },
      { id: 'DTEA', name: 'D 區 臺灣好茶區', desc: '以臺灣茶為主題的休息空間（第二航廈）', link: '突尼斯人愛喝很甜的薄荷茶，有時還會在杯裡放松子；格拉納達老城的小巷裡也有一整排摩洛哥風格的茶館。比比看哪裡的茶最對味。' },
      { id: 'D11', name: 'D11–D18 第三航廈北登機廊廳', desc: 'RSHP 設計、2025 年 12 月開始使用的新廊廳，從 D10 走過去', link: '同一家建築師事務所（理察・羅傑斯創辦的 RSHP）也設計了馬德里機場 T4。回家那天，比比看兩座航廈哪裡像。' },
    ]
  },
  {
    id: 'dxb',
    code: 'DXB',
    name: '阿拉伯聯合大公國 杜拜國際機場',
    nameEn: 'Dubai International Airport',
    flag: '🇦🇪',
    terminal: '第三航廈 (Terminal 3)',
    role: '跨洲樞紐轉機站',
    theme: '沙漠超級方舟與 24 小時不夜城世界十字路口',
    lore: `
      <p>我們轉機的杜拜機場第三航廈（Terminal 3）在 2008 年 10 月啟用，由法國巴黎機場集團的工程設計公司（ADPi）設計，是阿聯酋航空專用的航廈。它的樓地板面積約 171 萬平方公尺，啟用時被稱為<b>全世界樓地板面積最大的建築</b>（後來被中國成都的環球中心超越）。航廈有一大部分蓋在滑行道底下，出境和入境大廳位在停機坪下方約 10 公尺，所以走著走著，頭頂上可能正有飛機滑過。</p>

      <p>為什麼沙漠裡會長出這麼大的機場？杜拜的石油其實不多，只占阿聯石油儲量的一小部分，統治家族很早就決定改走貿易、觀光和航空這條路。航空業常說：從波斯灣起飛，8 小時航程內住著全世界大約三分之二的人口。杜拜扶植阿聯酋航空，把全世界的航線像腳踏車輪的輻條一樣接到這裡（航空業叫「軸輻式航網」），很多旅客根本不出機場，只是在這裡換飛機，也讓這座城市賺進大把鈔票。我們也是其中之一。</p>

      <p>法國人類學家馬克・歐傑（Marc Augé）在 1992 年提出「非地方」（non-place）的說法：機場、高速公路、大賣場這類地方，人人只是路過，很難對它產生「家」的感覺。半夜的杜拜機場正是這樣：各種語言的廣播、金光閃閃的免稅店、來自南亞和非洲的工作人員，每個擦身而過的人都要去地球的不同角落。旅行作家皮科・艾爾則認為，機場最能看出一個地方的個性，因為它同時是城市的名片和握手<sup>[註1]</sup>；英國小說家巴拉德甚至猜想，機場會是 21 世紀真正的城市<sup>[註2]</sup>。轉機的空檔，不妨想想：你覺得這裡像一座城市嗎？</p>

      <div style="margin-top:16px;padding:12px 14px;background:var(--sunken);border-radius:var(--r-sm);border:1px solid var(--line);font-size:13.5px;line-height:1.6;color:var(--muted)">
        <b style="color:var(--fg)">📝 出處：</b><br>
        • <sup>[註1]</sup> 皮科・艾爾（Pico Iyer），《全球靈魂》（<i>The Global Soul: Jet Lag, Shopping Malls, and the Search for Home</i>，2000）。原句大意：機場很能說明一個地方，因為它既是城市的名片，也是它的握手。<br>
        • <sup>[註2]</sup> J. G. 巴拉德（J. G. Ballard），〈機場：21 世紀真正的城市〉（<i>Airports: The True Cities of the 21st Century</i>），《Blueprint》雜誌，1997 年 9 月。原句大意：我猜機場會是 21 世紀真正的城市。
      </div>
    `,
    architecture: ''
  },
  {
    id: 'bcn',
    code: 'BCN',
    name: '西班牙 巴塞隆納埃爾普拉特機場',
    nameEn: 'Josep Tarradellas Barcelona-El Prat Airport',
    flag: '🇪🇸',
    terminal: '第一航廈 (Terminal 1 - T1)',
    role: '歐洲抵達站（2026/12/09 抵達）',
    theme: '波菲的純白花崗岩天光聖殿與加泰隆尼亞門戶',
    lore: `
      <p>漫步走出 BCN T1 航廈的那一刻，撲面而來的是澄澈明朗的陽光與清爽的地中海空氣。這座於 2009 年落成的現代化航廈，背後隱含著加泰隆尼亞自治區與西班牙中央政府數十年來的政治經濟角力。巴塞隆納商界與自治政府長年積極爭取機場獨立管理權，渴望跳過馬德里中轉，直接開闢直飛亞洲與美洲的洲際航線，以鞏固巴塞隆納作為南歐生物醫藥、數位設計與科技新創中心的野心；然而中央 Aena（西班牙國營機場管理局）則傾向將長途跨大西洋樞紐鎖定在馬德里，將巴塞隆納定位為歐洲廉航點對點與地中海客運門戶。因此，T1 航廈不僅是交通設施，更是加泰隆尼亞人向世界展現文化品格與自主雄心的象徵之門。</p>

      <p><b>🚩 加泰隆尼亞的文化尊嚴密碼：</b><br>
      為什麼巴塞隆納的自我認同如此深厚？中世紀時，加泰隆尼亞曾是稱霸地中海的海上強權，擁有比馬德里更早成熟的民主議會與海洋法典；1714 年 9 月 11 日主權遭波旁軍隊奪走後，他們將戰敗日訂為民族節（La Diada），用三百年的抗爭將「語言即祖國」刻入骨髓。這份傲骨在機場隨處可見：機場正式名稱以流亡 40 年歸來的自治政府主席「何塞普·塔拉德利亞斯」命名；航廈所有指標第一順位永遠是加泰隆尼亞語，其次才是西班牙語；建築大師波菲更刻意摒棄馬德里式的厚重宮廷感，用通透的白瓷與純淨天光，向世界宣告這是一座向海而生、熱愛自由的古老民族。</p>

    `,
    architecture: `
      <b>🏛️ 建築與空間特色：</b>
      T1 航廈由加泰隆尼亞後現代主義傳奇建築大師里卡多·波菲（Ricardo Bofill）親手設計。航廈輪廓自空中鳥瞰宛如一柄筆直指向地中海的「巨劍（La Espada）」或一隻優雅展翅的大白鷹。波菲刻意捨棄傳統機場常見的低矮壓抑通道，以長達 500 公尺的巨大拱形中庭「La Plaza」貫穿核心；室內地面全面鋪設高反光純白拋光花崗岩地磚，搭配通透的雙層超白低輻射玻璃帷幕。地中海清澈熾烈的自然光線自天花板幾何天窗與四壁傾瀉而下，光線在白色花崗岩上柔和漫射，營造出如希臘古神廟般聖潔、開闊而明亮的非凡空間感。
    `
  },
  {
    id: 'mad',
    code: 'MAD',
    name: '西班牙 馬德里巴拉哈斯機場',
    nameEn: 'Adolfo Suárez Madrid-Barajas Airport',
    flag: '🇪🇸',
    terminal: '第四航廈 (Terminal 4 / T4S)',
    role: '離境返台站（2027/01/06 賦歸）',
    theme: '理察·羅傑斯的波浪竹林天幕與彩虹鋼樹森林',
    lore: `
      <p>MAD T4 航廈誕生於西班牙加入歐元區後的黃金年代（2000–2006）。當時西班牙經歷了近代史上最迅猛的基礎建設狂潮，全國高鐵（AVE）路網與這座世界級航空樞紐相繼拔地而起，西班牙藉此向世界宣告其脫離過往專制與封閉、自信躋身現代歐洲核心大國的決心。這座航廈每年吞吐逾七千萬人次，是連通歐洲與拉丁美洲最重要的歷史與語言空中橋樑。</p>
      <p>普立茲克建築獎得主理察·羅傑斯將高科技建築（High-Tech Architecture）融入了深刻的人性關懷：他認為機場通常充滿了離別的不安、安檢的繁複與長途跋涉的疲倦，因此建築師的使命是用「空間的流動感與溫暖質感」來安撫人的心靈。當你準備告別西班牙、抬頭仰望起伏的波浪竹頂與溫暖的彩虹光譜時，離別不再只是倉促的告別，而是一段優雅而平靜的歸途序曲。</p>
    `,
    architecture: `
      <b>🏛️ 建築與空間特色：</b>
      T4 航廈由英國高科技建築巨匠理察·羅傑斯（Richard Rogers，龐畢度中心與千禧巨蛋建築師）與西班牙建築師安東尼奧·拉梅拉（Antonio Lamela）聯手打造，2006年落成時便毫無懸念奪得英國皇家建築師學會最高榮譽「史特林建築獎（Stirling Prize）」。航廈最令人屏息的是長達 1.2 公里的波浪起伏天花板，由超過 20 萬平方公尺的純天然可持續毛竹板條精密鋪設，視覺如同風吹起伏的金色麥浪，並具備優異的天然吸音功能；支撐天頂的「雙叉鋼樹柱」塗有精心設計的彩虹色譜——由西側的明黃、金黃逐漸漸變至橘紅、品紅，再過渡為蔚藍與深翠綠，成為世界上最直覺、最具美感的航廈色彩導航系統；中央深邃的挑空「峽谷（Canyons）」天井將高原明亮陽光引導直穿三層樓板，讓地下層的行李轉盤亦沐浴在日光之中。
    `
  }
];

/* ---------- MUSEUM MASTERPIECES (各間博物館與古蹟鎮館之寶清單與展廳) ---------- */
const MUSEUM_MASTERPIECES = {
  'madrid-s3': [
    {
      id: 'prado-1',
      titleZh: '《宮娥》',
      titleEs: 'Las Meninas',
      artist: '委拉斯奎茲 (Diego Velázquez)',
      sala: 'Sala 12 (普拉多核心中殿)',
      desc: '西方繪畫史上最具魔力的自反性視角！畫家本人正站在巨大畫布前直視著我們（觀者），背景小鏡子映出西班牙國王腓力四世與王后；小公主瑪格麗特立於中央，被宮女、侏儒與忠犬環繞。這幅畫打破了傳統畫布的界線，讓觀看者瞬間擁有了「國王與王后的視角」。'
    },
    {
      id: 'prado-2',
      titleZh: '《1808年5月3日的馬德里槍殺》',
      titleEs: 'El 3 de mayo en Madrid',
      artist: '哥雅 (Francisco Goya)',
      sala: 'Sala 64',
      desc: '現代政治批判與反戰繪畫的開山之作。拿破崙佔領軍行刑隊如同一架冰冷無情的殺人機器背對觀眾，而地上的一盞四方地燈將刺目白光投射在一位穿白襯衫的起義市民身上。他高張雙臂如同受難的基督，眼神燃燒著憤怒與絕望。'
    },
    {
      id: 'prado-3',
      titleZh: '《農神吞噬其子》',
      titleEs: 'Saturno devorando a su hijo',
      artist: '哥雅 (Francisco Goya)',
      sala: 'Sala 67 (黑色繪畫展廳)',
      desc: '哥雅晚年因嚴重耳聾與政治幻滅隱居馬德里郊外「聾人屋」，在自家客廳牆上親手繪製的 14 幅「黑色繪畫」中最震撼的一幅。時間之神農神雙目暴突、狂亂撕咬著自己親生孩子的身軀，象徵時間吞噬一切與專制暴政的殘酷。'
    },
    {
      id: 'prado-4',
      titleZh: '《人間樂園》',
      titleEs: 'El jardín de las delicias',
      artist: '波希 (Hieronymus Bosch)',
      sala: 'Sala 56A',
      desc: '北方文藝復興超現實三聯畫極品。左翼為伊甸園與奇幻動植物；中央大畫描繪成百上千赤身裸體的人類在巨型草莓、漿果與透明水泡中放縱肉慾；右翼則是荒誕可怖的音樂地獄，罪人被巨型樂器折磨、鳥頭惡魔將人吞下並排入糞坑。每一平方公分都蘊含驚人細節。'
    },
    {
      id: 'prado-5',
      titleZh: '《下十字架》',
      titleEs: 'El descendimiento de la cruz',
      artist: '魏登 (Rogier van der Weyden)',
      sala: 'Sala 58',
      desc: '法蘭德斯繪畫的情感顛峰。畫家將十位等身人物壓縮在猶如金色木雕神龕的淺層空間中，耶穌垂下的蒼白軀體與聖母瑪利亞昏厥倒地的身形，呈現精準平行的優美折線。畫中人物眼角晶瑩透明的淚珠與天鵝絨布紋極度寫實。'
    },
    {
      id: 'prado-6',
      titleZh: '《手撫胸膛的騎士》',
      titleEs: 'El caballero de la mano en el pecho',
      artist: '葛雷柯 (El Greco)',
      sala: 'Sala 8B',
      desc: '西班牙黃金時代紳士名譽與虔誠信仰的永恆化身。黑衣騎士胸前佩戴細緻白色褶領，右手修長指尖輕觸心口，眼神清澈深邃，彷彿在天主與國王面前許下永恆的騎士忠誠誓言。'
    },
    {
      id: 'prado-7',
      titleZh: '《米爾伯格的查理五世騎馬像》',
      titleEs: 'Carlos V en Mühlberg',
      artist: '提香 (Tiziano)',
      sala: 'Sala 27',
      desc: '開創「日不落帝國」的神聖羅馬帝國皇帝查理五世戰勝新教聯盟後的紀念肖像。提香以夕陽暗紅與金屬反光交織的沉著色調，將皇帝塑造成孤獨沈穩的「基督教騎士帝王」，其身上的鍛鋼戰甲至今仍珍藏於馬德里王宮皇家軍械庫！'
    },
    {
      id: 'prado-8',
      titleZh: '《受胎告知》',
      titleEs: 'La Anunciación',
      artist: '安吉利柯修士 (Fra Angelico)',
      sala: 'Sala 56B',
      desc: '義大利文藝復興早期最純淨的光明之作。大天使加百列身披飾有金星的粉紅長袍，向坐在精緻透視涼廊下的瑪利亞傳遞受胎喜訊；涼廊左側則是亞當夏娃被逐出伊甸園，象徵基督的降生將救贖人類的原罪。'
    }
  ],
  'madrid-s4': [
    {
      id: 'reina-1',
      titleZh: '《格爾尼卡》',
      titleEs: 'Guernica',
      artist: '畢卡索 (Pablo Picasso)',
      sala: 'Sala 205.10 (或 206 號主展廳)',
      desc: '20 世紀反戰藝術的最高神聖圖騰。1937年納粹空軍狂轟濫炸巴斯克無辜古鎮格爾尼卡，畢卡索在巴黎憤而創作這幅長達 7.7 公尺、寬 3.5 公尺的黑白巨幅油畫。仰天悲號的母親懷抱死嬰、被長矛穿透痛苦哀嘶的戰馬、狂怒的公牛與孤懸如炸彈的電燈泡，以立體主義裂解形式凝固了人類苦難。'
    },
    {
      id: 'reina-2',
      titleZh: '《大自慰者》',
      titleEs: 'El gran masturbador',
      artist: '達利 (Salvador Dalí)',
      sala: 'Sala 205.13',
      desc: '達利超現實主義的心理自畫像。畫面中央巨大的蠟黃軟化人形側臉緊貼大地，長睫毛緊閉；下巴攀爬著達利自幼極度恐懼的蝗蟲，腹部還爬滿象徵腐朽的黑蟻。上方浮現愛人卡拉的頭像，混合著對性的恐懼、迷戀與弗洛伊德精神分析。'
    },
    {
      id: 'reina-3',
      titleZh: '《窗邊的少女》',
      titleEs: 'Figura en una ventana',
      artist: '達利 (Salvador Dalí)',
      sala: 'Sala 205.14',
      desc: '達利 21 歲年輕時的經典具象代表作，畫中模特兒是他的親妹妹安娜·瑪麗亞。少女倚在卡達克斯臨海的窗櫺前，背對觀者凝視窗外靜謐深邃的地中海微波與遠山。柔和的藍白光影與裙褶布紋，流露出古典主義與維梅爾式的寧靜詩意。'
    },
    {
      id: 'reina-4',
      titleZh: '《蝸牛、女人、花與星星》',
      titleEs: 'Caracol, mujer, flor, estrella',
      artist: '米羅 (Joan Miró)',
      sala: 'Sala 206.03',
      desc: '加泰隆尼亞超現實大師米羅的符號魔法。米羅將大自然簡化為純淨的原色斑塊、黑色墨線、星芒與生物有機體。米羅說：「我追求的是一種純粹的詩意，讓畫布上的星星像音樂一樣呼吸。」'
    }
  ],
  'madrid-s8': [
    {
      id: 'man-1',
      titleZh: '《埃爾切夫人》',
      titleEs: 'Dama de Elche',
      artist: '古代伊比利雕刻家（西元前 4 世紀）',
      sala: 'Sala 13 (伊比利文化廳)',
      desc: '西元前 4 世紀伊比利本土半島文明的永恆瑰寶。這座石灰石半身像頭戴極其繁複對稱的巨大車輪形空心髮髻（Rodetes），胸前垂掛三串精緻項鍊與護身符。背面有一個直徑 18 公分平整凹槽，推測是一座兼具貴族骨灰甕或大地女神化身的祭祀神像。'
    },
    {
      id: 'man-2',
      titleZh: '《瓜拉薩爾寶藏之雷卡斯溫特許願王冠》',
      titleEs: 'Corona votiva de Recesvinto (Tesoro de Guarrazar)',
      artist: '西哥德宮廷金匠（西元 7 世紀）',
      sala: 'Sala 23 (西哥德文化廳)',
      desc: '7 世紀西哥德王國定都托雷多時期的國寶級金工顛峰。純金打造的懸吊式許願王冠，運用極致掐絲工藝鑲嵌打磨透光的紅石榴石與藍寶石，王冠下緣垂吊著 22 個純金拉丁字母「RECCESVINTHVS REX OFFERET」（雷卡斯溫特國王奉獻），在光線映照下如燃燒的火炬。'
    },
    {
      id: 'man-3',
      titleZh: '《阿爾塔米拉萬年史前洞窟壁畫（等身復刻窟）》',
      titleEs: 'Cueva de Altamira (Reproducción)',
      artist: '舊石器時代史前獵人（約 15,000 年前）',
      sala: 'Sala Subterránea (地下特展廳)',
      desc: '距今約 15,000 年的舊石器時代晚期遺產，被譽為「史前西斯汀禮拜堂」。史前獵人巧妙利用天然岩石凸起的肌肉紋理，以木炭與紅赭石礦物顏料繪製出栩栩如生的多色野牛、奔馬與母鹿，生動呈現野牛蜷伏、蓄力衝撞的狂野生命力。'
    },
    {
      id: 'man-4',
      titleZh: '《薩莫拉象牙圓盒》',
      titleEs: 'Bote de Zamora',
      artist: '哥多華哈里發宮廷象牙大師（西元 964 年）',
      sala: 'Sala 26 (伊斯蘭與安達魯斯文化廳)',
      desc: '西元 964 年西班牙哥多華倭馬亞哈里發王朝為哈里發寵妃蘇布（Subh）定制的象牙微雕珍寶。整塊整根天然象牙圓筒雕刻著繁複的藤蔓花紋、孔雀、羚羊與古庫法體阿拉伯銘文，是安達魯斯伊斯蘭宮廷微雕工藝的無上傑作。'
    }
  ],
  'madrid-s2': [
    {
      id: 'palacio-1',
      titleZh: '《寶座廳天頂畫：西班牙君主榮光》',
      titleEs: 'Salón del Trono - Techo de Tiepolo',
      artist: '提埃坡羅 (Giambattista Tiepolo)',
      sala: 'Salón del Trono (寶座廳)',
      desc: '威尼斯洛可可最後大師提埃坡羅受西班牙國王卡洛斯三世邀請所繪的史詩天頂壁畫。畫面烘托出西班牙君主制在美洲、歐洲、非洲與亞洲四大洲的威儀，廳內兩張鍍金雄獅護衛的深紅天鵝絨寶座更見證了自哈布斯堡至波旁王朝的興衰。'
    },
    {
      id: 'palacio-2',
      titleZh: '《皇家軍械庫：查理五世與腓力二世戰甲》',
      titleEs: 'Real Armería de Madrid',
      artist: '文藝復興頂級鍛鋼盔甲大師',
      sala: 'Ala de la Real Armería (皇家軍械庫展翼)',
      desc: '與維也納皇家軍械庫齊名、全球現存最華麗完備的文藝復興宮廷鍛鋼軍械庫。展出查理五世騎馬閱兵時穿戴的全套金銀蝕刻雕花板甲、以及腓力二世的童年精鋼盔甲與奧斯曼帝國繳獲的華麗馬具。'
    },
    {
      id: 'palacio-3',
      titleZh: '《大宴會廳與史特拉底瓦里皇家四重奏提琴》',
      titleEs: 'Comedor de Gala y Cuarteto Palatino',
      artist: '史特拉底瓦里 (Antonio Stradivari)',
      sala: 'Comedor de Gala & Capilla Real',
      desc: '可同時容納 140 位貴賓入席的長達 40 公尺國宴大廳，頭頂懸掛 15 盞巨型水晶吊燈；王宮更典藏全球絕無僅有、完整保存的一套由製琴宗師史特拉底瓦里親手打造的「皇家四重奏」弦樂器。'
    }
  ],
  'madrid-s6': [
    {
      id: 'toledo-1',
      titleZh: '《奧爾加斯伯爵的葬禮》',
      titleEs: 'El entierro del Conde de Orgaz',
      artist: '葛雷柯 (El Greco)',
      sala: 'Iglesia de Santo Tomé (聖多美教堂聖母受胎禮拜堂)',
      desc: '西班牙文藝復興最偉大的祭壇畫。畫面上方是葛雷柯特有的冷色調拉長形體天國，基督與聖母準備迎接伯爵靈魂；下方則是莊嚴肅穆的人間葬禮，聖史蒂芬與聖奧古斯丁奇蹟般降臨親自為善施的伯爵下葬，身後一整排身穿黑袍配白色褶領的托雷多名流（葛雷柯本人與小兒子亦隱身其中）。'
    },
    {
      id: 'toledo-2',
      titleZh: '《托雷多大教堂：阿爾費純金銀聖體顯聖容架》',
      titleEs: 'Custodia procesional de Enrique de Arfe',
      artist: '恩里克·德·阿爾費 (Enrique de Arfe)',
      sala: 'Catedral de Toledo - Sala del Tesoro (珍寶館)',
      desc: '高達 3 公尺、重達 200 公斤的哥德式微縮大教堂純金銀聖體聖血架。使用超過 18 公斤純金與 183 公斤純銀，據傳其中所用的第一批純金來自哥倫布自新大陸帶回獻給伊莎貝拉女王的貢金。'
    },
    {
      id: 'toledo-3',
      titleZh: '《托雷多大教堂：大理石奇蹟透光天井透鏡》',
      titleEs: 'El Transparente',
      artist: '納西索·托梅 (Narciso Tomé)',
      sala: 'Catedral de Toledo - Girola (主祭壇後方環形迴廊)',
      desc: '巴洛克雕刻大師在哥德式昏暗教堂後殿開鑿天井引入自然天光的鬼斧神工之作。彩色大理石、純金飛瀑與雲朵中探出身軀的天使雕像與透天光束完美融合，創造出令人屏息的神聖視覺奇蹟。'
    }
  ],
  'barcelona-s1': [
    {
      id: 'sagrada-1',
      titleZh: '《誕生立面》',
      titleEs: 'Fachada del Nacimiento',
      artist: '安東尼·高第 (Antoni Gaudí)',
      sala: '東側誕生立面（高第生前親自監督完成，UNESCO 世界遺產）',
      desc: '如同大自然植物與岩石自由生長出的石雕森林。細細尋找生命之樹綠柏樹、聖家避難埃及、彈奏各式樂器的加泰隆尼亞天使合唱團，甚至有在地的蝸牛、青蛙、雞冠花與常春藤，象徵萬物對救世主降生的歡欣敬拜。'
    },
    {
      id: 'sagrada-2',
      titleZh: '《受難立面》',
      titleEs: 'Fachada de la Pasión',
      artist: '蘇比拉克 (Josep Maria Subirachs)',
      sala: '西側受難立面',
      desc: '與誕生立面的圓融繁複形成鮮明對比，蘇比拉克以稜角如斧劈般剛烈冰冷的幾何骨感雕像，刻畫最後晚餐、彼得三次不認主與基督受刑。立面上嵌有一座 4x4 的「神秘幻方」，無論橫、豎、對角加總皆為耶穌受難年齡「33」。'
    },
    {
      id: 'sagrada-3',
      titleZh: '《雙曲面雙螺旋樹狀巨柱與森林光廊》',
      titleEs: 'Bosque de columnas e hiperboloides',
      artist: '安東尼·高第 (Antoni Gaudí)',
      sala: '聖堂中殿核心',
      desc: '高第發明的自然結構柱，柱腳為多角形，向上旋轉分岔為八角與圓形樹枝，支撐雙曲面拋物線天頂；上午東側透過藍色與綠色冷調彩繪花窗灑落晨曦，下午西側透過橘色、紅色與金黃色暖調花窗傾瀉夕陽，整座教堂內部就是一座光影流轉的神聖自然森林。'
    }
  ],
  'barcelona-s3': [
    {
      id: 'santpau-1',
      titleZh: '《行政大樓粉紅玫瑰彩繪玻璃與馬賽克穹頂》',
      titleEs: 'Cúpula y Vitrales del Pabellón de la Administración',
      artist: '蒙塔內爾 (Lluís Domènech i Montaner)',
      sala: '主入口行政大樓二樓大廳',
      desc: '行政大樓核心的雙曲面穹頂大廳，以柔和粉紅與金色花磚拼貼出壯麗的哥德式拱肋。頭頂巨幅「光之花」彩繪玻璃天窗傾瀉漫射日光，象徵現代醫學驅散黑暗與疾病，美得如同歐洲皇家宮殿。'
    },
    {
      id: 'santpau-2',
      titleZh: '《地下白色瓷磚秘密醫療隧道長廊》',
      titleEs: 'Galerías y Túneles Subterráneos',
      artist: '蒙塔內爾 (Lluís Domènech i Montaner)',
      sala: '全區地下隧道系統（長逾 1 公里）',
      desc: '全歐洲最早開創的地下分流通道！整座園區的地上花園專供病人散步休養，而推床、藥品與遺體運送全數移至鋪滿白瓷磚的地下隧道，杜絕交叉感染，讓地面絲毫不帶一絲醫院的死亡與冰冷氣息。'
    },
    {
      id: 'santpau-3',
      titleZh: '《聖薩爾瓦多展廳陶瓷彩磚圓頂與天使雕像》',
      titleEs: 'Pabellón de San Salvador',
      artist: '蒙塔內爾 & 保·加爾加略 (Pau Gargallo)',
      sala: '入口右側聖薩爾瓦多展廳',
      desc: '屋頂覆蓋著鮮豔童話般的金黃與草綠釉面彩磚圓頂，外牆矗立著加泰隆尼亞雕刻巨擘保·加爾加略雕刻的守護天使；內部完整保留了百年前「無直角防積灰塵」的圓弧天花板與現代消毒科學細節。'
    },
    {
      id: 'santpau-4',
      titleZh: '《吉爾家族哥德字母「P」與加泰隆尼亞令旗》',
      titleEs: 'Emblemas de Pau Gil y la Senyera',
      artist: '蒙塔內爾 (Lluís Domènech i Montaner)',
      sala: '各病房外牆與山牆簷角',
      desc: '巴黎單身銀行家保羅·吉爾在遺囑中留下的霸道印記——整座醫院隨處可見粉紅釉磚燒製的字母「P」，以及加泰隆尼亞四道紅紋（Senyera），見證富豪慈善與民族文化自豪的完美交織。'
    }
  ],
  'barcelona-s5': [
    {
      id: 'batllo-1',
      titleZh: '《巨龍脊背彩釉陶鱗屋頂》',
      titleEs: 'Lomo del Dragón',
      artist: '安東尼·高第 (Antoni Gaudí)',
      sala: '頂樓露台屋頂',
      desc: '高第以加泰隆尼亞守護聖人聖佐治屠龍傳奇為靈感。屋頂呈現如同恐龍或巨龍背脊的起伏弧線，彩色釉面陶瓦片隨著陽光折射閃爍五彩珠光，高聳的蒜頭形四臂白石十字架煙囪象徵聖佐治深深刺入惡龍心臟的長矛。'
    },
    {
      id: 'batllo-2',
      titleZh: '《漸層蔚藍海洋中庭天井》',
      titleEs: 'Patio de Luces',
      artist: '安東尼·高第 (Antoni Gaudí)',
      sala: '中央採光通風天井',
      desc: '高第為了讓五層樓的公寓採光完全均勻，在天井由上至下鋪設了由深鈷藍、天藍到珍珠白共五種色階的立體彩磚。頂層陽光最強處使用深藍吸光，底層陰暗處使用純白反光，同時窗戶尺寸上小下大，讓任何一個樓層仰望天井都如同沉潛於勻稱透亮的海底世界。'
    }
  ],
  'barcelona-s2': [
    {
      id: 'mila-1',
      titleZh: '《武士頭盔煙囪天台》',
      titleEs: 'Azotea de los Guerreros',
      artist: '安東尼·高第 (Antoni Gaudí)',
      sala: '頂樓奇幻天台',
      desc: '28 座造型如同戴著鐵面具與頭盔的中世紀騎士守衛煙囪，高低起伏錯落於波浪地表上，被後世科幻電影《星際大戰》帝國風暴兵頭盔視為靈感來源。'
    },
    {
      id: 'mila-2',
      titleZh: '《鯨魚胸腔 270 道拋物線磚拱閣樓》',
      titleEs: 'Desván del Espacio Gaudí',
      artist: '安東尼·高第 (Antoni Gaudí)',
      sala: '頂層閣樓展廳',
      desc: '高第僅以最樸實的紅磚，砌造出 270 道由低到高連續漸變的懸鏈線拋物線拱門，走在其中彷彿穿梭在一頭巨鯨骨骼的胸腔之中，純粹依靠重力與幾何完成的無柱通透空間。'
    }
  ],
  'barcelona-s11': [
    {
      id: 'picasso-1',
      titleZh: '《科學與慈善》',
      titleEs: 'Ciencia y Caridad',
      artist: '畢卡索 (Pablo Picasso，15歲作品)',
      sala: 'Sala 11',
      desc: '畢卡索年僅 15 歲時展現的驚人古典寫實天才！畫中醫生（由畢卡索父親擔任模特兒）手握病人脈搏象徵現代醫學「科學」，修女懷抱嬰兒遞上茶水象徵宗教「慈善」，技法純熟至極，令人難以相信出自一位少年之手。'
    },
    {
      id: 'picasso-2',
      titleZh: '《宮娥連作系列》',
      titleEs: 'Serie Las Meninas (58 cuadros)',
      artist: '畢卡索 (Pablo Picasso)',
      sala: 'Salas de Las Meninas (連作專題大廳)',
      desc: '1957 年畢卡索在坎城別墅閉關數月，向普拉多委拉斯奎茲的《宮娥》致敬並進行顛覆性重構。58 幅連作將古典構圖拆解為幾何色塊、黑白剪影與立體派線條，甚至將畫中的名犬換成自己的愛犬臘腸狗 Lump！'
    },
    {
      id: 'picasso-3',
      titleZh: '《初領聖體》',
      titleEs: 'Primera Comunión',
      artist: '畢卡索 (Pablo Picasso，14歲作品)',
      sala: 'Sala 3',
      desc: '畢卡索 14 歲在巴塞隆納美術學校就讀時的代表作。畫中妹妹蘿拉身穿潔白純真的蕾絲長袍跪在祭壇前，父親在一旁虔誠祈禱，燭光與白紗的處理極富宗教肅穆感。'
    }
  ],
  'cordoba-s1': [
    {
      id: 'mezquita-1',
      titleZh: '《紅白雙層馬蹄形拱券森林》',
      titleEs: 'Bosque de Arcos de Herradura',
      artist: '哥多華倭馬亞王朝伊斯蘭建築師',
      sala: '主祈禱大廳',
      desc: '856 根從古羅馬神廟與西哥德建築回收的大理石、花崗岩與碧玉圓柱，支撐起紅白相間的雙層馬蹄形拱門。上層半圓拱增加高度採光，下層馬蹄拱穩定結構，視覺無限延伸，營造出天地一體的永恆靜謐。'
    },
    {
      id: 'mezquita-2',
      titleZh: '《米哈拉布祈禱壁龕與拜占庭金箔馬賽克》',
      titleEs: 'Mihrab de la Mezquita',
      artist: '拜占庭帝國馬賽克宮廷大師',
      sala: '南側聖壁中心 (Mihrab)',
      desc: '哈里發哈卡姆二世於 10 世紀修建的八角形內室祈禱壁龕。壁龕入口馬蹄拱門由拜占庭皇帝君士坦丁七世親自遣送頂級馬賽克工匠與數萬枚純金箔玻璃磚鑲嵌，金色古庫法體《古蘭經》銘文在陽光下熠熠生輝。'
    }
  ],
  'sevilla-s1': [
    {
      id: 'sevilla-catedral-1',
      titleZh: '《哥倫布靈柩抬棺青銅雕像》',
      titleEs: 'Tumba de Cristóbal Colón',
      artist: '阿圖羅·梅利達 (Arturo Mélida)',
      sala: '大教堂南門右側（聖克里斯多福大壁畫前）',
      desc: '四位身披華麗王袍的西班牙古王國國王（卡斯提爾、萊昂、亞拉岡、納瓦拉）抬著航海家哥倫布的棺槨。哥倫布生前曾發誓「死後絕不踏上西班牙領土半步」，因此雕像設計四位國王高高抬起棺木懸空離地，象徵其遺體不沾西班牙泥土。'
    },
    {
      id: 'sevilla-catedral-2',
      titleZh: '《主祭壇萬尊純金木雕巨型屏風》',
      titleEs: 'Retablo Mayor de la Catedral',
      artist: '丹卡特 (Pierre Dancart) 等法蘭德斯大師',
      sala: '主祭壇 (Capilla Mayor)',
      desc: '全球天主教大教堂中規模最大的祭壇屏風！由法蘭德斯大師丹卡特等工匠歷經 80 年手工雕刻，高達 20 公尺、包含 45 個聖經故事浮雕組與上千尊精細小木雕，全幅貼滿從新大陸美洲運回的純金金箔。'
    }
  ],
  'sevilla-s2': [
    {
      id: 'sevilla-alcazar-1',
      titleZh: '《少女中庭穆德哈爾透雕拱門》',
      titleEs: 'Patio de las Doncellas',
      artist: '格拉那達摩爾手工藝巨匠',
      sala: '王宮核心下層中庭',
      desc: '基督教國王佩德羅一世聘請格拉那達摩爾化工匠打造的穆德哈爾式顛峰之作。細長精緻的多葉透雕拱門、下凹式倒影長形水池與左右下沉式橘樹花園，將伊斯蘭的水木靈性與西班牙宮廷完美融合。'
    },
    {
      id: 'sevilla-alcazar-2',
      titleZh: '《使節廳金色旋轉穹頂》',
      titleEs: 'Cúpula del Salón de Embajadores',
      artist: '安達魯斯木雕幾何大師',
      sala: '王宮正殿使節廳',
      desc: '1427年完工的木雕半球型藻井穹頂，飾以璀璨奪目的金箔與幾何蜂巢幾何星芒，象徵浩瀚旋轉的夜空宇宙，是歐洲現存最宏偉的伊斯蘭木作藝術之一。'
    }
  ],
  'guadix-s3': [
    {
      id: 'alhambra-1',
      titleZh: '《獅子庭院與十二白大理石噴泉獅》',
      titleEs: 'Patio de los Leones',
      artist: '納斯爾王朝蘇丹穆罕默德五世宮廷工匠',
      sala: '獅子宮核心庭院',
      desc: '蘇丹穆罕默德五世於 14 世紀打造的伊斯蘭庭園極致。124 根白色大理石纖細圓柱如椰棗林般環繞庭院，中央水泉由十二隻古代大理石雕獅托起，四道大理石導水渠象徵《古蘭經》中的天國四河（水、乳、酒、蜜）流向四方。'
    },
    {
      id: 'alhambra-2',
      titleZh: '《雙姐妹廳鐘乳石蜂巢藻井》',
      titleEs: 'Sala de Dos Hermanas - Muqarnas',
      artist: '納斯爾王朝幾何石膏雕刻大師',
      sala: '獅子宮北側內殿',
      desc: '頂部由超過 5,000 個微型石膏蜂巢（Muqarnas）層疊拼砌而成的八角星形穹頂。白晝時陽光透過穹頂底部的十六扇小天窗斜射入內，光影在層疊的鐘乳石折角上如流水般流轉，宛如凝固於時空中的神聖幾何星河。'
    }
  ]
};


/* ---------- onboarding ---------- */
route('/onboard', () => {
  view(`${posterBlock('barcelona', TRIP_META, 'FAMILY · QUEST')}<div class="kicker">S / 00 · WELCOME</div><h1>西班牙＋豪華遊輪之旅要開始了！</h1>
    <p class="sub">輸入你的名字（中英文、暱稱皆可）</p>
    <label class="field"><span>你的名字</span><input class="text" id="nm" autocomplete="name" value="${esc(S.player)}"></label>
    <p class="section-label">題目難度</p>
    <div class="pill-switch" id="md"><button type="button" data-m="basic">初階版</button><button type="button" data-m="challenge">我要挑戰</button></div>
    <p class="sub" style="margin-top:8px">初階版只答比較簡單的題目；我要挑戰全部都答，挑戰題分數加倍。之後在「我的」可以改。</p>
    <button class="btn block" id="go" style="margin-top:16px">我們出發囉！</button>`);
  let mode = S.mode;
  const paint = () => $$('#md button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  paint();
  $$('#md button').forEach((b) => b.onclick = () => { mode = b.dataset.m; paint(); });
  $('#go').onclick = () => {
    const n = $('#nm').value.trim().replace(/\s+/g, ' ');
    if (!n) { toast('請先輸入名字'); return; }
    LS.set('player', n);
    LS.set('mode', mode);
    const fam = S.family;
    if (!fam.some((f) => normName(f) === normName(n))) LS.set('family', fam.concat(n));
    pullMine().then(() => render());
    location.hash = '#/';
  };
  return '';
});

/* ---------- home ---------- */
route('/', () => {
  const tToday = today();
  const tc = todayCard();
  let hero = '';
  if (tc) {
    hero = `<div class="hero"><div class="kicker">TODAY · ${esc(tToday.replace(/-/g, '.'))}</div><div class="sub">今天解鎖</div><h2 style="margin:4px 0 12px">${esc(CITY[tc.city].name)}・${esc(tc.title)}</h2>
      <a class="btn block" href="#/card/${tc.id}">打開今天的城市卡</a></div>`;
  } else if (tToday < TRIP_START) {
    const days = Math.ceil((new Date(TRIP_START) - new Date(tToday)) / 86400000);
    hero = `<div class="hero"><div class="kicker">COUNTDOWN · 12.09.2026</div><div class="sub">距離出發還有</div><div class="big-num">${days}<small> 天</small></div>
      <p style="margin:8px 0 0">城市卡會在當天早上解鎖。想先看看，可以到「我的」打開「預覽全部」。</p></div>`;
  } else if (tToday > TRIP_END) {
    hero = `<div class="hero"><h2 style="margin:0 0 8px">旅程結束了</h2><p style="margin:0">到「排行」看看大家的總分和所有九宮格。</p></div>`;
  }
  const tiles = C.cities.map((c) => {
    const m = CITY_META[c.id] || TRIP_META;
    const pk = CITY_POSTER[c.id];
    const art = pk ? `<img class="psvg" src="${POSTER_IMG[pk][0]}" alt="" decoding="async">` : posterSVG(c.id);
    return `<a class="city-tile" href="#/city/${c.id}">${art}<div class="tbody">
      <div class="tmeta"><span>S / ${m.no}</span><span>${esc(m.en)}</span></div><b>${esc(c.name)}</b>
      <span>城市卡 ${c.cityCards.length} 張・景點 ${c.spots.length} 個</span></div></a>`;
  }).join('');

  // Milestone Progress
  const curSteps = S.familySteps;
  const pct = Math.min(100, Math.round((curSteps / 300000) * 100));

  view(`${posterBlock('barcelona', TRIP_META, 'FAMILY · QUEST')}<div class="kicker">S / 00 · ${esc(S.player)}，你好</div><h1>家族任務遊戲</h1><p class="sub">旅遊也能解任務!</p>${hero}
    ${readsHtml()}
    <!-- 每日美味 Tapa 刮刮樂捷徑卡 -->
    <a class="card" href="#/tapa" style="display:flex;align-items:center;gap:14px;text-decoration:none;border-left:4px solid var(--warn);margin-bottom:14px">
      <div style="font-size:36px">🍢</div>
      <div style="flex:1">
        <b style="color:var(--fg);font-size:17px">今日美味 Tapa 刮刮樂</b>
        <p class="sub" style="margin:2px 0 0">每天為大家刮出一道暖心西班牙美食或好運！</p>
      </div>
      ${CHEV}
    </a>

    <!-- 啟程飛行與四大國際機場手帳 -->
    <a class="card" href="#/airports" style="display:flex;align-items:center;gap:14px;text-decoration:none;border-left:4px solid var(--primary);margin-bottom:14px">
      <div style="font-size:36px">✈️</div>
      <div style="flex:1">
        <div style="display:flex;gap:6px;align-items:center">
          <b style="color:var(--fg);font-size:17px">啟程飛行與四大國際機場手帳</b>
          <span class="chip" style="font-size:11px">建築與文化</span>
        </div>
        <p class="sub" style="margin:2px 0 0">桃園候機室大合照、杜拜轉機極致建築、巴塞隆納與馬德里天光巡禮</p>
      </div>
      ${CHEV}
    </a>

    <!-- 大家的 30 萬步合作里程碑卡 -->
    <div class="milestone-card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>🏆 大家的 30 萬步大挑戰</b>
        <span class="chip good">${pct}%</span>
      </div>
      <div class="progress-outer"><div class="progress-inner" style="width:${pct}%"></div></div>
      <div class="progress-labels"><span>0</span><span>10萬 (吉拿棒)</span><span>20萬 (火腿盤)</span><span>30萬 步 🏆</span></div>
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
        <span class="sub">大家累計步數：<b>${curSteps.toLocaleString()}</b> 步</span>
        <button class="btn small ghost" id="btn-quick-steps" type="button">+ 登記今日步數</button>
      </div>
    </div>

    <h2>選一座城市</h2><div class="grid2">${tiles}</div>

    <div style="margin-top:16px"><a class="btn block" href="#/trip">看每日行程</a></div>
    <div style="margin-top:10px"><a class="btn ghost block" href="#/cruise">郵輪靠港：我想去哪裡</a></div>
    <div style="margin-top:10px"><a class="btn ghost block" href="itinerario.html" target="_blank">🇪🇸 西班牙文專屬行程頁（純西文，給司機、導遊或同事）</a></div>
    <div style="margin-top:10px"><a class="btn ghost block" href="#/help">玩法說明</a></div>
    <div class="colophon"><span>ARCHITECTURE<br>CITY<br>MEMORY</span><span>V ${APP_VERSION}</span></div>`);

  $('#btn-quick-steps').onclick = () => {
    const s = prompt('想登記幾步加入大家的累計？');
    if (!s) return;
    const n = parseInt(s.replace(/,/g, ''), 10);
    if (isNaN(n) || n <= 0) return toast('請輸入正確的數字');
    S.familySteps += n;
    award({ key: 'steps|' + uid(), points: 15, label: '步行貢獻：' + n + ' 步' });
    toast('已登記 ' + n + ' 步進大家的大挑戰！');
    render();
  };
  return 'home';
});

/* ---------- today ---------- */
route('/today', () => {
  const tc = todayCard();
  if (tc) { location.replace('#/card/' + tc.id); return 'today'; }
  view(`<h1>今天</h1><div class="card"><p>今天沒有要解鎖的城市卡。</p>
    <p class="sub">旅程是 12/9 到 1/6。出發前可以到「我的」打開「預覽全部」先玩玩看。</p></div>`);
  return 'today';
});

/* ---------- city ---------- */
route('/city/:id', (id) => {
  const city = CITY[id];
  if (!city) { location.hash = '#/'; return; }
  if (id === 'cruise') return renderCruiseHome();
  const cityItems = city.cityCards.map((c) => {
    const ok = isUnlocked(c);
    const d = cardDate(c);
    const sub = (c.port ? c.port + '・' : '') + (d ? fmtDate(d) + (ok ? '' : ' 未解鎖') : '');
    return ok
      ? `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b><span>${esc(sub)}</span></div>${doneMark(c)}${CHEV}</a>`
      : `<div class="item locked"><div class="t"><b>${esc(c.title.split('：')[0])}</b><span>${esc(sub)}</span></div><span class="chip">未解鎖</span></div>`;
  }).join('');
  const spotItems = city.spots.map((c) => `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b>
    <span>${esc((c.port ? c.port + '・' : '') + (c.game ? '小遊戲：' + c.game.name : '景點卡'))}</span></div>${doneMark(c)}${CHEV}</a>`).join('');
  view(`${back('#/', '首頁')}${CITY_POSTER[city.id] ? posterImg(CITY_POSTER[city.id]) : posterBlock(city.id, CITY_META[city.id] || TRIP_META)}<h1>${esc(city.name)}</h1>${city.intro.map((p) => `<p class="sub">${p}</p>`).join('')}
    ${shelfHtml(city.id)}
    <h2>城市卡（每天解鎖一張）</h2><div class="list">${cityItems}</div>
    <h2>景點卡（想去哪個就點哪個）</h2><div class="list">${spotItems}</div>`);
  return 'home';
});
function doneMark(card) {
  const qs = allQuestions(card);
  if (!qs.length) return '';
  const ans = LS.get('ans:' + S.player, {});
  const n = qs.filter((q) => ans[q.qid]).length;
  if (!n) return '';
  return `<span class="chip ${n === qs.length ? 'good' : ''}">${n}/${qs.length}</span>`;
}

/* ---------- SAFETY BANNER (歐洲防盜防扒重要安全提醒) ---------- */
function safetyBannerHtml() {
  return `<div class="safety-banner">
    <div class="safety-banner-header">
      <span class="safety-icon">🛡️</span>
      <b>出發作答前重要安全提醒（歐洲防盜守則）</b>
    </div>
    <div class="safety-banner-body">
      歐洲治安遠不如臺灣安全，當地警察通常不會受理或追查強盜、偷竊案件！<b>低頭看手機前，請每個人務必確認：</b>
      <div class="safety-check-item">✅ 目前位於<b>需要門票或點餐付費的封閉場域</b>（如已驗票入內的博物館展廳、已入座的付費餐廳或咖啡館）。<b>切勿在戶外路邊或街頭人潮中低頭看手機！</b></div>
      <div class="safety-check-item">✅ 身體請盡量<b>背靠牆壁</b>，確保後方無死角，防止扒手從身後無聲順走手機或隨身包包！</div>
    </div>
  </div>`;
}

/* ---------- 7-DAY AUTHENTIC PRAISE MATRIX & SPOT FLAVORS (實際的稱讚與景點彩蛋) ---------- */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PRAISE_CYCLES = [
  {
    title: '🌟 神級觀察力！細節完全逃不過你的法眼！',
    praises: [
      '太厲害了！你的眼睛比老鷹還敏銳，連藏在歷史細節裡的蛛絲馬跡都被你一眼識破！👏',
      '觀察力滿分！這題考得這麼細，你竟然瞬間鎖定真相，大家當中最細心的觀察家非你莫屬！🔍',
      '太強了！你這份敏銳的洞察力，如果回到古代，一定是宮廷裡最受器重的皇家鑒寶大師！✨'
    ]
  },
  {
    title: '👑 博學多聞！這份學識太讓人驚艷了！',
    praises: [
      '太有深度了！連幾百年前歐洲宮廷與老百姓的生活小秘密都難不倒你，大家的文化智庫就是你！📚',
      '這題連很多歐洲在地導遊都不一定答得出來！你到底是怎麼知道的？記憶力簡直是神級的！💡',
      '知識庫大爆發！才剛聽完故事就能融會貫通，你對歐洲歷史文化的理解力讓人由衷佩服！🎓'
    ]
  },
  {
    title: '🏆 關鍵一擊！為大家贏得無比驕傲的高分！',
    praises: [
      '太棒了！沉著、自信又精準，爸媽和弟弟都在為你熱烈鼓掌，這一題為大家拿下了超關鍵得分！💪',
      '大家的幸運之星！你一出手就穩穩拿下這題，旅途的幸運女神今天完全站在你身後護航！🍀',
      '太帥氣了！弟弟在一旁看得眼睛發亮，你就是大家最崇拜的解題大英雄！🥳'
    ]
  },
  {
    title: '🎨 藝術通靈！你完全讀懂了大師的心意！',
    praises: [
      '太絕妙了！你完全看穿了建築師與畫家藏在作品裡的美學暗號，美學品味天生就是大師級的！🏛️',
      '靈魂共振！這道題的藝術密碼被你瞬間破解，如果高第和委拉斯奎茲在世，一定會找你乾杯擊掌！🍷',
      '美學直覺太敏銳！在光影與色彩之間一眼看透本質，這趟西班牙之旅你的藝術靈魂徹底昇華了！✨'
    ]
  },
  {
    title: '⚓️ 探險王降臨！果斷又精準的判斷力！',
    praises: [
      '太帥氣了！你的血液裡根本流著古代麥哲倫與哥倫布的冒險天分，面對刁鑽難題果斷又神準！🧭',
      '無所畏懼的機智！任何狡猾的干擾選項在你面前都無所遁形，這份敏銳太讓人安心了！⚔️',
      '冒險家精神大放光彩！不僅背靠牆防守滴水不漏，腦袋還轉得比高鐵AVE還快，今晚值得加菜！🥩'
    ]
  },
  {
    title: '🌞 陽光普照！好心情與好手氣雙重爆發！',
    praises: [
      '哇塞太神了！這題答得既快又準，就像安達魯西亞的冬陽一樣明朗耀眼，整個旅途都被你點亮了！💃',
      '幸運與實力的極致結合！你今天的手氣和直覺已經達到了宇宙級巔峰，全場掌聲停不下來！👏',
      '太厲害了！你一定是吸收了地中海的滿滿天地靈氣，連這麼冷門的角度都能輕鬆拿下，佩服！🐚'
    ]
  },
  {
    title: '🎖️ 完美絕殺！首席軍師的傳奇級表現！',
    praises: [
      '大獲全勝！你就是這個旅行團的首席總參謀長，冷靜、精準、毫不猶豫，太令人心悅誠服了！👑',
      '魔王題直接瓦解！這道題本來是設計來考倒大家的，結果在你面前撐不過一秒，請收下膝蓋！🙇‍♂️',
      '傳奇級答題！這趟旅行有你在身旁解題，大家玩得既充實又放心，你是全西班牙最棒的探險家！🏰'
    ]
  }
];

const SPOT_FLAVORS = [
  { match: /聖家堂|高第/, text: '安東尼·高第如果看見你答得這麼精準，一定會邀請你一起設計尚未完工的榮耀立面！⛪️' },
  { match: /聖保羅|蒙塔內爾/, text: '蒙塔內爾的童話花園宮殿為你喝采！連高第的老師藏在磁磚裡的秘密都被你一眼看穿！🏰' },
  { match: /普拉多|委拉斯奎茲/, text: '委拉斯奎茲在《宮娥》畫布後面都要為你這神之一筆拍手叫好！🎨' },
  { match: /蘇菲亞|格爾尼卡|畢卡索|達利/, text: '超現實主義與立體派的百年密碼都被你輕鬆破解，畢卡索和達利都要甘拜下風！🖼️' },
  { match: /考古|MAN|埃爾切/, text: '這件萬年前的古代瑰寶被你一眼參透，你簡直就是現代伊比利半島的印第安納·瓊斯！🏺' },
  { match: /托雷多|葛雷柯/, text: '托雷多千年古都的石板路上，今天又誕生了一位智勇雙全的聖殿騎士！🗡️' },
  { match: /清真寺|哥多華/, text: '穿過八百根紅白馬蹄拱門，你的智慧在伊斯蘭繁星幾何中閃閃發光！🕌' },
  { match: /阿爾罕布拉|格拉那達/, text: '格拉那達蘇丹皇宮的微風，正在為最博學多聞的你吹拂奏樂！🏰' },
  { match: /塞維亞|吉拉達/, text: '塞維亞大教堂的橘花香氣與佛朗明哥熱烈掌聲，都在為你的勝利熱情狂歡！🍊' },
  { match: /巴特略|米拉|屋頂/, text: '巨龍屋頂上的五彩陶瓦鱗片，正因為你的機智閃爍出繽紛光芒！🐉' },
  { match: /波蓋利亞|市場|美食|火腿/, text: '這份敏銳太棒了！待會逛完市場一定要點一盤現炸熱吉拿棒犒賞自己！🍫' },
];

function getPraise(card, q) {
  const seed = hashStr((card.id || '') + (q.qid || '') + (card.title || ''));
  const dayIndex = (seed + (parseInt(today().replace(/-/g, ''), 10) || 0)) % 7;
  const cycle = PRAISE_CYCLES[dayIndex];
  const pText = cycle.praises[seed % cycle.praises.length];
  const flavor = SPOT_FLAVORS.find((f) => f.match.test(card.title || ''));
  return {
    title: cycle.title,
    body: pText,
    flavor: flavor ? '💡 ' + flavor.text : ''
  };
}

const WRONG_FEEDBACKS = [
  '差一點點！這題真的太刁鑽、太考驗人了，連很多歷史學教授第一次看也答錯！不過現在你已經把這個冷知識牢牢記在腦海裡了，超有收穫！🌟',
  '沒關係！這題本來就是魔王級陷阱題，你敢於挑戰的勇氣已經為大家贏得了尊敬！看懂解說我們就學會了！💪',
  '別氣餒！連高第和哥雅當年創作時都改稿了好幾次呢！這題讓你認識了不一樣的西班牙，答錯也是珍貴的收穫，繼續前進！✨'
];
function getWrongFeedback(seed) {
  return WRONG_FEEDBACKS[seed % WRONG_FEEDBACKS.length];
}

/* ---------- FLASHCARD QUIZ (卡片式單題答題系統) ---------- */
function allQuestions(card) {
  const out = [];
  const add = (arr, sec) => arr.forEach((q, i) => out.push(Object.assign({ qid: card.id + '-' + sec + i, sec }, q)));
  if (card.type === 'city') add(card.bonus, 'b'); else { add(card.pre, 'p'); add(card.post, 'q'); }
  return out.filter((q) => S.mode === 'challenge' || q.level === 'basic');
}
function qPoints(q) {
  if (q.sec === 'b') return 15;
  if (q.kind === 'long') return 30;
  if (q.kind === 'onsite') return 20;
  return q.level === 'basic' ? 10 : 20;
}
function quizHtml(card, sec, title) {
  const qs = allQuestions(card).filter((q) => q.sec === sec);
  if (!qs.length) return `<div class="quiz-deck"><h2 id="q-${sec}">${esc(title)}</h2><p class="sub">初階版這一段沒有題目，切到「我要挑戰」可以玩更多。</p></div>`;

  const key = 'ans:' + S.player;
  const ansMap = LS.get(key, {});
  // Find first unanswered question
  let initIdx = qs.findIndex((q) => !ansMap[q.qid]);
  if (initIdx < 0) initIdx = qs.length - 1; // if all answered, show last

  const cardsHtml = qs.map((q, i) => {
    const tags = q.tags.map((t) => `<span class="chip ${t.includes('現場') ? 'warn' : t.includes('挑戰') || t.includes('長題') ? 'plan' : ''}">${esc(t)}</span>`).join(' ');
    const isShown = (i === initIdx);
    return `<div class="q-card" data-qid="${q.qid}" data-idx="${i}" style="${isShown ? '' : 'display:none'}">
      <div class="row">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          ${tags}
          <span class="chip warn">第 ${i + 1} / ${qs.length} 題</span>
        </div>
        <span class="chip good">+${qPoints(q)} 分</span>
      </div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.kind === 'onsite' ? '<p class="sub" style="color:var(--warn);font-weight:700">📍 到現場找答案再作答，並拍照證明。</p>' : ''}
      <div class="opts">${q.options.map((o) => `<button type="button" class="opt" data-k="${o.key}"><span class="k">${o.key}</span><span>${esc(o.text)}</span></button>`).join('')}</div>
      <div class="res"></div>
      <div class="q-card-footer" style="display:none">
        <button type="button" class="btn-next-step" data-next-idx="${i + 1}">
          ${i < qs.length - 1 ? `👉 前進下一題 (${i + 2}/${qs.length})` : `🎉 完成本區挑戰！領取積分`}
        </button>
      </div>
    </div>`;
  }).join('');

  const pct = Math.round(((initIdx + 1) / qs.length) * 100);

  return `<div class="quiz-deck" id="deck-${sec}" data-sec="${sec}" data-total="${qs.length}">
    ${safetyBannerHtml()}

    <div class="q-deck-header">
      <div class="q-deck-title-wrap">
        <h2 id="q-${sec}">${esc(title)}</h2>
        <span class="sub" style="font-size:13.5px">卡片式單題挑戰 • 答完即時揭曉稱讚</span>
      </div>
      <div class="q-progress-badge">
        <span class="cur-q-num">${initIdx + 1}</span> / ${qs.length}
      </div>
    </div>

    <div class="q-deck-bar-outer">
      <div class="q-deck-bar-inner" style="width:${pct}%"></div>
    </div>

    <div class="q-cards-container">
      ${cardsHtml}
    </div>

    <div class="q-deck-nav">
      <button type="button" class="btn small ghost btn-prev-card" ${initIdx > 0 ? '' : 'disabled'}>← 上一題</button>
      <div class="q-dots-wrap">
        ${qs.map((_, i) => `<span class="q-dot ${i === initIdx ? 'on' : ''}" data-goto="${i}"></span>`).join('')}
      </div>
      <button type="button" class="btn small ghost btn-next-card" ${initIdx < qs.length - 1 ? '' : 'disabled'}>下一題 →</button>
    </div>
  </div>`;
}

function bindQuiz(card) {
  const qs = {};
  allQuestions(card).forEach((q) => { qs[q.qid] = q; });
  const key = 'ans:' + S.player;

  // Deck switcher function
  function switchDeckCard(deckEl, targetIdx) {
    const cards = $$('.q-card', deckEl);
    const total = cards.length;
    if (targetIdx < 0 || targetIdx >= total) return;

    cards.forEach((c, i) => { c.style.display = (i === targetIdx) ? '' : 'none'; });
    const numEl = $('.cur-q-num', deckEl);
    if (numEl) numEl.textContent = targetIdx + 1;
    const barEl = $('.q-deck-bar-inner', deckEl);
    if (barEl) barEl.style.width = Math.round(((targetIdx + 1) / total) * 100) + '%';

    // Update dots
    $$('.q-dot', deckEl).forEach((dot, i) => {
      dot.classList.toggle('on', i === targetIdx);
    });

    // Update nav buttons
    const btnPrev = $('.btn-prev-card', deckEl);
    const btnNext = $('.btn-next-card', deckEl);
    if (btnPrev) btnPrev.disabled = (targetIdx <= 0);
    if (btnNext) btnNext.disabled = (targetIdx >= total - 1);
  }

  // Paint answered card
  const paint = (box, q, choice) => {
    $$('.opt', box).forEach((b) => {
      b.disabled = true;
      if (b.dataset.k === q.answer) b.classList.add('correct');
      else if (b.dataset.k === choice) b.classList.add('wrong');
    });
    const ok = choice === q.answer;
    const seed = hashStr(q.qid);

    let praiseHtml = '';
    if (ok) {
      const p = getPraise(card, q);
      praiseHtml = `<div class="praise-box">
        <div class="praise-title">${esc(p.title)}</div>
        <div class="praise-body">${esc(p.body)}</div>
        ${p.flavor ? `<div class="praise-flavor">${esc(p.flavor)}</div>` : ''}
      </div>`;
    } else {
      const wrongMsg = getWrongFeedback(seed);
      praiseHtml = `<div class="praise-box" style="border-left-color:var(--bad);background:#FDF5F5;border-color:#E8C5C3">
        <div class="praise-title" style="color:var(--bad)">💡 差一點點！這題考得真的很細！</div>
        <div class="praise-body">${esc(wrongMsg)}</div>
      </div>`;
    }

    $('.res', box).innerHTML = `${praiseHtml}<div class="exp">
      <div class="verdict ${ok ? 'ok' : 'no'}">${ok ? '🎉 答對了！' : '正確答案是【 ' + q.answer + ' 】'}</div>
      ${q.proof ? '<div><b>現場任務：</b>' + esc(q.proof) + '</div>' : ''}${esc(q.explain)}
    </div>`;

    // Show footer button
    const footer = $('.q-card-footer', box);
    if (footer) footer.style.display = '';

    // Mark dot done
    const deckEl = box.closest('.quiz-deck');
    if (deckEl) {
      const idx = Number(box.dataset.idx);
      const dot = $$('.q-dot', deckEl)[idx];
      if (dot) dot.classList.add('done');
    }
  };

  // Wire cards
  $$('.q-card').forEach((box) => {
    const q = qs[box.dataset.qid];
    if (!q) return;
    const prev = LS.get(key, {})[q.qid];
    if (prev) {
      paint(box, q, prev.c);
    }

    $$('.opt', box).forEach((b) => {
      b.onclick = () => {
        const ans = LS.get(key, {});
        if (ans[q.qid]) return;
        const choice = b.dataset.k;
        const isOk = (choice === q.answer);
        ans[q.qid] = { c: choice, ok: isOk, ts: Date.now() };
        LS.set(key, ans);
        paint(box, q, choice);
        if (isOk) {
          award({ key: 'q|' + q.qid, points: qPoints(q), label: '答對：' + card.title, cardId: card.id });
          toast('🎉 太棒了！答對獲得 +' + qPoints(q) + ' 分！', 2800);
        }
      };
    });

    // Wire next-step button
    const nextBtn = $('.btn-next-step', box);
    if (nextBtn) {
      nextBtn.onclick = () => {
        const nextIdx = Number(nextBtn.dataset.nextIdx);
        const deckEl = box.closest('.quiz-deck');
        if (!deckEl) return;
        const total = Number(deckEl.dataset.total);
        if (nextIdx < total) {
          switchDeckCard(deckEl, nextIdx);
          const nextCard = $$('.q-card', deckEl)[nextIdx];
          if (nextCard) nextCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          toast('🎉 本區題目已全數挑戰完畢！大家太厲害了！', 3500);
        }
      };
    }
  });

  // Wire Deck navigation (prev / next buttons and dots)
  $$('.quiz-deck').forEach((deckEl) => {
    const btnPrev = $('.btn-prev-card', deckEl);
    const btnNext = $('.btn-next-card', deckEl);

    function currentIdx() {
      const cards = $$('.q-card', deckEl);
      return cards.findIndex((c) => c.style.display !== 'none');
    }

    if (btnPrev) {
      btnPrev.onclick = () => {
        const cur = currentIdx();
        if (cur > 0) switchDeckCard(deckEl, cur - 1);
      };
    }
    if (btnNext) {
      btnNext.onclick = () => {
        const cur = currentIdx();
        const total = Number(deckEl.dataset.total);
        if (cur < total - 1) switchDeckCard(deckEl, cur + 1);
      };
    }
    $$('.q-dot', deckEl).forEach((dot) => {
      dot.onclick = () => {
        const target = Number(dot.dataset.goto);
        switchDeckCard(deckEl, target);
      };
    });
  });
}


/* ---------- tasks ---------- */
function needsPhoto(text) { return /拍|照|票根|收據/.test(text); }
function taskControl(box, o) {
  const host = $('.tc', box);
  if (!host) return;
  const pts = o.points;
  const noteEl = $('.task-note', box);
  const note = () => (noteEl ? noteEl.value.trim() : '');
  const label = () => o.label + (note() ? '（' + note() + '）' : '');
  const paintDone = () => { host.innerHTML = `<span class="chip good">已完成 +${pts}</span>`; };
  if (ledgerHas(o.key)) return paintDone();
  if (!needsPhoto(o.text)) {
    host.innerHTML = `<button class="btn small ghost" type="button">我們完成了 +${pts}</button>`;
    $('button', host).onclick = () => { if (award({ key: o.key, points: pts, label: label(), cardId: o.cardId })) paintDone(); };
    return;
  }
  host.innerHTML = `<label class="btn small upload-btn">拍照上傳，成功就 +${pts}<input type="file" accept="image/*" hidden></label>
    <p class="sub" style="margin:6px 0 0">照片要上傳成功才會加分。</p>`;
  const input = $('input', host);
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!S.server.url) { toast('請先到「我的」設定家庭雲端，上傳成功才會加分'); input.value = ''; return; }
    const pk = 'tp:' + o.key + ':' + uid();
    await DB.put(pk, f);
    await DB.qPut({
      id: 'p:' + pk, type: 'photo', ts: Date.now(), key: pk,
      meta: { player: S.player, cardId: o.cardId || '', cardTitle: o.cardTitle || '', city: o.city || '', theme: o.theme || '任務', date: today(), kind: 'task', slot: 0 },
      award: { key: o.key, points: pts, label: label(), cardId: o.cardId || '' },
    });
    toast('已排進上傳清單，上傳成功就加分');
    input.value = '';
    flush();
  };
}

/* ---------- card page ---------- */
const TOOL_FOR = [['命運之輪', 'wheel'], ['物價', 'price'], ['步數', 'steps'], ['神秘任務', 'secret']];
function factId(card, i) { return card.id + '#' + i; }
function likeCount(id) {
  const others = (META.likes[id] || []).filter((n) => n !== S.player).length;
  return others + (LS.get('likes', {})[id] ? 1 : 0);
}
route('/card/:id', async (id) => {
  const card = CARD[id];
  if (!card) { location.hash = '#/'; return; }
  if (!isUnlocked(card)) { view(`${back('#/city/' + card.city, CITY[card.city].name)}<h1>還沒解鎖</h1><p>這張城市卡 ${fmtDate(cardDate(card))} 才會解鎖。</p>`); return 'home'; }
  const city = CITY[card.city];
  const d = cardDate(card);
  let html = `${back('#/city/' + city.id, city.name)}<div class="row"><span class="chip">${esc(card.port || city.name)}</span>${d ? `<span class="chip">${fmtDate(d)}</span>` : ''}</div>
    <h1>${esc(card.title)}</h1>${SPOT_POSTER[card.id] ? posterImg(SPOT_POSTER[card.id]) : ''}`;
  if (card.type === 'city') {
    html += `<button type="button" class="btn ghost block" data-jump="q-b" style="margin-bottom:12px">不想讀？直接跳到加分題</button>
      <details class="read" open><summary>今天的故事 <span class="sub">點一下收起來</span></summary><div class="inner reading">
      ${card.sections.map((s) => `<p><span class="section-label">${esc(s.label)}</span><br>${s.html}</p>`).join('')}</div></details>`;
    if (card.themes.length) {
      html += `<h2>今日九宮格</h2><p class="sub">每人挑一個主題，家人之間盡量不要撞題。拍滿 9 張就能一鍵拼貼、一鍵上傳。</p>
        <div class="themes">${card.themes.map((t) => `<a class="theme-btn" href="#/grid/${card.id}/${t.key}"><b>${t.key}. ${esc(t.title)}</b><span>${esc(t.desc)}</span></a>`).join('')}</div>`;
    }
    html += quizHtml(card, 'b', '加分題');
  } else {
    // Spot card
    const masterpieces = MUSEUM_MASTERPIECES[card.id];
    let spotMode = LS.get('spot_mode:' + card.id, 'free');
    let huntHtml = '';

    if (masterpieces && masterpieces.length) {
      const checkedCount = masterpieces.filter((m) => LS.get('art:' + card.id + ':' + m.id, false)).length;
      const pct = Math.round((checkedCount / masterpieces.length) * 100);

      // Mode switch buttons
      html += `<div class="spot-mode-toggle">
        <button type="button" class="spot-mode-btn ${spotMode === 'free' ? 'on' : ''}" data-smode="free">🌿 自由參觀隨心逛</button>
        <button type="button" class="spot-mode-btn ${spotMode === 'hunt' ? 'on' : ''}" data-smode="hunt">🎯 鎮館之寶尋寶打卡 <span class="badge" id="hunt-badge-count">${checkedCount}/${masterpieces.length}</span></button>
      </div>`;

      // Build hunt mode view
      const itemsHtml = await Promise.all(masterpieces.map(async (m) => {
        const isChecked = !!LS.get('art:' + card.id + ':' + m.id, false);
        const photoKey = 'artphoto:' + card.id + ':' + m.id;
        const photoBlob = await DB.get(photoKey);
        let photoThumb = '';
        if (photoBlob) {
          const u = URL.createObjectURL(photoBlob);
          photoThumb = `<img class="hunt-photo-thumb" src="${u}" alt="${esc(m.titleZh)}">`;
        }
        return `<div class="hunt-item ${isChecked ? 'checked' : ''}" id="art-item-${m.id}">
          <div class="hunt-item-top">
            <div>
              <div class="hunt-item-title">${esc(m.titleZh)}</div>
              <div class="hunt-item-es">${esc(m.titleEs)}</div>
              ${m.artist ? `<div class="hunt-item-artist">🎨 ${esc(m.artist)}</div>` : ''}
            </div>
            <span class="sala-badge">📍 ${esc(m.sala)}</span>
          </div>
          <div class="hunt-item-desc">${m.desc}</div>
          <div class="hunt-item-actions">
            <button type="button" class="hunt-check-btn ${isChecked ? 'checked' : ''}" data-art-toggle="${m.id}">
              <span class="hunt-check-box">${isChecked ? '✓' : ''}</span>
              <span class="hunt-check-label">${isChecked ? '已找到親眼目睹！' : '我找到了！點擊打勾'}</span>
            </button>
            <label class="btn small ghost" style="cursor:pointer">
              ${photoBlob ? '換一張照片' : '📷 拍下真跡 / 合影 (+20分)'}
              <input type="file" accept="image/*" class="hunt-photo-input" data-art-id="${m.id}" hidden>
            </label>
          </div>
          <div id="art-photo-box-${m.id}">${photoThumb}</div>
        </div>`;
      }));

      huntHtml = `<div class="hunt-box" id="hunt-view" style="${spotMode === 'hunt' ? '' : 'display:none'}">
        <div class="hunt-progress-wrap">
          <div class="hunt-progress-header">
            <b>🏆 鎮館之寶尋寶進度</b>
            <span class="chip ${checkedCount === masterpieces.length ? 'good' : 'warn'}" id="hunt-progress-chip">${checkedCount} / ${masterpieces.length} 件 (${pct}%)</span>
          </div>
          <div class="progress-outer"><div class="progress-inner" id="hunt-progress-bar" style="width:${pct}%"></div></div>
          <p class="sub" style="margin:6px 0 0">走進各展間尋找鎮館名作，每找到一件打勾可獲 10 分！全部找齊再獲 50 分全制霸大獎！</p>
        </div>
        <div class="hunt-list">${itemsHtml.join('')}</div>
      </div>`;
    }

    const casualHtml = `<div id="casual-view" style="${spotMode === 'hunt' && masterpieces ? 'display:none' : ''}">
      ${preReadHtml(card)}<button type="button" class="btn ghost block" data-jump="q-p" style="margin-bottom:12px">不想讀？直接跳到題目</button>
      <details class="read" open><summary>景點小介紹 <span class="sub">點一下就能收起來，覺得特別有趣就 WoW 記!</span></summary><div class="inner reading">
      ${card.story.map((p) => `<p>${p}</p>`).join('')}
      ${card.facts.length ? `<div class="facts-box">${card.facts.map((f, i) => {
        const fid = factId(card, i);
        const on = !!LS.get('likes', {})[fid];
        return `<div class="fact"><div class="ftxt">${f}</div>
          <div class="wow-row"><button type="button" class="wow-btn${on ? ' on' : ''}" data-like="${fid}" aria-pressed="${on}">👍 WoW 記! <span class="n">${likeCount(fid)}</span></button></div></div>`;
      }).join('')}</div>` : ''}</div></details>
      <p><b>準備好挑戰今天的任務了嗎？</b></p>
      ${quizHtml(card, 'p', '出發前先來暖身')}
      ${card.game && card.hasGame ? (() => {
        const tool = TOOL_FOR.find(([k]) => card.game.name.includes(k));
        return `<div class="gamebox"><h3>景點小遊戲：${esc(card.game.name)}</h3><p>${card.game.rules}</p>
          ${tool ? `<a class="btn small" href="#/tool/${tool[1]}">打開${esc(tool[0])}工具</a>` : ''}</div>`;
      })() : ''}
      ${card.id === 'cruise-s5' ? pompeiiMissionHtml() : ''}
      ${card.tasks.length ? `<h2>現場出任務</h2><div class="stack">${card.tasks.map((t, i) => `<div class="card task-box" data-task="${i}"><p>${t}</p>
        <input class="text task-note" placeholder="寫下細節（選填，例如名字、地點）">
        <div class="tc"></div></div>`).join('')}</div>` : ''}
      <a class="btn ghost block" href="#/grid/${card.id}/S">開一個這個景點的九宮格</a>
      ${quizHtml(card, 'q', '收尾 3 題')}
    </div>`;

    html += (huntHtml + casualHtml);
  }
  view(html);
  bindQuiz(card);
  $$('[data-jump]').forEach((b) => b.onclick = () => { const target = document.getElementById(b.dataset.jump); if (target) target.scrollIntoView({ behavior: 'smooth' }); });
  $$('[data-like]').forEach((b) => b.onclick = () => {
    const fid = b.dataset.like;
    const m = LS.get('likes', {});
    if (m[fid]) delete m[fid]; else m[fid] = Date.now();
    LS.set('likes', m);
    b.classList.toggle('on', !!m[fid]);
    b.setAttribute('aria-pressed', String(!!m[fid]));
    $('.n', b).textContent = likeCount(fid);
    if (m[fid]) toast('已記進你的 WoW 筆記，到「我的」可以看到');
    DB.qPut({ id: 'l:' + fid, type: 'like', factId: fid, player: S.player, on: !!m[fid] }).then(flush);
  });
  if (card.type !== 'city') {
    // Mode toggle buttons
    $$('[data-smode]').forEach((btn) => {
      btn.onclick = () => {
        const mode = btn.dataset.smode;
        LS.set('spot_mode:' + card.id, mode);
        $$('[data-smode]').forEach((b) => b.classList.toggle('on', b.dataset.smode === mode));
        const huntView = $('#hunt-view');
        const casualView = $('#casual-view');
        if (huntView) huntView.style.display = mode === 'hunt' ? '' : 'none';
        if (casualView) casualView.style.display = mode === 'hunt' ? 'none' : '';
      };
    });

    // Masterpiece check toggles
    $$('[data-art-toggle]').forEach((btn) => {
      btn.onclick = () => {
        const aid = btn.dataset.artToggle;
        const key = 'art:' + card.id + ':' + aid;
        const was = !!LS.get(key, false);
        const isNow = !was;
        LS.set(key, isNow);
        btn.classList.toggle('checked', isNow);
        $('.hunt-check-box', btn).textContent = isNow ? '✓' : '';
        $('.hunt-check-label', btn).textContent = isNow ? '已找到親眼目睹！' : '我找到了！點擊打勾';
        const itemEl = $('#art-item-' + aid);
        if (itemEl) itemEl.classList.toggle('checked', isNow);

        const masterpieces = MUSEUM_MASTERPIECES[card.id];
        if (isNow) {
          const mObj = masterpieces.find((m) => m.id === aid);
          award({ key: 'art|' + card.id + '|' + aid, points: 10, label: '鎮館之寶：' + (mObj ? mObj.titleZh : aid) });
          toast('🎉 親眼見證 ' + (mObj ? mObj.titleZh : aid) + '！+10 分');
        }

        // Update progress bar & count
        const curChecked = masterpieces.filter((m) => LS.get('art:' + card.id + ':' + m.id, false)).length;
        const curPct = Math.round((curChecked / masterpieces.length) * 100);
        const chipEl = $('#hunt-progress-chip');
        if (chipEl) {
          chipEl.textContent = `${curChecked} / ${masterpieces.length} 件 (${curPct}%)`;
          chipEl.className = 'chip ' + (curChecked === masterpieces.length ? 'good' : 'warn');
        }
        const barEl = $('#hunt-progress-bar');
        if (barEl) barEl.style.width = curPct + '%';
        const badgeCount = $('#hunt-badge-count');
        if (badgeCount) badgeCount.textContent = `${curChecked}/${masterpieces.length}`;

        if (curChecked === masterpieces.length && isNow) {
          award({ key: 'art_all|' + card.id, points: 50, label: card.title + ' 鎮館之寶全制霸！' });
          toast('🏆 太神了！' + card.title + ' 鎮館之寶全數打卡達成！+50 分大獎！', 3500);
        }
      };
    });

    // Masterpiece photo inputs
    $$('.hunt-photo-input').forEach((input) => {
      input.onchange = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        const aid = input.dataset.artId;
        await DB.put('artphoto:' + card.id + ':' + aid, file);
        const masterpieces = MUSEUM_MASTERPIECES[card.id];
        const mObj = masterpieces.find((m) => m.id === aid);
        award({ key: 'art_photo|' + card.id + '|' + aid, points: 20, label: '名畫真跡拍照：' + (mObj ? mObj.titleZh : aid) });
        toast('🎉 拍下真跡留念！+20 分');
        // Update preview immediately
        const u = URL.createObjectURL(file);
        const pBox = $('#art-photo-box-' + aid);
        if (pBox) pBox.innerHTML = `<img class="hunt-photo-thumb" src="${u}" alt="${esc(mObj ? mObj.titleZh : aid)}">`;
      };
    });

    $$('.task-box').forEach((box) => {
      const i = Number(box.dataset.task);
      taskControl(box, {
        key: 'task|' + card.id + '|' + i, points: 30, label: '任務：' + card.title,
        text: plain(card.tasks[i]), cardId: card.id, cardTitle: card.title, city: city.name, theme: '現場任務',
      });
    });
  }
  return card.type === 'city' && todayCard() === card ? 'today' : 'home';
});


/* ---------- nine-grid ---------- */
function gridTheme(card, key) {
  if (key === 'S') return { key: 'S', title: card.title, desc: '在這個景點拍 9 張你覺得最有代表性的東西。' };
  return card.themes.find((t) => t.key === key);
}
function slotKey(cardId, key, i) { return [S.player, cardId, key, i].join('|'); }
route('/grid/:cardId/:key', (cardId, key) => {
  const card = CARD[cardId];
  const theme = card && gridTheme(card, key);
  if (!theme) { location.hash = '#/'; return; }
  view(`${back('#/card/' + card.id, '回到卡片')}<h1>九宮格：${esc(theme.title)}</h1>
    <p class="sub">${esc(theme.desc)}</p>
    <div class="slots" id="slots">${Array.from({ length: 9 }, (_, i) => `<label class="slot" data-i="${i}">+<input type="file" accept="image/*" aria-label="第 ${i + 1} 格"></label>`).join('')}</div>
    <p class="sub" id="cnt" style="margin-top:8px"></p>
    <div class="stack" style="margin-top:8px">
      <button class="btn block" id="make" disabled>一鍵拼貼</button>
    </div>
    <div id="out"></div>`);
  const urls = [];
  const refresh = async () => {
    let n = 0;
    for (let i = 0; i < 9; i++) {
      const blob = await DB.get(slotKey(cardId, key, i));
      const el = $(`.slot[data-i="${i}"]`);
      if (!el) return;
      if (blob) {
        n++;
        const u = URL.createObjectURL(blob); urls.push(u);
        el.classList.add('filled');
        el.innerHTML = `<img src="${u}" alt="第 ${i + 1} 張"><input type="file" accept="image/*" aria-label="換掉第 ${i + 1} 張">`;
      }
      bindSlot(el, i);
    }
    $('#cnt').textContent = '已經拍了 ' + n + ' / 9 張' + (n < 9 ? '。點格子拍照或從相簿選。' : '，可以拼貼了！');
    $('#make').disabled = n < 9;
    const collage = await DB.get(slotKey(cardId, key, 'collage'));
    if (collage) showCollage(collage);
  };
  const bindSlot = (el, i) => {
    const input = $('input', el);
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      await DB.put(slotKey(cardId, key, i), f);
      await DB.del(slotKey(cardId, key, 'collage'));
      $('#out').innerHTML = '';
      refresh();
    };
  };
  const showCollage = (blob) => {
    const u = URL.createObjectURL(blob); urls.push(u);
    $('#out').innerHTML = `<img class="collage" src="${u}" alt="拼好的九宮格">
      <div class="stack"><button class="btn block" id="up">一鍵上傳到家庭雲端</button>
      <button class="btn ghost block" id="save">存到手機</button></div>
      <p class="sub" style="margin-top:8px">${S.server.url ? '會上傳 9 張原圖和這張拼貼。上傳成功就加 20 分。' : '還沒連上家庭雲端，可以先存到手機。'}</p>`;
    $('#save').onclick = () => saveBlob(blob, theme.title + '-九宮格.jpg');
    $('#up').onclick = async () => {
      if (!S.server.url) { toast('請先到「我的」設定家庭雲端'); return; }
      const city = CITY[card.city];
      const base = { player: S.player, cardId: card.id, cardTitle: card.title, city: city.name, theme: theme.title, date: today() };
      const ts = Date.now();
      for (let i = 0; i < 9; i++) {
        await DB.qPut({ id: 'p:' + slotKey(cardId, key, i) + ':' + ts, type: 'photo', ts: ts + i, key: slotKey(cardId, key, i), meta: Object.assign({ slot: i + 1, kind: 'original' }, base) });
      }
      await DB.qPut({
        id: 'p:' + slotKey(cardId, key, 'collage') + ':' + ts, type: 'photo', ts: ts + 9, key: slotKey(cardId, key, 'collage'),
        meta: Object.assign({ slot: 0, kind: 'collage' }, base),
        award: { key: 'grid|' + card.id + '|' + key, points: 20, label: '九宮格：' + theme.title, cardId: card.id },
      });
      toast('已排進上傳清單，上傳成功就加分');
      flush();
    };
  };
  $('#make').onclick = async () => {
    $('#make').disabled = true; $('#make').textContent = '拼貼中…';
    const blobs = [];
    for (let i = 0; i < 9; i++) blobs.push(await DB.get(slotKey(cardId, key, i)));
    const out = await makeCollage(blobs, theme.title, card.title);
    await DB.put(slotKey(cardId, key, 'collage'), out);
    $('#make').textContent = '重新拼貼'; $('#make').disabled = false;
    showCollage(out);
  };
  refresh();
  return 'home';
});
async function loadBitmap(blob) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
}
async function makeCollage(blobs, themeTitle, cardTitle) {
  const cell = 360, gap = 6, head = 150;
  const W = cell * 3 + gap * 4, H = W + head;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = '#EEE5D3'; g.fillRect(0, 0, W, H);
  ['#E39B2D', '#5F7F7C', '#4B4F4C', '#CDBB9C'].forEach((c, i) => { g.fillStyle = c; g.fillRect(W - 24 - (4 - i) * 18, 12, 14, 14); });
  g.fillStyle = '#24231F'; g.font = 'bold 46px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif';
  g.fillText(themeTitle.slice(0, 18), 24, 64);
  g.fillStyle = '#6A6458'; g.font = '30px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif';
  g.fillText((S.player + '・' + today() + '・' + cardTitle).slice(0, 34), 24, 116);
  for (let i = 0; i < 9; i++) {
    const bmp = await loadBitmap(blobs[i]);
    const w = bmp.width, h = bmp.height, s = Math.min(w, h);
    const x = gap + (i % 3) * (cell + gap), y = head + gap + Math.floor(i / 3) * (cell + gap);
    g.drawImage(bmp, (w - s) / 2, (h - s) / 2, s, s, x, y, cell, cell);
    if (bmp.close) bmp.close();
  }
  return new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.88));
}
async function saveBlob(blob, name) {
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

/* ---------- ROUTE: /tapa (每日美味 Tapa 刮刮樂) ---------- */
route('/tapa', () => {
  const tStr = today();
  const dayIdx = (Math.abs(new Date(tStr) - new Date(TRIP_START)) / 86400000) % TAPAS_LIST.length;
  const item = TAPAS_LIST[Math.floor(dayIdx)] || TAPAS_LIST[0];
  const doneKey = 'tapa|' + tStr;
  const isDone = ledgerHas(doneKey);

  view(`${back('#/', '首頁')}<h1>今日美味 Tapa 刮刮樂</h1>
    <p class="sub">為爸媽和弟弟量身設計的美食與好運小事！</p>
    ${safetyBannerHtml()}

    <div class="scratch-box" id="sbox">
      <div class="scratch-content">
        <div class="scratch-emoji">${item.icon}</div>
        <div class="scratch-title">${item.name}</div>
        <div class="scratch-desc">${item.desc}</div>
        <div style="margin-top:16px">
          ${isDone ? '<span class="chip good">✨ 今日已達成 +20分！</span>'
                   : '<button class="btn block" id="btn-tapa-done">今天嚐到了 / 做到了！+20 分</button>'}
        </div>
      </div>
      <div class="scratch-cover" id="scover">
        <div style="font-size:48px">🎁</div>
        <div class="cover-txt">👆 點擊刮開今日好運美味</div>
        <p style="font-size:13px;opacity:.9;margin-top:6px">點一下揭曉今日專屬好運美味</p>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3>💡 專為大家打造的溫馨小儀式</h3>
      <p class="sub">出國旅行最幸福的就是每一頓好吃的和舒服的陽光。每天早上點開刮一刮，帶著弟弟和爸媽一起找尋今天的美食吧！</p>
    </div>`);

  const cover = $('#scover');
  cover.onclick = () => {
    cover.classList.add('scratched');
  };
  const doneBtn = $('#btn-tapa-done');
  if (doneBtn) {
    doneBtn.onclick = () => {
      award({ key: doneKey, points: 20, label: '今日美味：' + item.name });
      toast('太棒了！已計入家族分數 +20');
      location.hash = '#/tapa';
    };
  }
  return 'tools';
});

/* ---------- ROUTE: /flags (城市旗幟與傳奇故事・街頭打卡) ---------- */
route('/flags', async () => {
  const streak = getStreak();
  let capturedCount = 0;

  const rows = await Promise.all(FLAGS_LIST.map(async (f, i) => {
    const unlocked = i < streak;
    const blob = await DB.flagGet(f.id);
    const hasPhoto = !!blob;
    if (hasPhoto) capturedCount++;

    let photoHtml = '';
    if (hasPhoto) {
      const u = URL.createObjectURL(blob);
      photoHtml = `
        <div class="flag-visual-box">
          <div class="flag-visual-label">📸 我的街頭實拍</div>
          <div class="flag-user-frame has-photo">
            <img src="${u}" alt="街頭實拍：${esc(f.title)}">
            <span class="flag-captured-badge">✅ 街頭已捕獲！</span>
          </div>
          <label class="btn small ghost" style="margin-top:8px;width:100%;cursor:pointer">
            🔄 更換照片
            <input type="file" accept="image/*" class="flag-file-input" data-id="${f.id}" hidden>
          </label>
        </div>`;
    } else {
      photoHtml = `
        <div class="flag-visual-box">
          <div class="flag-visual-label">📸 街頭尋寶打卡</div>
          <div class="flag-user-frame">
            <div class="flag-empty-hint">在建築、陽台或街頭看見它？拍下照片解鎖打卡！</div>
          </div>
          <label class="btn small" style="margin-top:8px;width:100%;cursor:pointer">
            📷 街頭捕獲上傳 (+20分)
            <input type="file" accept="image/*" class="flag-file-input" data-id="${f.id}" hidden>
          </label>
        </div>`;
    }

    const loreHtml = unlocked ? `
      <div class="flag-lore">
        <div class="flag-lore-sec"><b>📜 紋章由來：</b>${esc(f.origin)}</div>
        <div class="flag-lore-sec"><b>🔍 街頭尋寶：</b>${esc(f.spotGuide)}</div>
        <div class="flag-lore-sec"><b>💡 奇聞冷知識：</b>${esc(f.trivia)}</div>
      </div>` : `
      <div class="flag-lore" style="opacity:.65">
        <div class="flag-lore-sec">🔒 <b>第 ${i + 1} 天解鎖：</b>連續登入打卡至第 ${i + 1} 天，即可解鎖完整的歷史傳奇、街頭尋寶攻略與奇聞冷知識。</div>
      </div>`;

    return `<div class="flag-card ${unlocked ? '' : 'locked'}">
      <div class="flag-header">
        <div class="flag-title-wrap">
          <span class="chip" style="font-size:12px;font-weight:700;margin-bottom:4px">${f.kind === 'flag' ? '🚩 真實旗幟 No.' + f.id : '🔣 城市符碼 No.' + f.id}</span>
          <div class="flag-title">${esc(f.title)}</div>
          <div class="flag-city">📍 ${esc(f.city)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <span class="chip ${unlocked ? 'good' : ''}">${unlocked ? '🔥 今日已點亮' : '第 ' + (i + 1) + ' 天解鎖'}</span>
          ${hasPhoto ? '<span class="chip good" style="font-size:12px">✅ 實拍已收錄</span>' : ''}
        </div>
      </div>

      <div class="flag-visual-grid">
        <div class="flag-visual-box">
          <div class="flag-visual-label">${f.kind === 'flag' ? '📖 旗幟示意圖' : '📖 符碼示意圖'}</div>
          <div class="flag-guide-frame">
            ${getFlagSvg(f.id)}
          </div>
          <div class="sub" style="font-size:11.5px;margin-top:6px;color:var(--muted)">${f.kind === 'flag' ? '照這個樣子在街頭找真的旗子' : '這不是正式旗幟，是代表這裡的符碼；街頭要找的是相關的雕刻、徽章或建築'}</div>
        </div>
        ${photoHtml}
      </div>

      ${loreHtml}
    </div>`;
  }));

  view(`${back('#/', '首頁')}<h1>城市旗幟與符碼</h1>
    <p class="sub">西班牙與地中海 30 個旗幟和符碼。標「🚩 真實旗幟」的是真的存在、街上看得到的旗子；標「🔣 城市符碼」的不是正式旗幟，而是代表這座城市的圖案、建築或故事。每天解鎖一個，在街頭找到就拍照打卡！</p>
    ${safetyBannerHtml()}
    <div class="card" style="display:flex;justify-content:space-around;text-align:center;padding:14px;margin-bottom:16px">
      <div><div class="sub">連續打卡進度</div><div style="font-size:26px;font-weight:900;color:var(--primary)">🔥 ${streak} / 30 天</div></div>
      <div style="border-left:1px solid var(--line)"></div>
      <div><div class="sub">街頭實拍捕獲</div><div style="font-size:26px;font-weight:900;color:var(--good)">📸 ${capturedCount} / 30 個</div></div>
    </div>
    <div class="stack">${rows.join('')}</div>`);

  $$('.flag-file-input').forEach((input) => {
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const id = input.dataset.id;
      await DB.flagPut(id, f);
      award({ key: 'flag|' + id, points: 20, label: '街頭捕獲：' + FLAGS_LIST[id - 1].title });
      toast('🎉 成功在街頭打卡：' + FLAGS_LIST[id - 1].title + '！+20 分');
      location.hash = '#/flags';
    };
  });

  return 'tools';
});

/* ---------- UNIFIED DEX CENTER (蒐集圖鑑：西班牙大圖鑑 + 世界遺產 + 郵輪大圖鑑) ---------- */
async function renderUnifiedDex(tab = 'spain', subTab = 'free') {
  if (tab === 'cruise') {
    return renderCruiseDex(subTab || 'free');
  }

  const dexTabsHeader = `
    <div class="dex-main-tabs">
      <a class="${tab === 'spain' ? 'on' : ''}" href="#/pokedex/spain">🇪🇸 西班牙大圖鑑</a>
      <a class="${tab === 'unesco' ? 'on' : ''}" href="#/pokedex/unesco">🏛️ 世界遺產圖鑑</a>
      <a class="${tab === 'cruise' ? 'on' : ''}" href="#/pokedex/cruise">🚢 郵輪大圖鑑</a>
    </div>
  `;

  if (tab === 'unesco') {
    let capturedCount = 0;
    const cardsHtml = await Promise.all(UNESCO_ITEMS.map(async (u) => {
      const blob = await DB.pokeGet('unesco:' + u.id);
      const unlocked = !!blob;
      if (unlocked) capturedCount++;

      let imgTag = '';
      if (blob) {
        const url = URL.createObjectURL(blob);
        imgTag = `<img class="unesco-thumb" src="${url}" alt="${esc(u.name)}">`;
      }

      return `
        <div class="unesco-card ${unlocked ? 'unlocked' : ''}">
          <div class="unesco-head">
            <div>
              <span class="chip" style="font-size:11px;font-weight:700">🏛️ UNESCO · ${esc(u.year)}</span>
              <div class="unesco-title" style="margin-top:4px">${u.icon} ${esc(u.name)}</div>
              <div class="unesco-en">${esc(u.en)}</div>
            </div>
            <span class="chip ${unlocked ? 'good' : ''}" style="font-size:12px;white-space:nowrap">📍 ${esc(u.city)}</span>
          </div>
          <div class="unesco-desc">${esc(u.desc)}</div>
          <div class="unesco-spot"><b>📸 打卡重點：</b>${esc(u.spot)}</div>
          ${imgTag}
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span class="sub" style="font-size:12.5px;color:var(${unlocked ? '--good' : '--muted'})">${unlocked ? '✅ 世界遺產現場已收錄！' : '尚未收錄現場照片'}</span>
            <label class="btn small ${unlocked ? 'ghost' : ''}" style="cursor:pointer">
              ${unlocked ? '🔄 更換照片' : '📷 打卡收錄 (+20分)'}
              <input type="file" accept="image/*" class="unesco-file-input" data-id="${u.id}" hidden>
            </label>
          </div>
        </div>
      `;
    }));

    view(`${back('#/', '首頁')}<h1>🏆 家族旅行蒐集圖鑑</h1>
      <p class="sub">西班牙與地中海旅行見聞全收錄！</p>
      ${dexTabsHeader}
      <div class="card" style="display:flex;justify-content:space-around;text-align:center;padding:14px;margin-bottom:14px">
        <div><div class="sub">世界遺產總數</div><div style="font-size:24px;font-weight:900;color:var(--primary)">17 處</div></div>
        <div style="border-left:1px solid var(--line)"></div>
        <div><div class="sub">現場拍照點亮</div><div style="font-size:24px;font-weight:900;color:var(--good)">📸 ${capturedCount} / 17 處</div></div>
      </div>
      <p class="sub" style="font-size:13px;line-height:1.55;margin-bottom:12px">本次西班牙與地中海航程，橫跨西、法、義、突四國，沿途共經過 17 處獲聯合國教科文組織認定的世界文化與自然遺產。只要在現場拍攝打卡，即可點亮圖鑑並獲得 20 分！</p>
      ${safetyBannerHtml()}
      <div class="unesco-grid">${cardsHtml.join('')}</div>`);

    $$('.unesco-file-input').forEach((input) => {
      input.onchange = async () => {
        const f = input.files && input.files[0];
        if (!f) return;
        const id = input.dataset.id;
        const item = UNESCO_ITEMS.find((x) => x.id === id);
        await DB.pokePut('unesco:' + id, f);
        award({ key: 'unesco|' + id, points: 20, label: '世界遺產：' + item.name });
        toast('🎉 成功收錄世界遺產：' + item.name + '！+20 分');
        renderUnifiedDex('unesco');
      };
    });
    return 'tools';
  }

  // Default: spain tab
  let capturedCount = 0;
  const cardsHtml = await Promise.all(POKEDEX_ITEMS.map(async (p) => {
    const key = 'poke:' + p.id;
    const blob = await DB.pokeGet(key);
    const unlocked = !!blob;
    if (unlocked) capturedCount++;
    let imgTag = '';
    if (blob) {
      const u = URL.createObjectURL(blob);
      imgTag = `<img class="poke-thumb" src="${u}" alt="${p.name}">`;
    }
    return `<div class="poke-card ${unlocked ? 'unlocked' : 'locked'}" data-pid="${p.id}">
      <div class="poke-icon">${p.icon}</div>
      <div class="poke-name">${esc(p.name)}</div>
      <div class="poke-sub">${esc(p.desc)}</div>
      ${imgTag}
      <label class="btn small ${unlocked ? 'ghost' : ''}" style="margin-top:6px;width:100%;cursor:pointer">
        ${unlocked ? '換照片' : '📷 打卡點亮'}
        <input type="file" accept="image/*" class="poke-input" data-id="${p.id}" hidden>
      </label>
    </div>`;
  }));

  view(`${back('#/', '首頁')}<h1>🏆 家族旅行蒐集圖鑑</h1>
    <p class="sub">西班牙與地中海旅行見聞全收錄！</p>
    ${dexTabsHeader}
    <div class="card" style="display:flex;justify-content:space-around;text-align:center;padding:12px;margin-bottom:14px">
      <div><div class="sub">標誌事物總數</div><div style="font-size:24px;font-weight:900;color:var(--primary)">30 款</div></div>
      <div style="border-left:1px solid var(--line)"></div>
      <div><div class="sub">已拍照點亮</div><div style="font-size:24px;font-weight:900;color:var(--good)">✨ ${capturedCount} / 30 款</div></div>
    </div>
    ${safetyBannerHtml()}
    <div style="margin-bottom:14px;display:flex;gap:10px">
      <button class="btn ghost block" id="btn-polaroid" type="button">📸 產生今日回憶拍立得</button>
    </div>
    <div id="polaroid-box"></div>
    <div class="pokedex-grid">${cardsHtml.join('')}</div>`);

  $$('.poke-input').forEach((input) => {
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const id = input.dataset.id;
      await DB.pokePut('poke:' + id, f);
      award({ key: 'pokedex|' + id, points: 20, label: '圖鑑點亮：' + POKEDEX_ITEMS[id - 1].name });
      toast('🎉 成功點亮圖鑑：' + POKEDEX_ITEMS[id - 1].name + '！+20 分');
      renderUnifiedDex('spain');
    };
  });

  $('#btn-polaroid').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const u = URL.createObjectURL(f);
      const caption = prompt('寫一句拍立得手寫話：', '¡Hola España!') || 'España 2026';
      $('#polaroid-box').innerHTML = `
        <div class="polaroid">
          <img src="${u}" alt="Polaroid">
          <div class="polaroid-caption">${esc(caption)}</div>
          <div class="polaroid-date">📍 España • ${today()}</div>
        </div>
      `;
    };
    input.click();
  };
  return 'tools';
}

route('/pokedex', () => renderUnifiedDex('spain'));
route('/pokedex/:tab', (tab) => renderUnifiedDex(tab));
route('/pokedex/:tab/:sub', (tab, sub) => renderUnifiedDex(tab, sub));

/* ---------- RENDER AIRPORTS (四大國際機場手帳：建築、總體經濟與文化觀察) ---------- */
/* ---------- v2.4：EES 通關須知（機場手帳最上方）與桃園機場世界名次多選題 ---------- */
const EES_HTML = `
  <div class="ees-box">
    <b class="ees-title">🛂 歐洲最新數位邊境 EES 通關須知（重要行前心理準備）</b>
    <p>歐盟的數位出入境系統（EES）從 2026 年 4 月 10 日起在所有申根區外部邊境全面上路，用數位建檔取代在護照上蓋章。目的是精準抓出超過 90 天免簽停留的人，也用臉和指紋防止護照被冒用（至於有沒有用又是另外一個話題了）。</p>
    <ul>
      <li><b>採樣流程</b>：在自助機台（Kiosk）先掃描護照照片頁，<b>脫下口罩、帽子和眼鏡</b>直視鏡頭拍臉，再依螢幕指示把<b>手指平貼在發綠光的感應板上</b>壓指紋（放平，不要懸空，也不要用力摩擦），最後到海關櫃檯讓關員覆核。</li>
      <li><b>第一次最久</b>：第一次入境要完整建檔，比較花時間。如果剛好好幾架長程大飛機一起到，非歐盟旅客的隊伍可能要排 1 到 2 小時（要是前面有人機器出問題會更久。來到歐洲請凡事放寬心，這裡的效率沒有臺灣高）。</li>
      <li><b>先做好準備</b>：飛機降落前或剛下飛機就先去洗手間；排隊時備妥英文行程單、回程機票和保險資料。</li>
      <li><b>離開時也要記錄</b>：出境離開申根區時（例如馬德里回臺灣），系統也會再記錄一次。郵輪組停靠突尼西亞（不在申根區），回到歐洲時要怎麼查驗，請聽船上的廣播安排。</li>
    </ul>
  </div>`;

const TPE_QUIZ = [
  {
    id: 'top3',
    title: '🥇 哪些項目，桃園機場曾拿下「全世界前 3 名」？',
    hint: '可以複選，5 個選項。',
    pass: 'top 3',
    opts: [
      { t: 'Skytrax 全球最佳行李運送機場', ok: true, r: '第 1 名（2025、2026 連續兩年）' },
      { t: 'Skytrax 全球進步最多機場', ok: true, r: '第 3 名（2026）；2025 年是第 5 名' },
      { t: '全球最友善機場（英國 APH 依 Google 評論統計）', ok: true, r: '第 1 名（2025）' },
      { t: 'Skytrax 全球最佳出入境查驗（證照查驗）', ok: false, r: '第 4 名（2025），差一點點！2026 年是第 7 名' },
      { t: 'Skytrax 全球最乾淨機場', ok: false, r: '第 6 名（2026）；2025 年是第 9 名' },
    ],
  },
  {
    id: 'top50',
    title: '🏅 哪些項目，桃園機場進了「全世界前 50 名」？',
    hint: '可以複選，15 個選項。注意年份！',
    pass: 'top 50',
    opts: [
      { t: '2026 Skytrax 全球最佳機場（總排名）', ok: true, r: '第 24 名（2026）' },
      { t: '2025 Skytrax 全球最佳機場（總排名）', ok: true, r: '第 43 名（2025）' },
      { t: '2024 Skytrax 全球最佳機場（總排名）', ok: false, r: '第 66 名（2024）' },
      { t: '2023 Skytrax 全球最佳機場（總排名）', ok: false, r: '第 82 名（2023）' },
      { t: '2022 Skytrax 全球最佳機場（總排名）', ok: false, r: '第 67 名（2022）' },
      { t: '2024 Skytrax 全球最佳行李運送', ok: true, r: '第 8 名（2024），隔年就衝到第 1' },
      { t: '2025 Skytrax 全球最佳出入境查驗', ok: true, r: '第 4 名（2025）' },
      { t: '2026 Skytrax 全球最佳出入境查驗', ok: true, r: '第 7 名（2026）' },
      { t: '2026 Skytrax 全球最乾淨機場', ok: true, r: '第 6 名（2026）' },
      { t: '2026 Skytrax 全球最佳機場員工', ok: true, r: '第 6 名（2026）' },
      { t: '2026 Skytrax 全球最佳機場洗手間', ok: true, r: '第 8 名（2026）；2025 年是第 9 名' },
      { t: '2026 Skytrax 全球最適合親子的機場', ok: true, r: '第 10 名（2026）' },
      { t: '2026 Skytrax 全球最佳機場購物', ok: true, r: '第 10 名（2026）' },
      { t: '2024 國際旅客人數（國際機場協會 ACI）', ok: true, r: '第 13 名（2024，約 4,470 萬人次）' },
      { t: '2024 航空貨運量（國際機場協會 ACI）', ok: true, r: '第 10 名（2024，約 227 萬公噸）' },
    ],
  },
];

function tpeQuizHtml() {
  return TPE_QUIZ.map((q) => {
    const st = LS.get('tpeq:' + S.player + ':' + q.id, null);
    const done = !!(st && st.done);
    const picked = (st && st.picked) || [];
    const opts = q.opts.map((o, i) => {
      const on = picked.includes(i);
      let cls = '';
      let tag = '';
      if (done) {
        cls = o.ok ? (on ? ' right' : ' missed') : (on ? ' wrong' : ' plain');
        tag = `<span class="mq-rank">${o.ok ? '✅ ' : '❌ '}${esc(o.r)}</span>`;
      }
      return `<label class="mq-opt${cls}"><input type="checkbox" data-q="${q.id}" value="${i}"${on ? ' checked' : ''}${done ? ' disabled' : ''}><span class="mq-t">${esc(o.t)}</span>${tag}</label>`;
    }).join('');
    let res = '';
    if (done) {
      const right = q.opts.filter((o, i) => o.ok === picked.includes(i)).length;
      res = `<div class="mq-res">你答對了 ${right} / ${q.opts.length} 個選項${right === q.opts.length ? '，全對！🎉' : '。綠色框是應該選的，紅色框是不該選的。'}</div>
        <button type="button" class="btn small ghost" data-mq-reset="${q.id}">重新作答</button>`;
    } else {
      res = `<button type="button" class="btn block" data-mq-check="${q.id}">公布答案</button>`;
    }
    return `<div class="card mq-card"><h3>${q.title}</h3><p class="sub">${q.hint}</p><div class="mq-opts">${opts}</div>${res}</div>`;
  }).join('') + `<p class="sub" style="font-size:12.5px;margin:-6px 0 16px">資料來源：Skytrax 世界機場大獎 2022–2026、國際機場協會（ACI）2024 年統計、英國 APH 2025 年調查，經中央社、公視、台北時報等媒體報導。</p>`;
}

function bindTpeQuiz() {
  $$('[data-mq-check]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.mqCheck;
      const q = TPE_QUIZ.find((x) => x.id === id);
      const picked = $$(`input[data-q="${id}"]`).filter((x) => x.checked).map((x) => +x.value);
      if (!picked.length) { toast('先勾選至少一個選項喔'); return; }
      LS.set('tpeq:' + S.player + ':' + id, { done: true, picked });
      const allRight = q.opts.every((o, i) => o.ok === picked.includes(i));
      if (allRight) award({ key: 'tpe_quiz_' + id, points: 20, label: '桃園機場世界名次全對（' + q.pass + '）' });
      renderAirports('tpe').then(() => { const el = $(`[data-mq-reset="${id}"]`); if (el) el.closest('.mq-card').scrollIntoView({ block: 'start' }); });
    };
  });
  $$('[data-mq-reset]').forEach((b) => {
    b.onclick = () => { LS.set('tpeq:' + S.player + ':' + b.dataset.mqReset, null); renderAirports('tpe'); };
  });
}

async function renderAirports(activeId = 'tpe') {
  activeId = activeId || 'tpe';
  const airport = AIRPORTS_DATA.find((a) => a.id === activeId) || AIRPORTS_DATA[0];

  // Navigation tabs
  const tabsHtml = AIRPORTS_DATA.map((a) => {
    const on = a.id === airport.id;
    return `<a class="airport-pill ${on ? 'on' : ''}" href="#/airports/${a.id}">${a.flag} ${a.code}</a>`;
  }).join('');

  // TPE Gate selection state
  const savedGateId = LS.get('tpe_gate_theme', '');
  const savedGateCustom = LS.get('tpe_gate_custom', '');

  // Photos from DB
  const departureBlob = await DB.get('photo:tpe_departure');
  const airportBlob = activeId !== 'tpe' ? await DB.get('photo:airport:' + activeId) : null;

  let departurePhotoHtml = '';
  if (departureBlob) {
    const u = URL.createObjectURL(departureBlob);
    departurePhotoHtml = `
      <div class="polaroid" style="margin:14px auto 8px">
        <img src="${u}" alt="桃園機場啟程大合照">
        <div class="polaroid-caption">啟程出發！¡Vamos! ✈️</div>
        <div class="polaroid-date">📍 桃園國際機場 • ${fmtDate(TRIP_START)}</div>
      </div>
    `;
  }

  let airportPhotoHtml = '';
  if (airportBlob) {
    const u = URL.createObjectURL(airportBlob);
    airportPhotoHtml = `
      <div class="polaroid" style="margin:14px auto 8px">
        <img src="${u}" alt="${esc(airport.name)}">
        <div class="polaroid-caption">${esc(airport.code)} 旅途足跡 📸</div>
        <div class="polaroid-date">📍 ${esc(airport.name)}</div>
      </div>
    `;
  }

  // TPE specific gate chips & interactive upload
  let gateSelectionHtml = '';
  if (airport.id === 'tpe') {
    const gateChips = airport.gates.map((g) => {
      const on = g.id === savedGateId;
      return `<button type="button" class="gate-chip-item ${on ? 'on' : ''}" data-gate-id="${g.id}">
        <div class="gate-chip-code">${esc(g.name.split(' ')[0])} ${on ? '✓' : ''}</div>
        <div class="gate-chip-name">${esc(g.name.split(' ').slice(1).join(' '))}</div>
        <div class="gate-chip-desc">${esc(g.desc)}</div>
      </button>`;
    }).join('');

    gateSelectionHtml = `
      <div class="card" style="margin-bottom:16px;background:var(--card-hover)">
        <h3 style="margin:0 0 6px">🏮 候機門臺灣文化主題探索</h3>
        <p class="sub" style="margin:0 0 12px">桃園機場有幾個臺灣文化主題角落。候機時去逛逛，點選你們找到的那一個，就能看到它在西班牙和地中海的「遠房親戚」（位置以現場為準，不在你們的登機門附近也沒關係）：</p>
        <div class="gate-chips-wrap">${gateChips}</div>
        ${(() => { const g = airport.gates.find((x) => x.id === savedGateId); return g && g.link ? `<div class="gate-link"><b>🔗 旅途上的遠房親戚</b><br>${esc(g.link)}</div>` : ''; })()}
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
          <input type="text" id="tpe-gate-custom" class="text" style="flex:1" placeholder="或寫下你們發現的其他角落（例如：登機門旁的一面藝術牆）" value="${esc(savedGateCustom)}">
          <button type="button" class="btn small" id="btn-save-gate">儲存</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary)">
        <h3 style="margin:0 0 6px">👨‍👩‍👧‍👦 啟程出發儀式：大家的第一張大合照</h3>
        <p class="sub" style="margin:0 0 12px">在候機室的特色文化牆前，7 個人圍在一起拍下出發前的大合照！上傳立得 50 分！</p>
        <label class="btn block ${departureBlob ? 'ghost' : ''}" style="cursor:pointer">
          ${departureBlob ? '🔄 更換大合照' : '📷 拍照 / 上傳啟程大合照 (+50分)'}
          <input type="file" accept="image/*" id="tpe-departure-input" hidden>
        </label>
        <div id="tpe-photo-box">${departurePhotoHtml}</div>
      </div>
      ${tpeQuizHtml()}
    `;
  } else {
    // Non-TPE airport photo upload
    gateSelectionHtml = `
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary)">
        <h3 style="margin:0 0 6px">📸 ${airport.code} 機場建築與旅程打卡</h3>
        <p class="sub" style="margin:0 0 12px">拍下這座世界級機場的壯麗屋頂、天光或家人候機的身影，上傳立得 30 分！</p>
        <label class="btn block ${airportBlob ? 'ghost' : ''}" style="cursor:pointer">
          ${airportBlob ? '🔄 更換機場照片' : '📷 拍照 / 上傳機場打卡照 (+30分)'}
          <input type="file" accept="image/*" id="airport-photo-input" hidden>
        </label>
        <div id="airport-photo-box">${airportPhotoHtml}</div>
      </div>
    `;
  }

  view(`
    ${back('#/', '首頁')}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px">
      <div>
        <h1 style="margin:0">✈️ 四大國際機場手帳</h1>
        <p class="sub" style="margin:4px 0 0">走過桃園、杜拜、巴塞隆納與馬德里，用建築美學與文化視野開啟 30 天壯遊</p>
      </div>
    </div>

    ${EES_HTML}

    <!-- Navigation pills -->
    <div class="airport-pill-nav">${tabsHtml}</div>

    <!-- Airport Card -->
    <div class="airport-card">
      <div class="airport-header">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="airport-code-badge">${airport.flag} ${airport.code}</div>
          <span class="chip warn">${esc(airport.role)}</span>
        </div>
        <div class="airport-title">${esc(airport.name)}</div>
        <div class="airport-subtitle">${esc(airport.nameEn)} • ${esc(airport.terminal)}</div>
      </div>

      <!-- Interactive Gate / Photo Section -->
      ${gateSelectionHtml}

      <!-- Lore & Macroeconomics & Anthropology -->
      <div style="font-size:16px;line-height:1.7;color:var(--fg);margin-bottom:16px">
        ${airport.lore}
      </div>

      <!-- Architecture Highlight Card (if separate) -->
      ${airport.architecture ? `
      <div style="background:var(--card-hover);border-radius:var(--r-sm);border:1px solid var(--line);padding:14px;font-size:15px;line-height:1.65;color:var(--fg);margin-top:14px">
        ${airport.architecture}
      </div>` : ''}
    </div>
  `);

  // Event bindings
  if (airport.id === 'tpe') {
    $$('.gate-chip-item').forEach((btn) => {
      btn.onclick = () => {
        const gid = btn.dataset.gateId;
        LS.set('tpe_gate_theme', gid);
        const gObj = airport.gates.find((g) => g.id === gid);
        award({ key: 'tpe_gate_pick', points: 15, label: '候機門文化探索：' + (gObj ? gObj.name : gid) });
        toast('🎉 已選定候機門：' + (gObj ? gObj.name : gid) + '！+15 分');
        renderAirports('tpe');
      };
    });
    bindTpeQuiz();

    const btnSaveGate = $('#btn-save-gate');
    if (btnSaveGate) {
      btnSaveGate.onclick = () => {
        const val = ($('#tpe-gate-custom').value || '').trim();
        LS.set('tpe_gate_custom', val);
        toast('已儲存自填候機門主題：' + val);
      };
    }

    const tpeInput = $('#tpe-departure-input');
    if (tpeInput) {
      tpeInput.onchange = async () => {
        const file = tpeInput.files && tpeInput.files[0];
        if (!file) return;
        await DB.put('photo:tpe_departure', file);
        award({ key: 'tpe_departure_photo', points: 50, label: '桃園機場啟程大合照' });
        toast('🎉 出發大合照上傳成功！+50 分');
        renderAirports('tpe');
      };
    }
  } else {
    const aInput = $('#airport-photo-input');
    if (aInput) {
      aInput.onchange = async () => {
        const file = aInput.files && aInput.files[0];
        if (!file) return;
        await DB.put('photo:airport:' + airport.id, file);
        award({ key: 'airport_photo|' + airport.id, points: 30, label: airport.name + ' 打卡' });
        toast('🎉 ' + airport.code + ' 機場打卡照片已儲存！+30 分');
        renderAirports(airport.id);
      };
    }
  }

  return 'tools';
}

route('/airports', () => { renderAirports('tpe'); return 'tools'; });
route('/airports/:id', (id) => { renderAirports(id); return 'tools'; });


/* ---------- tools (遊戲間) ---------- */
const SECRET_TASKS = [
  '讓一位家人不知不覺說出「好好吃」三次。',
  '偷拍到一位家人打哈欠的瞬間。',
  '讓一位家人跟一座雕像擺一樣的姿勢合照，不能說是任務。',
  '讓大家在同一張照片裡同時比 YA。',
  '用當地話跟 3 個不同的人說謝謝，並寫下他們是誰（例如：餐廳服務生）。',
  '讓一位家人幫你拍一張「你和一扇藍色的門」。',
  '偷拍到一位家人吃東西吃到一半的瞬間。',
  '讓一位家人在無任何提示的情況下，說出今天所有的景點。',
  '晚餐時讓大家討論 30 秒「今天學到的一件事」。',
  '找一個你覺得最好笑的路牌，讓一位家人跟它合照。',
  '讓家人用你的手機幫你拍一張跳起來的照片。',
  '收集 3 張不同的票根或收據，全部拍進同一張照片裡上傳。',
  '讓兩位家人在照片裡擁抱。',
  '讓一位家人用「累」以外的形容詞形容今天。',
  '偷偷記下一位家人今天說了幾次「好漂亮」，晚上公布。',
  '讓一位家人陪你買一樣東西，不能說是任務。',
  '拍到一位家人和街頭藝人的合照。',
  '讓一張大合照裡每個人身上都有紅色。',
  '讓一位家人請你喝一杯飲料。',
  '拍到一位家人認真看地圖的照片。',
  '今天幫每位家人各拍一張「最佳照片」。',
  '讓一位家人跟你學一句西班牙文或加泰隆尼亞文。',
  '拍到一張鐘樓和家人的合照。',
  '讓一位家人說出今天答錯的一題。',
  '偷拍到一位家人笑到眼睛瞇起來。',
  '在噴泉邊讓一位家人丟硬幣許願，不能說是任務。',
  '跟一位家人交換一個小東西（糖果、明信片都可以）。',
  '讓同一位家人出現在今天 3 個不同地點的照片裡。',
  '讓一位家人模仿一幅畫或一張海報的動作，並拍下來。',
  '替一位家人想好一個今天的封號，當晚大家投票決定要不要用。',
];
route('/tools', () => {
  view(`<h1>遊戲間</h1><p class="sub">景點小遊戲和各種小任務都在這裡。分數會記在玩的人名下。</p>
    ${safetyBannerHtml()}
    <div class="list">
      <a class="item" href="#/tapa"><div class="t"><b>🍢 今日美味 Tapa 刮刮樂</b><span>每天刮開一道美味好運小事（最適合大家一起玩）</span></div>${CHEV}</a>
      <a class="item" href="#/pokedex"><div class="t"><b>🏆 家族旅行蒐集圖鑑</b><span>西班牙大圖鑑・世界遺產圖鑑・郵輪大圖鑑三合一</span></div>${CHEV}</a>
      <a class="item" href="#/money"><div class="t"><b>💰 記帳與分帳</b><span>誰先付、平分給誰，最後算兩家</span></div>${CHEV}</a>
      <a class="item" href="#/portroute/palermo"><div class="t"><b>🗺️ 巴勒摩下船路線</b><span>老城經典步行或蒙雷阿萊，兩種走法</span></div>${CHEV}</a>
      <a class="item" href="#/portroute/pompeii"><div class="t"><b>🏛️ 龐貝 2 小時古今對比路線</b><span>經典 7 站西進東出，含昔日風華與今日現場對照</span></div>${CHEV}</a>
      <a class="item" href="#/flags"><div class="t"><b>🚩 城市旗幟與符碼</b><span>30 天打卡收集真實旗幟、城市符碼與傳奇故事</span></div>${CHEV}</a>
      <a class="item" href="#/airports"><div class="t"><b>✈️ 四大國際機場手帳</b><span>桃園啟程大合照、杜拜轉機、巴塞隆納與馬德里建築手帳</span></div>${CHEV}</a>
      <a class="item" href="#/tool/wheel"><div class="t"><b>命運之輪</b><span>轉一次，轉到什麼就做什麼</span></div>${CHEV}</a>
      <a class="item" href="#/tool/price"><div class="t"><b>物價猜猜猜</b><span>手機輪流傳，每人偷偷輸入猜價</span></div>${CHEV}</a>
      <a class="item" href="#/tool/steps"><div class="t"><b>步數猜猜猜</b><span>進景點前猜，出來對答案</span></div>${CHEV}</a>
      <a class="item" href="#/tool/secret"><div class="t"><b>神秘任務</b><span>填一個你今天喜歡的數字，領取小任務</span></div>${CHEV}</a>
      <a class="item" href="#/tool/give"><div class="t"><b>給分</b><span>連連看、小小觀察家、當一次雕像等遊戲的勝利者</span></div>${CHEV}</a>
    </div>`);
  return 'tools';
});
const WHEEL_DEFAULT = [
  '負責今天所有的點餐',
  '找兩個家人一起跟一扇漂亮的門合照',
  '大家拍一張每個人姿勢都不同的照片',
  '與一個已經1000歲的東西合照',
  '找一個家人跟你一起模仿最近雕像的動作，並拍下來',
  '跟當地人學一句當地話',
];
route('/tool/wheel', () => {
  const def = LS.get('wheel2', WHEEL_DEFAULT);
  view(`${back('#/tools', '遊戲間')}${safetyBannerHtml()}<h1>命運之輪</h1>
    <div class="wheel-wrap"><canvas id="wh" width="640" height="640" aria-label="命運之輪"></canvas></div>
    <button class="btn block" id="spin">轉！</button>
    <div id="res" class="center" style="margin:16px 0"></div>
    <details class="read"><summary>修改輪盤上的選項</summary><div class="inner">
      <textarea class="text" id="opts">${esc(def.join('\n'))}</textarea>
      <p class="sub">一行一個，最多 10 個。有拍照的任務，轉到後要拍照上傳成功才加 20 分。</p>
      <button class="btn small" id="saveo">儲存</button></div></details>`);
  let items = def.slice(0, 10), angle = 0;
  const cv = $('#wh'), g = cv.getContext('2d');
  const colors = ['#E39B2D', '#8FA9A5', '#C8703A', '#CDBB9C', '#E7C27A', '#9AA39E', '#D9772B', '#B9A27E', '#F0B85E', '#7F9C98'];
  const draw = () => {
    const n = items.length, r = 300, cx = 320, cy = 320;
    g.clearRect(0, 0, 640, 640);
    for (let i = 0; i < n; i++) {
      const a0 = angle + (i / n) * Math.PI * 2, a1 = angle + ((i + 1) / n) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath();
      g.fillStyle = colors[i % colors.length]; g.fill();
      g.save(); g.translate(cx, cy); g.rotate((a0 + a1) / 2);
      g.fillStyle = '#FFFFFF'; g.font = 'bold 24px -apple-system, sans-serif'; g.textAlign = 'right';
      g.fillText(items[i].slice(0, 8), r - 16, 8); g.restore();
    }
    g.beginPath(); g.moveTo(cx + r - 10, cy); g.lineTo(cx + r + 18, cy - 16); g.lineTo(cx + r + 18, cy + 16); g.closePath();
    g.fillStyle = '#000'; g.fill();
  };
  draw();
  $('#spin').onclick = () => {
    const start = angle, total = Math.PI * 2 * (5 + Math.random() * 3), t0 = performance.now(), dur = 3500;
    $('#spin').disabled = true;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      angle = start + total * e; draw();
      if (p < 1) requestAnimationFrame(step);
      else {
        const n = items.length;
        const a = ((-angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const idx = Math.floor((a / (Math.PI * 2)) * n) % n;
        const text = items[idx];
        $('#res').innerHTML = `<div class="big-num" style="font-size:24px">${esc(text)}</div>
          <div class="task-box" id="wres" style="margin-top:12px"><div class="tc"></div></div>`;
        taskControl($('#wres'), { key: 'wheel|' + uid(), points: 20, label: '命運之輪：' + text, text, cardTitle: '命運之輪', theme: '命運之輪' });
        $('#spin').disabled = false;
      }
    };
    requestAnimationFrame(step);
  };
  $('#saveo').onclick = () => {
    items = $('#opts').value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (items.length < 2) { toast('至少要 2 個選項'); return; }
    LS.set('wheel2', items); draw(); toast('已儲存');
  };
  return 'tools';
});

function winnersHtml(kind) {
  const rows = LS.get('winners', []).filter((w) => w.tool === kind).slice().reverse();
  if (!rows.length) return '<p class="sub">還沒有得獎紀錄。</p>';
  return rows.map((w) => `<div class="score-row"><span class="name">${esc(w.item || '（未填）')}</span>
    <span class="sub">${esc(w.date)}</span><span class="pts">${esc(w.winner)}</span></div>`).join('');
}
function guessTool(kind) {
  const isPrice = kind === 'price';
  const fam = S.family.length ? S.family : [S.player];
  const late = cutoffPassed();
  view(`${back('#/tools', '遊戲間')}${safetyBannerHtml()}<h1>${isPrice ? '物價猜猜猜' : '步數猜猜猜'}</h1>
    <p class="sub">${isPrice ? '先不要看標價。手機輪流傳，每個人點自己的名字、偷偷輸入猜的價格（歐元）。' : '進景點前，每個人點自己的名字、偷偷輸入猜的步數。'}</p>
    ${cutoffText() ? `<p class="sub">每天下好離手的截止時間：台灣時間 ${esc(cutoffText())}</p>` : ''}
    ${late ? '<div class="card"><b>今天的截止時間已經過了，這次先不能再猜。</b></div>' : ''}
    ${isPrice ? '<div class="card center"><div class="sub">剩餘時間</div><div class="big-num" id="clock">60</div><button class="btn small ghost" id="startc">開始倒數一分鐘</button></div>' : ''}
    <div class="list" id="who">${fam.map((n) => `<button class="item" type="button" data-n="${esc(n)}" ${late ? 'disabled' : ''} style="width:100%;border:0;background:none;text-align:left"><div class="t"><b>${esc(n)}</b><span class="st">還沒猜</span></div></button>`).join('')}</div>
    <label class="field"><span>${isPrice ? '猜的是什麼東西（例如：一瓶水）' : '猜的是哪裡（例如：聖家堂）'}</span><input class="text" id="item"></label>
    <label class="field"><span>${isPrice ? '真正的價格（歐元）' : '實際步數'}</span><input class="text" id="real" inputmode="decimal"></label>
    <button class="btn block" id="rev">公布誰最接近</button><div id="win" style="margin-top:12px"></div>
    <h2>得獎紀錄</h2><div class="list" id="wlist">${winnersHtml(kind)}</div>`);
  const guesses = {};
  $$('#who [data-n]').forEach((b) => b.onclick = () => {
    if (cutoffPassed()) { toast('已經過截止時間'); return; }
    const n = b.dataset.n;
    const v = prompt(n + '，請偷偷輸入你的猜測（數字）');
    if (v == null) return;
    const num = parseFloat(String(v).replace(',', '.'));
    if (isNaN(num)) { toast('請輸入數字'); return; }
    guesses[n] = num;
    $('.st', b).textContent = '已鎖定';
  });
  if (isPrice) {
    let tm;
    $('#startc').onclick = () => {
      let s = 60; $('#clock').textContent = s; clearInterval(tm);
      tm = setInterval(() => { s--; $('#clock').textContent = Math.max(0, s); if (s <= 0) { clearInterval(tm); toast('時間到！'); } }, 1000);
    };
  }
  $('#rev').onclick = () => {
    const real = parseFloat(String($('#real').value).replace(',', '.'));
    const names = Object.keys(guesses);
    if (isNaN(real) || !names.length) { toast('要先有人猜，也要輸入答案'); return; }
    names.sort((a, b) => Math.abs(guesses[a] - real) - Math.abs(guesses[b] - real));
    const best = names[0];
    const item = $('#item').value.trim();
    $('#win').innerHTML = `<div class="card"><h3>最接近：${esc(best)}</h3>
      ${names.map((n) => `<div>${esc(n)}：${guesses[n]}（差 ${Math.round(Math.abs(guesses[n] - real) * 100) / 100}）</div>`).join('')}
      <button class="btn small" id="give" style="margin-top:10px">給 ${esc(best)} 20 分並記下來</button></div>`;
    $('#give').onclick = () => {
      const label = (isPrice ? '物價猜猜猜' : '步數猜猜猜') + (item ? '：' + item : '') + ' 冠軍';
      award({ key: kind + '|' + item + '|' + today() + '|' + best, points: 20, label, player: best, unique: true });
      const w = LS.get('winners', []);
      w.push({ tool: kind, item, winner: best, real, date: today() });
      LS.set('winners', w);
      $('#give').disabled = true;
      $('#wlist').innerHTML = winnersHtml(kind);
    };
  };
}
route('/tool/price', () => { guessTool('price'); return 'tools'; });
route('/tool/steps', () => { guessTool('steps'); return 'tools'; });
route('/tool/secret', () => {
  view(`${back('#/tools', '遊戲間')}${safetyBannerHtml()}<h1>神秘任務</h1>
    <p class="sub">填一個你今天喜歡的數字（1 到 ${SECRET_TASKS.length} 之間，或任何數字都可以），就會抽到一個小任務。</p>
    <label class="field"><span>你今天喜歡的數字</span><input class="text" id="no" inputmode="numeric"></label>
    <button class="btn block" id="sec" type="button">領取任務</button>
    <div id="secout" style="margin-top:12px"></div>`);
  $('#sec').onclick = () => {
    const n = parseInt($('#no').value, 10);
    if (isNaN(n)) { toast('請先填一個數字'); return; }
    const idx = ((n - 1) % SECRET_TASKS.length + SECRET_TASKS.length) % SECRET_TASKS.length;
    const text = SECRET_TASKS[idx];
    $('#secout').innerHTML = `<div class="card"><h3>神秘任務 #${idx + 1}</h3><p>${esc(text)}</p>
      <input class="text task-note" placeholder="寫下細節（選填，例如名字）">
      <div class="task-box"><div class="tc"></div></div></div>`;
    taskControl($('#secout .task-box'), { key: 'secret|' + (idx + 1), points: 30, label: '神秘任務 #' + (idx + 1) + '：' + text, text, cardTitle: '神秘任務', theme: '神秘任務' });
  };
  return 'tools';
});
route('/tool/give', () => {
  const fam = S.family.length ? S.family : [S.player];
  view(`${back('#/tools', '遊戲間')}<h1>給分</h1><p class="sub">連連看、小小觀察家、特寫尋寶、當一次雕像等遊戲的勝利者。</p>
    <label class="field"><span>給誰</span><select class="text" id="who">${fam.map((n) => `<option>${esc(n)}</option>`).join('')}</select></label>
    <label class="field"><span>幾分</span><select class="text" id="pts"><option>5</option><option>10</option><option>15</option><option selected>20</option><option>30</option></select></label>
    <label class="field"><span>原因</span><input class="text" id="why" placeholder="例如：小小觀察家第一名"></label>
    <button class="btn block" id="go">給分</button>`);
  $('#go').onclick = () => {
    award({ key: 'give', points: parseInt($('#pts').value, 10), label: $('#why').value.trim() || '遊戲加分', player: $('#who').value, unique: false });
  };
  return 'tools';
});

/* ---------- wall / leaderboard ---------- */
let wallTimer = null;
function commentsFor(fileId) { return META.comments[fileId] || []; }
route('/wall', () => {
  view(`<h1>排行與動態牆</h1><p class="sub" id="ws">讀取中…</p>
    <h2>總分</h2><div class="list" id="board"></div>
    <h2>最近得分</h2><div class="list" id="recent"></div>
    <h2>大家最常 WoW 記的冷知識</h2><div class="list" id="facts"></div>
    <h2>大家的九宮格</h2><p class="sub">看完可以留一句評語，每張照片留言一次就 +5 分。</p><div class="wall-grid" id="pics"></div>
    <button class="btn ghost block" id="rf" style="margin-top:16px">重新整理</button>`);
  const paintBoard = (rows) => {
    $('#board').innerHTML = rows.length ? rows.map((r, i) => `<div class="score-row"><span class="rank">${i + 1}</span><span class="name">${esc(r.name)}</span>
      <span class="sub">今天 +${r.today}</span><span class="pts">${r.total}</span></div>`).join('') : '<div class="score-row">還沒有人得分</div>';
  };
  const paintRecent = (rows) => {
    $('#recent').innerHTML = rows.length ? rows.slice(0, 20).map((r) => `<div class="score-row"><span class="name">${esc(r.player)}</span>
      <span class="sub">${esc(r.label)}</span><span class="pts">+${r.points}</span></div>`).join('') : '<div class="score-row">還沒有得分紀錄</div>';
  };
  const paintFacts = () => {
    const top = Object.entries(META.likes).map(([id, names]) => [id, names.length]).filter(([id, n]) => n > 0 && !id.startsWith('pick:'))
      .sort((a, b) => b[1] - a[1]).slice(0, 5);
    $('#facts').innerHTML = top.length ? top.map(([id, n]) => {
      const [cid, idx] = id.split('#');
      const f = CARD[cid] && CARD[cid].facts[Number(idx)];
      return `<div class="score-row"><span class="name" style="white-space:normal">${esc(plain(f).slice(0, 60))}</span><span class="pts">👍 ${n}</span></div>`;
    }).join('') : '<div class="score-row">還沒有人按讚</div>';
  };
  const paintPics = (collages) => {
    $('#pics').innerHTML = collages.map((p) => `<figure><img loading="lazy" data-id="${esc(p.fileId)}" src="https://drive.google.com/thumbnail?id=${encodeURIComponent(p.fileId)}&sz=w800" alt="${esc(p.player)}的九宮格：${esc(p.theme)}">
        <figcaption><b>${esc(p.player)}</b>・${esc(p.theme)}<br><span class="sub">${esc(p.city)}・${esc(fmtDate(p.date))}</span></figcaption>
        <div class="cmts" data-f="${esc(p.fileId)}"></div></figure>`).join('') || '<p class="sub">還沒有人上傳九宮格。</p>';
    $$('#pics img').forEach((img) => img.onerror = async () => {
      img.onerror = null;
      try { const r = await apiGet({ action: 'image', id: img.dataset.id }); img.src = r.dataUrl; } catch (e) { }
    });
    collages.forEach((p) => paintComments(p));
  };
  const paintComments = (p) => {
    const box = $(`.cmts[data-f="${p.fileId}"]`);
    if (!box) return;
    const done = ledgerHas('comment|' + p.fileId);
    const list = commentsFor(p.fileId).map((c) => `<div class="cmt"><b>${esc(c.player)}</b>：${esc(c.text)}</div>`).join('');
    box.innerHTML = `${list}
      <div class="row" style="margin-top:6px"><input class="text cmt-in" placeholder="寫一句評語" maxlength="80" ${done ? 'disabled' : ''}>
      <button class="btn small" type="button" ${done ? 'disabled' : ''}>${done ? '已留言' : '留言 +5'}</button></div>`;
    const btn = $('button', box);
    if (done) return;
    btn.onclick = () => {
      const text = $('.cmt-in', box).value.trim();
      if (text.length < 2) { toast('評語至少寫 2 個字'); return; }
      if (!award({ key: 'comment|' + p.fileId, points: 5, label: '評語：' + p.theme, cardId: '' })) return;
      DB.qPut({ id: 'c:' + p.fileId + ':' + uid(), type: 'comment', fileId: p.fileId, player: S.player, text, ts: Date.now() }).then(flush);
      META.comments[p.fileId] = commentsFor(p.fileId).concat([{ player: S.player, text }]);
      paintComments(p);
    };
  };
  const load = async () => {
    if (!S.server.url) {
      $('#ws').textContent = '還沒連上家庭雲端，只顯示這支手機上的分數。到「我的」設定後就能看到大家。';
      paintBoard(localTotals());
      $('#recent').innerHTML = '';
      $('#pics').innerHTML = '';
      return;
    }
    try {
      const d = await apiGet({ action: 'feed', date: today() });
      await syncMeta(d);
      $('#ws').textContent = '每分鐘自動更新。最後更新：' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      paintBoard(d.players || []);
      paintRecent(META.recent);
      paintFacts();
      paintPics(d.collages || []);
    } catch (e) {
      $('#ws').textContent = '現在連不上家庭雲端，先顯示這支手機上的分數。';
      paintBoard(localTotals());
    }
  };
  $('#rf').onclick = load;
  load();
  clearInterval(wallTimer);
  wallTimer = setInterval(() => { if (location.hash === '#/wall') load(); else clearInterval(wallTimer); }, 60000);
  return 'wall';
});

/* ---------- me / settings ---------- */
route('/me', () => {
  const sv = S.server;
  view(`<h1>我的</h1>
    <div class="card"><label class="field"><span>我的名字</span><input class="text" id="nm" value="${esc(S.player)}"></label>
      <p class="section-label">題目難度</p>
      <div class="pill-switch" id="md"><button type="button" data-m="basic">初階版</button><button type="button" data-m="challenge">我要挑戰</button></div>
      <button class="btn small" id="savep" style="margin-top:12px">儲存</button></div>
    <div class="list">
      <a class="item" href="itinerario.html" target="_blank"><div class="t"><b>🇪🇸 西班牙文專屬行程頁</b><span>純西文版，專門分享給西班牙同事看，附在地推薦留言區</span></div>${CHEV}</a>
      <label class="toggle"><span>預覽全部（出發前試玩，城市卡全部打開）</span><input type="checkbox" id="pv" ${S.preview ? 'checked' : ''}></label>
      <label class="toggle"><span>暫停上傳（例如在郵輪上不想用網路）</span><input type="checkbox" id="pz" ${S.paused ? 'checked' : ''}></label>
    </div>
    <div class="card"><p class="section-label">上傳清單</p><p id="qc" class="sub">計算中…</p><button class="btn small" id="fl">現在上傳</button></div>
    ${wowNotesHtml()}
    <h2>全家人名單</h2>
    <div class="card"><label class="field"><span>一行一個名字（遊戲間和給分會用到）</span><textarea class="text" id="fam">${esc(S.family.join('\n'))}</textarea></label>
      <button class="btn small" id="savef">儲存名單</button></div>
    <h2>家庭雲端（一個人設定就好）</h2>
    <div class="card"><label class="field"><span>Apps Script 網址</span><input class="text" id="su" value="${esc(sv.url)}" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label class="field"><span>家庭密碼</span><input class="text" id="sc" value="${esc(sv.code)}"></label>
      <div class="row"><button class="btn small" id="saves">儲存並測試</button><button class="btn small ghost" id="inv">產生邀請連結</button></div>
      <p class="sub" id="invout" style="margin-top:10px">設定好後按「產生邀請連結」，貼到 LINE 群組。家人點開就自動連好，不用再輸入。</p></div>
    <div style="margin-top:16px"><a class="btn ghost block" href="itinerario.html" target="_blank">🇪🇸 西班牙文 30 天完整行程頁（司機與導遊專用）</a></div>
    <div style="margin-top:10px"><a class="btn ghost block" href="#/admin">主辦人後台</a></div>
    <p class="sub center">版本 ${APP_VERSION}</p>`);
  let mode = S.mode;
  const paint = () => $$('#md button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  paint();
  $$('#md button').forEach((b) => b.onclick = () => { mode = b.dataset.m; paint(); });
  $('#savep').onclick = () => {
    const n = $('#nm').value.trim().replace(/\s+/g, ' '); if (!n) return toast('名字不能空白');
    LS.set('player', n); LS.set('mode', mode);
    if (!S.family.some((f) => normName(f) === normName(n))) LS.set('family', S.family.concat(n));
    pullMine();
    toast('已儲存');
  };
  $('#pv').onchange = (e) => { LS.set('preview', e.target.checked); toast(e.target.checked ? '已打開全部城市卡' : '恢復每天解鎖'); };
  $('#pz').onchange = (e) => { LS.set('paused', e.target.checked); if (!e.target.checked) flush(); };
  queueCount().then((n) => { $('#qc').textContent = n ? '還有 ' + n + ' 筆等著上傳。' : '全部都上傳好了。'; });
  $('#fl').onclick = () => { if (S.paused) toast('先關掉「暫停上傳」'); else flush(); };
  $('#savef').onclick = () => { LS.set('family', $('#fam').value.split('\n').map((s) => s.trim()).filter(Boolean)); toast('名單已儲存'); };
  $('#saves').onclick = async () => {
    LS.set('server', { url: $('#su').value.trim(), code: $('#sc').value.trim() });
    try { const d = await apiGet({ action: 'feed', date: today() }); await syncMeta(d); toast('連線成功！'); flush(); } catch (e) { toast('連不上，請檢查網址和密碼'); }
  };
  $('#inv').onclick = async () => {
    const sv2 = { url: $('#su').value.trim(), code: $('#sc').value.trim() };
    if (!sv2.url || !sv2.code) { toast('請先填網址和密碼'); return; }
    LS.set('server', sv2);
    const u = new URL(location.href);
    u.hash = 'join=' + b64urlEncode(JSON.stringify({ u: sv2.url, c: sv2.code, f: S.family }));
    u.searchParams.set('openExternalBrowser', '1');
    const link = u.toString();
    $('#invout').innerHTML = `<b>邀請連結：</b><br><span style="word-break:break-all">${esc(link)}</span>`;
    try { await navigator.clipboard.writeText(link); toast('已複製，貼到 LINE 群組吧'); } catch (e) { toast('請長按上面的連結複製'); }
  };
  return 'me';
});

/* ---------- admin ---------- */
async function adminCall(payload, code) {
  return api('admin', Object.assign({ admin: code }, payload));
}
route('/admin', () => {
  if (!LS.get('adminCode', '')) {
    view(`${back('#/me', '我的')}<h1>主辦人後台</h1><p class="sub">只有主辦人需要用。</p>
      <div class="card"><label class="field"><span>後台密碼</span><input class="text" id="ac" type="password"></label>
      <button class="btn block" id="al">進入</button></div>`);
    $('#al').onclick = async () => {
      const code = $('#ac').value;
      try { await adminCall({ op: 'check' }, code); LS.set('adminCode', code); render(); } catch (e) { toast(e.message || '密碼不對'); }
    };
    return 'me';
  }
  renderAdmin();
  return 'me';
});
async function renderAdmin() {
  view(`${back('#/me', '我的')}<h1>主辦人後台</h1>
    <p class="sub" id="ast">讀取中…</p>
    <h2>玩家</h2><p class="sub">刪除後，他的分數、留言、讚都會清掉，之後他手機上的資料也不會再回到家庭雲端。</p>
    <div class="list" id="plist"></div>
    <h2>每天截止時間</h2>
    <div class="card"><label class="field"><span>台灣時間，例如 21:30（留空就是不截止）</span><input class="text" id="cut" placeholder="HH:MM"></label>
      <button class="btn small" id="sc2">儲存時間</button></div>
    <h2>重新開始</h2>
    <div class="card"><p class="sub">會清空分數、照片、留言和讚（帳本不會動）。不會再自動清空。</p>
      <label class="field"><span>要保留分數的玩家（不分大小寫，留空就全部清掉）</span><input class="text" id="keep" value="Simon"></label>
      <button class="btn small ghost" id="wipe">清空</button></div>
    <button class="btn ghost block" id="lo" style="margin-top:16px">登出後台</button>`);
  const code = LS.get('adminCode', '');
  const load = async () => {
    try {
      const d = await apiGet({ action: 'feed', date: today() });
      await syncMeta(d);
      $('#ast').textContent = '已連上家庭雲端。';
      $('#cut').value = d.cutoff || '';
      const names = Array.from(new Set([...(d.players || []).map((p) => p.name), ...S.family]));
      const totals = Object.fromEntries((d.players || []).map((p) => [p.name, p.total]));
      $('#plist').innerHTML = names.length ? names.map((n) => `<div class="score-row"><span class="name">${esc(n)}</span>
        <span class="pts">${totals[n] || 0}</span><button class="btn small ghost" data-del="${esc(n)}" type="button">刪除</button></div>`).join('') : '<div class="score-row">還沒有玩家</div>';
      $$('#plist [data-del]').forEach((b) => b.onclick = async () => {
        const n = b.dataset.del;
        if (!confirm('確定要刪除「' + n + '」嗎？他的分數、留言和讚都會清掉，之後也不會再回來。')) return;
        try { await adminCall({ op: 'deletePlayer', name: n }, code); toast('已刪除 ' + n); load(); } catch (e) { toast(e.message); }
      });
    } catch (e) {
      $('#ast').textContent = '現在連不上家庭雲端，請稍後再試。';
    }
  };
  $('#sc2').onclick = async () => {
    const v = $('#cut').value.trim();
    if (v && !/^\d{1,2}:\d{2}$/.test(v)) { toast('時間格式請寫成 21:30'); return; }
    try { await adminCall({ op: 'setCutoff', value: v }, code); toast('已儲存截止時間'); } catch (e) { toast(e.message); }
  };
  $('#wipe').onclick = async () => {
    const keep = $('#keep').value.trim();
    if (!confirm((keep ? '只保留「' + keep + '」的分數，其他' : '全部') + '分數、照片、留言和讚都會清掉，無法復原。確定嗎？')) return;
    try { await adminCall({ op: 'wipe', keep }, code); await wipeLocal(); await pullMine(); toast('已清空'); load(); } catch (e) { toast(e.message); }
  };
  $('#lo').onclick = () => { LS.set('adminCode', ''); location.hash = '#/me'; };
  load();
}

/* ---------- help ---------- */
/* ---------- v2.4：行前檢查清單（每個人勾自己的） ---------- */
const PACK_GROUPS = [
  { lv: 1, title: '① 沒帶就出不了門', items: [
    { id: 'passport', t: '護照', n: '效期最好還有 6 個月以上。拍一張照片頁存在手機裡備用。' },
    { id: 'ticket', t: '機票／電子機票', n: '存在手機裡，也印一份紙本放在隨身包。' },
    { id: 'cruise-doc', t: '郵輪登船證（e-ticket）與行李吊牌', n: '完成 MSC 線上報到後才拿得到，存手機＋印紙本。' },
    { id: 'card', t: '信用卡 2 張（不同發卡組織，例如 Visa＋Mastercard）', n: '分開放，一張不見還有另一張。出國前打開海外刷卡功能。' },
    { id: 'cash', t: '少量歐元現金', n: '小費、廁所、市集用。不用帶太多，歐洲幾乎都能刷卡。' },
    { id: 'phone', t: '手機＋充電線', n: '開通國際漫遊或買好歐洲網卡／eSIM。' },
    { id: 'meds', t: '個人常用藥＋英文藥單', n: '放隨身行李，不要托運。帶足整趟旅程的量，再多幾天備用。' },
    { id: 'insurance', t: '旅遊平安險與海外醫療險資料', n: '把保單號碼和緊急聯絡電話存在手機裡。' },
  ] },
  { lv: 2, title: '② 很重要', items: [
    { id: 'plug', t: '歐規轉接頭（兩根圓腳，C／F 型）', n: '西班牙、法國、義大利、突尼西亞都用得到。歐洲電壓是 230V，吹風機等電器要看清楚是否支援。' },
    { id: 'powerbank', t: '行動電源', n: '只能放隨身行李，不能托運。阿聯酋航空機上禁止使用行動電源，出發前請再確認航空公司規定。' },
    { id: 'glasses', t: '眼鏡／隱形眼鏡＋備用', n: '' },
    { id: 'coat', t: '保暖外套', n: '12 月到 1 月，馬德里、格拉納達早晚可能接近 0°C。' },
    { id: 'shoes', t: '好走的鞋', n: '每天會走很多路，老城區是石板路。' },
    { id: 'warm', t: '毛帽、手套、圍巾', n: '' },
    { id: 'umbrella', t: '摺疊傘或輕便雨衣', n: '' },
    { id: 'copy', t: '護照影本＋兩張大頭照', n: '和護照分開放，萬一護照遺失補辦會快很多。' },
  ] },
  { lv: 3, title: '③ 郵輪上用得到', items: [
    { id: 'formal', t: '正裝（如果要參加船上的正式晚宴）', n: 'Gala Night 通常 1 次（有時 2 次）。男生：有領襯衫或西裝外套；女生：洋裝。不強制，但晚上進餐廳不能穿短褲、拖鞋和背心。' },
    { id: 'white', t: '一件白色衣服', n: '船上常辦白色派對。' },
    { id: 'swim', t: '泳衣', n: '船上有泳池和按摩池。' },
    { id: 'seasick', t: '暈船藥', n: '冬天的地中海有時浪會比較大，容易暈的人先準備。' },
    { id: 'daybag', t: '上岸用的小背包', n: '每個港口上岸玩一天用，拉鍊要能關好。' },
  ] },
  { lv: 4, title: '④ 生活用品', items: [
    { id: 'toilet', t: '盥洗用品、牙刷牙膏', n: '歐洲很多住宿不提供牙刷。' },
    { id: 'skin', t: '保養品、護唇膏、護手霜', n: '歐洲冬天很乾。液體帶上飛機要用 100ml 以下小瓶，裝進透明夾鏈袋。' },
    { id: 'pajama', t: '睡衣', n: '' },
    { id: 'slipper', t: '室內拖鞋', n: '歐洲旅館多半沒有拖鞋。' },
    { id: 'underwear', t: '內衣褲、襪子', n: '有洗衣機可以洗，帶一週份就夠。' },
    { id: 'tissue', t: '面紙', n: '' },
    { id: 'pen', t: '一支筆', n: '填表格、寫明信片用。' },
  ] },
  { lv: 5, title: '⑤ 不用從臺灣帶（珊笛帶）', note: '這些東西歐洲就買得到，由珊笛從歐洲就近帶過來，大家不用塞進行李箱。', items: [
    { id: 'detergent', t: '洗衣粉／洗衣球（珊笛帶）', n: '' },
    { id: 'hanger', t: '衣架、曬衣夾（珊笛帶）', n: '' },
    { id: 'bags', t: '垃圾袋、夾鏈袋（珊笛帶）', n: '' },
    { id: 'wipes', t: '濕紙巾（珊笛帶）', n: '' },
    { id: 'shampoo', t: '大罐洗髮精、沐浴乳（珊笛帶）', n: '' },
  ] },
];

const PACK_NOTICE = `
  <div class="card notice-card">
    <h3>📢 行前注意事項</h3>
    <div class="notice-item urgent">
      <b>🚢 郵輪：DISEN一家務必在出發前完成線上報到（Web Check-in）</b>
      <p>到 MSC 官網或 MSC for Me App 填好護照資料，完成後下載登船證（e-ticket）和行李吊牌。沒做完，登船當天會很麻煩。不會操作的話，直接找珊笛幫忙。</p>
    </div>
    <div class="notice-item">
      <b>🇪🇺 入境歐洲申根區要付費的政策（ETIAS）：目前還不用申請</b>
      <p>ETIAS 全名翻成中文大概是：歐洲旅遊資訊和授權系統。就是入境前要先上網申請，然後繳一筆手續費。這不是簽證，概念跟英國的 ETA 類似。</p>
      <p>原訂 ETIAS 要在 2026 年第四季實施，目前官網公告的大意是：<b>現在還不用 ETIAS，歐盟會在正式啟用前幾個月公告。</b>所以這趟入境申根區，只有「不用事先申請的 EES」。</p>
    </div>
    <div class="notice-item">
      <b>🛂 EES 數位通關：入境要拍臉、按指紋</b>
      <p>流程和排隊的心理準備，請看 <a href="#/airports">四大機場手帳</a> 最上方的說明。</p>
    </div>
  </div>`;

function packHtml() {
  const me = S.player;
  const got = LS.get('pack:' + me, {});
  const isSandy = /珊笛|Sandy/i.test(me);
  const all = PACK_GROUPS.filter((g) => g.lv < 5 || isSandy).flatMap((g) => g.items);
  const n = all.filter((it) => got[it.id]).length;
  const pct = all.length ? Math.round((n / all.length) * 100) : 0;
  const groups = PACK_GROUPS.map((g) => {
    const tickable = g.lv < 5 || isSandy;
    const rows = g.items.map((it) => `
      <label class="pack-row${got[it.id] ? ' on' : ''}${tickable ? '' : ' ro'}">
        ${tickable ? `<input type="checkbox" data-pack="${it.id}"${got[it.id] ? ' checked' : ''}>` : '<span class="pack-dot">·</span>'}
        <span class="pack-text"><span class="pack-t">${esc(it.t)}</span>${it.n ? `<span class="pack-n">${esc(it.n)}</span>` : ''}</span>
      </label>`).join('');
    const note = g.note ? `<p class="sub" style="margin:0 0 8px">${esc(isSandy ? '你負責從歐洲帶這些過來，帶好了就打勾。' : g.note)}</p>` : '';
    return `<div class="card pack-group lv${g.lv}"><h3>${esc(g.title)}</h3>${note}${rows}</div>`;
  }).join('');
  return `
    ${back('#/', '首頁')}
    <div class="kicker">S / 00 · ${esc(me)} 的行李</div>
    <h1>🧳 行前檢查清單</h1>
    <p class="sub">每個人勾自己的。由上到下照重要程度排好，越上面越不能忘。</p>
    ${PACK_NOTICE}
    <div class="card pack-progress">
      <div class="pack-bar"><span style="width:${pct}%"></span></div>
      <div><b>${esc(me)}</b> 已經準備好 <b>${n} / ${all.length}</b> 項${n === all.length && all.length ? '，全部到齊！🎉' : ''}</div>
    </div>
    ${groups}
    <button type="button" class="btn small ghost" id="pack-reset">全部取消勾選</button>`;
}

route('/pack', () => {
  view(packHtml());
  const bind = () => {
    $$('[data-pack]').forEach((cb) => {
      cb.onchange = () => {
        const k = 'pack:' + S.player;
        const got = LS.get(k, {});
        if (cb.checked) got[cb.dataset.pack] = Date.now(); else delete got[cb.dataset.pack];
        LS.set(k, got);
        const y = window.scrollY;
        view(packHtml()); bind(); window.scrollTo(0, y);
      };
    });
    const r = $('#pack-reset');
    if (r) r.onclick = () => { if (confirm('確定要把勾選全部取消嗎？')) { LS.set('pack:' + S.player, {}); view(packHtml()); bind(); } };
  };
  bind();
  return 'home';
});

/* ---------- v2.5：郵輪大圖鑑（船上免費／船上付費／下船打卡） ---------- */
const CDEX_FREE = [
  { id: 'f01', icon: '🌅', name: '海上日出', desc: '12 月日出比較晚，大約早上 8 點前後。到最高層甲板，看太陽從海平線冒出來。每天的節目表通常會寫日出時間。' },
  { id: 'f02', icon: '🌇', name: '海上夕陽', desc: '12 月大約下午 5 點前後日落。站在船尾或側邊甲板，看太陽沉進地中海。' },
  { id: 'f03', icon: '🌊', name: '船尾的白色航跡', desc: '到船尾往下看，大船在海上拖出一條長長的白色浪花，像一條路。' },
  { id: 'f04', icon: '👋', name: '巴塞隆納出港', desc: '12/12 開船時到甲板上，看巴塞隆納和蒙特惠奇山慢慢變小。' },
  { id: 'f05', icon: '⚓', name: '清晨進港', desc: '挑一天早起，看船慢慢靠進港口：馬賽的山頂聖母院、熱那亞的燈塔、拿坡里的維蘇威火山。' },
  { id: 'f06', icon: '✨', name: '海上的星空', desc: '海上日晚上，找一個比較暗的甲板角落往上看。遠離城市燈光，星星會比在家多很多。天冷記得穿外套。' },
  { id: 'f07', icon: '🍳', name: 'Marketplace 自助餐廳的早餐', desc: '15 樓的自助餐廳，早午晚都開。早餐挑一盤你最得意的組合拍下來。' },
  { id: 'f08', icon: '🧀', name: '船上現做的莫札瑞拉起司', desc: '自助餐廳有現做的新鮮莫札瑞拉起司，找找看在哪一區。' },
  { id: 'f09', icon: '🍽️', name: '主餐廳的晚餐', desc: '船上有幾間不用另外付錢的主餐廳，例如 6 樓的 Aurora Boreale／Aurora Borealis（北極光主題）、Colorado River，5 樓的 Green Orchid。拍下你最喜歡的一道菜。' },
  { id: 'f10', icon: '🍰', name: 'Carousel Lounge 下午點心', desc: '7 樓船尾的 Carousel Lounge 白天提供小點心，例如糕點和小三明治，到傍晚前。' },
  { id: 'f11', icon: '🍕', name: '泳池邊的披薩和漢堡', desc: '15 樓泳池旁的 Atmosphere Bar 有披薩和漢堡。冬天天冷或下雨可能不開。' },
  { id: 'f12', icon: '🌌', name: 'Galleria 的 LED 天幕', desc: '6–7 樓的購物大街，頭頂是一條約 80 公尺長的 LED 天花板，號稱海上最長。整點常有燈光音樂秀，抬頭拍一張。' },
  { id: 'f13', icon: '💎', name: '施華洛世奇水晶樓梯', desc: 'MSC 的招牌：亮晶晶的水晶樓梯。大家在樓梯上排好拍一張「豪華郵輪合照」。' },
  { id: 'f14', icon: '🎭', name: '劇院的晚間大秀', desc: '每晚都有歌舞、馬戲或音樂秀，不用另外付錢（有些場次要先在 App 預約座位）。曲目以船上節目表為準。' },
  { id: 'f15', icon: '🎷', name: '酒吧現場音樂', desc: '晚上很多酒吧和大廳都有樂團或歌手表演，坐著聽不用錢（點飲料才要付費）。' },
  { id: 'f16', icon: '🤵', name: '正式之夜（Gala Night）', desc: '穿上正裝，在船上找一個漂亮的地方拍大合照。是哪一晚要看節目表。' },
  { id: 'f17', icon: '🤍', name: '白色派對', desc: 'MSC 的傳統，大家穿白色衣服在 Galleria 跳舞。看節目表找時間。' },
  { id: 'f18', icon: '🎤', name: '卡拉 OK 或遊戲節目', desc: '船上常辦卡拉 OK、問答遊戲和大家一起玩的遊戲節目。上台一次就算數！' },
  { id: 'f19', icon: '🏊', name: '泳池與按摩池', desc: '泳池甲板有泳池和好幾個戶外按摩池。冬天在熱水按摩池裡看海很享受，天氣不好時可能關閉。' },
  { id: 'f20', icon: '🛝', name: '滑水道或空中繩索', desc: '船尾有滑水道和空中繩索冒險區。冬天和風大時可能不開，開放的話挑戰一次。' },
  { id: 'f21', icon: '🏀', name: '運動場', desc: '16 樓運動場可以打籃球、踢足球、打排球。找家人來一場投籃比賽。' },
  { id: 'f22', icon: '🏋️', name: '看海的健身房', desc: '健身房有大片窗戶可以看海。器材免費，課程和私人教練要另外付費。' },
  { id: 'f23', icon: '🐋', name: '船身的海洋彩繪', desc: 'Euribia 的船身畫著一幅海洋主題的大彩繪（#SaveTheSea）。在港口下船後，回頭找一個能拍到船身的角度。' },
  { id: 'f24', icon: '🧭', name: '大家在船頭或甲板合照', desc: '找一個有海、有風的地方，大家一起拍一張。' },
  { id: 'f27', icon: '🌱', name: 'MSC 海洋基金會實驗室', desc: '以海洋和環保為主題的互動展覽與工作坊，免費參加，時間看每日節目表。' },
  { id: 'f28', icon: '🚶', name: '甲板健走步道', desc: '露天甲板上的步道，免費，清晨人少最舒服。' },
  { id: 'f29', icon: '📚', name: '圖書角', desc: '小小的閱讀角，可以免費取書來看。' },
  { id: 'f30', icon: '🎺', name: 'Big Band 大樂團演出', desc: '船上的大樂團在 Carousel Lounge 等地方演出，免費入場，飲料另計。' },
  { id: 'f31', icon: '🚶‍♂️', name: 'Julian Opie 的「走路的人」LED 藝術', desc: '6 樓的 L\'Atelier du Voyageur 牆上，有英國藝術家 Julian Opie 的會走路人物 LED 作品，經過就能看。' },
  { id: 'f32', icon: '🛝', name: '空中吊橋', desc: '19 樓有一座橫跨船寬的吊橋，免費，但有身高和鞋子規定，天候不佳會關閉。' },
];

/* DISEN家訂的是 Aurea 房型：以下是 MSC 官網列出的 Aurea 禮遇（2026 年版），實際以訂房確認信為準 */
const CDEX_AUREA = [
  { id: 'a01', icon: "🛳️", name: "優先登船與行李優先託運", desc: "巴塞隆納登船當天可走 Aurea 優先通道，行李也優先收件，排隊時間大幅縮減，登船輕鬆舒適。", note: "已查證" },
  { id: 'a02', icon: "🍽️", name: "Il Campo 餐廳（Aurea 專屬）＋ My Choice 彈性晚餐", desc: "Aurea 房型可以到 7 樓的 Il Campo 餐廳用餐，晚餐不用固定梯次，在開放時段內自己選時間去吃（My Choice）。一般房型的人不能進。", note: "餐廳開放時段和是否需預約，以上船後的說明為準" },
  { id: 'a03', icon: "🥂", name: "迎賓氣泡酒與巧克力", desc: "入住時房內備有一瓶 Prosecco 氣泡酒和巧克力作為迎賓禮，免費享用。", note: "已查證" },
  { id: 'a04', icon: "🛎️", name: "24小時客房送餐免外送費", desc: "全天候可叫餐送到房間，免收外送服務費，但餐點本身多數仍要另外付費，點餐前請先看價格。", note: "已查證" },
  { id: 'a05', icon: "☕", name: "房內歐陸早餐免費送", desc: "前一晚把早餐單掛門上，隔天早上把咖啡、麵包等歐陸早餐送到房間，不收外送費。", note: "已查證" },
  { id: 'a06', icon: "☀️", name: "成人專屬日光甲板 TOP 19 Exclusive Solarium", desc: "第19層成人限定的安靜日光浴區，有躺椅和毛巾服務，一般乘客要付費，Aurea 免費進入享受靜謐氛圍。", note: "已查證（甲板位置依船上 Daily Program 為準）" },
  { id: 'a07', icon: "♨️", name: "Aurea Spa 溫泉區（Thermal Area）", desc: "可免費使用 Spa 的三溫暖、蒸氣室、熱水池等設施，僅限成人，須事先預約；海上航行日最熱門，建議登船當天就先預約。", note: "已查證（使用次數／時段依船上規定為準）" },
  { id: 'a08', icon: "💆", name: "Spa 療程 9 折", desc: "在船上購買的按摩、美容等 Spa 療程享 10% 折扣；與船上其他促銷能否併用，請現場詢問。", note: "已查證" },
  { id: 'a09', icon: "🛁", name: "浴袍、拖鞋與 MED 盥洗用品", desc: "房內提供浴袍、拖鞋和 MSC 自家 MED 系列沐浴用品。", note: "已查證（官網寫「每間套房」，陽台房是否同樣提供：依訂房確認信為準）" },
  { id: 'a10', icon: "🛏️", name: "枕頭選單", desc: "可向房務員選擇不同軟硬、材質的枕頭，對頸椎放鬆或挑枕頭的人很有幫助。", note: "已查證" },
];
const AUREA_INFO = [
  { icon: "🔄", name: "選擇艙房位置／一次免費改期", desc: "訂位時可自選房號位置；啟航前30天以上可免費改一次航程（新航程須在原出發日90天內）。", note: "已查證（已訂妥者僅供參考）" },
  { icon: "🍷", name: "飲料套餐：不含，僅訂位時享折扣", desc: "目前官網的 Aurea 已不含飲料套餐（舊版曾含 Easy），只能在訂位時以折扣價加購 Easy／Easy Plus 等套餐。若旅行社打包含飲料，以確認信為準。", note: "依訂房確認信為準" },
  { icon: "🚪", name: "優先下船：陽台房不一定有", desc: "官方把「優先下船、優先接駁小艇」列為 Aurea 套房專屬；Aurea 陽台房通常和一般乘客一樣依分配時間下船。", note: "依訂房確認信為準" },
  { icon: "📶", name: "Wi-Fi：不含", desc: "Aurea 不包含上網，需自行購買網路套餐；只有 Yacht Club 才含免費上網。", note: "已查證（部分市場／旅行社促銷可能附贈，依訂房確認信為準）" },
  { icon: "🍴", name: "特色餐廳：不含", desc: "除了 Il Campo，Aurea 不含其他付費特色餐廳或餐飲抵用額度（如 Kaito 日料、Le Grill 牛排館、Hola 墨西哥餐都要付費）。", note: "已查證" },
  { icon: "🚌", name: "港口接駁車：不含", desc: "官方 Aurea 權益未列港口接駁巴士，岸上交通與行程須自理或另購。", note: "依訂房確認信為準" },
  { icon: "🎁", name: "MSC Voyagers Club 積分", desc: "本次航程可累積 MSC 會員點數，下次搭乘可升等享優惠。", note: "已查證" },
];

const CDEX_PAID = [
  { id: 'x01', icon: '🔥', name: 'Kaito 鐵板燒', desc: '師傅在你面前表演切菜、甩鍋、噴火做料理。只有晚餐。' },
  { id: 'x02', icon: '🍣', name: 'Kaito 壽司和爐端燒', desc: '日式壽司和小串燒。' },
  { id: 'x03', icon: '🥩', name: 'Le Grill 法式牛排館', desc: '法國風格的牛排館。' },
  { id: 'x04', icon: '🌮', name: 'Hola! 墨西哥餐廳', desc: '塔可、捲餅、玉米片，可以單點。' },
  { id: 'x05', icon: '🍨', name: '可麗餅和義式冰淇淋', desc: '甜點大師 Jean-Philippe 的店，在 6 樓 Galleria。' },
  { id: 'x06', icon: '🍷', name: 'Helios 葡萄酒吧', desc: '有上百種葡萄酒，桌面是互動螢幕。' },
  { id: 'x07', icon: '☕', name: '汽水、酒和咖啡機咖啡', desc: '一般的茶、咖啡、果汁和白開水在用餐時免費；汽水、酒、咖啡吧的咖啡要另外付錢（或買飲料套餐）。' },
  { id: 'x08', icon: '💆', name: 'Aurea Spa 按摩', desc: '峇里島風格的 Spa，按摩和美容療程要付費。' },
  { id: 'x09', icon: '♨️', name: '溫泉熱療區', desc: '有烤箱、蒸氣室、鹽屋、雪洞等，要另外買票，限 18 歲以上。' },
  { id: 'x10', icon: '🎳', name: '保齡球', desc: '船上有保齡球道，按局收費。' },
  { id: 'x11', icon: '🏎️', name: 'VR 賽車和電玩區', desc: '船上的電玩區（Arcade）、VR 體驗和賽車模擬器都要另外付錢，按次計費，從房卡扣款。' },
  { id: 'x12', icon: '🎰', name: '賭場', desc: '7 樓。要滿 18 歲，看看就好也可以。' },
  { id: 'x13', icon: '📸', name: '船上攝影師的照片', desc: '攝影師會在登船、正式之夜幫大家拍照，拍免費，買照片要付錢。' },
];

const CDEX_PORT = [
 {
  "id": "p01",
  "port": "巴塞隆納",
  "date": "12/12",
  "icon": "🎄",
  "name": "聖露西亞聖誕市集（Fira de Santa Llúcia）",
  "where": "巴塞隆納主教座堂前廣場（Pla de la Seu）一帶",
  "desc": "巴塞隆納最老的聖誕市集，一排排小木屋賣馬槽人偶、苔蘚、聖誕樹和手工裝飾。逛市集不用門票，在大教堂前拍一張很有過節氣氛。",
  "cost": "免費",
  "season": "12 月限定：2026 年 11/27–12/23（已查證）"
 },
 {
  "id": "p02",
  "port": "巴塞隆納",
  "date": "12/12",
  "icon": "🧸",
  "name": "「蹲便小人」偶（Caganer）",
  "where": "聖露西亞市集的馬槽人偶攤位",
  "desc": "加泰隆尼亞馬槽裡的搞笑傳統：一個蹲著上大號的小人，藏在馬槽角落。現在還有名人、球員造型。看看找找就很好玩，買不買都可以。",
  "cost": "免費（看）；買一個約數歐元起",
  "season": "12 月限定：跟著市集 11/27–12/23（已查證）"
 },
 {
  "id": "p03",
  "port": "巴塞隆納",
  "date": "12/12",
  "icon": "🪵",
  "name": "會「拉禮物」的木頭（Tió de Nadal）",
  "where": "聖露西亞市集攤位",
  "desc": "一截戴紅帽、畫笑臉的小木頭，加泰隆尼亞傳統聖誕節會「餵」它，再用棍子敲著唱歌，讓它「生」出糖果。市集裡大大小小一整排，很適合拍照。",
  "cost": "免費（看）",
  "season": "12 月限定：跟著市集 11/27–12/23（已查證）"
 },
 {
  "id": "p04",
  "port": "巴塞隆納",
  "date": "12/12",
  "icon": "⛪",
  "name": "哥德區老街（Barri Gòtic）",
  "where": "主教座堂旁的小巷、聖雅各廣場（Plaça de Sant Jaume）",
  "desc": "石板窄巷、拱廊和中世紀老牆，走路就能逛。聖雅各廣場是市政府所在，每年聖誕節常擺大型馬槽布置。人多的地方注意扒手，包包背前面。",
  "cost": "免費",
  "season": "廣場馬槽：通常 12 月有，出發前請確認"
 },
 {
  "id": "p05",
  "port": "馬賽",
  "date": "12/13",
  "icon": "🧑‍🌾",
  "name": "聖誕小泥偶市集（Foire aux santons）",
  "where": "舊港邊 Quai du Port（市政廳前那一側）",
  "desc": "普羅旺斯傳統的小泥偶「桑頓」，除了耶穌一家，還有麵包師、賣魚婦、牧羊人等村民。20 多位職人擺攤，從 1803 年延續至今，免費進場。",
  "cost": "免費",
  "season": "12 月限定：2026 年 11/14–2027 年 1/3，約 10:00–19:00（已查證）"
 },
 {
  "id": "p06",
  "port": "馬賽",
  "date": "12/13",
  "icon": "🎁",
  "name": "舊港聖誕小木屋（Cabanons de Noël）",
  "where": "舊港 Quai de la Fraternité（港口最底端）",
  "desc": "港邊一排聖誕小木屋，賣手工飾品、糖果和禮物，晚上點燈很漂亮。旁邊就是大鏡面頂棚，可以拍「倒過來的自己」。",
  "cost": "免費",
  "season": "12 月限定：2026 年 11/28–2027 年 1/3（已查證）"
 },
 {
  "id": "p07",
  "port": "馬賽",
  "date": "12/13",
  "icon": "🪞",
  "name": "舊港大鏡棚（L'Ombrière du Vieux-Port）",
  "where": "舊港 Quai de la Fraternité",
  "desc": "一片懸空的不鏽鋼鏡面頂棚，站在底下抬頭，就能看到一家人倒映在天上。是馬賽最受歡迎的免費打卡點。",
  "cost": "免費",
  "season": ""
 },
 {
  "id": "p08",
  "port": "馬賽",
  "date": "12/13",
  "icon": "⛪",
  "name": "守護聖母聖殿（Notre-Dame de la Garde）",
  "where": "舊港南邊的山丘頂，可搭 60 號公車",
  "desc": "馬賽人叫她「好媽媽」，金色聖母像守護漁民和水手。教堂免費進入，山頂能看到整個港口和海島。上坡路陡，建議搭 60 號公車省力登頂。",
  "cost": "免費（公車小額）",
  "season": ""
 },
 {
  "id": "p09",
  "port": "馬賽",
  "date": "12/13",
  "icon": "🎨",
  "name": "籃子區老巷（Le Panier）",
  "where": "舊港北側山坡，市政廳後方",
  "desc": "馬賽最古老的街區，彩色小屋、階梯巷子和牆上塗鴉，到處都能拍。有很多賣馬賽皂和小泥偶的小店。",
  "cost": "免費",
  "season": ""
 },
 {
  "id": "p10",
  "port": "馬賽",
  "date": "12/13",
  "icon": "🚤",
  "name": "小船形餅乾（Navettes）",
  "where": "老字號 Four des Navettes，136 rue Sainte（聖維克多修道院旁）",
  "desc": "像小船的硬餅乾，帶橙花香，是馬賽的傳統點心。老店的烤爐已用了兩百多年。可以買一小包，邊走邊吃。",
  "cost": "小額（約數歐元一包）",
  "season": ""
 },
 {
  "id": "p11",
  "port": "熱那亞",
  "date": "12/14",
  "icon": "🎄",
  "name": "法拉利廣場聖誕樹（Albero di Natale, Piazza De Ferrari）",
  "where": "Piazza De Ferrari，大噴泉旁",
  "desc": "熱那亞市中心最大的廣場，有大銅噴泉和氣派老宮殿。每年聖誕在這裡立大樹、點燈，晚上最好看。",
  "cost": "免費",
  "season": "12 月限定：2026 年 12/8 點燈，活動到 2027 年 1/6（市政府計畫書，已查證）"
 },
 {
  "id": "p12",
  "port": "熱那亞",
  "date": "12/14",
  "icon": "🫓",
  "name": "熱那亞佛卡夏（Focaccia genovese）",
  "where": "老城區任何麵包店（forno）",
  "desc": "熱那亞人的國民麵包，表面一個個小洞，滿滿橄欖油和粗鹽。在地人早餐還會沾卡布奇諾吃。用紙包一塊，邊走邊吃最道地。",
  "cost": "小額（約 2–3 歐元一塊）",
  "season": ""
 },
 {
  "id": "p13",
  "port": "熱那亞",
  "date": "12/14",
  "icon": "🏘️",
  "name": "老城窄巷（Carruggi）",
  "where": "港口與法拉利廣場之間的老城區",
  "desc": "歐洲最大的中世紀老城之一，巷子窄到抬頭只看到一條天空，兩旁是高高的老房子和小店。很好拍，但巷子像迷宮，晚上人少的巷子避開，注意隨身物品。",
  "cost": "免費",
  "season": ""
 },
 {
  "id": "p14",
  "port": "熱那亞",
  "date": "12/14",
  "icon": "🏛️",
  "name": "新街豪宅（Via Garibaldi／Strade Nuove）",
  "where": "Via Garibaldi",
  "desc": "一條街上排滿 16 世紀貴族豪宅，被列為世界遺產。走在街上看外觀和中庭大門就很壯觀，進館才要付費。",
  "cost": "免費（街上看）",
  "season": ""
 },
 {
  "id": "p15",
  "port": "熱那亞",
  "date": "12/14",
  "icon": "🔥",
  "name": "聖誕燒月桂樹儀式（Confeugo）",
  "where": "Piazza De Ferrari",
  "desc": "熱那亞古老的聖誕傳統：穿古裝的隊伍把月桂樹幹抬到廣場上燒，祝福城市新年好運。",
  "cost": "免費",
  "season": "注意：2026 年辦在 12/19（已查證），我們 12/14 在港時看不到，只能看聖誕樹"
 },
 {
  "id": "p16",
  "port": "拿坡里",
  "date": "12/15",
  "icon": "🧑‍🎨",
  "name": "馬槽人偶街（Via San Gregorio Armeno）",
  "where": "老城區 Via San Gregorio Armeno、Piazza San Gaetano",
  "desc": "整條街都是做馬槽人偶的手工坊，從耶穌、天使到現代名人、政治人物都有，還有紅色小辣椒幸運符。人超多，包包一定背在前面。",
  "cost": "免費（逛街）",
  "season": "12 月限定：2026 年馬槽市集 11/1 開始（結束日期出發前請確認）；工坊全年都在"
 },
 {
  "id": "p17",
  "port": "拿坡里",
  "date": "12/15",
  "icon": "🎄",
  "name": "市政廳廣場聖誕樹（Piazza Municipio）",
  "where": "Piazza Municipio，郵輪碼頭一出來就是",
  "desc": "郵輪碼頭正對面的大廣場，往後看是新堡城堡。2025 年市府的大聖誕樹就立在這裡，下船第一張照片就在這。",
  "cost": "免費",
  "season": "通常 11 月中點燈（2025 年在此），2026 年位置出發前請確認"
 },
 {
  "id": "p18",
  "port": "拿坡里",
  "date": "12/15",
  "icon": "🏛️",
  "name": "翁貝托一世拱廊（Galleria Umberto I）",
  "where": "Via Toledo 與 Via San Carlo 之間",
  "desc": "19 世紀玻璃圓頂大拱廊，地上有星座馬賽克。聖誕時常有裝飾或大樹。旁邊就是平民表決廣場（Piazza del Plebiscito）的大圓柱廊。",
  "cost": "免費",
  "season": "聖誕裝飾：通常有，出發前請確認"
 },
 {
  "id": "p19",
  "port": "拿坡里",
  "date": "12/15",
  "icon": "🥐",
  "name": "貝殼酥（Sfogliatella）",
  "where": "Via Toledo 一帶的老糕餅店",
  "desc": "一層一層像貝殼的酥皮，裡面包瑞可達起司和柑橘，是拿坡里代表點心，咬下去會掉屑。站在吧台配一杯濃縮咖啡最道地。",
  "cost": "小額（約 2–3 歐元）",
  "season": ""
 },
 {
  "id": "p20",
  "port": "拿坡里",
  "date": "12/15",
  "icon": "🍕",
  "name": "摺疊披薩（Pizza a portafoglio）",
  "where": "老城區 Via dei Tribunali 的披薩店門口",
  "desc": "拿坡里是披薩的故鄉。小披薩摺成四折像錢包，用紙包著邊走邊吃，便宜又道地。",
  "cost": "小額（約數歐元）",
  "season": ""
 },
 {
  "id": "p21",
  "port": "拿坡里（龐貝鎮）",
  "date": "12/15",
  "icon": "⛪",
  "name": "龐貝玫瑰聖母聖殿（Santuario della Beata Vergine del Rosario）",
  "where": "龐貝新鎮 Piazza Bartolo Longo，遺址出口附近",
  "desc": "遺址外的龐貝新鎮中心，有高高鐘樓的大教堂，免費進入。創建者巴托洛・隆哥 2025 年 10 月剛被封為聖人，是當地人的驕傲。",
  "cost": "免費",
  "season": "教堂聖誕常有馬槽展，出發前請確認"
 },
 {
  "id": "p22",
  "port": "巴勒摩",
  "date": "12/16",
  "icon": "🏛️",
  "name": "四角廣場（Quattro Canti）",
  "where": "Via Maqueda 與 Via Vittorio Emanuele 十字路口",
  "desc": "老城正中心的十字路口，四個角落是彎彎的巴洛克建築，上面有四季和國王雕像。站中間轉一圈就能拍四面。",
  "cost": "免費",
  "season": ""
 },
 {
  "id": "p23",
  "port": "巴勒摩",
  "date": "12/16",
  "icon": "⛲",
  "name": "羞恥噴泉（Fontana Pretoria）",
  "where": "Piazza Pretoria，四角廣場旁",
  "desc": "滿是裸體雕像的大噴泉，以前修女覺得太害羞，所以叫「羞恥噴泉」。隔著欄杆就能拍得很清楚。",
  "cost": "免費",
  "season": ""
 },
 {
  "id": "p24",
  "port": "巴勒摩",
  "date": "12/16",
  "icon": "🎭",
  "name": "馬西莫劇院外觀（Teatro Massimo）",
  "where": "Piazza Verdi",
  "desc": "義大利最大的歌劇院，電影《教父第三集》結尾的階梯就在這裡。在門口大階梯拍照不用買票。",
  "cost": "免費（外觀）",
  "season": ""
 },
 {
  "id": "p25",
  "port": "巴勒摩",
  "date": "12/16",
  "icon": "🎁",
  "name": "巴勒摩聖誕市集（Natale a Palermo）",
  "where": "Via Maqueda（Via Calderai 到 Piazza Sant'Antonino 一段）、Piazza Marina 等",
  "desc": "市政府在老城多處擺聖誕市集小攤，Via Maqueda 本身就是步行街，走過去順路就能逛。",
  "cost": "免費",
  "season": "12 月限定：2026 年 11/27–2027 年 1/10（市府招標公告，已查證）"
 },
 {
  "id": "p26",
  "port": "巴勒摩",
  "date": "12/16",
  "icon": "🍙",
  "name": "炸飯糰（Arancina）",
  "where": "老城炸物店、Ballarò 市場一帶",
  "desc": "巴勒摩人叫它 arancina，裡面包肉醬或起司，炸得金黃。12/13 聖露西亞節全城都吃它，我們晚三天到還吃得到。",
  "cost": "小額（約 2–3 歐元）",
  "season": "聖露西亞節是 12/13（已查證），我們 12/16 已過節，但平常也買得到"
 },
 {
  "id": "p27",
  "port": "巴勒摩",
  "date": "12/16",
  "icon": "🍕",
  "name": "巴勒摩厚披薩（Sfincione）與巴拉羅市場（Mercato di Ballarò）",
  "where": "Ballarò 市場（火車站與老城之間）",
  "desc": "厚厚軟軟的方形披薩，上面是番茄、洋蔥、麵包粉，小販會大聲叫賣。市場本身很熱鬧有阿拉伯風味，人擠注意扒手。",
  "cost": "小額（約 1–3 歐元一塊）",
  "season": ""
 },
 {
  "id": "p28",
  "port": "突尼斯（西迪布賽義德）",
  "date": "12/17",
  "icon": "🚪",
  "name": "藍白小鎮（Sidi Bou Said）",
  "where": "西迪布賽義德主街到山頂一帶，搭 TGM 輕軌可到",
  "desc": "白牆配藍門、藍窗、藍色鐵窗，門上釘著圖案鉚釘，是突尼西亞最上鏡的小鎮。整個小鎮就是拍照背景。",
  "cost": "免費",
  "season": ""
 },
 {
  "id": "p29",
  "port": "突尼斯（西迪布賽義德）",
  "date": "12/17",
  "icon": "🍩",
  "name": "糖粉炸甜甜圈（Bambalouni）",
  "where": "山頂 Café des Nattes 附近的老攤子",
  "desc": "現炸的圓圈甜甜圈，撒滿砂糖，熱熱的很香。山頂這家老攤據說從 1932 年開到現在。",
  "cost": "小額（約 1–2 突尼斯第納爾）",
  "season": ""
 },
 {
  "id": "p30",
  "port": "突尼斯（西迪布賽義德）",
  "date": "12/17",
  "icon": "🍵",
  "name": "山頂咖啡館薄荷茶（Thé à la menthe, Café des Nattes）",
  "where": "主街階梯頂的 Café des Nattes",
  "desc": "坐在鋪草蓆的老咖啡館喝甜薄荷茶，常加松子。畫家克利以前常來這裡。另一家海景咖啡館 Café des Délices 景好但貴，點之前先問價。",
  "cost": "小額（約 3–5 第納爾，依店家）",
  "season": ""
 },
 {
  "id": "p31",
  "port": "突尼斯（西迪布賽義德）",
  "date": "12/17",
  "icon": "🌼",
  "name": "茉莉花小束（Machmoum）",
  "where": "西迪布賽義德、突尼斯街頭小販",
  "desc": "突尼西亞國花茉莉花紮成的小花束，男人會夾在耳朵上。是很有代表性的畫面，但主要在夏天傍晚賣，12 月可能看不到。",
  "cost": "小額（若有，約 1–2 第納爾）",
  "season": "注意：茉莉花主要是夏季，12 月不一定有（已查證為夏季習俗）"
 },
 {
  "id": "p32",
  "port": "突尼斯",
  "date": "12/17",
  "icon": "🕌",
  "name": "突尼斯老城市集（Médina de Tunis）",
  "where": "從海門 Bab el Bhar（法國門）進入，走到橄欖樹清真寺（Zitouna）",
  "desc": "世界遺產老城，窄巷裡是香料、地毯、銅器和鳥籠攤。看看拍拍不用錢，有人熱情帶路通常會要小費，可以客氣說不用。",
  "cost": "免費",
  "season": ""
 },
 {
  "id": "p33",
  "port": "突尼斯",
  "date": "12/17",
  "icon": "🌳",
  "name": "布爾吉巴大道（Avenue Habib Bourguiba）",
  "where": "突尼斯新城區，從海門往東",
  "desc": "被稱為「突尼斯的香榭大道」，兩旁是法式老建築和咖啡館，中間有林蔭步道和大鐘塔。注意：政府機關、軍警附近不要拍照。",
  "cost": "免費",
  "season": ""
 }
];

function cdexCard(it, sec, pts, blob) {
  const on = !!blob;
  const img = blob ? `<img class="poke-thumb" src="${URL.createObjectURL(blob)}" alt="${esc(it.name)}">` : '';
  const meta = sec === 'port'
    ? `<div class="cdex-where">📍 ${esc(it.where)}</div><div class="cdex-cost${/免費/.test(it.cost) && !/小額/.test(it.cost) ? '' : ' paid'}">${esc(it.cost)}</div>${it.season ? `<div class="cdex-season">${esc(it.season)}</div>` : ''}`
    : '';
  return `<div class="poke-card cdex-card ${on ? 'unlocked' : 'locked'}">
    <div class="poke-icon">${it.icon}</div>
    <div class="poke-name">${esc(it.name)}</div>
    <div class="poke-sub">${esc(it.desc)}</div>
    ${it.note ? `<div class="cdex-season">${esc(it.note)}</div>` : ''}${meta}${img}
    <label class="btn small ${on ? 'ghost' : ''}" style="margin-top:auto;width:100%;cursor:pointer">
      ${on ? '換照片' : `📷 打卡點亮 +${pts}`}
      <input type="file" accept="image/*" class="cdex-input" data-id="${it.id}" data-sec="${sec}" hidden>
    </label>
  </div>`;
}

const CDEX_PTS = { free: 20, aurea: 20, paid: 10, port: 20 };
function cdexAll() { return [...CDEX_FREE, ...CDEX_AUREA, ...CDEX_PAID, ...CDEX_PORT]; }

async function renderCruiseDex(tab) {
  tab = ['free', 'aurea', 'paid', 'port'].includes(tab) ? tab : 'free';
  const list = { free: CDEX_FREE, aurea: CDEX_AUREA, paid: CDEX_PAID, port: CDEX_PORT }[tab];
  const blobs = await Promise.all(list.map((it) => DB.pokeGet('cdex:' + it.id)));
  const allIds = cdexAll().map((x) => x.id);
  const got = (await Promise.all(allIds.map((id) => DB.pokeGet('cdex:' + id)))).filter(Boolean).length;
  let body = '';
  if (tab === 'port') {
    let last = '';
    body = list.map((it, i) => {
      const head = it.port !== last ? `${last ? '</div>' : ''}<h2>${esc(it.date)} ${esc(it.port)}</h2><div class="pokedex-grid">` : '';
      last = it.port;
      return head + cdexCard(it, 'port', CDEX_PTS.port, blobs[i]);
    }).join('') + '</div>';
  } else {
    body = `<div class="pokedex-grid">${list.map((it, i) => cdexCard(it, tab, CDEX_PTS[tab], blobs[i])).join('')}</div>`;
  }
  const intro = {
    free: '這些都包含在船票裡，不用另外付錢。看到、吃到、玩到就拍照點亮！',
    paid: '<b>這一區要另外付錢。</b>想體驗的人再去，不用為了點亮圖鑑而花錢，所以分數比較少（+10）。價格以船上公告為準，記帳前先問清楚。',
    aurea: '<b>DISEN家訂的是 Aurea 房型</b>，比一般房多了下面這些禮遇，看到、用到就拍照點亮。依 MSC 官網 2026 年的 Aurea 說明整理；每項實際內容請以訂房確認信和上船後的說明為準。',
    port: '下船後在街上就看得到的當地特色，以不用門票為準。標「小額」的是幾歐元的街頭小吃，想吃再買。12 月限定的活動已盡量查證日期，標「出發前請確認」的請再看一下。',
  }[tab];
  const dexTabsHeader = `
    <div class="dex-main-tabs">
      <a href="#/pokedex/spain">🇪🇸 西班牙大圖鑑</a>
      <a href="#/pokedex/unesco">🏛️ 世界遺產圖鑑</a>
      <a class="on" href="#/pokedex/cruise">🚢 郵輪大圖鑑</a>
    </div>
  `;
  view(`${back('#/', '首頁')}<h1>🏆 家族旅行蒐集圖鑑</h1>
    <p class="sub">MSC Euribia 一週的海上生活和六個港口。已點亮 <b>${got} / ${allIds.length}</b></p>
    ${dexTabsHeader}
    <div class="seg cdex-tabs">
      <a class="${tab === 'free' ? 'on' : ''}" href="#/cruisedex/free">船上免費</a>
      <a class="${tab === 'aurea' ? 'on' : ''}" href="#/cruisedex/aurea">Aurea 禮遇</a>
      <a class="${tab === 'paid' ? 'on' : ''}" href="#/cruisedex/paid">船上付費</a>
      <a class="${tab === 'port' ? 'on' : ''}" href="#/cruisedex/port">下船打卡</a>
    </div>
    <div class="card cdex-intro${tab === 'paid' ? ' paid' : ''}"><p style="margin:0">${intro}</p></div>
    ${tab === 'port' ? safetyBannerHtml() : ''}
    ${tab === 'aurea' ? `<div class="card"><h3>要特別注意的幾件事</h3><ul class="rtips">${AUREA_INFO.map((x) => `<li><b>${x.icon} ${esc(x.name)}</b>：${esc(x.desc)}（${esc(x.note)}）</li>`).join('')}</ul></div>` : ''}
    ${body}
    <p class="sub" style="font-size:12.5px;margin-top:16px">船上資訊整理自 MSC 官網與郵輪媒體（Cruise Critic、Seatrade 等）的 Euribia 介紹；餐廳、節目和開放時間可能調整，以上船後的每日節目表和 MSC for Me App 為準。</p>`);
  $$('.cdex-input').forEach((input) => {
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const id = input.dataset.id, sec = input.dataset.sec;
      const it = cdexAll().find((x) => x.id === id);
      await DB.pokePut('cdex:' + id, f);
      award({ key: 'cdex|' + id, points: CDEX_PTS[sec], label: '郵輪圖鑑：' + it.name });
      const y = window.scrollY; await renderCruiseDex(sec); window.scrollTo(0, y);
    };
  });
  return 'tools';
}
route('/cruisedex', () => renderCruiseDex('free'));
route('/cruisedex/:tab', (tab) => renderCruiseDex(tab));

const POMPEII_MISSION = [
 {
  "n": 1,
  "time": "14:45",
  "zh": "海門（城門入口）",
  "pastGlory": "兩千年前蔚藍大海就在城門下方拍岸。由奧斯提亞與亞歷山卓港抵達的商船在此泊靠，城門大小雙拱嚴格分流：行人從小拱門穿梭，大拱門下滿載雙耳陶罐的騾車顛簸碾過石板，空氣中瀰漫著鹹魚醬（Garum）與熱烈海風氣息。",
  "presentRuins": "海岸線因火山泥沉積已退縮至兩公里外。厚重的玄武岩石板路上，被數百年車輪碾出的深溝依舊清晰可見，路中央凸起的三塊巨大「過街石」（古代斑馬線）與縫隙間防夜行踩空的反光白石子完好保存。",
  "it": "Porta Marina",
  "lat": 40.74848,
  "lng": 14.48306,
  "min": 5,
  "story": "從火車站旁的海門進城，這叫「西進東出」：一路往東走、不走回頭路，最後從另一頭的圓形競技場出口離開。城門有一大一小兩個拱門，大的給騾車和馬車，小的給行人，兩千年前就有人車分流。進門是一段被車輪和腳步磨得發亮的石板上坡，下雨時很滑。低頭看：路中間凸起的大石塊叫「過街石」。當時沒有下水道，雨水、髒水和垃圾都順著馬路流，過街石就是讓人過馬路不弄濕鞋的「斑馬線」，石頭之間的空隙剛好讓車輪通過。石板縫裡有時嵌著白色小石子，有人說是讓夜裡走路的人看得見的「古代反光標記」，不過這只是一種說法，考古學家還沒有證據。",
  "task": "找一組過街石，大家一個接一個踩過去，拍下石頭和旁邊被車輪磨出的深溝。"
 },
 {
  "n": 2,
  "time": "14:55",
  "zh": "廣場與度量衡台",
  "pastGlory": "龐貝的心臟與市政中樞，兩層典雅的大理石柱廊在晨光下白淨生輝。北方朱比特神廟香火繚繞，演說家在會堂慷慨雄辯；廣場西側度量衡石台旁擠滿商人與官員，各國買家倒進穀物與橄欖油比對標準容積，身後背景是當時看似平靜、綠意盎然的維蘇威山峰。",
  "presentRuins": "壯闊開闊的長方形無頂廣場，原本的朱比特神廟只餘高聳階梯與半截石柱，空曠地直對著背後巨大猙獰的維蘇威破火山口。阿波羅神廟青銅雕像昂然張弓，度量衡石桌上的標準測量圓孔沉默靜置，唯有涼爽山風掠過千年的柱礎裂隙。",
  "it": "Foro · Mensa Ponderaria",
  "lat": 40.74925,
  "lng": 14.4844,
  "min": 17,
  "story": "廣場長 157 公尺、寬 38 公尺，是龐貝的政治、宗教與經濟中心。全羅馬世界最早的純步行街：所有進入廣場的路口都立著石樁阻擋馬車與騾車。北端是朱比特神廟（Capitolium），正後方直對維蘇威火山。往西側阿波羅神廟圍牆看，嵌著極著名的「度量衡台 (Mensa Ponderaria)」：石台上鑿有 9 個不同容量的圓錐凹槽，底部設有活塞出料孔。買賣有糾紛時，把穀物或油倒進標準孔測量，防範黑心攤商短斤少兩，是古羅馬最早的「消保法」實物！廣場東側還有帶圓形涼亭的肉魚市集（Macellum）以及富商女祭司捐建的尤瑪齊亞大樓（Eumachia），見證女性在古羅馬商業的顯赫地位。\n這裡也適合聊一個還沒吵完的問題：火山到底哪天爆發？小普林尼信件的抄本寫的是 8 月 24 日。可是 2018 年，考古學家在一間正在整修的房子牆上，發現用木炭隨手寫的日期，換算是 10 月 17 日；遺址裡也有石榴、栗子這些秋天的水果，有人穿得比較厚。所以很多學者認為爆發應該在 10 月下旬。2024 年，現任園長祖赫特里格爾（Zuchtriegel）又提醒：中世紀的抄本其實只留下 8 月 24 日這一個日期，其他日期是近代學者的推測；他認為證據還不夠，研究還在繼續。不管哪一天，對龐貝人來說都是糟糕的一天。",
  "task": "找到度量衡台，數一數石桌上有幾個洞並拍下來。再投票：你站「8 月派」還是「10 月派」？"
 },
 {
  "n": 3,
  "time": "15:15",
  "zh": "小巷與妓院",
  "pastGlory": "迷宮小巷深處的兩層鬧市建築。每當暮色四合，陶土油燈跳躍搖曳，瀰漫著廉價葡萄酒、濃郁香膏與汗水的混雜氣息。各國水手與商旅川流不息，門楣上方繪著色彩鮮麗的露骨服務壁畫；尋歡客與市民在灰泥牆上隨手刻下熱辣的拉丁文俚語、名字與幽默評語。",
  "presentRuins": "狹窄幽暗的小巷石樓依然完整保留兩層格局。一樓各小隔間裡，堅硬短小的磚石石床依舊佇立（昔日鋪厚毛氈褥墊）；門樑上方多幅赭紅壁畫雖經風化卻色彩生動，牆面上 150 多條古羅馬人的塗鴉字跡清晰可辨，如同時空留言板。",
  "it": "Lupanare",
  "lat": 40.75018,
  "lng": 14.48693,
  "min": 12,
  "story": "往東穿過小巷。牆角或路面上偶爾會看到刻著男性生殖器的浮雕，以前常有人說「跟著它指的方向就能找到妓院」，這是錯的。它其實是羅馬人的辟邪符（fascinus），用來擋住忌妒的「邪眼」，麵包店、民宅、路口到處都有，方向也各不相同。\n妓院（Lupanare）是龐貝唯一專門蓋來做這門生意的兩層樓房子，名字來自拉丁文 lupa（母狼），是當時對妓女的俗稱。一樓有幾間小房間，床是磚石砌的平台，當年上面鋪床墊，看起來很短。牆上記錄到的塗鴉超過 150 條，有名字、日期，也有評語。門上方的小幅情色壁畫，有人說是給外地客人看的「菜單」，但這只是其中一種解讀。壁畫比較露骨寫實，大家可以自己決定要不要進去。這裡 16:00 停止入場，請把握時間。",
  "task": "在妓院外的牆上找一段看得出字母的古代塗鴉，拍下來。（不進去也可以在外面找）"
 },
 {
  "n": 4,
  "time": "15:28",
  "zh": "豐饒大道與熱食店",
  "pastGlory": "古城最熙攘繁盛的商業大道（相當於龐貝的第五大道）。熱食小吃店（Thermopolium）的 L 形紅色大理石櫃檯熱氣騰騰，內嵌的陶罐裡滾著燉扁豆、烤乳豬與肉汁；平民百姓站在路旁喝著香料熱紅酒快速飽餐，店門檻滑槽的整排木拉門白天全開、夜晚緊扣。",
  "presentRuins": "筆直平整的石板大街向東延伸數百公尺。普拉西杜斯熱食店的彩色大理石鑲嵌櫃檯與陶罐完好如初，門檻石條上長長的插門木滑槽一清二楚。近年在此路段更挖出彩繪華麗海倫神話的漆黑宴會廳與裝著完整食物殘渣的陶罐，生活溫度彷彿凝結在昨日。",
  "it": "Via dell'Abbondanza · Thermopolium di Vetutius Placidus",
  "lat": 40.74975,
  "lng": 14.4901,
  "min": 24,
  "story": "轉上龐貝最熱鬧的商業大街，一路往東走大約 18 分鐘。路面凸起的大石是「斑馬線過街石（Stepping stones）」：當時街道兼作排洪排污溝，石塊讓行人鞋履不濕；兩石間距固定為 1.4 米，剛好等於羅馬標準雙輪馬車輪距，是最早的車輛限速減速丘！路邊嵌著大陶罐（Dolia）的 L 形大理石吧台是熱食店（Thermopolium），全城有多達 80 家。因底層平民住家多無廚房，外食極為普遍；2020 年考古學家在第五區新出土熱食罐內，化驗出山羊、豬、綠頭鴨、蝸牛與魚肉殘渣，櫃檯彩繪公雞與倒吊綠頭鴨正是當年的「圖像菜單」！\n這條街北邊是正在挖掘的第九區，一般遊客進不去，但最近的新發現都在這附近：2024 年挖出一間牆壁漆成黑色的宴會廳，畫著海倫與帕里斯等神話人物，漆黑是為了遮住油燈的煙；2026 年 10 月底，又在一棟 1912 年只挖過門面的房子（暫稱科爾內利烏斯・馬克西穆斯之家）裡，找到一個原封不動的木櫃，裡面有青銅燈、梳妝用品、炊具、38 枚銅幣，還有一串至少 24 個小護身符的兒童項鍊。兩千年前的家人，也想把最好的平安符隨身守護重要的人。",
  "task": "找到一個嵌著陶罐的熱食店櫃台，再找門檻上插木板門的長溝，兩個都拍下來。"
 },
 {
  "n": 5,
  "time": "15:55",
  "zh": "大體育場：石膏像常設展",
  "pastGlory": "佔地浩大的古羅馬皇家級青訓體育園區。高聳的懸鈴木綠蔭遮天，寬闊草坪四面包圍著壯麗的四合院巨柱長廊；中央是深達兩米、長 35 公尺的清澈游泳池，矯健的羅馬青年在這裡練習摔角、擲標槍與跳水，展現古羅馬帝國追求的健康與力之美。",
  "presentRuins": "偌大宏偉的巨柱在藍天下佇立，中央巨型泳池已成平整土坑。北側柱廊如今靜穆陳列著 22 具罹難者石膏人像（包含緊抱孩童的守護者與蜷曲掙扎的市民），菲奧雷利石膏灌模技術將西元 79 年那個致命瞬間的姿態與衣服皺褶永恆定格，震撼人心。",
  "it": "Palestra Grande · I calchi di Pompei",
  "lat": 40.7515,
  "lng": 14.4939,
  "min": 25,
  "story": "一定要在 16:00 前進來，之後就不能入場。這裡原本是龐貝年輕人運動的大體育場，中間有游泳池。2026 年 3 月起，22 具罹難者石膏像在北側柱廊常設展出，門票已含。石膏像不是石化的屍體：火山灰把人包住、變硬，身體腐爛後留下人形空洞；1863 年起考古學家菲奧雷利（Fiorelli）把石膏灌進空洞，最後一刻的姿勢就被留了下來，連衣服的皺摺都看得到。\n2024 年，《當代生物學》（Current Biology）期刊發表古 DNA 研究，改寫了幾個老故事：大家以為是「戴金手鐲、抱著孩子的媽媽」，其實是一位男性，而且和孩子沒有血緣關係；「相擁而死的姊妹」至少有一位是男性；被當成「一家人」的一組遺體，能檢驗的三個人彼此也不是近親。研究也發現，很多龐貝人的祖先來自東地中海。真相或許更讓人感動：在最後一刻，一個陌生人選擇緊緊擁抱守護身邊的人。",
  "task": "在石膏像前安靜站 30 秒。走出來後，每個人說一句心裡的感受。（請不要大聲喧嘩，拍照時保持尊重）"
 },
 {
  "n": 6,
  "time": "16:20",
  "zh": "圓形競技場",
  "pastGlory": "建於西元前 70 年、全羅馬世界最古老的石造競技場。能容納兩萬名狂熱觀眾，上方拉起巨幅遮陽帆布（Velarium）。沙場上角鬥士短兵交鋒、金屬撞擊，看台喝彩聲雷動；西元 59 年這裡甚至爆發過龐貝與鄰城觀眾大規模流血群毆，驚動尼祿皇帝與元老院下令封館懲處十年。",
  "presentRuins": "世界最古老圓形競技場的雙層拱券與外環石階極其完整，橢圓形草地中央空曠寂靜。石階縫隙滋長著綠草，耳畔唯有山風呼嘯；1971 年搖滾天團 Pink Floyd 曾在此舉辦無觀眾前衛演奏，讓古羅馬狂熱角鬥場化為現代音樂與歷史對話的超現實殿堂。",
  "it": "Anfiteatro",
  "lat": 40.75125,
  "lng": 14.4952,
  "min": 20,
  "story": "大約西元前 70 年蓋好，是現存最古老的羅馬石造圓形競技場，可坐約 2 萬人，比羅馬競技場早了大約 150 年。西元 59 年，龐貝人和鄰城努切里亞人在這裡看角鬥士比賽，吵著吵著丟石頭、拔刀，死傷很多。羅馬史學家塔西佗記載，尼祿皇帝把案子交給元老院，結果龐貝被禁止舉辦這類比賽 10 年，主辦人也被流放。城裡還留下一則幸災樂禍的塗鴉，大意是嘲笑對方「贏了也一起完蛋」，兩千年前就有網路酸民的味道。1971 年，英國樂團平克佛洛伊德在這裡拍了沒有觀眾的演唱會電影。這時天快黑了（日落約 16:40），看完就從旁邊的出口離開，一步回頭路都不用走。",
  "task": "在競技場中央拍一張大合照，所有人一起高舉雙手當「冠軍隊」。"
 },
 {
  "n": 7,
  "time": "16:40",
  "zh": "出口：圓形競技場廣場",
  "pastGlory": "兩萬人散場時的龐貝東大門。大道上騾馬車伕高聲攬客，小販兜售著無花果、紀念小泥偶與熱麵包；從這裡向東眺望，平原上綠色葡萄園遍野延伸，通往諾切拉與薩萊諾的石板官道車水馬龍，整座城市活力四射、生生不息。",
  "presentRuins": "綠樹成蔭的古城出口，走出古石門便無縫連接現代龐貝市鎮。古蹟與現代城鎮一線之隔，遠處傳來聖殿大教堂的悠揚鐘聲；步出兩千年前的歷史迷宮，搭上歸程列車，在夕陽與海風中平安告別這座永恆之城。",
  "it": "Uscita Piazza Anfiteatro",
  "lat": 40.7496,
  "lng": 14.496,
  "min": 5,
  "story": "從東側的 Piazza Anfiteatro 出口離開。回拿坡里有兩個車站：走約 8–10 分鐘到 Pompei Santuario 站（Circumvesuviana 往 Napoli 的 Poggiomarino 線），或走約 12–15 分鐘到國鐵 Pompei 站（Trenitalia，可直達 Napoli Centrale）。班次和走路時間是估計，出發前一天請查 eavsrl.it 和 trenitalia.com。也可以走回西邊的 Pompei Scavi 站（約 20–25 分鐘）。最晚 18:00 前上車，19:30 前回到船上。",
  "task": "上車前在車站拍一張「平安脫離龐貝」的合照，回船上再傳。"
 }
];
const PORT_ROUTES = {
 "pompeii": {
  "date": "2026-12-15",
  "port": "拿坡里",
  "title": "龐貝 2 小時：最經典的走法",
  "summary": "雙路線任選：方案 A 龐貝 2 小時西進東出經典路線；方案 B 拿坡里舊城手作工坊與披薩散步（不去龐貝的輕鬆首選，逛幸運紅角、普爾奇內拉面具、耶誕馬槽人偶）！",
  "verify": "【已查證（官網 pompeiisites.org，2026年11月查詢）】冬季（10/15–3/15）龐貝古城 9:00 開門、最後入場 15:30、17:00 閉園；全年只在 12/25 與 1/1 休園（除另行公告），週二照常開放（「週二休」只適用於 Stabiae、Oplontis 等周邊遺址，不是龐貝古城）。入口三處：Porta Marina、Piazza Esedra、Piazza Anfiteatro（官網售票處也只設在這三個入口內）；官網未說明冬季關閉任一入口。票價：Pompei Express（只含古城）€20；Pompei Plus €25；18–25歲歐盟公民 €2；未滿18歲免費（以官網為準）。門票實名制：自2024/11/15起所有門票記名，每日上限 20,000 人，現場購票須出示身分證件/護照；2026/3/2 起官方售票改為 Vivaticket（官網標示 pompeii.vivaticket.it／ticket.pompeiisites.org），舊 TicketOne 票不再有效。夏季（3/16–10/14）才有上午/下午入場名額分段，冬季官網未提分段。屋舍冬季時間：維蒂之家、悲劇詩人之家、妓院、斯塔比亞浴場、廣場浴場 9:15–16:20（最後入場16:00）；農牧神之家、廣場、阿波羅神廟、會堂、大劇場、競技場、逃亡者花園 9:00–17:00；小劇場 Odeion 只能從外面看；廣場穀倉暫不開放。【出發前請確認】票價（不同來源寫 €18/€20/€22，以購票頁為準）、是否需選入場時段、當天各屋舍開放公告（官網「Service announcements」）、EAV 火車是否罷工（eavsrl.it）。建議出發前一週在官網購買記名電子票，每位家人各自填姓名並帶護照。",
  "plans": [
   {
    "id": "go",
    "title": "怎麼去：拿坡里碼頭 → 龐貝海門",
    "fit": "",
    "summary": "13:00 靠岸，下船後直接出發，約 14:45 從海門入園。",
    "steps": [
     {
      "type": "交通",
      "zh": "郵輪碼頭下船",
      "it": "",
      "lat": 40.83775,
      "lng": 14.26063,
      "desc": "MSC 郵輪停靠 Molo Angioino（Stazione Marittima 郵輪航站）。下船後往 Piazza Municipio 方向走。實際靠泊位置可能不同，以船方告示為準。"
     },
     {
      "type": "交通",
      "zh": "步行到地鐵 Municipio 站",
      "it": "",
      "lat": 40.84023,
      "lng": 14.25223,
      "desc": "從郵輪航站步行約 10 分鐘（少於10分鐘）。買 ANM 地鐵單程票 €1.50（也可感應式）。"
     },
     {
      "type": "交通",
      "zh": "地鐵1號線 Municipio → Garibaldi",
      "it": "",
      "lat": 40.8509,
      "lng": 14.2734,
      "desc": "往 Centro Direzionale 方向，Municipio → Università → Duomo → Garibaldi，3 站約 10 分鐘。Garibaldi 站有地下通道連接 Circumvesuviana 的「Napoli Garibaldi」站（在中央車站 Napoli Centrale 地下層）。"
     },
     {
      "type": "交通",
      "zh": "（替代）步行到 Porta Nolana 總站",
      "it": "",
      "lat": 40.84908,
      "lng": 14.26941,
      "desc": "不想轉地鐵可從碼頭沿海邊步行約 1.8 公里、20–25 分鐘到 Circumvesuviana 起點站 Napoli Porta Nolana，起站較有座位。火車隨後會停 Garibaldi。"
     },
     {
      "type": "交通",
      "zh": "搭 Circumvesuviana 到 Pompei Scavi – Villa dei Misteri",
      "it": "",
      "lat": 40.74858,
      "lng": 14.48118,
      "desc": "搭「Napoli–Sorrento」線（往 Sorrento 方向；不要搭往 Poggiomarino 的車，那條不停 Pompei Scavi）。2026/10/17 起冬季時刻表：Porta Nolana 每 30 分鐘一班（整點與半點），Garibaldi 到 Pompei Scavi 約 33–37 分鐘。EAV 單程票 NA3 區 €3.50（整合 TIC 票 €4.30），紙本票上車前須在黃色打票機打票，否則罰款。觀光直達車 Campania Express 自 2026/10/1 起停駛。"
     },
     {
      "type": "交通",
      "zh": "步行到 Porta Marina 入口",
      "it": "",
      "lat": 40.74848,
      "lng": 14.48306,
      "desc": "出站過馬路即是入口廣場，入口距月台約 50 公尺，加上驗票、安檢與上坡約 5–10 分鐘。超過 30×30×15 公分的包包須寄物（Porta Marina 有付費寄物處）。"
     }
    ],
    "noRoute": true
   },
   {
    "id": "main",
    "title": "園內路線：西進東出（7 站，約 2 小時）",
    "fit": "第一次來、只有 2 小時",
    "summary": "妓院和大體育場（石膏像）冬天 16:00 停止入場，所以先看它們，最後到開到 17:00 的圓形競技場，從東邊出口離開。每一站的詳細故事和任務在龐貝景點卡的「現場路線任務」。",
    "steps": [
     {
      "type": "景點",
      "zh": "海門（城門入口）",
  "pastGlory": "兩千年前蔚藍大海就在城門下方拍岸。由奧斯提亞與亞歷山卓港抵達的商船在此泊靠，城門大小雙拱嚴格分流：行人從小拱門穿梭，大拱門下滿載雙耳陶罐的騾車顛簸碾過石板，空氣中瀰漫著鹹魚醬（Garum）與熱烈海風氣息。",
  "presentRuins": "海岸線因火山泥沉積已退縮至兩公里外。厚重的玄武岩石板路上，被數百年車輪碾出的深溝依舊清晰可見，路中央凸起的三塊巨大「過街石」（古代斑馬線）與縫隙間防夜行踩空的反光白石子完好保存。",
      "it": "Porta Marina",
      "lat": 40.74848,
      "lng": 14.48306,
      "time": "14:45",
      "min": 5,
      "pastGlory": "兩千年前蔚藍大海就在城門下方拍岸。由奧斯提亞與亞歷山卓港抵達的商船在此泊靠，城門大小雙拱嚴格分流：行人從小拱門穿梭，大拱門下滿載雙耳陶罐的騾車顛簸碾過石板，空氣中瀰漫著鹹魚醬（Garum）與熱烈海風氣息。",
      "presentRuins": "海岸線因火山泥沉積已退縮至兩公里外。厚重的玄武岩石板路上，被數百年車輪碾出的深溝依舊清晰可見，路中央凸起的三塊巨大「過街石」（古代斑馬線）與縫隙間防夜行踩空的反光白石子完好保存。",
      "desc": "從火車站旁的海門進城，這叫「西進東出」：一路往東走、不走回頭路，最後從另一頭的圓形競技場出口離開。城門有一大一小兩個拱門，大的給騾車和馬車，小的給行人，兩千年前就有人車分流。進門是一段被車輪和腳步磨得發亮的石板上坡，下雨時很滑。低頭看：路中間凸起的大石塊叫「過街石」。當時沒有下水道，雨水、髒水和垃圾都順著馬路流，過街石就是讓人過馬路不弄濕鞋的「斑馬線」，石頭之間的空隙剛好讓車輪通過。石板縫裡有時嵌著白色小石子，有人說是讓夜裡走路的人看得見的「古代反光標記」，不過這只是一種說法，考古學家還沒有證據。"
     },
     {
      "type": "景點",
      "zh": "廣場與度量衡台",
  "pastGlory": "龐貝的心臟與市政中樞，兩層典雅的大理石柱廊在晨光下白淨生輝。北方朱比特神廟香火繚繞，演說家在會堂慷慨雄辯；廣場西側度量衡石台旁擠滿商人與官員，各國買家倒進穀物與橄欖油比對標準容積，身後背景是當時看似平靜、綠意盎然的維蘇威山峰。",
  "presentRuins": "壯闊開闊的長方形無頂廣場，原本的朱比特神廟只餘高聳階梯與半截石柱，空曠地直對著背後巨大猙獰的維蘇威破火山口。阿波羅神廟青銅雕像昂然張弓，度量衡石桌上的標準測量圓孔沉默靜置，唯有涼爽山風掠過千年的柱礎裂隙。",
      "it": "Foro · Mensa Ponderaria",
      "lat": 40.74925,
      "lng": 14.4844,
      "time": "14:55",
      "min": 17,
      "pastGlory": "龐貝的心臟與市政中樞，兩層典雅的大理石柱廊在晨光下白淨生輝。北方朱比特神廟香火繚繞，演說家在會堂慷慨雄辯；廣場西側度量衡石台旁擠滿商人與官員，各國買家倒進穀物與橄欖油比對標準容積，身後背景是當時看似平靜、綠意盎然的維蘇威山峰。",
      "presentRuins": "壯闊開闊的長方形無頂廣場，原本的朱比特神廟只餘高聳階梯與半截石柱，空曠地直對著背後巨大猙獰的維蘇威破火山口。阿波羅神廟青銅雕像昂然張弓，度量衡石桌上的標準測量圓孔沉默靜置，唯有涼爽山風掠過千年的柱礎裂隙。",
      "desc": "廣場長 157 公尺、寬 38 公尺，是龐貝的政治、宗教與經濟中心。全羅馬世界最早的純步行街：所有進入廣場的路口都立著石樁阻擋馬車與騾車。北端是朱比特神廟（Capitolium），正後方直對維蘇威火山。往西側阿波羅神廟圍牆看，嵌著極著名的「度量衡台 (Mensa Ponderaria)」：石台上鑿有 9 個不同容量的圓錐凹槽，底部設有活塞出料孔。買賣有糾紛時，把穀物或油倒進標準孔測量，防範黑心攤商短斤少兩，是古羅馬最早的「消保法」實物！廣場東側還有帶圓形涼亭的肉魚市集（Macellum）以及富商女祭司捐建的尤瑪齊亞大樓（Eumachia），見證女性在古羅馬商業的顯赫地位。"
     },
     {
      "type": "景點",
      "zh": "小巷與妓院",
  "pastGlory": "迷宮小巷深處的兩層鬧市建築。每當暮色四合，陶土油燈跳躍搖曳，瀰漫著廉價葡萄酒、濃郁香膏與汗水的混雜氣息。各國水手與商旅川流不息，門楣上方繪著色彩鮮麗的露骨服務壁畫；尋歡客與市民在灰泥牆上隨手刻下熱辣的拉丁文俚語、名字與幽默評語。",
  "presentRuins": "狹窄幽暗的小巷石樓依然完整保留兩層格局。一樓各小隔間裡，堅硬短小的磚石石床依舊佇立（昔日鋪厚毛氈褥墊）；門樑上方多幅赭紅壁畫雖經風化卻色彩生動，牆面上 150 多條古羅馬人的塗鴉字跡清晰可辨，如同時空留言板。",
      "it": "Lupanare",
      "lat": 40.75018,
      "lng": 14.48693,
      "time": "15:15",
      "min": 12,
      "pastGlory": "迷宮小巷深處的兩層鬧市建築。每當暮色四合，陶土油燈跳躍搖曳，瀰漫著廉價葡萄酒、濃郁香膏與汗水的混雜氣息。各國水手與商旅川流不息，門楣上方繪著色彩鮮麗的露骨服務壁畫；尋歡客與市民在灰泥牆上隨手刻下熱辣的拉丁文俚語、名字與幽默評語。",
      "presentRuins": "狹窄幽暗的小巷石樓依然完整保留兩層格局。一樓各小隔間裡，堅硬短小的磚石石床依舊佇立（昔日鋪厚毛氈褥墊）；門樑上方多幅赭紅壁畫雖經風化卻色彩生動，牆面上 150 多條古羅馬人的塗鴉字跡清晰可辨，如同時空留言板。",
      "desc": "往東穿過小巷。牆角或路面上偶爾會看到刻著男性生殖器的浮雕，以前常有人說「跟著它指的方向就能找到妓院」，這是錯的。它其實是羅馬人的辟邪符（fascinus），用來擋住忌妒的「邪眼」，麵包店、民宅、路口到處都有，方向也各不相同。"
     },
     {
      "type": "景點",
      "zh": "豐饒大道與熱食店",
  "pastGlory": "古城最熙攘繁盛的商業大道（相當於龐貝的第五大道）。熱食小吃店（Thermopolium）的 L 形紅色大理石櫃檯熱氣騰騰，內嵌的陶罐裡滾著燉扁豆、烤乳豬與肉汁；平民百姓站在路旁喝著香料熱紅酒快速飽餐，店門檻滑槽的整排木拉門白天全開、夜晚緊扣。",
  "presentRuins": "筆直平整的石板大街向東延伸數百公尺。普拉西杜斯熱食店的彩色大理石鑲嵌櫃檯與陶罐完好如初，門檻石條上長長的插門木滑槽一清二楚。近年在此路段更挖出彩繪華麗海倫神話的漆黑宴會廳與裝著完整食物殘渣的陶罐，生活溫度彷彿凝結在昨日。",
      "it": "Via dell'Abbondanza · Thermopolium di Vetutius Placidus",
      "lat": 40.74975,
      "lng": 14.4901,
      "time": "15:28",
      "min": 24,
      "pastGlory": "古城最熙攘繁盛的商業大道（相當於龐貝的第五大道）。熱食小吃店（Thermopolium）的 L 形紅色大理石櫃檯熱氣騰騰，內嵌的陶罐裡滾著燉扁豆、烤乳豬與肉汁；平民百姓站在路旁喝著香料熱紅酒快速飽餐，店門檻滑槽的整排木拉門白天全開、夜晚緊扣。",
      "presentRuins": "筆直平整的石板大街向東延伸數百公尺。普拉西杜斯熱食店的彩色大理石鑲嵌櫃檯與陶罐完好如初，門檻石條上長長的插門木滑槽一清二楚。近年在此路段更挖出彩繪華麗海倫神話的漆黑宴會廳與裝著完整食物殘渣的陶罐，生活溫度彷彿凝結在昨日。",
      "desc": "轉上龐貝最熱鬧的商業大街，一路往東走大約 18 分鐘。路面凸起的大石是「斑馬線過街石（Stepping stones）」：當時街道兼作排洪排污溝，石塊讓行人鞋履不濕；兩石間距固定為 1.4 米，剛好等於羅馬標準雙輪馬車輪距，是最早的車輛限速減速丘！路邊嵌著大陶罐（Dolia）的 L 形大理石吧台是熱食店（Thermopolium），全城有多達 80 家。因底層平民住家多無廚房，外食極為普遍；2020 年考古學家在第五區新出土熱食罐內，化驗出山羊、豬、綠頭鴨、蝸牛與魚肉殘渣，櫃檯彩繪公雞與倒吊綠頭鴨正是當年的「圖像菜單」！"
     },
     {
      "type": "景點",
      "zh": "大體育場：石膏像常設展",
  "pastGlory": "佔地浩大的古羅馬皇家級青訓體育園區。高聳的懸鈴木綠蔭遮天，寬闊草坪四面包圍著壯麗的四合院巨柱長廊；中央是深達兩米、長 35 公尺的清澈游泳池，矯健的羅馬青年在這裡練習摔角、擲標槍與跳水，展現古羅馬帝國追求的健康與力之美。",
  "presentRuins": "偌大宏偉的巨柱在藍天下佇立，中央巨型泳池已成平整土坑。北側柱廊如今靜穆陳列著 22 具罹難者石膏人像（包含緊抱孩童的守護者與蜷曲掙扎的市民），菲奧雷利石膏灌模技術將西元 79 年那個致命瞬間的姿態與衣服皺褶永恆定格，震撼人心。",
      "it": "Palestra Grande · I calchi di Pompei",
      "lat": 40.7515,
      "lng": 14.4939,
      "time": "15:55",
      "min": 25,
      "pastGlory": "佔地浩大的古羅馬皇家級青訓體育園區。高聳的懸鈴木綠蔭遮天，寬闊草坪四面包圍著壯麗的四合院巨柱長廊；中央是深達兩米、長 35 公尺的清澈游泳池，矯健的羅馬青年在這裡練習摔角、擲標槍與跳水，展現古羅馬帝國追求的健康與力之美。",
      "presentRuins": "偌大宏偉的巨柱在藍天下佇立，中央巨型泳池已成平整土坑。北側柱廊如今靜穆陳列著 22 具罹難者石膏人像（包含緊抱孩童的守護者與蜷曲掙扎的市民），菲奧雷利石膏灌模技術將西元 79 年那個致命瞬間的姿態與衣服皺褶永恆定格，震撼人心。",
      "desc": "一定要在 16:00 前進來，之後就不能入場。這裡原本是龐貝年輕人運動的大體育場，中間有游泳池。2026 年 3 月起，22 具罹難者石膏像在北側柱廊常設展出，門票已含。石膏像不是石化的屍體：火山灰把人包住、變硬，身體腐爛後留下人形空洞；1863 年起考古學家菲奧雷利（Fiorelli）把石膏灌進空洞，最後一刻的姿勢就被留了下來，連衣服的皺摺都看得到。"
     },
     {
      "type": "景點",
      "zh": "圓形競技場",
  "pastGlory": "建於西元前 70 年、全羅馬世界最古老的石造競技場。能容納兩萬名狂熱觀眾，上方拉起巨幅遮陽帆布（Velarium）。沙場上角鬥士短兵交鋒、金屬撞擊，看台喝彩聲雷動；西元 59 年這裡甚至爆發過龐貝與鄰城觀眾大規模流血群毆，驚動尼祿皇帝與元老院下令封館懲處十年。",
  "presentRuins": "世界最古老圓形競技場的雙層拱券與外環石階極其完整，橢圓形草地中央空曠寂靜。石階縫隙滋長著綠草，耳畔唯有山風呼嘯；1971 年搖滾天團 Pink Floyd 曾在此舉辦無觀眾前衛演奏，讓古羅馬狂熱角鬥場化為現代音樂與歷史對話的超現實殿堂。",
      "it": "Anfiteatro",
      "lat": 40.75125,
      "lng": 14.4952,
      "time": "16:20",
      "min": 20,
      "pastGlory": "建於西元前 70 年、全羅馬世界最古老的石造競技場。能容納兩萬名狂熱觀眾，上方拉起巨幅遮陽帆布（Velarium）。沙場上角鬥士短兵交鋒、金屬撞擊，看台喝彩聲雷動；西元 59 年這裡甚至爆發過龐貝與鄰城觀眾大規模流血群毆，驚動尼祿皇帝與元老院下令封館懲處十年。",
      "presentRuins": "世界最古老圓形競技場的雙層拱券與外環石階極其完整，橢圓形草地中央空曠寂靜。石階縫隙滋長著綠草，耳畔唯有山風呼嘯；1971 年搖滾天團 Pink Floyd 曾在此舉辦無觀眾前衛演奏，讓古羅馬狂熱角鬥場化為現代音樂與歷史對話的超現實殿堂。",
      "desc": "大約西元前 70 年蓋好，是現存最古老的羅馬石造圓形競技場，可坐約 2 萬人，比羅馬競技場早了大約 150 年。西元 59 年，龐貝人和鄰城努切里亞人在這裡看角鬥士比賽，吵著吵著丟石頭、拔刀，死傷很多。羅馬史學家塔西佗記載，尼祿皇帝把案子交給元老院，結果龐貝被禁止舉辦這類比賽 10 年，主辦人也被流放。城裡還留下一則幸災樂禍的塗鴉，大意是嘲笑對方「贏了也一起完蛋」，兩千年前就有網路酸民的味道。1971 年，英國樂團平克佛洛伊德在這裡拍了沒有觀眾的演唱會電影。這時天快黑了（日落約 16:40），看完就從旁邊的出口離開，一步回頭路都不用走。"
     },
     {
      "type": "下車",
      "zh": "出口：圓形競技場廣場",
  "pastGlory": "兩萬人散場時的龐貝東大門。大道上騾馬車伕高聲攬客，小販兜售著無花果、紀念小泥偶與熱麵包；從這裡向東眺望，平原上綠色葡萄園遍野延伸，通往諾切拉與薩萊諾的石板官道車水馬龍，整座城市活力四射、生生不息。",
  "presentRuins": "綠樹成蔭的古城出口，走出古石門便無縫連接現代龐貝市鎮。古蹟與現代城鎮一線之隔，遠處傳來聖殿大教堂的悠揚鐘聲；步出兩千年前的歷史迷宮，搭上歸程列車，在夕陽與海風中平安告別這座永恆之城。",
      "it": "Uscita Piazza Anfiteatro",
      "lat": 40.7496,
      "lng": 14.496,
      "time": "16:40",
      "min": 5,
      "pastGlory": "兩萬人散場時的龐貝東大門。大道上騾馬車伕高聲攬客，小販兜售著無花果、紀念小泥偶與熱麵包；從這裡向東眺望，平原上綠色葡萄園遍野延伸，通往諾切拉與薩萊諾的石板官道車水馬龍，整座城市活力四射、生生不息。",
      "presentRuins": "綠樹成蔭的古城出口，走出古石門便無縫連接現代龐貝市鎮。古蹟與現代城鎮一線之隔，遠處傳來聖殿大教堂的悠揚鐘聲；步出兩千年前的歷史迷宮，搭上歸程列車，在夕陽與海風中平安告別這座永恆之城。",
      "desc": "從東側的 Piazza Anfiteatro 出口離開。回拿坡里有兩個車站：走約 8–10 分鐘到 Pompei Santuario 站（Circumvesuviana 往 Napoli 的 Poggiomarino 線），或走約 12–15 分鐘到國鐵 Pompei 站（Trenitalia，可直達 Napoli Centrale）。班次和走路時間是估計，出發前一天請查 eavsrl.it 和 trenitalia.com。也可以走回西邊的 Pompei Scavi 站（約 20–25 分鐘）。最晚 18:00 前上車，19:30 前回到船上。"
     }
    ]
   },
   {
    "id": "back",
    "title": "怎麼回船",
    "fit": "",
    "summary": "",
    "steps": [
     {
      "type": "交通",
      "zh": "回程 A：Pompei Santuario 站（Circumvesuviana）",
      "it": "Pompei Santuario",
      "lat": 40.75118,
      "lng": 14.50164,
      "desc": "從圓形競技場出口走約 8–10 分鐘，搭往 Napoli 的 Poggiomarino 線，約 40 分鐘到 Garibaldi 或 Porta Nolana，再搭地鐵到 Municipio 走回碼頭。班次出發前請查 eavsrl.it。"
     },
     {
      "type": "交通",
      "zh": "回程 B：國鐵 Pompei 站（Trenitalia）",
      "it": "Pompei (FS)",
      "lat": 40.7459,
      "lng": 14.5013,
      "desc": "從出口走約 12–15 分鐘，搭區域火車直達 Napoli Centrale（約 30–40 分鐘），再從 Garibaldi 搭地鐵 1 號線到 Municipio。班次出發前請查 trenitalia.com。"
     },
     {
      "type": "下船",
      "zh": "回到郵輪碼頭",
      "it": "Stazione Marittima",
      "lat": 40.83775,
      "lng": 14.26063,
      "desc": "最晚 18:00 前在龐貝上車，19:30 前回到船上。"
     }
    ],
    "noRoute": true
   },
       {
     "id": "napoli_city",
     "title": "方案 B：拿坡里舊城手作工坊與披薩散步（不去龐貝的輕鬆首選，約 2 小時）",
     "fit": "不想搭火車跑遠、喜歡逛歷史街巷、買在地傳統工藝、品嚐世界第一披薩的家人",
     "summary": "從郵輪碼頭搭地鐵或漫步進入 Spaccanapoli 世界遺產舊城區，造訪 5 家世代傳承的代表性手作名店（幸運紅角、普爾奇內拉陶土面具、耶誕馬槽人偶），並品嚐世界第一拿坡里披薩創始名店！",
     "steps": [
      {
       "type": "步行",
       "zh": "郵輪碼頭出發 → 市政廳廣場 (Piazza Municipio)",
       "it": "Stazione Marittima → Piazza Municipio",
       "lat": 40.83775,
       "lng": 14.26063,
       "time": "13:00",
       "min": 15,
       "walk": "步行約 5–8 分鐘穿越廣場",
       "desc": "郵輪靠泊 Stazione Marittima（Molo Angioino）。下船出關穿過寬敞的市政廳廣場，抬頭可見巍峨的新堡（Castel Nuovo）。若想體驗被譽為「歐洲最美藝術地鐵」，可在地鐵 1 號線 Municipio 站買票（€1.50，也可直接信用卡感應）搭 2 站至 Dante 站進入老城；或沿 Via Medina 悠閒步行 15 分鐘直奔舊城心臟 Spaccanapoli。"
      },
      {
       "type": "景點",
       "zh": "手作一：La Città di Pulcinella 普爾奇內拉主題工坊",
       "it": "La Città di Pulcinella Presepi e Pastori",
       "lat": 40.8492,
       "lng": 14.2568,
       "time": "13:20",
       "min": 15,
       "walk": "位於 Via San Biagio Dei Librai 105 號",
       "desc": "【營業時間：週一至五 09:30–19:00、週六 10:00–13:30、週日 09:00–13:00】普爾奇內拉（Pulcinella）是拿坡里傳統喜劇的核心靈魂，象徵平民機智、豁達與好運。這家專門店提供正統手工陶土迷你黑白面具公仔、吊飾、項鍊與鑰匙圈等平價單品，小巧精緻、不佔行李空間，是台灣極難買到的特色紀念品。"
      },
      {
       "type": "景點",
       "zh": "手作二：Gambardella 60年傳承陶土面具老字號",
       "it": "Gambardella Pastori & Quadri",
       "lat": 40.8497,
       "lng": 14.2585,
       "time": "13:40",
       "min": 15,
       "walk": "沿同一條街往東走 150 公尺（51 號）",
       "desc": "【營業時間：週一至五 09:00–19:30、週六 09:00–19:00、週日 09:00–13:00】創立於 1960 年的老字號家族工坊。除了細膩的大型耶誕馬槽人偶，最推薦手繪拿坡里陶土製成的普爾奇內拉面具壁飾、傳統手搖鈴鼓（Tammorra）與彩繪磁磚小擺件，工藝考究且價格親民，散發濃郁的南義職人手作溫度。"
      },
      {
       "type": "景點",
       "zh": "手作三：轉進耶誕馬槽街 —— De Maria 幸運紅角大本營",
       "it": "Arte in Movimento De Maria",
       "lat": 40.8504,
       "lng": 14.2580,
       "time": "14:00",
       "min": 15,
       "walk": "左轉進入著名的「耶誕馬槽街」Via S. Gregorio Armeno 29 號",
       "desc": "【營業時間：週一至週日 09:30–19:30】來到聞名全球的耶誕馬槽街中心！店內掛滿各種尺寸的手作「幸運紅角（Cornicello / 辣椒角）」，拿坡里人深信牛角形狀的紅角能驅邪避凶、招來財運。此外還有微型蔬菜籃、麵包、火腿等微縮馬槽場景配件，玲瓏可愛、選擇豐富。"
      },
      {
       "type": "景點",
       "zh": "手作四：Mauro Gambardella 泥塑人偶與名人公仔",
       "it": "Mauro Gambardella Presepi e Pastori",
       "lat": 40.8510,
       "lng": 14.2581,
       "time": "14:18",
       "min": 15,
       "walk": "沿馬槽街往北走 50 公尺（49 號）",
       "desc": "【營業時間：週一至六 09:30–19:30、週日 09:30–14:30】1954 年傳承至今的三代家族工坊。堅持使用火山陶土與手工翻模上色，除了傳統聖經泥塑，更將拿坡里市井文化化為泥偶：披薩師傅、賣魚販，以及拿坡里永遠的足球上帝馬拉度納（Maradona）微縮公仔，展現拿坡里特有的世俗生命力與幽默感。"
      },
      {
       "type": "午餐",
       "zh": "朝聖世界披薩傳奇：拿坡里披薩創始名店品嚐",
       "it": "L'Antica Pizzeria da Michele / Gino Sorbillo",
       "lat": 40.8498,
       "lng": 14.2633,
       "time": "14:35",
       "min": 25,
       "walk": "漫步至 Via Cesare Sersale 或 Via dei Tribunali",
       "desc": "【拿坡里披薩發源聖地】推薦造訪創立於 1870 年的世紀名店 L'Antica Pizzeria da Michele（《享受吧！一個人的旅行》茱莉亞羅勃茲朝聖地，堅持只賣瑪格麗特 Margherita 與水手 Marinara 兩款，果木窯烤香氣撲鼻），或鄰近的 Gino Sorbillo / Di Matteo。點餐秘訣：排隊外帶「拿坡里折疊披薩（Pizza a portafoglio）」，一人一份折成扇形邊走邊吃，熱騰騰香濃牽絲，不必久排內用！"
      },
      {
       "type": "景點",
       "zh": "手作五：Nel Cuore di Napoli 綜合在地手作選物店",
       "it": "Nel Cuore di Napoli",
       "lat": 40.8499,
       "lng": 14.2612,
       "time": "15:05",
       "min": 15,
       "walk": "回程經 Via San Biagio Dei Librai 11 號",
       "desc": "【營業時間：週一至週日 09:30–19:00】位於舊城主幹道上的溫馨女性工坊選物店。匯集紅珊瑚幸運角飾品、普爾奇內拉小物、手繪檸檬陶器、火山岩磁鐵等多樣平價紀念品。店主包裝細緻貼心，非常適合在登船前做最後的伴手禮採買，直接裝袋帶回船上。"
      },
      {
       "type": "下船",
       "zh": "悠閒返回郵輪碼頭登船",
       "it": "Ritorno al Molo Beverello / Stazione Marittima",
       "lat": 40.83775,
       "lng": 14.26063,
       "time": "15:25",
       "min": 20,
       "walk": "沿老城大道漫步或搭地鐵 1 號線返回 Municipio 站",
       "desc": "沿著熱鬧的 Via Toledo 散步或由 Duomo / Università 站搭乘地鐵返回 Municipio 站，步行約 8 分鐘穿過廣場回到郵輪碼頭。全程約 2 到 2.5 小時，老城石板路平整好走、店鋪林立，時間充裕無比，絕不擔心郊區火車罷工或塞車。"
      }
     ]
    },
    {
    "id": "ext",
    "title": "時間多的話（14:00 前入園才來得及）",
    "fit": "早到的人",
    "summary": "這幾個點在北邊或南邊，會走回頭路，時間不夠就跳過。",
    "steps": [
     {
      "type": "延伸",
      "zh": "農牧神之家",
      "it": "Casa del Fauno",
      "lat": 40.75126,
      "lng": 14.4847,
      "min": 12,
      "walk": "從上一站走 3 分鐘",
      "desc": "龐貝最大、最豪華的私人宅邸，佔滿整個街區，室內面積約3,000平方公尺，始建於約西元前180年。中庭水池上立著一尊跳舞的「農牧神」青銅像（現場為複製品，原件在拿坡里國家考古博物館），因而得名。後方的大廳地板原本是著名的「亞歷山大大帝馬賽克」，描繪他與波斯王大流士作戰，現場為複製品。開放至17:00。",
      "n": 5
     },
     {
      "type": "延伸",
      "zh": "維蒂之家（可替換第3站）",
      "it": "Casa dei Vettii",
      "lat": 40.75202,
      "lng": 14.48453,
      "min": 12,
      "walk": "從農牧神之家走 3 分鐘",
      "desc": "屋主是一對由奴隸翻身成富商的維蒂兄弟。經過約20年修復，2023年1月重新開放，牆上保存龐貝最華麗的「第四風格」神話壁畫。入口壁畫內容較露骨。2025/11/18起改由 Vicolo di Mercurio 進入。官網未提需另外預約；冬季16:00最後入場，開放情況以當天公告為準。14:30前入園可加入或替換廣場浴場。",
      "n": "E1"
     },
     {
      "type": "延伸",
      "zh": "斯塔比亞浴場（豐饒大道口）",
      "it": "Terme Stabiane / Via dell'Abbondanza",
      "lat": 40.74997,
      "lng": 14.48769,
      "min": 10,
      "walk": "從上一站走 2 分鐘",
      "desc": "龐貝最古老的公共澡堂，第一期約建於西元前125年，位在主街「豐饒大道」與斯塔比亞路交叉口。男區有更衣室、冷水圓頂室、溫水室和熱水室，熱房地板下的「地暖」系統被認為是羅馬世界現存最早的例子；更衣室天花板有小愛神等灰泥浮雕。出來沿豐饒大道走一小段，看路面深深的車轍和過街墊腳石。冬季16:00最後入場。",
      "n": 7
     },
     {
      "type": "延伸",
      "zh": "逃亡者花園",
      "it": "Orto dei Fuggiaschi",
      "lat": 40.7494,
      "lng": 14.49285,
      "min": 8,
      "walk": "從競技場走約 5 分鐘（往南近諾切拉門）",
      "desc": "原本是一片菜園和葡萄園，1961年在這裡發現13名罹難者的遺體空腔，灌成石膏像後就留在原地展示。他們似乎是想逃往諾切拉城門時，被火山碎屑流吞沒，倒在約3.5公尺厚的浮石層上。現場氣氛沉重，是讓人最直接感受到災難的地方。開放至17:00，但與主路線方向相反，只適合時間充裕者。",
      "n": "E4"
     }
    ],
    "noRoute": true
   }
  ],
  "tips": [
   "最重要的時間限制：最後入場 15:30、閉園 17:00；室內屋舍 16:20 關、16:00 最後入場。13:00 靠岸當天大約只能 14:45 左右入園，請一下船就直接出發，不要在拿坡里市區逗留。",
   "門票請提前在官方 Vivaticket 網站購買記名電子票（每人姓名、出生日期），帶護照備查；不要向車站附近黃牛或非官方網站買高價票。",
   "鞋子：一定要穿防滑、包腳、鞋底厚的運動鞋或健走鞋。古羅馬石板路凹凸不平、有很深的車轍和高路緣、過街墊腳石，雨天非常滑；建議穿著防滑好走的鞋，需要時可攜帶登山杖輔助。官網有「Pompeii for All」無障礙路線可參考。",
   "包包：超過 30×30×15 公分的背包、行李不能帶入，需付費寄放在 Porta Marina 或 Piazza Anfiteatro 寄物處；建議只帶小斜背包。",
   "廁所：Porta Marina、Piazza Esedra、Piazza Anfiteatro 入口附近、Casina dell'Aquila 餐廳、大柱廊、神秘別墅都有；主路線上最方便的是入口處，建議入園前先上。",
   "飲水：官網表示園內各區有數個飲水噴泉，可帶空水瓶裝水；Casina dell'Aquila 有自助餐廳和咖啡吧（不在主路線上）。建議在船上吃飽午餐再下船，帶些小點心。",
   "急救站在 Vicolo degli Augustali（原 Chora Café 附近），電話 +39 081 8575404。資訊中心 +39 081 8575 347。",
   "12月天氣：拿坡里12月平均高溫約14°C、低溫約9°C，平均約7天下雨；遺址幾乎沒有遮蔽，請帶防水外套、折傘、帽子圍巾。12/15 日落約 16:36，16:30 後天色轉暗，石板路更要小心。",
   "火車：Circumvesuviana 車廂老舊、可能擁擠，注意扒手；紙本票一定要在上車前打票。觀光專車 Campania Express 已於 2026/10/1 停駛。請在出發當天查 eavsrl.it 是否有罷工或改點。",
   "回船時間：建議 17:00–17:30 之間搭車回拿坡里，最晚約 18:00 從 Pompei Scavi 發車；若遇火車延誤，可在 Pompei Scavi 站前搭計程車回港（費用較高，先議價）。",
   "妓院、維蒂之家入口壁畫內容較寫實露骨，大家可事先決定是否進入。",
   "地圖與語音導覽：三個入口都有語音導覽租借；建議下載官方地圖 PDF 或拍下入口地圖，園區標示多為義大利文。"
  ]
 },
 "palermo": {
  "date": "2026-12-16",
  "port": "巴勒摩",
  "title": "巴勒摩下船後：兩種走法",
  "summary": "綜合大家分享的路線整理成兩種：A 是老城經典步行（先搭車到最高處，一路下坡走回港口，最省體力）；B 是上午去蒙雷阿萊看金色馬賽克，下午再逛老城精華。",
  "verify": "查證日期 2026-11-21。已用官方或市府資料查證：巴勒莫市府旅遊處開放時間表（2025-09、2025-11 版）、諾曼王宮官網 federicosecondo.org、City Sightseeing 官網 2026 年 12 月營運日、MSC 碼頭資訊、389 號公車復駛新聞（2026-06-18）。重要修正：①耶穌教堂（Casa Professa）不是免費，教堂票價€2，冬季開放至 16:30；②諾曼王宮的王室公寓週二、週三不開放，週三只能參觀帕拉提那禮拜堂和花園（€15.50）；③蒙雷阿萊主教座堂大殿免費，但 12:45–14:00 午休；④City Sightseeing 蒙雷阿萊線 2026-12-16 在官方營運日內，但 12 月時刻表 PDF 無法讀取，票價也沒有查到；⑤冬季平日大教堂屋頂只開到 14:30。坐標：主教座堂、諾曼王宮、新門、普雷托利亞噴泉、耶穌教堂、蒙雷阿萊主教座堂取自維基百科，其餘為地圖估計（誤差約 50–100 公尺）。",
  "plans": [
   {
    "id": "A",
    "title": "方案 A：巴勒莫老城經典步行（先搭車上坡，一路下坡走回港口）",
    "fit": "想輕鬆省力、第一次來巴勒莫、想把市區重點一次看完的人",
    "summary": "09:15 從港口搭計程車到地勢最高的諾曼王宮，先看帕拉提那禮拜堂，再沿下坡經過大教堂、巴拉洛市場、耶穌教堂和馬托拉納教堂（13:00 前看完），在四角廣場吃午餐。下午到修道院吃甜點，沿 Via Maqueda 走到馬西莫劇院，16:25 搭計程車回船。總步行約 3.5 公里，大部分是下坡或平路。",
    "steps": [
     {
      "time": "09:00",
      "type": "下船",
      "zh": "巴勒莫郵輪碼頭（維托里奧·威尼托碼頭）",
      "it": "Stazione Marittima – Molo Vittorio Veneto",
      "lat": 38.12385,
      "lng": 13.3672,
      "hours": "船靠港 09:00–18:00，17:30 前回船",
      "ticket": "—",
      "walk": "步行約 5 分鐘到港口出口計程車站",
      "desc": "MSC 官方標示郵輪停靠 Molo Vittorio Veneto 碼頭。下船後走到 Via Francesco Crispi 的港口出口，計程車在出口外排班。",
      "min": ""
     },
     {
      "time": "09:15",
      "type": "上車",
      "zh": "港口出口計程車站",
      "it": "Posteggio Taxi – Varco Porto, Via Francesco Crispi",
      "lat": 38.1234,
      "lng": 13.3652,
      "hours": "郵輪靠港時通常有排班車",
      "ticket": "跳錶：起跳€3.06、最低€4.59（2025 年資料），到諾曼王宮約€12–18，出發前請確認",
      "walk": "車程約 10–15 分鐘",
      "desc": "先搭計程車到地勢最高的諾曼王宮，之後一路往海邊下坡走，最省大家的體力。上車前請司機確認跳錶或先講好價格。",
      "min": ""
     },
     {
      "time": "09:30",
      "type": "下車",
      "zh": "獨立廣場（諾曼王宮入口）",
      "it": "Piazza Indipendenza / Palazzo dei Normanni",
      "lat": 38.1105,
      "lng": 13.3523,
      "hours": "—",
      "ticket": "—",
      "walk": "步行約 2 分鐘到入口",
      "desc": "在諾曼王宮靠獨立廣場一側下車，售票處和入口就在這一側。這裡也是 389 號公車往蒙雷阿萊的起站。",
      "min": ""
     },
     {
      "time": "09:35",
      "type": "景點",
      "zh": "諾曼王宮・帕拉提那禮拜堂",
      "it": "Palazzo dei Normanni – Cappella Palatina",
      "lat": 38.11083,
      "lng": 13.35306,
      "hours": "週一至週六 08:30–16:30（週三只開禮拜堂與花園；王室公寓週二、週三不開）",
      "ticket": "週三套票€15.50，65 歲以上€13.50，14–17 歲€9（官網價格），出發前請確認",
      "walk": "步行約 3 分鐘",
      "desc": "12 世紀諾曼國王的禮拜堂，金色拜占庭馬賽克配上伊斯蘭風格木雕天花板，是巴勒莫必看的景點。一早人少，可先買票直接排禮拜堂；遇到彌撒或活動會暫停開放。",
      "min": ""
     },
     {
      "time": "10:40",
      "type": "景點",
      "zh": "新門",
      "it": "Porta Nuova",
      "lat": 38.11222,
      "lng": 13.35278,
      "hours": "戶外，全天",
      "ticket": "免費",
      "walk": "步行約 6 分鐘",
      "desc": "王宮旁的凱旋城門，16 世紀為紀念查理五世而建，頂端是金字塔形尖頂。拍完照後沿 Corso Vittorio Emanuele 下坡往大教堂走。",
      "min": ""
     },
     {
      "time": "10:50",
      "type": "景點",
      "zh": "巴勒莫主教座堂",
      "it": "Cattedrale di Palermo",
      "lat": 38.11444,
      "lng": 13.35611,
      "hours": "教堂 週一至週六 07:00–19:00；屋頂／寶庫等紀念區 平日 09:30–14:30（2025 年 11 月市府資料）",
      "ticket": "教堂免費；屋頂與紀念區依套票€1–€18，出發前請確認",
      "walk": "步行約 10 分鐘（穿過 Albergheria 老街區）",
      "desc": "融合諾曼、哥德與巴洛克風格的大教堂，裡面有腓特烈二世等皇室石棺。登屋頂要爬窄小的樓梯，可以俯瞰全城；想保留體力的人也可以留在教堂內或廣場悠閒散步。",
      "min": ""
     },
     {
      "time": "11:40",
      "type": "景點",
      "zh": "巴拉洛市場",
      "it": "Mercato di Ballarò",
      "lat": 38.1123,
      "lng": 13.3593,
      "hours": "每天開市，上午最熱鬧",
      "ticket": "免費",
      "walk": "步行約 5 分鐘",
      "desc": "巴勒莫最古老的露天市場，攤位有魚、蔬果，也有炸鷹嘴豆餅（panelle）等街頭小吃。人多擁擠，背包請背在胸前、注意扒手，地面濕滑要小心。",
      "min": ""
     },
     {
      "time": "12:05",
      "type": "景點",
      "zh": "耶穌教堂（卡薩普羅費薩）",
      "it": "Chiesa del Gesù – Casa Professa",
      "lat": 38.11293,
      "lng": 13.36166,
      "hours": "週一至週六 09:30–18:30（冬季至 16:30）；週日只有彌撒；有網文說中午會休息，出發前請確認",
      "ticket": "教堂€2；含博物館€6（市府資料，並非免費）",
      "walk": "步行約 5 分鐘",
      "desc": "西西里巴洛克的代表作，牆面全部用彩色大理石鑲嵌（marmi mischi），細節非常華麗。網路上「免費」的說法有誤，官方資料的教堂票價是€2。",
      "min": ""
     },
     {
      "time": "12:35",
      "type": "景點",
      "zh": "海軍元帥聖母堂（馬托拉納教堂）",
      "it": "Santa Maria dell'Ammiraglio (La Martorana)",
      "lat": 38.11497,
      "lng": 13.36269,
      "hours": "週一至週六 10:00–13:00（下午是否開放不確定）；週日只有 11:00 彌撒",
      "ticket": "€2（市府資料）",
      "walk": "步行約 2 分鐘",
      "desc": "12 世紀的拜占庭式教堂，滿牆金色馬賽克，其中一幅是基督為羅傑二世加冕的名作。13:00 準時關門，所以安排在午餐前參觀。",
      "min": ""
     },
     {
      "time": "13:00",
      "type": "景點",
      "zh": "普雷托利亞噴泉",
      "it": "Fontana Pretoria",
      "lat": 38.11549,
      "lng": 13.36208,
      "hours": "戶外，全天",
      "ticket": "免費",
      "walk": "步行約 2 分鐘",
      "desc": "16 世紀從佛羅倫斯運來的文藝復興噴泉，有幾十座裸體雕像，所以俗稱「羞恥噴泉」。位在市政廳前，旁邊就是四角廣場。",
      "min": ""
     },
     {
      "time": "13:10",
      "type": "午餐",
      "zh": "四角廣場一帶午餐",
      "it": "Quattro Canti / Via Maqueda",
      "lat": 38.11563,
      "lng": 13.36153,
      "hours": "餐廳多為 12:30–15:00",
      "ticket": "—",
      "walk": "步行約 3 分鐘",
      "desc": "在四角廣場和 Via Maqueda 附近找可以坐下來的餐館，點西西里沙丁魚麵（pasta con le sarde）等傳統菜。下雨時可以趁午餐在室內休息。",
      "min": ""
     },
     {
      "time": "14:20",
      "type": "景點",
      "zh": "聖加大肋納修道院・修女甜點坊",
      "it": "Monastero di Santa Caterina – I Segreti del Chiostro",
      "lat": 38.11528,
      "lng": 13.36245,
      "hours": "每天 10:00–18:00，最後入場 17:15（官網）",
      "ticket": "修道院參觀票價出發前請確認（2026 年市府資料：教堂€3）",
      "walk": "步行約 3 分鐘",
      "desc": "前隱修院開放參觀迴廊和屋頂露台，附設甜點坊照修女古法做卡諾里（cannoli）和杏仁糕，很適合下午休息。入口在 Via Discesa dei Giudici 33。",
      "min": ""
     },
     {
      "time": "15:10",
      "type": "景點",
      "zh": "四角廣場・Morettino 咖啡館",
      "it": "Quattro Canti – Morettino Caffè (Via Vittorio Emanuele 308)",
      "lat": 38.11555,
      "lng": 13.36135,
      "hours": "營業時間出發前請確認",
      "ticket": "依點餐",
      "walk": "步行約 8 分鐘",
      "desc": "四角廣場是兩條主街交會的巴洛克八角廣場，四個角落各有一面雕像立面。Morettino 是重新開幕的美好年代咖啡館，就在廣場轉角，可以點西西里布里歐修麵包（brioche）配咖啡。",
      "min": ""
     },
     {
      "time": "15:50",
      "type": "景點",
      "zh": "Ke Palle 炸飯糰",
      "it": "Ke Palle Arancine d'Autore (Via Maqueda 270)",
      "lat": 38.1177,
      "lng": 13.35975,
      "hours": "10:00–01:00（網路資料）",
      "ticket": "約€3–5／個，出發前請確認",
      "walk": "步行約 6 分鐘",
      "desc": "Via Maqueda 上的人氣西西里炸飯糰（arancina）店，口味很多，可以外帶在路上吃。這段 Via Maqueda 是行人徒步區，路面平坦，走起來非常舒適愜意。",
      "min": ""
     },
     {
      "time": "16:05",
      "type": "景點",
      "zh": "馬西莫劇院（教父 3 階梯）",
      "it": "Teatro Massimo",
      "lat": 38.12034,
      "lng": 13.35724,
      "hours": "導覽 每天 09:30–18:00（最後入場 17:20）",
      "ticket": "外觀免費；內部導覽€12",
      "walk": "步行約 1 分鐘到 Piazza Verdi 計程車站",
      "desc": "歐洲最大的歌劇院之一，電影《教父 3》結局就在正門階梯拍攝。在外面拍照就好，時間夠的話可以參加 30 分鐘的內部導覽。",
      "min": ""
     },
     {
      "time": "16:25",
      "type": "上車",
      "zh": "威爾第廣場計程車站",
      "it": "Posteggio Taxi – Piazza Verdi",
      "lat": 38.12,
      "lng": 13.3578,
      "hours": "—",
      "ticket": "約€8–12，出發前請確認",
      "walk": "車程約 10 分鐘",
      "desc": "劇院前的威爾第廣場可以招計程車回港口。體力好的話也可以經過政治劇院（Politeama）走回港口，大約 20–25 分鐘。",
      "min": ""
     },
     {
      "time": "16:40",
      "type": "下車",
      "zh": "港口出口（回船）",
      "it": "Varco Porto / Stazione Marittima",
      "lat": 38.1234,
      "lng": 13.3652,
      "hours": "17:30 前回船",
      "ticket": "—",
      "walk": "步行約 5–10 分鐘到船邊",
      "desc": "在港口出口下車，走回 Molo Vittorio Veneto 的郵輪碼頭排隊安檢，預留 30 分鐘以上的緩衝時間。",
      "min": ""
     }
    ]
   },
   {
    "id": "B",
    "title": "方案 B：上午蒙雷阿萊金色馬賽克＋下午巴勒莫精華短走",
    "fit": "最想看馬賽克、可以接受來回各 30 分鐘車程；想省時舒適建議包車來回",
    "summary": "09:15 搭計程車到蒙雷阿萊，在 12:45 午休前看完主教座堂和迴廊，回巴勒莫趕在 13:00 前看馬托拉納教堂。午餐後逛普雷托利亞噴泉、聖加大肋納修道院、大教堂和四角廣場，再到馬西莫劇院，16:30 搭計程車回船。也可以改搭 City Sightseeing 蒙雷阿萊線（12/16 有營運），或在獨立廣場搭 389 號公車。",
    "steps": [
     {
      "time": "09:00",
      "type": "下船",
      "zh": "巴勒莫郵輪碼頭（維托里奧·威尼托碼頭）",
      "it": "Stazione Marittima – Molo Vittorio Veneto",
      "lat": 38.12385,
      "lng": 13.3672,
      "hours": "船靠港 09:00–18:00，17:30 前回船",
      "ticket": "—",
      "walk": "步行約 5 分鐘",
      "desc": "盡早下船。蒙雷阿萊主教座堂只開到 12:45 就午休，所以整個早上都留給蒙雷阿萊。",
      "min": ""
     },
     {
      "time": "09:15",
      "type": "上車",
      "zh": "港口出口計程車站",
      "it": "Posteggio Taxi – Varco Porto, Via Francesco Crispi",
      "lat": 38.1234,
      "lng": 13.3652,
      "hours": "—",
      "ticket": "到蒙雷阿萊單程約€20–30（網路估計），出發前請確認；等候費€18／小時",
      "walk": "車程約 25–30 分鐘",
      "desc": "最省力推薦搭計程車，可以直接停在主教座堂附近，免去爬坡和轉車。建議先跟司機談好來回價格並約定等候，回程會比較安心。",
      "min": ""
     },
     {
      "time": "09:45",
      "type": "下車",
      "zh": "蒙雷阿萊 維托里奧·埃馬努埃萊廣場",
      "it": "Piazza Vittorio Emanuele, Monreale",
      "lat": 38.0816,
      "lng": 13.2911,
      "hours": "—",
      "ticket": "—",
      "walk": "步行約 1 分鐘",
      "desc": "主教座堂正門所在的廣場，389 號公車的終點也在附近。廣場周邊有咖啡館和洗手間，可以先休息再進場。",
      "min": ""
     },
     {
      "time": "09:50",
      "type": "景點",
      "zh": "蒙雷阿萊主教座堂",
      "it": "Duomo di Monreale (Cattedrale di Santa Maria Nuova)",
      "lat": 38.08186,
      "lng": 13.29207,
      "hours": "週一至週六 09:00–12:45、14:00–16:45；彌撒時暫停參觀",
      "ticket": "大殿免費；羅阿諾禮拜堂、屋頂露台、教區博物館另外收費（約€6，套票說法不一），出發前請確認",
      "walk": "步行約 2 分鐘",
      "desc": "12 世紀諾曼國王威廉二世興建，牆面有約 6,400 平方公尺的金色馬賽克，後殿是巨大的全能基督像。屋頂露台要爬很多階梯，想輕鬆參觀的人可以在大殿慢慢欣賞。",
      "min": ""
     },
     {
      "time": "11:00",
      "type": "景點",
      "zh": "蒙雷阿萊本篤會迴廊",
      "it": "Chiostro di Santa Maria Nuova (Chiostro dei Benedettini)",
      "lat": 38.0814,
      "lng": 13.2924,
      "hours": "週一至週六 09:00–18:30（市府資料；CoopCulture 標示至 19:00），最後入場為關門前 30 分鐘",
      "ticket": "€8（另外購票，與主教座堂不通用）",
      "walk": "步行約 3 分鐘回到廣場",
      "desc": "228 根成對的小石柱，每根都有不同的鑲嵌或雕刻，柱頭雕的是聖經故事。迴廊是平面步行，大家都能輕鬆自在逛。",
      "min": ""
     },
     {
      "time": "11:50",
      "type": "上車",
      "zh": "蒙雷阿萊（回程計程車）",
      "it": "Piazza Vittorio Emanuele, Monreale",
      "lat": 38.0816,
      "lng": 13.2911,
      "hours": "—",
      "ticket": "約€20–30，出發前請確認",
      "walk": "車程約 30 分鐘",
      "desc": "搭事先約好的計程車回巴勒莫，直接開到 Piazza Bellini，趕在馬托拉納教堂 13:00 關門前抵達。",
      "min": ""
     },
     {
      "time": "12:25",
      "type": "下車",
      "zh": "貝里尼廣場",
      "it": "Piazza Bellini",
      "lat": 38.1151,
      "lng": 13.3629,
      "hours": "—",
      "ticket": "—",
      "walk": "步行約 1 分鐘",
      "desc": "下車地點就在馬托拉納教堂和聖加大肋納修道院之間，離四角廣場只有 2 分鐘。請司機停在 Via Maqueda 路邊，再步行進廣場。",
      "min": ""
     },
     {
      "time": "12:25",
      "type": "景點",
      "zh": "海軍元帥聖母堂（馬托拉納教堂）",
      "it": "Santa Maria dell'Ammiraglio (La Martorana)",
      "lat": 38.11497,
      "lng": 13.36269,
      "hours": "週一至週六 10:00–13:00（下午是否開放不確定）",
      "ticket": "€2（市府資料）",
      "walk": "步行約 3 分鐘",
      "desc": "12 世紀的拜占庭式教堂，可以和蒙雷阿萊的馬賽克對照著看。13:00 關門，如果來不及就改在外面看看隔壁的紅頂聖卡塔多教堂。",
      "min": ""
     },
     {
      "time": "13:00",
      "type": "午餐",
      "zh": "四角廣場・Via Maqueda 午餐",
      "it": "Quattro Canti / Via Maqueda",
      "lat": 38.11563,
      "lng": 13.36153,
      "hours": "餐廳多為 12:30–15:00",
      "ticket": "—",
      "walk": "步行約 2 分鐘",
      "desc": "在四角廣場附近坐下來吃午餐。想吃得輕鬆，可以去 Via Maqueda 270 的 Ke Palle 點炸飯糰（arancina）（10:00 開門）。",
      "min": ""
     },
     {
      "time": "14:00",
      "type": "景點",
      "zh": "普雷托利亞噴泉",
      "it": "Fontana Pretoria",
      "lat": 38.11549,
      "lng": 13.36208,
      "hours": "戶外，全天",
      "ticket": "免費",
      "walk": "步行約 2 分鐘",
      "desc": "16 世紀文藝復興噴泉，周圍環繞大理石神話雕像，夜裡有燈光。位在市政廳前，緊鄰聖加大肋納修道院。",
      "min": ""
     },
     {
      "time": "14:10",
      "type": "景點",
      "zh": "聖加大肋納修道院・修女甜點坊",
      "it": "Monastero di Santa Caterina – I Segreti del Chiostro",
      "lat": 38.11528,
      "lng": 13.36245,
      "hours": "每天 10:00–18:00，最後入場 17:15（官網）",
      "ticket": "票價出發前請確認",
      "walk": "步行約 8 分鐘",
      "desc": "午後可以參觀巴洛克教堂和修道院迴廊，再到甜點坊買修女古法的卡諾里（cannoli）。屋頂露台看得到普雷托利亞廣場和大教堂圓頂。",
      "min": ""
     },
     {
      "time": "15:00",
      "type": "景點",
      "zh": "巴勒莫主教座堂",
      "it": "Cattedrale di Palermo",
      "lat": 38.11444,
      "lng": 13.35611,
      "hours": "教堂 週一至週六 07:00–19:00；屋頂紀念區 平日 09:30–14:30（冬季下午不能登頂）",
      "ticket": "教堂免費",
      "walk": "步行約 8 分鐘回到四角廣場",
      "desc": "下午只參觀大殿和外觀，看諾曼與阿拉伯風格的外牆和棕櫚樹花園。冬季平日屋頂只開到 14:30，下午不安排登頂。",
      "min": ""
     },
     {
      "time": "15:40",
      "type": "景點",
      "zh": "四角廣場・Morettino 咖啡館",
      "it": "Quattro Canti – Morettino Caffè (Via Vittorio Emanuele 308)",
      "lat": 38.11555,
      "lng": 13.36135,
      "hours": "營業時間出發前請確認",
      "ticket": "依點餐",
      "walk": "步行約 12 分鐘（沿 Via Maqueda）",
      "desc": "在四角廣場轉角的美好年代風格咖啡館，點布里歐修麵包（brioche）或冰淇淋配咖啡，讓大家坐下來喝杯咖啡休息後，再走最後一段。",
      "min": ""
     },
     {
      "time": "16:15",
      "type": "景點",
      "zh": "馬西莫劇院（教父 3 階梯）",
      "it": "Teatro Massimo",
      "lat": 38.12034,
      "lng": 13.35724,
      "hours": "導覽 每天 09:30–18:00",
      "ticket": "外觀免費；導覽€12",
      "walk": "步行約 1 分鐘",
      "desc": "歌劇院正門階梯就是《教父 3》結局的拍攝地。拍完照就在劇院前的威爾第廣場搭計程車回港口。",
      "min": ""
     },
     {
      "time": "16:30",
      "type": "上車",
      "zh": "威爾第廣場計程車站",
      "it": "Posteggio Taxi – Piazza Verdi",
      "lat": 38.12,
      "lng": 13.3578,
      "hours": "—",
      "ticket": "約€8–12，出發前請確認",
      "walk": "車程約 10 分鐘",
      "desc": "在劇院前的威爾第廣場搭計程車回港口。如果下雨或走累了，也可以提早從四角廣場直接叫車回去。",
      "min": ""
     },
     {
      "time": "16:45",
      "type": "下車",
      "zh": "港口出口（回船）",
      "it": "Varco Porto / Stazione Marittima",
      "lat": 38.1234,
      "lng": 13.3652,
      "hours": "17:30 前回船",
      "ticket": "—",
      "walk": "步行約 5–10 分鐘",
      "desc": "在港口出口下車後，走回 Molo Vittorio Veneto 的郵輪碼頭排隊安檢上船，保留約 45 分鐘的緩衝時間。",
      "min": ""
     }
    ]
   }
  ],
  "tips": [
   "天氣：巴勒莫 12 月平均最高約 14°C、最低約 10°C，每月約 12 天有雨。請帶折疊傘、防風外套和防滑好走的鞋，老城石板路下雨會很滑。",
   "帕拉提那禮拜堂遇到彌撒、宗教儀式或活動可能臨時關閉或縮短開放時間。出發前一天請查 federicosecondo.org 或打 +39 091 705 5601。",
   "週三王室公寓不開放，只能參觀禮拜堂和花園。網文說「直接上 2 樓」可能是指平時的路線，當天請依現場指示。",
   "中午會關門的地方：馬托拉納教堂 13:00 關門（下午可能不開）、蒙雷阿萊主教座堂 12:45–14:00 午休。耶穌教堂有網文說中午會休息，但市府資料寫連續開放，出發前請確認。",
   "389 號公車（獨立廣場→蒙雷阿萊主教座堂附近終點）2026 年 6 月曾停駛再恢復，路線變動頻繁；票價約€1.40／90 分鐘，請在菸草店先買票，班距約 35–40 分鐘。想省時省力建議直接搭計程車。",
   "City Sightseeing 蒙雷阿萊線只在部分日期營運，官網列出 2026-12-16 有營運。起點 Stop 1 在 Via E. Amari 138（政治劇院旁，離港口步行約 15 分鐘）。往年冬季時刻表為 09:30、14:00 從 Stop 1 出發，全程約 2 小時，票價請在官網訂票頁確認。",
   "巴拉洛市場、Via Maqueda、四角廣場一帶扒手多，包包請背在胸前，手機不要放在後口袋。",
   "計程車跳錶起跳€3.06、最低€4.59（2025 年資料）。上車前請確認有跳錶或先講好價格；要包車往返蒙雷阿萊，請先談好等候時間和總價。",
   "建議最晚 16:45 回到港口，郵輪 17:30 前要回船。下雨或走累了，可以從四角廣場直接搭計程車回港。",
   "雨天替代：把在戶外的時間改到馬西莫劇院內部導覽（€12，每天 09:30–18:00）或聖加大肋納修道院室內參觀。"
  ]
 },
 "marseille": {
  "date": "2026-12-13",
  "port": "馬賽",
  "title": "馬賽：舊港聖誕與守護聖母院",
  "summary": "MSC 停靠 Cap Janet 的 MPCT 郵輪碼頭（Porte 4, Môle Léon Gourret），距舊港約 7.5 km。港方免費接駁車送到 Place de la Joliette，再步行經大教堂、聖讓堡到舊港。12/13 是週日，santons 市集（11/14–1/3）照常開放；守護聖母院搭 60 號公車最省力。",
  "verify": "已查證：MSC 官方港口頁寫停靠 MPCT（Porte 4, Môle Léon Gourret）；港方免費接駁車終點在 Joliette（9 Quai du Lazaret，Terrasses du Port 旁），MSC 頁面寫約每 20 分鐘一班、09:20–17:20、車程約 25 分鐘（塞車時可到 45 分鐘）。Foire aux santons 2026 年在 11/14–2027/1/3 的 Quai du Port 舉行，免費，10:00–19:00。60 號公車從 Mucem Saint-Jean 經 Quai du Port、Hôtel de Ville、Vieux-Port 到 Notre Dame de la Garde，約 12 分鐘一班、車程約 19 分鐘。聖母院免費參觀，官網列 07:00–18:00，但只寫到 12/12 為止，12/13 起的時段請再確認。小火車 2026 年票價成人 11€、兒童 6€，冬季班距未公布。耶誕木屋市集與 Ombrière 周邊的佈置位置未查到 2026 年官方資料。",
  "plans": [
   {
    "id": "A",
    "title": "輕鬆舒適路線：接駁車＋步行海濱＋60 號公車上聖母院",
    "fit": "全家含祖父母；平路為主，上坡全程搭公車",
    "summary": "接駁車到 Joliette 後沿海平路走到 La Major 和聖讓堡（MuCEM 外觀），到舊港逛 santons 市集、午餐，再搭 60 號公車上守護聖母院，下山後回 Joliette 搭接駁車。",
    "steps": [
     {
      "time": "09:30",
      "type": "下船",
      "zh": "MPCT 郵輪碼頭下船",
      "it": "Marseille Provence Cruise Terminal (Porte 4)",
      "lat": 43.33661,
      "lng": 5.34564,
      "hours": "依船上通知",
      "ticket": "免費接駁車",
      "desc": "地上有綠線指引，跟著走 5–12 分鐘到 Porte 4 出口附近的接駁車站。碼頭很大，出發前建議先在碼頭上洗手間。記得帶船卡和護照影本。",
      "walk": "接駁車約 25 分鐘（塞車時最多 45 分鐘）到 Joliette"
     },
     {
      "time": "10:00",
      "type": "下車",
      "zh": "Joliette 接駁車下車點",
      "it": "Place de la Joliette / 9 Quai du Lazaret",
      "lat": 43.3053,
      "lng": 5.3664,
      "hours": "接駁約 09:20–17:20（出發前請確認）",
      "ticket": "免費",
      "desc": "下車點在 Les Terrasses du Port 購物中心與海運站之間（Five Guys 之後）。回程也在這裡上車，請記住位置；購物中心有乾淨的廁所。",
      "walk": "沿海濱平路步行約 10 分鐘（約 700 m）到 La Major"
     },
     {
      "time": "10:15",
      "type": "景點",
      "zh": "馬賽主教座堂（La Major）",
      "it": "Cathédrale La Major",
      "lat": 43.29944,
      "lng": 5.36389,
      "hours": "出發前請確認",
      "ticket": "免費",
      "desc": "19 世紀的羅馬－拜占庭式條紋大教堂，是法國最大的教堂之一。外面的海濱步道很適合拍全家合照，內部大理石馬賽克很華麗。",
      "walk": "沿 Esplanade de la Major 步行約 8 分鐘到聖讓堡"
     },
     {
      "time": "10:40",
      "type": "景點",
      "zh": "聖讓堡與 MuCEM 空橋（外觀）",
      "it": "Fort Saint-Jean / MuCEM (passerelle)",
      "lat": 43.29556,
      "lng": 5.36278,
      "hours": "堡區步道開放時間出發前請確認",
      "ticket": "外部步道與空橋免費；MuCEM 展覽付費",
      "desc": "從 La Major 旁有高架步道直接進入聖讓堡，堡內花園可俯瞰舊港入口，再沿空橋走到 MuCEM 的鏤空黑色外殼。只看外部不必買票，坡度平緩。",
      "walk": "從聖讓堡下到舊港北岸約 8 分鐘"
     },
     {
      "time": "11:15",
      "type": "景點",
      "zh": "Santons 聖誕人偶市集",
      "it": "Foire aux santons, Quai du Port",
      "lat": 43.2961,
      "lng": 5.37,
      "hours": "2026/11/14–2027/1/3，10:00–19:00",
      "ticket": "免費",
      "desc": "第 224 屆市集，約 21 家 santonnier 攤位，展示普羅旺斯傳統陶土聖誕人偶。可以挑一尊小 santon 當紀念品，當旅行紀念伴手禮非常合適。",
      "walk": "沿 Quai du Port 往東平路約 5 分鐘到 Ombrière"
     },
     {
      "time": "11:50",
      "type": "景點",
      "zh": "舊港 Ombrière 鏡面頂棚",
      "it": "L'Ombrière, Quai de la Fraternité",
      "lat": 43.29522,
      "lng": 5.37431,
      "hours": "全天",
      "ticket": "免費",
      "desc": "Norman Foster 設計的不鏽鋼鏡面頂棚，站在下面可以看到全家的倒影。早上有魚販在 Quai des Belges 賣魚；耶誕木屋的位置請以現場為準。",
      "walk": "附近找午餐，步行 2–5 分鐘"
     },
     {
      "time": "12:15",
      "type": "午餐",
      "zh": "舊港周邊午餐",
      "it": "Vieux-Port (Quai de Rive Neuve / Quai du Port)",
      "lat": 43.29522,
      "lng": 5.37431,
      "hours": "多數 12:00–14:30",
      "ticket": "依餐廳",
      "desc": "正宗 bouillabaisse 每人常在 60€ 以上，而且要預訂。一般家庭可選 crêperie 或 brasserie。週日部分店家公休，最好先查好 2–3 家備選。",
      "walk": "走回 Quai du Port 的 Hôtel de Ville 公車站約 5 分鐘"
     },
     {
      "time": "13:30",
      "type": "上車",
      "zh": "60 號公車（Hôtel de Ville 站）",
      "it": "RTM Bus 60 – arrêt Hôtel de Ville",
      "lat": 43.296,
      "lng": 5.369,
      "hours": "約每 12 分鐘一班（出發前請確認）",
      "ticket": "RTM 單程票（價格出發前請確認）",
      "desc": "60 號從 Mucem Saint-Jean 開往 Notre Dame de la Garde，Quai du Port、Hôtel de Ville、Vieux-Port 都有停。車程約 19 分鐘，免爬陡坡。週日班次可能較少。",
      "walk": "坐到終點站 Notre Dame de la Garde"
     },
     {
      "time": "14:00",
      "type": "景點",
      "zh": "守護聖母院",
      "it": "Basilique Notre-Dame de la Garde",
      "lat": 43.28394,
      "lng": 5.3713,
      "hours": "07:00–18:00（12/13 起出發前請確認）",
      "ticket": "免費（廁所 0.5€）",
      "desc": "建在 149 m 高的山丘上，是馬賽的地標「Bonne Mère」，內部有大量船隻還願畫和金色馬賽克。觀景台可 360° 看舊港、伊夫堡和群島，山上風大請帶外套。",
      "walk": "搭 60 號回 Mucem Saint-Jean 約 20 分鐘"
     },
     {
      "time": "15:15",
      "type": "上車",
      "zh": "60 號公車下山",
      "it": "Bus 60 → Mucem Saint-Jean",
      "lat": 43.28394,
      "lng": 5.3713,
      "hours": "約每 12 分鐘一班",
      "ticket": "RTM 單程票",
      "desc": "在終點站 Mucem Saint-Jean 下車可以少走路。如果走累了，Vieux-Port 一帶也可以叫計程車回 Joliette。",
      "walk": "從 Mucem Saint-Jean 沿海平路步行約 15 分鐘（約 1.1 km）到 Joliette 接駁站"
     },
     {
      "time": "16:00",
      "type": "交通",
      "zh": "Joliette 搭接駁車回船",
      "it": "Navette gratuite – Joliette → MPCT",
      "lat": 43.3053,
      "lng": 5.3664,
      "hours": "最晚 16:30 前上車",
      "ticket": "免費",
      "desc": "全船 17:30 前要回船，接駁車塞車時要 45 分鐘，加上碼頭步行，請 16:30 前上車。排隊人潮多時再提早。",
      "walk": "接駁車 25–45 分鐘＋碼頭內步行 5–12 分鐘"
     }
    ]
   },
   {
    "id": "B",
    "title": "腳力好：小火車上聖母院＋Le Panier 老城散步",
    "fit": "腳力好的成員，或想坐觀光小火車吹海風看風景的人",
    "summary": "上午先走 Le Panier 老城巷弄和 Vieille Charité，中午在舊港逛 santons 市集，下午搭 Petit Train 1 號線上聖母院（山上至少停 20 分鐘，搭下一班回來）。",
    "steps": [
     {
      "time": "10:00",
      "type": "下車",
      "zh": "Joliette 接駁車下車點",
      "it": "Place de la Joliette / 9 Quai du Lazaret",
      "lat": 43.3053,
      "lng": 5.3664,
      "hours": "接駁約 09:20–17:20（出發前請確認）",
      "ticket": "免費",
      "desc": "跟方案 A 一樣從 MPCT 搭免費接駁車過來。B 方案上坡、階梯比較多，不建議推輪椅或嬰兒車。",
      "walk": "步行約 10 分鐘到 Vieille Charité（緩上坡）"
     },
     {
      "time": "10:15",
      "type": "景點",
      "zh": "老慈善院",
      "it": "La Vieille Charité",
      "lat": 43.29984,
      "lng": 5.36786,
      "hours": "週日博物館開放時段出發前請確認",
      "ticket": "中庭免費",
      "desc": "17 世紀的救濟院，有三層粉色石拱廊圍著巴洛克禮拜堂，是 Le Panier 最漂亮的建築。中庭可以自由參觀。",
      "walk": "往南穿過 Le Panier 巷弄約 8 分鐘"
     },
     {
      "time": "10:40",
      "type": "步行",
      "zh": "Le Panier 老城巷弄",
      "it": "Le Panier / Place de Lenche",
      "lat": 43.2978,
      "lng": 5.3657,
      "hours": "全天",
      "ticket": "免費",
      "desc": "馬賽最古老的街區，有彩色牆面、塗鴉、肥皂小店和咖啡館，Place de Lenche 可遠眺聖母院。巷弄有階梯，路面是石板路。",
      "walk": "下坡約 8 分鐘到 Quai du Port"
     },
     {
      "time": "11:15",
      "type": "景點",
      "zh": "Santons 市集與 Ombrière",
      "it": "Foire aux santons / L'Ombrière",
      "lat": 43.2961,
      "lng": 5.37,
      "hours": "10:00–19:00",
      "ticket": "免費",
      "desc": "逛 santons 攤位後到 Ombrière 拍倒影照，接著在舊港吃午餐（參考方案 A）。",
      "walk": "在舊港周邊午餐後，到小火車站約 5 分鐘"
     },
     {
      "time": "13:30",
      "type": "上車",
      "zh": "Petit Train 1 號線（聖母院線）",
      "it": "Petit Train de Marseille – Circuit 1 Notre-Dame",
      "lat": 43.2956,
      "lng": 5.3725,
      "hours": "全年每日行駛，冬季時刻出發前請確認",
      "ticket": "成人 11€／優惠票 6€（2026 年）",
      "desc": "觀光小火車從舊港出發，繞 Rive Neuve 上山，在聖母院停留至少 20 分鐘，再搭下一班回來。上車點以舊港 Quai du Port 現場站牌為準。",
      "walk": "車程單程約 30 分鐘（出發前請確認）"
     },
     {
      "time": "14:10",
      "type": "景點",
      "zh": "守護聖母院",
      "it": "Basilique Notre-Dame de la Garde",
      "lat": 43.28394,
      "lng": 5.3713,
      "hours": "07:00–18:00（出發前請確認）",
      "ticket": "免費",
      "desc": "參觀教堂和觀景台。記下下一班小火車的時間，不要錯過。",
      "walk": "小火車回舊港約 30 分鐘"
     },
     {
      "time": "15:30",
      "type": "步行",
      "zh": "舊港 → MuCEM 外觀 → Joliette",
      "it": "Fort Saint-Jean / MuCEM → Joliette",
      "lat": 43.29687,
      "lng": 5.36091,
      "hours": "全天",
      "ticket": "免費",
      "desc": "回程順路經過聖讓堡外和 MuCEM 外觀，再沿海濱走到 Joliette，16:30 前搭上接駁車。",
      "walk": "約 25 分鐘（約 1.8 km）到接駁站"
     }
    ]
   }
  ],
  "tips": [
   "12/13 是週日，部分商店和餐廳公休，舊港市集和聖母院照常開放。",
   "接駁車可能塞車，請以最晚 16:30 在 Joliette 上車為準；真的趕不上就在舊港叫計程車直奔 MPCT Porte 4（約 20 分鐘）。",
   "聖母院山頂風大，12 月體感偏冷，請帶防風外套。",
   "舊港和公車上要提防扒手，護照放船上，只帶影本。",
   "60 號公車和小火車的冬季時刻都請出發前查 RTM 和官方網站。"
  ]
 },
 "genoa": {
  "date": "2026-12-14",
  "port": "熱那亞",
  "title": "熱那亞：港口、caruggi 巷弄與 Via Garibaldi",
  "summary": "郵輪停靠 Stazione Marittima（Ponte dei Mille），從碼頭到古港和舊城都能步行。12/14 是週一，Strada Nuova 博物館群和哥倫布之家都休館，行程以外觀、教堂和巷弄散步為主。大教堂 12:00–15:00 午休，請排在上午參觀。",
  "verify": "已查證：Musei di Strada Nuova（Palazzo Rosso、Bianco、Tursi）週一休館，週二至週五 9–19 開放；Casa di Colombo 週一休館（週二至週五 10–18）；Cattedrale San Lorenzo 週一至週五 8–12、15–19。2025 年 De Ferrari 廣場有大型聖誕樹，市府也有 2026 年的聖誕樹贊助文件，但 2026 年實際擺設請再確認。Euribia 停靠 Ponte dei Mille 還是 Ponte Andrea Doria 未能確認，請以船上通知為準（兩處相鄰）。地鐵票價、聖誕市集位置未查證。",
  "plans": [
   {
    "id": "A",
    "title": "全步行＋地鐵回程：古港 → 大教堂 → De Ferrari → Via Garibaldi",
    "fit": "全家含祖父母；平路為主，回程搭地鐵省力",
    "summary": "沿港邊走到聖喬治宮和古港，穿過 Piazza Banchi 一帶的 caruggi 到大教堂（中午前），再到 De Ferrari 看聖誕樹、吃 focaccia，下午看 Porta Soprana、哥倫布之家外觀和 Via Garibaldi 的宮殿外觀，從 De Ferrari 搭地鐵到 Principe 回船。",
    "steps": [
     {
      "time": "09:30",
      "type": "下船",
      "zh": "熱那亞海運站",
      "it": "Stazione Marittima – Ponte dei Mille",
      "lat": 44.4154,
      "lng": 8.9226,
      "hours": "依船上通知",
      "ticket": "—",
      "desc": "熱那亞是 Euribia 的上下船母港，碼頭人潮多。下船後沿 Via Gramsci 的海港側往東南走，記住這棟 20 世紀初的海運站建築，回程好認。",
      "walk": "沿港邊平路步行約 15–20 分鐘（約 1.2 km）到聖喬治宮"
     },
     {
      "time": "09:50",
      "type": "景點",
      "zh": "聖喬治宮",
      "it": "Palazzo San Giorgio",
      "lat": 44.40972,
      "lng": 8.92806,
      "hours": "外觀全天",
      "ticket": "外觀免費",
      "desc": "13 世紀建造，曾是聖喬治銀行總部，馬可波羅傳說就在這裡被囚、口述遊記。面海的立面有聖喬治屠龍壁畫，很適合拍照。",
      "walk": "過馬路就是古港，步行 3 分鐘"
     },
     {
      "time": "10:05",
      "type": "景點",
      "zh": "古港與水族館外觀",
      "it": "Porto Antico / Acquario di Genova / Bigo",
      "lat": 44.41028,
      "lng": 8.92667,
      "hours": "全天",
      "ticket": "步行免費；水族館與 Bigo 付費（出發前請確認）",
      "desc": "Renzo Piano 改造的古港，有水族館、Bigo 起重機觀景台和海濱步道。時間有限，以散步拍照為主；若想入內參觀水族館，需另外安排約 2 小時。",
      "walk": "穿過高架道路進入舊城，步行約 6 分鐘到 Piazza Banchi"
     },
     {
      "time": "10:40",
      "type": "步行",
      "zh": "Caruggi 巷弄（Banchi、Via San Luca）",
      "it": "Caruggi – Piazza Banchi / Via San Luca",
      "lat": 44.4093,
      "lng": 8.9296,
      "hours": "店家約 9:30 起",
      "ticket": "免費",
      "desc": "熱那亞舊城是歐洲最大的中世紀巷弄區之一，巷子窄、建築高。Loggia dei Mercanti 是昔日的交易所。巷弄裡偶有陡坡，請跟緊彼此。",
      "walk": "沿 Via San Lorenzo 方向步行約 8 分鐘到大教堂"
     },
     {
      "time": "11:10",
      "type": "景點",
      "zh": "聖羅倫佐主教座堂",
      "it": "Cattedrale di San Lorenzo",
      "lat": 44.4075,
      "lng": 8.93139,
      "hours": "週一至五 8:00–12:00、15:00–19:00",
      "ticket": "教堂免費；寶物館另計（出發前請確認）",
      "desc": "黑白條紋的哥德式立面，門口有石獅子。教堂內保存一枚二戰時打穿屋頂卻沒爆炸的英軍砲彈。12:00 關門，請在此之前進去。",
      "walk": "沿 Via San Lorenzo 上行約 4 分鐘到 Palazzo Ducale／De Ferrari"
     },
     {
      "time": "11:45",
      "type": "景點",
      "zh": "De Ferrari 廣場與總督宮",
      "it": "Piazza De Ferrari / Palazzo Ducale",
      "lat": 44.4075,
      "lng": 8.93389,
      "hours": "廣場全天；總督宮展覽出發前請確認",
      "ticket": "廣場免費",
      "desc": "熱那亞的中心廣場，有大噴泉和歌劇院，聖誕節期間通常會擺巨型聖誕樹（2026 年出發前請確認）。總督宮中庭可以免費穿越，也有乾淨的廁所。",
      "walk": "步行約 3 分鐘到 Vico della Casana"
     },
     {
      "time": "12:15",
      "type": "午餐",
      "zh": "Focaccia 午餐",
      "it": "Antico Forno della Casana (Vico della Casana)",
      "lat": 44.4086,
      "lng": 8.9336,
      "hours": "營業時間出發前請確認",
      "ticket": "約 2–4€／片",
      "desc": "熱那亞的 focaccia 外脆內軟、表面油亮帶鹽粒，也可以試加了 stracchino 起司的 focaccia di Recco。站著吃或外帶到廣場吃都可以，價格親民。",
      "walk": "步行約 5 分鐘到 Porta Soprana"
     },
     {
      "time": "13:00",
      "type": "景點",
      "zh": "Porta Soprana 與哥倫布之家（外觀）",
      "it": "Porta Soprana / Casa di Colombo",
      "lat": 44.40517,
      "lng": 8.93353,
      "hours": "城門外觀全天；哥倫布之家週一休館",
      "ticket": "外觀免費",
      "desc": "12 世紀的雙塔城門保存完好。旁邊的哥倫布之家是重建的小屋，相傳是哥倫布童年的家，週一休館，只能看外觀。旁邊還有 Sant'Andrea 迴廊遺跡。",
      "walk": "經 Via XX Settembre／Piazza Fontane Marose 步行約 15 分鐘到 Via Garibaldi（緩上坡）"
     },
     {
      "time": "13:45",
      "type": "景點",
      "zh": "Via Garibaldi 與羅利宮殿群（外觀）",
      "it": "Via Garibaldi – Palazzi dei Rolli",
      "lat": 44.411,
      "lng": 8.9333,
      "hours": "街道全天；Musei di Strada Nuova 週一休館",
      "ticket": "街道免費",
      "desc": "UNESCO 世界遺產，16 世紀貴族宮殿沿街排開，Palazzo Rosso、Bianco、Tursi 都在這條街上。週一博物館休館，可以看立面，部分宮殿的大廳或中庭若有開放可探頭欣賞。",
      "walk": "回到 De Ferrari 地鐵站約 8 分鐘"
     },
     {
      "time": "14:45",
      "type": "上車",
      "zh": "地鐵 De Ferrari 站",
      "it": "Metropolitana – De Ferrari",
      "lat": 44.408,
      "lng": 8.9342,
      "hours": "約 6:00–21:00（出發前請確認）",
      "ticket": "AMT 單程票（約 2€，出發前請確認）",
      "desc": "搭地鐵到 Principe 站（中途經 San Giorgio、Darsena），比走回碼頭省力很多。地鐵站有電扶梯。",
      "walk": "坐到 Principe 約 8 分鐘"
     },
     {
      "time": "15:00",
      "type": "下車",
      "zh": "Principe 站",
      "it": "Metropolitana – Principe",
      "lat": 44.417,
      "lng": 8.9219,
      "hours": "—",
      "ticket": "—",
      "desc": "出站後往海邊走就是 Stazione Marittima。時間還夠的話，可以在海運站附近喝杯咖啡。",
      "walk": "步行約 7 分鐘到海運站，16:30 前登船"
     }
    ]
   }
  ],
  "tips": [
   "週一休館：Musei di Strada Nuova、Casa di Colombo（皆已查證）。想進博物館的成員請改在登船前或下船日安排。",
   "大教堂 12:00–15:00 午休，一定要排在中午前。",
   "熱那亞是母港，下午會有大量新乘客報到登船，安檢可能要排隊，請 16:00 前回到碼頭。",
   "舊城巷弄晚上比較冷清，下午走大路回程，並注意隨身財物。",
   "Focaccia 早上最新鮮，可以早點買一片當點心。"
  ]
 },
 "naples": {
  "date": "2026-12-15",
  "port": "拿坡里",
  "title": "拿坡里：市中心到 Spaccanapoli、聖誕馬槽街",
  "summary": "給不去龐貝的家人。郵輪停在 Stazione Marittima（Molo Angioino），出站就是 Piazza Municipio 和新堡。下午走 Galleria Umberto I、Plebiscito 廣場、Via Toledo，傍晚進 Spaccanapoli 和 San Gregorio Armeno 的聖誕馬槽街，在 Via dei Tribunali 吃披薩當晚餐，搭地鐵 1 號線回港，19:30 前登船。",
  "verify": "已查證：新堡（Maschio Angioino）週一至週六 8:30–18:30、週日休館；San Gregorio Armeno 2026 年馬槽市集提前到 11/1 開幕，結束日期與每日時段官方尚未公布（往年開到 1 月初）。未查證：新堡票價、披薩店營業時間、纜車和地鐵票價，以及 Stazione Marittima 的確切靠泊點（MSC 有時停在 Molo Angioino 或其他碼頭）。",
  "plans": [
   {
    "id": "A",
    "title": "市中心經典步行＋聖誕馬槽街＋披薩晚餐",
    "fit": "全家含祖父母（不去龐貝的家人）；約 3.5 km，回程搭地鐵",
    "summary": "下船後先看新堡，再經拱廊、Plebiscito 廣場，沿 Via Toledo 北上到 Gesù Nuovo，進 Spaccanapoli 和 San Gregorio Armeno，17:30 在 Via dei Tribunali 吃披薩，18:40 搭地鐵 1 號線從 Duomo 回 Municipio。",
    "steps": [
     {
      "time": "13:30",
      "type": "下船",
      "zh": "拿坡里海運站",
      "it": "Stazione Marittima – Molo Angioino",
      "lat": 40.8379,
      "lng": 14.2547,
      "hours": "依船上通知",
      "ticket": "—",
      "desc": "出海運站就能看到新堡和維蘇威火山。12 月的日落大約 16:40，市中心散步請以傍晚前為主，夜晚則看馬槽街的燈飾。",
      "walk": "步行約 5 分鐘到新堡"
     },
     {
      "time": "13:40",
      "type": "景點",
      "zh": "新堡（安茹城堡）",
      "it": "Castel Nuovo (Maschio Angioino)",
      "lat": 40.83833,
      "lng": 14.25278,
      "hours": "週一至六 8:30–18:30（週日休）",
      "ticket": "博物館收費（出發前請確認）；外觀免費",
      "desc": "13 世紀安茹王朝興建的五塔城堡，入口是亞拉岡王朝的白色大理石凱旋門。時間不多的話，看外觀和 Piazza Municipio 的港景就很值得。",
      "walk": "步行約 5 分鐘到溫貝托一世拱廊"
     },
     {
      "time": "14:10",
      "type": "景點",
      "zh": "溫貝托一世拱廊",
      "it": "Galleria Umberto I",
      "lat": 40.83833,
      "lng": 14.24944,
      "hours": "全天",
      "ticket": "免費",
      "desc": "1890 年完工的十字形玻璃穹頂拱廊，地面有黃道十二宮馬賽克。聖誕期間常有大型聖誕樹，可以躲雨，也有長椅可以坐下歇腳休息。",
      "walk": "對面是聖卡洛歌劇院，步行約 4 分鐘到 Plebiscito"
     },
     {
      "time": "14:30",
      "type": "景點",
      "zh": "公民投票廣場與 Gambrinus 咖啡",
      "it": "Piazza del Plebiscito / Gran Caffè Gambrinus",
      "lat": 40.83583,
      "lng": 14.24861,
      "hours": "廣場全天；咖啡館約 7:00 起",
      "ticket": "咖啡約 1.5–5€（出發前請確認）",
      "desc": "半圓柱廊環抱的大廣場，一邊是王宮，一邊是 San Francesco di Paola 教堂。Gambrinus 是百年咖啡館，可以喝杯 espresso、吃 sfogliatella 或 babà 休息一下。",
      "walk": "沿 Via Toledo 北上約 15 分鐘（約 1.2 km，平路）到 Gesù Nuovo"
     },
     {
      "time": "15:15",
      "type": "步行",
      "zh": "Via Toledo 購物大街",
      "it": "Via Toledo",
      "lat": 40.8392,
      "lng": 14.2484,
      "hours": "店家約 10:00–20:00",
      "ticket": "免費",
      "desc": "拿坡里最主要的步行購物街。左側是西班牙區的斜坡窄巷，不必深入。想坐纜車的話，Augusteo 站就在這段路上（見選項）。",
      "walk": "往北經 Piazza Dante 方向，右轉進 Piazza del Gesù Nuovo"
     },
     {
      "time": "15:35",
      "type": "景點",
      "zh": "新耶穌教堂與聖嘉勒修道院",
      "it": "Chiesa del Gesù Nuovo / Santa Chiara",
      "lat": 40.84694,
      "lng": 14.25083,
      "hours": "教堂約 8:00–13:00、16:00–19:30（出發前請確認）",
      "ticket": "教堂免費；聖嘉勒迴廊收費（出發前請確認）",
      "desc": "Gesù Nuovo 的鑽石切面石牆外觀很特別，內部是華麗的巴洛克風格。對面的 Santa Chiara 有馬約利卡彩磚迴廊，但收費且可能接近關門，可以只看外觀。",
      "walk": "沿 Spaccanapoli（Via Benedetto Croce）往東約 5 分鐘"
     },
     {
      "time": "16:00",
      "type": "步行",
      "zh": "Spaccanapoli 直線老街",
      "it": "Spaccanapoli – Piazza San Domenico Maggiore",
      "lat": 40.84889,
      "lng": 14.25472,
      "hours": "全天",
      "ticket": "免費",
      "desc": "把古城切成兩半的筆直老街，兩旁是小教堂、甜點店和紀念品店。在 Scaturchio 可以買 ministeriale 巧克力或 sfogliatella。人潮多時請留意隨身貴重物品並相互照應。",
      "walk": "左轉進 Via San Gregorio Armeno 約 4 分鐘"
     },
     {
      "time": "16:20",
      "type": "景點",
      "zh": "聖誕馬槽街",
      "it": "Via San Gregorio Armeno",
      "lat": 40.8504,
      "lng": 14.2575,
      "hours": "2026 年 11/1 開幕，每日時段出發前請確認",
      "ticket": "免費",
      "desc": "全世界最有名的手工聖誕馬槽（presepe）街，除了耶穌誕生場景，還有足球明星、政治人物的諷刺小偶，12 月中人潮非常多。天黑後燈光最漂亮。",
      "walk": "走到 Via dei Tribunali 約 3 分鐘"
     },
     {
      "time": "17:30",
      "type": "午餐",
      "zh": "Via dei Tribunali 披薩（晚餐）",
      "it": "Pizzeria Di Matteo / Sorbillo – Via dei Tribunali",
      "lat": 40.85098,
      "lng": 14.25846,
      "hours": "營業時間出發前請確認",
      "ticket": "Margherita 約 6–10€（出發前請確認）",
      "desc": "拿坡里披薩的發源街。Di Matteo 的炸披薩（pizza fritta）很有名，Sorbillo 名氣最大但常要排隊。17:30 前到可以避開晚餐人潮；人多時建議分兩桌或外帶。",
      "walk": "沿 Via Duomo 南行約 6 分鐘到地鐵 Duomo 站"
     },
     {
      "time": "18:40",
      "type": "上車",
      "zh": "地鐵 1 號線 Duomo 站",
      "it": "Metropolitana Linea 1 – Duomo",
      "lat": 40.8472,
      "lng": 14.2607,
      "hours": "約 6:00–23:00（出發前請確認）",
      "ticket": "UnicoNapoli 單程票（出發前請確認）",
      "desc": "搭往 Piscinola 方向（經 Università）到 Municipio，只要 2 站，方向請以站內標示為準。1 號線的許多車站本身就是當代藝術車站，有電扶梯。",
      "walk": "坐到 Municipio 約 5 分鐘"
     },
     {
      "time": "18:55",
      "type": "下車",
      "zh": "地鐵 Municipio 站",
      "it": "Metropolitana Linea 1 – Municipio",
      "lat": 40.8403,
      "lng": 14.2528,
      "hours": "—",
      "ticket": "—",
      "desc": "出站就是 Piazza Municipio，往海邊走就是海運站。19:30 前登船，船 20:00 開。",
      "walk": "步行約 8 分鐘到海運站"
     }
    ]
   },
   {
    "id": "B",
    "title": "選項：Funicolare Centrale 上 Vomero 看夜景（加 1 小時）",
    "fit": "想看海灣全景的人；用來取代 Gesù Nuovo 那段",
    "summary": "在 Via Toledo 的 Augusteo 站搭纜車上 Vomero 的 Piazza Fuga，在附近看一眼海灣後原車下山，再接回 Spaccanapoli。時間緊的話建議跳過。",
    "steps": [
     {
      "time": "15:15",
      "type": "上車",
      "zh": "中央纜車 Augusteo 站",
      "it": "Funicolare Centrale – Augusteo",
      "lat": 40.8392,
      "lng": 14.2484,
      "hours": "約 7:00–22:00（出發前請確認）",
      "ticket": "UnicoNapoli 單程票（出發前請確認）",
      "desc": "Augusteo 站在 Via Toledo 旁的 Piazza Duca d'Aosta，是全義大利最繁忙的纜車之一，坐到山頂約 5 分鐘。",
      "walk": "上到 Piazza Fuga（Vomero）約 5 分鐘"
     },
     {
      "time": "15:30",
      "type": "景點",
      "zh": "Vomero 區 Piazza Fuga 周邊",
      "it": "Vomero – Piazza Fuga",
      "lat": 40.844,
      "lng": 14.237,
      "hours": "全天",
      "ticket": "免費",
      "desc": "Vomero 是山丘上的住宅商業區，往上可以走到聖艾爾摩城堡（坡陡、要另外計時，想保留體力者不建議）。看一下風景、喝杯熱飲就下山。",
      "walk": "原纜車下山，再步行約 15 分鐘到 Gesù Nuovo"
     }
    ]
   }
  ],
  "tips": [
   "去龐貝的家人搭船方行程，請在會合時間前跟這組確認回船時間（全船 19:30 前登船）。",
   "拿坡里扒手多：手機不要放後口袋，背包背在前面，Via Toledo 和馬槽街特別擁擠。",
   "12 月天黑早（約 16:40），老城巷弄晚上還算熱鬧，但請走主要街道。",
   "Gambrinus 坐著喝比站在吧台喝貴很多，看清楚價格。",
   "披薩店多數只收現金或要排隊，請帶歐元零錢。"
  ]
 },
 "tunis": {
  "date": "2026-12-17",
  "port": "突尼斯",
  "title": "突尼斯：迦太基遺跡＋藍白小鎮 Sidi Bou Said",
  "summary": "郵輪停在 La Goulette 港。迦太基與 Sidi Bou Said 都在港口北方 5–10 km。最穩當省力的是參加 MSC 岸上行程，或在碼頭內的計程車站談好一台車包 4–5 小時。腳力好的人可以搭 TGM 輕軌，但從碼頭走到車站並不順，需有心理準備。",
  "verify": "已查證：迦太基博物館冬季 8:30–17:00；2026/4/1 起新票價，迦太基（B 類）20 DT，2027 年起 30 DT，Bardo＋迦太基聯票 2026 年 45 DT，但是否就是外國遊客的迦太基通票並未明載；舊資料寫通票 12 DT，已過時。未查證：各遺址冬季時段（推估同為 8:30–17:00）、TGM 票價與班距、計程車行情（網路參考約 4 人座 40€ 半日包車，資料年代偏舊）、碼頭與 TGM 站確切位置（座標為約略值）。",
  "plans": [
   {
    "id": "A",
    "title": "推薦：MSC 岸上行程或碼頭包計程車（4–5 小時）",
    "fit": "全家含祖父母；最省力、最安全",
    "summary": "MSC 岸上行程有導遊、準時回船有保障，最省心無負擔。自行包車請在碼頭內的計程車站談好總價、時數、行程和幣別，依序遊覽迦太基港口、Byrsa 山、安東尼浴場和 Sidi Bou Said，14:30–15:00 回港。",
    "steps": [
     {
      "time": "09:30",
      "type": "下船",
      "zh": "La Goulette 郵輪碼頭",
      "it": "Port de La Goulette – Terminal croisière",
      "lat": 36.8143,
      "lng": 10.309,
      "hours": "依船上通知",
      "ticket": "—",
      "desc": "碼頭建築仿麥地那風格，裡面有計程車調度站和換匯處。突尼斯第納爾（DT）不能帶出境，換少量就好。直接跟司機（而不是調度員）談價，寫在紙上確認。",
      "walk": "計程車約 15 分鐘到迦太基港口"
     },
     {
      "time": "09:50",
      "type": "上車",
      "zh": "包車出發（議價）",
      "it": "Taxi depuis le port (négocier)",
      "lat": 36.8143,
      "lng": 10.309,
      "hours": "約 4–5 小時",
      "ticket": "參考：4 人座約 40–60€（舊資料，出發前請確認）",
      "desc": "談好「港口→迦太基→Sidi Bou Said→港口、5 小時、總價○○歐元或 DT、回程付款」。祖孫三代人多時，可以包 6–8 人座的廂型車。",
      "walk": "車程約 15 分鐘"
     },
     {
      "time": "10:10",
      "type": "景點",
      "zh": "迦太基布匿港口",
      "it": "Ports puniques de Carthage",
      "lat": 36.8459,
      "lng": 10.323,
      "hours": "冬季約 8:30–17:00（出發前請確認）",
      "ticket": "迦太基遺址票（2026 年約 20 DT，出發前請確認）",
      "desc": "圓形軍港和長方形商港的遺跡，迦太基當年海上霸權的核心，現在只剩水池與小島，旁邊的 Tophet 祭祀遺址也可順道看。遺址間告示少，建議請司機或導遊說明。",
      "walk": "車程約 5 分鐘到 Byrsa 山"
     },
     {
      "time": "10:40",
      "type": "景點",
      "zh": "Byrsa 山與迦太基博物館",
      "it": "Colline de Byrsa / Musée national de Carthage",
      "lat": 36.85278,
      "lng": 10.32333,
      "hours": "冬季 8:30–17:00",
      "ticket": "含在遺址票內（出發前請確認）",
      "desc": "古迦太基的衛城，山頂可以俯瞰海灣和布匿港口，有布匿時期住宅遺跡和聖路易大教堂（外觀）。博物館收藏馬賽克和石棺，坡道不長，走起來平緩舒適。",
      "walk": "車程約 5 分鐘到安東尼浴場"
     },
     {
      "time": "11:30",
      "type": "景點",
      "zh": "安東尼浴場",
      "it": "Thermes d'Antonin",
      "lat": 36.85432,
      "lng": 10.3351,
      "hours": "冬季約 8:30–17:00（出發前請確認）",
      "ticket": "含在遺址票內",
      "desc": "2 世紀的羅馬帝國大型公共浴場，緊鄰海邊，巨大的石柱和地下拱室保存良好。附近是總統府，嚴禁朝總統府方向拍照。園區步道平坦，但面積大。",
      "walk": "車程約 10 分鐘到 Sidi Bou Said"
     },
     {
      "time": "12:15",
      "type": "景點",
      "zh": "Sidi Bou Said 藍白小鎮",
      "it": "Sidi Bou Saïd",
      "lat": 36.87167,
      "lng": 10.34722,
      "hours": "全天",
      "ticket": "免費",
      "desc": "白牆、藍門、九重葛的山城，主街是石板上坡，兩旁有手工藝店和甜點攤。可以買一份 bambalouni（突尼斯炸甜甜圈）。坡道雖陡但不長，可以放慢腳步散步上去。",
      "walk": "主街上坡約 5 分鐘到 Café des Nattes"
     },
     {
      "time": "12:30",
      "type": "午餐",
      "zh": "Café des Nattes（坐席喝薄荷茶）",
      "it": "Café des Nattes",
      "lat": 36.8709,
      "lng": 10.3473,
      "hours": "營業時間出發前請確認",
      "ticket": "薄荷松子茶約數 DT（出發前請確認）",
      "desc": "主街頂端階梯上的百年咖啡館，席地坐在草蓆上，喝加了松子的薄荷茶。保羅．克利等畫家都來過，氛圍很道地。",
      "walk": "往海邊下坡約 7 分鐘到 Café des Délices"
     },
     {
      "time": "13:15",
      "type": "午餐",
      "zh": "Café des Délices 海景平台",
      "it": "Café des Délices",
      "lat": 36.8695,
      "lng": 10.35,
      "hours": "營業時間出發前請確認",
      "ticket": "飲料約數 DT（出發前請確認）",
      "desc": "層層疊疊的白色露台可以俯瞰地中海和港灣，是全鎮最美的看海點。午餐可以在鎮上餐廳簡單吃，或在這裡配點心。",
      "walk": "回停車處搭車，約 20 分鐘回港"
     },
     {
      "time": "14:30",
      "type": "交通",
      "zh": "回 La Goulette 港",
      "it": "Retour au port de La Goulette",
      "lat": 36.8143,
      "lng": 10.309,
      "hours": "最晚 16:00 前回到碼頭",
      "ticket": "依議價",
      "desc": "提早回港。碼頭的商店可以用剩下的第納爾買紀念品。全船 17:30 前要回船，自行包車沒有等船保障，寧可早回。",
      "walk": "—"
     }
    ]
   },
   {
    "id": "B",
    "title": "自助：TGM 輕軌（腳力好的成員）",
    "fit": "年輕成員；需要比較多步行，也要能接受輕軌的擁擠與衛生狀況",
    "summary": "從碼頭走到 TGM La Goulette 站，往 La Marsa 方向搭到 Carthage Salammbô（布匿港口）→ 步行到 Byrsa → 安東尼浴場 → 在 Carthage Hannibal 站重新上車 → Sidi Bou Said，再搭 TGM 回 La Goulette。",
    "steps": [
     {
      "time": "09:40",
      "type": "步行",
      "zh": "前往 TGM La Goulette 站",
      "it": "Gare TGM La Goulette",
      "lat": 36.8179,
      "lng": 10.3047,
      "hours": "班次約 15–20 分鐘一班（出發前請確認）",
      "ticket": "單程約 1 DT 內（出發前請確認）",
      "desc": "車站在碼頭停車場另一頭的小房子（有黑色鐵柵欄），但不同資料說從碼頭步行並不好走。先在碼頭內換少量第納爾，買票只收現金。",
      "walk": "往 La Marsa 方向搭約 15 分鐘到 Carthage Salammbô"
     },
     {
      "time": "10:10",
      "type": "下車",
      "zh": "Carthage Salammbô 站 → 布匿港口",
      "it": "Gare TGM Carthage Salammbô",
      "lat": 36.846,
      "lng": 10.321,
      "hours": "—",
      "ticket": "—",
      "desc": "下車後步行到布匿港口和 Tophet，在第一個遺址買迦太基遺址票（多個遺址共用一張，請保留好）。",
      "walk": "步行約 5 分鐘到布匿港口"
     },
     {
      "time": "10:20",
      "type": "景點",
      "zh": "布匿港口與 Tophet",
      "it": "Ports puniques / Tophet de Salammbô",
      "lat": 36.8459,
      "lng": 10.323,
      "hours": "冬季約 8:30–17:00（出發前請確認）",
      "ticket": "遺址票約 20 DT（出發前請確認）",
      "desc": "看完港口後往北走上 Byrsa 山，約 20 分鐘，有上坡。",
      "walk": "步行約 20 分鐘（上坡）到 Byrsa"
     },
     {
      "time": "11:00",
      "type": "景點",
      "zh": "Byrsa 山與博物館",
      "it": "Colline de Byrsa",
      "lat": 36.85278,
      "lng": 10.32333,
      "hours": "冬季 8:30–17:00",
      "ticket": "遺址票",
      "desc": "全景視野最佳的一站，可以在博物館外的庭園休息。",
      "walk": "下山往海邊步行約 15 分鐘到安東尼浴場"
     },
     {
      "time": "11:50",
      "type": "景點",
      "zh": "安東尼浴場",
      "it": "Thermes d'Antonin",
      "lat": 36.85432,
      "lng": 10.3351,
      "hours": "冬季約 8:30–17:00（出發前請確認）",
      "ticket": "遺址票",
      "desc": "濱海的羅馬浴場遺址，禁止朝總統府方向拍照。",
      "walk": "步行約 10 分鐘到 Carthage Hannibal 站"
     },
     {
      "time": "12:40",
      "type": "上車",
      "zh": "Carthage Hannibal 站",
      "it": "Gare TGM Carthage Hannibal",
      "lat": 36.857,
      "lng": 10.329,
      "hours": "約 15–20 分鐘一班",
      "ticket": "約 1 DT",
      "desc": "往 La Marsa 方向搭 3 站到 Sidi Bou Said。",
      "walk": "約 8 分鐘"
     },
     {
      "time": "12:55",
      "type": "下車",
      "zh": "Sidi Bou Said 站",
      "it": "Gare TGM Sidi Bou Saïd",
      "lat": 36.8688,
      "lng": 10.3416,
      "hours": "—",
      "ticket": "—",
      "desc": "出站後沿上坡走進村子主街，約 10 分鐘到 Café des Nattes。",
      "walk": "上坡步行約 10 分鐘"
     },
     {
      "time": "13:10",
      "type": "景點",
      "zh": "Café des Nattes → Café des Délices",
      "it": "Café des Nattes / Café des Délices",
      "lat": 36.8709,
      "lng": 10.3473,
      "hours": "營業時間出發前請確認",
      "ticket": "約數 DT",
      "desc": "喝薄荷茶、逛藍白巷弄，再下坡到 Café des Délices 看海。",
      "walk": "回 Sidi Bou Said 站約 15 分鐘"
     },
     {
      "time": "15:00",
      "type": "交通",
      "zh": "TGM 回 La Goulette",
      "it": "TGM Sidi Bou Saïd → La Goulette",
      "lat": 36.8688,
      "lng": 10.3416,
      "hours": "最晚 15:30 前上車",
      "ticket": "約 1 DT",
      "desc": "往 Tunis Marine 方向搭到 La Goulette 站，車程約 25 分鐘，再走回碼頭。如果 TGM 誤點，可以在 Sidi Bou Said 叫黃色計程車（跳表，約 15 分鐘）。",
      "walk": "約 25 分鐘＋步行回碼頭"
     }
    ]
   }
  ],
  "tips": [
   "建議優先選 MSC 岸上行程：有導遊，遇到交通延誤也保證等人；自行前往若延誤，船不會等。",
   "第納爾不可帶出境，碼頭內可換匯；計程車一定要先談好總價和幣別，並寫在紙上。",
   "安東尼浴場旁是總統府，嚴禁對軍警和官方建築拍照。",
   "出發前請查詢外交部旅遊警示，並避開抗議或人群聚集的地方。",
   "Sidi Bou Said 的石板坡在雨後很滑，請穿止滑鞋。",
   "遺址冬季約 17:00 關門，票價 2026 年剛調漲，請帶足現金 DT。"
  ]
 }
};

/* ---------- v2.6：下船路線（龐貝、巴勒摩），每個點都能直接開地圖 ---------- */
function gmPin(lat, lng) { return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng; }
function gmGo(lat, lng) { return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng + '&travelmode=walking'; }
function gmRoute(pts) {
  const s = pts.map((p) => p.lat + ',' + p.lng);
  const u = 'https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=' + s[0] + '&destination=' + s[s.length - 1];
  return s.length > 2 ? u + '&waypoints=' + encodeURIComponent(s.slice(1, -1).join('|')) : u;
}
/* 把一條路線切成「走路段」：遇到上車（計程車、公車）就斷開，每段最多 10 個點（Google 地圖網址的上限） */
function walkSegments(steps) {
  const segs = []; let cur = [];
  steps.forEach((s) => {
    if (s.lat == null || s.lng == null) return;
    cur.push(s);
    if (s.type === '上車') { if (cur.length > 1) segs.push(cur); cur = []; }
  });
  if (cur.length > 1) segs.push(cur);
  const out = [];
  segs.forEach((g) => { for (let i = 0; i < g.length - 1; i += 9) out.push(g.slice(i, i + 10)); });
  return out.filter((g) => g.length > 1 && g.some((x) => ['景點', '午餐', '延伸'].includes(x.type)));
}
const STEP_ICON = { '景點': '📍', '午餐': '🍝', '上車': '🚕', '下車': '🚏', '下船': '🚢', '交通': '🚆', '延伸': '➕', '步行': '🚶' };
function pompeiiSpotKey(zh) {
  if (!zh) return 'foro';
  if (zh.includes('AR') || zh.includes('遮罩')) return 'ar_mask';
  if (zh.includes('阿波羅')) return 'apollo';
  if (zh.includes('第五區') || zh.includes('快餐') || zh.includes('公雞')) return 'fastfood';
  if (zh.includes('熱食店') || zh.includes('豐饒大道') || zh.includes('普拉西杜斯')) return 'thermopolium';
  if (zh.includes('拱門') || zh.includes('卡利古拉')) return 'arch';
  if (zh.includes('豪宅') || zh.includes('水仙女') || zh.includes('噴泉水景')) return 'villa';
  if (zh.includes('競技場') || zh.includes('角鬥') || zh.includes('火山') || zh.includes('體育場') || zh.includes('鳥瞰')) return 'aerial';
  if (zh.includes('小巷') || zh.includes('妓院') || zh.includes('街道') || zh.includes('踩腳石') || zh.includes('噴泉')) return 'street';
  if (zh.includes('廣場') || zh.includes('神廟') || zh.includes('海門')) return 'foro';
  return 'foro';
}
function routeStepHtml(s, i) {
  const num = s.n || i + 1;
  const info = [s.hours ? '🕘 ' + esc(s.hours) : '', s.ticket ? '🎟️ ' + esc(s.ticket) : '', s.min ? '⏱️ 建議停留 ' + esc(s.min) + ' 分鐘' : ''].filter(Boolean).join('<br>');
  return `<div class="rstep">
    <div class="rstep-head"><span class="rstep-n">${s.time ? esc(s.time) : num}</span>
      <div class="rstep-t"><b>${STEP_ICON[s.type] || '📍'} ${esc(s.zh)}</b>${s.it ? `<span>${esc(s.it)}</span>` : ''}</div></div>
    ${s.pastGlory ? `
    <div class="ancient-modern-box">
      <div class="ancient-modern-sec">
        <b style="color:var(--warn)">🏛️ 昔日風華（西元79年繁盛日常）</b>
        <p>${esc(s.pastGlory)}</p>
      </div>
      <div class="ancient-modern-sec">
        <b style="color:var(--primary)">🔍 今日現場（兩千年後考古見證）</b>
        <p>${esc(s.presentRuins)}</p>
      </div>
      <div style="margin-top:6px"><a class="btn small ghost" href="#/pompeii-compare?spot=${pompeiiSpotKey(s.zh)}">🖼️ 互動拉軸看此站今昔對比</a></div>
    </div>` : ''}
    ${s.desc ? `<p>${esc(s.desc)}</p>` : ''}
    ${info ? `<div class="rstep-info">${info}</div>` : ''}
    ${s.walk ? `<div class="rstep-walk">🚶 ${esc(s.walk)}</div>` : ''}
    ${s.lat != null ? `<div class="rstep-btns"><a class="btn small ghost" href="${gmPin(s.lat, s.lng)}" target="_blank" rel="noopener">🗺️ 在地圖看位置</a><a class="btn small ghost" href="${gmGo(s.lat, s.lng)}" target="_blank" rel="noopener">🧭 從這裡導航過去</a></div>` : ''}
  </div>`;
}
function routePlansHtml(r, compact) {
  return r.plans.map((p) => {
    const segs = p.noRoute ? [] : walkSegments(p.steps);
    const segBtns = segs.map((g, k) => `<a class="btn small" href="${gmRoute(g)}" target="_blank" rel="noopener">🗺️ 走路路線${segs.length > 1 ? ' 第 ' + (k + 1) + ' 段' : ''}：${esc(g[0].zh.split('（')[0])} → ${esc(g[g.length - 1].zh.split('（')[0])}</a>`).join('');
    return `<details class="rplan" ${!compact && (r.plans.length === 1 || p.id === 'main' || p.id === 'A') ? 'open' : ''}>
      <summary><b>${esc(p.title)}</b>${p.fit ? `<span>適合：${esc(p.fit)}</span>` : ''}</summary>
      ${p.summary ? `<p class="sub">${esc(p.summary)}</p>` : ''}
      ${segBtns ? `<div class="rroute">${segBtns}<p class="sub" style="margin:4px 0 0;font-size:12.5px">在 Google 地圖打開整段步行路線（坐車的部分已分開）。</p></div>` : ''}
      ${p.steps.map(routeStepHtml).join('')}
    </details>`;
  }).join('');
}
route('/portroute/:id', (id) => {
  const r = PORT_ROUTES[id];
  if (!r) { location.hash = '#/cruise'; return 'home'; }
  const plans = routePlansHtml(r);
  const pk = (PORTS.find((x) => x.routes.includes(id)) || {}).key;
  const compareBanner = id === 'pompeii' ? `
    <div class="card pcompare-banner">
      <div class="pcompare-icon">🏛️</div>
      <div class="pcompare-text">
        <b>龐貝古城：今昔對比互動拉軸</b>
        <span>左右滑動中央拉軸，重現西元79年繁盛風華與兩千年後現場遺跡（海門、神廟、熱食店、競技場）</span>
      </div>
      <a class="btn small" href="#/pompeii-compare">打開拉軸</a>
    </div>` : '';
  view(`${back(pk ? '#/port/' + pk : '#/cruise', pk ? '回港口頁' : '郵輪靠港')}<div class="kicker">${esc(dayName(r.date))} · ${esc(r.port)}</div><h1>${esc(r.title)}</h1>
    <p class="sub">${esc(r.summary)}</p>
    ${compareBanner}
    ${plans}
    <div class="card"><h3>小提醒</h3><ul class="rtips">${r.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <details class="card"><summary><b>查證說明（時間、票價）</b></summary><p class="sub" style="margin-top:8px">${esc(r.verify)}</p></details>`);
  return 'home';
});

/* ---------- v2.9：龐貝古城今昔對比互動拉軸 ---------- */
route('/pompeii-compare', () => { paintPompeiiCompare(); return 'home'; });
route('/pompeii-compare/:spot', (spot) => { paintPompeiiCompare(spot); return 'home'; });

function paintPompeiiCompare(initialLoc, initialAngle) {
  const hashPart = location.hash.includes('?') ? location.hash.split('?')[1] : '';
  const urlParams = new URLSearchParams(hashPart);
  let locId = initialLoc || urlParams.get('loc') || urlParams.get('spot') || 'foro';
  let angleId = initialAngle || urlParams.get('angle') || null;

  const locs = (window.POMPEII_ART && window.POMPEII_ART.locations) || [];
  let curLoc = locs.find((l) => l.id === locId) || locs[0];
  if (!curLoc) {
    curLoc = { id: 'foro', name: '🏛️ 公共廣場與神廟', angles: [] };
  }
  locId = curLoc.id;
  const angles = curLoc.angles || [];
  let curAngle = (angleId && angles.find((a) => a.id === angleId)) || angles[0];
  if (!curAngle) curAngle = { title: '經典視角', descPast: '', descPresent: '' };
  angleId = curAngle.id;

  view(`${back('#/portroute/pompeii', '回龐貝路線')}<div class="kicker">龐貝古城 · 拿坡里 · 西元79年 vs 今日</div>
    <h1>🏛️ 龐貝今昔對比互動拉軸</h1>
    <p class="sub">左右拖曳中央白線或圓鈕，重現兩千年前古羅馬繁盛風華與今日現場遺跡。AR 模式支援開啟手機鏡頭即時疊加遮罩與調節透明度拍照。</p>
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
      <a id="pc-fullscreen-link" class="btn small" href="pompeii-compare.html" target="_blank" rel="noopener">📸 打開獨立全螢幕版（支援現場 AR 遮罩拍照與微調）</a>
    </div>
    <div class="pcompare-chips" id="pc-loc-chips">
      ${locs.map((l) => {
        const cnt = (l.angles && l.angles.length) || 1;
        const tag = cnt > 1 ? ` (${cnt}視角)` : '';
        return `<button type="button" class="pcompare-chip${l.id === locId ? ' on' : ''}" data-ploc="${l.id}">${l.name}${tag}</button>`;
      }).join('')}
    </div>
    <div class="pcompare-angles" id="pc-angle-chips" style="${angles.length > 1 ? 'display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:8px' : 'display:none'}">
      ${angles.map((a) => `<button type="button" class="btn small${a.id === angleId ? '' : ' ghost'}" data-pangle="${a.id}">${a.title}</button>`).join('')}
    </div>
    <div class="pcompare-stage" id="pc-stage" style="position:relative;overflow:hidden;background:#000;">
      <video id="pc-video" playsinline autoplay muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;z-index:1;"></video>
      <div class="pcompare-layer" id="pc-after-layer"><img id="pc-img-after" alt="今日現場" /></div>
      <div class="pcompare-layer" id="pc-before-layer" style="clip-path: inset(0 50% 0 0);"><img id="pc-img-before" alt="昔日風華" /></div>
      <div class="pcompare-badge before" id="pc-badge-before">昔日風華 (西元79年)</div>
      <div class="pcompare-badge after" id="pc-badge-after">今日現場 (考古遺址)</div>
      <div class="pcompare-divider" id="pc-divider" style="left:50%">
        <div class="pcompare-handle" id="pc-handle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 9l-3 3 3 3m8-6l3 3-3 3"/></svg>
        </div>
      </div>
      <div class="pcompare-pct" id="pc-pct-bar">昔日 <span id="pc-pct-before">50%</span> ｜ 今日 <span id="pc-pct-after">50%</span></div>
    </div>
    <!-- AR 實景相機遮罩控制列 -->
    <div id="pc-ar-panel" style="display:none;margin-top:12px;padding:14px;background:var(--card-bg,#232220);border-radius:14px;border:1px solid var(--border,#444);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
        <b style="font-size:13px;color:var(--text,#fff);display:flex;align-items:center;gap:6px;">
          <span style="font-size:16px;">🎭</span> 虛實遮罩透明度: <span id="pc-opacity-val" style="color:#f59e0b;font-weight:700;">50%</span>
        </b>
        <div style="display:flex;gap:6px;">
          <button type="button" id="pc-btn-cam" class="btn small" style="background:#c85a32;color:#fff;border:none;">📷 啟動現場相機</button>
          <label for="pc-ar-upload" class="btn small ghost" style="margin:0;cursor:pointer;">
            📁 上傳實景
            <input type="file" id="pc-ar-upload" accept="image/*" style="display:none;">
          </label>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:11px;color:#888;">實景 100%</span>
        <input type="range" id="pc-opacity-slider" min="0" max="100" value="50" style="flex:1;cursor:pointer;">
        <span style="font-size:11px;color:#888;">復原 100%</span>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button type="button" class="btn small ghost pc-preset-op" data-op="25" style="flex:1;font-size:11px;">輕透 25%</button>
        <button type="button" class="btn small ghost pc-preset-op" data-op="50" style="flex:1;font-size:11px;">半透 50%</button>
        <button type="button" class="btn small ghost pc-preset-op" data-op="75" style="flex:1;font-size:11px;">清晰 75%</button>
        <button type="button" id="pc-btn-snap" class="btn small primary" style="flex:2;font-size:12px;">📸 拍照合成下載</button>
      </div>
      <div id="pc-cam-status" style="font-size:11px;color:#f59e0b;margin-top:6px;display:none;"></div>
    </div>
    <div class="card" style="margin-top:14px" id="pc-info">
      <h3 id="pc-title">${esc(curAngle.title || curLoc.name)}</h3>
      <p class="sub" id="pc-sub">${esc(curLoc.name)}</p>
      <div class="ancient-modern-box" style="margin:8px 0 0">
        <div class="ancient-modern-sec">
          <b style="color:var(--warn)">🏛️ 昔日風華（西元79年繁盛日常）</b>
          <p id="pc-desc-past">${esc(curAngle.descPast || '')}</p>
        </div>
        <div class="ancient-modern-sec">
          <b style="color:var(--primary)" id="pc-modern-title">🔍 今日現場（兩千年後考古見證）</b>
          <p id="pc-desc-present">${esc(curAngle.descPresent || '')}</p>
        </div>
      </div>
    </div>`);

  const stage = $('#pc-stage');
  const beforeLayer = $('#pc-before-layer');
  const divider = $('#pc-divider');
  const imgBefore = $('#pc-img-before');
  const imgAfter = $('#pc-img-after');
  const pctBefore = $('#pc-pct-before');
  const pctAfter = $('#pc-pct-after');
  const pctBar = $('#pc-pct-bar');
  const angleContainer = $('#pc-angle-chips');
  const badgeBefore = $('#pc-badge-before');
  const badgeAfter = $('#pc-badge-after');

  const pcVideo = $('#pc-video');
  const pcArPanel = $('#pc-ar-panel');
  const pcOpacitySlider = $('#pc-opacity-slider');
  const pcOpacityVal = $('#pc-opacity-val');
  const pcBtnCam = $('#pc-btn-cam');
  const pcBtnSnap = $('#pc-btn-snap');
  const pcArUpload = $('#pc-ar-upload');
  const pcCamStatus = $('#pc-cam-status');

  let sliderPercent = 50;
  let isDragging = false;
  let localCamStream = null;
  let pcArOpacity = 50;

  function updateSlider(pct) {
    sliderPercent = Math.max(0, Math.min(100, pct));
    divider.style.left = sliderPercent + '%';
    beforeLayer.style.clipPath = 'inset(0 ' + (100 - sliderPercent) + '% 0 0)';
    const bVal = Math.round(sliderPercent);
    pctBefore.textContent = bVal + '%';
    pctAfter.textContent = (100 - bVal) + '%';
  }

  function handleMove(clientX) {
    if (curAngle && curAngle.isAR) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    updateSlider(pct);
  }

  function renderAngle(ang) {
    if (!ang) return;
    curAngle = ang;
    angleId = ang.id;
    $('#pc-title').textContent = ang.title;
    $('#pc-desc-past').textContent = ang.descPast || '';
    $('#pc-desc-present').textContent = ang.descPresent || '';
    $$('[data-pangle]').forEach((b) => {
      b.classList.toggle('ghost', b.dataset.pangle !== ang.id);
    });

    const fsLink = $('#pc-fullscreen-link');
    if (fsLink) {
      fsLink.href = `pompeii-compare.html?loc=${curLoc.id}&angle=${ang.id}${ang.isAR ? '&ar=1' : ''}`;
      fsLink.textContent = ang.isAR ? '📸 開啟全螢幕 AR 遮罩相機' : '🖥️ 打開獨立全螢幕版（支援現場 AR 拍照與微調）';
    }

    if (ang.isAR || !ang.present) {
      divider.style.display = 'none';
      if (pctBar) pctBar.style.display = 'none';
      beforeLayer.style.clipPath = 'none';
      beforeLayer.style.opacity = (pcArOpacity / 100).toString();
      beforeLayer.style.zIndex = '3';
      beforeLayer.style.pointerEvents = 'none';
      if (badgeBefore) badgeBefore.textContent = '昔日 AR 遮罩 (西元79年)';
      if (badgeAfter) badgeAfter.textContent = '現場實景鏡頭';
      if (pcArPanel) pcArPanel.style.display = 'block';
      const modTitle = $('#pc-modern-title');
      if (modTitle) modTitle.textContent = '📸 現場 AR 遮罩對位說明';

      if (localCamStream) {
        if (pcVideo) pcVideo.style.display = 'block';
        imgAfter.style.display = 'none';
      }
    } else {
      if (localCamStream) {
        localCamStream.getTracks().forEach((t) => t.stop());
        localCamStream = null;
        if (pcVideo) pcVideo.style.display = 'none';
        if (pcBtnCam) pcBtnCam.textContent = '📷 啟動現場相機';
        if (pcCamStatus) pcCamStatus.style.display = 'none';
      }
      divider.style.display = 'block';
      if (pctBar) pctBar.style.display = 'block';
      imgAfter.style.display = 'block';
      beforeLayer.style.zIndex = '';
      beforeLayer.style.pointerEvents = '';
      beforeLayer.style.opacity = '1';
      if (badgeBefore) badgeBefore.textContent = '昔日風華 (西元79年)';
      if (badgeAfter) badgeAfter.textContent = '今日現場 (考古遺址)';
      if (pcArPanel) pcArPanel.style.display = 'none';
      const modTitle = $('#pc-modern-title');
      if (modTitle) modTitle.textContent = '🔍 今日現場（兩千年後考古見證）';
      updateSlider(sliderPercent);
    }

    if (window.POMPEII_ART && window.POMPEII_ART.loadAngle) {
      window.POMPEII_ART.loadAngle(ang, imgBefore, imgAfter);
    }
  }

  function renderLocation(lId, targetAngleId) {
    const l = locs.find((x) => x.id === lId) || locs[0];
    if (!l) return;
    curLoc = l;
    locId = l.id;
    $$('[data-ploc]').forEach((b) => b.classList.toggle('on', b.dataset.ploc === l.id));

    const angs = l.angles || [];
    if (angs.length > 1) {
      angleContainer.style.display = 'flex';
      angleContainer.innerHTML = angs.map((a) => `<button type="button" class="btn small${a.id === (targetAngleId || angs[0].id) ? '' : ' ghost'}" data-pangle="${a.id}">${a.title}</button>`).join('');
      $$('[data-pangle]').forEach((b) => {
        b.onclick = () => {
          const picked = angs.find((x) => x.id === b.dataset.pangle);
          if (picked) renderAngle(picked);
        };
      });
    } else {
      angleContainer.style.display = 'none';
      angleContainer.innerHTML = '';
    }

    const ang = (targetAngleId && angs.find((x) => x.id === targetAngleId)) || angs[0];
    renderAngle(ang);
  }

  // AR 相機與透明度事件監聽
  if (pcOpacitySlider) {
    pcOpacitySlider.oninput = (e) => {
      pcArOpacity = parseInt(e.target.value, 10);
      if (pcOpacityVal) pcOpacityVal.textContent = pcArOpacity + '%';
      if (curAngle && curAngle.isAR) {
        beforeLayer.style.opacity = (pcArOpacity / 100).toString();
      }
    };
  }
  $$('.pc-preset-op').forEach((btn) => {
    btn.onclick = () => {
      pcArOpacity = parseInt(btn.dataset.op, 10);
      if (pcOpacitySlider) pcOpacitySlider.value = pcArOpacity;
      if (pcOpacityVal) pcOpacityVal.textContent = pcArOpacity + '%';
      if (curAngle && curAngle.isAR) {
        beforeLayer.style.opacity = (pcArOpacity / 100).toString();
      }
    };
  });
  if (pcBtnCam) {
    pcBtnCam.onclick = async () => {
      if (localCamStream) {
        localCamStream.getTracks().forEach((t) => t.stop());
        localCamStream = null;
        if (pcVideo) pcVideo.style.display = 'none';
        pcBtnCam.textContent = '📷 啟動現場相機';
        if (pcCamStatus) pcCamStatus.style.display = 'none';
        toast('相機已關閉');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        localCamStream = stream;
        if (pcVideo) {
          pcVideo.srcObject = stream;
          pcVideo.style.display = 'block';
        }
        imgAfter.style.display = 'none';
        pcBtnCam.textContent = '🛑 關閉相機';
        if (pcCamStatus) {
          pcCamStatus.style.display = 'block';
          pcCamStatus.textContent = '🟢 現場鏡頭運行中，請對準古蹟並調整透明度滑桿';
        }
        toast('相機已啟動，請對準古蹟！');
      } catch (err) {
        console.warn('Camera failed:', err);
        if (pcCamStatus) {
          pcCamStatus.style.display = 'block';
          pcCamStatus.textContent = '⚠️ 無法開啟相機（請確認瀏覽器相機權限，或點擊「上傳實景」）';
        }
        toast('無法存取相機，請嘗試上傳實景照片');
      }
    };
  }
  if (pcArUpload) {
    pcArUpload.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (localCamStream) {
        localCamStream.getTracks().forEach((t) => t.stop());
        localCamStream = null;
        if (pcVideo) pcVideo.style.display = 'none';
        if (pcBtnCam) pcBtnCam.textContent = '📷 啟動現場相機';
      }
      const url = URL.createObjectURL(file);
      imgAfter.onload = () => {
        imgAfter.style.display = 'block';
        toast('已載入現場照片：' + file.name);
      };
      imgAfter.src = url;
    };
  }
  if (pcBtnSnap) {
    pcBtnSnap.onclick = () => {
      const cvs = document.createElement('canvas');
      let bgW = 1280, bgH = 960;
      let bgElem = null;
      if (pcVideo && pcVideo.style.display !== 'none' && pcVideo.videoWidth > 0) {
        bgElem = pcVideo;
        bgW = pcVideo.videoWidth;
        bgH = pcVideo.videoHeight;
      } else if (imgAfter && imgAfter.complete && imgAfter.naturalWidth > 0) {
        bgElem = imgAfter;
        bgW = imgAfter.naturalWidth;
        bgH = imgAfter.naturalHeight;
      }
      cvs.width = bgW;
      cvs.height = bgH;
      const ctx = cvs.getContext('2d');
      if (bgElem) {
        ctx.drawImage(bgElem, 0, 0, bgW, bgH);
      } else {
        ctx.fillStyle = '#1c1b18';
        ctx.fillRect(0, 0, bgW, bgH);
      }
      if (imgBefore && imgBefore.complete && imgBefore.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = pcArOpacity / 100;
        ctx.drawImage(imgBefore, 0, 0, bgW, bgH);
        ctx.restore();
      }
      const banH = Math.max(48, Math.round(bgH * 0.065));
      ctx.fillStyle = 'rgba(20, 19, 18, 0.78)';
      ctx.fillRect(0, bgH - banH, bgW, banH);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.max(14, Math.round(banH * 0.38)) + 'px sans-serif';
      ctx.fillText('🏛️ 龐貝古城 AR 虛實合影 · ' + (curAngle ? curAngle.title : ''), 18, bgH - banH * 0.38);

      const dataUrl = cvs.toDataURL('image/jpeg', 0.92);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'pompeii_ar_' + (curAngle ? curAngle.id : 'snap') + '_' + Date.now() + '.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast('📸 AR 合影照片已下載！');
    };
  }

  // 離開頁面時自動關閉相機
  window.addEventListener('hashchange', () => {
    if (localCamStream) {
      localCamStream.getTracks().forEach((t) => t.stop());
      localCamStream = null;
    }
  }, { once: true });

  stage.addEventListener('mousedown', (e) => { isDragging = true; handleMove(e.clientX); });
  window.addEventListener('mousemove', (e) => { if (isDragging) { e.preventDefault(); handleMove(e.clientX); } });
  window.addEventListener('mouseup', () => { isDragging = false; });

  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) { isDragging = true; handleMove(e.touches[0].clientX); }
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length > 0) handleMove(e.touches[0].clientX);
  }, { passive: true });
  window.addEventListener('touchend', () => { isDragging = false; });

  $$('[data-ploc]').forEach((btn) => {
    btn.onclick = () => {
      renderLocation(btn.dataset.ploc);
    };
  });

  renderLocation(locId, angleId);
  updateSlider(50);
}

/* ---------- v2.6：記帳與分帳（誰先付、平分給誰，最後只算兩家） ---------- */
const MONEY_PEOPLE = ['LEO', 'LINDA', 'SIMON', 'SANDY', 'DISEN', 'EVA', 'ERIC'];
const MONEY_LEO = ['LEO', 'LINDA', 'SIMON', 'SANDY'];
const MONEY_HOUSE = { LEO: 'LEO家', LINDA: 'LEO家', SIMON: 'LEO家', SANDY: 'LEO家', DISEN: 'DISEN家', EVA: 'DISEN家', ERIC: 'DISEN家' };
const MONEY_CRUISE_END = '2026-12-19';   // 郵輪結束、DISEN一家回臺灣；之後的帳只有 LEO 家四人
const MONEY_CUR = { EUR: '€', TWD: 'NT$', TND: 'TND ' };
function moneyPeopleFor(date) { return date > MONEY_CRUISE_END ? MONEY_LEO : MONEY_PEOPLE; }
function moneyFmt(cur, n) { const v = Math.round(n * 100) / 100; return (MONEY_CUR[cur] || cur + ' ') + v.toLocaleString('en-US', { minimumFractionDigits: cur === 'TWD' ? 0 : 2, maximumFractionDigits: cur === 'TWD' ? 0 : 2 }); }
function moneyList() {
  const m = Object.assign({}, LS.get('money:server', {}));
  const pend = LS.get('money:pending', []);
  pend.forEach((op) => { if (op.op === 'add') m[op.e.id] = op.e; else delete m[op.id]; });
  return Object.values(m).sort((a, b) => (b.date + b.ts).localeCompare(a.date + a.ts));
}
function moneyQueue(op) {
  const pend = LS.get('money:pending', []);
  pend.push(op); LS.set('money:pending', pend);
  moneyFlush();
}
let moneyBusy = false;
async function moneyFlush() {
  if (moneyBusy || !S.server.url || !navigator.onLine) return;
  moneyBusy = true;
  try {
    let pend = LS.get('money:pending', []);
    while (pend.length) {
      await api('expense', pend[0]);
      pend = LS.get('money:pending', []).slice(1); LS.set('money:pending', pend);
    }
    const d = await apiGet({ action: 'expenses' });
    const m = {}; (d.items || []).forEach((e) => { m[e.id] = e; });
    LS.set('money:server', m);
    if (location.hash.startsWith('#/money')) paintMoney();
  } catch (e) { /* 沒網路就先存在手機，下次再傳 */ }
  finally { moneyBusy = false; }
}
function moneySettle(list) {
  const by = {};   // cur -> { person: net }
  list.forEach((e) => {
    const amt = Number(e.amount) || 0; const split = e.split || [];
    if (!amt || !split.length) return;
    const t = by[e.cur] || (by[e.cur] = {});
    t[e.payer] = (t[e.payer] || 0) + amt;
    split.forEach((p) => { t[p] = (t[p] || 0) - amt / split.length; });
  });
  return by;
}
function moneySummaryHtml(list) {
  const by = moneySettle(list);
  const curs = Object.keys(by);
  if (!curs.length) return '<p class="sub">還沒有任何一筆帳。</p>';
  return curs.map((cur) => {
    const t = by[cur];
    const house = { 'LEO家': 0, 'DISEN家': 0 };
    Object.keys(t).forEach((p) => { house[MONEY_HOUSE[p]] += t[p]; });
    const d = house['DISEN家'];
    const line = Math.abs(d) < 0.005 ? '兩家剛好打平，不用互相給錢。'
      : d < 0 ? `<b>DISEN家</b> 要給 <b>LEO家</b> <b class="money-big">${moneyFmt(cur, -d)}</b>`
        : `<b>LEO家</b> 要給 <b>DISEN家</b> <b class="money-big">${moneyFmt(cur, d)}</b>`;
    const paid = {}; const spent = {};
    list.filter((e) => e.cur === cur).forEach((e) => {
      const h = MONEY_HOUSE[e.payer]; paid[h] = (paid[h] || 0) + Number(e.amount);
      (e.split || []).forEach((p) => { const hh = MONEY_HOUSE[p]; spent[hh] = (spent[hh] || 0) + Number(e.amount) / e.split.length; });
    });
    const row = (h) => `<tr><td>${h}</td><td>${moneyFmt(cur, paid[h] || 0)}</td><td>${moneyFmt(cur, spent[h] || 0)}</td></tr>`;
    return `<div class="money-sum"><div class="money-line">${line}</div>
      <table class="money-tbl"><tr><th>${cur}</th><th>先付了</th><th>應該分攤</th></tr>${row('LEO家')}${row('DISEN家')}</table></div>`;
  }).join('');
}
function paintMoney() {
  const list = moneyList();
  const date = ($('#m-date') && $('#m-date').value) || today();
  const ppl = moneyPeopleFor(date);
  const last = LS.get('money:last', { payer: '', cur: 'EUR' });
  const payer = ppl.includes(last.payer) ? last.payer : ppl[0];
  const pend = LS.get('money:pending', []).length;
  const rows = list.map((e) => `<div class="money-row">
      <div class="money-main"><b>${esc(e.item || '（沒寫項目）')}</b>
        <span>${esc(e.date)}・<b>${esc(e.payer)}</b> 先付・分給 ${esc((e.split || []).join('、'))}${e.split && e.split.length ? '（每人 ' + moneyFmt(e.cur, e.amount / e.split.length) + '）' : ''}</span></div>
      <div class="money-amt">${moneyFmt(e.cur, Number(e.amount))}</div>
      <button type="button" class="money-del" data-mdel="${esc(e.id)}" aria-label="刪除這筆">✕</button>
    </div>`).join('');
  view(`${back('#/', '首頁')}<h1>💰 記帳與分帳</h1>
    <p class="sub">誰先付錢就記一筆，選要平分給哪幾個人。最後只算兩家：LEO家（LEO、LINDA、SIMON、SANDY）和 DISEN家（DISEN、EVA、ERIC）。12/19 郵輪結束後，日期在 12/20 以後的帳只能選 LEO家四個人。</p>
    <div class="card money-form">
      <label class="field"><span>日期</span><input class="text" type="date" id="m-date" value="${esc(date)}" min="2026-11-01" max="2027-01-31"></label>
      <label class="field"><span>買了什麼</span><input class="text" id="m-item" placeholder="例如：聖家堂門票、晚餐、計程車" maxlength="40"></label>
      <div class="money-amtrow">
        <label class="field" style="flex:1"><span>金額</span><input class="text" id="m-amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00"></label>
        <label class="field"><span>幣別</span><select class="text" id="m-cur">${Object.keys(MONEY_CUR).map((c) => `<option value="${c}"${c === last.cur ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
      </div>
      <div class="field"><span>誰先付的</span><div class="money-chips" id="m-payer">${ppl.map((p) => `<button type="button" class="mchip${p === payer ? ' on' : ''}" data-payer="${p}">${p}</button>`).join('')}</div></div>
      <div class="field"><span>平分給誰（可以複選）</span><div class="money-chips" id="m-split">${ppl.map((p) => `<button type="button" class="mchip on" data-split="${p}">${p}</button>`).join('')}</div>
        <div class="money-quick"><button type="button" class="btn small ghost" data-mq="all">全部</button><button type="button" class="btn small ghost" data-mq="LEO家">只有 LEO家</button>${ppl.length > 4 ? '<button type="button" class="btn small ghost" data-mq="DISEN家">只有 DISEN家</button>' : ''}<button type="button" class="btn small ghost" data-mq="none">清除</button></div></div>
      <button type="button" class="btn block" id="m-add">記下這一筆</button>
    </div>
    <h2>結算：兩家誰該給誰</h2>
    ${moneySummaryHtml(list)}
    <p class="sub" style="font-size:12.5px">不同幣別分開算，不會自動換匯。${pend ? `還有 ${pend} 筆在手機裡，連上網路會自動上傳。` : ''}${S.server.url ? '' : '還沒連上家庭雲端，帳只存在這支手機。'}</p>
    <h2>每一筆帳（${list.length}）</h2>
    <div class="money-list">${rows || '<p class="sub">還沒有帳。</p>'}</div>`);
  $('#m-date').onchange = () => paintMoney();
  $$('[data-payer]').forEach((b) => b.onclick = () => { $$('[data-payer]').forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
  $$('[data-split]').forEach((b) => b.onclick = () => b.classList.toggle('on'));
  $$('[data-mq]').forEach((b) => b.onclick = () => {
    const q = b.dataset.mq;
    $$('[data-split]').forEach((x) => x.classList.toggle('on', q === 'all' || MONEY_HOUSE[x.dataset.split] === q));
  });
  $('#m-add').onclick = () => {
    const amt = Number($('#m-amt').value);
    const pb = $('[data-payer].on');
    const split = $$('[data-split].on').map((x) => x.dataset.split);
    if (!(amt > 0)) { toast('請填金額'); return; }
    if (!pb) { toast('請選誰先付的'); return; }
    if (!split.length) { toast('請至少選一個要分攤的人'); return; }
    const e = { id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: $('#m-date').value || today(), item: $('#m-item').value.trim(), amount: Math.round(amt * 100) / 100, cur: $('#m-cur').value, payer: pb.dataset.payer, split, by: S.player, ts: String(Date.now()) };
    LS.set('money:last', { payer: e.payer, cur: e.cur });
    moneyQueue({ op: 'add', e });
    toast('記好了：' + e.payer + ' 付 ' + moneyFmt(e.cur, e.amount));
    paintMoney();
  };
  $$('[data-mdel]').forEach((b) => b.onclick = () => {
    if (!confirm('確定要刪除這一筆帳嗎？大家的手機都會一起刪掉。')) return;
    moneyQueue({ op: 'del', id: b.dataset.mdel });
    paintMoney();
  });
}
route('/money', () => { paintMoney(); moneyFlush(); return 'home'; });
window.addEventListener('online', () => moneyFlush());

/* ---------- v2.7：郵輪篇改版（每個港口一張海報 → 書架 → 路線 → 安全提醒 → 城市卡與景點卡） ---------- */
const PORTS = [
  { key: 'marseille', date: '2026-12-13', name: '馬賽', en: 'MARSEILLE', shelf: '馬賽', routes: ['marseille'] },
  { key: 'genoa', date: '2026-12-14', name: '熱那亞', en: 'GENOVA', shelf: '熱那亞', routes: ['genoa'] },
  { key: 'naples', date: '2026-12-15', name: '拿坡里與龐貝', en: 'NAPOLI · POMPEII', shelf: '那不勒斯與龐貝', routes: ['pompeii', 'naples'] },
  { key: 'palermo', date: '2026-12-16', name: '巴勒摩', en: 'PALERMO', shelf: '巴勒摩', routes: ['palermo'] },
  { key: 'tunis', date: '2026-12-17', name: '突尼西亞', en: 'TUNIS · CARTHAGE', shelf: '突尼西亞', routes: ['tunis'] },
];
function portMD(date) { return Number(date.slice(5, 7)) + '/' + Number(date.slice(8, 10)); }
function portCards(list, p) { return list.filter((c) => (c.port || '').startsWith(portMD(p.date) + ' ')); }
function cruiseItem(c, kind) {
  if (kind === 'city') {
    const ok = isUnlocked(c);
    return ok
      ? `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b><span>城市卡</span></div>${doneMark(c)}${CHEV}</a>`
      : `<div class="item locked"><div class="t"><b>${esc(c.title.split('：')[0])}</b><span>${esc(fmtDate(cardDate(c)))} 解鎖</span></div><span class="chip">未解鎖</span></div>`;
  }
  return `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b><span>${esc(c.game ? '小遊戲：' + c.game.name : '景點卡')}</span></div>${doneMark(c)}${CHEV}</a>`;
}
function renderCruiseHome() {
  const city = CITY.cruise;
  const tiles = PORTS.map((p) => {
    const cp = CRUISE_PORTS.find((x) => x.date === p.date);
    return `<a class="port-tile" href="#/port/${p.key}">${posterImg(PORT_POSTER[p.date])}
      <div class="port-tile-cap"><b>${esc(dayName(p.date))} ${esc(p.name)}</b><span>${cp ? '靠港 ' + esc(cp.hours) + '・' : ''}書架、路線、城市卡與景點卡 →</span></div></a>`;
  }).join('');
  view(`${back('#/', '首頁')}${posterImg(CITY_POSTER.cruise || 'ship')}<h1>${esc(city.name)}</h1>
    <p class="sub">12/12 巴塞隆納上船，12/19 回到巴塞隆納。每個港口都會有一張城市卡、兩張景點卡可以玩。</p>
    <a class="card cdex-promo" href="#/cruisedex"><b>🚢 船上有哪些設施可以玩呢？到圖鑑看看吧！</b><span>免費設施、付費體驗、DISEN家 Aurea 房型的禮遇（含 Il Campo 專屬餐廳）、下船打卡</span></a>
    <p class="sub">靠港那天手機很可能沒有網路，題目和拍照照樣能玩，照片回船上再傳。</p>
    <h2>五個港口</h2><div class="port-tiles">${tiles}</div>
    <a class="btn ghost block" href="#/cruise">郵輪靠港：大家想去哪裡（投票）</a>`);
  return 'home';
}
function portRoutesHtml(keys) {
  return keys.map((k) => PORT_ROUTES[k]).filter(Boolean).map((r) => `<div class="card port-route">
    <h3>🗺️ ${esc(r.title)}</h3><p class="sub" style="margin:0 0 8px">${esc(r.summary)}</p>
    ${routePlansHtml(r, true)}
    <a class="btn small ghost" href="#/portroute/${Object.keys(PORT_ROUTES).find((x) => PORT_ROUTES[x] === r)}">打開完整頁面（含小提醒與查證說明）</a></div>`).join('');
}
route('/port/:key', (key) => {
  const p = PORTS.find((x) => x.key === key);
  if (!p) { location.hash = '#/city/cruise'; return 'home'; }
  const city = CITY.cruise;
  const cp = CRUISE_PORTS.find((x) => x.date === p.date);
  const cityCards = portCards(city.cityCards, p).map((c) => cruiseItem(c, 'city')).join('');
  const spots = portCards(city.spots, p).map((c) => cruiseItem(c, 'spot')).join('');
  view(`${back('#/city/cruise', '地中海郵輪')}${posterImg(PORT_POSTER[p.date])}
    <div class="kicker">${esc(dayName(p.date))} · ${esc(p.en)}</div><h1>${esc(p.name)}</h1>
    ${cp ? `<p class="sub">靠港 ${esc(cp.hours)}。${esc(cp.tip)}</p>` : ''}
    ${shelfHtml('cruise', p.shelf)}
    <h2>遊覽建議路線</h2>
    <p class="sub">搭車和下車的位置、每個景點都能直接在 Google 地圖打開。</p>
    ${portRoutesHtml(p.routes)}
    ${safetyBannerHtml()}
    ${cityCards ? `<h2>城市卡</h2><div class="list">${cityCards}</div>` : ''}
    ${spots ? `<h2>景點卡</h2><div class="list">${spots}</div>` : ''}`);
  return 'home';
});

/* 龐貝：現場路線任務（西進東出，配合冬季 16:00 停止入場的時間） */
function pompeiiMissionHtml() {
  const done = LS.get('pmis:' + S.player, {});
  return `<h2>龐貝現場路線任務（約 2 小時）</h2>
    <div class="card pcompare-banner" style="margin-bottom:12px">
      <div class="pcompare-icon">🏛️</div>
      <div class="pcompare-text">
        <b>龐貝今昔對比互動拉軸</b>
        <span>現場邊走邊看：西元79年繁盛風華 vs 今日現場遺址</span>
      </div>
      <a class="btn small" href="#/pompeii-compare">打開拉軸</a>
    </div>
    <p class="sub">從海門進、圓形競技場出口出，一路往東不走回頭路。妓院和大體育場（石膏像）冬天 16:00 停止入場，所以照這個順序走。每完成一站的任務 +10 分。</p>
    <div class="stack">${POMPEII_MISSION.map((m) => `<div class="card pmis${done[m.n] ? ' done' : ''}">
      <div class="rstep-head"><span class="rstep-n">${esc(m.time)}</span><div class="rstep-t"><b>${m.n}. ${esc(m.zh)}</b><span>${esc(m.it)}・約 ${m.min} 分鐘</span></div></div>
      ${m.pastGlory ? `
      <div class="ancient-modern-box">
        <div class="ancient-modern-sec">
          <b style="color:var(--warn)">🏛️ 昔日風華（西元79年繁盛日常）</b>
          <p>${esc(m.pastGlory)}</p>
        </div>
        <div class="ancient-modern-sec">
          <b style="color:var(--primary)">🔍 今日現場（兩千年後考古見證）</b>
          <p>${esc(m.presentRuins)}</p>
        </div>
        <div style="margin-top:6px"><a class="btn small ghost" href="#/pompeii-compare?spot=${pompeiiSpotKey(m.zh)}">🖼️ 互動拉軸看今昔對比</a></div>
      </div>` : ''}
      ${m.story.split('\n').map((t) => `<p>${esc(t)}</p>`).join('')}
      <div class="pmis-task"><b>🎯 任務：</b>${esc(m.task)}</div>
      <div class="rstep-btns"><a class="btn small ghost" href="${gmPin(m.lat, m.lng)}" target="_blank" rel="noopener">🗺️ 在地圖看位置</a><a class="btn small ghost" href="${gmGo(m.lat, m.lng)}" target="_blank" rel="noopener">🧭 導航過去</a>
        <button type="button" class="btn small${done[m.n] ? ' ghost' : ''}" data-pmis="${m.n}">${done[m.n] ? '✓ 已完成' : '完成任務 +10'}</button></div>
    </div>`).join('')}</div>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-pmis]');
  if (!b) return;
  const n = b.dataset.pmis; const k = 'pmis:' + S.player; const done = LS.get(k, {});
  if (done[n]) return;
  done[n] = Date.now(); LS.set(k, done);
  const m = POMPEII_MISSION.find((x) => String(x.n) === n);
  award({ key: 'pmis|' + n, points: 10, label: '龐貝路線任務：' + (m ? m.zh : n) });
  b.textContent = '✓ 已完成'; b.classList.add('ghost'); b.closest('.pmis').classList.add('done');
});

route('/help', () => {
  view(`${back('#/', '首頁')}<h1>玩法說明</h1>
    <div class="card"><h3>每天早上</h3><p>打開「今天」，解鎖今天的城市卡：讀一個冷門小故事（不想讀可以跳過），挑一個九宮格主題，答 3 題加分題。</p></div>
    <div class="card"><h3>每日美味 Tapa 刮刮樂</h3><p>每天刮開一道西班牙美味點心或溫馨好運，只要大家當天有吃到或做到，點一下就能加 20 分！</p></div>
    <div class="card"><h3>西班牙旅行大圖鑑</h3><p>全西 30 款標誌事物（火腿、吉拿棒、羅馬水道橋、白雪公主城堡、大馬士革鋼劍等），看到就拍照打卡點亮圖鑑，旅行結束就是一本專屬家族見聞手冊！</p></div>
    <div class="card"><h3>到了景點</h3><p>在城市裡點想去的景點卡：先答出發前的題目，看景點冷知識（覺得有趣就按「WoW 記!」），到現場做任務，最後答收尾 3 題。</p></div>
    <div class="card"><h3>記帳與分帳</h3><p>上方的「💰 記帳」：誰先付錢就記一筆，選要平分給哪幾個人。結算只算兩家（LEO家、DISEN家），不同幣別分開算。12/20 以後的帳只能選 LEO家四個人。連上家庭雲端後，每個人看到的是同一本帳。</p></div>
    <div class="card"><h3>下船路線</h3><p>「郵輪靠港」頁的拿坡里和巴勒摩有路線建議：每個點都有「在地圖看位置」和「導航過去」，也能一次在 Google 地圖打開整段步行路線。</p></div>
    <div class="card"><h3>郵輪大圖鑑</h3><p>在「🏆 蒐集圖鑑」中的郵輪分頁分三區：船上免費體驗（+20）、船上付費體驗（另外隔開，+10，不用為了分數花錢）、下船後街上看得到的當地特色（+20）。拍照上傳就點亮。</p></div>
    <div class="card"><h3>行前檢查清單</h3><p>上方的「🧳 行前清單」：每個人勾自己的行李，照重要程度排好；最上面還有郵輪線上報到、ETIAS 和 EES 的提醒。</p></div>
    <div class="card"><h3>四大機場手帳</h3><p>最上方是歐洲數位通關（EES）的說明。桃園機場有兩題多選題（世界前 3 名、前 50 名），全對各加 20 分；點選你找到的文化角落，看看它在旅途上的「遠房親戚」。</p></div>
    <div class="card"><h3>行前閱讀</h3><p>每個景點在參觀前兩天會開放一篇行前閱讀，大約 5 分鐘，讀完會更知道要看什麼。</p></div>
    <div class="card"><h3>小書架</h3><p>每座城市的頁面都有一個「也許出發前你會想看看」書架。點書背看介紹，勾了「我想看」的作品會在書架上發亮，也會收進「我的書單」。</p></div>
    <div class="card"><h3>郵輪靠港</h3><p>首頁的「郵輪靠港：我想去哪裡」可以選每個港口想去的地方，也看得到家人選了什麼。</p></div>
    <div class="card"><h3>九宮格與照片任務</h3><p>拍滿 9 張就能一鍵拼貼。照片任務要拍照上傳，上傳成功才加分。</p></div>
    <div class="card"><h3>留言</h3><p>在「排行」看大家的九宮格，留一句評語就 +5 分，每張照片只能留一次。</p></div>
    <div class="card"><h3>計分</h3><p>初階題 10 分、挑戰題 20 分、長題 30 分、現場驗證 20 分、加分題 15 分、現場任務 30 分、九宮格 20 分、留言 5 分、小遊戲 5–30 分。每題只能答一次。</p></div>
    <div class="card"><h3>沒有網路的時候</h3><p>題目、拍照、拼貼都能照常玩。上傳和分數會先存在手機，連上網路再自動補傳。</p></div>`);
  return 'home';
});

/* ---------- 每日行程：完整 30 天時間軸（含馬德里免費時段最佳化） ---------- */
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
function weekOf(date) { const [y, m, d] = date.split('-').map(Number); return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }
function dayName(date) { return Number(date.slice(5, 7)) + '/' + Number(date.slice(8, 10)) + '（' + weekOf(date) + '）'; }
function spotIdByTitle(key) {
  if (!key) return null;
  const hit = Object.values(CARD).find((c) => c.type !== 'city' && c.title.includes(key));
  return hit ? hit.id : null;
}
/* 住宿（地址來自訂房資料） */
/* 住宿（公開資訊；預訂確認碼和 PIN 碼不放這裡，確認單由家庭雲端「住宿確認」資料夾提供） */
const STAYS = [
  { label: '12/9 – 12/12', name: 'Happy People Sagrada Familia Apartments', addr: 'Carrer Sardenya 306, 08013 Barcelona, 西班牙', q: 'Carrer Sardenya 306, 08013 Barcelona, Spain',
    tel: '+34 935 04 74 70', inout: '入住 15:00–24:00　退房 11:00 前',
    room: '兩筆訂房：12/9–12/11 Leo家四人樓中樓公寓（2 晚）；12/11–12/12 七人公寓（1 晚，Disen家一起住）',
    rules: ['入住時要出示附照片的身分證件和信用卡。', '住宿方會寄租賃合約，要在抵達前簽好寄回；沒收到就打上面的電話。', '入住時用信用卡付 300 歐元損壞押金，退房檢查後 7 天內退還。', '請事先告訴住宿方預計幾點到。（已經線上 check-in 完成）'],
    note: '入住 15:00 起　退房 11:00 前', link: '' },
  { label: '12/19 入住', name: "Avinguda d'Isabel la Catòlica, 65, 08905 L'Hospitalet de Llobregat, Barcelona", addr: "Avinguda d'Isabel la Catòlica, 65, 08905 L'Hospitalet de Llobregat, Barcelona, 西班牙", q: "Avinguda d'Isabel la Catòlica, 65, 08905 L'Hospitalet de Llobregat, Barcelona, Spain", note: '', link: '' },
  { label: '12/22 入住', name: '塞維亞', addr: '西班牙塞維亞　Plus Code 92V8+Q2G（37°23\'40.0"N 5°59\'05.7"W）', q: '37.394444,-5.984917', note: '', link: '' },
  { label: '12/26 入住', name: 'Plazuela los Bacas, 8, 18500 Guadix, Granada', addr: 'Plazuela los Bacas, 8, 18500 Guadix, Granada, 西班牙', q: 'Plazuela los Bacas, 8, 18500 Guadix, Granada, Spain', note: '', link: '' },
  { label: '12/29 入住', name: 'Av. del Corregidor, 14, Poniente Sur, 14004 Córdoba', addr: 'Av. del Corregidor, 14, Poniente Sur, 14004 Córdoba, 西班牙', q: 'Av. del Corregidor, 14, 14004 Córdoba, Spain', note: '', link: '' },
  { label: '12/31 – 1/6', name: 'Madrid cozy apartment', addr: 'Calle de la Oca, 10 1, Carabanchel, 28025 Madrid, 西班牙', q: '40.389283,-3.732533',
    tel: '+34 613 01 04 20', inout: '入住 15:00–18:00　退房 08:00–11:00',
    room: '三臥室公寓，4 人，6 晚',
    rules: ['入住時間只到傍晚 6 點，從哥多華過來要算好時間；會晚到一定要先打電話。', '請事先告訴住宿方預計幾點到。', '公寓不接受派對、聚會。'],
    note: '入住 15:00–18:00　退房 08:00–11:00', link: '' },
];
/* 每天的行程。who:'trio' 表示只有 Disen家（郵輪組），who:'leo' 表示只有 Leo家。tentative 表示還不確定或是推薦。aside 是延伸賞析。 */
const PLAN = {
  '2026-12-09': [
    {
      "text": "聖家堂前方的聖誕市集",
      "q": "Christmas market Sagrada Familia Barcelona",
      "aside": "加泰隆尼亞的聖誕市集很有特色，可以找找看 Caganer（蹲著的小人偶），這是加泰隆尼亞獨有的傳統聖誕人偶。"
    }
  ],
  '2026-12-10': [
    {
      "text": "桂爾公園",
      "spot": "桂爾公園",
      "q": "Park Güell Barcelona",
      "aside": "高第受古埃爾伯爵委託設計的花園社區，後來只完成一部分，但園區本身非常有味道。推薦 Carlos Ruiz Zafón 的《風之影》，書中的巴塞隆納老城與「被遺忘書籍的墓園」，很適合出發前看看。"
    },
    {
      "text": "聖露西亞市集",
      "tentative": true,
      "q": "Fira de Santa Llúcia Barcelona",
      "aside": "聖露西亞市集是巴塞隆納的聖誕市集，攤位很多，適合買小禮物。"
    },
    {
      "text": "畢卡索博物館（如果搶到免費票）",
      "tentative": true,
      "spot": "畢卡索",
      "q": "Museu Picasso Barcelona",
      "aside": "收藏了畢卡索少年時期到青年時期的作品，看得出他在巴塞隆納的成長。"
    }
  ],
  '2026-12-11': [
    {
      "who": "trio",
      "text": "Disen家抵達巴塞隆納",
      "note": "晚上七個人一起住 Happy People Sagrada Familia Apartments（Carrer Sardenya 306）。"
    },
    {
      "who": "leo",
      "when": "白天",
      "text": "聖家堂（Leo家）",
      "spot": "聖家堂",
      "q": "Sagrada Família Barcelona",
      "aside": "高第 1882 年開始建造，至今仍在施工，是世界文化遺產。建築的柱子像樹一樣分枝，是高第最有名的設計概念。"
    },
    {
      "when": "下午",
      "text": "聖保羅醫院",
      "tentative": true,
      "spot": "聖保羅醫院",
      "q": "Hospital de Sant Pau Barcelona",
      "aside": "現代主義（Modernisme）建築群，和音樂宮一起在 1997 年列入世界遺產。醫院的花園和磚造建築很漂亮。"
    },
    {
      "when": "晚上",
      "text": "巴特略之家",
      "tentative": true,
      "spot": "巴特略之家",
      "q": "Casa Batlló Barcelona",
      "aside": "高第的代表作，外牆像海洋和骨骼，屋頂的造型常被稱為「龍背」。"
    },
    {
      "when": "晚上（三選一）",
      "text": "格拉西亞大道與市區燈光 ／ 米拉之家 ／ 維森斯之家",
      "tentative": true,
      "q": "Passeig de Gràcia Barcelona",
      "aside": "米拉之家（La Pedrera）外牆像波浪，屋頂有很多造型煙囪，是高第的另一代表作。"
    },
    {
      "when": "或下午",
      "text": "聖露西亞市集",
      "tentative": true,
      "q": "Fira de Santa Llúcia Barcelona"
    }
  ],
  '2026-12-12': [
    {
      "who": "trio",
      "when": "早上",
      "text": "聖家堂（Disen家，第二批）",
      "spot": "聖家堂",
      "q": "Sagrada Família Barcelona"
    },
    {
      "when": "中午",
      "text": "巴塞隆納港口（郵輪）",
      "q": "Port de Barcelona",
      "aside": "港口旁有哥倫布紀念柱（Mirador de Colom），可以在這裡拍照。"
    }
  ],
  '2026-12-13': [
    {
      "text": "守護聖母院",
      "spot": "守護聖母院",
      "q": "Notre-Dame de la Garde Marseille",
      "aside": "馬賽的守護神，站在山頂可以看到整個港口。"
    },
    {
      "text": "舊港與 Le Panier 老城",
      "spot": "Le Panier",
      "q": "Le Panier Marseille",
      "aside": "馬賽是法國最古老的城市之一。大仲馬的《基度山恩仇記》故事就是從馬賽港開始；2002 年動作片《終極殺陣》（The Transporter）也在這裡拍攝。"
    },
    {
      "tentative": true,
      "text": "伊夫堡（推薦）",
      "q": "Château d'If Marseille",
      "aside": "《基度山恩仇記》主角愛德蒙·鄧蒂斯被關的地方，從舊港搭船前往。"
    }
  ],
  '2026-12-14': [
    {
      "text": "老城與新街（Caruggi、Via Garibaldi）",
      "spot": "老城與新街",
      "q": "Genova centro storico",
      "aside": "熱那亞的老城小巷像迷宮，Via Garibaldi 的羅利宮殿群是世界文化遺產。"
    },
    {
      "text": "舊港與燈塔",
      "spot": "舊港與燈塔",
      "q": "Porto Antico Genova",
      "aside": "熱那亞是地中海最重要的港口之一。電影《1492：征服天堂》（1992）講哥倫布的故事，一般認為他出生在熱那亞。"
    },
    {
      "tentative": true,
      "text": "哥倫布故居（推薦）",
      "q": "Casa di Colombo Genova",
      "aside": "一般認為哥倫布出生在這一帶，故居就在老城裡。"
    }
  ],
  '2026-12-15': [
    {
      "text": "龐貝",
      "spot": "龐貝",
      "q": "Pompeii",
      "aside": "公元 79 年維蘇威火山爆發，城市被火山灰埋住，保留了當時的街道和生活。推薦英國作家 Bulwer-Lytton 的《龐貝最後的日子》（1834）。"
    },
    {
      "tentative": true,
      "text": "那不勒斯老城與披薩（推薦）",
      "q": "Naples centro storico",
      "aside": "那不勒斯是披薩的發源地之一。義大利作家 Elena Ferrante 的《我的天才女友》就發生在這座城市。"
    }
  ],
  '2026-12-16': [
    {
      "text": "主教座堂與帕拉提納禮拜堂",
      "spot": "主教座堂與帕拉提納",
      "q": "Palermo Cathedral",
      "aside": "西西里最重要的大教堂，融合了阿拉伯、諾曼和巴洛克風格。帕拉提納禮拜堂的馬賽克天花板很有名。推薦 Lampedusa 的《豹》（1958），故事就發生在 1860 年代的巴勒摩。"
    },
    {
      "text": "巴拉羅市場與 Teatro Massimo",
      "spot": "巴拉羅市場",
      "q": "Mercato di Ballarò Palermo",
      "aside": "市場是街頭小吃天堂，可以試試炸飯糰（arancina）和炸鷹嘴豆餅（panelle）。Teatro Massimo 是電影《教父 3》歌劇場景的拍攝地。"
    }
  ],
  '2026-12-17': [
    {
      "text": "迦太基遺址",
      "spot": "迦太基",
      "q": "Carthage Tunisia",
      "aside": "迦太基曾和羅馬打過三次布匿戰爭，名將漢尼拔就是迦太基人。推薦福樓拜的《薩朗波》（1862），故事發生在古迦太基。"
    },
    {
      "text": "西迪布賽義德",
      "spot": "西迪布賽義德",
      "q": "Sidi Bou Said",
      "aside": "藍白色的小鎮，據說畫家保羅·克利等人都曾在這裡作畫。"
    }
  ],
  '2026-12-18': [
    {
      "text": "海上日，在船上玩",
      "q": ""
    }
  ],
  '2026-12-19': [
    {
      "who": "trio",
      "text": "Disen家下船，搭機回台灣"
    },
    {
      "when": "下午 5 點",
      "text": "加泰隆尼亞音樂宮自由參觀＋聖誕音樂舞蹈會",
      "spot": "音樂宮",
      "q": "Palau de la Música Catalana",
      "aside": "1908 年完工的現代主義建築，彩色玻璃天窗是必看重點，也列入世界文化遺產。"
    }
  ],
  '2026-12-20': [
    {
      "text": "蒙特惠克山（Montjuïc）",
      "spot": "蒙特惠克",
      "q": "Montjuïc Barcelona",
      "aside": "1992 年巴塞隆納奧運的主場館就在山上。推薦 Antony Beevor 的《西班牙內戰》（The Battle for Spain），了解這段歷史背景。"
    },
    {
      "text": "加泰隆尼亞國家藝術博物館（MNAC）前看日落",
      "q": "Museu Nacional d'Art de Catalunya",
      "aside": "國家美術館所在的國家宮是 1929 年世界博覽會蓋的，館內的羅馬式教堂壁畫是世界最重要的收藏之一。門前的大台階是看日落、看城市的好地方。"
    }
  ],
  '2026-12-21': [
    {
      "text": "蘭布拉大道、博蓋利亞傳統市場採買水果火腿",
      "q": "Mercat de la Boqueria Barcelona",
      "aside": "歐洲最有名的市場之一，現在的鐵棚屋頂是 1914 年加上去的。越往裡面走，價錢越合理，記得禮讓真的來買菜的人。"
    },
    {
      "text": "整理行李，準備搭 AVE 高鐵南下安達魯西亞",
      "q": "Barcelona Sants"
    }
  ],
  '2026-12-22': [
    {
      "text": "抵達塞維亞 ➔ 收音機聽聖誕大樂透「胖子樂透」唱號開獎",
      "q": "Sevilla Santa Justa",
      "aside": "12/22 是西班牙聖誕彩券「El Gordo（胖子）」開獎日，由聖伊德方索學校的學生合唱報號碼，這個傳統從 1812 年延續到現在，全國都在聽。"
    },
    {
      "text": "聖十字區（Barrio de Santa Cruz）橘子樹小巷漫步",
      "q": "Barrio de Santa Cruz Sevilla",
      "aside": "塞維亞的舊猶太區，白牆窄巷、到處是橘子樹。巷子窄，夏天可以遮陽。"
    }
  ],
  '2026-12-23': [
    {
      "text": "塞維亞主教座堂與吉拉達鐘樓（世界第三大天主教堂）",
      "q": "Catedral de Sevilla",
      "aside": "世界最大的哥德式教堂，吉拉達塔原本是清真寺的宣禮塔，裡面是給馬走的斜坡。哥倫布的墓也在這裡。Bizet 的歌劇《卡門》故事就是從塞維亞的菸草工廠開始。"
    },
    {
      "text": "西班牙廣場（Plaza de España）租小船划水與瑪麗亞路易莎公園",
      "q": "Plaza de España Sevilla",
      "aside": "為 1929 年伊比利美洲博覽會而建，半圓形的建築像張開的雙臂擁抱美洲。一整排磁磚小亭代表西班牙各省；《星際大戰二部曲》在這裡取景。"
    }
  ],
  '2026-12-24': [
    {
      "text": "塞維亞王宮（Real Alcázar，摩爾宮殿與熱帶花園）",
      "q": "Real Alcázar de Sevilla",
      "aside": "歐洲還在使用的最古老王宮之一，西班牙國王來塞維亞還住樓上。基督教國王請穆斯林工匠蓋的「穆德哈爾式」代表作，也是《權力遊戲》多恩王國的拍攝地。"
    },
    {
      "text": "黃金塔與瓜達幾維河畔散步",
      "q": "Torre del Oro Sevilla",
      "aside": "十三世紀初穆斯林蓋的瞭望塔，守著河上的港口。後來從美洲運回金銀的船，都要經過它旁邊。"
    },
    {
      "text": "【平安夜】大家在塞維亞溫馨聚餐，品嚐伊比利火腿與杏仁糖",
      "q": ""
    }
  ],
  '2026-12-25': [
    {
      "text": "【聖誕節】塞維亞古城聖誕悠閒漫步、特里亞納區（Triana）",
      "q": "Triana Sevilla",
      "aside": "河對岸過去住著水手、陶工和吉普賽人，是佛朗明哥的搖籃之一，也是塞維亞磁磚的產地。麥哲倫船隊的很多水手來自這一區。"
    },
    {
      "text": "欣賞一場熱情純粹的安達魯西亞佛朗明哥吉他舞蹈演出",
      "q": "Flamenco Sevilla",
      "aside": "佛朗明哥在 2010 年列入聯合國人類非物質文化遺產。它原本是被排擠的窮人唱給自己聽的歌，所以常常帶著悲傷。"
    }
  ],
  '2026-12-26': [
    {
      "text": "前往瓜迪斯（Guadix）➔ 入住夢幻冬暖夏涼的「白煙囪窯洞屋」",
      "q": "Plazuela los Bacas, Guadix",
      "aside": "瓜迪斯約有兩千戶人家住在洞穴裡，冬暖夏涼，整年大約 18 到 20 度，不用冷氣暖氣。"
    },
    {
      "text": "瓜迪斯老城大教堂與白煙囪觀景台",
      "q": "Catedral de Guadix",
      "aside": "從 1549 年一路蓋到十八世紀，一棟建築裡有哥德式、文藝復興和巴洛克三種風格。紅色砂岩的正面在夕陽下最漂亮。"
    }
  ],
  '2026-12-27': [
    {
      "when": "14:30",
      "text": "阿爾罕布拉宮（請強調：14:30 horas Palacios Nazaríes）",
      "spot": "阿爾罕布拉",
      "q": "Alhambra Granada",
      "aside": "華盛頓·歐文的《阿罕布拉宮傳說》（1832）是這座宮殿最經典的文學作品。"
    },
    {
      "text": "阿爾拜辛區（Albaicín）聖尼古拉斯觀景台眺望紅堡夕陽與內華達雪山",
      "q": "Mirador de San Nicolás Granada",
      "aside": "正對阿爾罕布拉宮，後面是內華達山脈的雪山，黃昏時紅堡會變成紅色。人多的時候要小心扒手。"
    }
  ],
  '2026-12-28': [
    {
      "text": "吉普車越野",
      "q": "Guadix Granada",
      "aside": "瓜迪斯有很多洞穴屋聚落，吉普車可以開進不一樣的山地與荒漠地形。"
    }
  ],
  '2026-12-29': [
    {
      "text": "哥多華・大清真寺-主教座堂（Mezquita-Catedral，驚豔紅白雙層拱門森林）",
      "q": "Mezquita-Catedral de Córdoba",
      "aside": "八百多根柱子撐起紅白相間的雙層拱門，正中央卻冒出一座大教堂。推薦 María Rosa Menocal 的《世界的裝飾》（The Ornament of the World），講安達魯西亞的多元文化。"
    },
    {
      "text": "猶太人街區、百花巷（Calleja de las Flores）打卡",
      "q": "Calleja de las Flores Córdoba",
      "aside": "牆上掛滿藍色花盆的小巷，站在巷子裡往外看，剛好可以把大清真寺的鐘樓框進照片。"
    }
  ],
  '2026-12-30': [
    {
      "text": "哥多華・基督教君主城堡與古羅馬大石橋",
      "q": "Alcázar de los Reyes Cristianos Córdoba",
      "aside": "天主教雙王在這裡指揮攻打格拉那達，哥倫布也在這裡向他們說明往西航行的計畫。後來這座城堡當了三百年的宗教裁判所總部。"
    }
  ],
  '2026-12-31': [
    {
      "text": "馬德里老城漫步：太陽門廣場、主廣場（Plaza Mayor）、聖米格爾市場",
      "spot": "太陽門與主廣場",
      "q": "Puerta del Sol Madrid",
      "aside": "地上有全西班牙公路的「零公里」標誌。1808 年馬德里人在這裡起義對抗拿破崙，哥雅把它畫成了名畫。"
    },
    {
      "text": "採買跨年專用「12 顆開運青葡萄」與狂歡小道具",
      "q": "Mercado de San Miguel",
      "aside": "1916 年啟用的鑄鐵市場，現在是一攤一攤的小吃市場，可以一路吃過去。"
    },
    {
      "when": "深夜 23:30",
      "text": "【跨年倒數】太陽門鐘樓下，與全西班牙群眾隨 12 響鐘聲吃完 12 顆葡萄迎新年！",
      "note": "若人潮擁擠，亦可於住宿客廳收看電視鐘樓直播同步吃葡萄",
      "q": "Real Casa de Correos Madrid",
      "aside": "跨年鐘聲就是從這棟舊郵政大樓的鐘樓傳出，全國電視直播。鐘響 12 下，每響一下吃一顆葡萄，吃完就能好運一整年。"
    }
  ],
  '2027-01-01': [
    {
      "text": "【元旦公休日】全西室內博物館休館，適合大家漫步戶外大自然",
      "q": "Parque de El Retiro Madrid",
      "aside": "原本是國王的私人花園，1868 年革命後才開放給市民。2021 年和普拉多大道一起列入世界遺產。"
    },
    {
      "text": "漫步綠意盎然的「麗池公園」（Parque del Retiro）、水晶宮與阿爾卡拉門",
      "spot": "麗池公園",
      "q": "Palacio de Cristal Retiro Madrid",
      "aside": "水晶宮是 1887 年為了展覽菲律賓的植物而蓋的，那時菲律賓還是西班牙的殖民地。",
      "note": "水晶宮整修中，預計 2027 年才重新開放，可以從外面看看。"
    },
    {
      "text": "百年老店 Chocolatería San Ginés 享用暖呼呼熱巧克力配吉拿棒",
      "q": "Chocolatería San Ginés Madrid",
      "aside": "1894 年開業的老店，濃到可以站住湯匙的熱巧克力配吉拿棒，是馬德里人跨年夜和元旦早上的傳統。"
    }
  ],
  '2027-01-02': [
    {
      "text": "參觀國立蘇菲亞王后藝術中心，親睹畢卡索反戰巨作《格爾尼卡》真跡",
      "spot": "蘇菲亞王后",
      "q": "Museo Reina Sofía Madrid",
      "aside": "畢卡索的《格爾尼卡》畫的是 1937 年小鎮被轟炸，畢卡索規定西班牙恢復民主前不能回國，1981 年才回來。推薦海明威的《戰地鐘聲》（For Whom the Bell Tolls, 1940），故事發生在西班牙內戰。",
      "when": "上午",
      "note": "索菲亞王后藝術中心 12/31、1/1、1/6 和每週二休館，所以排在 1/2。出發前請再確認。"
    },
    {
      "when": "14:00起",
      "text": "【免費時段】國立考古博物館（MAN，週六14:00後全面免費！看埃爾切夫人與瓜拉薩爾純金王冠）",
      "spot": "國立考古博物館",
      "q": "Museo Arqueológico Nacional Madrid",
      "aside": "鎮館之寶「埃爾切夫人」是兩千多年前伊比利人的石雕半身像；瓜拉薩爾寶藏是西哥德國王獻給教堂的黃金王冠，上面還吊著寶石字母。"
    },
    {
      "when": "18:00–20:00",
      "text": "【免費時段】普拉多美術館（Museo del Prado，週六18:00-20:00免費入場！賞委拉斯蓋茲《侍女》與哥雅）",
      "spot": "普拉多美術館",
      "q": "Museo del Prado Madrid",
      "aside": "王室幾百年的收藏，委拉斯奎茲的《侍女》被稱為「畫中之畫」，哥雅的《1808 年 5 月 3 日》記錄了馬德里人被槍決的那一夜。畢卡索在巴塞隆納重畫了 58 次的就是《侍女》。"
    }
  ],
  '2027-01-03': [
    {
      "text": "【高鐵郊區一日遊】前往「塞哥維亞」（Segovia，高鐵僅需 28 分鐘）",
      "spot": "賽哥維亞",
      "q": "Acueducto de Segovia",
      "aside": "大約兩千年前羅馬人蓋的水道橋，用了兩萬多塊花崗岩，完全沒有用水泥黏，到近代都還在送水。"
    },
    {
      "text": "仰望壯觀古羅馬水道橋、漫步至迪士尼白雪公主城堡原型「阿爾卡薩城堡」",
      "q": "Alcázar de Segovia",
      "aside": "蓋在懸崖尖端，看起來像一艘船的船頭。據說迪士尼畫城堡時參考過它；伊莎貝拉就是在賽哥維亞被擁立為女王的。"
    },
    {
      "text": "午餐品嚐塞哥維亞最馳名的傳統香脆烤乳豬（Cochinillo Asado）",
      "q": "Mesón de Cándido Segovia",
      "aside": "當地的烤乳豬嫩到可以用盤子的邊緣切開，老闆切完還會把盤子摔碎，這是這間老店的招牌表演。"
    }
  ],
  '2027-01-04': [
    {
      "text": "【高鐵郊區一日遊】避開週一馬德里博物館休館，前往三文化之都「托雷多」（Toledo，高鐵 33 分鐘）",
      "spot": "托雷多",
      "q": "Catedral de Toledo",
      "aside": "西班牙地位最高的大教堂。中世紀的托雷多是「三種文化之城」，學者在這裡把阿拉伯文保存的希臘哲學、數學翻譯成拉丁文，再傳回歐洲。"
    },
    {
      "text": "西班牙首席主教座堂、聖多默教堂欣賞葛雷柯名作《奧加茲伯爵的葬禮》、大馬士革金絲鋼劍工藝",
      "q": "Iglesia de Santo Tomé Toledo",
      "aside": "葛雷柯的名作《奧加茲伯爵的葬禮》就掛在這座小教堂裡，畫的是傳說中兩位聖人親自從天上下來替伯爵下葬。"
    },
    {
      "text": "河谷觀景台（Mirador del Valle）俯瞰托雷多古城與阿爾卡薩城堡壯麗全景",
      "q": "Mirador del Valle Toledo",
      "aside": "從河對岸看整座古城被太加斯河三面包圍，是托雷多最經典的明信片角度。"
    }
  ],
  '2027-01-05': [
    {
      "when": "上午",
      "text": "參觀奢華的「西班牙王宮」（Palacio Real de Madrid）與皇家兵器庫",
      "spot": "馬德里王宮",
      "q": "Palacio Real de Madrid",
      "aside": "有三千多個房間，是西歐最大的王宮之一。舊王宮在 1734 年的聖誕夜被大火燒光，名畫《侍女》據說是從窗戶丟出來才保住的。",
      "note": "王宮 1/1、1/6 休館，12/31 下午 3 點就關門，1/5 去剛好。出發前請再確認。"
    },
    {
      "when": "18:30–21:00",
      "text": "【三王節前夕年度盛典】馬德里三王節大遊行（Cabalgata de Reyes Magos，大家帶倒撐雨傘沿大道搶糖果！）",
      "note": "路線：Paseo de la Castellana 至 Plaza de Cibeles",
      "q": "Plaza de Cibeles Madrid",
      "aside": "1/5 晚上三位國王坐著花車進城，沿路向全城歡慶的人群丟糖果。在西班牙，傳統上為全家人帶來新年祝福與禮物的是三王，不是聖誕老人，所以 1/6 早上才拆禮物。"
    }
  ],
  '2027-01-06': [
    {
      "text": "【三王節主日】早晨大家享用傳統「國王蛋糕」（Roscón de Reyes），看誰吃到幸運陶偶",
      "q": "",
      "aside": "國王蛋糕裡藏著一個小陶偶和一顆豆子：吃到陶偶的人當一天國王，吃到豆子的人要付明年的蛋糕錢。"
    },
    {
      "text": "整理行李、最後採買伴手禮，帶著滿滿歡笑與回憶平安返回台灣！",
      "q": "Aeropuerto Adolfo Suárez Madrid-Barajas",
      "aside": "馬德里機場 T4 航廈的波浪形竹木天花板，由建築師理查．羅傑斯設計，曾得到英國史特林建築獎。"
    }
  ]
};

function cityLabel(date) {
  const u = C.unlock[date];
  if (!u) return '';
  return u[0] === 'cruise' ? '地中海郵輪' : CITY[u[0]].name;
}
route('/trip', () => {
  const dates = [];
  for (let d = new Date(TRIP_START + 'T00:00:00Z'); ; d = new Date(d.getTime() + 86400000)) {
    const iso = d.toISOString().slice(0, 10);
    dates.push(iso);
    if (iso >= TRIP_END) break;
  }
  const stays = STAYS.map((x) => `<details class="stay"><summary><span class="stay-date">${esc(x.label)}</span><span class="stay-name">${esc(x.name)}</span></summary>
    <div class="stay-body">
      <div class="stay-row"><span>地址</span><b>${esc(x.addr || x.name)}</b></div>
      ${x.inout ? `<div class="stay-row"><span>時間</span><b>${esc(x.inout)}</b></div>` : ''}
      ${x.room ? `<div class="stay-row"><span>房型</span><b>${esc(x.room)}</b></div>` : ''}
      ${x.tel ? `<div class="stay-row"><span>電話</span><b><a href="tel:${esc(x.tel.replace(/\s/g, ''))}">${esc(x.tel)}</a></b></div>` : ''}
      ${x.rules && x.rules.length ? `<ul class="stay-rules">${x.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      <div class="row" style="margin-top:10px"><a class="btn small ghost" href="${esc(mapUrl(x.q))}" target="_blank" rel="noopener">地圖</a>
      ${x.tel ? `<a class="btn small ghost" href="tel:${esc(x.tel.replace(/\s/g, ''))}">打電話</a>` : ''}
      ${x.link ? `<a class="btn small ghost" href="${esc(x.link)}" target="_blank" rel="noopener">房間介紹</a>` : ''}</div>
    </div></details>`).join('');
  const rows = dates.map((date) => {
    const items = PLAN[date] || [];
    const label = cityLabel(date);
    const body = items.map((it) => {
      const sid = spotIdByTitle(it.spot);
      const chips = [it.who === 'trio' ? '<span class="chip plan">Disen家</span>' : it.who === 'leo' ? '<span class="chip plan">Leo家</span>' : '', it.tentative ? '<span class="chip">未定／推薦</span>' : ''].join(' ');
      const mapBtn = it.q ? `<a class="btn small ghost" href="${esc(mapUrl(it.q))}" target="_blank" rel="noopener">地圖</a>` : '';
      const cardBtn = sid ? `<a class="btn small ghost" href="#/card/${sid}">任務卡</a>` : '';
      const aside = it.aside ? `<details class="aside"><summary>延伸賞析</summary><p>${esc(it.aside)}</p></details>` : '';
      return `<li><div class="plan-main">${it.when ? `<span class="sub">${esc(it.when)}</span> ` : ''}<b>${esc(it.text)}</b> ${chips}${it.note ? `<div class="sub">${esc(it.note)}</div>` : ''}${aside}</div>
        <div class="plan-btns">${mapBtn}${cardBtn}</div></li>`;
    }).join('');
    return `<details class="day"${items.length ? ' open' : ''}><summary><span class="dot"></span><span class="dt">${esc(dayName(date))}</span>
        <span class="dc">${esc(label)}</span></summary>
        <div class="day-body">${items.length ? `<ul class="plan-list">${body}</ul>` : `<p class="sub">還沒定，這天在${esc(label)}。</p>`}</div></details>`;
  }).join('');
  view(`${back('#/', '首頁')}<h1>每日行程</h1>
    <div class="card"><b>博物館免費小撇步：</b>1/2 週六 14:00 後國立考古博物館免費、18:00–20:00 普拉多美術館免費；1/4 週一安排托雷多剛好避開市區休館！</div>
    <h2>住宿</h2><div class="stays">${stays}</div>
    <div class="card docs-card"><b>訂房確認單</b><p class="sub" style="margin:4px 0 8px">確認單放在家庭雲端，只有家人打得開。打開過一次就會存在手機裡，沒網路也看得到。</p>
      <div id="docs">${docsCachedHtml()}</div><button class="btn small" type="button" id="docs-load">讀取確認單</button></div>
    <h2>每一天</h2><p class="sub">「Disen家」是只參加郵輪部分的三位家人（12/11 抵達，12/19 下船回台灣），「Leo家」是只有 Leo家四人的行程。「未定／推薦」是還沒決定的或是建議的行程。點「延伸賞析」看這個地點的推薦閱讀和電影。每個景點的「行前閱讀」在任務卡裡，參觀前兩天開放。</p>
    <a class="btn ghost block" href="#/cruise" style="margin-bottom:12px">郵輪靠港：我想去哪裡（12/13–12/17）</a>
    <a class="btn ghost block" href="itinerario.html" target="_blank" style="margin-bottom:12px">🇪🇸 西班牙文 30 天完整行程頁（司機與導遊專用）</a>
    <div class="timeline">${rows}</div>`);
  bindDocs();
  return 'home';
});

/* ---------- 行前閱讀：參觀前兩天開放 ---------- */
const CITY_START = { barcelona: '2026-12-09', cruise: '2026-12-13', sevilla: '2026-12-22', guadix: '2026-12-26', cordoba: '2026-12-29', madrid: '2026-12-31' };
const PRE_LABELS = [['bg', '先知道的背景'], ['why', '為什麼重要'], ['see', '你會看到什麼'], ['miss', '為什麼不能錯過'], ['link', '和你知道的事有什麼關係']];
function addDays(iso, n) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); }
function visitDate(card) {
  if (card.port) {
    const m = /^(\d{1,2})\/(\d{1,2})/.exec(card.port);
    if (m) return '2026-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');
  }
  for (const d of Object.keys(PLAN).sort()) {
    if (PLAN[d].some((it) => it.spot && spotIdByTitle(it.spot) === card.id)) return d;
  }
  return CITY_START[card.city] || TRIP_START;
}
function preOpenDate(card) { return addDays(visitDate(card), -2); }
function preOpen(card) { return S.preview || today() >= preOpenDate(card); }
function preReadHtml(card) {
  const p = PRE[card.id];
  if (!p) return '';
  if (!preOpen(card)) {
    return `<div class="card"><b>行前閱讀</b><p class="sub" style="margin:4px 0 0">${fmtDate(preOpenDate(card))} 開放（參觀前兩天）。想先看的話，到「我的」打開「預覽全部」。</p></div>`;
  }
  const paras = p.paras || PRE_LABELS.filter(([k]) => p[k]).map(([k]) => p[k]);
  return `<details class="read pre" open><summary>行前閱讀 <span class="sub">大約 5 分鐘，點一下收起來</span></summary><div class="inner reading pre-body">
    ${paras.map((x) => `<p>${esc(x)}</p>`).join('')}
    ${p.tip ? `<div class="pre-tip"><b>提醒</b>${esc(p.tip)}</div>` : ''}
    ${p.tagline ? `<p class="pre-tagline">${esc(p.tagline)}</p>` : ''}</div></details>`;
}
function bindSpeak() {
  $$('[data-speak]').forEach((b) => b.onclick = () => {
    if (!('speechSynthesis' in window)) { toast('這支手機不支援朗讀'); return; }
    if (speechSynthesis.speaking) { speechSynthesis.cancel(); b.textContent = '念給我聽'; return; }
    const p = PRE[b.dataset.speak];
    const parts = PRE_LABELS.filter(([k]) => p[k]).map(([k, l]) => l + '。' + p[k]);
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-TW'; u.rate = 0.95;
      if (i === parts.length - 1) u.onend = () => { b.textContent = '念給我聽'; };
      speechSynthesis.speak(u);
    });
    b.textContent = '停止朗讀';
  });
}
function readsHtml() {
  const t = today();
  const list = Object.values(CARD).filter((c) => c.type !== 'city' && PRE[c.id] && t >= preOpenDate(c) && t <= visitDate(c))
    .sort((a, b) => visitDate(a).localeCompare(visitDate(b))).slice(0, 8);
  if (!list.length) return '';
  return `<h2>這兩天可以先讀</h2><div class="list">${list.map((c) => `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b>
    <span>行前閱讀・${esc(fmtDate(visitDate(c)))} 前後會去</span></div>${CHEV}</a>`).join('')}</div>`;
}

/* ---------- 郵輪靠港：每個人選自己想去的地方，也看得到別人選什麼 ---------- */
const STAY = { name: '留在船上，或在港口附近隨意走走', fit: '想休息的人。大家下船時船上人少，設施不用排隊。' };
const CRUISE_PORTS = [
  { date: '2026-12-13', port: '馬賽（法國）', hours: '09:00–18:00',
    tip: '郵輪碼頭離舊港有一段距離，通常要搭接駁車或計程車，來回的時間要算進去。時間夠的話，守護聖母院和舊港可以排在同一天。伊夫堡要另外搭船，冬天風浪大時可能停航。',
    opts: [
      { name: '守護聖母院', spot: '守護聖母院', fit: '想看全景、拍照的人。教堂在山頂，上坡路陡，可以搭公車或觀光小火車上去。大約 1.5 到 2 小時。' },
      { name: '舊港與 Le Panier 老城', spot: 'Le Panier', fit: '想慢慢逛、吃東西、買馬賽皂的人。舊港是平路，Le Panier 有坡和階梯。大約 2 到 3 小時。' },
      { name: '伊夫堡', fit: '《基度山恩仇記》的書迷。要從舊港搭船，連參觀大約 2 到 3 小時，開不開船要看天氣。' },
      STAY ] },
  { date: '2026-12-14', port: '熱那亞（義大利）', hours: '09:00–17:00',
    tip: '郵輪碼頭離老城和舊港都不遠，走路大約 15 到 20 分鐘，是最容易自己走的一站。這天 17:00 就開船，比其他港口早一小時。',
    opts: [
      { name: '老城與新街', spot: '老城與新街', fit: '喜歡鑽小巷、看豪宅、吃青醬和佛卡夏的人。大多是平路，大約 2 到 3 小時。' },
      { name: '舊港與燈塔', spot: '舊港與燈塔', fit: '想輕鬆散步的人首選。舊港全線平坦好走，旁邊有水族館；燈塔比較遠，遠遠看就好。' },
      { name: '哥倫布故居', fit: '想打卡的人。房子很小，就在老城東邊的城門旁。注意：故居和新街的博物館週一休館，12/14 剛好是週一，只能看外觀。' },
      STAY ] },
  { date: '2026-12-15', port: '那不勒斯（義大利）', hours: '13:00–20:00',
    tip: '這一站下午 1 點才到，時間最緊。龐貝冬天通常下午 5 點關門、3 點半左右最後入場，要去就得一下船馬上出發（火車單程大約 35 到 40 分鐘，或參加船上的行程）。出發前請再查一次官網的時間。去不了龐貝的人，留在那不勒斯老城吃披薩也很好。',
    opts: [
      { name: '龐貝', spot: '龐貝', fit: '這趟最想看古羅馬的人。遺址很大、石板路不平，要走很多路，膝蓋不好的人會比較辛苦。' },
      { name: '那不勒斯老城與披薩', fit: '想輕鬆走、吃東西的人。從港口走路或搭短程車就到，天黑前回船。' },
      STAY ] },
  { date: '2026-12-16', port: '巴勒摩（義大利西西里島）', hours: '09:00–18:00',
    tip: '港口離市中心不遠，走到 Teatro Massimo 大約 15 到 20 分鐘。市場上午最熱鬧，建議先逛市場、再看教堂。帕拉提納禮拜堂在諾曼王宮裡，要買票，離港口比較遠（走路 30 分鐘以上），可以搭車。',
    opts: [
      { name: '主教座堂與帕拉提納禮拜堂', spot: '主教座堂與帕拉提納', fit: '想看金色馬賽克的人，這是整趟郵輪最華麗的室內。路程比較遠，大約 2 到 3 小時。' },
      { name: '巴拉羅市場與 Teatro Massimo', spot: '巴拉羅市場', fit: '愛吃街頭小吃、愛逛市場的人。平路，人多，要顧好包包。大約 2 小時。' },
      STAY ] },
  { date: '2026-12-17', port: '突尼西亞（La Goulette）', hours: '09:00–18:00',
    tip: '這是唯一不在歐洲的一站。兩個景點都離港口不遠（車程大約 15 到 25 分鐘），通常包一台計程車或參加船上的行程，一個上午就能兩個都去。計程車要先講好價錢。下船要帶什麼證件，以船上公告為準。手機漫遊在這裡很貴，記得先關掉。',
    opts: [
      { name: '迦太基遺址', spot: '迦太基', fit: '歷史迷。遺址分散在好幾個地方，要搭車移動，重點是海邊的安東尼浴場。大約 1.5 到 2 小時。' },
      { name: '西迪布賽義德', spot: '西迪布賽義德', fit: '想拍照、喝薄荷茶的人。藍白小鎮，石板坡路，慢慢走大約 1 到 1.5 小時。' },
      STAY ] },
];
function pickNames(id) {
  const others = (META.likes[id] || []).filter((n) => n !== S.player);
  return LS.get('likes', {})[id] ? others.concat(S.player) : others;
}
route('/cruise', () => {
  const paint = () => {
    const ports = CRUISE_PORTS.map((p) => {
      const opts = p.opts.map((o, i) => {
        const id = 'pick:' + p.date + '#' + i;
        const mine = !!LS.get('likes', {})[id];
        const names = pickNames(id);
        const sid = spotIdByTitle(o.spot);
        return `<div class="pick${mine ? ' on' : ''}"><div class="pick-main"><b>${esc(o.name)}</b>
            <div class="sub">適合：${esc(o.fit)}</div>
            ${sid ? `<a href="#/card/${sid}">看行前閱讀和任務卡</a>` : ''}
            <div class="pick-who">${names.length ? '想去的人：' + names.map(esc).join('、') : '還沒有人選'}</div></div>
          <button type="button" class="btn small${mine ? '' : ' ghost'}" data-pick="${id}">${mine ? '已選' : '我想去'}</button></div>`;
      }).join('');
      return `<h2>${esc(dayName(p.date))} ${esc(p.port)}</h2>${PORT_POSTER[p.date] ? posterImg(PORT_POSTER[p.date]) : ''}<p class="sub">靠港時間 ${esc(p.hours)}</p>
        <div class="card"><b>怎麼選</b><p style="margin:4px 0 0">${esc(p.tip)}</p></div>
        ${Object.keys(PORT_ROUTES).filter((k) => PORT_ROUTES[k].date === p.date).map((k) => `<a class="card cdex-promo" href="#/portroute/${k}"><b>🗺️ ${esc(PORT_ROUTES[k].title)}</b><span>時間表、門票、每個點都能直接開 Google 地圖</span></a>`).join('')}${opts}`;
    }).join('');
    view(`${back('#/trip', '每日行程')}<h1>郵輪靠港：我想去哪裡</h1>${posterImg('ship')}
      <a class="card cdex-promo" href="#/cruisedex"><b>🚢 郵輪大圖鑑</b><span>海上日出、劇院大秀、馬賽聖誕泥偶市集……看到就拍照點亮</span></a>
      <p class="sub">每個港口每個人想去的地方不一樣。先看「怎麼選」和行前閱讀，再按「我想去」，可以選不只一個，也可以改。大家選了什麼都看得到，方便約同伴一起走。</p>
      <p class="sub" id="cst">${S.server.url ? '' : '還沒連上家庭雲端，只看得到自己選的。'}</p>
      <div class="card"><b>船上的正式之夜要帶什麼</b><p style="margin:4px 0 0">我們搭的是 MSC Euribia。7 晚的航程通常會有 1 次正式之夜（Gala Night，有時 2 次），是哪一晚要上船後看每天的節目表才知道，一般不會排在第一晚或最後一晚。服裝不強制，但晚上進餐廳不能穿短褲、拖鞋和背心。建議男生帶一件有領襯衫或西裝外套，女生帶一件洋裝。船上也常辦白色派對，可以多帶一件白色衣服。</p></div>${ports}
      <h2>12/18（五）海上日</h2><p class="sub">整天在船上，不用選。可以逛逛船上的設施，也留意當天的節目表，正式之夜可能就在這一天。</p>`);
    $$('[data-pick]').forEach((b) => b.onclick = () => {
      const id = b.dataset.pick;
      const m = LS.get('likes', {});
      if (m[id]) delete m[id]; else m[id] = true;
      LS.set('likes', m);
      DB.qPut({ id: 'l:' + id, type: 'like', factId: id, player: S.player, on: !!m[id] }).then(flush);
      const y = window.scrollY; paint(); window.scrollTo(0, y);
    });
  };
  paint();
  if (S.server.url) {
    apiGet({ action: 'feed', date: today() }).then(syncMeta).then(() => { if (location.hash === '#/cruise') { const y = window.scrollY; paint(); window.scrollTo(0, y); } }).catch(() => {});
  }
  return 'home';
});

/* ---------- 小書架：也許出發前你會想看看 ---------- */
let SHELF = {};
const SHELF_VERB = { 繪本: '我想讀', 文學: '我想閱讀', 電影: '我想看', 影集: '我想看', 音樂: '我想聽', 歌劇: '我想看', 音樂劇: '我想看', 芭蕾: '我想看' };
const SHELF_TONE = { 繪本: 'o', 文學: 'sd', 電影: 't', 影集: 'k', 音樂: 'o', 歌劇: 'r', 音樂劇: 'r', 芭蕾: 'o' };
const SHELF_PLACE = { barcelona: 'Barcelona', sevilla: 'Sevilla', guadix: 'Granada', cordoba: 'Córdoba', madrid: 'Madrid',
  馬賽: 'Marseille', 熱那亞: 'Genova', 那不勒斯與龐貝: 'Napoli', 巴勒摩: 'Palermo', 突尼西亞: 'Tunis' };
function shelfPicked() { return LS.get('shelf', {}); }
function shelfItem(id) {
  for (const c of Object.keys(SHELF)) { const it = SHELF[c].find((x) => x.id === id); if (it) return [c, it]; }
  return [null, null];
}
function spineHtml(it, i) {
  const on = !!shelfPicked()[it.id];
  const short = it.title.replace(/（.*?）/g, '').replace(/[《》「」]/g, '').split('：')[0].slice(0, 9);
  const fs = short.length > 6 ? 12 : 14;
  const h = Math.max(150 + ((i * 37) % 4) * 12, 64 + short.length * (fs + 3));
  const w = 46 + ((i * 53) % 3) * 6;
  return `<a class="spine ${SHELF_TONE[it.type] || 'sd'}${on ? ' glow' : ''}" href="#/shelf/${it.id}" style="height:${h}px;width:${w}px;--fs:${fs}px"
    aria-label="${esc(it.type)}《${esc(it.title)}》${on ? '，已放進書單' : ''}"><span class="sp-title">${esc(short)}</span><span class="sp-type">${esc(it.type)}</span>${on ? '<i class="sp-star" aria-hidden="true">✦</i>' : ''}</a>`;
}
function shelfRow(items, label) {
  return `<div class="shelf">${label ? `<div class="shelf-label">${esc(label)}</div>` : ''}<div class="shelf-row">${items.map(spineHtml).join('')}</div><div class="shelf-board"></div></div>`;
}
function shelfHtml(cityId, port) {
  const items = (SHELF[cityId] || []).filter((x) => !port || x.port === port);
  if (!items.length) return '';
  const picked = items.filter((x) => shelfPicked()[x.id]).length;
  let rows;
  if (cityId === 'cruise' && !port) {
    const ports = [];
    items.forEach((x) => { if (!ports.includes(x.port)) ports.push(x.port); });
    rows = ports.map((p) => shelfRow(items.filter((x) => x.port === p), p)).join('');
  } else rows = shelfRow(items);
  return `<h2>也許出發前你會想看看</h2>
    <p class="sub">旅途開始前先看看和這個城市有關的書、電影、音樂和舞台作品吧。點一本書背看介紹；勾了「想看」的，會在書架上發亮呦！${picked ? `已勾選 ${picked} 本。` : ''}</p>
    ${rows}<a class="shelf-link" href="#/shelf">我的書單 →</a>`;
}
route('/shelf/:id', (id) => {
  const [cityId, it] = shelfItem(id);
  if (!it) { location.hash = '#/'; return; }
  const verb = SHELF_VERB[it.type] || '我想看';
  const on = !!shelfPicked()[it.id];
  const hint = SHELF_PLACE[it.port] || SHELF_PLACE[cityId] || '';
  const meta = CITY_META[cityId] || TRIP_META;
  const pp = cityId === 'cruise' && PORTS.find((x) => x.shelf === it.port);
  view(`${back(pp ? '#/port/' + pp.key : '#/city/' + cityId, pp ? pp.name : (CITY[cityId] ? CITY[cityId].name : '返回'))}
    <div class="kicker">SHELF · ${esc(meta.en)}${it.port ? ' · ' + esc(it.port) : ''}</div>
    <div class="row"><span class="chip">${esc(it.type)}</span>${it.year ? `<span class="chip">${esc(it.year)}</span>` : ''}</div>
    <h1>${esc(it.title)}</h1>
    <p class="sub">${esc([it.original, it.creator].filter(Boolean).join('｜'))}</p>
    <blockquote class="teaser">${esc(it.teaser)}</blockquote>
    <div class="card reading"><p style="margin:0">${esc(it.body)}</p></div>
    ${it.passage ? `<h2>最常被津津樂道的段落（約 3 分鐘）</h2><div class="card reading passage">${it.passage.split(/\n+/).map((t) => `<p>${esc(t)}</p>`).join('')}<p class="sub" style="font-size:12.5px;margin:8px 0 0">以上是用自己的話重新講的故事，不是原文。</p></div>` : ''}
    ${it.places && it.places.length ? `<h2>按圖索驥</h2><div class="list">${it.places.map((p) => `<div class="item" style="align-items:flex-start">
      <div class="t"><b>${esc(p.name)}</b><span style="white-space:normal">${esc(p.text)}</span></div>
      <a class="btn small ghost" href="${esc(mapUrl(p.name + ' ' + hint))}" target="_blank" rel="noopener">地圖</a></div>`).join('')}</div>` : ''}
    ${it.think ? `<div class="card think"><b>邊走邊想</b><p style="margin:4px 0 0">${esc(it.think)}</p></div>` : ''}
    <label class="want${on ? ' on' : ''}"><input type="checkbox" id="want" ${on ? 'checked' : ''}>
      <span><b>${esc(verb)}</b><small>勾選後，書架上的這一本會閃閃發亮</small></span></label>`);
  $('#want').onchange = (e) => {
    const m = shelfPicked();
    if (e.target.checked) m[it.id] = Date.now(); else delete m[it.id];
    LS.set('shelf', m);
    e.target.closest('.want').classList.toggle('on', e.target.checked);
    toast(e.target.checked ? '放進書單了，回書架看看它在發亮' : '已從書單拿掉');
  };
  return 'home';
});
route('/shelf', () => {
  const m = shelfPicked();
  const list = Object.keys(m).map((id) => [m[id], ...shelfItem(id)]).filter((x) => x[1]).sort((a, b) => b[0] - a[0]);
  view(`${back('#/', '首頁')}<h1>我的書單</h1><p class="sub">你在各城市書架上勾選的作品，都在這裡。</p>
    ${list.length ? `<div class="list">${list.map(([, c, it]) => `<a class="item" href="#/shelf/${it.id}"><div class="t"><b>《${esc(it.title)}》</b>
      <span>${esc(it.type)}・${esc(it.port || (CITY[c] ? CITY[c].name : ''))}</span></div>${CHEV}</a>`).join('')}</div>`
      : '<div class="card"><p style="margin:0">還沒有勾選。到任何一座城市的頁面，點書架上的書背看看。</p></div>'}`);
  return 'home';
});

/* ---------- WoW 筆記：自己的、大家的 ---------- */
function dayOf(ts) { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function factLookup(fid) {
  const [cid, i] = String(fid).split('#');
  const c = CARD[cid];
  const f = c && c.facts && c.facts[Number(i)];
  return f ? { card: c, text: plain(f) } : null;
}
function wowGroupHtml(rows, withName) {
  const days = {};
  rows.forEach((r) => { (days[r.day] = days[r.day] || []).push(r); });
  return Object.keys(days).sort().reverse().map((d) => `<div class="wow-day">${d === '更早' ? '更早' : esc(fmtDate(d))}</div>
    <div class="list">${days[d].map((r) => `<a class="item" href="#/card/${r.f.card.id}"><div class="t"><b style="font-weight:600">${withName ? `<span class="chip" style="margin-right:6px">${esc(r.player)}</span>` : ''}${esc(r.f.text)}</b>
      <span>${esc(r.f.card.title)}</span></div>${CHEV}</a>`).join('')}</div>`).join('');
}
function wowNotesHtml() {
  const mine = Object.entries(LS.get('likes', {})).map(([id, ts]) => ({ f: factLookup(id), day: typeof ts === 'number' ? dayOf(ts) : '更早', ts: typeof ts === 'number' ? ts : 0 }))
    .filter((r) => r.f).sort((a, b) => b.ts - a.ts);
  return `<h2>我的 WoW 筆記</h2>
    ${mine.length ? wowGroupHtml(mine, false) : '<div class="card"><p class="sub" style="margin:0">還沒有筆記。在景點卡的冷知識旁按「WoW 記!」，就會收進這裡。</p></div>'}
    <h2>大家每天 WoW 了什麼</h2>
    <div id="wow-family">${wowFamilyInner()}</div>`;
}
function wowFamilyInner() {
  if (!S.server.url) return '<div class="card"><p class="sub" style="margin:0">連上家庭雲端後，就能看到大家每天覺得哪些資訊有趣。</p></div>';
  const fam = (META.likeLog || []).map((x) => ({ f: factLookup(x.factId), player: x.player, day: x.ts ? dayOf(Number(x.ts)) : '更早', ts: Number(x.ts) || 0 }))
    .filter((r) => r.f).sort((a, b) => b.ts - a.ts);
  return fam.length ? wowGroupHtml(fam, true) : '<div class="card"><p class="sub" style="margin:0">還沒有人 WoW 記。（家人按過卻沒出現的話，請主辦人更新 Apps Script，見設定教學。）</p></div>';
}

/* ---------- 訂房確認單：從家庭雲端「住宿確認」資料夾讀取，存在手機 ---------- */
function docsCachedHtml() {
  const list = LS.get('docs', []);
  if (!list.length) return '<p class="sub" style="margin:0 0 8px">還沒讀取過。</p>';
  return `<div class="list">${list.map((d) => `<button type="button" class="item doc-open" data-doc="${esc(d.id)}" style="width:100%;border:0;background:none;text-align:left">
    <div class="t"><b>${esc(d.name)}</b><span>${d.saved ? '已存在手機，沒網路也能開' : '點一下下載並打開'}</span></div>${CHEV}</button>`).join('')}</div>`;
}
function bindDocs() {
  const paint = () => { const el = $('#docs'); if (el) { el.innerHTML = docsCachedHtml(); bindOpen(); } };
  const bindOpen = () => $$('.doc-open').forEach((b) => b.onclick = async () => {
    const id = b.dataset.doc;
    let blob = await DB.get('doc:' + id);
    if (!blob) {
      if (!S.server.url) { toast('請先在「我的」連上家庭雲端'); return; }
      try {
        toast('下載中…', 20000);
        const r = await apiGet({ action: 'doc', id });
        blob = await (await fetch(r.dataUrl)).blob();
        await DB.put('doc:' + id, blob);
        const list = LS.get('docs', []).map((d) => (d.id === id ? Object.assign(d, { saved: true }) : d));
        LS.set('docs', list);
        toast('已存到手機');
      } catch (e) { toast('讀取失敗：' + e.message); return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click();
    paint();
  });
  const btn = $('#docs-load');
  if (btn) btn.onclick = async () => {
    if (!S.server.url) { toast('請先在「我的」連上家庭雲端'); return; }
    try {
      const r = await apiGet({ action: 'docs' });
      const old = LS.get('docs', []);
      LS.set('docs', (r.files || []).map((f) => ({ id: f.id, name: f.name, saved: !!(old.find((o) => o.id === f.id) || {}).saved })));
      paint();
      toast((r.files || []).length ? '找到 ' + r.files.length + ' 份確認單' : '雲端的「住宿確認」資料夾還是空的');
    } catch (e) { toast('讀取失敗：' + e.message); }
  };
  bindOpen();
}

/* ---------- start ---------- */
async function start() {
  handleJoin();
  if (inAppBrowser()) { renderGate(); return; }
  try { await loadContent(); } catch (e) {
    $('#app').innerHTML = '<div class="gate"><h1>讀不到內容</h1><p>請確認網路，或稍後再開一次。</p></div>';
    return;
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  window.addEventListener('hashchange', render);
  window.addEventListener('online', flush);
  setInterval(flush, 60000);
  render();
  if (S.server.url) apiGet({ action: 'feed', date: today() }).then(syncMeta).then(pullMine).catch(() => {});
  flush();
}
start();
