/* الاعتماد: صندوق الاعتماد (3.1)، مراجعة المستند واعتماده (3.2)، الرفض وإعادة الإرسال (3.3).
   نفس شاشة المستند بتتفتح للمُدخِل (للعرض، وللتعديل لو اترفض) وللمعتمِد (للقرار). */
(window.BDW_EXT = window.BDW_EXT || []).push(function (R) {
  'use strict';
  var S = R.S, IC = R.IC, esc = R.esc, num = R.num, money = R.money;
  var REASONS = ['صورة غير واضحة', 'السعر غير مطابق', 'الكمية غير مطابقة', 'مورد أو صنف خطأ', 'مستند مكرر', 'أخرى'];
  var TABS = {
    acc: [['permit', 'الإذونات'], ['exp', 'المصروفات'], ['voucher', 'السندات']],
    admin: [['permit', 'الإذونات'], ['exp', 'المصروفات'], ['voucher', 'السندات'], ['stmt', 'المستخلصات'], ['qty', 'المحاضر']],
    eng: [['qty', 'المحاضر'], ['stmt', 'المستخلصات']],
    owner: [['voucher', 'السندات'], ['stmt', 'المستخلصات'], ['qty', 'المحاضر']]
  };
  var ONE = { permit: 'إذن', qty: 'محضر', exp: 'مصروف', voucher: 'سند', stmt: 'مستخلص' };
  var rej = { reason: '', note: '', key: '', err: '' };
  var busy = false;

  /* ---------- اللي بيشوفه المراجع قبل القرار ---------- */
  function warnings(x) {
    var w = [], st = S.data.settings, p = R.project(x.project);
    if (x.type === 'permit') {
      if (!(x.price > 0)) w.push(['err', x.status === 'معتمد' ? 'اعتُمد بدون سعر؛ قيمته مش داخلة في الحسابات لحد ما السعر يتسجّل.' : 'الإذن بدون سعر؛ يتعدّل قبل الاعتماد.']);
      else {
        var lp = S.data.lastPrice[x.party + '|' + x.item];
        if (lp == null) w.push(['info', 'أول توريد لهذا الصنف من المورد ده؛ مفيش سعر سابق للمقارنة.']);
        else {
          var d = (x.price - lp) / lp;
          if (Math.abs(d) > (st.priceWarnPct || 0.05)) w.push(['warn', 'السعر ' + (d > 0 ? 'أعلى' : 'أقل') + ' من آخر سعر معتمد (' + money(lp) + ') بنسبة <b>' + num(Math.abs(d) * 100, 1) + '%</b>.']);
          else w.push(['ok', 'السعر مطابق لآخر سعر معتمد (' + money(lp) + ').']);
        }
      }
      if (!x.sign) w.push(['warn', 'بدون توقيع المستلم.']);
    }
    if (x.type === 'qty') {
      var o = R.overrun(x);
      if (o.after != null && o.after > 1) w.push(['warn', 'بعد هذا المحضر يصبح المنفّذ <b>' + num(o.done) + ' ' + esc(o.b.unit) + ' = ' + num(o.after * 100, 0) + '%</b> من كمية المقايسة (' + num(o.b.qty) + ').']);
      if (x.exec && x.exec !== 'ذاتي' && S.data.rates[x.exec + '|' + x.boq] == null) w.push(['warn', 'لا توجد فئة لهذا البند في عقد ' + esc(R.party(x.exec).name) + '؛ قيمته في مستخلصه صفر لحد ما الفئة تتضاف.']);
    }
    if (x.type === 'permit' || x.type === 'qty') {
      if (!x.loc) w.push(['warn', 'اتسجّل بدون تحديد الموقع.']);
      else {
        var km = x.loc.dist != null ? x.loc.dist : R.km(x.loc, p);
        if (km != null) w.push(km <= (st.siteRadiusKm || 2) ? ['ok', 'اتسجّل داخل نطاق المشروع، على بعد ' + num(km, 1) + ' كم.'] : ['warn', 'اتسجّل على بعد <b>' + num(km, 1) + ' كم</b> من موقع المشروع.']);
      }
    }
    if ((x.type === 'permit' || x.type === 'qty' || x.type === 'exp') && !x.photo) w.push(['err', 'بدون صورة المستند.']);
    if (x.type === 'voucher') {
      if (x.amount > (st.voucherLimit || 0)) w.push(['info', 'فوق حد اعتماد المحاسب (' + money(st.voucherLimit) + ')، فاعتماده للمالك.']);
      var bal = (S.data.balances || {})[x.party];
      if (bal != null && bal < 0) w.push(['err', 'رصيد ' + esc(R.party(x.party).name) + ': <b>مدفوع له بالزيادة ' + money(-bal) + '</b>. الصرف ده يزوّد الزيادة.']);
    }
    if (x.type === 'stmt') {
      w.push(x.techOk ? ['ok', 'اعتماد فني: ' + esc(x.techBy || 'المهندس') + ' — ' + R.when(x.techAt)] : ['info', 'مستني الاعتماد الفني من المهندس.']);
    }
    return w;
  }
  function clean(x) { return !warnings(x).some(function (w) { return w[0] === 'warn' || w[0] === 'err'; }); }
  function alertHtml(w) { var icon = { warn: 'alert', err: 'bad', ok: 'ok', info: 'info' }[w[0]]; return '<div class="alert ' + w[0] + '">' + IC[icon] + '<div>' + w[1] + '</div></div>'; }
  function canDecide(x) { return R.inboxDocs().some(function (y) { return y.key === x.key; }); }
  function stage(x) { return x.type === 'stmt' && !x.techOk ? 'tech' : 'approve'; }
  function waiting(n) { return n === 1 ? 'مستند واحد ينتظرك' : n === 2 ? 'مستندان ينتظرانك' : n <= 10 ? n + ' مستندات تنتظرك' : n + ' مستندًا ينتظرك'; }
  function thumb(x) { return x.photo ? '<span class="thumb" data-photo="' + esc(x.photo) + '" data-kind="' + x.type + '"></span>' : R.lead(R.ICON[x.type], 'gold'); }

  /* سجل المستند: من الـlog، ومعاه أي حدث محفوظ في الحقول بس مش مكتوب فيه */
  function history(x) {
    var log = (x.log || []).slice(), has = function (re) { return log.some(function (l) { return re.test(l[1]); }); };
    if (!has(/^سُجّل/)) log.push([x.at, 'سُجّل', x.byName || '']);
    if (x.techOk && x.techAt && !has(/^اعتماد فني/)) log.push([x.techAt, 'اعتماد فني', x.techBy || '']);
    if (x.status === 'معتمد' && x.decidedAt && !has(/^اعتُمد/)) log.push([x.decidedAt, 'اعتُمد', x.decidedBy || '']);
    if (x.status === 'مرفوض' && x.decidedAt && !has(/^رُفض/)) log.push([x.decidedAt, 'رُفض: ' + (x.reason || ''), x.decidedBy || '']);
    return log.sort(function (a, b) { return a[0] - b[0]; });
  }

  /* ---------- صندوق الاعتماد (3.1) ---------- */
  function viewInbox() {
    var tabs = TABS[R.role()] || TABS.acc, all = R.inboxDocs();
    var tab = S.tab.inbox;
    if (!tabs.some(function (t) { return t[0] === tab; })) {
      var withDocs = tabs.filter(function (t) { return all.some(function (x) { return x.type === t[0]; }); })[0];
      tab = (withDocs || tabs[0])[0];
    }
    var list = all.filter(function (x) { return x.type === tab; }), late = S.data.settings.lateDays || 3;
    var body = list.length ? '<div style="padding:10px 12px 2px">' + alertHtml(['info', '<b>' + waiting(list.length) + '</b> — ' + (list.length === 1 ? 'وصل ' : 'أقدمها ') + R.ago(list[0].at)]) + '</div>' +
      '<div class="list">' + list.map(function (x) {
        var old = Date.now() - x.at > late * 864e5, v = R.value(x), simple = x.type === 'permit' || x.type === 'exp' || x.type === 'qty', ok = clean(x);
        var end = simple && ok
          ? '<span class="ra"><button class="y" data-act="quick" data-key="' + esc(x.key) + '" aria-label="اعتماد ' + esc(x.id || '') + '">' + IC.check + '</button><button class="n" data-act="reject" data-key="' + esc(x.key) + '" aria-label="رفض ' + esc(x.id || '') + '">' + IC.x + '</button></span>'
          : ok ? '<span class="cv" style="color:var(--faint)">' + IC.next + '</span>' : '<span class="chip c-reg">' + IC.alert + 'راجِع</span>';
        return '<div class="row"><button class="rmain" data-act="doc" data-key="' + esc(x.key) + '">' + thumb(x) +
          '<span class="rm"><span class="rt">' + esc(R.title(x)) + '</span><span class="rs">' + esc(R.sub(x)) + '</span>' +
          '<span class="rx' + (old ? ' red' : '') + '">' + R.ago(x.at) + (v != null ? ' — <b style="color:var(--navy)">' + money(v) + '</b>' : '') + '</span></span></button>' + end + '</div>';
      }).join('') + '</div><div style="text-align:center;font-size:12px;color:var(--faint);padding:14px">الأقدم أولًا — المس المستند لمراجعته</div>'
      : '<div class="empty"><b>لا شيء ينتظر اعتمادك هنا</b>أي ' + ONE[tab] + ' جديد يوصلك هنا، ومعاه إشعار على الموبايل.</div>';
    return R.head({ title: 'الاعتماد', pbar: true }) + '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      var n = all.filter(function (x) { return x.type === t[0]; }).length;
      return '<button role="tab" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '" data-act="inbox-tab" data-t="' + t[0] + '">' + t[1] + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div><main class="view flush">' + body + '</main>' + R.nav('inbox');
  }

  /* ---------- المستند (3.2) ---------- */
  function fields(x) {
    var kv = [], sub = x.exec && x.exec !== 'ذاتي';
    if (x.type === 'permit') { var it = R.item(x.item); kv = [['الصنف', it.name], ['الكمية', num(x.qty) + ' ' + it.unit], ['سعر الوحدة', x.price ? money(x.price) : '—'], ['الإجمالي', money(R.value(x))], ['رقم الإذن الورقي', x.paperNo || '—'], ['التاريخ', x.date]]; }
    if (x.type === 'qty') {
      var b = R.boq(x.boq), c = sub ? S.data.rates[x.exec + '|' + x.boq] : null;
      kv = [['البند', x.boq], ['الكمية', num(x.qty) + ' ' + b.unit + (x.kind === 'تراكمي' && x.cumulative != null ? ' (من تراكمي ' + num(x.cumulative) + ')' : '')],
        ['المنفّذ', sub ? R.party(x.exec).name : 'تنفيذ ذاتي'], ['القيمة بسعر الجهاز', money(R.value(x))]];
      if (sub) kv.push(['قيمة الباطن', c != null ? money(c * x.qty) : 'بلا فئة']);
      kv.push(['التاريخ', x.date]);
    }
    if (x.type === 'exp') kv = [['التصنيف', x.cat], ['المبلغ', money(x.amount)], ['التاريخ', x.date], ['العهدة', 'رقم ' + ((S.data.custody || {}).no || 1)]];
    if (x.type === 'voucher') kv = [['المبلغ', money(x.amount)], ['طريقة الدفع', x.method || '—'], ['من', x.from || '—'], ['الحساب', x.account || '—']];
    if (x.type === 'stmt') kv = [['إجمالي الأعمال', money(x.gross)], ['الصافي المستحق', money(x.net)], ['المدفوع', money(x.paid)], ['المتبقي', money(x.net - x.paid)]];
    return '<div class="kv2">' + kv.map(function (k) { return '<div><div class="k">' + k[0] + '</div><div class="v">' + esc(k[1]) + '</div></div>'; }).join('') + '</div>';
  }
  function heading(x) {
    if (x.type === 'permit' || x.type === 'voucher' || x.type === 'stmt') return R.party(x.party).name;
    if (x.type === 'qty') return R.boq(x.boq).name;
    return x.desc;
  }
  function viewDoc(r) {
    var x = R.byKey(r.sub);
    if (!x) {
      var p = R.pendingDocs().filter(function (y) { return y.key === r.sub; })[0];
      if (p) return R.head({ title: 'بانتظار المزامنة', back: true }) + '<main class="view"><div class="list boxed">' + R.docRow(p) + '</div><div class="alert info" style="margin-top:10px">' + IC.upload + '<div>المستند محفوظ على الجهاز وهيتبعت أول ما النت يوصل، وبعدها ياخد رقمه من الشيت.</div></div></main>' + R.nav('');
      return R.head({ title: 'مستند', back: true }) + '<main class="view"><div class="empty"><b>المستند ده مش موجود</b>ممكن يكون اتلغى أو تبع مشروع تاني.</div></main>' + R.nav('');
    }
    var decide = canDecide(x), mine = R.isMine(x), st = stage(x);
    var hero = x.photo ? '<button class="dhero" data-act="zoom" data-ref="' + esc(x.photo) + '" data-kind="' + x.type + '" data-photo="' + esc(x.photo) + '" aria-label="تكبير صورة المستند" data-ov="' + esc('<span class="ov">' + IC.eye + ' المس للتكبير</span>') + '"></button>' : '';
    var who = '<div class="who">' + IC.user + '<span>سجّله ' + esc(x.byName || 'المُدخِل') + ' — ' + R.when(x.at) + (x.type === 'permit' && x.sign ? ' — توقيع المستلم ✓' : '') + '</span></div>';
    var rejBox = x.status === 'مرفوض' ? '<div class="alert err" style="margin-top:10px">' + IC.bad + '<div><b>رفضه ' + esc(x.decidedBy || 'المراجع') + ': ' + esc(x.reason || '') + '</b>' + (x.note ? '<br>«' + esc(x.note) + '»' : '') + '</div></div>' : '';
    var lock = x.status === 'معتمد' ? '<span class="lockt">' + IC.lock + 'مقفول بعد الاعتماد</span>' : '';
    var tl = '<div class="sect" style="margin-top:16px">سجل المستند</div><div class="tlx">' + history(x).map(function (l) {
      var cls = /^اعتُمد|^اعتماد|^رُحِّل/.test(l[1]) ? ' ok' : /^رُفض/.test(l[1]) ? ' rej' : '';
      return '<div class="st' + cls + '"><div class="a">' + esc(l[1]) + (l[2] ? ' — ' + esc(l[2]) : '') + '</div><div class="b">' + R.when(l[0]) + '</div></div>';
    }).join('') + '</div>';
    var foot = '';
    if (decide) {
      var okT = x.type === 'stmt' ? (st === 'tech' ? 'اعتماد فني' : 'اعتماد نهائي') : 'اعتماد';
      foot = '<div class="fbar"><button class="btn" data-act="approve" data-key="' + esc(x.key) + '">' + IC.check + okT + '</button><button class="btn dng fit" data-act="reject" data-key="' + esc(x.key) + '">' + IC.x + 'رفض</button></div>';
    } else if (mine && x.status === 'مرفوض' && (x.type === 'permit' || x.type === 'qty' || x.type === 'exp')) {
      foot = '<div class="fbar"><button class="btn" data-act="go" data-to="edit/' + encodeURIComponent(x.key) + '">' + IC.edit + 'عدّل وأعد الإرسال</button></div>';
    }
    var date = x.date ? R.dateLong(new Date(x.date + 'T12:00').getTime()) : '';
    return R.head({ title: x.id || R.TYPE[x.type], back: true }) + '<main class="view ' + (foot ? 'form-view' : 'flush') + '" style="background:#fff">' + hero +
      '<div style="padding:14px">' +
      '<div class="dmeta">' + R.chip(x.status) + '<span>' + R.TYPE[x.type] + (date ? ' — ' + esc(date) : '') + '</span>' + lock + '</div>' +
      '<h2 class="dtitle">' + esc(heading(x)) + '</h2>' + fields(x) +
      (x.notes ? '<div class="fh" style="margin-top:8px;font-size:12.5px">ملاحظات: ' + esc(x.notes) + '</div>' : '') +
      '<div style="margin-top:12px">' + warnings(x).map(alertHtml).join('') + '</div>' + who + rejBox + tl + '</div></main>' + (foot || R.nav(''));
  }

  /* ---------- الرفض (3.3) ---------- */
  function viewReject(r) {
    var x = R.byKey(r.sub);
    if (!x || !canDecide(x)) return viewDoc(r);
    if (rej.key !== x.key) rej = { reason: '', note: '', key: x.key, err: '' };
    var v = R.value(x);
    var summary = '<div class="card" style="display:flex;gap:10px;align-items:center;padding:10px">' + thumb(x) +
      '<span class="rm"><span class="rt">' + esc(R.title(x)) + '</span><span class="rs">' + esc(R.sub(x)) + (x.type === 'permit' && x.price ? ' × ' + money(x.price) : '') + '</span>' + (v != null ? '<span class="amt">' + money(v) + '</span>' : '') + '</span></div>';
    return R.head({ title: 'رفض ' + (x.id || ''), back: true, noSync: true }) + '<main class="view form-view"><div class="form">' + summary + '<div style="height:14px"></div>' +
      '<div class="fld" id="w-reason"><div class="fl">سبب الرفض<span class="rq">*</span></div><div class="seg g2" role="radiogroup" aria-label="سبب الرفض">' + REASONS.map(function (t) {
        return '<button type="button" role="radio" aria-checked="' + (rej.reason === t) + '" class="' + (rej.reason === t ? 'on' : '') + '" data-act="rej-reason" data-v="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>' + (rej.err === 'reason' ? '<div class="fe">' + IC.alert + 'اختار سبب الرفض</div>' : '') + '</div>' +
      '<div class="fld"><label class="fl" for="rej-note">ملاحظة للمُدخِل' + (rej.reason === 'أخرى' ? '<span class="rq">*</span>' : '') + '</label><div class="fb' + (rej.err === 'note' ? ' err' : '') + '"><textarea id="rej-note" rows="3" placeholder="اكتب المطلوب تعديله بالظبط">' + esc(rej.note) + '</textarea></div>' +
      '<div class="fh">بتوصل زي ما هي مع إشعار الرفض، والمستند يرجع له يعدّله ويعيد إرساله.</div>' + (rej.err === 'note' ? '<div class="fe">' + IC.alert + 'مع «أخرى» اكتب السبب في الملاحظة</div>' : '') + '</div></div></main>' +
      '<div class="fbar"><button class="btn dngf" data-act="rej-confirm" data-key="' + esc(x.key) + '">' + IC.x + 'رفض المستند</button><button class="btn out fit" data-act="back">رجوع</button></div>';
  }

  /* ---------- القرارات ---------- */
  function approveText(x) {
    var j = R.journal(x);
    if (x.type === 'stmt') return stage(x) === 'tech' ? ['اعتماد فني لـ ' + x.id + '؟', 'يروح للمالك للاعتماد النهائي.'] : ['اعتماد نهائي لـ ' + x.id + '؟', 'الصافي (' + money(x.net) + ') يبقى مستحق الصرف، وPDF المستخلص يتبعت بالبريد.'];
    if (x.type === 'qty') return ['اعتماد ' + x.id + '؟', 'المحضر يتقفل ويدخل في مستخلص الفترة.'];
    return ['اعتماد ' + (x.id || '') + '؟', 'المستند يتقفل' + (j ? ' ويترحّل في اليومية: ' + j : '') + '.'];
  }
  function fail(res) { R.toast(res && res.error === 'offline' ? 'القرار محتاج نت. جرّب أول ما النت يرجع.' : 'القرار ما اتسجّلش' + (res && (res.message || res.error) ? ': ' + (res.message || res.error) : '') + '.'); }
  function doApprove(x, fromList) {
    var st = stage(x), t = approveText(x);
    R.confirmBox({ title: t[0], text: t[1], ok: x.type === 'stmt' ? (st === 'tech' ? 'اعتماد فني' : 'اعتماد نهائي') : 'اعتماد', onOk: function () {
      if (busy) return; busy = true;
      R.decide(x, st === 'tech' ? 'tech' : 'approve').then(function (res) {
        busy = false;
        if (!res || !res.ok) return fail(res);
        R.toast(st === 'tech' ? 'اعتماد فني لـ ' + x.id + '، ووصل للمالك.' : 'اتعتمد ' + (x.id || '') + '.');
        if (fromList) R.render(true); else R.backTo('inbox');
      });
    } });
  }
  R.views.inbox = viewInbox;
  R.views.doc = viewDoc;
  R.views.reject = viewReject;
  R.acts['inbox-tab'] = function (b) { S.tab.inbox = b.getAttribute('data-t'); R.render(); };
  R.acts.quick = function (b) { var x = R.byKey(b.getAttribute('data-key')); if (x) doApprove(x, true); };
  R.acts.approve = function (b) { var x = R.byKey(b.getAttribute('data-key')); if (x) doApprove(x, false); };
  R.acts.reject = function (b) { R.go('reject/' + encodeURIComponent(b.getAttribute('data-key'))); };
  R.acts['rej-reason'] = function (b) {
    var n = document.getElementById('rej-note'); if (n) rej.note = n.value;
    rej.reason = b.getAttribute('data-v'); rej.err = ''; R.render(true);
    if (rej.reason === 'أخرى') { var t = document.getElementById('rej-note'); if (t) t.focus(); }
  };
  R.acts['rej-confirm'] = function (b) {
    var x = R.byKey(b.getAttribute('data-key')); if (!x) return;
    var n = document.getElementById('rej-note'); rej.note = n ? n.value.trim() : String(rej.note || '').trim();
    if (!rej.reason) { rej.err = 'reason'; return R.render(true); }
    if (rej.reason === 'أخرى' && !rej.note) { rej.err = 'note'; R.render(true); var t = document.getElementById('rej-note'); if (t) t.focus(); return; }
    R.confirmBox({ title: 'رفض ' + (x.id || '') + '؟', text: 'يرجع لـ' + (x.byName || 'المُدخِل') + ' بالسبب «' + rej.reason + '»' + (rej.note ? ' والملاحظة' : '') + ' عشان يعدّله ويعيد إرساله.', ok: 'رفض المستند', okCls: 'dngf', onOk: function () {
      if (busy) return; busy = true;
      R.decide(x, 'reject', { reason: rej.reason, note: rej.note }).then(function (res) {
        busy = false;
        if (!res || !res.ok) return fail(res);
        R.toast('اترفض ' + (x.id || '') + '، ووصل السبب لـ' + (x.byName || 'المُدخِل') + '.');
        rej = { reason: '', note: '', key: '', err: '' };
        R.backTo('inbox');
      });
    } });
  };
  R.acts.zoom = function (b) {
    var el = document.getElementById('sheet'); el.className = 'sheet center'; el.hidden = false;
    el.innerHTML = '<div class="zoomwrap"><div class="zoom" data-photo="' + esc(b.getAttribute('data-ref')) + '" data-kind="' + esc(b.getAttribute('data-kind')) + '"></div>' +
      '<button class="btn out wide" style="margin-top:10px" data-act="sheet-close">إغلاق</button></div>';
    R.fillPhotos(el);
  };
  R.inputs.push(function (e) { if (e.target.id !== 'rej-note') return false; rej.note = e.target.value; if (rej.err === 'note' && rej.note.trim()) rej.err = ''; return true; });
});
