(() => {
  const decodedVoiceCache = new Map();

  function makeSaturationCurve(amount = 10) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const k = Math.max(1, amount);

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / (samples - 1) - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }

    return curve;
  }

  async function getVoiceBuffer(text) {
    const key = String(text || '').trim().toUpperCase();
    if (!key) return null;
    if (decodedVoiceCache.has(key)) return decodedVoiceCache.get(key);

    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) throw new Error('Voice generation failed');

    const bytes = await response.arrayBuffer();
    await unlockAudio();

    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') throw new Error('Audio context unavailable');

    const decoded = await ctx.decodeAudioData(bytes.slice(0));
    decodedVoiceCache.set(key, decoded);
    return decoded;
  }

  stopJoshuaVoice = function stopJoshuaVoiceProcessed() {
    try {
      if (state.currentVoiceSource) {
        state.currentVoiceSource.stop();
        state.currentVoiceSource.disconnect();
      }
    } catch (_) {}

    state.currentVoiceSource = null;

    try {
      if (state.currentVoiceAudio) {
        state.currentVoiceAudio.pause();
        state.currentVoiceAudio.currentTime = 0;
      }
    } catch (_) {}

    state.currentVoiceAudio = null;
  };

  speakJoshua = async function speakJoshuaProcessed(text) {
    if (!state.voiceEnabled || !String(text || '').trim()) return;

    try {
      await unlockAudio();
      const buffer = await getVoiceBuffer(text);
      if (!state.voiceEnabled || !buffer) return;

      stopJoshuaVoice();

      const ctx = state.audioContext;
      if (!ctx || ctx.state !== 'running') return;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 150;
      highpass.Q.value = 0.7;

      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 1250;
      presence.Q.value = 0.9;
      presence.gain.value = 3.5;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 3350;
      lowpass.Q.value = 0.8;

      const saturator = ctx.createWaveShaper();
      saturator.curve = makeSaturationCurve(5);
      saturator.oversample = '2x';

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -28;
      compressor.knee.value = 8;
      compressor.ratio.value = 4.5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.16;

      const gain = ctx.createGain();
      gain.gain.value = 0.88;

      source.connect(highpass);
      highpass.connect(presence);
      presence.connect(lowpass);
      lowpass.connect(saturator);
      saturator.connect(compressor);
      compressor.connect(gain);
      gain.connect(ctx.destination);

      state.currentVoiceSource = source;
      source.onended = () => {
        if (state.currentVoiceSource === source) {
          state.currentVoiceSource = null;
        }
      };

      source.start();
    } catch (error) {
      console.warn('JOSHUA VOICE:', error?.message || error);
    }
  };
})();
