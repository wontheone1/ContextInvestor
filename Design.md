# Contextual Investing — Architecture & Design Document (`Design.md`)

## 1. Overview & Purpose

**Contextual Investing** is a quantitative investor dashboard and AI financial research terminal built with Next.js 15 (App Router), TypeScript, the official **Context.dev SDK (`context.dev`)**, **Firebase Firestore** article & watchlist persistence, live **US Equity Market Charts & Key Investment Metrics**, and **Google Gemini (`@google/genai`)** market synthesis.

---

## 2. Core Features

### 2.0 Immediate Focused Workspace & Pervasive 1-Click Watchlist Curation (`app/page.tsx`, `components/TopNavbar.tsx`)
- **Direct Arrival & 4 Focused Views**: Users land directly in an uncluttered workspace with zero arrival gates, switching smoothly across **`Research & Compare`**, **`Morning Brief`**, **`Watchlist`**, and **`Saved Library`**, with progressive sub-tabs inside Single-Company Research (`01. Price & Fundamentals`, `02. Bull vs. Bear & News`, `03. Supply Chain & Peers`) and collapsible advanced news filters (`NewsSearchControlBar`).
- **1-Click `+ Follow` / `Following` at Every Point of Discovery**:
  1. **Searched Company (`app/page.tsx` & `components/CompanyMarketOverview.tsx`)**: Inline `+ Follow [Ticker/Name]` / `Following` toggle buttons in both the active company header and inside the Public Equity chart header / Private Company dossier header.
  2. **Related Ecosystem Companies (`components/RelatedCompaniesPanel.tsx`)**: Non-destructive per-company `+ Follow` / `Following` buttons on every supplier, customer, peer/competitor, and strategic partner row—plus a 1-click batch `Follow Top 4` / `Follow [Group]` button—allowing investors to curate value-chain peers without losing their active search.
  3. **Natural-Language Cohort Search Results (`components/CohortComparisonWorkspace.tsx`)**: Inline `+ Follow` / `Following` buttons on every matched candidate card in the screening grid, a 1-click `Follow Selected (N)` batch button in the Candidate Picker toolbar, and per-column Follow toggles in the comparison matrix.

### 2.1 Watchlist Morning Brief & Top Conviction Movers (`lib/watchlist-digest-service.ts`, `app/api/news/watchlist-digest/route.ts`, `components/WatchlistLandingBrief.tsx`)
- **Cross-Watchlist Intelligence Pulse**: Synthesizes daily intelligence across all companies the user is currently following (`NVDA`, `Stripe`, `AAPL`, `MSFT`, `PLTR`, `OpenAI` by default, up to 20 verified companies).
- **Executive Cross-Watchlist Narrative**: Aggregates live Context.dev news across all followed companies in parallel and uses `gemini-4-hydrogen` (`ThinkingLevel.LOW`, `responseSchema`) to synthesize a unified cross-watchlist executive summary, dominant macro/sector themes, and a collapsible company-by-company 1-sentence digest strip.
- **Top Most Bullish & Bearish Watchlist News**: Identifies and ranks the highest-conviction **Bullish Catalysts** and **Bearish Risks & Headwinds** across any company in the user's watchlist, complete with AI conviction/materiality scores (`1–100%`), a 1-sentence sentiment rationale (`Why Bullish` / `Why Bearish`), segmented filter tabs (`Bullish & Bearish`, `Top Bullish`, `Top Bearish`), 1-click company deep-dive pivoting, and article bookmarking.
- **Verified Follow / Unfollow Controls & Live Watchlist Sparklines (`lib/watchlist-company-service.ts`, `app/api/market/watchlist-quotes/route.ts`, `components/WatchlistCarousel.tsx`)**: Every single or batch Follow action strictly verifies that the input corresponds to an existing listed equity or verified private company (rejecting non-existent strings with inline feedback), hydrates real historical sparklines and `%` returns over an explicit selectable timeframe (`1D`, `5D`, `1M` default, `6M`, `1Y`) for public equities, renders disclosed valuations with zero fabricated share charts for private companies (`Stripe`, `OpenAI`, `Anthropic`, etc.), and syncs across `localStorage` and Firebase Firestore (`/followed_companies/{followId}`).

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

