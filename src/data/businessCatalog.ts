import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  Coins,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Headset,
  LineChart,
  Mail,
  Megaphone,
  Receipt,
  Search,
  Target,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * THE catalog. One source of truth for every service and package.
 *
 * The homepage, the public directory, the dashboard, the order forms and
 * Maya all read from here. Nothing re-states a price anywhere else --
 * the legacy site kept its prices in public/pricing-catalog.js AND in the
 * copy of three different pages, which is how a site ends up advertising
 * a number its checkout does not charge.
 *
 * WHAT THE DATABASE DOES AND DOES NOT KNOW. There is no services table.
 * requests.service_category and requests.task_type are free text and
 * requests.agreed_price is a numeric copied in at order time, so every
 * historical order already carries its own snapshot of what was bought
 * and what it cost. That is lucky, and it means retiring a service is a
 * catalog concern rather than a migration: old rows keep reading
 * correctly whatever happens here, and nothing in this file can change
 * what a past customer was charged.
 */

export type BillingType = "one_time" | "monthly";

export type ServiceStatus =
  /** Orderable now. */
  | "active"
  /**
   * Was sold, is not any more. Kept so historical orders still resolve
   * to a name and a description, and so an old deep link can say "this
   * is retired" instead of 404ing. Never offered, never orderable.
   */
  | "archived";

export type ServiceCategoryId = "launch" | "admin" | "growth";

export type Service = {
  /** Stable, human-readable, and what an order record should reference. */
  id: string;
  name: string;
  category: ServiceCategoryId;
  icon: LucideIcon;
  /** One line, for a card. */
  summary: string;
  priceUsd: number;
  billing: BillingType;
  /**
   * True where the published figure is a floor rather than the price.
   * The order flow must send these for a quote instead of charging.
   */
  startingFrom?: boolean;
  deliverables: string[];
  /** What the base scope covers — the limits, stated as limits. */
  scopeLimits: string[];
  /** What it explicitly is not, so nobody buys the wrong thing. */
  exclusions: string[];
  /** What we need from the customer before work can start. */
  customerInputs: string[];
  deliveryEstimate: string;
  revisions: number;
  status: ServiceStatus;
  /** Shown on the homepage's featured six. */
  featured?: boolean;
};

export type Package = {
  id: string;
  name: string;
  priceUsd: number;
  billing: BillingType;
  audience: string;
  included: string[];
  excluded: string[];
  /** Services this package draws on, where it maps onto one. */
  serviceIds: string[];
  /**
   * Monthly packages need their terms on screen wherever they are sold.
   * Null for one-time.
   */
  terms: string | null;
};

// ---------------------------------------------------------------------
// CATEGORY 1 — Business launch & planning
// ---------------------------------------------------------------------

