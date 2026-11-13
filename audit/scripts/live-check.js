// Post-deploy check of the live site: nothing is injected, we only use the pages as a visitor would.
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const BASE='https://hoztorgsnab.ru', SUB='/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/';
const OUT=process.argv[2];
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}});
  const out={};
  for (const [mode, opts] of [['phone',{...devices['Pixel 7'],locale:'ru-RU'}],['desktop',{viewport:{width:1280,height:900},locale:'ru-RU'}]]) {
    const ctx=await b.newContext(opts); const p=await ctx.newPage(); const o=out[mode]={}; const errs=[]; const reqs=[];
    p.on('pageerror',e=>errs.push(String(e.stack||e).split('\n').slice(0,2).join(' | ').slice(0,220)));
    p.on('request',r=>{ if(/minishop2\/action\.php/.test(r.url())) reqs.push((r.postData()||'').replace(/key=\w+&/,'').slice(0,60)); });
    const go=async u=>{await p.goto(BASE+u,{waitUntil:'load',timeout:90000});await p.waitForTimeout(2500);};
    const dismiss=async()=>{const c=p.locator('#hts-cookie').getByText('Только необходимые').first(); if(await c.isVisible().catch(()=>false)){await c.click();await p.waitForTimeout(400);}};
    const count=()=>p.evaluate(()=>document.querySelectorAll('#mse2_results .product').length);
    await go(SUB); await dismiss();
    o.filters=await p.evaluate(()=>{const bar=document.querySelector('.hts-f-bar'); const btn=document.querySelector('.hts-f-open'); const side=document.querySelector('.sidebar_right');
      return {chunkOnPage:!!document.querySelector('script') && document.documentElement.innerHTML.indexOf('htsFiltersBound')>-1, barExists:!!bar, barDisplay:bar?getComputedStyle(bar).display:null, btnSize:btn?Math.round(btn.getBoundingClientRect().width)+'x'+Math.round(btn.getBoundingClientRect().height):null, sidebarDisplay:getComputedStyle(side).display, products:document.querySelectorAll('#mse2_results .product').length, rawTag:document.body.innerText.indexOf('HtsMobileFilters')>-1};});
    if (mode==='phone') {
      await p.locator('.hts-f-open').scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,-150)); await p.waitForTimeout(300);
      await p.screenshot({path:OUT+'/live-filters-button.png'});
      await p.locator('.hts-f-open').click(); await p.waitForTimeout(500);
      await p.locator('#mse2_filters label',{hasText:'120 л.'}).first().click(); await p.waitForTimeout(3500);
      o.f120={products:await count(), show:await p.locator('.hts-f-show').innerText(), badge:await p.locator('.hts-f-n').innerText()};
      await p.screenshot({path:OUT+'/live-filters-open.png'});
      await p.locator('.hts-f-show').click(); await p.waitForTimeout(600);
      o.fClosed=await p.evaluate(()=>({open:document.documentElement.classList.contains('hts-f-on'), products:document.querySelectorAll('#mse2_results .product').length}));
      await p.locator('.hts-f-open').click(); await p.waitForTimeout(300); await p.locator('.hts-f-reset').click(); await p.waitForTimeout(3500);
      o.fReset={products:await count()}; await p.locator('.hts-f-close').click(); await p.waitForTimeout(300);
    }
    await go(SUB); await dismiss();  // fresh page: the list was just re-rendered by the filter reset
    await p.evaluate(()=>{const b=[...document.querySelectorAll('#mse2_results button')].find(x=>/в корзину/i.test(x.innerText)); b.scrollIntoView({block:'center'}); b.click();}); await p.waitForTimeout(2500);
    await go('/cart.html'); await dismiss();
    const state=()=>p.evaluate(()=>{const c=document.querySelector('#msCart'); const i=c.querySelector('input[name=count]'); const r=i?i.getBoundingClientRect():null; const bs=[...c.querySelectorAll('.hts-qty-btn')];
      const row=i?i.closest('form').parentElement:null; const code=[...c.querySelectorAll('div')].map(d=>d.childElementCount===0?d.innerText.trim():'').find(t=>/^Код:/.test(t));
      return {count:i?i.value:null, inputVisible:r?r.width>0&&r.height>0:false, inputSize:r?Math.round(r.width)+'x'+Math.round(r.height):null, buttons:bs.length, btnSize:bs[0]?Math.round(bs[0].getBoundingClientRect().width)+'x'+Math.round(bs[0].getBoundingClientRect().height):null, oldStepper:!!c.querySelector('.stepper'),
        oneRow:row?(()=>{const t=[...row.children].map(x=>Math.round(x.getBoundingClientRect().top)); return Math.max(...t)-Math.min(...t)<20})():null,
        totalCount:(c.querySelector('.ms2_total_count')||{}).innerText, totalCost:(c.querySelector('.ms2_total_cost')||{}).innerText, warn:(c.querySelector('.hts-min-warn')||{}).innerText, code, rawBraces:/\{\$|\{if |\{foreach|\{ignore\}|\[\[/.test(c.innerText), items:c.querySelectorAll('[data-id]').length, hScroll:document.documentElement.scrollWidth>innerWidth+1};});
    o.cartStart=await state();
    await p.evaluate(()=>{const c=document.querySelector('#msCart');window.scrollTo(0,c.getBoundingClientRect().top+scrollY-20)}); await p.waitForTimeout(300);
    await p.screenshot({path:OUT+'/live-cart-'+mode+'.png'});
    const plus=()=>p.locator('#msCart .hts-qty-btn[data-step="1"]').first(), minus=()=>p.locator('#msCart .hts-qty-btn[data-step="-1"]').first();
    if (o.cartStart.buttons) {
      await plus().click(); await plus().click(); await plus().click(); await p.waitForTimeout(3000); o.cartPlus3=await state();
      await minus().click(); await p.waitForTimeout(3000); o.cartMinus=await state();
      const inp=p.locator('#msCart input[name=count]').first(); await inp.fill('30'); await inp.blur(); await p.waitForTimeout(3000); o.cartTyped30=await state();
      await p.screenshot({path:OUT+'/live-cart-'+mode+'-30.png'});
      await p.reload({waitUntil:'load'}); await p.waitForTimeout(2000); o.cartAfterReload=await state();
    }
    o.requests=reqs; o.errors=errs;
    for(let i=0;i<3;i++){ const rm=p.locator('#msCart button[value="cart/remove"]').first(); if(await rm.count()){ await rm.click(); await p.waitForTimeout(1500);} else break; }
    o.cartEmptied=await p.evaluate(()=>document.querySelectorAll('#msCart [data-id]').length===0);
    await ctx.close();
  }
  console.log(JSON.stringify(out,null,1)); await b.close();
})();
