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
  ok(after.logs.length === before.logs.length && after.logs.length === 3 && Object.keys(after.conditions).length === 1, '再読み込み後も記録が残る');
  await go('settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="exportJSON"]')]);
  const file = path.join(os.tmpdir(), 'daymark-e2e.json');
  await dl.saveAs(file);
  ok(JSON.parse(fs.readFileSync(file, 'utf8')).data.logs.length === 3, 'JSONで書き出せる');
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
  ok(d.logs.length === 3 && d.enDiary.length === 1 && d.settings.categories.find((x) => x.id === 'life').name === '生活', '書き出したファイルから復元できる');

  console.log('全ページ表示（PC幅を含む）');
  const routes = ['home', 'calendar', 'calendar?v=week', 'calendar?v=month', 'calendar?v=tasks', 'english', 'english?tab=logs', 'english?tab=diary', 'english?tab=phrases', 'english?tab=review', 'english?tab=talk',
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
