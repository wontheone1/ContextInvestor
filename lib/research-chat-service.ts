/**
 * ============================================================================
 * FILE: lib/research-chat-service.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-Side Contextual Financial Research Assistant Engine powered by
 * `@google/genai` (`gemini-4-hydrogen`) + Google Search Grounding.
 *
 * USE CASES:
 * 1. Answering investor questions with full awareness of the active company
 *    or multi-company cohort currently on screen (live prices, valuation
 *    multiples, 52W ranges, Context.dev firmographics, AI bull/bear brief,
 *    loaded news headlines, and cross-watchlist signals).
 * 2. Supplementing loaded dashboard telemetry with live Google Search
 *    grounding (`tools: [{ googleSearch: {} }]`) when questions ask for
 *    external details (earnings call commentary, SEC filings, competitor
 *    developments, or macro context).
 * 3. Returning clean institutional Markdown alongside deduplicated clickable
 *    citations from both dashboard news articles and live web search chunks.
 * ============================================================================
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { APP_CONFIG } from './config';
import {
  extractCleanDomain,
  type ChatNewsHeadlineItem,
  type ResearchChatCitation,
  type ResearchChatReplyPayload,
  type ResearchChatTurnInput,
  type WorkspaceResearchContextPayload,
} from './research-chat-types';
import { logFunctionCall, logGenAICall } from './logger';

/**
 * Initializes the server-side GoogleGenAI client with required AI Studio headers.
 *
 * @returns Configured `GoogleGenAI` instance
 */
function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check Settings > Secrets in AI Studio.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': APP_CONFIG.gemini.userAgent,
      },
    },
  });
}

/**
 * Collects candidate dashboard news articles from the active workspace context
 * so relevant publisher links can be surfaced alongside web search citations.
 *
 * @param context - Active `WorkspaceResearchContextPayload`
 * @returns Deduplicated array of `ChatNewsHeadlineItem`
 */
