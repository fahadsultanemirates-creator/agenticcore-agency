// Run with: node --experimental-strip-types supabase/functions/_shared/pricing.test.ts
//
// 0.3 is not representable in binary floating point, so the deposit is one
// multiply away from figures like 0.8999999999999999 -- which would be
// quoted to a client and then compared byte-for-byte against what the
// chain reports. The sweep below covers the prices the site actually sells
// at; the float case is checked separately, because none of them hits it.
import assert from 'node:assert/strict';
import process from 'node:process';

import { UPFRONT_FRACTION, roundMoney, upfrontAmountDue } from './pricing.ts';
import { invoiceAmount } from './usdtAmount.ts';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${name}\n      ${(err as Error).message}`);
  }
}

const AGENCY_PRICES = [5, 15, 20, 25, 30, 35, 40, 50, 60, 75, 100, 150, 180, 200, 300, 350, 500, 800, 1000];

await test('the deposit is 30% of the agreed price', () => {
  assert.equal(UPFRONT_FRACTION, 0.3);
  assert.equal(upfrontAmountDue(1000), 300);
  assert.equal(upfrontAmountDue(100), 30);
  assert.equal(upfrontAmountDue(5), 1.5);
});

// None of the prices in the catalogue today trips the float error -- the
// smallest figure that does is $3, which gives 0.8999999999999999. So the
// rounding is not load-bearing yet, and this is what notices when a quote
// typed by hand makes it so. agreed_price is a free numeric column, not a
// pick from the price list, so that is a matter of someone typing $3.
await test('a price the bare multiply gets wrong still rounds to cents', () => {
  assert.ok(3 * 0.3 !== 0.9);
  assert.equal(roundMoney(3 * 0.3), 0.9);
  assert.equal(upfrontAmountDue(3), 0.9);
  assert.equal(invoiceAmount(upfrontAmountDue(3), 7), '0.900007');
});

await test('no deposit has more than two decimal places', () => {
  for (const price of AGENCY_PRICES) {
    const due = upfrontAmountDue(price);
    assert.equal(due, Number(due.toFixed(2)), `$${price} gave ${due}`);
  }
});

// The nonce lives in the last four decimal places of the amount sent. A
// deposit carrying its own tail of decimals would overwrite it, and the
// payment would arrive for an amount no invoice is expecting -- which is
// the one outcome that needs a human to untangle.
await test('every deposit survives having a nonce attached', () => {
  for (const price of AGENCY_PRICES) {
    for (const nonce of [1, 7, 42, 9999]) {
      const amount = invoiceAmount(upfrontAmountDue(price), nonce);
      const decimals = amount.split('.')[1] ?? '';
      assert.equal(decimals.length, 6, `${amount} for $${price} nonce ${nonce}`);
      assert.ok(Number(amount) > 0);
      // And the nonce is still readable at the end of it.
      assert.equal(Number(decimals.slice(2)), nonce);
    }
  }
});

// The cheapest thing sold is $5, so the smallest deposit is $1.50. If
// something cheaper ever appears this is what notices the deposit has
// become unpayable rather than merely small.
await test('a deposit never rounds away to nothing', () => {
  for (const price of AGENCY_PRICES) {
    assert.ok(upfrontAmountDue(price) >= 0.01, `$${price} rounds to zero`);
  }
});

// Two invoices for the same job must never be quoted the same amount, and
// two different jobs at the same price must differ. Both are the partial
// unique index's job in the database; this is the arithmetic holding up
// its end.
await test('two deposits at the same price differ by their nonce alone', () => {
  const a = invoiceAmount(upfrontAmountDue(1000), 1);
  const b = invoiceAmount(upfrontAmountDue(1000), 2);
  assert.notEqual(a, b);
  assert.equal(a, '300.000001');
  assert.equal(b, '300.000002');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
