// Run with: node --experimental-strip-types src/data/catalog.test.ts
//
// Not type checks -- the compiler does those. These are the claims the
// business makes, asserted: that there are nineteen services and not
// fifty-four, that every price is the one the owner approved, that a
// "from" price can never be charged as if it were the price, and that
// nothing Agency handed to .biz or .click can still be bought here.

import assert from "node:assert/strict";
import process from "node:process";

import {
  activeServices,
  archivedById,
  archivedServices,
  capabilities,
  categories,
  featuredServices,
  formatPrice,
  heroFloors,
  heroFloorUsd,
  needsQuote,
  packages,
  serviceById,
  services,
  servicesIn,
  SERVICE_COUNT,
} from "./catalog.ts";

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

test("nineteen services, not fifty-four", () => {
  assert.equal(SERVICE_COUNT, 19);
  assert.equal(activeServices.length, 19);
});

test("every id is unique and follows AG-nn", () => {
  const ids = services.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^AG-\d{2}$/, id);
});

test("the ids run AG-01 to AG-19 with no gaps", () => {
  // A gap means a service was dropped in editing and nobody noticed.
  const numbers = activeServices.map((s) => Number(s.id.slice(3))).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 19 }, (_, i) => i + 1));
});

test("every price is exactly what the brief specified", () => {
  // Pinned by value. These are the owner's approved launch prices and the
  // only safe way to catch a typo in one of them is to write them twice.
  const EXPECTED: Record<string, [number, string, boolean]> = {
    // id: [price, billing, startingFrom]
    "AG-01": [49, "one_time", false],
    "AG-02": [149, "one_time", false],
    "AG-03": [279, "one_time", false],
    "AG-04": [349, "one_time", true],
    "AG-05": [119, "one_time", true],
    "AG-06": [399, "one_time", true],
    "AG-07": [29, "one_time", false],
    "AG-08": [29, "monthly", false],
    "AG-09": [49, "one_time", false],
    "AG-10": [49, "per_unit", true],
    "AG-11": [99, "one_time", true],
    "AG-12": [99, "one_time", true],
    "AG-13": [149, "one_time", true],
    "AG-14": [129, "one_time", true],
    "AG-15": [149, "one_time", true],
    "AG-16": [499, "one_time", true],
    "AG-17": [249, "one_time", true],
    "AG-18": [199, "one_time", true],
    "AG-19": [39, "monthly", true],
  };
  assert.equal(Object.keys(EXPECTED).length, 19);
  for (const service of activeServices) {
    const want = EXPECTED[service.id];
    assert.ok(want, `${service.id} is not in the approved price list`);
    assert.equal(service.priceUsd, want[0], `${service.id} price`);
    assert.equal(service.billing, want[1], `${service.id} billing`);
    assert.equal(Boolean(service.startingFrom), want[2], `${service.id} startingFrom`);
  }
});

test("the six featured services are the six the homepage promises", () => {
  // Section D of the brief, by id AND by the price shown next to it.
  const EXPECTED = [
    ["AG-01", "$49"],
    ["AG-02", "$149"],
    ["AG-06", "From $399"],
    ["AG-11", "From $99"],
    ["AG-15", "From $149"],
    ["AG-16", "From $499"],
  ];
  assert.equal(featuredServices.length, 6);
  const got = featuredServices.map((s) => [s.id, formatPrice(s)]).sort();
  assert.deepEqual(got, [...EXPECTED].sort());
});

test("a 'from' price always reads as a floor", () => {
  // The whole risk of a starting-from price is that it gets presented as
  // the price and somebody expects to pay it.
  for (const service of activeServices) {
    if (service.startingFrom) {
      assert.match(formatPrice(service), /^From \$/, `${service.id}: ${formatPrice(service)}`);
    } else {
      assert.doesNotMatch(formatPrice(service), /^From /, `${service.id}: ${formatPrice(service)}`);
    }
  }
});

