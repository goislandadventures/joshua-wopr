(() => {
  let toneBuffer = null;
  let boundContext = null;

  function buildToneBuffer(ctx) {
    if (!ctx || ctx.state === 'closed') return null;
    if (toneBuffer && boundContext === ctx) return toneBuffer;

    const duration = 0.050;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let phase = 0;
    for (let i = 0; i < length; i++) {
      const p = i / Math.max(1, length - 1);
      const freq = 860 - (190 * p);
      phase += (2 * Math.PI * freq) / ctx.sampleRate;

      const square = Math.sin(phase) >= 0 ? 1 : -1;
      const overtone = Math.sin(phase * 2) * 0.10;
      const attack = Math.min(1, p / 0.06);
      const release = Math.pow(1 - p, 2.15);
      data[i] = (square * 0.74 + overtone) * attack * release * 0.24;
    }

    toneBuffer = buffer;
    boundContext = ctx;
    return buffer;
  }

  function playTypingTone() {
    const ctx = state.audioContext;
    if (!ctx || ctx.state === 'closed') return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
      return;
    }

    if (ctx.state !== 'running') return;

    const buffer = buildToneBuffer(ctx);
    if (!buffer) return;

    try {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch (_) {}
  }

  // Replace both the global property and global function binding.
  window.terminalTone = playTypingTone;
  try { terminalTone = playTypingTone; } catch (_) {}

  async function armTerminalAudio() {
    try {
      await unlockAudio();
      if (state.audioContext?.state === 'running') buildToneBuffer(state.audioContext);
    } catch (_) {}
  }

  // Every machine-rendered character uses this local tone function directly.
  typeLine = async function typeLineReliableAudio(text = '', speed = 28, className = '') {
    void unlockAudio();

    const line = addLine('', className);
    for (const char of text) {
      line.textContent += char;
      playTypingTone();
      if (typeof scrollTerminalBottom === 'function') scrollTerminalBottom();
      await sleep((speed * 1.16) + 4 + Math.random() * 10);
    }
    return line;
  };

  // User interaction only arms audio; it never owns terminal state or focus.
  document.addEventListener('keydown', armTerminalAudio, { capture: true });
  document.addEventListener('pointerdown', armTerminalAudio, { capture: true });
  window.addEventListener('focus', armTerminalAudio);

  setVoiceEnabled(false);
})();