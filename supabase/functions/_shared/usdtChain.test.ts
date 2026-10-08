// Run with: node --experimental-strip-types supabase/functions/_shared/usdtChain.test.ts
//
// The network calls are not tested here. The decoding either side of them
// is, because both decide whether somebody's money is credited.

import assert from 'node:assert/strict';
import {
  chunkRanges,
  coldStartBlock,
  decodeStringResult,
  looksLikeHttpUrl,
  safeHost,
  scanStart,
  toLogTransfer,
  MAX_CHUNKS_PER_SWEEP,
  MAX_RANGE_BLOCKS
} from './usdtChain.ts';

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

// ---- symbol(), as an ABI string return -------------------------------

function encodeString(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const offset = (32).toString(16).padStart(64, '0');
  const length = bytes.length.toString(16).padStart(64, '0');
  return '0x' + offset + length + hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
}

test('a symbol decodes out of an ABI string return', () => {
  assert.equal(decodeStringResult(encodeString('USDT')), 'USDT');
  assert.equal(decodeStringResult(encodeString('BSC-USD')), 'BSC-USD');
});

// This guards against a lookalike token, so it has to fail closed:
// anything unreadable must come back empty and be rejected.
test('anything unreadable decodes to empty rather than to a guess', () => {
  assert.equal(decodeStringResult(''), '');
  assert.equal(decodeStringResult('0x'), '');
  assert.equal(decodeStringResult('0x' + '0'.repeat(64)), '');
  assert.equal(
    decodeStringResult('0x' + (32).toString(16).padStart(64, '0') + (99).toString(16).padStart(64, '0') + 'ab'),
    ''
  );
});

test('trailing padding is not part of the symbol', () => {
  assert.equal(decodeStringResult(encodeString('USDT')).length, 4);
});

// ---- Transfer logs ---------------------------------------------------

const US = '0x62Ad7D55fbc8A8591109D72b67Ec63aa1EE196bC';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

function topic(address: string): string {
  return '0x' + address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function log(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    transactionHash: '0xabc',
    // 20.000007 at 18 decimals.
    data: '0x0000000000000000000000000000000000000000000000011590f0e8f2b3c000',
    topics: [TRANSFER, topic('0x1111111111111111111111111111111111111111'), topic(US)],
    blockNumber: '0x64',
    ...over
  };
}

test('a log becomes a transfer', () => {
  const t = toLogTransfer(log(), 0x64n + 41n);
  assert.equal(t?.txHash, '0xabc');
  assert.equal(t?.to.toLowerCase(), US.toLowerCase());
  assert.equal(t?.confirmations, 42);
});

// The value is carried as a decimal string and compared as a bigint. A
// Number here would lose the digits that identify the invoice.
test('the value is decoded exactly, as a string', () => {
  const t = toLogTransfer(log({ data: '0x' + (20_000_007_000_000_000_000n).toString(16) }), 200n);
  assert.equal(typeof t?.valueRaw, 'string');
  assert.equal(t?.valueRaw, '20000007000000000000');
});

test('the block just mined counts as one confirmation', () => {
  assert.equal(toLogTransfer(log({ blockNumber: '0x64' }), 0x64n)?.confirmations, 1);
});

// Defaulting the other way would credit a payment that is not yet settled.
test('a block ahead of the head counts as zero, not as plenty', () => {
  assert.equal(toLogTransfer(log({ blockNumber: '0xc8' }), 0x64n)?.confirmations, 0);
});

test('a log missing anything that identifies it is dropped', () => {
  for (const key of ['transactionHash', 'data', 'topics', 'blockNumber']) {
    const row = log();
    delete row[key];
    assert.equal(toLogTransfer(row, 200n), null, `should drop a log with no ${key}`);
  }
});

test('a log with too few topics is dropped', () => {
  assert.equal(toLogTransfer(log({ topics: [TRANSFER] }), 200n), null);
});

test('an unparseable value or block is dropped, not guessed at', () => {
  assert.equal(toLogTransfer(log({ data: 'not-hex' }), 200n), null);
  assert.equal(toLogTransfer(log({ blockNumber: 'soon' }), 200n), null);
});

// Topics are 32 bytes; an address is the last 20. Taking the wrong end
// would make every transfer look like it went somewhere else.
test('the recipient is read off the end of the topic', () => {
  const t = toLogTransfer(log(), 200n);
  assert.equal(t?.to.length, 42);
  assert.equal(t?.to.toLowerCase(), US.toLowerCase());
});


