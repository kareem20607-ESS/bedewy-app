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
  await click('.fbar [data-act="f-approve"]'); await page.waitForSelector('.dlg');
  ok('final approval wording', /اعتماد نهائي/.test(await page.locator('.dlg').textContent()));
  await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  await page.goto(BASE + '#doc/v-296'); await page.waitForSelector('.kv2');
  await shot('26-owner-voucher', true);
  ok('voucher overpaid warning', /مدفوع له بالزيادة/.test(await page.locator('main').textContent()));

  /* ---------- المرحلة التانية: المستخلصات (4.1، 4.2) ---------- */
  const main = async () => (await page.locator('main').textContent()) || '';
  await role('acc');
  ok('acc nav: statements, vouchers, parties', (await page.locator('.nav [data-to="stmts"]').count()) === 1 && (await page.locator('.nav [data-to="vouchers"]').count()) === 1 && (await page.locator('.nav [data-to="parties"]').count()) === 1);
  await page.goto(BASE + '#stmts'); await page.waitForSelector('.tabs');
  await shot('31-stmts');
  ok('statements grouped by status', /تحت المراجعة/.test(await main()) && /معتمد/.test(await main()) && (await page.locator('[data-act="f-stmt"]').count()) >= 6);
  ok('no horizontal overflow on statements', !(await overflow()));
  await click('[data-act="f-stmt"][data-id="SS-007"]'); await page.waitForSelector('.netl');
  await shot('32-stmt-detail', true);
  ok('statement lines from qty, no-rate warning, paid and remaining', /البنود من المحاضر/.test(await main()) && /بلا فئة في عقد المقاول/.test(await main()) && /المدفوع على المستخلص ده/.test(await main()) && /24,000/.test(await main()));
  ok('statement has a PDF row', (await page.locator('[data-act="f-pdf"]').count()) === 1 && /PDF المستخلص/.test(await main()));
  await click('[data-act="f-pdf"]');
  ok('demo: PDF explains it needs the data file', /بيطلع من ملف البيانات/.test(await toast()), await toast());
  await page.goto(BASE + '#stmts'); await page.waitForSelector('.fab');
  await click('.fab'); await page.waitForSelector('.form');
  await click('[data-act="f-save"]');
  ok('new statement needs a contractor', /اختار المقاول/.test(await page.locator('#w-party').textContent()));
  await click('[data-act="f-pick"][data-k="party"]'); await click('[data-act="sheet-pick"][data-v="S-001"]');
  ok('ready qty summarized', /3 محاضر/.test(await page.locator('#f-sum').textContent()) && /455,000/.test(await page.locator('#f-sum').textContent()), (await page.locator('#f-sum').textContent()).replace(/\s+/g, ' '));
  await click('[data-act="f-lines"]');
  ok('ready qty listed, one without rate', (await page.locator('#f-sum .ln').count()) === 3 && /بلا فئة/.test(await page.locator('#f-sum').textContent()));
  await page.fill('#f-ded', '5000');
  ok('net updates live', /450,000/.test(await page.locator('#f-net').textContent()), await page.locator('#f-net').textContent());
  await shot('33-new-stmt', true);
  ok('no horizontal overflow on new statement', !(await overflow()));
  await click('[data-act="f-save"]'); await page.waitForSelector('.dlg');
  ok('link confirmation names the qty count', /ربط 3 محاضر بمستخلص جديد/.test(await page.locator('.dlg').textContent()));
  await click('[data-act="dlg-ok"]');
  await page.waitForFunction(() => location.hash === '#stmt/SS-008', null, { timeout: 4000 }).catch(() => { });
  await page.waitForSelector('.netl');
  ok('draft created and opened', (await page.evaluate(() => location.hash)) === '#stmt/SS-008' && (await page.locator('.dmeta .chip').textContent()).includes('مسودة'), await page.evaluate(() => location.hash));
  ok('draft worth: 455,000 works, 450,000 net', /455,000/.test(await main()) && /450,000/.test(await main()));
  await shot('34-draft', true);
  await click('.fbar [data-act="f-send"]'); await page.waitForSelector('.dlg'); await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('draft sent for review', /اتبعت SS-008 للمراجعة/.test(await toast()) && (await page.locator('.dmeta .chip').textContent()).includes('تحت المراجعة'), await toast());
  await role('eng'); await page.goto(BASE + '#inbox'); await page.waitForSelector('.tabs');
  await click('[data-act="inbox-tab"][data-t="stmt"]');
  ok('eng inbox has the new statement', /SS-008/.test(await main()) && /SS-005/.test(await main()));
  await page.locator('[data-act="doc"]', { hasText: 'SS-008' }).first().click(); await page.waitForSelector('.netl');
  await click('.fbar [data-act="f-approve"]'); await page.waitForSelector('.dlg');
  ok('technical approval wording', /اعتماد فني لـ SS-008/.test(await page.locator('.dlg').textContent()));
  await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('eng technical approval back to inbox', /اعتماد فني لـ SS-008/.test(await toast()) && (await page.evaluate(() => location.hash)) === '#inbox', await toast());

  /* ---------- السندات (4.3) ---------- */
  await role('acc'); await page.goto(BASE + '#vouchers'); await page.waitForSelector('#f-list');
  await shot('35-vouchers');
  ok('vouchers by day, migrated group folded', /اليوم/.test(await main()) && /مرحّلة من ملف الشركة/.test(await main()) && !/PV-0101/.test(await main()));
  await page.fill('#f-q', 'PV-0101');
  ok('search reaches a migrated voucher', /PV-0101/.test(await page.locator('#f-list').textContent()));
  await page.fill('#f-q', '');
  await click('.fab'); await page.waitForSelector('.form');
  await click('[data-act="f-pick"][data-k="party"]'); await click('[data-act="sheet-pick"][data-v="S-001"]');
  ok('account suggested from the party type', /2100/.test(await page.locator('#w-account').textContent()) && /مقترح من نوع الطرف/.test(await page.locator('#w-account').textContent()));
  ok('overpaid balance warning before paying', /مدفوع له بالزيادة/.test(await page.locator('#f-vbal').textContent()));
  await page.fill('#f-amount', '20000'); await page.fill('#f-desc', 'دفعة تحت الحساب');
  await shot('36-new-voucher', true);
  await click('[data-act="f-save"]'); await page.waitForTimeout(1500);
  ok('voucher within the limit approved on entry', /PV-0297 واتعتمد/.test(await toast()), await toast());
  await click('.fab'); await page.waitForSelector('.form');
  await click('[data-act="f-pick"][data-k="party"]'); await click('[data-act="sheet-pick"][data-v="S-005"]');
  await page.fill('#f-amount', '80000');
  ok('over-limit note while typing', /فوق حد الاعتماد/.test(await page.locator('#h-amount').textContent()));
  await page.fill('#f-desc', 'دفعة على المستخلص');
  await click('[data-act="f-save"]'); await page.waitForTimeout(1500);
  ok('voucher over the limit waits for the owner', /PV-0298، وبينتظر اعتماد المالك/.test(await toast()), await toast());
  await role('owner'); await page.goto(BASE + '#inbox'); await page.waitForSelector('.tabs');
  await click('[data-act="inbox-tab"][data-t="voucher"]');
  ok('owner inbox has the big voucher', /PV-0298/.test(await main()));
  await page.locator('[data-act="doc"]', { hasText: 'PV-0298' }).first().click(); await page.waitForSelector('.fbar');
  await click('.fbar [data-act="approve"]'); await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('owner approved PV-0298', /اتعتمد PV-0298/.test(await toast()), await toast());

  /* ---------- الأطراف (4.4) واللوحة (5.1) ---------- */
  await role('acc'); await page.goto(BASE + '#parties'); await page.waitForSelector('#f-list');
  await shot('37-parties');
  ok('overpaid parties in red', (await page.locator('[data-code="S-006"] .bal.red').count()) === 1 && (await page.locator('[data-code="S-005"] .bal.green').count()) === 1);
  await page.fill('#f-q', 'فتحي');
  ok('party search', (await page.locator('#f-list [data-act="f-party"]').count()) === 1);
  await page.fill('#f-q', '');
  await click('[data-act="f-party"][data-code="S-001"]'); await page.waitForSelector('.pcard');
  await shot('38-party', true);
  ok('party card: call and WhatsApp from the phone', (await page.locator('a[href="tel:01000000011"]').count()) === 1 && (await page.locator('a[href="https://wa.me/201000000011"]').count()) === 1);
  ok('party card: new voucher counted in payments', /PV-0297/.test(await main()) && /مدفوع بالزيادة/.test(await main()));
  await role('owner'); await page.goto(BASE + '#dash'); await page.waitForSelector('.bars');
  await shot('39-dash', true);
  ok('dashboard: six tiles, bars without the guarantee', (await page.locator('.kpi').count()) === 6 && (await page.locator('.bar').count()) === 7 && /محتجز يُرد/.test(await main()));
  ok('no horizontal overflow on dashboard', !(await overflow()));

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

  /* 5.3 أرشيف المستندات */
  await role('eng');
  ok('eng nav has the archive', (await page.locator('.nav [data-to="archive"]').count()) === 1);
  await click('.nav [data-to="archive"]'); await page.waitForSelector('.arcs');
  ok('archive: permits by month with photos', (await page.locator('.arc').count()) > 0 && (await page.locator('.arc .th svg, .arc .th img').count()) > 0 && /الإذونات/.test(await page.locator('.tabs').textContent()) && (await page.locator('main .gh').count()) > 0);
  await shot('33-archive');
  ok('no horizontal overflow on archive', !(await overflow()));
  const arcId = ((await page.locator('.arc .tx b').first().textContent()) || '').trim();
  await page.fill('#ar-q', arcId); await page.waitForTimeout(200);
  ok('archive search by number', (await page.locator('.arc').count()) >= 1 && ((await page.locator('.arc .tx b').first().textContent()) || '').trim() === arcId, arcId);
  await page.fill('#ar-q', 'zzzz'); await page.waitForTimeout(150);
  ok('archive search with no result says what to try', /مفيش نتيجة/.test(await main()));
  await page.fill('#ar-q', ''); await page.waitForTimeout(150);
  await click('[data-act="ar-tab"][data-t="qty"]');
  ok('archive qty tab', (await page.locator('.arc').count()) > 0);
  await click('.arc'); await page.waitForSelector('.zoomwrap');
  ok('card opens the photo with its caption', /محضر كميات/.test(await page.locator('.zcap').textContent()) && (await page.locator('[data-act="ar-doc"]').count()) === 1);
  await click('[data-act="ar-doc"]'); await page.waitForTimeout(300);
  ok('open the document from the archive', /^#doc\//.test(await page.evaluate(() => location.hash)), await page.evaluate(() => location.hash));
  await role('acc');
  await click('[data-act="menu"]');
  ok('office reaches the archive from the menu', (await page.locator('.dr-item[data-to="archive"]').count()) === 1);
  await click('.dr-item[data-to="archive"]'); await page.waitForSelector('.arcs');
  ok('accountant sees the archive', (await page.locator('.arc').count()) > 0);

  /* 5.2 العرض على الكمبيوتر: على الموبايل الأجزاء تحت بعض */
  await click('[data-act="menu"]');
  ok('office reaches the desk view from the menu', (await page.locator('.dr-item[data-to="desk"]').count()) === 1);
  await click('.dr-item[data-to="desk"]'); await page.waitForSelector('#dk-tb');
  ok('desk on a phone: registers, table and details stacked, no overflow', (await page.locator('.dk-side [data-act="dk-set"]').count()) === 6 && !(await overflow()) && await page.locator('.nav').isVisible());
  await shot('40-desk-phone');

  /* وعلى الكمبيوتر: ثلاث أعمدة */
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'ar-EG' });
  await dctx.addInitScript(() => {
    let c;
    Object.defineProperty(window, 'BDW_CONFIG', { configurable: true,
      get() { return c; }, set(v) { c = Object.assign({}, v, { API_URL: '', WRITE_URL: '' }); } });
  });
  const dp = await dctx.newPage();
  dp.on('pageerror', e => errors.push('desk pageerror: ' + e.message));
  dp.on('console', m => { if (m.type() === 'error') errors.push('desk console: ' + m.text()); });
  const dwait = (ms) => dp.waitForTimeout(ms || 250);
  const drole = async (r) => { await dp.evaluate(() => { location.hash = ''; }); await dp.waitForSelector('[data-act="menu"]'); await dp.click('[data-act="menu"]'); await dp.click('[data-act="role"][data-r="' + r + '"]'); await dwait(300); };
  const desk = async () => { await dp.evaluate(() => { location.hash = 'desk'; }); await dp.waitForSelector('#dk-tb'); await dwait(); };
  const rowsN = async () => dp.locator('#dk-tb tr[data-k]').count();
  const selId = async () => ((await dp.locator('#dk-tb tr.sel .rid').textContent().catch(() => '')) || '').trim();
  await dp.goto(BASE); await dp.waitForSelector('.greet');
  await drole('acc'); await desk();
  const inboxN = await rowsN(), first = await selId();
  ok('desk on a computer: wide layout, no bottom bar, first row open with its decision', await dp.evaluate(() => document.body.classList.contains('is-desk')) &&
    !(await dp.locator('.nav').isVisible()) && inboxN > 1 && !!first && (await dp.locator('#dk-det [data-act="quick"]').count()) === 1 &&
    (await dp.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)), [inboxN, first]);
  await dp.screenshot({ path: path.join(SHOTS, '41-desk-inbox.png') });
  await dp.click('#dk-det [data-act="quick"]'); await dp.waitForSelector('#sheet [data-act="dlg-ok"]'); await dp.click('#sheet [data-act="dlg-ok"]'); await dwait(500);
  ok('approve from the panel: the row leaves, the next one opens', (await rowsN()) === inboxN - 1 && (await selId()) !== first && !!(await selId()) &&
    /اتعتمد/.test((await dp.locator('#toast').textContent()) || '') && /^#desk$/.test(await dp.evaluate(() => location.hash)), [await rowsN(), await selId()]);
  await dp.click('[data-act="dk-set"][data-s="permit"]'); await dwait();
  const permitN = await rowsN();
  await dp.fill('#dk-q', 'SP-0197'); await dwait(150);
  ok('search narrows the table and the count says how many of all', (await rowsN()) === 1 && /1 من/.test(await dp.locator('.dk-bar h2').textContent()), await dp.locator('.dk-bar h2').textContent());
  await dp.fill('#dk-q', 'zzzz'); await dwait(150);
  ok('search with no match says what to change', /غيّر الكلمة/.test(await dp.locator('#dk-tb').textContent()));
  await dp.fill('#dk-q', ''); await dwait(150);
  await dp.selectOption('#dk-st', 'مرفوض'); await dwait(150);
  const stRows = await dp.locator('#dk-tb tr[data-k] .chip').allTextContents();
  ok('status filter keeps only that status', stRows.length >= 1 && stRows.length < permitN && stRows.every(t => /مرفوض/.test(t)), stRows);
  await dp.selectOption('#dk-st', ''); await dwait(150);
  await dp.click('[data-act="dk-sort"][data-c="amount"]'); await dwait();
  const amts = (await dp.locator('#dk-tb td.n').allTextContents()).map(t => Number(t.replace(/[^\d]/g, '')) || 0);
  ok('sort by value, largest first', amts.length === permitN && amts.every((v, i) => i === 0 || amts[i - 1] >= v) && /▾/.test(await dp.locator('th[aria-sort="descending"]').textContent()), amts);
  await dp.click('[data-act="dk-set"][data-s="voucher"]'); await dwait();
  ok('vouchers: every voucher of the project, receipts too', (await rowsN()) > 10 && /قبض/.test(await dp.locator('#dk-tb').textContent()));
  await dp.locator('#dk-tb tr[data-k] td:nth-child(4)').first().click(); await dwait(150);
  const v1 = await selId();
  await dp.keyboard.press('ArrowDown'); await dwait(150);
  const v2 = await selId();
  ok('arrow keys move through the rows and the panel follows', !!v1 && v2 !== v1 && ((await dp.locator('#dk-det .dk-h').textContent()) || '').trim() === v2 &&
    await dp.evaluate(() => document.activeElement && document.activeElement.classList.contains('rid')), [v1, v2]);
  const lineRow = await dp.evaluate(() => { const t = [...document.querySelectorAll('#dk-tb tr[data-k]')].find(tr => /RV-/.test(tr.textContent)); return t ? t.getAttribute('data-k') : ''; });
  await dp.click('#dk-tb tr[data-k="' + lineRow + '"] .rid'); await dwait(150);
  ok('a register line with no document is for viewing only', /للعرض بس/.test(await dp.locator('#dk-det').textContent()) && (await dp.locator('#dk-det [data-act="quick"]').count()) === 0, lineRow);
  await dp.click('[data-act="dk-set"][data-s="inbox"]'); await dwait();
  await dp.locator('#dk-tb tr.sel .rid').focus(); await dp.keyboard.press('Enter'); await dwait(300);
  ok('Enter opens the full document', /^#doc\//.test(await dp.evaluate(() => location.hash)), await dp.evaluate(() => location.hash));
  await dp.click('[data-act="back"]'); await dwait(400);
  ok('back returns to the desk on the same register', (await dp.evaluate(() => location.hash)) === '#desk' && (await dp.locator('.dk-side .on').getAttribute('data-s')) === 'inbox');
  const rejN = await rowsN(), rejId = await selId();
  await dp.click('#dk-det [data-act="reject"]'); await dp.waitForSelector('[data-act="rej-reason"]');
  await dp.locator('[data-act="rej-reason"]').first().click(); await dp.click('[data-act="rej-confirm"]');
  await dp.waitForSelector('#sheet [data-act="dlg-ok"]'); await dp.click('#sheet [data-act="dlg-ok"]'); await dwait(600);
  ok('reject from the desk comes back to the desk', (await dp.evaluate(() => location.hash)) === '#desk' && (await rowsN()) === rejN - 1 &&
    !(await dp.locator('#dk-tb').textContent()).includes(rejId), [await dp.evaluate(() => location.hash), rejId]);
  await drole('owner'); await desk();
  await dp.click('[data-act="dk-set"][data-s="stmt"]'); await dwait();
  await dp.click('#dk-tb tr[data-k="doc|ss-007"] .rid').catch(() => {}); await dwait(150);
  const okBtn = ((await dp.locator('#dk-det [data-act="quick"]').textContent().catch(() => '')) || '');
  ok('owner: a statement waiting for the final approval has it in the panel', /اعتماد نهائي/.test(okBtn) && (await dp.locator('#dk-det .dk-open').count()) === 1, okBtn);
  await dp.screenshot({ path: path.join(SHOTS, '42-desk-stmt.png') });
  await dp.click('#dk-det .dk-open'); await dp.waitForSelector('[data-act="f-approve"]');
  await dp.click('[data-act="f-approve"]'); await dp.waitForSelector('#sheet [data-act="dlg-ok"]'); await dp.click('#sheet [data-act="dlg-ok"]'); await dwait(600);
  ok('final approval from the full statement comes back to the desk', (await dp.evaluate(() => location.hash)) === '#desk' &&
    /معتمد/.test(await dp.locator('#dk-tb tr[data-k="doc|ss-007"]').textContent()), await dp.evaluate(() => location.hash));
  await drole('site'); await dp.evaluate(() => { location.hash = 'desk'; }); await dp.waitForSelector('main .empty'); await dwait();
  ok('site role: the desk is for the office', /للمكتب/.test(await dp.locator('main').textContent()) && !(await dp.evaluate(() => document.body.classList.contains('is-desk') && !!document.querySelector('.dk-side'))));
  await dctx.close();

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
