// The profile sheet other logged-in members see. The backend never sends phone,
// budget or exact address, so there is nothing private to accidentally render here.

let currentPublicProfile = null;
let reviewDraftRating = 0;

const LIFESTYLE_LABELS = {
  sleepSchedule: { BEFORE_11PM: 'Sleeps before 11pm', ELEVEN_TO_1AM: 'Sleeps 11pm–1am', AFTER_1AM: 'Night owl (after 1am)' },
  workFromHome: { ALWAYS: 'Works from home', SOMETIMES: 'Sometimes WFH', RARELY: 'Rarely WFH' },
  foodPreference: { VEGETARIAN: 'Vegetarian', NON_VEGETARIAN: 'Non-vegetarian', EGGETARIAN: 'Eggetarian' },
  cleanliness: { RELAXED: 'Relaxed about cleaning', TIDY_WEEKLY: 'Tidies weekly', VERY_PARTICULAR: 'Very particular about cleanliness' },
};

function starsText(n) {
  const r = Math.max(0, Math.min(5, Math.round(n)));
  return '★'.repeat(r) + '☆'.repeat(5 - r);
}
function monthYear(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';
}

async function openPublicProfile(userId) {
  const body = document.getElementById('sheet-body');
  body.innerHTML = '<div class="loading-screen" style="padding:40px 0;"><div class="spinner"></div><p>Loading profile...</p></div>';
  document.getElementById('sheet-overlay').classList.add('active');
  requestAnimationFrame(() => document.getElementById('sheet').classList.add('open'));

  try {
    currentPublicProfile = await api('/public-profile/' + userId);
    reviewDraftRating = 0;
    renderPublicProfile(currentPublicProfile);
  } catch (e) {
    body.innerHTML = emptyState('Profile unavailable', e.message);
  }
}

