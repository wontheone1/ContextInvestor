/**
 * ============================================================================
 * FILE: lib/context-dev.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Context.dev Official SDK Wrapper Module (`context.dev`).
 *
 * USE CASES:
 * 1. Initializing the official `ContextDev` SDK client using `process.env.CONTEXT_DEV_API_KEY`
 *     strictly on the server side so the API key is never exposed to the browser.
 * 2. Executing company news searches against `POST /v1/news/search` via `client.news.search`
 *    with structured `searchBy` entity identification (`name`, `ticker`, `domain`, or `isin`),
 *    optional `filterBy` (`date` range `from`/`to` in epoch ms, plus one category filter
 *    such as `articleType`, `articleLanguage`, `sourceCountry`, or `sourceDomain`),
 *    `sortBy` (`newest` or `relevance`), `limit`, and cursor-based pagination (`cursor`).
 * 3. Validating `CONTEXT_DEV_API_KEY` presence and providing structured diagnostics
 *    when the key is not yet configured in `.env.local`.
 * ============================================================================
 */

import ContextDev from 'context.dev';
import type {
  NewsSearchParams,
  NewsSearchResponse,
} from 'context.dev/resources/news';
import { APP_CONFIG } from './config.ts';
import { logFunctionCall } from './logger.ts';

export type { NewsSearchParams, NewsSearchResponse };

export type ResolvedEntityLookupType = 'name' | 'ticker' | 'domain' | 'isin';
export type EntityLookupType = 'auto' | ResolvedEntityLookupType;

export interface CompanyNewsQueryInput {
  /** Whether to auto-detect or explicitly identify by name, ticker, domain, or isin */
  entityType: EntityLookupType;
  /** The company name, stock ticker, domain, or ISIN string */
  entityValue: string;
  /** Optional stock exchange when entityType === 'ticker' (e.g. 'NASDAQ', 'NYSE') */
  exchange?: NewsSearchParams.NewsSearchByEntity.NewsSearchEntityByTicker['exchange'];
  /** Optional start of publication date window in epoch milliseconds */
  dateFrom?: number;
  /** Optional end of publication date window in epoch milliseconds */
  dateTo?: number;
  /**
   * Optional category filter. Per Context.dev API spec, at most one category filter
   * (`articleType`, `articleLanguage`, `sourceCountry`, or `sourceDomain`) may be
   * combined with a `date` range in a single request.
   */
  filterCategory?:
    | 'none'
    | 'articleType'
    | 'articleLanguage'
    | 'sourceCountry'
    | 'sourceDomain';
  articleTypes?: Array<
    'editorial' | 'press_release' | 'regulatory_filing' | 'advisory'
  >;
  articleLanguages?: NewsSearchParams.FilterBy['articleLanguage'];
  sourceCountries?: NewsSearchParams.FilterBy['sourceCountry'];
  sourceDomains?: Array<string>;
  /** Sort order: 'newest' or 'relevance' */
  sortBy?: 'newest' | 'relevance';
  /** Number of articles per page (default 10) */
  limit?: number;
  /** Opaque cursor from previous response's `next_cursor` for pagination */
  cursor?: string | null;
}

/**
 * Validates that the `CONTEXT_DEV_API_KEY` environment variable is set and non-empty
 * on the server side. Throws a descriptive error if missing or still set to placeholder.
 *
 * @param customEnvKey - Optional override for testing
 * @returns The validated API key string
 */
export function validateContextDevApiKey(customEnvKey?: string): string {
  logFunctionCall('validateContextDevApiKey', {
    hasCustomKey: Boolean(customEnvKey),
  });

  const rawKey = (
    customEnvKey ??
    process.env[APP_CONFIG.contextDev.envKeyName] ??
    ''
  ).trim();

  if (
    !rawKey ||
    rawKey === 'MY_CONTEXT_DEV_API_KEY' ||
    rawKey === 'YOUR_CONTEXT_DEV_API_KEY'
  ) {
    throw new Error(
      `Missing ${APP_CONFIG.contextDev.envKeyName}. Please set ${APP_CONFIG.contextDev.envKeyName} in .env.local (you can grab a key from ${APP_CONFIG.contextDev.dashboardKeysUrl}).`
    );
  }

  return rawKey;
}

/**
 * Instantiates the official `ContextDev` SDK client using the validated API key.
 *
 * @param options - Optional overrides for custom fetch or API key (used in unit tests)
 * @returns Configured ContextDev SDK client instance
 */
