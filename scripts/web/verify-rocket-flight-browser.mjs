import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {chromium} from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.env.ROCKET_REACT_MODE ?? 'production';
const previewOnly = process.env.ROCKET_PREVIEW_ONLY === '1';
assert.ok(['production', 'development'].includes(mode));
const output = path.resolve(process.env.ROCKET_REPORT_DIR ?? path.join(root, 'artifacts/rocket-flight-2026-10-17', mode));
await mkdir(output, {recursive: true});
const scratch = await mkdtemp(path.join(root, 'node_modules/.cache/rocket-flight-'));
const three = path.join(root, 'node_modules/three/src/Three.js');
const sceneFile = path.join(root, 'src/web/play/SolarSystem.tsx');
const facade = path.join(scratch, 'renderer.ts');
let server, browser;
const observations = [];

try {
  await writeFile(path.join(scratch, 'index.html'), '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
  await writeFile(path.join(scratch, 'tsconfig.json'), JSON.stringify({compilerOptions: {jsx: 'react-jsx'}}));
  await writeFile(path.join(scratch, 'main.tsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {SolarSystem} from ${JSON.stringify(sceneFile)};
import {configureBrowserErrorReporter} from ${JSON.stringify(path.join(root, 'src/web/observability/browserErrorReporter.ts'))};
import {SOLAR_SYSTEM_CONFIG} from ${JSON.stringify(path.join(root, 'src/web/play/solarConfig.ts'))};
import {createSolarGravityBodies} from ${JSON.stringify(path.join(root, 'src/web/play/solarGravity.ts'))};
import {createRocketFlight} from ${JSON.stringify(path.join(root, 'src/web/play/solarRocketMotion.ts'))};
window.probe={errors:[],draws:0};
window.observeGravity=()=>{const bodies=createSolarGravityBodies(SOLAR_SYSTEM_CONFIG),full=createRocketFlight({bodies,launchAt:0,variant:-1})(8);return bodies.filter(body=>body.name!=='Earth').map(body=>{const without=createRocketFlight({bodies:bodies.filter(other=>other!==body),launchAt:0,variant:-1})(8);return {body:body.name,displacementDifference:Math.hypot(full.x-without.x,full.y-without.y,full.z-without.z)};});};
configureBrowserErrorReporter(error=>window.probe.errors.push(String(error)));
const pending=new Map();let next=0,clock=1000,hidden=false;
performance.now=()=>clock;
window.requestAnimationFrame=callback=>{const id=++next;pending.set(id,callback);return id;};
window.cancelAnimationFrame=id=>pending.delete(id);
window.advance=(count=1,delta=1000/60)=>{for(let i=0;i<count;i++){clock+=delta;const callbacks=[...pending.values()];pending.clear();for(const callback of callbacks)callback(clock);}};
Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
window.setHidden=value=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));};
function App(){const [paused,setPaused]=React.useState(false);window.setPaused=setPaused;return <><output data-paused={String(paused)}/><SolarSystem paused={paused}/></>;}
createRoot(document.querySelector('#root')).render(<React.StrictMode><App/></React.StrictMode>);
document.head.insertAdjacentHTML('beforeend','<style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:#09121e}.solar-system{position:absolute;inset:0}canvas{display:block;width:100%;height:100%}</style>');
`);
  await writeFile(facade, `
import * as THREE from ${JSON.stringify(three)};
export * from ${JSON.stringify(three)};
export class WebGLRenderer extends THREE.WebGLRenderer {
 constructor(options){super(options);const draw=this.render.bind(this);
  this.render=(scene,camera)=>{window.probe.draws++;draw(scene,camera);
   window.rockets=()=>{scene.updateMatrixWorld(true);const earth=scene.getObjectByName('Earth').getWorldPosition(new THREE.Vector3());return scene.getObjectByName('Earth rocket departures').children.map(model=>{const nozzle=model.localToWorld(new THREE.Vector3(0,-3.8,0));return {name:model.name,visible:model.visible,position:model.position.toArray(),nozzle:nozzle.toArray(),heading:new THREE.Vector3(0,1,0).applyQuaternion(model.quaternion).toArray(),earth:earth.toArray(),earthDistance:nozzle.distanceTo(earth),scale:model.scale.x,exhaust:model.getObjectByName('Rocket exhaust').visible,screen:model.getWorldPosition(new THREE.Vector3()).project(camera).toArray()};});};
  };
 }
}
`);
  await build({root: scratch, configFile: false, logLevel: 'error', define: {'process.env.NODE_ENV': JSON.stringify(mode)}, plugins: [{
    name: 'rocket-flight-observation', enforce: 'pre', async load(id) {
      if (id !== sceneFile) return;
      return (await readFile(id, 'utf8'))
        .replace('"three/src/Three.js"', JSON.stringify(facade))
        .replace('animationElapsed += deltaSeconds;', 'animationElapsed = window.flightTime ?? animationElapsed + deltaSeconds;');
    },
  }], build: {outDir: 'dist', minify: false}});
  server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const file = path.join(scratch, 'dist', pathname === '/' ? 'index.html' : pathname);
      response.writeHead(200, {'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.webp') ? 'image/webp' : 'text/html'});
      response.end(await readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  for (const width of [1280, 390]) {
    const context = await browser.newContext({viewport: {width, height: 844}});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => {window.advance?.(); return window.rockets && window.probe.draws > 1;}, null, {polling: 50, timeout: 10000});
    const at = time => page.evaluate(time => {window.flightTime = time; window.advance(); return window.rockets();}, time);
    const first = rows => rows.find(row => row.name === 'Rocket 1');
    if (previewOnly) {
      const frames = [];
      for (const time of [0, 1, 2.9, 3, 8, 24, 25, 48]) {
        const rockets = await at(time);
        await page.screenshot({path: path.join(output, `earth-launch-${width}-${time}s.png`)});
        frames.push({time, rockets});
      }
      observations.push({width, frames, errors, sceneErrors: await page.evaluate(() => window.probe.errors),
        gravityContributions: await page.evaluate(() => window.observeGravity())});
      await context.close();
      continue;
    }
    const coastBefore = first(await at(0)), powered = first(await at(1)), coastAfter = first(await at(4));
    assert.ok(Math.abs(coastBefore.earthDistance - 3.5 * (1 + 400000 / 6378137)) < 1e-6, 'launch nozzle starts beside Earth');
    assert.equal(powered.exhaust, true);
    assert.equal(coastAfter.exhaust, false);
    assert.equal(powered.scale, 0.5);
    assert.notDeepEqual(coastAfter.position, powered.position);
    const before = first(await at(4.99)), current = first(await at(5)), after = first(await at(5.01));
    const dx = after.nozzle[0] - before.nozzle[0], dy = after.nozzle[1] - before.nozzle[1], dz = after.nozzle[2] - before.nozzle[2];
    const alignment = (dx * current.heading[0] + dy * current.heading[1] + dz * current.heading[2]) / Math.hypot(dx, dy, dz);
    assert.ok(alignment > 0.99999, 'rocket nose follows its physical velocity at each aspect ratio');
    for (const time of [0, 48]) {
      assert.ok(Math.abs(first(await at(time)).earthDistance - 3.5 * (1 + 400000 / 6378137)) < 1e-6, 'every repeated departure starts beside the moving Earth');
    }
    const secondLaunch = (await at(24)).find(row => row.name === 'Rocket 2');
    assert.equal(secondLaunch.visible, true);
    assert.ok(Math.abs(secondLaunch.earthDistance - 3.5 * (1 + 400000 / 6378137)) < 1e-6);
    assert.equal(first(await at(36)).visible, false);
    assert.equal(first(await at(47.99)).visible, false);
    await at(1);
    await page.screenshot({path: path.join(output, `powered-${width}.png`)});
    await at(4);
    await page.screenshot({path: path.join(output, `coasting-${width}.png`)});
    await page.evaluate(() => {window.flightTime = undefined; window.advance(); window.setPaused(true);});
    await page.waitForFunction(() => document.querySelector('output').dataset.paused === 'true');
    const paused = await page.evaluate(() => window.rockets());
    await page.evaluate(() => window.advance(5));
    assert.deepEqual(await page.evaluate(() => window.rockets()), paused, 'host pause freezes the rockets');
    await page.evaluate(() => window.setPaused(false));
    await page.waitForFunction(() => document.querySelector('output').dataset.paused === 'false');
    await page.evaluate(() => window.advance(5));
    assert.notDeepEqual(await page.evaluate(() => window.rockets()), paused, 'host resume continues flight');
    await page.evaluate(() => window.setHidden(true));
    const hidden = await page.evaluate(() => window.rockets());
    await page.evaluate(() => window.advance(5));
    assert.deepEqual(await page.evaluate(() => window.rockets()), hidden, 'hidden document freezes the rockets');
    await page.evaluate(() => {window.setHidden(false); window.advance(5);});
    assert.notDeepEqual(await page.evaluate(() => window.rockets()), hidden);
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => window.probe.errors), []);
    observations.push({width, alignment, coastBefore, powered, coastAfter, pauseResume: true, visibilityResume: true, errors});
    await context.close();
  }
  await writeFile(path.join(output, 'observations.json'), JSON.stringify(observations, null, 2));
  console.log(JSON.stringify({mode, previewOnly, widths: observations.map(row => row.width), observations: observations.length}));
} finally {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(scratch, {recursive: true, force: true});
}
