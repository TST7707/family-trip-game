'use strict';
/* å®¶æ—ä»»å‹™éŠæˆ² v1.5.0 â€” Single-page app. Content comes from content.json */
const APP_VERSION = '1.5.0';
const TRIP_START = '2026-12-09';
const TRIP_END = '2027-01-06';
const RESET_DATE = '2026-12-07';

/* ---------- i18n Dictionary ---------- */
const I18N = {
  zh: {
    appName: 'å®¶æ—ä»»å‹™éŠæˆ²',
    subTitle: 'æ—…éŠä¹Ÿèƒ½è§£ä»»å‹™ï¼',
    navHome: 'é¦–é ', navToday: 'ä»Šå¤©', navTools: 'éŠæˆ²é–“', navWall: 'æŽ’è¡Œ', navMe: 'æˆ‘çš„',
    welcome: 'ï¼Œä½ å¥½', selectCity: 'é¸ä¸€åº§åŸŽå¸‚', cityCardSub: 'åŸŽå¸‚å¡ {c} å¼µãƒ»æ™¯é»ž {s} å€‹',
    todayUnlocked: 'ä»Šå¤©è§£éŽ–', daysLeft: 'è·é›¢å‡ºç™¼é‚„æœ‰', days: 'å¤©',
    seePlan: 'çœ‹æ¯æ—¥è¡Œç¨‹', gameHelp: 'çŽ©æ³•èªªæ˜Ž', spanishItiBtn: 'ðŸ‡ªðŸ‡¸ è¥¿ç­ç‰™æ–‡è¡Œç¨‹ï¼ˆçµ¦åŒäº‹åˆ†äº«ï¼‰',
    cityCardsTitle: 'åŸŽå¸‚å¡ï¼ˆæ¯å¤©è§£éŽ–ä¸€å¼µï¼‰', spotCardsTitle: 'æ™¯é»žå¡ï¼ˆæƒ³åŽ»å“ªå€‹å°±é»žå“ªå€‹ï¼‰',
    unlocked: 'æœªè§£éŽ–', jumpBonus: 'ä¸æƒ³è®€ï¼Ÿç›´æŽ¥è·³åˆ°åŠ åˆ†é¡Œ', jumpQuiz: 'ä¸æƒ³è®€ï¼Ÿç›´æŽ¥è·³åˆ°é¡Œç›®',
    todayStory: 'ä»Šå¤©çš„æ•…äº‹', spotFacts: 'æ™¯é»žå†·çŸ¥è­˜', spotFactsSub: 'é»žä¸€ä¸‹æ”¶èµ·ä¾†ï¼Œè¦ºå¾—ç‰¹åˆ¥æœ‰è¶£å°±æŒ‰è®š',
    readyChallenge: 'æº–å‚™å¥½æŒ‘æˆ°ä»Šå¤©çš„ä»»å‹™äº†å—Žï¼Ÿ', preQuiz: 'å‡ºç™¼å‰çš„é¡Œç›®', postQuiz: 'æ”¶å°¾ 3 é¡Œ',
    fieldTask: 'ç¾å ´ä»»å‹™', openSpotGrid: 'é–‹ä¸€å€‹é€™å€‹æ™¯é»žçš„ä¹å®®æ ¼',
    tapaTitle: 'ä»Šæ—¥ç¾Žå‘³ Tapa åˆ®åˆ®æ¨‚', tapaSub: 'ç‚ºçˆ¸åª½å’Œå¼Ÿå¼Ÿé‡èº«è¨­è¨ˆçš„ç¾Žé£Ÿèˆ‡å¥½é‹å°äº‹ï¼',
    pokedexTitle: 'è¥¿ç­ç‰™æ—…è¡Œå¤§åœ–é‘‘', pokedexSub: '30 æ¬¾è¥¿ç­ç‰™æ¨™èªŒæ€§äº‹ç‰©ï¼Œçœ‹è¦‹å°±æ‹ç…§æ‰“å¡ï¼',
    flagsTitle: 'åŸŽå¸‚æ——èˆ‡å°çœ¾æ•…äº‹', flagsSub: 'æ¯å¤©é€£çºŒæ‰“å¡è§£éŽ–ä¸€é¢åŸŽå¸‚æ——èˆ‡å‚³å¥‡æ•…äº‹',
    milestoneTitle: 'å…¨å®¶ 30 è¬æ­¥å¤§æŒ‘æˆ°', milestoneDesc: 'å…¨å®¶äººåˆåŠ›ç´¯ç©æ­¥æ•¸ï¼Œè§£éŽ–æ…¶åŠŸå¤§çŽï¼',
    logStepsBtn: '+ ç™»è¨˜ä»Šæ—¥æ­¥æ•¸', polaroidBtn: 'ðŸ“¸ ç”¢ç”Ÿä»Šæ—¥å›žæ†¶æ‹ç«‹å¾—',
    tapToScratch: 'ðŸ‘† é»žæ“Šåˆ®é–‹ä»Šæ—¥å¥½é‹ç¾Žå‘³', alreadyDone: 'ä»Šå¤©åšåˆ°äº† / åšåˆ°äº†ï¼+20 åˆ†',
    markSuccess: 'å¤ªæ£’äº†ï¼å·²è¨ˆå…¥å®¶æ—åˆ†æ•¸ +20',
  },
  es: {
    appName: 'MisiÃ³n Familiar EspaÃ±a',
    subTitle: 'Â¡Viajar y superar misiones juntos!',
    navHome: 'Inicio', navToday: 'Hoy', navTools: 'Juegos', navWall: 'RÃ¡nking', navMe: 'Perfil',
    welcome: ', Â¡hola!', selectCity: 'Elige una Ciudad', cityCardSub: '{c} tarjetas â€¢ {s} lugares',
    todayUnlocked: 'Desbloqueo de Hoy', daysLeft: 'DÃ­as hasta el viaje', days: 'dÃ­as',
    seePlan: 'Ver Itinerario Diario', gameHelp: 'CÃ³mo Jugar', spanishItiBtn: 'ðŸ‡ªðŸ‡¸ Itinerario en EspaÃ±ol (Colegas)',
    cityCardsTitle: 'Tarjetas de Ciudad (Desbloqueo diario)', spotCardsTitle: 'Puntos de InterÃ©s (Lugares)',
    unlocked: 'Bloqueado', jumpBonus: 'Saltar a preguntas de bonus', jumpQuiz: 'Saltar a las preguntas',
    todayStory: 'Historia del DÃ­a', spotFacts: 'Curiosidades del Lugar', spotFactsSub: 'Toca para plegar, dale me gusta si te parece curioso',
    readyChallenge: 'Â¿Listos para el reto de hoy?', preQuiz: 'Preguntas antes de salir', postQuiz: '3 preguntas finales',
    fieldTask: 'Misiones en el Lugar', openSpotGrid: 'Crear un collage 3x3 de este lugar',
    tapaTitle: 'Rasca y Gana: Tapa del DÃ­a', tapaSub: 'Â¡Delicias y pequeÃ±as alegrÃ­as para toda la familia!',
    pokedexTitle: 'PokÃ©dex de Viaje por EspaÃ±a', pokedexSub: '30 iconos espaÃ±oles para encontrar y fotografiar',
    flagsTitle: 'Banderas e Historias Legendarias', flagsSub: 'Desbloquea una bandera y leyenda con cada dÃ­a de racha',
    milestoneTitle: 'Reto Familiar de 300.000 Pasos', milestoneDesc: 'Â¡Sumemos pasos juntos para desbloquear premios!',
    logStepsBtn: '+ Registrar pasos de hoy', polaroidBtn: 'ðŸ“¸ Crear Polaroid del DÃ­a',
    tapToScratch: 'ðŸ‘† Toca para rascar la delicia de hoy', alreadyDone: 'Â¡Probado / Hecho hoy! +20 pts',
    markSuccess: 'Â¡Genial! Sumados +20 puntos al equipo familiar',
  }
};
function t(k) {
  const lang = S.lang || 'zh';
  return (I18N[lang] && I18N[lang][k]) || I18N['zh'][k] || k;
}

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
  get lang() { return LS.get('lang', 'zh'); },
  set lang(v) { LS.set('lang', v); },
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
  };
})();

/* ---------- content ---------- */
let C = null;
const CARD = {};
const CITY = {};
const DATE_FOR = {};
async function loadContent() {
  const res = await fetch('content.json', { cache: 'no-cache' });
  C = await res.json();
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
  toast((player === S.player ? '' : player + ' ') + '+' + points + ' åˆ†');
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
  META.comments = d.comments || {};
  META.recent = d.recent || [];
  META.cutoff = d.cutoff || '';
  LS.set('cutoff', META.cutoff);
  if (d.epoch != null) {
    const was = LS.get('epoch', null);
    if (was !== null && was !== d.epoch) {
      await wipeLocal();
      toast('æ–°çš„ä¸€å­£é–‹å§‹äº†ï¼Œåˆ†æ•¸å’Œç…§ç‰‡å·²é‡æ–°é–‹å§‹');
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
      toast('ä¸Šå‚³ä¸­ ' + n + ' / ' + photos.length, 60000);
      const data = await blobToBase64(blob);
      await api('photo', Object.assign({}, p.meta, { id: p.id, mime: blob.type || 'image/jpeg', data }));
      await DB.qDel(p.id);
      if (p.meta.kind === 'task') await DB.del(p.key);
      if (p.award) award(p.award);
    }
    if (n) toast('ä¸Šå‚³å®Œæˆï¼Œå…± ' + n + ' å¼µ');
  } catch (e) {
    if (String(e.message) !== 'no server') toast('ä¸Šå‚³æš«åœï¼Œé€£ä¸Šç¶²è·¯å¾Œæœƒè‡ªå‹•å†è©¦');
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
    <h1>è«‹ç”¨ç€è¦½å™¨é–‹å•Ÿ</h1>
    <p>åœ¨ LINE æˆ–å…¶ä»– App è£¡é¢æ‰“é–‹ï¼Œç…§ç‰‡å’Œåˆ†æ•¸å¯èƒ½æœƒä¸è¦‹ã€‚</p>
    ${isLine ? `<a class="btn block" href="${esc(externalUrl())}">ç”¨ç€è¦½å™¨é–‹å•Ÿ</a>`
             : '<p><b>è«‹æŒ‰å³ä¸Šè§’ã€Œâ‹¯ã€ï¼Œé¸ã€Œç”¨ç€è¦½å™¨é–‹å•Ÿã€æˆ–ã€Œåœ¨ Safariï¼Chrome ä¸­é–‹å•Ÿã€ã€‚</b></p>'}
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
    toast('å·²åŠ å…¥å…¨å®¶çš„éŠæˆ²');
  } catch (e) { toast('é‚€è«‹é€£çµçœ‹ä¸æ‡‚ï¼Œè«‹å†å‚³ä¸€æ¬¡'); }
  history.replaceState(null, '', location.pathname + location.search + '#/');
  return true;
}

