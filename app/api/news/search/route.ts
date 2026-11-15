/**
 * ============================================================================
 * FILE: app/api/news/search/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Next.js API Route for Company News Search via Context.dev SDK.
 *
 * USE CASES:
 * 1. Receiving structured company search requests from the frontend dashboard
 *    (`entityType` = 'name' | 'ticker', `entityValue`, `exchange`, `dateFrom`,
 *    `dateTo`, `filterCategory`, `sortBy`, `limit`, `cursor`).
 * 2. Validating `CONTEXT_DEV_API_KEY` on the server and invoking `searchCompanyNews()`
 *    which calls `client.news.search` (`POST https://api.context.dev/v1/news/search`).
 * 3. Returning the structured `NewsSearchResponse` (`data`, `next_cursor`, `has_more`,
 *    `meta`, `request_id`) along with the exact `requestPayload` sent to Context.dev
 *    so the investor terminal can inspect and cache the response in Firestore.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildCompanyNewsSearchParams,
  inferEntitySearchOrder,
  searchCompanyNews,
  validateContextDevApiKey,
  type CompanyNewsQueryInput,
} from '@/lib/context-dev';
import { buildFallbackNewsResponse } from '@/lib/fallback-news-data';
import { translateNonEnglishArticlesToEnglish } from '@/lib/translation-service';
import { analyzeHeadlineSentiments } from '@/lib/sentiment-service';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { logFunctionCall } from '@/lib/logger';

/**
 * Handles POST /api/news/search requests from the Investor Dashboard.
 * Automatically translates any non-English articles into English and tags
 * the original source language (`translatedFromLanguage`).
 *
 * @param req - Incoming NextRequest containing CompanyNewsQueryInput JSON body
 * @returns NextResponse with Context.dev NewsSearchResponse and diagnostic metadata
 */
export async function POST(req: NextRequest) {
  let locale: 'en' | 'ko' = 'en';
  try {
    const body = (await req.json()) as Partial<CompanyNewsQueryInput> & {
      locale?: 'en' | 'ko';
    };
    locale = body.locale === 'ko' ? 'ko' : 'en';
    logFunctionCall('POST /api/news/search', { ...body, locale });

    const queryInput: CompanyNewsQueryInput = {
      entityType:
        body.entityType === 'ticker' ||
        body.entityType === 'name' ||
        body.entityType === 'domain' ||
        body.entityType === 'isin'
          ? body.entityType
          : 'auto',
      entityValue: (body.entityValue ?? 'NVDA').trim(),
      exchange: body.exchange,
      dateFrom:
        typeof body.dateFrom === 'number' && !Number.isNaN(body.dateFrom)
          ? body.dateFrom
          : undefined,
      dateTo:
        typeof body.dateTo === 'number' && !Number.isNaN(body.dateTo)
          ? body.dateTo
          : undefined,
      filterCategory: body.filterCategory ?? 'none',
      articleTypes: body.articleTypes,
      articleLanguages: body.articleLanguages,
      sourceCountries: body.sourceCountries,
      sourceDomains: body.sourceDomains,
      sortBy: body.sortBy === 'relevance' ? 'relevance' : 'newest',
      limit:
        typeof body.limit === 'number'
          ? Math.max(1, Math.min(25, body.limit))
          : 4,
      cursor: body.cursor ?? null,
    };

    const requestPayload = buildCompanyNewsSearchParams(queryInput);
    const inferredFallbackType =
      queryInput.entityType === 'auto'
        ? inferEntitySearchOrder(queryInput.entityValue)[0]
        : queryInput.entityType;

    // Check if CONTEXT_DEV_API_KEY is configured in .env.local / server env
    let hasValidKey = false;
    let keyWarning: string | null = null;
    try {
      validateContextDevApiKey();
      hasValidKey = true;
    } catch (keyErr) {
      keyWarning =
        keyErr instanceof Error
          ? keyErr.message
          : 'CONTEXT_DEV_API_KEY is not configured in .env.local.';
    }

    if (hasValidKey) {
      try {
        const {
          response,
          requestPayload: resolvedRequestPayload,
          resolvedEntityType,
          resolvedExchange,
        } = await searchCompanyNews(queryInput);
        const translatedData = await translateNonEnglishArticlesToEnglish(
          response.data || []
        );
        const { articles: sentimentData, sentimentError } =
          await analyzeHeadlineSentiments(translatedData, locale);
        return NextResponse.json({
          ok: true,
          mode: 'live_sdk',
          endpoint: 'POST https://api.context.dev/v1/news/search',
          requestPayload: resolvedRequestPayload,
          resolvedEntityType,
          resolvedExchange: resolvedExchange ?? null,
          sentimentError,
          response: {
            ...response,
            data: sentimentData,
          },
          keyConfigured: true,
          warning: null,
        });
      } catch (sdkError) {
        const normalizedSdkErr = formatGracefulApiError(sdkError, { locale });
        logFunctionCall('POST /api/news/search:sdk_error', {
          error: normalizedSdkErr.message,
          errorCode: normalizedSdkErr.errorCode,
        });

        const fallbackResponse = buildFallbackNewsResponse({
          ...queryInput,
          entityType: inferredFallbackType,
        });
        const translatedFallback = await translateNonEnglishArticlesToEnglish(
          fallbackResponse.data || []
        );
        const { articles: sentimentFallback, sentimentError } =
          await analyzeHeadlineSentiments(translatedFallback, locale);
        return NextResponse.json({
          ok: true,
          mode: 'fallback_after_api_error',
          endpoint: 'POST https://api.context.dev/v1/news/search',
          requestPayload,
          resolvedEntityType: inferredFallbackType,
          resolvedExchange: null,
          sentimentError,
          response: {
            ...fallbackResponse,
            data: sentimentFallback,
          },
          keyConfigured: true,
          warning: normalizedSdkErr.message,
        });
      }
    }

    // When CONTEXT_DEV_API_KEY is not yet added to .env.local, provide structured
    // fallback response with automatic English translation applied to non-English items.
    const fallbackResponse = buildFallbackNewsResponse({
      ...queryInput,
      entityType: inferredFallbackType,
    });
    const translatedFallback = await translateNonEnglishArticlesToEnglish(
      fallbackResponse.data || []
    );
    const { articles: sentimentFallback, sentimentError } =
      await analyzeHeadlineSentiments(translatedFallback, locale);
    return NextResponse.json({
      ok: true,
      mode: 'demo_awaiting_key',
      endpoint: 'POST https://api.context.dev/v1/news/search',
      requestPayload,
      resolvedEntityType: inferredFallbackType,
      resolvedExchange: null,
      sentimentError,
      response: {
        ...fallbackResponse,
        data: sentimentFallback,
      },
      keyConfigured: false,
      warning: keyWarning,
    });
  } catch (error) {
    const normalized = formatGracefulApiError(error, { locale });
    logFunctionCall('POST /api/news/search:error', {
      error: normalized.message,
      errorCode: normalized.errorCode,
      statusCode: normalized.statusCode,
    });
    return NextResponse.json(
      {
        ok: false,
        error: normalized.message,
        errorCode: normalized.errorCode,
      },
      { status: normalized.statusCode }
    );
  }
}
