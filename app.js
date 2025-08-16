const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Capitalize first letter
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper: Group by category, skip 'Promo'
function groupByCategory(briefings) {
  const grouped = {};
  for (const item of briefings) {
    const cat = item.category ? capitalize(item.category) : 'Other';
    if (cat.toLowerCase() === 'promo') continue; // skip promo
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  return grouped;
}

app.get('/', (req, res) => {
  const dataPath = path.join(__dirname, 'data', 'daily_briefing.json');
  let briefings = [];
  try {
    briefings = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } catch (e) {
    briefings = [];
  }
  const groupedBriefings = groupByCategory(briefings);
  res.render('index', {
    title: "The Nation's Herald",
    description: "The official daily intelligence briefing for the crypto ecosystem. The Nation's Herald is an autonomous agent that uses a hybrid intelligence model. It combines its internal skills with custom data services to gather, clean, and synthesize market-moving news, project updates, and emerging trends into a single, curated daily report.",
    groupedBriefings,
    capitalize
  });
});

// Jalankan channel_scraper.js (Node.js) saat server start
const scraperProcess = spawn('node', [path.join(__dirname, 'python_services', 'channel_scraper.js')], {
  stdio: ['inherit', 'pipe', 'pipe']
});

let scraperData = '';
scraperProcess.stdout.on('data', (data) => {
  scraperData += data.toString();
});

scraperProcess.stderr.on('data', (data) => {
  console.error(`[SCRAPER ERROR]: ${data}`);
});

scraperProcess.on('close', (code) => {
  try {
    const result = JSON.parse(scraperData);
    console.table(result, ['channel', 'id', 'date', 'text', 'media']);
  } catch (e) {
    console.error('Gagal parsing data dari channel_scraper.js:', e);
  }
  console.log(`[SCRAPER PROCESS EXITED] code: ${code}`);
});

app.listen(PORT, () => {
  console.log(`The Nation's Herald running at http://localhost:${PORT}`);
});
