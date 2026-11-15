/**
 * ============================================================================
 * FILE: components/SdkCacheInspector.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Saved Research Library Stage (`04. Saved Library`) for Bookmarked Company News
 * & High-Conviction Catalyst Stories.
 *
 * USE CASES:
 * 1. Displaying user-bookmarked articles stored in Firestore (`/saved_articles`)
 *    with clean inline metadata (`Company · Publisher · Article Type`) and
 *    1-click company deep-dive pivoting.
 * 2. Guiding signed-out or empty-library users step-by-step on where to find
 *    and bookmark high-conviction stories (`Daily Brief` or `Research & Compare`).
 * ============================================================================
 */

'use client';

import React from 'react';
import { ArrowRight, Bookmark, ExternalLink, Trash2 } from 'lucide-react';
import { formatTickerWithAdr } from '@/lib/adr-directory';
import type { SavedArticleRecord } from '@/lib/firebase-client';
import { BrandFoxLogo } from '@/components/BrandFoxLogo';
import { useLanguage } from '@/components/LanguageProvider';
import { translateArticleType } from '@/lib/i18n';
import { logFunctionCall } from '@/lib/logger';

export interface SdkCacheInspectorProps {
  savedArticles: Array<SavedArticleRecord & { docId: string }>;
  onRemoveSavedArticle: (docId: string) => void;
  userEmail: string | null;
  onSignIn: () => void;
  onGoToDailyBrief?: () => void;
  onGoToResearch?: () => void;
  onSelectSavedCompany?: (companyTag: string) => void;
}

/**
 * Renders the Saved Articles Research Library card.
 */
export function SdkCacheInspector({
  savedArticles,
  onRemoveSavedArticle,
  userEmail,
  onSignIn,
  onGoToDailyBrief,
  onGoToResearch,
  onSelectSavedCompany,
}: SdkCacheInspectorProps) {
  const { locale, t } = useLanguage();

  return (
    <section
      id="saved-library"
      aria-label={t.savedLibrary.pageTitle}
      className="rounded-xl bg-[#0d1b33] border border-[#212c42] p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-[#212c42]">
        <div className="flex items-center gap-3">
          <BrandFoxLogo size={22} framed alt="" />
          <div>
            <h2 className="text-lg font-bold text-white">
              {t.savedLibrary.headerTitle}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {t.savedLibrary.pageSubtitle}
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-300 font-mono-tabular whitespace-nowrap shrink-0">
          {savedArticles.length} {t.savedLibrary.savedCountSuffix}
        </span>
      </div>

      {!userEmail ? (
        <div className="py-12 text-center border border-dashed border-[#212c42] rounded-lg px-6">
          <Bookmark className="w-6 h-6 text-[#49afe9] mx-auto mb-2.5" />
          <p className="text-base font-semibold text-white mb-1">
            {t.savedLibrary.signInPromptTitle}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
            {t.savedLibrary.signInPromptBody}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                logFunctionCall('SdkCacheInspector.onSignIn', {});
                onSignIn();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t.nav.signInWithGoogle}
            </button>
            {onGoToDailyBrief && (
              <button
                type="button"
                onClick={onGoToDailyBrief}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.watchlist.openDailyBriefBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : savedArticles.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-[#212c42] rounded-lg px-6">
          <Bookmark className="w-6 h-6 text-[#49afe9] mx-auto mb-2.5" />
          <p className="text-base font-semibold text-white mb-1">
            {t.savedLibrary.emptySavedTitle}
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
            {t.savedLibrary.emptySavedBody}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onGoToDailyBrief && (
              <button
                type="button"
                onClick={onGoToDailyBrief}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.watchlist.openDailyBriefBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onGoToResearch && (
              <button
                type="button"
                onClick={onGoToResearch}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{t.nav.research}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#212c42]">
          {savedArticles.map((item) => {
            const rawTag = (item.companyTag || '').trim();
            const displayCompanyTag = /^[A-Z]{1,5}(-[A-Z]{1,2})?$/.test(rawTag)
              ? formatTickerWithAdr(rawTag)
              : item.companyTag;

            return (
              <div
                key={item.docId}
                className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono-tabular mb-1">
                    {onSelectSavedCompany ? (
                      <button
                        type="button"
                        onClick={() => onSelectSavedCompany(item.companyTag)}
                        className="text-[#49afe9] hover:text-white font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {displayCompanyTag}
                      </button>
                    ) : (
                      <span className="text-[#49afe9] font-semibold">
                        {displayCompanyTag}
                      </span>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{item.sourceName}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {translateArticleType(item.articleType, locale)}
                    </span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-white hover:text-[#49afe9] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>{item.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  </a>
                  {item.description && (
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2 max-w-3xl leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    logFunctionCall('SdkCacheInspector.onRemoveSavedArticle', {
                      docId: item.docId,
                    });
                    onRemoveSavedArticle(item.docId);
                  }}
                  className="p-2 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                  title={t.savedLibrary.removeBookmarkTooltip}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
