// Run with: node --experimental-strip-types supabase/functions/_shared/alert-core.test.ts
//
// The alert is the whole promise: "any order placed passes straight to
// me." Two things can quietly break it -- a formatter that drops an
// event it doesn't recognise, and a secret check that lets anyone DM
// the owner.
//
// The trigger side (that an order ALWAYS fires exactly one alert, and
// that a failed alert never rolls the order back) is proven against a
// real Postgres, not here; see the migration's header.

import assert from "node:assert/strict";
import process from "node:process";
import { readFileSync } from "node:fs";
import {
  clampForTelegram,
  formatAlert,
  renderMessage,
  secretsMatch,
  MAX_TELEGRAM_MESSAGE_LENGTH,
} from "./alert-core.ts";

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

const BRAND = "AgenticCore.test";

test("an unset secret refuses everything, including an empty guess", () => {
  // The dangerous failure: no secret configured, so every caller passes
  // and the endpoint DMs the owner whatever it is sent.
  assert.equal(secretsMatch("", ""), false);
  assert.equal(secretsMatch("anything", ""), false);
});

test("the secret check accepts only the exact value", () => {
  assert.equal(secretsMatch("correct-horse", "correct-horse"), true);
  assert.equal(secretsMatch("correct-hors", "correct-horse"), false);
  assert.equal(secretsMatch("correct-horsE", "correct-horse"), false);
  assert.equal(secretsMatch("correct-horse ", "correct-horse"), false);
});

test("an order reads as an order, with its price and what was asked for", () => {
  const text = renderMessage(
    {
      event: "request.created",
      id: "AC-BIZ-0007",
      fields: {
        service_category: "Admin",
        task_type: "biz-04",
        description: "Payroll for 8 staff",
        agreed_price: 480,
        status: "awaiting_payment",
      },
    },
    BRAND,
  );
  assert.match(text, /New order/);
  assert.match(text, /biz-04/);
  assert.match(text, /\$480\.00/);
  assert.match(text, /awaiting_payment/);
  assert.match(text, /Payroll for 8 staff/);
  assert.match(text, /AC-BIZ-0007/);
  assert.match(text, /AgenticCore\.test/);
});

test("an unpriced order says so rather than showing $0.00", () => {
  // null means "not quoted yet". Rendering it as $0.00 would read as
  // free work.
  const text = renderMessage(
    { event: "request.created", fields: { task_type: "biz-01", agreed_price: null, status: "draft" } },
    BRAND,
  );
  assert.match(text, /not quoted yet/);
  assert.ok(!text.includes("$0.00"), "an unquoted order must not render as $0.00");
});

test("every event the triggers can send has real wording", () => {
  // The list is the migration's, so a trigger added there without a
  // formatter here shows up as a failure rather than as a "⚠️" in the
  // owner's chat.
  const sql = readFileSync(new URL("../../migrations/", import.meta.url).pathname + "0016_owner_alerts.sql", "utf8");
  const events = [...sql.matchAll(/notify_owner_event\('([a-z_.]+)'\)/g)].map((m) => m[1]);
  assert.ok(events.length >= 6, `only ${events.length} events found in the migration — the scrape is broken`);
  for (const event of new Set(events)) {
    const { title } = formatAlert({ event, fields: {} });
    assert.ok(!title.startsWith("⚠️"), `${event} has no formatter, so it would arrive as a raw dump`);
  }
});

test("an event nobody taught it about still reaches the owner", () => {
  const text = renderMessage({ event: "refund.issued", fields: { amount: 50 } }, BRAND);
  assert.match(text, /refund\.issued/);
  assert.match(text, /50/, "the payload should survive even unformatted");
});

test("the clamp cuts an over-long message instead of letting Telegram reject it", () => {
  // Tested directly. The earlier version of this went through
  // renderMessage with a 50,000-character body and passed with the
  // clamp deleted, because every formatter already bounds its fields --
  // it was asserting a truth produced by something else entirely.
  const clamped = clampForTelegram("x".repeat(50_000));
  assert.ok(clamped.length <= MAX_TELEGRAM_MESSAGE_LENGTH, `clamped to ${clamped.length}`);
  assert.ok(clamped.endsWith("…"), "a cut message should show that it was cut");
  assert.equal(clampForTelegram("short"), "short", "a short message must pass through untouched");
});

test("every formatter bounds its own fields, keeping the clamp a backstop", () => {
  // Measured on formatAlert, BEFORE the clamp. Measuring renderMessage
  // instead would be meaningless: the clamp guarantees the result fits
  // whatever the formatter did, so an unbounded field would sail
  // through. Removing str()'s 800-char cap on a message body has to
  // fail here, and it does.
  const huge = "y".repeat(50_000);
  const events = [
    "request.created", "billing.created", "billing.paid", "project.created",
    "project.status", "profile.created", "subscription.created",
    "message.from_client", "something.unknown",
  ];
  for (const event of events) {
    const { title, body } = formatAlert({
      event,
      fields: {
        description: huge, body: huge, project_name: huge, full_name: huge,
        company_name: huge, package_key: huge, task_type: huge,
        service_category: huge, status: huge, old_status: huge,
        payment_type: huge, amount: 1, monthly_amount: 1, agreed_price: 1,
      },
    });
    const raw = [title, ...body].join("\n").length;
    assert.ok(
      raw < MAX_TELEGRAM_MESSAGE_LENGTH,
      `${event} formats to ${raw} chars unclamped — it is relying on the clamp instead of bounding its own fields`,
    );
  }
});

test("a signup never carries spend or referral data", () => {
  // The trigger only sends two columns, but if that ever changes this
  // is the second place it would have to get past.
  const text = renderMessage(
    { event: "profile.created", fields: { full_name: "Grace", company_name: "Hopper Ltd" } },
    BRAND,
  );
  assert.ok(!/referral|total_spend|points/i.test(text), "a signup alert is leaking account data");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
