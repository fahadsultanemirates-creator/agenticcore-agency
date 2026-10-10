/**
 * Give every shareable route its own social preview.
 *
 * The problem this solves is specifically a crawler problem. index.html
 * carries one correct set of OG tags; every other URL is served the same
 * file by the SPA catch-all, so a link to /services/AG-16 previews as the
 * homepage. React fixing the tags at runtime does NOT help: WhatsApp,
 * Twitter, Facebook, LinkedIn and Slack read the HTML and never execute the
 * JavaScript. The tags have to be correct in the bytes on disk.
 *
 * So after the build, each route gets dist/<route>/index.html -- the same
 * built page with its own title, description and canonical URL. Netlify
 * serves a matching file ahead of the redirect rules, which is what makes
 * this work at all, and React Router still takes over once the page boots.
 *
 * Run as part of `npm run build`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { activeServices, categories, packages } from "../src/data/catalog.ts";

const DIST = new URL("../dist/", import.meta.url).pathname;
const ORIGIN = "https://agenticcore.agency";
const BRAND = "AgenticCore.agency";

const escapeHtml = (text) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Price as it reads in a preview: "$149" or "From $499". */
function price(item) {
  const money = `$${item.priceUsd.toLocaleString("en-US")}`;
  const from = item.startingFrom ? "From " : "";
  if (item.billing === "monthly") return `${from}${money}/month`;
  return `${from}${money}`;
}

const pages = [
  {
    path: "services",
    title: `All ${activeServices.length} services`,
    description: `Every service AgenticCore.agency builds — websites, dashboards, AI agents and automation — with the price and delivery estimate for each.`,
  },
  {
    path: "packages",
    title: "Packages",
    description: `${packages.map((b) => b.name).join(", ")} — bundles for the most common starting points, each priced below the services it contains.`,
  },
  {
    path: "request",
    title: "Start your project",
    description:
      "Pick a service, tell us what you need, and get a scope and price back. No account needed to start.",
  },
  {
    path: "forge",
    title: "Forge",
    description:
      "Describe the problem in your own words and Forge works out which services solve it, what it costs and how long it takes.",
  },
  {
    path: "terms",
    title: "Terms of Service",
    description:
      "Delivery, payment, ownership and liability — the important parts, without the legal padding.",
  },
  {
    path: "privacy",
    title: "Privacy Policy",
    description: "What we collect, why we collect it, and who else touches it.",
  },
  ...activeServices.map((service) => ({
    path: `services/${service.id}`,
    title: `${service.name} — ${price(service)}`,
    description: `${service.summary} Delivery: ${service.deliveryEstimate}.`,
  })),
  // No per-package pages. There is no /packages/:id route, so generating
  // preview HTML for one would publish a shareable URL that renders the
  // not-found page when a human actually clicks it -- worse than the
  // generic preview this script exists to fix.
];

/**
 * Swap one tag, and insist that it actually happened.
 *
 * A regex that quietly matches nothing is the failure mode that would
 * reintroduce the original bug with every test still green, so a miss is a
 * hard error rather than a warning.
 */
function replaceTag(html, pattern, replacement, label, file) {
  const matches = html.match(pattern);
  if (!matches) {
    throw new Error(`prerender: no ${label} tag found in ${file} — the template changed shape`);
  }
  if (matches.length > 1) {
    throw new Error(`prerender: ${matches.length} ${label} tags in ${file}; expected exactly one`);
  }
  return html.replace(pattern, replacement);
}

/**
 * Every generated page must correspond to a route the app can render.
 *
 * This is not hypothetical. The first version of this script generated
 * /packages/PKG-WEBSITE-STARTER previews, and there is no /packages/:id
 * route -- so it was publishing shareable URLs that render the not-found
 * page when a human clicks them. That is worse than the generic preview
 * this script exists to fix, and nothing would have reported it.
 */
function assertRoutesExist(paths) {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url).pathname, "utf8");
  const declared = [...appSource.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
  if (declared.length === 0) {
    throw new Error("prerender: parsed no routes out of App.tsx — the check would be vacuous");
  }

  // "/services/:id" matches "services/AG-16"; "/services" matches only itself.
  const matchers = declared.map((route) => {
    const pattern = route
      .replace(/^\//, "")
      .split("/")
      .map((segment) => (segment.startsWith(":") ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .join("/");
    return new RegExp(`^${pattern}$`);
  });

  const orphans = paths.filter((path) => !matchers.some((m) => m.test(path)));
  if (orphans.length > 0) {
    throw new Error(
      `prerender: these paths have no route in App.tsx, so a visitor would get the ` +
        `not-found page: ${orphans.join(", ")}`,
    );
  }
}

assertRoutesExist(pages.map((p) => p.path));

const template = readFileSync(join(DIST, "index.html"), "utf8");

// Sanity-check the template before generating 25 copies of a mistake.
for (const required of ["<title>", 'property="og:title"', 'rel="canonical"']) {
  if (!template.includes(required)) {
    throw new Error(`prerender: dist/index.html has no ${required}; nothing to rewrite`);
  }
}

let written = 0;
for (const page of pages) {
  const url = `${ORIGIN}/${page.path}`;
  const fullTitle = `${page.title} | ${BRAND}`;
  const title = escapeHtml(fullTitle);
  const description = escapeHtml(page.description);

  let html = template;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, "title", page.path);
  html = replaceTag(
    html,
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${description}" />`,
    "description",
    page.path,
  );
  html = replaceTag(
    html,
    /<link\s+rel="canonical"[\s\S]*?\/>/,
    `<link rel="canonical" href="${url}" />`,
    "canonical",
    page.path,
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:url"[\s\S]*?\/>/,
    `<meta property="og:url" content="${url}" />`,
    "og:url",
    page.path,
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:title"[\s\S]*?\/>/,
    `<meta property="og:title" content="${title}" />`,
    "og:title",
    page.path,
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${description}" />`,
    "og:description",
    page.path,
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:title"[\s\S]*?\/>/,
    `<meta name="twitter:title" content="${title}" />`,
    "twitter:title",
    page.path,
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:description"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${description}" />`,
    "twitter:description",
    page.path,
  );

  const out = join(DIST, page.path, "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  written++;
}

// A sitemap costs nothing now that the list of real URLs exists here.
const sitemap = [
  `${ORIGIN}/`,
  ...pages.filter((p) => !["terms", "privacy"].includes(p.path)).map((p) => `${ORIGIN}/${p.path}`),
  `${ORIGIN}/terms`,
  `${ORIGIN}/privacy`,
]
  .map((loc) => `  <url><loc>${loc}</loc></url>`)
  .join("\n");
writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap}\n</urlset>\n`,
);

console.log(`prerender: ${written} routes given their own preview, sitemap.xml written`);
