// AgenticCore Agency — floating "Maya" launcher for marketing pages.
// Maya itself lives on its own full page (/maya, works both signed
// in and anonymous) -- this is just the floating entry point into it, not
// a popover with its own chat logic.

(function initChatWidgetLauncher() {
  const wrap = document.createElement('div');
  wrap.className = 'chat-widget';
  wrap.innerHTML = `
    <a href="/maya" class="chat-widget-toggle" aria-label="Chat with Maya">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>
      <span>Maya</span>
    </a>
  `;
  document.body.appendChild(wrap);
})();
