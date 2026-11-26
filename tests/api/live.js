// التشغيل: python -m http.server 8765 ، و node tests/api/server.js ، وبعدين node tests/api/live.js
// التطبيق الحقيقي وهو متوصّل بسكريبت الربط (على الأوراق الوهمية): إذن من الموقع ← رفض من المحاسب ← تعديل ← اعتماد، ومصروف عهدة.
const { chromium } = require('playwright');
const path = require('path');
const APP = 'http://localhost:8765/', API = 'http://127.0.0.1:8790/exec';
const PHOTO = path.join(__dirname, '../permit.jpg');
const SHOTS = path.join(__dirname, '../shots'); require('fs').mkdirSync(SHOTS, { recursive: true });
const results = []; const ok = (n, c, x) => results.push([c ? 'PASS' : 'FAIL', n, x === undefined ? '' : String(x)]);
const get = (u) => fetch(u).then(r => r.json());

(async () => {
  const jwt = await get('http://127.0.0.1:8790/tokens');
  const browser = await chromium.launch();
  const errs = [];
  async function as(who) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
      geolocation: { latitude: 30.0727, longitude: 31.6446 }, permissions: ['geolocation'] });
    await ctx.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript',
      body: "window.BDW_CONFIG={CLIENT_ID:'760770227194-t2r0kna5g34igsarqfmf8psm8418ejlr.apps.googleusercontent.com',API_URL:'" + API + "',WRITE_URL:'" + API + "',PREVIEW:false,BUILD:'test'};" }));
    await ctx.addInitScript(([t]) => { try { sessionStorage.setItem('bdw_idt', t); } catch (e) { } }, [jwt[who]]);
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(who + ' pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(who + ' console: ' + m.text()); });
    return { ctx, page };
  }
  const click = async (page, s) => { await page.locator(s).first().click(); await page.waitForTimeout(250); };
  const toast = async (page) => (await page.locator('#toast').textContent()) || '';
  const sheet = () => get('http://127.0.0.1:8790/sheet');

  /* محاسب الموقع */
  const site = await as('site'), sp = site.page;
  await sp.goto(APP); await sp.waitForSelector('.greet', { timeout: 15000 });
  ok('site home loads from the script', /مشروع تجريبي — مدينة تجريبية/.test(await sp.locator('.pbar').textContent()));
  ok('greeting uses the name from the users sheet', /سعيد الموقع/.test(await sp.locator('.greet').textContent()));
  ok('custody left from the custody sheet', /20,000/.test(await sp.locator('main').textContent()));
  ok('no sample-data strip in live mode', (await sp.locator('.strip').count()) === 0 || !/عيّنة/.test(await sp.locator('.strip').first().textContent()));
  await sp.screenshot({ path: path.join(SHOTS, 'live-01-site-home.png') });

  await click(sp, '[data-act="go"][data-to="new/permit"]'); await sp.waitForSelector('.form');
  await click(sp, '[data-act="pick"][data-f="party"]'); await click(sp, '[data-act="sheet-pick"][data-v="V-001"]');
  await click(sp, '[data-act="pick"][data-f="item"]'); await click(sp, '[data-act="sheet-pick"][data-v="I-C02"]');
  ok('last approved price from the sheet', (await sp.inputValue('#f-price')) === '1950');
  await sp.fill('#f-qty', '10'); await sp.fill('#f-price', '2300');
  await sp.setInputFiles('#f-photo-in', PHOTO); await sp.waitForSelector('#w-photo .photo img');
  await sp.evaluate(() => document.querySelector('#sig').scrollIntoView({ block: 'center' })); await sp.waitForTimeout(150);
  const box = await sp.locator('#sig canvas').boundingBox();
  await sp.mouse.move(box.x + 40, box.y + 60); await sp.mouse.down(); for (let i = 0; i < 10; i++) await sp.mouse.move(box.x + 40 + i * 22, box.y + 60 + (i % 2) * 20, { steps: 2 }); await sp.mouse.up();
  await sp.waitForTimeout(700);
  ok('location inside project radius', /داخل نطاق المشروع/.test(await sp.locator('#f-loc').textContent()));
  await click(sp, '[data-act="save"]');
  await sp.waitForFunction(() => /SP-0003/.test(document.querySelector('main') && document.querySelector('main').textContent), null, { timeout: 15000 }).catch(() => { });
  ok('permit numbered by the script', /SP-0003/.test(await sp.locator('main').textContent()), await toast(sp));
  let sh = await sheet();
  const row3 = sh.permits.find(r => r[0] === 'SP-0003');
  ok('row in sheet: registered, price, photo link, entrant', row3 && row3[12] === 'مسجَّل' && row3[10] === 2300 && /drive\.google\.com/.test(row3[13]) && row3[14] === 'سعيد الموقع', JSON.stringify(row3));
  await sp.screenshot({ path: path.join(SHOTS, 'live-02-site-mine.png') });

  /* محاسب المشروع: يرفض */
  const acc = await as('acc'), ap = acc.page;
  await ap.goto(APP + '#inbox'); await ap.waitForSelector('.tabs', { timeout: 15000 });
  ok('acc inbox lists the new permit', (await ap.locator('[data-key="k"]').count()) >= 0 && /SP-0003/.test(await ap.locator('main').textContent()));
  ok('acc inbox lists the form permit without price', /SP-0002/.test(await ap.locator('main').textContent()));
  const key3 = await ap.evaluate(() => (window.BDW.S.data.docs.find(d => d.id === 'SP-0003') || {}).key);
  await click(ap, '[data-act="doc"][data-key="' + key3 + '"]'); await ap.waitForSelector('.dhero');
  await ap.waitForFunction(() => { const i = document.querySelector('.dhero img'); return i && /^data:image/.test(i.src); }, null, { timeout: 15000 }).catch(() => { });
  ok('photo arrives through the script', await ap.evaluate(() => { const i = document.querySelector('.dhero img'); return !!(i && /^data:image/.test(i.src)); }));
  ok('price warning against last approved price', /أعلى من آخر سعر معتمد/.test(await ap.locator('main').textContent()));
  await ap.screenshot({ path: path.join(SHOTS, 'live-03-acc-review.png'), fullPage: true });
  await click(ap, '.fbar [data-act="reject"]'); await ap.waitForSelector('#w-reason');
  await click(ap, '[data-act="rej-reason"][data-v="السعر غير مطابق"]');
  await ap.fill('#rej-note', 'آخر سعر معتمد 1,950');
  await click(ap, '[data-act="rej-confirm"]'); await click(ap, '[data-act="dlg-ok"]');
  await ap.waitForTimeout(1500);
  sh = await sheet();
  ok('rejected → «ملغى» in sheet with reason line', (r => r && r[12] === 'ملغى' && /^⟲ مرفوض: السعر غير مطابق/.test(r[15]))(sh.permits.find(r => r[0] === 'SP-0003')), JSON.stringify(sh.permits.find(r => r[0] === 'SP-0003')));
  ok('acc back on inbox after reject', (await ap.evaluate(() => location.hash)) === '#inbox');

  /* محاسب الموقع: يعدّل ويعيد */
  await sp.evaluate(() => { location.hash = ''; }); await sp.waitForSelector('.greet');
  await click(sp, '[data-act="sync"]'); await sp.waitForTimeout(1500);
  await sp.evaluate(() => { location.hash = '#mine'; }); await sp.waitForSelector('.tabs');
  await click(sp, '[data-act="mine-tab"][data-t="permit"]');
  ok('site sees rejection', /مرفوض — يحتاج تعديلك/.test(await sp.locator('main').textContent()));
  await click(sp, '[data-act="doc"][data-key="' + key3 + '"]'); await sp.waitForSelector('.fbar');
  ok('reason shown to site', /السعر غير مطابق/.test(await sp.locator('main').textContent()) && /آخر سعر معتمد 1,950/.test(await sp.locator('main').textContent()));
  await click(sp, '.fbar [data-act="go"]'); await sp.waitForSelector('.form');
  await sp.fill('#f-price', '1950');
  await click(sp, '[data-act="save"]'); await sp.waitForTimeout(2500);
  sh = await sheet();
  ok('resubmitted: «مسجَّل», price fixed, reason line gone', (r => r && r[12] === 'مسجَّل' && r[10] === 1950 && !/⟲/.test(r[15]))(sh.permits.find(r => r[0] === 'SP-0003')), JSON.stringify(sh.permits.find(r => r[0] === 'SP-0003')));

  /* محاسب المشروع: يعتمد */
  await ap.reload(); await ap.waitForSelector('.tabs', { timeout: 15000 });
  await click(ap, '[data-act="doc"][data-key="' + key3 + '"]'); await ap.waitForSelector('.fbar');
  await click(ap, '.fbar [data-act="approve"]'); await ap.waitForSelector('.dlg');
  ok('approval dialog shows the journal line', /قيده في اليومية: 5100 مدين \/ 2200 دائن/.test(await ap.locator('.dlg').textContent()));
  await click(ap, '[data-act="dlg-ok"]'); await ap.waitForTimeout(1500);
  sh = await sheet();
  ok('approved in sheet', (sh.permits.find(r => r[0] === 'SP-0003') || [])[12] === 'معتمد');
  ok('server timeline after refresh', await ap.evaluate(k => { const d = window.BDW.S.data.docs.find(x => x.key === k); return !!d && d.log.map(l => l[1].split(' ')[0]).join('|'); }, key3) === 'سُجّل|وصل|رُفض:|عُدّل|اعتُمد');

  /* مصروف عهدة */
  await sp.evaluate(() => { location.hash = '#new/exp'; }); await sp.waitForSelector('.form');
  await click(sp, '[data-act="seg"][data-f="cat"][data-v="وقود"]');
  await sp.fill('#f-desc', 'سولار مولد'); await sp.fill('#f-amount', '500');
  await sp.setInputFiles('#f-photo-in', PHOTO); await sp.waitForSelector('#w-photo .photo img');
  await click(sp, '[data-act="save"]'); await sp.waitForTimeout(2500);
  ok('expense numbered and custody left updated', /EX-0001/.test(await sp.locator('main').textContent()) && /19,500/.test(await sp.locator('main').textContent()), (await sp.locator('main').textContent()).slice(0, 200));
  sh = await sheet();
  ok('expense row tied to custody CU-001', (sh.exp.find(r => r[0] === 'EX-0001') || [])[3] === 'CU-001');
  await sp.screenshot({ path: path.join(SHOTS, 'live-04-custody.png') });

  ok('no JS errors', errs.length === 0, errs.join(' | '));
  results.forEach(r => console.log(r[0], '-', r[1], r[0] === 'FAIL' && r[2] ? '— ' + r[2].slice(0, 300) : ''));
  console.log(results.filter(r => r[0] === 'FAIL').length + ' failed of ' + results.length);
  await browser.close();
})().catch(e => { console.error('CRASH', e); results.forEach(r => console.log(r[0], '-', r[1], r[2])); process.exit(1); });