// ---- scan ranges ------------------------------------------------------
//
// An .agency invoice is payable for 24 hours but a node will only serve a
// window of a thousand blocks, so the sweep walks forward in chunks. An
// off-by-one here either rescans one block forever or skips one, and a
// skipped block is a payment nobody ever looks at.

test('a short range is one chunk ending exactly at the head', () => {
  const ranges = chunkRanges(1000n, 1500n);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].from, 1000n);
  assert.equal(ranges[0].to, 1500n);
});

test('a single block is a chunk of one', () => {
  const ranges = chunkRanges(1000n, 1000n);
  assert.deepEqual(ranges, [{ from: 1000n, to: 1000n }]);
});

test('chunks abut exactly -- no block scanned twice, none skipped', () => {
  const ranges = chunkRanges(0n, 2500n, 1000);
  assert.equal(ranges.length, 3);
  assert.deepEqual(ranges[0], { from: 0n, to: 999n });
  assert.deepEqual(ranges[1], { from: 1000n, to: 1999n });
  assert.deepEqual(ranges[2], { from: 2000n, to: 2500n });
  for (let i = 1; i < ranges.length; i++) {
    assert.equal(ranges[i].from, ranges[i - 1].to + 1n);
  }
});

test('nothing new means no calls at all', () => {
  // from > head: the cursor is already at the head. Asking the node for an
  // inverted range is how you get an error instead of an empty answer.
  assert.deepEqual(chunkRanges(1001n, 1000n), []);
});

test('a sweep that is a day behind stops rather than timing out', () => {
  // ~115,000 blocks at BNB's current block time. Twelve chunks a minute
  // clears it in ten minutes, and every sweep in between still settles
  // whatever has already been found.
  const ranges = chunkRanges(0n, 115_000n, 1000, 12);
  assert.equal(ranges.length, 12);
  assert.equal(ranges[11].to, 11_999n);
  // And the next sweep picks up exactly where this one stopped.
  const next = chunkRanges(ranges[11].to + 1n, 115_000n, 1000, 12);
  assert.equal(next[0].from, 12_000n);
});

test('the chunk size never exceeds what a node will serve', () => {
  for (const range of chunkRanges(0n, 10_000n)) {
    assert.ok(range.to - range.from + 1n <= BigInt(MAX_RANGE_BLOCKS));
  }
});

test('a cold start looks back, and never below block zero', () => {
  assert.equal(coldStartBlock(60_000_000n), 60_000_000n - 1500n);
  assert.equal(coldStartBlock(100n), 0n);
});

// The log index is what makes a stored transfer identifiable. One
// transaction can hold several transfers to the same address, and keying
// only on the hash would silently drop all but one of them.
test('the log index is carried through, hex or number', () => {
  assert.equal(toLogTransfer(log({ logIndex: '0x3' }), 200n)?.logIndex, 3);
  assert.equal(toLogTransfer(log({ logIndex: 7 }), 200n)?.logIndex, 7);
  // Absent or unreadable is zero, not a dropped transfer.
  assert.equal(toLogTransfer(log(), 200n)?.logIndex, 0);
  assert.equal(toLogTransfer(log({ logIndex: 'banana' }), 200n)?.logIndex, 0);
});



// ---- where a sweep starts --------------------------------------------
//
// This is the bug that cost the first real order. The cron only runs
// while an invoice is open, so the cursor stops moving the moment the
// last one settles. Two and a half quiet hours later a client ordered a
// logo, and the sweep set out to scan the 19,010 blocks between the stale
// cursor and the new invoice -- every one of them older than the invoice,
// so not one of them could have held the payment. Twelve wide eth_getLogs
// calls a minute, "-32005 limit exceeded" from every free node, and a
// client watching a spinner over money that was already on-chain.

test('the oldest open invoice is the floor', () => {
  // The exact shape of the live failure.
  assert.equal(
    scanStart({ lastBlock: 126429328n, oldestPendingBlock: 126448338n, head: 126448400n }),
    126448338n
  );
});

test('a cursor already past the invoice is not dragged backwards', () => {
  // An invoice opened an hour ago must not re-scan blocks already
  // recorded -- that is wasted budget, and it re-reports transfers.
  assert.equal(
    scanStart({ lastBlock: 500n, oldestPendingBlock: 100n, head: 1000n }),
    501n
  );
});

