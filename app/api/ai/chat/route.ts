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
  try {
    const body = (await req.json()) as {
      messages?: ResearchChatTurnInput[];
      context?: WorkspaceResearchContextPayload;
    };

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const context = body.context;

    logInfo('API.POST./api/ai/chat', {
      messageCount: messages.length,
      workspaceMode: context?.workspaceMode ?? 'unknown',
      contextSummaryLine: context?.contextSummaryLine ?? '',
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
    });

    return NextResponse.json({
      ok: true,
      reply,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to generate research assistant response.';
    logError('API.POST./api/ai/chat.error', { error: message });
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
