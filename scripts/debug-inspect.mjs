import puppeteer from 'puppeteer-core';
const BASE = 'http://127.0.0.1:4199/?qa=1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const behind = (yaw) => -(yaw + Math.PI / 2);
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--hide-scrollbars','--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }
});
const page = await browser.newPage();
page.setDefaultTimeout(120000);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => document.querySelector('#boot-start'), { timeout: 60000 });
await sleep(1400);
await page.screenshot({ path: '/tmp/chk-title.png', type: 'png' });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((el) => (el.textContent || '').includes('開始探索') && !el.disabled);
  b?.click();
});
await page.waitForFunction(() => window.__qing && window.__qing.stage() === 'kangxi', { timeout: 120000 });
await sleep(700);
const k = await page.evaluate(() => window.__qing.inspect());
console.log('KANGXI default', { pos: k.pos, facing: +k.facing.toFixed(3), cam: { a:+k.cam.alpha.toFixed(3), b:+k.cam.beta.toFixed(3), r:+k.cam.radius.toFixed(2), py:+k.cam.pos.y.toFixed(2), pz:+k.cam.pos.z.toFixed(2) } });
await page.screenshot({ path: '/tmp/chk-kangxi.png', type: 'png' });

async function trySpawn(name, x, z, facing) {
  await page.evaluate((x,z,f,a) => {
    window.__qing.lock(false);
    window.__qing.teleport(x,z);
    window.__qing.face(f);
    window.__qing.look(a, 1.36, 6.4);
  }, x, z, facing, behind(facing));
  await sleep(450);
  const info = await page.evaluate(() => window.__qing.inspect());
  console.log(name, { pos: {x:+info.pos.x.toFixed(1), z:+info.pos.z.toFixed(1)}, cam:{ b:+info.cam.beta.toFixed(2), r:+info.cam.radius.toFixed(2), py:+info.cam.pos.y.toFixed(2), pz:+info.cam.pos.z.toFixed(2)} });
  await page.screenshot({ path: `/tmp/chk-${name}.png`, type: 'png' });
}
await trySpawn('kx-axis', 0, 10.6, Math.PI);
await trySpawn('kx-west-mid', -3.2, 3.2, Math.PI);

await page.evaluate(() => window.__qing.goto('yongzheng'));
await page.waitForFunction(() => window.__qing.stage() === 'yongzheng' && !window.__qing.modalOpen(), { timeout: 120000 });
await sleep(700);
await page.screenshot({ path: '/tmp/chk-yongzheng.png', type: 'png' });

await page.evaluate(() => window.__qing.goto('qianlong'));
await page.waitForFunction(() => window.__qing.stage() === 'qianlong' && !window.__qing.modalOpen(), { timeout: 120000 });
await sleep(800);
await page.screenshot({ path: '/tmp/chk-ql-battle.png', type: 'png' });
await page.evaluate(() => { window.__qing.teleport(0, -8); window.__qing.face(Math.PI); window.__qing.look(Math.PI/2, 1.36, 6.4); });
await sleep(500);
await page.screenshot({ path: '/tmp/chk-ql-farm.png', type: 'png' });
await page.evaluate(() => { window.__qing.teleport(22, 2); window.__qing.face(0); window.__qing.aim(34, 2.6, 8, -0.7, 1.12, 22); });
await sleep(600);
await page.screenshot({ path: '/tmp/chk-ql-ships.png', type: 'png' });
await browser.close();
console.log('done');
