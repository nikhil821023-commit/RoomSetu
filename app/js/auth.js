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


function setAuthMethod(method) {
  State.authMethod = method;
  localStorage.setItem('roomsetu_auth_method', method);
  document.getElementById('method-phone').classList.toggle('on', method === 'phone');
  document.getElementById('method-email').classList.toggle('on', method === 'email');
  document.getElementById('phone-field').style.display = method === 'phone' ? 'block' : 'none';
  document.getElementById('email-field').style.display = method === 'email' ? 'block' : 'none';
  document.getElementById('auth-heading').textContent = method === 'phone' ? "What's your number?" : "What's your email?";
  document.getElementById('auth-hint').textContent = method === 'phone'
    ? "We'll text you a one-time code. No passwords to remember."
    : "We'll email you a one-time code. No passwords to remember.";
}

async function requestOtp(isSignup) {
  const method = State.authMethod || 'phone';
  let path, body, shown;

  if (method === 'email') {
    const email = document.getElementById('email-input').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('Enter a valid email address', 'error'); return; }
    path = '/auth/email/request'; body = { email }; shown = email;
  } else {
    const phone = document.getElementById('phone-input').value.trim();
    if (!/^[6-9]\d{9}$/.test(phone)) { toast('Enter a valid 10-digit number', 'error'); return; }
    path = '/auth/otp/request'; body = { phone }; shown = '+91 ' + phone;
  }

  State.isSignup = isSignup;
  const btn = document.getElementById('request-otp-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    await api(path, { method: 'POST', auth: false, body });
    State.otpMethod = method;
    if (method === 'email') State.pendingEmail = body.email; else State.pendingPhone = body.phone;

    document.getElementById('otp-phone-display').textContent = shown;
    toast('Code sent to ' + shown, 'success');
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
  const method = State.otpMethod || 'phone';
  const target = method === 'email' ? State.pendingEmail : State.pendingPhone;
  if (!target) return;
  try {
    await api(method === 'email' ? '/auth/email/request' : '/auth/otp/request', {
      method: 'POST', auth: false,
      body: method === 'email' ? { email: target } : { phone: target }
    });
    toast('New code sent', 'success');
    startResendTimer();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function verifyOtp() {
  const digits = Array.from(document.querySelectorAll('.otp-digit')).map(i => i.value).join('');
  if (digits.length !== 6) { toast('Enter the full 6-digit code', 'error'); return; }

  const name = document.getElementById('signup-name').value.trim();
  const role = document.getElementById('signup-role').value;
  const method = State.otpMethod || 'phone';

  const btn = document.getElementById('verify-otp-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    const body = method === 'email'
      ? { email: State.pendingEmail, otp: digits }
      : { phone: State.pendingPhone, otp: digits };
    if (name) { body.name = name; body.role = role; }

    const res = await api(method === 'email' ? '/auth/email/verify' : '/auth/otp/verify',
                          { method: 'POST', auth: false, body });

    State.token = res.token;
    State.userId = String(res.userId);
    State.name = res.name;
    State.role = res.role;
    localStorage.setItem('roomsetu_token', res.token);
    localStorage.setItem('roomsetu_user_id', String(res.userId));
    localStorage.setItem('roomsetu_name', res.name);
    localStorage.setItem('roomsetu_role', res.role);

    toast('Welcome, ' + res.name + '!', 'success');

    // Try loading a profile. If it fails, they haven't completed onboarding yet.
    try {
      await api('/profile/me');
      document.getElementById('bottom-nav').style.display = 'flex';
      showTab('discover');
    } catch (_) {
      showScreen('view-onboarding');
    }
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Verify & continue →';
  }
}

function logout() {
  if (typeof stopUnreadPolling === 'function') stopUnreadPolling();
  ['roomsetu_token', 'roomsetu_user_id', 'roomsetu_name', 'roomsetu_role', 'roomsetu_admin']
    .forEach(k => localStorage.removeItem(k));
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