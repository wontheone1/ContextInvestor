/**
 * ============================================================================
 * FILE: app/api/screener/compare/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Next.js Server API Route for Parallel Multi-Company Comparison Hydration
 * (`POST /api/screener/compare`).
 *
 * USE CASES:
 * 1. Hydrating up to 4 selected public equities and/or private unicorns in
 *    parallel across historical price series & valuation multiples, Context.dev
 *    company firmographics, live news sentiment & top catalyst headlines, and
 *    a concise 2-sentence AI comparative takeaway.
 * 2. Supporting fast `chartOnly: true` timeframe switches (`1D`, `5D`, `1M`,
 *    `6M`, `YTD`, `1Y`, `5Y`) on the normalized multi-stock `%` chart overlay.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { hydrateCohortComparison } from '@/lib/cohort-screener-service';
import type { ChartRange } from '@/lib/market-data-service';
import type { CohortCompareRequestItem } from '@/lib/query-intent';
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
 * Handles `POST /api/screener/compare` requests to hydrate side-by-side dossiers
 * for the investor's selected cohort companies.
 *
 * @param req - Incoming NextRequest with JSON `{ items, range?, theme?, chartOnly? }`
 * @returns JSON `{ ok: true, comparison }` or structured error response
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items?: CohortCompareRequestItem[];
      range?: string;
      theme?: string;
      chartOnly?: boolean;
    };

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const validItems = rawItems.filter(
      (item): item is CohortCompareRequestItem =>
        Boolean(
          item &&
            typeof item.id === 'string' &&
            typeof item.searchQuery === 'string' &&
            item.searchQuery.trim()
        )
    );

    const range: ChartRange =
      typeof body.range === 'string' && VALID_RANGES.has(body.range as ChartRange)
        ? (body.range as ChartRange)
        : '1M';
    const theme = typeof body.theme === 'string' ? body.theme.trim() : undefined;
    const chartOnly = Boolean(body.chartOnly);

    logInfo('API.POST./api/screener/compare', {
      itemCount: validItems.length,
      range,
      theme,
      chartOnly,
    });

    if (validItems.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Select at least one company to compare.',
        },
        { status: 400 }
      );
    }

    const comparison = await hydrateCohortComparison({
      items: validItems,
      range,
      theme,
      chartOnly,
    });

    return NextResponse.json({
      ok: true,
      comparison,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to hydrate side-by-side company comparison.';
    logError('API.POST./api/screener/compare.error', { error: message });
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
