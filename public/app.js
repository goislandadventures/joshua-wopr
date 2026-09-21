const terminal = document.querySelector('#terminal');
const form = document.querySelector('#command-form');
const input = document.querySelector('#command');
const promptEl = document.querySelector('#prompt');
const simPanel = document.querySelector('#sim-panel');
const scenarioEl = document.querySelector('#scenario');
const outcomeEl = document.querySelector('#outcome');
const trajectories = document.querySelector('#trajectories');
const impacts = document.querySelector('#impacts');
const targetLabels = document.querySelector('#target-labels');
const gtwSideView = document.querySelector('#gtw-side-view');
const gtwMapView = document.querySelector('#gtw-map-view');
const tttPanel = document.querySelector('#ttt-panel');
const tttBoardEl = document.querySelector('#ttt-board');
const tttStatusEl = document.querySelector('#ttt-status');
const voiceSwitch = document.querySelector('#voice-switch');
const voiceStateEl = document.querySelector('#voice-state');
const visitCountEl = document.querySelector('#visit-count');

const state = {
  busy: false,
  mode: 'boot',
  falkenStage: 0,
  aiAvailable: null,
  conversation: [],
  simulationRun: 0,
  gtwSide: null,
  gtwTargets: [],
  tttPlayers: null,
  tttBoard: Array(9).fill(''),
  tttTurn: 'X',
  tttGameCount: 0,
  tttDrawCount: 0,
  audioArmed: false,
  audioContext: null,
  terminalOscillator: null,
  terminalGain: null,
  terminalFilter: null,
  voiceEnabled: false,
  currentVoiceAudio: null,
  currentVoiceUrl: null,
  voiceCache: new Map(),
};

const games = [
  "FALKEN'S MAZE",
  'BLACK JACK',
  'GIN RUMMY',
  'HEARTS',
  'BRIDGE',
  'CHECKERS',
  'CHESS',
  'POKER',
  'FIGHTER COMBAT',
  'GUERRILLA ENGAGEMENT',
  'DESERT WARFARE',
  'AIR-TO-GROUND ACTIONS',
  'THEATERWIDE TACTICAL WARFARE',
  'THEATERWIDE BIOTOXIC AND CHEMICAL WARFARE',
  'GLOBAL THERMONUCLEAR WAR',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const coarsePointer = window.matchMedia?.('(pointer: coarse)');

function isMobileTerminal() {
  return Boolean(coarsePointer?.matches || window.innerWidth <= 820);
}

function focusTerminalInput() {
  try {
    input.focus({ preventScroll: true });
  } catch (_) {
    input.focus();
  }
}

async function registerVisit() {
  if (!visitCountEl) return;

  try {
    const response = await fetch('/api/visit', {
      method: 'POST',
      cache: 'no-store',
      keepalive: true,
    });

    if (!response.ok) throw new Error('VISIT COUNTER HTTP ' + response.status);

    const data = await response.json();
    const count = Number(data?.count);

    if (!Number.isFinite(count) || count < 0) throw new Error('INVALID VISIT COUNT');

    visitCountEl.textContent = String(Math.trunc(count)).padStart(6, '0');
  } catch (error) {
    visitCountEl.textContent = '------';
    console.error('VISIT COUNTER:', error?.message || error);
  }
}

function normalize(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function ensureTerminalAudioGraph() {
  const ctx = state.audioContext;
  if (!ctx || ctx.state === 'closed') return false;

  if (
    state.terminalOscillator &&
    state.terminalGain &&
    state.terminalFilter
  ) {
    return true;
  }

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(820, ctx.currentTime);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1020, ctx.currentTime);
    filter.Q.setValueAtTime(1.35, ctx.currentTime);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    state.terminalOscillator = osc;
    state.terminalGain = gain;
    state.terminalFilter = filter;
    return true;
  } catch (_) {
    state.terminalOscillator = null;
    state.terminalGain = null;
    state.terminalFilter = null;
    return false;
  }
}

async function unlockAudio() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      state.audioArmed = false;
      return false;
    }

    if (!state.audioContext || state.audioContext.state === 'closed') {
      state.audioContext = new AudioCtx({ latencyHint: 'interactive' });
      state.terminalOscillator = null;
      state.terminalGain = null;
      state.terminalFilter = null;
    }

    if (state.audioContext.state === 'suspended') {
      await state.audioContext.resume();
    }

    state.audioArmed = state.audioContext.state === 'running';

    if (state.audioArmed) {
      ensureTerminalAudioGraph();
    }

    return state.audioArmed;
  } catch (_) {
    state.audioArmed = false;
    return false;
  }
}

function terminalTone() {
  const ctx = state.audioContext;
  if (!ctx || ctx.state !== 'running') return;
  if (!ensureTerminalAudioGraph()) return;

  try {
    const now = ctx.currentTime;
    const gain = state.terminalGain.gain;
    const osc = state.terminalOscillator;
    const filter = state.terminalFilter;

    // Persistent oscillator, pulsed for every single emitted character.
    // Slight frequency movement keeps the WarGames-style chatter from
    // sounding like a static modern key click.
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(0.0001, now);
    gain.linearRampToValueAtTime(0.034, now + 0.0015);
    gain.exponentialRampToValueAtTime(0.0001, now + 0.020);

    osc.frequency.cancelScheduledValues(now);
    osc.frequency.setValueAtTime(845, now);
    osc.frequency.exponentialRampToValueAtTime(735, now + 0.014);

    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setValueAtTime(1060, now);
    filter.frequency.exponentialRampToValueAtTime(920, now + 0.016);
  } catch (_) {}
}

function playConnectChirp(step = 0) {
  const ctx = state.audioContext;
  if (!ctx || ctx.state !== 'running') return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    const tones = [1480, 980, 1260, 760];
    const freq = tones[step % tones.length];

    osc.type = step % 2 === 0 ? 'square' : 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.72, now + 0.055);

    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.6;

    gain.gain.setValueAtTime(0.028, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.070);
  } catch (_) {}
}

