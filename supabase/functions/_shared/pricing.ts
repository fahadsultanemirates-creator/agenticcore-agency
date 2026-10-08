// What a client actually owes to get a job started.
//
// The agency takes 30% upfront and the rest on delivery, which is the
// split services.html and terms.html promise visitors. So an invoice for a
// $1,000 job is for $300, not $1,000 -- and getting that wrong in either
// direction is a refund conversation.
//
// This number lived in four places: dashboard.js, request.js,
// payram-create-payment and the terms copy. It is here so the chain
// watcher and the page quote the same figure by construction rather than
// by somebody remembering to change both.
export const UPFRONT_FRACTION = 0.3;

/** Rounds to cents, because an invoice is paid to the cent. */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * The deposit due on an agreed price.
 *
 * Rounded to cents before the nonce is added: invoiceAmount() puts the
 * nonce in the fourth decimal place, so a base figure carrying its own
 * long tail of decimals would collide with it.
 */
export function upfrontAmountDue(agreedPrice: number): number {
  return roundMoney(agreedPrice * UPFRONT_FRACTION);
}
