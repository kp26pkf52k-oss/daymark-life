/* 英語：書き写し（タイピングでの書き写し記録）と、日記・書き写しから作る会話練習プロンプト
 * プロンプトはこの端末内で文章を組み立てるだけで、外部には送らない。ChatGPTへはコピーして貼り付ける。
 */
(function (DM) {
  const esc = DM.esc;
  const S = () => DM.store.data.settings;

  // ---------- 書き写し ----------
  const DRAFT = 'daymark.trDraft';
  const getDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; } };
  const setDraft = (v) => { try { localStorage.setItem(DRAFT, JSON.stringify(v)); } catch { /* ignore */ } };
  let lastSel = '';

  DM.enTranscriptTab = function (p) {
    const list = DM.store.data.transcripts.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    const editing = p.id ? list.find((e) => e.id === p.id) : null;
    const dr = getDraft();
    const skills = S().englishSkills;
    const cur = editing || (dr || { date: DM.today(), source: '', text: '', memo: '', minutes: null, skill: skills.includes('ライティング') ? 'ライティング' : '' });
    const sources = [...new Set(list.map((e) => e.source).filter(Boolean))];
    const words = DM.sum(list.map((e) => DM.wordCount(e.text)));
    return `<div class="grid-2 wide-left">
      <section class="card">
        <div class="card-head"><h2>${editing ? '書き写しを編集' : '書き写しを入力'}</h2>${editing ? '<button type="button" class="btn small" data-act="trNew">新しく入力</button>' : ''}</div>
        <div class="fields">
          <div class="field half"><label class="f-label" for="tr_date">日付</label><input id="tr_date" type="date" value="${esc(cur.date)}"></div>
          <div class="field half"><label class="f-label" for="tr_source">教材・出典</label><input id="tr_source" type="text" list="tr_sources" value="${esc(cur.source)}" placeholder="例：教材名 Unit 3、論文のAbstract" autocomplete="off">
            <datalist id="tr_sources">${sources.map((s) => `<option value="${esc(s)}"></option>`).join('')}</datalist></div>
        </div>
        <textarea id="tr_text" class="paper" rows="10" spellcheck="true" lang="en" placeholder="書き写す英文をここに打ち込みます。">${esc(cur.text)}</textarea>
        <div class="row-between"><span class="f-hint" id="tr_wc">${DM.wordCount(cur.text)} 語</span>
          <button type="button" class="btn small" data-act="trPhrase">選択した部分を表現帳に追加</button></div>
        <div class="field"><label class="f-label" for="tr_memo">気づき・覚えたい表現（任意）</label><textarea id="tr_memo" rows="3" placeholder="例：be associated with ～と関連がある／意味が分からなかった語">${esc(cur.memo)}</textarea></div>
        <div class="fields">
          <div class="field half"><label class="f-label" for="tr_min">かかった時間（分・任意）</label><input id="tr_min" type="number" min="0" step="5" inputmode="numeric" value="${cur.minutes ?? ''}"></div>
          <div class="field half"><label class="f-label" for="tr_skill">技能として記録</label><select id="tr_skill"><option value="">（なし）</option>${skills.map((s) => `<option ${s === cur.skill ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        </div>
        <div class="btn-row">
          <button type="button" class="btn primary" data-act="trSave">保存</button>
          ${editing ? `<button type="button" class="btn" data-act="trTalk" data-id="${editing.id}">この内容で会話ネタを作る</button>` : ''}
          ${editing ? `<button type="button" class="btn danger ghost" data-act="trDel" data-id="${editing.id}">削除</button>` : ''}
        </div>
        <p class="f-hint">時間を入れると英語の学習時間として集計されます。新しく入力中の内容は下書きとして自動で残ります。</p>
      </section>
      <section class="card"><h2>これまでの書き写し <span class="count">${list.length}</span></h2>
        ${list.length ? `<p class="f-hint">累計 ${words.toLocaleString()} 語</p><div class="diary-list">${list.map((e) => `<button type="button" class="diary-item ${editing && editing.id === e.id ? 'on' : ''}" data-act="trOpen" data-id="${e.id}">
          <span class="row-between"><b>${DM.fmtDate(e.date)}</b><span class="f-hint">${DM.wordCount(e.text)}語${e.minutes ? '・' + DM.fmtMin(e.minutes) : ''}</span></span>
          ${e.source ? `<span class="f-hint">${esc(e.source)}</span>` : ''}<span class="clamp en-text">${esc(e.text)}</span></button>`).join('')}</div>` : DM.empty('まだ書き写しの記録がありません。')}
      </section></div>`;
  };

  const readTr = () => ({
    date: document.getElementById('tr_date').value || DM.today(),
    source: document.getElementById('tr_source').value.trim(),
    text: document.getElementById('tr_text').value,
    memo: document.getElementById('tr_memo').value,
    minutes: document.getElementById('tr_min').value === '' ? null : Math.round(Number(document.getElementById('tr_min').value)),
    skill: document.getElementById('tr_skill').value,
  });
  DM.enTranscriptAfter = function (root) {
    const ta = root.querySelector('#tr_text');
    if (!ta) return;
    const { params } = DM.route();
    const remember = () => { if (ta.selectionEnd > ta.selectionStart) lastSel = ta.value.slice(ta.selectionStart, ta.selectionEnd).trim(); };
    ['select', 'keyup', 'mouseup', 'touchend'].forEach((ev) => ta.addEventListener(ev, remember));
    document.addEventListener('selectionchange', () => { if (document.activeElement === ta) remember(); });
    root.querySelectorAll('#tr_date,#tr_source,#tr_text,#tr_memo,#tr_min,#tr_skill').forEach((el) => el.addEventListener('input', () => {
      document.getElementById('tr_wc').textContent = `${DM.wordCount(ta.value)} 語`;
      if (!params.id) setDraft(readTr());
    }));
  };
  DM.actions.trNew = () => { setDraft(null); DM.setParams({ id: '' }); };
  DM.actions.trOpen = (el) => DM.setParams({ id: el.dataset.id });
  DM.actions.trSave = () => {
    const { params } = DM.route();
    const v = readTr();
    if (!v.text.trim()) return DM.toast('英文を入力してください', { error: true });
    if (v.minutes != null && (v.minutes < 0 || v.minutes > 1440)) return DM.toast('時間は0〜1440分で入力してください', { error: true });
    const id = params.id || DM.uid('tr_');
    DM.store.commit((d) => {
      let t = d.transcripts.find((x) => x.id === id);
      if (!t) { t = { id, createdAt: DM.nowISO() }; d.transcripts.push(t); }
      Object.assign(t, v, { updatedAt: DM.nowISO() });
      // 時間を入れた場合は英語の学習時間として連動する記録を作る（時間を消したら記録も消す）
      const li = t.logId ? d.logs.findIndex((l) => l.id === t.logId) : -1;
      if (v.minutes > 0) {
        const base = li >= 0 ? d.logs[li] : { id: DM.uid('l_'), createdAt: DM.nowISO() };
        const log = { ...base, date: v.date, cat: 'english', minutes: v.minutes, skill: v.skill, scene: base.scene || '', note: '書き写し' + (v.source ? '：' + v.source : ''), transcriptId: id };
        if (li >= 0) d.logs[li] = log; else d.logs.push(log);
        t.logId = log.id;
      } else if (li >= 0) { d.logs.splice(li, 1); t.logId = ''; }
    });
    setDraft(null);
    DM.toast('書き写しを保存しました');
    DM.setParams({ id });
  };
  DM.actions.trDel = async (el) => {
    if (!(await DM.confirm('この書き写しを削除しますか？（連動する学習時間の記録も削除されます）', { danger: true, ok: '削除' }))) return;
    const before = JSON.stringify(DM.store.data);
    DM.store.commit((d) => { d.transcripts = d.transcripts.filter((x) => x.id !== el.dataset.id); d.logs = d.logs.filter((l) => l.transcriptId !== el.dataset.id); });
    DM.toast('削除しました', { undo: () => DM.store.restoreJSON(before) });
    DM.setParams({ id: '' });
  };
  DM.actions.trPhrase = () => {
    const ta = document.getElementById('tr_text');
    const sel = ta && ta.selectionEnd > ta.selectionStart ? ta.value.slice(ta.selectionStart, ta.selectionEnd).trim() : lastSel;
    if (!sel) return DM.toast('先に英文の中の表現を選択してください', { error: true });
    // 選んだ表現を含む1文を例文として入れる
    const sentence = (ta.value.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) || []).find((x) => x.includes(sel.replace(/\s+/g, ' '))) || '';
    DM.editPhrase({ phrase: sel.slice(0, 200), example: sentence.trim().slice(0, 300) });
  };

  // ---------- 会話ネタ（ChatGPT用プロンプト） ----------
  const SCENE_ROLE = {
    日常: 'Talk with me as a friendly native speaker friend.',
    旅行: 'Talk with me as a local person I meet while traveling abroad.',
    研究: 'Talk with me as a sport science researcher from overseas who is visiting my lab.',
    大学案内: 'Talk with me as a visiting researcher whom I am showing around my university.',
    野球: 'Talk with me as a baseball coach and fan from the United States.',
  };
  const MAX_CHARS = 1500; // 1つの素材あたりの上限文字数（長すぎる貼り付けを避ける）
  const clip = (s) => (s.length > MAX_CHARS ? s.slice(0, MAX_CHARS) + ' …(以下省略)' : s);

  function materials(days) {
    const d = DM.store.data, from = DM.addDays(DM.today(), -(days - 1));
    const out = [];
    for (const t of d.transcripts) if (t.date >= from && t.text.trim()) out.push({ type: 'tr', id: t.id, date: t.date, label: '書き写し' + (t.source ? `（${t.source}）` : ''), preview: t.text });
    for (const e of d.enDiary) if (e.date >= from && e.text.trim()) out.push({ type: 'en', id: e.id, date: e.date, label: '英語日記', preview: e.corrected || e.text });
    for (const [k, x] of Object.entries(d.days)) {
      const ja = [x.diary, x.good && '良かったこと：' + x.good, x.improve && '改善したいこと：' + x.improve].filter(Boolean).join('\n');
      if (k >= from && ja.trim()) out.push({ type: 'ja', id: k, date: k, label: '日記（日本語）', preview: ja });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));
  }

  function materialText(m) {
    const d = DM.store.data;
    if (m.type === 'tr') {
      const t = d.transcripts.find((x) => x.id === m.id);
      return `[A passage I copied${t.source ? ` from "${t.source}"` : ''}, ${t.date}]\n"""\n${clip(t.text.trim())}\n"""${t.memo ? `\n(My notes in Japanese: ${clip(t.memo.trim())})` : ''}`;
    }
    if (m.type === 'en') {
      const e = d.enDiary.find((x) => x.id === m.id);
      return `[My English diary, ${e.date}${e.corrected ? ', corrected version' : ''}]\n"""\n${clip((e.corrected || e.text).trim())}\n"""`;
    }
    return `[My diary in Japanese, ${m.date}. Use it only as topic ideas, and help me say these things in English.]\n"""\n${clip(m.preview.trim())}\n"""`;
  }

  // opt: {items:[material], minutes, scene, japanese:boolean, weak:boolean}
  DM.buildTalkPrompt = function (opt) {
    if (!opt.items.length) return '';
    const weak = opt.weak ? DM.store.data.phrases.filter((p) => p.weak).slice(0, 8).map((p) => p.phrase) : [];
    const hasTr = opt.items.some((m) => m.type === 'tr');
    const hasDiary = opt.items.some((m) => m.type !== 'tr');
    const role = SCENE_ROLE[opt.scene] || (opt.scene ? `Setting: ${opt.scene}. Play a natural partner for this setting.` : 'Talk with me as a friendly conversation partner.');
    const steps = [
      'First, read the materials below and pick 3 or 4 conversation topics from them. Tell me the topics in one short line each, then start with the first one.',
      hasTr ? 'For the passage I copied: ask me to explain what it says in my own words, then ask about my opinion or my own experience related to it. Encourage me to reuse expressions from the passage.' : '',
      hasDiary ? 'For my diary: ask follow-up questions about what happened, why, and how I felt, like a friend or a lab colleague would.' : '',
      'Ask one question at a time. Keep your turns short (1 to 3 sentences) so that I speak more than you.',
      'If I make a mistake that makes my meaning unclear, briefly say a more natural version ("You could say: ...") and continue the conversation.',
      opt.japanese ? 'If I get stuck, I may say a word or phrase in Japanese. Tell me how to say it in English, and let me try the sentence again.' : 'Please speak only in English, even if I get stuck. Give me hints in simple English instead.',
      weak.length ? `Try to create chances for me to use these expressions I am practicing: ${weak.map((w) => `"${w}"`).join(', ')}.` : '',
      `When I say "feedback", stop and give me: 3 useful expressions from today's topics, 2 mistakes I repeated with corrections, and a better version of one of my answers that I can read aloud.`,
    ].filter(Boolean);
    return `Let's practice English conversation by voice. Use my materials below as the topics.

About me: I am a Japanese graduate student in sport science, researching baseball. My goal is to be able to work and do research in English abroad.
${role}

How to run the session (I have about ${opt.minutes} minutes; I will say "feedback" when I want to finish):
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

This is a spoken conversation, so do not use bullet points or long explanations while we talk. Start now by telling me the topics and asking the first question.

Materials:
${opt.items.map(materialText).join('\n\n')}`;
  };

  // 画面上の選択状態（ページ内だけで保持）
  const ui = { days: 7, picked: null, minutes: 15, scene: '', japanese: true, weak: true };

  DM.enTalkBuilder = function () {
    const ms = materials(ui.days);
    if (ui.picked == null) {
      // 初期状態：最新の書き写しと最新の英語日記を選んでおく
      ui.picked = new Set([ms.find((m) => m.type === 'tr'), ms.find((m) => m.type === 'en')].filter(Boolean).map((m) => m.type + ':' + m.id));
    }
    const items = ms.filter((m) => ui.picked.has(m.type + ':' + m.id));
    const prompt = DM.buildTalkPrompt({ items, ...ui });
    const weakN = DM.store.data.phrases.filter((p) => p.weak).length;
    const saved = DM.store.data.talkTopics.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return `<section class="card">
      <h2>日記・書き写しから会話ネタを作る</h2>
      <p class="f-hint">使う素材を選ぶと、ChatGPTにそのまま貼り付けられる会話練習の指示文ができます。素材から話題を選び質問するのはChatGPT側で、このサイトは指示文を組み立てるだけです。</p>
      <div class="toolbar"><label class="inline">期間<select id="tk_days">${[3, 7, 14, 30].map((n) => `<option value="${n}" ${n === ui.days ? 'selected' : ''}>直近${n}日</option>`).join('')}</select></label></div>
      ${ms.length ? `<div class="pick-list">${ms.map((m) => { const k = m.type + ':' + m.id; return `<label class="pick"><input type="checkbox" data-pick="${esc(k)}" ${ui.picked.has(k) ? 'checked' : ''}>
        <span><b>${DM.fmtShort(m.date)} ${esc(m.label)}</b><span class="clamp ${m.type === 'ja' ? '' : 'en-text'}">${esc(m.preview)}</span></span></label>`; }).join('')}</div>`
        : DM.empty(`直近${ui.days}日の書き写し・英語日記・日記がありません。`, '<button type="button" class="btn" data-act="go" data-view="english" data-params=\'{"tab":"transcript"}\'>書き写しを入力する</button>')}
      <div class="fields">
        <div class="field half"><label class="f-label" for="tk_scene">場面</label><select id="tk_scene"><option value="">指定なし</option>${S().englishScenes.map((s) => `<option ${s === ui.scene ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field half"><label class="f-label" for="tk_min">練習時間</label><select id="tk_min">${[10, 15, 20, 30].map((n) => `<option value="${n}" ${n === ui.minutes ? 'selected' : ''}>${n}分</option>`).join('')}</select></div>
      </div>
      <label class="check"><input type="checkbox" id="tk_ja" ${ui.japanese ? 'checked' : ''}> 詰まったら日本語を混ぜてもよい</label>
      <label class="check"><input type="checkbox" id="tk_weak" ${ui.weak ? 'checked' : ''} ${weakN ? '' : 'disabled'}> 苦手リストの表現を使う機会を作ってもらう（${weakN}件）</label>
      <label class="f-label" for="tk_prompt">できあがった指示文（直接書き換えてからコピーできます。上の選択を変えると作り直されます）</label>
      <textarea id="tk_prompt" class="prompt-edit" rows="12" spellcheck="false">${esc(prompt)}</textarea>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="tkCopy" ${prompt ? '' : 'disabled'}>コピー</button>
        <a class="btn" href="${esc(S().chatgptUrl || 'https://chatgpt.com/')}" target="_blank" rel="noopener">ChatGPTを開く ↗</a>
        <button type="button" class="btn" data-act="tkSave" ${prompt ? '' : 'disabled'}>ネタ帳に保存</button>
      </div>
      <p class="f-hint">使い方：コピー → ChatGPTを開く → 新しいチャットに貼り付けて送信 → 音声モードに切り替えて話す。素材の英文はそのままChatGPTに送られるので、他人の個人情報などが含まれていないか確認してから貼り付けてください。</p>
    </section>
    <section class="card"><h2>ネタ帳 <span class="count">${saved.length}</span></h2>
      ${saved.length ? `<div class="log-list">${saved.map((t) => `<div class="topic-row">
        <div class="topic-main"><b>${esc(t.title)}</b><span class="f-hint">${DM.fmtDate(t.createdAt.slice(0, 10))} 作成${t.practicedAt ? `・${DM.fmtDate(t.practicedAt)} 練習済み` : ''}</span></div>
        <div class="btn-row"><button type="button" class="btn small primary" data-act="copy" data-text="${esc(t.prompt)}">コピー</button>
          <button type="button" class="btn small" data-act="tkDone" data-id="${t.id}">練習した</button>
          <button type="button" class="btn small danger ghost" data-act="tkDel" data-id="${t.id}">削除</button></div></div>`).join('')}</div>`
        : '<p class="muted">保存したネタはここに残り、あとで同じ指示文をコピーして練習できます。</p>'}
    </section>`;
  };

  DM.enTalkAfter = function (root) {
    const box = root.querySelector('#tk_prompt');
    if (!box) return;
    const rerender = () => DM.render(); // 選択を変えると指示文を作り直す
    root.querySelector('#tk_days').addEventListener('change', (e) => { ui.days = Number(e.target.value); rerender(); });
    root.querySelector('#tk_scene').addEventListener('change', (e) => { ui.scene = e.target.value; rerender(); });
    root.querySelector('#tk_min').addEventListener('change', (e) => { ui.minutes = Number(e.target.value); rerender(); });
    root.querySelector('#tk_ja').addEventListener('change', (e) => { ui.japanese = e.target.checked; rerender(); });
    root.querySelector('#tk_weak').addEventListener('change', (e) => { ui.weak = e.target.checked; rerender(); });
    root.querySelectorAll('[data-pick]').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) ui.picked.add(cb.dataset.pick); else ui.picked.delete(cb.dataset.pick);
      rerender();
    }));
  };
  DM.actions.trTalk = (el) => {
    const t = DM.store.data.transcripts.find((x) => x.id === el.dataset.id);
    if (!t) return;
    const age = DM.diffDays(t.date, DM.today()) + 1;
    if (age > ui.days) ui.days = [3, 7, 14, 30].find((n) => n >= age) || 30;
    if (ui.picked == null) ui.picked = new Set();
    ui.picked.add('tr:' + t.id);
    DM.go('english', { tab: 'talk' });
  };
  DM.actions.tkCopy = () => DM.copyText(document.getElementById('tk_prompt').value);
  DM.actions.tkSave = () => {
    const prompt = document.getElementById('tk_prompt').value;
    if (!prompt.trim()) return;
    const ms = materials(ui.days).filter((m) => ui.picked.has(m.type + ':' + m.id));
    const title = ms.map((m) => `${DM.fmtShort(m.date)} ${m.label}`).join('・') || '会話ネタ';
    DM.store.upsert('talkTopics', { id: DM.uid('tk_'), title: (ui.scene ? `［${ui.scene}］` : '') + title, prompt, sources: ms.map((m) => ({ type: m.type, id: m.id })) });
    DM.toast('ネタ帳に保存しました');
  };
  DM.actions.tkDone = (el) => {
    DM.store.commit((d) => { const t = d.talkTopics.find((x) => x.id === el.dataset.id); if (t) t.practicedAt = DM.today(); });
    DM.editLog({}, { cat: 'english', date: DM.today(), skill: 'スピーキング', minutes: ui.minutes });
  };
  DM.actions.tkDel = async (el) => {
    if (await DM.confirm('このネタを削除しますか？', { danger: true, ok: '削除' })) DM.removeWithUndo('talkTopics', el.dataset.id);
  };
})(window.DM);
