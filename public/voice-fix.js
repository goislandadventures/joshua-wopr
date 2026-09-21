(() => {
  const wordBlobCache = new Map();
  const wordBufferCache = new Map();
  let activeSources = [];
  let verificationInFlight = false;

  function tokenise(text) {
    return String(text || '')
      .replace(/—/g, ' ')
      .match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)?|[.,!?;:]/g) || [];
  }

  function isPunctuation(token) {
    return /^[.,!?;:]$/.test(token);
  }

  function pauseFor(token) {
    if (token === ',') return 0.115;
    if (token === ';' || token === ':') return 0.145;
    if (token === '.' || token === '!' || token === '?') return 0.205;
    return 0.055;
  }

  async function fetchWordBlob(word) {
    const key = word.toUpperCase();
    if (wordBlobCache.has(key)) return wordBlobCache.get(key);

    const response = await fetch('/api/voice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: word, mode: 'word' }),
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

    wordBlobCache.set(key, blob);
    return blob;
  }

  async function getWordBuffer(word) {
    const key = word.toUpperCase();
    if (wordBufferCache.has(key)) return wordBufferCache.get(key);

    const blob = await fetchWordBlob(word);
    await unlockAudio();

    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') throw new Error('AUDIO CONTEXT UNAVAILABLE');

    const bytes = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    wordBufferCache.set(key, buffer);
    return buffer;
  }

  async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;

    async function run() {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    }

    const runners = Array.from(
      { length: Math.min(limit, items.length) },
      () => run()
    );

    await Promise.all(runners);
    return results;
  }

  function makeQuantizeCurve(levels = 96) {
    const size = 65536;
    const curve = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const x = (i / (size - 1)) * 2 - 1;
      curve[i] = Math.round(x * levels) / levels;
    }
    return curve;
  }

  function stopCurrentVoice() {
    for (const source of activeSources) {
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    activeSources = [];
    state.currentVoiceSource = null;
  }

  function build1983Output(ctx) {
    const removeChest = ctx.createBiquadFilter();
    removeChest.type = 'lowshelf';
    removeChest.frequency.value = 520;
    removeChest.gain.value = -7.5;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 180;
    highpass.Q.value = 0.7;

    const formant1 = ctx.createBiquadFilter();
    formant1.type = 'peaking';
    formant1.frequency.value = 1050;
    formant1.Q.value = 1.05;
    formant1.gain.value = 3.4;

    const formant2 = ctx.createBiquadFilter();
    formant2.type = 'peaking';
    formant2.frequency.value = 2300;
    formant2.Q.value = 1.15;
    formant2.gain.value = 2.6;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3400;
    lowpass.Q.value = 0.72;

    const quantizer = ctx.createWaveShaper();
    quantizer.curve = makeQuantizeCurve(112);
    quantizer.oversample = 'none';

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 3;
    compressor.ratio.value = 5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.12;

    const output = ctx.createGain();
    output.gain.value = 0.82;

    removeChest.connect(highpass);
    highpass.connect(formant1);
    formant1.connect(formant2);
    formant2.connect(lowpass);
    lowpass.connect(quantizer);
    quantizer.connect(compressor);
    compressor.connect(output);
    output.connect(ctx.destination);

    return removeChest;
  }

  async function playConcatenative(text) {
    const tokens = tokenise(text);
    const words = tokens.filter(token => !isPunctuation(token));
    if (!words.length) return;

    await unlockAudio();
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') throw new Error('AUDIO CONTEXT UNAVAILABLE');

    const unique = [...new Set(words.map(word => word.toUpperCase()))];
    await mapLimit(unique, 4, word => getWordBuffer(word));

    stopCurrentVoice();

    const inputNode = build1983Output(ctx);
    let cursor = ctx.currentTime + 0.035;
    let lastWord = null;

    for (const token of tokens) {
      if (isPunctuation(token)) {
        cursor += pauseFor(token);
        continue;
      }

      const buffer = wordBufferCache.get(token.toUpperCase());
      if (!buffer) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Backend speaks slowly; this lift makes the register smaller/youthful
      // while fixed word gaps preserve the deliberately mechanical cadence.
      source.playbackRate.value = 1.14;
      source.connect(inputNode);
      source.start(cursor);

      activeSources.push(source);
      const spokenDuration = buffer.duration / source.playbackRate.value;
      cursor += Math.max(0.12, spokenDuration) + 0.050;
      lastWord = source;
    }

    state.currentVoiceSource = lastWord;

    if (lastWord) {
      lastWord.onended = () => {
        activeSources = [];
        if (state.currentVoiceSource === lastWord) {
          state.currentVoiceSource = null;
        }
      };
    }
  }

  stopJoshuaVoice = function stopJoshuaVoiceConcatenative() {
    stopCurrentVoice();
  };

  speakJoshua = async function speakJoshuaConcatenative(text) {
    if (!state.voiceEnabled || !String(text || '').trim()) return;

    try {
      await playConcatenative(text);
      window.__joshuaVoiceStatus = { ok: true, error: null, mode: 'concatenative-word' };
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
      await playConcatenative('READY');
      if (!state.voiceEnabled) return;

      if (voiceStateEl) voiceStateEl.textContent = 'VOICE ON';
      window.__joshuaVoiceStatus = { ok: true, error: null, mode: 'concatenative-word' };
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