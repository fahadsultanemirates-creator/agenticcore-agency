import assert from "node:assert/strict";
import { activeServices, services, packages, archivedById, serviceById } from "./catalog.ts";
import { BOT_CATALOG, BOT_PACKAGES, BUSINESS_KNOWLEDGE_PROMPT } from "../../supabase/functions/_shared/business-knowledge.ts";
const items = BOT_CATALOG.flatMap(c => c.items);
assert.deepEqual(items.map(s => s.id).sort(), activeServices.map(s => s.id).sort());
for (const s of activeServices) {
 const bot = items.find(item => item.id === s.id)!;
 assert.equal(bot.name, s.name);
 assert.deepEqual(bot.limits, s.scopeLimits);
 assert.deepEqual(bot.deliverables, s.deliverables);
}
assert.deepEqual(BOT_PACKAGES.map(p => p.id), packages.map(p => p.id));
for (const s of services.filter(s => s.status === "archived")) {
 assert.equal(serviceById(s.id), undefined);
 assert.ok(archivedById(s.id.toLowerCase())?.name);
 assert.ok(!items.some(item => item.id === s.id));
 assert.ok(!packages.some(p => p.serviceIds.includes(s.id)));
}
assert.match(BUSINESS_KNOWLEDGE_PROMPT, /You are Maya/);
assert.match(BUSINESS_KNOWLEDGE_PROMPT, /Direct Forge chat is reserved/);
console.log("PASS active catalogue, scope, bundles and retired links agree across website and assistant");