const LAUNCH: Service[] = [
  {
    id: "BIZ-01",
    name: "Startup Roadmap & Business Action Plan",
    category: "launch",
    icon: Briefcase,
    summary: "A written plan for getting the business off the ground, with the order of work set out.",
    priceUsd: 25,
    billing: "one_time",
    deliverables: [
      "Business concept summary",
      "Target customer profile",
      "Basic business model outline",
      "Launch priorities",
      "Action checklist and suggested milestones",
      "Downloadable PDF",
    ],
    scopeLimits: ["One business concept", "One defined market", "One revision"],
    exclusions: ["Legal, tax or investment advice", "Company registration", "Financial projections for investors"],
    customerInputs: ["What the business sells", "Who it is for", "Any work already done"],
    deliveryEstimate: "2–4 working days",
    revisions: 1,
    featured: true,
    status: "active",
  },
  {
    id: "BIZ-02",
    name: "Business Feasibility & Market-Fit Report",
    category: "launch",
    icon: Search,
    summary: "Whether the idea stands up, written down with the reasoning shown.",
    priceUsd: 39,
    billing: "one_time",
    deliverables: [
      "Business model assessment",
      "Customer and demand assumptions",
      "Competitor overview",
      "Basic cost and revenue scenario framework",
      "Key business risks",
      "Recommendations and next steps",
    ],
    scopeLimits: ["One business model", "One market"],
    exclusions: [
      "This is a research and planning document, not an investment guarantee",
      "Not a professionally certified financial feasibility study",
      "No audited or assured figures",
    ],
    customerInputs: ["The business idea", "Target market", "Any cost figures you already have"],
    deliveryEstimate: "4–7 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "BIZ-03",
    name: "Market & Competitor Research",
    category: "launch",
    icon: LineChart,
    summary: "Who else is doing this, what they charge, and where the gap is.",
    priceUsd: 29,
    billing: "one_time",
    deliverables: [
      "One market or sector reviewed",
      "Up to five relevant competitors where reliable information is available",
      "Positioning comparison",
      "Market opportunities",
      "Research limitations and cited sources where appropriate",
      "Downloadable report",
    ],
    scopeLimits: ["One market or sector", "Up to five competitors"],
    exclusions: [
      "Findings are never invented — where reliable data is not available, the report says so",
      "No paid third-party market data unless separately agreed",
    ],
    customerInputs: ["Your market or sector", "Competitors you already know of"],
    deliveryEstimate: "3–5 working days",
    revisions: 1,
    featured: true,
    status: "active",
  },
  {
    id: "BIZ-04",
    name: "Business Registration Preparation Checklist",
    category: "launch",
    icon: ClipboardList,
    summary: "What you will need to gather before registering, for your own jurisdiction.",
    priceUsd: 19,
    billing: "one_time",
    deliverables: [
      "Country/jurisdiction-specific preparation checklist",
      "Common documentation categories",
      "Registration research and official-resource links when available",
      "Steps you may need to take",
      "Questions to verify with a local professional",
    ],
    scopeLimits: ["One jurisdiction"],
    exclusions: [
      "Does NOT include legal incorporation or government filings",
      "Does NOT include business-license procurement",
      "Does NOT constitute legal advice",
    ],
    customerInputs: ["Country and, where relevant, state or emirate", "Intended business activity"],
    deliveryEstimate: "2–4 working days",
    revisions: 1,
    status: "archived",
  },
  {
    id: "BIZ-05",
    name: "Business Administration Starter System",
    category: "launch",
    icon: Workflow,
    summary: "The files and trackers a small business needs on day one, set up and explained.",
    priceUsd: 39,
    billing: "one_time",
    deliverables: [
      "Basic administrative record templates",
      "Task tracker",
      "Customer and supplier register templates",
      "Document organization structure",
      "Simple office workflow checklist",
      "Usage guide",
      "Downloadable, reusable files",
    ],
    scopeLimits: ["One business", "Standard templates adapted to your details"],
    exclusions: ["Custom software", "Ongoing administration — explore AgenticCore Group"],
    customerInputs: ["Business name and details", "How you currently keep records, if at all"],
    deliveryEstimate: "3–5 working days",
    revisions: 1,
    featured: true,
    status: "active",
  },
  {
    id: "BIZ-06",
    name: "Standard Operating Procedures Pack",
    category: "launch",
    icon: FileText,
    summary: "Write down how the work gets done, so somebody else can do it.",
    priceUsd: 29,
    billing: "one_time",
    deliverables: [
      "Up to three simple SOPs for workflows you define",
      "Responsibilities and process steps",
      "Checklists",
      "Basic review and escalation guidance",
      "Editable documents",
    ],
    scopeLimits: ["Up to three straightforward workflows"],
    exclusions: [
      "Complex, regulated or operationally critical processes need additional review and a separate quote",
      "Not a compliance or safety certification",
    ],
    customerInputs: ["Which workflows to document", "Who does what today"],
    deliveryEstimate: "3–5 working days",
    revisions: 1,
    status: "active",
  },
];

// ---------------------------------------------------------------------
// CATEGORY 2 — Office & financial administration
// ---------------------------------------------------------------------

