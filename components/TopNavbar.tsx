/**
 * ============================================================================
 * FILE: components/TopNavbar.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Institutional 3-Zone Top Navigation Bar for OpticAlpha Investor Intelligence.
 *
 * USE CASES:
 * 1. Enforcing the strict 3-zone Top Bar Contract:
 *    - Zone 1: Single-line Brand Wordmark (`OpticAlpha`).
 *    - Zone 2: 4 concise single-line section navigation links (`News Terminal`,
 *      `Watchlist`, `AI Briefing`, `Firestore Cache`).
 *    - Zone 3: Single primary action button (Google Sign-In / Account status for
 *      personal Firestore article bookmarking).
 * ============================================================================
 */

'use client';

import React from 'react';
import { logFunctionCall } from '@/lib/logger';

export interface TopNavbarProps {
  activeSection: 'market' | 'terminal' | 'watchlist' | 'briefing';
  onSelectSection: (
    section: 'market' | 'terminal' | 'watchlist' | 'briefing'
  ) => void;
  userEmail: string | null;
  onAuthAction: () => void;
}

/**
 * Renders the top navigation header adhering to the Kamino / OpticOdds deep navy
 * palette and 3-zone Top Bar Contract.
 */
export function TopNavbar({
  activeSection,
  onSelectSection,
  userEmail,
  onAuthAction,
}: TopNavbarProps) {
  /**
   * Handles navigation section selection, scrolls smoothly to the section, and logs the interaction.
   */
  const handleNavClick = (
    section: 'market' | 'terminal' | 'watchlist' | 'briefing'
  ) => {
    logFunctionCall('TopNavbar.handleNavClick', { section });
    onSelectSection(section);
    const targetId = section === 'market' ? 'market-overview' : section;
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-4 bg-[#091326]/95 backdrop-blur-md border-b border-[#212c42]">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#terminal"
        onClick={(e) => {
          e.preventDefault();
          handleNavClick('terminal');
        }}
        className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-[#49afe9] transition-colors"
      >
        OpticAlpha
      </a>

      {/* Zone 2: Clean single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          type="button"
          onClick={() => handleNavClick('market')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeSection === 'market'
              ? 'text-white underline underline-offset-8 decoration-[#09a4ff] decoration-2'
              : 'hover:text-white'
          }`}
        >
          Price &amp; Metrics
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('terminal')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeSection === 'terminal'
              ? 'text-white underline underline-offset-8 decoration-[#09a4ff] decoration-2'
              : 'hover:text-white'
          }`}
        >
          News Terminal
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('briefing')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeSection === 'briefing'
              ? 'text-white underline underline-offset-8 decoration-[#09a4ff] decoration-2'
              : 'hover:text-white'
          }`}
        >
          AI Analyst
        </button>
        <button
          type="button"
          onClick={() => handleNavClick('watchlist')}
          className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            activeSection === 'watchlist'
              ? 'text-white underline underline-offset-8 decoration-[#09a4ff] decoration-2'
              : 'hover:text-white'
          }`}
        >
          Saved Watchlist
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
