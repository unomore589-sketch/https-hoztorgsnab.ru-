// Interaction walk-through on mobile: menu, search, listing, product, cart, checkout.
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const OUT = process.argv[2];
const BASE = 'https://hoztorgsnab.ru';
const SUB = '/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/';
const PROD = SUB + 'meshok-dlya-musora-120-l.-rulon-bez-zavyazok,-5sht,-70-mkm-rossiya/';
const notes = {};
const shot = (page, n) => page.screenshot({ path: path.join(OUT, 'f-' + n + '.png') });
const box = async (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && r.height > 0, text: (el.innerText || el.value || '').trim().slice(0, 80) };
}, sel);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy: { server: process.env.HTTPS_PROXY } });
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'ru-RU' });
  const page = await ctx.newPage();
  const go = async (u) => { await page.goto(BASE + u, { waitUntil: 'load', timeout: 90000 }); await page.waitForTimeout(2500); };
  const step = async (name, fn) => { try { await fn(); } catch (e) { notes[name + '_error'] = String(e).slice(0, 300); } };

  // 1. cookie banner
  await step('cookie', async () => {
    await go('/');
    const b = await box(page, '#hts-cookie');
    notes.cookieBanner = b; notes.viewport = page.viewportSize();
    const btn = page.locator('#hts-cookie button, #hts-cookie a').filter({ hasText: 'Только необходимые' }).first();
    await btn.click({ timeout: 5000 });
    await page.waitForTimeout(800);
    notes.cookieAfter = await box(page, '#hts-cookie');
    await shot(page, '01-home-clean');
  });

  // 2. header geometry and what happens on scroll
  await step('header', async () => {
    notes.header = await box(page, 'header#header');
    notes.megamenu = await box(page, '#megamenu');
    notes.headerEndY = await page.evaluate(() => {
      const els = ['header#header', '#megamenu', '.header_user', '.header_cart'].map((s) => document.querySelector(s)).filter(Boolean);
      return Math.max(...els.map((e) => Math.round(e.getBoundingClientRect().bottom + scrollY)));
    });
    await page.evaluate(() => window.scrollTo(0, 1600));
    await page.waitForTimeout(700);
    notes.afterScroll = await page.evaluate(() => {
      const inView = (s) => [...document.querySelectorAll(s)].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; });
      return { searchVisible: inView('#search-field'), cartVisible: inView('#msMiniCart'), menuVisible: inView('.megamenu_mobile p'), toTop: inView('#back-top, .back-to-top, #toTop, .scrollup, .to-top') };
    });
    await shot(page, '02-home-scrolled');
  });

  // 3. mobile menu contents
  await step('menu', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const trig = await page.evaluate(() => {
      const c = [...document.querySelectorAll('.megamenu_mobile p, .megamenu_mobile > *, [class*=menu] button, .navbar-toggle')].filter((e) => e.getBoundingClientRect().width > 0);
      return c.map((e) => e.tagName + '.' + e.className + ':' + (e.innerText || '').trim().slice(0, 20)).slice(0, 6);
    });
    notes.menuTriggers = trig;
    await page.locator('.megamenu_mobile p').first().click({ timeout: 5000 });
    await page.waitForTimeout(900);
    notes.menuItems = await page.evaluate(() => [...document.querySelectorAll('.megamenu_mobile > ul > li')].filter((e) => e.getBoundingClientRect().height > 0).map((li) => (li.querySelector('a') || li).innerText.trim().slice(0, 40)));
    notes.menuAllVisibleLinks = await page.evaluate(() => [...document.querySelectorAll('.megamenu_mobile a')].filter((e) => e.getBoundingClientRect().height > 0).length);
    notes.menuHasCatalogLink = await page.evaluate(() => [...document.querySelectorAll('.megamenu_mobile a')].some((a) => /catalog/.test(a.getAttribute('href') || '')));
    notes.menuTotalLinks = await page.evaluate(() => document.querySelectorAll('.megamenu_mobile a').length);
    await shot(page, '03-menu-open');
    // expand "О нас"
    const about = page.locator('.megamenu_mobile > ul > li > a', { hasText: 'О нас' }).first();
    if (await about.count()) { await about.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(700); await shot(page, '03b-menu-about'); }
  });

  // 4. how does a mobile user reach the catalogue from home?
  await step('catalogEntry', async () => {
    await go('/');
    notes.homeCatalogLinks = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const links = [...document.querySelectorAll('a[href*="/catalog/"]')].filter(vis);
      return { count: links.length, firstY: links.length ? Math.round(links[0].getBoundingClientRect().top + scrollY) : null, first: links.slice(0, 5).map((a) => a.innerText.trim().slice(0, 30) + ' @' + Math.round(a.getBoundingClientRect().top + scrollY)) };
    });
  });

  // 5. search: autocomplete, typos, empty
  await step('search', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    const f = page.locator('#search-field').first();
    await f.click(); await f.type('мешк', { delay: 120 });
    await page.waitForTimeout(3500);
    notes.autocomplete = await page.evaluate(() => {
      const ul = [...document.querySelectorAll('.ui-autocomplete, .mse2-ac-wrapper, .ui-menu')].filter((e) => e.getBoundingClientRect().height > 0)[0];
      if (!ul) return null;
      const r = ul.getBoundingClientRect();
      const items = [...ul.querySelectorAll('li')];
      return { w: Math.round(r.width), h: Math.round(r.height), items: items.length, itemH: items[0] ? Math.round(items[0].getBoundingClientRect().height) : 0, hasImg: !!ul.querySelector('img'), hasPrice: /руб|₽/i.test(ul.innerText), sample: ul.innerText.trim().slice(0, 200) };
    });
    await shot(page, '04-search-autocomplete');
    const count = async (q) => {
      await go('/poisk.html?query=' + encodeURIComponent(q));
      return page.evaluate(() => {
        const t = document.querySelector('#mse2_total, .mse2_total, #mse2_results'); const body = document.querySelector('.page_content, #main').innerText;
        const m = body.match(/[Нн]айдено[^0-9]{0,40}(\d+)/);
        return { total: m ? +m[1] : null, cards: document.querySelectorAll('#mse2_results .ms2_product, #mse2_results .product, #mse2_results .row > div, .mse2-row').length, snippet: body.replace(/\s+/g, ' ').slice(0, 160) };
      });
    };
    notes.q_ok = await count('мешки');
    await shot(page, '05-search-results');
    notes.searchPage = await page.evaluate(() => ({
      hasSort: !!document.querySelector('#mse2_sort, .mse2_sort, [data-sort]'), hasFilters: !!document.querySelector('#mse2_filters, .mse2_filters, form[id*=filter]'),
      addToCartInList: document.querySelectorAll('#mse2_results button[type=submit], #mse2_results .btn, #mse2_results [name=ms2_action]').length,
    }));
    notes.q_typo = await count('мешкы');
    notes.q_typo2 = await count('пирчатки');
    notes.q_layout = await count('vtirb');           // "мешки" typed in the Latin layout
    notes.q_article = await count('50032');          // article number seen in the order
    notes.q_syn = await count('пакеты для мусора');  // synonym of "мешки для мусора"
    notes.q_none = await count('zzzqqq');
    await shot(page, '06-search-empty');
  });

  // 6. listing page
  await step('listing', async () => {
    await go(SUB);
    notes.listing = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const cards = [...document.querySelectorAll('.ms2_product, .product, .product-layout, [class*=product_item]')].filter(vis);
      const c = cards[0];
      const firstProdLink = [...document.querySelectorAll('a[href*="meshok-dlya-musora"]')].filter(vis)[0];
      return {
        cardSel: c ? c.className : null, cards: cards.length, cardW: c ? Math.round(c.getBoundingClientRect().width) : null, cardH: c ? Math.round(c.getBoundingClientRect().height) : null,
        perRow: c ? Math.round(innerWidth / c.getBoundingClientRect().width) : null,
        firstProductY: firstProdLink ? Math.round(firstProdLink.getBoundingClientRect().top + scrollY) : null, vh: innerHeight,
        buyButtons: [...document.querySelectorAll('button[type=submit], .btn, [name=ms2_action]')].filter(vis).filter((b) => /корзин|купить|заказ/i.test(b.innerText || b.value || '')).length,
        hasSort: !!document.querySelector('[id*=sort], [class*=sort]'), hasFilter: !!document.querySelector('[id*=filter], [class*=filter]'),
        pagination: !!document.querySelector('.pagination'), paginationLinks: document.querySelectorAll('.pagination a').length,
        breadcrumbs: (document.querySelector('.breadcrumb') || {}).innerText || null, breadcrumbVisible: document.querySelector('.breadcrumb') ? vis(document.querySelector('.breadcrumb')) : false,
        priceSamples: [...document.querySelectorAll('[class*=price]')].filter(vis).slice(0, 3).map((e) => e.innerText.trim().slice(0, 30)),
      };
    });
    await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 80)), notes.listing.firstProductY || 900);
    await page.waitForTimeout(600);
    await shot(page, '07-listing-cards');
  });

  // 7. product page: where is the buy button, is it reachable
  await step('product', async () => {
    await go(PROD);
    notes.product = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const y = (e) => Math.round(e.getBoundingClientRect().top + scrollY);
      const btn = [...document.querySelectorAll('button, input[type=submit], .btn')].filter(vis).find((b) => /корзин|купить/i.test(b.innerText || b.value || ''));
      const price = [...document.querySelectorAll('[class*=price]')].filter(vis)[0];
      const h1 = document.querySelector('h1');
      const cnt = document.querySelector('input[name=count]');
      const tabs = [...document.querySelectorAll('.nav-tabs li, [role=tab]')].filter(vis).map((e) => e.innerText.trim());
      return {
        vh: innerHeight, h1: h1 ? h1.innerText.trim().slice(0, 90) : null, h1Y: h1 ? y(h1) : null,
        priceY: price ? y(price) : null, priceText: price ? price.innerText.trim().slice(0, 40) : null,
        buyY: btn ? y(btn) : null, buyText: btn ? (btn.innerText || btn.value).trim() : null, buyH: btn ? Math.round(btn.getBoundingClientRect().height) : null,
        count: cnt ? { type: cnt.type, inputmode: cnt.getAttribute('inputmode'), fs: getComputedStyle(cnt).fontSize, hasStepper: !!cnt.closest('form, div').querySelector('[class*=plus], [class*=minus], .qty-btn, [class*=inc], [class*=dec]') } : null,
        tabs, gallerySwipe: !!document.querySelector('.swiper, .slick-slider, .owl-carousel, .fotorama, [class*=carousel]'),
        galleryImgs: document.querySelectorAll('#msGallery img, .msGallery img, [id*=gallery] img').length,
        stock: /в наличии|под заказ|нет в наличии/i.test(document.body.innerText), related: /похожие|с этим товаром|рекомендуем|сопутств/i.test(document.body.innerText),
        breadcrumbVisible: document.querySelector('.breadcrumb') ? vis(document.querySelector('.breadcrumb')) : false, breadcrumbY: document.querySelector('.breadcrumb') ? y(document.querySelector('.breadcrumb')) : null,
      };
    });
    await page.evaluate((yy) => window.scrollTo(0, Math.max(0, yy - 420)), notes.product.buyY || 800);
    await page.waitForTimeout(600);
    await shot(page, '08-product-buy');
    // add to cart
    const btn = page.locator('button, input[type=submit]').filter({ hasText: /корзин|Купить/i }).first();
    await btn.click({ timeout: 6000 });
    await page.waitForTimeout(2500);
    notes.afterAdd = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
      const msg = [...document.querySelectorAll('.jGrowl-notification, .ms2-message-success, .jGrowl, [class*=growl], .modal.in, .fancybox-opened')].filter(vis).map((e) => e.innerText.trim().slice(0, 100));
      const mini = document.querySelector('#msMiniCart'); const r = mini ? mini.getBoundingClientRect() : null;
      return { messages: msg, miniCartInView: r ? r.bottom > 0 && r.top < innerHeight : false, miniCartText: mini ? mini.innerText.replace(/\s+/g, ' ').trim().slice(0, 80) : null, url: location.pathname };
    });
    await shot(page, '09-after-add');
  });

  // 8. cart with an item, then checkout form
  await step('cart', async () => {
    await go('/cart.html');
    notes.cart = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const t = document.querySelector('#msCart table, #msCart'); const tr = t ? t.getBoundingClientRect() : null;
      const cnt = [...document.querySelectorAll('#msCart input[name=count]')].filter(vis)[0];
      const next = [...document.querySelectorAll('a, button')].filter(vis).find((b) => /оформ/i.test(b.innerText || ''));
      return {
        isTable: !!document.querySelector('#msCart table'), tableW: tr ? Math.round(tr.width) : null, vw: innerWidth, overflowX: document.documentElement.scrollWidth > innerWidth + 1,
        wrapperScroll: [...document.querySelectorAll('#msCart .table-responsive')].map((e) => e.scrollWidth + '/' + e.clientWidth),
        countInput: cnt ? { type: cnt.type, inputmode: cnt.getAttribute('inputmode'), w: Math.round(cnt.getBoundingClientRect().width), h: Math.round(cnt.getBoundingClientRect().height) } : null,
        hasStepper: !!document.querySelector('#msCart [class*=plus], #msCart [class*=minus]'),
        removeBtn: (() => { const b = [...document.querySelectorAll('#msCart button, #msCart a')].filter(vis).find((x) => /удал|remove|×/i.test((x.title || '') + x.innerText + x.className + (x.value || ''))); if (!b) return null; const r = b.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); })(),
        checkoutBtn: next ? { text: next.innerText.trim().slice(0, 40), y: Math.round(next.getBoundingClientRect().top + scrollY), h: Math.round(next.getBoundingClientRect().height), href: next.getAttribute('href') } : null,
        minOrderHint: /3\s?000|минимальн/i.test((document.querySelector('.page_content, #main') || document.body).innerText),
        text: (document.querySelector('#msCart') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 260),
      };
    });
    await page.evaluate(() => { const c = document.querySelector('#msCart'); if (c) window.scrollTo(0, c.getBoundingClientRect().top + scrollY - 20); });
    await page.waitForTimeout(500);
    await shot(page, '10-cart');
    const href = (notes.cart.checkoutBtn && notes.cart.checkoutBtn.href) || null;
    const candidates = [href, '/oformlenie-zakaza.html', '/order.html'].filter(Boolean);
    for (const c of candidates) {
      const r = await page.goto(c.startsWith('http') ? c : BASE + (c.startsWith('/') ? c : '/' + c), { waitUntil: 'load', timeout: 60000 }).catch(() => null);
      await page.waitForTimeout(2000);
      if (r && r.status() === 200 && await page.locator('#msOrder').count()) { notes.checkoutUrl = c; break; }
    }
    notes.checkout = await page.evaluate(() => {
      const f = document.querySelector('#msOrder'); if (!f) return null;
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const ins = [...f.querySelectorAll('input:not([type=hidden]), textarea, select')].filter(vis);
      const sub = f.querySelector('[type=submit]');
      return {
        fields: ins.map((i) => ({ name: i.name, type: i.type, inputmode: i.getAttribute('inputmode'), autocomplete: i.getAttribute('autocomplete'), fs: getComputedStyle(i).fontSize, required: i.required })),
        requiredTextFields: [...f.querySelectorAll('.hts-req')].length, formH: Math.round(f.getBoundingClientRect().height), screens: +(f.getBoundingClientRect().height / innerHeight).toFixed(1),
        submitY: sub ? Math.round(sub.getBoundingClientRect().top + scrollY) : null, guest: true,
        labels: [...f.querySelectorAll('label')].filter(vis).map((l) => l.innerText.trim().slice(0, 40)).slice(0, 20),
      };
    });
    const f = page.locator('#msOrder'); if (await f.count()) { await f.scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await shot(page, '11-checkout'); await page.screenshot({ path: path.join(OUT, 'f-11-checkout-full.png'), fullPage: true }); }
  });

  fs.writeFileSync(path.join(OUT, 'flow.json'), JSON.stringify(notes, null, 1));
  await browser.close();
  console.log('flow done');
})();
