// ==========================================
// Crypto Fear & Greed Index v2 (AI-Powered)
// ==========================================
// 5 Factors: Volatility, Momentum/Volume, Social Media, BTC Dominance, Google Trends
// + News Headlines sebagai konteks tambahan
//
// Cara jalan: node task-script/fear-greed.js
// Cron mode:  node task-script/fear-greed.js --cron

import 'dotenv/config';
import { chromium } from 'playwright';
import BrowsercashSDK from '@browsercash/sdk';
import inquirer from 'inquirer';
import { createClient } from '@supabase/supabase-js';
import { membit } from '@bandprotocol/membit';

// =====================
// SUPABASE
// =====================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// =====================
// KONFIGURASI
// =====================
async function askConfig() {
    if (process.argv.includes('--cron')) {
        console.log('   [i] Running in CRON mode (automated)');
        return {
            type: 'hosted',
            country: undefined,
            nodeId: 'stairs-brush-artefact',
            windowSize: '1920x1080'
        };
    }

    console.log('\n--- Configure Browser Session ---\n');
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'type',
            message: 'Select Session Type:',
            choices: ['hosted', 'consumer_distributed'],
            default: 'hosted'
        },
        {
            type: 'input',
            name: 'country',
            message: 'Select Country (e.g. US, Any):',
            default: 'Any',
            filter: (input) => input.toLowerCase() === 'any' ? undefined : input
        },
        {
            type: 'input',
            name: 'nodeId',
            message: 'Specific Node ID (Optional):',
            default: ''
        },
        {
            type: 'input',
            name: 'windowSize',
            message: 'Window Size:',
            default: '1920x1080'
        }
    ]);

    return {
        type: answers.type,
        country: answers.country,
        nodeId: answers.nodeId || undefined,
        windowSize: answers.windowSize
    };
}

let SESSION_CONFIG;

// =====================
// 5 SITUS CRYPTO (untuk news headlines)
// =====================
const CRYPTO_SITES = [
    {
        name: 'CoinDesk', category: 'crypto',
        url: 'https://www.coindesk.com/',
        waitFor: 'a[href*="/202"]',
        type: 'links',
        linkSelector: 'a[href*="/202"]',
        baseUrl: 'https://www.coindesk.com',
        minLen: 25,
        excludes: ['Subscribe', 'Sign Up', 'Newsletter']
    },
    {
        name: 'CoinTelegraph', category: 'crypto',
        url: 'https://cointelegraph.com/',
        waitFor: 'a[href*="/news/"]',
        type: 'links',
        linkSelector: 'a[href*="/news/"]',
        baseUrl: 'https://cointelegraph.com'
    },
    {
        name: 'Decrypt', category: 'crypto',
        url: 'https://decrypt.co/',
        waitFor: 'a[href^="/3"]',
        type: 'custom',
        scrape: function () {
            var results = [];
            var seen = {};
            var links = document.querySelectorAll('a[href^="/3"]');
            for (var i = 0; i < links.length; i++) {
                var a = links[i];
                var text = a.innerText.trim();
                var href = a.getAttribute('href');
                if (text.length > 20 && text.length < 200 && href.indexOf('/price/') === -1 && !seen[href]) {
                    seen[href] = true;
                    var parent = a.closest('article, li, div');
                    var timeEl = parent ? parent.querySelector('time[datetime]') : null;
                    var publishedAt = timeEl ? timeEl.getAttribute('datetime') : null;
                    results.push({ title: text, link: 'https://decrypt.co' + href, publishedAt: publishedAt });
                }
            }
            return results;
        }
    },
    {
        name: 'The Block', category: 'crypto',
        url: 'https://www.theblock.co/',
        waitFor: 'a[href*="/post/"]',
        type: 'links',
        linkSelector: 'a[href*="/post/"]',
        baseUrl: 'https://www.theblock.co'
    },
    {
        name: 'BeInCrypto', category: 'crypto',
        url: 'https://beincrypto.com/',
        waitFor: 'a',
        type: 'custom',
        scrape: function () {
            var results = [];
            var seen = {};
            var links = document.querySelectorAll('a[href*="beincrypto.com/"]');
            for (var i = 0; i < links.length; i++) {
                var a = links[i];
                var text = a.innerText.trim().replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ');
                var href = a.getAttribute('href');
                if (!href || !text) continue;
                if (href.indexOf('/author/') !== -1 || href.indexOf('/tag/') !== -1 || href.indexOf('/category/') !== -1) continue;
                if (text.length > 25 && text.length < 200 && !seen[href]) {
                    seen[href] = true;
                    var fullUrl = href.indexOf('http') === 0 ? href : 'https://beincrypto.com' + href;
                    var parent = a.closest('article, li, div');
                    var timeEl = parent ? parent.querySelector('time[datetime]') : null;
                    var publishedAt = timeEl ? timeEl.getAttribute('datetime') : null;
                    results.push({ title: text, link: fullUrl, publishedAt: publishedAt });
                }
            }
            return results;
        }
    }
];

