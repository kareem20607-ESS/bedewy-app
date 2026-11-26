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

  /* المرحلة التانية والتطبيق متوصّل: مستخلص من المحاضر الجاهزة، إرساله للمراجعة، سند، بطاقة طرف، ولوحة */
  const am = async () => (await ap.locator('main').textContent()) || '';
  await ap.evaluate(() => { location.hash = '#stmts'; }); await ap.waitForSelector('.tabs');
  ok('statements list from the script', /SS-001/.test(await am()));
  await ap.evaluate(() => { location.hash = '#add/stmt'; }); await ap.waitForSelector('.form');
  await click(ap, '[data-act="f-pick"][data-k="party"]'); await click(ap, '[data-act="sheet-pick"][data-v="S-001"]');
  ok('ready qty from the sheet: two records, 70,000', /محضرين/.test(await ap.locator('#f-sum').textContent()) && /70,000/.test(await ap.locator('#f-sum').textContent()), await ap.locator('#f-sum').textContent());
  await click(ap, '[data-act="f-save"]'); await ap.waitForSelector('.dlg'); await click(ap, '[data-act="dlg-ok"]');
  await ap.waitForFunction(() => location.hash === '#stmt/SS-002', null, { timeout: 15000 }).catch(() => { });
  await ap.waitForSelector('.netl', { timeout: 15000 });
  sh = await sheet();
  const s2 = sh.stmts.find(r => r[0] === 'SS-002');
  ok('draft statement written and opened', !!s2 && s2[15] === 'مسودة' && s2[4] === 'S-001' && (await ap.evaluate(() => location.hash)) === '#stmt/SS-002', JSON.stringify(s2));
  ok('qty linked to the new statement', sh.qty.filter(r => r[15] === 'SS-002').map(r => r[0]).join(',') === 'Q-0003,Q-0004', JSON.stringify(sh.qty.map(r => [r[0], r[15]])));
  await ap.screenshot({ path: path.join(SHOTS, 'live-05-draft.png'), fullPage: true });
  await click(ap, '.fbar [data-act="f-send"]'); await ap.waitForSelector('.dlg'); await click(ap, '[data-act="dlg-ok"]');
  await ap.waitForFunction(() => /تحت المراجعة/.test((document.querySelector('.dmeta .chip') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => { });
  sh = await sheet();
  ok('sent for review in the sheet and the app', (sh.stmts.find(r => r[0] === 'SS-002') || [])[15] === 'تحت المراجعة' && /تحت المراجعة/.test(await ap.locator('.dmeta .chip').textContent()));
  await ap.evaluate(() => { location.hash = '#add/voucher'; }); await ap.waitForSelector('.form');
  await click(ap, '[data-act="f-pick"][data-k="party"]'); await click(ap, '[data-act="sheet-pick"][data-v="S-001"]');
  await ap.fill('#f-amount', '20000'); await ap.fill('#f-desc', 'دفعة على المستخلص');
  await click(ap, '[data-act="f-pick"][data-k="ref"]'); await click(ap, '[data-act="sheet-pick"][data-v="SS-002"]');
  await click(ap, '[data-act="f-save"]');
  await ap.waitForFunction(() => /PV-0006/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => { });
  ok('voucher numbered and approved by the script', /PV-0006 واتعتمد/.test(await toast(ap)), await toast(ap));
  sh = await sheet();
  const pv = sh.vouchers.find(r => r[0] === 'PV-0006');
  ok('voucher row: account from party type, reference, approved', !!pv && pv[7] === '2100' && pv[12] === 'SS-002' && pv[14] === 'معتمد' && pv[15] === 'عادل المحاسب', JSON.stringify(pv));
  await ap.evaluate(() => { location.hash = '#party/S-001'; }); await ap.waitForSelector('.pcard');
  await ap.waitForFunction(() => /PV-0006/.test(document.querySelector('main').textContent), null, { timeout: 15000 }).catch(() => { });
  ok('party card with phone and the new payment', (await ap.locator('a[href="tel:01000000001"]').count()) === 1 && /PV-0006/.test(await am()));
  await ap.evaluate(() => { location.hash = '#dash'; }); await ap.waitForSelector('.bars');
  ok('dashboard from the script', (await ap.locator('.kpi').count()) === 6 && /آخر تحديث من ملف البيانات/.test(await am()));
  await ap.screenshot({ path: path.join(SHOTS, 'live-06-dash.png'), fullPage: true });

  /* 6.2: اختيارات الإشعارات بتتحفظ في صف المستخدم في الشيت */
  const sheetNow = () => fetch('http://127.0.0.1:8790/sheet').then(r => r.json());
  const accRow = async () => (await sheetNow()).users.find(r => r[0] === 'acc@test.dev') || [];
  await ap.evaluate(() => { location.hash = '#prefs'; }); await ap.waitForSelector('.tgl');
  ok('prefs come from the users sheet', /محفوظة في صفّك/.test(await am()) && /acc@test\.dev/.test(await am()) &&
    (await ap.locator('[data-k="approve"] .tgl.off').count()) === 0 && (await ap.locator('[data-k="daily"] .tgl.off').count()) === 1);
  await click(ap, '[data-act="notify"][data-k="approve"]');
  await ap.waitForFunction(() => /وقفت إيميلات الاعتماد/.test(document.getElementById('toast').textContent), null, { timeout: 10000 }).catch(() => { });
  ok('turning approval emails off saves «لا»', (await accRow())[6] === 'لا' && (await ap.locator('[data-k="approve"] .tgl.off').count()) === 1, await toast(ap));
  await ap.reload(); await ap.waitForSelector('.tgl');
  await ap.waitForFunction(() => document.querySelector('[data-k="approve"] .tgl.off'), null, { timeout: 15000 }).catch(() => { });
  ok('the choice survives a reload', (await ap.locator('[data-k="approve"] .tgl.off').count()) === 1);
  await click(ap, '[data-act="notify"][data-k="daily"]');
  await ap.waitForFunction(() => /ملخص اليوم بالبريد/.test(document.getElementById('toast').textContent), null, { timeout: 10000 }).catch(() => { });
  ok('daily summary on for the accountant', (await accRow())[7] === 'نعم', await toast(ap));
  await click(ap, '[data-act="notify"][data-k="approve"]');
  await ap.waitForTimeout(800);
  ok('approval emails back on', (await accRow())[6] === 'نعم');

  /* 6.1: PDF المستخلص من شاشته */
  await ap.evaluate(() => { location.hash = '#stmt/SS-002'; }); await ap.waitForSelector('.netl');
  await click(ap, '[data-act="f-pdf"]');
  await ap.waitForSelector('.dlg', { timeout: 15000 }).catch(() => { });
  ok('statement PDF ready from the script', /PDF المستخلص جاهز/.test((await ap.locator('.dlg').textContent().catch(() => '')) || '') && /مستخلص SS-002 — .+\.pdf/.test(await ap.locator('.dlg p').textContent().catch(() => '')));
  await click(ap, '[data-act="sheet-close"]');

  /* 5.3: الأرشيف من السكريبت بصور صغيرة */
  await ap.evaluate(() => { location.hash = '#archive'; });
  await ap.waitForSelector('.arc', { timeout: 15000 }).catch(() => { });
  ok('archive from the script', (await ap.locator('.arc').count()) > 0 && /الإذونات/.test(await ap.locator('.tabs').textContent()));
  await ap.waitForSelector('.arc .th img', { timeout: 15000 }).catch(() => { });
  ok('archive thumbnails load through the script', (await ap.locator('.arc .th img').count()) > 0);

  /* 5.2: العرض على الكمبيوتر، والسجل الكامل للإذونات والمصروفات من السكريبت */
  await ap.setViewportSize({ width: 1280, height: 800 });
  await ap.evaluate(() => { location.hash = '#desk'; }); await ap.waitForSelector('#dk-tb');
  ok('desk opens wide in live mode', await ap.evaluate(() => document.body.classList.contains('is-desk')) && !(await ap.locator('.nav').isVisible()));
  await click(ap, '[data-act="dk-set"][data-s="permit"]');
  await ap.waitForSelector('#dk-tb tr[data-k="permit|SP-0001"]', { timeout: 15000 }).catch(() => { });
  ok('full permit register from the script, old rows included', (await ap.locator('#dk-tb tr[data-k="permit|SP-0001"]').count()) === 1 && (await ap.locator('.dk-hint').count()) === 0,
    await ap.locator('#dk-tb').textContent());
  await click(ap, '#dk-tb tr[data-k="permit|SP-0001"] .rid');
  ok('an old permit shows its line from the file', /للعرض بس/.test(await ap.locator('#dk-det').textContent()) && /1,950/.test(await ap.locator('#dk-det').textContent()));
  await click(ap, '[data-act="dk-set"][data-s="exp"]');
  await ap.waitForFunction(() => !document.querySelector('.dk-hint'), null, { timeout: 15000 }).catch(() => { });
  ok('custody expenses register from the script', (await ap.locator('#dk-tb tr[data-k^="exp|"]').count()) > 0);
  await ap.screenshot({ path: path.join(SHOTS, 'live-07-desk.png') });

  /* 6.4: مخزن الموقع وهو متوصّل: صرف من محاسب الموقع واعتماد المهندس، وجرد بفرق محسوب في السكريبت واعتماد محاسب المشروع */
  const sign = async (page) => {
    await page.evaluate(() => document.querySelector('#sig').scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
    const b = await page.locator('#sig canvas').boundingBox();
    await page.mouse.move(b.x + 40, b.y + 60); await page.mouse.down(); for (let i = 0; i < 10; i++) await page.mouse.move(b.x + 40 + i * 22, b.y + 60 + (i % 2) * 20, { steps: 2 }); await page.mouse.up();
    await page.waitForTimeout(300);
  };
  await sp.evaluate(() => { location.hash = '#store'; }); await sp.waitForSelector('#st-list', { timeout: 15000 }).catch(() => { });
  ok('store from the script: received from permits, concrete out', /100/.test(await sp.locator('[data-act="st-item"][data-code="I-P04"]').textContent().catch(() => '')) &&
    (await sp.locator('[data-act="st-item"][data-code="I-C02"]').count()) === 0, await sp.locator('main').textContent());
  await sp.evaluate(() => { location.hash = '#new/issue/I-P04'; }); await sp.waitForSelector('.form');
  await sp.fill('#f-qty', '30');
  await click(sp, '[data-act="seg"][data-f="exec"][data-v="sub"]'); await click(sp, '[data-act="sheet-pick"][data-v="S-001"]');
  await sign(sp); await click(sp, '[data-act="save"]');
  await sp.waitForFunction(() => /IS-0001/.test(document.querySelector('main') && document.querySelector('main').textContent), null, { timeout: 15000 }).catch(() => { });
  ok('issue numbered by the script', /IS-0001/.test(await sp.locator('main').textContent()), await toast(sp));
  sh = await sheet();
  const is1 = (sh.store || []).find(r => r[0] === 'IS-0001');
  ok('issue row in the store sheet', is1 && is1[3] === 'صرف للتنفيذ' && is1[4] === 'I-P04' && is1[7] === 30 && is1[9] === 'S-001' && is1[11] === 'مسجَّل' && is1[13] === 'سعيد الموقع', JSON.stringify(is1));
  await sp.evaluate(() => { location.hash = '#new/count/I-P04'; }); await sp.waitForSelector('.form');
  await sp.waitForFunction(() => /70/.test(document.getElementById('f-book').textContent), null, { timeout: 15000 }).catch(() => { });
  ok('book balance after the issue', /70/.test(await sp.locator('#f-book').textContent()), await sp.locator('#f-book').textContent());
  await sp.fill('#f-counted', '65'); await click(sp, '[data-act="save"]');
  await sp.waitForFunction(() => /IC-0001/.test(document.querySelector('main') && document.querySelector('main').textContent), null, { timeout: 15000 }).catch(() => { });
  sh = await sheet();
  const ic1 = (sh.store || []).find(r => r[0] === 'IC-0001');
  ok('count row: difference worked out by the script', ic1 && ic1[3] === 'جرد' && ic1[7] === -5 && ic1[8] === 65 && ic1[11] === 'مسجَّل', JSON.stringify(ic1));
  const eng = await as('eng'), ep = eng.page;
  await ep.goto(APP + '#inbox'); await ep.waitForSelector('.tabs', { timeout: 15000 });
  await click(ep, '[data-act="inbox-tab"][data-t="issue"]');
  ok('engineer inbox has the site issue', /IS-0001/.test(await ep.locator('main').textContent()));
  await click(ep, '[data-act="quick"]'); await ep.waitForSelector('.dlg'); await click(ep, '[data-act="dlg-ok"]');
  await ep.waitForFunction(() => /اتعتمد IS-0001/.test(document.getElementById('toast').textContent), null, { timeout: 15000 }).catch(() => { });
  sh = await sheet();
  ok('engineer approval written to the store sheet', ((sh.store || []).find(r => r[0] === 'IS-0001') || [])[11] === 'معتمد');
  await ap.setViewportSize({ width: 390, height: 844 });
  await ap.evaluate(() => { location.hash = '#inbox'; }); await ap.waitForSelector('.tabs');
  await click(ap, '.head [data-act="sync"]');
  await ap.waitForFunction(() => /الجرد/.test(document.querySelector('.tabs').textContent), null, { timeout: 15000 }).catch(() => { });
  await click(ap, '[data-act="inbox-tab"][data-t="count"]');
  await ap.waitForFunction(() => /IC-0001/.test(document.querySelector('main').textContent), null, { timeout: 15000 }).catch(() => { });
  ok('accountant inbox has the count with its difference', /IC-0001/.test(await ap.locator('main').textContent()) && /عجز 5/.test(await ap.locator('main').textContent()), await ap.locator('main').textContent());
  await ap.locator('[data-act="doc"]', { hasText: 'IC-0001' }).first().click(); await ap.waitForSelector('.fbar');
  await click(ap, '.fbar [data-act="approve"]'); await click(ap, '[data-act="dlg-ok"]');
  await ap.waitForFunction(() => /اتعتمد IC-0001/.test(document.getElementById('toast').textContent), null, { timeout: 15000 }).catch(() => { });
  sh = await sheet();
  ok('accountant approval of the count written', ((sh.store || []).find(r => r[0] === 'IC-0001') || [])[11] === 'معتمد');
  await sp.evaluate(() => { location.hash = '#store/I-P04'; }); await click(sp, '.head [data-act="sync"]');
  await sp.waitForFunction(() => document.querySelector('.sbig') && /^65/.test(document.querySelector('.sbig').textContent), null, { timeout: 15000 }).catch(() => { });
  ok('item balance from the script after both decisions', /^65/.test((await sp.locator('.sbig').textContent().catch(() => '')) || ''), await sp.locator('.sbig').textContent().catch(() => ''));
  await sp.screenshot({ path: path.join(SHOTS, 'live-08-store-item.png') });

  ok('no JS errors', errs.length === 0, errs.join(' | '));
  results.forEach(r => console.log(r[0], '-', r[1], r[0] === 'FAIL' && r[2] ? '— ' + r[2].slice(0, 300) : ''));
  console.log(results.filter(r => r[0] === 'FAIL').length + ' failed of ' + results.length);
  await browser.close();
})().catch(e => { console.error('CRASH', e); results.forEach(r => console.log(r[0], '-', r[1], r[2])); process.exit(1); });
