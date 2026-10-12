/**
 * Where customers reach us, in one place.
 *
 * This site shipped three different Telegram handles at once --
 * agenticcore_support in the footer and on the payment screen,
 * agenticcore_managers on the Forge page, agenticCoreHQ on the legacy
 * static pages -- so which business a customer thought they were talking to
 * depended on which page they happened to click from. .biz was worse: its
 * footer linked to AgenticCoreAgency, the wrong brand entirely.
 *
 * One handle, declared once. contact.test.ts fails if a t.me URL is written
 * into a component again.
 */
export const TELEGRAM_HANDLE = "agenticCoreHQ";

export const TELEGRAM_URL = `https://t.me/${TELEGRAM_HANDLE}`;

export const SUPPORT_EMAIL = "hello@agenticcore.agency";

/**
 * WhatsApp, once there is a number.
 *
 * Deliberately null. The owner asked for a WhatsApp button that stays
 * hidden until they supply the number, and a placeholder number on a
 * contact page is worse than no button: somebody will dial it.
 *
 * Set this to the number in international format with no spaces or plus
 * sign -- wa.me wants "971501234567" -- and the button appears everywhere
 * it is used. Nothing else needs changing.
 */
export const WHATSAPP_NUMBER: string | null = null;

/** The wa.me link, or null while there is no number. */
export function whatsAppUrl(): string | null {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}`;
}
