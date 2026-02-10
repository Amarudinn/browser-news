"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, type NewsItem } from "@/lib/supabase";

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "indonesia", label: "Indonesia" },
  { key: "global", label: "Global" },
  { key: "crypto", label: "Crypto" },
  { key: "sports", label: "Sports" },
];



function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const badgeClass = `badge badge-${item.category}`;

  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="news-card animate-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Badge + Time — fixed at top */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "12px 16px 0 16px" }}
      >
        <span className={badgeClass}>
          {item.category}
        </span>
        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--text-tertiary)" }}
        >
          {timeAgo(item.created_at)}
        </span>
      </div>

      {/* Content area */}
      <div className="flex flex-col flex-1" style={{ padding: "16px 28px 16px 28px" }}>
        {/* Title */}
        <h3
          className="text-[14.5px] font-medium leading-[1.55] line-clamp-3 transition-colors duration-200"
          style={{ color: "var(--text-primary)" }}
        >
          {item.title}
        </h3>
      </div>

      {/* Source — fixed at bottom */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <span
          className="text-[12px] font-medium truncate max-w-[180px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {item.site_name}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--text-tertiary)", transition: "all 0.2s" }}
        >
          <path d="M7 17L17 7" />
          <path d="M7 7h10v10" />
        </svg>
      </div>
    </a>
  );
}

function ShimmerCard() {
  return (
    <div className="news-card" style={{ padding: 28 }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="shimmer-bg" style={{ width: 72, height: 22 }}></div>
      </div>
      <div className="shimmer-bg mb-2" style={{ height: 16, width: "100%" }}></div>
      <div className="shimmer-bg mb-2" style={{ height: 16, width: "85%" }}></div>
      <div className="shimmer-bg" style={{ height: 16, width: "55%" }}></div>
    </div>
  );
}

function CategoryDropdown({ category, setCategory }: { category: string; setCategory: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentLabel = CATEGORIES.find(c => c.key === category)?.label || "All";

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="mobile-only" style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="custom-dropdown-trigger"
      >
        <span>{currentLabel}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="custom-dropdown-menu">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => { setCategory(cat.key); setOpen(false); }}
              className={`custom-dropdown-item ${category === cat.key ? "active" : ""}`}
            >
              {cat.label}
              {category === cat.key && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(18);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("news")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (!error && data) {
      setNews(data);
    }

    const { count } = await supabase
      .from("news")
      .select("*", { count: "exact", head: true });
    setTotalCount(count || 0);

    setLoading(false);
    setVisibleCount(18);
  }, [category]);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { });
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* ─── Header ─── */}
      {/* Header with margin-bottom */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: "rgba(10, 10, 11, 0.8)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="container-width h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/browser-news.png"
              alt="Browser News"
              className="w-7 h-7 rounded-lg"
              style={{ objectFit: "contain" }}
            />
            <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Browser News
            </span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span
              className="hidden sm:inline text-[12px] font-medium"
              style={{ color: "var(--text-tertiary)" }}
            >
              {totalCount.toLocaleString()} articles
            </span>

            {/* Refresh */}
            <button
              onClick={fetchNews}
              className="refresh-btn"
              title="Refresh"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="container-width" style={{ paddingTop: 32, paddingBottom: 20 }}>
        {/* Title + Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5" style={{ marginBottom: 40 }}>
          <div>
            <h2 className="text-xl font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
              Latest Updates
            </h2>
            <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Curated from 20+ trusted sources
            </p>
          </div>

          {/* Category Dropdown — mobile */}
          <CategoryDropdown category={category} setCategory={setCategory} />

          {/* Category Tabs — desktop */}
          <div
            className="desktop-only items-center gap-1 p-1 rounded-xl"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`tab-btn ${category === cat.key ? "active" : ""}`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── News Grid ─── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 9 }).map((_, i) => <ShimmerCard key={i} />)
            : news.slice(0, visibleCount).map((item, i) => (
              <NewsCard key={item.id} item={item} index={i} />
            ))}
        </div>

        {/* Load More */}
        {!loading && news.length > visibleCount && (
          <div className="flex justify-center" style={{ marginTop: 40 }}>
            <button
              onClick={() => setVisibleCount((prev) => prev + 18)}
              className="load-more-btn"
            >
              Load More
              <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                ({news.length - visibleCount} remaining)
              </span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && news.length === 0 && (
          <div
            className="py-20 text-center rounded-2xl mt-4"
            style={{
              border: "1px dashed var(--border-default)",
              background: "var(--bg-surface)",
            }}
          >
            <div className="text-3xl mb-3">📭</div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              No articles in this category yet
            </p>
            <p className="text-xs" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              Run the scraper to populate data
            </p>
          </div>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer
        className="py-6 mt-16"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div className="container-width flex flex-col items-center gap-2" style={{ padding: "16px 20px" }}>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            Browser News · Powered by Browser.cash
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
            auto-refresh 5m
          </span>
        </div>
      </footer>
    </div>
  );
}
