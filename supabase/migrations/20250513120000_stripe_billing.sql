-- Add stripe_customer_id to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- Add Stripe billing columns to sites
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none';

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id                UUID REFERENCES sites(id) ON DELETE SET NULL,
  stripe_invoice_id      TEXT UNIQUE,
  stripe_payment_link_id TEXT,
  type                   TEXT NOT NULL CHECK (type IN ('one_off', 'subscription')),
  amount                 INTEGER NOT NULL,
  currency               TEXT NOT NULL DEFAULT 'gbp',
  status                 TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'void')),
  description            TEXT,
  hosted_invoice_url     TEXT,
  invoice_pdf_url        TEXT,
  due_date               TIMESTAMPTZ,
  paid_at                TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage payments"
  ON payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Owners can view their own payments"
  ON payments FOR SELECT
  USING (owner_id = auth.uid());

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
