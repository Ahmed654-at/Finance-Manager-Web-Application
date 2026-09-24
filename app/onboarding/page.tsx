export default function OnboardingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">
          Set up your company
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Create your company profile to start tracking finances.
        </p>

        <form action="/onboarding/actions" method="post" className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Company name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Acme Inc."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="currency" className="block text-sm font-medium text-slate-700">
              Currency
            </label>
            <select
              id="currency"
              name="currency"
              defaultValue="PKR"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              <option value="PKR">PKR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Create company
          </button>
        </form>
      </div>
    </main>
  )
}
