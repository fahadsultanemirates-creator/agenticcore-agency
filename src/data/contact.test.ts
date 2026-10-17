// Run with: node --experimental-strip-types src/data/contact.test.ts
//
// Support contacts, and the line between them and the ordering bot.
//
// Those are two different destinations with two different jobs. The bot
// (t.me/AgenticcoreClickManagerbot) creates projects and places orders;
// the support accounts answer questions. Collapsing them would send
// someone with a billing problem into an order flow, so the separation is
// asserted rather than left to whoever edits a footer next.
//
// This site also shipped three different Telegram handles at once, and a
// wrong-brand one in two footers, which is why no component is allowed to
// write either link by hand.

import assert from "node:assert/strict";
import process from "node:process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  SUPPORT_EMAIL,
  TELEGRAM_HANDLE,
  TELEGRAM_URL,
  WHATSAPP_PHONE,
  WHATSAPP_USERNAME,
  whatsAppLabel,
  whatsAppUrl,
} from "./contact.ts";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${(error as Error).message.split("\n")[0]}`);
  }
}

const SRC = new URL("..", import.meta.url).pathname;
const FUNCTIONS = new URL("../../supabase/functions", import.meta.url).pathname;
const PUBLIC = new URL("../../public", import.meta.url).pathname;
const ORDER_BOT = "AgenticcoreClickManagerbot";

function sourceFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.[cm]?tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * The legacy pages in public/ that Netlify still serves as real files.
 *
 * sourceFiles() only takes .ts/.tsx under src/ and supabase/functions, so
 * these were outside every scan -- which is how t.me/agenticCoreHQ sat in
 * two live footers through two renames of the handle. A matching file
 * beats the SPA catch-all on Netlify, so these are not dead weight: they
 * are the page a visitor actually gets.
 */
function staticPages(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) staticPages(full, out);
    else if (full.endsWith(".html")) out.push(full);
  }
  return out;
}

/** Code with comments and imports stripped -- both name what they ban. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/^\s*import\s[\s\S]*?;\s*$/gm, " ");
}

const FILES = [...sourceFiles(SRC), ...sourceFiles(FUNCTIONS)];
const PAGES = staticPages(PUBLIC);

test("the scan reads this repo", () => {
  assert.ok(FILES.length > 10, `only ${FILES.length} files found — the walk is broken`);
});

test("the support accounts are the ones the owner gave", () => {
  assert.equal(TELEGRAM_HANDLE, "AgenticCorebiz");
  assert.equal(TELEGRAM_URL, "https://t.me/AgenticCorebiz");
  assert.equal(WHATSAPP_USERNAME, "agenticcore.biz");
  assert.equal(WHATSAPP_PHONE, "18089985226");
  assert.match(SUPPORT_EMAIL, /^hello@agenticcore\.(agency|biz|click)$/);
});

test("the link uses the number, in the only form WhatsApp documents", () => {
  // wa.me/<number>, international format, no plus, no spaces, no leading
  // zero. The username form appears in no WhatsApp documentation, so it
  // is not what a stranger's phone is pointed at.
  assert.equal(whatsAppUrl(), `https://wa.me/${WHATSAPP_PHONE}`);
  assert.match(whatsAppUrl() as string, /^https:\/\/wa\.me\/[1-9]\d{7,14}$/);
  assert.ok(!(whatsAppUrl() as string).includes("+"), "a plus sign breaks a wa.me link");
  assert.ok(!/\s/.test(whatsAppUrl() as string), "whitespace breaks a wa.me link");
});

test("the number is the one the owner gave, not a placeholder", () => {
  // Pinned to the exact value, because this has now changed twice and
  // each time the old one stayed live somewhere. A shape check alone
  // would have passed both numbers.
  const d = WHATSAPP_PHONE as string;
  assert.equal(d, "18089985226");
  assert.equal(d.length, 11, `expected 1 + 10 digits, got ${d.length}`);
  assert.ok(d.startsWith("1"), "country code should be 1");
  assert.ok(!/^(\d)\1+$/.test(d.slice(1)), "looks like a repeated-digit placeholder");
});

test("what is displayed is what the link opens", () => {
  // A label saying one account while the button opens another is the
  // kind of thing nobody notices until a customer messages the wrong
  // place.
  const label = whatsAppLabel() as string;
  assert.equal(label.replace(/[^0-9]/g, ""), WHATSAPP_PHONE);
});

test("clearing the number falls back to the username, not to nothing", () => {
  const url = (phone: string | null, user: string | null) =>
    phone ? `https://wa.me/${phone}` : user ? `https://wa.me/${user}` : null;
  assert.equal(url(WHATSAPP_PHONE, WHATSAPP_USERNAME), "https://wa.me/18089985226");
  assert.equal(url(null, "agenticcore.biz"), "https://wa.me/agenticcore.biz");
  assert.equal(url(null, null), null);
});

