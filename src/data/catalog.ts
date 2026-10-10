import {
  Blocks,
  Bot,
  Boxes,
  BrainCircuit,
  Cable,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  MonitorSmartphone,
  Palette,
  PenTool,
  Phone,
  Plug,
  RefreshCw,
  Rocket,
  ServerCog,
  ShoppingCart,
  Workflow,
  type LucideIcon,
} from "lucide-react";

/**
 * Everything AgenticCore.agency sells, in one place.
 *
 * WHY THIS REPLACES src/data/services.ts. That file grouped 54 services
 * into six categories, and three of those categories -- bookkeeping,
 * audits and feasibility, monthly marketing -- are not Agency's work any
 * more. They belong to .biz. Agency builds the technology; .biz runs the
 * operations; .click does the fast, cheap, standardised tasks. Selling all
 * three from one site is what made Agency look like a general business
 * catalogue instead of a development company.
 *
 * WHY ONE FILE. The price of a thing used to live in services.ts for the
 * React pages and in public/pricing-catalog.js for the legacy ones, and
 * they drifted -- the same failure .biz had, where its dashboard was still
 * selling services the site had retired. Every surface reads this file:
 * the homepage, the directory, the detail pages, the dashboard, the
 * request wizard, Forge and the packages page.
 *
 * WHY RETIRED SERVICES STAY. requests.service_category and
 * requests.task_type are free text and requests.agreed_price is a numeric
 * snapshot, so an order placed against an old service keeps its own label
 * and its own price for ever. Retiring is a catalogue concern, not a
 * migration. The old entries live on in `archivedServices` so an old link
 * can explain itself instead of 404ing -- but nothing archived is
 * orderable.
 */

export type BillingType = "one_time" | "monthly" | "per_unit";

export type ServiceStatus = "active" | "archived";

export type ServiceCategoryId = "build" | "design" | "automate";

/** Where a request belongs when it is not Agency's work. */
export type SisterBrand = "click" | "biz";

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
  /** For per_unit billing: what one unit is ("page or screen"). */
  unit?: string;
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
  /**
   * Costs the customer pays somebody else. Naming them on the service,
   * not in a footnote, is the difference between a transparent price and
   * a surprise.
   */
  externalCosts: string[];
  deliveryEstimate: string;
  revisions: number;
  status: ServiceStatus;
  /** Shown in the homepage's featured six. */
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
  deliveryEstimate: string;
  revisions: number;
  /** What the customer still pays somebody else. */
  externalCosts: string[];
  cta: string;
};

// ---------------------------------------------------------------------
// Category A — Websites & digital products
// ---------------------------------------------------------------------

