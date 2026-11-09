// Accepted-match households → expense balance + shared checklist.

async function loadHouseholds() {
  const container = document.getElementById('household-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const mine = await api('/matches/mine');
    const accepted = mine.filter(m => m.status === 'ACCEPTED');

    if (!accepted.length) {
      container.innerHTML = emptyState('No active household yet', 'Once a match is accepted, your shared move-in tools show up here.');
      return;
    }

    container.innerHTML = accepted.map(m => {
      const otherName = String(m.requesterId) === State.userId ? m.targetName : m.requesterName;
      const otherId = String(m.requesterId) === State.userId ? m.targetId : m.requesterId;
      return `
        <div class="household-row" onclick="openHousehold(${m.id}, '${escapeHtml(otherName)}')">
          <div class="avatar" style="width:48px;height:48px;font-size:17px;border-radius:14px;background:${avatarColor(otherId)}">${otherName.charAt(0)}</div>
          <div class="txt"><b>${escapeHtml(otherName)}</b><div style="font-size:12px;color:var(--ink-soft);">Tap for checklist & expenses</div></div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = emptyState('Couldn\'t load households', e.message);
  }
}

async function openHousehold(matchId, partnerName) {
  State.currentHouseholdMatchId = matchId;
  document.getElementById('household-partner-name').textContent = partnerName;
  showScreen('view-household');

  const balanceCard = document.getElementById('expense-balance-card');
  balanceCard.innerHTML = `<h3>Expense balance</h3><p class="sub">Loading...</p>`;
  try {
    const balance = await api(`/household/${matchId}/expenses/balance`);
    if (balance.owesAmount === 0) {
      balanceCard.innerHTML = `<h3>Expense balance</h3><p class="sub">All settled up — ₹${balance.totalSpent} tracked total.</p>`;
    } else {
      balanceCard.innerHTML = `
        <h3>Expense balance</h3>
        <p class="sub">₹${balance.totalSpent} tracked total</p>
        <div class="split-bar"><div class="a" style="width:50%"></div><div class="b" style="width:50%"></div></div>
        <div class="split-legend"><span><b>${escapeHtml(balance.owesUserName)}</b> owes</span><span><b>${escapeHtml(balance.owedToUserName)}</b> ₹${balance.owesAmount}</span></div>
      `;
    }
  } catch (e) {
    balanceCard.innerHTML = `<h3>Expense balance</h3><p class="sub">${escapeHtml(e.message)}</p>`;
  }

  loadChecklist(matchId);
}

async function loadChecklist(matchId) {
  const container = document.getElementById('household-checklist');
  container.innerHTML = '<p style="font-size:12.5px;color:var(--ink-soft);">Loading...</p>';
  try {
    const items = await api(`/household/${matchId}/checklist`);
    if (!items.length) {
      container.innerHTML = '<p style="font-size:12.5px;color:var(--ink-soft);">No tasks yet — add one below.</p>';
      return;
    }
    container.innerHTML = items.map(item => `
      <div class="check-item ${item.done ? 'done' : ''}" onclick="toggleChecklistItem(${item.id})">
        <div class="checkbox ${item.done ? 'on' : ''}">${item.done ? '✓' : ''}</div>
        <div class="cl"><b>${escapeHtml(item.title)}</b>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</div>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = `<p style="font-size:12.5px;color:var(--coral);">${escapeHtml(e.message)}</p>`;
  }
}

async function addChecklistItem() {
  const input = document.getElementById('new-checklist-item');
  const title = input.value.trim();
  if (!title || !State.currentHouseholdMatchId) return;
  try {
    await api(`/household/${State.currentHouseholdMatchId}/checklist`, { method: 'POST', body: { title } });
    input.value = '';
    loadChecklist(State.currentHouseholdMatchId);
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function toggleChecklistItem(itemId) {
  try {
    await api(`/household/${State.currentHouseholdMatchId}/checklist/${itemId}/toggle`, { method: 'POST' });
    loadChecklist(State.currentHouseholdMatchId);
  } catch (e) {
    toast(e.message, 'error');
  }
}