// Inject HtsCookieCompact into the live pages (browser only), or test the deployed one with "live".
const { chromium, devices } = require('/opt/node-tools/node_modules/playwright');
const fs=require('fs'); const CSS=fs.readFileSync('/home/user/https-hoztorgsnab.ru-/modx-chunks/hts-cookie-compact.html','utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
const BASE='https://hoztorgsnab.ru', OUT=process.argv[2], LIVE=process.argv[3]==='live';
const m=()=>{const c=document.querySelector('#hts-cookie'); if(!c||c.hidden||c.getBoundingClientRect().height===0) return null; const r=c.getBoundingClientRect();
  const btns=[...c.querySelectorAll('.hts-cookie__btns .hts-cookie__btn')].map(b=>{const x=b.getBoundingClientRect(); return b.dataset.htsCookieAction+' '+Math.round(x.width)+'x'+Math.round(x.height)+' @'+Math.round(x.left)+','+Math.round(x.top)});
  return {h:Math.round(r.height), w:Math.round(r.width), pct:Math.round(r.height/innerHeight*100), scrolls:c.scrollHeight>c.clientHeight+1, textH:Math.round(c.querySelector('.hts-cookie__text').getBoundingClientRect().height), btns, fs:getComputedStyle(c.querySelector('.hts-cookie__text')).fontSize, hScroll:document.documentElement.scrollWidth>innerWidth+1}};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',proxy:{server:process.env.HTTPS_PROXY}}); const out={};
 for (const [mode,opts] of [['phone',{...devices['Pixel 7'],locale:'ru-RU'}],['small',{...devices['iPhone SE'],locale:'ru-RU'}],['desktop',{viewport:{width:1280,height:900},locale:'ru-RU'}]]) {
  const ctx=await b.newContext(opts); const p=await ctx.newPage(); const o=out[mode]={};
  await p.goto(BASE+'/catalog/meshki-dlya-musora/meshki-dlya-musora-v-rulonax/',{waitUntil:'load',timeout:90000}); await p.waitForTimeout(2200);
  o.before=await p.evaluate(m); if(!LIVE){ await p.addStyleTag({content:CSS}); await p.waitForTimeout(300); }
  o.after=await p.evaluate(m); await p.screenshot({path:`${OUT}/ck-${mode}-${LIVE?'live':'inj'}.png`});
  if (mode==='phone') {
    await p.locator('#hts-cookie [data-hts-cookie-action="settings"]').click(); await p.waitForTimeout(400);
    o.settingsOpen={visible:await p.evaluate(()=>!document.querySelector('#hts-cookie-panel').hidden), box:await p.evaluate(m)}; await p.screenshot({path:`${OUT}/ck-phone-settings-${LIVE?'live':'inj'}.png`});
    await p.locator('#hts-cookie [data-hts-cookie-action="necessary"]').click().catch(()=>{}); 
    await p.evaluate(()=>{const s=document.querySelector('#hts-cookie [data-hts-cookie-action=save]'); if(s&&s.getBoundingClientRect().height>0) s.click();}); await p.waitForTimeout(600);
    o.afterChoice=await p.evaluate(()=>{const c=document.querySelector('#hts-cookie'); return {gone:!c||c.hidden||c.getBoundingClientRect().height===0, stored:(()=>{try{return Object.keys(localStorage).filter(k=>/cookie|hts/i.test(k)).concat(document.cookie.split('; ').map(x=>x.split('=')[0]).filter(k=>/cookie|hts/i.test(k)))}catch(e){return null}})()}});
  }
  await ctx.close(); }
 console.log(JSON.stringify(out,null,1)); await b.close();})();
