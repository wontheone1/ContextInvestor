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
  try {
    const body = (await req.json()) as {
      companyQuery?: string;
      articles?: MarketBriefArticleInput[];
      locale?: 'en' | 'ko';
    };

    const companyQuery = (body.companyQuery ?? 'Company').trim();
    const articles = Array.isArray(body.articles) ? body.articles : [];
    const locale = body.locale === 'ko' ? 'ko' : 'en';

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
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to generate AI market brief.';
    logFunctionCall('POST /api/ai/brief:error', { error: message });
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
