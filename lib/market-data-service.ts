/**
 * ============================================================================
 * FILE: lib/market-data-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Market Price History & Key Investment Metrics Service.
 *
 * USE CASES:
 * 1. Resolving a searched company name or US stock ticker to a US-listed
 *    equity symbol (`v1/finance/search` + `v8/finance/chart`) without exposing
 *    external provider details to the browser.
 * 2. Fetching interactive historical price & volume series across selectable
 *    timeframes (`1D`, `5D`, `1M`, `6M`, `YTD`, `1Y`, `5Y`) and institutional
 *    financial fundamentals (`Market Cap`, `P/E`, `EPS`, `ROE`, `Margins`, etc.).
 * 3. Providing grounded private-company investment metrics via Gemini Search
 *    grounding when the searched company is privately held (e.g., Stripe, OpenAI).
 * ============================================================================
 */

import { GoogleGenAI } from '@google/genai';
import {
  isAdrTicker,
  lookupAdrOrBrandAlias,
  rankUsAndAdrEquityQuotes,
  stripAdrSuffix,
} from './adr-directory';
import { APP_CONFIG } from './config';
import { logFunctionCall, logGenAICall } from './logger';

export type ChartRange = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y';

export interface PriceChartPoint {
  timestamp: number;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
}

export interface KeyInvestmentMetrics {
  marketCap: string | null;
  enterpriseValue: string | null;
  trailingPE: string | null;
  forwardPE: string | null;
  priceToBook: string | null;
  trailingEps: string | null;
  dividendYield: string | null;
  beta: string | null;
  totalRevenue: string | null;
  revenueGrowth: string | null;
  profitMargins: string | null;
  operatingMargins: string | null;
  returnOnEquity: string | null;
  targetMeanPrice: string | null;
  volume: string | null;
  averageVolume: string | null;
  dayLow: number | null;
  dayHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
}

export interface PublicCompanyMarketOverview {
  kind: 'public';
  canFollow: boolean;
  isAdr?: boolean;
  query: string;
  symbol: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  currency: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  range: ChartRange;
  points: PriceChartPoint[];
  metrics: KeyInvestmentMetrics;
}

export interface PrivateCompanyMarketOverview {
  kind: 'private';
  canFollow: boolean;
  listingNote?: string | null;
  query: string;
  companyName: string;
  sector: string | null;
  latestValuation: string | null;
  totalFunding: string | null;
  lastRound: string | null;
  estimatedRevenue: string | null;
  headquarters: string | null;
  ceo: string | null;
  summary: string;
  sources: Array<{ title: string; uri: string }>;
}

export type CompanyMarketOverviewData =
  | PublicCompanyMarketOverview
  | PrivateCompanyMarketOverview;

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

