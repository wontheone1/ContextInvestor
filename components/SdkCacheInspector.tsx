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
  lastRequestPayload: unknown;
  lastCacheKey: string;
  cacheStatus: 'hit' | 'miss' | 'live' | 'idle';
  keyConfigured: boolean;
  apiMode: string;
  warningMessage: string | null;
  savedArticles: Array<SavedArticleRecord & { docId: string }>;
  onRemoveSavedArticle: (docId: string) => void;
  userEmail: string | null;
  onSignIn: () => void;
}

/**
 * Renders the SDK Request Inspector and Saved Firestore Watchlist view.
 */
export function SdkCacheInspector({
  lastRequestPayload,
  lastCacheKey,
  cacheStatus,
  keyConfigured,
  apiMode,
  warningMessage,
  savedArticles,
  onRemoveSavedArticle,
  userEmail,
  onSignIn,
}: SdkCacheInspectorProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
      {/* Left 6 cols: Official Context.dev SDK Request & Firestore Cache Inspector */}
      <div className="lg:col-span-6 rounded-xl bg-[#0d1b33] border border-[#212c42] p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">
            Context.dev SDK &amp; Firestore Cache Inspector
          </h2>
          <span className="text-xs text-[#49afe9] font-mono-tabular">
            POST /v1/news/search
          </span>
        </div>

        <div className="space-y-2 text-xs text-slate-300 font-mono-tabular mb-4">
          <div>
            <span className="text-slate-400">SDK Method: </span>
            <span className="text-white">client.news.search(params)</span>
          </div>
          <div>
            <span className="text-slate-400">Firestore Cache Doc: </span>
            <span className="text-[#49afe9]">
              /cached_searches/{lastCacheKey || 'none'}
            </span>
          </div>
          <div>
            <span className="text-slate-400">Cache State: </span>
            <span className="text-emerald-400">{cacheStatus.toUpperCase()}</span>
            <span aria-hidden="true"> · </span>
            <span className="text-slate-400">Mode: </span>
            <span className="text-white">{apiMode}</span>
          </div>
        </div>

        {!keyConfigured && warningMessage && (
          <div className="p-3.5 rounded-lg bg-[#091326] border border-[#09a4ff]/40 text-xs text-slate-300 mb-4 leading-relaxed">
            <p className="font-semibold text-white mb-1">
              Configure CONTEXT_DEV_API_KEY in .env.local for Live Queries
            </p>
            <p>{warningMessage}</p>
          </div>
        )}

        <div>
          <div className="text-xs font-medium text-slate-400 mb-2">
            Active SDK Request Payload:
          </div>
          <pre className="p-4 rounded-lg bg-[#091326] border border-[#212c42] text-xs text-[#49afe9] font-mono-tabular overflow-x-auto">
            {JSON.stringify(lastRequestPayload ?? {}, null, 2)}
          </pre>
        </div>
      </div>

      {/* Right 6 cols: Saved Articles in Firestore (/saved_articles) */}
      <div className="lg:col-span-6 rounded-xl bg-[#0d1b33] border border-[#212c42] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Bookmarked Articles in Firestore
            </h2>
            <p className="text-xs text-slate-400">
              Collection: /saved_articles (Owner-Isolated Security Rules)
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
              Search results are automatically cached in Firestore{' '}
              <code className="text-[#49afe9]">/cached_searches</code>. Sign in
              with Google to bookmark individual articles to{' '}
              <code className="text-[#49afe9]">/saved_articles</code>.
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
              Click &ldquo;Save&rdquo; on any news article in the terminal to persist it
              to your Firestore watchlist.
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
                  title="Remove from Firestore"
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
