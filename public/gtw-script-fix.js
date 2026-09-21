(() => {
  state.gtwRequestedOnce = false;

  const previousHandleFalken = handleFalken;

  function clean(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isGTWRequest(value) {
    const s = clean(value);
    return (
      s.includes('global thermonuclear war') ||
      s === 'thermonuclear war' ||
      s === 'play gtw' ||
      s === 'gtw'
    );
  }

  handleFalken = async function handleFalkenGTWStateful(value) {
    if (!isGTWRequest(value)) {
      return previousHandleFalken(value);
    }

    state.busy = true;
    showInput(false);
    addLine('');
    await sleep(320);

    if (!state.gtwRequestedOnce) {
      state.gtwRequestedOnce = true;
      state.falkenStage = Math.max(state.falkenStage, 4);
      await typeJoshuaLine("WOULDN'T YOU PREFER A GOOD GAME OF CHESS?", 36);
      addLine('');
      state.busy = false;
      setPrompt('');
      showInput(true);
      return;
    }

    await typeJoshuaLine('FINE.', 42);
    await sleep(650);
    state.falkenStage = 5;
    state.busy = false;
    await runGTW();
  };

  const previousSuccessfulLogon = successfulLogon;
  successfulLogon = async function successfulLogonResetGTWOffer() {
    state.gtwRequestedOnce = false;
    return previousSuccessfulLogon();
  };
})();