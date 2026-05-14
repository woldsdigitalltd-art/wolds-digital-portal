-- Extend sites table with review monitor fields
ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS review_tracking_mode  TEXT DEFAULT 'snapshot' CHECK (review_tracking_mode IN ('snapshot', 'full')),
  ADD COLUMN IF NOT EXISTS google_place_id        TEXT,
  ADD COLUMN IF NOT EXISTS trustpilot_domain      TEXT,
  ADD COLUMN IF NOT EXISTS google_current_rating  NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS google_total_reviews   INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trustpilot_score       NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS trustpilot_total_reviews INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_last_checked_at TIMESTAMPTZ;

-- Daily snapshot — one row per site per day per source
-- Used by BOTH tracking modes
CREATE TABLE IF NOT EXISTS review_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('google', 'trustpilot')),
  snapshot_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  rating          NUMERIC(3,1),
  total_reviews   INTEGER NOT NULL DEFAULT 0,
  new_reviews     INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, source, snapshot_date)
);

-- Individual reviews — only populated when tracking mode is 'full'
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  source          TEXT NOT NULL CHECK (source IN ('google', 'trustpilot')),
  external_id     TEXT NOT NULL, -- Google review ID or Trustpilot review ID
  reviewer_name   TEXT,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text     TEXT,
  reviewed_at     TIMESTAMPTZ,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (site_id, source, external_id)
);

-- RLS
ALTER TABLE review_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Admins can manage everything
CREATE POLICY "Admins can manage review_snapshots"
  ON review_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can manage reviews"
  ON reviews FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Owners can read their own site snapshots
CREATE POLICY "Owners can view their own review_snapshots"
  ON review_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = review_snapshots.site_id
      AND sites.owner_id = auth.uid()
    )
  );

-- Owners can read their own site reviews
CREATE POLICY "Owners can view their own reviews"
  ON reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sites
      WHERE sites.id = reviews.site_id
      AND sites.owner_id = auth.uid()
    )
  );
