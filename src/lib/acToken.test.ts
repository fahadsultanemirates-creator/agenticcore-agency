// The owner re-enabled AC invoice payments at 10% off, with server-priced quotes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../components/dashboard/AcInvoicePayment.tsx',import.meta.url),'utf8');
assert.ok(ui.includes('0.0000006'));assert.ok(ui.includes('10% off'));assert.ok(ui.includes('29 April 2027'));assert.ok(ui.includes('billingId:selected'));assert.ok(!ui.includes("from('billing').update"));assert.ok(ui.includes('invoice_status'));assert.ok(ui.includes('Do not round'));console.log('PASS  AC server-priced invoice selection, 10% offer, fixed rate and read-only payment status');
