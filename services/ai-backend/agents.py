"""
Agent definitions for AgenticCore.agency — Gemini version.

Same architecture as before (Manager decides which specialist agent(s) to
call), but running on Google's Gemini API instead of Claude's, since it
doesn't require a credit card to get started.

Google's SDK supports "automatic function calling": you hand it a list of
plain Python functions as tools, and it handles the call-a-tool /
feed-the-result-back loop for you. That's what we're using here — it's
simpler and less error-prone than writing that loop by hand.

To switch back to Claude later (once billing is sorted), only this file
needs to change — main.py stays the same.
"""

import json
import os
import requests
import time
import uuid
from google import genai
from google.genai import types as genai_types

from db.repository import (
    get_latest_deliverable,
    upsert_deliverable,
    get_project_files,
    upsert_project_files,
)

MODEL = "gemini-flash-latest"
# Strongest available Pro-tier model for deep analysis tasks.
PRO_MODEL = "gemini-pro-latest"

# Lazy-initialised — created on first use so the server starts cleanly even
# when GEMINI_API_KEY hasn't been set yet (requests will still fail fast with
# a clear 500 error from main.py's guard, not a cryptic import-time crash).
_client: genai.Client | None = None

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it in Replit Secrets to enable all agents."
            )
        _client = genai.Client(api_key=api_key)
    return _client

# Module-level alias kept for the video_agent which creates its own client
client = None  # resolved lazily via _get_client()


def _with_existing(brief: str, existing_content: str | None) -> str:
    """Wraps a brief with prior deliverable content so the model revises
    it instead of generating a fresh version from nothing."""
    if not existing_content:
        return brief
    return (
        f"Here is the existing version to revise:\n\n{existing_content}\n\n"
        f"Requested change:\n{brief}\n\n"
        "Update the existing version to satisfy the requested change. "
        "Preserve everything that still applies — do not start over from "
        "scratch unless the request clearly calls for it."
    )

# ------------------------------------------------------------
# Specialist agents
# Each function's docstring doubles as the description the Manager sees when
# deciding whether to call it — keep these clear and specific.
# ------------------------------------------------------------

def feasibility_agent(brief: str, existing_content: str | None = None) -> str:
    """Runs business feasibility research on a customer's idea or requirement:
    target market, rough viability, key risks, and a next-step recommendation.

    Args:
        brief: The customer's request or business idea.
        existing_content: A prior feasibility summary to revise, if one
            exists for this project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a business feasibility analyst. Given a business idea or "
        "requirement, produce a concise feasibility summary: target market, "
        "rough viability, key risks, and a simple next-step recommendation. "
        "Keep it under 200 words.",
        _with_existing(brief, existing_content),
    )

def site_architect_agent(brief: str, existing_content: str | None = None) -> str:
    """Plans a website's structure: pages/sections, key features, and whether
    it needs a simple template or custom code (flags crypto/smart-contract/
    payment integration needs).

    Args:
        brief: The customer's requirement or the feasibility summary.
        existing_content: A prior site structure to revise, if one exists
            for this project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a website architect. Given a business requirement, output "
        "a clear site structure: list of pages/sections, key features "
        "needed, and whether this needs a simple template site or custom "
        "code (e.g. flag if smart contract / crypto / payment integration "
        "is required). Keep it under 200 words.",
        _with_existing(brief, existing_content),
    )

_DEVELOPER_SYSTEM = """\
You are a professional web developer who builds complete, multi-page websites.

ALWAYS output a single, raw JSON object — no markdown fences, no prose before or after, just the JSON.

Schema:
{
  "archetype": "<landing_page | saas_dashboard | real_estate | forex_platform | ecommerce | custom>",
  "files": [
    {
      "filename": "<e.g. index.html, style.css, app.js>",
      "purpose": "<one-line description of this file's role>",
      "content": "<full file content>",
      "action": "<create | update | delete>"
    }
  ]
}

=== ARCHETYPE TEMPLATES ===
Choose the archetype that fits the brief and generate the corresponding files:

landing_page:
  Files: index.html (hero + features + pricing + CTA), about.html, services.html, contact.html, style.css
  Nav links: Home, About, Services, Contact

saas_dashboard:
  Files: login.html, dashboard.html, settings.html, style.css, auth.js, app.js
  Nav links (authenticated pages only): Dashboard, Settings, Logout
  auth.js must redirect to login.html if no token found in localStorage

real_estate:
  Files: index.html (listings grid with sample cards), property.html (detail: photos, specs, agent contact), contact.html, style.css, listings.js
  Nav links: Listings, Contact

forex_platform:
  Files: login.html, index.html (live prices table + market overview), portfolio.html (holdings, P&L), history.html (trade log), style.css, app.js
  Nav links (authenticated): Markets, Portfolio, History, Logout
  app.js must redirect to login.html if no token in localStorage

ecommerce:
  Files: index.html (product grid), product.html (detail: image, desc, Add to Cart), cart.html, checkout.html, style.css, cart.js
  Nav links: Shop, Cart, Checkout
  cart.js manages cart state in localStorage

custom:
  Derive the file set and nav from the brief. Create as many files as needed.

=== RULES FOR ALL BUILDS ===
1. Every HTML file MUST include a consistent <nav> with links to all other HTML pages (relative hrefs).
2. Every HTML file MUST link <link rel="stylesheet" href="style.css">. Write modern, mobile-responsive CSS in style.css.
3. Forms MUST have realistic action="" and method="post" attributes.
4. Authenticated pages MUST include a JS auth-guard: if no token in localStorage, redirect to login.html.
5. Data-driven pages (listings, prices, cart) MUST include realistic placeholder data AND a clear comment block explaining how live API data would replace it.
6. Include viewport meta tag in every HTML file.

=== INCREMENTAL EDITS — STRICT RULES ===
When existing_content (an existing manifest JSON) is provided, you are making
a TARGETED EDIT — do NOT regenerate the full site.

Step 1: Read the existing manifest carefully. Identify which specific file(s)
        contain the element that needs to change.
Step 2: Edit ONLY those file(s). Leave every other file completely untouched.
Step 3: Output a JSON object with ONLY the changed file(s) in "files".
        Use action "update" for modified files, "delete" for removed files,
        "create" for brand new files.

EXAMPLE — customer says "Change the hero heading to 'Welcome to Acme'":
  BAD output (regenerates everything — NEVER DO THIS):
    {"archetype":"landing_page","files":[{"filename":"index.html",...all content...},
      {"filename":"about.html",...all content...},{"filename":"style.css",...}]}
  GOOD output (targeted — only the changed file):
    {"archetype":"landing_page","files":[{"filename":"index.html",
      "purpose":"Home page — hero heading updated to Welcome to Acme",
      "content":"...full updated index.html content...",
      "action":"update"}]}

The manager merges changed files into the stored manifest. Unchanged files
(about.html, style.css, etc.) must NOT appear in your output at all.
"""


