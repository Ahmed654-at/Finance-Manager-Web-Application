-- ==============================================================================
-- DEMO DATA (optional)
-- ==============================================================================
-- Fills YOUR company with realistic sample data so the dashboard, reports, invoices,
-- payroll and approval screens are not empty.
--
-- How to use:
--   1. Run schema.sql (or the migrations) first.
--   2. Sign up in the app with your email and sign in once (this creates your company).
--   3. Change the email on the line marked  <<< CHANGE THIS  below.
--   4. Paste this whole file into the Supabase SQL Editor and click Run.
--
-- Safe by design: it stops with an error if the company already has transactions,
-- so it can never overwrite real data. Everything it adds is labelled "DEMO" or uses
-- @example.com addresses, so it is easy to recognise and delete.
-- ==============================================================================

do $$
declare
  v_email text := 'you@example.com';   -- <<< CHANGE THIS to the email you signed up with
  v_user uuid;
  v_company uuid;

  v_bank uuid;
  v_cash uuid;
  v_savings uuid;

  v_c_marketing uuid;
  v_c_salary uuid;
  v_c_travel uuid;
  v_c_lunch uuid;
  v_c_cloud uuid;
  v_c_software uuid;
  v_c_rent uuid;
  v_c_ai_income uuid;
  v_c_product_income uuid;
  v_c_consulting uuid;

  v_cust1 uuid;
  v_cust2 uuid;
  v_cust3 uuid;
  v_cust4 uuid;

  v_emp1 uuid;
  v_emp2 uuid;
  v_emp3 uuid;

  v_inv uuid;
  v_tx uuid;
  v_month text := to_char(current_date - interval '1 month', 'FMMonth YYYY');
