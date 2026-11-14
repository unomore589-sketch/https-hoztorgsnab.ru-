const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'); const CSS=fs.readFileSync('/home/user/https-hoztorgsnab.ru-/modx-chunks/hts-header-compact.html','utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const LIVE=process.argv[2]==='live';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}});
 const out={};
 for (const [mode,opts] of [['phone',{...devices['Pixel 7'],locale:'ru-RU'}],['se',{...devices['iPhone SE'],locale:'ru-RU'}],['tablet',{viewport:{width:768,height:1024},locale:'ru-RU'}],['desktop',{viewport:{width:1280,height:900},locale:'ru-RU'}]]) {
  const ctx=await b.newContext(opts); const p=await ctx.newPage(); const o=out[mode]={};
  for (const [pg,u] of [['cat','/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/'],['home','/'],['product','/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/meshok-dlya-musora-30-litrov-10-mkm-20sht-v-rulone/'],['cart','/cart.html'],['search','/poisk.html?query=%D0%BC%D0%B5%D1%88%D0%BA%D0%B8']]) {
   if (mode!=='phone' && pg!=='cat') continue;
   await p.goto('https://hoztorgsnab.ru'+u,{waitUntil:'load',timeout:90000}); await p.waitForTimeout(1500);
   await p.evaluate(()=>{ try{localStorage.setItem('hts_cookie','1')}catch(e){} const c=document.querySelector('#hts-cookie'); if(c) c.hidden=true; });
   const m=()=>p.evaluate(()=>{const bx=s=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return r.height? Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height):'hidden'};
     return {header:bx('#header'), logo:bx('#header #logo img'), phone:bx('#header .phonesmobile'), menu:bx('#menu-icon'), search:bx('#header #search-field'), cart:bx('#header .cartmobile'), h1:bx('h1'), firstCard:bx('#mse2_results .product, .product'), hScroll:document.documentElement.scrollWidth>innerWidth+1}});
   const before=await m(); if(!LIVE){ await p.addStyleTag({content:CSS}); await p.waitForTimeout(300);} const after=await m();
   o[pg]={before,after};
   if (pg==='cat') { await p.screenshot({path:`/tmp/hdr-${mode}.png`});
     // open menu
     const menu=await p.evaluate(async()=>{const t=document.querySelector('#menu-icon'); if(!t||!t.getBoundingClientRect().height) return 'no icon'; t.click(); await new Promise(r=>setTimeout(r,700)); const ul=document.querySelector('#nav-wrap ul.nav'); const r=ul.getBoundingClientRect(); return {disp:getComputedStyle(ul).display, box:Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)}});
     o.menu=menu; await p.screenshot({path:`/tmp/hdr-${mode}-menu.png`});
     // search focus + autocomplete
     await p.evaluate(()=>{const t=document.querySelector('#menu-icon'); if(t&&document.querySelector('#nav-wrap ul.nav').getBoundingClientRect().height) t.click();});
     await p.waitForTimeout(500);
     if (mode!=='desktop') { await p.locator('#header #search-field').click(); await p.keyboard.type('мешки', {delay:60}); await p.waitForTimeout(2500);
       o.autocomplete=await p.evaluate(()=>{const u=[...document.querySelectorAll('.ui-autocomplete')].find(e=>e.getBoundingClientRect().height>0); if(!u) return 'none'; const r=u.getBoundingClientRect(); return Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' items '+u.querySelectorAll('li').length});
       await p.screenshot({path:`/tmp/hdr-${mode}-search.png`}); }
   }
  }
  await ctx.close(); }
 console.log(JSON.stringify(out,null,1)); await b.close();})();