const ADMIN: Service[] = [
  {
    id: "BIZ-07",
    name: "Invoicing, Quotations & Receipts Setup",
    category: "admin",
    icon: Receipt,
    summary: "Branded paperwork that goes out looking like a real company.",
    priceUsd: 19,
    billing: "one_time",
    deliverables: [
      "Branded invoice template",
      "Quotation template",
      "Receipt template",
      "Numbering guidance",
      "Basic payment status tracker",
    ],
    scopeLimits: ["One brand", "Standard templates"],
    exclusions: [
      "Does not include specialized tax compliance",
      "Does not include accounting-system integration",
    ],
    customerInputs: ["Logo and business details", "Payment terms you use"],
    deliveryEstimate: "2–3 working days",
    revisions: 1,
    featured: true,
    status: "active",
  },
  {
    id: "BIZ-08",
    name: "Expense & Cash-Flow Tracking System",
    category: "admin",
    icon: Wallet,
    summary: "Know what went out, what came in, and what is left.",
    priceUsd: 29,
    billing: "one_time",
    deliverables: [
      "Expense tracker",
      "Income tracker",
      "Cash-flow summary template",
      "Basic category structure",
      "Usage instructions",
    ],
    scopeLimits: ["Spreadsheet or another suitable lightweight format", "One business"],
    exclusions: ["Not an accounting system", "No bank-feed integration"],
    customerInputs: ["Your expense categories, if you have them", "Preferred spreadsheet tool"],
    deliveryEstimate: "2–4 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "BIZ-09",
    name: "Payroll Administration Tracker",
    category: "admin",
    icon: Users,
    summary: "Keep track of who gets paid what, and when.",
    priceUsd: 29,
    billing: "one_time",
    deliverables: [
      "Employee payment tracker",
      "Salary summary template",
      "Payment schedule",
      "Payroll data checklist",
    ],
    scopeLimits: ["Administrative tracking only"],
    exclusions: [
      "NOT statutory payroll processing",
      "NOT tax computation",
      "NOT labor-law compliance or employer filing",
    ],
    customerInputs: ["Number of employees", "Pay cycle"],
    deliveryEstimate: "2–4 working days",
    revisions: 1,
    status: "archived",
  },
  {
    id: "BIZ-10",
    name: "Bookkeeping Setup or Basic Cleanup",
    category: "admin",
    icon: FileSpreadsheet,
    summary: "Get the books into a shape somebody can actually read.",
    priceUsd: 49,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "Basic transaction categorization",
      "Up to 30 straightforward transactions",
      "Simple opening-balance and record-organization review",
      "Basic ledger structure",
      "Summary of missing information",
    ],
    scopeLimits: ["Up to 30 straightforward transactions in the base scope"],
    exclusions: [
      "Complex reconciliation, historical cleanup and professional accounting work are quoted separately",
      "No tax filing or statutory reporting",
    ],
    customerInputs: ["Your existing records, in whatever state they are in"],
    deliveryEstimate: "Scope-dependent — confirmed on quotation",
    revisions: 1,
    status: "archived",
  },
  {
    id: "BIZ-11",
    name: "Monthly Basic Bookkeeping Assistance",
    category: "admin",
    icon: FileSpreadsheet,
    summary: "The books kept straight each month, from the records you send.",
    priceUsd: 59,
    billing: "monthly",
    deliverables: [
      "Up to 30 routine transactions per service month",
      "Categorization based on the records you supply",
      "Basic record organization",
      "Monthly activity summary",
      "Missing-document checklist",
    ],
    scopeLimits: ["Up to 30 routine transactions per service month"],
    exclusions: [
      "Professional accounting sign-off is excluded",
      "Tax filing and statutory reporting are excluded",
      "Audit assurance is excluded",
    ],
    customerInputs: ["Monthly records, receipts and statements"],
    deliveryEstimate: "Within the service month",
    revisions: 1,
    status: "archived",
  },
  {
    id: "BIZ-12",
    name: "Monthly Financial & KPI Reports",
    category: "admin",
    icon: BarChart3,
    summary: "One report a month that says how the business is actually doing.",
    priceUsd: 29,
    billing: "monthly",
    deliverables: [
      "One monthly report",
      "Summary based on the financial and operational records you supply",
      "Revenue and expense overview, where the data exists",
      "Up to five agreed KPI indicators",
      "Downloadable PDF",
    ],
    scopeLimits: ["One report per service month", "Up to five KPIs"],
    exclusions: ["These are NOT audited financial statements", "No assurance or sign-off"],
    customerInputs: ["Monthly figures", "Which KPIs matter to you"],
    deliveryEstimate: "Within the service month",
    revisions: 1,
    status: "archived",
  },
  {
    id: "BIZ-13",
    name: "Business Proposals & Professional Documents",
    category: "admin",
    icon: FileSignature,
    summary: "A proposal or company profile that looks like it came from a real business.",
    priceUsd: 25,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "One proposal, company profile or professional business document",
      "Up to five pages",
      "Built from facts and references you provide",
      "Professional structure and formatting",
      "One revision",
    ],
    scopeLimits: ["One document", "Up to five pages in the base scope"],
    exclusions: [
      "Legal contracts and regulated documents need professional review and a separate scope",
      "Facts are never invented — the document is built from what you supply",
    ],
    customerInputs: ["The content and facts to include", "Brand assets"],
    deliveryEstimate: "Scope-dependent — confirmed on quotation",
    revisions: 1,
    featured: true,
    status: "active",
  },
];

// ---------------------------------------------------------------------
// CATEGORY 3 — Business management & growth
// ---------------------------------------------------------------------

