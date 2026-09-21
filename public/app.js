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
const targetMarkers = document.querySelector('#target-markers');
const sideScreen = document.querySelector('#sim-side-screen');
const mapScreen = document.querySelector('#sim-map-screen');
const sidePrompt = document.querySelector('#side-prompt');
const sideChoiceText = document.querySelector('#side-choice');
const targetSummary = document.querySelector('#target-summary');
const soundButton = document.querySelector('#sound');

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 460;

const state = {
  busy: false,
  sound: true,
  aiAvailable: null,
  conversation: [],
  currentGame: null,
  simulationRun: 0,
  gtwStage: null,
  gtwSide: null,
  gtwTargets: [],
  gtwPlan: [],
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

const TARGETS = {
  MIAMI: { label: 'MIAMI', lat: 25.7617, lon: -80.1918, aliases: ['MIAMI', 'MIA'] },
  WASHINGTON: { label: 'WASHINGTON', lat: 38.9072, lon: -77.0369, aliases: ['WASHINGTON', 'WASHINGTON DC', 'DC'] },
  NEW_YORK: { label: 'NEW YORK', lat: 40.7128, lon: -74.006, aliases: ['NEW YORK', 'NYC'] },
  BOSTON: { label: 'BOSTON', lat: 42.3601, lon: -71.0589, aliases: ['BOSTON'] },
  NORFOLK: { label: 'NORFOLK', lat: 36.8508, lon: -76.2859, aliases: ['NORFOLK'] },
  CHICAGO: { label: 'CHICAGO', lat: 41.8781, lon: -87.6298, aliases: ['CHICAGO'] },
  DETROIT: { label: 'DETROIT', lat: 42.3314, lon: -83.0458, aliases: ['DETROIT'] },
  ATLANTA: { label: 'ATLANTA', lat: 33.749, lon: -84.388, aliases: ['ATLANTA'] },
  DALLAS: { label: 'DALLAS', lat: 32.7767, lon: -96.797, aliases: ['DALLAS'] },
  HOUSTON: { label: 'HOUSTON', lat: 29.7604, lon: -95.3698, aliases: ['HOUSTON'] },
  DENVER: { label: 'DENVER', lat: 39.7392, lon: -104.9903, aliases: ['DENVER'] },
  LOS_ANGELES: { label: 'LOS ANGELES', lat: 34.0522, lon: -118.2437, aliases: ['LOS ANGELES', 'LA'] },
  SAN_FRANCISCO: { label: 'SAN FRANCISCO', lat: 37.7749, lon: -122.4194, aliases: ['SAN FRANCISCO', 'SF'] },
  SEATTLE: { label: 'SEATTLE', lat: 47.6062, lon: -122.3321, aliases: ['SEATTLE'] },
  OMAHA: { label: 'OMAHA', lat: 41.2565, lon: -95.9345, aliases: ['OMAHA'] },

  MOSCOW: { label: 'MOSCOW', lat: 55.7558, lon: 37.6173, aliases: ['MOSCOW'] },
  LENINGRAD: { label: 'LENINGRAD', lat: 59.9311, lon: 30.3609, aliases: ['LENINGRAD', 'ST PETERSBURG', 'SAINT PETERSBURG'] },
  KIEV: { label: 'KIEV', lat: 50.4501, lon: 30.5234, aliases: ['KIEV', 'KYIV'] },
  MINSK: { label: 'MINSK', lat: 53.9, lon: 27.5667, aliases: ['MINSK'] },
  MURMANSK: { label: 'MURMANSK', lat: 68.9585, lon: 33.0827, aliases: ['MURMANSK'] },
  VOLGOGRAD: { label: 'VOLGOGRAD', lat: 48.708, lon: 44.5133, aliases: ['VOLGOGRAD', 'STALINGRAD'] },
  NOVOSIBIRSK: { label: 'NOVOSIBIRSK', lat: 55.0084, lon: 82.9357, aliases: ['NOVOSIBIRSK'] },
  VLADIVOSTOK: { label: 'VLADIVOSTOK', lat: 43.1155, lon: 131.8855, aliases: ['VLADIVOSTOK'] },

  LONDON: { label: 'LONDON', lat: 51.5074, lon: -0.1278, aliases: ['LONDON'] },
  PARIS: { label: 'PARIS', lat: 48.8566, lon: 2.3522, aliases: ['PARIS'] },
  BERLIN: { label: 'BERLIN', lat: 52.52, lon: 13.405, aliases: ['BERLIN'] },
  ROME: { label: 'ROME', lat: 41.9028, lon: 12.4964, aliases: ['ROME'] },
  TEHRAN: { label: 'TEHRAN', lat: 35.6892, lon: 51.389, aliases: ['TEHRAN'] },
  BEIJING: { label: 'BEIJING', lat: 39.9042, lon: 116.4074, aliases: ['BEIJING', 'PEKING'] },
  TOKYO: { label: 'TOKYO', lat: 35.6762, lon: 139.6503, aliases: ['TOKYO'] },
  SEOUL: { label: 'SEOUL', lat: 37.5665, lon: 126.978, aliases: ['SEOUL'] },
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function beep(freq = 560, duration = 0.04, gain = 0.014) {
  if (!state.sound) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = beep.ctx || (beep.ctx = new AudioCtx());
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const vol = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(180, freq * 0.84), ctx.currentTime + duration * 0.85);

    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 1.1;

    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(vol);
    vol.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.01);
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

async function typeLine(text = '', className = '', speed = 17) {
  const line = addLine('', className);
  for (const char of text) {
    line.textContent += char;
    beep();
    scrollBottom();
    await sleep(speed + Math.random() * 10);
  }
  return line;
}

async function printBlock(lines, options = {}) {
  const { speed = 12, pause = 70, className = '' } = options;
  for (const line of lines) {
    await typeLine(line, className, speed);
    if (pause) await sleep(pause);
  }
}

function normalize(value) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function clearScreen() {
  terminal.innerHTML = '';
  hideSimulation();
}

function hideSimulation() {
  simPanel.classList.add('hidden');
  sideScreen.classList.remove('hidden');
  mapScreen.classList.add('hidden');
  trajectories.innerHTML = '';
  impacts.innerHTML = '';
  targetMarkers.innerHTML = '';
  targetSummary.textContent = 'NO TARGETS LOCKED';
  sideChoiceText.textContent = '--';
}

function showSideSelection() {
  simPanel.classList.remove('hidden');
  sideScreen.classList.remove('hidden');
  mapScreen.classList.add('hidden');
  sideChoiceText.textContent = state.gtwSide || '--';
  targetSummary.textContent = 'AWAITING SIDE SELECTION';
}

function showMapScreen() {
  simPanel.classList.remove('hidden');
  sideScreen.classList.add('hidden');
  mapScreen.classList.remove('hidden');
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
  ], { speed: 6, pause: 40, className: 'dim' });

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

