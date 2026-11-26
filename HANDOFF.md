# 交接說明（給新 agent）

使用者：TST7707，用繁體中文溝通。這是家族西班牙＋地中海旅行（2026/12/9–2027/1/6）的遊戲網頁。

## 位置
- 本機 repo：`C:\Users\User\src\family-trip-game`（GitHub: TST7707/family-trip-game，branch main，push 後 GitHub Pages 自動部署）
- Git 身分已在 repo 內設定好，直接 commit/push 即可。
- 本機沒有 python / node。測試用 PowerShell 伺服器：
  `C:\Users\User\AppData\Local\Temp\claude\b13e191de5166b94\9a4a13bd-6bd9-49b5-af2b-89cfeebfbbd8\scratchpad\serve.ps1`（port 8765），再用瀏覽器面板看。
- 瀏覽器面板擋 drive.google.com，雲端音檔無法在這裡測。

## 架構
- `docs/`：GitHub Pages 單頁 app
  - `app.js`：全部邏輯與資料（行程、STAYS、TRANSPORT、PODCASTS、題目、路由）
  - `app.css`、`index.html`、`sw.js`（network-first service worker，快取名稱 `ftg-vX`，不快取跨網域請求）
  - **每次改動都要把 index.html 與 sw.js 的版本號一起 +1**，目前是 **2.16**
  - 本機資料：localStorage（前綴 `ftg:`）＋ IndexedDB（photos / queue / pokedex）
- `apps-script/Code.gs`（v5）：Google Apps Script 後端，寫 Google 試算表與 Drive 資料夾。**使用者必須自己貼上並重新部署**，agent 無法部署。
- `腳本/`：各城市的內容 markdown（00-總覽.md 是總表）。

## 命名規則
- 兩組家人：`Disen家`（itinerary 的 who:'trio'）、`Leo家`（who:'leo'）。舊名「三人組／四人組／迪森一家」都已改掉，一律寫 DISEN一家 / Disen家。
- 聖家堂：12/11 Leo家、12/12 Disen家。巴塞隆納住宿已線上 check-in。

## 已完成的功能（重點）
- 同名玩家跨裝置合併：`normName()`、`pullMine()`（前端）＋ `norm_/canon_/mine_`（Code.gs，doGet action `mine`）。
- 不再有 12/7 自動重置；管理員清除可指定保留玩家（預設 Simon）。
- 交通總表頁 `#/transport`（TRANSPORT 陣列）。
- 照片：存入前 `shrinkPhoto` 壓到 1600px；上傳成功後 task 照片刪除，original/keep 照片只留 480px 縮圖。機場合照、機場打卡、名畫照片用 `queueKeepPhoto` 上傳雲端。手機相簿不動。
- 12/30 哥多華加了「聖巴西里奧區三座免費庭院」（Casa LONGA 週二三休）。
- Podcast：`PODCASTS = { barcelona: { title:'用直線蓋曲線的高第', id:'12jTioz5RH6Ej8TD1d1QAlNMWl627vf5y' } }`，點海報用 `playPodcast()` 串流 `https://drive.google.com/uc?export=download&id=ID`，下方 #podbar 播放列。Drive 資料夾：13p9nfm9Lt3vbsPoFS2Lnb5CX36Q925LT。海報 key：barcelona, madrid, segovia, marseille, genoa, pompeii, tunis, palermo, sevilla, guadix, alhambra, cordoba, ship。

## 🔴 目前正在處理的問題
**Podcast 在使用者手機上播不出來，一直顯示「載入中… 用直線蓋曲線的高第」。**
可能原因與方向：
1. `uc?export=download` 會轉址到 drive.usercontent.google.com，手機 Safari 的 `<audio>` 對轉址／Range 處理可能卡住；或大檔回傳的是「病毒掃描確認」HTML 而非音檔。
2. 可試：改用 `https://drive.usercontent.google.com/download?id=ID&export=download&confirm=t`，先用 curl（帶 iPhone UA、`-r 0-1`）檢查是否回 206 + audio/*。
3. 最穩的替代：把音檔放到 repo（docs/pod/*.m4a，GitHub Pages 支援 Range）但不讓 sw.js 快取它（使用者不要音檔存在手機）；注意 GitHub 單檔 100MB 上限。或在 Code.gs 加代理（Apps Script 回傳大檔不適合）。
4. 也檢查 playPodcast 的 'error' / 'stalled' 事件有沒有顯示錯誤，不要永遠停在「載入中」。

## 待使用者做的事
- 部署 Apps Script v5：貼上 Code.gs → 填回三個設定值 → 執行 `resetKeepSimon` 一次 → 部署新版本。
- 其他 podcast：放進同一 Drive 資料夾（知道連結者可檢視），告知對應城市。
