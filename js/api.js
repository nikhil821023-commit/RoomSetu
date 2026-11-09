async function api(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && State.token) headers['Authorization'] = 'Bearer ' + State.token;

  // Free hosting sleeps when idle. If a request takes unusually long, say why.
  const slowTimer = setTimeout(() => {
    toast('Waking up the server. Free hosting sleeps when idle, this can take up to a minute', '');
  }, 6000);

  let res;
  try {
    res = await fetch(State.apiBase + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(slowTimer);
  }

  if (!res.ok) {
    let msg = 'Request failed (' + res.status + ')';
    try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;

  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}