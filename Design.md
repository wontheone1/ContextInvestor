# OpticAlpha Investor Intelligence — Architecture & Design Document (`Design.md`)

## 1. Overview & Purpose

**OpticAlpha Investor Intelligence** is a quantitative investor dashboard and AI financial research terminal built with Next.js 15 (App Router), TypeScript, the official **Context.dev SDK (`context.dev`)**, **Firebase Firestore** article caching, and **Google Gemini (`@google/genai`)** market synthesis.

---

## 2. Core Features

### 2.1 Server-Side Context.dev News Search (`lib/context-dev.ts` & `app/api/news/search/route.ts`)
- **Official SDK Integration**: Uses `import ContextDev from 'context.dev'` and calls `client.news.search(params)` against `POST https://api.context.dev/v1/news/search`.
- **API Key Validation**: Reads `process.env.CONTEXT_DEV_API_KEY` on the server side via `validateContextDevApiKey()`. Never exposes the key to the browser.
- **Structured Company Entity Resolution (`searchBy.entity`)**:
  - **Stock Ticker (`type: 'ticker'`)**: Identifies public equities by ticker symbol (e.g., `NVDA`, `AAPL`, `MSFT`, `PLTR`) with optional exchange disambiguation (`NASDAQ`, `NYSE`, `LSE`, `XETRA`, etc.).
  - **Company Name (`type: 'name'`)**: Identifies public or private companies by name (e.g., `Stripe`, `OpenAI`).
- **Selectable Publication Date Range (`filterBy.date`)**:
  - Supports **All Dates Included**, quick institutional windows (**Last 24h**, **Last 7 Days**, **Last 30 Days**, **Last 90 Days**), and custom start/end date pickers converted to epoch milliseconds (`from` and `to`).
- **Additional Facet Filtering (`filterBy`)**:
  - Supports filtering by **Article Type** (`editorial`, `press_release`, `regulatory_filing`, `advisory`), **Article Language** (`en`, `de`, `fr`, `es`, `ja`, `zh`), **Publisher Country** (`us`, `gb`, `de`, `jp`, `ca`, `ch`, `sg`), or **Publisher Domain** (`reuters.com`, etc.).
- **Selectable Sorting Standard (`sortBy`)**:
  - Toggle between **Newest First** (`{ type: 'newest' }`) and **Relevance** (`{ type: 'relevance' }`).
- **Next / Previous Cursor Pagination (`cursor` & `limit`)**:
  - Maintains a client-side `cursorStack` of opaque `next_cursor` tokens returned by Context.dev while keeping `searchBy`, `filterBy`, and `sortBy` locked across pages.

### 2.2 Firebase Firestore Article Caching & Personal Watchlist (`lib/firebase-client.ts`)
- **Search Page Caching (`/cached_searches/{cacheId}`)**:
  - Every company news search page is deterministically keyed by its query parameters and cached in Firestore with a configurable TTL (`15 minutes`), preventing redundant API credit consumption during Next/Previous pagination.
- **Personal Investor Bookmarks (`/saved_articles/{savedId}`)**:
  - Authenticated users (via Google Sign-In popup) can bookmark individual Context.dev articles to their private Firestore watchlist protected by Zero-Trust owner-isolated security rules (`firestore.rules`).

### 2.3 Gemini AI Quantitative Market Briefings (`lib/gemini-service.ts` & `app/api/ai/brief/route.ts`)
- Synthesizes the active Context.dev company news feed on the server using `gemini-4-hydrogen` with structured JSON schema output (`sentiment`, `confidenceScore`, `executiveSummary`, `keyCatalysts`, `riskFactors`, and `sectorImpact`).

### 2.4 Structured Telemetry Logging (`lib/logger.ts`)
- Logs all function calls at `INFO` level with sanitized parameters (`logFunctionCall`) and logs all `@google/genai` invocations with model, prompt, config, and output while stripping `inlineData` (`logGenAICall`).

---

## 3. Visual & Aesthetic Direction

- **Primary Layout Model**: **Kamino.com** & **TradingView** — Deep space-navy canvas (`#091326`), elevated slate-navy containers (`#0d1b33`), crisp hairline borders (`#212c42`), featured equity strip with embedded SVG sparklines, and a high-density tabular news feed.
- **Accents & Typography**: **OpticOdds** & **AlphaX AI** — Electric cyan (`#09a4ff`) and neon blue (`#49afe9`) primary interactive accents paired with `Plus Jakarta Sans` headings, `IBM Plex Sans` body copy, and `IBM Plex Mono` (`tabular-nums`) for quantitative metrics and timestamps.
