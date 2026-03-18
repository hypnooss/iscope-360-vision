import { useEffect, useState, useCallback, useRef } from 'react';

interface ScrollSlot {
  anchorId: string;
  nextTargetId: string;
  endAnchorId: string;
}

interface ScrollDownProps {
  slots: ScrollSlot[];
}

export function ScrollDown({ slots }: ScrollDownProps) {
  const [nextTarget, setNextTarget] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const positionsRef = useRef<Record<string, number>>({});
  const rafRef = useRef(0);

  const recalcPositions = useCallback(() => {
    const scrollY = window.scrollY;
    const ids = Array.from(
      new Set(slots.flatMap(({ anchorId, endAnchorId, nextTargetId }) => [anchorId, endAnchorId, nextTargetId]))
    );

    positionsRef.current = ids.reduce<Record<string, number>>((acc, id) => {
      const el = document.getElementById(id);
      if (!el) return acc;
      acc[id] = scrollY + el.getBoundingClientRect().top;
      return acc;
    }, {});
  }, [slots]);

  const updateState = useCallback(() => {
    const y = window.scrollY;
    const positions = positionsRef.current;

    for (const slot of slots) {
      const start = positions[slot.anchorId];
      const end = positions[slot.endAnchorId];

      if (typeof start !== 'number' || typeof end !== 'number' || end <= start) {
        continue;
      }

      if (y >= start && y < end) {
        setIsVisible(true);
        setNextTarget(slot.nextTargetId);
        rafRef.current = 0;
        return;
      }
    }

    setIsVisible(false);
    rafRef.current = 0;
  }, [slots]);

  useEffect(() => {
    const sync = () => {
      recalcPositions();
      updateState();
    };

    const frame = requestAnimationFrame(sync);
    const initTimer = setTimeout(sync, 250);

    const onScroll = () => {
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(updateState);
      }
    };

    const onResize = () => {
      sync();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(initTimer);
      cancelAnimationFrame(frame);
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
