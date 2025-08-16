from telethon.sync import TelegramClient
from datetime import datetime
import json
import sys

api_id = 28373339
api_hash = '828b6c5fc274dc2753d8336dbf9bd756'

channels = [
    'https://t.me/c4dotgg',
    'https://t.me/crypto_gem_analytics',
    'https://t.me/drrdrops',
]

def get_last_n_days_msgs(messages, n_days=3):
    unique_dates = []
    for msg in messages:
        date_str = msg.date.strftime('%Y-%m-%d')
        if date_str not in unique_dates:
            unique_dates.append(date_str)
        if len(unique_dates) == n_days:
            break
    return [msg for msg in messages if msg.date.strftime('%Y-%m-%d') in unique_dates]

result = []
try:
    with TelegramClient('session_new', api_id, api_hash) as client:
        for ch_url in channels:
            channel = client.get_entity(ch_url)
            messages = client.get_messages(channel, limit=100)
            if not messages:
                continue
            last_msgs = get_last_n_days_msgs(messages, n_days=3)
            for msg in last_msgs:
                result.append({
                    "channel": channel.title,
                    "id": msg.id,
                    "date": msg.date.strftime('%Y-%m-%d %H:%M:%S'),
                    "text": msg.text,
                    "media": type(msg.media).__name__ if msg.media else None
                })
except Exception as e:
    print(json.dumps({"error": str(e)}))
    exit(1)

# Pastikan output ke stdout pakai UTF-8
sys.stdout.reconfigure(encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))