// GENERATED FILE -- DO NOT EDIT.
//
// Written by scripts/generate-bot-catalog.mjs from src/data/catalog.ts on
// every build. Editing it by hand will be silently undone by the next
// build, and worse, it would let Forge quote prices the website does not
// charge. Change src/data/catalog.ts instead.

export interface BotCatalogItem {
  id: string;
  name: string;
  /** Already formatted, including the "From " prefix where it applies. */
  price: string;
  startingFrom: boolean;
  summary: string;
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

export const BOT_CATALOG: BotCatalogCategory[] = [
  {
    "category": "Websites & Digital Products",
    "items": [
      {
        "id": "AG-01",
        "name": "Professional Landing Page Development",
        "price": "$49",
        "startingFrom": false,
        "summary": "One responsive page that explains the offer and collects enquiries.",
        "delivery": "3–5 working days",
        "revisions": 1,
        "excludes": [
          "Complex backend functionality",
          "Advanced third-party integrations",
          "Ongoing hosting, which is billed by your provider"
        ],
        "externalCosts": [
          "Domain registration",
          "Hosting beyond a supported free tier"
        ]
      },
      {
        "id": "AG-02",
        "name": "Business Website, 3–5 Pages",
        "price": "$149",
        "startingFrom": false,
        "summary": "A small professional site with navigation, content and a contact route.",
        "delivery": "5–10 working days",
        "revisions": 1,
        "excludes": [
          "Custom backend systems",
          "E-commerce checkout",
          "Ongoing content updates"
        ],
        "externalCosts": [
          "Domain registration",
          "Third-party hosting charges"
        ]
      },
      {
        "id": "AG-03",
        "name": "Business Website, 6–10 Pages",
        "price": "$279",
        "startingFrom": false,
        "summary": "A larger site for a business with more to say.",
        "delivery": "10–15 working days",
        "revisions": 1,
        "excludes": [
          "Complex custom functionality",
          "E-commerce checkout",
          "Ongoing content updates"
        ],
        "externalCosts": [
          "Domain registration",
          "Third-party hosting charges"
        ]
      },
      {
        "id": "AG-04",
        "name": "Starter E-Commerce Website",
        "price": "From $349",
        "startingFrom": true,
        "summary": "A small storefront on a supported platform, with cart and payments.",
        "delivery": "10–20 working days",
        "revisions": 1,
        "excludes": [
          "Advanced custom development",
          "Bulk catalogue imports beyond the agreed count",
          "Stock, fulfilment and tax configuration beyond the basics"
        ],
        "externalCosts": [
          "Platform subscription",
          "Payment provider fees",
          "Domain and hosting"
        ]
      },
      {
        "id": "AG-05",
        "name": "Website Redesign & Modernisation",
        "price": "From $119",
        "startingFrom": true,
        "summary": "A visual and usability refresh of a site you already have.",
        "delivery": "5–10 working days",
        "revisions": 1,
        "excludes": [
          "Backend migrations",
          "Complex redesigns and rebrands",
          "Content rewriting"
        ],
        "externalCosts": [
          "Your existing hosting and platform costs"
        ]
      },
      {
        "id": "AG-06",
        "name": "Custom Dashboard / Web-App MVP",
        "price": "From $399",
        "startingFrom": true,
        "summary": "A working first version of an internal tool or customer dashboard.",
        "delivery": "15–25 working days",
        "revisions": 1,
        "excludes": [
          "Custom authentication schemes and complex access control",
          "Handling of sensitive or regulated data",
          "Financial transactions",
          "Enterprise requirements such as SSO, audit logging and SLAs"
        ],
        "externalCosts": [
          "Hosting",
          "Database and third-party service subscriptions"
        ]
      },
      {
        "id": "AG-07",
        "name": "Domain Connection, Deployment & Hosting Setup",
        "price": "$29",
        "startingFrom": false,
        "summary": "Getting something you already have onto a domain, live and secure.",
        "delivery": "1–3 working days",
        "revisions": 0,
        "excludes": [
          "Domain purchase",
          "Provider subscriptions",
          "Email hosting and mailbox setup"
        ],
        "externalCosts": [
          "Domain registration",
          "Hosting plan"
        ]
      },
      {
        "id": "AG-08",
        "name": "Website Maintenance & Monitoring",
        "price": "$29/month",
        "startingFrom": false,
        "summary": "Someone watching the site, and one small change a month included.",
        "delivery": "Ongoing, monthly",
        "revisions": 0,
        "excludes": [
          "Major redesigns",
          "Major bug fixes and incident recovery",
          "Content campaigns",
          "New feature development"
        ],
        "externalCosts": [
          "Your hosting and domain costs"
        ]
      }
    ]
  },
  {
    "category": "Design & User Experience",
    "items": [
      {
        "id": "AG-09",
        "name": "Professional Brand Identity Kit",
        "price": "$49",
        "startingFrom": false,
        "summary": "A coordinated logo, palette and type system with usage guidance.",
        "delivery": "5–8 working days",
        "revisions": 1,
        "excludes": [
          "Trademark search and registration",
          "Print production and packaging artwork",
          "Full brand strategy"
        ],
        "externalCosts": [
          "Commercial font licences, where a recommended typeface is not free to use"
        ]
      },
      {
        "id": "AG-10",
        "name": "UI/UX Design for Websites or Applications",
        "price": "From $49 per page or screen",
        "startingFrom": true,
        "summary": "Designed screens you can hand to a developer, or to us.",
        "delivery": "2–4 working days per screen",
        "revisions": 1,
        "excludes": [
          "Complex multi-screen design systems",
          "Interactive prototypes",
          "User research and testing"
        ],
        "externalCosts": [
          "Design tool seats, if you want editing access in your own account"
        ]
      }
    ]
  },
  {
    "category": "Automation, AI & Integrations",
    "items": [
      {
        "id": "AG-11",
        "name": "CRM & Business Workflow Automation",
        "price": "From $99",
        "startingFrom": true,
        "summary": "One job that currently needs a human, done automatically.",
        "delivery": "3–7 working days",
        "revisions": 1,
        "excludes": [
          "Complex multi-system orchestration",
          "Systems with no API or an unsupported one"
        ],
        "externalCosts": [
          "Subscriptions for the tools being connected",
          "Automation platform fees, where one is used"
        ]
      },
      {
        "id": "AG-12",
        "name": "Telegram Business Bot",
        "price": "From $99",
        "startingFrom": true,
        "summary": "A bot that takes requests and tells you about them.",
        "delivery": "5–10 working days",
        "revisions": 1,
        "excludes": [
          "Advanced AI behaviour",
          "Complex role and permission systems",
          "In-bot payments"
        ],
        "externalCosts": [
          "Hosting for the bot",
          "Any model/API usage if AI is added later"
        ]
      },
      {
        "id": "AG-13",
        "name": "WhatsApp Business API Integration",
        "price": "From $149",
        "startingFrom": true,
        "summary": "Connecting WhatsApp Business to the systems you already run.",
        "delivery": "7–14 working days",
        "revisions": 1,
        "excludes": [
          "Unrestricted messaging",
          "Provider approval, which we assist with but cannot guarantee",
          "Message template approval timelines"
        ],
        "externalCosts": [
          "Provider subscription",
          "Per-conversation messaging charges"
        ]
      },
      {
        "id": "AG-14",
        "name": "AI Website Chatbot / Assistant",
        "price": "From $129",
        "startingFrom": true,
        "summary": "An assistant on your site that answers from your own information.",
        "delivery": "5–10 working days",
        "revisions": 1,
        "excludes": [
          "Complex integrations with internal systems",
          "Ongoing hosting",
          "Model usage charges"
        ],
        "externalCosts": [
          "Model/API usage, billed by the provider",
          "Hosting for the assistant"
        ]
      },
      {
        "id": "AG-15",
        "name": "Custom Single-Task AI Agent",
        "price": "From $149",
        "startingFrom": true,
        "summary": "One agent that does one job properly, with the tools to do it.",
        "delivery": "7–14 working days",
        "revisions": 1,
        "excludes": [
          "Additional tools and integrations beyond the agreed set",
          "API operating costs",
          "Unsupervised authority over money or customer commitments"
        ],
        "externalCosts": [
          "Model/API usage",
          "Hosting"
        ]
      },
      {
        "id": "AG-16",
        "name": "Multi-Agent AI Framework",
        "price": "From $499",
        "startingFrom": true,
        "summary": "Two to four specialised agents with defined roles and a supervised handover.",
        "delivery": "20–35 working days",
        "revisions": 1,
        "excludes": [
          "Unsupervised authority over payments, contracts or customer commitments",
          "Unlimited agents or open-ended scope",
          "Ongoing model and infrastructure costs"
        ],
        "externalCosts": [
          "Model/API usage, which scales with how much the system runs",
          "Hosting and infrastructure"
        ]
      },
      {
        "id": "AG-17",
        "name": "AI Voice Assistant",
        "price": "From $249",
        "startingFrom": true,
        "summary": "A voice workflow that answers, routes and escalates to a person.",
        "delivery": "14–25 working days",
        "revisions": 1,
        "excludes": [
          "Telephony numbers and minutes",
          "Speech model charges",
          "Legal advice on recording and consent obligations"
        ],
        "externalCosts": [
          "Telephony provider and per-minute charges",
          "Speech and language model usage"
        ]
      },
      {
        "id": "AG-18",
        "name": "Custom API / MCP Integration",
        "price": "From $199",
        "startingFrom": true,
        "summary": "Two systems talking to each other, with the errors handled.",
        "delivery": "7–15 working days",
        "revisions": 1,
        "excludes": [
          "Single sign-on",
          "Sensitive or regulated data workflows",
          "Complex multi-platform integrations"
        ],
        "externalCosts": [
          "Subscriptions for the systems being connected",
          "Any per-call API charges"
        ]
      },
      {
        "id": "AG-19",
        "name": "AI Systems Hosting & Maintenance",
        "price": "From $39/month",
        "startingFrom": true,
        "summary": "Keeping one AI application or workflow running after it is built.",
        "delivery": "Ongoing, monthly",
        "revisions": 0,
        "excludes": [
          "New feature development",
          "Infrastructure costs",
          "Model and API usage",
          "Third-party platform fees"
        ],
        "externalCosts": [
          "Infrastructure",
          "Model/API usage",
          "Third-party platform costs, unless your quotation says otherwise"
        ]
      }
    ]
  }
];

export const BOT_PACKAGES: BotPackage[] = [
  {
    "id": "PKG-WEBSITE-STARTER",
    "name": "Website Starter",
    "price": "$149",
    "included": [
      "Responsive website with 3–5 pages",
      "Standard navigation",
      "Contact form or contact links",
      "Basic SEO metadata",
      "Deployment to a supported platform",
      "One defined revision round"
    ],
    "excluded": [
      "Domain purchase",
      "Third-party hosting charges",
      "Custom backend systems",
      "Advanced integrations"
    ],
    "delivery": "5–10 working days",
    "externalCosts": [
      "Domain registration",
      "Hosting beyond a supported free tier"
    ]
  },
  {
    "id": "PKG-WEBSITE-BRAND",
    "name": "Website + Brand Launch",
    "price": "$189",
    "included": [
      "Everything in Website Starter",
      "Coordinated basic brand identity kit",
      "Logo concept with standard exports",
      "Colour palette",
      "Typography recommendations",
      "Basic brand usage guidance"
    ],
    "excluded": [
      "Unlimited revisions",
      "Advanced brand strategy",
      "Custom software"
    ],
    "delivery": "8–14 working days",
    "externalCosts": [
      "Domain registration",
      "Hosting",
      "Commercial font licences where applicable"
    ]
  },
  {
    "id": "PKG-AUTOMATION-STARTER",
    "name": "Automation Starter",
    "price": "$249",
    "included": [
      "One defined business automation workflow",
      "One supported external integration",
      "Basic configuration and testing",
      "A simple execution or notification process",
      "Setup documentation",
      "Agreed handover"
    ],
    "excluded": [
      "Ongoing hosting",
      "Model and API credits",
      "Messaging fees",
      "Third-party subscriptions",
      "A full multi-agent framework"
    ],
    "delivery": "7–14 working days",
    "externalCosts": [
      "Hosting",
      "Model/API usage",
      "Subscriptions for the tools being connected"
    ]
  }
];

export const BOT_SERVICE_COUNT = 19;
