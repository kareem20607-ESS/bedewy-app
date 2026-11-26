// التشغيل: node tests/api/test.js
// اختبار سكريبت الربط على أوراق وهمية: الدخول، التحميل، التسجيل، التكرار، الاعتماد والرفض وإعادة الإرسال، المستخلص، العهدة، الصور.
const path = require('path');
const { makeEnv } = require('./mock');
const { build, today } = require('./fixture');
const SCRIPT = process.argv[2] || require('path').join(__dirname, '../../apps-script/Bedewy_API.gs');
const CLIENT = '760770227194-t2r0kna5g34igsarqfmf8psm8418ejlr.apps.googleusercontent.com';
const exp = Math.floor(Date.now() / 1000) + 3000;
const tok = (email, extra) => Object.assign({ aud: CLIENT, iss: 'https://accounts.google.com', email, email_verified: 'true', exp, name: email.split('@')[0] }, extra || {});
const tokens = {
  T_SITE: tok('site@test.dev'), T_ENG: tok('eng@test.dev'), T_ACC: tok('acc@test.dev'), T_OWNER: tok('owner@test.dev'), T_ADMIN: tok('kareem@test.dev'),
  T_OFF: tok('off@test.dev'), T_STRANGER: tok('stranger@test.dev'), T_AUD: tok('site@test.dev', { aud: 'other-client' }), T_EXP: tok('site@test.dev', { exp: Math.floor(Date.now() / 1000) - 10 })
};
const results = [];
const ok = (name, cond, extra) => { results.push([cond ? 'PASS' : 'FAIL', name, extra === undefined ? '' : (typeof extra === 'string' ? extra : JSON.stringify(extra))]); };

const ss = build();
const env = makeEnv(ss, { script: SCRIPT, tokens, owner: 'kareem@test.dev' });
env.ctx.setupApi();
ok('setup creates the five app sheets', ['المستخدمين', 'إعدادات التطبيق', 'العهد', 'مصروفات العهدة', 'سجل التطبيق'].every(n => ss.getSheetByName(n)));
const users = ss.getSheetByName('المستخدمين');
ok('setup adds the owner as admin', users.get(4, 1) === 'kareem@test.dev' && users.get(4, 3) === 'مدير المنظومة');
[['site@test.dev', 'سعيد الموقع', 'محاسب الموقع', 'P-001', 'نعم'], ['eng@test.dev', 'هاني المهندس', 'مهندس الموقع', 'الكل', 'نعم'], ['acc@test.dev', 'عادل المحاسب', 'محاسب المشروع', '', 'نعم'],
 ['owner@test.dev', 'الحاج', 'المالك', 'الكل', 'نعم'], ['off@test.dev', 'موقوف', 'محاسب الموقع', 'الكل', 'لا']].forEach((u, i) => users.getRange(5 + i, 1, 1, 5).setValues([u]));
const settings = ss.getSheetByName('إعدادات التطبيق');
let siteRow = 0; for (let r = 4; r <= settings.getLastRow(); r++) if (settings.get(r, 1) === 'موقع المشروع P-001') siteRow = r;
ok('settings has a site row per project', siteRow > 0);
settings.put(siteRow, 2, '30.0719, 31.6437');
ss.getSheetByName('العهد').getRange(4, 1, 1, 8).setValues([['CU-001', 'P-001', 'site@test.dev', 20000, ss.getSheetByName('المشروعات').get(4, 6) || new Date(), 'الخزينة', 'مفتوحة', '']]);

/* ---- الدخول ---- */
const call = (b) => env.call(b);
ok('no token', call({ action: 'bootstrap' }).error === 'no_token');
ok('token for another app', call({ action: 'bootstrap', idToken: 'T_AUD' }).error === 'bad_token');
ok('expired token', call({ action: 'bootstrap', idToken: 'T_EXP' }).error === 'bad_token');
ok('unknown email', call({ action: 'bootstrap', idToken: 'T_STRANGER' }).error === 'not_allowed');
ok('inactive user', call({ action: 'bootstrap', idToken: 'T_OFF' }).error === 'not_allowed');
ok('garbage token', call({ action: 'bootstrap', idToken: 'nope' }).error === 'bad_token');

