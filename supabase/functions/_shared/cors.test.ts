// Run with: node --experimental-strip-types supabase/functions/_shared/cors.test.ts
//
// Forge was dead in the browser and nothing said so.
//
// supabase-js attaches x-client-info to every functions.invoke(). The
// chat functions answered the preflight with a hand-rolled
// Access-Control-Allow-Headers of 'authorization, apikey, content-type',
// so the browser refused to send the POST. The function logged a 200 for
// the OPTIONS and nothing else -- from the server it looked like nobody
// ever called it, and curl, which does not enforce CORS, worked fine.
//
// _shared/cors.ts already existed, already had the right list, and
// already carried a comment saying every function must use it. Three
// functions did not. A rule written in a comment is not enforced, so it
// is a test now.
//
// The expected list is DERIVED, twice over, rather than retyped: once
// from @supabase/supabase-js's own exported cors module, and once from
// the headers a real invoke() actually puts on the wire. If the SDK
// starts sending a new header, this fails here instead of silently in
// somebody's browser.

import assert from "node:assert/strict";
import process from "node:process";
import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "@supabase/supabase-js/cors";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`PASS  ${name}`);
    })
    .catch((error: Error) => {
      failed++;
      console.log(`FAIL  ${name}`);
      console.log(`      ${error.message.split("\n")[0]}`);
    });
}

const FUNCTIONS = new URL("..", import.meta.url).pathname;
const SHARED = readFileSync(new URL("./cors.ts", import.meta.url), "utf8");

function allowedBy(source: string): string[] {
  const match = /'Access-Control-Allow-Headers':\s*\n?\s*'([^']*)'/.exec(source);
  assert.ok(match, "no Access-Control-Allow-Headers found");
  return match[1].split(",").map((header) => header.trim().toLowerCase()).filter(Boolean);
}

/** Every function that answers a browser, and the source of each. */
function browserFunctions(): { name: string; source: string }[] {
  return readdirSync(FUNCTIONS)
    .filter((entry) => entry !== "_shared")
    .map((entry) => ({ name: entry, path: `${FUNCTIONS}/${entry}/index.ts` }))
    .flatMap(({ name, path }) => {
      let source: string;
      try {
        source = readFileSync(path, "utf8");
      } catch {
        return [];
      }
      return /CORS_HEADERS|Access-Control-Allow/.test(source) ? [{ name, source }] : [];
    });
}

await test("the walk finds the browser-facing functions", () => {
  const found = browserFunctions();
  assert.ok(found.length >= 4, `only ${found.length} found — the walk is broken`);
  for (const required of ["forge-chat", "widget-chat"]) {
    assert.ok(found.some((f) => f.name === required), `${required} missing from the walk`);
  }
});

await test("the shared list matches what supabase-js itself publishes", () => {
  // supabase-js exports the canonical list precisely so edge functions
  // can stay in step with it. Ours must equal it, not approximate it.
  assert.deepEqual(
    allowedBy(SHARED).sort(),
    corsHeaders["Access-Control-Allow-Headers"].split(",").map((h) => h.trim().toLowerCase()).sort(),
  );
});

await test("the shared list covers every header a real invoke() sends", async () => {
  // The authority is the wire, not the docs. Capture what the SDK
  // actually attaches by handing it a fetch of our own.
  const sent: string[] = [];
  const client = createClient("http://127.0.0.1:9/supabase", "test-anon-key", {
    global: {
      fetch: async (_url: string | URL | Request, init?: RequestInit) => {
        const raw = init?.headers;
        const keys =
          raw instanceof Headers
            ? [...raw.keys()]
            : Array.isArray(raw)
              ? raw.map(([key]) => key)
              : Object.keys((raw ?? {}) as Record<string, string>);
        for (const key of keys) sent.push(key.toLowerCase());
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      },
    },
  });
  await client.functions.invoke("forge-chat", { body: { action: "history" } });

  assert.ok(sent.includes("x-client-info"), "the capture did not see x-client-info — the probe is broken");

  // These three never trigger a preflight, so they need no permission.
  const SAFELISTED = new Set(["accept", "accept-language", "content-language"]);
  const allowed = new Set(allowedBy(SHARED));
  const missing = sent.filter((header) => !SAFELISTED.has(header) && !allowed.has(header));
  assert.deepEqual([...new Set(missing)], [], `the SDK sends headers the functions do not allow`);
});

await test("no function hand-rolls its own header list", () => {
  const offenders = browserFunctions()
    .filter(({ source }) => /'Access-Control-Allow-Headers'/.test(source))
    .map(({ name }) => name);
  assert.deepEqual(
    offenders,
    [],
    `these declare their own list instead of importing _shared/cors.ts: ${offenders.join(", ")}`,
  );
});

await test("every browser-facing function imports the shared list", () => {
  const offenders = browserFunctions()
    .filter(({ source }) => !/_shared\/cors\.ts/.test(source))
    .map(({ name }) => name);
  assert.deepEqual(offenders, [], `not importing _shared/cors.ts: ${offenders.join(", ")}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
