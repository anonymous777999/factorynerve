import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Card skeletons follow a consistent pattern so loading states do not shift
 * layout when real data arrives: a header bar (h-4 w-32 rounded-md) plus 2–3
 * body bars (h-3, varied widths). All blocks inherit `animate-pulse` and the
 * card radius from the shared Skeleton/Card primitives (matching real content).
 */
export function DashboardPageSkeleton() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-xl border border-border-subtle bg-surface-card p-6 shadow-sm">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="mt-4 h-3 w-80 max-w-full rounded-md" />
          <Skeleton className="mt-2 h-3 w-full max-w-3xl rounded-md" />
          <div className="mt-5 flex flex-wrap gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-28 rounded-full" />
            ))}
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="mt-3 h-3 w-20 rounded-md" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full rounded-md" />
                <Skeleton className="h-3 w-2/3 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </section>
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="mt-3 h-3 w-48 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-56 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="mt-3 h-3 w-40 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-md" />
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

export function EntryPageSkeleton() {
  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-3">
            <Skeleton className="h-4 w-72 max-w-full rounded-md" />
            <Skeleton className="h-3 w-full max-w-2xl rounded-md" />
          </div>
          <Skeleton className="h-10 w-40 rounded-full" />
        </section>
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-10 w-32 rounded-full" />
              <Skeleton className="h-10 w-32 rounded-full" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Skeleton className="h-8 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-32 rounded-full" />
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-48 rounded-md" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
              ))}
            </div>
            <Skeleton className="h-40 w-full rounded-md" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-28 rounded-md" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export function ReportsPageSkeleton() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-xl border border-border-subtle bg-surface-card p-6 shadow-sm">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="mt-4 h-3 w-80 max-w-full rounded-md" />
          <Skeleton className="mt-2 h-3 w-full max-w-2xl rounded-md" />
        </section>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-40 rounded-md" />
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-28 rounded-full" />
            ))}
          </CardContent>
        </Card>
        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-40 rounded-md" />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="h-11 w-full rounded-md" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-4 w-32 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-full" />
              ))}
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardHeader>
            <Skeleton className="h-4 w-56 rounded-md" />
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Skeleton className="h-40 w-full rounded-md" />
            <Skeleton className="h-40 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
