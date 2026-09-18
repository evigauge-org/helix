"use client";

import { useState } from "react";
import Image from "next/image";
import type { Slide, DeckStructure } from "@/lib/slide-types";
import { ChevronLeft, ChevronRight } from "lucide-react";

const BLUE = "#0085CF";
const DARK_BLUE = "#003754";
const ACCENT = "#10B981";

// ── Individual slide renderers ──

function TitleSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col justify-center p-8 text-white relative" style={{ background: DARK_BLUE }}>
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: BLUE }} />
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">{slide.title}</h1>
      {slide.subtitle && (
        <p className="mt-4 text-lg sm:text-xl text-sky-200">{slide.subtitle}</p>
      )}
      <div className="absolute bottom-0 left-0 right-0 py-3 px-8 text-xs sm:text-sm" style={{ background: BLUE }}>
        Helix Intelligence
      </div>
    </div>
  );
}

function PromiseSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col justify-center p-8 bg-white relative">
      <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: ACCENT }} />
      <div className="text-[10px] sm:text-xs font-bold tracking-[0.2em]" style={{ color: ACCENT }}>
        EMPOWERMENT PROMISE
      </div>
      <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold" style={{ color: DARK_BLUE }}>
        {slide.title}
      </h2>
      <ul className="mt-6 space-y-3">
        {slide.bullets?.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-2 size-2 rounded-full shrink-0" style={{ background: ACCENT }} />
            <span className="text-sm sm:text-base text-gray-700 leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InspirationSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col justify-center p-8 text-white relative" style={{ background: BLUE }}>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6">{slide.title}</h2>
      <ul className="space-y-3">
        {slide.bullets?.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-1.5 size-1.5 rounded-full bg-sky-200 shrink-0" />
            <span className="text-sm sm:text-base leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeuristicSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col p-8 bg-white relative">
      <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ background: BLUE }} />
      <div className="text-[10px] sm:text-xs font-bold tracking-[0.2em]" style={{ color: BLUE }}>
        HEURISTIC
      </div>
      <div className="mt-1 text-base sm:text-lg text-gray-500">{slide.title}</div>
      <div className="mt-4 flex-1 flex items-center">
        <p className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight" style={{ color: DARK_BLUE }}>
          {slide.heuristic}
        </p>
      </div>
      {slide.evidence && (
        <div className="mt-4 rounded-lg bg-gray-50 p-3 sm:p-4">
          <div className="text-[10px] font-bold tracking-[0.2em] mb-1" style={{ color: BLUE }}>
            EVIDENCE
          </div>
          <p className="text-xs sm:text-sm italic text-gray-700">{slide.evidence}</p>
        </div>
      )}
    </div>
  );
}

function ContentSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col p-8 bg-white relative">
      <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: BLUE }} />
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: DARK_BLUE }}>
        {slide.title}
      </h2>
      <div className="mt-2 h-0.5 w-16" style={{ background: BLUE }} />
      <ul className="mt-5 space-y-3 flex-1">
        {slide.bullets?.map((b, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className="mt-2 size-1.5 rounded-full shrink-0" style={{ background: BLUE }} />
            <span className="text-sm sm:text-base text-gray-700 leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TwoColumnSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col p-8 bg-white relative">
      <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: BLUE }} />
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: DARK_BLUE }}>
        {slide.title}
      </h2>
      <div className="mt-2 h-0.5 w-16" style={{ background: BLUE }} />
      <div className="mt-5 flex-1 grid grid-cols-2 gap-3 sm:gap-4">
        {[slide.leftColumn, slide.rightColumn].map((col, i) =>
          col ? (
            <div key={i} className="rounded-lg bg-gray-50 p-3 sm:p-4">
              <div className="text-sm sm:text-base font-bold mb-2" style={{ color: BLUE }}>
                {col.heading}
              </div>
              <ul className="space-y-2">
                {col.bullets.map((b, bi) => (
                  <li key={bi} className="flex items-start gap-2">
                    <div className="mt-1.5 size-1 rounded-full shrink-0" style={{ background: BLUE }} />
                    <span className="text-xs sm:text-sm text-gray-700 leading-snug">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}

function KeyStatSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col p-8 bg-white relative">
      <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: BLUE }} />
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: DARK_BLUE }}>
        {slide.title}
      </h2>
      <div className="flex-1 flex flex-col items-center justify-center rounded-xl bg-gray-50 mt-4 p-4">
        <div className="text-5xl sm:text-6xl md:text-7xl font-bold" style={{ color: BLUE }}>
          {slide.stat}
        </div>
        <div className="mt-3 text-sm sm:text-base text-gray-500 text-center">{slide.statLabel}</div>
      </div>
    </div>
  );
}

function QuoteSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col p-8 bg-white relative">
      <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: ACCENT }} />
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold" style={{ color: DARK_BLUE }}>
        {slide.title}
      </h2>
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-6xl sm:text-7xl font-serif leading-none" style={{ color: BLUE }}>
          &ldquo;
        </div>
        <blockquote className="mt-2 text-base sm:text-lg md:text-xl italic text-gray-700 leading-relaxed font-serif">
          {slide.quote}
        </blockquote>
        {slide.quoteAuthor && (
          <div className="mt-4 text-xs sm:text-sm text-gray-500">— {slide.quoteAuthor}</div>
        )}
      </div>
    </div>
  );
}

function CycleSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col p-8 bg-white relative">
      <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: BLUE }} />
      <div className="text-[10px] sm:text-xs font-bold tracking-[0.2em]" style={{ color: BLUE }}>
        THE CYCLE
      </div>
      <h2 className="mt-1 text-xl sm:text-2xl md:text-3xl font-bold" style={{ color: DARK_BLUE }}>
        {slide.title}
      </h2>
      <div className="mt-5 flex-1 space-y-3">
        {slide.bullets?.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className="flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-full text-white font-bold text-sm sm:text-base"
              style={{ background: BLUE }}
            >
              {i + 1}
            </div>
            <span className="text-sm sm:text-base text-gray-700 leading-relaxed">{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContributionSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col justify-center p-8 text-white relative" style={{ background: DARK_BLUE }}>
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: ACCENT }} />
      <div className="text-[10px] sm:text-xs font-bold tracking-[0.3em]" style={{ color: ACCENT }}>
        OUR CONTRIBUTION
      </div>
      <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-bold">{slide.title}</h2>
      {slide.contribution && (
        <p className="mt-6 text-base sm:text-lg md:text-xl leading-relaxed text-sky-200">
          {slide.contribution}
        </p>
      )}
    </div>
  );
}

function CloseSlide({ slide }: { slide: Slide }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-white relative text-center" style={{ background: DARK_BLUE }}>
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: BLUE }} />
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">{slide.title}</h2>
      {slide.subtitle && (
        <p className="mt-4 text-base sm:text-lg md:text-xl italic text-sky-200">{slide.subtitle}</p>
      )}
    </div>
  );
}

function SlideRenderer({ slide }: { slide: Slide }) {
  switch (slide.layout) {
    case "title":        return <TitleSlide slide={slide} />;
    case "promise":      return <PromiseSlide slide={slide} />;
    case "inspiration":  return <InspirationSlide slide={slide} />;
    case "heuristic":    return <HeuristicSlide slide={slide} />;
    case "content":
    case "evidence":     return <ContentSlide slide={slide} />;
    case "two_column":   return <TwoColumnSlide slide={slide} />;
    case "key_stat":     return <KeyStatSlide slide={slide} />;
    case "quote":        return <QuoteSlide slide={slide} />;
    case "cycle":        return <CycleSlide slide={slide} />;
    case "contribution": return <ContributionSlide slide={slide} />;
    case "close":        return <CloseSlide slide={slide} />;
    default:             return <ContentSlide slide={slide} />;
  }
}

// ── Main viewer ──

export function SlideDeckViewer({ deck }: { deck: DeckStructure }) {
  const [current, setCurrent] = useState(0);
  const total = deck.slides.length;

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(total - 1, c + 1));

  return (
    <div className="my-4 rounded-xl border border-[#0085CF]/15 bg-white p-3 shadow-sm">
      {/* Slide display — 16:9 aspect */}
      <div className="relative rounded-lg overflow-hidden bg-gray-100" style={{ aspectRatio: "16 / 9" }}>
        <SlideRenderer slide={deck.slides[current]} />

        {/* Navigation arrows */}
        {current > 0 && (
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
            aria-label="Previous slide"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        {current < total - 1 && (
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
            aria-label="Next slide"
          >
            <ChevronRight className="size-5" />
          </button>
        )}

        {/* Slide counter */}
        <div className="absolute top-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white font-medium">
          {current + 1} / {total}
        </div>
      </div>

      {/* Thumbnail strip */}
      <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
        {deck.slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-8 shrink-0 rounded transition-all cursor-pointer ${
              i === current
                ? "w-10 bg-[#0085CF]"
                : "w-6 bg-gray-200 hover:bg-gray-300"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
