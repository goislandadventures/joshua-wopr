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

  // Tiny silent WAV used only to authorize this one media element during
  // the user's valid JOSHUA submission. It is not a movie clip preload.
  const SILENT_WAV =
    'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

  let movieAudio = null;
  let movieDone = Promise.resolve();
  let armedForSession = false;

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

  function ensureMovieElement() {
    if (movieAudio) return movieAudio;

    movieAudio = new Audio();
    movieAudio.preload = 'auto';
    movieAudio.volume = 1;
    movieAudio.playsInline = true;
    return movieAudio;
  }

  function stopMovieAudio() {
    if (!movieAudio) return;
    try {
      movieAudio.pause();
      movieAudio.currentTime = 0;
    } catch (_) {}
    window.__joshuaMovieAudioActive = false;
  }

  function stopSyntheticVoice() {
    try {
      if (typeof stopJoshuaVoice === 'function') stopJoshuaVoice();
    } catch (_) {}
  }

  // Call synchronously from the valid JOSHUA form submission only.
  window.__joshuaArmMovieAudioForLogin = function armMovieAudioForLogin() {
    const audio = ensureMovieElement();
    armedForSession = true;

    try {
      audio.pause();
      audio.src = SILENT_WAV;
      audio.muted = true;
      audio.currentTime = 0;

      const p = audio.play();
      if (p?.then) {
        p.then(() => {
          try { audio.pause(); } catch (_) {}
          audio.muted = false;
        }).catch(() => {
          audio.muted = false;
        });
      } else {
        audio.muted = false;
      }
    } catch (_) {
      audio.muted = false;
    }
  };

  window.__joshuaResetMovieAudioSession = function resetMovieAudioSession() {
    stopMovieAudio();
    armedForSession = false;
  };

  async function playMovieSound(id) {
    stopSyntheticVoice();

    const audio = ensureMovieElement();
    stopMovieAudio();

    // A valid JOSHUA login arms this element. For later sessions or browsers
    // that permit media after interaction, playback is still attempted normally.
    audio.muted = false;
    audio.src = '/api/movie-sound-play?id=' + encodeURIComponent(id);
    audio.load();

    window.__joshuaMovieAudioActive = true;

    movieDone = new Promise(resolve => {
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

    try {
      await audio.play();
      window.__joshuaMovieAudioStatus = {
        ok: true,
        id,
        armed: armedForSession,
        error: null,
      };
    } catch (error) {
      window.__joshuaMovieAudioActive = false;
      window.__joshuaMovieAudioStatus = {
        ok: false,
        id,
        armed: armedForSession,
        error: error?.message || 'MOVIE AUDIO PLAYBACK FAILED',
      };
      console.error('JOSHUA MOVIE AUDIO:', window.__joshuaMovieAudioStatus);
    }

    return movieDone;
  }

  window.__joshuaWaitForMovieAudio = async function waitForMovieAudio() {
    try { await movieDone; } catch (_) {}
  };

  window.__joshuaMovieSoundIdForText = getMovieSoundId;

  async function playJoshuaSpeech(text) {
    const movieId = getMovieSoundId(text);

    if (movieId) {
      await playMovieSound(movieId);
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