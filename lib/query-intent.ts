/**
 * ============================================================================
 * FILE: lib/query-intent.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Client- & Server-Safe Natural-Language Query Intent Classifier & Shared
 * Cohort Comparison Data Contracts.
 *
 * USE CASES:
 * 1. Auto-detecting inside the existing Company Search bar whether a user's
 *    input is a single company/ticker lookup (`"NVDA"`, `"Stripe"`,
 *    `"Palantir Technologies"`) vs. a natural-language screening query
 *    (`"AI CHIP companies with over 200 bn USD market cap"`,
 *    `"private AI unicorns over $10B"`, `"companies like Stripe"`).
 * 2. Defining strictly typed data structures shared between the server
 *    screening/comparison endpoints and client comparison components without
 *    importing server-only SDKs into browser bundles.
 * ============================================================================
 */

import { stripAdrSuffix } from './adr-directory';
import type { CompanyProfileData } from './company-profile-service';
import type { CompanyProductsData } from './company-products-types';
import { APP_CONFIG } from './config';
import type {
  ChartRange,
  CompanyMarketOverviewData,
} from './market-data-service';
import { logFunctionCall } from './logger';

export type SearchWorkspaceMode = 'single' | 'cohort';

export interface ScreenedCandidateItem {
  /** Stable lowercase identifier (e.g. `ticker:nvda` or `name:openai`) */
  id: string;
  /** Display name of the company */
  name: string;
  /** Uppercase US stock ticker if publicly listed, otherwise null */
  ticker: string | null;
  /** Query string passed to market/profile/news services */
  searchQuery: string;
  /** Entity type hint for Context.dev and market resolution */
  entityType: 'ticker' | 'name';
  /** Publicly traded equity vs. privately held company */
  kind: 'public' | 'private';
  /** Sector or industry label */
  sector: string | null;
  /** Numeric live market cap or private valuation in USD when available */
  valuationUsd: number | null;
  /** Formatted market cap or valuation string (e.g. `$3.38T`, `$157B`) */
  valuationDisplay: string | null;
  /** Whether this company strictly satisfies any numeric threshold in the query */
  passesThreshold: boolean;
  /** Concise 1-sentence reason explaining why the company matches the query */
  matchReason: string;
  /** Whether this company can currently be followed in Watchlist (US/ADR equity or verified private company) */
  canFollow?: boolean;
  /** True when `ticker` represents an ADR / US-traded foreign equity */
  isAdr?: boolean;
}

export interface ComparedCompanyNewsPulse {
  articleCount: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  bullishPct: number;
  netPosture: 'Bullish' | 'Bearish' | 'Mixed' | 'Neutral';
  topCatalyst: {
    title: string;
    url: string;
    sourceName: string;
    publishedAt: string | null;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  } | null;
}

export interface ComparedCompanyDossier {
  id: string;
  market: CompanyMarketOverviewData | null;
  profile: CompanyProfileData | null;
  products?: CompanyProductsData | null;
  newsPulse: ComparedCompanyNewsPulse | null;
}

export interface CohortScreenResponse {
  query: string;
  interpretedTheme: string;
  constraintSummary: string | null;
  minThresholdUsd: number | null;
  maxThresholdUsd: number | null;
  strictMatchCount: number;
  candidates: ScreenedCandidateItem[];
  preselectedIds: string[];
  initialMarketById: Record<string, CompanyMarketOverviewData>;
}

export interface CohortCompareRequestItem {
  id: string;
  searchQuery: string;
  name: string;
  entityType: 'ticker' | 'name';
  kind: 'public' | 'private';
}

export interface CohortCompareResponse {
  range: ChartRange;
  dossiersById: Record<string, ComparedCompanyDossier>;
  comparativeSummary: string | null;
}

const COHORT_PLURAL_NOUNS =
  /\b(companies|stocks|equities|tickers|startups|unicorns|firms|leaders|players|makers|manufacturers|vendors|providers|competitors|peers|suppliers|platforms|names|giants)\b|(기업들|종목들|주식들|관련주|수혜주|대장주|유니콘|스타트업들|상위주|비교해)/i;

const COHORT_COMPARISON_PATTERNS = [
  /\b(over|under|above|below|more than|less than|greater than|at least|exceeding)\s+\$?\d+/i,
  /[><]=?\s*\$?\d+/i,
  /\b(market\s*cap|mkt\s*cap|valuation|enterprise\s*value|p\/e|pe\s+ratio|revenue|arr|headcount|funding)\b/i,
  /\b\d+(\.\d+)?\s*(bn|billion|trillion|tn|mn|million|b|t)\b/i,
  /\b(companies|stocks|startups|unicorns)\s+(like|similar\s+to|in|with|that|building|making|focused)\b/i,
  /^(top|best|largest|biggest|leading|fastest[-\s]growing|public|private|us|korea|korean|kospi|kosdaq)\s+/i,
  /(시총|시가총액|기업가치|매출|영업이익|배당|밸류에이션).*(이상|이하|초과|미만|넘는|상위)/i,
  /\d+(\.\d+)?\s*(조|억)\s*원?\s*(이상|이하|초과|미만|넘는)/,
  /(코스피|코스닥|한국|국내)\s+.*(기업|종목|주식|반도체|바이오|방산|2차전지|배터리|자동차|금융)/,
];

