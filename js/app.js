/* DAYMARK LIFE — 画面切り替え（ハッシュルーティング）と全体レイアウト
 * 画面を追加するときは DM.views に { title, render(params), after?(root, params) } を登録し、NAV に1行足す。
 */
(function (DM) {
  DM.views = DM.views || {};
  DM.actions = DM.actions || {};

  const NAV = [
    { id: 'home', label: 'ホーム', icon: 'home', mobile: true },
    { id: 'calendar', label: '予定表', icon: 'cal', mobile: true },
    { id: 'english', label: '英語', icon: 'en' },
    { id: 'research', label: '研究', icon: 'lab' },
    { id: 'condition', label: 'コンディション', icon: 'cond' },
    { id: 'exercise', label: '運動', icon: 'run' },
    { id: 'analysis', label: '分析', icon: 'chart', mobile: true },
    { id: 'goals', label: '目標・習慣', icon: 'goal' },
    { id: 'settings', label: '設定・データ', icon: 'gear' },
  ];
  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    en: '<path d="M4 6h9M8.5 4v2M6 6c.6 3.4 2.6 6 5.5 7.5M11 6c-.8 3.6-3 6.4-6.5 8"/><path d="M13 20l3.5-8 3.5 8M14.2 17.3h4.6"/>',
    lab: '<path d="M9.5 3.5h5M10.5 3.5v6L5 19a1 1 0 0 0 .9 1.5h12.2A1 1 0 0 0 19 19l-5.5-9.5v-6"/><path d="M7.5 15h9"/>',
    cond: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    run: '<circle cx="14.5" cy="4.8" r="1.8"/><path d="M8 21l3-6 3 2v4M6.5 12.5l3-4.5h4.5l2.5 4 3 .5"/><path d="M11 15l-1.5-3"/>',
    chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    goal: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M21.2 12h-2.6M5.4 12H2.8M18.5 5.5l-1.8 1.8M7.3 16.7l-1.8 1.8M18.5 18.5l-1.8-1.8M7.3 7.3 5.5 5.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };
  const icon = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`;
  DM.icon = icon;

  // ---------- ルーティング ----------
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const params = Object.fromEntries(new URLSearchParams(qs || ''));
    return { view: path || 'home', params };
  }
  DM.go = function (view, params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
    const next = `#/${view}${qs ? '?' + qs : ''}`;
    if (location.hash === next) render(); else location.hash = next;
  };
  // 同じ画面内のパラメータ変更（履歴を増やさない）
  DM.setParams = function (patch) {
    const { view, params } = parseHash();
    const p = { ...params, ...patch };
    const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v != null && v !== '')).toString();
    history.replaceState(null, '', `#/${view}${qs ? '?' + qs : ''}`);
    render();
  };
  DM.route = parseHash;

  // ---------- レイアウト ----------
  function shell() {
    document.getElementById('app').innerHTML = `
      <aside class="sidebar">
        <a class="brand" href="#/home"><span class="brand-mark"></span><span>DAYMARK<b>LIFE</b></span></a>
        <nav>${NAV.map((n) => `<a href="#/${n.id}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('')}</nav>
        <button type="button" class="btn primary block" data-act="quick">${icon('plus')}記録する</button>
      </aside>
      <div class="main-col">
        <header class="topbar"><h1 id="pageTitle"></h1><span class="topbar-date" id="topDate"></span></header>
        <main id="view" tabindex="-1"></main>
      </div>
      <nav class="tabbar" aria-label="メインメニュー">
        <a href="#/home" data-nav="home">${icon('home')}<span>ホーム</span></a>
        <a href="#/calendar" data-nav="calendar">${icon('cal')}<span>予定表</span></a>
        <button type="button" class="tab-plus" data-act="quick" aria-label="記録する">${icon('plus')}</button>
        <a href="#/analysis" data-nav="analysis">${icon('chart')}<span>分析</span></a>
        <a href="#/menu" data-nav="menu">${icon('menu')}<span>メニュー</span></a>
      </nav>`;
  }

  let lastView = null;
  function render() {
    const { view, params } = parseHash();
    const v = DM.views[view] || DM.views.home;
    const name = DM.views[view] ? view : 'home';
    DM.charts.reset();
    const root = document.getElementById('view');
    let html;
    try { html = v.render(params); } catch (e) { console.error(e); html = `<div class="card"><p>画面の表示中にエラーが発生しました：${DM.esc(e.message)}</p></div>`; }
    root.innerHTML = html;
    document.getElementById('pageTitle').textContent = typeof v.title === 'function' ? v.title(params) : v.title;
    document.getElementById('topDate').textContent = DM.fmtDate(DM.today());
    document.title = (name === 'home' ? '' : (typeof v.title === 'function' ? v.title(params) : v.title) + ' | ') + 'DAYMARK LIFE';
    const navId = NAV.find((n) => n.id === name && !n.mobile) && name !== 'menu' ? 'menu' : name;
    for (const a of document.querySelectorAll('[data-nav]')) {
      const on = a.closest('.tabbar') ? a.dataset.nav === navId : a.dataset.nav === name;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    }
    if (v.after) try { v.after(root, params); } catch (e) { console.error(e); }
    DM.charts.mount(root);
    if (lastView !== name) { window.scrollTo(0, 0); lastView = name; }
  }
  DM.render = render;

  // ---------- 共通アクション（data-act） ----------
  const A = DM.actions;
  A.quick = () => { const { view, params } = parseHash(); DM.quickAdd(view === 'calendar' && params.d ? params.d : DM.today()); };
  A.toggleTask = (el) => DM.toggleTask(el.dataset.id);
  A.editTask = (el) => DM.editTask(DM.store.data.tasks.find((t) => t.id === el.dataset.id));
  A.addTask = (el) => DM.editTask({}, { ...el.dataset, act: undefined });
  A.editLog = (el) => DM.editLog(DM.store.data.logs.find((l) => l.id === el.dataset.id));
  A.addLog = (el) => DM.editLog({}, { cat: el.dataset.cat || 'research', date: el.dataset.date || DM.today(), projectId: el.dataset.projectId, skill: el.dataset.skill });
  A.editEvent = (el) => DM.editEvent(DM.store.data.events.find((e) => e.id === el.dataset.id));
  A.addEvent = (el) => DM.editEvent({}, { date: el.dataset.date || DM.today(), start: el.dataset.start || '09:00', end: el.dataset.end || DM.minToHM(((DM.hmToMin(el.dataset.start || '09:00')) + 60) % 1440) });
  A.editCond = (el) => DM.editCondition(el.dataset.date || DM.today());
  A.editDay = (el) => DM.editDay(el.dataset.date || DM.today());
  A.editGoal = (el) => DM.editGoal(DM.store.data.goals.find((g) => g.id === el.dataset.id));
  A.addGoal = (el) => DM.editGoal({}, { period: el.dataset.period, key: el.dataset.key });
  A.toggleGoal = (el) => DM.store.commit((d) => { const g = d.goals.find((x) => x.id === el.dataset.id); if (g) g.manualDone = !g.manualDone; });
  A.editProject = (el) => DM.editProject(DM.store.data.projects.find((p) => p.id === el.dataset.id));
  A.addProject = () => DM.editProject();
  A.editPhrase = (el) => DM.editPhrase(DM.store.data.phrases.find((p) => p.id === el.dataset.id));
  A.addPhrase = () => DM.editPhrase();
  A.go = (el) => DM.go(el.dataset.view, el.dataset.params ? JSON.parse(el.dataset.params) : {});
  A.copy = (el) => DM.copyText(el.dataset.text);

  document.addEventListener('click', (e) => {
    const seg = e.target.closest('[data-seg]');
    if (seg && document.getElementById('view').contains(seg)) {
      const { view, params } = parseHash();
      // タブ・表示切替では、そのタブ固有の絞り込みを引き継がない（日付だけ残す）
      if (seg.dataset.seg === 'tab' || seg.dataset.seg === 'v') DM.go(view, { d: params.d, [seg.dataset.seg]: seg.dataset.v });
      else DM.setParams({ [seg.dataset.seg]: seg.dataset.v });
      return;
    }
    const el = e.target.closest('[data-act]');
    if (!el || el.closest('.sheet form')) return;
    const fn = A[el.dataset.act];
    if (fn) { e.preventDefault(); fn(el, e); }
  });

  // ---------- テーマ ----------
  function applyTheme() {
    const pref = DM.store.data.settings.theme || 'auto';
    const dark = pref === 'dark' || (pref === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = pref === 'auto' ? '' : pref;
    if (pref === 'auto') document.documentElement.removeAttribute('data-theme');
    document.documentElement.dataset.resolvedTheme = dark ? 'dark' : 'light';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = dark ? '#15171a' : '#f6f5f2';
  }
  DM.applyTheme = applyTheme;

  // ---------- 起動 ----------
  function start() {
    DM.store.load();
    applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); render(); });
    shell();
    DM.store.onChange(() => { applyTheme(); render(); });
    window.addEventListener('hashchange', render);
    render();
    if (DM.storeError) DM.toast('保存データを読み込めませんでした：' + DM.storeError, { error: true });
    // 保存領域を「消されにくい」状態にするよう依頼する（ブラウザが許可した場合のみ有効）
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((p) => { DM.persisted = p; }).catch(() => {});
    // 日付が変わったら表示を更新
    let day = DM.today();
    setInterval(() => { if (DM.today() !== day) { day = DM.today(); render(); } }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && DM.today() !== day) { day = DM.today(); render(); } });
    registerSW();
  }

  // オフライン対応（https または localhost のときのみ）。更新があれば知らせる。
  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https:|^http:\/\/(localhost|127\.0\.0\.1)/.test(location.href) || window.DM_NO_SW) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w && w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            DM.updateReady = true;
            DM.toast('新しいバージョンがあります。「設定・データ」から更新できます。');
          }
        });
      });
    }).catch(() => {});
  }

  DM.NAV = NAV;
  document.addEventListener('DOMContentLoaded', start);
})(window.DM);
