/**
 * ============================================================================
 * FILE: lib/company-profile-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Company Firmographic, Social, Industry & Funding Profile Service
 * powered by Context.dev Company Search (`POST /v1/company/search`).
 *
 * USE CASES:
 * 1. Enriching any searched US public ticker (`NVDA`, `AAPL`, `MSFT`, `PLTR`)
 *    or private company (`Stripe`, `OpenAI`, `SpaceX`, `Anthropic`) with rich
 *    corporate context: description, official website domain, social links,
 *    headquarters, founding year, employee headcount, industries, estimated
 *    revenue range, and historical funding rounds.
 * 2. Disambiguating short stock ticker queries into company names prior to
 *    invoking Context.dev Company Search (`mode: 'fast'`) and deterministically
 *    scoring the returned `results` array so only the single best-matching
 *    company profile is surfaced without cluttering the UI.
 * 3. Providing a resilient live-web grounded fallback via Google Search
 *    grounding (`@google/genai`) matching the exact Context.dev `/company/search`
 *    schema whenever `CONTEXT_DEV_API_KEY` is not yet configured or returns
 *    zero matches for a ticker.
 * ============================================================================
 */

import { GoogleGenAI } from '@google/genai';
import { stripAdrSuffix } from './adr-directory';
import { APP_CONFIG } from './config';
import {
  createContextDevClient,
  validateContextDevApiKey,
} from './context-dev';
import {
  lookupHangulPrivateAlias,
  lookupKrxDirectoryEntry,
  resolveDynamicKrxAutocomplete,
} from './krx-directory';
import { logFunctionCall, logGenAICall } from './logger';

/**
 * Raw item returned inside `results[]` from Context.dev `POST /v1/company/search`.
 */
export interface ContextDevCompanyRecord {
  name: string;
  domain: string;
  socials: {
    linkedin?: string | null;
    x?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    youtube?: string | null;
    github?: string | null;
    crunchbase?: string | null;
    wellfound?: string | null;
  };
  description?: string | null;
  organization_type?: string | null;
  operating_status?: string | null;
  stock_symbols: string[];
  revenue: {
    min_usd?: number | null;
    max_usd?: number | null;
  };
  industries: string[];
  founded_year?: number | null;
  headquarters: {
    country_code?: string | null;
    region?: string | null;
    city?: string | null;
    street_address?: string | null;
    postal_code?: string | null;
  };
  employees: {
    count?: number | null;
    min?: number | null;
    max?: number | null;
  };
  funding: {
    total_usd?: number | null;
    round_count: number;
    latest_round?: {
      type: string;
      date: string;
      amount_usd?: number | null;
    } | null;
    stage?: string | null;
    rounds: Array<{
      type: string;
      date: string;
      amount_usd?: number | null;
      phase?: 'initial' | 'extension' | null;
    }>;
  };
}

interface ContextDevCompanySearchResponse {
  results?: ContextDevCompanyRecord[];
  next_cursor?: string | null;
}

/**
 * Normalized company profile structure consumed by `CollapsibleCompanyProfile`.
 */
export interface CompanyProfileData {
  query: string;
  name: string;
  domain: string | null;
  description: string | null;
  organizationTypeLabel: string;
  operatingStatusLabel: string | null;
  stockSymbols: string[];
  socials: Array<{
    platform: string;
    url: string;
  }>;
  headquartersShort: string | null;
  headquartersFull: string | null;
  foundedYear: number | null;
  employeesDisplay: string | null;
  industries: string[];
  revenueDisplay: string | null;
  funding: {
    stageLabel: string | null;
    totalUsdDisplay: string | null;
    roundCount: number;
    latestRoundDisplay: string | null;
    rounds: Array<{
      typeLabel: string;
      date: string;
      amountDisplay: string | null;
      phaseLabel: string | null;
    }>;
  };
}

const PROFILE_CACHE_TTL_MS = 15 * 60 * 1000;

const profileCache = new Map<
  string,
  { data: CompanyProfileData | null; expiresAt: number }
>();

