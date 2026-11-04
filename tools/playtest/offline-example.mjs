import { chromium } from '/home/agent/node_modules/playwright/index.mjs';
const S=process.env.S, stage=process.env.ST||'0', tag=process.env.TAG||'a';
const b = await chromium.launch({ args: ['--use-gl=swiftshader','--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
p.on('console', m => { if (m.type() === 'error') console.log('ERR', m.text()); });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('http://100.118.72.60:5174/?stage='+stage);
await p.waitForTimeout(1500);
await p.uncheck('#online'); await p.click('#start'); await p.waitForTimeout(800);
await p.click('#chars button >> nth=0'); await p.waitForTimeout(1500);
await p.screenshot({ path: `${S}/${tag}-0.png` });
// пройти завязку, если есть
if (stage==='0') { await p.getByText('Как это не существую').click(); await p.waitForTimeout(4000); await p.getByText('ПОГНАЛИ').click({timeout:8000}); }
await p.waitForTimeout(2500);
let n=1;
for (let r=0;r<Number(process.env.ROUNDS||6);r++){
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(1200); await p.keyboard.up('ArrowRight');
  for (let k=0;k<45;k++){ await p.keyboard.press(['J','J','J','K'][k%4]); await p.waitForTimeout(170); if(k==20) await p.click('#chargeBtn').catch(()=>{}); if(k==21) await p.keyboard.press('U'); }
  await p.screenshot({ path: `${S}/${tag}-${n++}.png` });
}
await b.close();