// =====================
// Generic Link Scraper
// =====================
const genericLinkScraper = function (config) {
    var results = [];
    var seen = {};
    var minLen = config.minLen || 30;
    var maxLen = config.maxLen || 200;
    var excludes = config.excludes || [];
    var navWords = ['Schedule', 'Standings', 'Scores', 'Playoffs', 'Results', 'Watch Live', 'Sign In', 'Log In', 'Subscribe', 'Download', 'More News', 'See All', 'View All'];
    var links = document.querySelectorAll(config.linkSelector);
    for (var i = 0; i < links.length; i++) {
        var a = links[i];
        var text = a.innerText.trim();
        var href = a.getAttribute('href');
        if (!href || !text) continue;
        text = text.replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        if (text.length < minLen || text.length > maxLen) continue;
        var skip = false;
        for (var j = 0; j < excludes.length; j++) {
            if (text.indexOf(excludes[j]) !== -1) { skip = true; break; }
        }
        if (!skip) {
            for (var k = 0; k < navWords.length; k++) {
                if (text === navWords[k] || text.length < 35 && text.indexOf(navWords[k]) !== -1) { skip = true; break; }
            }
        }
        if (skip) continue;
        var fullUrl = href.indexOf('http') === 0 ? href : config.baseUrl + (href.charAt(0) === '/' ? '' : '/') + href;
        if (!seen[fullUrl]) {
            seen[fullUrl] = true;
            var parent = a.closest('article, li, div, section');
            var timeEl = parent ? parent.querySelector('time[datetime]') : null;
            if (!timeEl) {
                timeEl = parent ? parent.querySelector('[datetime], [data-date], [data-timestamp]') : null;
            }
            var publishedAt = timeEl ? (timeEl.getAttribute('datetime') || timeEl.getAttribute('data-date') || timeEl.getAttribute('data-timestamp')) : null;
            results.push({ title: text, link: fullUrl, publishedAt: publishedAt });
        }
    }
    return results;
};

