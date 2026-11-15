/**
 * ============================================================================
 * FILE: components/ContextualResearchDrawer.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Collapsible Right-Side Contextual Research Assistant Drawer for
 * Contextual Investing.
 *
 * USE CASES:
 * 1. Letting investors ask natural-language questions beside the live charts,
 *    cohort comparison matrix, and news feed without losing scroll position
 *    or covering the primary workspace on desktop viewports.
 * 2. Automatically displaying the active context scope (`Single Company` or
 *    `Cohort Comparison` + `Watchlist`) and adapting starter prompts as the
 *    investor switches tickers, private unicorns, or screened cohorts.
 * 3. Rendering clean Markdown answers (including tabular-numeral comparison
 *    tables) paired with clickable publisher and Google Search citations,
 *    continuous session history, retry recovery, and a 1-click Clear Chat reset.
 * ============================================================================
 */

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUpRight,
  ExternalLink,
  PanelRightClose,
  Send,
  Trash2,
} from 'lucide-react';
import { BrandFoxLogo } from '@/components/BrandFoxLogo';
import { GracefulErrorBanner } from '@/components/GracefulErrorBanner';
import { useLanguage } from '@/components/LanguageProvider';
import {
  buildDynamicStarterPrompts,
  type ResearchChatMessage,
  type WorkspaceResearchContextPayload,
} from '@/lib/research-chat-types';
import { logFunctionCall } from '@/lib/logger';

export interface ContextualResearchDrawerProps {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  context: WorkspaceResearchContextPayload;
  messages: ResearchChatMessage[];
  isSending: boolean;
  error: string | null;
  onSendMessage: (question: string) => Promise<void>;
  onRetryLastQuestion: () => Promise<void>;
  onClearChat: () => void;
}

/**
 * Formats an ISO timestamp string into a concise `HH:MM` clock readout.
 *
 * @param iso - ISO timestamp string
 * @returns Short formatted time string
 */