test("a quote is needed for exactly the starting-from services", () => {
  const quoted = activeServices.filter(needsQuote).map((s) => s.id);
  assert.deepEqual(quoted.sort(), [
    "AG-04", "AG-05", "AG-06", "AG-10", "AG-11", "AG-12",
    "AG-13", "AG-14", "AG-15", "AG-16", "AG-17", "AG-18", "AG-19",
  ]);
});

test("per-unit pricing says what the unit is", () => {
  for (const service of activeServices) {
    if (service.billing === "per_unit") {
      assert.ok(service.unit, `${service.id} is per-unit with no unit named`);
      assert.match(formatPrice(service), / per /, formatPrice(service));
    }
  }
});

test("every service carries the scope a customer needs before buying", () => {
  for (const s of activeServices) {
    assert.ok(s.deliverables.length > 0, `${s.id} has no deliverables`);
    assert.ok(s.scopeLimits.length > 0, `${s.id} has no scope limits`);
    assert.ok(s.exclusions.length > 0, `${s.id} has no exclusions`);
    assert.ok(s.customerInputs.length > 0, `${s.id} asks the customer for nothing`);
    assert.ok(s.externalCosts.length > 0, `${s.id} names no external costs`);
    assert.ok(s.deliveryEstimate.trim().length > 0, `${s.id} has no delivery estimate`);
    assert.ok(s.summary.trim().length > 10, `${s.id} summary is too thin`);
  }
});

test("the three categories hold every service between them", () => {
  const counts = categories.map((c) => servicesIn(c.id).length);
  assert.deepEqual(counts, [8, 2, 9]);
  assert.equal(counts.reduce((a, b) => a + b, 0), SERVICE_COUNT);
});

test("every capability card points at services that exist and are active", () => {
  // These cards are the homepage's four front doors. A dead id here is a
  // door that opens onto nothing.
  assert.equal(capabilities.length, 4);
  for (const cap of capabilities) {
    assert.ok(cap.serviceIds.length > 0, `${cap.id} lists no services`);
    for (const id of cap.serviceIds) {
      assert.ok(serviceById(id), `${cap.id} points at ${id}, which is not an active service`);
    }
  }
});

test("every active service is reachable from a capability card", () => {
  // Otherwise a service exists that no homepage path leads to.
  const reachable = new Set(capabilities.flatMap((c) => c.serviceIds));
  for (const s of activeServices) {
    assert.ok(reachable.has(s.id), `${s.id} is not on any capability card`);
  }
});

test("three packages, at the agreed prices", () => {
  assert.equal(packages.length, 3);
  const byId = Object.fromEntries(packages.map((p) => [p.id, p]));
  assert.equal(byId["PKG-WEBSITE-STARTER"].priceUsd, 149);
  assert.equal(byId["PKG-WEBSITE-BRAND"].priceUsd, 189);
  assert.equal(byId["PKG-AUTOMATION-STARTER"].priceUsd, 249);
  for (const p of packages) {
    assert.equal(p.billing, "one_time", `${p.id} should be a one-time package`);
    assert.ok(p.included.length > 0, `${p.id} includes nothing`);
    assert.ok(p.excluded.length > 0, `${p.id} excludes nothing`);
    assert.ok(p.externalCosts.length > 0, `${p.id} names no external costs`);
    assert.ok(p.cta.trim().length > 0, `${p.id} has no CTA`);
  }
});

test("every package references real, active services", () => {
  for (const p of packages) {
    assert.ok(p.serviceIds.length > 0, `${p.id} maps onto no services`);
    for (const id of p.serviceIds) {
      assert.ok(serviceById(id), `${p.id} references ${id}, which is not an active service`);
    }
  }
});

test("the brand package costs more than the website it contains", () => {
  // Website + Brand Launch is Website Starter plus the identity kit. If it
  // ever prices below the thing it is a superset of, somebody has edited
  // one number and not the other.
  const starter = packages.find((p) => p.id === "PKG-WEBSITE-STARTER")!;
  const brand = packages.find((p) => p.id === "PKG-WEBSITE-BRAND")!;
  assert.ok(brand.priceUsd > starter.priceUsd);
});

