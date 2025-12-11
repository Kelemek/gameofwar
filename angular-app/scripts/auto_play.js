const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const url = 'http://127.0.0.1:63899/';
  const outDir = path.resolve(__dirname, '..', 'logs');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const logFile = path.join(outDir, 'console.log');
  const jsonFile = path.join(outDir, 'console.json');

  const logs = [];

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 150,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', async msg => {
    try {
      const args = await Promise.all(msg.args().map(a => a.jsonValue()));
      const text = msg.text();
      const entry = { type: msg.type(), text, args, time: new Date().toISOString() };
      logs.push(entry);
      fs.appendFileSync(logFile, `[${entry.time}] ${entry.type}: ${entry.text}\n`);
    } catch (e) {
      // fallback
      const entry = { type: msg.type(), text: msg.text(), time: new Date().toISOString() };
      logs.push(entry);
      fs.appendFileSync(logFile, `[${entry.time}] ${entry.type}: ${entry.text}\n`);
    }
  });

  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // small helper sleep because some Puppeteer builds may not have page.waitForTimeout
  const sleep = ms => new Promise(res => setTimeout(res, ms));

  // Click New Game if present
  try {
    await page.waitForSelector('.top button', { timeout: 5000 });
    await page.click('.top button');
    console.log('Clicked New Game');
    // give the app a little more time to fetch and populate decks
    await sleep(2000);
  } catch (e) {
    console.warn('New Game button not found:', e.message);
  }

  // log failed network requests for debugging
  page.on('requestfailed', req => {
    const msg = `[REQUEST FAILED] ${req.url()} - ${req.failure() ? req.failure().errorText : 'unknown'}`;
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  });

  // Wait for draw button
  await page.waitForSelector('.controls .draw', { timeout: 15000 });

  const maxClicks = 1200;
  let clicks = 0;

  for (; clicks < maxClicks; clicks++) {
    // Read deck counts
    const counts = await page.evaluate(() => {
      const player = document.querySelector('.captured.player .count');
      const comp = document.querySelector('.captured.computer .count');
      return {
        player: player ? parseInt(player.textContent || '0') : null,
        computer: comp ? parseInt(comp.textContent || '0') : null,
      };
    });

    fs.appendFileSync(logFile, `[${new Date().toISOString()}] STEP ${clicks}: counts=${JSON.stringify(counts)}\n`);

    // If either side has 0 cards, stop
    if (counts.player === 0 || counts.computer === 0) {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] STOP: deck depleted player=${counts.player} computer=${counts.computer}\n`);
      break;
    }

    // Click draw/next
    const disabled = await page.$eval('.controls .draw', btn => btn.disabled);
    if (disabled) {
      fs.appendFileSync(logFile, `[${new Date().toISOString()}] DRAW button disabled, stopping.\n`);
      break;
    }

    await page.click('.controls .draw');

    // Wait a safe time for animations and war steps to complete
    await sleep(900);
  }

  // Save the JSON logs
  fs.writeFileSync(jsonFile, JSON.stringify(logs, null, 2));

  // Save a final screenshot
  const screenshot = path.join(outDir, 'final.png');
  await page.screenshot({ path: screenshot, fullPage: true });

  console.log('Done. Clicks:', clicks, 'logs saved to', outDir);
  await browser.close();
})();
