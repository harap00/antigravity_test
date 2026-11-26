(() => {
  'use strict';

  const HANDS = {
    rock: { name: 'グー', emoji: '✊' },
    scissors: { name: 'チョキ', emoji: '✌️' },
    paper: { name: 'パー', emoji: '🖐️' }
  };

  const HAND_KEYS = Object.keys(HANDS);

  const BEATS = {
    rock: 'scissors',
    scissors: 'paper',
    paper: 'rock'
  };

  const MODE_TARGETS = {
    free: Infinity,
    bo3: 2,
    bo5: 3
  };

  const state = {
    mode: 'free',
    soundEnabled: true,
    isAnimating: false,
    wasDraw: false,
    matchPlayerWins: 0,
    matchCpuWins: 0,
    matchFinished: false,
    wins: 0,
    losses: 0,
    draws: 0,
    streak: 0,
    bestStreak: 0,
    rounds: 0,
    history: []
  };

  // DOM要素
  const el = {
    soundToggle: document.getElementById('sound-toggle'),
    soundIcon: document.getElementById('sound-icon'),
    soundLabel: document.getElementById('sound-label'),
    resetBtn: document.getElementById('reset-btn'),
    modeButtons: document.querySelectorAll('.mode-btn'),
    matchBanner: document.getElementById('match-banner'),
    matchPlayerWins: document.getElementById('match-player-wins'),
    matchCpuWins: document.getElementById('match-cpu-wins'),
    matchGoalText: document.getElementById('match-goal-text'),
    matchStatusText: document.getElementById('match-status-text'),
    playerHandBox: document.getElementById('player-hand-box'),
    playerHandEmoji: document.getElementById('player-hand-emoji'),
    playerHandName: document.getElementById('player-hand-name'),
    cpuHandBox: document.getElementById('cpu-hand-box'),
    cpuHandEmoji: document.getElementById('cpu-hand-emoji'),
    cpuHandName: document.getElementById('cpu-hand-name'),
    callText: document.getElementById('call-text'),
    resultBanner: document.getElementById('result-banner'),
    resultTitle: document.getElementById('result-title'),
    resultDetail: document.getElementById('result-detail'),
    rematchWrap: document.getElementById('rematch-wrap'),
    rematchBtn: document.getElementById('rematch-btn'),
    choiceButtons: document.querySelectorAll('.choice-btn'),
    statWins: document.getElementById('stat-wins'),
    statLosses: document.getElementById('stat-losses'),
    statDraws: document.getElementById('stat-draws'),
    statRate: document.getElementById('stat-rate'),
    statStreak: document.getElementById('stat-streak'),
    statBestStreak: document.getElementById('stat-best-streak'),
    roundCount: document.getElementById('round-count'),
    historyList: document.getElementById('history-list')
  };

  let audioCtx = null;

  function playTone(frequencies, duration = 0.09) {
    if (!state.soundEnabled) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    frequencies.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.08, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + duration);
    });
  }

  function judgeRound(playerHand, cpuHand) {
    if (playerHand === cpuHand) return 'draw';
    return BEATS[playerHand] === cpuHand ? 'win' : 'lose';
  }

  function randomCpuHand() {
    const index = Math.floor(Math.random() * HAND_KEYS.length);
    return HAND_KEYS[index];
  }

  function setChoicesEnabled(enabled) {
    el.choiceButtons.forEach((btn) => {
      btn.disabled = !enabled;
    });
  }

  function updateHandVisuals(playerHand, cpuHand, outcome) {
    el.playerHandBox.classList.remove('win', 'lose', 'draw');
    el.cpuHandBox.classList.remove('win', 'lose', 'draw');

    if (playerHand) {
      el.playerHandEmoji.textContent = HANDS[playerHand].emoji;
      el.playerHandName.textContent = HANDS[playerHand].name;
    } else {
      el.playerHandEmoji.textContent = '❔';
      el.playerHandName.textContent = '手を選んでね';
    }

    if (cpuHand) {
      el.cpuHandEmoji.textContent = HANDS[cpuHand].emoji;
      el.cpuHandName.textContent = HANDS[cpuHand].name;
    } else {
      el.cpuHandEmoji.textContent = '🤖';
      el.cpuHandName.textContent = '待機中';
    }

    if (outcome === 'win') {
      el.playerHandBox.classList.add('win');
      el.cpuHandBox.classList.add('lose');
    } else if (outcome === 'lose') {
      el.playerHandBox.classList.add('lose');
      el.cpuHandBox.classList.add('win');
    } else if (outcome === 'draw') {
      el.playerHandBox.classList.add('draw');
      el.cpuHandBox.classList.add('draw');
    }
  }

  function updateResultBanner(outcome, playerHand, cpuHand) {
    el.resultBanner.classList.remove('neutral', 'win', 'lose', 'draw');

    if (!outcome) {
      el.resultBanner.classList.add('neutral');
      el.resultTitle.textContent = '下の手から選んでスタート！';
      el.resultDetail.textContent = 'キーボード（1: グー / 2: チョキ / 3: パー）でも操作できます';
      return;
    }

    const pairText = `あなた「${HANDS[playerHand].name}」 vs CPU「${HANDS[cpuHand].name}」`;

    if (state.matchFinished) {
      if (outcome === 'win') {
        el.resultBanner.classList.add('win');
        el.resultTitle.textContent = '🏆 マッチ勝利！おめでとうございます！';
        el.resultDetail.textContent = `${pairText}（${state.matchPlayerWins} - ${state.matchCpuWins}）`;
      } else {
        el.resultBanner.classList.add('lose');
        el.resultTitle.textContent = '💥 マッチ敗北…次はリベンジ！';
        el.resultDetail.textContent = `${pairText}（${state.matchPlayerWins} - ${state.matchCpuWins}）`;
      }
      return;
    }

    if (outcome === 'win') {
      el.resultBanner.classList.add('win');
      const streakMsg = state.streak >= 2 ? `（🔥 ${state.streak}連勝中！）` : '';
      el.resultTitle.textContent = `あなたの勝ち！${streakMsg}`;
      el.resultDetail.textContent = pairText;
    } else if (outcome === 'lose') {
      el.resultBanner.classList.add('lose');
      el.resultTitle.textContent = 'あなたの負け…';
      el.resultDetail.textContent = pairText;
    } else {
      el.resultBanner.classList.add('draw');
      el.resultTitle.textContent = 'あいこ！もう一回！';
      el.resultDetail.textContent = `${pairText} — 次は「あいこで…」で勝負！`;
    }
  }

  function renderMatchBanner() {
    if (state.mode === 'free') {
      el.matchBanner.classList.add('hidden');
      return;
    }
    el.matchBanner.classList.remove('hidden');
    el.matchPlayerWins.textContent = String(state.matchPlayerWins);
    el.matchCpuWins.textContent = String(state.matchCpuWins);
    el.matchGoalText.textContent = `${MODE_TARGETS[state.mode]}勝先取`;

    if (state.matchFinished) {
      el.matchStatusText.textContent = state.matchPlayerWins > state.matchCpuWins ? 'あなたの優勝' : 'CPUの優勝';
    } else {
      el.matchStatusText.textContent = '対戦中';
    }
  }

  function renderStats() {
    el.statWins.textContent = String(state.wins);
    el.statLosses.textContent = String(state.losses);
    el.statDraws.textContent = String(state.draws);

    const decided = state.wins + state.losses;
    const rate = decided === 0 ? 0 : Math.round((state.wins / decided) * 100);
    el.statRate.textContent = `${rate}%`;
    el.statStreak.textContent = String(state.streak);
    el.statBestStreak.textContent = String(state.bestStreak);
    el.roundCount.textContent = `全 ${state.rounds} 戦`;
  }

  function renderHistory() {
    el.historyList.innerHTML = '';
    if (state.history.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'history-empty';
      emptyLi.textContent = 'まだ対戦履歴がありません。';
      el.historyList.appendChild(emptyLi);
      return;
    }

    const labelMap = { win: '勝ち', lose: '負け', draw: 'あいこ' };

    state.history.slice(0, 15).forEach((item) => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const roundSpan = document.createElement('span');
      roundSpan.className = 'history-round';
      roundSpan.textContent = `#${item.round}`;

      const handsSpan = document.createElement('span');
      handsSpan.className = 'history-hands';
      handsSpan.textContent = `${HANDS[item.player].emoji} ${HANDS[item.player].name} vs ${HANDS[item.cpu].emoji} ${HANDS[item.cpu].name}`;

      const badgeSpan = document.createElement('span');
      badgeSpan.className = `history-badge ${item.outcome}`;
      badgeSpan.textContent = labelMap[item.outcome];

      li.append(roundSpan, handsSpan, badgeSpan);
      el.historyList.appendChild(li);
    });
  }

  function startNewMatch() {
    state.matchPlayerWins = 0;
    state.matchCpuWins = 0;
    state.matchFinished = false;
    state.wasDraw = false;
    el.callText.textContent = 'じゃんけん…';
    el.rematchWrap.classList.add('hidden');
    updateHandVisuals(null, null, null);
    updateResultBanner(null, null, null);
    renderMatchBanner();
    setChoicesEnabled(true);
  }

  function resetAll() {
    if (state.isAnimating) return;
    state.wins = 0;
    state.losses = 0;
    state.draws = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.rounds = 0;
    state.history = [];
    startNewMatch();
    renderStats();
    renderHistory();
  }

  function playRound(playerHand) {
    if (state.isAnimating || state.matchFinished) return;

    state.isAnimating = true;
    setChoicesEnabled(false);

    const isAiko = state.wasDraw;
    el.callText.textContent = isAiko ? 'あいこで…' : 'じゃんけん…';
    updateHandVisuals(playerHand, null, null);
    el.cpuHandEmoji.textContent = '✊';
    el.cpuHandName.textContent = '構え中…';

    el.playerHandBox.classList.add('shake');
    el.cpuHandBox.classList.add('shake');
    playTone([440], 0.06);

    window.setTimeout(() => {
      el.playerHandBox.classList.remove('shake');
      el.cpuHandBox.classList.remove('shake');

      const cpuHand = randomCpuHand();
      const outcome = judgeRound(playerHand, cpuHand);

      el.callText.textContent = isAiko ? 'しょ！' : 'ぽん！';
      state.rounds += 1;

      if (outcome === 'win') {
        state.wins += 1;
        state.streak += 1;
        state.bestStreak = Math.max(state.bestStreak, state.streak);
        state.wasDraw = false;
        if (state.mode !== 'free') state.matchPlayerWins += 1;
        playTone([523.25, 659.25, 783.99], 0.12);
      } else if (outcome === 'lose') {
        state.losses += 1;
        state.streak = 0;
        state.wasDraw = false;
        if (state.mode !== 'free') state.matchCpuWins += 1;
        playTone([349.23, 277.18], 0.14);
      } else {
        state.draws += 1;
        state.wasDraw = true;
        playTone([440, 440], 0.08);
      }

      const target = MODE_TARGETS[state.mode];
      if (state.mode !== 'free' && (state.matchPlayerWins >= target || state.matchCpuWins >= target)) {
        state.matchFinished = true;
        el.rematchWrap.classList.remove('hidden');
      }

      state.history.unshift({
        round: state.rounds,
        player: playerHand,
        cpu: cpuHand,
        outcome
      });

      updateHandVisuals(playerHand, cpuHand, outcome);
      updateResultBanner(outcome, playerHand, cpuHand);
      renderMatchBanner();
      renderStats();
      renderHistory();

      state.isAnimating = false;
      setChoicesEnabled(!state.matchFinished);
    }, 360);
  }

  // イベント登録
  el.choiceButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      playRound(btn.dataset.hand);
    });
  });

  el.modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.isAnimating) return;
      const nextMode = btn.dataset.mode;
      if (nextMode === state.mode) return;

      state.mode = nextMode;
      el.modeButtons.forEach((b) => b.classList.toggle('active', b.dataset.mode === nextMode));
      startNewMatch();
    });
  });

  el.rematchBtn.addEventListener('click', () => {
    startNewMatch();
  });

  el.resetBtn.addEventListener('click', () => {
    resetAll();
  });

  el.soundToggle.addEventListener('click', () => {
    state.soundEnabled = !state.soundEnabled;
    el.soundToggle.setAttribute('aria-pressed', String(state.soundEnabled));
    el.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    el.soundLabel.textContent = state.soundEnabled ? '効果音 ON' : '効果音 OFF';
  });

  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === '1' || key === 'g') {
      playRound('rock');
    } else if (key === '2' || key === 'c') {
      playRound('scissors');
    } else if (key === '3' || key === 'p') {
      playRound('paper');
    } else if (key === 'r') {
      resetAll();
    }
  });

  // 初期描画
  renderMatchBanner();
  renderStats();
  renderHistory();
})();
