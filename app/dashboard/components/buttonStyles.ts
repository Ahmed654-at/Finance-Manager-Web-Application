// Shared button styles so the app uses a small, consistent set instead of one-off class lists.
// Plain strings (no React), so they work in both server and client components.

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition duration-200 active:scale-95 motion-reduce:transition-none'

/** Main action on a page or form (Add, Save). */
export const buttonPrimary = `${base} bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md`

/** Everyday actions (Update, Reset, Sign out, Cancel). */
export const buttonSecondary = `${base} border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md`

/**
 * Destructive actions (Remove, Delete). Uses the 400/500 red shades, which the dark theme leaves
 * unchanged, so it always reads as red. Colour change only on hover, no lift.
 */
export const buttonDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors duration-200 hover:bg-red-500/20 hover:text-red-300 motion-reduce:transition-none'
