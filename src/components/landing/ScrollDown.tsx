import { useEffect, useState, useCallback, useRef } from 'react';

interface ScrollDownProps {
  sectionIds: string[];
}

export function ScrollDown({ sectionIds }: ScrollDownProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeSections = useRef(new Map<string, boolean>());

  const currentIndex = activeId ? sectionIds.indexOf(activeId) : -1;
  const isLastSection = currentIndex >= sectionIds.length - 1;

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    // Use a narrow band in the center of the viewport to detect which section is "active"
    // rootMargin: -45% top, -45% bottom → only the middle 10% of viewport triggers
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          activeSections.current.set(entry.target.id, entry.isIntersecting);
        });

        // Find the first section that's intersecting the center band
        let found: string | null = null;
        for (const id of sectionIds) {
          if (activeSections.current.get(id)) {
            found = id;
            break;
          }
        }
        setActiveId(found);
      },
      {
        rootMargin: '-45% 0px -45% 0px',
        threshold: 0,
      }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    });
    observers.push(observer);

    return () => {
      observers.forEach((o) => o.disconnect());
    };
  }, [sectionIds]);

  const handleClick = useCallback(() => {
    if (isLastSection || currentIndex < 0) return;
    const nextId = sectionIds[currentIndex + 1];
    document.getElementById(nextId)?.scrollIntoView({ behavior: 'smooth' });
  }, [currentIndex, isLastSection, sectionIds]);

  const isVisible = !!activeId && !isLastSection;

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
