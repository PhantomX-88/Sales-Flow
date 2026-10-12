"use client";

import { useTheme } from "next-themes";

import * as React from "react";

/**
 * Returns the chart palette for the currently resolved theme.
 *
 * Recharts reads plain hex at render time; we resolve via resolvedTheme
 * (not a CSS var) so both Area and Bar charts react to theme changes
 * without a hydration mismatch.
 */
type ChartColors = {
  pipeline: string;
  won: string;
  grid: string;
  tick: string;
  canvas: string;
};

function useChartColors(): ChartColors {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  return {
    pipeline: isDark ? "#4F83F1" : "#2563EB",
    won: isDark ? "#10B981" : "#059669",
    grid: isDark ? "#2B3B55" : "#E2E8F0",
    tick: isDark ? "#94A3B8" : "#64748B",
    canvas: isDark ? "#1F2A3D" : "#F1F5F9",
  };
}

export { useChartColors };
export type { ChartColors };
