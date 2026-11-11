// Saved location: an office, college, or the area someone commutes to.
// Private. Stored on the profile and only used to calculate distances.
//
// Two separate things are kept:
//   label = what the person calls the place (free text, e.g. "Techno International New Town")
//   pin   = where it is (coordinates, from a suggestion or the device's GPS)

const obLocationState = { lat: null, lng: null, label: '', pin: '' };
let myDetailsLocation = { lat: null, lng: null, label: '', pin: '' };

function shortLabel(label) {
  return (label || '').split(',').slice(0, 2).join(',').trim();
}

function locationFieldHtml(prefix, initialLabel) {
  return `
    <div class="field">
      <p style="font-size:11.5px; color:var(--ink-soft); margin:8px 0 0; line-height:1.5;">Can't find the exact name? Pick the nearest area, then rename it to whatever you call it. Private: used to match you with people and places nearby. Others only ever see a rough distance band.</p>
      <div class="autocomplete-wrap">
        <input type="text" id="${prefix}-location" value="${escapeHtml(initialLabel || '')}" placeholder="Search a place, e.g. New Town, Kolkata">
        <div class="autocomplete-dropdown" id="${prefix}-location-dropdown"></div>
      </div>
      <div id="${prefix}-location-pin" style="font-size:12px; color:var(--teal); font-weight:600; margin-top:8px;"></div>
      <div style="margin-top:8px;">
        <button type="button" class="sub-pill" id="${prefix}-location-gps">📍 Use my current location</button>
      </div>
      <p style="font-size:11.5px; color:var(--ink-soft); margin:8px 0 0; line-height:1.5;">Can't find the exact name? Pick the nearest area from the suggestions, then rename it to whatever you call it. Private: only used to show distances.</p>
    </div>`;
}

function mountLocationField(prefix, state) {
  const input = document.getElementById(prefix + '-location');
  const dropdown = document.getElementById(prefix + '-location-dropdown');
  const pinEl = document.getElementById(prefix + '-location-pin');
  const gpsBtn = document.getElementById(prefix + '-location-gps');

  const renderPin = () => {
    pinEl.textContent = state.lat == null
      ? ''
      : (state.pin ? '📍 Pinned near: ' + shortLabel(state.pin) : '📍 Location pinned');
  };
  renderPin();

  // Picking a suggestion sets the pin. The text stays editable afterwards.
  initLocationAutocomplete(input, dropdown, (s) => {
    state.lat = s.lat; state.lng = s.lng; state.pin = s.label;
    state.label = input.value;
    renderPin();
  });

  // Typing only changes the label. Emptying the box removes the whole location.
  input.addEventListener('input', () => {
    state.label = input.value;
    if (!input.value.trim()) {
      state.lat = null; state.lng = null; state.pin = '';
    }
    renderPin();
  });

  gpsBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      toast("This browser can't share your location", 'error');
      return;
    }
    gpsBtn.disabled = true;
    gpsBtn.textContent = 'Locating...';
    const reset = () => { gpsBtn.disabled = false; gpsBtn.textContent = '📍 Use my current location'; };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.lat = pos.coords.latitude;
        state.lng = pos.coords.longitude;
        state.pin = 'your current position';
        if (!input.value.trim()) {
          input.value = 'My current location';
          state.label = input.value;
        }
        renderPin();
        reset();
      },
      () => {
        toast("Couldn't get your location. Allow location access, or search for a place instead", 'error');
        reset();
      },
      { timeout: 10000 }
    );
  });
}

// Empty box clears the location. A name with no pin is rejected.
function readLocation(inputEl, state) {
  const label = inputEl.value.trim();
  if (!label) return { ok: true, latitude: null, longitude: null, locationLabel: null };
  if (state.lat == null) return { ok: false };
  return { ok: true, latitude: state.lat, longitude: state.lng, locationLabel: label.slice(0, 200) };
}

function initOnboardingLocation() {
  document.getElementById('ob-location-field').innerHTML = locationFieldHtml('ob', '');
  mountLocationField('ob', obLocationState);
}