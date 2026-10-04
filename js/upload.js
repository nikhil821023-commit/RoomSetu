// Direct-to-Cloudinary unsigned upload. No backend involvement at all —
// this is the standard pattern for letting a frontend upload images without
// exposing any real credentials, since an unsigned preset can only ever
// accept uploads, never read/delete/manage anything in the account.

const CLOUDINARY_CLOUD_NAME = 'zjea8av4';   // <- replace with your dashboard's cloud name
const CLOUDINARY_UPLOAD_PRESET = 'roomsetu_unsigned';     // <- replace with your unsigned preset name

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error('Image upload failed — check your Cloudinary cloud name/preset in upload.js');
  const data = await res.json();
  return data.secure_url;
}

/**
 * Renders an Instagram-style multi-photo grid into `containerEl`, tracking
 * uploaded URLs in the `urls` array passed by reference (so the caller can
 * read it at submit time without any extra plumbing).
 */
function initPhotoGrid(containerEl, urls, maxPhotos = 6) {
  function render() {
    containerEl.innerHTML = urls.map((url, i) => `
      <div class="photo-tile">
        <img src="${url}" />
        <button class="photo-remove" onclick="removePhoto(${i})">✕</button>
      </div>
    `).join('') + (urls.length < maxPhotos ? `
      <label class="photo-tile photo-add">
        <input type="file" accept="image/*" style="display:none" onchange="handlePhotoSelect(event)">
        <span>+</span>
      </label>
    ` : '');
  }

  window.removePhoto = (i) => { urls.splice(i, 1); render(); };

  window.handlePhotoSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const tile = e.target.closest('.photo-tile');
    tile.innerHTML = '<div class="spinner" style="border-top-color:var(--ink);"></div>';
    try {
      const url = await uploadToCloudinary(file);
      urls.push(url);
      render();
    } catch (err) {
      toast(err.message, 'error');
      render();
    }
  };

  render();
}