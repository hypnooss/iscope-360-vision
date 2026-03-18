import { useEffect, useState, useCallback, useRef } from 'react';

interface ScrollDownProps {
  sectionIds: string[];
}

export function ScrollDown({ sectionIds }: ScrollDownProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSnapped, setIsSnapped] = useState(true);
  const isLastSection = currentIndex >= sectionIds.length - 1;
  const visibleSections = useRef(new Set<string>());

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    // Observer for tracking current section (low threshold)
    sectionIds.forEach((id, index) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setCurrentIndex(index);
          }
        },
        { threshold: 0.3 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    // Observer for snap detection (high threshold)
    const snapObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.current.add(entry.target.id);
          } else {
            visibleSections.current.delete(entry.target.id);
          }
        });
        setIsSnapped(visibleSections.current.size > 0);
      },
      { threshold: 0.5 }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        snapObserver.observe(el);
        observers.push(snapObserver);
      }
    });

    return () => {
      observers.forEach((o) => o.disconnect());
      snapObserver.disconnect();
    };
  }, [sectionIds]);

  const handleClick = useCallback(() => {
    if (isLastSection) return;
    const nextId = sectionIds[currentIndex + 1];
    document.getElementById(nextId)?.scrollIntoView({ behavior: 'smooth' });
  }, [currentIndex, isLastSection, sectionIds]);

  const isVisible = isSnapped && !isLastSection;

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