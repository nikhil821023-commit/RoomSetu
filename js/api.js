async function api(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && State.token) headers['Authorization'] = 'Bearer ' + State.token;

  let res;
  try {
    res = await fetch(State.apiBase + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Could not reach the backend at ' + State.apiBase + ' — is it running, and is CORS configured?');
  }

  if (!res.ok) {
    let msg = 'Request failed (' + res.status + ')';
    try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;

  const text = await res.text();
  if (!text) return null;

  // Some endpoints (like otp/request) return plain text, not JSON — don't
  // crash on that. Try to parse as JSON; if it's not valid JSON, just
  // return the raw text as-is instead of throwing.
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}