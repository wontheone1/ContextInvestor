/**
 * ============================================================================
 * FILE: app/api/ai/sentiment/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Next.js API Route for Lightweight Headline Sentiment Analysis.
 *
 * USE CASES:
 * 1. Receiving article headlines from the client if cached/untagged articles need
 *    sentiment classification (`Bullish`, `Bearish`, `Neutral`).
 * 2. Invoking `analyzeHeadlineSentiments()` via `gemini-3.1-flash-lite` on the
 *    server side and returning a `{ sentiments: Record<string, ArticleSentiment> }` map.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeHeadlineSentiments } from '@/lib/sentiment-service';
import type { EnrichedNewsArticle } from '@/lib/translation-service';
import { logFunctionCall } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      articles?: Array<{
        id: string;
        title: string;
        description?: string | null;
      }>;
      locale?: 'en' | 'ko';
    };

    const items = Array.isArray(body.articles) ? body.articles : [];
    const locale = body.locale === 'ko' ? 'ko' : 'en';
    logFunctionCall('POST /api/ai/sentiment', { count: items.length, locale });

    if (items.length === 0) {
      return NextResponse.json({ ok: true, sentiments: {}, reasons: {} });
    }

    const pseudoArticles: EnrichedNewsArticle[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      authors: [],
      description: item.description ?? null,
      image_url: null,
      language: 'en',
      match: null,
      published_at: null,
      source: { direct: false, domain: '', name: '' },
      story_id: '',
      type: 'editorial',
      url: '',
    }));

    const { articles: analyzed, sentimentError } =
      await analyzeHeadlineSentiments(pseudoArticles, locale);

    if (sentimentError) {
      return NextResponse.json(
        {
          ok: false,
          error: sentimentError,
        },
        { status: 502 }
      );
    }

    const sentiments: Record<string, 'Bullish' | 'Bearish' | 'Neutral'> = {};
    const reasons: Record<string, string> = {};
    for (const a of analyzed) {
      if (a.sentiment) {
        sentiments[a.id] = a.sentiment;
      }
      if (a.sentimentReason) {
        reasons[a.id] = a.sentimentReason;
      }
    }

    return NextResponse.json({
      ok: true,
      sentiments,
      reasons,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to analyze headline sentiments.';
    logFunctionCall('POST /api/ai/sentiment:error', { error: message });
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