const BUILD: Service[] = [
  {
    id: "AG-01",
    name: "Professional Landing Page Development",
    category: "build",
    icon: Rocket,
    summary: "One responsive page that explains the offer and collects enquiries.",
    priceUsd: 49,
    billing: "one_time",
    featured: true,
    deliverables: [
      "One responsive landing page",
      "Professional layout and content organisation",
      "Standard contact call-to-action",
      "Basic SEO metadata (title, description, social preview)",
      "Deployment to a supported host",
    ],
    scopeLimits: [
      "A single page — not a multi-page site",
      "Content you supply, arranged and typeset by us",
      "One defined revision round",
    ],
    exclusions: [
      "Complex backend functionality",
      "Advanced third-party integrations",
      "Ongoing hosting, which is billed by your provider",
    ],
    customerInputs: ["Your copy, or notes we can write from", "Logo and any brand assets", "Where it should be deployed"],
    externalCosts: ["Domain registration", "Hosting beyond a supported free tier"],
    deliveryEstimate: "3–5 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-02",
    name: "Business Website, 3–5 Pages",
    category: "build",
    icon: Globe,
    summary: "A small professional site with navigation, content and a contact route.",
    priceUsd: 149,
    billing: "one_time",
    featured: true,
    deliverables: [
      "Three to five responsive pages",
      "Professional design and navigation",
      "Standard contact form or contact links",
      "Your supplied content integrated",
      "Basic SEO metadata across the pages",
      "Deployment to a supported host",
    ],
    scopeLimits: ["Five pages at most in the base scope", "One defined revision round"],
    exclusions: ["Custom backend systems", "E-commerce checkout", "Ongoing content updates"],
    customerInputs: ["Page list and content", "Logo and brand assets", "Domain details, if you have one"],
    externalCosts: ["Domain registration", "Third-party hosting charges"],
    deliveryEstimate: "5–10 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-03",
    name: "Business Website, 6–10 Pages",
    category: "build",
    icon: MonitorSmartphone,
    summary: "A larger site for a business with more to say.",
    priceUsd: 279,
    billing: "one_time",
    deliverables: [
      "Six to ten responsive pages",
      "Professional interface and navigation",
      "Standard forms",
      "Basic SEO metadata across the pages",
      "Mobile optimisation",
      "Deployment to a supported host",
    ],
    scopeLimits: ["Ten pages at most in the base scope", "One defined revision round"],
    exclusions: ["Complex custom functionality", "E-commerce checkout", "Ongoing content updates"],
    customerInputs: ["Page list and content", "Logo and brand assets", "Domain details, if you have one"],
    externalCosts: ["Domain registration", "Third-party hosting charges"],
    deliveryEstimate: "10–15 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-04",
    name: "Starter E-Commerce Website",
    category: "build",
    icon: ShoppingCart,
    summary: "A small storefront on a supported platform, with cart and payments.",
    priceUsd: 349,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "Small storefront on a supported platform",
      "A defined number of standard product listings",
      "Basic categories",
      "Shopping cart",
      "Supported payment integration",
    ],
    scopeLimits: [
      "The product count is fixed in your quotation before work starts",
      "Standard platform templates, styled — not a bespoke storefront",
      "One defined revision round",
    ],
    exclusions: [
      "Advanced custom development",
      "Bulk catalogue imports beyond the agreed count",
      "Stock, fulfilment and tax configuration beyond the basics",
    ],
    customerInputs: ["Product list, images and prices", "Your chosen payment provider", "Shipping and returns policy text"],
    externalCosts: ["Platform subscription", "Payment provider fees", "Domain and hosting"],
    deliveryEstimate: "10–20 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-05",
    name: "Website Redesign & Modernisation",
    category: "build",
    icon: RefreshCw,
    summary: "A visual and usability refresh of a site you already have.",
    priceUsd: 119,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "Visual refresh of up to three standard pages",
      "Mobile layout improvements",
      "Navigation refinements",
      "Basic usability and performance improvements",
    ],
    scopeLimits: ["Three pages in the base scope — more are quoted", "Your existing platform, not a rebuild on a new one"],
    exclusions: ["Backend migrations", "Complex redesigns and rebrands", "Content rewriting"],
    customerInputs: ["Access to the current site", "What you want changed", "Any new brand assets"],
    externalCosts: ["Your existing hosting and platform costs"],
    deliveryEstimate: "5–10 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-06",
    name: "Custom Dashboard / Web-App MVP",
    category: "build",
    icon: LayoutDashboard,
    summary: "A working first version of an internal tool or customer dashboard.",
    priceUsd: 399,
    billing: "one_time",
    startingFrom: true,
    featured: true,
    deliverables: [
      "One limited web application MVP",
      "Core dashboard screens",
      "One primary workflow, working end to end",
      "One defined data integration",
      "Deployment to a supported host",
    ],
    scopeLimits: [
      "An MVP: one workflow done properly, not a finished product",
      "Screens and data sources are fixed in the quotation",
      "One defined revision round",
    ],
    exclusions: [
      "Custom authentication schemes and complex access control",
      "Handling of sensitive or regulated data",
      "Financial transactions",
      "Enterprise requirements such as SSO, audit logging and SLAs",
    ],
    customerInputs: ["What the tool must do, and for whom", "Sample data or access to the source", "Who needs to log in"],
    externalCosts: ["Hosting", "Database and third-party service subscriptions"],
    deliveryEstimate: "15–25 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-07",
    name: "Domain Connection, Deployment & Hosting Setup",
    category: "build",
    icon: Plug,
    summary: "Getting something you already have onto a domain, live and secure.",
    priceUsd: 29,
    billing: "one_time",
    deliverables: [
      "Basic DNS configuration",
      "Domain connected to the site",
      "Deployment to one supported hosting provider",
      "Standard HTTPS configuration where the provider offers it",
    ],
    scopeLimits: ["One domain and one supported provider", "An existing site — we are not building one here"],
    exclusions: ["Domain purchase", "Provider subscriptions", "Email hosting and mailbox setup"],
    customerInputs: ["Registrar access or the ability to change DNS", "The site or repository to deploy"],
    externalCosts: ["Domain registration", "Hosting plan"],
    deliveryEstimate: "1–3 working days",
    revisions: 0,
    status: "active",
  },
  {
    id: "AG-08",
    name: "Website Maintenance & Monitoring",
    category: "build",
    icon: LifeBuoy,
    summary: "Someone watching the site, and one small change a month included.",
    priceUsd: 29,
    billing: "monthly",
    deliverables: [
      "Basic uptime monitoring",
      "Routine maintenance checks",
      "Minor supported updates",
      "One small defined maintenance task each month",
    ],
    scopeLimits: [
      "One small task per month — it does not roll over",
      "One site",
      "Cancel any time; billing stops at the end of the paid month",
    ],
    exclusions: ["Major redesigns", "Major bug fixes and incident recovery", "Content campaigns", "New feature development"],
    customerInputs: ["Access to the site and its host", "A contact for anything urgent"],
    externalCosts: ["Your hosting and domain costs"],
    deliveryEstimate: "Ongoing, monthly",
    revisions: 0,
    status: "active",
  },
];

