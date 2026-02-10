// ==========================================
// Telegram News Monitor (v7 - Supabase)
// ==========================================
// Cara jalan: node task-script/news-monitor.js
//
// Fitur:
// 1. Sesi browser BARU per situs (= poin terpisah)
// 2. 1 berita UNIK per situs (skip jika sudah di database)
// 3. Simpan ke Supabase (tabel: news)
// 4. Kirim ke Telegram
// 5. 20 situs: Berita, Crypto, Olahraga
// 6. Otomatis berhenti setelah semua selesai

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

async function isAlreadySent(link) {
    const { data } = await supabase
        .from('news')
        .select('id')
        .eq('link', link)
        .limit(1);
    return data && data.length > 0;
}

async function saveNews(siteName, category, title, link) {
    const { error } = await supabase
        .from('news')
        .insert({ site_name: siteName, category, title, link });
    if (error && error.code !== '23505') { // 23505 = duplicate
        console.log(`   [!] DB Error: ${error.message}`);
    }
}

// =====================
// KONFIGURASI (ditanya saat awal)
// =====================
async function askConfig() {
    // Check for --cron flag
    if (process.argv.includes('--cron')) {
        console.log('   [i] Running in CRON mode (automated)');
        return {
            type: 'hosted',
            country: undefined, // "Any" setting
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
        },
        {
            type: 'confirm',
            name: 'useProxy',
            message: 'Use Custom Proxy?',
            default: false
        },
        {
            type: 'input',
            name: 'proxyUrl',
            message: 'Proxy URL:',
            when: (answers) => answers.useProxy,
            validate: (input) => input ? true : 'Proxy URL is required'
        },
        {
            type: 'confirm',
            name: 'useProfile',
            message: 'Use specific profile?',
            default: false
        },
        {
            type: 'input',
            name: 'profileName',
            message: 'Profile Name:',
            when: (answers) => answers.useProfile,
            validate: (input) => input ? true : 'Profile name is required'
        }
    ]);

    return {
        type: answers.type,
        country: answers.country,
        nodeId: answers.nodeId || undefined,
        windowSize: answers.windowSize,
        proxyUrl: answers.useProxy ? answers.proxyUrl : undefined,
        profile: answers.useProfile ? { name: answers.profileName, persist: true } : undefined
    };
}

let SESSION_CONFIG;

