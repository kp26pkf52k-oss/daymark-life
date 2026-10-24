/* 運動記録：種目・時間・RPE、週間/月間の回数、累計時間、習慣の可視化 */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;
  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

  DM.views.exercise = {
    title: '運動',
    render() {
      const t = DM.today();
      const all = DM.store.data.logs.filter((l) => l.cat === 'exercise');
      const wk = DM.weekDays(t);
      const week = M.exerciseSessions(wk[0], wk[6]);
      const month = M.exerciseSessions(DM.monthStart(t), t);
      const total = DM.sum(all.map((l) => l.minutes));
      const weeks = []; for (let i = 11; i >= 0; i--) weeks.push(DM.weekStart(DM.addDays(t, -7 * i)));
      const perWeek = weeks.map((w) => M.exerciseSessions(w, DM.addDays(w, 6)));
      const heatDays = DM.range(weeks[0], t);
      const types = DM.store.data.settings.exerciseTypes;
      const typeMin = {};
      for (const l of month) typeMin[l.exType || '種目未設定'] = (typeMin[l.exType || '種目未設定'] || 0) + l.minutes;
      const loads = perWeek.map((ls) => { const v = ls.map(M.sessionLoad).filter((x) => x != null); return v.length ? DM.sum(v) : 0; });
      const target = DM.store.data.settings.weeklyTargets.exerciseCount;
      const list = all.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.start || '').localeCompare(a.start || ''));
      return `
      <section class="stats">
        <div class="stat"><span>今週の運動</span><b>${week.length}</b><small>回${target ? ` / 目安 ${target}回` : ''}</small></div>
        <div class="stat"><span>今月の運動</span><b>${month.length}</b><small>回・${DM.fmtH(DM.sum(month.map((l) => l.minutes)))}時間</small></div>
        <div class="stat"><span>累計運動時間</span><b>${DM.fmtH(total)}</b><small>時間（${all.length}回）</small></div>
        <div class="stat"><span>運動した日（12週）</span><b>${new Set(all.filter((l) => l.date >= weeks[0]).map((l) => l.date)).size}</b><small>日 / ${heatDays.length}日</small></div>
      </section>
      <div class="btn-row"><button type="button" class="btn primary" data-act="addLog" data-cat="exercise">＋ 運動を記録</button></div>
      <div class="grid-2">
        <section class="card"><h2>運動した日（直近12週）</h2>
          ${DM.charts.place({ type: 'heat', days: heatDays, value: (d) => DM.sum(M.exerciseSessions(d, d).map((l) => l.minutes)) || null, max: 90, color: M.catColor('exercise'), fmt: DM.fmtMin, height: 150, label: '運動した日' })}
          <p class="f-hint">色が濃いほどその日の運動時間が長い（90分以上で最も濃い色）。</p></section>
        <section class="card"><h2>週ごとの運動回数</h2>
          ${DM.charts.place({ type: 'bar', labels: weeks.map(DM.fmtShort), tipLabels: weeks.map((w) => `${DM.fmtShort(w)}〜の週`), series: [{ name: '運動回数', color: M.catColor('exercise'), values: perWeek.map((x) => x.length) }], unit: '回', fmt: (v) => v + '回', target: target || null, height: 170, label: '週ごとの運動回数' })}</section>
      </div>
      <div class="grid-2">
        <section class="card"><h2>今月の種目別時間</h2>
          ${Object.keys(typeMin).length ? `${DM.charts.place({ type: 'share', parts: Object.entries(typeMin).map(([k, v]) => ({ name: k, color: types.includes(k) ? SERIES[types.indexOf(k) % 8] : 'var(--muted-fill)', value: v })), fmt: DM.fmtMin, height: 22, legend: false })}
            <div class="legend">${Object.entries(typeMin).map(([k, v]) => `<span><i style="background:${types.includes(k) ? SERIES[types.indexOf(k) % 8] : 'var(--muted-fill)'}"></i>${esc(k)} ${DM.fmtMin(v)}</span>`).join('')}</div>` : DM.empty('今月の運動記録はありません。')}</section>
        <section class="card"><h2>週ごとのセッションRPE負荷</h2>
          ${loads.some((v) => v > 0) ? DM.charts.place({ type: 'bar', labels: weeks.map(DM.fmtShort), tipLabels: weeks.map((w) => `${DM.fmtShort(w)}〜の週`), series: [{ name: 'セッションRPE負荷', color: 'var(--s7)', values: loads }], unit: 'AU', fmt: (v) => Math.round(v) + ' AU', height: 170, label: '週ごとのセッションRPE負荷' }) : DM.empty('RPEつきの記録がありません。')}
          <p class="f-hint">RPE（0〜10）×運動時間（分）の合計（Foster et al., 2001 のセッションRPE法）。RPE未入力の記録は含みません。種目が違うと負荷の意味も異なるため、同じ種目の中での比較を目安にしてください。</p></section>
      </div>
      <section class="card"><h2>運動の記録</h2>
        ${list.length ? `<div class="log-list">${list.slice(0, 200).map((l) => DM.logRowDated(l).replace('</span></button>', `${M.sessionLoad(l) != null ? `<small>${M.sessionLoad(l)} AU</small>` : ''}</span></button>`)).join('')}</div>` : DM.empty('まだ運動の記録がありません。')}
      </section>`;
    },
  };
})(window.DM);
