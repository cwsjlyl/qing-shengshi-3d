import puppeteer from 'puppeteer-core';
import { mkdir } from 'fs/promises';
import path from 'path';

const BASE = 'http://127.0.0.1:4199/?qa=1';
const OUT = '/workspace/edu-games/qing-shengshi-3d';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Babylon ArcRotateCamera: behind a character facing `yaw`. */
const behind = (yaw) => -(yaw + Math.PI / 2);

async function clickText(page, text) {
  return page.evaluate((text) => {
    const btns = [...document.querySelectorAll('button')];
    const b = btns.find((el) => (el.textContent || '').includes(text) && !el.disabled);
    if (!b) return false;
    b.click();
    return true;
  }, text);
}

async function waitClick(page, text, tries = 20, delay = 200) {
  for (let i = 0; i < tries; i++) {
    if (await clickText(page, text)) return true;
    await sleep(delay);
  }
  return false;
}

async function shot(page, name) {
  const dest = path.join(OUT, name);
  await sleep(280);
  await page.screenshot({ path: dest, type: 'png' });
  console.log('saved', dest);
}

async function qing(page, expr) {
  return page.evaluate((expr) => {
    const q = window.__qing;
    if (!q) return null;
    return eval(expr);
  }, expr);
}

async function waitStage(page, id, ms = 90000) {
  await page.waitForFunction(
    (id) => window.__qing && window.__qing.stage() === id && !window.__qing.modalOpen(),
    { timeout: ms },
    id
  );
  await sleep(500);
}

async function dismissDialogue(page) {
  for (let i = 0; i < 8; i++) {
    const open = await page.evaluate(() => window.__qing.modalOpen());
    if (!open) break;
    const clicked = (await clickText(page, '繼續')) || (await clickText(page, '知道了'));
    if (!clicked) break;
    await sleep(260);
  }
  await sleep(180);
  if (await page.evaluate(() => window.__qing.modalOpen())) {
    await clickText(page, '知道了');
    await sleep(180);
  }
}

async function openTalk(page, id) {
  const ok = await page.evaluate((id) => window.__qing.gotoNear(id), id);
  if (!ok) throw new Error('gotoNear failed: ' + id);
  await sleep(350);
  await page.evaluate((id) => window.__qing.talkNearest(id), id);
  await sleep(400);
}

async function talkTo(page, id) {
  await openTalk(page, id);
  await dismissDialogue(page);
  const req = await page.evaluate(() => window.__qing.required());
  console.log('after talk', id, req);
}

async function talkAndShot(page, id, name) {
  await openTalk(page, id);
  await shot(page, name);
  await dismissDialogue(page);
  const req = await page.evaluate(() => window.__qing.required());
  console.log('after talk', id, req);
}

async function doQuizAndPassword(page, password, via = 'door') {
  await page.evaluate((via) => window.__qing.gotoNear(via), via);
  await sleep(250);
  await page.evaluate((via) => window.__qing.talkNearest(via), via);
  await sleep(400);
  const title = await page.evaluate(
    () =>
      document.querySelector('.sheet h2')?.textContent ||
      document.querySelector('.sheet .speaker')?.textContent ||
      ''
  );
  console.log('after door/ship interact, sheet:', title);
  for (let q = 0; q < 3; q++) {
    await page.waitForSelector('.choice', { timeout: 10000 });
    await sleep(200);
    await page.evaluate(() => document.querySelectorAll('.choice')[0].click());
    await sleep(800);
  }
  await waitClick(page, '輸入密碼', 15, 200);
  await sleep(300);
  for (const d of password.split('')) {
    await page.evaluate((d) => {
      const b = [...document.querySelectorAll('.keypad button')].find((el) => el.textContent === d);
      b?.click();
    }, d);
    await sleep(80);
  }
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.keypad button')].find((el) => el.textContent === '確定');
    b?.click();
  });
  await sleep(500);
}

const LAYOUTS = [
  ['preview-layout-desktop.png', 1440, 900],
  ['preview-layout-phone-portrait.png', 390, 844],
  ['preview-layout-phone-landscape.png', 844, 390],
  ['preview-layout-ipad-portrait.png', 834, 1194],
  ['preview-layout-ipad-landscape.png', 1194, 834],
  ['preview-layout-embed.png', 360, 500]
];

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--window-size=1440,900'
  ],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }
});

const page = await browser.newPage();
page.setDefaultTimeout(90000);
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE', msg.type(), msg.text());
});

console.log('open title');
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => document.querySelector('#boot-start'), { timeout: 60000 });
await sleep(1400);
await shot(page, 'preview-title.png');

console.log('start game');
await waitClick(page, '開始探索');
await waitStage(page, 'kangxi', 120000);
console.log('entered kangxi', await qing(page, '({pos: q.pos(), req: q.required()})'));

// Default courtyard spawn: mid-yard, looking toward the hall / throne.
await sleep(600);
await shot(page, 'preview-kangxi.png');

for (const [name, w, h] of LAYOUTS) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await sleep(500);
  await shot(page, name);
}
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.evaluate(() => window.dispatchEvent(new Event('resize')));
await sleep(300);

// Player attendant in the courtyard aisle (close-up for the Tripo character pass).
await page.evaluate(() => {
  window.__qing.teleport(-3.2, 1.8);
  window.__qing.face(Math.PI);
  const p = window.__qing.pos();
  if (p) window.__qing.aim(p.x, p.y + 1.15, p.z, 0.55, 1.12, 3.6);
});
await sleep(500);
await shot(page, 'preview-player-walk.png');
await page.evaluate(() => window.__qing.lock(false));

