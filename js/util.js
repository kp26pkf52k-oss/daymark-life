/* DAYMARK LIFE — 共通ユーティリティ
 * 日付はすべて "YYYY-MM-DD" 文字列で扱い、「今日」は日本時間（Asia/Tokyo）で決める。
 * 日付の加減算は UTC の Date で行うため、端末のタイムゾーン設定に左右されない。
 */
window.DM = window.DM || {};
window.DM.views = {};   // 画面の登録先（各 views/*.js が追加する）
window.DM.actions = {}; // data-act="名前" のボタンが押されたときの処理
(function (DM) {
  const TZ = 'Asia/Tokyo';
  const pad = (n) => String(n).padStart(2, '0');

  function nowParts() {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const o = {};
    for (const p of f.formatToParts(new Date())) o[p.type] = p.value;
    return o;
  }
  const today = () => { const p = nowParts(); return `${p.year}-${p.month}-${p.day}`; };
  const nowHM = () => { const p = nowParts(); return `${p.hour}:${p.minute}`; };
  const nowISO = () => new Date().toISOString();

  const toUTC = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fromUTC = (dt) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  const addDays = (s, n) => { const d = toUTC(s); d.setUTCDate(d.getUTCDate() + n); return fromUTC(d); };
  const diffDays = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 864e5); // b - a
  const dow = (s) => toUTC(s).getUTCDay(); // 0=日
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  // 週は月曜はじまり
  const weekStart = (s) => addDays(s, -((dow(s) + 6) % 7));
  const weekDays = (s) => { const st = weekStart(s); return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(st, i)); };
  // ISO週番号（"2026-W43"）
  function weekKey(s) {
    const d = toUTC(s);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const wk = 1 + Math.round(((d - firstThu) / 864e5 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
    return `${d.getUTCFullYear()}-W${pad(wk)}`;
  }
  const monthKey = (s) => s.slice(0, 7);
  const monthStart = (s) => s.slice(0, 7) + '-01';
  const monthDays = (s) => {
    const st = monthStart(s); const out = [];
    for (let d = st; d.slice(0, 7) === st.slice(0, 7); d = addDays(d, 1)) out.push(d);
    return out;
  };
  const addMonths = (s, n) => {
    const [y, m] = s.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return fromUTC(d);
  };
  const range = (from, to) => { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; };

  const fmtDate = (s, opt = {}) => {
    if (!isDate(s)) return '';
    const [y, m, d] = s.split('-').map(Number);
    const base = `${m}月${d}日（${WD[dow(s)]}）`;
    return opt.year ? `${y}年${base}` : base;
  };
  const fmtShort = (s) => { const [, m, d] = s.split('-').map(Number); return `${m}/${d}`; };
  const fmtMin = (min) => {
    min = Math.round(min || 0);
    if (min < 60) return `${min}分`;
    const h = Math.floor(min / 60), m = min % 60;
    return m ? `${h}時間${m}分` : `${h}時間`;
  };
  const fmtH = (min) => (Math.round((min || 0) / 6) / 10).toFixed(1); // 時間（小数1桁）

  const hmToMin = (hm) => { if (!hm || !/^\d{1,2}:\d{2}$/.test(hm)) return null; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const minToHM = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  // 開始〜終了の分数（日をまたぐ場合は翌日として計算）
  const spanMin = (a, b) => { const x = hmToMin(a), y = hmToMin(b); if (x == null || y == null) return null; let d = y - x; if (d <= 0) d += 1440; return d; };

  const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0);
  const mean = (a) => (a.length ? sum(a) / a.length : null);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const wordCount = (t) => (String(t || '').match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
  const groupBy = (arr, fn) => { const m = {}; for (const x of arr) { const k = fn(x); (m[k] = m[k] || []).push(x); } return m; };

  // Spearman の順位相関（同順位は平均順位）
  function rank(a) {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(a.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  }
  function pearson(x, y) {
    const n = x.length; if (n < 3) return null;
    const mx = mean(x), my = mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
    if (!sxx || !syy) return null;
    return sxy / Math.sqrt(sxx * syy);
  }
  const spearman = (x, y) => pearson(rank(x), rank(y));

  Object.assign(DM, {
    TZ, pad, today, nowHM, nowISO, addDays, diffDays, dow, WD, isDate, weekStart, weekDays, weekKey,
    monthKey, monthStart, monthDays, addMonths, range, fmtDate, fmtShort, fmtMin, fmtH, hmToMin, minToHM, spanMin,
    uid, esc, nl2br, sum, mean, clamp, wordCount, groupBy, spearman,
  });
})(window.DM);
