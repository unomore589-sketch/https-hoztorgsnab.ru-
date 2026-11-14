// Inject HtsZeroPrice + HtsEcommerce into live pages (browser only, nothing saved), or test the deployed ones with "live".
// Usage: node verify-zero-ecom.js <out dir> [live]
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const R = '/home/user/https-hoztorgsnab.ru-/modx-chunks/';
const parts = f => { const s = fs.readFileSync(R + f, 'utf8'); return { css: (s.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1], js: (s.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1] }; };
const ZP = parts('hts-zero-price.html'), EC = parts('hts-ecommerce.html');
const OUT = process.argv[2], LIVE = process.argv[3] === 'live', BASE = 'https://hoztorgsnab.ru';
const CAT = '/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/';
const PROD_OK = CAT + 'meshok-dlya-musora-30-litrov-10-mkm-20sht-v-rulone/';
const PROD_ZERO = CAT + 'meshok-dlya-musora-60-l.-v-rul.-bez-zavyaz.-30sht.-x/';
const SEARCH = '/poisk.html?query=%D0%BC%D0%B5%D1%88%D0%BA%D0%B8';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
  const out = {};
  for (const [mode, opts] of [['phone', { ...devices['Pixel 7'], locale: 'ru-RU' }], ['desktop', { viewport: { width: 1280, height: 900 }, locale: 'ru-RU' }]]) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    p.on('response', async r => { if (r.url().includes('minishop2/action.php') && process.env.DBG) { try { const j = await r.json(); console.error('RESP', j.success, String(j.message).slice(0, 90)); } catch (e) {} } }); let adds = 0; p.on('request', r => { if (r.url().includes('minishop2/action.php') && /cart%2Fadd|cart\/add/.test(r.postData() || '')) adds++; });
    const open = async u => { errs.length = 0; await p.goto(BASE + u, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(1800);
      await p.evaluate(() => { try { localStorage.setItem('hts_cookie', '1'); } catch (e) {} const c = document.querySelector('#hts-cookie'); if (c) c.hidden = true; });
      if (!LIVE) { await p.addStyleTag({ content: ZP.css }); await p.addScriptTag({ content: ZP.js }); await p.addScriptTag({ content: EC.js }); await p.waitForTimeout(300); } };
    const dl = () => p.evaluate(() => dataLayer.filter(x => x.ecommerce && x.ecommerce.add).map(x => x.ecommerce.add.products[0]));
    const o = out[mode] = {};
    const clickAdd = async sel => { const before = (await dl()).length; const a0 = adds;
      const what = await p.evaluate(sel => { const bs = [...document.querySelectorAll(sel)].filter(x => x.getBoundingClientRect().height > 0 && !x.closest('.hts-zp-form')); if (!bs.length) return null; bs[0].scrollIntoView({ block: 'center' }); bs[0].click(); return (bs[0].closest('form').querySelector('input[name=id]') || {}).value; }, sel);
      await p.waitForFunction(n => dataLayer.filter(x => x.ecommerce && x.ecommerce.add).length > n, before, { timeout: 7000 }).catch(() => {}); await p.waitForTimeout(400); return { id: what, requests: adds - a0, pushed: (await dl()).slice(before), errors: [...errs] }; };

    await open(CAT);
    o.category = { zeroRows: await p.evaluate(() => [...document.querySelectorAll('.hts-zp-val')].map(e => e.parentElement.textContent.replace(/\s+/g, ' ').trim())),
      leftZero: await p.evaluate(() => [...document.querySelectorAll('.product__wrapper .price, .product__wrapper .pricer')].filter(e => /^\s*0\s*руб/.test(e.textContent)).length) };
    o.category.add = await clickAdd('#mse2_results button.addtocart');
    if (mode === 'phone') { await p.evaluate(() => { const z = document.querySelector('.hts-zp-val'); if (z) z.closest('.item, .product').scrollIntoView({ block: 'center' }); }); await p.screenshot({ path: `${OUT}/zp-cat-${LIVE ? 'live' : 'inj'}.png` }); }

    await open(SEARCH);
    o.search = await p.evaluate(() => ({ replaced: document.querySelectorAll('.hts-zp-form').length, links: [...document.querySelectorAll('.hts-zp-btn')].map(a => a.getAttribute('href').slice(0, 60) + ' ' + Math.round(a.getBoundingClientRect().height)),
      visibleZeroBtn: [...document.querySelectorAll('.hts-zp-form button.addtocart')].filter(x => x.getBoundingClientRect().height > 0).length,
      leftZero: [...document.querySelectorAll('.product__wrapper .price, .product__wrapper .pricer')].filter(e => /^\s*0\s*руб/.test(e.textContent)).length }));
    const a0 = adds; await p.evaluate(() => { const f = document.querySelector('.hts-zp-form'); if (f) { if (f.requestSubmit) f.requestSubmit(); else f.submit(); } }); await p.waitForTimeout(1500);
    o.search.zeroSubmitRequests = adds - a0;
    o.search.add = await clickAdd('#mse2_results button.addtocart, .page_content button.addtocart');
    if (mode === 'phone') { await p.evaluate(() => { const z = document.querySelector('.hts-zp-form'); if (z) z.scrollIntoView({ block: 'center' }); }); await p.screenshot({ path: `${OUT}/zp-search-${LIVE ? 'live' : 'inj'}.png` }); }

    await open(PROD_ZERO);
    o.productZero = await p.evaluate(() => { const vis = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect().height > 0 : null; };
      return { price: (document.querySelector('#yoba-price-1') || {}).textContent.trim(), priceW: Math.round(document.querySelector('#yoba-price-1').getBoundingClientRect().width), qty: vis('yoba-element-1'), total: vis('yoba-vaka-3'),
        each: document.querySelector('.kss_prod_price') ? document.querySelector('.kss_prod_price').getBoundingClientRect().height > 0 : null, btn: (document.getElementById('yoba-button-1') || {}).textContent.replace(/\s+/g, ' '), hScroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
    if (mode === 'phone') { await p.evaluate(() => document.querySelector('#yoba-price-1').scrollIntoView({ block: 'center' })); await p.screenshot({ path: `${OUT}/zp-prod-${LIVE ? 'live' : 'inj'}.png` }); }

    await open(PROD_OK);
    o.productOk = { price: await p.evaluate(() => document.querySelector('#yoba-price-1').textContent.trim()) };
    o.productOk.add = await clickAdd('#yoba-button-1');

    await open('/');
    o.home = await clickAdd('button.addtocart');
    await p.evaluate(() => fetch('/assets/components/minishop2/action.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'ms2_action=cart/clean&ctx=web' }));
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
