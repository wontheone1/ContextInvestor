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
  searchCompanyNews,
  validateContextDevApiKey,
  type CompanyNewsQueryInput,
} from '@/lib/context-dev';
import { buildFallbackNewsResponse } from '@/lib/fallback-news-data';
import { logFunctionCall } from '@/lib/logger';

/**
 * Handles POST /api/news/search requests from the Investor Dashboard.
 *
 * @param req - Incoming NextRequest containing CompanyNewsQueryInput JSON body
 * @returns NextResponse with Context.dev NewsSearchResponse and diagnostic metadata
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CompanyNewsQueryInput>;
    logFunctionCall('POST /api/news/search', { ...body });

    const queryInput: CompanyNewsQueryInput = {
      entityType:
        body.entityType === 'ticker' ||
        body.entityType === 'domain' ||
        body.entityType === 'isin'
          ? body.entityType
          : 'name',
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
        const { response } = await searchCompanyNews(queryInput);
        return NextResponse.json({
          ok: true,
          mode: 'live_sdk',
          endpoint: 'POST https://api.context.dev/v1/news/search',
          requestPayload,
          response,
          keyConfigured: true,
          warning: null,
        });
      } catch (sdkError) {
        const errMsg =
          sdkError instanceof Error ? sdkError.message : String(sdkError);
        logFunctionCall('POST /api/news/search:sdk_error', { error: errMsg });

        const fallbackResponse = buildFallbackNewsResponse(queryInput);
        return NextResponse.json({
          ok: true,
          mode: 'fallback_after_api_error',
          endpoint: 'POST https://api.context.dev/v1/news/search',
          requestPayload,
          response: fallbackResponse,
          keyConfigured: true,
          warning: `Context.dev API returned an error (${errMsg}). Showing fallback dataset so you can continue testing pagination and Firestore caching.`,
        });
      }
    }

    // When CONTEXT_DEV_API_KEY is not yet added to .env.local, provide structured
    // fallback response with clear notice so UI & Firestore caching remain testable.
    const fallbackResponse = buildFallbackNewsResponse(queryInput);
    return NextResponse.json({
      ok: true,
      mode: 'demo_awaiting_key',
      endpoint: 'POST https://api.context.dev/v1/news/search',
      requestPayload,
      response: fallbackResponse,
      keyConfigured: false,
      warning: keyWarning,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unexpected server error';
    logFunctionCall('POST /api/news/search:error', { error: message });
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