// ---------------------------------------------------------------------
// Category B — Design & user experience
// ---------------------------------------------------------------------

const DESIGN: Service[] = [
  {
    id: "AG-09",
    name: "Professional Brand Identity Kit",
    category: "design",
    icon: Palette,
    summary: "A coordinated logo, palette and type system with usage guidance.",
    priceUsd: 49,
    billing: "one_time",
    deliverables: [
      "Logo concept with standard exports",
      "Brand colour palette",
      "Typography recommendations",
      "Basic usage guidance",
      "Two initial concept directions",
    ],
    scopeLimits: [
      "Two concept directions, then one revision round on the chosen one",
      "Standard export formats",
    ],
    exclusions: [
      "Trademark search and registration",
      "Print production and packaging artwork",
      "Full brand strategy",
    ],
    customerInputs: ["What the business does and who it is for", "Any colours or references you like", "Your business name as it should be set"],
    externalCosts: [
      "Commercial font licences, where a recommended typeface is not free to use",
    ],
    deliveryEstimate: "5–8 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-10",
    name: "UI/UX Design for Websites or Applications",
    category: "design",
    icon: PenTool,
    summary: "Designed screens you can hand to a developer, or to us.",
    priceUsd: 49,
    billing: "per_unit",
    unit: "page or screen",
    startingFrom: true,
    deliverables: [
      "One responsive page or application screen",
      "Coherent component styling",
      "Usability considerations documented",
      "Reviewable design files",
    ],
    scopeLimits: ["Priced per screen — the count is agreed up front", "One revision round per screen"],
    exclusions: ["Complex multi-screen design systems", "Interactive prototypes", "User research and testing"],
    customerInputs: ["What the screen is for", "Existing brand assets", "Any content that must appear"],
    externalCosts: ["Design tool seats, if you want editing access in your own account"],
    deliveryEstimate: "2–4 working days per screen",
    revisions: 1,
    status: "active",
  },
];

// ---------------------------------------------------------------------
// Category C — Automation, AI & integrations
// ---------------------------------------------------------------------

