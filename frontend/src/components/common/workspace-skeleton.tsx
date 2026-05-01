import { Skeleton } from '@/components/ui/skeleton'

export function WorkspaceSkeleton() {
  return (
    <div className="min-h-dvh overflow-x-hidden bg-background p-3 sm:p-6 lg:h-dvh lg:overflow-hidden">
      <div className="grid gap-3 sm:gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-md border border-border bg-card p-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="mt-4 h-8 w-24" />
          <Skeleton className="mt-3 h-9 w-full" />
          <Skeleton className="mt-6 h-20 w-full" />
          <Skeleton className="mt-3 h-20 w-full" />
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-24 w-full" />
          <Skeleton className="mt-4 h-24 w-4/5" />
          <Skeleton className="mt-8 h-32 w-full" />
        </div>
      </div>
    </div>
  )
}
