/**
 * ============================================================================
 * FILE: lib/cohort-screener-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Natural-Language Company Cohort Discovery, Live Quantitative
 * Threshold Verification, and Parallel Multi-Company Comparison Hydrator.
 *
 * USE CASES:
 * 1. Handling natural-language screening queries such as
 *    `"AI CHIP companies with over 200 bn USD market cap"`,
 *    `"Cloud cybersecurity stocks over $50B"`, or
 *    `"Private frontier AI unicorns over $10B valuation"`.
 * 2. Combining Gemini (`gemini-4-hydrogen`) Google Search grounding and
 *    Context.dev Company Search (`POST /v1/company/search`) to propose
 *    relevant public equities and private unicorns, then verifying each
 *    candidate's real-time Market Cap / Valuation via `getCompanyMarketOverview`
 *    so numeric constraints (`> $200B`) are grounded in live market reality.
 * 3. Hydrating side-by-side comparison dossiers across all 4 investor dimensions:
 *    - Live Price Action, Normalized `%` Return Series & Valuation Multiples
 *    - Context.dev Company Profile Firmographics (Revenue, Headcount, HQ, Year)
 *    - Context.dev Live News Sentiment Balance & Top Catalyst Headline
 *    - Executive Comparative AI Takeaway across the selected companies
 * ============================================================================
 */

import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { formatTickerWithAdr } from './adr-directory';
import { APP_CONFIG } from './config';
import {
  formatUsdCompact,
  getCompanyProfileBySearch,
  type ContextDevCompanyRecord,
} from './company-profile-service';
import {
  createContextDevClient,
  searchCompanyNews,
  validateContextDevApiKey,
} from './context-dev';
import { buildFallbackNewsResponse } from './fallback-news-data';
import {
  getCompanyMarketOverview,
  type ChartRange,
  type CompanyMarketOverviewData,
} from './market-data-service';
import {
  parseCompactUsdString,
  type CohortCompareRequestItem,
  type CohortCompareResponse,
  type CohortScreenResponse,
  type ComparedCompanyDossier,
  type ComparedCompanyNewsPulse,
  type ScreenedCandidateItem,
} from './query-intent';
import { analyzeHeadlineSentiments } from './sentiment-service';
import { translateNonEnglishArticlesToEnglish } from './translation-service';
import { logFunctionCall, logGenAICall } from './logger';

interface RawAiScreenDiscovery {
  interpretedTheme?: string;
  constraintSummary?: string | null;
  minValuationUsd?: number | null;
  maxValuationUsd?: number | null;
  targetKind?: 'public_only' | 'private_only' | 'both';
  candidates?: Array<{
    name?: string;
    ticker?: string | null;
    kind?: 'public' | 'private';
    estimatedValuationUsd?: number | null;
    matchReason?: string;
  }>;
}

const SCREEN_CACHE_TTL_MS = 10 * 60 * 1000;
const NEWS_PULSE_CACHE_TTL_MS = 10 * 60 * 1000;

const screenCache = new Map<
  string,
  { data: CohortScreenResponse; expiresAt: number }
>();

const newsPulseCache = new Map<
  string,
  { data: ComparedCompanyNewsPulse; expiresAt: number }
>();

/**
 * Extracts explicit numeric USD min/max bounds from a natural-language query string
 * as a deterministic backstop alongside Gemini's structured interpretation.
 *
 * @param query - Raw natural-language screening query
 * @returns Parsed `{ minUsd, maxUsd }` bounds in integer USD
 */
