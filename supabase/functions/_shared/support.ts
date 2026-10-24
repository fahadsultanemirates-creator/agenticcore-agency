// The support channels, for the one place in the functions that needs
// to name them.
//
// supabase/functions deploys separately from the site and cannot import
// src/data/contact.ts, so these are literals -- which is exactly how
// t.me/agenticCoreHQ survived two renames in five live page footers.
// contact.test.ts asserts every value here still equals the one in
// src/data/contact.ts, so the copy cannot drift from the original
// without turning a test red.
//
// Deliberately not a wa.me link: the number is written the way a person
// reads it, because this text is read inside Telegram rather than
// clicked from a web page.
export const SUPPORT_TELEGRAM = 'AgenticCorebiz';
export const SUPPORT_WHATSAPP = '+1 808 998 5226';
export const SUPPORT_EMAIL = 'hello@agenticcore.group';

/**
 * What the bot says to anyone who is not the owner.
 *
 * This bot is the owner's control channel, not a customer one: it
 * reports what happens on the website and takes delivery instructions
 * back. A visitor who messages it gets pointed at a person instead of
 * an AI reply, because a bot that answers questions here would be a
 * fourth support channel nobody is watching.
 */
export const NOT_A_SUPPORT_CHANNEL = [
  'This bot is for the AgenticCore team only, so nobody is reading messages here.',
  '',
  'For help, any of these reach a person:',
  `  Telegram  @${SUPPORT_TELEGRAM}`,
  `  WhatsApp  ${SUPPORT_WHATSAPP}`,
  `  Email     ${SUPPORT_EMAIL}`
].join('\n');
