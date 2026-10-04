// ID verification submission. Honest limitation up front: there's no real file
// storage wired anywhere in the backend (no S3/Cloudinary integration was ever
// built across any phase) — docUrl is a placeholder string, not an actual upload.
// This wiring is real; the file storage behind it isn't, yet.

async function openVerificationScreen() {
  showScreen('view-verification');
  await refreshVerificationStatusBox();
}

async function refreshVerificationStatusBox() {
  const box = document.getElementById('verification-status-box');
  box.innerHTML = '<p style="font-size:12.5px;color:var(--ink-soft);">Checking status...</p>';
  try {
    const trust = await api('/trust/' + State.userId);
    if (trust.idVerified) {
      box.innerHTML = `<div class="verified-strip">✓ Already verified</div>`;
    } else {
      box.innerHTML = `<p style="font-size:12.5px;color:var(--ink-soft);">Not verified yet — submissions are typically reviewed within 24 hours.</p>`;
    }
  } catch (e) {
    box.innerHTML = '';
  }
}

async function submitVerification() {
  const docType = document.getElementById('verify-doc-type').value;
  const fileInput = document.getElementById('verify-doc-file');

  if (!fileInput.files.length) {
    toast('Choose a file to continue', 'error');
    return;
  }

  // Placeholder doc URL — a real implementation needs an actual upload endpoint
  // (multipart POST to S3/Cloudinary/etc.) that returns a real, retrievable URL.
  // Using the filename here so an admin reviewer at least sees something meaningful
  // in the queue rather than a dummy string, without pretending this is a real upload.
  const placeholderDocUrl = 'pending-upload://' + encodeURIComponent(fileInput.files[0].name);

  const btn = document.getElementById('verify-submit-btn');
  btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>';
  try {
    // Backend expects query params here, not a JSON body — see VerificationController.submit()
    const query = `?docType=${encodeURIComponent(docType)}&docUrl=${encodeURIComponent(placeholderDocUrl)}`;
    await api('/verification/submit' + query, { method: 'POST' });

    toast('Submitted for review!', 'success');
    await refreshVerificationStatusBox();
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'Submit for review →';
  }
}