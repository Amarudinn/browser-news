// ==========================================
// Altcoin Season Score v1 (AI-Powered)
// ==========================================
// 6 Factors: ETH vs BTC, Market Cap Share, DeFi TVL,
//            Volume Share, Social Media, Market Ref
// + News Headlines as additional context
//
// Cara jalan: node task-script/altcoin-season-score.js
// Cron mode:  node task-script/altcoin-season-score.js --cron

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
// COINGECKO API HELPER
// =====================
const CG_API_KEY = process.env.COINGECKO_API_KEY;
const CG_BASE = 'https://api.coingecko.com';

async function cgFetch(path) {
    const url = `${CG_BASE}${path}`;
    const headers = CG_API_KEY ? { 'x-cg-demo-api-key': CG_API_KEY } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${res.statusText}`);
    return res.json();
}

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
// 10 CRYPTO NEWS SITES (pool untuk headline, target 5)
// =====================
const CRYPTO_SITES = [
    {
        name: 'CoinDesk', category: 'crypto',
        url: 'https://www.coindesk.com/',
        waitFor: 'a[href*="/2"]',
        type: 'links',
        linkSelector: 'a[href*="/20"]',
        baseUrl: 'https://www.coindesk.com'
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
        scrape: () => {
            const links = document.querySelectorAll('a[href]');
            const seen = new Set();
            const results = [];
            links.forEach(a => {
                const href = a.getAttribute('href') || '';
                if (!/^\/\d/.test(href)) return;
                const full = 'https://decrypt.co' + href;
                if (seen.has(full)) return;
                seen.add(full);
                const text = a.innerText?.trim();
                if (text && text.length > 20 && text.length < 200) {
                    results.push({ title: text, link: full, site: 'Decrypt' });
                }
            });
            return results.slice(0, 3);
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
        url: 'https://beincrypto.com/news/',
        waitFor: 'article a, a[href*="/2"]',
        type: 'custom',
        scrape: () => {
            const links = document.querySelectorAll('article a[href], a[href*="beincrypto.com/"]');
            const seen = new Set();
            const results = [];
            links.forEach(a => {
                const href = a.href || '';
                if (!href.includes('beincrypto.com/') || href.endsWith('/news/')) return;
                if (seen.has(href)) return;
                seen.add(href);
                const text = a.innerText?.trim();
                if (text && text.length > 20 && text.length < 200 && !text.includes('\n')) {
                    results.push({ title: text, link: href, site: 'BeInCrypto' });
                }
            });
            return results.slice(0, 3);
        }
    },
    {
        name: 'CryptoSlate', category: 'crypto',
        url: 'https://cryptoslate.com/top-news/',
        waitFor: 'article a, .post-title a',
        type: 'custom',
        scrape: () => {
            const links = document.querySelectorAll('article a[href], .post-title a[href], h2 a[href]');
            const seen = new Set();
            const results = [];
            links.forEach(a => {
                const href = a.href || '';
                if (!href.includes('cryptoslate.com/')) return;
                if (seen.has(href)) return;
                seen.add(href);
                const text = a.innerText?.trim();
                if (text && text.length > 20 && text.length < 200 && !text.includes('\n')) {
                    results.push({ title: text, link: href, site: 'CryptoSlate' });
                }
            });
            return results.slice(0, 3);
        }
    },
    {
        name: 'Bitcoin Magazine', category: 'crypto',
        url: 'https://bitcoinmagazine.com/',
        waitFor: 'a[href*="/news/"], a[href*="/markets/"]',
        type: 'custom',
        scrape: () => {
            const links = document.querySelectorAll('a[href*="/news/"], a[href*="/markets/"], article a[href]');
            const seen = new Set();
            const results = [];
            links.forEach(a => {
                const href = a.href || '';
                if (!href.includes('bitcoinmagazine.com/')) return;
                if (href === 'https://bitcoinmagazine.com/news' || href === 'https://bitcoinmagazine.com/markets') return;
                if (seen.has(href)) return;
                seen.add(href);
                const text = a.innerText?.trim();
                if (text && text.length > 20 && text.length < 200 && !text.includes('\n')) {
                    results.push({ title: text, link: href, site: 'Bitcoin Magazine' });
                }
            });
            return results.slice(0, 3);
        }
    },
    {
        name: 'U.Today', category: 'crypto',
        url: 'https://u.today/latest-cryptocurrency-news',
        waitFor: 'a[href]',
        type: 'custom',
        scrape: () => {
            const links = document.querySelectorAll('a[href]');
            const seen = new Set();
            const results = [];
            links.forEach(a => {
                const href = a.href || '';
                if (!href.includes('u.today/') || href.endsWith('/latest-cryptocurrency-news')) return;
                const segments = href.split('/').filter(Boolean);
                const last = segments[segments.length - 1] || '';
                if (last.length < 10 || !last.includes('-')) return;
                if (seen.has(href)) return;
                seen.add(href);
                const text = a.innerText?.trim();
                if (text && text.length > 20 && text.length < 200 && !text.includes('\n')) {
                    results.push({ title: text, link: href, site: 'U.Today' });
                }
            });
            return results.slice(0, 3);
        }
    },
    {
        name: 'NewsBTC', category: 'crypto',
        url: 'https://www.newsbtc.com/',
        waitFor: 'a[href*="/bitcoin-news/"], a[href*="/altcoin/"]',
        type: 'custom',
        scrape: () => {
            const links = document.querySelectorAll('a[href*="/bitcoin-news/"], a[href*="/altcoin/"], a[href*="/analysis/"], article a[href]');
            const seen = new Set();
            const results = [];
            links.forEach(a => {
                const href = a.href || '';
                if (!href.includes('newsbtc.com/')) return;
                if (seen.has(href)) return;
                seen.add(href);
                const text = a.innerText?.trim();
                if (text && text.length > 20 && text.length < 200 && !text.includes('\n')) {
                    results.push({ title: text, link: href, site: 'NewsBTC' });
                }
            });
            return results.slice(0, 3);
        }
    },
    {
        name: 'CryptoPotato', category: 'crypto',
        url: 'https://cryptopotato.com/crypto-news/',
        waitFor: 'article a, a[href*="cryptopotato.com/"]',
        type: 'custom',
        scrape: () => {
            const links = document.querySelectorAll('article a[href], .rpwe-title a[href], h3 a[href]');
            const seen = new Set();
            const results = [];
            links.forEach(a => {
                const href = a.href || '';
                if (!href.includes('cryptopotato.com/')) return;
                if (href.endsWith('/crypto-news/') || href.endsWith('.com/')) return;
                if (seen.has(href)) return;
                seen.add(href);
                const text = a.innerText?.trim();
                if (text && text.length > 20 && text.length < 200 && !text.includes('\n')) {
                    results.push({ title: text, link: href, site: 'CryptoPotato' });
                }
            });
            return results.slice(0, 3);
        }
    }
];

// Shuffle array (Fisher-Yates)
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// =====================
// Generic Link Scraper
// =====================
async function genericLinkScraper(config) {
    return (page) => page.evaluate(({ sel, base, siteName }) => {
        const links = document.querySelectorAll(sel);
        const seen = new Set();
        const results = [];
        links.forEach(a => {
            let href = a.getAttribute('href') || '';
            if (href.startsWith('/')) href = base + href;
            if (!href.startsWith('http') || seen.has(href)) return;
            seen.add(href);
            const text = a.innerText?.trim();
            if (text && text.length > 20 && text.length < 200 && !text.includes('\n')) {
                results.push({ title: text, link: href, site: siteName });
            }
        });
        return results.slice(0, 3);
    }, { sel: config.linkSelector, base: config.baseUrl, siteName: config.name });
}


// ===================================================================
//  FACTOR 1: ETH vs BTC PERFORMANCE (20%) — CoinGecko
// ===================================================================
async function getEthVsBtc() {
    console.log('   [>] Fetching ETH vs BTC performance...');
    try {
        const [ethData, btcData] = await Promise.all([
            cgFetch('/api/v3/coins/ethereum?localization=false&tickers=false&community_data=false&developer_data=false'),
            cgFetch('/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false')
        ]);

        const ethMd = ethData.market_data;
        const btcMd = btcData.market_data;

        const result = {
            ethPrice: ethMd.current_price.usd,
            btcPrice: btcMd.current_price.usd,
            eth24h: parseFloat(ethMd.price_change_percentage_24h?.toFixed(2)) || 0,
            btc24h: parseFloat(btcMd.price_change_percentage_24h?.toFixed(2)) || 0,
            eth7d: parseFloat(ethMd.price_change_percentage_7d?.toFixed(2)) || 0,
            btc7d: parseFloat(btcMd.price_change_percentage_7d?.toFixed(2)) || 0,
            eth30d: parseFloat(ethMd.price_change_percentage_30d?.toFixed(2)) || 0,
            btc30d: parseFloat(btcMd.price_change_percentage_30d?.toFixed(2)) || 0,
            ethMarketCap: ethMd.market_cap?.usd || 0,
            btcMarketCap: btcMd.market_cap?.usd || 0,
            // ETH outperformance = positive = altcoin season signal
            outperform24h: parseFloat(((ethMd.price_change_percentage_24h || 0) - (btcMd.price_change_percentage_24h || 0)).toFixed(2)),
            outperform7d: parseFloat(((ethMd.price_change_percentage_7d || 0) - (btcMd.price_change_percentage_7d || 0)).toFixed(2)),
            outperform30d: parseFloat(((ethMd.price_change_percentage_30d || 0) - (btcMd.price_change_percentage_30d || 0)).toFixed(2)),
        };

        console.log(`   [v] ETH: $${result.ethPrice.toLocaleString()} (24h: ${result.eth24h >= 0 ? '+' : ''}${result.eth24h}%)`);
        console.log(`   [v] BTC: $${result.btcPrice.toLocaleString()} (24h: ${result.btc24h >= 0 ? '+' : ''}${result.btc24h}%)`);
        console.log(`   [v] ETH outperformance: 24h ${result.outperform24h >= 0 ? '+' : ''}${result.outperform24h}% | 7d ${result.outperform7d >= 0 ? '+' : ''}${result.outperform7d}% | 30d ${result.outperform30d >= 0 ? '+' : ''}${result.outperform30d}%`);

        return result;
    } catch (e) {
        console.error('   [!] ETH vs BTC Error:', e.message);
        return null;
    }
}


// ===================================================================
//  FACTOR 2: ALTCOIN MARKET CAP SHARE (20%) — CoinGecko /global
// ===================================================================
async function getAltcoinMarketCapShare() {
    console.log('   [>] Fetching altcoin market cap share...');
    try {
        const data = await cgFetch('/api/v3/global');

        const btcDominance = parseFloat(data.data.market_cap_percentage.btc.toFixed(2));
        const ethDominance = parseFloat(data.data.market_cap_percentage.eth.toFixed(2));
        const totalMarketCap = data.data.total_market_cap.usd;
        const marketCapChange24h = parseFloat(data.data.market_cap_change_percentage_24h_usd.toFixed(2));

        // Altcoin share = everything except BTC
        const altcoinShare = parseFloat((100 - btcDominance).toFixed(2));

        console.log(`   [v] BTC Dominance: ${btcDominance}% | ETH: ${ethDominance}% | Altcoin Share: ${altcoinShare}%`);
        console.log(`   [v] Total Market Cap: $${(totalMarketCap / 1e12).toFixed(2)}T | 24h change: ${marketCapChange24h >= 0 ? '+' : ''}${marketCapChange24h}%`);

        return {
            btcDominance,
            ethDominance,
            altcoinShare,
            totalMarketCap,
            marketCapChange24h
        };
    } catch (e) {
        console.error('   [!] Market Cap Share Error:', e.message);
        return null;
    }
}


// ===================================================================
//  FACTOR 3: DEFI TVL GROWTH (20%) — DefiLlama API
// ===================================================================
async function getDefiTvlGrowth() {
    console.log('   [>] Fetching DeFi TVL from DefiLlama...');
    try {
        const res = await fetch('https://api.llama.fi/v2/historicalChainTvl');
        if (!res.ok) throw new Error(`DefiLlama ${res.status}: ${res.statusText}`);
        const data = await res.json();

        // Get last 30 days
        const recent = data.slice(-31);
        const currentTvl = recent[recent.length - 1].tvl;
        const tvl30dAgo = recent[0].tvl;
        const tvl7dAgo = recent[recent.length - 8]?.tvl || recent[0].tvl;

        const growth30d = parseFloat(((currentTvl - tvl30dAgo) / tvl30dAgo * 100).toFixed(2));
        const growth7d = parseFloat(((currentTvl - tvl7dAgo) / tvl7dAgo * 100).toFixed(2));

        console.log(`   [v] DeFi TVL: $${(currentTvl / 1e9).toFixed(2)}B`);
        console.log(`   [v] 7d growth: ${growth7d >= 0 ? '+' : ''}${growth7d}% | 30d growth: ${growth30d >= 0 ? '+' : ''}${growth30d}%`);

        return {
            currentTvl,
            tvl30dAgo,
            tvl7dAgo,
            growth7d,
            growth30d
        };
    } catch (e) {
        console.error('   [!] DeFi TVL Error:', e.message);
        return null;
    }
}


// ===================================================================
//  FACTOR 4: ALTCOIN VOLUME SHARE (10%) — CoinGecko
// ===================================================================
async function getAltcoinVolumeShare() {
    console.log('   [>] Fetching altcoin volume share...');
    try {
        // Total volume from /global
        const globalData = await cgFetch('/api/v3/global');
        const totalVolume = globalData.data.total_volume.usd;

        await new Promise(r => setTimeout(r, 1500));

        // BTC volume
        const btcData = await cgFetch('/api/v3/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false');
        const btcVolume = btcData.market_data.total_volume?.usd || 0;

        const altcoinVolume = totalVolume - btcVolume;
        const altcoinVolumeShare = parseFloat((altcoinVolume / totalVolume * 100).toFixed(2));

        console.log(`   [v] Total 24h Volume: $${(totalVolume / 1e9).toFixed(2)}B`);
        console.log(`   [v] BTC Volume: $${(btcVolume / 1e9).toFixed(2)}B | Altcoin Volume: $${(altcoinVolume / 1e9).toFixed(2)}B`);
        console.log(`   [v] Altcoin Volume Share: ${altcoinVolumeShare}%`);

        return {
            totalVolume,
            btcVolume,
            altcoinVolume,
            altcoinVolumeShare
        };
    } catch (e) {
        console.error('   [!] Volume Share Error:', e.message);
        return null;
    }
}


// ===================================================================
//  FACTOR 5: SOCIAL MEDIA (20%) — Membit API (Twitter/X)
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

        // Altcoin-focused search
        console.log('   [>] Searching altcoin clusters...');
        let clusterText = '';
        try {
            const clusters = await client.cluster_search('altcoin season ethereum defi', {
                limit: 5,
                format: 'llm'
            });
            clusterText = typeof clusters === 'string' ? clusters : JSON.stringify(clusters);
        } catch (e) {
            console.log(`   [!] Cluster search error: ${e.message}`);
        }

        console.log('   [>] Searching altcoin posts...');
        let postText = '';
        try {
            const posts = await client.post_search('altcoin season ethereum solana DeFi altcoins', {
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
//  FACTOR 6: MARKET REFERENCE (10%) — CMC Altcoin Season Scrape
// ===================================================================
async function getMarketReference(client) {
    console.log('   [>] Scraping CoinMarketCap Altcoin Season Index...');
    try {
        const session = await client.browser.session.create({
            type: SESSION_CONFIG.type,
            country: SESSION_CONFIG.country,
            nodeId: SESSION_CONFIG.nodeId,
            windowSize: SESSION_CONFIG.windowSize
        });
        const browser = await chromium.connectOverCDP(session.cdpUrl);
        const ctx = browser.contexts()[0] || await browser.newContext();
        const page = ctx.pages()[0] || await ctx.newPage();

        await page.goto('https://www.coinmarketcap.com/charts/altcoin-season-index/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        await page.waitForTimeout(5000);

        const result = await page.evaluate(() => {
            const text = document.body.innerText;
            // Try to extract the score from the page
            // CMC shows "Altcoin Season Index: XX"
            const scoreMatch = text.match(/(?:altcoin\s+season\s+index|altcoin\s+month)[:\s]*(\d{1,3})/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

            // Determine label
            let label = null;
            if (score !== null) {
                if (score <= 25) label = 'Bitcoin Season';
                else if (score <= 50) label = 'Mostly Bitcoin';
                else if (score <= 75) label = 'Mostly Altcoins';
                else label = 'Altcoin Season';
            }

            return { score, label };
        });

        await browser.close();

        if (result.score !== null) {
            console.log(`   [v] CMC Altcoin Season: ${result.score} (${result.label})`);
            return {
                source: 'CoinMarketCap',
                score: result.score,
                label: result.label,
                available: true
            };
        }
        throw new Error('Could not extract score from CMC');
    } catch (e) {
        console.error('   [!] Market Reference Error:', e.message);
        console.log('   [~] Skipping market reference (scrape failed)');
        return { available: false };
    }
}


// ===================================================================
//  SCRAPE 1 NEWS SITE (headline)
// ===================================================================
async function scrapeSite(client, site, index, total) {
    console.log(`   [${index + 1}/${total}] Scraping ${site.name}...`);
    try {
        const session = await client.browser.session.create({
            type: SESSION_CONFIG.type,
            country: SESSION_CONFIG.country,
            nodeId: SESSION_CONFIG.nodeId,
            windowSize: SESSION_CONFIG.windowSize
        });
        const browser = await chromium.connectOverCDP(session.cdpUrl);
        const ctx = browser.contexts()[0] || await browser.newContext();
        const page = ctx.pages()[0] || await ctx.newPage();

        await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);

        let headlines = [];
        if (site.type === 'custom' && site.scrape) {
            headlines = await page.evaluate(site.scrape);
        } else if (site.type === 'links') {
            headlines = await (await genericLinkScraper(site))(page);
        }

        await browser.close();

        if (headlines.length > 0) {
            const picked = headlines[0];
            console.log(`   [v] ${site.name}: "${picked.title.substring(0, 60)}..."`);
            return picked;
        } else {
            console.log(`   [!] ${site.name}: No headlines found`);
            return null;
        }
    } catch (e) {
        console.error(`   [!] ${site.name} Error:`, e.message);
        return null;
    }
}


// ===================================================================
//  GEMINI AI — Altcoin Season Analysis
// ===================================================================
async function analyzeWithGemini(allFactors) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('   [!] GEMINI_API_KEY belum diset di .env');
        return null;
    }

    // Build comprehensive prompt
    let dataSection = '';

    // Factor 1: ETH vs BTC
    if (allFactors.ethVsBtc) {
        const e = allFactors.ethVsBtc;
        dataSection += `\n== FACTOR 1: ETH vs BTC PERFORMANCE (Weight: 20%) ==
- ETH Price: $${e.ethPrice.toLocaleString()} | BTC Price: $${e.btcPrice.toLocaleString()}
- ETH 24h: ${e.eth24h >= 0 ? '+' : ''}${e.eth24h}% | BTC 24h: ${e.btc24h >= 0 ? '+' : ''}${e.btc24h}%
- ETH 7d: ${e.eth7d >= 0 ? '+' : ''}${e.eth7d}% | BTC 7d: ${e.btc7d >= 0 ? '+' : ''}${e.btc7d}%
- ETH 30d: ${e.eth30d >= 0 ? '+' : ''}${e.eth30d}% | BTC 30d: ${e.btc30d >= 0 ? '+' : ''}${e.btc30d}%
- ETH Outperformance vs BTC: 24h ${e.outperform24h >= 0 ? '+' : ''}${e.outperform24h}% | 7d ${e.outperform7d >= 0 ? '+' : ''}${e.outperform7d}% | 30d ${e.outperform30d >= 0 ? '+' : ''}${e.outperform30d}%
NOTE: ETH outperforming BTC = Altcoin Season signal. Consistent outperformance across timeframes = strong signal.`;
    }

    // Factor 2: Altcoin Market Cap Share
    if (allFactors.marketCapShare) {
        const m = allFactors.marketCapShare;
        dataSection += `\n\n== FACTOR 2: ALTCOIN MARKET CAP SHARE (Weight: 20%) ==
- BTC Dominance: ${m.btcDominance}%
- ETH Dominance: ${m.ethDominance}%
- Altcoin Share (100% - BTC): ${m.altcoinShare}%
- Total Crypto Market Cap: $${(m.totalMarketCap / 1e12).toFixed(2)}T
- Market Cap 24h Change: ${m.marketCapChange24h >= 0 ? '+' : ''}${m.marketCapChange24h}%
NOTE: BTC dominance < 50% = Altcoin Season territory. Falling BTC dominance = money flowing to altcoins.`;
    }

    // Factor 3: DeFi TVL Growth
    if (allFactors.defiTvl) {
        const d = allFactors.defiTvl;
        dataSection += `\n\n== FACTOR 3: DEFI TVL GROWTH (Weight: 20%) ==
- Current Total DeFi TVL: $${(d.currentTvl / 1e9).toFixed(2)}B
- 7-day Growth: ${d.growth7d >= 0 ? '+' : ''}${d.growth7d}%
- 30-day Growth: ${d.growth30d >= 0 ? '+' : ''}${d.growth30d}%
NOTE: Growing TVL = capital flowing into DeFi (altcoins). Rapid TVL growth = strong Altcoin Season signal.`;
    }

    // Factor 4: Altcoin Volume Share
    if (allFactors.volumeShare) {
        const v = allFactors.volumeShare;
        dataSection += `\n\n== FACTOR 4: ALTCOIN VOLUME SHARE (Weight: 10%) ==
- Total 24h Volume: $${(v.totalVolume / 1e9).toFixed(2)}B
- BTC Volume: $${(v.btcVolume / 1e9).toFixed(2)}B
- Altcoin Volume: $${(v.altcoinVolume / 1e9).toFixed(2)}B
- Altcoin Volume Share: ${v.altcoinVolumeShare}%
NOTE: Altcoin volume share > 60% = lots of altcoin trading activity = Altcoin Season signal.`;
    }

    // Factor 5: Social Media
    if (allFactors.social && allFactors.social.hasData) {
        const s = allFactors.social;
        dataSection += `\n\n== FACTOR 5: SOCIAL MEDIA (Weight: 20%) ==
- Source: Twitter/X data via Membit API`;
        if (s.clusterText) {
            dataSection += `\n- Trending Clusters:\n${s.clusterText}`;
        }
        if (s.postText) {
            dataSection += `\n- Recent Posts:\n${s.postText}`;
        }
        dataSection += '\nNOTE: Analyze sentiment about altcoins. Positive/FOMO about altcoins = Altcoin Season signal. Focus on BTC only = Bitcoin Season.';
    } else {
        dataSection += '\n\n== FACTOR 5: SOCIAL MEDIA (Weight: 20%) ==\n(Data not available — skip this factor and redistribute weight)';
    }

    // Factor 6: Market Reference
    if (allFactors.marketRef && allFactors.marketRef.available) {
        const r = allFactors.marketRef;
        dataSection += `\n\n== FACTOR 6: MARKET REFERENCE (Weight: 10%) ==
- Source: ${r.source}
- Altcoin Season Index Score: ${r.score} (${r.label})
NOTE: Use this as a cross-reference. Your analysis should roughly align with this, but explain any divergence.`;
    } else {
        dataSection += '\n\n== FACTOR 6: MARKET REFERENCE (Weight: 10%) ==\n(Data not available — skip this factor and redistribute weight)';
    }

    // News Headlines as additional context
    if (allFactors.headlines && allFactors.headlines.length > 0) {
        dataSection += '\n\n== ADDITIONAL CONTEXT: LATEST NEWS HEADLINES ==';
        dataSection += '\n(These are for context only, not scored as a factor)';
        allFactors.headlines.forEach((h, i) => {
            dataSection += `\n${i + 1}. [${h.site}] "${h.title}"`;
        });
    }

    const prompt = `You are an expert crypto market analyst creating an Altcoin Season Index. Analyze ALL the following data factors and determine whether we are in Altcoin Season or Bitcoin Season.

${dataSection}

=== SCORING INSTRUCTIONS ===
Calculate a weighted Altcoin Season score from 0 to 100 based on the available factors above.
If any factor data is missing, redistribute its weight proportionally among the remaining factors.

SCORE MEANING:
- 0-24: Bitcoin Season (BTC dominates, altcoins underperform, money flows to BTC)
- 25-44: Mostly Bitcoin (BTC still leading, some altcoin interest)
- 45-55: Neutral (mixed signals, no clear trend)
- 56-74: Mostly Altcoins (altcoins gaining strength, money flowing from BTC)
- 75-100: Altcoin Season (altcoins outperform, high DeFi activity, alt speculation)

Be objective and data-driven. Weight each factor accordingly.

You MUST respond with ONLY a valid JSON object, no other text:
{"score": <number 0-100>, "label": "<Bitcoin Season|Mostly Bitcoin|Neutral|Mostly Altcoins|Altcoin Season>", "reason": "<2-3 sentence explanation covering key factors>", "factors": {"ethVsBtc": <0-100>, "marketCapShare": <0-100>, "defiTvl": <0-100>, "volumeShare": <0-100>, "social": <0-100 or null>, "marketRef": <0-100 or null>}}`;

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
async function saveToSupabase(result, allFactors, headlines) {
    const { error } = await supabase
        .from('altcoin_season_score')
        .insert({
            score: result.score,
            label: result.label,
            reason: result.reason,
            total_market_cap: allFactors.marketCapShare?.totalMarketCap || null,
            altcoin_market_cap: allFactors.marketCapShare
                ? allFactors.marketCapShare.totalMarketCap * (allFactors.marketCapShare.altcoinShare / 100)
                : null,
            btc_dominance: allFactors.marketCapShare?.btcDominance || null,
            headlines: headlines,
            factors: result.factors || null,
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
    console.log(`  ALTCOIN SEASON INDEX v1 — AI-Powered`);
    console.log(`  6 Factors: ETH/BTC | MCap | TVL | Volume | Social | Ref`);
    console.log(`${'═'.repeat(55)}\n`);

    const allFactors = {};

    // ── STEP 1: CoinGecko Data (Factors 1, 2, 4) ──
    console.log('━'.repeat(50));
    console.log('STEP 1: Fetching market data from CoinGecko...');
    console.log('━'.repeat(50));

    allFactors.ethVsBtc = await getEthVsBtc();
    await new Promise(r => setTimeout(r, 1500));

    allFactors.marketCapShare = await getAltcoinMarketCapShare();
    await new Promise(r => setTimeout(r, 1500));

    allFactors.volumeShare = await getAltcoinVolumeShare();

    // ── STEP 2: DeFi TVL (Factor 3) ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 2: Fetching DeFi TVL from DefiLlama...');
    console.log('━'.repeat(50));

    allFactors.defiTvl = await getDefiTvlGrowth();

    // ── STEP 3: Social Media (Factor 5) ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 3: Fetching social media data from Membit...');
    console.log('━'.repeat(50));

    allFactors.social = await getSocialData();

    // ── STEP 4: Market Reference (Factor 6) ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 4: Scraping market reference score...');
    console.log('━'.repeat(50));

    allFactors.marketRef = await getMarketReference(client);

    // ── STEP 5: News Headlines ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 5: Scraping crypto news headlines...');
    console.log('━'.repeat(50));

    const TARGET_HEADLINES = 5;
    const shuffled = shuffleArray(CRYPTO_SITES);
    const primarySites = shuffled.slice(0, TARGET_HEADLINES);
    const backupSites = shuffled.slice(TARGET_HEADLINES);

    console.log(`   [i] Primary: ${primarySites.map(s => s.name).join(', ')}`);
    console.log(`   [i] Backup:  ${backupSites.map(s => s.name).join(', ')}`);

    const headlines = [];
    let siteIdx = 0;

    for (let i = 0; i < primarySites.length; i++) {
        siteIdx++;
        const result = await scrapeSite(client, primarySites[i], siteIdx - 1, TARGET_HEADLINES);
        if (result) headlines.push(result);
        if (i < primarySites.length - 1) await new Promise(r => setTimeout(r, 3000));
    }

    if (headlines.length < TARGET_HEADLINES && backupSites.length > 0) {
        console.log(`\n   [!] Only ${headlines.length}/${TARGET_HEADLINES} headlines, rotating to backup sites...`);
        for (let i = 0; i < backupSites.length && headlines.length < TARGET_HEADLINES; i++) {
            siteIdx++;
            await new Promise(r => setTimeout(r, 3000));
            const result = await scrapeSite(client, backupSites[i], siteIdx - 1, CRYPTO_SITES.length);
            if (result) headlines.push(result);
        }
    }

    allFactors.headlines = headlines;
    console.log(`\n   >> Headlines collected: ${headlines.length}/${TARGET_HEADLINES}`);

    // ── STEP 6: Gemini AI Analysis ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 6: Analyzing all factors with Gemini AI...');
    console.log('━'.repeat(50));

    const analysis = await analyzeWithGemini(allFactors);
    if (!analysis) {
        console.error('\n[!] Gemini gagal memberikan analisis. Abort.');
        process.exit(1);
    }

    // ── Display Results ──
    console.log(`\n${'═'.repeat(55)}`);
    console.log(`  ┌${'─'.repeat(51)}┐`);
    console.log(`  │   ALTCOIN SEASON INDEX:  ${String(analysis.score).padStart(3)} / 100               │`);
    console.log(`  │   Label: ${analysis.label.padEnd(42)}│`);
    console.log(`  └${'─'.repeat(51)}┘`);
    console.log(`\n  Reason: ${analysis.reason}`);

    if (analysis.factors) {
        console.log(`\n  Factor Breakdown:`);
        console.log(`    ETH vs BTC:        ${analysis.factors.ethVsBtc ?? 'N/A'}`);
        console.log(`    Market Cap Share:  ${analysis.factors.marketCapShare ?? 'N/A'}`);
        console.log(`    DeFi TVL:          ${analysis.factors.defiTvl ?? 'N/A'}`);
        console.log(`    Volume Share:      ${analysis.factors.volumeShare ?? 'N/A'}`);
        console.log(`    Social Media:      ${analysis.factors.social ?? 'N/A'}`);
        console.log(`    Market Reference:  ${analysis.factors.marketRef ?? 'N/A'}`);
    }
    console.log(`${'═'.repeat(55)}`);

    // ── STEP 7: Save to Supabase ──
    console.log('\n' + '━'.repeat(50));
    console.log('STEP 7: Saving to Supabase...');
    console.log('━'.repeat(50));

    const saved = await saveToSupabase(analysis, allFactors, headlines);
    if (saved) {
        console.log('   [v] Tersimpan di database!');
    }

    console.log(`\n${'═'.repeat(55)}`);
    console.log(`>> SELESAI!`);
    console.log(`>> Score: ${analysis.score} (${analysis.label})`);
    console.log(`>> BTC Dominance: ${allFactors.marketCapShare?.btcDominance || 'N/A'}%`);
    console.log(`>> Altcoin Share: ${allFactors.marketCapShare?.altcoinShare || 'N/A'}%`);
    console.log(`>> Data: ${headlines.length} headlines + 6 market factors`);
    console.log(`${'═'.repeat(55)}\n`);
}

main().catch(console.error);
