// ── ENGINE SETTINGS (model + reasoning effort) ──
//
// Reads /api/config to learn the active provider's models and whether reasoning
// effort applies, then lets the user pick a saved default (localStorage) that is
// sent with every new interview and tutor chat.

let engineConfig = null;

const SETTINGS_KEY = 'engineSettings';

async function loadEngineConfig() {
  try {
    const res = await fetch('/api/config');
    engineConfig = await res.json();
  } catch (e) {
    engineConfig = null;
  }
  buildSettingsModal();
  buildLanguageSelect();
}

// ── Language selection ──
//
// The /api/config payload carries the language allowlist (id, label, CodeMirror
// mode). Populate the editor's language <select> from it and default to the
// configured default language.

function languageMeta(langId) {
  const list = (engineConfig && engineConfig.languages) || [];
  return list.find(l => l.id === langId) || { id: langId, codemirror_mode: langId, label: langId };
}

function buildLanguageSelect() {
  const sel = document.getElementById('language-select');
  if (!sel) return;
  const langs = (engineConfig && engineConfig.languages) || [{ id: 'python', label: 'Python' }];
  sel.innerHTML = langs.map(l => `<option value="${l.id}">${l.label}</option>`).join('');
  if (engineConfig && engineConfig.default_language) currentLanguage = engineConfig.default_language;
  sel.value = currentLanguage;
}

function getSavedSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

// Settings to merge into request bodies. Only includes keys the user actually
// chose; the backend falls back to its defaults for anything omitted.
function currentEngineSettings() {
  const saved = getSavedSettings();
  const out = {};
  if (saved.model) out.model = saved.model;
  if (saved.effort) out.effort = saved.effort;
  return out;
}

function buildSettingsModal() {
  if (!engineConfig) return;
  const saved = getSavedSettings();

  const provEl = document.getElementById('settings-provider');
  if (provEl) provEl.textContent = engineConfig.provider;

  const modelSel = document.getElementById('settings-model');
  if (modelSel) {
    modelSel.innerHTML = (engineConfig.models || [])
      .map(m => `<option value="${m.id}">${m.label}</option>`)
      .join('');
    modelSel.value = saved.model || engineConfig.default_model;
  }

  const effortRow = document.getElementById('settings-effort-row');
  const effortSel = document.getElementById('settings-effort');
  const note = document.getElementById('settings-note');
  if (engineConfig.supports_effort && (engineConfig.efforts || []).length) {
    if (effortRow) effortRow.style.display = '';
    if (note) note.style.display = '';
    if (effortSel) {
      effortSel.innerHTML = engineConfig.efforts
        .map(e => `<option value="${e}">${e.charAt(0).toUpperCase() + e.slice(1)}</option>`)
        .join('');
      effortSel.value = saved.effort || engineConfig.default_effort;
    }
  } else {
    if (effortRow) effortRow.style.display = 'none';
    if (note) note.style.display = 'none';
  }
}

function openSettings() {
  buildSettingsModal();
  document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

function saveSettings() {
  const out = {};
  const modelSel = document.getElementById('settings-model');
  if (modelSel && modelSel.value) out.model = modelSel.value;
  if (engineConfig && engineConfig.supports_effort) {
    const effortSel = document.getElementById('settings-effort');
    if (effortSel && effortSel.value) out.effort = effortSel.value;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(out));
  closeSettings();
}
