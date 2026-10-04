// Admin review queue — only reachable/shown when State.admin is true, but the
// backend's ROLE_ADMIN check on every /admin/* endpoint is the real guard here;
// hiding the link is just UX, not security.

function openAdminReview() {
  showScreen('view-admin');
  loadAdminListings();
  loadAdminVerifications();
}

async function loadAdminListings() {
  const container = document.getElementById('admin-listings-list');
  container.innerHTML = '<p style="padding:0 22px;font-size:12.5px;color:var(--ink-soft);">Loading...</p>';
  try {
    const results = await api('/listings/admin/pending');
    if (!results.length) {
      container.innerHTML = '<p style="padding:0 22px;font-size:12.5px;color:var(--ink-soft);">Nothing pending.</p>';
      return;
    }
    const statusClass = { PENDING: 'pending', FLAGGED: 'flagged' };
    container.innerHTML = results.map(l => `
      <div class="req-row">
        <div class="txt">
          <b>₹${l.rent}/mo · ${escapeHtml(l.locality)}</b>
          <div class="sub">${escapeHtml(l.address)} · ${l.leaseType} · <span class="status-pill ${statusClass[l.verificationStatus] || 'pending'}">${l.verificationStatus}</span></div>
        </div>
        <div class="req-actions">
          <button class="accept" onclick="reviewListing(${l.id}, true)">✓</button>
          <button class="reject" onclick="reviewListing(${l.id}, false)">✕</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<p style="padding:0 22px;font-size:12.5px;color:var(--coral);">${escapeHtml(e.message)}</p>`;
  }
}

async function reviewListing(listingId, approve) {
  try {
    await api(`/listings/admin/${listingId}/review?approve=${approve}`, { method: 'POST' });
    toast(approve ? 'Listing approved' : 'Listing rejected', approve ? 'success' : '');
    loadAdminListings();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function loadAdminVerifications() {
  const container = document.getElementById('admin-verifications-list');
  container.innerHTML = '<p style="padding:0 22px;font-size:12.5px;color:var(--ink-soft);">Loading...</p>';
  try {
    const results = await api('/verification/admin/pending');
    if (!results.length) {
      container.innerHTML = '<p style="padding:0 22px;font-size:12.5px;color:var(--ink-soft);">Nothing pending.</p>';
      return;
    }
    container.innerHTML = results.map(v => `
      <div class="req-row">
        <div class="txt">
          <b>${escapeHtml(v.userName)}</b>
          <div class="sub">${v.docType} · submitted ${new Date(v.submittedAt).toLocaleDateString()}</div>
        </div>
        <div class="req-actions">
          <button class="accept" onclick="reviewVerification(${v.id}, true)">✓</button>
          <button class="reject" onclick="reviewVerification(${v.id}, false)">✕</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<p style="padding:0 22px;font-size:12.5px;color:var(--coral);">${escapeHtml(e.message)}</p>`;
  }
}

async function reviewVerification(id, approve) {
  try {
    const reviewerName = encodeURIComponent(State.name || 'Admin');
    await api(`/verification/admin/${id}/review?approve=${approve}&reviewerName=${reviewerName}`, { method: 'POST' });
    toast(approve ? 'Verification approved' : 'Verification rejected', approve ? 'success' : '');
    loadAdminVerifications();
  } catch (e) {
    toast(e.message, 'error');
  }
}