// AgenticCore Agency — Forge, the full-page chat assistant. Works whether
// or not the visitor is signed in: authenticated clients use forge-chat
// (tied to their profile, persistent history), anonymous visitors use
// widget-chat (tied to a local visitorId) -- same assistant, same brain
// (both call bot-core.ts's handleIncomingMessage), different channel.

const FORGE_ENDPOINT_BASE = `${SUPABASE_URL}/functions/v1/`;
const VISITOR_ID_STORAGE_KEY = 'agenticcore_visitor_id';
const MANAGER_TELEGRAM_URL = 'https://t.me/agenticcore_managers';

const SUGGESTIONS = [
  'I need a website for my business',
  'Set up my full business for $150',
  'I want a logo and brand kit',
  'What can Forge actually do?'
];

function getOrCreateVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
  }
  return id;
}

function appendMessage(logEl, role, text) {
  const row = document.createElement('div');
  row.className = `forge-msg-row ${role}`;

  const avatar = document.createElement('span');
  avatar.className = 'forge-msg-avatar';
  avatar.innerHTML = role === 'assistant'
    ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>'
    : 'Y';
  row.appendChild(avatar);

  const bubble = document.createElement('div');
  bubble.className = 'forge-msg-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);

  logEl.appendChild(row);
  return row;
}

function appendHandoffLink(logEl) {
  const link = document.createElement('a');
  link.href = MANAGER_TELEGRAM_URL;
  link.target = '_blank';
  link.rel = 'noopener';
  link.className = 'forge-handoff-link';
  link.textContent = 'Continue with a human on Telegram →';
  logEl.appendChild(link);
}

function appendTyping(logEl) {
  const row = document.createElement('div');
  row.className = 'forge-msg-row assistant';
  row.id = 'forgeTypingRow';
  row.innerHTML = `
    <span class="forge-msg-avatar"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg></span>
    <div class="forge-typing"><span></span><span></span><span></span></div>
  `;
  logEl.appendChild(row);
}

function removeTyping() {
  const el = document.getElementById('forgeTypingRow');
  if (el) el.remove();
}

(async () => {
  const logEl = document.getElementById('forgeLog');
  const scrollEl = document.getElementById('forgeScroll');
  const suggestionsEl = document.getElementById('forgeSuggestions');
  const errorEl = document.getElementById('forgeError');
  const form = document.getElementById('forgeForm');
  const input = document.getElementById('forgeInput');
  const sendBtn = document.getElementById('forgeSendBtn');
  const backBtn = document.getElementById('forgeBackBtn');

  const { data: { session } } = await supabaseClient.auth.getSession();
  const authed = !!session;

  backBtn.addEventListener('click', () => {
    window.location.href = authed ? 'dashboard.html' : 'index.html';
  });

  const greeting = "Hi, I'm Forge 👋 Tell me what your business needs — a website, a logo, marketing, bookkeeping, whatever — and I'll scope it out and get you a price.";

  async function callForge(action, message) {
    if (authed) {
      const resp = await fetch(`${FORGE_ENDPOINT_BASE}forge-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(action === 'history' ? { action: 'history' } : { action: 'message', message })
      });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || `Request failed (${resp.status})`);
      return resp.json();
    }

    const visitorId = getOrCreateVisitorId();
    const resp = await fetch(`${FORGE_ENDPOINT_BASE}widget-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        apikey: SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify(
        action === 'history'
          ? { visitorId, action: 'history' }
          : { visitorId, action: 'message', message, languageHint: navigator.language }
      )
    });
    if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).error || `Request failed (${resp.status})`);
    return resp.json();
  }

  function scrollToBottom() {
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function renderSuggestions() {
    suggestionsEl.innerHTML = '';
    SUGGESTIONS.forEach((s) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'forge-suggestion-chip';
      chip.textContent = s;
      chip.addEventListener('click', () => doSend(s));
      suggestionsEl.appendChild(chip);
    });
  }

  function clearSuggestions() {
    suggestionsEl.innerHTML = '';
  }

  let sending = false;
  async function doSend(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    clearSuggestions();
    appendMessage(logEl, 'user', trimmed);
    input.value = '';
    sending = true;
    input.disabled = true;
    sendBtn.disabled = true;
    errorEl.style.display = 'none';
    appendTyping(logEl);
    scrollToBottom();

    try {
      const { reply, needsHuman } = await callForge('message', trimmed);
      removeTyping();
      appendMessage(logEl, 'assistant', reply);
      if (needsHuman) appendHandoffLink(logEl);
    } catch (err) {
      removeTyping();
      errorEl.textContent = err.message || 'Something went wrong. Please try again.';
      errorEl.style.display = 'block';
    } finally {
      sending = false;
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
      scrollToBottom();
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    doSend(input.value);
  });

  try {
    const { messages } = await callForge('history');
    if (messages && messages.length) {
      messages.forEach((m) => appendMessage(logEl, m.role, m.content));
    } else {
      appendMessage(logEl, 'assistant', greeting);
      renderSuggestions();
    }
  } catch (err) {
    appendMessage(logEl, 'assistant', greeting);
    renderSuggestions();
  }

  scrollToBottom();
  input.focus();
})();
