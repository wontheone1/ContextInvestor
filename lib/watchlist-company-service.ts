/**
 * ============================================================================
 * FILE: lib/watchlist-company-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Watchlist Company Existence Verification & Live Sparkline Quote
 * Hydration Service for Contextual Investing.
 *
 * USE CASES:
 * 1. Strictly validating every Follow request (`validateAndResolveFollowCompany`)
 *    so users can ONLY follow genuinely existing public equities or verified
 *    private companies — rejecting random/non-existent inputs like `"asgadsgasd"`
 *    with a clear, actionable error message.
 * 2. Hydrating real, live historical price series and period `%` returns across
 *    explicit timeframes (`1D`, `5D`, `1M`, `6M`, `1Y` — defaulting to `1M`) for
 *    all public stocks in `"Companies You Are Following"`.
 * 3. Eliminating fabricated price sparklines and fake `%` returns for privately
 *    held companies (`Stripe`, `OpenAI`, `Anthropic`, `SpaceX`, etc.), returning
 *    `kind: 'private'`, `sparkline: []`, and real valuation/funding descriptors.
 * 4. Pruning any previously persisted invalid/gibberish entries from custom
 *    watchlists during initial hydration.
 * ============================================================================
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import {
  APP_CONFIG,
  type CompanyPreset,
  type WatchlistSparklineRange,
} from './config';
import {
  createContextDevClient,
  validateContextDevApiKey,
} from './context-dev';
import {
  formatUsdCompact,
  humanizeSnakeLabel,
  type ContextDevCompanyRecord,
} from './company-profile-service';
import {
  isAdrTicker,
  lookupAdrOrBrandAlias,
  lookupCompanyNameForAdrTicker,
  rankUsAndAdrEquityQuotes,
  stripAdrSuffix,
} from './adr-directory';
import { fetchChartData } from './market-data-service';
import { detectSearchQueryIntent } from './query-intent';
import { logFunctionCall, logGenAICall } from './logger';

export interface ValidateFollowResult {
  valid: boolean;
  preset?: CompanyPreset;
  error?: string;
}

export interface HydrateWatchlistResult {
  range: WatchlistSparklineRange;
  companies: CompanyPreset[];
  invalidValues: string[];
}

interface VerifiedPrivateEntry {
  label: string;
  sector: string;
  valuationLabel: string;
}

const YAHOO_SEARCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

const US_EQUITY_EXCHANGES = new Set([
  'NMS',
  'NYQ',
  'ASE',
  'NGM',
  'NCM',
  'PCX',
  'BTS',
  'NYS',
  'NAS',
  'OQX',
  'OBB',
  'PNK',
]);

const CORPORATE_SUFFIX_REGEX =
  /\b(inc|incorporated|corp|corporation|ltd|limited|plc|llc|lp|holdings|holding|group|co|company|technologies|technology|platforms|systems|international|the)\b/gi;

/**
 * Authoritative fast-path directory of prominent privately held companies with
 * disclosed institutional valuations or funding milestones.
 */
const VERIFIED_PRIVATE_COMPANIES: Record<string, VerifiedPrivateEntry> = {
  stripe: {
    label: 'Stripe',
    sector: 'Fintech Infrastructure',
    valuationLabel: 'Est. $91.5B Valuation',
  },
  openai: {
    label: 'OpenAI',
    sector: 'Frontier AI Models',
    valuationLabel: 'Est. $300B Valuation',
  },
  spacex: {
    label: 'SpaceX',
    sector: 'Aerospace & Defense',
    valuationLabel: 'Est. $350B Valuation',
  },
  anthropic: {
    label: 'Anthropic',
    sector: 'Frontier AI Safety & Models',
    valuationLabel: 'Est. $61.5B Valuation',
  },
  databricks: {
    label: 'Databricks',
    sector: 'Data & AI Lakehouse',
    valuationLabel: 'Est. $62B Valuation',
  },
  canva: {
    label: 'Canva',
    sector: 'Collaborative Design SaaS',
    valuationLabel: 'Est. $32B Valuation',
  },
  bytedance: {
    label: 'ByteDance',
    sector: 'Consumer Internet & AI',
    valuationLabel: 'Est. $300B Valuation',
  },
  revolut: {
    label: 'Revolut',
    sector: 'Digital Banking & Fintech',
    valuationLabel: 'Est. $45B Valuation',
  },
  chime: {
    label: 'Chime',
    sector: 'Consumer Fintech',
    valuationLabel: 'Est. $25B Valuation',
  },
  plaid: {
    label: 'Plaid',
    sector: 'Open Banking Infrastructure',
    valuationLabel: 'Est. $13.4B Valuation',
  },
  anduril: {
    label: 'Anduril Industries',
    sector: 'Autonomous Defense Systems',
    valuationLabel: 'Est. $28B Valuation',
  },
  'anduril industries': {
    label: 'Anduril Industries',
    sector: 'Autonomous Defense Systems',
    valuationLabel: 'Est. $28B Valuation',
  },
  'scale ai': {
    label: 'Scale AI',
    sector: 'AI Data Infrastructure',
    valuationLabel: 'Est. $13.8B Valuation',
  },
  perplexity: {
    label: 'Perplexity AI',
    sector: 'Conversational AI Search',
    valuationLabel: 'Est. $9B Valuation',
  },
  'perplexity ai': {
    label: 'Perplexity AI',
    sector: 'Conversational AI Search',
    valuationLabel: 'Est. $9B Valuation',
  },
  xai: {
    label: 'xAI',
    sector: 'Frontier AI Models',
    valuationLabel: 'Est. $50B Valuation',
  },
  deepseek: {
    label: 'DeepSeek',
    sector: 'Frontier AI Research',
    valuationLabel: 'Privately Backed Lab',
  },
  figma: {
    label: 'Figma',
    sector: 'Product Design Platform',
    valuationLabel: 'Est. $12.5B Valuation',
  },
  discord: {
    label: 'Discord',
    sector: 'Communications Platform',
    valuationLabel: 'Est. $15B Valuation',
  },
  'epic games': {
    label: 'Epic Games',
    sector: 'Interactive 3D & Gaming',
    valuationLabel: 'Est. $22.5B Valuation',
  },
  ramp: {
    label: 'Ramp',
    sector: 'Corporate Spend & Finance',
    valuationLabel: 'Est. $13B Valuation',
  },
  rippling: {
    label: 'Rippling',
    sector: 'Workforce & Finance OS',
    valuationLabel: 'Est. $13.5B Valuation',
  },
  deel: {
    label: 'Deel',
    sector: 'Global Payroll & HR',
    valuationLabel: 'Est. $12B Valuation',
  },
  'mistral ai': {
    label: 'Mistral AI',
    sector: 'Frontier Open-Weight AI',
    valuationLabel: 'Est. $6.2B Valuation',
  },
  mistral: {
    label: 'Mistral AI',
    sector: 'Frontier Open-Weight AI',
    valuationLabel: 'Est. $6.2B Valuation',
  },
  cohere: {
    label: 'Cohere',
    sector: 'Enterprise Foundation Models',
    valuationLabel: 'Est. $5.5B Valuation',
  },
  waymo: {
    label: 'Waymo',
    sector: 'Autonomous Mobility',
    valuationLabel: 'Est. $45B Valuation',
  },
  klarna: {
    label: 'Klarna',
    sector: 'Payments & Commerce',
    valuationLabel: 'Est. $14.6B Valuation',
  },
  shein: {
    label: 'Shein',
    sector: 'Global E-Commerce',
    valuationLabel: 'Est. $66B Valuation',
  },
};

