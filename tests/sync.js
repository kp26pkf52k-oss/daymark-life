/* DAYMARK LIFE — 端末間同期のテスト（GitHub APIを模擬した2台の端末）
 * 使い方：node tests/sync.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let failures = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { failures++; console.log('  ✗ ' + m); } };

// 模擬GitHub：daymark-data.json を1つだけ持つ
const remote = { sha: null, content: null, puts: 0, failNextPut: false };
async function github(route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  if (req.headers().authorization !== 'Bearer good-token') return json(401, { message: 'Bad credentials' });
  if (url.pathname === '/repos/me/daymark-data') return json(200, { name: 'daymark-data', private: true });
  if (url.pathname === '/repos/me/daymark-data/contents/daymark-data.json') {
    if (req.method() === 'GET') return remote.sha ? json(200, { sha: remote.sha, encoding: 'base64', content: remote.content }) : json(404, { message: 'Not Found' });
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData());
      if (remote.failNextPut) { remote.failNextPut = false; remote.sha = 'other-' + Date.now(); return json(409, { message: 'conflict' }); }
      if ((body.sha || null) !== remote.sha) return json(409, { message: 'sha mismatch' });
      remote.content = body.content; remote.sha = 'sha' + (++remote.puts); remote.content = body.content;
      return json(200, { content: { sha: remote.sha } });
    }
  }
  return json(404, { message: 'Not Found' });
}
const remoteText = () => Buffer.from(remote.content, 'base64').toString('utf8');

(async () => {
  await new Promise((r) => server.listen(0, r));
  const BASE = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const mk = async (dev) => {
    const ctx = await browser.newContext({ ...dev, timezoneId: 'Asia/Tokyo' });
    await ctx.addInitScript(() => { window.DM_NO_SW = true; });
    await ctx.route('https://api.github.com/**', github);
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    await page.goto(BASE + '#/home');
    return page;
  };
  const phone = await mk(devices['iPhone 13']);
  const pc = await mk({ viewport: { width: 1280, height: 860 } });
  const data = (p) => p.evaluate(() => DM.store.data);
  const sheet = (p) => p.locator('.sheet-wrap').last();
  const setup = async (p, pass = '', token = 'good-token') => {
    await p.goto(BASE + '#/settings');
    await p.locator('#sync [data-act="syncSetup"]').first().click();
    const s = sheet(p);
    await s.locator('[data-key="owner"]').fill('me');
    await s.locator('[data-key="token"]').fill(token);
    await s.locator('[data-key="pass"]').fill(pass);
    await s.locator('button[type=submit]').click();
    await p.waitForTimeout(600);
  };
  const syncNow = (p) => p.evaluate(() => DM.sync.now());
  const addLog = (p, cat, minutes) => p.evaluate(([c, m]) => DM.store.upsert('logs', { id: DM.uid('l_'), date: DM.today(), cat: c, minutes: m }), [cat, minutes]);

  console.log('同期の設定と最初の同期');
  await addLog(phone, 'research', 30);
  await setup(phone);
  ok(remote.sha && JSON.parse(remoteText()).data.logs.length === 1, 'スマホの記録がGitHub上のファイルに保存される');
  ok((await phone.textContent('#sync')).includes('同期は有効です'), '設定画面に同期の状態が出る');
  ok(!(await phone.evaluate(() => DM.store.exportJSON())).includes('good-token'), 'トークンはバックアップ（書き出し）に含まれない');

  await pc.evaluate(() => DM.store.commit((d) => { d.conditions[DM.today()] = { physFatigue: 60, recordedAt: DM.nowISO() }; }));
  await setup(pc);
  let d = await data(pc);
  ok(d.logs.length === 1 && d.conditions[Object.keys(d.conditions)[0]].physFatigue === 60, 'パソコンで設定すると、スマホの記録とパソコンの記録が統合される');
  await syncNow(phone);
  d = await data(phone);
  ok(Object.keys(d.conditions).length === 1, 'スマホにもパソコンの記録が反映される');

  console.log('自動同期・削除・同時の編集');
  const logId = d.logs[0].id;
  await pc.goto(BASE + `#/calendar?v=day`);
  await pc.evaluate((id) => DM.removeWithUndo('logs', id), logId);
  await pc.waitForTimeout(3800); // 記録の3秒後に自動同期
  await syncNow(phone);
  ok((await data(phone)).logs.length === 0, 'パソコンで削除した記録がスマホからも消える（自動同期）');
  await pc.evaluate(() => document.querySelector('.toast-btn').click());
  await syncNow(pc); await syncNow(phone);
  ok((await data(phone)).logs.length === 1, '削除を「元に戻す」と、スマホにも戻る');

  await phone.evaluate(() => DM.store.upsert('tasks', { id: 't_phone', title: 'スマホのタスク', cat: 'research', priority: 'mid' }));
  await pc.evaluate(() => DM.store.upsert('tasks', { id: 't_pc', title: 'PCのタスク', cat: 'life', priority: 'mid' }));
  await syncNow(phone); await syncNow(pc); await syncNow(phone);
  ok((await data(phone)).tasks.length === 2 && (await data(pc)).tasks.length === 2, '両方の端末で同時に追加した記録がどちらも残る');

  await phone.evaluate(() => DM.store.commit((d) => { d.tasks.find((t) => t.id === 't_pc').title = 'スマホで修正'; }));
  await new Promise((r) => setTimeout(r, 20));
  await pc.evaluate(() => DM.store.commit((d) => { d.tasks.find((t) => t.id === 't_pc').title = 'PCで修正（後）'; }));
  await syncNow(phone); await syncNow(pc); await syncNow(phone);
  ok((await data(phone)).tasks.find((t) => t.id === 't_pc').title === 'PCで修正（後）', '同じ記録を両方で編集したときは、後から編集した方が残る');

  await phone.evaluate(() => DM.store.commit((d) => { d.settings.habits.push({ id: 'h_x', name: '筋トレ', active: true }); }));
  await syncNow(phone); await syncNow(pc);
  ok((await data(pc)).settings.habits.some((h) => h.name === '筋トレ'), '設定の変更も同期される');

  const putsBefore = remote.puts;
  await syncNow(pc); await syncNow(phone); await syncNow(pc);
  ok(remote.puts === putsBefore, '変更がないときはGitHubへ書き込まない');

  remote.failNextPut = true;
  await phone.evaluate(() => DM.store.upsert('phrases', { id: 'ph_1', phrase: 'workload', meaning: '負荷', box: 0, due: DM.today() }));
  await syncNow(phone);
  ok(JSON.parse(remoteText()).data.phrases.length === 1, '他の端末と書き込みが重なったとき（409）は読み直して保存し直す');

  console.log('暗号化');
  await setup(phone, '合言葉テスト');
  const enc = remoteText();
  ok(enc.includes('"encrypted"') && !enc.includes('workload') && !enc.includes('スマホのタスク'), '合言葉を設定すると、GitHub上のファイルは暗号化される');
  await syncNow(pc);
  ok((await pc.evaluate(() => DM.sync.state.lastError)).includes('合言葉'), '合言葉を設定していない端末では読めないことを知らせる');
  await setup(pc, 'まちがい');
  ok((await pc.evaluate(() => DM.sync.state.lastError)).includes('合言葉が違う'), '合言葉が違うときは知らせる');
  await setup(pc, '合言葉テスト');
  ok((await pc.evaluate(() => DM.sync.state.lastError)) === '' && (await data(pc)).phrases.length === 1, '同じ合言葉なら同期できる');

  console.log('エラー表示');
  await setup(pc, '合言葉テスト', 'bad-token');
  ok((await pc.evaluate(() => DM.sync.state.lastError)).includes('トークン'), 'トークンが無効なときは知らせる');
  await pc.goto(BASE + '#/home');
  ok((await pc.textContent('#view')).includes('同期ができていません'), 'ホームにも同期の問題が表示される');
  await pc.goto(BASE + '#/settings');
  await pc.click('[data-act="syncOff"]');
  await sheet(pc).locator('[data-yes]').click();
  ok(!(await pc.evaluate(() => DM.sync.enabled())) && (await data(pc)).tasks.length === 2, '同期をやめても、この端末の記録は残る');

  ok(phone.errors.length === 0 && pc.errors.length === 0, 'JavaScriptエラーなし' + [...phone.errors, ...pc.errors].join(' / '));
  await browser.close();
  server.close();
  console.log(failures ? `\n${failures}件の確認に失敗しました` : '\nすべての確認に成功しました');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); server.close(); process.exit(1); });
