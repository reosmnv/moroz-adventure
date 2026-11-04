import { chromium } from '/home/agent/node_modules/playwright/index.mjs';
const S = process.argv[2];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() !== 'log') console.log('CON', m.type(), m.text()); });
await p.goto('https://reosmnv.github.io/moroz-adventure/'); await p.waitForTimeout(2000);
await p.click('#start'); await p.click('#newOnline'); await p.waitForTimeout(4000);
console.log('NOTE', await p.textContent('#menuNote')); await p.screenshot({ path: S + '/prod-online.png' });
await b.close();