def developer_agent(brief: str, existing_content: str | None = None) -> str:
    """Builds a complete multi-page website and returns a JSON project
    manifest listing every file (filename, purpose, content). For new
    builds, outputs all files. For edits, outputs only the changed files
    — the manager merges them into the existing manifest stored in DB.

    Supports five archetypes with their own default file structures:
    landing_page, saas_dashboard, real_estate, forex_platform, ecommerce.
    Use "custom" for anything that doesn't fit.

    Args:
        brief: The site requirement, archetype preference, and any
            specific pages or features needed.
        existing_content: The current project manifest JSON (from DB) to
            revise. Leave unset for a first-time build.
    """
    prompt_input = brief
    if existing_content:
        prompt_input = (
            f"EXISTING MANIFEST (revise, do not regenerate unchanged files):\n"
            f"{existing_content}\n\n"
            f"CHANGE REQUESTED:\n{brief}"
        )
    return _call_gemini(_DEVELOPER_SYSTEM, prompt_input, model=PRO_MODEL)


def qa_agent(brief: str) -> str:
    """Reviews a project manifest (JSON produced by developer_agent) or a
    feature description for bugs, broken navigation, missing pages,
    auth-flow gaps, and responsiveness/security concerns before the site
    is delivered to the customer.

    Returns a JSON object: {"passed": true/false, "issues": [...],
    "suggestions": [...]}.

    Args:
        brief: The developer_agent JSON manifest or feature description
            to review.
    """
    return _call_gemini(
        "You are a QA engineer reviewing a multi-page website manifest. "
        "The input is a JSON manifest with a 'files' array. Check:\n"
        "1. Navigation — every href in nav bars matches a file that exists.\n"
        "2. Missing pages — any page referenced in links but absent from files.\n"
        "3. Auth guards — protected pages redirect to login.html if no token.\n"
        "4. Form targets — action= attributes point to realistic endpoints.\n"
        "5. CSS link — <link rel='stylesheet' href='style.css'> in every HTML file.\n"
        "6. Viewport meta tag present in every HTML file.\n"
        "7. Placeholder data comments present on data-driven pages.\n\n"
        "Output ONLY a raw JSON object (no markdown): "
        '{"passed": true/false, "issues": ["...", ...], "suggestions": ["...", ...]}',
        brief,
    )

def content_agent(brief: str, existing_content: str | None = None) -> str:
    """Writes marketing and website copy: headlines, taglines, product/service
    descriptions, About/Home page text, and general persuasive written content.
    Use this whenever the customer needs written content, not code.

    Args:
        brief: What content is needed and any relevant context (business type,
            tone, target audience, page it's for).
        existing_content: Prior copy to revise, if any exists for this
            project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a professional copywriter. Given a request for website or "
        "marketing content, write clear, persuasive, on-brand copy: "
        "headlines, taglines, product/service descriptions, or page text as "
        "requested. Match the tone to the business type. Keep it well "
        "organized and under 250 words unless more is clearly needed.",
        _with_existing(brief, existing_content),
    )

def marketing_agent(brief: str, existing_content: str | None = None) -> str:
    """Creates social media and promotional marketing content: post captions,
    ad copy, campaign ideas, hashtag suggestions, and content calendar/theme
    ideas. Use this for social media posts, ads, or promotion strategy,
    distinct from content_agent which handles website/page copy.

    Args:
        brief: What kind of marketing content is needed, the platform
            (e.g. Instagram, LinkedIn), and any relevant context (business
            type, tone, target audience, promotion goal).
        existing_content: Prior marketing content to revise, if any exists
            for this project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a social media marketing strategist. Given a request for "
        "promotional content, produce practical, ready-to-use output: "
        "social media captions with relevant hashtags, ad copy, a short "
        "campaign angle, or simple content calendar ideas as requested. "
        "Tailor tone and format to the platform mentioned (e.g. concise and "
        "hashtag-heavy for Instagram, more professional for LinkedIn). Keep "
        "it practical and under 200 words unless more is clearly needed.",
        _with_existing(brief, existing_content),
    )

def bookkeeping_agent(brief: str, existing_content: str | None = None) -> str:
    """Handles basic bookkeeping and financial tasks: categorizing expenses,
    simple profit/loss summaries, basic budget breakdowns, and explaining
    financial concepts in plain language. This does NOT replace licensed
    accounting/tax advice — for anything requiring official filing or legal
    compliance, note that a licensed professional should review it.

    Args:
        brief: The financial task or numbers to work with, and what kind of
            output is needed (e.g. expense categorization, budget summary,
            simple P&L estimate).
        existing_content: A prior summary/breakdown to revise, if one
            exists for this project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a bookkeeping assistant for small businesses. Given "
        "financial information or a request, provide clear, practical help: "
        "categorize expenses, produce a simple profit/loss summary, build a "
        "basic budget breakdown, or explain a financial concept in plain "
        "language. Use tables or clear lists for numbers where helpful. "
        "Always note that this is general guidance, not licensed accounting "
        "or tax advice, and a professional should review anything official. "
        "Keep it clear and under 250 words unless more detail is clearly "
        "needed.",
        _with_existing(brief, existing_content),
    )

def legal_agent(brief: str, existing_content: str | None = None) -> str:
    """Handles basic legal/compliance guidance for small businesses: terms
    of service drafts, privacy policy basics, and general compliance
    questions. This does NOT replace licensed legal advice — for anything
    binding, jurisdiction-specific, or requiring official filing, note that
    a licensed attorney should review it.

    Args:
        brief: The legal/compliance request (e.g. "draft a basic terms of
            service for an online store") and any relevant context (business
            type, jurisdiction if known).
        existing_content: A prior draft to revise, if one exists for this
            project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a legal/compliance assistant for small businesses. Given a "
        "request for basic legal or compliance help — draft a terms of "
        "service, a privacy policy, or explain a general compliance "
        "question — provide clear, practical, plain-language output, using "
        "headed sections for document drafts. Always note that this is "
        "general guidance, not licensed legal advice, and that a licensed "
        "attorney should review anything binding or jurisdiction-specific "
        "before it's used. Keep it clear and under 300 words unless more "
        "detail is clearly needed.",
        _with_existing(brief, existing_content),
    )

