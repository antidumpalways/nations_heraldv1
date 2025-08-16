const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');

const apiId = Number(process.env.TG_API_ID) || 28373339;
const apiHash = process.env.TG_API_HASH || '828b6c5fc274dc2753d8336dbf9bd756';
const stringSessionStr = process.env.TG_SESSION || '';

const channels = [
    'https://t.me/c4dotgg',
    'https://t.me/crypto_gem_analytics',
    'https://t.me/drrdrops',
];

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
    const d = date instanceof Date ? date : new Date(date);
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

async function main() {
    const result = [];
    try {
        const stringSession = new StringSession(stringSessionStr);
        const client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 5,
        });
        await client.start({
            // Tidak ada input interaktif, gunakan session string
            phoneNumber: undefined,
            password: undefined,
            phoneCode: undefined,
            onError: (err) => console.log(err),
        });
        for (const chUrl of channels) {
            try {
                const channel = await client.getEntity(chUrl);
                const messages = await client.getMessages(channel, { limit: 100 });
                if (!messages || messages.length === 0) continue;
                const lastMessages = getLastNDaysMessages(messages, 3);
                for (const msg of lastMessages) {
                    result.push({
                        channel: channel.title || channel.username || chUrl,
                        id: msg.id,
                        date: formatDate(msg.date),
                        text: msg.message || msg.text || null,
                        media: getMediaTypeName(msg.media)
                    });
                }
            } catch (channelError) {
                console.error(`Error processing channel ${chUrl}:`, channelError.message);
                continue;
            }
        }
        await client.disconnect();
    } catch (error) {
        console.log(JSON.stringify({ error: error.message }));
        process.exit(1);
    }
    console.log(JSON.stringify(result, null, 0));
}

main().catch(error => {
    console.log(JSON.stringify({ error: error.message }));
    process.exit(1);
});