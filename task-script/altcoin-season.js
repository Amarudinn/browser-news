// ==========================================
// Altcoin Season Index Scraper
// ==========================================
// Scrape Top 100 Coins Performance Over 90 Days
// from CoinMarketCap Altcoin Season Index
// + CoinGecko logos + Supabase storage
//
// Cara jalan: node task-script/altcoin-season.js
// Cron mode:  node task-script/altcoin-season.js --cron

import 'dotenv/config';
import { chromium } from 'playwright';
import BrowsercashSDK from '@browsercash/sdk';
import inquirer from 'inquirer';
import { createClient } from '@supabase/supabase-js';

// =====================
// SUPABASE
// =====================
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// =====================
// COINGECKO
// =====================
const CG_API_KEY = process.env.COINGECKO_API_KEY;
const CG_BASE = 'https://api.coingecko.com';

async function cgFetch(urlPath) {
    const url = `${CG_BASE}${urlPath}`;
    const headers = CG_API_KEY ? { 'x-cg-demo-api-key': CG_API_KEY } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${res.statusText}`);
    return res.json();
}

// Load logo cache (in-memory only, no file)
async function getLogoCache() {
    return null; // always fetch fresh from CoinGecko
}

// Fetch fresh data from CoinGecko (logos + prices)
async function fetchCoinGeckoData() {
    console.log('   \ud83c\udf10 Fetching from CoinGecko (2 API calls)...');
    const data = await cgFetch('/api/v3/coins/markets?vs_currency=usd&per_page=250&page=1');

    const map = {};
    for (const coin of data) {
        const symbol = coin.symbol.toUpperCase();
        if (!map[symbol]) {
            map[symbol] = {
                id: coin.id,
                name: coin.name,
                logo: coin.image,
                price: coin.current_price,
                price_change_24h: coin.price_change_percentage_24h
            };
        }
    }

    // Page 2 for more coins
    try {
        const data2 = await cgFetch('/api/v3/coins/markets?vs_currency=usd&per_page=250&page=2');
        for (const coin of data2) {
            const symbol = coin.symbol.toUpperCase();
            if (!map[symbol]) {
                map[symbol] = {
                    id: coin.id, name: coin.name, logo: coin.image,
                    price: coin.current_price,
                    price_change_24h: coin.price_change_percentage_24h
                };
            }
        }
    } catch (e) {
        console.log(`   \u26a0 Could not fetch page 2: ${e.message}`);
    }

    console.log(`   \u2705 Fetched ${Object.keys(map).length} coins with logos + prices`);

    return map;
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
            message: 'Country (enter to skip):',
            default: '',
            filter: input => input.trim() || undefined
        },
        {
            type: 'input',
            name: 'nodeId',
            message: 'Node ID (enter to skip):',
            default: '',
            filter: input => input.trim() || undefined
        },
        {
            type: 'input',
            name: 'windowSize',
            message: 'Window size:',
            default: '1920x1080'
        }
    ]);
    return answers;
}

// =====================
// SCRAPE FUNCTION
// =====================
// Runs INSIDE the browser via page.evaluate()
// CMC renders Top 100 as a Highcharts horizontal bar chart.
// Each bar label is a div.highcharts-data-label with text "PERCENTAGE% TICKER"
function scrapeAltcoinSeason() {
    var results = [];

    function clean(text) {
        return (text || '').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    }

    // === Index Score ===
    var indexScore = '—';
    var indexLabel = '—';

    var allEls = document.querySelectorAll('*');
    for (var i = 0; i < allEls.length; i++) {
        var el = allEls[i];
        var t = clean(el.innerText);
        if (t.match(/^\d{1,3}$/) && el.offsetWidth > 30 && el.offsetHeight > 30) {
            var fs = window.getComputedStyle(el).fontSize;
            if (parseInt(fs) > 30) {
                indexScore = t;
                break;
            }
        }
    }

    var bodyText = clean(document.body.innerText);
    if (bodyText.indexOf('Altcoin Month') !== -1) indexLabel = 'Altcoin Month';
    else if (bodyText.indexOf('Altcoin Season') !== -1) indexLabel = 'Altcoin Season';
    else if (bodyText.indexOf('Bitcoin Season') !== -1) indexLabel = 'Bitcoin Season';
    else if (bodyText.indexOf('Bitcoin Month') !== -1) indexLabel = 'Bitcoin Month';

    // === Strategy 1: Highcharts data labels ===
    var labels = document.querySelectorAll('.highcharts-data-label');
    var seen = {};

    for (var j = 0; j < labels.length; j++) {
        var labelText = clean(labels[j].innerText);
        if (!labelText || labelText.length < 3) continue;

        var match = labelText.match(/^(\d+\.?\d*)\s*%\s+([A-Za-z][A-Za-z0-9]*)/);
        if (!match) continue;

        var pct = match[1];
        var ticker = match[2].toUpperCase();

        if (seen[ticker]) continue;
        seen[ticker] = true;

        results.push({ ticker: ticker, performance: pct + '%' });
    }

    // === Strategy 2: Fallback — parse text near "Top 100" heading ===
    if (results.length === 0) {
        var top100Idx = bodyText.indexOf('Top 100 Coins Performance');
        if (top100Idx !== -1) {
            var chartText = bodyText.substring(top100Idx, top100Idx + 5000);
            var re = /(\d+\.?\d*)\s*%\s+([A-Z][A-Za-z0-9]+)/g;
            var m;
            while ((m = re.exec(chartText)) !== null) {
                var ticker = m[2].toUpperCase();
                if (seen[ticker]) continue;
                seen[ticker] = true;
                results.push({ ticker: ticker, performance: m[1] + '%' });
            }
        }
    }

    // === Determine sign: positive vs negative ===
    if (results.length > 2) {
        var values = results.map(function (r) { return parseFloat(r.performance); });
        var minIdx = 0;
        var minVal = values[0];
        for (var k = 1; k < values.length; k++) {
            if (values[k] < minVal) { minVal = values[k]; minIdx = k; }
        }
        for (var s = 0; s < results.length; s++) {
            if (s <= minIdx) {
                results[s].direction = 'outperform';
                results[s].pctSigned = '+' + results[s].performance;
            } else {
                results[s].direction = 'underperform';
                results[s].pctSigned = '-' + results[s].performance;
            }
        }
    }

    return {
        indexScore: indexScore,
        indexLabel: indexLabel,
        coinsCount: results.length,
        coins: results
    };
}

// =====================
// SUPABASE SAVE
// =====================
async function saveToSupabase(coins, indexScore, indexLabel) {
    console.log('\n   💾 Saving to Supabase...');

    // Step 1: Delete all existing rows
    const { error: delError } = await supabase.from('altcoin_season').delete().gte('id', 0);
    if (delError) {
        console.log(`   ⚠ Delete error: ${delError.message}`);
        return false;
    }

    // Step 2: Insert new rows
    const rows = coins.map((coin, i) => ({
        ticker: coin.ticker,
        name: coin.name || null,
        logo_url: coin.logo || null,
        coingecko_id: coin.coingecko_id || null,
        performance: parseFloat(coin.performance),
        direction: coin.direction || 'outperform',
        rank: i + 1,
        price: coin.price || null,
        price_change_24h: coin.price_change_24h || null,
        index_score: indexScore !== '—' ? parseInt(indexScore) : null,
        index_label: indexLabel !== '—' ? indexLabel : null,
        scraped_at: new Date().toISOString()
    }));

    const { error: insError } = await supabase.from('altcoin_season').insert(rows);
    if (insError) {
        console.log(`   ⚠ Insert error: ${insError.message}`);
        return false;
    }

    console.log(`   ✅ Saved ${rows.length} coins to Supabase`);
    return true;
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
    const config = await askConfig();

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  📊 ALTCOIN SEASON INDEX SCRAPER`);
    console.log(`  Source: CoinMarketCap + CoinGecko logos`);
    console.log(`${'═'.repeat(60)}`);

    // Step 1: Fetch fresh CoinGecko data (logos + prices)
    let cgData = {};
    try {
        cgData = await fetchCoinGeckoData();
    } catch (e) {
        console.log(`   ⚠ CoinGecko fetch failed, trying logo cache...`);
        try {
            const cached = await getLogoCache();
            if (cached) cgData = cached;
        } catch (e2) {
            console.log(`   ⚠ No cache available: ${e2.message}`);
        }
    }

    let session, browser;

    try {
        // Step 2: Scrape CMC
        console.log('\n   🔍 Opening CoinMarketCap Altcoin Season Index...');
        session = await client.browser.session.create(config);
        browser = await chromium.connectOverCDP(session.cdpUrl);
        const contexts = browser.contexts();
        const context = contexts.length > 0 ? contexts[0] : await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();

        await page.goto('https://coinmarketcap.com/charts/altcoin-season-index/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        console.log('   ⏳ Waiting for page to render...');
        await new Promise(r => setTimeout(r, 5000));

        console.log('   📜 Scrolling to load chart...');
        for (let s = 0; s < 5; s++) {
            await page.mouse.wheel(0, 600);
            await new Promise(r => setTimeout(r, 1500));
        }
        await new Promise(r => setTimeout(r, 3000));

        console.log('   🔎 Extracting data from Highcharts chart...');
        const data = await page.evaluate(scrapeAltcoinSeason);

        // Close browser early
        await browser.close().catch(() => { });
        await client.browser.session.stop({ sessionId: session.sessionId }).catch(() => { });
        browser = null; session = null;

        // Step 3: Enrich with logos + prices
        console.log(`\n   🖼️  Matching data for ${data.coinsCount} coins...`);
        let matched = 0;
        const missing = [];
        for (const coin of data.coins) {
            const info = cgData[coin.ticker];
            if (info) {
                coin.name = info.name;
                coin.logo = info.logo;
                coin.coingecko_id = info.id;
                coin.price = info.price;
                coin.price_change_24h = info.price_change_24h;
                matched++;
            } else {
                missing.push(coin.ticker);
            }
        }
        console.log(`   ✅ Matched ${matched}/${data.coinsCount} coins`);

        // Smart cache refresh: if coins are missing, try refreshing
        if (missing.length > 0 && matched > 0) {
            console.log(`   ⚠ Missing ${missing.length} coins: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
            try {
                console.log('   🔄 Refreshing CoinGecko data...');
                const fresh = await fetchCoinGeckoData();
                for (const coin of data.coins) {
                    if (!coin.logo && fresh[coin.ticker]) {
                        const info = fresh[coin.ticker];
                        coin.name = info.name;
                        coin.logo = info.logo;
                        coin.coingecko_id = info.id;
                        coin.price = info.price;
                        coin.price_change_24h = info.price_change_24h;
                        matched++;
                    }
                }
                console.log(`   ✅ After refresh: ${matched}/${data.coinsCount} matched`);
            } catch (e) {
                console.log(`   ⚠ Refresh failed: ${e.message}`);
            }
        }

        // Step 4: Display results
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  📊 ALTCOIN SEASON INDEX`);
        console.log(`${'═'.repeat(60)}\n`);

        if (data.indexScore !== '—') {
            console.log(`  🎯 Index Score: ${data.indexScore} — ${data.indexLabel}`);
        }
        console.log(`  📈 Coins found: ${data.coinsCount}\n`);

        if (data.coins.length > 0) {
            const outperform = data.coins.filter(c => c.direction === 'outperform');
            const underperform = data.coins.filter(c => c.direction === 'underperform');

            console.log(`  🟢 OUTPERFORMING BTC (${outperform.length} coins):`);
            console.log(`  ${'#'.padEnd(4)} ${'Ticker'.padEnd(8)} ${'Name'.padEnd(18)} ${'90d'.padStart(10)} ${'Logo'}`);
            console.log(`  ${'─'.repeat(60)}`);
            for (let i = 0; i < outperform.length; i++) {
                const c = outperform[i];
                const logo = c.logo ? '✅' : '❌';
                console.log(`  ${String(i + 1).padEnd(4)} ${c.ticker.padEnd(8)} ${(c.name || '—').padEnd(18)} 🟢${('+' + c.performance).padStart(10)} ${logo}`);
            }

            console.log(`\n  🔴 UNDERPERFORMING BTC (${underperform.length} coins):`);
            console.log(`  ${'#'.padEnd(4)} ${'Ticker'.padEnd(8)} ${'Name'.padEnd(18)} ${'90d'.padStart(10)} ${'Logo'}`);
            console.log(`  ${'─'.repeat(60)}`);
            for (let i = 0; i < underperform.length; i++) {
                const c = underperform[i];
                const logo = c.logo ? '✅' : '❌';
                console.log(`  ${String(i + 1).padEnd(4)} ${c.ticker.padEnd(8)} ${(c.name || '—').padEnd(18)} 🔴${('-' + c.performance).padStart(10)} ${logo}`);
            }

            console.log(`\n  ${'─'.repeat(40)}`);
            console.log(`  🟢 Outperform: ${outperform.length}  |  🔴 Underperform: ${underperform.length}`);
            console.log(`  🖼️  Logos: ${matched}/${data.coinsCount}`);

            // Step 5: Save to Supabase
            await saveToSupabase(data.coins, data.indexScore, data.indexLabel);


        } else {
            console.log('  ❌ No coin data found');
        }

    } catch (e) {
        console.error(`\n  ❌ Error: ${e.message}`);
    } finally {
        if (browser) await browser.close().catch(() => { });
        if (session) await client.browser.session.stop({ sessionId: session.sessionId }).catch(() => { });
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`>> SELESAI!`);
    console.log(`${'═'.repeat(60)}\n`);
}

main().catch(console.error);
