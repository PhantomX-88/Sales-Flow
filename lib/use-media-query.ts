"use client";

import * as React from "react";

/**
 * Client-only media query hook. Returns `false` during SSR/first paint so the
 * server and client markup stay identical, then settles on the real value.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);

    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", handleChange);
    return () => list.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/** Tailwind `lg` breakpoint — the point where the layout goes side-by-side. */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
