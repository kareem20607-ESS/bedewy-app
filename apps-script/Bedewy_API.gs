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
  VERSION: '2026-11-26.1',
  CLIENT_ID: '760770227194-t2r0kna5g34igsarqfmf8psm8418ejlr.apps.googleusercontent.com',
  FIRST: 4,                                   // أول صف بيانات في كل الأوراق (1 عنوان، 2 شرح، 3 رؤوس)
  S: {
    permits: 'إذونات التوريد', qty: 'الكميات المنفذة', vouchers: 'السندات', stmts: 'المستخلصات',
    projects: 'المشروعات', parties: 'الأطراف', items: 'الأصناف', boq: 'المقايسة', subs: 'عقود الباطن', journal: 'اليومية',
    users: 'المستخدمين', settings: 'إعدادات التطبيق', custody: 'العهد', exp: 'مصروفات العهدة', log: 'سجل التطبيق'
  },
  C: {
    permits: { no: 1, date: 2, project: 3, party: 5, item: 7, qty: 10, price: 11, total: 12, status: 13, photo: 14, by: 15, notes: 16, n: 16 },
    qty: { no: 1, date: 2, project: 3, item: 5, qty: 8, value: 10, sub: 11, subValue: 14, status: 17, photo: 18, notes: 19, n: 19 },
    vouchers: { no: 1, kind: 2, date: 3, project: 4, party: 6, account: 8, amount: 10, method: 11, from: 12, ref: 13, desc: 14, status: 15, by: 16, notes: 17, n: 17 },
    stmts: { no: 1, kind: 2, project: 3, party: 5, date: 7, extNo: 8, current: 9, net: 15, status: 16, approvedAt: 17, notes: 18, plus: 20, n: 20 },
    exp: { no: 1, date: 2, project: 3, custody: 4, cat: 5, desc: 6, amount: 7, status: 8, photo: 9, by: 10, notes: 11, n: 11 },
    custody: { no: 1, project: 2, holder: 3, amount: 4, date: 5, from: 6, status: 7, notes: 8, n: 8 },
    users: { email: 1, name: 2, role: 3, projects: 4, active: 5, notes: 6, n: 6 },
    log: { time: 1, key: 2, id: 3, type: 4, event: 5, email: 6, name: 7, role: 8, details: 9, n: 9 }
  },
  SHEET_OF: { permit: 'permits', qty: 'qty', voucher: 'vouchers', stmt: 'stmts', exp: 'exp' },
  PREFIX: { permit: 'SP-', qty: 'Q-', exp: 'EX-' },
  ROLE: { 'محاسب الموقع': 'site', 'مهندس الموقع': 'eng', 'محاسب المشروع': 'acc', 'المالك': 'owner', 'مدير المنظومة': 'admin' },
  REASONS: ['صورة غير واضحة', 'السعر غير مطابق', 'الكمية غير مطابقة', 'مورد أو صنف خطأ', 'مستند مكرر', 'أخرى'],
  CATS: ['وقود', 'نقل', 'إعاشة', 'أدوات', 'صيانة', 'أخرى'],
  MARK: '⟲ مرفوض',                            // أول سطر في الملاحظات لما المستند يترفض من التطبيق
  SET: {                                       // أسماء البنود في ورقة «إعدادات التطبيق»
    limit: 'حد اعتماد محاسب المشروع للسندات', pricePct: 'نسبة تنبيه اختلاف السعر', late: 'أيام تأخير الاعتماد',
    radius: 'نطاق موقع المشروع (كم)', renewMail: 'إشعار طلب تجديد العهدة بالبريد', folder: 'فولدر صور التطبيق', site: 'موقع المشروع '
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
  if (act === 'photo') return bdwPhoto_(me, String(b.id || ''));
  if (act === 'custodyRenew') return bdwRenew_(me, String(b.project || ''));
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
  var sh = bdwSheet_(BDW.S.users);
  var rows = bdwRows_(sh, BDW.C.users.n), C = BDW.C.users;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i].v;
    if (String(r[C.email - 1]).toLowerCase().trim() !== tok.email) continue;
    if (/^لا/.test(String(r[C.active - 1]).trim())) break;
    var roleTxt = String(r[C.role - 1]).trim(), role = BDW.ROLE[roleTxt] || (['site', 'eng', 'acc', 'owner', 'admin'].indexOf(roleTxt) >= 0 ? roleTxt : '');
    if (!role) break;
    var pr = String(r[C.projects - 1] || '').trim();
    return {
      email: tok.email, name: String(r[C.name - 1] || '').trim() || tok.name || tok.email.split('@')[0], role: role,
      all: !pr || pr === 'الكل', projects: pr.split(/[،,\s]+/).filter(String)
    };
  }
  throw bdwErr_('not_allowed', 'الإيميل ده مش في جدول المستخدمين. كلّم مدير المنظومة يضيفه.');
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
  return {
    voucherLimit: n(BDW.SET.limit, 50000), priceWarnPct: pct > 1 ? pct / 100 : pct, lateDays: n(BDW.SET.late, 3),
    siteRadiusKm: n(BDW.SET.radius, 2), renewMail: !/^لا/.test(String(m[BDW.SET.renewMail] || '')),
    folder: bdwDriveId_(m[BDW.SET.folder]) || String(m[BDW.SET.folder] || '').trim(), sites: sites, postExp: false
  };
}

