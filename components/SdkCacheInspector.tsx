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
 *    and bookmark high-conviction stories (`Morning Brief` or `Research & Compare`).
 * ============================================================================
 */

'use client';

import React from 'react';
import { ArrowRight, Bookmark, ExternalLink, Trash2 } from 'lucide-react';
import type { SavedArticleRecord } from '@/lib/firebase-client';
import { BrandFoxLogo } from '@/components/BrandFoxLogo';
import { logFunctionCall } from '@/lib/logger';

export interface SdkCacheInspectorProps {
  savedArticles: Array<SavedArticleRecord & { docId: string }>;
  onRemoveSavedArticle: (docId: string) => void;
  userEmail: string | null;
  onSignIn: () => void;
  onGoToMorningBrief?: () => void;
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
  onGoToMorningBrief,
  onGoToResearch,
  onSelectSavedCompany,
}: SdkCacheInspectorProps) {
  return (
    <section
      id="saved-library"
      aria-label="Saved Research Library"
      className="rounded-xl bg-[#0d1b33] border border-[#212c42] p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-[#212c42]">
        <div className="flex items-center gap-3">
          <BrandFoxLogo size={22} framed alt="" />
          <div>
            <h2 className="text-lg font-bold text-white">
              Saved Research Library
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Bookmarked catalyst headlines, regulatory filings, and company news synced to your account
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-300 font-mono-tabular">
          {savedArticles.length} {savedArticles.length === 1 ? 'Article' : 'Articles'} Saved
        </span>
      </div>

      {!userEmail ? (
        <div className="py-12 text-center border border-dashed border-[#212c42] rounded-lg px-6">
          <Bookmark className="w-6 h-6 text-[#49afe9] mx-auto mb-2.5" />
          <p className="text-base font-semibold text-white mb-1">
            Sign in to Save High-Conviction Articles
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
            Connect with Google to bookmark articles from your Morning Brief or Company News feed and keep a permanent research log across sessions.
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
              Sign In with Google
            </button>
            {onGoToMorningBrief && (
              <button
                type="button"
                onClick={onGoToMorningBrief}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Browse Morning Brief</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : savedArticles.length === 0 ? (
        <div className="py-12 text-center border border-dashed border-[#212c42] rounded-lg px-6">
          <Bookmark className="w-6 h-6 text-[#49afe9] mx-auto mb-2.5" />
          <p className="text-base font-semibold text-white mb-1">
            Your Saved Library Is Empty
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5 leading-relaxed">
            Click &ldquo;Save&rdquo; on any catalyst in your Morning Brief or any article in the Research news feed to build your reading list.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onGoToMorningBrief && (
              <button
                type="button"
                onClick={onGoToMorningBrief}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Review Morning Brief</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {onGoToResearch && (
              <button
                type="button"
                onClick={onGoToResearch}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 bg-[#091326] hover:bg-[#102344] border border-[#212c42] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Search Company News</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y divide-[#212c42]">
          {savedArticles.map((item) => (
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
                      {item.companyTag}
                    </button>
                  ) : (
                    <span className="text-[#49afe9] font-semibold">
                      {item.companyTag}
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{item.sourceName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.articleType}</span>
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
                title="Remove saved article"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
