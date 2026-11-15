/**
 * ============================================================================
 * FILE: app/api/pitch/pptx/route.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Server-side PowerPoint (`.pptx`) generator for the 10-Slide Hackathon Pitch Deck.
 *
 * Accepts the 10 slide definitions and rasterized `data:image/png;base64,...`
 * product screenshots from `HackathonPitchDeck`, builds a widescreen (`16:9`)
 * presentation with speaker notes using `pptxgenjs` in Node.js, and returns
 * the binary `.pptx` stream for immediate download.
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';
import type { PitchSlideDefinition } from '@/components/HackathonPitchDeck';
import { logFunctionCall } from '@/lib/logger';

interface GeneratePptxPayload {
  slides: PitchSlideDefinition[];
  pngByUrl?: Record<string, string>;
}

export async function POST(req: NextRequest) {
  logFunctionCall('POST /api/pitch/pptx', {});

  try {
    const body = (await req.json()) as GeneratePptxPayload;
    const slides = Array.isArray(body.slides) ? body.slides : [];
    const pngByUrl = body.pngByUrl || {};

    if (slides.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No slides provided for PPTX generation.' },
        { status: 400 }
      );
    }

    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 inches (16:9)
    pres.author = 'Contextual Investing Team';
    pres.company = 'Contextual Investing';
    pres.subject = 'Hackathon Submission Pitch Deck';
    pres.title =
      'Contextual Investing — Real-Time Web & Supply-Chain Intelligence';

    for (const slideDef of slides) {
      const slide = pres.addSlide();
      slide.background = { color: '091326' };

      // Top Kicker & Timing
      slide.addText(
        `${slideDef.sectionKicker}   ·   Pitch Timing: ${slideDef.timeWindow}   ·   Slide ${slideDef.numberLabel}`,
        {
          x: 0.45,
          y: 0.28,
          w: 12.4,
          h: 0.3,
          fontSize: 10,
          fontFace: 'Arial',
          bold: true,
          color: '49AFE9',
        }
      );

      // Slide Headline
      slide.addText(slideDef.title, {
        x: 0.45,
        y: 0.58,
        w: 12.4,
        h: 0.55,
        fontSize: 21,
        fontFace: 'Arial',
        bold: true,
        color: 'FFFFFF',
      });

      // Subtitle
      slide.addText(slideDef.subtitle, {
        x: 0.45,
        y: 1.12,
        w: 12.4,
        h: 0.4,
        fontSize: 11.5,
        fontFace: 'Arial',
        color: 'CBD5E1',
      });

      // Left Column: Everyday Analogy Box
      slide.addShape(pres.ShapeType.rect, {
        x: 0.45,
        y: 1.62,
        w: 5.45,
        h: 1.25,
        fill: { color: '0D1B33' },
        line: { color: '09A4FF', width: 1 },
      });
      slide.addText(slideDef.analogyTitle, {
        x: 0.6,
        y: 1.72,
        w: 5.15,
        h: 0.28,
        fontSize: 11,
        fontFace: 'Arial',
        bold: true,
        color: '49AFE9',
      });
      slide.addText(slideDef.analogyText, {
        x: 0.6,
        y: 2.0,
        w: 5.15,
        h: 0.78,
        fontSize: 10,
        fontFace: 'Arial',
        color: 'F1F5F9',
        valign: 'top',
      });

      // Left Column: 3 Key Points
      slideDef.keyPoints.forEach((pt, idx) => {
        const boxY = 3.0 + idx * 0.98;
        slide.addShape(pres.ShapeType.rect, {
          x: 0.45,
          y: boxY,
          w: 5.45,
          h: 0.88,
          fill: { color: '0D1B33' },
          line: { color: '212C42', width: 1 },
        });
        slide.addText(pt.heading, {
          x: 0.6,
          y: boxY + 0.08,
          w: 5.15,
          h: 0.26,
          fontSize: 10.5,
          fontFace: 'Arial',
          bold: true,
          color: 'FFFFFF',
        });
        slide.addText(pt.detail, {
          x: 0.6,
          y: boxY + 0.34,
          w: 5.15,
          h: 0.46,
          fontSize: 9.5,
          fontFace: 'Arial',
          color: 'CBD5E1',
          valign: 'top',
        });
      });

      // Left Column Footer: Plain-English Guide for Judges
      slide.addShape(pres.ShapeType.rect, {
        x: 0.45,
        y: 6.02,
        w: 5.45,
        h: 1.15,
        fill: { color: '0A162B' },
        line: { color: '212C42', width: 1 },
      });
      const jargonText = slideDef.jargonTranslator
        .map((j) => `${j.term}: ${j.plainMeaning}`)
        .join('\n');
      slide.addText(`Plain-English Guide for Judges:\n${jargonText}`, {
        x: 0.6,
        y: 6.08,
        w: 5.15,
        h: 1.0,
        fontSize: 8.8,
        fontFace: 'Arial',
        color: '94A3B8',
        valign: 'top',
      });

      // Right Column: Embedded High-Res Live App Screenshot
      const pngData = pngByUrl[slideDef.screenshotUrl];
      if (pngData && pngData.startsWith('data:image/png;base64,')) {
        slide.addImage({
          data: pngData,
          x: 6.1,
          y: 1.62,
          w: 6.78,
          h: 3.81,
        });
      }

      // Right Column Bottom: Spoken Pitch Script Box
      slide.addShape(pres.ShapeType.rect, {
        x: 6.1,
        y: 5.55,
        w: 6.78,
        h: 1.62,
        fill: { color: '0D1B33' },
        line: { color: '212C42', width: 1 },
      });
      slide.addText(`Spoken Pitch Script (${slideDef.timeWindow}):`, {
        x: 6.25,
        y: 5.63,
        w: 6.48,
        h: 0.25,
        fontSize: 10,
        fontFace: 'Arial',
        bold: true,
        color: '34D399',
      });
      slide.addText(`"${slideDef.speakerScript}"`, {
        x: 6.25,
        y: 5.9,
        w: 6.48,
        h: 1.18,
        fontSize: 9.5,
        fontFace: 'Arial',
        italic: true,
        color: 'E2E8F0',
        valign: 'top',
      });

      // Add native PowerPoint Speaker Notes
      slide.addNotes(
        `[${slideDef.timeWindow}] ${slideDef.title}\n\nSpoken Script:\n${slideDef.speakerScript}\n\nScreenshot Shown:\n${slideDef.screenshotCaption}`
      );
    }

    const buffer = (await pres.write({ outputType: 'nodebuffer' })) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition':
          'attachment; filename="Contextual-Investing-Hackathon-Pitch.pptx"',
      },
    });
  } catch (error) {
    console.error('Error generating PPTX on server:', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Failed to generate PPTX.',
      },
      { status: 500 }
    );
  }
}
