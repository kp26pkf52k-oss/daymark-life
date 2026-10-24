/* 設定・データ：項目のカスタマイズ、バックアップ（書き出し/読み込み）、復元、アプリ情報 ／ メニュー */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;
  const S = () => DM.store.data.settings;

  const LISTS = [
    ['researchKinds', '研究の作業の種類'],
    ['englishSkills', '英語の技能'],
    ['englishScenes', '英語の学習場面'],
    ['exerciseTypes', '運動の種目'],
  ];
  const EXTRA_COLORS = [['#008300', '#008300'], ['#6250d6', '#9085e9'], ['#e34948', '#e66767']];
  const CORE = ['research', 'english', 'exercise', 'life', 'rest'];

  function listEditor(key, label) {
    const list = S()[key];
    return `<details class="set-block"><summary>${label}<span class="f-hint">${list.length}項目</span></summary>
      <ul class="edit-list">${list.map((x, i) => `<li><span>${esc(x)}</span>
        <button type="button" class="icon-btn sm" data-act="listMove" data-key="${key}" data-i="${i}" data-d="-1" aria-label="上へ" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-btn sm" data-act="listRename" data-key="${key}" data-i="${i}" aria-label="名前を変更">✎</button>
        <button type="button" class="icon-btn sm" data-act="listDel" data-key="${key}" data-i="${i}" aria-label="削除">✕</button></li>`).join('')}</ul>
      <div class="add-row"><input type="text" placeholder="追加する項目" data-add="${key}" aria-label="${label}に追加"><button type="button" class="btn small" data-act="listAdd" data-key="${key}">追加</button></div>
      <p class="f-hint">名前を変えたり削除したりしても、過去の記録に保存された名前はそのまま残ります。</p></details>`;
  }

  function storageInfo() {
    const kb = Math.round(DM.store.usageBytes() / 1024);
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    return `<ul class="plain">
      <li>保存場所：この端末・このブラウザの中（localStorage）。外部のサーバーには送信していません。</li>
      <li>使用量：約 ${kb} KB（ブラウザの上限はおおむね数MB）</li>
      <li>起動方法：${standalone ? 'ホーム画面から起動中' : 'ブラウザで表示中'}${DM.persisted ? '・永続保存が許可されています' : ''}</li>
      <li>別の端末・別のブラウザとは自動では同期されません。移すときは「書き出し」→「読み込み」を使います。</li>
    </ul>`;
  }

  DM.views.settings = {
    title: '設定・データ',
    render() {
      const s = S();
      const snaps = DM.store.snapshots();
      let hasBefore = false; try { hasBefore = !!localStorage.getItem('daymark.beforeImport'); } catch { /* ignore */ }
      return `
      <div class="grid-2">
      <section class="card">
        <h2>バックアップ</h2>
        <p class="muted">${s.lastBackupAt ? `最後に書き出した日時：${DM.fmtDate(s.lastBackupAt.slice(0, 10), { year: true })}` : 'まだ書き出していません。'}</p>
        <div class="btn-row">
          <button type="button" class="btn primary" data-act="exportJSON">データを書き出す（JSON）</button>
          <label class="btn">読み込む<input type="file" accept="application/json,.json" data-act-change="importFile" hidden></label>
        </div>
        <details><summary>研究用にCSVで書き出す</summary><div class="btn-row">
          <button type="button" class="btn small" data-act="exportCSV" data-k="logs">時間記録</button>
          <button type="button" class="btn small" data-act="exportCSV" data-k="conditions">コンディション</button>
          <button type="button" class="btn small" data-act="exportCSV" data-k="days">日ごとの振り返り</button></div>
          <p class="f-hint">CSVは分析ソフトで読むためのもので、読み込み（復元）には使えません。復元にはJSONを使います。</p></details>
        <p class="f-hint">iPhoneでは書き出したファイルが「ファイル」アプリの「ダウンロード」に保存されます。iCloud Driveなどにも置いておくと安心です。目安として週に1回の書き出しをおすすめします。</p>
      </section>
      <section class="card">
        <h2>保存について</h2>
        ${storageInfo()}
        <div class="notice">iPhoneのSafariでは、ホーム画面に追加していないサイトの保存データが、しばらく（7日程度）そのサイトを開かないと削除されることがあります（WebKitの仕様）。「共有」→「ホーム画面に追加」から起動し、定期的に書き出してください。</div>
      </section>
      </div>

      <div class="grid-2">
      <section class="card">
        <h2>復元</h2>
        ${snaps.length ? `<p class="f-hint">1日1回、自動で控えを残しています（直近3日分）。誤って消したときに使えます。</p>
          <ul class="edit-list">${snaps.map((x, i) => `<li><span>${DM.fmtDate(x.date)} の控え</span><button type="button" class="btn small" data-act="restoreSnap" data-i="${i}">この時点に戻す</button></li>`).join('')}</ul>` : '<p class="muted">自動の控えはまだありません。</p>'}
        ${hasBefore ? `<div class="btn-row"><button type="button" class="btn small" data-act="undoImport">直前の読み込み・初期化を取り消す</button></div>` : ''}
      </section>
      <section class="card">
        <h2>表示</h2>
        ${DM.seg('theme', [['auto', '端末に合わせる'], ['light', 'ライト'], ['dark', 'ダーク']], s.theme || 'auto').replace(/data-seg="theme"/g, 'data-act="setTheme"').replace(/role="tab"/g, '')}
        <h3 class="sub-h">ホームに表示する1週間の目安</h3>
        <div class="fields">
          <div class="field half"><label class="f-label" for="wt_r">研究（時間）</label><input id="wt_r" type="number" min="0" step="0.5" inputmode="decimal" value="${s.weeklyTargets.research ? s.weeklyTargets.research / 60 : ''}" data-act-change="wt" data-k="research"></div>
          <div class="field half"><label class="f-label" for="wt_e">英語（時間）</label><input id="wt_e" type="number" min="0" step="0.5" inputmode="decimal" value="${s.weeklyTargets.english ? s.weeklyTargets.english / 60 : ''}" data-act-change="wt" data-k="english"></div>
          <div class="field half"><label class="f-label" for="wt_x">運動（回）</label><input id="wt_x" type="number" min="0" step="1" inputmode="numeric" value="${s.weeklyTargets.exerciseCount || ''}" data-act-change="wt" data-k="exerciseCount"></div>
        </div>
        <p class="f-hint">空欄にすると目安を表示しません。達成を判定する目標は「目標・習慣」で設定します。</p>
        <h3 class="sub-h">会話練習のリンク先</h3>
        <input type="url" value="${esc(s.chatgptUrl || '')}" data-act-change="gptUrl" aria-label="会話練習のリンク先">
      </section>
      </div>

      <section class="card">
        <h2>項目のカスタマイズ</h2>
        <details class="set-block" open><summary>カテゴリー<span class="f-hint">${s.categories.length}項目</span></summary>
          <ul class="edit-list">${s.categories.map((c) => `<li>${DM.catDot(c.id)}<span>${esc(c.name)}</span>
            <button type="button" class="icon-btn sm" data-act="catRename" data-id="${c.id}" aria-label="名前を変更">✎</button>
            ${CORE.includes(c.id) ? '' : `<button type="button" class="icon-btn sm" data-act="catDel" data-id="${c.id}" aria-label="削除">✕</button>`}</li>`).join('')}</ul>
          ${s.categories.length < 8 ? '<div class="btn-row"><button type="button" class="btn small" data-act="catAdd">＋ カテゴリーを追加</button></div>' : ''}
          <p class="f-hint">研究・英語・運動・私生活・休息は各ページの集計に使うため削除できません（名前は変更できます）。追加は「授業・TA」「アルバイト」など最大8つまで。</p></details>
        <details class="set-block"><summary>生活習慣<span class="f-hint">${s.habits.filter((h) => h.active).length}項目</span></summary>
          <ul class="edit-list">${s.habits.map((h) => `<li class="${h.active ? '' : 'off'}"><span>${esc(h.name)}${h.active ? '' : '（停止中）'}</span>
            <button type="button" class="icon-btn sm" data-act="habitRename" data-id="${h.id}" aria-label="名前を変更">✎</button>
            <button type="button" class="btn small ghost" data-act="habitToggle" data-id="${h.id}">${h.active ? '停止' : '再開'}</button></li>`).join('')}</ul>
          <div class="add-row"><input type="text" placeholder="例：23時までに寝る" data-add="habits" aria-label="習慣を追加"><button type="button" class="btn small" data-act="habitAdd">追加</button></div>
          <p class="f-hint">停止した習慣は過去の記録を残したまま、入力欄から外れます。</p></details>
        ${LISTS.map(([k, l]) => listEditor(k, l)).join('')}
      </section>

      <section class="card">
        <h2>アプリについて</h2>
        <ul class="plain">
          <li>DAYMARK LIFE バージョン ${DM.store.APP_VERSION}（データ形式 ${DM.store.SCHEMA}）</li>
          <li>アカウント登録・外部API・広告・解析ツールは使っていません。</li>
        </ul>
        <div class="btn-row">
          <button type="button" class="btn small" data-act="checkUpdate">${DM.updateReady ? '新しいバージョンに更新' : '更新を確認'}</button>
          <button type="button" class="btn small danger ghost" data-act="resetAll">すべてのデータを削除</button>
        </div>
      </section>`;
    },
  };

  // ---------- 書き出し・読み込み ----------
  const stamp = () => DM.today().replace(/-/g, '');
  DM.actions.exportJSON = () => {
    DM.store.commit((d) => { d.settings.lastBackupAt = DM.nowISO(); });
    DM.download(`daymark-life-backup-${stamp()}.json`, DM.store.exportJSON());
    DM.toast('書き出しました');
  };
  const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const toCSV = (head, rows) => '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  DM.actions.exportCSV = (el) => {
    const d = DM.store.data;
    let csv;
    if (el.dataset.k === 'logs') {
      csv = toCSV(['date', 'category', 'minutes', 'start', 'project', 'research_kind', 'output', 'english_skill', 'english_scene', 'exercise_type', 'rpe', 'session_load_au', 'from_event', 'note'],
        d.logs.slice().sort((a, b) => a.date.localeCompare(b.date)).map((l) => [l.date, M.cat(l.cat).name, l.minutes, l.start, (M.project(l.projectId) || {}).name, l.sub, l.output, l.skill, l.scene, l.exType, l.rpe, M.sessionLoad(l), l.eventId ? 1 : 0, l.note]));
    } else if (el.dataset.k === 'conditions') {
      csv = toCSV(['date', ...M.COND.map((k) => k.key), 'bed', 'wake', 'sleep_min', 'recorded_at', 'note'],
        Object.entries(d.conditions).sort().map(([k, c]) => [k, ...M.COND.map((x) => c[x.key]), c.bed, c.wake, M.sleepMin(c), c.recordedAt, c.note]));
    } else {
      csv = toCSV(['date', 'score', 'rest_day', ...S().habits.map((h) => 'habit:' + h.name), 'good', 'improve', 'diary'],
        Object.entries(d.days).sort().map(([k, x]) => [k, x.score, x.restDay ? 1 : 0, ...S().habits.map((h) => (x.habits && x.habits[h.id] ? 1 : 0)), x.good, x.improve, x.diary]));
    }
    DM.download(`daymark-${el.dataset.k}-${stamp()}.csv`, csv, 'text/csv');
  };
  document.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-act-change]'); if (!el) return;
    const a = el.dataset.actChange;
    if (a === 'importFile' && el.files[0]) {
      const text = await el.files[0].text();
      el.value = '';
      let d;
      try { d = DM.store.parseImport(text); } catch (err) { return DM.toast('読み込めませんでした：' + err.message, { error: true }); }
      const n = `時間記録 ${d.logs.length}件・予定 ${d.events.length}件・タスク ${d.tasks.length}件・コンディション ${Object.keys(d.conditions).length}日分・英語日記 ${d.enDiary.length}件`;
      if (await DM.confirm(`このファイルの内容で現在のデータを置き換えます。\n\n${n}\n\n現在のデータは「直前の読み込みを取り消す」で一度だけ戻せます。`, { ok: '置き換える', danger: true })) {
        DM.store.importData(d); DM.toast('読み込みました');
      }
    }
    if (a === 'wt') {
      const v = el.value === '' ? null : Number(el.value);
      DM.store.commit((d) => { d.settings.weeklyTargets[el.dataset.k] = v == null ? null : el.dataset.k === 'exerciseCount' ? Math.round(v) : Math.round(v * 60); });
      DM.toast('保存しました');
    }
    if (a === 'gptUrl') {
      if (el.value && !/^https:\/\//.test(el.value)) return DM.toast('https:// から始まるURLを入力してください', { error: true });
      DM.store.commit((d) => { d.settings.chatgptUrl = el.value || 'https://chatgpt.com/'; }); DM.toast('保存しました');
    }
  });
  DM.actions.restoreSnap = async (el) => {
    const snap = DM.store.snapshots()[Number(el.dataset.i)];
    if (!snap || !(await DM.confirm(`${DM.fmtDate(snap.date)} の控えに戻しますか？　それ以降の変更は失われます（現在の状態は「直前の読み込みを取り消す」で戻せます）。`, { danger: true, ok: '戻す' }))) return;
    try { localStorage.setItem('daymark.beforeImport', JSON.stringify(DM.store.data)); } catch { /* ignore */ }
    DM.store.restoreJSON(snap.json); DM.toast('復元しました');
  };
  DM.actions.undoImport = async () => {
    const j = localStorage.getItem('daymark.beforeImport');
    if (!j || !(await DM.confirm('直前の読み込み（または初期化・復元）の前の状態に戻しますか？', { ok: '戻す' }))) return;
    DM.store.restoreJSON(j); localStorage.removeItem('daymark.beforeImport'); DM.toast('戻しました');
  };
  DM.actions.resetAll = async () => {
    if (!(await DM.confirm('すべての記録と設定を削除します。先にバックアップを書き出すことをおすすめします。', { danger: true, ok: '次へ' }))) return;
    if (!(await DM.confirm('本当に削除しますか？', { danger: true, ok: 'すべて削除' }))) return;
    DM.store.resetAll(); DM.toast('削除しました（直前の状態は「復元」から一度だけ戻せます）');
  };
  DM.actions.checkUpdate = async () => {
    if (!('serviceWorker' in navigator)) return DM.toast('このブラウザでは自動更新を使っていません。再読み込みで最新版になります。');
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { location.reload(); return; }
    if (reg.waiting) { reg.waiting.postMessage('SKIP_WAITING'); navigator.serviceWorker.addEventListener('controllerchange', () => location.reload()); return; }
    await reg.update().catch(() => {});
    DM.toast(reg.installing || reg.waiting ? '新しいバージョンを準備中です。もう一度押してください。' : '最新の状態です');
  };

  // ---------- 項目の編集 ----------
  const ask = (title, value = '') => new Promise((resolve) => {
    DM.openForm({ title, values: { v: value }, fields: [{ key: 'v', label: '名前', type: 'text', required: true }], onSave: (x) => { resolve(x.v.trim()); } });
  });
  DM.actions.setTheme = (el) => DM.store.commit((d) => { d.settings.theme = el.dataset.v; });
  DM.actions.listAdd = (el) => {
    const inp = document.querySelector(`[data-add="${el.dataset.key}"]`);
    const v = inp.value.trim(); if (!v) return;
    if (S()[el.dataset.key].includes(v)) return DM.toast('すでにあります', { error: true });
    DM.store.commit((d) => { d.settings[el.dataset.key].push(v); });
  };
  DM.actions.listDel = async (el) => {
    const k = el.dataset.key, i = Number(el.dataset.i);
    if (!(await DM.confirm(`「${S()[k][i]}」を選択肢から外しますか？（過去の記録は残ります）`, { ok: '外す' }))) return;
    DM.store.commit((d) => { d.settings[k].splice(i, 1); });
  };
  DM.actions.listMove = (el) => DM.store.commit((d) => {
    const a = d.settings[el.dataset.key], i = Number(el.dataset.i), j = i + Number(el.dataset.d);
    if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]];
  });
  DM.actions.listRename = async (el) => {
    const k = el.dataset.key, i = Number(el.dataset.i);
    const v = await ask('名前を変更', S()[k][i]);
    if (v) DM.store.commit((d) => { d.settings[k][i] = v; });
  };
  DM.actions.catRename = async (el) => {
    const c = S().categories.find((x) => x.id === el.dataset.id);
    const v = await ask('カテゴリー名を変更', c.name);
    if (v) DM.store.commit((d) => { d.settings.categories.find((x) => x.id === c.id).name = v; });
  };
  DM.actions.catAdd = async () => {
    const v = await ask('カテゴリーを追加');
    if (!v) return;
    DM.store.commit((d) => {
      const used = d.settings.categories.map((c) => c.color);
      const col = EXTRA_COLORS.find(([l]) => !used.includes(l)) || EXTRA_COLORS[0];
      d.settings.categories.push({ id: DM.uid('c_'), name: v, color: col[0], dark: col[1] });
    });
  };
  DM.actions.catDel = async (el) => {
    const id = el.dataset.id, d = DM.store.data;
    const used = d.logs.some((l) => l.cat === id) || d.events.some((e) => e.cat === id) || d.tasks.some((t) => t.cat === id);
    if (used) return DM.toast('このカテゴリーを使った記録があるため削除できません（名前の変更はできます）', { error: true });
    if (await DM.confirm('このカテゴリーを削除しますか？', { danger: true, ok: '削除' })) DM.store.commit((x) => { x.settings.categories = x.settings.categories.filter((c) => c.id !== id); });
  };
  DM.actions.habitAdd = () => {
    const inp = document.querySelector('[data-add="habits"]');
    const v = inp.value.trim(); if (!v) return;
    DM.store.commit((d) => { d.settings.habits.push({ id: DM.uid('h_'), name: v, active: true }); });
  };
  DM.actions.habitRename = async (el) => {
    const h = S().habits.find((x) => x.id === el.dataset.id);
    const v = await ask('習慣の名前を変更', h.name);
    if (v) DM.store.commit((d) => { d.settings.habits.find((x) => x.id === h.id).name = v; });
  };
  DM.actions.habitToggle = (el) => DM.store.commit((d) => { const h = d.settings.habits.find((x) => x.id === el.dataset.id); h.active = !h.active; });

  // ---------- メニュー（スマホ用） ----------
  DM.views.menu = {
    title: 'メニュー',
    render() {
      const desc = { home: '今日の状況', calendar: '日・週・月・タスク・日記', english: '記録・日記・表現・復習・会話練習', research: 'プロジェクト・タスク・研究時間・週の振り返り', condition: '疲労・ストレス・睡眠など', exercise: '種目・時間・RPE', analysis: '推移・内訳・予定と実績・関係の探索', goals: '週間/月間目標・習慣・休息', settings: 'バックアップ・項目の編集' };
      return `<div class="menu-grid">${DM.NAV.map((n) => `<a class="menu-item" href="#/${n.id}">${DM.icon(n.icon)}<b>${n.label}</b><small>${desc[n.id] || ''}</small></a>`).join('')}</div>`;
    },
  };
})(window.DM);
