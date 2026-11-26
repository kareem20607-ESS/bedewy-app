// اختبار مخزن الموقع (6.4) في التطبيق بوضع العيّنة: القائمة والفئات والبحث، شاشة الصنف، صرف مواد بحد الرصيد،
// الجرد وفرقه، صندوق اعتماد المهندس والمالك ومحاسب المشروع، الرفض وإعادة الإرسال، والعرض على الكمبيوتر.
// التشغيل: من جذر المستودع  python -m http.server 8765  وبعدها  node tests/e2e-store.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const SHOTS = path.join(__dirname, 'shots'), BASE = process.env.BASE || 'http://localhost:8765/';
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
function ok(name, cond, extra) { results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : String(extra)]); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ar-EG',
    geolocation: { latitude: 30.0727, longitude: 31.6446 }, permissions: ['geolocation']
  });
  await ctx.addInitScript(() => {
    let c;
    Object.defineProperty(window, 'BDW_CONFIG', { configurable: true, get() { return c; }, set(v) { c = Object.assign({}, v, { API_URL: '', WRITE_URL: '' }); } });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const shot = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(SHOTS, 'store-' + n + '.png') }); };
  const click = async (sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(200); };
  const text = async (sel) => (await page.locator(sel).first().textContent()) || '';
  const go = async (h, sel) => { await page.evaluate((x) => { location.hash = x; }, h); if (sel) await page.waitForSelector(sel); await page.waitForTimeout(200); };
  const role = async (r) => { await go('', '[data-act="menu"]'); await click('[data-act="menu"]'); await click('[data-act="role"][data-r="' + r + '"]'); await page.waitForTimeout(300); };
  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const rows = async () => page.locator('#st-list .row').count();
  const draw = async () => {
    await page.evaluate(() => document.querySelector('#sig').scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
    const box = await page.locator('#sig canvas').boundingBox();
    await page.mouse.move(box.x + 40, box.y + 70); await page.mouse.down();
    for (let i = 0; i <= 12; i++) await page.mouse.move(box.x + 40 + i * 20, box.y + 70 + Math.sin(i) * 25, { steps: 2 });
    await page.mouse.up(); await page.waitForTimeout(150);
  };
  const toast = async () => (await page.locator('#toast').textContent()) || '';

  await page.goto(BASE); await page.waitForSelector('.greet');

  /* ---------- القائمة ---------- */
  ok('site home links to the store', /مخزن الموقع/.test(await text('.storecta')) && /6 أصناف ليها رصيد/.test(await text('.storecta')), await text('.storecta'));
  await click('.storecta'); await page.waitForSelector('#st-list');
  await shot('01-list');
  ok('store list: every item with a move', await rows() === 7, await rows());
  ok('summary: with balance, running low, finished', (await text('[data-act="st-f"][data-f=""] b')) === '6' && (await text('[data-act="st-f"][data-f="low"] b')) === '3' && (await text('[data-act="st-f"][data-f="empty"] b')) === '1');
  ok('low and finished items first', /قرب يخلص|خلص|بالسالب/.test(await page.locator('#st-list .row').first().textContent()));
  const w05 = await page.locator('[data-act="st-item"][data-code="I-W05"]').textContent();
  ok('balance = received − issued ± count, pending issue included', /85/.test(w05) && /وارد 4,800/.test(w05) && /منصرف 5,915/.test(w05) && /قرب يخلص/.test(w05), w05);
  ok('concrete consumed on delivery is not in the store', await page.locator('[data-act="st-item"][data-code="I-C02"]').count() === 0);
  ok('received from permits in the documents too', /620/.test(await page.locator('[data-act="st-item"][data-code="I-P05"]').textContent()));
  ok('no horizontal overflow on the store', !(await overflow()));
  await click('[data-act="st-f"][data-f="low"]');
  ok('filter: running low', await rows() === 3, await rows());
  await click('[data-act="st-f"][data-f="low"]');
  await click('[data-act="st-cat"][data-c="خامات"]');
  ok('category chip', await rows() === 2, await rows());
  await click('[data-act="st-cat"][data-c=""]');
  await page.fill('#st-q', 'محبس'); await page.waitForTimeout(150);
  ok('search by name', await rows() === 1);
  await page.fill('#st-q', 'I-1'); await page.waitForTimeout(150);
  ok('search by code', await rows() === 2);
  await page.fill('#st-q', 'zzzz'); await page.waitForTimeout(150);
  ok('search with no match says so', /مفيش أصناف مطابقة/.test(await text('#st-list')));
  await page.fill('#st-q', ''); await page.waitForTimeout(150);

  /* ---------- الصنف ---------- */
  await click('[data-act="st-item"][data-code="I-W05"]'); await page.waitForSelector('.sbig');
  await shot('02-item');
  ok('item: big balance and its moves', (await text('.sbig')).indexOf('85') === 0 && await page.locator('main .list .row').count() === 6, await text('.sbig'));
  ok('item: received, issued, count', /الوارد 4,800/.test(await text('.skv')) && /المنصرف 5,915/.test(await text('.skv')) && /\+1,200/.test(await text('.skv')), await text('.skv'));
  ok('item: pending issue shows with its status', /IS-0041/.test(await page.locator('main .list .row').first().textContent()) && /مسجَّل/.test(await page.locator('main .list .row').first().textContent()));

  /* ---------- صرف مواد ---------- */
  await click('[data-act="go"][data-to="new/issue/I-W05"]'); await page.waitForSelector('.form');
  ok('issue form opens on the item', /I-W05/.test(await text('#w-item')) && /الرصيد في المخزن: 85/.test(await text('#w-item')), await text('#w-item'));
  await click('[data-act="save"]');
  ok('empty issue: quantity and signature needed', await page.locator('#e-qty').count() === 1 && await page.locator('#e-sign').count() === 1 && await page.locator('#e-item').count() === 0);
  await page.fill('#f-qty', '100'); await page.waitForTimeout(100);
  ok('balance after the issue goes red', /-15/.test(await text('#f-left')), await text('#f-left'));
  await click('[data-act="save"]');
  ok('issue above the balance refused on the phone', /الكمية أكبر من الرصيد \(85/.test(await text('#e-qty')), await text('#e-qty'));
  await page.fill('#f-qty', '40'); await page.waitForTimeout(100);
  ok('balance after the issue updates live', (await text('#f-left')) === '45');
  await click('[data-act="seg"][data-f="exec"][data-v="sub"]'); await page.waitForSelector('#sheet .opt');
  await click('[data-act="sheet-pick"][data-v="S-005"]');
  await click('[data-act="pick"][data-f="boq"]'); await page.waitForSelector('#sheet .opt');
  ok('BOQ item is optional', /بدون بند/.test(await text('#sheet')));
  await click('[data-act="sheet-pick"][data-v="I-W01"]');
  await draw(); await page.waitForTimeout(300);
  await shot('03-issue');
  ok('no horizontal overflow on the issue form', !(await overflow()));
  await click('[data-act="save"]'); await page.waitForTimeout(300);
  ok('after saving goes to «سجلاتي» on the store tab', (await page.evaluate(() => location.hash)) === '#mine' && /on/.test(await page.locator('[data-act="mine-tab"][data-t="store"]').getAttribute('class')));
  await page.waitForTimeout(1500);
  ok('issue numbered IS-0042', /IS-0042/.test(await text('main')), await toast());
  await go('store/I-W05', '.sbig');
  ok('item balance after the issue', (await text('.sbig')).indexOf('45') === 0, await text('.sbig'));

  /* ---------- الجرد ---------- */
  await go('store', '#st-list'); await click('.stool [data-act="go"][data-to="new/count"]'); await page.waitForSelector('.form');
  await click('[data-act="pick"][data-f="item"]'); await page.waitForSelector('#sheet .opt');
  ok('count picker lists items without moves too', /مفيش حركة/.test(await text('#sheet')));
  await click('[data-act="sheet-pick"][data-v="I-W07"]');
  ok('book balance shown', /28/.test(await text('#f-book')), await text('#f-book'));
  await page.fill('#f-counted', '26'); await page.waitForTimeout(100);
  ok('count difference shown live', /عجز 2/.test(await text('#f-diff')), await text('#f-diff'));
  await shot('04-count');
  await click('[data-act="save"]'); await page.waitForTimeout(1700);
  ok('count numbered IC-0005', /IC-0005/.test(await text('main')), await text('main'));
  await go('new/count/I-102', '.form');
  ok('a pending count blocks the next one', /مستني اعتماد محاسب المشروع/.test(await text('.form')));
  await page.fill('#f-counted', '21'); await click('[data-act="save"]');
  ok('…and the save is refused', /مستني الاعتماد/.test(await text('#e-item')));
  await click('[data-act="cancel"]');
  await go('new/count/I-S16', '.form');
  await page.fill('#f-counted', '2'); await page.waitForTimeout(100);
  ok('matching count says so', /مطابق للرصيد الدفتري/.test(await text('#f-diff')));
  await click('[data-act="cancel"]');

  /* ---------- المهندس ---------- */
  await role('eng'); await go('inbox', '.tabs');
  await click('[data-act="inbox-tab"][data-t="issue"]');
  await shot('05-eng-inbox');
  ok('engineer inbox: the site issues', /IS-0041/.test(await text('main')) && /IS-0042/.test(await text('main')), await text('main'));
  ok('a clean issue can be approved from the list', await page.locator('[data-act="quick"][data-key="is-041"]').count() === 1);
  await click('[data-act="quick"][data-key="is-041"]'); await page.waitForSelector('.dlg'); await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('quick approve', /اتعتمد IS-0041/.test(await toast()), await toast());
  await page.locator('[data-act="doc"]', { hasText: 'IS-0042' }).first().click(); await page.waitForSelector('.kv2');
  await shot('06-issue-doc');
  const kv = await text('.kv2');
  ok('issue document: quantity, receiver, BOQ item', /40 م\.ط/.test(kv) && /حسن الشافعي/.test(kv) && /مواسير UPVC PN10 قطر 110/.test(kv), kv);
  ok('issue document: balance after and signature', /رصيد الصنف في المخزن بعد الصرف/.test(await text('main')) && /توقيع المستلم ✓/.test(await text('.who')));
  await click('.fbar [data-act="approve"]'); await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('engineer approves from the document', /اتعتمد IS-0042/.test(await toast()), await toast());
  await go('store/I-W19', '.sbig');
  await click('[data-act="go"][data-to="new/issue/I-W19"]'); await page.waitForSelector('.form');
  await page.fill('#f-qty', '5'); await draw(); await click('[data-act="save"]'); await page.waitForTimeout(1700);
  ok('engineer issues materials', /IS-0043/.test(await text('main')), await text('main'));
  await go('inbox', '.tabs'); await click('[data-act="inbox-tab"][data-t="issue"]');
  ok('…and it does not wait for him', !/IS-0043/.test(await text('main')));

  /* ---------- المالك ---------- */
  await role('owner'); await go('inbox', '.tabs'); await click('[data-act="inbox-tab"][data-t="issue"]');
  ok('owner approves the engineer issue', /IS-0043/.test(await text('main')) && !/IS-0042/.test(await text('main')), await text('main'));

  /* ---------- محاسب المشروع ---------- */
  await role('acc'); await go('inbox', '.tabs'); await click('[data-act="inbox-tab"][data-t="count"]');
  await shot('07-acc-counts');
  ok('counts wait for the project accountant', /IC-0004/.test(await text('main')) && /IC-0005/.test(await text('main')));
  ok('a count with a difference must be opened', await page.locator('[data-act="quick"][data-key="ic-004"]').count() === 0);
  await page.locator('[data-act="doc"]', { hasText: 'IC-0004' }).first().click(); await page.waitForSelector('.kv2');
  ok('count document: book, counted, difference', /25/.test(await text('.kv2')) && /22/.test(await text('.kv2')) && /−3/.test(await text('.kv2')) && /عجز 3/.test(await text('main')), await text('.kv2'));
  await click('.fbar [data-act="approve"]'); await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('count approved', /اتعتمد IC-0004/.test(await toast()), await toast());
  await go('inbox', '.tabs'); await click('[data-act="inbox-tab"][data-t="count"]');
  await page.locator('[data-act="doc"]', { hasText: 'IC-0005' }).first().click(); await page.waitForSelector('.fbar');
  await click('.fbar [data-act="reject"]'); await page.waitForSelector('#w-reason');
  await click('[data-act="rej-reason"][data-v="الكمية غير مطابقة"]');
  await page.fill('#rej-note', 'اتعدّوا قبل التركيب؛ اعدّ تاني'); await click('[data-act="rej-confirm"]'); await page.waitForSelector('.dlg'); await click('[data-act="dlg-ok"]'); await page.waitForTimeout(300);
  ok('count rejected with a reason', /اترفض IC-0005/.test(await toast()), await toast());

  /* ---------- الرفض وإعادة الإرسال ---------- */
  await role('site'); await go('mine', '.tabs'); await click('[data-act="mine-tab"][data-t="store"]');
  ok('rejected count first in «سجلاتي»', /IC-0005/.test(await text('main .list')) && /مرفوض — يحتاج تعديلك/.test(await text('main')));
  await page.locator('[data-act="doc"]', { hasText: 'IC-0005' }).first().click(); await page.waitForSelector('.fbar');
  await click('.fbar [data-act="go"]'); await page.waitForSelector('.form');
  ok('edit form keeps the item and the count', /I-W07/.test(await text('#w-item')) && (await page.inputValue('#f-counted')) === '26');
  await page.fill('#f-counted', '28'); await page.waitForTimeout(100);
  ok('recount matches the book', /مطابق/.test(await text('#f-diff')));
  await click('[data-act="save"]'); await page.waitForTimeout(1600);
  await go('store/I-W07', '.sbig');
  ok('item balance after the resubmitted count', (await text('.sbig')).indexOf('28') === 0, await text('.sbig'));

  /* ---------- مقفول ---------- */
  await page.evaluate(() => { window.BDW.S.data.store.on = false; location.hash = 'store'; }); await page.waitForTimeout(300);
  ok('store off: explains how to turn it on', /المخزن لسه ما اتفعّلش/.test(await text('main')));
  await go('new/issue', '.form');
  ok('issue form off too', /المخزن مش متفعّل/.test(await text('.form')));
  await page.evaluate(() => { window.BDW.S.data.store.on = true; });
  await click('[data-act="cancel"]');

  /* ---------- قبل يوم البداية: مفيش تسجيل لسه ---------- */
  await role('site');
  const kept = await page.evaluate(() => { const st = window.BDW.S.data.store; window.__keep = { start: st.start, moves: st.moves }; st.start = '2099-01-01'; st.moves = []; return Object.keys(window.BDW.storeTotals()).length; });
  ok('before the start: nothing in the store yet', kept === 0, kept);
  await page.evaluate(() => window.BDW.render());
  ok('before the start: the home card says when it starts', /هيبدأ 1 يناير 2099/.test(await text('.storecta')), await text('.storecta'));
  await go('store', 'main .empty');
  const pre = await text('main .empty');
  ok('before the start: the store says when, with no count button', /المخزن هيبدأ 1 يناير 2099/.test(pre) && (await page.locator('main [data-to="new/count"]').count()) === 0, pre);
  await shot('09-before-start');
  await page.evaluate(() => { const st = window.BDW.S.data.store; st.start = window.__keep.start; st.moves = window.__keep.moves; });

  /* ---------- كل الشاشات ---------- */
  await go('all', 'main');
  ok('screen map: 6.4 opens the store', await page.locator('[data-to="store"]').count() >= 1);

  /* ---------- العرض على الكمبيوتر ---------- */
  const dc = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'ar-EG' });
  await dc.addInitScript(() => { let c; Object.defineProperty(window, 'BDW_CONFIG', { configurable: true, get() { return c; }, set(v) { c = Object.assign({}, v, { API_URL: '', WRITE_URL: '' }); } }); });
  const dp = await dc.newPage(); dp.on('pageerror', e => errors.push('desk pageerror: ' + e.message));
  await dp.goto(BASE); await dp.waitForSelector('.greet');
  await dp.click('[data-act="menu"]'); await dp.click('[data-act="role"][data-r="acc"]'); await dp.waitForTimeout(300);
  await dp.evaluate(() => { location.hash = 'desk'; }); await dp.waitForSelector('#dk-tb'); await dp.waitForTimeout(400);
  const tb = await dp.locator('#dk-tb').textContent();
  ok('desk inbox lists the count with its difference', /IC-0004/.test(tb) && /جرد مخزن/.test(tb) && /عجز 3/.test(tb) && !/undefined/.test(tb), tb.slice(0, 300));
  await dp.screenshot({ path: path.join(SHOTS, 'store-08-desk.png') });
  await dc.close();

  ok('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  results.forEach(x => console.log(x[0], '-', x[1], x[0] === 'FAIL' && x[2] ? '— ' + x[2].slice(0, 300) : ''));
  console.log(results.filter(x => x[0] === 'FAIL').length + ' failed of ' + results.length);
})().catch(e => { console.error(e); process.exit(1); });
