# Contextual Investing — Core Features & Hackathon Pitch

> **Tagline**: *Stop reading yesterday's market tabs. Watch the entire supply chain, global news wire, and live valuation picture move in real time.*

---

## Part 1: High-Level Core Features

**Contextual Investing** is a real-time investment intelligence terminal built for **active investors tracking public companies**. Instead of bouncing between stock charts, fragmented financial blogs, paywalled wires, and machine-translated foreign articles, investors get one live workspace that watches their portfolio, explains *why* each headline matters, and maps supply-chain ripple effects as they happen.

### 1. Watchlist Morning Pulse & Top Conviction Signals
- **Cross-Watchlist Executive Summary**: The moment an investor opens Contextual Investing, they receive a unified briefing synthesizing breaking coverage across every company they follow (e.g., `NVDA`, `AAPL`, `MSFT`, `PLTR`, alongside key ecosystem benchmarks).
- **Company-by-Company Digest Strip**: A scannable grid condenses each followed company's latest news posture (`Bullish`, `Bearish`, `Mixed`, or `Neutral`) into a single actionable sentence, allowing one-click pivoting into deep research.
- **Top Most Bullish & Bearish Movers**: Surfaces the highest-impact upside catalysts and downside risks across the entire watchlist—scored by materiality (`1–100%` Conviction)—with a one-sentence explanation of *why* the story moves the needle.
- **Verified Live Follow / Unfollow Customization**: Investors can follow or unfollow any verified US-listed ticker or real private company (with live `1D–1Y` sparklines for public equities and disclosed valuations for private companies) and immediately regenerate the watchlist pulse.

### 2. Universal Company Search & Precision Filtering
- **Zero-Friction Ticker or Company Name Lookup**: Search seamlessly by stock symbol (`NVDA`, `TSLA`) or company name (`Microsoft`, `Palantir`) with automatic entity disambiguation across US exchanges.
- **Time-Window & Source Controls**: Narrow coverage to the last 24 hours, 7 days, 30 days, 90 days, or custom date windows—and filter by article type (editorial reporting, press releases, regulatory filings, advisories), language, publisher country, or specific domain.
- **Deterministic Browsing & Sorting**: Switch instantly between **Newest First** and **Relevance** sorting and page smoothly through deep historical coverage without losing active filters.

### 3. Live Price Action & Key Valuation Indicators
- **Interactive Equity Price Charts**: Inspect live price movement across `1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, and `5Y` timeframes with interactive crosshair inspection, previous-close reference lines, and period high/low tracking.
- **At-a-Glance Fundamental Metrics**: Pair breaking news directly with Market Cap, Trailing & Forward P/E, EPS (TTM), 52-Week Range positioning, trading volume vs. average volume, dividend yield, and beta—plus valuation context when exploring private ecosystem counterparts.

### 4. Supply-Chain & Competitive Ecosystem Discovery
- **Relationship-Grouped Related Companies**: Whenever an investor searches a public company, Contextual Investing automatically maps its surrounding ecosystem across four actionable groups:
  - **Suppliers & Infrastructure**
  - **Customers & Adopters**
  - **Peers & Competitors**
  - **Strategic Partners**
- **Multi-Role Awareness & One-Click Pivots**: Companies that play multiple roles (for example, acting as both a major cloud customer and an AI competitor) display cross-relationship badges, and clicking any related company pivots the entire chart, metrics, and news terminal in one step.

### 5. Evidence-Backed Sentiment & Side-by-Side Bull vs. Bear Synthesis
- **Per-Headline "Why" Rationales**: Every article carries a `Bullish`, `Bearish`, or `Neutral` tag accompanied by a concise, plain-English explanation grounded in the story itself—not an opaque black-box score.
- **Instant Sentiment Filtering**: Filter the live news feed to isolate strictly `Bullish` catalysts or `Bearish` risk events in seconds.
- **Side-by-Side Catalysts vs. Risks Verdict**: Summarizes the company's current news cycle into structured **Positive Catalysts (Bull Case)** next to **Risks & Headwinds (Bear Case)**, capped by an **Overall Investment Verdict**.

### 6. Borderless Global Coverage with Source Verification
- **Automatic Multi-Language Translation**: Detects non-English coverage from key semiconductor, manufacturing, and international financial markets (Korean, Japanese, German, French, Spanish, Chinese) and translates headlines and excerpts into crisp financial English automatically.
- **Original-Source Inspection Toggle**: Preserves source language attribution and offers a one-click **View Original** toggle so investors can verify every translated claim against the primary headline and excerpt.

### 7. Persistent Personal Research Workspace
- **Fast Repeat Research**: Recently explored company pages load rapidly on repeat visits without burning redundant live lookups.
- **Synced Watchlists & Saved Research Bookmarks**: Signed-in investors keep their custom followed companies and bookmarked articles persisted across sessions in a private personal research library.

---

## Part 2: Hackathon Pitch & Submission

### A. 3-Minute Live Demo Script

> **Speaker Goal**: Show—don't just tell—how **Contextual Investing** turns the live web into an instant decision engine for active public-market investors. Keep mouse movements deliberate and let the live UI updates carry each beat.

#### `[0:00 – 0:35]` Hook & Problem: The Morning Blind Spot
**On Screen**: Start on a clean slide or straight on the top of **Contextual Investing** showing the Watchlist Intelligence Pulse.

> **Spoken Script**:
> "If you actively invest in public equities—say Nvidia, Apple, Microsoft, or Palantir—your morning routine is broken. You open ten browser tabs: one for price charts, three for US financial news, another to check what TSMC or Asian suppliers announced overnight in Korean or Japanese, and a spreadsheet to track why a stock is actually moving.
>
> Most software runs on stale snapshots or gives you an AI summary with zero proof. We built **Contextual Investing**—a real-time market intelligence terminal powered by Context.dev that watches the live web for every company you follow and turns breaking global news into verified investment decisions in seconds."

---

#### `[0:35 – 1:15]` Act 1 — *The Web, Watched*: Landing Watchlist Pulse & Custom Reactivity
**On Screen**: Scroll slightly through the **Watchlist Intelligence Pulse** card. Point to the executive summary, company-by-company digest grid, and the side-by-side **Most Bullish** vs. **Most Bearish** columns. Type a ticker (e.g., `TSLA`) into the Follow bar and click **Follow**.

> **Spoken Script**:
> "This ties directly into **The Web, Watched**. The second you open Contextual Investing, you don't see a blank search box. You see a live synthesis across every company in your watchlist.
>
> At the top, we distill the cross-watchlist narrative and give you a one-line pulse for each stock you follow. Right below that, we rank the **most Bullish catalysts** and **most Bearish risks** across your entire portfolio—each scored by conviction with a clear *'Why Bullish'* or *'Why Bearish'* rationale.
>
> And it reacts in real time: if I follow a new ticker right here—like Tesla—the terminal pulls live web coverage and updates my watchlist briefing on the spot."

---

#### `[1:15 – 2:00]` Act 2 — *Scrape the Economy*: Live Valuation Context & Supply-Chain Pivots
**On Screen**: Click **NVDA** inside the watchlist digest to jump to `#company-research`. Highlight the live interactive price chart (toggle `1D` → `1M` → `1Y`) and the 8-card valuation metrics grid. Then click a company inside **Suppliers & Infra** or **Customers & Adopters** (e.g., `TSM` or `MSFT`).

