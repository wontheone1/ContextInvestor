/**
 * ============================================================================
 * FILE: lib/config.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Centralized Configuration & Constants Registry for the Contextual Investing
 * Terminal.
 *
 * USE CASES:
 * 1. Centralizing AI model aliases (e.g., 'gemini-4-hydrogen' for market intelligence
 *    synthesis and sentiment analysis) so they can be updated in a single place.
 * 2. Centralizing Context.dev API defaults (base URL, default page limit, supported
 *    sort options, article types, languages, and publisher countries).
 * 3. Defining Firestore collection names, cache TTL thresholds, and featured equity
 *    presets for quick terminal switching.
 * ============================================================================
 */

import { logFunctionCall } from './logger.ts';

export type EntityType = 'name' | 'ticker' | 'domain' | 'isin';

export type WatchlistSparklineRange = '1D' | '5D' | '1M' | '6M' | '1Y';

export interface CompanyPreset {
  label: string;
  name?: string;
  entityType: EntityType;
  value: string;
  kind?: 'public' | 'private';
  isAdr?: boolean;
  exchange?: 'NASDAQ' | 'NYSE' | 'LSE' | 'XETRA' | 'JPX' | 'HKSE';
  sector: string;
  price: string;
  changePct: string;
  timeframe?: WatchlistSparklineRange;
  positive: boolean;
  sparkline: number[];
}

