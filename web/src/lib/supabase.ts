import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type NewsItem = {
    id: number;
    site_name: string;
    category: string;
    title: string;
    link: string;
    created_at: string;
};

export type FearGreedEntry = {
    id: number;
    score: number;
    label: string;
    reason: string;
    btc_price: number | null;
    btc_24h_change: number | null;
    btc_volume: number | null;
    headlines: { site: string; title: string; link: string }[];
    factors: { volatility: number | null; momentum: number | null; social: number | null; dominance: number | null; trends: number | null } | null;
    token_scores: { [key: string]: { score: number; label: string; summary: string } } | null;
    token_prices: { [key: string]: { price: number; change24h: number; change7d?: number; volume24h?: number; marketCap?: number } } | null;
    created_at: string;
};

export type AltcoinSeasonEntry = {
    id: number;
    ticker: string;
    name: string | null;
    logo_url: string | null;
    coingecko_id: string | null;
    performance: number;
    direction: string;
    rank: number;
    price: number | null;
    price_change_24h: number | null;
    index_score: number | null;
    index_label: string | null;
    scraped_at: string;
};

export type AltcoinSeasonScore = {
    id: number;
    score: number;
    label: string;
    reason: string | null;
    total_market_cap: number | null;
    altcoin_market_cap: number | null;
    btc_dominance: number | null;
    headlines: { title: string; link: string; site: string }[] | null;
    factors: {
        ethVsBtc: number | null;
        marketCapShare: number | null;
        defiTvl: number | null;
        volumeShare: number | null;
        social: number | null;
        marketRef: number | null;
    } | null;
    created_at: string;
};
