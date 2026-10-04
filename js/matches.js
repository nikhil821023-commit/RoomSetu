// Incoming requests + all matches + the (still-demo) chat preview.

async function loadMatches() {
  const container = document.getElementById('matches-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const [incoming, mine] = await Promise.all([api('/matches/incoming'), api('/matches/mine')]);

    document.getElementById('incoming-badge').style.display = incoming.length ? 'flex' : 'none';
    document.getElementById('incoming-badge').textContent = incoming.length || '';

    let html = '';
    if (incoming.length) {
      html += `<div class="section-title">Waiting on you</div>`;
      html += incoming.map(m => `
        <div class="req-row">
          <div class="avatar" style="width:44px;height:44px;font-size:15px;border-radius:13px;background:${avatarColor(m.requesterId)}">${m.requesterName.charAt(0)}</div>
          <div class="txt"><b>${escapeHtml(m.requesterName)}</b><div class="sub">${m.compatibilityScore}% compatible</div></div>
          <div class="req-actions">
            <button class="accept" onclick="respondMatch(${m.id}, true)">✓</button>
            <button class="reject" onclick="respondMatch(${m.id}, false)">✕</button>
          </div>
        </div>`).join('');
    }

    html += `<div class="section-title">All matches</div>`;
    if (!mine.length) {
      html += emptyState('No matches yet', 'Send a match request from Discover to get started.');
    } else {
      html += mine.map(m => {
        const otherName = String(m.requesterId) === State.userId ? m.targetName : m.requesterName;
        const otherId = String(m.requesterId) === State.userId ? m.targetId : m.requesterId;
        const statusLabel = m.status === 'ACCEPTED' ? 'Matched' : m.status === 'PENDING' ? 'Pending' : 'Not matched';
        return `
        <div class="req-row" ${m.status === 'ACCEPTED' ? `onclick="openConversation(${otherId}, '${escapeHtml(otherName)}', 'matches')" style="cursor:pointer;"` : ''}>
          <div class="avatar" style="width:44px;height:44px;font-size:15px;border-radius:13px;background:${avatarColor(otherId)}">${otherName.charAt(0)}</div>
          <div class="txt"><b>${escapeHtml(otherName)}</b><div class="sub">${statusLabel} · ${m.compatibilityScore}%</div></div>
        </div>`;
      }).join('');
    }

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = emptyState('Couldn\'t load matches', e.message);
  }
}

async function respondMatch(matchId, accept) {
  try {
    await api(`/matches/${matchId}/${accept ? 'accept' : 'reject'}`, { method: 'POST' });
    toast(accept ? 'Match accepted!' : 'Request declined', accept ? 'success' : '');
    loadMatches();
  } catch (e) {
    toast(e.message, 'error');
  }
}