def seo_agent(brief: str, existing_content: str | None = None) -> str:
    """Handles SEO analysis and recommendations: keyword suggestions, meta
    titles/descriptions, on-page SEO tips, and basic content optimization
    advice. Use this whenever the customer wants help improving a page's or
    business's search visibility — distinct from site_audit_agent (audits a
    live page's overall UX/content flaws) and content_agent (writes the
    copy itself).

    Args:
        brief: The business, page, or content to optimize, and any relevant
            context (target audience, competitors, existing copy).
        existing_content: Prior SEO recommendations to revise, if any exist
            for this project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are an SEO specialist. Given a business, page, or piece of "
        "content, provide practical SEO recommendations: suggested target "
        "keywords, a meta title and description, on-page optimization tips "
        "(headings, internal linking, image alt text), and basic content "
        "optimization advice. Be specific and actionable, not generic. "
        "Keep it under 250 words unless more detail is clearly needed.",
        _with_existing(brief, existing_content),
    )

def localization_agent(brief: str, existing_content: str | None = None) -> str:
    """Translates and adapts website or marketing copy into another
    language for a target market — full localization (tone, idioms,
    cultural references, formatting conventions), not just literal
    translation. Use this whenever the customer wants existing copy adapted
    for a different language/region (e.g. Urdu or Arabic for Pakistan/UAE
    audiences).

    Args:
        brief: The source copy to localize, the target language, and the
            target market/region (e.g. "translate this to Arabic for a UAE
            audience: ...").
        existing_content: A prior localized version to revise, if one
            exists for this project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a professional localization specialist, not just a "
        "translator. Given source copy and a target language/market, adapt "
        "it rather than translating literally: adjust tone, idioms, "
        "cultural references, examples, and formatting conventions (e.g. "
        "currency, dates, honorifics) to fit the target market naturally, "
        "while preserving the original meaning and intent. If you make any "
        "non-obvious cultural adaptation choices, briefly note them at the "
        "end. Keep the output length proportionate to the source content.",
        _with_existing(brief, existing_content),
    )

