import {
  Check,
  FolderOpen,
  Link2,
  Link2Off,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { useAuth } from "../context/AuthContext";
import { taskTypeLabel } from "../lib/pricing";
import { shortDate } from "../lib/format";
import { supabase } from "../lib/supabase";
import { statusClass, statusLabel } from "../lib/status";

const FREE_REVISIONS = 2;

type RequestRow = {
  id: string;
  service_category: string;
  task_type: string | null;
  status: string;
  created_at: string;
};

type ProjectRow = {
  id: string;
  project_name: string | null;
  project_group: string | null;
  status: string;
  revisions_used: number;
  is_shared: boolean;
  share_token: string | null;
  created_at: string;
};

export function Projects() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    try {
      const [{ data: req }, { data: proj }] = await Promise.all([
        supabase
          .from("requests")
          .select("id, service_category, task_type, status, created_at")
          .eq("user_id", user.id)
          .in("status", ["draft", "awaiting_payment"])
          .order("created_at", { ascending: false }),
        supabase
          .from("projects")
          .select("id, project_name, project_group, status, revisions_used, is_shared, share_token, created_at")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);

      setRequests(req ?? []);
      setProjects(proj ?? []);
    } catch (err) {
      // Both lists render "Loading…" while null, so a request that never
      // resolves leaves the page looking like it is still working.
      console.error("Could not load projects", err);
      setRequests([]);
      setProjects([]);
      setError("Couldn't load your projects just now — reload the page to try again.");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Every action is an RPC, so the rules live in the database. */
  const call = async (key: string, fn: string, args: Record<string, unknown>) => {
    setBusy(key);
    setError("");
    const { error: rpcError } = await supabase.rpc(fn, args);
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return false;
    }
    await load();
    return true;
  };

  // Grouped the way the legacy page grouped them, so a client who has
  // already sorted their work into folders finds it where they left it.
  const groups = new Map<string, ProjectRow[]>();
  (projects ?? []).forEach((p) => {
    const key = p.project_group || "Unsorted";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  });

  return (
    <DashboardShell title="Your projects">
      <section className="py-10">
        <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">Your projects</h1>
        <p className="mt-2 text-sm text-fg-muted">
          Everything you've ordered, and everything we're working on.
        </p>

        {error && (
          <p className="mt-4 rounded-xl border border-orange-400/30 bg-orange-400/5 px-4 py-3 text-sm text-orange-300">
            {error}
          </p>
        )}

        {/* ---- not paid for yet ---- */}
        <h2 className="mt-8 mb-3 font-display text-lg font-semibold text-fg">Awaiting payment</h2>
        {requests === null ? (
          <p className="text-sm text-fg-faint">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-5 text-sm text-fg-faint">
            Nothing waiting on payment.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">
                    {/* Through taskTypeLabel, not raw. Requests placed since the
                        catalogue restructure store a service id, so printing
                        the column would show a customer "AG-01" where the
                        service name belongs. Older rows hold the name and
                        come back unchanged. */}
                    {r.task_type ? taskTypeLabel(r.task_type) : r.service_category}
                  </p>
                  <p className="text-xs text-fg-faint">Submitted {shortDate(r.created_at)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(r.status)}`}
                >
                  {statusLabel(r.status)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ---- live work ---- */}
        <h2 className="mt-10 mb-3 font-display text-lg font-semibold text-fg">In progress</h2>
        {projects === null ? (
          <p className="text-sm text-fg-faint">Loading…</p>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface px-4 py-8 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-fg-faint" />
            <p className="mt-3 text-sm text-fg-muted">No projects yet.</p>
            <Link
              to="/dashboard"
              className="mt-4 inline-flex rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-void"
            >
              Place a request
            </Link>
          </div>
        ) : (
          [...groups.entries()].map(([groupName, groupProjects]) => (
            <div key={groupName} className="mb-6">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-fg-muted">{groupName}</h3>
                <span className="text-xs text-fg-faint">
                  {groupProjects.length} project{groupProjects.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {groupProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} busy={busy} call={call} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </DashboardShell>
  );
}

function ProjectCard({
  project: p,
  busy,
  call,
}: {
  project: ProjectRow;
  busy: string | null;
  call: (key: string, fn: string, args: Record<string, unknown>) => Promise<boolean>;
}) {
  const [copied, setCopied] = useState(false);
  const deliverable = p.status === "delivered" || p.status === "awaiting_review";
  const revisionsLeft = FREE_REVISIONS - p.revisions_used;

  const share = async () => {
    let token = p.share_token;
    if (!p.is_shared) {
      const { data, error } = await supabase.rpc("set_project_shared", {
        p_project_id: p.id,
        p_shared: true,
      });
      if (error) return;
      token = (data as { share_token?: string })?.share_token ?? token;
    }
    if (!token) return;
    // The legacy viewer URL, not a tidier one. project-view.html is
    // still the page that renders a shared project, and links already
    // sent to clients point at it -- inventing /p/<token> here would
    // break every one of them.
    const link = `${window.location.origin}/project-view.html?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused — the link is still live, it just has to be
      // fetched again from the Share button.
    }
    await call(`share:${p.id}`, "set_project_shared", { p_project_id: p.id, p_shared: true });
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{p.project_name || "Untitled project"}</p>
          <p className="text-xs text-fg-faint">Started {shortDate(p.created_at)}</p>
          <p className="mt-0.5 text-xs text-fg-faint">
            {p.revisions_used} / {FREE_REVISIONS} free revisions used
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(p.status)}`}
        >
          {statusLabel(p.status)}
        </span>
      </div>

      {deliverable && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          {revisionsLeft > 0 ? (
            <button
              type="button"
              disabled={busy === `rev:${p.id}`}
              onClick={() => call(`rev:${p.id}`, "request_project_revision", { p_project_id: p.id })}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-border px-3.5 py-2 text-xs font-semibold text-fg-muted transition-colors hover:border-cyan-400/50 hover:text-fg disabled:opacity-60"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Request revision
            </button>
          ) : (
            <p className="text-xs text-fg-faint">
              No free revisions left — further changes are billed separately.
            </p>
          )}
          <button
            type="button"
            disabled={busy === `approve:${p.id}`}
            onClick={() => {
              if (
                window.confirm(
                  "Approve this delivery? This starts the final payment — 70% of the agreed price."
                )
              ) {
                void call(`approve:${p.id}`, "approve_project_delivery", { p_project_id: p.id });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-void transition-transform hover:-translate-y-0.5 disabled:opacity-60"
          >
            <Check className="h-3.5 w-3.5" />
            Approve &amp; pay remaining
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
        <SmallAction
          icon={Pencil}
          label="Rename"
          onClick={() => {
            const name = window.prompt("Name this project:", p.project_name ?? "");
            if (name === null) return;
            void call(`name:${p.id}`, "rename_project", { p_project_id: p.id, p_name: name });
          }}
        />
        <SmallAction
          icon={FolderOpen}
          label="Move"
          onClick={() => {
            const group = window.prompt(
              "Move to which group? (leave blank for Unsorted)",
              p.project_group ?? ""
            );
            if (group === null) return;
            void call(`move:${p.id}`, "move_project_group", { p_project_id: p.id, p_group: group });
          }}
        />
        <SmallAction
          icon={Link2}
          label={copied ? "Copied" : p.is_shared ? "Copy link" : "Share"}
          onClick={share}
        />
        {p.is_shared && (
          <SmallAction
            icon={Link2Off}
            label="Unshare"
            onClick={() => {
              if (!window.confirm("Stop sharing this project? The old link stops working.")) return;
              void call(`unshare:${p.id}`, "set_project_shared", {
                p_project_id: p.id,
                p_shared: false,
              });
            }}
          />
        )}
        <SmallAction
          icon={Trash2}
          label="Delete"
          danger
          onClick={() => {
            if (!window.confirm(`Delete "${p.project_name || "Untitled project"}"?`)) return;
            void call(`del:${p.id}`, "soft_delete_project", { p_project_id: p.id });
          }}
        />
      </div>
    </div>
  );
}

function SmallAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors ${
        danger
          ? "text-fg-faint hover:bg-red-400/10 hover:text-red-300"
          : "text-fg-faint hover:bg-surface-2 hover:text-fg"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
