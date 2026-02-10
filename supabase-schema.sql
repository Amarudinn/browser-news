-- Tabel untuk menyimpan berita dari news-monitor
CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  site_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  link TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_category ON news (category);
CREATE INDEX IF NOT EXISTS idx_news_link ON news (link);

-- RLS: publik bisa baca
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON news FOR SELECT USING (true);
CREATE POLICY "Service insert access" ON news FOR INSERT WITH CHECK (true);