const GROWTH: Service[] = [
  {
    id: "BIZ-14",
    name: "CRM Customer Records & Pipeline Setup",
    category: "growth",
    icon: Users,
    summary: "Stop losing enquiries in an inbox.",
    priceUsd: 39,
    billing: "one_time",
    deliverables: [
      "Standard customer information fields",
      "Lead stages and pipeline",
      "Follow-up reminders or a manual workflow",
      "Basic operating guide",
    ],
    scopeLimits: ["An existing supported platform or a standardized template", "One pipeline"],
    exclusions: [
      "Custom software development belongs to AgenticCore.agency",
      "Bespoke API integrations belong to AgenticCore.agency",
    ],
    customerInputs: ["How you handle enquiries today", "Your sales stages"],
    deliveryEstimate: "3–5 working days",
    revisions: 1,
    featured: true,
    status: "active",
  },
  {
    id: "BIZ-15",
    name: "AI-Assisted Virtual Back-Office Support",
    category: "growth",
    icon: Headset,
    summary: "Defined administrative hours each month, so the paperwork keeps moving.",
    priceUsd: 99,
    billing: "monthly",
    deliverables: [
      "Up to three hours of defined administrative support per month",
      "Records organization",
      "Simple document processing",
      "Task coordination",
      "Routine status reports",
      "Agreed administrative follow-ups",
    ],
    scopeLimits: ["Up to three hours per service month", "Work defined in advance"],
    exclusions: [
      "No unlimited assistant availability",
      "No sensitive decision-making on your behalf",
      "No unauthorized account access",
    ],
    customerInputs: ["Which tasks to cover", "Access to the systems involved, where appropriate"],
    deliveryEstimate: "Ongoing, within the service month",
    revisions: 0,
    status: "archived",
  },
  {
    id: "BIZ-16",
    name: "Lead Research & Follow-Up Management",
    category: "growth",
    icon: Target,
    summary: "A researched list and a follow-up process you approved.",
    priceUsd: 79,
    billing: "monthly",
    deliverables: [
      "One defined customer segment",
      "Up to 25 researched prospects, subject to lawful access and reliable sources",
      "One limited follow-up workflow, approved by you",
      "Basic status tracking",
      "Monthly summary",
    ],
    scopeLimits: ["One segment", "Up to 25 prospects per service month"],
    exclusions: [
      "No guaranteed qualified leads, meetings or sales",
      "Work complies with privacy, anti-spam and applicable communications regulations",
      "No scraped or unlawfully obtained contact data",
    ],
    customerInputs: ["Who your customer is", "What you want the follow-up to say"],
    deliveryEstimate: "Ongoing, within the service month",
    revisions: 0,
    status: "archived",
  },
  {
    id: "BIZ-17",
    name: "Managed Social Media Marketing",
    category: "growth",
    icon: Megaphone,
    summary: "One channel planned, posted and reported on, month after month.",
    priceUsd: 99,
    billing: "monthly",
    deliverables: [
      "One business brand",
      "One social channel",
      "Basic monthly content plan",
      "Eight planned posts using your material and/or agreed AI-assisted creative work",
      "Scheduling and posting where supported",
      "Basic performance summary",
    ],
    scopeLimits: ["One brand", "One channel", "Eight posts per service month"],
    exclusions: [
      "Paid advertising is separate — see BIZ-18",
      "Additional channels, extra posts and premium media production are separate",
      "Third-party subscriptions are separate",
      "This is ongoing marketing MANAGEMENT, not one-off creative production — single images, posters and short videos belong to AgenticCore.click",
    ],
    customerInputs: ["Brand assets", "Channel access", "What you want said"],
    deliveryEstimate: "Ongoing, within the service month",
    revisions: 0,
    status: "archived",
  },
  {
    id: "BIZ-18",
    name: "Advertising Campaign Management",
    category: "growth",
    icon: Coins,
    summary: "One campaign on one platform, watched and reported on.",
    priceUsd: 79,
    billing: "monthly",
    deliverables: [
      "One advertising platform",
      "One standard campaign",
      "Basic audience and campaign setup",
      "Routine monitoring",
      "Monthly performance summary",
    ],
    scopeLimits: ["One platform", "One standard campaign"],
    exclusions: [
      "Advertising spend is NOT included",
      "Campaign setup, creative assets and complex tracking integrations may need additional scope",
      "No guaranteed ROI, leads or sales",
    ],
    customerInputs: ["Ad account access", "Budget", "What you are advertising"],
    deliveryEstimate: "Ongoing, within the service month",
    revisions: 0,
    status: "archived",
  },
  {
    id: "BIZ-19",
    name: "Email Campaign Management",
    category: "growth",
    icon: Mail,
    summary: "Two campaigns a month to a list that asked to hear from you.",
    priceUsd: 49,
    billing: "monthly",
    deliverables: [
      "One small opt-in mailing list",
      "Up to two simple campaigns per service month",
      "Content preparation",
      "Campaign scheduling",
      "Basic delivery and engagement reporting",
    ],
    scopeLimits: ["One list", "Up to two campaigns per service month"],
    exclusions: [
      "Email-platform subscription costs are separate",
      "Consent-based lists only — we comply with applicable privacy and anti-spam laws",
      "No purchased or scraped lists",
    ],
    customerInputs: ["Your opt-in list", "Platform access", "What you want to send"],
    deliveryEstimate: "Ongoing, within the service month",
    revisions: 0,
    status: "archived",
  },
];

