// AgenticCore Agency — Finalized service price sheet, shared by the New
// Request wizard and the Packages tab's 50%-off add-on flow. Plain JS
// constants rather than a DB table: pricing is a display/computation
// concern, not something that should need a migration to change.
//
// Single standard price per service (the former 3-tier Low/Mid/High
// system was removed -- every price below is what used to be the Low
// tier's number). requests.tier is still a real, not-null DB column
// with a check constraint of ('low', 'mid', 'top') from before the
// tier system existed, but nothing here lets a client choose one
// anymore -- LEGACY_TIER_DB_VALUE is written on every new insert
// purely to satisfy that constraint, chosen as 'low' since that's
// exactly the value this pricing was already keyed on. Reusing an
// already-allowed value like this avoids a schema migration entirely.

const PRICING_CATALOG = [
  {
    category: 'Websites',
    items: [
      { name: 'Single landing page website', price: 50 },
      { name: 'Multi-page website (3-5 pages)', price: 150 },
      { name: 'Multi-page website (6-10 pages)', price: 300 },
      { name: 'E-commerce website', price: 800 },
      { name: 'Custom dashboard / web app', price: 1000 },
      { name: 'Website redesign', price: 200 },
      { name: 'Blog setup', price: 50 },
      { name: 'Domain + hosting setup (one-time)', price: 30 },
      { name: 'Website maintenance (monthly)', price: 20 }
    ]
  },
  {
    category: 'Design & Media',
    items: [
      { name: 'Logo design', price: 5 },
      { name: 'Business card design', price: 5 },
      { name: 'Letterhead or receipt design', price: 5 },
      { name: 'Brand style guide', price: 20 },
      { name: 'Social media single post', price: 5 },
      { name: 'Social media post pack (5 posts)', price: 25 },
      { name: 'Social media post pack (10 posts)', price: 50 },
      { name: 'Social media post pack (20 posts)', price: 75 },
      { name: 'Marketing banner', price: 5 },
      { name: 'Video (8-15 sec)', price: 15 },
      { name: 'Video (30-60 sec)', price: 40 },
      { name: 'Photo editing', price: 5 },
      { name: 'PDF proposal design', price: 15 },
      { name: 'PDF report design', price: 15 },
      { name: 'PDF brochure design', price: 25 },
      { name: 'Email (design)', price: 5 }
    ]
  },
  {
    category: 'Marketing',
    label: 'Marketing (AgenticCore Biz)',
    items: [
      { name: 'Social media handling (monthly)', price: 60 },
      { name: 'Auto social media posting (monthly)', price: 50 },
      { name: 'Marketing strategy & feasibility plan', price: 25 },
      { name: 'Full marketing management retainer (monthly)', price: 180 },
      { name: 'Ad campaign management (monthly)', price: 60 },
      { name: 'SEO optimization (one-time)', price: 60 },
      { name: 'SEO maintenance (monthly)', price: 50 },
      { name: 'AI marketing framework build', price: 350 },
      { name: 'AI marketing framework maintenance (monthly)', price: 50 },
      { name: 'Email marketing setup', price: 25 }
    ]
  },
  {
    category: 'Bookkeeping & Reports',
    items: [
      { name: 'Bookkeeping cleanup', price: 60 },
      { name: 'Ongoing bookkeeping (monthly)', price: 50 },
      { name: 'Monthly balance sheet', price: 30 },
      { name: 'Yearly balance sheet / annual report', price: 100 },
      { name: 'Invoicing & receipts setup', price: 25 },
      { name: 'Payroll setup', price: 50 },
      { name: 'Tax preparation support', price: 60 }
    ]
  },
  {
    category: 'Audits & Feasibility Reports',
    items: [
      { name: 'Business feasibility report', price: 40 },
      { name: 'Business audit', price: 50 },
      { name: 'Market research report', price: 40 },
      { name: 'Competitor analysis report', price: 30 },
      { name: 'Real estate project feasibility report', price: 100 }
    ]
  },
  {
    category: 'Custom AI Agents',
    items: [
      { name: 'Single-task AI agent', price: 150 },
      { name: 'Multi-agent framework (2-4 agents)', price: 500 },
      { name: 'Multi-agent framework (full business system)', price: 1000 },
      { name: 'Telegram/WhatsApp customer support agent', price: 200 },
      { name: 'Voice AI agent', price: 300 },
      { name: 'Agent hosting & maintenance (monthly)', price: 25 },
      { name: 'Framework handover (client owns & runs it)', price: 150 }
    ]
  }
];

// Single flat AgenticCore bundle package (the former Low $150 / Mid
// $300 / High $600 tiers collapsed into one) -- same deliverables as
// before, at the former Low tier's price.
const AGENTICCORE_PACKAGE = { label: 'AgenticCore Package', price: 150 };

// See the file-level comment above -- 'low' satisfies requests.tier's
// existing not-null check constraint; the tier concept it used to
// represent no longer exists anywhere else in the app.
const LEGACY_TIER_DB_VALUE = 'low';

function getCatalogCategory(category) {
  return PRICING_CATALOG.find((c) => c.category === category) || null;
}

function getCatalogItem(category, itemName) {
  const cat = getCatalogCategory(category);
  if (!cat) return null;
  return cat.items.find((i) => i.name === itemName) || null;
}
