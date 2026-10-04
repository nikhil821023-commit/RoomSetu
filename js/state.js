// Single shared state object — every other module reads/writes this.
// localStorage is intentional here: this is a real app opened as a local
// file against your own backend, not a hosted Claude artifact, so persisting
// the JWT across reloads is the correct behavior, not a restricted pattern.
const State = {
  apiBase: localStorage.getItem('roomsetu_api_base') || 'http://localhost:8080/api',
  token: localStorage.getItem('roomsetu_token') || null,
  userId: localStorage.getItem('roomsetu_user_id') || null,
  name: localStorage.getItem('roomsetu_name') || null,
  role: localStorage.getItem('roomsetu_role') || null,
  admin: localStorage.getItem('roomsetu_admin') === 'true',
  pendingPhone: null,
  obAnswers: {},
  discoverCache: [],
  currentHouseholdMatchId: null,
};