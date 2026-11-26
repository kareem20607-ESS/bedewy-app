// اختبار تطبيق البديوي على مقاس موبايل: كل الدورات من التسجيل للاعتماد والرفض وإعادة الإرسال ومن غير نت.
// التشغيل: من جذر المستودع  python -m http.server 8765  وبعدها  node tests/e2e-mobile.js
// الصور بتتحفظ في tests/shots (مش داخلة في المستودع).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const DIR = __dirname, SHOTS = path.join(DIR, 'shots'), BASE = process.env.BASE || 'http://localhost:8765/';
const PHOTO = path.join(DIR, 'permit.jpg');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
function ok(name, cond, extra) { results.push([cond ? 'PASS' : 'FAIL', name, extra || '']); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ar-EG',
    geolocation: { latitude: 30.0727, longitude: 31.6446 }, permissions: ['geolocation']
  });
  // الاختبار ده لوضع العيّنة: بنفضّي رابط السكريبت قبل ما التطبيق يقرا الإعدادات، عشان ما يطلبش دخول.
  // (بيشتغل حتى لو عامل الخدمة هو اللي جاب config.js من المحفوظ)
  await ctx.addInitScript(() => {
    let c;
    Object.defineProperty(window, 'BDW_CONFIG', { configurable: true,
      get() { return c; }, set(v) { c = Object.assign({}, v, { API_URL: '', WRITE_URL: '' }); } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = async (n, full) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(SHOTS, n + '.png'), fullPage: !!full }); };
  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const click = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(200); };
  const toast = async () => (await page.locator('#toast').textContent()) || '';
  const role = async (r) => { await page.evaluate(() => { location.hash = ''; }); await page.waitForSelector('[data-act="menu"]'); await click('[data-act="menu"]'); await click('[data-act="role"][data-r="' + r + '"]'); await page.waitForTimeout(300); };
  const draw = async () => {
    await page.evaluate(() => document.querySelector('#sig').scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
    const box = await page.locator('#sig canvas').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 70); await page.mouse.down();
    for (let i = 0; i <= 12; i++) await page.mouse.move(box.x + 40 + i * 20, box.y + 70 + Math.sin(i) * 25, { steps: 2 });
    await page.mouse.up(); await page.waitForTimeout(150);
  };

  await page.goto(BASE); await page.waitForSelector('.greet');
  await shot('01-site-home');
  ok('home renders for site role', await page.locator('.act').count() === 3);
  ok('no horizontal overflow on home', !(await overflow()));

  /* ---------- إذن توريد ---------- */
  await click('[data-act="go"][data-to="new/permit"]'); await page.waitForSelector('.form');
  await shot('02-permit-empty');
  await click('[data-act="save"]');
  const errs = await page.locator('.fe').count();
  ok('empty permit shows field errors', errs >= 5, errs + ' errors');
  await shot('03-permit-errors');
  await click('[data-act="pick"][data-f="party"]'); await page.waitForSelector('#sheet .opt');
  await shot('04-sheet-party');
  await click('[data-act="sheet-pick"][data-v="V-001"]');
  await click('[data-act="pick"][data-f="item"]'); await click('[data-act="sheet-pick"][data-v="I-C02"]');
  ok('price auto-filled from last price', (await page.inputValue('#f-price')) === '1950');
  await page.fill('#f-qty', '12');
  await page.fill('#f-price', '2300');
  ok('price warning shows for +17.9%', (await page.locator('#f-pricewarn .alert.warn').count()) === 1);
  ok('total recalculates live', /27,600/.test(await page.locator('#f-total').textContent()));
  await page.setInputFiles('#f-photo-in', PHOTO); await page.waitForSelector('#w-photo .photo img', { timeout: 5000 });
  await draw();
  await page.waitForTimeout(400);
  ok('location captured inside radius', /داخل نطاق المشروع/.test(await page.locator('#f-loc').textContent()));
  await shot('05-permit-filled', true);
  await click('[data-act="save"]'); await page.waitForTimeout(300);
  ok('after save goes to mine', (await page.evaluate(() => location.hash)) === '#mine');
  ok('pending row visible right after save', (await page.locator('.chip.c-sync').count()) >= 1);
  await shot('06-mine-pending');
  await page.waitForTimeout(1500);
  ok('permit numbered SP-0201', /SP-0201/.test(await page.locator('main').textContent()), await toast());
  await shot('07-mine-numbered');

  /* ---------- محضر كميات بيتجاوز المقايسة ---------- */
  await page.goto(BASE + '#new/qty'); await page.waitForSelector('.form');
  await click('[data-act="pick"][data-f="boq"]'); await click('[data-act="sheet-pick"][data-v="I-R06"]');
  await page.fill('#f-qty', '300');
  ok('overrun warning on qty form', (await page.locator('#f-over .alert.warn').count()) === 1);
  await click('[data-act="seg"][data-f="exec"][data-v="sub"]'); await page.waitForSelector('#sheet .opt');
  await click('[data-act="sheet-pick"][data-v="S-005"]');
  await page.setInputFiles('#f-photo-in', PHOTO); await page.waitForSelector('#w-photo .photo img');
  await page.waitForTimeout(300);
  await shot('08-qty-filled', true);
  await click('[data-act="save"]'); await page.waitForTimeout(1600);
  ok('qty numbered Q-0099', /Q-0099/.test(await page.locator('main').textContent()));

  /* ---------- مصروف عهدة ---------- */
  await page.goto(BASE + '#custody'); await page.waitForSelector('.prog');
  await shot('09-custody');
  await click('[data-act="go"][data-to="new/exp"]'); await page.waitForSelector('.form');
  await click('[data-act="seg"][data-f="cat"][data-v="إعاشة"]');
  await page.fill('#f-desc', 'وجبات عمال الوردية المسائية');
  await page.fill('#f-amount', '30000');
  await page.setInputFiles('#f-photo-in', PHOTO); await page.waitForSelector('#w-photo .photo img');
  await click('[data-act="save"]');
  ok('amount over custody rejected', /أكبر من المتبقي/.test(await page.locator('#w-amount').textContent()));
  await shot('10-exp-over');
  await page.fill('#f-amount', '600');
  await click('[data-act="save"]'); await page.waitForTimeout(1600);
  ok('expense saved and listed in custody', /EX-0015/.test(await page.locator('main').textContent()));

  /* ---------- محاسب المشروع: الاعتماد والرفض ---------- */
  await role('acc'); await page.waitForSelector('.kgrid');
  await shot('11-acc-home');
  await page.goto(BASE + '#inbox'); await page.waitForSelector('.tabs');
  await shot('12-acc-inbox');
  const quick = await page.locator('[data-act="quick"]').count(), review = await page.locator('.row .chip.c-reg').count();
  ok('inbox: quick actions for clean docs, review chip for flagged', quick >= 2 && review >= 2, quick + ' quick / ' + review + ' review');
  ok('no horizontal overflow on inbox', !(await overflow()));
  await click('[data-act="doc"][data-key="s-199"]'); await page.waitForSelector('.dhero');
  await page.waitForTimeout(300);
  await shot('13-doc-review', true);
  ok('doc shows price warning', /أعلى من آخر سعر معتمد/.test(await page.locator('main').textContent()));
  await click('.dhero'); await page.waitForSelector('.zoom svg');
  await shot('14-zoom');
  await click('[data-act="sheet-close"]');
  await click('.fbar [data-act="reject"]'); await page.waitForSelector('#w-reason');
  await click('[data-act="rej-confirm"]');
  ok('reject without reason blocked', /اختار سبب الرفض/.test(await page.locator('#w-reason').textContent()));
  await click('[data-act="rej-reason"][data-v="أخرى"]');
  await click('[data-act="rej-confirm"]');
  ok('«أخرى» needs a note', /اكتب السبب/.test(await page.locator('main').textContent()));
  await click('[data-act="rej-reason"][data-v="السعر غير مطابق"]');
  await page.fill('#rej-note', 'آخر سعر معتمد للمورد 1,950 ج للمتر؛ راجع الإذن الورقي');
  await shot('15-reject-form');
  await click('[data-act="rej-confirm"]'); await page.waitForSelector('.dlg');
  await shot('16-reject-confirm');
  await click('[data-act="dlg-ok"]'); await page.waitForTimeout(400);
  ok('after reject back to inbox', (await page.evaluate(() => location.hash)) === '#inbox', await toast());
  await click('[data-act="quick"][data-key="s-200"]'); await page.waitForSelector('.dlg');
  await shot('17-approve-confirm');
  await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('quick approve toast', /اتعتمد SP-0200/.test(await toast()), await toast());
  ok('own new permit SP-0201 is in acc inbox (made by site)', (await page.locator('[data-key]').evaluateAll(els => els.some(e => /SP-0201/.test(e.textContent)))));
  await page.goto(BASE + '#doc/s-200'); await page.waitForSelector('.tlx');
  await shot('18-doc-approved', true);
  ok('approved doc shows journal line', /قيد اليومية: 5100 مدين/.test(await page.locator('.tlx').textContent()));

  /* ---------- محاسب الموقع: يعدّل المرفوض ويعيد إرساله ---------- */
  await role('site');
  await page.goto(BASE + '#mine'); await page.waitForSelector('.tabs');
  await click('[data-act="mine-tab"][data-t="permit"]');
  await shot('19-site-mine-rejected');
  await click('[data-act="doc"][data-key="s-199"]'); await page.waitForSelector('.fbar');
  await shot('20-rejected-doc', true);
  await click('.fbar [data-act="go"]'); await page.waitForSelector('.form');
  ok('edit form prefilled with rejected values', (await page.inputValue('#f-price')) === '2120');
  await page.fill('#f-price', '1950');
  await shot('21-edit-form');
  await click('[data-act="save"]'); await page.waitForTimeout(1500);
  await page.goto(BASE + '#doc/s-199'); await page.waitForSelector('.tlx');
  const tl = await page.locator('.tlx').textContent();
  ok('timeline keeps rejection and resubmission', /رُفض/.test(tl) && /أُعيد إرساله/.test(tl), tl.replace(/\s+/g, ' ').slice(0, 160));
  ok('resubmitted doc back to registered', (await page.locator('.dmeta .chip').textContent()).includes('مسجَّل'));

  /* ---------- المهندس ---------- */
  await role('eng'); await page.goto(BASE + '#inbox'); await page.waitForSelector('.tabs');
  await shot('22-eng-inbox');
  ok('eng inbox excludes own q-097', (await page.locator('[data-key="q-097"]').count()) === 0);
  await page.goto(BASE + '#doc/' + encodeURIComponent(await page.evaluate(() => (JSON.parse(localStorage.getItem('bdw_demo_docs')) || []).find(d => d.id === 'Q-0099').key)));
  await page.waitForSelector('.kv2'); await page.waitForTimeout(250);
  await shot('23-eng-qty-doc', true);
  ok('qty doc shows overrun warning', /من كمية المقايسة/.test(await page.locator('main').textContent()));
  await click('.fbar [data-act="approve"]'); await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('eng approved Q-0099', /اتعتمد Q-0099/.test(await toast()), await toast());

  /* ---------- المالك ---------- */
  await role('owner'); await page.goto(BASE + '#inbox'); await page.waitForSelector('.tabs');
  await shot('24-owner-inbox');
  ok('owner sees eng-made q-097', (await page.locator('[data-act="inbox-tab"][data-t="qty"] .cnt').count()) === 1);
  await page.goto(BASE + '#doc/ss-007'); await page.waitForSelector('.kv2');
  await shot('25-owner-stmt', true);
  await click('.fbar [data-act="approve"]'); await page.waitForSelector('.dlg');
  ok('final approval wording', /اعتماد نهائي/.test(await page.locator('.dlg').textContent()));
  await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  await page.goto(BASE + '#doc/v-296'); await page.waitForSelector('.kv2');
  await shot('26-owner-voucher', true);
  ok('voucher overpaid warning', /مدفوع له بالزيادة/.test(await page.locator('main').textContent()));

  /* ---------- من غير نت ---------- */
  await role('site');
  await ctx.setOffline(true); await page.waitForTimeout(200);
  await page.goto(BASE + '#new/exp').catch(() => { });
  await page.evaluate(() => { location.hash = '#new/exp'; }); await page.waitForSelector('.form');
  await click('[data-act="seg"][data-f="cat"][data-v="وقود"]');
  await page.fill('#f-desc', 'سولار مولد الموقع');
  await page.fill('#f-amount', '450');
  await page.setInputFiles('#f-photo-in', PHOTO); await page.waitForSelector('#w-photo .photo img');
  await click('[data-act="save"]'); await page.waitForTimeout(700);
  ok('offline: saved to device', /هيتبعت لما النت يرجع/.test(await toast()), await toast());
  ok('offline: netbar visible', await page.locator('.netbar').isVisible());
  await shot('27-offline-custody');
  await ctx.setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.waitForTimeout(1600);
  ok('back online: queued expense numbered', /EX-0016/.test(await page.locator('main').textContent()), await toast());
  await shot('28-online-synced');

  await page.goto(BASE + '#all'); await page.waitForSelector('.pg-sec');
  await shot('29-all-screens', true);
  ok('no horizontal overflow on all-screens', !(await overflow()));
  await page.goto(BASE + '#prefs'); await page.waitForSelector('.tgl');
  await shot('30-settings');

  ok('no JS errors', errors.length === 0, errors.join(' | '));
  for (const r of results) console.log(r[0], '-', r[1], r[2] ? '— ' + r[2] : '');
  console.log(results.filter(r => r[0] === 'FAIL').length + ' failed of ' + results.length);
  await browser.close();
})().catch(e => { console.error('CRASH', e); for (const r of results) console.log(r[0], '-', r[1], r[2] ? '— ' + r[2] : ''); process.exit(1); });
