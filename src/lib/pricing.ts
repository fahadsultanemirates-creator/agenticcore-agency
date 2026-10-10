import { categories, serviceById } from "../data/catalog";

/**
 * The deposit due to start a job: 30%, the split the site promises.
 *
 * The server computes the same figure from the request's own agreed_price
 * (supabase/functions/_shared/pricing.ts) and ITS figure is the one
 * quoted. This copy only decides what the page says while the invoice
 * opens, so the two can never disagree about what is actually owed.
 */
export const UPFRONT_FRACTION = 0.3;

export function upfrontAmountDue(agreedPrice: number): number {
  return Math.round(agreedPrice * UPFRONT_FRACTION * 100) / 100;
}

export function findCategory(id: string | null) {
  if (!id) return null;
  return categories.find((c) => c.id === id) ?? null;
}

/**
 * The display name for whatever requests.task_type holds.
 *
 * Rows written since the catalogue restructure store a service id
 * (AG-07). Rows written before it store the service NAME as the old
 * wizard wrote it ("Multi-page website (3-5 pages)"). Both have to
 * render, and an old order must keep reading as the thing that was
 * actually bought -- so an unrecognised value is shown as-is rather than
 * guessed at or hidden.
 */
export function taskTypeLabel(taskType: string | null): string {
  if (!taskType) return "Request";
  return serviceById(taskType)?.name ?? taskType;
}

/**
 * The category name as the database stores it.
 *
 * requests.service_category holds the human label the legacy wizard wrote
 * ("Websites", "Design & Media"), not an id, and there are rows with those
 * values already. Writing the id instead would split the history in two.
 */
export function categoryDbValue(label: string): string {
  return label;
}
