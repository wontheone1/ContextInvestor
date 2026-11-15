/**
 * ============================================================================
 * FILE: app/api/screener/query/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Next.js Server API Route for Natural-Language Company Cohort Screening &
 * Live Quantitative Threshold Verification (`POST /api/screener/query`).
 *
 * USE CASES:
 * 1. Accepting natural-language investor screening queries such as
 *    `"AI CHIP companies with over 200 bn USD market cap"` or
 *    `"Private frontier AI unicorns over $10B valuation"`.
 * 2. Discovering candidate public equities and private unicorns via grounded
 *    Gemini (`gemini-4-hydrogen`) + Context.dev Company Search, verifying live
 *    market caps/valuations, and pre-selecting the top 3 verified matches.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { screenNaturalCompanyCohort } from '@/lib/cohort-screener-service';
import type { ChartRange } from '@/lib/market-data-service';
import { logError, logInfo } from '@/lib/logger';

const VALID_RANGES = new Set<ChartRange>([
  '1D',
  '5D',
  '1M',
  '6M',
  'YTD',
  '1Y',
  '5Y',
]);

/**
 * Handles `POST /api/screener/query` requests to discover and verify matching
 * companies for a natural-language screening prompt.
 *
 * @param req - Incoming NextRequest with JSON `{ query, range?, forceRefresh? }`
 * @returns JSON `{ ok: true, result }` or structured error response
 */
export async function POST(req: NextRequest) {
  let locale: 'en' | 'ko' = 'en';
  try {
    const body = (await req.json()) as {
      query?: string;
      range?: string;
      forceRefresh?: boolean;
      locale?: string;
    };

    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const range: ChartRange =
      typeof body.range === 'string' && VALID_RANGES.has(body.range as ChartRange)
        ? (body.range as ChartRange)
        : '1M';
    const forceRefresh = Boolean(body.forceRefresh);
    locale = body.locale === 'ko' ? 'ko' : 'en';

    logInfo('API.POST./api/screener/query', {
      query,
      range,
      forceRefresh,
      locale,
    });

    if (!query) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Please enter a natural-language company screening query.',
        },
        { status: 400 }
      );
    }

    const result = await screenNaturalCompanyCohort({
      query,
      range,
      forceRefresh,
      locale,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const normalized = formatGracefulApiError(error, {
      locale,
      fallbackEn: 'Unable to complete natural-language cohort screen right now.',
      fallbackKo: '자연어 기업 스크리닝 요청을 일시적으로 처리하지 못했습니다.',
    });
    logError('API.POST./api/screener/query.error', {
      errorCode: normalized.errorCode,
      error: normalized.message,
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
