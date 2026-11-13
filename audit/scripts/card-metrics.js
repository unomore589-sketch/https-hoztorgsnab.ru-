const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}});
 const p=await (await b.newContext({...devices['Pixel 7'],locale:'ru-RU'})).newPage();
 await p.goto('https://hoztorgsnab.ru/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/',{waitUntil:'load',timeout:90000}); await p.waitForTimeout(2500);
 const c=p.locator('#hts-cookie').getByText('Только необходимые').first(); if(await c.isVisible().catch(()=>false)){await c.click();await p.waitForTimeout(300);}
 console.log(JSON.stringify(await p.evaluate(()=>{
   const card=document.querySelector('#mse2_results .product'); const r=e=>{const x=e.getBoundingClientRect(); return Math.round(x.height)+'h '+Math.round(x.width)+'w'};
   const cs=(e,k)=>getComputedStyle(e)[k];
   const q=s=>card.querySelector(s);
   const parts=[['card',card],['product_img',q('.product_img')],['img_change a',q('.img_change')],['prod_inside',q('.prod_inside')],['img',q('img')],['infos#1 (арт/наличие)',card.querySelectorAll('.product_infos')[0]],['infos#2 (название)',card.querySelectorAll('.product_infos')[1]],['product_name',q('.product_name')],['product_info',q('.product_info')],['cart-button',q('.cart-button')],['wrapper',q('.product__wrapper')]];
   const rows=[...card.querySelectorAll('.product__wrapper > *')].map(e=>(e.tagName.toLowerCase()+'.'+String(e.className).slice(0,26)+(e.getAttribute('style')?' [style]':'')).padEnd(34)+' '+r(e)+' disp='+cs(e,'display')+' mt='+cs(e,'marginTop')+' mb='+cs(e,'marginBottom'));
   return {parts:parts.map(([n,e])=>n.padEnd(24)+(e?r(e)+' pad='+cs(e,'padding')+' mar='+cs(e,'margin')+' lh='+cs(e,'lineHeight')+' fs='+cs(e,'fontSize'):'none')), wrapperChildren:rows, nameFont:cs(q('.product_name a'),'fontSize')+' / '+cs(q('.product_name a'),'lineHeight'), priceFont:cs(q('.pricer'),'fontSize'), cardBorder:cs(card,'border')+' | shadow='+cs(card,'boxShadow'), itemPad:cs(card.parentElement,'padding')};}),null,1)); await b.close();})();
