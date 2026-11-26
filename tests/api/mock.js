// محاكاة لخدمات Apps Script اللي السكريبت بيستخدمها، عشان نختبره محليًا بأوراق وهمية.
const vm = require('vm');
const fs = require('fs');
const crypto = require('crypto');

const TZ = 'Africa/Cairo';
function tzParts(date, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const o = {}; f.formatToParts(date).forEach(p => { o[p.type] = p.value; });
  return o;
}
function offsetMin(date, tz) { const p = tzParts(date, tz); const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second); return (asUtc - date.getTime()) / 60000; }
function localMidnight(y, m, d, tz) { let g = Date.UTC(y, m - 1, d); for (let i = 0; i < 2; i++) g = Date.UTC(y, m - 1, d) - offsetMin(new Date(g), tz) * 60000; return new Date(g); }

class Range {
  constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); out.push(row); } return out; }
  getValue() { return this.sh.get(this.r, this.c); }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.put(this.r + i, this.c + j, x))); return this; }
  setValue(x) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.put(this.r + i, this.c + j, x); return this; }
  setDataValidation(rule) { for (let j = 0; j < this.nc; j++) this.sh.validators[this.c + j] = rule.values; return this; }
}
['setFontWeight', 'setFontSize', 'setFontColor', 'setBackground', 'setHorizontalAlignment', 'setWrap', 'setNumberFormat'].forEach(m => { Range.prototype[m] = function () { return this; }; });

class Sheet {
  constructor(name, rows, validators) { this.name = name; this.rows = rows || []; this.validators = validators || {}; this.writes = []; }
  get(r, c) { const row = this.rows[r - 1]; const v = row ? row[c - 1] : undefined; return v === undefined || v === null ? '' : v; }
  put(r, c, v) {
    const allowed = this.validators[c];
    if (allowed && r >= 4 && v !== '' && allowed.indexOf(v) < 0) throw new Error('The data you entered in cell ' + this.name + ' R' + r + 'C' + c + ' violates the data validation rules: ' + v);
    while (this.rows.length < r) this.rows.push([]);
    this.rows[r - 1][c - 1] = v; this.writes.push([r, c, v]);
  }
  getLastRow() { for (let i = this.rows.length - 1; i >= 0; i--) if ((this.rows[i] || []).some(x => x !== '' && x !== undefined && x !== null)) return i + 1; return 0; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getName() { return this.name; }
  setRightToLeft() { return this; } setFrozenRows() { return this; } setColumnWidth() { return this; }
  protect() { const o = { setDescription() { return o; }, setWarningOnly() { return o; } }; return o; }
}
class Spreadsheet {
  constructor(sheets) { this.sheets = sheets; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n, []); this.sheets.push(s); return s; }
  getNumSheets() { return this.sheets.length; }
  getId() { return 'SS-TEST-ID'; }
  getSpreadsheetTimeZone() { return TZ; }
}

function makeEnv(ss, opts) {
  opts = opts || {};
  const props = {}, cache = {}, mails = [], files = {}, folders = {};
  let fileSeq = 0;
  const mkFile = (blob) => { const id = 'FILE' + String(++fileSeq).padStart(24, 'x'); files[id] = { id, blob, name: blob.name }; return id; };
  const fileApi = (id) => {
    if (id === 'SS-TEST-ID' && !files[id]) files[id] = { id, blob: { bytes: [], mime: 'application/vnd.google-apps.spreadsheet' }, name: 'ملف البيانات' };
    const f = files[id]; if (!f) throw new Error('No item with the given ID could be found');
    return { getId: () => id, getName: () => f.name, setName: (n) => { f.name = n; }, getMimeType: () => f.blob.mime, getSize: () => f.blob.bytes.length,
      getBlob: () => ({ getBytes: () => f.blob.bytes, getContentType: () => f.blob.mime }), getThumbnail: () => null,
      getParents: () => { let done = false; return { hasNext: () => !done, next: () => { done = true; return folderApi('PARENT0000000000000000000'); } }; } };
  };
  const folderApi = (id) => { folders[id] = folders[id] || { id }; return { getId: () => id, createFile: (blob) => fileApi(mkFile(blob)), moveTo: () => {} }; };
  const tokens = opts.tokens || {};
  const ctx = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss, openById: () => ss,
      newDataValidation: () => { const b = { values: null, requireValueInList(v) { b.values = v; return b; }, setAllowInvalid() { return b; }, build() { return { values: b.values }; } }; return b; },
      getUi: () => { throw new Error('no ui in tests'); }
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    UrlFetchApp: {
      fetch: (url) => {
        const m = /tokeninfo\?id_token=([^&]+)/.exec(url);
        if (m) { const t = tokens[decodeURIComponent(m[1])]; return { getResponseCode: () => (t ? 200 : 400), getContentText: () => JSON.stringify(t || { error: 'invalid_token' }) }; }
        return { getResponseCode: () => 404, getBlob: () => null };
      }
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => Array.from(crypto.createHash('sha256').update(String(s)).digest()),
      base64EncodeWebSafe: (b) => Buffer.from(b.map ? b.map(x => (x + 256) % 256) : b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Encode: (b) => Buffer.from(b).toString('base64'),
      base64Decode: (s) => Array.from(Buffer.from(s, 'base64')),
      newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
      formatDate: (d, tz, fmt) => {
        const p = tzParts(d, tz || TZ);
        return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
      },
      parseDate: (s, tz) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (!m) throw new Error('Unparseable date'); return localMidnight(+m[1], +m[2], +m[3], tz || TZ); }
    },
    DriveApp: {
      getFolderById: (id) => folderApi(id), getFileById: (id) => fileApi(id),
      createFolder: () => folderApi('FOLDER00000000000000000000'), getRootFolder: () => folderApi('ROOT000000000000000000000')
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s }) },
    Session: { getScriptTimeZone: () => TZ, getEffectiveUser: () => ({ getEmail: () => opts.owner || 'kareem@test.dev' }) },
    MailApp: { sendEmail: (o) => { mails.push(o); } },
    ScriptApp: { getOAuthToken: () => 'oauth-test' }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(opts.script, 'utf8'), ctx, { filename: 'Bedewy_API.gs' });
  return { ctx, props, cache, mails, files, call: (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()) };
}

module.exports = { Sheet, Spreadsheet, makeEnv, localMidnight, TZ, tzParts };
