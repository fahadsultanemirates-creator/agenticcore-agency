// AgenticCore Agency — homepage chat widget. Deliberately dependency-free
// (no supabase-js SDK load on the marketing homepage for one endpoint) --
// just a fetch() call authenticated with the same publishable anon key
// already used in supabase-client.js. That key is safe for browser use by
// design (security is enforced by RLS/the Edge Function itself, not by
// hiding this key) -- duplicated here rather than pulling in the SDK.
// Keep these two values in sync with supabase-client.js if they change.
const CHAT_SUPABASE_URL = 'https://ggyphnbnndfuxgkoakhs.supabase.co';
const CHAT_SUPABASE_ANON_KEY = 'sb_publishable_pVkYZGfKJdn_iIGHy1SaHQ_-QaR3iYw';
const CHAT_ENDPOINT = `${CHAT_SUPABASE_URL}/functions/v1/widget-chat`;
const MANAGER_TELEGRAM_URL = 'https://t.me/agenticcore_managers';
const VISITOR_ID_STORAGE_KEY = 'agenticcore_visitor_id';

function getOrCreateVisitorId() {
  let id = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
  }
  return id;
}

async function callWidgetChat(payload) {
  const resp = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${CHAT_SUPABASE_ANON_KEY}`,
      apikey: CHAT_SUPABASE_ANON_KEY
    },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

function buildWidgetMarkup() {
  const wrap = document.createElement('div');
  wrap.className = 'chat-widget';
  wrap.innerHTML = `
    <button type="button" class="chat-widget-toggle" id="chatWidgetToggle" aria-label="Chat with Forge" aria-expanded="false">
      <svg class="chat-widget-icon-open" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>
      <svg class="chat-widget-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      <span class="chat-widget-toggle-label" id="chatWidgetToggleLabel">Forge</span>
    </button>
    <div class="chat-widget-panel" id="chatWidgetPanel" hidden>
      <div class="chat-widget-header">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>
        <span>Forge</span>
        <button type="button" class="chat-widget-panel-close" id="chatWidgetPanelClose" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="chat-widget-messages" id="chatWidgetMessages" aria-live="polite"></div>
      <form class="chat-widget-form" id="chatWidgetForm">
        <input type="text" id="chatWidgetInput" class="chat-widget-input" placeholder="Tell Forge what you need, or ask a question…" autocomplete="off" maxlength="4000">
        <button type="submit" class="chat-widget-send" id="chatWidgetSend" aria-label="Send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </form>
    </div>
  `;
  return wrap;
}

function appendMessage(container, role, text) {
  const el = document.createElement('div');
  el.className = `chat-widget-message chat-widget-message-${role}`;
  el.textContent = text;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  return el;
}

function appendHandoffLink(container) {
  const el = document.createElement('a');
  el.href = MANAGER_TELEGRAM_URL;
  el.target = '_blank';
  el.rel = 'noopener';
  el.className = 'chat-widget-handoff-link';
  el.textContent = 'Continue with a human on Telegram →';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function appendTypingIndicator(container) {
  const el = document.createElement('div');
  el.className = 'chat-widget-message chat-widget-message-assistant chat-widget-typing';
  el.id = 'chatWidgetTyping';
  el.innerHTML = '<span></span><span></span><span></span>';
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('chatWidgetTyping');
  if (el) el.remove();
}

(function initChatWidget() {
  const visitorId = getOrCreateVisitorId();
  const widgetEl = buildWidgetMarkup();
  document.body.appendChild(widgetEl);

  const toggleBtn = document.getElementById('chatWidgetToggle');
  const toggleLabel = document.getElementById('chatWidgetToggleLabel');
  const panel = document.getElementById('chatWidgetPanel');
  const panelCloseBtn = document.getElementById('chatWidgetPanelClose');
  const messagesEl = document.getElementById('chatWidgetMessages');
  const form = document.getElementById('chatWidgetForm');
  const input = document.getElementById('chatWidgetInput');

  let historyLoaded = false;
  let sending = false;

  async function openPanel() {
    panel.hidden = false;
    toggleBtn.classList.add('is-open');
    toggleBtn.setAttribute('aria-expanded', 'true');
    toggleBtn.setAttribute('aria-label', 'Close Forge chat');
    toggleLabel.textContent = 'Close';

    if (!historyLoaded) {
      historyLoaded = true;
      try {
        const { messages } = await callWidgetChat({ visitorId, action: 'history' });
        if (messages && messages.length) {
          messages.forEach((m) => appendMessage(messagesEl, m.role, m.content));
        } else {
          appendMessage(messagesEl, 'assistant', "Hi, I'm Forge 👋 Tell me what your business needs — a website, a logo, marketing, bookkeeping, whatever — and I'll scope it out and get you a price.");
        }
      } catch (e) {
        appendMessage(messagesEl, 'assistant', "Hi, I'm Forge 👋 Tell me what your business needs — a website, a logo, marketing, bookkeeping, whatever — and I'll scope it out and get you a price.");
      }
    }
    input.focus();
  }

  function closePanel() {
    panel.hidden = true;
    toggleBtn.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-label', 'Chat with Forge');
    toggleLabel.textContent = 'Forge';
  }

  toggleBtn.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  panelCloseBtn.addEventListener('click', closePanel);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) closePanel();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || sending) return;

    appendMessage(messagesEl, 'user', text);
    input.value = '';
    sending = true;
    input.disabled = true;
    appendTypingIndicator(messagesEl);

    try {
      const { reply, needsHuman } = await callWidgetChat({
        visitorId,
        action: 'message',
        message: text,
        languageHint: navigator.language
      });
      removeTypingIndicator();
      appendMessage(messagesEl, 'assistant', reply);
      if (needsHuman) appendHandoffLink(messagesEl);
    } catch (err) {
      removeTypingIndicator();
      appendMessage(messagesEl, 'assistant', 'Something went wrong on our end. Please try again in a moment, or reach out directly on Telegram.');
      appendHandoffLink(messagesEl);
    } finally {
      sending = false;
      input.disabled = false;
      input.focus();
    }
  });
})();
