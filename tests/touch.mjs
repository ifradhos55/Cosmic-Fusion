import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5173';
const directory = 'work/touch';
await mkdir(directory, { recursive: true });
let server;
try { await fetch(base, { signal: AbortSignal.timeout(1000) }); }
catch {
  const url = new URL(base);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Touch test server is unavailable');
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', url.hostname, '--port', url.port || '5173', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try { const response = await fetch(base); if (response.ok) break; } catch { /* Wait for Vite to listen. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
}
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const failures = [];
const results = [];
const devices = [
  ['phone-portrait', 390, 844], ['phone-landscape', 844, 390],
  ['ipad-portrait', 820, 1180], ['ipad-landscape', 1180, 820],
  ['folded', 344, 882], ['unfolded', 690, 829], ['ipad-pro', 1366, 1024],
  ['small-landscape', 667, 375],
];
try {
  for (const [name, width, height] of devices) {
    const page = await browser.newPage({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    page.on('pageerror', error => failures.push(`${name}: ${error.message}`));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__COSMIC__?.app?.touchUI);
    if (width < 600 && height > width) {
      assert.ok(await page.locator('#rotate-device').isVisible());
      await page.locator('[data-touch-action=portrait]').tap();
    } else assert.equal(await page.locator('#rotate-device').isVisible(), false, 'Tablets should support portrait without a blocking prompt');
    const layout = await page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth, selected: window.__COSMIC__.app.selectedId }));
    assert.ok(layout.overflow <= width + 1, `${name}: no horizontal document overflow`);
    assert.equal(layout.selected, null);
    assert.equal(await page.locator('#object-panel').isVisible(), false, 'Details start collapsed');
    assert.equal(await page.locator('.sidebar').isVisible(), false, 'Worlds start collapsed');
    const dock = page.locator('.touch-dock');
    const buttons = await dock.locator('button').evaluateAll(elements => elements.map(el => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height, hit: el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) };
    }));
    assert.ok(buttons.every(b => b.w >= 44 && b.h >= 44 && b.hit), `${name}: every dock button has a clear 44px target: ${JSON.stringify(buttons)}`);
    await page.locator('[data-touch-action=worlds]').tap();
    await page.locator('.sidebar').waitFor({ state: 'visible' });
    await page.locator('.sidebar [data-body=earth]').tap();
    assert.equal(await page.locator('.sidebar').isVisible(), false);
    await page.waitForFunction(() => window.__COSMIC__.app.selectedId === 'earth');
    await page.waitForTimeout(1600);
    const distance = () => page.evaluate(() => {const a = window.__COSMIC__.app; return a.camera.position.distanceTo(a.cameraRig.controls.target);});
    const beforeZoom = await distance();
    await page.locator('.touch-view-tools [data-action=zoom-in]').tap();
    await page.waitForTimeout(350);
    assert.ok(await distance() < beforeZoom * .9, `${name}: zoom button gets closer`);
    await page.locator('[data-touch-action=details]').tap();
    assert.ok(await page.locator('#object-panel').isVisible());
    assert.match(await page.locator('#body-title').textContent(), /Earth/);
    await page.locator('#object-panel [data-action=close-panel]').tap();
    assert.equal(await page.locator('#object-panel').isVisible(), false);
    if (name === 'phone-portrait') {
      const cdp = await page.context().newCDPSession(page);
      const canvas = await page.locator('#scene canvas').boundingBox();
      const x = canvas.x+canvas.width*.43, y=canvas.y+canvas.height*.48;
      const touch = (id, px, py) => ({id, x:px, y:py, radiusX:4, radiusY:4, force:1});
      const gesture = async points => {await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:points[0]});for(const p of points.slice(1)){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:p});}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
      const cameraBefore = await page.evaluate(()=>window.__COSMIC__.app.camera.position.toArray());
      await gesture([[touch(1,x,y)],[touch(1,x+20,y+5)],[touch(1,x+55,y+20)]]);
      await page.waitForTimeout(250);
      assert.notDeepEqual(await page.evaluate(()=>window.__COSMIC__.app.camera.position.toArray()),cameraBefore,'One-finger drag rotates');
      const pinchBefore = await distance();
      await gesture([[touch(1,x-25,y),touch(2,x+25,y)],[touch(1,x-40,y),touch(2,x+40,y)],[touch(1,x-70,y),touch(2,x+70,y)]]);
      await page.waitForTimeout(250);
      assert.ok(await distance() < pinchBefore * .95,'Spreading two fingers zooms in');
      const panBefore=await page.evaluate(()=>window.__COSMIC__.app.cameraRig.controls.target.toArray());
      await gesture([[touch(1,x-30,y),touch(2,x+30,y)],[touch(1,x-15,y+10),touch(2,x+45,y+10)],[touch(1,x,y+20),touch(2,x+60,y+20)]]);
      await page.waitForTimeout(250);
      assert.notDeepEqual(await page.evaluate(()=>window.__COSMIC__.app.cameraRig.controls.target.toArray()),panBefore,'Two fingers pan');
      await page.locator('[data-touch-action=details]').tap();
      const panel=await page.locator('#object-panel').boundingBox();
      await gesture([[touch(1,panel.x+panel.width/2,panel.y+panel.height-50)],[touch(1,panel.x+panel.width/2,panel.y+panel.height-140)],[touch(1,panel.x+panel.width/2,panel.y+60)]]);
      await page.waitForTimeout(200);
      assert.ok(await page.locator('#object-panel').evaluate(e=>e.scrollTop)>0,'Details scroll independently');
      await page.locator('.touch-sheet-backdrop').tap({position:{x:10,y:10}});
    }
    await page.locator('.touch-dock [data-action=clean-view]').tap();
    assert.equal(await dock.isVisible(),false);
    assert.ok(await page.locator('#scene canvas').evaluate(el=>el.clientHeight)>=height-1,'Clean view fills screen');
    const scene=page.locator('#scene canvas');
    const cdp=await page.context().newCDPSession(page);
    for(let i=0;i<2;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:width/2,y:height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
    await dock.waitFor({state:'visible'});
    await page.locator('[data-touch-action=worlds]').tap();
    await page.locator('.sidebar [data-action=overview]').tap();
    await page.waitForTimeout(1600);
    if (name === 'ipad-portrait') {
      await page.locator('.mode-switch [data-action=galaxy]').tap();
      await page.locator('[data-galaxy-view=sky]').tap();
      await page.waitForTimeout(300);
      const before = await page.evaluate(() => window.__COSMIC__.app.camera.fov);
      await page.locator('.touch-view-tools [data-action=zoom-in]').tap();
      assert.ok(await page.evaluate(() => window.__COSMIC__.app.camera.fov) < before, 'Sky view has working touch zoom controls');
      await page.screenshot({ path: `${directory}/ipad-sky.png` });
      await page.locator('.mode-switch [data-action=explore]').tap();
      await page.waitForTimeout(1600);
    }
    await page.screenshot({path:`${directory}/${name}-explore.png`});
    await page.locator('.mode-switch [data-action=flight]').tap();
    const steer=page.locator('[data-touch-steer]'), thrust=page.locator('[data-touch-thrust]');
    const sb=await steer.boundingBox(),tb=await thrust.boundingBox();
    const sp={id:1,x:sb.x+sb.width/2,y:sb.y+sb.height*.4};
    const tp={id:2,x:tb.x+tb.width/2,y:tb.y+tb.height*.4};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[sp]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...sp,x:sp.x+25,y:sp.y-15}]});
    assert.ok(await page.locator('#virtual-joystick').isVisible());
    let steering=await page.evaluate(()=>window.__COSMIC__.app.flight.touchSteering.toArray());
    assert.ok(steering[0]>.2&&steering[0]<.8&&steering[1]<0,`${name}: proportional two-axis steering ${steering}`);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...sp,x:sp.x+25,y:sp.y-15},tp]});
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>window.__COSMIC__.app.flight.touchThrottle)>.5,'Right thumb provides thrust');
    assert.equal(await page.evaluate(()=>window.__COSMIC__.app.flight.inputs.has('boost')),false);
    await page.screenshot({path:`${directory}/${name}-flight.png`});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    assert.equal(await page.evaluate(()=>window.__COSMIC__.app.flight.touchSteering.length()),0);
    assert.equal(await page.evaluate(()=>window.__COSMIC__.app.flight.touchThrottle),0);
    assert.equal(await page.locator('#virtual-joystick').isVisible(),false);
    await page.locator('.touch-flight-actions [data-action=brake]').tap();
    assert.ok(await page.evaluate(()=>window.__COSMIC__.app.flight.velocity.length())<.001);
    await page.locator('.touch-flight-actions [data-action=view]').tap();
    assert.equal(await page.evaluate(()=>window.__COSMIC__.app.flight.view),'cockpit');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[sp]});
    await page.setViewportSize({width:height,height:width});
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.__COSMIC__.app.touchUI.pointers.size),0,'Rotation clears held touch controls');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    results.push({name,width,height,status:'passed'});
    console.log(`${name}: passed`);
    await page.close();
  }
  assert.deepEqual(failures,[]);
  console.log(JSON.stringify({status:'passed',devices:results,screenshots:directory},null,2));
} finally {await browser.close(); server?.kill('SIGTERM');}
