import { ChartSkeleton, KpiCardsSkeleton, TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background lg:pl-[260px]">
      <div className="flex h-16 items-center gap-3 border-b border-border bg-card px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-9 w-9 rounded-lg lg:hidden" />
        <Skeleton className="h-9 w-full max-w-md" />
        <Skeleton className="ml-auto h-9 w-24" />
      </div>
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <KpiCardsSkeleton />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          <ChartSkeleton />
          <TableSkeleton rows={3} />
        </div>
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
