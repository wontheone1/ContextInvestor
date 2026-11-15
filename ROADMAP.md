# Contextual Investing — 24-Hour Hackathon Feature Roadmap (`ROADMAP.md`)

> **Constraint**: Less than 24 hours remaining before hackathon submission & live 3-minute demo.
> **Goal**: Ship features that are **dead-simple to explain to any judge or general audience in 10 seconds**, maximize our score on **`challenge.md`** (*Creative use of live web data 20%* & *Real-timeness 20%*), and are **100% realistic to finish and polish today**.

---

## Recently Shipped Milestones
- **Full Bilingual (`EN` | `한국어`) & Korea Exchange (`KOSPI` `.KS` / `KOSDAQ` `.KQ`) Integration**: Shipped end-to-end Korean domestic stock lookup (Hangul names, English names, 6-digit KRX codes, and dynamic 2,600+ stock autocomplete), locale-aware dual-listing routing (`한국어` -> KRX 본주 vs. `EN` -> US ADR), pure KRW (`₩` integer prices & `조`/`억` market cap/EV/revenue) charts & fundamentals with Naver Finance fallback, Watchlist starter themes, and `0.00%`-normalized multi-currency cohort comparison.

## Why This Roadmap Exists
Right now, **Contextual Investing** combines **Context.dev** (`client.news.search` + `client.company.search`), live **US / ADR / KRX** market & fundamental data, and **Gemini** synthesis. To stand out even further against `challenge.md`:
1. **Simple story**: Everyone understands *"Don't just read the news—fact-check rumors in one click, and get alerted when a company's own pricing, DART/SEC IR, or jobs page changes."*
2. **Low risk, high demo wow-factor**: Every feature below uses methods already typed in our installed `context.dev` SDK (`v3.29.0`) without needing brittle webhook servers, ngrok tunnels, or massive batch pipelines.

---

## Phase 1: Must-Ship Today (Highest ROI, ~6–8 Hours Total)

### Killer Feature 1: "Verify This Claim" — 1-Click Fact-Checker (`Truth at Internet Speed`)
- **10-Second Pitch**: *"See a scary market rumor or bold headline? Click **Verify Claim**—we check the live web and official company pages in seconds and tell you if it's **Confirmed, Disputed, or Unverified** with clickable sources."*
- **What the User Sees**:
  - A **Verify Claim** button directly on every news row in the feed + a quick *"Check any stock rumor..."* input bar.
  - A clean result card showing:
    - Verdict badge: **`Confirmed`** (Emerald) / **`Disputed`** (Rose) / **`Unverified`** (Amber)
    - 2-sentence plain-English summary of what primary sources actually say
    - Clickable source links (`sources`) so anyone can verify the proof themselves.
- **How We Build It Fast**:
  - **Context.dev API**: `client.web.answers({ mode: 'fast', task, json_format, timeoutOpts })`
  - **1 API route + 1 UI drawer/card**: ~2–3 hours end-to-end. No extra infrastructure needed.

---

### Killer Feature 2: "Company Change Radar" — Watch Official Company Pages (`The Web, Watched`)
- **10-Second Pitch**: *"News only tells you what journalists already wrote. **Change Radar** watches a company's own pricing, product, or careers page and flags meaningful changes before they hit headlines."*
- **What the User Sees**:
  - Inside any searched company view, a **Watch Official Page** button with 3 preset targets any investor understands:
    1. **Pricing / Products** (e.g., price hikes, new product launches)
    2. **Careers / Hiring** (e.g., surging AI or manufacturing hiring)
    3. **Newsroom / Investor Relations** (e.g., new official announcements)
  - A **"Check Now"** button (`monitors.run`) so during the 3-minute stage demo you can trigger a live check on demand and inspect detected changes (`monitors.listChanges`)—zero waiting around for cron schedules or webhook debugging.
