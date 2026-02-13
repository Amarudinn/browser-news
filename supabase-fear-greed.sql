-- Tabel untuk menyimpan Fear & Greed Index history
-- v2: includes factor breakdown
CREATE TABLE IF NOT EXISTS fear_greed_index (
  id SERIAL PRIMARY KEY,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  label TEXT NOT NULL,
  reason TEXT,
  btc_price NUMERIC,
  btc_24h_change NUMERIC,
  btc_volume NUMERIC,
  headlines JSONB,
  factors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_fgi_created_at ON fear_greed_index (created_at DESC);

-- RLS: publik bisa baca
ALTER TABLE fear_greed_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON fear_greed_index FOR SELECT USING (true);
CREATE POLICY "Service insert access" ON fear_greed_index FOR INSERT WITH CHECK (true);