function formatTurnTime(iso: string, locale: 'en' | 'ko'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Renders the collapsible right-side Contextual Research Assistant drawer and
 * docked right-edge desktop toggle tab.
 */
export function ContextualResearchDrawer({
  isOpen,
  onOpen,
  onClose,
  context,
  messages,
  isSending,
  error,
  onSendMessage,
  onRetryLastQuestion,
  onClearChat,
}: ContextualResearchDrawerProps) {
  const { locale, t } = useLanguage();
  const isKo = locale === 'ko';
  const [draft, setDraft] = useState<string>('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const starterPrompts = useMemo(
    () => buildDynamicStarterPrompts(context, locale),
    [context, locale]
  );

  // Scroll to newest message when conversation updates while open
  useEffect(() => {
    if (!isOpen) return;
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [isOpen, messages.length, isSending, error]);

  // Focus input when drawer opens & bind Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = setTimeout(() => {
      textareaRef.current?.focus();
    }, 120);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  /**
   * Submits the current draft question if non-empty.
   */
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;
    logFunctionCall('ContextualResearchDrawer.handleSubmit', {
      questionLength: trimmed.length,
      workspaceMode: context.workspaceMode,
    });
    setDraft('');
    await onSendMessage(trimmed);
  };

  /**
   * Sends a clicked starter or follow-up prompt immediately.
   */
  const handleSelectPrompt = async (promptText: string) => {
    if (isSending) return;
    logFunctionCall('ContextualResearchDrawer.handleSelectPrompt', {
      promptText,
      workspaceMode: context.workspaceMode,
    });
    setDraft('');
    await onSendMessage(promptText);
  };

  return (
    <>
      {/* Docked Bottom-Right Quick Handle on Desktop when Drawer is Collapsed (avoids overlapping card Refresh buttons) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            logFunctionCall('ContextualResearchDrawer.openFromEdgeTab', {});
            onOpen();
          }}
          aria-label={t.researchDrawer.drawerTitle}
          className="hidden md:flex fixed right-4 bottom-5 z-30 items-center gap-2 py-2.5 px-3.5 bg-[#0d1b33] hover:bg-[#102344] text-white border border-[#2b3b5a] rounded-xl shadow-lg transition-colors cursor-pointer"
        >
          <BrandFoxLogo size={18} alt="" />
          <span className="text-xs font-semibold whitespace-nowrap">
            {t.researchDrawer.edgeTabLabel}
          </span>
        </button>
      )}

      {/* Mobile / Tablet Scrim Backdrop */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/55 xl:hidden transition-opacity"
        />
      )}

      {/* Right-Side Collapsible Research Drawer */}
      <aside
        aria-label={t.researchDrawer.drawerTitle}
        aria-hidden={!isOpen}
        className={`fixed top-0 right-0 bottom-0 z-40 w-full sm:w-[440px] bg-[#0d1b33] border-l border-[#212c42] flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {/* 1. Drawer Header */}
        <div className="px-5 py-4 border-b border-[#212c42] flex items-center justify-between gap-3 bg-[#091326]">
          <div className="flex items-center gap-3 min-w-0">
            <BrandFoxLogo size={22} framed alt="" />
            <div className="min-w-0">
              <h3 className="text-base font-bold tracking-tight text-white truncate">
                {t.researchDrawer.drawerTitle}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {t.researchDrawer.drawerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                logFunctionCall('ContextualResearchDrawer.onClearChat', {
                  previousCount: messages.length,
                });
                onClearChat();
              }}
              disabled={messages.length === 0 && !error}
              title={t.researchDrawer.clearChat}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed bg-[#0d1b33] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.researchDrawer.clearChat}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                logFunctionCall('ContextualResearchDrawer.onClose', {});
                onClose();
              }}
              title={`${t.common.close} (Esc)`}
              aria-label={t.common.close}
              className="p-2 text-slate-300 hover:text-white bg-[#0d1b33] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors shrink-0 cursor-pointer"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Quiet Unboxed Live Context Scope Line (Zero-Pill Discipline) */}
        <div className="px-5 py-2.5 border-b border-[#212c42] bg-[#0a162b] text-[11px] text-slate-300 font-mono-tabular truncate">
          <span className="text-slate-400">
            {t.researchDrawer.activeContextLabel}{' '}
          </span>
          <span className="text-[#49afe9]">{context.contextSummaryLine}</span>
        </div>

        {/* 3. Scrollable Conversation Thread */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {messages.length === 0 && !isSending ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">
                  {isKo
                    ? `${context.contextShortLabel} 관련 무엇이든 질문하세요`
                    : `Ask anything about ${context.contextShortLabel}`}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isKo
                    ? '모든 질문에는 현재 화면에 표시된 투자 지표, 주가 수익률, 기업 프로필, Context.dev 뉴스 모멘텀은 물론 내 관심종목 브리핑과 실시간 Google 검색 출처가 자동으로 반영됩니다.'
                    : 'Every question automatically includes the financial metrics, price returns, company firmographics, and Context.dev news catalysts currently on screen—plus your followed watchlist briefing and live web search citations when needed.'}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#212c42]">
                <p className="text-xs font-medium text-slate-400">
                  {t.researchDrawer.starterPromptsLabel}
                </p>
                <div className="space-y-2">
                  {starterPrompts.map((promptText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void handleSelectPrompt(promptText)}
                      className="w-full text-left p-3 rounded-lg bg-[#091326] hover:bg-[#102344] border border-[#212c42] hover:border-[#09a4ff]/50 text-xs text-slate-200 hover:text-white transition-colors flex items-start justify-between gap-2.5 cursor-pointer"
                    >
                      <span className="leading-relaxed">{promptText}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#49afe9] shrink-0 mt-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#212c42]">
              {messages.map((msg) => {
                if (msg.role === 'user') {
                  return (
                    <div
                      key={msg.id}
                      className="py-4 first:pt-0 flex flex-col items-end gap-1.5"
                    >
                      <div className="max-w-[90%] px-3.5 py-2.5 rounded-lg bg-[#102344] border border-[#212c42] text-xs sm:text-sm text-white leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-tabular">
                        <span>{msg.contextLabel}</span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span>{formatTurnTime(msg.createdAt, locale)}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className="py-4 first:pt-0 space-y-3">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#49afe9] font-medium font-mono-tabular">
                      <BrandFoxLogo size={14} alt="" />
                      <span>{isKo ? 'AI 애널리스트 종합' : 'Analyst Synthesis'}</span>
                      <span className="text-slate-500" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-slate-400">
                        {formatTurnTime(msg.createdAt, locale)}
                      </span>
                    </div>

                    <div className="markdown-body text-xs sm:text-[13px] text-slate-100 leading-relaxed space-y-2.5">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => (
                            <p className="leading-relaxed text-slate-100">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-4 space-y-1.5 text-slate-200">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-4 space-y-1.5 text-slate-200">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="leading-relaxed">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-semibold text-white">
                              {children}
                            </strong>
                          ),
                          h3: ({ children }) => (
                            <h4 className="text-sm font-semibold text-white pt-1">
                              {children}
                            </h4>
                          ),
                          h4: ({ children }) => (
                            <h5 className="text-xs font-semibold text-[#49afe9] pt-1">
                              {children}
                            </h5>
                          ),
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#49afe9] hover:underline"
                            >
                              {children}
                            </a>
                          ),
                          code: ({ children }) => (
                            <code className="px-1 py-0.5 rounded bg-[#091326] text-[#49afe9] font-mono-tabular text-[11px]">
                              {children}
                            </code>
                          ),
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2 border border-[#212c42] rounded-lg">
                              <table className="w-full text-left border-collapse text-[11px] font-mono-tabular">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-[#091326] text-slate-300 border-b border-[#212c42]">
                              {children}
                            </thead>
                          ),
                          th: ({ children }) => (
                            <th className="py-2 px-2.5 font-semibold whitespace-nowrap">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="py-1.5 px-2.5 border-t border-[#212c42] text-slate-200">
                              {children}
                            </td>
                          ),
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    </div>

                    {/* Clickable Grounding & Dashboard News Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 space-y-1.5">
                        <div className="text-[11px] text-slate-400">
                          {t.researchDrawer.sourcesCitedLabel} ({msg.citations.length})
                        </div>
                        <div className="flex flex-col gap-1">
                          {msg.citations.map((cit, cIdx) => (
                            <a
                              key={`${cit.url}-${cIdx}`}
                              href={cit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-between gap-2 text-[11px] text-slate-300 hover:text-[#49afe9] transition-colors group"
                            >
                              <span className="truncate">
                                <span className="text-slate-400 font-mono-tabular">
                                  {cit.sourceType === 'dashboard_news'
                                    ? isKo
                                      ? '터미널 뉴스'
                                      : 'Terminal News'
                                    : cit.domain}
                                </span>
                                <span className="mx-1.5" aria-hidden="true">
                                  ·
                                </span>
                                <span className="group-hover:underline">
                                  {cit.title}
                                </span>
                              </span>
                              <ExternalLink className="w-3 h-3 shrink-0 text-slate-500 group-hover:text-[#49afe9]" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pending / Synthesizing Indicator */}
          {isSending && (
            <div className="py-3 space-y-2 border-t border-[#212c42]">
              <div className="text-xs text-[#49afe9] font-medium">
                {t.researchDrawer.thinkingStatus}
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-full bg-[#162849] rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-[#162849] rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-[#162849] rounded animate-pulse" />
              </div>
            </div>
          )}

          {/* Non-Blocking Error Recovery */}
          {error && !isSending && (
            <GracefulErrorBanner
              error={error}
              onRetry={() => void onRetryLastQuestion()}
              contextKey={`chat:${messages.length}:${locale}`}
              enableAutoRetry={false}
              compact
            />
          )}

          <div ref={scrollEndRef} />
        </div>

        {/* 4. Quick Follow-Up Prompts when Session is Active */}
        {messages.length > 0 && !isSending && (
          <div className="px-5 py-2 border-t border-[#212c42] bg-[#0a162b] flex items-center gap-1.5 overflow-x-auto">
            {starterPrompts.slice(0, 2).map((promptText, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => void handleSelectPrompt(promptText)}
                title={promptText}
                className="px-2.5 py-1 text-[11px] text-slate-300 hover:text-white bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-md transition-colors truncate max-w-[260px] shrink-0 cursor-pointer"
              >
                {promptText}
              </button>
            ))}
          </div>
        )}

        {/* 5. Composer Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-[#212c42] bg-[#091326] space-y-2"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder={t.researchDrawer.composerPlaceholder}
              aria-label={t.researchDrawer.drawerTitle}
              className="flex-1 resize-none px-3 py-2 text-xs sm:text-sm text-white bg-[#0d1b33] border border-[#212c42] rounded-lg focus:outline-none focus:border-[#09a4ff] leading-relaxed"
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              aria-label={t.researchDrawer.sendButton}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] disabled:opacity-45 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{t.researchDrawer.sendButton}</span>
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>{t.researchDrawer.sendHint}</span>
            <span className="font-mono-tabular">
              {isKo ? 'Cmd/Ctrl+K 열기/닫기' : 'Cmd/Ctrl+K toggles'}
            </span>
          </div>
        </form>
      </aside>
    </>
  );
}
