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

  let currentMovieAudio = null;
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

  function stopMovieAudio() {
    if (!currentMovieAudio) return;
    try {
      currentMovieAudio.pause();
      currentMovieAudio.currentTime = 0;
    } catch (_) {}
    currentMovieAudio = null;
    window.__joshuaMovieAudioActive = false;
  }

  function stopSyntheticVoice() {
    try {
      if (typeof stopJoshuaVoice === 'function') stopJoshuaVoice();
    } catch (_) {}
  }

  function playMovieSound(id) {
    stopSyntheticVoice();
    stopMovieAudio();

    const audio = new Audio('/api/movie-sound?id=' + encodeURIComponent(id));
    audio.preload = 'auto';
    audio.volume = 1;

    currentMovieAudio = audio;
    window.__joshuaMovieAudioActive = true;

    currentMovieDone = new Promise(resolve => {
      const finish = () => {
        if (currentMovieAudio === audio) currentMovieAudio = null;
        window.__joshuaMovieAudioActive = false;
        resolve();
      };

      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      audio.addEventListener('abort', finish, { once: true });
    });

    audio.play().catch(() => {
      if (currentMovieAudio === audio) currentMovieAudio = null;
      window.__joshuaMovieAudioActive = false;
    });

    return currentMovieDone;
  }

  window.__joshuaWaitForMovieAudio = async function waitForMovieAudio() {
    try { await currentMovieDone; } catch (_) {}
  };

  window.__joshuaMovieSoundIdForText = getMovieSoundId;

  async function playJoshuaSpeech(text) {
    const movieId = getMovieSoundId(text);

    if (movieId) {
      void playMovieSound(movieId);
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

  // Movie clips are independent of VOICE ON/OFF. Synthetic speech is not.
  // Typing audio remains entirely independent because typeLine() still owns it.
  typeJoshuaLine = async function typeJoshuaLineWithAudioPriority(text = '', speed = 32, className = '') {
    void playJoshuaSpeech(text);
    return typeLine(text, speed, className);
  };
})();