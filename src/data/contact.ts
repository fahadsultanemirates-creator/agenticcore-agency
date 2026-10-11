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
