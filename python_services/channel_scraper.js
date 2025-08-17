// Suppress all console output from dependencies
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;

// Redirect all console output to stderr except our final JSON output
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write('[WARN] ' + args.join(' ') + '\n');
console.info = (...args) => process.stderr.write('[INFO] ' + args.join(' ') + '\n');

console.log = (...args) => { console.error('[GRAMJS]', ...args); };
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const apiId = Number(process.env.TELEGRAM_API_ID) || 28373339;
const apiHash = process.env.TELEGRAM_API_HASH || '828b6c5fc274dc2753d8336dbf9bd756';
const stringSessionStr = process.env.TG_SESSION || '';

if (!stringSessionStr) {
  console.error(JSON.stringify({ error: "TG_SESSION is empty. Please generate a valid session string first." }));
  process.exit(1);
}

const channels = [
    'https://t.me/c4dotgg'
];

function parseChannelUrl(url) {
    if (url.includes('/c/')) {
        const match = url.match(/\/c\/(\d+)/);
        if (match) {
            return `-100${match[1]}`;
        }
    } else if (url.includes('t.me/')) {
        const match = url.match(/t\.me\/([^/]+)/);
        if (match) {
            return match[1];
        }
    }
    return url;
}

function getLastNDaysMessages(messages, nDays = 3) {
    const uniqueDates = [];
    for (const msg of messages) {
        const dateObj = msg.date instanceof Date ? msg.date : new Date(msg.date);
        const dateStr = dateObj.toISOString().split('T')[0];
        if (!uniqueDates.includes(dateStr)) {
            uniqueDates.push(dateStr);
        }
        if (uniqueDates.length === nDays) {
            break;
        }
    }
    return messages.filter(msg => {
        const dateObj = msg.date instanceof Date ? msg.date : new Date(msg.date);
        const msgDateStr = dateObj.toISOString().split('T')[0];
        return uniqueDates.includes(msgDateStr);
    });
}