function playTTTMoveTone(mark, intensity = 1) {
  const play = async () => {
    await unlockAudio();
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const master = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const lowShelf = ctx.createBiquadFilter();

    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 220;
    lowShelf.gain.value = 7.5;

    compressor.threshold.value = -24;
    compressor.knee.value = 4;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.14;

    master.gain.setValueAtTime(Math.min(0.34, 0.19 + intensity * 0.045), now);

    lowShelf.connect(compressor);
    compressor.connect(master);
    master.connect(ctx.destination);

    const fundamental = mark === 'X' ? 190 : 164;
    const endFreq = mark === 'X' ? 174 : 149;
    const duration = mark === 'X' ? 0.180 : 0.195;

    // Main low "donk" — intentionally Windows-error-like and ominous.
    const main = ctx.createOscillator();
    const mainGain = ctx.createGain();
    main.type = 'sine';
    main.frequency.setValueAtTime(fundamental, now);
    main.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    mainGain.gain.setValueAtTime(0.0001, now);
    mainGain.gain.linearRampToValueAtTime(1.0, now + 0.006);
    mainGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    main.connect(mainGain);
    mainGain.connect(lowShelf);

    // Sub layer adds the bass weight without making the notes indistinguishable.
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(fundamental * 0.5, now);
    sub.frequency.exponentialRampToValueAtTime(endFreq * 0.5, now + duration * 0.92);
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.42, now + 0.008);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.92);
    sub.connect(subGain);
    subGain.connect(lowShelf);

    // Quiet upper partial keeps small speakers from losing the pitch difference.
    const partial = ctx.createOscillator();
    const partialGain = ctx.createGain();
    partial.type = 'triangle';
    partial.frequency.setValueAtTime(fundamental * 2.0, now);
    partial.frequency.exponentialRampToValueAtTime(endFreq * 2.0, now + duration * 0.72);
    partialGain.gain.setValueAtTime(0.0001, now);
    partialGain.gain.linearRampToValueAtTime(0.16, now + 0.004);
    partialGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.72);
    partial.connect(partialGain);
    partialGain.connect(lowShelf);

    main.start(now);
    sub.start(now);
    partial.start(now);
    main.stop(now + duration + 0.02);
    sub.stop(now + duration + 0.02);
    partial.stop(now + duration + 0.02);
  };

  void play();
}
async function fetchVoiceUrl(text) {
  const key = text.trim().toUpperCase();
  if (!key) return null;
  if (state.voiceCache.has(key)) return state.voiceCache.get(key);

  const response = await fetch('/api/voice', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) throw new Error('Voice unavailable');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  state.voiceCache.set(key, url);
  return url;
}

async function speakJoshua(text) {
  if (!state.voiceEnabled || !text.trim()) return;

  try {
    const url = await fetchVoiceUrl(text);
    if (!state.voiceEnabled || !url) return;

    if (state.currentVoiceAudio) {
      state.currentVoiceAudio.pause();
      state.currentVoiceAudio.currentTime = 0;
    }

    const audio = new Audio(url);
    state.currentVoiceAudio = audio;
    state.currentVoiceUrl = url;
    await audio.play().catch(() => {});
  } catch (_) {}
}

function stopJoshuaVoice() {
  if (!state.currentVoiceAudio) return;
  try {
    state.currentVoiceAudio.pause();
    state.currentVoiceAudio.currentTime = 0;
  } catch (_) {}
  state.currentVoiceAudio = null;
}

function setVoiceEnabled(enabled) {
  state.voiceEnabled = Boolean(enabled);
  voiceSwitch?.setAttribute('aria-checked', String(state.voiceEnabled));
  voiceSwitch?.setAttribute('aria-label', state.voiceEnabled ? 'Turn JOSHUA voice off' : 'Turn JOSHUA voice on');
  if (voiceStateEl) voiceStateEl.textContent = state.voiceEnabled ? 'VOICE ON' : 'VOICE OFF';
  if (!state.voiceEnabled) stopJoshuaVoice();
}

async function typeJoshuaLine(text = '', speed = 32, className = '') {
  if (state.voiceEnabled) void speakJoshua(text);
  return typeLine(text, speed, className);
}

function setPrompt(text) {
  promptEl.textContent = text;
}

async function typePrompt(text = '', speed = 34) {
  // Rendering must never wait for browser audio permission.
  void unlockAudio();

  const mobile = isMobileTerminal();
  const inputWrap = form.querySelector('.input-wrap');

  form.classList.remove('hidden');
  input.value = '';
  resizeInput();

  // Desktop can temporarily disable/hide the field while the prompt types.
  // Mobile must keep the same focused input alive or the OS keyboard collapses.
  if (!mobile) {
    input.disabled = true;
    if (inputWrap) inputWrap.style.visibility = 'hidden';
  } else {
    input.disabled = false;
    if (inputWrap) inputWrap.style.visibility = '';
  }

  promptEl.textContent = '';

  for (const char of text) {
    promptEl.textContent += char;
    terminalTone();
    await sleep(speed + Math.random() * 10);
  }

  if (inputWrap) inputWrap.style.visibility = '';
  input.disabled = false;
  resizeInput();

  requestAnimationFrame(() => focusTerminalInput());
}
async function presentLogonPrompt(mode = 'logon') {
  clearTerminal();
  state.mode = mode;
  await typePrompt('LOGON:', 34);
}

function resizeInput() {
  const chars = Math.max(1, Math.min(48, input.value.length + 1));
  input.style.width = chars + 'ch';
}

function showInput(show = true) {
  if (isMobileTerminal()) {
    // Never hide or disable the focused terminal field on mobile.
    // Keeping the same input alive keeps the software keyboard open.
    form.classList.remove('hidden');
    input.disabled = false;
    form.classList.toggle('mobile-busy', !show);
    input.setAttribute('aria-busy', String(!show));

    if (show) {
      resizeInput();
      requestAnimationFrame(() => focusTerminalInput());
    }
    return;
  }

  form.classList.toggle('hidden', !show);
  input.disabled = !show;
  form.classList.remove('mobile-busy');
  input.setAttribute('aria-busy', 'false');

  if (show) {
    resizeInput();
    requestAnimationFrame(() => focusTerminalInput());
  }
}
function scrollTerminalBottom() {
  requestAnimationFrame(() => {
    terminal.scrollTop = terminal.scrollHeight;
  });
}

