/* Realynx Relay · Field Kit — iPhone web app.
 * Everything is saved on the phone first (IndexedDB) and sent to the Realynx Apps Script when there is signal.
 * No build step: plain JavaScript, one file. */
'use strict';
const VERSION = '1.1.0';
const APP = document.getElementById('app');

// ============================================================ constants
const LANGS = [['yue', '粵語'], ['cmn', '普通話'], ['mixed', '混合']];
const REMARKS = [
  ['case', '突發問題', 'Sudden problem on the press'], ['demo', '師傅示範', 'Expert demonstrates'],
  ['exception', '重要例外', 'Key exception / warning'], ['measure', '量度數據', 'Measurement (pH, viscosity…)'],
  ['ask', '之後追問', 'Ask about this later'], ['join', '有人加入', 'Someone joins / interrupts'],
  ['pause', '暫停／離開', 'Paused / off the record'], ['other', '其他', 'Other']
];
const SUGGEST = ['起泡', '針孔', '色差', '糊版', '黏背', '乾燥', '甩色', '網紋輥', '黏度', 'pH'];
const DEFECTS = ['針孔', '起泡', '色差', '糊版', '黏背', '甩色', '其他'];
const KINDS = [['note', '觀察', '觀察 Observation', 'NT'], ['gap', '追問→GAPS', '追問 → GAPS', 'Q'], ['todo', '待辦', '待辦 To-do', 'TD'],
  ['remark', '備註', '備註 Remark', 'RM'], ['mark', '標記', '標記 Mark', 'MK']];
const TEXT_KINDS = KINDS.map((k) => k[0]);
const AREAS = [['cause', '原因', '點解會出現'], ['check', '檢查', '點樣檢查'], ['fix', '做法', '點樣處理'], ['exc', '例外', '有咩例外']];
const PROMPTS = {
  cause: ['通常係咩搞成{t}？', '如果唔係呢個原因，仲可能係咩？'],
  check: ['見到{t}，你會先睇邊度？點樣量？', '正常數值應該係幾多？'],
  fix: ['你會點樣處理？最快嗰個方法係咩？', '第一個方法唔得，下一步呢？'],
  exc: ['有冇試過書本講嘅方法唔work？', '新手通常喺{t}度做錯咩？', '有冇啲情況要反過嚟做？'],
  story: ['上次遇到{t}係幾時？當時點樣？', '你啱入行嗰陣，師傅點教你處理{t}？', '最難搞嗰次{t}係點？']
};
const TAUGHT = ['note', 'remark', 'photo', 'measure', 'case', 'mark'];
const SCOPES = [['capture', '訪談及記錄經驗', 'Capture know-how'], ['voice_recording', '錄音', 'Voice recording'], ['internal_use', '貴公司內部使用', 'Internal use'],
  ['defect_images', '缺陷相片', 'Defect photos'], ['anonymised_starter_pack', '匿名行業知識包', 'Anonymised Starter Pack']];
const PF = [['語音備忘錄已開始錄音', 'Voice Memos is recording — 開「語音備忘錄」按紅掣，再返嚟'],
  ['電量 30% 以上', 'Battery above 30% — 1 小時錄音約用 10–15%'],
  ['儲存空間 1 GB 以上', 'Storage — 1 小時錄音約 60 MB，相片另計'],
  ['已開「勿擾模式」', 'Do Not Disturb — 控制中心 › 專注模式，免得來電打斷錄音']];
const MEASURES = [['ph', 'pH', '8.9', ''], ['visc', '黏度 Viscosity', '20', '秒 s'], ['temp', '溫度 Temp', '28', '°C'], ['hum', '濕度 Humidity', '85', '%'],
  ['speed', '車速 Speed', '180', 'm/min'], ['other', '其他 Other', '', '']];
const CASEF = [['reported_by', '邊個報告 Reported by', '2號機機長'], ['symptom', '機長點講 Symptom (operator’s words)', '墨槽啲泡好多，印出嚟有白點'],
  ['checks', '查過咩 Checks done', '回墨管、pH'], ['cause', '原因 Actual cause', '換墨桶後回墨管未放回液面下'],
  ['fix', '處理 Fix', '壓低回墨管'], ['minutes', '用咗幾耐（分鐘）Minutes to fix', '15']];
const TONES = ['#7d6346', '#4f5d6c', '#6d4f62', '#4a5a4a', '#665c48', '#574639', '#5f5070', '#2f5584'];

const DEMO = {
  customers: [{ id: 'HK002', name: '示例紙品', problems: ['起泡', '針孔', '色差'] }],
  experts: [{ id: 'HK002-E01', cid: 'HK002', name: '陳大文', short: '陳師傅', role: '印刷主管', years: '32', consent: false, scope: [] },
    { id: 'HK002-E02', cid: 'HK002', name: '李志強', short: '李師傅', role: '機長', years: '18', consent: true, scope: ['capture'] }],
  sessions: [],
  gallery: [['針孔', '本廠', '2號機 · 牛皮紙 170g', 'HK002'], ['針孔', '示例', '塗佈白卡 · 放大', '*'], ['起泡', '本廠', '墨槽 · 換墨後', 'HK002'],
    ['起泡', '示例', '印面白點', '*'], ['色差', '本廠', '同一單兩批', 'HK002'], ['糊版', '示例', '細字糊版', '*'], ['黏背', '示例', '疊板後黏背', '*'],
    ['甩色', '本廠', '摩擦測試', 'HK002']].map((g, i) => ({ id: 'demo' + i, file: '', defect: g[0], src: g[1], note: g[2], cid: g[3] })),
  chunk: 5 * 1024 * 1024
};

// ============================================================ icons
const sv = (p, c = '#1f3a5f', w = 2, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: (c) => sv('<path d="M15 5l-7 7 7 7"/>', c || '#1f3a5f', 2.4),
  plus: sv('<path d="M12 5v14M5 12h14"/>', '#e7b25c', 2.4),
  up: sv('<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>'),
  gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', '#ffffff', 1.8),
  dots: '<svg width="22" height="22" viewBox="0 0 24 24" fill="#1f3a5f"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  check: (c = '#ffffff', s = 16) => sv('<path d="M5 12l5 5 9-10"/>', c, 3.2, s),
  warn: sv('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>', '#9a5b0c', 2, 24),
  pin: sv('<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>', '#1f2a37', 2.2),
  cam: (c = '#1f3a5f', s = 26) => sv('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', c, 2, s),
  note: sv('<path d="M5 4h10l4 4v12H5z"/><path d="M8 12h8M8 16h6"/>', '#1f3a5f', 2, 26),
  bolt: sv('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', '#e7b25c', 2.2, 26),
  mic: sv('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', '#1f3a5f', 2, 26),
  done: sv('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>', '#1f3a5f', 2.2, 26),
  moon: sv('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', '#e7b25c', 2.2, 18),
  pic: sv('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 8"/>', '#1f3a5f', 2, 18),
  ask: sv('<path d="M4 5h16v11H9l-5 4z"/><path d="M10 9.5a2 2 0 1 1 2.5 1.9c-.4.1-.5.4-.5.8M12 14h.01"/>', '#1f3a5f', 2, 18),
  star: sv('<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>', '#e7b25c', 2, 26)
};

// ============================================================ helpers
const p2 = (n) => String(n).padStart(2, '0');
const fmt = (s) => { s = Math.max(0, Math.floor(s)); return p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s % 3600 / 60)) + ':' + p2(s % 60); };
const stamp = (ms) => { const d = new Date(ms); return { date: d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()), clock: p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()) }; };
const iso = (ms) => { const d = new Date(ms), o = -d.getTimezoneOffset(), a = Math.abs(o), x = stamp(ms); return x.date + 'T' + x.clock + (o >= 0 ? '+' : '-') + p2(Math.floor(a / 60)) + ':' + p2(a % 60); };
const today = () => stamp(Date.now()).date;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const h = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
const tone = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return TONES[x % TONES.length]; };
const uniq = (a) => a.filter((x, i) => x && a.indexOf(x) === i);
const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

// ============================================================ storage (IndexedDB)
const DB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('realynx-fieldkit', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('blobs'); };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async run(store, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode), req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Storage full?'));
    });
  },
  get(s, k) { return this.run(s, 'readonly', (o) => o.get(k)); },
  put(s, k, v) { return this.run(s, 'readwrite', (o) => o.put(v, k)); },
  del(s, k) { return this.run(s, 'readwrite', (o) => o.delete(k)); }
};
async function putBlob(key, blob) { const buf = await blob.arrayBuffer(); await DB.put('blobs', key, { type: blob.type, size: blob.size, buf }); }
async function getBlob(key) { const r = await DB.get('blobs', key); return r ? new Blob([r.buf], { type: r.type }) : null; }
const blobToB64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
const blobToDataUrl = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });

// ============================================================ state
const DEFAULT = () => ({ v: 1, config: null, cache: { customers: [], experts: [], sessions: [], gallery: [], chunk: 5 * 1024 * 1024 }, cacheAt: 0,
  localExperts: [], consents: {}, sessions: {}, interviewer: 'Tommy', lastSync: 0, lastDefect: '針孔', lastSubstrate: '', ui: { screen: 'home', active: null } });
let S = DEFAULT();
const U = { sheet: null, f: {}, edit: null, toast: '', net: 'none', netMsg: '', menu: null, confirm: false, quietHit: '', quietMsg: '', gal: 'all',
  show: { ids: [], i: 0 }, urls: {}, rec: null, sig: [], swUpdate: false, setupErr: '', busy: '' };
let saveT = null;
function save(now) {
  clearTimeout(saveT);
  const go = () => DB.put('kv', 'state', JSON.parse(JSON.stringify(S))).catch((e) => toast('未能儲存：' + e.message));
  if (now) return go();
  saveT = setTimeout(go, 250);
}

const sess = () => S.sessions[S.ui.active];
const secsOf = (s) => (s && s.timer ? s.timer.acc + (s.timer.running ? (Date.now() - s.timer.startedAt) / 1000 : 0) : 0);
const liveItems = (s) => s.items.filter((i) => !i.deleted);
const touch = (s) => { s.changedAt = Date.now(); save(); scheduleSync(); };
const customer = (cid) => S.cache.customers.find((c) => c.id === cid);
function allExperts() {
  const ids = new Set(S.cache.experts.map((x) => x.id));
  return S.cache.experts.map((x) => Object.assign({}, x, { key: x.id }))
    .concat(S.localExperts.filter((x) => !x.id || !ids.has(x.id)).map((x) => Object.assign({}, x, { key: x.id || x.uid })));
}
const expert = (k) => allExperts().find((x) => x.key === k || (x.uid && x.uid === k));
function hasConsent(k) {
  const x = expert(k); if (!x) return false;
  return !!x.consent || Object.values(S.consents).some((c) => c.expertKey === x.key || (x.uid && c.expertKey === x.uid));
}
const covOf = (s, t) => (s.cov && s.cov[t]) || {};
const missingOf = (s, t) => AREAS.filter((a) => !covOf(s, t)[a[0]]);