const SINGLE_COMPANY_SUFFIX =
  /\b(inc\.?|corp\.?|corporation|ltd\.?|plc|llc|co\.?|nv|sa|ag|se)\s*$/i;

/**
 * Classifies whether a search bar input represents a single company/ticker lookup
 * (`'single'`) or a natural-language multi-company screening query (`'cohort'`).
 *
 * @param rawQuery - User-entered search string
 * @returns `'cohort'` for descriptive screening queries, `'single'` for direct company/ticker lookups
 */
export function detectSearchQueryIntent(rawQuery: string): SearchWorkspaceMode {
  const trimmed = stripAdrSuffix(rawQuery);
  logFunctionCall('detectSearchQueryIntent', { query: trimmed });

  if (!trimmed) {
    return 'single';
  }

  // 1. Short 1-5 char US tickers (`NVDA`, `BRK.B`), KRX symbols (`005930.KS`, `196170.KQ`),
  //    or 6-digit KRX stock codes (`005930`, `196170`) are always single-company
  if (
    /^[A-Za-z]{1,5}([.-][A-Za-z]{1,2})?$/.test(trimmed) ||
    /^[0-9A-Za-z]{6}\.(KS|KQ)$/i.test(trimmed) ||
    /^\d{6}$/.test(trimmed)
  ) {
    return 'single';
  }

  const words = trimmed.split(/\s+/);

  // 2. Explicit legal company suffixes (`Apple Inc.`, `NVIDIA Corp`) without comparator operators
  if (
    words.length <= 4 &&
    SINGLE_COMPANY_SUFFIX.test(trimmed) &&
    !COHORT_COMPARISON_PATTERNS.some((rx) => rx.test(trimmed))
  ) {
    return 'single';
  }

  // 3. Any explicit quantitative constraint or cohort phrasing triggers Cohort Screening
  if (COHORT_COMPARISON_PATTERNS.some((rx) => rx.test(trimmed))) {
    return 'cohort';
  }

  // 4. Multi-word queries containing plural cohort nouns (`AI chip companies`, `반도체 관련주`)
  if (words.length >= 2 && COHORT_PLURAL_NOUNS.test(trimmed)) {
    return 'cohort';
  }
  if (/[가-힣]/.test(trimmed) && COHORT_PLURAL_NOUNS.test(trimmed)) {
    return 'cohort';
  }

  // 5. Long descriptive sentences (5+ words) default to Cohort Screening
  if (words.length >= 5) {
    return 'cohort';
  }

  return 'single';
}

/**
 * Parses compact USD (`"$3.38T"`, `"245.6B"`, `"850M"`) OR pure KRW (`"₩336.8조"`, `"₩4,820억"`)
 * strings into a numeric USD-equivalent value strictly for sorting and threshold checks,
 * while preserving pure KRW display strings across all UI surfaces.
 *
 * @param raw - Formatted currency or compact number string
 * @returns Numeric USD value or null if unparseable
 */
export function parseCompactUsdString(
  raw: string | null | undefined
): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.trim().replace(/,/g, '');

  // Handle pure KRW compact strings (`₩336.8조`, `4,820억`, `50조원`)
  if (/₩|조|억|KRW/i.test(normalized)) {
    const joMatch = normalized.match(/(\d+(?:\.\d+)?)\s*조/);
    const eokMatch = normalized.match(/(\d+(?:\.\d+)?)\s*억/);
    if (joMatch || eokMatch) {
      const jo = joMatch ? Number.parseFloat(joMatch[1]) : 0;
      const eok = eokMatch ? Number.parseFloat(eokMatch[1]) : 0;
      const totalKrw = jo * 1e12 + eok * 1e8;
      if (totalKrw > 0) {
        return totalKrw / APP_CONFIG.krx.defaultApproxKrwPerUsd;
      }
    }
  }

  const match = normalized.match(
    /(-?\d+(?:\.\d+)?)\s*(trillion|tn|t|billion|bn|b|million|mn|m|thousand|k)?/i
  );
  if (!match) return null;

  const num = Number.parseFloat(match[1]);
  if (!Number.isFinite(num) || num <= 0) return null;

  const unit = (match[2] || '').toLowerCase();
  if (unit === 't' || unit === 'tn' || unit === 'trillion') return num * 1e12;
  if (unit === 'b' || unit === 'bn' || unit === 'billion') return num * 1e9;
  if (unit === 'm' || unit === 'mn' || unit === 'million') return num * 1e6;
  if (unit === 'k' || unit === 'thousand') return num * 1e3;
  return num;
}
