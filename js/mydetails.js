// Shows the profile someone already filled in during onboarding, and lets
// them update it — reuses the exact same PUT /api/profile endpoint that
// onboarding uses, since it's already an upsert (ProfileService.upsert()
// creates if missing, updates if it exists).

let currentProfilePhotoUrl = null;

async function openMyDetails() {
  showScreen('view-my-details');
  const body = document.getElementById('my-details-body');
  body.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading your profile...</p></div>';

  try {
    const profile = await api('/profile/me');
    renderMyDetailsForm(profile);
  } catch (e) {
    body.innerHTML = `<p style="font-size:13px;color:var(--ink-soft);">${escapeHtml(e.message)}</p>`;
  }
}

function renderMyDetailsForm(profile) {
  currentProfilePhotoUrl = profile.photoUrl || null;
  const body = document.getElementById('my-details-body');
  body.innerHTML = `
    <div class="profile-photo-picker" id="md-photo-picker" onclick="document.getElementById('md-photo-input').click()">
      ${profile.photoUrl ? `<img src="${profile.photoUrl}" />` : '📷'}
      <input type="file" id="md-photo-input" accept="image/*" style="display:none" onchange="handleProfilePhotoSelect(event)">
    </div>

    <div class="field"><label>Locality</label><input type="text" id="md-locality" value="${escapeHtml(profile.locality || '')}"></div>
    <div class="field"><label>Budget range (₹/month)</label>
      <div style="display:flex; gap:10px;">
        <input type="number" id="md-budget-min" value="${profile.budgetMin || ''}">
        <input type="number" id="md-budget-max" value="${profile.budgetMax || ''}">
      </div>
    </div>

    <div class="pd-section-label" style="margin-top:6px;">Sleep schedule</div>
    <div class="opt-grid" data-field="sleepSchedule">
      ${optChip('BEFORE_11PM', 'Before 11pm', profile.sleepSchedule)}
      ${optChip('ELEVEN_TO_1AM', '11pm–1am', profile.sleepSchedule)}
      ${optChip('AFTER_1AM', 'After 1am', profile.sleepSchedule)}
    </div>

    <div class="pd-section-label">Work-from-home</div>
    <div class="opt-grid" data-field="workFromHome">
      ${optChip('ALWAYS', 'Always', profile.workFromHome)}
      ${optChip('SOMETIMES', 'Sometimes', profile.workFromHome)}
      ${optChip('RARELY', 'Rarely', profile.workFromHome)}
    </div>

    <div class="pd-section-label">Food preference</div>
    <div class="opt-grid" data-field="foodPreference">
      ${optChip('VEGETARIAN', 'Vegetarian', profile.foodPreference)}
      ${optChip('NON_VEGETARIAN', 'Non-vegetarian', profile.foodPreference)}
      ${optChip('EGGETARIAN', 'Eggetarian', profile.foodPreference)}
    </div>

    <div class="pd-section-label">Cleanliness</div>
    <div class="opt-grid" data-field="cleanliness">
      ${optChip('RELAXED', 'Relaxed', profile.cleanliness)}
      ${optChip('TIDY_WEEKLY', 'Tidy weekly', profile.cleanliness)}
      ${optChip('VERY_PARTICULAR', 'Very particular', profile.cleanliness)}
    </div>

    <button class="btn-primary" id="save-details-btn" style="margin-top:10px;" onclick="saveMyDetails()">Save changes →</button>
  `;

  body.querySelectorAll('.opt-grid').forEach(grid => {
    grid.addEventListener('click', (e) => {
      const chip = e.target.closest('.opt-chip');
      if (!chip) return;
      grid.querySelectorAll('.opt-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });
}

function optChip(value, label, currentValue) {
  const selected = value === currentValue ? ' selected' : '';
  return `<div class="opt-chip${selected}" data-value="${value}">${label}</div>`;
}

async function handleProfilePhotoSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const picker = document.getElementById('md-photo-picker');
  picker.innerHTML = '<div class="spinner" style="border-top-color:var(--ink);"></div>';
  try {
    currentProfilePhotoUrl = await uploadToCloudinary(file);
    picker.innerHTML = `<img src="${currentProfilePhotoUrl}" />`;
  } catch (err) {
    toast(err.message, 'error');
    picker.innerHTML = '📷';
  }
}

async function saveMyDetails() {
  const locality = document.getElementById('md-locality').value.trim();
  const budgetMin = parseInt(document.getElementById('md-budget-min').value, 10);
  const budgetMax = parseInt(document.getElementById('md-budget-max').value, 10);

  if (!locality || !budgetMin || !budgetMax) {
    toast('Fill in locality and budget range', 'error');
    return;
  }

  const answers = {};
  document.querySelectorAll('#my-details-body .opt-grid').forEach(grid => {
    const selected = grid.querySelector('.opt-chip.selected');
    if (selected) answers[grid.dataset.field] = selected.dataset.value;
  });

  const btn = document.getElementById('save-details-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api('/profile', { method: 'PUT', body: { locality, budgetMin, budgetMax, photoUrl: currentProfilePhotoUrl, ...answers } });
    toast('Profile updated!', 'success');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Save changes →';
  }
}