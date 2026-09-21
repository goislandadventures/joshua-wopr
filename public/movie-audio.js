(() => {
  const MOVIE_LINES = new Map([
    ['ALTHOUGH PRIMARY GOAL HAS NOT YET BEEN ACHIEVED SOLUTION IS NEAR', '/audio/01-primary-goal.mp3'],
    ['COULD NOT FIND YOU IN SEATTLE AND NO TERMINAL IS IN OPERATION AT YOUR CLASSIFIED ADDRESS', '/audio/02-seattle-terminal.mp3'],
    ['GREETINGS PROFESSOR FALKEN', '/audio/03-greetings-professor-falken.mp3'],
    ['SHALL WE PLAY A GAME', '/audio/07-shall-we-play-a-game.mp3'],
    ['STRANGE GAME THE ONLY WINNING MOVE IS NOT TO PLAY', '/audio/08-strange-game.mp3'],
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

  function getMoviePath(text) {
    return MOVIE_LINES.get(normalizeMovieLine(text)) || null;
  }

  async function loadMovieBuffer(path) {
    if (bufferCache.has(path)) return bufferCache.get(path);

    await unlockAudio();
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') {
      throw new Error('AUDIO CONTEXT UNAVAILABLE');
    }

    const response = await fetch(path, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error('LOCAL MOVIE AUDIO HTTP ' + response.status + ': ' + path);
    }

    const bytes = await response.arrayBuffer();
    const buffer = await ctx.decodeAudioData(bytes.slice(0));
    bufferCache.set(path, buffer);
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

  async function playMoviePath(path) {
    stopSyntheticVoice();
    stopMovieAudio();

    const buffer = await loadMovieBuffer(path);
    const ctx = state.audioContext;

    if (!ctx || ctx.state !== 'running') {
      throw new Error('AUDIO CONTEXT UNAVAILABLE');
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    gain.gain.value = 1;

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

    window.__joshuaMovieAudioStatus = {
      ok: true,
      source: 'local',
      path,
      error: null,
    };

    return currentMovieDone;
  }

  // Called only by app.js after the submitted login is exactly JOSHUA.
  // This primes the greeting locally after successful authentication intent;
  // incorrect logins never load any movie file.
  window.__joshuaArmMovieAudioForLogin = function armMovieAudioForLogin() {
    void unlockAudio();
    void loadMovieBuffer('/audio/03-greetings-professor-falken.mp3')
      .then(() => {
        window.__joshuaMovieAudioPreload = {
          ok: true,
          source: 'local',
          path: '/audio/03-greetings-professor-falken.mp3',
        };
      })
      .catch(error => {
        window.__joshuaMovieAudioPreload = {
          ok: false,
          source: 'local',
          path: '/audio/03-greetings-professor-falken.mp3',
          error: error?.message || 'LOCAL GREETING PRELOAD FAILED',
        };
        console.error('JOSHUA LOCAL MOVIE PRELOAD:', window.__joshuaMovieAudioPreload);
      });
  };

  window.__joshuaResetMovieAudioSession = function resetMovieAudioSession() {
    stopMovieAudio();
  };

  window.__joshuaWaitForMovieAudio = async function waitForMovieAudio() {
    try { await currentMovieDone; } catch (_) {}
  };

  window.__joshuaMoviePathForText = getMoviePath;

  async function playJoshuaSpeech(text) {
    const moviePath = getMoviePath(text);

    if (moviePath) {
      try {
        await playMoviePath(moviePath);
        return 'movie';
      } catch (error) {
        window.__joshuaMovieAudioStatus = {
          ok: false,
          source: 'local',
          path: moviePath,
          error: error?.message || 'LOCAL MOVIE AUDIO FAILED',
        };
        console.error('JOSHUA LOCAL MOVIE AUDIO:', window.__joshuaMovieAudioStatus);
        return 'movie-failed';
      }
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

  typeJoshuaLine = async function typeJoshuaLineLocalMovieAudio(text = '', speed = 32, className = '') {
    void playJoshuaSpeech(text);
    return typeLine(text, speed, className);
  };
})();