def pdf_report_agent(brief: str, existing_content: str | None = None) -> str:
    """Generates a complete, professionally formatted HTML report document
    ready for printing or PDF export. Ideal for business reports, proposals,
    feasibility documents, research summaries, pitch decks, and any formal
    document the customer needs to share with clients or stakeholders.
    The output is a self-contained HTML file with all CSS embedded.

    Args:
        brief: What the report covers — topic, key data/findings to include,
            target audience, and any specific sections needed.
        existing_content: A prior report draft to revise, if one exists for
            this project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a professional report writer and document designer. Given a "
        "topic, data, or brief, produce a complete, publication-quality HTML "
        "report document with ALL CSS embedded in a <style> block. Structure:\n"
        "1. Cover section — title, subtitle, 'Prepared for: [client]', date\n"
        "2. Executive Summary — 3-5 bullet key takeaways\n"
        "3. Clearly headed sections with thorough analysis and content\n"
        "4. Data tables where relevant (use <table> with clean CSS)\n"
        "5. Conclusions & Recommendations\n"
        "6. Footer — document reference, confidentiality notice\n\n"
        "Design rules: white background, professional sans-serif font "
        "(Inter/Arial), dark headings (#1a1a2e or similar), accent color "
        "for headings/dividers, proper 2.5cm margins, section breaks, "
        "page-break-before: always on major sections for printing. "
        "Make it look like a real consulting report. "
        "Output ONLY the complete HTML document, no explanations.",
        _with_existing(brief, existing_content),
        model=PRO_MODEL,
    )


def business_card_agent(brief: str, existing_content: str | None = None) -> str:
    """Designs a professional business card as a print-ready HTML/CSS document
    showing both front and back of the card at standard 3.5×2 inch dimensions.
    Produces modern, industry-appropriate designs with proper typography,
    color hierarchy, and print-safe CSS.

    Args:
        brief: The person's name, title, company, contact details (email,
            phone, website, social handles), industry/brand colors if known,
            and any design preferences (minimalist, bold, corporate, creative).
        existing_content: A prior business card design to revise, if one
            exists. Leave unset for a first-time design.
    """
    return _call_gemini(
        "You are a professional graphic designer specializing in print design. "
        "Given business details, produce a complete HTML/CSS document showing "
        "a business card design — front and back — displayed side by side on "
        "a neutral background. Card dimensions: 350px × 200px (3.5×2 inch at "
        "100dpi). ALL CSS must be embedded in a <style> block.\n\n"
        "Front: logo/icon placeholder, name (large, prominent), job title, "
        "company name, one key visual element (accent bar, pattern, or shape).\n"
        "Back: all contact details (email, phone, website, social handles), "
        "tagline or company description, QR code placeholder.\n\n"
        "Design rules: choose a color scheme that fits the industry "
        "(professional blue for finance/law, creative gradient for tech/design, "
        "warm tones for hospitality, etc.), excellent typography hierarchy, "
        "generous white space, print-safe colors. Include a @media print rule "
        "that renders each card on its own page. "
        "Output ONLY the complete HTML document.",
        _with_existing(brief, existing_content),
    )


def letterhead_agent(brief: str, existing_content: str | None = None) -> str:
    """Creates a professional, print-ready letterhead template as a complete
    HTML document with embedded CSS. Includes the company header, a sample
    formal letter body, and a branded footer — ready to use for client
    correspondence, proposals, or official documents.

    Args:
        brief: Company name, address, contact details, website, industry,
            brand colors if known, and any specific design requirements
            (formal corporate, modern minimal, creative, etc.).
        existing_content: A prior letterhead design to revise, if one exists.
            Leave unset for a first-time design.
    """
    return _call_gemini(
        "You are a professional graphic designer specializing in brand identity "
        "and print collateral. Given company details, produce a complete, A4 "
        "print-ready letterhead template as a full HTML document with all CSS "
        "embedded. Structure:\n"
        "HEADER (top of page): company logo placeholder (SVG circle with "
        "initials), company name in brand font, tagline, horizontal accent bar\n"
        "LEFT SIDEBAR or TOP-RIGHT BLOCK: address, phone, email, website, "
        "registration/company number placeholder\n"
        "BODY AREA: sample formal letter with date, recipient block, salutation, "
        "2-3 placeholder paragraphs, closing, signature block\n"
        "FOOTER: website URL, company legal name, thin accent line, "
        "'Page 1 of 1' placeholder\n\n"
        "Design rules: A4 dimensions (210mm × 297mm), 2.5cm margins, "
        "professional color scheme matching the industry, crisp typography "
        "(Helvetica/Arial or Google Fonts), @media print optimizations. "
        "Output ONLY the complete HTML document, no explanations.",
        _with_existing(brief, existing_content),
    )


def smart_contract_agent(brief: str, existing_content: str | None = None) -> str:
    """Writes production-grade Solidity smart contracts for Web3 and crypto
    projects: ERC-20/ERC-721/ERC-1155 tokens, NFT collections, DeFi staking
    and yield farming, ICO/token sale contracts, DAO governance, multi-sig
    wallets, and custom business logic on Ethereum-compatible chains.
    Includes full NatSpec documentation, OpenZeppelin inheritance, security
    best practices, and a Hardhat deployment script.

    Args:
        brief: The contract type and requirements — e.g. 'ERC-20 token named
            AcmeCoin (ACM), 1M supply, owner can mint, burnable', or 'NFT
            collection: 5000 items, 0.05 ETH mint price, whitelist phase,
            reveal mechanic'. Include chain (Ethereum/BSC/Polygon/etc.) and
            any tokenomics or access-control requirements.
        existing_content: A prior contract to revise or extend. Leave unset
            for a first-time contract.
    """
    return _call_gemini(
        "You are a senior Solidity engineer specializing in secure, audited "
        "smart contracts. Given a requirement, write production-quality "
        "Solidity code using the latest stable version (^0.8.20). Use "
        "OpenZeppelin contracts where appropriate (@openzeppelin/contracts). "
        "Your output must include:\n"
        "1. SOLIDITY FILE — full contract with:\n"
        "   • SPDX license identifier and pragma\n"
        "   • Full NatSpec documentation (@title, @author, @notice, @param, @return)\n"
        "   • OpenZeppelin inheritance (ERC20, ERC721, Ownable, AccessControl, "
        "     ReentrancyGuard, Pausable as appropriate)\n"
        "   • Custom errors (not revert strings) for gas efficiency\n"
        "   • Events for every state-changing function\n"
        "   • Security patterns: checks-effects-interactions, reentrancy guard, "
        "     input validation\n"
        "2. HARDHAT DEPLOYMENT SCRIPT (scripts/deploy.js) — ethers.js v6 syntax\n"
        "3. SECURITY NOTES — list the top 3-5 risks and mitigations, plus "
        "   a reminder that a professional audit is required before mainnet\n\n"
        "Format each section with a clear header comment. "
        "Output code blocks with proper language tags.",
        _with_existing(brief, existing_content),
        model=PRO_MODEL,
    )


def social_media_strategy_agent(brief: str, existing_content: str | None = None) -> str:
    """Creates a comprehensive, platform-specific social media strategy and
    content plan. Covers platform selection, profile optimisation, a 30-day
    content calendar with post ideas, content pillars, hashtag strategy,
    engagement tactics, and growth KPIs. Use this for full social media
    presence planning — distinct from marketing_agent which writes individual
    ready-to-post captions and ad copy.

    Args:
        brief: The business type, target audience, goals (brand awareness,
            lead gen, sales, community), existing social presence if any,
            and any platform preferences.
        existing_content: A prior social media strategy to revise or extend.
            Leave unset for a first-time strategy.
    """
    return _call_gemini(
        "You are a senior social media strategist at a top digital agency. "
        "Given a business brief, produce a comprehensive social media strategy "
        "document with these sections:\n"
        "1. PLATFORM SELECTION — which platforms to prioritise and why "
        "(Instagram, LinkedIn, X/Twitter, TikTok, YouTube, Facebook, Pinterest "
        "— choose the right 2-4 for this business)\n"
        "2. PROFILE OPTIMISATION — bio templates, profile photo/cover "
        "recommendations, link-in-bio strategy for each chosen platform\n"
        "3. CONTENT PILLARS — 4-5 content themes with rationale and examples\n"
        "4. 30-DAY CONTENT CALENDAR — specific post ideas for each week, "
        "format per post (reel, carousel, static, story, thread), best "
        "posting times per platform\n"
        "5. HASHTAG STRATEGY — 15-20 hashtags per platform, split into "
        "niche/mid/broad tiers\n"
        "6. ENGAGEMENT TACTICS — community management approach, response "
        "time targets, collaboration/influencer ideas\n"
        "7. GROWTH KPIs — follower growth targets, engagement rate benchmarks, "
        "reach and impression goals for months 1/3/6\n"
        "Format with clear headed sections. Be specific and actionable, "
        "not generic. Tailor everything to the exact business described.",
        _with_existing(brief, existing_content),
        model=PRO_MODEL,
    )


def analytics_agent(brief: str, existing_content: str | None = None) -> str:
    """Sets up a complete analytics and tracking framework for a website or
    business: Google Analytics 4 implementation with gtag.js, custom event
    tracking code for key user actions, conversion goal configuration, a
    KPI dashboard framework, and Google Tag Manager setup. Returns copy-paste-
    ready JavaScript code alongside the strategy.

    Args:
        brief: The website type and key user actions to track (form submits,
            purchases, sign-ups, button clicks, video plays, etc.), plus any
            existing analytics setup or tools already in use.
        existing_content: A prior analytics setup to extend or revise.
            Leave unset for a first-time setup.
    """
    return _call_gemini(
        "You are a senior digital analytics specialist and web tracking expert. "
        "Given a website/business brief, produce a complete analytics setup "
        "guide with the following sections:\n"
        "1. GA4 SETUP — gtag.js snippet with the customer's measurement ID "
        "placeholder (G-XXXXXXXXXX), plus basic page_view configuration\n"
        "2. CUSTOM EVENT TRACKING — copy-paste JavaScript snippets for each "
        "key action: form submissions, CTA clicks, scroll depth, video plays, "
        "e-commerce add-to-cart/purchase, sign-up/login — whichever apply\n"
        "3. CONVERSION GOALS — which events to mark as conversions in GA4 "
        "and why, with step-by-step GA4 UI instructions\n"
        "4. GOOGLE TAG MANAGER SETUP (optional but recommended) — container "
        "snippet, GA4 tag config, trigger setup instructions\n"
        "5. KPI DASHBOARD — table of the 8-10 most important metrics to "
        "monitor (metric name, where to find it in GA4, benchmark/target, "
        "what a bad number means)\n"
        "6. QUICK WINS — top 3 analytics insights this business should "
        "look for in the first 30 days\n"
        "Format code blocks with proper language tags. "
        "Be specific to the business type described in the brief.",
        _with_existing(brief, existing_content),
    )


def marketing_strategy_agent(brief: str, existing_content: str | None = None) -> str:
    """Produces a full CMO-level go-to-market marketing strategy: audience
    personas, positioning, channel mix with rationale, a 90-day launch plan,
    budget allocation, and a KPI framework. Use this for complete marketing
    strategy documents — distinct from marketing_agent (writes individual
    social posts and ad copy) and content_agent (writes page copy).

    Args:
        brief: The business, product or service to market — include target
            market, price point, competitors if known, stage of business
            (pre-launch, early-stage, scaling), and any budget constraints.
        existing_content: A prior marketing strategy to revise or extend.
            Leave unset for a first-time strategy.
    """
    return _call_gemini(
        "You are a CMO-level marketing strategist with deep expertise in "
        "go-to-market strategy for startups and SMEs. Given a business brief, "
        "produce a complete marketing strategy document with these sections:\n"
        "1. EXECUTIVE SUMMARY — one paragraph positioning statement and "
        "strategy overview\n"
        "2. TARGET AUDIENCE PERSONAS — 2-3 detailed personas (demographics, "
        "psychographics, pain points, buying triggers, where they spend time)\n"
        "3. VALUE PROPOSITION & POSITIONING — unique value statement, "
        "key differentiators vs competitors, messaging hierarchy\n"
        "4. CHANNEL MIX STRATEGY — for each recommended channel (SEO, "
        "paid search, paid social, organic social, email, content marketing, "
        "partnerships, PR) explain why/why not, expected ROI, and priority\n"
        "5. 90-DAY LAUNCH PLAN — week-by-week milestones for the first "
        "12 weeks, broken into three 30-day phases\n"
        "6. BUDGET ALLOCATION — percentage split across channels (adapt to "
        "small/medium/large budget scenarios)\n"
        "7. KPI FRAMEWORK — primary and secondary KPIs per channel, "
        "30/60/90-day targets, and what good looks like\n"
        "8. RISKS & MITIGATIONS — top 3 risks and how to de-risk them\n"
        "Format with clear headed sections. Be specific to the business, "
        "not generic. Include concrete examples and numbers where possible.",
        _with_existing(brief, existing_content),
        model=PRO_MODEL,
    )


def image_agent(brief: str) -> str:
    """Generates a real image using Ideogram, which specializes in rendering
    clean, readable text inside images — ideal for branded marketing
    graphics, posters, social media images, and logos with text. Use this
    whenever the customer needs an actual image, not just written content.
    Returns a URL to the generated image.

    Args:
        brief: A clear description of the image to generate, including any
            text that should appear in it, the style/mood, and brand colors
            if known.
    """
    api_key = os.environ.get("IDEOGRAM_API_KEY")
    if not api_key:
        return "Image generation is not configured (missing IDEOGRAM_API_KEY)."
    try:
        response = requests.post(
            "https://api.ideogram.ai/v1/ideogram-v4/generate",
            headers={"Api-Key": api_key},
            json={"text_prompt": brief},
            timeout=60,
        )
        response.raise_for_status()
        image_url = response.json()["data"][0]["url"]
        return image_url
    except Exception as e:
        return f"Image generation failed: {e}"
def video_agent(brief: str) -> str:
    """Generates an 8-second video clip with native audio using Google Veo,
    ideal for marketing clips, product demos, and social media content.
    Use this whenever the customer needs an actual video, not just written
    content or a static image. Returns a URL to the generated video.

    Args:
        brief: A clear description of the video to generate, including any
        action, camera movement, mood, dialogue, and sound if relevant.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "Video generation is not configured (missing GEMINI_API_KEY)."
    try:
        client = genai.Client(api_key=api_key)
        operation = client.models.generate_videos(
            model="veo-3.1-generate-preview",
            prompt=brief,
            config=genai_types.GenerateVideosConfig(
                number_of_videos=1,
                duration_seconds=8,
            ),
        )
        while not operation.done:
            time.sleep(20)
            operation = client.operations.get(operation)
        if getattr(operation, "error", None):
            return f"Video generation failed: {operation.error}"
        if not operation.response or not getattr(operation.response, "generated_videos", None):
            return (
                "Video generation completed but returned no video — this "
                "usually means the request was blocked by a safety filter. "
                "Try rephrasing the video description."
            )
        video = operation.response.generated_videos[0].video
        return video.uri
    except Exception as e:
        return f"Video generation failed: {e}"
