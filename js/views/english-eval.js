/* 英語：会話練習の評価
 * 1) 会話の終わりにChatGPTへ「評価用プロンプト」を貼り、決まった形式（JSON）で評価を出してもらう
 * 2) その返答をここに貼り付けて保存する
 * 3) 自分の発話から語数などを計算し、誤りの種類・覚える表現を回をまたいで集計して、次の練習に反映する
 * ChatGPTの点数は検証された尺度ではないため、目安として扱う。
 */
(function (DM) {
  const esc = DM.esc;

  const ERR_TYPES = {
    tense: { ja: '時制', tip: '過去の出来事は過去形で話せているかを意識する。英語日記を書いたあと、動詞の時制だけを見直す。' },
    article: { ja: '冠詞', tip: '数えられる名詞の単数形の前に a / the が必要かを確認する。指摘された文を冠詞ごと音読して覚える。' },
    preposition: { ja: '前置詞', tip: '前置詞は単独で覚えず、「be interested in」のように動詞・名詞との組で表現帳に登録する。' },
    word_choice: { ja: '語彙選択', tip: '日本語に1対1で対応する単語を探さず、知っている簡単な語で言い換える練習をする。' },
    word_order: { ja: '語順', tip: '疑問文・間接疑問文（Do you know where it is? など）の語順を、型として何度か口に出す。' },
    agreement: { ja: '主語と動詞の一致', tip: '主語が三人称単数のときの動詞の -s を意識して、指摘された文を言い直す。' },
    plural: { ja: '単数・複数', tip: '数えられる名詞が複数のときの -s を意識する。日記で名詞の数だけを見直す。' },
    collocation: { ja: 'コロケーション', tip: '「make a decision」「take a break」など語の組み合わせを、フレーズ単位で表現帳に入れて復習する。' },
    naturalness: { ja: '自然さ', tip: '提案された自然な言い方をそのまま音読・シャドーイングし、次の会話で1つ使ってみる。' },
    other: { ja: 'その他', tip: '指摘された文を正しい形で3回声に出して言い直す。' },
  };
  const SCORE_KEYS = [
    ['fluency', '流暢さ', '1＝単語や短い句だけ／3＝文で答えるが短い・止まりがち／5＝考えをつなげて長く話せる'],
    ['accuracy', '正確さ', '1＝誤りで意味が伝わらないことが多い／3＝誤りは多いが意味は伝わる／5＝誤りが少ない'],
    ['vocabulary', '語彙', '1＝ごく基本的な語だけで詰まりがち／3＝話題に足りるが不足もある／5＝多様で的確、専門語も使える'],
    ['interaction', 'やりとり', '1＝質問とかみ合わない／3＝質問に答えるが広げない／5＝話を広げ、質問や確認もできる'],
  ];

  DM.EVAL_PROMPT = `Our practice is over. Based on the whole conversation above, evaluate my English and reply with ONLY one JSON code block in exactly the format below.

Rules:
- Evaluate only what I (the learner) said, not your own lines.
- My speech was converted to text by speech recognition. Ignore errors that are probably recognition mistakes (missing punctuation, words that sound the same). Do not evaluate pronunciation.
- "my_utterances": copy every turn I said, in order, exactly as it appears, without correcting it.
- "errors": up to 10 of the most important mistakes. "type" must be one of: tense, article, preposition, word_choice, word_order, agreement, plural, collocation, naturalness, other.
- "scores": integers from 1 to 5 using these descriptors. Use null if it cannot be judged.
  fluency: 1 = only single words or very short phrases; 3 = complete sentences but often short or stopping; 5 = extended answers with connected ideas.
  accuracy: 1 = errors often block meaning; 3 = frequent errors but meaning is clear; 5 = few errors.
  vocabulary: 1 = very basic words only, often stuck; 3 = adequate for the topics with some gaps; 5 = varied and precise, including topic-specific words.
  interaction: 1 = answers do not match the questions; 3 = answers questions but rarely extends or asks back; 5 = develops the conversation, asks questions and clarifies.
- Write the values of keys ending in "_ja" in Japanese. Everything else in English.

\`\`\`json
{
  "topics": ["..."],
  "scores": {"fluency": 3, "accuracy": 3, "vocabulary": 3, "interaction": 3},
  "my_utterances": ["..."],
  "errors": [{"said": "...", "better": "...", "type": "article", "explanation_ja": "..."}],
  "japanese_used": [{"ja": "...", "en": "..."}],
  "expressions_to_learn": [{"phrase": "...", "meaning_ja": "...", "example": "..."}],
  "good_points_ja": ["..."],
  "next_focus_ja": ["..."],
  "summary_ja": "..."
}
\`\`\``;

  // ---------- 貼り付けられた返答の読み取り ----------
  const str = (v, n = 500) => (v == null ? '' : String(v).trim().slice(0, n));
  const arr = (v) => (Array.isArray(v) ? v : []);
  function parseReport(text) {
    let t = String(text || '').trim();
    if (!t) throw new Error('貼り付けられた文章がありません。');
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1];
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('JSONの { } が見つかりません。ChatGPTの返答のコードブロック（右上のコピーボタン）をそのまま貼り付けてください。');
    t = t.slice(a, b + 1).replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1');
    let o;
    try { o = JSON.parse(t); } catch (e) { throw new Error('JSONとして読み取れませんでした（' + e.message + '）。返答が途中で切れていないか確認してください。'); }
    const sc = o.scores || {};
    const score = (v) => { const n = Number(v); return v == null || v === '' || !Number.isFinite(n) ? null : Math.min(5, Math.max(1, Math.round(n))); };
    const r = {
      topics: arr(o.topics).map((x) => str(x, 120)).filter(Boolean).slice(0, 8),
      scores: Object.fromEntries(SCORE_KEYS.map(([k]) => [k, score(sc[k])])),
      utterances: arr(o.my_utterances).map((x) => str(x, 2000)).filter(Boolean).slice(0, 300),
      errors: arr(o.errors).map((x) => ({ said: str(x && x.said), better: str(x && x.better), type: ERR_TYPES[x && x.type] ? x.type : 'other', explanation: str(x && x.explanation_ja) })).filter((x) => x.said || x.better).slice(0, 20),
      japaneseUsed: arr(o.japanese_used).map((x) => ({ ja: str(x && x.ja, 200), en: str(x && x.en, 300) })).filter((x) => x.en).slice(0, 20),
      expressions: arr(o.expressions_to_learn).map((x) => ({ phrase: str(x && x.phrase, 200), meaning: str(x && x.meaning_ja, 200), example: str(x && x.example, 300) })).filter((x) => x.phrase).slice(0, 20),
      good: arr(o.good_points_ja).map((x) => str(x)).filter(Boolean).slice(0, 10),
      next: arr(o.next_focus_ja).map((x) => str(x)).filter(Boolean).slice(0, 10),
      summary: str(o.summary_ja, 1000),
    };
    if (!r.utterances.length && !r.errors.length && !r.expressions.length && SCORE_KEYS.every(([k]) => r.scores[k] == null)) throw new Error('評価の項目が1つも見つかりません。評価用プロンプトへの返答を貼り付けているか確認してください。');
    return r;
  }
  DM.parseTalkReport = parseReport;

  // 自分の発話から計算する値（ChatGPTが書き写した発話に基づく）
  function metrics(r) {
    const u = r.utterances;
    if (!u.length) return null;
    const wc = u.map(DM.wordCount);
    const total = DM.sum(wc);
    return {
      turns: u.length, words: total, perTurn: Math.round((total / u.length) * 10) / 10, longest: Math.max(...wc),
      jaTurns: u.filter((x) => /[぀-ヿ一-鿿]/.test(x)).length,
    };
  }
  DM.talkMetrics = metrics;

  // ---------- 回をまたいだ集計 ----------
  const sessions = () => DM.store.data.talkSessions.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || '').localeCompare(b.createdAt || ''));
  function errorCounts(list) {
    const c = {};
    for (const s of list) for (const e of s.report.errors) c[e.type] = (c[e.type] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }
  const known = () => new Set(DM.store.data.phrases.map((p) => p.phrase.toLowerCase()));
  // 表現帳にまだない、提案された表現（新しい回のものを優先）
  function suggestions(limit = 30) {
    const k = known(), seen = new Set(), out = [];
    for (const s of sessions().reverse()) {
      const add = (phrase, meaning, example, src, weak) => {
        const key = phrase.toLowerCase();
        if (!phrase || k.has(key) || seen.has(key)) return;
        seen.add(key); out.push({ phrase, meaning, example, src, weak, date: s.date });
      };
      for (const x of s.report.expressions) add(x.phrase, x.meaning, x.example, '覚えたい表現', false);
      for (const x of s.report.japaneseUsed) add(x.en, x.ja, '', '日本語で言った部分', true);
      for (const x of s.report.errors) add(x.better, `誤り（${ERR_TYPES[x.type].ja}）：${x.said}${x.explanation ? ' — ' + x.explanation : ''}`, '', '誤りの言い直し', true);
    }
    return out.slice(0, limit);
  }
  // 次の会話プロンプトに入れる内容（直近5回）
  DM.talkFocus = function () {
    const recent = sessions().slice(-5);
    if (!recent.length) return null;
    const types = errorCounts(recent).filter(([, n]) => n >= 2).slice(0, 3).map(([t]) => t);
    const exprs = suggestions(5).filter((x) => x.src === '覚えたい表現' || x.src === '日本語で言った部分').map((x) => x.phrase);
    return { types, typesEn: types.map((t) => t.replace('_', ' ')), exprs };
  };

  // ---------- 画面 ----------
  let pending = null; // 読み取った直後・保存前の評価

  function reportHTML(r, opt = {}) {
    const m = metrics(r);
    return `<div class="eval">
      ${r.topics.length ? `<p class="f-hint">話題：${r.topics.map(esc).join('／')}</p>` : ''}
      ${m ? `<div class="mini-grid">
        <div class="mini"><span>発話の回数</span><b>${m.turns}</b></div>
        <div class="mini"><span>総語数</span><b>${m.words}</b></div>
        <div class="mini"><span>1回あたりの語数</span><b>${m.perTurn}</b></div>
        <div class="mini"><span>最長の発話</span><b>${m.longest}<small>語</small></b></div>
        ${m.jaTurns ? `<div class="mini"><span>日本語を含む発話</span><b>${m.jaTurns}</b></div>` : ''}</div>` : ''}
      <div class="score-row">${SCORE_KEYS.map(([k, l]) => `<div class="score"><span>${l}</span><b>${r.scores[k] ?? '—'}</b><small>/5</small></div>`).join('')}</div>
      <p class="f-hint">語数などは、ChatGPTが書き写したあなたの発話から計算しています。1〜5の点数はChatGPTによる目安で、同じ会話でも採点がぶれることがあります。</p>
      ${r.summary ? `<p>${esc(r.summary)}</p>` : ''}
      ${r.good.length ? `<div><span class="label-s">良かった点</span><ul class="outputs">${r.good.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${r.next.length ? `<div><span class="label-s">次に意識すること</span><ul class="outputs">${r.next.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${r.errors.length ? `<div><span class="label-s">指摘された誤り（${r.errors.length}件）</span><div class="corr-list">${r.errors.map((e) => `<div class="corr">
        <span class="badge">${ERR_TYPES[e.type].ja}</span>
        <div class="en-text"><s class="from">${esc(e.said)}</s> → <b class="to">${esc(e.better)}</b></div>
        ${e.explanation ? `<div class="f-hint">${esc(e.explanation)}</div>` : ''}</div>`).join('')}</div></div>` : ''}
      ${opt.utterances && r.utterances.length ? `<details><summary>自分の発話（${r.utterances.length}回）</summary><ol class="utter">${r.utterances.map((u) => `<li class="en-text">${esc(u)}</li>`).join('')}</ol></details>` : ''}
    </div>`;
  }

  DM.enEvalTab = function (p) {
    const all = sessions();
    const topics = DM.store.data.talkTopics.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    const open = p.sid ? all.find((s) => s.id === p.sid) : null;
    const recent = all.slice(-5);
    const ec = errorCounts(all), ecRecent = errorCounts(recent);
    const sug = suggestions();
    const series = all.map((s) => ({ s, m: metrics(s.report) }));
    const labels = all.map((s) => DM.fmtShort(s.date));
    const tips = ecRecent.slice(0, 3);
    return `
    <section class="card">
      <h2>会話のあとに評価を取り込む</h2>
      <ol class="steps">
        <li>会話を終えたら、同じChatGPTのチャットに下の「評価用プロンプト」を貼り付けて送信する（音声モードは終了してから）。</li>
        <li>返ってきたコードブロックの右上のコピーボタンでコピーする。</li>
        <li>下の欄に貼り付けて「読み込む」を押し、内容を確認して保存する。</li>
      </ol>
      <div class="btn-row"><button type="button" class="btn primary" data-act="copy" data-text="${esc(DM.EVAL_PROMPT)}">評価用プロンプトをコピー</button>
        <a class="btn" href="${esc(DM.store.data.settings.chatgptUrl || 'https://chatgpt.com/')}" target="_blank" rel="noopener">ChatGPTを開く ↗</a></div>
      <details><summary>評価用プロンプトの中身を見る</summary><pre class="prompt-text">${esc(DM.EVAL_PROMPT)}</pre></details>
      <label class="f-label" for="ev_paste">ChatGPTの返答を貼り付け</label>
      <textarea id="ev_paste" rows="6" class="prompt-edit" placeholder="{ &quot;topics&quot;: ... } の形の返答をそのまま貼り付けます" spellcheck="false"></textarea>
      <div class="form-error" id="ev_err" hidden></div>
      <div class="btn-row"><button type="button" class="btn" data-act="evParse">読み込む</button></div>
      ${pending ? `<div class="eval-preview">
        <h3 class="sub-h">読み込んだ内容（まだ保存していません）</h3>
        ${reportHTML(pending, { utterances: true })}
        <div class="fields">
          <div class="field half"><label class="f-label" for="ev_date">日付</label><input id="ev_date" type="date" value="${DM.today()}"></div>
          <div class="field half"><label class="f-label" for="ev_min">会話した時間（分・任意）</label><input id="ev_min" type="number" min="0" step="5" inputmode="numeric" placeholder="例：15"></div>
          <div class="field"><label class="f-label" for="ev_topic">使った会話ネタ（任意）</label><select id="ev_topic"><option value="">（なし）</option>${topics.map((t) => `<option value="${t.id}" ${t.id === p.topic ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}</select></div>
        </div>
        <div class="btn-row"><button type="button" class="btn primary" data-act="evSave">保存する</button><button type="button" class="btn ghost" data-act="evCancel">取り消す</button></div>
        <p class="f-hint">時間を入れると英語（スピーキング）の学習時間として記録されます。</p></div>` : ''}
    </section>

    ${all.length ? `
    <div class="grid-2">
      <section class="card"><h2>繰り返している誤り</h2>
        <p class="f-hint">直近${recent.length}回で指摘された誤りの種類（ChatGPTが1回につき最大10件まで挙げたもの）。</p>
        ${ecRecent.length ? `<table class="tbl"><thead><tr><th>種類</th><th class="num">直近${recent.length}回</th><th class="num">全${all.length}回</th></tr></thead><tbody>
          ${ecRecent.map(([t, n]) => `<tr><td>${ERR_TYPES[t].ja}</td><td class="num">${n}</td><td class="num">${(ec.find(([x]) => x === t) || [, 0])[1]}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">指摘された誤りはありません。</p>'}
        ${tips.length ? `<h3 class="sub-h">対策の例</h3><ul class="outputs">${tips.map(([t]) => `<li><b>${ERR_TYPES[t].ja}</b>：${ERR_TYPES[t].tip}</li>`).join('')}</ul>
          <p class="f-hint">対策はこのアプリが用意した一般的な練習方法の例で、効果を検証したものではありません。2回以上指摘された種類は、次に作る会話ネタの指示文に自動で入ります。</p>` : ''}
      </section>
      <section class="card"><div class="card-head"><h2>覚える表現の提案 <span class="count">${sug.length}</span></h2>${sug.length ? '<button type="button" class="btn small" data-act="evAddAll">すべて表現帳へ</button>' : ''}</div>
        ${sug.length ? `<div class="phrase-list">${sug.map((x, i) => `<div class="phrase"><div class="phrase-main"><b class="en-text">${esc(x.phrase)}</b><span>${esc(x.meaning)}</span>${x.example ? `<i class="en-text">${esc(x.example)}</i>` : ''}<span class="meta">${esc(x.src)}<span class="sep">·</span>${DM.fmtShort(x.date)}</span></div>
          <button type="button" class="btn small" data-act="evAdd" data-i="${i}">追加</button></div>`).join('')}</div>
          <p class="f-hint">「日本語で言った部分」「誤りの言い直し」から追加した表現は、苦手リストに入り復習で優先されます。</p>` : '<p class="muted">表現帳にまだない提案はありません。</p>'}
      </section>
    </div>
    ${all.length >= 2 ? `<section class="card"><h2>推移</h2>
      <h3 class="sub-h">1回あたりの語数（自分の発話から計算）</h3>
      ${DM.charts.place({ type: 'line', labels, tipLabels: all.map((s) => DM.fmtDate(s.date)), series: [{ name: '1回あたりの語数', color: 'var(--s2)', values: series.map((x) => (x.m ? x.m.perTurn : null)) }], height: 150 })}
      <h3 class="sub-h">ChatGPTによる点数（1〜5・目安）</h3>
      ${DM.charts.place({ type: 'line', labels, tipLabels: all.map((s) => DM.fmtDate(s.date)), series: SCORE_KEYS.map(([k, l], i) => ({ name: l, color: `var(--s${[1, 3, 7, 5][i]})`, values: all.map((s) => s.report.scores[k]) })), yMin: 0, yMax: 5, height: 170 })}
      <p class="f-hint">点数の変化は、実力の変化だけでなく、話題の難しさや採点のぶれも反映します。語数の推移と合わせて、大まかな傾向として見てください。</p>
    </section>` : '<p class="f-hint">2回以上保存すると推移のグラフが表示されます。</p>'}
    <section class="card"><h2>評価の記録 <span class="count">${all.length}</span></h2>
      <div class="diary-list">${all.slice().reverse().map((s) => { const m = metrics(s.report); return `<button type="button" class="diary-item ${open && open.id === s.id ? 'on' : ''}" data-act="evOpen" data-id="${s.id}">
        <span class="row-between"><b>${DM.fmtDate(s.date)}</b><span class="f-hint">${m ? `${m.turns}回・平均${m.perTurn}語` : ''}${s.minutes ? '・' + DM.fmtMin(s.minutes) : ''}</span></span>
        <span class="clamp">${esc(s.report.topics.join('／') || s.report.summary)}</span></button>`; }).join('')}</div>
      ${open ? `<div class="eval-open">${reportHTML(open.report, { utterances: true })}<div class="btn-row"><button type="button" class="btn small danger ghost" data-act="evDel" data-id="${open.id}">この評価を削除</button></div></div>` : ''}
    </section>` : '<section class="card"><p class="muted">まだ評価の記録がありません。最初の会話のあとに上の手順で取り込むと、誤りの傾向・覚える表現・推移が表示されます。</p></section>'}`;
  };

  DM.actions.evParse = () => {
    const err = document.getElementById('ev_err');
    try { pending = parseReport(document.getElementById('ev_paste').value); err.hidden = true; DM.render(); }
    catch (e) { err.textContent = e.message; err.hidden = false; }
  };
  DM.actions.evCancel = () => { pending = null; DM.render(); };
  DM.actions.evSave = () => {
    if (!pending) return;
    const date = document.getElementById('ev_date').value || DM.today();
    const minRaw = document.getElementById('ev_min').value;
    const minutes = minRaw === '' ? null : Math.round(Number(minRaw));
    if (minutes != null && !(minutes >= 0 && minutes <= 1440)) return DM.toast('時間は0〜1440分で入力してください', { error: true });
    const topicId = document.getElementById('ev_topic').value;
    const id = DM.uid('ts_');
    DM.store.commit((d) => {
      const s = { id, date, topicId, minutes, report: pending, createdAt: DM.nowISO() };
      if (minutes > 0) {
        const log = { id: DM.uid('l_'), date, cat: 'english', minutes, skill: d.settings.englishSkills.includes('スピーキング') ? 'スピーキング' : '', scene: '', note: 'ChatGPT会話練習' + (pending.topics.length ? '：' + pending.topics.slice(0, 2).join('／') : ''), talkSessionId: id, createdAt: DM.nowISO() };
        d.logs.push(log); s.logId = log.id;
      }
      if (topicId) { const t = d.talkTopics.find((x) => x.id === topicId); if (t) t.practicedAt = date; }
      d.talkSessions.push(s);
    });
    pending = null;
    DM.toast('評価を保存しました');
    DM.setParams({ sid: id, topic: '' });
  };
  DM.actions.evOpen = (el) => { const { params } = DM.route(); DM.setParams({ sid: params.sid === el.dataset.id ? '' : el.dataset.id }); };
  DM.actions.evDel = async (el) => {
    if (!(await DM.confirm('この評価を削除しますか？（連動する学習時間の記録も削除されます）', { danger: true, ok: '削除' }))) return;
    const before = JSON.stringify(DM.store.data);
    DM.store.commit((d) => { d.talkSessions = d.talkSessions.filter((s) => s.id !== el.dataset.id); d.logs = d.logs.filter((l) => l.talkSessionId !== el.dataset.id); });
    DM.toast('削除しました', { undo: () => DM.store.restoreJSON(before) });
    DM.setParams({ sid: '' });
  };
  function addPhrases(list) {
    const k = known();
    const items = list.filter((x) => !k.has(x.phrase.toLowerCase()));
    if (!items.length) return 0;
    DM.store.commit((d) => { for (const x of items) d.phrases.push({ id: DM.uid('ph_'), phrase: x.phrase, meaning: x.meaning, example: x.example, scene: '', weak: !!x.weak, box: 0, due: DM.today(), source: 'talk', createdAt: DM.nowISO() }); });
    return items.length;
  }
  DM.actions.evAdd = (el) => { const x = suggestions()[Number(el.dataset.i)]; if (x && addPhrases([x])) DM.toast('表現帳に追加しました'); };
  DM.actions.evAddAll = () => { const n = addPhrases(suggestions()); DM.toast(`${n}件を表現帳に追加しました`); };
})(window.DM);
