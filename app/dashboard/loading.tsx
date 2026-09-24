export default function DashboardLoading() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6">
        <div className="h-16 rounded-2xl bg-slate-200" />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-32 rounded-2xl bg-slate-200" />
          <div className="h-32 rounded-2xl bg-slate-200" />
          <div className="h-32 rounded-2xl bg-slate-200" />
        </div>

        <div className="h-80 rounded-2xl bg-slate-200" />
      </div>
    </main>
  )
}
