/**
 * ============================================================================
 * FILE: components/TopNavbar.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Institutional 3-Zone Top Navigation Bar for Contextual Investing.
 *
 * USE CASES:
 * 1. Enforcing the strict 3-zone Top Bar Contract:
 *    - Zone 1: Single-line Brand Wordmark (`Contextual Investing`).
 *    - Zone 2: 4 concise single-line stage navigation links (`Watchlist`,
 *      `Morning Brief`, `Research & Compare`, `Saved Library`).
 *    - Zone 3: Single primary action button (Google Sign-In / Account status for
 *      personal Firestore article bookmarking and watchlist persistence).
 * ============================================================================
 */

'use client';

import React from 'react';
import { logFunctionCall } from '@/lib/logger';

export type WorkspaceStageId = 'watchlist' | 'pulse' | 'research' | 'saved';

export interface TopNavbarProps {
  activeStage: WorkspaceStageId;
  onSelectStage: (stage: WorkspaceStageId) => void;
  userEmail: string | null;
  onAuthAction: () => void;
}

/**
 * Renders the top navigation header adhering to the deep navy palette
 * and strict 3-zone Top Bar Contract.
 */
export function TopNavbar({
  activeStage,
  onSelectStage,
  userEmail,
  onAuthAction,
}: TopNavbarProps) {
  /**
   * Switches the active workspace stage and scrolls cleanly to the top of the workspace.
   */
  const handleNavClick = (stage: WorkspaceStageId) => {
    logFunctionCall('TopNavbar.handleNavClick', { stage });
    onSelectStage(stage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-4 bg-[#091326]/95 backdrop-blur-md border-b border-[#212c42]">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#workspace-top"
        onClick={(e) => {
          e.preventDefault();
          handleNavClick('research');
        }}
        className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-[#49afe9] transition-colors"
      >
        Contextual Investing
      </a>

      {/* Zone 2: 4 clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          type="button"
          onClick={() => handleNavClick('research')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeStage === 'research'
              ? 'text-white underline underline-offset-8 decoration-[#09a4ff] decoration-2'
              : 'hover:text-white'
          }`}
        >
          Research &amp; Compare
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('pulse')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeStage === 'pulse'
              ? 'text-white underline underline-offset-8 decoration-[#09a4ff] decoration-2'
              : 'hover:text-white'
          }`}
        >
          Morning Brief
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('watchlist')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeStage === 'watchlist'
              ? 'text-white underline underline-offset-8 decoration-[#09a4ff] decoration-2'
              : 'hover:text-white'
          }`}
        >
          Watchlist
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('saved')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeStage === 'saved'
              ? 'text-white underline underline-offset-8 decoration-[#09a4ff] decoration-2'
              : 'hover:text-white'
          }`}
        >
          Saved Library
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => {
            logFunctionCall('TopNavbar.onAuthAction', {
              isSignedIn: Boolean(userEmail),
            });
            onAuthAction();
          }}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#09a4ff] hover:bg-[#49afe9] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {userEmail ? `Sign Out (${userEmail.split('@')[0]})` : 'Sign In with Google'}
        </button>
      </div>
    </header>
  );
}