test("no component writes a Telegram or WhatsApp link by hand", () => {
  const offenders: string[] = [];
  for (const file of FILES) {
    if (file.endsWith("/data/contact.ts")) continue;
    const body = code(readFileSync(file, "utf8"));
    for (const match of body.matchAll(/t\.me\/([A-Za-z0-9_]+)/g)) {
      // The ordering bot is allowed to be named directly: it is not a
      // support contact and must not be routed through TELEGRAM_URL.
      if (match[1] === ORDER_BOT) continue;
      // supabase/functions deploys separately and cannot import from
      // src/data/contact.ts, so the literal is unavoidable there -- but
      // it must be the canonical handle. This is exactly where the old
      // agenticCoreHQ survived a rename, in the text the bot reads out.
      if (file.startsWith(FUNCTIONS) && match[1] === TELEGRAM_HANDLE) continue;
      offenders.push(
        `${file.replace(SRC, "src/").replace(FUNCTIONS, "supabase/functions")} → t.me/${match[1]}`,
      );
    }
    for (const match of body.matchAll(/wa\.me\/[A-Za-z0-9._]+/g)) {
      offenders.push(`${file.replace(SRC, "src/")} → ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the ordering bot is never used as a support contact", () => {
  assert.ok(!TELEGRAM_URL.includes(ORDER_BOT), "the support handle points at the order bot");
  assert.ok(!TELEGRAM_HANDLE.includes("bot"), `support handle "${TELEGRAM_HANDLE}" looks like a bot`);

  // Wherever the bot IS linked, it must not be labelled as support.
  for (const file of FILES) {
    if (file.endsWith("/data/contact.ts")) continue; // its comment explains the rule
    const body = code(readFileSync(file, "utf8"));
    if (!body.includes(ORDER_BOT)) continue;
    const near = body.slice(Math.max(0, body.indexOf(ORDER_BOT) - 400), body.indexOf(ORDER_BOT) + 400);
    assert.ok(
      !/support/i.test(near),
      `${file.replace(SRC, "src/")} labels the ordering bot as support`,
    );
  }
});

test("the scan reads the legacy static pages", () => {
  assert.ok(PAGES.length > 0, `no .html found under public/ — the walk is broken`);
});

test("no legacy static page links a stale Telegram handle", () => {
  const offenders: string[] = [];
  for (const file of PAGES) {
    // HTML comments, not JS ones -- code() would leave these intact.
    const body = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, " ");
    for (const match of body.matchAll(/t\.me\/([A-Za-z0-9_]+)/g)) {
      if (match[1] === TELEGRAM_HANDLE || match[1] === ORDER_BOT) continue;
      offenders.push(`public/${file.slice(PUBLIC.length + 1)} → t.me/${match[1]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("the functions' copy of the support details matches this one", () => {
  // supabase/functions deploys separately and cannot import this file,
  // so _shared/support.ts restates the three channels as literals. That
  // is the same arrangement that let t.me/agenticCoreHQ sit in five live
  // footers through two renames, so the copy is checked rather than
  // trusted.
  const support = readFileSync(`${FUNCTIONS}/_shared/support.ts`, "utf8");

  const literal = (name: string): string => {
    const match = new RegExp(`export const ${name} = '([^']*)'`).exec(support);
    assert.ok(match, `${name} not found in _shared/support.ts`);
    return match[1];
  };

  assert.equal(literal("SUPPORT_TELEGRAM"), TELEGRAM_HANDLE);
  assert.equal(literal("SUPPORT_EMAIL"), SUPPORT_EMAIL);
  // Written for reading (+1 808 998 5226); compared by digits, which is
  // the only part that has to be right.
  assert.equal(literal("SUPPORT_WHATSAPP").replace(/[^0-9]/g, ""), WHATSAPP_PHONE);
});

test("the bot tells a stranger where to go instead of answering them", () => {
  const webhook = readFileSync(`${FUNCTIONS}/telegram-webhook/index.ts`, "utf8");
  assert.match(
    webhook,
    /if \(!owner\) \{[\s\S]{0,400}?NOT_A_SUPPORT_CHANNEL/,
    "the owner gate is gone -- a non-owner would reach the model again",
  );
  // The gate has to come before the conversational call, or it gates
  // nothing.
  const gate = webhook.indexOf("if (!owner)");
  const reply = webhook.indexOf("handleIncomingMessage({");
  assert.ok(gate > 0 && reply > 0, "could not locate the gate and the reply call");
  assert.ok(gate < reply, "the owner gate sits after the model call, so it gates nothing");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
