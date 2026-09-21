(() => {
  let toneBuffer = null;
  let boundContext = null;

  function buildToneBuffer(ctx) {
    if (!ctx || ctx.state === 'closed') return null;
    if (toneBuffer && boundContext === ctx) return toneBuffer;

    const duration = 0.040;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let phase = 0;
    for (let i = 0; i < length; i++) {
      const p = i / Math.max(1, length - 1);
      const freq = 1320 - (360 * p);
      phase += (2 * Math.PI * freq) / ctx.sampleRate;

      const square = Math.sin(phase) >= 0 ? 1 : -1;
      const overtone = Math.sin(phase * 2) * 0.20;
      const attack = Math.min(1, p / 0.07);
      const release = Math.pow(1 - p, 2.1);
      const envelope = attack * release;

      data[i] = (square * 0.80 + overtone) * envelope * 0.22;
    }

    toneBuffer = buffer;
    boundContext = ctx;
    return buffer;
  }

  window.terminalTone = function terminalToneReliable() {
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') return;

    const buffer = buildToneBuffer(ctx);
    if (!buffer) return;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1, ctx.currentTime);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    } catch (_) {}
  };

  async function armTerminalAudio() {
    try {
      await unlockAudio();
      if (state.audioContext?.state === 'running') {
        buildToneBuffer(state.audioContext);
      }
    } catch (_) {}
  }

  document.addEventListener('keydown', armTerminalAudio, { capture: true });
  document.addEventListener('pointerdown', armTerminalAudio, { capture: true });
  window.addEventListener('focus', armTerminalAudio);

  // Spoken JOSHUA voice starts OFF. This does not affect typing or game FX.
  setVoiceEnabled(false);
})();