function pickScenario(index) {
  const scenarios = [
    'FIRST STRIKE',
    'RETALIATORY STRIKE',
    'COUNTERFORCE EXCHANGE',
    'COUNTERVALUE EXCHANGE',
    'ESCALATION CASCADE',
    'THEATER ESCALATION',
    'SECOND STRIKE',
    'FULL EXCHANGE',
  ];
  return scenarios[index % scenarios.length];
}

function projectLonLat(lon, lat) {
  const x = ((lon + 180) / 360) * MAP_WIDTH;
  const y = ((90 - lat) / 180) * MAP_HEIGHT;
  return { x, y };
}

function cityPoint(key) {
  const target = TARGETS[key];
  if (!target) return null;
  return { ...target, ...projectLonLat(target.lon, target.lat) };
}

function resolveTarget(raw) {
  const cleaned = normalize(raw).replace(/[.,]/g, '').trim();
  if (!cleaned) return null;

  for (const [key, target] of Object.entries(TARGETS)) {
    if (target.aliases.some(alias => alias === cleaned)) {
      return { key, ...target, ...projectLonLat(target.lon, target.lat) };
    }
  }

  return null;
}

function makeArc(x1, y1, x2, y2, arcFactor = 1) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.hypot(dx, dy);
  const lift = Math.max(120, Math.min(240, distance * 0.38)) * arcFactor;
  const mx = (x1 + x2) / 2;
  const my = Math.min(y1, y2) - lift;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function updateSideSelectionUI() {
  const selected = state.gtwSide || '--';
  sideChoiceText.textContent = selected;
  sidePrompt.textContent = state.gtwStage === 'gtw-side'
    ? 'PLEASE CHOOSE ONE'
    : state.gtwStage === 'gtw-target-1'
      ? 'ENTER PRIMARY TARGET 1'
      : state.gtwStage === 'gtw-target-2'
        ? 'ENTER PRIMARY TARGET 2'
        : 'TARGETING COMPLETE';

  document.querySelectorAll('[data-side-card]').forEach(card => {
    card.classList.toggle('selected', card.dataset.sideCard === selected);
  });
}

