// Profile tab + app bootstrap — the entry point, loaded last.

async function loadMe() {
  document.getElementById('me-name').textContent = State.name || '—';
  document.getElementById('me-role').textContent = State.role || '—';
  document.getElementById('me-avatar').textContent = (State.name || '?').charAt(0);
  document.getElementById('me-avatar').style.background = avatarColor(Number(State.userId) || 0);
  document.getElementById('host-links-row').style.display = State.role === 'HOST' ? 'flex' : 'none';
  document.getElementById('admin-link-row').style.display = State.admin ? 'flex' : 'none';
  await api('/profile/me'); // throws if not onboarded yet — bootstrap() handles that

  // Add inside loadMe(), near the host-links-row line:
if (State.role === 'HOST') {
  try {
    const inquiries = await api('/listings/mine/inquiries');
    document.getElementById('inquiries-link-row').style.display = 'flex';
    if (inquiries.length) {
      const tag = document.getElementById('inquiries-count-tag');
      tag.style.display = 'inline-block';
      tag.textContent = inquiries.length;
      tag.style.background = 'var(--coral)'; tag.style.color = 'white';
    }
  } catch (_) {}
}


  try {
    const trust = await api('/trust/' + State.userId);
    document.getElementById('trust-score-val').textContent = trust.score + '/100';
    document.getElementById('trust-track-fill').style.width = trust.score + '%';
    const tag = document.getElementById('me-verification-tag');
    if (trust.idVerified) {
      tag.textContent = 'Verified';
      tag.style.background = 'var(--teal-soft)'; tag.style.color = 'var(--teal)';
    } else {
      tag.textContent = 'Unverified';
    }
  } catch (_) { /* trust endpoint is optional — don't block the rest of the tab */ }
}

async function bootstrap() {
  if (!State.token) { showScreen('view-auth-phone'); return; }
  try {
    await loadMe(); // doubles as a token-validity check
    document.getElementById('bottom-nav').style.display = 'flex';
    showTab('discover');
  } catch (e) {
    localStorage.removeItem('roomsetu_token');
    State.token = null;
    showScreen('view-auth-phone');
  }
}

bootstrap();