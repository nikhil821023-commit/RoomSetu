// Listing browse (seeker), listing detail + inquiry, and host's create/manage flows.
// Mirrors discover.js's structure exactly — same sheet pattern, same api() helper.


let createListingPhotoUrls = [];
let discoverMode = 'people'; // 'people' | 'listings' — toggled by the sub-nav pills
let listingsCache = [];
let selectedNearbyCoords = null;
const browseState = { radiusKm: 25, mine: null };

function switchDiscoverMode(mode) {
  discoverMode = mode;
  document.getElementById('pill-people').classList.toggle('on', mode === 'people');
  document.getElementById('pill-listings').classList.toggle('on', mode === 'listings');
  if (mode === 'people') loadDiscover();
  else loadListings();
}



async function loadListings() {
  const container = document.getElementById('discover-list');
  container.innerHTML = `
    <div style="padding:0 22px 12px;">
      <div class="field" style="margin-bottom:0;">
        <label>Search near another place (optional)</label>
        <div style="display:flex; gap:8px;">
          <div class="autocomplete-wrap" style="flex:1;">
            <input type="text" id="nearby-search-input" placeholder="Area, landmark or office...">
            <div class="autocomplete-dropdown" id="nearby-autocomplete-dropdown"></div>
          </div>
          <button class="btn-primary" style="width:auto; padding:0 18px;" id="nearby-search-btn" disabled>Go</button>
        </div>
      </div>
    </div>
    <div id="distance-bar" style="padding:0 22px 12px;"></div>
    <div id="nearby-results"><div class="loading-screen"><div class="spinner"></div><p>Loading listings...</p></div></div>
  `;

  selectedNearbyCoords = null;
  initLocationAutocomplete(
    document.getElementById('nearby-search-input'),
    document.getElementById('nearby-autocomplete-dropdown'),
    (suggestion) => {
      selectedNearbyCoords = suggestion;
      document.getElementById('nearby-search-btn').disabled = false;
    }
  );
  document.getElementById('nearby-search-btn').onclick = () => searchNearbyByCoords(selectedNearbyCoords);

  try {
    const profile = await api('/profile/me');
    browseState.mine = (profile.latitude != null && profile.longitude != null)
      ? { lat: profile.latitude, lng: profile.longitude, label: profile.locationLabel || 'your saved location' }
      : null;

    if (browseState.mine) {
      await loadListingsFromMyLocation();
    } else {
      // No saved location yet: show listings in the profile's locality and nudge them to add one.
      document.getElementById('distance-bar').innerHTML = `
        <div style="background:var(--mist); border-radius:14px; padding:14px 16px;">
          <b style="font-size:13.5px;">See how far each place is</b>
          <p style="font-size:12.5px; color:var(--ink-soft); margin:4px 0 10px; line-height:1.5;">Add your office or college and every listing will show its distance from you.</p>
          <button class="btn-primary" style="padding:10px;" onclick="openMyDetails()">Add my location →</button>
        </div>`;
      const results = await api('/listings/public/browse?locality=' + encodeURIComponent(profile.locality));
      listingsCache = results;
      renderListingResults(results, 'No listings in your area yet', 'Try searching another place above, or check back later.');
    }
  } catch (e) {
    document.getElementById('nearby-results').innerHTML = emptyState("Couldn't load listings", e.message);
  }
}

