/**
 * منظومة البديوي — سكريبت ربط التطبيق (Bedewy_API.gs)
 *
 * بيستقبل طلبات تطبيق الموبايل ويقرا ويكتب في أوراق ملف البيانات.
 * كل طلب لازم يكون معاه رمز دخول جوجل صادر لمعرّف التطبيق، والإيميل لازم يكون في ورقة «المستخدمين» ونشط.
 *
 * التركيب (مرة واحدة):
 *  1. ملف البيانات ← الإضافات ← Apps Script ← (+) ← نص برمجي ← اسمه Bedewy_API ← الصق الملف ده كله ← احفظ.
 *  2. اختار الدالة setupApi من فوق ← تشغيل ← وافق على الصلاحيات.
 *     بتعمل الأوراق الناقصة: المستخدمين، إعدادات التطبيق، العهد، مصروفات العهدة، سجل التطبيق، وفولدر صور التطبيق.
 *  3. املأ ورقة «المستخدمين»، وفي «إعدادات التطبيق» اكتب موقع كل مشروع (خط العرض، خط الطول).
 *  4. نشر ← نشر جديد ← تطبيق ويب ← التنفيذ باسم: أنا ← مين يقدر يوصل: أي حد ← نشر ← انسخ الرابط.
 *     «أي حد» معناها إن الطلب يوصل للسكريبت؛ السكريبت نفسه بيرفض أي إيميل مش في «المستخدمين».
 *
 * الملف ده مستقل: كل دواله وأسماؤه بتبدأ بـ bdw عشان ما تتعارضش مع Code.gs وForms_Sync.gs.
 */

var BDW = {
  VERSION: '2026-11-26.4',
  CLIENT_ID: '760770227194-t2r0kna5g34igsarqfmf8psm8418ejlr.apps.googleusercontent.com',
  APP_URL: 'https://kareem20607-ess.github.io/bedewy-app/',      // بيتحط في الإيميلات لو «رابط التطبيق» مش متكتب في الإعدادات
  FIRST: 4,                                   // أول صف بيانات في كل الأوراق (1 عنوان، 2 شرح، 3 رؤوس)
  S: {
    permits: 'إذونات التوريد', qty: 'الكميات المنفذة', vouchers: 'السندات', stmts: 'المستخلصات',
    projects: 'المشروعات', parties: 'الأطراف', items: 'الأصناف', boq: 'المقايسة', subs: 'عقود الباطن', journal: 'اليومية', accounts: 'دليل الحسابات',
    users: 'المستخدمين', settings: 'إعدادات التطبيق', custody: 'العهد', exp: 'مصروفات العهدة', log: 'سجل التطبيق', print: 'طباعة المستخلص',
    store: 'حركة المخزن'
  },
  /* أرقام الأعمدة اللي السكريبت بيقراها أو بيكتبها. الأعمدة اللي فيها معادلات (الأسماء، الإجماليات، قيمة المستخلص
     وصافيه، سعر الجهاز وفئة الباطن في المحاضر) بتتقري بس، وعمرها ما بتتكتب، عشان المعادلة ما تتكسرش. */
  C: {
    permits: { no: 1, date: 2, project: 3, party: 5, item: 7, qty: 10, price: 11, total: 12, status: 13, photo: 14, by: 15, notes: 16, n: 16 },
    qty: { no: 1, date: 2, project: 3, item: 5, qty: 8, cprice: 9, value: 10, sub: 11, rate: 13, subValue: 14, cStmt: 15, sStmt: 16, status: 17, photo: 18, notes: 19, n: 19 },
    vouchers: { no: 1, kind: 2, date: 3, project: 4, party: 6, account: 8, amount: 10, method: 11, from: 12, ref: 13, desc: 14, status: 15, by: 16, notes: 17, n: 17 },
    stmts: { no: 1, kind: 2, project: 3, party: 5, date: 7, extNo: 8, current: 9, retPct: 11, ret: 12, adv: 13, ded: 14, net: 15, status: 16, approvedAt: 17, notes: 18, plus: 20, n: 20 },
    exp: { no: 1, date: 2, project: 3, custody: 4, cat: 5, desc: 6, amount: 7, status: 8, photo: 9, by: 10, notes: 11, n: 11 },
    custody: { no: 1, project: 2, holder: 3, amount: 4, date: 5, from: 6, status: 7, notes: 8, n: 8 },
    users: { email: 1, name: 2, role: 3, projects: 4, active: 5, notes: 6, approve: 7, daily: 8, n: 8 },
    log: { time: 1, key: 2, id: 3, type: 4, event: 5, email: 6, name: 7, role: 8, details: 9, n: 9 },
    /* حركة المخزن (6.4): صرف للتنفيذ وجرد في ورقة واحدة. الكمية في الصرف موجبة، وفي الجرد هي الفرق (العدد الفعلي ناقص الرصيد الدفتري) */
    store: { no: 1, date: 2, project: 3, kind: 4, item: 5, name: 6, unit: 7, qty: 8, counted: 9, to: 10, boq: 11, status: 12, photo: 13, by: 14, notes: 15, n: 15 }
  },
  SHEET_OF: { permit: 'permits', qty: 'qty', voucher: 'vouchers', stmt: 'stmts', exp: 'exp', issue: 'store', count: 'store' },
  TYPE_NAME: { permit: 'إذن توريد', qty: 'محضر كميات', exp: 'مصروف عهدة', voucher: 'سند صرف', stmt: 'مستخلص', issue: 'إذن صرف مخزن', count: 'جرد مخزن' },
  PREFIX: { permit: 'SP-', qty: 'Q-', exp: 'EX-', voucher: 'PV-', issue: 'IS-', count: 'IC-' },   // سند القبض بيبدأ RV-
  STORE_KIND: { issue: 'صرف للتنفيذ', count: 'جرد' },               // عمود «النوع» في «حركة المخزن»
  SUB: 'مقاول باطن', CLIENT: 'عميل',                                // نوع المستخلص في الشيت
  METHODS: ['نقدي', 'تحويل', 'شيك'], FROMS: ['الخزينة', 'البنك'],
  ROLE: { 'محاسب الموقع': 'site', 'مهندس الموقع': 'eng', 'محاسب المشروع': 'acc', 'المالك': 'owner', 'مدير المنظومة': 'admin' },
  REASONS: ['صورة غير واضحة', 'السعر غير مطابق', 'الكمية غير مطابقة', 'مورد أو صنف خطأ', 'مستند مكرر', 'أخرى'],
  CATS: ['وقود', 'نقل', 'إعاشة', 'أدوات', 'صيانة', 'أخرى'],
  MARK: '⟲ مرفوض',                            // أول سطر في الملاحظات لما المستند يترفض من التطبيق
  SET: {                                       // أسماء البنود في ورقة «إعدادات التطبيق»
    limit: 'حد اعتماد محاسب المشروع للسندات', pricePct: 'نسبة تنبيه اختلاف السعر', late: 'أيام تأخير الاعتماد',
    radius: 'نطاق موقع المشروع (كم)', renewMail: 'إشعار طلب تجديد العهدة بالبريد', folder: 'فولدر صور التطبيق', site: 'موقع المشروع ',
    appUrl: 'رابط التطبيق', storeStart: 'بداية المخزن ', storeOut: 'أصناف خارج المخزن', storeLow: 'تنبيه قرب نفاد المادة'
  }
};

/* ======================= الدخول للسكريبت ======================= */

function doPost(e) {
  var out;
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    out = bdwRoute_(body);
  } catch (err) {
    out = bdwFail_(err);
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, app: 'bedewy-api', version: BDW.VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}

function bdwRoute_(b) {
  var act = String(b.action || '');
  var me = bdwUser_(bdwVerify_(b.idToken));
  if (act === 'bootstrap') return bdwBootstrap_(me, String(b.project || ''));
  if (act === 'submit') return bdwSubmit_(me, b.op, false);
  if (act === 'resubmit') return bdwSubmit_(me, b.op, true);
  if (act === 'approve') return bdwDecide_(me, b, 'approve');
  if (act === 'reject') return bdwDecide_(me, b, 'reject');
  if (act === 'approveTech') return bdwDecide_(me, b, 'tech');
  if (act === 'photo') return bdwPhoto_(me, String(b.id || ''), b.thumb === true);
  if (act === 'archive') return bdwArchive_(me, b);
  if (act === 'register') return bdwRegister_(me, b);
  if (act === 'custodyRenew') return bdwRenew_(me, String(b.project || ''));
  if (act === 'stmtNew') return bdwStmtNew_(me, b);
  if (act === 'stmtSend') return bdwStmtSend_(me, b);
  if (act === 'stmtUnlink') return bdwStmtUnlink_(me, b);
  if (act === 'prefs') return bdwPrefs_(me, b);
  if (act === 'stmtPdf') return bdwStmtPdfAct_(me, b);
  throw bdwErr_('invalid', 'طلب غير معروف.');
}

function bdwErr_(code, message) { return { bdw: true, code: code, message: message || '' }; }
function bdwFail_(err) {
  if (err && err.bdw) return { ok: false, error: err.code, message: err.message };
  console.error(err && err.stack ? err.stack : err);
  return { ok: false, error: 'server', message: 'حصلت مشكلة في السكريبت. جرّب تاني بعد دقيقة.' };
}

/* ======================= رمز الدخول والمستخدم ======================= */

/* رمز الدخول بيتراجع عند جوجل نفسها (توقيعه وصلاحيته)، وبعدين بنتأكد إنه صادر لتطبيقنا والإيميل متأكَّد */
function bdwVerify_(idToken) {
  if (!idToken) throw bdwErr_('no_token', 'ادخل الأول بحساب جوجل.');
  var cache = CacheService.getScriptCache();
  var ck = 'tok:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(idToken))).slice(0, 40);
  var info = null, hit = cache.get(ck);
  if (hit) info = JSON.parse(hit);
  if (!info) {
    var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) throw bdwErr_('bad_token', 'جلسة الدخول انتهت. ادخل تاني.');
    info = JSON.parse(r.getContentText());
    var ttl = Math.floor(Number(info.exp) - Date.now() / 1000);
    if (ttl > 30) cache.put(ck, JSON.stringify(info), Math.min(300, ttl));
  }
  var iss = String(info.iss || '');
  if (info.aud !== bdwClientId_() || (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') ||
      String(info.email_verified) !== 'true' || Number(info.exp) * 1000 < Date.now() || !info.email) {
    throw bdwErr_('bad_token', 'جلسة الدخول انتهت. ادخل تاني.');
  }
  return { email: String(info.email).toLowerCase().trim(), name: String(info.name || info.given_name || '') };
}
function bdwClientId_() { return PropertiesService.getScriptProperties().getProperty('CLIENT_ID') || BDW.CLIENT_ID; }

function bdwUser_(tok) {
  var rows = bdwRows_(bdwSheet_(BDW.S.users), BDW.C.users.n), C = BDW.C.users;
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i].v[C.email - 1]).toLowerCase().trim() !== tok.email) continue;
    var u = bdwUserRow_(rows[i].v, rows[i].row, tok);
    if (u) return u;
    break;
  }
  throw bdwErr_('not_allowed', 'الإيميل ده مش في جدول المستخدمين. كلّم مدير المنظومة يضيفه.');
}
/* صف واحد من «المستخدمين»: الدور والمشروعات واختيارات الإشعارات (الفاضي = نعم، والملخص اليومي افتراضيًا للمالك والمدير بس) */
function bdwUserRow_(v, row, tok) {
  var C = BDW.C.users;
  if (/^لا/.test(String(v[C.active - 1]).trim())) return null;
  var roleTxt = String(v[C.role - 1]).trim(), role = BDW.ROLE[roleTxt] || (['site', 'eng', 'acc', 'owner', 'admin'].indexOf(roleTxt) >= 0 ? roleTxt : '');
  if (!role) return null;
  var email = String(v[C.email - 1]).toLowerCase().trim(), pr = String(v[C.projects - 1] || '').trim();
  var yes = function (x, def) { x = String(x === undefined || x === null ? '' : x).trim(); return x ? !/^لا/.test(x) : def; };
  return {
    email: email, name: String(v[C.name - 1] || '').trim() || (tok && tok.name) || email.split('@')[0], role: role,
    all: !pr || pr === 'الكل', projects: pr.split(/[،,\s]+/).filter(String),
    prefs: { approve: yes(v[C.approve - 1], true), daily: yes(v[C.daily - 1], role === 'owner' || role === 'admin') }, row: row
  };
}
function bdwCanSee_(me, project) { return me.all || me.projects.indexOf(project) >= 0; }

/* ======================= أدوات الأوراق ======================= */

function bdwSS_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { }
  if (!ss) { var id = PropertiesService.getScriptProperties().getProperty('SS_ID'); if (id) ss = SpreadsheetApp.openById(id); }
  if (!ss) throw bdwErr_('server', 'السكريبت مش مربوط بملف البيانات. شغّل setupApi من داخل الملف.');
  return ss;
}
function bdwSheet_(name) {
  var sh = bdwSS_().getSheetByName(name);
  if (!sh) throw bdwErr_('server', 'ورقة «' + name + '» مش موجودة. شغّل setupApi.');
  return sh;
}
/* صفوف البيانات من الصف 4، اللي عمودها الأول مش فاضي: [{row, v}] */
function bdwRows_(sh, ncols) {
  var last = sh.getLastRow();
  if (last < BDW.FIRST) return [];
  var vals = sh.getRange(BDW.FIRST, 1, last - BDW.FIRST + 1, ncols).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() !== '') out.push({ row: BDW.FIRST + i, v: vals[i] });
  return out;
}
function bdwNextRow_(sh) {
  var last = sh.getLastRow();
  if (last < BDW.FIRST) return BDW.FIRST;
  var a = sh.getRange(BDW.FIRST, 1, last - BDW.FIRST + 1, 1).getValues();
  for (var i = a.length - 1; i >= 0; i--) if (String(a[i][0]).trim() !== '') return BDW.FIRST + i + 1;
  return BDW.FIRST;
}
function bdwNextId_(sh, prefix, pad) {
  var last = sh.getLastRow(), max = 0;
  if (last >= BDW.FIRST) sh.getRange(BDW.FIRST, 1, last - BDW.FIRST + 1, 1).getValues().forEach(function (r) {
    var s = String(r[0] || '');
    if (s.indexOf(prefix) === 0) { var n = parseInt(s.substring(prefix.length), 10); if (!isNaN(n) && n > max) max = n; }
  });
  var t = String(max + 1);
  while (t.length < pad) t = '0' + t;
  return prefix + t;
}
function bdwSet_(sh, row, pairs) {
  pairs.forEach(function (p) { sh.getRange(row, p[0]).setValue(p[1] === null || p[1] === undefined ? '' : p[1]); });
}
function bdwFindRow_(sh, id, ncols) {
  var rows = bdwRows_(sh, ncols);
  for (var i = 0; i < rows.length; i++) if (String(rows[i].v[0]).trim() === id) return rows[i];
  return null;
}
function bdwNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v === null || v === undefined ? '' : v).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[,\s]/g, '');
  if (s === '' || s === '-') return null;
  var pct = /%$/.test(s), n = Number(s.replace(/%$/, ''));
  return isNaN(n) ? null : (pct ? n / 100 : n);
}
var BDW_TZ = null;
function bdwTz_() { return BDW_TZ || (BDW_TZ = bdwSS_().getSpreadsheetTimeZone() || Session.getScriptTimeZone()); }
function bdwIso_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) === '[object Date]') return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, bdwTz_(), 'yyyy-MM-dd');
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  return m ? m[0] : '';
}
/* التاريخ بيتقري بتوقيت الشيت نفسه، عشان اليوم ما يتزحلقش لو توقيت السكريبت مختلف */
function bdwToDate_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  try {
    var d = Utilities.parseDate(m[0], bdwTz_(), 'yyyy-MM-dd');
    return Utilities.formatDate(d, bdwTz_(), 'yyyy-MM-dd') === m[0] ? d : null;
  } catch (e) { return null; }
}
function bdwNoon_(iso) { var d = bdwToDate_(iso); return d ? d.getTime() + 12 * 3600 * 1000 : 0; }
function bdwToday_() { return Utilities.formatDate(new Date(), bdwTz_(), 'yyyy-MM-dd'); }
function bdwPartyType_(t) {
  t = String(t || '');
  if (t.indexOf('مورد') >= 0) return 'مورد';
  if (t.indexOf('مقاول') >= 0) return 'مقاول باطن';
  if (t.indexOf('عميل') >= 0 || t.indexOf('جهة') >= 0) return 'عميل';
  return t;
}
/* الملاحظات: بنشيل سطر الرفض لو موجود */
function bdwStripMark_(notes) { return String(notes || '').split('\n').filter(function (l) { return l.indexOf(BDW.MARK) !== 0; }).join('\n').trim(); }
function bdwDriveId_(v) {
  var s = String(v || '').trim(), m = /\/d\/([\w-]{20,})/.exec(s) || /\/folders\/([\w-]{20,})/.exec(s) || /[?&]id=([\w-]{20,})/.exec(s);
  return m ? m[1] : '';
}
function bdwPhotoRef_(v) {
  var s = String(v || '').trim();
  if (!s) return '';
  var id = bdwDriveId_(s);
  return id ? 'drive:' + id : (/^https?:/.test(s) ? s : '');
}

/* ======================= الإعدادات ======================= */

