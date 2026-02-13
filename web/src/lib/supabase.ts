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
    created_at: string;
};
