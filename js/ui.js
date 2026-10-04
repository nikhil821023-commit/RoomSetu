// Shared UI helpers used across every feature module: toasts, screen
// switching, the API-config panel, and small formatting utilities.

function toast(message, type = '') {
  const container = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast-item' + (type ? ' ' + type : '');
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function showScreen(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showTab(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
   if (name === 'mylistings') {
    document.getElementById('view-my-listings').classList.add('active');
    loadMyListings();
    return;
  }
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.nav-btn[data-tab="${name}"]`);
  if (btn) btn.classList.add('active');

  if (name === 'discover') loadDiscover();
  if (name === 'matches') loadMatches();
  if (name === 'checklist') loadHouseholds();
  if (name === 'me') loadMe();
  // Add this line near the top of showTab(), before anything else runs:
if (typeof chatPollInterval !== 'undefined') clearInterval(chatPollInterval);
}

function toggleApiConfig() {
  const el = document.getElementById('api-config');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
  document.getElementById('api-base-input').value = State.apiBase;
}

async function saveApiBase() {
  const val = document.getElementById('api-base-input').value.trim();
  if (val) State.apiBase = val.replace(/\/$/, '');
  localStorage.setItem('roomsetu_api_base', State.apiBase);
  const dot = document.getElementById('api-status-dot');
  const text = document.getElementById('api-status-text');
  text.textContent = 'Checking...';
  dot.className = 'dot';
  try {
    await fetch(State.apiBase + '/support/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'ping' })
    });
    dot.className = 'dot ok'; text.textContent = 'Connected';
    toast('Backend connected', 'success');
  } catch (e) {
    dot.className = 'dot bad'; text.textContent = 'Could not reach backend';
  }
}

function ringSvg(pct) {
  const r = 19, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
  return `<svg width="46" height="46"><circle cx="23" cy="23" r="${r}" stroke="#EEF1F6" stroke-width="4" fill="none"/>
    <circle cx="23" cy="23" r="${r}" stroke="#2F6F6B" stroke-width="4" fill="none" stroke-linecap="round"
    stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`;
}
function avatarColor(id) {
  const colors = ['#2F6F6B', '#C8811F', '#E06B54', '#5B6EE1', '#8B5CF6'];
  return colors[id % colors.length];
}
function emptyState(title, body) {
  return `<div class="empty-state"><b>${title}</b><p>${body}</p></div>`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}