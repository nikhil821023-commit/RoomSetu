// Listings tab: distance from your saved location (or a place you search for),
// with filters, sorting and "load more" paging.

const searchUi = {
  mine: null,          // saved location { lat, lng, label }, or null
  point: null,         // where distances are measured from right now
  budgetMax: null,
  locality: '',
  radiusKm: 25,        // 0 means any distance
  sort: 'distance',
  filters: { minRent: '', maxRent: '', leaseType: '', availableBy: '', features: new Set() },
  panelOpen: false,
  page: 0, items: [], total: 0, hasMore: false,
};
let searchPicked = null;
const SEARCH_PAGE_SIZE = 10;

async function loadListings() {
  const container = document.getElementById('discover-list');
  container.innerHTML = `
    <div style="padding:0 22px 10px;">
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
    <div id="distance-bar" style="padding:0 22px 8px;"></div>
    <div id="filter-bar" style="padding:0 22px 10px;"></div>
    <div id="nearby-results"><div class="loading-screen"><div class="spinner"></div><p>Loading listings...</p></div></div>
    <div id="load-more-wrap" style="padding:0 22px 20px; text-align:center;"></div>
  `;

  searchPicked = null;
  const goBtn = document.getElementById('nearby-search-btn');
  initLocationAutocomplete(
    document.getElementById('nearby-search-input'),
    document.getElementById('nearby-autocomplete-dropdown'),
    (suggestion) => { searchPicked = suggestion; goBtn.disabled = false; }
  );
  goBtn.onclick = () => {
    if (!searchPicked) { toast('Pick a place from the suggestions', 'error'); return; }
    searchUi.point = searchPicked;
    if (searchUi.sort !== 'rent') searchUi.sort = 'distance';
    runSearch(true);
  };

  try {
    const profile = await api('/profile/me');
    searchUi.mine = (profile.latitude != null && profile.longitude != null)
      ? { lat: profile.latitude, lng: profile.longitude, label: profile.locationLabel || 'your saved location' }
      : null;
    searchUi.budgetMax = profile.budgetMax || null;
    // First part only ("Koramangala" from "Koramangala, Bengaluru"), so it matches more forgivingly.
    searchUi.locality = (profile.locality || '').split(',')[0].trim();
    searchUi.point = searchUi.mine;
    searchUi.sort = searchUi.point ? 'distance' : 'newest';
    await runSearch(true);
  } catch (e) {
    document.getElementById('nearby-results').innerHTML = emptyState("Couldn't load listings", e.message);
  }
}