// ===================================================================
//  FACTOR 1: VOLATILITY (25%) — CoinGecko 30-day price history
// ===================================================================
async function getVolatilityData() {
    console.log('   [>] Fetching 30-day BTC price history...');
    try {
        const res = await fetch(
            'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily'
        );
        const data = await res.json();
        const prices = data.prices.map(p => p[1]); // [timestamp, price] → price

        // Calculate volatility (standard deviation of daily returns)
        const dailyReturns = [];
        for (let i = 1; i < prices.length; i++) {
            dailyReturns.push((prices[i] - prices[i - 1]) / prices[i - 1] * 100);
        }

        const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyReturns.length;
        const volatility = Math.sqrt(variance);

        // Max drawdown
        let maxPrice = prices[0];
        let maxDrawdown = 0;
        for (const price of prices) {
            if (price > maxPrice) maxPrice = price;
            const drawdown = ((maxPrice - price) / maxPrice) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        // Current price and 30d change
        const currentPrice = prices[prices.length - 1];
        const price30dAgo = prices[0];
        const change30d = ((currentPrice - price30dAgo) / price30dAgo * 100);

        console.log(`   [v] Volatility: ${volatility.toFixed(2)}% | Max Drawdown: ${maxDrawdown.toFixed(2)}% | 30d Change: ${change30d >= 0 ? '+' : ''}${change30d.toFixed(2)}%`);

        return {
            volatility: parseFloat(volatility.toFixed(2)),
            maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
            change30d: parseFloat(change30d.toFixed(2)),
            priceHistory: prices.slice(-7).map(p => Math.round(p)) // last 7 days for reference
        };
    } catch (e) {
        console.error('   [!] Volatility Error:', e.message);
        return null;
    }
}

// ===================================================================
//  FACTOR 2: MOMENTUM & VOLUME (25%) — CoinGecko market data
// ===================================================================
async function getMomentumData() {
    console.log('   [>] Fetching BTC market data...');
    try {
        const res = await fetch(
            'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false'
        );
        const data = await res.json();

        const marketData = data.market_data;
        const result = {
            currentPrice: marketData.current_price.usd,
            change24h: parseFloat(marketData.price_change_percentage_24h?.toFixed(2)) || 0,
            change7d: parseFloat(marketData.price_change_percentage_7d?.toFixed(2)) || 0,
            change30d: parseFloat(marketData.price_change_percentage_30d?.toFixed(2)) || 0,
            volume24h: marketData.total_volume?.usd || 0,
            marketCap: marketData.market_cap?.usd || 0,
            ath: marketData.ath?.usd || 0,
            athChangePercentage: parseFloat(marketData.ath_change_percentage?.usd?.toFixed(2)) || 0
        };

        console.log(`   [v] BTC: $${result.currentPrice.toLocaleString()} | 24h: ${result.change24h >= 0 ? '+' : ''}${result.change24h}% | 7d: ${result.change7d >= 0 ? '+' : ''}${result.change7d}%`);
        console.log(`   [v] Volume 24h: $${(result.volume24h / 1e9).toFixed(2)}B | ATH Distance: ${result.athChangePercentage}%`);

        return result;
    } catch (e) {
        console.error('   [!] Momentum Error:', e.message);
        return null;
    }
}

// ===================================================================
//  FACTOR 3: SOCIAL MEDIA (17.5%) — Membit API (Twitter/X)
// ===================================================================
async function getSocialData() {
    const apiKey = process.env.MEMBIT_API_KEY;
    if (!apiKey) {
        console.log('   [!] MEMBIT_API_KEY tidak diset, skip social data');
        return null;
    }

    console.log('   [>] Fetching social media data from Membit...');
    try {
        const client = membit({ apiKey });

        // Use 'llm' format for text output — more reliable parsing
        console.log('   [>] Searching clusters...');
        let clusterText = '';
        try {
            const clusters = await client.cluster_search('bitcoin', {
                limit: 5,
                format: 'llm'
            });
            clusterText = typeof clusters === 'string' ? clusters : JSON.stringify(clusters);
        } catch (e) {
            console.log(`   [!] Cluster search error: ${e.message}`);
        }

        console.log('   [>] Searching posts...');
        let postText = '';
        try {
            const posts = await client.post_search('bitcoin BTC crypto', {
                limit: 10,
                format: 'llm'
            });
            postText = typeof posts === 'string' ? posts : JSON.stringify(posts);
        } catch (e) {
            console.log(`   [!] Post search error: ${e.message}`);
        }

        const hasData = clusterText.length > 10 || postText.length > 10;
        console.log(`   [v] Social: clusters=${clusterText.length} chars, posts=${postText.length} chars`);

        return {
            clusterText: clusterText.substring(0, 1500),
            postText: postText.substring(0, 2000),
            hasData: hasData
        };
    } catch (e) {
        console.error('   [!] Membit Error:', e.message);
        return null;
    }
}

// ===================================================================
//  FACTOR 4: BTC DOMINANCE (15%) — CoinGecko /global
// ===================================================================
async function getBtcDominance() {
    console.log('   [>] Fetching BTC dominance...');
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/global');
        const data = await res.json();

        const dominance = parseFloat(data.data.market_cap_percentage.btc.toFixed(2));
        const totalMarketCap = data.data.total_market_cap.usd;
        const totalVolume = data.data.total_volume.usd;
        const marketCapChange24h = parseFloat(data.data.market_cap_change_percentage_24h_usd.toFixed(2));

        console.log(`   [v] BTC Dominance: ${dominance}% | Total MCap: $${(totalMarketCap / 1e12).toFixed(2)}T | MCap 24h: ${marketCapChange24h >= 0 ? '+' : ''}${marketCapChange24h}%`);

        return {
            btcDominance: dominance,
            totalMarketCap: totalMarketCap,
            totalVolume: totalVolume,
            marketCapChange24h: marketCapChange24h
        };
    } catch (e) {
        console.error('   [!] Dominance Error:', e.message);
        return null;
    }
}

