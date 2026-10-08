import { ArrowLeft, Loader2, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

// Forge, the full-page chat assistant.
//
// Works signed in or not: authenticated clients go through forge-chat
// (tied to their profile, persistent history), anonymous visitors through
// widget-chat (tied to a visitorId in localStorage). Same assistant, same
// brain -- both call bot-core's handleIncomingMessage -- different
// channel. Ported from public/forge.js.

const VISITOR_ID_STORAGE_KEY = "agenticcore_visitor_id";
const MANAGER_TELEGRAM_URL = "https://t.me/agenticcore_managers";

const SUGGESTIONS = [
  "I need a website for my business",
  "Set up my full business for $150",
  "I want a logo and brand kit",
  "What can Forge actually do?",
];

const GREETING =
  "Hi, I'm Forge 👋 Tell me what your business needs — a website, a logo, marketing, bookkeeping, whatever — and I'll scope it out and get you a price.";

type Message = { role: "user" | "assistant"; content: string };

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(VISITOR_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Private browsing refuses localStorage. A per-load id means no
    // history, which is better than no chat.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function Forge() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [needsHuman, setNeedsHuman] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const token = session?.access_token ?? null;

  const callForge = async (
    action: "history" | "message",
    message?: string
  ): Promise<{ reply?: string; messages?: Message[]; needsHuman?: boolean }> => {
    const endpoint = token ? "forge-chat" : "widget-chat";
    const body = token
      ? action === "history"
        ? { action: "history" }
        : { action: "message", message }
      : action === "history"
        ? { visitorId: visitorId(), action: "history" }
        : { visitorId: visitorId(), action: "message", message, languageHint: navigator.language };

    const { data, error: invokeError } = await supabase.functions.invoke(endpoint, {
      body,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    });

    if (invokeError) throw new Error(invokeError.message);
    return (data ?? {}) as { reply?: string; messages?: Message[]; needsHuman?: boolean };
  };

  // History once the session has resolved, so a signed-in client is not
  // handed the anonymous thread for a moment first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { messages: history } = await callForge("history");
        if (cancelled) return;
        setMessages(history?.length ? history : [{ role: "assistant", content: GREETING }]);
      } catch {
        if (!cancelled) setMessages([{ role: "assistant", content: GREETING }]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);
    setError("");

    try {
      const { reply, needsHuman: handoff } = await callForge("message", trimmed);
      setMessages((m) => [...m, { role: "assistant", content: reply ?? "" }]);
      if (handoff) setNeedsHuman(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const showSuggestions = loaded && messages.length <= 1;

  return (
    // h-dvh, not h-screen: 100vh counts the space behind a mobile browser's
    // URL bar, which pushed the composer off the bottom of the screen.
    <div className="flex h-dvh flex-col bg-void">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <Link
          to={user ? "/dashboard" : "/"}
          aria-label={user ? "Back to dashboard" : "Back to home"}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-sm font-semibold text-fg-muted transition-colors hover:border-yellow-400/50 hover:text-fg sm:px-3.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{user ? "Dashboard" : "Home"}</span>
        </Link>
        <Link to="/" aria-label="Home" className="min-w-0 shrink-0">
          <Logo compact />
        </Link>
        <span className="ml-auto flex items-center gap-1.5 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-400">
          <Sparkles className="h-3.5 w-3.5" />
          Forge
        </span>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "self-end bg-yellow-400 text-void"
                  : "self-start border border-border bg-surface text-fg"
              }`}
            >
              {m.content}
            </div>
          ))}

          {sending && (
            <div className="self-start rounded-2xl border border-border bg-surface px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-fg-faint" />
            </div>
          )}

          {needsHuman && (
            <a
              href={MANAGER_TELEGRAM_URL}
              target="_blank"
              rel="noopener"
              className="self-start rounded-xl border border-yellow-400/30 bg-yellow-400/5 px-4 py-3 text-sm text-fg-muted hover:border-yellow-400/60"
            >
              This one needs a person —{" "}
              <span className="font-semibold text-yellow-400">talk to a manager on Telegram →</span>
            </a>
          )}

          {error && <p className="self-start text-sm text-orange-300">{error}</p>}

          {showSuggestions && (
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-full border border-border bg-surface px-3.5 py-2 text-xs text-fg-muted transition-colors hover:border-yellow-400/50 hover:text-fg"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* The composer is its own flex row rather than an absolutely
          positioned bar, which is what hid the send button under the
          keyboard on a phone. */}
      <form
        onSubmit={onSubmit}
        className="shrink-0 border-t border-border px-4 py-3 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Tell Forge what you need…"
            className="min-w-0 flex-1 rounded-full border-2 border-border bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-fg-faint focus:border-yellow-400 focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-void transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
