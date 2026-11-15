/**
 * ============================================================================
 * FILE: components/LanguageSwitcher.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Compact, single-line segmented language toggle (`EN` | `한국어`) for switching
 * Contextual Investing between English and Korean.
 *
 * USE CASES:
 * 1. Placed in the Top Workspace Toolbar (`app/page.tsx`) beside the Research
 *    Assistant action so users can switch languages above the fold on any tab
 *    while preserving the strict 3-zone Top Bar Contract in `TopNavbar.tsx`.
 * 2. Placed in the Pitch Deck presenter control bar and workspace footer for
 *    convenient access during live demos or full-screen presentations.
 * ============================================================================
 */

'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export interface LanguageSwitcherProps {
  compact?: boolean;
}

/**
 * Renders a crisp segmented `EN | 한국어` language selector wired to `useLanguage()`.
 */
export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t.toolbar.languageLabel}
      className={`inline-flex items-center gap-1 rounded-lg border border-[#212c42] bg-[#0d1b33] p-0.5 whitespace-nowrap shrink-0 ${
        compact ? 'text-[11px]' : 'text-xs'
      }`}
    >
      <span
        className="inline-flex items-center pl-2 pr-1 text-slate-400"
        title={t.toolbar.languageLabel}
      >
        <Globe className="w-3.5 h-3.5 text-[#09a4ff]" aria-hidden="true" />
      </span>
      <button
        type="button"
        onClick={() => setLocale('en')}
        aria-pressed={locale === 'en'}
        className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          locale === 'en'
            ? 'bg-[#09a4ff] text-slate-950 font-semibold shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLocale('ko')}
        aria-pressed={locale === 'ko'}
        className={`px-2.5 py-1 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          locale === 'ko'
            ? 'bg-[#09a4ff] text-slate-950 font-semibold shadow-sm'
            : 'text-slate-300 hover:text-white hover:bg-white/5'
        }`}
      >
        한국어
      </button>
    </div>
  );
}
