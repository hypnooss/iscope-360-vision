import { useEffect, useState, useCallback, useRef } from 'react';

interface ScrollDownProps {
  sectionIds: string[];
}

export function ScrollDown({ sectionIds }: ScrollDownProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const anchorsRef = useRef<number[]>([]);
  const rafRef = useRef(0);

  // Build absolute position map
  const recalcPositions = useCallback(() => {
    const scrollY = window.scrollY;
    const positions = sectionIds.map((id) => {
      const el = document.getElementById(id);
      if (!el) return 0;
      return scrollY + el.getBoundingClientRect().top;
    });
    anchorsRef.current = positions;
  }, [sectionIds]);

  // Determine current index AND visibility from scroll position
  const updateState = useCallback(() => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const anchors = anchorsRef.current;
    if (anchors.length === 0) return;

    // Find active section using midpoints
    const midpoints: number[] = [];
    for (let i = 0; i < anchors.length - 1; i++) {
      midpoints.push((anchors[i] + anchors[i + 1]) / 2);
    }

    let idx = 0;
    for (let i = 0; i < midpoints.length; i++) {
      if (y >= midpoints[i]) {
        idx = i + 1;
      } else {
        break;
      }
    }

    setCurrentIndex(idx);

    // Visibility: show only in the "comfort zone" near anchors
    // The button is visible when scrollY is within [anchor - 0.1vh, anchor + 0.7vh] of the active anchor
    // and hidden in the last section
    const isLast = idx >= sectionIds.length - 1;
    if (isLast) {
      setIsVisible(false);
      rafRef.current = 0;
      return;
    }

    const currentAnchor = anchors[idx];
    const nextAnchor = idx < anchors.length - 1 ? anchors[idx + 1] : currentAnchor + vh;
    const sectionHeight = nextAnchor - currentAnchor;

    // Show if within 85% of the section (hide near the transition boundary)
    const distanceIntoSection = y - currentAnchor;
    const transitionZone = sectionHeight * 0.15; // last 15% = transition zone, hide button

    const inComfortZone = distanceIntoSection >= -vh * 0.1 && distanceIntoSection < sectionHeight - transitionZone;

    setIsVisible(inComfortZone);
    rafRef.current = 0;
  }, [sectionIds]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      recalcPositions();
      updateState();
    }, 150);

    const onScroll = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(updateState);
      }
    };

    const onResize = () => {
      recalcPositions();
      updateState();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(initTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [recalcPositions, updateState]);

  const handleClick = useCallback(() => {
    if (currentIndex >= sectionIds.length - 1) return;
    const nextId = sectionIds[currentIndex + 1];
    document.getElementById(nextId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentIndex, sectionIds]);

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