export function extractNumericBoundsFromQuery(query: string): {
  minUsd: number | null;
  maxUsd: number | null;
} {
  logFunctionCall('extractNumericBoundsFromQuery', { query });

  const minMatch = query.match(
    /\b(?:over|above|more\s+than|greater\s+than|at\s+least|exceeding|>|>=)\s*\$?\s*(\d+(?:\.\d+)?)\s*(trillion|tn|t|billion|bn|b|million|mn|m)?\b/i
  );
  const maxMatch = query.match(
    /\b(?:under|below|less\s+than|smaller\s+than|<|<=)\s*\$?\s*(\d+(?:\.\d+)?)\s*(trillion|tn|t|billion|bn|b|million|mn|m)?\b/i
  );

  const parseBound = (m: RegExpMatchArray | null): number | null => {
    if (!m) return null;
    return parseCompactUsdString(`${m[1]}${m[2] ? ` ${m[2]}` : ''}`);
  };

  return {
    minUsd: parseBound(minMatch),
    maxUsd: parseBound(maxMatch),
  };
}

/**
 * Builds a deterministic lowercase candidate ID (`ticker:nvda` or `name:openai`).
 *
 * @param kind - `'public'` or `'private'`
 * @param ticker - Optional stock ticker symbol
 * @param name - Company name
 * @returns Normalized candidate ID string
 */
function buildCandidateId(
  kind: 'public' | 'private',
  ticker: string | null,
  name: string
): string {
  if (kind === 'public' && ticker && ticker.trim()) {
    return `ticker:${ticker.trim().toLowerCase()}`;
  }
  return `name:${name.trim().toLowerCase()}`;
}

/**
 * Queries Gemini (`gemini-4-hydrogen`) with Google Search grounding to interpret
 * a natural-language screening prompt and identify up to 10 high-relevance
 * public equities and/or private unicorns before live metric verification.
 *
 * @param query - Natural-language screening query
 * @returns Structured discovery payload
 */
async function discoverCandidatesViaGroundedGemini(
  query: string
): Promise<RawAiScreenDiscovery | null> {
  logFunctionCall('discoverCandidatesViaGroundedGemini', { query });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });

  const model = APP_CONFIG.gemini.defaultModel;
  const prompt = `You are an institutional equity and private-market screening engine.
Analyze the investor's natural-language query: "${query}"

Instructions:
1. Determine the core investment theme ("interpretedTheme") and any financial/scale filter ("constraintSummary", e.g. "Market Cap > $200B USD" or "Private Valuation > $10B USD", or null if none).
2. Determine "targetKind":
   - "public_only" if the query specifically asks for stocks, tickers, P/E, or public market cap (e.g. "market cap", "stocks").
   - "private_only" if the query specifically asks for private companies, startups, or unicorns.
   - "both" if the query asks broadly for companies/leaders in a sector without restricting to public or private.
3. Propose up to 9 real, highest-relevance companies matching the theme and scale filter.
   - For public companies, provide their primary US-listed stock ticker or US-traded ADR / OTC symbol (e.g. "NVDA", "AVGO", "TSM", "AMD", "ASML", "SKHY" for SK Hynix, "SSNLF" for Samsung Electronics, "TELWY" for Tokyo Electron, "IFNNY" for Infineon, "MSFT", "GOOGL", "AMZN", "META", "QCOM", "ARM", "MRVL").
   - For private unicorns (e.g. "OpenAI", "Stripe", "SpaceX", "Databricks", "Anthropic", "xAI", "Anduril"), set "kind": "private" and "ticker": null.
   - Use current live web knowledge to estimate "estimatedValuationUsd" in integer USD and write a crisp 1-sentence "matchReason" (max 18 words) explaining how the company fits the theme.

Return ONLY valid JSON (no markdown code fences) matching this exact structure:
{
  "interpretedTheme": "AI Semiconductors & Accelerators",
  "constraintSummary": "Market Cap > $200B USD",
  "minValuationUsd": 200000000000,
  "maxValuationUsd": null,
  "targetKind": "public_only",
  "candidates": [
    {
      "name": "NVIDIA",
      "ticker": "NVDA",
      "kind": "public",
      "estimatedValuationUsd": 3300000000000,
      "matchReason": "Dominant data-center AI GPU and CUDA accelerator platform."
    }
  ]
}`;

  const config = {
    tools: [{ googleSearch: {} }],
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const rawText = (response.text ?? '').trim();
    logGenAICall({
      model,
      prompt,
      config,
      output: rawText,
    });

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as RawAiScreenDiscovery;
  } catch (error) {
    logGenAICall({
      model,
      prompt,
      config,
      error,
    });
    return null;
  }
}

