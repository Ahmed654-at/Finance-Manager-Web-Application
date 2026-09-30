# Company Finance Manager

A multi-user finance management web application for small companies. It tracks income and expenses, invoices, payroll, and team spending, and it includes a **role-based approval workflow**: employees request expenses and salaries, and owners or admins approve them.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS 4** and **Supabase** (PostgreSQL + Auth + Row Level Security).

---

## Features

**Finance**
- **Transactions**: income and expense ledger with categories, accounts, revenue streams, filtering, CSV import and CSV export.
- **Invoices**: customers, itemised invoices with tax, draft → sent → paid/overdue lifecycle, PDF generation and email delivery.
- **Accounts & budgets**: bank/cash/credit accounts and per-category spending limits with alerts.
- **Reports**: profit and loss, revenue and expense breakdowns, CSV export.
- **Services & products catalog**: AI services and products with pricing models.

**People & payroll**
- **Team**: add accounts (creates the login for you), assign roles, change roles, remove people, and reset a member's password.
- **Employees**: payroll profiles (department, designation, salary, bank details), directory with a "has login" badge, and one-click salary disbursement that records a ledger expense.
- **Approval workflows**
  - *Expense requests*: an employee submits an expense (project / marketing / other); an owner or admin approves or rejects it, then it can be reimbursed into the ledger.
  - *Salary requests*: an employee requests a month's salary; approval records a salary expense and a payroll entry. The requested amount is compared with the expected salary.
- **Notifications & audit log**: in-app notifications for reviewers and requesters, plus an audit trail of changes.

**Accounts & security**
- Sign up / sign in, **change password**, **forgot password** (email link), and **admin password reset** (works without email).
- Each new account gets its **own company**, so data is fully separated between organisations.

---

## Roles

| Role | What they can do |
|------|------------------|
| **Owner** | Everything, including managing other owners |
| **Admin** | Everything except owner management; manages the team; approves requests |
| **Accountant** | Records and edits financial data; cannot manage the team or approve requests |
| **Viewer** | Read-only access to company data |
| **Employee** | Sees **only** their own expense and salary requests; cannot open the dashboard |

Permissions are enforced in **two places**: in the server actions (`lib/company.ts` → `canWrite`) and in the database itself through Row Level Security, so a user cannot bypass the app by calling the API directly.

---

## Tech stack

| Area | Technology |
|------|------------|
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Route Handlers) |
| Language | TypeScript |
| UI | Tailwind CSS 4 |
| Database / Auth | Supabase (PostgreSQL, Row Level Security, Supabase Auth via `@supabase/ssr`) |
| PDF | `@react-pdf/renderer` |
| Email | Resend |

---

## How it works

```
Browser
  → Next.js Server Component / Server Action
  → Supabase client (anon key + the user's session cookie)
  → PostgreSQL with Row Level Security
```

- `proxy.ts` refreshes the session and redirects signed-out visitors to `/login`.
- Every server action calls `auth.getUser()`, then `getCompanyContext()` (`lib/company.ts`) to get the user's company and role, then checks the role before writing.
- The database policies use helper functions (`app_is_member`, `app_is_staff`, `app_can_write`, `app_is_admin`) so each company only sees its own rows and employees see no company financials.
- Invoice creation and editing run through a single database function, `save_invoice`, so an invoice and its line items are saved **atomically** with cent-accurate totals.
- Approving a request first "claims" it (only one click can move it out of *pending*), then writes the ledger entry, which prevents double-counting.
- The service-role key is used only on the server for admin tasks (creating logins, resetting passwords, the overdue-invoice cron).

### Project structure

```
app/
  login/, forgot-password/, reset-password/, auth/callback/   Authentication
  account/password/                                           Change password
  my-expenses/                                                Employee workspace (own requests only)
  dashboard/
    page.tsx                  Overview
    transactions/ invoices/ customers/ accounts/ categories/ budgets/ reports/ services/
    employees/                Payroll profiles and salary disbursement
    team/                     Accounts, roles, password reset
    team-expenses/            Expense requests: approve / reject / reimburse
    salary-requests/          Salary requests: approve / reject
    audit/ settings/ notifications/
  api/cron/invoice-overdue-check/   Marks overdue invoices and notifies members
lib/
  company.ts        Company + role resolution, canWrite
  payroll.ts        Links a login to its payroll record by email
  email.ts, currency.ts, audit.ts, user.ts, supabase/
migrations/         SQL for upgrading an existing database
schema.sql          Complete schema for a fresh database
proxy.ts            Session refresh and route protection
```

---

## Getting started

### 1. Prerequisites
- Node.js 20+
- A free [Supabase](https://supabase.com) project

### 2. Install
```bash
npm install
```

### 3. Create the database
1. In your Supabase project, open **SQL Editor → New query**.
2. Paste the contents of [`schema.sql`](schema.sql) and click **Run**.

> **Warning:** `schema.sql` drops and recreates all tables. Use it only on an empty database.
> To upgrade an existing database instead, run the files in [`migrations/`](migrations) in order (001 → 004).

### 4. Environment variables
Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server only, never expose it
RESEND_API_KEY=your_resend_api_key                # optional: invoice / notification emails
RESEND_FROM_EMAIL=Finance Manager <you@yourdomain.com>   # optional
CRON_SECRET=any_long_random_string                # protects the overdue-invoice cron endpoint
```

Find the URL and keys in Supabase under **Project Settings → API**. **Never commit `.env` files.**

### 5. Run
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 6. First steps
1. Click **Sign Up** and create an account. It becomes the **owner** of a new company.
2. Open **Team** and add an employee (email, password, role, optional payroll details).
3. Sign in as that employee in a private window and submit an expense or salary request.
4. Back as the owner, open **Team Expenses** or **Salary Requests** and approve it. The amount appears in **Transactions**.

---

## Optional configuration

**Password reset by email.** The "Forgot password" link needs email delivery. In Supabase go to **Authentication → URL Configuration** and add your site URL and `<your-site>/auth/callback` to *Redirect URLs*, and set up custom SMTP under **Authentication → SMTP**. Without SMTP, an owner or admin can reset any member's password from the **Team** page.

**Invoice emails.** Resend's test sender (`onboarding@resend.dev`) only delivers to the account owner's own address. To email real customers, verify a domain in Resend and set `RESEND_FROM_EMAIL`.

**Overdue invoices.** Call `GET /api/cron/invoice-overdue-check` on a schedule with the header `Authorization: Bearer <CRON_SECRET>` (for example with Vercel Cron).

---

## Security notes
- Row Level Security is enabled on every table; policies are scoped by company membership and role.
- Server actions re-check the user's role on every write.
- Email content is HTML-escaped; the cron endpoint uses a constant-time secret comparison.
- The service-role key is only ever used in server code.

## Known limitations / future work
- Account balances are adjusted through the account's `opening_balance` rather than a full ledger.
- The dashboard aggregates in the application; a large dataset would call for database-side aggregation.
- CSV import uses a simple parser and does not handle line breaks inside quoted fields.
- No automated test suite yet.

## License
Educational project.