const AUTOMATE: Service[] = [
  {
    id: "AG-11",
    name: "CRM & Business Workflow Automation",
    category: "automate",
    icon: Workflow,
    summary: "One job that currently needs a human, done automatically.",
    priceUsd: 99,
    billing: "one_time",
    startingFrom: true,
    featured: true,
    deliverables: [
      "One defined automation across supported systems",
      "Configuration and testing",
      "A short written description of what it does and when",
    ],
    scopeLimits: [
      "One workflow — enquiry into CRM, lead notification, routine task creation",
      "Systems with a supported API",
    ],
    exclusions: ["Complex multi-system orchestration", "Systems with no API or an unsupported one"],
    customerInputs: ["Which tools are involved", "Access or an account we can be invited to", "What should happen, and when"],
    externalCosts: ["Subscriptions for the tools being connected", "Automation platform fees, where one is used"],
    deliveryEstimate: "3–7 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-12",
    name: "Telegram Business Bot",
    category: "automate",
    icon: MessageSquare,
    summary: "A bot that takes requests and tells you about them.",
    priceUsd: 99,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "One Telegram bot with a defined menu or conversation flow",
      "Request capture",
      "One supported notification or integration workflow",
      "Deployment and handover",
    ],
    scopeLimits: ["One bot, one flow", "Telegram only"],
    exclusions: ["Advanced AI behaviour", "Complex role and permission systems", "In-bot payments"],
    customerInputs: ["What the bot should ask and answer", "Where requests should go", "A Telegram account to own the bot"],
    externalCosts: ["Hosting for the bot", "Any model/API usage if AI is added later"],
    deliveryEstimate: "5–10 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-13",
    name: "WhatsApp Business API Integration",
    category: "automate",
    icon: MessageSquare,
    summary: "Connecting WhatsApp Business to the systems you already run.",
    priceUsd: 149,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "One supported WhatsApp Business API integration",
      "Defined message, enquiry or notification flow",
      "Configuration and testing",
    ],
    scopeLimits: [
      "One integration and one flow",
      "Subject to the provider approving your business account — which is their decision, not ours",
    ],
    exclusions: ["Unrestricted messaging", "Provider approval, which we assist with but cannot guarantee", "Message template approval timelines"],
    customerInputs: ["A WhatsApp Business account", "Business verification documents the provider asks for", "What the messages should say"],
    externalCosts: ["Provider subscription", "Per-conversation messaging charges"],
    deliveryEstimate: "7–14 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-14",
    name: "AI Website Chatbot / Assistant",
    category: "automate",
    icon: Bot,
    summary: "An assistant on your site that answers from your own information.",
    priceUsd: 129,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "One website assistant configured on business information you approve",
      "Standard FAQ handling",
      "One defined enquiry or human-handoff workflow",
      "Embed code and deployment",
    ],
    scopeLimits: ["One site", "Answers drawn from the material you supply"],
    exclusions: ["Complex integrations with internal systems", "Ongoing hosting", "Model usage charges"],
    customerInputs: ["The information it should answer from", "What it must never answer", "Where handoffs should go"],
    externalCosts: ["Model/API usage, billed by the provider", "Hosting for the assistant"],
    deliveryEstimate: "5–10 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-15",
    name: "Custom Single-Task AI Agent",
    category: "automate",
    icon: BrainCircuit,
    summary: "One agent that does one job properly, with the tools to do it.",
    priceUsd: 149,
    billing: "one_time",
    startingFrom: true,
    featured: true,
    deliverables: [
      "One purpose-built AI agent performing one defined task",
      "Connection to the supported tools it needs",
      "Basic configuration and testing",
      "Usage guidance",
    ],
    scopeLimits: [
      "One task, with its inputs and outputs agreed in advance",
      "Human approval on any step that changes something outside the agent",
    ],
    exclusions: ["Additional tools and integrations beyond the agreed set", "API operating costs", "Unsupervised authority over money or customer commitments"],
    customerInputs: ["The task, described end to end", "What triggers it", "Which tools it may use, and what it must ask before doing"],
    externalCosts: ["Model/API usage", "Hosting"],
    deliveryEstimate: "7–14 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-16",
    name: "Multi-Agent AI Framework",
    category: "automate",
    icon: Boxes,
    summary: "Two to four specialised agents with defined roles and a supervised handover.",
    priceUsd: 499,
    billing: "one_time",
    startingFrom: true,
    featured: true,
    deliverables: [
      "A tightly scoped prototype or framework",
      "Approximately two to four specialised agents with defined responsibilities",
      "Orchestration and inter-agent communication",
      "A supervised workflow with a review step",
      "Testing and handover documentation",
    ],
    scopeLimits: [
      "A prototype or framework, not an unlimited autonomous production system",
      "Architecture — central orchestration, collaborative or hybrid — chosen to fit the work",
      "A human reviews output before anything consequential happens",
    ],
    exclusions: [
      "Unsupervised authority over payments, contracts or customer commitments",
      "Unlimited agents or open-ended scope",
      "Ongoing model and infrastructure costs",
    ],
    customerInputs: [
      "The end-to-end process you want covered",
      "What each stage is responsible for",
      "Which decisions a person must still make",
    ],
    externalCosts: ["Model/API usage, which scales with how much the system runs", "Hosting and infrastructure"],
    deliveryEstimate: "20–35 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-17",
    name: "AI Voice Assistant",
    category: "automate",
    icon: Phone,
    summary: "A voice workflow that answers, routes and escalates to a person.",
    priceUsd: 249,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "One defined voice-assistant workflow",
      "Supported voice platform integration",
      "Basic conversation handling",
      "Agreed callback and escalation behaviour",
    ],
    scopeLimits: [
      "One workflow on one supported provider",
      "Consent and recording notices configured to the rules that apply where you operate",
    ],
    exclusions: ["Telephony numbers and minutes", "Speech model charges", "Legal advice on recording and consent obligations"],
    customerInputs: ["The call flow", "When it must hand over to a person", "Your recording and consent requirements"],
    externalCosts: ["Telephony provider and per-minute charges", "Speech and language model usage"],
    deliveryEstimate: "14–25 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-18",
    name: "Custom API / MCP Integration",
    category: "automate",
    icon: Cable,
    summary: "Two systems talking to each other, with the errors handled.",
    priceUsd: 199,
    billing: "one_time",
    startingFrom: true,
    deliverables: [
      "One limited integration with a supported external application, API or MCP-compatible tool or server",
      "Authentication configured appropriately",
      "Basic data mapping",
      "Error handling",
      "Tests",
    ],
    scopeLimits: [
      "One integration between two systems",
      "MCP is a standardised way to expose tools and resources to a model — it is not itself a multi-agent framework, and buying this does not get you one",
    ],
    exclusions: ["Single sign-on", "Sensitive or regulated data workflows", "Complex multi-platform integrations"],
    customerInputs: ["Which systems, and API access to both", "What data moves, in which direction", "What should happen when it fails"],
    externalCosts: ["Subscriptions for the systems being connected", "Any per-call API charges"],
    deliveryEstimate: "7–15 working days",
    revisions: 1,
    status: "active",
  },
  {
    id: "AG-19",
    name: "AI Systems Hosting & Maintenance",
    category: "automate",
    icon: ServerCog,
    summary: "Keeping one AI application or workflow running after it is built.",
    priceUsd: 39,
    billing: "monthly",
    startingFrom: true,
    deliverables: [
      "Basic monitoring",
      "Deployment support",
      "Routine maintenance checks",
      "Limited upkeep of one supported AI application or workflow",
    ],
    scopeLimits: [
      "One application or workflow",
      "Support within agreed limits, set out in your quotation",
      "Cancel any time; billing stops at the end of the paid month",
    ],
    exclusions: ["New feature development", "Infrastructure costs", "Model and API usage", "Third-party platform fees"],
    customerInputs: ["Access to the system and its host", "A contact for anything urgent"],
    externalCosts: ["Infrastructure", "Model/API usage", "Third-party platform costs, unless your quotation says otherwise"],
    deliveryEstimate: "Ongoing, monthly",
    revisions: 0,
    status: "active",
  },
];