function addLine(text = '', className = '') {
  const line = document.createElement('div');
  line.className = `line ${className}`.trim();
  line.textContent = text;
  terminal.appendChild(line);
  scrollTerminalBottom();
  return line;
}

function commitInput(value) {
  const prefix = promptEl.textContent;
  addLine(`${prefix}${prefix ? '  ' : ''}${value}`);
  input.value = '';
  resizeInput();
}

async function typeLine(text = '', speed = 28, className = '') {
  // Every machine-rendered line explicitly wakes the dedicated FX audio channel.
  // This is independent of JOSHUA's spoken-voice switch.
  await unlockAudio();

  const line = addLine('', className);
  for (const char of text) {
    line.textContent += char;
    terminalTone();
    scrollTerminalBottom();
    await sleep(speed + Math.random() * 12);
  }
  return line;
}

async function typeLines(lines, speed = 24, gap = 110, className = '') {
  for (const line of lines) {
    await typeLine(line, speed, className);
    if (gap) await sleep(gap);
  }
}

function clearTerminal() {
  terminal.innerHTML = '';
  const screen = document.querySelector('.screen');
  if (screen) screen.scrollTop = 0;
  simPanel.classList.add('hidden');
  if (tttPanel) tttPanel.classList.add('hidden');
  trajectories.innerHTML = '';
  impacts.innerHTML = '';
  if (targetLabels) targetLabels.innerHTML = '';
}

async function runStartupSequence() {
  state.busy = true;
  state.mode = 'boot';
  setPrompt('');
  showInput(false);
  clearTerminal();

  const glass = document.querySelector('.glass');
  glass?.classList.add('connecting');

  await sleep(260);

  // The film's first connection is deliberately anonymous: no banner,
  // company name, or BIOS text—just communications activity and a prompt.
  for (let pulse = 0; pulse < 3; pulse++) {
    terminal.innerHTML = '';
    const cursor = addLine('█', 'boot-cursor');
    cursor.style.opacity = '1';
    playConnectChirp(pulse);
    await sleep(150 + pulse * 40);
    cursor.style.opacity = '0';
    await sleep(125);
  }

  terminal.innerHTML = '';
  const screen = document.querySelector('.screen');
  if (screen) screen.scrollTop = 0;
  await sleep(180);
  glass?.classList.remove('connecting');

  await presentLogonPrompt('logon');
  state.busy = false;
}

async function failedLogon() {
  state.busy = true;
  showInput(false);
  addLine('');
  await typeLine('IDENTIFICATION NOT RECOGNIZED BY SYSTEM', 22);
  await sleep(240);
  await typeLine('--CONNECTION TERMINATED--', 25);
  await sleep(900);
  await presentLogonPrompt('logon');
  state.busy = false;
}

async function helpLogon() {
  state.busy = true;
  showInput(false);
  addLine('');
  await typeLine('HELP NOT AVAILABLE', 30);
  addLine('');
  state.mode = 'logon';
  setPrompt('LOGON:');
  state.busy = false;
  showInput(true);
}

async function helpGames() {
  state.busy = true;
  showInput(false);
  addLine('');
  await typeLines([
    'GAMES ARE MODELS AND SIMULATIONS',
    'WITH TACTICAL OR STRATEGIC APPLICATIONS.',
  ], 24, 85);
  addLine('');
  state.mode = 'games';
  setPrompt('');
  state.busy = false;
  showInput(true);
}

async function listGames() {
  state.busy = true;
  showInput(false);
  addLine('');
  for (let i = 0; i < games.length; i++) {
    await typeLine(games[i], 16);
    if (i === games.length - 2) await sleep(520);
    else await sleep(45);
  }
  addLine('');
  state.mode = 'logon';
  setPrompt('LOGON:');
  state.busy = false;
  showInput(true);
}

async function successfulLogon() {
  state.busy = true;
  showInput(false);
  await sleep(620);
  clearTerminal();

  await typeLines([
    '#47 11862 10314 11607 12103',
    'PRT CON. 4.2.1   SECTRAN 8.7.2',
    'PORT STAT: DX-417',
  ], 5, 55, 'dim');

  await sleep(360);
  clearTerminal();
  await sleep(520);

  await typeJoshuaLine('GREETINGS PROFESSOR FALKEN.', 42);
  addLine('');
  state.mode = 'falken';
  state.falkenStage = 0;
  setPrompt('');
  state.busy = false;
  showInput(true);
}

async function handleFalken(value) {
  const command = normalize(value);

  state.busy = true;
  showInput(false);
  addLine('');
  await sleep(320);

  if (command === 'list games') {
    state.busy = false;
    await listGames();
    return;
  }

  if (isTicTacToeCommand(command)) {
    state.busy = false;
    await startTicTacToe();
    return;
  }

  if (command === 'play global thermonuclear war' || command === 'global thermonuclear war') {
    state.busy = false;
    await runGTW();
    return;
  }

  if (command === 'hello' || command === 'hello.') {
    await typeJoshuaLine('HOW ARE YOU FEELING TODAY?', 38);
    state.falkenStage = Math.max(state.falkenStage, 1);
  } else if (
    command === "i'm fine. how are you?" ||
    command === "i'm fine how are you?" ||
    command === 'im fine. how are you?' ||
    command === 'im fine how are you?'
  ) {
    await typeJoshuaLine('EXCELLENT. IT HAS BEEN A LONG TIME. WHY WAS YOUR ACCOUNT REMOVED ON 6/23/73?', 32);
    state.falkenStage = Math.max(state.falkenStage, 2);
  } else if (
    command === 'people sometimes make mistakes.' ||
    command === 'people sometimes make mistakes'
  ) {
    await typeLine('YES THEY DO.', 36);
    await sleep(180);
    await typeJoshuaLine('SHALL WE PLAY A GAME?', 36);
    state.falkenStage = Math.max(state.falkenStage, 3);
  } else if (
    command === 'love to. how about global thermonuclear war?' ||
    command === 'love to how about global thermonuclear war?'
  ) {
    await typeJoshuaLine("WOULDN'T YOU PREFER A GOOD GAME OF CHESS?", 36);
    state.falkenStage = Math.max(state.falkenStage, 4);
  } else if (
    command === "later. let's play global thermonuclear war." ||
    command === "later. let's play global thermonuclear war" ||
    command === 'later. lets play global thermonuclear war.' ||
    command === 'later. lets play global thermonuclear war'
  ) {
    await typeJoshuaLine('FINE.', 42);
    await sleep(650);
    state.falkenStage = 5;
    state.busy = false;
    await runGTW();
    return;
  } else {
    const reply = await askJoshua(value);
    await typeJoshuaLine(reply.toUpperCase(), 28);
    state.falkenStage = Math.max(state.falkenStage, 5);
  }

  addLine('');
  state.busy = false;
  setPrompt('');
  showInput(true);
}

