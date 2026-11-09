// OTP request/verify + onboarding questionnaire submission.

let resendTimer = null;

function startResendTimer(seconds = 30) {
  const btn = document.getElementById('resend-otp-btn');
  let left = seconds;
  clearInterval(resendTimer);
  btn.disabled = true;
  btn.textContent = `Resend code in ${left}s`;
  resendTimer = setInterval(() => {
    left--;
    if (left <= 0) {
      clearInterval(resendTimer);
      btn.disabled = false;
      btn.textContent = 'Resend code';
    } else {
      btn.textContent = `Resend code in ${left}s`;
    }
  }, 1000);
}

async function requestOtp(isSignup) {
  const phone = document.getElementById('phone-input').value.trim();
  if (!/^[6-9]\d{9}$/.test(phone)) { toast('Enter a valid 10-digit number', 'error'); return; }

  State.isSignup = isSignup; // remember this for verifyOtp

  const btn = document.getElementById('request-otp-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api('/auth/otp/request', { method: 'POST', auth: false, body: { phone } });
    State.pendingPhone = phone;
    document.getElementById('otp-phone-display').textContent = '+91 ' + phone;
    toast('Code sent to +91 ' + phone, 'success');

    document.getElementById('signup-fields').style.display = isSignup ? 'block' : 'none';

    showScreen('view-auth-otp');
    startResendTimer();
    document.querySelector('.otp-digit').focus();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Log in →';
  }
}

async function resendOtp() {
  if (!State.pendingPhone) return;
  try {
    await api('/auth/otp/request', { method: 'POST', auth: false, body: { phone: State.pendingPhone } });
    toast('New code sent', 'success');
    startResendTimer();
  } catch (e) {
    toast(e.message, 'error');
  }
}

document.addEventListener('input', (e) => {
  if (e.target.classList.contains('otp-digit') && e.target.value.length === 1) {
    const next = e.target.nextElementSibling;
    if (next && next.classList.contains('otp-digit')) next.focus();
  }
});

async function verifyOtp() {
  const digits = Array.from(document.querySelectorAll('.otp-digit')).map(i => i.value).join('');
  if (digits.length !== 6) { toast('Enter the full 6-digit code', 'error'); return; }

  const btn = document.getElementById('verify-otp-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    const body = { phone: State.pendingPhone, otp: digits };

    if (State.isSignup) {
      const name = document.getElementById('signup-name').value.trim();
      const role = document.getElementById('signup-role').value;
      if (!name) { toast('Enter your name to finish signing up', 'error'); btn.disabled = false; btn.innerHTML = 'Verify & continue →'; return; }
      body.name = name;
      body.role = role;
    }

    const res = await api('/auth/otp/verify', { method: 'POST', auth: false, body });



    State.token = res.token; State.userId = String(res.userId);
    State.name = res.name; State.role = res.role; State.admin = !!res.admin;
    localStorage.setItem('roomsetu_token', res.token);
    localStorage.setItem('roomsetu_user_id', String(res.userId));
    localStorage.setItem('roomsetu_name', res.name);
    localStorage.setItem('roomsetu_role', res.role);
    localStorage.setItem('roomsetu_admin', String(State.admin));

    toast('Welcome, ' + res.name + '!', 'success');

    try {
      await api('/profile/me');
      document.getElementById('bottom-nav').style.display = 'flex';
      showTab('discover');
    } catch (_) {
      showScreen('view-onboarding'); // no profile yet — not an error, just a new user
    }
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Verify & continue →';
  }
}

function logout() {
  stopUnreadPolling();
  localStorage.removeItem('roomsetu_token');
  localStorage.removeItem('roomsetu_user_id');
  localStorage.removeItem('roomsetu_name');
  localStorage.removeItem('roomsetu_role');
  State.token = null;
  document.getElementById('bottom-nav').style.display = 'none';
  showScreen('view-auth-phone');
}

document.querySelectorAll('.opt-grid').forEach(grid => {
  grid.addEventListener('click', (e) => {
    const chip = e.target.closest('.opt-chip');
    if (!chip) return;
    grid.querySelectorAll('.opt-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    State.obAnswers[grid.dataset.field] = chip.dataset.value;
  });
});

function obNext(step) {
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  document.querySelector(`.ob-step[data-step="${step}"]`).classList.add('active');
  document.querySelectorAll('.ob-progress span').forEach((s, i) => {
    if (i < step) s.classList.add('done'); else s.classList.remove('done');
  });
}

async function submitProfile() {
  const locality = document.getElementById('ob-locality').value.trim();
  const budgetMin = parseInt(document.getElementById('ob-budget-min').value, 10);
  const budgetMax = parseInt(document.getElementById('ob-budget-max').value, 10);

  if (!locality || !budgetMin || !budgetMax) {
    toast('Fill in locality and budget range', 'error');
    return;
  }

  const loc = readLocation(document.getElementById('ob-location'), obLocationState);
  if (!loc.ok) {
toast('Choose a spot: pick a suggestion or use your current location, or clear the box', 'error');    return;
  }

  const btn = document.getElementById('ob-submit-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api('/profile', {
      method: 'PUT',
      body: {
        locality, budgetMin, budgetMax,
        latitude: loc.latitude, longitude: loc.longitude, locationLabel: loc.locationLabel,
        ...State.obAnswers
      }
    });
    toast('Profile complete!', 'success');
    document.getElementById('bottom-nav').style.display = 'flex';
    showTab('discover');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Enter RoomSetu →';
  }
}