export function createContextDevClient(options?: {
  apiKey?: string;
  fetch?: typeof globalThis.fetch;
  baseURL?: string;
}): ContextDev {
  logFunctionCall('createContextDevClient', {
    hasCustomFetch: Boolean(options?.fetch),
    baseURL: options?.baseURL ?? APP_CONFIG.contextDev.baseUrl,
  });

  const apiKey = validateContextDevApiKey(options?.apiKey);

  return new ContextDev({
    apiKey,
    baseURL: options?.baseURL ?? APP_CONFIG.contextDev.baseUrl,
    ...(options?.fetch ? { fetch: options.fetch } : {}),
  });
}

/**
 * Builds the exact `NewsSearchParams` payload for `POST /v1/news/search`
 * conforming to the official Context.dev SDK schema.
 *
 * Ensures that `searchBy`, `filterBy`, and `sortBy` are deterministically structured
 * so cursor pagination keeps search parameters identical across requests.
 *
 * @param input - Structured company news search input from the application
 * @returns Validated `NewsSearchParams` ready for `client.news.search(params)`
 */
/**
 * Infers the preferred Context.dev entity lookup order (`ticker` vs `name`) when
 * the user searches directly without manually choosing an entity type.
 *
 * - Multi-word, non-ASCII, or >5-char queries (e.g. "Stripe", "OpenAI", "NVIDIA Corp") -> ['name']
 * - Title-case 4+ char words (e.g. "Apple", "Tesla", "Nike") -> ['name', 'ticker']
 * - Uppercase / short / share-class symbols (e.g. "NVDA", "nvda", "JPM", "BRK.B") -> ['ticker', 'name']
 */
export function inferEntitySearchOrder(
  entityValue: string
): Array<'ticker' | 'name'> {
  const trimmed = entityValue.trim();
  const looksLikeTicker = /^[A-Za-z]{1,5}(\.[A-Za-z]{1,2})?$/.test(trimmed);

  if (!looksLikeTicker) {
    return ['name'];
  }

  const isTitleCaseWord = /^[A-Z][a-z]{3,}$/.test(trimmed);
  if (isTitleCaseWord) {
    return ['name', 'ticker'];
  }

  return ['ticker', 'name'];
}

export function buildCompanyNewsSearchParams(
  input: CompanyNewsQueryInput
): NewsSearchParams {
  logFunctionCall('buildCompanyNewsSearchParams', { ...input });

  const trimmedValue = input.entityValue.trim();
  if (!trimmedValue) {
    throw new Error('Company entity value (name or ticker) must not be empty.');
  }

  const effectiveType: ResolvedEntityLookupType =
    input.entityType === 'auto'
      ? inferEntitySearchOrder(trimmedValue)[0]
      : input.entityType;

  let entity: NewsSearchParams.NewsSearchByEntity['entity'];
  switch (effectiveType) {
    case 'ticker':
      entity = {
        type: 'ticker',
        ticker: trimmedValue.toUpperCase(),
        ...(input.exchange ? { exchange: input.exchange } : {}),
      };
      break;
    case 'domain':
      entity = {
        type: 'domain',
        domain: trimmedValue.toLowerCase(),
      };
      break;
    case 'isin':
      entity = {
        type: 'isin',
        isin: trimmedValue.toUpperCase(),
      };
      break;
    case 'name':
    default:
      entity = {
        type: 'name',
        name: trimmedValue,
      };
      break;
  }

  const filterBy: NewsSearchParams.FilterBy = {};

  if (input.dateFrom !== undefined || input.dateTo !== undefined) {
    if (
      input.dateFrom !== undefined &&
      input.dateTo !== undefined &&
      input.dateFrom > input.dateTo
    ) {
      throw new Error(
        'Invalid date range: date.from must be before or equal to date.to.'
      );
    }
    filterBy.date = {
      ...(input.dateFrom !== undefined ? { from: input.dateFrom } : {}),
      ...(input.dateTo !== undefined ? { to: input.dateTo } : {}),
    };
  }

  // Context.dev rule: Use at most one of sourceDomain, sourceCountry, articleLanguage, or articleType
  if (
    input.filterCategory === 'articleType' &&
    input.articleTypes &&
    input.articleTypes.length > 0
  ) {
    filterBy.articleType = input.articleTypes.slice(0, 3);
  } else if (
    input.filterCategory === 'articleLanguage' &&
    input.articleLanguages &&
    input.articleLanguages.length > 0
  ) {
    filterBy.articleLanguage = input.articleLanguages.slice(0, 3);
  } else if (
    input.filterCategory === 'sourceCountry' &&
    input.sourceCountries &&
    input.sourceCountries.length > 0
  ) {
    filterBy.sourceCountry = input.sourceCountries.slice(0, 3);
  } else if (
    input.filterCategory === 'sourceDomain' &&
    input.sourceDomains &&
    input.sourceDomains.length > 0
  ) {
    filterBy.sourceDomain = input.sourceDomains
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 3);
  }

  const hasFilters = Object.keys(filterBy).length > 0;

  const params: NewsSearchParams = {
    searchBy: {
      type: 'entity',
      entity,
    },
    ...(hasFilters ? { filterBy } : {}),
    sortBy: {
      type: input.sortBy ?? APP_CONFIG.contextDev.defaultSort,
    },
    limit: input.limit ?? APP_CONFIG.contextDev.defaultLimit,
    ...(input.cursor ? { cursor: input.cursor } : {}),
  };

  return params;
}

