'use strict';
/* 家族任務遊戲 v1.5.0 — Single-page app. Content comes from content.json */
const APP_VERSION = '1.9.0';
const TRIP_START = '2026-12-09';
const TRIP_END = '2027-01-06';
const RESET_DATE = '2026-12-07';

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
  recordLogin();
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

function view(html) {
  recordLogin();
  const topNav = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px;flex-wrap:wrap">
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <a class="chip" href="#/flags" style="font-weight:700;color:var(--warn);background:var(--warn-bg)">🔥 連續打卡 ${getStreak()} 天</a>
      <a class="chip" href="#/tapa" style="font-weight:700">🍢 每日Tapa</a>
      <a class="chip" href="#/pokedex" style="font-weight:700">📖 大圖鑑</a>
      <a class="chip" href="#/airports" style="font-weight:700">✈️ 四大機場</a>
    </div>
    <a class="btn small ghost" href="itinerario.html" target="_blank" style="min-height:36px;font-size:13px;padding:0 10px;border-color:var(--primary);color:var(--primary)">🇪🇸 西文行程（同事專用）</a>
  </div>`;
  $('#app').innerHTML = '<div class="wrap">' + topNav + html + '</div>';
}
function back(href, label) { return `<a class="back" href="${href}"><svg class="chev" style="transform:rotate(180deg);stroke:currentColor" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>${esc(label)}</a>`; }

/* ---------- 30 TAPAS & GOOD LUCK TREATS (每日美味Tapa刮刮樂) ---------- */
const TAPAS_LIST = [
  { id: 1, icon: '🍫', name: '濃郁熱巧克力配剛出爐現炸吉拿棒', desc: '熱騰騰剛出爐的脆吉拿棒，沾滿濃到像融化布丁的熱巧克力，第一口幸福感爆發！' },
  { id: 2, icon: '🍊', name: '西班牙甜甜鮮榨柳橙汁', desc: '街邊咖啡館或超市現榨的甜橘汁，滿滿南歐陽光維他命C，好喝又解渴！' },
  { id: 3, icon: '🥪', name: '厚切香嫩馬鈴薯烘蛋', desc: '厚厚軟軟的馬鈴薯烘蛋切塊，香氣撲鼻，弟弟和爸媽都一吃就愛上！' },
  { id: 4, icon: '🍓', name: '市場買一盒鮮甜紅草莓', desc: '在水果攤挑一盒紅通通又大又甜的新鮮草莓，回旅館洗乾淨全家一起分著吃。' },
  { id: 5, icon: '🥓', name: '一片頂級伊比利火腿配烤麵包', desc: '油花在大理石花紋上發亮，放進嘴裡油脂自然融化，濃濃橡實香氣。' },
  { id: 6, icon: '🌞', name: '在廣場長椅上曬 5 分鐘冬陽', desc: '閉上眼睛，在西班牙暖呼呼的冬日陽光下靜靜坐著，放鬆心情。' },
  { id: 7, icon: '🐶', name: '向街上散步的可愛小狗微笑搖手', desc: '西班牙人超愛狗，在街頭遇到散步的小狗，對牠友善地笑一個吧！' },
  { id: 8, icon: '🍮', name: '香滑柔嫩的西班牙焦糖烤布丁', desc: '軟嫩細緻的布丁淋滿焦糖漿，入口即化，甜蜜又溫暖。' },
  { id: 9, icon: '🍨', name: '挑一球最喜歡顏色的冰淇淋', desc: '走進冰淇淋店，挑一球你最喜歡的口味（巧克力、草莓或開心果）慢慢享用！' },
  { id: 10, icon: '🔔', name: '靜靜數古老教堂的鐘聲響了幾下', desc: '噹～噹～噹～當教堂鐘聲響起時，全家一起停下腳步數數看敲了幾響。' },
  { id: 11, icon: '🍇', name: '甜甜多汁的無籽綠葡萄', desc: '洗一串冰涼香甜的無籽綠葡萄，每個人拿一顆放在嘴裡咬開！' },
  { id: 12, icon: '🥐', name: '香酥可頌配暖呼呼熱牛奶', desc: '早晨在街角咖啡館，烤得酥脆的可頌撕一塊泡一下熱牛奶，溫暖你的胃。' },
  { id: 13, icon: '🌰', name: '冬天街角紙袋裝的熱烤栗子', desc: '街頭大鐵桶碳火烤出來的熱栗子，用紙袋裝著捧在手心裡暖手又香甜。' },
  { id: 14, icon: '🥨', name: '西班牙脆脆小麥餅乾棒 (Picos)', desc: '吃火腿或前菜時一定要配的小脆棒，咬下去卡滋卡滋特別好玩。' },
  { id: 15, icon: '🧃', name: '西班牙國民巧克力奶 (Cacaolat)', desc: '玻璃瓶裝的國民巧克力牛奶，甜甜濃濃，西班牙大人小孩從小喝到大。' },
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
  { id: 30, icon: '👨‍👩‍👧‍👦', name: '全家 7 人圍在一起笑嘻嘻大合照', desc: '找個好風景，7 個人擠在一起對著鏡頭大喊「¡Patata!」（拍下最棒的笑容）！' }
];

/* ---------- 30 REGIONAL/CITY FLAGS, LORE & SVGS ---------- */
const FLAGS_LIST = [
  {
    id: 1, city: '巴塞隆納', title: '聖佐治十字與加泰隆尼亞令旗市旗',
    origin: '左上與右下為守護聖人聖佐治（Sant Jordi）的白底紅十字；右上與左下為加泰隆尼亞的四道紅紋。紅十字代表抵禦外敵的虔誠勇氣，四道紅紋則代表中世紀加泰隆尼亞與亞拉岡王國傳承逾千年的自治王權。',
    spotGuide: '聖雅各廣場（Plaça de Sant Jaume）的巴塞隆納市政廳主樓頂、老城巡邏警車車門徽章、以及巴塞隆納足球俱樂部（FC Barcelona）隊徽左上角，皆能親眼看見此官方標誌！',
    trivia: '相傳西元897年巴塞隆納伯爵「多毛者吉弗雷」英勇抗擊諾曼海盜重傷瀕死，法蘭克國王查理二世前來慰問，將手掌浸入伯爵胸口汩汩鮮血，在金黃色純金盾牌上一抹劃出四道血手印，封為這片土地永恆的榮譽徽章！'
  },
  {
    id: 2, city: '擴建區 (Eixample)', title: '塞爾達切角幾何街區旗',
    origin: '象徵工程師塞爾達（Ildefons Cerdà）於1859年開創現代都市規劃（Urbanismo）的八角形切角街區。這面旗幟代表著「陽光、空氣與階級平等」，主張無論貧富，每個人都該享有採光與通風的花園庭院。',
    spotGuide: '漫步米拉之家、巴特婁之家周邊，低頭看人行道幾何六角地磚，或抬頭觀察每個十字路口的45度切角建築，整座擴建區就是這面旗幟的真實立體模型！',
    trivia: '塞爾達削切街角45度，在1859年汽車尚未發明的時代，是為了讓未來的蒸汽路面電車轉彎半徑更順暢，並讓每個路口都變成寬敞明亮的八角小廣場，方便街坊鄰居聚在街角曬太陽聊天！'
  },
  {
    id: 3, city: '加泰隆尼亞', title: 'Senyera 金黃紅紋旗',
    origin: '純金黃底配上四道鮮紅水平條紋，是歐洲至今仍在官方使用的最古老旗幟之一（最早文獻可追溯至1150年）。它代表加泰隆尼亞民族深厚的憲政傳統、法典制度與語言文化自豪。',
    spotGuide: '走在巴塞隆納任何街道抬頭望，老百姓民宅陽台上掛滿這面旗幟；加泰隆尼亞自治區政府大樓、蘭布拉大道書報攤與重大慶典上隨處可見。',
    trivia: '在佛朗哥獨裁統治時期（1939–1975），這面旗幟曾被嚴格禁止懸掛。加泰隆尼亞人想出妙計：把巴塞隆納足球隊的紅藍條紋球衣當成象徵，諾坎普球場也因此成為唯一能公開宣洩民族驕傲的避難所！'
  },
  {
    id: 4, city: '巴塞隆納港', title: '海事領事館導航旗 (Consolat de Mar)',
    origin: '深邃地中海藍底配上海軍金色船錨，源自中世紀巴塞隆納海洋領事館（Consolat de Mar）的榮光。它是西地中海歷史最悠久的海事公會，曾掌控從直布羅陀到黎凡特的黃金海上貿易網絡。',
    spotGuide: '在貝爾港（Port Vell）碼頭桅杆、港務局大樓、水上巡邏艇、以及海洋聖母聖殿（Santa María del Mar）外牆古代海員公會浮雕上均能看到。',
    trivia: '巴塞隆納於13世紀編纂的《海洋領事法典》是全球最早的海事商法典籍。當年港口法規極為嚴苛：若引航員因疏忽導致商船觸礁擱淺，船長有權在全體船員見證下當場將該領航員斬首示眾！'
  },
  {
    id: 5, city: '凱旋門與城堡公園', title: '1888 世博會迎賓紅磚旗',
    origin: '溫暖的新摩爾式（Neo-Mudéjar）紅磚色與金色雙翼，象徵巴塞隆納邁向近代工業與藝術顛峰的里程碑。這座凱旋門不是為了慶祝戰爭屠殺，而是世界博覽會的大門，象徵向全球文明張開懷抱。',
    spotGuide: '沿著路易斯·孔帕尼斯大道（Passeig de Lluís Companys）走向凱旋門，正立面頂部石雕銘刻著「巴塞隆納歡迎各國（Barcelona rep les nacions）」。',
    trivia: '據傳建築大師艾菲爾最初在設計巴黎鐵塔前，曾優先向巴塞隆納市議會提案在1888世博會建造這座鐵塔，但被市議會以「造型過於古怪且鋼架昂貴」為由婉拒，轉而建造了這座典雅的紅磚凱旋門！'
  },
  {
    id: 6, city: '蘭布拉大道', title: '舊河道變身的花神紋章旗',
    origin: '黃綠交織的花卉波浪圖紋。蘭布拉在阿拉伯語（Ramla）原意為「乾涸沙河」，中世紀原是城牆外排洪的雨水溝渠，18世紀拆牆後蛻變為全世界最繽紛浪漫的花卉漫步大道。',
    spotGuide: '漫步蘭布拉大道中段的花攤（Flors de la Rambla）、米羅在地面鋪設的圓形彩色馬賽克地磚旁、以及百年波蓋利亞市場入口挑高拱門上方。',
    trivia: '大文豪海明威與西班牙詩人羅卡曾讚嘆：「蘭布拉是世界上唯一一條我希望永遠走不到盡頭的街道。」在19世紀，蘭布拉賣花的老闆娘是全城最受尊敬的市民，紳士貴族路過都必須脫帽行禮！'
  },
  {
    id: 7, city: '聖誕慶典', title: '聖誕大樂透「大胖子」吉慶金幣旗',
    origin: '深緋紅底色映襯著巨大純金樂透滾輪與傾瀉而出的金幣，代表全世界總獎金最高、歷史逾兩百年的西班牙聖誕彩券「El Gordo」（大胖子樂透）。',
    spotGuide: '每年12月在西班牙城鎮漫步，只要看見彩券行門口排了幾百公尺人龍、櫥窗貼滿彩券號碼與綠袍幸運小女巫（Doña Manolita），就是它的駐地！',
    trivia: '這張彩券誕生於1812年西班牙抗擊拿破崙戰爭的加的斯議會，為了籌措抗法軍費，被譽為「全天下唯一無人抱怨的自願稅」。開獎時由馬德里孤兒院孩童以獨特童聲唱號，成為全西全民年度狂歡！'
  },
  {
    id: 8, city: '法國馬賽', title: '天藍十字十字軍港旗',
    origin: '純潔白底配上一道澄澈天藍色十字（Croix d\'azur sur fond blanc），純淨如普羅旺斯晴空與地中海浪花。源自11世紀十字軍東征時期，馬賽艦隊開拔前往黎凡特所佩戴的軍徽。',
    spotGuide: '郵輪靠泊馬賽舊港（Vieux-Port），眺望岸邊碼頭燈塔、守護聖母聖殿（Notre-Dame de la Garde）山頂、以及馬賽市政廳正面旗桿上隨風飄揚。',
    trivia: '馬賽是法國現存最古老的城市（西元前600年由希臘水手建立）。法國國歌《馬賽曲》便是1792年馬賽志願軍自南方向巴黎長征五百公里時一路高唱的戰歌，這座古港的血液裡刻滿了反叛與自由！'
  },
  {
    id: 9, city: '義大利熱那亞', title: '聖喬治紅十字海上霸王旗',
    origin: '純白底色配上醒目鮮紅正十字（Crux de San Zorzo），是中世紀威震西地中海的海上霸主「熱那亞海洋共和國」的驕傲圖騰。',
    spotGuide: '郵輪抵達熱那亞港口，在舊港燈塔（Lanterna）、總督宮門楣雕刻、以及聖羅倫佐大教堂正立面大理石浮雕上，處處可見此紅十字。',
    trivia: '大家都以為英格蘭的聖喬治紅十字旗是英國原創，其實是1190年英國國王理查一世為了讓英國船隊在地中海航行時免受穆斯林與海盜襲擊，向熱那亞共和國付費「承租」其旗幟護身，英國每年還得按時向熱那亞繳納保護租金！'
  },
  {
    id: 10, city: '義大利那不勒斯', title: '維蘇威金黃與緋紅雙色旗',
    origin: '上黃下紅雙色旗自13世紀沿用至今。金黃象徵坎帕尼亞平原燦爛陽光與肥沃火山土壤，鮮紅代表維蘇威火山熔岩與那不勒斯人血液中的奔放熱情。',
    spotGuide: '郵輪駛入那不勒斯灣，岸邊新堡（Castel Nuovo）、平民表決廣場、甚至是傳統披薩店烤爐上的彩繪磁磚上，都能見到這抹鮮亮雙色。',
    trivia: '舉世聞名的瑪格麗特披薩便誕生於此！1889年義大利王后瑪格麗特造訪那不勒斯，披薩大師布蘭迪以番茄（紅）、莫札瑞拉起司（白）與羅勒葉（綠）烤出義大利國旗三色，王后讚不絕口，從此披薩風靡全球！'
  },
  {
    id: 11, city: '西西里島巴勒摩', title: '三曲腿美杜莎神聖三芒旗 (Trinacria)',
    origin: '紅黃對角切面中央嵌著古希臘三曲腿符號（Triskelion）：中央為蛇髮美杜莎頭像，向外延伸出三條奔馳的人腿，分別指向西西里島的三個海角（佩洛羅、帕西羅與利利貝奧）。',
    spotGuide: '在巴勒摩街頭的彩繪陶盤、傳統民俗彩繪馬車（Carretto Siciliano）、以及西西里自治區政府各大歷史建物外牆隨處可尋。',
    trivia: '美杜莎頭部兩旁長出的羽毛代表時間流轉，麥穗則是羅馬帝國統治時期西西里島作為「帝國大糧倉」的富庶豐收象徵；三條腿順時針奔馳，代表四季輪迴與地中海永不熄滅的生命力！'
  },
  {
    id: 12, city: '突尼西亞', title: '迦太基紅底白新月五星旗',
    origin: '深紅底色中央一枚純白圓盤，環抱著紅色新月與五角星。起源於1831年突尼斯貝伊侯賽因二世統治時期，紅底紀念抗擊外敵的烈士熱血，白月與星象徵和平與伊斯蘭傳統。',
    spotGuide: '突尼斯老城麥地那（Medina）石拱門、藍白小鎮西迪布賽義德（Sidi Bou Said）白色拱門與蔚藍窗櫺旁、以及迦太基遺址海岸高處高高飄揚。',
    trivia: '藍白小鎮西迪布賽義德被譽為地中海最夢幻小鎮，當年突尼斯政府特地頒布法令：全鎮所有房屋牆面必須粉刷純白，門窗一律塗成專屬地中海鈷藍色，塗抹任何其他顏色都屬違法行為！'
  },
  {
    id: 13, city: '地中海巡航', title: '航海風向羅盤星旗 (Rosa de los Vientos)',
    origin: '深藍海浪底色上八個金銀雙色箭頭構成的航海風向羅盤，是古代腓尼基、希臘與熱那亞航海家征服無垠地中海的生存星盤。',
    spotGuide: '在郵輪甲板指南針觀景台、港口水文站立牌、以及巴塞隆納貝爾港海事博物館的古代航海羊皮紙海圖上皆能見其精密刻度。',
    trivia: '古代地中海水手用八個方位為風命名：東北風叫「希臘風（Greco）」、東南風叫「敘利亞風（Scirocco）」、西北風叫「大師之風（Maestrale）」。經驗豐富的老舵手只需聞風中的濕氣與泥土味，便知航向何方！'
  },
  {
    id: 14, city: '蒙特惠克山', title: '猶太山要塞俯瞰城旗',
    origin: '金黃與湛藍海平線上巍峨矗立的三座要塞石塔。蒙特惠克山高踞海港173公尺之上，在加泰隆尼亞語意為「猶太山」，自古便是扼守海陸要道的軍事巨壁。',
    spotGuide: '搭乘蒙特惠克纜車登頂城堡砲台，俯瞰整個巴塞隆納貨櫃海港與老城區天際線，城堡正中心高聳旗桿每日迎風升起此旗。',
    trivia: '1792年法國天文學家梅尚在蒙特惠克要塞頂端觀測星象測量子午線長度，推算出「一公尺」等於地球北極到赤道距離的千萬分之一，現代公制「公尺（Meter）」就是誕生在這座城堡上！'
  },
  {
    id: 15, city: '哥德區', title: '奧古斯都羅馬柱古殖民徽 (Barcino)',
    origin: '深紅底色刻印著四根羅馬科林斯式神廟石柱與月桂冠。西元前15年羅馬皇帝奧古斯都在此設立殖民古城「巴爾奇諾（Barcino）」，是巴塞隆納兩千年的城市之根。',
    spotGuide: '隱身在哥德區天堂街（Carrer del Paradís 10號）加泰隆尼亞登山會庭院內，四根保存完好的兩千年神廟巨柱直插天井，令人震撼。',
    trivia: '這四根神殿石柱深埋在中世紀民宅牆體中近一千年，直到19世紀老屋改建拆除隔間時，工人才驚愕發現自家客廳牆壁裡居然嵌著兩千年前羅馬大理石巨柱！'
  },
  {
    id: 16, city: '塞維亞', title: 'NO8DO 傳奇忠誠市旗 (Bandera de Sevilla)',
    origin: '深緋紅底色中央閃耀著金色字符：字母「NO」、金色毛線結（Madeja）、以及字母「DO」。連起來讀作「No-madeja-do」，諧音西語「No me ha dejado」（她未曾棄我而去）。',
    spotGuide: '塞維亞街頭最神奇的尋寶！市政廳、復古鑄鐵路燈基座、警車標記、公車站牌、甚至腳底下的下水道人孔蓋上，100% 都能看見這串字符！',
    trivia: '1282年卡斯提爾國王阿方索十世（智者阿方索）遭親生兒子叛亂篡位，全西班牙各大城相繼背叛，唯獨塞維亞市民誓死保衛國王。老國王臨終前熱淚盈眶，將這句密碼賜為塞維亞永恆市徽！'
  },
  {
    id: 17, city: '塞維亞大教堂', title: '吉拉達風向女神旗 (El Giraldillo)',
    origin: '聳立在塞維亞大教堂鐘樓頂端、重達1.2噸的青銅風向女神雕像。它原是12世紀摩爾清真寺的喚拜樓，頂端加建文藝復興鐘樓與青銅雕像，隨風旋轉（Girar）因而得名。',
    spotGuide: '大教堂聖克里斯多福門口放置了一尊 1:1 等身復刻青銅雕像供遊客觸摸拍照；抬頭仰望104公尺高空雲端處則是真品。',
    trivia: '吉拉達鐘樓內部完全沒有樓梯台階，而是由35道寬敞平緩的斜坡盤旋而上！這是為了讓當年中世紀穆斯林教士不必徒步爬梯，而是每天騎著毛驢直接騎到百米塔頂播報祈禱時間！'
  },
  {
    id: 18, city: '安達魯西亞', title: '綠白相間之旗 (Verde, Blanca y Verde)',
    origin: '綠、白、綠三條水平條紋，中央為海格力斯降伏兩隻雄獅的國徽。綠色象徵安達魯西亞廣袤無垠的橄欖樹田與希望，白色代表純潔與和平，由安達魯西亞國父因凡特於1918年確立。',
    spotGuide: '塞維亞西班牙廣場（Plaza de España）圓弧長廊中央、聖十字區白牆民宅中庭花園、以及隆達天生橋頭均有懸掛。',
    trivia: '徽章中海格力斯腳踩兩根石柱，代表直布羅陀海峽兩側的「海格力斯之柱」，柱上纏繞拉丁銘文「Plus Ultra」（向更遠方前進），是西班牙大航海時代打破古代「世界盡頭」禁忌的開拓精神！'
  },
  {
    id: 19, city: '瓜達幾維河', title: '黃金塔與環球航行啟航旗 (Torre del Oro)',
    origin: '深藍波浪上坐落著十二面體的金色防禦塔。塔身原覆蓋著金色釉面磁磚，在陽光照射下如黃金般璀璨耀眼，是瓜達幾維河守護塞維亞海門的要塞。',
    spotGuide: '漫步塞維亞瓜達幾維河畔林蔭步道，黃金塔就矗立在河岸轉角處，現在館內為海事博物館。',
    trivia: '1519年8月10日，麥哲倫率領五艘帆船就是從黃金塔下的碼頭拔錨啟航展開環球航行！三年後僅剩「維多利亞號」載著18位倖存水手回到黃金塔，完成了人類史上第一次環繞地球的偉大壯舉！'
  },
  {
    id: 20, city: '瓜迪斯 (Guadix)', title: '紅土高原白煙囪窯洞旗',
    origin: '雪白內華達山脈下，千溝萬壑的赤褐色紅土高原，探出一支支圓柱形雪白煙囪。這是安達魯西亞最奇幻的人居地景，記錄了摩爾人避難與安土重遷的智慧。',
    spotGuide: '走入瓜迪斯窯洞區（Barrio de las Cuevas），站在觀景台遠眺，數百根雪白煙囪從地下鑽出地面，宛如童話小人國。',
    trivia: '瓜迪斯至今仍有兩千多戶居民長年住在地下窯洞中！由於紅土質地黏韌且具有極佳隔熱性，室外夏天高達40度酷暑或冬天下雪結冰，室內一年四季始終維持在攝氏18–20度天然恆溫！'
  },
  {
    id: 21, city: '格拉那達', title: '成熟開裂紅石榴市旗 (Bandera de Granada)',
    origin: '左緋紅、右翡翠綠對半垂直分割，中央是一顆裂開露出鮮紅寶石果實的加冕石榴（Granada 在西語就是石榴之意），象徵收復失地運動最後一顆收回的伊斯蘭明珠。',
    spotGuide: '在新廣場（Plaza Nueva）、阿爾拜辛區石板路街角柱、路燈基座、甚至是街頭鐵鑄人行路樁頂端，全是一顆顆精巧立體石榴！',
    trivia: '西班牙現行國徽最下方底部那一顆小小的金黃裂口石榴，正是天主教雙王在1492年攻克格拉那達後特地加進西班牙國徽的，象徵伊比利半島八百年收復失地運動（Reconquista）最後一塊完整拼圖！'
  },
  {
    id: 22, city: '格拉那達', title: '阿爾罕布拉奈斯爾王朝旗 (Estandarte Nazarí)',
    origin: '深赤紅底色橫貫金色斜紋，上書安達魯斯古典阿拉伯書法：«ولا غالب إلا الله»（除真主外，別無勝者），是格拉那達王國最後的王室旗幟。',
    spotGuide: '踏進阿爾罕布拉宮桃金孃中庭與獅子庭院，仔細觀察石膏雕花牆面、彩色磁磚腰線、以及木雕天花板，這句經文重複雕刻了上萬次！',
    trivia: '奈斯爾王朝開國君主穆罕默德一世攻下格拉那達時，百姓夾道歡呼稱他為「偉大的征服者」，國王謙遜搖頭回答道：「除真主外，別無勝者。」從此這句話成為王室信條，刻滿整座王宮！'
  },
  {
    id: 23, city: '哥多華', title: '加冕昂首紅獅市旗 (Bandera de Córdoba)',
    origin: '純白旗底上一隻頭戴金冠、昂首咆哮的直立紅獅（León rampante），象徵基督徒軍隊自摩爾人手中光復古都時的英勇與王室特許特權。',
    spotGuide: '在哥多華羅馬古橋頭、古城牆防衛門、百花巷入口陶罐牆面、以及哥多華市政廳頂部均可見其威嚴身影。',
    trivia: '哥多華在西元10世紀是全歐洲最大、最富庶繁華的都會，擁有百萬人口、三千座公共浴室與全歐最大的皇家圖書館（藏書四十萬冊，當時巴黎最大圖書館僅數千冊），其文明之光照亮了中世紀黑暗歐洲！'
  },
  {
    id: 24, city: '哥多華', title: '清真寺雙層馬蹄石拱旗 (Mezquita)',
    origin: '白色石灰岩與紅色燒磚交替砌成的馬蹄形雙層拱券圖紋。靈感汲取自古羅馬水道橋力學結構，創造出支撐極高挑穹頂的建築奇蹟。',
    spotGuide: '踏進大清真寺主殿，眼前856根斑岩、碧玉與大理石柱排列如無邊無際的石柱森林，紅白相間的馬蹄石拱令人嘆為觀止。',
    trivia: '16世紀查理五世皇帝批准在清真寺正中心硬生生插入一座文藝復興基督教堂，但他親自前來視察完工成果時卻後悔萬分，嘆息道：「你們摧毀了世間絕無僅有的奇蹟，建造了一座在任何地方都能建的普通教堂！」'
  },
  {
    id: 25, city: '馬德里', title: '大熊七星緋紅旗 (Bandera de Madrid)',
    origin: '高貴深緋紅底色上排列著七顆純銀色五角星（上四下三）。七顆星代表大熊星座（北斗七星），象徵馬德里坐落於卡斯提爾北境瓜達拉馬山脈下的天象方位。',
    spotGuide: '在太陽門廣場的「黑熊與野草莓樹」青銅雕像旁、馬德里市政警車車門、以及各大公車站牌立柱上都能看到這七顆銀星！',
    trivia: '古代馬德里周邊山林裡曾有大量野生棕熊棲息，市徽上的黑熊站立擁抱一棵結滿紅色果實的野草莓樹（Madroño）。這棵樹的果實發酵後含有微量天然酒精，因此古時馬德里常有棕熊偷吃果實醉倒在草地上的趣味傳聞！'
  },
  {
    id: 26, city: '普拉多博物館', title: '宮廷畫家委拉斯蓋茲聖雅各騎士旗',
    origin: '墨黑底色襯托著深紅色佩劍與百合花雕飾的佩劍十字。西班牙三大騎士團之一「聖雅各騎士團」的崇高榮譽徽章。',
    spotGuide: '在普拉多博物館內欣賞委拉斯蓋茲傳世國寶《宮女》（Las Meninas），注意畫中站在大畫架前的畫家本人，其胸口長袍上那枚鮮紅耀眼的十字。',
    trivia: '在17世紀西班牙，平民畫家地位卑微，委拉斯蓋茲一生渴望獲頒貴族階級的聖雅各十字勳章，直到晚年才如願。相傳在畫家逝世後，西班牙國王腓力四世親自拿起畫筆，在《宮女》真跡畫像上親手為過世的愛卿補畫上這枚紅色十字勳章！'
  },
  {
    id: 27, city: '塞哥維亞', title: '羅馬萬年水道橋藍盾旗 (Bandera de Segovia)',
    origin: '天藍色盾牌上雕刻著銀白色的雙層羅馬花崗岩水道橋與城堡。水道橋是這座世界遺產古城兩千年的生命之源與靈魂圖騰。',
    spotGuide: '抵達阿索格霍廣場（Plaza del Azoguejo），高達28公尺的水道橋巍峨矗立眼前；在當地百年烤乳豬名店 Candido 的餐盤徽章上也能看到。',
    trivia: '這座建於西元1世紀的水道橋總共用了20,400塊巨大花崗岩石塊，最不可思議的是——整座宏偉工程「沒有使用一滴泥漿或水泥灰粉」，全憑羅馬工程師神乎其技的重力精準咬合，屹立兩千年不倒，直到20世紀中葉仍在為小鎮引水灌溉！'
  },
  {
    id: 28, city: '托雷多', title: '查理五世雙頭金鷹帝國盾 (Bandera de Toledo)',
    origin: '神聖羅馬帝國皇帝查理五世賜予古都托雷多的皇家市旗，象徵托雷多作為日不落帝國世界權力中心的巔峰歲月。雙頭鷹一頭注視東方、一頭注視西方。',
    spotGuide: '托雷多比薩格拉新門（Puerta Nueva de Bisagra）巨型石雕大門正中央、大馬士革刀劍工藝品工坊櫥窗、市政廳正立面懸掛。',
    trivia: '托雷多自中世紀便以鍛造全世界最銳利的大馬士革金銀鑲嵌鋼劍聞名。羅馬軍團的短劍、查理五世的精鋼盔甲、甚至《魔戒》與好萊塢史詩電影中的騎士寶劍，許多都是特地委託托雷多老工匠以古法打造！'
  },
  {
    id: 29, city: '西班牙王宮', title: '波旁王朝皇家旗 (Estandarte Real de España)',
    origin: '匯聚卡斯提爾（城堡）、雷昂（紅獅）、亞拉岡（紅黃四紋）、納瓦拉（金鏈金字塔）與格拉那達（石榴），核心嵌波旁王朝三朵金百合，象徵伊比利半島各大王國合而為一的壯麗歷史。',
    spotGuide: '走訪馬德里西班牙王宮（Palacio Real de Madrid）與武器廣場，當國王在宮內時，主樓穹頂最高處便會升起這面皇家旗幟。',
    trivia: '納瓦拉王國的「金鏈」徽章源自1212年托洛薩拉斯納瓦斯大戰（Las Navas de Tolosa），納瓦拉國王桑喬七世親率騎士殺入摩爾人軍帳，用巨劍斬斷穆斯林親衛隊拴住哈里發帳篷的粗壯防禦鐵鏈，從此金鏈被榮耀地刻入西班牙王室血脈！'
  },
  {
    id: 30, city: '三王節 (Reyes Magos)', title: '東方三博士伯利恆之星旗',
    origin: '深邃夜空藍底色，中央綻放著指引東方三博士尋找聖嬰的八角金芒星，下方是代表梅爾基奧、加斯帕與巴爾塔沙的三頂珠寶王冠。',
    spotGuide: '1月5日夜晚馬德里與塞維亞街頭「三王節大遊行（Cabalgata de Reyes）」的花車主帆、街邊彩燈裝飾、以及麵包店國王蛋糕盒蓋上。',
    trivia: '1月5日夜晚是西班牙小朋友一年中最興奮的夜晚！睡前孩子們會在陽台擺好乾草和水給三位國王的駱駝解渴，並把擦得乾乾淨淨的鞋子擺在客廳。第二天醒來，鞋子裡就會塞滿三位國王送來的玩具或糖果；如果這一年不乖，國王就會送來黑漆漆的「煤炭糖（Carbón dulce）」！'
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
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#1565C0"/><rect x="20" y="44" width="80" height="8" fill="#ECEFF1"/><rect x="20" y="64" width="80" height="8" fill="#ECEFF1"/><path d="M26 44v28h8V44zm16 0v28h8V44zm16 0v28h8V44zm16 0v28h8V44zm16 0v28h8V44z" fill="#CFD8DC"/><path d="M52 24h16v14H52z" fill="#ECEFF1"/></svg>`;
    case 28:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#C2185B"/><path d="M60 30c-8-12-18-10-22-4 4 6 10 4 10 10-10-2-18 8-16 16 8 8 16 0 18-6v16h20V46c2 6 10 14 18 6 2-8-6-18-16-16 0-6 6-4 10-10-4-6-14-8-22 4z" fill="#212121"/><polygon points="40,20 44,16 48,20 44,24" fill="#FFD54F"/><polygon points="72,20 76,16 80,20 76,24" fill="#FFD54F"/><circle cx="60" cy="48" r="6" fill="#C2185B" stroke="#FFD54F" stroke-width="2"/></svg>`;
    case 29:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="20" fill="#AA151B"/><rect y="20" width="120" height="40" fill="#F1BF00"/><rect y="60" width="120" height="20" fill="#AA151B"/><rect x="30" y="30" width="16" height="20" fill="#AA151B" rx="2"/><circle cx="38" cy="36" r="3" fill="#F1BF00"/><rect x="25" y="32" width="2" height="16" fill="#757575"/><rect x="49" y="32" width="2" height="16" fill="#757575"/><polygon points="34,26 38,23 42,26" fill="#F1BF00"/></svg>`;
    case 30:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#1A237E"/><polygon points="60,10 63,26 78,20 67,31 82,38 67,42 75,56 61,48 58,62 55,48 42,56 49,42 35,38 49,31 40,20 54,26" fill="#FFD54F"/><circle cx="60" cy="36" r="4" fill="#FFF9C4"/><circle cx="36" cy="64" r="5" fill="#FFA000"/><circle cx="60" cy="64" r="5" fill="#FFE082"/><circle cx="84" cy="64" r="5" fill="#FFA000"/></svg>`;
    default:
      return `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#ECE7DE"/><text x="60" y="46" font-size="28" text-anchor="middle">🚩</text></svg>`;
  }
}

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
  { id: 21, icon: '🍇', name: '跨年夜 12 顆青葡萄罐或盤', desc: '超市賣的小罐裝 12 顆開運葡萄或全家分好的盤子。' },
  { id: 22, icon: '👑', name: '圓圈形三王節國王蛋糕', desc: '點綴著紅綠糖漬水果乾的大花環蛋糕與紙皇冠。' },
  { id: 23, icon: '🍬', name: '三王節遊行搶到的彩色糖果', desc: '從遊行花車上空如雨般落下的各色包裝糖果。' },
  { id: 24, icon: '🐻', name: '馬德里抱野草莓樹的黑熊雕像', desc: '太陽門廣場上站著啃草莓樹的青銅小黑熊。' },
  { id: 25, icon: '🎨', name: '普拉多博物館前的宮廷畫家雕像', desc: '拿著調色盤和畫筆坐在普拉多大門前的古典雕像。' },
  { id: 26, icon: '☕', name: '百年老咖啡館紅色戶外雨棚', desc: '路邊擺著藤椅、搭著復古紅色雨棚的戶外露天座。' },
  { id: 27, icon: '🚋', name: '馬德里老地鐵紅白菱形站牌', desc: '街角入口處寫著 METRO 的經典紅白藍菱形立牌。' },
  { id: 28, icon: '🌰', name: '街頭煙霧繚繞的熱烤栗子攤', desc: '冒著白煙、飄著炭烤焦香的冬天路邊小火爐。' },
  { id: 29, icon: '🚢', name: '地中海郵輪甲板的落日海平線', desc: '站在大船甲板上，看著金紅色夕陽慢慢沈入大海。' },
  { id: 30, icon: '👨‍👩‍👧‍👦', name: '全家 7 人全員到齊的燦爛笑容', desc: '我們全家人在西班牙旅途中的大合照！' }
];

