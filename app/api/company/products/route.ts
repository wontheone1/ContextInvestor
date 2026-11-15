/**
 * ============================================================================
 * FILE: app/api/company/products/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Next.js Server API Route for Company Products, Revenue Segments & Target
 * Customer Intelligence (`GET /api/company/products`), backed by Context.dev
 * `POST /v1/web/answers` (`mode: 'fast'`) with cited official URLs.
 *
 * USE CASES:
 * 1. Hydrating the dedicated "Products, Revenue Segments & Customers" section
 *    inside Single-Company Research (`01. Price & Fundamentals` view) for any
 *    searched US stock, ADR, Korea Exchange (`KOSPI` / `KOSDAQ`) equity, or
 *    privately held company.
 * 2. Supporting `locale=en|ko` for native bilingual portfolio synthesis and
 *    `refresh=1` to bypass the 30-minute server cache on manual refresh.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyProductsPortfolio } from '@/lib/company-products-service';
import { logError, logInfo } from '@/lib/logger';

/**
 * Handles `GET /api/company/products?query=...&entityType=...&domain=...&companyNameHint=...&locale=...&refresh=...`
 * requests on the server side so `CONTEXT_DEV_API_KEY` and `GEMINI_API_KEY` remain private.
 *
 * @param req - Incoming NextRequest
 * @returns JSON `{ ok: true, products }` or structured error response
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') || '').trim();
    const entityType = (searchParams.get('entityType') || 'auto').trim();
    const domainHint = (searchParams.get('domain') || '').trim() || undefined;
    const companyNameHint =
      (searchParams.get('companyNameHint') || '').trim() || undefined;
    const locale: 'en' | 'ko' =
      searchParams.get('locale') === 'ko' ? 'ko' : 'en';
    const forceRefresh =
      searchParams.get('refresh') === '1' ||
      searchParams.get('refresh') === 'true';

    logInfo('API.GET./api/company/products', {
      query,
      entityType,
      domainHint,
      companyNameHint,
      locale,
      forceRefresh,
    });

    if (!query) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing required `query` parameter.',
        },
        { status: 400 }
      );
    }

    const products = await getCompanyProductsPortfolio({
      query,
      entityType,
      domainHint,
      companyNameHint,
      locale,
      forceRefresh,
    });

    return NextResponse.json({
      ok: true,
      products,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to retrieve company products and revenue segments.';
    logError('API.GET./api/company/products.error', { error: message });
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
