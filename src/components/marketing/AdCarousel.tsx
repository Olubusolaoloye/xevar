import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminStore, type AdSlide } from '@/store/useAdminStore';
import { Button } from '@/components/ui/Button';

const ADVANCE_MS = 7_000;
/** Horizontal travel before a touch counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD = 48;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function SlideBody({ slide }: { slide: AdSlide }) {
  const external = Boolean(slide.ctaHref && /^https?:\/\//.test(slide.ctaHref));

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
      {slide.eyebrow && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/8 px-3 py-1 text-[11px] font-medium text-brand-500">
          <Sparkles className="h-3 w-3" />
          {slide.eyebrow}
        </span>
      )}

      <h2
        className={cn(
          'mt-4 max-w-3xl font-display font-bold tracking-[-0.03em] text-ink',
          // Scales down hard on small screens: the display size that works on a
          // desktop hero is unreadable at 390px.
          'text-[clamp(1.9rem,7vw,3.75rem)] leading-[1.05]',
        )}
      >
        {slide.title}
      </h2>

      {slide.body && (
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-mid sm:text-base">
          {slide.body}
        </p>
      )}

      {slide.ctaLabel && slide.ctaHref && (
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {external ? (
            <a href={slide.ctaHref} target="_blank" rel="noopener noreferrer sponsored">
              <Button variant="primary" size="lg">
                {slide.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          ) : (
            <Link to={slide.ctaHref}>
              <Button variant="primary" size="lg">
                {slide.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      )}

      {slide.sponsored && (
        <span className="mt-5 inline-block rounded-xs border border-line-strong bg-sunken px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-low">
          Sponsored
        </span>
      )}
    </div>
  );
}

/**
 * The hero carousel.
 *
 * Doubles as the advert surface, so the mechanics matter: it advances on its
 * own but stops the moment someone interacts, because a slide that moves while
 * you are reading it is worse than no carousel. Auto-advance is also suspended
 * when the tab is hidden and when the viewer prefers reduced motion.
 */
export function AdCarousel() {
  const slides = useAdminStore((s) => s.slides);

  const active = useMemo(
    () => slides.filter((s) => s.enabled).sort((a, b) => a.order - b.order),
    [slides],
  );

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  const count = active.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  // Keep the index valid if slides are removed while the page is open.
  useEffect(() => {
    setIndex((i) => (count === 0 ? 0 : Math.min(i, count - 1)));
  }, [count]);

  useEffect(() => {
    if (count <= 1 || paused || prefersReducedMotion()) return;

    const timer = setInterval(() => {
      // Advancing a carousel nobody can see just wastes cycles.
      if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % count);
    }, ADVANCE_MS);

    return () => clearInterval(timer);
  }, [count, paused]);

  if (count === 0) return null;

  const slide = active[index];

  return (
    <section
      className="relative overflow-hidden border-b border-line"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStart.current = e.touches[0].clientX;
        setPaused(true);
      }}
      onTouchEnd={(e) => {
        const start = touchStart.current;
        touchStart.current = null;
        setPaused(false);
        if (start === null) return;

        const delta = e.changedTouches[0].clientX - start;
        if (Math.abs(delta) < SWIPE_THRESHOLD) return;
        go(index + (delta < 0 ? 1 : -1));
      }}
    >
      <div className="absolute inset-0 grid-paper opacity-60" aria-hidden="true" />
      {slide.imageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url(${slide.imageUrl})` }}
          aria-hidden="true"
        />
      )}
      <div
        className="aurora pointer-events-none absolute -left-32 -top-40 h-[420px] w-[420px] rounded-full opacity-25 blur-[110px]"
        style={{ background: 'var(--color-brand-500)' }}
        aria-hidden="true"
      />
      <div
        className="aurora pointer-events-none absolute -right-24 top-10 h-[360px] w-[360px] rounded-full opacity-20 blur-[110px]"
        style={{ background: 'var(--color-accent-500)', animationDelay: '-9s' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-canvas to-transparent"
        aria-hidden="true"
      />

      {/* Keyed so a change restarts the entrance animation. */}
      <div key={slide.id} className="relative rise">
        <SlideBody slide={slide} />
      </div>

      {count > 1 && (
        <>
          {/* Arrows are pointer/keyboard only — on touch, swiping is natural and
              two more tap targets crowd a small screen. */}
          <button
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-surface/80 text-ink-mid backdrop-blur transition-colors hover:text-ink sm:flex"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-line-strong bg-surface/80 text-ink-mid backdrop-blur transition-colors hover:text-ink sm:flex"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {active.map((s, i) => (
              <button
                key={s.id}
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === index ? 'w-6 bg-brand-500' : 'w-1.5 bg-ink-dim hover:bg-ink-low',
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
