/**
 * ============================================================================
 * FILE: app/api/ai/chat/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Next.js Server API Route for the Contextual Research Assistant Drawer
 * (`POST /api/ai/chat`).
 *
 * USE CASES:
 * 1. Receiving multi-turn conversation history alongside a live snapshot of
 *    the user's active Contextual Investing view (Single-Company OR Cohort
 *    Comparison + Watchlist Pulse).
 * 2. Calling `generateContextualResearchReply` (`gemini-4-hydrogen` + Google
 *    Search grounding) on the server without exposing `GEMINI_API_KEY` to the
 *    browser, returning institutional Markdown and clickable source citations.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatGracefulApiError } from '@/lib/api-error-utils';
import { generateContextualResearchReply } from '@/lib/research-chat-service';
import type {
  ResearchChatTurnInput,
  WorkspaceResearchContextPayload,
} from '@/lib/research-chat-types';
import { logError, logInfo } from '@/lib/logger';

/**
 * Handles `POST /api/ai/chat` requests from the Contextual Research Drawer.
 *
 * @param req - Incoming NextRequest containing `{ messages, context }`
 * @returns JSON `{ ok: true, reply }` or structured error response
 */
export async function POST(req: NextRequest) {
  let locale: 'en' | 'ko' = 'en';
  try {
    const body = (await req.json()) as {
      messages?: ResearchChatTurnInput[];
      context?: WorkspaceResearchContextPayload;
      locale?: 'en' | 'ko';
    };

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const context = body.context;
    locale = body.locale === 'ko' ? 'ko' : 'en';

    logInfo('API.POST./api/ai/chat', {
      messageCount: messages.length,
      workspaceMode: context?.workspaceMode ?? 'unknown',
      contextSummaryLine: context?.contextSummaryLine ?? '',
      locale,
    });

    if (messages.length === 0 || !context) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Conversation messages and active workspace context are required.',
        },
        { status: 400 }
      );
    }

    const reply = await generateContextualResearchReply({
      messages,
      context,
      locale,
    });

    return NextResponse.json({
      ok: true,
      reply,
    });
  } catch (error) {
    const normalized = formatGracefulApiError(error, {
      locale,
      fallbackEn: 'Unable to generate Research Assistant response right now.',
      fallbackKo: 'AI 리서치 어시스턴트 응답을 일시적으로 생성하지 못했습니다.',
    });
    logError('API.POST./api/ai/chat.error', {
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
