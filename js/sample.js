/* بيانات عيّنة للتجربة قبل تفعيل الدخول. كل الأسماء والأرقام هنا وهمية: المستودع عام،
   والبيانات الحقيقية مكانها الشيت بس، والتطبيق بيقراها بعد الدخول بحساب جوجل.
   التواريخ نسبية لليوم عشان التجربة تبان حيّة في أي يوم. */
window.BDW_SAMPLE = (function () {
  function at(back, h, m) {
    var t = new Date(); t.setDate(t.getDate() - back); t.setHours(h || 9, m || 0, 0, 0);
    return t.getTime();
  }
  /* مستندات النهارده: من كام دقيقة. قبل الفجر بتنضغط عشان تفضل كلها النهارده وفي الماضي */
  function ago(min) {
    var now = Date.now(), t0 = new Date(); t0.setHours(0, 0, 0, 0);
    var k = Math.min(1, ((now - t0.getTime()) * 0.9) / (270 * 6e4));
    return Math.round(now - min * 6e4 * k);
  }
  function day(back) { var t = new Date(at(back)), p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()); }
  var SITE = { by: 'site', byName: 'محاسب الموقع' }, ENG = { by: 'eng', byName: 'مهندس الموقع' }, ACC = { by: 'acc', byName: 'محاسب المشروع' };
  function doc(o, who) { for (var k in who) o[k] = who[k]; o.project = o.project || 'P-001'; o.log = o.log || []; return o; }

  return {
    demo: true,
    settings: { voucherLimit: 50000, priceWarnPct: 0.05, lateDays: 3, siteRadiusKm: 2 },
    projects: [
      { code: 'P-001', name: 'مشروع تجريبي — شبكات المرافق لمنطقة سكنية جديدة', short: 'مشروع تجريبي — شبكات مرافق',
        owner: 'جهة مالكة (عيّنة)', value: 150000000, discount: 0.25, status: 'جارٍ', lat: 30.0719, lng: 31.6437 }
    ],
    parties: [
      ['V-001', 'مصنع الريادة — خرسانة جاهزة', 'مورد'],
      ['V-002', 'شركة الفتح لتوريد المواسير', 'مورد'],
      ['V-003', 'مؤسسة الصفا لمواسير UPVC', 'مورد'],
      ['S-001', 'سامح فؤاد', 'مقاول باطن'],
      ['S-002', 'خالد منصور', 'مقاول باطن'],
      ['S-003', 'عادل رشدي', 'مقاول باطن'],
      ['S-005', 'حسن الشافعي', 'مقاول باطن'],
      ['S-006', 'الحاج فتحي — نقل عربيات', 'مقاول باطن'],
      ['S-007', 'رضا سليمان', 'مقاول باطن'],
      ['C-001', 'جهة مالكة (عيّنة)', 'عميل']
    ],
    balances: { 'V-001': -850000, 'V-002': 1240000, 'S-001': -96500, 'S-002': -142300, 'S-003': 88400, 'S-005': 152000, 'S-006': -215700, 'S-007': 23000, 'C-001': 9850000 },
    items: [
      ['I-C01', 'خرسانة جاهزة', 'م3'],
      ['I-C02', 'خرسانة جاهزة 250 S.R.C', 'م3'],
      ['I-C03', 'خرسانة جاهزة 400 S.R.C', 'م3'],
      ['I-007', 'خرسانة مسلحة', 'م3'],
      ['I-P01', 'مواسير صرف (فئة أ)', 'م.ط'],
      ['I-P02', 'مواسير صرف (فئة ب)', 'م.ط'],
      ['I-P03', 'مواسير صرف (فئة ج)', 'م.ط'],
      ['I-P04', 'مواسير صرف (فئة د)', 'م.ط'],
      ['I-W05', 'مواسير UPVC PN10 قطر 315 مم', 'م.ط'],
      ['I-P05', 'مواسير صرف UPVC', 'م.ط']
    ],
    supplies: { 'V-001': ['I-C02', 'I-C01', 'I-C03', 'I-007'], 'V-002': ['I-P04', 'I-P02', 'I-P03', 'I-P01', 'I-W05'], 'V-003': ['I-P05'] },
    lastPrice: { 'V-001|I-C01': 1950, 'V-001|I-C02': 1950, 'V-001|I-C03': 2380, 'V-002|I-P01': 2150, 'V-002|I-P02': 410, 'V-002|I-P03': 128, 'V-002|I-P04': 276, 'V-003|I-P05': 395 },
    /* بنود المقايسة: الكود، الاسم، الوحدة، الكمية المعتمدة، سعر الجهاز، المنفّذ قبل اليوم (توضيحي) */
    boq: [
      ['I-R01', 'إزالة ونقل المخلفات والأتربة', 'م3', 18000, 95, 12400],
      ['I-R02', 'حفر في التربة غير الصخرية لتكوين جسم الطريق', 'م3', 95000, 85, 36000],
      ['I-R04', 'ردم من ناتج الحفر على طبقات 25 سم', 'م3', 85000, 45, 30500],
      ['I-R05', 'ردم بأتربة موردة من خارج الموقع', 'م3', 42000, 140, 5200],
      ['I-R06', 'طبقة إحلال للمناطق غير الصالحة للتأسيس', 'م3', 9000, 270, 11200],
      ['I-W01', 'مواسير UPVC PN10 قطر 110 مم', 'م.ط', 15000, 450, 8100],
      ['I-W02', 'مواسير UPVC PN10 قطر 160 مم', 'م.ط', 6000, 720, 1800],
      ['I-W21', 'وصلة مياه منزلية مزدوجة 63/50 مم', 'عدد', 520, 10500, 150],
      ['I-S02', 'UPVC SN8 قطر 200 مم — عمق 1.50–2.50 م', 'م.ط', 13500, 820, 5200],
      ['I-S17', 'مطبق دائري 1.20 م — عمق 1.51–2.50 م', 'عدد', 480, 18000, 105]
    ],
    /* بنود عقود الباطن غير الموجودة في المقايسة */
    subItems: [
      ['I-B01', 'تركيب واختبار مواسير صرف UPVC قطر خارجي 250', 'م.ط'],
      ['I-B02', 'تركيب واختبار مواسير صرف UPVC قطر خارجي 280', 'م.ط']
    ],
    rates: { 'S-001|I-B01': 65, 'S-001|I-B02': 65, 'S-005|I-R06': 55, 'S-005|I-W01': 32, 'S-007|I-W01': 32, 'S-001|I-S02': 65 },
    custody: { no: 1, amount: 20000, at: at(9, 10, 0), from: 'الخزينة', holder: 'site' },
    kpis: { contract: 150000000, contractNet: 112500000, executed: 12400000, clientStmts: 11200000, cost: 70500000, received: null, subWorks: 6300000, subPaid: 8100000 },
    docs: [
      /* إذونات التوريد */
      doc({ key: 's-200', type: 'permit', id: 'SP-0200', date: day(0), at: ago(40), status: 'مسجَّل', party: 'V-001', item: 'I-C02', qty: 8, price: 1950, paperNo: '4475', photo: 'sample:2', sign: 'sample', loc: { lat: 30.0731, lng: 31.6451, dist: 0.2 } }, SITE),
      doc({ key: 's-199', type: 'permit', id: 'SP-0199', date: day(0), at: ago(148), status: 'مسجَّل', party: 'V-001', item: 'I-C02', qty: 16, price: 2120, paperNo: '4471', notes: 'تفريغ صباحي — عربية 16 م3', photo: 'sample:1', sign: 'sample', loc: { lat: 30.0752, lng: 31.6475, dist: 0.4 } }, SITE),
      doc({ key: 's-198', type: 'permit', id: 'SP-0198', date: day(0), at: ago(262), status: 'مسجَّل', party: 'V-003', item: 'I-P05', qty: 120, price: 395, paperNo: '1182', photo: 'sample:5', sign: 'sample', loc: { lat: 30.0701, lng: 31.6420, dist: 0.3 } }, SITE),
      doc({ key: 's-197', type: 'permit', id: 'SP-0197', date: day(1), at: at(1, 9, 15), status: 'مرفوض', party: 'V-002', item: 'I-P04', qty: 480, price: 296, paperNo: '7720', photo: 'sample:3', sign: 'sample', loc: { lat: 30.0740, lng: 31.6430, dist: 0.3 },
        reason: 'السعر غير مطابق', note: 'فئة هذا الصنف في عرض المورد 276 ج للمتر، والمكتوب 296', decidedBy: 'محاسب المشروع', decidedAt: ago(201) }, SITE),
      doc({ key: 's-196', type: 'permit', id: 'SP-0196', date: day(4), at: at(4, 14, 5), status: 'مسجَّل', party: 'V-003', item: 'I-P05', qty: 500, price: 395, paperNo: '1160', photo: 'sample:4', sign: 'sample', loc: { lat: 30.0710, lng: 31.6440, dist: 0.2 } }, SITE),
      doc({ key: 's-194', type: 'permit', id: 'SP-0194', date: day(35), at: at(35, 13, 0), status: 'معتمد', party: 'V-001', item: 'I-007', qty: 150, price: null, photo: 'sample:0', decidedBy: 'محاسب المشروع', decidedAt: at(35, 15, 0) }, SITE),
      /* محاضر الكميات */
      doc({ key: 'q-097', type: 'qty', id: 'Q-0097', date: day(0), at: ago(178), status: 'مسجَّل', boq: 'I-R06', qty: 500, kind: 'حالية', exec: 'ذاتي', photo: 'sample:6', loc: { lat: 30.0725, lng: 31.6444, dist: 0.1 } }, ENG),
      doc({ key: 'q-098', type: 'qty', id: 'Q-0098', date: day(0), at: ago(90), status: 'مسجَّل', boq: 'I-S02', qty: 340, kind: 'حالية', exec: 'S-001', photo: 'sample:7', loc: { lat: 30.0738, lng: 31.6462, dist: 0.3 } }, SITE),
      doc({ key: 'q-096', type: 'qty', id: 'Q-0096', date: day(6), at: at(6, 13, 10), status: 'معتمد', boq: 'I-W01', qty: 1200, kind: 'حالية', exec: 'S-007', photo: 'sample:6', decidedBy: 'مهندس الموقع', decidedAt: at(5, 9, 0) }, SITE),
      /* مصروفات العهدة */
      doc({ key: 'e-014', type: 'exp', id: 'EX-0014', date: day(0), at: ago(225), status: 'مسجَّل', cat: 'وقود', desc: 'سولار لودر L-01 — 120 لتر', amount: 2500, photo: 'sample:8' }, SITE),
      doc({ key: 'e-013', type: 'exp', id: 'EX-0013', date: day(1), at: at(1, 19, 0), status: 'معتمد', cat: 'إعاشة', desc: 'وجبات عمال الوردية', amount: 850, photo: 'sample:8', decidedBy: 'محاسب المشروع', decidedAt: ago(240) }, SITE),
      doc({ key: 'e-012', type: 'exp', id: 'EX-0012', date: day(5), at: at(5, 12, 0), status: 'معتمد', cat: 'نقل', desc: 'نقل مواسير بجرار', amount: 1200, photo: 'sample:8', decidedBy: 'محاسب المشروع', decidedAt: at(4, 10, 0) }, SITE),
      doc({ key: 'e-011', type: 'exp', id: 'EX-0011', date: day(6), at: at(6, 16, 0), status: 'مرفوض', cat: 'أدوات', desc: 'أدوات تشطيب', amount: 400, photo: 'sample:8', reason: 'صورة غير واضحة', note: 'الإيصال غير مقروء؛ صوّره من قريب', decidedBy: 'محاسب المشروع', decidedAt: at(5, 9, 30) }, SITE),
      doc({ key: 'e-010', type: 'exp', id: 'EX-0010', date: day(7), at: at(7, 11, 0), status: 'معتمد', cat: 'وقود', desc: 'سولار حفار J-02', amount: 3000, photo: 'sample:8' }, SITE),
      doc({ key: 'e-009', type: 'exp', id: 'EX-0009', date: day(7), at: at(7, 15, 0), status: 'معتمد', cat: 'صيانة', desc: 'صيانة هيدروليك حفار', amount: 2400, photo: 'sample:8' }, SITE),
      doc({ key: 'e-008', type: 'exp', id: 'EX-0008', date: day(8), at: at(8, 13, 0), status: 'معتمد', cat: 'إعاشة', desc: 'مياه وثلج للموقع', amount: 650, photo: 'sample:8' }, SITE),
      doc({ key: 'e-007', type: 'exp', id: 'EX-0007', date: day(8), at: at(8, 17, 0), status: 'معتمد', cat: 'نقل', desc: 'نقل عمالة', amount: 1450, photo: 'sample:8' }, SITE),
      doc({ key: 'e-006', type: 'exp', id: 'EX-0006', date: day(9), at: at(9, 12, 0), status: 'معتمد', cat: 'أدوات', desc: 'شرائط تحذيرية وأقماع', amount: 1400, photo: 'sample:8' }, SITE),
      /* للمكتب والمالك */
      doc({ key: 'v-296', type: 'voucher', id: 'PV-0296', date: day(0), at: ago(54), status: 'مسجَّل', party: 'S-001', amount: 75000, method: 'تحويل', from: 'البنك', account: '2100', notes: 'دفعة تحت الحساب' }, ACC),
      doc({ key: 'ss-007', type: 'stmt', id: 'SS-007', date: day(3), at: at(2, 11, 0), status: 'تحت المراجعة', party: 'S-007', gross: 385000, net: 385000, paid: 360000, techOk: true, techBy: 'مهندس الموقع', techAt: at(2, 13, 0) }, ACC)
    ]
  };
})();
