import { ArrowLeft, Download, ExternalLink, FolderOpen, MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardNav } from "../components/dashboard/DashboardNav";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import {
  formatBytes,
  markRead,
  postMessage,
  signedDeliverableUrl,
  statusLabel,
  useDeliverables,
  useMessages,
  useProjectList,
  type DeliverableRow,
} from "../lib/dashboardData";
import { NotFound } from "./NotFound";

/**
 * One project, with everything attached to it in one place.
 *
 * The projects list could only ever say what state a project was in.
 * Where it stands, what has been said about it and what has been handed
 * over were three different answers in three different places, or in no
 * place at all. This is the one screen a client opens to ask "what is
 * happening with my thing".
 *
 * The status rail is the schema's real statuses, not the brief's longer
 * flow: projects.status allows in_progress, awaiting_review,
 * revision_requested, delivered and approved, and drawing stages the
 * database cannot hold would be a progress bar that never moves.
 */
const STAGES = ["in_progress", "awaiting_review", "delivered", "approved"] as const;

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projects = useProjectList();
  const messages = useMessages();
  const deliverables = useDeliverables();

  const project = projects.rows.find((p) => p.id === id);

  const thread = useMemo(
    () => messages.rows.filter((m) => m.project_id === id),
    [messages.rows, id],
  );
  const files = useMemo(
    () => deliverables.rows.filter((d) => d.project_id === id),
    [deliverables.rows, id],
  );

  // Only the other side's unread messages. Marking your own read is
  // meaningless and would churn rows on every visit.
  const unreadIds = thread.filter((m) => m.author !== "client" && !m.read_at).map((m) => m.id);
  const unreadKey = unreadIds.join(",");
  useEffect(() => {
    if (!unreadKey) return;
    void markRead(unreadKey.split(",")).then(() => messages.reload());
    // Keyed on the ids rather than the array: re-running on every render
    // would mark, reload, re-render and mark again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadKey]);

  if (projects.loading) {
    return (
      <DashboardShell title="Project" backTo="/projects" backLabel="Projects">
        <DashboardNav />
        <p className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-fg-faint">
          Loading…
        </p>
      </DashboardShell>
    );
  }

  // Three reasons this page might have no project, and they are not
  // interchangeable. Treating a failed load as "not found" is how a page
  // ends up telling a paying client their project does not exist.
  if (projects.failed) {
    return (
      <DashboardShell title="Project" backTo="/projects" backLabel="Projects">
        <DashboardNav />
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface p-6">
          <p className="text-sm text-fg-muted">We couldn't load this project just now.</p>
          <button
            type="button"
            onClick={projects.reload}
            className="mt-3 text-sm font-semibold text-cyan-400 hover:underline"
          >
            Try again
          </button>
        </div>
      </DashboardShell>
    );
  }

  if (!project) return <NotFound />;

  const stageIndex = STAGES.indexOf(project.status as (typeof STAGES)[number]);

  return (
    <DashboardShell
      title={project.project_name ?? "Project"}
      backTo="/projects"
      backLabel="Projects"
    >
      <DashboardNav />
      <section className="py-8">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" /> All projects
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">
              {project.project_name ?? "Project"}
            </h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              Opened {new Date(project.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-bold tracking-wide text-cyan-400 uppercase">
            {statusLabel(project.status)}
          </span>
        </div>

        {/* revision_requested is a real status and deliberately not a
            stage: it is a loop back, not a step forward, so it shows as
            a note rather than moving the rail backwards. */}
        {project.status === "revision_requested" ? (
          <p className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/5 px-4 py-3 text-sm text-fg-muted">
            A revision is in progress. The stages below resume once it comes back for review.
          </p>
        ) : (
          <ol className="mt-6 flex flex-wrap gap-2">
            {STAGES.map((stage, i) => (
              <li
                key={stage}
                className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-xs font-semibold ${
                  i <= stageIndex
                    ? "border-cyan-400 bg-cyan-400/5 text-cyan-400"
                    : "border-border text-fg-faint"
                }`}
              >
                {statusLabel(stage)}
              </li>
            ))}
          </ol>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_20rem]">
          <Thread
            projectId={project.id}
            messages={thread}
            loading={messages.loading}
            onSent={messages.reload}
          />

          <aside>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-fg">
              <FolderOpen className="h-4 w-4 text-cyan-400" /> Deliverables
            </h2>
            {deliverables.loading ? (
              <p className="mt-3 text-sm text-fg-faint">Loading…</p>
            ) : files.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">
                Nothing handed over yet. Finished work appears here.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {files.map((file) => (
                  <li key={file.id}>
                    <DeliverableRowItem item={file} />
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>
    </DashboardShell>
  );
}

function DeliverableRowItem({ item }: { item: DeliverableRow }) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    if (!item.storage_path) return;
    setBusy(true);
    const url = await signedDeliverableUrl(item.storage_path);
    setBusy(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const shared =
    "flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface p-3 text-left text-sm transition-colors hover:border-cyan-400/50";

  const body = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10">
        {item.url ? (
          <ExternalLink className="h-4 w-4 text-cyan-400" />
        ) : (
          <Download className="h-4 w-4 text-cyan-400" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-fg">{item.label}</span>
        <span className="block text-xs text-fg-faint">
          {item.url ? "Open link" : busy ? "Preparing…" : formatBytes(item.size_bytes) || "Download"}
        </span>
      </span>
    </>
  );

  return item.url ? (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className={shared}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={() => void open()} disabled={busy} className={shared}>
      {body}
    </button>
  );
}

function Thread({
  projectId,
  messages,
  loading,
  onSent,
}: {
  projectId: string;
  messages: { id: string; author: string; body: string; created_at: string }[];
  loading: boolean;
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
    <div>
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-fg">
        <MessageSquare className="h-4 w-4 text-cyan-400" /> Updates
      </h2>

      <div className="mt-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        {loading ? (
          <p className="py-6 text-center text-sm text-fg-faint">Loading…</p>
        ) : messages.length === 0 ? (
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
            className="inline-flex self-start items-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
