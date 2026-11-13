// Mobile audit of hoztorgsnab.ru: per-page metrics + screenshots.
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2];
const BASE = 'https://hoztorgsnab.ru';
const PAGES = [
  ['home', '/'],
  ['catalog', '/catalog/'],
  ['category', '/catalog/meshki-dlya-musora/'],
  ['subcategory', '/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/'],
  ['product', '/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/meshok-dlya-musora-120-l.-rulon-bez-zavyazok,-5sht,-70-mkm-rossiya/'],
  ['search', '/poisk.html?query=' + encodeURIComponent('мешки')],
  ['cart', '/cart.html'],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    proxy: { server: process.env.HTTPS_PROXY },
  });
  const results = {};
  for (const [name, url] of PAGES) {
    const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'ru-RU' });
    const page = await ctx.newPage();
    const reqs = [];
    page.on('response', async (r) => {
      try {
        const h = r.headers();
        const req = r.request();
        let size = parseInt(h['content-length'] || '0', 10);
        if (!size) { try { size = (await r.body()).length; } catch (e) {} }
        reqs.push({ url: r.url(), type: req.resourceType(), status: r.status(), size, enc: h['content-encoding'] || '', cache: h['cache-control'] || '' });
      } catch (e) {}
    });
    await page.addInitScript(() => {
      window.__lcp = 0; window.__cls = 0;
      try {
        new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      } catch (e) {}
    });
    const t0 = Date.now();
    let err = null;
    try {
      await page.goto(BASE + url, { waitUntil: 'load', timeout: 90000 });
      await page.waitForTimeout(3500);
    } catch (e) { err = String(e).slice(0, 200); }
    const wall = Date.now() - t0;

    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const vw = window.innerWidth, vh = window.innerHeight;
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
      const taps = [...document.querySelectorAll('a, button, input, select, textarea, [onclick], [role=button]')].filter(vis);
      const small = taps.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
      const tiny = taps.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 24 || r.height < 24; });
      // text smaller than 12px
      let smallText = 0, totalText = 0;
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode; const t = n.nodeValue.trim(); if (t.length < 2) continue;
        const p = n.parentElement; if (!p || !vis(p)) continue;
        totalText += t.length;
        if (parseFloat(getComputedStyle(p).fontSize) < 12) smallText += t.length;
      }
      const wide = [...document.querySelectorAll('body *')].filter((el) => vis(el) && el.getBoundingClientRect().right > vw + 2).length;
      const inputs = [...document.querySelectorAll('input:not([type=hidden]), textarea, select')].filter(vis).map((i) => ({
        name: i.name || i.id, type: i.type, fs: parseFloat(getComputedStyle(i).fontSize), inputmode: i.getAttribute('inputmode'), ac: i.getAttribute('autocomplete'), h: Math.round(i.getBoundingClientRect().height),
      }));
      const fixed = [...document.querySelectorAll('body *')].filter((el) => { const p = getComputedStyle(el).position; return (p === 'fixed' || p === 'sticky') && vis(el); }).map((el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]));
      const imgs = [...document.images];
      return {
        title: document.title,
        viewportMeta: (document.querySelector('meta[name=viewport]') || {}).content || null,
        lang: document.documentElement.lang,
        ttfb: Math.round(nav.responseStart || 0), dcl: Math.round(nav.domContentLoadedEventEnd || 0), load: Math.round(nav.loadEventEnd || 0),
        lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3),
        docHeight: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / vh).toFixed(1),
        hScroll: document.documentElement.scrollWidth > vw + 1, scrollWidth: document.documentElement.scrollWidth, vw,
        elementsBeyondViewport: wide,
        tapTotal: taps.length, tapSmall: small.length, tapTiny: tiny.length,
        smallTextPct: totalText ? Math.round((smallText / totalText) * 100) : 0,
        domNodes: document.querySelectorAll('*').length,
        inputs, fixed: [...new Set(fixed)].slice(0, 12),
        imgTotal: imgs.length, imgLazy: imgs.filter((i) => i.loading === 'lazy').length, imgNoDims: imgs.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length,
        imgOversized: imgs.filter((i) => i.naturalWidth && i.clientWidth && i.naturalWidth > i.clientWidth * 3 * 1.5).length,
        hasManifest: !!document.querySelector('link[rel=manifest]'), hasSW: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
        themeColor: (document.querySelector('meta[name=theme-color]') || {}).content || null,
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].length,
        telLinks: document.querySelectorAll('a[href^="tel:"]').length,
        phoneTextNotLink: [...document.querySelectorAll('.phones, .footerphone')].filter((e) => !e.closest('a') && !e.querySelector('a[href^="tel:"]')).length,
      };
    }).catch((e) => ({ evalError: String(e).slice(0, 200) }));

    const byType = {};
    let total = 0;
    for (const r of reqs) { byType[r.type] = byType[r.type] || { n: 0, bytes: 0 }; byType[r.type].n++; byType[r.type].bytes += r.size; total += r.size; }
    const hosts = {};
    for (const r of reqs) { try { const h = new URL(r.url).host; hosts[h] = (hosts[h] || 0) + 1; } catch (e) {} }
    const big = reqs.slice().sort((a, b) => b.size - a.size).slice(0, 8).map((r) => ({ kb: Math.round(r.size / 1024), type: r.type, url: r.url.replace(BASE, '').slice(0, 110) }));
    const failed = reqs.filter((r) => r.status >= 400).map((r) => r.status + ' ' + r.url.slice(0, 100));
    const imgFormats = {};
    for (const r of reqs.filter((x) => x.type === 'image')) { const ext = (r.url.split('?')[0].match(/\.(\w{3,4})$/) || [, 'other'])[1].toLowerCase(); imgFormats[ext] = (imgFormats[ext] || 0) + 1; }

    results[name] = { url, err, wall, ...m, requests: reqs.length, transferKB: Math.round(total / 1024), byType, hosts, big, failed, imgFormats };

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(OUT, name + '-top.png') });
    await page.screenshot({ path: path.join(OUT, name + '-full.png'), fullPage: true }).catch(() => {});
    await ctx.close();
    console.log(name, 'done', wall + 'ms');
  }
  fs.writeFileSync(path.join(OUT, 'metrics.json'), JSON.stringify(results, null, 1));
  await browser.close();
})();