test('with nothing pending the cursor simply carries on', () => {
  assert.equal(scanStart({ lastBlock: 500n, oldestPendingBlock: null, head: 1000n }), 501n);
});

test('a cold start looks back, and the floor still applies', () => {
  // Nothing scanned yet, no invoice: the lookback window.
  assert.equal(scanStart({ lastBlock: null, oldestPendingBlock: null, head: 60_000_000n }), 59_998_500n);
  // Nothing scanned yet, but an invoice newer than the lookback: start at
  // the invoice, not 1500 blocks of someone else's payments before it.
  assert.equal(
    scanStart({ lastBlock: null, oldestPendingBlock: 59_999_900n, head: 60_000_000n }),
    59_999_900n
  );
  // An invoice OLDER than the lookback wins too, and this is the case
  // that nearly got written the other way round: an invoice is payable
  // for 24 hours, so on a cold start it can easily sit further back than
  // the 1500-block window. Clamping to the window there would step over
  // the blocks its payment is in and never look at them again.
  assert.equal(
    scanStart({ lastBlock: null, oldestPendingBlock: 59_990_000n, head: 60_000_000n }),
    59_990_000n
  );
});

test('a normal minute is one chunk, not twelve', () => {
  // BNB mines roughly 80 blocks a minute. With the floor in place that is
  // the whole job, and a sweep costs one eth_blockNumber plus one
  // eth_getLogs -- which is what a free public node will actually serve.
  const start = scanStart({ lastBlock: 126448338n, oldestPendingBlock: 126448338n, head: 126448418n });
  assert.equal(chunkRanges(start, 126448418n).length, 1);
});

test('the per-sweep ceiling stays small enough to be served', () => {
  assert.ok(MAX_CHUNKS_PER_SWEEP <= 4, `${MAX_CHUNKS_PER_SWEEP} wide getLogs calls a minute is what got us rate-limited`);
});


// ---- never publish the RPC key ----------------------------------------
//
// usdt-check answers without a JWT and puts these errors in its response
// body, so anything that survives into a message is served to anyone who
// POSTs an empty object at it. A provider endpoint carries its key in the
// path, so the host itself is the secret.

test('a keyed endpoint is reduced to its origin', () => {
  assert.equal(
    safeHost('https://bsc-mainnet.nodereal.io/v1/4ee23929011d43b0b0579dab9bbe74cd'),
    'https://bsc-mainnet.nodereal.io'
  );
});

test('a key in the query string does not survive either', () => {
  assert.equal(safeHost('https://example.org/rpc?apikey=sekret'), 'https://example.org');
  assert.equal(safeHost('https://user:pass@example.org/rpc'), 'https://example.org');
});

test('a value that is not a URL is never echoed back', () => {
  // The real mistake: the bare API key pasted into BSC_RPC_URL. fetch
  // throws "Invalid URL: '<the key>'", and that message was being quoted
  // into an unauthenticated response.
  assert.equal(safeHost('4ee23929011d43b0b0579dab9bbe74cd'), '<malformed BSC_RPC_URL>');
  assert.ok(!safeHost('4ee23929011d43b0b0579dab9bbe74cd').includes('4ee2'));
});

test('a plain public host is left readable', () => {
  // Redaction must not cost us the diagnostics that made the dataseed
  // failure legible in the first place.
  assert.equal(safeHost('https://bsc.drpc.org'), 'https://bsc.drpc.org');
});


// A malformed BSC_RPC_URL must degrade us, never stop us. The bare API
// key pasted into that field replaced every host with itself, fetch
// refused all of them, and payments went off entirely -- one dashboard
// typo, total outage.
test('a bare API key is not a usable host', () => {
  assert.equal(looksLikeHttpUrl('4ee23929011d43b0b0579dab9bbe74cd'), false);
  assert.equal(looksLikeHttpUrl(''), false);
  assert.equal(looksLikeHttpUrl('bsc-mainnet.nodereal.io/v1/abc'), false, 'no scheme is not a URL');
  assert.equal(looksLikeHttpUrl('ws://bsc-mainnet.nodereal.io/v1/abc'), false, 'we speak HTTP here');
});

test('a real endpoint is usable', () => {
  assert.equal(looksLikeHttpUrl('https://bsc-mainnet.nodereal.io/v1/4ee23929011d43b0'), true);
  assert.equal(looksLikeHttpUrl('http://localhost:8545'), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