function formatDate(date) {
    if (!date) return null;
    let d = (typeof date === 'number') ? new Date(date * 1000) : new Date(date);
    if (isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function getMediaTypeName(media) {
    if (!media) return null;
    if (media.className) return media.className;
    return 'Unknown';
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getProjectName(channel, msg) {
    return channel.title || channel.username || 'Unknown Project';
}

function getCategory(channel, msg) {
    if (channel.title && /promo/i.test(channel.title)) return 'Promo';
    return 'News';
}

function extractUrl(msg) {
    if (!msg) return null;
    // 1. Cari url mentah di pesan
    if (msg.message) {
        const urlMatch = msg.message.match(/https?:\/\/[^\s]+/);
        if (urlMatch) return urlMatch[0];
    }
    // 2. Cari url dari entities (embedded link)
    if (msg.entities && Array.isArray(msg.entities)) {
        for (const entity of msg.entities) {
            if (entity.type === 'textUrl' && entity.url) {
                return entity.url;
            }
            if (entity.type === 'url' && msg.message) {
                // url yang tertulis langsung di pesan
                return msg.message.substr(entity.offset, entity.length);
            }
        }
    }
    return null;
}

function findUrlForText(msg, targetText) {
    if (!msg || !msg.entities || !Array.isArray(msg.entities) || !msg.message) return null;
    for (const entity of msg.entities) {
        const text = msg.message.substr(entity.offset, entity.length);
        // Cek apakah text entity mengandung targetText (atau sebaliknya)
        if (
            text.trim() === targetText.trim() ||
            text.includes(targetText) ||
            targetText.includes(text)
        ) {
            if (entity.type === 'textUrl' && entity.url) {
                return entity.url;
            }
            if (entity.type === 'url') {
                return text;
            }
        }
    }
    return null;
}

function extractMarkdownLinks(text) {
    const regex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
    const results = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        results.push({ title: match[1], url: match[2] });
    }
    return results;
}

function getSectionCategory(section) {
    const map = {
        'News': 'News',
        'Project Updates': 'Update',
        'Launches': 'Launch',
        'New Projects': 'New Project',
        'Threads/Reads': 'Thread',
    };
    return map[section] || section;
}

function extractAllUrlsFromEntities(lineStart, lineEnd, entities, text) {
    const urls = [];
    if (!entities || !Array.isArray(entities)) return urls;
    for (const entity of entities) {
        if ((entity.type === 'textUrl' || entity.className === 'MessageEntityTextUrl') && entity.url) {
            if (entity.offset >= lineStart && entity.offset < lineEnd) {
                urls.push(entity.url);
            }
        }
        if ((entity.type === 'url' || entity.className === 'MessageEntityUrl') && text) {
            if (entity.offset >= lineStart && entity.offset < lineEnd) {
                urls.push(text.substr(entity.offset, entity.length));
            }
        }
    }
    return urls;
}

function extractAllUrls(text) {
    if (!text) return [];
    return [...text.matchAll(/https?:\/\/\S+/g)].map(m => m[0]);
}

function extractUrlFromEntities(lineStart, lineEnd, entities, text) {
    if (!entities || !Array.isArray(entities)) return null;
    for (const entity of entities) {
        if ((entity.type === 'textUrl' || entity.className === 'MessageEntityTextUrl') && entity.url) {
            if (entity.offset >= lineStart && entity.offset < lineEnd) {
                return entity.url;
            }
        }
    }
    return null;
}

function extractFirstUrlFromText(text) {
    if (!text) return null;
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    if (urlMatch) return urlMatch[0];
    return null;
}

function isOnlyUrl(line) {
    return /^https?:\/\/\S+$/.test(line);
}

function detectCategory(line) {
    const l = line.toLowerCase();
    if (l.includes('📰news') || (l.includes('news') && !l.includes('project'))) return '📰News';
    if (l.includes('project updates')) return 'Project Updates';
    if (l.includes('threads/reads')) return 'Threads/Reads';
    if (l.includes('launches')) return 'Launches';
    if (l.includes('new projects')) return 'New Projects';
    return null;
}

function isWithinLastNDays(dateString, n) {
    if (!dateString) return false;
    const entryDate = new Date(dateString);
    if (isNaN(entryDate.getTime())) return false;
    const now = new Date();
    // Set jam, menit, detik ke 0 agar perbandingan hanya tanggal
    now.setHours(0,0,0,0);
    entryDate.setHours(0,0,0,0);
    const diffDays = (now - entryDate) / (1000 * 60 * 60 * 24);
    return diffDays <= (n-1) && diffDays >= 0;
}

function extractEntriesFromMessage(channel, msg) {
    const text = msg.message || msg.text || '';
    const lines = text.split('\n');
    const entities = msg.entities || msg.entities || [];
    let charIdx = 0;
    const entries = [];
    let foundAnyUrl = false;
    let currentCategory = 'News';
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        const lineStart = charIdx;
        const lineEnd = charIdx + lines[i].length;
        if (!line) {
            charIdx += lines[i].length + 1;
            continue;
        }
        // Deteksi header kategori
        const detected = detectCategory(line);
        if (detected) {
            currentCategory = detected;
            charIdx += lines[i].length + 1;
            continue;
        }
        if (line.startsWith('[') || line.startsWith('My Links:') || line.startsWith('Trading Bots:')) {
            charIdx += lines[i].length + 1;
            continue;
        }
        // Cari url dari entities di baris ini
        let url = extractUrlFromEntities(lineStart, lineEnd, entities, text);
        // Jika tidak ada, cari url di teks baris
        if (!url) url = extractFirstUrlFromText(line);
        if (url) foundAnyUrl = true;
        let description = line;
        // Jika baris hanya url atau "Website", ambil deskripsi dari baris sebelumnya atau 2 baris ke atas
        if (url && (isOnlyUrl(line) || /^website$/i.test(line))) {
            let j = i - 1;
            let foundDesc = false;
            while (j >= 0) {
                let prev = lines[j].trim();
                if (prev && !isOnlyUrl(prev) && !detectCategory(prev) && !prev.startsWith('[') && !prev.startsWith('My Links:') && !prev.startsWith('Trading Bots:') && !/^website$/i.test(prev)) {
                    description = prev;
                    foundDesc = true;
                    break;
                }
                j--;
            }
            // Jika tetap tidak ketemu, fallback ke nama channel + ' Link'
            if (!foundDesc) {
                description = (channel.title || channel.username || 'Link') + ' Link';
            }
        }
        // Jika deskripsi hanya "Website", fallback ke nama channel + ' Website'
        if (/^website$/i.test(description)) {
            description = (channel.title || channel.username || 'Website') + ' Website';
        }
        entries.push({
            category: currentCategory,
            description,
            url: url || null,
            date: formatDate(msg.date)
        });
        charIdx += lines[i].length + 1;
    }
    // Jika tidak ada url sama sekali di pesan, tetap buat entry tanpa url
    if (!foundAnyUrl && entries.length === 0 && text.trim()) {
        entries.push({
            category: currentCategory,
            description: text.trim(),
            url: null,
            date: formatDate(msg.date)
        });
    }
    // Filter hanya entry yang ada url dan date dalam 2 hari terakhir
    return entries.filter(e => e.url && isWithinLastNDays(e.date, 2));
}

async function main() {
    const result = [];
    try {
        const stringSession = new StringSession(stringSessionStr);
        const client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 5,
        });
        await client.start();
        for (const chUrl of channels) {
            try {
                const channel = await client.getEntity(chUrl);
                console.error('DEBUG: Mengambil pesan dari channel', chUrl);
                const messages = await client.getMessages(channel, { limit: 10 });
                console.error('DEBUG: Jumlah pesan diambil:', messages.length);
                for (let idx = 0; idx < messages.length; idx++) {
                    const msg = messages[idx];
                    console.error('DEBUG MSG:', JSON.stringify(msg, null, 2));
                    const entries =   extractEntriesFromMessage(channel, msg);
                    for (const entry of entries) {
                        result.push(entry);
                    }
                }
            } catch (channelError) {
                console.error(`Error processing channel ${chUrl}:`, channelError.message);
                continue;
            }
        }
        await client.disconnect();
    } catch (error) {
        console.error(JSON.stringify({ error: error.message }));
        process.exit(1);
    }
    console.log = (...args) => process.stdout.write(args.join(' ') + '\n'); // restore for JSON output
    console.log(JSON.stringify(result, null, 2));
    // Tampilkan semua hasil scraping secara lengkap ke console log (stderr)
    if (result.length > 0) {
        process.stderr.write('\n=== Semua Hasil Scraping ===\n');
        process.stderr.write(JSON.stringify(result, null, 2) + '\n');
    } else {
        process.stderr.write('Tidak ada hasil scraping yang ditemukan.\n');
    }
    process.exit(0); // langsung exit setelah output JSON
}

// Handle unhandled rejections quietly
process.on('unhandledRejection', (reason) => {
    process.stderr.write(JSON.stringify({ 
        error: 'Unhandled Promise Rejection',
        reason: reason?.message || String(reason)
    }) + '\n');
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    process.stderr.write(JSON.stringify({ 
        error: 'Uncaught Exception',
        message: error.message
    }) + '\n');
    process.exit(1);
});

main().catch(error => {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
});