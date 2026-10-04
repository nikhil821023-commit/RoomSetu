// Free geocoding via OpenStreetMap Nominatim. Note: fair-use only (~1 req/sec),
// fine for testing, not for real production traffic without your own provider.

let geocodeDebounceTimer = null;

async function geocodeAddress(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Location lookup failed');
  const results = await res.json();
  if (!results.length) throw new Error('Could not find that location — try a more specific address');
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

// Returns up to 5 suggestion objects: { label, lat, lng }
async function geocodeSuggestions(query) {
  if (query.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const results = await res.json();
  return results.map(r => ({ label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }));
}

/**
 * Wires up a text input to show a live dropdown of location suggestions.
 * onSelect(suggestion) fires when the user picks one — that's the moment
 * you have real, already-geocoded coordinates, no separate lookup needed.
 */
function initLocationAutocomplete(inputEl, dropdownEl, onSelect) {
  inputEl.addEventListener('input', () => {
    clearTimeout(geocodeDebounceTimer);
    const query = inputEl.value;
    if (query.trim().length < 3) { dropdownEl.style.display = 'none'; return; }

    // Debounce so we're not firing a request on every keystroke — respects
    // Nominatim's fair-use rate limit and just feels less janky.
    geocodeDebounceTimer = setTimeout(async () => {
      const suggestions = await geocodeSuggestions(query);
      if (!suggestions.length) { dropdownEl.style.display = 'none'; return; }

      dropdownEl.innerHTML = suggestions.map((s, i) => `
        <div class="autocomplete-item" data-index="${i}">${escapeHtml(s.label)}</div>
      `).join('');
      dropdownEl.style.display = 'block';

      dropdownEl.querySelectorAll('.autocomplete-item').forEach((el, i) => {
        el.onclick = () => {
          inputEl.value = suggestions[i].label;
          dropdownEl.style.display = 'none';
          onSelect(suggestions[i]);
        };
      });
    }, 400);
  });

  // Hide dropdown when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (e.target !== inputEl && !dropdownEl.contains(e.target)) {
      dropdownEl.style.display = 'none';
    }
  });
}