/**
 * ============================================================================
 * FILE: app/api/ai/brief/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Next.js API Route for Gemini AI Quantitative News Briefings.
 *
 * USE CASES:
 * 1. Accepting the currently displayed or cached Context.dev company news articles
 *    and invoking `generateCompanyMarketBrief()` on the server using `@google/genai`.
 * 2. Returning structured institutional sentiment, conviction score, key catalysts,
 *    risk vectors, and sector read-through to the AI Assistant panel.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import {
  generateCompanyMarketBrief,
  type MarketBriefArticleInput,
} from '@/lib/gemini-service';
import { logFunctionCall } from '@/lib/logger';

/**
 * Handles POST /api/ai/brief requests to synthesize company news coverage with Gemini AI.
 *
 * @param req - Incoming NextRequest with companyQuery and articles list
 * @returns JSON response containing AIMarketBriefResponse
 */
export async function POST(req: NextRequest) {
  let locale: 'en' | 'ko' = 'en';
  try {
    const body = (await req.json()) as {
      companyQuery?: string;
      articles?: MarketBriefArticleInput[];
      locale?: 'en' | 'ko';
    };

    const companyQuery = (body.companyQuery ?? 'Company').trim();
    const articles = Array.isArray(body.articles) ? body.articles : [];
    locale = body.locale === 'ko' ? 'ko' : 'en';

    logFunctionCall('POST /api/ai/brief', {
      companyQuery,
      articleCount: articles.length,
      locale,
    });

    if (articles.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'No articles provided to generate an AI market brief.',
        },
        { status: 400 }
      );
    }

    const brief = await generateCompanyMarketBrief(
      companyQuery,
      articles,
      locale
    );

    return NextResponse.json({
      ok: true,
      brief,
    });
  } catch (error) {
    const normalized = formatGracefulApiError(error, {
      locale,
      fallbackEn: 'Unable to synthesize AI investment brief right now.',
      fallbackKo: 'AI 투자 종합 진단을 일시적으로 생성하지 못했습니다.',
    });
    logFunctionCall('POST /api/ai/brief:error', {
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
