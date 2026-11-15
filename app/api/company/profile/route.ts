/**
 * ============================================================================
 * FILE: app/api/company/profile/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Next.js API Route for Company Profile Lookup via Context.dev
 * Company Search (`POST /v1/company/search`).
 *
 * USE CASES:
 * 1. Serving `GET /api/company/profile?query=...&entityType=...&companyNameHint=...`
 *    for the collapsible Company Profile bar positioned beneath the Company
 *    Research header.
 * 2. Keeping `CONTEXT_DEV_API_KEY` and `GEMINI_API_KEY` strictly server-side
 *    while returning a clean, single top-match `CompanyProfileData` payload.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { getCompanyProfileBySearch } from '@/lib/company-profile-service';
import { logError, logInfo } from '@/lib/logger';

/**
 * Handles GET requests to `/api/company/profile`.
 *
 * @param req - Incoming NextRequest with `query`, optional `entityType`, `companyNameHint`, and `refresh`
 * @returns JSON response with `{ ok: true, profile: CompanyProfileData | null }`
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get('query') || '').trim();
    const entityType = (searchParams.get('entityType') || 'auto').trim();
    const companyNameHint = (searchParams.get('companyNameHint') || '').trim();
    const forceRefresh = searchParams.get('refresh') === '1';

    logInfo('API_GET_COMPANY_PROFILE', {
      query,
      entityType,
      companyNameHint: companyNameHint || undefined,
      forceRefresh,
    });

    if (!query) {
      return NextResponse.json(
        { ok: false, error: 'Missing required company query parameter.' },
        { status: 400 }
      );
    }

    const profile = await getCompanyProfileBySearch({
      query,
      entityType,
      companyNameHint: companyNameHint || undefined,
      forceRefresh,
    });

    return NextResponse.json({
      ok: true,
      profile,
    });
  } catch (error) {
    const normalized = formatGracefulApiError(error, {
      fallbackEn: 'Unable to retrieve company profile right now.',
      fallbackKo: '기업 프로필 데이터를 일시적으로 불러오지 못했습니다.',
    });
    logError('API_GET_COMPANY_PROFILE_ERROR', {
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