export const APP_CONFIG = {
  appName: 'Contextual Investing',
  appSubtitle: 'Quantitative News & AI Research Desk',

  /**
   * Centralized Internationalization (i18n) Configuration
   */
  i18n: {
    defaultLocale: 'en' as 'en' | 'ko',
    supportedLocales: ['en', 'ko'] as const,
    storageKey: 'contextual_investing_ui_locale_v1',
  },

  /**
   * Centralized Gemini AI Configuration
   */
  gemini: {
    /** Default model for fast, structured financial news synthesis */
    defaultModel: 'gemini-4-hydrogen',
    /** Lightweight model for low-latency headline sentiment classification */
    sentimentModel: 'gemini-3.1-flash-lite',
    /** User-Agent required by AI Studio build telemetry */
    userAgent: 'aistudio-build',
  },

  /**
   * Centralized Context.dev News Search Configuration
   */
  contextDev: {
    baseUrl: 'https://api.context.dev/v1',
    newsSearchEndpoint: '/v1/news/search',
    companySearchEndpoint: '/company/search',
    companySearchMode: 'fast' as 'fast' | 'ultra',
    defaultLimit: 10,
    maxLimit: 25,
    defaultSort: 'newest' as 'newest' | 'relevance',
    envKeyName: 'CONTEXT_DEV_API_KEY',
    dashboardKeysUrl: 'https://www.context.dev/dashboard/api-keys',
    usExchanges: ['NASDAQ', 'NYSE', 'AMEX', 'CBOE', 'OTC'] as const,
  },

  /**
   * Natural-Language Cohort Screening & Multi-Company Comparison Configuration
   */
  cohortScreener: {
    maxCandidates: 8,
    defaultPreselectedCount: 3,
    maxCompareColumns: 4,
    seriesColors: ['#09a4ff', '#10B981', '#F59E0B', '#A78BFA'] as const,
    sampleQueries: [
      {
        label: 'AI chip companies > $200B',
        query: 'AI chip companies with over 200 bn USD market cap',
      },
      {
        label: 'Cloud cybersecurity > $50B',
        query: 'Cloud cybersecurity stocks with over $50B market cap',
      },
      {
        label: 'Private AI unicorns > $10B',
        query: 'Private frontier AI unicorns over $10B valuation',
      },
    ] as const,
  },

  /**
   * Contextual Research Assistant Drawer Configuration
   */
  researchChat: {
    maxHistoryMessages: 12,
    maxContextArticles: 10,
    maxCitations: 6,
    drawerWidthPx: 440,
  },

  /**
   * Centralized Firestore Caching Configuration
   */
  firestore: {
    collections: {
      cachedSearches: 'cached_searches',
      savedArticles: 'saved_articles',
      followedCompanies: 'followed_companies',
    },
    /** Default cache freshness window in milliseconds (15 minutes) */
    cacheTtlMs: 15 * 60 * 1000,
  },

  /**
   * Filter Options supported by Context.dev POST /v1/news/search
   * Note: Context.dev allows at most one category filter (articleType, articleLanguage,
   * sourceCountry, or sourceDomain) accompanied by an optional date range.
   */
  filters: {
    articleTypes: [
      { value: 'editorial', label: 'Editorial Reporting' },
      { value: 'press_release', label: 'Press Releases' },
      { value: 'regulatory_filing', label: 'Regulatory Filings' },
      { value: 'advisory', label: 'Advisories' },
    ] as const,
    languages: [
      { value: 'en', label: 'English (en)' },
      { value: 'ko', label: 'Korean (ko)' },
      { value: 'ja', label: 'Japanese (ja)' },
      { value: 'de', label: 'German (de)' },
      { value: 'fr', label: 'French (fr)' },
      { value: 'es', label: 'Spanish (es)' },
      { value: 'zh', label: 'Chinese (zh)' },
    ] as const,
    countries: [
      { value: 'us', label: 'United States (US)' },
      { value: 'kr', label: 'South Korea (KR)' },
      { value: 'gb', label: 'United Kingdom (GB)' },
      { value: 'de', label: 'Germany (DE)' },
      { value: 'jp', label: 'Japan (JP)' },
      { value: 'ca', label: 'Canada (CA)' },
      { value: 'ch', label: 'Switzerland (CH)' },
      { value: 'sg', label: 'Singapore (SG)' },
    ] as const,
    exchanges: [
      'NASDAQ',
      'NYSE',
      'LSE',
      'XETRA',
      'JPX',
      'HKSE',
      'TSX',
      'ASX',
      'SIX',
    ] as const,
  },

  /**
   * Followed Watchlist Validation & Live Sparkline Configuration
   */
  watchlist: {
    defaultSparklineRange: '1M' as WatchlistSparklineRange,
    supportedRanges: ['1D', '5D', '1M', '6M', '1Y'] as const,
    rangeDescriptions: {
      '1D': '1-Day',
      '5D': '5-Day',
      '1M': '1-Month',
      '6M': '6-Month',
      '1Y': '1-Year',
    } as Record<WatchlistSparklineRange, string>,
    maxFollowedCompanies: 20,
    sparklineMaxPoints: 24,
  },

  /**
   * Featured Institutional Watchlist Presets
   * Public equities hydrate live price, % change, and real historical sparklines on load;
   * private companies display disclosed private-market valuation without share price graphs.
   */
  featuredCompanies: [
    {
      label: 'NVIDIA Corp',
      entityType: 'ticker',
      value: 'NVDA',
      kind: 'public',
      sector: 'Semiconductors & AI',
      price: '$138.60',
      changePct: '+3.42%',
      timeframe: '1M',
      positive: true,
      sparkline: [124, 126, 125, 129, 132, 131, 135, 138.6],
    },
    {
      label: 'Stripe',
      entityType: 'name',
      value: 'Stripe',
      kind: 'private',
      sector: 'Fintech Infrastructure',
      price: 'Privately Held',
      changePct: 'Est. $91.5B Valuation',
      positive: true,
      sparkline: [],
    },
    {
      label: 'Apple Inc',
      entityType: 'ticker',
      value: 'AAPL',
      kind: 'public',
      sector: 'Consumer Hardware',
      price: '$229.40',
      changePct: '+1.18%',
      timeframe: '1M',
      positive: true,
      sparkline: [222, 224, 223, 225, 227, 226, 228, 229.4],
    },
    {
      label: 'Microsoft',
      entityType: 'ticker',
      value: 'MSFT',
      kind: 'public',
      sector: 'Cloud & Enterprise AI',
      price: '$446.85',
      changePct: '+0.94%',
      timeframe: '1M',
      positive: true,
      sparkline: [438, 440, 439, 442, 444, 443, 445, 446.85],
    },
    {
      label: 'Palantir',
      entityType: 'ticker',
      value: 'PLTR',
      kind: 'public',
      sector: 'Defense & Data OS',
      price: '$61.20',
      changePct: '-0.85%',
      timeframe: '1M',
      positive: false,
      sparkline: [64, 63.5, 63, 62.8, 62.1, 61.9, 61.5, 61.2],
    },
    {
      label: 'OpenAI',
      entityType: 'name',
      value: 'OpenAI',
      kind: 'private',
      sector: 'Frontier AI Models',
      price: 'Privately Held',
      changePct: 'Est. $300B Valuation',
      positive: true,
      sparkline: [],
    },
  ] as CompanyPreset[],

  /**
   * Step-by-Step Onboarding Curated Starter Companies & Storage Key
   * Every entry is a verified listed US ticker or verified private unicorn
   * (private companies strictly carry empty sparkline arrays).
   */
  onboarding: {
    storageKey: 'contextual_investing_onboarding_completed_v1',
    starterGroups: [
      {
        id: 'ai_chips',
        title: 'AI & Semiconductors',
        description: 'Compute accelerators, custom silicon, and foundry leaders',
        companies: [
          {
            label: 'NVIDIA Corp',
            value: 'NVDA',
            entityType: 'ticker' as const,
            kind: 'public' as const,
            sector: 'AI Accelerators',
            hint: 'Public · NASDAQ',
          },
          {
            label: 'Broadcom',
            value: 'AVGO',
            entityType: 'ticker' as const,
            kind: 'public' as const,
            sector: 'Custom AI Silicon & Networking',
            hint: 'Public · NASDAQ',
          },
          {
            label: 'AMD',
            value: 'AMD',
            entityType: 'ticker' as const,
            kind: 'public' as const,
            sector: 'Data Center GPUs & CPUs',
            hint: 'Public · NASDAQ',
          },
          {
            label: 'TSMC',
            value: 'TSM',
            entityType: 'ticker' as const,
            kind: 'public' as const,
            sector: 'Leading-Edge Foundry',
            hint: 'ADR · NYSE',
          },
        ],
      },
      {
        id: 'megacap_cloud',
        title: 'Cloud, Platforms & Defense AI',
        description: 'Hyperscalers, consumer ecosystems, and enterprise software',
        companies: [
          {
            label: 'Microsoft',
            value: 'MSFT',
            entityType: 'ticker' as const,
            kind: 'public' as const,
            sector: 'Cloud & Enterprise AI',
            hint: 'Public · NASDAQ',
          },
          {
            label: 'Apple Inc',
            value: 'AAPL',
            entityType: 'ticker' as const,
            kind: 'public' as const,
            sector: 'Consumer Hardware',
            hint: 'Public · NASDAQ',
          },
          {
            label: 'Amazon',
            value: 'AMZN',
            entityType: 'ticker' as const,
            kind: 'public' as const,
            sector: 'AWS Cloud & Commerce',
            hint: 'Public · NASDAQ',
          },
          {
            label: 'Palantir',
            value: 'PLTR',
            entityType: 'ticker' as const,
            kind: 'public' as const,
            sector: 'Defense & Data OS',
            hint: 'Public · NASDAQ',
          },
        ],
      },
      {
        id: 'private_unicorns',
        title: 'Frontier Private Unicorns',
        description: 'High-conviction unlisted leaders tracked by valuation & news',
        companies: [
          {
            label: 'OpenAI',
            value: 'OpenAI',
            entityType: 'name' as const,
            kind: 'private' as const,
            sector: 'Frontier AI Models',
            hint: 'Private · Est. $300B',
          },
          {
            label: 'Stripe',
            value: 'Stripe',
            entityType: 'name' as const,
            kind: 'private' as const,
            sector: 'Fintech Infrastructure',
            hint: 'Private · Est. $91.5B',
          },
          {
            label: 'Anthropic',
            value: 'Anthropic',
            entityType: 'name' as const,
            kind: 'private' as const,
            sector: 'AI Safety & Foundation Models',
            hint: 'Private · Est. $61.5B',
          },
          {
            label: 'Databricks',
            value: 'Databricks',
            entityType: 'name' as const,
            kind: 'private' as const,
            sector: 'Data & AI Lakehouse',
            hint: 'Private · Est. $62B',
          },
        ],
      },
    ] as const,
  },
} as const;

/**
 * Returns the centralized application configuration object and logs access.
 */
export function getAppConfig() {
  logFunctionCall('getAppConfig', {});
  return APP_CONFIG;
}