export const services: Service[] = [...BUILD, ...DESIGN, ...AUTOMATE];

export const categories: {
  id: ServiceCategoryId;
  label: string;
  blurb: string;
  icon: LucideIcon;
}[] = [
  {
    id: "build",
    label: "Websites & Digital Products",
    blurb: "Landing pages, business sites, storefronts, dashboards and the hosting around them.",
    icon: Globe,
  },
  {
    id: "design",
    label: "Design & User Experience",
    blurb: "Brand identity and designed screens, ready to build from.",
    icon: Palette,
  },
  {
    id: "automate",
    label: "Automation, AI & Integrations",
    blurb: "Workflow automation, AI agents, bots, voice, APIs and MCP integrations.",
    icon: BrainCircuit,
  },
];

/**
 * The four capability cards on the homepage.
 *
 * Presentation, not taxonomy. The catalogue has three categories because
 * that is how the work divides; the homepage leads with four because
 * "AI agents" and "integrations" are different questions in a visitor's
 * head even though both are automation work. Each card points at real
 * services, so the two can never describe different things.
 */
export const capabilities: {
  id: string;
  title: string;
  blurb: string;
  cta: string;
  icon: LucideIcon;
  serviceIds: string[];
}[] = [
  {
    id: "websites",
    title: "Websites & E-Commerce",
    blurb:
      "Professional business websites, responsive landing pages, online stores and website modernisation.",
    cta: "Explore Websites",
    icon: Globe,
    // AG-09 lives here rather than under its own heading: a brand kit is
    // bought alongside a launch, and it is the other half of the
    // Website + Brand Launch package.
    serviceIds: ["AG-01", "AG-02", "AG-03", "AG-04", "AG-05", "AG-09"],
  },
  {
    id: "applications",
    title: "Custom Applications",
    blurb: "Business dashboards, web applications, internal tools and tailored software solutions.",
    cta: "Explore Applications",
    icon: LayoutDashboard,
    serviceIds: ["AG-06", "AG-10"],
  },
  {
    id: "ai",
    title: "AI Agents & Automation",
    blurb: "Purpose-built AI assistants, business agents, connected workflows and multi-agent systems.",
    cta: "Explore AI Solutions",
    icon: BrainCircuit,
    serviceIds: ["AG-14", "AG-15", "AG-16", "AG-17", "AG-11", "AG-12"],
  },
  {
    id: "integrations",
    title: "Integrations & Technical Support",
    blurb: "Connect applications, integrate APIs, deploy systems and keep your technology running.",
    cta: "Explore Integrations",
    icon: Blocks,
    serviceIds: ["AG-18", "AG-13", "AG-07", "AG-08", "AG-19"],
  },
];

