/* 英語学習：概要／記録／英語日記／表現・単語／復習／会話練習
 * このサイト自体にAIはない。添削や音声会話はChatGPT等の外部サービスを使い、結果を貼り付けて残す。
 */
(function (DM) {
  const M = DM.model;
  const esc = DM.esc;
  const S = () => DM.store.data.settings;
  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

  const TOPICS = [
    ['What was the best moment of your day?', '今日いちばん良かった瞬間は？'],
    ['What did you do in the lab today?', '今日研究室でしたこと'],
    ['Explain your research to a friend who knows nothing about it.', '研究を知らない友人に説明する'],
    ['Describe a baseball game or practice you watched or joined.', '観た／参加した試合や練習'],
    ['What did you learn today?', '今日学んだこと'],
    ['How did you feel this morning, and how do you feel now?', '朝の気分と今の気分'],
    ['What are you planning to do tomorrow?', '明日の予定'],
    ['Write about a problem you are working on right now.', 'いま取り組んでいる課題'],
    ['What did you do to take care of your body today?', '今日、体のためにしたこと'],
    ['Imagine you are guiding a visiting researcher around your campus.', '海外の研究者に大学を案内する'],
    ['What would you do differently if you could redo today?', '今日をやり直せたら何を変える？'],
    ['Describe a paper you read recently.', '最近読んだ論文の紹介'],
    ['Write about a goal for this week and your first step.', '今週の目標と最初の一歩'],
    ['What surprised you today?', '今日驚いたこと'],
    ['Describe your daily routine and one thing you want to change.', '日課と変えたいところ'],
    ['If you could work abroad, where would you go and why?', '海外で働くならどこで、なぜ？'],
  ];
  const topicFor = (date, shift = 0) => {
    const n = Math.floor(Date.parse(date + 'T00:00:00Z') / 864e5) + shift;
    return TOPICS[((n % TOPICS.length) + TOPICS.length) % TOPICS.length];
  };

  // ---------- 概要 ----------
  function overview() {
    const d = DM.store.data, t = DM.today();
    const logs = d.logs.filter((l) => l.cat === 'english');
    const total = DM.sum(logs.map((l) => l.minutes));
    const last30 = new Set(logs.filter((l) => l.date > DM.addDays(t, -30)).map((l) => l.date)).size;
    const wk = DM.weekDays(t);
    const weekMin = M.minutesIn(wk[0], wk[6], 'english');
    const weeks = []; for (let i = 7; i >= 0; i--) weeks.push(DM.weekStart(DM.addDays(t, -7 * i)));
    const skills = [...S().englishSkills, ''];
    const series = skills.map((s, i) => ({
      name: s || '技能未設定', color: s ? SERIES[i % SERIES.length] : 'var(--muted-fill)',
      values: weeks.map((w) => DM.sum(logs.filter((l) => l.date >= w && l.date <= DM.addDays(w, 6) && (l.skill || '') === s).map((l) => l.minutes)) / 60),
    })).filter((s) => s.values.some((v) => v > 0));
    const sceneMin = {};
    for (const l of logs) if (l.scene) sceneMin[l.scene] = (sceneMin[l.scene] || 0) + l.minutes;
    const scenes = S().englishScenes.filter((s) => sceneMin[s]);
    return `
      <section class="stats">
        <div class="stat"><span>連続学習</span><b>${M.streak(M.englishDates())}</b><small>日</small></div>
        <div class="stat"><span>累計学習時間</span><b>${DM.fmtH(total)}</b><small>時間</small></div>
        <div class="stat"><span>直近30日の学習日数</span><b>${last30}</b><small>/ 30日</small></div>
        <div class="stat"><span>今週</span><b>${DM.fmtH(weekMin)}</b><small>時間</small></div>
      </section>
      <div class="btn-row"><button type="button" class="btn primary" data-act="addLog" data-cat="english">＋ 学習時間を記録</button>
        <button type="button" class="btn" data-act="go" data-view="english" data-params='{"tab":"diary"}'>英語日記を書く</button>
        <button type="button" class="btn" data-act="go" data-view="english" data-params='{"tab":"transcript"}'>書き写し</button>
        <button type="button" class="btn" data-act="go" data-view="english" data-params='{"tab":"talk"}'>会話練習</button></div>
      <section class="card"><h2>週ごとの学習時間（技能別）</h2>
        ${series.length ? DM.charts.place({ type: 'bar', labels: weeks.map(DM.fmtShort), tipLabels: weeks.map((w) => `${DM.fmtShort(w)}〜の週`), series, unit: '時間', fmt: (v) => DM.fmtMin(v * 60), height: 190, label: '週ごとの英語学習時間' }) : DM.empty('まだ学習時間の記録がありません。')}
        <p class="f-hint">日付は各週の月曜日。学習継続日数には、学習時間の記録・英語日記・書き写しを含めています。</p></section>
      ${scenes.length ? `<section class="card"><h2>学習した場面の内訳（全期間）</h2>
        ${DM.charts.place({ type: 'share', parts: scenes.map((s, i) => ({ name: s, color: SERIES[i % SERIES.length], value: sceneMin[s] })), fmt: DM.fmtMin, height: 22, legend: false })}
        <div class="legend">${scenes.map((s, i) => `<span><i style="background:${SERIES[i % SERIES.length]}"></i>${esc(s)} ${DM.fmtMin(sceneMin[s])}</span>`).join('')}</div></section>` : ''}`;
  }

  function logsTab() {
    const logs = DM.store.data.logs.filter((l) => l.cat === 'english').sort((a, b) => b.date.localeCompare(a.date) || (b.start || '').localeCompare(a.start || ''));
    return `<section class="card"><div class="card-head"><h2>学習の記録</h2><button type="button" class="btn small primary" data-act="addLog" data-cat="english">＋ 記録</button></div>
      ${logs.length ? `<div class="log-list">${logs.slice(0, 200).map(DM.logRowDated).join('')}</div>` : DM.empty('まだ記録がありません。')}</section>`;
  }

  // ---------- 英語日記 ----------
  const DRAFT = 'daymark.enDraft';
  const getDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; } };
  const setDraft = (v) => { try { localStorage.setItem(DRAFT, JSON.stringify(v)); } catch { /* ignore */ } };

  function diaryTab(p) {
    const list = DM.store.data.enDiary.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const editing = p.id ? list.find((e) => e.id === p.id) : null;
    const dr = getDraft();
    const cur = editing || (dr && !dr.id ? dr : { date: DM.today(), text: '', memo: '', corrected: '', scene: '' });
    const [en, ja] = topicFor(cur.date || DM.today(), Number(p.shift || 0));
    const wc = DM.wordCount(cur.text);
    return `<div class="grid-2 wide-left">
      <section class="card">
        <div class="card-head"><h2>${editing ? '英語日記を編集' : '英語日記を書く'}</h2>${editing ? '<button type="button" class="btn small" data-act="enNew">新しく書く</button>' : ''}</div>
        <div class="fields">
          <div class="field half"><label class="f-label" for="ed_date">日付</label><input id="ed_date" type="date" value="${esc(cur.date)}"></div>
          <div class="field half"><label class="f-label" for="ed_scene">場面</label><select id="ed_scene"><option value="">（なし）</option>${S().englishScenes.map((s) => `<option ${s === cur.scene ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        </div>
        <div class="topic"><div class="row-between"><span class="label-s">お題（書くことがなければ）</span><button type="button" class="link-btn" data-act="enTopic" data-shift="${Number(p.shift || 0) + 1}">別のお題</button></div>
          <div class="en">${esc(en)}</div><div class="f-hint">${esc(ja)}</div></div>
        <textarea id="ed_text" class="paper" rows="9" spellcheck="true" lang="en" placeholder="Today I went to the lab early because...&#10;英語で言えない部分は [日本語] のまま書いて先に進みましょう。">${esc(cur.text)}</textarea>
        <div class="row-between"><span class="f-hint" id="ed_wc">${wc} 語</span><span class="f-hint">言えない表現は [日本語] で</span></div>
        <details ${cur.memo ? 'open' : ''}><summary>日本語メモ（伝えたかったニュアンスなど）</summary><textarea id="ed_memo" rows="2">${esc(cur.memo)}</textarea></details>
        <details ${cur.corrected ? 'open' : ''}><summary>添削後の文（ChatGPTなどの結果を貼り付け）</summary>
          <textarea id="ed_corr" class="paper" rows="6" lang="en">${esc(cur.corrected)}</textarea></details>
        <div class="btn-row">
          <button type="button" class="btn primary" data-act="enSave">保存</button>
          <button type="button" class="btn" data-act="enCorrect">添削用にコピーしてChatGPTを開く</button>
          ${editing ? `<button type="button" class="btn danger ghost" data-act="enDel" data-id="${editing.id}">削除</button>` : ''}
        </div>
        <p class="f-hint">このサイトには添削機能はありません。ボタンを押すと、添削依頼の文章と日記がコピーされ、ChatGPTが開きます。貼り付けて送信し、返ってきた添削文を上の欄に貼って保存してください。覚えたい表現は「表現・単語」に追加できます。</p>
      </section>
      <section class="card"><h2>これまでの日記 <span class="count">${list.length}</span></h2>
        ${list.length ? `<div class="diary-list">${list.map((e) => `<button type="button" class="diary-item ${editing && editing.id === e.id ? 'on' : ''}" data-act="enOpen" data-id="${e.id}">
          <span class="row-between"><b>${DM.fmtDate(e.date)}</b><span class="f-hint">${DM.wordCount(e.text)}語${e.corrected ? '・添削あり' : ''}${e.scene ? '・' + esc(e.scene) : ''}</span></span>
          <span class="clamp en-text">${esc(e.text)}</span></button>`).join('')}</div>` : DM.empty('まだ日記がありません。')}
      </section></div>`;
  }
  const readDiary = () => ({
    date: document.getElementById('ed_date').value || DM.today(),
    scene: document.getElementById('ed_scene').value,
    text: document.getElementById('ed_text').value,
    memo: document.getElementById('ed_memo').value,
    corrected: document.getElementById('ed_corr').value,
  });
  DM.actions.enTopic = (el) => { const { params } = DM.route(); if (!params.id) setDraft(readDiary()); DM.setParams({ shift: el.dataset.shift }); };
  DM.actions.enNew = () => { setDraft(null); DM.setParams({ id: '', shift: '' }); };
  DM.actions.enOpen = (el) => DM.setParams({ id: el.dataset.id, shift: '' });
  DM.actions.enSave = () => {
    const { params } = DM.route();
    const v = readDiary();
    if (!v.text.trim()) return DM.toast('本文を入力してください', { error: true });
    const id = params.id || DM.uid('d_');
    DM.store.upsert('enDiary', { id, ...v, wordCount: DM.wordCount(v.text) });
    setDraft(null);
    DM.toast('英語日記を保存しました');
    DM.setParams({ id });
  };
  DM.actions.enDel = async (el) => {
    if (!(await DM.confirm('この英語日記を削除しますか？', { danger: true, ok: '削除' }))) return;
    DM.removeWithUndo('enDiary', el.dataset.id);
    DM.setParams({ id: '' });
  };
  DM.actions.enCorrect = () => {
    const v = readDiary();
    if (!v.text.trim()) return DM.toast('本文を入力してください', { error: true });
    const tpl = (S().prompts.find((p) => p.id === 'p_diary') || DM.store.DEFAULT_PROMPTS.find((p) => p.id === 'p_diary')).text;
    DM.copyText(tpl + v.text + (v.memo ? `\n\n(Note in Japanese about what I wanted to say: ${v.memo})` : ''));
    window.open(S().chatgptUrl || 'https://chatgpt.com/', '_blank', 'noopener');
  };

  // ---------- 表現・単語 ----------
  function phrasesTab(p) {
    const f = p.pf || 'all', q = (p.q || '').toLowerCase();
    let list = DM.store.data.phrases.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (f === 'weak') list = list.filter((x) => x.weak);
    else if (f === 'due') list = list.filter((x) => (x.due || '') <= DM.today());
    else if (f !== 'all') list = list.filter((x) => x.scene === f);
    if (q) list = list.filter((x) => (x.phrase + ' ' + x.meaning + ' ' + (x.example || '')).toLowerCase().includes(q));
    const all = DM.store.data.phrases;
    return `<section class="card">
      <div class="card-head"><h2>表現・単語 <span class="count">${all.length}</span></h2><button type="button" class="btn small primary" data-act="addPhrase">＋ 追加</button></div>
      <div class="toolbar"><select data-act-change="pf" aria-label="絞り込み">
        <option value="all">すべて</option><option value="weak" ${f === 'weak' ? 'selected' : ''}>苦手リスト（${all.filter((x) => x.weak).length}）</option><option value="due" ${f === 'due' ? 'selected' : ''}>今日の復習対象（${M.duePhrases().length}）</option>
        ${S().englishScenes.map((s) => `<option value="${esc(s)}" ${f === s ? 'selected' : ''}>場面：${esc(s)}</option>`).join('')}</select>
        <input type="search" placeholder="検索" value="${esc(p.q || '')}" data-act-change="pq" aria-label="検索"></div>
      ${list.length ? `<div class="phrase-list">${list.map((x) => `<div class="phrase">
        <button type="button" class="phrase-main" data-act="editPhrase" data-id="${x.id}"><b class="en-text">${esc(x.phrase)}</b><span>${esc(x.meaning)}</span>${x.example ? `<i class="en-text">${esc(x.example)}</i>` : ''}
          <span class="meta">${x.scene ? esc(x.scene) + '<span class="sep">·</span>' : ''}段階 ${(x.box || 0) + 1}<span class="sep">·</span>次回 ${DM.fmtShort(x.due || DM.today())}${x.misses ? `<span class="sep">·</span>忘れた回数 ${x.misses}` : ''}</span></button>
        <button type="button" class="star ${x.weak ? 'on' : ''}" data-act="toggleWeak" data-id="${x.id}" aria-pressed="${!!x.weak}" title="苦手リスト">苦手</button></div>`).join('')}</div>`
        : DM.empty(all.length ? '該当する表現はありません。' : '学んだ表現や単語を登録すると、間隔をあけて復習できます。')}
      <p class="f-hint">「苦手」にした表現は復習で優先して出ます。復習で思い出せなかった表現も自動的に苦手リストに入ります。</p></section>`;
  }
  DM.actions.toggleWeak = (el) => DM.store.commit((d) => { const x = d.phrases.find((y) => y.id === el.dataset.id); if (x) x.weak = !x.weak; });

  // ---------- 復習 ----------
  let reviewShow = false;
  function reviewTab() {
    const due = M.duePhrases();
    if (!DM.store.data.phrases.length) return `<section class="card">${DM.empty('まだ表現が登録されていません。', '<button type="button" class="btn primary" data-act="addPhrase">＋ 表現を追加</button>')}</section>`;
    if (!due.length) {
      const next = DM.store.data.phrases.map((x) => x.due).filter(Boolean).sort()[0];
      return `<section class="card review"><h2>今日の復習は完了です</h2><p class="muted">次の復習予定：${next ? DM.fmtDate(next) : '—'}</p></section>`;
    }
    const x = due[0];
    return `<section class="card review">
      <span class="label-s">残り ${due.length}${x.weak ? '・苦手' : ''}</span>
      <div class="q">${esc(x.meaning || '（意味未登録）')}</div>
      ${x.scene ? `<div class="f-hint">場面：${esc(x.scene)}</div>` : ''}
      ${reviewShow ? `<div class="a en-text">${esc(x.phrase)}</div>${x.example ? `<div class="en-text muted"><i>${esc(x.example)}</i></div>` : ''}
        <div class="btn-row center"><button type="button" class="btn" data-act="grade" data-id="${x.id}" data-ok="0">思い出せなかった</button><button type="button" class="btn primary" data-act="grade" data-id="${x.id}" data-ok="1">思い出せた</button></div>`
      : `<p class="f-hint">英語で声に出して言ってから答えを見てください。</p><button type="button" class="btn primary" data-act="showAns">答えを見る</button>`}
      <p class="f-hint">思い出せるたびに次の復習までの間隔が 1→3→7→14→30→60日 と延び、思い出せなかったら翌日に戻ります。</p>
    </section>`;
  }
  DM.actions.showAns = () => { reviewShow = true; DM.render(); };
  DM.actions.grade = (el) => {
    reviewShow = false;
    const ok = el.dataset.ok === '1';
    M.gradePhrase(el.dataset.id, ok);
    if (!ok) DM.store.commit((d) => { const x = d.phrases.find((y) => y.id === el.dataset.id); if (x) x.weak = true; });
  };

  // ---------- 会話練習 ----------
  function talkTab(p) {
    const sc = p.sc || '';
    const prompts = S().prompts.filter((x) => !sc || x.scene === sc);
    return `<section class="card">
      <h2>決まった場面で練習する</h2>
      <ol class="steps">
        <li>練習したいプロンプトの「コピー」を押す。</li>
        <li>「ChatGPTを開く」を押す（iPhoneではChatGPTアプリが入っていればアプリで開くことがあります）。</li>
        <li>新しいチャットにプロンプトを貼り付けて送信し、入力欄の横の音声モードのボタンで話し始める。</li>
        <li>終わったら「練習時間を記録」で時間を残し、覚えたい表現を「表現・単語」に登録する。</li>
      </ol>
      <div class="btn-row"><a class="btn primary" href="${esc(S().chatgptUrl || 'https://chatgpt.com/')}" target="_blank" rel="noopener">ChatGPTを開く ↗</a>
        <button type="button" class="btn" data-act="addLog" data-cat="english" data-skill="スピーキング">練習時間を記録</button></div>
      <p class="f-hint">このサイト自体には音声会話・AI添削の機能はなく、会話内容がこのサイトに送られることもありません。ChatGPTの利用条件・料金・音声機能の有無はOpenAI側の提供内容に従います。リンク先は「設定・データ」で変更できます。</p>
    </section>
    <section class="card">
      <div class="card-head"><h2>練習用プロンプト</h2><button type="button" class="btn small" data-act="promptAdd">＋ 追加</button></div>
      <div class="toolbar"><select data-act-change="psc" aria-label="場面"><option value="">すべての場面</option>${S().englishScenes.map((s) => `<option ${s === sc ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
      ${prompts.length ? prompts.map((x) => `<div class="prompt">
        <div class="row-between"><b>${esc(x.title)}</b><span class="f-hint">${esc(x.scene || '')}</span></div>
        <pre class="prompt-text">${esc(x.text)}</pre>
        <div class="btn-row"><button type="button" class="btn small primary" data-act="copy" data-text="${esc(x.text)}">コピー</button><button type="button" class="btn small ghost" data-act="promptEdit" data-id="${x.id}">編集</button></div>
      </div>`).join('') : DM.empty('この場面のプロンプトはありません。')}
    </section>`;
  }
  function editPrompt(pr = {}) {
    const isNew = !pr.id;
    DM.openForm({
      title: isNew ? 'プロンプトを追加' : 'プロンプトを編集', values: pr,
      fields: [
        { key: 'title', label: 'タイトル', type: 'text', required: true },
        { key: 'scene', label: '場面', type: 'chips', options: S().englishScenes, allowEmpty: true },
        { key: 'text', label: 'プロンプト本文', type: 'textarea', rows: 10, required: true },
      ],
      onSave: (x) => {
        DM.store.commit((d) => {
          const list = d.settings.prompts;
          const i = list.findIndex((y) => y.id === pr.id);
          const item = { id: pr.id || DM.uid('pr_'), title: x.title.trim(), scene: x.scene || '', text: x.text };
          if (i >= 0) list[i] = item; else list.push(item);
        });
        DM.toast('保存しました');
      },
      onDelete: isNew ? null : () => {
        const before = JSON.stringify(DM.store.data);
        DM.store.commit((d) => { d.settings.prompts = d.settings.prompts.filter((y) => y.id !== pr.id); });
        DM.toast('削除しました', { undo: () => DM.store.restoreJSON(before) });
      },
    });
  }
  DM.actions.promptAdd = () => editPrompt();
  DM.actions.promptEdit = (el) => editPrompt(S().prompts.find((x) => x.id === el.dataset.id));

  const TABS = [['overview', '概要'], ['logs', '記録'], ['diary', '英語日記'], ['transcript', '書き写し'], ['phrases', '表現・単語'], ['review', '復習'], ['talk', '会話練習']];
  DM.views.english = {
    title: '英語',
    render(p) {
      const tab = p.tab || 'overview';
      const due = M.duePhrases().length;
      const tabs = TABS.map(([v, l]) => [v, v === 'review' && due ? `${l} ${due}` : l]);
      const body = { overview, logs: logsTab, diary: diaryTab, transcript: DM.enTranscriptTab, phrases: phrasesTab, review: reviewTab, talk: (q) => DM.enTalkBuilder() + talkTab(q) }[tab] || overview;
      return `${DM.seg('tab', tabs, tab)}${body(p)}`;
    },
    after(root) {
      DM.enTranscriptAfter(root);
      DM.enTalkAfter(root);
      const ta = root.querySelector('#ed_text');
      if (!ta) return;
      const { params } = DM.route();
      const save = () => {
        document.getElementById('ed_wc').textContent = `${DM.wordCount(ta.value)} 語`;
        if (!params.id) setDraft(readDiary()); // 新規の下書きは自動保存
      };
      root.querySelectorAll('#ed_text,#ed_memo,#ed_corr,#ed_date,#ed_scene').forEach((el) => el.addEventListener('input', save));
    },
  };

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act-change]'); if (!el) return;
    const a = el.dataset.actChange;
    if (a === 'pf') DM.setParams({ pf: el.value });
    if (a === 'pq') DM.setParams({ q: el.value });
    if (a === 'psc') DM.setParams({ sc: el.value });
  });
})(window.DM);