- **How We Build It Fast**:
  - **Context.dev APIs**: `client.web.mapUrls` (auto-finds `/pricing`, `/careers`, `/newsroom` for the company's domain) + `client.monitors.create` (`type: 'page'`, `change_detection: { type: 'semantic', instructions }`) + `client.monitors.run` + `client.monitors.listChanges`.
  - **Why Polling Beats Webhooks for <24h**: Polling `listChanges` + an on-demand **Check Now** button works reliably in `localhost` and Cloud Run previews without dealing with webhook tunnel/signature edge cases under time pressure.

---

### Killer Feature 3: Official Brand Identity & Retail Buzz vs. Wall Street (`Scrape the Economy`)
- **10-Second Pitch**: *"Brings every company alive with its official logo and compares what **Wall Street headlines** say against what **real customers and developers on Reddit** are saying today."*
- **What the User Sees**:
  - **Real Company Logos & Verified Industry Tags**: Automatically enriches the Watchlist and Company Header with real logos and official domains instead of plain text initials.
  - **Wall Street vs. Reddit Pulse**: A compact two-bar comparison on the company deep dive showing whether public Reddit discussion agrees or disagrees with institutional news sentiment, with 2–3 top community threads linked.
- **How We Build It Fast**:
  - **Context.dev APIs**:
    - `client.brand.retrieve({ type: 'by_ticker', ticker })` / `{ type: 'by_name', name }` (takes ~1 hour to wire into the header & watchlist!).
    - `client.web.scrape` with the pre-built **`reddit-search`** parser (or `client.web.search` scoped to `reddit.com`) + a lightweight Gemini sentiment comparison.

---

## Phase 2: Polish & Demo Prep (Final 4–6 Hours)

1. **Rebrand UI to "Contextual Investing"**: Update the top navbar wordmark, browser `<title>`, and `metadata.json` so the live app matches `PITCH.md`.
2. **Pre-Warm / Seed 1–2 Live Monitors Before Judging**: Create 1–2 active monitors ahead of the pitch so the **Change Radar** panel shows real history + can still be triggered live with **Check Now**.
3. **2-Minute End-to-End Dry Run**: Walk through the exact 3-minute script in `PITCH.md` (`Watchlist Pulse` → `NVDA Chart & Ecosystem` → `Verify Claim` → `Change Radar Check Now` → `Save Bookmark`) to ensure zero slow spinners or broken states.

---

## Explicitly Cut (Too Complex or Hard to Pitch in <24h)

To protect polish and reliability before the deadline, we are intentionally **not** building:
- **Webhook Delivery & Secret Rotation Pipelines**: Overkill when polling `monitors.listChanges` + **Check Now** delivers the exact same live-demo outcome cleanly.
- **100,000-URL Batch Jobs**: Hard to showcase visually in a 3-minute live demo and unnecessary for interactive stock tracking.
- **PDF / SEC Filing Upload & OCR Pipelines**: Slow to upload/parse live on stage and harder for general audiences to follow than a 1-click rumor fact-check.
- **Authenticated Browser Profiles & Custom CSS Selectors**: Fragile during demos and confusing to explain to non-technical judges.

---

## Quick Effort & Impact Matrix

| Feature | Context.dev APIs Used | Challenge Criteria Hit | Est. Time | Priority |
| :--- | :--- | :--- | :---: | :---: |
| **1. Verify This Claim** (1-Click Fact-Checker) | `web.answers` | Truth at Internet Speed, Creative Live Web | 2–3 hrs | **P0 (Build First)** |
| **2. Official Brand Logos & Verified Metadata** | `brand.retrieve` | Completeness of Demo, Polish | 1–2 hrs | **P0 (Quick Win)** |
| **3. Company Change Radar** (Pricing/Jobs/IR Watch) | `web.mapUrls` + `monitors.*` | **The Web, Watched**, **Real-timeness (20%)** | 3–4 hrs | **P1 (Core Differentiator)** |
| **4. Wall Street vs. Reddit Buzz** | `web.scrape` (`reddit-search`) | **Scrape the Economy**, Creative Live Web | 2–3 hrs | **P2 (If Time Allows)** |
| **5. UI Rebrand → Contextual Investing** | — | Brand Consistency with `PITCH.md` | 30 mins | **P0 (Before Demo)** |
