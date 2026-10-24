/* 研究管理：概要／プロジェクト／タスク／時間記録／週の振り返り
 * 「時間の長さ」と「何が進んだか（成果メモ・完了タスク）」を並べて見られるようにする。
 */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;
  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
  const rLogs = (from, to) => M.logsIn(from, to, 'research');

  function weekSummary(from, to) {
    const logs = rLogs(from, to);
    const min = DM.sum(logs.map((l) => l.minutes));
    const withOut = DM.sum(logs.filter((l) => l.output && l.output.trim()).map((l) => l.minutes));
    const done = M.doneTasksIn(from, to, 'research');
    return { logs, min, withOut, done };
  }

  function overview() {
    const t = DM.today();
    const wk = DM.weekDays(t);
    const mStart = DM.monthStart(t);
    const todayMin = M.minutesIn(t, t, 'research');
    const s = weekSummary(wk[0], wk[6]);
    const monthMin = M.minutesIn(mStart, t, 'research');
    const days = DM.range(DM.addDays(t, -13), t);
    const kinds = [...DM.store.data.settings.researchKinds, ''];
    const kindMin = kinds.map((k) => ({ k, v: DM.sum(s.logs.filter((l) => (l.sub || '') === k).map((l) => l.minutes)) })).filter((x) => x.v > 0);
    const target = DM.store.data.settings.weeklyTargets.research;
    return `
      <section class="stats">
        <div class="stat"><span>今日</span><b>${DM.fmtH(todayMin)}</b><small>時間</small></div>
        <div class="stat"><span>今週</span><b>${DM.fmtH(s.min)}</b><small>時間${target ? ` / 目安 ${DM.fmtH(target)}` : ''}</small></div>
        <div class="stat"><span>今月</span><b>${DM.fmtH(monthMin)}</b><small>時間</small></div>
        <div class="stat"><span>今週の完了タスク</span><b>${s.done.length}</b><small>件</small></div>
      </section>
      <div class="btn-row"><button type="button" class="btn primary" data-act="addLog" data-cat="research">＋ 研究時間を記録</button>
        <button type="button" class="btn" data-act="addTask" data-cat="research">＋ 研究タスク</button></div>
      <section class="card"><h2>直近2週間の研究時間</h2>
        ${DM.charts.place({ type: 'bar', labels: days.map(DM.fmtShort), tipLabels: days.map((d) => DM.fmtDate(d)), series: [{ name: '研究', color: M.catColor('research'), values: days.map((d) => M.minutesIn(d, d, 'research') / 60) }], unit: '時間', fmt: (v) => DM.fmtMin(v * 60), height: 170, label: '直近14日の研究時間' })}
      </section>
      <div class="grid-2">
      <section class="card"><h2>今週の作業の内訳</h2>
        ${kindMin.length ? `${DM.charts.place({ type: 'share', parts: kindMin.map((x, i) => ({ name: x.k || '種類未設定', color: x.k ? SERIES[kinds.indexOf(x.k) % 8] : 'var(--muted-fill)', value: x.v })), fmt: DM.fmtMin, height: 22, legend: false })}
          <div class="legend">${kindMin.map((x) => `<span><i style="background:${x.k ? SERIES[kinds.indexOf(x.k) % 8] : 'var(--muted-fill)'}"></i>${esc(x.k || '種類未設定')} ${DM.fmtMin(x.v)}</span>`).join('')}</div>` : DM.empty('今週の研究時間の記録はありません。')}
      </section>
      <section class="card"><h2>成果につながったか（今週）</h2>
        ${s.min ? `<p class="kpi-line">成果メモつきの時間 <b>${Math.round((s.withOut / s.min) * 100)}%</b><small>（${DM.fmtMin(s.withOut)} / ${DM.fmtMin(s.min)}）</small></p>` : '<p class="muted">今週の研究時間の記録はありません。</p>'}
        ${s.logs.filter((l) => l.output).length ? `<ul class="outputs">${s.logs.filter((l) => l.output).sort((a, b) => a.date.localeCompare(b.date)).map((l) => `<li><span class="f-hint">${DM.fmtShort(l.date)}</span> ${esc(l.output)}</li>`).join('')}</ul>` : ''}
        ${s.done.length ? `<h3 class="sub-h">完了した研究タスク</h3><ul class="outputs">${s.done.map((k) => `<li>${esc(k.title)}</li>`).join('')}</ul>` : ''}
        <p class="f-hint">これは「記録した時間のうち何が進んだかを書き残せた割合」で、成果の質を測る指標ではありません。振り返りのきっかけとして使ってください。</p>
      </section></div>`;
  }

  function projectsTab(p) {
    const ps = DM.store.data.projects.slice().sort((a, b) => ({ active: 0, paused: 1, done: 2, archived: 3 }[a.status] - { active: 0, paused: 1, done: 2, archived: 3 }[b.status]) || (a.deadline || '9').localeCompare(b.deadline || '9'));
    if (p.p) return projectDetail(DM.store.data.projects.find((x) => x.id === p.p));
    const t = DM.today(), mStart = DM.monthStart(t);
    const ST = { active: '進行中', paused: '保留', done: '完了', archived: 'アーカイブ' };
    return `<section class="card"><div class="card-head"><h2>研究プロジェクト</h2><button type="button" class="btn small primary" data-act="addProject">＋ プロジェクト</button></div>
      ${ps.length ? `<div class="proj-list">${ps.map((x) => {
        const pr = M.projectProgress(x);
        const left = x.deadline ? DM.diffDays(t, x.deadline) : null;
        const open = DM.store.data.tasks.filter((k) => k.projectId === x.id && !k.done).length;
        return `<button type="button" class="proj ${x.status}" data-act="openProject" data-id="${x.id}">
          <span class="row-between"><b>${esc(x.name)}</b><span class="badge">${ST[x.status] || ''}</span></span>
          ${x.goal ? `<span class="f-hint">${esc(x.goal)}</span>` : ''}
          ${pr.pct != null ? DM.progress(pr.pct, M.catColor('research')) : ''}
          <span class="meta">${pr.pct != null ? `進捗 ${pr.pct}%${pr.manual ? '（手入力）' : `（タスク ${pr.done}/${pr.total}）`}` : '進捗未設定'}<span class="sep">·</span>未完了タスク ${open}<span class="sep">·</span>今月 ${DM.fmtMin(DM.sum(rLogs(mStart, t).filter((l) => l.projectId === x.id).map((l) => l.minutes)))}${left != null ? `<span class="sep">·</span><span class="${left < 0 ? 'warn' : ''}">期限 ${DM.fmtShort(x.deadline)}（${left >= 0 ? 'あと' + left + '日' : Math.abs(left) + '日超過'}）</span>` : ''}</span>
        </button>`;
      }).join('')}</div>` : DM.empty('プロジェクトを登録すると、目標・進捗・時間をまとめて管理できます。')}</section>`;
  }
  DM.actions.openProject = (el) => DM.setParams({ p: el.dataset.id });

  function projectDetail(x) {
    if (!x) return DM.empty('プロジェクトが見つかりません。', '<button type="button" class="btn" data-act="closeProject">一覧へ</button>');
    const pr = M.projectProgress(x);
    const tasks = DM.store.data.tasks.filter((k) => k.projectId === x.id).sort(M.taskSort);
    const logs = DM.store.data.logs.filter((l) => l.projectId === x.id).sort((a, b) => b.date.localeCompare(a.date));
    const total = DM.sum(logs.map((l) => l.minutes));
    return `<button type="button" class="link-btn" data-act="closeProject">‹ プロジェクト一覧</button>
      <div class="grid-2">
      <section class="card"><div class="card-head"><h2>${esc(x.name)}</h2><button type="button" class="btn small" data-act="editProject" data-id="${x.id}">編集</button></div>
        ${x.goal ? `<p><span class="label-s">目標</span>${DM.nl2br(x.goal)}</p>` : ''}
        ${x.deadline ? `<p><span class="label-s">目標期限</span>${DM.fmtDate(x.deadline, { year: true })}</p>` : ''}
        ${pr.pct != null ? `<p class="kpi-line">進捗 <b>${pr.pct}%</b><small>${pr.manual ? '（手入力）' : `（タスク ${pr.done}/${pr.total} 完了）`}</small></p>${DM.progress(pr.pct, M.catColor('research'))}` : '<p class="muted">進捗未設定（タスクを追加するか、編集で%を入力）</p>'}
        <p class="kpi-line">累計 <b>${DM.fmtH(total)}</b><small>時間</small></p>
        ${x.note ? `<p><span class="label-s">メモ</span>${DM.nl2br(x.note)}</p>` : ''}
      </section>
      <section class="card"><div class="card-head"><h2>タスク</h2><button type="button" class="btn small primary" data-act="addTask" data-cat="research" data-project-id="${x.id}">＋ タスク</button></div>
        ${tasks.length ? `<div class="task-list">${tasks.map((k) => DM.taskRow(k, { hideCat: true })).join('')}</div>` : '<p class="muted">タスクはありません。</p>'}</section>
      </div>
      ${(() => { const ps = DM.store.data.papers.filter((q) => q.projectId === x.id); return `<section class="card"><div class="card-head"><h2>関連する文献 <span class="count">${ps.length}</span></h2><button type="button" class="btn small" data-act="go" data-view="research" data-params='${JSON.stringify({ tab: 'papers', pj: x.id })}'>文献一覧で見る</button></div>
        ${ps.length ? `<ul class="outputs">${ps.map((q) => `<li>${esc(q.title)} <span class="f-hint">${esc([q.year, q.journal].filter(Boolean).join('・'))}</span></li>`).join('')}</ul>` : '<p class="muted">このプロジェクトに関連づけた文献はありません。</p>'}</section>`; })()}
      <section class="card"><div class="card-head"><h2>作業記録</h2><button type="button" class="btn small" data-act="addLog" data-cat="research" data-project-id="${x.id}">＋ 記録</button></div>
        ${logs.length ? `<div class="log-list">${logs.slice(0, 100).map(DM.logRowDated).join('')}</div>` : '<p class="muted">記録はありません。</p>'}</section>`;
  }
  DM.actions.closeProject = () => DM.setParams({ p: '' });

  function tasksTab(p) {
    const f = p.tf || 'open';
    const ts = DM.store.data.tasks.filter((k) => k.cat === 'research' && (f === 'open' ? !k.done : f === 'done' ? k.done : true)).sort(M.taskSort);
    return `<section class="card"><div class="toolbar">${DM.seg('tf', [['open', '未完了'], ['done', '完了'], ['all', 'すべて']], f)}
      <button type="button" class="btn small primary" data-act="addTask" data-cat="research">＋ タスク</button></div>
      ${ts.length ? `<div class="task-list">${ts.map((k) => DM.taskRow(k, { hideCat: true })).join('')}</div>` : DM.empty('該当するタスクはありません。')}</section>`;
  }

  function logsTab() {
    const logs = DM.store.data.logs.filter((l) => l.cat === 'research').sort((a, b) => b.date.localeCompare(a.date) || (b.start || '').localeCompare(a.start || ''));
    return `<section class="card"><div class="card-head"><h2>研究時間の記録</h2><button type="button" class="btn small primary" data-act="addLog" data-cat="research">＋ 記録</button></div>
      ${logs.length ? `<div class="log-list">${logs.slice(0, 300).map(DM.logRowDated).join('')}</div>` : DM.empty('まだ記録がありません。')}</section>`;
  }

  // ---------- 週の振り返り（目標・習慣ページと共通） ----------
  DM.weeklyReview = function (wkKey, opt = {}) {
    const st = M.isoWeekStart(wkKey), en = DM.addDays(st, 6);
    const s = weekSummary(st, en);
    const w = DM.store.data.weekly[wkKey] || {};
    const rate = M.goalRate('week', wkKey);
    const prevKey = DM.weekKey(DM.addDays(st, -7)), nextKey = DM.weekKey(DM.addDays(st, 7));
    return `<section class="card">
      <div class="date-nav"><button type="button" class="icon-btn" data-act="setWeek" data-k="${prevKey}" aria-label="前の週">‹</button>
        <span class="date-label">${DM.fmtShort(st)} 〜 ${DM.fmtShort(en)} の週</span>
        <button type="button" class="icon-btn" data-act="setWeek" data-k="${nextKey}" aria-label="次の週">›</button></div>
      <div class="mini-grid">
        <div class="mini"><span>研究時間</span><b>${DM.fmtH(s.min)}<small>h</small></b></div>
        <div class="mini"><span>完了した研究タスク</span><b>${s.done.length}</b></div>
        <div class="mini"><span>成果メモつき</span><b>${s.min ? Math.round((s.withOut / s.min) * 100) + '%' : '—'}</b></div>
        <div class="mini"><span>目標達成</span><b>${rate ? `${rate.done}/${rate.total}` : '—'}</b></div>
      </div>
      ${s.logs.filter((l) => l.output).length ? `<h3 class="sub-h">この週の成果メモ</h3><ul class="outputs">${s.logs.filter((l) => l.output).map((l) => `<li><span class="f-hint">${DM.fmtShort(l.date)}</span> ${esc(l.output)}</li>`).join('')}</ul>` : ''}
      ${Object.keys(w).length ? `<div class="review-text">
        ${w.research ? `<p><span class="label-s">研究の進み具合</span>${DM.nl2br(w.research)}</p>` : ''}
        ${w.good ? `<p><span class="label-s">良かったこと</span>${DM.nl2br(w.good)}</p>` : ''}
        ${w.improve ? `<p><span class="label-s">改善したいこと</span>${DM.nl2br(w.improve)}</p>` : ''}
        ${w.next ? `<p><span class="label-s">来週やること</span>${DM.nl2br(w.next)}</p>` : ''}</div>` : '<p class="muted">この週の振り返りはまだありません。</p>'}
      <button type="button" class="btn ${Object.keys(w).length ? '' : 'primary'} small" data-act="editWeekly" data-k="${wkKey}">${Object.keys(w).length ? '編集' : '振り返りを書く'}</button>
    </section>`;
  };
  DM.actions.setWeek = (el) => DM.setParams({ wk: el.dataset.k });
  DM.actions.editWeekly = (el) => {
    const k = el.dataset.k;
    const w = DM.store.data.weekly[k] || {};
    DM.openForm({
      title: '週の振り返り', values: w,
      fields: [
        { key: 'research', label: '研究の進み具合（成果につながったこと・停滞した理由）', type: 'textarea', rows: 3 },
        { key: 'good', label: '良かったこと', type: 'textarea', rows: 2 },
        { key: 'improve', label: '改善したいこと', type: 'textarea', rows: 2 },
        { key: 'next', label: '来週やること', type: 'textarea', rows: 2 },
      ],
      onSave: (x) => {
        if (![x.research, x.good, x.improve, x.next].some((v) => v && v.trim())) return '1項目以上入力してください';
        DM.store.commit((d) => { d.weekly[k] = { ...x, updatedAt: DM.nowISO() }; });
        DM.toast('保存しました');
      },
      onDelete: DM.store.data.weekly[k] ? () => { const b = JSON.stringify(DM.store.data); DM.store.commit((d) => { delete d.weekly[k]; }); DM.toast('削除しました', { undo: () => DM.store.restoreJSON(b) }); } : null,
    });
  };

  const TABS = [['overview', '概要'], ['projects', 'プロジェクト'], ['tasks', 'タスク'], ['papers', '文献'], ['logs', '時間記録'], ['weekly', '週の振り返り']];
  DM.views.research = {
    title: '研究',
    render(p) {
      const tab = p.tab || 'overview';
      const body = { overview, projects: projectsTab, tasks: tasksTab, papers: DM.papersTab, logs: logsTab, weekly: (q) => DM.weeklyReview(q.wk || DM.weekKey(DM.today())) }[tab] || overview;
      return `${DM.seg('tab', TABS, tab)}${body(p)}`;
    },
  };
})(window.DM);
