/* 予定表：日（24時間の予定と実績）／週／月／タスク */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;
  const PX = 0.9; // 1分あたりの高さ(px)

  function dateNav(v, d) {
    const step = { day: [1, 'd'], week: [7, 'd'], month: [1, 'm'] }[v];
    const prev = step[1] === 'm' ? DM.addMonths(d, -1) : DM.addDays(d, -step[0]);
    const next = step[1] === 'm' ? DM.addMonths(d, 1) : DM.addDays(d, step[0]);
    const label = v === 'day' ? DM.fmtDate(d, { year: true })
      : v === 'week' ? `${DM.fmtShort(DM.weekStart(d))} 〜 ${DM.fmtShort(DM.addDays(DM.weekStart(d), 6))}`
        : `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月`;
    return `<div class="date-nav">
      <button type="button" class="icon-btn" data-act="calDate" data-d="${prev}" aria-label="前へ">‹</button>
      <label class="date-label">${label}<input type="date" value="${d}" data-act-change="calPick" aria-label="日付を選ぶ"></label>
      <button type="button" class="icon-btn" data-act="calDate" data-d="${next}" aria-label="次へ">›</button>
      <button type="button" class="btn small" data-act="calDate" data-d="${DM.today()}">今日</button></div>`;
  }
  DM.actions.calDate = (el) => DM.setParams({ d: el.dataset.d });
  DM.actions.calDay = (el) => DM.setParams({ v: 'day', d: el.dataset.d });

  function planActualTable(from, to) {
    const plan = M.plannedByCat(from, to), act = M.minutesByCat(from, to);
    const rows = M.cats().filter((c) => plan[c.id] || act[c.id]);
    if (!rows.length) return '<p class="muted">この期間の予定・実績はありません。</p>';
    return `<table class="tbl"><thead><tr><th>カテゴリー</th><th class="num">予定</th><th class="num">実績</th></tr></thead><tbody>
      ${rows.map((c) => `<tr><td>${DM.catDot(c.id)}${esc(c.name)}</td><td class="num">${plan[c.id] ? DM.fmtMin(plan[c.id]) : '—'}</td><td class="num">${act[c.id] ? DM.fmtMin(act[c.id]) : '—'}</td></tr>`).join('')}
      </tbody></table><p class="f-hint">予定＝予定表に入れた時間（「実施しなかった」を除く）。実績＝実際に記録した時間。</p>`;
  }

  // ---------- 日 ----------
  function dayView(d) {
    const evs = M.eventsOn(d);
    const logs = DM.store.data.logs.filter((l) => l.date === d);
    const timed = logs.filter((l) => l.start);
    const untimed = logs.filter((l) => !l.start);
    let hours = '';
    for (let h = 0; h < 24; h++) hours += `<button type="button" class="hour" style="top:${h * 60 * PX}px;height:${60 * PX}px" data-act="addEvent" data-date="${d}" data-start="${DM.pad(h)}:00" aria-label="${h}時に予定を追加"><span>${h}:00</span></button>`;
    const block = (startM, dur, color, inner, attrs, cls) => `<button type="button" class="tl-block ${cls}" style="top:${startM * PX}px;height:${Math.max(18, dur * PX - 2)}px;--c:${color}" ${attrs}>${inner}</button>`;
    const evBlocks = evs.map((e) => {
      const s = DM.hmToMin(e.start), dur = Math.min(DM.spanMin(e.start, e.end) || 30, 1440 - s);
      const st = { done: '✓', partial: '△', cancel: '×' }[e.status] || '';
      return block(s, dur, M.catColor(e.cat), `<b>${st} ${esc(e.title)}</b><small>${e.start}–${e.end}</small>`, `data-act="editEvent" data-id="${e.id}"`, `plan ${e.status === 'cancel' ? 'cancel' : ''}`);
    }).join('');
    const logBlocks = timed.map((l) => {
      const s = DM.hmToMin(l.start), dur = Math.min(l.minutes, 1440 - s);
      return block(s, dur, M.catColor(l.cat), `<b>${esc(M.cat(l.cat).name)}</b><small>${DM.fmtMin(l.minutes)}</small>`, `data-act="editLog" data-id="${l.id}"`, 'actual');
    }).join('');
    const nowLine = d === DM.today() ? `<div class="now-line" style="top:${DM.hmToMin(DM.nowHM()) * PX}px"></div>` : '';
    const day = DM.store.data.days[d];
    const c = DM.store.data.conditions[d];
    const tasks = M.tasksFor(d);
    return `
      <div class="grid-2 day-grid">
      <section class="card timeline-card">
        <div class="card-head"><h2>24時間の予定と実績</h2><button type="button" class="btn small" data-act="addEvent" data-date="${d}" data-start="09:00">＋ 予定</button></div>
        <div class="tl-legend"><span><i class="lg-plan"></i>予定</span><span><i class="lg-actual"></i>実績（開始時刻つきの記録）</span><span class="f-hint">空いている時間をタップすると予定を追加できます</span></div>
        <div class="timeline" id="timeline"><div class="tl-inner" style="height:${1440 * PX}px">${hours}<div class="tl-col plan-col">${evBlocks}</div><div class="tl-col act-col">${logBlocks}</div>${nowLine}</div></div>
      </section>
      <div class="stack">
        <section class="card">
          <div class="card-head"><h2>実施した時間</h2><button type="button" class="btn small primary" data-act="addLog" data-date="${d}">＋ 記録</button></div>
          ${logs.length ? `<div class="log-list">${logs.sort((a, b) => (a.start || '99').localeCompare(b.start || '99')).map(logRow).join('')}</div>` : '<p class="muted">この日の記録はありません。</p>'}
          ${untimed.length && timed.length ? '' : ''}
          <h3 class="sub-h">予定と実績</h3>${planActualTable(d, d)}
        </section>
        <section class="card">
          <div class="card-head"><h2>タスク</h2><button type="button" class="btn small" data-act="addTask" data-date="${d}">＋ タスク</button></div>
          ${tasks.length ? `<div class="task-list">${tasks.map((k) => DM.taskRow(k, { hideDate: true })).join('')}</div>` : '<p class="muted">この日のタスクはありません。</p>'}
        </section>
        <section class="card">
          <div class="card-head"><h2>日記・振り返り</h2><button type="button" class="btn small" data-act="editDay" data-date="${d}">${day ? '編集' : '書く'}</button></div>
          ${day ? `${day.score != null ? `<p class="kpi-line">達成度 <b>${day.score}</b><small> / 100</small>${day.restDay ? ' <span class="badge done">休息日</span>' : ''}</p>` : (day.restDay ? '<span class="badge done">休息日</span>' : '')}
            ${day.good ? `<p><span class="label-s">良かったこと</span>${DM.nl2br(day.good)}</p>` : ''}
            ${day.improve ? `<p><span class="label-s">改善したいこと</span>${DM.nl2br(day.improve)}</p>` : ''}
            ${day.diary ? `<p><span class="label-s">日記</span>${DM.nl2br(day.diary)}</p>` : ''}
            ${Object.keys(day.habits || {}).length ? `<p class="f-hint">習慣：${DM.store.data.settings.habits.filter((h) => day.habits[h.id]).map((h) => esc(h.name)).join('、')}</p>` : ''}`
          : '<p class="muted">まだ書いていません。</p>'}
        </section>
        <section class="card">
          <div class="card-head"><h2>コンディション</h2><button type="button" class="btn small" data-act="editCond" data-date="${d}">${c ? '編集' : '記録'}</button></div>
          ${c ? `<div class="mini-grid">${M.COND.filter((k) => c[k.key] != null).map((k) => `<div class="mini"><span>${k.label}</span><b>${c[k.key]}</b></div>`).join('')}${M.sleepMin(c) != null ? `<div class="mini"><span>睡眠</span><b>${DM.fmtH(M.sleepMin(c))}<small>h</small></b></div>` : ''}</div>` : '<p class="muted">記録はありません。</p>'}
        </section>
      </div></div>`;
  }

  function logRow(l) {
    const p = l.projectId && M.project(l.projectId);
    const sub = [l.sub, l.skill, l.scene, l.exType, l.rpe != null && l.rpe !== '' ? `RPE ${l.rpe}` : '', p ? p.name : ''].filter(Boolean).map(esc).join('・');
    return `<button type="button" class="log-row" data-act="editLog" data-id="${l.id}">
      ${DM.catDot(l.cat)}<span class="log-main"><b>${esc(M.cat(l.cat).name)}</b>${sub ? `<small>${sub}</small>` : ''}${l.output ? `<small class="out">成果：${esc(l.output)}</small>` : ''}${l.note ? `<small>${esc(l.note)}</small>` : ''}</span>
      <span class="log-side"><b>${DM.fmtMin(l.minutes)}</b>${l.start ? `<small>${l.start}〜</small>` : ''}${l.eventId ? '<small>予定から</small>' : ''}</span></button>`;
  }
  DM.logRow = logRow;
  DM.logRowDated = (l) => logRow(l).replace('<span class="log-main">', `<span class="log-date">${DM.fmtShort(l.date)}</span><span class="log-main">`);

  // ---------- 週 ----------
  function weekView(d) {
    const days = DM.weekDays(d);
    const rows = days.map((x) => {
      const evs = M.eventsOn(x);
      const mins = M.minutesByCat(x, x);
      const total = DM.sum(Object.values(mins));
      return `<div class="week-day ${x === DM.today() ? 'today' : ''}">
        <button type="button" class="wd-head" data-act="calDay" data-d="${x}"><b>${DM.fmtDate(x)}</b><span>${total ? '実績 ' + DM.fmtMin(total) : ''}</span></button>
        ${total ? `<div class="wd-bar">${M.cats().filter((c) => mins[c.id]).map((c) => `<i style="flex:${mins[c.id]};background:${M.catColor(c.id)}" title="${esc(c.name)} ${DM.fmtMin(mins[c.id])}"></i>`).join('')}</div>` : ''}
        ${evs.length ? evs.map((e) => `<button type="button" class="ev-row" data-act="editEvent" data-id="${e.id}"><span class="ev-time">${e.start}</span>${DM.catDot(e.cat)}<span class="ev-title">${esc(e.title)}</span>${e.status ? `<span class="badge ${e.status}">${{ done: '実施', partial: '一部', cancel: '中止' }[e.status]}</span>` : ''}</button>`).join('') : '<p class="muted small">予定なし</p>'}
        <button type="button" class="link-btn small" data-act="addEvent" data-date="${x}" data-start="09:00">＋ 予定</button>
      </div>`;
    }).join('');
    return `<div class="grid-2 wide-left"><section class="card"><div class="week-list">${rows}</div></section>
      <section class="card"><h2>今週の予定と実績</h2>${planActualTable(days[0], days[6])}</section></div>`;
  }

  // ---------- 月 ----------
  function monthView(d) {
    const days = DM.monthDays(d);
    const lead = (DM.dow(days[0]) + 6) % 7;
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<div class="mc empty"></div>');
    for (const x of days) {
      const evs = M.eventsOn(x);
      const mins = M.minutesByCat(x, x);
      const has = DM.sum(Object.values(mins));
      const cond = !!DM.store.data.conditions[x];
      const dd = DM.store.data.days[x];
      cells.push(`<button type="button" class="mc ${x === DM.today() ? 'today' : ''} ${DM.dow(x) === 0 ? 'sun' : DM.dow(x) === 6 ? 'sat' : ''}" data-act="calDay" data-d="${x}">
        <span class="mc-d">${Number(x.slice(8))}</span>
        <span class="mc-evs">${evs.slice(0, 3).map((e) => `<i style="background:${M.catColor(e.cat)}"></i><em>${esc(e.title)}</em>`).join('<br>')}${evs.length > 3 ? `<br><em>+${evs.length - 3}</em>` : ''}</span>
        <span class="mc-foot">${has ? `<span class="mc-min">${DM.fmtH(has)}h</span>` : ''}${cond ? '<span class="mc-flag" title="コンディション記録あり">●</span>' : ''}${dd && dd.restDay ? '<span class="mc-flag rest" title="休息日">休</span>' : ''}</span>
      </button>`);
    }
    const from = days[0], to = days[days.length - 1];
    return `<div class="grid-2 wide-left"><section class="card">
      <div class="month-grid">${['月', '火', '水', '木', '金', '土', '日'].map((w) => `<div class="mh">${w}</div>`).join('')}${cells.join('')}</div>
      <p class="f-hint">数字（h）はその日に記録した実施時間の合計、●はコンディション記録あり、「休」は休息日。</p></section>
      <section class="card"><h2>今月の予定と実績</h2>${planActualTable(from, to)}</section></div>`;
  }

  // ---------- タスク ----------
  function tasksView(p) {
    const f = p.tf || 'open', c = p.tc || '';
    let ts = DM.store.data.tasks.filter((t) => (f === 'open' ? !t.done : f === 'done' ? t.done : true) && (!c || t.cat === c));
    ts = ts.sort(M.taskSort);
    return `<section class="card">
      <div class="toolbar">${DM.seg('tf', [['open', '未完了'], ['done', '完了'], ['all', 'すべて']], f)}
        <select data-act-change="taskCat" aria-label="カテゴリー"><option value="">すべてのカテゴリー</option>${M.cats().map((k) => `<option value="${k.id}" ${k.id === c ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select>
        <button type="button" class="btn small primary" data-act="addTask" ${c ? `data-cat="${c}"` : ''}>＋ タスク</button></div>
      ${ts.length ? `<div class="task-list">${ts.map((t) => DM.taskRow(t)).join('')}</div>` : DM.empty('該当するタスクはありません。')}
    </section>`;
  }

  DM.views.calendar = {
    title: '予定表',
    render(p) {
      const v = p.v || 'day';
      const d = DM.isDate(p.d) ? p.d : DM.today();
      const body = v === 'week' ? weekView(d) : v === 'month' ? monthView(d) : v === 'tasks' ? tasksView(p) : dayView(d);
      return `${DM.seg('v', [['day', '日'], ['week', '週'], ['month', '月'], ['tasks', 'タスク']], v)}
        ${v !== 'tasks' ? dateNav(v, d) : ''}${body}`;
    },
    after(root, p) {
      const tl = root.querySelector('#timeline');
      if (tl) {
        const d = DM.isDate(p.d) ? p.d : DM.today();
        const first = M.eventsOn(d)[0];
        const target = d === DM.today() ? DM.hmToMin(DM.nowHM()) - 120 : first ? DM.hmToMin(first.start) - 60 : 7 * 60;
        tl.scrollTop = Math.max(0, target * PX);
      }
    },
  };

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act-change]');
    if (!el) return;
    if (el.dataset.actChange === 'calPick' && el.value) DM.setParams({ d: el.value });
    if (el.dataset.actChange === 'taskCat') DM.setParams({ tc: el.value });
  });
})(window.DM);
