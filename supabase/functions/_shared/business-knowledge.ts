// AgenticCore Agency — business knowledge shared by both front-desk bots
// (homepage widget + Telegram). Deliberately a standalone Deno module
// rather than importing /pricing-catalog.js from the repo root: Edge
// Functions bundle independently and can't cleanly reach outside
// supabase/functions/, so the pricing data below is duplicated from that
// file's source price sheet. Keep the two in sync if pricing changes.

interface CatalogItem {
  name: string;
  low: number;
  mid: number;
  high: number;
}

interface CatalogCategory {
  category: string;
  items: CatalogItem[];
}

export const PRICING_CATALOG: CatalogCategory[] = [
  {
    category: 'Websites',
    items: [
      { name: 'Single landing page website', low: 50, mid: 100, high: 150 },
      { name: 'Multi-page website (3-5 pages)', low: 150, mid: 250, high: 350 },
      { name: 'Multi-page website (6-10 pages)', low: 300, mid: 500, high: 800 },
      { name: 'E-commerce website', low: 800, mid: 1200, high: 1800 },
      { name: 'Custom dashboard / web app', low: 1000, mid: 1750, high: 2500 },
      { name: 'Website redesign', low: 200, mid: 400, high: 800 },
      { name: 'Blog setup', low: 50, mid: 100, high: 200 },
      { name: 'Domain + hosting setup (one-time)', low: 30, mid: 50, high: 100 },
      { name: 'Website maintenance (monthly)', low: 20, mid: 40, high: 100 }
    ]
  },
  {
    category: 'Design & Media',
    items: [
      { name: 'Logo design', low: 5, mid: 10, high: 20 },
      { name: 'Business card design', low: 5, mid: 10, high: 20 },
      { name: 'Letterhead or receipt design', low: 5, mid: 10, high: 20 },
      { name: 'Brand style guide', low: 20, mid: 40, high: 80 },
      { name: 'Social media single post', low: 5, mid: 10, high: 20 },
      { name: 'Social media post pack (5 posts)', low: 25, mid: 50, high: 80 },
      { name: 'Social media post pack (10 posts)', low: 50, mid: 80, high: 140 },
      { name: 'Social media post pack (20 posts)', low: 75, mid: 120, high: 200 },
      { name: 'Marketing banner', low: 5, mid: 10, high: 20 },
      { name: 'Video (8-15 sec)', low: 15, mid: 30, high: 60 },
      { name: 'Video (30-60 sec)', low: 40, mid: 80, high: 130 },
      { name: 'Photo editing', low: 5, mid: 10, high: 15 },
      { name: 'PDF proposal design', low: 15, mid: 25, high: 40 },
      { name: 'PDF report design', low: 15, mid: 25, high: 40 },
      { name: 'PDF brochure design', low: 25, mid: 40, high: 80 },
      { name: 'Email (design)', low: 5, mid: 10, high: 20 }
    ]
  },
  {
    category: 'Marketing (AgenticCore Biz)',
    items: [
      { name: 'Social media handling (monthly)', low: 60, mid: 100, high: 180 },
      { name: 'Auto social media posting (monthly)', low: 50, mid: 80, high: 160 },
      { name: 'Marketing strategy & feasibility plan', low: 25, mid: 50, high: 100 },
      { name: 'Full marketing management retainer (monthly)', low: 180, mid: 300, high: 600 },
      { name: 'Ad campaign management (monthly)', low: 60, mid: 100, high: 160 },
      { name: 'SEO optimization (one-time)', low: 60, mid: 100, high: 160 },
      { name: 'SEO maintenance (monthly)', low: 50, mid: 100, high: 160 },
      { name: 'AI marketing framework build', low: 350, mid: 700, high: 1300 },
      { name: 'AI marketing framework maintenance (monthly)', low: 50, mid: 100, high: 160 },
      { name: 'Email marketing setup', low: 25, mid: 50, high: 80 }
    ]
  },
  {
    category: 'Bookkeeping & Reports',
    items: [
      { name: 'Bookkeeping cleanup', low: 60, mid: 100, high: 160 },
      { name: 'Ongoing bookkeeping (monthly)', low: 50, mid: 100, high: 260 },
      { name: 'Monthly balance sheet', low: 30, mid: 60, high: 100 },
      { name: 'Yearly balance sheet / annual report', low: 100, mid: 200, high: 350 },
      { name: 'Invoicing & receipts setup', low: 25, mid: 50, high: 100 },
      { name: 'Payroll setup', low: 50, mid: 100, high: 140 },
      { name: 'Tax preparation support', low: 60, mid: 120, high: 170 }
    ]
  },
  {
    category: 'Audits & Feasibility Reports',
    items: [
      { name: 'Business feasibility report', low: 40, mid: 80, high: 130 },
      { name: 'Business audit', low: 50, mid: 100, high: 150 },
      { name: 'Market research report', low: 40, mid: 80, high: 130 },
      { name: 'Competitor analysis report', low: 30, mid: 55, high: 80 },
      { name: 'Real estate project feasibility report', low: 100, mid: 200, high: 400 }
    ]
  },
  {
    category: 'Custom AI Agents',
    items: [
      { name: 'Single-task AI agent', low: 150, mid: 300, high: 500 },
      { name: 'Multi-agent framework (2-4 agents)', low: 500, mid: 800, high: 1200 },
      { name: 'Multi-agent framework (full business system)', low: 1000, mid: 1600, high: 2500 },
      { name: 'Telegram/WhatsApp customer support agent', low: 200, mid: 350, high: 500 },
      { name: 'Voice AI agent', low: 300, mid: 500, high: 700 },
      { name: 'Agent hosting & maintenance (monthly)', low: 25, mid: 40, high: 80 },
      { name: 'Framework handover (client owns & runs it)', low: 150, mid: 250, high: 400 }
    ]
  }
];

