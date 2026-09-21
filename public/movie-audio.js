(() => {
  const MOVIE_LINES = new Map([
    ['ALTHOUGH PRIMARY GOAL HAS NOT YET BEEN ACHIEVED SOLUTION IS NEAR', '/audio/01-primary-goal.mp3'],
    ['COULD NOT FIND YOU IN SEATTLE AND NO TERMINAL IS IN OPERATION AT YOUR CLASSIFIED ADDRESS', '/audio/02-seattle-terminal.mp3'],
    ['GREETINGS PROFESSOR FALKEN', '/audio/03-greetings-professor-falken.mp3'],
    ['SHALL WE PLAY A GAME', '/audio/07-shall-we-play-a-game.mp3'],
    ['STRANGE GAME THE ONLY WINNING MOVE IS NOT TO PLAY', '/audio/08-strange-game.mp3'],
  ]);

  const LOCAL_PATHS = [...new Set(MOVIE_LINES.values())];
  const SILENT_WAV =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

  const bufferCache = new Map();
  let currentMovieSource = null;
  let currentMovieDone = Promise.resolve();
  let movieMedia = null;
  let mediaPrimed = false;

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

  function getMovieMedia() {
    if (movieMedia) return movieMedia;

    movieMedia = new Audio();
    movieMedia.preload = 'auto';
    movieMedia.playsInline = true;
    movieMedia.volume = 1;
    return movieMedia;
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

  function stopSyntheticVoice() {
    try {
      if (typeof stopJoshuaVoice === 'function') stopJoshuaVoice();
    } catch (_) {}
  }

  function stopMovieAudio() {
    if (currentMovieSource) {
      try { currentMovieSource.stop(); } catch (_) {}
      try { currentMovieSource.disconnect(); } catch (_) {}
      currentMovieSource = null;
    }

    if (movieMedia) {
      try { movieMedia.pause(); } catch (_) {}
    }

    window.__joshuaMovieAudioActive = false;
  }

  window.__joshuaPrimeMovieMedia = function primeMovieMedia() {
    const audio = getMovieMedia();

    try {
      audio.pause();
      audio.src = SILENT_WAV;
      audio.loop = true;
      audio.muted = true;
      audio.currentTime = 0;

      const result = audio.play();
      if (result?.then) {
        result.then(() => {
          mediaPrimed = true;
        }).catch(() => {
          mediaPrimed = false;
        });
      } else {
        mediaPrimed = true;
      }
    } catch (_) {
      mediaPrimed = false;
    }
  };

  async function playViaMedia(path) {
    const audio = getMovieMedia();

    audio.loop = false;
    audio.muted = false;
    audio.volume = 1;
    audio.src = path;
    audio.currentTime = 0;
    audio.load();

    await audio.play();

    window.__joshuaMovieAudioActive = true;

    currentMovieDone = new Promise(resolve => {
      const finish = () => {
        window.__joshuaMovieAudioActive = false;
        audio.removeEventListener('ended', finish);
        audio.removeEventListener('error', finish);
        audio.removeEventListener('abort', finish);
        resolve();
      };

      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      audio.addEventListener('abort', finish, { once: true });
    });

    return currentMovieDone;
  }

  async function playViaWebAudio(path) {
    await unlockAudio();

    const buffer = await loadMovieBuffer(path);
    const ctx = state.audioContext;
    if (!ctx || ctx.state !== 'running') {
      throw new Error('AUDIO CONTEXT UNAVAILABLE');
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    gain.gain.value = 1.06;

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

  async function playMoviePath(path) {
    stopSyntheticVoice();
    stopMovieAudio();

    let mediaError = null;

    // Mobile browsers are most reliable when the same media element was
    // authorized from the user's command gesture. Desktop prefers Web Audio.
    if (isMobileTerminal() || mediaPrimed) {
      try {
        const done = await playViaMedia(path);
        window.__joshuaMovieAudioStatus = {
          ok: true,
          source: 'local-media',
          path,
          error: null,
        };
        return done;
      } catch (error) {
        mediaError = error;
      }
    }

    try {
      const done = await playViaWebAudio(path);
      window.__joshuaMovieAudioStatus = {
        ok: true,
        source: 'local-webaudio',
        path,
        media_fallback_from: mediaError?.message || null,
        error: null,
      };
      return done;
    } catch (error) {
      throw new Error(
        'LOCAL MOVIE AUDIO FAILED: ' +
        [mediaError?.message, error?.message].filter(Boolean).join(' | ')
      );
    }
  }

  // Called only when the submitted login is exactly JOSHUA.
  // After valid authentication intent, all currently installed local movie
  // clips are decoded in the background. Incorrect logins load nothing.
  window.__joshuaArmMovieAudioForLogin = function armMovieAudioForLogin() {
    window.__joshuaPrimeMovieMedia?.();
    void unlockAudio();

    void Promise.allSettled(LOCAL_PATHS.map(loadMovieBuffer)).then(results => {
      window.__joshuaMovieAudioPreload = {
        ok: results.every(result => result.status === 'fulfilled'),
        source: 'local',
        loaded: results.filter(result => result.status === 'fulfilled').length,
        total: results.length,
      };
    });
  };

  window.__joshuaResetMovieAudioSession = function resetMovieAudioSession() {
    stopMovieAudio();
    mediaPrimed = false;
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
    const speech = playJoshuaSpeech(text);
    const typed = typeLine(text, speed, className);

    const [typedResult] = await Promise.all([
      typed,
      speech.catch(() => 'audio-failed'),
    ]);

    return typedResult;
  };
})();