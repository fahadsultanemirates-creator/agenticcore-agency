// Run with: node --experimental-strip-types src/lib/requestDraft.test.ts
//
// This module parses data that has been sitting in a browser we do not
// control, and it runs on the path between "wrote a brief" and "has an
// account". A throw here loses a customer mid-signup, so every one of these
// cases has to end in either a valid draft or null -- never an exception.

import assert from "node:assert/strict";
import process from "node:process";

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

/** The smallest localStorage that satisfies the three methods used. */
function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    store: map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/** A storage that throws on everything, as in private mode. */
function hostileStorage() {
  const boom = () => {
    throw new Error("SecurityError: access denied");
  };
  return { getItem: boom, setItem: boom, removeItem: boom };
}

const KEY = "agency:request-draft";

function withStorage<T>(storage: unknown, fn: () => T): T {
  (globalThis as { localStorage?: unknown }).localStorage = storage;
  try {
    return fn();
  } finally {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

// Imported after the shim exists only to be explicit; the module reads
// localStorage at call time, not at import time.
const { saveRequestDraft, loadRequestDraft, clearRequestDraft } = await import(
  "./requestDraft.ts"
);

test("a saved draft comes back", () => {
  const storage = fakeStorage();
  withStorage(storage, () => {
    saveRequestDraft({ chosenId: "AG-06", description: "a dashboard", hadAttachment: true });
    const draft = loadRequestDraft();
    assert.ok(draft);
    assert.equal(draft.chosenId, "AG-06");
    assert.equal(draft.description, "a dashboard");
    assert.equal(draft.hadAttachment, true);
  });
});

test("nothing saved reads as null, not as a throw", () => {
  withStorage(fakeStorage(), () => assert.equal(loadRequestDraft(), null));
});

test("clearing removes it", () => {
  const storage = fakeStorage();
  withStorage(storage, () => {
    saveRequestDraft({ chosenId: "AG-01", description: "x", hadAttachment: false });
    clearRequestDraft();
    assert.equal(loadRequestDraft(), null);
    assert.equal(storage.store.size, 0);
  });
});

test("an expired draft is dropped, and dropped from storage too", () => {
  const stale = JSON.stringify({
    chosenId: "AG-01",
    description: "written yesterday",
    hadAttachment: false,
    savedAt: Date.now() - 25 * 60 * 60 * 1000,
  });
  const storage = fakeStorage({ [KEY]: stale });
  withStorage(storage, () => {
    assert.equal(loadRequestDraft(), null);
    assert.equal(storage.store.size, 0, "an expired draft should not be left behind");
  });
});

test("a draft that is 23 hours old still works", () => {
  const fresh = JSON.stringify({
    chosenId: "AG-02",
    description: "still wanted",
    hadAttachment: false,
    savedAt: Date.now() - 23 * 60 * 60 * 1000,
  });
  withStorage(fakeStorage({ [KEY]: fresh }), () => {
    assert.equal(loadRequestDraft()?.description, "still wanted");
  });
});

test("garbage in storage never throws", () => {
  const cases: string[] = [
    "not json at all",
    "null",
    '"a bare string"',
    "[1,2,3]",
    "{}",
    '{"chosenId":"","description":"x","savedAt":1}',
    '{"chosenId":"AG-01","description":5,"savedAt":1}',
    '{"chosenId":"AG-01","description":"x","savedAt":"soon"}',
    '{"chosenId":"AG-01","description":"x"}',
    '{"chosenId":"AG-01","description":"x","savedAt":null}',
  ];
  for (const raw of cases) {
    withStorage(fakeStorage({ [KEY]: raw }), () => {
      assert.equal(loadRequestDraft(), null, `should reject: ${raw}`);
    });
  }
});

test("hadAttachment is only ever a boolean, whatever was stored", () => {
  const raw = JSON.stringify({
    chosenId: "AG-01",
    description: "x",
    hadAttachment: "yes please",
    savedAt: Date.now(),
  });
  withStorage(fakeStorage({ [KEY]: raw }), () => {
    assert.equal(loadRequestDraft()?.hadAttachment, false);
  });
});

test("a storage that throws on every call breaks nothing", () => {
  withStorage(hostileStorage(), () => {
    // All three must be safe: this is private-browsing behaviour, and the
    // submit path calls save() before navigating away.
    assert.doesNotThrow(() =>
      saveRequestDraft({ chosenId: "AG-01", description: "x", hadAttachment: false }),
    );
    assert.doesNotThrow(() => clearRequestDraft());
    assert.equal(loadRequestDraft(), null);
  });
});

test("an absent localStorage breaks nothing either", () => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
  assert.doesNotThrow(() =>
    saveRequestDraft({ chosenId: "AG-01", description: "x", hadAttachment: false }),
  );
  assert.equal(loadRequestDraft(), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
