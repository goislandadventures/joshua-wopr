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
const tttPanel = document.querySelector('#ttt-panel');
const tttBoardEl = document.querySelector('#ttt-board');
const tttStatusEl = document.querySelector('#ttt-status');
const voiceSwitch = document.querySelector('#voice-switch');
const voiceStateEl = document.querySelector('#voice-state');

const state = {
  busy: false,
  mode: 'logon',
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
  voiceEnabled: true,
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

function normalize(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function unlockAudio() {
  if (state.audioArmed) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    state.audioContext = new AudioCtx();
    if (state.audioContext.state === 'suspended') state.audioContext.resume();
    state.audioArmed = true;
  } catch (_) {}
}

function terminalTone(kind = 'output') {
  if (!state.audioArmed || !state.audioContext) return;
  try {
    const ctx = state.audioContext;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(kind === 'input' ? 1110 : 930, now);
    osc.frequency.exponentialRampToValueAtTime(kind === 'input' ? 880 : 720, now + 0.018);

    filter.type = 'bandpass';
    filter.frequency.value = 1250;
    filter.Q.value = 1.1;

    gain.gain.setValueAtTime(kind === 'input' ? 0.017 : 0.024, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.026);
  } catch (_) {}
}

function playTTTMoveTone(mark) {
  if (!state.audioArmed || !state.audioContext) return;
  try {
    const ctx = state.audioContext;
    const base = mark === 'X' ? [920, 1120] : [520, 410];
    const start = ctx.currentTime;
    base.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const t = start + index * 0.075;

      osc.type = mark === 'X' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.82), t + 0.045);

      filter.type = 'bandpass';
      filter.frequency.value = mark === 'X' ? 1150 : 620;
      filter.Q.value = 1.4;

      gain.gain.setValueAtTime(mark === 'X' ? 0.040 : 0.052, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.058);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.062);
    });
  } catch (_) {}
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
  voiceSwitch?.setAttribute('aria-pressed', String(state.voiceEnabled));
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

function resizeInput() {
  input.style.width = `${Math.max(1, Math.min(63, input.value.length + 1))}ch`;
}

function showInput(show = true) {
  form.classList.toggle('hidden', !show);
  input.disabled = !show;
  if (show) {
    resizeInput();
    requestAnimationFrame(() => input.focus());
  }
}

function addLine(text = '', className = '') {
  const line = document.createElement('div');
  line.className = `line ${className}`.trim();
  line.textContent = text;
  terminal.appendChild(line);
  return line;
}

function commitInput(value) {
  const prefix = promptEl.textContent;
  addLine(`${prefix}${prefix ? '  ' : ''}${value}`);
  input.value = '';
  resizeInput();
}

