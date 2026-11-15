/**
 * ============================================================================
 * FILE: app/api/ai/related/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Next.js API Route for Related Company Ecosystem Suggestions.
 *
 * USE CASES:
 * 1. Returning related companies grouped by business relationship (`Suppliers`,
 *    `Customers`, `Peers & Competitors`, `Strategic Partners`) when a user
 *    searches any company or stock ticker.
 * 2. Supporting multi-relationship membership where a company can belong to
 *    multiple relationship groups simultaneously.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { getRelatedCompanies } from '@/lib/related-companies-service';
import { logFunctionCall } from '@/lib/logger';

export async function GET(req: NextRequest) {
  let locale: 'en' | 'ko' = 'en';
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') ?? '').trim();
    const forceRefresh = searchParams.get('refresh') === '1';
    locale = searchParams.get('locale') === 'ko' ? 'ko' : 'en';

    logFunctionCall('GET /api/ai/related', { query, forceRefresh, locale });

    if (!query) {
      return NextResponse.json(
        { ok: false, error: 'Company query is required.' },
        { status: 400 }
      );
    }

    const data = await getRelatedCompanies(query, forceRefresh, locale);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const normalized = formatGracefulApiError(error, {
      locale,
      fallbackEn: 'Unable to load related companies right now. Please try again.',
      fallbackKo: '관련 기업 생태계 데이터를 일시적으로 불러오지 못했습니다. 다시 시도해 주세요.',
    });
    logFunctionCall('GET /api/ai/related:error', {
      errorCode: normalized.errorCode,
      statusCode: normalized.statusCode,
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