// =====================
// DAFTAR 20 SITUS
// =====================
const NEWS_SITES = [
    // --- INDONESIA ---
    {
        name: 'CNN Indonesia', category: 'indonesia',
        url: 'https://www.cnnindonesia.com/',
        waitFor: 'article',
        type: 'custom',
        scrape: function () {
            var results = [];
            var articles = document.querySelectorAll('article');
            for (var i = 0; i < articles.length; i++) {
                var el = articles[i];
                var t = el.querySelector('h2, h3');
                var a = el.querySelector('a');
                if (t && a && t.innerText.trim().length > 10) {
                    var link = a.getAttribute('href');
                    if (link && !link.startsWith('http')) link = window.location.origin + link;
                    results.push({ title: t.innerText.trim(), link: link });
                }
            }
            return results;
        }
    },
    {
        name: 'CNBC Indonesia', category: 'indonesia',
        url: 'https://www.cnbcindonesia.com/',
        waitFor: 'article',
        type: 'custom',
        scrape: function () {
            var results = [];
            var articles = document.querySelectorAll('article');
            for (var i = 0; i < articles.length; i++) {
                var el = articles[i];
                var t = el.querySelector('h2');
                var a = el.querySelector('a');
                if (t && a && t.innerText.trim().length > 10) {
                    var link = a.getAttribute('href');
                    if (link && !link.startsWith('http')) link = window.location.origin + link;
                    results.push({ title: t.innerText.trim(), link: link });
                }
            }
            return results;
        }
    },

    // --- GLOBAL ---
    {
        name: 'Reuters', category: 'global',
        url: 'https://www.reuters.com/',
        waitFor: 'a[href*="/world/"], a[href*="/business/"]',
        type: 'links',
        linkSelector: 'a[href*="/article/"], a[href*="/world/"], a[href*="/business/"], a[href*="/technology/"]',
        baseUrl: 'https://www.reuters.com',
        excludes: ['Subscribe', 'Sign']
    },
    {
        name: 'Al Jazeera', category: 'global',
        url: 'https://www.aljazeera.com/',
        waitFor: 'a[href*="/news/"]',
        type: 'links',
        linkSelector: 'a[href*="/news/"], a[href*="/features/"], a[href*="/economy/"]',
        baseUrl: 'https://www.aljazeera.com',
        excludes: ['More']
    },
    {
        name: 'CNN International', category: 'global',
        url: 'https://edition.cnn.com/',
        waitFor: 'a[href*="/202"]',
        type: 'links',
        linkSelector: 'a[href*="/202"]',
        baseUrl: 'https://edition.cnn.com',
        minLen: 25,
        excludes: ['Ad Feedback']
    },
    {
        name: 'Bloomberg', category: 'global',
        url: 'https://www.bloomberg.com/',
        waitFor: 'a[href*="/news/"]',
        type: 'links',
        linkSelector: 'a[href*="/news/"], a[href*="/articles/"]',
        baseUrl: 'https://www.bloomberg.com',
        minLen: 25,
        excludes: ['Subscribe']
    },

    // --- CRYPTO ---
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
                    results.push({ title: text, link: 'https://decrypt.co' + href });
                }
            }
            return results;
        }
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
        name: 'The Block', category: 'crypto',
        url: 'https://www.theblock.co/',
        waitFor: 'a[href*="/post/"]',
        type: 'links',
        linkSelector: 'a[href*="/post/"]',
        baseUrl: 'https://www.theblock.co'
    },
    {
        name: 'Bitcoin Magazine', category: 'crypto',
        url: 'https://bitcoinmagazine.com/',
        waitFor: 'a',
        type: 'links',
        linkSelector: 'a[href*="/articles/"], a[href*="/business/"], a[href*="/markets/"]',
        baseUrl: 'https://bitcoinmagazine.com'
    },
    {
        name: 'Messari', category: 'crypto',
        url: 'https://messari.io/news',
        waitFor: 'a',
        type: 'links',
        linkSelector: 'a[href*="/news/"], a[href*="/article/"]',
        baseUrl: 'https://messari.io'
    },

    // --- OLAHRAGA ---
    {
        name: 'ESPN', category: 'sports',
        url: 'https://www.espn.com/',
        waitFor: 'a[href*="/story/"]',
        type: 'links',
        linkSelector: 'a[href*="/story/"], a[href*="/article/"]',
        baseUrl: 'https://www.espn.com',
        excludes: ['ESPN+', 'Subscribe']
    },
    {
        name: 'Sky Sports', category: 'sports',
        url: 'https://www.skysports.com/',
        waitFor: 'a[href*="/news/"]',
        type: 'links',
        linkSelector: 'a[href*="/news/"], a[href*="/story/"]',
        baseUrl: 'https://www.skysports.com',
        excludes: ['Watch', 'Live']
    },
    {
        name: 'Goal.com', category: 'sports',
        url: 'https://www.goal.com/en',
        waitFor: 'a[href*="/news/"]',
        type: 'links',
        linkSelector: 'a[href*="/news/"], a[href*="/lists/"]',
        baseUrl: 'https://www.goal.com'
    },
    {
        name: 'Bleacher Report', category: 'sports',
        url: 'https://bleacherreport.com/',
        waitFor: 'a',
        type: 'links',
        linkSelector: 'a[href*="/articles/"]',
        baseUrl: 'https://bleacherreport.com'
    },
    {
        name: 'UEFA', category: 'sports',
        url: 'https://www.uefa.com/',
        waitFor: 'a',
        type: 'links',
        linkSelector: 'a[href*="/news/"], a[href*="/article/"]',
        baseUrl: 'https://www.uefa.com',
        minLen: 15
    },
    {
        name: 'MLB', category: 'sports',
        url: 'https://www.mlb.com/news',
        waitFor: 'a[href*="/news/"]',
        type: 'links',
        linkSelector: 'a[href*="/news/"]',
        baseUrl: 'https://www.mlb.com'
    },
    {
        name: 'NBA', category: 'sports',
        url: 'https://www.nba.com/news',
        waitFor: 'a[href*="/news/"]',
        type: 'links',
        linkSelector: 'a[href*="/news/"], a[href*="/article/"]',
        baseUrl: 'https://www.nba.com'
    },
    {
        name: 'Marca', category: 'sports',
        url: 'https://www.marca.com/en/',
        waitFor: 'a',
        type: 'links',
        linkSelector: 'a[href*="/football/"], a[href*="/basketball/"], a[href*="/tennis/"]',
        baseUrl: 'https://www.marca.com'
    },
    {
        name: 'Football365', category: 'sports',
        url: 'https://www.football365.com/',
        waitFor: 'a[href*="/news/"]',
        type: 'links',
        linkSelector: 'a[href*="/news/"]',
        baseUrl: 'https://www.football365.com'
    }
];