test("nothing archived can be ordered", () => {
  // The whole point of keeping them: an old link explains itself instead
  // of 404ing, but it cannot put anything in a basket.
  assert.ok(archivedServices.length > 0);
  for (const a of archivedServices) {
    assert.equal(serviceById(a.id), undefined, `${a.id} is still orderable`);
    assert.ok(a.note.trim().length > 10, `${a.id} has no explanation`);
  }
});

test("every archived service says where its work went", () => {
  for (const a of archivedServices) {
    const hasDestination = Boolean(a.replacedBy) || Boolean(a.movedTo);
    assert.ok(hasDestination, `${a.id} is retired with nowhere to send anyone`);
    if (a.replacedBy) {
      assert.ok(serviceById(a.replacedBy), `${a.id} points at ${a.replacedBy}, which is not active`);
    }
    if (a.movedTo) {
      assert.ok(["click", "biz"].includes(a.movedTo), `${a.id} moved to an unknown brand`);
    }
  }
});

test("the work Agency gave away is actually gone from the active catalogue", () => {
  // The positioning change, asserted. If bookkeeping ever reappears in the
  // active list, this is what should notice.
  const text = activeServices
    .map((s) => `${s.name} ${s.summary}`)
    .join(" ")
    .toLowerCase();
  for (const term of [
    "bookkeeping",
    "payroll",
    "feasibility",
    "market research",
    "social media management",
    "advertising campaign",
  ]) {
    assert.doesNotMatch(text, new RegExp(term), `"${term}" is back in the active catalogue`);
  }
});

test("archived ids are distinct from active ones", () => {
  for (const a of archivedServices) {
    assert.doesNotMatch(a.id, /^AG-\d{2}$/, `${a.id} collides with the active id scheme`);
  }
  assert.equal(archivedById("AG-01"), undefined);
});

test("no service promises a turnaround Agency cannot make", () => {
  // Twenty minutes is .click's promise. Nothing built here is that fast,
  // and saying so would be selling .click's product at Agency's prices.
  for (const s of activeServices) {
    assert.doesNotMatch(
      s.deliveryEstimate,
      /minute|instant|immediate|same day|24 hours/i,
      `${s.id}: ${s.deliveryEstimate}`,
    );
  }
});

test("the multi-agent framework never promises an autonomous production system", () => {
  // The single most over-promisable thing in the catalogue.
  const mas = serviceById("AG-16")!;
  const copy = [...mas.scopeLimits, ...mas.exclusions].join(" ").toLowerCase();
  assert.match(copy, /prototype|not an unlimited/, "AG-16 does not say it is a scoped prototype");
  assert.match(copy, /unsupervised|human reviews/, "AG-16 does not state the supervision boundary");
});

test("MCP is not sold as a multi-agent framework", () => {
  // They get conflated constantly, and a customer who buys AG-18 expecting
  // AG-16 has bought the wrong thing by several hundred dollars.
  const mcp = serviceById("AG-18")!;
  assert.match(mcp.scopeLimits.join(" "), /not itself a multi-agent framework/i);
});

test("the hero's price floors name the services they actually come from", () => {
  // The hero read "Professional websites from $49" for weeks. $49 is AG-01,
  // which is a single landing page; the cheapest real website is AG-02 at
  // $149. Pinning the numbers alone would not have caught that -- $49 was a
  // true price, attached to the wrong noun -- so this also asserts that each
  // label matches the name of the service it quotes.
  const quoted = heroFloors.map((f) => [f.label, heroFloorUsd(f.serviceId)]);
  assert.deepEqual(quoted, [
    ["Landing pages", 49],
    ["websites", 149],
    ["custom AI agents", 149],
  ]);

  const nounFor: Record<string, RegExp> = {
    "Landing pages": /landing page/i,
    websites: /website/i,
    "custom AI agents": /ai agent/i,
  };
  for (const floor of heroFloors) {
    const service = serviceById(floor.serviceId);
    assert.ok(service, `${floor.serviceId} is quoted by the hero but not in the catalogue`);
    assert.match(
      service.name,
      nounFor[floor.label],
      `the hero calls ${floor.serviceId} "${floor.label}", but it is "${service.name}"`,
    );
  }
});


console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
