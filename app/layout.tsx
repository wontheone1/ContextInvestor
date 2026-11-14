/**
 * ============================================================================
 * FILE: app/layout.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Root Next.js Application Layout, Typography Loader, and SEO/OpenGraph Metadata.
 *
 * USE CASES:
 * 1. Loading IBM Plex Sans, Plus Jakarta Sans, and IBM Plex Mono for high-density
 *    quantitative data tables, tabular numerals, and crisp dark-mode legibility.
 * 2. Setting synchronized page title and metadata matching `metadata.json`.
 * ============================================================================
 */

import type { Metadata } from 'next';
import {
  IBM_Plex_Sans,
  Plus_Jakarta_Sans,
  IBM_Plex_Mono,
} from 'next/font/google';
import './globals.css';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-heading',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'OpticAlpha Investor Intelligence',
  description:
    'Quantitative investor dashboard and AI financial research terminal powered by Context.dev company news search, Firestore article caching, and Gemini AI market briefings.',
  openGraph: {
    title: 'OpticAlpha Investor Intelligence',
    description:
      'Quantitative investor dashboard and AI financial research terminal powered by Context.dev company news search, Firestore article caching, and Gemini AI market briefings.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpticAlpha Investor Intelligence',
    description:
      'Quantitative investor dashboard and AI financial research terminal powered by Context.dev company news search, Firestore article caching, and Gemini AI market briefings.',
  },
};

/**
 * Root application layout component wrapping all pages with dark-mode quantitative styling.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${plusJakartaSans.variable} ${ibmPlexMono.variable} dark`}
    >
      <body
        suppressHydrationWarning
        className="bg-[#091326] text-white antialiased selection:bg-[#09a4ff]/30 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