const US_EXCHANGE_CODES = new Set([
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

const RANGE_MAP: Record<ChartRange, { range: string; interval: string }> = {
  '1D': { range: '1d', interval: '5m' },
  '5D': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  YTD: { range: 'ytd', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
  '5Y': { range: '5y', interval: '1wk' },
};

const KNOWN_PRIVATE_COMPANIES = new Set([
  'stripe',
  'openai',
  'spacex',
  'anthropic',
  'databricks',
  'canva',
  'bytedance',
  'shein',
  'revolut',
  'chime',
  'plaid',
  'anduril',
  'anduril industries',
  'scale ai',
  'perplexity',
  'perplexity ai',
  'xai',
  'deepseek',
  'figma',
  'discord',
  'epic games',
  'ramp',
  'rippling',
  'deel',
  'mistral',
  'mistral ai',
  'cohere',
  'waymo',
  'klarna',
]);

// Short-lived in-memory caches on server
let cachedYahooAuth: { cookie: string; crumb: string; expiresAt: number } | null =
  null;
const privateOverviewCache = new Map<
  string,
  { data: PrivateCompanyMarketOverview; expiresAt: number }
>();

/**
 * Formats compact large numbers when Yahoo's `fmt` string is unavailable.
 */
function formatCompactNumber(val: number | null | undefined): string | null {
  if (typeof val !== 'number' || Number.isNaN(val) || val === 0) return null;
  const abs = Math.abs(val);
  if (abs >= 1e12) return `${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toFixed(2);
}

/**
 * Normalizes a ticker symbol for Yahoo Finance (e.g. BRK.B -> BRK-B).
 */
function normalizeYahooSymbol(raw: string): string {
  return stripAdrSuffix(raw).toUpperCase().replace(/\./g, '-');
}

/**
 * Checks whether a Yahoo Finance search quote represents a US-listed equity.
 */
function isUsEquityQuote(quote: Record<string, unknown>): boolean {
  const quoteType = String(quote.quoteType ?? '');
  const exchange = String(quote.exchange ?? '').toUpperCase();
  const exchDisp = String(quote.exchDisp ?? '').toUpperCase();
  const symbol = String(quote.symbol ?? '').toUpperCase();

  if (quoteType !== 'EQUITY') return false;
  // Reject foreign-suffix tickers like NVDA.TO or MSFT.DE
  if (symbol.includes('.')) return false;

  if (US_EXCHANGE_CODES.has(exchange)) return true;
  if (/NASDAQ|NYSE|AMEX|CBOE|BATS|OTC/i.test(exchDisp)) return true;
  return false;
}

/**
 * Obtains and caches a Yahoo Finance session cookie + crumb for quoteSummary calls.
 */
async function getYahooAuth(
  forceRefresh = false
): Promise<{ cookie: string; crumb: string } | null> {
  if (
    !forceRefresh &&
    cachedYahooAuth &&
    Date.now() < cachedYahooAuth.expiresAt
  ) {
    return { cookie: cachedYahooAuth.cookie, crumb: cachedYahooAuth.crumb };
  }

  try {
    const fcRes = await fetch('https://fc.yahoo.com', {
      headers: {
        'User-Agent': YAHOO_HEADERS['User-Agent'],
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(6000),
    });
    const setCookie = fcRes.headers.get('set-cookie') || '';
    const cookie = setCookie.split(';')[0] || '';
    if (!cookie) return null;

    const crumbRes = await fetch(
      'https://query1.finance.yahoo.com/v1/test/getcrumb',
      {
        headers: {
          'User-Agent': YAHOO_HEADERS['User-Agent'],
          Accept: '*/*',
          Cookie: cookie,
        },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb) return null;

    cachedYahooAuth = {
      cookie,
      crumb,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    return { cookie, crumb };
  } catch {
    return null;
  }
}

/**
 * Resolves a company name or ticker query into a US-listed equity symbol and name.
 * Returns null if the entity appears to be privately held or not found on US exchanges.
 */
async function resolveUsEquitySymbol(
  query: string,
  entityType: 'auto' | 'name' | 'ticker' = 'auto'
): Promise<{ symbol: string; shortName: string } | null> {
  const trimmed = stripAdrSuffix(query);
  if (!trimmed) return null;

  if (KNOWN_PRIVATE_COMPANIES.has(trimmed.toLowerCase())) {
    return null;
  }

  // Fast-path resolution for US ADRs, US OTC international leaders, and brand aliases (e.g. "SK Hynix" -> SKHY)
  const adrAlias = lookupAdrOrBrandAlias(trimmed);
  if (adrAlias) {
    return {
      symbol: adrAlias.symbol,
      shortName: adrAlias.canonicalName,
    };
  }

  const normalizedUpper = normalizeYahooSymbol(trimmed);
  const looksLikeSymbol = /^[A-Z]{1,5}(-[A-Z]{1,2})?$/.test(normalizedUpper);

  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      trimmed
    )}&quotesCount=10&newsCount=0&enableFuzzyQuery=false`;
    const res = await fetch(searchUrl, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        quotes?: Array<Record<string, unknown>>;
      };
      const usEquities = rankUsAndAdrEquityQuotes(
        (json.quotes ?? []).filter(isUsEquityQuote)
      );

      // 1. Exact ticker match
      const exactTicker = usEquities.find(
        (q) => String(q.symbol ?? '').toUpperCase() === normalizedUpper
      );
      if (exactTicker) {
        return {
          symbol: String(exactTicker.symbol).toUpperCase(),
          shortName: String(
            exactTicker.longname || exactTicker.shortname || normalizedUpper
          ),
        };
      }

      // 2. Company name / ADR name match (preserving short prefixes like "SK", "LG", "JD", "3M")
      const lowerQuery = trimmed.toLowerCase();
      const queryTokens = lowerQuery
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

      const nameMatch = usEquities.find((q) => {
        const candidateName = `${String(q.longname ?? '')} ${String(
          q.shortname ?? ''
        )}`
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ');
        if (candidateName.includes(lowerQuery)) return true;
        const candidateWords = candidateName.split(/\s+/).filter(Boolean);
        return (
          queryTokens.length > 0 &&
          queryTokens.every((tok) => candidateWords.includes(tok))
        );
      });

      if (nameMatch) {
        return {
          symbol: String(nameMatch.symbol).toUpperCase(),
          shortName: String(
            nameMatch.longname || nameMatch.shortname || nameMatch.symbol
          ),
        };
      }

      // If it was explicitly a ticker search or very ticker-like and US equities matched, pick top if symbol closely matches
      if ((entityType === 'ticker' || looksLikeSymbol) && usEquities.length > 0) {
        const first = usEquities[0];
        if (
          String(first.symbol ?? '').toUpperCase().startsWith(normalizedUpper)
        ) {
          return {
            symbol: String(first.symbol).toUpperCase(),
            shortName: String(
              first.longname || first.shortname || first.symbol
            ),
          };
        }
      }
    }
  } catch {
    // Fall through to direct chart probe for ticker-like strings
  }

  // Fallback direct chart check ONLY when input is clearly a ticker format
  if (
    entityType === 'ticker' ||
    (/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(trimmed) &&
      trimmed === trimmed.toUpperCase())
  ) {
    return {
      symbol: normalizedUpper,
      shortName: normalizedUpper,
    };
  }

  return null;
}

/**
 * Fetches OHLCV chart series and chart metadata from Yahoo Finance v8 chart API.
 */
export async function fetchChartData(
  symbol: string,
  rangeKey: ChartRange = '1M'
): Promise<{
  points: PriceChartPoint[];
  price: number;
  previousClose: number;
  companyName: string;
  currency: string;
  dayLow: number | null;
  dayHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  regularMarketVolume: number | null;
} | null> {
  const cfg = RANGE_MAP[rangeKey] ?? RANGE_MAP['1M'];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: Record<string, unknown>;
          timestamp?: number[];
          indicators?: {
            quote?: Array<{
              open?: Array<number | null>;
              high?: Array<number | null>;
              low?: Array<number | null>;
              close?: Array<number | null>;
              volume?: Array<number | null>;
            }>;
          };
        }>;
      };
    };

    const result = json.chart?.result?.[0];
    if (!result || !result.meta) return null;

    const meta = result.meta;
    const instrumentType = String(meta.instrumentType ?? '').toUpperCase();
    const exchangeName = String(meta.exchangeName ?? '').toUpperCase();
    if (
      instrumentType &&
      instrumentType !== 'EQUITY' &&
      instrumentType !== 'ETF'
    ) {
      return null;
    }
    if (exchangeName && !US_EXCHANGE_CODES.has(exchangeName)) {
      return null;
    }

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens = quote.open ?? [];
    const highs = quote.high ?? [];
    const lows = quote.low ?? [];
    const closes = quote.close ?? [];
    const volumes = quote.volume ?? [];

    const points: PriceChartPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const closeVal = closes[i];
      if (typeof closeVal === 'number' && !Number.isNaN(closeVal)) {
        points.push({
          timestamp: timestamps[i] * 1000,
          open: typeof opens[i] === 'number' ? opens[i] : null,
          high: typeof highs[i] === 'number' ? highs[i] : null,
          low: typeof lows[i] === 'number' ? lows[i] : null,
          close: closeVal,
          volume: typeof volumes[i] === 'number' ? volumes[i] : null,
        });
      }
    }

    if (points.length === 0) return null;

    const currentPrice =
      typeof meta.regularMarketPrice === 'number'
        ? meta.regularMarketPrice
        : points[points.length - 1].close;
    const prevClose =
      typeof meta.chartPreviousClose === 'number'
        ? meta.chartPreviousClose
        : typeof meta.previousClose === 'number'
          ? meta.previousClose
          : points[0].close;

    return {
      points,
      price: currentPrice,
      previousClose: prevClose,
      companyName: String(meta.longName || meta.shortName || symbol),
      currency: String(meta.currency || 'USD'),
      dayLow:
        typeof meta.regularMarketDayLow === 'number'
          ? meta.regularMarketDayLow
          : null,
      dayHigh:
        typeof meta.regularMarketDayHigh === 'number'
          ? meta.regularMarketDayHigh
          : null,
      fiftyTwoWeekLow:
        typeof meta.fiftyTwoWeekLow === 'number' ? meta.fiftyTwoWeekLow : null,
      fiftyTwoWeekHigh:
        typeof meta.fiftyTwoWeekHigh === 'number'
          ? meta.fiftyTwoWeekHigh
          : null,
      regularMarketVolume:
        typeof meta.regularMarketVolume === 'number'
          ? meta.regularMarketVolume
          : null,
    };
  } catch {
    return null;
  }
}

