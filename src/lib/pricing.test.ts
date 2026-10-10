// Run with: node --experimental-strip-types src/lib/pricing.test.ts
//
// taskTypeLabel stands between live customer orders and the screen. The
// requests table holds three shapes of task_type: a catalogue id on rows
// written since the restructure, a service NAME on the sixteen rows
// written before it, and NULL on two older rows. All three have to
// render, and an old order must keep reading as the thing that was
// actually bought rather than being guessed at or hidden.

import assert from "node:assert/strict";
import process from "node:process";
import { taskTypeLabel, upfrontAmountDue, UPFRONT_FRACTION } from "./pricing.ts";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${name}\n      ${(err as Error).message}`);
  }
}

test("a catalogue id resolves to the service name", () => {
  assert.equal(taskTypeLabel("AG-01"), "Professional Landing Page Development");
  assert.equal(taskTypeLabel("AG-16"), "Multi-Agent AI Framework");
});

test("every task_type in the live requests table still renders", () => {
  // Taken verbatim from the production table. These are real orders and
  // they must keep reading as what the customer actually bought.
  const LIVE = [
    "Logo design",
    "Single landing page website",
    "Agent hosting & maintenance (monthly)",
    "Letterhead or receipt design",
    "Brand style guide",
    "Single-task AI agent",
  ];
  for (const value of LIVE) {
    // Unrecognised, so shown as-is -- not blanked, not mapped to a
    // lookalike new service at a different price.
    assert.equal(taskTypeLabel(value), value);
  }
});

test("a null task_type does not render as 'null' or blank", () => {
  // Two live rows have no task_type at all: an old package order and one
  // request from before the column existed.
  assert.equal(taskTypeLabel(null), "Request");
  assert.notEqual(taskTypeLabel(null), "null");
  assert.ok(taskTypeLabel(null).length > 0);
});

test("a retired id is never silently mapped to a live service", () => {
  // serviceById only returns ACTIVE services, so an archived id falls
  // through to being shown as-is. Mapping it to its successor would
  // relabel a paid order as something priced differently.
  assert.equal(taskTypeLabel("LEGACY-DESIGN-LOGO"), "LEGACY-DESIGN-LOGO");
});

test("the deposit is 30% and rounds to cents", () => {
  assert.equal(UPFRONT_FRACTION, 0.3);
  assert.equal(upfrontAmountDue(149), 44.7);
  assert.equal(upfrontAmountDue(499), 149.7);
  // 3 * 0.3 is 0.8999999999999999 in IEEE 754.
  assert.equal(upfrontAmountDue(3), 0.9);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
