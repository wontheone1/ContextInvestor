/**
 * ============================================================================
 * FILE: components/HackathonPitchDeck.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Interactive 10-Slide Hackathon Pitch Deck, Full-Screen Presenter Mode, and
 * 1-Click PowerPoint (.pptx) & PDF Exporter for Contextual Investing.
 *
 * USE CASES:
 * 1. Presenting Contextual Investing to general-audience hackathon judges using
 *    an everyday problem analogy and a concrete NVIDIA supply-chain ripple story
 *    without assuming prior public-market investing knowledge.
 * 2. Showcasing real high-resolution product screenshots captured from the live
 *    running application alongside plain-English jargon translations, 3-minute
 *    timed speaker notes, and 1-click "Try This Live in App" deep links.
 * 3. Exporting the entire 10-slide presentation (including embedded PNG product
 *    screenshots, key callouts, and speaker scripts) to a widescreen PowerPoint
 *    (.pptx) file or a print-ready multi-page PDF.
 * ============================================================================
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  Maximize2,
  Mic,
  Minimize2,
  Play,
  Printer,
} from 'lucide-react';
import { BrandFoxLogo } from '@/components/BrandFoxLogo';
import { logFunctionCall } from '@/lib/logger';

export type PitchDemoAction =
  | 'open_daily_brief'
  | 'open_nvda_overview'
  | 'open_nvda_ecosystem'
  | 'run_ai_chip_cohort'
  | 'open_nvda_bull_bear'
  | 'open_research_assistant'
  | 'open_watchlist';

export interface PitchSlideDefinition {
  index: number;
  numberLabel: string;
  timeWindow: string;
  sectionKicker: string;
  title: string;
  subtitle: string;
  screenshotUrl: string;
  screenshotCaption: string;
  analogyTitle: string;
  analogyText: string;
  keyPoints: Array<{
    heading: string;
    detail: string;
  }>;
  jargonTranslator: Array<{
    term: string;
    plainMeaning: string;
  }>;
  speakerScript: string;
  demoActionLabel: string;
  demoAction: PitchDemoAction;
}

export interface HackathonPitchDeckProps {
  onTriggerDemoAction: (action: PitchDemoAction) => void;
}

export const HACKATHON_SLIDES: PitchSlideDefinition[] = [
  {
    index: 0,
    numberLabel: '01 / 10',
    timeWindow: '0:00 – 0:15',
    sectionKicker: '01. Hackathon Pitch · Introduction',
    title: 'Contextual Investing: See the Whole Domino Chain Behind Every Company',
    subtitle:
      'Turning scattered global news, supply chains, and live market numbers into plain-English insights anyone can verify in seconds.',
    screenshotUrl: '/pitch-screenshots/slide-hero-workspace.svg',
    screenshotCaption:
      'Live Contextual Investing Workspace — NVIDIA (NVDA) interactive price action, plain-English metrics, and 1-click Watchlist Follow.',
    analogyTitle: 'The Core Idea in One Sentence',
    analogyText:
      'Companies do not move in a vacuum—we built a real-time web intelligence workspace that watches the companies you care about, maps their suppliers and customers, and explains why news matters in plain English.',
    keyPoints: [
      {
        heading: 'Built for Clarity, Not Wall Street Jargon',
        detail:
          'Translates complex market movements into clear "What happened" and "Why it matters" takeaways backed by primary news links.',
      },
      {
        heading: 'Powered by Context.dev + Gemini Structured Reasoning',
        detail:
          'Combines live global news search, corporate firmographics, real-time stock quotes, and supply-chain relationship mapping in one view.',
      },
      {
        heading: '1-Click Watchlist Curation Everywhere',
        detail:
          'Follow any searched company, supply-chain partner, or plain-English search match in one click to track your personal portfolio.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Public vs. Private Company',
        plainMeaning:
          'Public companies (like NVIDIA or Apple) trade shares on a stock exchange every second; Private unicorns (like OpenAI or Stripe) are valued during funding rounds.',
      },
      {
        term: 'Watchlist',
        plainMeaning:
          'Your personal list of favorite companies that the app monitors 24/7 for breaking news and price changes.',
      },
    ],
    speakerScript:
      'Hi everyone! Even if you never trade stocks, you know that companies like NVIDIA, Apple, and OpenAI shape the economy. But figuring out WHY a company is soaring or dropping on any given day is shockingly fragmented. We built Contextual Investing—a real-time web intelligence workspace that connects breaking global news, supply chains, and live company data into plain-English answers.',
    demoActionLabel: 'Inspect Live NVIDIA Workspace',
    demoAction: 'open_nvda_overview',
  },
  {
    index: 1,
    numberLabel: '02 / 10',
    timeWindow: '0:15 – 0:35',
    sectionKicker: '02. The Everyday Problem · Why Current Tools Fail',
    title: 'Why Did My Stock Drop 5% When the Company Announced Nothing?',
    subtitle:
      'Because today’s biggest company moves start upstream—in a supplier factory, a customer budget shift, or an overnight foreign-language headline.',
    screenshotUrl: '/pitch-screenshots/slide-ecosystem-ripple.svg',
    screenshotCaption:
      'The Domino Effect: An overnight packaging update at TSMC in Taiwan or SK Hynix in Korea ripples directly into NVIDIA and Microsoft.',
    analogyTitle: 'Everyday Analogy: The Coffee Shop Domino Chain',
    analogyText:
      'Imagine running a popular coffee chain. Even if your stores do nothing wrong, if your coffee bean supplier in Colombia has a frost or your espresso machine maker has a part shortage, your business feels it tomorrow. Public companies work the exact same way.',
    keyPoints: [
      {
        heading: '1. The "10 Open Browser Tabs" Trap',
        detail:
          'People bounce between a price chart tab, three news sites, a search engine to look up who supplies whom, and a spreadsheet.',
      },
      {
        heading: '2. Hidden Ripple Effects Across Companies',
        detail:
          'Looking at NVIDIA alone misses that TSMC manufactures its chips, SK Hynix makes its memory, and Microsoft buys its servers.',
      },
      {
        heading: '3. Foreign-Language Blind Spots & Noise',
        detail:
          'Critical supply-chain news often breaks first in Korean, Japanese, or German hours before US headlines catch up.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Supply-Chain Contagion',
        plainMeaning:
          'When a bottleneck or breakthrough at a supplier (like a chip factory) helps or hurts the companies that depend on it.',
      },
      {
        term: 'Signal vs. Noise',
        plainMeaning:
          'Separating the 2 stories that actually change a company’s future from 50 repetitive clickbait articles.',
      },
    ],
    speakerScript:
      'Here is the problem everyone runs into: imagine you follow NVIDIA. You wake up and the stock is moving sharply, even though NVIDIA issued zero press releases. Why? Because its chip factory in Taiwan or its memory maker in South Korea made an announcement overnight. Today, connecting those dots takes ten browser tabs and hours of manual digging.',
    demoActionLabel: 'See the NVIDIA Supply Chain Live',
    demoAction: 'open_nvda_ecosystem',
  },
  {
    index: 2,
    numberLabel: '03 / 10',
    timeWindow: '0:35 – 0:55',
    sectionKicker: '03. Our Solution · How Contextual Investing Works',
    title: 'One Workspace That Watches the Web and Connects the Dots',
    subtitle:
      'Four connected workflows that take you from a 30-second daily summary to deep ecosystem discovery without leaving the page.',
    screenshotUrl: '/pitch-screenshots/slide-daily-brief.svg',
    screenshotCaption:
      'From cross-watchlist Daily Briefs to 1-click supply-chain pivots and natural-language screening.',
    analogyTitle: 'How a New User Experiences the App',
    analogyText:
      'You don’t need to know financial ratios to start: (1) Follow companies you recognize, (2) Read your plain-English Daily Brief, (3) Explore their suppliers & rivals in 1 click, or (4) Ask questions in normal sentences.',
    keyPoints: [
      {
        heading: '01. Daily Brief Across Your Watchlist',
        detail:
          'Greets you with a unified summary of what is moving your followed companies today, ranked by Good News vs. Watch-Outs.',
      },
      {
        heading: '02. Interactive Ecosystem & 1-Click Follow',
        detail:
          'Maps every company’s Suppliers, Customers, Competitors, and Partners—with 1-click Follow buttons right on every card.',
      },
      {
        heading: '03. Plain-English Screening & AI Analyst Drawer',
        detail:
          'Type normal questions like "AI chip companies over $200B" or open the side drawer to interrogate live data with web citations.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Catalyst (Bullish)',
        plainMeaning:
          'A positive real-world event (like a new product launch or factory expansion) that helps a company grow.',
      },
      {
        term: 'Headwind / Risk (Bearish)',
        plainMeaning:
          'A challenge or obstacle (like a part shortage, lawsuit, or new competitor) that could slow a company down.',
      },
    ],
    speakerScript:
      'Contextual Investing solves this by uniting four workflows in one clean screen: a Daily Brief that watches your whole portfolio, a live Ecosystem Map that reveals suppliers and customers, a Plain-English Search bar for people who don’t memorize stock tickers, and a source-verified AI Analyst drawer.',
    demoActionLabel: 'Open Live Daily Brief',
    demoAction: 'open_daily_brief',
  },
  {
    index: 3,
    numberLabel: '04 / 10',
    timeWindow: '0:55 – 1:15',
    sectionKicker: '04. Act 1 · The Web, Watched (Daily Brief)',
    title: 'Get Instant Answers to "What Happened & Why It Matters"',
    subtitle:
      'Instead of scrolling through 50 unranked articles, see the highest-conviction upside catalysts and downside risks across all your companies.',
    screenshotUrl: '/pitch-screenshots/slide-daily-brief.svg',
    screenshotCaption:
      'Live Watchlist Daily Brief: Executive cross-company narrative + ranked Top Bullish Catalysts vs. Top Bearish Risks.',
    analogyTitle: 'Why Non-Experts Love This View',
    analogyText:
      'Most news feeds just dump headlines on you. Our Daily Brief scores each story from 1–100% on how much it actually matters and writes a 1-sentence "Why Bullish" or "Why Bearish" explanation in plain English.',
    keyPoints: [
      {
        heading: 'Cross-Watchlist Executive Summary',
        detail:
          'Fetches live Context.dev coverage across all followed companies in parallel and synthesizes the big picture in 3 sentences.',
      },
      {
        heading: 'Side-by-Side Positive Catalysts vs. Risks',
        detail:
          'Separates the most important positive breakthroughs from warning signs so you always see a balanced picture.',
      },
      {
        heading: 'Instant Reactivity When You Follow New Companies',
        detail:
          'Add any real public stock or private unicorn (like OpenAI or Stripe) and the Daily Brief dynamically updates.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Conviction / Materiality Score (1–100%)',
        plainMeaning:
          'How strongly a news event affects the company’s actual business, filtering out minor PR fluff.',
      },
      {
        term: 'Posture Strip',
        plainMeaning:
          'A quick 1-line weather report for each company you follow showing whether today’s news is mostly positive, negative, or mixed.',
      },
    ],
    speakerScript:
      'Let’s look at Act 1: The Web, Watched. When you open our Daily Brief, we query Context.dev across every company you follow at once. At the top is a plain-English summary of how those companies connect today. Below that, we rank the top positive catalysts next to the top risks—each with an importance score and a one-sentence explanation of why it matters.',
    demoActionLabel: 'Launch Daily Brief Live',
    demoAction: 'open_daily_brief',
  },
  {
    index: 4,
    numberLabel: '05 / 10',
    timeWindow: '1:15 – 1:40',
    sectionKicker: '05. Act 2 · Tracing the NVIDIA Supply-Chain Ripple',
    title: 'Map Suppliers, Customers & Rivals—and Follow Them in 1 Click',
    subtitle:
      'Every company search automatically reveals the 4 relationship pillars around it so you can spot domino effects early.',
    screenshotUrl: '/pitch-screenshots/slide-ecosystem-ripple.svg',
    screenshotCaption:
      'Related Companies Panel for NVIDIA: Grouped into Suppliers, Customers, Peers, and Partners with inline + Follow buttons.',
    analogyTitle: 'The NVIDIA Ripple Story in Action',
    analogyText:
      'When you search NVIDIA, you immediately see TSMC and Micron under Suppliers, Microsoft and Meta under Customers, and AMD and Broadcom under Competitors. You can click "+ Follow" on TSMC right there to add it to your watchlist without losing your NVIDIA page!',
    keyPoints: [
      {
        heading: '4 Actionable Relationship Pillars',
        detail:
          'Organizes related companies into Suppliers & Infra, Customers & Adopters, Peers & Competitors, and Strategic Partners.',
      },
      {
        heading: 'Multi-Role Overlap Detection',
        detail:
          'Highlights companies like Microsoft that act as both a major Customer (buying NVIDIA chips) and a Competitor (designing custom AI chips).',
      },
      {
        heading: 'Non-Destructive 1-Click Follow & Batch Follow',
        detail:
          'Click "+ Follow" on any individual partner or use "Follow Top 4" to add an entire supply-chain group to your watchlist in one click.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Upstream Supplier',
        plainMeaning:
          'Companies that make the raw parts or machinery a company needs to build its product (like TSMC making silicon wafers for NVIDIA).',
      },
      {
        term: 'Downstream Customer',
        plainMeaning:
          'Major buyers whose spending drives the company’s revenue (like Microsoft Azure buying data center GPUs).',
      },
    ],
    speakerScript:
      'In Act 2, let’s trace that NVIDIA domino effect. When you look up NVIDIA, Contextual Investing maps its ecosystem across four columns: Suppliers like TSMC, Customers like Microsoft, Competitors like AMD, and Partners like OpenAI. Notice the "+ Follow" button on every card: you can add any supplier or rival to your watchlist in one click without losing your place, or click a name to pivot the entire workspace.',
    demoActionLabel: 'Explore NVIDIA Ecosystem Live',
    demoAction: 'open_nvda_ecosystem',
  },
  {
    index: 5,
    numberLabel: '06 / 10',
    timeWindow: '1:40 – 2:00',
    sectionKicker: '06. Act 3 · Natural-Language Discovery & Comparison',
    title: 'Don’t Know Stock Tickers? Search and Compare in Plain English',
    subtitle:
      'Type normal sentences like "AI chip companies with over 200 bn USD market cap" to discover, compare, and follow leaders side by side.',
    screenshotUrl: '/pitch-screenshots/slide-cohort-screener.svg',
    screenshotCaption:
      'Natural-Language Cohort Screener: Auto-detects plain-English queries, verifies market caps live, and plots normalized % returns.',
    analogyTitle: 'Why This Matters for Everyday Users',
    analogyText:
      'Most people don’t know that Broadcom’s ticker is AVGO or TSMC’s is TSM. You can just type a normal English description, and our app finds the real companies, checks their actual size live, and compares them side by side.',
    keyPoints: [
      {
        heading: 'Automatic Intent Detection in One Search Bar',
        detail:
          'The same search bar accepts a ticker ("NVDA"), a private company ("Stripe"), or a full English screening sentence.',
      },
      {
        heading: '1-Click Follow on Search Results & Batch Follow Selected',
        detail:
          'Every matched company card has an inline "+ Follow" button, plus a "+ Follow Selected (3)" button to follow the whole cohort at once.',
      },
      {
        heading: 'Apples-to-Apples % Return Chart & 4-Dimension Matrix',
        detail:
          'Indexes all selected public stocks to 0.00% at the start of the period so you can compare relative performance fairly.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Market Cap (Market Capitalization)',
        plainMeaning:
          'The total dollar value of a company on the stock market (Share Price multiplied by Total Shares). Over $200B means a giant global leader.',
      },
      {
        term: 'Normalized % Chart (Indexed to 0%)',
        plainMeaning:
          'Starts every company at 0% on Day 1 so you can compare whether a $140 stock grew faster than a $900 stock.',
      },
    ],
    speakerScript:
      'What if you don’t know stock tickers at all? In Act 3, you just type a normal sentence into the search bar—like "AI chip companies with over 200 bn USD market cap." The app automatically switches to Cohort Comparison mode, verifies which companies actually pass that $200 billion threshold live, lets you follow the matches in one click, and plots their percentage growth on the same chart.',
    demoActionLabel: 'Run "AI Chip Companies > $200B" Live',
    demoAction: 'run_ai_chip_cohort',
  },
  {
    index: 6,
    numberLabel: '07 / 10',
    timeWindow: '2:00 – 2:20',
    sectionKicker: '07. Act 4 · Truth at Internet Speed & Global Translation',
    title: 'Both Sides of Every Story—Across Any Language, With Proof',
    subtitle:
      'Prevents confirmation bias with side-by-side Bull vs. Bear verdicts and auto-translates international news with original-source verification.',
    screenshotUrl: '/pitch-screenshots/slide-bull-bear-translation.svg',
    screenshotCaption:
      'Side-by-Side Positive Catalysts vs. Risks & Headwinds + Automatic Korean/Japanese/German headline translation with View Original toggle.',
    analogyTitle: 'No "Black-Box" AI Hallucinations',
    analogyText:
      'If an AI just says "Buy this stock," you shouldn’t trust it. Our app shows the best arguments FOR and AGAINST every company side by side, explains why each article is positive or negative, and lets you inspect translated foreign articles in one click.',
    keyPoints: [
      {
        heading: 'Balanced Bull vs. Bear Debate Card',
        detail:
          'Summarizes Positive Catalysts (what drives growth) right next to Risks & Headwinds (what could go wrong) before giving an assessment.',
      },
      {
        heading: 'Borderless Multi-Language Translation',
        detail:
          'Automatically detects non-English coverage (Korean, Japanese, German, French, Spanish, Chinese) and translates it into clear English.',
      },
      {
        heading: '1-Click "View Original" & Publisher Verification',
        detail:
          'Every translated article keeps a toggle to inspect the original native-language text alongside the direct publisher link.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Bull Case vs. Bear Case',
        plainMeaning:
          'The "Bull Case" is the optimistic case for why a company will succeed; the "Bear Case" is the cautious case for what risks could hurt it.',
      },
      {
        term: 'Source Grounding',
        plainMeaning:
          'Every AI summary is tied directly to real, clickable news articles rather than training-data guesswork.',
      },
    ],
    speakerScript:
      'Act 4 is about trust and global reach. Whenever you research a company, we place Positive Catalysts and Risks side by side so you never get one-sided hype. And when a critical memory-chip story breaks in Korean or Japanese, our pipeline translates it into English automatically while keeping a one-click "View Original" button so you can verify the primary source.',
    demoActionLabel: 'Open Bull vs. Bear & News Feed Live',
    demoAction: 'open_nvda_bull_bear',
  },
  {
    index: 7,
    numberLabel: '08 / 10',
    timeWindow: '2:20 – 2:35',
    sectionKicker: '08. Act 5 · Contextual Research Assistant Drawer (⌘K)',
    title: 'An AI Analyst Drawer ThatAlready Knows What Is on Your Screen',
    subtitle:
      'Ask follow-up questions in plain English without copy-pasting tickers, numbers, or news headlines.',
    screenshotUrl: '/pitch-screenshots/slide-research-assistant.svg',
    screenshotCaption:
      'Collapsible Right-Side Research Assistant Drawer (⌘K): Automatically injects active chart metrics, supply chain, watchlist brief, and live web citations.',
    analogyTitle: 'Like Having a Research Analyst Looking Over Your Shoulder',
    analogyText:
      'Instead of pasting tables into a generic chatbot, press ⌘K or click "Ask Research Assistant." It already sees the exact company or comparison on your screen plus your watchlist, and searches the live web to answer follow-up questions.',
    keyPoints: [
      {
        heading: 'Zero Copy-Pasting Required',
        detail:
          'Automatically serializes your active company metrics, supply-chain peers, loaded articles, or cohort matrix into context on every turn.',
      },
      {
        heading: 'Live Google Search Grounding + Clickable Citations',
        detail:
          'When you ask a question that goes beyond the screen, the assistant runs live web search and attaches clickable source links.',
      },
      {
        heading: 'Continuous Multi-Turn Session Across Views',
        detail:
          'Stays docked on the right side of the workspace as you switch between companies and comparisons.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Context Injection',
        plainMeaning:
          'Automatically feeding the numbers and articles currently visible on your screen to the assistant so its answers match what you see.',
      },
      {
        term: 'Grounding Chunks / Citations',
        plainMeaning:
          'Numbered links at the bottom of each AI answer that open the exact web pages used to verify the response.',
      },
    ],
    speakerScript:
      'What if you have a specific follow-up question? Pressing Command-K opens our collapsible Research Assistant drawer on the right. Because it automatically receives the exact company metrics, supply chain, and news loaded on your screen—plus live Google Search citations—you can ask "How does TSMC’s expansion affect NVIDIA and Microsoft?" and get a cited answer immediately.',
    demoActionLabel: 'Open Research Assistant Drawer Live',
    demoAction: 'open_research_assistant',
  },
  {
    index: 8,
    numberLabel: '09 / 10',
    timeWindow: '2:35 – 2:48',
    sectionKicker: '09. Under the Hood · Data Integrity & Architecture',
    title: 'Real Verification: Zero Fake Companies, Zero Fabricated Charts',
    subtitle:
      'How Context.dev, live market data, Gemini structured outputs, and Firebase Firestore work together reliably.',
    screenshotUrl: '/pitch-screenshots/slide-hero-workspace.svg',
    screenshotCaption:
      'End-to-End Architecture: Verified entity gatekeeper, live historical sparklines (`1D–1Y`), honest private valuations, and Firestore persistence.',
    analogyTitle: 'Built for Production Honesty',
    analogyText:
      'Try typing gibberish like "asgadsgasd" into our Follow bar—the app blocks it immediately. Try following a private company like Stripe or OpenAI—it shows their real disclosed valuation and never invents a fake stock chart.',
    keyPoints: [
      {
        heading: '1. Context.dev News & Company Firmographics SDK',
        detail:
          'Powers real-time global news search (`/v1/news/search`) with facet/date filters and corporate profiles (`/v1/company/search`).',
      },
      {
        heading: '2. Strict Company Existence Gatekeeper & Honest Private Data',
        detail:
          'Validates every followed company before adding it; public stocks hydrate real `1D–1Y` historical closes while private unicorns show disclosed valuations.',
      },
      {
        heading: '3. Parallel Gemini Synthesis + Firestore Persistence',
        detail:
          'Runs structured JSON synthesis for conviction scoring and translations while persisting watchlists and saved articles in Firestore.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Entity Disambiguation',
        plainMeaning:
          'Automatically recognizing whether you typed a stock symbol ("AAPL"), a private company ("OpenAI"), or a natural-language question.',
      },
      {
        term: 'Sparkline Timeframe (1D to 1Y)',
        plainMeaning:
          'The miniature price trend line on each watchlist card, showing real historical price movement over 1 Day, 5 Days, 1 Month, 6 Months, or 1 Year.',
      },
    ],
    speakerScript:
      'Under the hood, we prioritized strict data honesty. Every company you follow passes through a live verification check—so you can never follow a fake ticker, and private companies like Stripe or OpenAI display their real disclosed valuations instead of fabricated stock graphs. Context.dev powers our global news and firmographic layer, while Firestore persists your watchlist and saved library.',
    demoActionLabel: 'Test Live Watchlist & Verification',
    demoAction: 'open_watchlist',
  },
  {
    index: 9,
    numberLabel: '10 / 10',
    timeWindow: '2:48 – 3:00',
    sectionKicker: '10. Hackathon Judging Alignment & Live Demo Launchpad',
    title: 'Why Contextual Investing Delivers Real-Time Web Impact',
    subtitle:
      'A complete, zero-placeholder web intelligence application ready for live exploration.',
    screenshotUrl: '/pitch-screenshots/slide-cohort-screener.svg',
    screenshotCaption:
      'Click any workflow button below to jump directly into the live application during Q&A.',
    analogyTitle: 'Summary Across All 5 Judging Pillars',
    analogyText:
      'Contextual Investing turns the live open web into an approachable decision engine—combining multi-company daily briefings, supply-chain ripple discovery, plain-English screening, and source-verified AI.',
    keyPoints: [
      {
        heading: 'Real-World Impact & Creative Live Web Fusion',
        detail:
          'Eliminates 10-tab research fatigue by uniting global multi-language news, live equity pricing, firmographics, and supply-chain graphs.',
      },
      {
        heading: 'Completeness & Technical Execution',
        detail:
          'Every chart timeframe, filter, cursor page, 1-click Follow button, cohort screen, and AI citation works live end-to-end.',
      },
      {
        heading: 'Real-Timeness You Can Test Right Now',
        detail:
          'Follow any new company from search results or supply-chain panels and watch your watchlist and Daily Brief react on the spot.',
      },
    ],
    jargonTranslator: [
      {
        term: 'Ready for Live Q&A',
        plainMeaning:
          'Use the quick-launch buttons on any slide to jump straight into that live feature in the workspace.',
      },
      {
        term: 'Exportable Deck (.pptx & PDF)',
        plainMeaning:
          'Download this entire 10-slide presentation with embedded screenshots and speaker notes using the toolbar above.',
      },
    ],
    speakerScript:
      'To wrap up: Contextual Investing takes the live open web—multi-language news wires, company firmographics, live market pricing, and supply-chain networks—and makes it understandable and actionable for everyone. Everything you saw in these slides is running live right here in the app. Thank you, and we would love your questions!',
    demoActionLabel: 'Launch Live Cohort Comparison',
    demoAction: 'run_ai_chip_cohort',
  },
];

/**
 * Loads an SVG/image URL in the browser and rasterizes it onto a 1600x900
 * offscreen HTML5 `<canvas>` to return a standard `data:image/png;base64,...`
 * string for universal PowerPoint (`.pptx`) compatibility.
 */
