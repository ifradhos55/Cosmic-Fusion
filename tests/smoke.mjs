import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseURL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const outputDirectory = path.resolve(projectRoot, process.env.SMOKE_OUTPUT_DIR || 'work/smoke');
const playwright = process.env.PLAYWRIGHT_MODULE_PATH
  ? await import(pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE_PATH, 'index.mjs')).href)
  : await import('playwright');

let server;
let browser;
const problems = [];

function observePage(page) {
  page.on('pageerror', error => problems.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(baseURL)) {
      problems.push(`${response.status()} ${response.url()}`);
    }
  });
}

async function reachable() {
  try {
    return (await fetch(baseURL, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await reachable()) return;
  const url = new URL(baseURL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error(`No server is responding at ${baseURL}`);
  }
  const vite = path.join(projectRoot, 'node_modules/vite/bin/vite.js');
  server = spawn(process.execPath, [vite, '--host', url.hostname, '--port', url.port || '5173', '--strictPort'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', data => { output += data; });
  server.stderr.on('data', data => { output += data; });
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite failed to start:\n${output}`);
    if (await reachable()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out starting Vite:\n${output}`);
}

async function assertRenderedScene(page) {
  const sample = await page.evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2');
      if (!gl || gl.isContextLost()) return resolve({ valid: false });
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let illuminated = 0;
      let minimum = 255;
      let maximum = 0;
      for (let index = 0; index < pixels.length; index += 16) {
        const luminance = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
        minimum = Math.min(minimum, luminance);
        maximum = Math.max(maximum, luminance);
        if (luminance > 28) illuminated++;
      }
      resolve({ valid: true, width, height, illuminated, minimum, maximum });
    });
  }));
  assert.equal(sample.valid, true, 'The scene must have a live WebGL2 context');
  assert.ok(sample.width > 200 && sample.height > 200, 'The rendering surface must cover the viewport');
  assert.ok(sample.illuminated > 20, `The GPU must draw visible scene content: ${JSON.stringify(sample)}`);
  assert.ok(sample.maximum - sample.minimum > 30, `The scene must contain contrast, not a blank canvas: ${JSON.stringify(sample)}`);
  return sample;
}