/**
 * Short-lived server cache (10 minutes) for validated company lookups and live quotes.
 */
const validationCache = new Map<
  string,
  { result: ValidateFollowResult; expiresAt: number }
>();

const quotePresetCache = new Map<
  string,
  { preset: CompanyPreset; expiresAt: number }
>();

const followabilityCache = new Map<
  string,
  {
    result: {
      canFollow: boolean;
      ticker: string | null;
      entityType: 'ticker' | 'name';
      searchQuery: string;
    };
    expiresAt: number;
  }
>();

const foreignOnlyPublicCache = new Map<string, number>();

const QUOTE_CACHE_TTL_MS = 5 * 60 * 1000;
const VALIDATION_CACHE_TTL_MS = 15 * 60 * 1000;

function isKnownForeignOnlyPublic(nameOrQuery: string): boolean {
  const key = normalizeCoreCompanyName(nameOrQuery);
  if (!key) return false;
  const exp = foreignOnlyPublicCache.get(key);
  return typeof exp === 'number' && Date.now() < exp;
}

/**
 * Normalizes a requested sparkline timeframe against `APP_CONFIG.watchlist.supportedRanges`.
 *
 * @param raw - Requested range string
 * @returns Validated `WatchlistSparklineRange` (defaults to `'1M'`)
 */
export function normalizeWatchlistRange(
  raw?: string | null
): WatchlistSparklineRange {
  const upper = (raw || '').trim().toUpperCase();
  const supported = APP_CONFIG.watchlist
    .supportedRanges as readonly string[];
  if (supported.includes(upper)) {
    return upper as WatchlistSparklineRange;
  }
  return APP_CONFIG.watchlist.defaultSparklineRange;
}

/**
 * Downsamples an array of historical close prices to at most `maxPoints` while
 * strictly preserving the exact first and last closing prices of the period.
 *
 * @param closes - Full array of numeric closes
 * @param maxPoints - Maximum points to keep for crisp sparklines
 * @returns Downsampled numeric array
 */
export function sampleSparklineCloses(
  closes: number[],
  maxPoints: number = APP_CONFIG.watchlist.sparklineMaxPoints
): number[] {
  const valid = closes.filter(
    (n) => typeof n === 'number' && Number.isFinite(n) && n > 0
  );
  if (valid.length <= maxPoints) {
    return valid.map((v) => Number(v.toFixed(2)));
  }

  const sampled: number[] = [];
  const lastIdx = valid.length - 1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i / (maxPoints - 1)) * lastIdx);
    sampled.push(Number(valid[idx].toFixed(2)));
  }
  return sampled;
}

/**
 * Cleans corporate legal suffixes and punctuation from a company name for strict lexical matching.
 *
 * @param raw - Company name string
 * @returns Normalized lowercase core name
 */
function normalizeCoreCompanyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(CORPORATE_SUFFIX_REGEX, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Shortens long corporate legal suffixes from Yahoo Finance titles for clean card headers.
 *
 * @param raw - Full legal company name
 * @returns Concise institutional label
 */
function cleanDisplayCompanyLabel(raw: string): string {
  const cleaned = raw
    .replace(
      /,?\s+(Incorporated|Corporation|Public Limited Company|Common Stock|Class [A-C].*)$/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, 48) || raw.slice(0, 48);
}

/**
 * Checks whether a Yahoo Finance search result represents a listed US/ADR equity.
 *
 * @param quote - Raw quote entry from Yahoo `v1/finance/search`
 * @returns True if listed equity on a supported US venue
 */
function isSupportedUsEquityQuote(quote: Record<string, unknown>): boolean {
  const quoteType = String(quote.quoteType ?? '').toUpperCase();
  const exchange = String(quote.exchange ?? '').toUpperCase();
  const exchDisp = String(quote.exchDisp ?? '').toUpperCase();
  const symbol = String(quote.symbol ?? '').toUpperCase();

  if (quoteType !== 'EQUITY') return false;
  if (symbol.includes('.')) return false;

  if (US_EQUITY_EXCHANGES.has(exchange)) return true;
  if (/NASDAQ|NYSE|AMEX|CBOE|BATS|OTC/i.test(exchDisp)) return true;
  return false;
}

/**
 * Builds a live `CompanyPreset` for a verified public ticker over the requested `range`
 * using real Yahoo Finance historical closes.
 *
 * @param symbol - Verified stock symbol (e.g. `NVDA`)
 * @param range - Sparkline timeframe (`1D`, `5D`, `1M`, `6M`, `1Y`)
 * @param labelHint - Optional display label override
 * @param sectorHint - Optional sector label override
 * @returns Hydrated `CompanyPreset` or null if Yahoo chart data is unavailable
 */
export async function buildLivePublicPreset(
  symbol: string,
  range: WatchlistSparklineRange,
  labelHint?: string | null,
  sectorHint?: string | null
): Promise<CompanyPreset | null> {
  const normalizedSymbol = stripAdrSuffix(symbol)
    .toUpperCase()
    .replace(/\./g, '-');
  const cacheKey = `${normalizedSymbol}::${range}`;
  const cached = quotePresetCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      ...cached.preset,
      label: labelHint?.trim() || cached.preset.label,
      sector: sectorHint?.trim() || cached.preset.sector,
    };
  }

  const chart = await fetchChartData(normalizedSymbol, range);
  if (!chart || chart.points.length < 2) {
    return null;
  }

  const closes = chart.points.map((p) => p.close);
  const sparkline = sampleSparklineCloses(closes);
  if (sparkline.length < 2) {
    return null;
  }

  const currentPrice = chart.price;
  const baseline =
    range === '1D'
      ? chart.previousClose || closes[0]
      : closes[0] || chart.previousClose;
  const rawPct =
    baseline > 0 ? ((currentPrice - baseline) / baseline) * 100 : 0;
  const positive = rawPct >= 0;
  const formattedPct = `${positive ? '+' : ''}${rawPct.toFixed(2)}%`;

  const knownFeatured = APP_CONFIG.featuredCompanies.find(
    (f) =>
      f.entityType === 'ticker' &&
      f.value.toUpperCase() === normalizedSymbol
  );

  const adrDisplayName = lookupCompanyNameForAdrTicker(normalizedSymbol);

  const resolvedLabel =
    labelHint?.trim() ||
    knownFeatured?.label ||
    adrDisplayName ||
    cleanDisplayCompanyLabel(chart.companyName || normalizedSymbol);

  const isAdr = isAdrTicker(
    normalizedSymbol,
    `${resolvedLabel} ${chart.companyName || ''}`
  );

  const resolvedSector =
    sectorHint?.trim() ||
    knownFeatured?.sector ||
    (isAdr ? 'US-Traded ADR Equity' : 'US Listed Equity');

  const preset: CompanyPreset = {
    label: resolvedLabel,
    entityType: 'ticker',
    value: normalizedSymbol,
    kind: 'public',
    isAdr,
    sector: resolvedSector,
    price: `$${currentPrice.toFixed(2)}`,
    changePct: formattedPct,
    timeframe: range,
    positive,
    sparkline,
  };

  quotePresetCache.set(cacheKey, {
    preset,
    expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
  });

  return preset;
}

/**
 * Resolves a user query against Yahoo Finance US equities with strict ticker or
 * company-name verification (preventing random strings from fuzzy-matching unrelated stocks).
 *
 * @param rawQuery - User input query
 * @param range - Sparkline timeframe
 * @returns Verified `CompanyPreset` or null if not a real listed public equity
 */
