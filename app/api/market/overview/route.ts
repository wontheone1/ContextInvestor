/**
 * ============================================================================
 * FILE: app/api/market/overview/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Next.js API Route for Company Price Chart & Key Investment Metrics.
 *
 * USE CASES:
 * 1. Fetching live OHLCV price history and financial fundamentals for any
 *    searched US-listed equity (`query`, `entityType`, `range`).
 * 2. Fast timeframe-only chart refreshes (`chartOnly=1`, `symbol`, `range`)
 *    when switching between 1D, 5D, 1M, 6M, YTD, 1Y, and 5Y.
 * 3. Returning grounded private-market investment profiles when the searched
 *    company is privately held.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchChartData,
  getCompanyMarketOverview,
  type ChartRange,
} from '@/lib/market-data-service';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { logFunctionCall } from '@/lib/logger';

const VALID_RANGES = new Set<ChartRange>([
  '1D',
  '5D',
  '1M',
  '6M',
  'YTD',
  '1Y',
  '5Y',
]);

export async function GET(req: NextRequest) {
  let locale: 'en' | 'ko' = 'en';
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') ?? '').trim();
    const symbol = (searchParams.get('symbol') ?? '').trim().toUpperCase();
    const rawRange = (searchParams.get('range') ?? '1M').toUpperCase() as ChartRange;
    const range: ChartRange = VALID_RANGES.has(rawRange) ? rawRange : '1M';
    const chartOnly = searchParams.get('chartOnly') === '1';
    const rawEntityType = searchParams.get('entityType');
    const entityType =
      rawEntityType === 'name' || rawEntityType === 'ticker'
        ? rawEntityType
        : 'auto';
    locale = searchParams.get('locale') === 'ko' ? 'ko' : 'en';

    logFunctionCall('GET /api/market/overview', {
      query,
      symbol,
      range,
      chartOnly,
      entityType,
      locale,
    });

    if (chartOnly && symbol) {
      const chart = await fetchChartData(symbol, range);
      if (!chart) {
        return NextResponse.json(
          { ok: false, error: 'Unable to load chart history for this symbol.' },
          { status: 404 }
        );
      }

      const baseline =
        range === '1D'
          ? chart.previousClose
          : chart.points[0]?.close ?? chart.previousClose;
      const change = chart.price - baseline;
      const changePercent = baseline > 0 ? (change / baseline) * 100 : 0;

      return NextResponse.json({
        ok: true,
        chartOnly: true,
        range,
        currency: chart.currency,
        price: chart.price,
        previousClose: baseline,
        change,
        changePercent,
        points: chart.points,
      });
    }

    if (!query) {
      return NextResponse.json(
        { ok: false, error: 'Company query is required.' },
        { status: 400 }
      );
    }

    const overview = await getCompanyMarketOverview({
      query,
      entityType,
      range,
      locale,
    });

    return NextResponse.json({
      ok: true,
      overview,
    });
  } catch (error) {
    const normalized = formatGracefulApiError(error, { locale });
    logFunctionCall('GET /api/market/overview:error', {
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
