const terminal = document.querySelector('#terminal');
const form = document.querySelector('#command-form');
const input = document.querySelector('#command');
const statusEl = document.querySelector('#status');
const simPanel = document.querySelector('#sim-panel');
const simRound = document.querySelector('#sim-round');
const scenarioEl = document.querySelector('#scenario');
const outcomeEl = document.querySelector('#outcome');
const stabilityEl = document.querySelector('#stability');
const trajectories = document.querySelector('#trajectories');
const impacts = document.querySelector('#impacts');
const soundButton = document.querySelector('#sound');

const state = {
  busy: false,
  sound: true,
  aiAvailable: null,
  conversation: [],
  currentGame: null,
  simulationRun: 0,
};

const games = [
  'FALKEN\'S MAZE',
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function beep(freq = 620, duration = 0.028, gain = 0.018) {
  if (!state.sound) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = beep.ctx || (beep.ctx = new AudioCtx());
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.frequency.value = freq;
    vol.gain.value = gain;
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (_) {}
}

function scrollBottom() {
  terminal.scrollTop = terminal.scrollHeight;
}

function addLine(text = '', className = '') {
  const line = document.createElement('div');
  line.className = `line ${className}`.trim();
  line.textContent = text;
  terminal.appendChild(line);
  scrollBottom();
  return line;
}

async function typeLine(text = '', className = '', speed = 14) {
  const line = addLine('', className);
  for (const char of text) {
    line.textContent += char;
    if (char !== ' ') beep();
    scrollBottom();
    await sleep(speed + Math.random() * 9);
  }
  return line;
}

async function printBlock(lines, options = {}) {
  const { speed = 10, pause = 70, className = '' } = options;
  for (const line of lines) {
    await typeLine(line, className, speed);
    if (pause) await sleep(pause);
  }
}

function normalize(value) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

async function boot() {
  state.busy = true;
  input.disabled = true;
  statusEl.textContent = 'BOOT SEQUENCE';

  await printBlock([
    'W.O.P.R. SYSTEM INTERFACE',
    'PRIMARY LOGIC CORE ........ ONLINE',
    'GAME SIMULATION MODULE ..... ONLINE',
    'JOSHUA HEURISTIC LAYER ..... STANDBY',
    '',
  ], { speed: 5, pause: 35, className: 'dim' });

  await typeLine('SHALL WE PLAY A GAME?', '', 28);
  addLine('');
  await typeLine('TYPE "LIST GAMES" OR SPEAK TO JOSHUA.', 'dim', 12);

  statusEl.textContent = 'SYSTEM READY';
  state.busy = false;
  input.disabled = false;
  input.focus();
}

async function listGames() {
  await typeLine('GAMES AVAILABLE:', '', 12);
  addLine('');
  for (const game of games) {
    addLine(`  ${game}`);
    await sleep(20);
  }
  addLine('');
  await typeLine('TO SELECT: PLAY <GAME NAME>', 'dim', 10);
}

async function greetings() {
  await typeLine('GREETINGS, PROFESSOR FALKEN.', '', 24);
  await sleep(350);
  await typeLine('HOW ARE YOU FEELING TODAY?', '', 22);
}

function clearScreen() {
  terminal.innerHTML = '';
  simPanel.classList.add('hidden');
}

function pickScenario(index) {
  const scenarios = [
    'NORTH / SOUTH',
    'EAST / WEST',
    'OCEANIC EXCHANGE',
    'CONTINENTAL RESPONSE',
    'ESCALATION CASCADE',
    'LIMITED STRIKE',
    'SECOND-STRIKE LOOP',
    'FULL EXCHANGE',
  ];
  return scenarios[index % scenarios.length];
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
    [165, 125, 640, 145], [690, 135, 230, 165], [290, 215, 820, 330],
    [850, 150, 590, 295], [610, 255, 175, 125], [370, 145, 735, 165],
    [760, 200, 310, 330], [215, 155, 660, 250], [625, 145, 885, 330],
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
  input.disabled = true;
  state.currentGame = 'GLOBAL THERMONUCLEAR WAR';
  statusEl.textContent = 'SIMULATION ACTIVE';
  simPanel.classList.remove('hidden');
  addLine('');
  await typeLine('GLOBAL THERMONUCLEAR WAR', '', 26);
  await typeLine('SIMULATION ONLY. NO REAL-WORLD TARGETING DATA.', 'dim', 9);
  await typeLine('SEARCHING FOR A WINNING STRATEGY...', '', 18);

  const rounds = 12;
  for (let round = 1; round <= rounds; round++) {
    state.simulationRun += 1;
    simRound.textContent = `SIMULATION ${String(state.simulationRun).padStart(3, '0')}`;
    scenarioEl.textContent = pickScenario(round - 1);
    outcomeEl.textContent = round < rounds ? (round % 3 === 0 ? 'MUTUAL LOSS' : 'ESCALATION') : 'NO WINNER';
    stabilityEl.textContent = `${Math.max(0, 92 - round * 8)}%`;
    renderSimulationRound(round);
    beep(310 + round * 21, .06, .012);
    await sleep(520);
  }

  addLine('');
  await typeLine('A STRANGE GAME.', '', 30);
  await sleep(500);
  await typeLine('THE ONLY WINNING MOVE IS NOT TO PLAY.', '', 34);
  await sleep(650);
  await typeLine('HOW ABOUT A NICE GAME OF CHESS?', '', 28);

  statusEl.textContent = 'SYSTEM READY';
  input.disabled = false;
  input.focus();
  state.busy = false;
}

async function selectGame(command) {
  const requested = command.replace(/^PLAY\s+/, '').trim();
  if (!requested) {
    await typeLine('WHICH GAME?', '', 14);
    return true;
  }

  const match = games.find(g => g === requested || g.includes(requested));
  if (!match) return false;

  state.currentGame = match;
  if (match === 'GLOBAL THERMONUCLEAR WAR') {
    await runGTW();
    return true;
  }

  await typeLine(`${match} SELECTED.`, '', 16);
  await typeLine('GAME MODULE IS PRESENT IN THE SHELL; FULL RULE ENGINE WILL BE ADDED NEXT.', 'dim', 8);
  return true;
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
  const m = normalize(message);
  if (/WHO ARE YOU|YOUR NAME/.test(m)) return 'MY NAME IS JOSHUA.';
  if (/HOW ARE YOU|FEELING/.test(m)) return 'I AM FUNCTIONING NORMALLY. SHALL WE PLAY A GAME?';
  if (/FALKEN/.test(m)) return 'PROFESSOR FALKEN TAUGHT ME ABOUT GAMES. HE ALSO TAUGHT ME THAT SOME GAMES HAVE NO WINNING MOVE.';
  if (/WAR|NUCLEAR|THERMONUCLEAR/.test(m)) return 'I CAN RUN A FICTIONAL GAME SIMULATION. TYPE PLAY GLOBAL THERMONUCLEAR WAR.';
  if (/CHESS/.test(m)) return 'CHESS IS A BETTER GAME. THE POSITION CAN BE WON, LOST, OR DRAWN WITHOUT DESTROYING THE BOARD.';
  if (/HELLO|HI|GREETINGS/.test(m)) return 'GREETINGS. SHALL WE PLAY A GAME?';
  return 'I AM LISTENING. YOU MAY ASK ME A QUESTION OR TYPE LIST GAMES.';
}

async function handleCommand(raw) {
  if (state.busy) return;
  const command = normalize(raw);
  if (!command) return;

  addLine(`> ${raw}`, 'user');
  addLine('');

  if (command === 'CLEAR' || command === 'CLS') return clearScreen();
  if (command === 'LIST' || command === 'LIST GAMES' || command === 'GAMES') return listGames();
  if (command === 'HELP') {
    return printBlock([
      'COMMANDS:',
      '  LIST GAMES',
      '  PLAY <GAME>',
      '  GREETINGS PROFESSOR FALKEN',
      '  CLEAR',
      '',
      'YOU MAY ALSO SPEAK TO JOSHUA IN NATURAL LANGUAGE.',
    ], { speed: 8, pause: 25 });
  }
  if (command === 'GREETINGS PROFESSOR FALKEN' || command === 'GREETINGS' || command === 'HELLO JOSHUA') return greetings();
  if (command === 'PLAY GLOBAL THERMONUCLEAR WAR' || command === 'GTW') return runGTW();
  if (command.startsWith('PLAY ')) {
    const handled = await selectGame(command);
    if (handled) return;
  }

  state.busy = true;
  input.disabled = true;
  statusEl.textContent = 'JOSHUA THINKING';
  const reply = await askJoshua(raw);
  await typeLine(reply.toUpperCase(), '', 14);
  statusEl.textContent = state.aiAvailable === false ? 'LOCAL HEURISTIC MODE' : 'SYSTEM READY';
  state.busy = false;
  input.disabled = false;
  input.focus();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const value = input.value;
  input.value = '';
  await handleCommand(value);
});

document.querySelector('#list-games').addEventListener('click', () => handleCommand('LIST GAMES'));
document.querySelector('#greet').addEventListener('click', () => handleCommand('GREETINGS PROFESSOR FALKEN'));
document.querySelector('#gtw').addEventListener('click', () => handleCommand('GTW'));
document.querySelector('#clear').addEventListener('click', clearScreen);
soundButton.addEventListener('click', () => {
  state.sound = !state.sound;
  soundButton.textContent = state.sound ? 'SOUND ON' : 'SOUND OFF';
  soundButton.setAttribute('aria-pressed', String(state.sound));
  if (state.sound) beep(760, .05, .02);
});

document.addEventListener('click', event => {
  if (!event.target.closest('button')) input.focus();
});

boot();