try {
  await mkdir(outputDirectory, { recursive: true });
  await startServer();
  browser = await playwright.chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  observePage(page);
  page.setDefaultTimeout(15000);
  // The simulation loads large local texture maps progressively. DOM readiness
  // is the useful boundary here; the explicit canvas and render checks below
  // prove that the WebGL surface is actually alive.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForTimeout(1000);
  const rendering = await assertRenderedScene(page);

  await page.waitForFunction(() => window.__COSMIC__?.app && document.body.dataset.mode === 'explore');
  assert.equal(await page.evaluate(() => window.__COSMIC__.app.selectedBody), null, 'The initial scene should open as an overview without a selected planet');
  assert.equal(await page.locator('.body-button.active').count(), 0, 'No planet should be marked active on first load');
  assert.match(await page.locator('#body-title').textContent(), /Our solar/i);
  await page.locator('[data-action="galaxy"]').first().click();
  await page.waitForFunction(() => document.body.dataset.view === 'galaxy' && window.__COSMIC__.app.galaxy.group.visible);
  assert.match(await page.locator('#body-title').textContent(), /Milky\s*Way/);
  await page.locator('[data-action="explore"]').first().click();
  await page.waitForFunction(() => document.body.dataset.view === 'solar' && window.__COSMIC__.app.universe.group.visible);
  await page.locator('[data-action="lock-orbit"]').click();
  assert.equal(await page.evaluate(() => window.__COSMIC__.app.cameraRig.controls.enabled), false, 'Lock orbit must disable orbital camera input');
  await page.locator('[data-action="lock-orbit"]').click();
  assert.equal(await page.evaluate(() => window.__COSMIC__.app.cameraRig.controls.enabled), true, 'Unlock orbit must restore orbital camera input');
  const initialDays = await page.evaluate(() => window.__COSMIC__.app.clock.days);
  await page.locator('[data-action="pause"]').click();
  await page.waitForFunction(() => window.__COSMIC__.app.clock.paused);
  const pausedDays = await page.evaluate(() => window.__COSMIC__.app.clock.days);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__COSMIC__.app.clock.days), pausedDays, 'Pause must stop simulation time');
  await page.locator('#time-speed').selectOption('10');
  assert.equal(await page.evaluate(() => window.__COSMIC__.app.clock.speed), 10);
  await page.locator('[data-action="pause"]').click();
  await page.waitForFunction(previousDays => window.__COSMIC__.app.clock.days > previousDays, pausedDays);
  assert.ok(pausedDays >= initialDays);

  await page.locator('[data-body="saturn"]').first().click();
  await page.waitForFunction(() => document.querySelector('#body-title')?.textContent.includes('Saturn'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputDirectory, 'saturn.png') });

  await page.locator('[data-action="flight"]').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'flight');
  await page.locator('#flight-speed').waitFor({ state: 'visible' });
  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  await page.keyboard.up('w');
  await page.waitForFunction(() => parseFloat(document.querySelector('#flight-speed').textContent.replace(/,/g, '')) > 0);
  await page.screenshot({ path: path.join(outputDirectory, 'flight.png') });
  await page.locator('[data-action="brake"]').click();
  await page.waitForFunction(() => window.__COSMIC__.app.flight.velocity.length() < 0.001);
  await page.locator('[data-action="view"]').click();
  await page.waitForFunction(() => window.__COSMIC__.app.flight.view === 'cockpit');
  await page.screenshot({ path: path.join(outputDirectory, 'cockpit.png') });
  await page.locator('[data-action="view"]').click();
  await page.waitForFunction(() => window.__COSMIC__.app.flight.view === 'chase');
  await page.locator('[data-action="autopilot"]').click();
  await page.waitForFunction(() => window.__COSMIC__.app.flight._telemetry.autopilot);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => document.body.dataset.mode), 'flight');
  await page.screenshot({ path: path.join(outputDirectory, 'autopilot.png') });
  await page.keyboard.press('a');
  await page.waitForFunction(() => !window.__COSMIC__.app.flight._telemetry.autopilot);
  await page.locator('[data-action="reset-flight"]').click();
  await page.waitForFunction(() => window.__COSMIC__.app.flight.velocity.length() < 0.001);
  await page.locator('[data-action="explore"]').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'explore');

  // Inner-planet regression: assisted journeys must settle outside Earth and
  // Mars instead of launching into an uncontrolled orbit.
  for (const destination of ['earth', 'mars']) {
    await page.locator(`[data-body="${destination}"]`).first().click();
    await page.locator('[data-action="autopilot"]').click();
    await page.waitForFunction(() => window.__COSMIC__.app.flight._telemetry.arrived, { timeout: 15000 });
    const approach = await page.evaluate(() => { const app = window.__COSMIC__.app; return { distance: app.flight._telemetry.distance, speed: app.flight._telemetry.speed, target: app.flight._telemetry.targetName }; });
    assert.ok(approach.distance > 0 && approach.speed < 0.1 && approach.target.toLowerCase() === destination, `${destination} autopilot should settle safely: ${JSON.stringify(approach)}`);
    await page.locator('[data-action="explore"]').click();
    await page.waitForFunction(() => document.body.dataset.mode === 'explore');
  }

  await page.locator('[data-action="help"]').click();
  await page.locator('#modal').waitFor({ state: 'visible' });
  await page.locator('[data-action="close-modal"]').click();
  await page.locator('#modal').waitFor({ state: 'hidden' });
  await page.locator('[data-action="overview"]').click();
  await page.waitForFunction(() => window.__COSMIC__.app.selectedBody === null);
  await page.locator('[data-action="flight"]').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'flight');
  assert.equal(await page.evaluate(() => window.__COSMIC__.app.selectedBody), null, 'Free flight should not silently target Earth');
  assert.match(await page.locator('#body-title').textContent(), /Free flight/i);
  assert.match(await page.locator('.scene-location').textContent(), /Free flight/i);
  await page.locator('[data-action="explore"]').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'explore');

  await page.screenshot({ path: path.join(outputDirectory, 'desktop.png') });
  // Release the first WebGL context before exercising the mobile viewport.
  // SwiftShader-backed Chrome can otherwise evict the second context on
  // machines with a low active-context budget.
  await page.close();
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  observePage(mobile);
  mobile.setDefaultTimeout(15000);
  mobile.setDefaultNavigationTimeout(60000);
  await mobile.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await mobile.locator('canvas').waitFor({ state: 'visible' });
  await mobile.waitForTimeout(1000);
  await assertRenderedScene(mobile);
  const layout = await mobile.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(layout.scrollWidth <= layout.width + 1, `Mobile layout must not overflow horizontally: ${JSON.stringify(layout)}`);
  await mobile.locator('#rotate-device').waitFor({ state: 'visible' });
  assert.match(await mobile.locator('#rotate-device').innerText(), /Rotate your device/i);
  await mobile.screenshot({ path: path.join(outputDirectory, 'mobile.png') });
  await mobile.setViewportSize({ width: 844, height: 390 });
  await mobile.waitForTimeout(300);
  assert.equal(await mobile.locator('#rotate-device').evaluate((element) => getComputedStyle(element).display), 'none', 'Rotate prompt should hide in landscape');
  await mobile.locator('[data-action="flight"]').click();
  await mobile.waitForFunction(() => document.body.dataset.mode === 'flight');
  await mobile.locator('#flight-speed').waitFor({ state: 'visible' });
  const canvas = mobile.locator('#scene canvas');
  await canvas.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 160, clientY: 170, bubbles: true });
  await mobile.locator('#virtual-joystick.active').waitFor({ state: 'visible' });
  await canvas.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', clientX: 220, clientY: 120, bubbles: true });
  await mobile.waitForFunction(() => window.__COSMIC__.app.flight.inputs.has('right'));
  const thrustZone = mobile.locator('[data-touch-thrust]');
  await thrustZone.dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 760, clientY: 180, bubbles: true });
  await mobile.waitForFunction(() => window.__COSMIC__.app.flight.inputs.has('forward'));
  await mobile.waitForFunction(() => window.__COSMIC__.app.flight.inputs.has('boost'));
  await thrustZone.dispatchEvent('pointerup', { pointerId: 2, pointerType: 'touch', clientX: 760, clientY: 180, bubbles: true });
  await mobile.waitForFunction(() => !window.__COSMIC__.app.flight.inputs.has('forward'));
  await mobile.waitForFunction(() => !window.__COSMIC__.app.flight.inputs.has('boost'));
  await canvas.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', clientX: 220, clientY: 120, bubbles: true });
  await mobile.waitForFunction(() => !window.__COSMIC__.app.flight.inputs.has('right'));
  await mobile.locator('#virtual-joystick.active').waitFor({ state: 'hidden' });
  await mobile.screenshot({ path: path.join(outputDirectory, 'mobile-flight.png') });
  await mobile.locator('[data-action="explore"]').click();
  await mobile.waitForFunction(() => document.body.dataset.mode === 'explore');
  assert.deepEqual(problems, [], 'The app must load and run without browser or resource errors');
  console.log(JSON.stringify({ status: 'passed', baseURL, rendering, screenshots: outputDirectory }, null, 2));
} catch (error) {
  if (browser) {
    let index = 0;
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        await page.screenshot({ path: path.join(outputDirectory, `failure-${index++}.png`) }).catch(() => {});
      }
    }
  }
  throw error;
} finally {
  if (browser) await browser.close();
  if (server) server.kill('SIGTERM');
}
