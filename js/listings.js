// Listing browse (seeker), listing detail + inquiry, and host's create/manage flows.
// Mirrors discover.js's structure exactly — same sheet pattern, same api() helper.


let createListingPhotoUrls = [];
let discoverMode = 'people'; // 'people' | 'listings' — toggled by the sub-nav pills
let listingsCache = [];
let selectedNearbyCoords = null;

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
    <div style="padding:0 22px 16px;">
      <div class="field" style="margin-bottom:0;">
        <label>Search near a location (optional)</label>
        <div style="display:flex; gap:8px;">
          <div class="autocomplete-wrap" style="flex:1;">
            <input type="text" id="nearby-search-input" placeholder="Start typing an area, landmark, or office...">
            <div class="autocomplete-dropdown" id="nearby-autocomplete-dropdown"></div>
          </div>
          <button class="btn-primary" style="width:auto; padding:0 18px;" id="nearby-search-btn" disabled>Go</button>
        </div>
      </div>
    </div>
    <div id="nearby-results">
      <div class="loading-screen"><div class="spinner"></div><p>Loading listings...</p></div>
    </div>
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

  // Default view on load: listings matching the seeker's own saved profile
  // locality — this is what actually fills #nearby-results the first time.
  try {
    const profile = await api('/profile/me');
    const results = await api('/listings/public/browse?locality=' + encodeURIComponent(profile.locality));
    listingsCache = results;
    renderListingResults(results, 'No listings in your locality yet', 'Try searching a different area above, or check back later.');
  } catch (e) {
    document.getElementById('nearby-results').innerHTML = emptyState('Couldn\'t load listings', e.message);
  }
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
    catch (e) { toast('Could not load that listing', 'error'); return; }
  }

  api(`/listings/${listingId}/view`, { method: 'POST' }).catch(() => {});

  const body = document.getElementById('sheet-body');
  body.innerHTML = `
    ${l.photoUrls && l.photoUrls.length ? `
      <div class="listing-photo-gallery">
        ${l.photoUrls.map(url => `<img src="${url}">`).join('')}
      </div>
    ` : ''}
    <div class="pd-hero" style="padding-bottom:6px;">
      <div class="lc-rent" style="font-size:28px;">₹${l.rent}<span style="font-size:14px;"> /month</span></div>
      <div style="font-size:13px;color:var(--ink-soft);margin-top:6px;">📍 ${escapeHtml(l.locality)}</div>
      <div style="font-size:12.5px;color:var(--ink-soft);margin-top:2px;">${escapeHtml(l.address)}</div>
    </div>
    <div class="mc-tags" style="padding:10px 0 16px;">
      <span class="tag">${l.leaseType === 'PG' ? 'PG' : 'Flat share'}</span>
      <span class="tag">Available ${l.availableFrom}</span>
      <span class="tag">Hosted by ${escapeHtml(l.hostName)}</span>
    </div>
    <div class="field">
      <label>Message to host (optional)</label>
      <textarea id="inquiry-message" rows="3" placeholder="Hi, is this still available?" style="width:100%; border:1.5px solid var(--line); border-radius:12px; padding:13px 15px; font-family:inherit; font-size:14px; resize:vertical;"></textarea>
    </div>
    <div class="pd-cta">
      <button class="btn-ghost" onclick="closeSheet()" style="flex:0 0 auto;">Close</button>
      <button class="btn-primary" id="inquire-btn" onclick="sendInquiry(${listingId})">Send inquiry →</button>
    </div>
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
    setTimeout(() => openConversation(inquiry.hostId, inquiry.hostName, 'discover'), 320);
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
    const statusClass = { PENDING: 'pending', VERIFIED: 'verified', FLAGGED: 'flagged', REJECTED: 'flagged' };
    container.innerHTML = results.map(l => `
      <div class="lc-my-row">
        <div class="txt">
          <b>₹${l.rent}/mo · ${escapeHtml(l.locality)}</b>
          <div class="sub">${l.leaseType === 'PG' ? 'PG' : 'Flat share'} · Available ${l.availableFrom}</div>
        </div>
        <span class="status-pill ${statusClass[l.verificationStatus] || 'pending'}">${l.verificationStatus}</span>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = emptyState('Couldn\'t load listings', e.message);
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



async function openInquiries() {
  showScreen('view-inquiries');
  const container = document.getElementById('inquiries-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const results = await api('/listings/mine/inquiries');
    if (!results.length) {
      container.innerHTML = emptyState('No inquiries yet', 'When someone messages about your listing, it\'ll show up here.');
      return;
    }
    container.innerHTML = results.map(i => `
      <div class="req-row">
        <div class="avatar" style="width:44px;height:44px;font-size:15px;border-radius:13px;background:${avatarColor(i.inquirerId)}">${i.inquirerName.charAt(0)}</div>
        <div class="txt">
          <b>${escapeHtml(i.inquirerName)}</b>
          <div class="sub">${i.message ? escapeHtml(i.message) : 'No message'} · ${new Date(i.createdAt).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = emptyState('Couldn\'t load inquiries', e.message);
  }
}