/* ---------- AIRPORTS DATA (四大國際機場手帳：建築、總體經濟與文化觀察) ---------- */
const AIRPORTS_DATA = [
  {
    id: 'tpe',
    code: 'TPE',
    name: '臺灣桃園國際機場',
    nameEn: 'Taiwan Taoyuan International Airport',
    flag: '🇹🇼',
    terminal: '第二航廈 / 第一航廈',
    role: '啟程出發站（2026/12/08–12/09）',
    theme: '候機門文化主題巡禮與全家啟程合照',
    lore: `
      <p>從 17 世紀大航海時代的「福爾摩沙」作為東亞海上轉口貿易樞紐，到 1979 年由軍民共用轉型為現代化民航門戶，這座島嶼在地理經濟上始終扮演著海空關鍵十字路口。如今，桃園機場不僅支撐著全球超過六成的先進半導體高價值空中冷鏈與精密物流，更在航廈空間設計上演繹了獨特的「在地文化敘事」。</p>
      <p>不同於多數國際航空樞紐冰冷標準化的玻璃鋼骨與單調免稅店，桃園機場第二航廈將各登機門打造成微型生活劇場與文化博物館。對於即將展開 30 天跨洲長途旅行的家庭而言，候機室不僅僅是登機前的等待空間，更是一道充滿儀式感的「過渡空間（Liminal Space）」——透過熟悉的夜市紅燈籠、茶席香氣與偶戲工藝，在跨越時區與文化邊界前，為全家人注入安心與溫暖的期待。</p>
    `,
    architecture: `
      <b>🏛️ 建築與空間特色：</b>
      桃園機場第二航廈巨大的雙曲面懸吊桁架屋頂象徵「飛鷹展翼」，大跨度無柱挑高空間打破了出入境的壓迫感。各特色主題候機室（Gate Lounges）以「一門一景」為核心，融合了台灣傳統竹編、金工、剪黏與現代多媒體光雕，讓旅客在踏出國門前的最後一哩路，沉浸於島嶼多元族群的生活記憶。
    `,
    gates: [
      { id: 'C3', name: 'C3 街頭夜市', desc: '懷舊紅燈籠、經典台灣小吃霓虹燈箱與復古彈珠台' },
      { id: 'C4', name: 'C4 偶戲掌中乾坤', desc: '精緻木雕布袋戲彩樓戲台，展現生旦淨末丑戲偶工藝' },
      { id: 'C5', name: 'C5 客家花布與藍染', desc: '深邃靛藍大菁染布，搭配傳統富貴花布燈籠藝術' },
      { id: 'C6', name: 'C6 臺灣茶香文化', desc: '高山茶萎凋竹簍、品茗茶席陶壺與茶山梯田光影' },
      { id: 'C7', name: 'C7 金馬電影之光', desc: '經典膠卷放映機、電影聚光燈與台灣新浪潮光影' },
      { id: 'C8', name: 'C8 寶島好山好水', desc: '中央山脈與玉山意象，台灣黑熊與島嶼特有種生態' },
      { id: 'D2', name: 'D2 臺灣原住民文化', desc: '十六族幾何圖騰織紋、百步蛇神話雕刻與木舟意象' },
      { id: 'D3', name: 'D3 嬉遊記與傳統書法', desc: '張炳煌大師行草書法、西遊文學意境與文房四寶' },
      { id: 'D7', name: 'D7 科技矽島', desc: '高科技半導體矽晶圓光雕、流動光纖與數位脈動' },
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
      <p>杜拜本土原油儲量在阿拉伯聯合大公國僅佔不足 5%，早在 1980 年代，杜拜統治者馬克圖姆家族便洞悉「石油終會採盡，但地理位置永存」。波斯灣恰好座落於全球 8 小時航程的幾何同心圓中心——以此為圓心畫一個圓，便能覆蓋歐洲、亞洲與非洲超過 50 億人口。杜拜憑藉國家資本主義模式全力扶持阿聯酋航空，開創了舉世無雙的「軸輻式航空網絡（Hub-and-Spoke）」，將一座昔日依賴採珍珠與海灣帆船的小漁港，蛻變為哪怕不需要最終目的地、純靠「中轉流動（Transit）」便能產生天文數字產值的全球心臟。</p>
      <p>法國著名人類學家馬克·歐傑（Marc Augé）曾提出著名的「非場所（Non-place）」概念：機場是超現代性最具代表性的非場所，這裡沒有固定身分、沒有傳統鄉土，只有 24 小時不熄滅的登機廣播、免稅店金光璀璨的純金金條、中東椰棗與來自印度、巴基斯坦、菲律賓的多民族流動勞動力。走在杜拜航廈深邃的大理石長廊上，每一位擦肩而過的旅客都在前往地球的不同角落，這是一場真實上演的全球化微縮劇場。</p>
    `,
    architecture: `
      <b>🏛️ 建築與空間特色：</b>
      Terminal 3 航廈由法國傳奇機場建築大師保羅·安德魯（Paul Andreu，戴高樂機場與北京國家大劇院建築師）與阿聯酋工程團隊操刀，單體建築面積高達 171 萬平方公尺（相當於 240 座標準足球場，落成時為全球最大單體建築物）。外觀模擬波斯灣沙漠流動的沙丘與巨型貝殼，採用大跨度雙曲面鋼構流線穹頂；航廈深入地下 20 公尺，擁有三層立體旅客與行李分流捷運系統；在炎夏氣溫高達 48°C 的極端氣候下，建築內部採用高效微氣候地冷循環，並點綴室內棕櫚綠洲與人工水幕瀑布，創造了沙漠中不可思議的科技綠洲。
    `
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
  view(`<h1>西班牙＋豪華遊輪之旅要開始了！</h1>
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
  const tToday = today();
  const tc = todayCard();
  let hero = '';
  if (tc) {
    hero = `<div class="hero"><div class="sub">今天解鎖</div><h2 style="margin:4px 0 12px">${esc(CITY[tc.city].name)}・${esc(tc.title)}</h2>
      <a class="btn block" href="#/card/${tc.id}">打開今天的城市卡</a></div>`;
  } else if (tToday < TRIP_START) {
    const days = Math.ceil((new Date(TRIP_START) - new Date(tToday)) / 86400000);
    hero = `<div class="hero"><div class="sub">距離出發還有</div><div class="big-num">${days} 天</div>
      <p style="margin:8px 0 0">城市卡會在當天早上解鎖。想先看看，可以到「我的」打開「預覽全部」。</p></div>`;
  } else if (tToday > TRIP_END) {
    hero = `<div class="hero"><h2 style="margin:0 0 8px">旅程結束了</h2><p style="margin:0">到「排行」看看全家的總分和所有九宮格。</p></div>`;
  }

  const tiles = C.cities.map((c) => `<a class="city-tile" href="#/city/${c.id}"><b>${esc(c.name)}</b>
    <span>城市卡 ${c.cityCards.length} 張・景點 ${c.spots.length} 個</span></a>`).join('');

  // Milestone Progress
  const curSteps = S.familySteps;
  const pct = Math.min(100, Math.round((curSteps / 300000) * 100));

  view(`<div class="sub">${esc(S.player)}，你好</div><h1>家族任務遊戲</h1><p class="sub">旅遊也能解任務！</p>${hero}
    
    <!-- 每日美味 Tapa 刮刮樂捷徑卡 -->
    <a class="card" href="#/tapa" style="display:flex;align-items:center;gap:14px;text-decoration:none;border-left:4px solid var(--warn);margin-bottom:14px">
      <div style="font-size:36px">🍢</div>
      <div style="flex:1">
        <b style="color:var(--fg);font-size:17px">今日美味 Tapa 刮刮樂</b>
        <p class="sub" style="margin:2px 0 0">每天為全家刮出一道暖心西班牙美食或好運！</p>
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
        <p class="sub" style="margin:2px 0 0">桃園候機室全家合照、杜拜轉機極致建築、巴塞隆納與馬德里天光巡禮</p>
      </div>
      ${CHEV}
    </a>

    <!-- 全家 30 萬步合作里程碑卡 -->
    <div class="milestone-card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>🏆 全家 30 萬步大挑戰</b>
        <span class="chip good">${pct}%</span>
      </div>
      <div class="progress-outer"><div class="progress-inner" style="width:${pct}%"></div></div>
      <div class="progress-labels"><span>0</span><span>10萬 (吉拿棒)</span><span>20萬 (火腿盤)</span><span>30萬 步 🏆</span></div>
      <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center">
        <span class="sub">全家累計步數：<b>${curSteps.toLocaleString()}</b> 步</span>
        <button class="btn small ghost" id="btn-quick-steps" type="button">+ 登記今日步數</button>
      </div>
    </div>

    <h2>選一座城市</h2><div class="grid2">${tiles}</div>
    ${tToday < RESET_DATE ? '<div class="card" style="margin-top:12px"><b>出發前的分數 12/7 會清空</b><p class="sub" style="margin:4px 0 0">12/9 出發後才正式計分。</p></div>' : ''}

    <div style="margin-top:18px" class="stack">
      <a class="btn block" href="#/trip">看每日行程</a>
      <a class="btn ghost block" href="itinerario.html" target="_blank" style="border-color:var(--primary);color:var(--primary)">🇪🇸 打開西班牙文專屬行程頁（純西文，給同事分享）</a>
      <a class="btn ghost block" href="#/help">玩法說明</a>
    </div>`);

  $('#btn-quick-steps').onclick = () => {
    const s = prompt('想登記幾步加入全家累計？');
    if (!s) return;
    const n = parseInt(s.replace(/,/g, ''), 10);
    if (isNaN(n) || n <= 0) return toast('請輸入正確的數字');
    S.familySteps += n;
    award({ key: 'steps|' + uid(), points: 15, label: '步行貢獻：' + n + ' 步' });
    toast('已登記 ' + n + ' 步進全家大挑戰！');
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

/* ---------- SAFETY BANNER (歐洲防盜防扒重要安全提醒) ---------- */
function safetyBannerHtml() {
  return `<div class="safety-banner">
    <div class="safety-banner-header">
      <span class="safety-icon">🛡️</span>
      <b>出發作答前重要安全提醒（歐洲防盜守則）</b>
    </div>
    <div class="safety-banner-body">
      歐洲治安遠不如臺灣安全，當地警察通常不會受理或追查強盜、偷竊案件！<b>低頭看手機前，請全家務必確認：</b>
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
      '觀察力滿分！這題考得這麼細，你竟然瞬間鎖定真相，全家最細心的觀察家非你莫屬！🔍',
      '太強了！你這份敏銳的洞察力，如果回到古代，一定是宮廷裡最受器重的皇家鑒寶大師！✨'
    ]
  },
  {
    title: '👑 博學多聞！這份學識太讓人驚艷了！',
    praises: [
      '太有深度了！連幾百年前歐洲宮廷與老百姓的生活小秘密都難不倒你，全家的文化智庫就是你！📚',
      '這題連很多歐洲在地導遊都不一定答得出來！你到底是怎麼知道的？記憶力簡直是神級的！💡',
      '知識庫大爆發！才剛聽完故事就能融會貫通，你對歐洲歷史文化的理解力讓人由衷佩服！🎓'
    ]
  },
  {
    title: '🏆 關鍵一擊！為全家贏得無比驕傲的高分！',
    praises: [
      '太棒了！沉著、自信又精準，爸媽和弟弟都在為你熱烈鼓掌，這一題為全家拿下了超關鍵得分！💪',
      '全家的幸運之星！你一出手就穩穩拿下這題，旅途的幸運女神今天完全站在你身後護航！🍀',
      '太帥氣了！弟弟在一旁看得眼睛發亮，你就是全家最值得崇拜的解題大英雄！🥳'
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
      '大獲全勝！你就是全家旅行團的首席總參謀長，冷靜、精準、毫不猶豫，太令人心悅誠服了！👑',
      '魔王題直接瓦解！這道題本來是設計來考倒大家的，結果在你面前撐不過一秒，請收下膝蓋！🙇‍♂️',
      '傳奇級答題！這趟旅行有你在身旁解題，大家玩得既充實又放心，你是全西班牙最棒的探險家！🏰'
    ]
  }
];

const SPOT_FLAVORS = [
  { match: /聖家堂|高第/, text: '安東尼·高第如果看見你答得這麼精準，一定會邀請你一起設計尚未完工的榮耀立面！⛪️' },
  { match: /普拉多|委拉斯奎茲/, text: '委拉斯奎茲在《宮娥》畫布後面都要為你這神之一筆拍手叫好！🎨' },
  { match: /蘇菲亞|格爾尼卡|畢卡索|達利/, text: '超現實主義與立體派的百年密碼都被你輕鬆破解，畢卡索和達利都要甘拜下風！🖼️' },
  { match: /考古|MAN|埃爾切/, text: '這件萬年前的古代瑰寶被你一眼參透，你簡直就是現代伊比利半島的印第安納·瓊斯！🏺' },
  { match: /托雷多|葛雷柯/, text: '托雷多千年古都的石板路上，今天又誕生了一位智勇雙全的聖殿騎士！🗡️' },
  { match: /清真寺|哥多華/, text: '穿過八百根紅白馬蹄拱門，你的智慧在伊斯蘭繁星幾何中閃閃發光！🕌' },
  { match: /阿爾罕布拉|格拉那達/, text: '格拉那達蘇丹皇宮的微風，正在為全家最博學多聞的你吹拂奏樂！🏰' },
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
  '沒關係！這題本來就是魔王級陷阱題，你敢於挑戰的勇氣已經為全家贏得了尊敬！看懂解說我們就學會了！💪',
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
          ${i < qs.length - 1 ? `👉 前進下一題 (${i + 2}/${qs.length})` : `🎉 完成本區挑戰！領取全家積分`}
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
          toast('🎉 本區題目已全數挑戰完畢！全家太厲害了！', 3500);
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
      <button type="button" class="btn ghost block" data-jump="q-p" style="margin-bottom:12px">不想讀？直接跳到題目</button>
      <details class="read" open><summary>景點冷知識 <span class="sub">點一下收起來，覺得特別有趣就按讚</span></summary><div class="inner reading">
      ${card.facts.length ? card.facts.map((f, i) => {
        const fid = factId(card, i);
        const on = !!LS.get('likes', {})[fid];
        return `<div class="fact"><div class="ftxt">${f}</div>
          <button type="button" class="like-btn${on ? ' on' : ''}" data-like="${fid}" aria-pressed="${on}">👍 讚 <span>${likeCount(fid)}</span></button></div>`;
      }).join('') : ''}
      ${card.story.map((p) => `<p>${p}</p>`).join('')}</div></details>
      <p><b>準備好挑戰今天的任務了嗎？</b></p>
      ${quizHtml(card, 'p', '出發前的題目')}
      ${card.game && card.hasGame ? (() => {
        const tool = TOOL_FOR.find(([k]) => card.game.name.includes(k));
        return `<div class="gamebox"><h3>景點小遊戲：${esc(card.game.name)}</h3><p>${card.game.rules}</p>
          ${tool ? `<a class="btn small" href="#/tool/${tool[1]}">打開${esc(tool[0])}工具</a>` : ''}</div>`;
      })() : ''}
      ${card.tasks.length ? `<h2>現場任務</h2><div class="stack">${card.tasks.map((t, i) => `<div class="card task-box" data-task="${i}"><p>${t}</p>
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
    m[fid] = !m[fid];
    if (!m[fid]) delete m[fid];
    LS.set('likes', m);
    b.classList.toggle('on', !!m[fid]);
    b.setAttribute('aria-pressed', String(!!m[fid]));
    $('span', b).textContent = likeCount(fid);
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
  g.fillStyle = '#FFFDF9'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2C2621'; g.font = 'bold 46px -apple-system, sans-serif';
  g.fillText(themeTitle.slice(0, 18), 24, 64);
  g.fillStyle = '#5C554E'; g.font = '30px -apple-system, sans-serif';
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
      <h3>💡 專為全家打造的溫馨小儀式</h3>
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
        <div class="flag-lore-sec">🔒 <b>第 ${i + 1} 天解鎖：</b>連續登入打卡至第 ${i + 1} 天，即可解鎖此旗幟完整的歷史傳奇、街頭尋寶攻略與奇聞冷知識。</div>
      </div>`;

    return `<div class="flag-card ${unlocked ? '' : 'locked'}">
      <div class="flag-header">
        <div class="flag-title-wrap">
          <span class="chip" style="font-size:12px;font-weight:700;margin-bottom:4px">第 ${f.id} 面旗幟</span>
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
          <div class="flag-visual-label">📖 官方真實圖鑑</div>
          <div class="flag-guide-frame">
            ${getFlagSvg(f.id)}
          </div>
          <div class="sub" style="font-size:11.5px;margin-top:6px;color:var(--muted)">依循此官方紋章在街頭尋寶</div>
        </div>
        ${photoHtml}
      </div>

      ${loreHtml}
    </div>`;
  }));

  view(`${back('#/', '首頁')}<h1>城市旗幟與傳奇故事</h1>
    <p class="sub">西班牙與地中海 30 款標誌性旗幟與紋章圖鑑！每天解鎖一面旗幟的深度故事，走在街頭看見真實旗幟就拍照上傳打卡！</p>
    ${safetyBannerHtml()}
    <div class="card" style="display:flex;justify-content:space-around;text-align:center;padding:14px;margin-bottom:16px">
      <div><div class="sub">連續打卡進度</div><div style="font-size:26px;font-weight:900;color:var(--primary)">🔥 ${streak} / 30 天</div></div>
      <div style="border-left:1px solid var(--line)"></div>
      <div><div class="sub">街頭實拍捕獲</div><div style="font-size:26px;font-weight:900;color:var(--good)">📸 ${capturedCount} / 30 面</div></div>
    </div>
    <div class="stack">${rows.join('')}</div>`);

  $$('.flag-file-input').forEach((input) => {
    input.onchange = async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const id = input.dataset.id;
      await DB.flagPut(id, f);
      award({ key: 'flag|' + id, points: 20, label: '街頭捕獲旗幟：' + FLAGS_LIST[id - 1].title });
      toast('🎉 成功在街頭打卡旗幟：' + FLAGS_LIST[id - 1].title + '！+20 分');
      location.hash = '#/flags';
    };
  });

  return 'tools';
});

/* ---------- ROUTE: /pokedex (西班牙旅行大圖鑑) ---------- */
route('/pokedex', async () => {
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
      <div class="poke-name">${esc(p.name)}</div>
      <div class="poke-sub">${esc(p.desc)}</div>
      ${imgTag}
      <label class="btn small ${unlocked ? 'ghost' : ''}" style="margin-top:6px;width:100%;cursor:pointer">
        ${unlocked ? '換照片' : '📷 打卡點亮'}
        <input type="file" accept="image/*" class="poke-input" data-id="${p.id}" hidden>
      </label>
    </div>`;
  }));

  view(`${back('#/', '首頁')}<h1>西班牙旅行大圖鑑</h1>
    <p class="sub">30 款西班牙標誌性事物，看見就拍照打卡！</p>
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
});

/* ---------- RENDER AIRPORTS (四大國際機場手帳：建築、總體經濟與文化觀察) ---------- */
async function renderAirports(activeId = 'tpe') {
  activeId = activeId || 'tpe';
  const airport = AIRPORTS_DATA.find((a) => a.id === activeId) || AIRPORTS_DATA[0];

  // Navigation tabs
  const tabsHtml = AIRPORTS_DATA.map((a) => {
    const on = a.id === airport.id;
    return `<a class="airport-pill ${on ? 'on' : ''}" href="#/airports/${a.id}">${a.flag} ${a.code}</a>`;
  }).join('');

  // TPE Gate selection state
  const savedGateId = LS.get('tpe_gate_theme', 'C3');
  const savedGateCustom = LS.get('tpe_gate_custom', '');

  // Photos from DB
  const departureBlob = await DB.get('photo:tpe_departure');
  const airportBlob = activeId !== 'tpe' ? await DB.get('photo:airport:' + activeId) : null;

  let departurePhotoHtml = '';
  if (departureBlob) {
    const u = URL.createObjectURL(departureBlob);
    departurePhotoHtml = `
      <div class="polaroid" style="margin:14px auto 8px">
        <img src="${u}" alt="桃園機場啟程全家合照">
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
        <div class="gate-chip-code">${g.id} ${on ? '✓' : ''}</div>
        <div class="gate-chip-name">${esc(g.name.replace(/^[CD]\d+\s*/, ''))}</div>
        <div class="gate-chip-desc">${esc(g.desc)}</div>
      </button>`;
    }).join('');

    gateSelectionHtml = `
      <div class="card" style="margin-bottom:16px;background:var(--card-hover)">
        <h3 style="margin:0 0 6px">🏮 候機門臺灣文化主題探索</h3>
        <p class="sub" style="margin:0 0 12px">桃園機場第二航廈每個候機室都有不同的臺灣文化主題！點選或填寫你們這次出發的候機門：</p>
        <div class="gate-chips-wrap">${gateChips}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
          <input type="text" id="tpe-gate-custom" class="text" style="flex:1" placeholder="或自填候機門主題（例如：C3 街頭夜市候機門）" value="${esc(savedGateCustom)}">
          <button type="button" class="btn small" id="btn-save-gate">儲存</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--primary)">
        <h3 style="margin:0 0 6px">👨‍👩‍👧‍👦 啟程出發儀式：全家第一張大合照</h3>
        <p class="sub" style="margin:0 0 12px">在候機室的特色文化牆前，全家 7 個人圍在一起拍下出發前的全家大合照！上傳立得 50 分！</p>
        <label class="btn block ${departureBlob ? 'ghost' : ''}" style="cursor:pointer">
          ${departureBlob ? '🔄 更換全家合照' : '📷 拍照 / 上傳全家啟程合照 (+50分)'}
          <input type="file" accept="image/*" id="tpe-departure-input" hidden>
        </label>
        <div id="tpe-photo-box">${departurePhotoHtml}</div>
      </div>
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

      <!-- Architecture Highlight Card -->
      <div style="background:var(--card-hover);border-radius:var(--r-sm);border:1px solid var(--line);padding:14px;font-size:15px;line-height:1.65;color:var(--fg)">
        ${airport.architecture}
      </div>
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
        award({ key: 'tpe_departure_photo', points: 50, label: '桃園機場全家啟程大合照' });
        toast('🎉 全家出發合照上傳成功！+50 分');
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
    ${safetyBannerHtml()}
    <div class="list">
      <a class="item" href="#/tapa"><div class="t"><b>🍢 今日美味 Tapa 刮刮樂</b><span>每天刮開一道美味好運小事（最適合全家）</span></div>${CHEV}</a>
      <a class="item" href="#/pokedex"><div class="t"><b>📖 西班牙旅行大圖鑑</b><span>30 款西班牙經典圖鑑收集＋復古拍立得</span></div>${CHEV}</a>
      <a class="item" href="#/flags"><div class="t"><b>🚩 城市旗與小眾故事</b><span>30 天打卡收集城市旗與傳奇故事</span></div>${CHEV}</a>
      <a class="item" href="#/airports"><div class="t"><b>✈️ 四大國際機場手帳</b><span>桃園全家啟程合照、杜拜轉機、巴塞隆納與馬德里建築手帳</span></div>${CHEV}</a>
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
  '全家拍一張每個人姿勢都不同的照片',
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
  const colors = ['#B85338', '#3D6780', '#3E6E49', '#A86F30', '#6A567D', '#9E3832', '#3B617C', '#C66247', '#4B8358', '#BA7842'];
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
    const top = Object.entries(META.likes).map(([id, names]) => [id, names.length]).filter(([, n]) => n > 0)
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
      <a class="item" href="itinerario.html" target="_blank"><div class="t"><b>🇪🇸 西班牙文專屬行程頁</b><span>純西文版，專門分享給西班牙同事看，附在地推薦留言區</span></div>${CHEV}</a>
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
    <div style="margin-top:16px"><a class="btn ghost block" href="#/admin">主辦人後台</a></div>
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
    <div class="card"><h3>每日美味 Tapa 刮刮樂</h3><p>專為爸媽和弟弟設計！每天刮開一道西班牙美味點心或溫馨好運，只要全家當天有吃到或做到，點一下就能加 20 分！</p></div>
    <div class="card"><h3>西班牙旅行大圖鑑</h3><p>全西 30 款標誌事物（火腿、吉拿棒、羅馬水道橋、白雪公主城堡、大馬士革鋼劍等），看到就拍照打卡點亮圖鑑，旅行結束就是一本專屬家族見聞手冊！</p></div>
    <div class="card"><h3>到了景點</h3><p>在城市裡點想去的景點卡：先答出發前的題目，看景點冷知識（覺得有趣就按讚），到現場做任務，最後答收尾 3 題。</p></div>
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
const STAYS = [
  { date: '2026-12-09', name: '聖家堂旁邊的飯店', q: 'Sagrada Familia, Barcelona' },
  { date: '2026-12-19', name: 'Avinguda d\'Isabel la Catòlica, 65, 08905 L\'Hospitalet de Llobregat, Barcelona', q: 'Avinguda d\'Isabel la Catòlica, 65, 08905 L\'Hospitalet de Llobregat, Barcelona, Spain' },
  { date: '2026-12-22', name: '塞維利亞（92V8+Q2G）', q: '37.394444,-5.984917' },
  { date: '2026-12-26', name: 'Plazuela los Bacas, 8, 18500 Guadix, Granada（特色窯洞屋）', q: 'Plazuela los Bacas, 8, 18500 Guadix, Granada, Spain' },
  { date: '2026-12-29', name: 'Av. del Corregidor, 14, Poniente Sur, 14004 Córdoba', q: 'Av. del Corregidor, 14, 14004 Córdoba, Spain' },
  { date: '2026-12-31', name: '馬德里（市中心住宿）', q: 'Puerta del Sol, Madrid, Spain' },
];

/* 30 天完整智能最佳化行程 */
const PLAN = {
  '2026-12-09': [{ text: '抵達巴塞隆納 ➔ 聖家堂前方的聖誕市集', q: 'Christmas market Sagrada Familia Barcelona' }],
  '2026-12-10': [
    { text: '桂爾公園（看彩色大蜥蜴與馬賽克長椅）', spot: '桂爾公園', q: 'Park Güell Barcelona' },
    { text: '聖露西亞聖誕市集（找 Caganer 與 Caga Tió）', tentative: true, q: 'Fira de Santa Llúcia Barcelona' },
    { text: '畢卡索博物館（少年畢卡索時期）', tentative: true, spot: '畢卡索', q: 'Museu Picasso Barcelona' },
  ],
  '2026-12-11': [
    { when: '白天', text: '聖家堂（已定）', spot: '聖家堂', q: 'Sagrada Família Barcelona' },
    { when: '下午', text: '聖保羅醫院（現代主義世界遺產建築群）', tentative: true, spot: '聖保羅醫院', q: 'Hospital de Sant Pau Barcelona' },
    { when: '晚上', text: '巴特略之家（夢幻龍脊屋頂）', tentative: true, spot: '巴特略之家', q: 'Casa Batlló Barcelona' },
    { when: '晚上', text: '格拉西亞大道與市區聖誕燈飾漫步', q: 'Passeig de Gràcia Barcelona' },
  ],
  '2026-12-12': [
    { when: '早上', text: '第二批人參觀聖家堂', spot: '聖家堂', q: 'Sagrada Família Barcelona' },
    { when: '中午', text: '巴塞隆納港口 ➔ 登上地中海豪華郵輪！', q: 'Port de Barcelona' },
  ],
  '2026-12-13': [
    { text: '法國馬賽・守護聖母院（俯瞰地中海海港）', spot: '守護聖母院', q: 'Notre-Dame de la Garde Marseille' },
    { text: '馬賽・舊港與彩色 Le Panier 老城巷弄', spot: 'Le Panier', q: 'Le Panier Marseille' },
  ],
  '2026-12-14': [
    { text: '義大利熱那亞・羅利宮殿體系新街老城', spot: '老城與新街', q: 'Genova centro storico' },
    { text: '熱那亞・舊港與歐洲最古老燈塔', spot: '舊港與燈塔', q: 'Porto Antico Genova' },
  ],
  '2026-12-15': [{ text: '義大利那不勒斯・龐貝古城遺址探祕', spot: '龐貝', q: 'Pompeii' }],
  '2026-12-16': [
    { text: '西西里巴勒摩・主教座堂與帕拉提納金色禮拜堂', spot: '主教座堂與帕拉提納', q: 'Palermo Cathedral' },
    { text: '西西里巴勒摩・巴拉羅熱鬧傳統市場與 Teatro Massimo', spot: '巴拉羅市場', q: 'Mercato di Ballarò Palermo' },
  ],
  '2026-12-17': [
    { text: '北非突尼西亞・迦太基帝國千年遺址', spot: '迦太基', q: 'Carthage Tunisia' },
    { text: '突尼西亞・藍白童話小鎮西迪布賽義德（喝松子薄荷茶）', spot: '西迪布賽義德', q: 'Sidi Bou Said' },
  ],
  '2026-12-18': [{ text: '地中海巡航日・在郵輪上吹海風、玩家族遊戲與放鬆', q: '' }],
  '2026-12-19': [{ when: '17:00', text: '加泰隆尼亞音樂宮自由參觀＋聖誕節音樂舞蹈會', spot: '音樂宮', q: 'Palau de la Música Catalana' }],
  '2026-12-20': [
    { text: '蒙特惠克山（Montjuïc）城堡與西班牙村', spot: '蒙特惠克', q: 'Montjuïc Barcelona' },
    { text: '加泰隆尼亞國家藝術博物館（MNAC）前看日落', q: 'Museu Nacional d\'Art de Catalunya' }
  ],
  '2026-12-21': [
    { text: '蘭布拉大道、博蓋利亞傳統市場採買水果火腿', q: 'Mercat de la Boqueria Barcelona' },
    { text: '整理行李，準備搭 AVE 高鐵南下安達魯西亞', q: 'Barcelona Sants' }
  ],
  '2026-12-22': [
    { text: '抵達塞維亞 ➔ 收音機聽聖誕大樂透「胖子樂透」唱號開獎', q: 'Sevilla Santa Justa' },
    { text: '聖十字區（Barrio de Santa Cruz）橘子樹小巷漫步', q: 'Barrio de Santa Cruz Sevilla' }
  ],
  '2026-12-23': [
    { text: '塞維亞主教座堂與吉拉達鐘樓（世界第三大天主教堂）', q: 'Catedral de Sevilla' },
    { text: '西班牙廣場（Plaza de España）租小船划水與瑪麗亞路易莎公園', q: 'Plaza de España Sevilla' }
  ],
  '2026-12-24': [
    { text: '塞維亞王宮（Real Alcázar，摩爾宮殿與熱帶花園）', q: 'Real Alcázar de Sevilla' },
    { text: '黃金塔與瓜達幾維河畔散步', q: 'Torre del Oro Sevilla' },
    { text: '【平安夜】全家在塞維亞溫馨聚餐，品嚐伊比利火腿與杏仁糖', q: '' }
  ],
  '2026-12-25': [
    { text: '【聖誕節】塞維亞古城聖誕悠閒漫步、特里亞納區（Triana）', q: 'Triana Sevilla' },
    { text: '欣賞一場熱情純粹的安達魯西亞佛朗明哥吉他舞蹈演出', q: 'Flamenco Sevilla' }
  ],
  '2026-12-26': [
    { text: '前往瓜迪斯（Guadix）➔ 入住夢幻冬暖夏涼的「白煙囪窯洞屋」', q: 'Plazuela los Bacas, Guadix' },
    { text: '瓜迪斯老城大教堂與白煙囪觀景台', q: 'Catedral de Guadix' }
  ],
  '2026-12-27': [
    { when: '14:30', text: '格拉那達・阿爾罕布拉宮與納斯里德宮殿（Palacios Nazaríes）', spot: '阿爾罕布拉', note: '已訂票：14:30 進入 Palacios Nazaríes', q: 'Alhambra Granada' },
    { text: '阿爾拜辛區（Albaicín）聖尼古拉斯觀景台眺望紅堡夕陽與內華達雪山', q: 'Mirador de San Nicolás Granada' }
  ],
  '2026-12-28': [
    { text: '瓜迪斯千瘡百孔高原地形・四驅越野車探險', q: 'Guadix badlands' },
    { text: '前往千年中世紀古城哥多華（Córdoba）', q: 'Córdoba Spain' }
  ],
  '2026-12-29': [
    { text: '哥多華・大清真寺-主教座堂（Mezquita-Catedral，驚豔紅白雙層拱門森林）', q: 'Mezquita-Catedral de Córdoba' },
    { text: '猶太人街區、百花巷（Calleja de las Flores）打卡', q: 'Calleja de las Flores Córdoba' }
  ],
  '2026-12-30': [
    { text: '哥多華・基督教君主城堡與古羅馬大石橋', q: 'Alcázar de los Reyes Cristianos Córdoba' },
    { text: '搭乘 AVE 高鐵抵達西班牙首都馬德里！', q: 'Madrid Puerta de Atocha' }
  ],
  '2026-12-31': [
    { text: '馬德里老城漫步：太陽門廣場、主廣場（Plaza Mayor）、聖米格爾市場', spot: '太陽門與主廣場', q: 'Puerta del Sol Madrid' },
    { text: '採買跨年專用「12 顆開運青葡萄」與狂歡小道具', q: 'Mercado de San Miguel' },
    { when: '深夜 23:30', text: '【跨年倒數】太陽門鐘樓下，與全西班牙群眾隨 12 響鐘聲吃完 12 顆葡萄迎新年！', note: '若人潮擁擠，亦可於住宿客廳收看電視鐘樓直播同步吃葡萄', q: 'Real Casa de Correos Madrid' }
  ],
  '2027-01-01': [
    { text: '【元旦公休日】全西室內博物館休館，適合全家漫步戶外大自然', q: 'Parque de El Retiro Madrid' },
    { text: '漫步綠意盎然的「麗池公園」（Parque del Retiro）、水晶宮與阿爾卡拉門', spot: '麗池公園', q: 'Palacio de Cristal Retiro Madrid' },
    { text: '百年老店 Chocolatería San Ginés 享用暖呼呼熱巧克力配吉拿棒', q: 'Chocolatería San Ginés Madrid' }
  ],
  '2027-01-02': [
    { when: '14:00起', text: '【免費時段】國立考古博物館（MAN，週六14:00後全面免費！看埃爾切夫人與瓜拉薩爾純金王冠）', spot: '國立考古博物館', q: 'Museo Arqueológico Nacional Madrid' },
    { when: '18:00–20:00', text: '【免費時段】普拉多美術館（Museo del Prado，週六18:00-20:00免費入場！賞委拉斯蓋茲《侍女》與哥雅）', spot: '普拉多美術館', q: 'Museo del Prado Madrid' }
  ],
  '2027-01-03': [
    { text: '【高鐵郊區一日遊】前往「塞哥維亞」（Segovia，高鐵僅需 28 分鐘）', spot: '賽哥維亞', q: 'Acueducto de Segovia' },
    { text: '仰望壯觀古羅馬水道橋、漫步至迪士尼白雪公主城堡原型「阿爾卡薩城堡」', q: 'Alcázar de Segovia' },
    { text: '午餐品嚐塞哥維亞最馳名的傳統香脆烤乳豬（Cochinillo Asado）', q: 'Mesón de Cándido Segovia' }
  ],
  '2027-01-04': [
    { text: '【高鐵郊區一日遊】避開週一馬德里博物館休館，前往三文化之都「托雷多」（Toledo，高鐵 33 分鐘）', spot: '托雷多', q: 'Catedral de Toledo' },
    { text: '西班牙首席主教座堂、聖多默教堂欣賞葛雷柯名作《奧加茲伯爵的葬禮》、大馬士革金絲鋼劍工藝', q: 'Iglesia de Santo Tomé Toledo' },
    { text: '河谷觀景台（Mirador del Valle）俯瞰托雷多古城與阿爾卡薩城堡壯麗全景', q: 'Mirador del Valle Toledo' }
  ],
  '2027-01-05': [
    { when: '上午', text: '參觀奢華的「西班牙王宮」（Palacio Real de Madrid）與皇家兵器庫', spot: '馬德里王宮', q: 'Palacio Real de Madrid' },
    { when: '18:30–21:00', text: '【三王節前夕年度盛典】馬德里三王節大遊行（Cabalgata de Reyes Magos，全家帶倒撐雨傘沿大道搶糖果！）', note: '路線：Paseo de la Castellana 至 Plaza de Cibeles', q: 'Plaza de Cibeles Madrid' }
  ],
  '2027-01-06': [
    { text: '【三王節主日】早晨全家享用傳統「國王蛋糕」（Roscón de Reyes），看誰吃到幸運陶偶', q: '' },
    { text: '參觀國立蘇菲亞王后藝術中心，親睹畢卡索反戰巨作《格爾尼卡》真跡', spot: '蘇菲亞王后', q: 'Museo Reina Sofía Madrid' },
    { text: '整理行李、最後採買伴手禮，帶著滿滿歡笑與回憶平安返回台灣！', q: 'Aeropuerto Adolfo Suárez Madrid-Barajas' }
  ],
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
  const stays = STAYS.map((x) => `<div class="score-row" style="align-items:flex-start"><span class="name" style="white-space:normal">${esc(dayName(x.date))}<br><span class="sub">${esc(x.name)}</span></span>
    <a class="btn small ghost" href="${esc(mapUrl(x.q))}" target="_blank" rel="noopener">地圖</a></div>`).join('');
  const rows = dates.map((date) => {
    const items = PLAN[date] || [];
    const label = cityLabel(date);
    const body = items.length ? items.map((it) => {
      const sid = spotIdByTitle(it.spot);
      const tag = it.tentative ? '<span class="chip">未定</span>' : '';
      const mapBtn = it.q ? `<a class="btn small ghost" href="${esc(mapUrl(it.q))}" target="_blank" rel="noopener">地圖</a>` : '';
      const cardBtn = sid ? `<a class="btn small ghost" href="#/card/${sid}">任務卡</a>` : '';
      return `<li><div class="plan-main">${it.when ? `<span class="chip warn" style="font-size:12px;padding:1px 6px;margin-right:4px">${esc(it.when)}</span> ` : ''}<b>${esc(it.text)}</b> ${tag}
        ${it.note ? `<div class="sub" style="color:var(--warn);margin-top:2px">${esc(it.note)}</div>` : ''}</div>
        <div class="plan-btns">${mapBtn}${cardBtn}</div></li>`;
    }).join('') : `<p class="sub">還沒定，這天在${esc(label)}。</p>`;
    return `<details class="day"${items.length ? ' open' : ''}><summary><span class="dot"></span><span class="dt">${esc(dayName(date))}</span>
        <span class="dc">${esc(label)}</span></summary>
        <div class="day-body"><ul class="plan-list">${items.length ? body : ''}</ul>${items.length ? '' : body}</div></details>`;
  }).join('');
  view(`${back('#/', '首頁')}<h1>每日行程</h1>
    <div style="margin-bottom:14px">
      <a class="btn block" href="itinerario.html" target="_blank" style="background:var(--card);border:2px solid var(--primary);color:var(--primary)">🇪🇸 打開西班牙文專屬行程頁（純西文，給同事分享）</a>
    </div>
    <div class="card"><b>博物館免費小撇步：</b>1/2 週六 14:00 後國立考古博物館免費、18:00–20:00 普拉多美術館免費；1/4 週一安排托雷多剛好避開市區休館！</div>
    <h2>住宿地點</h2><div class="list">${stays}</div>
    <h2>30 天完整時間軸</h2><p class="sub">包含所有景點任務連結與 Google Maps 地圖導航。</p>
    <div class="timeline">${rows}</div>`);
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