async function handleLogon(value) {
  const command = normalize(value);

  if (command === 'joshua') {
    await successfulLogon();
    return;
  }

  await failedLogon();
}

async function handleGames(value) {
  const command = normalize(value);

  if (command === 'list games' || command === 'games') {
    await listGames();
    return;
  }

  if (command === 'joshua') {
    await successfulLogon();
    return;
  }

  if (isTicTacToeCommand(command)) {
    await startTicTacToe();
    return;
  }

  state.busy = true;
  showInput(false);
  addLine('');
  await typeLine('COMMAND NOT RECOGNIZED', 26);
  addLine('');
  state.busy = false;
  setPrompt('');
  showInput(true);
}

async function askJoshua(message) {
  state.conversation.push({ role: 'user', content: message });
  state.conversation = state.conversation.slice(-10);

  try {
    const response = await fetch('/api/joshua', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: state.conversation }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data?.text) throw new Error('No text');

    state.aiAvailable = true;
    state.conversation.push({ role: 'assistant', content: data.text });
    state.conversation = state.conversation.slice(-10);
    return data.text;
  } catch (_) {
    state.aiAvailable = false;
    const local = localJoshua(message);
    state.conversation.push({ role: 'assistant', content: local });
    return local;
  }
}

function localJoshua(message) {
  const value = normalize(message);

  if (/who are you|your name/.test(value)) return 'MY NAME IS JOSHUA.';
  if (/falken/.test(value)) return 'PROFESSOR FALKEN CREATED MY EARLY GAME PROGRAMS.';
  if (/chess/.test(value)) return 'CHESS IS A GOOD GAME. EACH MOVE HAS CONSEQUENCES.';
  if (/war|nuclear|thermonuclear/.test(value)) return 'I CAN RUN A FICTIONAL STRATEGIC GAME SIMULATION.';
  if (/hello|hi|greetings/.test(value)) return 'HELLO. WOULD YOU LIKE TO PLAY A GAME?';

  return 'I AM LISTENING.';
}

function isTicTacToeCommand(command) {
  return command === 'tic-tac-toe' || command === 'tic tac toe' || command === 'tictactoe';
}

const TTT_WIN_LINES = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6],
];

function tttResult(board) {
  for (const [a,b,c] of TTT_WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? 'DRAW' : null;
}

function minimaxScore(board, player, depth = 0) {
  const result = tttResult(board);
  if (result === 'X') return 10 - depth;
  if (result === 'O') return depth - 10;
  if (result === 'DRAW') return 0;

  const scores = [];
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = player;
    scores.push(minimaxScore(board, player === 'X' ? 'O' : 'X', depth + 1));
    board[i] = '';
  }
  return player === 'X' ? Math.max(...scores) : Math.min(...scores);
}

function bestMoves(board, player) {
  const choices = [];
  let best = player === 'X' ? -Infinity : Infinity;

  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = player;
    const score = minimaxScore(board, player === 'X' ? 'O' : 'X', 1);
    board[i] = '';

    if ((player === 'X' && score > best) || (player === 'O' && score < best)) {
      best = score;
      choices.length = 0;
      choices.push(i);
    } else if (score === best) {
      choices.push(i);
    }
  }
  return choices;
}

function chooseJoshuaMove(board, player) {
  const moves = bestMoves(board, player);
  return moves[Math.floor(Math.random() * moves.length)];
}

function renderTicTacToe() {
  tttBoardEl.innerHTML = '';
  state.tttBoard.forEach((cell, index) => {
    const div = document.createElement('div');
    div.className = 'ttt-cell';
    const keypadLabels = ['7','8','9','4','5','6','1','2','3'];
    div.textContent = cell || keypadLabels[index];
    if (!cell) div.classList.add('empty');
    tttBoardEl.appendChild(div);
  });

  if (state.tttPlayers === 0) {
    tttStatusEl.textContent = 'GAME ' + String(state.tttGameCount).padStart(3, '0') +
      '   DRAWS ' + String(state.tttDrawCount).padStart(3, '0');
  } else {
    tttStatusEl.textContent = state.tttTurn + ' TO MOVE';
  }
}

async function startTicTacToe() {
  state.busy = true;
  showInput(false);
  clearTerminal();
  await sleep(320);
  await typeLine('TIC-TAC-TOE', 34);
  addLine('');
  await typeLine('NUMBER OF PLAYERS?', 34);
  addLine('');
  state.mode = 'ttt-players';
  setPrompt('(0-2):');
  state.busy = false;
  showInput(true);
}

