// Discovery feed + profile detail sheet + sending a match request.

async function loadDiscover() {
  const container = document.getElementById('discover-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading matches...</p></div>';
  try {
    const results = await api('/discover');
    State.discoverCache = results;
    if (!results.length) {
      container.innerHTML = emptyState('No matches nearby yet', 'Once more people in your locality complete their profile, they\'ll show up here.');
      return;
    }
    container.innerHTML = results.map(p => `
      <div class="match-card" onclick="openProfile(${p.userId})">
        <div class="mc-top">
          <div class="avatar" style="background:${avatarColor(p.userId)}">${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">` : p.name.charAt(0)}${p.verificationStatus === 'VERIFIED' ? '<span class="vbadge">✓</span>' : ''}</div>
          <div>
            <div class="mc-name-row"><b>${escapeHtml(p.name)}</b></div>
            <div class="mc-loc">📍 ${escapeHtml(p.locality || '')}</div>
          </div>
          <div class="ring">${ringSvg(p.compatibilityScore)}<div class="pct">${p.compatibilityScore}%</div></div>
        </div>
        ${p.bio ? `<div class="mc-quote">"${escapeHtml(p.bio)}"</div>` : ''}
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = emptyState('Couldn\'t load matches', e.message);
  }
}

async function openProfile(userId) {
  const p = State.discoverCache.find(x => x.userId === userId);
  if (!p) return;

  const body = document.getElementById('sheet-body');
  body.innerHTML = `
    <div class="pd-hero">
      <div class="avatar" style="background:${avatarColor(p.userId)}">${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">` : p.name.charAt(0)}</div>
      <h2>${escapeHtml(p.name)}</h2>
      <div style="font-size:13px;color:var(--ink-soft);">📍 ${escapeHtml(p.locality || '')}</div>
      ${p.verificationStatus === 'VERIFIED'
        ? `<div class="verified-strip">✓ ID Verified</div>`
        : `<div class="verified-strip" style="background:var(--mist);color:var(--ink-soft);">Not yet ID-verified</div>`}
    </div>

    <div class="pd-section-label">Why you matched</div>
    ${Object.entries(p.scoreBreakdown || {}).map(([label, pct]) => `
      <div class="compat-row">
        <div class="label">${escapeHtml(label)}</div>
        <div class="compat-bar"><i style="width:${pct}%"></i></div>
        <div class="pctval">${pct}%</div>
      </div>`).join('')}

    <div id="ai-summary-slot"></div>
    <div id="host-listings-slot"></div>

    <div class="pd-cta">
      <button class="btn-ghost" onclick="closeSheet()" style="flex:0 0 auto;">Skip</button>
      <button class="btn-primary" id="request-match-btn" onclick="requestMatch(${p.userId})">Send match request →</button>
    </div>
  `;
  document.getElementById('sheet-overlay').classList.add('active');
  requestAnimationFrame(() => document.getElementById('sheet').classList.add('open'));

  try {
    const summary = await api('/match-summary/' + p.userId);
    document.getElementById('ai-summary-slot').innerHTML = `
      <div class="ai-summary-box">
        <span class="tag">${summary.aiGenerated ? 'AI summary' : 'Match summary'}</span>
        <div>${escapeHtml(summary.summary)}</div>
      </div>`;
  } catch (_) {}

  try {
    const listings = await api('/listings/public/by-host/' + p.userId);
    if (listings.length) {
      const slot = document.getElementById('host-listings-slot');
      slot.innerHTML = `
        <div class="pd-section-label">Their listing${listings.length > 1 ? 's' : ''}</div>
        ${listings.map(l => `
          <div class="listing-card" style="margin-bottom:12px;" onclick="openListing(${l.id})">
            <div class="lc-top">
              <div class="lc-rent">₹${l.rent}<span> /month</span></div>
              <div class="lc-loc">📍 ${escapeHtml(l.locality)}</div>
            </div>
            <div class="lc-tags">
              <span class="tag">${l.leaseType === 'PG' ? 'PG' : 'Flat share'}</span>
              <span class="tag">Available ${l.availableFrom}</span>
            </div>
          </div>
        `).join('')}
      `;
    }
  } catch (_) {}
}

function closeSheet(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('sheet').classList.remove('open');
  setTimeout(() => document.getElementById('sheet-overlay').classList.remove('active'), 300);
}

async function requestMatch(targetUserId) {
  const btn = document.getElementById('request-match-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api('/matches/request/' + targetUserId, { method: 'POST' });
    toast('Match request sent!', 'success');
    closeSheet();
    setTimeout(() => showTab('matches'), 320);
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.innerHTML = 'Send match request →';
  }
}