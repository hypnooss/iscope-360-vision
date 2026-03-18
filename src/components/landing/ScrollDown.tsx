import { useEffect, useState, useCallback } from 'react';

interface ScrollDownProps {
  sectionIds: string[];
}

const SNAP_TOLERANCE_PX = 24;

export function ScrollDown({ sectionIds }: ScrollDownProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const currentIndex = activeId ? sectionIds.indexOf(activeId) : -1;
  const isLastSection = currentIndex >= sectionIds.length - 1;

  useEffect(() => {
    let frame = 0;

    const updateActiveSection = () => {
      let closestId: string | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      sectionIds.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;

        const distance = Math.abs(el.getBoundingClientRect().top);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestId = id;
        }
      });

      setActiveId(closestDistance <= SNAP_TOLERANCE_PX ? closestId : null);
      frame = 0;
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [sectionIds]);

  const handleClick = useCallback(() => {
    if (isLastSection || currentIndex < 0) return;
    const nextId = sectionIds[currentIndex + 1];
    document.getElementById(nextId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentIndex, isLastSection, sectionIds]);

  const isVisible = currentIndex >= 0 && !isLastSection;

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