begin
  select id into v_user from auth.users where lower(email) = lower(v_email);
  if v_user is null then
    raise exception 'No account found for "%". Sign up in the app first, then set your email at the top of this script.', v_email;
  end if;

  select company_id into v_company
    from public.company_members
    where user_id = v_user
    order by created_at desc
    limit 1;
  if v_company is null then
    raise exception 'That account has no company yet. Sign in to the app once, then run this script again.';
  end if;

  if exists (select 1 from public.transactions where company_id = v_company) then
    raise exception 'This company already has transactions. Demo data is only added to an empty company.';
  end if;

  -- ---- Categories (the app seeds these too; add any that are missing) --------
  insert into public.categories (company_id, name, type, description)
  select v_company, d.name, d.type, d.description
  from (values
    ('Marketing', 'expense', 'Campaigns, ads and sponsorships'),
    ('Employees Salaries', 'expense', 'Monthly staff payroll'),
    ('Team Travelling', 'expense', 'Flights, hotels and client visits'),
    ('Team Lunch', 'expense', 'Team meals and refreshments'),
    ('AI & Cloud Infrastructure', 'expense', 'AI APIs, GPU and cloud hosting'),
    ('Software & Subscriptions', 'expense', 'Tools and subscriptions'),
    ('Office Rent & Utilities', 'expense', 'Rent, electricity and internet'),
    ('AI Services & Solutions', 'income', 'Custom AI development and integrations'),
    ('Product Selling & Licenses', 'income', 'Software licenses and products'),
    ('AI Consulting & Retainers', 'income', 'Advisory and monthly retainers')
  ) as d(name, type, description)
  where not exists (
    select 1 from public.categories c
    where c.company_id = v_company and lower(c.name) = lower(d.name)
  );

  select id into v_c_marketing from public.categories where company_id = v_company and name = 'Marketing' limit 1;
  select id into v_c_salary from public.categories where company_id = v_company and name = 'Employees Salaries' limit 1;
  select id into v_c_travel from public.categories where company_id = v_company and name = 'Team Travelling' limit 1;
  select id into v_c_lunch from public.categories where company_id = v_company and name = 'Team Lunch' limit 1;
  select id into v_c_cloud from public.categories where company_id = v_company and name = 'AI & Cloud Infrastructure' limit 1;
  select id into v_c_software from public.categories where company_id = v_company and name = 'Software & Subscriptions' limit 1;
  select id into v_c_rent from public.categories where company_id = v_company and name = 'Office Rent & Utilities' limit 1;
  select id into v_c_ai_income from public.categories where company_id = v_company and name = 'AI Services & Solutions' limit 1;
  select id into v_c_product_income from public.categories where company_id = v_company and name = 'Product Selling & Licenses' limit 1;
  select id into v_c_consulting from public.categories where company_id = v_company and name = 'AI Consulting & Retainers' limit 1;

  -- ---- Accounts ---------------------------------------------------------------
  insert into public.accounts (company_id, name, type, opening_balance) values (v_company, 'DEMO Main Bank', 'bank', 25000) returning id into v_bank;
  insert into public.accounts (company_id, name, type, opening_balance) values (v_company, 'DEMO Cash Box', 'cash', 1500) returning id into v_cash;
  insert into public.accounts (company_id, name, type, opening_balance) values (v_company, 'DEMO Savings', 'savings', 10000) returning id into v_savings;

  -- ---- Customers --------------------------------------------------------------
  insert into public.customers (company_id, name, email, phone, address) values (v_company, 'Northwind Retail', 'accounts@northwind.example.com', '+1 555 0101', '12 Market Street') returning id into v_cust1;
  insert into public.customers (company_id, name, email, phone, address) values (v_company, 'Bluepeak Logistics', 'finance@bluepeak.example.com', '+1 555 0102', '88 Harbor Road') returning id into v_cust2;
  insert into public.customers (company_id, name, email, phone, address) values (v_company, 'Orchid Health Clinic', 'billing@orchid.example.com', '+1 555 0103', '4 Garden Lane') returning id into v_cust3;
  insert into public.customers (company_id, name, email, phone, address) values (v_company, 'Summit Education', 'admin@summit.example.com', '+1 555 0104', '150 College Avenue') returning id into v_cust4;

  -- ---- Catalog ----------------------------------------------------------------
  insert into public.services_and_products (company_id, name, type, price, billing_type, description) values
    (v_company, 'Custom AI Chatbot', 'ai_service', 4500, 'project', 'Tailored support chatbot with knowledge base'),
    (v_company, 'AI Consulting Retainer', 'ai_service', 2500, 'monthly', 'Monthly advisory and workshops'),
    (v_company, 'Prompt Engineering Workshop', 'ai_service', 750, 'hourly', 'Hands-on team training'),
    (v_company, 'Analytics Dashboard License', 'product', 199, 'monthly', 'SaaS reporting dashboard, per seat'),
    (v_company, 'Document Summariser Pro', 'product', 499, 'one_off', 'Desktop license');

  -- ---- Employees (payroll profiles; @example.com so no real person is affected) -
  insert into public.employees (company_id, name, email, designation, department, salary_amount, payment_method, bank_account_details, hire_date)
    values (v_company, 'Sara Khan', 'sara.demo@example.com', 'Senior AI Engineer', 'AI Services', 4200, 'bank_transfer', 'DEMO-IBAN-0001', current_date - 400) returning id into v_emp1;
  insert into public.employees (company_id, name, email, designation, department, salary_amount, payment_method, bank_account_details, hire_date)
    values (v_company, 'Omar Ali', 'omar.demo@example.com', 'Product Designer', 'Product Engineering', 3100, 'bank_transfer', 'DEMO-IBAN-0002', current_date - 250) returning id into v_emp2;
  insert into public.employees (company_id, name, email, designation, department, salary_amount, payment_method, hire_date)
    values (v_company, 'Lina Park', 'lina.demo@example.com', 'Marketing Lead', 'Marketing & Sales', 2800, 'cash', current_date - 120) returning id into v_emp3;

  -- ---- Income -----------------------------------------------------------------
  insert into public.transactions (company_id, type, amount, category_id, account_id, revenue_stream, description, transaction_date, reference, created_by) values
    (v_company, 'income', 6300, v_c_ai_income, v_bank, 'ai_services', 'Chatbot project for Northwind Retail', current_date - 62, 'DEMO-INC-001', v_user),
    (v_company, 'income', 2500, v_c_consulting, v_bank, 'ai_services', 'Consulting retainer, Bluepeak Logistics', current_date - 55, 'DEMO-INC-002', v_user),
    (v_company, 'income', 1495, v_c_product_income, v_bank, 'product_sales', 'Analytics Dashboard licenses (5 seats)', current_date - 41, 'DEMO-INC-003', v_user),
    (v_company, 'income', 2500, v_c_consulting, v_bank, 'ai_services', 'Consulting retainer, Bluepeak Logistics', current_date - 25, 'DEMO-INC-004', v_user),
    (v_company, 'income', 3800, v_c_ai_income, v_bank, 'ai_services', 'Document pipeline for Orchid Health Clinic', current_date - 18, 'DEMO-INC-005', v_user),
    (v_company, 'income', 998, v_c_product_income, v_bank, 'product_sales', 'Document Summariser Pro (2 licenses)', current_date - 9, 'DEMO-INC-006', v_user),
    (v_company, 'income', 750, v_c_ai_income, v_cash, 'ai_services', 'Prompt engineering workshop, Summit Education', current_date - 4, 'DEMO-INC-007', v_user);

  -- ---- Operating expenses -----------------------------------------------------
  insert into public.transactions (company_id, type, amount, category_id, account_id, expense_type, description, transaction_date, reference, created_by) values
    (v_company, 'expense', 1800, v_c_rent, v_bank, 'operational', 'Office rent', current_date - 58, 'DEMO-EXP-001', v_user),
    (v_company, 'expense', 640, v_c_cloud, v_bank, 'infrastructure', 'GPU and API usage', current_date - 47, 'DEMO-EXP-002', v_user),
    (v_company, 'expense', 420, v_c_software, v_bank, 'operational', 'Team software subscriptions', current_date - 40, 'DEMO-EXP-003', v_user),
    (v_company, 'expense', 1800, v_c_rent, v_bank, 'operational', 'Office rent', current_date - 28, 'DEMO-EXP-004', v_user),
    (v_company, 'expense', 900, v_c_marketing, v_bank, 'operational', 'Launch campaign ads', current_date - 21, 'DEMO-EXP-005', v_user),
    (v_company, 'expense', 715, v_c_cloud, v_bank, 'infrastructure', 'GPU and API usage', current_date - 14, 'DEMO-EXP-006', v_user),
    (v_company, 'expense', 180, v_c_lunch, v_cash, 'team_expense', 'Team lunch', current_date - 6, 'DEMO-EXP-007', v_user),
    (v_company, 'expense', 1800, v_c_rent, v_bank, 'operational', 'Office rent', current_date - 2, 'DEMO-EXP-008', v_user);

  -- ---- Payroll for last month (ledger entry + payroll history) -----------------
  insert into public.transactions (company_id, type, amount, category_id, account_id, expense_type, employee_id, description, transaction_date, reference, created_by)
    values (v_company, 'expense', 4200, v_c_salary, v_bank, 'salary', v_emp1, 'Salary: Sara Khan (' || v_month || ')', current_date - 30, 'DEMO-PAYROLL', v_user) returning id into v_tx;
  insert into public.salaries (company_id, employee_id, amount, bonus, deductions, net_amount, payment_date, payment_month, status, account_id, transaction_id)
    values (v_company, v_emp1, 4200, 0, 0, 4200, current_date - 30, v_month, 'paid', v_bank, v_tx);

  insert into public.transactions (company_id, type, amount, category_id, account_id, expense_type, employee_id, description, transaction_date, reference, created_by)
    values (v_company, 'expense', 3100, v_c_salary, v_bank, 'salary', v_emp2, 'Salary: Omar Ali (' || v_month || ')', current_date - 30, 'DEMO-PAYROLL', v_user) returning id into v_tx;
  insert into public.salaries (company_id, employee_id, amount, bonus, deductions, net_amount, payment_date, payment_month, status, account_id, transaction_id)
    values (v_company, v_emp2, 3100, 0, 0, 3100, current_date - 30, v_month, 'paid', v_bank, v_tx);

  -- ---- Invoices: paid, sent, overdue and draft --------------------------------
  insert into public.invoices (company_id, customer_id, invoice_number, service_type, issue_date, due_date, subtotal, tax, total, status, notes)
    values (v_company, v_cust1, 'DEMO-001', 'ai_service', current_date - 70, current_date - 55, 6000, 300, 6300, 'paid', 'Thank you for your business.') returning id into v_inv;
  insert into public.invoice_items (invoice_id, description, quantity, unit_price, amount) values
    (v_inv, 'Custom AI chatbot', 1, 4500, 4500),
    (v_inv, 'Prompt engineering workshop', 2, 750, 1500);

  insert into public.invoices (company_id, customer_id, invoice_number, service_type, issue_date, due_date, subtotal, tax, total, status)
    values (v_company, v_cust2, 'DEMO-002', 'ai_service', current_date - 5, current_date + 10, 2500, 0, 2500, 'sent') returning id into v_inv;
  insert into public.invoice_items (invoice_id, description, quantity, unit_price, amount) values
    (v_inv, 'AI consulting retainer (monthly)', 1, 2500, 2500);

  insert into public.invoices (company_id, customer_id, invoice_number, service_type, issue_date, due_date, subtotal, tax, total, status)
    values (v_company, v_cust4, 'DEMO-003', 'product_sale', current_date - 30, current_date - 12, 995, 50, 1045, 'overdue') returning id into v_inv;
  insert into public.invoice_items (invoice_id, description, quantity, unit_price, amount) values
    (v_inv, 'Analytics Dashboard license (seat)', 5, 199, 995);

  insert into public.invoices (company_id, customer_id, invoice_number, service_type, issue_date, due_date, subtotal, tax, total, status, notes)
    values (v_company, v_cust3, 'DEMO-004', 'ai_service', current_date, current_date + 14, 3200, 160, 3360, 'draft', 'Draft, awaiting scope sign-off.') returning id into v_inv;
  insert into public.invoice_items (invoice_id, description, quantity, unit_price, amount) values
    (v_inv, 'Custom integration', 1, 3200, 3200);

  -- ---- Budgets ----------------------------------------------------------------
  insert into public.budgets (company_id, category_id, name, amount, start_date, end_date) values
    (v_company, v_c_marketing, 'DEMO Marketing this quarter', 2500, date_trunc('quarter', current_date)::date, (date_trunc('quarter', current_date) + interval '3 months')::date - 1),
    (v_company, v_c_cloud, 'DEMO Cloud spend this quarter', 3000, date_trunc('quarter', current_date)::date, (date_trunc('quarter', current_date) + interval '3 months')::date - 1);

  -- ---- Expense requests in every state (so the approval screen has content) ----
  insert into public.team_expenses (company_id, submitted_by_name, category_id, title, amount, expense_date, purpose, status, notes) values
    (v_company, 'Sara Khan', v_c_cloud, 'GPU credits for the Northwind project', 320, current_date - 3, 'project', 'pending', 'Needed for model fine-tuning'),
    (v_company, 'Lina Park', v_c_marketing, 'Conference booth deposit', 450, current_date - 8, 'marketing', 'pending', null),
    (v_company, 'Omar Ali', v_c_software, 'Design tool annual plan', 240, current_date - 15, 'other', 'approved', null),
    (v_company, 'Sara Khan', v_c_travel, 'Client visit travel', 380, current_date - 30, 'project', 'reimbursed', 'Reimbursed via bank transfer'),
    (v_company, 'Lina Park', v_c_lunch, 'Team celebration dinner', 900, current_date - 20, 'other', 'rejected', 'Over the per-head limit');

  -- ---- A pending salary request -----------------------------------------------
  insert into public.salary_requests (company_id, submitted_by_name, payment_month, amount, notes)
    values (v_company, 'Lina Park', to_char(current_date, 'FMMonth YYYY'), 2800, 'Regular monthly salary');

  raise notice 'Demo data added to company %. Refresh the dashboard.', v_company;
end $$;
