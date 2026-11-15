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
import './globals.css';

export const metadata: Metadata = {
  title: 'Contextual Investing',
  description:
    'Quantitative investor dashboard and AI financial research terminal powered by Context.dev.',
  icons: {
    icon: [
      { url: '/fox-logo.png', type: 'image/png', sizes: '512x512' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/fox-logo.png', sizes: '512x512', type: 'image/png' }],
  },
  openGraph: {
    title: 'Contextual Investing',
    description:
      'Quantitative investor dashboard and AI financial research terminal powered by Context.dev.',
    type: 'website',
    images: [
      {
        url: '/fox-logo.png',
        width: 512,
        height: 512,
        alt: 'Contextual Investing Fox Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contextual Investing',
    description:
      'Quantitative investor dashboard and AI financial research terminal powered by Context.dev.',
    images: ['/fox-logo.png'],
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
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700&display=swap"
        />
      </head>
      <body
        suppressHydrationWarning
        className="bg-[#091326] text-white antialiased selection:bg-[#09a4ff]/30 selection:text-white"
      >
        {children}
      </body>
    </html>
  );
}
