/* DAYMARK LIFE — 端末間の同期（自分の非公開GitHubリポジトリを保管場所にする）
 * - 同期を設定した端末だけが、自分のGitHubリポジトリの1ファイル（daymark-data.json）を読み書きする。
 * - 統合は記録ごと：両方にある記録は更新日時（_mt）が新しい方、削除は削除の記録（syncMeta.tomb）で反映する。
 * - 合言葉を設定すると、ファイルは端末内で暗号化（AES-GCM、鍵はPBKDF2で生成）してから送る。
 * - トークン・合言葉はこの端末のブラウザにだけ保存し、バックアップ（書き出し）には含めない。
 */
(function (DM) {
  const CFG_KEY = 'daymark.sync';
  const FILE = 'daymark-data.json';
  const API = 'https://api.github.com';
  const ITER = 210000;

  const cfg = () => { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch { return null; } };
  const setCfg = (c) => { try { if (c) localStorage.setItem(CFG_KEY, JSON.stringify(c)); else localStorage.removeItem(CFG_KEY); } catch { /* ignore */ } };
  const state = { running: false, again: false, lastError: '', timer: null };

  // ---------- 統合 ----------
  const mt = (x) => (x && (x._mt || x.updatedAt || x.createdAt || x.recordedAt)) || '';
  function merge(a, b) {
    const S = DM.store;
    const out = JSON.parse(JSON.stringify(a));
    const ta = (a.syncMeta && a.syncMeta.tomb) || {}, tb = (b.syncMeta && b.syncMeta.tomb) || {};
    const tomb = { ...ta };
    for (const [k, v] of Object.entries(tb)) if (!tomb[k] || v > tomb[k]) tomb[k] = v;
    const alive = (key, x) => !tomb[key] || mt(x) > tomb[key];
    for (const k of S.ARRAYS) {
      const map = new Map();
      for (const x of a[k] || []) map.set(x.id, x);
      for (const y of b[k] || []) { const x = map.get(y.id); if (!x || mt(y) > mt(x)) map.set(y.id, y); }
      out[k] = [...map.values()].filter((x) => alive(k + ':' + x.id, x))
        .sort((x, y) => (x.createdAt || '').localeCompare(y.createdAt || '') || String(x.id).localeCompare(String(y.id))); // どの端末でも同じ順序にする
    }
    for (const k of S.MAPS) {
      const o = { ...(a[k] || {}) };
      for (const [key, y] of Object.entries(b[k] || {})) if (!o[key] || mt(y) > mt(o[key])) o[key] = y;
      out[k] = Object.fromEntries(Object.entries(o).filter(([key, x]) => alive(k + ':' + key, x)).sort((x, y) => x[0].localeCompare(y[0])));
    }
    // 再作成された記録の削除記録は消しておく
    for (const key of Object.keys(tomb)) {
      const [k, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      const exists = S.ARRAYS.includes(k) ? out[k].some((x) => x.id === id) : out[k] && id in out[k];
      if (exists) delete tomb[key];
    }
    const sa = (a.syncMeta && a.syncMeta.settingsAt) || '', sb = (b.syncMeta && b.syncMeta.settingsAt) || '';
    if (sb > sa) out.settings = JSON.parse(JSON.stringify(b.settings));
    out.syncMeta = { tomb: Object.fromEntries(Object.entries(tomb).sort((x, y) => x[0].localeCompare(y[0]))), settingsAt: sa > sb ? sa : sb };
    return out;
  }
  DM.syncMerge = merge;
  // 内容の比較用（保存のたびに変わる日時は除く）
  const sig = (d) => JSON.stringify({ ...d, updatedAt: null, createdAt: null });

  // ---------- 暗号化 ----------
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = (bytes) => { let s = ''; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function key(pass, salt) {
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function pack(data, pass) {
    const plain = JSON.stringify({ app: 'DAYMARK LIFE', appVersion: DM.store.APP_VERSION, savedAt: DM.nowISO(), data });
    if (!pass) return plain;
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(pass, salt), te.encode(plain));
    return JSON.stringify({ app: 'DAYMARK LIFE', encrypted: { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations: ITER, salt: b64(salt), iv: b64(iv) }, ciphertext: b64(ct) });
  }
  async function unpack(text, pass) {
    const o = JSON.parse(text);
    if (o.encrypted) {
      if (!pass) throw new Error('同期データは合言葉で暗号化されています。この端末にも同じ合言葉を設定してください。');
      let plain;
      try {
        const k = await key(pass, unb64(o.encrypted.salt));
        plain = td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.encrypted.iv) }, k, unb64(o.ciphertext)));
      } catch { throw new Error('合言葉が違うため、同期データを読めません。'); }
      return JSON.parse(plain).data;
    }
    return o.data || o;
  }

  // ---------- GitHub ----------
  async function gh(c, path, opt = {}) {
    const res = await fetch(`${API}/repos/${c.owner}/${c.repo}${path}`, {
      ...opt,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${c.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opt.headers || {}) },
      cache: 'no-store',
    });
    if (res.status === 401) throw new Error('GitHubのトークンが無効か期限切れです。新しいトークンを設定してください。');
    if (res.status === 403) throw new Error('トークンにこのリポジトリへの書き込み権限がありません（Contents: Read and write が必要）。');
    return res;
  }
  async function readRemote(c) {
    const res = await gh(c, `/contents/${FILE}?ref=${encodeURIComponent(c.branch || 'main')}`);
    if (res.status === 404) {
      const repo = await gh(c, '');
      if (repo.status === 404) throw new Error(`リポジトリ ${c.owner}/${c.repo} が見つかりません（名前の誤り、またはトークンの対象外）。`);
      return { sha: null, data: null };
    }
    if (!res.ok) throw new Error(`同期データを読めませんでした（${res.status}）。`);
    const meta = await res.json();
    let text;
    if (meta.content && meta.encoding === 'base64') text = td.decode(unb64(meta.content.replace(/\n/g, '')));
    else { // 1MBを超えるファイルは blob で取得する
      const r2 = await gh(c, `/git/blobs/${meta.sha}`);
      if (!r2.ok) throw new Error(`同期データを読めませんでした（${r2.status}）。`);
      text = td.decode(unb64((await r2.json()).content.replace(/\n/g, '')));
    }
    let encrypted = false; try { encrypted = !!JSON.parse(text).encrypted; } catch { /* unpack で知らせる */ }
    return { sha: meta.sha, encrypted, data: DM.store.migrate(await unpack(text, c.pass)) };
  }
  async function writeRemote(c, data, sha) {
    const body = { message: `DAYMARK LIFE sync ${DM.nowISO()}`, content: b64(te.encode(await pack(data, c.pass))), branch: c.branch || 'main' };
    if (sha) body.sha = sha;
    const res = await gh(c, `/contents/${FILE}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    if (res.status === 409 || res.status === 422) return false; // 他の端末が先に書き込んだ → 読み直して再統合
    if (!res.ok) throw new Error(`同期データを保存できませんでした（${res.status}）。`);
    return true;
  }

  // ---------- 同期の実行 ----------
  async function syncNow(opt = {}) {
    const c = cfg();
    if (!c || !c.token) return false;
    if (state.running) { state.again = true; return false; }
    if (!navigator.onLine) { state.lastError = 'オフラインのため同期を待っています。'; DM.render && opt.render !== false && DM.render(); return false; }
    state.running = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await readRemote(c);
        const local = JSON.parse(JSON.stringify(DM.store.data));
        const merged = remote.data ? merge(local, remote.data) : local;
        // 内容が同じでも、暗号化の有無を切り替えたときは保存し直す
        const same = remote.data && remote.encrypted === !!c.pass && sig(merged) === sig(merge(remote.data, remote.data));
        if (!same && !(await writeRemote(c, merged, remote.sha))) continue;
        // 通信中にこの端末で記録が増えていれば、それも残す
        const final = merge(JSON.parse(JSON.stringify(DM.store.data)), merged);
        if (JSON.stringify(final) !== JSON.stringify(DM.store.data)) DM.store.replaceMerged(final);
        setCfg({ ...cfg(), lastSync: DM.nowISO() });
        state.lastError = '';
        if (opt.toast) DM.toast('同期しました');
        return true;
      }
      throw new Error('他の端末と同時に書き込みが続いたため、同期を中断しました。少し待ってからもう一度お試しください。');
    } catch (e) {
      state.lastError = e instanceof TypeError ? '通信できませんでした（オフライン、または接続が制限されています）。' : e.message;
      if (opt.toast) DM.toast('同期できませんでした：' + state.lastError, { error: true });
      return false;
    } finally {
      state.running = false;
      if (state.again) { state.again = false; schedule(500); }
    }
  }
  function schedule(ms = 3000) {
    if (!cfg()) return;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => syncNow(), ms);
  }

  DM.sync = {
    config: cfg, setConfig: setCfg, now: syncNow, schedule, state, merge, pack, unpack,
    enabled: () => !!(cfg() && cfg().token),
  };

  // 起動時・画面に戻ったとき・記録したあとに自動で同期する（同期を設定している場合のみ）
  document.addEventListener('DOMContentLoaded', () => {
    let fromSync = false;
    const origReplace = DM.store.replaceMerged;
    DM.store.replaceMerged = (d) => { fromSync = true; try { origReplace(d); } finally { fromSync = false; } };
    DM.store.onChange(() => { if (!fromSync && DM.sync.enabled()) schedule(3000); });
    setTimeout(() => { if (DM.sync.enabled()) syncNow(); }, 300);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && DM.sync.enabled()) syncNow(); });
    window.addEventListener('online', () => { if (DM.sync.enabled()) syncNow(); });
  });
})(window.DM);
