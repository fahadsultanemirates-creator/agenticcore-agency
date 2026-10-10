// What each status in the requests and projects tables means to a client.
//
// Ported verbatim from the legacy pages, which each kept their own copy of
// this map. The database writes these values; nothing here may invent one,
// so an unknown status falls through as itself rather than as "Unknown" --
// a raw value on screen is a bug report, "Unknown" is a mystery.
export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  awaiting_payment: "Awaiting payment",
  confirmed: "Confirmed",
  in_progress: "In progress",
  awaiting_review: "Awaiting your review",
  revision_requested: "Revision requested",
  delivered: "Delivered",
  approved: "Approved — awaiting final payment",
  pending: "Pending",
  paid: "Paid",
  refunded: "Refunded",
};

/** Colour by what the client should feel: done, waiting, or needs them. */
const TONE: Record<string, string> = {
  delivered: "border-cyan-400/40 bg-cyan-400/10 text-cyan-400",
  approved: "border-cyan-400/40 bg-cyan-400/10 text-cyan-400",
  paid: "border-cyan-400/40 bg-cyan-400/10 text-cyan-400",
  confirmed: "border-cyan-400/30 bg-cyan-400/5 text-cyan-300",
  awaiting_review: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  revision_requested: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  awaiting_payment: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  refunded: "border-red-400/40 bg-red-400/10 text-red-300",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function statusClass(status: string): string {
  return TONE[status] ?? "border-border bg-surface-2 text-fg-muted";
}
