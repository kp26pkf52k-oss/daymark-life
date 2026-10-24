/* 目標・習慣：週間/月間目標、生活習慣のチェック、休息日・自由時間、週の振り返り */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;

  DM.views.goals = {
    title: '目標・習慣',
    render(p) {
      const t = DM.today();
      const wk = p.wk || DM.weekKey(t);
      const st = M.isoWeekStart(wk), days = DM.range(st, DM.addDays(st, 6));
      const mk = p.mk || DM.monthKey(t);
      const wGoals = M.goalsFor('week', wk), mGoals = M.goalsFor('month', mk);
      const wr = M.goalRate('week', wk), mr = M.goalRate('month', mk);
      const habits = DM.store.data.settings.habits.filter((h) => h.active);
      const D = DM.store.data.days;
      const restMin = M.minutesIn(days[0], days[6], 'rest');
      const restDays = days.filter((d) => D[d] && D[d].restDay).length;
      const prevM = DM.addMonths(mk + '-01', -1).slice(0, 7), nextM = DM.addMonths(mk + '-01', 1).slice(0, 7);
      const prevW = DM.weekKey(DM.addDays(st, -7)), nextW = DM.weekKey(DM.addDays(st, 7));
      return `
      <div class="grid-2">
        <section class="card">
          <div class="date-nav"><button type="button" class="icon-btn" data-act="setWeek" data-k="${prevW}" aria-label="前の週">‹</button>
            <span class="date-label">週間目標　${DM.fmtShort(st)}〜${DM.fmtShort(days[6])}</span>
            <button type="button" class="icon-btn" data-act="setWeek" data-k="${nextW}" aria-label="次の週">›</button></div>
          ${wr ? `<p class="kpi-line">達成 <b>${wr.done}</b> / ${wr.total}<span class="sep">·</span>達成率 ${Math.round((wr.done / wr.total) * 100)}%</p>` : ''}
          ${wGoals.length ? `<div class="task-list">${wGoals.map(DM.goalRow).join('')}</div>` : '<p class="muted">この週の目標はありません。</p>'}
          <div class="btn-row"><button type="button" class="btn small primary" data-act="addGoal" data-period="week" data-key="${wk}">＋ 週間目標</button>
            ${!wGoals.length ? `<button type="button" class="btn small" data-act="copyGoals" data-period="week" data-from="${prevW}" data-to="${wk}">前週の目標をコピー</button>` : ''}</div>
        </section>
        <section class="card">
          <div class="date-nav"><button type="button" class="icon-btn" data-act="setMonth" data-k="${prevM}" aria-label="前の月">‹</button>
            <span class="date-label">月間目標　${mk.slice(0, 4)}年${Number(mk.slice(5))}月</span>
            <button type="button" class="icon-btn" data-act="setMonth" data-k="${nextM}" aria-label="次の月">›</button></div>
          ${mr ? `<p class="kpi-line">達成 <b>${mr.done}</b> / ${mr.total}<span class="sep">·</span>達成率 ${Math.round((mr.done / mr.total) * 100)}%</p>` : ''}
          ${mGoals.length ? `<div class="task-list">${mGoals.map(DM.goalRow).join('')}</div>` : '<p class="muted">この月の目標はありません。</p>'}
          <div class="btn-row"><button type="button" class="btn small primary" data-act="addGoal" data-period="month" data-key="${mk}">＋ 月間目標</button>
            ${!mGoals.length ? `<button type="button" class="btn small" data-act="copyGoals" data-period="month" data-from="${prevM}" data-to="${mk}">前月の目標をコピー</button>` : ''}</div>
        </section>
      </div>

      <section class="card">
        <div class="card-head"><h2>生活習慣（この週）</h2><a href="#/settings" class="more">習慣を編集</a></div>
        ${habits.length ? `<div class="tbl-wrap"><table class="tbl habit-tbl"><thead><tr><th></th>${days.map((d) => `<th class="${d === t ? 'today' : ''}">${DM.WD[DM.dow(d)]}<br><small>${Number(d.slice(8))}</small></th>`).join('')}<th class="num">達成</th></tr></thead><tbody>
          ${habits.map((h) => {
            const n = days.filter((d) => D[d] && D[d].habits && D[d].habits[h.id]).length;
            const counted = days.filter((d) => d <= t).length;
            return `<tr><td>${esc(h.name)}</td>${days.map((d) => { const on = D[d] && D[d].habits && D[d].habits[h.id]; return `<td><button type="button" class="hcell ${on ? 'on' : ''}" data-act="toggleHabit" data-d="${d}" data-h="${h.id}" ${d > t ? 'disabled' : ''} aria-pressed="${!!on}" aria-label="${DM.fmtDate(d)} ${esc(h.name)}"></button></td>`; }).join('')}<td class="num">${n}/${counted}</td></tr>`;
          }).join('')}
          <tr><td>休息日</td>${days.map((d) => { const on = D[d] && D[d].restDay; return `<td><button type="button" class="hcell rest ${on ? 'on' : ''}" data-act="toggleRest" data-d="${d}" ${d > t ? 'disabled' : ''} aria-pressed="${!!on}" aria-label="${DM.fmtDate(d)} 休息日"></button></td>`; }).join('')}<td class="num">${restDays}日</td></tr>
          </tbody></table></div><p class="f-hint">マスをタップすると記録できます。チェックしていない日は「できなかった」ではなく「未記録」の可能性もあります。</p>` : DM.empty('習慣が登録されていません。「設定・データ」で追加できます。')}
        <div class="mini-grid"><div class="mini"><span>休息日</span><b>${restDays}<small>日</small></b></div><div class="mini"><span>休息・自由時間の記録</span><b>${DM.fmtH(restMin)}<small>h</small></b></div></div>
        <div class="btn-row"><button type="button" class="btn small" data-act="addLog" data-cat="rest">＋ 休息・自由時間を記録</button></div>
      </section>

      <h2 class="section-title">週の振り返り</h2>
      ${DM.weeklyReview(wk)}`;
    },
  };
  DM.actions.setMonth = (el) => DM.setParams({ mk: el.dataset.k });
  function toggleDayFlag(date, fn) {
    DM.store.commit((d) => {
      const x = d.days[date] || { habits: {} };
      x.habits = x.habits || {};
      fn(x);
      x.updatedAt = DM.nowISO();
      d.days[date] = x;
    });
  }
  DM.actions.toggleHabit = (el) => toggleDayFlag(el.dataset.d, (x) => { if (x.habits[el.dataset.h]) delete x.habits[el.dataset.h]; else x.habits[el.dataset.h] = true; });
  DM.actions.toggleRest = (el) => toggleDayFlag(el.dataset.d, (x) => { x.restDay = !x.restDay; });
  DM.actions.copyGoals = (el) => {
    const src = M.goalsFor(el.dataset.period, el.dataset.from);
    if (!src.length) return DM.toast('コピー元の目標がありません', { error: true });
    DM.store.commit((d) => { for (const g of src) d.goals.push({ ...g, id: DM.uid('g_'), key: el.dataset.to, manualDone: false, createdAt: DM.nowISO() }); });
    DM.toast(`${src.length}件の目標をコピーしました`);
  };
})(window.DM);
