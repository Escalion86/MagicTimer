/* ============================================================
   Magic Timer — Main Application (Samsung One UI Style)
   ============================================================ */

// === STATE ===
const state = {
  running: false,
  paused: false,
  startTime: 0,
  elapsed: 0,
  animFrameId: null,
  lapIndex: 0,           // which fake-ms value to use next
  laps: [],              // [{real, faked, display}]

  settings: {
    fakeMs: [40, 3, 21],
    displayMode: 'faked',
  },
};

// === DOM REFS ===
const $ = id => document.getElementById(id);
const dom = {
  minutes:      $('timerMinutes'),
  seconds:      $('timerSeconds'),
  centiseconds: $('timerCentiseconds'),
  btnPrimary:   $('btnPrimary'),
  btnSecondary: $('btnSecondary'),
  settingsBtn:  $('settingsBtn'),
  settingsModal: $('settingsModal'),
  closeSettings: $('closeSettings'),
  msList:       $('msList'),
  newMsValue:   $('newMsValue'),
  addMsValue:   $('addMsValue'),
  lapsList:     $('lapsList'),
  displayMode:  $('displayMode'),
  resetAll:     $('resetAll'),
};

// === LOAD / SAVE SETTINGS ===
function loadSettings() {
  try {
    const raw = localStorage.getItem('magicTimer_settings');
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(state.settings, saved);
    }
  } catch (e) { /* ignore */ }
  renderMsList();
  dom.displayMode.value = state.settings.displayMode;
}

function saveSettings() {
  localStorage.setItem('magicTimer_settings', JSON.stringify(state.settings));
}

// === TIMER ENGINE ===
function formatTime(ms) {
  const totalCs = Math.floor(ms / 10);
  const centis = totalCs % 100;
  const totalSecs = Math.floor(totalCs / 100);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60);
  return {
    minutes: String(mins).padStart(2, '0'),
    seconds: String(secs).padStart(2, '0'),
    centiseconds: String(centis).padStart(2, '0'),
    raw: { mins, secs, centis, ms },
  };
}

function getElapsed() {
  return state.running
    ? (performance.now() - state.startTime + state.elapsed)
    : state.elapsed;
}

function updateDisplay() {
  const elapsed = getElapsed();
  const t = formatTime(elapsed);

  dom.minutes.textContent = t.minutes;
  dom.seconds.textContent = t.seconds;
  dom.centiseconds.textContent = t.centiseconds;

  if (!state.running) return;
  state.animFrameId = requestAnimationFrame(updateDisplay);
}

// === FAKE MILLISECONDS ===
function getNextFakeMs() {
  const list = state.settings.fakeMs;
  if (!list || list.length === 0) return 0;
  const value = list[state.lapIndex % list.length];
  state.lapIndex++;
  return value;
}

// === UI STATE MACHINE — Samsung logic ===
/*
  idle:     btnPrimary="Старт"(green), btnSecondary="Круг"(disabled)
  running:  btnPrimary="Стоп"(red),    btnSecondary="Круг"(active, white)
  paused:   btnPrimary="Продолжить"(green), btnSecondary="Сброс"(red border)
*/

function setUI_Idle() {
  dom.btnPrimary.className = 'ctrl-primary start';
  dom.btnPrimary.textContent = 'Старт';
  dom.btnSecondary.className = 'ctrl-secondary lap';
  dom.btnSecondary.textContent = 'Круг';
  dom.btnSecondary.disabled = true;
}

function setUI_Running() {
  dom.btnPrimary.className = 'ctrl-primary stop';
  dom.btnPrimary.textContent = 'Стоп';
  dom.btnSecondary.className = 'ctrl-secondary lap';
  dom.btnSecondary.textContent = 'Круг';
  dom.btnSecondary.disabled = false;
}

function setUI_Paused() {
  dom.btnPrimary.className = 'ctrl-primary start';
  dom.btnPrimary.textContent = 'Продолжить';
  dom.btnSecondary.className = 'ctrl-secondary reset';
  dom.btnSecondary.textContent = 'Сброс';
  dom.btnSecondary.disabled = false;
}

// === CORE ACTIONS ===
function startTimer() {
  if (state.running) return;

  state.running = true;
  state.paused = false;
  state.startTime = performance.now();

  setUI_Running();
  updateDisplay();
}

function stopTimer() {
  if (!state.running) return;

  state.running = false;
  state.elapsed += performance.now() - state.startTime;
  state.paused = true;
  cancelAnimationFrame(state.animFrameId);

  // Apply fake milliseconds on stop (magic trick)
  const fakeVal = getNextFakeMs();
  const fakeMsStr = String(fakeVal).padStart(2, '0');
  dom.centiseconds.textContent = fakeMsStr;

  setUI_Paused();
}

function continueTimer() {
  if (state.running || !state.paused) return;

  state.running = true;
  state.paused = false;
  state.startTime = performance.now();

  setUI_Running();
  updateDisplay();
}

function resetTimer() {
  state.running = false;
  state.paused = false;
  state.elapsed = 0;
  state.lapIndex = 0;
  state.laps = [];
  cancelAnimationFrame(state.animFrameId);

  dom.minutes.textContent = '00';
  dom.seconds.textContent = '00';
  dom.centiseconds.textContent = '00';

  setUI_Idle();
  renderLaps();
}

