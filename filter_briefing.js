const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

function copyBriefing() {
  const dataPath = path.join(__dirname, 'data', 'daily_briefing.json');
  const outputPath = path.join(__dirname, 'data', 'filtered_briefing.json');
  const data = fs.readFileSync(dataPath, 'utf-8');
  fs.writeFileSync(outputPath, data);
  console.log('Copied all data to filtered_briefing.json');
}

// Jalankan copy sekali saat script dijalankan
copyBriefing();

// === CRON JOB: Jalankan copy sekali sehari pada jam 01:00 ===
cron.schedule('0 1 * * *', () => {
  console.log('Menyalin briefing harian...');
  copyBriefing();
});
