/* مخزن الموقع (6.4): رصيد كل صنف = الوارد بإذونات التوريد − المنصرف للتنفيذ ± فروق الجرد، من «بداية المخزن» بتاعة المشروع.
   القائمة بالفئات والبحث وتنبيه قرب النفاد، وشاشة الصنف بحركاته. نموذجا الصرف والجرد في site.js مع باقي النماذج.
   الحركات من السكريبت (store.moves)، ومعاها المستندات اللي اتسجّلت على الجهاز ولسه ما رجعتش في التحديث، واللي في الطابور. */
(window.BDW_EXT = window.BDW_EXT || []).push(function (R) {
  'use strict';
  var S = R.S, IC = R.IC, esc = R.esc, num = R.num;
  var V = { cat: '', q: '', f: '' };               /* فلاتر القائمة: الفئة، والبحث، وحالة الرصيد (low / empty) */
  var KIND = { permit: 'in', issue: 'out', count: 'adj' }, TYPE_OF = { in: 'permit', out: 'issue', adj: 'count' };

  function st() { return (S.data && S.data.store) || { on: false }; }
  function on() { return !!st().on; }
  function start() { return st().start || ''; }
  function outSet() { var o = {}; (st().out || []).forEach(function (c) { o[c] = 1; }); return o; }
  /* الصنف من أصناف المخزن؟ (موجود في الأصناف، ومش من اللي بتتصرف أول ما توصل) */
  function isItem(c) { return on() && R.hasItem(c) && !outSet()[c]; }
  function items() { var o = outSet(); return (S.data.items || []).map(function (i) { return i[0]; }).filter(function (c) { return !o[c]; }); }
  function round(n) { return Math.round(n * 1000) / 1000; }
  function canMove() { return ['site', 'eng', 'admin'].indexOf(R.role()) >= 0; }

  /* حركة من مستند: [النوع، الرقم، التاريخ، الصنف، الكمية، الحالة، الطرف أو المستلم، بند المقايسة أو العدد الفعلي، المفتاح] */
  function toMove(x, status) {
    var k = KIND[x.type];
    return [k, x.id || '', x.date || R.iso(x.at), x.item, Number(x.qty) || 0, status || x.status, k === 'in' ? x.party : k === 'out' ? (x.exec || 'ذاتي') : '',
      k === 'out' ? (x.boq || '') : k === 'adj' ? Number(x.counted) : '', x.key || ''];
  }
  function dead(s) { return s === 'مرفوض' || s === 'ملغى'; }
  function moves() {
    if (!on()) return [];
    var s0 = start(), list = [], seen = {}, docSt = {};
    (S.data.docs || []).forEach(function (x) { if (KIND[x.type] && x.id && x.project === S.project) docSt[x.type + '|' + x.id] = x; });
    (st().moves || []).forEach(function (m) {
      var d = docSt[TYPE_OF[m[0]] + '|' + m[1]];
      seen[m[0] + '|' + m[1]] = 1;
      if (d && dead(d.status)) return;                         /* اترفض بعد آخر تحديث */
      var c = m.slice(); if (d) { c[5] = d.status; c[8] = d.key; if (m[0] === 'adj') c[4] = Number(d.qty) || 0; }
      list.push(c);
    });
    /* اللي اتسجّل على الجهاز ولسه ما رجعش في نسخة السيرفر */
    (S.data.docs || []).forEach(function (x) {
      var k = KIND[x.type];
      if (!k || !x.id || x.project !== S.project || seen[k + '|' + x.id] || dead(x.status) || !isItem(x.item)) return;
      if ((x.date || R.iso(x.at)) < s0) return;
      list.push(toMove(x));
    });
    /* اللي في الطابور */
    R.pendingDocs().forEach(function (x) {
      if (!KIND[x.type] || x.project !== S.project || !isItem(x.item) || (x.date || '') < s0) return;
      list.push(toMove(x, 'بانتظار المزامنة'));
    });
    return list;
  }
  /* رصيد كل صنف ليه حركة */
  function totals() {
    var t = {}, low = st().low || (S.data.settings || {}).storeLow || 0.1;
    moves().forEach(function (m) {
      if (dead(m[5])) return;
      var o = t[m[3]] || (t[m[3]] = { code: m[3], inQ: 0, outQ: 0, adj: 0, plus: 0, n: 0, last: '' });
      if (m[0] === 'in') o.inQ += m[4]; else if (m[0] === 'out') o.outQ += m[4]; else { o.adj += m[4]; if (m[4] > 0) o.plus += m[4]; }
      o.n++; if (m[2] > o.last) o.last = m[2];
    });
    Object.keys(t).forEach(function (c) {
      var o = t[c]; o.inQ = round(o.inQ); o.outQ = round(o.outQ); o.adj = round(o.adj);
      o.bal = round(o.inQ - o.outQ + o.adj); o.got = round(o.inQ + o.plus);
      o.state = o.bal < -1e-9 ? 'neg' : o.bal <= 1e-9 ? 'empty' : o.got > 0 && o.bal <= low * o.got ? 'low' : 'ok';
    });
    return t;
  }
  function bal(c) { var o = totals()[c]; return o ? o.bal : 0; }
  /* فيه جرد للصنف ده مستني القرار؟ (الجرد الجاي بيتحسب بعده) */
  function pendingCount(c, exceptKey) {
    return moves().some(function (m) { return m[0] === 'adj' && m[3] === c && (m[5] === 'مسجَّل' || m[5] === 'بانتظار المزامنة') && (!exceptKey || m[8] !== exceptKey); });
  }
  function signed(n) { n = round(Number(n) || 0); return '<span class="ltr">' + (n > 0 ? '+' : n < 0 ? '−' : '') + num(Math.abs(n)) + '</span>'; }
  function flag(o) {
    if (o.state === 'low') return '<span class="chip c-reg">قرب يخلص</span>';
    if (o.state === 'empty') return '<span class="chip c-rej">خلص</span>';
    if (o.state === 'neg') return '<span class="chip c-rej">بالسالب</span>';
    return '';
  }
  /* العدد مع الصنف: صنف واحد، صنفين، 3 أصناف، 11 صنفًا */
  function nItems(n) { return n === 1 ? 'صنف واحد' : n === 2 ? 'صنفين' : n <= 10 ? n + ' أصناف' : n + ' صنفًا'; }
  function tone(o) { return o.state === 'low' ? 'gold' : o.state === 'empty' || o.state === 'neg' ? 'red' : 'navy'; }
  var ORDER = { neg: 0, low: 1, ok: 2, empty: 3 };

  /* ---------- القائمة ---------- */
  function itemRow(o) {
    var it = R.item(o.code), t = tone(o);
    return '<button class="row" data-act="st-item" data-code="' + esc(o.code) + '">' + R.lead('box', t) +
      '<span class="rm"><span class="rt">' + esc(it.name) + '</span><span class="rs">وارد ' + num(o.inQ) + ' — منصرف ' + num(o.outQ) + (o.adj ? ' — جرد ' + signed(o.adj) : '') + '</span>' +
      '<span class="rx">' + esc(o.code) + (it.cat ? ' — ' + esc(it.cat) : '') + '</span></span>' +
      '<span class="re"><span class="sbal' + (t === 'navy' ? '' : ' ' + t) + '">' + num(o.bal) + '<small>' + esc(it.unit) + '</small></span>' + flag(o) + '</span></button>';
  }
  function listHtml(all) {
    var q = V.q.trim().toLowerCase();
    var rows = all.filter(function (o) {
      var it = R.item(o.code);
      if (V.cat && (it.cat || 'بدون فئة') !== V.cat) return false;
      if (V.f === 'low' && o.state !== 'low') return false;
      if (V.f === 'empty' && o.state !== 'empty' && o.state !== 'neg') return false;
      return !q || it.name.toLowerCase().indexOf(q) >= 0 || o.code.toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return ORDER[a.state] - ORDER[b.state] || R.item(a.code).name.localeCompare(R.item(b.code).name, 'ar'); });
    if (!rows.length) return '<div class="card empty" style="padding:26px"><b>مفيش أصناف مطابقة</b>جرّب كلمة تانية أو فئة تانية.</div>';
    return '<div class="list boxed">' + rows.map(itemRow).join('') + '</div>';
  }
  function viewStore(r) {
    if (r.sub) return viewItem(r.sub);
    var head = R.head({ title: 'مخزن الموقع', pbar: true });
    if (!on()) return head + '<main class="view">' + R.strip() + '<div class="empty"><b>المخزن لسه ما اتفعّلش للمشروع ده</b>مدير المنظومة بيكتب تاريخ «بداية المخزن» للمشروع في «إعدادات التطبيق» بملف البيانات. ' +
      'بعدها أول حركة لكل صنف جرد افتتاحي بالرصيد الفعلي، والوارد بييجي لوحده من إذونات التوريد.</div></main>' + R.nav('');
    var T = totals(), all = Object.keys(T).map(function (c) { return T[c]; });
    var nIn = all.filter(function (o) { return o.bal > 1e-9; }).length, nLow = all.filter(function (o) { return o.state === 'low'; }).length,
      nOut = all.filter(function (o) { return o.state === 'empty' || o.state === 'neg'; }).length;
    var cats = {}; all.forEach(function (o) { var c = R.item(o.code).cat || 'بدون فئة'; cats[c] = (cats[c] || 0) + 1; });
    if (V.cat && !cats[V.cat]) V.cat = '';
    var fab = canMove() ? '<button class="fab xt" data-act="go" data-to="new/issue">' + IC.boxout + '<span>صرف مواد</span></button>' : '';
    if (!all.length) {
      /* قبل يوم البداية مفيش تسجيل خالص (التاريخ ما يسبقش البداية وما يعدّيش النهارده)، فمفيش زرار جرد لحد اليوم ده */
      var when = esc(startLong());
      if (soon()) return head + '<main class="view">' + R.strip() + '<div class="card empty" style="padding:34px 22px"><b>المخزن هيبدأ ' + when + '</b>' +
        'يومها سجّل جرد افتتاحي لكل صنف موجود في الموقع، والوارد بعد كده بييجي لوحده من إذونات التوريد.</div></main>' + R.nav('');
      return head + '<main class="view">' + R.strip() + '<div class="card empty" style="padding:34px 22px"><b>لسه مفيش حركة في المخزن</b>المخزن بدأ ' + when +
        '. ابدأ بجرد افتتاحي لكل صنف موجود في الموقع، والوارد بعد كده بييجي لوحده من إذونات التوريد.' +
        (canMove() ? '<div style="margin-top:14px"><button class="btn" data-act="go" data-to="new/count">' + IC.clipcheck + 'سجّل جرد افتتاحي</button></div>' : '') + '</div></main>' + R.nav('');
    }
    return head + '<main class="view has-fab">' + R.strip() +
      '<div class="minis">' +
      '<button class="card mini' + (V.f === '' ? ' on' : '') + '" data-act="st-f" data-f=""><b>' + nIn + '</b><span>ليها رصيد</span></button>' +
      '<button class="card mini gold' + (V.f === 'low' ? ' on' : '') + '" data-act="st-f" data-f="low"><b>' + nLow + '</b><span>قرب يخلص</span></button>' +
      '<button class="card mini red' + (V.f === 'empty' ? ' on' : '') + '" data-act="st-f" data-f="empty"><b>' + nOut + '</b><span>خلص</span></button></div>' +
      '<div class="stool"><label class="srch">' + IC.search + '<input id="st-q" type="search" placeholder="دوّر باسم الصنف أو الكود" aria-label="دوّر في المخزن" value="' + esc(V.q) + '"></label>' +
      (canMove() ? '<button class="btn out sm" data-act="go" data-to="new/count">' + IC.clipcheck + 'جرد</button>' : '') + '</div>' +
      (Object.keys(cats).length > 1 ? '<div class="scats" role="tablist" aria-label="الفئات"><button role="tab" aria-selected="' + !V.cat + '" class="' + (V.cat ? '' : 'on') + '" data-act="st-cat" data-c="">الكل<span class="n">' + all.length + '</span></button>' +
        Object.keys(cats).sort(function (a, b) { return a.localeCompare(b, 'ar'); }).map(function (c) {
          return '<button role="tab" aria-selected="' + (V.cat === c) + '" class="' + (V.cat === c ? 'on' : '') + '" data-act="st-cat" data-c="' + esc(c) + '">' + esc(c) + '<span class="n">' + cats[c] + '</span></button>';
        }).join('') + '</div>' : '') +
      '<div id="st-list">' + listHtml(all) + '</div>' +
      '<div class="fh" style="text-align:center;margin:10px 4px">الرصيد = الوارد بإذونات التوريد من ' + esc(R.dateShort(new Date(start() + 'T12:00').getTime())) + ' − المنصرف ± فروق الجرد</div>' +
      '</main>' + fab + R.nav('');
  }

  /* ---------- الصنف وحركاته ---------- */
  function docFor(m) {
    if (m[8]) return R.byKey(m[8]) || R.pendingDocs().filter(function (x) { return x.key === m[8]; })[0] || null;
    var t = TYPE_OF[m[0]];
    return (S.data.docs || []).filter(function (x) { return x.type === t && x.id === m[1] && x.project === S.project; })[0] || null;
  }
  function moveRow(m) {
    var k = m[0], d = docFor(m), q = k === 'out' ? -m[4] : m[4];
    var label = k === 'in' ? 'وارد من ' + R.party(m[6]).name : k === 'out' ? 'صرف إلى ' + (m[6] === 'ذاتي' ? 'التنفيذ الذاتي' : R.party(m[6]).name) : 'جرد: العدد الفعلي ' + num(m[7]);
    var sub = (m[2] ? R.dateShort(new Date(m[2] + 'T12:00').getTime()) : '') + (k === 'out' && m[7] ? ' — ' + R.boq(m[7]).name : '');
    var lt = k === 'in' ? ['truck', 'green'] : k === 'out' ? ['boxout', 'navy'] : ['clipcheck', m[4] < 0 ? 'red' : 'gold'];
    var open = d ? '<button class="row" data-act="doc" data-key="' + esc(d.key) + '">' : '<div class="row">';
    return open + R.lead(lt[0], lt[1]) + '<span class="rm"><span class="rt">' + esc((m[1] || 'بلا رقم بعد') + ' — ' + label) + '</span><span class="rs">' + esc(sub) + '</span></span>' +
      '<span class="re"><span class="amt' + (q > 0 ? ' green' : q < 0 && k === 'adj' ? ' red' : '') + '">' + signed(q) + '</span>' + R.chip(m[5]) + '</span>' + (d ? '</button>' : '</div>');
  }
  function viewItem(code) {
    var it = R.item(code), o = totals()[code] || { code: code, inQ: 0, outQ: 0, adj: 0, n: 0, bal: 0, got: 0, state: '' };
    var t = tone(o), pend = pendingCount(code), used = o.got > 0 ? Math.max(0, Math.min(1, (o.got - Math.max(0, o.bal)) / o.got)) : 0;
    var ms = moves().filter(function (m) { return m[3] === code && !dead(m[5]); }).sort(function (a, b) {
      return (b[2] || '').localeCompare(a[2] || '') || String(b[1]).localeCompare(String(a[1]));
    });
    var enc = encodeURIComponent(code);
    var body = !isItem(code) ? '<div class="empty"><b>الصنف ده مش من أصناف المخزن</b>بيتصرف أول ما يوصل، أو مش موجود في الأصناف.</div>' :
      '<div class="card pad"><div class="shead"><div class="nm">' + esc(it.name) + '<small>' + esc(code) + (it.cat ? ' — ' + esc(it.cat) : '') + '</small></div>' +
      '<div class="sbig' + (t === 'navy' ? '' : ' ' + t) + '">' + num(o.bal) + '<small>' + esc(it.unit) + ' في المخزن</small></div></div>' +
      (o.got > 0 ? '<div class="prog" style="margin-top:12px" title="المنصرف من الوارد"><i style="width:' + (used * 100).toFixed(1) + '%;background:var(--navy-2)"></i><i style="width:' + ((1 - used) * 100).toFixed(1) + '%;background:var(--green)"></i></div>' : '') +
      '<div class="skv"><span>الوارد <b>' + num(o.inQ) + '</b></span><span>المنصرف <b>' + num(o.outQ) + '</b></span><span>فروق الجرد <b>' + signed(o.adj) + '</b></span></div>' +
      (flag(o) ? '<div style="margin-top:8px">' + flag(o) + '</div>' : '') + '</div>' +
      (pend ? '<div class="alert info" style="margin-top:10px">' + IC.info + '<div>فيه جرد للصنف ده مستني اعتماد محاسب المشروع. الجرد الجاي بعد القرار.</div></div>' : '') +
      (canMove() ? '<div class="sacts"><button class="btn" data-act="go" data-to="new/issue/' + enc + '"' + (o.bal > 1e-9 ? '' : ' disabled') + '>' + IC.boxout + 'صرف من الصنف ده</button>' +
        '<button class="btn out" data-act="go" data-to="new/count/' + enc + '"' + (pend ? ' disabled' : '') + '>' + IC.clipcheck + 'سجّل جرد</button></div>' : '') +
      '<div class="sect">حركات الصنف<span class="s">' + ms.length + ' — الأحدث أولًا</span></div>' +
      (ms.length ? '<div class="list boxed">' + ms.map(moveRow).join('') + '</div>' : '<div class="card empty" style="padding:24px"><b>مفيش حركة للصنف ده</b>أول حركة ليه جرد افتتاحي أو إذن توريد.</div>');
    return R.head({ title: it.name, back: true }) + '<main class="view">' + body + '</main>' + R.nav('');
  }

  /* ---------- مدخل المخزن في رئيسية الموقع ---------- */
  function storeCta() {
    if (!on()) return '';
    var T = totals(), all = Object.keys(T).map(function (c) { return T[c]; });
    var nIn = all.filter(function (o) { return o.bal > 1e-9; }).length, nLow = all.filter(function (o) { return o.state === 'low' || o.state === 'empty' || o.state === 'neg'; }).length;
    return '<button class="storecta" data-act="go" data-to="store">' + R.lead('box', nLow ? 'gold' : 'navy') + '<span><b>مخزن الموقع</b>' +
      (all.length ? nItems(nIn) + ' ليها رصيد' + (nLow ? '، و' + nItems(nLow) + ' قربت تخلص أو خلصت' : '') : soon() ? 'هيبدأ ' + esc(startLong()) : 'لسه مفيش حركة؛ ابدأ بجرد افتتاحي') + '</span>' + IC.next + '</button>';
  }
  function startLong() { return R.dateLong(new Date(start() + 'T12:00').getTime()); }
  function soon() { return !!start() && start() > R.today(); }

  /* ---------- الربط بالنواة ---------- */
  R.views.store = viewStore;
  R.storeOn = on; R.storeStart = start; R.storeIsItem = isItem; R.storeItems = items; R.storeTotals = totals; R.storeBal = bal;
  R.storePendingCount = pendingCount; R.storeSigned = signed; R.storeCta = storeCta;
  R.acts['st-item'] = function (b) { R.go('store/' + encodeURIComponent(b.getAttribute('data-code'))); };
  R.acts['st-cat'] = function (b) { V.cat = b.getAttribute('data-c'); R.render(true); };
  R.acts['st-f'] = function (b) { var f = b.getAttribute('data-f'); V.f = V.f === f ? '' : f; R.render(true); };
  R.inputs.push(function (e) {
    if (e.target.id !== 'st-q') return false;
    V.q = e.target.value;
    var el = document.getElementById('st-list'), T = totals();
    if (el) el.innerHTML = listHtml(Object.keys(T).map(function (c) { return T[c]; }));
    return true;
  });
});