/* ======================= سجل التطبيق ======================= */

/* كل حدث من التطبيق بيتكتب سطر: الوقت، المفتاح، رقم المستند، النوع، الحدث، الإيميل، الاسم، الدور، التفاصيل */
function bdwLog_(key, id, type, event, me, details) {
  var sh = bdwSheet_(BDW.S.log), C = BDW.C.log, r = bdwNextRow_(sh);
  sh.getRange(r, 1, 1, C.n).setValues([[new Date(), key || '', id || '', type || '', event, me.email, me.name, me.role, details ? JSON.stringify(details) : '']]);
}
/* فهرس السجل: بالمفتاح، وبالمستند (النوع|الرقم) */
function bdwLogIndex_() {
  var sh = bdwSS_().getSheetByName(BDW.S.log), idx = { byKey: {}, byDoc: {}, renew: [] };
  if (!sh) return idx;
  var C = BDW.C.log;
  bdwRows_(sh, C.n).forEach(function (r) {
    var v = r.v, d = {};
    try { d = v[C.details - 1] ? JSON.parse(v[C.details - 1]) : {}; } catch (e) { }
    var ev = { t: (v[C.time - 1] instanceof Date) ? v[C.time - 1].getTime() : Date.now(), key: String(v[C.key - 1] || ''), id: String(v[C.id - 1] || ''),
      type: String(v[C.type - 1] || ''), event: String(v[C.event - 1] || ''), email: String(v[C.email - 1] || '').toLowerCase(),
      name: String(v[C.name - 1] || ''), role: String(v[C.role - 1] || ''), d: d };
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
    else if (ev.event === 'approve') { o.last = ev; o.log.push([ev.t, 'اعتُمد', ev.name]); }
    else if (ev.event === 'reject') { o.last = ev; o.log.push([ev.t, 'رُفض: ' + (ev.d.reason || ''), ev.name]); }
    else if (ev.event === 'approveTech') { o.tech = ev; o.log.push([ev.t, 'اعتماد فني', ev.name]); }
  });
  return o;
}

/* ======================= قراءة البيانات (bootstrap) ======================= */

