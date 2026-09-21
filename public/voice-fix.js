(() => {
  const voiceBufferCache = new Map();
  let currentSource = null;

  function stopCurrentVoice() {
    if (!currentSource) return;
    try { currentSource.stop(); } catch (_) {}
    try { currentSource.disconnect(); } catch (_) {}
    currentSource = null;
    state.currentVoiceSource = null;
  }

  async function getVoiceBuffer(text) {
    const key = String(text || '').trim().toUpperCase();
    if (!key) return null;
    if (voiceBufferCache.has(key)) return voiceBufferCache.get(key);

    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, mode: 'sentence' }),
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

    const bytes = await response.arrayBuffer();
    await unlockAudio();

    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') throw new Error('AUDIO CONTEXT UNAVAILABLE');

    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    voiceBufferCache.set(key, buffer);
    return buffer;
  }

  function buildJoshuaOutput(ctx) {
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 210;
    highpass.Q.value = 0.72;

    const removeChest = ctx.createBiquadFilter();
    removeChest.type = 'lowshelf';
    removeChest.frequency.value = 520;
    removeChest.gain.value = -8;

    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 1650;
    presence.Q.value = 1.15;
    presence.gain.value = 4.2;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3500;
    lowpass.Q.value = 0.72;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -29;
    compressor.knee.value = 4;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.11;

    const gain = ctx.createGain();
    gain.gain.value = 0.86;

    highpass.connect(removeChest);
    removeChest.connect(presence);
    presence.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(gain);
    gain.connect(ctx.destination);

    return highpass;
  }

  stopJoshuaVoice = function stopJoshuaVoiceContinuous() {
    stopCurrentVoice();
  };

  speakJoshua = async function speakJoshuaContinuous(text) {
    if (!state.voiceEnabled || !String(text || '').trim()) return;

    try {
      if (typeof window.__joshuaWaitForMovieAudio === 'function') {
        await window.__joshuaWaitForMovieAudio();
      }
      if (!state.voiceEnabled || window.__joshuaMovieAudioActive) return;

      const buffer = await getVoiceBuffer(text);
      if (!buffer || !state.voiceEnabled || window.__joshuaMovieAudioActive) return;

      stopCurrentVoice();

      const ctx = state.audioContext;
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Keep the smoother phrase-level cadence but raise the apparent register.
      source.playbackRate.value = 1.17;
      source.connect(buildJoshuaOutput(ctx));

      currentSource = source;
      state.currentVoiceSource = source;
      source.onended = () => {
        if (currentSource === source) currentSource = null;
        if (state.currentVoiceSource === source) state.currentVoiceSource = null;
      };

      source.start();
      window.__joshuaVoiceStatus = { ok: true, error: null, mode: 'continuous' };
    } catch (error) {
      const message = error?.message || 'VOICE FAILED';
      window.__joshuaVoiceStatus = { ok: false, error: message };
      console.error('JOSHUA VOICE:', message);

      if (voiceStateEl && state.voiceEnabled) {
        if (/credit_balance_exhausted/i.test(message)) voiceStateEl.textContent = 'NO API CREDIT';
        else if (/401|authentication|invalid_api_key/i.test(message)) voiceStateEl.textContent = 'KEY ERROR';
        else if (/429|rate_limit|usage_limit|spend_limit/i.test(message)) voiceStateEl.textContent = 'API LIMIT';
        else voiceStateEl.textContent = 'VOICE ERROR';
      }
    }
  };

  // IMPORTANT: no click handler here.
  // app.js owns the switch, so enabling voice never launches a network request
  // and never interferes with terminal focus or keyboard input.
  setVoiceEnabled(false);
})();