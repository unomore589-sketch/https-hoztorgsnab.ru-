// Inject HtsBottomBar into live pages (browser only; nothing saved on the site) and exercise it. Pass "live" as 2nd arg to test the deployed chunk instead.
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'); const chunk=fs.readFileSync('/home/user/https-hoztorgsnab.ru-/modx-chunks/hts-bottom-bar.html','utf8');
const NAV=chunk.match(/<nav[\s\S]*?<\/nav>/)[0], CSS=chunk.match(/<style>([\s\S]*?)<\/style>/)[1], JS=chunk.match(/<script>([\s\S]*?)<\/script>/)[1];
const BASE='https://hoztorgsnab.ru', OUT=process.argv[2], LIVE=process.argv[3]==='live';
const SUB='/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/';
const ms2=(b)=>`fetch('/assets/components/minishop2/action.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:'${b}&ctx=web'})`;
(async()=>{
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}});
  const out={pages:{}};
  const ctx=await br.newContext({...devices['Pixel 7'],locale:'ru-RU'}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,140)));
  const inject=async()=>{ if(LIVE) return; await p.evaluate(h=>{const d=document.createElement('div'); d.innerHTML=h; document.getElementById('wrapper2').appendChild(d.firstElementChild);},NAV); await p.addStyleTag({content:CSS}); await p.addScriptTag({content:JS}); await p.waitForTimeout(300); };
  const go=async u=>{ await p.goto(BASE+u,{waitUntil:'load',timeout:90000}); await p.waitForTimeout(2200); };
  const dismiss=async()=>{ const c=p.locator('#hts-cookie').getByText('Только необходимые').first(); if(await c.isVisible().catch(()=>false)){await c.click();await p.waitForTimeout(300);} };
  const bar=()=>p.evaluate(()=>{const b=document.querySelector('.hts-bb'); if(!b) return null; const r=b.getBoundingClientRect(); const cs=getComputedStyle(b);
    const it=[...b.querySelectorAll('.hts-bb-i')].map(a=>{const x=a.getBoundingClientRect(); return {k:a.dataset.k,w:Math.round(x.width),h:Math.round(x.height),on:a.classList.contains('hts-bb-on'),label:a.querySelector('span').innerText,truncated:a.querySelector('span').scrollWidth>a.querySelector('span').clientWidth}});
    const n=b.querySelector('.hts-bb-n'); const f=document.querySelector('footer'); 
    return {display:cs.display,pos:cs.position,top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight,h:Math.round(r.height),items:it,badge:n&&getComputedStyle(n).display!=='none'?n.textContent:null,hScroll:document.documentElement.scrollWidth>innerWidth+1,bodyPad:getComputedStyle(document.body).paddingBottom,cookieVisible:!!document.querySelector('#hts-cookie')&&document.querySelector('#hts-cookie').getBoundingClientRect().height>0}});
  const clean=()=>p.evaluate(ms2('ms2_action=cart%2Fclean'));
  for (const [name,u] of [['home','/'],['catalog','/catalog/'],['listing',SUB],['product',SUB+'meshok-dlya-musora-120-l.-rulon-bez-zavyazok,-5sht,-70-mkm-rossiya/'],['search','/poisk.html?query=%D0%BC%D0%B5%D1%88%D0%BA%D0%B8'],['cart','/cart.html'],['checkout','/oformlenie-zakaza.html']]) {
    await go(u); await dismiss(); if(name==='home'||name==='listing') await clean(); await go(u); await dismiss(); await inject();
    const s=await bar(); out.pages[name]={...s, active:(s&&s.items.filter(i=>i.on).map(i=>i.k))};
    await p.screenshot({path:`${OUT}/bb-${name}.png`});
  }
  // end of page: is the last footer line reachable above the bar?
  await go(SUB); await dismiss(); await inject(); await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight)); await p.waitForTimeout(500);
  out.bottomOfPage=await p.evaluate(()=>{const b=document.querySelector('.hts-bb').getBoundingClientRect(); const r=s=>{const e=document.querySelector(s); const x=e.getBoundingClientRect(); return Math.round(x.bottom)+(x.bottom<=b.top+1?' ok':' HIDDEN')}; return {barTop:Math.round(b.top), contentinfo:r('.copyright p[role=contentinfo]'), footerphone:r('.footerphone'), scrollEnd:Math.round(scrollY+innerHeight)+'/'+document.documentElement.scrollHeight};});
  await p.screenshot({path:`${OUT}/bb-bottom.png`});
  // cart badge follows adding from a card, and the 99+ cap
  await go(SUB); await dismiss(); await inject(); await p.evaluate(()=>window.scrollTo(0,0));
  out.badge0=(await bar()).badge;
  await p.evaluate(()=>{const b=[...document.querySelectorAll('#mse2_results button')].find(x=>/в корзину/i.test(x.innerText)); b.scrollIntoView({block:'center'}); b.click();}); await p.waitForTimeout(2600);
  out.badgeAfterAdd=(await bar()).badge;
  await p.evaluate(()=>{const f=document.querySelectorAll('#mse2_results form.ms2_form')[1]; f.querySelector('input[name=count]').value=150; f.querySelector('.addtocart').scrollIntoView({block:'center'}); f.querySelector('.addtocart').click();}); await p.waitForTimeout(2800);
  out.badgeBig=(await bar()).badge;
  // search button focuses the visible header search field and scrolls up
  await p.evaluate(()=>window.scrollTo(0,1500)); await p.waitForTimeout(300);
  await p.locator('.hts-bb [data-k="search"]').click(); await p.waitForTimeout(500);
  out.search=await p.evaluate(()=>({focused:document.activeElement&&document.activeElement.name==='query'&&!document.activeElement.closest('.add-product-from-cart-form'), scrollY:Math.round(scrollY), barHiddenWhileTyping:getComputedStyle(document.querySelector('.hts-bb')).display==='none'}));
  await p.screenshot({path:`${OUT}/bb-typing.png`});
  await p.evaluate(()=>document.activeElement.blur()); await p.waitForTimeout(400);
  out.afterBlur=await p.evaluate(()=>getComputedStyle(document.querySelector('.hts-bb')).display);
  // links
  out.links=await p.evaluate(()=>[...document.querySelectorAll('.hts-bb a')].map(a=>a.dataset.k+' '+a.getAttribute('href')));
  // filter sheet hides the bar
  await p.locator('.hts-f-open').scrollIntoViewIfNeeded().catch(()=>{}); await p.evaluate(()=>window.scrollTo(0,600)); await p.waitForTimeout(200);
  if (await p.locator('.hts-f-open').count()) { await p.locator('.hts-f-open').click(); await p.waitForTimeout(400); out.barWithFilterSheet=await p.evaluate(()=>getComputedStyle(document.querySelector('.hts-bb')).display); await p.locator('.hts-f-close').click(); await p.waitForTimeout(300); }
  await clean(); out.errors=errs; await ctx.close();
  // desktop: not shown, no extra padding
  const d=await br.newContext({viewport:{width:1280,height:900},locale:'ru-RU'}); const dp=await d.newPage();
  await dp.goto(BASE+SUB,{waitUntil:'load',timeout:90000}); await dp.waitForTimeout(2000);
  if(!LIVE){ await dp.evaluate(h=>{const x=document.createElement('div'); x.innerHTML=h; document.getElementById('wrapper2').appendChild(x.firstElementChild);},NAV); await dp.addStyleTag({content:CSS}); await dp.addScriptTag({content:JS}); await dp.waitForTimeout(300); }
  out.desktop=await dp.evaluate(()=>({barDisplay:getComputedStyle(document.querySelector('.hts-bb')).display, bodyPad:getComputedStyle(document.body).paddingBottom}));
  console.log(JSON.stringify(out,null,1)); await br.close();
})();