### 2.3c Natural-Language Cohort Screening & Multi-Company Comparison (`lib/query-intent.ts`, `lib/cohort-screener-service.ts`, `app/api/screener/query/route.ts`, `app/api/screener/compare/route.ts`, `components/CohortComparisonWorkspace.tsx`)
- **Search-Bar Intent Auto-Detection**: Automatically classifies inputs inside `NewsSearchControlBar` into direct single-company lookups (`NVDA`, `Stripe`) vs. natural-language screening queries (`"AI CHIP companies with over 200 bn USD market cap"`, `"Private frontier AI unicorns over $10B valuation"`), with clickable sample prompts and a 1-click mode override.
- **Grounded Discovery + Live Threshold Gatekeeping**: Combines `gemini-4-hydrogen` Google Search grounding and Context.dev `POST /v1/company/search` across both public equities and private unicorns, then verifies every candidate's real-time Market Cap / Valuation via `getCompanyMarketOverview` against numeric bounds (`> $200B`) and pre-selects the top 3 verified matches (up to 4 selectable simultaneously, plus `+ Add to Compare` for custom peers).
- **Normalized Multi-Stock `%` Price Chart Overlay & 4-Dimension Matrix**: Renders an interactive SVG `%` return chart (`1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, `5Y`) indexed to `0.00%` alongside a side-by-side comparison matrix covering Valuation & Market Action, Context.dev Company Profile & Operating Scale, Live News Sentiment & Top Catalyst Headline, Watchlist Follow/Unfollow, and 1-click Single-Company Deep Dive pivoting.

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

### 2.9 Contextual Research Assistant Drawer (`lib/research-chat-types.ts`, `lib/research-chat-service.ts`, `app/api/ai/chat/route.ts`, `components/ContextualResearchDrawer.tsx`)
- **Collapsible Right-Side Research Drawer**: Opens as a `440px` right-side analyst drawer (reserving `xl:pr-[440px]` on wide viewports so charts, cohort tables, and news remain fully visible beside the chat) via the workspace **Ask Research Assistant** button, docked right-edge desktop handle, or `Cmd/Ctrl + K`.
- **Automatic Live Workspace Context Injection**: Serializes the active view on every turn—either **Single-Company Deep Dive** (quote, multiples, 52W range, Context.dev firmographics, related ecosystem, AI bull/bear brief, and loaded news headlines) or **Cohort Comparison** (query, verified candidates, selected company dossiers, `%` chart returns, and top catalysts)—alongside the **Watchlist Pulse** summary and top conviction movers.
- **Google Search Grounding & Clickable Citations**: Uses server-side `gemini-4-hydrogen` (`ThinkingLevel.LOW`, `tools: [{ googleSearch: {} }]`) to combine exact dashboard numbers with live web research, surfacing clickable publisher links for both referenced terminal news and Google Search `groundingChunks` in a continuous session with dynamic context-aware starter prompts and a 1-click **Clear Chat** reset.

---

## 3. Visual & Aesthetic Direction

- **Primary Layout Model**: **Kamino.com** & **TradingView** — Deep space-navy & obsidian canvas (`#091326` / `#0A0D12`), elevated slate containers (`#0d1b33` / `#11161F`), crisp hairline borders (`#212c42` / `#1E2736`), featured equity strip with embedded SVG sparklines, and a high-density tabular news feed.
- **Accents & Typography**: **OpticOdds** & **AlphaX AI** — Electric cyan (`#09a4ff`), emerald (`#10B981`), and crimson (`#F43F5E`) accents paired with `Plus Jakarta Sans` headings, `IBM Plex Sans` body copy, and `IBM Plex Mono` (`tabular-nums`) for quantitative metrics and timestamps.
