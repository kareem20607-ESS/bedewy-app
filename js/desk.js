/* العرض على الكمبيوتر (5.2): نفس التطبيق ونفس الحساب على الشاشة العريضة — قائمة جانبية ثابتة، وجدول بأعمدة أكتر
   مع بحث وفرز وتصفية، وتفاصيل الصف المحدد جنب الجدول من غير انتقال. نفس الإجراءات والقواعد: الاعتماد والرفض بنفس أزرار الموبايل.
   المحاضر والسندات والمستخلصات كاملة من التحميل العادي؛ الإذونات ومصروفات العهدة كاملة من السكريبت (action: register).
   على الموبايل نفس الشاشة بتترص تحت بعض. */
(window.BDW_EXT = window.BDW_EXT || []).push(function (R) {
  'use strict';
  var S = R.S, IC = R.IC, esc = R.esc, num = R.num, money = R.money;
  var $ = function (s) { return document.querySelector(s); };
  var SETS = [['inbox', 'الاعتماد', 'inbox'], ['permit', 'إذونات التوريد', 'truck'], ['qty', 'الكميات المنفذة', 'ruler'], ['exp', 'مصروفات العهدة', 'receipt'],
    ['voucher', 'السندات', 'money'], ['stmt', 'المستخلصات', 'stmt']];
  var COLS = {
    inbox: ['النوع', 'الطرف / البيان', 'التفاصيل'], permit: ['المورد', 'الصنف', 'الكمية'], qty: ['المنفّذ', 'البند', 'الكمية'],
    exp: ['التصنيف', 'البيان', 'المُدخِل'], voucher: ['الطرف', 'البيان', 'النوع'], stmt: ['الطرف', 'النوع', 'رقم الجهة']
  };
  /* عرض أعمدة الطرف والبيان والتفاصيل لكل سجل بالبكسل، والصفر يعني ياخد من الباقي */
  var WIDTH = { inbox: [104, 0, 0], permit: [0, 0, 104], qty: [0, 0, 104], exp: [100, 0, 140], voucher: [0, 0, 64], stmt: [0, 120, 84] };
  var D = { set: 'inbox', q: '', st: '', sort: 'date', dir: -1, sel: '' };
  var REG = {};                                   /* REG[type] = { project, rows, at, loading, err } */

  function office() { return ['eng', 'acc', 'owner', 'admin'].indexOf(S.role) >= 0; }
  function docOf(type, id, key) {
    return (key && R.byKey(key)) || (S.data.docs || []).filter(function (d) { return d.type === type && d.id === id && d.project === S.project; })[0] || null;
  }
  function unitTxt(q, u) { return num(q) + (u ? ' ' + u : ''); }

  /* ---------- الصفوف ---------- */
  function fromDoc(x) {
    var p = x.party ? R.party(x.party).name : '', r = { k: 'doc|' + x.key, type: x.type, id: x.id || 'بلا رقم', date: x.date || R.iso(x.at), status: x.status, by: x.byName || '', doc: x, amount: R.value(x) };
    if (x.type === 'permit') { var it = R.item(x.item); r.a = p; r.b = it.name; r.c = unitTxt(x.qty, it.unit); }
    else if (x.type === 'qty') { var b = R.boq(x.boq); r.a = x.exec && x.exec !== 'ذاتي' ? R.party(x.exec).name : 'تنفيذ ذاتي'; r.b = b.name; r.c = unitTxt(x.qty, b.unit); }
    else if (x.type === 'exp') { r.a = x.cat || ''; r.b = x.desc || ''; r.c = x.byName || ''; }
    else if (x.type === 'voucher') { r.a = p || '—'; r.b = x.notes || x.desc || ''; r.c = x.kind || 'صرف'; }
    else if (x.type === 'stmt') { r.a = p; r.b = x.kind === 'عميل' ? 'مستخلص عميل' : 'مقاول باطن'; r.c = x.extNo || ''; }
    else if (x.type === 'issue') { var si = R.item(x.item); r.a = x.exec && x.exec !== 'ذاتي' ? R.party(x.exec).name : 'تنفيذ ذاتي'; r.b = si.name; r.c = unitTxt(x.qty, si.unit); }
    else if (x.type === 'count') { var sc = R.item(x.item), dq = Number(x.qty) || 0; r.a = sc.name; r.b = 'العدد الفعلي ' + unitTxt(x.counted, sc.unit); r.c = dq ? (dq > 0 ? 'زيادة ' : 'عجز ') + unitTxt(Math.abs(dq), sc.unit) : 'مطابق للدفتري'; }
    if (D.set === 'inbox') {
      r.c = x.type === 'stmt' ? (x.techOk ? 'اعتماد فني ✓ — ينتظر المالك' : 'ينتظر الاعتماد الفني') : x.type === 'exp' ? r.b : r.b + (r.c ? ' — ' + r.c : '');
      r.b = r.a; r.a = R.typeName(x);
    }
    return r;
  }
  function rowsOf(set) {
    if (set === 'inbox') return R.inboxDocs().map(fromDoc);
    if (set === 'stmt') return R.docs(function (x) { return x.type === 'stmt'; }).map(fromDoc);
    if (set === 'qty') return (S.data.qtyAll || []).map(function (q) {
      var d = docOf('qty', q[0]), b = R.boq(q[2]);
      return { k: 'qty|' + q[0], type: 'qty', id: q[0], date: q[1], a: q[6] ? R.party(q[6]).name : 'تنفيذ ذاتي', b: b.name, c: unitTxt(q[3], b.unit),
        amount: q[5] || null, status: d ? d.status : q[11], by: d ? d.byName : '', doc: d, row: q };
    });
    if (set === 'voucher') return (S.data.vouchers || []).map(function (v) {
      var d = docOf('voucher', v[0]);
      return { k: 'voucher|' + v[0], type: 'voucher', id: v[0], date: v[2], a: v[3] ? R.party(v[3]).name : '—', b: v[9] || R.account(v[4]) || '', c: v[1],
        amount: v[5], status: v[10], by: v[11] || (d && d.byName) || '', doc: d, row: v };
    });
    var reg = REG[set];
    if (R.LIVE && reg && reg.rows && reg.project === S.project) {
      /* حالة المستند المحمّل أحدث من السجل (لو اتاخد عليه قرار بعد التحميل)، والمستندات اللي اتسجّلت بعده بتنضاف */
      var out = reg.rows.map(set === 'permit' ? function (p) {
        var it = R.item(p[3]), d = docOf('permit', p[0], p[9]);
        return { k: 'permit|' + p[0], type: 'permit', id: p[0], date: p[1], a: R.party(p[2]).name, b: it.name, c: unitTxt(p[4], it.unit),
          amount: p[5] == null ? null : p[6], status: d ? d.status : p[7], by: p[10], doc: d, photo: p[8], row: p };
      } : function (e) {
        var d = docOf('exp', e[0], e[8]);
        return { k: 'exp|' + e[0], type: 'exp', id: e[0], date: e[1], a: e[3], b: e[4], c: e[9], amount: e[5], status: d ? d.status : e[6], by: e[9], cu: e[2], doc: d, photo: e[7], row: e };
      }), seen = {};
      out.forEach(function (r) { seen[r.id] = 1; });
      R.docs(function (x) { return x.type === set && x.id && !seen[x.id]; }).forEach(function (x) { out.push(fromDoc(x)); });
      return out;
    }
    return R.docs(function (x) { return x.type === set; }).map(fromDoc);
  }
  function loadReg(set) {
    if (!R.LIVE || (set !== 'permit' && set !== 'exp')) return;
    var reg = REG[set] || (REG[set] = {});
    if (reg.loading || (reg.rows && reg.project === S.project && Date.now() - reg.at < 5 * 60000) || navigator.onLine === false) return;
    reg.loading = true; reg.err = '';
    var pj = S.project;
    R.post(R.CFG.API_URL, { action: 'register', idToken: S.token, project: pj, type: set }, 45000).then(function (res) {
      reg.loading = false;
      if (res && res.ok && res.rows) { reg.rows = res.rows; reg.project = pj; reg.at = Date.now(); }
      else reg.err = (res && res.message) || 'net';
      if (/^#desk/.test(location.hash) && D.set === set) R.render(true);
    });
  }
  function shown() {
    var t = D.q.trim().toLowerCase(), rows = rowsOf(D.set).filter(function (r) {
      if (D.st && r.status !== D.st) return false;
      return !t || [r.id, r.a, r.b, r.c, r.by].some(function (v) { return String(v || '').toLowerCase().indexOf(t) >= 0; });
    });
    var key = D.sort, dir = D.dir;
    rows.sort(function (x, y) {
      var a = key === 'amount' ? (x.amount || 0) : key === 'id' ? x.id : x.date, b = key === 'amount' ? (y.amount || 0) : key === 'id' ? y.id : y.date;
      return (a < b ? -1 : a > b ? 1 : 0) * dir || String(y.id).localeCompare(String(x.id));
    });
    return rows;
  }

  /* ---------- الجدول ---------- */
  function th(col, label, cls) {
    var c = cls ? ' class="' + cls + '"' : '';
    if (!col) return '<th' + c + '>' + label + '</th>';
    var on = D.sort === col;
    return '<th' + c + ' aria-sort="' + (on ? (D.dir > 0 ? 'ascending' : 'descending') : 'none') + '"><button data-act="dk-sort" data-c="' + col + '">' + label + (on ? (D.dir > 0 ? ' ▴' : ' ▾') : '') + '</button></th>';
  }
  function tbody(rows, sel) {
    if (!rows.length) {
      var reg = REG[D.set];
      var msg = reg && reg.loading ? 'بحمّل السجل كامل من ملف البيانات…' : D.q || D.st ? 'مفيش صفوف بالبحث ده. غيّر الكلمة أو الحالة.' : D.set === 'inbox' ? 'مفيش حاجة مستنية قرارك دلوقتي.' : 'مفيش مستندات هنا لسه.';
      return '<tr class="none"><td colspan="7">' + esc(msg) + '</td></tr>';
    }
    return rows.map(function (r) {
      var on = sel && r.k === sel.k;
      return '<tr class="' + (on ? 'sel' : '') + '" data-act="dk-row" data-k="' + esc(r.k) + '"><td><button class="rid" data-act="dk-row" data-k="' + esc(r.k) + '"' + (on ? ' aria-current="true"' : '') + '>' + esc(r.id) + '</button></td>' +
        '<td>' + esc(r.date ? R.dateShort(r.date) : '') + '</td>' +
        '<td title="' + esc(r.a) + '">' + esc(r.a) + '</td><td title="' + esc(r.b) + '">' + esc(r.b) + '</td><td title="' + esc(r.c) + '">' + esc(r.c) + '</td>' +
        '<td class="n">' + (r.amount == null ? '—' : num(Math.round(r.amount))) + '</td><td>' + R.chip(r.status) + '</td></tr>';
    }).join('');
  }
  function pick(rows) {
    var sel = rows.filter(function (r) { return r.k === D.sel; })[0];
    if (!sel && rows.length && window.innerWidth >= 1024) { sel = rows[0]; D.sel = sel.k; }
    return sel || null;
  }

  /* ---------- التفاصيل ---------- */
  function kvs(list) { return '<div class="dk-kv">' + list.filter(function (p) { return p[1] !== '' && p[1] != null; }).map(function (p) { return '<div><span>' + esc(p[0]) + '</span><b>' + esc(p[1]) + '</b></div>'; }).join('') + '</div>'; }
  function detail(r) {
    if (!r) return '<div class="dk-empty">' + IC.list + '<b>اختار صف من الجدول</b>تفاصيله هتظهر هنا من غير ما تسيب الجدول، والأسهم ↑ ↓ بتنقلك بين الصفوف.</div>';
    var x = r.doc;
    if (x && x.type === 'stmt') {
      var mine = R.inboxDocs().some(function (y) { return y.key === x.key; });
      var dec = mine ? '<div class="dk-acts"><button class="btn" data-act="quick" data-key="' + esc(x.key) + '">' + IC.check + (x.techOk ? 'اعتماد نهائي' : 'اعتماد فني') + '</button>' +
        '<button class="btn dng fit" data-act="reject" data-key="' + esc(x.key) + '">' + IC.x + 'رفض</button></div>' : '';
      return '<div class="dk-pad dk-doc"><div class="dmeta">' + R.chip(x.status) + '<span>' + esc(R.typeName(x)) + '</span></div><h3 class="dk-h">' + esc(x.id + ' — ' + R.party(x.party).name) + '</h3>' +
        kvs([['التاريخ', x.date ? R.dateLong(x.date) : ''], ['إجمالي الأعمال', money(x.works)], ['المحتجز', money(x.ret)], ['الخصومات', money((x.adv || 0) + (x.ded || 0))], ['الصافي المستحق', money(x.net)],
          ['الاعتماد الفني', x.techOk ? (x.techBy || 'المهندس') : (x.status === 'تحت المراجعة' ? 'مستني المهندس' : '')], ['الاعتماد النهائي', x.status === 'معتمد' ? (x.decidedBy || 'المالك') : x.techOk && x.status === 'تحت المراجعة' ? 'مستني المالك' : '']]) +
        (mine ? '<p class="dk-note">قبل ' + (x.techOk ? 'الاعتماد النهائي' : 'الاعتماد الفني') + ' تقدر تراجع البنود من «افتح المستخلص».</p>' : '') +
        '</div>' + dec + '<button class="dk-open" data-act="go" data-to="stmt/' + encodeURIComponent(x.id) + '">' + IC.eye + 'افتح المستخلص (البنود والاعتماد)</button>';
    }
    if (x) {
      var t = document.createElement('template'); t.innerHTML = R.views.doc({ name: 'doc', sub: x.key });
      var main = t.content.querySelector('main'), bar = t.content.querySelector('.fbar');
      var acts = bar ? bar.innerHTML.replace(/data-act="approve"/g, 'data-act="quick"') : '';
      return '<div class="dk-doc">' + (main ? main.innerHTML : '') + '</div>' + (acts ? '<div class="dk-acts">' + acts + '</div>' : '') +
        '<button class="dk-open" data-act="go" data-to="doc/' + encodeURIComponent(x.key) + '">' + IC.eye + 'افتح الشاشة الكاملة</button>';
    }
    var photo = r.photo ? '<button class="dk-ph" data-act="zoom" data-ref="' + esc(r.photo) + '" data-kind="' + esc(r.type) + '" data-photo="thumb:' + esc(r.photo) + '" aria-label="تكبير الصورة"></button>' : '';
    var list = r.type === 'voucher' ? [['النوع', r.row[1]], ['التاريخ', R.dateLong(r.date)], ['الطرف', r.a], ['الحساب', r.row[4] + (R.account(r.row[4]) ? ' — ' + R.account(r.row[4]) : '')], ['المبلغ', money(r.amount)],
      ['الطريقة', [r.row[6], r.row[7]].filter(String).join(' — ')], ['المرجع', r.row[8]], ['البيان', r.b], ['المُدخِل', r.by]] :
      r.type === 'qty' ? [['التاريخ', R.dateLong(r.date)], ['البند', r.b], ['الكمية', r.c], ['المنفّذ', r.a], ['القيمة بسعر العميل', r.amount == null ? '' : money(r.amount)],
        ['مستخلص العميل', r.row[9]], ['مستخلص الباطن', r.row[10]]] :
      r.type === 'permit' ? [['التاريخ', R.dateLong(r.date)], ['المورد', r.a], ['الصنف', r.b], ['الكمية', r.c], ['السعر', r.row[5] == null ? 'بدون سعر' : money(r.row[5])], ['الإجمالي', r.amount == null ? '' : money(r.amount)], ['المُدخِل', r.by]] :
      [['التاريخ', R.dateLong(r.date)], ['التصنيف', r.a], ['البيان', r.b], ['العهدة', r.cu || ''], ['المبلغ', money(r.amount)], ['المُدخِل', r.by]];
    return photo + '<div class="dk-pad"><div class="dmeta">' + R.chip(r.status) + '<span>' + esc(R.TYPE[r.type] || '') + '</span></div><h3 class="dk-h">' + esc(r.id) + '</h3>' + kvs(list) +
      '<p class="dk-note">للعرض بس: ده سطر من سجل ملف البيانات، والقرارات بتتاخد من «الاعتماد».</p></div>';
  }

  /* ---------- الشاشة ---------- */
  function viewDesk() {
    if (!office()) return R.head({ title: 'العرض على الكمبيوتر', back: true }) + '<main class="view"><div class="empty"><b>الشاشة دي للمكتب</b>مستنداتك كلها في «سجلاتي».</div></main>' + R.nav('');
    loadReg(D.set);
    var rows = shown(), sel = pick(rows), all = rowsOf(D.set), name = SETS.filter(function (s) { return s[0] === D.set; })[0][1];
    var sts = []; all.forEach(function (r) { if (r.status && sts.indexOf(r.status) < 0) sts.push(r.status); });
    var side = '<nav class="dk-side" aria-label="السجلات">' + SETS.map(function (s) {
      var n = s[0] === D.set ? all.length : s[0] === 'inbox' ? R.inboxDocs().length : null;
      return '<button class="' + (D.set === s[0] ? 'on' : '') + '" data-act="dk-set" data-s="' + s[0] + '"' + (D.set === s[0] ? ' aria-current="page"' : '') + '>' + IC[s[2]] + '<span>' + s[1] + '</span>' + (n ? '<i>' + num(n) + '</i>' : '') + '</button>';
    }).join('') + '<hr>' + [['home', 'الرئيسية', 'home'], ['dash', 'لوحة المشروع', 'pie'], ['parties', 'الأطراف', 'users'], ['archive', 'الأرشيف', 'images']].map(function (l) {
      return '<button data-act="go" data-to="' + l[0] + '">' + IC[l[2]] + '<span>' + l[1] + '</span></button>';
    }).join('') + '</nav>';
    var c = COLS[D.set], reg = REG[D.set];
    var note = R.LIVE && (D.set === 'permit' || D.set === 'exp') && !(reg && reg.rows && reg.project === S.project) ? '<p class="dk-hint">' + (reg && reg.err ? 'السجل الكامل ما اتحمّلش، والظاهر آخر المستندات بس.' : 'بحمّل السجل كامل من ملف البيانات…') + '</p>' : '';
    var bar = '<div class="dk-bar"><h2>' + esc(name) + ' <span>' + num(rows.length) + (rows.length !== all.length ? ' من ' + num(all.length) : '') + '</span></h2>' +
      '<label class="srch">' + IC.search + '<input id="dk-q" type="search" autocomplete="off" aria-label="بحث في ' + esc(name) + '" placeholder="دوّر بالرقم أو الطرف أو الصنف" value="' + esc(D.q) + '"></label>' +
      '<select id="dk-st" aria-label="تصفية بالحالة"><option value="">كل الحالات</option>' + sts.map(function (s) { return '<option' + (s === D.st ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select></div>' + note;
    var table = '<div class="dk-tbl" id="dk-tbl"><table><colgroup><col class="c-id"><col class="c-dt">' + WIDTH[D.set].map(function (w) { return w ? '<col style="width:' + w + 'px">' : '<col>'; }).join('') + '<col class="c-n"><col class="c-st"></colgroup><thead><tr>' +
      th('id', 'الرقم') + th('date', 'التاريخ') + th('', c[0]) + th('', c[1]) + th('', c[2]) + th('amount', 'القيمة', 'n') + th('', 'الحالة') +
      '</tr></thead><tbody id="dk-tb">' + tbody(rows, sel) + '</tbody></table></div>';
    return R.head({ title: 'العرض على الكمبيوتر', pbar: true }) + '<div class="desk">' + side + '<section class="dk-main" aria-label="' + esc(name) + '">' + bar + table + '</section>' +
      '<section class="dk-det" id="dk-det" aria-label="التفاصيل">' + detail(sel) + '</section></div>' + R.nav('');
  }
  function select(k, kbd) {
    D.sel = k;
    var rows = shown(), r = rows.filter(function (x) { return x.k === k; })[0], det = $('#dk-det');
    document.querySelectorAll('#dk-tb tr').forEach(function (tr) {
      var on = tr.getAttribute('data-k') === k, b = tr.querySelector('.rid');
      tr.classList.toggle('sel', on);
      if (b) { if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
    });
    if (det) { det.innerHTML = detail(r); det.scrollTop = 0; R.fillPhotos(det); }
    if (kbd) {
      var cur = document.querySelector('#dk-tb tr.sel .rid');
      if (cur) { cur.focus({ preventScroll: true }); if (cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' }); }
    } else if (window.innerWidth < 1024 && det) det.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function repaint() {
    var rows = shown(), tb = $('#dk-tb'), sel = rows.filter(function (r) { return r.k === D.sel; })[0] || null;
    if (tb) tb.innerHTML = tbody(rows, sel);
    var h = document.querySelector('.dk-bar h2 span'), all = rowsOf(D.set).length;
    if (h) h.textContent = num(rows.length) + (rows.length !== all ? ' من ' + num(all) : '');
  }

  R.views.desk = viewDesk;
  R.acts['dk-set'] = function (b) { D.set = b.getAttribute('data-s'); D.sel = ''; D.st = ''; D.sort = 'date'; D.dir = -1; R.render(); };
  R.acts['dk-row'] = function (b) { select(b.getAttribute('data-k')); };
  R.acts['dk-sort'] = function (b) { var c = b.getAttribute('data-c'); if (D.sort === c) D.dir = -D.dir; else { D.sort = c; D.dir = c === 'id' ? 1 : -1; } R.render(true); };
  R.inputs.push(function (e) { if (e.target.id !== 'dk-q') return false; D.q = e.target.value; repaint(); return true; });
  R.changes.push(function (e) { if (e.target.id !== 'dk-st') return false; D.st = e.target.value; repaint(); return true; });
  /* الأسهم بتنقل بين الصفوف، وEnter بيفتح الشاشة الكاملة. بيشتغلوا لما التركيز على الجدول أو مش على حاجة،
     عشان Enter على زر الاعتماد أو أي زر تاني يفضل بيعمل شغله. */
  document.addEventListener('keydown', function (e) {
    if (!/^#desk/.test(location.hash) || !document.getElementById('dk-tb')) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !document.getElementById('sheet').hidden) return;
    var t = e.target;
    if (!(t === document.body || t === document.documentElement || (t && t.closest && t.closest('#dk-tb')))) return;
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
    var rows = shown(); if (!rows.length) return;
    var tr = t.closest && t.closest('tr[data-k]'), k = tr ? tr.getAttribute('data-k') : D.sel;
    var i = rows.map(function (r) { return r.k; }).indexOf(k);
    if (e.key === 'Enter') {
      var r = rows[i]; if (!r) return;
      e.preventDefault();
      if (!r.doc) return select(r.k, true);          /* مستند قديم من غير شاشة: التفاصيل هنا بس */
      return R.go(r.doc.type === 'stmt' ? 'stmt/' + encodeURIComponent(r.doc.id) : 'doc/' + encodeURIComponent(r.doc.key));
    }
    e.preventDefault();
    i = i < 0 ? 0 : e.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1);
    select(rows[i].k, true);
  });
  R.on.render = (R.on.render || []).concat([function (r) { document.body.classList.toggle('is-desk', r.name === 'desk'); }]);
});
