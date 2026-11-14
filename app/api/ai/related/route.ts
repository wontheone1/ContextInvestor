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
import { getRelatedCompanies } from '@/lib/related-companies-service';
import { logFunctionCall } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') ?? '').trim();
    const forceRefresh = searchParams.get('refresh') === '1';

    logFunctionCall('GET /api/ai/related', { query, forceRefresh });

    if (!query) {
      return NextResponse.json(
        { ok: false, error: 'Company query is required.' },
        { status: 400 }
      );
    }

    const data = await getRelatedCompanies(query, forceRefresh);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to generate related company suggestions.';
    logFunctionCall('GET /api/ai/related:error', { error: message });
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