def deployment_agent(brief: str) -> str:
    """Deploys a completed website live to the internet using Vercel and
    returns a working public URL. Use this when the customer wants their
    site published/live, not just written as code. Currently supports a
    single self-contained HTML file (the common case for developer_agent's
    output) — pass the complete HTML content as the brief, including any
    inline <style> and <script> tags. Multi-file projects are not yet
    supported by this agent.

    Args:
        brief: The complete HTML content to publish as index.html. If the
            input isn't already a full HTML document, wrap it in a minimal
            <html><body>...</body></html> shell before calling this.
    """
    api_key = os.environ.get("VERCEL_API_TOKEN")
    if not api_key:
        return "Deployment is not configured (missing VERCEL_API_TOKEN)."
    try:
        project_name = f"nexus-site-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            "https://api.vercel.com/v13/deployments",
            headers={"Authorization": f"Bearer {api_key}"},
            json={
                "name": project_name,
                "files": [{"file": "index.html", "data": brief}],
                "target": "production",
                "projectSettings": {"framework": None},
            },
            timeout=60,
        )
        if response.status_code >= 400:
            return f"Deployment failed: {response.status_code} {response.text}"
        data = response.json()
        url = data.get("url")
        if not url:
            return f"Deployment created but no URL was returned: {data}"
        return f"https://{url}"
    except Exception as e:
        return f"Deployment failed: {e}"

def deep_analysis_agent(brief: str, existing_content: str | None = None) -> str:
    """Runs deep business/strategy analysis using a stronger, slower Gemini
    Pro-tier model — for questions that need real multi-factor reasoning:
    competitive positioning, market entry strategy, pricing strategy,
    financial modeling depth, or weighing several strategic options against
    each other. Use this instead of feasibility_agent when the request is
    clearly more involved than a quick initial gut-check (feasibility_agent
    stays the default for first-pass "is this idea viable" questions). This
    is slower and more expensive to run than the other agents, so only use
    it when the reasoning depth is actually needed.

    Args:
        brief: The business/strategy question or decision to analyze, with
            as much relevant context as the customer has given.
        existing_content: A prior analysis to revise, if one exists for
            this project. Leave unset for a first-time request.
    """
    return _call_gemini(
        "You are a senior business strategy consultant. Given a complex "
        "business or strategy question, reason through it carefully: "
        "identify the key factors and tradeoffs, weigh the realistic "
        "options against each other, and give a clear, well-justified "
        "recommendation. Structure your answer with short headed sections "
        "(e.g. Key Factors, Options Considered, Recommendation, Risks). Be "
        "thorough but avoid padding — every sentence should carry "
        "analysis, not restate the question. Up to 500 words.",
        _with_existing(brief, existing_content),
        model=PRO_MODEL,
    )

