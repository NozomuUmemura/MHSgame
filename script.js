/* =====================================================
   バスケがしたいです / MHS Catapult Challenge
   - 投石器で黄/緑ボールをゴールに入れる
   - プレイヤーは「4班」、CPU 7班と競う
   - 動くゴール / 風 / 緑球 / バンク / M-H-S
   - 結果は UME のダイアログ
   ===================================================== */

(() => {
  'use strict';

  // ===== Canvas =====
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width;
  const H = canvas.height;

  // ===== オーディオ =====
  const AudioManager = (() => {
    let ctx = null;
    let bgmPlaying = null;
    let bgmTimeout = null;
    let fileBgmEl = null;

    function init() {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume();
        return;
      }
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }

    function tone(freq, type, vol, startOffset, dur) {
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = type;
      const t = ctx.currentTime + startOffset;
      if (Array.isArray(freq)) {
        o.frequency.setValueAtTime(freq[0], t);
        o.frequency.exponentialRampToValueAtTime(freq[1], t + dur);
      } else {
        o.frequency.value = freq;
      }
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.01);
    }

    const SFX_MAP = {
      select:  () => tone(600, 'square', 0.3, 0, 0.05),
      start:   () => { tone(440, 'square', 0.25, 0, 0.15); tone(660, 'square', 0.25, 0.12, 0.2); },
      fire:    () => tone([300, 80], 'sawtooth', 0.3, 0, 0.2),
      hit:     () => tone(120, 'sine', 0.4, 0, 0.15),
      miss:    () => tone([400, 150], 'triangle', 0.25, 0, 0.4),
      swish:   () => tone(880, 'sine', 0.3, 0, 0.3),
      bank:    () => tone(220, 'square', 0.25, 0, 0.12),
      green:   () => { tone(523, 'sine', 0.25, 0, 0.2); tone(784, 'sine', 0.25, 0.08, 0.2); },
      super:   () => { tone(523, 'sine', 0.3, 0, 0.2); tone(659, 'sine', 0.3, 0.1, 0.2); tone(784, 'sine', 0.3, 0.2, 0.25); },
      result:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 'sine', 0.25, i * 0.12, 0.15)),
      talk:    () => tone(400 + Math.random() * 200, 'square', 0.08, 0, 0.02),
    };

    const BGM_SEQUENCES = {
      title: {
        notes: [
          [261,'square',0.10, 0.0, 0.4], [329,'square',0.08, 0.5, 0.4],
          [392,'square',0.08, 1.0, 0.4], [329,'square',0.08, 1.5, 0.4],
          [261,'square',0.10, 2.0, 0.4], [293,'square',0.08, 2.5, 0.4],
          [329,'square',0.08, 3.0, 0.8],
        ],
        loopMs: 4000,
      },
      game: {
        notes: [
          [392,'square',0.10, 0.00, 0.18], [392,'square',0.08, 0.25, 0.18],
          [440,'square',0.10, 0.50, 0.18], [392,'square',0.08, 0.75, 0.18],
          [349,'square',0.10, 1.00, 0.35], [329,'square',0.08, 1.50, 0.35],
          [392,'square',0.10, 2.00, 0.18], [392,'square',0.08, 2.25, 0.18],
          [440,'square',0.10, 2.50, 0.18], [494,'square',0.08, 2.75, 0.18],
          [523,'square',0.12, 3.00, 0.70],
        ],
        loopMs: 4000,
      },
      result_good: {
        notes: [
          [523,'sine',0.12, 0.0, 0.18], [659,'sine',0.12, 0.2, 0.18],
          [784,'sine',0.12, 0.4, 0.18], [1047,'sine',0.12, 0.6, 0.35],
          [784,'sine',0.10, 1.1, 0.18], [659,'sine',0.10, 1.3, 0.55],
        ],
        loopMs: 2000,
      },
      result_bad: {
        notes: [
          [392,'triangle',0.10, 0.0, 0.38],
          [349,'triangle',0.10, 0.5, 0.38],
          [329,'triangle',0.10, 1.0, 0.75],
        ],
        loopMs: 2000,
      },
      dodge: {
        notes: [
          [440,'square',0.12, 0.00, 0.10], [440,'square',0.10, 0.13, 0.10],
          [494,'square',0.12, 0.25, 0.10], [440,'square',0.10, 0.38, 0.10],
          [392,'square',0.12, 0.50, 0.10], [392,'square',0.10, 0.63, 0.10],
          [349,'square',0.12, 0.75, 0.20],
          [440,'square',0.12, 1.00, 0.10], [440,'square',0.10, 1.13, 0.10],
          [494,'square',0.12, 1.25, 0.10], [523,'square',0.10, 1.38, 0.10],
          [587,'square',0.14, 1.50, 0.30],
          [523,'square',0.12, 2.00, 0.10], [494,'square',0.10, 2.13, 0.10],
          [440,'square',0.12, 2.25, 0.10], [392,'square',0.10, 2.38, 0.10],
          [349,'square',0.12, 2.50, 0.30],
          [392,'square',0.10, 3.00, 0.10], [440,'square',0.12, 3.25, 0.10],
          [494,'square',0.10, 3.50, 0.10], [440,'square',0.12, 3.75, 0.10],
        ],
        loopMs: 4000,
      },
    };

    function scheduleBgm(name) {
      if (bgmPlaying !== name || !ctx) return;
      const seq = BGM_SEQUENCES[name];
      seq.notes.forEach(([f, type, vol, offset, dur]) => tone(f, type, vol, offset, dur));
      bgmTimeout = setTimeout(() => scheduleBgm(name), seq.loopMs - 50);
    }

    return {
      init,
      play(name) {
        init();
        const fn = SFX_MAP[name];
        if (fn) fn();
      },
      playBgm(name) {
        init();
        this.stopBgm();
        bgmPlaying = name;
        scheduleBgm(name);
      },
      playFileBgm(src, vol) {
        this.stopBgm();
        try {
          if (!fileBgmEl) {
            fileBgmEl = new Audio();
            fileBgmEl.loop = true;
          }
          if (fileBgmEl.src.indexOf(src) === -1) fileBgmEl.src = src;
          fileBgmEl.volume = (vol == null ? 0.55 : vol);
          fileBgmEl.currentTime = 0;
          const p = fileBgmEl.play();
          if (p && p.catch) p.catch(() => {}); // autoplay失敗は黙殺
        } catch (e) {}
      },
      stopBgm() {
        bgmPlaying = null;
        if (bgmTimeout) { clearTimeout(bgmTimeout); bgmTimeout = null; }
        if (fileBgmEl) { try { fileBgmEl.pause(); } catch (e) {} }
      },
    };
  })();

  // ===== ストレージ =====
  const Storage = (() => {
    const KEY_SCORE = 'mhsc_best_score';
    const KEY_RANK  = 'mhsc_best_rank';
    return {
      load() {
        return {
          bestScore: parseInt(localStorage.getItem(KEY_SCORE) || '0', 10),
          bestRank:  parseInt(localStorage.getItem(KEY_RANK)  || '9', 10),
        };
      },
      save(score, rank) {
        const cur = this.load();
        if (score > cur.bestScore) localStorage.setItem(KEY_SCORE, String(score));
        if (rank  < cur.bestRank)  localStorage.setItem(KEY_RANK,  String(rank));
      },
      isNewRecord(score, rank) {
        const cur = this.load();
        return score > cur.bestScore || rank < cur.bestRank;
      },
    };
  })();

  function updateBestScoreDisplay() {
    const el = document.getElementById('best-score-display');
    if (!el) return;
    const { bestScore, bestRank } = Storage.load();
    if (bestScore === 0) { el.textContent = '- - -'; return; }
    const suf = bestRank === 1 ? 'ST' : bestRank === 2 ? 'ND' : bestRank === 3 ? 'RD' : 'TH';
    el.textContent = `BEST  ${bestScore} pt  /  ${bestRank}${suf} PLACE`;
  }

  function updateDodgeButtonVisibility() {
    const el = document.getElementById('btn-dodge');
    if (el) el.style.display = localStorage.getItem('mhsc_unlocked') === '1' ? 'inline-block' : 'none';
  }

  // ===== 画面 =====
  const STATE = { TITLE:'title', GAME:'game', RESULT:'result', DODGE:'dodge', DODGE_RESULT:'dodge_result' };
  let currentState = STATE.TITLE;

  // ===== ショット進行 =====
  const PHASE = { AIM:'aim', FLY:'fly', SETTLE:'settle', OVER:'over' };
  let phase = PHASE.AIM;
  let settleTimer = null;
  function clearSettleTimer() {
    if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
  }

  // ===== プレイヤー =====
  const player = {
    teamId: 4,
    angleDeg: 45,
    power: 50,
    focus: null,
    shot: 0,
    score: 0,
    streak: 0,
    ballColor: 'yellow',
  };

  // ===== CPU 進行 =====
  let cpuProgressions = [];

  // ===== 物理 =====
  const LAUNCHER = { x: 110, y: 380 };
  const GRAVITY  = 0.45;
  let lastFireTime = -9999; // 発射リコイル演出の基準時刻

  // ===== コート =====
  const COURT = {
    floorY: 430,
    poleX: 670,
    rimY: 230,
    rimLeft: 615,
    rimRight: 685,
    zone:     { x1: 620, x2: 680, y1: 228, y2: 270 },
    bullseye: { x1: 642, x2: 658, y1: 232, y2: 260 },
  };
  let goalOffsetX = 0;
  const MOVE_START_SHOT = 5; // index>=5 (6投目から)

  // ===== ボール =====
  let activeBall = null;
  const BALL_R = 9;
  let trail = [];

  // ===== エフェクト =====
  let particles = [];
  let flashAlpha = 0;
  let flashColor = '255,255,255';

  // ===== 画面シェイク + ヒットストップ =====
  let shakeFrames = 0;
  let shakeMag    = 0;
  let hitstopMs   = 0;
  let hitstopUntil = 0;
  function triggerShake(frames, mag) {
    shakeFrames = Math.max(shakeFrames, frames);
    shakeMag    = Math.max(shakeMag, mag);
  }
  function triggerHitstop(ms) {
    hitstopMs = Math.max(hitstopMs, ms);
    hitstopUntil = performance.now() + hitstopMs;
  }
  function inHitstop() { return performance.now() < hitstopUntil; }
  function getShakeOffset() {
    if (shakeFrames <= 0) return { x: 0, y: 0 };
    const m = shakeMag;
    return { x: (Math.random() - 0.5) * 2 * m, y: (Math.random() - 0.5) * 2 * m };
  }
  function decayShake() {
    if (shakeFrames > 0) {
      shakeFrames--;
      if (shakeFrames === 0) shakeMag = 0;
    }
  }

  // 風で流れる粒子 (背景演出)
  let windParticles = [];

  function spawnSparkle(x, y, color, count = 14) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 1,
        life: 30 + Math.random() * 22,
        color, size: 1 + Math.floor(Math.random() * 2),
      });
    }
  }

  // ===== 特殊イベント =====
  const EVENTS = [
    { id: 'GUST',        kind: 'pinch', label: 'EVENT: GUST!',        msgKind: 'warn'  },
    { id: 'NARROW',      kind: 'pinch', label: 'EVENT: NARROW RIM!',  msgKind: 'warn'  },
    { id: 'FAST',        kind: 'pinch', label: 'EVENT: SPEED UP!',    msgKind: 'warn'  },
    { id: 'DOUBLE',      kind: 'bonus', label: 'EVENT: 2x ZONE!',     msgKind: 'bonus' },
    { id: 'SLOW_WIND',   kind: 'bonus', label: 'EVENT: CALM!',        msgKind: 'bonus' },
    { id: 'BONUS_GREEN', kind: 'bonus', label: 'EVENT: BONUS BALL!',  msgKind: 'bonus' },
  ];
  let currentEvent = null;
  let eventCountThisGame = 0;

  function trySpawnEvent() {
    const shotNum = player.shot + 1; // 1-based (1〜10)
    if (shotNum < 2 || shotNum > 9) return;
    if (eventCountThisGame >= 3) return;
    const isGreen = player.ballColor === 'green';
    if (Math.random() > (isGreen ? 0.15 : 0.35)) return;

    // FAST はゴールが動き始める shot 6 以降のみ、BONUS_GREEN は既に緑球でない場合のみ
    const available = EVENTS.filter(e => {
      if (e.id === 'FAST' && shotNum < 6) return false;
      if (e.id === 'BONUS_GREEN' && player.ballColor === 'green') return false;
      return true;
    });
    currentEvent = available[Math.floor(Math.random() * available.length)];
    eventCountThisGame++;

    if (currentEvent.id === 'BONUS_GREEN') player.ballColor = 'green';

    // 既存のショット告知メッセージの後に表示
    setTimeout(() => {
      if (currentEvent) showMsg(currentEvent.label, currentEvent.msgKind, 1600);
    }, 150);
  }

  // ===== 風 =====
  // 1投ごとに方向と強さを決め、その投球中は一定
  // accel: 毎フレームの vx 加速度
  const WIND_TABLE = [
    null,
    { mag: 0.008, label: 1 }, // light
    { mag: 0.016, label: 2 }, // medium
    { mag: 0.026, label: 3 }, // strong
  ];
  let currentWind = null; // {level, dir, accel, displayValue}

  function generateWind() {
    const r = Math.random();
    const level = (r < 0.50) ? 1 : (r < 0.85) ? 2 : 3;
    const dir = Math.random() < 0.5 ? -1 : 1;
    const mag = WIND_TABLE[level].mag;
    return {
      level, dir,
      accel: dir * mag,
      // 表示用: 風の大きさを倍率表示 (細かい値はH焦点で出す)
      displayValue: (mag * 100).toFixed(1),
    };
  }

  // 風の有効加速度 (Focusで補正)
  function effectiveWindAccel() {
    if (!currentWind) return 0;
    const f = 1.0;
    let evMul = 1.0;
    if (currentEvent) {
      if (currentEvent.id === 'GUST')      evMul = 2.0;
      if (currentEvent.id === 'SLOW_WIND') evMul = 0.3;
    }
    return currentWind.accel * f * evMul;
  }

  // ===== メッセージ =====
  const msgWindow = document.getElementById('msg-window');
  const msgText   = document.getElementById('msg-text');
  let msgTimeout  = null;
  function showMsg(text, kind = 'default', duration = 1300) {
    msgText.textContent = text;
    msgWindow.classList.remove('hidden','bonus','score','miss','super','warn');
    if (['bonus','score','miss','super','warn'].includes(kind)) {
      msgWindow.classList.add(kind);
    }
    if (msgTimeout) clearTimeout(msgTimeout);
    if (duration > 0) {
      msgTimeout = setTimeout(() => msgWindow.classList.add('hidden'), duration);
    }
  }

  // ===== 画面切替 =====
  function switchScreen(state) {
    currentState = state;
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    if (state === STATE.TITLE) { updateBestScoreDisplay(); updateDodgeButtonVisibility(); }
    if      (state === STATE.TITLE)        AudioManager.playBgm('title');
    else if (state === STATE.GAME)         AudioManager.playBgm('game');
    else if (state === STATE.DODGE)        AudioManager.playFileBgm('tenshi.m4a', 0.5);
    else if (state === STATE.DODGE_RESULT) { /* BGM は showDodgeResult() で管理 */ }
    const map = {
      [STATE.TITLE]:        'screen-title',
      [STATE.GAME]:         'screen-game',
      [STATE.RESULT]:       'screen-result',
      [STATE.DODGE]:        'screen-dodge',
      [STATE.DODGE_RESULT]: 'screen-dodge-result',
    };
    document.getElementById(map[state]).classList.add('active');
  }

  // ===== タイトル → ゲーム =====
  let storyMode = false;
  document.getElementById('btn-story').addEventListener('click', () => {
    AudioManager.init();
    AudioManager.play('start');
    storyMode = true;
    startGame();
  });
  document.getElementById('btn-free').addEventListener('click', () => {
    AudioManager.init();
    AudioManager.play('start');
    storyMode = false;
    startGame();
  });

  // ===== Focus 別性能 =====
  function getFocusStats() {
    // MHS撤去: 安定＆精密プロファイルに固定（旧H相当）
    return {
      powerMul:     0.22,
      jitterAng:    0.5,
      jitterPwr:    0.7,
      guideSteps:   14,
      bounceRetain: 0.40,
      bankBonus:    1.2,
      predictGoal:  false,
      stabilizeGreen: true,
      windFactor:   1.0,
      windDisplayPrecise: true,
      guideUsesWind: true,
    };
  }

  // ===== ゲーム開始 =====
  function startGame() {
    clearSettleTimer();
    resetDialogue();
    player.shot   = 0;
    player.score  = 0;
    player.streak = 0;
    player.angleDeg = 45;
    player.power = 50;
    player.ballColor = 'yellow';
    activeBall = null;
    trail = [];
    particles = [];
    windParticles = [];
    flashAlpha = 0;
    goalOffsetX = 0;
    phase = PHASE.AIM;
    currentEvent = null;
    eventCountThisGame = 0;

    cpuProgressions = generateCpuProgressions();

    document.getElementById('rank-info').classList.add('hidden');

    setupShot();
    updateHUD();
    switchScreen(STATE.GAME);
    showMsg('TEAM 4 - LET\'S GO!', 'score', 1400);
  }

  function generateCpuProgressions() {
    const ranges = [
      [180, 260], [150, 230], [120, 200], [85, 150],
      [60, 130],  [40, 110],  [20, 90],
    ];
    const shuffled = [...ranges].sort(() => Math.random() - 0.5);
    const ids = [1, 2, 3, 5, 6, 7, 8];
    const progs = [];
    shuffled.forEach(([lo, hi], i) => {
      const target = Math.floor(lo + Math.random() * (hi - lo + 1));
      const weights = [];
      for (let j = 0; j < 10; j++) {
        weights.push(Math.random() < 0.30 ? 0 : Math.random() * 0.8 + 0.2);
      }
      const sum = weights.reduce((a,b)=>a+b, 0) || 1;
      const perShot = weights.map(w => Math.round(target * w / sum));
      const actual = perShot.reduce((a,b)=>a+b, 0);
      perShot[9] = Math.max(0, perShot[9] + (target - actual));
      progs.push({ teamId: ids[i], perShot, cumulative: 0 });
    });
    return progs;
  }

  function advanceCpuShot(shotIndex) {
    for (const c of cpuProgressions) c.cumulative += c.perShot[shotIndex];
  }

  function getCurrentRanking() {
    const all = [];
    all.push({ id: 4, score: player.score, isPlayer: true });
    for (const c of cpuProgressions) all.push({ id: c.teamId, score: c.cumulative, isPlayer: false });
    all.sort((a,b) => b.score - a.score);
    return all;
  }

  // ===== ショット準備 =====
  function setupShot() {
    const nextNum = player.shot + 1;
    player.ballColor = (nextNum === 3 || nextNum === 6 || nextNum === 9) ? 'green' : 'yellow';

    // 風は毎投で新規生成
    currentWind = generateWind();

    if (phase === PHASE.AIM) {
      if (nextNum === MOVE_START_SHOT + 1) {
        showMsg('GOAL STARTS MOVING!', 'warn', 1700);
      } else if (player.ballColor === 'green') {
        showMsg('GREEN BALL - HIGH RISK / HIGH REWARD', 'bonus', 1500);
        AudioManager.play('green');
      } else if (nextNum === 10) {
        showMsg('FINAL SHOT!', 'super', 1400);
      }
    }
    currentEvent = null;
    trySpawnEvent();
  }

  // ===== 発射 =====
  function fire() {
    if (currentState !== STATE.GAME) return;
    if (phase !== PHASE.AIM) return;
    if (player.shot >= 10) return;

    const stats = getFocusStats();
    let jitterAng = stats.jitterAng;
    let jitterPwr = stats.jitterPwr;
    if (stats.stabilizeGreen && player.ballColor === 'green') {
      jitterAng *= 0.4;
      jitterPwr *= 0.4;
    }

    const ang = (player.angleDeg + (Math.random() * 2 - 1) * jitterAng) * Math.PI / 180;
    const pwr = Math.max(5, player.power + (Math.random() * 2 - 1) * jitterPwr);
    const speed = pwr * stats.powerMul;

    activeBall = {
      x: LAUNCHER.x,
      y: LAUNCHER.y,
      vx:  Math.cos(ang) * speed,
      vy: -Math.sin(ang) * speed,
      color: player.ballColor,
      alive: true,
      scored: false,
      bullseye: false,
      bounces: 0,
      // 風の方向を記録 (得点時に「逆風」判定に使う)
      shotDirX: 1,                 // 投げる方向は常に右
      windDirAtFire: currentWind ? currentWind.dir : 0,
      windLevelAtFire: currentWind ? currentWind.level : 0,
    };
    trail = [];
    phase = PHASE.FLY;
    lastFireTime = performance.now();
    AudioManager.play('fire');
  }

  // ===== HUD =====
  function getWindDisplay() {
    if (!currentWind) return '-';
    const dirChar = currentWind.dir > 0 ? '>' : '<';
    const arrowStr = dirChar.repeat(currentWind.level);
    const stats = getFocusStats();
    if (stats.windDisplayPrecise) {
      return `${arrowStr} ${currentWind.displayValue}`;
    }
    return arrowStr;
  }

  function updateHUD() {
    document.getElementById('hud-shot').textContent  = Math.min(player.shot + 1, 10);
    document.getElementById('hud-score').textContent = player.score;
    document.getElementById('hud-angle').textContent = player.angleDeg.toFixed(0);
    document.getElementById('hud-power').textContent = player.power.toFixed(0);
    document.getElementById('hud-streak').textContent = getStreakMul().toFixed(1);
    const ballEl = document.getElementById('hud-ball');
    ballEl.textContent = player.ballColor === 'green' ? 'GREEN' : 'YELLOW';
    ballEl.style.color = player.ballColor === 'green' ? '#7CFC00' : '#FFEB3B';
    document.getElementById('hud-wind').textContent = getWindDisplay();
    updateRankInfo();
  }

  function getStreakMul() {
    if (player.streak <= 1) return 1.0;
    return Math.min(2.0, 1.0 + 0.25 * (player.streak - 1));
  }

  // ===== 入力 =====
  const keysHeld = {};
  window.addEventListener('keydown', e => {
    AudioManager.init();
    // タイトル
    if (currentState === STATE.TITLE) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!e.repeat) {
          AudioManager.play('start');
          storyMode = false;
          startGame();
        }
      }
      return;
    }
    // 結果(会話シーン)
    if (currentState === STATE.RESULT && dialogue.active) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!e.repeat) advanceDialogue();
      }
      return;
    }
    if (currentState === STATE.DODGE) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!e.repeat) dodgeConfirmPress();
      } else if (DODGE.battlePhase === 'player' && DODGE.menu.mode === 'menu' &&
                 (e.code === 'ArrowLeft' || e.code === 'KeyA')) {
        e.preventDefault();
        if (!e.repeat) dodgeMoveMenu(-1);
      } else if (DODGE.battlePhase === 'player' && DODGE.menu.mode === 'menu' &&
                 (e.code === 'ArrowRight' || e.code === 'KeyD')) {
        e.preventDefault();
        if (!e.repeat) dodgeMoveMenu(+1);
      } else {
        keysHeld[e.code] = true;
      }
      return;
    }
    if (currentState !== STATE.GAME) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) fire();
      return;
    }
    keysHeld[e.code] = true;
  });
  window.addEventListener('keyup', e => { keysHeld[e.code] = false; });

  function bindHold(id, fn) {
    const el = document.getElementById(id);
    let timer = null;
    let started = false;
    const start = ev => {
      ev.preventDefault();
      if (started) return;
      started = true;
      fn();
      timer = setInterval(fn, 70);
    };
    const stop = ev => {
      if (ev) ev.preventDefault();
      started = false;
      if (timer) { clearInterval(timer); timer = null; }
    };
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive:false });
    el.addEventListener('mouseup', stop);
    el.addEventListener('mouseleave', stop);
    el.addEventListener('touchend', stop);
    el.addEventListener('touchcancel', stop);
    el.addEventListener('click', ev => ev.preventDefault());
  }
  bindHold('btn-angle-down', () => adjustAngle(-1));
  bindHold('btn-angle-up',   () => adjustAngle(+1));
  bindHold('btn-power-down', () => adjustPower(-1));
  bindHold('btn-power-up',   () => adjustPower(+1));

  const btnFire = document.getElementById('btn-fire');
  let fireLatch = false;
  function firePress(ev) {
    if (ev) ev.preventDefault();
    if (fireLatch) return;
    fireLatch = true;
    fire();
    setTimeout(() => { fireLatch = false; }, 150);
  }
  btnFire.addEventListener('touchstart', firePress, { passive:false });
  btnFire.addEventListener('mousedown', firePress);
  btnFire.addEventListener('click', ev => ev.preventDefault());

  function adjustAngle(d) {
    if (currentState !== STATE.GAME || phase !== PHASE.AIM) return;
    player.angleDeg = Math.max(5, Math.min(85, player.angleDeg + d));
    updateHUD();
  }
  function adjustPower(d) {
    if (currentState !== STATE.GAME || phase !== PHASE.AIM) return;
    player.power = Math.max(10, Math.min(100, player.power + d));
    updateHUD();
  }

  // ===== ゴール動作 =====
  function getMoveAmplitude(shotIndex) {
    if (shotIndex < MOVE_START_SHOT) return 0;
    const phaseShot = shotIndex - MOVE_START_SHOT;
    return 18 + phaseShot * 8;
  }
  function getMoveFreq(shotIndex) {
    if (shotIndex < MOVE_START_SHOT) return 0;
    const phaseShot = shotIndex - MOVE_START_SHOT;
    const base = 0.0009 + phaseShot * 0.00018;
    const fastMul = (currentEvent && currentEvent.id === 'FAST') ? 1.8 : 1.0;
    return base * fastMul;
  }
  function computeGoalOffset(timeMs, shotIndex) {
    const amp = getMoveAmplitude(shotIndex);
    if (amp <= 0) return 0;
    return Math.sin(timeMs * getMoveFreq(shotIndex)) * amp;
  }
  function isGoalMoving() { return getMoveAmplitude(player.shot) > 0; }

  function updateGoal() {
    goalOffsetX = computeGoalOffset(performance.now(), player.shot);
  }

  function goalRect() {
    const dx = goalOffsetX;
    let zx1 = COURT.zone.x1 + dx;
    let zx2 = COURT.zone.x2 + dx;
    if (currentEvent && currentEvent.id === 'NARROW') {
      const center = (zx1 + zx2) / 2;
      const half   = (zx2 - zx1) * 0.6 / 2;
      zx1 = center - half;
      zx2 = center + half;
    }
    return {
      dx,
      poleX:    COURT.poleX    + dx,
      rimLeft:  COURT.rimLeft  + dx,
      rimRight: COURT.rimRight + dx,
      rimY:     COURT.rimY,
      zone: {
        x1: zx1, x2: zx2,
        y1: COURT.zone.y1, y2: COURT.zone.y2,
      },
      bullseye: {
        x1: COURT.bullseye.x1 + dx, x2: COURT.bullseye.x2 + dx,
        y1: COURT.bullseye.y1,       y2: COURT.bullseye.y2,
      },
    };
  }

  // ===== メインループ =====
  // 通常は requestAnimationFrame で 60fps。
  // タブが非アクティブで rAF が止まる場合に備え setInterval フォールバックも併用し、
  // どちらでも 1フレーム/16ms 周期になるように `loopLastT` で重複実行を抑止する。
  let loopLastT = 0;
  function loopOnce() {
    const now = performance.now();
    if (now - loopLastT < 12) return; // 二重発火ガード
    loopLastT = now;
    update();
    render();
  }
  function loopRaf() {
    loopOnce();
    requestAnimationFrame(loopRaf);
  }

  function update() {
    if (inHitstop()) return;
    decayShake();
    if (currentState === STATE.DODGE) { updateDodge(); return; }
    if (currentState !== STATE.GAME) return;
    updateGoal();
    updateWindParticles();

    if (phase === PHASE.AIM) {
      if (keysHeld['ArrowLeft']  || keysHeld['KeyA']) adjustAngle(-0.8);
      if (keysHeld['ArrowRight'] || keysHeld['KeyD']) adjustAngle(+0.8);
      if (keysHeld['ArrowUp']    || keysHeld['KeyW']) adjustPower(+0.8);
      if (keysHeld['ArrowDown']  || keysHeld['KeyS']) adjustPower(-0.8);
    }

    if (phase === PHASE.FLY && activeBall && activeBall.alive) {
      trail.push({ x: activeBall.x, y: activeBall.y, color: activeBall.color });
      if (trail.length > 90) trail.shift();

      // 重力 + 風
      activeBall.vy += GRAVITY;
      activeBall.vx += effectiveWindAccel();
      activeBall.x  += activeBall.vx;
      activeBall.y  += activeBall.vy;

      const goal  = goalRect();
      const stats = getFocusStats();

      if (!activeBall.scored && activeBall.vy > 0) {
        const z = goal.zone, be = goal.bullseye;
        if (activeBall.x >= z.x1 && activeBall.x <= z.x2 &&
            activeBall.y >= z.y1 && activeBall.y <= z.y2) {
          activeBall.scored = true;
          activeBall.bullseye = (activeBall.x >= be.x1 && activeBall.x <= be.x2);
          onScored();
        }
      }

      const backboardLeft = goal.poleX - 2;
      if (activeBall.x + BALL_R >= backboardLeft &&
          activeBall.x < goal.poleX + 8 &&
          activeBall.y >= 175 && activeBall.y <= 250 &&
          activeBall.vx > 0) {
        activeBall.vx *= -stats.bounceRetain;
        activeBall.vy *= 0.75;
        activeBall.x   = backboardLeft - BALL_R;
        activeBall.bounces++;
      }

      const onFloor     = activeBall.y + BALL_R >= COURT.floorY;
      const outOfBounds = activeBall.x > W + 30 || activeBall.x < -30 || activeBall.y > H + 30;
      if (onFloor || outOfBounds) {
        activeBall.alive = false;
        onBallSettled();
      }
    }

    for (const p of particles) {
      p.vy += 0.2; p.x += p.vx; p.y += p.vy; p.life--;
    }
    particles = particles.filter(p => p.life > 0);

    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.04);
  }

  // ===== 風パーティクル =====
  function updateWindParticles() {
    if (currentWind && phase === PHASE.AIM) {
      // 風の強さに応じてスポーン頻度UP
      if (Math.random() < 0.04 * currentWind.level) {
        spawnWindParticle();
      }
    }
    for (const p of windParticles) {
      p.x += p.vx;
      p.life--;
    }
    windParticles = windParticles.filter(p =>
      p.life > 0 && p.x > -20 && p.x < W + 20
    );
  }
  function spawnWindParticle() {
    const dir = currentWind.dir;
    const speed = 1.2 + currentWind.level * 1.1;
    windParticles.push({
      x: dir > 0 ? -8 : W + 8,
      y: 60 + Math.random() * 260,
      vx: dir * speed,
      life: 300,
      len: 4 + currentWind.level,
    });
  }

  // ===== 得点処理 =====
  function onScored() {
    const isGreen = activeBall.color === 'green';
    const isBull  = activeBall.bullseye;
    const isBank  = activeBall.bounces > 0;
    const stats   = getFocusStats();
    // 逆風判定: 投球は右向き、風が左向き(dir=-1) かつ levelが2以上
    const isAgainstWind = (activeBall.windDirAtFire < 0 && activeBall.windLevelAtFire >= 2);

    let base;
    if (isGreen) base = isBull ? 80 : 25;
    else         base = isBull ? 25 : 10;

    const bankMul = isBank ? stats.bankBonus : 1.0;

    player.streak += 1;
    const streakMul = getStreakMul();

    const doubleMul = (currentEvent && currentEvent.id === 'DOUBLE') ? 2 : 1;
    const gained = Math.round(base * bankMul * streakMul * doubleMul);
    player.score += gained;

    let head, kind, sfxName;
    if (isGreen && isBull && isBank) {
      head = 'SUPER PLAY!!'; kind = 'super'; sfxName = 'super';
    } else if (isGreen && isBull) {
      head = 'GREEN SWISH!!'; kind = 'super'; sfxName = 'green';
    } else if (isGreen && isBank) {
      head = 'GREEN BANK!';  kind = 'bonus'; sfxName = 'bank';
    } else if (isGreen) {
      head = 'GREEN IN';     kind = 'bonus'; sfxName = 'green';
    } else if (isBull && isBank) {
      head = 'BANK SWISH!';  kind = 'super'; sfxName = 'bank';
    } else if (isBull) {
      head = 'SWISH!';       kind = 'score'; sfxName = 'swish';
    } else if (isBank) {
      head = 'BANK SHOT!';   kind = 'bonus'; sfxName = 'bank';
    } else {
      head = 'NICE!';        kind = 'score'; sfxName = 'hit';
    }
    const prefix = isAgainstWind ? 'AGAINST WIND! ' : '';
    const sx = streakMul > 1.0 ? ` x${streakMul.toFixed(2)}` : '';
    showMsg(`${prefix}${head} +${gained}${sx}`, kind, 1500);
    AudioManager.play(sfxName);

    const g = goalRect();
    const cx = (g.zone.x1 + g.zone.x2) / 2;
    const cy = (g.zone.y1 + g.zone.y2) / 2;
    spawnSparkle(cx, cy, isGreen ? '#7CFC00' : (isBank ? '#ff9800' : '#FFEB3B'),
                 isGreen ? 26 : (isBank ? 20 : 14));
    if (isGreen && isBull) {
      flashAlpha = 0.6; flashColor = '255,235,59';
      spawnSparkle(cx, cy - 8, '#fff', 14);
      triggerShake(14, 8);
      triggerHitstop(110);
    } else if (isGreen) {
      flashAlpha = 0.3; flashColor = '124,252,0';
      triggerShake(8, 4);
    } else if (isBank) {
      flashAlpha = 0.25; flashColor = '255,152,0';
      triggerShake(6, 3);
    } else {
      triggerShake(4, 2);
    }
    if (isAgainstWind) {
      flashAlpha = Math.max(flashAlpha, 0.18);
      flashColor = '79,195,247'; // 青系
    }
    updateHUD();
  }

  function onBallSettled() {
    if (phase !== PHASE.FLY) return;

    if (!activeBall.scored) {
      const wasGreen = activeBall.color === 'green';
      const wasStreak = player.streak;
      player.streak = 0;
      if (wasGreen) {
        showMsg(wasStreak >= 2 ? 'GREEN MISS... STREAK LOST' : 'GREEN MISS...',
                'miss', 1300);
      } else {
        showMsg('MISS...', 'miss', 1000);
      }
      AudioManager.play('miss');
    }

    const justFinishedIdx = player.shot;
    advanceCpuShot(justFinishedIdx);
    player.shot += 1;
    updateHUD();

    phase = PHASE.SETTLE;
    clearSettleTimer();
    settleTimer = setTimeout(() => {
      settleTimer = null;
      activeBall = null;
      trail = [];

      if (player.shot >= 10) {
        phase = PHASE.OVER;
        finishGame();
      } else {
        phase = PHASE.AIM;
        setupShot();
        updateHUD();
      }
    }, 900);
  }

  // ===== 順位パネル =====
  function updateRankInfo() {
    const el = document.getElementById('rank-info');
    if (player.shot < 3) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');

    const sorted = getCurrentRanking();
    const myIdx = sorted.findIndex(t => t.isPlayer);
    const myRank = myIdx + 1;
    const lines = el.querySelectorAll('.rank-line');
    el.classList.toggle('is-leader', myRank === 1);

    if (myRank === 1) {
      const second = sorted[1];
      lines[0].textContent = `RANK 1/8 - LEAD`;
      lines[1].textContent = `+${player.score - second.score} OVER 2ND`;
      lines[2].textContent = `KEEP IT UP!`;
    } else {
      const top = sorted[0];
      const just = sorted[myIdx - 1];
      const gapTop  = top.score - player.score;
      const gapJust = just.score - player.score;
      const target  = myIdx;
      const suf = (target === 1) ? 'ST' : (target === 2) ? 'ND' : (target === 3) ? 'RD' : 'TH';
      lines[0].textContent = `RANK ${myRank}/8`;
      lines[1].textContent = `-${gapJust} TO ${target}${suf}`;
      lines[2].textContent = `-${gapTop} TO 1ST`;
    }
  }

  // ===== 描画 =====
  function render() {
    if (currentState === STATE.DODGE) { renderDodge(); return; }
    if (currentState === STATE.TITLE) { renderTitleScene(); return; }
    if (currentState !== STATE.GAME) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const sh = getShakeOffset();
    ctx.save();
    ctx.translate(sh.x, sh.y);
    drawStars();
    drawWindParticles();
    drawCourt();
    drawCatapult();
    drawAimGuide();
    drawTrail();
    drawBall();
    drawParticles();
    ctx.restore();

    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(${flashColor},${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawBorder();
  }

  // タイトル専用パーティクル (エネルギーストリーク)
  const titleStreaks = [];
  for (let i = 0; i < 18; i++) titleStreaks.push(makeTitleStreak());
  function makeTitleStreak() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      len: 30 + Math.random() * 80,
      speed: 1.5 + Math.random() * 3,
      alpha: 0.1 + Math.random() * 0.4,
      color: Math.random() < 0.5 ? '#29e0e6' : (Math.random() < 0.5 ? '#ff8c1a' : '#fff'),
    };
  }
  let titleScanY = 0;

  function renderTitleScene() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // 背景グラデーション
    const grad = ctx.createRadialGradient(W * 0.6, H * 0.4, 0, W * 0.6, H * 0.4, W * 0.7);
    grad.addColorStop(0,   'rgba(0,30,40,0.9)');
    grad.addColorStop(0.5, 'rgba(0,10,20,0.6)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // エネルギーストリーク
    for (const s of titleStreaks) {
      ctx.save();
      ctx.globalAlpha = s.alpha * (0.6 + 0.4 * Math.sin(performance.now() / 600 + s.x));
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len, s.y + s.len * 0.3);
      ctx.stroke();
      ctx.restore();
      s.x += s.speed;
      s.y -= s.speed * 0.2;
      if (s.x > W + 20 || s.y < -20) {
        Object.assign(s, makeTitleStreak());
        s.x = -s.len;
        s.y = Math.random() * H;
      }
    }

    drawStars();

    // スキャンライン効果
    titleScanY = (titleScanY + 1.2) % H;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#29e0e6';
    ctx.fillRect(0, titleScanY, W, 2);
    ctx.globalAlpha = 0.06;
    ctx.fillRect(0, (titleScanY + 60) % H, W, 1);
    ctx.restore();

    // スキャンライン (全体に薄く)
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#000';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
    ctx.restore();

    drawCourt();
    drawCatapult();

    // 下部グラデーションマスク (UIとのなじみ)
    const fade = ctx.createLinearGradient(0, H * 0.55, 0, H);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,0.82)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
  }

  // 星
  const stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * (COURT.floorY - 30),
      s: Math.random() < 0.15 ? 2 : 1,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
  function drawStars() {
    for (const s of stars) {
      s.twinkle += 0.04;
      const a = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.twinkle));
      ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      ctx.fillRect(s.x | 0, s.y | 0, s.s, s.s);
    }
  }

  // 風の流れる粒子
  function drawWindParticles() {
    for (const p of windParticles) {
      ctx.fillStyle = 'rgba(180,210,255,0.55)';
      ctx.fillRect((p.x|0), (p.y|0), p.len, 1);
    }
  }

  // 画面上部の風インジケータ (キャンバス内)
  function drawWindIndicator() {
    if (!currentWind) return;
    // 中央上に「WIND <<」アイコン表示
    const cx = W / 2;
    const cy = 18;
    ctx.fillStyle = '#000';
    ctx.fillRect(cx - 80, cy - 6, 160, 22);
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 80, cy - 6, 160, 22);

    pixelText('WIND', cx - 60, cy, 8, '#fff', 'center');

    // 矢印群
    const dir = currentWind.dir;
    const cnt = currentWind.level;
    const arrowStart = cx - 30;
    const ay = cy + 4;
    for (let i = 0; i < cnt; i++) {
      const offset = i * 14;
      drawWindArrow(arrowStart + offset * (dir > 0 ? 1 : -1) + (dir > 0 ? 0 : 60), ay, dir);
    }

    // 強さ数値 (H焦点のみ)
    const stats = getFocusStats();
    if (stats.windDisplayPrecise) {
      pixelText(currentWind.displayValue, cx + 55, cy, 8, '#4fc3f7', 'center');
    }
  }
  function drawWindArrow(x, y, dir) {
    // 8x6 の小さな矢印 (右向き or 左向き)
    ctx.fillStyle = '#4fc3f7';
    if (dir > 0) {
      ctx.fillRect(x,     y, 8, 2);
      ctx.fillRect(x + 6, y - 2, 2, 2);
      ctx.fillRect(x + 6, y + 2, 2, 2);
      ctx.fillRect(x + 8, y - 1, 1, 1);
      ctx.fillRect(x + 8, y + 2, 1, 1);
    } else {
      ctx.fillRect(x,     y, 8, 2);
      ctx.fillRect(x,     y - 2, 2, 2);
      ctx.fillRect(x,     y + 2, 2, 2);
      ctx.fillRect(x - 1, y - 1, 1, 1);
      ctx.fillRect(x - 1, y + 2, 1, 1);
    }
  }

  // コート
  function drawCourt() {
    drawWoodFloor();
    drawCourtLines();
    drawHoop();
  }

  function drawWoodFloor() {
    const top = COURT.floorY;
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(0, top, W, H - top);
    for (let y = top; y < H; y += 6) {
      ctx.fillStyle = (((y - top) / 6) | 0) % 2 ? '#43291c' : '#4d2f20';
      ctx.fillRect(0, y, W, 3);
    }
    ctx.fillStyle = '#5a3a28'; ctx.fillRect(0, top, W, 1);
    ctx.fillStyle = '#fff';    ctx.fillRect(0, top - 1, W, 1);
  }

  function drawCourtLines() {
    ctx.save();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(COURT.poleX - 80, COURT.floorY + 1);
    ctx.lineTo(W - 4, COURT.floorY + 1);
    ctx.stroke();

    const keyX1 = COURT.poleX - 90;
    const keyX2 = W - 4;
    const keyY1 = COURT.floorY + 4;
    const keyY2 = H - 4;
    ctx.strokeStyle = '#cc4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(keyX1, keyY1, keyX2 - keyX1, keyY2 - keyY1);
    ctx.strokeStyle = 'rgba(204,68,68,0.35)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(keyX1, keyY1 + i * 8 + 4);
      ctx.lineTo(keyX2, keyY1 + i * 8 + 4);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(keyX1, keyY1 + 12);
    ctx.lineTo(keyX2, keyY1 + 12);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(COURT.poleX - 10, COURT.floorY, 200, Math.PI, Math.PI * 1.5, false);
    ctx.stroke();
    ctx.restore();
  }

  function drawHoop() {
    const g = goalRect();
    const poleY1 = 195;
    const poleY2 = COURT.floorY;
    ctx.fillStyle = '#9aa0a8'; ctx.fillRect(g.poleX, poleY1, 8, poleY2 - poleY1);
    ctx.fillStyle = '#c8ced6'; ctx.fillRect(g.poleX, poleY1, 2, poleY2 - poleY1);
    ctx.fillStyle = '#555a60'; ctx.fillRect(g.poleX + 6, poleY1, 2, poleY2 - poleY1);
    ctx.fillStyle = '#222';    ctx.fillRect(g.poleX - 8, COURT.floorY - 6, 24, 8);
    ctx.strokeStyle = '#fff';  ctx.lineWidth = 1;
    ctx.strokeRect(g.poleX - 8 + 0.5, COURT.floorY - 6 + 0.5, 23, 7);

    const bb = { x: g.poleX - 4, y: 175, w: 6, h: 80 };
    ctx.fillStyle = '#fff'; ctx.fillRect(bb.x - 2, bb.y, bb.w + 4, bb.h);
    ctx.fillStyle = '#000'; ctx.fillRect(bb.x - 2, bb.y, bb.w + 4, 2);
    ctx.fillRect(bb.x - 2, bb.y + bb.h - 2, bb.w + 4, 2);
    ctx.fillStyle = '#b71c1c'; ctx.fillRect(bb.x - 2, bb.y + 2, 2, bb.h - 4);
    ctx.strokeStyle = '#b71c1c'; ctx.lineWidth = 2;
    ctx.strokeRect(bb.x - 6, bb.y + 22, 12, 22);

    ctx.fillStyle = '#ff6f00';
    ctx.fillRect(g.rimLeft, g.rimY, g.rimRight - g.rimLeft, 3);
    ctx.fillStyle = '#ff9800';
    ctx.fillRect(g.rimLeft, g.rimY, g.rimRight - g.rimLeft, 1);
    ctx.fillStyle = '#ff6f00';
    ctx.fillRect(g.rimLeft - 2, g.rimY - 2, 2, 5);
    ctx.fillRect(g.rimRight,    g.rimY - 2, 2, 5);

    drawNet(g);

    ctx.fillStyle = 'rgba(255,235,59,0.06)';
    ctx.fillRect(g.zone.x1, g.zone.y1, g.zone.x2 - g.zone.x1, g.zone.y2 - g.zone.y1);

    if (player.ballColor === 'green' && phase === PHASE.AIM) {
      const t = performance.now() / 200;
      const a = 0.15 + 0.15 * (0.5 + 0.5 * Math.sin(t));
      ctx.fillStyle = `rgba(124,252,0,${a.toFixed(2)})`;
      ctx.fillRect(g.bullseye.x1 - 2, g.bullseye.y1 - 2,
                   (g.bullseye.x2 - g.bullseye.x1) + 4,
                   (g.bullseye.y2 - g.bullseye.y1) + 4);
    }

    pixelText('TARGET', (g.zone.x1 + g.zone.x2) / 2, COURT.floorY + 12, 8, '#fff', 'center');

    if (isGoalMoving()) {
      const ind = (g.zone.x1 + g.zone.x2) / 2;
      ctx.fillStyle = '#4fc3f7';
      const arrowY = poleY1 - 14;
      ctx.fillRect(ind - 16, arrowY, 4, 2);
      ctx.fillRect(ind - 15, arrowY - 2, 2, 6);
      ctx.fillRect(ind + 12, arrowY, 4, 2);
      ctx.fillRect(ind + 13, arrowY - 2, 2, 6);
    }
  }

  function drawNet(g) {
    const left  = g.rimLeft  + 2;
    const right = g.rimRight - 2;
    const top   = g.rimY + 3;
    const bottomLeft  = left + 6;
    const bottomRight = right - 6;
    const bot   = g.rimY + 26;

    ctx.strokeStyle = '#dcdcdc';
    ctx.lineWidth = 1;
    const cols = 7;
    for (let i = 0; i <= cols; i++) {
      const tx = left + (right - left) * (i / cols);
      const bx = bottomLeft + (bottomRight - bottomLeft) * (i / cols);
      ctx.beginPath();
      ctx.moveTo(tx, top);
      ctx.lineTo(bx, bot);
      ctx.stroke();
    }
    for (let r = 1; r <= 3; r++) {
      const ty = top + ((bot - top) * r / 3);
      const lx = left + (bottomLeft - left) * (r / 3);
      const rx = right + (bottomRight - right) * (r / 3);
      ctx.beginPath();
      ctx.moveTo(lx, ty);
      ctx.lineTo(rx, ty);
      ctx.stroke();
    }
  }

  // ---------- 投石器 ----------
  function drawCatapult() {
    const baseY = COURT.floorY;
    const cx    = LAUNCHER.x;
    const now   = performance.now();
    const glow  = 0.55 + 0.45 * Math.sin(now / 300);   // 関節/クランプ脈動
    const since = now - lastFireTime;
    const recoil = since < 220 ? (1 - since / 220) : 0; // 1→0 減衰
    const dx = -8 * recoil;                             // 発射で後方(左)へキック

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - 60, baseY - 2, 120, 4);

    // 走行部(装甲ホイール)
    drawMechaWheel(cx - 40 + dx, baseY - 7, 10, glow);
    drawMechaWheel(cx + 40 + dx, baseY - 7, 10, glow);

    // 基部シャーシ
    const sx = cx - 50 + dx, sy = baseY - 30, sw = 100, sh = 22;
    ctx.fillStyle = '#2b3038'; ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#3a4250'; ctx.fillRect(sx, sy, sw, sh - 3);
    ctx.fillStyle = '#566073'; ctx.fillRect(sx, sy, sw, 2);
    ctx.fillStyle = '#20252c'; ctx.fillRect(sx, sy + sh - 3, sw, 3);
    ctx.fillStyle = '#20252c'; ctx.fillRect(sx + sw * 0.42, sy + 3, 1, sh - 8);
    // 警告ストライプ
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = (i % 2 === 0) ? '#ff8c1a' : '#20252c';
      ctx.fillRect(sx + 8 + i * 7, sy + sh - 8, 5, 4);
    }

    // ピボット支柱(2本) + 油圧ピストン
    const pivotX = cx + dx;
    const pivotY = baseY - 60;
    drawMechaStrut(cx - 22 + dx, sy, pivotX - 3, pivotY);
    drawMechaStrut(cx + 22 + dx, sy, pivotX + 3, pivotY);
    drawMechaPiston(cx - 30 + dx, sy + 4, pivotX - 6, pivotY + 6, glow);
    drawMechaPiston(cx + 30 + dx, sy + 4, pivotX + 6, pivotY + 6, glow);

    // ピボット関節(発光)
    ctx.fillStyle = '#20252c'; ctx.fillRect(pivotX - 7, pivotY - 7, 14, 14);
    ctx.fillStyle = '#3a4250'; ctx.fillRect(pivotX - 5, pivotY - 5, 10, 10);
    ctx.fillStyle = `rgba(41,224,230,${glow})`; ctx.fillRect(pivotX - 3, pivotY - 3, 6, 6);
    ctx.fillStyle = '#bff7fa'; ctx.fillRect(pivotX - 1, pivotY - 1, 2, 2);

    // メカアーム
    const armLen = 78;
    const ang    = player.angleDeg * Math.PI / 180;
    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(-ang);

    // カウンターウェイト(後方)
    ctx.fillStyle = '#20252c'; ctx.fillRect(-30, -9, 22, 18);
    ctx.fillStyle = '#3a4250'; ctx.fillRect(-30, -9, 22, 4);
    ctx.fillStyle = `rgba(41,224,230,${glow})`; ctx.fillRect(-26, 1, 14, 2);

    // アーム本体(装甲パネル)
    ctx.fillStyle = '#2b3038'; ctx.fillRect(0, -5, armLen, 10);
    ctx.fillStyle = '#3a4250'; ctx.fillRect(0, -5, armLen, 6);
    ctx.fillStyle = '#566073'; ctx.fillRect(0, -5, armLen, 2);
    ctx.fillStyle = '#20252c'; ctx.fillRect(0,  3, armLen, 2);
    for (let i = 1; i <= 3; i++) {
      const jx = i * (armLen / 4);
      ctx.fillStyle = '#20252c'; ctx.fillRect(jx - 1, -6, 3, 12);
      ctx.fillStyle = `rgba(41,224,230,${glow * 0.8})`; ctx.fillRect(jx, -1, 1, 2);
    }

    // 先端 電磁クランプ
    const tip = armLen;
    ctx.fillStyle = '#20252c'; ctx.fillRect(tip - 2, -12, 6, 24);
    ctx.fillStyle = '#3a4250'; ctx.fillRect(tip + 4, -11, 8, 22);
    ctx.fillStyle = '#566073'; ctx.fillRect(tip + 4, -11, 8, 2);
    ctx.fillStyle = '#566073'; ctx.fillRect(tip + 12, -11, 4, 5);
    ctx.fillStyle = '#566073'; ctx.fillRect(tip + 12,   6, 4, 5);
    ctx.fillStyle = `rgba(41,224,230,${glow})`; ctx.fillRect(tip + 5, -3, 6, 6);

    if (phase === PHASE.AIM || currentState === STATE.TITLE) {
      drawPixelBall(tip + 8, 0, player.ballColor, true);
    }
    ctx.restore();

    drawCatapultFlag(cx + dx, baseY);
  }

  function drawMechaWheel(cx, cy, r, glow) {
    ctx.fillStyle = '#15181d';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#566073'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#3a4250'; ctx.fillRect(cx - 3, cy - 3, 6, 6);
    ctx.fillStyle = `rgba(41,224,230,${glow})`; ctx.fillRect(cx - 1, cy - 1, 2, 2);
  }

  function drawMechaStrut(x1, y1, x2, y2) {
    drawDiagPlank(x1, y1, x2, y2, 5, '#3a4250', '#566073', '#20252c');
  }

  function drawMechaPiston(x1, y1, x2, y2, glow) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(a);
    const cyl = len * 0.55;
    ctx.fillStyle = '#20252c'; ctx.fillRect(0, -3, cyl, 6);
    ctx.fillStyle = '#3a4250'; ctx.fillRect(0, -3, cyl, 5);
    ctx.fillStyle = '#566073'; ctx.fillRect(0, -3, cyl, 1);
    ctx.fillStyle = '#9aa3b3'; ctx.fillRect(cyl, -1.5, len - cyl, 3);
    ctx.fillStyle = `rgba(41,224,230,${glow})`; ctx.fillRect(len - 3, -1, 2, 2);
    ctx.restore();
  }

  // 風向きに応じてなびく旗
  function drawCatapultFlag(cx, baseY) {
    const wind = currentWind;
    const t = performance.now() / 150;
    const flagW = 20;
    const flagH = 12;
    // 金属ポール + 発光基部
    ctx.fillStyle = '#566073';
    ctx.fillRect(cx - 56, baseY - 60, 2, 38);
    ctx.fillStyle = '#29e0e6';
    ctx.fillRect(cx - 57, baseY - 60, 4, 2);

    if (!wind) {
      ctx.fillStyle = '#b71c1c';
      ctx.fillRect(cx - 54, baseY - 60, flagW, flagH);
      pixelText('T4', cx - 44, baseY - 51, 7, '#fff', 'center');
      return;
    }

    // 風方向に旗が伸びる
    const dir = wind.dir;
    // 旗のなびき: 各列ごとに波形オフセットを適用
    const cols = 8;
    const colW = flagW / cols;
    const baseX = (dir > 0) ? cx - 54 : cx - 56 - flagW;
    for (let i = 0; i < cols; i++) {
      const wave = Math.sin(t + i * 0.6) * (1 + wind.level * 0.6);
      const x = baseX + i * colW * (dir > 0 ? 1 : 1); // 描画は左から右
      // dir<0なら右端から左端方向にシフトしない (baseXで既に左に開始済み)
      const y = baseY - 60 + wave;
      ctx.fillStyle = '#b71c1c';
      ctx.fillRect(x, y, Math.ceil(colW) + 0.5, flagH);
      if (i === 0) {
        // 上下のハイライト/シャドウ
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, Math.ceil(colW) + 0.5, 2);
        ctx.fillStyle = '#7a0c0c';
        ctx.fillRect(x, y + flagH - 2, Math.ceil(colW) + 0.5, 2);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, Math.ceil(colW) + 0.5, 1);
        ctx.fillStyle = '#7a0c0c';
        ctx.fillRect(x, y + flagH - 1, Math.ceil(colW) + 0.5, 1);
      }
    }
    // T4文字
    const labelX = dir > 0 ? cx - 44 : cx - 56 - flagW + 10;
    const labelY = baseY - 60 + Math.sin(t + 1) * (1 + wind.level * 0.6);
    pixelText('T4', labelX, labelY + 3, 7, '#fff', 'center');
  }

  function drawDiagPlank(x1, y1, x2, y2, thick, base, hi, sh) {
    ctx.save();
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    ctx.translate(x1, y1);
    ctx.rotate(a);
    ctx.fillStyle = sh;  ctx.fillRect(0, -thick/2, len, thick);
    ctx.fillStyle = base;ctx.fillRect(0, -thick/2, len, thick - 1);
    ctx.fillStyle = hi;  ctx.fillRect(0, -thick/2, len, 1);
    ctx.restore();
  }

  // ===== ガイド線 (風と移動ゴールを考慮) =====
  function drawAimGuide() {
    if (phase !== PHASE.AIM) return;
    const stats = getFocusStats();

    const ang = player.angleDeg * Math.PI / 180;
    const speed = player.power * stats.powerMul;
    let x = LAUNCHER.x, y = LAUNCHER.y;
    let vx = Math.cos(ang) * speed;
    let vy = -Math.sin(ang) * speed;

    // S は風を反映、それ以外は風なしの理想軌道 (実機は風で曲がる)
    const wAccel = stats.guideUsesWind ? effectiveWindAccel() : 0;

    for (let i = 0; i < stats.guideSteps; i++) {
      for (let k = 0; k < 3; k++) {
        vy += GRAVITY;
        vx += wAccel;
        x  += vx;
        y  += vy;
      }
      if (y > COURT.floorY) break;
      const a = 1 - i / stats.guideSteps;
      ctx.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(2)})`;
      ctx.fillRect((x|0) - 1, (y|0) - 1, 2, 2);
    }

    if (stats.predictGoal && isGoalMoving()) {
      const pred = predictGoalAtImpact();
      if (pred) {
        ctx.strokeStyle = 'rgba(124,252,0,0.9)';
        ctx.lineWidth = 1;
        const dx = pred.offset;
        ctx.strokeRect(COURT.rimLeft + dx - 1, COURT.rimY - 1,
                       COURT.rimRight - COURT.rimLeft + 2, 5);
        const cx = (COURT.rimLeft + COURT.rimRight) / 2 + dx;
        ctx.beginPath();
        ctx.moveTo(cx - 6, COURT.rimY + 14);
        ctx.lineTo(cx + 6, COURT.rimY + 14);
        ctx.moveTo(cx, COURT.rimY + 8);
        ctx.lineTo(cx, COURT.rimY + 20);
        ctx.stroke();
        pixelText('PREDICT', cx, COURT.rimY - 14, 6, '#7cfc00', 'center');
      }
    }
  }

  // S焦点: 風 + 移動ゴール込みの未来位置予測
  function predictGoalAtImpact() {
    const stats = getFocusStats();
    const ang = player.angleDeg * Math.PI / 180;
    const speed = player.power * stats.powerMul;
    let x = LAUNCHER.x, y = LAUNCHER.y;
    let vx = Math.cos(ang) * speed;
    let vy = -Math.sin(ang) * speed;
    const wAccel = effectiveWindAccel();
    for (let f = 0; f < 300; f++) {
      vy += GRAVITY;
      vx += wAccel;
      x  += vx;
      y  += vy;
      if (vy > 0 && y >= COURT.zone.y1 && y <= COURT.zone.y2 &&
          x >= COURT.zone.x1 - 80 && x <= COURT.zone.x2 + 80) {
        const futureMs = performance.now() + f * (1000 / 60);
        const off = computeGoalOffset(futureMs, player.shot);
        return { offset: off, frames: f };
      }
      if (y > COURT.floorY) break;
    }
    return null;
  }

  function drawTrail() {
    if (!trail.length) return;
    for (let i = 0; i < trail.length; i++) {
      const p = trail[i];
      const a = (i / trail.length) * 0.6;
      ctx.fillStyle = p.color === 'green'
        ? `rgba(124,252,0,${a.toFixed(2)})`
        : `rgba(255,235,59,${a.toFixed(2)})`;
      ctx.fillRect((p.x|0) - 1, (p.y|0) - 1, 2, 2);
    }
  }

  function drawBall() {
    if (!activeBall || !activeBall.alive) return;
    drawPixelBall(activeBall.x, activeBall.y, activeBall.color, true);
  }

  function drawPixelBall(cx, cy, color, withGlow = false) {
    const r = BALL_R;
    const main = color === 'green' ? '#7CFC00' : '#FFEB3B';
    const dark = color === 'green' ? '#2e7d00' : '#a67c00';
    const hi   = color === 'green' ? '#b8ff7a' : '#fff59d';
    if (color === 'green' && withGlow) {
      const t = performance.now() / 100;
      const pr = r + 3 + Math.sin(t) * 1.5;
      ctx.fillStyle = 'rgba(124,252,0,0.22)';
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = main;
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hi;
    ctx.fillRect(cx - 3, cy - 4, 3, 2);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.fillRect((p.x | 0) - p.size / 2, (p.y | 0) - p.size / 2, p.size, p.size);
    }
  }

  function drawBorder() {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }

  function pixelText(text, x, y, size, color, align = 'left') {
    ctx.fillStyle = color;
    ctx.font = `${size}px "Press Start 2P", "Courier New", monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillText(text, x, y);
  }

  // ===== UME ダイアログ (ジョジョ口調) =====
  const DIALOGUE_LINES = {
    1: [
      '……やったぞ。',
      '1位だ。',
      'だが、おれは今、妙な気分でいる。',
      '勝利の高揚よりも先に、静けさが来た。',
      'これは一体、何なんだ……？',
      'あの瞬間を思い出せ。',
      '風が吹いた。ゴールが揺れた。',
      'それでも、おれの手は迷わなかった。',
      '「覚悟」というやつが、あの一投に宿っていたんだ！',
      '何度外した？　何度くじけそうになった？',
      'そのすべてが、今日のこの場所に繋がっている。',
      '次にここに立てるかどうか、それはわからない。',
      'だが……今日、ここに立ったという事実は、',
      '誰にも、何にも、消すことはできない！',
      'しっかり受け取っておけ。これは、お前が掴んだものだ。',
    ],
    2: [
      '2位か……。',
      '惜しかった。本当に、惜しかったぞ。',
      'あの最終ショット……あそこで決まっていたら。',
      '何度もその瞬間が、頭の中で再生される。',
      'だが待て。よく考えろ。',
      '「悔しい」と思えるのは、本気でぶつかった証拠だ！',
      '投げやりな者に、悔しさは宿らない。',
      '1位との差は、紙一重だった。',
      'その差を生んだのは、どの一投だったんだ？',
      '風を読み違えた、あの場面か。',
      'ゴールが動き出してから、わずかに焦ったあの瞬間か。',
      '見えているか？　それが見えているうちは、まだ伸びられる。',
      '今日の悔しさを、無駄にするな。',
      'それを燃料にして、次の投球に臨め！',
    ],
    3: [
      '3位。',
      '表彰台に立った。',
      'この景色……4位のときとは、確かに違う。',
      '空気の質が、一段上がった気がする。',
      '緑ボールを狙いにいったのは、正しい判断だった。',
      'リスクを恐れて黄色だけを投げていたら、ここには来られなかったはずだ。',
      '小さな一歩かもしれない。',
      'だがな、その一歩を踏み出す勇気こそが、いちばん難しいんだ！',
      '怖くてもやってみる。',
      'その繰り返しが、人間を前に進める。',
      'やれば変われる。今日、それを証明した。',
      'ならば次は、もう一段上を狙えるはずだ。',
      'お前にはその力がある。おれが保証する。',
    ],
    4: [
      '4位か。',
      'ちょうど中間地点……絶妙に難しい場所だ。',
      'トップも遠く、最下位も遠い。',
      'そのどちらの緊張感も、少しずつ薄れてしまう。',
      'これが、「4位の罠」というやつだ。',
      '今日の投球を、正直に振り返ってみろ。',
      '攻めるべき場面で、無意識に守りに入っていなかったか？',
      '緑ボールを狙えるのに、黄色を選んだ瞬間。',
      'その選択が、今日のここを決めたのかもしれない。',
      '満足しているなら、それでいい。',
      'だが、もっと上に行きたいなら……何かを変えろ！',
      '答えはすでに、お前の中にある。',
      '次の一投で、たった一つだけ変えてみろ。それでいい。',
    ],
    5: [
      '5位か。',
      '前半は、悪くなかった。それは認める。',
      'だがゴールが動き出してから、リズムが崩れた。',
      '風向きが変わった瞬間、対応が一テンポ遅れた。',
      'そういった小さなズレが積み重なり、ここになった。',
      '落ち込みたい気持ちはわかる。おれにもそれはある。',
      'だがな……一度下がることを恐れていたら、何もできないぞ！',
      '失敗は情報だ。敵ではない。',
      'どこで判断を誤ったか、今ならはっきり見えているはずだ。',
      'それを次に持ち込めるなら、今日は負けじゃない。',
      'ストリークが途切れたあの一投……',
      '次は、そこで踏ん張る。それだけでいい。',
      '一投ずつ、立て直していけばいい。',
    ],
    6: [
      '6位。',
      '思うようにいかなかった……。',
      'ゴールを見ていたはずなのに、手が合わなかった。',
      'あの感覚、言葉にするのが難しい。',
      'ごまかしたくなる気持ちはわかる。',
      '「今日は調子が悪かっただけだ」と言えば、楽になれる。',
      'だが……それでいいのか？',
      '風の読み方が雑だった場面。',
      'パワーを焦って上げすぎた投球。',
      'ストリークを守ろうとして、かえって体が固まった瞬間。',
      'うまくいかなかった場所を、目をそらさずに見ろ。',
      'そこから逃げない者だけが、次のステージへ進める！',
      '今日は、その覚悟を持つ日だ。',
      'これは終わりじゃない。通過点だ。',
    ],
    7: [
      '7位。',
      '今日は崩れた……完全に崩れた。',
      '投げるたびに、何かがちぐはぐだった。',
      '緑ボールを外したとき、気持ちに罅が入った。',
      'そこからのリカバリーができなかった。',
      '思い通りにいかないことが、次々と重なった。',
      'そういう日はある。誰にでも、必ずある。',
      '完璧な日だけが、本当の自分じゃない。',
      'こういう日も……お前だ。否定するな。',
      'これは弱さではない。試されている時間だ。',
      '崩れた日は、基礎に戻るチャンスだと思え！',
      'アングルの確認。パワーの感覚。',
      '風を読む、その一秒の間。',
      'ひとつひとつ、積み上げ直していけばいい。',
      '次は、もう少しうまくやれる。それは確かだ。',
    ],
    8: [
      '8位。',
      '最下位だ。',
      '……きつい。本当に、きつい。',
      '悔しいを通り越して、しばらく何も考えたくなる。',
      'ゴールが動き出したとき、頭の中が真っ白になった。',
      '風を読む余裕など、まるでなかった。',
      'それでも……10投、すべて投げた。',
      '途中で腕を止めなかった。',
      'その事実だけは、誰にも消せない！',
      '最下位には、最下位にしか見えない景色がある。',
      'ここから上がるしかない……という、ある種の自由だ。',
      '失うものは、もうない。',
      'ならば次は、なりふり構わずやってみろ！',
      '緑ボールを全部狙いにいけ。',
      'ストリークなど気にするな。',
      'ただ、ゴールだけを見ろ。',
      'ここが……スタートラインだ。',
    ],
  };

  const dialogue = {
    active: false,
    lines: [],
    idx: 0,
    typingFull: '',
    typingPos: 0,
    typingComplete: false,
    typingTimer: null,
  };
  const TYPE_INTERVAL = 35;

  const dialogueScene = document.getElementById('dialogue-scene');
  const dialogueTextEl = document.getElementById('dialogue-text');
  const dialogueNextEl = document.getElementById('dialogue-next');
  const resultSummary = document.getElementById('result-summary');

  function resetDialogue() {
    if (dialogue.typingTimer) clearInterval(dialogue.typingTimer);
    dialogue.active = false;
    dialogue.lines = [];
    dialogue.idx = 0;
    dialogue.typingFull = '';
    dialogue.typingPos = 0;
    dialogue.typingComplete = false;
    dialogue.typingTimer = null;
    dialogueTextEl.textContent = '';
    dialogueNextEl.classList.add('hidden');
  }

  function startDialogue(lines) {
    resetDialogue();
    dialogue.lines = lines.slice();
    dialogue.active = true;
    dialogueScene.classList.remove('hidden');
    resultSummary.classList.add('hidden');
    typeLine();
  }

  function typeLine() {
    if (dialogue.typingTimer) clearInterval(dialogue.typingTimer);
    dialogue.typingFull = dialogue.lines[dialogue.idx];
    dialogue.typingPos = 0;
    dialogue.typingComplete = false;
    dialogueTextEl.textContent = '';
    dialogueNextEl.classList.add('hidden');

    dialogue.typingTimer = setInterval(() => {
      dialogue.typingPos++;
      dialogueTextEl.textContent = dialogue.typingFull.slice(0, dialogue.typingPos);
      AudioManager.play('talk');
      if (dialogue.typingPos >= dialogue.typingFull.length) {
        clearInterval(dialogue.typingTimer);
        dialogue.typingTimer = null;
        dialogue.typingComplete = true;
        dialogueNextEl.classList.remove('hidden');
      }
    }, TYPE_INTERVAL);
  }

  let advanceLatch = false;
  function advanceDialogue() {
    if (!dialogue.active) return;
    if (advanceLatch) return;
    advanceLatch = true;
    setTimeout(() => { advanceLatch = false; }, 80);

    if (!dialogue.typingComplete) {
      // タイプ途中なら全文表示にスキップ
      if (dialogue.typingTimer) clearInterval(dialogue.typingTimer);
      dialogue.typingTimer = null;
      dialogueTextEl.textContent = dialogue.typingFull;
      dialogue.typingComplete = true;
      dialogueNextEl.classList.remove('hidden');
      return;
    }
    dialogue.idx++;
    if (dialogue.idx >= dialogue.lines.length) {
      finishDialogue();
      return;
    }
    typeLine();
  }

  function finishDialogue() {
    dialogue.active = false;
    if (dialogue.typingTimer) clearInterval(dialogue.typingTimer);
    dialogueScene.classList.add('hidden');
    if (storyMode) {
      // STORYモード: そのまま「自分との闘い」へ
      setTimeout(() => { if (storyMode) startDodgeGame(); }, 500);
      return;
    }
    resultSummary.classList.remove('hidden');
  }

  // 会話シーン全体をクリック/タッチで進める
  dialogueScene.addEventListener('mousedown', ev => {
    ev.preventDefault();
    if (currentState === STATE.RESULT) advanceDialogue();
  });
  dialogueScene.addEventListener('touchstart', ev => {
    ev.preventDefault();
    if (currentState === STATE.RESULT) advanceDialogue();
  }, { passive:false });
  dialogueScene.addEventListener('click', ev => ev.preventDefault());

  // ===== 結果 =====
  function finishGame() {
    showResult();
  }

  function showResult() {
    const sorted = getCurrentRanking();
    const ol = document.getElementById('ranking-list');
    ol.innerHTML = '';
    const oldRec = document.getElementById('new-record-banner');
    if (oldRec) oldRec.remove();
    let myRank = 0;
    sorted.forEach((t, idx) => {
      const li = document.createElement('li');
      li.className = `rank-${idx + 1}` + (t.isPlayer ? ' player' : '');
      const rankMark = (idx + 1) + (idx === 0 ? 'ST' : idx === 1 ? 'ND' : idx === 2 ? 'RD' : 'TH');
      li.innerHTML =
        `<span class="rank-num">${rankMark}</span>` +
        `<span class="rank-name">TEAM ${t.id}${t.isPlayer ? ' (YOU)' : ''}</span>` +
        `<span class="rank-pts">${t.score} pt</span>`;
      ol.appendChild(li);
      if (t.isPlayer) myRank = idx + 1;
    });
    const rankSuffix = (myRank === 1) ? 'ST' : (myRank === 2) ? 'ND' : (myRank === 3) ? 'RD' : 'TH';
    document.getElementById('result-rank').textContent = `${myRank}${rankSuffix} PLACE`;

    localStorage.setItem('mhsc_last_score', String(player.score));
    if (myRank <= 4 && localStorage.getItem('mhsc_unlocked') !== '1') {
      localStorage.setItem('mhsc_unlocked', '1');
    }
    AudioManager.play('result');
    AudioManager.playFileBgm('DANDAN.m4a', 0.55);
    const isNew = Storage.isNewRecord(player.score, myRank);
    Storage.save(player.score, myRank);
    if (isNew) {
      const newRec = document.createElement('p');
      newRec.id = 'new-record-banner';
      newRec.textContent = '★ NEW RECORD!';
      newRec.style.cssText = 'color:#ffd700;font-size:clamp(11px,2vw,14px);letter-spacing:3px;margin-bottom:8px;';
      const ol = document.getElementById('ranking-list');
      ol.parentNode.insertBefore(newRec, ol);
    }
    switchScreen(STATE.RESULT);
    // 会話開始
    const lines = DIALOGUE_LINES[myRank] || DIALOGUE_LINES[4];
    startDialogue(lines);
  }

  // 結果ボタン
  document.getElementById('btn-dodge').addEventListener('click', () => {
    AudioManager.init();
    AudioManager.play('start');
    startDodgeGame();
  });

  document.getElementById('dodge-btn-retry').addEventListener('click', () => {
    AudioManager.play('select');
    startDodgeGame();
  });
  document.getElementById('dodge-btn-title').addEventListener('click', () => {
    AudioManager.play('select');
    storyMode = false;
    switchScreen(STATE.TITLE);
  });

  document.getElementById('btn-retry').addEventListener('click', () => {
    AudioManager.play('select');
    resetDialogue();
    startGame();
  });
  document.getElementById('btn-back-title').addEventListener('click', () => {
    AudioManager.play('select');
    clearSettleTimer();
    resetDialogue();
    phase = PHASE.AIM;
    activeBall = null;
    trail = [];
    particles = [];
    windParticles = [];
    storyMode = false;
    switchScreen(STATE.TITLE);
  });

  // ===== 自分との闘い (ターン制バトル) =====
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 部品画像プリロード
  const PART_IMG = {};
  const PART_ORDER = ['gear', 'bolt', 'screw', 'nut', 'board'];
  PART_ORDER.forEach(name => {
    const img = new Image();
    img.src = name.charAt(0).toUpperCase() + name.slice(1) + '.png'; // Gear.png 等
    PART_IMG[name] = img;
  });

  const DBOX = { x: 80, y: 220, w: 640, h: 140 }; // バトルボックス(横長)
  const DODGE_PLAYER_HP = 8;
  const ENEMY_TURN_MS = 6500;

  const ACTIONS = ['fight', 'act', 'item', 'mercy'];

  // ACT使用回数ごとのセリフ (Undertale風 * 記法)
  const ACT_LINES = [
    '* むこうも こちらを じっと にらんでいる。',
    '* カタパルトに うっすら ホコリが つもっている。',
    '* ゆっくり こきゅうを ととのえた。',
    '* 自分の影が、もう一人の自分に 重なりそうだ。',
    '* 目を 閉じると、あの投球の感触が 残っている。',
    '* 風の音が、少し 遠くなった気がした。',
    '* むこうが、わずかに たじろいだ。',
    '* 自分の中の 何かが、静かに 溶けていく。',
  ];

  // ラウンド別 敵フレーバーテキスト (Undertale風)
  const ENEMY_FLAVOR = [
    '* もう一人の自分が 立ちふさがった！',
    '* 鏡の向こうから にらみ返してくる。',
    '* 同じ声で、「負けるな」と 言っている。',
    '* 逃げることはできない。これは自分自身との戦いだ。',
    '* 本気を、見せてやる。',
    '* まだ終わらない。お前は本当に 諦めないのか？',
  ];

  // MERCY成功時・失敗時の敵セリフ
  const MERCY_REFUSE = [
    '* まだだ。お前の 覚悟が 見えない。',
    '* …本気か？ まだ ACTが 足りない。',
    '* もっと 自分を さらけ出せ。',
  ];

  // 敵ターン開始時セリフ
  const ENEMY_ATTACK_LINES = [
    '* むこうが 動いた！',
    '* 攻撃が はじまる！',
    '* 全力で 来るぞ！',
    '* お前の 心を 狙ってくる！',
    '* 受け止めてみろ！',
  ];

  const DODGE = {
    battlePhase: 'intro',     // intro | player | enemy | win | lose
    phaseTime: 0,
    round: 0,
    difficulty: 0,
    outcome: null,
    heart: { x: 400, y: 250 },
    hp: 8, maxHp: 8, invincible: 0,
    lv: 1,
    oppHpMax: 100, oppHp: 100, oppShake: 0, oppFlash: 0,
    bullets: [],
    nextBulletTime: 0,
    fight: { active: false, markerX: 0, speed: 0, locked: false },
    menu: { mode: 'menu', index: 0, msgUntil: 0, msgNextPhase: null },
    itemsLeft: 3,
    realFormUsed: false,
    realFormActive: false,
    actCount: 0,       // ACT使用回数 (MERCY成功条件に使用)
    mercyReady: false, // ACT3回でMERCY成功可能フラグ
    msg: '', msgUntil: 0,
    active: false,
  };

  function setDodgeMsg(text, ms) {
    DODGE.msg = text;
    DODGE.msgUntil = performance.now() + ms;
  }

  function startDodgeGame() {
    const lastScore = parseInt(localStorage.getItem('mhsc_last_score') || '0', 10);
    DODGE.difficulty = Math.min(1.0, lastScore / 200);
    DODGE.hp = DODGE_PLAYER_HP;
    DODGE.maxHp = DODGE_PLAYER_HP;
    DODGE.invincible = 0;
    DODGE.round = 0;
    DODGE.outcome = null;
    DODGE.lv = Math.max(1, Math.floor(lastScore / 50) + 1);
    DODGE.oppHpMax = Math.round(100 + 60 * DODGE.difficulty);
    DODGE.oppHp = DODGE.oppHpMax;
    DODGE.oppShake = 0; DODGE.oppFlash = 0;
    DODGE.bullets = [];
    DODGE.itemsLeft = 3;
    DODGE.realFormUsed = false;
    DODGE.realFormActive = false;
    DODGE.actCount = 0;
    DODGE.mercyReady = false;
    DODGE.heart = { x: DBOX.x + DBOX.w / 2, y: DBOX.y + DBOX.h / 2 };
    DODGE.fight.active = false;
    DODGE.menu.mode = 'menu'; DODGE.menu.index = 0;
    DODGE.msg = '';
    DODGE.active = true;
    enterBattlePhase('intro');
    switchScreen(STATE.DODGE);
  }

  function syncDodgeUI() {
    const acts    = document.getElementById('dodge-actions');
    const dirs    = document.getElementById('dodge-dir-controls');
    const showAct = (DODGE.battlePhase === 'player' && DODGE.menu.mode === 'menu');
    const showDir = (DODGE.battlePhase === 'enemy');
    if (acts) acts.style.display = showAct ? '' : 'none';
    if (dirs) dirs.style.visibility = showDir ? 'visible' : 'hidden';
    document.querySelectorAll('#dodge-actions .act-btn').forEach((b, i) => {
      b.classList.toggle('selected', i === DODGE.menu.index);
      b.disabled = !showAct;
    });
  }

  function enterBattlePhase(p) {
    DODGE.battlePhase = p;
    DODGE.phaseTime = performance.now();

    if (p === 'intro') {
      const flavor = ENEMY_FLAVOR[0];
      setDodgeMsg(flavor, 1800);
    } else if (p === 'player') {
      DODGE.menu.mode = 'menu';
      DODGE.menu.index = 0;
      DODGE.fight.active = false;
      DODGE.fight.locked = false;
      // プレイヤーターン開始時: 現在のラウンドに応じたフレーバー表示
      const flavorIdx = Math.min(DODGE.round, ENEMY_FLAVOR.length - 1);
      if (DODGE.round >= 1) {
        setDodgeMsg(ENEMY_FLAVOR[flavorIdx], 1400);
      }
    } else if (p === 'enemy') {
      DODGE.round += 1;
      DODGE.bullets = [];
      DODGE.nextBulletTime = performance.now() + 500;
      DODGE.heart = { x: DBOX.x + DBOX.w / 2, y: DBOX.y + DBOX.h / 2 };
      AudioManager.play('start');
      // 敵ターン開始ランダムセリフ
      const atk = ENEMY_ATTACK_LINES[Math.floor(Math.random() * ENEMY_ATTACK_LINES.length)];
      setDodgeMsg(atk, 900);
    }
    syncDodgeUI();
  }

  function startFightBar() {
    DODGE.menu.mode = 'fight';
    const f = DODGE.fight;
    f.active = true;
    f.locked = false;
    f.markerX = DBOX.x + 10;
    f.speed = (DBOX.w - 20) / 78 * (1 + 0.08 * Math.max(0, DODGE.round - 1));
    syncDodgeUI();
  }

  function startActMsg(text, nextPhase) {
    DODGE.menu.mode = 'msg';
    setDodgeMsg(text, 1500);
    DODGE.menu.msgUntil = performance.now() + 1500;
    DODGE.menu.msgNextPhase = nextPhase || 'enemy';
    syncDodgeUI();
  }

  function dodgeChooseAction() {
    if (DODGE.battlePhase !== 'player' || DODGE.menu.mode !== 'menu') return;
    const act = ACTIONS[DODGE.menu.index];
    AudioManager.play('select');
    if (act === 'fight') {
      startFightBar();
    } else if (act === 'act') {
      DODGE.actCount += 1;
      if (DODGE.actCount >= 3 && !DODGE.mercyReady) {
        DODGE.mercyReady = true;
      }
      const line = ACT_LINES[(DODGE.actCount - 1) % ACT_LINES.length];
      let suffix;
      if (DODGE.mercyReady) {
        suffix = '\n★ MERCYが つかえるようになった！';
      } else {
        suffix = `  [${DODGE.actCount}/3]`;
      }
      startActMsg(line + suffix, 'enemy');
    } else if (act === 'item') {
      if (DODGE.itemsLeft > 0) {
        const heal = 3;
        DODGE.hp = Math.min(DODGE.maxHp, DODGE.hp + heal);
        DODGE.itemsLeft -= 1;
        AudioManager.play('green');
        startActMsg('* HPが ' + heal + ' かいふくした！　ほっとする。', 'enemy');
      } else {
        startActMsg('* ポケットをさぐったが、何も なかった。', 'enemy');
      }
    } else if (act === 'mercy') {
      if (DODGE.mercyReady) {
        // MERCY成功: バトル終了
        setDodgeMsg('* …そうか。今日はここまでに しておいてやる。', 1800);
        AudioManager.play('super');
        flashAlpha = 0.5; flashColor = '124,252,0';
        triggerShake(10, 5);
        setTimeout(() => { if (DODGE.active) endDodgeBattle('win'); }, 1800);
      } else {
        const ref = MERCY_REFUSE[Math.floor(Math.random() * MERCY_REFUSE.length)];
        const remaining = 3 - DODGE.actCount;
        startActMsg(ref + `  (ACTあと${remaining}回)`, 'enemy');
      }
    }
  }

  function dodgeMoveMenu(delta) {
    if (DODGE.battlePhase !== 'player' || DODGE.menu.mode !== 'menu') return;
    DODGE.menu.index = (DODGE.menu.index + delta + ACTIONS.length) % ACTIONS.length;
    AudioManager.play('select');
    syncDodgeUI();
  }

  // 方向ボタン (タッチ) → keysHeld
  function bindDodgeKey(id, code) {
    const el = document.getElementById(id);
    if (!el) return;
    const start = ev => { ev.preventDefault(); keysHeld[code] = true; };
    const stop  = ev => { if (ev) ev.preventDefault(); keysHeld[code] = false; };
    el.addEventListener('mousedown',  start);
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('mouseup',    stop);
    el.addEventListener('mouseleave', stop);
    el.addEventListener('touchend',   stop);
    el.addEventListener('touchcancel',stop);
    el.addEventListener('click', ev => ev.preventDefault());
  }
  bindDodgeKey('dodge-btn-up',    'ArrowUp');
  bindDodgeKey('dodge-btn-down',  'ArrowDown');
  bindDodgeKey('dodge-btn-left',  'ArrowLeft');
  bindDodgeKey('dodge-btn-right', 'ArrowRight');

  // SPACE/ENTER 押下: メニューなら決定、FIGHTバーならロック
  let dodgeFightLatch = false;
  function dodgeConfirmPress() {
    if (DODGE.battlePhase !== 'player') return;
    if (DODGE.menu.mode === 'menu') {
      dodgeChooseAction();
    } else if (DODGE.menu.mode === 'fight' && DODGE.fight.active && !DODGE.fight.locked) {
      resolveFightHit();
    }
  }
  // アクションボタン (タップ/クリック) で個別選択
  (function bindDodgeActions() {
    document.querySelectorAll('#dodge-actions .act-btn').forEach((btn, i) => {
      const press = ev => {
        if (ev) ev.preventDefault();
        if (dodgeFightLatch) return;
        dodgeFightLatch = true;
        DODGE.menu.index = i;
        dodgeChooseAction();
        setTimeout(() => { dodgeFightLatch = false; }, 150);
      };
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('mousedown', press);
      btn.addEventListener('click', ev => ev.preventDefault());
    });
  })();

  // FIGHTバーのロック: スマホにはキーボードが無いので、戦闘エリア(キャンバス)の
  // タップ/クリックでも「決定」できるようにする。screen-dodge は pointer-events:none
  // なので、タップはその下のキャンバスに届く。
  function dodgeTapStrike(ev) {
    if (currentState !== STATE.DODGE) return;
    if (DODGE.battlePhase === 'player' && DODGE.menu.mode === 'fight' &&
        DODGE.fight.active && !DODGE.fight.locked) {
      ev.preventDefault();
      resolveFightHit();
    }
  }
  canvas.addEventListener('touchstart', dodgeTapStrike, { passive: false });
  canvas.addEventListener('mousedown', dodgeTapStrike);
  // 下部HUDの空き領域(FIGHT中はボタン非表示)タップでも決定できるように
  const dodgeHudEl = document.getElementById('dodge-hud');
  if (dodgeHudEl) {
    dodgeHudEl.addEventListener('touchstart', dodgeTapStrike, { passive: false });
    dodgeHudEl.addEventListener('mousedown', dodgeTapStrike);
  }

  function resolveFightHit() {
    const f = DODGE.fight;
    f.locked = true;
    f.active = false;
    const center = DBOX.x + DBOX.w / 2;
    const half = (DBOX.w - 20) / 2;
    const ad = Math.min(1, Math.abs(f.markerX - center) / half);
    // クリティカル帯は画面に出る黄色スイートスポット(中心±8%幅 = ad<0.16)と一致させる
    let dmg, crit = false;
    if (ad < 0.16) { dmg = 40; crit = true; }
    else dmg = Math.round(lerp(34, 8, ad));
    DODGE.oppHp = Math.max(0, DODGE.oppHp - dmg);
    DODGE.oppShake = 12; DODGE.oppFlash = 10;
    setDodgeMsg((crit ? '* クリティカル！　' : '* ') + dmg + ' のダメージ！', 1000);
    AudioManager.play(crit ? 'super' : 'swish');
    if (crit) {
      flashAlpha = 0.4; flashColor = '255,235,59';
      triggerShake(14, 9);
      triggerHitstop(90);
    } else {
      triggerShake(5, 3);
      triggerHitstop(40);
    }
    setTimeout(() => {
      if (!DODGE.active) return;
      if (DODGE.oppHp <= 0) {
        if (!DODGE.realFormUsed) {
          // ホンキ発動: HPを少しだけ戻して激化ENEMY_TURNを1回挟む
          DODGE.realFormUsed = true;
          DODGE.realFormActive = true;
          DODGE.oppHp = Math.max(1, Math.round(DODGE.oppHpMax * 0.18));
          DODGE.oppFlash = 24;
          triggerShake(22, 10);
          AudioManager.play('super');
          flashAlpha = 0.55; flashColor = '255,80,80';
          setDodgeMsg('* …まだだ。これが、本当の 自分だ！', 1600);
          setTimeout(() => { if (DODGE.active) enterBattlePhase('enemy'); }, 1400);
        } else {
          endDodgeBattle('win');
        }
      } else {
        enterBattlePhase('enemy');
      }
    }, 1000);
  }

  function updateDodge() {
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - 0.04);
    if (DODGE.oppShake > 0) DODGE.oppShake--;
    if (DODGE.oppFlash > 0) DODGE.oppFlash--;
    if (!DODGE.active) return;

    const now = performance.now();
    if (DODGE.battlePhase === 'intro') {
      if (now - DODGE.phaseTime >= 1500) enterBattlePhase('player');
    } else if (DODGE.battlePhase === 'player') {
      if (DODGE.menu.mode === 'fight') updateFightBar();
      else if (DODGE.menu.mode === 'msg' && now >= DODGE.menu.msgUntil) {
        enterBattlePhase(DODGE.menu.msgNextPhase || 'enemy');
      }
    } else if (DODGE.battlePhase === 'enemy') {
      updateDodgeEnemy(now);
    }
  }

  function updateFightBar() {
    const f = DODGE.fight;
    if (!f.active || f.locked) return;
    f.markerX += f.speed;
    const right = DBOX.x + DBOX.w - 10;
    if (f.markerX >= right) {
      f.markerX = right;
      f.locked = true; f.active = false;
      setDodgeMsg('MISS', 900);
      AudioManager.play('miss');
      setTimeout(() => { if (DODGE.active) enterBattlePhase('enemy'); }, 900);
    }
  }

  function updateDodgeEnemy(now) {
    const spd = 3.0, r = 6, b = DBOX, h = DODGE.heart;
    if (keysHeld['ArrowLeft']  || keysHeld['KeyA']) h.x = Math.max(b.x + r + 1, h.x - spd);
    if (keysHeld['ArrowRight'] || keysHeld['KeyD']) h.x = Math.min(b.x + b.w - r - 1, h.x + spd);
    if (keysHeld['ArrowUp']    || keysHeld['KeyW']) h.y = Math.max(b.y + r + 1, h.y - spd);
    if (keysHeld['ArrowDown']  || keysHeld['KeyS']) h.y = Math.min(b.y + b.h - r - 1, h.y + spd);

    if (now >= DODGE.nextBulletTime) {
      spawnDodgeAttack();
      const d = DODGE.difficulty;
      const interval = Math.max(350, 1300 - d * 500 - DODGE.round * 40);
      DODGE.nextBulletTime = now + interval;
    }

    updateDodgeBullets();

    if (now - DODGE.phaseTime >= ENEMY_TURN_MS && DODGE.hp > 0) {
      DODGE.realFormActive = false; // ホンキフェーズはENEMY_TURNを1度抜けたら解除
      enterBattlePhase('player');
    }
  }

  // ラウンドごとに部品をローテーション (gear→bolt→screw→nut→board→…)
  function spawnDodgeAttack() {
    const part = PART_ORDER[(DODGE.round - 1 + PART_ORDER.length) % PART_ORDER.length];
    spawnPartAttack(part);
    if (DODGE.realFormActive) {
      // ホンキフェーズ: 別の部品も同時に
      const altIdx = (DODGE.round + 1) % PART_ORDER.length;
      spawnPartAttack(PART_ORDER[altIdx]);
    }
  }

  function spawnPartAttack(part) {
    const b = DBOX, d = DODGE.difficulty;
    const spd = 1.6 + d * 1.4 + DODGE.round * 0.05;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;

    if (part === 'gear') {
      // 転がる歯車: 左右に横切る + 回転
      const n = 2 + Math.floor(d * 3) + Math.floor(DODGE.round / 3);
      for (let i = 0; i < n; i++) {
        const fromLeft = Math.random() < 0.5;
        const y = b.y + 25 + Math.random() * (b.h - 50);
        DODGE.bullets.push({
          img: 'gear', size: 34, r: 14,
          x: fromLeft ? b.x - 24 : b.x + b.w + 24, y,
          vx: (fromLeft ? 1 : -1) * spd, vy: 0,
          spin: (fromLeft ? 1 : -1) * 0.15,
        });
      }
    } else if (part === 'bolt') {
      // 落下ボルト: 上から高速落下
      const n = 5 + Math.floor(d * 4) + Math.floor(DODGE.round / 2);
      for (let i = 0; i < n; i++) {
        const x = b.x + 15 + Math.random() * (b.w - 30);
        DODGE.bullets.push({
          img: 'bolt', size: 28, r: 9,
          x, y: b.y - 14, vx: 0, vy: spd * 1.4, gravity: true,
        });
      }
    } else if (part === 'screw') {
      // ねじ込み: 横からサイン波 + 回転
      const dir = Math.random() < 0.5 ? 1 : -1;
      const n = 3 + Math.floor(d * 3) + Math.floor(DODGE.round / 3);
      for (let i = 0; i < n; i++) {
        const y = b.y + 30 + Math.random() * (b.h - 60);
        DODGE.bullets.push({
          img: 'screw', size: 28, r: 9,
          x: dir > 0 ? b.x - 24 - i * 30 : b.x + b.w + 24 + i * 30, y,
          baseY: y, vx: dir * spd, vy: 0,
          spin: dir * 0.25, wave: true, waveAmp: 18, waveFreq: 0.12,
        });
      }
    } else if (part === 'nut') {
      // 跳ねるナット: 壁で反射
      const n = 1 + Math.floor(d * 2) + Math.floor(DODGE.round / 4);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        DODGE.bullets.push({
          img: 'nut', size: 26, r: 10,
          x: cx, y: cy,
          vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
          bounce: true, life: 420, spin: 0.1,
        });
      }
    } else { // board
      // 回路プレス: 片側から基板の壁が迫り、1か所だけ隙間
      const vertical = Math.random() < 0.5;
      const gap = 0.3 + Math.random() * 0.4;
      const fromStart = Math.random() < 0.5;
      const slots = vertical ? 11 : 5;
      for (let i = 0; i < slots; i++) {
        const t = (i + 0.5) / slots;
        if (Math.abs(t - gap) < 0.16) continue; // 隙間
        if (vertical) {
          const x = b.x + t * b.w;
          DODGE.bullets.push({
            img: 'board', size: 30, r: 13,
            x, y: fromStart ? b.y - 16 : b.y + b.h + 16,
            vx: 0, vy: (fromStart ? 1 : -1) * spd * 0.7,
          });
        } else {
          const y = b.y + t * b.h;
          DODGE.bullets.push({
            img: 'board', size: 30, r: 13,
            x: fromStart ? b.x - 16 : b.x + b.w + 16, y,
            vx: (fromStart ? 1 : -1) * spd * 0.7, vy: 0,
          });
        }
      }
    }
  }

  function updateDodgeBullets() {
    const b = DBOX;
    let died = false;
    for (const bu of DODGE.bullets) {
      if (bu.gravity) bu.vy += 0.12;
      if (bu.spin) bu.angle = (bu.angle || 0) + bu.spin;
      bu.x += bu.vx;
      bu.y += bu.vy;
      if (bu.wave) {
        bu.wt = (bu.wt || 0) + bu.waveFreq;
        bu.y = bu.baseY + Math.sin(bu.wt) * bu.waveAmp;
      }
      if (bu.bounce) {
        if (bu.x < b.x + bu.r)       { bu.x = b.x + bu.r;       bu.vx =  Math.abs(bu.vx); }
        if (bu.x > b.x + b.w - bu.r) { bu.x = b.x + b.w - bu.r; bu.vx = -Math.abs(bu.vx); }
        if (bu.y < b.y + bu.r)       { bu.y = b.y + bu.r;       bu.vy =  Math.abs(bu.vy); }
        if (bu.y > b.y + b.h - bu.r) { bu.y = b.y + b.h - bu.r; bu.vy = -Math.abs(bu.vy); }
        bu.life = (bu.life || 600) - 1;
        if (bu.life <= 0) bu.dead = true;
      }
      if (DODGE.invincible <= 0 &&
          Math.hypot(bu.x - DODGE.heart.x, bu.y - DODGE.heart.y) < bu.r + 2) {
        DODGE.hp -= 1;
        DODGE.invincible = 48;
        AudioManager.play('hit');
        flashAlpha = 0.45; flashColor = '220,20,60';
        triggerShake(8, 5);
        triggerHitstop(60);
        if (DODGE.hp <= 0) died = true;
      }
    }
    if (DODGE.invincible > 0) DODGE.invincible--;

    const m = 120;
    DODGE.bullets = DODGE.bullets.filter(bu =>
      !bu.dead &&
      bu.x > b.x - m && bu.x < b.x + b.w + m &&
      bu.y > b.y - m && bu.y < b.y + b.h + m);

    if (died) endDodgeBattle('lose');
  }

  function drawDodgeHeart(cx, cy, color, blink) {
    if (blink && Math.floor(performance.now() / 80) % 2 === 0) return;
    const p = 2;
    const pixels = [
      [1,0],[2,0],[4,0],[5,0],
      [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],
      [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],
      [1,3],[2,3],[3,3],[4,3],[5,3],
      [2,4],[3,4],[4,4],
      [3,5],
    ];
    ctx.fillStyle = color || '#e61c3b';
    const ox = cx - 3 * p, oy = cy - 3 * p;
    pixels.forEach(([c, r]) => ctx.fillRect(ox + c * p, oy + r * p, p, p));
  }

  function renderDodgeBullets() {
    for (const bu of DODGE.bullets) {
      const im = bu.img ? PART_IMG[bu.img] : null;
      if (im && im.complete && im.naturalWidth) {
        const sz = bu.size || 30;
        ctx.save();
        ctx.translate(bu.x, bu.y);
        if (bu.angle) ctx.rotate(bu.angle);
        ctx.drawImage(im, -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      } else {
        ctx.fillStyle = bu.color || '#fff';
        ctx.beginPath();
        ctx.arc(bu.x, bu.y, bu.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 背景グリッド (敵領域 = バトル箱の上)
  function drawDodgeGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(60, 180, 60, 0.55)';
    ctx.lineWidth = 1.5;
    const top = 10, bottom = DBOX.y - 10;
    const stepX = (W - 20) / 4;
    const stepY = (bottom - top) / 3;
    for (let i = 0; i <= 4; i++) {
      const x = 10 + i * stepX;
      ctx.beginPath(); ctx.moveTo(x + 0.5, top); ctx.lineTo(x + 0.5, bottom); ctx.stroke();
    }
    for (let i = 0; i <= 3; i++) {
      const y = top + i * stepY;
      ctx.beginPath(); ctx.moveTo(10, y + 0.5); ctx.lineTo(W - 10, y + 0.5); ctx.stroke();
    }
    ctx.restore();
  }

  // Undertale風 LV/HP HUD (中央寄せ)
  function drawDodgeHud(left, y) {
    // 中央レイアウト: LV N    HP [bar]  N/N
    const cx = W / 2;
    const barW = 120, barH = 11;
    // 部品幅を測って中央寄せ
    pixelText('LV ' + DODGE.lv, cx - 150, y, 9, '#fff', 'left');
    pixelText('HP', cx - 78, y, 9, '#fff', 'left');
    const barX = cx - 50, barY = y - 1;
    ctx.fillStyle = '#7a0000'; ctx.fillRect(barX, barY, barW, barH);
    const fillW = Math.max(0, Math.round(barW * DODGE.hp / DODGE.maxHp));
    ctx.fillStyle = '#ffeb3b'; ctx.fillRect(barX, barY, fillW, barH);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW, barH);
    pixelText(DODGE.hp + ' / ' + DODGE.maxHp, barX + barW + 10, y, 9, '#fff', 'left');
    // ROUND / ITEM 残数 (左右端の補助情報)
    pixelText('ROUND ' + Math.max(1, DODGE.round), left + 8, y, 7, '#7cfc00', 'left');
    pixelText('ITEM x' + DODGE.itemsLeft, DBOX.x + DBOX.w - 8, y, 7, '#ff8c00', 'right');
  }

  function renderDodge() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const sh = getShakeOffset();
    ctx.save();
    ctx.translate(sh.x, sh.y);
    drawDodgeGrid();
    drawStars();

    // 相手(鏡の自分) - グリッド中央寄り上部
    const oppX = W / 2 + (DODGE.oppShake > 0 ? (Math.random() - 0.5) * 8 : 0);
    const oppColor = DODGE.realFormUsed ? '#ff6464' : (DODGE.oppFlash > 0 ? '#fff' : '#f0f0f0');
    drawDodgeHeart(oppX, 90, oppColor, false);
    const barW = 200, barX = W / 2 - barW / 2, barY = 130;
    pixelText(DODGE.realFormActive ? 'ENEMY!' : 'ENEMY', barX, barY - 12, 7,
              DODGE.realFormActive ? '#ff6464' : '#f0f0f0', 'left');
    ctx.fillStyle = '#333'; ctx.fillRect(barX, barY, barW, 8);
    ctx.fillStyle = DODGE.realFormActive ? '#ff5252' : '#f0f0f0';
    ctx.fillRect(barX, barY, barW * (DODGE.oppHp / DODGE.oppHpMax), 8);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(barX + 0.5, barY + 0.5, barW, 8);

    // バトルボックス
    const b = DBOX;
    ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(b.x, b.y, b.w, b.h);

    if (DODGE.battlePhase === 'enemy') {
      renderDodgeBullets();
      drawDodgeHeart(DODGE.heart.x, DODGE.heart.y, '#e61c3b', DODGE.invincible > 0);
    } else if (DODGE.battlePhase === 'player' || DODGE.battlePhase === 'intro') {
      drawDodgeHeart(DODGE.heart.x, DODGE.heart.y, '#e61c3b', false);
    }

    // 自分のLV / HP (Undertale風)
    drawDodgeHud(b.x, b.y + b.h + 12);

    // FIGHT バー
    if (DODGE.battlePhase === 'player' && DODGE.fight.active) {
      const gy = b.y + b.h + 38, gx = b.x + 10, gw = b.w - 20;
      ctx.fillStyle = '#222'; ctx.fillRect(gx, gy, gw, 12);
      const center = b.x + b.w / 2, sw = gw * 0.08;
      ctx.fillStyle = '#ffeb3b'; ctx.fillRect(center - sw, gy, sw * 2, 12);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, gw, 12);
      ctx.fillStyle = '#fff'; ctx.fillRect(DODGE.fight.markerX - 1, gy - 3, 3, 18);
      pixelText('TAP / SPACE!', b.x + b.w / 2, gy + 16, 7, '#ffeb3b', 'center');
    }

    // メッセージ
    if (DODGE.msg && performance.now() < DODGE.msgUntil) {
      pixelText(DODGE.msg, W / 2, b.y - 34, 10, '#fff', 'center');
    }

    ctx.restore();

    if (flashAlpha > 0) {
      ctx.fillStyle = `rgba(${flashColor},${flashAlpha})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawBorder();
  }

  function endDodgeBattle(outcome) {
    if (!DODGE.active) return;
    DODGE.active = false;
    DODGE.outcome = outcome;
    DODGE.battlePhase = outcome;
    DODGE.bullets = [];
    syncDodgeUI();
    AudioManager.stopBgm();
    if (outcome === 'win') {
      AudioManager.play('super');
      flashAlpha = 0.5; flashColor = '255,255,255';
      setDodgeMsg('* …今日のお前には、敵わないな。\n  認めてやる。', 2000);
    } else {
      AudioManager.play('miss');
      setDodgeMsg('* まだ終わりじゃない。\n  立ち上がれ。', 2000);
    }
    setTimeout(showDodgeResult, 1200);
  }

  function showDodgeResult() {
    const win = DODGE.outcome === 'win';
    const outEl = document.getElementById('dodge-res-outcome');
    const storyPrefix = (storyMode && win) ? '★ STORY CLEAR ★ ' : '';
    outEl.textContent = storyPrefix + (win ? 'YOU WIN' : 'YOU LOSE');
    outEl.style.color = win ? '#7cfc00' : '#ff5252';
    if (storyMode && win) localStorage.setItem('mhsc_story_clear', '1');
    document.getElementById('dodge-res-rounds').textContent = String(Math.max(1, DODGE.round));

    const stars = Math.round(DODGE.difficulty * 5);
    document.getElementById('dodge-res-diff').textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);

    let isNew = false;
    if (win) {
      const prev = parseInt(localStorage.getItem('mhsc_dodge_best') || '0', 10);
      if (prev === 0 || DODGE.round < prev) {
        localStorage.setItem('mhsc_dodge_best', String(DODGE.round));
        isNew = true;
      }
    }
    document.getElementById('dodge-new-record').style.display = isNew ? 'block' : 'none';

    AudioManager.playFileBgm('DANDAN.m4a', 0.55);
    switchScreen(STATE.DODGE_RESULT);
  }

  // ===== 起動 =====
  switchScreen(STATE.TITLE);
  requestAnimationFrame(loopRaf);
  // rAFが止まる(非表示タブ等)場合の保険
  setInterval(loopOnce, 50);
})();
