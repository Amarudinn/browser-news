"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, type NewsItem } from "@/lib/supabase";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Analytics", href: "/fear-greed", matchPaths: ["/fear-greed", "/altcoin-season", "/crypto-gems"] },
  { label: "Docs", href: "/docs", matchPaths: ["/docs"] },
];

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "indonesia", label: "Indonesia" },
  { key: "global", label: "Global" },
  { key: "crypto", label: "Crypto" },
  { key: "sports", label: "Sports" },
];

// =====================
// Gemini API Helper
// =====================
async function summarizeWithGemini(apiKey: string, url: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Read and summarize the news article from the following URL in 3-5 key points. Always respond in English regardless of the article's language. Format the summary with clear and concise bullet points.\n\nURL: ${url}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Gemini API error");
  }

  const data = await response.json();
  return (
    data.candidates?.[0]?.content?.parts?.[0]?.text || "No summary generated."
  );
}

// =====================
// Utility
// =====================
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

// =====================
// Settings Modal
// =====================
function SettingsModal({
  open,
  onClose,
  apiKey,
  setApiKey,
}: {
  open: boolean;
  onClose: () => void;
  apiKey: string;
  setApiKey: (k: string) => void;
}) {
  const [inputVal, setInputVal] = useState(apiKey);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputVal(apiKey);
  }, [apiKey, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = inputVal.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem("gemini_api_key", trimmed);
    } else {
      localStorage.removeItem("gemini_api_key");
    }
    onClose();
  };

  const handleRemove = () => {
    setApiKey("");
    setInputVal("");
    localStorage.removeItem("gemini_api_key");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <h3 className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>
            ⚙️ Settings
          </h3>
          <button onClick={onClose} className="modal-close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <label
          className="text-[12px] font-semibold"
          style={{ color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}
        >
          Gemini API Key
        </label>
        <input
          type="password"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="AIzaSy..."
          className="settings-input"
        />
        <p className="text-[11px]" style={{ color: "var(--text-tertiary)", marginTop: 8, lineHeight: 1.5 }}>
          Get your free API key from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent-hover)", textDecoration: "underline" }}
          >
            Google AI Studio
          </a>
          . Your key is stored locally in your browser and never sent to our server.
        </p>

        <div className="flex items-center gap-2" style={{ marginTop: 20 }}>
          <button onClick={handleSave} className="settings-save-btn">
            Save
          </button>
          {apiKey && (
            <button onClick={handleRemove} className="settings-remove-btn">
              Remove Key
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================
// Summary Modal
// =====================
function SummaryModal({
  open,
  onClose,
  item,
  apiKey,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  item: NewsItem | null;
  apiKey: string;
  onOpenSettings: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !item) return;
    setSummary("");
    setError("");

    if (!apiKey) return;

    let cancelled = false;
    const doSummarize = async () => {
      setLoading(true);
      try {
        const result = await summarizeWithGemini(apiKey, item.link);
        if (!cancelled) setSummary(result);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to summarize");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doSummarize();
    return () => { cancelled = true; };
  }, [open, item, apiKey]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !item) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content summary-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>✨</span>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              AI Summary
            </h3>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Article info */}
        <div style={{ marginBottom: 16, padding: "12px 14px", background: "var(--bg-base)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
          <p className="text-[13px] font-medium line-clamp-2" style={{ color: "var(--text-primary)", marginBottom: 4 }}>
            {item.title}
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {item.site_name}
          </p>
        </div>

        {/* Content */}
        {!apiKey ? (
          <div className="text-center" style={{ padding: "24px 0" }}>
            <p className="text-[13px]" style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
              Set your Gemini API key to use AI Summary
            </p>
            <button
              onClick={() => { onClose(); onOpenSettings(); }}
              className="settings-save-btn"
            >
              Open Settings
            </button>
          </div>
        ) : loading ? (
          <div style={{ padding: "20px 0" }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
              <div className="summary-spinner" />
              <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                Gemini is reading the article...
              </span>
            </div>
            <div className="shimmer-bg" style={{ height: 14, width: "100%", marginBottom: 8 }} />
            <div className="shimmer-bg" style={{ height: 14, width: "90%", marginBottom: 8 }} />
            <div className="shimmer-bg" style={{ height: 14, width: "75%", marginBottom: 8 }} />
            <div className="shimmer-bg" style={{ height: 14, width: "60%" }} />
          </div>
        ) : error ? (
          <div style={{ padding: "16px 0" }}>
            <div style={{ padding: "12px 14px", background: "rgba(239, 68, 68, 0.08)", borderRadius: 10, border: "1px solid rgba(239, 68, 68, 0.15)" }}>
              <p className="text-[13px]" style={{ color: "#f87171" }}>
                ⚠️ {error}
              </p>
            </div>
          </div>
        ) : (
          <div className="summary-text" style={{ padding: "4px 0" }}>
            {summary.split("\n").map((line, i) => (
              <p key={i} className="text-[13px] leading-[1.7]" style={{ color: "var(--text-secondary)", marginBottom: line.trim() ? 6 : 2 }}>
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Footer link */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium"
            style={{ color: "var(--accent-hover)", textDecoration: "none" }}
          >
            Read full article →
          </a>
        </div>
      </div>
    </div>
  );
}

// =====================
// News Card
// =====================
function NewsCard({
  item,
  index,
  onSummarize,
}: {
  item: NewsItem;
  index: number;
  onSummarize: (item: NewsItem) => void;
}) {
  const badgeClass = `badge badge-${item.category}`;

  return (
    <div
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

      {/* Content area — clickable to source */}
      <a
        href={item.link}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col flex-1 news-card-link"
        style={{ padding: "16px 28px 16px 28px", textDecoration: "none" }}
      >
        <h3
          className="text-[14.5px] font-medium leading-[1.55] line-clamp-3 transition-colors duration-200"
          style={{ color: "var(--text-primary)" }}
        >
          {item.title}
        </h3>
      </a>

      {/* Footer — Source + AI Summary button */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <span
          className="text-[12px] font-medium truncate max-w-[140px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {item.site_name}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSummarize(item);
            }}
            className="ai-summary-btn"
            title="AI Summary"
          >
            <span style={{ fontSize: 12 }}>✨</span>
            <span>Summary</span>
          </button>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="card-external-link"
            title="Open article"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </a>
        </div>
      </div>
    </div>
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

// =====================
// Main Page
// =====================
const PAGE_SIZE = 18;

export default function Home() {
  const pathname = usePathname();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [categoryCount, setCategoryCount] = useState(0);

  // AI Summary state
  const [apiKey, setApiKey] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [summaryItem, setSummaryItem] = useState<NewsItem | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isNavActive = useCallback((link: typeof NAV_LINKS[0]) => {
    return link.matchPaths.some(p => pathname.startsWith(p));
  }, [pathname]);

  const newsRef = useRef<NewsItem[]>([]);

  // Load API key from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("gemini_api_key");
    if (saved) setApiKey(saved);
  }, []);

  const fetchPage = useCallback(async (from: number, cat: string) => {
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("news")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (cat !== "all") {
      query = query.eq("category", cat);
    }

    return query;
  }, []);

  // Initial fetch & category change
  useEffect(() => {
    let cancelled = false;
    const doFetch = async () => {
      setLoading(true);
      const { data, error, count } = await fetchPage(0, category);
      if (!cancelled && !error && data) {
        setNews(data);
        newsRef.current = data;
        setCategoryCount(count || 0);
      }

      const { count: total } = await supabase
        .from("news")
        .select("*", { count: "exact", head: true });
      if (!cancelled) {
        setTotalCount(total || 0);
        setLoading(false);
      }
    };
    doFetch();
    return () => { cancelled = true; };
  }, [category, fetchPage]);

  const loadMore = async () => {
    setLoadingMore(true);
    const from = newsRef.current.length;
    const { data, error, count } = await fetchPage(from, category);
    if (!error && data) {
      const updated = [...newsRef.current, ...data];
      setNews(updated);
      newsRef.current = updated;
      setCategoryCount(count || 0);
    }
    setLoadingMore(false);
  };

  const refresh = async () => {
    setLoading(true);
    const { data, error, count } = await fetchPage(0, category);
    if (!error && data) {
      setNews(data);
      newsRef.current = data;
      setCategoryCount(count || 0);
    }
    const { count: total } = await supabase
      .from("news")
      .select("*", { count: "exact", head: true });
    setTotalCount(total || 0);
    setLoading(false);
  };

  const handleSummarize = (item: NewsItem) => {
    setSummaryItem(item);
    setSummaryOpen(true);
  };

  // Register service worker for PWA
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => { });
    }
  }, []);

  return (
    <div className="min-h-screen">
      {/* ─── Modals ─── */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
      />
      <SummaryModal
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        item={summaryItem}
        apiKey={apiKey}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* ─── Header ─── */}
      <header
        className="sticky top-0 z-50 backdrop-blur-xl"
        style={{
          background: "rgba(10, 10, 11, 0.8)",
          borderBottom: "1px solid var(--border-subtle)",
          position: "relative",
        }}
      >
        <div className="container-width h-14 flex items-center justify-between">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3" style={{ textDecoration: "none" }}>
              <img src="/browser-news.png" alt="Browser News" className="w-7 h-7 rounded-lg" style={{ objectFit: "contain" }} />
              <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Browser News</span>
            </Link>

            {/* Desktop Nav Links */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="desktop-nav-link"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: isNavActive(link) ? 600 : 500,
                    color: isNavActive(link) ? "var(--text-primary)" : "var(--text-tertiary)",
                    background: isNavActive(link) ? "rgba(255,255,255,0.06)" : "transparent",
                    textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: Login + Gear + Hamburger */}
          <div className="flex items-center gap-2">
            {/* Login Button */}
            <button
              style={{
                padding: "6px 16px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid var(--border-subtle)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              Login
            </button>

            {/* Gear Icon */}
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              style={{
                width: 34, height: 34,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8, border: "none",
                background: "transparent",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                transition: "color 0.2s",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {/* Hamburger (mobile only) */}
            <button
              className="md:hidden flex items-center justify-center"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                width: 34, height: 34,
                borderRadius: 8, border: "none",
                background: "transparent",
                color: "var(--text-tertiary)",
                cursor: "pointer",
              }}
            >
              {menuOpen ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Full-screen Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden" style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
            background: "#0a0a0b",
            display: "flex", flexDirection: "column",
          }}>
            {/* Top bar with close button */}
            <div style={{
              height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0 20px", borderBottom: "1px solid var(--border-subtle)",
            }}>
              <div className="flex items-center gap-3">
                <img src="/browser-news.png" alt="Browser News" className="w-7 h-7 rounded-lg" style={{ objectFit: "contain" }} />
                <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Browser News</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                style={{
                  width: 34, height: 34,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 8, border: "none",
                  background: "transparent",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Centered menu items */}
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 12,
            }}>
              {NAV_LINKS.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "14px 40px",
                    borderRadius: 12,
                    fontSize: 20,
                    fontWeight: isNavActive(link) ? 700 : 500,
                    color: isNavActive(link) ? "var(--text-primary)" : "var(--text-tertiary)",
                    background: isNavActive(link) ? "rgba(255,255,255,0.06)" : "transparent",
                    border: isNavActive(link) ? "1px solid var(--border-subtle)" : "1px solid transparent",
                    textDecoration: "none",
                    transition: "all 0.2s",
                    letterSpacing: "0.01em",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
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
              Curated from 28 trusted sources
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
            : news.map((item, i) => (
              <NewsCard key={item.id} item={item} index={i} onSummarize={handleSummarize} />
            ))}
        </div>

        {/* Load More */}
        {!loading && news.length < categoryCount && (
          <div className="flex justify-center" style={{ marginTop: 40 }}>
            <button
              onClick={loadMore}
              className="load-more-btn"
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load More"}
              <span style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                ({categoryCount - news.length} remaining)
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
        </div>
      </footer>
    </div>
  );
}