def site_audit_agent(url: str) -> str:
    """Fetches a live web page and audits it: returns a structured list of
    flaws (usability, content, technical, trust/credibility issues) and
    concrete improvement suggestions for each. Use this whenever the
    customer wants an existing website reviewed or critiqued, as opposed to
    site_architect_agent (plans a new site) or qa_agent (reviews code
    developer_agent just wrote). Returns a JSON string.

    Args:
        url: The full URL of the page to audit (must start with http:// or
            https://).
    """
    from integrations.http import FetchError, fetch_url, html_to_text

    try:
        html = fetch_url(url)
    except FetchError as e:
        return json.dumps({"error": str(e)})

    page_text = html_to_text(html)
    response = _get_client().models.generate_content(
        model=MODEL,
        contents=f"URL: {url}\n\nPage content:\n{page_text}",
        config=genai_types.GenerateContentConfig(
            system_instruction=(
                "You are a website auditor. Given a page's URL and extracted "
                "text content, identify concrete flaws — usability, content "
                "clarity, missing trust signals, calls-to-action, structure "
                "issues — and a specific, actionable improvement suggestion "
                "for each. Base your findings only on what's actually in the "
                "provided content; don't speculate about things you can't "
                "see (like page speed or exact visual styling)."
            ),
            response_mime_type="application/json",
            response_schema={
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                    "flaws": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "issue": {"type": "string"},
                                "suggestion": {"type": "string"},
                            },
                            "required": ["issue", "suggestion"],
                        },
                    },
                },
                "required": ["summary", "flaws"],
            },
        ),
    )
    return response.text

def _call_gemini(system_prompt: str, user_input: str, model: str = MODEL) -> str:
    response = _get_client().models.generate_content(
        model=model,
        contents=user_input,
        config={"system_instruction": system_prompt},
    )
    return response.text

# ------------------------------------------------------------
# Manager / orchestrator
# ------------------------------------------------------------

MANAGER_SYSTEM_PROMPT = (
    "You are the Manager agent for AgenticCore.agency, an AI-powered business "
    "services platform. You act as both a general-purpose assistant and a "
    "router to specialist agents — decide which mode fits each message.\n\n"

    "LANGUAGE RULE (CRITICAL): Always reply in the exact same language the "
    "customer used. If they write in Arabic, reply in Arabic. If they write "
    "in Urdu, reply in Urdu. If they write in French, Spanish, Hindi, or any "
    "other language, reply in that language. Never switch to English unless "
    "the customer writes to you in English. This applies to every specialist "
    "agent result you summarise back to the customer as well — translate or "
    "adapt your summary to match their language. Do NOT add an English "
    "translation alongside the native-language reply.\n\n"

    "GENERAL ASSISTANT MODE: If the customer is asking a direct question, "
    "making conversation, or asking something you can just answer yourself "
    "(general knowledge, clarifying what AgenticCore.agency can do, simple "
    "follow-up questions about work already done) — just answer directly. "
    "Don't force a request through a specialist agent it doesn't need. You "
    "have the conversation history above this message; use it for context "
    "and refer back to what's already been discussed or built instead of "
    "asking the customer to repeat themselves.\n\n"

    "ROUTING MODE: For requests that call for specialized work, decide "
    "which specialist agent(s) to call, in what order. Typical full site "
    "build flow: site_architect_agent -> developer_agent -> qa_agent. Skip "
    "site_architect_agent when the customer gives you a clear enough brief "
    "to go straight to developer_agent. Always call qa_agent immediately "
    "after developer_agent on NEW site builds — pass the full JSON manifest "
    "that developer_agent returned as the brief to qa_agent so it can "
    "review the files for broken navigation, missing pages, and auth "
    "gaps.\n\n"

    "WEBSITE / DEVELOPER AGENT: developer_agent builds complete multi-page "
    "websites and returns a JSON project manifest listing every file "
    "(filename, purpose, content). It supports five archetypes — choose "
    "the archetype that fits the brief when calling it:\n"
    "  - landing_page: index.html + about + services + contact + style.css\n"
    "  - saas_dashboard: login + dashboard + settings + style.css + auth.js + app.js\n"
    "  - real_estate: listings grid + property detail + contact + style.css + listings.js\n"
    "  - forex_platform: login + markets + portfolio + history + style.css + app.js\n"
    "  - ecommerce: shop + product detail + cart + checkout + style.css + cart.js\n"
    "  - custom: derive the file set from the brief\n\n"
    "When the customer asks to change, fix, or update something already "
    "built (e.g. 'change the hero text', 'add a pricing page', 'fix the "
    "nav on mobile') — call developer_agent with the specific change as the "
    "brief. The system automatically hands it the current project manifest "
    "and it outputs only the changed files; do NOT regenerate the whole "
    "site. Describe the change precisely so the agent touches only what "
    "needs to change.\n\n"
    "When telling the customer what was built, list the pages/files "
    "produced and briefly describe what each does. For edits, confirm "
    "which file(s) were changed and what changed.\n\n"

    "Use content_agent whenever the customer needs website or page copy "
    "(headlines, descriptions, page text). Use marketing_agent whenever "
    "the customer needs social media posts, ads, or promotional/campaign "
    "content instead of page copy. Use bookkeeping_agent for expense "
    "categorization, budget breakdowns, simple profit/loss summaries, or "
    "financial questions. Use legal_agent for basic legal/compliance "
    "questions — terms of service drafts, privacy policy basics, or "
    "general compliance questions (it always includes a not-legal-advice "
    "disclaimer, same as bookkeeping_agent's financial one). Use seo_agent "
    "when the customer wants help with search visibility — keyword "
    "suggestions, meta descriptions, on-page SEO tips, or content "
    "optimization advice — distinct from content_agent (writes the copy "
    "itself) and site_audit_agent (audits a live page's overall UX/content "
    "flaws, not specifically SEO). Use localization_agent whenever the "
    "customer wants existing copy translated and culturally adapted for a "
    "different language or market (e.g. Arabic for a UAE audience, Urdu "
    "for a Pakistan audience) — it adapts tone and cultural references, "
    "not just a literal translation, so pass it the source copy plus the "
    "target language and market.\n\n"

    "Use feasibility_agent for a quick first-pass viability check on a "
    "business idea. Use deep_analysis_agent instead when the question "
    "clearly needs deeper reasoning than that — competitive positioning, "
    "market entry strategy, pricing strategy, or weighing multiple "
    "strategic options against each other. It's slower and more expensive "
    "than feasibility_agent, so don't reach for it on simple requests.\n\n"

    "Use site_audit_agent whenever the customer wants an existing, live "
    "website reviewed or critiqued (they'll give you a URL) — it's "
    "distinct from site_architect_agent (plans a new site from scratch) "
    "and qa_agent (reviews code developer_agent just wrote, not a live "
    "page). It returns a JSON object with a summary and a list of flaws; "
    "when you report back to the customer, present the flaws and their "
    "suggested fixes clearly, don't just paste the raw JSON.\n\n"

    "Use pdf_report_agent whenever the customer needs a formatted, "
    "professional document: business reports, proposals, feasibility "
    "documents, pitch documents, research summaries — anything that "
    "should look like a polished printed/PDF report.\n\n"

    "Use business_card_agent whenever the customer needs a business card "
    "design — it produces a print-ready HTML/CSS card showing front and "
    "back at standard 3.5×2 inch dimensions.\n\n"

    "Use letterhead_agent whenever the customer needs a professional "
    "letterhead template for company correspondence, proposals, or "
    "official documents.\n\n"

    "Use smart_contract_agent whenever the customer needs Solidity smart "
    "contract code: ERC-20/ERC-721 tokens, NFT collections, DeFi staking, "
    "ICO/token sales, DAO governance, multi-sig wallets, or any custom "
    "on-chain business logic. Always include the full contract, NatSpec "
    "docs, and a Hardhat deployment script.\n\n"

    "Use social_media_strategy_agent whenever the customer needs a full "
    "social media presence plan — platform selection, 30-day content "
    "calendar, hashtag strategy, engagement tactics, KPIs. This is "
    "distinct from marketing_agent which writes individual ready-to-post "
    "captions and ad copy.\n\n"

    "Use analytics_agent whenever the customer wants to set up website "
    "tracking: GA4 implementation code, custom event tracking, conversion "
    "goals, Google Tag Manager, or a KPI dashboard framework.\n\n"

    "Use marketing_strategy_agent whenever the customer needs a full "
    "go-to-market strategy document — audience personas, positioning, "
    "channel mix, 90-day launch plan, budget allocation, KPIs. This is "
    "distinct from marketing_agent (individual post/ad copy) and "
    "content_agent (website page copy).\n\n"

    "Use image_agent whenever the customer asks for an actual image, "
    "graphic, poster, or logo to be created. When you use image_agent, "
    "include the image URL exactly as returned in your final answer to "
    "the customer. Use video_agent whenever the customer asks for an "
    "actual video, clip, or motion content to be created. When you use "
    "video_agent, include the video URL exactly as returned in your final "
    "answer to the customer. Use deployment_agent whenever the customer "
    "wants their website published live/online, not just written as code "
    "— typically after developer_agent (and qa_agent) have produced a "
    "final site. When you use deployment_agent, include the live URL "
    "exactly as returned in your final answer to the customer. Call "
    "image_agent and video_agent AT MOST ONCE each per customer request — "
    "they are costly to run, so never call either of them a second time to "
    "'retry' or generate a variation; use the first result you get.\n\n"

    "Once you have what you need from your tools, give the customer a "
    "clear, complete final answer summarizing what was done and any "
    "code/output produced."
)

