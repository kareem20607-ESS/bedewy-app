/* أرشيف المستندات (5.3): صور الإذونات والمحاضر ومصروفات العهدة، بتبويب لكل نوع ومتجمّعة بالشهر، والبحث بالرقم أو الطرف.
   من السكريبت: كل صفوف المشروع اللي ليها صورة من أي تاريخ (action: archive). وفي وضع التجربة: مستندات العيّنة اللي ليها صورة.
   الكارت بيعرض صورة صغيرة، واللمس بيكبّرها ومعاها «افتح المستند» لو المستند محمّل في التطبيق. */
(window.BDW_EXT = window.BDW_EXT || []).push(function (R) {
  'use strict';
  var S = R.S, IC = R.IC, esc = R.esc;
  var $ = function (s) { return document.querySelector(s); };
  var TYPES = [['permit', 'الإذونات'], ['qty', 'المحاضر'], ['exp', 'المصروفات']];
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var A = { items: null, project: '', at: 0, loading: false, err: '' }, q = '';
  /* عناصر الأرشيف: [النوع، الرقم، التاريخ، الوصف، الصورة، الحالة، المفتاح] */
  var I = { type: 0, id: 1, date: 2, label: 3, photo: 4, status: 5, key: 6 };

  function allowed() { return ['eng', 'acc', 'owner', 'admin'].indexOf(S.role) >= 0; }
  function label(d) {
    if (d.type === 'permit') return [R.party(d.party).name, R.item(d.item).name].filter(String).join(' — ');
    if (d.type === 'qty') return [R.boq(d.boq).name, R.num(d.qty), d.exec && d.exec !== 'ذاتي' ? R.party(d.exec).name : 'تنفيذ ذاتي'].join(' — ');
    return [d.cat, d.desc, R.money(d.amount)].filter(String).join(' — ');
  }
  function fromDocs() {
    return (S.data.docs || []).filter(function (d) { return d.photo && TYPES.some(function (t) { return t[0] === d.type; }); })
      .map(function (d) { return [d.type, d.id || '', d.date || R.iso(d.at), label(d), d.photo, d.status, d.key]; })
      .sort(function (a, b) { return String(b[I.date]).localeCompare(String(a[I.date])) || String(b[I.id]).localeCompare(String(a[I.id])); });
  }
  function load(force) {
    if (!R.LIVE) { A.items = fromDocs(); A.project = S.project; return; }
    if (A.loading) return;
    if (!force && A.items && A.project === S.project && Date.now() - A.at < 5 * 60000) return;
    if (navigator.onLine === false) { if (A.project !== S.project) A.items = null; A.err = 'offline'; return; }
    A.loading = true; A.err = '';
    var pj = S.project;
    R.post(R.CFG.API_URL, { action: 'archive', idToken: S.token, project: pj }, 45000).then(function (res) {
      A.loading = false;
      if (res && res.ok && res.items) { A.items = res.items; A.project = pj; A.at = Date.now(); }
      else { A.err = res && res.message ? res.message : 'net'; if (A.project !== pj) A.items = null; }
      if (/^#archive/.test(location.hash)) R.render(true);
    });
  }
  function match(it) {
    if (!q) return true;
    var t = q.trim().toLowerCase();
    return String(it[I.id]).toLowerCase().indexOf(t) >= 0 || String(it[I.label]).toLowerCase().indexOf(t) >= 0;
  }
  function monthName(iso) { var m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? MONTHS[Number(m[2]) - 1] + ' ' + m[1] : 'من غير تاريخ'; }
  function listHtml() {
    var tab = S.tab.arch || 'permit';
    if (!A.items) {
      if (A.err === 'offline') return '<div class="empty"><b>الأرشيف محتاج نت أول مرة</b>أول ما النت يرجع افتحه تاني.</div>';
      if (A.err) return '<div class="empty"><b>الأرشيف ما اتحمّلش</b>' + esc(A.err === 'net' ? 'جرّب تاني بعد شوية.' : A.err) + '</div>';
      return '<div class="empty"><b>بحمّل الأرشيف…</b>كل صور المستندات في المشروع.</div>';
    }
    var list = A.items.filter(function (it) { return it[I.type] === tab && match(it); });
    if (!list.length) return q ? '<div class="empty"><b>مفيش نتيجة لـ «' + esc(q) + '»</b>جرّب رقم المستند (زي SP-0201) أو جزء من اسم الطرف.</div>' :
      '<div class="empty"><b>لسه مفيش صور هنا</b>أي مستند بيتسجّل من التطبيق بصورته بيظهر هنا، ويفضل محفوظ حتى لو اتلغى.</div>';
    var out = '', cur = '', grp = [];
    var flush = function () {
      if (!grp.length) return;
      out += R.gh(monthName(grp[0][I.date]), grp.length, '') + '<div class="arcs">' + grp.map(card).join('') + '</div>';
      grp = [];
    };
    list.forEach(function (it) { var k = String(it[I.date]).slice(0, 7); if (k !== cur) { flush(); cur = k; } grp.push(it); });
    flush();
    return out;
  }
  function card(it) {
    return '<button class="arc" data-act="ar-open" data-k="' + esc(it[I.type] + '|' + it[I.id]) + '">' +
      '<span class="th" data-photo="thumb:' + esc(it[I.photo]) + '" data-kind="' + esc(it[I.type]) + '"></span>' +
      '<span class="tx"><b>' + esc(it[I.id]) + '</b>' + (it[I.status] !== 'معتمد' ? R.chip(it[I.status]) : '') + '<small>' + esc(it[I.label]) + '</small><small>' + esc(R.dateShort(it[I.date])) + '</small></span></button>';
  }
  function viewArchive() {
    if (!allowed()) return R.head({ title: 'أرشيف المستندات', back: true }) + '<main class="view"><div class="empty"><b>الأرشيف للمهندس والمكتب</b>صور اللي سجّلته موجودة في «سجلاتي».</div></main>' + R.nav('archive');
    load();
    var tab = S.tab.arch || 'permit';
    var tabs = '<div class="tabs" role="tablist">' + TYPES.map(function (t) {
      var n = A.items ? A.items.filter(function (it) { return it[I.type] === t[0]; }).length : 0;
      return '<button role="tab" aria-selected="' + (t[0] === tab) + '" class="' + (t[0] === tab ? 'on' : '') + '" data-act="ar-tab" data-t="' + t[0] + '">' + t[1] +
        (n ? '<span class="cnt">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    return R.head({ title: 'أرشيف المستندات', pbar: true }) + tabs + '<main class="view">' +
      '<label class="srch">' + IC.search + '<input id="ar-q" type="search" inputmode="search" autocomplete="off" placeholder="دوّر برقم المستند أو الطرف" value="' + esc(q) + '"></label>' +
      '<div id="ar-list">' + listHtml() + '</div></main>' + R.nav('archive');
  }
  function find(k) {
    var p = String(k || '').split('|');
    return (A.items || []).filter(function (it) { return it[I.type] === p[0] && it[I.id] === p[1]; })[0] || null;
  }

  R.views.archive = viewArchive;
  R.acts['ar-tab'] = function (b) { S.tab.arch = b.getAttribute('data-t'); R.render(); };
  R.acts['ar-open'] = function (b) {
    var it = find(b.getAttribute('data-k'));
    if (!it) return;
    var doc = R.byKey(it[I.key]) || (S.data.docs || []).filter(function (d) { return d.type === it[I.type] && d.id === it[I.id]; })[0];
    var el = document.getElementById('sheet'); el.className = 'sheet center'; el.hidden = false;
    el.innerHTML = '<div class="zoomwrap"><div class="zoom" data-photo="' + esc(it[I.photo]) + '" data-kind="' + esc(it[I.type]) + '"></div>' +
      '<div class="zcap"><b>' + esc(R.TYPE[it[I.type]] + ' ' + it[I.id]) + '</b>' + esc(it[I.label]) + '<br>' + esc(R.dateLong(it[I.date]) + ' — ' + it[I.status]) + '</div>' +
      (doc ? '<button class="btn wide" data-act="ar-doc" data-key="' + esc(doc.key) + '">' + IC.eye + 'افتح المستند</button>' : '') +
      '<button class="btn out wide" style="margin-top:8px" data-act="sheet-close">إغلاق</button></div>';
    R.fillPhotos(el);
  };
  R.acts['ar-doc'] = function (b) { var k = b.getAttribute('data-key'); R.closeSheet(); R.go('doc/' + encodeURIComponent(k)); };
  R.inputs.push(function (e) {
    if (e.target.id !== 'ar-q') return false;
    q = e.target.value;
    var l = $('#ar-list'); if (l) { l.innerHTML = listHtml(); R.fillPhotos(l); }
    return true;
  });
});
