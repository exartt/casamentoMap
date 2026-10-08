import { useEffect, useState } from 'react';

export const COMPACT_QUERY = '(max-width: 1023px), (pointer: coarse) and (max-width: 1366px)';

export const PHONE_QUERY = '(max-width: 639px)';

export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** Returns whether a CSS media query currently matches, updating on changes. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** True below the desktop breakpoint, where the editor uses the full-screen canvas layout. */
export function useCompactLayout(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}

/** True on touch-first devices. */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY);
}

/** Reads the compact-layout media query outside React. */
export function isCompactLayout(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches;
}