/**
 * Queries Context.dev Company Search (`POST /v1/company/search`) in parallel to
 * supplement candidate discovery with structured company records.
 *
 * @param query - Natural-language screening query
 * @returns Array of ContextDevCompanyRecord items (empty on unavailable key/error)
 */
async function discoverCandidatesViaContextDev(
  query: string
): Promise<ContextDevCompanyRecord[]> {
  logFunctionCall('discoverCandidatesViaContextDev', { query });

  try {
    validateContextDevApiKey();
  } catch {
    return [];
  }

  try {
    const client = createContextDevClient();
    const res = await client.post<{ results?: ContextDevCompanyRecord[] }>(
      APP_CONFIG.contextDev.companySearchEndpoint,
      {
        body: {
          query: query.slice(0, 500),
          mode: APP_CONFIG.contextDev.companySearchMode,
        },
      }
    );
    return Array.isArray(res?.results) ? res.results.slice(0, 6) : [];
  } catch (err) {
    logFunctionCall('discoverCandidatesViaContextDev:error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Executes end-to-end natural-language cohort discovery and verifies every
 * candidate against live market cap / valuation data before ranking and
 * pre-selecting the top 3 matches.
 *
 * @param options - Natural query, optional initial chart range, and forceRefresh flag
 * @returns Verified `CohortScreenResponse` with preselected top 3 IDs and initial market data
 */
export async function screenNaturalCompanyCohort(options: {
  query: string;
  range?: ChartRange;
  forceRefresh?: boolean;
}): Promise<CohortScreenResponse> {
  const trimmedQuery = options.query.trim();
  const range: ChartRange = options.range ?? '1M';

  logFunctionCall('screenNaturalCompanyCohort', {
    query: trimmedQuery,
    range,
    forceRefresh: options.forceRefresh ?? false,
  });

  const cacheKey = `v3::${trimmedQuery.toLowerCase()}::${range}`;
  if (!options.forceRefresh) {
    const cached = screenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }

  const regexBounds = extractNumericBoundsFromQuery(trimmedQuery);

  // 1. Run grounded Gemini cohort discovery + Context.dev Company Search in parallel
  const [aiDiscovery, contextDevRecords] = await Promise.all([
    discoverCandidatesViaGroundedGemini(trimmedQuery),
    discoverCandidatesViaContextDev(trimmedQuery),
  ]);

  const minThresholdUsd =
    regexBounds.minUsd ??
    (typeof aiDiscovery?.minValuationUsd === 'number' &&
    aiDiscovery.minValuationUsd > 0
      ? aiDiscovery.minValuationUsd
      : null);

  const maxThresholdUsd =
    regexBounds.maxUsd ??
    (typeof aiDiscovery?.maxValuationUsd === 'number' &&
    aiDiscovery.maxValuationUsd > 0
      ? aiDiscovery.maxValuationUsd
      : null);

  const queryAsksPublicMarketCap = /\b(market\s*cap|mkt\s*cap|stocks|tickers|p\/e)\b/i.test(
    trimmedQuery
  );
  const queryAsksPrivateOnly = /\b(private\s+only|unicorns|startups|unlisted)\b/i.test(
    trimmedQuery
  ) && !/\bpublic\b/i.test(trimmedQuery);

  const targetKind: 'public_only' | 'private_only' | 'both' = queryAsksPublicMarketCap
    ? 'public_only'
    : queryAsksPrivateOnly
      ? 'private_only'
      : aiDiscovery?.targetKind || 'both';

  // Merge & deduplicate raw candidates (preserving Gemini's thematic relevance order first)
  const rawList: Array<{
    name: string;
    ticker: string | null;
    kind: 'public' | 'private';
    estimatedValuationUsd: number | null;
    matchReason: string;
  }> = [];
  const seenKeys = new Set<string>();

  for (const cand of aiDiscovery?.candidates || []) {
    const name = (cand.name || '').trim();
    if (!name) continue;
    const rawTicker =
      typeof cand.ticker === 'string' && cand.ticker.trim()
        ? cand.ticker.trim().toUpperCase().split(':').pop()?.trim() || null
        : null;
    const kind: 'public' | 'private' =
      cand.kind === 'private' || !rawTicker ? 'private' : 'public';

    if (targetKind === 'public_only' && kind !== 'public') continue;
    if (targetKind === 'private_only' && kind !== 'private') continue;

    const dedupeKey = (rawTicker || name).toLowerCase();
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    rawList.push({
      name,
      ticker: rawTicker,
      kind,
      estimatedValuationUsd:
        typeof cand.estimatedValuationUsd === 'number'
          ? cand.estimatedValuationUsd
          : null,
      matchReason:
        typeof cand.matchReason === 'string' && cand.matchReason.trim()
          ? cand.matchReason.trim()
          : `Matches ${aiDiscovery?.interpretedTheme || trimmedQuery}.`,
    });
  }

  for (const rec of contextDevRecords) {
    if (rawList.length >= 10) break;
    const name = (rec.name || '').trim();
    if (!name) continue;
    const firstSym = (rec.stock_symbols || [])
      .map((s) => String(s).toUpperCase().split(':').pop()?.trim() || '')
      .find((s) => /^[A-Z]{1,5}(\.[A-Z])?$/.test(s));
    const kind: 'public' | 'private' = firstSym ? 'public' : 'private';

    if (targetKind === 'public_only' && kind !== 'public') continue;
    if (targetKind === 'private_only' && kind !== 'private') continue;

    const dedupeKey = (firstSym || name).toLowerCase();
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const indSummary = (rec.industries || []).slice(0, 2).join(' & ');
    rawList.push({
      name,
      ticker: firstSym || null,
      kind,
      estimatedValuationUsd: rec.funding?.total_usd ?? null,
      matchReason: indSummary
        ? `${indSummary} company matched via Context.dev Company Search.`
        : `Matched via Context.dev Company Search.`,
    });
  }

  // 2. Verify live Market Cap / Private Valuation in parallel via getCompanyMarketOverview
  const candidatesToVerify = rawList.slice(0, 9);
  const initialMarketById: Record<string, CompanyMarketOverviewData> = {};

  const verifiedItems = await Promise.all(
    candidatesToVerify.map(async (cand): Promise<ScreenedCandidateItem | null> => {
      const searchQuery =
        cand.kind === 'public' && cand.ticker ? cand.ticker : cand.name;
      const entityType: 'ticker' | 'name' =
        cand.kind === 'public' && cand.ticker ? 'ticker' : 'name';

      try {
        const overview = await getCompanyMarketOverview({
          query: searchQuery,
          entityType,
          range,
        });

        const effectiveKind: 'public' | 'private' = overview.kind;
        if (targetKind === 'public_only' && effectiveKind !== 'public') {
          return null;
        }

        const effectiveTicker =
          overview.kind === 'public' ? overview.symbol : null;
        const effectiveName = overview.companyName || cand.name;
        const id = buildCandidateId(effectiveKind, effectiveTicker, effectiveName);

        let liveValUsd: number | null = null;
        let valDisplay: string | null = null;

        if (overview.kind === 'public') {
          valDisplay = overview.metrics.marketCap;
          liveValUsd = parseCompactUsdString(overview.metrics.marketCap);
        } else {
          valDisplay = overview.latestValuation || overview.totalFunding;
          liveValUsd = parseCompactUsdString(valDisplay);
        }

        if (!liveValUsd && cand.estimatedValuationUsd) {
          liveValUsd = cand.estimatedValuationUsd;
          valDisplay = valDisplay || formatUsdCompact(cand.estimatedValuationUsd);
        }

        let passesThreshold = true;
        if (minThresholdUsd !== null) {
          passesThreshold =
            liveValUsd !== null ? liveValUsd >= minThresholdUsd : false;
        }
        if (passesThreshold && maxThresholdUsd !== null) {
          passesThreshold =
            liveValUsd !== null ? liveValUsd <= maxThresholdUsd : false;
        }

        initialMarketById[id] = overview;

        return {
          id,
          name: effectiveName,
          ticker: effectiveTicker,
          searchQuery: effectiveTicker || effectiveName,
          entityType: effectiveTicker ? 'ticker' : 'name',
          kind: effectiveKind,
          sector: overview.sector,
          valuationUsd: liveValUsd,
          valuationDisplay:
            valDisplay ||
            (liveValUsd ? formatUsdCompact(liveValUsd) : 'Unlisted'),
          passesThreshold,
          matchReason: cand.matchReason,
          canFollow: overview.canFollow,
          isAdr: overview.kind === 'public' ? Boolean(overview.isAdr) : false,
        };
      } catch {
        return null;
      }
    })
  );

  // Deduplicate by resolved ID and partition into strict threshold matches vs near-threshold
  const uniqueVerified: ScreenedCandidateItem[] = [];
  const seenIds = new Set<string>();
  for (const item of verifiedItems) {
    if (!item || seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    uniqueVerified.push(item);
  }

  const strictMatches = uniqueVerified
    .filter((c) => c.passesThreshold)
    .sort((a, b) => (b.valuationUsd ?? 0) - (a.valuationUsd ?? 0));

  const nearMatches = uniqueVerified
    .filter((c) => !c.passesThreshold)
    .sort((a, b) => (b.valuationUsd ?? 0) - (a.valuationUsd ?? 0));

  // Only include near-threshold peers if fewer than 3 companies strictly pass the threshold
  const finalCandidates =
    strictMatches.length >= 3
      ? strictMatches.slice(0, APP_CONFIG.cohortScreener.maxCandidates)
      : [...strictMatches, ...nearMatches].slice(
          0,
          APP_CONFIG.cohortScreener.maxCandidates
        );

  // Keep initialMarketById trimmed to finalCandidates
  const trimmedMarketById: Record<string, CompanyMarketOverviewData> = {};
  for (const c of finalCandidates) {
    if (initialMarketById[c.id]) {
      trimmedMarketById[c.id] = initialMarketById[c.id];
    }
  }

  const preselectedSource =
    strictMatches.length > 0 ? strictMatches : finalCandidates;
  const preselectedIds = preselectedSource
    .slice(0, APP_CONFIG.cohortScreener.defaultPreselectedCount)
    .map((c) => c.id);

  let constraintSummary = aiDiscovery?.constraintSummary ?? null;
  if (!constraintSummary && minThresholdUsd) {
    constraintSummary = `${
      targetKind === 'public_only' ? 'Market Cap' : 'Valuation'
    } > ${formatUsdCompact(minThresholdUsd)}`;
  } else if (!constraintSummary && maxThresholdUsd) {
    constraintSummary = `${
      targetKind === 'public_only' ? 'Market Cap' : 'Valuation'
    } < ${formatUsdCompact(maxThresholdUsd)}`;
  }

  const responsePayload: CohortScreenResponse = {
    query: trimmedQuery,
    interpretedTheme: aiDiscovery?.interpretedTheme || trimmedQuery,
    constraintSummary,
    minThresholdUsd,
    maxThresholdUsd,
    strictMatchCount: strictMatches.length,
    candidates: finalCandidates,
    preselectedIds,
    initialMarketById: trimmedMarketById,
  };

  screenCache.set(cacheKey, {
    data: responsePayload,
    expiresAt: Date.now() + SCREEN_CACHE_TTL_MS,
  });

  return responsePayload;
}

/**
 * Fetches live news headlines via Context.dev (`POST /v1/news/search`) and computes
 * sentiment distribution + the single highest-impact catalyst/risk headline for a company.
 *
 * @param item - CohortCompareRequestItem
 * @returns `ComparedCompanyNewsPulse`
 */
async function fetchCompanyNewsPulse(
  item: CohortCompareRequestItem
): Promise<ComparedCompanyNewsPulse> {
  const cacheKey = `${item.entityType}::${item.searchQuery.toLowerCase()}`;
  const cached = newsPulseCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  let rawArticles = [];
  let hasContextKey = false;
  try {
    validateContextDevApiKey();
    hasContextKey = true;
  } catch {
    hasContextKey = false;
  }

  if (hasContextKey) {
    try {
      const sdkRes = await searchCompanyNews({
        entityType: item.entityType,
        entityValue: item.searchQuery,
        filterCategory: 'none',
        sortBy: 'newest',
        limit: 4,
      });
      rawArticles = sdkRes.response.data || [];
    } catch {
      const fb = buildFallbackNewsResponse({
        entityType: item.entityType,
        entityValue: item.searchQuery,
        filterCategory: 'none',
        sortBy: 'newest',
        limit: 4,
      });
      rawArticles = fb.data || [];
    }
  } else {
    const fb = buildFallbackNewsResponse({
      entityType: item.entityType,
      entityValue: item.searchQuery,
      filterCategory: 'none',
      sortBy: 'newest',
      limit: 4,
    });
    rawArticles = fb.data || [];
  }

  const translated = await translateNonEnglishArticlesToEnglish(rawArticles);
  const { articles: enriched } = await analyzeHeadlineSentiments(translated);

  let bullishCount = 0;
  let bearishCount = 0;
  let neutralCount = 0;

  for (const art of enriched) {
    if (art.sentiment === 'Bullish') bullishCount++;
    else if (art.sentiment === 'Bearish') bearishCount++;
    else neutralCount++;
  }

  const total = enriched.length;
  const bullishPct =
    total > 0 ? Math.round((bullishCount / total) * 100) : 0;

  let netPosture: ComparedCompanyNewsPulse['netPosture'] = 'Neutral';
  if (bullishCount > bearishCount && bullishCount > 0) {
    netPosture = bearishCount > 0 && bullishCount === bearishCount + 1 ? 'Mixed' : 'Bullish';
  } else if (bearishCount > bullishCount && bearishCount > 0) {
    netPosture = 'Bearish';
  } else if (bullishCount > 0 && bearishCount > 0) {
    netPosture = 'Mixed';
  }

  const leadArticle =
    enriched.find((a) => a.sentiment === 'Bullish' || a.sentiment === 'Bearish') ||
    enriched[0] ||
    null;

  const pulse: ComparedCompanyNewsPulse = {
    articleCount: total,
    bullishCount,
    bearishCount,
    neutralCount,
    bullishPct,
    netPosture,
    topCatalyst: leadArticle
      ? {
          title: leadArticle.title,
          url: leadArticle.url,
          sourceName:
            leadArticle.source?.name || leadArticle.source?.domain || 'News Wire',
          publishedAt: leadArticle.published_at || null,
          sentiment: leadArticle.sentiment || 'Neutral',
        }
      : null,
  };

  newsPulseCache.set(cacheKey, {
    data: pulse,
    expiresAt: Date.now() + NEWS_PULSE_CACHE_TTL_MS,
  });

  return pulse;
}

/**
 * Generates a concise 2-sentence institutional comparison summary across the
 * currently selected cohort companies using `gemini-4-hydrogen` (`ThinkingLevel.LOW`).
 *
 * @param theme - Active screening theme or query
 * @param dossiers - Hydrated company dossiers being compared
 * @returns 2-sentence comparative summary or null
 */
async function synthesizeComparativeSummary(
  theme: string,
  dossiers: ComparedCompanyDossier[]
): Promise<string | null> {
  if (dossiers.length < 2) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });

  const snapshot = dossiers.map((d) => {
    const m = d.market;
    const p = d.profile;
    const n = d.newsPulse;
    if (m?.kind === 'public') {
      return {
        company: `${m.companyName} (${formatTickerWithAdr(
          m.symbol,
          m.companyName,
          m.isAdr
        )})`,
        marketCap: m.metrics.marketCap,
        periodReturnPct: `${m.changePercent >= 0 ? '+' : ''}${m.changePercent.toFixed(2)}% (${m.range})`,
        trailingPE: m.metrics.trailingPE,
        forwardPE: m.metrics.forwardPE,
        revenue: p?.revenueDisplay || m.metrics.totalRevenue,
        newsPosture: n?.netPosture || 'Neutral',
        topCatalyst: n?.topCatalyst?.title || null,
      };
    }
    return {
      company: `${m?.companyName || p?.name || d.id} (Private)`,
      valuation: m?.kind === 'private' ? m.latestValuation : p?.funding.totalUsdDisplay,
      revenue: p?.revenueDisplay || (m?.kind === 'private' ? m.estimatedRevenue : null),
      newsPosture: n?.netPosture || 'Neutral',
      topCatalyst: n?.topCatalyst?.title || null,
    };
  });

  const model = APP_CONFIG.gemini.defaultModel;
  const prompt = `Compare these ${dossiers.length} companies screened for "${theme}":
${JSON.stringify(snapshot, null, 2)}

Write a crisp, factual 2-sentence comparative takeaway (maximum 55 words total) contrasting their valuation scale/multiples, relative price momentum, and current news posture. Use exact numbers from the data provided.`;

  const config = {
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: 'Concise 2-sentence comparative takeaway grounded in the provided metrics.',
        },
      },
      required: ['summary'],
    },
  };

  try {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config,
    });
    const rawText = (res.text ?? '{}').trim();
    logGenAICall({ model, prompt, config, output: rawText });
    const parsed = JSON.parse(rawText) as { summary?: string };
    return typeof parsed.summary === 'string' && parsed.summary.trim()
      ? parsed.summary.trim()
      : null;
  } catch (error) {
    logGenAICall({ model, prompt, config, error });
    return null;
  }
}

