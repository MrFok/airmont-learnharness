import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'), headless: true });
const errors = [];
const warnings = [];
try {
 const page = await browser.newPage();
 page.on('pageerror', error => errors.push(error.message));
 page.on('console', message => { if (['warning','warn','error'].includes(message.type())) warnings.push(message.text()); });
 await page.setViewport({width:1440,height:1000});
 let settings = {version:1, appearance:{proseFontSize:19},graph:{enabled:true,rendering:true,extractionChunkTokens:8192},general:{autoUpdate:true}};
 const writes=[];
 await page.setRequestInterception(true);
 page.on('request', async request => {
  const path=new URL(request.url()).pathname;
  if(path==='/api/subscriptions' && request.method()==='GET') return request.respond({status:200,contentType:'application/json',body:JSON.stringify({chatgpt:{available:true,pending:false,allowBackgroundUse:true,activeId:'fixture',accounts:[{id:'fixture',email:'learner@example.invalid',registration:'fixture-registration',connected:true,planEnabled:true,canSignInAgain:false}],error:null},native:[]})});
  if(path==='/api/settings' && request.method()==='GET') return request.respond({status:200,contentType:'application/json',body:JSON.stringify({settings})});
  if(path==='/api/settings/graph' && request.method()==='PUT') {
   writes.push(JSON.parse(request.postData()));
   settings={...settings,graph:writes.at(-1)};
   return request.respond({status:200,contentType:'application/json',body:JSON.stringify({settings})});
  }
  if(path.startsWith('/api/') && !['GET','HEAD'].includes(request.method())) return request.abort();
  await request.continue();
 });
 await page.goto(process.env.LH_AUDIT_ORIGIN ?? 'http://127.0.0.1:3000',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForSelector('[data-testid="settings-entry"]');
 await page.waitForFunction(()=>Object.keys(document.querySelector('[data-testid="settings-entry"]')).some(key=>key.startsWith("__reactProps")));
 await page.click('[data-testid="settings-entry"]');
 await page.waitForSelector('[data-testid="settings-dialog"]');
 await page.waitForFunction(()=>document.activeElement?.getAttribute('data-testid')==='settings-close');
 assert.equal(await page.$eval('[data-testid="settings-dialog"]',el=>getComputedStyle(el).gridTemplateColumns.split(' ')[0]),'208px');
 await page.type('input[aria-label="Search settings sections"]','font');
 assert.equal(await page.$$eval('[data-testid="settings-nav"] button',els=>els.map(el=>el.textContent).join(',')),'Appearance');
 await page.click('[data-testid="settings-nav-appearance"]');
 await page.waitForSelector('[data-testid="section-appearance"]');
 await page.$eval('input[aria-label="Search settings sections"]',el=>{ const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'');el.dispatchEvent(new Event('input',{bubbles:true})); });
 await page.click('[data-testid="settings-nav-graph"]');
 await page.waitForSelector('[data-testid="section-graph"]');
 await page.click('button[aria-label="extraction enabled"]');
 await page.waitForFunction(()=>document.querySelector('button[aria-label="extraction enabled"]').getAttribute('aria-checked')==='false');
 assert.equal(writes.length,1);
 assert.equal(writes[0].extractionChunkTokens,8192);
 assert.equal(settings.appearance.proseFontSize,19);
 await page.click('[data-testid="settings-nav-keys"]');
 await page.waitForSelector('[data-testid="chatgpt-connection"]');
 const manage=await page.$('[data-testid="chatgpt-connection"] button:not([data-dropdown-trigger])');
 assert.ok(manage);
 assert.equal(await manage.evaluate(el=>el.disabled),false);
 {
  await manage.click();
  await page.waitForSelector('[data-testid="chatgpt-account-dialog"]');
  const add=await page.$('[data-testid="chatgpt-add-accounts"]');
  if(add) {await add.click();}
  const picker=await page.$('[data-testid="chatgpt-account-dialog"] [data-dropdown-trigger]');
  assert.ok(picker);
  {
   await picker.click();
   await page.waitForSelector('[data-proposed-dropdown]');
   await page.keyboard.press('Escape');
   assert.ok(await page.$('[data-testid="chatgpt-account-dialog"]'));
   assert.ok(await page.$('[data-testid="settings-dialog"]'));
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('[data-testid="chatgpt-account-dialog"]'));
  assert.ok(await page.$('[data-testid="settings-dialog"]'));
 }
 await page.screenshot({path:join(tmpdir(),'canonical-settings-wide.png'),fullPage:true});
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('[data-testid="settings-dialog"]'));
 assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-testid')),'settings-entry');
 await page.click('[data-testid="settings-entry"]');
 await page.waitForSelector('[data-testid="settings-dialog"]');
 await page.setViewport({width:320,height:800});
 await page.screenshot({path:join(tmpdir(),'canonical-settings-320.png'),fullPage:true});
 const overflow=await page.$eval('[data-testid="settings-dialog"]',el=>el.scrollWidth>el.clientWidth);
 assert.equal(overflow,false,'settings shell must fit 320px');
 for(const section of ['profile','agent','appearance','graph','keyboard','general','keys']) {
  await page.click(`[data-testid="settings-nav-${section}"]`);
  await page.waitForSelector(`[data-testid="section-${section}"]`);
  const clipped=await page.$eval('[data-testid="settings-dialog"]',el=>el.scrollWidth>el.clientWidth);
  assert.equal(clipped,false,`${section} overflows at 320px`);
 }
 await page.screenshot({path:join(tmpdir(),'canonical-settings-providers-320.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 assert.deepEqual(warnings.filter(text=>/hydration|unique.*key|Each child|Warning:|React does not recognize/i.test(text)),[]);
 console.log(JSON.stringify({result:'passed',writes:writes.length,appearancePreserved:settings.appearance.proseFontSize===19,pageErrors:errors,reactWarnings:warnings.filter(text=>/hydration|unique.*key|Each child|Warning:|React does not recognize/i.test(text)),screenshots:[join(tmpdir(),'canonical-settings-320.png'),join(tmpdir(),'canonical-settings-providers-320.png')]}));
} catch(error) { console.log(JSON.stringify({errors,warnings})); throw error; } finally {await browser.close();}
