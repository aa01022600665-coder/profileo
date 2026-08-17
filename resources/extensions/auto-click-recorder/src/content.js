(() => {
  const STORAGE_KEY = "autoClickTextRecorderState";

  const messageTypes = {
    start: "AUTO_CLICK_START_RECORDING",
    stop: "AUTO_CLICK_STOP_RECORDING",
    play: "AUTO_CLICK_PLAY_RECORDING",
    stopPlay: "AUTO_CLICK_STOP_PLAYBACK",
    clear: "AUTO_CLICK_CLEAR_RECORDING",
    status: "AUTO_CLICK_GET_STATUS",
    import: "AUTO_CLICK_IMPORT_RECORDING"
  };

  const defaultState = {
    format: "auto-click-recorder/v1",
    createdAt: "",
    updatedAt: "",
    sourceUrl: "",
    isRecording: false,
    isPlaying: false,
    startedAtMs: 0,
    options: { includeMoves: false },
    playback: { active: false },
    actions: []
  };

  let state = { ...defaultState, actions: [] };
  let saveTimer = null;
  let lastMoveAt = 0;
  let playbackCancelled = false;
  let badge = null;
  let sidePanelHost = null;
  let sidePanelShadow = null;
  let sidePanelExpanded = false;
  let sidePanelEls = null;
  let activePlaybackOptions = null;
  let readyPromise = loadState();

  document.addEventListener("click", handleClick, true);
  document.addEventListener("input", handleInput, true);
  document.addEventListener("change", handleChange, true);
  document.addEventListener("mousemove", handleMouseMove, true);

  readyPromise.then(() => {
    ensureSidePanel();
    updateSidePanel();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message)
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({ ok: false, error: error.message, state: publicState() }));
    return true;
  });

  async function handleMessage(message) {
    await readyPromise;

    switch (message.type) {
      case messageTypes.start:
        return startRecording(message.options || {});
      case messageTypes.stop:
        return stopRecording();
      case messageTypes.play:
        return beginPlayback(message);
      case messageTypes.stopPlay:
        playbackCancelled = true;
        state.isPlaying = false;
        state.playback = { active: false };
        await flushState();
        renderBadge();
        updateSidePanel();
        return { ok: true, state: publicState() };
      case messageTypes.clear:
        return clearRecording();
      case messageTypes.status:
        return { ok: true, state: publicState() };
      case messageTypes.import:
        return importRecording(message.recording);
      default:
        return { ok: false, error: "Unknown recorder message.", state: publicState() };
    }
  }

  async function startRecording(options) {
    state = {
      ...defaultState,
      format: "auto-click-recorder/v1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceUrl: location.href,
      isRecording: true,
      isPlaying: false,
      startedAtMs: Date.now(),
      options: { includeMoves: Boolean(options.includeMoves) },
      playback: { active: false },
      actions: []
    };
    playbackCancelled = true;
    await flushState();
    renderBadge();
    updateSidePanel();
    return { ok: true, state: publicState() };
  }

  async function stopRecording() {
    flushPendingState();
    state.isRecording = false;
    state.updatedAt = new Date().toISOString();
    await flushState();
    renderBadge();
    updateSidePanel();
    return { ok: true, state: publicState() };
  }

  async function clearRecording() {
    playbackCancelled = true;
    state = {
      ...defaultState,
      format: "auto-click-recorder/v1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      options: { includeMoves: false },
      playback: { active: false },
      actions: []
    };
    await flushState();
    renderBadge();
    updateSidePanel();
    return { ok: true, state: publicState() };
  }

  async function importRecording(recording) {
    const actions = recording && Array.isArray(recording.actions) ? recording.actions : null;
    if (!actions) {
      throw new Error("Imported file does not contain actions.");
    }

    state = {
      ...defaultState,
      format: "auto-click-recorder/v1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceUrl: recording.sourceUrl || "",
      options: { includeMoves: false },
      actions,
      isRecording: false,
      isPlaying: false,
      playback: { active: false },
      startedAtMs: 0
    };
    await flushState();
    renderBadge();
    updateSidePanel();
    return { ok: true, state: publicState() };
  }

  function handleClick(event) {
    if (!canRecordEvent(event)) {
      return;
    }

    const element = nearestElement(event.target);
    const action = {
      type: "click",
      at: elapsed(),
      url: location.href,
      selector: getStableSelector(element),
      label: elementLabel(element),
      button: event.button,
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      pageX: Math.round(event.pageX),
      pageY: Math.round(event.pageY),
      offsetX: getOffsetX(element, event),
      offsetY: getOffsetY(element, event)
    };
    const recordedAction = appendAction(action);

    window.setTimeout(() => {
      const target = getPlayableTextTarget(element);
      if (!target || isPasswordField(target)) {
        return;
      }

      recordedAction.textTargetSelector = getTextTargetSelector(target);
      recordedAction.textTargetLabel = elementLabel(target);
      recordedAction.textTargetTag = tagName(target);
      state.updatedAt = new Date().toISOString();
      saveStateSoon();
    }, 120);
  }

  function handleInput(event) {
    if (!canRecordEvent(event)) {
      return;
    }

    const element = getEditableElement(event.target);
    if (!element || isPasswordField(element)) {
      return;
    }

    if (isTextElement(element) || isEditableTextHost(element)) {
      appendAction({
        type: "text",
        at: elapsed(),
        url: location.href,
        selector: getStableSelector(element),
        label: elementLabel(element),
        value: readElementValue(element),
        tag: tagName(element),
        inputType: lowerAttribute(element, "type")
      });
    }
  }

  function handleChange(event) {
    if (!canRecordEvent(event)) {
      return;
    }

    const element = getEditableElement(event.target);
    if (!element || isPasswordField(element)) {
      return;
    }

    if (isChoiceElement(element)) {
      appendAction({
        type: "field",
        at: elapsed(),
        url: location.href,
        selector: getStableSelector(element),
        label: elementLabel(element),
        fieldKind: "choice",
        checked: Boolean(element.checked),
        value: element.value || "",
        tag: tagName(element),
        inputType: lowerAttribute(element, "type")
      });
      return;
    }

    if (tagName(element) === "select") {
      appendAction({
        type: "field",
        at: elapsed(),
        url: location.href,
        selector: getStableSelector(element),
        label: elementLabel(element),
        fieldKind: "select",
        value: element.value || "",
        tag: "select"
      });
    }
  }

  function handleMouseMove(event) {
    if (!canRecordEvent(event) || !state.options.includeMoves) {
      return;
    }

    const now = Date.now();
    if (now - lastMoveAt < 250) {
      return;
    }
    lastMoveAt = now;

    const element = nearestElement(event.target);
    appendAction({
      type: "mousemove",
      at: elapsed(),
      url: location.href,
      selector: getStableSelector(element),
      label: elementLabel(element),
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      pageX: Math.round(event.pageX),
      pageY: Math.round(event.pageY)
    });
  }

  function appendAction(action) {
    if (!action.selector && action.type !== "mousemove") {
      return action;
    }

    const actions = state.actions;
    const last = actions[actions.length - 1];
    let storedAction = action;
    if (
      last &&
      action.type === "text" &&
      last.type === "text" &&
      last.selector === action.selector &&
      action.at - last.at < 1500
    ) {
      Object.assign(last, action);
      storedAction = last;
    } else {
      actions.push(action);
    }

    state.updatedAt = new Date().toISOString();
    saveStateSoon();
    renderBadge();
    updateSidePanel();
    return storedAction;
  }

  async function beginPlayback(config) {
    if (!Array.isArray(state.actions) || state.actions.length === 0) {
      throw new Error("There is no recording to play.");
    }

    const playbackConfig = normalizePlaybackConfig(config);
    const playbackSpeed = Math.max(0.25, Math.min(8, Number(playbackConfig.speed) || 1));
    activePlaybackOptions = {
      liveText: playbackConfig.liveText,
      lines: playbackConfig.lines,
      pressEnter: playbackConfig.pressEnter,
      lineDelayMs: playbackConfig.lineDelayMs,
      targetSelector: "",
      lastTextTarget: null
    };
    playbackCancelled = false;
    state.isRecording = false;
    state.isPlaying = true;
    state.playback = { active: false };
    await flushState();
    renderBadge("Playing 0/" + state.actions.length);
    updateSidePanel();

    runPlaybackLoop(playbackSpeed, activePlaybackOptions).catch(async (error) => {
      console.error("Auto Click Recorder playback failed:", error);
      state.isPlaying = false;
      state.playback = { active: false };
      activePlaybackOptions = null;
      await flushState();
      renderBadge();
      updateSidePanel(error.message || "Playback failed");
    });

    return { ok: true, state: publicState() };
  }

  function normalizePlaybackConfig(config) {
    if (typeof config === "number") {
      return { speed: config, liveText: "", lines: [], pressEnter: false, lineDelayMs: 5000 };
    }

    const liveText = config && typeof config.liveText === "string" ? config.liveText : "";
    const lineDelaySeconds = Number(config && config.lineDelaySeconds);
    return {
      speed: config && config.speed,
      liveText,
      lines: getTextLines(liveText),
      pressEnter: Boolean(config && config.pressEnter),
      lineDelayMs: Math.max(0, Math.min(3600, Number.isFinite(lineDelaySeconds) ? lineDelaySeconds : 5)) * 1000
    };
  }

  function getTextLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  async function runPlaybackLoop(playbackSpeed, playbackOptions) {
    let previousAt = 0;
    let played = 0;
    for (const action of state.actions) {
      if (playbackCancelled) {
        break;
      }

      const actionAt = Math.max(0, Number(action.at) || 0);
      const delayMs = Math.max(0, actionAt - previousAt) / playbackSpeed;
      previousAt = actionAt;
      await waitDuringPlayback(delayMs);

      if (playbackCancelled) {
        break;
      }

      await playAction(action, playbackOptions);
      played += 1;
      renderBadge("Playing " + played + "/" + state.actions.length);
      updateSidePanel("Playing " + played + "/" + state.actions.length);
    }

    if (!playbackCancelled && playbackOptions.lines.length > 0) {
      await startQueuedLinePlayback(playbackOptions);
      return;
    }

    state.isPlaying = false;
    activePlaybackOptions = null;
    state.playback = { active: false };
    await flushState();
    renderBadge();
    updateSidePanel();
  }

  async function playAction(action, playbackOptions) {
    switch (action.type) {
      case "click":
        await playClick(action, playbackOptions);
        break;
      case "text":
        await playText(action, playbackOptions);
        break;
      case "field":
        await playField(action);
        break;
      case "mousemove":
        playMouseMove(action);
        break;
      default:
        break;
    }
  }

  async function playClick(action, playbackOptions) {
    const element = findActionElement(action);
    if (!element) {
      return;
    }

    focusAndScroll(element);
    await wait(40);

    const point = getPlaybackPoint(element, action);
    dispatchMouse(element, "mouseover", point, action.button);
    dispatchMouse(element, "mousemove", point, action.button);
    dispatchPointer(element, "pointerdown", point, action.button);
    dispatchMouse(element, "mousedown", point, action.button);
    dispatchPointer(element, "pointerup", point, action.button);
    dispatchMouse(element, "mouseup", point, action.button);
    dispatchMouse(element, "click", point, action.button);
    await wait(80);

    const recordedTextTarget = findTextTargetFromSelector(action.textTargetSelector);
    if (recordedTextTarget) {
      focusAndScroll(recordedTextTarget);
      rememberPlaybackTextTarget(recordedTextTarget, playbackOptions);
      return;
    }

    rememberPlaybackTextTarget(getPlayableTextTarget(element), playbackOptions);
  }

  async function playText(action, playbackOptions) {
    const element = findActionElement(action);
    if (!element) {
      return;
    }

    focusAndScroll(element);
    await wait(40);
    setTextValue(element, action.value || "");
    rememberPlaybackTextTarget(element, playbackOptions);
  }

  async function playField(action) {
    const element = findActionElement(action);
    if (!element) {
      return;
    }

    focusAndScroll(element);
    await wait(40);

    if (action.fieldKind === "choice" && "checked" in element) {
      setCheckedValue(element, Boolean(action.checked));
      dispatchInputEvents(element);
      return;
    }

    if (action.fieldKind === "select" && "value" in element) {
      element.value = action.value || "";
      dispatchInputEvents(element);
    }
  }

  function playMouseMove(action) {
    const element = findActionElement(action) || document.elementFromPoint(action.x, action.y);
    if (!element) {
      return;
    }
    dispatchMouse(element, "mousemove", { x: action.x || 0, y: action.y || 0 }, 0);
  }

  async function startQueuedLinePlayback(playbackOptions) {
    if (!playbackOptions || playbackOptions.lines.length === 0) {
      return;
    }

    const target = findTextTargetForLinePlayback(playbackOptions);
    if (!target) {
      throw new Error("No text field found for TXT lines.");
    }

    rememberPlaybackTextTarget(target, playbackOptions);
    state.playback = {
      active: true,
      phase: "lines",
      lines: playbackOptions.lines,
      index: 0,
      lineDelayMs: playbackOptions.lineDelayMs,
      pressEnter: playbackOptions.pressEnter,
      targetSelector: playbackOptions.targetSelector,
      startedAt: new Date().toISOString(),
      nextRunAt: Date.now()
    };
    state.isPlaying = true;
    await flushState();
    await continueQueuedLinePlayback();
  }

  async function continueQueuedLinePlayback() {
    const playback = state.playback || {};
    if (!playback.active || !Array.isArray(playback.lines) || playback.lines.length === 0) {
      return;
    }

    playbackCancelled = false;
    state.isRecording = false;
    state.isPlaying = true;
    renderBadge("Lines " + Math.min(playback.index + 1, playback.lines.length) + "/" + playback.lines.length);
    updateSidePanel("Lines " + Math.min(playback.index + 1, playback.lines.length) + "/" + playback.lines.length);

    while (!playbackCancelled && playback.active && playback.index < playback.lines.length) {
      const waitMs = Math.max(0, Number(playback.nextRunAt || 0) - Date.now());
      if (waitMs > 0) {
        await waitDuringPlayback(waitMs);
      }

      if (playbackCancelled) {
        break;
      }

      const target = findQueuedLineTarget(playback);
      if (!target) {
        throw new Error("No text field found for TXT lines.");
      }

      const currentIndex = playback.index;
      const line = playback.lines[currentIndex];
      renderBadge("Line " + (currentIndex + 1) + "/" + playback.lines.length);
      updateSidePanel("Line " + (currentIndex + 1) + "/" + playback.lines.length);

      focusAndScroll(target);
      await wait(40);
      setTextValue(target, line);

      playback.index = currentIndex + 1;
      playback.nextRunAt = Date.now() + Number(playback.lineDelayMs || 0);
      playback.active = playback.index < playback.lines.length;
      state.isPlaying = playback.active;
      state.playback = playback;
      await flushState();

      if (playback.pressEnter) {
        await wait(80);
        pressEnter(target);
      }

      if (!playback.active) {
        break;
      }
    }

    activePlaybackOptions = null;
    state.isPlaying = false;
    state.playback = { active: false };
    await flushState();
    renderBadge();
    updateSidePanel();
  }

  function findTextTargetForLinePlayback(playbackOptions) {
    if (playbackOptions && playbackOptions.lastTextTarget) {
      const target = getPlayableTextTarget(playbackOptions.lastTextTarget);
      if (target) {
        return target;
      }
    }

    const active = getPlayableTextTarget(document.activeElement);
    if (active) {
      return active;
    }

    const actions = Array.isArray(state.actions) ? state.actions : [];
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      const recordedTarget = findTextTargetFromSelector(actions[index].textTargetSelector);
      if (recordedTarget) {
        if (playbackOptions) {
          rememberPlaybackTextTarget(recordedTarget, playbackOptions);
        }
        return recordedTarget;
      }

      const element = findActionElement(actions[index]);
      const target = getPlayableTextTarget(element);
      if (target) {
        return target;
      }
    }

    return null;
  }

  function findQueuedLineTarget(playback) {
    if (playback.targetSelector) {
      const selected = findTextTargetFromSelector(playback.targetSelector);
      if (selected) {
        return selected;
      }
    }

    return findTextTargetForLinePlayback({
      lastTextTarget: null,
      targetSelector: playback.targetSelector || ""
    });
  }

  function findTextTargetFromSelector(selector) {
    if (!selector) {
      return null;
    }

    try {
      const selected = document.querySelector(selector);
      return resolveEditableFromElement(selected);
    } catch (error) {
      return null;
    }
  }

  function rememberPlaybackTextTarget(element, playbackOptions) {
    if (!playbackOptions || !element) {
      return;
    }

    const target = getPlayableTextTarget(element);
    if (!target || isPasswordField(target)) {
      return;
    }

    playbackOptions.lastTextTarget = target;
    playbackOptions.targetSelector = getTextTargetSelector(target) || playbackOptions.targetSelector || "";
  }

  function getTextTargetSelector(element) {
    if (!element) {
      return "";
    }

    for (const attr of ["name", "aria-label", "placeholder", "data-testid", "data-test", "data-qa"]) {
      const value = element.getAttribute && element.getAttribute(attr);
      if (!value) {
        continue;
      }
      const selector = tagName(element) + "[" + attr + "=\"" + escapeAttribute(value) + "\"]";
      if (isUniqueSelector(selector)) {
        return selector;
      }
    }

    return getStableSelector(element);
  }

  function getPlayableTextTarget(element) {
    const active = getEditableElement(document.activeElement);
    if (isLineTextTarget(active)) {
      return active;
    }

    const direct = resolveEditableFromElement(element);
    if (isLineTextTarget(direct)) {
      return direct;
    }

    return null;
  }

  function resolveEditableFromElement(element) {
    const direct = getEditableElement(element);
    if (isLineTextTarget(direct)) {
      return direct;
    }

    if (element && typeof element.querySelector === "function") {
      const inside = Array.from(element.querySelectorAll(editableSelector()))
        .find((candidate) => isLineTextTarget(candidate));
      if (inside) {
        return inside;
      }
    }

    return null;
  }

  function isLineTextTarget(element) {
    if (!element || isPasswordField(element)) {
      return false;
    }

    const tag = tagName(element);
    if (tag === "textarea") {
      return true;
    }

    if (tag === "input") {
      return isTextElement(element);
    }

    return isEditableTextHost(element) && tag !== "select";
  }

  function findActionElement(action) {
    if (action.selector) {
      try {
        const selected = document.querySelector(action.selector);
        if (selected) {
          return selected;
        }
      } catch (error) {
        // Fall through to coordinates.
      }
    }

    if (Number.isFinite(action.x) && Number.isFinite(action.y)) {
      return document.elementFromPoint(action.x, action.y);
    }
    return null;
  }

  function focusAndScroll(element) {
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
    }
    if (typeof element.focus === "function") {
      element.focus({ preventScroll: true });
    }
  }

  function getPlaybackPoint(element, action) {
    const rect = element.getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.top + rect.height / 2;

    if (Number.isFinite(action.offsetX) && Number.isFinite(action.offsetY)) {
      x = rect.left + action.offsetX;
      y = rect.top + action.offsetY;
    } else if (Number.isFinite(action.x) && Number.isFinite(action.y)) {
      x = action.x;
      y = action.y;
    }

    x = Math.max(0, Math.min(window.innerWidth - 1, x));
    y = Math.max(0, Math.min(window.innerHeight - 1, y));
    return { x, y };
  }

  function dispatchPointer(element, type, point, button) {
    if (!window.PointerEvent) {
      return;
    }

    element.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: button || 0,
      buttons: type === "pointerdown" ? 1 : 0,
      clientX: point.x,
      clientY: point.y,
      view: window
    }));
  }

  function dispatchMouse(element, type, point, button) {
    element.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      button: button || 0,
      buttons: type === "mousedown" ? 1 : 0,
      clientX: point.x,
      clientY: point.y,
      view: window
    }));
  }

  function setTextValue(element, value) {
    if (isContentEditable(element) || (!("value" in element) && isEditableTextHost(element))) {
      setRichTextValue(element, value);
      dispatchInputEvents(element);
      return;
    }

    if (!("value" in element)) {
      return;
    }

    const prototype = tagName(element) === "textarea"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    dispatchInputEvents(element);
  }

  function setRichTextValue(element, value) {
    focusAndScroll(element);

    const selection = window.getSelection && window.getSelection();
    if (selection && document.createRange) {
      const range = document.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    let inserted = false;
    try {
      inserted = document.execCommand && document.execCommand("insertText", false, value);
    } catch (error) {
      inserted = false;
    }

    if (!inserted) {
      element.textContent = value;
    }
  }

  function setCheckedValue(element, checked) {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, checked);
    } else {
      element.checked = checked;
    }
  }

  function dispatchInputEvents(element) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      composed: true,
      inputType: "insertText"
    }));
    element.dispatchEvent(new Event("change", {
      bubbles: true,
      cancelable: true,
      composed: true
    }));
  }

  function pressEnter(element) {
    const eventInit = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window
    };

    const keydown = new KeyboardEvent("keydown", eventInit);
    element.dispatchEvent(keydown);
    element.dispatchEvent(new KeyboardEvent("keypress", eventInit));

    if (!keydown.defaultPrevented) {
      const submitted = submitNearestForm(element);
      if (!submitted) {
        clickLikelySendButton(element);
      }
    }

    element.dispatchEvent(new KeyboardEvent("keyup", eventInit));
  }

  function submitNearestForm(element) {
    const form = element && typeof element.closest === "function" ? element.closest("form") : null;
    if (!form) {
      return false;
    }

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return true;
    }

    if (typeof form.submit === "function") {
      form.submit();
      return true;
    }

    return false;
  }

  function clickLikelySendButton(element) {
    const root = element && typeof element.closest === "function"
      ? element.closest("form, main, section, article, body")
      : document;
    const buttons = Array.from((root || document).querySelectorAll("button, [role='button']"));
    const sendButton = buttons.find((button) => {
      if (button.disabled || button.getAttribute("aria-disabled") === "true") {
        return false;
      }

      const text = [
        button.getAttribute("aria-label"),
        button.getAttribute("title"),
        button.textContent
      ].join(" ").toLowerCase();

      return /\b(send|submit|go|search|post|enter|dergo|dërgo)\b/.test(text);
    });

    if (sendButton) {
      sendButton.click();
    }
  }

  function canRecordEvent(event) {
    return state.isRecording
      && !state.isPlaying
      && event.isTrusted !== false
      && !isRecorderUiEvent(event);
  }

  function isRecorderUiEvent(event) {
    if (!sidePanelHost || !event) {
      return false;
    }

    if (typeof event.composedPath === "function") {
      return event.composedPath().includes(sidePanelHost);
    }

    return sidePanelHost.contains(event.target);
  }

  function elapsed() {
    return Date.now() - (state.startedAtMs || Date.now());
  }

  function nearestElement(target) {
    if (!target) {
      return null;
    }
    if (target.nodeType === Node.ELEMENT_NODE) {
      return target;
    }
    return target.parentElement || null;
  }

  function getEditableElement(target) {
    const element = nearestElement(target);
    if (!element) {
      return null;
    }

    if (isEditableTextHost(element)) {
      return element;
    }

    const editable = element.closest(editableSelector());
    return editable || null;
  }

  function editableSelector() {
    return [
      "input",
      "textarea",
      "select",
      "[contenteditable]",
      "[role='textbox']",
      ".ProseMirror",
      "[data-lexical-editor]",
      "[data-slate-editor='true']",
      "[data-testid*='textbox' i]",
      "[data-testid*='composer' i]",
      "[aria-label*='message' i]",
      "[aria-label*='chat' i]"
    ].join(", ");
  }

  function isTextElement(element) {
    const tag = tagName(element);
    if (tag === "textarea") {
      return true;
    }
    if (tag !== "input") {
      return false;
    }
    const type = lowerAttribute(element, "type") || "text";
    return [
      "text",
      "search",
      "email",
      "url",
      "tel",
      "number",
      "date",
      "datetime-local",
      "month",
      "time",
      "week",
      "color"
    ].includes(type);
  }

  function isChoiceElement(element) {
    if (tagName(element) !== "input") {
      return false;
    }
    const type = lowerAttribute(element, "type");
    return type === "checkbox" || type === "radio";
  }

  function isPasswordField(element) {
    return tagName(element) === "input" && lowerAttribute(element, "type") === "password";
  }

  function isContentEditable(element) {
    if (!element) {
      return false;
    }

    if (element.isContentEditable) {
      return true;
    }

    const contentEditable = lowerAttribute(element, "contenteditable");
    return Boolean(contentEditable && contentEditable !== "false");
  }

  function isEditableTextHost(element) {
    if (!element) {
      return false;
    }

    if (isContentEditable(element)) {
      return true;
    }

    const tag = tagName(element);
    if (tag === "input" || tag === "textarea" || tag === "select") {
      return true;
    }

    return lowerAttribute(element, "role") === "textbox"
      || element.classList.contains("ProseMirror")
      || element.hasAttribute("data-lexical-editor")
      || element.getAttribute("data-slate-editor") === "true";
  }

  function readElementValue(element) {
    if (isContentEditable(element)) {
      return element.textContent || "";
    }
    if (!("value" in element) && isEditableTextHost(element)) {
      return element.textContent || "";
    }
    return "value" in element ? element.value || "" : "";
  }

  function tagName(element) {
    return element && element.tagName ? element.tagName.toLowerCase() : "";
  }

  function lowerAttribute(element, name) {
    const value = element && element.getAttribute ? element.getAttribute(name) : "";
    return value ? value.toLowerCase() : "";
  }

  function getOffsetX(element, event) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return 0;
    }
    return Math.round(event.clientX - element.getBoundingClientRect().left);
  }

  function getOffsetY(element, event) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return 0;
    }
    return Math.round(event.clientY - element.getBoundingClientRect().top);
  }

  function elementLabel(element) {
    if (!element) {
      return "";
    }
    const label = element.getAttribute("aria-label")
      || element.getAttribute("title")
      || element.getAttribute("placeholder")
      || element.innerText
      || element.value
      || "";
    return String(label).replace(/\s+/g, " ").trim().slice(0, 100);
  }

  function getStableSelector(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const id = element.getAttribute("id");
    if (id) {
      const idSelector = "#" + cssEscape(id);
      if (isUniqueSelector(idSelector)) {
        return idSelector;
      }
    }

    for (const attr of ["data-testid", "data-test", "data-qa", "name", "aria-label", "placeholder"]) {
      const value = element.getAttribute(attr);
      if (!value) {
        continue;
      }
      const attrSelector = tagName(element) + "[" + attr + "=\"" + escapeAttribute(value) + "\"]";
      if (isUniqueSelector(attrSelector)) {
        return attrSelector;
      }
    }

    const path = [];
    let node = element;
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      path.unshift(selectorPart(node));
      const candidate = path.join(" > ");
      if (isUniqueSelector(candidate)) {
        return candidate;
      }
      if (node === document.body || node === document.documentElement) {
        break;
      }
      node = node.parentElement;
    }

    return path.join(" > ");
  }

  function selectorPart(element) {
    let part = tagName(element);
    const classes = Array.from(element.classList || [])
      .filter((className) => /^[A-Za-z0-9_-]+$/.test(className))
      .slice(0, 2);

    if (classes.length) {
      part += "." + classes.map(cssEscape).join(".");
    }

    const parent = element.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((child) => tagName(child) === tagName(element));
      if (sameTag.length > 1) {
        part += ":nth-of-type(" + (sameTag.indexOf(element) + 1) + ")";
      }
    }

    return part;
  }

  function isUniqueSelector(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (error) {
      return false;
    }
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/[^A-Za-z0-9_-]/g, "\\$&");
  }

  function escapeAttribute(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  }

  async function loadState() {
    const stored = await storageGet();
    state = normalizeState(stored);
    if (state.isRecording && !state.startedAtMs) {
      state.startedAtMs = Date.now();
    }
    state.isPlaying = Boolean(state.playback && state.playback.active);
    renderBadge();
    if (state.playback && state.playback.active) {
      window.setTimeout(() => {
        continueQueuedLinePlayback().catch(async (error) => {
          console.error("Auto Click Recorder line playback failed:", error);
          state.isPlaying = false;
          state.playback = { active: false };
          await flushState();
          renderBadge();
          updateSidePanel(error.message || "Line playback failed");
        });
      }, 250);
    }
  }

  function normalizeState(stored) {
    const normalized = {
      ...defaultState,
      ...(stored || {}),
      options: {
        ...defaultState.options,
        ...((stored && stored.options) || {})
      },
      playback: {
        ...defaultState.playback,
        ...((stored && stored.playback) || {})
      },
      actions: Array.isArray(stored && stored.actions) ? stored.actions : []
    };
    if (!Array.isArray(normalized.playback.lines)) {
      normalized.playback.lines = [];
    }
    if (normalized.playback.active && normalized.playback.lines.length === 0) {
      normalized.playback.active = false;
    }
    return normalized;
  }

  function storageGet() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (items) => {
        resolve(items[STORAGE_KEY]);
      });
    });
  }

  function saveStateSoon() {
    if (saveTimer) {
      return;
    }
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      flushState();
    }, 250);
  }

  function flushPendingState() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
  }

  function flushState() {
    flushPendingState();
    state.updatedAt = new Date().toISOString();
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: publicState() }, resolve);
    });
  }

  function publicState() {
    return {
      format: state.format || "auto-click-recorder/v1",
      createdAt: state.createdAt || "",
      updatedAt: state.updatedAt || "",
      sourceUrl: state.sourceUrl || "",
      isRecording: Boolean(state.isRecording),
      isPlaying: Boolean(state.isPlaying),
      startedAtMs: state.startedAtMs || 0,
      options: { includeMoves: Boolean(state.options && state.options.includeMoves) },
      playback: state.playback || { active: false },
      actions: Array.isArray(state.actions) ? state.actions : []
    };
  }

  function ensureSidePanel() {
    if (sidePanelHost || !document.documentElement) {
      return;
    }

    sidePanelHost = document.createElement("div");
    sidePanelHost.setAttribute("data-auto-click-recorder-panel", "true");
    sidePanelHost.style.position = "fixed";
    sidePanelHost.style.left = "0";
    sidePanelHost.style.top = "0";
    sidePanelHost.style.zIndex = "2147483647";
    sidePanelHost.style.font = "14px Arial, Helvetica, sans-serif";
    sidePanelHost.style.colorScheme = "light";
    sidePanelShadow = sidePanelHost.attachShadow({ mode: "open" });
    sidePanelShadow.innerHTML = sidePanelTemplate();
    document.documentElement.appendChild(sidePanelHost);

    sidePanelEls = {
      wrap: sidePanelShadow.querySelector(".acr-wrap"),
      tab: sidePanelShadow.querySelector(".acr-tab"),
      panel: sidePanelShadow.querySelector(".acr-panel"),
      status: sidePanelShadow.querySelector(".acr-status"),
      count: sidePanelShadow.querySelector(".acr-count"),
      record: sidePanelShadow.querySelector("[data-action='record']"),
      stop: sidePanelShadow.querySelector("[data-action='stop']"),
      play: sidePanelShadow.querySelector("[data-action='play']"),
      cancel: sidePanelShadow.querySelector("[data-action='cancel']"),
      export: sidePanelShadow.querySelector("[data-action='export']"),
      import: sidePanelShadow.querySelector("[data-action='import']"),
      clear: sidePanelShadow.querySelector("[data-action='clear']"),
      close: sidePanelShadow.querySelector("[data-action='close']"),
      moves: sidePanelShadow.querySelector("[data-field='moves']"),
      speed: sidePanelShadow.querySelector("[data-field='speed']"),
      liveText: sidePanelShadow.querySelector("[data-field='liveText']"),
      enter: sidePanelShadow.querySelector("[data-field='enter']"),
      delay: sidePanelShadow.querySelector("[data-field='delay']"),
      file: sidePanelShadow.querySelector("[data-field='file']")
    };

    sidePanelEls.tab.addEventListener("click", () => {
      sidePanelExpanded = !sidePanelExpanded;
      updateSidePanel();
    });

    sidePanelEls.close.addEventListener("click", () => {
      sidePanelExpanded = false;
      updateSidePanel();
    });

    sidePanelEls.record.addEventListener("click", () => runSidePanelAction(async () => {
      await startRecording({ includeMoves: sidePanelEls.moves.checked });
    }, "Recording"));

    sidePanelEls.stop.addEventListener("click", () => runSidePanelAction(stopRecording, "Stopped"));

    sidePanelEls.play.addEventListener("click", () => runSidePanelAction(async () => {
      await beginPlayback({
        speed: Number(sidePanelEls.speed.value),
        liveText: sidePanelEls.liveText.value,
        pressEnter: sidePanelEls.enter.checked,
        lineDelaySeconds: Number(sidePanelEls.delay.value)
      });
    }, "Playing"));

    sidePanelEls.cancel.addEventListener("click", () => runSidePanelAction(async () => {
      playbackCancelled = true;
      state.isPlaying = false;
      state.playback = { active: false };
      await flushState();
      renderBadge();
      updateSidePanel("Cancelled");
    }, "Cancelled"));

    sidePanelEls.clear.addEventListener("click", () => runSidePanelAction(clearRecording, "Cleared"));
    sidePanelEls.export.addEventListener("click", () => runSidePanelAction(exportRecordingFromPage, "TXT exported"));
    sidePanelEls.import.addEventListener("click", () => {
      sidePanelEls.file.value = "";
      sidePanelEls.file.click();
    });

    sidePanelEls.file.addEventListener("change", () => runSidePanelAction(importRecordingFromPage, "TXT imported"));
  }

  function sidePanelTemplate() {
    return `
      <style>
        :host {
          all: initial;
          color-scheme: light;
        }

        .acr-wrap {
          position: fixed;
          left: 0;
          top: 50%;
          z-index: 2147483647;
          transform: translate(-304px, -50%);
          display: flex;
          align-items: center;
          gap: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: #152033;
          transition: transform 160ms ease;
        }

        .acr-wrap.is-open {
          transform: translate(0, -50%);
        }

        .acr-panel {
          width: 304px;
          max-height: min(560px, calc(100vh - 32px));
          overflow: auto;
          padding: 12px;
          border: 1px solid #dbe2ec;
          border-left: 0;
          border-radius: 0 8px 8px 0;
          background: #ffffff;
          box-shadow: 0 18px 48px rgba(17, 24, 39, 0.2);
        }

        .acr-tab {
          width: 42px;
          min-height: 96px;
          border: 1px solid #0f5147;
          border-left: 0;
          border-radius: 0 8px 8px 0;
          background: #176b5d;
          color: #ffffff;
          cursor: pointer;
          font: 700 13px/1 Arial, Helvetica, sans-serif;
          letter-spacing: 0;
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }

        .acr-tab:hover {
          background: #0f5147;
        }

        .acr-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 12px;
        }

        .acr-title {
          margin: 0 0 4px;
          font: 700 16px/1.2 Arial, Helvetica, sans-serif;
          color: #081427;
        }

        .acr-status {
          margin: 0;
          color: #5c687a;
          font: 12px/1.35 Arial, Helvetica, sans-serif;
        }

        .acr-count {
          min-width: 38px;
          padding: 5px 7px;
          border: 1px solid #dbe2ec;
          border-radius: 8px;
          background: #f6f8fb;
          text-align: center;
          font: 700 13px/1 Arial, Helvetica, sans-serif;
          color: #152033;
        }

        .acr-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .acr-settings {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin: 10px 0;
          padding: 9px;
          border: 1px solid #dbe2ec;
          border-radius: 8px;
          background: #f9fbfd;
        }

        .acr-live {
          display: grid;
          gap: 7px;
          margin: 10px 0;
        }

        .acr-live label {
          font: 700 12px/1.2 Arial, Helvetica, sans-serif;
          color: #152033;
        }

        .acr-live textarea {
          width: 100%;
          min-height: 64px;
          resize: vertical;
          border: 1px solid #dbe2ec;
          border-radius: 8px;
          padding: 8px;
          background: #ffffff;
          color: #152033;
          font: 13px/1.35 Arial, Helvetica, sans-serif;
        }

        .acr-live textarea:focus {
          outline: 2px solid rgba(23, 107, 93, 0.24);
          border-color: #176b5d;
        }

        button,
        select,
        input[type="number"] {
          width: 100%;
          min-height: 34px;
          border: 1px solid #dbe2ec;
          border-radius: 8px;
          background: #ffffff;
          color: #152033;
          font: 700 13px Arial, Helvetica, sans-serif;
        }

        button {
          cursor: pointer;
        }

        button:hover:not(:disabled) {
          border-color: #176b5d;
        }

        button:disabled {
          cursor: not-allowed;
          color: #647084;
          background: #eef2f6;
        }

        .acr-primary {
          border-color: #176b5d;
          background: #176b5d;
          color: #ffffff;
        }

        .acr-danger:hover:not(:disabled) {
          border-color: #b3261e;
          color: #b3261e;
        }

        .acr-check,
        .acr-select {
          display: flex;
          align-items: center;
          gap: 7px;
          font: 13px Arial, Helvetica, sans-serif;
          color: #152033;
        }

        .acr-check input {
          width: 17px;
          height: 17px;
          accent-color: #176b5d;
        }

        .acr-select select {
          width: 70px;
          min-height: 30px;
          padding: 0 6px;
        }

        .acr-select input[type="number"] {
          width: 70px;
          min-height: 30px;
          padding: 0 6px;
          font-weight: 700;
        }

        .acr-close {
          width: 34px;
          min-height: 30px;
          font-size: 18px;
          line-height: 1;
        }
      </style>

      <div class="acr-wrap" part="wrap">
        <section class="acr-panel" aria-label="Auto Click Recorder panel">
          <header class="acr-head">
            <div>
              <h2 class="acr-title">Auto Click</h2>
              <p class="acr-status">Ready</p>
            </div>
            <span class="acr-count">0</span>
            <button class="acr-close" data-action="close" type="button" title="Close">x</button>
          </header>

          <div class="acr-grid">
            <button class="acr-primary" data-action="record" type="button">Record</button>
            <button data-action="stop" type="button">Stop</button>
            <button data-action="play" type="button">Play</button>
            <button class="acr-danger" data-action="cancel" type="button">Cancel</button>
          </div>

          <div class="acr-settings">
            <label class="acr-check">
              <input data-field="moves" type="checkbox">
              <span>Mouse moves</span>
            </label>
            <label class="acr-select">
              <span>Speed</span>
              <select data-field="speed">
                <option value="1">1x</option>
                <option value="2">2x</option>
                <option value="4">4x</option>
              </select>
            </label>
          </div>

          <div class="acr-live">
            <label for="acr-live-text">TXT lines</label>
            <textarea id="acr-live-text" data-field="liveText" placeholder="One line per Enter"></textarea>
            <label class="acr-check">
              <input data-field="enter" type="checkbox" checked>
              <span>Enter after text</span>
            </label>
            <label class="acr-select">
              <span>Delay</span>
              <input data-field="delay" type="number" min="0" step="1" value="5">
            </label>
          </div>

          <div class="acr-grid">
            <button data-action="export" type="button">Export TXT</button>
            <button data-action="import" type="button">Import TXT</button>
            <button class="acr-danger" data-action="clear" type="button">Clear</button>
          </div>

          <input data-field="file" type="file" accept=".txt,.json,application/json,text/plain" hidden>
        </section>
        <button class="acr-tab" type="button" aria-label="Open Auto Click Recorder">AUTO</button>
      </div>
    `;
  }

  async function runSidePanelAction(action, successMessage) {
    ensureSidePanel();
    setSidePanelBusy(true);
    try {
      await action();
      updateSidePanel(successMessage);
    } catch (error) {
      updateSidePanel(error.message || "Action failed");
    } finally {
      setSidePanelBusy(false);
    }
  }

  function updateSidePanel(customText) {
    if (!sidePanelEls) {
      return;
    }

    const actions = Array.isArray(state.actions) ? state.actions : [];
    const isRecording = Boolean(state.isRecording);
    const isPlaying = Boolean(state.isPlaying);

    sidePanelEls.wrap.classList.toggle("is-open", sidePanelExpanded);
    sidePanelEls.count.textContent = String(actions.length);
    sidePanelEls.tab.textContent = isRecording ? "REC " + actions.length : "AUTO";
    sidePanelEls.record.disabled = isRecording || isPlaying;
    sidePanelEls.stop.disabled = !isRecording;
    sidePanelEls.play.disabled = actions.length === 0 || isRecording || isPlaying;
    sidePanelEls.cancel.disabled = !isPlaying;
    sidePanelEls.export.disabled = actions.length === 0;
    sidePanelEls.clear.disabled = actions.length === 0 || isRecording || isPlaying;
    sidePanelEls.moves.disabled = isRecording || isPlaying;
    sidePanelEls.speed.disabled = isRecording || isPlaying;
    sidePanelEls.liveText.disabled = isPlaying;
    sidePanelEls.enter.disabled = isPlaying;
    sidePanelEls.delay.disabled = isPlaying;

    if (customText) {
      sidePanelEls.status.textContent = customText;
    } else if (state.playback && state.playback.active && Array.isArray(state.playback.lines)) {
      sidePanelEls.status.textContent = "Line " + Math.min(state.playback.index + 1, state.playback.lines.length) + "/" + state.playback.lines.length;
    } else if (isRecording) {
      sidePanelEls.status.textContent = "Recording";
    } else if (isPlaying) {
      sidePanelEls.status.textContent = "Playing";
    } else if (actions.length > 0) {
      sidePanelEls.status.textContent = "Ready to play or export";
    } else {
      sidePanelEls.status.textContent = "Ready";
    }
  }

  function setSidePanelBusy(isBusy) {
    if (!sidePanelEls) {
      return;
    }

    sidePanelEls.panel.toggleAttribute("aria-busy", isBusy);
  }

  async function exportRecordingFromPage() {
    const actions = Array.isArray(state.actions) ? state.actions : [];
    if (actions.length === 0) {
      throw new Error("There is nothing to export yet.");
    }

    const exportData = {
      format: "auto-click-recorder/v1",
      exportedAt: new Date().toISOString(),
      sourceUrl: state.sourceUrl || location.href,
      actions
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    link.href = url;
    link.download = "auto-click-recording-" + stamp + ".txt";
    link.style.display = "none";
    document.documentElement.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importRecordingFromPage() {
    const file = sidePanelEls && sidePanelEls.file.files && sidePanelEls.file.files[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    let imported;
    try {
      imported = JSON.parse(text);
    } catch (error) {
      sidePanelEls.liveText.value = text.trimEnd();
      updateSidePanel("TXT lines loaded: " + getTextLines(text).length);
      return;
    }

    if (Array.isArray(imported.actions)) {
      await importRecording({
        sourceUrl: imported.sourceUrl || "",
        actions: imported.actions
      });
      return;
    }

    if (typeof imported.text === "string") {
      sidePanelEls.liveText.value = imported.text.trimEnd();
      updateSidePanel("TXT lines loaded: " + getTextLines(imported.text).length);
      return;
    }

    throw new Error("No recording or TXT lines found in that file.");
  }

  function renderBadge(customText) {
    if (!state.isRecording && !state.isPlaying) {
      if (badge) {
        badge.remove();
        badge = null;
      }
      return;
    }

    if (!badge) {
      badge = document.createElement("div");
      badge.setAttribute("data-auto-click-recorder", "true");
      Object.assign(badge.style, {
        position: "fixed",
        right: "14px",
        bottom: "14px",
        zIndex: "2147483647",
        padding: "8px 10px",
        borderRadius: "8px",
        background: "rgba(21, 32, 51, 0.92)",
        color: "#ffffff",
        font: "12px/1.2 Arial, Helvetica, sans-serif",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",
        pointerEvents: "none"
      });
      document.documentElement.appendChild(badge);
    }

    badge.textContent = customText || (state.isRecording
      ? "Recording " + state.actions.length
      : playbackBadgeText());
  }

  function playbackBadgeText() {
    if (state.playback && state.playback.active && Array.isArray(state.playback.lines)) {
      return "Line " + Math.min(state.playback.index + 1, state.playback.lines.length) + "/" + state.playback.lines.length;
    }

    return "Playing";
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function waitDuringPlayback(ms) {
    const endAt = Date.now() + ms;
    while (!playbackCancelled && Date.now() < endAt) {
      await wait(Math.min(250, endAt - Date.now()));
    }
  }
})();