/**
 * Executes a company news search using the official Context.dev SDK (`client.news.search`)
 * which calls `POST https://api.context.dev/v1/news/search`.
 *
 * @param input - CompanyNewsQueryInput parameters
 * @param clientOverrides - Optional SDK client overrides for unit testing without live network calls
 * @returns Promise resolving to the official `NewsSearchResponse`
 */
async function executeSingleEntityTypeSearch(
  client: ContextDev,
  input: Omit<CompanyNewsQueryInput, 'entityType'> & {
    entityType: ResolvedEntityLookupType;
  }
): Promise<{
  response: NewsSearchResponse;
  requestPayload: NewsSearchParams;
  resolvedEntityType: ResolvedEntityLookupType;
  resolvedExchange?: NewsSearchParams.NewsSearchByEntity.NewsSearchEntityByTicker['exchange'];
}> {
  const requestPayload = buildCompanyNewsSearchParams(input);

  const shouldTryUsExchangeResolution =
    input.entityType === 'ticker' && !input.exchange && !input.cursor;

  let primaryResponse: NewsSearchResponse | null = null;
  let primaryError: unknown = null;

  try {
    primaryResponse = await client.news.search(requestPayload);
  } catch (err) {
    primaryError = err;
  }

  if (
    primaryResponse &&
    (!shouldTryUsExchangeResolution ||
      (primaryResponse.data && primaryResponse.data.length > 0))
  ) {
    return {
      response: primaryResponse,
      requestPayload,
      resolvedEntityType: input.entityType,
    };
  }

  const errMessage =
    primaryError instanceof Error
      ? primaryError.message
      : primaryError
        ? String(primaryError)
        : '';

  const canResolveAcrossUsExchanges =
    shouldTryUsExchangeResolution &&
    ((primaryResponse !== null &&
      (!primaryResponse.data || primaryResponse.data.length === 0) &&
      (!input.filterCategory || input.filterCategory === 'none')) ||
      (primaryError !== null &&
        /exchange|ambiguous|multiple|disambiguat|not found|unknown|404|400|422/i.test(
          errMessage
        )));

  if (canResolveAcrossUsExchanges) {
    let firstSuccessfulEmpty: {
      response: NewsSearchResponse;
      requestPayload: NewsSearchParams;
      resolvedEntityType: ResolvedEntityLookupType;
      resolvedExchange: NewsSearchParams.NewsSearchByEntity.NewsSearchEntityByTicker['exchange'];
    } | null = null;

    for (const usExchange of APP_CONFIG.contextDev.usExchanges) {
      const candidatePayload = buildCompanyNewsSearchParams({
        ...input,
        exchange: usExchange,
      });

      try {
        const candidateResponse = await client.news.search(candidatePayload);
        if (candidateResponse.data && candidateResponse.data.length > 0) {
          logFunctionCall('searchCompanyNews:resolved_us_exchange', {
            ticker: input.entityValue,
            resolvedExchange: usExchange,
            articleCount: candidateResponse.data.length,
          });
          return {
            response: candidateResponse,
            requestPayload: candidatePayload,
            resolvedEntityType: 'ticker',
            resolvedExchange: usExchange,
          };
        }

        if (!firstSuccessfulEmpty) {
          firstSuccessfulEmpty = {
            response: candidateResponse,
            requestPayload: candidatePayload,
            resolvedEntityType: 'ticker',
            resolvedExchange: usExchange,
          };
        }
      } catch {
        // Continue checking remaining US exchanges
      }
    }

    if (firstSuccessfulEmpty) {
      return firstSuccessfulEmpty;
    }
  }

  if (primaryResponse) {
    return {
      response: primaryResponse,
      requestPayload,
      resolvedEntityType: input.entityType,
    };
  }

  throw primaryError;
}