function renderPublicProfile(p) {
  const body = document.getElementById('sheet-body');
  const L = LIFESTYLE_LABELS;

  const tags = [
    L.sleepSchedule[p.sleepSchedule], L.workFromHome[p.workFromHome],
    L.foodPreference[p.foodPreference], L.cleanliness[p.cleanliness],
    p.smokes === true ? 'Smokes' : p.smokes === false ? 'Non-smoker' : null,
    p.drinks === true ? 'Drinks' : p.drinks === false ? "Doesn't drink" : null,
    p.hasPets ? 'Has pets' : null,
  ].filter(Boolean);

  const badges = `
    <div class="badge-row">
      ${p.phoneVerified ? '<span class="badge-chip">✓ Phone verified</span>' : ''}
      ${p.workEmailDomain
        ? `<span class="badge-chip">✓ Email verified · @${escapeHtml(p.workEmailDomain)}</span>`
        : '<span class="badge-chip muted">Work/college email not verified</span>'}
    </div>`;

  const rating = p.reviewCount
    ? `<span class="stars">${starsText(p.averageRating)}</span> ${p.averageRating.toFixed(1)} · ${p.reviewCount} review${p.reviewCount === 1 ? '' : 's'}`
    : 'No reviews yet';

  const listingsHtml = p.listings.length ? `
    <div class="pd-section-label">Listings</div>
    ${p.listings.map(l => `
      <div class="listing-card" style="margin-bottom:12px;" onclick="openListing(${l.id})">
        ${l.photoUrls && l.photoUrls.length ? `<img src="${l.photoUrls[0]}" class="lc-photo">` : ''}
        <div class="lc-top">
          <div class="lc-rent">₹${l.rent}<span> /month</span></div>
          <div class="lc-loc">📍 ${escapeHtml(l.locality)}</div>
        </div>
        <div class="lc-tags">
          <span class="tag">${l.leaseType === 'PG' ? 'PG' : 'Flat share'}</span>
          <span class="tag">Available ${l.availableFrom}</span>
        </div>
      </div>`).join('')}` : '';

  const reviewsHtml = p.reviews.length
    ? p.reviews.map(r => `
        <div class="review-item">
          <div class="rv-head"><b>${escapeHtml(r.reviewerName)}</b><span class="stars">${starsText(r.rating)}</span></div>
          ${r.comment ? `<div class="rv-body">${escapeHtml(r.comment)}</div>` : ''}
          <div class="rv-body" style="font-size:11.5px;">${r.tenancyPeriod ? escapeHtml(r.tenancyPeriod) + ' · ' : ''}${monthYear(r.createdAt)}</div>
        </div>`).join('')
    : '<p style="font-size:12.5px;color:var(--ink-soft);margin:0;">No reviews yet.</p>';

  const reviewForm = p.viewerCanReview ? `
    <div class="pd-section-label">Leave a review</div>
    <div class="star-picker" id="star-picker">
      ${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" onclick="setReviewRating(${n})">★</button>`).join('')}
    </div>
    <div class="field">
      <textarea id="review-comment" rows="3" maxlength="500" placeholder="How was it sharing a place with ${escapeHtml(p.name)}?" style="width:100%; border:1.5px solid var(--line); border-radius:12px; padding:13px 15px; font-family:inherit; font-size:14px; resize:vertical;"></textarea>
    </div>
    <div class="field"><input type="text" id="review-period" maxlength="100" placeholder="Period together, optional (e.g. Jan–Jun 2026)"></div>
    <button class="btn-primary" id="review-submit-btn" onclick="submitReview(${p.userId})">Post review →</button>` : '';

  let actions;
  if (p.self) {
    actions = `<p style="font-size:12px;color:var(--ink-soft);text-align:center;margin:18px 0 0;">This is how other RoomSetu members see you.</p>
      <div class="pd-cta"><button class="btn-ghost" onclick="closeSheet()" style="width:100%;">Close</button></div>`;
  } else if (p.matchStatus === 'ACCEPTED') {
    actions = `<div class="pd-cta"><button class="btn-ghost" onclick="closeSheet()" style="flex:0 0 auto;">Close</button>
      <button class="btn-primary" onclick="messagePublicProfile()">Message →</button></div>`;
  } else if (p.matchStatus === 'PENDING') {
    actions = `<div class="pd-cta"><button class="btn-ghost" onclick="closeSheet()" style="flex:0 0 auto;">Close</button>
      <button class="btn-primary" disabled>Request pending</button></div>`;
  } else if (p.matchStatus === 'REJECTED') {
    actions = `<div class="pd-cta"><button class="btn-ghost" onclick="closeSheet()" style="width:100%;">Close</button></div>`;
  } else {
    actions = `<div class="pd-cta"><button class="btn-ghost" onclick="closeSheet()" style="flex:0 0 auto;">Close</button>
      <button class="btn-primary" id="request-match-btn" onclick="requestMatch(${p.userId})">Send match request →</button></div>`;
  }

  body.innerHTML = `
    <div class="pd-hero" style="padding-bottom:6px;">
      <div class="avatar" style="background:${avatarColor(p.userId)}">${p.photoUrl ? `<img src="${p.photoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : escapeHtml(p.name.charAt(0))}</div>
      <h2>${escapeHtml(p.name)}</h2>
      <div style="font-size:13px;color:var(--ink-soft);">${p.role === 'HOST' ? 'Host' : 'Seeker'}${p.locality ? ' · 📍 ' + escapeHtml(p.locality) : ''}</div>
      <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">Member since ${monthYear(p.memberSince)}</div>
      ${badges}
      <div style="font-size:13px;margin-top:12px;">${rating}</div>
    </div>

    ${p.bio ? `<div class="mc-quote" style="margin:14px 0 0;">"${escapeHtml(p.bio)}"</div>` : ''}

    ${tags.length ? `<div class="pd-section-label">Lifestyle</div>
      <div class="mc-tags" style="padding:0;">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}

    ${listingsHtml}

    <div class="pd-section-label">Reviews</div>
    ${reviewsHtml}
    ${reviewForm}
    ${actions}

    ${p.self ? '' : `
  <div style="display:flex; justify-content:center; gap:20px; margin-top:6px;">
    <button class="btn-link" style="color:var(--ink-soft);" onclick="blockPublicProfile()">Block</button>
    <button class="btn-link" style="color:var(--coral);" onclick="reportPublicProfile()">Report</button>
  </div>`}



  `;
}

function setReviewRating(n) {
  reviewDraftRating = n;
  document.querySelectorAll('#star-picker button').forEach(b => b.classList.toggle('on', Number(b.dataset.n) <= n));
}

async function submitReview(revieweeId) {
  if (!reviewDraftRating) { toast('Pick a star rating', 'error'); return; }
  const comment = document.getElementById('review-comment').value.trim();
  const tenancyPeriod = document.getElementById('review-period').value.trim();

  const btn = document.getElementById('review-submit-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api('/reviews', { method: 'POST', body: { revieweeId, rating: reviewDraftRating, comment, tenancyPeriod } });
    toast('Review posted', 'success');
    openPublicProfile(revieweeId);
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false; btn.innerHTML = 'Post review →';
  }
}

function messagePublicProfile() {
  if (!currentPublicProfile) return;
  const { userId, name } = currentPublicProfile;
  closeSheet();
  setTimeout(() => openConversation(userId, name, 'matches'), 320);
}