const COMMON_TICKER_NAMES: Record<string, string> = {
  NVDA: 'NVIDIA',
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  PLTR: 'Palantir Technologies',
  TSLA: 'Tesla',
  AMZN: 'Amazon',
  GOOGL: 'Alphabet Google',
  GOOG: 'Alphabet Google',
  META: 'Meta Platforms',
  AMD: 'Advanced Micro Devices',
  TSM: 'TSMC Taiwan Semiconductor',
  AVGO: 'Broadcom',
  ORCL: 'Oracle',
  CRM: 'Salesforce',
  NFLX: 'Netflix',
  INTC: 'Intel',
  ASML: 'ASML Holding',
  ARM: 'Arm Holdings',
  SMCI: 'Super Micro Computer',
  SNOW: 'Snowflake',
  NET: 'Cloudflare',
  CRWD: 'CrowdStrike',
  PANW: 'Palo Alto Networks',
  COIN: 'Coinbase',
  UBER: 'Uber Technologies',
  SHOP: 'Shopify',
  SQ: 'Block',
  JPM: 'JPMorgan Chase',
  GS: 'Goldman Sachs',
  V: 'Visa',
  MA: 'Mastercard',
};

/**
 * Formats a USD integer into a concise institutional currency string (e.g., `$1.25B`, `$450M`).
 *
 * @param amount - Dollar amount in USD
 * @returns Formatted currency string or null if unavailable
 */
export function formatUsdCompact(
  amount: number | null | undefined
): string | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  if (amount >= 1e12) {
    return `$${(amount / 1e12).toFixed(amount % 1e12 === 0 ? 0 : 2)}T`;
  }
  if (amount >= 1e9) {
    return `$${(amount / 1e9).toFixed(amount % 1e9 === 0 ? 0 : 2)}B`;
  }
  if (amount >= 1e6) {
    return `$${(amount / 1e6).toFixed(amount % 1e6 === 0 ? 0 : 1)}M`;
  }
  if (amount >= 1e3) {
    return `$${Math.round(amount / 1e3)}K`;
  }
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

/**
 * Converts snake_case or lowercase labels (e.g. `public_company`, `series_b`) into
 * clean human-readable title case (`Public Company`, `Series B`).
 *
 * @param raw - Raw snake_case or lowercase label
 * @returns Formatted title-case string
 */
