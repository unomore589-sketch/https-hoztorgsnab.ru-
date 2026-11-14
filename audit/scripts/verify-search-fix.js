// Test HtsSearchFix on the live search page: injected in the browser only (default) or the deployed chunk ("live").
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const S = fs.readFileSync('/home/user/https-hoztorgsnab.ru-/modx-chunks/hts-search-fix.html', 'utf8');
const CSS = S.match(/<style>([\s\S]*?)<\/style>/)[1], JS = S.match(/<script>([\s\S]*?)<\/script>/)[1];
const LIVE = process.argv[3] === 'live', OUT = process.argv[2];
const T = [['vtirb', 'раскладка lat→cyr'], ['dtybr', 'веник'], ['мешкм', 'лишняя буква в конце'], ['веникк', 'лишняя буква в конце'], ['веинк', 'соседние буквы наоборот'], ['мешшки', 'лишняя буква внутри'],
  ['мешакм', 'две ошибки'], ['мшки', 'пропущена буква'], ['zzzqqq', 'нет такого'], ['вщьуыещы', 'domestos в русской раскладке'], ['мешки', 'без ошибок']];
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'ru-RU' });
  if (!LIVE) await ctx.addInitScript({ content: `document.addEventListener('DOMContentLoaded', function () { if (location.pathname.indexOf('/poisk') !== 0) return; var st = document.createElement('style'); st.textContent = ${JSON.stringify(CSS)}; document.head.appendChild(st); (0, eval)(${JSON.stringify(JS)}); });` });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 100)));
  let n = 0;
  for (const [q, what] of T) {
    errs.length = 0; const t0 = Date.now();
    await p.goto('https://hoztorgsnab.ru/poisk.html?query=' + encodeURIComponent(q), { waitUntil: 'load', timeout: 90000 });
    await p.waitForFunction(() => window.htsSearchFixDone || !!document.querySelector('.page_content .product'), null, { timeout: 40000 }).catch(() => console.log('  (timeout)'));
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => ({ url: decodeURIComponent(location.search), products: document.querySelectorAll('.page_content .product').length, note: (document.querySelector('.hts-sr-note') || {}).textContent || null, count: (document.querySelector('.hts-sr-count') || {}).textContent || null, headField: (document.querySelector('#header #search-field') || {}).value, hScroll: document.documentElement.scrollWidth > innerWidth + 1 }));
    console.log(`${q.padEnd(10)} (${what}) ${Date.now() - t0}ms →`, JSON.stringify(r), errs.length ? 'ERR ' + errs : '');
    if (n++ < 2 || q === 'мешкм') await p.screenshot({ path: `${OUT}/sf-${n}-${LIVE ? 'live' : 'inj'}.png` });
  }
  // back button after redirect returns to the query page without redirect loop
  await p.goto('https://hoztorgsnab.ru/poisk.html?query=vtirb', { waitUntil: 'load' }); await p.waitForTimeout(5000);
  const hist = await p.evaluate(() => history.length); await p.goBack().catch(() => {}); await p.waitForTimeout(500);
  console.log('after goBack url:', await p.evaluate(() => location.href), 'history.length', hist);
  await b.close();
})();
