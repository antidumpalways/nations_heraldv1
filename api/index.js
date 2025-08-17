require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

// Store for scraped data
let scrapedChannelData = [];
let lastScrapeTime = null;
let scrapeStatus = 'idle'; // idle, running, success, error

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

// Function to run channel scraper
function runChannelScraper() {
  return new Promise((resolve, reject) => {
    console.log('Starting channel scraper...');
    scrapeStatus = 'running';
    
    const scraperPath = path.join(__dirname, '../python_services', 'channel_scraper.js');
    const scraperProcess = spawn('node', [scraperPath], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutData = '';
    let stderrData = '';

    // Collect stdout data (should only be JSON)
    scraperProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    // Collect stderr data (debug/error messages)
    scraperProcess.stderr.on('data', (data) => {
      const message = data.toString();
      console.log('[SCRAPER DEBUG]', message.trim());
      stderrData += message;
    });

    scraperProcess.on('close', (code) => {
      console.log(`[SCRAPER PROCESS EXITED] code: ${code}`);
      
      if (code !== 0) {
        scrapeStatus = 'error';
        console.error('Scraper process failed with code:', code);
        console.error('Stderr output:', stderrData);
        reject(new Error(`Scraper process exited with code ${code}`));
        return;
      }

      // Handle empty output
      if (!stdoutData.trim()) {
        scrapeStatus = 'error';
        console.error('No data from scraper (possibly empty TG_SESSION or other error)');
        reject(new Error('No data received from scraper'));
        return;
      }

      // Parse JSON from stdout
      try {
        // Find JSON boundaries
        const jsonStart = stdoutData.indexOf('[');
        const jsonEnd = stdoutData.lastIndexOf(']') + 1;
        
        if (jsonStart === -1 || jsonEnd === 0) {
          // Try to find error object
          const errorStart = stdoutData.indexOf('{');
          const errorEnd = stdoutData.lastIndexOf('}') + 1;
          
          if (errorStart !== -1 && errorEnd !== 0) {
            const errorString = stdoutData.slice(errorStart, errorEnd);
            const errorObj = JSON.parse(errorString);
            if (errorObj.error) {
              scrapeStatus = 'error';
              console.error('[SCRAPER ERROR]:', errorObj.error);
              reject(new Error(errorObj.error));
              return;
            }
          }
          
          throw new Error('No valid JSON found in output');
        }
        
        const jsonString = stdoutData.slice(jsonStart, jsonEnd);
        const result = JSON.parse(jsonString);
        
        if (!Array.isArray(result)) {
          throw new Error(`Expected array but got: ${typeof result}`);
        }
        
        // Store the scraped data
        scrapedChannelData = result;
        lastScrapeTime = new Date();
        scrapeStatus = 'success';
        
        console.log(`Successfully scraped ${result.length} messages`);
        
        // Display table for debugging
        if (result.length > 0) {
          console.table(result.slice(0, 10), ['category', 'description', 'url', 'date']); // Show first 10
          if (result.length > 10) {
            console.log(`... and ${result.length - 10} more messages`);
          }
        }
        
        // Simpan hasil scraping ke file JSON utama
        fs.writeFileSync(
          path.join(__dirname, '../data', 'daily_briefing.json'),
          JSON.stringify(result, null, 2)
        );
        
        resolve(result);
        
      } catch (parseError) {
        scrapeStatus = 'error';
        console.error('Failed to parse scraper output:', parseError.message);
        console.error('Raw stdout (first 500 chars):', stdoutData.substring(0, 500));
        
        // Try to find error messages in stderr
        try {
          const lines = stderrData.split('\n');
          for (const line of lines) {
            if (line.trim().startsWith('{') && line.includes('error')) {
              const errorObj = JSON.parse(line.trim());
              console.error('[SCRAPER ERROR FROM STDERR]:', errorObj.error);
              reject(new Error(`Scraper error: ${errorObj.error}`));
              return;
            }
          }
        } catch (stderrParseError) {
          // Ignore stderr parse errors
        }
        
        reject(new Error(`JSON parse failed: ${parseError.message}`));
      }
    });

    scraperProcess.on('error', (error) => {
      scrapeStatus = 'error';
      console.error('Scraper process error:', error);
      reject(error);
    });
  });
}

// Main route
app.get('/', (req, res) => {
  const dataPath = path.join(__dirname, '../data', 'daily_briefing.json');
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
    capitalize,
    // Add scraper data to the template
    scrapedData: scrapedChannelData,
    lastScrapeTime: lastScrapeTime,
    scrapeStatus: scrapeStatus
  });
});

// API endpoints for scraper data
app.get('/api/scrape', async (req, res) => {
  if (scrapeStatus === 'running') {
    return res.json({
      success: false,
      message: 'Scraping already in progress',
      status: scrapeStatus
    });
  }
  
  try {
    const data = await runChannelScraper();
    res.json({
      success: true,
      data: data,
      count: data.length,
      lastScrapeTime: lastScrapeTime,
      status: scrapeStatus
    });
  } catch (error) {
    console.error('Manual scrape failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      status: scrapeStatus
    });
  }
});

app.get('/api/channel-data', (req, res) => {
  res.json({
    success: true,
    data: scrapedChannelData,
    count: scrapedChannelData.length,
    lastScrapeTime: lastScrapeTime,
    status: scrapeStatus
  });
});

app.get('/api/scraper-status', (req, res) => {
  res.json({
    status: scrapeStatus,
    lastScrapeTime: lastScrapeTime,
    messageCount: scrapedChannelData.length,
    hasData: scrapedChannelData.length > 0
  });
});

// Start server (for local dev only)
if (process.env.VERCEL === undefined) {
  app.listen(PORT, () => {
    console.log(`The Nation's Herald running at http://localhost:${PORT}`);
    setTimeout(async () => {
      console.log('Running initial channel scrape...');
      try {
        await runChannelScraper();
        console.log('Initial scrape completed successfully');
      } catch (error) {
        console.error('Initial scrape failed:', error.message);
        console.log('Server will continue running. You can trigger scraping manually via /api/scrape');
      }
    }, 3000);
  });
}

module.exports = app;