/**
 * Executes a company news search using the official Context.dev SDK (`client.news.search`)
 * which calls `POST https://api.context.dev/v1/news/search`.
 *
 * When `entityType === 'auto'`, automatically resolves whether the query is a US stock ticker
 * or a company name without requiring manual mode selection.
 *
 * @param input - CompanyNewsQueryInput parameters
 * @param clientOverrides - Optional SDK client overrides for unit testing without live network calls
 * @returns Promise resolving to the official `NewsSearchResponse`
 */
export async function searchCompanyNews(
  input: CompanyNewsQueryInput,
  clientOverrides?: {
    apiKey?: string;
    fetch?: typeof globalThis.fetch;
    baseURL?: string;
  }
): Promise<{
  response: NewsSearchResponse;
  requestPayload: NewsSearchParams;
  resolvedEntityType: ResolvedEntityLookupType;
  resolvedExchange?: NewsSearchParams.NewsSearchByEntity.NewsSearchEntityByTicker['exchange'];
}> {
  logFunctionCall('searchCompanyNews', { ...input });

  const client = createContextDevClient(clientOverrides);

  if (input.entityType !== 'auto') {
    const result = await executeSingleEntityTypeSearch(client, {
      ...input,
      entityType: input.entityType,
    });
    logFunctionCall('searchCompanyNews:completed', {
      requestId: result.response.request_id,
      articleCount: result.response.data?.length ?? 0,
      hasMore: result.response.has_more,
      nextCursor: result.response.next_cursor,
      creditsConsumed: result.response.key_metadata?.credits_consumed,
      resolvedEntityType: result.resolvedEntityType,
      resolvedExchange: result.resolvedExchange,
    });
    return result;
  }

  const candidateOrder = inferEntitySearchOrder(input.entityValue);
  let primaryResult: {
    response: NewsSearchResponse;
    requestPayload: NewsSearchParams;
    resolvedEntityType: ResolvedEntityLookupType;
    resolvedExchange?: NewsSearchParams.NewsSearchByEntity.NewsSearchEntityByTicker['exchange'];
  } | null = null;
  let primaryError: unknown = null;

  try {
    primaryResult = await executeSingleEntityTypeSearch(client, {
      ...input,
      entityType: candidateOrder[0],
      exchange: candidateOrder[0] === 'ticker' ? input.exchange : undefined,
    });
  } catch (err) {
    primaryError = err;
  }

  if (
    primaryResult &&
    ((primaryResult.response.data && primaryResult.response.data.length > 0) ||
      candidateOrder.length === 1 ||
      Boolean(input.cursor))
  ) {
    logFunctionCall('searchCompanyNews:completed', {
      requestId: primaryResult.response.request_id,
      articleCount: primaryResult.response.data?.length ?? 0,
      resolvedEntityType: primaryResult.resolvedEntityType,
      resolvedExchange: primaryResult.resolvedExchange,
    });
    return primaryResult;
  }

  // Fallback to secondary candidate type (e.g., ticker -> name or name -> ticker)
  if (candidateOrder.length > 1) {
    try {
      const secondaryResult = await executeSingleEntityTypeSearch(client, {
        ...input,
        entityType: candidateOrder[1],
        exchange: undefined,
      });

      if (
        secondaryResult.response.data &&
        secondaryResult.response.data.length > 0
      ) {
        logFunctionCall('searchCompanyNews:auto_fallback_completed', {
          query: input.entityValue,
          resolvedEntityType: secondaryResult.resolvedEntityType,
          articleCount: secondaryResult.response.data.length,
        });
        return secondaryResult;
      }

      if (!primaryResult) {
        return secondaryResult;
      }
    } catch {
      // Ignore secondary error if primary had a valid empty response
    }
  }

  if (primaryResult) {
    return primaryResult;
  }

  throw primaryError;
}
