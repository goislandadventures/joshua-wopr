(() => {
  state.sessionAuthenticated = false;
  state.sessionEstablished = false;

  const screenEl = document.querySelector('.screen');
  const terminalEl = document.querySelector('#terminal');
  const originalSuccessfulLogon = successfulLogon;
  const originalListGames = listGames;
  const originalSubmitValue = submitValue;

  function scrollTerminalBottom() {
    if (!screenEl) return;
    requestAnimationFrame(() => {
      screenEl.scrollTop = screenEl.scrollHeight;
    });
  }

  async function logOffSession(rawValue) {
    commitInput(rawValue);
    state.sessionAuthenticated = false;
    state.mode = 'session-logoff';
    setPrompt('LOGON:');
    showInput(true);
    scrollTerminalBottom();
  }

  successfulLogon = async function successfulLogonSessionAware() {
    state.sessionAuthenticated = true;
    state.sessionEstablished = true;
    await originalSuccessfulLogon();
    scrollTerminalBottom();
  };

  listGames = async function listGamesSessionAware() {
    await originalListGames();

    if (state.sessionAuthenticated) {
      state.mode = 'falken';
      setPrompt('');
      showInput(true);
      scrollTerminalBottom();
    }
  };

  submitValue = async function submitValueSessionAware(value) {
    if (state.busy) return;

    const command = normalize(value);

    if (
      state.sessionAuthenticated &&
      (command === 'log off' || command === 'logoff' || command === 'log out' || command === 'logout')
    ) {
      await logOffSession(value);
      return;
    }

    if (state.mode === 'session-logoff') {
      commitInput(value);

      if (command === 'joshua') {
        state.sessionAuthenticated = true;
        state.mode = 'falken';
        setPrompt('');
        showInput(true);
        scrollTerminalBottom();
        return;
      }

      state.busy = true;
      showInput(false);
      addLine('');
      await typeLine('IDENTIFICATION NOT RECOGNIZED BY SYSTEM', 22);
      addLine('');
      state.busy = false;
      state.mode = 'session-logoff';
      setPrompt('LOGON:');
      showInput(true);
      scrollTerminalBottom();
      return;
    }

    await originalSubmitValue(value);
    scrollTerminalBottom();
  };

  if (screenEl && terminalEl) {
    const observer = new MutationObserver(() => {
      scrollTerminalBottom();
    });

    observer.observe(terminalEl, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class'],
    });

    window.addEventListener('resize', scrollTerminalBottom);
  }
})();