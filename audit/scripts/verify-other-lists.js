// Inject HtsListCompact + HtsListQty into list pages that do not have them yet (parent categories, sale), or test deployed with "live".
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const R = '/home/user/https-hoztorgsnab.ru-/modx-chunks/';
const parts = f => { const s = fs.readFileSync(R + f, 'utf8'); return { css: (s.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1], js: (s.match(/<script>([\s\S]*?)<\/script>/) || [, ''])[1] }; };
const LC = parts('hts-list-compact.html'), LQ = parts('hts-list-qty.html');
const OUT = process.argv[2], LIVE = process.argv[3] === 'live';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
  const out = {};
  for (const [mode, opts] of [['phone', { ...devices['Pixel 7'], locale: 'ru-RU' }], ['desktop', { viewport: { width: 1280, height: 900 }, locale: 'ru-RU' }]]) {
    const ctx = await b.newContext(opts); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 120)));
    for (const u of ['/catalog/meshki-dlya-musora/', '/rasprodazha/', '/catalog/xozyajstvennyie-tovaryi/']) {
      errs.length = 0;
      await p.goto('https://hoztorgsnab.ru' + u, { waitUntil: 'load', timeout: 90000 }); await p.waitForTimeout(1800);
      await p.evaluate(() => { try { localStorage.setItem('hts_cookie', '1'); } catch (e) {} const c = document.querySelector('#hts-cookie'); if (c) c.hidden = true; });
      const m = () => p.evaluate(() => { const cards = [...document.querySelectorAll('#mse2_results .product')]; const rows = {}; cards.forEach(c => { const t = Math.round(c.getBoundingClientRect().top + scrollY); rows[t] = (rows[t] || 0) + 1; });
        return { n: cards.length, h: [...new Set(cards.map(c => Math.round(c.getBoundingClientRect().height)))].slice(0, 5), rows: Object.keys(rows).length, listH: Math.round((document.querySelector('#mse2_results') || { getBoundingClientRect: () => ({ height: 0 }) }).getBoundingClientRect().height),
          clipped: cards.filter(c => { const n = c.querySelector('.product_name'); return n && n.scrollHeight > n.clientHeight + 2; }).length, qty: document.querySelectorAll('.hts-lq-btn').length, hScroll: document.documentElement.scrollWidth > innerWidth + 1 }; });
      const before = await m();
      if (!LIVE) { await p.addStyleTag({ content: LC.css }); await p.addStyleTag({ content: LQ.css }); await p.addScriptTag({ content: LQ.js }); await p.waitForTimeout(800); }
      const after = await m(); let add = null;
      if (mode === 'phone') {
        add = await p.evaluate(async () => { const f = [...document.querySelectorAll('form.hts-lq-form')].find(f => !f.classList.contains('hts-zp-form') && f.querySelector('.addtocart') && f.querySelector('.addtocart').getBoundingClientRect().height > 0); if (!f) return 'no form'; f.scrollIntoView({ block: 'center' }); f.querySelector('.hts-lq-btn[data-step="1"]').click(); f.querySelector('.addtocart').click();
          for (let i = 0; i < 40 && !f.classList.contains('hts-lq-in'); i++) await new Promise(r => setTimeout(r, 200)); return { inCart: f.classList.contains('hts-lq-in'), val: f.querySelector('input[name=count]').value }; });
        await p.screenshot({ path: `${OUT}/ol-${u.replace(/\W+/g, '_')}-${LIVE ? 'live' : 'inj'}.png` });
        await p.evaluate(() => fetch('/assets/components/minishop2/action.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }, body: 'ms2_action=cart/clean&ctx=web' }));
      }
      out[mode + ' ' + u] = { before, after, add, errors: [...errs] };
    }
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
