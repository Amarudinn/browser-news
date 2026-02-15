"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type AltcoinSeasonEntry, type AltcoinSeasonScore } from "@/lib/supabase";
import TabNavigation from "@/app/components/TabNavigation";

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

function getSeasonLabel(score: number): string {
    if (score >= 75) return "Altcoin Season";
    if (score >= 50) return "Semi Altcoin Season";
    if (score >= 25) return "Bitcoin Season";
    return "Bitcoin Season";
}

function getSeasonColor(score: number): string {
    if (score >= 75) return "#16a34a";
    if (score >= 50) return "#22c55e";
    if (score >= 25) return "#eab308";
    return "#f97316";
}

type AltChartFilter = "1W" | "1M" | "3M" | "ALL";

// Smooth bezier curve helper
function smoothLine(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const cx = (pts[i].x + pts[i + 1].x) / 2;
        d += ` C ${cx} ${pts[i].y}, ${cx} ${pts[i + 1].y}, ${pts[i + 1].x} ${pts[i + 1].y}`;
    }
    return d;
}

// =====================
// Combined Chart: Score + Market Cap (1 chart, 2 lines)
// =====================
function AltcoinSeasonScoreChart({ scoreHistory }: { scoreHistory: AltcoinSeasonScore[] }) {
    const [filter, setFilter] = useState<AltChartFilter>("ALL");
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    // Convert scoreHistory to chart data
    const chartData = scoreHistory.map(s => ({
        date: s.created_at,
        score: s.score,
        capT: s.altcoin_market_cap ? s.altcoin_market_cap / 1e12 : 0,
    })).reverse();

    const filtered = (() => {
        const now = Date.now();
        const ms: Record<AltChartFilter, number> = { "1W": 7 * 86400000, "1M": 30 * 86400000, "3M": 90 * 86400000, "ALL": Infinity };
        const cutoff = now - ms[filter];
        return chartData.filter(e => new Date(e.date).getTime() >= cutoff);
    })();

    if (filtered.length < 2) return <p style={{ color: "var(--text-tertiary)", textAlign: "center", padding: 20, fontSize: 12 }}>Not enough data</p>;

    const W = 600, H = 200;
    const pad = { top: 24, right: 20, bottom: 24, left: 40 };
    const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom;
    const xStep = iW / (filtered.length - 1);

    // Market cap normalization
    const caps = filtered.map(e => e.capT);
    const capMin = Math.min(...caps);
    const capMax = Math.max(...caps);
    const capRange = capMax - capMin || 1;

    const points = filtered.map((e, i) => {
        const d = new Date(e.date);
        return {
            x: pad.left + i * xStep,
            y: pad.top + iH - (e.score / 100) * iH,
            score: e.score,
            capT: e.capT,
            capY: pad.top + iH - ((e.capT - capMin) / capRange) * iH * 0.85,
            date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            fullDate: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" }),
        };
    });

    const scoreLine = smoothLine(points);
    const capLine = smoothLine(points.map(p => ({ x: p.x, y: p.capY })));
    const labelStep = Math.max(1, Math.floor(points.length / 5));
    const filters: AltChartFilter[] = ["1W", "1M", "3M", "ALL"];

    return (
        <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Altcoin Season Score</span>
                <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                    {filters.map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            padding: "5px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: "none",
                            background: filter === f ? "var(--accent)" : "transparent",
                            color: filter === f ? "#fff" : "var(--text-tertiary)", transition: "all 0.2s",
                        }}>{f}</button>
                    ))}
                </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: hoverIdx !== null ? getSeasonColor(points[hoverIdx].score) : "#22c55e", transition: "background 0.2s" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Altcoin Season</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(59, 130, 246, 0.7)" }} />
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Altcoin Market Cap</span>
                </div>
            </div>
            <div style={{ position: "relative" }}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} onMouseLeave={() => setHoverIdx(null)}>
                    {/* Grid */}
                    {[0, 25, 50, 75, 100].map(val => {
                        const y = pad.top + iH - (val / 100) * iH;
                        return (
                            <g key={val}>
                                <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 5" />
                                <text x={pad.left - 8} y={y + 4} fill="var(--text-tertiary)" fontSize="10" textAnchor="end" opacity="0.5">{val}</text>
                            </g>
                        );
                    })}
                    {/* Gradient */}
                    <defs>
                        <linearGradient id="altScoreGrad" gradientUnits="userSpaceOnUse" x1="0" y1={pad.top + iH} x2="0" y2={pad.top}>
                            <stop offset="0%" stopColor="#f97316" />
                            <stop offset="25%" stopColor="#eab308" />
                            <stop offset="50%" stopColor="#22c55e" />
                            <stop offset="100%" stopColor="#16a34a" />
                        </linearGradient>
                    </defs>
                    {/* Market Cap line (blue, behind score) */}
                    <path d={capLine} fill="none" stroke="rgba(59, 130, 246, 0.5)" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                    {/* Score line (gradient) */}
                    <path d={scoreLine} fill="none" stroke="url(#altScoreGrad)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                    {/* Watermark */}
                    <image href="/browser-news.png" x={W - 90} y={pad.top + iH - 22} width="14" height="14" opacity="0.4" />
                    <text x={W - 73} y={pad.top + iH - 15} fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="500" opacity="0.5" dominantBaseline="middle">Browser News</text>
                    {/* Hover zones */}
                    {points.map((p, i) => (
                        <rect key={i} x={p.x - xStep / 2} y={pad.top} width={xStep} height={iH} fill="transparent" onMouseEnter={() => setHoverIdx(i)} />
                    ))}
                    {/* Hover tooltip */}
                    {hoverIdx !== null && points[hoverIdx] && (() => {
                        const p = points[hoverIdx];
                        const cW = 180, cH = 68;
                        const cX = p.x + cW + 10 > W ? p.x - cW - 10 : p.x + 10;
                        const cY = Math.max(2, Math.min(p.y - cH / 2, H - cH - 2));
                        return (
                            <>
                                <line x1={p.x} y1={pad.top} x2={p.x} y2={pad.top + iH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
                                <foreignObject x={cX} y={cY} width={cW} height={cH} style={{ pointerEvents: "none" }}>
                                    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: "8px 10px", fontSize: 10, lineHeight: 1.6, fontFamily: "var(--font-sans)" }}>
                                        <div style={{ color: "var(--text-tertiary)", marginBottom: 4, fontSize: 9 }}>{p.fullDate}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)" }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: getSeasonColor(p.score), flexShrink: 0 }} />
                                            <span>Altcoin Season:</span>
                                            <span style={{ marginLeft: "auto", fontWeight: 700, color: getSeasonColor(p.score) }}>{p.score}</span>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--text-secondary)" }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(59, 130, 246, 0.7)", flexShrink: 0 }} />
                                            <span>Altcoin Market Cap:</span>
                                            <span style={{ marginLeft: "auto", fontWeight: 700, color: "rgba(59, 130, 246, 0.9)" }}>${p.capT.toFixed(3)}T</span>
                                        </div>
                                    </div>
                                </foreignObject>
                            </>
                        );
                    })()}
                    {/* X-axis dates */}
                    {points.map((p, i) => (
                        (i === 0 || i === points.length - 1 || i % labelStep === 0) && (
                            <text key={`d${i}`} x={p.x} y={H - 4} fill="var(--text-tertiary)" fontSize="9" textAnchor="middle" opacity="0.6">{p.date}</text>
                        )
                    ))}
                </svg>
            </div>
        </div>
    );
}
export default function AltcoinSeasonPage() {
    const [altcoins, setAltcoins] = useState<AltcoinSeasonEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSummary, setShowSummary] = useState(false);
    const [showDownload, setShowDownload] = useState(false);
    const [scoreData, setScoreData] = useState<AltcoinSeasonScore | null>(null);
    const [scoreHistory, setScoreHistory] = useState<AltcoinSeasonScore[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        // Fetch altcoin coins list
        const { data } = await supabase
            .from("altcoin_season")
            .select("*")
            .order("rank", { ascending: true });
        if (data) setAltcoins(data);

        // Fetch latest AI score
        const { data: scores } = await supabase
            .from("altcoin_season_score")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(90);
        if (scores && scores.length > 0) {
            setScoreData(scores[0]);
            setScoreHistory(scores);
        }

        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const score = scoreData?.score ?? 0;
    const latestLabel = scoreData?.label ?? "—";

    return (
        <TabNavigation onRefresh={fetchData}>
            <div style={{ marginBottom: 24 }}>
                <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                    Altcoin Season Index
                </h2>
                <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
                    AI-powered crypto market sentiment
                </p>
            </div>

            {showSummary ? (
                /* ========== SUMMARY VIEW ========== */
                <div>
                    {/* Back button */}
                    <button
                        onClick={() => setShowSummary(false)}
                        style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--text-tertiary)", fontSize: 13, fontWeight: 500,
                            marginBottom: 20, padding: 0,
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Index
                    </button>

                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                        {/* Card 1: AI Summary */}
                        <div className="news-card news-card-static" style={{ padding: 20 }}>
                            <div style={{ marginBottom: 12 }}>
                                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>AI Summary</span>
                            </div>
                            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                                {scoreData?.reason ?? "No AI analysis available yet. Run altcoin-season-score.js to generate the first score."}
                            </p>
                        </div>

                        {/* Card 2: Factor Breakdown */}
                        <div className="news-card news-card-static" style={{ padding: "16px 12px" }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                    Factor Breakdown
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {(scoreData?.factors ? [
                                    { key: "ethVsBtc", label: "ETH vs BTC Performance", weight: "20%", source: "CoinGecko", score: scoreData.factors.ethVsBtc },
                                    { key: "marketCapShare", label: "Altcoin Market Cap Share", weight: "20%", source: "CoinGecko", score: scoreData.factors.marketCapShare },
                                    { key: "defiTvl", label: "DeFi TVL Growth", weight: "20%", source: "DefiLlama", score: scoreData.factors.defiTvl },
                                    { key: "volumeShare", label: "Altcoin Volume Share", weight: "10%", source: "CoinGecko", score: scoreData.factors.volumeShare },
                                    { key: "social", label: "Social Media", weight: "20%", source: "Membit", score: scoreData.factors.social },
                                    { key: "marketRef", label: "Market Reference", weight: "10%", source: "CMC", score: scoreData.factors.marketRef },
                                ] : []).filter(f => f.score != null).map((factor) => (
                                    <div key={factor.key} style={{ padding: "8px 0" }}>
                                        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                                            <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
                                                {factor.label} <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>({factor.weight})</span>
                                                {factor.source && <span style={{ fontSize: 9, color: "var(--text-tertiary)", marginLeft: 6 }}>{factor.source}</span>}
                                            </span>
                                            <span className="text-[13px] font-bold" style={{ color: getSeasonColor(factor.score!) }}>
                                                {factor.score}
                                            </span>
                                        </div>
                                        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                            <div style={{
                                                height: "100%",
                                                width: `${factor.score}%`,
                                                borderRadius: 3,
                                                background: `linear-gradient(90deg, ${getSeasonColor(Math.max(0, factor.score! - 20))}, ${getSeasonColor(factor.score!)})`,
                                                transition: "width 0.8s ease-out"
                                            }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Card 3: Headlines Analyzed */}
                        <div className="news-card news-card-static" style={{ padding: "16px 12px" }}>
                            <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
                                <span className="text-[12px] font-semibold" style={{ color: "var(--text-primary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                                    Headlines Analyzed
                                </span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {(scoreData?.headlines && scoreData.headlines.length > 0) ? scoreData.headlines.map((h, i) => (
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
                                )) : (
                                    <p className="text-[12px]" style={{ color: "var(--text-tertiary)", textAlign: "center", padding: 16 }}>No headlines available yet</p>
                                )}
                            </div>
                        </div>

                        {/* Card 4: Update History */}
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
                                                    {(["30D", "1Y", "ALL"] as const).map(r => {
                                                        const downloadJSON = (range: string) => {
                                                            const blob = new Blob([JSON.stringify(scoreHistory, null, 2)], { type: "application/json" });
                                                            const url = URL.createObjectURL(blob);
                                                            const a = document.createElement("a");
                                                            a.href = url;
                                                            a.download = `altcoin-season-${range.toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`;
                                                            a.click();
                                                            URL.revokeObjectURL(url);
                                                            setShowDownload(false);
                                                        };
                                                        return (
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
                                                        );
                                                    })}
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
                                            <th className="text-[11px] font-semibold text-right hidden sm:table-cell" style={{ color: "var(--text-tertiary)", padding: "8px 12px", borderBottom: "1px solid var(--border-subtle)" }}>Market Cap</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {scoreHistory.map((entry, i) => (
                                            <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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
                                                            color: getSeasonColor(entry.score),
                                                            padding: "2px 10px",
                                                            borderRadius: 6,
                                                            background: `${getSeasonColor(entry.score)}15`,
                                                        }}
                                                    >
                                                        {entry.score}
                                                    </span>
                                                </td>
                                                <td className="text-[12px] font-medium" style={{ color: getSeasonColor(entry.score), padding: "10px 12px" }}>
                                                    {entry.label}
                                                </td>
                                                <td className="text-[12px] text-right hidden sm:table-cell" style={{ color: "var(--text-secondary)", padding: "10px 12px" }}>
                                                    {entry.altcoin_market_cap ? `$${(entry.altcoin_market_cap / 1e12).toFixed(2)}T` : "—"}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            ) : loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div className="news-card news-card-static" style={{ padding: 40, textAlign: "center" }}>
                        <div className="shimmer-bg" style={{ width: 200, height: 120, margin: "0 auto", borderRadius: 12 }} />
                    </div>
                    <div className="news-card news-card-static" style={{ padding: 40, textAlign: "center" }}>
                        <div className="shimmer-bg" style={{ width: 200, height: 80, margin: "0 auto", borderRadius: 12 }} />
                    </div>
                </div>
            ) : altcoins.length === 0 ? (
                <div
                    className="py-20 text-center rounded-2xl"
                    style={{ border: "1px dashed var(--border-default)", background: "var(--bg-surface)" }}
                >
                    <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>No Altcoin Season data yet</p>
                    <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Run altcoin-season.js to scrape the first data</p>
                </div>
            ) : (
                <>
                    {/* ========== SIDE BY SIDE: Index + Historical ========== */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginBottom: 20 }}>
                        {/* LEFT: Altcoin Season Index Card */}
                        <div className="news-card news-card-static" style={{ padding: "16px 16px 16px", display: "flex", flexDirection: "column" }}>
                            {/* Top row: Title + Summary button */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                                <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Altcoin Season</span>
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

                            {/* Score text */}
                            <div style={{ textAlign: "center", marginBottom: 16, marginTop: 8 }}>
                                <div style={{
                                    fontSize: 42, fontWeight: 800, lineHeight: 1,
                                    color: getSeasonColor(score),
                                    marginBottom: 4,
                                }}>
                                    {score}<span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-tertiary)" }}>/100</span>
                                </div>
                            </div>

                            {/* Season Bar (Bitcoin ↔ Altcoin) */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#f97316", display: "flex", alignItems: "center", gap: 4 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f97316", display: "inline-block" }} />
                                        Bitcoin Season
                                    </span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", display: "flex", alignItems: "center", gap: 4 }}>
                                        Altcoin Season
                                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                                    </span>
                                </div>
                                <div style={{
                                    position: "relative",
                                    height: 10,
                                    borderRadius: 5,
                                    background: "linear-gradient(to right, #f97316 0%, #eab308 33%, #22c55e 66%, #16a34a 100%)",
                                    overflow: "visible",
                                }}>
                                    <div style={{
                                        position: "absolute",
                                        left: `${score}%`,
                                        top: "50%",
                                        transform: "translate(-50%, -50%)",
                                        width: 18,
                                        height: 18,
                                        borderRadius: "50%",
                                        background: "#fff",
                                        border: `3px solid ${getSeasonColor(score)}`,
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                        transition: "left 0.5s ease",
                                    }} />
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>0</span>
                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>25</span>
                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>50</span>
                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>75</span>
                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>100</span>
                                </div>
                            </div>

                            {/* Spacer */}
                            <div style={{ flex: 1 }} />

                            {/* Bottom row: Logo + Last Updated */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                                <a href="https://browser-news.vercel.app/" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                                    <img src="/browser-news.png" alt="Browser News" style={{ width: 18, height: 18, borderRadius: 3 }} />
                                    <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                                        browser-news.vercel.app
                                    </span>
                                </a>
                                <span className="text-[10px] sm:text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                                    Last Updated: {altcoins[0]?.scraped_at ? new Date(altcoins[0].scraped_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                                </span>
                            </div>
                        </div>

                        {/* RIGHT: Historical Values + Yearly High/Low */}
                        <div className="news-card news-card-static" style={{ padding: "16px 16px 16px" }}>
                            {/* Historical Values */}
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>
                                    Historical Values
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {(() => {
                                        const now = Date.now();
                                        const findClosest = (targetMs: number) => {
                                            let best: AltcoinSeasonScore | null = null;
                                            let bestDiff = Infinity;
                                            for (const s of scoreHistory) {
                                                const diff = Math.abs(new Date(s.created_at).getTime() - (now - targetMs));
                                                if (diff < bestDiff) { bestDiff = diff; best = s; }
                                            }
                                            return best;
                                        };
                                        const items = [
                                            { period: "Yesterday", data: findClosest(86400000) },
                                            { period: "Last Week", data: findClosest(7 * 86400000) },
                                            { period: "Last Month", data: findClosest(30 * 86400000) },
                                        ];
                                        return items.map((item) => (
                                            <div key={item.period} style={{
                                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                                padding: "8px 12px", borderRadius: 8,
                                                background: "rgba(255,255,255,0.03)",
                                                border: "1px solid var(--border-subtle)",
                                            }}>
                                                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
                                                    {item.period}
                                                </span>
                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <span style={{
                                                        fontSize: 12, fontWeight: 700, color: item.data ? getSeasonColor(item.data.score) : "var(--text-tertiary)",
                                                    }}>
                                                        {item.data?.score ?? "—"}
                                                    </span>
                                                    <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                                                        {item.data?.label ?? "—"}
                                                    </span>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* Yearly High & Low row */}
                            {(() => {
                                const high = scoreHistory.reduce<AltcoinSeasonScore | null>((best, s) => !best || s.score > best.score ? s : best, null);
                                const low = scoreHistory.reduce<AltcoinSeasonScore | null>((best, s) => !best || s.score < best.score ? s : best, null);
                                return (
                                    <div style={{ display: "flex", gap: 8, marginTop: 0 }}>
                                        <div style={{
                                            flex: 1, padding: "8px 12px", borderRadius: 8,
                                            background: "rgba(255,255,255,0.03)",
                                            border: "1px solid var(--border-subtle)",
                                            textAlign: "center",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>All-Time High</span>
                                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{high ? new Date(high.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: high ? getSeasonColor(high.score) : "var(--text-tertiary)", fontWeight: 600 }}>{high ? `${high.label} — ${high.score}` : "—"}</div>
                                        </div>
                                        <div style={{
                                            flex: 1, padding: "8px 12px", borderRadius: 8,
                                            background: "rgba(255,255,255,0.03)",
                                            border: "1px solid var(--border-subtle)",
                                            textAlign: "center",
                                        }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>All-Time Low</span>
                                                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{low ? new Date(low.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
                                            </div>
                                            <div style={{ fontSize: 11, color: low ? getSeasonColor(low.score) : "var(--text-tertiary)", fontWeight: 600 }}>{low ? `${low.label} — ${low.score}` : "—"}</div>
                                        </div>
                                    </div>
                                );
                            })()}

                        </div>
                    </div>

                    {/* ========== CHART CARD: Altcoin Season Score + Market Cap ========== */}
                    <div className="news-card news-card-static" style={{ padding: 16, marginBottom: 20 }}>
                        <AltcoinSeasonScoreChart scoreHistory={scoreHistory} />
                    </div>

                    {/* ========== COINS LIST ========== */}
                    <div style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                            Top 100 Coins Performance Over 90 Days
                        </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {altcoins.map((coin) => {
                            const pctNum = Number(coin.performance);
                            const isPositive = coin.direction === "outperform";
                            const slug = (coin.name || coin.ticker).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                            const cgSlug = coin.coingecko_id || slug;
                            return (
                                <div
                                    key={coin.id}
                                    className="news-card news-card-static"
                                    style={{
                                        padding: "8px 12px",
                                        display: "flex",
                                        flexDirection: "row",
                                        alignItems: "center",
                                        gap: 8,
                                        height: "auto",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    {/* Rank */}
                                    <span style={{
                                        width: 24, fontSize: 11, fontWeight: 600,
                                        color: "var(--text-tertiary)", textAlign: "center", flexShrink: 0,
                                    }}>
                                        #{coin.rank}
                                    </span>

                                    {/* Logo + Symbol + Name */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            width: 24, height: 24, borderRadius: "50%",
                                            background: "rgba(255,255,255,0.06)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            overflow: "hidden", flexShrink: 0,
                                        }}>
                                            {coin.logo_url ? (
                                                <img
                                                    src={coin.logo_url}
                                                    alt={coin.ticker}
                                                    width={24}
                                                    height={24}
                                                    style={{ borderRadius: "50%" }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-tertiary)" }}>
                                                    {coin.ticker.slice(0, 2)}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.2 }}>
                                                {coin.ticker}
                                            </div>
                                            {coin.name && (
                                                <div style={{ fontSize: 10, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                                                    {coin.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Price + 24h */}
                                    <div style={{ textAlign: "right", minWidth: 75, flexShrink: 0, marginLeft: 4 }}>
                                        {coin.price != null ? (
                                            <>
                                                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
                                                    ${coin.price < 1 ? coin.price.toPrecision(4) : coin.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </div>
                                                {coin.price_change_24h != null && (
                                                    <div style={{
                                                        fontSize: 9, fontWeight: 500, fontVariantNumeric: "tabular-nums", lineHeight: 1.2,
                                                        color: coin.price_change_24h >= 0 ? "#22c55e" : "#ef4444",
                                                    }}>
                                                        {coin.price_change_24h >= 0 ? "+" : ""}{coin.price_change_24h.toFixed(2)}% 24h
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>—</span>
                                        )}
                                    </div>

                                    {/* Platform Links */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0, marginLeft: 4, marginRight: 4 }}>
                                        <a
                                            href={`https://coinmarketcap.com/currencies/${slug}/`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`${coin.ticker} on CoinMarketCap`}
                                            style={{ display: "flex", opacity: 0.85, transition: "opacity 0.2s" }}
                                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.55")}
                                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
                                        >
                                            <img src="/coinmarketcap.jpg" alt="CMC" width={16} height={16} style={{ borderRadius: 3 }} />
                                        </a>
                                        <a
                                            href={`https://cryptorank.io/price/${slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`${coin.ticker} on CryptoRank`}
                                            style={{ display: "flex", opacity: 0.85, transition: "opacity 0.2s" }}
                                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.55")}
                                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
                                        >
                                            <img src="/cryptorank.jpg" alt="CR" width={16} height={16} style={{ borderRadius: 3 }} />
                                        </a>
                                        <a
                                            href={`https://www.coingecko.com/id/coins/${cgSlug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`${coin.ticker} on CoinGecko`}
                                            style={{ display: "flex", opacity: 0.85, transition: "opacity 0.2s" }}
                                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.55")}
                                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.85")}
                                        >
                                            <img src="/coingecko.svg" alt="CG" width={16} height={16} style={{ borderRadius: 3 }} />
                                        </a>
                                    </div>

                                    {/* 90d Performance — removed "90d" label */}
                                    <div style={{
                                        fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                                        color: isPositive ? "#22c55e" : "#ef4444",
                                        display: "flex", alignItems: "center", gap: 3, minWidth: 70, justifyContent: "flex-end", flexShrink: 0,
                                    }}>
                                        <span style={{ fontSize: 8 }}>{isPositive ? "▲" : "▼"}</span>
                                        {isPositive ? "+" : "-"}{Math.abs(pctNum).toFixed(2)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </TabNavigation>
    );
}