// ---------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------

export const packages: Package[] = [
  {
    id: "PKG-WEBSITE-STARTER",
    name: "Website Starter",
    priceUsd: 149,
    billing: "one_time",
    audience: "A business that needs to exist properly online, and nothing more complicated.",
    included: [
      "Responsive website with 3–5 pages",
      "Standard navigation",
      "Contact form or contact links",
      "Basic SEO metadata",
      "Deployment to a supported platform",
      "One defined revision round",
    ],
    excluded: [
      "Domain purchase",
      "Third-party hosting charges",
      "Custom backend systems",
      "Advanced integrations",
    ],
    serviceIds: ["AG-02"],
    deliveryEstimate: "5–10 working days",
    revisions: 1,
    externalCosts: ["Domain registration", "Hosting beyond a supported free tier"],
    cta: "Start My Website",
  },
  {
    id: "PKG-WEBSITE-BRAND",
    name: "Website + Brand Launch",
    priceUsd: 189,
    billing: "one_time",
    audience: "A business launching from nothing, which needs the look as well as the site.",
    included: [
      "Everything in Website Starter",
      "Coordinated basic brand identity kit",
      "Logo concept with standard exports",
      "Colour palette",
      "Typography recommendations",
      "Basic brand usage guidance",
    ],
    excluded: ["Unlimited revisions", "Advanced brand strategy", "Custom software"],
    serviceIds: ["AG-02", "AG-09"],
    deliveryEstimate: "8–14 working days",
    revisions: 1,
    externalCosts: ["Domain registration", "Hosting", "Commercial font licences where applicable"],
    cta: "Launch My Digital Brand",
  },
  {
    id: "PKG-AUTOMATION-STARTER",
    name: "Automation Starter",
    priceUsd: 249,
    billing: "one_time",
    audience: "A business doing one repetitive job by hand that a machine should be doing.",
    included: [
      "One defined business automation workflow",
      "One supported external integration",
      "Basic configuration and testing",
      "A simple execution or notification process",
      "Setup documentation",
      "Agreed handover",
    ],
    excluded: [
      "Ongoing hosting",
      "Model and API credits",
      "Messaging fees",
      "Third-party subscriptions",
      "A full multi-agent framework",
    ],
    serviceIds: ["AG-11", "AG-18"],
    deliveryEstimate: "7–14 working days",
    revisions: 1,
    externalCosts: ["Hosting", "Model/API usage", "Subscriptions for the tools being connected"],
    cta: "Automate My Workflow",
  },
];

// ---------------------------------------------------------------------
// Retired
// ---------------------------------------------------------------------

/**
 * The 54 services Agency used to sell, and where each went.
 *
 * Not deleted, because an order placed against one still exists and an
 * old link should explain itself rather than 404. Nothing here is
 * orderable — serviceById() cannot return these, and the detail page
 * renders an explanation and a pointer instead of a buy button.
 */