// ============================================================ render
let lastKey = '', renderQueued = false;
const typing = () => { const a = document.activeElement; return !!(a && APP.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')); };
let renderPending = false;
// Background updates wait while you type, so the iPhone keyboard never closes under your fingers.
function renderSoon() { if (typing()) { renderPending = true; return; } if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; render(); }); }
APP.addEventListener('focusout', () => setTimeout(() => { if (renderPending && !typing()) { renderPending = false; render(); } }, 50));
function render() {
  const sc = APP.querySelector('.scroll'), sh = APP.querySelector('.sheet');
  const top = sc ? sc.scrollTop : 0, stop = sh ? sh.scrollTop : 0;
  const key = S.ui.screen + '|' + (U.sheet || '');
  const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.bind : null;
  let html;
  try { html = view() + (U.sheet ? '<div class="veil"><button class="away" data-a="closeSheet" aria-label="Close"></button><div class="sheet"><div class="grab"></div>' + vSheet() + '</div></div>' : ''); }
  catch (e) { console.error(e); html = '<div class="scr"><div class="scroll"><b>出錯 Error</b><pre style="white-space:pre-wrap">' + h(e.stack || e) + '</pre><button class="btn" data-a="go" data-v="home">Home</button></div></div>'; }
  APP.innerHTML = html + '<div class="toast" id="toast" style="opacity:' + (U.toast ? 1 : 0) + '">' + h(U.toast) + '</div>';
  if (key === lastKey) {
    const sc2 = APP.querySelector('.scroll'), sh2 = APP.querySelector('.sheet');
    if (sc2) sc2.scrollTop = top; if (sh2) sh2.scrollTop = stop;
    if (active) { const el = APP.querySelector('[data-bind="' + active + '"]'); if (el && el.tagName !== 'BUTTON') { el.focus(); try { const n = el.value.length; el.setSelectionRange(n, n); } catch (e) { /* number fields */ } } }
  }
  lastKey = key;
  after();
}
function view() {
  if (!S.config) return vSetup();
  const scr = S.ui.screen;
  if (['session', 'preflight', 'quiet', 'show', 'finish', 'thanks'].indexOf(scr) >= 0 && !sess()) { S.ui.screen = 'home'; return vHome(); }
  return ({ home: vHome, new: vNew, consent: vConsent, preflight: vPreflight, session: vSession, quiet: vQuiet, show: vShow, finish: vFinish,
    thanks: vThanks, uploads: vUploads, settings: vSettings })[scr]?.() || vHome();
}
function bar(title, sub, back) {
  return `<div class="bar"><button class="ib" data-a="go" data-v="${back}" aria-label="Back">${I.back()}</button><div class="t"><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
}
let toastT = null;
function toast(msg) {
  U.toast = msg; const t = document.getElementById('toast');
  if (t) { t.textContent = msg; t.style.opacity = 1; }
  clearTimeout(toastT); toastT = setTimeout(() => { U.toast = ''; const t2 = document.getElementById('toast'); if (t2) t2.style.opacity = 0; }, 2000);
}
function tick() {
  const s = sess(), c = fmt(secsOf(s));
  APP.querySelectorAll('[data-clock]').forEach((el) => { el.textContent = c; });
  const n = stamp(Date.now());
  APP.querySelectorAll('[data-now]').forEach((el) => { el.textContent = n.date + ' ' + n.clock; });
}
setInterval(tick, 1000);

// ============================================================ SETUP (connect)
function parseCode(raw) {
  let c = String(raw || '').trim();
  const m = c.match(/#c=([A-Za-z0-9_-]+)/); if (m) c = m[1];
  c = c.replace(/\s+/g, '');
  const json = JSON.parse(decodeURIComponent(escape(atob(c.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((c.length + 3) % 4)))));
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(json.u);
  if (!json.u || !json.t || !(local || /^https:\/\/script\.google\.com\//.test(json.u))) throw new Error('bad');
  return { api: json.u, token: json.t };
}
function vSetup() {
  const hashCode = (location.hash.match(/#c=([A-Za-z0-9_-]+)/) || [])[1];
  const safari = !isStandalone();
  let body;
  if (hashCode && safari) {
    body = `<div class="okbox">${I.check('#235a42', 20)} 已收到連接碼 Connection code received</div>
      <div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">
        <b>安裝到主畫面 Install on the Home Screen</b>
        <div style="font-size:14px;line-height:1.6">① 按 <b>複製連接碼</b><br>② 按 Safari 下面嘅分享 <b>⎙</b> › <b>加至主畫面</b><br>③ 從主畫面打開 <b>Field Kit</b>，按 <b>貼上並連接</b></div>
        <button class="btn" data-a="copyCode" data-v="${hashCode}">複製連接碼 Copy code</button>
      </div>
      <div class="help">主畫面 App 有自己嘅儲存空間，所以要貼一次連接碼。· The Home Screen app keeps its own storage, so it needs the code once.</div>
      <button class="btn gray" data-a="connect" data-v="${hashCode}">唔安裝，直接在 Safari 用 · Use in Safari instead</button>`;
  } else {
    body = `<div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">
        <b>連接你的 Realynx Sheet · Connect</b>
        <div style="font-size:13.5px;color:var(--ink2);line-height:1.5">在 Google Sheet 開 <b>Realynx ▸ Field Kit (iPhone) ▸ Connect iPhone…</b>，用相機掃 QR，或者把連接碼貼在下面。</div>
        <textarea class="inp" data-bind="f.code" placeholder="連接碼 Connection code" style="min-height:90px;font-family:monospace;font-size:13px">${h(U.f.code || '')}</textarea>
        <div class="grid2"><button class="btn line" data-a="pasteCode">貼上 Paste</button><button class="btn" data-a="connect">連接 Connect</button></div>
        ${U.setupErr ? `<div style="color:var(--err);font-size:13px">${h(U.setupErr)}</div>` : ''}
        ${U.busy ? `<div style="color:var(--muted);font-size:13px">${h(U.busy)}</div>` : ''}
      </div>
      <button class="btn gray" data-a="demo">先試用示範（不會上載）· Try the demo (nothing uploads)</button>`;
  }
  return `<div class="scr"><div class="hero"><div class="k">REALYNX RELAY 承傳 · FIELD KIT</div><h1>歡迎 Welcome</h1><div class="s">訪談助手 · interview companion · v${VERSION}</div><div class="rule"></div></div>
    <div class="scroll">${body}</div></div>`;
}

// ============================================================ HOME
function homeSessions() {
  const local = Object.values(S.sessions).filter((s) => !s.deleted);
  const linked = new Set(local.map((s) => s.sid).filter(Boolean));
  const remote = S.cache.sessions.filter((r) => !linked.has(r.id) && !r.cancelled && r.status === 'planned')
    .map((r) => ({ remote: true, key: 'R:' + r.id, sid: r.id, cid: r.cid, expertKey: r.expert, date: r.date, type: r.type, topics: r.topics, items: [] }));
  return local.concat(remote).sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 40);
}
function pendingCount() {
  let n = 0;
  Object.values(S.sessions).forEach((s) => {
    if (s.deleted && !s.metaDirty) return;
    n += s.items.filter((i) => i.blobKey && !i.blobDone && !i.deleted).length;
    if ((s.changedAt || 0) > (s.syncedAt || 0) || s.metaDirty || !s.sid) n++;
  });
  return n + S.localExperts.filter((x) => !x.id).length + Object.values(S.consents).filter((c) => !c.done).length;
}
function netLine() {
  if (S.config && S.config.demo) return '示範模式：不會上載 · Demo mode';
  if (!navigator.onLine) return '沒有網絡，有訊號時自動上載 · Offline';
  if (U.net === 'error') return '上載出錯，會再試 · ' + U.netMsg;
  if (U.net === 'syncing') return '同步中… Syncing';
  return S.lastSync ? '上次同步 Synced ' + stamp(S.lastSync).clock : '未同步 Not synced yet';
}
function vHome() {
  const d = new Date(), hr = d.getHours();
  const greet = hr < 12 ? '早晨' : hr < 18 ? '午安' : '晚上好';
  const pend = pendingCount();
  const list = homeSessions();
  const td = today();
  const cards = list.map((s) => {
    const x = expert(s.expertKey), n = s.items.filter((i) => !i.deleted && i.kind !== 'switch').length;
    const status = s.cancelled ? '已取消' : s.remote ? '來自 Sheet' : s.finished ? '已完成' : s.timer && s.timer.acc + (s.timer.running ? 1 : 0) > 0 ? '進行中' : (s.date === td ? '今日' : s.date);
    const pill = s.cancelled ? 'background:#ebe6dc;color:#7b8591' : s.finished ? 'background:#e3f1ea;color:#235a42' : status === '進行中' ? 'background:#fdf3e2;color:#7a4608' : 'background:#ebe6dc;color:#4a5563';
    return `<div class="card" style="display:flex;align-items:stretch;overflow:hidden">
      <button data-a="openSession" data-v="${h(s.key)}" style="flex:1;display:flex;align-items:center;gap:12px;padding:14px 8px 14px 14px;border:0;background:transparent;text-align:left;min-width:0">
        <div style="width:44px;height:44px;border-radius:22px;background:#e8eef6;color:#1f3a5f;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">${h((x ? x.short : '?').slice(0, 1))}</div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
          <b style="font-size:15.5px;${s.cancelled ? 'color:#9aa4b0;text-decoration:line-through' : ''}">${h(s.sid || '未上載')} · ${h(x ? x.short : '—')}</b>
          <span style="font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${h(s.date)} · ${n} 項${s.topics && s.topics.length ? ' · ' + h(s.topics.join('、')) : ''}</span>
        </div>
        <span style="font-size:12px;font-weight:700;padding:4px 10px;border-radius:12px;flex-shrink:0;${pill}">${h(status)}</span>
      </button>
      ${s.remote ? '' : `<button data-a="sessMenu" data-v="${h(s.key)}" aria-label="Session options" style="width:46px;border:0;border-left:1px solid #eee9df;background:transparent;display:flex;align-items:center;justify-content:center">${I.dots}</button>`}
    </div>`;
  }).join('');
  return `<div class="scr">
    <div class="hero"><div class="row" style="justify-content:space-between"><div class="k">REALYNX RELAY 承傳 · FIELD KIT</div>
      <button class="ib" data-a="go" data-v="settings" aria-label="Settings" style="margin:-12px -12px -12px 0">${I.gear}</button></div>
      <h1>${greet}，${h(S.interviewer)}</h1><div class="s">${d.getMonth() + 1}月${d.getDate()}日（${'日一二三四五六'[d.getDay()]}）</div><div class="rule"></div></div>
    <div class="scroll">
      <button class="card row" data-a="go" data-v="uploads" style="padding:14px 16px;text-align:left">${I.up}
        <div style="flex:1;display:flex;flex-direction:column"><b style="font-size:15px">${pend ? '等候上載 ' + pend + ' 項 · Waiting' : '全部已上載 All saved to Drive'}</b>
        <span style="font-size:12px;color:var(--muted)"><span class="netdot ${navigator.onLine ? U.net : ''}"></span>${h(netLine())}</span></div>
        <span style="font-size:13px;color:var(--navy);font-weight:700">查看</span></button>
      ${U.swUpdate ? '<button class="warnbox" data-a="reload"><b style="flex:1">新版本已準備好 · New version ready</b><span>重開 ›</span></button>' : ''}
      <div class="lbl" style="margin-top:6px">訪談 SESSIONS</div>
      ${cards || '<div class="help">未有訪談。按下面「新訪談」開始。· No sessions yet.</div>'}
    </div>
    <div class="dock"><button class="big" data-a="newSession" style="display:flex;align-items:center;justify-content:center;gap:10px;height:60px;font-size:18px;box-shadow:0 8px 20px rgba(31,58,95,.28)">${I.plus} 新訪談 New session</button></div>
  </div>`;
}

// ============================================================ NEW / EDIT SESSION
function vNew() {
  const f = U.f, editing = !!f.editKey;
  const custs = S.cache.customers;
  const exs = allExperts().filter((x) => x.cid === f.cid);
  const ex = expert(f.expertKey), ok = ex && hasConsent(ex.key);
  const c = customer(f.cid);
  const sugg = uniq((c && c.problems ? c.problems.filter((p) => String(p).length <= 8) : []).concat(SUGGEST, f.topics));
  return `<div class="scr">${bar(editing ? '修改訪談 Edit session' : '新訪談 New session', editing ? h(f.editLabel) : '', 'home')}
    <div class="scroll tall">
      <div class="h">客戶 Customer</div>
      ${custs.length ? `<div class="chips">${custs.map((x) => `<button class="chip ${f.cid === x.id ? 'on' : ''}" data-a="fCust" data-v="${h(x.id)}">${h(x.id)} ${h(x.name)}</button>`).join('')}</div>`
        : '<div class="help">Sheet 未有客戶。先用客戶資料表 (intake form) 建立客戶，再按設定 › 重新下載資料。· No customers in the Sheet yet.</div>'}
      <div class="h">專家 Expert</div>
      <div class="chips">${exs.map((x) => `<button class="chip ${f.expertKey === x.key ? 'on' : ''}" data-a="fExpert" data-v="${h(x.key)}">${h(x.short)}${x.years ? ' ' + h(x.years) + '年' : ''}</button>`).join('')}
        <button class="chip add" data-a="openNewExpert">＋ 新專家</button></div>
      <div class="h">預計主題 Planned topics <span style="font-weight:400;color:var(--muted)">— 可多選，訪談中可隨時加</span></div>
      <div class="chips">${sugg.map((x) => `<button class="chip ${f.topics.indexOf(x) >= 0 ? 'on' : ''}" data-a="fTopic" data-v="${h(x)}">${h(x)}</button>`).join('')}
        <button class="chip add" data-a="openNewTopic">＋ 新主題</button></div>
      <div class="h">語言 Language</div>
      <div class="seg" style="grid-template-columns:repeat(3,1fr)">${LANGS.map((x) => `<button class="${f.lang === x[0] ? 'on' : ''}" data-a="fLang" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
      <div class="grid2">
        <label class="fld">日期 Date<input class="inp" type="date" data-bind="f.date" value="${h(f.date)}"></label>
        <label class="fld">地點 Location<input class="inp" data-bind="f.location" value="${h(f.location)}" placeholder="例：2號機"></label>
      </div>
      ${ex && !ok ? `<button class="warnbox" data-a="goConsent">${I.warn}<div style="flex:1;display:flex;flex-direction:column"><b style="font-size:15px">未有同意書 Consent missing</b><span style="font-size:12.5px">錄音前請先簽署 · Sign before recording</span></div><b>簽署 ›</b></button>` : ''}
      ${ex && ok ? `<div class="okbox">${I.check('#235a42', 20)} 同意書已簽署 Consent signed</div>` : ''}
    </div>
    <div class="dock">
      ${editing ? '<button class="big" data-a="saveDetails">儲存修改 Save changes</button>'
        : `<button class="big ${ex && ok ? '' : 'dis'}" data-a="startNew">開始訪談 Start session</button>
           <button class="btn gray" data-a="saveForLater" style="height:40px">只建立，稍後開始 · Save for later</button>`}
    </div></div>`;
}

// ============================================================ CONSENT
function vConsent() {
  const x = expert(U.f.expertKey);
  const sc = U.f.scopes || [true, true, true, true, false];
  return `<div class="scr">${bar('同意書 Consent', h(x ? x.name + '（' + x.short + '）' : '') + ' · ' + h(U.f.cid), 'new')}
    <div class="scroll">
      <div style="font-size:12.5px;color:var(--ink2)">請師傅逐項確認。Please ask the expert to confirm each item.</div>
      ${SCOPES.map((s, i) => `<button class="tick" data-a="toggleScope" data-v="${i}"><span class="box ${sc[i] ? 'on' : ''}">${I.check()}</span><span><b>${s[1]}</b><span>${s[2]}</span></span></button>`).join('')}
      <div class="row" style="justify-content:space-between;margin-top:6px"><span class="h">專家簽名 Expert signature</span><button class="chip sm" data-a="clearSig">清除 Clear</button></div>
      <canvas class="sig" id="sig"></canvas>
      <button class="btn line" data-a="paperPhoto" style="display:flex;align-items:center;justify-content:center;gap:8px">${I.cam('#1f3a5f', 20)} ${U.f.paperKey ? '已影紙本同意書 ✓ 重影' : '影相：紙本同意書 Photo of paper form'}</button>
    </div>
    <div class="dock"><button class="big" data-a="saveConsent">儲存同意書 Save consent</button></div></div>`;
}
function initSig() {
  const cv = document.getElementById('sig'); if (!cv) return;
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f3a5f';
  const draw = () => { ctx.clearRect(0, 0, r.width, r.height);
    if (!U.sig.length) { ctx.fillStyle = '#9aa4b0'; ctx.font = '15px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('用手指簽名 Sign with a finger', r.width / 2, r.height / 2 + 5); }
    U.sig.forEach((st) => { ctx.beginPath(); st.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }); };
  draw();
  let cur = null;
  const pt = (e) => [e.clientX - r.left, e.clientY - r.top];
  cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); cur = [pt(e)]; U.sig.push(cur); draw(); };
  cv.onpointermove = (e) => { if (!cur) return; cur.push(pt(e)); draw(); };
  cv.onpointerup = cv.onpointercancel = () => { cur = null; };
}

// ============================================================ PRE-FLIGHT
function vPreflight() {
  const s = sess(), x = expert(s.expertKey), pf = s.preflight || [false, false, false, false], ready = pf.every(Boolean);
  return `<div class="scr">${bar('開始前檢查 Pre-flight', '30 秒，避免錄音中途出事', 'home')}
    <div class="scroll">
      <div class="okbox">${I.check('#235a42', 20)}<span>同意書已簽 Consent signed<br><span style="font-weight:400;font-size:12px">${h(x ? x.name + '（' + x.short + '）' : '')}</span></span></div>
      ${PF.map((p, i) => `<button class="tick" data-a="togglePf" data-v="${i}"><span class="box ${pf[i] ? 'on' : ''}">${I.check()}</span><span><b>${p[0]}</b><span>${p[1]}</span></span></button>`).join('')}
      <div style="font-size:12px;color:var(--muted);line-height:1.5">iPhone 唔俾網頁讀電量同空間，所以要自己剔。· iPhone web apps cannot read battery or storage, so these are ticked by hand.</div>
    </div>
    <div class="dock"><button class="big ${ready ? '' : 'dis'}" data-a="pfStart">${ready ? '開始訪談 Start' : '仲有 ' + pf.filter((v) => !v).length + ' 項未剔'}</button>
      <button class="btn gray" data-a="pfSkip" style="height:40px;border:0;background:transparent;text-decoration:underline">跳過檢查 Skip</button></div></div>`;
}

// ============================================================ SESSION
function badge(kind) {
  return ({ mark: ['#e7b25c', '#1f2a37'], photo: ['#e8eef6', '#1f3a5f'], note: ['#eef3ea', '#2d5a3f'], gap: ['#fdf3e2', '#7a4608'], remark: ['#f1e8f6', '#5b2d74'],
    switch: ['#17304f', '#e7b25c'], todo: ['#eceff3', '#3b4654'], case: ['#fbeceb', '#8c2f25'], audio: ['#e8eef6', '#1f3a5f'], measure: ['#e6f2f4', '#1d5b66'],
    show: ['#20303f', '#ffffff'], prompt: ['#fff7e0', '#7a4608'] })[kind] || ['#eee', '#333'];
}
function itemState(s, it) {
  if (S.config && S.config.demo) return '示範';
  if (it.blobKey && !it.blobDone) return it.progress ? '上載 ' + Math.round(it.progress * 100) + '%' : '等候上載';
  return (s.syncedAt || 0) >= (it.changedAt || it.at) ? '已上載' : '等候上載';
}
function vSession() {
  const s = sess(), x = expert(s.expertKey), lang = LANGS.find((y) => y[0] === s.lang);
  const items = liveItems(s);
  const shown = items.filter((i) => s.filter === 'all' || !s.filter || i.topic === (s.filter === 'current' ? s.current : s.filter));
  const miss = s.current ? missingOf(s, s.current).length : 0;
  items.filter((i) => i.kind === 'photo' && i.blobKey).forEach((i) => ensureUrl(i.blobKey));
  return `<div class="scr">
    <div class="shead">
      <div class="row" style="gap:4px"><button class="ib" data-a="go" data-v="home" aria-label="Home">${I.back('#ffffff')}</button>
        <div style="flex:1;display:flex;flex-direction:column;min-width:0"><b style="font-size:17px">${h(s.sid || '新訪談')} · ${h(x ? x.short : '')}</b>
        <span style="font-size:12px;opacity:.8">${h(lang ? lang[1] : '')}${s.location ? ' · ' + h(s.location) : ''}</span></div></div>
      <div class="row" style="gap:10px;padding:0 6px">
        <div class="timer"><span class="dot ${s.timer.running ? 'rec' : ''}"></span>
          <span style="display:flex;flex-direction:column"><span class="c" data-clock>${fmt(secsOf(s))}</span><span class="hint">${s.timer.running ? '已進行 Elapsed' : '未開始 Not started'}</span></span></div>
        <button class="markb" data-a="mark">${I.pin}標記 Mark</button>
      </div>
    </div>
    <div class="tbar">
      <div class="row" style="justify-content:space-between;padding:0 16px"><span style="font-size:11.5px;font-weight:700;color:#e7b25c;letter-spacing:.06em">而家講緊 NOW DISCUSSING</span><span style="font-size:11px;color:#b9c6d8">轉話題就按一下</span></div>
      <div class="hs">${s.topics.map((tp) => `<button class="tchip ${tp === s.current ? 'on' : ''}" data-a="switchTopic" data-v="${h(tp)}">${h(tp)} <i>${items.filter((i) => i.topic === tp && i.kind !== 'switch').length}</i></button>`).join('')}
        <button class="tchip" data-a="openNewTopic" style="border-style:dashed;border-color:#8fa3bd">＋ 新主題</button></div>
    </div>
    <div class="tools">
      <div class="row" style="gap:6px"><span style="font-size:11.5px;font-weight:700;color:var(--muted);flex-shrink:0;max-width:92px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${h(s.current || '—')} 講咗</span>
        <div class="hs" style="gap:6px">${AREAS.map((a) => { const on = !!covOf(s, s.current)[a[0]]; return `<button class="cov ${on ? 'on' : ''}" data-a="cov" data-v="${a[0]}">${on ? '✓ ' : ''}${a[1]}</button>`; }).join('')}</div></div>
      <div class="grid3"><button class="tool dark" data-a="quiet">${I.moon}靜音 Quiet</button><button class="tool" data-a="gallery">${I.pic}俾佢睇</button>
        <button class="tool" data-a="prompts">${I.ask}提示${miss ? ' · 缺 ' + miss : ''}</button></div>
    </div>
    <div class="scroll" style="padding-bottom:calc(150px + var(--sb));gap:10px">
      <div class="row" style="justify-content:space-between"><span class="lbl">時間線 TIMELINE · ${items.filter((i) => i.kind !== 'switch').length} 項</span><span style="font-size:11.5px;color:var(--faint)">按一項可修改</span></div>
      <div class="hs" style="gap:6px"><span style="font-size:12px;color:var(--muted);align-self:center;flex-shrink:0">顯示</span>
        ${[['all', '全部'], ['current', '只看 ' + (s.current || '')]].concat(s.topics.filter((tp) => tp !== s.current).map((tp) => [tp, tp]))
          .map((f) => `<button class="chip sm ${(s.filter || 'all') === f[0] ? 'on' : ''}" data-a="filter" data-v="${h(f[0])}">${h(f[1])}</button>`).join('')}</div>
      ${shown.map((i) => { const c = badge(i.kind), x2 = stamp(i.at), url = i.blobKey && U.urls[i.blobKey];
        return `<button class="item" data-a="edit" data-v="${h(i.uid)}"><div class="badge" style="background:${c[0]};color:${c[1]}">${url && i.kind === 'photo' ? `<img src="${url}" alt="">` : h(i.tag)}</div>
          <div class="m"><b>${h(i.title)}</b>${i.text ? `<span>${h(i.text)}</span>` : ''}${i.kind === 'switch' ? '' : `<span style="color:var(--navy);font-size:11.5px">主題：${h(i.topic || '—')}</span>`}</div>
          <div class="r"><b>${x2.date.slice(5)}</b><span>${x2.clock}</span><span style="font-size:10.5px;color:var(--faint)">${h(i.rec)}</span><span style="font-size:11px;color:${itemState(s, i) === '已上載' ? '#2d6a4f' : '#9a5b0c'}">${h(itemState(s, i))}</span></div></button>`; }).join('')}
    </div>
    <div class="tabs">
      <button class="tab" data-a="photo">${I.cam()}相片</button>
      <button class="tab" data-a="sheet" data-v="note">${I.note}筆記</button>
      <button class="tab main" data-a="sheet" data-v="remark">${I.bolt}快速備註</button>
      <button class="tab" data-a="sheet" data-v="audio">${I.mic}錄音</button>
      <button class="tab" data-a="go" data-v="finish">${I.done}完成</button>
    </div></div>`;
}

// ============================================================ QUIET
function vQuiet() {
  const s = sess();
  const q = (w, fg, bg, big, small) => `<button class="qb" data-a="quietTap" data-v="${w}" style="border-color:${fg};${U.quietHit === w ? 'background:' + fg + ';color:#050607' : 'background:' + bg + ';color:' + fg}"><b>${big}</b><span>${small}</span></button>`;
  return `<div class="scr quiet">
    <div class="row" style="gap:10px;color:#6b7686;font-size:13px"><span class="dot ${s.timer.running ? 'rec' : ''}"></span><b data-clock style="font-variant-numeric:tabular-nums">${fmt(secsOf(s))}</b>
      <span style="flex:1;text-align:right;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">而家講緊 ${h(s.current || '—')}</span></div>
    <div style="height:26px;text-align:center;font-size:18px;font-weight:700;color:#6fcf97;opacity:${U.quietMsg ? 1 : 0}">${h(U.quietMsg || ' ')}</div>
    ${q('mark', '#e7b25c', '#14110a', '標記', 'Mark · 好嘢，記低呢一刻')}
    ${q('exc', '#e0786c', '#160c0b', '重要例外', 'Exception · 同平時唔同')}
    ${q('ask', '#7fa8dc', '#0b1119', '之後追問', 'Ask later → GAPS')}
    <div class="hs" style="flex-shrink:0">${s.topics.map((t) => `<button data-a="quietTopic" data-v="${h(t)}" style="flex-shrink:0;height:40px;padding:0 14px;border-radius:20px;font-size:14px;${t === s.current ? 'border:1px solid #6b5a33;background:#1b1810;color:#c9a45a' : 'border:1px solid #222830;background:transparent;color:#56606c'}">${h(t)}</button>`).join('')}</div>
    <button data-a="go" data-v="session" style="height:48px;flex-shrink:0;border-radius:14px;border:1px solid #2a313a;background:transparent;color:#8a95a3;font-size:15px">離開靜音 Exit quiet mode</button>
  </div>`;
}

// ============================================================ GALLERY / SHOW
function galleryFor(s) {
  const list = S.cache.gallery.filter((g) => g.cid === s.cid || g.cid === '*').map((g) => Object.assign({}, g, { key: g.file ? 'img:' + g.file : '' }))
    .concat(liveItems(s).filter((i) => i.kind === 'photo').map((i) => ({ id: 'p' + i.uid, defect: i.defect || '其他', src: '今日', note: i.text || '', key: i.blobKey })));
  const n = {};
  list.forEach((g) => { n[g.defect] = (n[g.defect] || 0) + 1; g.n = n[g.defect]; });
  return { list, counts: n };
}
function vShow() {
  const s = sess(), all = galleryFor(s).list, ids = U.show.ids, g = all.find((x) => x.id === ids[U.show.i]);
  if (g && g.key) ensureUrl(g.key, g.file);
  const url = g && g.key && U.urls[g.key];
  return `<div class="scr" style="background:#000;color:#fff">
    <div class="row" style="padding:calc(var(--st) + 10px) 16px 10px"><span style="flex:1;display:flex;flex-direction:column"><span style="font-size:12px;color:#8a95a3">給師傅看 · 已記錄時間</span><b>${g ? U.show.i + 1 + ' / ' + ids.length : ''}</b></span>
      <button data-a="showDone" style="height:40px;padding:0 18px;border-radius:20px;border:0;background:#e7b25c;color:#1f2a37;font-size:15px;font-weight:700">完成 Done</button></div>
    <div style="position:relative;flex:1;margin:0 10px;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:${g ? tone(g.defect + g.n) : '#333'}">
      ${url ? `<img src="${url}" alt="" onerror="this.remove()" style="width:100%;height:100%;object-fit:contain;background:#000">` : '<span style="opacity:.6;font-size:13px">[未有相片 · no photo downloaded]</span>'}
      <div style="position:absolute;left:14px;bottom:12px;display:flex;flex-direction:column;text-shadow:0 2px 8px rgba(0,0,0,.8)"><b style="font-size:28px">${g ? h(g.defect + ' #' + g.n) : ''}</b><span style="font-size:14px">${g ? h(g.src + ' · ' + g.note) : ''}</span></div>
    </div>
    <div style="padding:12px 18px 4px;font-size:15px;color:#c9d1db;text-align:center">「呢個你見過未？通常點搞成？」</div>
    <div class="grid2" style="padding:8px 16px calc(16px + var(--sb))">
      <button data-a="showStep" data-v="-1" style="height:62px;border-radius:16px;border:1px solid #2a313a;background:#12161b;color:#fff;font-size:17px;font-weight:700">‹ 上一張</button>
      <button data-a="showStep" data-v="1" style="height:62px;border-radius:16px;border:1px solid #2a313a;background:#12161b;color:#fff;font-size:17px;font-weight:700">下一張 ›</button></div></div>`;
}

// ============================================================ FINISH / THANKS
function vFinish() {
  const s = sess(), x = expert(s.expertKey), items = liveItems(s);
  const taught = items.filter((i) => TAUGHT.indexOf(i.kind) >= 0).length;
  const missN = s.topics.reduce((n, t) => n + missingOf(s, t).length, 0);
  const pend = items.filter((i) => i.blobKey && !i.blobDone).length;
  const hasAudio = items.some((i) => i.kind === 'audio' && i.sub === 'memo');
  const chk = [['同意書 Consent', hasConsent(s.expertKey) ? '已簽名 Signed' : '未簽 Missing', hasConsent(s.expertKey)],
    ['語音備忘錄 Recording', hasAudio ? '已加入' : '未加入 — 按「錄音」› 加入語音備忘錄檔案（或之後在 Mac 處理）', hasAudio],
    ['相片 Photos', items.filter((i) => i.kind === 'photo').length + ' 張', true],
    ['筆記及備註 Notes & remarks', items.filter((i) => ['note', 'remark', 'gap', 'measure', 'todo', 'case'].indexOf(i.kind) >= 0).length + ' 項', true],
    ['上載 Uploads', pend ? pend + ' 個檔案未上載（可離開，有網絡時會繼續）' : '檔案全部上載', !pend]];
  return `<div class="scr">${bar('完成訪談 Finish session', h((s.sid || '') + ' · ' + (x ? x.short : '')), 'session')}
    <div class="scroll">
      <button data-a="go" data-v="thanks" style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;border:2px solid #e7b25c;background:#1f3a5f;text-align:left">${I.star}
        <span style="flex:1;display:flex;flex-direction:column"><b style="font-size:16px;color:#fff">給師傅看今日成果</b><span style="font-size:12px;color:#c9d4e3">Show him what he taught today · ${taught} 樣</span></span><b style="font-size:18px;color:#e7b25c">›</b></button>
      <div class="row" style="justify-content:space-between;margin-top:6px"><span class="lbl">主題覆蓋 COVERAGE</span><b style="font-size:12px;color:var(--warn)">${missN ? '未問 ' + missN + ' 項' : '全部問到'}</b></div>
      ${s.topics.map((t) => { const m = missingOf(s, t), d = AREAS.filter((a) => covOf(s, t)[a[0]]);
        return `<div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:3px"><div class="row" style="justify-content:space-between"><b style="font-size:15px">${h(t)}</b><b style="font-size:13px;color:${m.length ? '#7a4608' : '#235a42'}">${d.length} / 4</b></div>
          <span style="font-size:12.5px;color:#235a42">${d.length ? '已問：' + d.map((a) => a[1]).join('、') : '未問任何範疇'}</span><b style="font-size:12.5px;color:#7a4608">${m.length ? '未問：' + m.map((a) => a[1]).join('、') : '四項都問到 ✓'}</b></div>`; }).join('')}
      ${missN ? '<button class="btn" data-a="askMissing" style="background:#fdf3e2;color:#7a4608;border:1px solid #c9892b;height:48px">返回補問 Go back &amp; ask the gaps</button>' : ''}
      <div class="lbl" style="margin-top:6px">檢查 CHECKLIST</div>
      ${chk.map((c) => `<div class="card row" style="padding:14px"><span style="width:32px;height:32px;border-radius:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;${c[2] ? 'background:#e3f1ea;color:#235a42' : 'background:#fdf3e2;color:#7a4608'}">${c[2] ? '✓' : '!'}</span>
        <span style="flex:1;display:flex;flex-direction:column"><b style="font-size:15px">${c[0]}</b><span style="font-size:12px;color:var(--muted)">${c[1]}</span></span></div>`).join('')}
      <label class="fld" style="font-size:13px;color:var(--ink);margin-top:6px">總結 Closing note（可用語音輸入 dictation）
        <textarea class="inp" data-bind="s.closing" placeholder="例：師傅下次想講乾燥問題；要帶 pH 計。">${h(s.closing || '')}</textarea></label>
    </div>
    <div class="dock"><button class="big" data-a="finish">${s.finished ? '已完成 · 再同步 Sync again' : '完成並上載 Finish &amp; upload'}</button></div></div>`;
}
function vThanks() {
  const s = sess(), x = expert(s.expertKey), items = liveItems(s);
  const taught = items.filter((i) => TAUGHT.indexOf(i.kind) >= 0);
  const rows = s.topics.map((t) => ({ t, n: taught.filter((i) => i.topic === t).length })).filter((r) => r.n);
  const next = s.topics.filter((t) => missingOf(s, t).length).map((t) => t + '：' + missingOf(s, t).map((a) => a[2]).join('、'))
    .concat(items.filter((i) => i.kind === 'gap' && i.text && i.text.indexOf('靜音模式') !== 0).slice(0, 3).map((i) => (i.topic ? i.topic + '：' : '') + i.text)).slice(0, 6);
  return `<div class="scr" style="background:#1f3a5f;color:#fff">
    <div class="scroll" style="padding:calc(var(--st) + 40px) 26px calc(120px + var(--sb));gap:18px">
      <div style="font-size:11px;letter-spacing:.18em;opacity:.75">REALYNX RELAY 承傳</div>
      <div style="font-size:32px;font-weight:700;line-height:1.3">${h(x ? x.short : '師傅')}，<br>多謝你！</div>
      <div class="rule"></div>
      <div class="row" style="align-items:baseline;gap:10px"><span style="font-size:20px">今日你教咗我哋</span><b style="font-size:72px;color:#e7b25c;line-height:1">${taught.length}</b><span style="font-size:20px">樣嘢</span></div>
      <div style="border-top:1px solid rgba(255,255,255,.2)">${rows.map((r) => `<div class="row" style="justify-content:space-between;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.2)"><b style="font-size:22px">${h(r.t)}</b><span style="font-size:18px;color:#e7b25c">${r.n} 樣</span></div>`).join('')}</div>
      ${next.length ? `<div style="display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:16px;background:rgba(255,255,255,.08)"><b style="font-size:17px;color:#e7b25c">下次想再請教</b>${next.map((n) => `<span style="font-size:17px;line-height:1.45">· ${h(n)}</span>`).join('')}</div>` : ''}
      <div style="font-size:14px;opacity:.75;line-height:1.5">你講嘅經驗會整理成知識卡，下次見面請你逐張確認。</div>
    </div>
    <div class="dock"><button class="big" data-a="go" data-v="finish" style="background:transparent;border:1px solid rgba(255,255,255,.5)">返回 Back</button></div></div>`;
}

// ============================================================ UPLOADS / SETTINGS
function vUploads() {
  const rows = Object.values(S.sessions).filter((s) => !s.deleted).sort((a, b) => (b.changedAt || 0) - (a.changedAt || 0)).map((s) => {
    const x = expert(s.expertKey), items = liveItems(s);
    const ph = items.filter((i) => i.kind === 'photo'), phDone = ph.filter((i) => i.blobDone).length;
    const au = items.filter((i) => i.kind === 'audio');
    const notesOk = (s.syncedAt || 0) >= (s.changedAt || 0) && s.sid;
    return `<div class="card" style="padding:14px;display:flex;flex-direction:column;gap:8px">
      <div class="row" style="justify-content:space-between"><b style="font-size:15px">${h(s.sid || '未建立 Not created')} · ${h(x ? x.short : '')}</b><span style="font-size:12px;color:var(--muted)">${h(s.date)}</span></div>
      <span style="font-size:13px;color:${notesOk ? '#2d6a4f' : '#9a5b0c'}">筆記及時間線 Notes: ${notesOk ? '已同步 ' + stamp(s.syncedAt).clock : '等候上載'}</span>
      ${ph.length ? `<span style="font-size:13px;color:${phDone === ph.length ? '#2d6a4f' : '#9a5b0c'}">相片 Photos: ${phDone} / ${ph.length}</span>` : ''}
      ${au.map((a) => `<div style="display:flex;flex-direction:column;gap:4px"><span style="font-size:13px">${h(a.title)} · ${a.size ? mb(a.size) : ''} · ${a.blobDone ? '<b style="color:#2d6a4f">已上載</b>' : a.progress ? Math.round(a.progress * 100) + '%' : '等候'}</span>
        <div class="prog"><div style="width:${a.blobDone ? 100 : Math.round((a.progress || 0) * 100)}%;${a.blobDone ? 'background:#2d6a4f' : ''}"></div></div></div>`).join('')}
      <span style="font-size:11.5px;color:var(--faint)">Drive › customers/${h(s.cid)}/sessions/${h(s.sid || '…')}</span></div>`;
  }).join('');
  return `<div class="scr">${bar('上載 Uploads', '沒有網絡時會等候，恢復後繼續 · Resumes when signal returns', 'home')}
    <div class="scroll">
      <div class="card row" style="padding:12px 14px"><span class="netdot ${navigator.onLine ? U.net : ''}"></span><span style="flex:1;font-size:13.5px">${h(netLine())}</span></div>
      ${rows || '<div class="help">未有資料。</div>'}
    </div>
    <div class="dock"><button class="big" data-a="syncNow">立即同步 Sync now</button></div></div>`;
}
function vSettings() {
  const c = S.config || {};
  return `<div class="scr">${bar('設定 Settings', 'Field Kit v' + VERSION, 'home')}
    <div class="scroll">
      <label class="fld">你的名字（訪問者）Interviewer<input class="inp" data-bind="cfg.interviewer" value="${h(S.interviewer)}"></label>
      <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:6px">
        <b>連接 Connection</b>
        <span style="font-size:13px;color:var(--muted)">${c.demo ? '示範模式 Demo — 不會上載' : 'Apps Script ' + h(String(c.api || '').replace(/^https:\/\/script\.google\.com\/macros\/s\/(.{6}).*/, '…/s/$1…'))}</span>
        <span style="font-size:13px;color:var(--muted)">${h(netLine())}</span>
        <span style="font-size:13px;color:var(--muted)">資料更新 Lists updated: ${S.cacheAt ? stamp(S.cacheAt).date + ' ' + stamp(S.cacheAt).clock : '—'}</span>
        <span style="font-size:13px;color:var(--muted)" id="storageLine">儲存空間 Storage: …</span>
      </div>
      <button class="btn line" data-a="refreshLists">重新下載資料 Refresh customers &amp; experts</button>
      <button class="btn line" data-a="downloadGallery">下載圖片庫（離線用）Download gallery photos</button>
      <button class="btn line" data-a="syncNow">立即同步 Sync now</button>
      <button class="btn del" data-a="disconnect">${U.confirm ? '確認？未上載嘅資料會留喺手機 · Tap again' : c.demo ? '離開示範 · Leave demo' : '重新連接 Reconnect'}</button>
      <div class="help">提示：用 iPhone「語音備忘錄」錄長訪談。完成後在語音備忘錄按 ⋯ › 儲存到「檔案」，再喺 App 按 錄音 › 加入語音備忘錄檔案。· Long interviews: record in Voice Memos, then Save to Files and add it here.</div>
    </div></div>`;
}

// ============================================================ SHEETS
function vSheet() {
  const s = sess();
  const n = '<span data-now></span>';
  const title = (zh, sub) => `<div class="st"><b>${zh}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
  const cancel = '<button class="btn gray" data-a="closeSheet">取消 Cancel</button>';
  switch (U.sheet) {
    case 'remark': return title('快速備註 Quick remark', '一按即記下日期時間 · One tap stamps date &amp; time (' + n + ')') +
      `<div class="grid2">${REMARKS.map((r) => `<button class="rmk" data-a="remark" data-v="${r[0]}"><b>${r[1]}</b><span>${r[2]}</span></button>`).join('')}</div>
      <label class="fld" style="font-size:13px;color:var(--ink)">加一句 Add a line（可選，可用語音輸入）<input class="inp" data-bind="f.text" value="${h(U.f.text || '')}" placeholder="例：2號機突然起泡，師傅即刻查回墨管"></label>` + cancel;
    case 'measure': return title('量度數據 Measurement', n) +
      `<div class="grid2">${MEASURES.map((m) => `<label class="fld">${m[1]}<span style="display:flex;border:1px solid #c7ced6;border-radius:10px;overflow:hidden;background:#fff"><input data-bind="f.${m[0]}" inputmode="decimal" value="${h(U.f[m[0]] || '')}" placeholder="${m[2]}" style="flex:1;min-width:0;height:46px;border:0;padding:0 10px">${m[3] ? `<span style="padding:0 10px;font-size:12px;color:var(--muted);background:#f4f1ea;display:flex;align-items:center">${m[3]}</span>` : ''}</span></label>`).join('')}</div>
      <button class="btn" data-a="saveMeasure">儲存 Save</button>` + cancel;
    case 'photo': {
      const f = U.f;
      return title('相片 Photo', '拍攝時間（手機時間）Taken ' + stamp(f.takenAt).date + ' ' + stamp(f.takenAt).clock) +
        `<div class="prev" style="height:210px">${f.url ? `<img src="${f.url}" alt="">` : '處理中…'}</div>
        <div class="h">缺陷類型 Defect</div><div class="chips">${DEFECTS.map((d) => `<button class="chip ${f.defect === d ? 'on' : ''}" data-a="fSet" data-v="defect:${d}">${d}</button>`).join('')}</div>
        ${f.defect === '其他' ? `<label class="fld">其他缺陷 Describe the defect<input class="inp" data-bind="f.defectOther" value="${h(f.defectOther || '')}" placeholder="例：套印不準、刀線爆裂"></label>` : ''}
        <label class="fld" style="font-size:13px;color:var(--ink)">承印物 Substrate<input class="inp" data-bind="f.substrate" value="${h(f.substrate || '')}" placeholder="例：牛皮紙 170g、塗佈白卡 350g、BOPP 20µ"></label>
        <label class="fld" style="font-size:13px;color:var(--ink)">說明 Caption（可選）<input class="inp" data-bind="f.caption" value="${h(f.caption || '')}" placeholder="例：2號機，車速 180"></label>
        <button class="btn" data-a="savePhoto" data-v="next">儲存並再影一張 Save &amp; next photo</button>
        <div class="grid2"><button class="btn line" data-a="savePhoto">儲存 Save</button><button class="btn gray" data-a="retakeLib">改用相簿 Library</button></div>` + cancel;
    }
    case 'note': {
      const k = U.f.noteKind || 'obs';
      return title('筆記 Note', '儲存時自動記錄日期時間 · Saved with date &amp; time (' + n + ')') +
        `<div class="seg" style="grid-template-columns:repeat(3,1fr)">${[['obs', '觀察'], ['gap', '追問→GAPS'], ['todo', '待辦']].map((x) => `<button class="${k === x[0] ? 'on' : ''}" data-a="fSet" data-v="noteKind:${x[0]}">${x[1]}</button>`).join('')}</div>
        <div style="font-size:12px;color:var(--muted)">${{ obs: '觀察 Observation → 訪談筆記 session notes', gap: '追問 Follow-up question → GAPS（下次訪談議程）', todo: '待辦 To-do → 只給你自己 for you only' }[k]}</div>
        <label class="fld" style="font-size:13px;color:var(--ink)">內容 Text（按鍵盤咪高峰可語音輸入）<textarea class="inp" data-bind="f.text" placeholder="例：回墨管要壓低 3–5 cm">${h(U.f.text || '')}</textarea></label>
        <button class="btn" data-a="saveNote">儲存 Save</button>` + cancel;
    }
    case 'case': return title('真實問題 Real problem', n + ' · 存入 CASES，用來證明成效') +
      CASEF.map((c) => `<label class="fld">${c[1]}<input class="inp" data-bind="f.${c[0]}" ${c[0] === 'minutes' ? 'inputmode="numeric"' : ''} value="${h(U.f[c[0]] || '')}" placeholder="${h(c[2])}"></label>`).join('') +
      '<button class="btn" data-a="saveCase">儲存個案 Save case</button>' + cancel;
    case 'audio': {
      const r = U.rec;
      return title('錄音 Audio') +
        `<button data-a="pickMemo" style="min-height:72px;border-radius:14px;border:1px solid #1f3a5f;background:#fff;text-align:left;padding:12px 14px;display:flex;flex-direction:column;gap:2px"><b style="font-size:16px;color:#1f3a5f">加入「語音備忘錄」錄音 Add Voice Memos file</b>
          <span style="font-size:12px;color:var(--muted)">先喺語音備忘錄按 ⋯ › 儲存到「檔案」，再喺呢度揀。大檔案會分段上載。</span></button>
        <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:10px;align-items:stretch">
          <b>App 內錄音 Record in the app <span style="font-weight:400;color:var(--muted);font-size:12px">（最長 60 分鐘 · 約 15 MB／小時）</span></b>
          <span style="font-size:12px;color:var(--muted)">每 30 秒自動保存；上載後自動從手機刪除。錄音時保持 App 開住、唔好鎖機。長訪談用語音備忘錄最穩陣。</span>
          <button class="rec-btn ${r ? 'on' : ''}" data-a="recNote">${r ? '停止 Stop<br><span data-recclock style="font-size:14px">' + fmt((Date.now() - r.start) / 1000) + '</span>' : '錄音 Record'}</button>
        </div>` + cancel;
    }
    case 'edit': {
      const e = U.edit, it = s && s.items.find((i) => i.uid === e.uid);
      if (!it) return cancel;
      const x2 = stamp(it.at);
      const textKind = TEXT_KINDS.indexOf(e.kind) >= 0;
      return title('修改 Edit', '記錄於 Recorded ' + x2.date + ' ' + x2.clock + (it.rec ? ' · ' + h(it.rec) : '')) +
        (it.kind === 'photo' ? `<div class="prev" style="height:140px">${U.urls[it.blobKey] ? `<img src="${U.urls[it.blobKey]}" alt="">` : '[相片]'}</div>
          <div class="h">缺陷類型 Defect</div><div class="chips">${DEFECTS.map((d) => `<button class="chip ${e.defect === d ? 'on' : ''}" data-a="eSet" data-v="defect:${d}">${d}</button>`).join('')}</div>
          ${e.defect === '其他' ? `<label class="fld">其他缺陷<input class="inp" data-bind="e.defectOther" value="${h(e.defectOther || '')}"></label>` : ''}
          <label class="fld">承印物 Substrate<input class="inp" data-bind="e.substrate" value="${h(e.substrate || '')}"></label>
          <label class="fld">說明 Caption<input class="inp" data-bind="e.caption" value="${h(e.caption || '')}"></label>` : '') +
        (textKind ? `<div class="h">類別 Category</div><div class="chips">${KINDS.map((k) => `<button class="chip sm ${e.kind === k[0] ? 'on' : ''}" data-a="eSet" data-v="kind:${k[0]}">${k[1]}</button>`).join('')}</div>` : '') +
        (it.kind === 'case' ? CASEF.map((c) => `<label class="fld">${c[1]}<input class="inp" data-bind="e.fields.${c[0]}" value="${h((e.fields || {})[c[0]] || '')}"></label>`).join('') : '') +
        (it.kind !== 'switch' ? `<div class="h">主題 Topic</div><div class="chips">${s.topics.map((t) => `<button class="chip sm ${e.topic === t ? 'on' : ''}" data-a="eSet" data-v="topic:${h(t)}">${h(t)}</button>`).join('')}</div>` : '') +
        (it.kind !== 'photo' && it.kind !== 'case' ? `<label class="fld" style="font-size:13px;color:var(--ink)">內容 Text<textarea class="inp" data-bind="e.text">${h(e.text || '')}</textarea></label>` : '') +
        `<button class="btn" data-a="saveEdit">儲存修改 Save changes</button><button class="btn del ${e.confirm ? 'on' : ''}" data-a="deleteItem">${e.confirm ? '確認刪除？再按一次 Tap again' : '刪除 Delete'}</button>` + cancel;
    }
    case 'newExpert': return title('新專家 New expert', '存入 EXPERTS，之後要簽同意書') +
      `<label class="fld">姓名 Full name *<input class="inp" data-bind="f.nxName" value="${h(U.f.nxName || '')}" placeholder="例：李志強"></label>
      <label class="fld">稱呼 How he is called<input class="inp" data-bind="f.nxShort" value="${h(U.f.nxShort || '')}" placeholder="例：李師傅"></label>
      <div class="grid2"><label class="fld">職位 Role<input class="inp" data-bind="f.nxRole" value="${h(U.f.nxRole || '')}" placeholder="例：印刷主管"></label>
      <label class="fld">年資 Years<input class="inp" data-bind="f.nxYears" inputmode="numeric" value="${h(U.f.nxYears || '')}" placeholder="例：25"></label></div>
      <label class="fld">電話／LINE／WhatsApp（可選）<input class="inp" type="tel" data-bind="f.nxPhone" value="${h(U.f.nxPhone || '')}"></label>
      <button class="btn" data-a="saveNewExpert">儲存並簽同意書 Save &amp; go to consent</button>` + cancel;
    case 'newTopic': {
      const have = S.ui.screen === 'new' ? U.f.topics : s ? s.topics : [];
      return title('新主題 New topic', S.ui.screen === 'session' ? '加入後即成為「而家講緊」' : '') +
        `<div class="chips">${SUGGEST.filter((t) => have.indexOf(t) < 0).map((t) => `<button class="chip" data-a="addTopic" data-v="${h(t)}">${h(t)}</button>`).join('')}</div>
        <label class="fld">或自己輸入 Or type one<input class="inp" data-bind="f.newTopic" value="${h(U.f.newTopic || '')}" placeholder="例：套印不準、刀版爆線"></label>
        <button class="btn" data-a="addTopic">加入 Add topic</button>` + cancel;
    }
    case 'sessMenu': {
      const m = S.sessions[U.menu]; if (!m) return cancel;
      const x = expert(m.expertKey), cnt = liveItems(m).filter((i) => i.kind !== 'switch').length;
      return title(h((m.sid || '未上載') + ' · ' + (x ? x.short : '')), h(m.date) + ' · ' + cnt + ' 項記錄 items') +
        `<button class="rmk" data-a="menuEdit" style="background:#fff"><b>修改資料 Edit details</b><span>專家、類型、主題、語言、日期、地點</span></button>
        <label class="fld">改期 Reschedule<input class="inp" type="date" data-bind="m.date" value="${h(m.date)}"></label>
        <button class="rmk" data-a="menuCancel" style="background:#fdf3e2;border-color:#c9892b"><b style="color:#7a4608">${m.cancelled ? '恢復訪談 Restore session' : '取消訪談 Cancel session'}</b><span style="color:#7a4608">記錄會保留，只標示為已取消</span></button>
        <button class="rmk" data-a="menuDelete" style="${cnt ? 'background:#f4f1ea;color:#9aa4b0' : U.confirm ? 'background:#b0463a;color:#fff;border:0' : 'background:#fff;color:#b0463a;border-color:#b0463a'}">
          <b>${cnt ? '不能刪除 Can’t delete' : U.confirm ? '確認刪除？再按一次' : '刪除訪談 Delete session'}</b><span style="color:inherit">${cnt ? '已有 ' + cnt + ' 項記錄，只可「取消」' : '未有任何記錄，可以刪除'}</span></button>` + cancel;
    }
    case 'gallery': {
      const g = galleryFor(s);
      const list = g.list.filter((x) => U.gal === 'all' || x.defect === U.gal);
      list.forEach((x) => x.key && ensureUrl(x.key, x.file));
      return title('俾師傅睇 Show him a photo', '揀一張全螢幕顯示；會記低幾時睇咗邊張') +
        `<div class="hs" style="gap:6px">${['all'].concat(Object.keys(g.counts)).map((d) => `<button class="chip sm ${U.gal === d ? 'on' : ''}" data-a="galFilter" data-v="${h(d)}">${d === 'all' ? '全部' : h(d) + ' ' + g.counts[d]}</button>`).join('')}</div>
        ${list.length ? `<div class="grid3">${list.map((x) => `<button class="tile" data-a="showOpen" data-v="${h(x.id)}" style="background:${tone(x.defect + x.n)}">${x.key && U.urls[x.key] ? `<img src="${U.urls[x.key]}" alt="">` : ''}<span class="src">${h(x.src)}</span><span style="display:flex;flex-direction:column"><b>${h(x.defect)} #${x.n}</b><span>${h(x.note)}</span></span></button>`).join('')}</div>`
          : '<div class="help">未有相片。喺 Drive 嘅 Realynx Relay/fieldkit-gallery/<缺陷名>/ 放示例相，或者先影相。</div>'}` + cancel;
    }
    case 'prompts': {
      const t = s.current || '呢個問題', miss = missingOf(s, s.current), got = AREAS.filter((a) => covOf(s, s.current)[a[0]]);
      const q = (a, txt, strong) => { const tx = txt.split('{t}').join(t); return `<button class="pq ${strong ? 'strong' : ''}" data-a="askPrompt" data-v="${h((a ? a[0] : '') + '|' + tx)}"><span>${h(tx)}</span><i>${a ? a[1] : '故事'}</i></button>`; };
      const head = (x) => `<div class="lbl" style="padding-top:6px">${x}</div>`;
      return title('提示問題 · ' + h(t), '師傅唔出聲時用。按一下會記低你問咗。') +
        (miss.length ? head('未問到 NOT YET ASKED') + miss.map((a) => PROMPTS[a[0]].map((x) => q(a, x, true)).join('')).join('') : '') +
        head('打開話匣子 GET HIM TALKING') + PROMPTS.story.map((x) => q(null, x, false)).join('') +
        (got.length ? head('已問到 ALREADY COVERED') + got.map((a) => q(a, PROMPTS[a[0]][0], false)).join('') : '') + cancel;
    }
  }
  return cancel;
}

// ============================================================ after render hooks
function after() {
  if (S.ui.screen === 'consent' && !U.sheet) initSig();
  if (S.ui.screen === 'settings' && navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => {
    const el = document.getElementById('storageLine'); if (el) el.textContent = '儲存空間 Storage: 已用 ' + mb(e.usage || 0) + (e.quota ? ' / 可用約 ' + mb(e.quota) : '');
  });
  wake(['session', 'quiet', 'show'].indexOf(S.ui.screen) >= 0);
}
let wl = null;
async function wake(on) {
  try {
    if (on && !wl && 'wakeLock' in navigator && document.visibilityState === 'visible') { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); }
    if (!on && wl) { wl.release(); wl = null; }
  } catch (e) { wl = null; }
}

// image object URLs (photos taken here, or gallery photos downloaded from Drive)
const imgQueue = [];
let imgBusy = false;
function ensureUrl(key, remoteFile) {
  if (!key || U.urls[key] !== undefined) return;
  U.urls[key] = null;
  getBlob(key).then((b) => {
    if (b) { U.urls[key] = URL.createObjectURL(b); renderSoon(); return; }
    if (remoteFile && canSync()) { imgQueue.push([key, remoteFile]); pumpImages(); } else delete U.urls[key];
  }).catch(() => { delete U.urls[key]; });
}
async function pumpImages() {
  if (imgBusy) return; imgBusy = true;
  while (imgQueue.length) {
    const [key, file] = imgQueue.shift();
    try {
      const r = await api('getImage', { file }, 60000);
      const bin = atob(r.data), buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const blob = new Blob([buf], { type: r.mime || 'image/jpeg' });
      await putBlob(key, blob);
      U.urls[key] = URL.createObjectURL(blob); renderSoon();
    } catch (e) { delete U.urls[key]; }
  }
  imgBusy = false;
}

// ============================================================ actions
function newSessionForm(cid) {
  const c = cid || (S.cache.customers[0] && S.cache.customers[0].id) || '';
  const exs = allExperts().filter((x) => x.cid === c);
  return { editKey: null, cid: c, expertKey: exs[0] ? exs[0].key : '', type: 'elicitation', lang: 'yue', topics: [], date: today(), location: '' };
}
function createSession(f) {
  const key = uid();
  S.sessions[key] = { key, sid: null, cid: f.cid, expertKey: f.expertKey, type: f.type, lang: f.lang, topics: f.topics.slice(), current: f.topics[0] || '',
    date: f.date || today(), location: f.location || '', items: [], cov: {}, timer: { acc: 0, running: false, startedAt: 0 }, preflight: [false, false, false, false],
    filter: 'all', closing: '', finished: false, cancelled: false, deleted: false, metaDirty: true, createdAt: Date.now(), changedAt: Date.now(), syncedAt: 0 };
  return key;
}
function add(o, msg, silent) {
  const s = sess(), now = o.at || Date.now(), secs = secsOf(s);
  const it = Object.assign({ uid: uid(), at: now, date: iso(now), topic: s.current || '', rec: secs > 0 ? '約 ' + fmt(secs) : '', secs: Math.floor(secs) }, o);
  s.items.unshift(it);
  U.sheet = null;
  touch(s);
  if (!silent) toast(msg || '已記錄 Saved');
  render();
  return it;
}
function setCov(s, t, area, on) { s.cov = s.cov || {}; s.cov[t] = Object.assign({}, s.cov[t] || {}, { [area]: on }); touch(s); }
function switchTopic(t, silent) {
  const s = sess(); if (!t || t === s.current) return;
  const now = Date.now(), secs = secsOf(s);
  s.items.unshift({ uid: uid(), kind: 'switch', tag: '轉', title: '轉話題 → ' + t, text: s.current ? '由「' + s.current + '」轉到「' + t + '」' : '', topic: t, at: now, date: iso(now), rec: secs > 0 ? '約 ' + fmt(secs) : '', secs: Math.floor(secs) });
  s.current = t; touch(s);
  if (!silent) toast('而家講緊：' + t);
}
function startTimer(s) { if (!s.timer.running) { s.timer.running = true; s.timer.startedAt = Date.now(); if (!s.timer.firstStart) { s.timer.firstStart = iso(Date.now()); s.timer.firstStartMs = Date.now(); } } }
function stopTimer(s) { if (s.timer.running) { s.timer.acc += (Date.now() - s.timer.startedAt) / 1000; s.timer.running = false; } }
let qT = null;
function flashQuiet(w, msg) { U.quietHit = w; U.quietMsg = msg; render(); clearTimeout(qT); qT = setTimeout(() => { U.quietHit = ''; U.quietMsg = ''; render(); }, 1400); }
function logShow(g) { add({ kind: 'show', tag: '示', title: '給師傅看：' + g.defect + ' #' + g.n, text: g.src + ' · ' + g.note, photoRef: g.file || g.key || g.id }, '', true); }
async function shrink(file, max = 2000, q = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Cannot read photo')); i.src = url; });
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return await new Promise((res) => cv.toBlob((b) => res(b || file), 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
let fileTarget = null;
function pick(input, target) { fileTarget = target; const el = document.getElementById(input); el.value = ''; el.click(); }

async function finishRecording(recovered) {
  const ra = S.recActive; if (!ra) return;
  const parts = [];
  for (let i = 0; i < ra.n; i++) { const b = await getBlob('rp:' + ra.id + ':' + i); if (b) parts.push(b); }
  S.recActive = null;
  const s = S.sessions[ra.sessKey];
  if (parts.length && s) {
    const blob = new Blob(parts, { type: ra.mime }), key = 'au:' + ra.id, secs = (recovered ? 30 * parts.length : (Date.now() - ra.start) / 1000);
    await putBlob(key, blob);
    const sec0 = s.timer && s.timer.firstStartMs ? (ra.start - s.timer.firstStartMs) / 1000 : 0;
    s.items.unshift({ uid: uid(), kind: 'audio', sub: 'note', tag: 'AU', title: recovered ? '語音筆記（中斷後救回）' : '語音筆記 Voice note',
      text: (recovered ? '約 ' : '') + fmt(secs).replace(/^00:/, '') + ' · ' + mb(blob.size), blobKey: key, blobDone: false, size: blob.size, mime: blob.type,
      ext: /webm/.test(blob.type) ? 'webm' : 'm4a', at: ra.start, date: iso(ra.start), topic: s.current || '', rec: sec0 > 0 ? '約 ' + fmt(sec0) : '' });
    touch(s); toast(recovered ? '已救回上次未完成的錄音' : '錄音已儲存 Saved');
  }
  for (let i = 0; i < ra.n; i++) DB.del('blobs', 'rp:' + ra.id + ':' + i).catch(() => {});
  save(true);
}

const A = {
  go(v) { S.ui.screen = v; U.sheet = null; U.confirm = false; save(); render(); },
  reload() { location.reload(); },
  closeSheet() { if (U.rec) return toast('請先停止錄音 Stop the recording first'); U.sheet = null; U.confirm = false; render(); },
  sheet(v) { U.sheet = v; U.f = Object.assign({}, U.f, { text: '' }); if (v === 'note') U.f.noteKind = U.f.noteKind || 'obs'; render(); },

  // setup
  async copyCode(v) { try { await navigator.clipboard.writeText(v); toast('已複製 Copied — 而家加至主畫面'); } catch (e) { U.f.code = v; toast('請長按連接碼複製'); } },
  async pasteCode() { try { U.f.code = await navigator.clipboard.readText(); U.setupErr = ''; render(); } catch (e) { toast('請長按輸入框，揀「貼上」'); } },
  async connect(v) {
    let cfg;
    try { cfg = parseCode(v || U.f.code); } catch (e) { U.setupErr = '連接碼唔啱，請再複製一次。· That code is not valid.'; return render(); }
    U.busy = '連接中… Connecting'; U.setupErr = ''; render();
    try {
      const prev = S.config; S.config = cfg;
      await api('ping', {});
      await bootstrap();
      U.busy = ''; history.replaceState(null, '', location.pathname); S.ui.screen = 'home'; save(true); render(); toast('已連接 Connected');
      if (prev && prev.demo) toast('已連接。示範資料仍在手機，可刪除。');
      sync();
    } catch (e) { S.config = null; U.busy = ''; U.setupErr = (e.code === 'auth' ? '連接碼已失效，請在 Sheet 重新產生。' : '連接唔到：') + (e.message || e); render(); }
  },
  demo() { S.config = { demo: true }; S.cache = JSON.parse(JSON.stringify(DEMO)); S.cacheAt = Date.now(); S.ui.screen = 'home'; save(true); render(); toast('示範模式 Demo — 唔會上載'); },
  disconnect() {
    if (!U.confirm) { U.confirm = true; return render(); }
    U.confirm = false;
    if (S.config && S.config.demo) { S = DEFAULT(); } else S.config = null;
    save(true); render();
  },

  // home
  newSession() { U.f = newSessionForm(); S.ui.screen = 'new'; render(); },
  openSession(k) {
    if (k.indexOf('R:') === 0) { // planned in the Sheet: make a local copy linked to it
      const r = S.cache.sessions.find((x) => 'R:' + x.id === k); if (!r) return;
      const key = createSession({ cid: r.cid, expertKey: r.expert, type: r.type, lang: r.lang, topics: r.topics || [], date: r.date, location: r.location });
      Object.assign(S.sessions[key], { sid: r.id, metaDirty: false }); k = key;
    }
    S.ui.active = k; const s = sess();
    if (!s.finished && !s.timer.acc && !s.timer.running) {
      if (!hasConsent(s.expertKey)) { U.f = Object.assign(newSessionForm(s.cid), { editKey: null, cid: s.cid, expertKey: s.expertKey, type: s.type, lang: s.lang, topics: s.topics.slice(), date: s.date, location: s.location, startKey: k }); S.ui.screen = 'new'; }
      else S.ui.screen = 'preflight';
    } else S.ui.screen = s.finished ? 'finish' : 'session';
    save(); render();
  },
  sessMenu(k) { U.menu = k; U.confirm = false; U.sheet = 'sessMenu'; render(); },
  menuEdit() {
    const m = S.sessions[U.menu], x = expert(m.expertKey);
    U.f = { editKey: m.key, editLabel: (m.sid || '') + ' · ' + (x ? x.short : ''), cid: m.cid, expertKey: m.expertKey, type: m.type, lang: m.lang, topics: m.topics.slice(), date: m.date, location: m.location };
    U.sheet = null; S.ui.screen = 'new'; render();
  },
  menuCancel() { const m = S.sessions[U.menu]; m.cancelled = !m.cancelled; m.metaDirty = true; touch(m); U.sheet = null; render(); toast(m.cancelled ? '已取消（記錄保留）Cancelled' : '已恢復 Restored'); },
  menuDelete() {
    const m = S.sessions[U.menu]; if (liveItems(m).some((i) => i.kind !== 'switch')) return toast('有記錄的訪談只可取消 Use Cancel');
    if (!U.confirm) { U.confirm = true; return render(); }
    U.confirm = false; m.deleted = true; m.cancelled = true; m.metaDirty = !!m.sid; touch(m); U.sheet = null; render(); toast('已刪除 Deleted');
  },

  // new session form
  fCust(v) { U.f.cid = v; const exs = allExperts().filter((x) => x.cid === v); U.f.expertKey = exs[0] ? exs[0].key : ''; render(); },
  fExpert(v) { U.f.expertKey = v; render(); },
  fLang(v) { U.f.lang = v; render(); },
  fTopic(v) { const t = U.f.topics, i = t.indexOf(v); if (i >= 0) t.splice(i, 1); else t.push(v); render(); },
  openNewExpert() { if (!U.f.cid) return toast('請先揀客戶 Pick a customer'); Object.assign(U.f, { nxName: '', nxShort: '', nxRole: '', nxYears: '', nxPhone: '' }); U.sheet = 'newExpert'; render(); },
  saveNewExpert() {
    const f = U.f; if (!String(f.nxName || '').trim()) return toast('請填姓名 Enter a name');
    const x = { uid: uid(), id: null, cid: f.cid, name: f.nxName.trim(), short: (f.nxShort || f.nxName).trim(), role: f.nxRole || '', years: f.nxYears || '', phone: f.nxPhone || '', consent: false };
    S.localExperts.push(x); f.expertKey = x.uid; U.sheet = null; U.sig = []; f.scopes = [true, true, true, true, false]; f.paperKey = null; S.ui.screen = 'consent';
    save(); scheduleSync(); render(); toast('已加入 ' + x.short);
  },
  openNewTopic() { U.f.newTopic = ''; U.sheet = 'newTopic'; render(); },
  addTopic(v) {
    const t = String(v || U.f.newTopic || '').trim(); if (!t) return toast('請輸入主題 Type a topic');
    U.sheet = null;
    if (S.ui.screen === 'new') { if (U.f.topics.indexOf(t) < 0) U.f.topics.push(t); return render(); }
    const s = sess(); if (s.topics.indexOf(t) < 0) s.topics.push(t);
    s.metaDirty = true; switchTopic(t); render();
  },
  goConsent() { U.sig = []; U.f.scopes = [true, true, true, true, false]; U.f.paperKey = null; S.ui.screen = 'consent'; render(); },
  toggleScope(v) { const a = U.f.scopes || [true, true, true, true, false]; a[+v] = !a[+v]; U.f.scopes = a; render(); },
  clearSig() { U.sig = []; render(); },
  paperPhoto() { pick('camIn', 'paper'); },
  async saveConsent() {
    if (!U.sig.length && !U.f.paperKey) return toast('請先簽名 Signature needed');
    const sc = U.f.scopes || [true, true, true, true, false];
    if (!sc[0]) return toast('最少要同意第一項 The first item is required');
    let sigKey = null;
    if (U.sig.length) { const cv = document.getElementById('sig'); const b = await new Promise((r) => cv.toBlob(r, 'image/png')); sigKey = 'sig:' + uid(); await putBlob(sigKey, b); }
    const id = uid();
    S.consents[id] = { id, expertKey: U.f.expertKey, scope: SCOPES.filter((x, i) => sc[i]).map((x) => x[0]), sigKey, paperKey: U.f.paperKey || null, signedAt: iso(Date.now()), done: false };
    S.ui.screen = 'new'; save(); scheduleSync(); render(); toast('同意書已儲存 Consent saved');
  },
  startNew() {
    const f = U.f, ex = expert(f.expertKey);
    if (!f.cid || !ex) return toast('請揀客戶及專家 Pick customer and expert');
    if (!hasConsent(ex.key)) return toast('請先簽同意書 Sign consent first');
    let key = f.startKey;
    if (key && S.sessions[key]) Object.assign(S.sessions[key], { expertKey: f.expertKey, type: f.type, lang: f.lang, topics: f.topics.slice(), current: f.topics[0] || '', date: f.date, location: f.location, metaDirty: true });
    else key = createSession(f);
    S.ui.active = key; S.ui.screen = 'preflight'; touch(S.sessions[key]); render();
  },
  saveForLater() {
    const f = U.f; if (!f.cid || !f.expertKey) return toast('請揀客戶及專家 Pick customer and expert');
    const key = createSession(f); touch(S.sessions[key]); S.ui.screen = 'home'; render(); toast('已建立，會同步到 Sheet · Saved');
  },
  saveDetails() {
    const f = U.f, m = S.sessions[f.editKey]; if (!m) return;
    Object.assign(m, { cid: f.cid, expertKey: f.expertKey, type: f.type, lang: f.lang, topics: uniq(f.topics.concat(liveItems(m).map((i) => i.topic))), date: f.date, location: f.location, metaDirty: true });
    if (m.topics.indexOf(m.current) < 0) m.current = m.topics[0] || '';
    touch(m); S.ui.screen = 'home'; render(); toast('已修改 Updated');
  },

  // pre-flight
  togglePf(v) { const s = sess(); s.preflight[+v] = !s.preflight[+v]; save(); render(); },
  pfStart() { const s = sess(); if (!s.preflight.every(Boolean)) return toast('請先完成檢查，或按「跳過」'); startTimer(s); S.ui.screen = 'session'; touch(s); render(); toast('開始 · 計時已啟動'); },
  pfSkip() { const s = sess(); startTimer(s); S.ui.screen = 'session'; add({ kind: 'todo', tag: 'TD', title: '待辦', text: '開始前檢查已跳過 Pre-flight skipped' }, '已跳過檢查 Skipped'); },

  // session
  mark() { add({ kind: 'mark', tag: 'MK', title: '標記 Mark', text: '' }, '已標記 ' + fmt(secsOf(sess()))); },
  switchTopic(v) { switchTopic(v); render(); },
  filter(v) { sess().filter = v; save(); render(); },
  cov(v) { const s = sess(); if (!s.current) return toast('請先加主題 Add a topic'); const on = !!covOf(s, s.current)[v]; setCov(s, s.current, v, !on);
    toast(s.current + '：' + AREAS.find((a) => a[0] === v)[1] + (on ? ' 取消' : ' 已講 ✓')); render(); },
  quiet() { S.ui.screen = 'quiet'; U.quietHit = ''; U.quietMsg = ''; render(); },
  quietTap(w) {
    const s = sess(), at = fmt(secsOf(s));
    if (w === 'mark') add({ kind: 'mark', tag: 'MK', title: '標記 Mark', text: '靜音模式標記' }, '', true);
    if (w === 'exc') { add({ kind: 'remark', tag: 'RM', title: '重要例外', text: '靜音模式 · 之後聽錄音補充' }, '', true); if (s.current) setCov(s, s.current, 'exc', true); }
    if (w === 'ask') add({ kind: 'gap', tag: 'Q', title: '之後追問 → GAPS', text: '靜音模式 · 約 ' + at }, '', true);
    flashQuiet(w, { mark: '已標記', exc: '已記例外', ask: '已加追問' }[w] + ' ' + at);
  },
  quietTopic(v) { switchTopic(v, true); flashQuiet('', '轉到 ' + v); },
  gallery() { const s = sess(), g = galleryFor(s); U.gal = g.counts[s.current] ? s.current : 'all'; U.sheet = 'gallery'; render(); },
  galFilter(v) { U.gal = v; render(); },
  showOpen(v) {
    const s = sess(), all = galleryFor(s).list, list = all.filter((x) => U.gal === 'all' || x.defect === U.gal);
    U.show = { ids: list.map((x) => x.id), i: Math.max(0, list.findIndex((x) => x.id === v)) };
    const g = list[U.show.i]; S.ui.screen = 'show'; logShow(g);
  },
  showStep(v) {
    const n = U.show.i + Number(v); if (n < 0 || n >= U.show.ids.length) return;
    U.show.i = n; const g = galleryFor(sess()).list.find((x) => x.id === U.show.ids[n]); if (g) logShow(g); else render();
  },
  showDone() { S.ui.screen = 'session'; render(); toast('已記錄給師傅看嘅相 Logged'); },
  prompts() { U.sheet = 'prompts'; render(); },
  askPrompt(v) { const i = v.indexOf('|'), area = v.slice(0, i), txt = v.slice(i + 1), a = AREAS.find((x) => x[0] === area);
    add({ kind: 'prompt', tag: '問', title: '問：' + txt, text: a ? a[1] : '故事' }, a ? '已記下 · 答完記得剔「' + a[1] + '」' : '已記下問題'); },
  remark(v) {
    if (v === 'measure') { U.sheet = 'measure'; return render(); }
    if (v === 'case') { U.sheet = 'case'; return render(); }
    const r = REMARKS.find((x) => x[0] === v), s = sess();
    add({ kind: v === 'ask' ? 'gap' : 'remark', tag: v === 'ask' ? 'Q' : 'RM', title: r[1] + (v === 'ask' ? ' → GAPS' : ''), text: U.f.text || r[2] });
    if (v === 'exception' && s.current) setCov(s, s.current, 'exc', true);
    U.f.text = '';
  },
  saveMeasure() {
    const f = U.f, parts = MEASURES.filter((m) => String(f[m[0]] || '').trim()).map((m) => m[1].split(' ')[0] + ' ' + f[m[0]] + (m[3] ? ' ' + m[3].split(' ')[0] : ''));
    if (!parts.length) return toast('請輸入最少一個數字');
    const values = {}; MEASURES.forEach((m) => { if (String(f[m[0]] || '').trim()) values[m[0]] = f[m[0]]; });
    add({ kind: 'measure', tag: 'ME', title: '量度 Measurement', text: parts.join(' · '), values });
    MEASURES.forEach((m) => { delete U.f[m[0]]; });
  },
  saveCase() {
    const f = U.f, fields = {}; CASEF.forEach((c) => { fields[c[0]] = String(f[c[0]] || '').trim(); });
    if (!fields.symptom && !fields.fix) return toast('請最少填問題或處理');
    add({ kind: 'case', tag: 'CA', title: '真實問題 → CASES', text: [fields.symptom, fields.fix && '→ ' + fields.fix, fields.minutes && fields.minutes + ' 分鐘'].filter(Boolean).join(' '), fields }, '個案已儲存 Case saved');
    CASEF.forEach((c) => { delete U.f[c[0]]; });
  },
  saveNote() {
    const k = U.f.noteKind || 'obs', txt = String(U.f.text || '').trim(); if (!txt) return toast('請輸入內容 Type something');
    add({ kind: { obs: 'note', gap: 'gap', todo: 'todo' }[k], tag: { obs: 'NT', gap: 'Q', todo: 'TD' }[k], title: { obs: '觀察', gap: '追問 → GAPS', todo: '待辦' }[k], text: txt });
  },
  photo() { pick('camIn', 'photo'); },
  retakeLib() { pick('picIn', 'photo'); },
  fSet(v) { const i = v.indexOf(':'); U.f[v.slice(0, i)] = v.slice(i + 1); render(); },
  savePhoto(v) {
    const f = U.f; if (!f.blobKey) return toast('相片處理中… Wait');
    const d = f.defect === '其他' ? (String(f.defectOther || '').trim() || '其他') : f.defect;
    S.lastDefect = f.defect; S.lastSubstrate = f.substrate || '';
    add({ kind: 'photo', tag: 'PH', title: '相片：' + d, defect: d, defectPick: f.defect, substrate: f.substrate || '', caption: f.caption || '',
      text: [f.substrate || '（未填承印物）', f.caption].filter(Boolean).join(' · '), blobKey: f.blobKey, blobDone: false, at: f.takenAt }, '相片已儲存 Photo saved');
    U.urls[f.blobKey] = f.url;
    if (v === 'next') pick('camIn', 'photo');
  },
  pickMemo() { pick('audIn', 'memo'); },
  async recNote() {
    if (U.rec) { U.rec.mr.stop(); return; }
    if (!window.MediaRecorder || !navigator.mediaDevices) return toast('呢部手機唔支援網頁錄音');
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const e = await navigator.storage.estimate();
        if (e.quota && e.quota - e.usage < 50 * 1048576) return toast('手機空間不足，先上載及刪除舊錄音');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const opts = { audioBitsPerSecond: 32000 }; if (type) opts.mimeType = type;
      const mr = new MediaRecorder(stream, opts), id = uid();
      U.rec = { mr, stream, start: Date.now(), id, chain: Promise.resolve() };
      S.recActive = { id, sessKey: S.ui.active, start: Date.now(), mime: mr.mimeType || type || 'audio/mp4', n: 0, size: 0 }; save(true);
      mr.ondataavailable = (e) => {
        if (!e.data || !e.data.size) return;
        const ra = S.recActive, n = ra.n++; ra.size += e.data.size;
        U.rec.chain = U.rec.chain.then(() => putBlob('rp:' + id + ':' + n, e.data)).then(() => save());
      };
      mr.onstop = async () => {
        const r = U.rec; stream.getTracks().forEach((t) => t.stop()); clearInterval(r.iv); clearTimeout(r.max);
        await r.chain; U.rec = null; if (U.sheet === 'audio') U.sheet = null; await finishRecording(false); render();
      };
      mr.start(30000); // a piece every 30 s goes to storage, so a crash loses at most 30 s
      U.rec.iv = setInterval(() => { const el = APP.querySelector('[data-recclock]'); if (el && U.rec) el.textContent = fmt((Date.now() - U.rec.start) / 1000); }, 500);
      U.rec.max = setTimeout(() => { if (U.rec) { U.rec.mr.stop(); toast('已錄滿 60 分鐘，自動停止'); } }, 60 * 60 * 1000);
      render();
    } catch (e) { U.rec = null; S.recActive = null; toast('用唔到咪高峰：' + (e.message || e)); }
  },
  edit(v) {
    const it = sess().items.find((i) => i.uid === v); if (!it) return;
    U.edit = { uid: v, text: it.text || '', kind: it.kind, topic: it.topic, defect: it.defectPick || (DEFECTS.indexOf(it.defect) >= 0 ? it.defect : (it.defect ? '其他' : '')),
      defectOther: DEFECTS.indexOf(it.defect) >= 0 ? '' : it.defect, substrate: it.substrate || '', caption: it.caption || '', fields: Object.assign({}, it.fields || {}), confirm: false };
    U.sheet = 'edit'; render();
  },
  eSet(v) { const i = v.indexOf(':'); U.edit[v.slice(0, i)] = v.slice(i + 1); render(); },
  saveEdit() {
    const s = sess(), e = U.edit, it = s.items.find((i) => i.uid === e.uid); if (!it) return;
    if (it.kind === 'photo') {
      const d = e.defect === '其他' ? (String(e.defectOther || '').trim() || '其他') : e.defect;
      Object.assign(it, { defect: d, defectPick: e.defect, substrate: e.substrate, caption: e.caption, title: '相片：' + d, text: [e.substrate || '（未填承印物）', e.caption].filter(Boolean).join(' · ') });
    } else if (it.kind === 'case') {
      const fl = e.fields; Object.assign(it, { fields: fl, text: [fl.symptom, fl.fix && '→ ' + fl.fix, fl.minutes && fl.minutes + ' 分鐘'].filter(Boolean).join(' ') });
    } else {
      if (TEXT_KINDS.indexOf(e.kind) >= 0 && e.kind !== it.kind) { const k = KINDS.find((x) => x[0] === e.kind); it.kind = k[0]; it.tag = k[3]; it.title = k[2]; }
      it.text = e.text;
    }
    if (it.kind !== 'switch') it.topic = e.topic;
    it.changedAt = Date.now(); U.sheet = null; touch(s); render(); toast('已修改 Updated');
  },
  deleteItem() {
    const s = sess(), e = U.edit; if (!e.confirm) { e.confirm = true; return render(); }
    const it = s.items.find((i) => i.uid === e.uid); it.deleted = true; it.changedAt = Date.now();
    U.sheet = null; touch(s); render(); toast('已刪除 Deleted');
  },
  askMissing() { const s = sess(), t = s.topics.find((x) => missingOf(s, x).length); if (t && t !== s.current) switchTopic(t, true); S.ui.screen = 'session'; U.sheet = 'prompts'; render(); },
  finish() {
    const s = sess(); stopTimer(s); s.finished = true; touch(s);
    S.ui.screen = 'home'; render(); toast(canSync() ? '訪談已完成，上載中… Finished' : '訪談已完成，有網絡時上載');
    sync();
  },

  // uploads / settings
  syncNow() { if (S.config && S.config.demo) return toast('示範模式唔會上載'); if (!navigator.onLine) return toast('未有網絡 Offline'); sync(true); toast('同步中… Syncing'); },
  async refreshLists() { if (!canSync()) return toast(S.config && S.config.demo ? '示範模式' : '未有網絡 Offline'); try { await bootstrap(); render(); toast('已更新 Updated'); } catch (e) { toast('更新失敗：' + e.message); } },
  async downloadGallery() {
    if (!canSync()) return toast(S.config && S.config.demo ? '示範模式冇相片' : '未有網絡 Offline');
    const list = S.cache.gallery.filter((g) => g.file); let n = 0;
    for (const g of list) { const key = 'img:' + g.file; if (!(await getBlob(key))) { imgQueue.push([key, g.file]); n++; } }
    pumpImages(); toast(n ? '下載緊 ' + n + ' 張相… Downloading' : '圖片庫已在手機 Already downloaded');
  }
};

// file inputs
async function onFile(e) {
  const file = e.target.files && e.target.files[0]; const target = fileTarget; fileTarget = null;
  if (!file) return;
  try {
    if (target === 'photo') {
      const taken = file.lastModified && Math.abs(Date.now() - file.lastModified) < 15 * 60 * 1000 ? file.lastModified : Date.now();
      U.f = Object.assign({}, U.f, { blobKey: null, url: null, takenAt: taken, defect: DEFECTS.indexOf(sess().current) >= 0 ? sess().current : (S.lastDefect || '針孔'),
        defectOther: '', substrate: S.lastSubstrate || '', caption: '' });
      U.sheet = 'photo'; render();
      const blob = await shrink(file), key = 'ph:' + uid();
      await putBlob(key, blob);
      U.f.blobKey = key; U.f.url = URL.createObjectURL(blob); render();
    } else if (target === 'paper') {
      const blob = await shrink(file, 2400, 0.85), key = 'paper:' + uid();
      await putBlob(key, blob); U.f.paperKey = key; render(); toast('已影紙本同意書');
    } else if (target === 'memo') {
      toast('儲存錄音中… Saving'); const key = 'au:' + uid();
      await putBlob(key, file);
      const dur = await new Promise((res) => { const a = new Audio(), u = URL.createObjectURL(file); a.preload = 'metadata'; a.onloadedmetadata = () => { res(a.duration); URL.revokeObjectURL(u); }; a.onerror = () => res(0); a.src = u; setTimeout(() => res(0), 4000); });
      const ext = (file.name.match(/\.(\w+)$/) || [, 'm4a'])[1];
      add({ kind: 'audio', sub: 'memo', tag: 'AU', title: '語音備忘錄 ' + file.name.replace(/\.\w+$/, ''), text: (dur && isFinite(dur) ? fmt(dur) + ' · ' : '') + mb(file.size) + ' · 分段上載',
        blobKey: key, blobDone: false, size: file.size, mime: file.type || 'audio/mp4', ext, fileName: file.name }, '已加入錄音，會分段上載');
    }
  } catch (err) { toast('未能儲存：' + (err.message || err) + '（手機空間夠唔夠？）'); }
}
['camIn', 'picIn', 'audIn'].forEach((id) => document.getElementById(id).addEventListener('change', onFile));

// events
APP.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el || !APP.contains(el)) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el.dataset.v, el)).catch((err) => { console.error(err); toast('出錯：' + (err.message || err)); });
});
APP.addEventListener('input', (e) => {
  const b = e.target.dataset && e.target.dataset.bind; if (!b) return;
  const v = e.target.value, parts = b.split('.');
  if (parts[0] === 'f') U.f[parts[1]] = v;
  else if (parts[0] === 'e') { if (parts[1] === 'fields') U.edit.fields[parts[2]] = v; else U.edit[parts[1]] = v; }
  else if (parts[0] === 's') { const s = sess(); s[parts[1]] = v; touch(s); }
  else if (parts[0] === 'm') { const m = S.sessions[U.menu]; m[parts[1]] = v; m.metaDirty = true; touch(m); }
  else if (parts[0] === 'cfg') { S.interviewer = v; save(); }
});

// ============================================================ API + sync
const canSync = () => !!(S.config && !S.config.demo && S.config.api && navigator.onLine);
async function api(op, args, timeout = 45000) {
  if (!S.config || S.config.demo) throw new Error('demo');
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), timeout);
  let r;
  try { r = await fetch(S.config.api + '?fk=1', { method: 'POST', body: JSON.stringify({ token: S.config.token, op, args }), signal: ctrl.signal, redirect: 'follow' }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? '逾時 timeout' : '網絡 network'); }
  finally { clearTimeout(t); }
  let j; try { j = await r.json(); } catch (e) { throw new Error('伺服器回覆不正確 (' + r.status + ')。Apps Script 有冇部署新版本？'); }
  if (!j.ok) { const err = new Error(j.message || j.error); err.code = j.error; throw err; }
  return j.data;
}
async function bootstrap() {
  const d = await api('bootstrap', {});
  S.cache = { customers: d.customers, experts: d.experts, sessions: d.sessions, gallery: d.gallery, chunk: d.chunk || 5 * 1024 * 1024 };
  S.cacheAt = Date.now(); save();
}
let syncT = null, syncing = false, again = false;
function scheduleSync() { clearTimeout(syncT); syncT = setTimeout(() => sync(), 1500); }
function setNet(n, msg) { U.net = n; U.netMsg = msg || ''; if (['home', 'uploads', 'settings'].indexOf(S.ui.screen) >= 0 && !U.sheet) renderSoon(); }
async function sync(withLists) {
  if (!canSync()) { if (S.config && !S.config.demo) setNet(navigator.onLine ? U.net : 'offline'); return; }
  if (syncing) { again = true; return; }
  syncing = true; setNet('syncing');
  try {
    if (withLists || Date.now() - S.cacheAt > 10 * 60 * 1000) await bootstrap();
    await syncExperts();
    for (const s of Object.values(S.sessions)) await syncSession(s);
    S.lastSync = Date.now(); setNet('ok');
  } catch (e) {
    console.warn('sync', e); setNet('error', e.message || String(e));
    if (e.code === 'auth') toast('連接碼已失效 — 設定 › 重新連接');
  } finally {
    syncing = false; save();
    if (S.ui.screen === 'session' && !U.sheet) renderSoon();
    if (again) { again = false; setTimeout(() => sync(), 800); }
  }
}
async function syncExperts() {
  for (const x of S.localExperts) {
    if (x.id) continue;
    const r = await api('saveExpert', { uid: x.uid, customer_id: x.cid, name: x.name, short: x.short, role: x.role, years: x.years, phone: x.phone });
    x.id = r.expert_id;
    Object.values(S.sessions).forEach((s) => { if (s.expertKey === x.uid) { s.expertKey = x.id; s.metaDirty = true; } });
    Object.values(S.consents).forEach((c) => { if (c.expertKey === x.uid) c.expertKey = x.id; });
    save();
  }
  for (const c of Object.values(S.consents)) {
    if (c.done) continue;
    const x = expert(c.expertKey); if (!x || !x.id) continue;
    const sig = c.sigKey && await getBlob(c.sigKey), paper = c.paperKey && await getBlob(c.paperKey);
    await api('saveConsent', { expert_id: x.id, scope: c.scope, signed_at: c.signedAt, signature: sig ? await blobToDataUrl(sig) : '', paper: paper ? await blobToDataUrl(paper) : '' }, 90000);
    c.done = true; c.expertKey = x.id;
    const cx = S.cache.experts.find((y) => y.id === x.id); if (cx) cx.consent = true;
    save();
  }
}
async function syncSession(s) {
  const x = expert(s.expertKey);
  if (!x || !x.id) return; // expert not on the server yet
  if (s.deleted && !s.metaDirty) return;
  if (!s.sid || s.metaDirty) {
    const r = await api('saveSession', { uid: s.key, session_id: s.sid, customer_id: s.cid, expert_id: x.id, date: s.date, location: s.location, language: s.lang,
      session_type: s.type, topics: s.topics, interviewer: S.interviewer, cancelled: !!s.cancelled });
    s.sid = r.session_id; s.metaDirty = false; save(); renderSoon();
  }
  if (s.deleted) return;
  for (const it of s.items) {
    if (!it.blobKey || it.blobDone || it.deleted) continue;
    if (it.kind === 'photo') {
      const b = await getBlob(it.blobKey); if (!b) { it.blobDone = true; continue; }
      await api('uploadPhoto', { session_id: s.sid, uid: it.uid, data: await blobToDataUrl(b), item: { defect: it.defect, substrate: it.substrate, caption: it.caption, topic: it.topic, rec: it.rec, date: it.date } }, 120000);
      it.blobDone = true; save(); renderSoon();
    } else if (it.kind === 'audio') await uploadAudio(s, it);
  }
  const changed = s.changedAt || 0;
  if (changed > (s.syncedAt || 0)) {
    const items = s.items.map((i) => { const o = Object.assign({}, i); delete o.progress; return o; });
    await api('syncTimeline', { session_id: s.sid, items, topics: s.topics, coverage: s.cov, closing: s.closing, finished: s.finished, cancelled: s.cancelled,
      preflight: s.preflight, timer: { started_at: s.timer.firstStart || '', secs: Math.round(secsOf(s)) } }, 90000);
    s.syncedAt = changed; save(); renderSoon();
  }
}
async function uploadAudio(s, it) {
  const b = await getBlob(it.blobKey); if (!b) { it.blobDone = true; return; }
  const name = s.sid + ' ' + (it.sub === 'memo' ? '語音備忘錄 ' + (it.fileName || 'recording.m4a') : '語音筆記 ' + stamp(it.at).date + ' ' + stamp(it.at).clock.replace(/:/g, '') + '.' + (it.ext || 'm4a'));
  let st = await api('audioStart', { session_id: s.sid, uid: it.uid, name, size: b.size, mime: it.mime || b.type || 'audio/mp4', kind: it.sub || 'note' });
  const CH = S.cache.chunk || 5 * 1024 * 1024;
  for (let guard = 0; guard < 2000; guard++) {
    if (st.done) { it.blobDone = true; it.progress = 1; it.freed = true; await DB.del('blobs', it.blobKey).catch(() => {}); save(); renderSoon(); return; }
    if (st.offset < 0) { st = await api('audioStart', { session_id: s.sid, uid: it.uid, name, size: b.size, mime: it.mime || b.type, kind: it.sub || 'note' }); continue; }
    it.progress = st.offset / b.size; renderSoon();
    const data = await blobToB64(b.slice(st.offset, st.offset + CH));
    st = await api('audioChunk', { uid: it.uid, offset: st.offset, data }, 180000);
  }
}
window.addEventListener('online', () => { setNet('idle'); sync(); });
window.addEventListener('offline', () => setNet('offline'));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save(true);
  else { tick(); sync(); after(); }
});
setInterval(() => sync(), 60 * 1000);

// ============================================================ start
(async function start() {
  try {
    const saved = await DB.get('kv', 'state');
    if (saved) S = Object.assign(DEFAULT(), saved);
  } catch (e) { console.error(e); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const code = (location.hash.match(/#c=([A-Za-z0-9_-]+)/) || [])[1];
  if (code && S.config && !S.config.demo && isStandalone()) history.replaceState(null, '', location.pathname);
  if (S.ui.screen === 'quiet' || S.ui.screen === 'show') S.ui.screen = 'session';
  if (!S.config && code && isStandalone()) { U.f.code = code; }
  if (S.recActive) await finishRecording(true);
  render();
  sync();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { U.swUpdate = true; if (S.ui.screen === 'home') render(); } }); });
    }).catch(() => {});
  }
})();