export const services: Service[] = [...LAUNCH, ...ADMIN, ...GROWTH];

export const categories: { id: ServiceCategoryId; label: string; blurb: string; icon: LucideIcon }[] = [
  {
    id: "launch",
    label: "Business Launch & Planning",
    blurb: "Startup roadmaps, feasibility, research and setup preparation.",
    icon: Briefcase,
  },
  {
    id: "admin",
    label: "Office & Financial Administration",
    blurb: "Invoice templates, expense trackers and professional documents.",
    icon: Building2,
  },
  {
    id: "growth",
    label: "Customer Records & Setup",
    blurb: "One-time customer record and pipeline setup.",
    icon: Target,
  },
];

// ---------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------

export const packages: Package[] = [
  {
    id: "PKG-LAUNCH-KIT",
    name: "Business Launch Kit",
    priceUsd: 69,
    billing: "one_time",
    audience: "New entrepreneurs and early-stage small businesses.",
    serviceIds: ["BIZ-01", "BIZ-03", "BIZ-07", "BIZ-05"],
    included: [
      "Startup roadmap and business action plan",
      "Concise competitor snapshot",
      "Basic invoice, quotation and receipt templates",
      "Administrative workflow starter guide",
      "Business launch checklist",
      "One revision round on the combined package",
    ],
    excluded: [
      "Company incorporation",
      "Legal or tax advice",
      "A custom website — a quick one is AgenticCore.click, a professional one is AgenticCore.agency",
      "Complete bookkeeping",
      "Ongoing business management",
    ],
    terms: null,
  },
];

// ---------------------------------------------------------------------
// The catalog that was
// ---------------------------------------------------------------------

/**
 * The twelve AI-marketing services .biz used to sell.
 *
 * Archived, not deleted. Three reasons, and the first is the one that
 * matters: an order placed last month stored its service name as text,
 * and a customer looking at that order should still see what it was
 * rather than a blank. Second, an old link or bookmark can be answered
 * with "this is retired" instead of a 404. Third, deleting them would
 * make it impossible to tell a retired service from a typo.
 *
 * Nothing here is orderable. `activeServices` is what the site offers,
 * and it filters on status, so an archived entry cannot reach a card, a
 * dropdown, a checkout or Maya by accident.
 *
 * Several of these have a successor in the new catalog and say so, since
 * the common case is a customer asking what happened to the thing they
 * used to buy.
 */
export const archivedServices: { id: string; name: string; replacedBy?: string; note: string }[] = [
  { id: "LEGACY-CHATBOT", name: "AI Chatbot / Website Assistant", note: "Retired. Conversational build work is AgenticCore.agency." },
  { id: "LEGACY-VOICE", name: "AI Voice Agent (Phone Answering)", note: "Retired. Voice agent build work is AgenticCore.agency." },
  { id: "LEGACY-REPUTATION", name: "AI Reputation & Review Management", note: "Retired." },
  { id: "LEGACY-SOCIAL", name: "AI Social Media Management", replacedBy: "BIZ-17", note: "Continues as Managed Social Media Marketing." },
  { id: "LEGACY-SEO", name: "AI SEO Content & Optimization", note: "Retired as a standing service." },
  { id: "LEGACY-COPY", name: "AI Website & Landing Page Copy", note: "Retired. Page copy belongs with the site build at AgenticCore.agency." },
  { id: "LEGACY-VIDEO", name: "AI Short-Form Video Ads (UGC-style)", note: "Retired. Single videos are AgenticCore.click." },
  { id: "LEGACY-LEADGEN", name: "AI Lead Generation & Outreach", replacedBy: "BIZ-16", note: "Continues as Lead Research & Follow-Up Management." },
  { id: "LEGACY-PPC", name: "AI-Assisted PPC / Ad Management", replacedBy: "BIZ-18", note: "Continues as Advertising Campaign Management." },
  { id: "LEGACY-EMAIL", name: "AI Email Marketing Automation", replacedBy: "BIZ-19", note: "Continues as Email Campaign Management." },
  { id: "LEGACY-ANALYTICS", name: "AI Marketing Analytics Dashboard", replacedBy: "BIZ-12", note: "Continues as Monthly Financial & KPI Reports." },
  { id: "LEGACY-CRO", name: "AI Conversion Rate Optimization (CRO) & A/B Testing", note: "Retired." },
];

