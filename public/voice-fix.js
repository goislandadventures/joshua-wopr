(() => {
  const voiceCache = new Map();
  const decodedCache = new Map();
  let currentSource = null;
  let verificationInFlight = false;

  async function requestVoiceBlob(text) {
    const key = String(text || '').trim().toUpperCase();
    if (!key) return null;
    if (voiceCache.has(key)) return voiceCache.get(key);

    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const detail = [
        data?.status,
        data?.code,
        data?.type,
        data?.detail,
        data?.error,
      ].filter(Boolean).join(' | ');
      throw new Error(detail || ('VOICE HTTP ' + response.status));
    }

    const blob = await response.blob();
    if (!blob.size) throw new Error('EMPTY VOICE RESPONSE');
    voiceCache.set(key, blob);
    return blob;
  }

  async function decodeVoice(text, blob) {
    const key = String(text || '').trim().toUpperCase();
    if (decodedCache.has(key)) return decodedCache.get(key);

    await unlockAudio();
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') throw new Error('AUDIO CONTEXT UNAVAILABLE');

    const bytes = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    decodedCache.set(key, buffer);
    return buffer;
  }

  function makeSoftClipCurve(amount = 2.2) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / (samples - 1) - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  function stopCurrentVoice() {
    if (!currentSource) return;
    try { currentSource.stop(); } catch (_) {}
    try { currentSource.disconnect(); } catch (_) {}
    currentSource = null;
    state.currentVoiceSource = null;
  }

  async function playVoice(text, blob) {
    stopCurrentVoice();
    const buffer = await decodeVoice(text, blob);

    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') throw new Error('AUDIO CONTEXT UNAVAILABLE');

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Raise apparent age/register while the backend deliberately speaks slowly.
    source.playbackRate.value = 1.13;

    const removeChest = ctx.createBiquadFilter();
    removeChest.type = 'lowshelf';
    removeChest.frequency.value = 520;
    removeChest.gain.value = -9;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 250;
    highpass.Q.value = 0.72;

    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 1750;
    presence.Q.value = 1.15;
    presence.gain.value = 5.2;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3250;
    lowpass.Q.value = 0.75;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSoftClipCurve(1.45);
    shaper.oversample = '2x';

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -30;
    compressor.knee.value = 4;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.11;

    const output = ctx.createGain();
    output.gain.value = 0.84;

    // Very light amplitude flutter gives the voice an early-synth machine texture.
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.value = 18;
    lfoDepth.gain.value = 0.025;
    lfo.connect(lfoDepth);
    lfoDepth.connect(output.gain);

    source.connect(removeChest);
    removeChest.connect(highpass);
    highpass.connect(presence);
    presence.connect(lowpass);
    lowpass.connect(shaper);
    shaper.connect(compressor);
    compressor.connect(output);
    output.connect(ctx.destination);

    currentSource = source;
    state.currentVoiceSource = source;

    source.onended = () => {
      try { lfo.stop(); } catch (_) {}
      if (currentSource === source) currentSource = null;
      if (state.currentVoiceSource === source) state.currentVoiceSource = null;
    };

    lfo.start();
    source.start();
  }

  stopJoshuaVoice = function stopJoshuaVoiceSynthetic() {
    stopCurrentVoice();
  };

  speakJoshua = async function speakJoshuaSynthetic(text) {
    if (!state.voiceEnabled || !String(text || '').trim()) return;

    try {
      const blob = await requestVoiceBlob(text);
      if (!state.voiceEnabled || !blob) return;
      await playVoice(text, blob);
      window.__joshuaVoiceStatus = { ok: true, error: null };
    } catch (error) {
      const message = error?.message || 'VOICE FAILED';
      window.__joshuaVoiceStatus = { ok: false, error: message };
      console.error('JOSHUA VOICE:', message);
    }
  };

  async function verifyVoiceOn() {
    if (verificationInFlight || !state.voiceEnabled) return;
    verificationInFlight = true;

    if (voiceStateEl) voiceStateEl.textContent = 'CHECKING';

    try {
      const blob = await requestVoiceBlob('READY');
      if (!state.voiceEnabled) return;

      await playVoice('READY', blob);
      if (voiceStateEl) voiceStateEl.textContent = 'VOICE ON';
      window.__joshuaVoiceStatus = { ok: true, error: null };
    } catch (error) {
      const message = error?.message || 'VOICE FAILED';
      console.error('JOSHUA VOICE VERIFY:', message);
      window.__joshuaVoiceStatus = { ok: false, error: message };

      setVoiceEnabled(false);
      if (voiceStateEl) {
        let label = 'VOICE ERROR';
        if (/credit_balance_exhausted/i.test(message)) label = 'NO API CREDIT';
        else if (/insufficient_quota|spend_limit|usage_limit/i.test(message)) label = 'API LIMIT';
        else if (/401|authentication|invalid_api_key/i.test(message)) label = 'KEY ERROR';
        else if (/429|rate_limit/i.test(message)) label = 'RATE LIMIT';
        voiceStateEl.textContent = label;
        voiceSwitch?.setAttribute('title', message);
      }
    } finally {
      verificationInFlight = false;
    }
  }

  voiceSwitch?.addEventListener('click', () => {
    requestAnimationFrame(() => {
      if (state.voiceEnabled) void verifyVoiceOn();
    });
  });

  setVoiceEnabled(false);
})();