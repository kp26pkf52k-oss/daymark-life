/* 振り返り・データ分析：蓄積した記録を統合して可視化する。
 * 方針：記録のない日は欠測として扱う／平均は記録のある日だけで計算し件数を示す／
 * 2変数の関係は探索的な表示にとどめ、因果関係としては扱わない。
 */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;
  const MIN_PAIRS = 14; // 相関係数を表示する最小の組数（研究デザイン上の判断。根拠は README 参照）

  function buckets(period) {
    const t = DM.today();
    if (period === '12w') {
      const out = []; for (let i = 11; i >= 0; i--) { const s = DM.weekStart(DM.addDays(t, -7 * i)); out.push({ label: DM.fmtShort(s), tip: `${DM.fmtShort(s)}〜の週`, from: s, to: DM.addDays(s, 6) }); }
      return out;
    }
    if (period === '6m') {
      const out = []; for (let i = 5; i >= 0; i--) { const s = DM.addMonths(DM.monthStart(t), -i); out.push({ label: `${Number(s.slice(5, 7))}月`, tip: `${s.slice(0, 4)}年${Number(s.slice(5, 7))}月`, from: s, to: DM.addDays(DM.addMonths(s, 1), -1) }); }
      return out;
    }
    return DM.range(DM.addDays(t, -27), t).map((d) => ({ label: DM.fmtShort(d), tip: DM.fmtDate(d), from: d, to: d }));
  }
  const clipTo = (b) => (b.to > DM.today() ? DM.today() : b.to);
  const condMean = (b, key) => {
    const v = DM.range(b.from, clipTo(b)).map((d) => M.condValue(d, key)).filter((x) => x != null);
    return v.length ? Math.round(DM.mean(v) * 10) / 10 : null;
  };

  // 探索用の変数（日単位）
  const VARS = [
    { k: 'sleep', label: '睡眠時間（時間）', f: (d) => M.condValue(d, 'sleep') },
    ...M.COND.map((c) => ({ k: c.key, label: `${c.label}（0〜100）`, f: (d) => M.condValue(d, c.key) })),
    { k: 'research', label: '研究時間（分）', f: (d) => (M.hasAnyRecord(d) ? M.minutesIn(d, d, 'research') : null) },
    { k: 'english', label: '英語学習時間（分）', f: (d) => (M.hasAnyRecord(d) ? M.minutesIn(d, d, 'english') : null) },
    { k: 'exercise', label: '運動時間（分）', f: (d) => (M.hasAnyRecord(d) ? M.minutesIn(d, d, 'exercise') : null) },
    { k: 'load', label: 'セッションRPE負荷（AU）', f: (d) => { const v = M.exerciseSessions(d, d).map(M.sessionLoad).filter((x) => x != null); return v.length ? DM.sum(v) : (M.hasAnyRecord(d) ? 0 : null); } },
    { k: 'score', label: '1日の達成度（0〜100）', f: (d) => { const x = DM.store.data.days[d]; return x && x.score != null ? x.score : null; } },
  ];

  function explore(p, from, to) {
    const xk = p.x || 'sleep', yk = p.y || 'focus', lag = p.lag === '1';
    const X = VARS.find((v) => v.k === xk) || VARS[0], Y = VARS.find((v) => v.k === yk) || VARS[4];
    const pts = [];
    for (const d of DM.range(from, to)) {
      const xd = lag ? DM.addDays(d, -1) : d;
      const xv = X.f(xd), yv = Y.f(d);
      if (xv != null && yv != null) pts.push({ x: xv, y: yv, label: lag ? `${DM.fmtShort(xd)} → ${DM.fmtShort(d)}` : DM.fmtDate(d) });
    }
    const rho = pts.length >= MIN_PAIRS ? DM.spearman(pts.map((q) => q.x), pts.map((q) => q.y)) : null;
    const opt = (sel) => VARS.map((v) => `<option value="${v.k}" ${v.k === sel ? 'selected' : ''}>${v.label}</option>`).join('');
    return `<section class="card">
      <h2>2つの記録の関係（探索）</h2>
      <div class="toolbar wrap">
        <label class="inline">横軸<select data-act-change="ax">${opt(X.k)}</select></label>
        <label class="inline">縦軸<select data-act-change="ay">${opt(Y.k)}</select></label>
        <label class="check"><input type="checkbox" data-act-change="alag" ${lag ? 'checked' : ''}> 横軸は前日の値</label>
      </div>
      ${DM.charts.place({ type: 'scatter', points: pts, xLabel: X.label, yLabel: Y.label, color: 'var(--s1)', height: 240, label: '2変数の散布図' })}
      <p class="kpi-line">組の数 <b>${pts.length}</b>${rho != null ? `<span class="sep">·</span>Spearmanの順位相関 ρ = <b>${rho.toFixed(2)}</b>` : ''}</p>
      <p class="f-hint">${pts.length < MIN_PAIRS ? `両方の記録がそろった日が${MIN_PAIRS}日未満のため、相関係数は表示していません（データが少ないと偶然の影響が大きいため）。` : ''}
      この図は自分の記録を眺めるためのもので、関係が見えても一方が他方の原因であるとは言えません。同じ人の連続した日の記録は互いに独立ではなく、曜日や締切などの共通要因の影響も受けます。</p>
    </section>`;
  }

  DM.views.analysis = {
    title: '分析',
    render(p) {
      const period = p.p || '4w';
      const B = buckets(period);
      const from = B[0].from, to = DM.today();
      const nDays = DM.diffDays(from, to) + 1;
      const byCat = M.minutesByCat(from, to);
      const cats = M.cats();
      const totalMin = DM.sum(Object.values(byCat));
      const daysWithLogs = new Set(M.logsIn(from, to).map((l) => l.date)).size;
      const condDays = Object.keys(DM.store.data.conditions).filter((d) => d >= from && d <= to).length;
      const dayRecs = Object.keys(DM.store.data.days).filter((d) => d >= from && d <= to).length;
      const unitH = (v) => DM.fmtMin(v * 60);
      const barFor = (catId) => DM.charts.place({ type: 'bar', labels: B.map((b) => b.label), tipLabels: B.map((b) => b.tip), series: [{ name: M.cat(catId).name, color: M.catColor(catId), values: B.map((b) => M.minutesIn(b.from, b.to, catId) / 60) }], unit: '時間', fmt: unitH, height: 160 });
      const plan = M.plannedByCat(from, to);
      const evs = DM.store.data.events.filter((e) => e.date >= from && e.date <= to);
      const evPast = evs.filter((e) => e.date < DM.today() || e.status);
      const st = { done: 0, partial: 0, cancel: 0, none: 0 };
      for (const e of evPast) st[e.status || 'none']++;
      const wkKeys = [...new Set(DM.range(from, to).map(DM.weekKey))];
      const mKeys = [...new Set(DM.range(from, to).map(DM.monthKey))];
      const rateRows = (period2, keys, labelFn) => keys.map((k) => ({ k, r: M.goalRate(period2, k), label: labelFn(k) })).filter((x) => x.r);
      const wRates = rateRows('week', wkKeys, (k) => `${DM.fmtShort(M.isoWeekStart(k))}〜の週`);
      const mRates = rateRows('month', mKeys, (k) => `${k.slice(0, 4)}年${Number(k.slice(5))}月`);
      const condColors = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)'];

      return `
      <div class="toolbar">${DM.seg('p', [['4w', '直近4週（日別）'], ['12w', '直近12週（週別）'], ['6m', '直近6か月（月別）']], period)}</div>
      <section class="card">
        <h2>記録の状況（${DM.fmtShort(from)}〜${DM.fmtShort(to)}・${nDays}日間）</h2>
        <div class="mini-grid">
          <div class="mini"><span>時間を記録した日</span><b>${daysWithLogs}<small>/${nDays}日</small></b></div>
          <div class="mini"><span>コンディションを記録した日</span><b>${condDays}<small>/${nDays}日</small></b></div>
          <div class="mini"><span>振り返りを書いた日</span><b>${dayRecs}<small>/${nDays}日</small></b></div>
        </div>
        <p class="f-hint">以下の集計は記録された分だけを対象にしています。記録していない日は「0」ではなく「不明」です。記録率が低い期間の結果は控えめに解釈してください。</p>
      </section>

      <section class="card"><h2>生活時間のカテゴリー別内訳</h2>
        ${totalMin ? `${DM.charts.place({ type: 'share', parts: cats.map((c) => ({ name: c.name, color: M.catColor(c.id), value: byCat[c.id] || 0 })), fmt: DM.fmtMin, height: 24, legend: false })}
        <table class="tbl"><thead><tr><th>カテゴリー</th><th class="num">合計</th><th class="num">割合</th><th class="num">記録した日の平均</th></tr></thead><tbody>
        ${cats.filter((c) => byCat[c.id]).map((c) => `<tr><td>${DM.catDot(c.id)}${esc(c.name)}</td><td class="num">${DM.fmtMin(byCat[c.id])}</td><td class="num">${Math.round((byCat[c.id] / totalMin) * 100)}%</td><td class="num">${DM.fmtMin(byCat[c.id] / Math.max(1, daysWithLogs))}</td></tr>`).join('')}
        </tbody></table><p class="f-hint">割合は「記録した時間の合計」に対する割合で、24時間に対する割合ではありません。</p>` : DM.empty('この期間の時間記録はありません。')}
      </section>

      <div class="grid-3">
        <section class="card"><h2>研究時間の推移</h2>${barFor('research')}</section>
        <section class="card"><h2>英語学習時間の推移</h2>${barFor('english')}</section>
        <section class="card"><h2>運動回数の推移</h2>${DM.charts.place({ type: 'bar', labels: B.map((b) => b.label), tipLabels: B.map((b) => b.tip), series: [{ name: '運動回数', color: M.catColor('exercise'), values: B.map((b) => M.exerciseSessions(b.from, b.to).length) }], unit: '回', fmt: (v) => v + '回', height: 160 })}</section>
      </div>

      <section class="card"><h2>睡眠時間と疲労感の推移</h2>
        <p class="f-hint">${period === '4w' ? '日ごとの値' : '期間内で記録のある日の平均値'}。単位が違うため2つのグラフに分けています。</p>
        <h3 class="sub-h">睡眠時間</h3>
        ${DM.charts.place({ type: 'line', labels: B.map((b) => b.label), tipLabels: B.map((b) => b.tip), series: [{ name: '睡眠時間', color: 'var(--s7)', values: B.map((b) => condMean(b, 'sleep')) }], yMin: 0, yMax: 12, unit: '時間', fmt: (v) => v + '時間', height: 150 })}
        <h3 class="sub-h">疲労感（0〜100、高いほど疲れている）</h3>
        ${DM.charts.place({ type: 'line', labels: B.map((b) => b.label), tipLabels: B.map((b) => b.tip), series: [{ name: '身体的疲労', color: 'var(--s1)', values: B.map((b) => condMean(b, 'physFatigue')) }, { name: '精神的疲労', color: 'var(--s2)', values: B.map((b) => condMean(b, 'mentalFatigue')) }], yMin: 0, yMax: 100, height: 160 })}
      </section>

      <section class="card"><h2>コンディションの項目別推移</h2>
        <div class="small-multiples">${M.COND.map((k, i) => `<div><h3 class="sub-h">${k.label}<small>${k.dir < 0 ? '高いほど負担大' : '高いほど良い'}</small></h3>
          ${DM.charts.place({ type: 'line', labels: B.map((b) => b.label), tipLabels: B.map((b) => b.tip), series: [{ name: k.label, color: condColors[i], values: B.map((b) => condMean(b, k.key)) }], yMin: 0, yMax: 100, height: 120 })}</div>`).join('')}</div>
      </section>

      <div class="grid-2">
      <section class="card"><h2>予定と実績の比較</h2>
        ${Object.keys(plan).length || totalMin ? `<table class="tbl"><thead><tr><th>カテゴリー</th><th class="num">予定</th><th class="num">実績</th><th class="num">実績/予定</th></tr></thead><tbody>
          ${cats.filter((c) => plan[c.id] || byCat[c.id]).map((c) => `<tr><td>${DM.catDot(c.id)}${esc(c.name)}</td><td class="num">${plan[c.id] ? DM.fmtMin(plan[c.id]) : '—'}</td><td class="num">${byCat[c.id] ? DM.fmtMin(byCat[c.id]) : '—'}</td><td class="num">${plan[c.id] ? Math.round(((byCat[c.id] || 0) / plan[c.id]) * 100) + '%' : '—'}</td></tr>`).join('')}
          </tbody></table>` : DM.empty('この期間の予定・実績はありません。')}
        ${evPast.length ? `<h3 class="sub-h">予定の実施状況（${evPast.length}件）</h3>
          <div class="mini-grid"><div class="mini"><span>実施</span><b>${st.done}</b></div><div class="mini"><span>一部実施</span><b>${st.partial}</b></div><div class="mini"><span>実施せず</span><b>${st.cancel}</b></div><div class="mini"><span>未記入</span><b>${st.none}</b></div></div>` : ''}
        <p class="f-hint">実績には予定表に入れていない作業の記録も含まれるため、100%を超えることがあります。</p>
      </section>
      <section class="card"><h2>目標の達成率</h2>
        ${wRates.length || mRates.length ? `<table class="tbl"><thead><tr><th>期間</th><th class="num">達成</th><th class="num">達成率</th></tr></thead><tbody>
          ${[...wRates, ...mRates].map((x) => `<tr><td>${x.label}</td><td class="num">${x.r.done}/${x.r.total}</td><td class="num">${Math.round((x.r.done / x.r.total) * 100)}%</td></tr>`).join('')}</tbody></table>`
          : DM.empty('この期間に設定した目標はありません。')}
      </section></div>

      ${explore(p, from, to)}`;
    },
  };

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act-change]'); if (!el) return;
    const a = el.dataset.actChange;
    if (a === 'ax') DM.setParams({ x: el.value });
    if (a === 'ay') DM.setParams({ y: el.value });
    if (a === 'alag') DM.setParams({ lag: el.checked ? '1' : '' });
  });
})(window.DM);
