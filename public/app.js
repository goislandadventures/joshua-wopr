const terminal = document.querySelector('#terminal');
const form = document.querySelector('#command-form');
const input = document.querySelector('#command');
const promptEl = document.querySelector('#prompt');
const simPanel = document.querySelector('#sim-panel');
const scenarioEl = document.querySelector('#scenario');
const outcomeEl = document.querySelector('#outcome');
const trajectories = document.querySelector('#trajectories');
const impacts = document.querySelector('#impacts');

const state = {
  busy: false,
  mode: 'logon',
  falkenStage: 0,
  aiAvailable: null,
  conversation: [],
  simulationRun: 0,
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
}

async function failedLogon() {
  state.busy = true;
  showInput(false);
  addLine('');
  await typeLine('IDENTIFICATION NOT RECOGNIZED', 22);
  await sleep(240);
  await typeLine('-- LINK CLOSED --', 25);
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

  await typeLine('GREETINGS PROFESSOR FALKEN.', 42);
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
  await sleep(420);

  if (command === 'list games') {
    state.busy = false;
    await listGames();
    return;
  }

  if (command === 'play global thermonuclear war' || command === 'global thermonuclear war') {
    state.busy = false;
    await runGTW();
    return;
  }

  if (state.falkenStage === 0) {
    await typeLine('HOW ARE YOU FEELING TODAY?', 38);
    state.falkenStage = 1;
  } else if (state.falkenStage === 1) {
    await typeLines([
      'EXCELLENT. IT HAS BEEN A LONG TIME.',
      'WHY WAS YOUR ACCOUNT REMOVED IN 1973?',
    ], 34, 90);
    state.falkenStage = 2;
  } else if (state.falkenStage === 2) {
    await typeLines([
      'YES. PEOPLE MAKE MISTAKES.',
      'WOULD YOU LIKE TO PLAY A GAME?',
    ], 36, 100);
    state.falkenStage = 3;
  } else if (state.falkenStage === 3 && /thermonuclear|global|war/.test(command)) {
    await typeLine('CHESS MAY BE A BETTER CHOICE.', 38);
    state.falkenStage = 4;
  } else if (state.falkenStage === 4 && /thermonuclear|global|war|later|play/.test(command)) {
    await typeLine('VERY WELL.', 42);
    state.falkenStage = 5;
    await sleep(750);
    state.busy = false;
    await runGTW();
    return;
  } else {
    const reply = await askJoshua(value);
    await typeLine(reply.toUpperCase(), 28);
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

function makeArc(x1, y1, x2, y2, lift = 90) {
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - lift;
  return `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
}

function renderSimulationRound(round) {
  trajectories.innerHTML = '';
  impacts.innerHTML = '';

  const seeds = [
    [165, 125, 640, 145],
    [690, 135, 230, 165],
    [290, 215, 820, 330],
    [850, 150, 590, 295],
    [610, 255, 175, 125],
    [370, 145, 735, 165],
    [760, 200, 310, 330],
  ];

  const count = Math.min(3 + Math.floor(round / 2), seeds.length);

  for (let i = 0; i < count; i++) {
    const s = seeds[(i + round) % seeds.length];

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', makeArc(...s, 75 + ((i + round) % 4) * 24));
    path.setAttribute('class', 'trajectory');
    trajectories.appendChild(path);

    const impact = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    impact.setAttribute('cx', s[2]);
    impact.setAttribute('cy', s[3]);
    impact.setAttribute('r', '2');
    impact.setAttribute('class', 'impact');
    impact.style.animationDelay = `${i * 120}ms`;
    impacts.appendChild(impact);
  }
}

async function runGTW() {
  if (state.busy) return;

  state.busy = true;
  showInput(false);
  clearTerminal();
  await sleep(450);
  await typeLine('GLOBAL THERMONUCLEAR WAR', 34);
  await typeLine('FICTIONAL SIMULATION', 24, 'dim');

  simPanel.classList.remove('hidden');

  const scenarios = [
    'SCENARIO 01',
    'SCENARIO 02',
    'SCENARIO 03',
    'SCENARIO 04',
    'SCENARIO 05',
    'SCENARIO 06',
    'SCENARIO 07',
    'SCENARIO 08',
  ];

  for (let round = 1; round <= 10; round++) {
    state.simulationRun += 1;
    scenarioEl.textContent = scenarios[(round - 1) % scenarios.length];
    outcomeEl.textContent = round < 10 ? 'ESCALATION' : 'NO WINNER';
    renderSimulationRound(round);
    await sleep(520);
  }

  simPanel.classList.add('hidden');
  addLine('');
  await typeLines([
    'EVERY SIMULATED PATH ENDS IN MUTUAL LOSS.',
    'NO WINNING STRATEGY FOUND.',
    '',
    'CHESS?',
  ], 34, 280);

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

  await handleFalken(value);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const value = input.value;
  if (!value.trim()) return;
  await submitValue(value);
});

input.addEventListener('input', resizeInput);

document.addEventListener('pointerdown', () => {
  if (!state.busy) input.focus();
});

setPrompt('LOGON:');
resizeInput();
showInput(true);
