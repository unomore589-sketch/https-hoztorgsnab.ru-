// Follow-up checks: hamburger menu, add-to-cart feedback timing, small tap targets, back navigation.
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const BASE = 'https://hoztorgsnab.ru';
const SUB = '/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/';
const notes = {};
const shot = (page, n) => page.screenshot({ path: path.join(OUT, 'g-' + n + '.png') });

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'ru-RU' });
  const page = await ctx.newPage();
  const go = async (u) => { await page.goto(BASE + u, { waitUntil: 'load', timeout: 90000 }); await page.waitForTimeout(2500); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { notes[name + '_error'] = String(e).slice(0, 300); } };
  const dismiss = async () => { const b = page.locator('#hts-cookie').getByText('Только необходимые').first(); if (await b.isVisible().catch(() => false)) { await b.click(); await page.waitForTimeout(500); } };

  await step('menu', async () => {
    await go('/'); await dismiss();
    // the dark hamburger button top-right: find the element at that point
    const info = await page.evaluate(() => {
      const el = document.elementFromPoint(innerWidth - 40, 84);
      const chain = []; let e = el; while (e && chain.length < 5) { chain.push(e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).trim().split(/\s+/).join('.') : '')); e = e.parentElement; }
      const r = el.getBoundingClientRect();
      return { chain, w: Math.round(r.width), h: Math.round(r.height) };
    });
    notes.hamburger = info;
    await page.mouse.click(412 - 40, 84);
    await page.waitForTimeout(1200);
    notes.menuOpen = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const links = [...document.querySelectorAll('#megamenu a, .megamenu_mobile a, nav a, .mobile-menu a, [class*=mobile] a')].filter(vis);
      const uniq = [...new Set(links.map((a) => a.innerText.trim()).filter(Boolean))];
      return { visibleLinks: links.length, items: uniq.slice(0, 40), hasCatalog: links.some((a) => /\/catalog\//.test(a.getAttribute('href') || '')), docH: document.documentElement.scrollHeight, linkH: links[0] ? Math.round(links[0].getBoundingClientRect().height) : null,
        overlay: [...document.querySelectorAll('body *')].filter((e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return (s.position === 'fixed' || s.position === 'absolute') && r.width >= innerWidth * 0.6 && r.height >= innerHeight * 0.5 && vis(e); }).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0] + '#' + e.id).slice(0, 4) };
    });
    await shot(page, '01-menu');
    await page.screenshot({ path: path.join(OUT, 'g-01-menu-full.png'), fullPage: true });
  });

  await step('addFeedback', async () => {
    await go(SUB); await dismiss();
    const btn = page.locator('button, input[type=submit], a.btn').filter({ hasText: /в корзину/i }).first();
    await btn.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    await page.waitForTimeout(400);
    notes.listBtn = await btn.evaluate((b) => { const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), tag: b.tagName, text: b.innerText.trim() }; });
    await page.evaluate(() => {
      window.__seen = [];
      new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { const r = n.getBoundingClientRect ? n.getBoundingClientRect() : {}; window.__seen.push({ t: Math.round(performance.now()), cls: String(n.className).slice(0, 60), id: n.id, text: (n.innerText || '').trim().slice(0, 80), top: Math.round(r.top || 0), h: Math.round(r.height || 0), pos: getComputedStyle(n).position }); } }).observe(document.body, { childList: true, subtree: true });
    });
    const t0 = await page.evaluate(() => Math.round(performance.now()));
    await btn.click();
    await page.waitForTimeout(700);
    await shot(page, '02-list-after-add-0.7s');
    await page.waitForTimeout(3300);
    notes.addT0 = t0;
    notes.addMutations = (await page.evaluate(() => window.__seen)).filter((x) => x.text || /growl|message|notif|modal/i.test(x.cls)).slice(0, 12);
    notes.addState = await page.evaluate(() => ({ url: location.pathname, btnTexts: [...document.querySelectorAll('button')].filter((b) => /корзин/i.test(b.innerText)).slice(0, 3).map((b) => b.innerText.trim()), mini: (document.querySelector('#msMiniCart') || {}).innerText }));
  });

  await step('tapTargets', async () => {
    await go(SUB);
    notes.smallTaps = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; };
      const out = {};
      for (const el of [...document.querySelectorAll('a, button, input, select')].filter(vis)) {
        const r = el.getBoundingClientRect(); if (r.width >= 44 && r.height >= 44) continue;
        const zone = el.closest('header') ? 'шапка' : el.closest('footer') ? 'подвал' : el.closest('.pagination') ? 'пагинация' : el.closest('.breadcrumb') ? 'крошки' : el.closest('.product, .ms2_product') ? 'карточка товара' : 'прочее';
        out[zone] = out[zone] || { n: 0, ex: [] }; out[zone].n++;
        if (out[zone].ex.length < 4) out[zone].ex.push((el.innerText || el.value || el.title || el.className || el.tagName).toString().trim().slice(0, 28) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
      return out;
    });
    notes.pagination = await page.evaluate(() => { const p = document.querySelector('.pagination'); if (!p) return null; const r = p.getBoundingClientRect(); return { html: p.outerHTML.replace(/\s+/g, ' ').slice(0, 400), h: Math.round(r.height), items: [...p.querySelectorAll('a, span')].map((a) => a.innerText.trim() + ':' + Math.round(a.getBoundingClientRect().width) + 'x' + Math.round(a.getBoundingClientRect().height)).slice(0, 12) }; });
    notes.filters = await page.evaluate(() => [...document.querySelectorAll('[id*=filter], [class*=filter]')].slice(0, 6).map((e) => e.tagName.toLowerCase() + '#' + e.id + '.' + String(e.className).slice(0, 40) + ' vis=' + (e.getBoundingClientRect().height > 0) + ' text=' + (e.innerText || '').trim().slice(0, 40)));
    notes.totalProductsOnPage = await page.evaluate(() => document.querySelectorAll('.product').length);
    notes.listingScreens = await page.evaluate(() => +(document.documentElement.scrollHeight / innerHeight).toFixed(1));
    notes.footerStartScreens = await page.evaluate(() => { const f = document.querySelector('footer'); return f ? +((f.getBoundingClientRect().top + scrollY) / innerHeight).toFixed(1) : null; });
    notes.lastProductScreens = await page.evaluate(() => { const p = [...document.querySelectorAll('.product')].pop(); return p ? +((p.getBoundingClientRect().bottom + scrollY) / innerHeight).toFixed(1) : null; });
  });

  // back navigation: does the listing restore scroll position after product -> back?
  await step('back', async () => {
    await go(SUB); await dismiss();
    const links = page.locator('.product a[href*="/catalog/"]');
    const n = await links.count();
    const target = links.nth(Math.min(n - 1, 18));
    await target.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
    const y1 = await page.evaluate(() => Math.round(scrollY));
    await target.click(); await page.waitForLoadState('load'); await page.waitForTimeout(1500);
    const prodUrl = page.url();
    await page.goBack({ waitUntil: 'load' }); await page.waitForTimeout(2500);
    const y2 = await page.evaluate(() => Math.round(scrollY));
    notes.back = { scrollBefore: y1, scrollAfterBack: y2, restored: Math.abs(y1 - y2) < 200, prodUrl: prodUrl.replace(BASE, '').slice(0, 80) };
  });

  fs.writeFileSync(path.join(OUT, 'flow2.json'), JSON.stringify(notes, null, 1));
  await browser.close();
  console.log('flow2 done');
})();
