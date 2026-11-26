/* شاشات الموقع: إذن توريد (2.1)، محضر كميات (2.2)، سجلاتي (2.3)، العهدة ومصروف جديد (2.4)، وصرف مواد وجرد المخزن (6.4).
   النموذج بيتحفظ مسودة على الجهاز أول بأول، والحفظ بيحط المستند في طابور الإرسال بمفتاح فريد. */
(window.BDW_EXT = window.BDW_EXT || []).push(function (R) {
  'use strict';
  var S = R.S, IC = R.IC, esc = R.esc, num = R.num, money = R.money;
  var $ = function (s) { return document.querySelector(s); };
  var F = null;                          /* النموذج المفتوح */
  var asked = null;                      /* مفتاح النموذج اللي طلبنا له الموقع */
  var CATS = ['وقود', 'نقل', 'إعاشة', 'أدوات', 'صيانة', 'أخرى'];
  var FORM = { permit: 'إذن توريد جديد', qty: 'محضر كميات جديد', exp: 'مصروف جديد', issue: 'صرف مواد للتنفيذ', count: 'جرد صنف' };
  function storeType(t) { return t === 'issue' || t === 'count'; }

  /* ---------- حالة النموذج ---------- */
  function fresh(type) {
    var f = { type: type, key: R.uid(), date: R.today(), photo: '', notes: '', loc: null, errs: {} };
    if (type === 'permit') { f.party = ''; f.item = ''; f.qty = ''; f.price = ''; f.priceSet = false; f.paperNo = ''; f.sign = ''; }
    if (type === 'qty') { f.boq = ''; f.qty = ''; f.kind = 'حالية'; f.exec = 'ذاتي'; }
    if (type === 'exp') { f.cat = ''; f.desc = ''; f.amount = ''; }
    if (type === 'issue') { f.item = ''; f.qty = ''; f.exec = 'ذاتي'; f.boq = ''; f.sign = ''; }
    if (type === 'count') { f.item = ''; f.counted = ''; }
    return f;
  }
  function draftKey(t) { return 'bdw_draft_' + t; }
  function saveDraft() { if (F && !F.edit) { var c = JSON.parse(JSON.stringify(F)); c.errs = {}; R.store(draftKey(F.type), c); } }
  /* preset: صنف جاي من شاشة الصنف في المخزن؛ بيتطبّق مرة واحدة، وبعدها اختيار المستخدم هو اللي يمشي */
  function preset(f, code) {
    if (!code || f.presetFrom === code) return f;
    f.presetFrom = code;
    if (f.item !== code) { f.item = code; f.qty = ''; f.counted = ''; }
    return f;
  }
  function open(type, editKey, pre) {
    if (editKey) {
      var x = R.byKey(editKey); if (!x) return null;
      var f = fresh(x.type); for (var k in f) if (x[k] !== undefined && k !== 'key' && k !== 'errs') f[k] = x[k];
      if (x.type === 'qty' && x.kind === 'تراكمي' && x.cumulative != null) f.qty = x.cumulative;   /* النموذج بيعرض الرقم اللي اتكتب، مش الحالي المحسوب */
      f.edit = editKey; f.priceSet = true; f.errs = {}; f.reason = x.reason; f.note = x.note; f.decidedBy = x.decidedBy;
      if (F && F.edit === editKey) return F;
      return (F = f);
    }
    if (F && F.type === type && !F.edit) return storeType(type) ? preset(F, pre) : F;
    var d = R.load(draftKey(type));
    F = d && d.type === type ? d : fresh(type);
    F.errs = {};
    return storeType(type) ? preset(F, pre) : F;
  }

  /* ---------- أدوات الحقول ---------- */
  function lab(t, req, tag) { return '<div class="fl">' + t + (req ? '<span class="rq">*</span>' : '') + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</div>'; }
  function err(k) { return F.errs[k] ? '<div class="fe" id="e-' + k + '">' + IC.alert + esc(F.errs[k]) + '</div>' : ''; }
  function refField(k, label, val, sub, ph, req, tag) {   /* tag: كلمة جنب العنوان زي «اختياري» */
    return '<div class="fld" id="w-' + k + '">' + lab(label, req, tag) + '<button type="button" class="fb' + (F.errs[k] ? ' err' : '') + '" data-act="pick" data-f="' + k + '">' + IC.search +
      (val ? '<span class="v">' + esc(val) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' : '<span class="plh">' + esc(ph) + '</span>') + IC.down + '</button>' + err(k) + '</div>';
  }
  function numField(k, label, unit, req, hint, mode) {
    return '<div class="fld" id="w-' + k + '">' + lab(label, req) + '<div class="fb' + (F.errs[k] ? ' err' : '') + '"><input id="f-' + k + '" data-f="' + k + '" inputmode="' + (mode || 'decimal') + '" autocomplete="off" value="' + esc(F[k]) + '" placeholder="0">' +
      (unit ? '<span class="u">' + esc(unit) + '</span>' : '') + '</div>' + (hint ? '<div class="fh" id="h-' + k + '">' + hint + '</div>' : '') + err(k) + '</div>';
  }
  function textField(k, label, req, ph, long) {
    return '<div class="fld" id="w-' + k + '">' + lab(label, req) + '<div class="fb' + (F.errs[k] ? ' err' : '') + '">' +
      (long ? '<textarea id="f-' + k + '" data-f="' + k + '" rows="2" placeholder="' + esc(ph || '') + '">' + esc(F[k]) + '</textarea>' : '<input id="f-' + k + '" data-f="' + k + '" autocomplete="off" value="' + esc(F[k]) + '" placeholder="' + esc(ph || '') + '">') +
      '</div>' + err(k) + '</div>';
  }
  function dateField() {
    return '<div class="fld" id="w-date">' + lab('التاريخ', true) + '<div class="fb' + (F.errs.date ? ' err' : '') + '"><input type="date" id="f-date" data-f="date" max="' + R.today() + '" value="' + esc(F.date) + '">' + IC.cal + '</div>' + err('date') + '</div>';
  }
  function autoField(label, id, val, tag) {
    return '<div class="fld">' + lab(label, false, tag) + '<div class="fb auto"><span class="v" id="' + id + '">' + val + '</span>' + IC.lock + '</div></div>';
  }
  function seg(k, label, opts, cls, req) {
    return '<div class="fld" id="w-' + k + '">' + (label ? lab(label, req) : '') + '<div class="seg ' + (cls || '') + '">' + opts.map(function (o) {
      var v = o[0], t = o[1] || o[0];
      return '<button type="button" class="' + (F[k] === v ? 'on' : '') + '" data-act="seg" data-f="' + k + '" data-v="' + esc(v) + '">' + esc(t) + '</button>';
    }).join('') + '</div>' + err(k) + '</div>';
  }
  function photoField(label, kind, optional) {
    var input = '<input class="file-in" type="file" id="f-photo-in" accept="image/*" capture="environment">';
    if (F.photo) {
      return '<div class="fld" id="w-photo">' + lab(label, !optional) + '<label for="f-photo-in" class="photo" style="display:block" data-photo="' + esc(F.photo) + '" data-kind="' + kind + '" data-ov="' + esc('<span class="ov">' + IC.camera + 'إعادة التصوير</span>') + '"></label>' + input + '</div>';
    }
    return '<div class="fld" id="w-photo">' + lab(label, !optional, optional ? 'اختياري' : '') + '<label for="f-photo-in" class="photo-empty' + (F.errs.photo ? ' err' : '') + '">' + IC.camera + '<span>صوّر ' +
      (kind === 'exp' ? 'الإيصال' : kind === 'qty' ? 'المحضر' : kind === 'issue' ? 'إذن الصرف الورقي' : 'الإذن') + '</span><small>بالكاميرا أو من المعرض</small></label>' + input + err('photo') + '</div>';
  }
  function signField() {
    return '<div class="fld" id="w-sign">' + lab('توقيع المستلم', true) + '<div class="sig' + (F.errs.sign ? ' err' : '') + '" id="sig"><canvas></canvas><div class="base"></div><div class="hint"' + (F.sign ? ' hidden' : '') + '>وقّع هنا بإصبعك</div>' +
      '<button type="button" class="clr" data-act="sig-clear">' + IC.eraser + 'امسح وأعد التوقيع</button></div>' + err('sign') + '</div>';
  }
  function locField() {
    return '<div class="fld">' + lab('الموقع', false, 'تلقائي') + '<div class="locbox" id="f-loc">' + locHtml() + '</div></div>';
  }
  function locHtml() {
    var l = F.loc, rad = S.data.settings.siteRadiusKm || 2;
    if (!l) return '<span class="ld t-navy">' + IC.pin + '</span><span><b>جارٍ تحديد الموقع…</b><small>اسمح للتطبيق بالموقع لو المتصفح سأل</small></span>';
    if (l.err && R.CFG.PREVIEW) return '<span class="ld t-gold">' + IC.pin + '</span><span><b>الموقع مش متاح في نسخة العرض</b><small>في التطبيق المنشور بيتحدد تلقائي. المستند هيتسجّل بدون موقع.</small></span>';
    if (l.err) return '<span class="ld t-gold">' + IC.pin + '</span><span><b>تعذّر تحديد الموقع</b><small>' + (l.err === 1 ? 'إذن الموقع مقفول في المتصفح' : 'الإشارة ضعيفة') + ' — المستند هيتسجّل بدون موقع</small></span><button type="button" data-act="loc">إعادة</button>';
    var p = R.project(), d = R.km(l, p);
    if (d == null) return '<span class="ld t-green">' + IC.pin + '</span><span><b>التُقط الموقع</b><small>دقة ' + Math.round(l.acc || 0) + ' م</small></span>';
    var ok = d <= rad;
    return '<span class="ld t-' + (ok ? 'green' : 'gold') + '">' + IC.pin + '</span><span><b>' + (ok ? 'داخل نطاق المشروع' : 'خارج نطاق المشروع') + '</b><small>على بعد ' + num(d, d < 10 ? 1 : 0) + ' كم من موقع المشروع' + (ok ? '' : ' — هيظهر تحذير للمراجع') + '</small></span><button type="button" data-act="loc">تحديث</button>';
  }
  function locate() {
    if (!navigator.geolocation) { F.loc = { err: 2 }; return paintLoc(); }
    var f = F;
    navigator.geolocation.getCurrentPosition(function (p) {
      if (F !== f) return;
      F.loc = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      F.loc.dist = R.km(F.loc, R.project()); saveDraft(); paintLoc();
    }, function (e) { if (F !== f) return; F.loc = { err: e.code === 1 ? 1 : 2 }; paintLoc(); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  function paintLoc() { var el = $('#f-loc'); if (el) el.innerHTML = locHtml(); }

  /* ---------- قواعد الإذن ---------- */
  function lastPrice() { return F.party && F.item ? S.data.lastPrice[F.party + '|' + F.item] : undefined; }
  function permitTotal() { var q = Number(F.qty), p = Number(F.price); return q > 0 && p > 0 ? q * p : null; }
  function priceWarn() {
    var lp = lastPrice(), p = Number(F.price);
    if (!F.item) return '';
    if (lp == null) return '<div class="alert info">' + IC.info + '<div>أول توريد لهذا الصنف من المورد ده؛ اكتب السعر من الإذن أو عرض المورد.</div></div>';
    if (!(p > 0)) return '';
    var diff = (p - lp) / lp;
    if (Math.abs(diff) <= (S.data.settings.priceWarnPct || 0.05)) return '<div class="alert ok">' + IC.ok + '<div>نفس آخر سعر معتمد لهذا المورد والصنف (' + money(lp) + ').</div></div>';
    return '<div class="alert warn">' + IC.alert + '<div>آخر سعر معتمد لهذا المورد والصنف: <b>' + money(lp) + '</b>. السعر المكتوب ' + (diff > 0 ? 'أعلى' : 'أقل') + ' بنسبة <b>' + num(Math.abs(diff) * 100, 1) + '%</b>، وهيظهر للمراجع.</div></div>';
  }

  /* ---------- قواعد المحضر ---------- */
  function qtyCalc() {
    var b = R.boq(F.boq), p = R.project(), q = Number(F.qty) || 0;
    var prev = R.docs(function (x) { return x.type === 'qty' && x.boq === F.boq && x.key !== F.edit && x.status !== 'مرفوض' && x.status !== 'ملغى' && R.iso(x.at) === R.today(); }).reduce(function (s, x) { return s + x.qty; }, 0);
    var before = (b.done || 0) + prev;
    var cur = F.kind === 'تراكمي' ? q - before : q;
    var price = b.price != null ? b.price * (1 - (p.discount || 0)) : null;
    var rate = F.exec !== 'ذاتي' ? S.data.rates[F.exec + '|' + F.boq] : null;
    return { b: b, before: before, cur: cur, after: before + cur, pct: b.qty ? (before + cur) / b.qty : null, price: price, value: price != null && cur > 0 ? cur * price : null, rate: rate };
  }
  function qtyAlert() {
    if (!F.boq || !(Number(F.qty) > 0)) return '';
    var c = qtyCalc();
    if (F.kind === 'تراكمي' && c.cur <= 0) return '<div class="alert err">' + IC.bad + '<div>الكمية التراكمية أقل من أو تساوي المنفّذ قبل كده (' + num(c.before) + ' ' + esc(c.b.unit) + ')؛ مفيش كمية حالية.</div></div>';
    if (c.pct != null && c.pct > 1) return '<div class="alert warn">' + IC.alert + '<div>بعد هذا المحضر يصبح المنفّذ <b>' + num(c.after) + ' ' + esc(c.b.unit) + ' = ' + num(c.pct * 100, 0) + '%</b> من كمية المقايسة (' + num(c.b.qty) + '). الحفظ مسموح، ويصل تنبيه للمهندس والمالك.</div></div>';
    if (F.kind === 'تراكمي') return '<div class="alert info">' + IC.info + '<div>الكمية الحالية = ' + num(Number(F.qty)) + ' − ' + num(c.before) + ' = <b>' + num(c.cur) + ' ' + esc(c.b.unit) + '</b>.</div></div>';
    return '';
  }

  /* ---------- قواعد المخزن ---------- */
  function storeLeft() { return F.item ? R.storeBal(F.item) - (Number(F.qty) || 0) : null; }
  function diffHtml() {
    if (!F.item || String(F.counted).trim() === '' || isNaN(Number(F.counted))) return '';
    var it = R.item(F.item), d = Math.round((Number(F.counted) - R.storeBal(F.item)) * 1000) / 1000;
    if (!d) return '<div class="alert ok">' + IC.ok + '<div>العدد الفعلي مطابق للرصيد الدفتري.</div></div>';
    return '<div class="alert ' + (d < 0 ? 'warn' : 'info') + '">' + IC[d < 0 ? 'alert' : 'info'] + '<div>' + (d < 0 ? 'عجز' : 'زيادة') + ' <b>' + num(Math.abs(d)) + ' ' + esc(it.unit) +
      '</b> عن الرصيد الدفتري. الرصيد هيتسوّى بالفرق بعد اعتماد محاسب المشروع.</div></div>';
  }

  /* ---------- قواعد المصروف ---------- */
  function expLeft() { return R.custody().left; }   /* المرفوض مش محسوب في المصروف، فالتعديل عليه ما يرجّعش حاجة */

  /* ---------- رسم النموذج ---------- */
  function viewForm(r) {
    var type = r.name === 'edit' ? null : r.sub;
    var f = r.name === 'edit' ? open(null, r.sub) : FORM[type] ? open(type, null, r.arg) : null;
    if (!f) return R.head({ title: 'مستند', back: true }) + '<main class="view"><div class="empty"><b>المستند ده مش موجود</b></div></main>';
    var body = '';
    if (F.edit) body += '<div class="alert err" style="margin:12px 14px 0">' + IC.bad + '<div><b>رفضه ' + esc(F.decidedBy || 'المراجع') + ': ' + esc(F.reason || '') + '</b>' + (F.note ? '<br>«' + esc(F.note) + '»' : '') + '</div></div>';
    if (F.type === 'permit') {
      var pty = F.party ? R.party(F.party) : null, it = F.item ? R.item(F.item) : null, lp = lastPrice();
      body += '<div class="form">' +
        autoField('المشروع', 'f-proj', esc(R.project().short || ''), 'من المشروع الحالي') +
        refField('party', 'المورد', pty ? pty.code + ' — ' + pty.name : '', '', 'اختار المورد', true) +
        refField('item', 'الصنف', it ? it.code + ' — ' + it.name : '', it ? 'الوحدة: ' + it.unit : '', F.party ? 'اختار الصنف' : 'اختار المورد الأول', true) +
        '<div class="two">' + numField('qty', 'الكمية', it ? it.unit : '', true) + numField('price', 'سعر الوحدة', 'ج', true, lp != null ? 'آخر معتمد ' + money(lp) : '') + '</div>' +
        '<div id="f-pricewarn">' + priceWarn() + '</div>' +
        autoField('الإجمالي', 'f-total', permitTotal() != null ? money(permitTotal()) : '—', 'تلقائي') + dateField() +
        photoField('صورة الإذن', 'permit') + textField('paperNo', 'رقم الإذن الورقي', false, 'اختياري') + signField() +
        locField() + textField('notes', 'ملاحظات', false, 'مثلًا: تفريغ صباحي — عربية 16 م3', true) +
        (F.edit ? '' : '<div class="fh" style="text-align:center;margin:4px 0 10px">' + IC.hash + ' رقم الإذن بيتحدد في الشيت بعد الإرسال</div>') + '</div>';
    } else if (F.type === 'qty') {
      var b = F.boq ? R.boq(F.boq) : null, c = qtyCalc();
      body += '<div class="form">' + autoField('المشروع', 'f-proj', esc(R.project().short || ''), 'من المشروع الحالي') +
        refField('boq', 'البند', b ? b.code + ' — ' + b.name : '', b ? (b.qty ? 'المقايسة ' + num(b.qty) + ' ' + b.unit + ' — المنفّذ ' + num(c.before) + ' (' + num(c.before / b.qty * 100, 0) + '%)' : 'بند عقد باطن — الوحدة ' + b.unit) : '', 'اختار البند من المقايسة', true) +
        '<div class="two">' + numField('qty', F.kind === 'تراكمي' ? 'الكمية التراكمية' : 'الكمية المنفذة', b ? b.unit : '', true) + seg('kind', 'نوع المحضر', [['حالية'], ['تراكمي']], '', true) + '</div>' +
        seg('exec', 'المنفّذ', [['ذاتي', 'تنفيذ ذاتي'], [F.exec !== 'ذاتي' ? F.exec : 'sub', 'مقاول باطن']], '', true) +
        (F.exec !== 'ذاتي' ? refField('sub', 'المقاول', F.exec && F.exec !== 'sub' ? F.exec + ' — ' + R.party(F.exec).name : '', F.exec && F.exec !== 'sub' && F.boq ? (c.rate != null ? 'فئته في العقد ' + money(c.rate) + ' — القيمة ' + money(c.cur > 0 ? c.cur * c.rate : 0) : 'لا توجد فئة لهذا البند في عقد المقاول') : '', 'اختار المقاول', true) : '') +
        '<div id="f-over">' + qtyAlert() + '</div>' +
        '<div class="two">' + autoField('سعر الجهاز', 'f-cprice', c.price != null ? num(c.price) + ' ج' : '—', 'بعد الخصم ' + num((R.project().discount || 0) * 100) + '%') + autoField('القيمة', 'f-value', c.value != null ? money(c.value) : '—') + '</div>' +
        dateField() + photoField('صورة المحضر', 'qty') + locField() + textField('notes', 'ملاحظات', false, '', true) + '</div>';
    } else if (F.type === 'issue') {
      var si = F.item ? R.item(F.item) : null, sb = F.item ? R.storeBal(F.item) : 0, sbq = F.boq ? R.boq(F.boq) : null, lft = storeLeft();
      body += '<div class="form">' + autoField('المشروع', 'f-proj', esc(R.project().short || ''), 'من المشروع الحالي') +
        (R.storeOn() ? '' : '<div class="alert err">' + IC.bad + '<div>المخزن مش متفعّل للمشروع ده.</div></div>') +
        refField('item', 'الصنف', si ? si.code + ' — ' + si.name : '', si ? 'الرصيد في المخزن: ' + num(sb) + ' ' + si.unit : '', 'اختار الصنف من المخزن', true) +
        numField('qty', 'الكمية المنصرفة', si ? si.unit : '', true, si ? 'الرصيد بعد الصرف: <b id="f-left" style="color:' + (lft < 0 ? 'var(--red)' : 'var(--green)') + '">' + num(lft) + '</b> ' + esc(si.unit) : '') +
        seg('exec', 'المستلم', [['ذاتي', 'تنفيذ ذاتي'], [F.exec !== 'ذاتي' ? F.exec : 'sub', 'مقاول باطن']], '', true) +
        (F.exec !== 'ذاتي' ? refField('sub', 'المقاول', F.exec && F.exec !== 'sub' ? F.exec + ' — ' + R.party(F.exec).name : '', '', 'اختار المقاول', true) : '') +
        refField('boq', 'بند المقايسة', sbq ? sbq.code + ' — ' + sbq.name : '', '', 'البند اللي المواد رايحة له', false, 'اختياري') +
        dateField() + signField() + photoField('صورة إذن الصرف', 'issue', true) + locField() + textField('notes', 'ملاحظات', false, 'مثلًا: الشارع 4 — الوصلات المنزلية', true) + '</div>';
    } else if (F.type === 'count') {
      var ci = F.item ? R.item(F.item) : null, pendC = F.item && R.storePendingCount(F.item, F.edit);
      body += '<div class="form">' + autoField('المشروع', 'f-proj', esc(R.project().short || ''), 'من المشروع الحالي') +
        (R.storeOn() ? '' : '<div class="alert err">' + IC.bad + '<div>المخزن مش متفعّل للمشروع ده.</div></div>') +
        refField('item', 'الصنف', ci ? ci.code + ' — ' + ci.name : '', ci && ci.cat ? ci.cat : '', 'اختار الصنف اللي بتعدّه', true) +
        (pendC ? '<div class="alert err">' + IC.bad + '<div>فيه جرد للصنف ده مستني اعتماد محاسب المشروع. الجرد الجاي بعد القرار.</div></div>' : '') +
        '<div class="two">' + autoField('الرصيد الدفتري', 'f-book', ci ? num(R.storeBal(F.item)) + ' ' + esc(ci.unit) : '—', 'تلقائي') + numField('counted', 'العدد الفعلي', ci ? ci.unit : '', true) + '</div>' +
        '<div id="f-diff">' + diffHtml() + '</div>' + dateField() + locField() + textField('notes', 'ملاحظات', false, 'مثلًا: جرد افتتاحي، أو سبب الفرق', true) + '</div>';
    } else {
      var left = expLeft();
      body += '<div class="form">' + dateField() + seg('cat', 'التصنيف', CATS.map(function (x) { return [x]; }), 'g3', true) +
        textField('desc', 'البيان', true, 'مثلًا: وجبات عمال الوردية المسائية') +
        numField('amount', 'المبلغ', 'ج', true, 'المتبقي في العهدة بعد هذا المصروف: <b style="color:var(--green)" id="f-left">' + money(left - (Number(F.amount) || 0)) + '</b>') +
        photoField('صورة الإيصال', 'exp') + '</div>';
    }
    var saveT = F.edit ? 'عدّل وأعد الإرسال' : F.type === 'permit' ? 'حفظ الإذن' : F.type === 'qty' ? 'حفظ المحضر' : F.type === 'issue' ? 'حفظ إذن الصرف' : F.type === 'count' ? 'حفظ الجرد' : 'حفظ المصروف';
    return R.head({ title: F.edit ? 'تعديل ' + ((R.byKey(F.edit) || {}).id || '') : FORM[F.type], back: true, noSync: true }) +
      '<main class="view form-view">' + body + '</main>' +
      '<div class="fbar"><button class="btn" data-act="save">' + IC[F.edit ? 'send' : 'check'] + saveT + '</button><button class="btn out fit" data-act="cancel">إلغاء</button></div>';
  }

  /* ---------- لوحات الاختيار ---------- */
  function pick(k) {
    if (k === 'party') {
      return R.openSheet({ title: 'اختار المورد', value: F.party, items: S.data.parties.filter(function (p) { return p[2] === 'مورد'; }).map(function (p) {
        return { v: p[0], code: p[0], name: p[1], sub: (S.data.supplies[p[0]] || []).length + ' صنف' };
      }), onPick: function (v) { if (F.party !== v) { F.party = v; F.item = ''; F.price = ''; F.priceSet = false; } delete F.errs.party; afterPick(); } });
    }
    if (k === 'item' && storeType(F.type)) {
      var T = R.storeTotals(), codes = R.storeItems();
      if (F.type === 'issue') codes = codes.filter(function (c) { return T[c] && T[c].bal > 1e-9; });
      if (!codes.length) return R.toast(F.type === 'issue' ? 'مفيش أصناف ليها رصيد في المخزن.' : 'مفيش أصناف للجرد.');
      codes.sort(function (a, b) { return (T[a] ? 0 : 1) - (T[b] ? 0 : 1) || R.item(a).name.localeCompare(R.item(b).name, 'ar'); });
      return R.openSheet({ title: F.type === 'issue' ? 'اختار الصنف من المخزن' : 'اختار الصنف للجرد', value: F.item, ph: 'ابحث بالكود أو الاسم', items: codes.map(function (c) {
        var it = R.item(c), o = T[c];
        return { v: c, code: c, name: it.name, sub: it.cat || '', end: o ? num(o.bal) + ' ' + it.unit : 'مفيش حركة',
          endCls: o && o.state === 'low' ? 'gold' : o && (o.state === 'empty' || o.state === 'neg') ? 'red' : '' };
      }), onPick: function (v) { if (F.item !== v) { F.item = v; F.qty = ''; F.counted = ''; } delete F.errs.item; delete F.errs.qty; delete F.errs.counted; afterPick(); } });
    }
    if (k === 'item') {
      if (!F.party) return R.toast('اختار المورد الأول.');
      var list = S.data.supplies[F.party] || [];
      var all = S.data.items.filter(function (i) { return list.indexOf(i[0]) >= 0; }).concat(S.data.items.filter(function (i) { return list.indexOf(i[0]) < 0; }));
      return R.openSheet({ title: 'اختار الصنف', value: F.item, items: all.map(function (i) {
        var lp = S.data.lastPrice[F.party + '|' + i[0]];
        return { v: i[0], code: i[0], name: i[1], sub: list.indexOf(i[0]) >= 0 ? 'يورّده هذا المورد' : 'لم يورّده هذا المورد قبل كده', end: lp != null ? money(lp) : '' };
      }), onPick: function (v) {
        F.item = v; var lp = S.data.lastPrice[F.party + '|' + v];
        if (!F.priceSet) F.price = lp != null ? String(lp) : '';
        delete F.errs.item; afterPick();
      } });
    }
    if (k === 'boq') {
      var bl = Object.keys(Object.assign({}, idx())).map(function (c) {
        var b = R.boq(c), pct = b.qty ? b.done / b.qty : null;
        return { v: c, code: c, name: b.name, sub: b.qty ? 'المنفّذ ' + num(b.done) + ' من ' + num(b.qty) + ' ' + b.unit : 'بند عقد باطن', end: pct != null ? num(pct * 100, 0) + '%' + (pct > 1 ? ' تجاوز' : '') : '', endCls: pct > 1 ? 'red' : pct > 0.9 ? 'gold' : '' };
      });
      if (F.type === 'issue') bl.unshift({ v: '', code: '—', name: 'بدون بند', sub: 'المواد مش لبند معيّن' });
      return R.openSheet({ title: F.type === 'issue' ? 'البند اللي المواد رايحة له' : 'اختار البند', value: F.boq, ph: 'ابحث في بنود المقايسة', items: bl, onPick: function (v) { F.boq = v; delete F.errs.boq; afterPick(); } });
    }
    if (k === 'sub') {
      return R.openSheet({ title: 'اختار المقاول', value: F.exec, search: true, items: S.data.parties.filter(function (p) { return p[2] === 'مقاول باطن'; }).map(function (p) {
        var rate = F.boq ? S.data.rates[p[0] + '|' + F.boq] : undefined;
        return { v: p[0], code: p[0], name: p[1], sub: F.type === 'qty' && F.boq ? (rate != null ? 'فئته لهذا البند ' + money(rate) : 'لا فئة لهذا البند في عقده') : '' };
      }), onPick: function (v) { F.exec = v; delete F.errs.sub; afterPick(); } });
    }
  }
  function idx() { var o = {}; (S.data.boq || []).forEach(function (b) { o[b[0]] = 1; }); (S.data.subItems || []).forEach(function (b) { o[b[0]] = 1; }); return o; }
  function afterPick() { saveDraft(); R.render(true); }

  /* ---------- الصورة: تصغير قبل الحفظ ---------- */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('img')); };
      img.src = url;
    });
  }

  /* ---------- التوقيع ---------- */
  function sigAttach() {
    var box = $('#sig'); if (!box || !F || (F.type !== 'permit' && F.type !== 'issue')) return;
    var cv = box.querySelector('canvas'), dpr = window.devicePixelRatio || 1, rect = cv.getBoundingClientRect();
    cv.width = Math.round(rect.width * dpr); cv.height = Math.round(rect.height * dpr);
    var g = cv.getContext('2d'); g.lineWidth = 2.4 * dpr; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#14213D';
    if (F.sign) R.blob.get(F.sign).then(function (v) { if (!v) return; var im = new Image(); im.onload = function () { g.drawImage(im, 0, 0, cv.width, cv.height); }; im.src = v; });
    var drawing = false, last = null, dirty = false;
    function pt(e) { var r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr }; }
    cv.addEventListener('pointerdown', function (e) { drawing = true; last = pt(e); cv.setPointerCapture(e.pointerId); box.querySelector('.hint').hidden = true; e.preventDefault(); });
    cv.addEventListener('pointermove', function (e) { if (!drawing) return; var p = pt(e); g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke(); last = p; dirty = true; });
    function end() {
      if (!drawing) return; drawing = false; if (!dirty) return;
      var k = F.key + ':sign', v = cv.toDataURL('image/png');
      R.blob.put(k, v); F.sign = k; delete F.errs.sign; box.classList.remove('err'); var e2 = $('#e-sign'); if (e2) e2.remove(); saveDraft();
    }
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('pointerleave', end);
  }

  /* ---------- الحفظ ---------- */
  function validate() {
    var e = {}, q = Number(F.qty);
    if (!F.date) e.date = 'اختار التاريخ'; else if (F.date > R.today()) e.date = 'التاريخ بعد النهارده'; else if (F.date < '2020-01-01') e.date = 'التاريخ قديم جدًا؛ راجع السنة';
    if (F.type === 'permit') {
      if (!F.party) e.party = 'اختار المورد';
      if (!F.item) e.item = 'اختار الصنف';
      if (!(q > 0)) e.qty = 'اكتب كمية أكبر من صفر';
      if (!(Number(F.price) > 0)) e.price = 'اكتب سعر الوحدة';
      if (!F.photo) e.photo = 'صوّر الإذن قبل الحفظ؛ الصورة إجبارية';
      if (!F.sign) e.sign = 'خلّي المستلم يوقّع';
    } else if (F.type === 'qty') {
      if (!F.boq) e.boq = 'اختار البند';
      if (!(q > 0)) e.qty = 'اكتب كمية أكبر من صفر';
      else if (F.kind === 'تراكمي' && qtyCalc().cur <= 0) e.qty = 'التراكمي لازم يكون أكبر من المنفّذ قبل كده';
      if (F.exec !== 'ذاتي' && (!F.exec || F.exec === 'sub')) e.sub = 'اختار المقاول';
      if (!F.photo) e.photo = 'صوّر المحضر قبل الحفظ؛ الصورة إجبارية';
    } else if (F.type === 'issue') {
      if (!R.storeOn()) e.item = 'المخزن مش متفعّل للمشروع ده';
      else if (!F.item) e.item = 'اختار الصنف';
      var sb = F.item ? R.storeBal(F.item) : 0;
      if (!(q > 0)) e.qty = 'اكتب كمية أكبر من صفر';
      else if (F.item && q > sb + 1e-9) e.qty = 'الكمية أكبر من الرصيد (' + num(sb) + ' ' + R.item(F.item).unit + ')';
      if (F.exec !== 'ذاتي' && (!F.exec || F.exec === 'sub')) e.sub = 'اختار المقاول';
      if (!F.sign) e.sign = 'خلّي المستلم يوقّع';
      if (!e.date && R.storeStart() && F.date < R.storeStart()) e.date = 'التاريخ قبل بداية المخزن (' + R.storeStart() + ')';
    } else if (F.type === 'count') {
      if (!R.storeOn()) e.item = 'المخزن مش متفعّل للمشروع ده';
      else if (!F.item) e.item = 'اختار الصنف';
      else if (R.storePendingCount(F.item, F.edit)) e.item = 'فيه جرد للصنف ده مستني الاعتماد';
      var cn = String(F.counted).trim() === '' ? NaN : Number(F.counted);
      if (!(cn >= 0)) e.counted = 'اكتب العدد الفعلي (صفر أو أكتر)';
      if (!e.date && R.storeStart() && F.date < R.storeStart()) e.date = 'التاريخ قبل بداية المخزن (' + R.storeStart() + ')';
    } else {
      if (!F.cat) e.cat = 'اختار التصنيف';
      if (!String(F.desc || '').trim()) e.desc = 'اكتب البيان';
      var a = Number(F.amount);
      if (!(a > 0)) e.amount = 'اكتب مبلغًا أكبر من صفر'; else if (a > expLeft()) e.amount = 'المبلغ أكبر من المتبقي في العهدة (' + money(expLeft()) + ')';
      if (!F.photo) e.photo = 'صوّر الإيصال قبل الحفظ؛ الصورة إجبارية';
    }
    return e;
  }
  function save() {
    F.errs = validate();
    var keys = Object.keys(F.errs);
    if (keys.length) {
      R.render(true);
      var first = document.getElementById('w-' + keys[0]); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return R.toast(keys.length === 1 ? 'فيه حقل محتاج تكمّله.' : 'فيه ' + keys.length + ' حقول محتاجة تكمّلها.');
    }
    var d = { type: F.type, project: S.project, date: F.date, photo: F.photo, notes: String(F.notes || '').trim(), loc: F.loc && !F.loc.err ? F.loc : null };
    if (F.type === 'permit') { d.party = F.party; d.item = F.item; d.qty = Number(F.qty); d.price = Number(F.price); d.paperNo = String(F.paperNo || '').trim(); d.sign = F.sign; }
    if (F.type === 'qty') { var c = qtyCalc(); d.boq = F.boq; d.qty = c.cur; d.kind = F.kind; d.exec = F.exec; if (F.kind === 'تراكمي') d.cumulative = Number(F.qty); }
    if (F.type === 'exp') { d.cat = F.cat; d.desc = String(F.desc).trim(); d.amount = Number(F.amount); }
    if (F.type === 'issue') { d.item = F.item; d.qty = Number(F.qty); d.exec = F.exec; d.boq = F.boq || ''; d.sign = F.sign; }
    if (F.type === 'count') { d.item = F.item; d.counted = Number(F.counted); d.qty = Math.round((d.counted - R.storeBal(F.item)) * 1000) / 1000; }
    var op = { action: F.edit ? 'resubmit' : 'submit', key: F.edit ? R.uid() : F.key, target: F.edit || null, at: Date.now(), doc: d };
    if (navigator.onLine === false) op.queuedAt = Date.now();
    var type = F.type, was = F.edit;
    R.queue(op);
    if (!was) R.store(draftKey(type), null);
    F = null;
    R.toast(navigator.onLine === false ? 'اتحفظ على الجهاز، وهيتبعت لما النت يرجع.' : was ? 'التعديل في الطريق للمراجع…' : 'اتحفظ، وبيتبعت للشيت دلوقتي…');
    if (type !== 'exp') S.tab.mine = storeType(type) ? 'store' : type;   /* «سجلاتي» تفتح على نوع المستند اللي اتحفظ */
    R.backTo(type === 'exp' ? 'custody' : 'mine');      /* النموذج ما يفضلش في الرجوع بعد الحفظ */
  }

  /* ---------- سجلاتي (2.3) ---------- */
  function viewMine() {
    var tab = S.tab.mine || (R.role() === 'eng' ? 'qty' : 'permit');
    var types = R.role() === 'eng' ? [['qty', 'المحاضر']] : [['permit', 'الإذونات'], ['qty', 'المحاضر'], ['exp', 'المصروفات']];
    var inTab = function (x, t) { return t === 'store' ? storeType(x.type) : x.type === t; };
    if (R.storeOn() || R.docs(function (x) { return R.isMine(x) && storeType(x.type); }).length || R.pendingDocs().some(function (x) { return storeType(x.type); })) types.push(['store', 'المخزن']);
    if (!types.some(function (t) { return t[0] === tab; })) tab = types[0][0];
    var mine = R.docs(function (x) { return R.isMine(x) && inTab(x, tab); }), pend = R.pendingDocs().filter(function (x) { return inTab(x, tab); });
    var rej = mine.filter(function (x) { return x.status === 'مرفوض'; }), reg = mine.filter(function (x) { return x.status === 'مسجَّل'; }).sort(function (a, b) { return a.at - b.at; }),
      ok = mine.filter(function (x) { return x.status === 'معتمد'; }).sort(function (a, b) { return (b.decidedAt || b.at) - (a.decidedAt || a.at); });
    var noun = { permit: 'إذونات', qty: 'محاضر', exp: 'مصروفات', store: 'صرف أو جرد' }[tab];
    var body = '';
    if (pend.length) body += R.gh('بانتظار المزامنة', pend.length, '', navigator.onLine === false ? 'تُرسل عند الاتصال' : 'جارٍ الإرسال') + '<div class="list">' + pend.map(function (x) { return R.docRow(x); }).join('') + '</div>';
    if (rej.length) body += R.gh('مرفوض — يحتاج تعديلك', rej.length, 'red') + '<div class="list">' + rej.map(function (x) { return R.docRow(x); }).join('') + '</div>';
    if (reg.length) body += R.gh('مسجَّل — بانتظار الاعتماد', reg.length, 'gold', 'الأقدم أولًا') + '<div class="list">' + reg.map(function (x) { return R.docRow(x, { noChip: true }); }).join('') + '</div>';
    if (ok.length) body += R.gh('معتمد', ok.length, 'green', 'مقفول للعرض') + '<div class="list">' + ok.slice(0, 20).map(function (x) { return R.docRow(x, { noChip: true }); }).join('') + '</div>';
    if (!body) body = '<div class="empty"><b>لم تسجّل ' + noun + ' بعد</b>كل ما تسجّله يظهر هنا بحالته حتى يُعتمد. ' + (tab === 'store' ? 'ابدأ من «مخزن الموقع» في القائمة.' :
      'ابدأ من «' + (tab === 'permit' ? 'إذن جديد' : tab === 'qty' ? 'محضر جديد' : 'العهدة') + '» في الشريط السفلي.') + '</div>';
    return R.head({ title: 'سجلاتي' }) + '<div class="tabs" role="tablist">' + types.map(function (t) {
      var n = R.pendingDocs().filter(function (x) { return inTab(x, t[0]); }).length + R.docs(function (x) { return R.isMine(x) && inTab(x, t[0]) && x.status === 'مرفوض'; }).length;
      return '<button role="tab" class="' + (t[0] === tab ? 'on' : '') + '" data-act="mine-tab" data-t="' + t[0] + '">' + t[1] + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div><main class="view flush">' + body + '</main>' + R.nav('mine');
  }

  /* ---------- العهدة (2.4) ---------- */
  function viewCustody() {
    var c = R.custody(), pct = c.amount ? Math.min(1, c.spent / c.amount) : 0;
    var list = R.docs(function (x) { return x.type === 'exp' && R.inCustody(x, c); }).concat(R.pendingDocs().filter(function (x) { return x.type === 'exp'; })).sort(function (a, b) { return b.at - a.at; });
    var canAdd = R.role() === 'site';
    return R.head({ title: 'العهدة', pbar: true }) + '<main class="view">' + R.strip() +
      '<div class="card pad"><div style="display:flex;align-items:center;gap:10px">' + R.lead('wallet', 'gold') +
      '<div style="flex:1"><div style="font-weight:800;font-size:15px;color:var(--navy)">عهدة رقم ' + (c.no || 1) + '</div><div style="font-size:12px;color:var(--muted)">صُرفت ' + (c.at ? R.dateShort(c.at) : '') + ' من ' + esc(c.from || 'الخزينة') + '</div></div>' +
      '<div style="font-weight:800;font-size:18px;color:var(--navy)">' + money(c.amount) + '</div></div>' +
      '<div style="margin-top:12px"><div class="prog" style="height:12px"><i style="width:' + (pct * 100).toFixed(1) + '%;background:var(--navy-2)"></i><i style="width:' + ((1 - pct) * 100).toFixed(1) + '%;background:var(--green)"></i></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;margin-top:6px"><span style="color:var(--navy-2)">المصروف ' + money(c.spent) + '</span><span style="color:' + (c.left < c.amount * 0.15 ? 'var(--red)' : 'var(--green)') + '">المتبقي ' + money(c.left) + '</span></div></div></div>' +
      (canAdd ? '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn" style="flex:1" data-act="go" data-to="new/exp">' + IC.plus + 'سجّل مصروف</button><button class="btn out" data-act="renew">' + IC.sync + 'طلب تجديد</button></div>' : '') +
      '<div class="sect">مصروفات العهدة<span class="s">' + list.length + ' — الأحدث أولًا</span></div>' +
      (list.length ? '<div class="list boxed">' + list.map(function (x) { return R.docRow(x); }).join('') + '</div>' : '<div class="card empty"><b>لا مصروفات بعد</b>سجّل أول مصروف بصورة إيصاله.</div>') +
      '</main>' + R.nav('custody');
  }

  /* ---------- الربط بالنواة ---------- */
  R.views.new = viewForm;
  R.views.edit = viewForm;
  R.views.mine = viewMine;
  R.views.custody = viewCustody;
  R.acts.pick = function (b) { pick(b.getAttribute('data-f')); };
  R.acts.seg = function (b) {
    var k = b.getAttribute('data-f'), v = b.getAttribute('data-v');
    if (k === 'exec' && v === 'sub') { F.exec = 'sub'; saveDraft(); R.render(true); return pick('sub'); }
    F[k] = v; delete F.errs[k]; saveDraft(); R.render(true);
  };
  R.acts.loc = function () { F.loc = null; asked = F.key; paintLoc(); locate(); };
  R.acts['sig-clear'] = function () {
    if (F.sign) R.blob.del(F.sign); F.sign = ''; saveDraft();
    var box = $('#sig'), cv = box && box.querySelector('canvas'); if (cv) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    if (box) box.querySelector('.hint').hidden = false;
  };
  R.acts.save = function () { save(); };
  R.acts.cancel = function () {
    var t = F && F.type, ed = F && F.edit;
    if (F && !ed) { R.store(draftKey(t), null); if (F.photo) R.blob.del(F.photo); if (F.sign) R.blob.del(F.sign); }
    F = null; R.back();
  };
  R.acts['mine-tab'] = function (b) { S.tab.mine = b.getAttribute('data-t'); R.render(); };
  R.acts.renew = function () {
    var c = R.custody();
    R.confirmBox({ title: 'طلب تجديد العهدة؟', text: 'هيوصل لمحاسب المشروع إشعار بالمتبقي (' + money(c.left) + ') وكشف المصروفات.', ok: 'إرسال الطلب', onOk: function () {
      if (R.LIVE) R.post(R.CFG.WRITE_URL, { action: 'custodyRenew', idToken: S.token, project: S.project }).then(function (r) { R.toast(r && r.ok ? 'وصل طلب التجديد لمحاسب المشروع.' : 'الطلب ما وصلش؛ جرّب تاني.'); });
      else R.toast('وصل طلب التجديد لمحاسب المشروع.');
    } });
  };
  R.inputs.push(function (e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-f'); if (!k || !F) return false;
    var v = e.target.value;
    if (k === 'qty' || k === 'price' || k === 'amount' || k === 'counted') v = v.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.]/g, '');
    if (v !== e.target.value) e.target.value = v;
    F[k] = v; if (k === 'price') F.priceSet = true;
    if (F.errs[k]) { delete F.errs[k]; var w = document.getElementById('e-' + k); if (w) w.remove(); var fb = e.target.closest('.fb'); if (fb) fb.classList.remove('err'); }
    if (F.type === 'permit') { var t = $('#f-total'); if (t) t.textContent = permitTotal() != null ? money(permitTotal()) : '—'; var pw = $('#f-pricewarn'); if (pw && (k === 'price')) pw.innerHTML = priceWarn(); }
    if (F.type === 'qty') { var c = qtyCalc(), ov = $('#f-over'), fv = $('#f-value'); if (ov) ov.innerHTML = qtyAlert(); if (fv) fv.textContent = c.value != null ? money(c.value) : '—'; }
    if (F.type === 'exp') { var l = $('#f-left'); if (l) { var left = expLeft() - (Number(F.amount) || 0); l.textContent = money(left); l.style.color = left < 0 ? 'var(--red)' : 'var(--green)'; } }
    if (F.type === 'issue') { var sl = $('#f-left'); if (sl) { var lf = storeLeft(); sl.textContent = num(lf); sl.style.color = lf < 0 ? 'var(--red)' : 'var(--green)'; } }
    if (F.type === 'count') { var df = $('#f-diff'); if (df) df.innerHTML = diffHtml(); }
    saveDraft(); return true;
  });
  R.changes.push(function (e) {
    if (e.target.id !== 'f-photo-in' || !F) return false;
    var file = e.target.files && e.target.files[0]; if (!file) return true;
    var f = F; R.toast('بنجهّز الصورة…');
    shrink(file).then(function (data) {
      if (F !== f) return;
      var k = F.key + ':photo:' + Date.now();
      if (F.photo && F.photo.indexOf(F.key) === 0) R.blob.del(F.photo);
      return R.blob.put(k, data).then(function () { F.photo = k; delete F.errs.photo; saveDraft(); R.render(true); });
    }).catch(function () { R.toast('الصورة ما اتقرتش. جرّب تصوّر تاني.'); });
    return true;
  });
  R.on.render = (R.on.render || []).concat([function (r) {
    if ((r.name === 'new' || r.name === 'edit') && F) {
      sigAttach();
      if (!F.loc && asked !== F.key) { asked = F.key; locate(); }
    }
  }]);
});
