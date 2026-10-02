import {it, expect} from '@jest/globals';
import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {openAuthenticationHarness} from '../../../packages/portal/src/jest/__tests__/authenticationHarness.jest-playwright.support';
import {enterRegisteredGame} from '../../../packages/portal/src/jest/__tests__/authentication.jest-playwright.support';

it('captures the real current Jest profile failure with synthetic provider identity', async () => {
  const dist = '/home/craig-beswetherick/.cache/riddle-quest-review/live-consent-20261002/jest';
  const server = createServer(async (req, res) => {
    const file = path.join(dist, new URL(req.url ?? '/', 'http://localhost').pathname === '/' ? 'index.html' : new URL(req.url ?? '/', 'http://localhost').pathname);
    try {res.setHeader('Content-Type', ({'.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json'} as Record<string,string>)[path.extname(file)] ?? 'application/octet-stream'); res.end(await readFile(file));}
    catch {res.writeHead(404).end();}
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('No private test server');
  const browser = await chromium.launch({headless: true});
  try {
    const {page, pageErrors} = await openAuthenticationHarness(browser, `http://127.0.0.1:${address.port}`, {registered: true, scenario:'avatar-profile'});
    const consoleErrors: string[] = [];
    page.on('console', message => {if (message.type() === 'error') consoleErrors.push(message.text());});
    await enterRegisteredGame(page);
    await page.getByRole('button', {name: /^profile$/i}).click();
    await page.waitForTimeout(1000);
    console.log(JSON.stringify({pageErrors, consoleErrors, body: (await page.locator('body').innerText()).slice(0,5000)}));
    await page.screenshot({path:path.resolve(__dirname, '../jest-profile-baseline.png')});
    expect(await page.locator('#game-modal-title').count()).toBe(1);
    expect(await page.locator('#game-modal-title').textContent()).toBe('Profile');
  } finally {await browser.close(); await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}, 15000);
