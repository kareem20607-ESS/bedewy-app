/* تطبيق منظومة البديوي — النواة: الدخول، البيانات، التنقل، القائمة، طابور الإرسال، والشغل من غير نت.
   نفس طريقة reno-app: صفحات ثابتة، دخول بحساب جوجل، وسكريبت Apps Script للقراءة والكتابة على ملف البيانات. */
(function () {
  'use strict';
  var CFG = window.BDW_CONFIG || {};
  var LIVE = !!(CFG.CLIENT_ID && CFG.API_URL);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app');
  var S = {
    data: null, token: null, user: null, loginErr: '', loading: false, offline: false, dataAt: null, netErr: false,
    role: 'site', tab: {}, q: '', installEvt: null
  };
  var IC = window.IC;

  /* ---------- أدوات ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n, dec) {
    n = Number(n) || 0;
    var d = dec != null ? dec : (Math.abs(n - Math.round(n)) > 0.004 ? 2 : 0);
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function money(n) { return n == null || n === '' ? '—' : num(n) + ' ج'; }
  function short(n) {               /* 150000000 → 150 م */
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e6) return (Math.round(n / 1e5) / 10).toLocaleString('en-US') + ' م';
    return num(n);
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(t) { var d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return iso(Date.now()); }
  function hm(t) { var d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  var DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  function dayName(t) { return DAYS[new Date(t).getDay()]; }
  function dateLong(t) { var d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function dateShort(t) { var d = new Date(t); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }
  /* «اليوم 11:05» · «أمس 16:40» · «منذ 4 أيام» · «20 أكتوبر» */
  function when(t) {
    if (!t) return '';
    var d = new Date(t), n = new Date(), days = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
    if (days <= 0) return 'اليوم ' + hm(t);
    if (days === 1) return 'أمس ' + hm(t);
    if (days < 7) return 'منذ ' + (days === 2 ? 'يومين' : days + ' أيام');
    return dateShort(t) + (d.getFullYear() !== n.getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function ago(t) {
    var m = Math.round((Date.now() - t) / 6e4);
    if (m < 1) return 'الآن';
    /* العدد من 3 لـ10 جمع (دقائق، ساعات، أيام)، ومن 11 مفرد منصوب */
    if (m < 60) return 'منذ ' + (m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : m <= 10 ? m + ' دقائق' : m + ' دقيقة');
    var h = Math.round(m / 60); if (h < 24) return 'منذ ' + (h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? h + ' ساعات' : h + ' ساعة');
    var d = Math.floor(h / 24); return 'منذ ' + (d === 1 ? 'يوم' : d === 2 ? 'يومين' : d <= 10 ? d + ' أيام' : d + ' يومًا');
  }
  function uid() { var a = new Uint8Array(8); crypto.getRandomValues(a); return Date.now().toString(36) + '-' + Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  var toastT;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3400); }
  function km(a, b) {                /* المسافة بالكيلومتر بين نقطتين */
    if (!a || !b || a.lat == null || b.lat == null) return null;
    var R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dg = (b.lng - a.lng) * r;
    var x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dg / 2) * Math.sin(dg / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  /* ---------- الأدوار ---------- */
  /* nav = الشريط السفلي، more = شاشات زيادة في القائمة الجانبية */
  var ROLES = {
    site: { n: 'محاسب الموقع', home: 'site', nav: [['home', 'الرئيسية', 'home'], ['new/permit', 'إذن جديد', 'truck'], ['new/qty', 'محضر جديد', 'ruler'], ['custody', 'العهدة', 'wallet'], ['mine', 'سجلاتي', 'folder']] },
    eng: { n: 'مهندس الموقع', home: 'site', nav: [['home', 'الرئيسية', 'home'], ['inbox', 'الاعتماد', 'inbox'], ['new/qty', 'محضر جديد', 'ruler'], ['mine', 'سجلاتي', 'folder'], ['soon:5.3', 'الأرشيف', 'images']],
      more: [['stmts', 'المستخلصات', 'stmt']] },
    acc: { n: 'محاسب المشروع', home: 'office', nav: [['home', 'الرئيسية', 'home'], ['inbox', 'الاعتماد', 'inbox'], ['stmts', 'المستخلصات', 'stmt'], ['vouchers', 'السندات', 'money'], ['parties', 'الأطراف', 'users']],
      more: [['dash', 'لوحة المشروع', 'pie']] },
    owner: { n: 'المالك', greet: 'يا حاج محمد', home: 'office', nav: [['home', 'الرئيسية', 'home'], ['inbox', 'الاعتماد', 'inbox'], ['dash', 'اللوحة', 'pie'], ['stmts', 'المستخلصات', 'stmt'], ['parties', 'الأطراف', 'users']],
      more: [['vouchers', 'السندات', 'money']] },
    admin: { n: 'مدير المنظومة', home: 'office', nav: [['home', 'الرئيسية', 'home'], ['inbox', 'الاعتماد', 'inbox'], ['dash', 'اللوحة', 'pie'], ['stmts', 'المستخلصات', 'stmt'], ['vouchers', 'السندات', 'money']],
      more: [['parties', 'الأطراف', 'users']] }
  };
  function role() { return S.role; }
  function me() { return { role: S.role, name: (S.user && S.user.name) || ROLES[S.role].n, email: (S.user && S.user.email) || '' }; }

  /* ---------- البيانات ---------- */
  var IX = {};
  function setData(d) {
    S.data = d;
    if (d.user && d.user.role && ROLES[d.user.role]) S.role = d.user.role;
    IX.party = {}; (d.parties || []).forEach(function (p) { IX.party[p[0]] = { code: p[0], name: p[1], type: p[2], phone: p[3] || '' }; });
    IX.acc = {}; (d.accounts || []).forEach(function (a) { IX.acc[a[0]] = a[1]; });
    IX.item = {}; (d.items || []).forEach(function (p) { IX.item[p[0]] = { code: p[0], name: p[1], unit: p[2] }; });
    IX.boq = {}; (d.boq || []).forEach(function (p) { IX.boq[p[0]] = { code: p[0], name: p[1], unit: p[2], qty: p[3], price: p[4], done: p[5], boq: true }; });
    (d.subItems || []).forEach(function (p) { IX.boq[p[0]] = { code: p[0], name: p[1], unit: p[2], qty: null, price: null, done: null, boq: false }; });
    if (d.demo) {                     /* في التجربة: اللي اتسجّل على الجهاز ده بيفضل بعد إعادة الفتح */
      var saved = load('bdw_demo_docs');
      if (saved && saved.length) d.docs = saved;
      var xs = load('bdw_demo_x');
      if (xs) { if (xs.qtyAll) d.qtyAll = xs.qtyAll; if (xs.vouchers) d.vouchers = xs.vouchers; }
    }
    var p = load('bdw_project'); S.project = (p && (d.projects || []).some(function (x) { return x.code === p; })) ? p : ((d.projects || [])[0] || {}).code;
  }
  function saveDemo() {
    if (!S.data || !S.data.demo) return;
    store('bdw_demo_docs', (S.data.docs || []).filter(function (d) { return !d._tmp; }));
    store('bdw_demo_x', { qtyAll: S.data.qtyAll, vouchers: S.data.vouchers });
  }
  function project(code) { var c = code || S.project; return (S.data.projects || []).filter(function (x) { return x.code === c; })[0] || {}; }
  function party(c) { return IX.party[c] || { code: c, name: c || '—', type: '', phone: '' }; }
  function account(c) { return IX.acc[c] || ''; }
  function item(c) { return IX.item[c] || { code: c, name: c || '—', unit: '' }; }
  function boq(c) { return IX.boq[c] || { code: c, name: c || '—', unit: '' }; }
  function docs(f) { return (S.data.docs || []).filter(function (x) { return x.project === S.project && (!f || f(x)); }); }
  function byKey(k) { return (S.data.docs || []).filter(function (x) { return x.key === k; })[0] || null; }
  function isMine(x) { return S.data.demo ? x.by === S.role : !!x.mine; }

  /* قيمة المستند ونصوصه في القوائم */
  var TYPE = { permit: 'إذن توريد', qty: 'محضر كميات', exp: 'مصروف عهدة', voucher: 'سند صرف', stmt: 'مستخلص' };
  function typeName(x) {
    if (x.type === 'voucher' && x.kind === 'قبض') return 'سند قبض';
    if (x.type === 'stmt') return x.kind === 'عميل' ? 'مستخلص عميل' : 'مستخلص مقاول باطن';
    return TYPE[x.type] || '';
  }
  function value(x) {
    if (x.type === 'permit') return x.price == null ? null : x.qty * x.price;
    if (x.type === 'qty') { var b = boq(x.boq); return b.price == null ? null : x.qty * b.price * (1 - (project(x.project).discount || 0)); }
    if (x.type === 'stmt') return x.net;
    return x.amount;
  }
  function title(x) {
    var no = x.id || (x.type === 'qty' ? 'محضر' : x.type === 'exp' ? 'مصروف' : x.type === 'voucher' ? 'سند' : 'إذن') + ' بلا رقم بعد';
    if (x.type === 'voucher' && !x.party) return no + ' — ' + (x.notes || x.desc || '');
    if (x.type === 'permit' || x.type === 'voucher' || x.type === 'stmt') return no + ' — ' + party(x.party).name.split(' — ')[0];
    if (x.type === 'qty') return no + ' — ' + x.boq;
    return no + ' — ' + (x.desc || x.cat);
  }
  function sub(x) {
    if (x.type === 'permit') { var it = item(x.item); return it.name + '‏ — ' + num(x.qty) + ' ' + it.unit; }
    if (x.type === 'qty') { var b = boq(x.boq); return b.name + '‏ — ' + num(x.qty) + ' ' + b.unit; }
    if (x.type === 'exp') return x.cat;
    if (x.type === 'voucher') return (x.notes || x.desc || typeName(x)) + ' — ' + (x.method || '');
    if (x.type === 'stmt') {
      var nm = (x.kind === 'عميل' ? 'مستخلص عميل' : 'مستخلص') + (x.extNo && x.extNo !== 'جارٍ' ? ' رقم ' + x.extNo : ' جارٍ');
      var st = x.status === 'مسودة' ? 'مسودة لم تُرسل' : x.status === 'تحت المراجعة' ? (x.techOk ? 'اعتماد فني ✓' : 'ينتظر الاعتماد الفني') : x.status;
      return nm + ' — ' + st;
    }
    return '';
  }
  var ICON = { permit: 'truck', qty: 'ruler', exp: 'receipt', voucher: 'money', stmt: 'stmt' };

  /* ---------- أجزاء الواجهة ---------- */
  var CHIP = { 'مسجَّل': ['c-reg', 'clock'], 'معتمد': ['c-ok', 'check'], 'مرفوض': ['c-rej', 'x'], 'ملغى': ['c-void', 'x'], 'تحت المراجعة': ['c-rev', 'hourglass'], 'بانتظار المزامنة': ['c-sync', 'upload'], 'مسودة': ['c-draft', 'edit'] };
  function chip(s) { var c = CHIP[s] || ['c-void', 'dot']; return '<span class="chip ' + c[0] + '">' + IC[c[1]] + esc(s) + '</span>'; }
  function lead(icon, tone) { return '<span class="ld t-' + (tone || 'navy') + '">' + IC[icon] + '</span>'; }
  function toneOf(s) { return s === 'معتمد' ? 'green' : s === 'مرفوض' ? 'red' : s === 'ملغى' ? 'gray' : s === 'بانتظار المزامنة' || s === 'مسودة' ? 'navy' : 'gold'; }
  function gh(text, n, tone, s) { return '<div class="gh ' + (tone || '') + '">' + esc(text) + (n != null ? '<span class="n">' + num(n) + '</span>' : '') + (s ? '<span class="s">' + s + '</span>' : '') + '</div>'; }
  function docRow(x, o) {
    o = o || {};
    var v = value(x), st = x.pending ? 'بانتظار المزامنة' : x.status;
    var meta = x.pending ? 'سُجّل ' + when(x.at) + (navigator.onLine === false ? ' بدون إنترنت' : '') :
      st === 'مرفوض' ? 'السبب: ' + (x.reason || '') :
      st === 'معتمد' ? 'اعتُمد ' + when(x.decidedAt || x.at) : when(x.at);
    var late = st === 'مسجَّل' && (Date.now() - x.at) > (S.data.settings.lateDays || 3) * 864e5;
    return '<button class="row" data-act="doc" data-key="' + esc(x.key) + '">' + lead(ICON[x.type], toneOf(st)) +
      '<span class="rm"><span class="rt">' + esc(title(x)) + '</span><span class="rs">' + esc(sub(x)) + '</span>' +
      '<span class="rx' + (st === 'مرفوض' ? ' red' : late ? ' gold' : '') + '">' + esc(meta) + '</span></span>' +
      '<span class="re">' + (v != null ? '<span class="amt">' + money(v) + '</span>' : '') + (o.noChip ? '' : chip(st)) + '</span></button>';
  }
  function head(o) {
    o = o || {};
    var pend = outbox().length;
    return '<header class="head"><div class="head-row">' +
      (o.back ? '<button class="hbtn" data-act="back" aria-label="رجوع">' + IC.back + '</button>' : '<button class="hbtn" data-act="menu" aria-label="القائمة">' + IC.menu + '</button>') +
      '<h1>' + esc(o.title || '') + '</h1>' +
      (o.noSync ? '' : '<button class="hbtn" data-act="sync" aria-label="مزامنة">' + IC.sync + (pend ? '<i class="h-count">' + pend + '</i>' : '') + '</button>') +
      '</div>' + (o.pbar ? pbar() : '') + '<div class="netbar" role="status" hidden></div></header>';
  }
  function pbar() {
    var p = project();
    return '<div class="pbar">' + IC.pin + '<span>' + esc(p.short || p.name || '') + '</span><button data-act="go" data-to="prefs">تغيير' + IC.down + '</button></div>';
  }
  function nav(on) {
    var r = ROLES[S.role], inbox = inboxDocs().length, pend = outbox().length;
    return '<nav class="nav" aria-label="التنقل">' + r.nav.map(function (t) {
      var badge = t[0] === 'inbox' && inbox ? inbox : t[0] === 'mine' && pend ? pend : 0;
      return '<button data-act="tab" data-to="' + t[0] + '"' + (t[0] === on ? ' class="on" aria-current="page"' : '') + '>' + IC[t[2]] + '<span>' + t[1] + '</span>' +
        (badge ? '<i class="dotc">' + badge + '</i>' : '') + '</button>';
    }).join('') + '</nav>';
  }
  function strip() {
    if (LIVE) return '';
    return '<div class="strip">' + IC.info + '<div><b>بيانات عيّنة للتجربة.</b> اللي بتسجّله بيتحفظ على الجهاز ده بس. جرّب الأدوار من القائمة.</div></div>';
  }

  /* ---------- الصور: على الجهاز في IndexedDB، وصور العيّنة رسومات ---------- */
  var mem = {}, dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res) {
      try {
        var r = indexedDB.open('bdw', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('files'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  var blob = {
    put: function (k, v) {
      mem[k] = v;
      return db().then(function (d) { if (!d) return; return new Promise(function (res) { try { var t = d.transaction('files', 'readwrite'); t.objectStore('files').put(v, k); t.oncomplete = res; t.onerror = res; } catch (e) { res(); } }); });
    },
    get: function (k) {
      if (mem[k]) return Promise.resolve(mem[k]);
      return db().then(function (d) {
        if (!d) return null;
        return new Promise(function (res) { try { var q = d.transaction('files').objectStore('files').get(k); q.onsuccess = function () { if (q.result) mem[k] = q.result; res(q.result || null); }; q.onerror = function () { res(null); }; } catch (e) { res(null); } });
      });
    },
    del: function (k) { delete mem[k]; return db().then(function (d) { if (!d) return; try { d.transaction('files', 'readwrite').objectStore('files').delete(k); } catch (e) { } }); }
  };
  /* رسم مستند ورقي مكان صورة العيّنة */
  function docArt(seed, kind) {
    seed = Number(seed) || 0;
    var titles = { permit: 'إذن توريد', qty: 'محضر استلام أعمال', exp: 'إيصال نقدية' };
    var bg = ['#B6AC9C', '#A7B1BC', '#C1B4A0', '#9EA8B3', '#B3A793', '#AEB6B0', '#B9B0A2', '#A9B3BD', '#BDB3A6'][seed % 9];
    var rot = [-4, 3, -2, 5, -3, 2, -1, 4, -2][seed % 9], lines = '', scr = '';
    for (var i = 0; i < 6; i++) {
      var y = 58 + i * 15; lines += '<line x1="74" y1="' + y + '" x2="246" y2="' + y + '" stroke="#D3D6DB"/>';
      var x0 = 150 - ((seed * 7 + i * 13) % 60), d = 'M' + x0 + ' ' + (y - 3), x = x0, k = seed + i;
      while (x < 240) { k = (k * 37 + 11) % 97; var w = 7 + k % 6; d += ' q ' + w / 2 + ' ' + ((k % 2) ? -(2 + k % 3) : (2 + k % 3)) + ' ' + w + ' 0'; x += w; }
      scr += '<path d="' + d + '" fill="none" stroke="#1F4FA3" stroke-width="1.5" stroke-linecap="round"/>';
    }
    return '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="' + bg + '"/>' +
      '<g transform="rotate(' + rot + ' 160 92)"><rect x="66" y="21" width="200" height="152" rx="2" fill="#000" opacity=".2"/><rect x="62" y="16" width="200" height="152" rx="2" fill="#FBFAF6"/>' +
      '<rect x="62" y="16" width="200" height="22" fill="#EEF1F6"/><text x="162" y="32" font-family="Cairo" font-size="12" font-weight="700" fill="#2A2F3A" text-anchor="middle">' + (titles[kind] || 'مستند') + '</text>' +
      lines + scr + '<circle cx="104" cy="140" r="16" fill="none" stroke="#3B5BB5" stroke-width="2" opacity=".7"/></g></svg>';
  }
  /* بيرجّع HTML الصورة (img أو رسم) لمستند */
  /* صور المستندات الحقيقية في فولدر خاص على Drive، وبتوصل عن طريق السكريبت بعد التأكد من الدخول، وبتتحفظ على الجهاز */
  var fetching = {};
  function drivePhoto(ref) {
    return blob.get(ref).then(function (v) {
      if (v) return v;
      if (!LIVE || !S.token) return null;
      if (!fetching[ref]) fetching[ref] = post(CFG.API_URL, { action: 'photo', idToken: S.token, id: ref }, 45000).then(function (r) {
        delete fetching[ref];
        if (r && r.ok && r.data) { blob.put(ref, r.data); return r.data; }
        return null;
      });
      return fetching[ref];
    });
  }
  var NOPHOTO = '<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"><rect width="320" height="180" fill="#DCE2EC"/>' +
    '<text x="160" y="96" font-family="Cairo" font-size="13" font-weight="700" fill="#5B6472" text-anchor="middle">الصورة مش متاحة دلوقتي</text></svg>';
  function photoHtml(ref, kind) {
    if (!ref) return Promise.resolve('');
    var m = /^sample:(\d+)/.exec(ref);
    if (m) return Promise.resolve(docArt(m[1], kind));
    if (/^drive:/.test(ref)) return drivePhoto(ref).then(function (v) { return v ? '<img alt="" src="' + v + '">' : NOPHOTO; });
    if (/^(https?:|data:)/.test(ref)) return Promise.resolve('<img alt="" src="' + esc(ref) + '">');
    return blob.get(ref).then(function (v) { return v ? '<img alt="" src="' + v + '">' : docArt(3, kind); });
  }
  /* بيملأ أي عنصر فيه data-photo بعد الرسم */
  function fillPhotos(root) {
    (root || document).querySelectorAll('[data-photo]').forEach(function (el) {
      photoHtml(el.getAttribute('data-photo'), el.getAttribute('data-kind')).then(function (h) { if (h) el.innerHTML = h + (el.getAttribute('data-ov') || ''); });
    });
  }

  /* ---------- طابور الإرسال ----------
     كل مستند بيتسجّل بمفتاح فريد ويستنى هنا لحد ما السكريبت يأكّد إنه اتسجّل. من غير نت بيفضل لحد ما النت يرجع. */
  function outbox() { return load('bdw_outbox') || []; }
  function saveOutbox(l) { store('bdw_outbox', l); }
  var flushing = false;
  function queue(op) {
    var l = outbox(); l.push({ key: op.key, op: op, at: Date.now(), tries: 0 }); saveOutbox(l);
    emit('queued', op);
    setTimeout(flush, 150);
  }
  function nextId(prefix) {
    var max = 0, see = function (id) { if (id && id.indexOf(prefix) === 0) { var n = parseInt(id.slice(prefix.length), 10); if (n > max) max = n; } };
    (S.data.docs || []).forEach(function (x) { see(x.id); });
    (S.data.vouchers || []).forEach(function (v) { see(v[0]); });
    (S.data.qtyAll || []).forEach(function (q) { see(q[0]); });
    var s = String(max + 1); while (s.length < (prefix === 'SS-' || prefix === 'CS-' ? 3 : 4)) s = '0' + s; return prefix + s;
  }
  var PREFIX = { permit: 'SP-', qty: 'Q-', exp: 'EX-' };
  /* سند الصرف لحد حد المحاسب وسند القبض بيتعتمدوا مع التسجيل (نفس قاعدة السكريبت) */
  function voucherAuto(d) { return d.kind === 'قبض' || Number(d.amount) <= (S.data.settings.voucherLimit || 0); }
  /* تطبيق العملية على البيانات المحلية (في التجربة، أو لحد ما التحديث الجاي يجيب نسخة السيرفر) */
  function applyLocal(op, res) {
    var list = S.data.docs || (S.data.docs = []);
    if (op.action === 'submit') {
      var d = JSON.parse(JSON.stringify(op.doc)), isV = d.type === 'voucher'; d.key = op.key;
      d.id = (res && res.id) || nextId(isV ? (d.kind === 'قبض' ? 'RV-' : 'PV-') : PREFIX[d.type]);
      d.status = isV ? ((res && res.status) || (voucherAuto(d) ? 'معتمد' : 'مسجَّل')) : 'مسجَّل';
      d.at = op.at; d.by = LIVE ? (S.user && S.user.email) || '' : S.role; d.byRole = S.role; d.byName = me().name; d.mine = true;
      d.log = [[op.at, 'سُجّل' + (op.queuedAt ? ' بدون إنترنت' : ''), me().name], [Date.now(), 'وصل للشيت ورُقِّم ' + d.id, '']];
      if (d.type === 'qty' && S.data.qtyAll && !LIVE) {      /* في التجربة: المحضر الجديد يدخل في حساب المستخلصات */
        var b0 = boq(d.boq), cp = b0.price != null ? b0.price * (1 - (project(d.project).discount || 0)) : 0, sub0 = d.exec && d.exec !== 'ذاتي' ? d.exec : '';
        var rt = sub0 ? (S.data.rates || {})[sub0 + '|' + d.boq] || 0 : null;
        S.data.qtyAll.push([d.id, d.date, d.boq, d.qty, cp, d.qty * cp, sub0, rt, sub0 ? d.qty * rt : 0, '', '', 'مسجَّل']);
      }
      if (isV) {
        d.notes = d.desc;
        if (d.status === 'معتمد') { d.decidedBy = me().name; d.decidedAt = Date.now() + 1; d.log.push([d.decidedAt, 'اعتُمد ضمن حد اعتماد المحاسب', me().name]); }
        (S.data.vouchers = S.data.vouchers || []).unshift([d.id, d.kind, d.date, d.party, d.account, d.amount, d.method, d.from, d.ref || '', d.desc, d.status, me().name]);
      }
      list.unshift(d); saveDemo(); return d;
    }
    if (op.action === 'resubmit') {
      var x = byKey(op.target); if (!x) return null;
      for (var k in op.doc) x[k] = op.doc[k];
      x.log = (x.log || []).slice();
      if (x.decidedAt && !x.log.some(function (l) { return /^رُفض/.test(l[1]); })) x.log.push([x.decidedAt, 'رُفض: ' + (x.reason || ''), x.decidedBy || '']);
      x.status = 'مسجَّل'; x.reason = ''; x.note = ''; x.decidedAt = null; x.decidedBy = '';
      x.log.push([Date.now(), 'عُدّل وأُعيد إرساله', me().name]);
      saveDemo(); return x;
    }
    return null;
  }
  function flush() {
    if (flushing) return;
    var l = outbox(); if (!l.length) return;
    if (navigator.onLine === false) { paintNet(); return; }
    if (LIVE && (!CFG.WRITE_URL || !tokenFresh())) return;
    flushing = true;
    var e = l[0];
    var send = LIVE ? prepare(e.op).then(function (op) { return post(CFG.WRITE_URL, { action: op.action, idToken: S.token, op: op }); })
      : new Promise(function (res) { setTimeout(function () { res({ ok: true }); }, 650); });
    send.then(function (r) {
      flushing = false;
      var l2 = outbox(), i = -1; l2.forEach(function (x, j) { if (x.key === e.key) i = j; });
      if (r === null) { if (i >= 0) { l2[i].tries++; saveOutbox(l2); } paintNet(); return; }        /* الشبكة: يفضل في الطابور */
      if (!r.ok && r.error !== 'duplicate') {
        if (i >= 0) { l2[i].err = r.error || 'server'; l2[i].tries++; saveOutbox(l2); }
        toast('السكريبت رفض المستند: ' + (r.message || r.error || '')); render(); return;
      }
      if (i >= 0) l2.splice(i, 1); saveOutbox(l2);
      var d = applyLocal(e.op, r);
      toast(e.op.action === 'resubmit' ? 'وصل التعديل وأُعيد إرسال ' + (d && d.id || '') : d && d.type === 'voucher'
        ? 'وصل للشيت ورُقِّم ' + d.id + (d.status === 'معتمد' ? ' واتعتمد' : '، وبينتظر اعتماد المالك')
        : 'وصل للشيت ورُقِّم ' + (d && d.id || ''));
      render();
      if (LIVE) bootstrap();
      if (l2.length) setTimeout(flush, 300);
    });
  }
  /* قبل الإرسال الحقيقي: الصور من الجهاز بتتبعت مع المستند */
  function prepare(op) {
    var o = JSON.parse(JSON.stringify(op)), keys = ['photo', 'sign'];
    return Promise.all(keys.map(function (k) {
      var ref = o.doc && o.doc[k]; if (!ref || /^(sample:|https?:|drive:)/.test(ref)) return null;     /* الصورة اللي على Drive ما بتترفعش تاني */
      return blob.get(ref).then(function (v) { if (v) o.doc[k + 'Data'] = v; });
    })).then(function () { return o; });
  }
  /* مستندات الطابور بشكل صفوف (لـ«سجلاتي») */
  function pendingDocs() {
    return outbox().filter(function (e) { return e.op.action === 'submit'; }).map(function (e) {
      var d = JSON.parse(JSON.stringify(e.op.doc)); d.key = e.key; d.id = null; d.pending = true; d.at = e.op.at; d.by = S.role; d.mine = true; return d;
    });
  }

  /* ---------- القرارات (اعتماد/رفض) ----------
     في التجربة بتتطبّق على الجهاز. في التشغيل بتتبعت للسكريبت فورًا (محتاجة نت لأنها قرار). */
  function decide(x, kind, extra) {
    var act = { approve: 'approve', reject: 'reject', tech: 'approveTech' }[kind];
    var apply = function (r) {
      var who = me().name, t = Date.now();
      if (kind === 'tech') { x.techOk = true; x.techBy = who; x.techAt = t; x.log = (x.log || []).concat([[t, 'اعتماد فني', who]]); }
      else if (kind === 'approve') {
        x.status = 'معتمد'; x.decidedBy = who; x.decidedAt = t;
        x.log = (x.log || []).concat([[t, 'اعتُمد', who]]);
        var j = journal(x); if (j) x.log.push([t + 1, 'قيد اليومية: ' + j, '']);
      } else {
        x.status = 'مرفوض'; x.reason = extra.reason; x.note = extra.note || ''; x.decidedBy = who; x.decidedAt = t;
        x.log = (x.log || []).concat([[t, 'رُفض: ' + extra.reason, who]]);
      }
      if (!LIVE) {                                      /* في التجربة: حالة المحضر والسند المختصرين تتبع القرار */
        if (x.type === 'qty') (S.data.qtyAll || []).forEach(function (q) { if (q[0] === x.id) q[11] = x.status === 'مرفوض' ? 'ملغى' : x.status; });
        if (x.type === 'voucher') (S.data.vouchers || []).forEach(function (v) { if (v[0] === x.id) v[10] = x.status; });
      }
      saveDemo(); return r;
    };
    if (!LIVE) return Promise.resolve(apply({ ok: true }));
    if (navigator.onLine === false) return Promise.resolve({ ok: false, error: 'offline' });
    return post(CFG.WRITE_URL, { action: act, idToken: S.token, key: x.key, id: x.id, type: x.type, reason: extra && extra.reason, note: extra && extra.note })
      .then(function (r) { if (r && r.ok) { apply(r); bootstrap(); } return r || { ok: false, error: 'offline' }; });
  }
  /* قيد اليومية المتوقع عند الاعتماد (للعرض في سجل المستند) */
  function journal(x) {
    var v = value(x); if (v == null) return '';
    if (x.type === 'permit') return '5100 مدين / 2200 دائن — ' + money(v);
    if (x.type === 'exp') return S.data.settings.postExp ? (x.cat === 'وقود' || x.cat === 'نقل' || x.cat === 'صيانة' ? '5400' : '5500') + ' مدين / 1500 دائن — ' + money(v) : '';   /* مصروفات العهدة لسه مش بتترحّل */
    if (x.type === 'voucher') {                       /* نفس قيد اليومية في الشيت: البنك 1200 والخزينة 1100 */
      var cash = x.from === 'البنك' ? '1200' : '1100';
      return x.kind === 'قبض' ? cash + ' مدين / ' + (x.account || '1300') + ' دائن — ' + money(v) : (x.account || '2100') + ' مدين / ' + cash + ' دائن — ' + money(v);
    }
    return '';
  }
  /* ما ينتظر قرار المستخدم الحالي */
  function inboxDocs() {
    if (!S.data) return [];
    var r = S.role, lim = S.data.settings.voucherLimit || 0;
    return docs(function (x) {
      if (isMine(x)) return false;                     /* لا أحد يعتمد مستندًا أنشأه بنفسه */
      if (x.type === 'stmt') return x.status === 'تحت المراجعة' && ((r === 'eng' && !x.techOk) || ((r === 'owner' || r === 'admin') && x.techOk));
      if (x.status !== 'مسجَّل') return false;
      var byEng = (x.byRole || x.by) === 'eng';           /* محضر سجّله المهندس نفسه بيعتمده المالك أو المدير */
      if (r === 'eng') return x.type === 'qty';
      if (r === 'acc') return x.type === 'permit' || x.type === 'exp' || (x.type === 'voucher' && x.amount <= lim);
      if (r === 'admin') return x.type === 'permit' || x.type === 'exp' || (x.type === 'voucher' && x.amount <= lim) || (x.type === 'qty' && byEng);
      if (r === 'owner') return (x.type === 'voucher' && x.amount > lim) || (x.type === 'qty' && byEng);
      return false;
    }).sort(function (a, b) { return a.at - b.at; });
  }

  /* ---------- الدخول (نفس reno-app: تحويل لجوجل والرجوع برمز الدخول) ---------- */
  function parseJwt(t) { try { var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(decodeURIComponent(escape(atob(p)))); } catch (e) { return null; } }
  function setToken(t) {
    var p = t && parseJwt(t);
    if (!p || p.exp * 1000 < Date.now() + 30000) { S.token = null; S.user = null; try { sessionStorage.removeItem('bdw_idt'); } catch (e) { } return false; }
    S.token = t; S.user = { name: p.given_name || p.name || '', email: p.email || '' };
    try { sessionStorage.setItem('bdw_idt', t); } catch (e) { }
    return true;
  }
  var REDIRECT = location.origin + location.pathname.replace(/[^/]*$/, '');
  function rnd() { var a = new Uint8Array(16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
  function startLogin(silent) {
    var nonce = rnd(), hint = load('bdw_hint');
    store('bdw_nonce', { n: nonce, at: Date.now(), silent: !!silent, back: location.hash });
    location.assign('https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(CFG.CLIENT_ID) +
      '&response_type=id_token&scope=' + encodeURIComponent('openid email profile') + '&redirect_uri=' + encodeURIComponent(REDIRECT) +
      '&nonce=' + nonce + (silent && hint ? '&prompt=none&login_hint=' + encodeURIComponent(hint) : '&prompt=select_account'));
  }
  function finishLogin() {
    var h = location.hash.replace(/^#/, '');
    if (!/(^|&)(id_token|error)=/.test(h)) return false;
    var q = {}; h.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); });
    var st = load('bdw_nonce') || {}; store('bdw_nonce', null);
    history.replaceState(null, '', location.pathname + location.search + (st.back && !/id_token/.test(st.back) ? st.back : '#home'));
    if (q.error) { if (!st.silent) S.loginErr = q.error === 'access_denied' ? 'الدخول اتلغى، أو الحساب ده مش مضاف عند جوجل.' : 'جوجل رفضت طلب الدخول (' + q.error + '). جرّب تاني.'; return true; }
    var p = parseJwt(q.id_token || '');
    if (!p || !st.n || p.nonce !== st.n || Date.now() - st.at > 600000) { S.loginErr = 'طلب الدخول ما اكتملش. جرّب تاني.'; return true; }
    if (setToken(q.id_token)) { store('bdw_hint', S.user.email); S.loginErr = ''; S.fresh = true; }
    return true;
  }
  function signOut() {
    if (outbox().length && !confirm('فيه ' + outbox().length + ' مستند لسه ما اتبعتش. لو خرجت هيفضلوا على الجهاز لحد ما تدخل تاني. تخرج؟')) return;
    try { sessionStorage.removeItem('bdw_idt'); } catch (e) { }
    store('bdw_cache', null); store('bdw_hint', null); store('bdw_nonce', null);
    S.token = null; S.user = null; S.data = null; S.offline = false; S.dataAt = null;
    closeDrawer(); render();
  }
  var ERR = {
    not_allowed: 'الإيميل ده مش في جدول المستخدمين. كلّم مدير المنظومة يضيفه.',
    bad_token: 'جلسة الدخول انتهت. ادخل تاني.', no_token: 'ادخل الأول بحساب جوجل.',
    server: 'حصلت مشكلة في قراءة البيانات. جرّب تاني بعد دقيقة.'
  };
  var OFFLINE_MAX = 3 * 24 * 3600 * 1000, PROBE = 'https://www.gstatic.com/generate_204';
  function usableCache() {
    var c = load('bdw_cache'), h = load('bdw_hint');
    return c && c.data && c.at && h && c.email === h && Date.now() - c.at < OFFLINE_MAX ? c : null;
  }
  function probe() {
    if (navigator.onLine === false) return Promise.resolve(false);
    return new Promise(function (res) {
      var done = false, ac = window.AbortController ? new AbortController() : null;
      function fin(v) { if (done) return; done = true; clearTimeout(t); if (!v && ac) { try { ac.abort(); } catch (e) { } } res(v); }
      var t = setTimeout(function () { fin(false); }, 3000);
      fetch(PROBE, { mode: 'no-cors', cache: 'no-store', signal: ac ? ac.signal : undefined }).then(function () { fin(true); }, function () { fin(false); });
    });
  }
  function goOffline(c) { S.offline = true; S.dataAt = c.at; S.user = { name: (c.data.user && c.data.user.name) || '', email: c.email }; setData(c.data); render(); }
  function tryLogin(silent) {
    return probe().then(function (up) {
      if (up) { if (silent) { try { sessionStorage.setItem('bdw_silent', '1'); } catch (e) { } } return startLogin(silent); }
      if (S.data) { S.offline = true; paintNet(); toast('لسه مفيش اتصال بالنت.'); return; }
      var c = usableCache(); if (c) return goOffline(c);
      S.loginErr = 'مفيش اتصال بالنت. افتح النت وجرّب تاني.'; render();
    });
  }
  function tokenFresh() { var p = S.token && parseJwt(S.token); return !!(p && p.exp * 1000 > Date.now() + 30000); }
  function reconnect() { if (!LIVE) { flush(); return toast(outbox().length ? 'بنبعت اللي في الطابور…' : 'كل حاجة متزامنة.'); } if (tokenFresh()) return bootstrap(true); return tryLogin(true); }
  function post(url, body, ms) {
    var ac = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ac) { try { ac.abort(); } catch (e) { } } }, ms || 30000);
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ac ? ac.signal : undefined })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'server' }; }); }, function () { return null; })
      .then(function (d) { clearTimeout(timer); return d; });
  }
  var loadP = null;
  /* بعد أي قرار أو مستخلص: لو فيه تحميل شغّال نستناه ونحمّل تاني عشان التعديل يبان */
  function refresh() { if (!LIVE) return Promise.resolve(); return S.loading && loadP ? loadP.then(function () { return bootstrap(); }) : bootstrap(); }
  function bootstrap(manual) {
    if (!LIVE) return Promise.resolve();
    if (S.loading) return loadP || Promise.resolve();
    S.loading = true; S.netErr = false; if (!S.data) render();
    return (loadP = post(CFG.API_URL, { action: 'bootstrap', idToken: S.token, project: load('bdw_project') || '' }).then(function (d) {
      S.loading = false;
      if (d === null) { if (S.data) { S.offline = true; paintNet(); if (manual) toast('لسه مفيش اتصال. اللي ظاهر آخر نسخة اتحمّلت.'); } else { S.netErr = true; render(); } return; }
      if (!d.ok) {
        var code = d.error || 'server';
        if (code === 'not_allowed' || code === 'bad_token' || code === 'no_token') {
          setToken(null);
          if (code !== 'not_allowed' && !S.fresh && load('bdw_hint')) return startLogin(true);
          S.loginErr = ERR[code]; store('bdw_cache', null); S.data = null; S.offline = false; render();
        } else if (S.data) { toast(ERR.server); paintNet(); }
        else { S.netErr = true; render(); }
        return;
      }
      S.offline = false; S.dataAt = Date.now();
      if (d.user && d.user.name && S.user) S.user.name = d.user.name;
      setData(d); store('bdw_cache', { at: S.dataAt, email: S.user && S.user.email, data: d }); render(true);
      if (manual) toast('البيانات اتحدّثت.');
      flush(); emit('data');
    }));
  }
  function paintNet() {
    var el = $('.netbar'); if (!el) return;
    var pend = outbox().length, off = navigator.onLine === false || (LIVE && S.offline);
    if (!off && !pend) { el.hidden = true; el.innerHTML = ''; return; }
    el.innerHTML = '<span>' + (off ? 'بتشتغل من غير نت' + (pend ? ' — ' + pend + ' مستند محفوظ على الجهاز وهيتبعت لما النت يرجع' : '') + (LIVE && S.dataAt ? ' · آخر تحديث ' + when(S.dataAt) : '')
      : pend + ' مستند بيتبعت دلوقتي…') + '</span>' + (off ? '' : '<button data-act="sync">إرسال</button>');
    el.hidden = false;
  }

  /* ---------- لوحات الاختيار والتأكيد ---------- */
  var sheetCb = null;
  function openSheet(o) {
    /* o: { title, items: [{v, code, name, sub, end, endCls}], value, search, onPick } */
    var el = $('#sheet');
    sheetCb = o.onPick; S.sheet = o;
    el.className = 'sheet'; el.hidden = false;
    el.innerHTML = '<div class="panel"><div class="ph"><h2>' + esc(o.title) + '</h2><button data-act="sheet-close" aria-label="إغلاق">' + IC.x + '</button></div>' +
      (o.search === false ? '' : '<label class="srch">' + IC.search + '<input id="sheet-q" type="search" autocomplete="off" placeholder="' + esc(o.ph || 'ابحث بالكود أو الاسم') + '"></label>') +
      '<div class="body" id="sheet-list">' + sheetList('') + '</div></div>';
    setTimeout(function () { var q = $('#sheet-q'); if (q && o.items.length > 7) q.focus(); }, 80);
  }
  function sheetList(q) {
    var o = S.sheet; q = (q || '').trim().toLowerCase();
    var list = o.items.filter(function (it) { return !q || (it.code + ' ' + it.name + ' ' + (it.sub || '')).toLowerCase().indexOf(q) >= 0; });
    if (!list.length) return '<div class="empty"><b>مفيش نتيجة</b>جرّب كلمة تانية أو جزء من الكود.</div>';
    return list.map(function (it) {
      return '<button class="opt' + (it.v === o.value ? ' on' : '') + '" data-act="sheet-pick" data-v="' + esc(it.v) + '"><span class="oc ltr">' + esc(it.code || '') + '</span>' +
        '<span class="on2">' + esc(it.name) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' + (it.end ? '<span class="op ' + (it.endCls || '') + '">' + esc(it.end) + '</span>' : '') +
        (it.v === o.value ? IC.check : '') + '</button>';
    }).join('');
  }
  function closeSheet() { var el = $('#sheet'); el.hidden = true; el.innerHTML = ''; sheetCb = null; S.sheet = null; }
  function confirmBox(o) {
    /* o: { title, text, ok, okCls, onOk } */
    var el = $('#sheet'); el.className = 'sheet center'; el.hidden = false; S.sheet = null;
    sheetCb = o.onOk;
    el.innerHTML = '<div class="dlg" role="alertdialog"><h3>' + esc(o.title) + '</h3><p>' + esc(o.text || '') + '</p>' +
      '<div class="acts2"><button class="btn ' + (o.okCls || '') + '" data-act="dlg-ok">' + esc(o.ok || 'تأكيد') + '</button><button class="btn out" data-act="sheet-close">رجوع</button></div></div>';
  }

  /* ---------- الشاشات المشتركة ---------- */
  function greet(top, name) {
    var t = Date.now();
    return '<div class="card greet"><div><div class="g1">' + esc(top) + '</div><div class="g2">' + esc(name) + '</div></div>' +
      '<div class="gd">' + dayName(t) + '<b>' + dateShort(t) + '</b></div></div>';
  }
  function hello() { var h = new Date().getHours(); return h < 12 ? 'صباح الخير' : 'مساء الخير'; }
  function viewSiteHome() {
    var r = S.role, mine = docs(isMine).concat(pendingDocs()), t = today();
    var tdy = mine.filter(function (x) { return iso(x.at) === t; });
    var cnt = function (ty) { return tdy.filter(function (x) { return x.type === ty; }).length; };
    var expAmt = tdy.filter(function (x) { return x.type === 'exp' && x.status !== 'مرفوض'; }).reduce(function (s, x) { return s + (x.amount || 0); }, 0);
    var cus = custody();
    var acts = r === 'eng'
      ? [['new/qty', 'سجّل محضر كميات', 'بند من المقايسة + صورة المحضر', 'ruler', 'navy'], ['inbox', 'صندوق الاعتماد', inboxDocs().length + ' محضر ينتظر اعتمادك الفني', 'inbox', 'green']]
      : [['new/permit', 'سجّل إذن توريد', 'صورة الإذن + توقيع المستلم', 'truck', 'green'], ['new/qty', 'سجّل محضر كميات', 'بند من المقايسة + صورة المحضر', 'ruler', 'navy'],
         ['new/exp', 'سجّل مصروف عهدة', 'المتبقي في عهدتك ' + money(cus.left), 'wallet', 'gold']];
    var recent = mine.sort(function (a, b) {
      var ra = a.pending ? 0 : a.status === 'مرفوض' ? 1 : 2, rb = b.pending ? 0 : b.status === 'مرفوض' ? 1 : 2;
      return ra - rb || b.at - a.at;
    }).slice(0, 5);
    return head({ title: 'الرئيسية', pbar: true }) + '<main class="view">' + strip() + greet(hello(), me().name) +
      '<div class="acts">' + acts.map(function (a) {
        return '<button class="act ' + a[4] + '" data-act="go" data-to="' + a[0] + '"><span class="ai">' + IC[a[3]] + '</span><span><span class="at">' + a[1] + '</span><span class="as">' + esc(a[2]) + '</span></span><span class="cv">' + IC.next + '</span></button>';
      }).join('') + '</div>' +
      '<div class="sect">اليوم</div><div class="minis">' +
      (r === 'eng' ? '<div class="card mini"><b>' + cnt('qty') + '</b><span>محاضر</span></div><div class="card mini"><b>' + inboxDocs().length + '</b><span>تنتظر اعتمادك</span></div>'
        : '<div class="card mini"><b>' + cnt('permit') + '</b><span>إذونات</span></div><div class="card mini"><b>' + cnt('qty') + '</b><span>محاضر</span></div><div class="card mini gold"><b>' + num(expAmt) + '</b><span>مصروفات ج</span></div>') +
      '</div><div class="sect">آخر ما سجّلته<button class="s" data-act="go" data-to="mine">عرض الكل</button></div>' +
      (recent.length ? '<div class="list boxed">' + recent.map(function (x) { return docRow(x); }).join('') + '</div>' : '<div class="card empty"><b>لم تسجّل شيئًا بعد</b>ابدأ من الأزرار في أعلى الشاشة.</div>') +
      '</main>' + nav('home');
  }
  /* المصروف تبع العهدة الحالية (المستندات من غير رقم عهدة لسه في الطابور أو في التجربة) */
  function inCustody(x, c) { return !x.custody || !c || !c.no || String(x.custody) === String(c.no); }
  function custody() {
    var c = (S.data && S.data.custody) || { amount: 0 };
    var spent = docs(function (x) { return x.type === 'exp' && x.status !== 'مرفوض' && x.status !== 'ملغى' && inCustody(x, c); }).reduce(function (s, x) { return s + (x.amount || 0); }, 0);
    spent += pendingDocs().filter(function (x) { return x.type === 'exp'; }).reduce(function (s, x) { return s + (x.amount || 0); }, 0);
    return { no: c.no, amount: c.amount, at: c.at, from: c.from, spent: spent, left: (c.amount || 0) - spent };
  }
  function viewOfficeHome() {
    var r = S.role, k = S.data.kpis || {}, inbox = inboxDocs(), t = today();
    var tdy = docs(function (x) { return iso(x.at) === t; });
    var sum = function (ty) { var l = tdy.filter(function (x) { return x.type === ty; }); return [l.length, l.reduce(function (s, x) { return s + (value(x) || 0); }, 0)]; };
    var P = sum('permit'), Q = sum('qty'), V = sum('voucher');
    var over = tdy.filter(function (x) { return x.type === 'qty' && overrun(x).after > 1; }).length;
    var pr = k.contractNet ? k.executed / k.contractNet : 0;
    return head({ title: 'الرئيسية', pbar: true }) + '<main class="view">' + strip() + greet(hello(), ROLES[r].greet || me().name) +
      '<div class="sect">بانتظار اعتمادك<span class="s">' + inbox.length + '</span></div>' +
      (inbox.length ? '<div class="list boxed" style="border-color:var(--gold-line)">' + inbox.slice(0, 3).map(function (x) { return docRow(x, { noChip: true }); }).join('') +
        (inbox.length > 3 ? '<button class="row" data-act="go" data-to="inbox" style="justify-content:center;color:var(--navy-2);font-weight:800">عرض الكل (' + inbox.length + ')</button>' : '') + '</div>'
        : '<div class="card empty" style="padding:22px"><b>لا شيء ينتظرك</b>كل المستندات اتراجعت.</div>') +
      '<div class="sect">أرقام المشروع</div><div class="kgrid">' +
      '<div class="card kpi"><div class="kl">قيمة العقد</div><div class="kv">' + short(k.contract) + '</div><div class="ks">بعد الخصم ' + short(k.contractNet) + '</div></div>' +
      '<div class="card kpi"><div class="kl">المنفّذ</div><div class="kv">' + short(k.executed) + '</div><div class="ks">بسعر العميل</div></div>' +
      '<div class="card kpi"><div class="kl">مستخلصات العميل</div><div class="kv">' + short(k.clientStmts) + '</div><div class="ks">معتمد</div></div>' +
      '<div class="card kpi"><div class="kl">التكلفة المحققة</div><div class="kv">' + short(k.cost) + '</div><div class="ks">حتى اليوم</div></div></div>' +
      '<div class="card pad" style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:800;color:var(--navy);margin-bottom:6px"><span>نسبة الإنجاز</span><span>' + num(pr * 100, 1) + '%</span></div>' +
      '<div class="prog"><i style="width:' + Math.min(100, pr * 100).toFixed(1) + '%;background:var(--green)"></i></div><div style="font-size:11.5px;color:var(--muted);margin-top:4px">من قيمة العقد بعد الخصم التعاقدي</div></div>' +
      '<div class="sect">حركة اليوم</div><div class="list boxed">' +
      '<div class="row">' + lead('truck', 'green') + '<span class="rm"><span class="rt">التوريدات</span><span class="rs">' + P[0] + ' إذونات</span></span><span class="amt">' + money(P[1]) + '</span></div>' +
      '<div class="row">' + lead('ruler', 'navy') + '<span class="rm"><span class="rt">الكميات</span><span class="rs">' + Q[0] + ' محضر' + (over ? ' — ' + over + ' يتجاوز المقايسة' : '') + '</span></span><span class="amt">' + money(Q[1]) + '</span></div>' +
      '<div class="row">' + lead('money', 'gold') + '<span class="rm"><span class="rt">المصروفات</span><span class="rs">' + V[0] + ' سندات صرف</span></span><span class="amt">' + money(V[1]) + '</span></div></div>' +
      '</main>' + nav('home');
  }
  /* نسبة تنفيذ البند قبل وبعد محضر */
  function overrun(x) {
    var b = boq(x.boq); if (!b.qty) return { before: null, after: null, b: b };
    var others = docs(function (y) { return y.type === 'qty' && y.boq === x.boq && y.key !== x.key && y.status !== 'مرفوض' && y.status !== 'ملغى' && iso(y.at) === today() && y.at < x.at; })
      .reduce(function (s, y) { return s + y.qty; }, 0);
    var before = (b.done || 0) + others;
    return { before: before / b.qty, after: (before + Number(x.qty || 0)) / b.qty, done: before + Number(x.qty || 0), b: b };
  }
  function viewSettings() {
    var ps = S.data.projects || [], st = load('bdw_notify') || { approve: true, daily: S.role === 'owner' };
    return head({ title: 'إعداداتي', back: true, noSync: true }) + '<main class="view">' +
      '<div class="sect" style="margin-top:2px">المشروع الحالي</div><div class="list boxed">' +
      ps.map(function (p) {
        return '<button class="lrow" data-act="project" data-code="' + esc(p.code) + '">' + IC.pin + '<span style="flex:1;min-width:0">' + esc(p.short || p.name) + '<small>' + esc(p.status || '') + ' — ' + esc(p.owner || '') + '</small></span>' +
          (p.code === S.project ? '<span class="e" style="color:var(--green)">' + IC.ok + '</span>' : '') + '</button>';
      }).join('') + (ps.length < 2 ? '<div class="lrow" style="color:var(--faint)">' + IC.folder + '<span>أي مشروع جديد يظهر هنا بمجرد إسناده لك في جدول المستخدمين</span></div>' : '') + '</div>' +
      '<div class="sect">الإشعارات</div><div class="list boxed">' +
      '<button class="lrow" data-act="notify" data-k="approve">' + IC.inbox + '<span>إشعارات الاعتماد<small>عند وصول مستند ينتظرك أو قرار على مستندك</small></span><span class="tgl' + (st.approve ? '' : ' off') + '"></span></button>' +
      '<button class="lrow" data-act="notify" data-k="daily">' + IC.cal + '<span>الملخص اليومي بالبريد<small>كل يوم 9 مساءً</small></span><span class="tgl' + (st.daily ? '' : ' off') + '"></span></button></div>' +
      '<p style="font-size:12px;color:var(--muted);margin:10px 4px;line-height:1.7">الإعدادات دي محفوظة في صفّك في جدول المستخدمين، فبتتبعك على أي جهاز تدخل منه.</p>' +
      '</main>' + nav('prefs');
  }
  function viewAll() {
    var r = S.role;
    return head({ title: 'كل الشاشات', back: true, noSync: true }) + '<main class="view">' +
      '<p style="font-size:12.5px;color:var(--muted);margin:0 4px 10px;line-height:1.7">بنفس أرقام مقترح التصميم. الشاشات اللي عليها «قريبًا» هتتفعّل في مرحلتها.</p>' +
      (window.BDW_PAGES || []).map(function (sec) {
        return '<section class="pg-sec"><h3>' + IC[sec.i] + esc(sec.n) + '</h3><div class="list boxed">' + sec.pages.map(function (pg) {
          var ok = pg.to && (pg.roles === '*' || (pg.roles || '').split(' ').indexOf(r) >= 0);
          return '<button class="pg' + (pg.to ? '' : ' dim') + '" data-act="' + (ok ? 'go' : 'soon') + '" data-to="' + esc(pg.to || '') + '" data-c="' + pg.c + '"><span class="pc ltr">' + pg.c + '</span>' +
            '<span class="pn">' + esc(pg.n) + '<small>' + esc(pg.d) + '</small></span>' +
            (pg.to ? (ok ? IC.next : '<span class="soon">لدور آخر</span>') : '<span class="soon">قريبًا</span>') + '</button>';
        }).join('') + '</div></section>';
      }).join('') + '</main>' + nav('');
  }
  function viewLogin() {
    return '<div class="login"><div class="top"><img src="icons/icon-192.png" alt=""><b>منظومة البديوي</b><small>مؤسسة محمد بديوي للإنشاءات ورصف الطرق</small><div class="lane" style="margin-top:12px"></div></div>' +
      '<div class="box"><h2>سجّل الدخول للمتابعة</h2><p>الدخول بحساب جوجل المسجّل في جدول المستخدمين.</p>' +
      (S.loginErr ? '<div class="login-err">' + esc(S.loginErr) + '</div>' : '') +
      '<button class="btn wide" data-act="login">الدخول بحساب جوجل</button>' +
      '<small style="color:var(--muted);font-size:12px">هتتحوّل لصفحة جوجل وترجع هنا تلقائيًا.</small></div></div>';
  }
  function viewLoading() { return head({ title: 'منظومة البديوي', noSync: true }) + '<main class="view"><div class="skeleton" style="height:64px"></div><div class="skeleton" style="height:150px"></div><div class="skeleton"></div><div class="skeleton"></div></main>'; }
  function viewNetErr() {
    return head({ title: 'منظومة البديوي', noSync: true }) + '<main class="view"><div class="empty"><b>البيانات ما وصلتش</b>اتأكد إن النت شغّال وجرّب تاني.' +
      '<div style="margin-top:16px"><button class="btn" data-act="retry">جرّب تاني</button></div></div></main>';
  }

  /* ---------- التنقل ---------- */
  var R = window.BDW = { S: S, CFG: CFG, LIVE: LIVE, views: {}, acts: {}, inputs: [], changes: [], on: {}, ROLES: ROLES };
  function emit(name, arg) { (R.on[name] || []).forEach(function (f) { try { f(arg); } catch (e) { } }); }
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, '')), p = h.split('/');
    if (p[0] === 'prefs') return { name: 'prefs' };            /* مش «settings»: الاسم ده محجوز في صفحات claude.ai */
    if (p[0] === 'all') return { name: 'all' };
    if (R.views[p[0]]) return { name: p[0], sub: p[1] || '', arg: p.slice(2).join('/'), ext: true };
    return { name: 'home' };
  }
  var current = null;
  function render(keepScroll) {
    var r = route(), y = window.scrollY;
    if (LIVE && !S.token && !(S.offline && S.data)) { current = { name: 'login' }; app.innerHTML = viewLogin(); return; }
    if (!S.data) { current = { name: 'loading' }; app.innerHTML = S.netErr ? viewNetErr() : viewLoading(); return; }
    var same = current && current.name === r.name && current.sub === r.sub && current.arg === r.arg;
    emit('leave', { from: current, to: r });
    current = r;
    app.innerHTML = r.ext ? R.views[r.name](r) : r.name === 'prefs' ? viewSettings() : r.name === 'all' ? viewAll() : (ROLES[S.role].home === 'site' ? viewSiteHome() : viewOfficeHome());
    track(decodeURIComponent(location.hash.replace(/^#\/?/, '')));
    window.scrollTo(0, keepScroll || same ? y : 0);
    fillPhotos(app); paintNet(); emit('render', r);
  }
  function go(h) { if (location.hash === '#' + h) render(); else location.hash = h; }
  /* مسار التنقل جوه التطبيق، وزر الرجوع بيمشي عليه. نسخة العرض بتشتغل جوه إطار، وهناك history.back ممكن يرجّع
     الصفحة اللي حوالين التطبيق، فبنبدّل العنوان بدله. */
  var trail = [];
  function track(k) { var i = trail.lastIndexOf(k); if (i >= 0) trail = trail.slice(0, i + 1); else trail.push(k); }
  function goBack() {
    if (trail.length < 2) return go('');
    if (!CFG.PREVIEW) return history.back();
    trail.pop(); location.replace('#' + trail[trail.length - 1]);
  }
  /* الشاشة دي قبل الحالية في المسار؟ */
  function inTrail(h) { var i = trail.lastIndexOf(h); return i >= 0 && i < trail.length - 1; }
  /* يرجع لشاشة سابقة في المسار (زي صندوق الاعتماد بعد القرار)، ولو مش فيه يحط الشاشة مكان الحالية */
  function backTo(h) {
    var i = trail.lastIndexOf(h);
    if (i >= 0 && i < trail.length - 1 && !CFG.PREVIEW) return history.go(i - (trail.length - 1));
    if (i >= 0) trail = trail.slice(0, i + 1); else trail.pop();
    location.replace('#' + h);
  }

  /* ---------- القائمة الجانبية ---------- */
  function openDrawer() {
    var d = $('#drawer'), u = me(), r = S.role, pend = outbox().length;
    var items = [['home', 'الرئيسية', 'home']];
    ROLES[r].nav.slice(1).concat(ROLES[r].more || []).forEach(function (t) { if (t[0].indexOf('soon') !== 0 && t[0] !== 'prefs') items.push(t); });
    if (r === 'acc' || r === 'admin' || r === 'owner') items.push(['custody', 'العهد', 'wallet']);
    d.innerHTML = '<div class="dr-head">' + IC.mark + '<div><b>منظومة البديوي</b><small>' + esc(u.name) + (u.email ? ' — ' + esc(u.email) : '') + '</small></div></div>' +
      '<div style="padding:8px 0">' + items.map(function (t) { return '<button class="dr-item" data-act="nav" data-to="' + t[0] + '">' + IC[t[2]] + '<span>' + t[1] + '</span></button>'; }).join('') +
      '<button class="dr-item" data-act="nav" data-to="all">' + IC.grid + '<span>كل الشاشات<small>بأرقام مقترح التصميم</small></span></button>' +
      '<div class="dr-sep"></div>' +
      '<button class="dr-item" data-act="sync">' + IC.sync + '<span>مزامنة<small>' + (pend ? pend + ' مستند في الطابور' : LIVE && S.dataAt ? 'آخر تحديث ' + when(S.dataAt) : 'كل حاجة متزامنة') + '</small></span></button>' +
      '<button class="dr-item" data-act="nav" data-to="prefs">' + IC.sliders + '<span>إعداداتي<small>المشروع الحالي والإشعارات</small></span></button>' +
      (CFG.PREVIEW ? '' : '<button class="dr-item" data-act="install">' + IC.download + '<span>تثبيت التطبيق على الموبايل</span></button>') +
      (LIVE ? '<button class="dr-item" data-act="signout">' + IC.out + '<span>تسجيل الخروج</span></button>' : '') +
      (LIVE ? '' : '<div class="dr-sep"></div><div class="dr-lab">تجربة الأدوار (بيانات العيّنة)</div><div class="roles">' +
        ['site', 'eng', 'acc', 'owner'].map(function (k) { return '<button class="' + (k === r ? 'on' : '') + '" data-act="role" data-r="' + k + '">' + ROLES[k].n + '</button>'; }).join('') +
        '</div><button class="dr-item" data-act="reset-demo">' + IC.undo + '<span>إرجاع بيانات العيّنة لأصلها</span></button>') +
      '</div><div class="dr-meta">نسخة <span class="ltr">' + esc(CFG.BUILD || '') + '</span> — تصميم وتطوير Egypt Smart Solution</div>';
    d.hidden = false; $('#drawer-scrim').hidden = false;
  }
  function closeDrawer() { $('#drawer').hidden = true; $('#drawer-scrim').hidden = true; }
  function install() {
    closeDrawer();
    if (S.installEvt) { S.installEvt.prompt(); S.installEvt = null; return; }
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return toast('التطبيق متثبّت فعلًا على الجهاز ده.');
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return toast('من زر المشاركة في Safari اختار «إضافة إلى الشاشة الرئيسية».');
    toast('من قائمة المتصفح (⋮) اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».');
  }
  function soon(code) {
    var pg = null; (window.BDW_PAGES || []).forEach(function (s) { s.pages.forEach(function (p) { if (p.c === code) pg = p; }); });
    toast(pg ? 'الشاشة ' + code + ' «' + pg.n + '» هتتفعّل في مرحلتها.' : 'الشاشة دي هتتفعّل في مرحلتها.');
  }

  /* ---------- الأحداث ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.id === 'drawer-scrim') return closeDrawer();
    if (e.target.id === 'sheet') return closeSheet();
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'menu') return openDrawer();
    if (a === 'login') { b.disabled = true; b.textContent = 'بنحوّلك لجوجل…'; return tryLogin(false); }
    if (a === 'retry') { b.disabled = true; return reconnect(); }
    if (a === 'back') return goBack();
    if (a === 'sync') { closeDrawer(); return reconnect(); }
    if (a === 'tab' || a === 'go' || a === 'nav') {
      var to = b.getAttribute('data-to'); closeDrawer();
      if (to.indexOf('soon:') === 0) return soon(to.slice(5));
      return go(to);
    }
    if (a === 'soon') return soon(b.getAttribute('data-c'));
    if (a === 'doc') return go('doc/' + encodeURIComponent(b.getAttribute('data-key')));
    if (a === 'sheet-close') return closeSheet();
    if (a === 'sheet-pick') { var cb = sheetCb, v = b.getAttribute('data-v'); closeSheet(); if (cb) cb(v); return; }
    if (a === 'dlg-ok') { var ok = sheetCb; closeSheet(); if (ok) ok(); return; }
    if (a === 'install') return install();
    if (a === 'signout') return signOut();
    if (a === 'role') { S.role = b.getAttribute('data-r'); store('bdw_role', S.role); closeDrawer(); toast('بتجرّب التطبيق دلوقتي كـ' + ROLES[S.role].n); return go('home'); }
    if (a === 'reset-demo') { store('bdw_demo_docs', null); store('bdw_demo_x', null); saveOutbox([]); S.data = null; closeDrawer(); setData(JSON.parse(JSON.stringify(window.BDW_SAMPLE))); toast('رجعت بيانات العيّنة لأصلها.'); return go('home'); }
    if (a === 'project') { S.project = b.getAttribute('data-code'); store('bdw_project', S.project); if (LIVE) bootstrap(); return render(true); }
    if (a === 'notify') { var st = load('bdw_notify') || { approve: true, daily: S.role === 'owner' }, k = b.getAttribute('data-k'); st[k] = !st[k]; store('bdw_notify', st); return render(true); }
    if (R.acts[a]) return R.acts[a](b, e);
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'sheet-q') { $('#sheet-list').innerHTML = sheetList(e.target.value); return; }
    for (var i = 0; i < R.inputs.length; i++) if (R.inputs[i](e)) return;
  });
  document.addEventListener('change', function (e) { for (var i = 0; i < R.changes.length; i++) if (R.changes[i](e)) return; });
  document.addEventListener('keydown', function (e) {           /* Esc يقفل اللوحة أو القائمة المفتوحة */
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) return closeSheet();
    if (!$('#drawer').hidden) closeDrawer();
  });
  window.addEventListener('hashchange', function () { closeSheet(); render(); });
  window.addEventListener('offline', function () { if (LIVE && S.data) S.offline = true; paintNet(); });
  window.addEventListener('online', function () { emit('online'); if (LIVE && S.offline && tokenFresh()) bootstrap(); flush(); paintNet(); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.installEvt = e; });

  /* ---------- اللي باقي الملفات بتستخدمه ---------- */
  var X = {
    esc: esc, num: num, money: money, short: short, iso: iso, today: today, hm: hm, when: when, ago: ago, dateLong: dateLong, dateShort: dateShort, dayName: dayName,
    uid: uid, store: store, load: load, toast: toast, km: km, me: me, role: role, project: project, party: party, item: item, boq: boq, docs: docs, byKey: byKey,
    isMine: isMine, value: value, title: title, sub: sub, journal: journal, chip: chip, lead: lead, gh: gh, docRow: docRow, head: head, nav: nav, strip: strip,
    go: go, back: goBack, backTo: backTo, render: render, IC: IC, inCustody: inCustody, blob: blob, docArt: docArt, photoHtml: photoHtml, fillPhotos: fillPhotos, queue: queue, outbox: outbox, pendingDocs: pendingDocs,
    decide: decide, inboxDocs: inboxDocs, openSheet: openSheet, closeSheet: closeSheet, confirmBox: confirmBox, custody: custody, overrun: overrun, post: post,
    TYPE: TYPE, ICON: ICON, emit: emit, tokenFresh: tokenFresh,
    typeName: typeName, account: account, refresh: refresh, saveDemo: saveDemo, inTrail: inTrail, nextId: nextId, voucherAuto: voucherAuto, toneOf: toneOf
  };
  for (var k in X) R[k] = X[k];
  (window.BDW_EXT || []).forEach(function (f) { f(R); });

  /* ---------- التشغيل ---------- */
  /* نسخة العرض (PREVIEW) ما بتسجّلش عامل خدمة، عشان أي تحديث للعرض يوصل فورًا من غير نسخ محفوظة */
  if ('serviceWorker' in navigator && !CFG.PREVIEW && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    try { navigator.serviceWorker.register('sw.js').catch(function () { }); } catch (e) { }
  }
  if (!LIVE) {
    var rl = load('bdw_role'); if (rl && ROLES[rl]) S.role = rl;
    setData(JSON.parse(JSON.stringify(window.BDW_SAMPLE))); render(); setTimeout(flush, 400);
  } else {
    var came = finishLogin(), savedT = null;
    if (!S.token) { try { savedT = sessionStorage.getItem('bdw_idt'); } catch (e) { } if (savedT) setToken(savedT); }
    if (S.token) {
      var c = load('bdw_cache'); if (c && c.data && c.email === S.user.email) { S.dataAt = c.at || null; setData(c.data); }
      render(); bootstrap();
    } else {
      var tried = null; try { tried = sessionStorage.getItem('bdw_silent'); } catch (e) { }
      var oc = came ? null : usableCache();
      if (!came && !tried && load('bdw_hint')) tryLogin(true);
      else if (oc && navigator.onLine === false) goOffline(oc);
      else render();
    }
  }
})();
