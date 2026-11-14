# OpticAlpha Investor Intelligence — Architecture & Design Document (`Design.md`)

## 1. Overview & Purpose

**OpticAlpha Investor Intelligence** is a quantitative investor dashboard and AI financial research terminal built with Next.js 15 (App Router), TypeScript, the official **Context.dev SDK (`context.dev`)**, **Firebase Firestore** article & watchlist persistence, live **US Equity Market Charts & Key Investment Metrics**, and **Google Gemini (`@google/genai`)** market synthesis.

---

## 2. Core Features

### 2.1 Landing Dashboard: Watchlist News Summary & Top Conviction Movers (`lib/watchlist-digest-service.ts`, `app/api/news/watchlist-digest/route.ts`, `components/WatchlistLandingBrief.tsx`)
- **Immediate Landing Experience**: The dashboard starts with a **Watchlist Intelligence Pulse** covering all companies the user is currently following (`NVDA`, `Stripe`, `AAPL`, `MSFT`, `PLTR`, `OpenAI` by default, or any custom watchlist).
- **Executive Cross-Watchlist Narrative**: Aggregates live Context.dev news across all followed companies in parallel and uses `gemini-4-hydrogen` (`ThinkingLevel.LOW`, `responseSchema`) to synthesize a unified cross-watchlist executive summary, dominant macro/sector themes, and a company-by-company 1-sentence digest strip.
- **Top Most Bullish & Bearish Watchlist News**: Identifies and ranks the highest-conviction **Bullish Catalysts** and **Bearish Risks & Headwinds** across any company in the user's watchlist, complete with AI conviction/materiality scores (`1–100%`), a 1-sentence sentiment rationale (`Why Bullish` / `Why Bearish`), segmented filter tabs (`Bullish & Bearish`, `Top Bullish`, `Top Bearish`), 1-click company deep-dive pivoting, and article bookmarking.
- **Custom Follow / Unfollow Controls (`components/WatchlistCarousel.tsx`)**: Investors can follow any US ticker or private company directly from the watchlist bar or from the active company research header, persisted in `localStorage` and synchronized with Firebase Firestore (`/followed_companies/{followId}`) when signed in.

### 2.2 Server-Side Context.dev News Search (`lib/context-dev.ts` & `app/api/news/search/route.ts`)
- **Official SDK Integration**: Uses `import ContextDev from 'context.dev'` and calls `client.news.search(params)` against `POST https://api.context.dev/v1/news/search`.
- **Smart Auto-Detection (`auto`, `ticker`, `name`)**: Automatically detects whether a user entered a US stock ticker (`NVDA`, `AAPL`) or a public/private company name (`NVIDIA`, `Stripe`, `OpenAI`), resolving company names to US tickers when applicable and falling back seamlessly for unlisted companies.
- **Selectable Publication Date Range (`filterBy.date`)**: Supports **All Dates Included**, quick institutional windows (**Last 24h**, **Last 7 Days**, **Last 30 Days**, **Last 90 Days**), and custom start/end date pickers converted to epoch milliseconds (`from` and `to`).
- **Additional Facet Filtering (`filterBy`)**: Supports filtering by **Article Type** (`editorial`, `press_release`, `regulatory_filing`, `advisory`), **Article Language** (`en`, `de`, `fr`, `es`, `ja`, `zh`), **Publisher Country** (`us`, `gb`, `de`, `jp`, `ca`, `ch`, `sg`), or **Publisher Domain** (`reuters.com`, etc.).
- **Selectable Sorting Standard (`sortBy`)**: Toggle between **Newest First** (`{ type: 'newest' }`) and **Relevance** (`{ type: 'relevance' }`).
- **Next / Previous Cursor Pagination (`cursor` & `limit`)**: Maintains a client-side `cursorStack` of opaque `next_cursor` tokens returned by Context.dev while keeping `searchBy`, `filterBy`, and `sortBy` locked across pages.