/* ---------- router ---------- */
const routes = [];
function route(pattern, fn) { routes.push([new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$'), fn]); }
function render() {
  if (inAppBrowser()) return renderGate();
  recordLogin();
  const path = decodeURIComponent((location.hash || '#/').slice(1)) || '/';
  if (!S.player && path !== '/onboard') { location.hash = '#/onboard'; return; }
  
  // update tabbar text according to current language
  const tb = $('#tabbar');
  if (tb) {
    const links = $$('a', tb);
    if (links[0]) links[0].childNodes[1].nodeValue = t('navHome');
    if (links[1]) links[1].childNodes[1].nodeValue = t('navToday');
    if (links[2]) links[2].childNodes[1].nodeValue = t('navTools');
    if (links[3]) links[3].childNodes[1].nodeValue = t('navWall');
    if (links[4]) links[4].childNodes[1].nodeValue = t('navMe');
  }

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

function topBarHtml() {
  const streak = getStreak();
  const isEs = S.lang === 'es';
  return `<div class="top-header">
    <div style="display:flex;gap:8px;align-items:center">
      <a class="flame-pill" href="#/flags" title="${t('flagsTitle')}">ðŸ”¥ ${streak} ${isEs ? 'dÃ­as' : 'å¤©é€£éœ¸'}</a>
      <a class="chip" href="#/tapa" style="font-weight:700">ðŸ¢ ${isEs ? 'Tapa' : 'ä»Šæ—¥åˆ®åˆ®æ¨‚'}</a>
      <a class="chip" href="#/pokedex" style="font-weight:700">ðŸ“– ${isEs ? 'PokÃ©dex' : 'åœ–é‘‘'}</a>
    </div>
    <button class="lang-toggle-btn" id="lang-btn" type="button">${isEs ? 'ðŸ‡¹ðŸ‡¼ ä¸­æ–‡' : 'ðŸ‡ªðŸ‡¸ EspaÃ±ol'}</button>
  </div>`;
}

function view(html) {
  $('#app').innerHTML = topBarHtml() + '<div class="wrap">' + html + '</div>';
  const lb = $('#lang-btn');
  if (lb) lb.onclick = () => {
    S.lang = S.lang === 'es' ? 'zh' : 'es';
    toast(S.lang === 'es' ? 'Cambiado a EspaÃ±ol ðŸ‡ªðŸ‡¸' : 'å·²åˆ‡æ›ç‚ºç¹é«”ä¸­æ–‡ ðŸ‡¹ðŸ‡¼');
    render();
  };
}
function back(href, label) { return `<a class="back" href="${href}"><svg class="chev" style="transform:rotate(180deg);stroke:currentColor" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>${esc(label)}</a>`; }

/* ---------- 30 TAPAS & GOOD LUCK TREATS (çˆ¸åª½å¼Ÿå¼Ÿå°ˆå±¬ç¾Žé£Ÿ/å¥½é‹åˆ®åˆ®æ¨‚) ---------- */
const TAPAS_LIST = [
  { id: 1, icon: 'ðŸ«', name: 'æ¿ƒéƒç†±å·§å…‹åŠ›é…å‰›å‡ºçˆç¾ç‚¸å‰æ‹¿æ£’', nameEs: 'Churros con Chocolate Caliente', desc: 'ç†±é¨°é¨°å‰›å‡ºçˆçš„è„†å‰æ‹¿æ£’ï¼Œæ²¾æ»¿æ¿ƒåˆ°åƒèžåŒ–å¸ƒä¸çš„ç†±å·§å…‹åŠ›ï¼Œç¬¬ä¸€å£å¹¸ç¦æ„Ÿçˆ†ç™¼ï¼' },
  { id: 2, icon: 'ðŸŠ', name: 'è¥¿ç­ç‰™ç”œç”œé®®æ¦¨æŸ³æ©™æ±', nameEs: 'Zumo de Naranja ReciÃ©n Exprimido', desc: 'è¡—é‚Šå’–å•¡é¤¨æˆ–è¶…å¸‚ç¾æ¦¨çš„ç”œæ©˜æ±ï¼Œæ»¿æ»¿å—æ­é™½å…‰ç¶­ä»–å‘½Cï¼Œå¥½å–åˆè§£æ¸´ï¼' },
  { id: 3, icon: 'ðŸ¥ª', name: 'åŽšåˆ‡é¦™å«©é¦¬éˆ´è–¯çƒ˜è›‹', nameEs: 'Pincho de Tortilla de Patatas', desc: 'åŽšåŽšè»Ÿè»Ÿçš„é¦¬éˆ´è–¯çƒ˜è›‹åˆ‡å¡Šï¼Œé¦™æ°£æ’²é¼»ï¼Œå¼Ÿå¼Ÿå’Œçˆ¸åª½éƒ½ä¸€åƒå°±æ„›ä¸Šï¼' },
  { id: 4, icon: 'ðŸ“', name: 'å¸‚å ´è²·ä¸€ç›’é®®ç”œç´…è‰èŽ“', nameEs: 'Fresas Frescas del Mercado', desc: 'åœ¨æ°´æžœæ”¤æŒ‘ä¸€ç›’ç´…é€šé€šåˆå¤§åˆç”œçš„æ–°é®®è‰èŽ“ï¼Œå›žæ—…é¤¨æ´—ä¹¾æ·¨å…¨å®¶ä¸€èµ·åˆ†è‘—åƒã€‚' },
  { id: 5, icon: 'ðŸ¥“', name: 'ä¸€ç‰‡é ‚ç´šä¼Šæ¯”åˆ©ç«è…¿é…çƒ¤éºµåŒ…', nameEs: 'JamÃ³n IbÃ©rico con Pan Crujiente', desc: 'æ²¹èŠ±åœ¨å¤§ç†çŸ³èŠ±ç´‹ä¸Šç™¼äº®ï¼Œæ”¾é€²å˜´è£¡æ²¹è„‚è‡ªç„¶èžåŒ–ï¼Œæ¿ƒæ¿ƒæ©¡å¯¦é¦™æ°£ã€‚' },
  { id: 6, icon: 'ðŸŒž', name: 'åœ¨å»£å ´é•·æ¤…ä¸Šæ›¬ 5 åˆ†é˜å†¬é™½', nameEs: '5 Minutos de Sol en la Plaza', desc: 'é–‰ä¸Šçœ¼ç›ï¼Œåœ¨è¥¿ç­ç‰™æš–å‘¼å‘¼çš„å†¬æ—¥é™½å…‰ä¸‹éœéœåè‘—ï¼Œæ”¾é¬†å¿ƒæƒ…ã€‚' },
  { id: 7, icon: 'ðŸ¶', name: 'å‘è¡—ä¸Šæ•£æ­¥çš„å¯æ„›å°ç‹—å¾®ç¬‘æ–æ‰‹', nameEs: 'Saludar con Sonrisa a un Perrito', desc: 'è¥¿ç­ç‰™äººè¶…æ„›ç‹—ï¼Œåœ¨è¡—é ­é‡åˆ°æ•£æ­¥çš„å°ç‹—ï¼Œå°ç‰ å‹å–„åœ°ç¬‘ä¸€å€‹å§ï¼' },
  { id: 8, icon: 'ðŸ®', name: 'é¦™æ»‘æŸ”å«©çš„è¥¿ç­ç‰™ç„¦ç³–çƒ¤å¸ƒä¸', nameEs: 'Flan Casero con Caramelo', desc: 'è»Ÿå«©ç´°ç·»çš„å¸ƒä¸æ·‹æ»¿ç„¦ç³–æ¼¿ï¼Œå…¥å£å³åŒ–ï¼Œç”œèœœåˆæº«æš–ã€‚' },
  { id: 9, icon: 'ðŸ¨', name: 'æŒ‘ä¸€çƒæœ€å–œæ­¡é¡è‰²çš„å†°æ·‡æ·‹', nameEs: 'Una Bola de Helado Artesanal', desc: 'èµ°é€²å†°æ·‡æ·‹åº—ï¼ŒæŒ‘ä¸€çƒä½ æœ€å–œæ­¡çš„å£å‘³ï¼ˆå·§å…‹åŠ›ã€è‰èŽ“æˆ–é–‹å¿ƒæžœï¼‰æ…¢æ…¢äº«ç”¨ï¼' },
  { id: 10, icon: 'ðŸ””', name: 'éœéœæ•¸å¤è€æ•™å ‚çš„é˜è²éŸ¿äº†å¹¾ä¸‹', nameEs: 'Contar las Campanadas de la Iglesia', desc: 'å™¹ï½žå™¹ï½žå™¹ï½žç•¶æ•™å ‚é˜è²éŸ¿èµ·æ™‚ï¼Œå…¨å®¶ä¸€èµ·åœä¸‹è…³æ­¥æ•¸æ•¸çœ‹æ•²äº†å¹¾éŸ¿ã€‚' },
  { id: 11, icon: 'ðŸ‡', name: 'ç”œç”œå¤šæ±çš„ç„¡ç±½ç¶ è‘¡è„', nameEs: 'Uvas Dulces sin Pepitas', desc: 'æ´—ä¸€ä¸²å†°æ¶¼é¦™ç”œçš„ç„¡ç±½ç¶ è‘¡è„ï¼Œæ¯å€‹äººæ‹¿ä¸€é¡†æ”¾åœ¨å˜´è£¡å’¬é–‹ï¼' },
  { id: 12, icon: 'ðŸ¥', name: 'é¦™é…¥å¯é Œé…æš–å‘¼å‘¼ç†±ç‰›å¥¶', nameEs: 'Croissant Caliente con Leche', desc: 'æ—©æ™¨åœ¨è¡—è§’å’–å•¡é¤¨ï¼Œçƒ¤å¾—é…¥è„†çš„å¯é Œæ’•ä¸€å¡Šæ³¡ä¸€ä¸‹ç†±ç‰›å¥¶ï¼Œæº«æš–ä½ çš„èƒƒã€‚' },
  { id: 13, icon: 'ðŸŒ°', name: 'å†¬å¤©è¡—è§’ç´™è¢‹è£çš„ç†±çƒ¤æ —å­', nameEs: 'CastaÃ±as Asadas Calientes', desc: 'è¡—é ­å¤§éµæ¡¶ç¢³ç«çƒ¤å‡ºä¾†çš„ç†±æ —å­ï¼Œç”¨ç´™è¢‹è£è‘—æ§åœ¨æ‰‹å¿ƒè£¡æš–æ‰‹åˆé¦™ç”œã€‚' },
  { id: 14, icon: 'ðŸ¥¨', name: 'è¥¿ç­ç‰™è„†è„†å°éº¥é¤…ä¹¾æ£’ (Picos)', nameEs: 'Picos Crujientes de Pan', desc: 'åƒç«è…¿æˆ–å‰èœæ™‚ä¸€å®šè¦é…çš„å°è„†æ£’ï¼Œå’¬ä¸‹åŽ»å¡æ»‹å¡æ»‹ç‰¹åˆ¥å¥½çŽ©ã€‚' },
  { id: 15, icon: 'ðŸ§ƒ', name: 'è¥¿ç­ç‰™åœ‹æ°‘å·§å…‹åŠ›å¥¶ (Cacaolat)', nameEs: 'Batido de Cacao Cacaolat', desc: 'çŽ»ç’ƒç“¶è£çš„åœ‹æ°‘å·§å…‹åŠ›ç‰›å¥¶ï¼Œç”œç”œæ¿ƒæ¿ƒï¼Œè¥¿ç­ç‰™å¤§äººå°å­©å¾žå°å–åˆ°å¤§ã€‚' },
  { id: 16, icon: 'ðŸ…', name: 'è„†çƒ¤éºµåŒ…æ“¦æ–°é®®ç•ªèŒ„æ©„æ¬–æ²¹', nameEs: 'Pan con Tomate y Aceite de Oliva', desc: 'ç¾çƒ¤é„‰æ‘éºµåŒ…ç”¨ç†Ÿç•ªèŒ„æ“¦ä¸Šç´…è‰²æžœè‚‰ï¼Œæ·‹é‡‘é»ƒæ©„æ¬–æ²¹æ’’ä¸Šæµ·é¹½ï¼Œç°¡å–®åˆæ¥µå“ï¼' },
  { id: 17, icon: 'ðŸ«’', name: 'å¤šæ±ç”œæ¤’é†ƒæ©„æ¬–å°ç¢Ÿ', nameEs: 'Aceitunas AliÃ±adas Suaves', desc: 'è¥¿ç­ç‰™æ¯å¼µé¤æ¡Œéƒ½æœƒå…ˆä¸Šçš„ä¸€å°ç¢Ÿé†ƒæ©„æ¬–ï¼Œå’¬é–‹æ»¿å˜´æ¸…é¦™ã€‚' },
  { id: 18, icon: 'ðŸ¥Ÿ', name: 'é…¥çš®åŠ åˆ©è¥¿äºžé®ªé­šè‚‰é¤¡é¤…', nameEs: 'Empanada Gallega de AtÃºn', desc: 'é‡‘é»ƒå¤–çš®è£¡é¢åŒ…è‘—ç•ªèŒ„ã€æ´‹è”¥èˆ‡é¦™æ¿ƒé®ªé­šé¤¡ï¼Œåˆ‡æˆå°å¡Šç•¶é»žå¿ƒæœ€éŽç™®ã€‚' },
  { id: 19, icon: 'ðŸ¥–', name: 'é¦™è„†ç¾ç‚¸é­·é­šåœˆä¸‰æ˜Žæ²»', nameEs: 'Bocadillo de Calamares Fritos', desc: 'é¦¬å¾·é‡Œè€åŸŽæœ€ç¶“å…¸çš„å¹³æ°‘ç¾Žé£Ÿï¼Œè„†çš®éºµåŒ…å¤¾è‘—æ»¿æ»¿ç¾ç‚¸ç†±é­·é­šåœˆã€‚' },
  { id: 20, icon: 'ðŸª', name: 'é¦™æ¿ƒè»Ÿç³¯æä»ç‰›è»‹ç³– (TurrÃ³n)', nameEs: 'TurrÃ³n Blando de Almendra', desc: 'è–èª•ç¯€å¿…å‚™å‚³çµ±ç”œé£Ÿï¼Œç ”ç£¨æä»æ³¥åŠ å…¥èœ‚èœœï¼Œæ¿ƒå¾—åƒèŠ±ç”Ÿç³–ä¸€æ¨£é¦™ã€‚' },
  { id: 21, icon: 'ðŸ§€', name: 'åˆ‡ç‰‡æ›¼å¾¹æ ¼ç¾Šä¹³é…ª (Queso)', nameEs: 'Queso Manchego Suave', desc: 'ä¾†è‡ªå ‚å‰è¨¶å¾·æ•…é„‰çš„å‚³å¥‡ä¹¾é…ªï¼Œå¾®é¹¹ä¸­å¸¶è‘—æ¿ƒéƒå¥¶é¦™ã€‚' },
  { id: 22, icon: 'ðŸŠ', name: 'å·§å…‹åŠ›ç„¡èŠ±æžœæ¾éœ²çƒ', nameEs: 'BombÃ³n de Higo y Chocolate', desc: 'æ•´é¡†åœ°ä¸­æµ·ä¹¾ç„¡èŠ±æžœåŒ…è£¹é¦™æ¿ƒæ¾éœ²å·§å…‹åŠ›ï¼Œå’¬ä¸‹åŽ»æœ‰é¡†ç²’å£æ„Ÿã€‚' },
  { id: 23, icon: 'ðŸ¥Ÿ', name: 'è»Ÿè“¬è“¬ç³–éœœå°ç‚¸æ³¡èŠ™ (BuÃ±uelos)', nameEs: 'BuÃ±uelos de Viento con AzÃºcar', desc: 'åœ“æ»¾æ»¾çš„å°æ³¡èŠ™ç‚¸å¾—é‡‘é»ƒå¾®è„†ï¼Œæ’’ä¸ŠåŽšåŽšç³–ç²‰ï¼Œä¸€å£ä¸€å€‹å‰›å‰›å¥½ã€‚' },
  { id: 24, icon: 'ðŸ‘‘', name: 'ä¸‰çŽ‹ç¯€åœ‹çŽ‹è›‹ç³• (RoscÃ³n de Reyes)', nameEs: 'PorciÃ³n de RoscÃ³n de Reyes', desc: 'å¤§å¤§çš„èŠ±ç’°éºµåŒ…å¤¾è‘—é®®å¥¶æ²¹ï¼Œå’¬å’¬çœ‹è£¡é¢æœ‰æ²’æœ‰è—è‘—å¹¸é‹å°åœ‹çŽ‹é™¶å¶ï¼' },
  { id: 25, icon: 'ðŸ®', name: 'åŠ æ³°éš†å°¼äºžç„¦ç³–è„†çš®çƒ¤å¸ƒè•¾', nameEs: 'Crema Catalana con Costra de AzÃºcar', desc: 'ç”¨éµç‰‡ç‡™å‡ºçŽ»ç’ƒèˆ¬ç„¦è„†çš„ç³–æ®¼ï¼Œç”¨å°æ¹¯åŒ™ã€Œå–€ã€ä¸€è²æ•²ç¢Žï¼Œé¦™è‰è‚‰æ¡‚å¥¶é¦™æ»¿æº¢ã€‚' },
  { id: 26, icon: 'ðŸµ', name: 'ä¸€æ¯æš–èƒƒçš„æ´‹ç”˜èŠèœ‚èœœç†±èŒ¶', nameEs: 'Manzanilla con Miel Calentita', desc: 'é€›ç´¯äº†é€²èŒ¶é¤¨å–ä¸€æ¯æº«ç†±çš„ç”˜èŠèŒ¶ï¼ŒåŠ ä¸€å°åŒ™è¥¿ç­ç‰™é‡Žç”Ÿèœ‚èœœã€‚' },
  { id: 27, icon: 'ðŸ¬', name: 'ä¸‰çŽ‹ç¯€å¤§éŠè¡Œæ¶åˆ°çš„æ°´æžœç³–', nameEs: 'Caramelo de la Cabalgata', desc: 'åœ¨éŠè¡ŒèŠ±è»Šä¸‹å€’æ’é›¨å‚˜æŽ¥åˆ°çš„å¹¸é‹ç³–æžœï¼Œæ”¾ä¸€é¡†åœ¨å˜´è£¡ç”œé€²å¿ƒåŽã€‚' },
  { id: 28, icon: 'ðŸ¥¨', name: 'åƒå±¤é¦™é…¥å°è´è¶é¤… (Palmeritas)', nameEs: 'Palmeritas de Hojaldre', desc: 'çƒ¤å¾—é…¥é¦™é€è–„çš„æ„›å¿ƒè´è¶é…¥ï¼Œå¤–é¢åˆ·ä¸€å±¤ç„¦ç³–è„†å…‰ã€‚' },
  { id: 29, icon: 'ðŸ§‡', name: 'è¡—é ­ç†±é¨°é¨°æ¯”åˆ©æ™‚ç³–ç²’é¬†é¤…', nameEs: 'Gofre Caliente con AzÃºcar Perlado', desc: 'ç†±å£“éµç›¤å‡ºçˆçš„é¬†é¤…ï¼Œå’¬å¾—åˆ°è„†è„†çš„çç ç³–ç²’ï¼Œé¦™é£„æ•´æ¢è¡—ã€‚' },
  { id: 30, icon: 'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§â€ðŸ‘¦', name: 'å…¨å®¶ 7 äººåœåœ¨ä¸€èµ·ç¬‘å˜»å˜»å¤§åˆç…§', nameEs: 'Foto Familiar de los 7 Sonriendo', desc: 'æ‰¾å€‹å¥½é¢¨æ™¯ï¼Œ7 å€‹äººæ“ åœ¨ä¸€èµ·å°è‘—é¡é ­å¤§å–Šã€ŒÂ¡Patata!ã€ï¼ˆæ‹ä¸‹æœ€æ£’çš„ç¬‘å®¹ï¼‰ï¼' }
];

/* ---------- 30 REGIONAL/CITY FLAGS & STORIES ---------- */
const FLAGS_LIST = [
  { id: 1, badge: 'ðŸ´ó ¥ó ³ó £ó ´ó ¿', city: 'å·´å¡žéš†ç´', title: 'è–ä½æ²»åå­—èˆ‡åŠ æ³°éš†å°¼äºžæ¢ç´‹', titleEs: 'Cruz de San Jorge y Cuatro Barras', story: 'ç´…åå­—æ˜¯å®ˆè­·è–äººè–ä½æ²»æ¨™èªŒï¼›å››é“ç´…ç´‹ç›¸å‚³æ˜¯è¥¿å…ƒ9ä¸–ç´€æ³•è˜­å…‹åœ‹çŽ‹å°‡å—å‚·ä¼¯çˆµçš„è¡€æŠ¹åœ¨é‡‘ç›¾ä¸Šçš„ç”±ä¾†ã€‚' },
  { id: 2, badge: 'ðŸ“', city: 'æ“´å»ºå€ (Eixample)', title: 'åˆ‡è§’åå­—è·¯å£å¹¾ä½•æ——', titleEs: 'Eixample y Manzanas Achaflanadas', story: 'å·¥ç¨‹å¸«å¡žçˆ¾é”é¦–å‰µå°‡è¡—è§’å‰Šåˆ‡45åº¦ï¼Œè®“é™½å…‰å’Œç©ºæ°£ç…§é€²æ¯é–“å·¥äººæˆ¿å±‹ï¼Œé–‹å‰µäº†ç¾ä»£éƒ½å¸‚è¦åŠƒã€‚' },
  { id: 3, badge: 'ðŸš©', city: 'åŠ æ³°éš†å°¼äºž', title: 'Senyera é‡‘é»ƒç´…ç´‹æ——', titleEs: 'La Senyera de CataluÃ±a', story: 'æ­æ´²æœ€å¤è€çš„æ——å¹Ÿä¹‹ä¸€ï¼Œæ­·ç¶“æ•¸ç™¾å¹´çµ±æ²»èˆ‡èªžè¨€å£“åˆ¶ï¼Œä¾ç„¶æ˜¯æ¯é€¢ä¹æœˆåä¸€æ—¥é™½å°ä¸Šå¿…æŽ›çš„é©•å‚²ç¬¦è™Ÿã€‚' },
  { id: 4, badge: 'âš“', city: 'å·´å¡žéš†ç´æ¸¯', title: 'åœ°ä¸­æµ·æµ·äº‹å°Žèˆªæ——', titleEs: 'PabellÃ³n MarÃ­timo de Barcelona', story: '1493å¹´å“¥å€«å¸ƒç¬¬ä¸€æ¬¡è‡ªç¾Žæ´²æ­¸ä¾†åœ¨æ­¤æ¸¯æŽ¥è¦‹å¤©ä¸»æ•™é›™çŽ‹ï¼Œæ¸¯å£é«˜æŸ±è‡³ä»Šä¾èˆŠå …å®šæŒ‡è‘—è”šè—å¤§æµ·ã€‚' },
  { id: 5, badge: 'ðŸ›ï¸', city: 'å‡±æ—‹é–€', title: 'ä¸–ç•Œåšè¦½æœƒè¿Žè³“ç´…ç£šå¾½', titleEs: 'Puerta de la ExposiciÃ³n de 1888', story: 'é€™åº§å‡±æ—‹é–€ä¸æ˜¯ç‚ºäº†æ…¶ç¥æˆ°çˆ­å± æ®ºï¼Œè€Œæ˜¯ä¸–ç•Œåšè¦½æœƒçš„å¤§é–€ï¼Œè±¡å¾µå·´å¡žéš†ç´å‘å…¨ä¸–ç•Œæ•žé–‹æ‡·æŠ±ã€‚' },
  { id: 6, badge: 'ðŸŒ³', city: 'è˜­å¸ƒæ‹‰å¤§é“', title: 'èˆŠæ²³é“è®Šèº«çš„èŠ±ç¥žæ——', titleEs: 'La Rambla de las Flores', story: 'Ramblaåœ¨é˜¿æ‹‰ä¼¯èªžæ„ç‚ºã€Œä¹¾æ¶¸æ²™æ²³ã€ï¼Œä¸­ä¸–ç´€æŽ’æ´ªçš„æºæ¸ ï¼Œå¦‚ä»Šæˆç‚ºå…¨çƒæœ€å…·ç”Ÿå‘½åŠ›çš„æ¼«æ­¥æž—è”­é“ã€‚' },
  { id: 7, badge: 'ðŸŽ°', city: 'è–èª•å¤§æ¨‚é€', title: 'åŠ çš„æ–¯å¸Œæœ›é‡‘å¹£æ——', titleEs: 'El Gordo y la LoterÃ­a de 1812', story: '1812å¹´è¥¿ç­ç‰™æŠ—æ“Šæ‹¿ç ´å´™æˆ°çˆ­æ™‚èª•ç”Ÿï¼Œé€™æ˜¯ä¸€å ´ã€Œè‡ªé¡˜ç¹³ç´çš„ç¨…ã€ï¼Œè®“å…¨åœ‹è¡—åŠé„°å±…ä¸€èµ·åˆ†äº«å¥½é‹ã€‚' },
  { id: 8, badge: 'â›µ', city: 'æ³•åœ‹é¦¬è³½', title: 'å¤©è—åå­—åå­—è»æ¸¯æ——', titleEs: 'Cruz Azur de Marsella', story: 'ç´”æ½”ç™½åº•é…ä¸Šä¸€æŠ¹å¤©è—è‰²åå­—ï¼Œæºè‡ª11ä¸–ç´€åå­—è»æ±å¾æ™‚æœŸè‰¦éšŠå¾žé€™å€‹åœ°ä¸­æµ·å¤æ¸¯æšå¸†çš„å¾½è¨˜ã€‚' },
  { id: 9, badge: 'ðŸ¦', city: 'ç¾©å¤§åˆ©ç†±é‚£äºž', title: 'è–å–¬æ²»ç´…åå­—æµ·ä¸Šéœ¸çŽ‹æ——', titleEs: 'Bandera de San Giorgio (GÃ©nova)', story: 'æ›¾å¨éœ‡åœ°ä¸­æµ·çš„æµ·ä¸Šå…±å’Œåœ‹ï¼Œé€£è‹±åœ‹æµ·è»ç‚ºäº†å€Ÿç”¨å…¶å¨åé¿é–‹æµ·ç›œï¼Œéƒ½æ›¾å¹´å¹´å‘ç†±é‚£äºžä»˜ç§Ÿæ——è²»ã€‚' },
  { id: 10, badge: 'ðŸŒ‹', city: 'ç¾©å¤§åˆ©é‚£ä¸å‹’æ–¯', title: 'ç¶­è˜‡å¨é‡‘é»ƒèˆ‡ç·‹ç´…é›™è‰²æ——', titleEs: 'Oro y Gules de NÃ¡poles', story: 'ä»£è¡¨ç«å±±çƒˆç«ã€é™½å…‰æµ·å²¸èˆ‡å¤è€æ³¢æ—çŽ‹å®¤ï¼Œé‚£ä¸å‹’æ–¯çš„é¡è‰²åƒç™¾å¹´ä¾†å§‹çµ‚å¦‚æ­Œè²èˆ¬å¥”æ”¾ç†±çƒˆã€‚' },
  { id: 11, badge: 'ðŸ¦µ', city: 'è¥¿è¥¿é‡Œå·´å‹’æ‘©', title: 'ä¸‰æ›²è…¿ç¾ŽæœèŽŽç¥žè–ä¸‰èŠ’æ——', titleEs: 'Trinacria de Sicilia', story: 'ä¸­å¤®æ˜¯è›‡é«®ç¾ŽæœèŽŽé ­åƒï¼Œæ”¾å°„å‡ºä¸‰æ¢å¥”é¦³çš„äººè…¿ï¼Œè±¡å¾µè¥¿è¥¿é‡Œå³¶ä¸‰å€‹æµ·è§’äº¤åŒ¯çš„åƒå¹´å¤å¸Œè‡˜ç¬¦è™Ÿã€‚' },
  { id: 12, badge: 'ðŸŒ™', city: 'çªå°¼è¥¿äºž', title: 'è¿¦å¤ªåŸºç´…åº•ç™½æ–°æœˆäº”æ˜Ÿæ——', titleEs: 'Media Luna y Estrella de TÃºnez', story: 'å‚³æ‰¿è¿¦å¤ªåŸºå¸åœ‹çš„æ¦®å…‰èˆ‡é„‚åœ–æ›¼åœ°ä¸­æµ·æµ·æ¬Šçš„è¨˜æ†¶ï¼Œç´…åº•è±¡å¾µæè¡›ç¨ç«‹çš„å‹‡æ°£ï¼Œç™½æœˆè±¡å¾µå’Œå¹³ã€‚' },
  { id: 13, badge: 'ðŸš¢', city: 'åœ°ä¸­æµ·å·¡èˆª', title: 'æµ·å¹³ç·šèˆªæµ·å®¶é›™å…­åˆ†å„€å¾½', titleEs: 'Rosa de los Vientos del MediterrÃ¡neo', story: 'åœ°ä¸­æµ·å­•è‚²äº†å¤å¸Œè‡˜ã€ç¾…é¦¬èˆ‡é˜¿æ‹‰ä¼¯æ–‡æ˜Žï¼Œåœ¨ç„¡åž æµ·æµªä¸Šçœ‹å¤•é™½ï¼Œæ˜¯å…¨å®¶æœ€å®‰è©³çš„å†’éšªæ™‚åˆ»ã€‚' },
  { id: 14, badge: 'ðŸ°', city: 'è’™ç‰¹æƒ å…‹å±±', title: 'çŒ¶å¤ªå±±è¦å¡žä¿¯çž°åŸŽæ——', titleEs: 'BastiÃ³n de MontjuÃ¯c', story: 'çŸ—ç«‹æµ·è§’çš„åˆ¶é«˜é»žï¼Œæ›¾è¦‹è­‰å…§æˆ°çƒ½ç«èˆ‡1992å·´å¡žéš†ç´å¥§é‹çš„é»žç«å°„ç®­ç¥žè¹Ÿã€‚' },
  { id: 15, badge: 'ðŸ›ï¸', city: 'å“¥å¾·å€', title: 'å¥§å¤æ–¯éƒ½ç¾…é¦¬çŸ³æŸ±è€å¾½', titleEs: 'Barcino Romana', story: 'éš±èº«åœ¨å°å··æ°‘å®…ä¸­å››æ ¹å…©åƒå¹´ç¾…é¦¬ç¥žå»Ÿåœ“æŸ±ï¼Œé»˜é»˜çœ‹è‘—å·´å¡žéš†ç´å¾žç¾…é¦¬æ®–æ°‘æ‘æ¼”è®Šæˆä¸–ç•Œéƒ½æœƒã€‚' },
  { id: 16, badge: 'ðŸŽ—ï¸', city: 'å¡žç¶­äºž', title: 'NO8DO å‚³å¥‡å¿ èª ç¹©çµç´‹ç« ', titleEs: 'Emblema NO8DO de Sevilla', story: 'ä¸­é–“æ˜¯ç¾Šæ¯›ç·šçµï¼ˆmadejaï¼‰ï¼Œè®€éŸ³No-madeja-doï¼ˆå¥¹æœªæ›¾æ£„æˆ‘è€ŒåŽ»ï¼‰ï¼Œåœ‹çŽ‹æ„Ÿå¿µå¡žç¶­äºžå¿ å¿ƒçš„æš—è™Ÿï¼' },
  { id: 17, badge: 'ðŸ—¼', city: 'å¡žç¶­äºžå¤§æ•™å ‚', title: 'å‰æ‹‰é”é’éŠ…å‘½é‹å¥³ç¥žé¢¨å‘æ——', titleEs: 'La Giralda y el Giraldillo', story: 'åŽŸæœ¬æ˜¯ç©†æ–¯æž—å–šæ‹œæ¨“çš„æ–œå¡ä¾›é¨Žé¦¬ä¸Šé ‚ï¼Œé ‚ç«¯å¦‚ä»Šç«‹è‘—è±¡å¾µä¿¡ä»°å‹åˆ©çš„é’éŠ…é¢¨å‘å¥³ç¥žå·¨é›•ã€‚' },
  { id: 18, badge: 'ðŸŠ', city: 'å®‰é”é­¯è¥¿äºžå¹³å®‰å¤œ', title: 'å†¬æ—¥è‹¦æ©™èˆ‡ä½›æœ—æ˜Žå“¥ç´…æ——', titleEs: 'Azahar y Guitarra de Nochebuena', story: 'å¡žç¶­äºžè¡—é ­ä¸Šè¬æ ªçµæ»¿é‡‘é»ƒè‹¦æ©™çš„æžœæ¨¹ï¼Œåœ¨å¹³å®‰å¤œæ•™å ‚å½Œæ’’é˜è²ä¸‹æ•£ç™¼å®‰é”é­¯è¥¿äºžç¨æœ‰çš„é¦™æ°£ã€‚' },
  { id: 19, badge: 'ðŸŒŠ', city: 'ç“œé”å¹¾ç¶­æ²³', title: 'éº¥å“²å€«ç’°çƒèˆªè¡Œé»ƒé‡‘å¡”æ——', titleEs: 'RÃ­o Guadalquivir y Torre del Oro', story: '1519å¹´éº¥å“²å€«è‰¦éšŠå°±æ˜¯å¾žé€™æ¢æ²³è§£çºœå•Ÿç¨‹ï¼Œé–‹å±•äººé¡žå²ä¸Šç¬¬ä¸€æ¬¡ç’°çƒé èˆªçš„å£¯èˆ‰ã€‚' },
  { id: 20, badge: 'â›°ï¸', city: 'ç“œè¿ªæ–¯ (Guadix)', title: 'ç´…åœŸé«˜åŽŸç™½ç…™å›ªçª¯æ´žä¹‹å¾½', titleEs: 'Casas Cueva y Badlands de Guadix', story: 'é€™ç‰‡å¤§åœ°å¦‚åƒç˜¡ç™¾å­”çš„æœˆçƒè¡¨é¢ï¼Œåƒç™¾å¹´ä¾†äººå€‘é‘¿æ´žè€Œå±…ï¼Œå†¬æš–å¤æ¶¼å¸¸å¹´ä¿æŒ18åº¦æ†æº«ã€‚' },
  { id: 21, badge: 'ðŸ’', city: 'æ ¼æ‹‰é‚£é”', title: 'æˆç†Ÿé–‹è£‚ç´…çŸ³æ¦´å¸‚æ——', titleEs: 'La Granada Abierta', story: 'è¥¿ç­ç‰™èªžGranadaå°±æ˜¯ã€ŒçŸ³æ¦´ã€ï¼Œæˆç†Ÿç¶»æ”¾çš„çŸ³æ¦´ä»£è¡¨ä¼Šæ¯”åˆ©åŠå³¶æœ€å¾Œä¸€é¡†æ”¶å¾©çš„ä¼Šæ–¯è˜­æ˜Žç ã€‚' },
  { id: 22, badge: 'ðŸ•Œ', city: 'é˜¿çˆ¾ç½•å¸ƒæ‹‰å®®', title: 'æ¡ƒé‡‘å­ƒæ°´æ± ç©†æ–¯æž—å¹¾ä½•ç´…å¾½', titleEs: 'Al-Hamra la Roja', story: 'é˜¿æ‹‰ä¼¯èªžæ„ç‚ºã€Œç´…è‰²åŸŽå ¡ã€ï¼Œç²¾ç·»å¦‚è•¾çµ²çš„çŸ³è†ç°æ³¥é›•èŠ±ï¼Œè¦‹è­‰äº†å¥ˆæ–¯çˆ¾çŽ‹æœæœ€å¾Œçš„è©©æ„è¼“æ­Œã€‚' },
  { id: 23, badge: 'ðŸ¦', city: 'å“¥å¤šè¯', title: 'ç¶ ç™½ç›¸é–“ä¹‹ä¸Šçš„æ˜‚é¦–ç´…ç…', titleEs: 'LeÃ³n Rampante de CÃ³rdoba', story: 'å®‰é”é­¯è¥¿äºžçš„ç¶ ç™½æ——å¹Ÿæºè‡ªå’Œå¹³èˆ‡å¸Œæœ›ï¼Œæ˜‚é¦–å’†å“®çš„ç´…ç…å‰‡æ˜¯ä¸­ä¸–ç´€æŠµæŠ—é¢¨éœœçš„è‹±å‹‡å®ˆè¡›ã€‚' },
  { id: 24, badge: 'â›©ï¸', city: 'å“¥å¤šè¯æ¸…çœŸå¯º', title: 'ç´…ç™½é›™å±¤é¦¬è¹„çŸ³æ‹±ä¹‹å°', titleEs: 'Arcos Bicolores de la Mezquita', story: '856æ ¹å¤§ç†çŸ³æŸ±é ‚èµ·ç´…ç™½ç›¸é–“çš„é›™å±¤æ‹±åˆ¸ï¼Œåœ¨åŸºç£æ•™å ‚åµŒå…¥å…¶ä¸­å¾Œï¼Œæˆç‚ºå…¨ä¸–ç•Œç¨ä¸€ç„¡äºŒçš„æ–‡æ˜Žäº¤éŸ¿æ›²ã€‚' },
  { id: 25, badge: 'ðŸ»', city: 'é¦¬å¾·é‡Œ', title: 'é»‘ç†ŠæŠ±é‡Žè‰èŽ“æ¨¹èˆ‡å¤§ç†Šä¸ƒæ˜Ÿæ——', titleEs: 'El Oso y el MadroÃ±o con 7 Estrellas', story: 'æ·±ç´…åº•è‰²ä¸Šæœ‰å¤§ç†Šåº§ä¸ƒé¡†éŠ€æ˜Ÿï¼Œä¸­é–“ä¸€éš»ç«™ç«‹æ“æŠ±é‡Žè‰èŽ“æ¨¹çš„é»‘ç†Šï¼Œæ˜¯é¦¬å¾·é‡Œ700å¹´çš„å‰ç¥¥è±¡å¾µã€‚' },
  { id: 26, badge: 'ðŸŽ¨', city: 'æ™®æ‹‰å¤šç¾Žè¡“é¤¨', title: 'å®®å»·ç•«å®¶å§”æ‹‰æ–¯è“‹èŒ²é‡‘å† æ——', titleEs: 'Las Meninas de VelÃ¡zquez', story: 'ã€Šä¾å¥³ã€‹ç•«ä¸­ç•«å®¶èƒ¸å‰ä½©æˆ´çš„ç´…è‰²åå­—é¨Žå£«å¾½ç« ï¼Œæ˜¯è¥¿ç­ç‰™è—è¡“èµ°é€²ä¸–ç•Œé¡›å³°çš„é‡‘è‰²å† å†•ã€‚' },
  { id: 27, badge: 'ðŸ›ï¸', city: 'å¡žå“¥ç¶­äºž', title: 'ç¾…é¦¬è¬å¹´èŠ±å´—å²©æ°´é“æ©‹å¾½', titleEs: 'Acueducto Imperial de Segovia', story: '20,400å¡ŠèŠ±å´—å²©ä¸ç”¨ä¸€æ»´æ°´æ³¥ï¼Œé åŠ›å­¸å®Œç¾Žå’¬åˆå…©åƒå¹´ï¼Œè‡³ä»Šä¾ç„¶é©•å‚²æ©«è·¨åœ¨å°éŽ®å»£å ´ä¸Šã€‚' },
  { id: 28, badge: 'âš”ï¸', city: 'æ‰˜é›·å¤š', title: 'æŸ¥ç†äº”ä¸–é›™é ­é‡‘é·¹å¸åœ‹ç›¾', titleEs: 'Ãguila BicÃ©fala Imperial de Toledo', story: 'ä¸‰æ–‡åŒ–å…±å­˜çš„å¤éƒ½ï¼Œå¤§é¦¬å£«é©é‡‘çµ²é‹¼åŠå‰Šéµå¦‚æ³¥ï¼Œé›™é ­é·¹è±¡å¾µæ±æ–¹èˆ‡è¥¿æ–¹æ¬ŠåŠ›ä¸€é«”å…©é¢ã€‚' },
  { id: 29, badge: 'ðŸ‘‘', city: 'è¥¿ç­ç‰™çŽ‹å®®', title: 'æ³¢æ—çŽ‹æœç™½ç™¾åˆèˆ‡çš‡å®¶å…µå™¨æ——', titleEs: 'Flor de Lis del Palacio Real', story: 'æ­æ´²æœ€å¤§çš„ç¾å­˜çŽ‹å®®ä¹‹ä¸€ï¼Œæ“æœ‰3,418é–“æˆ¿é–“ï¼Œçš‡å®¶å…µå™¨åº«æ”¶è—äº†ç¥žè–ç¾…é¦¬å¸åœ‹æŸ¥ç†äº”ä¸–çš„ç²¾é‹¼æˆ°ç”²ã€‚' },
  { id: 30, badge: 'â­', city: 'ä¸‰çŽ‹ç¯€ (Reyes Magos)', title: 'æ±æ–¹ä¸‰åšå£«ä¼¯åˆ©æ†ä¹‹æ˜Ÿæ——', titleEs: 'Estrella de Oriente de los Reyes', story: '1æœˆ5æ—¥å¤œæ™šå…¨è¥¿ç­ç‰™ä¸å¤œä¹‹åŸŽï¼ä¸‰ä½åœ‹çŽ‹é¨Žè‘—é«˜é ­é§¿é¦¬ç‘ä¸‹ç”œç”œç³–æžœï¼Œé–‹å•Ÿæ–°ä¸€å¹´çš„å¹³å®‰èˆ‡å¹¸ç¦ã€‚' }
];

/* ---------- 30 POKEDEX COLLECTIBLES (æ—…è¡Œå¤§åœ–é‘‘) ---------- */
const POKEDEX_ITEMS = [
  { id: 1, icon: 'ðŸ¥“', name: 'ä¼Šæ¯”åˆ©å¤§ç«è…¿æž¶', nameEs: 'JamÃ³n IbÃ©rico en Jamonero', desc: 'åœ¨ç†Ÿé£Ÿåº—æˆ–é¤å»³æ‹åˆ°ä¸€æ•´éš»å¸¶è¹„çš„é»‘è¹„ç«è…¿æž¶ã€‚' },
  { id: 2, icon: 'ðŸ¥–', name: 'å‰æ‹¿æ£’é…ç†±å·§å…‹åŠ›', nameEs: 'Churros con Chocolate', desc: 'æ‹ä¸€å¼µæ²¾æ»¿æ¿ƒé»‘å·§å…‹åŠ›çš„é‡‘é»ƒå‰æ‹¿æ£’ã€‚' },
  { id: 3, icon: 'ðŸ¦Ž', name: 'é«˜ç¬¬å½©è‰²é¦¬è³½å…‹èœ¥èœ´', nameEs: 'DragÃ³n de GaudÃ­', desc: 'æ¡‚çˆ¾å…¬åœ’æˆ–ç´€å¿µå“åº—è£¡çš„å½©è‰²ç¢Žç“·èœ¥èœ´ï¼ˆè ‘èžˆï¼‰ã€‚' },
  { id: 4, icon: 'ðŸªµ', name: 'æˆ´ç´…å¸½çš„ Caga TiÃ³ æœ¨é ­', nameEs: 'TiÃ³ de Nadal (Caga TiÃ³)', desc: 'ç•«è‘—å¾®ç¬‘å¤§çœ¼ç›ã€æˆ´è‘—åŠ æ³°éš†å°¼äºžç´…å¸½å­çš„å°æœ¨é ­ã€‚' },
  { id: 5, icon: 'ðŸ’©', name: 'è¹²åœ¨è§’è½çš„å¤§ä¾¿é™¶å¶ (Caganer)', nameEs: 'Caganer del BelÃ©n', desc: 'è–èª•é¦¬æ§½å¸‚é›†è£¡è¹²è‘—å¤§ä¾¿çš„å¹½é»˜å°é™¶å¶ã€‚' },
  { id: 6, icon: 'ðŸªŸ', name: 'é›•èŠ±å½©è‰²éµé‘„é™½å°', nameEs: 'BalcÃ³n de Hierro Forjado', desc: 'è€è¡—å…©æ—è£é£¾è‘—èŠ±è‰æ²ç´‹çš„é»‘è‰²æˆ–å½©ç¹ªéµé™½å°ã€‚' },
  { id: 7, icon: 'ðŸš“', name: 'è¥¿ç­ç‰™è­¦è»Šæˆ–è­¦ç”¨æ©Ÿè»Š', nameEs: 'PolicÃ­a Nacional / Guardia Civil', desc: 'è—ç™½æˆ–ç¶ ç™½ç›¸é–“ã€å¯«è‘— PolicÃ­a çš„é…·ç‚«è­¦è»Šã€‚' },
  { id: 8, icon: 'ðŸ•Šï¸', name: 'åœ°ä¸­æµ·æ¸¯å£é£›ç¿”æµ·é·—', nameEs: 'Gaviota MediterrÃ¡nea', desc: 'åœ¨æ¸¯é‚Šã€éƒµè¼ªæ¬„æ†ä¸Šç«™è‘—æˆ–ç©ºä¸­æ»‘ç¿”çš„å¤§æµ·é·—ã€‚' },
  { id: 9, icon: 'ðŸ›ï¸', name: 'å¡žå“¥ç¶­äºžç¾…é¦¬æ°´é“æ©‹', nameEs: 'Acueducto Romano de Segovia', desc: 'ä¸ç”¨æ°´æ³¥ç Œæˆçš„é›™å±¤å¤ç¾…é¦¬èŠ±å´—å²©é«˜å¤§æ‹±é–€ã€‚' },
  { id: 10, icon: 'ðŸ°', name: 'é˜¿çˆ¾å¡è–©è¿ªå£«å°¼åŸŽå ¡', nameEs: 'AlcÃ¡zar de Segovia', desc: 'åƒä¸€è‰˜èˆ¹è‰¦èˆ¬èˆªè¡Œåœ¨æ‡¸å´–ä¸Šçš„å°–å¡”ç«¥è©±åŸŽå ¡ã€‚' },
  { id: 11, icon: 'âš”ï¸', name: 'æ‰˜é›·å¤šå¤§é¦¬å£«é©é‡‘çµ²é‹¼åŠ', nameEs: 'Espada de Acero de Toledo', desc: 'åº—è£¡é–ƒé–ƒç™¼å…‰ã€é‘²åµŒç´°ç·»é‡‘ç·šèŠ±ç´‹çš„ç²¾å·¥å¯¶åŠã€‚' },
  { id: 12, icon: 'ðŸ¥˜', name: 'å·¨å¤§çš„è¥¿ç­ç‰™æµ·é®®ç‡‰é£¯é‹', nameEs: 'Paellera Gigante con Arroz', desc: 'å¤§å¤§çš„é›™è€³å¹³åº•å¹³é‹ï¼Œç››è£è‘—é‡‘é»ƒç•ªç´…èŠ±ç±³é£¯ã€‚' },
  { id: 13, icon: 'ðŸ³', name: 'åŽšåˆ‡è¥¿ç­ç‰™é¦¬éˆ´è–¯çƒ˜è›‹', nameEs: 'Pincho de Tortilla EspaÃ±ola', desc: 'é…’å§å§å°ä¸Šåˆ‡å¾—æ–¹æ–¹æ­£æ­£ã€é‡‘é»ƒèª˜äººçš„åŽšçƒ˜è›‹ã€‚' },
  { id: 14, icon: 'ðŸŠ', name: 'è¡—é‚Šçµæ»¿æžœå¯¦çš„æ©˜å­æ¨¹', nameEs: 'Naranjos Cargados de Fruta', desc: 'ç¶ è‘‰é–“æŽ›æ»¿ä¸€é¡†é¡†æ©™é»ƒè‰²æžœå¯¦çš„å®‰é”é­¯è¥¿äºžè¡—æ¨¹ã€‚' },
  { id: 15, icon: 'ðŸ’ƒ', name: 'ä½›æœ—æ˜Žå“¥ç´…é»‘è·è‘‰å¤§é•·è£™', nameEs: 'Vestido de Flamenca', desc: 'åº—æ«¥çª—è£¡æˆ–èˆžè€…èº«ä¸Šå±¤å±¤ç–Šç–Šçš„æ³¢æµªè·è‘‰è£™ã€‚' },
  { id: 16, icon: 'ðŸ·', name: 'èµ«é›·æ–¯é›ªèŽ‰é…’è€æ©¡æœ¨æ¡¶', nameEs: 'Barril de Jerez / TÃ­o Pepe', desc: 'é…’å§è§’è½åˆ»æœ‰ç™½è‰²æ‰‹å¯«å­—æ¨£çš„å¤§é…’æ¡¶ã€‚' },
  { id: 17, icon: 'ðŸº', name: 'å®‰é”é­¯è¥¿äºžå½©ç¹ªå¹¾ä½•ç£ç£š', nameEs: 'Azulejos Andaluces', desc: 'ç‰†é¢ä¸Šç¹ªæœ‰è—ç¶ é»ƒä¸‰è‰²ç¹è¤‡èŠ±ç´‹çš„è¥¿ç­ç‰™ç£ç£šã€‚' },
  { id: 18, icon: 'â›°ï¸', name: 'ç“œè¿ªæ–¯ç™½è‰²ç…™å›ªçª¯æ´žå±‹', nameEs: 'Casas Cueva con Chimenea Blanca', desc: 'å¾žå±±å¡åœŸä¸˜è£¡é‘½å‡ºä¾†çš„ä¸€æ”¯æ”¯é›ªç™½åœ“å½¢ç…™å›ªã€‚' },
  { id: 19, icon: 'ðŸ°', name: 'é˜¿çˆ¾ç½•å¸ƒæ‹‰å®®å¹¾ä½•é¦¬è¹„æ‹±', nameEs: 'Arco NazarÃ­ de la Alhambra', desc: 'ç²¾ç·»å¾—åƒè•¾çµ²èŠ±é‚Šä¸€æ¨£çš„ä¼Šæ–¯è˜­çŸ³è†é›•åˆ»æ‹±é–€ã€‚' },
  { id: 20, icon: 'ðŸ›ï¸', name: 'å“¥å¤šè¯æ¸…çœŸå¯ºç´…ç™½é›™å±¤çŸ³æ‹±', nameEs: 'Arcos Bicolores de la Mezquita', desc: 'åƒæ£®æž—ä¸€æ¨£ç¶¿å»¶ä¸çµ•çš„ç´…ç£šèˆ‡ç™½çŸ³äº¤æ›¿æ‹±é–€ã€‚' },
  { id: 21, icon: 'ðŸ‡', name: 'è·¨å¹´å¤œ 12 é¡†é’è‘¡è„ç½æˆ–ç›¤', nameEs: '12 Uvas de la Suerte', desc: 'è¶…å¸‚è³£çš„å°ç½è£ 12 é¡†é–‹é‹è‘¡è„æˆ–å…¨å®¶åˆ†å¥½çš„ç›¤å­ã€‚' },
  { id: 22, icon: 'ðŸ‘‘', name: 'åœ“åœˆå½¢ä¸‰çŽ‹ç¯€åœ‹çŽ‹è›‹ç³•', nameEs: 'RoscÃ³n de Reyes con Frutas', desc: 'é»žç¶´è‘—ç´…ç¶ ç³–æ¼¬æ°´æžœä¹¾çš„å¤§èŠ±ç’°è›‹ç³•èˆ‡ç´™çš‡å† ã€‚' },
  { id: 23, icon: 'ðŸ¬', name: 'ä¸‰çŽ‹ç¯€éŠè¡Œæ¶åˆ°çš„å½©è‰²ç³–æžœ', nameEs: 'Caramelos de la Cabalgata', desc: 'å¾žéŠè¡ŒèŠ±è»Šä¸Šç©ºå¦‚é›¨èˆ¬è½ä¸‹çš„å„è‰²åŒ…è£ç³–æžœã€‚' },
  { id: 24, icon: 'ðŸ»', name: 'é¦¬å¾·é‡ŒæŠ±é‡Žè‰èŽ“æ¨¹çš„é»‘ç†Šé›•åƒ', nameEs: 'Estatua del Oso y el MadroÃ±o', desc: 'å¤ªé™½é–€å»£å ´ä¸Šç«™è‘—å•ƒè‰èŽ“æ¨¹çš„é’éŠ…å°é»‘ç†Šã€‚' },
  { id: 25, icon: 'ðŸŽ¨', name: 'æ™®æ‹‰å¤šåšç‰©é¤¨å‰çš„å®®å»·ç•«å®¶é›•åƒ', nameEs: 'Estatua de VelÃ¡zquez', desc: 'æ‹¿è‘—èª¿è‰²ç›¤å’Œç•«ç­†ååœ¨æ™®æ‹‰å¤šå¤§é–€å‰çš„å¤å…¸é›•åƒã€‚' },
  { id: 26, icon: 'â˜•', name: 'ç™¾å¹´è€å’–å•¡é¤¨ç´…è‰²æˆ¶å¤–é›¨æ£š', nameEs: 'Terraza de CafÃ© Castizo', desc: 'è·¯é‚Šæ“ºè‘—è—¤æ¤…ã€æ­è‘—å¾©å¤ç´…è‰²é›¨æ£šçš„æˆ¶å¤–éœ²å¤©åº§ã€‚' },
  { id: 27, icon: 'ðŸš‹', name: 'é¦¬å¾·é‡Œè€åœ°éµç´…ç™½è±å½¢ç«™ç‰Œ', nameEs: 'Rombos del Metro de Madrid', desc: 'è¡—è§’å…¥å£è™•å¯«è‘— METRO çš„ç¶“å…¸ç´…ç™½è—è±å½¢ç«‹ç‰Œã€‚' },
  { id: 28, icon: 'ðŸŒ°', name: 'è¡—é ­ç…™éœ§ç¹šç¹žçš„ç†±çƒ¤æ —å­æ”¤', nameEs: 'Puesto de CastaÃ±as Asadas', desc: 'å†’è‘—ç™½ç…™ã€é£„è‘—ç‚­çƒ¤ç„¦é¦™çš„å†¬å¤©è·¯é‚Šå°ç«çˆã€‚' },
  { id: 29, icon: 'ðŸš¢', name: 'åœ°ä¸­æµ·éƒµè¼ªç”²æ¿çš„è½æ—¥æµ·å¹³ç·š', nameEs: 'Atardecer en Cubierta del Barco', desc: 'ç«™åœ¨å¤§èˆ¹ç”²æ¿ä¸Šï¼Œçœ‹è‘—é‡‘ç´…è‰²å¤•é™½æ…¢æ…¢æ²ˆå…¥å¤§æµ·ã€‚' },
  { id: 30, icon: 'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§â€ðŸ‘¦', name: 'å…¨å®¶ 7 äººå…¨å“¡åˆ°é½Šçš„ç‡¦çˆ›ç¬‘å®¹', nameEs: 'Foto Familiar de los 7', desc: 'æˆ‘å€‘å…¨å®¶äººåœ¨è¥¿ç­ç‰™æ—…é€”ä¸­çš„å¤§åˆç…§ï¼' }
];

/* ---------- onboarding ---------- */
route('/onboard', () => {
  view(`<h1>${t('appName')}</h1>
    <p class="sub">${S.lang === 'es' ? 'Introduce tu nombre o apodo' : 'è¼¸å…¥ä½ çš„åå­—ï¼ˆä¸­è‹±æ–‡ã€æš±ç¨±çš†å¯ï¼‰'}</p>
    <label class="field"><span>${S.lang === 'es' ? 'Tu nombre' : 'ä½ çš„åå­—'}</span><input class="text" id="nm" autocomplete="name" value="${esc(S.player)}"></label>
    <p class="section-label">${S.lang === 'es' ? 'Dificultad de preguntas' : 'é¡Œç›®é›£åº¦'}</p>
    <div class="pill-switch" id="md"><button type="button" data-m="basic">${S.lang === 'es' ? 'BÃ¡sico' : 'åˆéšŽç‰ˆ'}</button><button type="button" data-m="challenge">${S.lang === 'es' ? 'Reto' : 'æˆ‘è¦æŒ‘æˆ°'}</button></div>
    <button class="btn block" id="go" style="margin-top:16px">${S.lang === 'es' ? 'Â¡Empezamos el viaje!' : 'æˆ‘å€‘å‡ºç™¼å›‰ï¼'}</button>`);
  let mode = S.mode;
  const paint = () => $$('#md button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  paint();
  $$('#md button').forEach((b) => b.onclick = () => { mode = b.dataset.m; paint(); });
  $('#go').onclick = () => {
    const n = $('#nm').value.trim();
    if (!n) { toast(S.lang === 'es' ? 'Por favor introduce tu nombre' : 'è«‹å…ˆè¼¸å…¥åå­—'); return; }
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
  const tToday = today();
  const tc = todayCard();
  const isEs = S.lang === 'es';
  let hero = '';
  if (tc) {
    hero = `<div class="hero"><div class="sub">${t('todayUnlocked')}</div><h2 style="margin:4px 0 12px">${esc(CITY[tc.city].name)}ãƒ»${esc(tc.title)}</h2>
      <a class="btn block" href="#/card/${tc.id}">${isEs ? 'Abrir Tarjeta de Hoy' : 'æ‰“é–‹ä»Šå¤©çš„åŸŽå¸‚å¡'}</a></div>`;
  } else if (tToday < TRIP_START) {
    const days = Math.ceil((new Date(TRIP_START) - new Date(tToday)) / 86400000);
    hero = `<div class="hero"><div class="sub">${t('daysLeft')}</div><div class="big-num">${days} ${t('days')}</div>
      <p style="margin:8px 0 0">${isEs ? 'Las tarjetas de ciudad se desbloquean cada maÃ±ana. Puedes activar "Previsualizar todo" en Perfil.' : 'åŸŽå¸‚å¡æœƒåœ¨ç•¶å¤©æ—©ä¸Šè§£éŽ–ã€‚æƒ³å…ˆçœ‹çœ‹ï¼Œå¯ä»¥åˆ°ã€Œæˆ‘çš„ã€æ‰“é–‹ã€Œé è¦½å…¨éƒ¨ã€ã€‚'}</p></div>`;
  } else if (tToday > TRIP_END) {
    hero = `<div class="hero"><h2 style="margin:0 0 8px">${isEs ? 'El viaje ha finalizado' : 'æ—…ç¨‹çµæŸäº†'}</h2><p style="margin:0">${isEs ? 'Consulta el rÃ¡nking familiar y todos los collages.' : 'åˆ°ã€ŒæŽ’è¡Œã€çœ‹çœ‹å…¨å®¶çš„ç¸½åˆ†å’Œæ‰€æœ‰ä¹å®®æ ¼ã€‚'}</p></div>`;
  }

  const tiles = C.cities.map((c) => `<a class="city-tile" href="#/city/${c.id}"><b>${esc(c.name)}</b>
    <span>${t('cityCardSub').replace('{c}', c.cityCards.length).replace('{s}', c.spots.length)}</span></a>`).join('');

  // Milestone Progress
  const curSteps = S.familySteps;
  const pct = Math.min(100, Math.round((curSteps / 300000) * 100));

  view(`<div class="sub">${esc(S.player)}${t('welcome')}</div><h1>${t('appName')}</h1><p class="sub">${t('subTitle')}</p>${hero}
    
    <!-- æ¯æ—¥ç¾Žå‘³ Tapa åˆ®åˆ®æ¨‚æ·å¾‘å¡ -->
    <a class="card" href="#/tapa" style="display:flex;align-items:center;gap:14px;text-decoration:none;border-left:4px solid var(--warn);margin-bottom:14px">
      <div style="font-size:36px">ðŸ¢</div>
      <div style="flex:1">
        <b style="color:var(--fg);font-size:17px">${t('tapaTitle')}</b>
        <p class="sub" style="margin:2px 0 0">${isEs ? 'Â¡Rasca para descubrir la delicia o alegrÃ­a de hoy!' : 'æ¯å¤©ç‚ºå…¨å®¶åˆ®å‡ºä¸€é“æš–å¿ƒè¥¿ç­ç‰™ç¾Žé£Ÿæˆ–å¥½é‹ï¼'}</p>
      </div>
      ${CHEV}
    </a>

    <!-- å…¨å®¶ 30 è¬æ­¥åˆä½œé‡Œç¨‹ç¢‘å¡ -->
    <div class="milestone-card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>ðŸ† ${t('milestoneTitle')}</b>
        <span class="chip good">${pct}%</span>
      </div>
      <div class="progress-outer"><div class="progress-inner" style="width:${pct}%"></div></div>
      <div class="progress-labels"><span>0</span><span>10è¬ (å‰æ‹¿æ£’)</span><span>20è¬ (ç«è…¿ç›¤)</span><span>30è¬ æ­¥ ðŸ†</span></div>
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
        <span class="sub">${t('milestoneCurrent')}ï¼š<b>${curSteps.toLocaleString()}</b> æ­¥</span>
        <button class="btn small ghost" id="btn-quick-steps" type="button">${t('logStepsBtn')}</button>
      </div>
    </div>

    <h2>${t('selectCity')}</h2><div class="grid2">${tiles}</div>

    <div style="margin-top:18px" class="stack">
      <a class="btn block" href="#/trip">${t('seePlan')}</a>
      <a class="btn ghost block" href="itinerario.html" target="_blank" style="border-color:var(--primary);color:var(--primary)">${t('spanishItiBtn')}</a>
      <a class="btn ghost block" href="#/help">${t('gameHelp')}</a>
    </div>`);

  $('#btn-quick-steps').onclick = () => {
    const s = prompt(isEs ? 'Â¿CuÃ¡ntos pasos quieres sumar al total familiar?' : 'æƒ³ç™»è¨˜å¹¾æ­¥åŠ å…¥å…¨å®¶ç´¯è¨ˆï¼Ÿ');
    if (!s) return;
    const n = parseInt(s.replace(/,/g, ''), 10);
    if (isNaN(n) || n <= 0) return toast(isEs ? 'Por favor introduce un nÃºmero vÃ¡lido' : 'è«‹è¼¸å…¥æ­£ç¢ºçš„æ•¸å­—');
    S.familySteps += n;
    award({ key: 'steps|' + uid(), points: 15, label: (isEs ? 'Pasos caminados: ' : 'æ­¥è¡Œè²¢ç»ï¼š') + n + ' æ­¥' });
    toast((isEs ? 'Â¡Sumados ' : 'å·²ç™»è¨˜ ') + n + (isEs ? ' pasos al reto familiar!' : ' æ­¥é€²å…¨å®¶å¤§æŒ‘æˆ°ï¼'));
    render();
  };
  return 'home';
});

/* ---------- today ---------- */
route('/today', () => {
  const tc = todayCard();
  if (tc) { location.replace('#/card/' + tc.id); return 'today'; }
  view(`<h1>${t('navToday')}</h1><div class="card"><p>${S.lang === 'es' ? 'Hoy no hay ninguna tarjeta de ciudad para desbloquear.' : 'ä»Šå¤©æ²’æœ‰è¦è§£éŽ–çš„åŸŽå¸‚å¡ã€‚'}</p>
    <p class="sub">${S.lang === 'es' ? 'El viaje es del 09/12 al 06/01. Puedes activar "Previsualizar todo" en Perfil.' : 'æ—…ç¨‹æ˜¯ 12/9 åˆ° 1/6ã€‚å‡ºç™¼å‰å¯ä»¥åˆ°ã€Œæˆ‘çš„ã€æ‰“é–‹ã€Œé è¦½å…¨éƒ¨ã€å…ˆçŽ©çŽ©çœ‹ã€‚'}</p></div>`);
  return 'today';
});

/* ---------- city ---------- */
route('/city/:id', (id) => {
  const city = CITY[id];
  if (!city) { location.hash = '#/'; return; }
  const cityItems = city.cityCards.map((c) => {
    const ok = isUnlocked(c);
    const d = cardDate(c);
    const sub = (c.port ? c.port + 'ãƒ»' : '') + (d ? fmtDate(d) + (ok ? '' : ' ' + t('unlocked')) : '');
    return ok
      ? `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b><span>${esc(sub)}</span></div>${doneMark(c)}${CHEV}</a>`
      : `<div class="item locked"><div class="t"><b>${esc(c.title.split('ï¼š')[0])}</b><span>${esc(sub)}</span></div><span class="chip">${t('unlocked')}</span></div>`;
  }).join('');
  const spotItems = city.spots.map((c) => `<a class="item" href="#/card/${c.id}"><div class="t"><b>${esc(c.title)}</b>
    <span>${esc((c.port ? c.port + 'ãƒ»' : '') + (c.game ? 'å°éŠæˆ²ï¼š' + c.game.name : 'æ™¯é»žå¡'))}</span></div>${doneMark(c)}${CHEV}</a>`).join('');
  view(`${back('#/', t('navHome'))}<h1>${esc(city.name)}</h1>${city.intro.map((p) => `<p class="sub">${p}</p>`).join('')}
    <h2>${t('cityCardsTitle')}</h2><div class="list">${cityItems}</div>
    <h2>${t('spotCardsTitle')}</h2><div class="list">${spotItems}</div>`);
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
  if (!qs.length) return `<h2>${title}</h2><p class="sub">åˆéšŽç‰ˆé€™ä¸€æ®µæ²’æœ‰é¡Œç›®ï¼Œåˆ‡åˆ°ã€Œæˆ‘è¦æŒ‘æˆ°ã€å¯ä»¥çŽ©æ›´å¤šã€‚</p>`;
  return `<h2 id="q-${sec}">${title}</h2>` + qs.map((q) => {
    const tags = q.tags.map((t) => `<span class="chip ${t.includes('ç¾å ´') ? 'warn' : t.includes('æŒ‘æˆ°') || t.includes('é•·é¡Œ') ? 'plan' : ''}">${esc(t)}</span>`).join(' ');
    return `<div class="q" data-qid="${q.qid}"><div class="row">${tags}<span class="chip">${qPoints(q)} åˆ†</span></div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.kind === 'onsite' ? '<p class="sub">åˆ°ç¾å ´æ‰¾ç­”æ¡ˆå†ä½œç­”ï¼Œä¸¦æ‹ç…§è­‰æ˜Žã€‚</p>' : ''}
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
    $('.res', box).innerHTML = `<div class="exp"><div class="verdict ${ok ? 'ok' : 'no'}">${ok ? 'ç­”å°äº†ï¼' : 'ç­”æ¡ˆæ˜¯ ' + q.answer}</div>
      ${q.proof ? '<div><b>ç¾å ´ä»»å‹™ï¼š</b>' + esc(q.proof) + '</div>' : ''}${esc(q.explain)}</div>`;
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
      if (b.dataset.k === q.answer) award({ key: 'q|' + q.qid, points: qPoints(q), label: 'ç­”å°ï¼š' + card.title, cardId: card.id });
    });
  });
}

/* ---------- tasks ---------- */
function needsPhoto(text) { return /æ‹|ç…§|ç¥¨æ ¹|æ”¶æ“š/.test(text); }
function taskControl(box, o) {
  const host = $('.tc', box);
  if (!host) return;
  const pts = o.points;
  const noteEl = $('.task-note', box);
  const note = () => (noteEl ? noteEl.value.trim() : '');
  const label = () => o.label + (note() ? 'ï¼ˆ' + note() + 'ï¼‰' : '');
  const paintDone = () => { host.innerHTML = `<span class="chip good">å·²å®Œæˆ +${pts}</span>`; };
  if (ledgerHas(o.key)) return paintDone();
  if (!needsPhoto(o.text)) {
    host.innerHTML = `<button class="btn small ghost" type="button">æˆ‘å€‘å®Œæˆäº† +${pts}</button>`;
    $('button', host).onclick = () => { if (award({ key: o.key, points: pts, label: label(), cardId: o.cardId })) paintDone(); };
    return;
  }
  host.innerHTML = `<label class="btn small upload-btn">æ‹ç…§ä¸Šå‚³ï¼ŒæˆåŠŸå°± +${pts}<input type="file" accept="image/*" hidden></label>
    <p class="sub" style="margin:6px 0 0">ç…§ç‰‡è¦ä¸Šå‚³æˆåŠŸæ‰æœƒåŠ åˆ†ã€‚</p>`;
  const input = $('input', host);
  input.onchange = async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!S.server.url) { toast('è«‹å…ˆåˆ°ã€Œæˆ‘çš„ã€è¨­å®šå®¶åº­é›²ç«¯ï¼Œä¸Šå‚³æˆåŠŸæ‰æœƒåŠ åˆ†'); input.value = ''; return; }
    const pk = 'tp:' + o.key + ':' + uid();
    await DB.put(pk, f);
    await DB.qPut({
      id: 'p:' + pk, type: 'photo', ts: Date.now(), key: pk,
      meta: { player: S.player, cardId: o.cardId || '', cardTitle: o.cardTitle || '', city: o.city || '', theme: o.theme || 'ä»»å‹™', date: today(), kind: 'task', slot: 0 },
      award: { key: o.key, points: pts, label: label(), cardId: o.cardId || '' },
    });
    toast('å·²æŽ’é€²ä¸Šå‚³æ¸…å–®ï¼Œä¸Šå‚³æˆåŠŸå°±åŠ åˆ†');
    input.value = '';
    flush();
  };
}

/* ---------- card page ---------- */
const TOOL_FOR = [['å‘½é‹ä¹‹è¼ª', 'wheel'], ['ç‰©åƒ¹', 'price'], ['æ­¥æ•¸', 'steps'], ['ç¥žç§˜ä»»å‹™', 'secret']];
function factId(card, i) { return card.id + '#' + i; }
function likeCount(id) {
  const others = (META.likes[id] || []).filter((n) => n !== S.player).length;
  return others + (LS.get('likes', {})[id] ? 1 : 0);
}
route('/card/:id', (id) => {
  const card = CARD[id];
  if (!card) { location.hash = '#/'; return; }
  if (!isUnlocked(card)) { view(`${back('#/city/' + card.city, CITY[card.city].name)}<h1>é‚„æ²’è§£éŽ–</h1><p>é€™å¼µåŸŽå¸‚å¡ ${fmtDate(cardDate(card))} æ‰æœƒè§£éŽ–ã€‚</p>`); return 'home'; }
  const city = CITY[card.city];
  const d = cardDate(card);
  let html = `${back('#/city/' + city.id, city.name)}<div class="row"><span class="chip">${esc(card.port || city.name)}</span>${d ? `<span class="chip">${fmtDate(d)}</span>` : ''}</div>
    <h1>${esc(card.title)}</h1>`;
  if (card.type === 'city') {
    html += `<button type="button" class="btn ghost block" data-jump="q-b" style="margin-bottom:12px">${t('jumpBonus')}</button>
      <details class="read" open><summary>${t('todayStory')} <span class="sub">é»žä¸€ä¸‹æ”¶èµ·ä¾†</span></summary><div class="inner reading">
      ${card.sections.map((s) => `<p><span class="section-label">${esc(s.label)}</span><br>${s.html}</p>`).join('')}</div></details>`;
    if (card.themes.length) {
      html += `<h2>ä»Šæ—¥ä¹å®®æ ¼</h2><p class="sub">æ¯äººæŒ‘ä¸€å€‹ä¸»é¡Œï¼Œå®¶äººä¹‹é–“ç›¡é‡ä¸è¦æ’žé¡Œã€‚æ‹æ»¿ 9 å¼µå°±èƒ½ä¸€éµæ‹¼è²¼ã€ä¸€éµä¸Šå‚³ã€‚</p>
        <div class="themes">${card.themes.map((t) => `<a class="theme-btn" href="#/grid/${card.id}/${t.key}"><b>${t.key}. ${esc(t.title)}</b><span>${esc(t.desc)}</span></a>`).join('')}</div>`;
    }
    html += quizHtml(card, 'b', 'åŠ åˆ†é¡Œ');
  } else {
    html += `<button type="button" class="btn ghost block" data-jump="q-p" style="margin-bottom:12px">${t('jumpQuiz')}</button>
      <details class="read" open><summary>${t('spotFacts')} <span class="sub">${t('spotFactsSub')}</span></summary><div class="inner reading">
      ${card.facts.length ? card.facts.map((f, i) => {
        const fid = factId(card, i);
        const on = !!LS.get('likes', {})[fid];
        return `<div class="fact"><div class="ftxt">${f}</div>
          <button type="button" class="like-btn${on ? ' on' : ''}" data-like="${fid}" aria-pressed="${on}">ðŸ‘ è®š <span>${likeCount(fid)}</span></button></div>`;
      }).join('') : ''}
      ${card.story.map((p) => `<p>${p}</p>`).join('')}</div></details>
      <p><b>${t('readyChallenge')}</b></p>`;
    html += quizHtml(card, 'p', t('preQuiz'));
    if (card.game && card.hasGame) {
      const tool = TOOL_FOR.find(([k]) => card.game.name.includes(k));
      html += `<div class="gamebox"><h3>æ™¯é»žå°éŠæˆ²ï¼š${esc(card.game.name)}</h3><p>${card.game.rules}</p>
        ${tool ? `<a class="btn small" href="#/tool/${tool[1]}">æ‰“é–‹${esc(tool[0])}å·¥å…·</a>` : ''}</div>`;
    }
    if (card.tasks.length) {
      html += `<h2>${t('fieldTask')}</h2><div class="stack">${card.tasks.map((t, i) => `<div class="card task-box" data-task="${i}"><p>${t}</p>
        <input class="text task-note" placeholder="å¯«ä¸‹ç´°ç¯€ï¼ˆé¸å¡«ï¼Œä¾‹å¦‚åå­—ã€åœ°é»žï¼‰">
        <div class="tc"></div></div>`).join('')}</div>`;
    }
    html += `<a class="btn ghost block" href="#/grid/${card.id}/S">${t('openSpotGrid')}</a>`;
    html += quizHtml(card, 'q', t('postQuiz'));
  }
  view(html);
  bindQuiz(card);
  $$('[data-jump]').forEach((b) => b.onclick = () => { const target = document.getElementById(b.dataset.jump); if (target) target.scrollIntoView({ behavior: 'smooth' }); });
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
        key: 'task|' + card.id + '|' + i, points: 30, label: 'ä»»å‹™ï¼š' + card.title,
        text: plain(card.tasks[i]), cardId: card.id, cardTitle: card.title, city: city.name, theme: 'ç¾å ´ä»»å‹™',
      });
    });
  }
  return card.type === 'city' && todayCard() === card ? 'today' : 'home';
});

/* ---------- nine-grid ---------- */
function gridTheme(card, key) {
  if (key === 'S') return { key: 'S', title: card.title, desc: 'åœ¨é€™å€‹æ™¯é»žæ‹ 9 å¼µä½ è¦ºå¾—æœ€æœ‰ä»£è¡¨æ€§çš„æ±è¥¿ã€‚' };
  return card.themes.find((t) => t.key === key);
}
function slotKey(cardId, key, i) { return [S.player, cardId, key, i].join('|'); }
route('/grid/:cardId/:key', (cardId, key) => {
  const card = CARD[cardId];
  const theme = card && gridTheme(card, key);
  if (!theme) { location.hash = '#/'; return; }
  view(`${back('#/card/' + card.id, 'å›žåˆ°å¡ç‰‡')}<h1>ä¹å®®æ ¼ï¼š${esc(theme.title)}</h1>
    <p class="sub">${esc(theme.desc)}</p>
    <div class="slots" id="slots">${Array.from({ length: 9 }, (_, i) => `<label class="slot" data-i="${i}">+<input type="file" accept="image/*" aria-label="ç¬¬ ${i + 1} æ ¼"></label>`).join('')}</div>
    <p class="sub" id="cnt" style="margin-top:8px"></p>
    <div class="stack" style="margin-top:8px">
      <button class="btn block" id="make" disabled>ä¸€éµæ‹¼è²¼</button>
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
        el.innerHTML = `<img src="${u}" alt="ç¬¬ ${i + 1} å¼µ"><input type="file" accept="image/*" aria-label="æ›æŽ‰ç¬¬ ${i + 1} å¼µ">`;
      }
      bindSlot(el, i);
    }
    $('#cnt').textContent = 'å·²ç¶“æ‹äº† ' + n + ' / 9 å¼µ' + (n < 9 ? 'ã€‚é»žæ ¼å­æ‹ç…§æˆ–å¾žç›¸ç°¿é¸ã€‚' : 'ï¼Œå¯ä»¥æ‹¼è²¼äº†ï¼');
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
    $('#out').innerHTML = `<img class="collage" src="${u}" alt="æ‹¼å¥½çš„ä¹å®®æ ¼">
      <div class="stack"><button class="btn block" id="up">ä¸€éµä¸Šå‚³åˆ°å®¶åº­é›²ç«¯</button>
      <button class="btn ghost block" id="save">å­˜åˆ°æ‰‹æ©Ÿ</button></div>
      <p class="sub" style="margin-top:8px">${S.server.url ? 'æœƒä¸Šå‚³ 9 å¼µåŽŸåœ–å’Œé€™å¼µæ‹¼è²¼ã€‚ä¸Šå‚³æˆåŠŸå°±åŠ  20 åˆ†ã€‚' : 'é‚„æ²’é€£ä¸Šå®¶åº­é›²ç«¯ï¼Œå¯ä»¥å…ˆå­˜åˆ°æ‰‹æ©Ÿã€‚'}</p>`;
    $('#save').onclick = () => saveBlob(blob, theme.title + '-ä¹å®®æ ¼.jpg');
    $('#up').onclick = async () => {
      if (!S.server.url) { toast('è«‹å…ˆåˆ°ã€Œæˆ‘çš„ã€è¨­å®šå®¶åº­é›²ç«¯'); return; }
      const city = CITY[card.city];
      const base = { player: S.player, cardId: card.id, cardTitle: card.title, city: city.name, theme: theme.title, date: today() };
      const ts = Date.now();
      for (let i = 0; i < 9; i++) {
        await DB.qPut({ id: 'p:' + slotKey(cardId, key, i) + ':' + ts, type: 'photo', ts: ts + i, key: slotKey(cardId, key, i), meta: Object.assign({ slot: i + 1, kind: 'original' }, base) });
      }
      await DB.qPut({
        id: 'p:' + slotKey(cardId, key, 'collage') + ':' + ts, type: 'photo', ts: ts + 9, key: slotKey(cardId, key, 'collage'),
        meta: Object.assign({ slot: 0, kind: 'collage' }, base),
        award: { key: 'grid|' + card.id + '|' + key, points: 20, label: 'ä¹å®®æ ¼ï¼š' + theme.title, cardId: card.id },
      });
      toast('å·²æŽ’é€²ä¸Šå‚³æ¸…å–®ï¼Œä¸Šå‚³æˆåŠŸå°±åŠ åˆ†');
      flush();
    };
  };
  $('#make').onclick = async () => {
    $('#make').disabled = true; $('#make').textContent = 'æ‹¼è²¼ä¸­â€¦';
    const blobs = [];
    for (let i = 0; i < 9; i++) blobs.push(await DB.get(slotKey(cardId, key, i)));
    const out = await makeCollage(blobs, theme.title, card.title);
    await DB.put(slotKey(cardId, key, 'collage'), out);
    $('#make').textContent = 'é‡æ–°æ‹¼è²¼'; $('#make').disabled = false;
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
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#000000'; g.font = 'bold 46px -apple-system, sans-serif';
  g.fillText(themeTitle.slice(0, 18), 24, 64);
  g.fillStyle = '#57575A'; g.font = '30px -apple-system, sans-serif';
  g.fillText((S.player + 'ãƒ»' + today() + 'ãƒ»' + cardTitle).slice(0, 34), 24, 116);
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

/* ---------- ROUTE: /tapa (æ¯æ—¥ç¾Žå‘³ Tapa åˆ®åˆ®æ¨‚) ---------- */
route('/tapa', () => {
  const isEs = S.lang === 'es';
  const tStr = today();
  const dayIdx = (Math.abs(new Date(tStr) - new Date(TRIP_START)) / 86400000) % TAPAS_LIST.length;
  const item = TAPAS_LIST[Math.floor(dayIdx)] || TAPAS_LIST[0];
  const doneKey = 'tapa|' + tStr;
  const isDone = ledgerHas(doneKey);

  view(`${back('#/', t('navHome'))}<h1>${t('tapaTitle')}</h1>
    <p class="sub">${t('tapaSub')}</p>

    <div class="scratch-box" id="sbox">
      <div class="scratch-content">
        <div class="scratch-emoji">${item.icon}</div>
        <div class="scratch-title">${isEs ? item.nameEs : item.name}</div>
        <div class="scratch-desc">${item.desc}</div>
        <div style="margin-top:16px">
          ${isDone ? '<span class="chip good">âœ¨ ä»Šæ—¥å·²é”æˆ +20åˆ†ï¼</span>'
                   : '<button class="btn block" id="btn-tapa-done">' + t('alreadyDone') + '</button>'}
        </div>
      </div>
      <div class="scratch-cover" id="scover">
        <div style="font-size:48px">ðŸŽ</div>
        <div class="cover-txt">${t('tapToScratch')}</div>
        <p style="font-size:13px;opacity:.9;margin-top:6px">${isEs ? 'Tapa sorpresa del dÃ­a' : 'é»žä¸€ä¸‹æ­æ›‰ä»Šæ—¥å°ˆå±¬å¥½é‹ç¾Žå‘³'}</p>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3>ðŸ’¡ å°ˆç‚ºå…¨å®¶æ‰“é€ çš„æº«é¦¨å°å„€å¼</h3>
      <p class="sub">å‡ºåœ‹æ—…è¡Œæœ€å¹¸ç¦çš„å°±æ˜¯æ¯ä¸€é “å¥½åƒçš„å’Œèˆ’æœçš„é™½å…‰ã€‚æ¯å¤©æ—©ä¸Šé»žé–‹åˆ®ä¸€åˆ®ï¼Œå¸¶è‘—å¼Ÿå¼Ÿå’Œçˆ¸åª½ä¸€èµ·æ‰¾å°‹ä»Šå¤©çš„ç¾Žé£Ÿå§ï¼</p>
    </div>`);

  const cover = $('#scover');
  cover.onclick = () => {
    cover.classList.add('scratched');
  };
  const doneBtn = $('#btn-tapa-done');
  if (doneBtn) {
    doneBtn.onclick = () => {
      award({ key: doneKey, points: 20, label: (isEs ? 'Tapa del dÃ­a: ' : 'ä»Šæ—¥ç¾Žå‘³ï¼š') + item.name });
      toast(t('markSuccess'));
      location.hash = '#/tapa';
    };
  }
  return 'tools';
});

/* ---------- ROUTE: /flags (åŸŽå¸‚æ——èˆ‡å°çœ¾æ•…äº‹) ---------- */
route('/flags', () => {
  const isEs = S.lang === 'es';
  const streak = getStreak();
  const rows = FLAGS_LIST.map((f, i) => {
    const unlocked = i < streak;
    return `<div class="flag-card ${unlocked ? '' : 'locked'}" style="${unlocked ? '' : 'opacity:.5'}">
      <div class="flag-badge">${f.badge}</div>
      <div class="flag-info">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="flag-title">${esc(isEs ? f.titleEs : f.title)}</span>
          <span class="chip ${unlocked ? 'good' : ''}">${unlocked ? 'å·²é»žäº®' : 'ç¬¬ ' + (i + 1) + ' å¤©'}</span>
        </div>
        <div class="sub" style="font-size:12px;margin:2px 0">${esc(f.city)}</div>
        <div class="flag-story">${unlocked ? esc(f.story) : 'é€£çºŒç™»å…¥æ‰“å¡è‡³ç¬¬ ' + (i + 1) + ' å¤©è§£éŽ–æ­¤æ——å¹Ÿå°çœ¾å‚³å¥‡æ•…äº‹ã€‚'}</div>
      </div>
    </div>`;
  }).join('');

  view(`${back('#/', t('navHome'))}<h1>${t('flagsTitle')}</h1>
    <p class="sub">ç›®å‰é€£çºŒæ‰“å¡ ðŸ”¥ <b>${streak}</b> å¤©ï¼Œå·²æ”¶é›† <b>${Math.min(streak, 30)} / 30</b> é¢åŸŽå¸‚æ——å¹Ÿèˆ‡å‚³å¥‡æ•…äº‹ã€‚</p>
    <div class="stack">${rows}</div>`);
  return 'tools';
});

/* ---------- ROUTE: /pokedex (è¥¿ç­ç‰™æ—…è¡Œå¤§åœ–é‘‘) ---------- */
route('/pokedex', async () => {
  const isEs = S.lang === 'es';
  const cardsHtml = await Promise.all(POKEDEX_ITEMS.map(async (p) => {
    const key = 'poke:' + p.id;
    const blob = await DB.pokeGet(key);
    const unlocked = !!blob;
    let imgTag = '';
    if (blob) {
      const u = URL.createObjectURL(blob);
      imgTag = `<img class="poke-thumb" src="${u}" alt="${p.name}">`;
    }
    return `<div class="poke-card ${unlocked ? 'unlocked' : 'locked'}" data-pid="${p.id}">
      <div class="poke-icon">${p.icon}</div>
      <div class="poke-name">${esc(isEs ? p.nameEs : p.name)}</div>
      <div class="poke-sub">${esc(p.desc)}</div>
      ${imgTag}
      <label class="btn small ${unlocked ? 'ghost' : ''}" style="margin-top:6px;width:100%;cursor:pointer">
        ${unlocked ? 'æ›ç…§ç‰‡' : 'ðŸ“· æ‰“å¡é»žäº®'}
        <input type="file" accept="image/*" class="poke-input" data-id="${p.id}" hidden>
      </label>
    </div>`;
  }));

  view(`${back('#/', t('navHome'))}<h1>${t('pokedexTitle')}</h1>
    <p class="sub">${t('pokedexSub')}</p>
    <div style="margin-bottom:14px;display:flex;gap:10px">
      <button class="btn ghost block" id="btn-polaroid" type="button">${t('polaroidBtn')}</button>
    </div>
    <div id="polaroid-box"></div>
    <div class="pokedex-grid">${cardsHtml.join('')}</div>`);

  $$('.poke-input').forEach((input) => {
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const id = input.dataset.id;
      await DB.pokePut('poke:' + id, f);
      award({ key: 'pokedex|' + id, points: 20, label: 'åœ–é‘‘é»žäº®ï¼š' + POKEDEX_ITEMS[id - 1].name });
      toast('ðŸŽ‰ æˆåŠŸé»žäº®åœ–é‘‘ï¼š' + POKEDEX_ITEMS[id - 1].name + 'ï¼+20 åˆ†');
      location.hash = '#/pokedex';
    };
  });

  $('#btn-polaroid').onclick = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const u = URL.createObjectURL(f);
      const caption = prompt(isEs ? 'Escribe una frase para la foto:' : 'å¯«ä¸€å¥æ‹ç«‹å¾—æ‰‹å¯«è©±ï¼š', 'Â¡Hola EspaÃ±a!') || 'EspaÃ±a 2026';
      $('#polaroid-box').innerHTML = `
        <div class="polaroid">
          <img src="${u}" alt="Polaroid">
          <div class="polaroid-caption">${esc(caption)}</div>
          <div class="polaroid-date">ðŸ“ EspaÃ±a â€¢ ${today()}</div>
        </div>
      `;
    };
    input.click();
  };
  return 'tools';
});

/* ---------- tools (éŠæˆ²é–“) ---------- */
const SECRET_TASKS = [
  'è®“ä¸€ä½å®¶äººä¸çŸ¥ä¸è¦ºèªªå‡ºã€Œå¥½å¥½åƒã€ä¸‰æ¬¡ã€‚',
  'å·æ‹åˆ°ä¸€ä½å®¶äººæ‰“å“ˆæ¬ çš„çž¬é–“ã€‚',
  'è®“ä¸€ä½å®¶äººè·Ÿä¸€åº§é›•åƒæ“ºä¸€æ¨£çš„å§¿å‹¢åˆç…§ï¼Œä¸èƒ½èªªæ˜¯ä»»å‹™ã€‚',
  'è®“å…¨å®¶åœ¨åŒä¸€å¼µç…§ç‰‡è£¡åŒæ™‚æ¯” YAã€‚',
  'ç”¨ç•¶åœ°è©±è·Ÿ 3 å€‹ä¸åŒçš„äººèªªè¬è¬ï¼Œä¸¦å¯«ä¸‹ä»–å€‘æ˜¯èª°ï¼ˆä¾‹å¦‚ï¼šé¤å»³æœå‹™ç”Ÿï¼‰ã€‚',
  'è®“ä¸€ä½å®¶äººå¹«ä½ æ‹ä¸€å¼µã€Œä½ å’Œä¸€æ‰‡è—è‰²çš„é–€ã€ã€‚',
  'å·æ‹åˆ°ä¸€ä½å®¶äººåƒæ±è¥¿åƒåˆ°ä¸€åŠçš„çž¬é–“ã€‚',
  'è®“ä¸€ä½å®¶äººåœ¨ç„¡ä»»ä½•æç¤ºçš„æƒ…æ³ä¸‹ï¼Œèªªå‡ºä»Šå¤©æ‰€æœ‰çš„æ™¯é»žã€‚',
  'æ™šé¤æ™‚è®“å¤§å®¶è¨Žè«– 30 ç§’ã€Œä»Šå¤©å­¸åˆ°çš„ä¸€ä»¶äº‹ã€ã€‚',
  'æ‰¾ä¸€å€‹ä½ è¦ºå¾—æœ€å¥½ç¬‘çš„è·¯ç‰Œï¼Œè®“ä¸€ä½å®¶äººè·Ÿå®ƒåˆç…§ã€‚',
  'è®“å®¶äººç”¨ä½ çš„æ‰‹æ©Ÿå¹«ä½ æ‹ä¸€å¼µè·³èµ·ä¾†çš„ç…§ç‰‡ã€‚',
  'æ”¶é›† 3 å¼µä¸åŒçš„ç¥¨æ ¹æˆ–æ”¶æ“šï¼Œå…¨éƒ¨æ‹é€²åŒä¸€å¼µç…§ç‰‡è£¡ä¸Šå‚³ã€‚',
  'è®“å…©ä½å®¶äººåœ¨ç…§ç‰‡è£¡æ“æŠ±ã€‚',
  'è®“ä¸€ä½å®¶äººç”¨ã€Œç´¯ã€ä»¥å¤–çš„å½¢å®¹è©žå½¢å®¹ä»Šå¤©ã€‚',
  'å·å·è¨˜ä¸‹ä¸€ä½å®¶äººä»Šå¤©èªªäº†å¹¾æ¬¡ã€Œå¥½æ¼‚äº®ã€ï¼Œæ™šä¸Šå…¬å¸ƒã€‚',
  'è®“ä¸€ä½å®¶äººé™ªä½ è²·ä¸€æ¨£æ±è¥¿ï¼Œä¸èƒ½èªªæ˜¯ä»»å‹™ã€‚',
  'æ‹åˆ°ä¸€ä½å®¶äººå’Œè¡—é ­è—äººçš„åˆç…§ã€‚',
  'è®“ä¸€å¼µå…¨å®¶ç¦è£¡æ¯å€‹äººèº«ä¸Šéƒ½æœ‰ç´…è‰²ã€‚',
  'è®“ä¸€ä½å®¶äººè«‹ä½ å–ä¸€æ¯é£²æ–™ã€‚',
  'æ‹åˆ°ä¸€ä½å®¶äººèªçœŸçœ‹åœ°åœ–çš„ç…§ç‰‡ã€‚',
  'ä»Šå¤©å¹«æ¯ä½å®¶äººå„æ‹ä¸€å¼µã€Œæœ€ä½³ç…§ç‰‡ã€ã€‚',
  'è®“ä¸€ä½å®¶äººè·Ÿä½ å­¸ä¸€å¥è¥¿ç­ç‰™æ–‡æˆ–åŠ æ³°éš†å°¼äºžæ–‡ã€‚',
  'æ‹åˆ°ä¸€å¼µé˜æ¨“å’Œå®¶äººçš„åˆç…§ã€‚',
  'è®“ä¸€ä½å®¶äººèªªå‡ºä»Šå¤©ç­”éŒ¯çš„ä¸€é¡Œã€‚',
  'å·æ‹åˆ°ä¸€ä½å®¶äººç¬‘åˆ°çœ¼ç›çž‡èµ·ä¾†ã€‚',
  'åœ¨å™´æ³‰é‚Šè®“ä¸€ä½å®¶äººä¸Ÿç¡¬å¹£è¨±é¡˜ï¼Œä¸èƒ½èªªæ˜¯ä»»å‹™ã€‚',
  'è·Ÿä¸€ä½å®¶äººäº¤æ›ä¸€å€‹å°æ±è¥¿ï¼ˆç³–æžœã€æ˜Žä¿¡ç‰‡éƒ½å¯ä»¥ï¼‰ã€‚',
  'è®“åŒä¸€ä½å®¶äººå‡ºç¾åœ¨ä»Šå¤© 3 å€‹ä¸åŒåœ°é»žçš„ç…§ç‰‡è£¡ã€‚',
  'è®“ä¸€ä½å®¶äººæ¨¡ä»¿ä¸€å¹…ç•«æˆ–ä¸€å¼µæµ·å ±çš„å‹•ä½œï¼Œä¸¦æ‹ä¸‹ä¾†ã€‚',
  'æ›¿ä¸€ä½å®¶äººæƒ³å¥½ä¸€å€‹ä»Šå¤©çš„å°è™Ÿï¼Œç•¶æ™šå¤§å®¶æŠ•ç¥¨æ±ºå®šè¦ä¸è¦ç”¨ã€‚',
];
route('/tools', () => {
  const isEs = S.lang === 'es';
  view(`<h1>${t('navTools')}</h1><p class="sub">${isEs ? 'Todos los minijuegos y misiones estÃ¡n aquÃ­.' : 'æ™¯é»žå°éŠæˆ²å’Œå„ç¨®å°ä»»å‹™éƒ½åœ¨é€™è£¡ã€‚åˆ†æ•¸æœƒè¨˜åœ¨çŽ©çš„äººåä¸‹ã€‚'}</p>
    <div class="list">
      <a class="item" href="#/tapa"><div class="t"><b>ðŸ¢ ${t('tapaTitle')}</b><span>${isEs ? 'Rasca para descubrir delicias de hoy' : 'æ¯å¤©åˆ®é–‹ä¸€é“ç¾Žå‘³å¥½é‹å°äº‹ï¼ˆæœ€é©åˆå…¨å®¶ï¼‰'}</span></div>${CHEV}</a>
      <a class="item" href="#/pokedex"><div class="t"><b>ðŸ“– ${t('pokedexTitle')}</b><span>${isEs ? '30 iconos espaÃ±oles para coleccionar y Polaroid' : '30 æ¬¾è¥¿ç­ç‰™ç¶“å…¸åœ–é‘‘æ”¶é›†ï¼‹å¾©å¤æ‹ç«‹å¾—'}</span></div>${CHEV}</a>
      <a class="item" href="#/flags"><div class="t"><b>ðŸš© ${t('flagsTitle')}</b><span>${isEs ? '30 banderas con microhistorias legendarias' : '30 å¤©æ‰“å¡æ”¶é›†åŸŽå¸‚æ——èˆ‡å‚³å¥‡æ•…äº‹'}</span></div>${CHEV}</a>
      <a class="item" href="#/tool/wheel"><div class="t"><b>å‘½é‹ä¹‹è¼ª</b><span>è½‰ä¸€æ¬¡ï¼Œè½‰åˆ°ä»€éº¼å°±åšä»€éº¼</span></div>${CHEV}</a>
      <a class="item" href="#/tool/price"><div class="t"><b>ç‰©åƒ¹çŒœçŒœçŒœ</b><span>æ‰‹æ©Ÿè¼ªæµå‚³ï¼Œæ¯äººå·å·è¼¸å…¥çŒœåƒ¹</span></div>${CHEV}</a>
      <a class="item" href="#/tool/steps"><div class="t"><b>æ­¥æ•¸çŒœçŒœçŒœ</b><span>é€²æ™¯é»žå‰çŒœï¼Œå‡ºä¾†å°ç­”æ¡ˆ</span></div>${CHEV}</a>
      <a class="item" href="#/tool/secret"><div class="t"><b>ç¥žç§˜ä»»å‹™</b><span>å¡«ä¸€å€‹ä½ ä»Šå¤©å–œæ­¡çš„æ•¸å­—ï¼Œé ˜å–å°ä»»å‹™</span></div>${CHEV}</a>
      <a class="item" href="#/tool/give"><div class="t"><b>çµ¦åˆ†</b><span>é€£é€£çœ‹ã€å°å°è§€å¯Ÿå®¶ã€ç•¶ä¸€æ¬¡é›•åƒç­‰éŠæˆ²çš„å‹åˆ©è€…</span></div>${CHEV}</a>
    </div>`);
  return 'tools';
});
const WHEEL_DEFAULT = [
  'è² è²¬ä»Šå¤©æ‰€æœ‰çš„é»žé¤',
  'æ‰¾å…©å€‹å®¶äººä¸€èµ·è·Ÿä¸€æ‰‡æ¼‚äº®çš„é–€åˆç…§',
  'å…¨å®¶æ‹ä¸€å¼µæ¯å€‹äººå§¿å‹¢éƒ½ä¸åŒçš„ç…§ç‰‡',
  'èˆ‡ä¸€å€‹å·²ç¶“1000æ­²çš„æ±è¥¿åˆç…§',
  'æ‰¾ä¸€å€‹å®¶äººè·Ÿä½ ä¸€èµ·æ¨¡ä»¿æœ€è¿‘é›•åƒçš„å‹•ä½œï¼Œä¸¦æ‹ä¸‹ä¾†',
  'è·Ÿç•¶åœ°äººå­¸ä¸€å¥ç•¶åœ°è©±',
];
route('/tool/wheel', () => {
  const def = LS.get('wheel2', WHEEL_DEFAULT);
  view(`${back('#/tools', t('navTools'))}<h1>å‘½é‹ä¹‹è¼ª</h1>
    <div class="wheel-wrap"><canvas id="wh" width="640" height="640" aria-label="å‘½é‹ä¹‹è¼ª"></canvas></div>
    <button class="btn block" id="spin">è½‰ï¼</button>
    <div id="res" class="center" style="margin:16px 0"></div>
    <details class="read"><summary>ä¿®æ”¹è¼ªç›¤ä¸Šçš„é¸é …</summary><div class="inner">
      <textarea class="text" id="opts">${esc(def.join('\n'))}</textarea>
      <p class="sub">ä¸€è¡Œä¸€å€‹ï¼Œæœ€å¤š 10 å€‹ã€‚æœ‰æ‹ç…§çš„ä»»å‹™ï¼Œè½‰åˆ°å¾Œè¦æ‹ç…§ä¸Šå‚³æˆåŠŸæ‰åŠ  20 åˆ†ã€‚</p>
      <button class="btn small" id="saveo">å„²å­˜</button></div></details>`);
  let items = def.slice(0, 10), angle = 0;
  const cv = $('#wh'), g = cv.getContext('2d');
  const colors = ['#007AFF', '#34C759', '#FF9500', '#5856D6', '#FF3B30', '#30B0C7', '#AF52DE', '#FFCC00', '#A2845E', '#FF2D55'];
  const draw = () => {
    const n = items.length, r = 300, cx = 320, cy = 320;
    g.clearRect(0, 0, 640, 640);
    for (let i = 0; i < n; i++) {
      const a0 = angle + (i / n) * Math.PI * 2, a1 = angle + ((i + 1) / n) * Math.PI * 2;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a0, a1); g.closePath();
      g.fillStyle = colors[i % colors.length]; g.fill();
      g.save(); g.translate(cx, cy); g.rotate((a0 + a1) / 2);
      g.fillStyle = '#000'; g.font = 'bold 24px -apple-system, sans-serif'; g.textAlign = 'right';
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
        taskControl($('#wres'), { key: 'wheel|' + uid(), points: 20, label: 'å‘½é‹ä¹‹è¼ªï¼š' + text, text, cardTitle: 'å‘½é‹ä¹‹è¼ª', theme: 'å‘½é‹ä¹‹è¼ª' });
        $('#spin').disabled = false;
      }
    };
    requestAnimationFrame(step);
  };
  $('#saveo').onclick = () => {
    items = $('#opts').value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (items.length < 2) { toast('è‡³å°‘è¦ 2 å€‹é¸é …'); return; }
    LS.set('wheel2', items); draw(); toast('å·²å„²å­˜');
  };
  return 'tools';
});

function winnersHtml(kind) {
  const rows = LS.get('winners', []).filter((w) => w.tool === kind).slice().reverse();
  if (!rows.length) return '<p class="sub">é‚„æ²’æœ‰å¾—çŽç´€éŒ„ã€‚</p>';
  return rows.map((w) => `<div class="score-row"><span class="name">${esc(w.item || 'ï¼ˆæœªå¡«ï¼‰')}</span>
    <span class="sub">${esc(w.date)}</span><span class="pts">${esc(w.winner)}</span></div>`).join('');
}
function guessTool(kind) {
  const isPrice = kind === 'price';
  const fam = S.family.length ? S.family : [S.player];
  const late = cutoffPassed();
  view(`${back('#/tools', t('navTools'))}<h1>${isPrice ? 'ç‰©åƒ¹çŒœçŒœçŒœ' : 'æ­¥æ•¸çŒœçŒœçŒœ'}</h1>
    <p class="sub">${isPrice ? 'å…ˆä¸è¦çœ‹æ¨™åƒ¹ã€‚æ‰‹æ©Ÿè¼ªæµå‚³ï¼Œæ¯å€‹äººé»žè‡ªå·±çš„åå­—ã€å·å·è¼¸å…¥çŒœçš„åƒ¹æ ¼ï¼ˆæ­å…ƒï¼‰ã€‚' : 'é€²æ™¯é»žå‰ï¼Œæ¯å€‹äººé»žè‡ªå·±çš„åå­—ã€å·å·è¼¸å…¥çŒœçš„æ­¥æ•¸ã€‚'}</p>
    ${cutoffText() ? `<p class="sub">æ¯å¤©ä¸‹å¥½é›¢æ‰‹çš„æˆªæ­¢æ™‚é–“ï¼šå°ç£æ™‚é–“ ${esc(cutoffText())}</p>` : ''}
    ${late ? '<div class="card"><b>ä»Šå¤©çš„æˆªæ­¢æ™‚é–“å·²ç¶“éŽäº†ï¼Œé€™æ¬¡å…ˆä¸èƒ½å†çŒœã€‚</b></div>' : ''}
    ${isPrice ? '<div class="card center"><div class="sub">å‰©é¤˜æ™‚é–“</div><div class="big-num" id="clock">60</div><button class="btn small ghost" id="startc">é–‹å§‹å€’æ•¸ä¸€åˆ†é˜</button></div>' : ''}
    <div class="list" id="who">${fam.map((n) => `<button class="item" type="button" data-n="${esc(n)}" ${late ? 'disabled' : ''} style="width:100%;border:0;background:none;text-align:left"><div class="t"><b>${esc(n)}</b><span class="st">é‚„æ²’çŒœ</span></div></button>`).join('')}</div>
    <label class="field"><span>${isPrice ? 'çŒœçš„æ˜¯ä»€éº¼æ±è¥¿ï¼ˆä¾‹å¦‚ï¼šä¸€ç“¶æ°´ï¼‰' : 'çŒœçš„æ˜¯å“ªè£¡ï¼ˆä¾‹å¦‚ï¼šè–å®¶å ‚ï¼‰'}</span><input class="text" id="item"></label>
    <label class="field"><span>${isPrice ? 'çœŸæ­£çš„åƒ¹æ ¼ï¼ˆæ­å…ƒï¼‰' : 'å¯¦éš›æ­¥æ•¸'}</span><input class="text" id="real" inputmode="decimal"></label>
    <button class="btn block" id="rev">å…¬å¸ƒèª°æœ€æŽ¥è¿‘</button><div id="win" style="margin-top:12px"></div>
    <h2>å¾—çŽç´€éŒ„</h2><div class="list" id="wlist">${winnersHtml(kind)}</div>`);
  const guesses = {};
  $$('#who [data-n]').forEach((b) => b.onclick = () => {
    if (cutoffPassed()) { toast('å·²ç¶“éŽæˆªæ­¢æ™‚é–“'); return; }
    const n = b.dataset.n;
    const v = prompt(n + 'ï¼Œè«‹å·å·è¼¸å…¥ä½ çš„çŒœæ¸¬ï¼ˆæ•¸å­—ï¼‰');
    if (v == null) return;
    const num = parseFloat(String(v).replace(',', '.'));
    if (isNaN(num)) { toast('è«‹è¼¸å…¥æ•¸å­—'); return; }
    guesses[n] = num;
    $('.st', b).textContent = 'å·²éŽ–å®š';
  });
  if (isPrice) {
    let tm;
    $('#startc').onclick = () => {
      let s = 60; $('#clock').textContent = s; clearInterval(tm);
      tm = setInterval(() => { s--; $('#clock').textContent = Math.max(0, s); if (s <= 0) { clearInterval(tm); toast('æ™‚é–“åˆ°ï¼'); } }, 1000);
    };
  }
  $('#rev').onclick = () => {
    const real = parseFloat(String($('#real').value).replace(',', '.'));
    const names = Object.keys(guesses);
    if (isNaN(real) || !names.length) { toast('è¦å…ˆæœ‰äººçŒœï¼Œä¹Ÿè¦è¼¸å…¥ç­”æ¡ˆ'); return; }
    names.sort((a, b) => Math.abs(guesses[a] - real) - Math.abs(guesses[b] - real));
    const best = names[0];
    const item = $('#item').value.trim();
    $('#win').innerHTML = `<div class="card"><h3>æœ€æŽ¥è¿‘ï¼š${esc(best)}</h3>
      ${names.map((n) => `<div>${esc(n)}ï¼š${guesses[n]}ï¼ˆå·® ${Math.round(Math.abs(guesses[n] - real) * 100) / 100}ï¼‰</div>`).join('')}
      <button class="btn small" id="give" style="margin-top:10px">çµ¦ ${esc(best)} 20 åˆ†ä¸¦è¨˜ä¸‹ä¾†</button></div>`;
    $('#give').onclick = () => {
      const label = (isPrice ? 'ç‰©åƒ¹çŒœçŒœçŒœ' : 'æ­¥æ•¸çŒœçŒœçŒœ') + (item ? 'ï¼š' + item : '') + ' å† è»';
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
  view(`${back('#/tools', t('navTools'))}<h1>ç¥žç§˜ä»»å‹™</h1>
    <p class="sub">å¡«ä¸€å€‹ä½ ä»Šå¤©å–œæ­¡çš„æ•¸å­—ï¼ˆ1 åˆ° ${SECRET_TASKS.length} ä¹‹é–“ï¼Œæˆ–ä»»ä½•æ•¸å­—éƒ½å¯ä»¥ï¼‰ï¼Œå°±æœƒæŠ½åˆ°ä¸€å€‹å°ä»»å‹™ã€‚</p>
    <label class="field"><span>ä½ ä»Šå¤©å–œæ­¡çš„æ•¸å­—</span><input class="text" id="no" inputmode="numeric"></label>
    <button class="btn block" id="sec" type="button">é ˜å–ä»»å‹™</button>
    <div id="secout" style="margin-top:12px"></div>`);
  $('#sec').onclick = () => {
    const n = parseInt($('#no').value, 10);
    if (isNaN(n)) { toast('è«‹å…ˆå¡«ä¸€å€‹æ•¸å­—'); return; }
    const idx = ((n - 1) % SECRET_TASKS.length + SECRET_TASKS.length) % SECRET_TASKS.length;
    const text = SECRET_TASKS[idx];
    $('#secout').innerHTML = `<div class="card"><h3>ç¥žç§˜ä»»å‹™ #${idx + 1}</h3><p>${esc(text)}</p>
      <input class="text task-note" placeholder="å¯«ä¸‹ç´°ç¯€ï¼ˆé¸å¡«ï¼Œä¾‹å¦‚åå­—ï¼‰">
      <div class="task-box"><div class="tc"></div></div></div>`;
    taskControl($('#secout .task-box'), { key: 'secret|' + (idx + 1), points: 30, label: 'ç¥žç§˜ä»»å‹™ #' + (idx + 1) + 'ï¼š' + text, text, cardTitle: 'ç¥žç§˜ä»»å‹™', theme: 'ç¥žç§˜ä»»å‹™' });
  };
  return 'tools';
});
route('/tool/give', () => {
  const fam = S.family.length ? S.family : [S.player];
  view(`${back('#/tools', t('navTools'))}<h1>çµ¦åˆ†</h1><p class="sub">é€£é€£çœ‹ã€å°å°è§€å¯Ÿå®¶ã€ç‰¹å¯«å°‹å¯¶ã€ç•¶ä¸€æ¬¡é›•åƒã€ä¸€å¥ç•¶åœ°è©±çš„åˆ†æ•¸åœ¨é€™è£¡çµ¦ã€‚</p>
    <label class="field"><span>çµ¦èª°</span><select class="text" id="who">${fam.map((n) => `<option>${esc(n)}</option>`).join('')}</select></label>
    <label class="field"><span>å¹¾åˆ†</span><select class="text" id="pts"><option>5</option><option>10</option><option>15</option><option selected>20</option><option>30</option></select></label>
    <label class="field"><span>åŽŸå› </span><input class="text" id="why" placeholder="ä¾‹å¦‚ï¼šå°å°è§€å¯Ÿå®¶ç¬¬ä¸€å"></label>
    <button class="btn block" id="go">çµ¦åˆ†</button>`);
  $('#go').onclick = () => {
    award({ key: 'give', points: parseInt($('#pts').value, 10), label: $('#why').value.trim() || 'éŠæˆ²åŠ åˆ†', player: $('#who').value, unique: false });
  };
  return 'tools';
});

/* ---------- wall / leaderboard ---------- */
let wallTimer = null;
function commentsFor(fileId) { return META.comments[fileId] || []; }
route('/wall', () => {
  view(`<h1>${t('navWall')}èˆ‡å‹•æ…‹ç‰†</h1><p class="sub" id="ws">è®€å–ä¸­â€¦</p>
    <h2>ç¸½åˆ†</h2><div class="list" id="board"></div>
    <h2>æœ€è¿‘å¾—åˆ†</h2><div class="list" id="recent"></div>
    <h2>å¤§å®¶æœ€æ„›çš„å†·çŸ¥è­˜</h2><div class="list" id="facts"></div>
    <h2>å¤§å®¶çš„ä¹å®®æ ¼</h2><p class="sub">çœ‹å®Œå¯ä»¥ç•™ä¸€å¥è©•èªžï¼Œæ¯å¼µç…§ç‰‡ç•™è¨€ä¸€æ¬¡å°± +5 åˆ†ã€‚</p><div class="wall-grid" id="pics"></div>
    <button class="btn ghost block" id="rf" style="margin-top:16px">é‡æ–°æ•´ç†</button>`);
  const paintBoard = (rows) => {
    $('#board').innerHTML = rows.length ? rows.map((r, i) => `<div class="score-row"><span class="rank">${i + 1}</span><span class="name">${esc(r.name)}</span>
      <span class="sub">ä»Šå¤© +${r.today}</span><span class="pts">${r.total}</span></div>`).join('') : '<div class="score-row">é‚„æ²’æœ‰äººå¾—åˆ†</div>';
  };
  const paintRecent = (rows) => {
    $('#recent').innerHTML = rows.length ? rows.slice(0, 20).map((r) => `<div class="score-row"><span class="name">${esc(r.player)}</span>
      <span class="sub">${esc(r.label)}</span><span class="pts">+${r.points}</span></div>`).join('') : '<div class="score-row">é‚„æ²’æœ‰å¾—åˆ†ç´€éŒ„</div>';
  };
  const paintFacts = () => {
    const top = Object.entries(META.likes).map(([id, names]) => [id, names.length]).filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]).slice(0, 5);
    $('#facts').innerHTML = top.length ? top.map(([id, n]) => {
      const [cid, idx] = id.split('#');
      const f = CARD[cid] && CARD[cid].facts[Number(idx)];
      return `<div class="score-row"><span class="name" style="white-space:normal">${esc(plain(f).slice(0, 60))}</span><span class="pts">ðŸ‘ ${n}</span></div>`;
    }).join('') : '<div class="score-row">é‚„æ²’æœ‰äººæŒ‰è®š</div>';
  };
  const paintPics = (collages) => {
    $('#pics').innerHTML = collages.map((p) => `<figure><img loading="lazy" data-id="${esc(p.fileId)}" src="https://drive.google.com/thumbnail?id=${encodeURIComponent(p.fileId)}&sz=w800" alt="${esc(p.player)}çš„ä¹å®®æ ¼ï¼š${esc(p.theme)}">
        <figcaption><b>${esc(p.player)}</b>ãƒ»${esc(p.theme)}<br><span class="sub">${esc(p.city)}ãƒ»${esc(fmtDate(p.date))}</span></figcaption>
        <div class="cmts" data-f="${esc(p.fileId)}"></div></figure>`).join('') || '<p class="sub">é‚„æ²’æœ‰äººä¸Šå‚³ä¹å®®æ ¼ã€‚</p>';
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
    const list = commentsFor(p.fileId).map((c) => `<div class="cmt"><b>${esc(c.player)}</b>ï¼š${esc(c.text)}</div>`).join('');
    box.innerHTML = `${list}
      <div class="row" style="margin-top:6px"><input class="text cmt-in" placeholder="å¯«ä¸€å¥è©•èªž" maxlength="80" ${done ? 'disabled' : ''}>
      <button class="btn small" type="button" ${done ? 'disabled' : ''}>${done ? 'å·²ç•™è¨€' : 'ç•™è¨€ +5'}</button></div>`;
    const btn = $('button', box);
    if (done) return;
    btn.onclick = () => {
      const text = $('.cmt-in', box).value.trim();
      if (text.length < 2) { toast('è©•èªžè‡³å°‘å¯« 2 å€‹å­—'); return; }
      if (!award({ key: 'comment|' + p.fileId, points: 5, label: 'è©•èªžï¼š' + p.theme, cardId: '' })) return;
      DB.qPut({ id: 'c:' + p.fileId + ':' + uid(), type: 'comment', fileId: p.fileId, player: S.player, text, ts: Date.now() }).then(flush);
      META.comments[p.fileId] = commentsFor(p.fileId).concat([{ player: S.player, text }]);
      paintComments(p);
    };
  };
  const load = async () => {
    if (!S.server.url) {
      $('#ws').textContent = 'é‚„æ²’é€£ä¸Šå®¶åº­é›²ç«¯ï¼Œåªé¡¯ç¤ºé€™æ”¯æ‰‹æ©Ÿä¸Šçš„åˆ†æ•¸ã€‚åˆ°ã€Œæˆ‘çš„ã€è¨­å®šå¾Œå°±èƒ½çœ‹åˆ°å…¨å®¶ã€‚';
      paintBoard(localTotals());
      $('#recent').innerHTML = '';
      $('#pics').innerHTML = '';
      return;
    }
    try {
      const d = await apiGet({ action: 'feed', date: today() });
      await syncMeta(d);
      $('#ws').textContent = 'æ¯åˆ†é˜è‡ªå‹•æ›´æ–°ã€‚æœ€å¾Œæ›´æ–°ï¼š' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      paintBoard(d.players || []);
      paintRecent(META.recent);
      paintFacts();
      paintPics(d.collages || []);
    } catch (e) {
      $('#ws').textContent = 'ç¾åœ¨é€£ä¸ä¸Šå®¶åº­é›²ç«¯ï¼Œå…ˆé¡¯ç¤ºé€™æ”¯æ‰‹æ©Ÿä¸Šçš„åˆ†æ•¸ã€‚';
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
  view(`<h1>${t('navMe')}</h1>
    <div class="card"><label class="field"><span>æˆ‘çš„åå­—</span><input class="text" id="nm" value="${esc(S.player)}"></label>
      <p class="section-label">é¡Œç›®é›£åº¦</p>
      <div class="pill-switch" id="md"><button type="button" data-m="basic">åˆéšŽç‰ˆ</button><button type="button" data-m="challenge">æˆ‘è¦æŒ‘æˆ°</button></div>
      <button class="btn small" id="savep" style="margin-top:12px">å„²å­˜</button></div>
    <div class="list">
      <a class="item" href="itinerario.html" target="_blank"><div class="t"><b>ðŸ‡ªðŸ‡¸ è¥¿ç­ç‰™æ–‡è¡Œç¨‹åˆ†äº«é </b><span>å°ˆé–€åˆ†äº«çµ¦è¥¿ç­ç‰™åŒäº‹çœ‹ï¼Œé™„åœ¨åœ°æŽ¨è–¦ç•™è¨€å€</span></div>${CHEV}</a>
      <label class="toggle"><span>é è¦½å…¨éƒ¨ï¼ˆå‡ºç™¼å‰è©¦çŽ©ï¼ŒåŸŽå¸‚å¡å…¨éƒ¨æ‰“é–‹ï¼‰</span><input type="checkbox" id="pv" ${S.preview ? 'checked' : ''}></label>
      <label class="toggle"><span>æš«åœä¸Šå‚³ï¼ˆä¾‹å¦‚åœ¨éƒµè¼ªä¸Šä¸æƒ³ç”¨ç¶²è·¯ï¼‰</span><input type="checkbox" id="pz" ${S.paused ? 'checked' : ''}></label>
    </div>
    <div class="card"><p class="section-label">ä¸Šå‚³æ¸…å–®</p><p id="qc" class="sub">è¨ˆç®—ä¸­â€¦</p><button class="btn small" id="fl">ç¾åœ¨ä¸Šå‚³</button></div>
    <h2>å…¨å®¶åå–®</h2>
    <div class="card"><label class="field"><span>ä¸€è¡Œä¸€å€‹åå­—ï¼ˆéŠæˆ²é–“å’Œçµ¦åˆ†æœƒç”¨åˆ°ï¼‰</span><textarea class="text" id="fam">${esc(S.family.join('\n'))}</textarea></label>
      <button class="btn small" id="savef">å„²å­˜åå–®</button></div>
    <h2>å®¶åº­é›²ç«¯ï¼ˆä¸€å€‹äººè¨­å®šå°±å¥½ï¼‰</h2>
    <div class="card"><label class="field"><span>Apps Script ç¶²å€</span><input class="text" id="su" value="${esc(sv.url)}" placeholder="https://script.google.com/macros/s/â€¦/exec"></label>
      <label class="field"><span>å®¶åº­å¯†ç¢¼</span><input class="text" id="sc" value="${esc(sv.code)}"></label>
      <div class="row"><button class="btn small" id="saves">å„²å­˜ä¸¦æ¸¬è©¦</button><button class="btn small ghost" id="inv">ç”¢ç”Ÿå…¨å®¶é‚€è«‹é€£çµ</button></div>
      <p class="sub" id="invout" style="margin-top:10px">è¨­å®šå¥½å¾ŒæŒ‰ã€Œç”¢ç”Ÿå…¨å®¶é‚€è«‹é€£çµã€ï¼Œè²¼åˆ° LINE ç¾¤çµ„ã€‚å®¶äººé»žé–‹å°±è‡ªå‹•é€£å¥½ï¼Œä¸ç”¨å†è¼¸å…¥ã€‚</p></div>
    <div style="margin-top:16px"><a class="btn ghost block" href="#/admin">ä¸»è¾¦äººå¾Œå°</a></div>
    <p class="sub center">ç‰ˆæœ¬ ${APP_VERSION}</p>`);
  let mode = S.mode;
  const paint = () => $$('#md button').forEach((b) => b.classList.toggle('on', b.dataset.m === mode));
  paint();
  $$('#md button').forEach((b) => b.onclick = () => { mode = b.dataset.m; paint(); });
  $('#savep').onclick = () => {
    const n = $('#nm').value.trim(); if (!n) return toast('åå­—ä¸èƒ½ç©ºç™½');
    LS.set('player', n); LS.set('mode', mode);
    if (!S.family.includes(n)) LS.set('family', S.family.concat(n));
    toast('å·²å„²å­˜');
  };
  $('#pv').onchange = (e) => { LS.set('preview', e.target.checked); toast(e.target.checked ? 'å·²æ‰“é–‹å…¨éƒ¨åŸŽå¸‚å¡' : 'æ¢å¾©æ¯å¤©è§£éŽ–'); };
  $('#pz').onchange = (e) => { LS.set('paused', e.target.checked); if (!e.target.checked) flush(); };
  queueCount().then((n) => { $('#qc').textContent = n ? 'é‚„æœ‰ ' + n + ' ç­†ç­‰è‘—ä¸Šå‚³ã€‚' : 'å…¨éƒ¨éƒ½ä¸Šå‚³å¥½äº†ã€‚'; });
  $('#fl').onclick = () => { if (S.paused) toast('å…ˆé—œæŽ‰ã€Œæš«åœä¸Šå‚³ã€'); else flush(); };
  $('#savef').onclick = () => { LS.set('family', $('#fam').value.split('\n').map((s) => s.trim()).filter(Boolean)); toast('åå–®å·²å„²å­˜'); };
  $('#saves').onclick = async () => {
    LS.set('server', { url: $('#su').value.trim(), code: $('#sc').value.trim() });
    try { const d = await apiGet({ action: 'feed', date: today() }); await syncMeta(d); toast('é€£ç·šæˆåŠŸï¼'); flush(); } catch (e) { toast('é€£ä¸ä¸Šï¼Œè«‹æª¢æŸ¥ç¶²å€å’Œå¯†ç¢¼'); }
  };
  $('#inv').onclick = async () => {
    const sv2 = { url: $('#su').value.trim(), code: $('#sc').value.trim() };
    if (!sv2.url || !sv2.code) { toast('è«‹å…ˆå¡«ç¶²å€å’Œå¯†ç¢¼'); return; }
    LS.set('server', sv2);
    const u = new URL(location.href);
    u.hash = 'join=' + b64urlEncode(JSON.stringify({ u: sv2.url, c: sv2.code, f: S.family }));
    u.searchParams.set('openExternalBrowser', '1');
    const link = u.toString();
    $('#invout').innerHTML = `<b>é‚€è«‹é€£çµï¼š</b><br><span style="word-break:break-all">${esc(link)}</span>`;
    try { await navigator.clipboard.writeText(link); toast('å·²è¤‡è£½ï¼Œè²¼åˆ° LINE ç¾¤çµ„å§'); } catch (e) { toast('è«‹é•·æŒ‰ä¸Šé¢çš„é€£çµè¤‡è£½'); }
  };
  return 'me';
});

/* ---------- admin ---------- */
async function adminCall(payload, code) {
  return api('admin', Object.assign({ admin: code }, payload));
}
route('/admin', () => {
  if (!LS.get('adminCode', '')) {
    view(`${back('#/me', 'æˆ‘çš„')}<h1>ä¸»è¾¦äººå¾Œå°</h1><p class="sub">åªæœ‰ä¸»è¾¦äººéœ€è¦ç”¨ã€‚</p>
      <div class="card"><label class="field"><span>å¾Œå°å¯†ç¢¼</span><input class="text" id="ac" type="password"></label>
      <button class="btn block" id="al">é€²å…¥</button></div>`);
    $('#al').onclick = async () => {
      const code = $('#ac').value;
      try { await adminCall({ op: 'check' }, code); LS.set('adminCode', code); render(); } catch (e) { toast(e.message || 'å¯†ç¢¼ä¸å°'); }
    };
    return 'me';
  }
  renderAdmin();
  return 'me';
});
async function renderAdmin() {
  view(`${back('#/me', 'æˆ‘çš„')}<h1>ä¸»è¾¦äººå¾Œå°</h1>
    <p class="sub" id="ast">è®€å–ä¸­â€¦</p>
    <h2>çŽ©å®¶</h2><p class="sub">åˆªé™¤å¾Œï¼Œä»–çš„åˆ†æ•¸ã€ç•™è¨€ã€è®šéƒ½æœƒæ¸…æŽ‰ï¼Œä¹‹å¾Œä»–æ‰‹æ©Ÿä¸Šçš„è³‡æ–™ä¹Ÿä¸æœƒå†å›žåˆ°å®¶åº­é›²ç«¯ã€‚</p>
    <div class="list" id="plist"></div>
    <h2>æ¯å¤©æˆªæ­¢æ™‚é–“</h2>
    <div class="card"><label class="field"><span>å°ç£æ™‚é–“ï¼Œä¾‹å¦‚ 21:30ï¼ˆç•™ç©ºå°±æ˜¯ä¸æˆªæ­¢ï¼‰</span><input class="text" id="cut" placeholder="HH:MM"></label>
      <button class="btn small" id="sc2">å„²å­˜æ™‚é–“</button></div>
    <h2>é‡æ–°é–‹å§‹</h2>
    <div class="card"><p class="sub">æœƒæ¸…ç©ºæ‰€æœ‰åˆ†æ•¸ã€ç…§ç‰‡ã€ç•™è¨€å’Œè®šã€‚å°ç£æ™‚é–“ 12/7 00:00 ä¹Ÿæœƒè‡ªå‹•æ¸…ç©ºä¸€æ¬¡ã€‚</p>
      <button class="btn small ghost" id="wipe">æ¸…ç©ºå…¨éƒ¨æ¸¬è©¦è³‡æ–™</button></div>
    <button class="btn ghost block" id="lo" style="margin-top:16px">ç™»å‡ºå¾Œå°</button>`);
  const code = LS.get('adminCode', '');
  const load = async () => {
    try {
      const d = await apiGet({ action: 'feed', date: today() });
      await syncMeta(d);
      $('#ast').textContent = 'å·²é€£ä¸Šå®¶åº­é›²ç«¯ã€‚';
      $('#cut').value = d.cutoff || '';
      const names = Array.from(new Set([...(d.players || []).map((p) => p.name), ...S.family]));
      const totals = Object.fromEntries((d.players || []).map((p) => [p.name, p.total]));
      $('#plist').innerHTML = names.length ? names.map((n) => `<div class="score-row"><span class="name">${esc(n)}</span>
        <span class="pts">${totals[n] || 0}</span><button class="btn small ghost" data-del="${esc(n)}" type="button">åˆªé™¤</button></div>`).join('') : '<div class="score-row">é‚„æ²’æœ‰çŽ©å®¶</div>';
      $$('#plist [data-del]').forEach((b) => b.onclick = async () => {
        const n = b.dataset.del;
        if (!confirm('ç¢ºå®šè¦åˆªé™¤ã€Œ' + n + 'ã€å—Žï¼Ÿä»–çš„åˆ†æ•¸ã€ç•™è¨€å’Œè®šéƒ½æœƒæ¸…æŽ‰ï¼Œä¹‹å¾Œä¹Ÿä¸æœƒå†å›žä¾†ã€‚')) return;
        try { await adminCall({ op: 'deletePlayer', name: n }, code); toast('å·²åˆªé™¤ ' + n); load(); } catch (e) { toast(e.message); }
      });
    } catch (e) {
      $('#ast').textContent = 'ç¾åœ¨é€£ä¸ä¸Šå®¶åº­é›²ç«¯ï¼Œè«‹ç¨å¾Œå†è©¦ã€‚';
    }
  };
  $('#sc2').onclick = async () => {
    const v = $('#cut').value.trim();
    if (v && !/^\d{1,2}:\d{2}$/.test(v)) { toast('æ™‚é–“æ ¼å¼è«‹å¯«æˆ 21:30'); return; }
    try { await adminCall({ op: 'setCutoff', value: v }, code); toast('å·²å„²å­˜æˆªæ­¢æ™‚é–“'); } catch (e) { toast(e.message); }
  };
  $('#wipe').onclick = async () => {
    if (!confirm('çœŸçš„è¦æ¸…ç©ºå…¨éƒ¨æ¸¬è©¦è³‡æ–™å—Žï¼Ÿé€™å€‹å‹•ä½œç„¡æ³•å¾©åŽŸã€‚')) return;
    try { await adminCall({ op: 'wipe' }, code); await wipeLocal(); toast('å·²æ¸…ç©ºï¼Œé‡æ–°é–‹å§‹'); load(); } catch (e) { toast(e.message); }
  };
  $('#lo').onclick = () => { LS.set('adminCode', ''); location.hash = '#/me'; };
  load();
}

/* ---------- help ---------- */
route('/help', () => {
  view(`${back('#/', 'é¦–é ')}<h1>çŽ©æ³•èªªæ˜Ž</h1>
    <div class="card"><h3>æ¯å¤©æ—©ä¸Š</h3><p>æ‰“é–‹ã€Œä»Šå¤©ã€ï¼Œè§£éŽ–ä»Šå¤©çš„åŸŽå¸‚å¡ï¼šè®€ä¸€å€‹å†·é–€å°æ•…äº‹ï¼ˆä¸æƒ³è®€å¯ä»¥è·³éŽï¼‰ï¼ŒæŒ‘ä¸€å€‹ä¹å®®æ ¼ä¸»é¡Œï¼Œç­” 3 é¡ŒåŠ åˆ†é¡Œã€‚</p></div>
    <div class="card"><h3>æ¯æ—¥ç¾Žå‘³ Tapa åˆ®åˆ®æ¨‚</h3><p>å°ˆç‚ºçˆ¸åª½å’Œå¼Ÿå¼Ÿè¨­è¨ˆï¼æ¯å¤©åˆ®é–‹ä¸€é“è¥¿ç­ç‰™ç¾Žå‘³é»žå¿ƒæˆ–æº«é¦¨å¥½é‹ï¼Œåªè¦å…¨å®¶ç•¶å¤©æœ‰åƒåˆ°æˆ–åšåˆ°ï¼Œé»žä¸€ä¸‹å°±èƒ½åŠ  20 åˆ†ï¼</p></div>
    <div class="card"><h3>è¥¿ç­ç‰™æ—…è¡Œå¤§åœ–é‘‘</h3><p>å…¨è¥¿ 30 æ¬¾æ¨™èªŒäº‹ç‰©ï¼ˆç«è…¿ã€å‰æ‹¿æ£’ã€ç¾…é¦¬æ°´é“æ©‹ã€ç™½é›ªå…¬ä¸»åŸŽå ¡ã€å¤§é¦¬å£«é©é‹¼åŠç­‰ï¼‰ï¼Œçœ‹åˆ°å°±æ‹ç…§æ‰“å¡é»žäº®åœ–é‘‘ï¼Œæ—…è¡ŒçµæŸå°±æ˜¯ä¸€æœ¬å°ˆå±¬å®¶æ—è¦‹èžæ‰‹å†Šï¼</p></div>
    <div class="card"><h3>åˆ°äº†æ™¯é»ž</h3><p>åœ¨åŸŽå¸‚è£¡é»žæƒ³åŽ»çš„æ™¯é»žå¡ï¼šå…ˆç­”å‡ºç™¼å‰çš„é¡Œç›®ï¼Œçœ‹æ™¯é»žå†·çŸ¥è­˜ï¼ˆè¦ºå¾—æœ‰è¶£å°±æŒ‰è®šï¼‰ï¼Œåˆ°ç¾å ´åšä»»å‹™ï¼Œæœ€å¾Œç­”æ”¶å°¾ 3 é¡Œã€‚</p></div>
    <div class="card"><h3>ä¹å®®æ ¼èˆ‡ç…§ç‰‡ä»»å‹™</h3><p>æ‹æ»¿ 9 å¼µå°±èƒ½ä¸€éµæ‹¼è²¼ã€‚ç…§ç‰‡ä»»å‹™è¦æ‹ç…§ä¸Šå‚³ï¼Œä¸Šå‚³æˆåŠŸæ‰åŠ åˆ†ã€‚</p></div>
    <div class="card"><h3>ç•™è¨€</h3><p>åœ¨ã€ŒæŽ’è¡Œã€çœ‹å¤§å®¶çš„ä¹å®®æ ¼ï¼Œç•™ä¸€å¥è©•èªžå°± +5 åˆ†ï¼Œæ¯å¼µç…§ç‰‡åªèƒ½ç•™ä¸€æ¬¡ã€‚</p></div>
    <div class="card"><h3>è¨ˆåˆ†</h3><p>åˆéšŽé¡Œ 10 åˆ†ã€æŒ‘æˆ°é¡Œ 20 åˆ†ã€é•·é¡Œ 30 åˆ†ã€ç¾å ´é©—è­‰ 20 åˆ†ã€åŠ åˆ†é¡Œ 15 åˆ†ã€ç¾å ´ä»»å‹™ 30 åˆ†ã€ä¹å®®æ ¼ 20 åˆ†ã€ç•™è¨€ 5 åˆ†ã€å°éŠæˆ² 5â€“30 åˆ†ã€‚æ¯é¡Œåªèƒ½ç­”ä¸€æ¬¡ã€‚</p></div>
    <div class="card"><h3>æ²’æœ‰ç¶²è·¯çš„æ™‚å€™</h3><p>é¡Œç›®ã€æ‹ç…§ã€æ‹¼è²¼éƒ½èƒ½ç…§å¸¸çŽ©ã€‚ä¸Šå‚³å’Œåˆ†æ•¸æœƒå…ˆå­˜åœ¨æ‰‹æ©Ÿï¼Œé€£ä¸Šç¶²è·¯å†è‡ªå‹•è£œå‚³ã€‚</p></div>`);
  return 'home';
});

/* ---------- æ¯æ—¥è¡Œç¨‹ï¼šå®Œæ•´ 30 å¤©æ™‚é–“è»¸ï¼ˆå«é¦¬å¾·é‡Œå…è²»æ™‚æ®µæœ€ä½³åŒ–ï¼‰ ---------- */
const WEEK = ['æ—¥', 'ä¸€', 'äºŒ', 'ä¸‰', 'å››', 'äº”', 'å…­'];
function mapUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
function weekOf(date) { const [y, m, d] = date.split('-').map(Number); return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; }
function dayName(date) { return Number(date.slice(5, 7)) + '/' + Number(date.slice(8, 10)) + 'ï¼ˆ' + weekOf(date) + 'ï¼‰'; }
function spotIdByTitle(key) {
  if (!key) return null;
  const hit = Object.values(CARD).find((c) => c.type !== 'city' && c.title.includes(key));
  return hit ? hit.id : null;
}
const STAYS = [
  { date: '2026-12-09', name: 'è–å®¶å ‚æ—é‚Šçš„é£¯åº—', q: 'Sagrada Familia, Barcelona' },
  { date: '2026-12-19', name: 'Avinguda d\'Isabel la CatÃ²lica, 65, 08905 L\'Hospitalet de Llobregat, Barcelona', q: 'Avinguda d\'Isabel la CatÃ²lica, 65, 08905 L\'Hospitalet de Llobregat, Barcelona, Spain' },
  { date: '2026-12-22', name: 'å¡žç¶­åˆ©äºžï¼ˆ92V8+Q2Gï¼‰', q: '37.394444,-5.984917' },
  { date: '2026-12-26', name: 'Plazuela los Bacas, 8, 18500 Guadix, Granadaï¼ˆç‰¹è‰²çª¯æ´žå±‹ï¼‰', q: 'Plazuela los Bacas, 8, 18500 Guadix, Granada, Spain' },
  { date: '2026-12-29', name: 'Av. del Corregidor, 14, Poniente Sur, 14004 CÃ³rdoba', q: 'Av. del Corregidor, 14, 14004 CÃ³rdoba, Spain' },
  { date: '2026-12-31', name: 'é¦¬å¾·é‡Œï¼ˆå¸‚ä¸­å¿ƒä½å®¿ï¼‰', q: 'Puerta del Sol, Madrid, Spain' },
];

/* 30 å¤©å®Œæ•´æ™ºèƒ½æœ€ä½³åŒ–è¡Œç¨‹ */
const PLAN = {
  '2026-12-09': [{ text: 'æŠµé”å·´å¡žéš†ç´ âž” è–å®¶å ‚å‰æ–¹çš„è–èª•å¸‚é›†', q: 'Christmas market Sagrada Familia Barcelona' }],
  '2026-12-10': [
    { text: 'æ¡‚çˆ¾å…¬åœ’ï¼ˆçœ‹å½©è‰²å¤§èœ¥èœ´èˆ‡é¦¬è³½å…‹é•·æ¤…ï¼‰', spot: 'æ¡‚çˆ¾å…¬åœ’', q: 'Park GÃ¼ell Barcelona' },
    { text: 'è–éœ²è¥¿äºžè–èª•å¸‚é›†ï¼ˆæ‰¾ Caganer èˆ‡ Caga TiÃ³ï¼‰', tentative: true, q: 'Fira de Santa LlÃºcia Barcelona' },
    { text: 'ç•¢å¡ç´¢åšç‰©é¤¨ï¼ˆå°‘å¹´ç•¢å¡ç´¢æ™‚æœŸï¼‰', tentative: true, spot: 'ç•¢å¡ç´¢', q: 'Museu Picasso Barcelona' },
  ],
  '2026-12-11': [
    { when: 'ç™½å¤©', text: 'è–å®¶å ‚ï¼ˆå·²å®šï¼‰', spot: 'è–å®¶å ‚', q: 'Sagrada FamÃ­lia Barcelona' },
    { when: 'ä¸‹åˆ', text: 'è–ä¿ç¾…é†«é™¢ï¼ˆç¾ä»£ä¸»ç¾©ä¸–ç•Œéºç”¢å»ºç¯‰ç¾¤ï¼‰', tentative: true, spot: 'è–ä¿ç¾…é†«é™¢', q: 'Hospital de Sant Pau Barcelona' },
    { when: 'æ™šä¸Š', text: 'å·´ç‰¹ç•¥ä¹‹å®¶ï¼ˆå¤¢å¹»é¾è„Šå±‹é ‚ï¼‰', tentative: true, spot: 'å·´ç‰¹ç•¥ä¹‹å®¶', q: 'Casa BatllÃ³ Barcelona' },
    { when: 'æ™šä¸Š', text: 'æ ¼æ‹‰è¥¿äºžå¤§é“èˆ‡å¸‚å€è–èª•ç‡ˆé£¾æ¼«æ­¥', q: 'Passeig de GrÃ cia Barcelona' },
  ],
  '2026-12-12': [
    { when: 'æ—©ä¸Š', text: 'ç¬¬äºŒæ‰¹äººåƒè§€è–å®¶å ‚', spot: 'è–å®¶å ‚', q: 'Sagrada FamÃ­lia Barcelona' },
    { when: 'ä¸­åˆ', text: 'å·´å¡žéš†ç´æ¸¯å£ âž” ç™»ä¸Šåœ°ä¸­æµ·è±ªè¯éƒµè¼ªï¼', q: 'Port de Barcelona' },
  ],
  '2026-12-13': [
    { text: 'æ³•åœ‹é¦¬è³½ãƒ»å®ˆè­·è–æ¯é™¢ï¼ˆä¿¯çž°åœ°ä¸­æµ·æµ·æ¸¯ï¼‰', spot: 'å®ˆè­·è–æ¯é™¢', q: 'Notre-Dame de la Garde Marseille' },
    { text: 'é¦¬è³½ãƒ»èˆŠæ¸¯èˆ‡å½©è‰² Le Panier è€åŸŽå··å¼„', spot: 'Le Panier', q: 'Le Panier Marseille' },
  ],
  '2026-12-14': [
    { text: 'ç¾©å¤§åˆ©ç†±é‚£äºžãƒ»ç¾…åˆ©å®®æ®¿é«”ç³»æ–°è¡—è€åŸŽ', spot: 'è€åŸŽèˆ‡æ–°è¡—', q: 'Genova centro storico' },
    { text: 'ç†±é‚£äºžãƒ»èˆŠæ¸¯èˆ‡æ­æ´²æœ€å¤è€ç‡ˆå¡”', spot: 'èˆŠæ¸¯èˆ‡ç‡ˆå¡”', q: 'Porto Antico Genova' },
  ],
  '2026-12-15': [{ text: 'ç¾©å¤§åˆ©é‚£ä¸å‹’æ–¯ãƒ»é¾è²å¤åŸŽéºå€æŽ¢ç¥•', spot: 'é¾è²', q: 'Pompeii' }],
  '2026-12-16': [
    { text: 'è¥¿è¥¿é‡Œå·´å‹’æ‘©ãƒ»ä¸»æ•™åº§å ‚èˆ‡å¸•æ‹‰æç´é‡‘è‰²ç¦®æ‹œå ‚', spot: 'ä¸»æ•™åº§å ‚èˆ‡å¸•æ‹‰æç´', q: 'Palermo Cathedral' },
    { text: 'è¥¿è¥¿é‡Œå·´å‹’æ‘©ãƒ»å·´æ‹‰ç¾…ç†±é¬§å‚³çµ±å¸‚å ´èˆ‡ Teatro Massimo', spot: 'å·´æ‹‰ç¾…å¸‚å ´', q: 'Mercato di BallarÃ² Palermo' },
  ],
  '2026-12-17': [
    { text: 'åŒ—éžçªå°¼è¥¿äºžãƒ»è¿¦å¤ªåŸºå¸åœ‹åƒå¹´éºå€', spot: 'è¿¦å¤ªåŸº', q: 'Carthage Tunisia' },
    { text: 'çªå°¼è¥¿äºžãƒ»è—ç™½ç«¥è©±å°éŽ®è¥¿è¿ªå¸ƒè³½ç¾©å¾·ï¼ˆå–æ¾å­è–„è·èŒ¶ï¼‰', spot: 'è¥¿è¿ªå¸ƒè³½ç¾©å¾·', q: 'Sidi Bou Said' },
  ],
  '2026-12-18': [{ text: 'åœ°ä¸­æµ·å·¡èˆªæ—¥ãƒ»åœ¨éƒµè¼ªä¸Šå¹æµ·é¢¨ã€çŽ©å®¶æ—éŠæˆ²èˆ‡æ”¾é¬†', q: '' }],
  '2026-12-19': [{ when: '17:00', text: 'åŠ æ³°éš†å°¼äºžéŸ³æ¨‚å®®è‡ªç”±åƒè§€ï¼‹è–èª•ç¯€éŸ³æ¨‚èˆžè¹ˆæœƒ', spot: 'éŸ³æ¨‚å®®', q: 'Palau de la MÃºsica Catalana' }],
  '2026-12-20': [
    { text: 'è’™ç‰¹æƒ å…‹å±±ï¼ˆMontjuÃ¯cï¼‰åŸŽå ¡èˆ‡è¥¿ç­ç‰™æ‘', spot: 'è’™ç‰¹æƒ å…‹', q: 'MontjuÃ¯c Barcelona' },
    { text: 'åŠ æ³°éš†å°¼äºžåœ‹å®¶è—è¡“åšç‰©é¤¨ï¼ˆMNACï¼‰å‰çœ‹æ—¥è½', q: 'Museu Nacional d\'Art de Catalunya' }
  ],
  '2026-12-21': [
    { text: 'è˜­å¸ƒæ‹‰å¤§é“ã€åšè“‹åˆ©äºžå‚³çµ±å¸‚å ´æŽ¡è²·æ°´æžœç«è…¿', q: 'Mercat de la Boqueria Barcelona' },
    { text: 'æ•´ç†è¡ŒæŽï¼Œæº–å‚™æ­ AVE é«˜éµå—ä¸‹å®‰é”é­¯è¥¿äºž', q: 'Barcelona Sants' }
  ],
  '2026-12-22': [
    { text: 'æŠµé”å¡žç¶­äºž âž” æ”¶éŸ³æ©Ÿè½è–èª•å¤§æ¨‚é€ã€Œèƒ–å­æ¨‚é€ã€å”±è™Ÿé–‹çŽ', q: 'Sevilla Santa Justa' },
    { text: 'è–åå­—å€ï¼ˆBarrio de Santa Cruzï¼‰æ©˜å­æ¨¹å°å··æ¼«æ­¥', q: 'Barrio de Santa Cruz Sevilla' }
  ],
  '2026-12-23': [
    { text: 'å¡žç¶­äºžä¸»æ•™åº§å ‚èˆ‡å‰æ‹‰é”é˜æ¨“ï¼ˆä¸–ç•Œç¬¬ä¸‰å¤§å¤©ä¸»æ•™å ‚ï¼‰', q: 'Catedral de Sevilla' },
    { text: 'è¥¿ç­ç‰™å»£å ´ï¼ˆPlaza de EspaÃ±aï¼‰ç§Ÿå°èˆ¹åˆ’æ°´èˆ‡ç‘ªéº—äºžè·¯æ˜“èŽŽå…¬åœ’', q: 'Plaza de EspaÃ±a Sevilla' }
  ],
  '2026-12-24': [
    { text: 'å¡žç¶­äºžçŽ‹å®®ï¼ˆReal AlcÃ¡zarï¼Œæ‘©çˆ¾å®®æ®¿èˆ‡ç†±å¸¶èŠ±åœ’ï¼‰', q: 'Real AlcÃ¡zar de Sevilla' },
    { text: 'é»ƒé‡‘å¡”èˆ‡ç“œé”å¹¾ç¶­æ²³ç•”æ•£æ­¥', q: 'Torre del Oro Sevilla' },
    { text: 'ã€å¹³å®‰å¤œã€‘å…¨å®¶åœ¨å¡žç¶­äºžæº«é¦¨èšé¤ï¼Œå“åšä¼Šæ¯”åˆ©ç«è…¿èˆ‡æä»ç³–', q: '' }
  ],
  '2026-12-25': [
    { text: 'ã€è–èª•ç¯€ã€‘å¡žç¶­äºžå¤åŸŽè–èª•æ‚ é–’æ¼«æ­¥ã€ç‰¹é‡Œäºžç´å€ï¼ˆTrianaï¼‰', q: 'Triana Sevilla' },
    { text: 'æ¬£è³žä¸€å ´ç†±æƒ…ç´”ç²¹çš„å®‰é”é­¯è¥¿äºžä½›æœ—æ˜Žå“¥å‰ä»–èˆžè¹ˆæ¼”å‡º', q: 'Flamenco Sevilla' }
  ],
  '2026-12-26': [
    { text: 'å‰å¾€ç“œè¿ªæ–¯ï¼ˆGuadixï¼‰âž” å…¥ä½å¤¢å¹»å†¬æš–å¤æ¶¼çš„ã€Œç™½ç…™å›ªçª¯æ´žå±‹ã€', q: 'Plazuela los Bacas, Guadix' },
    { text: 'ç“œè¿ªæ–¯è€åŸŽå¤§æ•™å ‚èˆ‡ç™½ç…™å›ªè§€æ™¯å°', q: 'Catedral de Guadix' }
  ],
  '2026-12-27': [
    { when: '14:30', text: 'æ ¼æ‹‰é‚£é”ãƒ»é˜¿çˆ¾ç½•å¸ƒæ‹‰å®®èˆ‡ç´æ–¯é‡Œå¾·å®®æ®¿ï¼ˆPalacios NazarÃ­esï¼‰', spot: 'é˜¿çˆ¾ç½•å¸ƒæ‹‰', note: 'å·²è¨‚ç¥¨ï¼š14:30 é€²å…¥ Palacios NazarÃ­es', q: 'Alhambra Granada' },
    { text: 'é˜¿çˆ¾æ‹œè¾›å€ï¼ˆAlbaicÃ­nï¼‰è–å°¼å¤æ‹‰æ–¯è§€æ™¯å°çœºæœ›ç´…å ¡å¤•é™½èˆ‡å…§è¯é”é›ªå±±', q: 'Mirador de San NicolÃ¡s Granada' }
  ],
  '2026-12-28': [
    { text: 'ç“œè¿ªæ–¯åƒç˜¡ç™¾å­”é«˜åŽŸåœ°å½¢ãƒ»å››é©…è¶Šé‡Žè»ŠæŽ¢éšª', q: 'Guadix badlands' },
    { text: 'å‰å¾€åƒå¹´ä¸­ä¸–ç´€å¤åŸŽå“¥å¤šè¯ï¼ˆCÃ³rdobaï¼‰', q: 'CÃ³rdoba Spain' }
  ],
  '2026-12-29': [
    { text: 'å“¥å¤šè¯ãƒ»å¤§æ¸…çœŸå¯º-ä¸»æ•™åº§å ‚ï¼ˆMezquita-Catedralï¼Œé©šè±”ç´…ç™½é›™å±¤æ‹±é–€æ£®æž—ï¼‰', q: 'Mezquita-Catedral de CÃ³rdoba' },
    { text: 'çŒ¶å¤ªäººè¡—å€ã€ç™¾èŠ±å··ï¼ˆCalleja de las Floresï¼‰æ‰“å¡', q: 'Calleja de las Flores CÃ³rdoba' }
  ],
  '2026-12-30': [
    { text: 'å“¥å¤šè¯ãƒ»åŸºç£æ•™å›ä¸»åŸŽå ¡èˆ‡å¤ç¾…é¦¬å¤§çŸ³æ©‹', q: 'AlcÃ¡zar de los Reyes Cristianos CÃ³rdoba' },
    { text: 'æ­ä¹˜ AVE é«˜éµæŠµé”è¥¿ç­ç‰™é¦–éƒ½é¦¬å¾·é‡Œï¼', q: 'Madrid Puerta de Atocha' }
  ],
  '2026-12-31': [
    { text: 'é¦¬å¾·é‡Œè€åŸŽæ¼«æ­¥ï¼šå¤ªé™½é–€å»£å ´ã€ä¸»å»£å ´ï¼ˆPlaza Mayorï¼‰ã€è–ç±³æ ¼çˆ¾å¸‚å ´', spot: 'å¤ªé™½é–€èˆ‡ä¸»å»£å ´', q: 'Puerta del Sol Madrid' },
    { text: 'æŽ¡è²·è·¨å¹´å°ˆç”¨ã€Œ12 é¡†é–‹é‹é’è‘¡è„ã€èˆ‡ç‹‚æ­¡å°é“å…·', q: 'Mercado de San Miguel' },
    { when: 'æ·±å¤œ 23:30', text: 'ã€è·¨å¹´å€’æ•¸ã€‘å¤ªé™½é–€é˜æ¨“ä¸‹ï¼Œèˆ‡å…¨è¥¿ç­ç‰™ç¾¤çœ¾éš¨ 12 éŸ¿é˜è²åƒå®Œ 12 é¡†è‘¡è„è¿Žæ–°å¹´ï¼', note: 'è‹¥äººæ½®æ“æ“ ï¼Œäº¦å¯æ–¼ä½å®¿å®¢å»³æ”¶çœ‹é›»è¦–é˜æ¨“ç›´æ’­åŒæ­¥åƒè‘¡è„', q: 'Real Casa de Correos Madrid' }
  ],
  '2027-01-01': [
    { text: 'ã€å…ƒæ—¦å…¬ä¼‘æ—¥ã€‘å…¨è¥¿å®¤å…§åšç‰©é¤¨ä¼‘é¤¨ï¼Œé©åˆå…¨å®¶æ¼«æ­¥æˆ¶å¤–å¤§è‡ªç„¶', q: 'Parque de El Retiro Madrid' },
    { text: 'æ¼«æ­¥ç¶ æ„ç›Žç„¶çš„ã€Œéº—æ± å…¬åœ’ã€ï¼ˆParque del Retiroï¼‰ã€æ°´æ™¶å®®èˆ‡é˜¿çˆ¾å¡æ‹‰é–€', spot: 'éº—æ± å…¬åœ’', q: 'Palacio de Cristal Retiro Madrid' },
    { text: 'ç™¾å¹´è€åº— ChocolaterÃ­a San GinÃ©s äº«ç”¨æš–å‘¼å‘¼ç†±å·§å…‹åŠ›é…å‰æ‹¿æ£’', q: 'ChocolaterÃ­a San GinÃ©s Madrid' }
  ],
  '2027-01-02': [
    { when: '14:00èµ·', text: 'ã€å…è²»æ™‚æ®µã€‘åœ‹ç«‹è€ƒå¤åšç‰©é¤¨ï¼ˆMANï¼Œé€±å…­14:00å¾Œå…¨é¢å…è²»ï¼çœ‹åŸƒçˆ¾åˆ‡å¤«äººèˆ‡ç“œæ‹‰è–©çˆ¾ç´”é‡‘çŽ‹å† ï¼‰', spot: 'åœ‹ç«‹è€ƒå¤åšç‰©é¤¨', q: 'Museo ArqueolÃ³gico Nacional Madrid' },
    { when: '18:00â€“20:00', text: 'ã€å…è²»æ™‚æ®µã€‘æ™®æ‹‰å¤šç¾Žè¡“é¤¨ï¼ˆMuseo del Pradoï¼Œé€±å…­18:00-20:00å…è²»å…¥å ´ï¼è³žå§”æ‹‰æ–¯è“‹èŒ²ã€Šä¾å¥³ã€‹èˆ‡å“¥é›…ï¼‰', spot: 'æ™®æ‹‰å¤šç¾Žè¡“é¤¨', q: 'Museo del Prado Madrid' }
  ],
  '2027-01-03': [
    { text: 'ã€é«˜éµéƒŠå€ä¸€æ—¥éŠã€‘å‰å¾€ã€Œå¡žå“¥ç¶­äºžã€ï¼ˆSegoviaï¼Œé«˜éµåƒ…éœ€ 28 åˆ†é˜ï¼‰', spot: 'è³½å“¥ç¶­äºž', q: 'Acueducto de Segovia' },
    { text: 'ä»°æœ›å£¯è§€å¤ç¾…é¦¬æ°´é“æ©‹ã€æ¼«æ­¥è‡³è¿ªå£«å°¼ç™½é›ªå…¬ä¸»åŸŽå ¡åŽŸåž‹ã€Œé˜¿çˆ¾å¡è–©åŸŽå ¡ã€', q: 'AlcÃ¡zar de Segovia' },
    { text: 'åˆé¤å“åšå¡žå“¥ç¶­äºžæœ€é¦³åçš„å‚³çµ±é¦™è„†çƒ¤ä¹³è±¬ï¼ˆCochinillo Asadoï¼‰', q: 'MesÃ³n de CÃ¡ndido Segovia' }
  ],
  '2027-01-04': [
    { text: 'ã€é«˜éµéƒŠå€ä¸€æ—¥éŠã€‘é¿é–‹é€±ä¸€é¦¬å¾·é‡Œåšç‰©é¤¨ä¼‘é¤¨ï¼Œå‰å¾€ä¸‰æ–‡åŒ–ä¹‹éƒ½ã€Œæ‰˜é›·å¤šã€ï¼ˆToledoï¼Œé«˜éµ 33 åˆ†é˜ï¼‰', spot: 'æ‰˜é›·å¤š', q: 'Catedral de Toledo' },
    { text: 'è¥¿ç­ç‰™é¦–å¸­ä¸»æ•™åº§å ‚ã€è–å¤šé»˜æ•™å ‚æ¬£è³žè‘›é›·æŸ¯åä½œã€Šå¥§åŠ èŒ²ä¼¯çˆµçš„è‘¬ç¦®ã€‹ã€å¤§é¦¬å£«é©é‡‘çµ²é‹¼åŠå·¥è—', q: 'Iglesia de Santo TomÃ© Toledo' },
    { text: 'æ²³è°·è§€æ™¯å°ï¼ˆMirador del Valleï¼‰ä¿¯çž°æ‰˜é›·å¤šå¤åŸŽèˆ‡é˜¿çˆ¾å¡è–©åŸŽå ¡å£¯éº—å…¨æ™¯', q: 'Mirador del Valle Toledo' }
  ],
  '2027-01-05': [
    { when: 'ä¸Šåˆ', text: 'åƒè§€å¥¢è¯çš„ã€Œè¥¿ç­ç‰™çŽ‹å®®ã€ï¼ˆPalacio Real de Madridï¼‰èˆ‡çš‡å®¶å…µå™¨åº«', spot: 'é¦¬å¾·é‡ŒçŽ‹å®®', q: 'Palacio Real de Madrid' },
    { when: '18:30â€“21:00', text: 'ã€ä¸‰çŽ‹ç¯€å‰å¤•å¹´åº¦ç››å…¸ã€‘é¦¬å¾·é‡Œä¸‰çŽ‹ç¯€å¤§éŠè¡Œï¼ˆCabalgata de Reyes Magosï¼Œå…¨å®¶å¸¶å€’æ’é›¨å‚˜æ²¿å¤§é“æ¶ç³–æžœï¼ï¼‰', note: 'è·¯ç·šï¼šPaseo de la Castellana è‡³ Plaza de Cibeles', q: 'Plaza de Cibeles Madrid' }
  ],
  '2027-01-06': [
    { text: 'ã€ä¸‰çŽ‹ç¯€ä¸»æ—¥ã€‘æ—©æ™¨å…¨å®¶äº«ç”¨å‚³çµ±ã€Œåœ‹çŽ‹è›‹ç³•ã€ï¼ˆRoscÃ³n de Reyesï¼‰ï¼Œçœ‹èª°åƒåˆ°å¹¸é‹é™¶å¶', q: '' },
    { text: 'åƒè§€åœ‹ç«‹è˜‡è²äºžçŽ‹åŽè—è¡“ä¸­å¿ƒï¼Œè¦ªç¹ç•¢å¡ç´¢åæˆ°å·¨ä½œã€Šæ ¼çˆ¾å°¼å¡ã€‹çœŸè·¡', spot: 'è˜‡è²äºžçŽ‹åŽ', q: 'Museo Reina SofÃ­a Madrid' },
    { text: 'æ•´ç†è¡ŒæŽã€æœ€å¾ŒæŽ¡è²·ä¼´æ‰‹ç¦®ï¼Œå¸¶è‘—æ»¿æ»¿æ­¡ç¬‘èˆ‡å›žæ†¶å¹³å®‰è¿”å›žå°ç£ï¼', q: 'Aeropuerto Adolfo SuÃ¡rez Madrid-Barajas' }
  ],
};

function cityLabel(date) {
  const u = C.unlock[date];
  if (!u) return '';
  return u[0] === 'cruise' ? 'åœ°ä¸­æµ·éƒµè¼ª' : CITY[u[0]].name;
}
route('/trip', () => {
  const dates = [];
  for (let d = new Date(TRIP_START + 'T00:00:00Z'); ; d = new Date(d.getTime() + 86400000)) {
    const iso = d.toISOString().slice(0, 10);
    dates.push(iso);
    if (iso >= TRIP_END) break;
  }
  const stays = STAYS.map((x) => `<div class="score-row" style="align-items:flex-start"><span class="name" style="white-space:normal">${esc(dayName(x.date))}<br><span class="sub">${esc(x.name)}</span></span>
    <a class="btn small ghost" href="${esc(mapUrl(x.q))}" target="_blank" rel="noopener">åœ°åœ–</a></div>`).join('');
  const rows = dates.map((date) => {
    const items = PLAN[date] || [];
    const label = cityLabel(date);
    const body = items.length ? items.map((it) => {
      const sid = spotIdByTitle(it.spot);
      const tag = it.tentative ? '<span class="chip">æœªå®š</span>' : '';
      const mapBtn = it.q ? `<a class="btn small ghost" href="${esc(mapUrl(it.q))}" target="_blank" rel="noopener">åœ°åœ–</a>` : '';
      const cardBtn = sid ? `<a class="btn small ghost" href="#/card/${sid}">ä»»å‹™å¡</a>` : '';
      return `<li><div class="plan-main">${it.when ? `<span class="chip warn" style="font-size:12px;padding:1px 6px;margin-right:4px">${esc(it.when)}</span> ` : ''}<b>${esc(it.text)}</b> ${tag}
        ${it.note ? `<div class="sub" style="color:var(--warn);margin-top:2px">${esc(it.note)}</div>` : ''}</div>
        <div class="plan-btns">${mapBtn}${cardBtn}</div></li>`;
    }).join('') : `<p class="sub">é‚„æ²’å®šï¼Œé€™å¤©åœ¨${esc(label)}ã€‚</p>`;
    return `<details class="day"${items.length ? ' open' : ''}><summary><span class="dot"></span><span class="dt">${esc(dayName(date))}</span>
        <span class="dc">${esc(label)}</span></summary>
        <div class="day-body"><ul class="plan-list">${items.length ? body : ''}</ul>${items.length ? '' : body}</div></details>`;
  }).join('');
  view(`${back('#/', t('navHome'))}<h1>æ¯æ—¥è¡Œç¨‹</h1>
    <div style="margin-bottom:14px">
      <a class="btn block" href="itinerario.html" target="_blank" style="background:var(--card);border:2px solid var(--primary);color:var(--primary)">ðŸ‡ªðŸ‡¸ æ‰“é–‹è¥¿ç­ç‰™æ–‡å°ˆå±¬è¡Œç¨‹é ï¼ˆçµ¦åŒäº‹åˆ†äº«ï¼‰</a>
    </div>
    <div class="card"><b>åšç‰©é¤¨å…è²»å°æ’‡æ­¥ï¼š</b>1/2 é€±å…­ 14:00 å¾Œåœ‹ç«‹è€ƒå¤åšç‰©é¤¨å…è²»ã€18:00â€“20:00 æ™®æ‹‰å¤šç¾Žè¡“é¤¨å…è²»ï¼›1/4 é€±ä¸€å®‰æŽ’æ‰˜é›·å¤šå‰›å¥½é¿é–‹å¸‚å€ä¼‘é¤¨ï¼</div>
    <h2>ä½å®¿åœ°é»ž</h2><div class="list">${stays}</div>
    <h2>30 å¤©å®Œæ•´æ™‚é–“è»¸</h2><p class="sub">åŒ…å«æ‰€æœ‰æ™¯é»žä»»å‹™é€£çµèˆ‡ Google Maps åœ°åœ–å°Žèˆªã€‚</p>
    <div class="timeline">${rows}</div>`);
  return 'home';
});

/* ---------- start ---------- */
async function start() {
  handleJoin();
  if (inAppBrowser()) { renderGate(); return; }
  try { await loadContent(); } catch (e) {
    $('#app').innerHTML = '<div class="gate"><h1>è®€ä¸åˆ°å…§å®¹</h1><p>è«‹ç¢ºèªç¶²è·¯ï¼Œæˆ–ç¨å¾Œå†é–‹ä¸€æ¬¡ã€‚</p></div>';
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