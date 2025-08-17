const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');

const apiId = 28373339; // Ganti jika Anda punya API ID sendiri
const apiHash = '828b6c5fc274dc2753d8336dbf9bd756'; // Ganti jika Anda punya API Hash sendiri

(async () => {
  const stringSession = new StringSession('');
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: async () => '+6287866388637',
    password: async () => await input.text('Password: '),
    phoneCode: async () => await input.text('Code: '),
    onError: (err) => console.log(err),
  });
  console.log('Session string:', client.session.save());
  await client.disconnect();
})();