/* ---- التحميل ---- */
let b = call({ action: 'bootstrap', idToken: 'T_SITE', project: 'P-001' });
ok('bootstrap ok', b.ok, b.message);
ok('user role from sheet', b.user && b.user.role === 'site' && b.user.name === 'سعيد الموقع');
ok('project site coords', b.projects[0].lat === 30.0719 && b.projects[0].lng === 31.6437, b.projects[0]);
ok('project short name and discount', b.projects[0].short === 'مشروع تجريبي — مدينة تجريبية' && b.projects[0].discount === 0.25, b.projects[0]);
ok('settings from sheet', b.settings.voucherLimit === 50000 && b.settings.priceWarnPct === 0.05 && b.settings.siteRadiusKm === 2, b.settings);
ok('boq with done qty', JSON.stringify(b.boq.find(x => x[0] === 'I-R06')) === JSON.stringify(['I-R06', 'طبقة إحلال', 'م3', 9000, 270, 11200]), b.boq);
ok('sub items not in boq', b.subItems.length === 1 && b.subItems[0][0] === 'I-B01', b.subItems);
ok('rates', b.rates['S-005|I-R06'] === 55 && b.rates['S-001|I-B01'] === 65, b.rates);
ok('last approved price', b.lastPrice['V-001|I-C02'] === 1950 && b.lastPrice['V-002|I-P04'] === undefined, b.lastPrice);
ok('supplies', JSON.stringify(b.supplies) === JSON.stringify({ 'V-001': ['I-C02'] }), b.supplies);
ok('custody for holder', b.custody && b.custody.no === 'CU-001' && b.custody.amount === 20000, b.custody);
ok('balances from journal + opening', b.balances['S-001'] === 385000 - 480000 && b.balances['V-001'] === 19500 && b.balances['S-005'] === 5000, b.balances);
ok('kpis', b.kpis.contract === 150000000 && b.kpis.contractNet === 112500000 && b.kpis.executed === 2268000 && b.kpis.clientStmts === 2000000 && b.kpis.cost === 404500 && b.kpis.received === 1000000, b.kpis);
const sp2 = b.docs.find(d => d.id === 'SP-0002');
ok('pending form permit is listed', sp2 && sp2.status === 'مسجَّل' && sp2.price === null && sp2.paperNo === '55' && sp2.photo === 'drive:FORMPHOTO0000000000000001' && sp2.key === 'id:SP-0002', sp2);
ok('old approved permit not listed', !b.docs.some(d => d.id === 'SP-0001'));
ok('vouchers and statement listed', b.docs.some(d => d.id === 'PV-0001' && d.type === 'voucher' && d.amount === 75000) && b.docs.some(d => d.id === 'SS-001' && d.status === 'تحت المراجعة' && d.net === 385000));
ok('receipts not listed as vouchers', !b.docs.some(d => d.id === 'RV-0001'));

