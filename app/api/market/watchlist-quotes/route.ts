/**
 * ============================================================================
 * FILE: app/api/market/watchlist-quotes/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Next.js Server API Route (`POST /api/market/watchlist-quotes`) for Watchlist
 * Company Existence Validation & Live Sparkline Timeframe Hydration.
 *
 * USE CASES:
 * 1. `action: "validate"` — Verifies whether a user-submitted ticker or company
 *    name corresponds to a real public equity or verified private company before
 *    allowing it into `"Companies You Are Following"`, returning `404` with an
 *    explanatory message for non-existent inputs like `"asgadsgasd"`.
 * 2. `action: "hydrate"` — Batch-hydrates live prices, explicit timeframe `%`
 *    changes (`1D`, `5D`, `1M`, `6M`, `1Y` — default `1M`), and real historical
 *    sparklines for public equities while stripping fake graphs from private
 *    companies and pruning any legacy invalid entries.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import type { CompanyPreset } from '@/lib/config';
import {
  hydrateWatchlistPresets,
  normalizeWatchlistRange,
  validateAndResolveFollowCompany,
} from '@/lib/watchlist-company-service';
import { logFunctionCall } from '@/lib/logger';

interface WatchlistQuotesRequestBody {
  action?: 'validate' | 'hydrate';
  query?: string;
  companies?: CompanyPreset[];
  range?: string;
}

/**
 * Handles `POST /api/market/watchlist-quotes` for both single-company follow
 * verification and full-watchlist live sparkline hydration.
 *
 * @param req - Incoming Next.js request
 * @returns JSON response with validated preset or hydrated watchlist presets
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WatchlistQuotesRequestBody;
    const action = body.action === 'hydrate' ? 'hydrate' : 'validate';
    const range = normalizeWatchlistRange(body.range);

    logFunctionCall('POST /api/market/watchlist-quotes', {
      action,
      query: body.query ?? null,
      companyCount: Array.isArray(body.companies) ? body.companies.length : 0,
      range,
    });

    if (action === 'hydrate') {
      const inputCompanies = Array.isArray(body.companies)
        ? body.companies
        : [];
      const hydrated = await hydrateWatchlistPresets(inputCompanies, range);
      return NextResponse.json({
        ok: true,
        ...hydrated,
      });
    }

    const query = (body.query || '').trim();
    const validation = await validateAndResolveFollowCompany(query, range);
    if (!validation.valid || !validation.preset) {
      return NextResponse.json(
        {
          ok: false,
          valid: false,
          error:
            validation.error ||
            `Could not find a verified company or ticker matching "${query}".`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      valid: true,
      preset: validation.preset,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unexpected watchlist verification error.';
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
