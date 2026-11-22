/**
 * 龐貝古城：今昔對比資料庫與繪圖引擎 (Pompeii Then & Now Engine)
 * 整合真實高清疊圖照片與向量還原畫布，支援同一地點多視角切換
 */
(function (global) {
  'use strict';

  const POMPEII_LOCATIONS = [
    {
      id: 'foro',
      name: '🏛️ 公共廣場與神廟',
      angles: [
        {
          id: 'foro_1',
          title: '角度 1：北望神廟與火山（高清）',
          past: 'img/pompeii/foro_1_past.jpg',
          present: 'img/pompeii/foro_1_present.jpg',
          descPast: '西元79年繁盛日常：長袍羅馬市民在長方形市政廣場穿梭，北端朱比特神廟高聳威嚴，兩側為長廊攤位。',
          descPresent: '2026年今日現場：神廟僅存高台與斷柱，兩側長廊柱礎依舊整齊排列，後方維蘇威火山猙獰破頂沉睡在天際。'
        },
        {
          id: 'foro_2',
          title: '角度 2：凱旋柱與騎馬銅像高台',
          past: 'img/pompeii/foro_2_past.jpg',
          present: 'img/pompeii/foro_2_present.jpg',
          descPast: '西元79年市政心臟：廣場東北方佇立著榮譽騎馬銅像與高聳的大理石凱旋柱，背景是平緩綠意的大山。',
          descPresent: '2026年今日現場：高大的大理石雕像高台已褪去青銅光芒，石柱與紅磚牆面在陽光下述說兩千年歷史。'
        },
        {
          id: 'foro_3',
          title: '角度 3：柱廊中央中軸線視角',
          past: 'img/pompeii/foro_3_past.jpg',
          present: 'img/pompeii/foro_3_present.jpg',
          descPast: '西元79年雙層柱廊：整齊的白色大理石愛奧尼柱廊高聳林立，紅布幔與SPQR鷹旗飄揚，遠方神廟氣勢恢宏。',
          descPresent: '2026年今日現場：同一透視位置的開闊石板大道，兩側古柱半截斷裂，遠方維蘇威破火山口直對中軸線。'
        },
        {
          id: 'foro_4',
          title: '角度 4：祭台與柯林斯石柱基座',
          past: 'img/pompeii/foro_4_past.jpg',
          present: 'img/pompeii/foro_4_present.jpg',
          descPast: '西元79年華麗祭壇：神殿前矗立著細緻浮雕的大理石雙層祭祀亭台，柱頭雕花與羅馬官員雕像白淨生輝。',
          descPresent: '2026年今日現場：祭壇大理石外層剝落，露出四根修長的古石柱與基座，靜靜對望著群山與藍天。'
        }
      ]
    },
    {
      id: 'street',
      name: '🚶 龐貝繁盛街道與市集',
      angles: [
        {
          id: 'street_1',
          title: '角度 1：市集大道直對維蘇威火山',
          past: 'img/pompeii/street_1_past.jpg',
          present: 'img/pompeii/street_1_present.jpg',
          descPast: '西元79年繁盛商道：兩側兩層樓木石屋舍鱗次櫛比，遮陽布篷下擺滿蔬果，遠處尚未塌毀的平緩火山高聳入雲。',
          descPresent: '2026年今日現場：整排石柱殘基與堅硬的火山岩玄武岩石板路完整保存，遠方破火山口清晰可見。'
        },
        {
          id: 'street_2',
          title: '角度 2：石板官道與斑馬線過街石',
          past: 'img/pompeii/street_2_past.jpg',
          present: 'img/pompeii/street_2_present.jpg',
          descPast: '西元79年石板大道：高凸的石塊供行人過街不沾泥水，車輪剛好從縫隙駛過，兩側牆面繪滿彩色灰泥壁畫。',
          descPresent: '2026年今日現場：數百年車輪碾出的深溝痕跡歷歷在目，高聳的古石牆在藍天白雲下靜穆佇立。'
        },
        {
          id: 'street_3',
          title: '角度 3：轉角浮雕公共噴泉水槽',
          past: 'img/pompeii/street_3_past.jpg',
          present: 'img/pompeii/street_3_present.jpg',
          descPast: '西元79年街角水井：雕刻著人臉面具的大石水槽湧出清涼泉水，市民提壺汲水，騾車在石板路顛簸前行。',
          descPresent: '2026年今日現場：人臉浮雕出水口石槽依然完整立於街角，石緣被兩千年前汲水者的手掌磨得圓潤光滑。'
        },
        {
          id: 'street_4',
          title: '角度 4：西元79年火山爆發時刻',
          past: 'img/pompeii/street_4_past.jpg',
          present: 'img/pompeii/street_4_present.jpg',
          descPast: '西元79年致命時刻：維蘇威火山猛烈噴發，黑色蕈狀浮石雨與火山灰蔽日遮天，街頭市民在恐慌中倉促撤離。',
          descPresent: '2026年今日現場：火山灰沉睡兩千年後被考古發掘，陽光重新照亮這條石板古道，宛如時空凝結的紀念碑。'
        }
      ]
    },
    {
      id: 'thermopolium',
      name: '🍲 豐饒大道熱食小吃店',
      angles: [
        {
          id: 'thermopolium_1',
          title: '角度 1：L形大理石櫃檯與陶罐（實景）',
          past: 'img/pompeii/thermopolium_1_past.jpg',
          present: 'img/pompeii/thermopolium_1_present.jpg',
          descPast: '西元79年熟食吧台：L形大理石櫃檯內嵌陶罐滾著肉汁扁豆，後牆壁龕守護神壁畫色彩鮮麗，市民快餐談笑。',
          descPresent: '2026年今日現場：彩色大理石切片鑲嵌櫃檯與圓形陶罐口完整封存於火山灰下，生活氣息彷彿留在昨天。'
        }
      ]
    },
    {
      id: 'bakery',
      name: '🥖 麵包烘焙坊大街',
      angles: [
        {
          id: 'bakery_1',
          title: '角度 1：熔岩石磨與現烤麵包店',
          past: 'img/pompeii/bakery_1_past.jpg',
          present: 'img/pompeii/bakery_1_present.jpg',
          descPast: '西元79年烘焙坊：門口巨大沙漏型熔岩石磨旋轉碾磨穀物，櫃檯擺滿剛出爐的八分圓形古羅馬麵包，香氣四溢。',
          descPresent: '2026年今日現場：堅硬的玄武岩沙漏石磨原樣佇立在店鋪遺址，烤爐紅磚痕跡清晰可見。'
        }
      ]
    },
    {
      id: 'villa',
      name: '🏡 貴族豪宅噴泉水景中庭',
      angles: [
        {
          id: 'villa_1',
          title: '角度 1：水仙女壁龕與馬賽克彩繪',
          past: 'img/pompeii/villa_1_past.jpg',
          present: 'img/pompeii/villa_1_present.jpg',
          descPast: '西元79年貴族中庭：中央水池噴泉潺潺，後牆壁龕覆蓋極盡華麗的玻璃釉馬賽克海神壁畫，主人側臥品酒休憩。',
          descPresent: '2026年今日現場：兩千年前精美絕倫的馬賽克壁龕奇蹟般色彩斑斕如新，水池石基完整映照地中海天光。'
        }
      ]
    },
    {
      id: 'aerial',
      name: '🌋 龐貝全城鳥瞰與火山爆發',
      angles: [
        {
          id: 'aerial_1',
          title: '角度 1：古城東南鳥瞰大體育場',
          past: 'img/pompeii/aerial_1_past.jpg',
          present: 'img/pompeii/aerial_1_present.jpg',
          descPast: '西元79年古城鳥瞰：整座龐貝覆蓋著整齊的紅瓦屋頂，大體育場綠蔭圍繞著中央泳池，背後為平緩的維蘇威大山。',
          descPresent: '2026年今日現場：整齊劃一的羅馬格狀街道與住宅基底一覽無遺，體育場與兩萬人競技場在陽光下靜謐舒展。'
        },
        {
          id: 'aerial_2',
          title: '角度 2：爆發噴發柱與今日全景對照',
          past: 'img/pompeii/aerial_2_past.jpg',
          present: 'img/pompeii/aerial_2_present.jpg',
          descPast: '西元79年災難鳥瞰：維蘇威火山主峰劇烈爆炸，數萬米高的巨大浮石灰柱衝入平流層，火光與碎屑流席捲山麓。',
          descPresent: '2026年今日現場：今日安寧廣袤的拿坡里平原與綠樹覆蓋的龐貝遺址，大自然的毀滅與永恆在此交織。'
        }
      ]
    },
    {
      id: 'arch',
      name: '🏛️ 廣場榮譽拱門',
      angles: [
        {
          id: 'arch_1',
          title: '角度 1：卡利古拉榮譽拱門',
          past: 'img/pompeii/arch_1_past.jpg',
          present: 'img/pompeii/arch_1_present.jpg',
          descPast: '西元79年榮譽拱門：廣場北端的磚石單孔拱門貼飾著精美大理石板與皇帝雕像，穿過拱門可抵達神廟與市集。',
          descPresent: '2026年今日現場：拱門頂部的裝飾雕塑雖已佚失，但古羅馬堅固的磚石砌拱券結構依然巍然屹立。'
        }
      ]
    },
    {
      id: 'marina',
      name: '🏛️ 海門雙拱與石板大道（向量還原）',
      angles: [
        {
          id: 'marina_vector',
          title: '角度 1：城門雙拱人車分流與古道',
          isCanvas: true,
          drawId: 'marina',
          descPast: '西元79年繁盛港門：大海拍岸，商船泊靠。大小雙拱人車分流，長袍羅馬人與滿載陶罐的騾車顛簸入城。',
          descPresent: '今日現場：海岸已退縮兩公里。厚重玄武岩石板大道、深車轍、斑馬線過街石與防夜盲白石完好如初。'
        }
      ]
    },
    {
      id: 'anfiteatro',
      name: '⚔️ 圓形競技場（向量還原）',
      angles: [
        {
          id: 'anfiteatro_vector',
          title: '角度 1：全羅馬世界最古老石造角鬥場',
          isCanvas: true,
          drawId: 'anfiteatro',
          descPast: '西元79年兩萬人沸騰角鬥場：高空拉起巨幅遮陽天幕，旗幟招展，角鬥士沙場金屬交鋒，山呼海嘯。',
          descPresent: '今日現場：世界最古老石造競技場雙層外拱與石階依然完整，青草在石縫蔓生，耳畔唯有山風與歷史迴音。'
        }
      ]
    },
    {
      id: 'other_roman',
      name: '🏛️ 古羅馬名城巡禮（以弗所）',
      angles: [
        {
          id: 'ephesus_curetes',
          title: '視角 1：克里特大道 (Via de los Curetes)',
          past: 'img/pompeii/ephesus_curetes_past.jpg',
          present: 'img/pompeii/ephesus_curetes_present.jpg',
          descPast: '古羅馬榮耀年代：整齊華麗的雙層彩色大理石柱廊立面，雕像林立，平整石板大道通往塞爾蘇斯圖書館。',
          descPresent: '今日現場遺跡：兩側白色大理石柱廊整齊佇立，石板大道向山谷延伸，是全地中海保存最宏大的古羅馬城市遺址之一。'
        },
        {
          id: 'ephesus_hadrian',
          title: '視角 2：哈德良神廟 (Templo de Adriano)',
          past: 'img/pompeii/ephesus_hadrian_past.jpg',
          present: 'img/pompeii/ephesus_hadrian_present.jpg',
          descPast: '古羅馬榮耀年代：優雅的敘利亞拱門，飾有勝利女神與美杜莎浮雕，紅白綠彩繪鮮麗奪目，供奉皇帝哈德良。',
          descPresent: '今日現場遺跡：經典的正面弧形拱門與四根柯林斯柱基完整重建，浮雕細節生動，見證古羅馬建築極致工藝。'
        }
      ]
    }
  ];

  /**
   * 向量還原繪圖引擎（海門與圓形競技場）
   */
  function drawMarinaVector(ctxB, ctxA, width, height) {
    const mainArchX = 665, mainArchY = 390, mainArchR = 88;
    const sideArchX = 465, sideArchY = 415, sideArchR = 46;

    const skyB = ctxB.createLinearGradient(0, 0, 0, height * 0.6);
    skyB.addColorStop(0, '#d6d2c8'); skyB.addColorStop(1, '#ebe7de');
    ctxB.fillStyle = skyB; ctxB.fillRect(0, 0, width, height);

    ctxB.fillStyle = '#9c968b'; ctxB.fillRect(240, 170, 800, 320);
    ctxB.fillStyle = '#7d776d';
    for (let x = 245; x < 1035; x += 26) ctxB.fillRect(x, 154, 16, 16);

    ctxB.fillStyle = '#b8b2a6'; ctxB.fillRect(360, 220, 480, 320);
    ctxB.strokeStyle = '#4a463f'; ctxB.lineWidth = 3; ctxB.strokeRect(360, 220, 480, 320);

    ctxB.fillStyle = '#262420'; ctxB.beginPath();
    ctxB.arc(mainArchX, mainArchY, mainArchR, Math.PI, 0);
    ctxB.lineTo(mainArchX + mainArchR, 540); ctxB.lineTo(mainArchX - mainArchR, 540);
    ctxB.closePath(); ctxB.fill();

    ctxB.fillStyle = '#2b2824'; ctxB.beginPath();
    ctxB.arc(sideArchX, sideArchY, sideArchR, Math.PI, 0);
    ctxB.lineTo(sideArchX + sideArchR, 540); ctxB.lineTo(sideArchX - sideArchR, 540);
    ctxB.closePath(); ctxB.fill();

    ctxB.fillStyle = '#b0aaa0'; ctxB.beginPath();
    ctxB.moveTo(410, 540); ctxB.lineTo(820, 540); ctxB.lineTo(1160, height); ctxB.lineTo(100, height);
    ctxB.closePath(); ctxB.fill();

    const skyA = ctxA.createLinearGradient(0, 0, 0, height * 0.65);
    skyA.addColorStop(0, '#4f86b8'); skyA.addColorStop(1, '#c5dced');
    ctxA.fillStyle = skyA; ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = '#9e8e76'; ctxA.beginPath();
    ctxA.moveTo(40, 210); ctxA.lineTo(320, 205); ctxA.lineTo(775, 275); ctxA.lineTo(950, 275);
    ctxA.lineTo(950, 480); ctxA.lineTo(40, 480); ctxA.closePath(); ctxA.fill();

    ctxA.fillStyle = '#1c1915'; ctxA.beginPath();
    ctxA.arc(mainArchX, mainArchY, mainArchR, Math.PI, 0);
    ctxA.lineTo(mainArchX + mainArchR, 540); ctxA.lineTo(mainArchX - mainArchR, 540);
    ctxA.closePath(); ctxA.fill();

    ctxA.fillStyle = '#171512'; ctxA.beginPath();
    ctxA.arc(sideArchX, sideArchY, sideArchR, Math.PI, 0);
    ctxA.lineTo(sideArchX + sideArchR, 540); ctxA.lineTo(sideArchX - sideArchR, 540);
    ctxA.closePath(); ctxA.fill();

    ctxA.fillStyle = '#c4bcb0'; ctxA.beginPath();
    ctxA.moveTo(410, 540); ctxA.lineTo(820, 540); ctxA.lineTo(680, height); ctxA.lineTo(140, height);
    ctxA.closePath(); ctxA.fill();
  }

  function drawAnfiteatroVector(ctxB, ctxA, width, height) {
    const arenaCx = 640, arenaCy = 510, arenaRx = 460, arenaRy = 190;
    const skyB = ctxB.createLinearGradient(0, 0, 0, height * 0.4);
    skyB.addColorStop(0, '#c7c2b5'); skyB.addColorStop(1, '#dfdbcf');
    ctxB.fillStyle = skyB; ctxB.fillRect(0, 0, width, height);

    ctxB.fillStyle = '#b84828'; ctxB.beginPath();
    ctxB.moveTo(80, 100); ctxB.bezierCurveTo(400, 180, 880, 180, 1200, 100);
    ctxB.lineTo(1240, 260); ctxB.bezierCurveTo(880, 320, 400, 320, 40, 260);
    ctxB.closePath(); ctxB.fill();

    ctxB.fillStyle = '#9e8e7c'; ctxB.beginPath();
    ctxB.ellipse(arenaCx, arenaCy, arenaRx + 90, arenaRy + 80, 0, 0, Math.PI * 2); ctxB.fill();
    ctxB.fillStyle = '#d9b66c'; ctxB.beginPath();
    ctxB.ellipse(arenaCx, arenaCy, arenaRx, arenaRy, 0, 0, Math.PI * 2); ctxB.fill();

    const skyA = ctxA.createLinearGradient(0, 0, 0, height * 0.45);
    skyA.addColorStop(0, '#3672a8'); skyA.addColorStop(1, '#98c6eb');
    ctxA.fillStyle = skyA; ctxA.fillRect(0, 0, width, height);

    ctxA.fillStyle = '#8f806e'; ctxA.beginPath();
    ctxA.ellipse(arenaCx, arenaCy, arenaRx + 90, arenaRy + 80, 0, 0, Math.PI * 2); ctxA.fill();
    ctxA.fillStyle = '#4f7842'; ctxA.beginPath();
    ctxA.ellipse(arenaCx, arenaCy, arenaRx, arenaRy, 0, 0, Math.PI * 2); ctxA.fill();
  }

  /**
   * 載入指定視角（實景照片或向量畫布）
   */
  function loadAngle(angle, imgBefore, imgAfter, onReady) {
    if (angle.isCanvas) {
      const cb = document.createElement('canvas'); cb.width = 1280; cb.height = 800;
      const ca = document.createElement('canvas'); ca.width = 1280; ca.height = 800;
      const ctxB = cb.getContext('2d');
      const ctxA = ca.getContext('2d');

      if (angle.drawId === 'anfiteatro') {
        drawAnfiteatroVector(ctxB, ctxA, 1280, 800);
      } else {
        drawMarinaVector(ctxB, ctxA, 1280, 800);
      }

      imgBefore.src = cb.toDataURL('image/jpeg', 0.92);
      imgAfter.src = ca.toDataURL('image/jpeg', 0.92);
      if (onReady) onReady();
    } else {
      let loaded = 0;
      const check = () => {
        loaded++;
        if (loaded >= 2 && onReady) onReady();
      };
      imgBefore.onload = check;
      imgAfter.onload = check;
      imgBefore.onerror = check;
      imgAfter.onerror = check;
      imgBefore.src = angle.past;
      imgAfter.src = angle.present;
    }
  }

  global.POMPEII_ART = {
    locations: POMPEII_LOCATIONS,
    loadAngle: loadAngle
  };
})(typeof window !== 'undefined' ? window : global);
