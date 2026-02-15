-- Tabel untuk menyimpan Altcoin Season Score (AI-Powered)
-- 6 Factors: ETH vs BTC, Market Cap Share, DeFi TVL, Volume Share, Social, Market Ref
CREATE TABLE IF NOT EXISTS altcoin_season_score (
  id SERIAL PRIMARY KEY,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  label TEXT NOT NULL,
  reason TEXT,
  total_market_cap NUMERIC,
  altcoin_market_cap NUMERIC,
  btc_dominance NUMERIC,
  headlines JSONB,
  factors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ass_created_at ON altcoin_season_score (created_at DESC);

-- RLS: publik bisa baca
ALTER TABLE altcoin_season_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON altcoin_season_score FOR SELECT USING (true);
CREATE POLICY "Service insert access" ON altcoin_season_score FOR INSERT WITH CHECK (true);
