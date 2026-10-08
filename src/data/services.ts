import {
  Bot,
  Calculator,
  Globe,
  Megaphone,
  Palette,
  SearchCheck,
  type LucideIcon,
} from "lucide-react";

export type ServiceCategory = {
  id: string;
  label: string;
  tagline: string;
  icon: LucideIcon;
  /** Lowest real price in the category, from the catalogue below. */
  fromUsd: number;
  /** Highest real price, so the card can say what the range actually is. */
  toUsd: number;
  /** Typical turnaround. Nothing here is twenty minutes. */
  eta: string;
  /** The line that says what the category is for, on the card. */
  detail: string;
  items: { name: string; price: number }[];
};

// The real price sheet, ported from public/pricing-catalog.js.
//
// Still the single source of truth for what things cost, and still kept
// as code rather than a table: pricing is a display and computation
// concern, and putting it in the database would mean a migration every
// time a number moves. The legacy pages read the .js copy; the React
// pages read this one. They have to agree, and the moment the request
// wizard is rebuilt in React the .js copy goes.
//
// Grouped by category rather than listed flat, because fifty services in
// one grid is a price list, not a landing page. The category is what
// somebody chooses; the item is what they order once inside.
export const serviceCategories: ServiceCategory[] = [
  {
    id: "websites",
    label: "Websites",
    tagline: "Landing pages to full web apps.",
    icon: Globe,
    fromUsd: 20,
    toUsd: 1000,
    eta: "3–14 days",
    detail: "Built, written and deployed live — including e-commerce and custom dashboards.",
    items: [
      { name: "Single landing page website", price: 50 },
      { name: "Multi-page website (3-5 pages)", price: 150 },
      { name: "Multi-page website (6-10 pages)", price: 300 },
      { name: "E-commerce website", price: 800 },
      { name: "Custom dashboard / web app", price: 1000 },
      { name: "Website redesign", price: 200 },
      { name: "Blog setup", price: 50 },
      { name: "Domain + hosting setup (one-time)", price: 30 },
      { name: "Website maintenance (monthly)", price: 20 },
    ],
  },
  {
    id: "design",
    label: "Design & Media",
    tagline: "Logos, brand, social, video, print.",
    icon: Palette,
    fromUsd: 5,
    toUsd: 75,
    eta: "1–3 days",
    detail: "The whole visual side of a business, from a $5 logo to a 20-post social pack.",
    items: [
      { name: "Logo design", price: 5 },
      { name: "Business card design", price: 5 },
      { name: "Letterhead or receipt design", price: 5 },
      { name: "Brand style guide", price: 20 },
      { name: "Social media single post", price: 5 },
      { name: "Social media post pack (5 posts)", price: 25 },
      { name: "Social media post pack (10 posts)", price: 50 },
      { name: "Social media post pack (20 posts)", price: 75 },
      { name: "Marketing banner", price: 5 },
      { name: "Video (8-15 sec)", price: 15 },
      { name: "Video (30-60 sec)", price: 40 },
      { name: "Photo editing", price: 5 },
      { name: "PDF proposal design", price: 15 },
      { name: "PDF report design", price: 15 },
      { name: "PDF brochure design", price: 25 },
      { name: "Email (design)", price: 5 },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    tagline: "Campaigns, SEO and the systems behind them.",
    icon: Megaphone,
    fromUsd: 25,
    toUsd: 350,
    eta: "Ongoing, monthly",
    detail: "Run for you month to month, or built once and handed over.",
    items: [
      { name: "Social media handling (monthly)", price: 60 },
      { name: "Auto social media posting (monthly)", price: 50 },
      { name: "Marketing strategy & feasibility plan", price: 25 },
      { name: "Full marketing management retainer (monthly)", price: 180 },
      { name: "Ad campaign management (monthly)", price: 60 },
      { name: "SEO optimization (one-time)", price: 60 },
      { name: "SEO maintenance (monthly)", price: 50 },
      { name: "AI marketing framework build", price: 350 },
      { name: "AI marketing framework maintenance (monthly)", price: 50 },
      { name: "Email marketing setup", price: 25 },
    ],
  },
  {
    id: "bookkeeping",
    label: "Bookkeeping & Reports",
    tagline: "Books, balance sheets, payroll, tax.",
    icon: Calculator,
    fromUsd: 25,
    toUsd: 100,
    eta: "2–7 days",
    detail: "Cleanup once, or kept straight every month.",
    items: [
      { name: "Bookkeeping cleanup", price: 60 },
      { name: "Ongoing bookkeeping (monthly)", price: 50 },
      { name: "Monthly balance sheet", price: 30 },
      { name: "Yearly balance sheet / annual report", price: 100 },
      { name: "Invoicing & receipts setup", price: 25 },
      { name: "Payroll setup", price: 50 },
      { name: "Tax preparation support", price: 60 },
    ],
  },
  {
    id: "audits",
    label: "Audits & Feasibility",
    tagline: "Know whether it works before you build it.",
    icon: SearchCheck,
    fromUsd: 30,
    toUsd: 100,
    eta: "3–7 days",
    detail: "Market research, competitor analysis and feasibility, written up properly.",
    items: [
      { name: "Business feasibility report", price: 40 },
      { name: "Business audit", price: 50 },
      { name: "Market research report", price: 40 },
      { name: "Competitor analysis report", price: 30 },
      { name: "Real estate project feasibility report", price: 100 },
    ],
  },
  {
    id: "agents",
    label: "Custom AI Agents",
    tagline: "Software that does the job, not advice about it.",
    icon: Bot,
    fromUsd: 25,
    toUsd: 1000,
    eta: "1–4 weeks",
    detail: "One agent or a whole framework — hosted by us, or handed over for you to run.",
    items: [
      { name: "Single-task AI agent", price: 150 },
      { name: "Multi-agent framework (2-4 agents)", price: 500 },
      { name: "Multi-agent framework (full business system)", price: 1000 },
      { name: "Telegram/WhatsApp customer support agent", price: 200 },
      { name: "Voice AI agent", price: 300 },
      { name: "Agent hosting & maintenance (monthly)", price: 25 },
      { name: "Framework handover (client owns & runs it)", price: 150 },
    ],
  },
];

/** The one bundle, as the legacy packages page sells it. */
export const AGENTICCORE_PACKAGE = { label: "AgenticCore Package", priceUsd: 150 };

/** Every individual service we sell, across all categories. */
export const SERVICE_COUNT = serviceCategories.reduce((n, c) => n + c.items.length, 0);

/** The cheapest thing on the whole sheet, for the hero's "from" line. */
export const CHEAPEST_USD = Math.min(...serviceCategories.flatMap((c) => c.items.map((i) => i.price)));
