// Inject the HtsListQty chunk into live listing pages (browser only, nothing saved on the site) and exercise it.
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs');
const chunk=fs.readFileSync('/home/user/https-hoztorgsnab.ru-/modx-chunks/hts-list-qty.html','utf8');
const CSS=chunk.match(/<style>([\s\S]*?)<\/style>/)[1], JS=chunk.match(/<script>([\s\S]*?)<\/script>/)[1];
const BASE='https://hoztorgsnab.ru', SUB='/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/', OUT=process.argv[2];
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}});
  const out={};
  // ---------------- PHONE ----------------
  const ctx=await b.newContext({...devices['Pixel 7'],locale:'ru-RU'}); const p=await ctx.newPage();
  const errs=[], reqs=[]; p.on('pageerror',e=>errs.push(String(e.stack||e).split('\n').slice(0,2).join(' | ').slice(0,200)));
  p.on('request',r=>{ if(/minishop2\/action\.php/.test(r.url())) reqs.push((r.postData()||'').replace(/key=\w+&?/,'').replace(/options[^&]*&?/g,'').slice(0,60)); });
  const inject=async()=>{ const live=await p.evaluate(()=>window.htsListQtyBound===true); out.liveChunk=(out.liveChunk||[]).concat(live); if(!live) throw new Error('chunk HtsListQty is NOT on the live page'); await p.waitForTimeout(300); };
  const go=async u=>{ await p.goto(BASE+u,{waitUntil:'load',timeout:90000}); await p.waitForTimeout(2200); const c=p.locator('#hts-cookie').getByText('Только необходимые').first(); if(await c.isVisible().catch(()=>false)){await c.click();await p.waitForTimeout(300);} };
  const clean=()=>p.evaluate(async()=>{await fetch('/assets/components/minishop2/action.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:'ms2_action=cart%2Fclean&ctx=web'});});
  const F=i=>`#mse2_results .product:nth-of-type(1)`; // not used
  const card=i=>p.locator('#mse2_results form.hts-lq-form').nth(i);
  const st=i=>p.evaluate(i=>{const f=document.querySelectorAll('#mse2_results form.hts-lq-form')[i]; if(!f) return null; const inp=f.querySelector('input[name=count]'); const vis=e=>!!e&&e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none';
    const btns=f.querySelectorAll('.hts-lq-btn'); const r=x=>x?Math.round(x.getBoundingClientRect().width)+'x'+Math.round(x.getBoundingClientRect().height):null;
    return {name:(f.closest('.product').querySelector('.product_name')||{}).innerText.trim().slice(0,28), val:inp.value, inCart:f.classList.contains('hts-lq-in'), key:!!f.getAttribute('data-hts-key'), srvCount:f.getAttribute('data-hts-count'), addVisible:vis(f.querySelector('.addtocart')), goVisible:vis(f.querySelector('.hts-lq-go')), btn:r(btns[0]), input:r(inp), popoverOpen:!!document.querySelector('.popover.in')}; },i);
  const header=()=>p.evaluate(()=>({count:(document.querySelector('.ms2_total_count')||{}).textContent, cost:(document.querySelector('.ms2_total_cost')||{}).textContent, full:document.querySelector('#msMiniCart').classList.contains('full'), marker:window.__noReload===1, totalProductsEl:document.querySelectorAll('.ms2_total_products').length}));
  const snap=async n=>{ await p.screenshot({path:OUT+'/lq-'+n+'.png'}); };

  await go(SUB); await clean(); await go(SUB); await inject();
  await p.evaluate(()=>{window.__noReload=1;});
  out.p0={card0:await st(0), card1:await st(1), forms:await p.evaluate(()=>document.querySelectorAll('#mse2_results form.hts-lq-form').length), cards:await p.evaluate(()=>document.querySelectorAll('#mse2_results .product').length), header:await header()};
  await card(0).scrollIntoViewIfNeeded(); await p.evaluate(()=>{const f=document.querySelector('#mse2_results form.hts-lq-form'); window.scrollTo(0,f.getBoundingClientRect().top+scrollY-430);}); await p.waitForTimeout(300); await snap('1-start');
  // + + then add
  await card(0).locator('.hts-lq-btn[data-step="1"]').click(); await card(0).locator('.hts-lq-btn[data-step="1"]').click();
  out.p1_beforeAdd=await st(0);
  await card(0).locator('.addtocart').click(); await p.waitForTimeout(2800);
  out.p2_afterAdd={card:await st(0), header:await header()}; await snap('2-added');
  await card(0).locator('.hts-lq-btn[data-step="1"]').click(); await p.waitForTimeout(1800);
  out.p3_plus={card:await st(0), header:await header()};
  const inp=card(0).locator('input[name=count]'); await inp.fill('10'); await inp.blur(); await p.waitForTimeout(1800);
  out.p4_typed10={card:await st(0), header:await header()};
  await inp.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  out.p5_enter={card:await st(0), header:await header()};
  // second card: add 1, then − to remove
  await card(1).locator('.addtocart').scrollIntoViewIfNeeded(); await card(1).locator('.addtocart').click(); await p.waitForTimeout(2500);
  out.p6_card1added={card1:await st(1), header:await header()};
  await card(1).locator('.hts-lq-btn[data-step="-1"]').click(); await p.waitForTimeout(2000);
  out.p7_card1removed={card1:await st(1), header:await header()};
  await snap('3-states');
  // reload: initial state from the cart page
  await go(SUB); await inject(); await p.waitForTimeout(2500); await p.evaluate(()=>{window.__noReload=1;});
  out.p8_reload={card0:await st(0), card1:await st(1), header:await header()};
  // filter re-render: tick 120 л. then reset; card0 (30 л.) must come back as in cart
  await p.locator('.hts-f-open').click(); await p.waitForTimeout(400);
  await p.locator('#mse2_filters label',{hasText:'120 л.'}).first().click(); await p.waitForTimeout(3200);
  out.p9_filtered={cards:await p.evaluate(()=>document.querySelectorAll('#mse2_results .product').length), enhanced:await p.evaluate(()=>document.querySelectorAll('#mse2_results form.hts-lq-form').length)};
  await p.locator('.hts-f-reset').click(); await p.waitForTimeout(3200); await p.locator('.hts-f-close').click(); await p.waitForTimeout(400);
  out.p10_reset={cards:await p.evaluate(()=>document.querySelectorAll('#mse2_results .product').length), enhanced:await p.evaluate(()=>document.querySelectorAll('#mse2_results form.hts-lq-form').length), card0:await st(0)};
  // remove the last item via − : set 1, then −
  const inp2=card(0).locator('input[name=count]'); await inp2.fill('1'); await inp2.blur(); await p.waitForTimeout(1800);
  await card(0).locator('.hts-lq-btn[data-step="-1"]').click(); await p.waitForTimeout(2200);
  out.p11_emptied={card0:await st(0), header:await header()};
  out.phoneRequests=reqs.slice(); out.phoneErrors=errs.slice();
  await clean(); await ctx.close();

  // ---------------- DESKTOP ----------------
  const dctx=await b.newContext({viewport:{width:1280,height:900},locale:'ru-RU'}); const d=await dctx.newPage(); const derr=[], dreq=[];
  d.on('pageerror',e=>derr.push(String(e).slice(0,160))); d.on('request',r=>{ if(/minishop2\/action\.php/.test(r.url())) dreq.push((r.postData()||'').replace(/key=\w+&?/,'').replace(/options[^&]*&?/g,'').slice(0,60)); });
  await d.goto(BASE+SUB,{waitUntil:'load',timeout:90000}); await d.waitForTimeout(2200);
  const before=await d.evaluate(()=>{const f=document.querySelector('#mse2_results .product form.ms2_form'); const r=f.getBoundingClientRect(); return {h:Math.round(f.closest('.product').getBoundingClientRect().height), stepper:getComputedStyle(f.querySelector('.stepper')).display};});
  out.liveChunkDesktop=await d.evaluate(()=>window.htsListQtyBound===true);
  const after=await d.evaluate(()=>{const f=document.querySelector('#mse2_results .product form.ms2_form'); const vis=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0; return {h:Math.round(f.closest('.product').getBoundingClientRect().height), stepper:getComputedStyle(f.querySelector('.stepper')).display, ourBtnsVisible:[...f.querySelectorAll('.hts-lq-btn')].some(vis), goVisible:vis(f.querySelector('.hts-lq-go')), enhanced:f.classList.contains('hts-lq-form')};});
  await d.locator('#mse2_results form.ms2_form').first().locator('input[name=count]').fill('2');
  await d.locator('#mse2_results form.ms2_form').first().locator('.addtocart').click(); await d.waitForTimeout(2500);
  const afterAdd=await d.evaluate(()=>{const f=document.querySelector('#mse2_results .product form.ms2_form'); const vis=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0; return {val:f.querySelector('input[name=count]').value, inCartClass:f.classList.contains('hts-lq-in'), addVisible:vis(f.querySelector('.addtocart')), header:(document.querySelector('.ms2_total_count')||{}).textContent};});
  await d.screenshot({path:OUT+'/lq-desktop.png'});
  out.desktop={before, after, afterAdd, requests:dreq, errors:derr};
  await d.evaluate(async()=>{await fetch('/assets/components/minishop2/action.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:'ms2_action=cart%2Fclean&ctx=web'});});
  console.log(JSON.stringify(out,null,1)); await b.close();
})();