export const archivedServices: {
  id: string;
  name: string;
  /** Where this work lives now: another Agency service, or a sister brand. */
  replacedBy?: string;
  movedTo?: SisterBrand;
  note: string;
}[] = [
  // Websites — folded into the new, clearer ladder
  { id: "LEGACY-WEB-LANDING", name: "Single landing page website", replacedBy: "AG-01", note: "Now AG-01, at a lower price with the scope written down." },
  { id: "LEGACY-WEB-3-5", name: "Multi-page website (3–5 pages)", replacedBy: "AG-02", note: "Now AG-02, at $149 rather than $150." },
  { id: "LEGACY-WEB-6-10", name: "Multi-page website (6–10 pages)", replacedBy: "AG-03", note: "Now AG-03, at $279 rather than $300." },
  { id: "LEGACY-WEB-ECOM", name: "E-commerce website", replacedBy: "AG-04", note: "Now AG-04, starting at $349 with the product count fixed in the quotation." },
  { id: "LEGACY-WEB-APP", name: "Custom dashboard / web app", replacedBy: "AG-06", note: "Now AG-06, scoped as an MVP from $399 rather than a flat $1,000." },
  { id: "LEGACY-WEB-REDESIGN", name: "Website redesign", replacedBy: "AG-05", note: "Now AG-05, from $119." },
  { id: "LEGACY-WEB-BLOG", name: "Blog setup", replacedBy: "AG-02", note: "Covered by a business website, or quoted as an addition." },
  { id: "LEGACY-WEB-SEO", name: "SEO setup", replacedBy: "AG-02", note: "Basic SEO metadata is included in every website service." },
  { id: "LEGACY-WEB-HOST", name: "Hosting & domain setup", replacedBy: "AG-07", note: "Now AG-07, at $29, covering DNS, deployment and HTTPS." },

  // Design & media — the cheap one-off creative work is .click's job
  { id: "LEGACY-DESIGN-LOGO", name: "Logo design", movedTo: "click", note: "A quick logo is faster and cheaper at AgenticCore.click. Agency's AG-09 is the full identity kit." },
  { id: "LEGACY-DESIGN-BRAND", name: "Brand identity kit", replacedBy: "AG-09", note: "Now AG-09, with two concept directions and written usage guidance." },
  { id: "LEGACY-DESIGN-SOCIAL", name: "Social media graphics", movedTo: "click", note: "Standardised creative work belongs to AgenticCore.click." },
  { id: "LEGACY-DESIGN-POSTER", name: "Poster / flyer design", movedTo: "click", note: "Standardised creative work belongs to AgenticCore.click." },
  { id: "LEGACY-DESIGN-BUSINESS-CARD", name: "Business card design", movedTo: "click", note: "Standardised creative work belongs to AgenticCore.click." },
  { id: "LEGACY-DESIGN-PRESENTATION", name: "Presentation design", movedTo: "click", note: "Standardised creative work belongs to AgenticCore.click." },
  { id: "LEGACY-DESIGN-PDF", name: "PDF document design", movedTo: "click", note: "Standardised creative work belongs to AgenticCore.click." },
  { id: "LEGACY-DESIGN-IMAGE", name: "AI image generation", movedTo: "click", note: "Standardised creative work belongs to AgenticCore.click." },
  { id: "LEGACY-DESIGN-VIDEO", name: "Short promotional video", movedTo: "click", note: "Standardised creative work belongs to AgenticCore.click." },
  { id: "LEGACY-DESIGN-UI", name: "UI/UX design", replacedBy: "AG-10", note: "Now AG-10, priced per page or screen so the count is agreed up front." },

  // Marketing — ongoing marketing operations are .biz's job
  { id: "LEGACY-MKT-SOCIAL-MGMT", name: "Social media management", movedTo: "biz", note: "Running marketing month to month is AgenticCore.biz. Agency builds the tools behind it." },
  { id: "LEGACY-MKT-ADS", name: "Advertising campaign management", movedTo: "biz", note: "Running campaigns is AgenticCore.biz." },
  { id: "LEGACY-MKT-EMAIL", name: "Email campaign management", movedTo: "biz", note: "Running campaigns is AgenticCore.biz." },
  { id: "LEGACY-MKT-CONTENT", name: "Content writing", movedTo: "biz", note: "Ongoing content is AgenticCore.biz; one-off copy is AgenticCore.click." },
  { id: "LEGACY-MKT-SEO-ONGOING", name: "Ongoing SEO", movedTo: "biz", note: "Ongoing marketing operations are AgenticCore.biz." },
  { id: "LEGACY-MKT-LEADS", name: "Lead generation & follow-up", movedTo: "biz", note: "Managed follow-up is AgenticCore.biz. Agency can automate it — see AG-11." },

  // Bookkeeping, audits, feasibility — all .biz
  { id: "LEGACY-BOOK-SETUP", name: "Bookkeeping setup", movedTo: "biz", note: "Bookkeeping is AgenticCore.biz." },
  { id: "LEGACY-BOOK-MONTHLY", name: "Monthly bookkeeping", movedTo: "biz", note: "Bookkeeping is AgenticCore.biz." },
  { id: "LEGACY-BOOK-PAYROLL", name: "Payroll administration", movedTo: "biz", note: "Payroll administration is AgenticCore.biz." },
  { id: "LEGACY-BOOK-REPORTS", name: "Financial & KPI reports", movedTo: "biz", note: "Reporting is AgenticCore.biz." },
  { id: "LEGACY-BOOK-INVOICING", name: "Invoicing & quotations setup", movedTo: "biz", note: "Invoicing setup is AgenticCore.biz." },
  { id: "LEGACY-AUDIT-FEASIBILITY", name: "Business feasibility study", movedTo: "biz", note: "Feasibility and market research are AgenticCore.biz." },
  { id: "LEGACY-AUDIT-MARKET", name: "Market & competitor research", movedTo: "biz", note: "Feasibility and market research are AgenticCore.biz." },
  { id: "LEGACY-AUDIT-PROCESS", name: "Business process audit", movedTo: "biz", note: "Operational audits are AgenticCore.biz." },
  { id: "LEGACY-AUDIT-ADMIN", name: "Office administration setup", movedTo: "biz", note: "Office administration is AgenticCore.biz." },

  // Agents — kept, but re-scoped
  { id: "LEGACY-AGENT-CHATBOT", name: "Website chatbot", replacedBy: "AG-14", note: "Now AG-14, from $129, answering from information you approve." },
  { id: "LEGACY-AGENT-TELEGRAM", name: "Telegram bot", replacedBy: "AG-12", note: "Now AG-12, from $99, with one defined conversation flow." },
  { id: "LEGACY-AGENT-WHATSAPP", name: "WhatsApp integration", replacedBy: "AG-13", note: "Now AG-13, from $149, subject to provider approval of your account." },
  { id: "LEGACY-AGENT-CUSTOM", name: "Custom AI agent", replacedBy: "AG-15", note: "Now AG-15, from $149 with the task defined up front." },
  { id: "LEGACY-AGENT-MULTI", name: "Multi-agent system", replacedBy: "AG-16", note: "Now AG-16, scoped as a two-to-four agent framework from $499." },
  { id: "LEGACY-AGENT-VOICE", name: "Voice assistant", replacedBy: "AG-17", note: "Now AG-17, from $249, with consent and escalation behaviour agreed." },
  { id: "LEGACY-AGENT-AUTOMATION", name: "Workflow automation", replacedBy: "AG-11", note: "Now AG-11, from $99 for one defined automation." },

  // The old flagship package
  { id: "LEGACY-PKG-BUSINESS-SETUP", name: "All-in-one business setup ($150)", movedTo: "biz", note: "Starting and running a business is AgenticCore.biz. Agency's packages build the technology." },
];

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

export const activeServices = services.filter((s) => s.status === "active");

export const featuredServices = activeServices.filter((s) => s.featured);

export const SERVICE_COUNT = activeServices.length;

export function servicesIn(category: ServiceCategoryId): Service[] {
  return activeServices.filter((s) => s.category === category);
}

/** Active services only. An archived id returns undefined on purpose. */
export function serviceById(id: string): Service | undefined {
  return activeServices.find((s) => s.id === id);
}

export function packageById(id: string): Package | undefined {
  return packages.find((p) => p.id === id);
}

export function archivedById(id: string) {
  return archivedServices.find((s) => s.id === id);
}

/** True where the published figure is a floor and the real price is quoted. */
export function needsQuote(service: Service): boolean {
  return Boolean(service.startingFrom);
}

export function formatPrice(item: Service | Package): string {
  const money = `$${item.priceUsd.toLocaleString("en-US")}`;
  const from = "startingFrom" in item && item.startingFrom ? "From " : "";
  if (item.billing === "monthly") return `${from}${money}/month`;
  if (item.billing === "per_unit") {
    const unit = "unit" in item && item.unit ? item.unit : "unit";
    return `${from}${money} per ${unit}`;
  }
  return `${from}${money}`;
}
