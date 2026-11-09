// Report, block and unblock. Buttons live on the public profile sheet and the
// listing sheet. The blocked list is under Profile.

const REPORT_REASONS = [
  'Fake or misleading',
  'Asked for money or advance payment',
  'Harassment or inappropriate behaviour',
  'Spam',
  'Other',
];

function openReportForm(targetType, targetId, label) {
  document.getElementById('sheet-body').innerHTML = `
    <h2 style="font-family:'Fraunces',serif;font-size:20px;margin:6px 0 14px;">Report ${escapeHtml(label)}</h2>
    <div class="field">
      <label>What's the problem?</label>
      <select id="report-category">${REPORT_REASONS.map(r => `<option>${r}</option>`).join('')}</select>
    </div>
    <div class="field">
      <label>Details (optional)</label>
      <textarea id="report-details" rows="3" maxlength="300" placeholder="Anything that helps us review this" style="width:100%; border:1.5px solid var(--line); border-radius:12px; padding:13px 15px; font-family:inherit; font-size:14px; resize:vertical;"></textarea>
    </div>
    <div class="pd-cta">
      <button class="btn-ghost" onclick="closeSheet()" style="flex:0 0 auto;">Cancel</button>
      <button class="btn-primary" id="report-submit-btn" onclick="submitReport('${targetType}', ${targetId})">Submit report</button>
    </div>`;
  document.getElementById('sheet-overlay').classList.add('active');
  requestAnimationFrame(() => document.getElementById('sheet').classList.add('open'));
}

async function submitReport(targetType, targetId) {
  const category = document.getElementById('report-category').value;
  const details = document.getElementById('report-details').value.trim();
  const reason = category + (details ? ': ' + details : '');

  const btn = document.getElementById('report-submit-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api('/reports', { method: 'POST', body: { targetType, targetId, reason } });
    toast('Report submitted. Thank you', 'success');
    closeSheet();
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.innerHTML = 'Submit report';
  }
}

function reportPublicProfile() {
  const p = currentPublicProfile;
  if (p) openReportForm('USER', p.userId, p.name);
}

async function blockPublicProfile() {
  const p = currentPublicProfile;
  if (!p) return;
  if (!confirm(`Block ${p.name}? They won't be able to see your profile, match with you, or message you.`)) return;
  try {
    await api('/blocks/' + p.userId, { method: 'POST' });
    toast(p.name + ' is blocked', 'success');
    closeSheet();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function openBlockedList() {
  showScreen('view-blocked');
  const container = document.getElementById('blocked-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const blocked = await api('/blocks');
    if (!blocked.length) {
      container.innerHTML = emptyState('No blocked users', "People you block will show up here so you can unblock them.");
      return;
    }
    container.innerHTML = blocked.map(b => `
      <div class="req-row">
        <div class="avatar" style="width:44px;height:44px;font-size:15px;border-radius:13px;background:${avatarColor(b.userId)}">${escapeHtml(b.name.charAt(0))}</div>
        <div class="txt"><b>${escapeHtml(b.name)}</b></div>
        <button class="sub-pill" onclick="unblockUser(${b.userId})">Unblock</button>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = emptyState("Couldn't load blocked users", e.message);
  }
}

async function unblockUser(userId) {
  try {
    await api('/blocks/' + userId, { method: 'DELETE' });
    toast('Unblocked', 'success');
    openBlockedList();
  } catch (e) {
    toast(e.message, 'error');
  }
}