async function resolveVerifiedPublicPreset(
  rawQuery: string,
  range: WatchlistSparklineRange
): Promise<CompanyPreset | null> {
  const cleaned = stripAdrSuffix(rawQuery).replace(/^\$/, '').trim();
  if (!cleaned) return null;

  if (VERIFIED_PRIVATE_COMPANIES[cleaned.toLowerCase()]) {
    return null;
  }

  // Fast-path for curated US-listed ADRs, OTC international leaders, and brand aliases (e.g. SK Hynix -> SKHY)
  const adrHit = lookupAdrOrBrandAlias(cleaned);
  if (adrHit) {
    const adrPreset = await buildLivePublicPreset(
      adrHit.symbol,
      range,
      adrHit.canonicalName,
      adrHit.sector
    );
    if (adrPreset) {
      return adrPreset;
    }
  }

  const normalizedUpper = cleaned.toUpperCase().replace(/\./g, '-');
  const cleanInputName = normalizeCoreCompanyName(cleaned);
  const inputWords = cleanInputName.split(/\s+/).filter(Boolean);

  let matchedSymbol: string | null = null;
  let matchedName: string | null = null;
  let matchedSector: string | null = null;
  let searchSucceeded = false;

  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      cleaned
    )}&quotesCount=12&newsCount=0&enableFuzzyQuery=false`;
    const res = await fetch(searchUrl, {
      headers: YAHOO_SEARCH_HEADERS,
      signal: AbortSignal.timeout(5500),
    });

    if (res.ok) {
      searchSucceeded = true;
      const json = (await res.json()) as {
        quotes?: Array<Record<string, unknown>>;
      };
      const usEquities = rankUsAndAdrEquityQuotes(
        (json.quotes ?? []).filter(isSupportedUsEquityQuote)
      );

      // 1. Exact ticker symbol match (e.g., NVDA, TSLA, SKHY, TSM, BRK-B)
      const exactSymbolQuote = usEquities.find(
        (q) => String(q.symbol ?? '').toUpperCase() === normalizedUpper
      );

      if (exactSymbolQuote) {
        matchedSymbol = String(exactSymbolQuote.symbol).toUpperCase();
        matchedName = String(
          exactSymbolQuote.shortname ||
            exactSymbolQuote.longname ||
            matchedSymbol
        );
        matchedSector =
          typeof exactSymbolQuote.sectorDisp === 'string' &&
          exactSymbolQuote.sectorDisp.trim()
            ? exactSymbolQuote.sectorDisp.trim()
            : typeof exactSymbolQuote.industryDisp === 'string' &&
                exactSymbolQuote.industryDisp.trim()
              ? exactSymbolQuote.industryDisp.trim()
              : null;
      } else if (cleanInputName.length >= 3) {
        // 2. Strict company-name match (supports 2-char leading brand tokens like "SK Hynix", "LG Display")
        const nameMatchQuote = usEquities.find((q) => {
          const fullRawName = `${String(q.longname ?? '')} ${String(
            q.shortname ?? ''
          )}`;
          const candCore = normalizeCoreCompanyName(fullRawName);
          if (!candCore) return false;

          if (
            candCore === cleanInputName ||
            candCore.startsWith(`${cleanInputName} `)
          ) {
            return true;
          }

          const candWords = candCore.split(/\s+/).filter(Boolean);
          return (
            inputWords.length > 0 &&
            candWords[0] === inputWords[0] &&
            inputWords.every((tok) => candWords.includes(tok))
          );
        });

        if (nameMatchQuote) {
          matchedSymbol = String(nameMatchQuote.symbol).toUpperCase();
          matchedName = String(
            nameMatchQuote.shortname ||
              nameMatchQuote.longname ||
              matchedSymbol
          );
          matchedSector =
            typeof nameMatchQuote.sectorDisp === 'string' &&
            nameMatchQuote.sectorDisp.trim()
              ? nameMatchQuote.sectorDisp.trim()
              : typeof nameMatchQuote.industryDisp === 'string' &&
                  nameMatchQuote.industryDisp.trim()
                ? nameMatchQuote.industryDisp.trim()
                : null;
        } else {
          // Check if Yahoo matched a foreign-only public equity (e.g. MediaTek 2454.TW, Quanta 2382.TW) with zero US/ADR quotes
          const foreignEquityHit = (json.quotes ?? []).find((q) => {
            if (String(q.quoteType ?? '').toUpperCase() !== 'EQUITY') {
              return false;
            }
            if (isSupportedUsEquityQuote(q)) return false;
            const fullRawName = `${String(q.longname ?? '')} ${String(
              q.shortname ?? ''
            )}`;
            const candCore = normalizeCoreCompanyName(fullRawName);
            if (!candCore) return false;
            if (
              candCore === cleanInputName ||
              candCore.startsWith(`${cleanInputName} `)
            ) {
              return true;
            }
            const candWords = candCore.split(/\s+/).filter(Boolean);
            return (
              inputWords.length > 0 &&
              candWords[0] === inputWords[0] &&
              inputWords.every((tok) => candWords.includes(tok))
            );
          });

          if (foreignEquityHit && cleanInputName) {
            foreignOnlyPublicCache.set(
              cleanInputName,
              Date.now() + VALIDATION_CACHE_TTL_MS
            );
          }
        }
      }
    }
  } catch {
    searchSucceeded = false;
  }

  // Fallback direct chart check ONLY if Yahoo search endpoint timed out AND query is strict ticker format
  if (
    !matchedSymbol &&
    !searchSucceeded &&
    /^[A-Z]{1,5}(-[A-Z]{1,2})?$/.test(normalizedUpper)
  ) {
    matchedSymbol = normalizedUpper;
  }

  if (!matchedSymbol) {
    return null;
  }

  return buildLivePublicPreset(
    matchedSymbol,
    range,
    matchedName ? cleanDisplayCompanyLabel(matchedName) : null,
    matchedSector
  );
}

/**
 * Formats a concise private-company valuation/funding descriptor from a Context.dev
 * company record without inventing any fake stock price % change.
 *
 * @param record - Verified `ContextDevCompanyRecord`
 * @returns Clean private-market descriptor string
 */
function buildPrivateDescriptorFromRecord(
  record: ContextDevCompanyRecord
): string {
  const totalFunding = formatUsdCompact(record.funding?.total_usd);
  if (totalFunding) {
    return `${totalFunding} Total Funding`;
  }

  const latestAmt = formatUsdCompact(record.funding?.latest_round?.amount_usd);
  const latestType = humanizeSnakeLabel(record.funding?.latest_round?.type);
  if (latestAmt && latestType) {
    return `${latestAmt} (${latestType})`;
  }

  const minRev = formatUsdCompact(record.revenue?.min_usd);
  const maxRev = formatUsdCompact(record.revenue?.max_usd);
  if (minRev && maxRev) {
    return minRev === maxRev
      ? `Est. ${minRev} Revenue`
      : `Est. ${minRev}–${maxRev} Rev`;
  }

  const stage = humanizeSnakeLabel(record.funding?.stage);
  if (stage && !/unknown/i.test(stage)) {
    return stage;
  }

  return 'Verified Private Entity';
}

/**
 * Checks Context.dev `POST /v1/company/search` using strict lexical & domain verification
 * so random strings like `"asgadsgasd"` never match unrelated companies.
 *
 * @param rawQuery - User input query
 * @param range - Sparkline timeframe (used if Context.dev reveals a US stock symbol)
 * @returns Verified `CompanyPreset` or null
 */
async function resolveViaContextDevStrict(
  rawQuery: string,
  range: WatchlistSparklineRange
): Promise<CompanyPreset | null> {
  try {
    validateContextDevApiKey();
  } catch {
    return null;
  }

  const cleaned = rawQuery.trim();
  const cleanInput = normalizeCoreCompanyName(cleaned);
  const compactInput = cleanInput.replace(/\s+/g, '');
  const inputWords = cleanInput.split(/\s+/).filter((w) => w.length >= 2);

  if (compactInput.length < 2) {
    return null;
  }

  try {
    const client = createContextDevClient();
    logFunctionCall('watchlist.contextDevCompanyVerify:request', {
      query: cleaned,
    });

    const response = await client.post<{
      results?: ContextDevCompanyRecord[];
    }>(APP_CONFIG.contextDev.companySearchEndpoint, {
      body: {
        query: cleaned.slice(0, 120),
        mode: 'fast',
      },
    });

    const results = Array.isArray(response?.results) ? response.results : [];
    logFunctionCall('watchlist.contextDevCompanyVerify:response', {
      query: cleaned,
      resultCount: results.length,
    });

    const strictMatch = results.find((cand) => {
      if (!cand || typeof cand.name !== 'string' || !cand.name.trim()) {
        return false;
      }
      const domain = (cand.domain || '').trim().toLowerCase();
      const hasValidDomain = domain.includes('.') && domain.length >= 4;
      const hasSubstance = Boolean(
        (cand.description && cand.description.trim().length > 15) ||
          cand.founded_year ||
          (Array.isArray(cand.industries) && cand.industries.length > 0) ||
          cand.employees?.count
      );
      if (!hasValidDomain || !hasSubstance) {
        return false;
      }

      const candCore = normalizeCoreCompanyName(cand.name);
      const candCompact = candCore.replace(/\s+/g, '');
      const domainStem = domain.replace(/^www\./, '').split('.')[0] || '';

      if (candCore === cleanInput || candCompact === compactInput) {
        return true;
      }
      if (compactInput.length >= 3 && domainStem === compactInput) {
        return true;
      }
      if (cleanInput.length >= 4 && inputWords.length > 0) {
        const candWords = candCore.split(/\s+/).filter(Boolean);
        if (
          candWords[0] === inputWords[0] &&
          inputWords.every((w) => candWords.includes(w))
        ) {
          return true;
        }
      }
      return false;
    });

    if (!strictMatch) {
      return null;
    }

    const hasPublicStockSymbols =
      Array.isArray(strictMatch.stock_symbols) &&
      strictMatch.stock_symbols.length > 0;
    const isPubliclyListedEntity =
      hasPublicStockSymbols ||
      /public/i.test(String(strictMatch.organization_type || '')) ||
      /public|ipo/i.test(String(strictMatch.funding?.stage || '')) ||
      isKnownForeignOnlyPublic(cleaned) ||
      isKnownForeignOnlyPublic(strictMatch.name);

    // If Context.dev indicates the company is publicly listed, try resolving a US or ADR ticker!
    if (isPubliclyListedEntity) {
      const adrMatch =
        lookupAdrOrBrandAlias(strictMatch.name) ||
        lookupAdrOrBrandAlias(cleaned);
      if (adrMatch) {
        const adrPreset = await buildLivePublicPreset(
          adrMatch.symbol,
          range,
          adrMatch.canonicalName,
          strictMatch.industries?.[0] || adrMatch.sector
        );
        if (adrPreset) {
          return adrPreset;
        }
      }

      if (Array.isArray(strictMatch.stock_symbols)) {
        const US_EXCHANGE_PREFIXES = new Set([
          'NASDAQ',
          'NYSE',
          'AMEX',
          'ARCA',
          'BATS',
          'OTC',
          'OTCMKTS',
          'US',
        ]);
        for (const rawSym of strictMatch.stock_symbols) {
          const upperRaw = String(rawSym).trim().toUpperCase();
          const parts = upperRaw.split(':');
          const prefix = parts.length > 1 ? parts[0].trim() : null;
          const extracted = parts[parts.length - 1]?.trim();

          // Skip explicit foreign exchange prefixes (e.g. TPE:2454, KRX:000660) so they don't collide with unrelated US tickers
          if (prefix && !US_EXCHANGE_PREFIXES.has(prefix)) {
            continue;
          }

          if (extracted && /^[A-Z]{1,5}(-[A-Z]{1,2})?$/.test(extracted)) {
            const publicPreset = await buildLivePublicPreset(
              extracted,
              range,
              cleanDisplayCompanyLabel(strictMatch.name),
              strictMatch.industries?.[0] || null
            );
            if (publicPreset) {
              return publicPreset;
            }
          }
        }
      }

      // Try resolving the canonical company name on Yahoo Finance for any US ADR / OTC quote
      const nameResolvedPublic = await resolveVerifiedPublicPreset(
        strictMatch.name,
        range
      );
      if (nameResolvedPublic) {
        return nameResolvedPublic;
      }

      // Foreign-only public equity with NO US listing and NO US ADR — do NOT misclassify as private!
      return null;
    }

    return {
      label: cleanDisplayCompanyLabel(strictMatch.name),
      entityType: 'name',
      value: strictMatch.name.trim(),
      kind: 'private',
      sector: strictMatch.industries?.[0] || 'Privately Held',
      price: 'Privately Held',
      changePct: buildPrivateDescriptorFromRecord(strictMatch),
      positive: true,
      sparkline: [],
    };
  } catch (err) {
    logFunctionCall('watchlist.contextDevCompanyVerify:error', {
      query: cleaned,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Final grounded existence check via Gemini + Google Search grounding to verify
 * legitimate private companies or brand aliases (e.g., `"Google"` -> `GOOGL`) while
 * strictly rejecting random non-existent strings like `"asgadsgasd"`.
 *
 * @param rawQuery - User input query
 * @param range - Sparkline timeframe
 * @returns Verified `CompanyPreset` or null if non-existent
 */
async function verifyCompanyViaGroundedSearch(
  rawQuery: string,
  range: WatchlistSparklineRange
): Promise<CompanyPreset | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  const cleaned = rawQuery.trim();
  const model = APP_CONFIG.gemini.defaultModel;

  const prompt = `Verify via Google Search whether "${cleaned}" is an ACTUALLY EXISTING, real-world operating company or publicly traded corporation, and classify its US tradability.
