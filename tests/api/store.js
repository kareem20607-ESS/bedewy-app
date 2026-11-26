// التشغيل: node tests/api/store.js
// اختبار مخزن الموقع (6.4) في سكريبت الربط على أوراق وهمية: الإعداد، والتفعيل بتاريخ البداية، والأصناف اللي خارج المخزن،
// وصرف مواد للتنفيذ بحد الرصيد، والجرد وفرقه، وقواعد الاعتماد والرفض وإعادة الإرسال، وسطور الإيميل والملخص اليومي.
const { makeEnv } = require('./mock');
const { build, today, D } = require('./fixture');
const SCRIPT = process.argv[2] || require('path').join(__dirname, '../../apps-script/Bedewy_API.gs');
const CLIENT = '760770227194-t2r0kna5g34igsarqfmf8psm8418ejlr.apps.googleusercontent.com';
const exp = Math.floor(Date.now() / 1000) + 3000;
const tok = (email) => ({ aud: CLIENT, iss: 'https://accounts.google.com', email, email_verified: 'true', exp, name: email.split('@')[0] });
const tokens = { T_SITE: tok('site@test.dev'), T_ENG: tok('eng@test.dev'), T_ACC: tok('acc@test.dev'), T_OWNER: tok('owner@test.dev'), T_ADMIN: tok('kareem@test.dev') };
const results = [];
const ok = (name, cond, extra) => { results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : (typeof extra === 'string' ? extra : JSON.stringify(extra))]); };

const ss = build();
const env = makeEnv(ss, { script: SCRIPT, tokens, owner: 'kareem@test.dev' });
env.ctx.setupApi();
const users = ss.getSheetByName('المستخدمين');
[['site@test.dev', 'سعيد الموقع', 'محاسب الموقع', 'P-001', 'نعم'], ['eng@test.dev', 'هاني المهندس', 'مهندس الموقع', 'الكل', 'نعم'], ['acc@test.dev', 'عادل المحاسب', 'محاسب المشروع', '', 'نعم'],
 ['owner@test.dev', 'الحاج', 'المالك', 'الكل', 'نعم']].forEach((u, i) => users.getRange(5 + i, 1, 1, 5).setValues([u]));
const call = (b) => env.call(b);
const settings = ss.getSheetByName('إعدادات التطبيق');
const setRow = (k) => { for (let r = 4; r <= settings.getLastRow(); r++) if (settings.get(r, 1) === k) return r; return 0; };
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
const issueOp = (key, extra) => ({ action: 'submit', key, at: Date.now() - 4000, doc: Object.assign({ type: 'issue', project: 'P-001', date: today(0), item: 'I-P04', qty: 30, exec: 'S-001', boq: 'I-B01', notes: 'الشارع 3', loc: { lat: 30.072, lng: 31.644, acc: 9 }, signData: IMG }, extra || {}) });
const countOp = (key, extra) => ({ action: 'submit', key, at: Date.now() - 2000, doc: Object.assign({ type: 'count', project: 'P-001', date: today(0), item: 'I-P04', counted: 50, notes: '' }, extra || {}) });
const boot = (t) => call({ action: 'bootstrap', idToken: t || 'T_ENG', project: 'P-001' });
const bal = (b, item) => (b.store.moves || []).filter(m => m[3] === item).reduce((s, m) => s + (m[0] === 'out' ? -m[4] : m[4]), 0);

/* ---- قبل الإعداد ---- */
let b = boot();
ok('store is off before setupStore', b.ok && b.store && b.store.on === false, b.store);
ok('items carry their category', b.items.find(i => i[0] === 'I-P04').join('|') === 'I-P04|مواسير صرف|م.ط|مواسير', b.items.find(i => i[0] === 'I-P04'));
let r = call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-0') });
ok('issue refused while the store is off', r.error === 'invalid' && /مش متفعّل/.test(r.message), r);