export function humanizeSnakeLabel(
  raw: string | null | undefined
): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;

  const upperAcronyms = new Set([
    'ipo',
    'spac',
    'pe',
    'vc',
    'ai',
    'b2b',
    'saas',
  ]);
  return cleaned
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (upperAcronyms.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Formats employee headcount (`count` or `min`–`max` bounds) for compact display.
 *
 * @param employees - Employees object from Context.dev Company Search
 * @returns Formatted headcount string or null
 */
function formatEmployeesDisplay(
  employees?: ContextDevCompanyRecord['employees'] | null
): string | null {
  if (!employees) return null;
  if (typeof employees.count === 'number' && employees.count > 0) {
    return `${employees.count.toLocaleString('en-US')} employees`;
  }
  if (
    typeof employees.min === 'number' &&
    employees.min > 0 &&
    typeof employees.max === 'number' &&
    employees.max > 0
  ) {
    return `${employees.min.toLocaleString('en-US')}–${employees.max.toLocaleString('en-US')} employees`;
  }
  if (typeof employees.min === 'number' && employees.min > 0) {
    return `${employees.min.toLocaleString('en-US')}+ employees`;
  }
  return null;
}

/**
 * Formats estimated annual revenue range (`min_usd` and `max_usd`) into a clean display string.
 *
 * @param revenue - Revenue bounds object from Context.dev Company Search
 * @returns Formatted revenue range string or null
 */
function formatRevenueDisplay(
  revenue?: ContextDevCompanyRecord['revenue'] | null
): string | null {
  if (!revenue) return null;
  const minStr = formatUsdCompact(revenue.min_usd);
  const maxStr = formatUsdCompact(revenue.max_usd);
  if (minStr && maxStr) {
    return minStr === maxStr ? minStr : `${minStr} – ${maxStr}`;
  }
  if (minStr) return `${minStr}+`;
  if (maxStr) return `Up to ${maxStr}`;
  return null;
}

/**
 * Resolves a short stock ticker to a cleaner company search query using known presets,
 * common US equities, or Yahoo Finance's lightweight symbol search.
 *
 * @param rawQuery - User search input (ticker or company name)
 * @param entityType - Optional entity type hint
 * @param companyNameHint - Optional company name already resolved by the frontend
 * @returns Company name query suitable for Context.dev `/company/search`
 */
async function resolveSearchQueryForCompanyApi(
  rawQuery: string,
  entityType: string,
  companyNameHint?: string
): Promise<{ resolvedNameQuery: string; normalizedTicker: string | null }> {
  logFunctionCall('resolveSearchQueryForCompanyApi', {
    rawQuery,
    entityType,
    companyNameHint,
  });

  const trimmed = stripAdrSuffix(rawQuery.trim());
  const hangulPrivate = lookupHangulPrivateAlias(trimmed);
  if (hangulPrivate) {
    return {
      resolvedNameQuery: hangulPrivate,
      normalizedTicker: null,
    };
  }

  const krxEntry =
    lookupKrxDirectoryEntry(trimmed) ||
    (companyNameHint ? lookupKrxDirectoryEntry(companyNameHint) : null);
  if (krxEntry) {
    return {
      resolvedNameQuery: krxEntry.enName,
      normalizedTicker: krxEntry.code,
    };
  }

  if (/^[0-9A-Z]{6}(\.(KS|KQ))?$/i.test(trimmed)) {
    const dyn = await resolveDynamicKrxAutocomplete(trimmed.slice(0, 6), 'ko');
    if (dyn) {
      return {
        resolvedNameQuery: dyn.enName,
        normalizedTicker: trimmed.slice(0, 6).toUpperCase(),
      };
    }
  }

  const looksLikeTicker = /^[A-Za-z]{1,5}(\.[A-Za-z]{1,2})?$/.test(trimmed);
  const upperTicker = looksLikeTicker ? trimmed.toUpperCase() : null;

  if (companyNameHint && companyNameHint.trim().length > 1) {
    const cleanedHint = companyNameHint
      .replace(
        /\s+(Inc\.?|Corp\.?|Corporation|Ltd\.?|PLC|Holdings?|Group)$/i,
        ''
      )
      .trim();
    if (cleanedHint.toLowerCase() !== trimmed.toLowerCase()) {
      return {
        resolvedNameQuery: cleanedHint || companyNameHint.trim(),
        normalizedTicker: upperTicker,
      };
    }
  }

  const presetMatch = APP_CONFIG.featuredCompanies.find(
    (p) =>
      p.value.toLowerCase() === trimmed.toLowerCase() ||
      p.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (presetMatch) {
    return {
      resolvedNameQuery: presetMatch.label.replace(/\s+(Inc|Corp)$/i, '').trim(),
      normalizedTicker:
        presetMatch.entityType === 'ticker'
          ? presetMatch.value.toUpperCase()
          : upperTicker,
    };
  }

  if (upperTicker && COMMON_TICKER_NAMES[upperTicker]) {
    return {
      resolvedNameQuery: COMMON_TICKER_NAMES[upperTicker],
      normalizedTicker: upperTicker,
    };
  }

  if (upperTicker && (entityType === 'ticker' || trimmed === upperTicker)) {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
          upperTicker
        )}&quotesCount=4&newsCount=0`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(3500),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          quotes?: Array<{
            symbol?: string;
            shortname?: string;
            longname?: string;
          }>;
        };
        const exactQuote = (data.quotes || []).find(
          (q) =>
            String(q.symbol || '')
              .toUpperCase()
              .replace(/-/g, '.') === upperTicker
        );
        const rawResolved = exactQuote?.longname || exactQuote?.shortname;
        if (rawResolved) {
          const cleanName = rawResolved
            .replace(
              /,?\s+(Inc\.?|Corp\.?|Corporation|Ltd\.?|PLC|Holdings?|Co\.?)$/i,
              ''
            )
            .trim();
          if (cleanName) {
            return {
              resolvedNameQuery: cleanName,
              normalizedTicker: upperTicker,
            };
          }
        }
      }
    } catch {
      // Ignore symbol helper timeout and continue with raw query
    }
  }

  return {
    resolvedNameQuery: trimmed,
    normalizedTicker: upperTicker,
  };
}

/**
 * Scores candidate company records returned by Context.dev `/company/search`
 * and selects the single highest-confidence match for the searched entity.
 *
 * @param results - Array of ContextDevCompanyRecord candidates
 * @param rawQuery - Original user query
 * @param resolvedNameQuery - Resolved company name query
 * @param normalizedTicker - Uppercase stock ticker if applicable
 * @returns Best matching ContextDevCompanyRecord or null
 */
export function selectTopCompanyMatch(
  results: ContextDevCompanyRecord[],
  rawQuery: string,
  resolvedNameQuery: string,
  normalizedTicker: string | null
): ContextDevCompanyRecord | null {
  logFunctionCall('selectTopCompanyMatch', {
    candidateCount: results.length,
    rawQuery,
    resolvedNameQuery,
    normalizedTicker,
  });

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const targetNameLower = resolvedNameQuery.trim().toLowerCase();
  const rawLower = rawQuery.trim().toLowerCase();

  let bestRecord = results[0];
  let bestScore = -1;

  results.forEach((candidate, idx) => {
    let score = Math.max(0, 20 - idx * 2);
    const candName = (candidate.name || '').trim().toLowerCase();
    const candDomain = (candidate.domain || '').trim().toLowerCase();
    const symbols = (candidate.stock_symbols || []).map(
      (s) => String(s).toUpperCase().split(':').pop()?.trim() || ''
    );

    if (normalizedTicker && symbols.includes(normalizedTicker)) {
      score += 120;
    }
    if (candName === targetNameLower || candName === rawLower) {
      score += 90;
    } else if (
      candName.startsWith(`${targetNameLower} `) ||
      candName.startsWith(`${rawLower} `) ||
      targetNameLower.startsWith(`${candName} `)
    ) {
      score += 65;
    } else if (
      candName.includes(targetNameLower) ||
      targetNameLower.includes(candName)
    ) {
      score += 35;
    }

    const domainStem = candDomain.split('.')[0] || '';
    if (
      domainStem === targetNameLower.replace(/\s+/g, '') ||
      domainStem === rawLower
    ) {
      score += 50;
    }

    if (candidate.description) score += 5;
    if (candidate.founded_year) score += 3;

    if (score > bestScore) {
      bestScore = score;
      bestRecord = candidate;
    }
  });

  return bestRecord;
}

/**
 * Transforms a raw `ContextDevCompanyRecord` into a clean UI-ready `CompanyProfileData` object.
 *
 * @param record - Raw Context.dev company search item
 * @param originalQuery - Original search query string
 * @returns Normalized CompanyProfileData
 */
export function normalizeCompanyRecord(
  record: ContextDevCompanyRecord,
  originalQuery: string
): CompanyProfileData {
  logFunctionCall('normalizeCompanyRecord', {
    companyName: record.name,
    domain: record.domain,
  });

  const socialEntries: Array<{ platform: string; url: string }> = [];
  const socialLabels: Record<string, string> = {
    linkedin: 'LinkedIn',
    x: 'X',
    github: 'GitHub',
    crunchbase: 'Crunchbase',
    youtube: 'YouTube',
    instagram: 'Instagram',
    wellfound: 'Wellfound',
    facebook: 'Facebook',
  };

  if (record.socials && typeof record.socials === 'object') {
    for (const [key, label] of Object.entries(socialLabels)) {
      const val = record.socials[key as keyof typeof record.socials];
      if (typeof val === 'string' && val.trim().startsWith('http')) {
        socialEntries.push({ platform: label, url: val.trim() });
      }
    }
  }

  const hq = record.headquarters || {};
  const shortParts = [hq.city, hq.region, hq.country_code]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  const fullParts = [
    hq.street_address,
    hq.city,
    hq.region,
    hq.postal_code,
    hq.country_code,
  ]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);

  const rawRounds = Array.isArray(record.funding?.rounds)
    ? record.funding.rounds
    : [];

  const sortedRounds = [...rawRounds]
    .filter(
      (r) => r && typeof r.type === 'string' && typeof r.date === 'string'
    )
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 8)
    .map((r) => ({
      typeLabel: humanizeSnakeLabel(r.type) || r.type,
      date: r.date,
      amountDisplay: formatUsdCompact(r.amount_usd),
      phaseLabel:
        r.phase === 'extension'
          ? 'Extension'
          : r.phase === 'initial'
            ? 'Initial'
            : null,
    }));

  const latestRound = record.funding?.latest_round;
  let latestRoundDisplay: string | null = null;
  if (latestRound && latestRound.type) {
    const rLabel = humanizeSnakeLabel(latestRound.type) || latestRound.type;
    const amt = formatUsdCompact(latestRound.amount_usd);
    latestRoundDisplay = [rLabel, amt, latestRound.date]
      .filter(Boolean)
      .join(' · ');
  }

  const hasStockSymbols =
    Array.isArray(record.stock_symbols) && record.stock_symbols.length > 0;
  const orgTypeLabel =
    humanizeSnakeLabel(record.organization_type) ||
    (hasStockSymbols ? 'Public Company' : 'Privately Held');

  let cleanDescription: string | null = null;
  if (typeof record.description === 'string' && record.description.trim()) {
    const trimmedDesc = record.description.trim();
    if (/[.!?)"']$/.test(trimmedDesc)) {
      cleanDescription = trimmedDesc;
    } else {
      const lastSentenceIdx = Math.max(
        trimmedDesc.lastIndexOf('. '),
        trimmedDesc.lastIndexOf('! '),
        trimmedDesc.lastIndexOf('? ')
      );
      if (lastSentenceIdx >= Math.floor(trimmedDesc.length * 0.55)) {
        cleanDescription = trimmedDesc.slice(0, lastSentenceIdx + 1);
      } else {
        cleanDescription = `${trimmedDesc.replace(/\s+\S*$/, '')}…`;
      }
    }
  }

  const rawStage = (record.funding?.stage || '').trim().toLowerCase();
  let resolvedStageLabel = humanizeSnakeLabel(record.funding?.stage);
  if (rawStage === 'series_unknown' || rawStage === 'unknown') {
    const namedSeriesRound = sortedRounds.find((r) =>
      /^Series\s+[A-Z]$/i.test(r.typeLabel)
    );
    resolvedStageLabel = namedSeriesRound
      ? namedSeriesRound.typeLabel
      : sortedRounds.length >= 3
        ? 'Late-Stage Venture'
        : 'Venture-Backed';
  }

  return {
    query: originalQuery,
    name: record.name || originalQuery,
    domain: record.domain
      ? record.domain.trim().replace(/^https?:\/\//i, '')
      : null,
    description: cleanDescription,
    organizationTypeLabel: orgTypeLabel,
    operatingStatusLabel: humanizeSnakeLabel(record.operating_status),
    stockSymbols: Array.isArray(record.stock_symbols)
      ? record.stock_symbols.filter(Boolean).slice(0, 4)
      : [],
    socials: socialEntries,
    headquartersShort: shortParts.length > 0 ? shortParts.join(', ') : null,
    headquartersFull: fullParts.length > 0 ? fullParts.join(', ') : null,
    foundedYear:
      typeof record.founded_year === 'number' && record.founded_year > 1600
        ? record.founded_year
        : null,
    employeesDisplay: formatEmployeesDisplay(record.employees),
    industries: Array.isArray(record.industries)
      ? record.industries
          .map((ind) => String(ind).trim())
          .filter(Boolean)
          .slice(0, 6)
      : [],
    revenueDisplay: formatRevenueDisplay(record.revenue),
    funding: {
      stageLabel: resolvedStageLabel,
      totalUsdDisplay: formatUsdCompact(record.funding?.total_usd),
      roundCount:
        typeof record.funding?.round_count === 'number'
          ? record.funding.round_count
          : sortedRounds.length,
      latestRoundDisplay,
      rounds: sortedRounds,
    },
  };
}

/**
 * Synthesizes a grounded `ContextDevCompanyRecord` via Gemini with Google Search
 * grounding whenever `CONTEXT_DEV_API_KEY` is not configured in the environment
 * or returns empty results, ensuring consistent, factual firmographic profiles.
 *
 * @param resolvedNameQuery - Company name query
 * @param normalizedTicker - Optional stock ticker symbol
 * @returns Grounded ContextDevCompanyRecord or null
 */
async function fetchGroundedFallbackCompanyRecord(
  resolvedNameQuery: string,
  normalizedTicker: string | null
): Promise<ContextDevCompanyRecord | null> {
  logFunctionCall('fetchGroundedFallbackCompanyRecord', {
    resolvedNameQuery,
    normalizedTicker,
  });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  const ai = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });

  const model = APP_CONFIG.gemini.defaultModel;
  const targetLabel = normalizedTicker
    ? `${resolvedNameQuery} (Ticker: ${normalizedTicker})`
    : resolvedNameQuery;

  const prompt = `Retrieve factual corporate profile information for "${targetLabel}".
Return ONLY a valid JSON object (no markdown fences) matching this exact structure:
{
  "name": "Official company name",
  "domain": "primary website domain without https:// (e.g. nvidia.com)",
  "socials": {
    "linkedin": "full https://www.linkedin.com/company/... URL or null",
    "x": "full https://x.com/... URL or null",
    "github": "full https://github.com/... URL or null",
    "crunchbase": "full https://www.crunchbase.com/organization/... URL or null"
  },
  "description": "Concise 2-sentence factual overview of what the company builds and sells.",
  "organization_type": "public_company or privately_held",
  "operating_status": "active",
  "stock_symbols": ["NVDA"],
  "revenue": {
    "min_usd": 60000000000,
    "max_usd": 130000000000
  },
  "industries": ["Semiconductors", "Artificial Intelligence", "Cloud Computing"],
  "founded_year": 1993,
  "headquarters": {
    "city": "Santa Clara",
    "region": "California",
    "country_code": "US"
  },
  "employees": {
    "count": 29600,
    "min": null,
    "max": null
  },
  "funding": {
    "total_usd": null,
    "round_count": 0,
    "stage": "ipo or series_c etc. or null",
    "latest_round": { "type": "ipo or series_i", "date": "YYYY-MM-DD", "amount_usd": 100000000 },
    "rounds": [
      { "type": "series_a", "date": "YYYY-MM-DD", "amount_usd": 20000000, "phase": "initial" }
    ]
  }
}
Use real, verifiable numbers in integer USD (or null if unknown/not applicable). Include up to 5 notable historical funding or IPO rounds if known.`;

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

    const parsed = JSON.parse(jsonMatch[0]) as ContextDevCompanyRecord;
    if (!parsed || typeof parsed.name !== 'string' || !parsed.name.trim()) {
      return null;
    }
    return parsed;
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
 * Fetches and normalizes the top-matching company profile for a searched query
 * using Context.dev Company Search (`POST /v1/company/search` in `fast` mode),
 * with 15-minute server caching and grounded fallback support.
 *
 * @param params - Search query, optional entity type, companyNameHint, and forceRefresh flag
 * @returns Normalized `CompanyProfileData` or null if no company could be resolved
 */
export async function getCompanyProfileBySearch(params: {
  query: string;
  entityType?: string;
  companyNameHint?: string;
  forceRefresh?: boolean;
}): Promise<CompanyProfileData | null> {
  logFunctionCall('getCompanyProfileBySearch', { ...params });

  const trimmedQuery = params.query.trim();
  if (!trimmedQuery) {
    return null;
  }

  const cacheKey = `${(params.entityType || 'auto').toLowerCase()}::${trimmedQuery.toLowerCase()}`;
  if (!params.forceRefresh) {
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
  }

  const { resolvedNameQuery, normalizedTicker } =
    await resolveSearchQueryForCompanyApi(
      trimmedQuery,
      params.entityType || 'auto',
      params.companyNameHint
    );

  let hasContextKey = false;
  try {
    validateContextDevApiKey();
    hasContextKey = true;
  } catch {
    hasContextKey = false;
  }

  if (hasContextKey) {
    try {
      const client = createContextDevClient();
      const candidateQueries = [resolvedNameQuery];
      if (
        trimmedQuery.toLowerCase() !== resolvedNameQuery.toLowerCase() &&
        !candidateQueries.includes(trimmedQuery)
      ) {
        candidateQueries.push(trimmedQuery);
      }

      for (const q of candidateQueries) {
        logFunctionCall('contextDev.company.search:request', {
          endpoint: APP_CONFIG.contextDev.companySearchEndpoint,
          query: q,
          mode: APP_CONFIG.contextDev.companySearchMode,
        });

        const sdkResponse =
          await client.post<ContextDevCompanySearchResponse>(
            APP_CONFIG.contextDev.companySearchEndpoint,
            {
              body: {
                query: q.slice(0, 500),
                mode: APP_CONFIG.contextDev.companySearchMode,
              },
            }
          );

        const results = Array.isArray(sdkResponse?.results)
          ? sdkResponse.results
          : [];

        logFunctionCall('contextDev.company.search:response', {
          query: q,
          resultCount: results.length,
          topResultName: results[0]?.name ?? null,
        });

        const bestMatch = selectTopCompanyMatch(
          results,
          trimmedQuery,
          resolvedNameQuery,
          normalizedTicker
        );

        if (bestMatch) {
          const normalized = normalizeCompanyRecord(bestMatch, trimmedQuery);
          profileCache.set(cacheKey, {
            data: normalized,
            expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
          });
          return normalized;
        }
      }
    } catch (sdkError) {
      logFunctionCall('contextDev.company.search:error', {
        query: resolvedNameQuery,
        error: sdkError instanceof Error ? sdkError.message : String(sdkError),
      });
    }
  }

  const fallbackRecord = await fetchGroundedFallbackCompanyRecord(
    resolvedNameQuery,
    normalizedTicker
  );

  const normalizedFallback = fallbackRecord
    ? normalizeCompanyRecord(fallbackRecord, trimmedQuery)
    : null;

  profileCache.set(cacheKey, {
    data: normalizedFallback,
    expiresAt: Date.now() + PROFILE_CACHE_TTL_MS,
  });

  return normalizedFallback;
}
