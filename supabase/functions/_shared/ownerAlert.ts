// Telling the owner something happened, in Telegram.
//
// Deliberately minimal and deliberately silent on failure: every caller
// here is reporting on money that has already moved, and an alert that
// throws must never undo a settlement that is already correct.
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const OWNER_TELEGRAM_ID = Deno.env.get('OWNER_TELEGRAM_ID');

export async function notifyOwner(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !OWNER_TELEGRAM_ID) {
    // Said out loud rather than swallowed: an unset owner id means every
    // payment alert in this file has been going nowhere.
    console.error('notifyOwner: TELEGRAM_BOT_TOKEN or OWNER_TELEGRAM_ID is not set');
    return;
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: OWNER_TELEGRAM_ID,
        text: text.slice(0, 4000),
        link_preview_options: { is_disabled: true }
      })
    });
    if (!resp.ok) {
      console.error(`notifyOwner: Telegram returned ${resp.status}`, await resp.text().catch(() => ''));
    }
  } catch (err) {
    console.error('notifyOwner: failed', err);
  }
}
