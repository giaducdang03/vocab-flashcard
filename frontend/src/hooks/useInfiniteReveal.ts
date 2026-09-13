import { useEffect, useRef, useState } from 'react';

export function useInfiniteReveal(resetKey: string, totalCount: number, batchSize: number) {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(batchSize);
  }, [resetKey, batchSize]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || visibleCount >= totalCount) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + batchSize, totalCount));
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [batchSize, totalCount, visibleCount]);

  return { visibleCount, sentinelRef };
}