/* ---- تسجيل إذن ---- */
const IMG = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
const permitOp = (key, extra) => ({ action: 'submit', key, at: Date.now() - 5000, doc: Object.assign({ type: 'permit', project: 'P-001', date: today(0), party: 'V-001', item: 'I-C02', qty: 12, price: 2000, paperNo: '77', notes: 'تفريغ مسائي', loc: { lat: 30.072, lng: 31.644, acc: 12 }, photoData: IMG, signData: IMG }, extra || {}) });
let r = call({ action: 'submit', idToken: 'T_SITE', op: permitOp('k-permit-1') });
ok('submit permit', r.ok && r.id === 'SP-0003', r);
const P = ss.getSheetByName('إذونات التوريد');
ok('permit row written', P.get(6, 1) === 'SP-0003' && P.get(6, 13) === 'مسجَّل' && P.get(6, 15) === 'سعيد الموقع' && P.get(6, 16) === 'إذن ورقي رقم 77 — تفريغ مسائي' && /drive\.google\.com\/file\/d\//.test(P.get(6, 14)), P.rows[5]);
ok('permit date written in sheet time zone', P.get(6, 2) instanceof Date && env.ctx.Utilities.formatDate(P.get(6, 2), 'Africa/Cairo', 'yyyy-MM-dd') === today(0));
ok('photo and signature files named with the id', Object.values(env.files).filter(f => /^SP-0003 — /.test(f.name)).length === 2, Object.values(env.files).map(f => f.name));
r = call({ action: 'submit', idToken: 'T_SITE', op: permitOp('k-permit-1') });
ok('duplicate submit returns same id', r.ok && r.duplicate && r.id === 'SP-0003', r);
ok('duplicate wrote nothing', P.getLastRow() === 6);
ok('unknown supplier rejected', call({ action: 'submit', idToken: 'T_SITE', op: permitOp('k-bad-1', { party: 'V-999' }) }).error === 'invalid');
ok('future date rejected', call({ action: 'submit', idToken: 'T_SITE', op: permitOp('k-bad-2', { date: '2099-01-01' }) }).error === 'invalid');
ok('missing photo rejected', call({ action: 'submit', idToken: 'T_SITE', op: permitOp('k-bad-3', { photoData: null }) }).error === 'invalid');
ok('owner cannot register permits', call({ action: 'submit', idToken: 'T_OWNER', op: permitOp('k-bad-4') }).error === 'forbidden');

/* ---- اعتماد ---- */
ok('site cannot approve', call({ action: 'approve', idToken: 'T_SITE', type: 'permit', id: 'SP-0003' }).error === 'forbidden');
r = call({ action: 'approve', idToken: 'T_ACC', type: 'permit', id: 'SP-0003' });
ok('acc approves permit', r.ok && P.get(6, 13) === 'معتمد', r);
ok('approve again is harmless', call({ action: 'approve', idToken: 'T_ACC', type: 'permit', id: 'SP-0003' }).already === true);
ok('permit without price cannot be approved', call({ action: 'approve', idToken: 'T_ACC', type: 'permit', id: 'SP-0002' }).error === 'invalid');

/* ---- رفض وإعادة إرسال ---- */
r = call({ action: 'submit', idToken: 'T_SITE', op: permitOp('k-permit-2', { price: 2300 }) });
ok('second permit', r.ok && r.id === 'SP-0004', r);
ok('reject needs a reason', call({ action: 'reject', idToken: 'T_ACC', type: 'permit', id: 'SP-0004', reason: '' }).error === 'invalid');
ok('«أخرى» needs a note', call({ action: 'reject', idToken: 'T_ACC', type: 'permit', id: 'SP-0004', reason: 'أخرى', note: '' }).error === 'invalid');
r = call({ action: 'reject', idToken: 'T_ACC', type: 'permit', id: 'SP-0004', reason: 'السعر غير مطابق', note: 'آخر سعر 1,950' });
ok('acc rejects permit', r.ok, r);
ok('rejected permit is «ملغى» in sheet with a note line', P.get(7, 13) === 'ملغى' && /^⟲ مرفوض: السعر غير مطابق — آخر سعر 1,950 — عادل المحاسب\nإذن ورقي رقم 77/.test(P.get(7, 16)), P.get(7, 16));
b = call({ action: 'bootstrap', idToken: 'T_SITE' });
let d4 = b.docs.find(d => d.id === 'SP-0004');
ok('app shows it as rejected with reason', d4 && d4.status === 'مرفوض' && d4.reason === 'السعر غير مطابق' && d4.note === 'آخر سعر 1,950' && d4.mine === true && d4.key === 'k-permit-2' && d4.notes === 'تفريغ مسائي' && d4.paperNo === '77', d4);
ok('rejected doc keeps its location and signature', d4 && d4.loc && d4.loc.lat === 30.072 && /^drive:/.test(d4.sign), d4 && { loc: d4.loc, sign: d4.sign });
ok('someone else cannot resubmit', call({ action: 'resubmit', idToken: 'T_ENG', op: { key: 'k-resub-x', target: 'k-permit-2', at: Date.now(), doc: permitOp('z').doc } }).error === 'forbidden');
const fix = permitOp('k-resub-1', { price: 1950 }); fix.action = 'resubmit'; fix.target = 'k-permit-2'; delete fix.doc.photoData;
r = call({ action: 'resubmit', idToken: 'T_SITE', op: fix });
ok('owner of the doc resubmits', r.ok && r.id === 'SP-0004', r);
ok('resubmitted row back to «مسجَّل», price fixed, note line gone', P.get(7, 13) === 'مسجَّل' && P.get(7, 11) === 1950 && P.get(7, 16) === 'إذن ورقي رقم 77 — تفريغ مسائي', P.rows[6]);
b = call({ action: 'bootstrap', idToken: 'T_SITE' });
d4 = b.docs.find(d => d.id === 'SP-0004');
ok('timeline: registered, numbered, rejected, resubmitted', d4 && d4.status === 'مسجَّل' && d4.log.map(l => l[1].split(':')[0].split(' ')[0]).join('|') === 'سُجّل|وصل|رُفض|عُدّل' && !d4.reason, d4 && d4.log);
ok('resubmit of a doc that is not rejected', call({ action: 'resubmit', idToken: 'T_SITE', op: Object.assign({}, fix, { key: 'k-resub-2' }) }).error === 'conflict');

/* ---- محضر كميات ---- */
const qtyOp = (key, extra) => ({ action: 'submit', key, at: Date.now() - 3000, doc: Object.assign({ type: 'qty', project: 'P-001', date: today(0), boq: 'I-R06', qty: 300, kind: 'حالية', exec: 'S-005', notes: 'الشارع 4', loc: null, photoData: IMG }, extra || {}) });
r = call({ action: 'submit', idToken: 'T_ENG', op: qtyOp('k-qty-1') });
ok('eng submits qty', r.ok && r.id === 'Q-0002', r);
const Q = ss.getSheetByName('الكميات المنفذة');
ok('qty row written', Q.get(5, 5) === 'I-R06' && Q.get(5, 8) === 300 && Q.get(5, 11) === 'S-005' && Q.get(5, 17) === 'مسجَّل' && Q.get(5, 19) === 'حالية — الشارع 4 — بواسطة هاني المهندس', Q.rows[4]);
ok('eng cannot approve own qty', call({ action: 'approve', idToken: 'T_ENG', type: 'qty', id: 'Q-0002' }).error === 'forbidden');
ok('acc cannot approve qty', call({ action: 'approve', idToken: 'T_ACC', type: 'qty', id: 'Q-0002' }).error === 'forbidden');
ok('owner approves qty made by eng', call({ action: 'approve', idToken: 'T_OWNER', type: 'qty', id: 'Q-0002' }).ok && Q.get(5, 17) === 'معتمد');
r = call({ action: 'submit', idToken: 'T_SITE', op: qtyOp('k-qty-2', { kind: 'تراكمي', cumulative: 11500, exec: 'ذاتي', boq: 'I-B01' }) });
ok('site submits cumulative qty on a sub item', r.ok && r.id === 'Q-0003' && Q.get(6, 11) === '' && /^تراكمي \(من 11500\)/.test(Q.get(6, 19)), [r, Q.rows[5]]);
ok('owner cannot approve qty made by site', call({ action: 'approve', idToken: 'T_OWNER', type: 'qty', id: 'Q-0003' }).error === 'forbidden');
ok('eng approves qty made by site', call({ action: 'approve', idToken: 'T_ENG', type: 'qty', id: 'Q-0003' }).ok);
ok('qty on unknown item rejected', call({ action: 'submit', idToken: 'T_SITE', op: qtyOp('k-qty-bad', { boq: 'I-ZZZ' }) }).error === 'invalid');

/* ---- مصروف عهدة ---- */
const expOp = (key, amount) => ({ action: 'submit', key, at: Date.now(), doc: { type: 'exp', project: 'P-001', date: today(0), cat: 'وقود', desc: 'سولار لودر', amount, notes: '', photoData: IMG } });
r = call({ action: 'submit', idToken: 'T_SITE', op: expOp('k-exp-1', 600) });
ok('site submits expense in custody', r.ok && r.id === 'EX-0001', r);
const E = ss.getSheetByName('مصروفات العهدة');
ok('expense row tied to custody', E.get(4, 4) === 'CU-001' && E.get(4, 7) === 600 && E.get(4, 8) === 'مسجَّل', E.rows[3]);
ok('expense over what is left rejected', call({ action: 'submit', idToken: 'T_SITE', op: expOp('k-exp-2', 19500) }).error === 'invalid');
ok('eng cannot register expenses', call({ action: 'submit', idToken: 'T_ENG', op: expOp('k-exp-3', 10) }).error === 'forbidden');
ok('acc approves expense', call({ action: 'approve', idToken: 'T_ACC', type: 'exp', id: 'EX-0001' }).ok && E.get(4, 8) === 'معتمد');
b = call({ action: 'bootstrap', idToken: 'T_SITE' });
ok('expense listed with custody no', b.docs.some(d => d.id === 'EX-0001' && d.custody === 'CU-001' && d.amount === 600 && d.status === 'معتمد'));

/* ---- السندات ---- */
ok('acc cannot approve voucher over limit', call({ action: 'approve', idToken: 'T_ACC', type: 'voucher', id: 'PV-0001' }).error === 'forbidden');
ok('owner approves voucher over limit', call({ action: 'approve', idToken: 'T_OWNER', type: 'voucher', id: 'PV-0001' }).ok);
ok('owner cannot approve voucher under limit', call({ action: 'approve', idToken: 'T_OWNER', type: 'voucher', id: 'PV-0002' }).error === 'forbidden');
r = call({ action: 'reject', idToken: 'T_ACC', type: 'voucher', id: 'PV-0002', reason: 'مستند مكرر', note: '' });
ok('acc rejects voucher → «ملغى» in sheet', r.ok && ss.getSheetByName('السندات').get(5, 15) === 'ملغى', r);

/* ---- المستخلص: فني ثم نهائي ---- */
ok('owner cannot approve before technical', call({ action: 'approve', idToken: 'T_OWNER', type: 'stmt', id: 'SS-001' }).error === 'forbidden');
ok('eng technical approval', call({ action: 'approveTech', idToken: 'T_ENG', type: 'stmt', id: 'SS-001' }).ok);
ok('eng cannot reject after technical', call({ action: 'reject', idToken: 'T_ENG', type: 'stmt', id: 'SS-001', reason: 'أخرى', note: 'x' }).error === 'forbidden');
b = call({ action: 'bootstrap', idToken: 'T_OWNER' });
const ss1 = b.docs.find(d => d.id === 'SS-001');
ok('statement shows technical approval', ss1 && ss1.techOk === true && ss1.techBy === 'هاني المهندس', ss1);
r = call({ action: 'approve', idToken: 'T_OWNER', type: 'stmt', id: 'SS-001' });
const S = ss.getSheetByName('المستخلصات');
ok('owner final approval sets status and date', r.ok && S.get(4, 16) === 'معتمد' && S.get(4, 17) instanceof Date, [r, S.rows[3]]);

/* ---- الصور وطلب التجديد ---- */
const fileId = Object.keys(env.files).find(k => /^SP-0003 — .* — صورة/.test(env.files[k].name));
r = call({ action: 'photo', idToken: 'T_ACC', id: 'drive:' + fileId });
ok('photo of a document is served', r.ok && /^data:image\/jpeg;base64,/.test(r.data), r.error);
ok('random drive file refused', call({ action: 'photo', idToken: 'T_ACC', id: 'drive:SOMEOTHERFILE00000000000001' }).error === 'forbidden');
r = call({ action: 'custodyRenew', idToken: 'T_SITE', project: 'P-001' });
ok('custody renew mails the project accountant', r.ok && env.mails.length === 1 && env.mails[0].to === 'acc@test.dev' && /متبقي|المتبقي/.test(env.mails[0].body), [r, env.mails]);
ok('only the holder can ask for renewal', call({ action: 'custodyRenew', idToken: 'T_ACC', project: 'P-001' }).error === 'forbidden');

/* ---- عام ---- */
ok('unknown action', call({ action: 'dropTables', idToken: 'T_ADMIN' }).error === 'invalid');
ok('doGet answers', JSON.parse(env.ctx.doGet().getContent()).ok === true);
const L = ss.getSheetByName('سجل التطبيق');
ok('log has one line per accepted action', L.getLastRow() - 3 === 16, L.getLastRow() - 3);

results.forEach(x => console.log(x[0], '-', x[1], x[0] === 'FAIL' && x[2] ? '— ' + x[2].slice(0, 400) : ''));
console.log(results.filter(x => x[0] === 'FAIL').length + ' failed of ' + results.length);
