import { MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { DashboardNav } from "../components/dashboard/DashboardNav";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { Panel } from "../components/dashboard/Panel";
import {
  markRead,
  postMessage,
  useMessages,
  useProjectList,
  type MessageRow,
} from "../lib/dashboardData";

/**
 * One thread per project.
 *
 * Before this there was no thread at all: a client found out that work
 * had moved by noticing the status had changed, or by being told in
 * Telegram — outside the product, unlogged, and invisible to anyone who
 * came here to ask what was happening.
 *
 * A client can post and can mark read. They cannot edit, and they cannot
 * post as the team: the insert policy pins author to 'client', and a
 * trigger freezes body and author on update. A record both sides rely on
 * is one neither can quietly rewrite.
 */
export function Messages() {
  const messages = useMessages();
  const projects = useProjectList();
  const [active, setActive] = useState<string | null>(null);

  const byProject = useMemo(() => {
    const map = new Map<string, MessageRow[]>();
    for (const m of messages.rows) {
      const list = map.get(m.project_id) ?? [];
      list.push(m);
      map.set(m.project_id, list);
    }
    return map;
  }, [messages.rows]);

  // Default to whichever project has unread messages, else the newest.
  useEffect(() => {
    if (active || projects.rows.length === 0) return;
    const withUnread = messages.rows.find((m) => m.author !== "client" && !m.read_at);
    setActive(withUnread?.project_id ?? projects.rows[0].id);
  }, [active, projects.rows, messages.rows]);

  const thread = active ? (byProject.get(active) ?? []) : [];

  // Mark the open thread read. Only the other side's messages count —
  // marking your own read is meaningless and would churn rows.
  useEffect(() => {
    const unread = thread.filter((m) => m.author !== "client" && !m.read_at).map((m) => m.id);
    if (unread.length === 0) return;
    void markRead(unread).then(() => messages.reload());
    // Intentionally keyed on the ids, not the array: re-running on every
    // render would mark, reload, re-render, mark again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.map((m) => m.id).join(",")]);

  return (
    <DashboardShell title="Messages">
      <DashboardNav />
      <section className="py-8">
        <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">
          Messages &amp; Updates
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Everything said about a project, kept with the project.
        </p>

        <Panel
          loading={messages.loading || projects.loading}
          failed={messages.failed || projects.failed}
          reload={() => {
            messages.reload();
            projects.reload();
          }}
          empty={projects.rows.length === 0}
          emptyIcon={MessageSquare}
          emptyText={
            <>
              No projects yet, so there is nothing to discuss.{" "}
              <Link to="/services" className="font-semibold text-cyan-400 hover:underline">
                Start one
              </Link>{" "}
              and this is where updates will appear.
            </>
          }
        >
          <div className="mt-6 grid gap-5 lg:grid-cols-[16rem_1fr]">
            <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              {projects.rows.map((project) => {
                const unread = (byProject.get(project.id) ?? []).filter(
                  (m) => m.author !== "client" && !m.read_at,
                ).length;
                return (
                  <li key={project.id} className="shrink-0 lg:shrink">
                    <button
                      type="button"
                      onClick={() => setActive(project.id)}
                      aria-pressed={active === project.id}
                      className={`flex w-full items-center gap-2 rounded-xl border-2 px-3.5 py-2.5 text-left text-sm font-medium whitespace-nowrap transition-colors lg:whitespace-normal ${
                        active === project.id
                          ? "border-cyan-400 bg-cyan-400/5 text-fg"
                          : "border-border text-fg-muted hover:border-cyan-400/50"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {project.project_name ?? "Project"}
                      </span>
                      {unread > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-400 px-1.5 text-[11px] font-bold text-void">
                          {unread}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            {active ? <Thread projectId={active} messages={thread} onSent={messages.reload} /> : null}
          </div>
        </Panel>
      </section>
    </DashboardShell>
  );
}

function Thread({
  projectId,
  messages,
  onSent,
}: {
  projectId: string;
  messages: MessageRow[];
  onSent: () => void;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const failure = await postMessage(projectId, body);
    setSending(false);
    if (failure) {
      setError(failure);
      return;
    }
    setError("");
    setBody("");
    onSent();
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      {messages.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-faint">
          Nothing here yet. Ask anything about this project and it stays on the record.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                message.author === "client"
                  ? "ml-auto bg-cyan-400/10 text-fg"
                  : message.author === "system"
                    ? "mx-auto bg-transparent text-center text-xs text-fg-faint"
                    : "bg-surface-2 text-fg"
              }`}
            >
              {message.author !== "system" ? (
                <p className="mb-0.5 text-[11px] font-semibold tracking-wide text-fg-faint uppercase">
                  {message.author === "client" ? "You" : "AgenticCore"}
                </p>
              ) : null}
              <p className="text-sm whitespace-pre-wrap">{message.body}</p>
              <p className="mt-1 text-[11px] text-fg-faint">
                {new Date(message.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ol>
      )}

      <form onSubmit={send} className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Ask a question or add something we should know…"
          className="w-full rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-sm text-fg placeholder:text-fg-faint focus:border-cyan-400 focus:outline-none"
        />
        {error ? <p className="text-sm text-cyan-300">{error}</p> : null}
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="self-start inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send"}
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