/* ---- الإعداد ---- */
const msg = env.ctx.setupStore();
const M = ss.getSheetByName('حركة المخزن');
ok('setupStore makes the store sheet with its headers', !!M && M.get(3, 1) === 'رقم الحركة' && M.get(3, 9) === 'العدد الفعلي' && M.get(3, 12) === 'الحالة', M && M.rows[2]);
ok('setupStore adds the three settings rows', setRow('بداية المخزن P-001') > 0 && setRow('أصناف خارج المخزن') > 0 && settings.get(setRow('تنبيه قرب نفاد المادة'), 2) === 0.1, msg);
const nSet = settings.getLastRow();
env.ctx.setupStore();
ok('setupStore twice adds nothing', settings.getLastRow() === nSet && ss.sheets.filter(s => s.name === 'حركة المخزن').length === 1);
b = boot();
ok('store stays off until its start date is written', b.store.on === false, b.store);

/* ---- التفعيل ---- */
settings.put(setRow('بداية المخزن P-001'), 2, D('2026-09-01'));
settings.put(setRow('أصناف خارج المخزن'), 2, 'خرسانة، I-S99');
b = boot();
ok('store on from its start date', b.store.on === true && b.store.start === '2026-09-01' && b.store.low === 0.1 && b.settings.storeLow === 0.1, b.store);
ok('a category in «خارج المخزن» takes all its items out', b.store.out.indexOf('I-C02') >= 0 && b.store.out.indexOf('I-P04') < 0, b.store.out);
ok('received = permits after the start, not cancelled, store items only', JSON.stringify(b.store.moves) === JSON.stringify([['in', 'SP-0002', today(1), 'I-P04', 100, 'مسجَّل', 'V-002', '']]), b.store.moves);