// Close-ups so the first Meshy batch is clearly visible in stills.
await page.evaluate(() => {
  window.__qing.teleport(-3.2, 0.4);
  window.__qing.aim(-5.2, 2.05, -3.8, 0.4, 1.22, 5.8);
});
await sleep(500);
await shot(page, 'preview-meshy-lanterns.png');

await page.evaluate(() => {
  window.__qing.teleport(5.2, -4.2);
  window.__qing.aim(9.3, 3.2, -1.8, 0.85, 1.14, 14);
});
await sleep(500);
await shot(page, 'preview-meshy-moon-gate.png');

await page.evaluate(() => {
  window.__qing.teleport(12.2, -5.4);
  window.__qing.aim(11.5, 3.6, -8.2, 0.55, 1.12, 16);
});
await sleep(500);
await shot(page, 'preview-meshy-pavilion.png');

await page.evaluate(() => {
  window.__qing.teleport(-3.5, 0.6);
  window.__qing.aim(-5.85, 0.5, 0.4, 0.85, 1.12, 3.2);
});
await sleep(500);
await shot(page, 'preview-meshy-peony.png');

await page.evaluate(() => {
  window.__qing.teleport(12.0, 1.2);
  window.__qing.aim(11.0, 0.4, -0.6, 3.14, 1.1, 3.2);
});
await sleep(500);
await shot(page, 'preview-meshy-stool.png');

await page.evaluate(() => {
  window.__qing.teleport(-3.25, 2.15);
  window.__qing.aim(-3.25, 0.12, 0.2, -0.15, 0.95, 5.2);
});
await sleep(500);
await shot(page, 'preview-meshy-flagstones.png');
await page.evaluate(() => window.__qing.lock(false));

await talkAndShot(page, 'kangxi', 'preview-kangxi-talk.png');
await talkTo(page, 'manchu');
await talkTo(page, 'han');
console.log('kangxi talks', await qing(page, 'q.required()'));

await page.evaluate(() => window.__qing.gotoNear('door'));
await sleep(400);
await page.evaluate(() => window.__qing.talkNearest('door'));
await sleep(500);
await shot(page, 'preview-kangxi-quiz.png');
for (let qn = 0; qn < 3; qn++) {
  await page.waitForSelector('.choice', { timeout: 10000 });
  await page.evaluate(() => document.querySelectorAll('.choice')[0].click());
  await sleep(800);
}
await waitClick(page, '輸入密碼', 15, 200);
await sleep(250);
for (const d of '123') {
  await page.evaluate((d) => {
    [...document.querySelectorAll('.keypad button')].find((el) => el.textContent === d)?.click();
  }, d);
  await sleep(80);
}
await page.evaluate(() => {
  [...document.querySelectorAll('.keypad button')].find((el) => el.textContent === '確定')?.click();
});
console.log('waiting yongzheng');
await waitStage(page, 'yongzheng', 120000);
console.log('entered yongzheng', await qing(page, '({pos: q.pos(), req: q.required()})'));

// Default spawn: on the red carpet, emperor and officials ahead.
await sleep(700);
await shot(page, 'preview-yongzheng.png');

await talkAndShot(page, 'yongzheng', 'preview-yongzheng-talk.png');
await talkTo(page, 'officialA');
await talkTo(page, 'officialB');
await talkTo(page, 'treasury');
console.log('yongzheng talks', await qing(page, 'q.required()'));
await doQuizAndPassword(page, '456', 'door');
await waitStage(page, 'qianlong', 120000);
console.log('entered qianlong', await qing(page, '({pos: q.pos(), req: q.required()})'));

// Default 準噶爾 tableau spawn.
await sleep(700);
await shot(page, 'preview-qianlong-battle.png');
await talkAndShot(page, 'qianlong', 'preview-qianlong-talk.png');

await page.evaluate(() => {
  window.__qing.teleport(-22, 10);
  window.__qing.face(-Math.PI / 2);
  window.__qing.look(0, 1.36, 6.4);
});
await sleep(400);
await talkTo(page, 'heshen');

await page.evaluate(() => {
  window.__qing.teleport(0, -8);
  window.__qing.face(Math.PI);
  window.__qing.look(Math.PI / 2, 1.36, 6.4);
});
await sleep(600);
await shot(page, 'preview-qianlong-farm.png');
await talkTo(page, 'farmer');

// On the pier, looking east at the flagship sitting on the water.
await page.evaluate(() => {
  window.__qing.teleport(22, 2);
  window.__qing.face(0);
  window.__qing.aim(34, 6.2, 8, -0.72, 1.16, 32);
});
await sleep(800);
await shot(page, 'preview-qianlong-ships.png');
await page.evaluate(() => {
  window.__qing.aim(36, 6.4, 8, -0.95, 1.12, 28);
});
await sleep(500);
await shot(page, 'preview-meshy-boat.png');
await talkTo(page, 'ships');
console.log('qianlong talks', await qing(page, 'q.required()'));

await doQuizAndPassword(page, '789', 'shipboard');
await waitClick(page, '知道了', 15, 200);
await sleep(300);
await page.evaluate(() => window.__qing.gotoNear('shipboard'));
await sleep(300);
await page.evaluate(() => window.__qing.talkNearest('shipboard'));
await page.waitForFunction(
  () => document.querySelector('.sheet h2')?.textContent?.includes('本課小結'),
  { timeout: 20000 }
);
await sleep(600);
await shot(page, 'preview-qianlong-summary.png');
await waitClick(page, '完成探索', 10, 200);
await sleep(500);
await shot(page, 'preview-qianlong-complete.png');

console.log(
  'DONE pos',
  await qing(page, '({stage:q.stage(), pos:q.pos(), req:q.required()})')
);
await browser.close();