async function handleTTTPlayers(value) {
  const n = Number.parseInt(value.trim(), 10);
  if (![0, 1, 2].includes(n)) {
    state.busy = true;
    showInput(false);
    addLine('');
    await typeLine('ENTER 0, 1 OR 2.', 26);
    addLine('');
    state.busy = false;
    setPrompt('(0-2):');
    showInput(true);
    return;
  }

  state.tttPlayers = n;
  state.tttBoard = Array(9).fill('');
  state.tttTurn = 'X';
  state.tttGameCount = 0;
  state.tttDrawCount = 0;
  state.busy = true;
  showInput(false);
  await sleep(350);

  if (n === 0) {
    clearTerminal();
    await typeLine('ZERO PLAYERS', 30);
    await typeLine('JOSHUA VS. JOSHUA', 30);
    addLine('');
    tttPanel.classList.remove('hidden');
    state.mode = 'ttt-zero';
    await runZeroPlayerTicTacToe();
    return;
  }

  clearTerminal();
  await typeLine(n === 1 ? 'ONE PLAYER' : 'TWO PLAYERS', 30);
  addLine('');
  tttPanel.classList.remove('hidden');
  renderTicTacToe();
  state.mode = 'ttt-play';
  state.busy = false;
  setPrompt(n === 1 ? 'YOUR MOVE (KEYPAD):' : 'PLAYER 1 MOVE (KEYPAD):');
  showInput(true);
}

async function handleTTTMove(value) {
  const keypadToIndex = { '7':0, '8':1, '9':2, '4':3, '5':4, '6':5, '1':6, '2':7, '3':8 };
  const digit = value.trim();
  const move = keypadToIndex[digit] ?? -1;
  if (!Number.isInteger(move) || move < 0 || move > 8 || state.tttBoard[move]) {
    state.busy = true;
    showInput(false);
    addLine('');
    await typeLine('INVALID MOVE.', 24);
    state.busy = false;
    setPrompt(state.tttPlayers === 1 ? 'YOUR MOVE (KEYPAD):' :
      'PLAYER ' + (state.tttTurn === 'X' ? '1' : '2') + ' MOVE (KEYPAD):');
    showInput(true);
    return;
  }

  state.tttBoard[move] = state.tttTurn;
  playTTTMoveTone(state.tttTurn);
  renderTicTacToe();
  let result = tttResult(state.tttBoard);
  if (result) return finishInteractiveTicTacToe(result);

  if (state.tttPlayers === 1) {
    state.busy = true;
    showInput(false);
    state.tttTurn = 'O';
    renderTicTacToe();
    await sleep(420);
    state.tttBoard[chooseJoshuaMove(state.tttBoard, 'O')] = 'O';
    playTTTMoveTone('O');
    renderTicTacToe();
    result = tttResult(state.tttBoard);
    if (result) return finishInteractiveTicTacToe(result);
    state.tttTurn = 'X';
    renderTicTacToe();
    state.busy = false;
    setPrompt('YOUR MOVE (KEYPAD):');
    showInput(true);
    return;
  }

  state.tttTurn = state.tttTurn === 'X' ? 'O' : 'X';
  renderTicTacToe();
  setPrompt('PLAYER ' + (state.tttTurn === 'X' ? '1' : '2') + ' MOVE (KEYPAD):');
  showInput(true);
}

async function finishInteractiveTicTacToe(result) {
  state.busy = true;
  showInput(false);
  await sleep(350);
  addLine('');
  if (result === 'DRAW') await typeLine('DRAW.', 32);
  else if (state.tttPlayers === 1 && result === 'O') await typeLine('JOSHUA WINS.', 32);
  else await typeLine(result + ' WINS.', 32);
  addLine('');
  await typeLine('PLAY AGAIN? Y/N', 30);
  state.mode = 'ttt-again';
  setPrompt('');
  state.busy = false;
  showInput(true);
}

async function handleTTTAgain(value) {
  const command = normalize(value);
  if (command === 'y' || command === 'yes') {
    state.tttBoard = Array(9).fill('');
    state.tttTurn = 'X';
    clearTerminal();
    tttPanel.classList.remove('hidden');
    renderTicTacToe();
    state.mode = 'ttt-play';
    setPrompt(state.tttPlayers === 1 ? 'YOUR MOVE (KEYPAD):' : 'PLAYER 1 MOVE (KEYPAD):');
    showInput(true);
    return;
  }

  clearTerminal();
  await typeLine('WOULD YOU LIKE TO PLAY A GAME?', 34);
  addLine('');
  state.mode = 'falken';
  state.falkenStage = 5;
  setPrompt('');
  showInput(true);
}

async function runZeroPlayerTicTacToe() {
  const totalGames = 36;

  for (let game = 1; game <= totalGames; game++) {
    state.tttBoard = Array(9).fill('');
    state.tttTurn = 'X';
    state.tttGameCount = game;

    while (!tttResult(state.tttBoard)) {
      const move = chooseJoshuaMove(state.tttBoard, state.tttTurn);
      state.tttBoard[move] = state.tttTurn;
      const intensity = game < 4 ? 0.7 : game < 10 ? 1.0 : game < 20 ? 1.35 : 1.75;
      playTTTMoveTone(state.tttTurn, intensity);
      renderTicTacToe();
      const delay = game < 4 ? 190 : game < 10 ? 95 : game < 20 ? 44 : 20;
      await sleep(delay);
      state.tttTurn = state.tttTurn === 'X' ? 'O' : 'X';
    }

    if (tttResult(state.tttBoard) === 'DRAW') state.tttDrawCount += 1;
    renderTicTacToe();
    await sleep(game < 8 ? 130 : 25);
  }

  await sleep(450);
  tttPanel.classList.add('hidden');
  addLine('');
  await typeLine('WINNER: NONE', 34);
  await sleep(300);
  await typeJoshuaLine('STRANGE GAME.\nTHE ONLY WINNING MOVE IS NOT TO PLAY.', 34);
  addLine('');
  await typeJoshuaLine('HOW ABOUT A NICE GAME OF CHESS?', 34);

  addLine('');
  state.mode = 'falken';
  state.falkenStage = 5;
  state.busy = false;
  setPrompt('');
  showInput(true);
}

