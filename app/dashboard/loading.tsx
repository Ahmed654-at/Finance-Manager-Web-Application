// Skeleton shaped like the overview: header row, four summary cards, and a table.
export default function DashboardLoading() {
  return (
    <main className="px-4 pb-10 pt-6" aria-busy="true" aria-label="Loading">
      <div className="mx-auto max-w-6xl animate-pulse space-y-8 motion-reduce:animate-none">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 rounded-lg bg-slate-200" />
            <div className="h-3 w-72 max-w-full rounded bg-slate-200" />
          </div>
          <div className="h-9 w-40 rounded-xl bg-slate-200" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((card) => (
            <div key={card} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-8 w-32 rounded-lg bg-slate-200" />
              <div className="h-3 w-full rounded bg-slate-200" />
              <div className="h-3 w-2/3 rounded bg-slate-200" />
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-200" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-slate-200" />
            {[0, 1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="grid grid-cols-4 gap-4">
                <div className="h-4 rounded bg-slate-100" />
                <div className="h-4 rounded bg-slate-100" />
                <div className="h-4 rounded bg-slate-100" />
                <div className="h-4 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
