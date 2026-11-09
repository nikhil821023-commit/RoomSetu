// Work/college email verification. No admin step: the badge is granted
// automatically when the emailed code matches.

async function openVerificationScreen() {
  showScreen('view-verification');
  document.getElementById('email-code-section').style.display = 'none';
  document.getElementById('work-email').value = '';
  document.getElementById('email-code').value = '';
  await refreshVerificationStatusBox();
}

async function refreshVerificationStatusBox() {
  const box = document.getElementById('verification-status-box');
  box.innerHTML = '<p style="font-size:12.5px;color:var(--ink-soft);">Checking status...</p>';
  try {
    const p = await api('/public-profile/' + State.userId);
    box.innerHTML = p.workEmailDomain
      ? `<div class="verified-strip">✓ Email verified · @${escapeHtml(p.workEmailDomain)}</div>`
      : `<p style="font-size:12.5px;color:var(--ink-soft);">No work or college email verified yet.</p>`;
  } catch (e) {
    box.innerHTML = '';
  }
}

async function requestEmailCode() {
  const email = document.getElementById('work-email').value.trim();
  if (!email) { toast('Enter your work or college email', 'error'); return; }

  const btn = document.getElementById('email-send-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api('/verification/email/request', { method: 'POST', body: { email } });
    toast('Code sent. Check your inbox (or the backend console in dev)', 'success');
    document.getElementById('email-code-section').style.display = 'block';
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Send code →';
  }
}

async function confirmEmailCode() {
  const code = document.getElementById('email-code').value.trim();
  if (!/^\d{6}$/.test(code)) { toast('Enter the 6-digit code', 'error'); return; }

  const btn = document.getElementById('email-confirm-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    const res = await api('/verification/email/confirm', { method: 'POST', body: { code } });
    toast('Verified: @' + res.domain, 'success');
    document.getElementById('email-code-section').style.display = 'none';
    await refreshVerificationStatusBox();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Verify →';
  }
}