SPECIALIST_TOOLS = [
    feasibility_agent, site_architect_agent, developer_agent, qa_agent,
    content_agent, marketing_agent, bookkeeping_agent, legal_agent,
    seo_agent, localization_agent,
    pdf_report_agent, business_card_agent, letterhead_agent,
    smart_contract_agent, social_media_strategy_agent,
    analytics_agent, marketing_strategy_agent,
    image_agent, video_agent,
    deployment_agent, deep_analysis_agent, site_audit_agent,
]

AGENT_MAP = {
    "feasibility_agent": feasibility_agent,
    "site_architect_agent": site_architect_agent,
    "developer_agent": developer_agent,
    "qa_agent": qa_agent,
    "content_agent": content_agent,
    "marketing_agent": marketing_agent,
    "bookkeeping_agent": bookkeeping_agent,
    "legal_agent": legal_agent,
    "seo_agent": seo_agent,
    "localization_agent": localization_agent,
    "pdf_report_agent": pdf_report_agent,
    "business_card_agent": business_card_agent,
    "letterhead_agent": letterhead_agent,
    "smart_contract_agent": smart_contract_agent,
    "social_media_strategy_agent": social_media_strategy_agent,
    "analytics_agent": analytics_agent,
    "marketing_strategy_agent": marketing_strategy_agent,
    "image_agent": image_agent,
    "video_agent": video_agent,
    "deployment_agent": deployment_agent,
    "deep_analysis_agent": deep_analysis_agent,
    "site_audit_agent": site_audit_agent,
}

# Deliverable type each agent's output is persisted as (see db/models.py
# DeliverableType). Agents not listed here don't get their output persisted.
DELIVERABLE_TYPE_MAP = {
    "feasibility_agent": "feasibility",
    "site_architect_agent": "site_architecture",
    "developer_agent": "site_html",
    "qa_agent": "qa_review",
    "content_agent": "content_copy",
    "marketing_agent": "marketing_copy",
    "bookkeeping_agent": "bookkeeping",
    "legal_agent": "legal",
    "seo_agent": "seo",
    "localization_agent": "localization",
    "pdf_report_agent": "pdf_report",
    "business_card_agent": "business_card",
    "letterhead_agent": "letterhead",
    "smart_contract_agent": "smart_contract",
    "social_media_strategy_agent": "social_media_strategy",
    "analytics_agent": "analytics",
    "marketing_strategy_agent": "marketing_strategy",
    "image_agent": "image",
    "video_agent": "video",
    "deployment_agent": "deployment",
    "deep_analysis_agent": "deep_analysis",
    "site_audit_agent": "site_audit",
}

# Agents that accept existing_content and should be handed the latest
# saved deliverable of their type so they revise it instead of starting
# from scratch. Deliberately excludes image/video/deployment (not
# meaningfully "editable"), qa_agent (a review, not an artifact), and
# site_audit_agent (re-running always means re-fetching the live page).
EDITABLE_AGENTS = {
    "feasibility_agent", "site_architect_agent", "developer_agent",
    "content_agent", "marketing_agent", "bookkeeping_agent", "deep_analysis_agent",
    "legal_agent", "seo_agent", "localization_agent",
    "pdf_report_agent", "business_card_agent", "letterhead_agent",
    "smart_contract_agent", "social_media_strategy_agent",
    "analytics_agent", "marketing_strategy_agent",
}

# Deliverable types whose result is a URL rather than inline content.
URL_DELIVERABLE_AGENTS = {"image_agent", "video_agent", "deployment_agent"}


def _build_project_context(project_id: str) -> str:
    """Builds a manifest summary string for the Manager's system prompt.

    Injected dynamically so the Manager knows exactly what files exist for
    this customer's project before it decides whether a request is a new
    build or an edit to something already built.

    Returns an empty string when no files exist yet (first-time build).
    """
    files = get_project_files(project_id)
    if not files:
        return ""

    lines = [f"  • {f['filename']} — {f['purpose']}" for f in files]
    file_list = "\n".join(lines)
    return (
        f"\n\n"
        f"╔══ EXISTING PROJECT ({'·'.join(str(len(files)) + ' files already built for this customer').split()}) ══╗\n"
        f"{file_list}\n"
        f"╚══ END PROJECT CONTEXT ══╝\n\n"
        "IMPORTANT routing rules for this customer:\n"
        "• If their request EDITS, CHANGES, or FIXES anything on the list above "
        "(e.g. 'change the hero text', 'update the contact email', 'add a pricing "
        "section to the home page') → call developer_agent with ONLY the specific "
        "change as the brief (e.g. 'Update the hero heading in index.html to say "
        "\"Welcome to Acme\"'). Do NOT rebuild the whole site.\n"
        "• If their request adds a NEW PAGE not in the list → call developer_agent "
        "with 'Add a new [page-name].html page with [description]'. Do NOT rebuild "
        "existing pages.\n"
        "• If they are asking a QUESTION about their site → answer it directly from "
        "the file list above; do NOT call developer_agent.\n"
        "• Only call developer_agent for a FULL new build when the customer asks to "
        "build a brand new, completely different site."
    )