async function typeLine(text = '', speed = 28, className = '') {
  const line = addLine('', className);
  for (const char of text) {
    line.textContent += char;
    if (char !== ' ' && char !== '\t') terminalTone('output');
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
  simPanel.classList.add('hidden');
  if (tttPanel) tttPanel.classList.add('hidden');
  trajectories.innerHTML = '';
  impacts.innerHTML = '';
  if (targetLabels) targetLabels.innerHTML = '';
}

async function failedLogon() {
  state.busy = true;
  showInput(false);
  addLine('');
  await typeLine('IDENTIFICATION NOT RECOGNIZED BY SYSTEM', 22);
  await sleep(240);
  await typeLine('--CONNECTION TERMINATED--', 25);
  await sleep(700);
  addLine('');
  state.mode = 'logon';
  setPrompt('LOGON:');
  state.busy = false;
  showInput(true);
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
    await typeJoshuaLine('YES THEY DO. SHALL WE PLAY A GAME?', 36);
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

  if (command === 'help logon' || command === 'help') {
    await helpLogon();
    return;
  }

  if (command === 'help games') {
    await helpGames();
    return;
  }

  if (command === 'joshua') {
    await successfulLogon();
    return;
  }

  if (command === '000001' || command === 'falkens-maze' || command === 'armageddon') {
    await failedLogon();
    return;
  }

  state.busy = true;
  showInput(false);
  addLine('');
  const reply = await askJoshua(value);
  await typeJoshuaLine(reply.toUpperCase(), 28);
  addLine('');
  state.busy = false;
  setPrompt('LOGON:');
  showInput(true);
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
      playTTTMoveTone(state.tttTurn);
      renderTicTacToe();
      const delay = game < 4 ? 170 : game < 10 ? 80 : game < 20 ? 34 : 14;
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
  await typeJoshuaLine('THE ONLY WINNING MOVE IS NOT TO PLAY.', 34);
  addLine('');
  await typeJoshuaLine('HOW ABOUT A NICE GAME OF CHESS?', 34);

  addLine('');
  state.mode = 'falken';
  state.falkenStage = 5;
  state.busy = false;
  setPrompt('');
  showInput(true);
}

function makeArc(x1, y1, x2, y2, lift = 90) {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - lift;
  return 'M' + x1 + ' ' + y1 + ' Q' + mx + ' ' + my + ' ' + x2 + ' ' + y2;
}

async function runGTW() {
  if (state.busy) return;

  state.busy = true;
  showInput(false);
  state.gtwSide = null;
  state.gtwTargets = [];
  await sleep(450);
  clearTerminal();

  await typeLine('GLOBAL THERMONUCLEAR WAR', 34);
  addLine('');
  await typeLines([
    '            UNITED STATES        SOVIET UNION',
    '                1                    2',
    '',
    'WHICH SIDE DO YOU WANT?',
  ], 24, 85);

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
  await sleep(400);
  clearTerminal();

  await typeLine('AWAITING FIRST STRIKE COMMAND', 31);
  await typeLine('-----------------------------', 14, 'dim');
  addLine('');
  await typeLine('ENTER TWO PRIMARY TARGETS.', 24);
  addLine('');

  state.mode = 'gtw-targets';
  setPrompt('TARGET 1:');
  state.busy = false;
  showInput(true);
}

function sanitizeTarget(value) {
  return value.trim().replace(/[^a-zA-Z0-9 .,'-]/g, '').slice(0, 28).toUpperCase();
}

async function handleGTWTarget(value) {
  const target = sanitizeTarget(value);

  if (!target) {
    state.busy = true;
    showInput(false);
    addLine('');
    await typeLine('TARGET NAME REQUIRED.', 24);
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
  await sleep(550);
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

  const points = state.gtwSide === 'SOVIET UNION'
    ? [
        { x: 220, y: 158, lx: 110, ly: 150 },
        { x: 275, y: 255, lx: 118, ly: 278 },
      ]
    : [
        { x: 705, y: 142, lx: 730, ly: 130 },
        { x: 790, y: 215, lx: 800, ly: 240 },
      ];

  state.gtwTargets.slice(0, 2).forEach((target, index) => {
    const p = points[index];
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ring.setAttribute('cx', p.x);
    ring.setAttribute('cy', p.y);
    ring.setAttribute('rx', '34');
    ring.setAttribute('ry', '20');
    ring.setAttribute('class', 'target-ring');
    targetLabels.appendChild(ring);
    targetLabels.appendChild(createSvgText(p.lx, p.ly, target));
  });
}

function renderExchangePhase(phase) {
  trajectories.innerHTML = '';
  impacts.innerHTML = '';

  const sovietToUS = [
    [775, 120, 220, 158],
    [820, 150, 275, 255],
    [690, 110, 345, 190],
    [735, 235, 385, 310],
    [865, 205, 185, 330],
    [650, 260, 315, 125],
  ];

  const usToSoviet = [
    [220, 158, 705, 142],
    [275, 255, 790, 215],
    [345, 190, 660, 105],
    [385, 310, 865, 205],
    [185, 330, 735, 235],
    [315, 125, 650, 260],
  ];

  const primary = state.gtwSide === 'SOVIET UNION' ? sovietToUS : usToSoviet;
  const counter = state.gtwSide === 'SOVIET UNION' ? usToSoviet : sovietToUS;
  const visible = phase < 3 ? primary : primary.concat(counter);
  const count = Math.min(2 + phase * 2, visible.length);

  for (let i = 0; i < count; i++) {
    const p = visible[i];
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', makeArc(p[0], p[1], p[2], p[3], 95 + (i % 3) * 35));
    path.setAttribute('class', i < primary.length ? 'trajectory primary' : 'trajectory counter');
    path.style.animationDelay = (i * 95) + 'ms';
    trajectories.appendChild(path);

    if (phase >= 2) {
      const impact = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      impact.setAttribute('cx', p[2]);
      impact.setAttribute('cy', p[3]);
      impact.setAttribute('r', '2');
      impact.setAttribute('class', 'impact');
      impact.style.animationDelay = (i * 115) + 'ms';
      impacts.appendChild(impact);
    }
  }
}

async function runGTWExchange() {
  clearTerminal();
  await sleep(350);
  await typeLine(state.gtwSide + ' - FIRST STRIKE', 28);
  await typeLine('PRIMARY TARGETS: ' + state.gtwTargets.join(' / '), 20, 'dim');
  await sleep(500);

  simPanel.classList.remove('hidden');
  renderTargetLabels();

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
    await sleep(1300);
  }

  await sleep(600);
  simPanel.classList.add('hidden');
  addLine('');
  await typeLines([
    'SIMULATION COMPLETE.',
    'ALL ESCALATION PATHS CONVERGE ON MUTUAL LOSS.',
    '',
    'HOW ABOUT CHESS?',
  ], 34, 330);

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
  unlockAudio();
  const value = input.value;
  if (!value.trim()) return;
  await submitValue(value);
});

input.addEventListener('input', resizeInput);

input.addEventListener('keydown', event => {
  unlockAudio();

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
    terminalTone('input');
    void submitValue(digit);
    return;
  }

  if (event.key.length === 1 || event.key === 'Backspace') terminalTone('input');
});

voiceSwitch?.addEventListener('click', () => {
  unlockAudio();
  setVoiceEnabled(!state.voiceEnabled);
});

document.addEventListener('pointerdown', event => {
  unlockAudio();
  if (!event.target.closest('.speaker-box') && !state.busy) input.focus();
});

setVoiceEnabled(true);
setPrompt('LOGON:');
resizeInput();
showInput(true);
