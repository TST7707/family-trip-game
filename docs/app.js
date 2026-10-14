'use strict';
/* 家族任務遊戲 — single-page app. Content comes from content.json (generated from the script). */
const APP_VERSION = '1.1.0';
const TRIP_START = '2026-12-09';
const TRIP_END = '2027-01-06';

/* ---------- small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

/* ---------- scoring ---------- */
function ledger() { return LS.get('ledger', []); }
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
let flushing = false;
async function flush() {
  if (flushing || S.paused || !S.server.url || !navigator.onLine) return;
  flushing = true;
  try {
    const items = await DB.qAll();
    const scores = items.filter((i) => i.type === 'score');
    if (scores.length) {
      await api('score', { entries: scores.map((s) => s.entry) });
      for (const s of scores) await DB.qDel(s.id);
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
    }
    if (n) toast('上傳完成，共 ' + n + ' 張');
  } catch (e) {
    if (String(e.message) !== 'no server') toast('上傳暫停，連上網路後會自動再試');
  } finally {
    flushing = false;
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

/* ---------- onboarding ---------- */
route('/onboard', () => {
  view(`<h1>歡迎！</h1>
    <p class="sub">先告訴我你是誰，分數和照片都會記在你名下。</p>
    <label class="field"><span>你的名字（例如：爸爸、阿嬤、弟弟）</span><input class="text" id="nm" autocomplete="name" value="${esc(S.player)}"></label>
    <p class="section-label">題目難度</p>
    <div class="pill-switch" id="md"><button type="button" data-m="basic">初階版</button><button type="button" data-m="challenge">我要挑戰</button></div>
    <p class="sub" style="margin-top:8px">初階版只答比較簡單的題目；我要挑戰全部都答，挑戰題分數加倍。之後在「我的」可以改。</p>
    <button class="btn block" id="go" style="margin-top:16px">開始玩</button>`);
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
    hero = `<div class="hero"><div class="sub">今天解鎖</div><h2 style="margin:4px 0 12px">${esc(CITY[tc.city].name)}・${esc(tc.title)}</h2>
      <a class="btn block" href="#/card/${tc.id}">打開今天的城市卡</a></div>`;
  } else if (t < TRIP_START) {
    const days = Math.ceil((new Date(TRIP_START) - new Date(t)) / 86400000);
    hero = `<div class="hero"><div class="sub">距離出發還有</div><div class="big-num">${days} 天</div>
      <p style="margin:8px 0 0">城市卡會在當天早上解鎖。想先看看，可以到「我的」打開「預覽全部」。</p></div>`;
  } else if (t > TRIP_END) {
    hero = `<div class="hero"><h2 style="margin:0 0 8px">旅程結束了</h2><p style="margin:0">到「排行」看看全家的總分和所有九宮格。</p></div>`;
  }
  const tiles = C.cities.map((c) => `<a class="city-tile" href="#/city/${c.id}"><b>${esc(c.name)}</b>
    <span>城市卡 ${c.cityCards.length} 張・景點 ${c.spots.length} 個</span></a>`).join('');
  view(`<div class="sub">${esc(S.player)}，你好</div><h1>家族任務遊戲</h1>${hero}
    <h2>選一座城市</h2><div class="grid2">${tiles}</div>
    <div style="margin-top:16px"><a class="btn ghost block" href="#/help">玩法說明</a></div>`);
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
  view(`${back('#/', '首頁')}<h1>${esc(city.name)}</h1>${city.intro.map((p) => `<p class="sub">${p}</p>`).join('')}
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

/* ---------- card page ---------- */
const TOOL_FOR = [['命運之輪', 'wheel'], ['物價', 'price'], ['步數', 'steps'], ['神秘任務', 'secret']];
route('/card/:id', (id) => {
  const card = CARD[id];
  if (!card) { location.hash = '#/'; return; }
  if (!isUnlocked(card)) { view(`${back('#/city/' + card.city, CITY[card.city].name)}<h1>還沒解鎖</h1><p>這張城市卡 ${fmtDate(cardDate(card))} 才會解鎖。</p>`); return 'home'; }
  const city = CITY[card.city];
  const d = cardDate(card);
  let html = `${back('#/city/' + city.id, city.name)}<div class="row"><span class="chip">${esc(card.port || city.name)}</span>${d ? `<span class="chip">${fmtDate(d)}</span>` : ''}</div>
    <h1>${esc(card.title)}</h1>`;
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
    html += `<button type="button" class="btn ghost block" data-jump="q-p" style="margin-bottom:12px">不想讀？直接跳到題目</button>
      <details class="read" open><summary>景點小知識 <span class="sub">點一下收起來</span></summary><div class="inner reading">
      ${card.facts.length ? '<ul class="facts">' + card.facts.map((f) => `<li>${f}</li>`).join('') + '</ul>' : ''}
      ${card.story.map((p) => `<p>${p}</p>`).join('')}</div></details>
      <p><b>準備好挑戰今天的任務了嗎？</b></p>`;
    html += quizHtml(card, 'p', '出發前的題目');
    if (card.game && card.hasGame) {
      const tool = TOOL_FOR.find(([k]) => card.game.name.includes(k));
      html += `<div class="gamebox"><h3>景點小遊戲：${esc(card.game.name)}</h3><p>${card.game.rules}</p>
        ${tool ? `<a class="btn small" href="#/tool/${tool[1]}">打開${esc(tool[0])}工具</a>` : ''}</div>`;
    }
    if (card.tasks.length) {
      html += `<h2>現場任務</h2><div class="stack">${card.tasks.map((t, i) => `<div class="card"><p>${t}</p>
        <button class="btn small ghost" data-task="${i}">我們完成了 +30</button></div>`).join('')}</div>`;
    }
    html += `<a class="btn ghost block" href="#/grid/${card.id}/S">開一個這個景點的九宮格</a>`;
    html += quizHtml(card, 'q', '收尾 3 題');
  }
  view(html);
  bindQuiz(card);
  $$('[data-jump]').forEach((b) => b.onclick = () => { const t = document.getElementById(b.dataset.jump); if (t) t.scrollIntoView({ behavior: 'smooth' }); });
  $$('[data-task]').forEach((b) => {
    const k = 'task|' + card.id + '|' + b.dataset.task;
    if (ledger().some((e) => e.id === S.player + '|' + k)) { b.disabled = true; b.textContent = '已完成'; }
    b.onclick = () => { if (award({ key: k, points: 30, label: '任務：' + card.title, cardId: card.id })) { b.disabled = true; b.textContent = '已完成'; } };
  });
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
      <p class="sub" style="margin-top:8px">${S.server.url ? '會上傳 9 張原圖和這張拼貼。沒網路時先存在手機，連上網再自動補傳。' : '還沒連上家庭雲端（到「我的」設定），可以先存到手機。'}</p>`;
    $('#save').onclick = () => saveBlob(blob, theme.title + '-九宮格.jpg');
    $('#up').onclick = async () => {
      if (!S.server.url) { toast('請先到「我的」設定家庭雲端'); return; }
      const city = CITY[card.city];
      const base = { player: S.player, cardId: card.id, cardTitle: card.title, city: city.name, theme: theme.title, date: today() };
      const ts = Date.now();
      for (let i = 0; i < 9; i++) {
        await DB.qPut({ id: 'p:' + slotKey(cardId, key, i) + ':' + ts, type: 'photo', ts: ts + i, key: slotKey(cardId, key, i), meta: Object.assign({ slot: i + 1, kind: 'original' }, base) });
      }
      await DB.qPut({ id: 'p:' + slotKey(cardId, key, 'collage') + ':' + ts, type: 'photo', ts: ts + 9, key: slotKey(cardId, key, 'collage'), meta: Object.assign({ slot: 0, kind: 'collage' }, base) });
      award({ key: 'grid|' + card.id + '|' + key, points: 20, label: '九宮格：' + theme.title, cardId: card.id });
      toast('已排進上傳清單');
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
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#000000'; g.font = 'bold 46px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif';
  g.fillText(themeTitle.slice(0, 18), 24, 64);
  g.fillStyle = '#57575A'; g.font = '30px -apple-system, "PingFang TC", "Noto Sans TC", sans-serif';
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

/* ---------- tools ---------- */
const SECRET_TASKS = [
  '讓一位家人不知不覺說出「好好吃」三次。', '偷拍到一位家人打哈欠的瞬間。', '讓一位家人跟一座雕像擺一樣的姿勢合照，不能說是任務。',
  '讓全家在同一張照片裡同時比 YA。', '用當地話說「謝謝」給 3 個不同的人聽，還要讓家人注意到。', '讓一位家人幫你拍一張「你和一扇藍色的門」。',
  '偷拍到一位家人吃東西吃到一半的瞬間。', '讓一位家人自己說出今天景點的名字，不能提示。', '晚餐時讓大家討論 30 秒「今天學到的一件事」。',
  '找到一隻狗，讓一位家人跟牠合照。', '讓家人用你的手機幫你拍一張跳起來的照片。', '收集 3 張不同的票根或收據。',
  '讓兩位家人在照片裡牽手。', '讓一位家人用「累」以外的形容詞形容今天。', '偷偷記下一位家人今天說了幾次「好漂亮」，晚上公布。',
  '讓一位家人陪你買一樣東西，不能說是任務。', '拍到一位家人和街頭藝人的合照。', '讓一張全家福裡每個人身上都有紅色。',
  '讓一位家人請你喝一杯飲料。', '拍到一位家人認真看地圖的照片。', '今天幫每位家人各拍一張「最佳照片」。',
  '讓一位家人跟你學一句西班牙文或加泰隆尼亞文。', '拍到一張鐘樓和家人的合照。', '讓一位家人說出今天答錯的一題。',
  '偷拍到一位家人笑到眼睛瞇起來。', '在噴泉邊讓一位家人丟硬幣許願，不能說是任務。', '跟一位家人交換一個小東西（糖果、明信片都可以）。',
  '讓同一位家人出現在今天 3 個不同地點的照片裡。', '讓一位家人模仿一幅畫或一張海報的動作。', '不被發現地拍下全家今天的鞋子，晚上比誰的最髒。',
];
route('/tools', () => {
  view(`<h1>遊戲工具</h1><p class="sub">景點小遊戲會用到的工具。分數會記在玩的人名下。</p>
    <div class="list">
      <a class="item" href="#/tool/wheel"><div class="t"><b>命運之輪</b><span>轉一次，轉到什麼就做什麼</span></div>${CHEV}</a>
      <a class="item" href="#/tool/price"><div class="t"><b>物價猜猜猜</b><span>手機輪流傳，每人偷偷輸入猜價</span></div>${CHEV}</a>
      <a class="item" href="#/tool/steps"><div class="t"><b>步數猜猜猜</b><span>進景點前猜，出來對答案</span></div>${CHEV}</a>
      <a class="item" href="#/tool/secret"><div class="t"><b>神秘任務</b><span>輸入實體籤卡上的號碼，偷看任務</span></div>${CHEV}</a>
      <a class="item" href="#/tool/give"><div class="t"><b>給分</b><span>連連看、小小觀察家、當一次雕像等遊戲的勝利者</span></div>${CHEV}</a>
    </div>`);
  return 'tools';
});
route('/tool/wheel', () => {
  const def = LS.get('wheel', ['模仿附近一座雕像', '學一句當地話', '找一個紅色的東西', '全家拍一張跳起來的照片', '找一個比你老的東西', '自由選擇！']);
  view(`${back('#/tools', '遊戲工具')}<h1>命運之輪</h1>
    <div class="wheel-wrap"><canvas id="wh" width="640" height="640" aria-label="命運之輪"></canvas></div>
    <button class="btn block" id="spin">轉！</button>
    <div id="res" class="center" style="margin:16px 0"></div>
    <details class="read"><summary>修改輪盤上的選項</summary><div class="inner">
      <textarea class="text" id="opts">${esc(def.join('\n'))}</textarea>
      <p class="sub">一行一個，最多 10 個。可以照景點卡上的小遊戲改。</p>
      <button class="btn small" id="saveo">儲存</button></div></details>`);
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
      g.fillStyle = '#000'; g.font = 'bold 24px -apple-system, "PingFang TC", sans-serif'; g.textAlign = 'right';
      g.fillText(items[i].slice(0, 10), r - 16, 8); g.restore();
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
        $('#res').innerHTML = `<div class="big-num" style="font-size:28px">${esc(items[idx])}</div>
          <button class="btn ghost small" id="did" style="margin-top:10px">${esc(S.player)} 完成了 +20</button>`;
        $('#did').onclick = () => { award({ key: 'wheel', points: 20, label: '命運之輪：' + items[idx], unique: false }); $('#did').disabled = true; };
        $('#spin').disabled = false;
      }
    };
    requestAnimationFrame(step);
  };
  $('#saveo').onclick = () => {
    items = $('#opts').value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 10);
    if (items.length < 2) { toast('至少要 2 個選項'); return; }
    LS.set('wheel', items); draw(); toast('已儲存');
  };
  return 'tools';
});
function guessTool(kind) {
  const isPrice = kind === 'price';
  const fam = S.family.length ? S.family : [S.player];
  view(`${back('#/tools', '遊戲工具')}<h1>${isPrice ? '物價猜猜猜' : '步數猜猜猜'}</h1>
    <p class="sub">${isPrice ? '先不要看標價。手機輪流傳，每個人點自己的名字、偷偷輸入猜的價格（歐元）。' : '進景點前，每個人點自己的名字、偷偷輸入猜的步數。'}</p>
    ${isPrice ? '<div class="card center"><div class="sub">剩餘時間</div><div class="big-num" id="clock">60</div><button class="btn small ghost" id="startc">開始倒數一分鐘</button></div>' : ''}
    <div class="list" id="who">${fam.map((n) => `<button class="item" type="button" data-n="${esc(n)}" style="width:100%;border:0;background:none;text-align:left"><div class="t"><b>${esc(n)}</b><span class="st">還沒猜</span></div></button>`).join('')}</div>
    <label class="field"><span>${isPrice ? '真正的價格（歐元）' : '實際步數'}</span><input class="text" id="real" inputmode="decimal"></label>
    <button class="btn block" id="rev">公布誰最接近</button><div id="win" style="margin-top:12px"></div>`);
  const guesses = {};
  $$('#who [data-n]').forEach((b) => b.onclick = () => {
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
    $('#win').innerHTML = `<div class="card"><h3>最接近：${esc(best)}</h3>
      ${names.map((n) => `<div>${esc(n)}：${guesses[n]}（差 ${Math.round(Math.abs(guesses[n] - real) * 100) / 100}）</div>`).join('')}
      <button class="btn small" id="give" style="margin-top:10px">給 ${esc(best)} 20 分</button></div>`;
    $('#give').onclick = () => { award({ key: kind, points: 20, label: (isPrice ? '物價猜猜猜' : '步數猜猜猜') + '冠軍', player: best, unique: false }); $('#give').disabled = true; };
  };
}
route('/tool/price', () => { guessTool('price'); return 'tools'; });
route('/tool/steps', () => { guessTool('steps'); return 'tools'; });
route('/tool/secret', () => {
  view(`${back('#/tools', '遊戲工具')}<h1>神秘任務</h1><p class="sub">輸入實體籤卡上的號碼（1–${SECRET_TASKS.length}），確認旁邊沒人在偷看再點開。被發現就作廢。</p>
    <label class="field"><span>籤卡號碼</span><input class="text" id="no" inputmode="numeric"></label>
    <button class="secret" id="sec" type="button">輸入號碼後，點這裡偷看</button>
    <button class="btn ghost block" id="done" style="margin-top:12px" disabled>我完成了 +30</button>`);
  let open = false;
  const paint = () => {
    const n = parseInt($('#no').value, 10);
    const ok = n >= 1 && n <= SECRET_TASKS.length;
    $('#done').disabled = !ok;
    $('#sec').classList.toggle('open', open && ok);
    $('#sec').textContent = open && ok ? SECRET_TASKS[n - 1] + '（再點一下蓋起來）' : (ok ? '點這裡偷看任務' : '輸入號碼後，點這裡偷看');
  };
  $('#no').oninput = () => { open = false; paint(); };
  $('#sec').onclick = () => { open = !open; paint(); };
  $('#done').onclick = () => { const n = parseInt($('#no').value, 10); award({ key: 'secret|' + n + '|' + today(), points: 30, label: '神秘任務 #' + n }); };
  return 'tools';
});
route('/tool/give', () => {
  const fam = S.family.length ? S.family : [S.player];
  view(`${back('#/tools', '遊戲工具')}<h1>給分</h1><p class="sub">連連看、小小觀察家、特寫尋寶、當一次雕像、一句當地話的分數在這裡給。</p>
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
route('/wall', () => {
  view(`<h1>排行與動態牆</h1><p class="sub" id="ws">讀取中…</p>
    <h2>總分</h2><div class="list" id="board"></div>
    <h2>大家的九宮格</h2><div class="wall-grid" id="pics"></div>
    <button class="btn ghost block" id="rf" style="margin-top:16px">重新整理</button>`);
  const paintBoard = (rows) => {
    $('#board').innerHTML = rows.length ? rows.map((r, i) => `<div class="score-row"><span class="rank">${i + 1}</span><span class="name">${esc(r.name)}</span>
      <span class="sub">今天 +${r.today}</span><span class="pts">${r.total}</span></div>`).join('') : '<div class="score-row">還沒有人得分</div>';
  };
  const load = async () => {
    if (!S.server.url) {
      $('#ws').textContent = '還沒連上家庭雲端，只顯示這支手機上的分數。到「我的」設定後就能看到全家。';
      paintBoard(localTotals());
      $('#pics').innerHTML = '';
      return;
    }
    try {
      const d = await apiGet({ action: 'feed', date: today() });
      $('#ws').textContent = '每分鐘自動更新。最後更新：' + new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
      paintBoard(d.players || []);
      $('#pics').innerHTML = (d.collages || []).map((p) => `<figure><img loading="lazy" data-id="${esc(p.fileId)}" src="https://drive.google.com/thumbnail?id=${encodeURIComponent(p.fileId)}&sz=w800" alt="${esc(p.player)}的九宮格：${esc(p.theme)}">
        <figcaption><b>${esc(p.player)}</b>・${esc(p.theme)}<br><span class="sub">${esc(p.city)}・${esc(fmtDate(p.date))}</span></figcaption></figure>`).join('') || '<p class="sub">還沒有人上傳九宮格。</p>';
      $$('#pics img').forEach((img) => img.onerror = async () => {
        img.onerror = null;
        try { const r = await apiGet({ action: 'image', id: img.dataset.id }); img.src = r.dataUrl; } catch (e) { /* leave blank */ }
      });
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
    <div class="card"><label class="field"><span>一行一個名字（遊戲工具和給分會用到）</span><textarea class="text" id="fam">${esc(S.family.join('\n'))}</textarea></label>
      <button class="btn small" id="savef">儲存名單</button></div>
    <h2>家庭雲端（一個人設定就好）</h2>
    <div class="card"><label class="field"><span>Apps Script 網址</span><input class="text" id="su" value="${esc(sv.url)}" placeholder="https://script.google.com/macros/s/…/exec"></label>
      <label class="field"><span>家庭密碼</span><input class="text" id="sc" value="${esc(sv.code)}"></label>
      <div class="row"><button class="btn small" id="saves">儲存並測試</button><button class="btn small ghost" id="inv">產生全家邀請連結</button></div>
      <p class="sub" id="invout" style="margin-top:10px">設定好後按「產生全家邀請連結」，貼到 LINE 群組。家人點開就自動連好，不用再輸入。</p></div>
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
    try { await apiGet({ action: 'ping' }); toast('連線成功！'); flush(); } catch (e) { toast('連不上，請檢查網址和密碼'); }
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

/* ---------- help ---------- */
route('/help', () => {
  view(`${back('#/', '首頁')}<h1>玩法說明</h1>
    <div class="card"><h3>每天早上</h3><p>打開「今天」，解鎖今天的城市卡：讀一個冷門小故事（不想讀可以跳過），挑一個九宮格主題，答 3 題加分題。</p></div>
    <div class="card"><h3>到了景點</h3><p>在城市裡點想去的景點卡：先答出發前的題目，到現場玩小遊戲、做現場任務，最後答收尾 3 題。</p></div>
    <div class="card"><h3>九宮格</h3><p>拍滿 9 張就能一鍵拼貼。按「一鍵上傳」會把 9 張原圖和拼貼存到家庭雲端，全家在「排行」都看得到。</p></div>
    <div class="card"><h3>計分</h3><p>初階題 10 分、挑戰題 20 分、長題 30 分、現場驗證 20 分、加分題 15 分、現場任務 30 分、九宮格 20 分、小遊戲 5–30 分。每題只能答一次。</p></div>
    <div class="card"><h3>沒有網路的時候</h3><p>題目、拍照、拼貼都能照常玩。上傳和分數會先存在手機，連上網路再自動補傳。</p></div>`);
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
  flush();
}
start();