/* ---- صرف مواد للتنفيذ: التحقق ---- */
ok('an item consumed on delivery cannot be issued', call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-1', { item: 'I-C02' }) }).message.indexOf('مش من أصناف المخزن') >= 0);
ok('issue dated before the store start', call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-2', { date: '2026-08-31' }) }).message.indexOf('قبل بداية المخزن') >= 0);
r = call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-3', { qty: 150 }) });
ok('issue above the balance is refused with the balance', r.error === 'invalid' && r.message.indexOf('رصيد المخزن (100 م.ط)') >= 0, r);
ok('issue to an unknown subcontractor', call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-4', { exec: 'S-999' }) }).error === 'invalid');
ok('issue against an unknown BOQ item', call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-5', { boq: 'I-ZZZ' }) }).message.indexOf('بند المقايسة') >= 0);
ok('zero quantity', call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-6', { qty: 0 }) }).error === 'invalid');
ok('project accountant cannot issue', call({ action: 'submit', idToken: 'T_ACC', op: issueOp('k-is-7') }).error === 'forbidden');
ok('owner cannot issue', call({ action: 'submit', idToken: 'T_OWNER', op: issueOp('k-is-8') }).error === 'forbidden');
ok('nothing written by refused issues', M.getLastRow() === 3);

/* ---- صرف صحيح ---- */
r = call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-9') });
ok('site issues materials without a photo', r.ok && r.id === 'IS-0001', r);
ok('issue row written', M.get(4, 1) === 'IS-0001' && M.get(4, 3) === 'P-001' && M.get(4, 4) === 'صرف للتنفيذ' && M.get(4, 5) === 'I-P04' && M.get(4, 6) === 'مواسير صرف' &&
  M.get(4, 7) === 'م.ط' && M.get(4, 8) === 30 && M.get(4, 9) === '' && M.get(4, 10) === 'S-001' && M.get(4, 11) === 'I-B01' && M.get(4, 12) === 'مسجَّل' && M.get(4, 13) === '' &&
  M.get(4, 14) === 'سعيد الموقع' && M.get(4, 15) === 'الشارع 3', M.rows[3]);
ok('issue date written as a date in the sheet zone', M.get(4, 2) instanceof Date && env.ctx.Utilities.formatDate(M.get(4, 2), 'Africa/Cairo', 'yyyy-MM-dd') === today(0));
ok('receiver signature saved and named with the id', Object.values(env.files).some(f => /^IS-0001 — .*توقيع/.test(f.name)), Object.values(env.files).map(f => f.name));
r = call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-9') });
ok('same issue twice returns the same id', r.ok && r.duplicate && r.id === 'IS-0001' && M.getLastRow() === 4, r);
b = boot();
const is1 = b.docs.find(d => d.id === 'IS-0001');
ok('issue listed as a document', is1 && is1.type === 'issue' && is1.status === 'مسجَّل' && is1.item === 'I-P04' && is1.qty === 30 && is1.exec === 'S-001' && is1.boq === 'I-B01' &&
  /^drive:FILE/.test(is1.sign) && is1.byRole === 'site' && is1.key === 'k-is-9' && is1.loc && is1.loc.lat === 30.072, is1);
ok('issue is a store move', b.store.moves.some(m => m.join('|') === ['out', 'IS-0001', today(0), 'I-P04', 30, 'مسجَّل', 'S-001', 'I-B01'].join('|')), b.store.moves);
ok('balance after the issue', bal(b, 'I-P04') === 70, bal(b, 'I-P04'));
ok('second issue above what is left', call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-10', { qty: 80 }) }).message.indexOf('(70 م.ط)') >= 0);

/* ---- اعتماد الصرف ---- */
ok('site cannot approve an issue', call({ action: 'approve', idToken: 'T_SITE', type: 'issue', id: 'IS-0001' }).error === 'forbidden');
ok('project accountant cannot approve an issue', call({ action: 'approve', idToken: 'T_ACC', type: 'issue', id: 'IS-0001' }).error === 'forbidden');
ok('owner does not approve the site issue', call({ action: 'approve', idToken: 'T_OWNER', type: 'issue', id: 'IS-0001' }).error === 'forbidden');
r = call({ action: 'approve', idToken: 'T_ENG', type: 'issue', id: 'IS-0001' });
ok('engineer approves the issue', r.ok && M.get(4, 12) === 'معتمد', [r, M.get(4, 12)]);
r = call({ action: 'submit', idToken: 'T_ENG', op: issueOp('k-is-11', { qty: 10, exec: 'ذاتي', boq: '' }) });
ok('engineer issues for own crew', r.ok && r.id === 'IS-0002' && M.get(5, 10) === 'ذاتي' && M.get(5, 11) === '', [r, M.rows[4]]);
ok('engineer cannot approve own issue', call({ action: 'approve', idToken: 'T_ENG', type: 'issue', id: 'IS-0002' }).error === 'forbidden');
b = boot('T_OWNER');
ok('owner sees the engineer issue waiting', env.ctx.bdwAwaits_(b.docs.find(d => d.id === 'IS-0002'), 'owner', env.ctx.bdwSettings_()));
ok('owner approves the engineer issue', call({ action: 'approve', idToken: 'T_OWNER', type: 'issue', id: 'IS-0002' }).ok && M.get(5, 12) === 'معتمد');

/* ---- الرفض وإعادة الإرسال ---- */
r = call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-12', { qty: 5 }) });
ok('third issue', r.ok && r.id === 'IS-0003', r);
r = call({ action: 'reject', idToken: 'T_ENG', type: 'issue', id: 'IS-0003', reason: 'الكمية غير مطابقة', note: 'المستلم 6 مش 5' });
ok('engineer rejects with a reason', r.ok && M.get(6, 12) === 'ملغى' && /^⟲ مرفوض: الكمية غير مطابقة — المستلم 6 مش 5 — هاني المهندس/.test(M.get(6, 15)), [r, M.rows[5]]);
b = boot('T_SITE');
const is3 = b.docs.find(d => d.id === 'IS-0003');
ok('rejected issue shows for its owner with the reason', is3 && is3.status === 'مرفوض' && is3.reason === 'الكمية غير مطابقة' && is3.mine === true && is3.notes === 'الشارع 3', is3);
ok('rejected issue leaves the balance', bal(b, 'I-P04') === 60 && !b.store.moves.some(m => m[1] === 'IS-0003'), bal(b, 'I-P04'));
const fix = issueOp('k-is-13', { qty: 70 }); fix.action = 'resubmit'; fix.target = 'k-is-12'; delete fix.doc.signData;
ok('resubmit above the balance refused', call({ action: 'resubmit', idToken: 'T_SITE', op: fix }).message.indexOf('(60 م.ط)') >= 0);
fix.doc.qty = 6; fix.key = 'k-is-14';
r = call({ action: 'resubmit', idToken: 'T_SITE', op: fix });
ok('resubmit fixed issue', r.ok && r.id === 'IS-0003' && M.get(6, 12) === 'مسجَّل' && M.get(6, 8) === 6 && M.get(6, 15) === 'الشارع 3', [r, M.rows[5]]);
b = boot();
ok('balance after the resubmit', bal(b, 'I-P04') === 54, bal(b, 'I-P04'));

/* ---- الجرد ---- */
r = call({ action: 'submit', idToken: 'T_SITE', op: countOp('k-ic-1') });
ok('count records the difference from the book balance', r.ok && r.id === 'IC-0001' && r.adj === -4, r);
ok('count row: kind, difference and counted quantity', M.get(7, 1) === 'IC-0001' && M.get(7, 4) === 'جرد' && M.get(7, 8) === -4 && M.get(7, 9) === 50 && M.get(7, 10) === '' && M.get(7, 12) === 'مسجَّل', M.rows[6]);
r = call({ action: 'submit', idToken: 'T_ENG', op: countOp('k-ic-2', { counted: 49 }) });
ok('a second count waits for the first to be decided', r.error === 'conflict', r);
ok('count of an item outside the store', call({ action: 'submit', idToken: 'T_SITE', op: countOp('k-ic-3', { item: 'I-C02' }) }).error === 'invalid');
ok('count without a number', call({ action: 'submit', idToken: 'T_SITE', op: countOp('k-ic-4', { item: 'I-S02', counted: '' }) }).error === 'invalid');
ok('project accountant cannot count', call({ action: 'submit', idToken: 'T_ACC', op: countOp('k-ic-5', { item: 'I-S02' }) }).error === 'forbidden');
r = call({ action: 'submit', idToken: 'T_ENG', op: countOp('k-ic-6', { item: 'I-S02', counted: 12 }) });
ok('opening count of an item with no moves', r.ok && r.id === 'IC-0002' && r.adj === 12, r);
b = boot('T_ACC');
const ic1 = b.docs.find(d => d.id === 'IC-0001');
ok('count listed as a document', ic1 && ic1.type === 'count' && ic1.qty === -4 && ic1.counted === 50 && ic1.item === 'I-P04' && ic1.status === 'مسجَّل', ic1);
ok('count waits for the project accountant', env.ctx.bdwAwaits_(ic1, 'acc', env.ctx.bdwSettings_()) && !env.ctx.bdwAwaits_(ic1, 'eng', env.ctx.bdwSettings_()) && !env.ctx.bdwAwaits_(ic1, 'owner', env.ctx.bdwSettings_()));
ok('engineer cannot approve a count', call({ action: 'approve', idToken: 'T_ENG', type: 'count', id: 'IC-0001' }).error === 'forbidden');
ok('owner cannot approve a count', call({ action: 'approve', idToken: 'T_OWNER', type: 'count', id: 'IC-0001' }).error === 'forbidden');
ok('project accountant approves the count', call({ action: 'approve', idToken: 'T_ACC', type: 'count', id: 'IC-0001' }).ok && M.get(7, 12) === 'معتمد');
ok('system admin approves a count', call({ action: 'approve', idToken: 'T_ADMIN', type: 'count', id: 'IC-0002' }).ok && M.get(8, 12) === 'معتمد');
r = call({ action: 'submit', idToken: 'T_ENG', op: countOp('k-ic-7', { counted: 50 }) });
ok('a count that matches the book has zero difference', r.ok && r.id === 'IC-0003' && r.adj === 0, r);
r = call({ action: 'reject', idToken: 'T_ACC', type: 'count', id: 'IC-0003', reason: 'أخرى', note: 'اتعد قبل التفريغ' });
ok('count rejected', r.ok && M.get(9, 12) === 'ملغى', r);
const fixC = countOp('k-ic-8', { counted: 47 }); fixC.action = 'resubmit'; fixC.target = 'k-ic-7';
r = call({ action: 'resubmit', idToken: 'T_ENG', op: fixC });
ok('resubmitted count is recalculated on the current balance', r.ok && r.id === 'IC-0003' && r.adj === -3 && M.get(9, 8) === -3 && M.get(9, 9) === 47 && M.get(9, 12) === 'مسجَّل', [r, M.rows[8]]);
b = boot();
ok('balances follow the counts', bal(b, 'I-P04') === 47 && bal(b, 'I-S02') === 12, [bal(b, 'I-P04'), bal(b, 'I-S02')]);
ok('issue the whole balance', call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-15', { item: 'I-S02', qty: 12, boq: 'I-S02' }) }).ok);
ok('nothing left to issue', call({ action: 'submit', idToken: 'T_SITE', op: issueOp('k-is-16', { item: 'I-S02', qty: 1, boq: '' }) }).message.indexOf('(0 م.ط)') >= 0);

/* ---- الإيميلات والملخص اليومي ---- */
b = boot('T_ADMIN'); b.code = 'P-001';
const lineIs = env.ctx.bdwDocLine_(b.docs.find(d => d.id === 'IS-0001'), b), lineIc = env.ctx.bdwDocLine_(b.docs.find(d => d.id === 'IC-0003'), b);
ok('email line for an issue', lineIs === 'مواسير صرف — 30 م.ط — إلى مقاول أول', lineIs);
ok('email line for a count', lineIc === 'مواسير صرف — العدد الفعلي 47 م.ط — عجز 3 م.ط', lineIc);
const day = env.ctx.bdwDay_(b, { email: 'owner@test.dev', role: 'owner' }, env.ctx.bdwSettings_(), today(0));
ok('daily summary counts today issues', day && /صرف المخزن/.test(day.html) && /أذونات صرف|إذن صرف/.test(day.html), day && day.html.slice(0, 300));
ok('type names for the email subject', env.ctx.BDW.TYPE_NAME.issue === 'إذن صرف مخزن' && env.ctx.BDW.TYPE_NAME.count === 'جرد مخزن');

/* ---- تاريخ البداية بيستبعد اللي قبله ---- */
settings.put(setRow('بداية المخزن P-001'), 2, today(0));
b = boot();
ok('permits before the start date are out of the store', !b.store.moves.some(m => m[0] === 'in') && b.store.start === today(0), b.store.moves.filter(m => m[0] === 'in'));
settings.put(setRow('بداية المخزن P-001'), 2, '');
ok('clearing the start date turns the store off', boot().store.on === false);

ok('no write ever landed on a formula column', ss.sheets.every(sh => sh.writes.every(w => !(sh.formulas[w[1]] && w[0] >= 4))));

results.forEach(x => console.log(x[0], '-', x[1], x[0] === 'FAIL' && x[2] ? '— ' + x[2].slice(0, 400) : ''));
console.log(results.filter(x => x[0] === 'FAIL').length + ' failed of ' + results.length);
