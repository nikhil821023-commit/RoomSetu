// Real chat: conversation-per-pair, polled every 3s while a thread is open.
// Reached from three places: an accepted match, sending a listing inquiry,
// or the Messages inbox for a conversation started earlier.

let currentConversationId = null;
let chatPollInterval = null;
let chatReturnTab = 'matches'; // where the back button goes — set by whoever opened the chat

async function openConversation(otherUserId, otherUserName, returnTab) {
  chatReturnTab = returnTab || 'matches';
  document.getElementById('chat-partner-name').textContent = otherUserName;
  document.getElementById('chat-partner-avatar').textContent = otherUserName.charAt(0);
  document.getElementById('chat-partner-avatar').style.background = avatarColor(Number(otherUserId) || 0);
  showScreen('view-chat');

  const body = document.getElementById('thread-body');
  body.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';

  try {
    const res = await api('/conversations/with/' + otherUserId, { method: 'POST' });
    currentConversationId = res.conversationId;
    await loadMessages();
    clearInterval(chatPollInterval);
    chatPollInterval = setInterval(loadMessages, 3000);
  } catch (e) {
    body.innerHTML = `<p style="text-align:center;color:var(--coral);font-size:13px;">${escapeHtml(e.message)}</p>`;
  }
}

function closeChatScreen() {
  clearInterval(chatPollInterval);
  currentConversationId = null;
  if (chatReturnTab === 'messages') openConversationsList();
  else showTab(chatReturnTab);
}

async function loadMessages() {
  if (!currentConversationId) return;
  try {
    const messages = await api(`/conversations/${currentConversationId}/messages`);
    const body = document.getElementById('thread-body');
    const wasNearBottom = body.scrollTop + body.clientHeight >= body.scrollHeight - 40;

    body.innerHTML = messages.length
      ? messages.map(m => `<div class="bubble ${String(m.senderId) === State.userId ? 'me' : 'them'}">${escapeHtml(m.content)}</div>`).join('')
      : '<div class="sys-note">Say hello 👋</div>';

    if (wasNearBottom) body.scrollTop = body.scrollHeight;
  } catch (e) {
    // Silent on poll failures — a toast every 3 seconds on a flaky connection
    // would be worse than just quietly retrying next cycle.
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

async function openConversationsList() {
  showScreen('view-conversations');
  const container = document.getElementById('conversations-list');
  container.innerHTML = '<div class="loading-screen"><div class="spinner"></div><p>Loading...</p></div>';
  try {
    const convos = await api('/conversations/mine');
    if (!convos.length) {
      container.innerHTML = emptyState('No conversations yet', 'Start one from an accepted match or a listing inquiry.');
      return;
    }
    container.innerHTML = convos.map(c => `
      <div class="req-row" style="cursor:pointer;" onclick="openConversation(${c.otherUserId}, '${escapeHtml(c.otherUserName)}', 'messages')">
        <div class="avatar" style="width:44px;height:44px;font-size:15px;border-radius:13px;background:${avatarColor(c.otherUserId)}">${c.otherUserName.charAt(0)}</div>
        <div class="txt"><b>${escapeHtml(c.otherUserName)}</b><div class="sub">${c.lastMessage ? escapeHtml(c.lastMessage) : 'No messages yet'}</div></div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = emptyState('Couldn\'t load messages', e.message);
  }
}