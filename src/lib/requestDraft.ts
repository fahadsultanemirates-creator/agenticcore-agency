/**
 * A request in progress, held across the sign-in detour.
 *
 * /request used to sit behind RequireAuth, so "Start Your Project" -- the
 * primary CTA, and the destination of paid traffic -- bounced anyone not
 * already signed in to a login form before they had seen what they were
 * signing up for. The page is public now, and authentication happens at
 * submit instead, which means whatever they typed has to survive the trip.
 *
 * localStorage rather than sessionStorage: if email confirmation is on, the
 * visitor comes back by clicking a link in their mail client, which usually
 * opens a NEW TAB. A sessionStorage draft would be gone exactly when it was
 * most needed. The trade is that a brief outlives the tab, so it carries an
 * expiry and is cleared the moment it is used.
 *
 * A File cannot be serialised, so an attachment does not survive. The page
 * says so rather than silently dropping it.
 */

const KEY = "agency:request-draft";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type RequestDraft = {
  /** Catalogue id of the service or package, whichever was chosen. */
  chosenId: string;
  description: string;
  /** True if a file was attached before the detour, so the page can say so. */
  hadAttachment: boolean;
  savedAt: number;
};

export function saveRequestDraft(draft: Omit<RequestDraft, "savedAt">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Private browsing, blocked site data, a full quota. Losing the draft is
    // a worse experience, not a broken one -- never let it break submit.
  }
}

/**
 * The stored draft, or null.
 *
 * Returns null for anything that is not a well-formed, unexpired draft, and
 * clears what it rejected. This parses data that has been sitting in a
 * browser we do not control, so every field is checked rather than trusted.
 */
export function loadRequestDraft(): RequestDraft | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) throw new Error("not an object");

    const { chosenId, description, hadAttachment, savedAt } = parsed as Record<string, unknown>;
    if (typeof chosenId !== "string" || chosenId.length === 0) throw new Error("chosenId");
    if (typeof description !== "string") throw new Error("description");
    if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) throw new Error("savedAt");
    if (Date.now() - savedAt > MAX_AGE_MS) throw new Error("expired");

    return {
      chosenId,
      description,
      hadAttachment: hadAttachment === true,
      savedAt,
    };
  } catch {
    clearRequestDraft();
    return null;
  }
}

export function clearRequestDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing useful to do; the expiry above is the backstop.
  }
}
