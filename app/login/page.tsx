'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login, signup } from './actions'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-black px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-600">Loading...</p>
          </div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [isSignUp, setIsSignUp] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get('error')
  const action = isSignUp ? signup : login

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            {isSignUp ? 'Create account' : 'Welcome back'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isSignUp ? 'Sign up to manage your finances.' : 'Sign in to continue.'}
          </p>
        </div>

        {/* Segmented control: both tabs share the track; only the active one gets a solid fill. */}
        <div role="group" aria-label="Choose sign in or sign up" className="mb-6 flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setIsSignUp(false)}
            aria-pressed={!isSignUp}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none ${
              !isSignUp ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsSignUp(true)}
            aria-pressed={isSignUp}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none ${
              isSignUp ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
              placeholder="Enter your password"
            />
          </div>

          {/* pt-2 + the form's 16px gap = 24px above the primary action; 24px between it and the link. */}
          <div className="space-y-6 pt-2">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition duration-200 hover:shadow-md active:scale-95 motion-reduce:transition-none"
            >
              {isSignUp ? 'Create account' : 'Sign In'}
            </button>

            {!isSignUp && (
              <p className="text-left text-sm">
                <Link href="/forgot-password" className="font-medium text-slate-600 hover:text-slate-900">
                  Forgot password?
                </Link>
              </p>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
