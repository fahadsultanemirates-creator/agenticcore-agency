import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';

/* ── Root-relative — do NOT prefix with BASE_URL (it's already /api/...) ── */
const CHAT_API = '/api/agency/ai/chat';
const TELEGRAM_URL = 'https://t.me/agenticcore';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME: Message = {
  role: 'assistant',
  content:
    "Hi! I'm the AgenticCore assistant. Ask me anything about our services, AI agents, pricing, or how to get started.",
};

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.665 4.302C21.14 4.109 21.603 4.55 21.44 5.035L17.514 16.69C17.301 17.32 16.591 17.552 16.037 17.168L11.597 14.097L9.586 16.326C9.379 16.555 9.007 16.486 8.86 16.195L7.338 13.198L3.438 11.906C2.869 11.717 2.86 10.907 3.424 10.704L20.665 4.302Z" />
    </svg>
  );
}

const GRAD = 'linear-gradient(135deg, hsl(250,100%,58%), hsl(320,100%,55%))';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages([...next, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let reply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(part.slice(6));
            if (json.content) {
              reply += json.content;
              setMessages([...next, { role: 'assistant', content: reply }]);
            }
          } catch {}
        }
      }
      if (!reply) throw new Error('empty');
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Sorry, I could not reach the server. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Outer stack — bottom-right with generous margin so it doesn't clip on mobile */
    <div className="fixed bottom-5 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">

      {/* ── Chat panel ── */}
      {open && (
        <div
          className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          style={{
            width: 'min(360px, calc(100vw - 2rem))',
            maxHeight: 'min(500px, calc(100vh - 120px))',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: GRAD }}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">AgenticCore Assistant</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                <p className="text-xs text-white/80">Online · AI Support</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full flex-shrink-0 mr-2 mt-0.5 flex items-center justify-center" style={{ background: GRAD }}>
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                  }`}
                  style={m.role === 'user' ? { background: GRAD } : {}}
                >
                  {m.content || (loading && i === messages.length - 1 ? (
                    <span className="inline-flex items-center gap-1 py-0.5">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                    </span>
                  ) : '')}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-3 bg-white border-t border-slate-200 flex gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Type a message…"
              disabled={loading}
              className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 transition-all"
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0 transition-opacity hover:opacity-90"
              style={{ background: GRAD }}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Telegram button ── */}
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Join us on Telegram"
        title="Chat on Telegram"
        className="group relative w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
        style={{ background: '#229ED9' }}
      >
        <TelegramIcon />
        <span className="absolute right-12 bg-slate-800 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          Telegram
        </span>
      </a>

      {/* ── AI chat toggle ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-13 h-13 rounded-full text-white shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        style={{ background: GRAD, width: '52px', height: '52px' }}
        aria-label="Open AI chat"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>
    </div>
  );
}