// ===================================================================
//  FACTOR 5: MARKET SENTIMENT REFERENCE (17.5%) — Alternative.me API
// ===================================================================
async function getAlternativeFnG() {
    console.log('   [>] Fetching Alternative.me Fear & Greed Index...');
    try {
        // Get current + last 7 days for trend context
        const res = await fetch('https://api.alternative.me/fng/?limit=7');
        const data = await res.json();

        if (!data.data || data.data.length === 0) {
            throw new Error('No data returned');
        }

        const current = data.data[0];
        const history = data.data.map(d => ({
            score: parseInt(d.value),
            label: d.value_classification,
            date: new Date(parseInt(d.timestamp) * 1000).toISOString().split('T')[0]
        }));

        console.log(`   [v] Alternative.me: ${current.value} (${current.value_classification}) | 7-day history: ${history.map(h => h.score).join(', ')}`);

        return {
            currentScore: parseInt(current.value),
            currentLabel: current.value_classification,
            history: history,
            available: true
        };
    } catch (e) {
        console.error('   [!] Alternative.me Error:', e.message);
        return null;
    }
}

// ===================================================================
//  SCRAPE 1 SITUS (news headlines)
// ===================================================================
async function scrapeSite(client, site, index, total) {
    let session, browser;
    console.log(`   [${index + 1}/${total}] ${site.name}...`);

    try {
        session = await client.browser.session.create(SESSION_CONFIG);
        browser = await chromium.connectOverCDP(session.cdpUrl);
        const contexts = browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();

        await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (site.waitFor) {
            try { await page.waitForSelector(site.waitFor, { timeout: 10000 }); } catch { }
        }
        await page.mouse.wheel(0, 300);
        await new Promise(r => setTimeout(r, 800));

        let allNews;
        if (site.type === 'custom') {
            allNews = await page.evaluate(site.scrape);
        } else {
            allNews = await page.evaluate(genericLinkScraper, {
                linkSelector: site.linkSelector,
                baseUrl: site.baseUrl,
                minLen: site.minLen,
                maxLen: site.maxLen,
                excludes: site.excludes
            });
        }

        // Sort by timestamp: newest first
        allNews.sort((a, b) => {
            if (a.publishedAt && b.publishedAt) return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
            if (a.publishedAt) return -1;
            if (b.publishedAt) return 1;
            return 0;
        });

        if (allNews.length > 0) {
            const selected = allNews[0];
            console.log(`       ✓ ${selected.title.substring(0, 55)}...`);
            return { site: site.name, title: selected.title, link: selected.link };
        }
        console.log('       ✗ Tidak menemukan berita');
        return null;
    } catch (e) {
        console.log(`       ✗ Error: ${e.message}`);
        return null;
    } finally {
        if (browser) await browser.close().catch(() => { });
        if (session) await client.browser.session.stop({ sessionId: session.sessionId }).catch(() => { });
    }
}

