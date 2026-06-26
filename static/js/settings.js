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

function availableLanguages() {
  return (engineConfig && engineConfig.languages) || [{ id: 'python', label: 'Python' }];
}

// The default language preference: the user's saved choice if it is still a
// supported language, otherwise the server default. Drives the editor's initial
// language so it does not have to be picked for every problem.
function defaultLanguage() {
  const saved = getSavedSettings().language;
  const langs = availableLanguages();
  if (saved && langs.some(l => l.id === saved)) return saved;
  return (engineConfig && engineConfig.default_language) || 'python';
}

function buildLanguageSelect() {
  currentLanguage = defaultLanguage();
  const sel = document.getElementById('language-select');
  if (sel) {
    sel.innerHTML = availableLanguages().map(l => `<option value="${l.id}">${l.label}</option>`).join('');
    sel.value = currentLanguage;
  }
  if (typeof setEditorLanguageMode === 'function') setEditorLanguageMode(currentLanguage);
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

  const langSel = document.getElementById('settings-language');
  if (langSel) {
    langSel.innerHTML = availableLanguages()
      .map(l => `<option value="${l.id}">${l.label}</option>`)
      .join('');
    langSel.value = defaultLanguage();
  }

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
  const langSel = document.getElementById('settings-language');
  if (langSel && langSel.value) out.language = langSel.value;
  const modelSel = document.getElementById('settings-model');
  if (modelSel && modelSel.value) out.model = modelSel.value;
  if (engineConfig && engineConfig.supports_effort) {
    const effortSel = document.getElementById('settings-effort');
    if (effortSel && effortSel.value) out.effort = effortSel.value;
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(out));
  closeSettings();

  // Apply the new default to the editor immediately when not mid-session, so the
  // next interview starts in the chosen language without another click.
  if (!currentSessionId) {
    currentLanguage = defaultLanguage();
    const editorSel = document.getElementById('language-select');
    if (editorSel) editorSel.value = currentLanguage;
    if (typeof setEditorLanguageMode === 'function') setEditorLanguageMode(currentLanguage);
  }
}
