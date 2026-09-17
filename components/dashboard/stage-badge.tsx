import { cn, STAGE_BADGE_STYLES, STAGE_DOT_STYLES } from "@/lib/utils";
import type { PipelineStage } from "@/lib/types";

interface StageBadgeProps {
  stage: PipelineStage;
  className?: string;
  withDot?: boolean;
}

export function StageBadge({ stage, className, withDot = true }: StageBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STAGE_BADGE_STYLES[stage],
        className,
      )}
    >
      {withDot ? (
        <span className={cn("h-1.5 w-1.5 rounded-full", STAGE_DOT_STYLES[stage])} aria-hidden="true" />
      ) : null}
      {stage}
    </span>
  );
}
