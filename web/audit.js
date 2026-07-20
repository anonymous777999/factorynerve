const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const baseURL = 'http://127.0.0.1:3000';

  // Read routes from file
  const routesFile = './routes.txt';
  const routes = fs.readFileSync(routesFile, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean);

  const screenshotsDir = path.join(process.cwd(), 'audit-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const logFile = path.join(screenshotsDir, 'console-errors.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  for (const route of routes) {
    let pathname = route
      .replace(/\(private\)|\(public\)|\(workflow\)|\(system\)/g, '')
      .replace(/\[[^\]]+\]/g, '1'); // replace dynamic param with 1
    // Ensure leading slash
    if (!pathname.startsWith('/')) pathname = '/' + pathname;
    const url = baseURL + pathname;

    console.log(`Visiting ${url}`);

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(500); // allow any animations
      const desktopShot = path.join(screenshotsDir, `${pathname.replace(/\//g, '_')}_desktop.png`);
      await page.screenshot({ path: desktopShot, fullPage: true });

      // Mobile viewport
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(500);
      const mobileShot = path.join(screenshotsDir, `${pathname.replace(/\//g, '_')}_mobile.png`);
      await page.screenshot({ path: mobileShot, fullPage: true });

      // Collect console errors
      const messages = [];
      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          messages.push(`${msg.type()}: ${msg.text()}`);
        }
      });
      // Give a moment to capture any console messages after load
      await page.waitForTimeout(1000);
      if (messages.length > 0) {
        logStream.write(`[${url}]\n`);
        messages.forEach(m => logStream.write(`  ${m}\n`));
        logStream.write('\n');
      }
    } catch (err) {
      console.error(`Failed to process ${url}: ${err}`);
      logStream.write(`[${url}] ERROR: ${err.message}\n\n`);
    }
  }

  logStream.end();
  await browser.close();
  console.log('Audit complete.');
})();
