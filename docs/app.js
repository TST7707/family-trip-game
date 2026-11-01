'use strict';
/* 家族任務遊戲 v1.5.0 — Single-page app. Content comes from content.json */
const APP_VERSION = '1.5.0';
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
    <div style="display:flex;gap:8px;align-items:center">
      <a class="chip" href="#/flags" style="font-weight:700;color:var(--warn);background:var(--warn-bg)">🔥 連續打卡 ${getStreak()} 天</a>
      <a class="chip" href="#/tapa" style="font-weight:700">🍢 每日Tapa</a>
      <a class="chip" href="#/pokedex" style="font-weight:700">📖 大圖鑑</a>
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

/* ---------- 30 REGIONAL/CITY FLAGS & STORIES ---------- */
const FLAGS_LIST = [
  { id: 1, badge: '🏴󠁥󠁳󠁣󠁴󠁿', city: '巴塞隆納', title: '聖佐治十字與加泰隆尼亞條紋', story: '紅十字是守護聖人聖佐治標誌；四道紅紋相傳是西元9世紀法蘭克國王將受傷伯爵的血抹在金盾上的由來。' },
  { id: 2, badge: '📐', city: '擴建區 (Eixample)', title: '切角十字路口幾何旗', story: '工程師塞爾達首創將街角削切45度，讓陽光和空氣照進每間工人房屋，開創了現代都市規劃。' },
  { id: 3, badge: '🚩', city: '加泰隆尼亞', title: 'Senyera 金黃紅紋旗', story: '歐洲最古老的旗幟之一，歷經數百年統治與語言壓制，依然是每逢九月十一日陽台上必掛的驕傲符號。' },
  { id: 4, badge: '⚓', city: '巴塞隆納港', title: '地中海海事導航旗', story: '1493年哥倫布第一次自美洲歸來在此港接見天主教雙王，港口高柱至今依舊堅定指著蔚藍大海。' },
  { id: 5, badge: '🏛️', city: '凱旋門', title: '世界博覽會迎賓紅磚徽', story: '這座凱旋門不是為了慶祝戰爭屠殺，而是世界博覽會的大門，象徵巴塞隆納向全世界敞開懷抱。' },
  { id: 6, badge: '🌳', city: '蘭布拉大道', title: '舊河道變身的花神旗', story: 'Rambla在阿拉伯語意為「乾涸沙河」，中世紀排洪的溝渠，如今成為全球最具生命力的漫步林蔭道。' },
  { id: 7, badge: '🎰', city: '聖誕大樂透', title: '加的斯希望金幣旗', story: '1812年西班牙抗擊拿破崙戰爭時誕生，這是一場「自願繳納的稅」，讓全國街坊鄰居一起分享好運。' },
  { id: 8, badge: '⛵', city: '法國馬賽', title: '天藍十字十字軍港旗', story: '純潔白底配上一抹天藍色十字，源自11世紀十字軍東征時期艦隊從這個地中海古港揚帆的徽記。' },
  { id: 9, badge: '🦁', city: '義大利熱那亞', title: '聖喬治紅十字海上霸王旗', story: '曾威震地中海的海上共和國，連英國海軍為了借用其威名避開海盜，都曾年年向熱那亞付租旗費。' },
  { id: 10, badge: '🌋', city: '義大利那不勒斯', title: '維蘇威金黃與緋紅雙色旗', story: '代表火山烈火、陽光海岸與古老波旁王室，那不勒斯的顏色千百年來始終如歌聲般奔放熱烈。' },
  { id: 11, badge: '🦵', city: '西西里巴勒摩', title: '三曲腿美杜莎神聖三芒旗', story: '中央是蛇髮美杜莎頭像，放射出三條奔馳的人腿，象徵西西里島三個海角交匯的千年古希臘符號。' },
  { id: 12, badge: '🌙', city: '突尼西亞', title: '迦太基紅底白新月五星旗', story: '傳承迦太基帝國的榮光與鄂圖曼地中海海權的記憶，紅底象徵捍衛獨立的勇氣，白月象徵和平。' },
  { id: 13, badge: '🚢', city: '地中海巡航', title: '海平線航海家雙六分儀徽', story: '地中海孕育了古希臘、羅馬與阿拉伯文明，在無垠海浪上看夕陽，是全家最安詳的冒險時刻。' },
  { id: 14, badge: '🏰', city: '蒙特惠克山', title: '猶太山要塞俯瞰城旗', story: '矗立海角的制高點，曾見證內戰烽火與1992巴塞隆納奧運的點火射箭神蹟。' },
  { id: 15, badge: '🏛️', city: '哥德區', title: '奧古斯都羅馬石柱老徽', story: '隱身在小巷民宅中四根兩千年羅馬神廟圓柱，默默看著巴塞隆納從羅馬殖民村演變成世界都會。' },
  { id: 16, badge: '🎗️', city: '塞維亞', title: 'NO8DO 傳奇忠誠繩結紋章', story: '中間是羊毛線結（madeja），讀音No-madeja-do（她未曾棄我而去），國王感念塞維亞忠心的暗號！' },
  { id: 17, badge: '🗼', city: '塞維亞大教堂', title: '吉拉達青銅命運女神風向旗', story: '原本是穆斯林喚拜樓的斜坡供騎馬上頂，頂端如今立著象徵信仰勝利的青銅風向女神巨雕。' },
  { id: 18, badge: '🍊', city: '安達魯西亞平安夜', title: '冬日苦橙與佛朗明哥紅旗', story: '塞維亞街頭上萬株結滿金黃苦橙的果樹，在平安夜教堂彌撒鐘聲下散發安達魯西亞獨有的香氣。' },
  { id: 19, badge: '🌊', city: '瓜達幾維河', title: '麥哲倫環球航行黃金塔旗', story: '1519年麥哲倫艦隊就是從這條河解纜啟程，開展人類史上第一次環球遠航的壯舉。' },
  { id: 20, badge: '⛰️', city: '瓜迪斯 (Guadix)', title: '紅土高原白煙囪窯洞之徽', story: '這片大地如千瘡百孔的月球表面，千百年來人們鑿洞而居，冬暖夏涼常年保持18度恆溫。' },
  { id: 21, badge: '🍒', city: '格拉那達', title: '成熟開裂紅石榴市旗', story: '西班牙語Granada就是「石榴」，成熟綻放的石榴代表伊比利半島最後一顆收復的伊斯蘭明珠。' },
  { id: 22, badge: '🕌', city: '阿爾罕布拉宮', title: '桃金孃水池穆斯林幾何紅徽', story: '阿拉伯語意為「紅色城堡」，精緻如蕾絲的石膏灰泥雕花，見證了奈斯爾王朝最後的詩意輓歌。' },
  { id: 23, badge: '🦁', city: '哥多華', title: '綠白相間之上的昂首紅獅', story: '安達魯西亞的綠白旗幟源自和平與希望，昂首咆哮的紅獅則是中世紀抵抗風霜的英勇守衛。' },
  { id: 24, badge: '⛩️', city: '哥多華清真寺', title: '紅白雙層馬蹄石拱之印', story: '856根大理石柱頂起紅白相間的雙層拱券，在基督教堂嵌入其中後，成為全世界獨一無二的文明交響曲。' },
  { id: 25, badge: '🐻', city: '馬德里', title: '黑熊抱野草莓樹與大熊七星旗', story: '深紅底色上有大熊座七顆銀星，中間一隻站立擁抱野草莓樹的黑熊，是馬德里700年的吉祥象徵。' },
  { id: 26, badge: '🎨', city: '普拉多美術館', title: '宮廷畫家委拉斯蓋茲金冠旗', story: '《侍女》畫中畫家胸前佩戴的紅色十字騎士徽章，是西班牙藝術走進世界顛峰的金色冠冕。' },
  { id: 27, badge: '🏛️', city: '塞哥維亞', title: '羅馬萬年花崗岩水道橋徽', story: '20,400塊花崗岩不用一滴水泥，靠力學完美咬合兩千年，至今依然驕傲橫跨在小鎮廣場上。' },
  { id: 28, badge: '⚔️', city: '托雷多', title: '查理五世雙頭金鷹帝國盾', story: '三文化共存的古都，大馬士革金絲鋼劍削鐵如泥，雙頭鷹象徵東方與西方權力一體兩面。' },
  { id: 29, badge: '👑', city: '西班牙王宮', title: '波旁王朝白百合與皇家兵器旗', story: '歐洲最大的現存王宮之一，擁有3,418間房間，皇家兵器庫收藏了神聖羅馬帝國查理五世的精鋼戰甲。' },
  { id: 30, badge: '⭐', city: '三王節 (Reyes Magos)', title: '東方三博士伯利恆之星旗', story: '1月5日夜晚全西班牙不夜之城！三位國王騎著高頭駿馬灑下甜甜糖果，開啟新一年的平安與幸福。' }
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
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#000000'; g.font = 'bold 46px -apple-system, sans-serif';
  g.fillText(themeTitle.slice(0, 18), 24, 64);
  g.fillStyle = '#57575A'; g.font = '30px -apple-system, sans-serif';
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

/* ---------- ROUTE: /flags (城市旗與小眾故事) ---------- */
route('/flags', () => {
  const streak = getStreak();
  const rows = FLAGS_LIST.map((f, i) => {
    const unlocked = i < streak;
    return `<div class="flag-card ${unlocked ? '' : 'locked'}" style="${unlocked ? '' : 'opacity:.5'}">
      <div class="flag-badge">${f.badge}</div>
      <div class="flag-info">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="flag-title">${esc(f.title)}</span>
          <span class="chip ${unlocked ? 'good' : ''}">${unlocked ? '已點亮' : '第 ' + (i + 1) + ' 天'}</span>
        </div>
        <div class="sub" style="font-size:12px;margin:2px 0">${esc(f.city)}</div>
        <div class="flag-story">${unlocked ? esc(f.story) : '連續登入打卡至第 ' + (i + 1) + ' 天解鎖此旗幟小眾傳奇故事。'}</div>
      </div>
    </div>`;
  }).join('');

  view(`${back('#/', '首頁')}<h1>城市旗與小眾故事</h1>
    <p class="sub">目前連續打卡 🔥 <b>${streak}</b> 天，已收集 <b>${Math.min(streak, 30)} / 30</b> 面城市旗幟與傳奇故事。</p>
    <div class="stack">${rows}</div>`);
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
      <a class="item" href="#/tapa"><div class="t"><b>🍢 今日美味 Tapa 刮刮樂</b><span>每天刮開一道美味好運小事（最適合全家）</span></div>${CHEV}</a>
      <a class="item" href="#/pokedex"><div class="t"><b>📖 西班牙旅行大圖鑑</b><span>30 款西班牙經典圖鑑收集＋復古拍立得</span></div>${CHEV}</a>
      <a class="item" href="#/flags"><div class="t"><b>🚩 城市旗與小眾故事</b><span>30 天打卡收集城市旗與傳奇故事</span></div>${CHEV}</a>
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
