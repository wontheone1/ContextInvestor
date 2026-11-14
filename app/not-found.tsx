/**
 * ============================================================================
 * FILE: app/not-found.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Custom 404 Not Found Page for Context Investor Intelligence.
 *
 * USE CASES:
 * 1. Providing an explicit App Router `/_not-found` entry point so Next.js 15
 *    production builds (`next build`) reliably generate the `/_not-found` route
 *    even if `next dev` is running concurrently.
 * 2. Guiding users back to the main Context Investor Intelligence News Terminal
 *    when they navigate to a non-existent route.
 * ============================================================================
 */

import React from 'react';
import Link from 'next/link';

/**
 * Renders the 404 Not Found view in the institutional dark-navy palette.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#091326] text-white px-6 text-center">
      <p className="text-xs font-mono-tabular text-[#49afe9] mb-2">
        404 · Route Not Found
      </p>
      <h1 className="text-2xl font-bold tracking-tight mb-3">
        Requested Terminal View Does Not Exist
      </h1>
      <p className="text-sm text-slate-300 max-w-md mb-6">
        Return to the Context Investor Intelligence dashboard to search company
        news and synthesize AI market briefings.
      </p>
      <Link
        href="/"
        className="px-4 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors"
      >
        Return to News Terminal
      </Link>
    </div>
  );
}