// ===================================================================
//  GEMINI AI — Multi-Factor Analysis
// ===================================================================
async function analyzeWithGemini(allFactors) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('   [!] GEMINI_API_KEY belum diset di .env');
        return null;
    }

    // Build comprehensive prompt
    let dataSection = '';

    // Factor 1: Volatility
    if (allFactors.volatility) {
        const v = allFactors.volatility;
        dataSection += `\n== FACTOR 1: VOLATILITY (Weight: 25%) ==
- 30-day Volatility (Std Dev of daily returns): ${v.volatility}%
- Max Drawdown in last 30 days: ${v.maxDrawdown}%
- 30-day Price Change: ${v.change30d >= 0 ? '+' : ''}${v.change30d}%
- Recent 7-day prices: ${v.priceHistory.map(p => '$' + p.toLocaleString()).join(' → ')}
NOTE: High volatility = Fear. Unusual spikes in volatility = Extreme Fear.`;
    }

    // Factor 2: Momentum & Volume
    if (allFactors.momentum) {
        const m = allFactors.momentum;
        dataSection += `\n\n== FACTOR 2: MOMENTUM & VOLUME (Weight: 25%) ==
- Current BTC Price: $${m.currentPrice.toLocaleString()}
- 24h Change: ${m.change24h >= 0 ? '+' : ''}${m.change24h}%
- 7d Change: ${m.change7d >= 0 ? '+' : ''}${m.change7d}%
- 30d Change: ${m.change30d >= 0 ? '+' : ''}${m.change30d}%
- 24h Volume: $${(m.volume24h / 1e9).toFixed(2)}B
- Market Cap: $${(m.marketCap / 1e12).toFixed(3)}T
- ATH (All-Time High): $${m.ath.toLocaleString()} (${m.athChangePercentage}% from ATH)
NOTE: High buying volume in positive market = Greed. Near ATH = Extreme Greed.`;
    }

    // Factor 3: Social Media
    if (allFactors.social && allFactors.social.hasData) {
        const s = allFactors.social;
        dataSection += `\n\n== FACTOR 3: SOCIAL MEDIA (Weight: 17.5%) ==
- Source: Twitter/X data via Membit API`;
        if (s.clusterText) {
            dataSection += `\n- Trending Clusters:\n${s.clusterText}`;
        }
        if (s.postText) {
            dataSection += `\n- Recent Posts:\n${s.postText}`;
        }
        dataSection += '\nNOTE: Analyze the sentiment of these posts. Positive/FOMO = Greed. Panic/negative = Fear.';
    } else {
        dataSection += '\n\n== FACTOR 3: SOCIAL MEDIA (Weight: 17.5%) ==\n(Data not available — skip this factor and redistribute weight)';
    }

    // Factor 4: BTC Dominance
    if (allFactors.dominance) {
        const d = allFactors.dominance;
        dataSection += `\n\n== FACTOR 4: BTC DOMINANCE (Weight: 15%) ==
- BTC Dominance: ${d.btcDominance}%
- Total Crypto Market Cap: $${(d.totalMarketCap / 1e12).toFixed(2)}T
- Total 24h Volume: $${(d.totalVolume / 1e9).toFixed(2)}B
- Market Cap Change 24h: ${d.marketCapChange24h >= 0 ? '+' : ''}${d.marketCapChange24h}%
NOTE: Rising BTC dominance = Fear (flight to safety). Falling dominance = Greed (altcoin speculation).`;
    }

    // Factor 5: Alternative.me F&G (industry reference)
    if (allFactors.altFnG && allFactors.altFnG.available) {
        const a = allFactors.altFnG;
        dataSection += `\n\n== FACTOR 5: INDUSTRY SENTIMENT REFERENCE (Weight: 17.5%) ==
- Alternative.me Fear & Greed Index (industry standard):
- Current Score: ${a.currentScore} (${a.currentLabel})
- 7-day History: ${a.history.map(h => `${h.date}: ${h.score} (${h.label})`).join(', ')}`;
        const avg7d = Math.round(a.history.reduce((sum, h) => sum + h.score, 0) / a.history.length);
        dataSection += `\n- 7-day Average: ${avg7d}`;
        dataSection += '\nNOTE: Use this as a cross-reference. If your analysis aligns with this index, it confirms the sentiment. If it diverges significantly, explain why based on the data.';
    } else {
        dataSection += '\n\n== FACTOR 5: INDUSTRY SENTIMENT REFERENCE (Weight: 17.5%) ==\n(Data not available — skip this factor and redistribute weight)';
    }

    // News Headlines as additional context
    if (allFactors.headlines && allFactors.headlines.length > 0) {
        dataSection += '\n\n== ADDITIONAL CONTEXT: LATEST NEWS HEADLINES ==';
        allFactors.headlines.forEach((h, i) => {
            dataSection += `\n${i + 1}. [${h.site}] "${h.title}"`;
        });
    }

    // Add multi-token market data for per-token scoring
    if (allFactors.multiToken) {
        dataSection += '\n\n== MULTI-TOKEN MARKET DATA (for per-token scoring) ==';
        for (const [symbol, d] of Object.entries(allFactors.multiToken)) {
            dataSection += `\n--- ${symbol} ---\n- Price: $${d.currentPrice.toLocaleString()}\n- 24h: ${d.change24h >= 0 ? '+' : ''}${d.change24h}%\n- 7d: ${d.change7d >= 0 ? '+' : ''}${d.change7d}%\n- Volume: $${(d.volume24h / 1e9).toFixed(2)}B\n- Market Cap: $${(d.marketCap / 1e9).toFixed(2)}B`;
        }
    }

    const prompt = `You are an expert crypto market sentiment analyst creating a Fear & Greed Index. Analyze ALL the following data factors and provide a comprehensive Fear & Greed score.

${dataSection}

=== SCORING INSTRUCTIONS ===
Calculate a weighted Fear & Greed score from 0 to 100 based on the available factors above.
If any factor data is missing, redistribute its weight proportionally among the remaining factors.

SCORE MEANING:
- 0-24: Extreme Fear (market panic, crash fears, capitulation)
- 25-44: Fear (bearish sentiment, uncertainty, declining interest)
- 45-55: Neutral (mixed signals, consolidation, balanced views)
- 56-74: Greed (bullish sentiment, rising interest, buying pressure)
- 75-100: Extreme Greed (euphoria, FOMO, unsustainable optimism)

Be objective and data-driven. Weight each factor accordingly.

In addition to the overall score, also provide individual Fear & Greed scores for BTC, ETH, SOL, and BNB based on their market data and the overall market sentiment.

You MUST respond with ONLY a valid JSON object, no other text:
{"score": <number 0-100>, "label": "<Extreme Fear|Fear|Neutral|Greed|Extreme Greed>", "reason": "<2-3 sentence explanation covering key factors>", "factors": {"volatility": <0-100>, "momentum": <0-100>, "social": <0-100 or null>, "dominance": <0-100>, "trends": <0-100 or null>}, "token_scores": {"BTC": {"score": <0-100>, "label": "<Extreme Fear|Fear|Neutral|Greed|Extreme Greed>", "summary": "<1 short sentence>"}, "ETH": {"score": <0-100>, "label": "<label>", "summary": "<1 short sentence>"}, "SOL": {"score": <0-100>, "label": "<label>", "summary": "<1 short sentence>"}, "BNB": {"score": <0-100>, "label": "<label>", "summary": "<1 short sentence>"}}}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 500,
                    }
                })
            }
        );

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Gemini API error');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in Gemini response');

        const result = JSON.parse(jsonMatch[0]);

        if (typeof result.score !== 'number' || result.score < 0 || result.score > 100) {
            throw new Error(`Invalid score: ${result.score}`);
        }

        return result;
    } catch (e) {
        console.error('   [!] Gemini Error:', e.message);
        return null;
    }
}

// ===================================================================
//  SAVE TO SUPABASE
// ===================================================================
async function saveFearGreed(result, allFactors, headlines) {
    const { error } = await supabase
        .from('fear_greed_index')
        .insert({
            score: result.score,
            label: result.label,
            reason: result.reason,
            btc_price: allFactors.momentum?.currentPrice || null,
            btc_24h_change: allFactors.momentum?.change24h || null,
            btc_volume: allFactors.momentum?.volume24h || null,
            headlines: headlines,
            factors: result.factors || null,
            token_scores: result.token_scores || null
        });

    if (error) {
        console.error('   [!] DB Error:', error.message);
        return false;
    }
    return true;
}

// ===================================================================
//  MAIN
// ===================================================================
async function main() {
    if (!process.env.API_KEY) { console.error('[!] API_KEY belum diset di .env'); process.exit(1); }
    if (!process.env.SUPABASE_URL) { console.error('[!] SUPABASE_URL belum diset di .env'); process.exit(1); }
    if (!process.env.GEMINI_API_KEY) { console.error('[!] GEMINI_API_KEY belum diset di .env'); process.exit(1); }

    const client = new BrowsercashSDK({ apiKey: process.env.API_KEY });
    SESSION_CONFIG = await askConfig();

    console.log(`\n${'═'.repeat(55)}`);
    console.log(`  CRYPTO FEAR & GREED INDEX v2 — AI-Powered`);
    console.log(`  5 Factors: Volatility | Momentum | Social | Dominance | Trends`);
    console.log(`${'═'.repeat(55)}\n`);

    const allFactors = {};

    // ── STEP 1: CoinGecko Data (Factors 1, 2, 4) ──
    console.log('━'.repeat(50));
    console.log('STEP 1: Fetching market data from CoinGecko...');
    console.log('━'.repeat(50));

    allFactors.volatility = await getVolatilityData();
    await new Promise(r => setTimeout(r, 1500)); // Rate limit

    allFactors.momentum = await getMomentumData();
    await new Promise(r => setTimeout(r, 1500));

    // Fetch multi-token market data for per-token scoring
    console.log('   [>] Fetching ETH, SOL, BNB market data...');
    try {
        const tokenIds = ['ethereum', 'solana', 'binancecoin'];
        const multiToken = {};
        for (const id of tokenIds) {
            const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`);
            const data = await res.json();
            const md = data.market_data;
            const symbol = id === 'ethereum' ? 'ETH' : id === 'solana' ? 'SOL' : 'BNB';
            multiToken[symbol] = {
                currentPrice: md.current_price.usd,
                change24h: parseFloat(md.price_change_percentage_24h?.toFixed(2)) || 0,
                change7d: parseFloat(md.price_change_percentage_7d?.toFixed(2)) || 0,
                volume24h: md.total_volume?.usd || 0,
                marketCap: md.market_cap?.usd || 0,
            };
            console.log(`   [v] ${symbol}: $${multiToken[symbol].currentPrice.toLocaleString()} | 24h: ${multiToken[symbol].change24h >= 0 ? '+' : ''}${multiToken[symbol].change24h}%`);
            await new Promise(r => setTimeout(r, 1500));
        }
        // Also add BTC to multiToken
        if (allFactors.momentum) {
            multiToken['BTC'] = {
                currentPrice: allFactors.momentum.currentPrice,
                change24h: allFactors.momentum.change24h,
                change7d: allFactors.momentum.change7d,
                volume24h: allFactors.momentum.volume24h,
                marketCap: allFactors.momentum.marketCap,
            };
        }
        allFactors.multiToken = multiToken;
    } catch (e) {
        console.error('   [!] Multi-token fetch error:', e.message);
    }

    allFactors.dominance = await getBtcDominance();

    // ── STEP 2: Social Media (Factor 3) ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 2: Fetching social media data from Membit...');
    console.log('━'.repeat(50));

    allFactors.social = await getSocialData();

    // ── STEP 3: Alternative.me F&G (Factor 5) ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 3: Fetching Alternative.me F&G Index...');
    console.log('━'.repeat(50));

    allFactors.altFnG = await getAlternativeFnG();

    // ── STEP 4: News Headlines ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 4: Scraping crypto news headlines...');
    console.log('━'.repeat(50));

    const headlines = [];
    const total = CRYPTO_SITES.length;
    for (let i = 0; i < total; i++) {
        const result = await scrapeSite(client, CRYPTO_SITES[i], i, total);
        if (result) headlines.push(result);
        if (i < total - 1) await new Promise(r => setTimeout(r, 3000));
    }

    allFactors.headlines = headlines;
    console.log(`\n   >> Headlines collected: ${headlines.length}/${total}`);

    // ── STEP 5: Gemini AI Analysis ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 5: Analyzing all factors with Gemini AI...');
    console.log('━'.repeat(50));

    const analysis = await analyzeWithGemini(allFactors);
    if (!analysis) {
        console.error('\n[!] Gemini gagal memberikan analisis. Abort.');
        process.exit(1);
    }

    // ── Display Results ──
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`  ┌${'─'.repeat(51)}┐`);
    console.log(`  │   FEAR & GREED INDEX:  ${String(analysis.score).padStart(3)} / 100                 │`);
    console.log(`  │   Label: ${analysis.label.padEnd(42)}│`);
    console.log(`  └${'─'.repeat(51)}┘`);
    console.log(`\n  Reason: ${analysis.reason}`);

    if (analysis.factors) {
        console.log(`\n  Factor Breakdown:`);
        console.log(`    Volatility:    ${analysis.factors.volatility ?? 'N/A'}`);
        console.log(`    Momentum:      ${analysis.factors.momentum ?? 'N/A'}`);
        console.log(`    Social Media:  ${analysis.factors.social ?? 'N/A'}`);
        console.log(`    BTC Dominance: ${analysis.factors.dominance ?? 'N/A'}`);
        console.log(`    Search Trends: ${analysis.factors.trends ?? 'N/A'}`);
    }
    if (analysis.token_scores) {
        console.log(`\n  Per-Token Scores:`);
        for (const [sym, ts] of Object.entries(analysis.token_scores)) {
            console.log(`    ${sym}: ${ts.score} (${ts.label}) — ${ts.summary}`);
        }
    }
    console.log(`${'═'.repeat(55)}`);

    // ── STEP 6: Save to Supabase ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 6: Saving to Supabase...');
    console.log('━'.repeat(50));

    const saved = await saveFearGreed(analysis, allFactors, headlines);
    if (saved) {
        console.log('   [v] Tersimpan di database!');
    }

    console.log(`\n${'═'.repeat(55)}`);
    console.log(`>> SELESAI!`);
    console.log(`>> Score: ${analysis.score} (${analysis.label})`);
    console.log(`>> BTC: $${allFactors.momentum?.currentPrice?.toLocaleString() || 'N/A'}`);
    console.log(`>> Data: ${headlines.length} headlines + 4 market factors`);
    console.log(`${'═'.repeat(55)}\n`);
}

main().catch(console.error);
