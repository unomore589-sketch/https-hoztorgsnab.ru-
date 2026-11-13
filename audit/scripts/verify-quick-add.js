// Inject HtsCartQuickAdd into the live cart page (browser only) and exercise it on a phone and a desktop.
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'); const chunk=fs.readFileSync('/home/user/https-hoztorgsnab.ru-/modx-chunks/hts-cart-quick-add.html','utf8');
const CSS=chunk.match(/<style>([\s\S]*?)<\/style>/)[1], JS=chunk.match(/<script>([\s\S]*?)<\/script>/)[1];
const BASE='https://hoztorgsnab.ru', OUT=process.argv[2], LIVE=process.argv[3]==='live';
async function run(b, mode, opts){
  const ctx=await b.newContext(opts); const p=await ctx.newPage(); const o={}; const reqs=[], errs=[];
  p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
  p.on('request',r=>{ if(/minishop2\/action\.php/.test(r.url())) reqs.push((r.postData()||'').replace(/key=\w*&?/,'').slice(0,80)); });
  const clean=()=>p.evaluate(async()=>{await fetch('/assets/components/minishop2/action.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:'ms2_action=cart%2Fclean&ctx=web'});});
  await p.goto(BASE+'/cart.html',{waitUntil:'load',timeout:90000}); await clean();
  // put one item in the cart so the page shows a real cart below the block
  await p.evaluate(async()=>{await fetch('/assets/components/minishop2/action.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Requested-With':'XMLHttpRequest'},body:'ms2_action=cart%2Fadd&id=2315&count=1&ctx=web'});});
  await p.goto(BASE+'/cart.html',{waitUntil:'load',timeout:90000}); await p.waitForTimeout(2000);
  const c=p.locator('#hts-cookie').getByText('Только необходимые').first(); if(await c.isVisible().catch(()=>false)){await c.click();await p.waitForTimeout(300);}
  if (LIVE) { o.liveChunk=await p.evaluate(()=>window.htsQuickAddBound===true); } else { await p.addStyleTag({content:CSS}); await p.addScriptTag({content:JS}); await p.waitForTimeout(300); }
  const snap=()=>p.evaluate(()=>{const box=document.getElementById('cart_prod'); const f=box.querySelector('form'); const vis=e=>!!e&&e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none';
    const q=s=>document.querySelector(s); const t=s=>{const e=q(s); return e&&vis(e)?e.textContent.trim():null};
    return {blockVisible:vis(box), name:t('.hts-qa-name'), unit:t('.hts-qa-unit'), sum:t('.hts-qa-sum b'), count:f.querySelector('input[name=count]').value, cost:f.querySelector('.cost').textContent, priceVisible:vis(f.querySelector('.price')), btn:(()=>{const b=f.querySelector('.newaddcart'); const r=b.getBoundingClientRect(); return vis(b)?Math.round(r.width)+'x'+Math.round(r.height):'hidden'})(), plusVisible:vis(f.querySelector('.hts-qa-btn')), note:t('.hts-qa-note'), id:f.querySelector('input[name=id]').value, search:document.querySelector('.add-product-from-cart-form input[name=query]').value.slice(0,30), hScroll:document.documentElement.scrollWidth>innerWidth+1};});
  o.s0_empty=await snap();
  const sel='.add-product-from-cart-form input[name=query]';
  await p.locator(sel).click(); await p.locator(sel).type('лопата алюм',{delay:80}); await p.waitForTimeout(3300);
  await p.locator('.ui-autocomplete:visible li').nth(3).click(); await p.waitForTimeout(800);
  o.s1_selected=await snap();
  await p.evaluate(()=>{const f=document.getElementById('cart_prod'); window.scrollTo(0,f.getBoundingClientRect().top+scrollY-150)}); await p.screenshot({path:`${OUT}/qa-${mode}-${LIVE?'live':'inj'}-1.png`});
  if (mode==='phone') { await p.locator('#cart_prod .hts-qa-btn[data-step="1"]').click(); await p.locator('#cart_prod .hts-qa-btn[data-step="1"]').click(); }
  else { await p.locator('#cart_prod .stepper-step.up').click(); await p.locator('#cart_prod .stepper-step.up').click(); }
  await p.waitForTimeout(400); o.s2_qty3=await snap();
  await p.screenshot({path:`${OUT}/qa-${mode}-${LIVE?'live':'inj'}-2.png`});
  await p.locator('#cart_prod .newaddcart').click(); await p.waitForFunction(()=>[...document.querySelectorAll('#msCart [data-id]')].some(r=>r.getAttribute('data-id')==='1918'),null,{timeout:20000}).catch(()=>{}); await p.waitForTimeout(800);
  o.s3_added=await snap();
  o.cart=await p.evaluate(()=>({header:(document.querySelector('.ms2_total_count')||{}).textContent, rows:[...document.querySelectorAll('#msCart [data-id]')].map(r=>r.getAttribute('data-id')+'×'+r.querySelector('input[name=count]').value)}));
  await p.evaluate(()=>window.scrollTo(0,0)); await p.evaluate(()=>{const f=document.querySelector('.add-product-from-cart-form'); window.scrollTo(0,f.getBoundingClientRect().top+scrollY-150)});
  await p.screenshot({path:`${OUT}/qa-${mode}-${LIVE?'live':'inj'}-3.png`});
  o.requests=reqs; o.errors=errs; await clean(); await ctx.close(); return o;
}
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}});
 const out={phone:await run(b,'phone',{...devices['Pixel 7'],locale:'ru-RU'}), desktop:await run(b,'desktop',{viewport:{width:1280,height:900},locale:'ru-RU'})};
 console.log(JSON.stringify(out,null,1)); await b.close();})();
