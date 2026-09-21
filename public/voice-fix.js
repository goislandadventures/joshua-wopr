(() => {
  const voiceCache = new Map();
  let currentAudio = null;
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

  function stopCurrentVoice() {
    if (!currentAudio) return;
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      if (currentAudio.__objectUrl) URL.revokeObjectURL(currentAudio.__objectUrl);
    } catch (_) {}
    currentAudio = null;
    state.currentVoiceAudio = null;
  }

  async function playVoiceBlob(blob) {
    stopCurrentVoice();

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.volume = 0.90;
    audio.__objectUrl = url;

    currentAudio = audio;
    state.currentVoiceAudio = audio;

    audio.addEventListener('ended', () => {
      if (currentAudio === audio) currentAudio = null;
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, { once: true });

    await audio.play();
  }

  stopJoshuaVoice = function stopJoshuaVoiceReliable() {
    stopCurrentVoice();
  };

  speakJoshua = async function speakJoshuaReliable(text) {
    if (!state.voiceEnabled || !String(text || '').trim()) return;

    try {
      const blob = await requestVoiceBlob(text);
      if (!state.voiceEnabled || !blob) return;
      await playVoiceBlob(blob);
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

      await playVoiceBlob(blob);
      if (voiceStateEl) voiceStateEl.textContent = 'VOICE ON';
      window.__joshuaVoiceStatus = { ok: true, error: null };
    } catch (error) {
      const message = error?.message || 'VOICE FAILED';
      console.error('JOSHUA VOICE VERIFY:', message);
      window.__joshuaVoiceStatus = { ok: false, error: message };

      setVoiceEnabled(false);
      if (voiceStateEl) voiceStateEl.textContent = 'VOICE ERROR';
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