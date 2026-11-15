/**
 * ============================================================================
 * FILE: components/BrandFoxLogo.tsx
 * ============================================================================
 * FEATURE OVERVIEW:
 * Reusable Fox Brand Emblem Component for Contextual Investing.
 *
 * USE CASES:
 * 1. Rendering the crisp white-on-dark Fox emblem (`/fox-logo-white.png`) in
 *    the Top Navigation Bar wordmark lockup, Workspace Footer, Daily Brief
 *    header, Contextual Research Assistant drawer, Saved Library, and the
 *    10-Slide Hackathon Pitch Deck.
 * 2. Supporting both unframed inline silhouettes (for navigation/footer brand
 *    lockups) and framed crest containers (for AI Analyst & briefing headers).
 * 3. Providing automatic fallback resilience to `/fox-logo.png` with optical
 *    luminance inversion so the mark never breaks on any surface.
 * ============================================================================
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export interface BrandFoxLogoProps {
  /** Pixel width & height of the square Fox mark (default: 26) */
  size?: number;
  /** Visual variant: 'light' (crisp white mark for dark navy surfaces) or 'charcoal' (original dark mark for light surfaces) */
  variant?: 'light' | 'charcoal';
  /** When true, renders inside a subtle dark-navy bordered crest square */
  framed?: boolean;
  /** Additional Tailwind utility classes */
  className?: string;
  /** Accessible alt label (empty string when decorative next to "Contextual Investing" text) */
  alt?: string;
  /** Priority preload flag for above-the-fold header mark */
  priority?: boolean;
}

/**
 * Renders the Contextual Investing Fox brand mark using Next.js `<Image>`
 * optimization, `referrerPolicy="no-referrer"`, and resilient fallback handling.
 */
export function BrandFoxLogo({
  size = 26,
  variant = 'light',
  framed = false,
  className = '',
  alt = 'Contextual Investing Fox Logo',
  priority = false,
}: BrandFoxLogoProps) {
  const [useFallback, setUseFallback] = useState<boolean>(false);

  const primarySrc =
    variant === 'light' ? '/fox-logo-white.png' : '/fox-logo.png';
  const fallbackSrc = '/fox-logo.png';

  const imgElement = (
    <Image
      src={useFallback ? fallbackSrc : primarySrc}
      alt={alt}
      width={size}
      height={size}
      priority={priority}
      referrerPolicy="no-referrer"
      onError={() => {
        if (!useFallback) {
          setUseFallback(true);
        }
      }}
      className={`object-contain select-none shrink-0 ${
        useFallback && variant === 'light' ? 'brightness-0 invert' : ''
      } ${framed ? '' : className}`}
    />
  );

  if (!framed) {
    return imgElement;
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg bg-[#102344] border border-[#09a4ff]/35 p-1.5 shrink-0 ${className}`}
    >
      {imgElement}
    </span>
  );
}