function collectDashboardNewsPool(
  context: WorkspaceResearchContextPayload
): ChatNewsHeadlineItem[] {
  const pool: ChatNewsHeadlineItem[] = [];

  if (context.singleCompany) {
    pool.push(...context.singleCompany.articles);
  }

  if (context.cohortComparison) {
    for (const comp of context.cohortComparison.selectedCompanies) {
      if (comp.topCatalyst?.url) {
        pool.push({
          title: comp.topCatalyst.title,
          sourceName: comp.topCatalyst.sourceName,
          publishedAt: null,
          url: comp.topCatalyst.url,
          sentiment: comp.topCatalyst.sentiment,
          rationale: null,
        });
      }
    }
  }

  if (context.watchlist) {
    pool.push(...context.watchlist.topBullish, ...context.watchlist.topBearish);
  }

  const seen = new Set<string>();
  return pool.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

/**
 * Matches dashboard news articles referenced by title keywords, publisher name,
 * or company symbol in the latest question + assistant reply.
 *
 * @param pool - Candidate dashboard articles in context
 * @param combinedText - Concatenated user question + assistant answer text
 * @returns Relevant `ResearchChatCitation[]`
 */
function matchReferencedDashboardArticles(
  pool: ChatNewsHeadlineItem[],
  combinedText: string
): ResearchChatCitation[] {
  const lower = combinedText.toLowerCase();
  const scored: Array<{ item: ChatNewsHeadlineItem; score: number }> = [];

  for (const item of pool) {
    let score = 0;
    if (item.sourceName && lower.includes(item.sourceName.toLowerCase())) {
      score += 2;
    }

    const significantWords = item.title
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter(
        (w) =>
          w.length >= 5 &&
          ![
            'about',
            'after',
            'amidst',
            'among',
            'could',
            'first',
            'other',
            'shares',
            'stock',
            'stocks',
            'their',
            'there',
            'these',
            'under',
            'which',
            'while',
            'would',
          ].includes(w)
      );

    let wordHits = 0;
    for (const w of significantWords) {
      if (lower.includes(w)) {
        wordHits += 1;
      }
    }

    if (wordHits >= 2) {
      score += wordHits;
    }

    if (score >= 2) {
      scored.push({ item, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ item }) => ({
      title: item.title.replace(/^\[[^\]]+\]\s*/, ''),
      url: item.url,
      domain: extractCleanDomain(item.url),
      sourceType: 'dashboard_news' as const,
    }));
}

/**
 * Generates a grounded, context-aware analyst response for the Contextual
 * Investing Research Assistant Drawer.
 *
 * @param params - Conversation history (`messages`) and active `context` snapshot
 * @returns `ResearchChatReplyPayload` containing Markdown text and clickable citations
 */
export async function generateContextualResearchReply(params: {
  messages: ResearchChatTurnInput[];
  context: WorkspaceResearchContextPayload;
}): Promise<ResearchChatReplyPayload> {
  const boundedMessages = params.messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .slice(-APP_CONFIG.researchChat.maxHistoryMessages);

  const latestUserMsg =
    [...boundedMessages].reverse().find((m) => m.role === 'user')?.content || '';

  logFunctionCall('generateContextualResearchReply', {
    turnCount: boundedMessages.length,
    workspaceMode: params.context.workspaceMode,
    contextSummaryLine: params.context.contextSummaryLine,
    latestQuestionPreview: latestUserMsg.slice(0, 120),
  });

  if (!latestUserMsg.trim()) {
    throw new Error('Please enter a question for the Research Assistant.');
  }

  const ai = getGenAIClient();
  const model = APP_CONFIG.gemini.defaultModel;

  const systemInstruction = `You are the Contextual Investing Research Assistant — a senior institutional equity and private-market research analyst embedded directly beside the user's live terminal.

GROUNDING & DATA PRIORITY RULES:
1. You receive a structured JSON snapshot of the user's LIVE WORKSPACE CONTEXT below, covering:
   - Either the Single-Company Deep Dive (live share price/valuation, period % return, P/E, EPS, margins, 52-week range, Context.dev company firmographics, supply-chain/peer ecosystem, AI bull/bear brief, and loaded Context.dev news articles)
   - OR the Multi-Company Cohort Comparison (natural screening query, verified candidates, selected companies' side-by-side multiples, normalized % chart returns, firmographics, and news catalysts)
   - PLUS the user's Followed Watchlist Pulse (followed companies, cross-watchlist executive summary, and top bullish/bearish conviction headlines).
2. Always treat the numbers in LIVE WORKSPACE CONTEXT as the authoritative baseline for what is displayed on the user's screen so your figures match the dashboard exactly.
3. Whenever the user asks about information not fully contained in LIVE WORKSPACE CONTEXT (e.g. earnings call commentary, segment revenue mix, SEC filings, historical events, competitor details, or breaking developments), use Google Search to verify up-to-date facts and synthesize both sources seamlessly.
4. Keep responses crisp, high-signal, and institutional:
   - Lead directly with the answer or analytical thesis in 1-2 sentences (no filler greetings or meta-commentary).
   - Cite exact numbers, tickers, multiples, and publisher names where relevant.
   - Use compact Markdown bullet points or a clean Markdown table when comparing metrics across companies.
   - Keep total length focused (typically 120–260 words unless the user asks for an exhaustive deep dive).

LIVE WORKSPACE CONTEXT (JSON):
${JSON.stringify(params.context, null, 2)}`;

  const contents = boundedMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content.trim() }],
  }));

  const config = {
    systemInstruction,
    thinkingConfig: {
      thinkingLevel: ThinkingLevel.LOW,
    },
    tools: [{ googleSearch: {} }],
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    const answerText = (response.text ?? '').trim();
    logGenAICall({
      model,
      prompt: {
        turnCount: boundedMessages.length,
        latestQuestion: latestUserMsg,
        contextSummaryLine: params.context.contextSummaryLine,
      },
      config: {
        thinkingLevel: 'LOW',
        tools: ['googleSearch'],
      },
      output: answerText,
    });

    // Extract deduplicated citations from Dashboard News + Google Search Grounding
    const dashboardPool = collectDashboardNewsPool(params.context);
    const matchedDashboardCitations = matchReferencedDashboardArticles(
      dashboardPool,
      `${latestUserMsg}\n${answerText}`
    );

    const webCitations: ResearchChatCitation[] = [];
    const rawChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

    for (const chunk of rawChunks) {
      const uri = chunk?.web?.uri;
      const title = chunk?.web?.title;
      if (typeof uri === 'string' && uri.startsWith('http')) {
        webCitations.push({
          title:
            typeof title === 'string' && title.trim()
              ? title.trim()
              : extractCleanDomain(uri),
          url: uri,
          domain: extractCleanDomain(uri),
          sourceType: 'web_search',
        });
      }
    }

    const mergedCitations: ResearchChatCitation[] = [];
    const seenUrls = new Set<string>();
    for (const cit of [...matchedDashboardCitations, ...webCitations]) {
      if (!cit.url || seenUrls.has(cit.url)) continue;
      seenUrls.add(cit.url);
      mergedCitations.push(cit);
      if (mergedCitations.length >= APP_CONFIG.researchChat.maxCitations) {
        break;
      }
    }

    return {
      content:
        answerText ||
        'Unable to generate an analysis for that question. Please try rephrasing.',
      citations: mergedCitations,
      modelUsed: model,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logGenAICall({
      model,
      prompt: latestUserMsg,
      config: { tools: ['googleSearch'] },
      error,
    });
    throw error;
  }
}
