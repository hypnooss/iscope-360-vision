import { useEffect, useState, useCallback, useRef } from 'react';

interface ScrollDownProps {
  sectionIds: string[];
}

export function ScrollDown({ sectionIds }: ScrollDownProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const anchorsRef = useRef<number[]>([]);
  const midpointsRef = useRef<number[]>([]);
  const rafRef = useRef(0);

  // Build the position map
  const recalcPositions = useCallback(() => {
    const scrollY = window.scrollY;
    const positions = sectionIds.map((id) => {
      const el = document.getElementById(id);
      if (!el) return 0;
      return scrollY + el.getBoundingClientRect().top;
    });
    anchorsRef.current = positions;

    // Midpoints between consecutive anchors
    const mids: number[] = [];
    for (let i = 0; i < positions.length - 1; i++) {
      mids.push((positions[i] + positions[i + 1]) / 2);
    }
    midpointsRef.current = mids;
  }, [sectionIds]);

  // Determine current index from scroll position
  const updateIndex = useCallback(() => {
    const y = window.scrollY;
    const mids = midpointsRef.current;

    let idx = 0;
    for (let i = 0; i < mids.length; i++) {
      if (y >= mids[i]) {
        idx = i + 1;
      } else {
        break;
      }
    }

    setCurrentIndex(idx);
    rafRef.current = 0;
  }, []);

  useEffect(() => {
    // Initial calculation after layout settles
    const initTimer = setTimeout(() => {
      recalcPositions();
      updateIndex();
    }, 100);

    const onScroll = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(updateIndex);
      }
    };

    const onResize = () => {
      recalcPositions();
      updateIndex();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(initTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [recalcPositions, updateIndex]);

  const isLastSection = currentIndex >= sectionIds.length - 1;

  const handleClick = useCallback(() => {
    if (isLastSection) return;
    const nextId = sectionIds[currentIndex + 1];
    document.getElementById(nextId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentIndex, isLastSection, sectionIds]);

  const isVisible = !isLastSection;

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
