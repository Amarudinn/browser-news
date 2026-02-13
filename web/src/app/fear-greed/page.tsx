"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type FearGreedEntry } from "@/lib/supabase";
import Link from "next/link";

// Token config
const TOKENS = [
    { id: "bitcoin", symbol: "BTC", logo: "/bitcoin-btc-logo.svg" },
    { id: "ethereum", symbol: "ETH", logo: "/ethereum-eth-logo.png" },
    { id: "solana", symbol: "SOL", logo: "/solana-sol-logo.png" },
    { id: "binancecoin", symbol: "BNB", logo: "/bnb-bnb-logo.svg" },
];

type TokenPrice = {
    id: string;
    symbol: string;
    logo: string;
    price: number;
    change24h: number;
};

// =====================
// Utility
// =====================
function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getScoreColor(score: number): string {
    if (score <= 24) return "#ef4444";
    if (score <= 44) return "#f97316";
    if (score <= 55) return "#eab308";
    if (score <= 74) return "#84cc16";
    return "#22c55e";
}

function getScoreGradient(score: number): string {
    if (score <= 24) return "linear-gradient(135deg, #ef4444, #dc2626)";
    if (score <= 44) return "linear-gradient(135deg, #f97316, #ea580c)";
    if (score <= 55) return "linear-gradient(135deg, #eab308, #ca8a04)";
    if (score <= 74) return "linear-gradient(135deg, #84cc16, #65a30d)";
    return "linear-gradient(135deg, #22c55e, #16a34a)";
}

// =====================
// Gauge Component
// =====================
function scoreToArcPosition(score: number): number {
    const zones = [
        { min: 0, max: 24, arcStart: 0, arcEnd: 0.19 },
        { min: 25, max: 44, arcStart: 0.21, arcEnd: 0.39 },
        { min: 45, max: 55, arcStart: 0.41, arcEnd: 0.59 },
        { min: 56, max: 74, arcStart: 0.61, arcEnd: 0.79 },
        { min: 75, max: 100, arcStart: 0.81, arcEnd: 1.00 },
    ];
    for (const zone of zones) {
        if (score >= zone.min && score <= zone.max) {
            const t = (score - zone.min) / (zone.max - zone.min);
            return zone.arcStart + t * (zone.arcEnd - zone.arcStart);
        }
    }
    return score / 100;
}

function GaugeMeter({ score, label }: { score: number; label: string }) {
    const color = getScoreColor(score);
    // Arc geometry
    const cx = 150, cy = 140, r = 110;
    const startAngle = Math.PI;
    const totalAngle = Math.PI;

    // Score angle & indicator position (mapped to segment, never on gaps)
    const scoreAngle = startAngle - scoreToArcPosition(score) * totalAngle;
    const ix = cx + r * Math.cos(scoreAngle);
    const iy = cy - r * Math.sin(scoreAngle);

    // Helper to draw arc segment
    const arcPath = (startPct: number, endPct: number) => {
        const a1 = startAngle - startPct * totalAngle;
        const a2 = startAngle - endPct * totalAngle;
        const x1 = cx + r * Math.cos(a1);
        const y1 = cy - r * Math.sin(a1);
        const x2 = cx + r * Math.cos(a2);
        const y2 = cy - r * Math.sin(a2);
        const large = endPct - startPct > 0.5 ? 1 : 0;
        return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    };

    // Color segments: 0-20 red, 20-40 orange, 40-60 yellow, 60-80 lime, 80-100 green
    const segments = [
        { start: 0, end: 0.19, color: "#ef4444" },
        { start: 0.21, end: 0.39, color: "#f97316" },
        { start: 0.41, end: 0.59, color: "#eab308" },
        { start: 0.61, end: 0.79, color: "#84cc16" },
        { start: 0.81, end: 1.00, color: "#22c55e" },
    ];

    // Label badge color
    const badgeColor = score <= 24 ? "#ef4444" : score <= 44 ? "#f97316" : score <= 55 ? "#eab308" : score <= 74 ? "#84cc16" : "#22c55e";

    return (
        <div style={{ position: "relative", width: 300, height: 200, margin: "0 auto" }}>
            <svg viewBox="0 0 300 200" style={{ width: "100%", height: "100%" }}>
                {/* Color segments */}
                {segments.map((seg, i) => (
                    <path
                        key={i}
                        d={arcPath(seg.start, seg.end)}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="22"
                        strokeLinecap="butt"
                    />
                ))}


                {/* Indicator circle */}
                <circle
                    cx={ix} cy={iy} r="14"
                    fill="var(--bg-base)"
                    stroke="white"
                    strokeWidth="1"
                />

                {/* Score text */}
                <text
                    x={cx} y={cy - 10}
                    fill="var(--text-primary)"
                    fontSize="42" fontWeight="700"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontFamily="var(--font-sans)"
                >
                    {score}
                </text>

                {/* Fear / Greed labels */}
                <text x="30" y="175" fill="var(--text-tertiary)" fontSize="12" textAnchor="start" fontFamily="var(--font-sans)">Fear</text>
                <text x="270" y="175" fill="var(--text-tertiary)" fontSize="12" textAnchor="end" fontFamily="var(--font-sans)">Greed</text>
            </svg>

            {/* Label badge */}
            <div style={{
                position: "absolute",
                bottom: 4,
                left: "50%",
                transform: "translateX(-50%)",
                background: badgeColor,
                color: "#000",
                fontSize: 12,
                fontWeight: 700,
                padding: "5px 18px",
                borderRadius: 20,
                letterSpacing: "0.02em",
            }}>
                {label}
            </div>
        </div>
    );
}