CRITICAL RULES:
- If "${cleaned}" is gibberish, random keyboard letters (e.g. "asgadsgasd", "qwerty123", "zzzzzz"), a person's name alone, a generic common noun, or a non-existent company, you MUST set "exists": false.
- Do NOT guess or match a vaguely similar-sounding company if "${cleaned}" itself is not a recognized company name, brand alias, or stock ticker.
- Set "listingType" accurately:
  * "us_or_adr": Publicly traded on NYSE, NASDAQ, or US OTC / ADR markets (including international leaders with US ADRs/OTC tickers such as SK Hynix -> "SKHY", TSMC -> "TSM", ASML -> "ASML", Samsung Electronics -> "SSNLF", Foxconn / Hon Hai -> "HNHPF", Tokyo Electron -> "TELWY", Infineon -> "IFNNY", SoftBank -> "SFTBY", Tencent -> "TCEHY", BYD -> "BYDDY", CATL -> "CYATY"). Put that US or ADR ticker in "usOrAdrTicker".
  * "foreign_public_no_us_adr": Publicly traded ONLY on a non-US stock exchange (e.g. Taiwan, Korea, Europe, Saudi Arabia) with NO US-traded ADR or US OTC equity ticker (e.g. MediaTek 2454.TW, Quanta Computer 2382.TW). Set "usOrAdrTicker": null.
  * "private": Genuinely privately held operating company not listed on any public stock exchange (e.g. Stripe, OpenAI, SpaceX, Anthropic, Databricks, Anduril). Set "usOrAdrTicker": null.

