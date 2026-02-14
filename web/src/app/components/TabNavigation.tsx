"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState, useEffect, useRef, useCallback } from "react";

type TabId = "fear-greed" | "altcoin-season" | "crypto-gems";

const TABS: { id: TabId; label: string; href: string; soon?: boolean }[] = [
    { id: "fear-greed", label: "Fear & Greed", href: "/fear-greed" },
    { id: "altcoin-season", label: "Altcoin Season", href: "/altcoin-season" },
    { id: "crypto-gems", label: "Crypto Gems", href: "/crypto-gems", soon: true },
];

const NAV_LINKS = [
    { label: "Analytics", href: "/fear-greed", matchPaths: ["/fear-greed", "/altcoin-season", "/crypto-gems"] },
    { label: "Docs", href: "/docs", matchPaths: ["/docs"] },
];

// =====================
// Settings Modal (Gemini API Key)
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

    useEffect(() => { setInputVal(apiKey); }, [apiKey, open]);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    if (!open) return null;

    const handleSave = () => {
        const trimmed = inputVal.trim();
        setApiKey(trimmed);
        if (trimmed) localStorage.setItem("gemini_api_key", trimmed);
        else localStorage.removeItem("gemini_api_key");
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
            <div className="modal-content" ref={modalRef} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
                    <h3 className="text-[16px] font-semibold" style={{ color: "var(--text-primary)" }}>Settings</h3>
                    <button onClick={onClose} className="modal-close-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <label className="text-[12px] font-semibold" style={{ color: "var(--text-secondary)", letterSpacing: "0.05em", textTransform: "uppercase" }}>Gemini API Key</label>
                <input type="password" value={inputVal} onChange={(e) => setInputVal(e.target.value)} placeholder="AIzaSy..." className="settings-input" />
                <p className="text-[11px]" style={{ color: "var(--text-tertiary)", marginTop: 8, lineHeight: 1.5 }}>
                    Get your free API key from{" "}
                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-hover)", textDecoration: "underline" }}>Google AI Studio</a>.
                    Your key is stored locally and never sent to our server.
                </p>
                <div className="flex items-center gap-2" style={{ marginTop: 20 }}>
                    <button onClick={handleSave} className="settings-save-btn">Save</button>
                    {apiKey && <button onClick={handleRemove} className="settings-remove-btn">Remove</button>}
                </div>
            </div>
        </div>
    );
}

interface TabNavigationProps {
    children: ReactNode;
    onRefresh?: () => void;
}

export default function TabNavigation({ children }: TabNavigationProps) {
    const pathname = usePathname();
    const [menuOpen, setMenuOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [apiKey, setApiKey] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem("gemini_api_key");
        if (saved) setApiKey(saved);
    }, []);

    // Close mobile menu on route change
    useEffect(() => { setMenuOpen(false); }, [pathname]);

    const activeTab = TABS.find(t => pathname.startsWith(t.href))?.id ?? "fear-greed";

    const isNavActive = useCallback((link: typeof NAV_LINKS[0]) => {
        return link.matchPaths.some(p => pathname.startsWith(p));
    }, [pathname]);

    return (
        <div className="min-h-screen">
            <header
                className="sticky top-0 z-50 backdrop-blur-xl"
                style={{ background: "rgba(10, 10, 11, 0.8)", borderBottom: "1px solid var(--border-subtle)" }}
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

            {/* Tab Navigation (sub-tabs for Analytics) */}
            {NAV_LINKS[0].matchPaths.some(p => pathname.startsWith(p)) && (
                <div className="container-width" style={{ paddingTop: 20 }}>
                    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)" }}>
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.id;
                            const activeColor = tab.id === "fear-greed" ? "#f59e0b"
                                : tab.id === "altcoin-season" ? "#22c55e"
                                    : "#a78bfa";
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.href}
                                    style={{
                                        padding: "10px 20px",
                                        border: "none",
                                        cursor: "pointer",
                                        fontSize: 13,
                                        fontWeight: isActive ? 600 : 500,
                                        transition: "all 0.2s ease",
                                        textDecoration: "none",
                                        textAlign: "center",
                                        background: "transparent",
                                        color: isActive ? activeColor : "var(--text-tertiary)",
                                        borderBottom: isActive ? `2px solid ${activeColor}` : "2px solid transparent",
                                        marginBottom: -1,
                                    }}
                                >
                                    {tab.label}
                                    {tab.soon && (
                                        <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.5, fontWeight: 400 }}>Soon</span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            <main className="container-width" style={{ paddingTop: 24, paddingBottom: 40 }}>
                {children}
            </main>

            {/* Footer */}
            <footer className="py-6 mt-16" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                <div className="container-width flex flex-col items-center gap-2" style={{ padding: "16px 20px" }}>
                    <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        Browser News · Powered by Browser.cash
                    </span>
                </div>
            </footer>

            {/* Settings Modal */}
            <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} apiKey={apiKey} setApiKey={setApiKey} />
        </div>
    );
}
