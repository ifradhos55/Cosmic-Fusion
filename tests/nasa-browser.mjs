import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env.NASA_BASE_URL || 'http://127.0.0.1:5175';
const output = path.join(root, 'work/nasa');
const { chromium } = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH, 'index.mjs')).href) : await import('playwright');
const now = Date.now(), day = value => new Date(value).toISOString().slice(0, 10);
const payload = (feed, data) => ({ feed, fetchedAt: new Date(now).toISOString(), nextRefreshAt: new Date(now + 3_600_000).toISOString(),
  stale: false, demo: feed === 'asteroids', source: 'https://science.nasa.gov/', window: { start: day(now), end: day(now + 6 * 86_400_000) }, data });
const fixtures = {
  apod: payload('apod', { date: day(now), title: 'A galaxy <script>window.injected=true</script>', alt: 'Test galaxy',
    image: 'https://assets.science.nasa.gov/nasa-test.jpg', mediaType: 'image', credit: 'Test photographer',
    explanation: 'Test explanation <img src=x onerror="window.injected=true">', source: 'https://science.nasa.gov/apod/' }),
  weather: payload('weather', { total: 1, reports: [{ id: 'test', type: 'FLR', at: new Date(now - 3600_000).toISOString(),
    body: 'Test solar flare report', source: 'https://ccmc.gsfc.nasa.gov/DONKI/' }] }),
  asteroids: payload('asteroids', { total: 4, approaches: Array.from({ length: 4 }, (_, i) => ({ id: String(i), name: `(Test asteroid ${i + 1})`,
    at: new Date(now + (i + 1) * 86_400_000).toISOString(), diameterMin: 10, diameterMax: 30, speedKmS: 12.5,
    distanceKm: 768800, lunarDistances: 2, hazardous: i === 0, source: 'https://ssd.jpl.nasa.gov/' })) }),
};
let server, browser;
const errors = [];
try {
  await mkdir(output, { recursive: true });
  let reachable = false;
  try { reachable = (await fetch(baseURL, { signal: AbortSignal.timeout(1000) })).ok; } catch { /* Start below. */ }
  if (!reachable) {
    const url = new URL(baseURL);
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('External server unavailable');
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', url.hostname, '--port', url.port, '--strictPort'], { cwd: root, stdio: 'pipe' });
    let log = '';
    server.stdout.on('data', value => { log += value; }); server.stderr.on('data', value => { log += value; });
    for (let attempt = 0; attempt < 80; attempt++) {
      if (server.exitCode !== null) throw new Error(log);
      try { if ((await fetch(baseURL)).ok) { reachable = true; break; } } catch { /* Starting. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(reachable, 'Vite must start');
  }
  browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const configurations = [
    { name: 'desktop', width: 1440, height: 1000, touch: false },
    { name: 'phone-portrait', width: 390, height: 844, touch: true },
    { name: 'phone-landscape', width: 844, height: 390, touch: true },
    { name: 'folded', width: 344, height: 882, touch: true },
    { name: 'tablet', width: 1024, height: 768, touch: true },
  ];
  for (const config of configurations) {
    const context = await browser.newContext({ viewport: { width: config.width, height: config.height }, hasTouch: config.touch, isMobile: config.touch });
    await context.addInitScript(() => localStorage.setItem('cosmic-fusion-settings', JSON.stringify({ quality: 'balanced' })));
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on('pageerror', error => errors.push(`${config.name}: ${error.message}`));
    let requests = 0, failWeather = false, pendingWeather = false;
    await page.route('**/api/nasa?*', async route => {
      requests++;
      const feed = new URL(route.request().url()).searchParams.get('feed');
      if (feed === 'weather' && pendingWeather) await new Promise(resolve => setTimeout(resolve, 1500));
      await route.fulfill({ status: failWeather && feed === 'weather' ? 503 : 200, contentType: 'application/json',
        body: JSON.stringify(failWeather && feed === 'weather' ? { error: 'NASA is temporarily unavailable.' } : fixtures[feed]) }).catch(() => {});
    });
    await page.route('https://assets.science.nasa.gov/**', route => route.fulfill({ contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#081220"/><ellipse cx="400" cy="250" rx="220" ry="80" fill="#c5b6da"/><ellipse cx="400" cy="250" rx="150" ry="28" fill="#e5dccb"/></svg>' }));
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__COSMIC__?.app?.nasa);
    const portrait = page.locator('[data-touch-action="portrait"]');
    if (await portrait.isVisible()) await portrait.tap();
    assert.equal(requests, 0, 'Opening the simulation must not spend NASA quota');
    const launch = page.locator('[data-action="nasa"]:visible').first();
    if (config.touch) await launch.tap(); else await launch.click();
    const dialog = page.locator('#nasa-panel');
    await dialog.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.nasa-summary').textContent.startsWith('Feeds checked'));
    assert.equal(requests, 3);
    assert.equal(await page.evaluate(() => window.injected), undefined, 'Upstream text must never execute');
    assert.equal(await dialog.locator('script').count(), 0);
    assert.match(await dialog.locator('.nasa-asteroids').textContent(), /768,800 km/);
    assert.match(await dialog.locator('.nasa-asteroids').textContent(), /12.5 km\/s/);
    assert.match(await dialog.locator('.nasa-apod').textContent(), /Test photographer/);
    assert.match(await dialog.locator('.nasa-weather').textContent(), /Solar flare/);
    const overflow = await dialog.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
    assert.ok(overflow.scroll <= overflow.width + 1, `No horizontal overflow: ${JSON.stringify(overflow)}`);
    assert.ok(overflow.left >= 0 && overflow.right <= config.width, 'Dialog must fit the screen');
    await dialog.locator('.nasa-article summary').click();
    assert.equal(await page.evaluate(() => window.injected), undefined);
    const report = dialog.locator('.nasa-report summary');
    await report.click();
    assert.match(await dialog.locator('.nasa-report[open]').textContent(), /Test solar flare report/);
    await dialog.evaluate(el => { el.scrollTop = 180; });
    assert.ok(await dialog.evaluate(el => el.scrollTop > 0), 'NASA panel must scroll independently');
    await page.screenshot({ path: path.join(output, `${config.name}.png`) });
    await dialog.locator('[data-nasa-action="close"]').click();
    await dialog.waitFor({ state: 'hidden' });
    await launch.click();
    assert.equal(requests, 3, 'Reopening uses the client cache');
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });

    if (!config.touch) {
      pendingWeather = true;
      await launch.click();
      await dialog.locator('[data-nasa-action="refresh"]').click();
      await dialog.locator('[data-nasa-action="close"]').click();
      await page.waitForFunction(() => window.__COSMIC__.app.nasa.pending.size === 0);
      await launch.click();
      assert.equal(await dialog.locator('[aria-busy="true"]').count(), 0, 'Closing a refresh must clear loading states before cached results reopen');
      await page.keyboard.press('Escape');
      pendingWeather = false;
      await page.locator('[data-action="flight"]:visible').click();
      await launch.click();
      await page.keyboard.down('w');
      assert.equal(await page.evaluate(() => window.__COSMIC__.app.flight.inputs.size), 0, 'Dialog typing must not thrust the ship');
      await page.keyboard.up('w');
      failWeather = true;
      await dialog.locator('[data-nasa-action="refresh"]').click();
      await page.waitForFunction(() => document.querySelector('.nasa-summary').textContent.startsWith('Some feeds'));
      assert.match(await dialog.locator('.nasa-weather').textContent(), /last successful update/);
      assert.match(await dialog.locator('.nasa-apod').textContent(), /Latest available/);
      assert.equal(await dialog.locator('.nasa-weather [data-nasa-action="retry"]').isDisabled(), true);
      await page.keyboard.press('Escape');
      await page.locator('[data-action="explore"]:visible').click();
      // A fresh panel with no saved data must show the failed feed without blocking the others.
      await page.evaluate(() => { const panel = window.__COSMIC__.app.nasa; panel.values.clear(); panel.retry.clear(); });
      await launch.click();
      await page.waitForFunction(() => document.querySelector('.nasa-weather .nasa-status').textContent === 'Unavailable');
      assert.match(await dialog.locator('.nasa-asteroids').textContent(), /Test asteroid/);
      await page.keyboard.press('Escape');
      pendingWeather = true; failWeather = false;
      await page.evaluate(() => { const panel = window.__COSMIC__.app.nasa; panel.values.clear(); panel.retry.clear(); });
      await launch.click();
      await dialog.locator('[data-nasa-action="close"]').click();
      await page.waitForFunction(() => window.__COSMIC__.app.nasa.pending.size === 0);
    }
    console.log(`NASA panel passed: ${config.name}`);
    await context.close();
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors');
} finally {
  await browser?.close(); server?.kill('SIGTERM');
}