> **Spoken Script**:
> "Now let's talk about **Scrape the Economy**. When I click Nvidia to go deeper, Contextual Investing fuses breaking news with live market reality—an interactive price chart across timeframes alongside Market Cap, P/E, EPS, 52-week range, and volume.
>
> Because public companies don't move in isolation, we also map the live ecosystem around every stock: **Suppliers**, **Customers**, **Peers**, and **Strategic Partners**—even tagging companies like Microsoft that sit in multiple relationships at once. One click on a supplier or customer pivots the entire terminal—news, chart, and metrics—so you catch supply-chain ripple effects before the broader market prices them in."

---

#### `[2:00 – 2:35]` Act 3 — *Truth at Internet Speed*: Source-Grounded AI & Global Verification
**On Screen**: Scroll to the **Positive Catalysts vs. Risks & Headwinds** panel and the **News Feed Table**. Click the `Bullish` sentiment filter, hover over an article tag tooltip, and click **View Original** on a translated non-English article if present (or explain multi-language verification).

> **Spoken Script**:
> "Finally, **Truth at Internet Speed**. Investors can't afford AI hallucinations. Every single article in our feed is tagged Bullish, Bearish, or Neutral with a source-grounded explanation right next to the publisher link. Side-by-side Bull vs. Bear cards weigh both sides objectively before giving a verdict.
>
> Even better—critical supply-chain news often breaks first in Korean, Japanese, or German. Contextual Investing automatically detects foreign-language coverage, translates it into clean financial English, and gives you a one-click **View Original** toggle so you can verify the primary source yourself."

---

#### `[2:35 – 3:00]` Close: Persistent Workspace & Judging Recap
**On Screen**: Click **Save** on a top catalyst article and briefly show the **Saved Articles** watchlist section at the bottom.

> **Spoken Script**:
> "When you spot an edge, one click bookmarks it to your personal research watchlist, synced across sessions.
>
> To recap: **Contextual Investing** takes the open web—global multi-language news, live equity pricing, fundamentals, and dynamic supply-chain graphs—and turns it into one fast, production-ready terminal for active investors. Thank you, and we'd love your questions."

---

### B. Devpost / Junction Written Submission

#### Project Name
**Contextual Investing**

#### Elevator Pitch (Short Tagline)
Real-time public-equity research assistant that watches your entire watchlist, surfaces ranked Bullish/Bearish catalysts with source-grounded rationales, translates global coverage, and maps live supply-chain ripple effects.

#### Inspiration
Active public-market investors lose hours every day stitching together fragmented tools: stock screeners for P/E ratios, news feeds flooded with unranked noise, manual searches to figure out which suppliers or customers are exposed to a headline, and missed early warnings published in various outlets from different countries. With Context.dev turning the open web into structured, real-time data in one call, we set out to build the daily research assistant app we always wished existed—one that greets you with signal the moment it opens and verifies every claim against primary sources.

