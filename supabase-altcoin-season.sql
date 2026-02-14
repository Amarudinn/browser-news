-- Tabel untuk menyimpan Altcoin Season Index data
-- 100 rows, fully replaced on each daily scrape
CREATE TABLE IF NOT EXISTS altcoin_season (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  name TEXT,
  logo_url TEXT,
  coingecko_id TEXT,
  performance NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('outperform', 'underperform')),
  rank INTEGER NOT NULL,
  price NUMERIC,
  price_change_24h NUMERIC,
  index_score INTEGER,
  index_label TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_altcoin_season_rank ON altcoin_season (rank ASC);

-- RLS: publik bisa baca
ALTER TABLE altcoin_season ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON altcoin_season FOR SELECT USING (true);
CREATE POLICY "Service insert access" ON altcoin_season FOR INSERT WITH CHECK (true);
CREATE POLICY "Service delete access" ON altcoin_season FOR DELETE USING (true);
