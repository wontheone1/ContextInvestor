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

import type { CompanyProfileData } from './company-profile-service';
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
  /\b(companies|stocks|equities|tickers|startups|unicorns|firms|leaders|players|makers|manufacturers|vendors|providers|competitors|peers|suppliers|platforms|names|giants)\b/i;

const COHORT_COMPARISON_PATTERNS = [
  /\b(over|under|above|below|more than|less than|greater than|at least|exceeding)\s+\$?\d+/i,
  /[><]=?\s*\$?\d+/i,
  /\b(market\s*cap|mkt\s*cap|valuation|enterprise\s*value|p\/e|pe\s+ratio|revenue|arr|headcount|funding)\b/i,
  /\b\d+(\.\d+)?\s*(bn|billion|trillion|tn|mn|million|b|t)\b/i,
  /\b(companies|stocks|startups|unicorns)\s+(like|similar\s+to|in|with|that|building|making|focused)\b/i,
  /^(top|best|largest|biggest|leading|fastest[-\s]growing|public|private|us)\s+/i,
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
  const trimmed = rawQuery.trim();
  logFunctionCall('detectSearchQueryIntent', { query: trimmed });

  if (!trimmed) {
    return 'single';
  }

  // 1. Short 1-5 char ticker symbols (`NVDA`, `BRK.B`, `TSM`) are always single-company
  if (/^[A-Za-z]{1,5}([.-][A-Za-z]{1,2})?$/.test(trimmed)) {
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

  // 4. Multi-word queries containing plural cohort nouns (`AI chip companies`, `cloud security stocks`)
  if (words.length >= 2 && COHORT_PLURAL_NOUNS.test(trimmed)) {
    return 'cohort';
  }

  // 5. Long descriptive sentences (5+ words) default to Cohort Screening
  if (words.length >= 5) {
    return 'cohort';
  }

  return 'single';
}

/**
 * Parses compact human/financial USD strings (`"$3.38T"`, `"245.6B"`, `"$70 billion"`, `"850M"`)
 * into a numeric USD value for deterministic threshold verification and sorting.
 *
 * @param raw - Formatted currency or compact number string
 * @returns Numeric USD value or null if unparseable
 */
export function parseCompactUsdString(
  raw: string | null | undefined
): number | null {
  if (!raw || typeof raw !== 'string') return null;
  const normalized = raw.trim().replace(/,/g, '');
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
