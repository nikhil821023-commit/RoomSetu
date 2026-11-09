// Real chat: one conversation per pair, polled every 3 seconds while a thread is open.
// Reached from an accepted match, a listing inquiry, the public profile "Message" button,
// the host's Inquiries "Reply" button, or the Messages inbox.

let currentConversationId = null;
let currentChatPartnerId = null;
let chatPollInterval = null;
let chatReturnTab = 'matches'; // where the back arrow goes; set by whoever opened the chat
let conversationsCache = [];

function updateUnreadBadge() {
  if (typeof refreshUnreadBadge === 'function') refreshUnreadBadge();
}

async function openConversation(otherUserId, otherUserName, returnTab, firstMessage) {
  chatReturnTab = returnTab || 'matches';
  currentChatPartnerId = otherUserId;
  document.getElementById('chat-partner-name').textContent = otherUserName;
  document.getElementById('chat-partner-avatar').textContent = otherUserName.charAt(0);
  document.getElementById('chat-partner-avatar').style.background = avatarColor(Number(otherUserId) || 0);
  showScreen('view-chat');

  const body = document.getElementById('thread-body');
  body.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';

  try {
    const res = await api('/conversations/with/' + otherUserId, { method: 'POST' });
    currentConversationId = res.conversationId;
    if (firstMessage) {
      await api(`/conversations/${currentConversationId}/messages`, { method: 'POST', body: { content: firstMessage } });
    }
    await loadMessages();
    updateUnreadBadge();
    clearInterval(chatPollInterval);
    chatPollInterval = setInterval(loadMessages, 3000);
  } catch (e) {
    body.innerHTML = `<p style="text-align:center;color:var(--coral);font-size:13px;padding:0 20px;">${escapeHtml(e.message)}</p>`;
  }
}

function closeChatScreen() {
  updateUnreadBadge();
  clearInterval(chatPollInterval);
  currentConversationId = null;
  if (chatReturnTab === 'messages') openConversationsList();
  else showTab(chatReturnTab);
}

function openChatPartnerProfile() {
  if (currentChatPartnerId) openPublicProfile(currentChatPartnerId);
}

async function loadMessages() {
  // Skip while the browser tab is in the background, so unseen messages aren't marked read.
  if (!currentConversationId || document.hidden) return;
  try {
    const messages = await api(`/conversations/${currentConversationId}/messages`);
    const body = document.getElementById('thread-body');
    const wasNearBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 40;

    body.innerHTML = messages.length
      ? messages.map(m => `<div class="bubble ${String(m.senderId) === State.userId ? 'me' : 'them'}">${escapeHtml(m.content)}</div>`).join('')
      : '<div class="sys-note">Say hello 👋</div>';

    if (wasNearBottom) body.scrollTop = body.scrollHeight;
  } catch (e) {
    // Silent on poll failures. A toast every 3 seconds on a flaky connection would be worse.
  }
}

async function sendMsg() {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content || !currentConversationId) return;
  input.value = '';
  try {
    await api(`/conversations/${currentConversationId}/messages`, { method: 'POST', body: { content } });
    await loadMessages();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function deleteConversation(conversationId) {
  if (!confirm("Delete this chat? It only disappears for you. If they message you again, the chat comes back with just the new messages.")) return;
  try {
    await api('/conversations/' + conversationId, { method: 'DELETE' });
    toast('Chat deleted', 'success');
    if (currentConversationId === conversationId) {
      clearInterval(chatPollInterval);
      currentConversationId = null;
    }
    openConversationsList();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function deleteCurrentChat() {
  if (currentConversationId) deleteConversation(currentConversationId);
}

async function openConversationsList() {
  showScreen('view-conversations');
  const container = document.getElementById('conversations-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const convos = await api('/conversations/mine');
    conversationsCache = convos;
    if (!convos.length) {
      container.innerHTML = emptyState('No conversations yet', 'Start one from an accepted match or a listing inquiry.');
      return;
    }
    container.innerHTML = convos.map((c, idx) => `
      <div class="req-row" style="cursor:pointer;" onclick="openConversationFromInbox(${idx})">
        <div class="avatar" style="width:44px;height:44px;font-size:15px;border-radius:13px;background:${avatarColor(c.otherUserId)}">${escapeHtml(c.otherUserName.charAt(0))}</div>
        <div class="txt">
          <b>${escapeHtml(c.otherUserName)}</b>
          <div class="sub" style="${c.unreadCount ? 'color:var(--ink);font-weight:700;' : ''}">${c.lastMessage ? escapeHtml(c.lastMessage) : 'No messages yet'}</div>
        </div>
        ${c.unreadCount ? `<span class="tag" style="background:var(--coral);color:white;">${c.unreadCount}</span>` : ''}
        <button class="icon-btn" style="width:34px; height:34px; font-size:14px;" title="Delete chat"
                onclick="event.stopPropagation(); deleteConversation(${c.id})">🗑</button>
      </div>`).join('');
    updateUnreadBadge();
  } catch (e) {
    container.innerHTML = emptyState("Couldn't load messages", e.message);
  }
}

function openConversationFromInbox(idx) {
  const c = conversationsCache[idx];
  if (c) openConversation(c.otherUserId, c.otherUserName, 'messages');
}