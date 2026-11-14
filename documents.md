# Context.dev API Documentation Directory (`documents.md`)

Curated reference of official **Context.dev** documentation URLs relevant to building and extending **Max Context Intelligence** (TypeScript / Next.js), distilled from [`https://docs.context.dev/introduction`](https://docs.context.dev/introduction) and [`https://docs.context.dev/llms.txt`](https://docs.context.dev/llms.txt).

> **Tip for AI Agents & Scripts**: Append `.md` to any documentation URL (e.g., `https://docs.context.dev/answers/overview.md`) to fetch clean Markdown directly.
> - **Full Index (`llms.txt`)**: https://docs.context.dev/llms.txt
> - **OpenAPI Spec**: https://docs.context.dev/openapi.json

---

## 1. Getting Started, TypeScript SDK & Agent Tooling

- [Context.dev: the web data API (Introduction)](https://docs.context.dev/introduction) — Overview of web scraping, extraction, search, answers, entities, news, batches, and monitors.
- [Quickstart](https://docs.context.dev/quickstart) — API key setup, TypeScript SDK installation, and first request.
- [Agent quickstart](https://docs.context.dev/agent-quickstart) — Coding-agent workflow for setting up Context.dev (`CONTEXT_DEV_API_KEY`).
- [JavaScript and TypeScript SDK](https://docs.context.dev/sdks/typescript) — Official TypeScript SDK (`context.dev`), typed methods, timeouts, and retries.
- [MCP server](https://docs.context.dev/install-mcp) — Connect AI coding tools to live Context.dev MCP tools.
- [Make Context your default search and scrape tool](https://docs.context.dev/default-search-scrape) — Configure agent web search and page reading with Highlights.
- [Agent skill](https://docs.context.dev/install-skill) — Install the Context.dev agent skill for endpoint selection and valid request payloads.
- [CLI](https://docs.context.dev/install-cli) — Run `context-dev` CLI commands with JSON output for quick testing.

---

## 2. Web Scraping, Extraction & Market-Signal Parsers (`Scrape`)

### Core Scrape Formats & Extraction
- [Scrape Overview](https://docs.context.dev/scrape/overview) — Extract Markdown, structured JSON, highlights, metadata, or screenshots from any URL.
- [Markdown](https://docs.context.dev/scrape/markdown) — Convert rendered web pages into clean LLM-ready Markdown.
- [Highlights](https://docs.context.dev/scrape/highlights) — Extract only the Markdown passages relevant to a specific question or financial topic.
- [JSON (Structured Schema Extraction)](https://docs.context.dev/scrape/json) — Extract structured facts from any page matching your JSON Schema.
- [Product](https://docs.context.dev/scrape/product) — Extract product pricing, availability, and SKUs from live product pages.
- [Page metadata](https://docs.context.dev/scrape/page-metadata) — Read titles, descriptions, social tags, headings, and structured metadata.
- [PDFs and documents](https://docs.context.dev/scrape/pdfs-and-documents) — Extract text from public PDF filings, earnings decks, and reports via URL.
- [YouTube videos](https://docs.context.dev/scrape/youtube) — Extract video metadata and transcripts as Markdown (e.g., keynotes, earnings calls).
- [Screenshot](https://docs.context.dev/scrape/screenshot) — Capture visual snapshots of a page or section as evidence.

### Freshness, Geography & Reliability
- [Waiting and rendering](https://docs.context.dev/scrape/waiting-and-rendering) — Control JS readiness and popup handling for dynamic investor/IR sites.
- [Content filtering](https://docs.context.dev/scrape/content-filtering) — Scope extraction to main content or specific page regions.
- [Location and headers](https://docs.context.dev/scrape/location-and-headers) — Fetch pages from specific countries (`us`, `kr`, `jp`, `de`, etc.).
- [Freshness and caching](https://docs.context.dev/scrape/freshness-and-caching) — Control cached vs. fresh live scrapes.
- [Timeouts, limits, and errors](https://docs.context.dev/scrape/timeouts-and-errors) — Handle deadlines and partial outputs cleanly.

### Pre-Built Parsers for Retail, App & Product Sentiment
- [Pre-built parsers Overview](https://docs.context.dev/scrape/prebuilt-parsers) — Structured extraction without custom CSS selectors.
- [Reddit search](https://docs.context.dev/scrape/prebuilt-parsers/reddit-search) — Read Reddit search results (up to 1,000 posts) for retail investor & developer sentiment.
- [Reddit post](https://docs.context.dev/scrape/prebuilt-parsers/reddit-post) — Read a Reddit thread and up to 1,000 comments.
- [Reddit subreddit](https://docs.context.dev/scrape/prebuilt-parsers/reddit-subreddit) — Track top discussions in a target subreddit.
- [G2 reviews](https://docs.context.dev/scrape/prebuilt-parsers/g2-reviews) — Pull the 25 most recent software reviews (useful for B2B SaaS demand signals).
- [App Store](https://docs.context.dev/scrape/prebuilt-parsers/app-store) & [App Store reviews](https://docs.context.dev/scrape/prebuilt-parsers/app-store-reviews) — Track app ratings, pricing, and recent user reviews.
- [Google Play](https://docs.context.dev/scrape/prebuilt-parsers/google-play) & [Google Play reviews](https://docs.context.dev/scrape/prebuilt-parsers/google-play-reviews) — Track Android app ratings, downloads, and reviews.
- [Links](https://docs.context.dev/scrape/prebuilt-parsers/links) — Extract outbound links and labels (e.g., finding IR filings or press links).

---

## 3. Map, Crawl, Web Search, Answers & Document Parsing

- [Map URLs Overview](https://docs.context.dev/map/overview) — Discover all URLs on a company domain (`/pricing`, `/careers`, `/investors`, `/newsroom`).
- [Filter and search URLs](https://docs.context.dev/map/filter-and-search) — Filter a domain's URLs by path or topic before scraping.
- [Crawl Overview](https://docs.context.dev/crawl/overview) — Collect linked pages from a starting URL as Markdown.
- [Search Overview](https://docs.context.dev/search/overview) — Search the live web with optional Markdown or highlight content per result.
- [Filter results](https://docs.context.dev/search/filters) — Narrow web searches by domain, recency, country, and language.
- [Result content](https://docs.context.dev/search/page-content) — Read page Markdown or highlights alongside search snippets.
- [Answers Overview](https://docs.context.dev/answers/overview) — Research a question across web pages and company records, returning structured JSON with cited source URLs.
- [Answer shape](https://docs.context.dev/answers/answer-shape) — Define the exact output schema using an example JSON object.
- [Sources and deadlines](https://docs.context.dev/answers/sources-and-deadlines) — Work with source citations, partial results, and response timeouts.
- [Parse documents Overview](https://docs.context.dev/parse/overview) — Upload PDF/Office files (up to 50 MiB) and convert them to Markdown.

---

## 4. Entities & Signals: Brand, Companies, People & News

### Brand & Company Intelligence
- [Brand Overview](https://docs.context.dev/brand/overview) — Retrieve official logos, colors, company details, and social links from one identifier.
- [Lookup by ticker](https://docs.context.dev/brand/lookup-by-ticker) — Resolve a stock ticker directly to a company profile & domain.
- [Lookup by name](https://docs.context.dev/brand/lookup-by-name) — Resolve a company name to its website and brand profile.
- [Lookup by domain](https://docs.context.dev/brand/lookup-by-domain) — Retrieve a full profile from a known domain.
- [Auto-complete Brand](https://docs.context.dev/brand/search) — Typeahead search for up to 10 matching brands/companies.
- [Logo Link](https://docs.context.dev/brand/logo-link) — Embed crisp company logos directly in UI tables and cards.
- [Industry classification](https://docs.context.dev/classification/eic) — Read EIC / NAICS / SIC industry tags from a Brand profile.
- [Search companies](https://docs.context.dev/companies/search) — Find companies by name or plain-language description (e.g., `"companies like ..."`), with headcount and funding.
- [Search people](https://docs.context.dev/people/search) — Search executives, engineers, or researchers by employer and role.

### Company News (`Currently Integrated`)
- [News Overview](https://docs.context.dev/news/overview) — Search breaking and historical company news by ticker, name, domain, ISIN, or natural language.
- [Filter and sort news](https://docs.context.dev/news/filter-and-sort) — Filter by article type, language, country, domain, date range, and sort order.
- [Paginate news](https://docs.context.dev/news/paginate) — Deterministic cursor pagination across news pages.

---

## 5. Change Detection & Scale: Monitors, Webhooks & Batches

### Monitors (`The Web, Watched`)
- [Monitors Overview](https://docs.context.dev/monitors/overview) — Watch target web pages, sitemaps, or search queries on a schedule and detect changes.
- [Monitor targets](https://docs.context.dev/monitors/targets) — Choose `page`, `sitemap`, `extract`, or `search` targets with `exact` or `semantic` detection.
- [Page monitors](https://docs.context.dev/monitors/targets/page) — Watch a single URL with plain-English instructions describing which changes matter.
- [Sitemap monitors](https://docs.context.dev/monitors/targets/sitemap) — Detect newly added or removed URLs (e.g., `/jobs/*`, `/blog/*`, `/press/*`).
- [Extract monitors](https://docs.context.dev/monitors/targets/extract) — Track structured JSON baseline changes across key company pages.
- [Search monitors](https://docs.context.dev/monitors/targets/search) — Continuously watch a search query for unseen new web results.
- [Monitor schedules](https://docs.context.dev/monitors/schedules) — Configure run intervals, trigger on-demand checks (`run`), or pause/resume monitors.
- [Runs and changes](https://docs.context.dev/monitors/runs-and-changes) — Inspect run statuses, change diffs, and supporting evidence.
- [Webhooks](https://docs.context.dev/webhooks) — Verify webhook signatures and handle `change.detected` / `run.completed` deliveries.

### Batches
- [Batches Overview](https://docs.context.dev/batches/overview) — Scrape or crawl large sets of URLs asynchronously.
- [Submit a batch](https://docs.context.dev/batches/submit) & [Status and results](https://docs.context.dev/batches/results) — Queue multi-URL extraction jobs and fetch JSON results.

---

## 6. Relevant REST API Reference Endpoints

- [Search news (`POST /v1/news/search`)](https://docs.context.dev/api-reference/news/search) — Company and natural-language news search.
- [Answer questions (`POST /v1/web/answers`)](https://docs.context.dev/api-reference/web-extraction/answers) — Source-cited JSON answers (`fast` or `ultra`).
- [Scrape Anything (`POST /v1/web/scrape`)](https://docs.context.dev/api-reference/web-scraping/scrape) — Single-URL scraping and pre-built parsers.
- [Map URLs (`GET/POST /v1/web/map`)](https://docs.context.dev/api-reference/web-scraping/map) — Domain URL discovery.
- [Search the web (`POST /v1/web/search`)](https://docs.context.dev/api-reference/web-scraping/search) — Web search with optional page content.
- [Retrieve a brand (`POST /v1/brand/retrieve`)](https://docs.context.dev/api-reference/brand-intelligence/brand) — Company logos, metadata, and industry codes by ticker, name, or domain.
- [Auto-complete Brand](https://docs.context.dev/api-reference/brand-intelligence/search) — Fast brand/company autocomplete.
- [Search companies](https://docs.context.dev/api-reference/company/search) — Similar-company and natural-language company search.
- [Create a monitor (`POST /v1/monitors`)](https://docs.context.dev/api-reference/monitors/create) — Create a page/sitemap/extract/search monitor.
- [List monitors](https://docs.context.dev/api-reference/monitors/list) & [Run a monitor now](https://docs.context.dev/api-reference/monitors/run) — List active monitors or trigger an immediate run.
- [List monitor changes](https://docs.context.dev/api-reference/monitors/changes) & [Retrieve a monitor change](https://docs.context.dev/api-reference/monitors/change) — Fetch detected diffs and evidence.

---

## 7. Relevant Official Use-Case Blueprints

- [Give an AI agent live web context](https://docs.context.dev/use-cases/live-web-context-for-agents) — Bounded search/read patterns with strict source citations.
- [Turn website changes into a useful digest](https://docs.context.dev/use-cases/website-change-digests) — Monitor a watchlist and build a source-linked change digest.
- [Build a sourced competitor comparison](https://docs.context.dev/use-cases/competitor-research) — Compare product/pricing facts with timestamps and citations.
- [Datasets and comparisons](https://docs.context.dev/use-cases/structured-web-datasets) — Collect structured web observations and track history.
- [Research papers and PDFs with citations](https://docs.context.dev/use-cases/research-with-pdfs) — Turn PDFs into cited evidence.
- [Build a company directory with logos](https://docs.context.dev/use-cases/company-directory-logos) — Enrich company lists with official logos and fallbacks.