function bdwBootstrap_(me, wanted) {
  var ss = bdwSS_(), st = bdwSettings_(), tz = bdwTz_(), today = bdwToday_();
  var cutRecent = Date.now() - 21 * 864e5, cutApp = Date.now() - 120 * 864e5;
  var P = BDW.C;

  var parties = bdwRows_(bdwSheet_(BDW.S.parties), 6).map(function (r) { return [String(r.v[0]).trim(), String(r.v[1]).trim(), bdwPartyType_(r.v[2]), bdwNum_(r.v[4]) || 0]; });
  var ptype = {}; parties.forEach(function (p) { ptype[p[0]] = p[2]; });
  var items = bdwRows_(bdwSheet_(BDW.S.items), 3).map(function (r) { return [String(r.v[0]).trim(), String(r.v[1]).trim(), String(r.v[2]).trim()]; });

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
  var boqRows = bdwRows_(bdwSheet_(BDW.S.boq), 7).filter(function (r) { return String(r.v[0]).trim() === pc; });
  var inBoq = {};
  var boq = boqRows.map(function (r) { var c = String(r.v[2]).trim(); inBoq[c] = 1; return [c, String(r.v[3]).trim(), String(r.v[4]).trim(), bdwNum_(r.v[5]) || 0, bdwNum_(r.v[6]), 0]; });
  var rates = {}, subItems = [], seenSub = {};
  bdwRows_(bdwSheet_(BDW.S.subs), 10).forEach(function (r) {
    if (String(r.v[1]).trim() !== pc) return;
    var s = String(r.v[3]).trim(), it = String(r.v[5]).trim(), rate = bdwNum_(r.v[9]);
    if (rate !== null) rates[s + '|' + it] = rate;
    if (!inBoq[it] && !seenSub[it]) { seenSub[it] = 1; subItems.push([it, String(r.v[6]).trim(), String(r.v[7]).trim()]); }
  });

  var docs = [], done = {}, k = { executed: 0, subWorks: 0, received: 0, subPaid: 0, clientStmts: 0, cost: 0 };
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
    var notes = bdwPermitNotes_(v[C.notes - 1]);
    var inf2 = info('permit', id), sub = inf2.submit;
    var d = base('permit', id, iso, st0, pc, { party: party, item: it, qty: bdwNum_(v[C.qty - 1]) || 0, price: price, photo: bdwPhotoRef_(v[C.photo - 1]),
      paperNo: (sub && sub.d.paperNo) || notes.paperNo, notes: notes.text, sign: (inf2.resub && inf2.resub.d.sign) || (sub && sub.d.sign) || '' }, v[C.by - 1]);
    if (d && keep(d)) docs.push(d);
  });
  var supplies = {};
  Object.keys(supplyCount).forEach(function (s) { supplies[s] = Object.keys(supplyCount[s]).sort(function (a, b) { return supplyCount[s][b] - supplyCount[s][a]; }); });

  /* الكميات المنفذة */
  bdwRows_(bdwSheet_(BDW.S.qty), P.qty.n).forEach(function (r) {
    var v = r.v, C = P.qty, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== pc) return;
    var iso = bdwIso_(v[C.date - 1]), st0 = String(v[C.status - 1]).trim(), it = String(v[C.item - 1]).trim(), q = bdwNum_(v[C.qty - 1]) || 0;
    var notes = bdwQtyNotes_(v[C.notes - 1]), sub = info('qty', id).submit, rs = info('qty', id).resub;
    var d = base('qty', id, iso, st0, pc, { boq: it, qty: q, kind: notes.kind, exec: String(v[C.sub - 1]).trim() || 'ذاتي', photo: bdwPhotoRef_(v[C.photo - 1]), notes: notes.text,
      cumulative: rs && rs.d.cumulative != null ? rs.d.cumulative : (sub && sub.d.cumulative != null ? sub.d.cumulative : undefined) }, notes.by);
    if (!d) return;
    if (d.status !== 'ملغى' && d.status !== 'مرفوض') {
      k.executed += bdwNum_(v[C.value - 1]) || 0; k.subWorks += bdwNum_(v[C.subValue - 1]) || 0;
      if (bdwIso_(new Date(d.at)) !== today) done[it] = (done[it] || 0) + q;   /* اللي اتسجّل النهارده التطبيق بيحسبه بنفسه */
    }
    if (keep(d)) docs.push(d);
  });
  boq.forEach(function (b) { b[5] = done[b[0]] || 0; });

  /* السندات */
  bdwRows_(bdwSheet_(BDW.S.vouchers), P.vouchers.n).forEach(function (r) {
    var v = r.v, C = P.vouchers, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== pc) return;
    var kind = String(v[C.kind - 1]).trim(), st0 = String(v[C.status - 1]).trim(), amt = bdwNum_(v[C.amount - 1]) || 0, party = String(v[C.party - 1]).trim();
    if (st0 !== 'ملغى') {
      if (kind === 'قبض') k.received += amt;
      else if (ptype[party] === 'مقاول باطن') k.subPaid += amt;
    }
    if (kind !== 'صرف') return;
    var d = base('voucher', id, bdwIso_(v[C.date - 1]), st0, pc, { party: party, amount: amt, method: String(v[C.method - 1] || ''), from: String(v[C.from - 1] || ''),
      account: String(v[C.account - 1] || ''), notes: String(v[C.desc - 1] || '') }, v[C.by - 1]);
    if (d && keep(d)) docs.push(d);
  });

  /* المستخلصات */
  bdwRows_(bdwSheet_(BDW.S.stmts), P.stmts.n).forEach(function (r) {
    var v = r.v, C = P.stmts, id = String(v[0]).trim();
    if (String(v[C.project - 1]).trim() !== pc) return;
    var st0 = String(v[C.status - 1]).trim(), kind = String(v[C.kind - 1]).trim(), net = bdwNum_(v[C.net - 1]) || 0;
    if (kind === 'عميل' && (st0 === 'معتمد' || st0 === 'مصروف')) k.clientStmts += net;
    var d = base('stmt', id, bdwIso_(v[C.date - 1]), st0, pc, { party: String(v[C.party - 1]).trim(), kind: kind,
      gross: (bdwNum_(v[C.current - 1]) || 0) + (bdwNum_(v[C.plus - 1]) || 0), net: net, paid: null, notes: bdwStripMark_(v[C.notes - 1]) }, '');
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

  /* اليومية: التكلفة المحققة للمشروع وأرصدة الأطراف (له + / عليه −) */
  var balances = {};
  parties.forEach(function (p) { if (p[3]) balances[p[0]] = p[3]; });
  var balAcc = { '1300': 1, '1310': 1, '1400': 1, '2100': 1, '2110': 1, '2200': 1, '2300': 1 };
  var shJ = ss.getSheetByName(BDW.S.journal);
  if (shJ) bdwRows_(shJ, 10).forEach(function (r) {
    var v = r.v, acc = String(v[7]).trim(), dr = bdwNum_(v[8]) || 0, cr = bdwNum_(v[9]) || 0, party = String(v[6]).trim();
    if (String(v[5]).trim() === pc && acc.charAt(0) === '5') k.cost += dr - cr;
    if (party && balAcc[acc]) balances[party] = (balances[party] || 0) + cr - dr;
  });

  docs.sort(function (a, b) { return b.at - a.at; });
  if (docs.length > 600) docs = docs.slice(0, 600);
  docs.forEach(function (d) { delete d.fromApp; });

  return {
    ok: true, version: BDW.VERSION, serverTime: Date.now(),
    user: { email: me.email, name: me.name, role: me.role },
    settings: { voucherLimit: st.voucherLimit, priceWarnPct: st.priceWarnPct, lateDays: st.lateDays, siteRadiusKm: st.siteRadiusKm, postExp: st.postExp },
    projects: projects, parties: parties.map(function (p) { return [p[0], p[1], p[2]]; }), balances: balances, items: items,
    supplies: supplies, lastPrice: lastPrice, boq: boq, subItems: subItems, rates: rates,
    custody: custody, kpis: { contract: proj.value, contractNet: proj.value * (1 - proj.discount), executed: k.executed, clientStmts: k.clientStmts,
      cost: k.cost, received: k.received, subWorks: k.subWorks, subPaid: k.subPaid },
    docs: docs
  };
}
/* حالة المستند في التطبيق من حالة الشيت: المرفوض من التطبيق بيبان في الشيت «ملغى» عشان ما يترحّلش في اليومية */
function bdwStatus_(type, s, rejected) {
  s = String(s || '').trim();
  if (type === 'stmt') {
    if (s === 'تحت المراجعة') return s;
    if (s === 'معتمد' || s === 'مصروف') return 'معتمد';
    if (s === 'مرفوض') return 'مرفوض';
    return null;                                        /* المسودة ما بتظهرش */
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
  var can = { permit: ['site', 'acc', 'admin'], qty: ['site', 'eng', 'admin'], exp: ['site'] }[type];
  if (can.indexOf(me.role) < 0) throw bdwErr_('forbidden', 'دورك ما بيسمحش بتسجيل المستند ده.');
  if (!bdwCanSee_(me, String(d.project || ''))) throw bdwErr_('forbidden', 'المشروع ده مش من مشروعاتك.');

  var seen = bdwLogIndex_().byKey[op.key];                    /* نفس المستند وصل قبل كده (إعادة محاولة) */
  if (seen) return { ok: true, id: seen.id, duplicate: true };

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
  if (d.photoData) photoUrl = bdwSaveImage_(d.photoData, stamp + ' — صورة');
  else if (!isResub) throw bdwErr_('invalid', 'الصورة ما وصلتش مع المستند. افتحه وصوّره تاني.');
  if (d.signData) signId = bdwDriveId_(bdwSaveImage_(d.signData, stamp + ' — توقيع'));

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw bdwErr_('busy', 'السكريبت مشغول دلوقتي. هيتبعت تاني لوحده.');
  try {
    var again = bdwLogIndex_().byKey[op.key];
    if (again) return { ok: true, id: again.id, duplicate: true };
    var det = { at: Number(op.at) || Date.now(), loc: clean.loc };
    if (op.queuedAt) det.queuedAt = Number(op.queuedAt);
    if (type === 'permit') { det.paperNo = clean.paperNo; if (signId) det.sign = 'drive:' + signId; }
    if (type === 'qty') { det.kind = clean.kind; if (clean.cumulative != null) det.cumulative = clean.cumulative; }
    if (isResub) {
      bdwRewrite_(me, type, target, clean, photoUrl);
      det.target = target.key;
      bdwLog_(op.key, target.id, type, 'resubmit', me, det);
      return { ok: true, id: target.id };
    }
    var id = bdwAppend_(me, type, clean, photoUrl);
    bdwLog_(op.key, id, type, 'submit', me, det);
    rename(id);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
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
  } else {
    o.cat = String(d.cat || ''); o.desc = String(d.desc || '').trim().slice(0, 200); o.amount = Number(d.amount);
    if (BDW.CATS.indexOf(o.cat) < 0) bad('اختار تصنيف المصروف.');
    if (!o.desc) bad('اكتب بيان المصروف.');
    if (!(o.amount > 0)) bad('المبلغ لازم يكون أكبر من صفر.');
  }
  return o;
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
  if (role === 'eng') return type === 'qty';
  if (role === 'acc') return type === 'permit' || type === 'exp' || (type === 'voucher' && amount <= lim);
  if (role === 'admin') return type === 'permit' || type === 'exp' || (type === 'voucher' && amount <= lim) || (type === 'qty' && byEng);
  if (role === 'owner') return (type === 'voucher' && amount > lim) || (type === 'qty' && byEng);
  return false;
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
function bdwPhoto_(me, id) {
  id = id.replace(/^drive:/, '');
  if (!/^[\w-]{20,}$/.test(id)) throw bdwErr_('invalid', 'رقم الصورة غلط.');
  if (!bdwKnownPhoto_(id)) throw bdwErr_('forbidden', 'الصورة دي مش تبع مستندات المنظومة.');
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