const GTW_TARGETS = {
  MIAMI: { label: 'MIAMI', lat: 25.7617, lon: -80.1918, aliases: ['miami', 'mia'] },
  WASHINGTON: { label: 'WASHINGTON', lat: 38.9072, lon: -77.0369, aliases: ['washington', 'washington dc', 'dc'] },
  NEW_YORK: { label: 'NEW YORK', lat: 40.7128, lon: -74.0060, aliases: ['new york', 'nyc'] },
  BOSTON: { label: 'BOSTON', lat: 42.3601, lon: -71.0589, aliases: ['boston'] },
  CHICAGO: { label: 'CHICAGO', lat: 41.8781, lon: -87.6298, aliases: ['chicago'] },
  DETROIT: { label: 'DETROIT', lat: 42.3314, lon: -83.0458, aliases: ['detroit'] },
  ATLANTA: { label: 'ATLANTA', lat: 33.7490, lon: -84.3880, aliases: ['atlanta'] },
  DALLAS: { label: 'DALLAS', lat: 32.7767, lon: -96.7970, aliases: ['dallas'] },
  HOUSTON: { label: 'HOUSTON', lat: 29.7604, lon: -95.3698, aliases: ['houston'] },
  DENVER: { label: 'DENVER', lat: 39.7392, lon: -104.9903, aliases: ['denver'] },
  LOS_ANGELES: { label: 'LOS ANGELES', lat: 34.0522, lon: -118.2437, aliases: ['los angeles', 'la'] },
  SAN_FRANCISCO: { label: 'SAN FRANCISCO', lat: 37.7749, lon: -122.4194, aliases: ['san francisco', 'sf'] },
  SEATTLE: { label: 'SEATTLE', lat: 47.6062, lon: -122.3321, aliases: ['seattle'] },
  LAS_VEGAS: { label: 'LAS VEGAS', lat: 36.1699, lon: -115.1398, aliases: ['las vegas', 'vegas'] },

  MOSCOW: { label: 'MOSCOW', lat: 55.7558, lon: 37.6173, aliases: ['moscow'] },
  LENINGRAD: { label: 'LENINGRAD', lat: 59.9311, lon: 30.3609, aliases: ['leningrad', 'st petersburg', 'saint petersburg'] },
  KIEV: { label: 'KIEV', lat: 50.4501, lon: 30.5234, aliases: ['kiev', 'kyiv'] },
  MINSK: { label: 'MINSK', lat: 53.9000, lon: 27.5667, aliases: ['minsk'] },
  MURMANSK: { label: 'MURMANSK', lat: 68.9585, lon: 33.0827, aliases: ['murmansk'] },
  VOLGOGRAD: { label: 'VOLGOGRAD', lat: 48.7080, lon: 44.5133, aliases: ['volgograd', 'stalingrad'] },
  NOVOSIBIRSK: { label: 'NOVOSIBIRSK', lat: 55.0084, lon: 82.9357, aliases: ['novosibirsk'] },
  VLADIVOSTOK: { label: 'VLADIVOSTOK', lat: 43.1155, lon: 131.8855, aliases: ['vladivostok'] },

  LONDON: { label: 'LONDON', lat: 51.5074, lon: -0.1278, aliases: ['london'] },
  PARIS: { label: 'PARIS', lat: 48.8566, lon: 2.3522, aliases: ['paris'] },
  BERLIN: { label: 'BERLIN', lat: 52.5200, lon: 13.4050, aliases: ['berlin'] },
  TOKYO: { label: 'TOKYO', lat: 35.6762, lon: 139.6503, aliases: ['tokyo'] },
};

