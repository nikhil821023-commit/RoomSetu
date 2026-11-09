// Checks for unread messages every 20 seconds while logged in. This is polling,
// not push, so a new message can take up to 20 seconds to show up as a badge.

let unreadPollInterval = null;

function startUnreadPolling() {
  if (unreadPollInterval || !State.token) return;
  refreshUnreadBadge();
  unreadPollInterval = setInterval(refreshUnreadBadge, 20000);
}

function stopUnreadPolling() {
  clearInterval(unreadPollInterval);
  unreadPollInterval = null;
  const badge = document.getElementById('messages-badge');
  if (badge) badge.style.display = 'none';
}

async function refreshUnreadBadge() {
  try {
    const { count } = await api('/conversations/unread-count');

    const badge = document.getElementById('messages-badge');
    badge.style.display = count > 0 ? 'flex' : 'none';
    badge.textContent = count > 9 ? '9+' : count;

    const rowTag = document.getElementById('messages-count-tag');
    if (rowTag) {
      rowTag.style.display = count > 0 ? 'inline-block' : 'none';
      rowTag.textContent = count;
    }
  } catch (_) {
    // A failed poll is silent. A toast every 20 seconds would be worse than waiting for the next one.
  }
}