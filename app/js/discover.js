let peopleRadiusKm = 10;

async function loadDiscover() {
  const container = document.getElementById('discover-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading matches...</p></div>';
  try {
    const profile = await api('/profile/me');
    const hasPin = profile.latitude != null && profile.longitude != null;
    const results = await api('/discover?radiusKm=' + peopleRadiusKm);
    State.discoverCache = results;

    const header = hasPin ? `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px;">
        <div style="font-size:12px; color:var(--ink-soft); line-height:1.4;">📍 People near <b>${escapeHtml(shortLabel(profile.locationLabel || 'your location'))}</b></div>
        <select onchange="changePeopleRadius(this.value)" style="border:1.5px solid var(--line); border-radius:10px; padding:8px 10px; font-size:12.5px; background:var(--paper);">
          ${[5, 10, 25, 50].map(km => `<option value="${km}" ${km === peopleRadiusKm ? 'selected' : ''}>Within ${km} km</option>`).join('')}
        </select>
      </div>` : `
      <div style="background:var(--mist); border-radius:14px; padding:14px 16px; margin-bottom:12px;">
        <b style="font-size:13.5px;">Match with people nearby</b>
        <p style="font-size:12.5px; color:var(--ink-soft); margin:4px 0 10px; line-height:1.5;">Add the area you want to live near. You'll see people within a few km, even if they named their locality differently.</p>
        <button class="btn-primary" style="padding:10px;" onclick="openMyDetails()">Add my location →</button>
      </div>`;

    if (!results.length) {
      container.innerHTML = header + emptyState('No matches nearby yet',
        hasPin ? `No one within ${peopleRadiusKm} km yet. Try a wider distance, or check back as more people join.`
               : "Once more people in your locality complete their profile, they'll show up here.");
      return;
    }

    container.innerHTML = header + results.map(p => `
      <div class="match-card" onclick="openProfile(${p.userId})">
        <div class="mc-top">
          <div class="avatar" style="background:${avatarColor(p.userId)}">${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">` : escapeHtml(p.name.charAt(0))}${p.workEmailDomain ? '<span class="vbadge">✓</span>' : ''}</div>
          <div>
            <div class="mc-name-row"><b>${escapeHtml(p.name)}</b></div>
            <div class="mc-loc">📍 ${escapeHtml(p.locality || '')}${p.distanceLabel ? ' · ' + p.distanceLabel + ' away' : ''}</div>
          </div>
          <div class="ring">${ringSvg(p.compatibilityScore)}<div class="pct">${p.compatibilityScore}%</div></div>
        </div>
        ${p.bio ? `<div class="mc-quote">"${escapeHtml(p.bio)}"</div>` : ''}
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = emptyState("Couldn't load matches", e.message);
  }
}

function changePeopleRadius(value) {
  peopleRadiusKm = Number(value);
  loadDiscover();
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
      ${p.distanceLabel ? `<div style="font-size:12px; color:var(--ink-soft);">${p.distanceLabel} away</div>` : ''}
      ${p.workEmailDomain
        ? `<div class="verified-strip">✓ Email verified · @${escapeHtml(p.workEmailDomain)}</div>`
        : `<div class="verified-strip" style="background:var(--mist);color:var(--ink-soft);">Work/college email not verified</div>`}
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
      <button class="btn-link" style="width:100%;" onclick="openPublicProfile(${p.userId})">View full profile & reviews →</button>
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