function renderSearchBars() {
  const f = searchUi.filters;

  const bar = document.getElementById('distance-bar');
  if (searchUi.point) {
    const isMine = searchUi.point === searchUi.mine;
    const options = [[5, 'Within 5 km'], [10, 'Within 10 km'], [25, 'Within 25 km'],
                     [50, 'Within 50 km'], [100, 'Within 100 km'], [0, 'Any distance']];
    bar.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
        <div style="font-size:12px; color:var(--ink-soft); line-height:1.4;">
          📍 ${isMine ? 'From' : 'Near'} <b>${escapeHtml(shortLabel(searchUi.point.label))}</b><br>straight-line distance
          ${!isMine && searchUi.mine ? ' · <button class="btn-link" style="padding:0; font-size:12px;" onclick="backToMyLocation()">back to my location</button>' : ''}
        </div>
        <select onchange="changeSearchRadius(this.value)" style="border:1.5px solid var(--line); border-radius:10px; padding:8px 10px; font-size:12.5px; background:var(--paper);">
          ${options.map(([v, label]) => `<option value="${v}" ${v === searchUi.radiusKm ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>`;
  } else {
    bar.innerHTML = `
      <div style="background:var(--mist); border-radius:14px; padding:14px 16px;">
        <b style="font-size:13.5px;">See how far each place is</b>
        <p style="font-size:12.5px; color:var(--ink-soft); margin:4px 0 10px; line-height:1.5;">Add your office or college and every listing will show its distance from you.</p>
        <button class="btn-primary" style="padding:10px;" onclick="openMyDetails()">Add my location →</button>
      </div>`;
  }

  const activeCount = [f.minRent, f.maxRent, f.leaseType, f.availableBy].filter(Boolean).length + f.features.size;
  const sortOption = (value, label, disabled = false) =>
    `<option value="${value}" ${searchUi.sort === value ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${label}</option>`;

  document.getElementById('filter-bar').innerHTML = `
    <div style="display:flex; gap:8px; align-items:center;">
      <button class="sub-pill ${activeCount ? 'on' : ''}" onclick="toggleFilterPanel()">Filters${activeCount ? ' · ' + activeCount : ''} ▾</button>
      <select onchange="changeSort(this.value)" style="border:1.5px solid var(--line); border-radius:10px; padding:8px 10px; font-size:12.5px; background:var(--paper);">
        ${sortOption('distance', 'Nearest first', !searchUi.point)}
        ${sortOption('rent', 'Cheapest first')}
        ${sortOption('newest', 'Newest first')}
      </select>
    </div>
    ${searchUi.panelOpen ? filterPanelHtml() : ''}`;
  if (searchUi.panelOpen) mountFeatureChips(document.getElementById('flt-features'), f.features);
}

function filterPanelHtml() {
  const f = searchUi.filters;
  return `
    <div class="filter-panel">
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1; margin-bottom:12px;"><label>Min rent (₹)</label><input type="number" id="flt-min" value="${f.minRent}" placeholder="0"></div>
        <div class="field" style="flex:1; margin-bottom:12px;"><label>Max rent (₹)</label><input type="number" id="flt-max" value="${f.maxRent}" placeholder="Any"></div>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1; margin-bottom:12px;"><label>Type</label>
          <select id="flt-type">
            <option value="">Any</option>
            <option value="FLAT_SHARE" ${f.leaseType === 'FLAT_SHARE' ? 'selected' : ''}>Flat share</option>
            <option value="PG" ${f.leaseType === 'PG' ? 'selected' : ''}>PG</option>
          </select>
        </div>
        <div class="field" style="flex:1; margin-bottom:12px;"><label>Available by</label><input type="date" id="flt-date" value="${f.availableBy}"></div>
      </div>
      <div class="pd-section-label" style="margin-top:0;">Must have</div>
      <div class="feat-grid" id="flt-features" style="margin-bottom:14px;"></div>
      <div style="display:flex; gap:10px;">
        <button class="btn-ghost" style="flex:1;" onclick="resetFilters()">Reset</button>
        <button class="btn-primary" style="flex:1;" onclick="applyFilters()">Apply</button>
      </div>
    </div>`;
}

function toggleFilterPanel() { searchUi.panelOpen = !searchUi.panelOpen; renderSearchBars(); }

function applyFilters() {
  const f = searchUi.filters;
  f.minRent = document.getElementById('flt-min').value.trim();
  f.maxRent = document.getElementById('flt-max').value.trim();
  f.leaseType = document.getElementById('flt-type').value;
  f.availableBy = document.getElementById('flt-date').value;
  searchUi.panelOpen = false;
  runSearch(true);
}

function resetFilters() {
  searchUi.filters = { minRent: '', maxRent: '', leaseType: '', availableBy: '', features: new Set() };
  searchUi.panelOpen = false;
  runSearch(true);
}

function changeSort(value) { searchUi.sort = value; runSearch(true); }
function changeSearchRadius(value) { searchUi.radiusKm = Number(value); runSearch(true); }
function backToMyLocation() { searchUi.point = searchUi.mine; searchUi.sort = 'distance'; runSearch(true); }
function loadMoreResults() { searchUi.page += 1; runSearch(false); }

async function runSearch(reset) {
  const resultsEl = document.getElementById('nearby-results');
  if (reset) {
    searchUi.page = 0;
    searchUi.items = [];
    resultsEl.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Searching...</p></div>';
    document.getElementById('load-more-wrap').innerHTML = '';
  } else {
    const moreBtn = document.getElementById('load-more-btn');
    if (moreBtn) { moreBtn.disabled = true; moreBtn.textContent = 'Loading...'; }
  }
  renderSearchBars();

  const f = searchUi.filters;
  const params = new URLSearchParams();
  if (searchUi.point) {
    params.set('lat', searchUi.point.lat);
    params.set('lng', searchUi.point.lng);
    if (searchUi.radiusKm > 0) params.set('radiusKm', searchUi.radiusKm);
  } else if (searchUi.locality) {
    params.set('locality', searchUi.locality);
  }
  if (f.minRent) params.set('minRent', f.minRent);
  if (f.maxRent) params.set('maxRent', f.maxRent);
  if (f.leaseType) params.set('leaseType', f.leaseType);
  if (f.availableBy) params.set('availableBy', f.availableBy);
  if (f.features.size) params.set('features', [...f.features].join(','));
  params.set('sort', searchUi.sort === 'distance' && !searchUi.point ? 'newest' : searchUi.sort);
  params.set('page', searchUi.page);
  params.set('size', SEARCH_PAGE_SIZE);

  try {
    const res = await api('/listings/public/search?' + params.toString());
    searchUi.items = reset ? res.items : searchUi.items.concat(res.items);
    searchUi.total = res.total;
    searchUi.hasMore = res.hasMore;
    listingsCache = searchUi.items;
    renderSearchResults();
  } catch (e) {
    resultsEl.innerHTML = emptyState('Search failed', e.message);
  }
}

function listingCardHtml(l) {
  const withinBudget = searchUi.budgetMax && l.rent <= searchUi.budgetMax;
  const features = l.features || [];
  const shown = features.slice(0, 3).map(f => `<span class="tag">✓ ${escapeHtml(FEATURE_LABELS[f] || f)}</span>`).join('');
  const more = features.length > 3 ? `<span class="tag">+${features.length - 3} more</span>` : '';
  return `
    <div class="listing-card" onclick="openListing(${l.id})">
      ${l.photoUrls && l.photoUrls.length ? `<img src="${l.photoUrls[0]}" class="lc-photo">` : ''}
      <div class="lc-top">
        <div class="lc-rent">₹${l.rent}<span> /month</span></div>
        <div class="lc-loc">📍 ${escapeHtml(l.locality)}${l.distanceKm != null ? ` · <b>${l.distanceKm} km away</b>` : ''}</div>
      </div>
      <div class="lc-tags">
        <span class="tag">${l.leaseType === 'PG' ? 'PG' : 'Flat share'}</span>
        <span class="tag">Available ${l.availableFrom}</span>
        ${withinBudget ? '<span class="tag" style="background:var(--teal-soft); color:var(--teal);">Within budget</span>' : ''}
        ${shown}${more}
      </div>
    </div>`;
}

function renderSearchResults() {
  const resultsEl = document.getElementById('nearby-results');
  const moreWrap = document.getElementById('load-more-wrap');

  if (!searchUi.items.length) {
    resultsEl.innerHTML = emptyState('No places match',
      searchUi.point
        ? "Try a wider distance or fewer filters. Listings without a map pin can't be placed by distance."
        : 'Try fewer filters, or add your location to search by distance.');
    moreWrap.innerHTML = '';
    return;
  }

  resultsEl.innerHTML =
    `<div style="padding:0 22px 8px; font-size:12px; color:var(--ink-soft);">${searchUi.total} place${searchUi.total === 1 ? '' : 's'}</div>`
    + searchUi.items.map(listingCardHtml).join('');
  moreWrap.innerHTML = searchUi.hasMore
    ? '<button class="btn-ghost" id="load-more-btn" onclick="loadMoreResults()">Load more</button>'
    : '';
}