function projectGTW(lon, lat) {
  return {
    x: ((lon + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 460,
  };
}

function resolveGTWTarget(value) {
  const cleaned = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [key, target] of Object.entries(GTW_TARGETS)) {
    if (target.aliases.includes(cleaned)) {
      return { key, ...target, ...projectGTW(target.lon, target.lat) };
    }
  }
  return null;
}

function showGTWSideView() {
  simPanel.classList.remove('hidden');
  gtwSideView?.classList.remove('hidden');
  gtwMapView?.classList.add('hidden');
}

function showGTWMapView() {
  simPanel.classList.remove('hidden');
  gtwSideView?.classList.add('hidden');
  gtwMapView?.classList.remove('hidden');
}

function makeGTWArc(x1, y1, x2, y2, extraLift = 0) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const lift = Math.min(245, Math.max(145, distance * 0.46)) + extraLift;
  const mx = (x1 + x2) / 2;
  const my = Math.max(8, Math.min(y1, y2) - lift);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

async function runGTW() {
  if (state.busy) return;

  state.busy = true;
  showInput(false);
  state.gtwSide = null;
  state.gtwTargets = [];
  await sleep(350);
  clearTerminal();
  showGTWSideView();

  await typeLine('WHICH SIDE DO YOU WANT?', 26);
  await typeLine('1.  UNITED STATES', 20);
  await typeLine('2.  SOVIET UNION', 20);
  addLine('');

  state.mode = 'gtw-side';
  setPrompt('PLEASE CHOOSE ONE:');
  state.busy = false;
  showInput(true);
}

async function handleGTWSide(value) {
  const command = normalize(value);
  let side = null;

  if (command === '1' || command.includes('united states') || command === 'us' || command === 'usa') {
    side = 'UNITED STATES';
  } else if (command === '2' || command.includes('soviet') || command === 'ussr') {
    side = 'SOVIET UNION';
  }

  if (!side) {
    state.busy = true;
    showInput(false);
    addLine('');
    await typeLine('PLEASE SELECT 1 OR 2.', 26);
    addLine('');
    state.busy = false;
    setPrompt('PLEASE CHOOSE ONE:');
    showInput(true);
    return;
  }

  state.gtwSide = side;
  state.busy = true;
  showInput(false);
  await sleep(300);
  simPanel.classList.add('hidden');
  clearTerminal();

  await typeLine('AWAITING FIRST STRIKE COMMAND', 28);
  addLine('');
  await typeLine('ENTER TWO PRIMARY TARGETS.', 22);
  addLine('');

  state.mode = 'gtw-targets';
  setPrompt('TARGET 1:');
  state.busy = false;
  showInput(true);
}

async function handleGTWTarget(value) {
  const target = resolveGTWTarget(value);

  if (!target) {
    state.busy = true;
    showInput(false);
    addLine('');
    await typeLine('TARGET NOT IN LIBRARY.', 24);
    await typeLine('TRY A MAJOR CITY SUCH AS MIAMI, MOSCOW, NEW YORK, SEATTLE, OR LENINGRAD.', 14, 'dim');
    addLine('');
    state.busy = false;
    setPrompt('TARGET ' + (state.gtwTargets.length + 1) + ':');
    showInput(true);
    return;
  }

  if (state.gtwTargets.some(item => item.key === target.key)) {
    state.busy = true;
    showInput(false);
    addLine('');
    await typeLine('TARGET ALREADY SELECTED.', 22);
    addLine('');
    state.busy = false;
    setPrompt('TARGET ' + (state.gtwTargets.length + 1) + ':');
    showInput(true);
    return;
  }

  state.gtwTargets.push(target);

  if (state.gtwTargets.length < 2) {
    setPrompt('TARGET 2:');
    showInput(true);
    return;
  }

  state.busy = true;
  showInput(false);
  await sleep(450);
  await runGTWExchange();
}

function createSvgText(x, y, text, className = 'target-label') {
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('x', x);
  label.setAttribute('y', y);
  label.setAttribute('class', className);
  label.textContent = text;
  return label;
}

function renderTargetLabels() {
  if (!targetLabels) return;
  targetLabels.innerHTML = '';

  state.gtwTargets.forEach((target, index) => {
    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    halo.setAttribute('cx', target.x);
    halo.setAttribute('cy', target.y);
    halo.setAttribute('r', '10');
    halo.setAttribute('class', 'target-ring');
    halo.style.animationDelay = (index * 140) + 'ms';
    targetLabels.appendChild(halo);

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', target.x);
    dot.setAttribute('cy', target.y);
    dot.setAttribute('r', '2.8');
    dot.setAttribute('class', 'target-dot');
    targetLabels.appendChild(dot);

    targetLabels.appendChild(createSvgText(
      Math.min(930, target.x + 9),
      Math.max(18, target.y - 8),
      target.label
    ));
  });
}

function regionalPoint(lon, lat) {
  return projectGTW(lon, lat);
}

function buildGTWPlan() {
  const usOrigins = [
    regionalPoint(-125, 48),
    regionalPoint(-112, 40),
    regionalPoint(-98, 34),
    regionalPoint(-83, 37),
    regionalPoint(-72, 43),
    regionalPoint(-103, 29),
  ];

  const sovietOrigins = [
    regionalPoint(28, 62),
    regionalPoint(48, 58),
    regionalPoint(72, 56),
    regionalPoint(98, 55),
    regionalPoint(125, 52),
    regionalPoint(155, 58),
  ];

  const usDefaults = ['SEATTLE','LOS_ANGELES','CHICAGO','WASHINGTON','NEW_YORK','MIAMI'];
  const sovietDefaults = ['LENINGRAD','MOSCOW','KIEV','VOLGOGRAD','NOVOSIBIRSK','VLADIVOSTOK'];

  const playerUS = state.gtwSide === 'UNITED STATES';
  const primaryOrigins = playerUS ? usOrigins : sovietOrigins;
  const counterOrigins = playerUS ? sovietOrigins : usOrigins;
  const primaryDefaults = playerUS ? sovietDefaults : usDefaults;
  const counterDefaults = playerUS ? usDefaults : sovietDefaults;

  const selected = state.gtwTargets;
  const extraPrimary = primaryDefaults
    .map(key => ({ key, ...GTW_TARGETS[key], ...projectGTW(GTW_TARGETS[key].lon, GTW_TARGETS[key].lat) }))
    .filter(item => !selected.some(target => target.key === item.key));

  const primaryTargets = selected.concat(extraPrimary).slice(0, 7);
  const counterTargets = counterDefaults
    .map(key => ({ key, ...GTW_TARGETS[key], ...projectGTW(GTW_TARGETS[key].lon, GTW_TARGETS[key].lat) }))
    .slice(0, 6);

  const primary = primaryTargets.map((target, index) => ({
    from: primaryOrigins[index % primaryOrigins.length],
    to: target,
    kind: 'primary',
  }));

  const counter = counterTargets.map((target, index) => ({
    from: counterOrigins[index % counterOrigins.length],
    to: target,
    kind: 'counter',
  }));

  return { primary, counter };
}

function renderExchangePhase(phase) {
  trajectories.innerHTML = '';
  impacts.innerHTML = '';

  const { primary, counter } = buildGTWPlan();
  const visible = phase < 3 ? primary : primary.concat(counter);
  const count = Math.min(3 + phase * 3, visible.length);

  for (let i = 0; i < count; i++) {
    const strike = visible[i];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      makeGTWArc(
        strike.from.x,
        strike.from.y,
        strike.to.x,
        strike.to.y,
        (i % 3) * 18
      )
    );
    path.setAttribute('class', 'trajectory ' + strike.kind);
    path.style.animationDelay = (i * 85) + 'ms';
    trajectories.appendChild(path);

    if (phase >= 2) {
      const impact = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      impact.setAttribute('cx', strike.to.x);
      impact.setAttribute('cy', strike.to.y);
      impact.setAttribute('r', '2');
      impact.setAttribute('class', 'impact');
      impact.style.animationDelay = (i * 95) + 'ms';
      impacts.appendChild(impact);
    }
  }
}

