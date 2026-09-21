(() => {
  const MOVIE_LINES = new Map([
    ['ALTHOUGH PRIMARY GOAL HAS NOT YET BEEN ACHIEVED SOLUTION IS NEAR', 259742],
    ['COULD NOT FIND YOU IN SEATTLE AND NO TERMINAL IS IN OPERATION AT YOUR CLASSIFIED ADDRESS', 259744],
    ['GREETINGS PROFESSOR FALKEN', 259743],
    ['HOW ABOUT A NICE GAME OF CHESS', 259740],
    ['IS THIS A GAME OR IS IT REAL WHATS THE DIFFERENCE', 259738],
    ['PEOPLE SOMETIMES MAKE MISTAKES YES THEY DO', 259736],
    ['SHALL WE PLAY A GAME', 259734],
    ['STRANGE GAME THE ONLY WINNING MOVE IS NOT TO PLAY', 259735],
    ['WHAT IS THE PRIMARY GOAL TO WIN THE GAME', 259737],
    ['WOULDNT YOU PREFER A GOOD GAME OF CHESS', 259741],
    ['YOU ARE A HARD MAN TO REACH', 259739],
  ]);

  const bufferCache = new Map();
  let currentMovieSource = null;
  let currentMovieDone = Promise.resolve();

  function normalizeMovieLine(text) {
    return String(text || '')
      .toUpperCase()
      .replace(/[’']/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getMovieSoundId(text) {
    return MOVIE_LINES.get(normalizeMovieLine(text)) || null;
  }

  async function getMovieBuffer(id) {
    if (bufferCache.has(id)) return bufferCache.get(id);

    await unlockAudio();
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') throw new Error('AUDIO CONTEXT UNAVAILABLE');

    const response = await fetch('/api/movie-sound?id=' + encodeURIComponent(id), {
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error('MOVIE SOUND HTTP ' + response.status + (detail ? ': ' + detail.slice(0, 160) : ''));
    }

    const bytes = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    bufferCache.set(id, buffer);
    return buffer;
  }

  function stopMovieAudio() {
    if (!currentMovieSource) return;
    try { currentMovieSource.stop(); } catch (_) {}
    try { currentMovieSource.disconnect(); } catch (_) {}
    currentMovieSource = null;
    window.__joshuaMovieAudioActive = false;
  }

  function stopSyntheticVoice() {
    try {
      if (typeof stopJoshuaVoice === 'function') stopJoshuaVoice();
    } catch (_) {}
  }

  async function playMovieSound(id) {
    stopSyntheticVoice();
    stopMovieAudio();

    const buffer = await getMovieBuffer(id);
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') throw new Error('AUDIO CONTEXT UNAVAILABLE');

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = 1.0;

    source.connect(gain);
    gain.connect(ctx.destination);

    currentMovieSource = source;
    window.__joshuaMovieAudioActive = true;

    currentMovieDone = new Promise(resolve => {
      source.onended = () => {
        if (currentMovieSource === source) currentMovieSource = null;
        window.__joshuaMovieAudioActive = false;
        resolve();
      };
    });

    source.start();
    return currentMovieDone;
  }

  window.__joshuaWaitForMovieAudio = async function waitForMovieAudio() {
    try { await currentMovieDone; } catch (_) {}
  };

  window.__joshuaMovieSoundIdForText = getMovieSoundId;

  async function playJoshuaSpeech(text) {
    const movieId = getMovieSoundId(text);

    if (movieId) {
      try {
        await playMovieSound(movieId);
        window.__joshuaMovieAudioStatus = { ok: true, id: movieId, error: null };
      } catch (error) {
        window.__joshuaMovieAudioStatus = {
          ok: false,
          id: movieId,
          error: error?.message || 'MOVIE AUDIO FAILED',
        };
        console.error('JOSHUA MOVIE AUDIO:', window.__joshuaMovieAudioStatus);
      }
      return 'movie';
    }

    if (!state.voiceEnabled) return 'silent';

    await window.__joshuaWaitForMovieAudio();
    if (!state.voiceEnabled || window.__joshuaMovieAudioActive) return 'silent';

    stopSyntheticVoice();
    try {
      await speakJoshua(text);
      return 'synthetic';
    } catch (_) {
      return 'silent';
    }
  }

  typeJoshuaLine = async function typeJoshuaLineWithAudioPriority(text = '', speed = 32, className = '') {
    void playJoshuaSpeech(text);
    return typeLine(text, speed, className);
  };
})();