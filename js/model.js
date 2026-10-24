/* DAYMARK LIFE — 集計・派生データ
 * 画面はここで計算した値だけを表示する。記録がない日は「0」ではなく「記録なし」として扱う。
 */
(function (DM) {
  const D = () => DM.store.data;

  // コンディション項目。dir: +1 は値が高いほど良い状態、-1 は高いほど負担が大きい状態を表す。
  const COND = [
    { key: 'physFatigue', label: '身体的疲労', lo: '全く疲れていない', hi: 'これ以上ないほど疲れている', dir: -1 },
    { key: 'mentalFatigue', label: '精神的疲労', lo: '全く疲れていない', hi: 'これ以上ないほど疲れている', dir: -1 },
    { key: 'stress', label: 'ストレス', lo: '全く感じない', hi: 'これ以上ないほど強く感じる', dir: -1 },
    { key: 'focus', label: '集中力', lo: '全く集中できない', hi: 'これ以上ないほど集中できる', dir: 1 },
    { key: 'motivation', label: 'モチベーション', lo: '全くない', hi: 'これ以上ないほど高い', dir: 1 },
    { key: 'mood', label: '気分', lo: 'これ以上ないほど悪い', hi: 'これ以上ないほど良い', dir: 1 },
    { key: 'sleepQuality', label: '睡眠の質', lo: 'これ以上ないほど悪い', hi: 'これ以上ないほど良い', dir: 1 },
  ];

  // Borg CR10 に基づく主観的運動強度の言語アンカー
  const RPE = [
    [0, '安静'], [1, '非常に楽'], [2, '楽'], [3, 'ふつう'], [4, 'ややきつい'], [5, 'きつい'],
    [6, ''], [7, 'とてもきつい'], [8, ''], [9, ''], [10, '最大'],
  ];

  const cats = () => D().settings.categories;
  const cat = (id) => cats().find((c) => c.id === id) || { id, name: id || '未分類', color: '#8a8f98', dark: '#8a8f98' };
  const isDark = () => document.documentElement.dataset.resolvedTheme === 'dark';
  const catColor = (id) => { const c = cat(id); return isDark() ? (c.dark || c.color) : c.color; };
  const project = (id) => D().projects.find((p) => p.id === id);

  const logsIn = (from, to, catId) => D().logs.filter((l) => l.date >= from && l.date <= to && (!catId || l.cat === catId));
  const minutesIn = (from, to, catId) => DM.sum(logsIn(from, to, catId).map((l) => l.minutes));
  const minutesByCat = (from, to) => {
    const m = {}; for (const l of logsIn(from, to)) m[l.cat] = (m[l.cat] || 0) + (Number(l.minutes) || 0); return m;
  };
  const eventsOn = (date) => D().events.filter((e) => e.date === date).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
  const eventMin = (e) => DM.spanMin(e.start, e.end) || 0;
  const plannedByCat = (from, to) => {
    const m = {};
    for (const e of D().events) if (e.date >= from && e.date <= to && e.status !== 'cancel') m[e.cat] = (m[e.cat] || 0) + eventMin(e);
    return m;
  };
  const exerciseSessions = (from, to) => logsIn(from, to, 'exercise');
  // セッションRPE負荷（RPE × 時間[分]、単位 AU）。RPE未入力の記録は含めない。
  const sessionLoad = (l) => (l.rpe != null && l.rpe !== '' ? Number(l.rpe) * (Number(l.minutes) || 0) : null);

  // ---------- タスク ----------
  const PRI = { high: { label: '高', w: 0 }, mid: { label: '中', w: 1 }, low: { label: '低', w: 2 } };
  const taskSort = (a, b) => (a.done - b.done) || (PRI[a.priority || 'mid'].w - PRI[b.priority || 'mid'].w) || (a.due || '9999').localeCompare(b.due || '9999');
  // その日にやるべきタスク：実施予定日がその日、または期限がその日以前で未完了
  function tasksFor(date) {
    const t = DM.today();
    return D().tasks.filter((k) => {
      if (k.done) return k.doneAtDate === date || k.date === date;
      if (k.date === date || k.due === date) return true;
      return date === t && ((k.date && k.date < t) || (k.due && k.due < t));
    }).sort(taskSort);
  }
  const doneTasksIn = (from, to, catId) => D().tasks.filter((k) => k.done && k.doneAtDate >= from && k.doneAtDate <= to && (!catId || k.cat === catId));

  function projectProgress(p) {
    const ts = D().tasks.filter((k) => k.projectId === p.id);
    if (p.progress != null && p.progress !== '') return { pct: Number(p.progress), manual: true, done: ts.filter((k) => k.done).length, total: ts.length };
    if (!ts.length) return { pct: null, manual: false, done: 0, total: 0 };
    const done = ts.filter((k) => k.done).length;
    return { pct: Math.round((done / ts.length) * 100), manual: false, done, total: ts.length };
  }

  // ---------- 目標 ----------
  const METRICS = {
    manual: { label: '手動でチェック', unit: '' },
    research_min: { label: '研究時間（分）', unit: '分' },
    english_min: { label: '英語学習時間（分）', unit: '分' },
    exercise_count: { label: '運動回数（回）', unit: '回' },
    exercise_min: { label: '運動時間（分）', unit: '分' },
    english_days: { label: '英語を学習した日数（日）', unit: '日' },
    condition_days: { label: 'コンディションを記録した日数（日）', unit: '日' },
    rest_days: { label: '休息日の数（日）', unit: '日' },
    research_tasks: { label: '研究タスク完了数（件）', unit: '件' },
  };
  const periodRange = (period, key) => {
    if (period === 'week') { const st = isoWeekStart(key); return [st, DM.addDays(st, 6)]; }
    const st = key + '-01'; return [st, DM.addDays(DM.addMonths(st, 1), -1)];
  };
  function isoWeekStart(key) {
    const [y, w] = key.split('-W').map(Number);
    const jan4 = `${y}-01-04`;
    return DM.addDays(DM.weekStart(jan4), (w - 1) * 7);
  }
  function metricValue(metric, from, to) {
    const d = D();
    switch (metric) {
      case 'research_min': return minutesIn(from, to, 'research');
      case 'english_min': return minutesIn(from, to, 'english');
      case 'exercise_count': return exerciseSessions(from, to).length;
      case 'exercise_min': return minutesIn(from, to, 'exercise');
      case 'english_days': return new Set(logsIn(from, to, 'english').map((l) => l.date)).size;
      case 'condition_days': return Object.keys(d.conditions).filter((k) => k >= from && k <= to).length;
      case 'rest_days': return Object.entries(d.days).filter(([k, v]) => k >= from && k <= to && v.restDay).length;
      case 'research_tasks': return doneTasksIn(from, to, 'research').length;
      default: return null;
    }
  }
  function goalProgress(g) {
    if (g.metric === 'manual' || !g.metric) return { value: g.manualDone ? 1 : 0, target: 1, pct: g.manualDone ? 100 : 0, done: !!g.manualDone };
    const [from, to] = periodRange(g.period, g.key);
    const value = metricValue(g.metric, from, to);
    const target = Number(g.target) || 0;
    const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
    return { value, target, pct, done: target > 0 && value >= target };
  }
  const goalsFor = (period, key) => D().goals.filter((g) => g.period === period && g.key === key);
  function goalRate(period, key) {
    const gs = goalsFor(period, key);
    if (!gs.length) return null;
    return { done: gs.filter((g) => goalProgress(g).done).length, total: gs.length };
  }

  // ---------- 連続日数 ----------
  function streak(dates) {
    const s = new Set(dates);
    let d = s.has(DM.today()) ? DM.today() : DM.addDays(DM.today(), -1), n = 0;
    while (s.has(d)) { n++; d = DM.addDays(d, -1); }
    return n;
  }
  const englishDates = () => [...D().logs.filter((l) => l.cat === 'english').map((l) => l.date), ...D().enDiary.map((e) => e.date), ...D().transcripts.map((e) => e.date)];

  // ---------- フレーズの間隔反復（ライトナー方式） ----------
  const INTERVALS = [1, 3, 7, 14, 30, 60];
  const duePhrases = () => D().phrases.filter((p) => (p.due || '') <= DM.today()).sort((a, b) => (b.weak - a.weak) || (a.due || '').localeCompare(b.due || ''));
  function gradePhrase(id, ok) {
    DM.store.commit((d) => {
      const p = d.phrases.find((x) => x.id === id); if (!p) return;
      p.box = ok ? Math.min((p.box || 0) + 1, INTERVALS.length - 1) : 0;
      p.due = DM.addDays(DM.today(), ok ? INTERVALS[p.box] : 1);
      p.lastReviewed = DM.today();
      p.reviews = (p.reviews || 0) + 1;
      if (!ok) p.misses = (p.misses || 0) + 1;
    });
  }

  // ---------- 睡眠 ----------
  function sleepMin(c) {
    if (!c) return null;
    if (c.bed && c.wake) return DM.spanMin(c.bed, c.wake);
    return c.sleepMin != null && c.sleepMin !== '' ? Number(c.sleepMin) : null;
  }

  // 日ごとの値の系列（記録のない日は null）
  function dailySeries(days, fn) { return days.map((d) => ({ x: d, y: fn(d) })); }
  const condValue = (date, key) => {
    const c = D().conditions[date]; if (!c) return null;
    if (key === 'sleep') { const m = sleepMin(c); return m == null ? null : Math.round((m / 60) * 10) / 10; }
    return c[key] == null || c[key] === '' ? null : Number(c[key]);
  };
  const hasAnyRecord = (date) => {
    const d = D();
    return d.logs.some((l) => l.date === date) || !!d.conditions[date] || !!(d.days[date] && (d.days[date].diary || d.days[date].good || d.days[date].improve || d.days[date].score != null));
  };

  DM.model = {
    COND, RPE, PRI, METRICS, INTERVALS,
    cats, cat, catColor, project, logsIn, minutesIn, minutesByCat, eventsOn, eventMin, plannedByCat,
    exerciseSessions, sessionLoad, tasksFor, taskSort, doneTasksIn, projectProgress,
    periodRange, isoWeekStart, metricValue, goalProgress, goalsFor, goalRate,
    streak, englishDates, duePhrases, gradePhrase, sleepMin, dailySeries, condValue, hasAnyRecord, isDark,
  };
})(window.DM);
