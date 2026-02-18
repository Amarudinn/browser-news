// ==========================================
// BrowserCash Point Farming (Scrape Only)
// ==========================================
// Cara jalan: node task-script/test.js
// Cron mode:  node task-script/test.js --cron
//
// Hanya scraping untuk farming poin.
// TIDAK menyimpan ke database, TIDAK kirim Telegram.

import 'dotenv/config';
import { chromium } from 'playwright';
import BrowsercashSDK from '@browsercash/sdk';
import inquirer from 'inquirer';

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
// DAFTAR SITUS UNTUK FARMING
// =====================
const SITES = [
    // --- INDONESIA ---
    { name: 'CNN Indonesia', url: 'https://www.cnnindonesia.com/', waitFor: 'article' },
    { name: 'CNBC Indonesia', url: 'https://www.cnbcindonesia.com/', waitFor: 'article' },
    { name: 'Detik', url: 'https://www.detik.com/', waitFor: 'article' },
    { name: 'Kompas', url: 'https://www.kompas.com/', waitFor: 'article' },

    // --- GLOBAL ---
    { name: 'Reuters', url: 'https://www.reuters.com/', waitFor: 'a[href*="/world/"]' },
    { name: 'Al Jazeera', url: 'https://www.aljazeera.com/', waitFor: 'a[href*="/news/"]' },
    { name: 'CNN International', url: 'https://edition.cnn.com/', waitFor: 'a[href*="/202"]' },
    { name: 'Bloomberg', url: 'https://www.bloomberg.com/', waitFor: 'a[href*="/news/"]' },
    { name: 'BBC News', url: 'https://www.bbc.com/news', waitFor: 'a' },
    { name: 'The Guardian', url: 'https://www.theguardian.com/', waitFor: 'a' },

    // --- CRYPTO ---
    { name: 'Decrypt', url: 'https://decrypt.co/', waitFor: 'a[href^="/3"]' },
    { name: 'CoinTelegraph', url: 'https://cointelegraph.com/', waitFor: 'a[href*="/news/"]' },
    { name: 'The Block', url: 'https://www.theblock.co/', waitFor: 'a[href*="/post/"]' },
    { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/', waitFor: 'a' },
    { name: 'CoinDesk', url: 'https://www.coindesk.com/', waitFor: 'a[href*="/202"]' },
    { name: 'BeInCrypto', url: 'https://beincrypto.com/', waitFor: 'a' },
    { name: 'CoinGecko News', url: 'https://www.coingecko.com/en/news', waitFor: 'a' },
    { name: 'Messari', url: 'https://messari.io/news', waitFor: 'a' },

    // --- SPORTS ---
    { name: 'ESPN', url: 'https://www.espn.com/', waitFor: 'a[href*="/story/"]' },
    { name: 'Sky Sports', url: 'https://www.skysports.com/', waitFor: 'a[href*="/news/"]' },
    { name: 'Goal.com', url: 'https://www.goal.com/en', waitFor: 'a[href*="/news/"]' },
    { name: 'Bleacher Report', url: 'https://bleacherreport.com/', waitFor: 'a' },
    { name: 'UEFA', url: 'https://www.uefa.com/', waitFor: 'a' },
    { name: 'NBA', url: 'https://www.nba.com/news', waitFor: 'a[href*="/news/"]' },
    { name: 'MLB', url: 'https://www.mlb.com/news', waitFor: 'a[href*="/news/"]' },
    { name: 'Yahoo Sports', url: 'https://sports.yahoo.com/', waitFor: 'a[href*="/article/"]' },
    { name: 'Fox Sports', url: 'https://www.foxsports.com/', waitFor: 'a[href*="/stories/"]' },
    { name: 'Bola.com', url: 'https://www.bola.com/', waitFor: 'a[href*="/read/"]' },
    { name: 'OneFootball', url: 'https://onefootball.com/en/home', waitFor: 'a[href*="/en/news/"]' },
    { name: 'Football365', url: 'https://www.football365.com/', waitFor: 'a[href*="/news/"]' },

    // --- TECH ---
    { name: 'TechCrunch', url: 'https://techcrunch.com/', waitFor: 'a' },
    { name: 'The Verge', url: 'https://www.theverge.com/', waitFor: 'a' },
    { name: 'Wired', url: 'https://www.wired.com/', waitFor: 'a' },
    { name: 'Ars Technica', url: 'https://arstechnica.com/', waitFor: 'a' },

    // --- ENTERTAINMENT ---
    { name: 'IGN', url: 'https://www.ign.com/', waitFor: 'a' },
    { name: 'GameSpot', url: 'https://www.gamespot.com/', waitFor: 'a' },
    { name: 'Variety', url: 'https://variety.com/', waitFor: 'a' },

    // --- FINANCE ---
    { name: 'CNBC', url: 'https://www.cnbc.com/', waitFor: 'a' },
    { name: 'MarketWatch', url: 'https://www.marketwatch.com/', waitFor: 'a' },
    { name: 'Investing.com', url: 'https://www.investing.com/', waitFor: 'a' },

    // --- SCIENCE ---
    { name: 'National Geographic', url: 'https://www.nationalgeographic.com/', waitFor: 'a' },
    { name: 'Space.com', url: 'https://www.space.com/', waitFor: 'a' },
    { name: 'Live Science', url: 'https://www.livescience.com/', waitFor: 'a' },
];

// =====================
// PROSES 1 SITUS = 1 SESI BROWSER = 1 POIN
// =====================
async function processSite(client, site, index, total) {
    let session, browser;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`[${index + 1}/${total}] ${site.name}`);
    console.log(`${'='.repeat(50)}`);

    try {
        console.log('   [+] Membuat sesi browser...');
        session = await client.browser.session.create(SESSION_CONFIG);
        console.log(`   [+] Session: ${session.sessionId.substring(0, 20)}...`);

        browser = await chromium.connectOverCDP(session.cdpUrl);
        const contexts = browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();

        console.log(`   [>] Membuka ${site.url}...`);
        await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Tunggu elemen muncul
        if (site.waitFor) {
            try { await page.waitForSelector(site.waitFor, { timeout: 10000 }); } catch { }
        }

        // Simulasi aktivitas browsing (scroll pelan-pelan)
        for (let s = 0; s < 3; s++) {
            await page.mouse.wheel(0, 400);
            await new Promise(r => setTimeout(r, 1000));
        }

        // Ambil judul halaman sebagai konfirmasi
        const title = await page.title();
        console.log(`   [v] Halaman dimuat: "${title.substring(0, 60)}"`);
        console.log(`   [v] Farming poin berhasil!`);

        return true;
    } catch (e) {
        console.log(`   [!] Error: ${e.message}`);
        return false;
    } finally {
        if (browser) await browser.close().catch(() => { });
        if (session) {
            console.log('   [x] Menutup sesi...');
            await client.browser.session.stop({ sessionId: session.sessionId }).catch(() => { });
        }
    }
}

// =====================
// MAIN
// =====================
async function main() {
    if (!process.env.API_KEY) {
        console.error('[!] API_KEY belum diset di .env');
        process.exit(1);
    }

    const client = new BrowsercashSDK({ apiKey: process.env.API_KEY });
    SESSION_CONFIG = await askConfig();

    const total = SITES.length;

    console.log(`\n>> BrowserCash Point Farming`);
    console.log(`>> Total situs: ${total}`);
    console.log(`>> Estimasi poin: ~${total}k (1 sesi per situs)`);
    console.log(`>> Mode: Scrape only (tanpa database)\n`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < total; i++) {
        const ok = await processSite(client, SITES[i], i, total);
        if (ok) success++; else failed++;

        if (i < total - 1) {
            console.log('\n   [...] Jeda 3 detik...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`>> SELESAI!`);
    console.log(`>> Berhasil: ${success}/${total}`);
    console.log(`>> Gagal: ${failed}/${total}`);
    console.log(`>> Total poin (estimasi): ~${success}k`);
    console.log(`${'='.repeat(50)}\n`);
}

main().catch(console.error);
