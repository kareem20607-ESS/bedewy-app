// سيرفر محلي بيشغّل سكريبت الربط على الأوراق الوهمية، عشان التطبيق يتختبر وهو «متوصّل» بجد.
const http = require('http');
const { makeEnv } = require('./mock');
const { build } = require('./fixture');
const CLIENT = '760770227194-t2r0kna5g34igsarqfmf8psm8418ejlr.apps.googleusercontent.com';
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const exp = Math.floor(Date.now() / 1000) + 3 * 3600;
const people = { site: ['site@test.dev', 'سعيد'], acc: ['acc@test.dev', 'عادل'], eng: ['eng@test.dev', 'هاني'], owner: ['owner@test.dev', 'الحاج'] };
const tokens = {}, jwt = {};
Object.keys(people).forEach(k => {
  const [email, name] = people[k];
  const claims = { aud: CLIENT, iss: 'https://accounts.google.com', email, email_verified: 'true', exp, name, given_name: name };
  const t = b64u({ alg: 'RS256' }) + '.' + b64u(claims) + '.sig'; tokens[t] = claims; jwt[k] = t;
});

const ss = build();
const env = makeEnv(ss, { script: process.argv[2] || require('path').join(__dirname, '../../apps-script/Bedewy_API.gs'), tokens, owner: 'kareem@test.dev' });
env.ctx.setupApi();
const users = ss.getSheetByName('المستخدمين');
[['site@test.dev', 'سعيد الموقع', 'محاسب الموقع', 'P-001', 'نعم'], ['eng@test.dev', 'هاني المهندس', 'مهندس الموقع', 'الكل', 'نعم'],
 ['acc@test.dev', 'عادل المحاسب', 'محاسب المشروع', 'الكل', 'نعم'], ['owner@test.dev', 'الحاج', 'المالك', 'الكل', 'نعم']].forEach((u, i) => users.getRange(5 + i, 1, 1, 5).setValues([u]));
const set = ss.getSheetByName('إعدادات التطبيق');
for (let r = 4; r <= set.getLastRow(); r++) if (set.get(r, 1) === 'موقع المشروع P-001') set.put(r, 2, '30.0719, 31.6437');
ss.getSheetByName('العهد').getRange(4, 1, 1, 8).setValues([['CU-001', 'P-001', 'site@test.dev', 20000, new Date(Date.now() - 5 * 864e5), 'الخزينة', 'مفتوحة', '']]);

http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.url === '/tokens') { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); return res.end(JSON.stringify(jwt)); }
  if (req.url === '/sheet') {      /* لقطة من الأوراق للاختبار */
    const pick = n => ss.getSheetByName(n).rows.slice(3).map(r => r.map(v => v instanceof Date ? v.toISOString() : v));
    res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
    return res.end(JSON.stringify({ permits: pick('إذونات التوريد'), exp: pick('مصروفات العهدة'), log: pick('سجل التطبيق'), stmts: pick('المستخلصات'), qty: pick('الكميات المنفذة'), vouchers: pick('السندات'), users: pick('المستخدمين') }));
  }
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    let out;
    try { out = JSON.stringify(env.call(JSON.parse(body || '{}'))); } catch (e) { out = JSON.stringify({ ok: false, error: 'server', message: String(e) }); }
    setTimeout(() => { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); res.end(out); }, 120);
  });
}).listen(8790, '127.0.0.1', () => console.log('api on 8790'));
