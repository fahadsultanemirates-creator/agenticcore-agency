// Run with: node --experimental-strip-types src/data/contact.test.ts

import assert from "node:assert/strict";
import process from "node:process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { TELEGRAM_HANDLE, TELEGRAM_URL } from "./contact.ts";

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

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(full) && !full.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const SRC = new URL("..", import.meta.url).pathname;
// The edge functions too. They are not part of the Vite build and so fell
// outside the first version of this check -- which is exactly where the old
// agenticcore_managers handle survived: in the prompt the Telegram bot reads
// out to customers, and in two "something went wrong, reach us here" strings.
const FUNCTIONS = new URL("../../supabase/functions", import.meta.url).pathname;

test("the canonical handle is the one the owner chose", () => {
  assert.equal(TELEGRAM_HANDLE, "agenticCoreHQ");
  assert.equal(TELEGRAM_URL, "https://t.me/agenticCoreHQ");
});

test("no component hardcodes a Telegram URL", () => {
  // The whole bug: three handles across three files, each correct in
  // isolation. Anything that writes t.me into a component can drift from
  // the others, so the only place the string may appear is contact.ts.
  const offenders: string[] = [];
  for (const file of [...sourceFiles(SRC), ...sourceFiles(FUNCTIONS)]) {
    if (file.endsWith("/data/contact.ts")) continue;
    const text = readFileSync(file, "utf8");
    // Comments explain the history and name the old handles, so scan the
    // code only -- the same strip the .biz legal tests needed.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    for (const match of code.matchAll(/t\.me\/([A-Za-z0-9_]+)/g)) {
      const handle = match[1];
      // supabase/functions deploys separately and cannot import from src/,
      // so the literal is unavoidable there -- but it must be the canonical
      // one. Anywhere else, no literal at all.
      if (file.startsWith(FUNCTIONS) && handle === TELEGRAM_HANDLE) continue;
      offenders.push(
        `${file.replace(SRC, "src/").replace(FUNCTIONS, "supabase/functions")} → t.me/${handle}`,
      );
    }
  }
  assert.deepEqual(offenders, [], `these files hardcode a Telegram URL: ${offenders.join(", ")}`);
});

test("the stripper is not hiding a real hardcoded URL", () => {
  // Guard against the previous test passing because the comment strip ate
  // live code. A file with a t.me URL outside a comment must be caught.
  const fixture = 'const x = "https://t.me/someoneElse";\n// t.me/inAComment\n';
  const code = fixture.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  assert.ok(code.includes("t.me/"), "the stripper removed live code, not just comments");
  assert.ok(!code.includes("inAComment"), "the stripper failed to remove a line comment");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
