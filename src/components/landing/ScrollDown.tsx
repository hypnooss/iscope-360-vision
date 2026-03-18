import { useEffect, useState, useCallback, useRef } from 'react';

interface ScrollDownProps {
  sectionIds: string[];
}

/**
 * Slot-based ScrollDown: visibility is determined by explicit vertical ranges,
 * not heuristic midpoints. Each section anchor defines a "visible window" where
 * the button can appear. Outside those windows = button hidden.
 */
export function ScrollDown({ sectionIds }: ScrollDownProps) {
  const [nextTarget, setNextTarget] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const slotsRef = useRef<{ id: string; top: number }[]>([]);
  const rafRef = useRef(0);

  // Build absolute position map from DOM
  const recalcPositions = useCallback(() => {
    const scrollY = window.scrollY;
    slotsRef.current = sectionIds.map((id) => {
      const el = document.getElementById(id);
      if (!el) return { id, top: 0 };
      return { id, top: scrollY + el.getBoundingClientRect().top };
    });
  }, [sectionIds]);

  // Determine visibility and next target using strict range windows
  const updateState = useCallback(() => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    const slots = slotsRef.current;
    if (slots.length < 2) return;

    // For each slot, define the visible window:
    // visibleStart = slotTop + vh * 0.05  (small margin after landing)
    // visibleEnd   = nextSlotTop - vh * 0.35 (hide well before next section header appears)
    // This creates a clear dead zone between sections where button is hidden.
    const marginTop = vh * 0.05;
    const marginBottom = vh * 0.35;

    let foundSlot = false;

    for (let i = 0; i < slots.length - 1; i++) {
      const slotTop = slots[i].top;
      const nextSlotTop = slots[i + 1].top;
      const sectionHeight = nextSlotTop - slotTop;

      // Skip very small sections (< 50% vh) — they're transition anchors
      // For those, merge the window with the next real section
      if (sectionHeight < vh * 0.3) continue;

      const visibleStart = slotTop + marginTop;
      const visibleEnd = nextSlotTop - marginBottom;

      // Only show if there's a meaningful visible window
      if (visibleEnd <= visibleStart) continue;

      if (y >= visibleStart && y < visibleEnd) {
        setIsVisible(true);
        setNextTarget(slots[i + 1].id);
        foundSlot = true;
        break;
      }
    }

    if (!foundSlot) {
      setIsVisible(false);
    }

    rafRef.current = 0;
  }, [sectionIds]);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      recalcPositions();
      updateState();
    }, 200);

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
    if (!nextTarget) return;
    document.getElementById(nextTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [nextTarget]);

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
