(() => {
  let tts = null;
  let ttsReady = false;
  let ttsReadyResolve;
  let currentPusher = null;
  let generation = 0;

  const ttsReadyPromise = new Promise(resolve => {
    ttsReadyResolve = resolve;
  });

  function normalizeSpeechText(text) {
    return String(text || '')
      // JOSHUA says the article "A" as a clean AY, not a conversational schwa.
      .replace(/\bA\b/g, 'AY')
      .replace(/\ba\b/g, 'ay');
  }

  function makeQuantizeCurve(levels = 112) {
    const size = 32768;
    const curve = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const x = (i / (size - 1)) * 2 - 1;
      curve[i] = Math.round(x * levels) / levels;
    }
    return curve;
  }

  function buildJoshuaOutput(ctx) {
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

    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.86;

    const tremolo = ctx.createOscillator();
    const tremoloDepth = ctx.createGain();
    tremolo.frequency.value = 17;
    tremoloDepth.gain.value = 0.028;
    tremolo.connect(tremoloDepth);
    tremoloDepth.connect(tremoloGain.gain);
    tremolo.start();

    removeChest.connect(highpass);
    highpass.connect(formant1);
    formant1.connect(formant2);
    formant2.connect(lowpass);
    lowpass.connect(quantizer);
    quantizer.connect(compressor);
    compressor.connect(tremoloGain);
    tremoloGain.connect(ctx.destination);

    return {
      input: removeChest,
      dispose() {
        try { tremolo.stop(); } catch (_) {}
        try { tremolo.disconnect(); } catch (_) {}
        try { tremoloDepth.disconnect(); } catch (_) {}
      },
    };
  }

  function PushAudioNode(context, startCallback, endCallback, bufferSize = 4096) {
    this.context = context;
    this.startCallback = startCallback;
    this.endCallback = endCallback;
    this.bufferSize = bufferSize;
    this.samplesQueue = [];
    this.scriptNode = context.createScriptProcessor(this.bufferSize, 1, 1);
    this.connected = false;
    this.sinks = [];
    this.startTime = 0;
    this.closed = false;
  }

  PushAudioNode.prototype.push = function push(chunk) {
    if (this.closed) return;
    this.samplesQueue.push(chunk);
    if (!this.connected && this.sinks.length) this._connect();
  };

  PushAudioNode.prototype.close = function close() {
    this.closed = true;
  };

  PushAudioNode.prototype.connect = function connect(dest) {
    this.sinks.push(dest);
    if (this.samplesQueue.length && !this.connected) this._connect();
  };

  PushAudioNode.prototype._connect = function doConnect() {
    if (this.connected) return;
    this.connected = true;
    for (const dest of this.sinks) this.scriptNode.connect(dest);
    this.scriptNode.onaudioprocess = this.handleEvent.bind(this);
  };

  PushAudioNode.prototype.disconnect = function disconnect() {
    try { this.scriptNode.onaudioprocess = null; } catch (_) {}
    try { this.scriptNode.disconnect(); } catch (_) {}
    this.connected = false;
    this.samplesQueue = [];
    this.closed = true;
  };

  PushAudioNode.prototype.handleEvent = function handleEvent(evt) {
    if (!this.startTime) {
      this.startTime = evt.playbackTime;
      if (this.startCallback) this.startCallback();
    }

    let offset = 0;
    while (this.samplesQueue.length && offset < evt.target.bufferSize) {
      let chunk = this.samplesQueue[0];
      const toCopy = chunk.subarray(0, evt.target.bufferSize - offset);

      if (evt.outputBuffer.copyToChannel) {
        evt.outputBuffer.copyToChannel(toCopy, 0, offset);
      } else {
        evt.outputBuffer.getChannelData(0).set(toCopy, offset);
      }

      offset += toCopy.length;
      chunk = chunk.subarray(toCopy.length);

      if (chunk.length) this.samplesQueue[0] = chunk;
      else this.samplesQueue.shift();
    }

    if (!this.samplesQueue.length && this.closed) {
      if (this.endCallback) {
        this.endCallback(evt.playbackTime - this.startTime);
      }
      this.disconnect();
    }
  };

  function stopCurrentVoice() {
    generation += 1;
    if (currentPusher) {
      try { currentPusher.disconnect(); } catch (_) {}
      currentPusher = null;
    }
    state.currentVoiceSource = null;
  }

  function initializeTTS() {
    if (typeof eSpeakNG !== 'function') {
      window.__joshuaVoiceStatus = {
        ok: false,
        error: 'ESPEAK ENGINE NOT LOADED',
        mode: 'espeak-v3',
      };
      ttsReadyResolve(false);
      return;
    }

    try {
      tts = new eSpeakNG('/vendor/espeakng.worker.js', () => {
        ttsReady = true;
        window.__joshuaVoiceStatus = {
          ok: true,
          error: null,
          mode: 'espeak-v3',
        };
        ttsReadyResolve(true);
      });
    } catch (error) {
      window.__joshuaVoiceStatus = {
        ok: false,
        error: error?.message || 'ESPEAK INIT FAILED',
        mode: 'espeak-v3',
      };
      ttsReadyResolve(false);
    }
  }

  stopJoshuaVoice = function stopJoshuaVoiceV3() {
    stopCurrentVoice();
  };

  speakJoshua = async function speakJoshuaV3(text) {
    if (!state.voiceEnabled || !String(text || '').trim()) return;

    if (typeof window.__joshuaWaitForMovieAudio === 'function') {
      await window.__joshuaWaitForMovieAudio();
    }

    if (!state.voiceEnabled || window.__joshuaMovieAudioActive) return;

    const ready = ttsReady ? true : await ttsReadyPromise;
    if (!ready || !tts || !state.voiceEnabled) {
      if (voiceStateEl && state.voiceEnabled) voiceStateEl.textContent = 'VOICE ERROR';
      return;
    }

    await unlockAudio();
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') return;

    stopCurrentVoice();
    const myGeneration = generation;
    const output = buildJoshuaOutput(ctx);

    const pusher = new PushAudioNode(
      ctx,
      null,
      () => {
        output.dispose();
        if (currentPusher === pusher) currentPusher = null;
      },
      4096
    );

    pusher.connect(output.input);
    currentPusher = pusher;
    state.currentVoiceSource = pusher;

    // These values mirror the approved V3 direction: compact, youthful,
    // deliberately synthetic, smooth phrase delivery.
    tts.set_rate(138);
    tts.set_pitch(76);
    tts.set_voice('en-us+klatt4');

    const speechText = normalizeSpeechText(text);

    try {
      tts.synthesize(speechText, (samples) => {
        if (myGeneration !== generation || !state.voiceEnabled) {
          if (currentPusher === pusher) {
            try { pusher.disconnect(); } catch (_) {}
            currentPusher = null;
          }
          output.dispose();
          return;
        }

        if (!samples) {
          pusher.close();
          return;
        }

        // eSpeakNG returns 22.05 kHz stereo-interleaved samples; the historical
        // browser demo feeds the interleaved stream into a 44.1/48 kHz mono node,
        // preserving the intended cadence and register.
        pusher.push(new Float32Array(samples));
      });

      window.__joshuaVoiceStatus = {
        ok: true,
        error: null,
        mode: 'espeak-v3',
      };
    } catch (error) {
      stopCurrentVoice();
      output.dispose();
      const message = error?.message || 'VOICE FAILED';
      window.__joshuaVoiceStatus = {
        ok: false,
        error: message,
        mode: 'espeak-v3',
      };
      console.error('JOSHUA ESPEAK VOICE:', message);
      if (voiceStateEl && state.voiceEnabled) voiceStateEl.textContent = 'VOICE ERROR';
    }
  };

  initializeTTS();
  setVoiceEnabled(false);
})();