### 2.3 Live US Equity Price Chart & Key Investment Metrics (`lib/market-data-service.ts`, `app/api/market/overview/route.ts`, `components/CompanyMarketOverview.tsx`)
- **Interactive SVG Area/Line Chart**: Supports `1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, and `5Y` timeframes with interactive crosshair scrubbers, previous-close reference line, and period high/low statistics.
- **8-Card Key Investment Metrics Grid**: Displays Market Cap, P/E Ratio (TTM & Forward), EPS (TTM), 52-Week Range progress bar, Volume vs. Avg Volume, and Dividend Yield & Beta for public equities, or a Private Company Valuation & Funding Profile for unlisted companies (`Stripe`, `OpenAI`, `SpaceX`, `Databricks`, `Anthropic`).

### 2.3b Collapsible Company Profile (`lib/company-profile-service.ts`, `app/api/company/profile/route.ts`, `components/CollapsibleCompanyProfile.tsx`)
- **Context.dev Company Search (`POST /v1/company/search`)**: Enriches the currently searched public ticker or private company with corporate firmographics, social links, industry classifications, estimated annual revenue, and funding round history (`mode: 'fast'`).
- **Top-Match Resolution**: Resolves short stock tickers to company names before querying `/v1/company/search` and scores candidates (`stock_symbols`, exact company name, domain stem, and relevance rank) so only the single best-matching profile is displayed without cluttering the workspace.
- **Progressive Disclosure UX**: Renders collapsed by default as a 1-line summary bar (`Company Name · Organization Type · HQ · Headcount · Est. Year · Stage / Revenue`) directly beneath the Company Research header, expanding on click into a 3-column firmographic, industry/revenue, and chronological funding dossier.

### 2.4 Related Companies Ecosystem Grouped by Relationship (`lib/related-companies-service.ts`, `app/api/ai/related/route.ts`, `components/RelatedCompaniesPanel.tsx`)
- Suggests related companies for the currently searched company grouped into 4 relationship tabs: **Suppliers & Infra**, **Customers & Adopters**, **Peers & Competitors**, and **Strategic Partners**.
- Supports multi-relationship membership (e.g., Microsoft or Amazon appearing as both a Customer and a Strategic Partner/Competitor) with cross-group badges and 1-click search pivoting.

### 2.5 Per-Article Sentiment Rationale & Side-by-Side Catalysts vs. Risks (`lib/sentiment-service.ts`, `lib/gemini-service.ts`, `components/AIMarketBriefPanel.tsx`, `components/NewsFeedTable.tsx`)
- Every article in the News Feed includes a `Bullish`, `Bearish`, or `Neutral` badge plus a concise 1-sentence AI explanation (`sentimentReason`) explaining why the article carries that sentiment.
- The `AIMarketBriefPanel` presents **Positive Catalysts (Bull Case)** and **Risks & Headwinds (Bear Case)** side-by-side along with a holistic **Overall Investment Verdict**.

### 2.6 Firebase Firestore Caching, Saved Articles & Followed Companies (`lib/firebase-client.ts`, `firestore.rules`)
- **Search Page Caching (`/cached_searches/{cacheId}`)**: Deterministically caches search pages in Firestore.
- **Personal Investor Bookmarks (`/saved_articles/{savedId}`)**: Owner-isolated saved articles collection.
- **Followed Watchlist Companies (`/followed_companies/{followId}`)**: Owner-isolated collection storing custom followed tickers and private companies.

### 2.7 Automatic Multi-Language News Translation (`lib/translation-service.ts`)
- Automatically detects non-English news articles and batch-translates headlines and summaries into institutional English while preserving a `View Original` toggle.

### 2.8 Structured Telemetry Logging (`lib/logger.ts`)
- Logs all function calls at `INFO` level with sanitized parameters (`logFunctionCall` / `logInfo`) and logs all `@google/genai` invocations with model, prompt, config, and output while stripping `inlineData` (`logGenAICall`).

---

## 3. Visual & Aesthetic Direction

- **Primary Layout Model**: **Kamino.com** & **TradingView** — Deep space-navy & obsidian canvas (`#091326` / `#0A0D12`), elevated slate containers (`#0d1b33` / `#11161F`), crisp hairline borders (`#212c42` / `#1E2736`), featured equity strip with embedded SVG sparklines, and a high-density tabular news feed.
- **Accents & Typography**: **OpticOdds** & **AlphaX AI** — Electric cyan (`#09a4ff`), emerald (`#10B981`), and crimson (`#F43F5E`) accents paired with `Plus Jakarta Sans` headings, `IBM Plex Sans` body copy, and `IBM Plex Mono` (`tabular-nums`) for quantitative metrics and timestamps.
