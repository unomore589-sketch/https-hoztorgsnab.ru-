const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const BASE='https://hoztorgsnab.ru';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}});
 const ctx=await b.newContext({...devices['Pixel 7'],locale:'ru-RU'}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,160)));
 const pages={cat:'/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/', search:'/poisk.html?query=%D0%BC%D0%B5%D1%88%D0%BA%D0%B8', product:'/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/meshok-dlya-musora-30-litrov-10-mkm-20sht-v-rulone/', home:'/'};
 for (const [k,u] of Object.entries(pages)) { errs.length=0;
  await p.goto(BASE+u,{waitUntil:'load',timeout:90000}); await p.waitForTimeout(2000);
  const info=await p.evaluate(()=>{const ev=(window.jQuery&&jQuery._data(document.body,'events'))||{}; const dev=(window.jQuery&&jQuery._data(document,'events'))||{};
    const ymCfg=[...document.scripts].map(s=>s.textContent).filter(t=>/ym\(|Metrika|ecommerce/.test(t)).map(t=>(t.match(/ym\([^;]{0,300}/)||[''])[0]).join(' | ');
    return {bodyClick:(ev.click||[]).map(h=>h.selector), docClick:(dev.click||[]).map(h=>h.selector).filter(Boolean).slice(0,40), docSubmit:(dev.submit||[]).map(h=>h.selector), dl:typeof dataLayer, dlLen:window.dataLayer&&dataLayer.length, ymCfg, h1InMain:!!document.querySelector('#main h1.page_heading'), btns:document.querySelectorAll('button.addtocart').length, bc:document.querySelectorAll('#button-cart').length}});
  const before=info.dlLen;
  // click first visible add button
  const sel = k==='product' ? '#button-cart, .cart-top button[type=submit], .cart-top .addtocart' : 'button.addtocart';
  const clicked=await p.evaluate((sel)=>{const bs=[...document.querySelectorAll(sel)].filter(b=>b.getBoundingClientRect().height>0); if(!bs.length) return 'none'; bs[0].scrollIntoView({block:'center'}); bs[0].click(); return bs[0].outerHTML.slice(0,140)}, sel);
  await p.waitForTimeout(2500);
  const after=await p.evaluate((n)=>window.dataLayer?JSON.stringify(dataLayer.slice(n)).slice(0,600):'no dl', before||0);
  console.log('=== '+k, JSON.stringify(info), '\nclicked:', clicked, '\nerrors:', JSON.stringify(errs), '\ndl new:', after);
 }
 await p.evaluate(()=>fetch('/assets/components/minishop2/action.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'ms2_action=cart/clean&ctx=web'}));
 await b.close();})();
