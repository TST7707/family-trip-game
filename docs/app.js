'use strict';
/* 家族任務遊戲 — single-page app. Content comes from content.json (generated from the script). */
const APP_VERSION = '1.9.2';
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
/* 台灣時間現在是幾點幾分（以分鐘計）。截止時間都用台灣時間，不管人在哪裡。 */
function taipeiMinutes() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour').value);
  const m = Number(parts.find((p) => p.type === 'minute').value);
  return h * 60 + m;
}

/* ---------- local storage (per device) ---------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('ftg:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ftg:' + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
};
const S = {
  get player() { return LS.get('player', ''); },
  get mode() { return LS.get('mode', 'challenge'); },
  get preview() { return LS.get('preview', false); },
  get server() { return LS.get('server', { url: '', code: '' }); },
  get family() { return LS.get('family', []); },
  get paused() { return LS.get('paused', false); },
};
/* 從伺服器拿到的最新狀態：讚、留言、最近得分、截止時間 */
const META = { likes: {}, comments: {}, recent: [], cutoff: '' };

/* ---------- IndexedDB for photos and the upload queue ---------- */
const DB = (() => {
  let p;
  function open() {
    return p || (p = new Promise((res, rej) => {
      const r = indexedDB.open('ftg', 1);
      r.onupgradeneeded = () => { const db = r.result; db.createObjectStore('photos'); db.createObjectStore('queue', { keyPath: 'id' }); };
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

/* ---------- server sync (Google Apps Script) ---------- */
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
/* 把伺服器的最新狀態存到手機；如果主辦人清空過（新的一季），就把這支手機上的舊分數也清掉 */
async function syncMeta(d) {
  if (!d) return;
  META.likes = d.likes || {};
  META.comments = d.comments || {};
  META.recent = d.recent || [];
  META.cutoff = d.cutoff || '';
  LS.set('cutoff', META.cutoff);
  if (d.epoch != null) {
    const was = LS.get('epoch', null);
    if (was !== null && was !== d.epoch) {
      await wipeLocal();
      toast('新的一季開始了，分數和照片已重新開始');
    }
    LS.set('epoch', d.epoch);
  }
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
      // 上傳成功才加分
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

/* ---------- in-app browser gate & join links ---------- */
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
    toast('已加入全家的遊戲');
  } catch (e) { toast('邀請連結看不懂，請再傳一次'); }
  history.replaceState(null, '', location.pathname + location.search + '#/');
  return true;
}

/* ---------- router ---------- */
const routes = [];
function route(pattern, fn) { routes.push([new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), fn]); }
function render() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (inAppBrowser()) return renderGate();
  const path = decodeURIComponent((location.hash || '#/').slice(1)) || '/';
  if (!S.player && path !== '/onboard') { location.hash = '#/onboard'; return; }
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      const tab = fn(...m.slice(1)) || '';
      $('#tabbar').hidden = path === '/onboard';
      $$('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}
function view(html) { $('#app').innerHTML = '<div class="wrap">' + html + '</div>'; }
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
};
const CITY_POSTER = { barcelona: 'barcelona', cruise: 'marseille', madrid: 'madrid' };
const SPOT_POSTER = {
  'barcelona-s1': 'barcelona', 'madrid-s2': 'madrid', 'madrid-s7': 'segovia',
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
    const n = $('#nm').value.trim();
    if (!n) { toast('請先輸入名字'); return; }
    LS.set('player', n);
    LS.set('mode', mode);
    const fam = S.family;
    if (!fam.includes(n)) LS.set('family', fam.concat(n));
    location.hash = '#/';
  };
  return '';
});

/* ---------- home ---------- */
route('/', () => {
  const t = today();
  const tc = todayCard();
  let hero = '';
  if (tc) {
    hero = `<div class="hero"><div class="kicker">TODAY · ${esc(t.replace(/-/g, '.'))}</div><div class="sub">今天解鎖</div><h2 style="margin:4px 0 12px">${esc(CITY[tc.city].name)}・${esc(tc.title)}</h2>
      <a class="btn block" href="#/card/${tc.id}">打開今天的城市卡</a></div>`;
  } else if (t < TRIP_START) {
    const days = Math.ceil((new Date(TRIP_START) - new Date(t)) / 86400000);
    hero = `<div class="hero"><div class="kicker">COUNTDOWN · 12.09.2026</div><div class="sub">距離出發還有</div><div class="big-num">${days}<small> 天</small></div>
      <p style="margin:8px 0 0">城市卡會在當天早上解鎖。想先看看，可以到「我的」打開「預覽全部」。</p></div>`;
  } else if (t > TRIP_END) {
    hero = `<div class="hero"><h2 style="margin:0 0 8px">旅程結束了</h2><p style="margin:0">到「排行」看看全家的總分和所有九宮格。</p></div>`;
  }
  const tiles = C.cities.map((c) => {
    const m = CITY_META[c.id] || TRIP_META;
    const pk = CITY_POSTER[c.id];
    const art = pk ? `<img class="psvg" src="${POSTER_IMG[pk][0]}" alt="" decoding="async">` : posterSVG(c.id);
    return `<a class="city-tile" href="#/city/${c.id}">${art}<div class="tbody">
      <div class="tmeta"><span>S / ${m.no}</span><span>${esc(m.en)}</span></div><b>${esc(c.name)}</b>
      <span>城市卡 ${c.cityCards.length} 張・景點 ${c.spots.length} 個</span></div></a>`;
  }).join('');
  view(`${posterBlock('barcelona', TRIP_META, 'FAMILY · QUEST')}<div class="kicker">S / 00 · ${esc(S.player)}，你好</div><h1>家族任務遊戲</h1><p class="sub">旅遊也能解任務!</p>${hero}
    ${readsHtml()}<h2>選一座城市</h2><div class="grid2">${tiles}</div>
    ${t < RESET_DATE ? '<div class="card" style="margin-top:12px"><b>出發前的分數 12/7 會清空</b><p class="sub" style="margin:4px 0 0">12/9 出發後才正式計分。</p></div>' : ''}
    <div style="margin-top:16px"><a class="btn block" href="#/trip">看每日行程</a></div>
    <div style="margin-top:10px"><a class="btn ghost block" href="#/cruise">郵輪靠港：我想去哪裡</a></div>
    <div style="margin-top:10px"><a class="btn ghost block" href="#/help">玩法說明</a></div>
    <div class="colophon"><span>ARCHITECTURE<br>CITY<br>MEMORY</span><span>V ${APP_VERSION}</span></div>`);
  return 'home';
});

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
  const cityItems = city.cityCards.map((c) => {
    const ok = isUnlocked(c);
    const d = cardDate(c);
    const sub = (c.port ? c.port + '・' : '') + (d ? fmtDate(d) + (ok ? '' : ' 解鎖') : '');
    return ok
      ? `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b><span>${esc(sub)}</span></div>${doneMark(c)}${CHEV}</a>`
      : `<div class="item locked"><div class="t"><b>${esc(c.title.split('：')[0])}</b><span>${esc(sub)}</span></div><span class="chip">未解鎖</span></div>`;
  }).join('');
  const spotItems = city.spots.map((c) => `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b>
    <span>${esc((c.port ? c.port + '・' : '') + (c.game ? '小遊戲：' + c.game.name : '景點卡'))}</span></div>${doneMark(c)}${CHEV}</a>`).join('');
  view(`${back('#/', '首頁')}${CITY_POSTER[city.id] ? posterImg(CITY_POSTER[city.id]) : posterBlock(city.id, CITY_META[city.id] || TRIP_META)}<h1>${esc(city.name)}</h1>${city.intro.map((p) => `<p class="sub">${p}</p>`).join('')}
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

/* ---------- questions ---------- */
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
  if (!qs.length) return `<h2>${title}</h2><p class="sub">初階版這一段沒有題目，切到「我要挑戰」可以玩更多。</p>`;
  return `<h2 id="q-${sec}">${title}</h2>` + qs.map((q) => {
    const tags = q.tags.map((t) => `<span class="chip ${t.includes('現場') ? 'warn' : t.includes('挑戰') || t.includes('長題') ? 'plan' : ''}">${esc(t)}</span>`).join(' ');
    return `<div class="q" data-qid="${q.qid}"><div class="row">${tags}<span class="chip">${qPoints(q)} 分</span></div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.kind === 'onsite' ? '<p class="sub">到現場找答案再作答，並拍照證明。</p>' : ''}
      <div class="opts">${q.options.map((o) => `<button type="button" class="opt" data-k="${o.key}"><span class="k">${o.key}</span><span>${esc(o.text)}</span></button>`).join('')}</div>
      <div class="res"></div></div>`;
  }).join('');
}
function bindQuiz(card) {
  const qs = {};
  allQuestions(card).forEach((q) => { qs[q.qid] = q; });
  const key = 'ans:' + S.player;
  const paint = (box, q, choice) => {
    $$('.opt', box).forEach((b) => {
      b.disabled = true;
      if (b.dataset.k === q.answer) b.classList.add('correct');
      else if (b.dataset.k === choice) b.classList.add('wrong');
    });
    const ok = choice === q.answer;
    $('.res', box).innerHTML = `<div class="exp"><div class="verdict ${ok ? 'ok' : 'no'}">${ok ? '答對了！' : '答案是 ' + q.answer}</div>
      ${q.proof ? '<div><b>現場任務：</b>' + esc(q.proof) + '</div>' : ''}${esc(q.explain)}</div>`;
  };
  $$('.q').forEach((box) => {
    const q = qs[box.dataset.qid];
    if (!q) return;
    const prev = LS.get(key, {})[q.qid];
    if (prev) { paint(box, q, prev.c); return; }
    $$('.opt', box).forEach((b) => b.onclick = () => {
      const ans = LS.get(key, {});
      if (ans[q.qid]) return;
      ans[q.qid] = { c: b.dataset.k, ok: b.dataset.k === q.answer, ts: Date.now() };
      LS.set(key, ans);
      paint(box, q, b.dataset.k);
      if (b.dataset.k === q.answer) award({ key: 'q|' + q.qid, points: qPoints(q), label: '答對：' + card.title, cardId: card.id });
    });
  });
}

/* ---------- tasks: 照片任務要上傳成功才加分；其他任務直接按 ---------- */
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
route('/card/:id', (id) => {
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
    html += preReadHtml(card);
    html += `<button type="button" class="btn ghost block" data-jump="q-p" style="margin-bottom:12px">不想讀？直接跳到題目</button>
      <details class="read" open><summary>景點冷知識 <span class="sub">點一下收起來，覺得特別有趣就按讚</span></summary><div class="inner reading">
      ${card.facts.length ? card.facts.map((f, i) => {
        const fid = factId(card, i);
        const on = !!LS.get('likes', {})[fid];
        return `<div class="fact"><div class="ftxt">${f}</div>
          <button type="button" class="like-btn${on ? ' on' : ''}" data-like="${fid}" aria-pressed="${on}">👍 讚 <span>${likeCount(fid)}</span></button></div>`;
      }).join('') : ''}
      ${card.story.map((p) => `<p>${p}</p>`).join('')}</div></details>
      <p><b>準備好挑戰今天的任務了嗎？</b></p>`;
    html += quizHtml(card, 'p', '出發前的題目');
    if (card.game && card.hasGame) {
      const tool = TOOL_FOR.find(([k]) => card.game.name.includes(k));
      html += `<div class="gamebox"><h3>景點小遊戲：${esc(card.game.name)}</h3><p>${card.game.rules}</p>
        ${tool ? `<a class="btn small" href="#/tool/${tool[1]}">打開${esc(tool[0])}工具</a>` : ''}</div>`;
    }
    if (card.tasks.length) {
      html += `<h2>現場任務</h2><div class="stack">${card.tasks.map((t, i) => `<div class="card task-box" data-task="${i}"><p>${t}</p>
        <input class="text task-note" placeholder="寫下細節（選填，例如名字、地點）">
        <div class="tc"></div></div>`).join('')}</div>`;
    }
    html += `<a class="btn ghost block" href="#/grid/${card.id}/S">開一個這個景點的九宮格</a>`;
    html += quizHtml(card, 'q', '收尾 3 題');
  }
  view(html);
  bindQuiz(card);
  bindSpeak();
  $$('[data-jump]').forEach((b) => b.onclick = () => { const t = document.getElementById(b.dataset.jump); if (t) t.scrollIntoView({ behavior: 'smooth' }); });
  $$('[data-like]').forEach((b) => b.onclick = () => {
    const fid = b.dataset.like;
    const m = LS.get('likes', {});
    m[fid] = !m[fid];
    if (!m[fid]) delete m[fid];
    LS.set('likes', m);
    b.classList.toggle('on', !!m[fid]);
    b.setAttribute('aria-pressed', String(!!m[fid]));
    $('span', b).textContent = likeCount(fid);
    DB.qPut({ id: 'l:' + fid, type: 'like', factId: fid, player: S.player, on: !!m[fid] }).then(flush);
  });
  if (card.type !== 'city') {
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
      <p class="sub" style="margin-top:8px">${S.server.url ? '會上傳 9 張原圖和這張拼貼。上傳成功就加 20 分。沒網路時先存在手機，連上網再自動補傳。' : '還沒連上家庭雲端（到「我的」設定），可以先存到手機。'}</p>`;
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
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { /* fall back below */ }
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
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { /* user cancelled */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

/* ---------- tools (遊戲間) ---------- */
const SECRET_TASKS = [
  '讓一位家人不知不覺說出「好好吃」三次。',
  '偷拍到一位家人打哈欠的瞬間。',
  '讓一位家人跟一座雕像擺一樣的姿勢合照，不能說是任務。',
  '讓全家在同一張照片裡同時比 YA。',
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
  '讓一張全家福裡每個人身上都有紅色。',
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
    <div class="list">
      <a class="item" href="#/tool/wheel"><div class="t"><b>命運之輪</b><span>轉一次，轉到什麼就做什麼</span></div>${CHEV}</a>
      <a class="item" href="#/tool/price"><div class="t"><b>物價猜猜猜</b><span>手機輪流傳，每人偷偷輸入猜價</span></div>${CHEV}</a>
      <a class="item" href="#/tool/steps"><div class="t"><b>步數猜猜猜</b><span>進景點前猜，出來對答案（可以在截止時間前下）</span></div>${CHEV}</a>
      <a class="item" href="#/tool/secret"><div class="t"><b>神秘任務</b><span>填一個你今天喜歡的數字，領取小任務</span></div>${CHEV}</a>
      <a class="item" href="#/tool/give"><div class="t"><b>給分</b><span>連連看、小小觀察家、當一次雕像等遊戲的勝利者</span></div>${CHEV}</a>
    </div>`);
  return 'tools';
});
const WHEEL_DEFAULT = [
  '負責今天所有的點餐',
  '找兩個家人一起跟一扇漂亮的門合照',
  '全家拍一張每個人姿勢都不同的照片',
  '與一個已經1000歲的東西合照',
  '找一個家人跟你一起模仿最近雕像的動作，並拍下來',
  '跟當地人學一句當地話',
];
route('/tool/wheel', () => {
  const def = LS.get('wheel2', WHEEL_DEFAULT);
  view(`${back('#/tools', '遊戲間')}<h1>命運之輪</h1>
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
      g.fillStyle = '#000'; g.font = 'bold 24px -apple-system, "PingFang TC", sans-serif'; g.textAlign = 'right';
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

/* 得獎紀錄（這支手機上記下的） */
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
  view(`${back('#/tools', '遊戲間')}<h1>${isPrice ? '物價猜猜猜' : '步數猜猜猜'}</h1>
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
  view(`${back('#/tools', '遊戲間')}<h1>神秘任務</h1>
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
  view(`${back('#/tools', '遊戲間')}<h1>給分</h1><p class="sub">連連看、小小觀察家、特寫尋寶、當一次雕像、一句當地話的分數在這裡給。</p>
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
    <h2>大家最愛的冷知識</h2><div class="list" id="facts"></div>
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
      try { const r = await apiGet({ action: 'image', id: img.dataset.id }); img.src = r.dataUrl; } catch (e) { /* leave blank */ }
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
      $('#ws').textContent = '還沒連上家庭雲端，只顯示這支手機上的分數。到「我的」設定後就能看到全家。';
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
      <label class="toggle"><span>預覽全部（出發前試玩，城市卡全部打開）</span><input type="checkbox" id="pv" ${S.preview ? 'checked' : ''}></label>
      <label class="toggle"><span>暫停上傳（例如在郵輪上不想用網路）</span><input type="checkbox" id="pz" ${S.paused ? 'checked' : ''}></label>
    </div>
    <div class="card"><p class="section-label">上傳清單</p><p id="qc" class="sub">計算中…</p><button class="btn small" id="fl">現在上傳</button></div>
    <h2>全家名單</h2>
    <div class="card"><label class="field"><span>一行一個名字（遊戲間和給分會用到）</span><textarea class="text" id="fam">${esc(S.family.join('\n'))}</textarea></label>
      <button class="btn small" id="savef">儲存名單</button></div>
    <h2>家庭雲端（一個人設定就好）</h2>
    <div class="card"><label class="field"><span>Apps Script 網址</span><input class="text" id="su" value="${esc(sv.url)}" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label class="field"><span>家庭密碼</span><input class="text" id="sc" value="${esc(sv.code)}"></label>
      <div class="row"><button class="btn small" id="saves">儲存並測試</button><button class="btn small ghost" id="inv">產生全家邀請連結</button></div>
      <p class="sub" id="invout" style="margin-top:10px">設定好後按「產生全家邀請連結」，貼到 LINE 群組。家人點開就自動連好，不用再輸入。</p></div>
    <div style="margin-top:16px"><a class="btn ghost block" href="itinerario.html" target="_blank">🇪🇸 西班牙文 30 天完整行程頁（司機與導遊專用）</a></div>
    <div style="margin-top:10px"><a class="btn ghost block" href="#/admin">主辦人後台</a></div>
    <p class="sub center">版本 ${APP_VERSION}</p>`);
  let mode = S.mode;
  const paint = () => $$('#md button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  paint();
  $$('#md button').forEach((b) => b.onclick = () => { mode = b.dataset.m; paint(); });
  $('#savep').onclick = () => {
    const n = $('#nm').value.trim(); if (!n) return toast('名字不能空白');
    LS.set('player', n); LS.set('mode', mode);
    if (!S.family.includes(n)) LS.set('family', S.family.concat(n));
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

/* ---------- admin (主辦人後台) ---------- */
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
    <div class="card"><p class="sub">會清空所有分數、照片、留言和讚。台灣時間 12/7 00:00 也會自動清空一次。</p>
      <button class="btn small ghost" id="wipe">清空全部測試資料</button></div>
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
    if (!confirm('真的要清空全部測試資料嗎？這個動作無法復原。')) return;
    try { await adminCall({ op: 'wipe' }, code); await wipeLocal(); toast('已清空，重新開始'); load(); } catch (e) { toast(e.message); }
  };
  $('#lo').onclick = () => { LS.set('adminCode', ''); location.hash = '#/me'; };
  load();
}

/* ---------- help ---------- */
route('/help', () => {
  view(`${back('#/', '首頁')}<h1>玩法說明</h1>
    <div class="card"><h3>每天早上</h3><p>打開「今天」，解鎖今天的城市卡：讀一個冷門小故事（不想讀可以跳過），挑一個九宮格主題，答 3 題加分題。</p></div>
    <div class="card"><h3>到了景點</h3><p>在城市裡點想去的景點卡：先答出發前的題目，看景點冷知識（覺得有趣就按讚），到現場做任務，最後答收尾 3 題。</p></div>
    <div class="card"><h3>行前閱讀</h3><p>每個景點在參觀前兩天會開放一篇行前閱讀，大約 2 分鐘，講背景、為什麼重要、會看到什麼。不想看字可以按「念給我聽」。</p></div>
    <div class="card"><h3>郵輪靠港</h3><p>首頁的「郵輪靠港：我想去哪裡」可以選每個港口想去的地方，也看得到家人選了什麼。</p></div>
    <div class="card"><h3>九宮格與照片任務</h3><p>拍滿 9 張就能一鍵拼貼。照片任務要拍照上傳，上傳成功才加分。</p></div>
    <div class="card"><h3>留言</h3><p>在「排行」看大家的九宮格，留一句評語就 +5 分，每張照片只能留一次。</p></div>
    <div class="card"><h3>計分</h3><p>初階題 10 分、挑戰題 20 分、長題 30 分、現場驗證 20 分、加分題 15 分、現場任務 30 分、九宮格 20 分、留言 5 分、小遊戲 5–30 分。每題只能答一次。</p></div>
    <div class="card"><h3>沒有網路的時候</h3><p>題目、拍照、拼貼都能照常玩。上傳和分數會先存在手機，連上網路再自動補傳。</p></div>`);
  return 'home';
});


/* ---------- 每日行程：只列出那天確定或可能的行程 ---------- */
const RESET_DATE = '2026-12-07';
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
const STAYS = [
  { label: '12/9 – 12/11', name: 'Happy People Sagrada Familia Apartments', addr: 'Carrer Sardenya 306, 08013 Barcelona, 西班牙', q: 'Carrer Sardenya 306, 08013 Barcelona, Spain', note: '入住 15:00 起　退房 11:00 前' },
  { label: '12/19 入住', name: "Avinguda d'Isabel la Catòlica, 65, 08905 L'Hospitalet de Llobregat, Barcelona", addr: "Avinguda d'Isabel la Catòlica, 65, 08905 L'Hospitalet de Llobregat, Barcelona, 西班牙", q: "Avinguda d'Isabel la Catòlica, 65, 08905 L'Hospitalet de Llobregat, Barcelona, Spain", note: '' },
  { label: '12/22 入住', name: '塞維亞', addr: '西班牙塞維亞　Plus Code 92V8+Q2G（37°23\'40.0"N 5°59\'05.7"W）', q: '37.394444,-5.984917', note: '' },
  { label: '12/26 入住', name: 'Plazuela los Bacas, 8, 18500 Guadix, Granada', addr: 'Plazuela los Bacas, 8, 18500 Guadix, Granada, 西班牙', q: 'Plazuela los Bacas, 8, 18500 Guadix, Granada, Spain', note: '' },
  { label: '12/29 入住', name: 'Av. del Corregidor, 14, Poniente Sur, 14004 Córdoba', addr: 'Av. del Corregidor, 14, Poniente Sur, 14004 Córdoba, 西班牙', q: 'Av. del Corregidor, 14, 14004 Córdoba, Spain', note: '' },
  { label: '12/31 入住（至 1/6）', name: 'Madrid cozy apartment', addr: 'Calle de la Oca, 10 1, 28025 Madrid, 西班牙', q: 'Calle de la Oca, 10 1, 28025 Madrid, Spain', note: '入住 15:00 起　退房 08:00–11:00' },
];
/* 每天的行程。who:'trio' 表示只有三人（郵輪組）。tentative 表示還不確定或是推薦。aside 是延伸賞析。 */
const PLAN = {
  '2026-12-09': [{ text: '聖家堂前方的聖誕市集', q: 'Christmas market Sagrada Familia Barcelona', aside: '加泰隆尼亞的聖誕市集很有特色，可以找找看 Caganer（蹲著的小人偶），這是加泰隆尼亞獨有的傳統聖誕人偶。' }],
  '2026-12-10': [
    { text: '桂爾公園', spot: '桂爾公園', q: 'Park Güell Barcelona', aside: '高第受古埃爾伯爵委託設計的花園社區，後來只完成一部分，但園區本身非常有味道。推薦 Carlos Ruiz Zafón 的《風之影》，書中的巴塞隆納老城與「被遺忘書籍的墓園」，很適合出發前看看。' },
    { text: '聖露西亞市集', tentative: true, q: 'Fira de Santa Llúcia Barcelona', aside: '聖露西亞市集是巴塞隆納的聖誕市集，攤位很多，適合買小禮物。' },
    { text: '畢卡索博物館（如果搶到免費票）', tentative: true, spot: '畢卡索', q: 'Museu Picasso Barcelona', aside: '收藏了畢卡索少年時期到青年時期的作品，看得出他在巴塞隆納的成長。' },
  ],
  '2026-12-11': [
    { who: 'trio', text: '三人抵達巴塞隆納' },
    { when: '白天', text: '聖家堂（全家）', spot: '聖家堂', q: 'Sagrada Família Barcelona', aside: '高第 1882 年開始建造，至今仍在施工，是世界文化遺產。建築的柱子像樹一樣分枝，是高第最有名的設計概念。' },
    { when: '下午', text: '聖保羅醫院', tentative: true, spot: '聖保羅醫院', q: 'Hospital de Sant Pau Barcelona', aside: '現代主義（Modernisme）建築群，和音樂宮一起在 1997 年列入世界遺產。醫院的花園和磚造建築很漂亮。' },
    { when: '晚上', text: '巴特略之家', tentative: true, spot: '巴特略之家', q: 'Casa Batlló Barcelona', aside: '高第的代表作，外牆像海洋和骨骼，屋頂的造型常被稱為「龍背」。' },
    { when: '晚上（三選一）', text: '格拉西亞大道與市區燈光 ／ 米拉之家 ／ 維森斯之家', tentative: true, q: 'Passeig de Gràcia Barcelona', aside: '米拉之家（La Pedrera）外牆像波浪，屋頂有很多造型煙囪，是高第的另一代表作。' },
    { when: '或下午', text: '聖露西亞市集', tentative: true, q: 'Fira de Santa Llúcia Barcelona' },
  ],
  '2026-12-12': [
    { who: 'trio', when: '早上', text: '聖家堂（三人，第二批）', spot: '聖家堂', q: 'Sagrada Família Barcelona' },
    { when: '中午', text: '巴塞隆納港口（郵輪）', q: 'Port de Barcelona', aside: '港口旁有哥倫布紀念柱（Mirador de Colom），可以在這裡拍照。' },
  ],
  '2026-12-13': [
    { text: '守護聖母院', spot: '守護聖母院', q: 'Notre-Dame de la Garde Marseille', aside: '馬賽的守護神，站在山頂可以看到整個港口。' },
    { text: '舊港與 Le Panier 老城', spot: 'Le Panier', q: 'Le Panier Marseille', aside: '馬賽是法國最古老的城市之一。大仲馬的《基度山恩仇記》故事就是從馬賽港開始；2002 年動作片《終極殺陣》（The Transporter）也在這裡拍攝。' },
    { tentative: true, text: '伊夫堡（推薦）', q: 'Château d\'If Marseille', aside: '《基度山恩仇記》主角愛德蒙·鄧蒂斯被關的地方，從舊港搭船前往。' },
  ],
  '2026-12-14': [
    { text: '老城與新街（Caruggi、Via Garibaldi）', spot: '老城與新街', q: 'Genova centro storico', aside: '熱那亞的老城小巷像迷宮，Via Garibaldi 的羅利宮殿群是世界文化遺產。' },
    { text: '舊港與燈塔', spot: '舊港與燈塔', q: 'Porto Antico Genova', aside: '熱那亞是地中海最重要的港口之一。電影《1492：征服天堂》（1992）講哥倫布的故事，一般認為他出生在熱那亞。' },
    { tentative: true, text: '哥倫布故居（推薦）', q: 'Casa di Colombo Genova', aside: '一般認為哥倫布出生在這一帶，故居就在老城裡。' },
  ],
  '2026-12-15': [
    { text: '龐貝', spot: '龐貝', q: 'Pompeii', aside: '公元 79 年維蘇威火山爆發，城市被火山灰埋住，保留了當時的街道和生活。推薦英國作家 Bulwer-Lytton 的《龐貝最後的日子》（1834）。' },
    { tentative: true, text: '那不勒斯老城與披薩（推薦）', q: 'Naples centro storico', aside: '那不勒斯是披薩的發源地之一。義大利作家 Elena Ferrante 的《我的天才女友》就發生在這座城市。' },
  ],
  '2026-12-16': [
    { text: '主教座堂與帕拉提納禮拜堂', spot: '主教座堂與帕拉提納', q: 'Palermo Cathedral', aside: '西西里最重要的大教堂，融合了阿拉伯、諾曼和巴洛克風格。帕拉提納禮拜堂的馬賽克天花板很有名。推薦 Lampedusa 的《豹》（1958），故事就發生在 1860 年代的巴勒摩。' },
    { text: '巴拉羅市場與 Teatro Massimo', spot: '巴拉羅市場', q: 'Mercato di Ballarò Palermo', aside: '市場是街頭小吃天堂，可以試試炸飯糰（arancina）和炸鷹嘴豆餅（panelle）。Teatro Massimo 是電影《教父 3》歌劇場景的拍攝地。' },
  ],
  '2026-12-17': [
    { text: '迦太基遺址', spot: '迦太基', q: 'Carthage Tunisia', aside: '迦太基曾和羅馬打過三次布匿戰爭，名將漢尼拔就是迦太基人。推薦福樓拜的《薩朗波》（1862），故事發生在古迦太基。' },
    { text: '西迪布賽義德', spot: '西迪布賽義德', q: 'Sidi Bou Said', aside: '藍白色的小鎮，據說畫家保羅·克利等人都曾在這裡作畫。' },
  ],
  '2026-12-18': [{ text: '海上日，在船上玩', q: '' }],
  '2026-12-19': [
    { who: 'trio', text: '三人下船，搭機回台灣' },
    { when: '下午 5 點', text: '加泰隆尼亞音樂宮自由參觀＋聖誕音樂舞蹈會', spot: '音樂宮', q: 'Palau de la Música Catalana', aside: '1908 年完工的現代主義建築，彩色玻璃天窗是必看重點，也列入世界文化遺產。' },
  ],
  '2026-12-20': [{ text: '蒙特惠克山（Montjuïc）', spot: '蒙特惠克', q: 'Montjuïc Barcelona', aside: '1992 年巴塞隆納奧運的主場館就在山上。推薦 Antony Beevor 的《西班牙內戰》（The Battle for Spain），了解這段歷史背景。' }],
  '2026-12-22': [{ text: '塞維亞：大教堂與吉拉達塔（推薦）', spot: '塞維亞大教堂', q: 'Seville Cathedral Giralda', aside: '吉拉達塔原本是清真寺的宣禮塔。Bizet 的歌劇《卡門》故事就是從塞維亞的菸草工廠開始。' }],
  '2026-12-27': [{ when: '14:30', text: '阿爾罕布拉宮（請強調：14:30 horas Palacios Nazaríes）', spot: '阿爾罕布拉', q: 'Alhambra Granada', aside: '華盛頓·歐文的《阿罕布拉宮傳說》（1832）是這座宮殿最經典的文學作品。' }],
  '2026-12-28': [{ text: '吉普車越野', q: 'Guadix Granada', aside: '瓜迪斯有很多洞穴屋聚落，吉普車可以開進不一樣的山地與荒漠地形。' }],
  '2026-12-29': [{ text: '哥多華大清真寺（推薦）', spot: '哥多華大清真寺', q: 'Mezquita-Catedral de Córdoba', aside: '清真寺後來改建成主教座堂，融合伊斯蘭和基督教建築。推薦 María Rosa Menocal 的《世界的裝飾》（The Ornament of the World），講安達魯西亞的多元文化。' }],
  '2026-12-31': [{ text: '馬德里：普拉多美術館與索菲亞王后藝術中心（推薦）', spot: '蘇菲亞王后', q: 'Museo Nacional del Prado Madrid', aside: '索菲亞王后藝術中心收藏畢卡索的《格爾尼卡》。推薦海明威的《戰地鐘聲》（For Whom the Bell Tolls, 1940），故事發生在西班牙內戰。' }],
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
  const stays = STAYS.map((x) => `<div class="score-row" style="align-items:flex-start"><span class="name" style="white-space:normal"><b>${esc(x.label)}</b><br>${esc(x.name)}${x.note ? `<br><span class="sub">${esc(x.note)}</span>` : ''}</span>
    <a class="btn small ghost" href="${esc(mapUrl(x.q))}" target="_blank" rel="noopener">地圖</a></div>`).join('');
  const rows = dates.map((date) => {
    const items = PLAN[date] || [];
    const label = cityLabel(date);
    const body = items.map((it) => {
      const sid = spotIdByTitle(it.spot);
      const chips = [it.who === 'trio' ? '<span class="chip plan">三人</span>' : '', it.tentative ? '<span class="chip">未定／推薦</span>' : ''].join(' ');
      const mapBtn = it.q ? `<a class="btn small ghost" href="${esc(mapUrl(it.q))}" target="_blank" rel="noopener">地圖</a>` : '';
      const cardBtn = sid ? `<a class="btn small ghost" href="#/card/${sid}">任務卡</a>` : '';
      const aside = it.aside ? `<details class="aside"><summary>延伸賞析</summary><p>${esc(it.aside)}</p></details>` : '';
      return `<li><div class="plan-main">${it.when ? `<span class="sub">${esc(it.when)}</span> ` : ''}<b>${esc(it.text)}</b> ${chips}${aside}</div>
        <div class="plan-btns">${mapBtn}${cardBtn}</div></li>`;
    }).join('');
    return `<details class="day"${items.length ? ' open' : ''}><summary><span class="dot"></span><span class="dt">${esc(dayName(date))}</span>
        <span class="dc">${esc(label)}</span></summary>
        <div class="day-body">${items.length ? `<ul class="plan-list">${body}</ul>` : `<p class="sub">還沒定，這天在${esc(label)}。</p>`}</div></details>`;
  }).join('');
  view(`${back('#/', '首頁')}<h1>每日行程</h1>
    <div class="card"><b>提醒：</b>出發前在遊戲裡累積的分數，會在 <b>12/7</b> 清空。12/9 出發後才開始正式計分，請到時候再玩。</div>
    <h2>住宿</h2><div class="list">${stays}</div>
    <h2>每一天</h2><p class="sub">「三人」是只參加郵輪部分的三位家人（12/11 抵達，12/19 下船回台灣）。「未定／推薦」是還沒決定的或是建議的行程。點「延伸賞析」看這個地點的推薦閱讀和電影。每個景點的「行前閱讀」在任務卡裡，參觀前兩天開放。</p>
    <a class="btn ghost block" href="#/cruise" style="margin-bottom:12px">郵輪靠港：我想去哪裡（12/13–12/17）</a>
    <a class="btn ghost block" href="itinerario.html" target="_blank" style="margin-bottom:12px">🇪🇸 西班牙文 30 天完整行程頁（司機與導遊專用）</a>
    <div class="timeline">${rows}</div>`);
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
  return `<details class="read pre" open><summary>行前閱讀 <span class="sub">大約 2 分鐘，點一下收起來</span></summary><div class="inner reading">
    ${PRE_LABELS.filter(([k]) => p[k]).map(([k, l]) => `<p><span class="section-label">${l}</span><br>${esc(p[k])}</p>`).join('')}
    <button type="button" class="btn small ghost" data-speak="${card.id}">念給我聽</button></div></details>`;
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
      { name: '舊港與燈塔', spot: '舊港與燈塔', fit: '想輕鬆走的人，帶長輩也方便。舊港平坦好走，旁邊有水族館；燈塔比較遠，遠遠看就好。' },
      { name: '哥倫布故居', fit: '想打卡的人。房子很小，大約 30 分鐘，就在老城東邊的城門旁，可以和老城排在一起。' },
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
        <div class="card"><b>怎麼選</b><p style="margin:4px 0 0">${esc(p.tip)}</p></div>${opts}`;
    }).join('');
    view(`${back('#/trip', '每日行程')}<h1>郵輪靠港：我想去哪裡</h1>
      <p class="sub">每個港口每個人想去的地方不一樣。先看「怎麼選」和行前閱讀，再按「我想去」，可以選不只一個，也可以改。大家選了什麼都看得到，方便約同伴一起走。</p>
      <p class="sub" id="cst">${S.server.url ? '' : '還沒連上家庭雲端，只看得到自己選的。'}</p>
      <div class="card"><b>船上的正式之夜要帶什麼</b><p style="margin:4px 0 0">我們搭的是 MSC Euribia。7 晚的航程通常會有 1 次正式之夜（Gala Night，有時 2 次），是哪一晚要上船後看每天的節目表才知道，一般不會排在第一晚或最後一晚。服裝不強制，但晚上進餐廳不能穿短褲、拖鞋和背心。建議男生帶一件有領襯衫或西裝外套，女生帶一件洋裝。船上也常辦白色派對，可以多帶一件白色衣服。</p></div>${ports}
      <h2>12/18（五）海上日</h2><p class="sub">整天在船上，不用選。</p>`);
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
  if (S.server.url) apiGet({ action: 'feed', date: today() }).then(syncMeta).catch(() => {});
  flush();
}
start();