function renderTargets(targetsToRender = state.gtwTargets) {
  targetMarkers.innerHTML = '';

  targetsToRender.forEach((target, index) => {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'target-group');

    const halo = document.createElementNS(SVG_NS, 'circle');
    halo.setAttribute('cx', target.x);
    halo.setAttribute('cy', target.y);
    halo.setAttribute('r', 9 + index * 1.6);
    halo.setAttribute('class', 'target-halo');
    halo.style.animationDelay = `${index * 120}ms`;

    const core = document.createElementNS(SVG_NS, 'circle');
    core.setAttribute('cx', target.x);
    core.setAttribute('cy', target.y);
    core.setAttribute('r', '2.8');
    core.setAttribute('class', 'target-core');

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', target.x + 7);
    label.setAttribute('y', target.y - 7);
    label.setAttribute('class', 'target-label');
    label.textContent = target.label;

    group.append(halo, core, label);
    targetMarkers.append(halo, core, label);
  });

  targetSummary.textContent = targetsToRender.length
    ? targetsToRender.map(target => target.label).join(' // ')
    : 'NO TARGETS LOCKED';
}

function buildStrikePlan() {
  const usLaunch = ['SEATTLE', 'OMAHA', 'NORFOLK', 'MIAMI', 'LOS_ANGELES'];
  const usTargets = ['MOSCOW', 'LENINGRAD', 'KIEV', 'VOLGOGRAD', 'NOVOSIBIRSK', 'VLADIVOSTOK'];
  const ussrLaunch = ['MURMANSK', 'LENINGRAD', 'MOSCOW', 'VOLGOGRAD', 'VLADIVOSTOK'];
  const ussrTargets = ['SEATTLE', 'LOS_ANGELES', 'OMAHA', 'CHICAGO', 'WASHINGTON', 'MIAMI', 'NORFOLK'];

  const playerIsUS = state.gtwSide === 'UNITED STATES';
  const outboundLaunchKeys = playerIsUS ? usLaunch : ussrLaunch;
  const outboundDefaultTargetKeys = playerIsUS ? usTargets : ussrTargets;
  const inboundLaunchKeys = playerIsUS ? ussrLaunch : usLaunch;
  const inboundDefaultTargetKeys = playerIsUS ? ussrTargets : usTargets;

  const selectedTargets = state.gtwTargets.map(t => t.key);
  const outboundTargets = [...new Set([...selectedTargets, ...outboundDefaultTargetKeys])].slice(0, 7);
  const inboundTargets = inboundDefaultTargetKeys.slice(0, 6);

  const plan = [];

  outboundTargets.forEach((targetKey, index) => {
    const fromKey = outboundLaunchKeys[index % outboundLaunchKeys.length];
    const from = cityPoint(fromKey);
    const to = cityPoint(targetKey);
    if (!from || !to) return;
    plan.push({ from, to, type: 'player', delay: index * 90 });
  });

  inboundTargets.forEach((targetKey, index) => {
    const fromKey = inboundLaunchKeys[index % inboundLaunchKeys.length];
    const from = cityPoint(fromKey);
    const to = cityPoint(targetKey);
    if (!from || !to) return;
    plan.push({ from, to, type: 'counter', delay: index * 90 + 60 });
  });

  return plan;
}

function renderSimulationRound(round) {
  trajectories.innerHTML = '';
  impacts.innerHTML = '';

  const visibleCount = Math.min(state.gtwPlan.length, 3 + round * 2);
  const visible = state.gtwPlan.slice(0, visibleCount);

  visible.forEach((strike, index) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', makeArc(strike.from.x, strike.from.y, strike.to.x, strike.to.y, strike.type === 'player' ? 1.15 : 1.05));
    path.setAttribute('class', `trajectory ${strike.type}`);
    path.style.animationDelay = `${strike.delay}ms`;
    trajectories.appendChild(path);

    const impact = document.createElementNS(SVG_NS, 'circle');
    impact.setAttribute('cx', strike.to.x);
    impact.setAttribute('cy', strike.to.y);
    impact.setAttribute('r', '2.5');
    impact.setAttribute('class', `impact ${strike.type}`);
    impact.style.animationDelay = `${strike.delay + 180}ms`;
    impacts.appendChild(impact);
  });
}

async function runGTW() {
  if (state.busy) return;

  state.currentGame = 'GLOBAL THERMONUCLEAR WAR';
  state.gtwStage = 'gtw-side';
  state.gtwSide = null;
  state.gtwTargets = [];
  state.gtwPlan = [];

  updateSideSelectionUI();
  renderTargets([]);
  showSideSelection();

  state.busy = true;
  input.disabled = true;
  statusEl.textContent = 'GTW SIDE SELECTION';

  addLine('');
  await typeLine('GLOBAL THERMONUCLEAR WAR', '', 22);
  await typeLine('WHICH SIDE DO YOU WANT?', '', 18);
  await typeLine('  1. UNITED STATES', 'dim', 11);
  await typeLine('  2. SOVIET UNION', 'dim', 11);
  await typeLine('PLEASE CHOOSE ONE.', '', 15);

  statusEl.textContent = 'AWAITING SIDE SELECTION';
  state.busy = false;
  input.disabled = false;
  input.focus();
}

