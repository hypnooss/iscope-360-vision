import { useEffect, useState, useCallback } from 'react';

interface ScrollDownProps {
  sectionIds: string[];
}

export function ScrollDown({ sectionIds }: ScrollDownProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const isLastSection = currentIndex >= sectionIds.length - 1;

  useEffect(() => {
    let frame = 0;
    let scrollTimeout: ReturnType<typeof setTimeout>;

    const updateActiveSection = () => {
      const vh = window.innerHeight;

      // Find section whose bounds contain the viewport center
      let bestIndex = -1;
      let bestOverlap = 0;

      sectionIds.forEach((id, index) => {
        const el = document.getElementById(id);
        if (!el) return;

        const rect = el.getBoundingClientRect();
        // How much of this section overlaps the viewport
        const overlapTop = Math.max(0, rect.top);
        const overlapBottom = Math.min(vh, rect.bottom);
        const overlap = Math.max(0, overlapBottom - overlapTop);

        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestIndex = index;
        }
      });

      if (bestIndex >= 0) {
        setCurrentIndex(bestIndex);
      }

      frame = 0;
    };

    const onScroll = () => {
      setIsScrolling(true);
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => setIsScrolling(false), 150);

      if (!frame) {
        frame = window.requestAnimationFrame(updateActiveSection);
      }
    };

    // Initial check
    updateActiveSection();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [sectionIds]);

  const handleClick = useCallback(() => {
    if (isLastSection) return;
    const nextId = sectionIds[currentIndex + 1];
    document.getElementById(nextId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentIndex, isLastSection, sectionIds]);

  // Visible when not scrolling and not on the last section
  const isVisible = !isScrolling && !isLastSection;

  return (
    <button
      onClick={handleClick}
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 cursor-pointer group transition-all duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      aria-label="Scroll to next section"
    >
      <span className="text-[10px] uppercase tracking-[0.32em] font-mono text-muted-foreground/50 group-hover:text-muted-foreground/80 transition-colors duration-300">
        Scroll down
      </span>
      <div className="relative w-px h-8 bg-muted-foreground/15 rounded-full overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[8px] rounded-full bg-primary/60 animate-scroll-dot" />
      </div>
    </button>
  );
}
