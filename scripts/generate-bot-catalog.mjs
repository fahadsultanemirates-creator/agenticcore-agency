// Writes supabase/functions/_shared/catalog-data.ts from src/data/catalog.ts.
//
// WHY THIS EXISTS. Edge Functions bundle independently and cannot cleanly
// import from src/, so business-knowledge.ts kept its own hand-written
// copy of the price sheet -- with a comment asking whoever changed prices
// to remember to update it. Nobody did. By the time of the cyan
// restructure that copy still listed 54 services at the old prices,
// including a $5 logo and a $1,000 dashboard, which is what Maya was
// quoting to customers while the website advertised something else.
//
// A comment is not a mechanism. This is: the file is regenerated on every
// build, so Maya quotes the same catalogue the site sells, and a price
// changed in one place cannot be stale in the other.
//
// The data is emitted on one line rather than pretty-printed. Nobody
// reads this file -- it says DO NOT EDIT at the top -- and every byte
// ships to the edge inside three separate function bundles.

import { writeFileSync } from "node:fs";
import {
  activeServices,
  categories,
  formatPrice,
  packages,
} from "../src/data/catalog.ts";

const grouped = categories.map((category) => ({
  category: category.label,
  items: activeServices
    .filter((service) => service.category === category.id)
    .map((service) => ({
      id: service.id,
      name: service.name,
      price: formatPrice(service),
      startingFrom: Boolean(service.startingFrom),
      summary: service.summary,
      limits: service.scopeLimits,
      deliverables: service.deliverables,
      inputs: service.customerInputs,
      delivery: service.deliveryEstimate,
      revisions: service.revisions,
      excludes: service.exclusions,
      externalCosts: "externalCosts" in service ? service.externalCosts : ["External subscriptions or licences, if separately agreed"],
    })),
}));

const bundles = packages.map((pkg) => ({
  id: pkg.id,
  name: pkg.name,
  price: formatPrice(pkg),
  included: pkg.included,
  excluded: pkg.excluded,
  delivery: "deliveryEstimate" in pkg ? pkg.deliveryEstimate : "Confirmed when the package scope is agreed",
  externalCosts: "externalCosts" in pkg ? pkg.externalCosts : ["External subscriptions or licences, if separately agreed"],
}));

const out = `// GENERATED FILE -- DO NOT EDIT.
//
// Written by scripts/generate-bot-catalog.mjs from src/data/catalog.ts on
// every build. Editing it by hand will be silently undone by the next
// build, and worse, it would let Maya quote prices the website does not
// charge. Change src/data/catalog.ts instead.

export interface BotCatalogItem {
  id: string;
  name: string;
  /** Already formatted, including the "From " prefix where it applies. */
  price: string;
  startingFrom: boolean;
  summary: string;
  limits: string[];
  deliverables: string[];
  inputs: string[];
  delivery: string;
  revisions: number;
  excludes: string[];
  externalCosts: string[];
}

export interface BotCatalogCategory {
  category: string;
  items: BotCatalogItem[];
}

export interface BotPackage {
  id: string;
  name: string;
  price: string;
  included: string[];
  excluded: string[];
  delivery: string;
  externalCosts: string[];
}

export const BOT_CATALOG: BotCatalogCategory[] = ${JSON.stringify(grouped)};

export const BOT_PACKAGES: BotPackage[] = ${JSON.stringify(bundles)};

export const BOT_SERVICE_COUNT = ${activeServices.length};
`;

writeFileSync(new URL("../supabase/functions/_shared/catalog-data.ts", import.meta.url), out);
console.log(
  `catalog-data.ts regenerated: ${activeServices.length} services, ${packages.length} packages`,
);
