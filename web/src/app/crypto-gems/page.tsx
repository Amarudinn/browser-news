"use client";

import TabNavigation from "@/app/components/TabNavigation";

export default function CryptoGemsPage() {
    return (
        <TabNavigation>
            <div
                className="py-20 text-center rounded-2xl"
                style={{
                    border: "1px dashed var(--border-default)",
                    background: "var(--bg-surface)",
                    marginTop: 8,
                }}
            >
                <div style={{ fontSize: 48, marginBottom: 12 }}>💎</div>
                <p className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                    Crypto Gems
                </p>
                <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                    Coming Soon
                </p>
                <p className="text-xs" style={{ color: "var(--text-tertiary)", maxWidth: 360, margin: "0 auto" }}>
                    Discover hidden gem tokens with high potential — AI-curated picks based on market signals and on-chain data.
                </p>
            </div>
        </TabNavigation>
    );
}