Return ONLY a valid JSON object (no markdown fences) matching this exact schema:
{
  "exists": boolean,
  "confidence": "high" | "medium" | "low",
  "officialName": string | null,
  "domain": string | null,
  "listingType": "us_or_adr" | "foreign_public_no_us_adr" | "private",
  "usOrAdrTicker": string | null,
  "sector": string | null,
  "latestValuationOrFunding": string | null
}`;

  const config = {
    tools: [{ googleSearch: {} }],
    thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
  };

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': APP_CONFIG.gemini.userAgent,
        },
      },
    });

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

    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    if (chunks.length === 0) {
      return null;
    }

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as {
      exists?: boolean;
      confidence?: string;
      officialName?: string | null;
      domain?: string | null;
      listingType?: 'us_or_adr' | 'foreign_public_no_us_adr' | 'private';
      usOrAdrTicker?: string | null;
      sector?: string | null;
      latestValuationOrFunding?: string | null;
    };

    if (
      parsed.exists !== true ||
      parsed.confidence !== 'high' ||
      typeof parsed.officialName !== 'string' ||
      !parsed.officialName.trim() ||
      typeof parsed.domain !== 'string' ||
      !parsed.domain.includes('.')
    ) {
      return null;
    }

    // 1. If it resolves to a US public equity or US-traded ADR, verify live chart on Yahoo Finance!
    if (
      typeof parsed.usOrAdrTicker === 'string' &&
      /^[A-Za-z]{1,5}([.-][A-Za-z]{1,2})?$/.test(parsed.usOrAdrTicker.trim())
    ) {
      const pubPreset = await buildLivePublicPreset(
        parsed.usOrAdrTicker.trim(),
        range,
        cleanDisplayCompanyLabel(parsed.officialName),
        parsed.sector || null
      );
      if (pubPreset) {
        return pubPreset;
      }
    }

    // Also check if officialName resolves to a US/ADR preset via Yahoo or ADR directory
    if (parsed.listingType !== 'private') {
      const fallbackPub = await resolveVerifiedPublicPreset(
        parsed.officialName,
        range
      );
      if (fallbackPub) {
        return fallbackPub;
      }
      // Foreign-only public company with no US/ADR listing cannot be followed
      return null;
    }

    // For private companies, require lexical correspondence between user input and officialName or domain
    const inputCore = normalizeCoreCompanyName(cleaned).replace(/\s+/g, '');
    const officialCore = normalizeCoreCompanyName(parsed.officialName).replace(
      /\s+/g,
      ''
    );
    const domainStem =
      parsed.domain
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('.')[0] || '';

    const lexicallyConsistent =
      inputCore.length >= 2 &&
      (officialCore.includes(inputCore) ||
        inputCore.includes(officialCore) ||
        domainStem.includes(inputCore) ||
        inputCore.includes(domainStem));

    if (!lexicallyConsistent) {
      return null;
    }

    const valuationText =
      typeof parsed.latestValuationOrFunding === 'string' &&
      parsed.latestValuationOrFunding.trim() &&
      !/unknown|null|n\/a/i.test(parsed.latestValuationOrFunding)
        ? parsed.latestValuationOrFunding.trim().slice(0, 36)
        : 'Verified Private Company';

    return {
      label: cleanDisplayCompanyLabel(parsed.officialName),
      entityType: 'name',
      value: parsed.officialName.trim(),
      kind: 'private',
      sector:
        typeof parsed.sector === 'string' && parsed.sector.trim()
          ? parsed.sector.trim().slice(0, 48)
          : 'Privately Held',
      price: 'Privately Held',
      changePct: valuationText,
      positive: true,
      sparkline: [],
    };
  } catch (err) {
    logGenAICall({
      model,
      prompt,
      config,
      error: err,
    });
    return null;
  }
}

/**
 * Validates whether a user-entered string corresponds to a genuinely existing
 * public stock or verified private company, and returns a live `CompanyPreset`.
 *
 * @param rawInput - Ticker or company name entered by the user
 * @param range - Desired sparkline timeframe (`1M` default)
 * @returns `ValidateFollowResult` (`{ valid: true, preset }` or `{ valid: false, error }`)
 */
export async function validateAndResolveFollowCompany(
  rawInput: string,
  range: WatchlistSparklineRange = APP_CONFIG.watchlist.defaultSparklineRange
): Promise<ValidateFollowResult> {
  logFunctionCall('validateAndResolveFollowCompany', { rawInput, range });

  const trimmed = stripAdrSuffix(rawInput);
  if (!trimmed) {
    return {
      valid: false,
      error: 'Enter a stock ticker (e.g. TSLA) or real company name (e.g. Anthropic).',
    };
  }

  if (
    trimmed.length > 65 ||
    !/[a-zA-Z]/.test(trimmed) ||
    detectSearchQueryIntent(trimmed) === 'cohort'
  ) {
    return {
      valid: false,
      error: `"${trimmed.slice(0, 40)}" looks like a screening phrase or invalid identifier — enter a real company name or stock ticker to follow.`,
    };
  }

  const cacheKey = `${trimmed.toLowerCase()}::${range}`;
  const cached = validationCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  // 1. Check curated private companies fast-path
  const knownPrivate = VERIFIED_PRIVATE_COMPANIES[trimmed.toLowerCase()];
  if (knownPrivate) {
    const res: ValidateFollowResult = {
      valid: true,
      preset: {
        label: knownPrivate.label,
        entityType: 'name',
        value: knownPrivate.label,
        kind: 'private',
        sector: knownPrivate.sector,
        price: 'Privately Held',
        changePct: knownPrivate.valuationLabel,
        positive: true,
        sparkline: [],
      },
    };
    validationCache.set(cacheKey, {
      result: res,
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
    });
    return res;
  }

  // 2. Check verified US-listed public equities via Yahoo Finance
  const publicPreset = await resolveVerifiedPublicPreset(trimmed, range);
  if (publicPreset) {
    const res: ValidateFollowResult = {
      valid: true,
      preset: publicPreset,
    };
    validationCache.set(cacheKey, {
      result: res,
      expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
    });
    return res;
  }

  // 3. Check verified corporate entities in Context.dev `/v1/company/search`
  const contextDevPreset = await resolveViaContextDevStrict(trimmed, range);
  if (contextDevPreset) {
    const res: ValidateFollowResult = {
      valid: true,
      preset: contextDevPreset,
    };
    validationCache.set(cacheKey, {
      result: res,
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
    });
    return res;
  }

  // 4. Final grounded Google Search existence check (catches brand aliases & real startups, rejects gibberish)
  const groundedPreset = await verifyCompanyViaGroundedSearch(trimmed, range);
  if (groundedPreset) {
    const res: ValidateFollowResult = {
      valid: true,
      preset: groundedPreset,
    };
    validationCache.set(cacheKey, {
      result: res,
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
    });
    return res;
  }

  const notFoundResult: ValidateFollowResult = {
    valid: false,
    error: `Cannot follow "${trimmed}" — only US-listed equities, US-traded ADRs, and verified privately held companies are supported.`,
  };

  validationCache.set(cacheKey, {
    result: notFoundResult,
    expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
  });

  return notFoundResult;
}

/**
 * Fast, cached server-side check used by Related Companies and discovery panels
 * to determine whether a suggested company can be followed in Contextual Investing
 * (resolving ADR symbols like `SKHY` for `"SK Hynix"` automatically, and setting
 * `canFollow: false` for foreign-only public stocks without a US ADR so UI surfaces
 * never render a broken `+ Follow` button).
 *
 * @param name - Suggested company name
 * @param tickerHint - Optional US/ADR ticker hint
 * @returns Followability metadata and canonical search identifiers
 */
export async function resolveFollowabilityForSuggestedCompany(
  name: string,
  tickerHint?: string | null
): Promise<{
  canFollow: boolean;
  ticker: string | null;
  entityType: 'ticker' | 'name';
  searchQuery: string;
}> {
  const cleanName = stripAdrSuffix(name);
  const cleanTicker = tickerHint
    ? stripAdrSuffix(tickerHint).toUpperCase() || null
    : null;
  const cacheKey = `${cleanName.toLowerCase()}::${cleanTicker || ''}`;

  const cached = followabilityCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }

  // 1. Curated verified private companies
  const knownPriv =
    VERIFIED_PRIVATE_COMPANIES[cleanName.toLowerCase()] ||
    (cleanTicker
      ? VERIFIED_PRIVATE_COMPANIES[cleanTicker.toLowerCase()]
      : undefined);
  if (knownPriv) {
    const res = {
      canFollow: true,
      ticker: null,
      entityType: 'name' as const,
      searchQuery: knownPriv.label,
    };
    followabilityCache.set(cacheKey, {
      result: res,
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
    });
    return res;
  }

  // 2. Curated US ADR / OTC / brand alias directory (e.g. SK Hynix -> SKHY, Samsung -> SSNLF, Foxconn -> HNHPF)
  const adrHit =
    lookupAdrOrBrandAlias(cleanName) ||
    (cleanTicker ? lookupAdrOrBrandAlias(cleanTicker) : null);
  if (adrHit) {
    const adrPreset = await buildLivePublicPreset(
      adrHit.symbol,
      '1M',
      adrHit.canonicalName,
      adrHit.sector
    );
    if (adrPreset) {
      const res = {
        canFollow: true,
        ticker: adrPreset.value,
        entityType: 'ticker' as const,
        searchQuery: adrPreset.value,
      };
      followabilityCache.set(cacheKey, {
        result: res,
        expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
      });
      return res;
    }
  }

  // 3. Explicit US/ADR ticker hint verified against live Yahoo Finance chart
  if (cleanTicker && /^[A-Z]{1,5}([.-][A-Z]{1,2})?$/.test(cleanTicker)) {
    const pubFromHint = await buildLivePublicPreset(
      cleanTicker,
      '1M',
      cleanName
    );
    if (pubFromHint) {
      const res = {
        canFollow: true,
        ticker: pubFromHint.value,
        entityType: 'ticker' as const,
        searchQuery: pubFromHint.value,
      };
      followabilityCache.set(cacheKey, {
        result: res,
        expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
      });
      return res;
    }
  }

  // 4. Strict Yahoo Finance US/ADR search by company name
  const pubByName = await resolveVerifiedPublicPreset(cleanName, '1M');
  if (pubByName) {
    const res = {
      canFollow: true,
      ticker: pubByName.value,
      entityType: 'ticker' as const,
      searchQuery: pubByName.value,
    };
    followabilityCache.set(cacheKey, {
      result: res,
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
    });
    return res;
  }

  // If Yahoo Finance just confirmed this is a foreign-only public stock with zero US/ADR quotes, mark unfollowable immediately
  if (isKnownForeignOnlyPublic(cleanName)) {
    const unfollowableForeign = {
      canFollow: false,
      ticker: null,
      entityType: 'name' as const,
      searchQuery: cleanName,
    };
    followabilityCache.set(cacheKey, {
      result: unfollowableForeign,
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
    });
    return unfollowableForeign;
  }

  // 5. Strict Context.dev verification (catches genuine private companies; rejects foreign-only public stocks)
  const ctxPreset = await resolveViaContextDevStrict(cleanName, '1M');
  if (ctxPreset) {
    const isTicker = ctxPreset.entityType === 'ticker';
    const res = {
      canFollow: true,
      ticker: isTicker ? ctxPreset.value : null,
      entityType: (isTicker ? 'ticker' : 'name') as 'ticker' | 'name',
      searchQuery: ctxPreset.value,
    };
    followabilityCache.set(cacheKey, {
      result: res,
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
    });
    return res;
  }

  // 6. Unfollowable in current app (e.g. foreign-only stock without a US ADR like MediaTek / Quanta Computer)
  const unfollowableRes = {
    canFollow: false,
    ticker: null,
    entityType: 'name' as const,
    searchQuery: cleanName,
  };
  followabilityCache.set(cacheKey, {
    result: unfollowableRes,
    expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
  });
  return unfollowableRes;
}

/**
 * Hydrates live quotes, period `%` changes, and real historical sparklines for all
 * followed companies over `range` (`1M` default), removes fake sparklines from
 * private companies, and identifies any invalid custom entries for cleanup.
 *
 * @param items - Current list of followed companies from client state / storage
 * @param range - Target sparkline timeframe (`1D`, `5D`, `1M`, `6M`, `1Y`)
 * @returns Hydrated valid `CompanyPreset[]` plus `invalidValues` to prune
 */
export async function hydrateWatchlistPresets(
  items: CompanyPreset[],
  range: WatchlistSparklineRange = APP_CONFIG.watchlist.defaultSparklineRange
): Promise<HydrateWatchlistResult> {
  logFunctionCall('hydrateWatchlistPresets', {
    itemCount: items.length,
    range,
  });

  const bounded = items.slice(0, APP_CONFIG.watchlist.maxFollowedCompanies);
  const invalidValues: string[] = [];

  const resolved = await Promise.all(
    bounded.map(async (item): Promise<CompanyPreset | null> => {
      const rawVal = stripAdrSuffix(item.value || '');
      if (!rawVal) return null;

      // 1. Known private company fast-path (guarantees zero fake sparklines!)
      const knownPriv =
        VERIFIED_PRIVATE_COMPANIES[rawVal.toLowerCase()] ||
        VERIFIED_PRIVATE_COMPANIES[(item.label || '').trim().toLowerCase()];
      if (knownPriv) {
        return {
          label: knownPriv.label,
          entityType: 'name',
          value: knownPriv.label,
          kind: 'private',
          sector: item.sector || knownPriv.sector,
          price: 'Privately Held',
          changePct: knownPriv.valuationLabel,
          positive: true,
          sparkline: [],
        };
      }

      // 2. Known default public preset fast-path
      const defaultPublic = APP_CONFIG.featuredCompanies.find(
        (f) =>
          f.entityType === 'ticker' &&
          f.value.toLowerCase() === rawVal.toLowerCase()
      );
      if (defaultPublic) {
        const live = await buildLivePublicPreset(
          defaultPublic.value,
          range,
          defaultPublic.label,
          defaultPublic.sector
        );
        return (
          live || {
            ...defaultPublic,
            kind: 'public',
            timeframe: range,
          }
        );
      }

      // 3. Custom user-added entry: validate existence AND hydrate live data
      const check = await validateAndResolveFollowCompany(rawVal, range);
      if (!check.valid || !check.preset) {
        invalidValues.push(rawVal);
        return null;
      }

      return check.preset;
    })
  );

  // Deduplicate by lowercase `value` while preserving order
  const seen = new Set<string>();
  const validPresets: CompanyPreset[] = [];
  for (const preset of resolved) {
    if (!preset) continue;
    const key = preset.value.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    validPresets.push(preset);
  }

  return {
    range,
    companies:
      validPresets.length > 0
        ? validPresets
        : [...APP_CONFIG.featuredCompanies],
    invalidValues,
  };
}