function bdwSettings_() {
  var m = {}, sh = bdwSS_().getSheetByName(BDW.S.settings);
  if (sh) bdwRows_(sh, 2).forEach(function (r) { m[String(r.v[0]).trim()] = r.v[1]; });
  var n = function (k, def) { var x = bdwNum_(m[k]); return x === null ? def : x; };
  var pct = n(BDW.SET.pricePct, 0.05);
  var sites = {};
  Object.keys(m).forEach(function (k) {
    if (k.indexOf(BDW.SET.site) !== 0) return;
    var p = String(m[k] || '').replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).split(/[،,\s]+/).filter(String).map(Number);
    if (p.length === 2 && !isNaN(p[0]) && !isNaN(p[1])) sites[k.slice(BDW.SET.site.length).trim()] = { lat: p[0], lng: p[1] };
  });
  var starts = {};
  Object.keys(m).forEach(function (k) {
    if (k.indexOf(BDW.SET.storeStart) !== 0) return;
    var iso = bdwIso_(m[k]);
    if (iso) starts[k.slice(BDW.SET.storeStart.length).trim()] = iso;
  });
  var low = n(BDW.SET.storeLow, 0.1);
  return {
    voucherLimit: n(BDW.SET.limit, 50000), priceWarnPct: pct > 1 ? pct / 100 : pct, lateDays: n(BDW.SET.late, 3),
    siteRadiusKm: n(BDW.SET.radius, 2), renewMail: !/^لا/.test(String(m[BDW.SET.renewMail] || '')),
    folder: bdwDriveId_(m[BDW.SET.folder]) || String(m[BDW.SET.folder] || '').trim(), sites: sites, postExp: false,
    appUrl: String(m[BDW.SET.appUrl] || '').trim() || BDW.APP_URL,
    storeStarts: starts, storeLow: low > 1 ? low / 100 : low,
    storeOut: String(m[BDW.SET.storeOut] || '').split(/[،,؛;\n]+/).map(function (x) { return x.trim(); }).filter(String)
  };
}

/* ======================= مخزن الموقع (6.4) ======================= */

/* أصناف المخزن: كل الأصناف ما عدا اللي في «أصناف خارج المخزن» (كود صنف أو اسم فئة، زي الخرسانة اللي بتتصرف أول ما توصل).
   rows اختيارية: [الكود، الاسم، الوحدة، الفئة] لو اتقرت قبل كده */
function bdwStoreItems_(st, rows) {
  var tok = {}, out = {};
  (st.storeOut || []).forEach(function (t) { tok[t] = 1; });
  (rows || bdwRows_(bdwSheet_(BDW.S.items), 4).map(function (r) { return [String(r.v[0]).trim(), String(r.v[1]).trim(), String(r.v[2]).trim(), String(r.v[3] || '').trim()]; }))
    .forEach(function (i) { out[i[0]] = { code: i[0], name: i[1], unit: i[2], cat: i[3], out: !!(tok[i[0]] || (i[3] && tok[i[3]])) }; });
  return out;
}
/* حركات مخزن المشروع من «بداية المخزن»: الوارد من إذونات التوريد، والمنصرف والجرد من «حركة المخزن»، من غير الملغى.
   الحركة: [النوع in/out/adj، الرقم، التاريخ، الصنف، الكمية، حالة الشيت، المورد أو المستلم، بند المقايسة أو العدد الفعلي].
   في الجرد الكمية هي الفرق (موجب زيادة، سالب عجز). null = المخزن مش متفعّل للمشروع. */
function bdwStoreMoves_(project, st, items) {
  var start = st.storeStarts[project];
  if (!start) return null;
  var moves = [], P = BDW.C.permits, M = BDW.C.store;
  bdwRows_(bdwSheet_(BDW.S.permits), P.n).forEach(function (r) {
    var v = r.v, it = String(v[P.item - 1]).trim(), iso = bdwIso_(v[P.date - 1]), s0 = String(v[P.status - 1]).trim();
    if (String(v[P.project - 1]).trim() !== project || s0 === 'ملغى' || iso < start || !items[it] || items[it].out) return;
    moves.push(['in', String(v[0]).trim(), iso, it, bdwNum_(v[P.qty - 1]) || 0, s0, String(v[P.party - 1]).trim(), '']);
  });
  var sh = bdwSS_().getSheetByName(BDW.S.store);
  if (sh) bdwRows_(sh, M.n).forEach(function (r) {
    var v = r.v, s0 = String(v[M.status - 1]).trim(), count = String(v[M.kind - 1]).trim() === BDW.STORE_KIND.count;
    if (String(v[M.project - 1]).trim() !== project || s0 === 'ملغى') return;
    moves.push([count ? 'adj' : 'out', String(v[0]).trim(), bdwIso_(v[M.date - 1]), String(v[M.item - 1]).trim(), bdwNum_(v[M.qty - 1]) || 0, s0,
      count ? '' : (String(v[M.to - 1] || '').trim() || 'ذاتي'), count ? bdwNum_(v[M.counted - 1]) : String(v[M.boq - 1] || '').trim()]);
  });
  return moves;
}
function bdwStoreBal_(moves, item) {
  var b = 0;
  (moves || []).forEach(function (m) { if (m[3] === item) b += m[0] === 'out' ? -m[4] : m[4]; });
  return Math.round(b * 1000) / 1000;
}
/* فيه جرد تاني للصنف ده مستني الاعتماد؟ (الجرد الجديد بيتحسب على الرصيد بعد الجرد اللي قبله) */
function bdwStorePendingCount_(sh, project, item, exceptId) {
  var C = BDW.C.store;
  return bdwRows_(sh, C.n).some(function (r) {
    var v = r.v;
    return String(v[0]).trim() !== (exceptId || '') && String(v[C.project - 1]).trim() === project && String(v[C.item - 1]).trim() === item &&
      String(v[C.kind - 1]).trim() === BDW.STORE_KIND.count && String(v[C.status - 1]).trim() === 'مسجَّل';
  });
}
/* الصرف والجرد بيتحسبوا على رصيد اللحظة دي، جوه القفل */
function bdwStoreCheck_(type, o, sh, exceptId) {
  var st = bdwSettings_(), bal = bdwStoreBal_(bdwStoreMoves_(o.project, st, bdwStoreItems_(st)), o.item);
  if (type === 'issue' && o.qty > bal + 1e-9) throw bdwErr_('invalid', 'الكمية أكبر من رصيد المخزن (' + bdwQtyTxt_(bal, o.unit) + ').');
  if (type === 'count') {
    if (bdwStorePendingCount_(sh, o.project, o.item, exceptId)) throw bdwErr_('conflict', 'فيه جرد للصنف ده مستني الاعتماد. اعتمده أو ارفضه الأول.');
    o.book = bal; o.adj = Math.round((o.counted - bal) * 1000) / 1000;
  }
  return bal;
}

/* ======================= سجل التطبيق ======================= */

/* كل حدث من التطبيق بيتكتب سطر: الوقت، المفتاح، رقم المستند، النوع، الحدث، الإيميل، الاسم، الدور، التفاصيل */
function bdwLog_(key, id, type, event, me, details) {
  var sh = bdwSheet_(BDW.S.log), C = BDW.C.log, r = bdwNextRow_(sh);
  sh.getRange(r, 1, 1, C.n).setValues([[new Date(), key || '', id || '', type || '', event, me.email, me.name, me.role, details ? JSON.stringify(details) : '']]);
}
/* كل سطور السجل كأحداث */
function bdwLogRead_() {
  var sh = bdwSS_().getSheetByName(BDW.S.log), out = [];
  if (!sh) return out;
  var C = BDW.C.log;
  bdwRows_(sh, C.n).forEach(function (r) {
    var v = r.v, d = {};
    try { d = v[C.details - 1] ? JSON.parse(v[C.details - 1]) : {}; } catch (e) { }
    out.push({ t: (v[C.time - 1] instanceof Date) ? v[C.time - 1].getTime() : Date.now(), key: String(v[C.key - 1] || ''), id: String(v[C.id - 1] || ''),
      type: String(v[C.type - 1] || ''), event: String(v[C.event - 1] || ''), email: String(v[C.email - 1] || '').toLowerCase(),
      name: String(v[C.name - 1] || ''), role: String(v[C.role - 1] || ''), d: d });
  });
  return out;
}
/* فهرس السجل: بالمفتاح، وبالمستند (النوع|الرقم) */
function bdwLogIndex_() {
  var idx = { byKey: {}, byDoc: {}, renew: [] };
  bdwLogRead_().forEach(function (ev) {
    if (ev.event === 'custodyRenew') { idx.renew.push(ev); return; }
    if (ev.key) idx.byKey[ev.key] = ev;
    if (ev.id && ev.type) { var k = ev.type + '|' + ev.id; (idx.byDoc[k] = idx.byDoc[k] || []).push(ev); }
  });
  return idx;
}
/* ملخص أحداث مستند واحد */
function bdwDocInfo_(events) {
  var o = { submit: null, last: null, tech: null, log: [] };
  (events || []).forEach(function (ev) {
    if (ev.event === 'submit') {
      o.submit = ev;
      o.log.push([ev.d.at || ev.t, 'سُجّل' + (ev.d.queuedAt ? ' بدون إنترنت' : ''), ev.name]);
      o.log.push([ev.t, 'وصل للشيت ورُقِّم ' + ev.id, '']);
    } else if (ev.event === 'resubmit') { o.last = null; o.tech = null; o.log.push([ev.t, 'عُدّل وأُعيد إرساله', ev.name]); o.resub = ev; }
    else if (ev.event === 'stmtNew') { o.submit = ev; o.log.push([ev.t, 'أُنشئ مسودة من ' + (ev.d.n || 0) + ' محضر', ev.name]); }
    else if (ev.event === 'stmtSend') { o.sent = ev; o.log.push([ev.t, 'أُرسل للمراجعة', ev.name]); }
    else if (ev.event === 'stmtUnlink') { o.unlink = ev; o.log.push([ev.t, 'أُلغي وفُكّت محاضره (' + (ev.d.n || 0) + ')', ev.name]); }
    else if (ev.event === 'approve') { o.last = ev; o.log.push([ev.t, ev.d.auto ? 'اعتُمد ضمن حد اعتماد المحاسب' : 'اعتُمد', ev.name]); }
    else if (ev.event === 'reject') { o.last = ev; o.log.push([ev.t, 'رُفض: ' + (ev.d.reason || ''), ev.name]); }
    else if (ev.event === 'approveTech') { o.tech = ev; o.log.push([ev.t, 'اعتماد فني', ev.name]); }
  });
  return o;
}

/* ======================= قراءة البيانات (bootstrap) ======================= */

