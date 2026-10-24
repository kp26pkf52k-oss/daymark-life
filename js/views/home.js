/* ホーム：今日の状況を一目で。詳細は各ページへ。 */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;

  function condCard(t) {
    const c = DM.store.data.conditions[t];
    if (!c) {
      return `<section class="card">
        <div class="card-head"><h2>今日のコンディション</h2><a href="#/condition" class="more">推移</a></div>
        <p class="muted">まだ記録していません。</p>
        <button type="button" class="btn primary" data-act="editCond" data-date="${t}">記録する（約30秒）</button></section>`;
    }
    const sm = M.sleepMin(c);
    const items = M.COND.filter((k) => c[k.key] != null).map((k) => `<div class="mini"><span>${k.label}</span><b>${c[k.key]}</b></div>`).join('');
    return `<section class="card">
      <div class="card-head"><h2>今日のコンディション</h2><a href="#/condition" class="more">推移</a></div>
      <div class="mini-grid">${items}${sm != null ? `<div class="mini"><span>睡眠時間</span><b>${DM.fmtH(sm)}<small>h</small></b></div>` : ''}</div>
      <div class="row-between"><span class="f-hint">0〜100の主観評価（${c.recordedHM || ''}記録）。疲労・ストレスは高いほど負担が大きい状態です。</span>
      <button type="button" class="btn small" data-act="editCond" data-date="${t}">編集</button></div></section>`;
  }

  function activityTiles(t) {
    const S = DM.store.data.settings;
    const wk = DM.weekDays(t);
    const tile = (id, view, todayVal, weekVal, target, unitFmt, sub) => `
      <a class="tile" href="#/${view}">
        <span class="tile-label">${DM.catDot(id)}${esc(M.cat(id).name)}</span>
        <b class="tile-num">${todayVal}</b>
        <span class="tile-sub">${sub}</span>
        ${target ? DM.progress((weekVal / target) * 100, M.catColor(id)) : ''}
        <span class="tile-sub">今週 ${unitFmt(weekVal)}${target ? ` / 目安 ${unitFmt(target)}` : ''}</span>
      </a>`;
    const rT = M.minutesIn(t, t, 'research'), rW = M.minutesIn(wk[0], wk[6], 'research');
    const eT = M.minutesIn(t, t, 'english'), eW = M.minutesIn(wk[0], wk[6], 'english');
    const xT = M.exerciseSessions(t, t), xW = M.exerciseSessions(wk[0], wk[6]).length;
    return `<section class="tiles">
      ${tile('research', 'research', rT ? DM.fmtMin(rT) : '—', rW, S.weeklyTargets.research, DM.fmtMin, rT ? '今日' : '今日は未記録')}
      ${tile('english', 'english', eT ? DM.fmtMin(eT) : '—', eW, S.weeklyTargets.english, DM.fmtMin, eT ? `今日・連続${M.streak(M.englishDates())}日` : '今日は未記録')}
      ${tile('exercise', 'exercise', xT.length ? DM.fmtMin(DM.sum(xT.map((l) => l.minutes))) : '—', xW, S.weeklyTargets.exerciseCount, (n) => n + '回', xT.length ? `今日 ${xT.length}回` : '今日は未記録')}
    </section>`;
  }

  function scheduleCard(t) {
    const evs = M.eventsOn(t);
    const now = DM.hmToMin(DM.nowHM());
    const rows = evs.map((e) => {
      const past = DM.hmToMin(e.end) <= now && DM.hmToMin(e.end) > DM.hmToMin(e.start);
      const st = { done: '実施', partial: '一部', cancel: '中止' }[e.status] || (past ? '実績未記入' : '');
      return `<button type="button" class="ev-row" data-act="editEvent" data-id="${e.id}">
        <span class="ev-time">${e.start}–${e.end}</span>${DM.catDot(e.cat)}<span class="ev-title">${esc(e.title)}</span>${st ? `<span class="badge ${e.status || 'todo'}">${st}</span>` : ''}</button>`;
    }).join('');
    return `<section class="card">
      <div class="card-head"><h2>今日の予定</h2><a href="#/calendar?v=day&d=${t}" class="more">1日の予定表</a></div>
      ${rows ? `<div class="ev-list">${rows}</div>` : '<p class="muted">予定はありません。</p>'}
      <button type="button" class="btn small" data-act="addEvent" data-date="${t}" data-start="${DM.nowHM().slice(0, 3)}00">＋ 予定</button></section>`;
  }

  function taskCard(t) {
    const ts = M.tasksFor(t);
    const open = ts.filter((k) => !k.done);
    return `<section class="card">
      <div class="card-head"><h2>今日やるべきタスク <span class="count">${open.length}</span></h2><a href="#/calendar?v=tasks" class="more">すべて</a></div>
      ${ts.length ? `<div class="task-list">${ts.slice(0, 8).map((k) => DM.taskRow(k, { hideDate: true })).join('')}</div>${ts.length > 8 ? `<p class="f-hint">ほか ${ts.length - 8} 件</p>` : ''}`
        : '<p class="muted">今日が実施予定日・期限のタスクはありません。</p>'}
      <button type="button" class="btn small" data-act="addTask" data-date="${t}">＋ タスク</button></section>`;
  }

  function goalCard(t) {
    const wk = DM.weekKey(t);
    const gs = M.goalsFor('week', wk);
    const rate = M.goalRate('week', wk);
    return `<section class="card">
      <div class="card-head"><h2>今週の目標</h2><a href="#/goals" class="more">目標・習慣</a></div>
      ${gs.length ? `<p class="kpi-line"><b>${rate.done}</b> / ${rate.total} 達成</p><div class="task-list">${gs.slice(0, 4).map(DM.goalRow).join('')}</div>`
        : '<p class="muted">今週の目標はまだありません。</p>'}
      <button type="button" class="btn small" data-act="addGoal" data-period="week" data-key="${wk}">＋ 目標</button></section>`;
  }

  function trendCard(t) {
    const days = DM.range(DM.addDays(t, -13), t);
    const cs = M.cats();
    const series = cs.map((c) => ({ name: c.name, color: M.catColor(c.id), values: days.map((d) => M.minutesIn(d, d, c.id) / 60) }));
    const hasCond = days.some((d) => M.condValue(d, 'physFatigue') != null || M.condValue(d, 'mentalFatigue') != null);
    return `<section class="card wide">
      <div class="card-head"><h2>最近2週間の過ごし方</h2><a href="#/analysis" class="more">分析</a></div>
      ${DM.charts.place({ type: 'bar', labels: days.map(DM.fmtShort), tipLabels: days.map((d) => DM.fmtDate(d)), series, unit: '時間', fmt: (v) => DM.fmtMin(v * 60), height: 170, label: '直近14日のカテゴリー別記録時間' })}
      ${hasCond ? `<h3 class="sub-h">疲労感（0〜100、高いほど疲れている）</h3>${DM.charts.place({ type: 'line', labels: days.map(DM.fmtShort), tipLabels: days.map((d) => DM.fmtDate(d)),
        series: [{ name: '身体的疲労', color: 'var(--s1)', values: days.map((d) => M.condValue(d, 'physFatigue')) }, { name: '精神的疲労', color: 'var(--s2)', values: days.map((d) => M.condValue(d, 'mentalFatigue')) }],
        yMin: 0, yMax: 100, height: 140, label: '直近14日の疲労感' })}` : ''}
    </section>`;
  }

  function reflectCard(t) {
    const d = DM.store.data.days[t];
    const late = DM.hmToMin(DM.nowHM()) >= 18 * 60;
    if (d) {
      return `<section class="card"><div class="card-head"><h2>今日の振り返り</h2><button type="button" class="more link-btn" data-act="editDay" data-date="${t}">編集</button></div>
        ${d.score != null ? `<p class="kpi-line">達成度 <b>${d.score}</b><small> / 100</small></p>` : ''}
        ${d.good ? `<p><span class="label-s">良かった</span>${esc(d.good)}</p>` : ''}${d.improve ? `<p><span class="label-s">改善</span>${esc(d.improve)}</p>` : ''}
        ${d.restDay ? '<span class="badge done">休息日</span>' : ''}</section>`;
    }
    return `<section class="card"><div class="card-head"><h2>今日の振り返り</h2></div>
      <p class="muted">${late ? '1日の終わりに、達成度と良かったこと・改善したいことを残しましょう。' : '夜に1分で記入できます。'}</p>
      <button type="button" class="btn ${late ? 'primary' : ''} small" data-act="editDay" data-date="${t}">振り返りを書く</button></section>`;
  }

  function notices() {
    const d = DM.store.data;
    const out = [];
    const hasData = d.logs.length + Object.keys(d.conditions).length + d.events.length > 0;
    const last = d.settings.lastBackupAt;
    if (hasData && (!last || DM.diffDays(last.slice(0, 10), DM.today()) >= 7)) {
      out.push(`<div class="notice">記録はこの端末のブラウザ内にだけ保存されています。${last ? `最後のバックアップは ${DM.fmtDate(last.slice(0, 10))}。` : 'まだバックアップしていません。'}
        <a href="#/settings">バックアップする</a></div>`);
    }
    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    if (!standalone && /iPhone|iPad/.test(navigator.userAgent) && !localStorage.getItem('daymark.hideA2HS')) {
      out.push(`<div class="notice">iPhoneでは「共有 → ホーム画面に追加」してから使うと、記録が消えにくくなります。<a href="#/settings">詳しく</a>
        <button type="button" class="link-btn" data-act="hideA2HS">閉じる</button></div>`);
    }
    if (M.duePhrases().length) out.push(`<div class="notice soft">今日復習する英語表現が ${M.duePhrases().length} 個あります。<a href="#/english?tab=review">復習する</a></div>`);
    return out.join('');
  }
  DM.actions.hideA2HS = () => { try { localStorage.setItem('daymark.hideA2HS', '1'); } catch { /* ignore */ } DM.render(); };

  DM.views.home = {
    title: 'ホーム',
    render() {
      const t = DM.today();
      return `<div class="home">
        <div class="hello"><div><span class="eyebrow">${DM.weekKey(t).replace('-W', '年 第')}週</span><h2 class="date-big">${DM.fmtDate(t, { year: false })}</h2></div></div>
        ${notices()}
        ${activityTiles(t)}
        <div class="grid-2">
          ${condCard(t)}
          ${scheduleCard(t)}
          ${taskCard(t)}
          ${goalCard(t)}
          ${reflectCard(t)}
        </div>
        ${trendCard(t)}
      </div>`;
    },
  };
})(window.DM);