// =====================
// History Chart with Filters
// =====================
type ChartFilter = "1W" | "1M" | "1Y" | "ALL";

function HistoryChart({ history }: { history: FearGreedEntry[] }) {
    const [filter, setFilter] = useState<ChartFilter>("ALL");
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    // Filter data by time range
    const filtered = (() => {
        const now = Date.now();
        const ms: Record<ChartFilter, number> = {
            "1W": 7 * 86400000,
            "1M": 30 * 86400000,
            "1Y": 365 * 86400000,
            "ALL": Infinity,
        };
        const cutoff = now - ms[filter];
        return history.filter(e => new Date(e.created_at).getTime() >= cutoff);
    })();

    const reversed = [...filtered].reverse();
    if (reversed.length < 2) return <p className="text-[12px]" style={{ color: "var(--text-tertiary)", textAlign: "center", padding: 20 }}>Not enough data for this range</p>;

    const chartWidth = 600;
    const chartHeight = 200;
    const padding = { top: 24, right: 20, bottom: 24, left: 40 };
    const innerW = chartWidth - padding.left - padding.right;
    const innerH = chartHeight - padding.top - padding.bottom;
    const xStep = innerW / (reversed.length - 1);

    // BTC price normalization
    const btcPrices = reversed.map(e => e.btc_price ?? 0).filter(p => p > 0);
    const btcMin = btcPrices.length > 0 ? Math.min(...btcPrices) : 0;
    const btcMax = btcPrices.length > 0 ? Math.max(...btcPrices) : 1;
    const btcRange = btcMax - btcMin || 1;

    // BTC volume normalization
    const btcVolumes = reversed.map(e => e.btc_volume ?? 0);
    const volMax = Math.max(...btcVolumes, 1);

    const points = reversed.map((entry, i) => {
        const d = new Date(entry.created_at);
        return {
            x: padding.left + i * xStep,
            y: padding.top + innerH - (entry.score / 100) * innerH,
            score: entry.score,
            date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fullDate: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
            time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
            btcPrice: entry.btc_price ?? 0,
            btcPriceY: entry.btc_price ? padding.top + innerH - ((entry.btc_price - btcMin) / btcRange) * innerH * 0.85 : 0,
            btcVolume: (entry as any).btc_volume ?? 0,
            btcVolumeH: ((entry as any).btc_volume ?? 0) / volMax * innerH * 0.3,
        };
    });

    // Smooth bezier curve
    const smoothLine = (pts: { x: number; y: number }[]) => {
        if (pts.length < 2) return "";
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const cx = (pts[i].x + pts[i + 1].x) / 2;
            d += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
        }
        return d;
    };

    const linePath = smoothLine(points);
    const btcPriceLine = smoothLine(points.filter(p => p.btcPrice > 0).map(p => ({ x: p.x, y: p.btcPriceY })));

    // X-axis date labels (show ~5)
    const labelStep = Math.max(1, Math.floor(points.length / 5));

    const filters: ChartFilter[] = ["1W", "1M", "1Y", "ALL"];

    return (
        <div>
            {/* Title + Filters */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Score History</span>
                <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                    {filters.map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: "5px 14px",
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                border: "none",
                                background: filter === f ? "var(--accent)" : "transparent",
                                color: filter === f ? "#fff" : "var(--text-tertiary)",
                                transition: "all 0.2s",
                            }}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>
            {/* Legend */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: hoverIdx !== null && points[hoverIdx] ? getScoreColor(points[hoverIdx].score) : "#eab308", transition: "background 0.2s" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Fear & Greed</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(59, 130, 246, 0.7)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Bitcoin Price</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(59, 130, 246, 0.35)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Bitcoin Volume</span>
                </div>
            </div>

            {/* Chart */}
            <div style={{ position: "relative" }}>
                <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    style={{ width: "100%", height: "auto", display: "block" }}
                    onMouseLeave={() => setHoverIdx(null)}
                >
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map((val) => {
                        const y = padding.top + innerH - (val / 100) * innerH;
                        return (
                            <g key={val}>
                                <line x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 5" />
                                <text x={padding.left - 8} y={y + 4} fill="var(--text-tertiary)" fontSize="10" textAnchor="end" opacity="0.5">{val}</text>
                            </g>
                        );
                    })}

                    {/* Gradients */}
                    <defs>
                        <linearGradient id="lineGrad" gradientUnits="userSpaceOnUse" x1="0" y1={padding.top + innerH} x2="0" y2={padding.top}>
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="24%" stopColor="#ef4444" />
                            <stop offset="25%" stopColor="#f97316" />
                            <stop offset="44%" stopColor="#f97316" />
                            <stop offset="45%" stopColor="#eab308" />
                            <stop offset="55%" stopColor="#eab308" />
                            <stop offset="56%" stopColor="#84cc16" />
                            <stop offset="74%" stopColor="#84cc16" />
                            <stop offset="75%" stopColor="#22c55e" />
                            <stop offset="100%" stopColor="#22c55e" />
                        </linearGradient>
                    </defs>

                    {/* Volume bars (dark blue, behind everything) */}
                    {points.map((p, i) => p.btcVolume > 0 && (
                        <rect
                            key={`vol-${i}`}
                            x={p.x - Math.max(xStep * 0.3, 2)}
                            y={padding.top + innerH - p.btcVolumeH}
                            width={Math.max(xStep * 0.6, 4)}
                            height={p.btcVolumeH}
                            fill="rgba(59, 130, 246, 0.12)"
                            rx="1"
                        />
                    ))}

                    {/* BTC Price line (blue) */}
                    {btcPriceLine && (
                        <path d={btcPriceLine} fill="none" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                    )}

                    {/* Score line (gradient) */}
                    <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

                    {/* Browser News watermark (behind tooltip) */}
                    <image href="/browser-news.png" x={chartWidth - 90} y={padding.top + innerH - 22} width="14" height="14" opacity="0.4" />
                    <text x={chartWidth - 73} y={padding.top + innerH - 22 + 7} fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="500" opacity="0.5" dominantBaseline="middle">
                        Browser News
                    </text>

                    {/* Invisible hover zones */}
                    {points.map((p, i) => (
                        <rect
                            key={i}
                            x={p.x - xStep / 2}
                            y={padding.top}
                            width={xStep}
                            height={innerH}
                            fill="transparent"
                            onMouseEnter={() => setHoverIdx(i)}
                        />
                    ))}

                    {/* Hover indicator */}
                    {hoverIdx !== null && points[hoverIdx] && (() => {
                        const p = points[hoverIdx];
                        const cardW = 180;
                        const cardH = 82;
                        // Position card: flip to left if too close to right edge
                        const cardX = p.x + cardW + 10 > chartWidth ? p.x - cardW - 10 : p.x + 10;
                        const cardY = Math.max(2, Math.min(p.y - cardH / 2, chartHeight - cardH - 2));
                        const volFormatted = p.btcVolume >= 1e9 ? `$${(p.btcVolume / 1e9).toFixed(2)}B` : `$${(p.btcVolume / 1e6).toFixed(0)}M`;
                        return (
                            <>
                                <line
                                    x1={p.x} y1={padding.top}
                                    x2={p.x} y2={padding.top + innerH}
                                    stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3"
                                />
                                <foreignObject x={cardX} y={cardY} width={cardW} height={cardH} style={{ pointerEvents: "none" }}>
                                    <div style={{
                                        background: "var(--bg-surface)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: 8,
                                        padding: "8px 10px",
                                        fontSize: 10,
                                        lineHeight: 1.6,
                                        fontFamily: "var(--font-sans)",
                                    }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-tertiary)", marginBottom: 4, fontSize: 9 }}>
                                            <span>{p.fullDate}</span>
                                            <span>{p.time}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)" }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: getScoreColor(p.score), flexShrink: 0 }} />
                                            <span>Fear & Greed:</span>
                                            <span style={{ marginLeft: "auto", fontWeight: 700, color: getScoreColor(p.score) }}>{p.score}</span>
                                        </div>
                                        {p.btcPrice > 0 && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)" }}>
                                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(59, 130, 246, 0.7)", flexShrink: 0 }} />
                                                <span>Bitcoin Price:</span>
                                                <span style={{ marginLeft: "auto", fontWeight: 700, color: "rgba(59, 130, 246, 0.9)" }}>${p.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>
                                        )}
                                        {p.btcVolume > 0 && (
                                            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)" }}>
                                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(59, 130, 246, 0.5)", flexShrink: 0 }} />
                                                <span>Bitcoin Volume:</span>
                                                <span style={{ marginLeft: "auto", fontWeight: 700, color: "rgba(59, 130, 246, 0.7)" }}>{volFormatted}</span>
                                            </div>
                                        )}
                                    </div>
                                </foreignObject>
                            </>
                        );
                    })()}

                    {/* X-axis dates */}
                    {points.map((p, i) => (
                        (i === 0 || i === points.length - 1 || i % labelStep === 0) && (
                            <text key={`d${i}`} x={p.x} y={chartHeight - 4} fill="var(--text-tertiary)" fontSize="9" textAnchor="middle" opacity="0.6">
                                {p.date}
                            </text>
                        )
                    ))}
                </svg>
            </div>
        </div>
    );
}