// === LAP ===
function recordLap() {
  if (!state.running) return;

  const elapsed = performance.now() - state.startTime + state.elapsed;
  const real = formatTime(elapsed);
  const fakeVal = getNextFakeMs();
  const fakeMsStr = String(fakeVal).padStart(2, '0');
  const fakedDisplay = `${real.minutes}:${real.seconds},${fakeMsStr}`;

  const entry = {
    real: `${real.minutes}:${real.seconds},${real.centiseconds}`,
    faked: fakedDisplay,
    fakeMs: fakeVal,
    index: state.laps.length + 1,
  };

  state.laps.push(entry);
  renderLaps();

  // Flash the centiseconds display to show the magic
  dom.centiseconds.style.color = '#ff9f0a';
  setTimeout(() => { dom.centiseconds.style.color = ''; }, 250);

  // Brief haptic-style visual feedback
  dom.btnSecondary.style.transform = 'scale(0.88)';
  setTimeout(() => { dom.btnSecondary.style.transform = ''; }, 100);
}

// === RENDER LAPS ===
function renderLaps() {
  const list = dom.lapsList;

  if (state.laps.length === 0) {
    list.innerHTML = '<div class="empty-laps">Нажмите «Круг» для записи замера</div>';
    return;
  }

  list.innerHTML = '';
  // Reverse order — newest at top (Samsung style)
  for (let i = state.laps.length - 1; i >= 0; i--) {
    const lap = state.laps[i];
    const li = document.createElement('li');
    li.className = 'lap-item';

    let timeHtml;
    const mode = state.settings.displayMode;

    if (mode === 'faked') {
      timeHtml = lap.faked;
    } else if (mode === 'real') {
      timeHtml = lap.real;
    } else {
      timeHtml = `${lap.faked} <span class="lap-real">(${lap.real})</span>`;
    }

    li.innerHTML = `
      <span class="lap-index">Круг ${lap.index}</span>
      <span class="lap-time">${timeHtml}</span>
    `;
    list.appendChild(li);
  }
}

// === SETTINGS UI ===
function renderMsList() {
  dom.msList.innerHTML = '';
  const list = state.settings.fakeMs;
  for (let i = 0; i < list.length; i++) {
    const chip = document.createElement('li');
    chip.className = 'ms-chip';
    chip.innerHTML = `
      <span class="index-badge">#${i + 1}</span>
      ${String(list[i]).padStart(2, '0')}
      <button class="remove-chip" data-index="${i}">✕</button>
    `;
    chip.querySelector('.remove-chip').addEventListener('click', () => {
      list.splice(i, 1);
      saveSettings();
      renderMsList();
    });
    dom.msList.appendChild(chip);
  }
  saveSettings();
}

// === EVENTS ===

// Primary button: Start / Stop / Continue
dom.btnPrimary.addEventListener('click', () => {
  if (state.running) {
    stopTimer();
  } else if (state.paused) {
    continueTimer();
  } else {
    startTimer();
  }
});

// Secondary button: Lap / Reset
dom.btnSecondary.addEventListener('click', () => {
  if (state.running) {
    // Lap mode
    recordLap();
  } else if (state.paused) {
    // Reset mode
    resetTimer();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (state.running) stopTimer();
      else if (state.paused) continueTimer();
      else startTimer();
      break;
    case 'l':
    case 'L':
      if (state.running) recordLap();
      break;
    case 'r':
    case 'R':
      if (state.paused) resetTimer();
      break;
    case 'Escape':
      dom.settingsModal.classList.add('hidden');
      break;
  }
});

// Settings
dom.settingsBtn.addEventListener('click', () => {
  renderMsList();
  dom.settingsModal.classList.remove('hidden');
});

dom.closeSettings.addEventListener('click', () => {
  dom.settingsModal.classList.add('hidden');
});

dom.settingsModal.addEventListener('click', (e) => {
  if (e.target === dom.settingsModal) {
    dom.settingsModal.classList.add('hidden');
  }
});

// Add ms value
dom.addMsValue.addEventListener('click', () => {
  const val = parseInt(dom.newMsValue.value, 10);
  if (isNaN(val) || val < 0 || val > 99) {
    dom.newMsValue.focus();
    return;
  }
  state.settings.fakeMs.push(val);
  saveSettings();
  renderMsList();
  dom.newMsValue.value = '0';
});

dom.newMsValue.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.addMsValue.click();
});

// Presets
document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const vals = btn.dataset.values.split(',').map(Number);
    state.settings.fakeMs = vals;
    saveSettings();
    renderMsList();
  });
});

// Display mode
dom.displayMode.addEventListener('change', () => {
  state.settings.displayMode = dom.displayMode.value;
  saveSettings();
  renderLaps();
});

// Reset all
dom.resetAll.addEventListener('click', () => {
  if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
    state.settings = {
      fakeMs: [40, 3, 21],
      displayMode: 'faked',
    };
    saveSettings();
    renderMsList();
    dom.displayMode.value = 'faked';
    state.laps = [];
    state.lapIndex = 0;
    renderLaps();
  }
});

// === PWA: Register Service Worker ===
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// === INIT ===
loadSettings();
setUI_Idle();
renderLaps();

// Handle visibility change
document.addEventListener('visibilitychange', () => {
  if (state.running && document.hidden) {
    state.startTime = performance.now();
  }
});