// =====================
// Fungsi scrape generik
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
            results.push({ title: text, link: fullUrl });
        }
    }
    return results;
};

// =====================
// TELEGRAM
// =====================
async function sendTelegram(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) { console.error('   [!] TELEGRAM credentials missing in .env'); return; }

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId, text: message,
                parse_mode: 'Markdown', disable_web_page_preview: true
            })
        });
        const data = await res.json();
        if (data.ok) console.log('   [v] Terkirim ke Telegram');
        else console.log('   [!] Gagal:', data.description);
    } catch (e) { console.error('   [!] Error:', e.message); }
}

// =====================
// PROSES 1 SITUS = 1 SESI BROWSER
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

        if (site.waitFor) {
            try { await page.waitForSelector(site.waitFor, { timeout: 10000 }); } catch { }
        }
        await page.mouse.wheel(0, 300);
        await new Promise(r => setTimeout(r, 800));

        // Scrape SEMUA berita
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

        console.log(`   [i] Ditemukan ${allNews.length} berita di halaman`);

        // Cari berita yang BELUM pernah dikirim (cek via Supabase)
        let selectedNews = null;
        for (const news of allNews) {
            if (news && news.link && !(await isAlreadySent(news.link))) {
                selectedNews = news;
                break;
            }
        }

        if (selectedNews) {
            console.log(`   [v] ${selectedNews.title.substring(0, 50)}...`);

            // Simpan ke Supabase
            await saveNews(site.name, site.category, selectedNews.title, selectedNews.link);
            console.log('   [v] Tersimpan di database');

            // Kirim ke Telegram
            const msg = `📢 *${site.name}*\n\n${selectedNews.title}. [Baca selengkapnya](${selectedNews.link})`;
            await sendTelegram(msg);

            return true;
        } else if (allNews.length > 0) {
            console.log('   [~] Semua berita sudah pernah dikirim (skip)');
            return false;
        } else {
            console.log('   [!] Tidak menemukan berita.');
            return false;
        }
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
    if (!process.env.API_KEY) { console.error('[!] API_KEY belum diset di .env'); process.exit(1); }
    if (!process.env.SUPABASE_URL) { console.error('[!] SUPABASE_URL belum diset di .env'); process.exit(1); }

    const client = new BrowsercashSDK({ apiKey: process.env.API_KEY });
    SESSION_CONFIG = await askConfig();

    // Cek jumlah berita di database
    const { count } = await supabase.from('news').select('*', { count: 'exact', head: true });
    const total = NEWS_SITES.length;

    console.log(`\n>> News Monitor - Supabase Edition`);
    console.log(`>> Total situs: ${total}`);
    console.log(`>> Berita di database: ${count || 0}`);
    console.log(`>> Estimasi poin: ~${total}k (1 sesi per situs)\n`);

    let success = 0;
    let skipped = 0;

    for (let i = 0; i < total; i++) {
        const ok = await processSite(client, NEWS_SITES[i], i, total);
        if (ok) success++; else skipped++;

        if (i < total - 1) {
            console.log('\n   [...] Jeda 3 detik...');
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    const { count: finalCount } = await supabase.from('news').select('*', { count: 'exact', head: true });

    console.log(`\n${'='.repeat(50)}`);
    console.log(`>> SELESAI!`);
    console.log(`>> Berhasil kirim: ${success}/${total}`);
    console.log(`>> Skip/Gagal: ${skipped}/${total}`);
    console.log(`>> Total berita di database: ${finalCount || 0}`);
    console.log(`${'='.repeat(50)}\n`);
}

main().catch(console.error);
