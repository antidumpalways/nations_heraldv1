const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
require('dotenv').config();

const PYTHON_PATH = path.join(__dirname, 'python_services', 'channel_scraper.py');
const OUTPUT_PATH = path.join(__dirname, 'data', 'daily_briefing.json');

async function runDataProcessingPipeline() {
  // 1. Jalankan Python Scraper
  const rawData = await new Promise((resolve, reject) => {
    const py = spawn('python', [PYTHON_PATH]);
    let data = '';
    let error = '';
    py.stdout.on('data', (chunk) => {
      data += chunk.toString();
    });
    py.stderr.on('data', (chunk) => {
      error += chunk.toString();
    });
    py.on('close', (code) => {
      if (code !== 0) {
        reject(new Error('Python process exited with code ' + code + '\n' + error));
      } else {
        try {
          // Asumsi output Python adalah JSON string
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse Python output as JSON: ' + e + '\nOutput: ' + data));
        }
      }
    });
  });

  // 2. Kirim ke Nation Agent API
  const promptString = `\nYou are The Purifier, a data processing agent. Your task is to clean, deduplicate, and standardize the following raw text data from multiple Telegram channels.\n\nRAW DATA DUMP:\n---\n${JSON.stringify(rawData)}\n---\n\nNow, execute these steps:\n1. Identify and merge duplicate posts.\n2. Standardize the format. Extract: Project Name, Category (Launch, News, Update), Description, URL.\n3. Identify and flag promotional content with a 'promo: true' field.\n4. Output the result ONLY as a clean, minified JSON array. Do not add any other text or explanation.\n`;

  const nationResponse = await axios.post(
    `${process.env.NATION_BASE_URL}/v1/chat/completions`,
    {
      model: 'agent',
      messages: [
        {
          role: 'user',
          content: promptString,
        },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NATION_API_KEY}`,
      },
    }
  );

  let cleanData;
  try {
    cleanData = JSON.parse(nationResponse.data.choices[0].message.content);
  } catch (e) {
    throw new Error('Nation API did not return valid JSON: ' + e + '\n' + nationResponse.data.choices[0].message.content);
  }

  // 3. Ganti promo: true dengan iklan Nation Fun
  const nationFunAd = {
    project: 'Nation Fun',
    category: 'Promo',
    description: 'Discover more at Nation Fun!',
    url: 'https://nation.fun',
    promo: true,
  };
  const finalData = cleanData.map(item => item.promo ? nationFunAd : item);

  // 4. Simpan ke daily_briefing.json
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));
  console.log('Data pipeline selesai. Hasil disimpan di', OUTPUT_PATH);
}

// Jalankan pipeline jika file ini dieksekusi langsung
if (require.main === module) {
  runDataProcessingPipeline().catch(err => {
    console.error('Pipeline error:', err);
    process.exit(1);
  });
}

// === CRON JOB: Jalankan pipeline setiap hari jam 01:00 ===
cron.schedule('0 1 * * *', () => {
  console.log('Menjalankan daily scrape otomatis...');
  runDataProcessingPipeline().catch(err => {
    console.error('Pipeline error (cron):', err);
  });
});

module.exports = { runDataProcessingPipeline };