function bdwBootstrap_(me, wanted) {
  var ss = bdwSS_(), st = bdwSettings_(), today = bdwToday_();
  var cutRecent = Date.now() - 21 * 864e5, cutApp = Date.now() - 120 * 864e5;
  var P = BDW.C;

  var parties = bdwRows_(bdwSheet_(BDW.S.parties), 6).map(function (r) { return [String(r.v[0]).trim(), String(r.v[1]).trim(), bdwPartyType_(r.v[2]), bdwNum_(r.v[4]) || 0, String(r.v[3] || '').trim()]; });
  var ptype = {}, pname = {}; parties.forEach(function (p) { ptype[p[0]] = p[2]; pname[p[0]] = p[1]; });
  var items = bdwRows_(bdwSheet_(BDW.S.items), 4).map(function (r) { return [String(r.v[0]).trim(), String(r.v[1]).trim(), String(r.v[2]).trim(), String(r.v[3] || '').trim()]; });
  var accounts = [], accName = {}, shA = ss.getSheetByName(BDW.S.accounts);
  if (shA) bdwRows_(shA, 4).forEach(function (r) { var c = String(r.v[0]).trim(); accName[c] = String(r.v[1]).trim(); accounts.push([c, accName[c], Number(r.v[3]) || 0]); });

  var projects = bdwRows_(bdwSheet_(BDW.S.projects), 13).map(function (r) {
    var v = r.v, code = String(v[0]).trim(), name = String(v[1]).trim(), parts = name.split(' — ');
    var contract = bdwNum_(v[10]) || bdwNum_(v[8]) || 0, disc = bdwNum_(v[12]) || 0;
    if (disc > 1) disc = disc / 100;
    var site = st.sites[code] || {};
    return { code: code, name: name, short: parts.length > 2 ? parts[0] + ' — ' + parts[parts.length - 1] : name, owner: String(v[3] || ''),
      value: contract, discount: disc, status: String(v[7] || ''), lat: site.lat == null ? null : site.lat, lng: site.lng == null ? null : site.lng };
  }).filter(function (p) { return bdwCanSee_(me, p.code); });
  if (!projects.length) throw bdwErr_('not_allowed', 'مفيش مشروع مسموح لك في جدول المستخدمين.');
  var pc = projects.some(function (p) { return p.code === wanted; }) ? wanted : projects[0].code;
  var proj = projects.filter(function (p) { return p.code === pc; })[0];

  var log = bdwLogIndex_();
  var info = function (type, id) { return bdwDocInfo_(log.byDoc[type + '|' + id]); };

  /* المقايسة وعقود الباطن */
  var boqRows = bdwRows_(bdwSheet_(BDW.S.boq), 9).filter(function (r) { return String(r.v[0]).trim() === pc; });
  var inBoq = {}, boqOrig = 0, boqAll = 0;
  var boq = boqRows.map(function (r) {
    var c = String(r.v[2]).trim(), tot = bdwNum_(r.v[7]) || 0; inBoq[c] = 1;
    boqAll += tot; if (String(r.v[8]).trim() === 'أصلية') boqOrig += tot;
    return [c, String(r.v[3]).trim(), String(r.v[4]).trim(), bdwNum_(r.v[5]) || 0, bdwNum_(r.v[6]), 0];
  });
  var rates = {}, subItems = [], seenSub = {}, contracts = [];
  bdwRows_(bdwSheet_(BDW.S.subs), 12).forEach(function (r) {
    if (String(r.v[1]).trim() !== pc) return;
    var s = String(r.v[3]).trim(), it = String(r.v[5]).trim(), rate = bdwNum_(r.v[9]);
    if (rate !== null) rates[s + '|' + it] = rate;
    if (!inBoq[it] && !seenSub[it]) { seenSub[it] = 1; subItems.push([it, String(r.v[6]).trim(), String(r.v[7]).trim()]); }
    contracts.push([String(r.v[0]).trim(), s, it, String(r.v[6]).trim(), String(r.v[7]).trim(), bdwNum_(r.v[8]) || 0, rate, bdwNum_(r.v[11]) || 0]);
  });

  /* أرقام اللوحة بنفس معادلات «لوحة المشروع» في ملف التقارير، مع استبعاد الملغى في كل مكان */
  var docs = [], done = {}, k = { executed: 0, subWorks: 0, supplies: 0, received: 0, out: 0, subPaid: 0, supPaid: 0, lg: 0, otherExp: 0, clientStmts: 0, clientStmtsNet: 0, lastClient: '', lastClientAt: '' };
  var pst = {}, ps = function (c) { return pst[c] || (pst[c] = { w: 0, n: 0, s: 0, p: 0, r: 0, ns: 0, np: 0, nv: 0 }); };
  var keep = function (d) {
    if (d.status === 'مسجَّل' || d.status === 'تحت المراجعة' || d.status === 'مرفوض') return true;
    if (d.fromApp && d.at >= cutApp) return true;
    return d.at >= cutRecent;
  };
  var base = function (type, id, iso, sheetStatus, project, extra, sheetBy) {
    var inf = info(type, id), sub = inf.submit, rej = inf.last && inf.last.event === 'reject';
    var status = bdwStatus_(type, sheetStatus, rej);
    if (!status) return null;
    var d = { key: sub ? sub.key : 'id:' + id, type: type, id: id, date: iso, at: sub ? (sub.d.at || sub.t) : bdwNoon_(iso), status: status,
      by: sub ? sub.email : String(sheetBy || ''), byName: sub ? sub.name : String(sheetBy || ''), byRole: sub ? sub.role : '',
      mine: sub ? sub.email === me.email : bdwSheetMine_(sheetBy, me), project: project, log: inf.log, fromApp: !!sub };
    if (inf.last) { d.decidedBy = inf.last.name; d.decidedAt = inf.last.t; if (rej) { d.reason = inf.last.d.reason || ''; d.note = inf.last.d.note || ''; } }
    if (inf.tech) { d.techOk = true; d.techBy = inf.tech.name; d.techAt = inf.tech.t; }
    for (var x in extra) d[x] = extra[x];
    if (sub && sub.d.loc) d.loc = sub.d.loc;
    var rs = inf.resub && inf.resub.d;
    if (rs && rs.loc) d.loc = rs.loc;
    return d;
  };

  /* إذونات التوريد: آخر سعر معتمد وما يورّده كل مورد (من كل المشروعات) */
  var lastPrice = {}, lastAt = {}, supplyCount = {};
  bdwRows_(bdwSheet_(BDW.S.permits), P.permits.n).forEach(function (r) {
    var v = r.v, C = P.permits, id = String(v[0]).trim(), iso = bdwIso_(v[C.date - 1]), st0 = String(v[C.status - 1]).trim();
    var party = String(v[C.party - 1]).trim(), it = String(v[C.item - 1]).trim(), price = bdwNum_(v[C.price - 1]);
    if (st0 === 'معتمد' || st0 === 'مسدَّد') {
      var pk = party + '|' + it, t = bdwNoon_(iso);
      if (price !== null && price > 0 && (lastAt[pk] === undefined || t >= lastAt[pk])) { lastPrice[pk] = price; lastAt[pk] = t; }
      supplyCount[party] = supplyCount[party] || {}; supplyCount[party][it] = (supplyCount[party][it] || 0) + 1;
    }
    if (String(v[C.project - 1]).trim() !== pc) return;
    if (st0 !== 'ملغى') { var tot = bdwNum_(v[C.total - 1]) || 0; k.supplies += tot; if (party) { ps(party).s += tot; ps(party).np++; } }
    var notes = bdwPermitNotes_(v[C.notes - 1]);
    var inf2 = info('permit', id), sub = inf2.submit;
    var d = base('permit', id, iso, st0, pc, { party: party, item: it, qty: bdwNum_(v[C.qty - 1]) || 0, price: price, photo: bdwPhotoRef_(v[C.photo - 1]),
      paperNo: (sub && sub.d.paperNo) || notes.paperNo, notes: notes.text, sign: (inf2.resub && inf2.resub.d.sign) || (sub && sub.d.sign) || '' }, v[C.by - 1]);
    if (d && keep(d)) docs.push(d);
  });
  var supplies = {};
  Object.keys(supplyCount).forEach(function (s) { supplies[s] = Object.keys(supplyCount[s]).sort(function (a, b) { return supplyCount[s][b] - supplyCount[s][a]; }); });

  /* الكميات المنفذة: كل محاضر المشروع بشكل مختصر (للمستخلصات)، والمستند الكامل للي محتاج قرار أو حديث */
  var qtyAll = [];
  bdwRows_(bdwSheet_(BDW.S.qty), P.qty.n).forEach(function (r) {
    var v = r.v, C = P.qty, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== pc) return;
    var iso = bdwIso_(v[C.date - 1]), st0 = String(v[C.status - 1]).trim(), it = String(v[C.item - 1]).trim(), q = bdwNum_(v[C.qty - 1]) || 0;
    var subc = String(v[C.sub - 1]).trim();
    qtyAll.push([id, iso, it, q, bdwNum_(v[C.cprice - 1]) || 0, bdwNum_(v[C.value - 1]) || 0, subc, subc ? (bdwNum_(v[C.rate - 1]) || 0) : null,
      bdwNum_(v[C.subValue - 1]) || 0, String(v[C.cStmt - 1] || '').trim(), String(v[C.sStmt - 1] || '').trim(), st0]);
    var notes = bdwQtyNotes_(v[C.notes - 1]), sub = info('qty', id).submit, rs = info('qty', id).resub;
    var d = base('qty', id, iso, st0, pc, { boq: it, qty: q, kind: notes.kind, exec: subc || 'ذاتي', photo: bdwPhotoRef_(v[C.photo - 1]), notes: notes.text,
      cumulative: rs && rs.d.cumulative != null ? rs.d.cumulative : (sub && sub.d.cumulative != null ? sub.d.cumulative : undefined) }, notes.by);
    if (!d) return;
    if (d.status !== 'ملغى' && d.status !== 'مرفوض') {
      k.executed += bdwNum_(v[C.value - 1]) || 0;
      if (bdwIso_(new Date(d.at)) !== today) done[it] = (done[it] || 0) + q;   /* اللي اتسجّل النهارده التطبيق بيحسبه بنفسه */
    }
    if (keep(d)) docs.push(d);
  });
  boq.forEach(function (b) { b[5] = done[b[0]] || 0; });

  /* السندات: كلها بشكل مختصر لشاشة السندات وبطاقة الطرف، وسندات الصرف اللي محتاجة قرار أو حديثة كمستندات */
  var vouchers = [], paidByRef = {}, byAcc = {};
  bdwRows_(bdwSheet_(BDW.S.vouchers), P.vouchers.n).forEach(function (r) {
    var v = r.v, C = P.vouchers, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== pc) return;
    var kind = String(v[C.kind - 1]).trim(), st0 = String(v[C.status - 1]).trim(), amt = bdwNum_(v[C.amount - 1]) || 0, party = String(v[C.party - 1]).trim();
    var acc = String(v[C.account - 1] || '').trim(), ref = String(v[C.ref - 1] || '').trim(), iso = bdwIso_(v[C.date - 1]);
    var inf = info('voucher', id), stApp = bdwStatus_('voucher', st0, inf.last && inf.last.event === 'reject');
    if (st0 !== 'ملغى') {
      if (kind === 'قبض') { k.received += amt; if (party) ps(party).r += amt; }
      else {
        k.out += amt;
        if (acc === '2100') k.subPaid += amt;
        else if (acc === '2200') k.supPaid += amt;
        if (acc.charAt(0) === '1') k.lg += amt;
        else if (acc.charAt(0) !== '2') k.otherExp += amt;
        byAcc[acc] = byAcc[acc] || [0, 0]; byAcc[acc][0] += amt; byAcc[acc][1]++;
        if (party) { ps(party).p += amt; ps(party).nv++; }
        if (ref) paidByRef[ref] = (paidByRef[ref] || 0) + amt;
      }
    }
    vouchers.push([id, kind, iso, party, acc, amt, String(v[C.method - 1] || ''), String(v[C.from - 1] || ''), ref, String(v[C.desc - 1] || ''), stApp, String(v[C.by - 1] || '')]);
    if (kind !== 'صرف') return;
    var d = base('voucher', id, iso, st0, pc, { party: party, amount: amt, method: String(v[C.method - 1] || ''), from: String(v[C.from - 1] || ''),
      account: acc, ref: ref, notes: String(v[C.desc - 1] || '') }, v[C.by - 1]);
    if (d && keep(d)) docs.push(d);
  });

  /* المستخلصات: كلها، بقيمها من معادلات الشيت */
  bdwRows_(bdwSheet_(BDW.S.stmts), P.stmts.n).forEach(function (r) {
    var v = r.v, C = P.stmts, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== pc) return;
    var st0 = String(v[C.status - 1]).trim(), kind = String(v[C.kind - 1]).trim(), party = String(v[C.party - 1]).trim(), iso = bdwIso_(v[C.date - 1]);
    var I = bdwNum_(v[C.current - 1]) || 0, T = bdwNum_(v[C.plus - 1]) || 0, O = bdwNum_(v[C.net - 1]) || 0;
    var posted = st0 === 'تحت المراجعة' || st0 === 'معتمد' || st0 === 'مصروف';     /* نفس شرط الترحيل في اليومية */
    if (kind === BDW.CLIENT && (st0 === 'معتمد' || st0 === 'مصروف')) {
      k.clientStmts += I; k.clientStmtsNet += O;
      if (iso >= k.lastClientAt) { k.lastClientAt = iso; k.lastClient = id; }
    }
    if (kind === BDW.SUB && posted) k.subWorks += I;
    if (posted && party) { ps(party).w += I; ps(party).n += O; ps(party).ns++; }
    var d = base('stmt', id, iso, st0, pc, { party: party, kind: kind, extNo: String(v[C.extNo - 1] || '').trim(), works: I, plus: T, gross: I + T,
      retPct: bdwNum_(v[C.retPct - 1]) || 0, ret: bdwNum_(v[C.ret - 1]) || 0, adv: bdwNum_(v[C.adv - 1]) || 0, ded: bdwNum_(v[C.ded - 1]) || 0, net: O,
      paid: paidByRef[id] ? paidByRef[id] : null, approvedAt: bdwIso_(v[C.approvedAt - 1]), notes: bdwStripMark_(v[C.notes - 1]) }, '');
    if (!d) return;
    if (info('stmt', id).unlink) d.status = 'ملغى';
    docs.push(d);
  });

  /* مخزن الموقع (6.4): الحركات من بداية المخزن، وأذونات الصرف والجرد كمستندات */
  var store = { on: false }, sItems = bdwStoreItems_(st, items), sMoves = bdwStoreMoves_(pc, st, sItems);
  if (sMoves) store = { on: true, start: st.storeStarts[pc], low: st.storeLow, out: Object.keys(sItems).filter(function (c) { return sItems[c].out; }),
    moves: sMoves.map(function (m) { m[5] = bdwStatus_(m[0] === 'in' ? 'permit' : 'issue', m[5], false); return m; }) };
  var shS = ss.getSheetByName(BDW.S.store);
  if (shS) bdwRows_(shS, P.store.n).forEach(function (r) {
    var v = r.v, C = P.store, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== pc) return;
    var type = String(v[C.kind - 1]).trim() === BDW.STORE_KIND.count ? 'count' : 'issue', inf = info(type, id), rs = inf.resub && inf.resub.d;
    var extra = { item: String(v[C.item - 1]).trim(), qty: bdwNum_(v[C.qty - 1]) || 0, photo: bdwPhotoRef_(v[C.photo - 1]), notes: bdwStripMark_(v[C.notes - 1]) };
    if (type === 'count') extra.counted = bdwNum_(v[C.counted - 1]);
    else { extra.exec = String(v[C.to - 1] || '').trim() || 'ذاتي'; extra.boq = String(v[C.boq - 1] || '').trim(); extra.sign = (rs && rs.sign) || (inf.submit && inf.submit.d.sign) || ''; }
    var d = base(type, id, bdwIso_(v[C.date - 1]), String(v[C.status - 1]).trim(), pc, extra, v[C.by - 1]);
    if (d && keep(d)) docs.push(d);
  });

  /* العهدة ومصروفاتها */
  var custody = null, shC = ss.getSheetByName(BDW.S.custody);
  if (shC) bdwRows_(shC, P.custody.n).forEach(function (r) {
    var v = r.v, C = P.custody;
    if (String(v[C.project - 1]).trim() !== pc || String(v[C.holder - 1]).toLowerCase().trim() !== me.email || String(v[C.status - 1]).trim() !== 'مفتوحة') return;
    custody = { no: String(v[0]).trim(), amount: bdwNum_(v[C.amount - 1]) || 0, at: bdwNoon_(bdwIso_(v[C.date - 1])), from: String(v[C.from - 1] || 'الخزينة') };
  });
  var shE = ss.getSheetByName(BDW.S.exp);
  if (shE) bdwRows_(shE, P.exp.n).forEach(function (r) {
    var v = r.v, C = P.exp, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== pc) return;
    var cno = String(v[C.custody - 1]).trim();
    var d = base('exp', id, bdwIso_(v[C.date - 1]), String(v[C.status - 1]).trim(), pc, { custody: cno, cat: String(v[C.cat - 1] || ''), desc: String(v[C.desc - 1] || ''),
      amount: bdwNum_(v[C.amount - 1]) || 0, photo: bdwPhotoRef_(v[C.photo - 1]), notes: bdwStripMark_(v[C.notes - 1]) }, v[C.by - 1]);
    if (d && (keep(d) || (custody && cno === custody.no))) docs.push(d);
  });

  /* اليومية: أرصدة الأطراف (له + / عليه −) من كل المشروعات */
  var balances = {};
  parties.forEach(function (p) { if (p[3]) balances[p[0]] = p[3]; });
  var balAcc = { '1300': 1, '1310': 1, '1400': 1, '2100': 1, '2110': 1, '2200': 1, '2300': 1 };
  var shJ = ss.getSheetByName(BDW.S.journal);
  if (shJ) bdwRows_(shJ, 10).forEach(function (r) {
    var v = r.v, acc = String(v[7]).trim(), dr = bdwNum_(v[8]) || 0, cr = bdwNum_(v[9]) || 0, party = String(v[6]).trim();
    if (party && balAcc[acc]) balances[party] = (balances[party] || 0) + cr - dr;
  });

  docs.sort(function (a, b) { return b.at - a.at; });
  if (docs.length > 600) docs = docs.slice(0, 600);
  docs.forEach(function (d) { delete d.fromApp; });

  var contract = boqOrig || proj.value, contractNet = contract * (1 - proj.discount);
  var dash = {
    at: Date.now(), contract: contract, contractAll: boqAll || proj.value, discount: proj.discount, contractNet: contractNet,
    executed: k.executed, clientStmts: k.clientStmts, clientStmtsNet: k.clientStmtsNet, lastClient: k.lastClient, received: k.received,
    cost: k.subWorks + k.supplies + k.otherExp, subWorks: k.subWorks, subPaid: k.subPaid, supplies: k.supplies, supPaid: k.supPaid,
    otherExp: k.otherExp, lg: k.lg, out: k.out, netCash: k.received - k.out,
    byAccount: Object.keys(byAcc).map(function (a) { return [a, accName[a] || a, byAcc[a][0], byAcc[a][1]]; }).sort(function (x, y) { return y[2] - x[2]; }),
    subs: Object.keys(pst).filter(function (c) { return ptype[c] === BDW.SUB && (pst[c].w || pst[c].p); })
      .map(function (c) { var s = pst[c]; return [c, pname[c] || c, s.w, s.n, s.p, s.n - s.p]; }).sort(function (x, y) { return y[5] - x[5]; })
  };

  return {
    ok: true, version: BDW.VERSION, serverTime: Date.now(),
    user: { email: me.email, name: me.name, role: me.role, prefs: me.prefs || null },
    settings: { voucherLimit: st.voucherLimit, priceWarnPct: st.priceWarnPct, lateDays: st.lateDays, siteRadiusKm: st.siteRadiusKm, postExp: st.postExp, storeLow: st.storeLow },
    projects: projects, parties: parties.map(function (p) { return [p[0], p[1], p[2], p[4]]; }), balances: balances, items: items, accounts: accounts,
    supplies: supplies, lastPrice: lastPrice, boq: boq, subItems: subItems, rates: rates, contracts: contracts,
    custody: custody, kpis: { contract: contract, contractNet: contractNet, executed: k.executed, clientStmts: k.clientStmts, clientStmtsNet: k.clientStmtsNet,
      cost: dash.cost, received: k.received, subWorks: k.subWorks, subPaid: k.subPaid },
    dash: dash, pstats: pst, qtyAll: qtyAll, vouchers: vouchers, store: store,
    docs: docs
  };
}
/* حالة المستند في التطبيق من حالة الشيت: المرفوض من التطبيق بيبان في الشيت «ملغى» عشان ما يترحّلش في اليومية */
function bdwStatus_(type, s, rejected) {
  s = String(s || '').trim();
  if (type === 'stmt') {
    if (s === 'تحت المراجعة' || s === 'مسودة') return s;
    if (s === 'معتمد' || s === 'مصروف') return 'معتمد';
    if (s === 'مرفوض') return 'مرفوض';
    return null;
  }
  if (s === 'ملغى') return rejected ? 'مرفوض' : 'ملغى';
  if (s === 'معتمد' || s === 'مسدَّد') return 'معتمد';
  return 'مسجَّل';
}
function bdwSheetMine_(by, me) {
  var b = String(by || '').toLowerCase().trim();
  return !!b && (b === me.email || b === me.email.split('@')[0] || b === String(me.name).toLowerCase());
}
/* ملاحظات الإذن: «إذن ورقي رقم X — ملاحظات» */
function bdwPermitNotes_(raw) {
  var paper = '', rest = [];
  bdwStripMark_(raw).split(' — ').forEach(function (p) {
    var m = /^إذن ورقي رقم\s*(.+)$/.exec(p.trim());
    if (m) paper = m[1].trim(); else if (p.trim()) rest.push(p.trim());
  });
  return { paperNo: paper, text: rest.join(' — ') };
}
/* ملاحظات المحضر: «حالية/تراكمي — ملاحظات — بواسطة الاسم» */
function bdwQtyNotes_(raw) {
  var kind = 'حالية', by = '', rest = [];
  bdwStripMark_(raw).split(' — ').forEach(function (p, i) {
    p = p.trim(); if (!p) return;
    if (i === 0 && /^(حالية|تراكمي|سابقة)/.test(p)) { kind = /تراكمي/.test(p) ? 'تراكمي' : 'حالية'; return; }
    var m = /^بواسطة\s+(.+)$/.exec(p);
    if (m) by = m[1]; else rest.push(p);
  });
  return { kind: kind, by: by, text: rest.join(' — ') };
}

/* ======================= تسجيل وإعادة إرسال ======================= */

