// The parts of owner-alert that are worth testing, kept free of Deno so
// a plain `node --experimental-strip-types` can import them.
//
// index.ts is then only environment, HTTP and Telegram -- the bits a
// unit test could not meaningfully reach anyway.

export type AlertPayload = {
  event?: unknown;
  id?: unknown;
  fields?: Record<string, unknown>;
};

export const MAX_TELEGRAM_MESSAGE_LENGTH = 4000;

/**
 * Constant-time comparison.
 *
 * A plain === leaks the secret one character at a time to anyone
 * willing to measure the response. Length is compared first because the
 * length is not itself the secret.
 */
export function secretsMatch(provided: string, expected: string): boolean {
  if (expected.length === 0) return false; // unset means refuse, never allow
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Trim and bound anything that came out of the database. */
function str(value: unknown, max = 300): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function money(value: unknown): string {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : str(value);
}

/**
 * The wording lives here, not in the trigger, so changing what an alert
 * says is a code review rather than a migration.
 *
 * An unrecognised event is reported rather than dropped: a new trigger
 * nobody taught this function about should still reach the owner, badly
 * formatted, instead of vanishing.
 */
export function formatAlert(payload: AlertPayload): { title: string; body: string[] } {
  const event = str(payload.event, 60);
  const f = payload.fields ?? {};

  switch (event) {
    case 'request.created':
      return {
        title: '🟠 New order',
        body: [
          `Service   ${str(f.task_type) || str(f.service_category) || 'not stated'}`,
          `Price     ${f.agreed_price === null || f.agreed_price === undefined ? 'not quoted yet' : money(f.agreed_price)}`,
          `Status    ${str(f.status) || 'unknown'}`,
          str(f.description) ? `\n${str(f.description, 600)}` : '',
        ],
      };
    case 'billing.created':
      return {
        title: '🧾 Invoice raised',
        body: [`Amount    ${money(f.amount)}`, `Type      ${str(f.payment_type)}`, `Status    ${str(f.status)}`],
      };
    case 'billing.paid':
      return { title: '💵 Payment marked paid', body: [`Amount    ${money(f.amount)}`, `Type      ${str(f.payment_type)}`] };
    case 'project.created':
      return { title: '📁 Project opened', body: [`Name      ${str(f.project_name)}`, `Status    ${str(f.status)}`] };
    case 'project.status':
      return {
        title: '🔄 Project status changed',
        body: [`Name      ${str(f.project_name)}`, `${str(f.old_status)} → ${str(f.status)}`],
      };
    case 'profile.created':
      return { title: '👤 New signup', body: [str(f.full_name) || str(f.company_name) || 'no name given'] };
    case 'subscription.created':
      return {
        title: '🔁 Monthly package started',
        body: [`Package   ${str(f.package_key)}`, `Monthly   ${money(f.monthly_amount)}`, `Status    ${str(f.status)}`],
      };
    case 'message.from_client':
      return { title: '💬 Client message', body: [str(f.body, 800)] };
    default:
      return { title: `⚠️ ${event || 'Unknown event'}`, body: [JSON.stringify(f).slice(0, 800)] };
  }
}

/**
 * Telegram rejects anything past 4096 characters, so this is the last
 * line of defence before the send.
 *
 * Today every formatter above already bounds its own fields, so nothing
 * reaches this long -- which is precisely why it is a separate exported
 * function rather than an inline branch. An unreachable `if` inside
 * renderMessage looked tested and was not: a test feeding it a 50,000
 * character message passed whether the clamp was there or not, because
 * str() had already cut the field to 800. Pulled out here, the clamp is
 * exercised directly and the invariant that keeps it unreachable --
 * every formatter staying well under the limit -- is asserted
 * separately.
 */
export function clampForTelegram(text: string): string {
  return text.length > MAX_TELEGRAM_MESSAGE_LENGTH
    ? `${text.slice(0, MAX_TELEGRAM_MESSAGE_LENGTH - 1)}…`
    : text;
}

export function renderMessage(payload: AlertPayload, brand: string): string {
  const { title, body } = formatAlert(payload);
  const ref = str(payload.id, 60);
  const lines = [`${title} — ${brand}`, ...body.filter(Boolean)];
  if (ref) lines.push(`\nRef  ${ref}`);
  return clampForTelegram(lines.join('\n'));
}
