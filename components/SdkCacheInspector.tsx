/**
 * ============================================================================
 * FILE: components/SdkCacheInspector.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Context.dev SDK Payload & Firestore Cache Diagnostic Inspector.
 *
 * USE CASES:
 * 1. Displaying the exact `client.news.search(...)` SDK request payload sent to
 *    `POST https://api.context.dev/v1/news/search` (`searchBy`, `filterBy`,
 *    `sortBy`, `limit`, `cursor`).
 * 2. Showing the live Firestore cache status (`cached_searches/{cacheId}`),
 *    whether `CONTEXT_DEV_API_KEY` is active in `.env.local`, and user-saved
 *    articles in `saved_articles`.
 * ============================================================================
 */

'use client';

import React from 'react';
import { Trash2, ExternalLink } from 'lucide-react';
import type { SavedArticleRecord } from '@/lib/firebase-client';

export interface SdkCacheInspectorProps {
  savedArticles: Array<SavedArticleRecord & { docId: string }>;
  onRemoveSavedArticle: (docId: string) => void;
  userEmail: string | null;
  onSignIn: () => void;
}

/**
 * Renders the Saved Articles Watchlist section.
 */
export function SdkCacheInspector({
  savedArticles,
  onRemoveSavedArticle,
  userEmail,
  onSignIn,
}: SdkCacheInspectorProps) {
  return (
    <div className="mt-8">
      {/* Saved Articles Watchlist */}
      <div
        id="watchlist"
        className="rounded-xl bg-[#0d1b33] border border-[#212c42] p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Saved Articles Watchlist
            </h2>
            <p className="text-xs text-slate-400">
              Your bookmarked company news and research articles
            </p>
          </div>
          <span className="text-xs text-slate-300 font-mono-tabular">
            {savedArticles.length} Saved
          </span>
        </div>

        {!userEmail ? (
          <div className="py-10 text-center border border-dashed border-[#212c42] rounded-lg px-4">
            <p className="text-sm font-medium text-white mb-1">
              Sign in to Save Articles to Your Personal Watchlist
            </p>
            <p className="text-xs text-slate-400 mb-4">
              Sign in with Google to bookmark individual articles and sync your
              personal research watchlist across sessions.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors cursor-pointer"
            >
              Sign In with Google
            </button>
          </div>
        ) : savedArticles.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-[#212c42] rounded-lg px-4">
            <p className="text-sm font-medium text-slate-300 mb-1">
              No Bookmarked Articles Yet
            </p>
            <p className="text-xs text-slate-400">
              Click &ldquo;Save&rdquo; on any news article in the terminal to add it
              to your personal watchlist.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#212c42] max-h-80 overflow-y-auto">
            {savedArticles.map((item) => (
              <div
                key={item.docId}
                className="py-3 flex items-start justify-between gap-4"
              >
                <div>
                  <div className="text-xs text-slate-400 font-mono-tabular mb-0.5">
                    <span className="text-[#49afe9]">{item.companyTag}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{item.sourceName}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{item.articleType}</span>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-white hover:text-[#49afe9] transition-colors flex items-center gap-1"
                  >
                    <span>{item.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveSavedArticle(item.docId)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Remove from watchlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