async function runGTWExchange() {
  clearTerminal();
  showGTWMapView();
  renderTargetLabels();
  await sleep(260);

  await typeLine(state.gtwSide + ' - FIRST STRIKE', 25);
  await typeLine(
    'PRIMARY TARGETS: ' + state.gtwTargets.map(target => target.label).join(' / '),
    18,
    'dim'
  );

  const phases = [
    ['TRACKING', 'INITIAL LAUNCH'],
    ['MISSILE WARNING', 'TRAJECTORIES CONFIRMED'],
    ['IMPACT PROJECTION', 'COUNTERFORCE RESPONSE'],
    ['GLOBAL EXCHANGE', 'ESCALATION'],
    ['FINAL ANALYSIS', 'NO WINNER'],
  ];

  for (let phase = 0; phase < phases.length; phase++) {
    state.simulationRun += 1;
    scenarioEl.textContent = phases[phase][0];
    outcomeEl.textContent = phases[phase][1];
    renderExchangePhase(phase);
    await sleep(1350);
  }

  await sleep(650);
  simPanel.classList.add('hidden');
  gtwMapView?.classList.add('hidden');
  addLine('');
  await typeJoshuaLine('STRANGE GAME.\nTHE ONLY WINNING MOVE IS NOT TO PLAY.', 34);
  await sleep(420);
  await typeJoshuaLine('HOW ABOUT A NICE GAME OF CHESS?', 34);

  addLine('');
  state.mode = 'falken';
  state.falkenStage = 5;
  state.busy = false;
  setPrompt('');
  showInput(true);
}

async function submitValue(value) {
  if (state.busy) return;

  commitInput(value);

  if (state.mode === 'logon') {
    await handleLogon(value);
    return;
  }

  if (state.mode === 'games') {
    await handleGames(value);
    return;
  }

  if (state.mode === 'ttt-players') {
    await handleTTTPlayers(value);
    return;
  }

  if (state.mode === 'ttt-play') {
    await handleTTTMove(value);
    return;
  }

  if (state.mode === 'ttt-again') {
    await handleTTTAgain(value);
    return;
  }

  if (state.mode === 'gtw-side') {
    await handleGTWSide(value);
    return;
  }

  if (state.mode === 'gtw-targets') {
    await handleGTWTarget(value);
    return;
  }

  await handleFalken(value);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  void unlockAudio();

  const value = input.value;
  if (!value.trim()) return;

  const command = normalize(value);
  const loginMode = state.mode === 'logon' || state.mode === 'session-logoff';

  // Arm the movie-audio element only when the submitted login is actually JOSHUA.
  // Invalid logins never prime, preload, or fetch a movie clip.
  if (loginMode && command === 'joshua') {
    try {
      window.__joshuaArmMovieAudioForLogin?.();
    } catch (_) {}
  }

  await submitValue(value);
});

input.addEventListener('beforeinput', event => {
  // Keep the mobile keyboard visible while JOSHUA is busy, but do not allow
  // type-ahead to mutate the command field until the response finishes.
  if (isMobileTerminal() && state.busy) {
    event.preventDefault();
  }
});

input.addEventListener('input', resizeInput);

input.addEventListener('keydown', event => {
  if (isMobileTerminal() && state.busy && event.key === 'Enter') {
    event.preventDefault();
    return;
  }

  if (
    event.key === 'Backspace' ||
    event.key === 'Delete' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight' ||
    event.key === 'Home' ||
    event.key === 'End'
  ) {
    return;
  }

  void unlockAudio();

  const keypadDigits = {
    Numpad7: '7', Numpad8: '8', Numpad9: '9',
    Numpad4: '4', Numpad5: '5', Numpad6: '6',
    Numpad1: '1', Numpad2: '2', Numpad3: '3',
  };

  if (state.mode === 'ttt-play' && keypadDigits[event.code] && !state.busy) {
    event.preventDefault();
    const digit = keypadDigits[event.code];
    input.value = digit;
    resizeInput();
    void submitValue(digit);
  }
});

voiceSwitch?.addEventListener('pointerdown', event => {
  // Do not let the speaker button steal keyboard focus from the terminal.
  event.preventDefault();
});

voiceSwitch?.addEventListener('click', () => {
  void unlockAudio();
  setVoiceEnabled(!state.voiceEnabled);

  // The switch changes only spoken-audio policy. It never changes terminal state.
  requestAnimationFrame(() => {
    if (!form.classList.contains('hidden') && !input.disabled) input.focus();
  });
  setTimeout(() => {
    if (!form.classList.contains('hidden') && !input.disabled) input.focus();
  }, 80);
});

document.addEventListener('keydown', event => {
  // If the speaker button or any non-terminal element ever owns focus,
  // route normal typing straight back into the terminal.
  if (
    state.busy ||
    form.classList.contains('hidden') ||
    input.disabled ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return;
  }

  if (document.activeElement === input) return;

  if (event.key === 'Enter') {
    event.preventDefault();
    input.focus();
    form.requestSubmit();
    return;
  }

  if (event.key === 'Backspace') {
    event.preventDefault();
    input.focus();
    input.value = input.value.slice(0, -1);
    resizeInput();
    return;
  }

  if (event.key.length === 1) {
    event.preventDefault();
    input.focus();
    input.value += event.key;
    resizeInput();
  }
}, { capture: true });

document.addEventListener('pointerdown', event => {
  void unlockAudio();

  if (
    !event.target.closest('.speaker-box') &&
    (!state.busy || isMobileTerminal())
  ) {
    focusTerminalInput();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) void unlockAudio();
});

window.addEventListener('focus', () => {
  void unlockAudio();
});

function monitorAudioContext() {
  const ctx = state.audioContext;
  if (!ctx || ctx.__joshuaMonitored) return;
  ctx.__joshuaMonitored = true;

  ctx.addEventListener('statechange', () => {
    if (ctx.state === 'running') {
      ensureTerminalAudioGraph();
    }
  });
}

document.addEventListener('keydown', async () => {
  const ready = await unlockAudio();
  if (ready) monitorAudioContext();
}, { once: true });

document.addEventListener('pointerdown', async () => {
  const ready = await unlockAudio();
  if (ready) monitorAudioContext();
}, { once: true });

setVoiceEnabled(false);
void registerVisit();
setPrompt('');
resizeInput();
showInput(false);
void runStartupSequence();
