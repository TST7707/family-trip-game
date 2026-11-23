/**
 * 龐貝古城：今昔對比資料庫與繪圖引擎 (Pompeii Then & Now Engine)
 * 整合真實高清疊圖照片、AR 實景遮罩與向量還原畫布，支援同一個地點多視角切換
 */
(function (global) {
  'use strict';

  const POMPEII_LOCATIONS = [
    {
      id: 'foro',
      name: '🏛️ 公共廣場與朱比特神廟',
      angles: [
        {
          id: 'foro_3',
          title: '角度 1：柱廊中軸線透視（對齊廊柱與方形基座）',
          past: 'img/pompeii/foro_3_past.jpg',
          present: 'img/pompeii/foro_3_present.jpg',
          isAR: false,
          lat: 40.7491,
          lng: 14.4845,
          descPast: '西元79年雙層柱廊：整齊的白色大理石愛奧尼柱廊高聳林立，紅布幔與SPQR鷹旗飄揚，柱子與方形石基整齊延伸，遠方神廟氣勢恢宏。',
          descPresent: '2026年今日現場：同一透視位置的開闊石板大道，兩側古柱與方形柱基精準對齊，遠方維蘇威破火山口直對中軸線。'
        }
      ]
    },
    {
      id: 'apollo',
      name: '🏛️ 阿波羅神廟聖殿',
      angles: [
        {
          id: 'apollo_1',
          title: '角度 1：列柱長廊與阿波羅彎弓青銅像（精準對齊柱列與青銅像）',
          past: 'img/pompeii/apollo_1_past.jpg',
          present: 'img/pompeii/apollo_1_present.jpg',
          isAR: false,
          lat: 40.7491,
          lng: 14.4837,
          descPast: '西元79年阿波羅聖殿：48根科林斯列柱環繞優雅中庭，高台前矗立著阿波羅手持長弓引弦欲射的青銅雕像，莊嚴神聖。',
          descPresent: '2026年今日現場：石柱與台階依舊佇立，右下角青銅阿波羅雕像（複製品）依舊保持著彎弓姿態，與兩千年前完美重合。'
        }
      ]
    },
    {
      id: 'fastfood',
      name: '🍗 第五區熱食快餐店（2020出土最新發現）',
      angles: [
        {
          id: 'fastfood_1',
          title: '角度 1：彩繪公雞與陶罐熱食吧台（對齊櫃檯彩繪公雞圖畫）',
          past: 'img/pompeii/fastfood_1_past.jpg',
          present: 'img/pompeii/fastfood_1_present.jpg',
          isAR: false,
          lat: 40.7533,
          lng: 14.4878,
          descPast: '西元79年熱食快餐店：櫃檯正前方繪有鮮豔華麗的公雞、倒吊綠頭鴨與守護神靈，內嵌大陶罐盛裝熱騰騰的燉肉與美酒，招徠食客。',
          descPresent: '2026年今日現場：2020年最新發掘出土的第五區熱食店，櫃檯上彩繪公雞色澤依舊鮮豔欲滴，陶罐口與壁畫完美對齊，震驚考古界。'
        }
      ]
    },
    {
      id: 'thermopolium',
      name: '🍲 普拉西杜斯熱食小吃店（豐饒大道）',
      angles: [
        {
          id: 'thermopolium_1',
          title: '角度 1：L形大理石櫃檯與圓形陶罐口（櫃檯精準對齊）',
          past: 'img/pompeii/thermopolium_1_past.jpg',
          present: 'img/pompeii/thermopolium_1_present.jpg',
          isAR: false,
          lat: 40.74975,
          lng: 14.4901,
          descPast: '西元79年熟食吧台：L形大理石切片櫃檯內嵌陶罐滾著肉汁扁豆，後牆壁龕守護神壁畫色彩鮮麗，市民快餐談笑。',
          descPresent: '2026年今日現場：彩色大理石切片鑲嵌櫃檯與圓形陶罐口精準對齊，火山灰將羅馬市井生活氣息完整封存於昨天。'
        }
      ]
    },
    {
      id: 'street',
      name: '🚶 龐貝繁盛街道與市集',
      angles: [
        {
          id: 'step_1',
          title: '角度 1：商業大街斑馬線踩腳石（精準對齊過街踩腳石與車軌痕）',
          past: 'img/pompeii/step_1_past.jpg',
          present: 'img/pompeii/step_1_present.jpg',
          isAR: false,
          lat: 40.7495,
          lng: 14.4883,
          descPast: '西元79年街道日常：暴雨排洪時街道化作水流，市民踏著斑馬線大凸石從容過街，街邊兩側商鋪熱鬧喧囂，遠方維蘇威火山聳立。',
          descPresent: '2026年今日現場：玄武岩斑馬線踩腳石與深嵌地面的馬車輪軌痕跡精準對齊，完好封存兩千年前的城市智慧。'
        },
        {
          id: 'street_2',
          title: '角度 2：石板官道與斑馬線過街石（保留不用調整）',
          past: 'img/pompeii/street_2_past.jpg',
          present: 'img/pompeii/street_2_present.jpg',
          isAR: false,
          lat: 40.7495,
          lng: 14.4883,
          descPast: '西元79年石板大道：高凸的石塊供行人過街不沾泥水，車輪剛好從縫隙駛過，兩側牆面繪滿彩色灰泥壁畫。',
          descPresent: '2026年今日現場：數百年車輪碾出的深溝痕跡歷歷在目，高聳的古石牆在藍天白雲下靜穆佇立。'
        },
        {
          id: 'street_3',
          title: '角度 3：轉角浮雕公共噴泉水槽（精準對齊出水口人臉面具）',
          past: 'img/pompeii/street_3_past.jpg',
          present: 'img/pompeii/street_3_present.jpg',
          isAR: false,
          lat: 40.7495,
          lng: 14.4883,
          descPast: '西元79年街角水井：雕刻著人臉面具的大石水槽湧出清涼泉水，市民提壺汲水，騾車在石板路顛簸前行。',
          descPresent: '2026年今日現場：人臉浮雕出水口石槽精確對齊，石緣被兩千年前汲水者的手掌磨得圓潤光滑。'
        },
        {
          id: 'street_4',
          title: '角度 4：西元79年火山爆發時刻（轉角噴泉浩劫時刻）',
          past: 'img/pompeii/street_4_past.jpg',
          present: 'img/pompeii/street_4_present.jpg',
          isAR: false,
          lat: 40.7495,
          lng: 14.4883,
          descPast: '西元79年致命時刻：維蘇威火山猛烈噴發，黑色蕈狀浮石雨與火山灰蔽日遮天，街角噴泉水槽旁市民在恐慌中倉促撤離。',
          descPresent: '2026年今日現場：同一街角噴泉水槽沉睡兩千年後重見天日，陽光重新照亮石槽出水口與石板古道，宛如時空凝結。'
        }
      ]
    },
    {
      id: 'villa',
      name: '🏡 貴族豪宅噴泉水景中庭',
      angles: [
        {
          id: 'villa_1',
          title: '角度 1：水仙女壁龕與馬賽克彩繪（完美保留）',
          past: 'img/pompeii/villa_1_past.jpg',
          present: 'img/pompeii/villa_1_present.jpg',
          isAR: false,
          lat: 40.7508,
          lng: 14.4839,
          descPast: '西元79年貴族中庭：中央水池噴泉潺潺，後牆壁龕覆蓋極盡華麗的玻璃釉馬賽克海神壁畫，主人側臥品酒休憩。',
          descPresent: '2026年今日現場：兩千年前精美絕倫的馬賽克壁龕奇蹟般色彩斑斕如新，水池石基完整映照地中海天光。'
        }
      ]
    },
    {
      id: 'aerial',
      name: '🌋 圓形競技場與火山全景鳥瞰',
      angles: [
        {
          id: 'aerial_2',
          title: '角度 1：爆發噴發柱與今日全景對照（以圓形競技場對齊）',
          past: 'img/pompeii/aerial_2_past.jpg',
          present: 'img/pompeii/aerial_2_present.jpg',
          isAR: false,
          lat: 40.75125,
          lng: 14.4952,
          descPast: '西元79年災難鳥瞰：維蘇威火山主峰劇烈爆炸，數萬米高的巨大浮石灰柱衝入平流層，前方的圓形競技場與整座古城籠罩在浩劫陰影中。',
          descPresent: '2026年今日現場：以圓形競技場為基準點精準對齊，今日安寧廣袤的拿坡里平原與綠樹覆蓋的龐貝遺址，大自然的毀滅與永恆在此交織。'
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
          isAR: false,
          lat: 40.7497,
          lng: 14.4846,
          descPast: '西元79年榮譽拱門：廣場北端的磚石單孔拱門貼飾著精美大理石板與皇帝雕像，穿過拱門可抵達神廟與市集。',
          descPresent: '2026年今日現場：拱門頂部的裝飾雕塑雖已佚失，但古羅馬堅固的磚石砌拱券結構依然巍然屹立。'
        }
      ]
    },
    {
      id: 'ar_mask',
      name: '📸 AR 實景拍照遮罩（現場虛實疊加）',
      angles: [
        {
          id: 'ar_foro_1',
          title: 'AR 遮罩 1：北望朱比特神廟與火山（高清 AR 遮罩）',
          past: 'img/pompeii/ar_foro_1.jpg',
          present: null,
          isAR: true,
          lat: 40.74925,
          lng: 14.4844,
          descPast: '西元79年繁盛日常：長袍羅馬市民在長方形市政廣場穿梭，北端朱比特神廟高聳威嚴，兩側為長廊攤位，背景為壯麗維蘇威火山。',
          descPresent: '現場 AR 虛實疊加：朱比特神廟僅存高台與斷柱。開啟手機相機對準北端神廟遺跡與維蘇威火山，滑動下方「透明度滑桿」即可即時調整虛實疊加深度，拍下跨越時空的重疊合照！'
        },
        {
          id: 'ar_foro_2',
          title: 'AR 遮罩 2：凱旋柱與榮譽騎馬銅像高台（AR 實景遮罩）',
          past: 'img/pompeii/ar_foro_2.jpg',
          present: null,
          isAR: true,
          lat: 40.7494,
          lng: 14.4846,
          descPast: '西元79年市政心臟：廣場東北方佇立著榮譽騎馬銅像與高聳的大理石凱旋柱，背景是平緩綠意的大山與拱門廊柱。',
          descPresent: '現場 AR 虛實疊加：高大的大理石雕像高台已褪去青銅光芒。開啟相機對準高台石基與後方紅磚柱，調整透明度遮罩即時拍照。'
        },
        {
          id: 'ar_foro_4',
          title: 'AR 遮罩 3：柱廊商街大道透視（AR 實景遮罩）',
          past: 'img/pompeii/ar_foro_4.jpg',
          present: null,
          isAR: true,
          lat: 40.7496,
          lng: 14.4848,
          descPast: '西元79年柱廊商街：廣場外側石柱大道兩側店鋪林立，商賈市民熙來攘往，陽光透過修長廊柱投下整齊光影。',
          descPresent: '現場 AR 虛實疊加：柱廊石基沿著街道排列。開啟相機對準街道旁的修長石柱與商鋪基座，調整半透明遮罩即時拍照。'
        },
        {
          id: 'ar_thermo_bar',
          title: 'AR 遮罩 4：第五區熱食快餐吧台全景（AR.jpg）',
          past: 'img/pompeii/ar_thermo_bar.jpg',
          present: null,
          isAR: true,
          lat: 40.7533,
          lng: 14.4878,
          descPast: '西元79年熱食吧台全貌：鮮豔黃色壁畫櫃檯、嵌裝的大陶罐（Dolia）、牆邊吊掛的大蒜火腿與天花板粗獷木樑。',
          descPresent: '現場 AR 虛實疊加：在熱食店現場開啟相機對準 L 形吧台，微調透明度，親眼目睹懸掛火腿、熱氣騰騰的陶罐與木樑屋頂在眼前神奇重現！'
        },
        {
          id: 'ar_street_v',
          title: 'AR 遮罩 5：豐饒大道直式手機街景（AR.jpeg 直式 Mask）',
          past: 'img/pompeii/ar_street_v.jpg',
          present: null,
          isAR: true,
          lat: 40.7495,
          lng: 14.4883,
          descPast: '西元79年市井漫步：直式透視構圖，陽光傾瀉於玄武岩石板路，水果攤販、穿托加長袍的市民與遠方維蘇威火山。',
          descPresent: '現場 AR 虛實疊加：專為手機直式拍照設計！持握手機對準豐饒大道古道，遠方火山對齊背景，拉動透明度滑桿，感受市民穿梭身旁的虛實震撼。'
        },
        {
          id: 'ar_fountain',
          title: 'AR 遮罩 6：街角公共噴泉水槽與馬車古道（AR3.jpeg）',
          past: 'img/pompeii/ar_fountain.jpg',
          present: null,
          isAR: true,
          lat: 40.7495,
          lng: 14.4883,
          descPast: '西元79年街角水井：雕刻著人臉出水口的石水槽湧出清泉，市民汲水談笑，雙輪騾車正從石板路疾駛而過。',
          descPresent: '現場 AR 虛實疊加：站在街角噴泉遺址旁，對齊石槽人臉出水口，調整透明度遮罩，立刻重現流水潺潺與古代市民汲水的生動時光。'
        },
        {
          id: 'ar_forum_grand',
          title: 'AR 遮罩 7：公共論壇大廣場與軍團凱旋大道（ar4.jpg）',
          past: 'img/pompeii/ar_forum_grand.jpg',
          present: null,
          isAR: true,
          lat: 40.7492,
          lng: 14.4845,
          descPast: '西元79年帝國雄風：大理石神殿（農神殿/朱比特殿）環繞，身披鐵甲手持長矛盾牌的羅馬軍團士兵列隊行進。',
          descPresent: '現場 AR 虛實疊加：站在市政論壇廣場中央，將羅馬士兵與高聳大理石山牆透過半透明遮罩覆蓋在眼前殘垣上，拍出大片感十足的時空穿越照！'
        },
        {
          id: 'ar_street_litter',
          title: 'AR 遮罩 8：繁盛商街與貴婦抬轎市集（ar5.jpg）',
          past: 'img/pompeii/ar_street_litter.jpg',
          present: null,
          isAR: true,
          lat: 40.7496,
          lng: 14.4880,
          descPast: '西元79年奢華貴族生活：奴隸抬著金色頂篷轎子載著羅馬貴婦巡視商街，兩側蔬菜攤位琳瑯滿目，右側為典雅柱廊。',
          descPresent: '現場 AR 虛實疊加：對準商業街道與石柱，透過透明度調節將抬轎隊伍與熱鬧市集疊合於今日古道，虛實交融。'
        }
      ]
    }
  ];

  /**
   * 載入指定視角（實景照片、AR 遮罩或畫布）
   */
  function loadAngle(angle, imgBefore, imgAfter, onReady) {
    if (angle.isAR || !angle.present) {
      // AR 實景模式：載入古代背景圖作為遮罩
      imgBefore.onload = () => {
        if (onReady) onReady();
      };
      imgBefore.onerror = () => {
        if (onReady) onReady();
      };
      imgBefore.src = angle.past;
      if (imgAfter) {
        imgAfter.removeAttribute('src');
      }
    } else {
      let loaded = 0;
      const check = () => {
        loaded++;
        if (loaded >= 2 && onReady) onReady();
      };
      imgBefore.onload = check;
      imgBefore.onerror = check;
      if (imgAfter) {
        imgAfter.onload = check;
        imgAfter.onerror = check;
        imgAfter.src = angle.present;
      }
      imgBefore.src = angle.past;
    }
  }

  global.POMPEII_ART = {
    locations: POMPEII_LOCATIONS,
    loadAngle: loadAngle
  };
})(typeof window !== 'undefined' ? window : global);