/**
 * ============================================================================
 * FILE: lib/config.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Centralized Configuration & Constants Registry for the OpticAlpha Investor
 * Intelligence Terminal.
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

export interface CompanyPreset {
  label: string;
  name?: string;
  entityType: EntityType;
  value: string;
  exchange?: 'NASDAQ' | 'NYSE' | 'LSE' | 'XETRA' | 'JPX' | 'HKSE';
  sector: string;
  price: string;
  changePct: string;
  positive: boolean;
  sparkline: number[];
}

export const APP_CONFIG = {
  appName: 'OpticAlpha Terminal',
  appSubtitle: 'Quantitative News & AI Research Desk',

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
    defaultLimit: 10,
    maxLimit: 25,
    defaultSort: 'newest' as 'newest' | 'relevance',
    envKeyName: 'CONTEXT_DEV_API_KEY',
    dashboardKeysUrl: 'https://www.context.dev/dashboard/api-keys',
    usExchanges: ['NASDAQ', 'NYSE', 'AMEX', 'CBOE', 'OTC'] as const,
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
   * Featured Institutional Watchlist Presets
   */
  featuredCompanies: [
    {
      label: 'NVIDIA Corp',
      entityType: 'ticker',
      value: 'NVDA',
      sector: 'Semiconductors & AI',
      price: '$138.60',
      changePct: '+3.42%',
      positive: true,
      sparkline: [124, 126, 125, 129, 132, 131, 135, 138.6],
    },
    {
      label: 'Stripe',
      entityType: 'name',
      value: 'Stripe',
      sector: 'Fintech Infrastructure',
      price: 'Private · $70B',
      changePct: '+7.69%',
      positive: true,
      sparkline: [62, 63, 64, 65, 65, 67, 69, 70],
    },
    {
      label: 'Apple Inc',
      entityType: 'ticker',
      value: 'AAPL',
      sector: 'Consumer Hardware',
      price: '$229.40',
      changePct: '+1.18%',
      positive: true,
      sparkline: [222, 224, 223, 225, 227, 226, 228, 229.4],
    },
    {
      label: 'Microsoft',
      entityType: 'ticker',
      value: 'MSFT',
      sector: 'Cloud & Enterprise AI',
      price: '$446.85',
      changePct: '+0.94%',
      positive: true,
      sparkline: [438, 440, 439, 442, 444, 443, 445, 446.85],
    },
    {
      label: 'Palantir',
      entityType: 'ticker',
      value: 'PLTR',
      sector: 'Defense & Data OS',
      price: '$61.20',
      changePct: '-0.85%',
      positive: false,
      sparkline: [64, 63.5, 63, 62.8, 62.1, 61.9, 61.5, 61.2],
    },
    {
      label: 'OpenAI',
      entityType: 'name',
      value: 'OpenAI',
      sector: 'Frontier AI Models',
      price: 'Private · $157B',
      changePct: '+12.10%',
      positive: true,
      sparkline: [110, 118, 125, 130, 140, 148, 152, 157],
    },
  ] as CompanyPreset[],
} as const;

/**
 * Returns the centralized application configuration object and logs access.
 */
export function getAppConfig() {
  logFunctionCall('getAppConfig', {});
  return APP_CONFIG;
}
