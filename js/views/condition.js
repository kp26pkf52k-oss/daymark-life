/* コンディション：主観評価（0〜100）と睡眠の記録・推移。診断や健康判定はしない。 */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;
  const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'];

  DM.views.condition = {
    title: 'コンディション',
    render(p) {
      const t = DM.today();
      const c = DM.store.data.conditions[t];
      const span = Number(p.span || 30);
      const sel = (p.items || 'physFatigue,mentalFatigue').split(',').filter((k) => M.COND.some((x) => x.key === k));
      const days = DM.range(DM.addDays(t, -(span - 1)), t);
      const recorded = days.filter((d) => DM.store.data.conditions[d]).length;
      const series = M.COND.map((k, i) => ({ k, color: COLORS[i] })).filter((x) => sel.includes(x.k.key))
        .map((x) => ({ name: x.k.label, color: x.color, values: days.map((d) => M.condValue(d, x.k.key)) }));
      const sleep = days.map((d) => M.condValue(d, 'sleep'));
      const list = Object.entries(DM.store.data.conditions).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 60);
      return `
      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h2>今日（${DM.fmtDate(t)}）</h2><button type="button" class="btn ${c ? 'small' : 'primary'}" data-act="editCond" data-date="${t}">${c ? '編集' : '記録する'}</button></div>
          ${c ? `<div class="mini-grid">${M.COND.filter((k) => c[k.key] != null).map((k) => `<div class="mini"><span>${k.label}</span><b>${c[k.key]}</b></div>`).join('')}${M.sleepMin(c) != null ? `<div class="mini"><span>睡眠時間</span><b>${DM.fmtH(M.sleepMin(c))}<small>h</small></b></div>` : ''}</div>${c.note ? `<p class="f-hint">${esc(c.note)}</p>` : ''}`
          : '<p class="muted">今日はまだ記録していません。スライダーを動かすだけで、約30秒で入力できます。</p>'}
        </section>
        <section class="card">
          <h2>数値の意味</h2>
          <table class="tbl small"><thead><tr><th>項目</th><th>0</th><th>100</th></tr></thead><tbody>
            ${M.COND.map((k) => `<tr><td>${k.label}</td><td>${k.lo}</td><td>${k.hi}</td></tr>`).join('')}</tbody></table>
          <p class="f-hint">疲労・ストレスは値が高いほど負担が大きく、集中力・モチベーション・気分・睡眠の質は値が高いほど良い状態を表します。いずれも自分の主観による評価で、医学的な診断や健康状態の判定には使えません。体調に不安がある場合は医療機関に相談してください。</p>
        </section>
      </div>
      <section class="card">
        <div class="card-head"><h2>推移</h2>${DM.seg('span', [['14', '2週'], ['30', '30日'], ['90', '90日']], String(span))}</div>
        <div class="chips wrap" role="group" aria-label="表示する項目">${M.COND.map((k, i) => `<button type="button" class="chip ${sel.includes(k.key) ? 'on' : ''}" data-act="condItem" data-k="${k.key}" aria-pressed="${sel.includes(k.key)}"><i style="background:${COLORS[i]}"></i>${k.label}</button>`).join('')}</div>
        ${series.length ? DM.charts.place({ type: 'line', labels: days.map(DM.fmtShort), tipLabels: days.map((d) => DM.fmtDate(d)), series, yMin: 0, yMax: 100, height: 210, label: 'コンディション項目の推移' }) : '<p class="muted">表示する項目を選んでください。</p>'}
        <h3 class="sub-h">睡眠時間</h3>
        ${DM.charts.place({ type: 'line', labels: days.map(DM.fmtShort), tipLabels: days.map((d) => DM.fmtDate(d)), series: [{ name: '睡眠時間', color: 'var(--s7)', values: sleep }], yMin: 0, yMax: 12, unit: '時間', fmt: (v) => v + '時間', height: 150, label: '睡眠時間の推移' })}
        <p class="f-hint">この期間に記録した日：${recorded} / ${span}日。記録のない日は線をつながずに空けています。</p>
      </section>
      <section class="card"><h2>記録一覧</h2>
        ${list.length ? `<div class="tbl-wrap"><table class="tbl small cond-tbl"><thead><tr><th>日付</th>${M.COND.map((k) => `<th class="num">${k.label}</th>`).join('')}<th class="num">睡眠</th></tr></thead><tbody>
          ${list.map(([d, r]) => `<tr data-act="editCond" data-date="${d}" class="clickable"><td>${DM.fmtShort(d)}</td>${M.COND.map((k) => `<td class="num">${r[k.key] ?? '—'}</td>`).join('')}<td class="num">${M.sleepMin(r) != null ? DM.fmtH(M.sleepMin(r)) + 'h' : '—'}</td></tr>`).join('')}
          </tbody></table></div><p class="f-hint">行をタップすると編集できます。</p>` : DM.empty('まだ記録がありません。')}
      </section>`;
    },
  };
  DM.actions.condItem = (el) => {
    const { params } = DM.route();
    const cur = (params.items || 'physFatigue,mentalFatigue').split(',').filter(Boolean);
    const k = el.dataset.k;
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    DM.setParams({ items: next.join(',') || 'none' });
  };
})(window.DM);
