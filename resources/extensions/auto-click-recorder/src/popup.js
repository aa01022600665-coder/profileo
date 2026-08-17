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

const els = {
  statusText: document.getElementById("statusText"),
  eventCount: document.getElementById("eventCount"),
  recordButton: document.getElementById("recordButton"),
  stopButton: document.getElementById("stopButton"),
  playButton: document.getElementById("playButton"),
  stopPlayButton: document.getElementById("stopPlayButton"),
  exportButton: document.getElementById("exportButton"),
  importButton: document.getElementById("importButton"),
  clearButton: document.getElementById("clearButton"),
  importFile: document.getElementById("importFile"),
  movesToggle: document.getElementById("movesToggle"),
  speedSelect: document.getElementById("speedSelect"),
  liveTextInput: document.getElementById("liveTextInput"),
  enterToggle: document.getElementById("enterToggle"),
  delayInput: document.getElementById("delayInput")
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  refreshStatus();
});

function bindEvents() {
  els.recordButton.addEventListener("click", () => runAction(async () => {
    await sendToActiveTab({
      type: messageTypes.start,
      options: { includeMoves: els.movesToggle.checked }
    });
    await refreshStatus();
  }));

  els.stopButton.addEventListener("click", () => runAction(async () => {
    await sendToActiveTab({ type: messageTypes.stop });
    await refreshStatus();
  }));

  els.playButton.addEventListener("click", () => runAction(async () => {
    await sendToActiveTab({
      type: messageTypes.play,
      speed: Number(els.speedSelect.value),
      liveText: els.liveTextInput.value,
      pressEnter: els.enterToggle.checked,
      lineDelaySeconds: Number(els.delayInput.value)
    });
    await refreshStatus();
  }));

  els.stopPlayButton.addEventListener("click", () => runAction(async () => {
    await sendToActiveTab({ type: messageTypes.stopPlay });
    await refreshStatus();
  }));

  els.clearButton.addEventListener("click", () => runAction(async () => {
    await sendToActiveTab({ type: messageTypes.clear }).catch(() => clearStoredRecording());
    await refreshStatus();
  }));

  els.exportButton.addEventListener("click", () => runAction(exportRecording));

  els.importButton.addEventListener("click", () => {
    els.importFile.value = "";
    els.importFile.click();
  });

  els.importFile.addEventListener("change", () => runAction(importRecording));
}

async function runAction(action) {
  setBusy(true);
  try {
    await action();
  } catch (error) {
    setStatus(error.message || "Something went wrong");
  } finally {
    setBusy(false);
  }
}

async function refreshStatus() {
  const fallback = await getStoredState();
  let response = null;

  try {
    response = await sendToActiveTab({ type: messageTypes.status });
  } catch (error) {
    response = { ok: false, state: fallback, error: "Open or reload a normal webpage to use the recorder." };
  }

  const state = response.state || fallback;
  renderState(state, response.error);
}

function renderState(state, message) {
  const actions = Array.isArray(state.actions) ? state.actions : [];
  const isRecording = Boolean(state.isRecording);
  const isPlaying = Boolean(state.isPlaying);

  els.eventCount.textContent = String(actions.length);
  els.recordButton.disabled = isRecording || isPlaying;
  els.stopButton.disabled = !isRecording;
  els.playButton.disabled = actions.length === 0 || isRecording || isPlaying;
  els.stopPlayButton.disabled = !isPlaying;
  els.exportButton.disabled = actions.length === 0;
  els.clearButton.disabled = actions.length === 0 || isRecording || isPlaying;
  els.movesToggle.disabled = isRecording || isPlaying;
  els.speedSelect.disabled = isRecording || isPlaying;
  els.liveTextInput.disabled = isPlaying;
  els.enterToggle.disabled = isPlaying;
  els.delayInput.disabled = isPlaying;

  if (message) {
    setStatus(message);
  } else if (isRecording) {
    setStatus("Recording");
  } else if (state.playback && state.playback.active && Array.isArray(state.playback.lines)) {
    setStatus(`Line ${Math.min(state.playback.index + 1, state.playback.lines.length)}/${state.playback.lines.length}`);
  } else if (isPlaying) {
    setStatus("Playing");
  } else if (actions.length > 0) {
    setStatus("Ready to play or export");
  } else {
    setStatus("Ready");
  }
}

async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    throw new Error("No active tab found.");
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response || { ok: true });
    });
  });
}

async function getStoredState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (items) => {
      resolve(items[STORAGE_KEY] || { actions: [], isRecording: false, isPlaying: false });
    });
  });
}

async function clearStoredRecording() {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      [STORAGE_KEY]: {
        format: "auto-click-recorder/v1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceUrl: "",
        isRecording: false,
        isPlaying: false,
        startedAtMs: 0,
        options: { includeMoves: false },
        playback: { active: false },
        actions: []
      }
    }, resolve);
  });
}

async function exportRecording() {
  const state = await getStoredState();
  const actions = Array.isArray(state.actions) ? state.actions : [];
  if (actions.length === 0) {
    throw new Error("There is nothing to export yet.");
  }

  const exportData = {
    format: "auto-click-recorder/v1",
    exportedAt: new Date().toISOString(),
    sourceUrl: state.sourceUrl || "",
    actions
  };

  const text = JSON.stringify(exportData, null, 2);
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  link.href = url;
  link.download = `auto-click-recording-${stamp}.txt`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus("TXT exported");
}

async function importRecording() {
  const file = els.importFile.files && els.importFile.files[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  let imported;
  try {
    imported = JSON.parse(text);
  } catch (error) {
    els.liveTextInput.value = text.trimEnd();
    setStatus(`TXT lines loaded: ${getTextLines(text).length}`);
    return;
  }

  const actions = Array.isArray(imported.actions) ? imported.actions : null;
  if (!actions) {
    if (typeof imported.text === "string") {
      els.liveTextInput.value = imported.text.trimEnd();
      setStatus(`TXT lines loaded: ${getTextLines(imported.text).length}`);
      return;
    }
    throw new Error("No recording or TXT lines found in that file.");
  }

  await sendToActiveTab({
    type: messageTypes.import,
    recording: {
      format: "auto-click-recorder/v1",
      importedAt: new Date().toISOString(),
      sourceUrl: imported.sourceUrl || "",
      actions
    }
  }).catch(async () => {
    await chrome.storage.local.set({
      [STORAGE_KEY]: {
        format: "auto-click-recorder/v1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceUrl: imported.sourceUrl || "",
        isRecording: false,
        isPlaying: false,
        startedAtMs: 0,
        options: { includeMoves: false },
        playback: { active: false },
        actions
      }
    });
  });

  await refreshStatus();
}

function setBusy(isBusy) {
  document.body.classList.toggle("busy", isBusy);
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function getTextLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
