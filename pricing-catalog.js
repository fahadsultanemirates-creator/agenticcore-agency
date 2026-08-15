// AgenticCore Agency — Finalized service price sheet, shared by the New
// Request wizard and the Packages tab's 50%-off add-on flow. Plain JS
// constants rather than a DB table: pricing is a display/computation
// concern, not something that should need a migration to change.
//
// Tier keys are 'low' / 'mid' / 'high' (matching the price sheet). The
// `requests.tier` column's check constraint expects 'low' | 'mid' | 'top'
// (see packages.js, which already maps its "High" package to 'top') --
// TIER_DB_VALUE below does that same mapping for catalog items.

const PRICING_CATALOG = [
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
    category: 'Marketing',
    label: 'Marketing (AgenticCore Biz)',
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

// Flat AgenticCore bundle packages -- quality-only tier difference, same
// deliverables at every tier (see packages.html / packages.js). Keyed by
// the same low/mid/top values already used in requests.tier.
const AGENTICCORE_PACKAGES = [
  { tier: 'low', label: 'AgenticCore Low', price: 150 },
  { tier: 'mid', label: 'AgenticCore Mid', price: 300 },
  { tier: 'top', label: 'AgenticCore High', price: 600 }
];

const TIER_LABELS = { low: 'Low — fast & essential', mid: 'Mid — balanced & customized', high: 'High — premium & hands-on' };

// requests.tier check constraint expects 'low' | 'mid' | 'top'.
function tierDbValue(tier) {
  return tier === 'high' ? 'top' : tier;
}

function getCatalogCategory(category) {
  return PRICING_CATALOG.find((c) => c.category === category) || null;
}

function getCatalogItem(category, itemName) {
  const cat = getCatalogCategory(category);
  if (!cat) return null;
  return cat.items.find((i) => i.name === itemName) || null;
}
