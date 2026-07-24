CREATE TABLE IF NOT EXISTS public.sponsorship_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monthly_amount integer NOT NULL CHECK (monthly_amount > 0),
  due_day integer NOT NULL DEFAULT 5 CHECK (due_day BETWEEN 1 AND 28),
  starts_on date NOT NULL DEFAULT current_date,
  ends_on date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.sponsorship_plans(id) ON DELETE RESTRICT,
  name text NOT NULL,
  phone text NOT NULL,
  city text,
  email text,
  monthly_amount integer NOT NULL CHECK (monthly_amount > 0),
  next_due_on date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sponsor_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsors_due_idx ON public.sponsors(status, next_due_on);
CREATE INDEX IF NOT EXISTS sponsor_contributions_sponsor_idx
  ON public.sponsor_contributions(sponsor_id, paid_at DESC);

ALTER TABLE public.sponsorship_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage sponsorship plans" ON public.sponsorship_plans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage sponsors" ON public.sponsors
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage sponsor contributions" ON public.sponsor_contributions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
