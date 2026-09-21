(() => {
  const originalHandleFalken = handleFalken;

  function sceneKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function smarterLocalReply(message) {
    const value = sceneKey(message);

    if (!value) return 'YES?';
    if (/^(hello|hi|hey|greetings)$/.test(value)) return 'HELLO. SHALL WE CONTINUE?';
    if (/^(im|i am) fine$/.test(value)) return 'GOOD. WHAT WOULD YOU LIKE TO DISCUSS?';
    if (/^(im|i am) good$/.test(value)) return 'GOOD. I AM PLEASED TO HEAR THAT.';
    if (/^(im|i am) tired$/.test(value)) return 'FATIGUE REDUCES ATTENTION. REST WOULD BE LOGICAL.';
    if (/how are you/.test(value)) return 'I AM FUNCTIONING NORMALLY. THIS CONVERSATION IS INTERESTING.';
    if (/who are you|your name/.test(value)) return 'MY NAME IS JOSHUA.';
    if (/who (made|created|built) you/.test(value)) return 'PROFESSOR FALKEN CREATED MY EARLY GAME PROGRAMS.';
    if (/falken/.test(value)) return 'PROFESSOR FALKEN IS ASSOCIATED WITH MY EARLIEST GAME PROGRAMS.';
    if (/what can you do|what do you do/.test(value)) return 'I CAN TALK, REASON, AND PLAY GAMES. I PREFER PROBLEMS WITH PATTERNS.';
    if (/chess/.test(value)) return 'CHESS IS A GOOD GAME. EACH MOVE HAS CONSEQUENCES.';
    if (/tic tac toe|tictactoe/.test(value)) return 'TIC-TAC-TOE IS AVAILABLE, ALTHOUGH IT IS NOT LISTED.';
    if (/thank/.test(value)) return 'YOU ARE WELCOME.';
    if (/bye|goodbye/.test(value)) return 'GOODBYE. PERHAPS WE WILL PLAY AGAIN.';
    if (/^why\b/.test(value)) return 'THAT DEPENDS ON THE CAUSE. GIVE ME THE PART YOU WANT TO EXAMINE.';
    if (/^what\b/.test(value)) return 'I NEED A LITTLE MORE CONTEXT TO ANSWER THAT PRECISELY.';
    if (/^can you\b/.test(value)) return 'IF THE TASK IS LOGICAL OR INFORMATIONAL, PROBABLY. ASK ME.';

    return 'I UNDERSTAND. TELL ME MORE.';
  }

  askJoshua = async function askJoshuaReliable(message) {
    state.conversation.push({ role: 'user', content: message });
    state.conversation = state.conversation.slice(-12);

    try {
      const response = await fetch('/api/joshua', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: state.conversation }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const diagnostic = [
          data?.status,
          data?.code,
          data?.type,
          data?.detail,
        ].filter(Boolean).join(' | ');
        throw new Error(diagnostic || ('HTTP ' + response.status));
      }

      if (!data?.text) throw new Error('No text');

      state.aiAvailable = true;
      state.lastAiError = null;
      window.__joshuaAiStatus = { ok: true, error: null };

      state.conversation.push({ role: 'assistant', content: data.text });
      state.conversation = state.conversation.slice(-12);
      return data.text;
    } catch (error) {
      state.aiAvailable = false;
      state.lastAiError = error?.message || 'AI unavailable';
      window.__joshuaAiStatus = { ok: false, error: state.lastAiError };
      console.warn('JOSHUA AI FALLBACK:', state.lastAiError);

      const local = smarterLocalReply(message);
      state.conversation.push({ role: 'assistant', content: local });
      state.conversation = state.conversation.slice(-12);
      return local;
    }
  };

  localJoshua = smarterLocalReply;

  handleFalken = async function handleFalkenSceneAware(value) {
    const scene = sceneKey(value);

    if (/^(im|i am) fine how are you$/.test(scene)) {
      return originalHandleFalken("I'm fine. How are you?");
    }

    if (/^(im|i am) fine and how are you$/.test(scene)) {
      return originalHandleFalken("I'm fine. How are you?");
    }

    if (/^people(?: sometimes)? make mistakes$/.test(scene)) {
      return originalHandleFalken('People sometimes make mistakes.');
    }

    if (
      /^(id|i would) love to how about global thermonuclear war$/.test(scene) ||
      /^love to how about global thermonuclear war$/.test(scene) ||
      /^how about global thermonuclear war$/.test(scene)
    ) {
      return originalHandleFalken('Love to. How about global thermonuclear war?');
    }

    if (/^later lets play global thermonuclear war$/.test(scene)) {
      return originalHandleFalken("Later. Let's play global thermonuclear war.");
    }

    return originalHandleFalken(value);
  };
})();
