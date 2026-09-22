import { useEffect, useRef, useState } from 'react';

/**
 * Tracks scroll direction and returns true once the page has been scrolled down
 * past `revealOffset`, so a caller (typically a sticky header) can hide itself.
 * Scrolling back up, even slightly, reveals it again immediately.
 */
export function useHideOnScroll(revealOffset = 64) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    const handleScroll = () => {
      if (ticking.current) {
        return;
      }

      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY.current;

        if (y <= revealOffset) {
          setHidden(false);
        } else if (delta > 4) {
          setHidden(true);
        } else if (delta < -4) {
          setHidden(false);
        }

        lastY.current = y;
        ticking.current = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [revealOffset]);

  return hidden;
}
