/* DAYMARK LIFE — 動作確認テスト（Playwright）
 * 使い方：  node tests/e2e.js            （daymark-life フォルダで実行）
 * iPhone相当の画面で全ページを操作し、追加・編集・削除・元に戻す・再読み込み後の保持・
 * 書き出し/読み込みを確認する。改修後はこれが通ることを確認してから公開する。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { failures++; console.log('  ✗ ' + msg); } };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const BASE = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Tokyo', acceptDownloads: true });
  await ctx.addInitScript(() => { window.DM_NO_SW = true; });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const go = async (h) => { await page.goto(BASE + '#/' + h); await page.waitForTimeout(120); };
  const sheet = () => page.locator('.sheet-wrap').last();
  const fill = (key, v) => sheet().locator(`[data-key="${key}"]`).fill(String(v));
  const chip = (key, label) => sheet().locator(`[data-chips="${key}"] .chip`, { hasText: label }).first().click();
  const save = async () => { await sheet().locator('button[type=submit]').click(); await page.waitForTimeout(120); };
  const data = () => page.evaluate(() => JSON.parse(localStorage.getItem('daymark.data')));
  const vas = (key, v) => sheet().locator(`[data-vas="${key}"] input[type=range]`).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()));

  console.log('ホーム');
  await go('home');
  ok(await page.locator('.tiles .tile').count() === 3, '研究・英語・運動のタイルが表示される');

  console.log('研究プロジェクト・タスク');
  await go('research?tab=projects');
  await page.click('[data-act="addProject"]');
  await fill('name', '研究課題1');
  await fill('goal', '初稿を書く');
  await save();
  ok((await data()).projects.length === 1, 'プロジェクトを追加できる');
  await page.click('[data-act="openProject"]');
  await page.click('[data-act="addTask"]');
  await fill('title', '統計解析');
  await chip('priority', '高');
  await fill('due', today);
  await save();
  let d = await data();
  ok(d.tasks.length === 1 && d.tasks[0].projectId === d.projects[0].id && d.tasks[0].priority === 'high', 'プロジェクトにタスクを追加できる');
  await page.click('[data-act="toggleTask"]');
  ok((await data()).tasks[0].done === true, 'タスクを完了にできる');
  ok(await page.locator('.kpi-line', { hasText: '進捗' }).first().textContent().then((t) => t.includes('100%')), 'タスク完了率から進捗が計算される');
  await page.click('[data-act="editTask"]');
  await fill('title', '統計解析（修正）');
  await save();
  ok((await data()).tasks[0].title === '統計解析（修正）', 'タスクを編集できる');
  await page.click('[data-act="editTask"]');
  await sheet().locator('[data-del]').click();
  await sheet().locator('[data-yes]').click();
  await page.waitForTimeout(100);
  ok((await data()).tasks.length === 0, 'タスクを削除できる');
  await page.click('.toast-btn');
  await page.waitForTimeout(100);
  ok((await data()).tasks.length === 1, '削除を元に戻せる');

  console.log('研究時間の記録（＋ボタン）');
  await go('home');
  await page.click('.tabbar [data-act="quick"]');
  await sheet().locator('[data-q="log"][data-cat="research"]').click();
  await sheet().locator('[data-setmin="minutes"][data-v="90"]').click();
  await chip('sub', 'データ分析');
  await fill('output', '図を3枚作成');
  await fill('start', '09:00');
  await save();
  d = await data();
  ok(d.logs.length === 1 && d.logs[0].minutes === 90 && d.logs[0].output === '図を3枚作成', '研究時間と成果メモを記録できる');
  ok((await page.textContent('.tiles')).includes('1時間30分'), 'ホームに今日の研究時間が反映される');

  console.log('予定と実績');
  await go(`calendar?v=day&d=${today}`);
  await page.locator('.card-head [data-act="addEvent"]').first().click();
  await fill('title', '英会話練習');
  await chip('cat', '英語');
  await fill('start', '19:00');
  await fill('end', '20:00');
  await save();
  ok((await data()).events.length === 1, '予定を追加できる');
  ok(await page.locator('.tl-block.plan').count() === 1, '24時間表に予定が表示される');
  await page.click('.tl-block.plan');
  await chip('status', '実施した');
  ok(await sheet().locator('[data-key="actualMin"]').inputValue() === '60', '「実施した」で予定時間が実績の初期値に入る');
  await fill('actualMin', 45);
  await save();
  d = await data();
  ok(d.logs.length === 2 && d.logs.some((l) => l.eventId && l.minutes === 45 && l.cat === 'english'), '予定の実績が時間記録に反映される');
  ok(await page.locator('.tl-block.actual').count() === 2, '実績が24時間表に表示される');
  await page.click('.tl-block.plan');
  await chip('status', '実施しなかった');
  await save();
  d = await data();
  ok(d.logs.length === 1 && d.events[0].status === 'cancel', '「実施しなかった」に変えると実績が取り消される');
  for (const v of ['week', 'month', 'tasks']) {
    await page.click(`[data-seg="v"][data-v="${v}"]`); await page.waitForTimeout(80);
    ok(!(await page.textContent('#view')).includes('エラー'), `予定表「${v}」表示に切り替えられる`);
  }
  await go(`calendar?v=day&d=${today}`);
  await page.click('[data-act="calDate"][aria-label="次へ"]');
  ok(page.url().includes('d='), '日付を切り替えられる');

  console.log('コンディション');
  await go('condition');
  await page.locator('[data-act="editCond"]').first().click();
  await vas('physFatigue', 70);
  await vas('focus', 40);
  await fill('bed', '23:30');
  await fill('wake', '06:30');
  await save();
  d = await data();
  const c = d.conditions[today];
  ok(c && c.physFatigue === 70 && c.focus === 40 && c.stress === undefined, '触れた項目だけが保存され、未入力は保存されない');
  ok(c && c.bed === '23:30' && c.wake === '06:30', '就寝・起床時刻を保存できる');
  ok((await page.textContent('.cond-tbl')).includes('7.0h'), '睡眠時間が日をまたいで計算される（7.0時間）');
  ok(await page.locator('.chart svg path.line').count() >= 1, '推移の折れ線グラフが描画される');

  console.log('運動');
  await go('exercise');
  await page.locator('.btn-row [data-act="addLog"]').click();
  await chip('exType', 'ランニング');
  await fill('minutes', 30);
  await sheet().locator('[data-chips="rpe"] .chip', { hasText: '5' }).first().click();
  await save();
  d = await data();
  const ex = d.logs.find((l) => l.cat === 'exercise');
  ok(ex && ex.rpe === 5 && ex.exType === 'ランニング', '種目・時間・RPEを記録できる');
  ok((await page.textContent('#view')).includes('150 AU'), 'セッションRPE負荷（5×30=150 AU）が表示される');

  console.log('英語');
  await go('english');
  await page.locator('.btn-row [data-act="addLog"]').click();
  await fill('minutes', 25);
  await chip('skill', 'リスニング');
  await chip('scene', '研究');
  await save();
  ok((await data()).logs.some((l) => l.cat === 'english' && l.skill === 'リスニング' && l.scene === '研究'), '学習時間を技能・場面つきで記録できる');
  await go('english?tab=diary');
  await page.fill('#ed_text', 'Today I analyzed data in the lab. [疲れた] but it was fun.');
  await page.locator('details', { hasText: '添削後の文' }).locator('summary').click();
  await page.fill('#ed_corr', 'Today I analyzed data in the lab. I was tired, but it was fun.');
  await page.click('[data-act="enSave"]');
  await page.waitForTimeout(100);
  d = await data();
  ok(d.enDiary.length === 1 && d.enDiary[0].wordCount === 11 && d.enDiary[0].corrected.includes('tired'), '英語日記と添削後の文を保存できる');
  await go('english?tab=phrases');
  await page.click('.card-head [data-act="addPhrase"]');
  await fill('phrase', 'pitch count');
  await fill('meaning', '投球数');
  await save();
  ok((await data()).phrases.length === 1, '表現を登録できる');
  await go('english?tab=review');
  await page.click('[data-act="showAns"]');
  await page.click('[data-act="grade"][data-ok="0"]');
  d = await data();
  ok(d.phrases[0].weak === true && d.phrases[0].due > today, '思い出せなかった表現は苦手リストに入り翌日に復習予定になる');
  await go('english?tab=talk');
  ok(await page.locator('.prompt').count() >= 5, '会話練習用プロンプトが表示される');
  ok(await page.locator('a[href^="https://chatgpt.com"]').count() >= 1, 'ChatGPTへのリンクがある');

  console.log('振り返り・目標・習慣');
  await go(`calendar?v=day&d=${today}`);
  await page.locator('.card', { hasText: '日記・振り返り' }).locator('[data-act="editDay"]').click();
  await vas('score', 80);
  await fill('good', '解析が進んだ');
  await fill('improve', '寝る時間');
  await save();
  d = await data();
  ok(d.days[today] && d.days[today].score === 80 && d.days[today].good === '解析が進んだ', '1日の振り返りを保存できる');
  await go('goals');
  await page.locator('[data-act="addGoal"][data-period="week"]').click();
  await fill('title', '研究を1時間');
  await sheet().locator('[data-key="metric"]').selectOption('research_min');
  await fill('target', 60);
  await save();
  ok((await page.textContent('.goal')).includes('100%'), '記録から目標の達成度が自動計算される');
  await page.locator('[data-act="toggleHabit"]:not([disabled])').last().click();
  await page.locator('[data-act="toggleRest"]:not([disabled])').last().click();
  d = await data();
  ok(Object.keys(d.days[today].habits).length === 1 && d.days[today].restDay === true && d.days[today].good === '解析が進んだ', '習慣・休息日をチェックでき、振り返りの内容は消えない');

  console.log('書き写し・会話ネタ');
  await go('english?tab=transcript');
  await page.fill('#tr_source', '教材A Unit 1');
  await page.fill('#tr_text', 'Fatigue is associated with a decline in performance. Recovery takes time.');
  await page.fill('#tr_memo', 'be associated with');
  await page.fill('#tr_min', '20');
  await page.click('[data-act="trSave"]');
  await page.waitForTimeout(100);
  d = await data();
  ok(d.transcripts.length === 1 && d.transcripts[0].source === '教材A Unit 1', '書き写しを保存できる');
  ok(d.logs.some((l) => l.transcriptId === d.transcripts[0].id && l.minutes === 20 && l.cat === 'english'), '書き写しの時間が英語の学習時間に連動する');
  await page.locator('#tr_text').evaluate((el) => { const s = 'is associated with'; const i = el.value.indexOf(s); el.focus(); el.setSelectionRange(i, i + s.length); el.dispatchEvent(new Event('select')); });
  await page.click('[data-act="trPhrase"]');
  ok(await sheet().locator('[data-key="phrase"]').inputValue() === 'is associated with', '選択した表現を表現帳の入力欄に入れられる');
  ok((await sheet().locator('[data-key="example"]').inputValue()).startsWith('Fatigue is associated'), '表現を含む1文が例文に入る');
  await save();
  ok((await data()).phrases.length === 2, '書き写しから表現を登録できる');
  await page.fill('#tr_min', '');
  await page.click('[data-act="trSave"]');
  await page.waitForTimeout(100);
  ok(!(await data()).logs.some((l) => l.transcriptId), '時間を消すと連動した学習時間も消える');
  await page.click('[data-act="trTalk"]');
  await page.waitForTimeout(150);
  let prompt = await page.inputValue('#tk_prompt');
  ok(prompt.includes('Fatigue is associated with a decline') && prompt.includes('教材A Unit 1'), '書き写しの英文が会話プロンプトに入る');
  ok(prompt.includes('Today I analyzed data'), '英語日記も初期状態で選ばれる');
  ok(prompt.includes('pitch count'), '苦手リストの表現が含まれる');
  await page.locator('[data-pick^="ja:"]').check();
  await page.waitForTimeout(100);
  ok((await page.inputValue('#tk_prompt')).includes('My diary in Japanese'), '日本語の日記も素材に追加できる');
  await page.selectOption('#tk_scene', '研究');
  await page.waitForTimeout(100);
  ok((await page.inputValue('#tk_prompt')).includes('sport science researcher from overseas'), '場面に応じた役割が入る');
  await page.click('[data-act="tkSave"]');
  await page.waitForTimeout(100);
  ok((await data()).talkTopics.length === 1, 'ネタ帳に保存できる');
  await page.click('[data-act="tkDone"]');
  await page.waitForTimeout(100);
  ok(page.url().includes('tab=talkeval') && (await data()).talkTopics[0].practicedAt, '「練習した」で練習済みになり評価の取り込み画面へ移る');

  console.log('会話の評価');
  await page.fill('#ev_paste', 'これは壊れた返答です { "topics": [ }');
  await page.click('[data-act="evParse"]');
  ok(await page.locator('#ev_err').isVisible(), '読み取れない返答にはエラーを表示する');
  const report = (n) => 'Here is your evaluation:\n```json\n' + JSON.stringify({
    topics: ['Pitching fatigue', 'Lab life'],
    scores: { fluency: 3, accuracy: n, vocabulary: 3, interaction: 4 },
    my_utterances: ['I watched a baseball game yesterday.', 'The starter threw 120 pitches and he was tired.', 'えっと, I think workload is important.'],
    errors: [{ said: 'I went to lab', better: 'I went to the lab', type: 'article', explanation_ja: '特定の研究室なので the' }, { said: 'he throw', better: 'he threw', type: 'tense', explanation_ja: '過去形' }],
    japanese_used: [{ ja: '投球数', en: 'pitch count' }, { ja: '疲労回復', en: 'recovery from fatigue' }],
    expressions_to_learn: [{ phrase: 'keep track of', meaning_ja: '記録をつける', example: 'We keep track of pitch counts.' }],
    good_points_ja: ['質問に文で答えられた'], next_focus_ja: ['冠詞'], summary_ja: '全体として意味は伝わった。',
  }) + '\n```';
  await page.fill('#ev_paste', report(2));
  await page.click('[data-act="evParse"]');
  ok((await page.textContent('.eval-preview')).includes('1回あたりの語数'), 'コードブロックつきの返答を読み取れる');
  ok((await page.textContent('.eval-preview .mini-grid')).replace(/\s/g, '').includes('総語数19'), '自分の発話から総語数を計算する');
  await page.fill('#ev_min', '15');
  ok(await page.inputValue('#ev_topic') !== '', '練習したネタが選ばれた状態になる');
  await page.click('[data-act="evSave"]');
  await page.waitForTimeout(100);
  d = await data();
  ok(d.talkSessions.length === 1 && d.talkSessions[0].report.scores.accuracy === 2 && d.logs.some((l) => l.talkSessionId && l.minutes === 15), '評価を保存し、会話時間が学習時間として記録される');
  ok((await page.textContent('#view')).includes('keep track of'), '覚える表現が提案される');
  await page.click('[data-act="evAddAll"]');
  d = await data();
  ok(d.phrases.some((x) => x.phrase === 'keep track of' && !x.weak) && d.phrases.some((x) => x.phrase === 'recovery from fatigue' && x.weak), '提案をまとめて表現帳に追加でき、日本語で言った部分は苦手リストに入る');
  await page.fill('#ev_paste', report(3));
  await page.click('[data-act="evParse"]');
  await page.click('[data-act="evSave"]');
  await page.waitForTimeout(100);
  ok(await page.locator('.chart svg path.line').count() >= 2, '2回目以降は推移のグラフが出る');
  ok((await page.textContent('#view')).includes('対策の例'), '繰り返している誤りに対策の例を表示する');
  await go('english?tab=talk');
  ok((await page.inputValue('#tk_prompt')).includes('article, tense'), '繰り返した誤りの種類が次の会話プロンプトに入る');

  console.log('分析');
  for (const p of ['4w', '12w', '6m']) {
    await go('analysis?p=' + p);
    ok(await page.locator('.chart svg').count() >= 5, `分析（${p}）のグラフが描画される`);
  }
  ok((await page.textContent('#view')).includes('相関係数は表示していません'), 'データが少ないときは相関係数を出さない');

  console.log('設定');
  await go('settings');
  await page.locator('details.set-block', { hasText: '運動の種目' }).locator('summary').click();
  await page.fill('[data-add="exerciseTypes"]', '水泳');
  await page.click('[data-act="listAdd"][data-key="exerciseTypes"]');
  ok((await data()).settings.exerciseTypes.includes('水泳'), '選択肢を追加できる');
  await page.locator('[data-act="catRename"][data-id="life"]').click();
  await fill('v', '生活');
  await save();
  ok((await data()).settings.categories.find((x) => x.id === 'life').name === '生活', 'カテゴリー名を変更できる');

  console.log('保存の保持・書き出し・読み込み');
  const before = await data();
  await page.reload(); await page.waitForTimeout(150);
  const after = await data();
  ok(after.logs.length === before.logs.length && after.logs.length === 4 && Object.keys(after.conditions).length === 1, '再読み込み後も記録が残る');
  await go('settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="exportJSON"]')]);
  const file = path.join(os.tmpdir(), 'daymark-e2e.json');
  await dl.saveAs(file);
  ok(JSON.parse(fs.readFileSync(file, 'utf8')).data.logs.length === 4, 'JSONで書き出せる');
  await page.click('[data-act="resetAll"]');
  await sheet().locator('[data-yes]').click();
  await sheet().locator('[data-yes]').click();
  await page.waitForTimeout(100);
  ok((await data()).logs.length === 0, 'すべて削除できる');
  await page.setInputFiles('[data-act-change="importFile"]', file);
  await page.waitForTimeout(150);
  await sheet().locator('[data-yes]').click();
  await page.waitForTimeout(150);
  d = await data();
  ok(d.logs.length === 4 && d.talkSessions.length === 2 && d.transcripts.length === 1 && d.talkTopics.length === 1 && d.enDiary.length === 1 && d.settings.categories.find((x) => x.id === 'life').name === '生活', '書き出したファイルから復元できる');

  console.log('全ページ表示（PC幅を含む）');
  const routes = ['home', 'calendar', 'calendar?v=week', 'calendar?v=month', 'calendar?v=tasks', 'english', 'english?tab=logs', 'english?tab=diary', 'english?tab=transcript', 'english?tab=phrases', 'english?tab=review', 'english?tab=talk', 'english?tab=talkeval',
    'research', 'research?tab=projects', 'research?tab=tasks', 'research?tab=logs', 'research?tab=weekly', 'condition', 'exercise', 'analysis', 'goals', 'settings', 'menu'];
  for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 860 }]) {
    await page.setViewportSize(vp);
    for (const r of routes) {
      await go(r);
      const t = await page.textContent('#view');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (t.includes('エラーが発生') || overflow) ok(false, `${r}（幅${vp.width}）${overflow ? '横にはみ出している' : '表示エラー'}`);
    }
  }
  ok(true, `${routes.length}ページ × 2画面幅を表示`);
  ok(errors.length === 0, 'JavaScriptエラーなし' + (errors.length ? '：' + errors.join(' / ') : ''));

  if (process.env.SHOTS) {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const r of ['home', 'calendar', 'condition', 'analysis', 'english?tab=talk', 'research']) { await go(r); await page.screenshot({ path: path.join(process.env.SHOTS, 'm_' + r.replace(/\W/g, '_') + '.png'), fullPage: true }); }
    await page.setViewportSize({ width: 1280, height: 860 });
    for (const r of ['home', 'analysis']) { await go(r); await page.screenshot({ path: path.join(process.env.SHOTS, 'd_' + r + '.png'), fullPage: true }); }
  }

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures}件の確認に失敗しました` : '\nすべての確認に成功しました');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
