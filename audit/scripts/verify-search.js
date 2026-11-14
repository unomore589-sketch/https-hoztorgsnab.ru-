// Inject HtsSearchCompact + HtsListCompact + HtsListQty into the live search page (browser only), or test deployed with "live".
// Usage: node verify-search.js <out dir> [live]
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const R = '/home/user/https-hoztorgsnab.ru-/modx-chunks/';
const parts = f => { const s = fs.readFileSync(R + f, 'utf8'); return { css: (s.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1], js: (s.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1] }; };
const SC = parts('hts-search-compact.html'), LC = parts('hts-list-compact.html'), LQ = parts('hts-list-qty.html');
const OUT = process.argv[2], LIVE = process.argv[3] === 'live';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
  const out = {};
  for (const [mode, opts] of [['phone', { ...devices['Pixel 7'], locale: 'ru-RU' }], ['se', { ...devices['iPhone SE'], locale: 'ru-RU' }], ['desktop', { viewport: { width: 1280, height: 900 }, locale: 'ru-RU' }]]) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    const reqs = []; p.on('request', r => { if (r.url().includes('minishop2/action.php')) reqs.push(r.postData()); });
    const o = out[mode] = {};
    for (const [k, q] of [['meshki', '%D0%BC%D0%B5%D1%88%D0%BA%D0%B8'], ['none', 'zzzqqq'], ['venik', '%D0%B2%D0%B5%D0%BD%D0%B8%D0%BA']]) {
      if (mode !== 'phone' && k !== 'meshki') continue;
      errs.length = 0;
      await p.goto('https://hoztorgsnab.ru/poisk.html?query=' + q, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(1800);
      await p.evaluate(() => { try { localStorage.setItem('hts_cookie', '1'); } catch (e) {} const c = document.querySelector('#hts-cookie'); if (c) c.hidden = true; });
      const m = () => p.evaluate(() => { const cards = [...document.querySelectorAll('.page_content .product')]; const r = e => Math.round(e.getBoundingClientRect().height);
        const rows = {}; cards.forEach(c => { const t = Math.round(c.getBoundingClientRect().top + scrollY); rows[t] = (rows[t] || 0) + 1; });
        const clipped = cards.filter(c => { const n = c.querySelector('.product_name'); return n && n.scrollHeight > n.clientHeight + 2; }).length;
        return { n: cards.length, heights: [...new Set(cards.map(r))].slice(0, 6), rowsTops: Object.keys(rows).length, pageH: document.documentElement.scrollHeight, clipped,
          count: (document.querySelector('.hts-sr-count') || {}).textContent || null, qtyBtns: document.querySelectorAll('.hts-lq-btn').length, firstCard: cards[0] ? Math.round(cards[0].getBoundingClientRect().top) : null,
          headQuery: (document.querySelector('#header #search-field') || {}).value, pageForm: (() => { const f = document.querySelector('.page_content > #mse2_form'); return f ? f.getBoundingClientRect().height > 0 : null; })(), hScroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
      const before = await m();
      if (!LIVE) { for (const x of [LC, LQ, SC]) await p.addStyleTag({ content: x.css }); await p.addScriptTag({ content: SC.js }); await p.addScriptTag({ content: LQ.js }); await p.waitForTimeout(800); }
      o[k] = { before, after: await m(), errors: [...errs] };
      if (k === 'meshki') {
        await p.screenshot({ path: `${OUT}/sr-${mode}-${LIVE ? 'live' : 'inj'}.png` });
        if (mode === 'phone') {
          await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/sr-${mode}-2-${LIVE ? 'live' : 'inj'}.png` });
          // add with quantity 3 via +
          const r0 = reqs.length;
          const id = await p.evaluate(() => { const f = [...document.querySelectorAll('form.hts-lq-form')].find(f => !f.classList.contains('hts-zp-form') && f.querySelector('.addtocart') && f.querySelector('.addtocart').getBoundingClientRect().height > 0); if (!f) return null; f.scrollIntoView({ block: 'center' });
            const plus = f.querySelector('.hts-lq-btn[data-step="1"]'); plus.click(); plus.click(); f.querySelector('.addtocart').click(); return f.querySelector('input[name=id]').value; });
          await p.waitForFunction(() => document.querySelector('.hts-lq-in'), null, { timeout: 8000 }).catch(() => {});
          o.add = { id, requests: reqs.slice(r0), inCart: await p.evaluate(() => !!document.querySelector('.hts-lq-in')), dl: await p.evaluate(() => dataLayer.filter(x => x.ecommerce && x.ecommerce.add).map(x => x.ecommerce.add.products[0].quantity)), errors: [...errs] };
          await p.screenshot({ path: `${OUT}/sr-${mode}-add-${LIVE ? 'live' : 'inj'}.png` });
          await p.evaluate(() => fetch('/assets/components/minishop2/action.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: 'ms2_action=cart/clean&ctx=web' }));
        }
      }
    }
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