// ---------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------

/** Everything orderable. The only list the public site should render. */
export const activeServices = services.filter((s) => s.status === "active");

export const featuredServices = activeServices.filter((s) => s.featured);

export function servicesIn(category: ServiceCategoryId): Service[] {
  return activeServices.filter((s) => s.category === category);
}

/**
 * A service by id, matched without regard to case.
 *
 * It used to be an exact === comparison, which meant /services/biz-01
 * returned HTTP 200 and then rendered the not-found page: the static
 * file at /services/BIZ-01/ did not match, the SPA catch-all served the
 * app, and this lookup found nothing. Every service page broke that way
 * for any link that had been lowercased -- by a person typing it, a
 * campaign tool, or a crawler normalising URLs.
 *
 * Being lenient here is right; ServiceDetail still redirects to the
 * canonical casing so there is only ever one URL in an index.
 */
export function serviceById(id: string): Service | undefined {
  const wanted = id.trim().toLowerCase();
  return activeServices.find((s) => s.id.toLowerCase() === wanted);
}

export function packageById(id: string): Package | undefined {
  const wanted = id.trim().toLowerCase();
  return packages.find((p) => p.id.toLowerCase() === wanted);
}

/** Retired, so a stale link can say so rather than 404. */
export function archivedById(id: string) {
  const wanted = id.trim().toLowerCase();
  const retired = services.find((s) => s.status === "archived" && s.id.toLowerCase() === wanted);
  if (retired) return { id: retired.id, name: retired.name, note: "This service is no longer sold here. Explore managed offices and framework options at https://agenticcore.group/services.html.", replacedBy: undefined };
  const legacy = archivedServices.find((s) => s.id.toLowerCase() === wanted);
  if (legacy?.replacedBy && !serviceById(legacy.replacedBy)) return { ...legacy, replacedBy: undefined, note: "This service is no longer sold here. Explore https://agenticcore.group/services.html for office and framework options." };
  return legacy;
}

export const SERVICE_COUNT = activeServices.length;

/**
 * What a price looks like on screen.
 *
 * "from $49" and "$99/month" are different promises from "$25", and the
 * difference decides whether the order flow can charge or has to quote.
 */
export function formatPrice(service: Service | Package): string {
  const amount = `$${service.priceUsd}`;
  const suffix = service.billing === "monthly" ? "/month" : "";
  const prefix = "startingFrom" in service && service.startingFrom ? "from " : "";
  return `${prefix}${amount}${suffix}`;
}

/**
 * Whether ordering this can take payment, or has to go for a quote
 * first. A "from" price is a floor, and charging it as if it were the
 * price is how a customer ends up underpaying for work already started.
 */
export function needsQuote(service: Service): boolean {
  return service.startingFrom === true;
}

/**
 * The caveat that has to travel with "every price is published".
 *
 * The homepage said "Six of the most-ordered services. Every price is
 * published" directly above a grid containing BIZ-10 at "from $49" -- a
 * figure that is explicitly not the final price. "Most-ordered" was also a
 * ranking claim with nothing behind it.
 *
 * Derived rather than written, so if the catalogue ever has no "from"
 * prices the caveat disappears on its own, and if one is added to a list
 * that had none it appears.
 */
export function hasStartingFromPrice(items: readonly Service[]): boolean {
  return items.some((s) => Boolean(s.startingFrom));
}

/** How many of the given services are quoted rather than fixed. */
export function startingFromCount(items: readonly Service[]): number {
  return items.filter((s) => Boolean(s.startingFrom)).length;
}

export const PRICE_CAVEAT =
  "A price shown as “from” is a starting point — we quote the scope in writing before anything is charged.";