interface QuoteSummaryResult {
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  price: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  metrics: Partial<KeyInvestmentMetrics>;
}

/**
 * Fetches detailed valuation, profitability, and consensus metrics via Yahoo quoteSummary.
 */
async function fetchQuoteSummaryMetrics(
  symbol: string
): Promise<QuoteSummaryResult | null> {
  const attemptFetch = async (
    auth: { cookie: string; crumb: string } | null
  ): Promise<Response | null> => {
    if (!auth) return null;
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?modules=price,summaryDetail,defaultKeyStatistics,financialData,assetProfile&crumb=${encodeURIComponent(
      auth.crumb
    )}`;
    return fetch(url, {
      headers: {
        ...YAHOO_HEADERS,
        Cookie: auth.cookie,
      },
      signal: AbortSignal.timeout(7000),
    });
  };

  try {
    let auth = await getYahooAuth(false);
    let res = await attemptFetch(auth);

    if (res && (res.status === 401 || res.status === 403)) {
      auth = await getYahooAuth(true);
      res = await attemptFetch(auth);
    }

    if (!res || !res.ok) return null;

    const json = (await res.json()) as {
      quoteSummary?: {
        result?: Array<{
          price?: Record<string, { raw?: number; fmt?: string } | string>;
          summaryDetail?: Record<string, { raw?: number; fmt?: string }>;
          defaultKeyStatistics?: Record<string, { raw?: number; fmt?: string }>;
          financialData?: Record<string, { raw?: number; fmt?: string }>;
          assetProfile?: Record<string, string>;
        }>;
      };
    };

    const r = json.quoteSummary?.result?.[0];
    if (!r) return null;

    const fmtField = (
      obj: Record<string, { raw?: number; fmt?: string } | unknown> | undefined,
      key: string
    ): string | null => {
      const entry = obj?.[key] as { raw?: number; fmt?: string } | undefined;
      if (!entry) return null;
      if (typeof entry.fmt === 'string' && entry.fmt.trim()) return entry.fmt;
      if (typeof entry.raw === 'number' && !Number.isNaN(entry.raw)) {
        return String(entry.raw);
      }
      return null;
    };

    const rawField = (
      obj: Record<string, { raw?: number; fmt?: string } | unknown> | undefined,
      key: string
    ): number | null => {
      const entry = obj?.[key] as { raw?: number } | undefined;
      return typeof entry?.raw === 'number' && !Number.isNaN(entry.raw)
        ? entry.raw
        : null;
    };

    const priceObj = r.price;
    const shortName =
      typeof priceObj?.longName === 'string'
        ? priceObj.longName
        : typeof priceObj?.shortName === 'string'
          ? priceObj.shortName
          : null;

    return {
      companyName: shortName,
      sector: r.assetProfile?.sector ?? null,
      industry: r.assetProfile?.industry ?? null,
      price: rawField(priceObj, 'regularMarketPrice'),
      previousClose: rawField(priceObj, 'regularMarketPreviousClose'),
      change: rawField(priceObj, 'regularMarketChange'),
      changePercent: rawField(priceObj, 'regularMarketChangePercent'),
      metrics: {
        marketCap: fmtField(priceObj, 'marketCap'),
        enterpriseValue: fmtField(r.defaultKeyStatistics, 'enterpriseValue'),
        trailingPE: fmtField(r.summaryDetail, 'trailingPE'),
        forwardPE: fmtField(r.summaryDetail, 'forwardPE'),
        priceToBook: fmtField(r.defaultKeyStatistics, 'priceToBook'),
        trailingEps: fmtField(r.defaultKeyStatistics, 'trailingEps'),
        dividendYield: fmtField(r.summaryDetail, 'dividendYield'),
        beta: fmtField(r.summaryDetail, 'beta'),
        totalRevenue: fmtField(r.financialData, 'totalRevenue'),
        revenueGrowth: fmtField(r.financialData, 'revenueGrowth'),
        profitMargins: fmtField(r.financialData, 'profitMargins'),
        operatingMargins: fmtField(r.financialData, 'operatingMargins'),
        returnOnEquity: fmtField(r.financialData, 'returnOnEquity'),
        targetMeanPrice: fmtField(r.financialData, 'targetMeanPrice'),
        volume: fmtField(r.summaryDetail, 'volume'),
        averageVolume: fmtField(r.summaryDetail, 'averageVolume'),
        dayLow: rawField(r.summaryDetail, 'dayLow'),
        dayHigh: rawField(r.summaryDetail, 'dayHigh'),
        fiftyTwoWeekLow: rawField(r.summaryDetail, 'fiftyTwoWeekLow'),
        fiftyTwoWeekHigh: rawField(r.summaryDetail, 'fiftyTwoWeekHigh'),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Uses Gemini with Google Search grounding to retrieve latest private-company
 * investment metrics when no public US ticker exists.
 */
async function fetchPrivateCompanyMetrics(
  companyName: string
): Promise<{
  overview: PrivateCompanyMarketOverview;
  discoveredUsAdrTicker: string | null;
}> {
  const cacheKey = companyName.trim().toLowerCase();
  const isKnownPrivate = KNOWN_PRIVATE_COMPANIES.has(cacheKey);
  const cached = privateOverviewCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return { overview: cached.data, discoveredUsAdrTicker: null };
  }

  const fallback: PrivateCompanyMarketOverview = {
    kind: 'private',
    canFollow: isKnownPrivate,
    listingNote: isKnownPrivate ? 'Privately Held' : 'Unlisted / Non-US Entity',
    query: companyName,
    companyName,
    sector: null,
    latestValuation: null,
    totalFunding: null,
    lastRound: null,
    estimatedRevenue: null,
    headquarters: null,
    ceo: null,
    summary:
      'Privately held or non-US-listed entity. Public exchange price charts and trading multiples are available for US-listed and US ADR stocks.',
    sources: [],
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return { overview: fallback, discoveredUsAdrTicker: null };
  }

  const model = APP_CONFIG.gemini.defaultModel;
  const prompt = `Look up the latest verified corporate & market listing facts for "${companyName}".
Determine its exact status:
- "public_us_or_adr": publicly traded AND has a US stock listing or US ADR / US OTC ticker (e.g. TSM, ASML, SKHY, SSNLF, TELWY, IFNNY, HNHPF, SFTBY, TCEHY, BYDDY, NTDOY). Provide that US/ADR symbol in "usAdrTicker".
- "public_foreign_only": publicly traded ONLY on non-US exchanges with NO US listing and NO US ADR (e.g. MediaTek 2454.TW, Quanta Computer 2382.TW, Saudi Aramco 2222.SR). Set "usAdrTicker": null.
- "private": genuinely privately held operating company or startup (e.g. Stripe, OpenAI, SpaceX, Anthropic, Databricks, Anduril). Set "usAdrTicker": null.
- "non_existent": gibberish, random letters, or not a real company.

Return ONLY a valid JSON object (no markdown commentary outside JSON) with these exact keys:
{
  "entityStatus": "public_us_or_adr" | "public_foreign_only" | "private" | "non_existent",
  "usAdrTicker": string | null,
  "companyName": string,
  "sector": string | null,
  "latestValuation": string | null (e.g. "$157B (Oct 2024)" or "$70B"),
  "totalFunding": string | null,
  "lastRound": string | null (e.g. "$6.6B Venture Round"),
  "estimatedRevenue": string | null (e.g. "$3.7B est. ARR"),
  "headquarters": string | null,
  "ceo": string | null,
  "summary": string (1-2 concise institutional sentences about the company's business and market status)
}
If a figure is unknown or uncertain, set it to null. Never invent numbers.`;

  const config = {
    tools: [{ googleSearch: {} }],
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

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch
      ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>)
      : {};

    const entityStatus = String(parsed.entityStatus ?? '').toLowerCase();
    const rawAdr =
      typeof parsed.usAdrTicker === 'string' &&
      /^[A-Za-z]{1,5}([.-][A-Za-z]{1,2})?$/.test(parsed.usAdrTicker.trim())
        ? normalizeYahooSymbol(parsed.usAdrTicker.trim())
        : null;

    const chunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    const sources: Array<{ title: string; uri: string }> = [];
    for (const chunk of chunks) {
      const web = (chunk as { web?: { uri?: string; title?: string } }).web;
      if (web?.uri && web?.title && sources.length < 3) {
        sources.push({ title: web.title, uri: web.uri });
      }
    }

    const isVerifiedPrivate =
      isKnownPrivate || (entityStatus === 'private' && chunks.length > 0);
    const listingNote = isVerifiedPrivate
      ? 'Privately Held'
      : entityStatus === 'public_foreign_only'
        ? 'Foreign-Listed Public Equity · No US ADR'
        : 'Unverified Entity';

    const result: PrivateCompanyMarketOverview = {
      kind: 'private',
      canFollow: isVerifiedPrivate,
      listingNote,
      query: companyName,
      companyName:
        typeof parsed.companyName === 'string' && parsed.companyName.trim()
          ? parsed.companyName.trim()
          : companyName,
      sector: typeof parsed.sector === 'string' ? parsed.sector : null,
      latestValuation:
        typeof parsed.latestValuation === 'string'
          ? parsed.latestValuation
          : null,
      totalFunding:
        typeof parsed.totalFunding === 'string' ? parsed.totalFunding : null,
      lastRound: typeof parsed.lastRound === 'string' ? parsed.lastRound : null,
      estimatedRevenue:
        typeof parsed.estimatedRevenue === 'string'
          ? parsed.estimatedRevenue
          : null,
      headquarters:
        typeof parsed.headquarters === 'string' ? parsed.headquarters : null,
      ceo: typeof parsed.ceo === 'string' ? parsed.ceo : null,
      summary:
        typeof parsed.summary === 'string' && parsed.summary.trim()
          ? parsed.summary.trim()
          : fallback.summary,
      sources,
    };

    if (!rawAdr) {
      privateOverviewCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
    }
    return { overview: result, discoveredUsAdrTicker: rawAdr };
  } catch (err) {
    logGenAICall({ model, prompt, config, error: err });
    return { overview: fallback, discoveredUsAdrTicker: null };
  }
}

/**
 * Fetches full price chart & key investment metrics for any searched company.
 */
export async function getCompanyMarketOverview(options: {
  query: string;
  entityType?: 'auto' | 'name' | 'ticker';
  range?: ChartRange;
}): Promise<CompanyMarketOverviewData> {
  const query = stripAdrSuffix(options.query);
  const range: ChartRange =
    options.range && options.range in RANGE_MAP ? options.range : '1M';

  logFunctionCall('getCompanyMarketOverview', {
    query,
    entityType: options.entityType ?? 'auto',
    range,
  });

  let resolved = await resolveUsEquitySymbol(
    query,
    options.entityType ?? 'auto'
  );
  let fallbackPrivate: PrivateCompanyMarketOverview | null = null;

  if (!resolved) {
    const privateLookup = await fetchPrivateCompanyMetrics(query);
    if (privateLookup.discoveredUsAdrTicker) {
      resolved = {
        symbol: privateLookup.discoveredUsAdrTicker,
        shortName: privateLookup.overview.companyName || query,
      };
      fallbackPrivate = privateLookup.overview;
    } else {
      return privateLookup.overview;
    }
  }

  const [chart, summary] = await Promise.all([
    fetchChartData(resolved.symbol, range),
    fetchQuoteSummaryMetrics(resolved.symbol),
  ]);

  if (!chart) {
    if (fallbackPrivate) {
      return fallbackPrivate;
    }
    const privateLookup = await fetchPrivateCompanyMetrics(query);
    return privateLookup.overview;
  }

  const price = summary?.price ?? chart.price;
  const firstPointClose = chart.points[0]?.close ?? chart.previousClose;
  // For 1D, compare against previousClose; for multi-day ranges, compare against period start
  const baseline =
    range === '1D'
      ? summary?.previousClose ?? chart.previousClose
      : firstPointClose;
  const change =
    range === '1D' && typeof summary?.change === 'number'
      ? summary.change
      : price - baseline;
  const changePercent =
    range === '1D' && typeof summary?.changePercent === 'number'
      ? summary.changePercent * 100
      : baseline > 0
        ? (change / baseline) * 100
        : 0;

  const resolvedCompanyName =
    summary?.companyName || chart.companyName || resolved.shortName;
  const isAdr = isAdrTicker(
    resolved.symbol,
    `${resolvedCompanyName} ${chart.companyName || ''} ${resolved.shortName || ''}`
  );

  return {
    kind: 'public',
    canFollow: true,
    isAdr,
    query,
    symbol: resolved.symbol,
    companyName: resolvedCompanyName,
    sector: summary?.sector ?? null,
    industry: summary?.industry ?? null,
    currency: chart.currency || 'USD',
    price,
    previousClose: baseline,
    change,
    changePercent,
    range,
    points: chart.points,
    metrics: {
      marketCap: summary?.metrics.marketCap ?? null,
      enterpriseValue: summary?.metrics.enterpriseValue ?? null,
      trailingPE: summary?.metrics.trailingPE ?? null,
      forwardPE: summary?.metrics.forwardPE ?? null,
      priceToBook: summary?.metrics.priceToBook ?? null,
      trailingEps: summary?.metrics.trailingEps ?? null,
      dividendYield: summary?.metrics.dividendYield ?? null,
      beta: summary?.metrics.beta ?? null,
      totalRevenue: summary?.metrics.totalRevenue ?? null,
      revenueGrowth: summary?.metrics.revenueGrowth ?? null,
      profitMargins: summary?.metrics.profitMargins ?? null,
      operatingMargins: summary?.metrics.operatingMargins ?? null,
      returnOnEquity: summary?.metrics.returnOnEquity ?? null,
      targetMeanPrice: summary?.metrics.targetMeanPrice ?? null,
      volume:
        summary?.metrics.volume ??
        formatCompactNumber(chart.regularMarketVolume),
      averageVolume: summary?.metrics.averageVolume ?? null,
      dayLow: summary?.metrics.dayLow ?? chart.dayLow,
      dayHigh: summary?.metrics.dayHigh ?? chart.dayHigh,
      fiftyTwoWeekLow:
        summary?.metrics.fiftyTwoWeekLow ?? chart.fiftyTwoWeekLow,
      fiftyTwoWeekHigh:
        summary?.metrics.fiftyTwoWeekHigh ?? chart.fiftyTwoWeekHigh,
    },
  };
}