async function beginExchange() {
  showMapScreen();
  state.gtwStage = 'gtw-running';
  state.gtwPlan = buildStrikePlan();
  renderTargets();

  state.busy = true;
  input.disabled = true;
  statusEl.textContent = 'SIMULATION ACTIVE';

  addLine('');
  await typeLine(`SIDE SELECTED: ${state.gtwSide}`, '', 14);
  await typeLine(`PRIMARY TARGETS: ${state.gtwTargets.map(t => t.label).join(' // ')}`, 'dim', 9);
  await typeLine('CALCULATING STRIKE TRAJECTORIES...', '', 15);

  const rounds = 6;
  for (let round = 1; round <= rounds; round++) {
    state.simulationRun += 1;
    simRound.textContent = `SIMULATION ${String(state.simulationRun).padStart(3, '0')}`;
    scenarioEl.textContent = pickScenario(round - 1);
    outcomeEl.textContent = round < rounds ? (round < 4 ? 'ESCALATION' : 'MUTUAL LOSS') : 'NO WINNER';
    stabilityEl.textContent = `${Math.max(0, 88 - round * 13)}%`;
    renderSimulationRound(round);
    beep(300 + round * 26, 0.08, 0.012);
    await sleep(650);
  }

  addLine('');
  await typeLine('A STRANGE GAME.', '', 30);
  await sleep(460);
  await typeLine('THE ONLY WINNING MOVE IS NOT TO PLAY.', '', 34);
  await sleep(620);
  await typeLine('HOW ABOUT A NICE GAME OF CHESS?', '', 28);

  statusEl.textContent = 'SYSTEM READY';
  input.disabled = false;
  input.focus();
  state.currentGame = null;
  state.gtwStage = null;
  state.busy = false;
}

async function handleGTWInput(raw) {
  const command = normalize(raw);
  addLine(`> ${raw}`, 'user');
  addLine('');

  if (state.gtwStage === 'gtw-side') {
    if (command === '1' || command === 'UNITED STATES' || command === 'US' || command === 'USA') {
      state.gtwSide = 'UNITED STATES';
    } else if (command === '2' || command === 'SOVIET UNION' || command === 'USSR' || command === 'SOVIET') {
      state.gtwSide = 'SOVIET UNION';
    } else {
      await typeLine('PLEASE CHOOSE 1 OR 2.', 'warn', 13);
      return;
    }

    state.gtwStage = 'gtw-target-1';
    updateSideSelectionUI();
    statusEl.textContent = 'ENTER PRIMARY TARGET';
    await typeLine(`SIDE ACCEPTED: ${state.gtwSide}`, '', 14);
    await typeLine('ENTER PRIMARY TARGET 1.', '', 15);
    return;
  }

  if (state.gtwStage === 'gtw-target-1' || state.gtwStage === 'gtw-target-2') {
    const target = resolveTarget(raw);

    if (!target) {
      await typeLine('TARGET NOT IN LIBRARY. TRY A MAJOR CITY SUCH AS MIAMI, MOSCOW, NEW YORK, OR TOKYO.', 'warn', 9);
      return;
    }

    if (state.gtwTargets.some(item => item.key === target.key)) {
      await typeLine('TARGET ALREADY LOCKED. CHOOSE ANOTHER CITY.', 'warn', 11);
      return;
    }

    state.gtwTargets.push(target);
    renderTargets();

    if (state.gtwStage === 'gtw-target-1') {
      state.gtwStage = 'gtw-target-2';
      updateSideSelectionUI();
      await typeLine(`TARGET 1 LOCKED: ${target.label}`, '', 14);
      await typeLine('ENTER PRIMARY TARGET 2.', '', 15);
      return;
    }

    await typeLine(`TARGET 2 LOCKED: ${target.label}`, '', 14);
    updateSideSelectionUI();
    await beginExchange();
  }
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

function extractResponseText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if ((content?.type === 'output_text' || content?.type === 'text') && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
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
    const text = extractResponseText(data) || data?.text;
    if (!text) throw new Error('No text');
    state.aiAvailable = true;
    state.conversation.push({ role: 'assistant', content: text });
    state.conversation = state.conversation.slice(-10);
    return text;
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
  return 'I UNDERSTAND. ASK ME SOMETHING OR TYPE LIST GAMES.';
}

async function handleCommand(raw) {
  if (state.busy) return;
  const command = normalize(raw);
  if (!command) return;

  if (state.currentGame === 'GLOBAL THERMONUCLEAR WAR' && state.gtwStage && state.gtwStage !== 'gtw-running') {
    await handleGTWInput(raw);
    return;
  }

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
  if (state.sound) beep(700, 0.06, 0.018);
});

document.addEventListener('click', event => {
  if (!event.target.closest('button')) input.focus();
});

hideSimulation();
boot();