function bdwSubmit_(me, op, isResub) {
  if (!op || typeof op !== 'object' || !/^[\w-]{6,64}$/.test(String(op.key || ''))) throw bdwErr_('invalid', 'المستند ناقص بياناته.');
  var d = op.doc || {}, type = d.type;
  if (!BDW.PREFIX[type]) throw bdwErr_('invalid', 'نوع مستند غير معروف.');
  var can = { permit: ['site', 'acc', 'admin'], qty: ['site', 'eng', 'admin'], exp: ['site'], voucher: ['acc', 'admin'], issue: ['site', 'eng', 'admin'], count: ['site', 'eng', 'admin'] }[type];
  var store = type === 'issue' || type === 'count';                /* صورة إذن الصرف والجرد اختيارية */
  if (isResub && type === 'voucher') throw bdwErr_('invalid', 'السند ما بيتعدّلش؛ اعمل سند جديد.');
  if (can.indexOf(me.role) < 0) throw bdwErr_('forbidden', 'دورك ما بيسمحش بتسجيل المستند ده.');
  if (!bdwCanSee_(me, String(d.project || ''))) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');

  var seen = bdwLogIndex_().byKey[op.key];                    /* نفس المستند وصل قبل كده (إعادة محاولة) */
  if (seen) return bdwSeen_(seen);

  var clean = bdwValidate_(me, type, d);                      /* بيرمي رسالة واضحة لو فيه حقل غلط */
  var target = null;
  if (isResub) target = bdwResubTarget_(me, op.target, type);

  var photoUrl = '', signId = '';                             /* الصور بتترفع قبل القفل عشان القفل ما يطولش */
  var stamp = (isResub ? target.id : BDW.PREFIX[type] + 'جديد') + ' — ' + Utilities.formatDate(new Date(), bdwTz_(), 'yyyy-MM-dd HHmmss');
  var rename = function (id) {
    [[bdwDriveId_(photoUrl), 'صورة'], [signId, 'توقيع']].forEach(function (f) {
      if (!f[0]) return;
      try { var file = DriveApp.getFileById(f[0]); file.setName(file.getName().replace(BDW.PREFIX[type] + 'جديد', id)); } catch (e) { }
    });
  };
  if (d.photoData && type !== 'voucher') photoUrl = bdwSaveImage_(d.photoData, stamp + ' — صورة');
  else if (!isResub && type !== 'voucher' && !store) throw bdwErr_('invalid', 'الصورة ما وصلتش مع المستند. افتحه وصوّره تاني.');
  if (d.signData) signId = bdwDriveId_(bdwSaveImage_(d.signData, stamp + ' — توقيع'));

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw bdwErr_('busy', 'السكريبت مشغول دلوقتي. هيتبعت تاني لوحده.');
  try {
    var again = bdwLogIndex_().byKey[op.key];
    if (again) return bdwSeen_(again);
    var det = { at: Number(op.at) || Date.now(), loc: clean.loc };
    if (op.queuedAt) det.queuedAt = Number(op.queuedAt);
    if (type === 'permit') det.paperNo = clean.paperNo;
    if ((type === 'permit' || type === 'issue') && signId) det.sign = 'drive:' + signId;
    if (type === 'qty') { det.kind = clean.kind; if (clean.cumulative != null) det.cumulative = clean.cumulative; }
    if (isResub) {
      bdwRewrite_(me, type, target, clean, photoUrl);
      det.target = target.key;
      if (type === 'count') { det.counted = clean.counted; det.adj = clean.adj; }
      bdwLog_(op.key, target.id, type, 'resubmit', me, det);
      return type === 'count' ? { ok: true, id: target.id, adj: clean.adj } : { ok: true, id: target.id };
    }
    if (type === 'voucher') { det.kind = clean.kind; det.amount = clean.amount; }
    var id = bdwAppend_(me, type, clean, photoUrl);
    if (type === 'count') { det.counted = clean.counted; det.adj = clean.adj; }
    bdwLog_(op.key, id, type, 'submit', me, det);
    rename(id);
    if (type === 'count') return { ok: true, id: id, adj: clean.adj };
    if (type === 'voucher') {                                   /* سند القبض، وسند الصرف لحد حد المحاسب، بيتعتمدوا مع التسجيل */
      if (clean.autoOk) bdwLog_(op.key, id, type, 'approve', me, { auto: true });
      return { ok: true, id: id, status: clean.autoOk ? 'معتمد' : 'مسجَّل' };
    }
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/* المستند ده وصل قبل كده: نفس الرقم (وحالة السند لو سند) */
function bdwSeen_(ev) {
  var r = { ok: true, id: ev.id, duplicate: true };
  if (ev.type === 'voucher') r.status = ev.event === 'approve' ? 'معتمد' : 'مسجَّل';
  return r;
}

/* التحقق من الحقول على السيرفر (نفس قواعد التطبيق، عشان محدش يبعت بيانات غلط من برّه) */
function bdwValidate_(me, type, d) {
  var bad = function (m) { throw bdwErr_('invalid', m); };
  var date = String(d.date || ''), today = bdwToday_();
  if (!bdwToDate_(date)) bad('التاريخ مش مقروء.');
  if (date > today) bad('التاريخ بعد النهارده.');
  if (date < '2020-01-01') bad('التاريخ قديم جدًا؛ راجع السنة.');
  var notes = String(d.notes || '').trim().slice(0, 300).replace(/\n/g, ' ');
  var loc = null;
  if (d.loc && isFinite(d.loc.lat) && isFinite(d.loc.lng)) loc = { lat: Number(d.loc.lat), lng: Number(d.loc.lng), acc: isFinite(d.loc.acc) ? Math.round(Number(d.loc.acc)) : null };
  var o = { project: String(d.project), date: date, notes: notes, loc: loc };
  if (!bdwRows_(bdwSheet_(BDW.S.projects), 1).some(function (r) { return String(r.v[0]).trim() === o.project; })) bad('المشروع مش موجود في المشروعات.');
  var codes = function (sheet, typeWanted) {
    var m = {};
    bdwRows_(bdwSheet_(sheet), 3).forEach(function (r) { m[String(r.v[0]).trim()] = typeWanted ? bdwPartyType_(r.v[2]) : 1; });
    return m;
  };
  if (type === 'permit') {
    var parties = codes(BDW.S.parties, true), items = codes(BDW.S.items);
    o.party = String(d.party || ''); o.item = String(d.item || '');
    if (parties[o.party] !== 'مورد') bad('المورد مش موجود في الأطراف.');
    if (!items[o.item]) bad('الصنف مش موجود في الأصناف.');
    o.qty = Number(d.qty); o.price = Number(d.price);
    if (!(o.qty > 0)) bad('الكمية لازم تكون أكبر من صفر.');
    if (!(o.price > 0)) bad('سعر الوحدة لازم يتكتب.');
    o.paperNo = String(d.paperNo || '').trim().slice(0, 30);
  } else if (type === 'qty') {
    o.boq = String(d.boq || ''); o.qty = Number(d.qty); o.kind = d.kind === 'تراكمي' ? 'تراكمي' : 'حالية';
    var okItem = false;
    bdwRows_(bdwSheet_(BDW.S.boq), 3).forEach(function (r) { if (String(r.v[0]).trim() === o.project && String(r.v[2]).trim() === o.boq) okItem = true; });
    if (!okItem) bdwRows_(bdwSheet_(BDW.S.subs), 6).forEach(function (r) { if (String(r.v[1]).trim() === o.project && String(r.v[5]).trim() === o.boq) okItem = true; });
    if (!okItem) bad('البند مش موجود في مقايسة المشروع ولا في عقود الباطن.');
    if (!(o.qty > 0)) bad('الكمية لازم تكون أكبر من صفر.');
    if (o.kind === 'تراكمي') { o.cumulative = Number(d.cumulative); if (!(o.cumulative > 0)) bad('اكتب الكمية التراكمية.'); }
    o.exec = String(d.exec || 'ذاتي');
    if (o.exec !== 'ذاتي' && codes(BDW.S.parties, true)[o.exec] !== 'مقاول باطن') bad('مقاول الباطن مش موجود في الأطراف.');
  } else if (type === 'issue' || type === 'count') {
    var stS = bdwSettings_(), start = stS.storeStarts[o.project];
    if (!start) bad('المخزن مش متفعّل للمشروع ده. اكتب «' + BDW.SET.storeStart + o.project + '» في «' + BDW.S.settings + '».');
    if (date < start) bad('التاريخ قبل بداية المخزن (' + start + ').');
    var si = bdwStoreItems_(stS)[String(d.item || '').trim()];
    if (!si) bad('الصنف مش موجود في الأصناف.');
    if (si.out) bad('الصنف ده بيتصرف أول ما يوصل، ومش من أصناف المخزن.');
    o.item = si.code; o.itemName = si.name; o.unit = si.unit;
    if (type === 'issue') {
      o.qty = Math.round(Number(d.qty) * 1000) / 1000;
      if (!(o.qty > 0)) bad('الكمية لازم تكون أكبر من صفر.');
      o.exec = String(d.exec || 'ذاتي');
      if (o.exec !== 'ذاتي' && codes(BDW.S.parties, true)[o.exec] !== 'مقاول باطن') bad('مقاول الباطن مش موجود في الأطراف.');
      o.boq = String(d.boq || '').trim();
      if (o.boq) {
        var okB = bdwRows_(bdwSheet_(BDW.S.boq), 3).some(function (r) { return String(r.v[0]).trim() === o.project && String(r.v[2]).trim() === o.boq; }) ||
          bdwRows_(bdwSheet_(BDW.S.subs), 6).some(function (r) { return String(r.v[1]).trim() === o.project && String(r.v[5]).trim() === o.boq; });
        if (!okB) bad('بند المقايسة مش موجود في المشروع.');
      }
    } else {
      o.counted = d.counted === '' || d.counted === null || d.counted === undefined ? NaN : Math.round(Number(d.counted) * 1000) / 1000;
      if (!(o.counted >= 0)) bad('اكتب العدد الفعلي (صفر أو أكتر).');
    }
  } else if (type === 'exp') {
    o.cat = String(d.cat || ''); o.desc = String(d.desc || '').trim().slice(0, 200); o.amount = Number(d.amount);
    if (BDW.CATS.indexOf(o.cat) < 0) bad('اختار تصنيف المصروف.');
    if (!o.desc) bad('اكتب بيان المصروف.');
    if (!(o.amount > 0)) bad('المبلغ لازم يكون أكبر من صفر.');
  } else {
    var pt = codes(BDW.S.parties, true), accs = {};
    bdwRows_(bdwSheet_(BDW.S.accounts), 2).forEach(function (r) { accs[String(r.v[0]).trim()] = 1; });
    o.kind = d.kind === 'قبض' ? 'قبض' : 'صرف';
    o.party = String(d.party || '').trim();
    if (!pt[o.party]) bad('الطرف مش موجود في الأطراف.');
    o.account = String(d.account || '').trim() || bdwDefaultAccount_(pt[o.party]);
    if (!accs[o.account]) bad('الحساب مش موجود في دليل الحسابات.');
    o.amount = Math.round(Number(d.amount) * 100) / 100;
    if (!(o.amount > 0)) bad('المبلغ لازم يكون أكبر من صفر.');
    o.method = String(d.method || ''); o.from = String(d.from || '');
    if (BDW.METHODS.indexOf(o.method) < 0) bad('اختار طريقة الدفع.');
    if (BDW.FROMS.indexOf(o.from) < 0) bad('اختار الخزينة أو البنك.');
    o.desc = String(d.desc || '').trim().slice(0, 200).replace(/\n/g, ' ');
    if (!o.desc) bad('اكتب بيان السند.');
    o.ref = String(d.ref || '').trim();
    if (o.ref && !bdwRows_(bdwSheet_(BDW.S.stmts), 5).some(function (r) { return String(r.v[0]).trim() === o.ref && String(r.v[4]).trim() === o.party && String(r.v[2]).trim() === o.project; }))
      bad('المرجع مش مستخلص للطرف ده في المشروع.');
    o.autoOk = o.kind === 'قبض' || o.amount <= bdwSettings_().voucherLimit;
  }
  return o;
}
/* الحساب المقترح من نوع الطرف */
function bdwDefaultAccount_(ptype) {
  if (ptype === 'مقاول باطن') return '2100';
  if (ptype === 'مورد') return '2200';
  if (ptype === 'عميل') return '1300';
  return '';
}

/* صف جديد في ورقة المستند */
function bdwAppend_(me, type, o, photoUrl) {
  var sh, C, r, id;
  if (type === 'permit') {
    sh = bdwSheet_(BDW.S.permits); C = BDW.C.permits; r = bdwNextRow_(sh); id = bdwNextId_(sh, 'SP-', 4);
    bdwSet_(sh, r, [[C.no, id], [C.date, bdwToDate_(o.date)], [C.project, o.project], [C.party, o.party], [C.item, o.item], [C.qty, o.qty], [C.price, o.price],
      [C.status, 'مسجَّل'], [C.photo, photoUrl], [C.by, me.name], [C.notes, bdwPermitNoteText_(o)]]);
    return id;
  }
  if (type === 'qty') {
    sh = bdwSheet_(BDW.S.qty); C = BDW.C.qty; r = bdwNextRow_(sh); id = bdwNextId_(sh, 'Q-', 4);
    bdwSet_(sh, r, [[C.no, id], [C.date, bdwToDate_(o.date)], [C.project, o.project], [C.item, o.boq], [C.qty, o.qty], [C.sub, o.exec === 'ذاتي' ? '' : o.exec],
      [C.status, 'مسجَّل'], [C.photo, photoUrl], [C.notes, bdwQtyNoteText_(o, me)]]);
    return id;
  }
  if (type === 'voucher') {
    sh = bdwSheet_(BDW.S.vouchers); C = BDW.C.vouchers; r = bdwNextRow_(sh); id = bdwNextId_(sh, o.kind === 'قبض' ? 'RV-' : 'PV-', 4);
    bdwSet_(sh, r, [[C.no, id], [C.kind, o.kind], [C.date, bdwToDate_(o.date)], [C.project, o.project], [C.party, o.party], [C.account, o.account],
      [C.amount, o.amount], [C.method, o.method], [C.from, o.from], [C.ref, o.ref], [C.desc, o.desc], [C.status, o.autoOk ? 'معتمد' : 'مسجَّل'],
      [C.by, me.name], [C.notes, o.notes]]);
    return id;
  }
  if (type === 'issue' || type === 'count') {
    sh = bdwSheet_(BDW.S.store); C = BDW.C.store;
    bdwStoreCheck_(type, o, sh, '');
    r = bdwNextRow_(sh); id = bdwNextId_(sh, BDW.PREFIX[type], 4);
    bdwSet_(sh, r, [[C.no, id], [C.date, bdwToDate_(o.date)], [C.project, o.project], [C.kind, BDW.STORE_KIND[type]], [C.item, o.item], [C.name, o.itemName],
      [C.unit, o.unit], [C.qty, type === 'issue' ? o.qty : o.adj], [C.counted, type === 'count' ? o.counted : ''], [C.to, type === 'issue' ? o.exec : ''],
      [C.boq, type === 'issue' ? o.boq : ''], [C.status, 'مسجَّل'], [C.photo, photoUrl], [C.by, me.name], [C.notes, o.notes]]);
    return id;
  }
  var cu = bdwOpenCustody_(me, o.project);
  if (!cu) throw bdwErr_('invalid', 'مفيش عهدة مفتوحة باسمك في المشروع ده. كلّم محاسب المشروع.');
  if (o.amount > cu.left + 0.001) throw bdwErr_('invalid', 'المبلغ أكبر من المتبقي في العهدة (' + cu.left + ' ج).');
  sh = bdwSheet_(BDW.S.exp); C = BDW.C.exp; r = bdwNextRow_(sh); id = bdwNextId_(sh, 'EX-', 4);
  bdwSet_(sh, r, [[C.no, id], [C.date, bdwToDate_(o.date)], [C.project, o.project], [C.custody, cu.no], [C.cat, o.cat], [C.desc, o.desc], [C.amount, o.amount],
    [C.status, 'مسجَّل'], [C.photo, photoUrl], [C.by, me.name], [C.notes, o.notes]]);
  return id;
}
function bdwPermitNoteText_(o) { return [o.paperNo ? 'إذن ورقي رقم ' + o.paperNo : '', o.notes].filter(String).join(' — '); }
function bdwQtyNoteText_(o, me) { return [o.kind === 'تراكمي' ? 'تراكمي (من ' + o.cumulative + ')' : 'حالية', o.notes, 'بواسطة ' + me.name].filter(String).join(' — '); }

/* العهدة المفتوحة للمستخدم في المشروع والمتبقي منها */
function bdwOpenCustody_(me, project) {
  var shC = bdwSS_().getSheetByName(BDW.S.custody), C = BDW.C.custody, cu = null;
  if (!shC) return null;
  bdwRows_(shC, C.n).forEach(function (r) {
    if (String(r.v[C.project - 1]).trim() === project && String(r.v[C.holder - 1]).toLowerCase().trim() === me.email && String(r.v[C.status - 1]).trim() === 'مفتوحة') {
      cu = { no: String(r.v[0]).trim(), amount: bdwNum_(r.v[C.amount - 1]) || 0 };
    }
  });
  if (!cu) return null;
  var spent = 0, E = BDW.C.exp, shE = bdwSS_().getSheetByName(BDW.S.exp);
  if (shE) bdwRows_(shE, E.n).forEach(function (r) {
    if (String(r.v[E.custody - 1]).trim() === cu.no && String(r.v[E.status - 1]).trim() !== 'ملغى') spent += bdwNum_(r.v[E.amount - 1]) || 0;
  });
  cu.spent = spent; cu.left = Math.round((cu.amount - spent) * 100) / 100;
  return cu;
}

/* المستند المرفوض اللي بيتعدّل: لازم يكون بتاعك ومرفوض فعلًا */
function bdwResubTarget_(me, targetKey, type) {
  var idx = bdwLogIndex_(), key = String(targetKey || ''), id = '';
  if (idx.byKey[key]) id = idx.byKey[key].id;
  else if (key.indexOf('id:') === 0) id = key.slice(3);
  if (!id) throw bdwErr_('not_found', 'المستند اللي بتعدّله مش موجود.');
  var name = BDW.SHEET_OF[type], sh = bdwSheet_(BDW.S[name]), C = BDW.C[name], hit = bdwFindRow_(sh, id, C.n);
  if (!hit) throw bdwErr_('not_found', 'المستند ' + id + ' مش موجود في الشيت.');
  var inf = bdwDocInfo_(idx.byDoc[type + '|' + id]);
  var mine = inf.submit ? inf.submit.email === me.email : bdwSheetMine_(type === 'qty' ? bdwQtyNotes_(hit.v[C.notes - 1]).by : hit.v[(C.by || C.notes) - 1], me);
  if (!mine) throw bdwErr_('forbidden', 'التعديل لصاحب المستند بس.');
  if (String(hit.v[C.status - 1]).trim() !== 'ملغى' || !inf.last || inf.last.event !== 'reject') throw bdwErr_('conflict', 'المستند ده مش مرفوض، فمفيش تعديل عليه.');
  if (!bdwCanSee_(me, String(hit.v[C.project - 1]).trim())) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');
  return { id: id, key: inf.submit ? inf.submit.key : key, row: hit.row, sheet: sh, C: C, v: hit.v };
}
function bdwRewrite_(me, type, t, o, photoUrl) {
  var C = t.C, pairs = [[C.date, bdwToDate_(o.date)], [C.status, 'مسجَّل']];
  if (photoUrl) pairs.push([C.photo, photoUrl]);
  if (type === 'permit') pairs.push([C.party, o.party], [C.item, o.item], [C.qty, o.qty], [C.price, o.price], [C.notes, bdwPermitNoteText_(o)]);
  if (type === 'qty') pairs.push([C.item, o.boq], [C.qty, o.qty], [C.sub, o.exec === 'ذاتي' ? '' : o.exec], [C.notes, bdwQtyNoteText_(o, me)]);
  if (type === 'exp') {
    var cu = bdwOpenCustody_(me, o.project);           /* المرفوض «ملغى» فمش محسوب في المصروف */
    if (cu && String(t.v[C.custody - 1]).trim() === cu.no && o.amount > cu.left + 0.001) throw bdwErr_('invalid', 'المبلغ أكبر من المتبقي في العهدة (' + cu.left + ' ج).');
    pairs.push([C.cat, o.cat], [C.desc, o.desc], [C.amount, o.amount], [C.notes, o.notes]);
  }
  if (type === 'issue' || type === 'count') {                 /* المرفوض «ملغى» فمش داخل في الرصيد */
    bdwStoreCheck_(type, o, t.sheet, t.id);
    pairs.push([C.item, o.item], [C.name, o.itemName], [C.unit, o.unit], [C.qty, type === 'issue' ? o.qty : o.adj], [C.notes, o.notes]);
    if (type === 'issue') pairs.push([C.to, o.exec], [C.boq, o.boq]); else pairs.push([C.counted, o.counted]);
  }
  bdwSet_(t.sheet, t.row, pairs);
}

/* ======================= الاعتماد والرفض ======================= */

function bdwDecide_(me, b, kind) {
  var type = String(b.type || ''), id = String(b.id || '').trim(), name = BDW.SHEET_OF[type];
  if (!name || !id) throw bdwErr_('invalid', 'المستند مش محدد.');
  var reason = '', note = '';
  if (kind === 'reject') {
    reason = String(b.reason || ''); note = String(b.note || '').trim().slice(0, 500).replace(/\n/g, ' ');
    if (BDW.REASONS.indexOf(reason) < 0) throw bdwErr_('invalid', 'اختار سبب الرفض.');
    if (reason === 'أخرى' && !note) throw bdwErr_('invalid', 'مع «أخرى» اكتب السبب في الملاحظة.');
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw bdwErr_('busy', 'السكريبت مشغول دلوقتي. جرّب تاني بعد ثواني.');
  try {
    var sh = bdwSheet_(BDW.S[name]), C = BDW.C[name], hit = bdwFindRow_(sh, id, C.n);
    if (!hit) throw bdwErr_('not_found', 'المستند ' + id + ' مش موجود في الشيت.');
    var v = hit.v, project = String(v[C.project - 1]).trim();
    if (!bdwCanSee_(me, project)) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');
    var idx = bdwLogIndex_(), inf = bdwDocInfo_(idx.byDoc[type + '|' + id]);
    var status = bdwStatus_(type, v[C.status - 1], inf.last && inf.last.event === 'reject');
    if (kind === 'approve' && status === 'معتمد') return { ok: true, already: true };
    if (kind === 'reject' && status === 'مرفوض') return { ok: true, already: true };
    if (kind === 'tech' && inf.tech) return { ok: true, already: true };

    var creator = inf.submit ? inf.submit.email : '';
    var by = type === 'qty' ? bdwQtyNotes_(v[C.notes - 1]).by : (C.by ? v[C.by - 1] : '');
    if (creator === me.email || (!creator && bdwSheetMine_(by, me))) throw bdwErr_('forbidden', 'مينفعش تعتمد أو ترفض مستند إنت اللي سجّلته.');
    var amount = type === 'voucher' ? (bdwNum_(v[C.amount - 1]) || 0) : 0;
    if (!bdwAllowed_(me.role, type, status, kind, amount, inf, bdwSettings_())) throw bdwErr_('forbidden', 'القرار ده مش من صلاحية دورك، أو المستند مش في المرحلة دي.');
    if (type === 'permit' && kind === 'approve' && !(bdwNum_(v[C.price - 1]) > 0)) throw bdwErr_('invalid', 'الإذن بدون سعر؛ لازم يتعدّل قبل الاعتماد.');

    if (kind === 'approve') {
      var pairs = [[C.status, 'معتمد']];
      if (type === 'stmt') pairs.push([C.approvedAt, bdwToDate_(bdwToday_())]);
      bdwSet_(sh, hit.row, pairs);
    } else if (kind === 'reject') {
      var mark = BDW.MARK + ': ' + reason + (note ? ' — ' + note : '') + ' — ' + me.name;
      bdwSet_(sh, hit.row, [[C.status, type === 'stmt' ? 'مرفوض' : 'ملغى'], [C.notes, mark + '\n' + bdwStripMark_(v[C.notes - 1])]]);
    }
    bdwLog_(inf.submit ? inf.submit.key : 'id:' + id, id, type, kind === 'tech' ? 'approveTech' : kind, me, kind === 'reject' ? { reason: reason, note: note } : null);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
/* نفس قواعد صندوق الاعتماد في التطبيق */
function bdwAllowed_(role, type, status, kind, amount, inf, st) {
  if (type === 'stmt') {
    if (status !== 'تحت المراجعة') return false;
    if (!inf.tech) return role === 'eng' && (kind === 'tech' || kind === 'reject');
    return (role === 'owner' || role === 'admin') && (kind === 'approve' || kind === 'reject');
  }
  if (kind === 'tech' || status !== 'مسجَّل') return false;
  var byEng = !!(inf.submit && inf.submit.role === 'eng'), lim = st.voucherLimit;
  var site = type === 'qty' || type === 'issue';                 /* المحضر وإذن الصرف للمهندس، واللي سجّله المهندس بنفسه للمالك */
  if (role === 'eng') return site;
  if (role === 'acc') return type === 'permit' || type === 'exp' || type === 'count' || (type === 'voucher' && amount <= lim);
  if (role === 'admin') return type === 'permit' || type === 'exp' || type === 'count' || (type === 'voucher' && amount <= lim) || (site && byEng);
  if (role === 'owner') return (type === 'voucher' && amount > lim) || (site && byEng);
  return false;
}

/* ======================= المستخلصات (4.2): مسودة من المحاضر المعتمدة، إرسال للمراجعة، فك المحاضر ======================= */

/* المستخلص بيتبني من المحاضر المعتمدة اللي خانة مستخلصها فاضية. السكريبت بيكتب رقمه في المحاضر، ومعادلة الشيت
   بتحسب قيمة الأعمال والمحتجز والصافي. المستخلص بيبدأ «مسودة» عشان ما يترحّلش في اليومية قبل ما يتراجع. */
function bdwStmtNew_(me, b) {
  if (me.role !== 'acc' && me.role !== 'admin') throw bdwErr_('forbidden', 'إنشاء المستخلص لمحاسب المشروع.');
  var bad = function (m) { throw bdwErr_('invalid', m); };
  var key = String(b.key || '');
  if (!/^[\w-]{6,64}$/.test(key)) bad('الطلب ناقص بياناته.');
  var project = String(b.project || ''), kind = b.kind === BDW.CLIENT ? BDW.CLIENT : BDW.SUB, party = String(b.party || '').trim();
  if (!bdwCanSee_(me, project)) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');
  var from = String(b.from || ''), to = String(b.to || ''), today = bdwToday_();
  if (from && !bdwToDate_(from)) bad('بداية الفترة مش مقروءة.');
  if (!bdwToDate_(to)) bad('اختار نهاية الفترة.');
  if (to > today) bad('نهاية الفترة بعد النهارده.');
  if (from && from > to) bad('بداية الفترة بعد نهايتها.');
  var ids = [], seenId = {};
  (Array.isArray(b.qty) ? b.qty : []).forEach(function (q) { q = String(q).trim(); if (q && !seenId[q]) { seenId[q] = 1; ids.push(q); } });
  if (!ids.length) bad('مفيش محاضر معتمدة للمستخلص في الفترة دي.');
  if (ids.length > 1000) bad('المحاضر كتير على مستخلص واحد؛ قسّم الفترة.');
  var adv = Number(b.adv || 0), ded = Number(b.ded || 0);
  if (!(adv >= 0) || !(ded >= 0)) bad('الخصومات لازم تكون أرقام موجبة.');
  var extNo = String(b.extNo || '').trim().slice(0, 30), notes = String(b.notes || '').trim().slice(0, 300).replace(/\n/g, ' ');
  var pt = {};
  bdwRows_(bdwSheet_(BDW.S.parties), 3).forEach(function (r) { pt[String(r.v[0]).trim()] = bdwPartyType_(r.v[2]); });
  if (pt[party] !== kind) bad(kind === BDW.SUB ? 'اختار مقاول باطن من الأطراف.' : 'اختار العميل (الجهة المالكة) من الأطراف.');
  var retPct = 0;
  if (kind === BDW.SUB) {                                   /* نسبة المحتجز من عقد المقاول في المشروع */
    bdwRows_(bdwSheet_(BDW.S.subs), 12).forEach(function (r) {
      if (String(r.v[1]).trim() === project && String(r.v[3]).trim() === party) { var x = bdwNum_(r.v[11]) || 0; if (x > 1) x = x / 100; if (x > retPct) retPct = x; }
    });
  } else {
    retPct = Number(b.retPct || 0); if (retPct > 1) retPct = retPct / 100;
    if (!(retPct >= 0 && retPct <= 0.5)) bad('نسبة المحتجز بين صفر و50%.');
  }
  var seen = bdwLogIndex_().byKey[key];
  if (seen) return { ok: true, id: seen.id, duplicate: true };

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw bdwErr_('busy', 'السكريبت مشغول دلوقتي. جرّب تاني بعد ثواني.');
  try {
    var again = bdwLogIndex_().byKey[key];
    if (again) return { ok: true, id: again.id, duplicate: true };
    var sq = bdwSheet_(BDW.S.qty), Q = BDW.C.qty, byId = {}, col = kind === BDW.CLIENT ? Q.cStmt : Q.sStmt;
    bdwRows_(sq, Q.n).forEach(function (r) { byId[String(r.v[0]).trim()] = r; });
    ids.forEach(function (q) {                              /* كل محضر لازم يكون لسه صالح: ممكن حد سبقك عليه */
      var r = byId[q], why = '';
      if (!r) why = 'مش موجود في الشيت';
      else {
        var v = r.v, iso = bdwIso_(v[Q.date - 1]);
        if (String(v[Q.project - 1]).trim() !== project) why = 'تبع مشروع تاني';
        else if (String(v[Q.status - 1]).trim() !== 'معتمد') why = 'مش معتمد';
        else if (String(v[col - 1] || '').trim()) why = 'دخل المستخلص ' + String(v[col - 1]).trim();
        else if ((from && iso < from) || iso > to) why = 'خارج الفترة';
        else if (kind === BDW.SUB && String(v[Q.sub - 1]).trim() !== party) why = 'مش تبع المقاول ده';
        else if (kind === BDW.CLIENT && !((bdwNum_(v[Q.value - 1]) || 0) > 0)) why = 'مالوش قيمة بسعر الجهاز';
      }
      if (why) throw bdwErr_('conflict', 'المحضر ' + q + ' ' + why + '. حدّث البيانات وجرّب تاني.');
    });
    var sh = bdwSheet_(BDW.S.stmts), C = BDW.C.stmts, row = bdwNextRow_(sh), id = bdwNextId_(sh, kind === BDW.CLIENT ? 'CS-' : 'SS-', 3);
    var note = 'الفترة ' + (from ? 'من ' + from + ' ' : '') + 'إلى ' + to + ' — ' + ids.length + ' محضر — أنشأه ' + me.name + (notes ? ' — ' + notes : '');
    bdwSet_(sh, row, [[C.no, id], [C.kind, kind], [C.project, project], [C.party, party], [C.date, bdwToDate_(today)],
      [C.extNo, extNo || (kind === BDW.SUB ? 'جارٍ' : '')], [C.retPct, retPct], [C.adv, adv], [C.ded, ded], [C.status, 'مسودة'], [C.notes, note]]);
    ids.forEach(function (q) { sq.getRange(byId[q].row, col).setValue(id); });
    bdwLog_(key, id, 'stmt', 'stmtNew', me, { n: ids.length, qty: ids, from: from, to: to });
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}
/* المسودة بتتبعت للمراجعة: الاعتماد الفني من المهندس، وبعده النهائي من المالك */
function bdwStmtSend_(me, b) {
  if (me.role !== 'acc' && me.role !== 'admin') throw bdwErr_('forbidden', 'إرسال المستخلص لمحاسب المشروع.');
  var id = String(b.id || '').trim();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw bdwErr_('busy', 'السكريبت مشغول دلوقتي. جرّب تاني بعد ثواني.');
  try {
    var sh = bdwSheet_(BDW.S.stmts), C = BDW.C.stmts, hit = bdwFindRow_(sh, id, C.n);
    if (!hit) throw bdwErr_('not_found', 'المستخلص ' + id + ' مش موجود في الشيت.');
    if (!bdwCanSee_(me, String(hit.v[C.project - 1]).trim())) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');
    var st0 = String(hit.v[C.status - 1]).trim();
    if (st0 === 'تحت المراجعة') return { ok: true, already: true };
    if (st0 !== 'مسودة') throw bdwErr_('conflict', 'المستخلص ' + id + ' مش مسودة.');
    if (!bdwStmtLinks_(id, String(hit.v[C.kind - 1]).trim()).length) throw bdwErr_('invalid', 'مفيش محاضر مربوطة بالمستخلص.');
    bdwSet_(sh, hit.row, [[C.status, 'تحت المراجعة']]);
    var inf = bdwDocInfo_(bdwLogIndex_().byDoc['stmt|' + id]);
    bdwLog_(inf.submit ? inf.submit.key : 'id:' + id, id, 'stmt', 'stmtSend', me, null);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}
/* المسودة أو المرفوض: المحاضر بترجع فاضية عشان تدخل مستخلص جديد، والمستخلص يفضل في الشيت «مرفوض» بقيمة صفر */
function bdwStmtUnlink_(me, b) {
  if (me.role !== 'acc' && me.role !== 'admin') throw bdwErr_('forbidden', 'فك المحاضر لمحاسب المشروع.');
  var id = String(b.id || '').trim();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw bdwErr_('busy', 'السكريبت مشغول دلوقتي. جرّب تاني بعد ثواني.');
  try {
    var sh = bdwSheet_(BDW.S.stmts), C = BDW.C.stmts, hit = bdwFindRow_(sh, id, C.n);
    if (!hit) throw bdwErr_('not_found', 'المستخلص ' + id + ' مش موجود في الشيت.');
    if (!bdwCanSee_(me, String(hit.v[C.project - 1]).trim())) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');
    var st0 = String(hit.v[C.status - 1]).trim(), kind = String(hit.v[C.kind - 1]).trim();
    if (st0 !== 'مسودة' && st0 !== 'مرفوض') throw bdwErr_('conflict', 'المستخلص ' + id + ' ' + st0 + '؛ فك المحاضر بس للمسودة أو المرفوض.');
    var links = bdwStmtLinks_(id, kind), Q = BDW.C.qty, sq = bdwSheet_(BDW.S.qty), col = kind === BDW.CLIENT ? Q.cStmt : Q.sStmt;
    links.forEach(function (l) { sq.getRange(l.row, col).setValue(''); });
    var line = 'فُكّت محاضره (' + links.length + ') — ' + me.name + ' — ' + bdwToday_();
    bdwSet_(sh, hit.row, [[C.status, 'مرفوض'], [C.notes, line + '\n' + String(hit.v[C.notes - 1] || '')]]);
    var inf = bdwDocInfo_(bdwLogIndex_().byDoc['stmt|' + id]);
    bdwLog_(inf.submit ? inf.submit.key : 'id:' + id, id, 'stmt', 'stmtUnlink', me, { n: links.length, qty: links.map(function (l) { return l.id; }) });
    return { ok: true, n: links.length };
  } finally {
    lock.releaseLock();
  }
}
/* المحاضر المربوطة بمستخلص: مستخلص العميل في خانة، ومستخلص الباطن في خانة تانية */
function bdwStmtLinks_(id, kind) {
  var Q = BDW.C.qty, col = kind === BDW.CLIENT ? Q.cStmt : Q.sStmt, out = [];
  bdwRows_(bdwSheet_(BDW.S.qty), Q.n).forEach(function (r) { if (String(r.v[col - 1] || '').trim() === id) out.push({ id: String(r.v[0]).trim(), row: r.row }); });
  return out;
}

/* ======================= الصور ======================= */

function bdwFolder_() {
  var id = bdwSettings_().folder || PropertiesService.getScriptProperties().getProperty('PHOTOS_FOLDER');
  if (!id) throw bdwErr_('server', 'فولدر صور التطبيق مش متحدد. شغّل setupApi.');
  return DriveApp.getFolderById(id);
}
function bdwSaveImage_(dataUrl, name) {
  var m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw bdwErr_('invalid', 'الصورة مش مقروءة. صوّرها تاني.');
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 6 * 1024 * 1024) throw bdwErr_('invalid', 'الصورة كبيرة جدًا.');
  var ext = m[1] === 'image/png' ? '.png' : m[1] === 'image/webp' ? '.webp' : '.jpg';
  var file = bdwFolder_().createFile(Utilities.newBlob(bytes, m[1], name + ext));
  return 'https://drive.google.com/file/d/' + file.getId() + '/view';
}
/* الصورة بتوصل للتطبيق عن طريق السكريبت، فالفولدر بيفضل خاص. وبس الصور المذكورة في الشيت أو السجل */
function bdwPhoto_(me, id, thumb) {
  id = id.replace(/^drive:/, '');
  if (!/^[\w-]{20,}$/.test(id)) throw bdwErr_('invalid', 'رقم الصورة غلط.');
  if (!bdwKnownPhoto_(id)) throw bdwErr_('forbidden', 'الصورة دي مش تبع مستندات المنظومة.');
  if (thumb) {                                              /* صورة صغيرة لكروت الأرشيف */
    try {
      var rt = UrlFetchApp.fetch('https://drive.google.com/thumbnail?sz=w360&id=' + encodeURIComponent(id),
        { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (rt.getResponseCode() === 200) { var tt = rt.getBlob(); return { ok: true, thumb: true, data: 'data:' + (tt.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(tt.getBytes()) }; }
    } catch (e) { }
  }
  var file = DriveApp.getFileById(id), mime = file.getMimeType();
  if (file.getSize() <= 1500000 && /^image\//.test(mime)) {
    var b = file.getBlob();
    return { ok: true, data: 'data:' + mime + ';base64,' + Utilities.base64Encode(b.getBytes()) };
  }
  try {
    var r = UrlFetchApp.fetch('https://drive.google.com/thumbnail?sz=w1400&id=' + encodeURIComponent(id),
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (r.getResponseCode() === 200) { var tb = r.getBlob(); return { ok: true, data: 'data:' + (tb.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(tb.getBytes()) }; }
  } catch (e) { }
  var th = file.getThumbnail();
  if (!th) throw bdwErr_('not_found', 'الصورة مش متاحة.');
  return { ok: true, data: 'data:image/png;base64,' + Utilities.base64Encode(th.getBytes()) };
}
function bdwKnownPhoto_(id) {
  var cache = CacheService.getScriptCache(), hit = cache.get('ph:' + id);
  if (hit) return hit === '1';
  var found = false, ss = bdwSS_();
  [['permits', 'photo'], ['qty', 'photo'], ['exp', 'photo']].forEach(function (p) {
    if (found) return;
    var sh = ss.getSheetByName(BDW.S[p[0]]); if (!sh || sh.getLastRow() < BDW.FIRST) return;
    var col = BDW.C[p[0]][p[1]];
    sh.getRange(BDW.FIRST, col, sh.getLastRow() - BDW.FIRST + 1, 1).getValues().forEach(function (r) { if (!found && String(r[0]).indexOf(id) >= 0) found = true; });
  });
  if (!found) {
    var shL = ss.getSheetByName(BDW.S.log);
    if (shL && shL.getLastRow() >= BDW.FIRST) shL.getRange(BDW.FIRST, BDW.C.log.details, shL.getLastRow() - BDW.FIRST + 1, 1).getValues()
      .forEach(function (r) { if (!found && String(r[0]).indexOf(id) >= 0) found = true; });
  }
  cache.put('ph:' + id, found ? '1' : '0', 600);
  return found;
}

/* ======================= أرشيف المستندات (5.3) ======================= */

/* كل صفوف المشروع اللي ليها صورة (إذونات، محاضر، مصروفات عهدة) من أي تاريخ، بالأحدث الأول:
   [النوع، الرقم، التاريخ، الوصف، الصورة، الحالة، المفتاح] — الصورة نفسها بتيجي بعد كده من «photo» */
function bdwArchive_(me, b) {
  if (['eng', 'acc', 'owner', 'admin'].indexOf(me.role) < 0) throw bdwErr_('forbidden', 'الأرشيف للمهندس والمكتب.');
  var project = String(b.project || '').trim(), ss = bdwSS_();
  if (!project || !bdwCanSee_(me, project)) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');
  var log = bdwLogIndex_(), pn = {}, inm = {}, out = [];
  bdwRows_(bdwSheet_(BDW.S.parties), 2).forEach(function (r) { pn[String(r.v[0]).trim()] = String(r.v[1]).trim(); });
  bdwRows_(bdwSheet_(BDW.S.items), 2).forEach(function (r) { inm[String(r.v[0]).trim()] = String(r.v[1]).trim(); });
  var each = function (type, label) {
    var sh = ss.getSheetByName(BDW.S[BDW.SHEET_OF[type]]), C = BDW.C[BDW.SHEET_OF[type]];
    if (!sh) return;
    bdwRows_(sh, C.n).forEach(function (r) {
      var v = r.v, id = String(v[0]).trim(), ref = bdwPhotoRef_(v[C.photo - 1]);
      if (!ref || String(v[C.project - 1]).trim() !== project) return;
      var inf = bdwDocInfo_(log.byDoc[type + '|' + id]), st = bdwStatus_(type, v[C.status - 1], inf.last && inf.last.event === 'reject');
      if (!st) return;
      out.push([type, id, bdwIso_(v[C.date - 1]), label(v, C), ref, st, inf.submit ? inf.submit.key : 'id:' + id]);
    });
  };
  var nm = function (m, c) { c = String(c || '').trim(); return m[c] || c; };
  each('permit', function (v, C) { return [nm(pn, v[C.party - 1]), nm(inm, v[C.item - 1])].filter(String).join(' — '); });
  each('qty', function (v, C) { var s = String(v[C.sub - 1] || '').trim(); return [nm(inm, v[C.item - 1]), bdwQtyTxt_(bdwNum_(v[C.qty - 1]) || 0, ''), s ? nm(pn, s) : 'تنفيذ ذاتي'].join(' — '); });
  each('exp', function (v, C) { return [String(v[C.cat - 1] || '').trim(), String(v[C.desc - 1] || '').trim(), bdwMoney_(bdwNum_(v[C.amount - 1]) || 0) + ' ج'].filter(String).join(' — '); });
  out.sort(function (a, b) { return b[2].localeCompare(a[2]) || b[1].localeCompare(a[1]); });
  return { ok: true, items: out.slice(0, 3000) };
}

/* ======================= سجل الإذونات ومصروفات العهدة للعرض على الكمبيوتر (5.2) ======================= */

/* المحاضر والسندات والمستخلصات كاملة في التحميل العادي؛ الإذونات والمصروفات بتيجي من هنا كلها بشكل مختصر:
   إذن: [الرقم، التاريخ، المورد، الصنف، الكمية، السعر، الإجمالي، الحالة، الصورة، المفتاح، المُدخِل]
   مصروف: [الرقم، التاريخ، العهدة، التصنيف، البيان، المبلغ، الحالة، الصورة، المفتاح، المُدخِل] */
function bdwRegister_(me, b) {
  if (['eng', 'acc', 'owner', 'admin'].indexOf(me.role) < 0) throw bdwErr_('forbidden', 'العرض ده للمكتب.');
  var project = String(b.project || '').trim(), type = String(b.type || '');
  if (!project || !bdwCanSee_(me, project)) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');
  if (type !== 'permit' && type !== 'exp') throw bdwErr_('invalid', 'نوع غير معروف.');
  var name = BDW.SHEET_OF[type], C = BDW.C[name], sh = bdwSS_().getSheetByName(BDW.S[name]), log = bdwLogIndex_(), out = [];
  if (sh) bdwRows_(sh, C.n).forEach(function (r) {
    var v = r.v, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== project) return;
    var inf = bdwDocInfo_(log.byDoc[type + '|' + id]), st = bdwStatus_(type, v[C.status - 1], inf.last && inf.last.event === 'reject');
    if (!st) return;
    var key = inf.submit ? inf.submit.key : 'id:' + id, by = inf.submit ? inf.submit.name : String(v[C.by - 1] || '').trim();
    if (type === 'permit') out.push([id, bdwIso_(v[C.date - 1]), String(v[C.party - 1]).trim(), String(v[C.item - 1]).trim(), bdwNum_(v[C.qty - 1]) || 0,
      bdwNum_(v[C.price - 1]), bdwNum_(v[C.total - 1]) || 0, st, bdwPhotoRef_(v[C.photo - 1]), key, by]);
    else out.push([id, bdwIso_(v[C.date - 1]), String(v[C.custody - 1]).trim(), String(v[C.cat - 1] || '').trim(), String(v[C.desc - 1] || '').trim(),
      bdwNum_(v[C.amount - 1]) || 0, st, bdwPhotoRef_(v[C.photo - 1]), key, by]);
  });
  out.sort(function (a, b) { return b[1].localeCompare(a[1]) || b[0].localeCompare(a[0]); });
  return { ok: true, type: type, rows: out };
}

/* ======================= طلب تجديد العهدة ======================= */

function bdwRenew_(me, project) {
  if (me.role !== 'site') throw bdwErr_('forbidden', 'طلب التجديد لماسك العهدة بس.');
  var cu = bdwOpenCustody_(me, project);
  if (!cu) throw bdwErr_('invalid', 'مفيش عهدة مفتوحة باسمك في المشروع ده.');
  bdwLog_('', cu.no, 'custody', 'custodyRenew', me, { project: project, amount: cu.amount, spent: cu.spent, left: cu.left });
  if (bdwSettings_().renewMail) {
    var to = [];
    bdwRows_(bdwSheet_(BDW.S.users), BDW.C.users.n).forEach(function (r) {
      var C = BDW.C.users, role = BDW.ROLE[String(r.v[C.role - 1]).trim()], pr = String(r.v[C.projects - 1] || '').trim();
      if (role === 'acc' && !/^لا/.test(String(r.v[C.active - 1])) && (!pr || pr === 'الكل' || pr.split(/[،,\s]+/).indexOf(project) >= 0)) to.push(String(r.v[C.email - 1]).trim());
    });
    if (to.length) {
      MailApp.sendEmail({ to: to.join(','), subject: 'طلب تجديد عهدة ' + cu.no + ' — ' + me.name,
        body: me.name + ' طالب تجديد العهدة ' + cu.no + ' في المشروع ' + project + '.\n\nقيمة العهدة: ' + cu.amount + ' ج\nالمصروف: ' + cu.spent +
          ' ج\nالمتبقي: ' + cu.left + ' ج\n\nالمصروفات في ورقة «' + BDW.S.exp + '» بملف البيانات.\n— منظومة البديوي' });
    }
  }
  return { ok: true };
}

/* ======================= الإشعارات والملخص اليومي (6.2) ======================= */

/* الإشعارات بالبريد من حساب صاحب السكريبت، والتطبيق نفسه ما بيبعتش حاجة:
   - كل ربع ساعة (bdwNotifyTick): الأحداث الجديدة في «سجل التطبيق» بتتجمّع لكل مستخدم في إيميل واحد:
     اللي بقى مستني قراره، والمرفوض من مستنداته بسببه، وتنبيه المحضر اللي عدّى المقايسة (للمهندس والمالك).
   - كل يوم حوالي 9 مساءً (bdwDailySummary): ملخص اليوم لكل مستخدم مشغّل «الملخص اليومي».
   كل مستخدم يوقف اللي مش عاوزه من «إعداداتي» في التطبيق، والاختيار بيتحفظ في صفّه في «المستخدمين».
   التشغيل: setupNotifications مرة من المحرر، وبعدين مشغّلين (Triggers) من صفحة المشغّلات في المحرر:
   bdwNotifyTick كل 15 دقيقة، وbdwDailySummary كل يوم من 9 لـ10 مساءً. السكريبت نفسه ما بيعملش مشغّلات،
   عشان ما يحتاجش صلاحية جديدة. الإيقاف الكامل: stopNotifications (المشغّلات بتفضل بس ما بتبعتش حاجة). */

function bdwPrefs_(me, b) {
  var pairs = [], C = BDW.C.users;
  if (typeof b.approve === 'boolean') pairs.push([C.approve, b.approve ? 'نعم' : 'لا']);
  if (typeof b.daily === 'boolean') pairs.push([C.daily, b.daily ? 'نعم' : 'لا']);
  if (!pairs.length) throw bdwErr_('invalid', 'مفيش إعداد يتحفظ.');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw bdwErr_('busy', 'السكريبت مشغول دلوقتي. جرّب تاني بعد ثواني.');
  try {
    bdwSet_(bdwSheet_(BDW.S.users), me.row, pairs);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, prefs: bdwUser_({ email: me.email, name: me.name }).prefs };
}

/* كل المستخدمين النشطين بأدوارهم ومشروعاتهم واختياراتهم */
function bdwUsersAll_() {
  var out = [], seen = {}, C = BDW.C.users;
  bdwRows_(bdwSheet_(BDW.S.users), C.n).forEach(function (r) {
    var u = bdwUserRow_(r.v, r.row, null);
    if (!u || !u.email || seen[u.email]) return;
    seen[u.email] = 1; out.push(u);
  });
  return out;
}

/* بيانات كل مشروع زي ما التطبيق بيشوفها، بعين مدير المنظومة */
function bdwBootstraps_() {
  var viewer = { email: '', name: 'منظومة البديوي', role: 'admin', all: true, projects: [] }, out = {};
  bdwRows_(bdwSheet_(BDW.S.projects), 1).forEach(function (r) {
    var c = String(r.v[0]).trim();
    if (!c || out[c]) return;
    try { out[c] = bdwBootstrap_(viewer, c); out[c].code = c; } catch (e) { console.error('bootstrap ' + c + ': ' + e); }
  });
  return out;
}

function bdwPending_(d) { return !!d && (d.status === 'مسجَّل' || (d.type === 'stmt' && d.status === 'تحت المراجعة')); }
/* المستند ده مستني قرار من الدور ده؟ نفس قواعد صندوق الاعتماد */
function bdwAwaits_(d, role, st) {
  if (!bdwPending_(d)) return false;
  var kind = d.type === 'stmt' && !d.techOk ? 'tech' : 'approve';
  return bdwAllowed_(role, d.type, d.status, kind, d.type === 'voucher' ? (Number(d.amount) || 0) : 0,
    { tech: d.techOk ? {} : null, submit: d.byRole ? { role: d.byRole } : null }, st);
}
/* البند عدّى كمية المقايسة؟ كل المحاضر اللي مش ملغية */
function bdwOverBoq_(bs, item) {
  var b = null;
  (bs.boq || []).forEach(function (x) { if (x[0] === item) b = x; });
  if (!b || !(b[3] > 0)) return null;
  var done = 0;
  (bs.qtyAll || []).forEach(function (q) { if (q[2] === item && q[11] !== 'ملغى') done += Number(q[3]) || 0; });
  return done > b[3] ? { item: item, name: b[1], unit: b[2], boq: b[3], done: done, pct: done / b[3] } : null;
}

/* كل ربع ساعة (مشغّل من setupNotifications) */
function bdwNotifyTick() {
  var props = PropertiesService.getScriptProperties(), now = Date.now(), since = 0;
  if (props.getProperty('NOTIFY_OFF') === '1') return 0;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return 0;
  try {
    since = Number(props.getProperty('NOTIFY_SINCE') || 0);
    props.setProperty('NOTIFY_SINCE', String(now));
  } finally {
    lock.releaseLock();
  }
  if (!since) return 0;                                     /* أول مرة: نبدأ من دلوقتي، من غير ما نبعت أحداث قديمة */
  var evs = bdwLogRead_().filter(function (e) { return e.t > since && e.t <= now; });
  return evs.length ? bdwNotifyEvents_(evs) : 0;
}

function bdwNotifyEvents_(evs) {
  var st = bdwSettings_(), users = bdwUsersAll_(), bsBy = bdwBootstraps_(), out = {}, sent = 0, byEmail = {};
  users.forEach(function (u) { byEmail[u.email] = u; });
  var box = function (u) { return out[u.email] || (out[u.email] = { u: u, wait: [], rej: [], boq: [], seen: {} }); };
  var finals = [], finSeen = {};
  var find = function (type, id) {
    for (var c in bsBy) {
      var ds = bsBy[c].docs;
      for (var i = 0; i < ds.length; i++) if (ds[i].type === type && ds[i].id === id) return { d: ds[i], bs: bsBy[c] };
    }
    return null;
  };
  evs.forEach(function (e) {
    var hit = e.type && e.id ? find(e.type, e.id) : null, d = hit && hit.d;
    if (!d) return;
    if ((e.event === 'submit' || e.event === 'resubmit' || e.event === 'stmtSend' || e.event === 'approveTech') && bdwPending_(d)) {
      users.forEach(function (u) {
        if (!u.prefs.approve || u.email === d.by || u.email === e.email || !bdwCanSee_(u, d.project) || !bdwAwaits_(d, u.role, st)) return;
        var bx = box(u);
        if (bx.seen[d.key]) return;
        bx.seen[d.key] = 1; bx.wait.push({ d: d, bs: hit.bs });
      });
    }
    if (e.event === 'approve' && d.type === 'stmt' && (d.status === 'معتمد' || d.status === 'مصروف') && !finSeen[d.id]) { finSeen[d.id] = 1; finals.push(hit); }
    if (e.event === 'reject') {
      var cu = byEmail[String(d.by || '').toLowerCase()];
      if (cu && cu.prefs.approve && cu.email !== e.email) box(cu).rej.push({ d: d, bs: hit.bs, reason: e.d.reason || '', note: e.d.note || '', by: e.name });
    }
    if (d.type === 'qty' && (e.event === 'submit' || e.event === 'resubmit') && d.status !== 'ملغى' && d.status !== 'مرفوض') {
      var over = bdwOverBoq_(hit.bs, d.boq);
      if (over) users.forEach(function (u) {
        if ((u.role !== 'eng' && u.role !== 'owner') || !u.prefs.approve || u.email === e.email || !bdwCanSee_(u, d.project)) return;
        var bx = box(u), k = 'boq|' + d.project + '|' + d.boq;
        if (bx.seen[k]) return;
        bx.seen[k] = 1; bx.boq.push({ d: d, bs: hit.bs, over: over });
      });
    }
  });
  Object.keys(out).forEach(function (em) {
    var bx = out[em];
    if (!bx.wait.length && !bx.rej.length && !bx.boq.length) return;
    if (bdwMail_(em, bdwNotifySubject_(bx), bdwNotifyHtml_(bx, st))) sent++;
  });
  if (finals.length) sent += bdwSendFinals_(finals, users, st);
  return sent;
}

function bdwNotifySubject_(bx) {
  var one = function (x) { return BDW.TYPE_NAME[x.d.type] + ' ' + x.d.id; };
  if (bx.wait.length) return 'مستني قرارك: ' + (bx.wait.length === 1 ? one(bx.wait[0]) : bdwCount_(bx.wait.length, 'doc'));
  if (bx.rej.length) return 'اترفض ' + (bx.rej.length === 1 ? one(bx.rej[0]) : bdwCount_(bx.rej.length, 'doc'));
  return 'تنبيه: ' + bx.boq[0].over.name + ' عدّى كمية المقايسة';
}
function bdwNotifyHtml_(bx, st) {
  var url = st.appUrl, h = '', row = function (x, extra) {
    return '<tr><td style="padding:6px 0;border-bottom:1px solid #E5E7EB"><a href="' + bdwEsc_(url + '#doc/' + encodeURIComponent(x.d.key)) + '" style="color:#14213D;font-weight:bold">' +
      bdwEsc_(BDW.TYPE_NAME[x.d.type] + ' ' + x.d.id) + '</a> <span style="color:#6B7280">— ' + bdwEsc_(bdwDayLabel_(x.d.date)) + '</span><br>' +
      '<span style="color:#374151">' + bdwEsc_(bdwDocLine_(x.d, x.bs)) + '</span>' + (extra ? '<br><span style="color:#9A3412">' + extra + '</span>' : '') + '</td></tr>';
  };
  var table = function (title, rows) { return '<div style="font-weight:bold;margin:14px 0 4px">' + bdwEsc_(title) + '</div><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">' + rows + '</table>'; };
  if (bx.wait.length) h += table('مستني قرارك (' + bx.wait.length + ')', bx.wait.map(function (x) {
    return row(x, x.d.type === 'stmt' ? bdwEsc_(x.d.techOk ? 'الاعتماد الفني تمّ — مستني الاعتماد النهائي' : 'مستني الاعتماد الفني') : '');
  }).join(''));
  if (bx.rej.length) h += table('اترفض من مستنداتك (' + bx.rej.length + ')', bx.rej.map(function (x) {
    return row(x, bdwEsc_('السبب: ' + x.reason + (x.note ? ' — ' + x.note : '') + ' — ' + x.by) + '<br>' + bdwEsc_('عدّله من «سجلاتي» وابعته تاني.'));
  }).join(''));
  if (bx.boq.length) h += table('تنبيه المقايسة', bx.boq.map(function (x) {
    var o = x.over;
    return row(x, bdwEsc_(o.name + ': المنفّذ ' + bdwQtyTxt_(o.done, o.unit) + ' من ' + bdwQtyTxt_(o.boq, o.unit) + ' في المقايسة (' + Math.round(o.pct * 100) + '%)'));
  }).join(''));
  return bdwMailWrap_('أهلًا ' + bx.u.name + '،', h, url);
}

/* كل يوم حوالي 9 مساءً (مشغّل من setupNotifications) */
function bdwDailySummary() {
  if (PropertiesService.getScriptProperties().getProperty('NOTIFY_OFF') === '1') return 0;
  var st = bdwSettings_(), today = bdwToday_(), sent = 0;
  var users = bdwUsersAll_().filter(function (u) { return u.prefs.daily; });
  if (!users.length) return 0;
  var bsBy = bdwBootstraps_();
  users.forEach(function (u) {
    var parts = [], names = [];
    Object.keys(bsBy).forEach(function (c) {
      if (!bdwCanSee_(u, c)) return;
      var s = bdwDay_(bsBy[c], u, st, today);
      if (s) { parts.push(s); names.push(s.name); }
    });
    if (!parts.length) return;
    var title = 'ملخص يوم ' + bdwDayName_(today) + ' ' + bdwDayLabel_(today);
    var html = parts.map(function (p) { return (parts.length > 1 ? '<div style="font-weight:bold;margin:14px 0 4px">' + bdwEsc_(p.name) + '</div>' : '') + p.html; }).join('');
    if (bdwMail_(u.email, title + ' — ' + names.join('، '), bdwMailWrap_(title, html, st.appUrl))) sent++;
  });
  return sent;
}
/* ملخص مشروع واحد في يوم واحد لمستخدم واحد، أو null لو مفيش حاجة تتقال */
function bdwDay_(bs, u, st, today) {
  var code = bs.code, proj = (bs.projects || []).filter(function (p) { return p.code === code; })[0] || { short: code };
  var live = function (d) { return d.status !== 'ملغى' && d.status !== 'مرفوض'; };
  var isToday = function (d) { return d.date === today || bdwIso_(new Date(d.at)) === today; };
  var ds = (bs.docs || []).filter(function (d) { return d.project === code; });
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + (Number(f(x)) || 0); }, 0); };
  var pm = ds.filter(function (d) { return d.type === 'permit' && live(d) && isToday(d); });
  var qt = ds.filter(function (d) { return d.type === 'qty' && live(d) && isToday(d); });
  var ex = ds.filter(function (d) { return d.type === 'exp' && live(d) && isToday(d); });
  var is = ds.filter(function (d) { return d.type === 'issue' && live(d) && isToday(d); });
  var vo = (bs.vouchers || []).filter(function (v) { return v[2] === today && v[10] !== 'ملغى' && v[10] !== 'مرفوض'; });
  var pay = vo.filter(function (v) { return v[1] === 'صرف'; }), rec = vo.filter(function (v) { return v[1] === 'قبض'; });
  var pend = ds.filter(bdwPending_);
  var mine = pend.filter(function (d) { return d.by !== u.email && bdwAwaits_(d, u.role, st); });
  if (!pm.length && !qt.length && !ex.length && !is.length && !vo.length && !pend.length) return null;
  var overs = [], seen = {};
  qt.forEach(function (d) {
    if (seen[d.boq]) return; seen[d.boq] = 1;
    var o = bdwOverBoq_(bs, d.boq);
    if (o) overs.push(d.boq + ': ' + Math.round(o.pct * 100) + '%');
  });
  var money = function (n) { return bdwMoney_(n) + ' ج'; }, none = 'مفيش';
  var oldest = pend.reduce(function (m, d) { return Math.min(m, d.at || Date.now()); }, Date.now()), days = Math.floor((Date.now() - oldest) / 864e5);
  var rows = [
    ['التوريدات', pm.length ? bdwCount_(pm.length, 'permit') + ' — ' + money(sum(pm, function (d) { return d.price ? d.qty * d.price : 0; })) : none],
    ['الكميات', qt.length ? bdwCount_(qt.length, 'qty') + (overs.length ? ' — ' + (overs.length === 1 ? 'واحد بيعدّي' : overs.length + ' بيعدّوا') + ' المقايسة (' + overs.join('، ') + ')' : '') : none],
    ['المصروفات', pay.length ? bdwCount_(pay.length, 'voucher') + ' — ' + money(sum(pay, function (v) { return v[5]; })) : none]
  ];
  if (rec.length) rows.push(['المقبوض', bdwCount_(rec.length, 'voucher') + ' — ' + money(sum(rec, function (v) { return v[5]; }))]);
  if (ex.length) rows.push(['مصروفات العهدة', bdwCount_(ex.length, 'exp') + ' — ' + money(sum(ex, function (d) { return d.amount; }))]);
  if (is.length) rows.push(['صرف المخزن', bdwCount_(is.length, 'issue')]);
  rows.push(['بانتظار الاعتماد', pend.length ? bdwCount_(pend.length, 'doc') + ' — ' + 'أقدمها بقاله ' + (days > 0 ? bdwCount_(days, 'day') : 'أقل من يوم') : none]);
  if (u.role !== 'site') rows.push(['بانتظار قرارك', mine.length ? mine.slice(0, 8).map(function (d) { var a = bdwDocAmount_(d); return d.id + (a ? ' — ' + money(a) : ''); }).join('، ') +
    (mine.length > 8 ? '، و' + (mine.length - 8) + ' كمان' : '') : none]);
  var html = '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">' + rows.map(function (r) {
    return '<tr><td style="padding:6px 0 6px 12px;border-bottom:1px solid #E5E7EB;color:#6B7280;white-space:nowrap;vertical-align:top">' + bdwEsc_(r[0]) +
      '</td><td style="padding:6px 0;border-bottom:1px solid #E5E7EB;font-weight:bold">' + bdwEsc_(r[1]) + '</td></tr>';
  }).join('') + '</table>';
  return { name: proj.short || proj.name || code, html: html };
}

/* ---- أدوات الإيميل ---- */
function bdwMail_(to, subject, html, attachments) {
  try {
    var o = { to: to, subject: subject, htmlBody: html, body: bdwHtmlText_(html), name: 'منظومة البديوي' };
    if (attachments && attachments.length) o.attachments = attachments;
    MailApp.sendEmail(o);
    return true;
  } catch (e) {
    console.error('mail ' + to + ': ' + e);
    return false;
  }
}
function bdwMailWrap_(title, inner, url) {
  return '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.8;color:#14213D;max-width:560px;text-align:right">' +
    '<div style="font-size:16px;font-weight:bold;margin:0 0 6px">' + bdwEsc_(title) + '</div>' + inner +
    '<p style="margin:18px 0 6px"><a href="' + bdwEsc_(url + '#inbox') + '" style="background:#14213D;color:#FFFFFF;text-decoration:none;padding:8px 18px;border-radius:8px;display:inline-block">افتح التطبيق</a></p>' +
    '<p style="color:#6B7280;font-size:12px;margin:10px 0 0">الإيميلات دي بتتوقف من «إعداداتي» في التطبيق. — منظومة البديوي</p></div>';
}
function bdwHtmlText_(html) {
  return String(html).replace(/<a [^>]*href="([^"]*)"[^>]*>افتح التطبيق<\/a>/g, 'افتح التطبيق: $1').replace(/<br\s*\/?>/g, '\n').replace(/<\/(tr|div|p|table)>/g, '\n')
    .replace(/<\/td><td[^>]*>/g, ': ').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function bdwEsc_(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function bdwMoney_(n) {
  n = Math.round(Number(n) || 0);
  var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? '(' + s + ')' : s;
}
function bdwQtyTxt_(q, unit) { var n = Math.round((Number(q) || 0) * 100) / 100; return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (unit ? ' ' + unit : ''); }
var BDW_NOUN = { permit: ['إذن', 'إذنين', 'إذونات'], qty: ['محضر', 'محضرين', 'محاضر'], voucher: ['سند', 'سندين', 'سندات'], exp: ['مصروف', 'مصروفين', 'مصروفات'],
  issue: ['إذن صرف', 'إذنين صرف', 'أذونات صرف'], count: ['جرد', 'جردين', 'عمليات جرد'],
  doc: ['مستند', 'مستندين', 'مستندات'], day: ['يوم', 'يومين', 'أيام'] };
function bdwCount_(n, k) { var w = BDW_NOUN[k]; return n === 1 ? w[0] + ' واحد' : n === 2 ? w[1] : n + ' ' + (n <= 10 ? w[2] : w[0]); }
var BDW_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function bdwDayLabel_(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Number(m[3]) + ' ' + BDW_MONTHS[Number(m[2]) - 1] : ''; }
function bdwDayName_(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : '';
}
function bdwNames_(bs) {
  if (bs._names) return bs._names;
  var n = { party: {}, item: {}, unit: {} };
  (bs.parties || []).forEach(function (p) { n.party[p[0]] = p[1]; });
  (bs.items || []).concat(bs.subItems || []).forEach(function (i) { n.item[i[0]] = i[1]; n.unit[i[0]] = i[2]; });
  (bs.boq || []).forEach(function (b) { n.item[b[0]] = b[1]; n.unit[b[0]] = b[2]; });
  return (bs._names = n);
}
function bdwDocAmount_(d) {
  if (d.type === 'permit') return d.price ? d.qty * d.price : 0;
  if (d.type === 'stmt') return d.net || 0;
  return d.amount || 0;
}
function bdwDocLine_(d, bs) {
  var nm = bdwNames_(bs), money = function (n) { return bdwMoney_(n) + ' ج'; };
  if (d.type === 'permit') return [nm.party[d.party] || d.party, nm.item[d.item] || d.item, bdwQtyTxt_(d.qty, nm.unit[d.item]), d.price ? money(d.qty * d.price) : 'بدون سعر'].filter(String).join(' — ');
  if (d.type === 'qty') return [nm.item[d.boq] || d.boq, bdwQtyTxt_(d.qty, nm.unit[d.boq]), d.exec && d.exec !== 'ذاتي' ? (nm.party[d.exec] || d.exec) : 'تنفيذ ذاتي'].join(' — ');
  if (d.type === 'exp') return [d.cat, d.desc, money(d.amount)].filter(String).join(' — ');
  if (d.type === 'voucher') return [nm.party[d.party] || d.party || '', money(d.amount), d.notes].filter(String).join(' — ');
  if (d.type === 'stmt') return [(d.kind === BDW.CLIENT ? 'عميل: ' : 'مقاول باطن: ') + (nm.party[d.party] || d.party), 'الصافي ' + money(d.net)].join(' — ');
  if (d.type === 'issue') return [nm.item[d.item] || d.item, bdwQtyTxt_(d.qty, nm.unit[d.item]), d.exec && d.exec !== 'ذاتي' ? 'إلى ' + (nm.party[d.exec] || d.exec) : 'تنفيذ ذاتي'].join(' — ');
  if (d.type === 'count') return [nm.item[d.item] || d.item, 'العدد الفعلي ' + bdwQtyTxt_(d.counted, nm.unit[d.item]),
    d.qty ? (d.qty > 0 ? 'زيادة ' : 'عجز ') + bdwQtyTxt_(Math.abs(d.qty), nm.unit[d.item]) : 'مطابق للدفتري'].join(' — ');
  return '';
}

/* ---- التشغيل والإيقاف (من المحرر) ---- */
function setupNotifications() {
  var ss = bdwSS_(), props = PropertiesService.getScriptProperties(), C = BDW.C.users;
  var sh = ss.getSheetByName(BDW.S.users);
  if (!sh) throw new Error('شغّل setupApi الأول.');
  if (!String(sh.getRange(3, C.approve).getValue()).trim()) {
    sh.getRange(3, C.approve, 1, 2).setValues([['إشعارات الاعتماد', 'الملخص اليومي']]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#14213D').setHorizontalAlignment('center').setWrap(true);
    sh.setColumnWidth(C.approve, 120); sh.setColumnWidth(C.daily, 110);
  }
  sh.getRange(BDW.FIRST, C.approve, 500, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['نعم', 'لا'], true).setAllowInvalid(false).build());
  var set = ss.getSheetByName(BDW.S.settings);
  if (set && !bdwRows_(set, 1).some(function (r) { return String(r.v[0]).trim() === BDW.SET.appUrl; })) {
    set.getRange(bdwNextRow_(set), 1, 1, 3).setValues([[BDW.SET.appUrl, BDW.APP_URL, 'الرابط اللي بيتحط في إيميلات الإشعارات والملخص اليومي.']]);
  }
  props.setProperty('NOTIFY_SINCE', String(Date.now()));
  props.setProperty('NOTIFY_OFF', '');
  var msg = 'الإشعارات جاهزة. فاضل مشغّلين من صفحة المشغّلات (الساعة على الشمال) ← Add Trigger:\n' +
    '1) bdwNotifyTick — Time-driven — Minutes timer — Every 15 minutes.\n2) bdwDailySummary — Time-driven — Day timer — 9pm to 10pm.\n\n' +
    'كل مستخدم يوقف اللي مش عاوزه من «إعداداتي» في التطبيق، أو من عمودي «إشعارات الاعتماد» و«الملخص اليومي» في «' + BDW.S.users + '».\n' +
    'وللإيقاف الكامل: شغّل stopNotifications.';
  try { SpreadsheetApp.getUi().alert('الإشعارات ✅', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { console.log(msg); }
}
function stopNotifications() {
  PropertiesService.getScriptProperties().setProperty('NOTIFY_OFF', '1');
  var msg = 'وقفت الإشعارات والملخص اليومي. للتشغيل تاني: setupNotifications.';
  try { SpreadsheetApp.getUi().alert('الإشعارات', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { console.log(msg); }
}

/* ======================= PDF المستخلص والبريد (6.1) ======================= */

/* المستخلص بيتكتب في ورقة «طباعة المستخلص» جوه ملف البيانات، والشيت بيصدّرها PDF بحجم A4 (العربي واتجاهه مظبوطين).
   الاعتماد النهائي: الـPDF بيتحفظ في فولدر «مستخلصات PDF» ويتبعت بالبريد للمالك ومحاسب المشروع مع أول ربع ساعة.
   وزرار «PDF المستخلص» في التطبيق بيطلع نفس الملف لأي مستخلص مش ملغى، وعليه حالته. */
function bdwStmtPdfAct_(me, b) {
  if (['eng', 'acc', 'owner', 'admin'].indexOf(me.role) < 0) throw bdwErr_('forbidden', 'الـPDF للمكتب والمهندس والمالك.');
  var id = String(b.id || '').trim(), C = BDW.C.stmts, hit = bdwFindRow_(bdwSheet_(BDW.S.stmts), id, C.n);
  if (!hit) throw bdwErr_('not_found', 'المستخلص ' + id + ' مش موجود في الشيت.');
  var project = String(hit.v[C.project - 1]).trim();
  if (!bdwCanSee_(me, project)) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');
  var bs = bdwBootstrap_(me, project);
  bs.code = project;
  var d = bs.docs.filter(function (x) { return x.type === 'stmt' && x.id === id; })[0];
  if (!d || d.status === 'ملغى') throw bdwErr_('invalid', 'المستخلص ده ملغى، ومالوش PDF.');
  var lock = LockService.getScriptLock(), blob = null;
  if (!lock.tryLock(30000)) throw bdwErr_('busy', 'السكريبت مشغول دلوقتي. جرّب تاني بعد ثواني.');
  try { blob = bdwStmtPdf_(bs, d); } finally { lock.releaseLock(); }
  return { ok: true, name: blob.getName(), data: Utilities.base64Encode(blob.getBytes()) };
}

/* بنود المستخلص من المحاضر المربوطة بيه، متجمّعة بالبند والفئة */
function bdwStmtLines_(bs, d) {
  var client = d.kind === BDW.CLIENT, col = client ? 9 : 10, by = {}, order = [];
  (bs.qtyAll || []).forEach(function (q) {
    if (q[col] !== d.id) return;
    var rate = client ? q[4] : q[7], k = q[2] + '|' + rate;
    if (!by[k]) { by[k] = { item: q[2], rate: rate, qty: 0, value: 0, n: 0 }; order.push(k); }
    by[k].qty += Number(q[3]) || 0; by[k].value += Number(client ? q[5] : q[8]) || 0; by[k].n++;
  });
  return order.map(function (k) { return by[k]; });
}

function bdwStmtPdf_(bs, d) {
  var ss = bdwSS_(), sh = ss.getSheetByName(BDW.S.print), W = 6;
  if (!sh) {
    sh = ss.insertSheet(BDW.S.print, ss.getNumSheets());
    try { sh.protect().setDescription('ورقة طباعة المستخلص — السكريبت بيكتب فيها').setWarningOnly(true); } catch (e) { }
  }
  sh.setRightToLeft(true);
  var nm = bdwNames_(bs), client = d.kind === BDW.CLIENT, L = bdwStmtLines_(bs, d), tz = bdwTz_();
  var proj = (bs.projects || []).filter(function (p) { return p.code === d.project; })[0] || { name: d.project };
  var day = function (t) { return t ? Utilities.formatDate(new Date(t), tz, 'yyyy-MM-dd') : ''; };
  var rows = [], kinds = [];
  var add = function (r, kind) { r = r.slice(); while (r.length < W) r.push(''); rows.push(r); kinds.push(kind || ''); };
  add(['مؤسسة محمد بديوي للإنشاءات ورصف الطرق'], 'org');
  add([(client ? 'مستخلص أعمال مقدَّم للعميل' : 'مستخلص أعمال مقاول باطن') + ' رقم ' + d.id + (d.extNo && d.extNo !== 'جارٍ' ? ' — رقم ' + d.extNo + ' لدى الجهة' : ' — جارٍ')], 'title');
  add(['المشروع: ' + (proj.name || d.project)], 'wide');
  add([(client ? 'العميل: ' : 'المقاول: ') + (nm.party[d.party] || d.party), '', '', 'التاريخ: ' + d.date, '', 'الحالة: ' + d.status], 'meta');
  add([''], 'gap');
  add(['م', 'البند', 'الوحدة', 'الكمية', 'الفئة', 'القيمة'], 'head');
  L.forEach(function (g, i) { add([i + 1, nm.item[g.item] || g.item, nm.unit[g.item] || '', g.qty, g.rate === null || g.rate === undefined ? 'بلا فئة' : g.rate, g.value], 'line'); });
  if (!L.length) add(['', d.works ? 'بنود المستخلص مش مربوطة بمحاضر في المنظومة (مرحَّل من ملف الشركة).' : 'مفيش محاضر مربوطة بالمستخلص.'], 'note');
  add([''], 'gap');
  add(['', '', '', '', 'إجمالي الأعمال', d.works || 0], 'tot');
  if (d.plus) add(['', '', '', '', 'إضافات / تعلية', d.plus], 'tot');
  add(['', '', '', '', 'المحتجز' + (d.retPct ? ' (' + Math.round(d.retPct * 1000) / 10 + '%)' : ''), -(d.ret || 0)], 'tot');
  if (d.adv) add(['', '', '', '', 'استرداد دفعة مقدمة', -d.adv], 'tot');
  if (d.ded) add(['', '', '', '', 'خصومات أخرى', -d.ded], 'tot');
  add(['', '', '', '', 'الصافي المستحق', d.net || 0], 'net');
  add([''], 'gap');
  var final = d.status === 'معتمد' || d.status === 'مصروف';
  add(['الاعتماد الفني: ' + (d.techOk || final ? (d.techBy || '—') + (d.techAt ? ' — ' + day(d.techAt) : '') : 'لسه'), '', '',
    'الاعتماد النهائي: ' + (final ? (d.decidedBy || '—') + (d.decidedAt ? ' — ' + day(d.decidedAt) : '') : 'لسه')], 'appr');
  add([''], 'gap');
  add(['المحاسب', '', 'المهندس', '', 'المالك'], 'sign');
  add(['....................', '', '....................', '', '....................'], 'sign');
  add(['أُنشئ من منظومة البديوي — ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm')], 'foot');

  sh.getRange(1, 1, Math.max(sh.getMaxRows(), rows.length), W).breakApart();
  sh.clear();
  var all = sh.getRange(1, 1, rows.length, W);
  all.setValues(rows).setFontFamily('Cairo').setFontSize(10).setFontColor('#14213D').setVerticalAlignment('middle').setHorizontalAlignment('right').setWrap(true);
  [36, 250, 64, 84, 110, 116].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  var grid = SpreadsheetApp.BorderStyle.SOLID, firstLine = 0, lastLine = 0;
  kinds.forEach(function (k, i) {
    var r = i + 1, row = sh.getRange(r, 1, 1, W);
    if (k === 'org') row.merge().setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
    else if (k === 'title') row.merge().setFontSize(12).setFontWeight('bold').setHorizontalAlignment('center');
    else if (k === 'wide') row.merge().setHorizontalAlignment('center');
    else if (k === 'meta') { sh.getRange(r, 1, 1, 3).merge(); sh.getRange(r, 4, 1, 2).merge(); row.setFontWeight('bold'); }
    else if (k === 'head') row.setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#14213D').setHorizontalAlignment('center');
    else if (k === 'line') { if (!firstLine) firstLine = r; lastLine = r; }
    else if (k === 'note') sh.getRange(r, 2, 1, W - 1).merge().setFontColor('#6B7280');
    else if (k === 'tot') { sh.getRange(r, 5).setFontWeight('bold'); sh.getRange(r, 6).setNumberFormat('#,##0;(#,##0)'); }
    else if (k === 'net') { sh.getRange(r, 5, 1, 2).setFontWeight('bold').setFontSize(11).setBackground('#EEF2F7'); sh.getRange(r, 6).setNumberFormat('#,##0;(#,##0)'); }
    else if (k === 'appr') { sh.getRange(r, 1, 1, 3).merge(); sh.getRange(r, 4, 1, 3).merge(); }
    else if (k === 'sign') { sh.getRange(r, 1, 1, 2).merge(); sh.getRange(r, 3, 1, 2).merge(); sh.getRange(r, 5, 1, 2).merge(); row.setHorizontalAlignment('center'); }
    else if (k === 'foot') row.merge().setFontSize(8).setFontColor('#6B7280').setHorizontalAlignment('center');
  });
  var head = kinds.indexOf('head') + 1;
  if (firstLine) {
    sh.getRange(firstLine, 4, lastLine - firstLine + 1, 2).setNumberFormat('#,##0.##');
    sh.getRange(firstLine, 6, lastLine - firstLine + 1, 1).setNumberFormat('#,##0');
    sh.getRange(firstLine, 1, lastLine - firstLine + 1, 1).setHorizontalAlignment('center');
  }
  sh.getRange(head, 1, (lastLine || head) - head + 1, W).setBorder(true, true, true, true, true, true, '#94A3B8', grid);
  SpreadsheetApp.flush();

  var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&gid=' + sh.getSheetId() + '&range=' + encodeURIComponent('A1:F' + rows.length) +
    '&size=A4&portrait=true&fitw=true&gridlines=false&printtitle=false&sheetnames=false&pagenum=UNDEFINED&fzr=false&horizontal_alignment=CENTER' +
    '&top_margin=0.6&bottom_margin=0.6&left_margin=0.5&right_margin=0.5';
  var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw bdwErr_('server', 'الـPDF ما اتعملش دلوقتي. جرّب تاني بعد دقيقة.');
  return res.getBlob().setName('مستخلص ' + d.id + ' — ' + (nm.party[d.party] || d.party) + ' — ' + d.date + '.pdf');
}

/* فولدر «مستخلصات PDF» جنب ملف البيانات (بيتعمل أول مرة) */
function bdwPdfFolder_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('STMT_PDF_FOLDER'), f = null;
  if (id) { try { f = DriveApp.getFolderById(id); } catch (e) { f = null; } }
  if (!f) {
    f = DriveApp.createFolder('مستخلصات PDF — منظومة البديوي');
    try { var parent = DriveApp.getFileById(bdwSS_().getId()).getParents(); if (parent.hasNext()) f.moveTo(parent.next()); } catch (e) { }
    props.setProperty('STMT_PDF_FOLDER', f.getId());
  }
  return f;
}

/* مع ربع الساعة: كل مستخلص اتعتمد نهائي يطلع PDF يتحفظ ويتبعت للمالك ومحاسب المشروع */
function bdwSendFinals_(finals, users, st) {
  var sent = 0;
  finals.forEach(function (f) {
    var x = f.d, blob = null, lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) return;
    try { blob = bdwStmtPdf_(f.bs, x); } catch (err) { console.error('pdf ' + x.id + ': ' + (err && err.message || err)); } finally { lock.releaseLock(); }
    if (!blob) return;
    try { bdwPdfFolder_().createFile(blob); } catch (err) { console.error('pdf folder: ' + err); }
    var nm = bdwNames_(f.bs), party = nm.party[x.party] || x.party;
    users.forEach(function (u) {
      if ((u.role !== 'owner' && u.role !== 'acc') || !u.prefs.approve || !bdwCanSee_(u, x.project)) return;
      var html = '<p style="margin:6px 0">' + bdwEsc_('المستخلص ' + x.id + ' (' + (x.kind === BDW.CLIENT ? 'العميل' : 'مقاول باطن') + ': ' + party + ') اتعتمد نهائي' +
        (x.decidedBy ? ' من ' + x.decidedBy : '') + (x.decidedAt ? ' يوم ' + bdwDayLabel_(bdwIso_(new Date(x.decidedAt))) : '') + '.') + '</p>' +
        '<p style="margin:6px 0;font-weight:bold">' + bdwEsc_('الصافي المستحق: ' + bdwMoney_(x.net) + ' ج') + '</p>' +
        '<p style="margin:6px 0">' + bdwEsc_('الـPDF مرفق، ونسخة منه محفوظة في فولدر «مستخلصات PDF».') + '</p>';
      if (bdwMail_(u.email, 'اتعتمد نهائي: مستخلص ' + x.id + ' — ' + party, bdwMailWrap_('أهلًا ' + u.name + '،', html, st.appUrl), [blob])) sent++;
    });
  });
  return sent;
}

/* ======================= الإعداد (يتشغّل مرة من المحرر) ======================= */

function setupApi() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), props = PropertiesService.getScriptProperties();
  props.setProperty('SS_ID', ss.getId());
  var me = Session.getEffectiveUser().getEmail(), made = [];
  var mk = function (name, title, hint, heads, widths) {
    var sh = ss.getSheetByName(name);
    if (sh) return sh;
    sh = ss.insertSheet(name, ss.getNumSheets());
    sh.setRightToLeft(true);
    sh.getRange(1, 1).setValue('مؤسسة محمد بديوي للإنشاءات ورصف الطرق   |   ' + title).setFontWeight('bold').setFontSize(13).setFontColor('#14213D');
    sh.getRange(2, 1).setValue(hint).setFontColor('#5B6472').setFontSize(10);
    sh.getRange(3, 1, 1, heads.length).setValues([heads]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#14213D').setHorizontalAlignment('center').setWrap(true);
    sh.setFrozenRows(3);
    widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    made.push(name);
    return sh;
  };
  var list = function (sh, col, values) {
    sh.getRange(BDW.FIRST, col, 500, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build());
  };

  var users = mk(BDW.S.users, '👤 مستخدمو التطبيق', 'مين يدخل التطبيق ودوره. الإيميل لازم يكون حساب جوجل اللي هيدخل بيه. المشروعات: «الكل» أو أكواد مفصولة بفاصلة.',
    ['الإيميل', 'الاسم', 'الدور', 'المشروعات', 'نشط', 'ملاحظات'], [230, 160, 130, 140, 70, 220]);
  list(users, 3, Object.keys(BDW.ROLE)); list(users, 5, ['نعم', 'لا']);
  if (users.getLastRow() < BDW.FIRST) users.getRange(BDW.FIRST, 1, 1, 6).setValues([[me, 'مدير المنظومة', 'مدير المنظومة', 'الكل', 'نعم', 'مضاف من الإعداد؛ اكتب اسمك']]);

  var set = mk(BDW.S.settings, '⚙️ إعدادات التطبيق', 'القيم دي التطبيق بيقراها مع كل تحديث. موقع كل مشروع: خط العرض، خط الطول (من خرائط جوجل).',
    ['البند', 'القيمة', 'شرح'], [260, 220, 420]);
  var folder = null, fid = props.getProperty('PHOTOS_FOLDER');
  if (fid) { try { folder = DriveApp.getFolderById(fid); } catch (e) { folder = null; } }
  if (!folder) {
    folder = DriveApp.createFolder('صور تطبيق منظومة البديوي');
    var parent = DriveApp.getFileById(ss.getId()).getParents();
    if (parent.hasNext()) folder.moveTo(parent.next());
    props.setProperty('PHOTOS_FOLDER', folder.getId());
  }
  if (set.getLastRow() < BDW.FIRST) {
    var rows = [
      [BDW.SET.limit, 50000, 'السند لحد المبلغ ده يعتمده محاسب المشروع، وفوقه المالك.'],
      [BDW.SET.pricePct, 0.05, 'لو سعر الإذن اختلف عن آخر سعر معتمد بأكتر من النسبة دي يظهر تنبيه للمراجع.'],
      [BDW.SET.late, 3, 'المستند اللي عدّى الأيام دي من غير قرار يظهر بالأحمر.'],
      [BDW.SET.radius, 2, 'التسجيل من أبعد من المسافة دي عن موقع المشروع يظهر تنبيه.'],
      [BDW.SET.renewMail, 'نعم', 'يبعت إيميل لمحاسب المشروع لما ماسك العهدة يطلب تجديدها.'],
      [BDW.SET.folder, 'https://drive.google.com/drive/folders/' + folder.getId(), 'الصور بتتحفظ هنا، والتطبيق بيعرضها عن طريق السكريبت بس.']
    ];
    bdwRows_(ss.getSheetByName(BDW.S.projects), 1).forEach(function (r) {
      rows.push([BDW.SET.site + String(r.v[0]).trim(), '', 'خط العرض، خط الطول لموقع المشروع.']);
    });
    set.getRange(BDW.FIRST, 1, rows.length, 3).setValues(rows);
    set.getRange(BDW.FIRST + 1, 2).setNumberFormat('0%');
  }

  var cu = mk(BDW.S.custody, '👛 العهد', 'كل عهدة مفتوحة باسم ماسكها. لما تتقفل اكتب «مقفولة» وافتح عهدة جديدة في صف جديد.',
    ['رقم العهدة', 'كود المشروع', 'إيميل الماسك', 'المبلغ', 'تاريخ الصرف', 'من', 'الحالة', 'ملاحظات'], [100, 100, 230, 110, 110, 100, 90, 220]);
  list(cu, 7, ['مفتوحة', 'مقفولة']); list(cu, 6, ['الخزينة', 'البنك']);
  cu.getRange(BDW.FIRST, 5, 500, 1).setNumberFormat('yyyy-mm-dd'); cu.getRange(BDW.FIRST, 4, 500, 1).setNumberFormat('#,##0');

  var ex = mk(BDW.S.exp, '🧾 مصروفات العهدة', 'بتتسجّل من التطبيق. لسه مش بتترحّل في اليومية لحد ما نتفق على قيدها.',
    ['رقم المصروف', 'التاريخ', 'كود المشروع', 'رقم العهدة', 'التصنيف', 'البيان', 'المبلغ', 'الحالة', 'رابط الإيصال', 'المُدخِل', 'ملاحظات'],
    [100, 100, 100, 100, 90, 240, 100, 90, 200, 130, 220]);
  list(ex, 8, ['مسجَّل', 'معتمد', 'ملغى']); list(ex, 5, BDW.CATS);
  ex.getRange(BDW.FIRST, 2, 1000, 1).setNumberFormat('yyyy-mm-dd'); ex.getRange(BDW.FIRST, 7, 1000, 1).setNumberFormat('#,##0');

  var lg = mk(BDW.S.log, '📱 سجل التطبيق', 'كل تسجيل وقرار من التطبيق. السكريبت بيكتب هنا، متعدّلش فيه.',
    ['الوقت', 'المفتاح', 'رقم المستند', 'النوع', 'الحدث', 'الإيميل', 'الاسم', 'الدور', 'التفاصيل'], [150, 150, 100, 70, 100, 210, 130, 70, 360]);
  lg.getRange(BDW.FIRST, 1, 5000, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  if (made.indexOf(BDW.S.log) >= 0) lg.protect().setDescription('سجل التطبيق').setWarningOnly(true);

  var msg = made.length ? 'اتعملت الأوراق: ' + made.join('، ') + '.' : 'كل الأوراق موجودة.';
  msg += '\n\nالخطوة الجاية: املأ «' + BDW.S.users + '»، واكتب موقع المشروع في «' + BDW.S.settings + '»، وبعدين انشر السكريبت كتطبيق ويب.';
  try { SpreadsheetApp.getUi().alert('إعداد ربط التطبيق ✅', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { console.log(msg); }
}

/* ======================= مخزن الموقع: الإعداد (يتشغّل مرة من المحرر) ======================= */

/* بتعمل ورقة «حركة المخزن» لو مش موجودة، وبتزوّد في «إعدادات التطبيق» سطر «بداية المخزن» لكل مشروع و«أصناف خارج المخزن»
   و«تنبيه قرب نفاد المادة» لو مش موجودين. ما بتغيّرش أي حاجة موجودة، فتشغيلها تاني آمن.
   المخزن بيشتغل للمشروع من التاريخ اللي يتكتب قدام «بداية المخزن»: الإذونات قبله مش داخلة، وأول حركة لكل صنف جرد افتتاحي بالرصيد الفعلي. */
function setupStore() {
  var ss = bdwSS_(), made = '', C = BDW.C.store, sh = ss.getSheetByName(BDW.S.store);
  if (!sh) {
    sh = ss.insertSheet(BDW.S.store, ss.getNumSheets());
    sh.setRightToLeft(true);
    sh.getRange(1, 1).setValue('مؤسسة محمد بديوي للإنشاءات ورصف الطرق   |   📦 حركة المخزن').setFontWeight('bold').setFontSize(13).setFontColor('#14213D');
    sh.getRange(2, 1).setValue('بتتسجّل من التطبيق: صرف مواد للتنفيذ وجرد. الوارد من «' + BDW.S.permits + '». الرصيد = الوارد − المنصرف ± فروق الجرد. في الجرد «الكمية» هي الفرق.')
      .setFontColor('#5B6472').setFontSize(10);
    var heads = ['رقم الحركة', 'التاريخ', 'كود المشروع', 'النوع', 'كود الصنف', 'اسم الصنف', 'الوحدة', 'الكمية', 'العدد الفعلي', 'المستلم', 'بند المقايسة', 'الحالة', 'رابط الصورة', 'المُدخِل', 'ملاحظات'];
    sh.getRange(3, 1, 1, heads.length).setValues([heads]).setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#14213D').setHorizontalAlignment('center').setWrap(true);
    sh.setFrozenRows(3);
    [100, 100, 100, 100, 90, 240, 70, 90, 90, 110, 100, 90, 200, 130, 220].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
    var list = function (col, values) { sh.getRange(BDW.FIRST, col, 2000, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build()); };
    list(C.kind, [BDW.STORE_KIND.issue, BDW.STORE_KIND.count]); list(C.status, ['مسجَّل', 'معتمد', 'ملغى']);
    sh.getRange(BDW.FIRST, C.date, 2000, 1).setNumberFormat('yyyy-mm-dd');
    sh.getRange(BDW.FIRST, C.qty, 2000, 2).setNumberFormat('#,##0.###');
    made = 'اتعملت ورقة «' + BDW.S.store + '». ';
  }
  var set = bdwSheet_(BDW.S.settings), have = {}, rows = [];
  bdwRows_(set, 1).forEach(function (r) { have[String(r.v[0]).trim()] = 1; });
  bdwRows_(bdwSheet_(BDW.S.projects), 1).forEach(function (r) {
    var k = BDW.SET.storeStart + String(r.v[0]).trim();
    if (!have[k]) rows.push([k, '', 'تاريخ بداية المخزن للمشروع (yyyy-mm-dd). فاضي = المخزن مقفول. الإذونات قبله مش داخلة؛ أول حركة لكل صنف جرد افتتاحي.']);
  });
  if (!have[BDW.SET.storeOut]) rows.push([BDW.SET.storeOut, '', 'أكواد أصناف أو أسماء فئات بتتصرف أول ما توصل (زي الخرسانة الجاهزة)، مفصولة بفاصلة. مش بتظهر في المخزن.']);
  if (!have[BDW.SET.storeLow]) rows.push([BDW.SET.storeLow, 0.1, 'الصنف يظهر «قرب يخلص» لما رصيده يقل عن النسبة دي من الوارد.']);
  if (rows.length) {
    var r0 = bdwNextRow_(set);
    set.getRange(r0, 1, rows.length, 3).setValues(rows);
    rows.forEach(function (x, i) { if (x[0] === BDW.SET.storeLow) set.getRange(r0 + i, 2).setNumberFormat('0%'); });
  }
  var msg = made + (rows.length ? 'اتضاف ' + (rows.length === 1 ? 'سطر واحد' : rows.length === 2 ? 'سطرين' : rows.length + ' سطور') + ' في «' + BDW.S.settings + '».' : 'إعدادات المخزن موجودة.') +
    '\n\nالخطوة الجاية: اكتب تاريخ «' + BDW.SET.storeStart.trim() + '» للمشروع، و«' + BDW.SET.storeOut + '» لو فيه، وبعدين سجّل جرد افتتاحي لكل صنف من التطبيق.';
  try { SpreadsheetApp.getUi().alert('إعداد مخزن الموقع ✅', msg, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) { console.log(msg); }
  return msg;
}
