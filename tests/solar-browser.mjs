import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { observationTime, ephemerisFixture, feedFixture } from './solar-fixtures.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), base = 'http://127.0.0.1:5177', output = path.join(root, 'work/solar');
let browser, server; const errors = [];
try {
  await mkdir(output, { recursive: true });
  let reachable = false; try { reachable = (await fetch(base)).ok; } catch {}
  if (!reachable) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { cwd: root, stdio: 'pipe' });
    let log = ''; server.stdout.on('data', data => { log += data; }); server.stderr.on('data', data => { log += data; });
    for (let i = 0; i < 80; i++) { if (server.exitCode !== null) throw Error(log); try { if ((await fetch(base)).ok) { reachable = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
    assert.ok(reachable);
  }
  browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const config of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'phone', width: 390, height: 844, touch: true }, { name: 'landscape', width: 844, height: 390, touch: true }, { name: 'folded', width: 344, height: 882, touch: true }, { name: 'tablet', width: 1024, height: 768, touch: true }]) {
    const context = await browser.newContext({ viewport: config, hasTouch: !!config.touch, isMobile: !!config.touch });
    await context.addInitScript(at => { Date.now = () => at; localStorage.setItem('cosmic-fusion-settings', JSON.stringify({ quality: 'balanced' })); }, observationTime);
    const page = await context.newPage(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(`${config.name}: ${error.message}`));
    let failImages = false, calls = 0;
    await page.route('**/api/solar?*', async route => {
      calls++; const params = new URL(route.request().url()).searchParams, feed = params.get('feed'), body = params.get('body');
      let value;
      if (feed === 'ephemeris') value = ephemerisFixture;
      if (feed === 'images') value = feedFixture(feed, [{ id: 'test', title: `${body} mission terrain <script>window.injected=true</script>`, date: '2020-01-01', credit: 'NASA/JPL test attribution', description: 'Processed mission image', image: 'https://images-assets.nasa.gov/test.jpg', source: 'https://images.nasa.gov/details/test' }], body);
      if (feed === 'mars') value = feedFixture(feed, [{ date: '2026-08-25', sol: 4995, minC: -71, maxC: -5, groundMinC: -84, pressurePa: 777, windMS: null, conditions: 'Sunny' }]);
      if (feed === 'earth') value = feedFixture(feed, { observations: [{ station: 'KJFK', name: 'New York', at: '2026-10-06T11:30:00Z', temperatureC: 14, windKmH: 15, pressurePa: 101500, humidity: null, description: 'Cloudy', source: 'https://api.weather.gov/stations/KJFK/observations/latest' }] });
      if (feed === 'clouds') value = feedFixture(feed, [{ date: '2026-09-28T00:50:27Z', image: 'https://epic.gsfc.nasa.gov/test.jpg' }]);
      await route.fulfill({ status: failImages && feed === 'images' ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failImages && feed === 'images' ? { error: 'Unavailable' } : value) });
    });
    for (const host of ['images-assets.nasa.gov', 'epic.gsfc.nasa.gov']) await page.route(`https://${host}/**`, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="#b38154"/></svg>' }));
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.__COSMIC__?.app?.universe.ephemeris);
    if (await page.locator('[data-touch-action="portrait"]').isVisible()) await page.locator('[data-touch-action="portrait"]').tap();
    const state = await page.evaluate(() => { const a = window.__COSMIC__.app; return { date: a.clock.date.getTime(), earth: a.universe.getBody('earth').ephemeris.position, asteroids: a.universe.catalogue.bodies.filter(b => b.mesh.visible).length, speed: a.clock.speed, selected: a.selectedId }; });
    assert.equal(state.date, observationTime); assert.equal(state.speed, .1); assert.equal(state.selected, null); assert.equal(state.asteroids, 5); assert.ok(state.earth[0] > .9 && state.earth[1] > .1);
    assert.equal(calls, 1, 'Imagery and weather load on demand');
    const live = page.locator('[data-action="live-now"]');
    assert.equal(await page.locator('#time-speed').inputValue(), 'live');
    await page.locator('#time-speed').selectOption('0.1'); assert.equal(await page.evaluate(() => window.__COSMIC__.app.livePositions), false);
    await page.locator('#time-speed').selectOption('10'); await page.waitForFunction(at => window.__COSMIC__.app.clock.date.getTime() > at, observationTime);
    await page.locator('[data-action="pause"]').click(); const stopped = await page.evaluate(() => window.__COSMIC__.app.clock.date.getTime()); await page.waitForTimeout(180); assert.equal(await page.evaluate(() => window.__COSMIC__.app.clock.date.getTime()), stopped);
    await live.click(); assert.equal(await page.evaluate(() => window.__COSMIC__.app.livePositions), true);
    const bounds = await live.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= config.width, 'Live button fits every screen');
    async function select(id) {
      if (config.touch) await page.locator('[data-touch-action="worlds"]').click();
      await page.locator(`.body-button[data-body="${id}"]`).click();
      if (config.touch) await page.locator('[data-touch-action="details"]').click();
      await page.locator('[data-action="planet-observations"]').click(); await page.locator('#planet-observations').waitFor({ state: 'visible' });
    }
    const dialog = page.locator('#planet-observations');
    const bodies = config.name === 'desktop' ? ['earth', 'mars', 'mercury', 'venus', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun', 'ceres'] : ['earth', 'mars'];
    for (const id of bodies) {
      await select(id); assert.match(await dialog.locator('#observation-position').textContent(), /NASA JPL Horizons/);
      await dialog.locator('[data-observation-tab="weather"]').click(); await page.waitForFunction(() => !document.querySelector('#observation-weather').hasAttribute('aria-busy'));
      const weather = await dialog.locator('#observation-weather').textContent();
      if (id === 'earth') { assert.match(weather, /14 °C/); assert.match(weather, /Sep 28, 2026/); assert.match(weather, /Unavailable/); }
      else if (id === 'mars') { assert.match(weather, /Historical reading/); assert.match(weather, /777/); assert.match(weather, /Unavailable/); }
      else if (id !== 'sun') assert.match(weather, /No public live weather/);
      await dialog.locator('[data-observation-tab="images"]').click(); await page.waitForFunction(() => !document.querySelector('#observation-images').hasAttribute('aria-busy'));
      if (id !== 'ceres') { assert.match(await dialog.locator('#observation-images').textContent(), /NASA\/JPL test attribution/); assert.match(await dialog.locator('#observation-images').textContent(), /2020/); }
      assert.equal(await page.evaluate(() => window.injected), undefined);
      const dimensions = await dialog.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
      assert.ok(dimensions.scroll <= dimensions.width + 1 && dimensions.left >= 0 && dimensions.right <= config.width, `${config.name} must fit: ${JSON.stringify(dimensions)}`);
      if (id === 'mars') await page.screenshot({ path: path.join(output, `${config.name}-mars.png`) });
      await dialog.locator('[data-observation-action="close"]').click();
    }
    if (config.name === 'desktop') {
      failImages = true; await page.evaluate(() => window.__COSMIC__.app.solarData.values.clear()); await select('venus'); await dialog.locator('[data-observation-tab="images"]').click(); await dialog.locator('.nasa-error').waitFor(); await dialog.locator('[data-observation-tab="position"]').click(); assert.match(await dialog.locator('#observation-position').textContent(), /NASA JPL/); await page.keyboard.press('Escape');
      await page.locator('.body-button[data-body="ceres"]').click(); await page.locator('[data-action="autopilot"]').click(); await page.waitForFunction(() => window.__COSMIC__.app.flight._telemetry.arrived);
      const hold = await page.evaluate(() => { const a = window.__COSMIC__.app; return { days: a.clock.days, position: a.selectedBody.position.toArray(), speed: a.flight.velocity.length() }; });
      await page.waitForTimeout(150); assert.deepEqual(await page.evaluate(() => window.__COSMIC__.app.selectedBody.position.toArray()), hold.position); assert.ok(hold.speed < .1);
      await page.locator('[data-action="planet-observations"]').click(); await page.keyboard.down('w'); assert.equal(await page.evaluate(() => window.__COSMIC__.app.flight.inputs.size), 0); await page.keyboard.up('w'); await page.keyboard.press('Escape'); await page.locator('[data-action="explore"]').click();
    }
    console.log(`${config.name}: JPL positions, clock controls, weather, imagery and dialog layout passed`); await context.close();
  }
  assert.deepEqual(errors, []); console.log('Solar observation browser checks passed.');
} finally { await browser?.close(); server?.kill('SIGTERM'); }
