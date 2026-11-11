(function () {
  'use strict';
  const view = document.getElementById('view-auth-otp');
  if (!view) return;
  const boxes = [...view.querySelectorAll('.otp-digit')];
  if (!boxes.length) return;

  const N = boxes.length;
  const verifyBtn = document.getElementById('verify-otp-btn');
  const digitsOnly = (s) => (s || '').replace(/\D/g, '');
  let submitted = false;

  boxes.forEach((b, i) => {
    // No maxlength: lets paste and the phone's SMS autofill deliver the whole code at once.
    b.removeAttribute('maxlength');
    b.setAttribute('inputmode', 'numeric');
    b.setAttribute('pattern', '[0-9]*');
    b.setAttribute('autocomplete', 'one-time-code');
    b.setAttribute('autocapitalize', 'off');
    b.setAttribute('enterkeyhint', i === N - 1 ? 'done' : 'next');
    b.setAttribute('aria-label', 'Digit ' + (i + 1) + ' of ' + N);
  });

  const focusBox = (i) => {
    const b = boxes[Math.max(0, Math.min(N - 1, i))];
    b.focus();
    if (b.select) b.select();
  };
  const code = () => boxes.map((b) => b.value).join('');
  const markFilled = () => boxes.forEach((b) => b.classList.toggle('filled', !!b.value));

  function fill(start, str) {
    submitted = false;
    for (let k = 0; k < str.length && start + k < N; k++) boxes[start + k].value = str[k];
    markFilled();
    focusBox(Math.min(start + str.length, N - 1));
    checkComplete();
  }

  function checkComplete() {
    if (code().length !== N || submitted) return;
    const signup = document.getElementById('signup-fields');
    // New account: they still need to type their name, so don't submit yet.
    if (signup && getComputedStyle(signup).display !== 'none') {
      const name = document.getElementById('signup-name');
      if (name) name.focus();
      return;
    }
    submitted = true;
    setTimeout(() => { if (verifyBtn && !verifyBtn.disabled) verifyBtn.click(); }, 180);
  }

  boxes.forEach((b, i) => {
    // select() can steal focus back in Chrome, so only run it while this box is still the focused one
    const selectIfActive = () => { if (document.activeElement === b && b.select) b.select(); };
    b.addEventListener('focus', () => setTimeout(selectIfActive, 0));
    b.addEventListener('click', selectIfActive);

    b.addEventListener('input', () => {
      submitted = false;
      const d = digitsOnly(b.value);
      if (d.length > 1) {                       // autofill or fast paste into one box
        fill(d.length >= N ? 0 : i, d.slice(0, N));
        return;
      }
      b.value = d;
      markFilled();
      if (d && i < N - 1) focusBox(i + 1);
      checkComplete();
    });

    b.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (!b.value && i > 0) {
          e.preventDefault();
          boxes[i - 1].value = '';
          markFilled();
          focusBox(i - 1);
        }
        submitted = false;
      } else if (e.key === 'ArrowLeft') { e.preventDefault(); focusBox(i - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); focusBox(i + 1); }
      else if (e.key === 'Enter') { if (verifyBtn && code().length === N) verifyBtn.click(); }
      else if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); }
    });

    b.addEventListener('paste', (e) => {
      e.preventDefault();
      const d = digitsOnly((e.clipboardData || window.clipboardData).getData('text'));
      if (d) fill(d.length >= N ? 0 : i, d.slice(0, N));
    });
  });

  // Android Chrome: read the code straight from the SMS (needs "@your-domain #123456" in the SMS).
  let abortCtl = null;
  function startWebOtp() {
    if (!('OTPCredential' in window) || !navigator.credentials) return;
    try {
      if (abortCtl) abortCtl.abort();
      abortCtl = new AbortController();
      navigator.credentials.get({ otp: { transport: ['sms'] }, signal: abortCtl.signal })
        .then((c) => { if (c && c.code) fill(0, digitsOnly(c.code).slice(0, N)); })
        .catch(() => {});
    } catch (e) { /* unsupported, ignore */ }
  }

  // When the code screen appears: focus the first empty box and start listening for the SMS.
  new MutationObserver(() => {
    if (view.classList.contains('active')) {
      submitted = false;
      boxes.forEach((b) => { b.value = ''; });   // a freshly opened code screen always starts empty
      markFilled();
      setTimeout(() => { const e = boxes.findIndex((b) => !b.value); focusBox(e === -1 ? N - 1 : e); }, 350);
      startWebOtp();
    } else if (abortCtl) { abortCtl.abort(); abortCtl = null; }
  }).observe(view, { attributes: true, attributeFilter: ['class'] });

  // Small helper other scripts may call after a wrong code
  window.RoomSetuOtp = {
    clear() { boxes.forEach((b) => (b.value = '')); markFilled(); submitted = false; focusBox(0); },
    shake() { const w = view.querySelector('.otp-boxes'); if (!w) return; w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); },
  };

  // Hook into auth.js (loaded before this file): handle wrong codes and resends.
  const origVerify = window.verifyOtp;
  if (typeof origVerify === 'function') {
    window.verifyOtp = async function () {
      const full = code().length === N;
      const result = await origVerify.apply(this, arguments);
      // Still on the code screen after a full attempt means the code was rejected.
      if (full && view.classList.contains('active')) { window.RoomSetuOtp.shake(); window.RoomSetuOtp.clear(); }
      return result;
    };
  }
  const origResend = window.resendOtp;
  if (typeof origResend === 'function') {
    window.resendOtp = async function () {
      const result = await origResend.apply(this, arguments);
      window.RoomSetuOtp.clear();
      startWebOtp();
      return result;
    };
  }

})();