// =====================
// Main Page
// =====================
export default function FearGreedPage() {
    const [latest, setLatest] = useState<FearGreedEntry | null>(null);
    const [history, setHistory] = useState<FearGreedEntry[]>([]);
    const [tokenPrices, setTokenPrices] = useState<TokenPrice[]>([]);
    const [showSummary, setShowSummary] = useState(false);
    const [tokenSummary, setTokenSummary] = useState<{ symbol: string; summary: string; score: number; label: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDownload, setShowDownload] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);

        // Fetch latest entry
        const { data: latestData } = await supabase
            .from("fear_greed_index")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1);

        if (latestData && latestData.length > 0) {
            setLatest(latestData[0]);
        }

        // Fetch history (up to 365 for 1Y filter)
        const { data: historyData } = await supabase
            .from("fear_greed_index")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(365);

        if (historyData) {
            setHistory(historyData);
        }

        // Read token prices from Supabase (cached from fear-greed.js)
        if (latestData && latestData.length > 0) {
            const entry = latestData[0];
            const tp = entry.token_prices as Record<string, { currentPrice?: number; price?: number; change24h?: number }> | null;
            const prices: TokenPrice[] = TOKENS.map(token => ({
                ...token,
                price: tp?.[token.symbol]?.currentPrice ?? tp?.[token.symbol]?.price ?? (token.symbol === "BTC" ? entry.btc_price ?? 0 : 0),
                change24h: tp?.[token.symbol]?.change24h ?? (token.symbol === "BTC" ? entry.btc_24h_change ?? 0 : 0),
            }));
            setTokenPrices(prices);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="min-h-screen">
            {/* â”€â”€â”€ Header â”€â”€â”€ */}
            <header
                className="sticky top-0 z-50 backdrop-blur-xl"
                style={{
                    background: "rgba(10, 10, 11, 0.8)",
                    borderBottom: "1px solid var(--border-subtle)",
                }}
            >
                <div className="container-width h-14 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
                        <img
                            src="/browser-news.png"
                            alt="Browser News"
                            className="w-7 h-7 rounded-lg"
                            style={{ objectFit: "contain" }}
                        />
                        <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
                            Browser News
                        </span>
                    </Link>

                    <div className="flex items-center gap-3">
                        <Link href="/" className="refresh-btn" title="Back to News">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5" />
                                <path d="M12 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <button onClick={fetchData} className="refresh-btn" title="Refresh">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            {/* â”€â”€â”€ Main Content â”€â”€â”€ */}
            <main className="container-width" style={{ paddingTop: 32, paddingBottom: 40 }}>
                {/* Title */}
                <div style={{ marginBottom: 32 }}>
                    <h2 className="text-xl font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
                        Fear & Greed Index
                    </h2>
                    <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                        AI-powered crypto market sentiment
                    </p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="news-card news-card-static" style={{ padding: 40 }}>
                            <div className="shimmer-bg" style={{ width: 200, height: 160, margin: "0 auto", borderRadius: 12 }} />
                            <div className="shimmer-bg" style={{ width: 120, height: 24, margin: "20px auto 0", borderRadius: 8 }} />
                        </div>
                        <div className="news-card news-card-static" style={{ padding: 28 }}>
                            <div className="shimmer-bg mb-2" style={{ height: 16, width: "80%" }} />
                            <div className="shimmer-bg mb-2" style={{ height: 16, width: "60%" }} />
                            <div className="shimmer-bg" style={{ height: 16, width: "40%" }} />
                        </div>
                    </div>
                ) : !latest ? (
                    <div
                        className="py-20 text-center rounded-2xl"
                        style={{
                            border: "1px dashed var(--border-default)",
                            background: "var(--bg-surface)",
                        }}
                    >
                        <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                            No Fear & Greed data yet
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)", }}>
                            Run fear-greed.js to generate the first index
                        </p>
                    </div>
                ) : (
                    <>
                        {/* â”€â”€â”€ Score + BTC Info â”€â”€â”€ */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 24 }}>
                            {/* Gauge Card */}
                            <div className="news-card news-card-static" style={{ padding: "16px 16px 16px" }}>
                                {/* Top: Crypto + Summary */}
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                                    <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Crypto</span>
                                    <button
                                        className="btn-summary"
                                        onClick={() => setShowSummary(true)}
                                        style={{
                                            background: "rgba(255,255,255,0.08)",
                                            border: "1px solid var(--border-subtle)",
                                            borderRadius: 8,
                                            padding: "4px 12px",
                                            cursor: "pointer",
                                            color: "var(--text-secondary)",
                                            fontSize: 11,
                                            fontWeight: 600,
                                        }}
                                    >
                                        Summary
                                    </button>
                                </div>
                                <GaugeMeter score={latest.score} label={latest.label} />
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                                    <a href="https://browser-news.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                                        <img src="/browser-news.png" alt="Browser News" style={{ width: 18, height: 18, borderRadius: 3 }} />
                                        <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                                            browser-news.vercel.app
                                        </span>
                                    </a>
                                    <span className="text-[10px] sm:text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                        Last Updated: {new Date(latest.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                                    </span>
                                </div>
                            </div>

                            {/* Summary Modal */}
                            {showSummary && (
                                <div
                                    onClick={() => setShowSummary(false)}
                                    style={{
                                        position: "fixed", inset: 0,
                                        background: "rgba(0,0,0,0.6)",
                                        backdropFilter: "blur(4px)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        zIndex: 1000, padding: 20,
                                    }}
                                >
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            background: "var(--bg-surface)",
                                            border: "1px solid var(--border-subtle)",
                                            borderRadius: 16,
                                            padding: "24px",
                                            maxWidth: 480,
                                            width: "100%",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                            <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>AI Summary</span>
                                            <button
                                                onClick={() => setShowSummary(false)}
                                                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 19, lineHeight: 1, padding: 4, borderRadius: 6, transition: "opacity 0.2s", marginTop: -4 }}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.6"}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <p className="text-[13px] leading-[1.8]" style={{ color: "var(--text-secondary)" }}>
                                            {latest.reason}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Token Prices with Fear & Greed Scores */}
                            <div className="flex flex-col gap-2">
                                {/* Column Headers */}
                                <div style={{ display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
                                    <span className="text-[10px] font-semibold" style={{ color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", width: 70, minWidth: 70 }}>Symbol</span>
                                    <span className="text-[10px] font-semibold" style={{ color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", flex: 1 }}>Score</span>
                                    <span className="text-[10px] font-semibold hidden sm:inline" style={{ color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", width: 90 }}>Price</span>
                                    <span className="hidden sm:inline" style={{ width: 70, marginLeft: 8 }}></span>
                                </div>
                                {tokenPrices.map((token) => {
                                    const ts = latest?.token_scores?.[token.symbol];
                                    return (
                                        <div key={token.id} className="news-card news-card-static" style={{ padding: "12px 12px", height: "auto" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                {/* Symbol */}
                                                <div className="flex items-center gap-2" style={{ width: 70, minWidth: 70 }}>
                                                    <img src={token.logo} alt={token.symbol} style={{ width: 24, height: 24 }} />
                                                    <span className="text-[12px] sm:text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{token.symbol}</span>
                                                </div>
                                                {/* Score Badge + Score Number */}
                                                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                                                    {ts ? (
                                                        <>
                                                            <span style={{
                                                                fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                                                                background: `${getScoreColor(ts.score)}20`, color: getScoreColor(ts.score),
                                                                whiteSpace: "nowrap",
                                                            }}>
                                                                {ts.label}
                                                            </span>
                                                            <span className="text-[13px] font-bold" style={{ color: getScoreColor(ts.score) }}>
                                                                {ts.score}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>—</span>
                                                    )}
                                                </div>
                                                {/* Price */}
                                                <span className="text-[12px] sm:text-[13px] font-semibold hidden sm:inline" style={{ color: "var(--text-primary)", width: 90 }}>
                                                    ${token.price.toLocaleString(undefined, { maximumFractionDigits: token.price < 10 ? 2 : 0 })}
                                                </span>
                                                {/* Summary Button */}
                                                {ts?.summary && (
                                                    <button
                                                        className="btn-summary"
                                                        onClick={() => setTokenSummary({ symbol: token.symbol, summary: ts.summary, score: ts.score, label: ts.label })}
                                                        style={{
                                                            background: "rgba(255,255,255,0.08)",
                                                            border: "1px solid var(--border-subtle)",
                                                            borderRadius: 6,
                                                            padding: "3px 10px",
                                                            cursor: "pointer",
                                                            color: "var(--text-secondary)",
                                                            fontSize: 10,
                                                            fontWeight: 600,
                                                            marginLeft: 8,
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        Summary
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Token Summary Modal */}
                            {tokenSummary && (
                                <div
                                    onClick={() => setTokenSummary(null)}
                                    style={{
                                        position: "fixed", inset: 0,
                                        background: "rgba(0,0,0,0.6)",
                                        backdropFilter: "blur(4px)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        zIndex: 1000, padding: 20,
                                    }}
                                >
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            background: "var(--bg-surface)",
                                            border: "1px solid var(--border-subtle)",
                                            borderRadius: 16,
                                            padding: "24px",
                                            maxWidth: 420,
                                            width: "100%",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{tokenSummary.symbol}</span>
                                                <span style={{
                                                    fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                                                    background: `${getScoreColor(tokenSummary.score)}20`, color: getScoreColor(tokenSummary.score),
                                                }}>
                                                    {tokenSummary.label}
                                                </span>
                                                <span className="text-[13px] font-bold" style={{ color: getScoreColor(tokenSummary.score), }}>
                                                    {tokenSummary.score}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => setTokenSummary(null)}
                                                style={{ background: "none", border: "none", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 19, lineHeight: 1, padding: 4, borderRadius: 6, transition: "opacity 0.2s", marginTop: -4 }}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = "0.6"}
                                                onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
                                            >
                                                {"\u2715"}
                                            </button>
                                        </div>
                                        <p className="text-[13px] leading-[1.8]" style={{ color: "var(--text-secondary)" }}>
                                            {tokenSummary.summary}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* --- Score History Chart --- */}
                        {history.length >= 2 && (
                            <div className="news-card news-card-static" style={{ padding: "16px 12px", marginBottom: 24 }}>
                                <HistoryChart history={history} />
                            </div>
                        )}

                        {latest.factors && (
                            <div className="news-card news-card-static" style={{ padding: "16px 12px", marginBottom: 24 }}>
                                <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                                    <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                        Factor Breakdown
                                    </span>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {[
                                        { key: "volatility", label: "Volatility", weight: "25%", source: "Coingecko" },
                                        { key: "momentum", label: "Momentum & Volume", weight: "25%", source: "Coingecko" },
                                        { key: "social", label: "Social Media", weight: "17.5%", source: "Membit" },
                                        { key: "trends", label: "Market Reference", weight: "17.5%", source: "alternative.me" },
                                        { key: "dominance", label: "BTC Dominance", weight: "15%", source: "Browser.cash" },
                                    ].map((factor) => {
                                        const value = latest.factors?.[factor.key as keyof typeof latest.factors];
                                        if (value === null || value === undefined) return (
                                            <div key={factor.key} style={{ padding: "8px 0", opacity: 0.5 }}>
                                                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                                                    <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                                                        {factor.label} <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>({factor.weight})</span>
                                                        {factor.source && <span style={{ fontSize: 9, color: "var(--text-tertiary)", marginLeft: 6 }}>{factor.source}</span>}
                                                    </span>
                                                    <span className="text-[11px]" style={{ color: "var(--text-tertiary)", }}>N/A</span>
                                                </div>
                                            </div>
                                        );
                                        return (
                                            <div key={factor.key} style={{ padding: "8px 0" }}>
                                                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                                                    <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                                                        {factor.label} <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>({factor.weight})</span>
                                                        {factor.source && <span style={{ fontSize: 9, color: "var(--text-tertiary)", marginLeft: 6 }}>{factor.source}</span>}
                                                    </span>
                                                    <span className="text-[13px] font-bold" style={{ color: getScoreColor(value), }}>
                                                        {value}
                                                    </span>
                                                </div>
                                                <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                                    <div style={{
                                                        height: "100%",
                                                        width: `${value}%`,
                                                        borderRadius: 3,
                                                        background: `linear-gradient(90deg, ${getScoreColor(Math.max(0, value - 20))}, ${getScoreColor(value)})`,
                                                        transition: "width 0.8s ease-out"
                                                    }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* â”€â”€â”€ Headlines Used â”€â”€â”€ */}
                        {latest.headlines && latest.headlines.length > 0 && (
                            <div className="news-card news-card-static" style={{ padding: "16px 12px", marginBottom: 24 }}>
                                <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                                    <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                        Headlines Analyzed
                                    </span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {latest.headlines.map((h, i) => (
                                        <a
                                            key={i}
                                            href={h.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start gap-3 group"
                                            style={{ textDecoration: "none", padding: "10px 12px", borderRadius: 10, background: "var(--bg-base)", border: "1px solid var(--border-subtle)", transition: "border-color 0.2s" }}
                                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hover)")}
                                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-subtle)")}
                                        >
                                            <span className="text-[11px] font-bold" style={{ color: "var(--accent)", minWidth: 18 }}>
                                                {i + 1}.
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-medium leading-[1.5] line-clamp-2" style={{ color: "var(--text-primary)" }}>
                                                    {h.title}
                                                </p>
                                                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                                    {h.site}
                                                </span>
                                            </div>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 2, flexShrink: 0 }}>
                                                <path d="M7 17L17 7" />
                                                <path d="M7 7h10v10" />
                                            </svg>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ——— History Table ——— */}
                        {history.length > 0 && (() => {
                            const now = Date.now();
                            const last30d = history.filter(e => new Date(e.created_at).getTime() >= now - 30 * 86400000);

                            const downloadJSON = (range: "30D" | "1Y" | "ALL") => {
                                const ms: Record<string, number> = { "30D": 30 * 86400000, "1Y": 365 * 86400000, "ALL": Infinity };
                                const cutoff = now - ms[range];
                                const data = history.filter(e => new Date(e.created_at).getTime() >= cutoff).map(e => ({
                                    date: e.created_at,
                                    score: e.score,
                                    label: e.label,
                                    btc_price: e.btc_price,
                                    reason: e.reason,
                                }));
                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `fear-greed-${range.toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                                setShowDownload(false);
                            };

                            return (
                                <div className="news-card news-card-static" style={{ padding: "16px 12px" }}>
                                    <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                                Update History
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                                Last 30 days
                                            </span>
                                            <div style={{ position: "relative" }}>
                                                <button
                                                    onClick={() => setShowDownload(!showDownload)}
                                                    className="btn-summary"
                                                    style={{
                                                        background: "rgba(255,255,255,0.08)",
                                                        border: "1px solid var(--border-subtle)",
                                                        borderRadius: 6,
                                                        padding: "4px 10px",
                                                        cursor: "pointer",
                                                        color: "var(--text-secondary)",
                                                        fontSize: 10,
                                                        fontWeight: 600,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 4,
                                                    }}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                        <polyline points="7 10 12 15 17 10" />
                                                        <line x1="12" y1="15" x2="12" y2="3" />
                                                    </svg>
                                                    Download
                                                </button>
                                                {showDownload && (
                                                    <>
                                                        <div
                                                            onClick={() => setShowDownload(false)}
                                                            style={{ position: "fixed", inset: 0, zIndex: 99 }}
                                                        />
                                                        <div style={{
                                                            position: "absolute",
                                                            top: "calc(100% + 6px)",
                                                            right: 0,
                                                            background: "var(--bg-surface)",
                                                            border: "1px solid var(--border-subtle)",
                                                            borderRadius: 8,
                                                            padding: 4,
                                                            zIndex: 100,
                                                            minWidth: 100,
                                                        }}>
                                                            {(["30D", "1Y", "ALL"] as const).map(r => (
                                                                <button
                                                                    key={r}
                                                                    onClick={() => downloadJSON(r)}
                                                                    style={{
                                                                        display: "block",
                                                                        width: "100%",
                                                                        padding: "6px 12px",
                                                                        fontSize: 11,
                                                                        fontWeight: 500,
                                                                        color: "var(--text-secondary)",
                                                                        background: "none",
                                                                        border: "none",
                                                                        cursor: "pointer",
                                                                        borderRadius: 5,
                                                                        textAlign: "left",
                                                                        transition: "background 0.15s",
                                                                    }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                                                                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                                                                >
                                                                    {r === "30D" ? "Last 30 Days" : r === "1Y" ? "Last 1 Year" : "All Time"}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ overflowX: "auto" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                            <thead>
                                                <tr>
                                                    <th className="text-[11px] font-semibold text-left" style={{ color: "var(--text-tertiary)", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>Date</th>
                                                    <th className="text-[11px] font-semibold text-center" style={{ color: "var(--text-tertiary)", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>Score</th>
                                                    <th className="text-[11px] font-semibold text-left" style={{ color: "var(--text-tertiary)", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>Label</th>
                                                    <th className="text-[11px] font-semibold text-right hidden sm:table-cell" style={{ color: "var(--text-tertiary)", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>BTC Price</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {last30d.map((entry) => (
                                                    <tr key={entry.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                                        <td className="text-[12px]" style={{ color: "var(--text-secondary)", padding: "10px 12px" }}>
                                                            {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                            <span className="text-[11px]" style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>
                                                                {new Date(entry.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                                                            </span>
                                                        </td>
                                                        <td className="text-center">
                                                            <span
                                                                className="text-[13px] font-bold"
                                                                style={{
                                                                    color: getScoreColor(entry.score),
                                                                    padding: "2px 10px",
                                                                    borderRadius: 6,
                                                                    background: `${getScoreColor(entry.score)}15`,
                                                                }}
                                                            >
                                                                {entry.score}
                                                            </span>
                                                        </td>
                                                        <td className="text-[12px] font-medium" style={{ color: getScoreColor(entry.score), padding: "10px 12px" }}>
                                                            {entry.label}
                                                        </td>
                                                        <td className="text-[12px] text-right hidden sm:table-cell" style={{ color: "var(--text-secondary)", padding: "10px 12px" }}>
                                                            {entry.btc_price ? `$${Number(entry.btc_price).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "-"}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })()}
                    </>
                )}
            </main>

            {/* ——— Footer ——— */}
            <footer
                className="py-6 mt-16"
                style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
                <div className="container-width flex flex-col items-center gap-2" style={{ padding: "16px 20px" }}>
                    <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        Browser News · Powered by Browser.cash
                    </span>
                </div>
            </footer>
        </div>
    );
}
