/* DAYMARK LIFE — 記録の入力フォーム（各画面から共通で呼び出す） */
(function (DM) {
  const S = () => DM.store.data.settings;
  const projOpts = () => [{ value: '', label: '（なし）' }, ...DM.store.data.projects.filter((p) => p.status !== 'archived').map((p) => ({ value: p.id, label: p.name }))];

  // ---------- 実施時間の記録（研究・英語・運動・私生活・休息） ----------
  DM.editLog = function (log = {}, preset = {}) {
    const v = { date: DM.today(), cat: 'research', ...preset, ...log };
    const isNew = !log.id;
    DM.openForm({
      title: isNew ? '実施時間を記録' : '記録を編集',
      values: v,
      fields: [
        { key: 'cat', label: 'カテゴリー', type: 'chips', options: DM.catOptions(), required: true },
        { key: 'date', label: '日付', type: 'date', required: true, half: true },
        { key: 'start', label: '開始時刻（任意）', type: 'time', half: true },
        { key: 'minutes', label: '実施時間', type: 'minutes', required: true },
        { key: 'projectId', label: 'プロジェクト', type: 'select', options: projOpts(), show: (x) => x.cat === 'research' },
        { key: 'sub', label: '作業の種類', type: 'chips', options: S().researchKinds, allowEmpty: true, show: (x) => x.cat === 'research' },
        { key: 'output', label: '成果・進んだこと（任意）', type: 'text', placeholder: '例：結果の図を3枚作成／方法を1ページ執筆', show: (x) => x.cat === 'research',
          hint: '時間だけでなく「何が進んだか」を残すと、週の振り返りで成果につながったかを確認できます。' },
        { key: 'skill', label: '技能', type: 'chips', options: S().englishSkills, allowEmpty: true, show: (x) => x.cat === 'english' },
        { key: 'scene', label: '場面', type: 'chips', options: S().englishScenes, allowEmpty: true, show: (x) => x.cat === 'english' },
        { key: 'exType', label: '種目', type: 'chips', options: S().exerciseTypes, allowEmpty: true, show: (x) => x.cat === 'exercise' },
        { key: 'rpe', label: '主観的運動強度（RPE, CR-10）', type: 'rpe', show: (x) => x.cat === 'exercise',
          hint: '運動全体を振り返って「どのくらいきつかったか」を0〜10で。セッションRPE法を提案した Foster et al.（2001）では運動終了の約30分後に評価しています。' },
        { key: 'note', label: 'メモ（任意）', type: 'textarea', rows: 2 },
      ],
      onSave: (x) => {
        if (!(x.minutes > 0)) return '実施時間を1分以上で入力してください';
        if (x.minutes > 1440) return '1回の記録は24時間（1440分）以内にしてください';
        const item = { id: log.id || DM.uid('l_'), date: x.date, cat: x.cat, minutes: Math.round(x.minutes), start: x.start || '', note: x.note || '' };
        if (x.cat === 'research') Object.assign(item, { projectId: x.projectId || '', sub: x.sub || '', output: x.output || '' });
        if (x.cat === 'english') Object.assign(item, { skill: x.skill || '', scene: x.scene || '' });
        if (x.cat === 'exercise') Object.assign(item, { exType: x.exType || '', rpe: x.rpe === '' || x.rpe == null ? null : Number(x.rpe) });
        if (log.eventId) item.eventId = log.eventId;
        if (log.id) {
          // カテゴリーが変わった時に古いカテゴリー固有の項目を残さない
          DM.store.commit((d) => { const i = d.logs.findIndex((l) => l.id === log.id); d.logs[i] = { createdAt: d.logs[i].createdAt, ...item, updatedAt: DM.nowISO() }; });
        } else DM.store.upsert('logs', item);
        DM.toast(isNew ? '記録しました' : '更新しました');
      },
      onDelete: isNew ? null : () => {
        const before = DM.store.remove('logs', log.id);
        if (log.eventId) DM.store.commit((d) => { const e = d.events.find((x) => x.id === log.eventId); if (e) { e.logId = ''; e.status = ''; } });
        DM.toast('削除しました', { undo: () => DM.store.restoreJSON(before) });
      },
    });
  };

  // ---------- 予定（計画と実績） ----------
  DM.editEvent = function (ev = {}, preset = {}) {
    const linked = ev.logId ? DM.store.data.logs.find((l) => l.id === ev.logId) : null;
    const v = { date: DM.today(), cat: 'research', ...preset, ...ev, actualMin: linked ? linked.minutes : null };
    const isNew = !ev.id;
    DM.openForm({
      title: isNew ? '予定を追加' : '予定を編集',
      values: v,
      fields: [
        { key: 'title', label: '予定', type: 'text', required: true, placeholder: '例：データ解析、英会話、ジム' },
        { key: 'cat', label: 'カテゴリー', type: 'chips', options: DM.catOptions(), required: true },
        { key: 'date', label: '日付', type: 'date', required: true },
        { key: 'start', label: '開始', type: 'time', half: true, required: true },
        { key: 'end', label: '終了', type: 'time', half: true, required: true },
        { key: 'projectId', label: 'プロジェクト', type: 'select', options: projOpts(), show: (x) => x.cat === 'research' },
        { key: 'note', label: 'メモ（任意）', type: 'textarea', rows: 2 },
        { key: 'h_actual', type: 'html', html: '<div class="f-section">実際どうだったか（あとで記入）</div>' },
        { key: 'status', label: '実施状況', type: 'chips', allowEmpty: true, options: [{ value: 'done', label: '実施した' }, { value: 'partial', label: '一部実施' }, { value: 'cancel', label: '実施しなかった' }] },
        { key: 'actualMin', label: '実際に取り組んだ時間', type: 'minutes', show: (x) => x.status === 'done' || x.status === 'partial',
          hint: '入力すると、この予定の実績として時間記録に反映されます（二重に記録しないよう注意）。' },
      ],
      onInput: (x, form) => {
        // 「実施した」を選んだら予定時間を初期値に入れる
        const am = form.querySelector('[data-key="actualMin"]');
        if (x.status === 'done' && am && am.value === '' && x.start && x.end) am.value = DM.spanMin(x.start, x.end) || '';
      },
      onSave: (x) => {
        if (DM.spanMin(x.start, x.end) == null) return '開始・終了時刻を入力してください';
        const id = ev.id || DM.uid('e_');
        const wantLog = (x.status === 'done' || x.status === 'partial') && x.actualMin > 0;
        DM.store.commit((d) => {
          let e = d.events.find((y) => y.id === id);
          if (!e) { e = { id, createdAt: DM.nowISO() }; d.events.push(e); }
          Object.assign(e, { title: x.title.trim(), cat: x.cat, date: x.date, start: x.start, end: x.end, projectId: x.cat === 'research' ? x.projectId || '' : '', note: x.note || '', status: x.status || '', updatedAt: DM.nowISO() });
          const li = e.logId ? d.logs.findIndex((l) => l.id === e.logId) : -1;
          if (wantLog) {
            const base = li >= 0 ? d.logs[li] : { id: DM.uid('l_'), createdAt: DM.nowISO() };
            const log = { ...base, date: x.date, cat: x.cat, minutes: Math.round(x.actualMin), start: x.start, eventId: id, note: base.note || x.title.trim(), projectId: x.cat === 'research' ? x.projectId || '' : base.projectId };
            if (li >= 0) d.logs[li] = log; else d.logs.push(log);
            e.logId = log.id;
          } else if (li >= 0) { d.logs.splice(li, 1); e.logId = ''; }
        });
        DM.toast(isNew ? '予定を追加しました' : '更新しました');
      },
      onDelete: isNew ? null : () => {
        const before = JSON.stringify(DM.store.data);
        DM.store.commit((d) => { d.events = d.events.filter((y) => y.id !== ev.id); d.logs = d.logs.filter((l) => l.eventId !== ev.id); });
        DM.toast('予定を削除しました', { undo: () => DM.store.restoreJSON(before) });
      },
      deleteMessage: 'この予定を削除しますか？（この予定から記録した実績時間も削除されます）',
    });
  };

  // ---------- タスク ----------
  DM.editTask = function (t = {}, preset = {}) {
    const v = { cat: 'research', priority: 'mid', ...preset, ...t };
    const isNew = !t.id;
    DM.openForm({
      title: isNew ? 'タスクを追加' : 'タスクを編集',
      values: v,
      fields: [
        { key: 'title', label: 'タスク', type: 'text', required: true, placeholder: '例：Study1 の統計解析を回す' },
        { key: 'cat', label: 'カテゴリー', type: 'chips', options: DM.catOptions(), required: true },
        { key: 'priority', label: '優先度', type: 'chips', options: [{ value: 'high', label: '高' }, { value: 'mid', label: '中' }, { value: 'low', label: '低' }] },
        { key: 'date', label: '実施予定日（任意）', type: 'date', half: true },
        { key: 'due', label: '期限（任意）', type: 'date', half: true },
        { key: 'projectId', label: 'プロジェクト', type: 'select', options: projOpts(), show: (x) => x.cat === 'research' },
        { key: 'kind', label: '種類', type: 'chips', options: S().researchKinds, allowEmpty: true, show: (x) => x.cat === 'research' },
        { key: 'estMin', label: '見込み時間（任意）', type: 'minutes' },
        { key: 'note', label: 'メモ（任意）', type: 'textarea', rows: 2 },
      ],
      onSave: (x) => {
        DM.store.upsert('tasks', { id: t.id || DM.uid('t_'), title: x.title.trim(), cat: x.cat, priority: x.priority || 'mid', date: x.date || '', due: x.due || '',
          projectId: x.cat === 'research' ? x.projectId || '' : '', kind: x.cat === 'research' ? x.kind || '' : '', estMin: x.estMin || null, note: x.note || '', done: !!t.done });
        DM.toast(isNew ? 'タスクを追加しました' : '更新しました');
      },
      onDelete: isNew ? null : () => DM.removeWithUndo('tasks', t.id),
    });
  };
  DM.toggleTask = function (id) {
    DM.store.commit((d) => {
      const t = d.tasks.find((x) => x.id === id); if (!t) return;
      t.done = !t.done;
      t.doneAt = t.done ? DM.nowISO() : '';
      t.doneAtDate = t.done ? DM.today() : '';
    });
  };
  DM.taskRow = function (t, opt = {}) {
    const p = t.projectId && DM.model.project(t.projectId);
    const overdue = !t.done && t.due && t.due < DM.today();
    const meta = [
      `<span class="pri pri-${t.priority || 'mid'}">${DM.model.PRI[t.priority || 'mid'].label}</span>`,
      opt.hideCat ? '' : `${DM.catDot(t.cat)}${DM.esc(DM.model.cat(t.cat).name)}`,
      p ? DM.esc(p.name) : '', t.kind ? DM.esc(t.kind) : '',
      t.due ? `<span class="${overdue ? 'warn' : ''}">期限 ${DM.fmtShort(t.due)}${overdue ? '（超過）' : ''}</span>` : '',
      t.date && !opt.hideDate ? `予定 ${DM.fmtShort(t.date)}` : '',
    ].filter(Boolean).join('<span class="sep">·</span>');
    return `<div class="task ${t.done ? 'done' : ''}">
      <button type="button" class="checkbox ${t.done ? 'on' : ''}" data-act="toggleTask" data-id="${t.id}" aria-label="${t.done ? '未完了に戻す' : '完了にする'}" aria-pressed="${t.done}"></button>
      <button type="button" class="task-main" data-act="editTask" data-id="${t.id}"><span class="task-title">${DM.esc(t.title)}</span><span class="meta">${meta}</span></button>
    </div>`;
  };

  // ---------- コンディション ----------
  DM.editCondition = function (date = DM.today()) {
    const c = DM.store.data.conditions[date] || {};
    const sm = DM.model.sleepMin(c);
    DM.openForm({
      title: `コンディション　${DM.fmtDate(date)}`,
      values: { ...c, date },
      fields: [
        { key: 'date', label: '日付', type: 'date', required: true },
        { key: 'h1', type: 'html', html: `<div class="f-note">いまの状態に最も近い位置にスライダーを動かしてください。触れていない項目は「未入力」のまま保存され、グラフにも表示されません。毎日ほぼ同じ時間帯に記録すると比較しやすくなります。</div>` },
        ...DM.model.COND.map((k) => ({ key: k.key, label: k.label, type: 'vas', lo: k.lo, hi: k.hi })),
        { key: 'h2', type: 'html', html: '<div class="f-section">睡眠（昨夜）</div>' },
        { key: 'bed', label: '就寝時刻', type: 'time', half: true },
        { key: 'wake', label: '起床時刻', type: 'time', half: true },
        { key: 'sleepMin', label: '睡眠時間（分）※時刻が分からない場合のみ', type: 'number', min: 0, max: 1440, step: 5, show: (x) => !(x.bed && x.wake),
          placeholder: sm ? String(sm) : '例：420' },
        { key: 'h3', type: 'html', html: '<div class="f-hint" data-sleepcalc></div>' },
        { key: 'note', label: 'メモ（任意）', type: 'textarea', rows: 2, placeholder: '例：寝つきが悪かった、昨日の練習で脚が張っている' },
      ],
      onInput: (x, form) => {
        const el = form.querySelector('[data-sleepcalc]');
        if (el) el.textContent = x.bed && x.wake ? `睡眠時間（就寝〜起床）：${DM.fmtMin(DM.spanMin(x.bed, x.wake))}` : '';
      },
      onSave: (x) => {
        const rec = { recordedAt: DM.nowISO(), recordedHM: DM.nowHM() };
        let any = false;
        for (const k of DM.model.COND) { if (x[k.key] !== '' && x[k.key] != null) { rec[k.key] = Number(x[k.key]); any = true; } }
        if (x.bed && x.wake) { rec.bed = x.bed; rec.wake = x.wake; any = true; }
        else if (x.sleepMin != null) { rec.sleepMin = Number(x.sleepMin); any = true; }
        if (x.note) { rec.note = x.note; any = true; }
        if (!any) return '1項目以上入力してください';
        DM.store.commit((d) => { if (x.date !== date) delete d.conditions[date]; d.conditions[x.date] = rec; });
        DM.toast('コンディションを保存しました');
      },
      onDelete: DM.store.data.conditions[date] ? () => {
        const before = JSON.stringify(DM.store.data);
        DM.store.commit((d) => { delete d.conditions[date]; });
        DM.toast('削除しました', { undo: () => DM.store.restoreJSON(before) });
      } : null,
    });
  };

  // ---------- 1日の振り返り ----------
  DM.editDay = function (date = DM.today()) {
    const day = DM.store.data.days[date] || {};
    const habits = S().habits.filter((h) => h.active || (day.habits && day.habits[h.id]));
    DM.openForm({
      title: `1日の振り返り　${DM.fmtDate(date)}`,
      values: { ...day, ...Object.fromEntries(habits.map((h) => ['hb_' + h.id, !!(day.habits && day.habits[h.id])])) },
      autofocus: false,
      fields: [
        { key: 'score', label: '今日の達成度（自己評価）', type: 'vas', lo: '全く思い通りに過ごせなかった', hi: '完全に思い通りに過ごせた' },
        { key: 'good', label: '良かったこと', type: 'textarea', rows: 2 },
        { key: 'improve', label: '改善したいこと', type: 'textarea', rows: 2 },
        { key: 'diary', label: '日記（出来事・気づき）', type: 'textarea', rows: 4 },
        { key: 'restDay', label: '今日は休息日にした', type: 'check' },
        ...(habits.length ? [{ key: 'hh', type: 'html', html: '<div class="f-section">生活習慣</div>' }] : []),
        ...habits.map((h) => ({ key: 'hb_' + h.id, label: h.name, type: 'check' })),
      ],
      onSave: (x) => {
        const rec = { good: x.good || '', improve: x.improve || '', diary: x.diary || '', restDay: !!x.restDay, score: x.score === '' || x.score == null ? null : Number(x.score), habits: {}, updatedAt: DM.nowISO() };
        for (const h of habits) if (x['hb_' + h.id]) rec.habits[h.id] = true;
        DM.store.commit((d) => { d.days[date] = rec; });
        DM.toast('振り返りを保存しました');
      },
      onDelete: DM.store.data.days[date] ? () => {
        const before = JSON.stringify(DM.store.data);
        DM.store.commit((d) => { delete d.days[date]; });
        DM.toast('削除しました', { undo: () => DM.store.restoreJSON(before) });
      } : null,
    });
  };

  // ---------- 研究プロジェクト ----------
  DM.editProject = function (p = {}) {
    const isNew = !p.id;
    DM.openForm({
      title: isNew ? 'プロジェクトを追加' : 'プロジェクトを編集',
      values: { status: 'active', ...p },
      fields: [
        { key: 'name', label: 'プロジェクト名', type: 'text', required: true, placeholder: '例：研究課題1（連続投球とコンディション変化）' },
        { key: 'goal', label: '目標（何ができたら完了か）', type: 'textarea', rows: 2, placeholder: '例：12月末までに論文初稿を共著者に回す' },
        { key: 'deadline', label: '目標期限（任意）', type: 'date', half: true },
        { key: 'status', label: '状態', type: 'select', half: true, options: [{ value: 'active', label: '進行中' }, { value: 'paused', label: '保留' }, { value: 'done', label: '完了' }, { value: 'archived', label: 'アーカイブ' }] },
        { key: 'progress', label: '進捗（%・任意）', type: 'number', min: 0, max: 100, step: 5,
          hint: '空欄の場合は、このプロジェクトのタスク完了率を進捗として表示します。' },
        { key: 'note', label: 'メモ（任意）', type: 'textarea', rows: 3 },
      ],
      onSave: (x) => {
        if (x.progress != null && (x.progress < 0 || x.progress > 100)) return '進捗は0〜100で入力してください';
        DM.store.upsert('projects', { id: p.id || DM.uid('p_'), name: x.name.trim(), goal: x.goal || '', deadline: x.deadline || '', status: x.status, progress: x.progress, note: x.note || '' });
        DM.toast(isNew ? 'プロジェクトを追加しました' : '更新しました');
      },
      onDelete: isNew ? null : () => {
        const before = JSON.stringify(DM.store.data);
        DM.store.commit((d) => { d.projects = d.projects.filter((y) => y.id !== p.id); });
        DM.toast('削除しました（タスクと時間記録は残ります）', { undo: () => DM.store.restoreJSON(before) });
      },
      deleteMessage: 'このプロジェクトを削除しますか？　紐づくタスクと時間記録は削除されず「プロジェクトなし」になります。',
    });
  };

  // ---------- 目標 ----------
  DM.editGoal = function (g = {}, preset = {}) {
    const isNew = !g.id;
    const v = { period: 'week', key: DM.weekKey(DM.today()), metric: 'manual', ...preset, ...g };
    DM.openForm({
      title: isNew ? '目標を追加' : '目標を編集',
      values: v,
      fields: [
        { key: 'period', label: '期間', type: 'chips', options: [{ value: 'week', label: '週間' }, { value: 'month', label: '月間' }] },
        { key: 'key', type: 'hidden' },
        { key: 'title', label: '目標', type: 'text', required: true, placeholder: '例：研究に20時間取り組む／方法の章を書き上げる' },
        { key: 'metric', label: '達成の判定方法', type: 'select', options: Object.entries(DM.model.METRICS).map(([k, m]) => ({ value: k, label: m.label })),
          hint: '「手動でチェック」以外を選ぶと、記録から自動で達成度を計算します。' },
        { key: 'target', label: '目標値', type: 'number', min: 0, step: 1, show: (x) => x.metric !== 'manual' },
      ],
      onInput: (x, form) => {
        const hid = form.querySelector('[data-key="key"]');
        if (x.period === 'week' && !/W/.test(hid.value)) hid.value = DM.weekKey(DM.today());
        if (x.period === 'month' && /W/.test(hid.value)) hid.value = DM.monthKey(DM.today());
      },
      onSave: (x) => {
        if (x.metric !== 'manual' && !(x.target > 0)) return '目標値を入力してください';
        DM.store.upsert('goals', { id: g.id || DM.uid('g_'), period: x.period, key: x.key, title: x.title.trim(), metric: x.metric, target: x.metric === 'manual' ? null : x.target, manualDone: !!g.manualDone });
        DM.toast(isNew ? '目標を追加しました' : '更新しました');
      },
      onDelete: isNew ? null : () => DM.removeWithUndo('goals', g.id),
    });
  };
  DM.goalRow = function (g) {
    const pr = DM.model.goalProgress(g);
    const m = DM.model.METRICS[g.metric] || DM.model.METRICS.manual;
    const val = g.metric === 'manual' ? (pr.done ? '達成' : '未達成') : `${g.metric.endsWith('_min') ? DM.fmtMin(pr.value) : pr.value + m.unit} / ${g.metric.endsWith('_min') ? DM.fmtMin(pr.target) : pr.target + m.unit}`;
    return `<div class="goal ${pr.done ? 'done' : ''}">
      ${g.metric === 'manual' ? `<button type="button" class="checkbox ${pr.done ? 'on' : ''}" data-act="toggleGoal" data-id="${g.id}" aria-label="達成を切り替え" aria-pressed="${pr.done}"></button>` : `<span class="goal-pct">${pr.pct}%</span>`}
      <button type="button" class="task-main" data-act="editGoal" data-id="${g.id}"><span class="task-title">${DM.esc(g.title)}</span><span class="meta">${DM.esc(val)}${g.metric !== 'manual' ? '（記録から自動集計）' : ''}</span>
      ${g.metric !== 'manual' ? DM.progress(pr.pct) : ''}</button></div>`;
  };

  // ---------- 表現・単語 ----------
  DM.editPhrase = function (p = {}) {
    const isNew = !p.id;
    DM.openForm({
      title: isNew ? '表現・単語を追加' : '表現を編集',
      values: { scene: '', weak: false, ...p },
      fields: [
        { key: 'phrase', label: '英語の表現・単語', type: 'text', required: true, placeholder: '例：I was wondering if you could...' },
        { key: 'meaning', label: '意味（日本語）', type: 'text', placeholder: '例：〜していただけないでしょうか' },
        { key: 'example', label: '例文（任意）', type: 'textarea', rows: 2 },
        { key: 'scene', label: '場面', type: 'chips', options: S().englishScenes, allowEmpty: true },
        { key: 'weak', label: '苦手な表現として復習リストに入れる', type: 'check' },
      ],
      onSave: (x) => {
        const phrase = x.phrase.trim();
        if (isNew && DM.store.data.phrases.some((y) => y.phrase.toLowerCase() === phrase.toLowerCase())) return 'すでに登録されています';
        DM.store.upsert('phrases', { id: p.id || DM.uid('ph_'), phrase, meaning: x.meaning || '', example: x.example || '', scene: x.scene || '', weak: !!x.weak,
          box: p.box || 0, due: p.due || DM.today() });
        DM.toast(isNew ? '追加しました' : '更新しました');
      },
      onDelete: isNew ? null : () => DM.removeWithUndo('phrases', p.id),
    });
  };

  // ---------- ＋ボタン（すばやく記録） ----------
  DM.quickAdd = function (date = DM.today()) {
    const c = DM.model.cats();
    const s = DM.openSheet(`<div class="quick-grid">
      ${c.map((k) => `<button type="button" class="quick" data-q="log" data-cat="${k.id}">${DM.catDot(k.id)}<b>${DM.esc(k.name)}</b><small>時間を記録</small></button>`).join('')}
      <button type="button" class="quick" data-q="cond"><b>コンディション</b><small>疲労・睡眠など</small></button>
      <button type="button" class="quick" data-q="event"><b>予定</b><small>時刻つき</small></button>
      <button type="button" class="quick" data-q="task"><b>タスク</b><small>やること</small></button>
      <button type="button" class="quick" data-q="day"><b>振り返り</b><small>日記・達成度</small></button>
      <button type="button" class="quick" data-q="phrase"><b>英語表現</b><small>単語・フレーズ</small></button>
    </div><p class="f-hint">対象日：${DM.fmtDate(date)}</p>`, { title: '記録する' });
    s.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return;
      s.close();
      const q = b.dataset.q;
      if (q === 'log') DM.editLog({}, { cat: b.dataset.cat, date });
      if (q === 'cond') DM.editCondition(date);
      if (q === 'event') DM.editEvent({}, { date, start: DM.nowHM().slice(0, 3) + '00', end: DM.minToHM((DM.hmToMin(DM.nowHM().slice(0, 3) + '00') + 60) % 1440) });
      if (q === 'task') DM.editTask({}, { date });
      if (q === 'day') DM.editDay(date);
      if (q === 'phrase') DM.editPhrase();
    });
  };
})(window.DM);