function setDistanceBarForMine() {
  const m = browseState.mine;
  const options = [[5, 'Within 5 km'], [10, 'Within 10 km'], [25, 'Within 25 km'],
                   [50, 'Within 50 km'], [100, 'Within 100 km'], [20000, 'Any distance']];
  document.getElementById('distance-bar').innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <div style="font-size:12px; color:var(--ink-soft); line-height:1.4;">📍 From <b>${escapeHtml(shortLabel(m.label))}</b><br>straight-line distance</div>
      <select onchange="changeRadius(this.value)" style="border:1.5px solid var(--line); border-radius:10px; padding:8px 10px; font-size:12.5px; background:var(--paper);">
        ${options.map(([v, label]) => `<option value="${v}" ${v === browseState.radiusKm ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
    </div>`;
}

async function loadListingsFromMyLocation() {
  const m = browseState.mine;
  setDistanceBarForMine();
  const resultsEl = document.getElementById('nearby-results');
  resultsEl.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading listings...</p></div>';
  try {
    const results = await api(`/listings/public/nearby?lat=${m.lat}&lng=${m.lng}&radiusKm=${browseState.radiusKm}`);
    listingsCache = results;
    renderListingResults(results, 'No listings in range',
      "Try a wider distance. Listings without a map pin can't be placed, so they don't show here.");
  } catch (e) {
    resultsEl.innerHTML = emptyState("Couldn't load listings", e.message);
  }
}

function changeRadius(value) {
  browseState.radiusKm = Number(value);
  loadListingsFromMyLocation();
}

function renderListingResults(results, emptyTitle, emptyBody) {
  const resultsEl = document.getElementById('nearby-results');
  if (!results.length) {
    resultsEl.innerHTML = emptyState(emptyTitle, emptyBody);
    return;
  }
  resultsEl.innerHTML = results.map(l => `
    <div class="listing-card" onclick="openListing(${l.id})">
      ${l.photoUrls && l.photoUrls.length ? `<img src="${l.photoUrls[0]}" class="lc-photo">` : ''}
      <div class="lc-top">
        <div class="lc-rent">₹${l.rent}<span> /month</span></div>
        <div class="lc-loc">📍 ${escapeHtml(l.locality)}${l.distanceKm != null ? ` · <b>${l.distanceKm} km away</b>` : ''}</div>
      </div>
      <div class="lc-tags">
        <span class="tag">${l.leaseType === 'PG' ? 'PG' : 'Flat share'}</span>
        <span class="tag">Available ${l.availableFrom}</span>
      </div>
    </div>
  `).join('');
}

async function searchNearbyByCoords(coords) {
  if (!coords) { toast('Pick a place from the suggestions', 'error'); return; }

  document.getElementById('distance-bar').innerHTML = `
    <div style="font-size:12px; color:var(--ink-soft);">📍 Near <b>${escapeHtml(shortLabel(coords.label))}</b>
      ${browseState.mine ? ' · <button class="btn-link" style="padding:0; font-size:12px;" onclick="loadListingsFromMyLocation()">Back to my location</button>' : ''}
    </div>`;

  const resultsEl = document.getElementById('nearby-results');
  resultsEl.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading nearby listings...</p></div>';
  try {
    const results = await api(`/listings/public/nearby?lat=${coords.lat}&lng=${coords.lng}&radiusKm=${browseState.radiusKm}`);
    listingsCache = results;
    renderListingResults(results, 'No listings in range', 'Try a broader area.');
  } catch (e) {
    resultsEl.innerHTML = emptyState('Search failed', e.message);
  }
}





async function searchNearbyByCoords(coords) {
  if (!coords) { toast('Pick a location from the suggestions', 'error'); return; }

  const resultsEl = document.getElementById('nearby-results');
  resultsEl.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading nearby listings...</p></div>';

  try {
    const results = await api(`/listings/public/nearby?lat=${coords.lat}&lng=${coords.lng}&radiusKm=15`);
    listingsCache = results;
    renderListingResults(results, 'No listings within 15km', 'Try a broader area, or note: listings created without a working map connection won\'t appear here.');
  } catch (e) {
    resultsEl.innerHTML = emptyState('Search failed', e.message);
  }
}

async function openListing(listingId) {
  let l = listingsCache.find(x => x.id === listingId);
  if (!l) {
    try { l = await api('/listings/public/' + listingId); }
    catch (e) { toast(e.message || 'Could not load that listing', 'error'); return; }
  }

  const isMine = String(l.hostId) === State.userId;
  if (!isMine) api(`/listings/${listingId}/view`, { method: 'POST' }).catch(() => {});

  let actions;
  if (isMine) {
    actions = `<p style="font-size:12.5px; color:var(--ink-soft); text-align:center; margin:6px 0 14px;">This is your listing, as seekers see it.</p>
       <div class="pd-cta"><button class="btn-ghost" onclick="closeSheet()" style="width:100%;">Close</button></div>`;
  } else if (l.filled) {
    actions = `<p style="font-size:13px; color:var(--ink-soft); text-align:center; margin:6px 0 14px;">This place has been rented out.</p>
       <div class="pd-cta"><button class="btn-ghost" onclick="closeSheet()" style="width:100%;">Close</button></div>`;
  } else {
    actions = `<div class="field">
         <label>Message to host (optional)</label>
         <textarea id="inquiry-message" rows="3" placeholder="Hi, is this still available?" style="width:100%; border:1.5px solid var(--line); border-radius:12px; padding:13px 15px; font-family:inherit; font-size:14px; resize:vertical;"></textarea>
       </div>
       <div class="pd-cta">
         <button class="btn-ghost" onclick="closeSheet()" style="flex:0 0 auto;">Close</button>
         <button class="btn-primary" id="inquire-btn" onclick="sendInquiry(${listingId})">Send inquiry →</button>
       </div>
       <button class="btn-link" style="width:100%; color:var(--coral);" onclick="openReportForm('LISTING', ${l.id}, 'this listing')">Report this listing</button>`;
  }

  document.getElementById('sheet-body').innerHTML = `
    ${l.photoUrls && l.photoUrls.length ? `
      <div class="listing-photo-gallery">${l.photoUrls.map(url => `<img src="${url}">`).join('')}</div>` : ''}
    <div class="pd-hero" style="padding-bottom:6px;">
      <div class="lc-rent" style="font-size:28px;">₹${l.rent}<span style="font-size:14px;"> /month</span></div>
      <div style="font-size:13px; color:var(--ink-soft); margin-top:6px;">📍 ${escapeHtml(l.locality)}</div>
      <div style="font-size:12.5px; color:var(--ink-soft); margin-top:2px;">${escapeHtml(l.address)}</div>
    </div>
    <div class="mc-tags" style="padding:10px 0 16px;">
      <span class="tag">${l.leaseType === 'PG' ? 'PG' : 'Flat share'}</span>
      <span class="tag">Available ${l.availableFrom}</span>
      ${l.distanceKm != null ? `<span class="tag">${l.distanceKm} km away</span>` : ''}
      <span class="tag" style="cursor:pointer;" onclick="openPublicProfile(${l.hostId})">Hosted by ${escapeHtml(l.hostName)} ›</span>
    </div>
    ${l.description ? `<p style="font-size:13.5px; line-height:1.6; margin:0 0 16px;">${escapeHtml(l.description)}</p>` : ''}
    ${featureTagsHtml(l.features)}
    ${actions}
  `;
  document.getElementById('sheet-overlay').classList.add('active');
  requestAnimationFrame(() => document.getElementById('sheet').classList.add('open'));
}



async function sendInquiry(listingId) {
  const message = document.getElementById('inquiry-message').value.trim();
  const btn = document.getElementById('inquire-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    const inquiry = await api(`/listings/${listingId}/inquire`, { method: 'POST', body: { message } });
    toast('Inquiry sent!', 'success');
    closeSheet();
    const first = message || "Hi! I'm interested in your listing.";
    setTimeout(() => openConversation(inquiry.hostId, inquiry.hostName, 'discover', first), 320);
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.innerHTML = 'Send inquiry →';
  }
}


/* ---------------- HOST: my listings + create ---------------- */

async function loadMyListings() {
  const container = document.getElementById('my-listings-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const results = await api('/listings/mine');
    if (!results.length) {
      container.innerHTML = emptyState('No listings yet', 'Tap "Add a listing" below to list your first room.');
      return;
    }
    const pill = {
      VERIFIED: ['verified', 'Live'],
      FLAGGED: ['flagged', 'Hidden'],
      REJECTED: ['flagged', 'Removed'],
      PENDING: ['pending', 'Pending'],
    };
    container.innerHTML = results.map(l => {
      const [cls, label] = pill[l.verificationStatus] || ['pending', l.verificationStatus];
      return `
        <div class="lc-my-row">
          <div class="txt">
            <b>₹${l.rent}/mo · ${escapeHtml(l.locality)}</b>
            <div class="sub">${l.leaseType === 'PG' ? 'PG' : 'Flat share'} · Available ${l.availableFrom}</div>
          </div>
          <span class="status-pill ${cls}">${label}</span>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = emptyState("Couldn't load listings", e.message);
  }
}

function openCreateListingScreen() {
  createListingPhotoUrls = [];
  createListingCoords = null;
  showScreen('view-create-listing');
  initPhotoGrid(document.getElementById('cl-photo-grid'), createListingPhotoUrls);

  initLocationAutocomplete(
    document.getElementById('cl-address'),
    document.getElementById('cl-address-dropdown'),
    (suggestion) => { createListingCoords = suggestion; }
  );
}

async function createListing() {
  const locality = document.getElementById('cl-locality').value.trim();
  const address = document.getElementById('cl-address').value.trim();
  const rent = parseInt(document.getElementById('cl-rent').value, 10);
  const leaseType = document.getElementById('cl-lease-type').value;
  const availableFrom = document.getElementById('cl-available-from').value;
  const description = document.getElementById('cl-description').value.trim();

  if (!locality || !address || !rent || !availableFrom) {
    toast('Fill in locality, address, rent, and availability date', 'error');
    return;
  }

  const btn = document.getElementById('create-listing-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api('/listings', {
      method: 'POST',
      body: {
        locality, address, rent, leaseType, availableFrom, description,
        photoUrls: createListingPhotoUrls,
        latitude: createListingCoords ? createListingCoords.lat : null,
        longitude: createListingCoords ? createListingCoords.lng : null,
      }
    });
    toast('Listing submitted — pending verification', 'success');
    ['cl-locality','cl-address','cl-rent','cl-available-from','cl-description'].forEach(id => document.getElementById(id).value = '');
    createListingCoords = null;
    showScreen('view-my-listings');
    loadMyListings();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Publish listing →';
  }
}



let inquiriesCache = [];

async function openInquiries() {
  showScreen('view-inquiries');
  const container = document.getElementById('inquiries-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const results = await api('/listings/mine/inquiries');
    inquiriesCache = results;
    if (!results.length) {
      container.innerHTML = emptyState('No inquiries yet', "When someone messages about your listing, it'll show up here.");
      return;
    }
    container.innerHTML = results.map((i, idx) => `
      <div class="req-row">
        <div class="avatar" style="width:44px;height:44px;font-size:15px;border-radius:13px;background:${avatarColor(i.inquirerId)};cursor:pointer;" onclick="openPublicProfile(${i.inquirerId})">${escapeHtml(i.inquirerName.charAt(0))}</div>
        <div class="txt" style="cursor:pointer;" onclick="openPublicProfile(${i.inquirerId})">
          <b>${escapeHtml(i.inquirerName)}</b>
          <div class="sub">${i.message ? escapeHtml(i.message) : 'No message'} · ${new Date(i.createdAt).toLocaleDateString()}</div>
        </div>
        <button class="sub-pill on" onclick="replyToInquirer(${idx})">Reply</button>
      </div>`).join('');
  } catch (e) {
    container.innerHTML = emptyState("Couldn't load inquiries", e.message);
  }
}

function replyToInquirer(idx) {
  const i = inquiriesCache[idx];
  if (i) openConversation(i.inquirerId, i.inquirerName, 'me');
}
