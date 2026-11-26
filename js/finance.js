/* المالية والإدارة: المستخلصات وتفاصيلها (4.1)، مستخلص جديد (4.2)، السندات وسند جديد (4.3)، الأطراف وبطاقة الطرف (4.4)، لوحة المشروع (5.1).
   من السكريبت: كل المستخلصات كمستندات، وكل المحاضر والسندات بشكل مختصر، وأرقام اللوحة محسوبة بنفس معادلات ملف التقارير. */
(window.BDW_EXT = window.BDW_EXT || []).push(function (R) {
  'use strict';
  var S = R.S, IC = R.IC, esc = R.esc, num = R.num, money = R.money, short = R.short;
  var $ = function (s) { return document.querySelector(s); };
  var SUB = 'مقاول باطن', CLIENT = 'عميل', SUPPLIER = 'مورد';
  /* أعمدة المحضر المختصر والسند المختصر (نفس ترتيب السكريبت) */
  var Q = { id: 0, date: 1, item: 2, qty: 3, cprice: 4, cvalue: 5, sub: 6, rate: 7, svalue: 8, cs: 9, ss: 10, st: 11 };
  var FS = null, FV = null, form = '';           /* نموذج المستخلص، نموذج السند، واللي مفتوح فيهم */
  var openAfter = null, busy = false;

  function office() { var r = R.role(); return r === 'acc' || r === 'admin'; }
  function data(k) { return (S.data && S.data[k]) || []; }
  function noon(iso) { return new Date(iso + 'T12:00').getTime(); }
  function dLong(iso) { return iso ? R.dateLong(noon(iso)) : ''; }
  function pct(x) { var p = (Number(x) || 0) * 100; return num(p, Math.abs(p - Math.round(p)) > 0.04 ? 1 : 0) + '%'; }
  /* العدد مع المعدود: محضر، محضرين، 3 محاضر، 11 محضرًا */
  function count(n, one, two, few, many) { return n === 1 ? one : n === 2 ? two : n <= 10 ? n + ' ' + few : n + ' ' + many; }
  function itemName(c) { var b = R.boq(c); return b.name && b.name !== c ? b.name : R.item(c).name; }
  function unitOf(c) { var b = R.boq(c); return b.unit || R.item(c).unit || ''; }
  function alertBox(cls, html) { var icon = { warn: 'alert', err: 'bad', ok: 'ok', info: 'info' }[cls]; return '<div class="alert ' + cls + '">' + IC[icon] + '<div>' + html + '</div></div>'; }
  function stripWrap() { var s = R.strip(); return s ? '<div style="padding:10px 12px 0">' + s + '</div>' : ''; }
  function kv(k, v, cls) { return '<div><div class="k">' + k + '</div><div class="v' + (cls ? ' ' + cls : '') + '">' + v + '</div></div>'; }

  /* ---------- الأرصدة: له + / عليه − من اليومية ---------- */
  function balInfo(code) {
    var b = (S.data.balances || {})[code] || 0, t = R.party(code).type;
    if (Math.abs(b) < 0.5) return { amt: 0, txt: 'متوازن', cls: 'gray' };
    if (t === CLIENT) return b < 0 ? { amt: -b, txt: 'مستحق على العميل', cls: 'green' } : { amt: b, txt: 'مقبوض بالزيادة', cls: 'navy' };
    return b > 0 ? { amt: b, txt: 'مستحق له', cls: 'green' } : { amt: -b, txt: 'مدفوع بالزيادة', cls: 'red', neg: true };
  }
  function balNum(i) { return i.neg ? '(' + num(i.amt) + ')' : num(i.amt); }
  var PICON = {}; PICON[SUB] = ['hat', 'navy']; PICON[SUPPLIER] = ['truck', 'gold']; PICON[CLIENT] = ['building', 'green'];
  function pIcon(t) { return PICON[t] || ['user', 'gray']; }

  /* ======================= المستخلصات (4.1) ======================= */
  function stmtDocs() { return R.docs(function (x) { return x.type === 'stmt'; }); }
  function isClient(x) { return x.kind === CLIENT; }
  function stmtById(id) { return (S.data.docs || []).filter(function (x) { return x.type === 'stmt' && x.id === id; })[0] || null; }
  function kindLabel(x) { return (isClient(x) ? 'مستخلص عميل' : 'مستخلص') + (x.extNo && x.extNo !== 'جارٍ' ? ' رقم ' + x.extNo : ' جارٍ'); }
  /* البنود: المحاضر المربوطة بالمستخلص، متجمّعة بالبند */
  function linesOf(x) {
    var client = isClient(x), col = client ? Q.cs : Q.ss, groups = {}, order = [];
    var recs = data('qtyAll').filter(function (q) { return q[col] === x.id; });
    recs.forEach(function (q) {
      var k = q[Q.item], g = groups[k];
      if (!g) { g = groups[k] = { item: k, qty: 0, value: 0, rate: client ? q[Q.cprice] : q[Q.rate], n: 0, noRate: false }; order.push(g); }
      g.qty += q[Q.qty]; g.value += client ? q[Q.cvalue] : q[Q.svalue]; g.n++;
      if (!client && !(q[Q.rate] > 0)) g.noRate = true;
    });
    order.sort(function (a, b) { return b.value - a.value; });
    return { recs: recs, groups: order };
  }
  var ORDER = ['مسودة', 'تحت المراجعة', 'مرفوض', 'معتمد', 'ملغى'];
  var GNAME = { 'مسودة': 'مسودات لم تُرسل', 'تحت المراجعة': 'تحت المراجعة', 'مرفوض': 'مرفوض', 'معتمد': 'معتمد', 'ملغى': 'ملغى' };
  var GTONE = { 'مسودة': '', 'تحت المراجعة': 'gold', 'مرفوض': 'red', 'معتمد': 'green', 'ملغى': '' };
  function stmtMeta(x) {
    if (x.status === 'تحت المراجعة') return x.techOk ? 'اعتماد فني ✓ — ينتظر المالك' : 'ينتظر الاعتماد الفني';
    if (x.status === 'معتمد') return 'اعتُمد ' + (x.approvedAt ? R.dateShort(noon(x.approvedAt)) : R.when(x.decidedAt || x.at));
    if (x.status === 'مسودة') return 'أنشأه ' + (x.byName || 'المحاسب') + ' — ' + R.when(x.at);
    if (x.status === 'مرفوض') return 'السبب: ' + (x.reason || '—');
    return 'اتلغى وفُكّت محاضره';
  }
  function stmtRow(x) {
    var ded = (x.ded || 0) + (x.adv || 0);
    return '<button class="row" data-act="f-stmt" data-id="' + esc(x.id) + '">' + R.lead('stmt', R.toneOf(x.status)) +
      '<span class="rm"><span class="rt">' + esc(x.id + ' — ' + R.party(x.party).name) + '</span><span class="rs">' + esc(kindLabel(x) + ' — ' + dLong(x.date)) + '</span>' +
      '<span class="rx' + (x.status === 'مرفوض' ? ' red' : '') + '">' + esc(stmtMeta(x) + (ded ? ' — خصومات ' + num(ded) : '')) + '</span></span>' +
      '<span class="re"><span class="amt">' + money(x.net) + '</span>' + R.chip(x.status) + '</span></button>';
  }
  function viewStmts() {
    var tab = S.tab.stmts === CLIENT ? CLIENT : SUB, all = stmtDocs();
    var inTab = function (x, t) { return t === CLIENT ? isClient(x) : !isClient(x); };
    var list = all.filter(function (x) { return inTab(x, tab); }), body = '';
    ORDER.forEach(function (st) {
      var g = list.filter(function (x) { return x.status === st; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)); });
      if (!g.length) return;
      var sum = g.reduce(function (s, x) { return s + (x.net || 0); }, 0);
      body += R.gh(GNAME[st], g.length, GTONE[st], 'الصافي ' + short(sum)) + '<div class="list">' + g.map(stmtRow).join('') + '</div>';
    });
    if (!body) body = '<div class="empty"><b>' + (tab === CLIENT ? 'لا مستخلصات للعميل بعد' : 'لا مستخلصات لمقاولي الباطن بعد') + '</b>' +
      (office() ? 'المستخلص بيتعمل من المحاضر المعتمدة بزر «+».' : 'أول ما محاسب المشروع يعمل مستخلص هيظهر هنا.') + '</div>';
    var tabs = [[SUB, 'مقاولو الباطن'], [CLIENT, 'العميل']];
    return R.head({ title: 'المستخلصات', pbar: true }) + '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      var n = all.filter(function (x) { return inTab(x, t[0]) && (x.status === 'مسودة' || x.status === 'تحت المراجعة' || x.status === 'مرفوض'); }).length;
      return '<button role="tab" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '" data-act="f-tab" data-k="stmts" data-t="' + t[0] + '">' + t[1] + (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div><main class="view flush">' + stripWrap() + body + '</main>' +
      (office() ? '<button class="fab" data-act="go" data-to="add/stmt" aria-label="مستخلص جديد">' + IC.plus + '</button>' : '') + R.nav('stmts');
  }

  function step(state, title, sub) {
    return '<div class="step ' + state + '"><b>' + IC[state === 'done' ? 'ok' : state === 'wait' ? 'hourglass' : 'dot'] + title + '</b>' + esc(sub) + '</div>';
  }
  function history(x) {
    var log = (x.log || []).slice();
    if (!log.length) log.push([x.at, 'مرحَّل من ملف الشركة', '']);
    if (x.techOk && x.techAt && !log.some(function (l) { return /^اعتماد فني/.test(l[1]); })) log.push([x.techAt, 'اعتماد فني', x.techBy || '']);
    if (x.status === 'معتمد' && x.decidedAt && !log.some(function (l) { return /^اعتُمد/.test(l[1]); })) log.push([x.decidedAt, 'اعتُمد', x.decidedBy || '']);
    return log.sort(function (a, b) { return a[0] - b[0]; });
  }
  function viewStmt(r) {
    var x = stmtById(r.sub);
    if (!x) return R.head({ title: 'مستخلص', back: true }) + '<main class="view"><div class="empty"><b>المستخلص ده مش موجود</b>' + (R.LIVE ? 'لو لسه عامله، اضغط المزامنة فوق.' : 'ممكن يكون تبع مشروع تاني.') + '</div></main>' + R.nav('stmts');
    var L = linesOf(x), noRate = L.groups.filter(function (g) { return g.noRate; }).length, p = R.party(x.party);
    var decide = R.inboxDocs().some(function (y) { return y.key === x.key; }), tech = !x.techOk;
    var card = '<div class="card pad"><div class="dmeta">' + R.chip(x.status) + '<span>' + esc(kindLabel(x)) + '</span>' +
      (x.status === 'معتمد' ? '<span class="lockt">' + IC.lock + 'مقفول بعد الاعتماد</span>' : '') + '</div>' +
      '<h2 class="dtitle" style="margin:6px 0 0">' + esc(p.name) + '</h2><div class="fh">' + esc((R.project().short || '') + ' — ' + dLong(x.date)) + '</div>' +
      '<div class="kv2" style="margin-top:10px">' + kv('إجمالي الأعمال', money(x.works)) + (x.plus ? kv('إضافات / تعلية', money(x.plus)) : '') +
      kv('المحتجز' + (x.retPct ? ' (' + pct(x.retPct) + ')' : ''), money(x.ret)) + kv('الخصومات', money((x.adv || 0) + (x.ded || 0))) + '</div>' +
      '<div class="netl"><span>الصافي المستحق</span><b>' + money(x.net) + '</b></div></div>';
    var steps = '';
    if (x.status === 'تحت المراجعة' || x.status === 'معتمد') {
      var t1 = !!x.techOk || x.status === 'معتمد', t2 = x.status === 'معتمد';
      steps = '<div class="steps2">' +
        step(t1 ? 'done' : 'wait', 'اعتماد فني', t1 ? (x.techBy || 'المهندس') + (x.techAt ? ' — ' + R.dateShort(x.techAt) : '') : 'ينتظر المهندس') +
        step(t2 ? 'done' : t1 ? 'wait' : 'idle', 'اعتماد نهائي', t2 ? (x.decidedBy || 'المالك') + (x.decidedAt ? ' — ' + R.dateShort(x.decidedAt) : '') : t1 ? 'ينتظر المالك' : 'بعد الاعتماد الفني') + '</div>';
    }
    var al = '';
    if (x.status === 'مسودة') al += alertBox('info', 'مسودة: المحاضر مربوطة بالمستخلص ده ومش هتدخل مستخلص تاني. المستخلص مش داخل اليومية لحد ما يتبعت للمراجعة.');
    if (x.status === 'مرفوض') al += alertBox('err', '<b>رفضه ' + esc(x.decidedBy || 'المراجع') + ': ' + esc(x.reason || '') + '</b>' + (x.note ? '<br>«' + esc(x.note) + '»' : '') +
      (office() ? '<br>فك المحاضر بيرجّعها جاهزة لمستخلص جديد.' : ''));
    if (x.status === 'ملغى') al += alertBox('info', 'المستخلص ده اتلغى وفُكّت محاضره، فقيمته صفر.');
    if (noRate) al += alertBox('err', count(noRate, 'بند واحد', 'بندين', 'بنود', 'بندًا') + ' بلا فئة في عقد المقاول — قيمتها صفر لحد ما الفئة تتضاف.');
    var lines = '';
    if (L.groups.length) {
      lines = '<div class="sect">البنود من المحاضر<span class="s">' + count(L.recs.length, 'محضر واحد', 'محضرين', 'محاضر', 'محضرًا') + '</span></div><div class="card pad lines">' + L.groups.map(function (g) {
        return '<div class="ln"><span>' + esc(itemName(g.item)) + '<small>' + num(g.qty) + ' ' + esc(unitOf(g.item)) + ' × ' + (g.noRate ? 'بلا فئة' : num(g.rate)) + (g.n > 1 ? ' — ' + g.n + ' محاضر' : '') + '</small></span>' +
          '<b class="' + (g.noRate ? 'red' : '') + '">' + (g.noRate ? 'بلا فئة' : num(g.value)) + '</b></div>';
      }).join('') + '</div>';
    } else if (x.status !== 'ملغى') {
      lines = '<div class="sect">البنود من المحاضر</div><div class="card pad fh">' + (x.works ? 'بنوده مش مربوطة بمحاضر في المنظومة (مرحَّل من ملف الشركة).' : 'مفيش محاضر مربوطة.') + '</div>';
    }
    var st = (S.data.pstats || {})[x.party] || {}, bi = balInfo(x.party);
    var pay = '<div class="sect">المدفوع والرصيد</div><div class="card pad">' +
      (x.paid != null ? '<div class="hrow"><span>المدفوع على المستخلص ده</span><b>' + money(x.paid) + '</b></div><div class="hrow"><span>المتبقي منه</span><b>' + money(x.net - x.paid) + '</b></div>' : '') +
      '<div class="hrow"><span>' + (isClient(x) ? 'المقبوض من العميل في المشروع' : 'المدفوع للطرف في المشروع') + '</span><b>' + money(isClient(x) ? st.r : st.p) + '</b></div>' +
      '<button class="hrow" data-act="f-party" data-code="' + esc(x.party) + '"><span>رصيد ' + esc(p.name) + '</span><b class="bal ' + bi.cls + '">' + balNum(bi) + ' — ' + bi.txt + '</b></button></div>';
    var tl = '<div class="sect">سجل المستخلص</div><div class="tlx">' + history(x).map(function (l) {
      var cls = /^اعتُمد|^اعتماد/.test(l[1]) ? ' ok' : /^رُفض|^أُلغي/.test(l[1]) ? ' rej' : '';
      return '<div class="st' + cls + '"><div class="a">' + esc(l[1]) + (l[2] ? ' — ' + esc(l[2]) : '') + '</div><div class="b">' + R.when(l[0]) + '</div></div>';
    }).join('') + '</div>';
    var foot = '';
    if (x.status === 'مسودة' && office()) foot = '<div class="fbar"><button class="btn" data-act="f-send" data-id="' + esc(x.id) + '">' + IC.send + 'إرسال للمراجعة</button><button class="btn dng fit" data-act="f-unlink" data-id="' + esc(x.id) + '">' + IC.undo + 'إلغاء المسودة</button></div>';
    else if (x.status === 'مرفوض' && office()) foot = '<div class="fbar"><button class="btn nv" data-act="f-unlink" data-id="' + esc(x.id) + '">' + IC.undo + 'فك المحاضر لمستخلص جديد</button></div>';
    else if (decide) foot = '<div class="fbar"><button class="btn" data-act="f-approve" data-id="' + esc(x.id) + '">' + IC.check + (tech ? 'اعتماد فني' : 'اعتماد نهائي') + '</button>' +
      '<button class="btn dng fit" data-act="reject" data-key="' + esc(x.key) + '">' + IC.x + 'رفض</button></div>';
    return R.head({ title: x.id, back: true }) + '<main class="view' + (foot ? ' withbar' : '') + '">' + card + steps + (al ? '<div style="margin-top:10px">' + al + '</div>' : '') + lines + pay + tl + '</main>' + (foot || R.nav('stmts'));
  }

  /* قرارات المستخلص من شاشته: الاعتماد الفني والنهائي (الرفض بشاشة الرفض العامة) */
  function approveStmt(x) {
    var tech = !x.techOk;
    R.confirmBox({ title: (tech ? 'اعتماد فني لـ ' : 'اعتماد نهائي لـ ') + x.id + '؟', text: tech ? 'يروح للمالك للاعتماد النهائي.' : 'الصافي (' + money(x.net) + ') يبقى مستحق الصرف.',
      ok: tech ? 'اعتماد فني' : 'اعتماد نهائي', onOk: function () {
        if (busy) return; busy = true;
        R.decide(x, tech ? 'tech' : 'approve').then(function (res) {
          busy = false;
          if (!res || !res.ok) return R.toast(res && res.error === 'offline' ? 'القرار محتاج نت. جرّب أول ما النت يرجع.' : 'القرار ما اتسجّلش' + (res && res.message ? ': ' + res.message : '') + '.');
          R.toast(tech ? 'اعتماد فني لـ ' + x.id + '، ووصل للمالك.' : 'اتعتمد ' + x.id + '.');
          if (R.inTrail('inbox')) R.backTo('inbox'); else R.render(true);
        });
      } });
  }
  /* إرسال المسودة وفك المحاضر: على السكريبت فورًا (محتاجين نت)، وفي التجربة على الجهاز */
  function stmtCall(action, x, okMsg) {
    if (!R.LIVE) { demoStmt(action, x); R.toast(okMsg); return R.render(true); }
    if (navigator.onLine === false) return R.toast('العملية دي محتاجة نت.');
    if (busy) return; busy = true;
    R.post(R.CFG.WRITE_URL, { action: action, idToken: S.token, id: x.id }).then(function (res) {
      busy = false;
      if (!res || !res.ok) return R.toast((res && res.message) || 'العملية ما اتمّتش. جرّب تاني.');
      R.toast(okMsg); R.refresh();
    });
  }
  function demoStmt(action, x) {
    var now = Date.now(), who = R.me().name;
    x.log = (x.log || []).slice();
    if (action === 'stmtSend') { x.status = 'تحت المراجعة'; x.log.push([now, 'أُرسل للمراجعة', who]); }
    if (action === 'stmtUnlink') {
      var col = isClient(x) ? Q.cs : Q.ss, n = 0;
      data('qtyAll').forEach(function (q) { if (q[col] === x.id) { q[col] = ''; n++; } });
      x.status = 'ملغى'; x.works = 0; x.ret = 0; x.net = 0; x.log.push([now, 'أُلغي وفُكّت محاضره (' + n + ')', who]);
    }
    R.saveDemo();
  }

  /* ======================= مستخلص جديد (4.2) ======================= */
  function freshS() { return { key: R.uid(), kind: SUB, party: '', from: '', to: R.today(), retPct: '', ded: '', extNo: '', notes: '', errs: {}, list: false }; }
  function openS() { if (!FS) { var d = R.load('bdw_draft_stmt'); FS = d && d.key ? d : freshS(); FS.errs = {}; } return FS; }
  function saveS() { if (FS) { var c = JSON.parse(JSON.stringify(FS)); c.errs = {}; R.store('bdw_draft_stmt', c); } }
  function contractRet(p) { var m = 0; data('contracts').forEach(function (c) { if (c[1] === p && (c[7] || 0) > m) m = c[7]; }); return m > 1 ? m / 100 : m; }
  /* المحاضر الجاهزة: معتمدة، في المشروع، خانة مستخلصها فاضية، في الفترة، وتبع المقاول (أو ليها قيمة بسعر الجهاز للعميل) */
  function ready(kind, party, from, to) {
    var client = kind === CLIENT;
    return data('qtyAll').filter(function (q) {
      if (q[Q.st] !== 'معتمد' || (client ? q[Q.cs] : q[Q.ss])) return false;
      if ((from && q[Q.date] < from) || (to && q[Q.date] > to)) return false;
      return client ? q[Q.cvalue] > 0 : q[Q.sub] === party;
    });
  }
  function sCalc() {
    var client = FS.kind === CLIENT, list = FS.party ? ready(FS.kind, FS.party, FS.from, FS.to) : [];
    var works = list.reduce(function (s, q) { return s + (client ? q[Q.cvalue] : q[Q.svalue]); }, 0);
    var noRate = client ? 0 : list.filter(function (q) { return !(q[Q.rate] > 0); }).length;
    var p = client ? (Number(FS.retPct) || 0) / 100 : contractRet(FS.party);
    var ret = Math.round(works * p * 100) / 100, ded = Number(FS.ded) || 0;
    return { list: list, works: works, noRate: noRate, pct: p, ret: ret, ded: ded, net: Math.round((works - ret - ded) * 100) / 100 };
  }
  function sumCard(c) {
    if (!FS.party) return alertBox('info', 'اختار ' + (FS.kind === CLIENT ? 'العميل' : 'المقاول') + ' والفترة، والتطبيق يجمع المحاضر المعتمدة اللي لسه ما دخلتش مستخلص.');
    if (!c.list.length) return '<div id="w-list">' + alertBox('warn', 'مفيش محاضر معتمدة وغير مستخلصة ' + (FS.kind === CLIENT ? '' : 'للمقاول ده ') + 'في الفترة دي.') + '</div>';
    var n = c.list.length;
    return '<div class="card sumc" id="w-list"><div class="sh">هيدخل في المستخلص</div><div class="sn">' + count(n, 'محضر واحد', 'محضرين', 'محاضر', 'محضرًا') +
      '<small>' + (n === 1 ? 'معتمد ولسه ما دخلش مستخلص' : 'معتمدة ولسه ما دخلتش مستخلص') + '</small></div>' +
      '<div class="sf"><span>إجمالي الأعمال <b>' + money(c.works) + '</b></span><button type="button" data-act="f-lines" aria-expanded="' + !!FS.list + '">' + (FS.list ? 'إخفاء المحاضر' : 'عرض المحاضر') + '</button></div>' +
      (FS.list ? '<div class="lines">' + c.list.map(function (q) {
        var client = FS.kind === CLIENT, rate = client ? q[Q.cprice] : q[Q.rate], v = client ? q[Q.cvalue] : q[Q.svalue];
        return '<div class="ln"><span>' + esc(q[Q.id] + ' — ' + itemName(q[Q.item])) + '<small>' + esc(dLong(q[Q.date])) + ' — ' + num(q[Q.qty]) + ' ' + esc(unitOf(q[Q.item])) + ' × ' + (rate > 0 ? num(rate) : 'بلا فئة') + '</small></span><b class="' + (rate > 0 ? '' : 'red') + '">' + (rate > 0 ? num(v) : 'بلا فئة') + '</b></div>';
      }).join('') + '</div>' : '') +
      (c.noRate ? '<div style="margin-top:8px">' + alertBox('err', c.noRate === 1 ? 'محضر واحد على بند بلا فئة في عقد المقاول؛ قيمته صفر لحد ما الفئة تتضاف.'
        : count(c.noRate, '', 'محضرين', 'محاضر', 'محضرًا') + ' على بنود بلا فئة في عقد المقاول؛ قيمتها صفر لحد ما الفئة تتضاف.') + '</div>' : '') + '</div>';
  }

  /* ---------- أدوات الحقول (data-ff عشان ما تتلخبطش مع نماذج الموقع) ---------- */
  function F() { return form === 'stmt' ? FS : form === 'voucher' ? FV : null; }
  function lab(t, req, tag) { return '<div class="fl">' + t + (req ? '<span class="rq">*</span>' : '') + (tag ? '<span class="tag">' + tag + '</span>' : '') + '</div>'; }
  function ferr(k) { var f = F(); return f && f.errs[k] ? '<div class="fe" id="e-' + k + '">' + IC.alert + esc(f.errs[k]) + '</div>' : ''; }
  function bad(k) { var f = F(); return f && f.errs[k] ? ' err' : ''; }
  function fref(k, label, val, sub, ph, req, tag) {
    return '<div class="fld" id="w-' + k + '">' + lab(label, req, tag) + '<button type="button" class="fb' + bad(k) + '" data-act="f-pick" data-k="' + k + '">' + IC.search +
      (val ? '<span class="v">' + esc(val) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' : '<span class="plh">' + esc(ph) + '</span>') + IC.down + '</button>' + ferr(k) + '</div>';
  }
  function fnum(k, label, unit, req, hint) {
    return '<div class="fld" id="w-' + k + '">' + lab(label, req) + '<div class="fb' + bad(k) + '"><input id="f-' + k + '" data-ff="' + k + '" inputmode="decimal" autocomplete="off" value="' + esc(F()[k]) + '" placeholder="0">' +
      (unit ? '<span class="u">' + esc(unit) + '</span>' : '') + '</div>' + (hint != null ? '<div class="fh" id="h-' + k + '">' + hint + '</div>' : '') + ferr(k) + '</div>';
  }
  function ftext(k, label, req, ph) {
    return '<div class="fld" id="w-' + k + '">' + lab(label, req) + '<div class="fb' + bad(k) + '"><input id="f-' + k + '" data-ff="' + k + '" autocomplete="off" value="' + esc(F()[k]) + '" placeholder="' + esc(ph || '') + '"></div>' + ferr(k) + '</div>';
  }
  function fdate(k, label, req) {
    return '<div class="fld" id="w-' + k + '">' + lab(label, req) + '<div class="fb' + bad(k) + '"><input type="date" id="f-' + k + '" data-ff="' + k + '" max="' + R.today() + '" value="' + esc(F()[k]) + '">' + IC.cal + '</div>' + ferr(k) + '</div>';
  }
  function fauto(label, id, val, tag) { return '<div class="fld">' + lab(label, false, tag) + '<div class="fb auto"><span class="v" id="' + id + '">' + val + '</span>' + IC.lock + '</div></div>'; }
  function fseg(k, label, opts, cls, req) {
    var f = F();
    return '<div class="fld" id="w-' + k + '">' + (label ? lab(label, req) : '') + '<div class="seg ' + (cls || '') + '" role="radiogroup" aria-label="' + esc(label || k) + '">' + opts.map(function (o) {
      return '<button type="button" role="radio" aria-checked="' + (f[k] === o[0]) + '" class="' + (f[k] === o[0] ? 'on' : '') + '" data-act="f-seg" data-k="' + k + '" data-v="' + esc(o[0]) + '">' + esc(o[1] || o[0]) + '</button>';
    }).join('') + '</div>' + ferr(k) + '</div>';
  }

  function viewAddStmt() {
    form = 'stmt'; openS();
    var c = sCalc(), client = FS.kind === CLIENT, p = FS.party ? R.party(FS.party) : null, bi = FS.party ? balInfo(FS.party) : null;
    var body = '<div class="form">' +
      fauto('المشروع', 'f-proj', esc(R.project().short || ''), 'من المشروع الحالي') +
      fseg('kind', 'نوع المستخلص', [[SUB, 'مقاول باطن'], [CLIENT, 'عميل']], 'g2', true) +
      fref('party', client ? 'العميل' : 'المقاول', p ? p.code + ' — ' + p.name : '', '', client ? 'اختار العميل' : 'اختار مقاول الباطن', true) +
      '<div class="two">' + fdate('from', 'من', false) + fdate('to', 'إلى', true) + '</div>' +
      '<div class="fh" style="margin:-4px 0 10px">«من» فاضية = كل المحاضر الجاهزة لحد «إلى».</div>' +
      '<div id="f-sum">' + sumCard(c) + '</div>' +
      '<div class="two">' + (client ? fnum('retPct', 'نسبة المحتجز', '%', false) : fauto('نسبة المحتجز', 'f-ret', pct(c.pct), 'من العقد')) +
      fnum('ded', 'خصومات أخرى', 'ج', false) + '</div>' +
      fauto('الصافي المستحق', 'f-net', money(c.net), 'تلقائي') +
      (client ? ftext('extNo', 'رقم المستخلص لدى الجهة', false, 'اختياري') : '') +
      ftext('notes', 'ملاحظات', false, 'اختياري') +
      (bi && bi.amt ? alertBox(bi.neg ? 'err' : 'info', 'رصيد ' + esc(p.name) + ' قبل المستخلص: <b>' + bi.txt + ' ' + money(bi.amt) + '</b>.') : '') +
      '<div class="fh" style="text-align:center;margin:4px 0 10px">' + IC.hash + ' رقم المستخلص بيتحدد في الشيت بعد الإنشاء</div></div>';
    return R.head({ title: 'مستخلص جديد', back: true, noSync: true }) + '<main class="view form-view">' + body + '</main>' +
      '<div class="fbar"><button class="btn" data-act="f-save">' + IC.check + 'إنشاء المستخلص</button><button class="btn out fit" data-act="f-cancel">إلغاء</button></div>';
  }
  function paintStmt() {
    var c = sCalc(), n = $('#f-net'), s = $('#f-sum'), r = $('#f-ret');
    if (n) n.textContent = money(c.net);
    if (r) r.textContent = pct(c.pct);
    if (s) s.innerHTML = sumCard(c);
  }
  function saveStmt() {
    var c = sCalc(), e = {}, client = FS.kind === CLIENT;
    if (!FS.party) e.party = client ? 'اختار العميل' : 'اختار المقاول';
    if (!FS.to) e.to = 'اختار نهاية الفترة'; else if (FS.to > R.today()) e.to = 'نهاية الفترة بعد النهارده';
    if (FS.from && FS.to && FS.from > FS.to) e.from = 'البداية بعد النهاية';
    if (FS.party && !c.list.length) e.list = 'مفيش محاضر للمستخلص في الفترة دي';
    else if (FS.party && !(c.works > 0)) e.list = 'قيمة المحاضر صفر؛ راجع فئات عقد المقاول';
    var rp = Number(FS.retPct) || 0;
    if (client && (rp < 0 || rp > 50)) e.retPct = 'النسبة بين صفر و50%';
    if (c.ded < 0) e.ded = 'الخصومات رقم موجب'; else if (c.works > 0 && c.ded > c.works - c.ret) e.ded = 'الخصومات أكبر من قيمة الأعمال';
    FS.errs = e;
    var keys = Object.keys(e);
    if (keys.length) {
      R.render(true);
      if (e.list) { var s = $('#f-sum'); if (s) s.insertAdjacentHTML('beforeend', '<div class="fe">' + IC.alert + esc(e.list) + '</div>'); }
      var first = document.getElementById('w-' + keys[0]); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return R.toast(keys.length === 1 ? 'فيه حاجة محتاجة تكمّلها.' : 'فيه ' + keys.length + ' حاجات محتاجة تكمّلها.');
    }
    R.confirmBox({ title: 'ربط ' + count(c.list.length, 'محضر واحد', 'محضرين', 'محاضر', 'محضرًا') + ' بمستخلص جديد؟',
      text: 'رقم المستخلص هيتكتب في المحاضر دي، فما تدخلش مستخلص تاني. تقدر تفك الربط طول ما المستخلص «مسودة». الصافي ' + money(c.net) + '.', ok: 'إنشاء المستخلص',
      onOk: function () { createStmt(c); } });
  }
  function createStmt(c) {
    var req = { action: 'stmtNew', key: FS.key, project: S.project, kind: FS.kind, party: FS.party, from: FS.from || '', to: FS.to, qty: c.list.map(function (q) { return q[Q.id]; }),
      retPct: FS.kind === CLIENT ? Number(FS.retPct) || 0 : 0, ded: c.ded, extNo: String(FS.extNo || '').trim(), notes: String(FS.notes || '').trim() };
    var done = function (id) {
      R.store('bdw_draft_stmt', null); FS = null;
      R.toast('اتعمل ' + id + ' مسودة. راجعه وابعته للمراجعة.');
      openAfter = id; S.tab.stmts = req.kind; R.backTo('stmts');
    };
    if (!R.LIVE) return done(demoNew(req, c));
    if (navigator.onLine === false) return R.toast('إنشاء المستخلص محتاج نت.');
    if (busy) return; busy = true;
    R.toast('بننشئ المستخلص…');
    var body = JSON.parse(JSON.stringify(req)); body.idToken = S.token;
    R.post(R.CFG.WRITE_URL, body).then(function (res) {
      busy = false;
      if (!res || !res.ok) return R.toast((res && res.message) || 'المستخلص ما اتعملش. جرّب تاني.');
      R.refresh().then(function () { done(res.id); });
    });
  }
  function demoNew(req, c) {
    var id = R.nextId(req.kind === CLIENT ? 'CS-' : 'SS-'), now = Date.now(), col = req.kind === CLIENT ? Q.cs : Q.ss, ids = {};
    req.qty.forEach(function (q) { ids[q] = 1; });
    data('qtyAll').forEach(function (q) { if (ids[q[Q.id]]) q[col] = id; });
    S.data.docs.unshift({ key: req.key, type: 'stmt', id: id, kind: req.kind, party: req.party, date: R.today(), at: now, status: 'مسودة', extNo: req.extNo || (req.kind === CLIENT ? '' : 'جارٍ'),
      works: c.works, plus: 0, gross: c.works, retPct: c.pct, ret: c.ret, adv: 0, ded: c.ded, net: c.net, paid: null, by: S.role, byName: R.me().name, byRole: S.role, mine: true,
      project: S.project, notes: req.notes, log: [[now, 'أُنشئ مسودة من ' + req.qty.length + ' محضر', R.me().name]] });
    R.saveDemo();
    return id;
  }

  /* ======================= السندات (4.3) ======================= */
  function vrow(v) { return { id: v[0], kind: v[1], date: v[2], party: v[3], account: v[4], amount: v[5], method: v[6], from: v[7], ref: v[8], desc: v[9], status: v[10], by: v[11] }; }
  function migrated(v) { return /^مرح/.test(String(v.by || '')); }
  function allVouchers() {
    var list = data('vouchers').map(vrow);
    R.pendingDocs().filter(function (x) { return x.type === 'voucher'; }).forEach(function (x) {
      list.unshift({ id: null, key: x.key, kind: x.kind, date: R.today(), party: x.party, account: x.account, amount: x.amount, method: x.method, from: x.from, ref: x.ref, desc: x.desc,
        status: 'بانتظار المزامنة', by: R.me().name, pending: true });
    });
    return list;
  }
  function dayLabel(iso) {
    if (!iso) return 'بدون تاريخ';
    var t = R.today(), y = R.iso(Date.now() - 864e5);
    if (iso === t) return 'اليوم';
    if (iso === y) return 'أمس';
    var d = noon(iso);
    return R.dayName(d) + ' ' + R.dateShort(d) + (iso.slice(0, 4) !== t.slice(0, 4) ? ' ' + iso.slice(0, 4) : '');
  }
  function vRow(v, inParty) {
    var lim = S.data.settings.voucherLimit || 0, rec = v.kind === 'قبض', over = v.status === 'مسجَّل' && !rec && v.amount > lim;
    var nm = v.party && !inParty ? R.party(v.party).name : (v.desc || 'سند');
    var sub = (v.party && !inParty ? v.desc : (R.account(v.account) || v.account)) + (v.method ? ' — ' + v.method : '');
    var meta = over ? 'فوق حد الاعتماد: ينتظر المالك' : [v.from, v.ref ? 'على ' + v.ref : '', migrated(v) && v.date ? R.dateShort(noon(v.date)) + ' ' + v.date.slice(0, 4) : ''].filter(String).join(' — ');
    return '<button class="row" data-act="f-voucher" data-id="' + esc(v.id || '') + '" data-key="' + esc(v.key || '') + '">' + R.lead(rec ? 'download' : 'money', rec ? 'green' : R.toneOf(v.status)) +
      '<span class="rm"><span class="rt">' + esc((v.id || 'سند بلا رقم بعد') + ' — ' + nm.split(' — ')[0]) + '</span><span class="rs">' + esc(sub) + '</span><span class="rx' + (over ? ' gold' : '') + '">' + esc(meta) + '</span></span>' +
      '<span class="re"><span class="amt' + (rec ? ' green' : '') + '">' + money(v.amount) + '</span>' + R.chip(v.status) + '</span></button>';
  }
  function vouchersList(q) {
    var all = allVouchers();
    q = String(q || '').trim().toLowerCase();
    if (q) all = all.filter(function (v) { return (String(v.id || '') + ' ' + v.party + ' ' + R.party(v.party).name + ' ' + v.desc).toLowerCase().indexOf(q) >= 0; });
    var live = all.filter(function (v) { return !migrated(v); }), mig = all.filter(migrated), days = {}, order = [];
    live.forEach(function (v) { var k = v.date || ''; if (!days[k]) { days[k] = []; order.push(k); } days[k].push(v); });
    order.sort().reverse();
    var html = order.map(function (k) {
      var l = days[k].sort(function (a, b) { return String(b.id || 'zz').localeCompare(String(a.id || 'zz')); });
      var sum = function (kind) { return l.filter(function (v) { return v.kind === kind && v.status !== 'ملغى' && v.status !== 'مرفوض'; }).reduce(function (s, v) { return s + v.amount; }, 0); };
      var out = sum('صرف'), inn = sum('قبض');
      return R.gh(dayLabel(k), l.length, '', [out ? 'صرف ' + num(out) + ' ج' : '', inn ? 'قبض ' + num(inn) + ' ج' : ''].filter(String).join(' — ')) + '<div class="list">' + l.map(vRow).join('') + '</div>';
    }).join('');
    if (mig.length) {
      var open = !!S.tab.vmig || !!q;
      mig.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)); });
      html += '<button class="gh gbtn" data-act="f-mig" aria-expanded="' + open + '">مرحّلة من ملف الشركة<span class="n">' + num(mig.length) + '</span><span class="s">' + (open ? 'إخفاء' : 'عرض') + IC.down + '</span></button>' +
        (open ? '<div class="list">' + mig.map(vRow).join('') + '</div>' : '<div class="gnote">مقفولة ومطوية؛ المس العنوان لعرضها</div>');
    }
    return html || '<div class="empty"><b>' + (q ? 'مفيش سند بالبحث ده' : 'لا سندات بعد') + '</b>' + (q ? 'جرّب اسم الطرف أو رقم السند.' : office() ? 'سجّل أول سند بزر «+».' : '') + '</div>';
  }
  function viewVouchers() {
    return R.head({ title: 'السندات', pbar: true }) + '<main class="view flush">' + stripWrap() +
      '<label class="srch">' + IC.search + '<input id="f-q" data-k="vq" type="search" autocomplete="off" placeholder="ابحث بالطرف أو رقم السند" aria-label="بحث في السندات" value="' + esc(S.tab.vq || '') + '"></label>' +
      '<div id="f-list">' + vouchersList(S.tab.vq) + '</div></main>' +
      (office() ? '<button class="fab" data-act="go" data-to="add/voucher" aria-label="سند جديد">' + IC.plus + '</button>' : '') + R.nav('vouchers');
  }
  /* السند القديم بيتفتح في شاشة المستند العامة: بنعمله مستند مؤقت من الشكل المختصر */
  function voucherDoc(id) {
    var d = (S.data.docs || []).filter(function (x) { return x.type === 'voucher' && x.id === id; })[0];
    if (d) return d;
    var raw = data('vouchers').filter(function (x) { return x[0] === id; })[0]; if (!raw) return null;
    var v = vrow(raw);
    d = { key: 'id:' + id, type: 'voucher', id: id, kind: v.kind, date: v.date, at: noon(v.date), status: v.status, party: v.party, amount: v.amount, method: v.method, from: v.from,
      account: v.account, ref: v.ref, notes: v.desc, by: v.by, byName: migrated(v) ? 'ملف الشركة (مرحَّل)' : v.by, mine: false, project: S.project, log: [], _tmp: true };
    S.data.docs.push(d);
    return d;
  }

  /* ---------- سند جديد ---------- */
  function freshV() { return { key: R.uid(), kind: 'صرف', party: '', account: '', accSet: false, amount: '', method: 'تحويل', from: 'البنك', ref: '', desc: '', errs: {} }; }
  function openV() { if (!FV) { var d = R.load('bdw_draft_voucher'); FV = d && d.key ? d : freshV(); FV.errs = {}; } return FV; }
  function saveV() { if (FV) { var c = JSON.parse(JSON.stringify(FV)); c.errs = {}; R.store('bdw_draft_voucher', c); } }
  function suggest(code) { var t = R.party(code).type; return t === SUB ? '2100' : t === SUPPLIER ? '2200' : t === CLIENT ? '1300' : ''; }
  function amountHint() {
    var lim = S.data.settings.voucherLimit || 0, a = Number(FV.amount) || 0;
    if (FV.kind === 'قبض') return 'سند القبض بيتعتمد مع التسجيل.';
    return a > lim ? '<b style="color:var(--gold-ink)">فوق حد الاعتماد (' + money(lim) + '): يتبعت للمالك قبل الصرف.</b>' : 'لحد ' + money(lim) + ' بيتعتمد مع التسجيل (حد اعتماد المحاسب).';
  }
  function vBalance() {
    if (!FV.party) return '';
    var i = balInfo(FV.party), nm = R.party(FV.party).name;
    if (!i.amt) return alertBox('info', 'رصيد ' + esc(nm) + ': متوازن.');
    if (FV.kind === 'صرف' && i.neg) return alertBox('err', '<b>رصيد ' + esc(nm) + ': مدفوع له بالزيادة ' + money(i.amt) + '</b><br>الصرف ده بيزوّد المدفوع بالزيادة.');
    return alertBox(FV.kind === 'صرف' && i.cls === 'green' ? 'ok' : 'info', 'رصيد ' + esc(nm) + ': ' + i.txt + ' <b>' + money(i.amt) + '</b>.');
  }
  function viewAddVoucher() {
    form = 'voucher'; openV();
    if (FV.party && !FV.accSet) FV.account = suggest(FV.party);
    var p = FV.party ? R.party(FV.party) : null, rec = FV.kind === 'قبض';
    var body = '<div class="form">' +
      fseg('kind', 'نوع السند', [['صرف'], ['قبض']], 'g2', true) +
      fref('party', 'الطرف', p ? p.code + ' — ' + p.name : '', p ? p.type : '', rec ? 'اختار اللي دفع' : 'اختار اللي هيستلم', true) +
      '<div id="f-vbal">' + vBalance() + '</div>' +
      fref('account', 'الحساب', FV.account ? FV.account + ' — ' + (R.account(FV.account) || '') : '', '', 'اختار الحساب', true, FV.party && !FV.accSet && FV.account ? 'مقترح من نوع الطرف' : '') +
      fnum('amount', 'المبلغ', 'ج', true, amountHint()) +
      fseg('method', 'طريقة الدفع', [['نقدي'], ['تحويل'], ['شيك']], 'g3', true) +
      fseg('from', rec ? 'إلى' : 'من', [['الخزينة'], ['البنك']], 'g2', true) +
      fref('ref', 'المرجع', FV.ref ? FV.ref : '', '', 'مستخلص للطرف — اختياري', false) +
      ftext('desc', 'البيان', true, rec ? 'مثلًا: دفعة من مستخلص 7' : 'مثلًا: دفعة تحت الحساب') + '</div>';
    return R.head({ title: 'سند جديد', back: true, noSync: true }) + '<main class="view form-view">' + body + '</main>' +
      '<div class="fbar"><button class="btn" data-act="f-save">' + IC.check + 'حفظ السند</button><button class="btn out fit" data-act="f-cancel">إلغاء</button></div>';
  }
  function saveVoucher() {
    var e = {}, a = Number(FV.amount);
    if (!FV.party) e.party = 'اختار الطرف';
    if (!FV.account) e.account = 'اختار الحساب';
    if (!(a > 0)) e.amount = 'اكتب مبلغًا أكبر من صفر';
    if (!String(FV.desc || '').trim()) e.desc = 'اكتب البيان';
    FV.errs = e;
    var keys = Object.keys(e);
    if (keys.length) {
      R.render(true);
      var first = document.getElementById('w-' + keys[0]); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return R.toast(keys.length === 1 ? 'فيه حقل محتاج تكمّله.' : 'فيه ' + keys.length + ' حقول محتاجة تكمّلها.');
    }
    var op = { action: 'submit', key: FV.key, at: Date.now(), doc: { type: 'voucher', project: S.project, date: R.today(), kind: FV.kind, party: FV.party, account: FV.account,
      amount: Math.round(a * 100) / 100, method: FV.method, from: FV.from, ref: FV.ref || '', desc: String(FV.desc).trim(), notes: '' } };
    if (navigator.onLine === false) op.queuedAt = Date.now();
    R.queue(op); R.store('bdw_draft_voucher', null); FV = null;
    R.toast(navigator.onLine === false ? 'اتحفظ على الجهاز، وهيتبعت لما النت يرجع.' : 'اتحفظ، وبيتبعت للشيت دلوقتي…');
    R.backTo('vouchers');
  }

  /* ======================= الأطراف (4.4) ======================= */
  var PT = [['all', 'الكل'], [SUB, 'مقاولون'], [SUPPLIER, 'موردون'], [CLIENT, 'عملاء']];
  function partiesList(tab, q) {
    q = String(q || '').trim().toLowerCase();
    var list = (S.data.parties || []).filter(function (p) { return (tab === 'all' || p[2] === tab) && (!q || (p[0] + ' ' + p[1]).toLowerCase().indexOf(q) >= 0); });
    list.sort(function (a, b) { return Math.abs((S.data.balances || {})[b[0]] || 0) - Math.abs((S.data.balances || {})[a[0]] || 0); });
    if (!list.length) return '<div class="empty"><b>' + (q ? 'مفيش طرف بالبحث ده' : 'لا أطراف هنا') + '</b>' + (q ? 'جرّب جزء من الاسم أو الكود.' : '') + '</div>';
    return '<div class="list">' + list.map(function (p) {
      var i = balInfo(p[0]), ic = pIcon(p[2]);
      return '<button class="row" data-act="f-party" data-code="' + esc(p[0]) + '">' + R.lead(ic[0], ic[1]) + '<span class="rm"><span class="rt">' + esc(p[1]) + '</span><span class="rs">' + esc(p[2] + ' — ' + p[0]) + '</span></span>' +
        '<span class="re" style="gap:0"><span class="bal ' + i.cls + '">' + balNum(i) + '</span><small class="ball">' + i.txt + '</small></span></button>';
    }).join('') + '</div>';
  }
  function viewParties() {
    var tab = S.tab.parties || 'all';
    return R.head({ title: 'الأطراف', pbar: true }) + '<div class="tabs" role="tablist">' + PT.map(function (t) {
      return '<button role="tab" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '" data-act="f-tab" data-k="parties" data-t="' + esc(t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div><main class="view flush">' + stripWrap() +
      '<label class="srch">' + IC.search + '<input id="f-q" data-k="pq" type="search" autocomplete="off" placeholder="ابحث بالاسم أو الكود" aria-label="بحث في الأطراف" value="' + esc(S.tab.pq || '') + '"></label>' +
      '<div id="f-list">' + partiesList(tab, S.tab.pq) + '</div></main>' + R.nav('parties');
  }
  function viewParty(r) {
    var code = r.sub, found = (S.data.parties || []).some(function (p) { return p[0] === code; });
    if (!found) return R.head({ title: 'طرف', back: true }) + '<main class="view"><div class="empty"><b>الطرف ده مش موجود</b>راجع ورقة الأطراف.</div></main>' + R.nav('parties');
    var p = R.party(code), t = p.type, st = (S.data.pstats || {})[code] || {}, i = balInfo(code), ic = pIcon(t);
    var phone = String(p.phone || '').replace(/[^\d+]/g, ''), wa = phone.replace(/^\+/, '').replace(/^00/, '').replace(/^0(?=1)/, '20');
    var totals = t === SUB ? [['الأعمال', st.w], ['الصافي المستحق', st.n], ['المدفوع', st.p]]
      : t === SUPPLIER ? [['التوريدات', st.s], ['المدفوع', st.p], ['عدد الإذونات', st.np, true]]
      : t === CLIENT ? [['المستخلصات', st.w], ['الصافي', st.n], ['المقبوض', st.r]] : [['المدفوع', st.p], ['المقبوض', st.r]];
    var note = t === SUB && i.neg ? 'مدفوع بالزيادة — يتخصم من مستخلصه الجاي' : t === SUB && i.cls === 'green' ? 'مستحق له بعد المستخلصات والمدفوعات' : t === CLIENT && i.cls === 'green' ? 'لسه ما اتقبضش من المستخلصات' : '';
    var card = '<div class="card pad"><div class="pcard">' + R.lead(ic[0], ic[1]) + '<div style="flex:1;min-width:0"><div class="pn">' + esc(p.name) + '</div><div class="pt">' + esc(t + ' — ' + code + ' — ' + (R.project().short || '')) + '</div></div></div>' +
      (phone ? '<div class="pact"><a class="btn sm out" href="tel:' + esc(phone) + '">' + IC.phone + 'اتصال</a><a class="btn sm out" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">' + IC.chat + 'واتساب</a></div>'
        : '<div class="fh" style="margin-top:8px">مفيش رقم هاتف للطرف ده في ورقة الأطراف.</div>') +
      '<div class="kv3" style="margin-top:12px">' + totals.map(function (x) { return kv(x[0], x[2] ? num(x[1] || 0) : money(x[1] || 0)); }).join('') + '</div>' +
      '<div class="balbig"><span>الرصيد</span><span style="text-align:end"><b class="bal ' + i.cls + '">' + balNum(i) + ' ج</b><small class="ball">' + i.txt + '</small></span></div>' +
      (note ? '<div class="fh" style="color:' + (i.neg ? 'var(--red)' : 'var(--muted)') + ';font-weight:700">' + note + '</div>' : '') + '</div>';
    var parts = '';
    var ss = R.docs(function (x) { return x.type === 'stmt' && x.party === code; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    if (ss.length) parts += '<div class="sect">المستخلصات<span class="s">' + ss.length + '</span></div><div class="list boxed">' + ss.map(stmtRow).join('') + '</div>';
    var vs = data('vouchers').map(vrow).filter(function (v) { return v.party === code; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)); });
    if (vs.length) {
      var live = vs.filter(function (v) { return v.status !== 'ملغى' && v.status !== 'مرفوض'; }), tot = live.reduce(function (s, v) { return s + v.amount; }, 0);
      parts += '<div class="sect">' + (t === CLIENT ? 'المقبوضات' : 'المدفوعات') + '<span class="s">' + count(live.length, 'سند واحد', 'سندين', 'سندات', 'سندًا') + '، ' + money(tot) + '</span></div><div class="list boxed">' +
        vs.slice(0, 8).map(function (v) { return vRow(v, true); }).join('') + (vs.length > 8 ? '<button class="row" data-act="f-allpay" data-code="' + esc(code) + '" style="justify-content:center;color:var(--navy-2);font-weight:800">عرض الكل (' + vs.length + ')</button>' : '') + '</div>';
    }
    if (t === SUB) {
      var cs = data('contracts').filter(function (c) { return c[1] === code; });
      parts += '<div class="sect">بنود العقد<span class="s">' + count(cs.length, 'بند واحد', 'بندين', 'بنود', 'بندًا') + '</span></div>' + (cs.length ? '<div class="card pad lines">' + cs.map(function (c) {
        return '<div class="ln"><span>' + esc(c[3] || itemName(c[2])) + '<small>' + num(c[5]) + ' ' + esc(c[4] || unitOf(c[2])) + (c[7] ? ' — محتجز ' + pct(c[7]) : '') + ' — ' + esc(c[0]) + '</small></span><b>' + (c[6] != null ? num(c[6]) : 'بلا فئة') + '</b></div>';
      }).join('') + '</div>' : '<div class="card pad fh">مفيش بنود عقد للمقاول ده في المشروع.</div>');
    }
    if (t === SUPPLIER) {
      var its = (S.data.supplies || {})[code] || [];
      if (its.length) parts += '<div class="sect">بيورّد<span class="s">' + count(its.length, 'صنف واحد', 'صنفين', 'أصناف', 'صنفًا') + '</span></div><div class="card pad lines">' + its.map(function (c) {
        var lp = (S.data.lastPrice || {})[code + '|' + c];
        return '<div class="ln"><span>' + esc(R.item(c).name) + '<small>' + esc(c) + ' — ' + esc(R.item(c).unit) + '</small></span><b>' + (lp != null ? num(lp) : '—') + '</b></div>';
      }).join('') + '</div><div class="fh" style="margin:4px 2px">الرقم = آخر سعر معتمد.</div>';
    }
    return R.head({ title: p.name.split(' — ')[0], back: true }) + '<main class="view">' + card + parts + '</main>' + R.nav('parties');
  }

  /* ======================= لوحة المشروع (5.1) ======================= */
  var ALBL = { '2100': 'دفعات الباطن', '2200': 'دفعات الموردين', '5200': 'مستخلصات الباطن', '6300': 'مصروفات بنكية' };
  function viewDash() {
    var d = S.data.dash;
    if (!d) return R.head({ title: 'لوحة المشروع', pbar: true }) + '<main class="view"><div class="empty"><b>أرقام اللوحة مش متاحة لسه</b>' + (R.LIVE ? 'سكريبت الربط محتاج يتحدّث لنسخته الجديدة.' : '') + '</div></main>' + R.nav('dash');
    var pr = d.contractNet ? d.executed / d.contractNet : 0;
    var tile = function (l, v, s, muted) { return '<div class="card kpi' + (muted ? ' muted' : '') + '"><div class="kl">' + l + '</div><div class="kv">' + v + '</div><div class="ks">' + s + '</div></div>'; };
    var bars = (d.byAccount || []).filter(function (a) { return a[0].charAt(0) !== '1'; }), lg = (d.byAccount || []).filter(function (a) { return a[0].charAt(0) === '1'; });
    var max = bars.reduce(function (m, a) { return Math.max(m, a[2]); }, 0);
    var unit = function (n) { return max >= 1e6 ? (Math.round(n / 1e5) / 10).toLocaleString('en-US') + ' م' : num(n); };   /* وحدة واحدة لكل الأعمدة */
    var subs = (d.subs || []).slice().sort(function (a, b) { return b[5] - a[5]; });
    var upd = R.LIVE ? 'آخر تحديث من ملف البيانات: ' + R.when(S.dataAt || d.at) : 'أرقام عيّنة للتجربة';
    return R.head({ title: 'لوحة المشروع', pbar: true }) + '<main class="view">' + R.strip() +
      '<div class="upd">' + IC.sync + esc(upd) + '</div>' +
      '<div class="kgrid">' +
      tile('قيمة العقد', short(d.contract), 'بعد الخصم ' + pct(d.discount) + ': ' + short(d.contractNet)) +
      tile('المنفّذ بسعر العميل', short(d.executed), num(pr * 100, 1) + '% من العقد بعد الخصم') +
      tile('مستخلصات العميل', short(d.clientStmts), 'معتمد' + (d.lastClient ? ' حتى ' + esc(d.lastClient) : '') + (d.clientStmtsNet && Math.abs(d.clientStmtsNet - d.clientStmts) > 1 ? ' — الصافي ' + short(d.clientStmtsNet) : '')) +
      tile('المقبوض من العميل', d.received ? short(d.received) : '—', d.received ? 'سندات قبض' : 'بعد تسجيل سندات القبض', !d.received) +
      tile('التكلفة المحققة', short(d.cost), 'باطن + توريدات + مصروفات') +
      tile('أعمال الباطن', short(d.subWorks), 'المدفوع للباطن ' + short(d.subPaid)) + '</div>' +
      '<div class="card pad" style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;color:var(--navy);margin-bottom:6px"><span>الإنجاز</span><span>' + num(pr * 100, 1) + '%</span></div>' +
      '<div class="prog" role="img" aria-label="الإنجاز ' + num(pr * 100, 1) + '%"><i style="width:' + Math.min(100, pr * 100).toFixed(1) + '%;background:var(--green)"></i></div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-top:4px"><span>' + short(d.executed) + ' منفّذ</span><span>' + short(d.contractNet) + ' العقد بعد الخصم</span></div></div>' +
      '<div class="card pad" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center"><div><div class="kl" style="font-size:12px;color:var(--muted);font-weight:700">التوريدات (مواد)</div>' +
      '<div style="font-size:11.5px;color:var(--muted)">المدفوع للموردين ' + short(d.supPaid) + '</div></div><div style="font-size:20px;font-weight:800;color:var(--navy)">' + short(d.supplies) + '</div></div>' +
      '<div class="sect">الصرف حسب الحساب<span class="s">سندات الصرف</span></div><div class="card pad">' +
      (bars.length ? '<div class="bars">' + bars.map(function (a) {
        var w = max ? Math.max(1, a[2] / max * 100) : 0;
        return '<div class="bar" title="' + esc(a[0] + ' — ' + num(a[2]) + ' ج — ' + count(a[3], 'سند واحد', 'سندين', 'سندات', 'سندًا')) + '"><span class="bl">' + esc(ALBL[a[0]] || a[1]) + '</span><span class="bv">' + unit(a[2]) + '</span>' +
          '<span class="bt" aria-hidden="true"><i style="width:' + w.toFixed(1) + '%"></i></span></div>';
      }).join('') + '</div>' : '<div class="fh">لا سندات صرف بعد.</div>') +
      (lg.length ? '<div class="dnote">' + lg.map(function (a) { return esc(a[1]) + ' ' + short(a[2]); }).join('، ') + ' محتجز يُرد — خارج التكلفة.</div>' : '') + '</div>' +
      '<div class="sect">أرصدة مقاولي الباطن<span class="s">الأحمر = مدفوع بالزيادة</span></div>' +
      (subs.length ? '<div class="list boxed">' + subs.map(function (s) {
        var neg = s[5] < -0.5;
        return '<button class="row" data-act="f-party" data-code="' + esc(s[0]) + '"><span class="rm"><span class="rt">' + esc(s[1]) + '</span><span class="rs">أعمال ' + short(s[2]) + ' — مدفوع ' + short(s[4]) + '</span></span>' +
          '<span class="re" style="gap:0"><span class="bal ' + (neg ? 'red' : Math.abs(s[5]) < 0.5 ? 'gray' : 'green') + '">' + (neg ? '(' + num(-s[5]) + ')' : num(s[5])) + '</span><small class="ball">' + (neg ? 'مدفوع بالزيادة' : Math.abs(s[5]) < 0.5 ? 'متوازن' : 'مستحق له') + '</small></span></button>';
      }).join('') + '</div>' : '<div class="card empty" style="padding:20px">لا مستخلصات أو مدفوعات لمقاولي الباطن بعد.</div>') +
      '<p class="fh" style="margin:10px 4px">الأرقام بنفس معادلات «لوحة المشروع» في ملف التقارير، والملغى مستبعد منها.</p></main>' + R.nav('dash');
  }

  /* ======================= الربط بالنواة ======================= */
  R.views.stmts = viewStmts;
  R.views.stmt = viewStmt;
  R.views.vouchers = viewVouchers;
  R.views.parties = viewParties;
  R.views.party = viewParty;
  R.views.dash = viewDash;
  R.views.add = function (r) {
    if (r.sub === 'stmt' && (R.role() === 'acc' || R.role() === 'admin')) return viewAddStmt();
    if (r.sub === 'voucher' && (R.role() === 'acc' || R.role() === 'admin')) return viewAddVoucher();
    return R.head({ title: 'غير متاح', back: true }) + '<main class="view"><div class="empty"><b>الشاشة دي لمحاسب المشروع</b>دورك ما بيسمحش بالإنشاء من هنا.</div></main>' + R.nav('');
  };
  R.acts['f-tab'] = function (b) { S.tab[b.getAttribute('data-k')] = b.getAttribute('data-t'); R.render(); };
  R.acts['f-stmt'] = function (b) { R.go('stmt/' + encodeURIComponent(b.getAttribute('data-id'))); };
  R.acts['f-party'] = function (b) { R.go('party/' + encodeURIComponent(b.getAttribute('data-code'))); };
  R.acts['f-allpay'] = function (b) { S.tab.vq = b.getAttribute('data-code'); R.go('vouchers'); };
  R.acts['f-mig'] = function () { S.tab.vmig = !S.tab.vmig; var l = $('#f-list'); if (l) l.innerHTML = vouchersList(S.tab.vq); };
  R.acts['f-voucher'] = function (b) {
    var id = b.getAttribute('data-id'), key = b.getAttribute('data-key');
    if (!id) return key ? R.go('doc/' + encodeURIComponent(key)) : null;
    var d = voucherDoc(id); if (d) R.go('doc/' + encodeURIComponent(d.key));
  };
  R.acts['f-approve'] = function (b) { var x = stmtById(b.getAttribute('data-id')); if (x) approveStmt(x); };
  R.acts['f-send'] = function (b) {
    var x = stmtById(b.getAttribute('data-id')); if (!x) return;
    R.confirmBox({ title: 'إرسال ' + x.id + ' للمراجعة؟', text: 'يوصل للمهندس للاعتماد الفني، وبعده للمالك. ومن دلوقتي بيدخل اليومية بصافي ' + money(x.net) + '.',
      ok: 'إرسال للمراجعة', onOk: function () { stmtCall('stmtSend', x, 'اتبعت ' + x.id + ' للمراجعة، ووصل للمهندس.'); } });
  };
  R.acts['f-unlink'] = function (b) {
    var x = stmtById(b.getAttribute('data-id')); if (!x) return;
    var n = linesOf(x).recs.length;
    R.confirmBox({ title: (x.status === 'مسودة' ? 'إلغاء المسودة ' : 'فك محاضر ') + x.id + '؟', text: 'المحاضر المربوطة بيه (' + n + ') هترجع جاهزة لمستخلص جديد، و' + x.id + ' يتقفل ملغى بقيمة صفر.',
      ok: x.status === 'مسودة' ? 'إلغاء المسودة' : 'فك المحاضر', okCls: 'dngf', onOk: function () { stmtCall('stmtUnlink', x, 'اتلغى ' + x.id + ' ورجعت محاضره جاهزة.'); } });
  };
  R.acts['f-lines'] = function () { if (!FS) return; FS.list = !FS.list; saveS(); var s = $('#f-sum'); if (s) s.innerHTML = sumCard(sCalc()); };
  R.acts['f-seg'] = function (b) {
    var f = F(); if (!f) return;
    var k = b.getAttribute('data-k'), v = b.getAttribute('data-v');
    if (f[k] === v) return;
    f[k] = v; delete f.errs[k];
    if (form === 'stmt' && k === 'kind') {
      FS.party = ''; FS.list = false; FS.retPct = ''; FS.extNo = '';
      if (v === CLIENT) { var cl = (S.data.parties || []).filter(function (p) { return p[2] === CLIENT; }); if (cl.length === 1) FS.party = cl[0][0]; }
    }
    if (form === 'voucher' && k === 'kind') { FV.ref = ''; if (!FV.accSet && FV.party) FV.account = suggest(FV.party); }
    if (form === 'stmt') saveS(); else saveV();
    R.render(true);
  };
  R.acts['f-pick'] = function (b) {
    var k = b.getAttribute('data-k');
    if (form === 'stmt' && k === 'party') {
      var client = FS.kind === CLIENT;
      return R.openSheet({ title: client ? 'اختار العميل' : 'اختار مقاول الباطن', value: FS.party, items: S.data.parties.filter(function (p) { return p[2] === (client ? CLIENT : SUB); }).map(function (p) {
        var n = ready(FS.kind, p[0], '', R.today()).length;
        return { v: p[0], code: p[0], name: p[1], sub: n ? count(n, 'محضر واحد جاهز', 'محضرين جاهزين', 'محاضر جاهزة', 'محضرًا جاهزًا') + ' للمستخلص' : 'مفيش محاضر جاهزة', end: n ? String(n) : '', endCls: n ? '' : '' };
      }), onPick: function (v) { FS.party = v; FS.list = false; delete FS.errs.party; saveS(); R.render(true); } });
    }
    if (form === 'voucher' && k === 'party') {
      var rec = FV.kind === 'قبض', rank = function (t) { return rec ? (t === CLIENT ? 0 : 1) : (t === CLIENT ? 1 : 0); };
      var ps = S.data.parties.slice().sort(function (a, b) { return rank(a[2]) - rank(b[2]); });
      return R.openSheet({ title: rec ? 'اختار اللي دفع' : 'اختار اللي هيستلم', value: FV.party, items: ps.map(function (p) {
        var i = balInfo(p[0]);
        return { v: p[0], code: p[0], name: p[1], sub: p[2] + (i.amt ? ' — ' + i.txt : ''), end: i.amt ? balNum(i) : '', endCls: i.cls === 'red' ? 'red' : '' };
      }), onPick: function (v) { if (FV.party !== v) { FV.party = v; FV.ref = ''; if (!FV.accSet) FV.account = suggest(v); } delete FV.errs.party; delete FV.errs.account; saveV(); R.render(true); } });
    }
    if (form === 'voucher' && k === 'account') {
      return R.openSheet({ title: 'اختار الحساب', value: FV.account, ph: 'ابحث برقم الحساب أو اسمه', items: data('accounts').filter(function (a) { return a[2] !== 1; }).map(function (a) {
        return { v: a[0], code: a[0], name: a[1], sub: a[0] === suggest(FV.party) ? 'مقترح من نوع الطرف' : '' };
      }), onPick: function (v) { FV.account = v; FV.accSet = true; delete FV.errs.account; saveV(); R.render(true); } });
    }
    if (form === 'voucher' && k === 'ref') {
      if (!FV.party) return R.toast('اختار الطرف الأول.');
      var ss = R.docs(function (x) { return x.type === 'stmt' && x.party === FV.party && (x.status === 'تحت المراجعة' || x.status === 'معتمد'); });
      return R.openSheet({ title: 'المرجع', value: FV.ref, search: false, items: [{ v: '', code: '—', name: 'بدون مرجع' }].concat(ss.map(function (x) {
        return { v: x.id, code: x.id, name: kindLabel(x) + ' — ' + dLong(x.date), sub: 'الصافي ' + money(x.net) + (x.paid != null ? ' — مدفوع عليه ' + money(x.paid) : ''), end: x.status };
      })), onPick: function (v) { FV.ref = v; saveV(); R.render(true); } });
    }
  };
  R.acts['f-save'] = function () { if (form === 'stmt' && FS) saveStmt(); else if (form === 'voucher' && FV) saveVoucher(); };
  R.acts['f-cancel'] = function () {
    if (form === 'stmt') { R.store('bdw_draft_stmt', null); FS = null; } else if (form === 'voucher') { R.store('bdw_draft_voucher', null); FV = null; }
    R.back();
  };
  R.inputs.push(function (e) {
    var t = e.target;
    if (t.id === 'f-q') {
      var k = t.getAttribute('data-k'); S.tab[k] = t.value;
      var l = $('#f-list'); if (l) l.innerHTML = k === 'vq' ? vouchersList(t.value) : partiesList(S.tab.parties || 'all', t.value);
      return true;
    }
    var key = t.getAttribute && t.getAttribute('data-ff'); if (!key) return false;
    var f = F(); if (!f) return true;
    var v = t.value;
    if (key === 'amount' || key === 'ded' || key === 'retPct') {
      v = v.replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/[^\d.]/g, '');
      if (v !== t.value) t.value = v;
    }
    f[key] = v;
    if (f.errs[key]) { delete f.errs[key]; var w = document.getElementById('e-' + key); if (w) w.remove(); var fb = t.closest('.fb'); if (fb) fb.classList.remove('err'); }
    if (form === 'stmt') { saveS(); if (key === 'from' || key === 'to') { delete FS.errs.list; paintStmt(); } else if (key === 'ded' || key === 'retPct') paintStmt(); }
    if (form === 'voucher') { saveV(); if (key === 'amount') { var h = $('#h-amount'); if (h) h.innerHTML = amountHint(); } }
    return true;
  });
  R.on.render = (R.on.render || []).concat([function (r) {
    if (r.name !== 'add') form = '';
    if (r.name === 'stmts' && openAfter) { var id = openAfter; openAfter = null; setTimeout(function () { R.go('stmt/' + encodeURIComponent(id)); }, 0); }
  }]);
});