async function rasterizeImageUrlToPngDataUri(
  url: string,
  width = 1600,
  height = 900
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.fillStyle = '#091326';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/**
 * Renders the interactive 10-slide Hackathon Pitch Deck with keyboard navigation,
 * full-screen presenter mode, speaker script toggle, live app deep-linking,
 * and 1-click PowerPoint (`.pptx`) and PDF exports.
 */
export function HackathonPitchDeck({
  onTriggerDemoAction,
}: HackathonPitchDeckProps) {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState<boolean>(true);
  const [showAllSlidesPrintView, setShowAllSlidesPrintView] =
    useState<boolean>(false);
  const [isExportingPptx, setIsExportingPptx] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<
    string | null
  >(null);

  const currentSlide = HACKATHON_SLIDES[activeIdx] || HACKATHON_SLIDES[0];

  const handlePrevSlide = useCallback(() => {
    setActiveIdx((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const handleNextSlide = useCallback(() => {
    setActiveIdx((prev) =>
      prev < HACKATHON_SLIDES.length - 1 ? prev + 1 : prev
    );
  }, []);

  // Keyboard navigation (Left/Right arrows, Escape to exit full-screen)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key === 'Escape' && isFullScreen) {
        e.preventDefault();
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleNextSlide, handlePrevSlide, isFullScreen]);

  /**
   * Generates and downloads a widescreen (16:9) PowerPoint (.pptx) deck
   * with embedded high-resolution PNG screenshots, plain-English explanations,
   * and speaker scripts on every slide.
   */
  const handleDownloadPptx = async () => {
    if (isExportingPptx) return;
    logFunctionCall('HackathonPitchDeck.handleDownloadPptx', {
      slideCount: HACKATHON_SLIDES.length,
    });

    setIsExportingPptx(true);
    setExportSuccessMessage(null);

    try {
      // Pre-rasterize all unique screenshot SVGs to PNG Data URIs in the browser
      const uniqueUrls = Array.from(
        new Set(HACKATHON_SLIDES.map((s) => s.screenshotUrl))
      );
      const pngByUrl: Record<string, string> = {};
      await Promise.all(
        uniqueUrls.map(async (u) => {
          const dataUri = await rasterizeImageUrlToPngDataUri(u, 1600, 900);
          if (dataUri) {
            pngByUrl[u] = dataUri;
          }
        })
      );

      const response = await fetch('/api/pitch/pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slides: HACKATHON_SLIDES,
          pngByUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`PPTX export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'Contextual-Investing-Hackathon-Pitch.pptx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      setExportSuccessMessage(
        'Downloaded Contextual-Investing-Hackathon-Pitch.pptx (10 widescreen slides with embedded screenshots & speaker notes).'
      );
    } catch (err) {
      console.error('Failed to export PPTX:', err);
      setExportSuccessMessage(
        'Unable to generate .pptx file in this browser session. Try "Print / Save All Slides as PDF".'
      );
    } finally {
      setIsExportingPptx(false);
    }
  };

  /**
   * Switches to the all-slides stacked print sheet and triggers the browser's
   * native Print / Save to PDF dialog.
   */
  const handlePrintAllSlidesPdf = () => {
    logFunctionCall('HackathonPitchDeck.handlePrintAllSlidesPdf', {});
    setShowAllSlidesPrintView(true);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  return (
    <section
      aria-label="Hackathon Presentation Slide Deck"
      className={
        isFullScreen
          ? 'fixed inset-0 z-50 bg-[#091326] overflow-y-auto p-6 flex flex-col justify-between'
          : 'space-y-6'
      }
    >
      {/* Top Deck Control Bar */}
      <div className="rounded-xl bg-[#0d1b33] border border-[#212c42] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <BrandFoxLogo size={28} framed alt="" />
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#49afe9] font-mono-tabular">
              <span>Hackathon Submission Deck</span>
              <span aria-hidden="true">·</span>
              <span>10 Slides (3-Minute Pacing)</span>
              <span aria-hidden="true">·</span>
              <span>Non-Finance Judge Friendly</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white mt-0.5">
              Contextual Investing — Interactive Pitch &amp; Live App Screenshots
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isExportingPptx}
            onClick={handleDownloadPptx}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExportingPptx ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Building .PPTX...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Download PowerPoint (.pptx)</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrintAllSlidesPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#49afe9]" />
            <span>Print / Save PDF</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAllSlidesPrintView((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {showAllSlidesPrintView
                ? 'Single-Slide Interactive View'
                : 'View All 10 Slides Stacked'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Exit Full Screen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Full-Screen Present</span>
              </>
            )}
          </button>
        </div>
      </div>

      {exportSuccessMessage && (
        <div className="px-4 py-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between gap-3 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportSuccessMessage(null)}
            className="text-emerald-300 hover:text-white font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Slide Progress Strip (01..10) */}
      {!showAllSlidesPrintView && (
        <div className="flex items-center justify-between gap-2 overflow-x-auto py-1">
          <div className="flex items-center gap-1.5">
            {HACKATHON_SLIDES.map((s) => {
              const isAct = s.index === activeIdx;
              return (
                <button
                  key={s.index}
                  type="button"
                  onClick={() => setActiveIdx(s.index)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer font-mono-tabular ${
                    isAct
                      ? 'bg-[#09a4ff] border-[#09a4ff] text-white'
                      : 'bg-[#0d1b33] border-[#212c42] text-slate-300 hover:text-white hover:border-[#49afe9]/50'
                  }`}
                >
                  <span>{String(s.index + 1).padStart(2, '0')}.</span>{' '}
                  <span className="font-sans">
                    {s.index === 0
                      ? 'Title & Hook'
                      : s.index === 1
                        ? 'The Problem'
                        : s.index === 2
                          ? 'Our Solution'
                          : s.index === 3
                            ? 'Daily Brief'
                            : s.index === 4
                              ? 'NVIDIA Ripple'
                              : s.index === 5
                                ? 'Plain-English Screen'
                                : s.index === 6
                                  ? 'Bull/Bear & Translation'
                                  : s.index === 7
                                    ? 'AI Analyst (⌘K)'
                                    : s.index === 8
                                      ? 'Architecture'
                                      : 'Impact & Q&A'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={activeIdx === 0}
              onClick={handlePrevSlide}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-[#0d1b33] hover:bg-[#102344] border border-[#212c42] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <button
              type="button"
              disabled={activeIdx === HACKATHON_SLIDES.length - 1}
              onClick={handleNextSlide}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Next Slide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODE A: INTERACTIVE SINGLE-SLIDE STAGE (16:9 KEYNOTE CANVAS)
          ==================================================================== */}
      {!showAllSlidesPrintView ? (
        <div className="rounded-xl bg-[#0d1b33] border border-[#212c42] overflow-hidden">
          {/* Slide Header Banner */}
          <div className="p-6 pb-5 border-b border-[#212c42] flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-4xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-[#49afe9]">
                <span className="font-semibold">
                  {currentSlide.sectionKicker}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">
                  Pitch Clock: {currentSlide.timeWindow}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">
                  Slide {currentSlide.numberLabel}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
                {currentSlide.title}
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                {currentSlide.subtitle}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (isFullScreen) setIsFullScreen(false);
                logFunctionCall('HackathonPitchDeck.onTriggerDemoAction', {
                  slide: currentSlide.numberLabel,
                  action: currentSlide.demoAction,
                });
                onTriggerDemoAction(currentSlide.demoAction);
              }}
              className="self-start inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{currentSlide.demoActionLabel}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Main 12-Column Slide Stage: Left Narrative & Jargon Guide + Right Live App Screenshot */}
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 5 Columns: Everyday Analogy + 3 Bullet Takeaways + Plain-English Translator */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                {/* Everyday Analogy Box */}
                <div className="p-4 rounded-xl bg-[#091326] border border-[#09a4ff]/50">
                  <div className="text-xs font-semibold text-[#49afe9] mb-1">
                    {currentSlide.analogyTitle}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {currentSlide.analogyText}
                  </p>
                </div>

                {/* 3 Structured Takeaways */}
                <div className="divide-y divide-[#212c42] rounded-xl bg-[#091326] border border-[#212c42] px-4">
                  {currentSlide.keyPoints.map((pt, i) => (
                    <div key={i} className="py-3">
                      <h3 className="text-xs sm:text-sm font-bold text-white mb-0.5">
                        {pt.heading}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {pt.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plain-English Jargon Translator for Non-Finance Judges */}
              <div className="p-4 rounded-xl bg-[#091326]/90 border border-[#212c42]">
                <div className="text-xs font-semibold text-slate-300 mb-2">
                  Plain-English Guide (Zero Finance Background Needed)
                </div>
                <div className="space-y-2">
                  {currentSlide.jargonTranslator.map((item, i) => (
                    <div key={i} className="text-xs leading-snug">
                      <span className="font-semibold text-[#49afe9]">
                        {item.term}:
                      </span>{' '}
                      <span className="text-slate-300">
                        {item.plainMeaning}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right 7 Columns: Live App Screenshot Showcase */}
            <div className="lg:col-span-7 flex flex-col justify-between rounded-xl bg-[#091326] border border-[#212c42] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#0a162b] border-b border-[#212c42] flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-2 min-w-0">
                  <BrandFoxLogo size={16} alt="" />
                  <span className="text-xs font-medium text-slate-300 truncate">
                    Live Application Capture · Contextual Investing
                  </span>
                </div>
                <span className="text-[11px] font-mono-tabular text-[#49afe9] shrink-0">
                  16:9 High-DPI Frame
                </span>
              </div>

              <div className="p-3 flex-1 flex items-center justify-center bg-[#060d1b]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentSlide.screenshotUrl}
                  alt={currentSlide.screenshotCaption}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto rounded-lg border border-[#212c42] object-contain"
                />
              </div>

              <div className="px-4 py-3 bg-[#0a162b] border-t border-[#212c42] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                <span>{currentSlide.screenshotCaption}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (isFullScreen) setIsFullScreen(false);
                    onTriggerDemoAction(currentSlide.demoAction);
                  }}
                  className="text-xs font-semibold text-[#49afe9] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Live View →
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible 3-Minute Spoken Pitch Script Bar */}
          <div className="border-t border-[#212c42] bg-[#091326]/90 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 font-mono-tabular">
                <Mic className="w-3.5 h-3.5" />
                <span>
                  3-Minute Spoken Pitch Script ({currentSlide.timeWindow})
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowSpeakerNotes((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>
                  {showSpeakerNotes ? 'Hide Script' : 'Show Spoken Script'}
                </span>
                {showSpeakerNotes ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            {showSpeakerNotes && (
              <p className="mt-2.5 text-sm text-slate-200 leading-relaxed italic max-w-5xl">
                &ldquo;{currentSlide.speakerScript}&rdquo;
              </p>
            )}
          </div>
        </div>
      ) : (
        /* ==================================================================
           MODE B: ALL 10 SLIDES STACKED (FOR 1-CLICK PDF / PRINT EXPORT)
           ================================================================== */
        <div className="space-y-8">
          {HACKATHON_SLIDES.map((slide) => (
            <div
              key={slide.index}
              className="rounded-xl bg-[#0d1b33] border border-[#212c42] overflow-hidden break-inside-avoid"
            >
              <div className="p-6 pb-4 border-b border-[#212c42] flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <BrandFoxLogo size={24} framed alt="" className="mt-0.5" />
                  <div>
                    <div className="text-xs font-mono-tabular text-[#49afe9] mb-1">
                      {slide.sectionKicker} · {slide.timeWindow} · Slide{' '}
                      {slide.numberLabel}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      {slide.title}
                    </h2>
                    <p className="text-sm text-slate-300 mt-1">
                      {slide.subtitle}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onTriggerDemoAction(slide.demoAction)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {slide.demoActionLabel} →
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-5 space-y-3">
                  <div className="p-3.5 rounded-lg bg-[#091326] border border-[#09a4ff]/50">
                    <div className="text-xs font-semibold text-[#49afe9] mb-1">
                      {slide.analogyTitle}
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      {slide.analogyText}
                    </p>
                  </div>

                  <div className="divide-y divide-[#212c42] rounded-lg bg-[#091326] border border-[#212c42] px-3.5">
                    {slide.keyPoints.map((pt, idx) => (
                      <div key={idx} className="py-2.5">
                        <div className="text-xs font-bold text-white">
                          {pt.heading}
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5">
                          {pt.detail}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-lg bg-[#091326] border border-[#212c42] space-y-1.5">
                    <div className="text-xs font-semibold text-slate-300">
                      Plain-English Jargon Guide:
                    </div>
                    {slide.jargonTranslator.map((j, idx) => (
                      <div key={idx} className="text-xs">
                        <span className="font-semibold text-[#49afe9]">
                          {j.term}:
                        </span>{' '}
                        <span className="text-slate-300">
                          {j.plainMeaning}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-7 flex flex-col justify-between rounded-lg bg-[#091326] border border-[#212c42] p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.screenshotUrl}
                    alt={slide.screenshotCaption}
                    referrerPolicy="no-referrer"
                    className="w-full h-auto rounded border border-[#212c42]"
                  />
                  <div className="mt-3 pt-2.5 border-t border-[#212c42] text-xs text-slate-300">
                    <span className="font-semibold text-emerald-400">
                      Spoken Script ({slide.timeWindow}):
                    </span>{' '}
                    <span className="italic">
                      &ldquo;{slide.speakerScript}&rdquo;
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
