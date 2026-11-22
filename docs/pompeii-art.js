/**
 * 龐貝古城：今昔對比向量繪圖引擎 (Pompeii Then & Now Vector Engine)
 * 100% 本機離線 Canvas 運算，精準幾何疊圖，免外網依賴
 */
(function (global) {
  'use strict';

  const POMPEII_SPOTS = [
    {
      id: 'marina',
      name: '🏛️ 海門與石板大道',
      sub: 'Porta Marina · 入城雙拱人車分流',
      descPast: '西元79年繁盛港門：大海拍岸，商船泊靠。大小雙拱人車分流，長袍羅馬人與滿載陶罐的騾車顛簸入城。',
      descPresent: '今日現場：海岸已退縮兩公里。厚重玄武岩石板大道、深車轍、斑馬線過街石與防夜盲白石完好如初。'
    },
    {
      id: 'foro',
      name: '🏛️ 公共廣場與朱比特神廟',
      sub: 'Foro · 市政中樞與維蘇威火山',
      descPast: '西元79年市政心臟：高聳神廟香火繚繞，兩層雪白大理石柱廊。背後是平緩翠綠、被葡萄園覆蓋的平靜維蘇威山。',
      descPresent: '今日現場：開闊無頂石板廣場，朱比特神廟餘高台斷柱，背後直對著猙獰巨大的維蘇威火山口破頂。'
    },
    {
      id: 'thermopolium',
      name: '🍲 豐饒大道熱食小吃店',
      sub: "Thermopolium di Vetutius Placidus",
      descPast: '西元79年鬧市小吃店：L形彩色大理石櫃檯熱氣蒸騰，陶罐滾著肉汁扁豆，市民站著喝熱香料酒，神話壁畫鮮麗奪目。',
      descPresent: '今日現場：彩色大理石鑲嵌櫃檯與四個內嵌陶罐完好留存，門檻插板滑槽清晰可見，生活溫度凝固在西元79年。'
    },
    {
      id: 'anfiteatro',
      name: '⚔️ 圓形競技場',
      sub: 'Anfiteatro · 全羅馬世界最古老石造競技場',
      descPast: '西元79年兩萬人沸騰角鬥場：高空拉起巨幅遮陽天幕，旗幟招展，角鬥士沙場金屬交鋒，山呼海嘯。',
      descPresent: '今日現場：世界最古老石造競技場雙層外拱與石階依然完整，青草在石縫蔓生，耳畔唯有山風與歷史迴音。'
    }
  ];

  /**
   * 1. 海門 Porta Marina (使用精準建築座標)
   */
  function drawMarina(ctxB, ctxA, width, height) {
    const mainArchX = 665;
    const mainArchY = 390;
    const mainArchR = 88;
    const sideArchX = 465;
    const sideArchY = 415;
    const sideArchR = 46;

    // --- 過去 (Past) ---
    const skyB = ctxB.createLinearGradient(0, 0, 0, height * 0.6);
    skyB.addColorStop(0, '#d6d2c8');
    skyB.addColorStop(1, '#ebe7de');
    ctxB.fillStyle = skyB;
    ctxB.fillRect(0, 0, width, height);

    // 城牆與垛口
    ctxB.fillStyle = '#9c968b';
    ctxB.fillRect(240, 170, 800, 320);
    ctxB.fillStyle = '#7d776d';
    for (let x = 245; x < 1035; x += 26) ctxB.fillRect(x, 154, 16, 16);

    // 磚紋
    ctxB.strokeStyle = 'rgba(60, 56, 50, 0.35)';
    ctxB.lineWidth = 1.5;
    for (let y = 185; y < 480; y += 22) {
      ctxB.beginPath(); ctxB.moveTo(240, y); ctxB.lineTo(1040, y); ctxB.stroke();
      for (let x = 250 + (y % 44 === 0 ? 0 : 25); x < 1030; x += 50) {
        ctxB.beginPath(); ctxB.moveTo(x, y); ctxB.lineTo(x, y + 22); ctxB.stroke();
      }
    }

    // 門樓
    ctxB.fillStyle = '#b8b2a6';
    ctxB.fillRect(360, 220, 480, 320);
    ctxB.strokeStyle = '#4a463f';
    ctxB.lineWidth = 3;
    ctxB.strokeRect(360, 220, 480, 320);

    // 簷口
    ctxB.fillStyle = '#8c857a';
    ctxB.fillRect(350, 232, 500, 14);
    ctxB.fillRect(350, 254, 500, 8);

    // 主拱門
    ctxB.fillStyle = '#262420';
    ctxB.beginPath();
    ctxB.arc(mainArchX, mainArchY, mainArchR, Math.PI, 0);
    ctxB.lineTo(mainArchX + mainArchR, 540);
    ctxB.lineTo(mainArchX - mainArchR, 540);
    ctxB.closePath();
    ctxB.fill();
    ctxB.strokeStyle = '#5c574f';
    ctxB.lineWidth = 12;
    ctxB.beginPath();
    ctxB.arc(mainArchX, mainArchY, mainArchR + 6, Math.PI, 0);
    ctxB.stroke();

    // 行人小拱門
    ctxB.fillStyle = '#2b2824';
    ctxB.beginPath();
    ctxB.arc(sideArchX, sideArchY, sideArchR, Math.PI, 0);
    ctxB.lineTo(sideArchX + sideArchR, 540);
    ctxB.lineTo(sideArchX - sideArchR, 540);
    ctxB.closePath();
    ctxB.fill();

    // 石板坡道
    ctxB.fillStyle = '#b0aaa0';
    ctxB.beginPath();
    ctxB.moveTo(410, 540); ctxB.lineTo(820, 540);
    ctxB.lineTo(1160, height); ctxB.lineTo(100, height);
    ctxB.closePath();
    ctxB.fill();

    ctxB.strokeStyle = '#59544c';
    ctxB.lineWidth = 2;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      const y = 540 + (height - 540) * Math.pow(t, 1.25);
      ctxB.beginPath(); ctxB.moveTo(100, y); ctxB.lineTo(1160, y); ctxB.stroke();
    }

    // 左側雙層建築
    ctxB.fillStyle = '#cfc9be';
    ctxB.beginPath();
    ctxB.moveTo(0, 10); ctxB.lineTo(360, 290); ctxB.lineTo(360, 550); ctxB.lineTo(0, 760);
    ctxB.closePath(); ctxB.fill(); ctxB.stroke();
    ctxB.fillStyle = '#33302b';
    ctxB.fillRect(55, 130, 65, 140); ctxB.fillRect(175, 210, 50, 110);
    ctxB.fillRect(50, 350, 80, 240); ctxB.fillRect(170, 390, 60, 180);

    // 右側建築
    ctxB.fillStyle = '#c4beb3';
    ctxB.beginPath();
    ctxB.moveTo(width, 20); ctxB.lineTo(840, 330); ctxB.lineTo(840, 545); ctxB.lineTo(width, 750);
    ctxB.closePath(); ctxB.fill(); ctxB.stroke();
    ctxB.fillStyle = '#302d28';
    ctxB.fillRect(1040, 220, 75, 105); ctxB.fillRect(1185, 340, 95, 290);

    // 穿長袍的羅馬人市民
    ctxB.fillStyle = '#3b3731';
    [540, 605, 695, 765].forEach((px, idx) => {
      const py = 585 + (idx % 2) * 28;
      ctxB.beginPath();
      ctxB.arc(px, py - 48, 11, 0, Math.PI * 2);
      ctxB.moveTo(px - 18, py + 45); ctxB.lineTo(px - 12, py - 34);
      ctxB.lineTo(px + 12, py - 34); ctxB.lineTo(px + 20, py + 45);
      ctxB.fill();
    });

    // --- 現在 (Present) ---
    const skyA = ctxA.createLinearGradient(0, 0, 0, height * 0.65);
    skyA.addColorStop(0, '#4f86b8');
    skyA.addColorStop(0.65, '#8ab6db');
    skyA.addColorStop(1, '#c5dced');
    ctxA.fillStyle = skyA;
    ctxA.fillRect(0, 0, width, height);

    // 松樹
    ctxA.fillStyle = '#2d4726';
    ctxA.beginPath();
    ctxA.arc(645, 165, 36, 0, Math.PI * 2); ctxA.arc(675, 178, 28, 0, Math.PI * 2); ctxA.arc(620, 182, 25, 0, Math.PI * 2);
    ctxA.fill();

    // 斷壁
    ctxA.fillStyle = '#9e8e76';
    ctxA.beginPath();
    ctxA.moveTo(40, 210); ctxA.lineTo(320, 205); ctxA.lineTo(540, 215);
    ctxA.lineTo(740, 215); ctxA.lineTo(775, 275); ctxA.lineTo(950, 275);
    ctxA.lineTo(950, 480); ctxA.lineTo(40, 480);
    ctxA.closePath(); ctxA.fill();

    // 門洞
    ctxA.fillStyle = '#1f1c18';
    ctxA.fillRect(160, 235, 32, 38); ctxA.fillRect(320, 245, 34, 34); ctxA.fillRect(150, 315, 45, 85);

    // 主拱門（精準重合）
    ctxA.fillStyle = '#b3a38b';
    ctxA.beginPath();
    ctxA.arc(mainArchX, mainArchY, mainArchR + 18, Math.PI, 0);
    ctxA.lineTo(mainArchX + mainArchR + 18, 540);
    ctxA.lineTo(mainArchX - mainArchR - 18, 540);
    ctxA.closePath(); ctxA.fill();

    ctxA.fillStyle = '#1c1915';
    ctxA.beginPath();
    ctxA.arc(mainArchX, mainArchY, mainArchR, Math.PI, 0);
    ctxA.lineTo(mainArchX + mainArchR, 540); ctxA.lineTo(mainArchX - mainArchR, 540);
    ctxA.closePath(); ctxA.fill();

    // 藍天透光
    ctxA.fillStyle = '#9bc2e0';
    ctxA.beginPath();
    ctxA.arc(mainArchX - 8, mainArchY + 25, 34, Math.PI, 0);
    ctxA.lineTo(mainArchX + 26, 510); ctxA.lineTo(mainArchX - 42, 510);
    ctxA.closePath(); ctxA.fill();

    // 行人小拱門
    ctxA.fillStyle = '#a89880';
    ctxA.fillRect(sideArchX - 65, sideArchY - 62, 130, 190);
    ctxA.fillStyle = '#171512';
    ctxA.beginPath();
    ctxA.arc(sideArchX, sideArchY, sideArchR, Math.PI, 0);
    ctxA.lineTo(sideArchX + sideArchR, 540); ctxA.lineTo(sideArchX - sideArchR, 540);
    ctxA.closePath(); ctxA.fill();

    // 現代路面
    ctxA.fillStyle = '#c4bcb0';
    ctxA.beginPath();
    ctxA.moveTo(410, 540); ctxA.lineTo(820, 540); ctxA.lineTo(680, height); ctxA.lineTo(140, height);
    ctxA.closePath(); ctxA.fill();

    // 殘垣
    ctxA.fillStyle = '#9c8b73';
    ctxA.beginPath();
    ctxA.moveTo(640, 545); ctxA.lineTo(950, 440); ctxA.lineTo(1280, 460); ctxA.lineTo(1280, height); ctxA.lineTo(610, height);
    ctxA.closePath(); ctxA.fill();

    // 現代遊客與安全欄
    ctxA.strokeStyle = '#33302c'; ctxA.lineWidth = 4;
    ctxA.beginPath();
    ctxA.moveTo(395, height); ctxA.lineTo(605, 595);
    ctxA.moveTo(355, height); ctxA.lineTo(605, 625);
    ctxA.stroke();

    ctxA.fillStyle = '#d9b38c';
    ctxA.beginPath(); ctxA.arc(415, 635, 8, 0, Math.PI * 2); ctxA.fill();
    ctxA.fillStyle = '#2b2b2b'; ctxA.fillRect(405, 645, 20, 28);
    ctxA.fillStyle = '#e6e2da'; ctxA.fillRect(407, 673, 16, 18);
  }

  /**
   * 2. 公共廣場與朱比特神廟 Foro & Tempio di Giove
   */
  function drawForo(ctxB, ctxA, width, height) {
    const templeX = 460;
    const templeW = 360;
    const templeY = 240;
    const templeBaseY = 460;

    // --- 過去 (Past)：整齊大理石神廟與平緩綠色維蘇威山 ---
    const skyB = ctxB.createLinearGradient(0, 0, 0, height * 0.55);
    skyB.addColorStop(0, '#cdd3cf'); skyB.addColorStop(1, '#e5eae6');
    ctxB.fillStyle = skyB; ctxB.fillRect(0, 0, width, height);

    // 火山爆發前：平緩單峰綠山
    ctxB.fillStyle = '#7a8e72';
    ctxB.beginPath();
    ctxB.moveTo(220, 380);
    ctxB.bezierCurveTo(460, 210, 820, 210, 1060, 380);
    ctxB.closePath();
    ctxB.fill();
    ctxB.strokeStyle = '#5a6e54'; ctxB.lineWidth = 2; ctxB.stroke();

    // 兩側雙層柱廊（左側）
    ctxB.fillStyle = '#dcd7cd';
    ctxB.fillRect(0, 260, 360, 220);
    ctxB.fillStyle = '#4a453c';
    for (let c = 40; c < 340; c += 45) {
      ctxB.fillRect(c, 260, 14, 220);
    }
    // 兩側雙層柱廊（右側）
    ctxB.fillStyle = '#dcd7cd';
    ctxB.fillRect(920, 260, 360, 220);
    ctxB.fillStyle = '#4a453c';
    for (let c = 940; c < 1260; c += 45) {
      ctxB.fillRect(c, 260, 14, 220);
    }

    // 朱比特神廟高台基座
    ctxB.fillStyle = '#c5beae';
    ctxB.fillRect(templeX - 20, templeBaseY - 60, templeW + 40, 70);
    // 中央台階
    ctxB.fillStyle = '#a8a090';
    for (let s = 0; s < 6; s++) {
      ctxB.fillRect(templeX + 60 - s * 8, templeBaseY - 60 + s * 11, (templeW - 120) + s * 16, 10);
    }

    // 神廟六根柱子
    ctxB.fillStyle = '#dedad2';
    const colStep = (templeW - 30) / 5;
    for (let i = 0; i < 6; i++) {
      const cx = templeX + 15 + i * colStep;
      ctxB.fillRect(cx - 9, templeY + 50, 18, 150);
      ctxB.fillRect(cx - 13, templeY + 44, 26, 8); // 柱頭
      ctxB.fillRect(cx - 12, templeY + 195, 24, 7); // 柱礎
    }

    // 柱頂過樑 (Entablature)
    ctxB.fillStyle = '#cec8bc';
    ctxB.fillRect(templeX - 10, templeY + 28, templeW + 20, 22);

    // 三角山牆 (Pediment)
    ctxB.fillStyle = '#b5ad9e';
    ctxB.beginPath();
    ctxB.moveTo(templeX - 15, templeY + 28);
    ctxB.lineTo(templeX + templeW / 2, templeY - 60);
    ctxB.lineTo(templeX + templeW + 15, templeY + 28);
    ctxB.closePath();
    ctxB.fill();
    ctxB.strokeStyle = '#4e483e'; ctxB.lineWidth = 3; ctxB.stroke();

    // 廣場開闊鋪石地面
    ctxB.fillStyle = '#e4dfd5';
    ctxB.beginPath();
    ctxB.moveTo(120, templeBaseY + 10); ctxB.lineTo(1160, templeBaseY + 10);
    ctxB.lineTo(width, height); ctxB.lineTo(0, height);
    ctxB.closePath();
    ctxB.fill();

    // 廣場上的長袍羅馬市民
    ctxB.fillStyle = '#423c34';
    [320, 410, 580, 680, 770, 890].forEach((px, idx) => {
      const py = templeBaseY + 70 + (idx % 3) * 45;
      ctxB.beginPath();
      ctxB.arc(px, py - 40, 10, 0, Math.PI * 2);
      ctxB.moveTo(px - 14, py + 36); ctxB.lineTo(px - 9, py - 28);
      ctxB.lineTo(px + 9, py - 28); ctxB.lineTo(px + 14, py + 36);
      ctxB.fill();
    });

    // --- 現在 (Present)：火山破口、神廟斷柱與無頂廢墟 ---
    const skyA = ctxA.createLinearGradient(0, 0, 0, height * 0.6);
    skyA.addColorStop(0, '#3c7db8'); skyA.addColorStop(1, '#b0d4f1');
    ctxA.fillStyle = skyA; ctxA.fillRect(0, 0, width, height);

    // 現代維蘇威火山：標誌性雙峰火山口破口（Somma 破火山口山嶺 + 火山錐）
    ctxA.fillStyle = '#5c646b';
    ctxA.beginPath();
    ctxA.moveTo(180, 390);
    ctxA.lineTo(380, 260); // 左側 Somma 山脊
    ctxA.lineTo(510, 230); // 破火山口左峰
    ctxA.lineTo(590, 275); // 火山口鞍部缺口
    ctxA.lineTo(690, 220); // 中央火山錐主峰
    ctxA.lineTo(840, 310); // 右翼緩坡
    ctxA.lineTo(1100, 390);
    ctxA.closePath();
    ctxA.fill();

    // 左右殘垣（原本整齊柱廊如今只剩半截）
    ctxA.fillStyle = '#9b8b76';
    ctxA.fillRect(0, 360, 340, 120);
    for (let c = 50; c < 330; c += 70) {
      ctxA.fillStyle = '#bfb39f';
      ctxA.fillRect(c, 320, 22, 60); // 半截石柱
    }
    ctxA.fillStyle = '#9b8b76';
    ctxA.fillRect(940, 360, 340, 120);
    for (let c = 960; c < 1240; c += 70) {
      ctxA.fillStyle = '#bfb39f';
      ctxA.fillRect(c, 330, 22, 50); // 半截石柱
    }

    // 朱比特神廟高台（位置精準對齊）
    ctxA.fillStyle = '#8f8371';
    ctxA.fillRect(templeX - 20, templeBaseY - 60, templeW + 40, 70);
    // 殘缺台階
    ctxA.fillStyle = '#7a6f5e';
    for (let s = 0; s < 6; s++) {
      ctxA.fillRect(templeX + 60 - s * 8, templeBaseY - 60 + s * 11, (templeW - 120) + s * 16, 10);
    }

    // 神廟柱子（只剩殘破的幾根半截圓柱，山牆已完全塌毀！）
    for (let i = 0; i < 6; i++) {
      const cx = templeX + 15 + i * colStep;
      if (i === 1 || i === 4) {
        // 這兩根較高
        ctxA.fillStyle = '#c7bca9';
        ctxA.fillRect(cx - 9, templeY + 110, 18, 90);
      } else if (i === 0 || i === 5) {
        // 外側兩根很矮
        ctxA.fillStyle = '#b3a693';
        ctxA.fillRect(cx - 9, templeY + 155, 18, 45);
      } else {
        // 中間斷柱
        ctxA.fillStyle = '#baad9a';
        ctxA.fillRect(cx - 9, templeY + 135, 18, 65);
      }
    }

    // 現代地面與碎石
    ctxA.fillStyle = '#baa993';
    ctxA.beginPath();
    ctxA.moveTo(120, templeBaseY + 10); ctxA.lineTo(1160, templeBaseY + 10);
    ctxA.lineTo(width, height); ctxA.lineTo(0, height);
    ctxA.closePath();
    ctxA.fill();

    // 現代遊客（手持手機、遮陽帽）
    ctxA.fillStyle = '#2d2b28';
    [340, 720, 840].forEach((px, idx) => {
      const py = templeBaseY + 110 + idx * 30;
      ctxA.beginPath(); ctxA.arc(px, py - 35, 8, 0, Math.PI * 2); ctxA.fill();
      ctxA.fillStyle = '#c44525'; ctxA.fillRect(px - 10, py - 25, 20, 30);
      ctxA.fillStyle = '#2d2b28';
    });
  }

  /**
   * 3. 豐饒大道熱食店 Thermopolium di Vetutius Placidus
   */
  function drawThermopolium(ctxB, ctxA, width, height) {
    const ctrX = 260;
    const ctrY = 460;
    const ctrW = 760;
    const ctrH = 220;
    // 4 個內嵌大陶罐 (Dolia) 圓形座標
    const dolia = [
      { x: 370, y: 500, r: 44 },
      { x: 530, y: 500, r: 44 },
      { x: 690, y: 500, r: 44 },
      { x: 850, y: 500, r: 44 }
    ];

    // --- 過去 (Past)：香氣四溢、鮮麗壁畫與熱食熱酒 ---
    const skyB = ctxB.createLinearGradient(0, 0, 0, height * 0.4);
    skyB.addColorStop(0, '#544638'); skyB.addColorStop(1, '#82705e');
    ctxB.fillStyle = skyB; ctxB.fillRect(0, 0, width, height);

    // 後方鮮艷的龐貝紅濕壁畫牆面 (Pompeian Red)
    ctxB.fillStyle = '#a83c27';
    ctxB.fillRect(180, 160, 920, 320);
    // 守護神與商神裝飾壁龕金框
    ctxB.strokeStyle = '#e0aa38'; ctxB.lineWidth = 6;
    ctxB.strokeRect(420, 190, 440, 240);
    ctxB.fillStyle = '#d9982e';
    ctxB.font = 'bold 22px sans-serif';
    ctxB.fillText('GENIO SACRVM · MERCVRIVS', 470, 230);
    // 懸掛的火腿乾酪插畫
    ctxB.fillStyle = '#6b2d1f';
    ctxB.beginPath(); ctxB.arc(520, 310, 28, 0, Math.PI * 2); ctxB.fill();
    ctxB.beginPath(); ctxB.arc(760, 310, 28, 0, Math.PI * 2); ctxB.fill();

    // L形彩色大理石櫃檯本體
    ctxB.fillStyle = '#bda78d';
    ctxB.fillRect(ctrX, ctrY, ctrW, ctrH);
    // 櫃檯立面彩色大理石幾何拼花 (Opus Sectile)
    const colors = ['#8f3a2b', '#2f4a3e', '#c99f3c', '#dcd4c3'];
    for (let bx = ctrX + 20; bx < ctrX + ctrW - 40; bx += 85) {
      for (let by = ctrY + 70; by < ctrY + ctrH - 20; by += 55) {
        ctxB.fillStyle = colors[(bx + by) % colors.length];
        ctxB.fillRect(bx, by, 72, 44);
      }
    }
    // 櫃檯檯面石板
    ctxB.fillStyle = '#e8ded0';
    ctxB.fillRect(ctrX - 15, ctrY - 10, ctrW + 30, 65);
    ctxB.strokeStyle = '#5a4f41'; ctxB.lineWidth = 3;
    ctxB.strokeRect(ctrX - 15, ctrY - 10, ctrW + 30, 65);

    // 4 個內嵌大陶罐 (熱氣騰騰、裝滿燉菜)
    dolia.forEach((d) => {
      ctxB.fillStyle = '#9c5432';
      ctxB.beginPath(); ctxB.arc(d.x, d.y, d.r + 8, 0, Math.PI * 2); ctxB.fill();
      ctxB.fillStyle = '#542613';
      ctxB.beginPath(); ctxB.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctxB.fill();
      // 熱菜金黃高湯光芒
      ctxB.fillStyle = '#d17e2c';
      ctxB.beginPath(); ctxB.arc(d.x, d.y, d.r - 12, 0, Math.PI * 2); ctxB.fill();
      // 熱氣蒸騰白煙
      ctxB.strokeStyle = 'rgba(255, 255, 255, 0.55)'; ctxB.lineWidth = 3;
      ctxB.beginPath();
      ctxB.moveTo(d.x, d.y - 20);
      ctxB.bezierCurveTo(d.x - 15, d.y - 60, d.x + 15, d.y - 100, d.x, d.y - 140);
      ctxB.stroke();
    });

    // 店主招呼
    ctxB.fillStyle = '#3d3429';
    ctxB.beginPath(); ctxB.arc(640, 390, 18, 0, Math.PI * 2); ctxB.fill();
    ctxB.fillStyle = '#f0ece1'; ctxB.fillRect(618, 410, 44, 50);

    // --- 現在 (Present)：火山灰凝固兩千年的大理石櫃檯 ---
    const skyA = ctxA.createLinearGradient(0, 0, 0, height * 0.4);
    skyA.addColorStop(0, '#5a8cb5'); skyA.addColorStop(1, '#aed0ed');
    ctxA.fillStyle = skyA; ctxA.fillRect(0, 0, width, height);

    // 斑駁風化的後牆（部分磚塊裸露，屋頂早已消失）
    ctxA.fillStyle = '#8f6758';
    ctxA.fillRect(180, 160, 920, 320);
    // 殘存的褪色濕壁畫遺跡
    ctxA.fillStyle = '#7a3b30';
    ctxA.fillRect(420, 230, 440, 180);
    // 裸露的古羅馬火山灰紅磚 (Opus Latericium)
    ctxA.strokeStyle = '#4a2d24'; ctxA.lineWidth = 2;
    for (let rx = 190; rx < 410; rx += 30) {
      for (let ry = 180; ry < 460; ry += 16) {
        ctxA.strokeRect(rx, ry, 26, 12);
      }
    }

    // 現代保護鋼架橫樑
    ctxA.fillStyle = '#2c333a';
    ctxA.fillRect(140, 140, 1000, 16);

    // L形大理石櫃檯（完全精準吻合）
    ctxA.fillStyle = '#9c8c78';
    ctxA.fillRect(ctrX, ctrY, ctrW, ctrH);
    // 斑駁嵌合石塊
    for (let bx = ctrX + 20; bx < ctrX + ctrW - 40; bx += 85) {
      for (let by = ctrY + 70; by < ctrY + ctrH - 20; by += 55) {
        ctxA.fillStyle = '#7a6c5b';
        ctxA.fillRect(bx, by, 72, 44);
        ctxA.strokeStyle = '#4a4136'; ctxA.lineWidth = 1.5; ctxA.strokeRect(bx, by, 72, 44);
      }
    }
    // 檯面
    ctxA.fillStyle = '#beb3a3';
    ctxA.fillRect(ctrX - 15, ctrY - 10, ctrW + 30, 65);

    // 4 個深邃空陶罐（兩千年歷史開口，完全同一座標）
    dolia.forEach((d) => {
      ctxA.fillStyle = '#78432a';
      ctxA.beginPath(); ctxA.arc(d.x, d.y, d.r + 8, 0, Math.PI * 2); ctxA.fill();
      ctxA.fillStyle = '#1c1613'; // 空陶罐內部的深沉陰影
      ctxA.beginPath(); ctxA.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctxA.fill();
    });

    // 現代金屬圍欄與解說牌
    ctxA.strokeStyle = '#383d42'; ctxA.lineWidth = 4;
    ctxA.beginPath(); ctxA.moveTo(100, 710); ctxA.lineTo(1180, 710); ctxA.stroke();
    ctxA.fillStyle = '#e8e5dc'; ctxA.fillRect(240, 680, 70, 45);
  }

  /**
   * 4. 圓形競技場 Anfiteatro
   */
  function drawAnfiteatro(ctxB, ctxA, width, height) {
    const arenaCx = 640;
    const arenaCy = 510;
    const arenaRx = 460;
    const arenaRy = 190;

    // --- 過去 (Past)：巨幅彩色遮陽天幕與狂熱角鬥場 ---
    const skyB = ctxB.createLinearGradient(0, 0, 0, height * 0.4);
    skyB.addColorStop(0, '#c7c2b5'); skyB.addColorStop(1, '#dfdbcf');
    ctxB.fillStyle = skyB; ctxB.fillRect(0, 0, width, height);

    // 巨大的彩色遮陽帆布 (Velarium)
    ctxB.fillStyle = '#b84828';
    ctxB.beginPath();
    ctxB.moveTo(80, 100);
    ctxB.bezierCurveTo(400, 180, 880, 180, 1200, 100);
    ctxB.lineTo(1240, 260);
    ctxB.bezierCurveTo(880, 320, 400, 320, 40, 260);
    ctxB.closePath();
    ctxB.fill();
    // 天幕繩索與木檣
    ctxB.strokeStyle = '#4a251b'; ctxB.lineWidth = 3;
    for (let rx = 120; rx <= 1160; rx += 80) {
      ctxB.beginPath(); ctxB.moveTo(rx, 80); ctxB.lineTo(rx, 260); ctxB.stroke();
    }

    // 看台層層座位 (密密麻麻的兩萬名觀眾)
    ctxB.fillStyle = '#9e8e7c';
    ctxB.beginPath();
    ctxB.ellipse(arenaCx, arenaCy, arenaRx + 90, arenaRy + 80, 0, 0, Math.PI * 2);
    ctxB.fill();

    ctxB.fillStyle = '#42372c';
    for (let i = 0; i < 180; i++) {
      const ang = (i / 180) * Math.PI * 2;
      const rDist = arenaRx + 30 + (i % 5) * 11;
      const rx = arenaCx + Math.cos(ang) * rDist;
      const ry = arenaCy + Math.sin(ang) * (rDist * (arenaRy / arenaRx));
      ctxB.fillRect(rx, ry, 4, 6);
    }

    // 中央黃色沙場 (Arena)
    ctxB.fillStyle = '#d9b66c';
    ctxB.beginPath();
    ctxB.ellipse(arenaCx, arenaCy, arenaRx, arenaRy, 0, 0, Math.PI * 2);
    ctxB.fill();
    ctxB.strokeStyle = '#856424'; ctxB.lineWidth = 4; ctxB.stroke();

    // 中央角鬥士對決剪影
    // 角鬥士 1 (網鬥士/色雷斯短劍)
    ctxB.fillStyle = '#2b231a';
    ctxB.beginPath(); ctxB.arc(arenaCx - 35, arenaCy - 20, 8, 0, Math.PI * 2); ctxB.fill();
    ctxB.fillRect(arenaCx - 40, arenaCy - 12, 12, 26);
    // 盾牌與短劍
    ctxB.strokeStyle = '#8a3320'; ctxB.lineWidth = 5;
    ctxB.beginPath(); ctxB.moveTo(arenaCx - 48, arenaCy - 10); ctxB.lineTo(arenaCx - 48, arenaCy + 15); ctxB.stroke();

    // 角鬥士 2 (魚盔鬥士)
    ctxB.fillStyle = '#2b231a';
    ctxB.beginPath(); ctxB.arc(arenaCx + 35, arenaCy - 20, 8, 0, Math.PI * 2); ctxB.fill();
    ctxB.fillRect(arenaCx + 28, arenaCy - 12, 12, 26);
    // 長矛
    ctxB.strokeStyle = '#2b231a'; ctxB.lineWidth = 2.5;
    ctxB.beginPath(); ctxB.moveTo(arenaCx + 15, arenaCy - 5); ctxB.lineTo(arenaCx - 20, arenaCy - 10); ctxB.stroke();

    // --- 現在 (Present)：無頂最古老競技場、茵茵青草與安寧遺跡 ---
    const skyA = ctxA.createLinearGradient(0, 0, 0, height * 0.45);
    skyA.addColorStop(0, '#3672a8'); skyA.addColorStop(1, '#98c6eb');
    ctxA.fillStyle = skyA; ctxA.fillRect(0, 0, width, height);

    // 完整的古代雙層外環拱券（天幕已不存在，露出藍天）
    ctxA.fillStyle = '#8f806e';
    ctxA.beginPath();
    ctxA.ellipse(arenaCx, arenaCy, arenaRx + 90, arenaRy + 80, 0, 0, Math.PI * 2);
    ctxA.fill();

    // 石造外拱券立面
    ctxA.fillStyle = '#1c1714';
    for (let a = 0; a < 36; a++) {
      const ang = Math.PI + (a / 36) * Math.PI; // 上半圈外拱
      const rx = arenaCx + Math.cos(ang) * (arenaRx + 80);
      const ry = arenaCy + Math.sin(ang) * (arenaRy + 75);
      ctxA.fillRect(rx - 7, ry - 14, 14, 28);
    }

    // 看台石階（青草在石縫間蔓生）
    ctxA.fillStyle = '#5c734b'; // 蔓生綠草
    ctxA.beginPath();
    ctxA.ellipse(arenaCx, arenaCy, arenaRx + 20, arenaRy + 15, 0, 0, Math.PI * 2);
    ctxA.fill();

    // 今日中央競技場：平整靜謐的綠色草地
    ctxA.fillStyle = '#4f7842';
    ctxA.beginPath();
    ctxA.ellipse(arenaCx, arenaCy, arenaRx, arenaRy, 0, 0, Math.PI * 2);
    ctxA.fill();
    ctxA.strokeStyle = '#7d705c'; ctxA.lineWidth = 4; ctxA.stroke();

    // 幽深的出入場拱形通道 (Vomitorium)
    ctxA.fillStyle = '#14120f';
    ctxA.beginPath();
    ctxA.arc(arenaCx - arenaRx + 15, arenaCy, 26, Math.PI * 0.5, Math.PI * 1.5);
    ctxA.fill();
    ctxA.beginPath();
    ctxA.arc(arenaCx + arenaRx - 15, arenaCy, 26, Math.PI * 1.5, Math.PI * 0.5);
    ctxA.fill();
  }

  // 匯出主要渲染函式
  function renderSpot(spotId, canvasBefore, canvasAfter) {
    const width = canvasBefore.width;
    const height = canvasBefore.height;
    const ctxB = canvasBefore.getContext('2d');
    const ctxA = canvasAfter.getContext('2d');

    ctxB.clearRect(0, 0, width, height);
    ctxA.clearRect(0, 0, width, height);

    if (spotId === 'foro') {
      drawForo(ctxB, ctxA, width, height);
    } else if (spotId === 'thermopolium') {
      drawThermopolium(ctxB, ctxA, width, height);
    } else if (spotId === 'anfiteatro') {
      drawAnfiteatro(ctxB, ctxA, width, height);
    } else {
      drawMarina(ctxB, ctxA, width, height);
    }
  }

  global.POMPEII_ART = {
    spots: POMPEII_SPOTS,
    renderSpot: renderSpot
  };
})(typeof window !== 'undefined' ? window : global);
