// Inject HtsListCompact into the live listing (browser only) or test the deployed one ("live").
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'); const chunk=fs.readFileSync('/home/user/https-hoztorgsnab.ru-/modx-chunks/hts-list-compact.html','utf8'); const CSS=chunk.match(/<style>([\s\S]*?)<\/style>/)[1];
const BASE='https://hoztorgsnab.ru', SUB='/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/', OUT=process.argv[2], LIVE=process.argv[3]==='live';
const metrics=()=>{ const cards=[...document.querySelectorAll('#mse2_results .product')]; const r=e=>Math.round(e.getBoundingClientRect().height);
  const one=c=>({h:r(c), img:r(c.querySelector('.product_img')), infos:[...c.querySelectorAll('.product_infos')].map(r), name:r(c.querySelector('.product_name')), rows:[...c.querySelectorAll('.product__wrapper > div[style]')].map(r), qty:c.querySelector('.hts-lq-qty')?r(c.querySelector('.hts-lq-qty')):null, btn:(()=>{const b=c.querySelector('.addtocart, .hts-lq-go'); return b&&b.getBoundingClientRect().height>0?r(b):0})(), oos:!!c.querySelector('.nalich_net')});
  const inStock=cards.filter(c=>!c.querySelector('.nalich_net')), oos=cards.filter(c=>c.querySelector('.nalich_net'));
  const items=[...document.querySelectorAll('#mse2_results > .item')]; const rowTops=[...new Set(items.map(i=>Math.round(i.getBoundingClientRect().top+scrollY)))];
  return {cards:cards.length, first:one(inStock[0]), firstOos:oos[0]?one(oos[0]):null, minH:Math.min(...cards.map(r)), maxH:Math.max(...cards.map(r)), listHeight:Math.round(document.getElementById('mse2_results').getBoundingClientRect().height), rows:rowTops.length, hScroll:document.documentElement.scrollWidth>innerWidth+1,
    clipped:cards.filter(c=>c.scrollHeight>c.clientHeight+1).length, misaligned:(()=>{const rows={}; items.forEach(i=>{const t=Math.round(i.getBoundingClientRect().top+scrollY); const bt=i.querySelector('.addtocart, .hts-lq-go, .nalich_net_btn, .btn'); if(bt&&bt.getBoundingClientRect().height>0){(rows[t]=rows[t]||[]).push(Math.round(bt.getBoundingClientRect().top+scrollY))}}); return Object.values(rows).filter(v=>v.length>1&&Math.max(...v)-Math.min(...v)>1).length})(), sepText:(()=>{const e=document.querySelector('#mse2_results .product .product_infos > br + span'); return e?getComputedStyle(e,'::before').content:null})(), nameClipped:cards.filter(c=>{const a=c.querySelector('.product_name'); return a.scrollHeight>a.clientHeight+1}).length,
    imgSizes:[...new Set(cards.map(c=>{const i=c.querySelector('img'); const x=i.getBoundingClientRect(); return Math.round(x.width)+'x'+Math.round(x.height)}))].slice(0,5)}; };
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}}); const out={};
 for (const [mode,opts] of [['phone',{...devices['Pixel 7'],locale:'ru-RU'}],['desktop',{viewport:{width:1280,height:900},locale:'ru-RU'}]]) {
  const ctx=await b.newContext(opts); const p=await ctx.newPage();
  await p.goto(BASE+SUB,{waitUntil:'load',timeout:90000}); await p.waitForTimeout(2500);
  const c=p.locator('#hts-cookie').getByText('Только необходимые').first(); if(await c.isVisible().catch(()=>false)){await c.click();await p.waitForTimeout(300);}
  out[mode]={before:await p.evaluate(metrics)}; if(!LIVE){ await p.addStyleTag({content:CSS}); await p.waitForTimeout(400); }
  out[mode].after=await p.evaluate(metrics);
  if (mode==='phone') { await p.evaluate(()=>{const c=document.querySelector('#mse2_results .item'); window.scrollTo(0,c.getBoundingClientRect().top+scrollY-120);}); await p.waitForTimeout(300); await p.screenshot({path:OUT+'/cmp-'+(LIVE?'live':'inj')+'-1.png'});
    // in-cart state + out-of-stock cards
    await p.evaluate(()=>{const f=document.querySelector('#mse2_results form.hts-lq-form'); f.querySelector('.addtocart').click();}); await p.waitForTimeout(2600);
    out[mode].inCart=await p.evaluate(metrics); await p.screenshot({path:OUT+'/cmp-'+(LIVE?'live':'inj')+'-2.png'});
    await p.evaluate(()=>{const o=document.querySelector('#mse2_results .nalich_net'); o.scrollIntoView({block:'center'});}); await p.waitForTimeout(300); await p.screenshot({path:OUT+'/cmp-'+(LIVE?'live':'inj')+'-3.png'});
    await p.evaluate(async()=>{await fetch('/assets/components/minishop2/action.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:'ms2_action=cart%2Fclean&ctx=web'});}); }
  await ctx.close(); }
 console.log(JSON.stringify(out,null,1)); await b.close();})();