#### What Contextual Investing Does
- **Watchlist Intelligence Pulse**: Opens with an executive cross-watchlist news summary, a company-by-company digest grid, and side-by-side **Top Bullish** and **Top Bearish** stories ranked by conviction score (`1–100%`) with one-sentence rationales.
- **Live Price Charts & Key Investment Metrics**: Pairs news flow with interactive `1D–5Y` price charts and fundamental indicators (Market Cap, TTM & Forward P/E, EPS, 52-Week Range, Volume, Dividend Yield, Beta).
- **Supply-Chain & Peer Ecosystem Explorer**: Groups related companies into **Suppliers & Infra**, **Customers & Adopters**, **Peers & Competitors**, and **Strategic Partners** (supporting multi-role overlap) with one-click terminal pivoting.
- **Transparent Bull vs. Bear Analysis**: Explains *why* every headline is Bullish, Bearish, or Neutral, lets investors filter by sentiment, and synthesizes side-by-side Positive Catalysts vs. Risks & Headwinds.
- **Automatic Multi-Language Translation & Verification**: Automatically translates international non-English articles into institutional English while preserving a **View Original** inspection toggle.
- **Customizable & Persistent Research**: Supports following/unfollowing any ticker or company and bookmarking high-conviction articles to a synced personal library.

#### How It Aligns with Junction Challenge Themes
1. **The Web, Watched**: Continuously aggregates live news across every followed company to surface the highest-materiality upside catalysts and downside risks without manual polling.
2. **Scrape the Economy**: Combines live web news signals with real-time equity pricing, valuation ratios, and cross-company supply-chain links to show how micro-news impacts broader market ecosystems.
3. **Truth at Internet Speed**: Anchors every AI classification, bull/bear summary, and translated headline directly to publisher citations, explicit rationales, and original-language source text.

#### How We Built It (High-Level)
- **Live Web Intelligence Layer**: Powered by Context.dev real-time company news search across US tickers and global publishers, supporting date-window, article-type, language, country, and domain filtering with deterministic cursor pagination.
- **Structured AI Synthesis**: Multi-step financial reasoning generates ranked conviction scores, per-article sentiment rationales, side-by-side Bull vs. Bear assessments, relationship-grouped company suggestions, and batch foreign-language translation.
- **Live Market Data Fusion**: Synchronizes real-time equity quote history and valuation metrics alongside news coverage.
- **Cloud Persistence & Fast Caching**: Caches repeat searches for low latency and persists user watchlists and saved research bookmarks securely per user.

#### Challenges We Ran Into
- Balancing cross-company fairness when synthesizing a multi-stock morning briefing so one mega-cap ticker doesn't crowd out the rest of an investor's watchlist.
- Designing concise, verifiable rationales and multi-role ecosystem classifications that remain strictly grounded in live web coverage rather than generic boilerplate.
- Handling mixed public tickers, company names, and non-English articles smoothly in a single unified search bar.

#### Accomplishments We're Proud Of
- Going from zero to a complete, responsive financial terminal where watchlist pulse, live price charts, supply-chain pivots, sentiment filtering, and multi-language verification all work together seamlessly.
- Making every AI insight auditable—investors always see *why* a story was scored Bullish or Bearish and can inspect original foreign-language headlines in one click.

#### What's Next for Contextual Investing
- Automated real-time webhook alerts triggered when a followed company or key supplier experiences a high-conviction sentiment shift.
- Deeper earnings-transcript and regulatory-filing ingestion paired with customizable portfolio exposure alerts.

---

### C. Junction Judging Criteria Alignment Matrix

| Judging Criterion (Weight) | How **Contextual Investing** Delivers | Live Demo Proof Point |
| :--- | :--- | :--- |
| **Real-world impact (20%)** | Eliminates tab-fatigue and international blind spots for active public-equity investors by uniting portfolio news triage, valuation context, and supply-chain contagion in one workspace. | Watchlist Morning Pulse immediately answers *"What matters in my portfolio today, and why?"* |
| **Creative use of live web data (20%)** | Fuses four live web dimensions—global multi-language news wires, real-time stock price/valuation metrics, structured Bull/Bear reasoning, and dynamic supply-chain relationship graphs. | Clicking a supplier or customer inside Related Companies pivots charts, metrics, and live news together. |
| **Completeness of demo (20%)** | Production-ready full-stack web terminal with live search, timeframe switching, facet/sentiment filters, pagination, custom watchlist following, and personal article bookmarking. | End-to-end interactive walkthrough with zero mock placeholders or dead buttons. |
| **Technical execution (20%)** | Parallel multi-company aggregation, structured conviction scoring (`1–100%`), automatic language detection/translation, responsive interactive charts, and fast repeat-query caching. | Sub-second chart timeframe switches, instant sentiment filtering, and structured multi-company synthesis. |
| **Real-timeness (20%)** | Dynamically reacts whenever an investor adds a new ticker to follow, refreshes breaking coverage, adjusts date windows, or pivots across related ecosystem companies. | Following a new ticker live during the pitch immediately pulls fresh coverage and updates the Watchlist Pulse. |