/**
 * Hydrates full side-by-side comparison dossiers (live market metrics & chart series,
 * Context.dev company profile firmographics, Context.dev news sentiment & top catalyst,
 * and a comparative AI summary) for up to 4 selected companies in parallel.
 *
 * @param params - Selected items, chart timeframe range, theme label, and chartOnly flag
 * @returns `CohortCompareResponse`
 */
export async function hydrateCohortComparison(params: {
  items: CohortCompareRequestItem[];
  range: ChartRange;
  theme?: string;
  chartOnly?: boolean;
}): Promise<CohortCompareResponse> {
  logFunctionCall('hydrateCohortComparison', {
    itemCount: params.items.length,
    range: params.range,
    chartOnly: params.chartOnly ?? false,
  });

  const boundedItems = params.items.slice(
    0,
    APP_CONFIG.cohortScreener.maxCompareColumns
  );

  const hydratedList = await Promise.all(
    boundedItems.map(async (item): Promise<ComparedCompanyDossier> => {
      if (params.chartOnly) {
        const market = await getCompanyMarketOverview({
          query: item.searchQuery,
          entityType: item.entityType,
          range: params.range,
        }).catch(() => null);

        return {
          id: item.id,
          market,
          profile: null,
          newsPulse: null,
        };
      }

      const [market, profile, newsPulse] = await Promise.all([
        getCompanyMarketOverview({
          query: item.searchQuery,
          entityType: item.entityType,
          range: params.range,
        }).catch(() => null),
        getCompanyProfileBySearch({
          query: item.searchQuery,
          entityType: item.entityType,
          companyNameHint: item.name,
        }).catch(() => null),
        fetchCompanyNewsPulse(item).catch(() => null),
      ]);

      return {
        id: item.id,
        market,
        profile,
        newsPulse,
      };
    })
  );

  const dossiersById: Record<string, ComparedCompanyDossier> = {};
  for (const d of hydratedList) {
    dossiersById[d.id] = d;
  }

  const comparativeSummary = params.chartOnly
    ? null
    : await synthesizeComparativeSummary(
        params.theme || 'Selected Cohort',
        hydratedList
      );

  return {
    range: params.range,
    dossiersById,
    comparativeSummary,
  };
}
