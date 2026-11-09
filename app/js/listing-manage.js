// Host controls (publish, edit, mark as rented, delete) and the features catalog.

const LISTING_FEATURES = [
  ['WIFI', 'Wi-Fi'], ['AC', 'Air conditioning'], ['FURNISHED', 'Furnished'],
  ['ATTACHED_BATH', 'Attached bathroom'], ['MEALS_INCLUDED', 'Meals included'], ['KITCHEN', 'Kitchen access'],
  ['WASHING_MACHINE', 'Washing machine'], ['FRIDGE', 'Fridge'], ['GEYSER', 'Hot water'],
  ['POWER_BACKUP', 'Power backup'], ['PARKING', 'Parking'], ['LIFT', 'Lift'],
  ['CCTV', 'CCTV / security'], ['HOUSEKEEPING', 'Housekeeping'], ['WATER_24X7', '24x7 water'], ['BALCONY', 'Balcony'],
];
const FEATURE_LABELS = Object.fromEntries(LISTING_FEATURES);

// Multi-select chips. `selected` is a Set that gets updated in place.
function mountFeatureChips(containerEl, selected) {
  containerEl.innerHTML = LISTING_FEATURES.map(([key, label]) =>
    `<div class="feat-chip ${selected.has(key) ? 'on' : ''}" data-key="${key}">${label}</div>`).join('');
  containerEl.onclick = (e) => {
    const chip = e.target.closest('.feat-chip');
    if (!chip) return;
    const key = chip.dataset.key;
    if (selected.has(key)) selected.delete(key); else selected.add(key);
    chip.classList.toggle('on');
  };
}

function featureTagsHtml(features) {
  if (!features || !features.length) return '';
  return `
    <div class="pd-section-label" style="margin-top:0;">What's included</div>
    <div class="mc-tags" style="padding:0 0 14px;">
      ${features.map(f => `<span class="tag">✓ ${escapeHtml(FEATURE_LABELS[f] || f)}</span>`).join('')}
    </div>`;
}

let editingListingId = null;
let listingFormWired = false;
const createFeatureSet = new Set();
let myListingsCache = [];

function updatePinStatus() {
  const el = document.getElementById('cl-pin-status');
  el.style.color = createListingCoords ? 'var(--teal)' : 'var(--coral)';
  el.textContent = createListingCoords
    ? '📍 Map pin set'
    : 'No map pin yet. Pick a suggestion so seekers can find this by distance';
}

function openCreateListingScreen() { openListingForm(null); }

function openEditListing(listingId) {
  const l = myListingsCache.find(x => x.id === listingId);
  if (l) openListingForm(l);
}

function openListingForm(listing) {
  editingListingId = listing ? listing.id : null;
  createListingPhotoUrls = listing ? [...(listing.photoUrls || [])] : [];
  createListingCoords = (listing && listing.latitude != null && listing.longitude != null)
    ? { lat: listing.latitude, lng: listing.longitude, label: listing.address }
    : null;

  showScreen('view-create-listing');
  document.getElementById('cl-title').textContent = listing ? 'Edit listing' : 'New Listing';
  document.getElementById('create-listing-btn').textContent = listing ? 'Save changes' : 'Publish listing →';

  document.getElementById('cl-locality').value = listing ? listing.locality : '';
  document.getElementById('cl-address').value = listing ? listing.address : '';
  document.getElementById('cl-rent').value = listing ? listing.rent : '';
  document.getElementById('cl-lease-type').value = listing ? listing.leaseType : 'FLAT_SHARE';
  document.getElementById('cl-available-from').value = listing ? listing.availableFrom : '';
  document.getElementById('cl-description').value = listing ? (listing.description || '') : '';

  createFeatureSet.clear();
  (listing && listing.features ? listing.features : []).forEach(f => createFeatureSet.add(f));
  mountFeatureChips(document.getElementById('cl-features'), createFeatureSet);

  initPhotoGrid(document.getElementById('cl-photo-grid'), createListingPhotoUrls);

  // Wire the address suggestions once. Doing it on every open would stack listeners.
  if (!listingFormWired) {
    listingFormWired = true;
    initLocationAutocomplete(
      document.getElementById('cl-address'),
      document.getElementById('cl-address-dropdown'),
      (suggestion) => { createListingCoords = suggestion; updatePinStatus(); }
    );
  }
  updatePinStatus();
}

async function submitListingForm() {
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

  const body = {
    locality, address, rent, leaseType, availableFrom, description,
    photoUrls: createListingPhotoUrls,
    features: [...createFeatureSet],
    latitude: createListingCoords ? createListingCoords.lat : null,
    longitude: createListingCoords ? createListingCoords.lng : null,
  };

  const btn = document.getElementById('create-listing-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    if (editingListingId) {
      await api('/listings/' + editingListingId, { method: 'PUT', body });
      toast('Listing updated', 'success');
    } else {
      await api('/listings', { method: 'POST', body });
      toast('Listing published!', 'success');
    }
    showScreen('view-my-listings');
    loadMyListings();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = editingListingId ? 'Save changes' : 'Publish listing →';
  }
}

async function loadMyListings() {
  const container = document.getElementById('my-listings-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const results = await api('/listings/mine');
    myListingsCache = results;
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
      const [cls, label] = l.filled ? ['pending', 'Rented'] : (pill[l.verificationStatus] || ['pending', l.verificationStatus]);
      return `
        <div style="padding:14px 22px; border-bottom:1px solid var(--line);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div class="txt">
              <b>₹${l.rent}/mo · ${escapeHtml(l.locality)}</b>
              <div class="sub">${l.leaseType === 'PG' ? 'PG' : 'Flat share'} · Available ${l.availableFrom}</div>
            </div>
            <span class="status-pill ${cls}">${label}</span>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <button class="sub-pill" onclick="openEditListing(${l.id})">Edit</button>
            <button class="sub-pill" onclick="toggleFilled(${l.id}, ${!l.filled})">${l.filled ? 'Reopen' : 'Mark as rented'}</button>
            <button class="sub-pill" style="color:var(--coral);" onclick="deleteMyListing(${l.id})">Delete</button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = emptyState("Couldn't load listings", e.message);
  }
}

async function toggleFilled(listingId, filled) {
  try {
    await api(`/listings/${listingId}/filled?filled=${filled}`, { method: 'POST' });
    toast(filled ? 'Marked as rented. Hidden from search' : 'Live again', 'success');
    loadMyListings();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteMyListing(listingId) {
  if (!confirm("Delete this listing? Seekers will no longer see it. This can't be undone.")) return;
  try {
    await api('/listings/' + listingId, { method: 'DELETE' });
    toast('Listing deleted', 'success');
    loadMyListings();
  } catch (e) {
    toast(e.message, 'error');
  }
}