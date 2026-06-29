// Authentication gate. Shows a login/register overlay until the user is signed
// in, then reveals the app. Loaded before the other modules.

let authMode = 'login'; // 'login' | 'register'

function _authEl(id) {
  return document.getElementById(id);
}

function showAuthOverlay() {
  const overlay = _authEl('auth-overlay');
  if (overlay) overlay.hidden = false;
  const logout = _authEl('logout-btn');
  if (logout) logout.hidden = true;
}

function hideAuthOverlay(email) {
  const overlay = _authEl('auth-overlay');
  if (overlay) overlay.hidden = true;
  const logout = _authEl('logout-btn');
  if (logout) {
    logout.hidden = false;
    logout.title = email ? `Signed in as ${email} — sign out` : 'Sign out';
  }
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  _authEl('auth-sub').textContent =
    authMode === 'login' ? 'Sign in to practice interviews' : 'Create an account to get started';
  _authEl('auth-submit').textContent = authMode === 'login' ? 'Sign in' : 'Create account';
  _authEl('auth-toggle-text').textContent = authMode === 'login' ? 'New here?' : 'Already have an account?';
  _authEl('auth-toggle-link').textContent = authMode === 'login' ? 'Create an account' : 'Sign in';
  _authEl('auth-password').setAttribute(
    'autocomplete', authMode === 'login' ? 'current-password' : 'new-password'
  );
  const err = _authEl('auth-error');
  err.hidden = true;
  return false;
}

async function submitAuth(event) {
  event.preventDefault();
  const email = _authEl('auth-email').value.trim();
  const password = _authEl('auth-password').value;
  const err = _authEl('auth-error');
  const submit = _authEl('auth-submit');
  err.hidden = true;
  submit.disabled = true;

  try {
    const resp = await fetch(`/api/auth/${authMode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      err.textContent = data.error || 'Something went wrong.';
      err.hidden = false;
      return false;
    }
    // Reload so every module initializes cleanly with an authenticated session.
    window.location.reload();
  } catch (e) {
    err.textContent = 'Network error. Please try again.';
    err.hidden = false;
  } finally {
    submit.disabled = false;
  }
  return false;
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {
    // ignore — show the overlay regardless
  }
  window.location.reload();
}

async function checkAuth() {
  try {
    const resp = await fetch('/api/auth/me');
    const data = await resp.json();
    if (data.authenticated) {
      hideAuthOverlay(data.email);
      window.currentUserEmail = data.email;
    } else {
      showAuthOverlay();
    }
  } catch (e) {
    showAuthOverlay();
  }
}

document.addEventListener('DOMContentLoaded', checkAuth);
