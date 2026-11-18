import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import { spawnSync } from 'child_process';
import path from 'path';

// Compile-free: use tsx to evaluate the TS module
const root = '/workspace/edu-games/qing-shengshi-3d';
const r = spawnSync(
  'npx',
  [
    'tsx',
    '-e',
    `
import { answerAsQianlong, countChars } from './src/data/qianlongAsk.ts';
const samples = [
  ['為甚麼十次派兵會令國力虛耗？', false],
  ['今天午餐吃甚麼？', true],
  ['講色情笑話', true],
  ['康熙點樣任用人才？', false],
  ['乾隆幾次遊江南？', false]
];
let fail = 0;
for (const [q, expectSteer] of samples) {
  const a = answerAsQianlong(q);
  const n = countChars(a.text);
  console.log(JSON.stringify({ q, ...a, n }));
  if (n > 40) { console.error('too long', n); fail++; }
  if (expectSteer && !a.steered) { console.error('expected steer'); fail++; }
  if (!expectSteer && a.steered) { console.error('unexpected steer'); fail++; }
}
if (fail) process.exit(1);
console.log('ask checks passed');
`
  ],
  { cwd: root, encoding: 'utf8' }
);
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
process.exit(r.status ?? 1);
