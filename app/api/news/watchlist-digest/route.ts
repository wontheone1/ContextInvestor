/**
 * ============================================================================
 * FEATURE: Watchlist Cross-Company News Digest & Top Movers API Route
 * ============================================================================
 *
 * Detailed Feature Overview:
 * Serves `POST /api/news/watchlist-digest` to power the landing dashboard's
 * immediate Watchlist News Summary and Top Bullish / Bearish Conviction Signals
 * across all companies the user is currently following.
 *
 * Key Use Cases:
 * 1. Landing Page Executive Pulse: Aggregates live news across followed
 *    public and private companies and synthesizes a unified cross-watchlist
 *    summary plus per-company digest.
 * 2. Top Bullish & Bearish Signals: Ranks the highest-conviction upside
 *    catalysts and downside risk stories across the user's entire watchlist
 *    with 1-sentence AI rationales and conviction scores (`1-100`).
 * 3. Custom Watchlist Sync: Accepts the user's customized list of followed
 *    companies (or defaults to `APP_CONFIG.featuredCompanies`).
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { APP_CONFIG } from '@/lib/config';
import { logInfo, logError } from '@/lib/logger';
import {
  generateWatchlistDigest,
  type WatchlistTargetCompany,
} from '@/lib/watchlist-digest-service';

/**
 * Handles POST requests to `/api/news/watchlist-digest`.
 *
 * @param req - Next.js request containing `{ companies?: WatchlistTargetCompany[], forceRefresh?: boolean }`
 * @returns JSON response with `WatchlistDigestResponse`
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let locale: 'en' | 'ko' = 'en';
  try {
    const body = (await req.json().catch(() => ({}))) as {
      companies?: Array<{
        label?: string;
        name?: string;
        value: string;
        entityType?: 'name' | 'ticker' | 'domain' | 'isin';
        sector?: string;
      }>;
      forceRefresh?: boolean;
      locale?: 'en' | 'ko';
    };

    locale = body.locale === 'ko' ? 'ko' : 'en';

    const rawCompanies: WatchlistTargetCompany[] =
      Array.isArray(body.companies) && body.companies.length > 0
        ? body.companies.map((c) => ({
            label: c.label || c.name || c.value,
            value: c.value,
            entityType: c.entityType === 'ticker' ? 'ticker' : 'name',
            sector: c.sector || 'US Market',
          }))
        : APP_CONFIG.featuredCompanies.map((c) => ({
            label: c.label,
            value: c.value,
            entityType: c.entityType === 'ticker' ? 'ticker' : 'name',
            sector: c.sector,
          }));

    logInfo('API_POST_WATCHLIST_DIGEST', {
      companyCount: rawCompanies.length,
      companies: rawCompanies.map((c) => c.value),
      forceRefresh: Boolean(body.forceRefresh),
      locale,
    });

    const digest = await generateWatchlistDigest(
      rawCompanies,
      Boolean(body.forceRefresh),
      locale
    );

    return NextResponse.json({
      ok: true,
      digest,
    });
  } catch (error) {
    const normalized = formatGracefulApiError(error, {
      locale,
      fallbackEn: 'Unable to synthesize Daily Brief right now.',
      fallbackKo: '일일 브리핑을 일시적으로 생성하지 못했습니다.',
    });
    logError('API_POST_WATCHLIST_DIGEST_ERROR', {
      errorCode: normalized.errorCode,
      message: normalized.message,
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