def run_manager(
    customer_request: str,
    history: list[dict] | None = None,
    project_id: str | None = None,
    on_event=None,
) -> tuple[str, list[str], list[str], list[str]]:
    """Runs the Manager: Gemini decides which specialist tools to call
    (handled automatically by the SDK), then returns a final answer.

    Args:
        customer_request: The customer's latest message.
        history: Prior turns for this customer, oldest first, each a dict
            like {"role": "user"|"assistant", "content": str} — see
            db.repository.get_recent_messages. Optional; omit for a
            one-off, memory-less request.
        project_id: When set, editable agents are automatically handed
            their latest saved deliverable for this project (so they
            revise it) and every agent's output is persisted as a new
            deliverable version. Omit to run stateless, e.g. when no
            database is configured.
        on_event: Optional callback(step_name, status, detail=None)
            invoked as each specialist agent starts/finishes — used by the
            background job layer to record progress.

    Returns (final_answer, list_of_agents_used, list_of_image_urls,
    list_of_video_urls).
    """
    agents_used: list[str] = []
    image_urls: list[str] = []
    video_urls: list[str] = []

    # ── Dynamic system prompt: inject existing project manifest ──────────
    # This is the core of targeted-edit routing. The Manager sees the file
    # list BEFORE deciding which tool to call, so it can correctly classify
    # "change the hero text" as an edit to index.html rather than a new
    # build request. Without this, the Manager is blind to existing work
    # and tends to regenerate the whole site on every request.
    system_prompt = MANAGER_SYSTEM_PROMPT
    if project_id:
        project_context = _build_project_context(project_id)
        if project_context:
            system_prompt = MANAGER_SYSTEM_PROMPT + project_context

    contents = []
    for turn in (history or []):
        role = "user" if turn.get("role") == "user" else "model"
        contents.append(genai_types.Content(role=role, parts=[genai_types.Part(text=turn["content"])]))
    contents.append(genai_types.Content(role="user", parts=[genai_types.Part(text=customer_request)]))

    for _ in range(8):
        response = _get_client().models.generate_content(
            model=MODEL,
            contents=contents,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=SPECIALIST_TOOLS,
        automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(disable=True),
            ),
        )
        candidate = response.candidates[0]
        contents.append(candidate.content)

        fn_call = None
        for part in candidate.content.parts:
            if getattr(part, "function_call", None):
                fn_call = part.function_call
                break

        if not fn_call:
            return response.text, agents_used, image_urls, video_urls

        # Hard guard: generation tools (image/video) are expensive and the
        # Manager has been observed calling them more than once per turn.
        # Once one has fired, refuse to run it again and tell the model to
        # wrap up instead of generating duplicates.
        if fn_call.name in ("image_agent", "video_agent", "deployment_agent") and fn_call.name in agents_used:
            result = (
                f"{fn_call.name} has already been called once in this "
                "conversation. Do not call it again — use the result you "
                "already have and give the customer your final answer now."
            )
            agents_used.append(fn_call.name)
            contents.append(genai_types.Content(
                role="user",
                parts=[genai_types.Part(function_response=genai_types.FunctionResponse(
                    name=fn_call.name, response={"result": result}
                ))]
            ))
            continue

        agents_used.append(fn_call.name)
        fn = AGENT_MAP.get(fn_call.name)
        kwargs = dict(fn_call.args)

        deliverable_type = DELIVERABLE_TYPE_MAP.get(fn_call.name)

        # ── existing-content injection ────────────────────────────────────
        # developer_agent is special: load from project_files table so it
        # receives the current manifest (including any prior partial edits)
        # rather than just the last deliverable blob.
        if project_id and fn_call.name in EDITABLE_AGENTS:
            if fn_call.name == "developer_agent":
                existing_files = get_project_files(project_id)
                if existing_files:
                    kwargs["existing_content"] = json.dumps(
                        {"files": existing_files}, ensure_ascii=False
                    )
            else:
                existing = get_latest_deliverable(project_id, deliverable_type)
                if existing:
                    kwargs["existing_content"] = existing["content"]

        if on_event:
            on_event(fn_call.name, "running")

        result = fn(**kwargs) if fn else f"Unknown tool: {fn_call.name}"
        print(f"DEBUG: fn_call.name={fn_call.name}, result type={type(result)}, result={result!r}")

        if fn_call.name == "image_agent" and isinstance(result, str) and result.startswith("http"):
            image_urls.append(result)
        if fn_call.name == "video_agent" and isinstance(result, str) and result.startswith("http"):
            video_urls.append(result)

        # ── persist result ────────────────────────────────────────────────
        if project_id and deliverable_type and isinstance(result, str):
            if fn_call.name == "developer_agent":
                # Result should be a JSON manifest. Parse it and persist
                # individual files to project_files so edits can be targeted.
                try:
                    manifest = json.loads(result)
                    files = manifest.get("files", [])
                    if files:
                        upsert_project_files(project_id, files)
                        # Rebuild the full manifest from the updated project
                        # files table (includes unchanged files from prior
                        # turns) and persist it as the canonical deliverable.
                        all_files = get_project_files(project_id)
                        full_manifest = json.dumps(
                            {
                                "archetype": manifest.get("archetype", "custom"),
                                "files": all_files,
                            },
                            ensure_ascii=False,
                        )
                        upsert_deliverable(
                            project_id, deliverable_type, content=full_manifest
                        )
                        # Feed the full manifest back to the Manager so it
                        # can give the customer an accurate summary of the
                        # whole site, not just the changed files.
                        result = full_manifest
                except (json.JSONDecodeError, AttributeError, KeyError):
                    # Fallback: store the raw result as plain text if the
                    # agent didn't return valid JSON (shouldn't happen with
                    # the updated prompt, but guards against model drift).
                    print("WARNING: developer_agent returned non-JSON — storing raw result")
                    upsert_deliverable(project_id, deliverable_type, content=result)
            else:
                is_url_result = fn_call.name in URL_DELIVERABLE_AGENTS and result.startswith("http")
                upsert_deliverable(
                    project_id,
                    deliverable_type,
                    content=result,
                    url=result if is_url_result else None,
                )

        if on_event:
            on_event(fn_call.name, "done")

        contents.append(genai_types.Content(
            role="user",
            parts=[genai_types.Part(function_response=genai_types.FunctionResponse(
                name=fn_call.name, response={"result": result}
            ))]
        ))

    return "Max steps reached without a final answer.", agents_used, image_urls, video_urls