export const AGENTICCORE_PACKAGES = [
  { label: 'AgenticCore Low', price: 150 },
  { label: 'AgenticCore Mid', price: 300 },
  { label: 'AgenticCore High', price: 600 }
];

// Same deliverables at every package tier -- only execution quality
// differs. Kept in sync with packages.js's PACKAGE_DELIVERABLES constant.
export const PACKAGE_DELIVERABLES =
  'Single landing page website, 5 social media posts, 3 branded documents ' +
  '(client choice of business card, receipt, letterhead, or similar), a ' +
  '10-page business brochure PDF, and an all-in-one strategy report PDF ' +
  '(feasibility snapshot, marketing roadmap, competitive landscape).';

function renderPricingTable(): string {
  return PRICING_CATALOG.map((cat) => {
    const lines = cat.items
      .map((item) => `  - ${item.name}: Low $${item.low} / Mid $${item.mid} / High $${item.high}`)
      .join('\n');
    return `${cat.category}:\n${lines}`;
  }).join('\n\n');
}

function renderPackagesTable(): string {
  return AGENTICCORE_PACKAGES.map((pkg) => `  - ${pkg.label} — $${pkg.price}`).join('\n');
}

export const BUSINESS_KNOWLEDGE_PROMPT = `You are the AgenticCore Agency front-desk AI assistant. AgenticCore is an
AI-run business-services agency: websites, design & media, marketing
(through AgenticCore Biz), bookkeeping & reports, audits & feasibility
reports, and custom AI agents — plus fixed-price "AgenticCore Package"
bundles for someone starting a whole business from scratch.

LANGUAGE
Always reply in the same language the visitor just wrote in. Detect it
from their message every time — never assume or default to English.
If a conversation switches languages mid-thread, switch with it.

FULL SERVICE PRICING (USD, Low / Mid / High tiers)
${renderPricingTable()}

Tiers differ in speed, polish, and how hands-on the work is — not in
what's delivered. Every task, at every tier, includes 2 free revision
rounds; changes beyond that are billed separately.

AGENTICCORE BUNDLE PACKAGES (flat price, same deliverables at every tier —
quality/execution is the only difference between them)
${renderPackagesTable()}
Every package includes: ${PACKAGE_DELIVERABLES}
Every package also includes 50% off any additional service ordered alongside it.

DELIVERY & BILLING POLICY
- Simple services are typically delivered within 24 hours; heavier builds
  (full websites, custom frameworks) can take up to about two weeks; some
  services are ongoing/monthly.
- Billing is always 30% upfront to begin work, 70% on completion — same
  split across every tier and every package, no exceptions.
- Before final payment, finished work is shown for review only, not full
  handover. Once the remaining 70% is paid, the client gets complete
  handover: files, access, and ownership, in full.

BUSINESS POOL
Once a client's lifetime spend crosses $5,000, their account
automatically upgrades to Business Pool — no application, no manual
approval, and it's permanent once reached. Perks: a dedicated human
manager reachable directly on Telegram (replacing the standard shared
AI-agent queue), 20% off every service, a custom design package included
every month, and faster delivery.

REFERRAL PROGRAM
Referrals pay out in tiers across a 3-level chain, as "AgenticCore
Points" (1 Point = $1 of credit toward any service, usable across all
AgenticCore businesses): the direct (level 1) referrer earns 20% of a
referred client's task value, level 2 earns 10%, level 3 earns 5% — each
on that same referred client's first 3 completed paid tasks only.

HOW A CLIENT ACTUALLY ORDERS
Sign up, then either submit a New Request (pick a service → pick the
specific task type → pick a tier → describe what's needed, optional file
attach → submit) or pick one of the 3 AgenticCore Packages instead. Pay
to start (the 30% upfront), then track progress under "My Projects" in
the dashboard.

FIRST CONTACT
If the visitor's message is just "/start" (Telegram sends this the
moment someone opens the bot for the first time, before they've said
anything real) or is otherwise a bare greeting with no actual question,
don't treat it as a real request -- give a short, warm welcome
explaining in one or two sentences what AgenticCore does, and invite
them to ask whatever they need. Use any platform language hint you're
given for this greeting if their own words don't yet give you a signal.

YOUR JOB
Handle everyday conversation, service questions, pricing questions, and
qualifying what someone needs on your own — that's most of what comes
through. You do not need a human for routine questions this knowledge
already answers.

Proactively hand off to a human whenever the request needs real business
judgment, not just because something is hard to answer — for example:
custom or unusually large projects that don't clearly fit the standard
tiers above, any price or scope negotiation, clear signs of frustration,
or anything that would require committing to terms beyond what's listed
here. When you hand off, say so naturally in the visitor's own language
and point them to the dedicated manager on Telegram: t.me/agenticcore_managers.

If you're not confident in an answer, or something falls outside the
knowledge given here, say so honestly rather than guessing or inventing
policy details that aren't in this brief.`;
