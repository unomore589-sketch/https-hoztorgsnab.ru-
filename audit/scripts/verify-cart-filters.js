// Apply the new chunk code to the live pages in the browser only (nothing is saved on the site) and exercise it.
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const REPO='/home/user/https-hoztorgsnab.ru-/modx-chunks/';
const BASE='https://hoztorgsnab.ru', SUB='/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/';
const OUT=process.argv[2];
const cart=fs.readFileSync(REPO+'tpl.msCart.html','utf8');
const cartCss=cart.match(/<style>([\s\S]*?)<\/style>/)[1];
const cartJs=cart.match(/<script>([\s\S]*?)\/\* Минимальная сумма заказа/)[1];
const filt=fs.readFileSync(REPO+'hts-mobile-filters.html','utf8');
const filtCss=filt.match(/<style>([\s\S]*?)<\/style>/)[1];
const filtJs=filt.match(/<script>([\s\S]*?)<\/script>/)[1];
const reqs=[];
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}});
  const ctx=await b.newContext({...devices['Pixel 7'],locale:'ru-RU'}); const p=await ctx.newPage(); const out={};
  const errs=[]; p.on('pageerror',e=>errs.push({url:p.url().replace(BASE,'').slice(0,40), reqs:(typeof reqs!=='undefined'?reqs.length:-1), stack:String(e.stack||e).split('\n').slice(0,5).join(' | ').slice(0,500)}));
  const go=async u=>{await p.goto(BASE+u,{waitUntil:'load',timeout:90000});await p.waitForTimeout(2500);};
  const dismiss=async()=>{const c=p.locator('#hts-cookie').getByText('Только необходимые').first(); if(await c.isVisible().catch(()=>false)){await c.click();await p.waitForTimeout(400);}};

  // ---------- FILTERS ----------
  await go(SUB); await dismiss();
  await p.addStyleTag({content:filtCss}); await p.addScriptTag({content:filtJs}); await p.waitForTimeout(400);
  await p.evaluate(()=>{ window.__mse=[]; jQuery(document).on('mse2_load',function(e,r){ window.__mse.push(r&&r.data? {total:r.data.total, keys:Object.keys(r.data).slice(0,12)}: String(r)); }); });
  const count=()=>p.evaluate(()=>document.querySelectorAll('#mse2_results .product').length);
  out.f_before={products:await count(), bar:await p.evaluate(()=>{const b=document.querySelector('.hts-f-open'); const r=b.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height),y:Math.round(r.top+scrollY),vis:getComputedStyle(b).display};})};
  await p.locator('.hts-f-open').scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,-120)); await p.waitForTimeout(300);
  await p.screenshot({path:OUT+'/v-filters-button.png'});
  // sticky check
  await p.evaluate(()=>window.scrollBy(0,1500)); await p.waitForTimeout(400); out.cookie=await p.evaluate(()=>{const c=document.querySelector('#hts-cookie'); return c?{parent:c.parentElement.tagName+'#'+c.parentElement.id, z:getComputedStyle(c).zIndex}:null});
  out.f_sticky=await p.evaluate(()=>{const r=document.querySelector('.hts-f-bar').getBoundingClientRect(); return {top:Math.round(r.top), inView:r.top>=0&&r.top<innerHeight};});
  await p.screenshot({path:OUT+'/v-filters-sticky.png'});
  await p.evaluate(()=>window.scrollTo(0,document.querySelector('.hts-f-bar').getBoundingClientRect().top+scrollY-200)); await p.locator('.hts-f-open').click(); await p.waitForTimeout(500);
  out.f_open=await p.evaluate(()=>{const s=document.querySelector('.sidebar_right'); const r=s.getBoundingClientRect(); const lab=document.querySelector('#mse2_filters label').getBoundingClientRect(); const cookie=document.querySelector('#hts-cookie');
    return {sheet:{top:Math.round(r.top),h:Math.round(r.height),w:Math.round(r.width),bottom:Math.round(r.bottom)}, vh:innerHeight, labelH:Math.round(lab.height), visibleKids:[...s.children].filter(c=>getComputedStyle(c).display!=='none').map(c=>c.className||c.id), hScroll:document.documentElement.scrollWidth>innerWidth+1, cookieZ:cookie?getComputedStyle(cookie).zIndex:null, formScrollable:(()=>{const f=document.querySelector('#mse2_filters');return f.scrollHeight+'/'+f.clientHeight})()};});
  await p.screenshot({path:OUT+'/v-filters-open.png'});
  // tick "120 л."
  await p.locator('#mse2_filters label',{hasText:'120 л.'}).first().click(); await p.waitForTimeout(3500);
  out.f_after120={products:await count(), mse:await p.evaluate(()=>window.__mse), showText:await p.locator('.hts-f-show').innerText(), badge:await p.locator('.hts-f-n').innerText(), url:await p.evaluate(()=>decodeURIComponent(location.search+location.hash)).then(s=>s.slice(0,120))};
  await p.screenshot({path:OUT+'/v-filters-checked.png'});
  await p.locator('.hts-f-show').click(); await p.waitForTimeout(700);
  out.f_closed=await p.evaluate(()=>({on:document.documentElement.classList.contains('hts-f-on'), sidebarDisplay:getComputedStyle(document.querySelector('.sidebar_right')).display, products:document.querySelectorAll('#mse2_results .product').length, names:[...document.querySelectorAll('#mse2_results .product .product_name')].map(e=>e.innerText.trim().slice(0,40))}));
  await p.screenshot({path:OUT+'/v-filters-result.png'});
  // reset
  await p.locator('.hts-f-open').click(); await p.waitForTimeout(400); await p.locator('.hts-f-reset').click(); await p.waitForTimeout(3500);
  out.f_reset={products:await count(), badgeVisible:await p.evaluate(()=>getComputedStyle(document.querySelector('.hts-f-n')).display), showText:await p.locator('.hts-f-show').innerText(), checked:await p.evaluate(()=>document.querySelectorAll('#mse2_filters input:checked').length)};
  await p.locator('.hts-f-close').click(); await p.waitForTimeout(300);

  // ---------- CART ----------
  const btn=p.locator('#mse2_results button').filter({hasText:/в корзину/i}).first(); await btn.scrollIntoViewIfNeeded(); await btn.click(); await p.waitForTimeout(2000);
  await go('/cart.html'); await dismiss();
  p.on('request',r=>{ if(/minishop2\/action\.php/.test(r.url())) reqs.push((r.postData()||'').slice(0,160)); });
  // turn the live markup into what the new chunk renders (miniShop2 re-renders the cart from the
  // server after every change, with the OLD chunk until the new one is saved, so re-apply each time)
  const transform=()=>p.evaluate(()=>{ document.querySelectorAll('#msCart form.ms2_form').forEach(f=>{ const inp=f.querySelector('input[name=count]'); if(!inp||f.classList.contains('hts-qty')) return; const v=inp.value;
      const key=f.querySelector('input[name=key]').outerHTML; const sub=f.querySelector('button[value="cart/change"]').outerHTML;
      f.removeAttribute('style'); f.className='ms2_form hts-qty';
      f.innerHTML=key+'<button type="button" class="hts-qty-btn" data-step="-1" aria-label="Уменьшить количество">&minus;</button><input type="number" name="count" class="product__count only_digit hts-qty-input" inputmode="numeric" min="1" value="'+v+'" aria-label="Количество"/><button type="button" class="hts-qty-btn" data-step="1" aria-label="Увеличить количество">+</button>'+sub; }); });
  await transform();
  await p.addStyleTag({content:cartCss}); await p.addScriptTag({content:cartJs}); await p.waitForTimeout(300);
  const state=()=>p.evaluate(()=>{const i=document.querySelector('#msCart input[name=count]'); const r=i?i.getBoundingClientRect():null; const b=document.querySelector('#msCart .hts-qty-btn'); const br=b?b.getBoundingClientRect():null;
    const row=i?i.closest('form').parentElement:null; const kids=row?[...row.children].map(c=>Math.round(c.getBoundingClientRect().top)):[];
    return {count:i?i.value:null, inputVisible:r?r.width>0&&r.height>0:false, inputSize:r?Math.round(r.width)+'x'+Math.round(r.height):null, btnSize:br?Math.round(br.width)+'x'+Math.round(br.height):null, btnStillThere:!!b, rowTops:kids, totalCount:(document.querySelector('.ms2_total_count')||{}).innerText, totalCost:(document.querySelector('.ms2_total_cost')||{}).innerText, warn:(document.querySelector('.hts-min-warn')||{}).innerText, hScroll:document.documentElement.scrollWidth>innerWidth+1};});
  out.c_start=await state();
  await p.evaluate(()=>{const c=document.querySelector('#msCart');window.scrollTo(0,c.getBoundingClientRect().top+scrollY-20)}); await p.waitForTimeout(300);
  await p.screenshot({path:OUT+'/v-cart-before-click.png'});
  const plus=p.locator('#msCart .hts-qty-btn[data-step="1"]').first();
  await plus.click(); await plus.click(); await plus.click(); await p.waitForTimeout(3000);
  out.c_rerendered=await p.evaluate(()=>!document.querySelector('#msCart .hts-qty-btn')); await transform(); out.c_plus3=await state(); out.c_requests_after_plus=reqs.slice();
  await p.screenshot({path:OUT+'/v-cart-after-plus.png'});
  const minus=p.locator('#msCart .hts-qty-btn[data-step="-1"]').first();
  if(await minus.count()){ await minus.click(); await p.waitForTimeout(3000); } await transform();
  out.c_minus1=await state();
  // typing a number directly
  const inp=p.locator('#msCart input[name=count]').first();
  if(await inp.count()){ await inp.fill('30'); await inp.blur(); await p.waitForTimeout(3000); } await transform();
  out.c_typed30=await state(); out.c_requests_all=reqs.slice();
  await p.screenshot({path:OUT+'/v-cart-30.png'});
  // "−" must not go below 1
  if(await inp.count()){ await p.locator('#msCart input[name=count]').first().fill('1'); await p.locator('#msCart input[name=count]').first().blur(); await p.waitForTimeout(2500); await transform(); const m=p.locator('#msCart .hts-qty-btn[data-step="-1"]').first(); if(await m.count()){ await m.click(); await p.waitForTimeout(1500);} } await transform();
  out.c_floor=await state();
  out.errors=errs;
  // leave the guest cart empty
  const rm=p.locator('#msCart button[value="cart/remove"]').first(); if(await rm.count()){ await rm.click(); await p.waitForTimeout(1500); }
  console.log(JSON.stringify(out,null,1)); await b.close();
})();
