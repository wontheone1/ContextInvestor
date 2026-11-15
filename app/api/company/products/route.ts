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
import { formatGracefulApiError } from '@/lib/api-error-utils';
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
  let locale: 'en' | 'ko' = 'en';
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') || '').trim();
    const entityType = (searchParams.get('entityType') || 'auto').trim();
    const domainHint = (searchParams.get('domain') || '').trim() || undefined;
    const companyNameHint =
      (searchParams.get('companyNameHint') || '').trim() || undefined;
    locale = searchParams.get('locale') === 'ko' ? 'ko' : 'en';
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
    const normalized = formatGracefulApiError(error, {
      locale,
      fallbackEn: 'Unable to retrieve company products and revenue segments right now.',
      fallbackKo: '주요 제품·서비스 및 매출 부문 정보를 일시적으로 불러오지 못했습니다.',
    });
    logError('API.GET./api/company/products.error', {
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
