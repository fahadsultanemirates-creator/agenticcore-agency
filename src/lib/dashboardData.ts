import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * The rows the dashboard reads, loaded once per table.
 *
 * Row-level security does the filtering — every table below has a
 * select-own policy comparing auth.uid() to user_id — so there is no
 * .eq("user_id", …) here. Adding one would imply the server trusts the
 * client to ask only for its own rows, which it does not have to.
 *
 * The twelve-second abort is not decoration. A request that HANGS
 * neither resolves nor rejects, so without it `loading` stays true for
 * ever and `failed` never arrives: a permanent spinner on a paying
 * client's dashboard with no retry. That is what a flaky mobile
 * connection looks like.
 */
const QUERY_TIMEOUT_MS = 12_000;

export type Loaded<T> = {
  rows: T[];
  loading: boolean;
  failed: boolean;
  reload: () => void;
};

function useRows<T>(table: string, columns: string, order: string, ascending = false): Loaded<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);

    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setRows([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order(order, { ascending })
      .abortSignal(controller.signal);
    clearTimeout(timer);

    if (error) {
      console.error(`Loading ${table} failed:`, error.message);
      setFailed(true);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as T[]);
    setLoading(false);
  }, [table, columns, order, ascending]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, failed, reload: () => void load() };
}

export type OrderRow = {
  id: string;
  service_category: string;
  task_type: string | null;
  description: string | null;
  agreed_price: string | null;
  status: "draft" | "awaiting_payment" | "confirmed";
  attachment_path: string | null;
  created_at: string;
};

export const useOrders = () =>
  useRows<OrderRow>(
    "requests",
    "id, service_category, task_type, description, agreed_price, status, attachment_path, created_at",
    "created_at",
  );

export type InvoiceRow = {
  id: string;
  amount: string;
  points_used: string;
  payment_type: string;
  status: "pending" | "paid" | "refunded";
  paid_at: string | null;
  project_id: string | null;
  request_id: string | null;
};

export const useInvoices = () =>
  useRows<InvoiceRow>(
    "billing",
    "id, amount, points_used, payment_type, status, paid_at, project_id, request_id",
    "paid_at",
  );

export type MessageRow = {
  id: string;
  project_id: string;
  author: "client" | "team" | "system";
  body: string;
  read_at: string | null;
  created_at: string;
};

export const useMessages = () =>
  useRows<MessageRow>(
    "project_messages",
    "id, project_id, author, body, read_at, created_at",
    "created_at",
  );

export type DeliverableRow = {
  id: string;
  project_id: string;
  label: string;
  storage_path: string | null;
  url: string | null;
  size_bytes: number | null;
  content_type: string | null;
  notes: string | null;
  created_at: string;
};

export const useDeliverables = () =>
  useRows<DeliverableRow>(
    "project_deliverables",
    "id, project_id, label, storage_path, url, size_bytes, content_type, notes, created_at",
    "created_at",
  );

export type ProjectRow = {
  id: string;
  project_name: string | null;
  status: string;
  created_at: string;
};

export const useProjectList = () =>
  useRows<ProjectRow>("projects", "id, project_name, status, created_at", "created_at");

/** Posts as the client. The policy refuses any other author. */
export async function postMessage(projectId: string, body: string): Promise<string | null> {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) return "Your session expired — please sign in again.";

  const { error } = await supabase.from("project_messages").insert({
    project_id: projectId,
    user_id: userId,
    author: "client",
    body: body.trim(),
  });
  if (error) {
    console.error("postMessage failed:", error.message);
    return "Couldn't send that just now. Please try again.";
  }
  return null;
}

export async function markRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("project_messages")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids);
  if (error) console.error("markRead failed:", error.message);
}

/**
 * A short-lived link to a private deliverable.
 *
 * The bucket is not public, and it must not become public: these are
 * things a client has paid for and nobody else should be able to guess a
 * URL to. A signed URL expires, which is the point.
 */
export async function signedDeliverableUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("deliverables").createSignedUrl(path, 300);
  if (error) {
    console.error("signedDeliverableUrl failed:", error.message);
    return null;
  }
  return data?.signedUrl ?? null;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Awaiting scoping",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  in_progress: "In progress",
  awaiting_review: "Ready for your review",
  revision_requested: "Revision requested",
  delivered: "Delivered",
  approved: "Approved",
  pending: "Due",
  paid: "Paid",
  refunded: "Refunded",
};

/** "awaiting_review" is a column value, not something to show a client. */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}
