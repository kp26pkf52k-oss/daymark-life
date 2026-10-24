/* DAYMARK LIFE — データ保存
 * すべての記録はこの端末のブラウザ（localStorage）にだけ保存し、外部へは送信しない。
 * データ構造を変えるときは SCHEMA を上げて MIGRATIONS に変換処理を足す（README「改修の手順」参照）。
 */
(function (DM) {
  const KEY = 'daymark.data';
  const SNAP_KEY = 'daymark.snapshots';
  const SCHEMA = 1;
  const APP_VERSION = '1.2.0';

  const DEFAULT_PROMPTS = [
    { id: 'p_daily', scene: '日常', title: '日常会話（ウォームアップ）', text:
`You are my friendly English conversation partner. I am a Japanese graduate student in sport science (baseball research), around CEFR B1 level.
- Talk with me about my day in a natural, casual way. Ask one question at a time.
- Keep your turns short (1-3 sentences) so that I speak more than you.
- If I make a clear mistake, keep the conversation going, then briefly repeat my sentence in a more natural way ("You could say: ...").
- If I say a word in Japanese, tell me how to say it in English.
- After about 10 minutes, or when I say "feedback", give me 3 useful expressions I could have used and 2 mistakes I repeated.` },
    { id: 'p_researcher', scene: '研究', title: '外国人研究者との交流（学会の懇親会）', text:
`Role-play: we are at a reception of an international sport science conference. You are a researcher from overseas who studies biomechanics. I am a Japanese PhD student who studies baseball pitchers and fatigue.
- Start with small talk, then ask about my research, my lab, and Japanese baseball.
- Ask natural follow-up questions like a real researcher would (methods, participants, what I found).
- Keep your turns short. Correct only mistakes that would confuse a listener, briefly, after my turn.
- When I say "feedback", list better ways to say what I tried to say, with short example sentences.` },
    { id: 'p_pitch', scene: '研究', title: '自分の研究を2分で説明する', text:
`I want to practice explaining my research in English in about 2 minutes. My topic: changes in physical and neuromuscular condition during repeated pitching in baseball pitchers.
1) First, ask me to explain my research freely.
2) Then ask 3 questions that a non-specialist would ask, and 2 questions that a specialist would ask.
3) Finally, give feedback on clarity, structure (background → gap → purpose → method → finding), and give me a revised version of my explanation that I can read aloud.` },
    { id: 'p_campus', scene: '大学案内', title: '大学・研究室の案内', text:
`Role-play: you are a visiting researcher who has just arrived at my university in Japan. I will guide you around the campus and our lab (training facility, laboratory, cafeteria, library).
- React naturally and ask practical questions (Where can I get Wi-Fi? What time does the lab open? Where can I eat?).
- Keep your turns short. After every few turns, tell me one expression that would make my guiding sound more natural and polite.` },
    { id: 'p_baseball', scene: '野球', title: '野球の英語（試合観戦・指導）', text:
`Let's talk about baseball in English. Mix these situations: watching an MLB/NPB game together, explaining Japanese high school and college baseball, and talking with a player about pitching load and recovery.
- Use real baseball vocabulary (pitch count, velocity, command, bullpen, rotation, workload, etc.) and explain any term I don't know.
- Ask one question at a time and keep your turns short.
- When I say "feedback", list the baseball expressions I should learn from this conversation.` },
    { id: 'p_travel', scene: '旅行', title: '旅行・海外生活', text:
`Role-play realistic travel and daily-life situations abroad: airport immigration, hotel check-in, ordering at a restaurant, asking for directions, and talking to a pharmacist.
- Play the staff member. Speak at natural speed but simplify if I ask "Could you say that again more slowly?".
- After each situation, give me 2 more natural phrases I could have used.` },
    { id: 'p_qa', scene: '研究', title: '学会発表の質疑応答', text:
`I will give a short summary of my conference presentation. Then act as a chair and audience members and ask me 5 realistic questions one by one, from easy to difficult (methods, limitations, practical application).
- After each answer, tell me whether my answer was clear, and show a more concise version.
- Teach me useful phrases for buying time, clarifying a question, and admitting a limitation politely.` },
    { id: 'p_diary', scene: '日常', title: '英語日記の添削（テキスト入力用）', text:
`Please correct my English diary below.
- First show the corrected version with minimal changes (do not change my meaning).
- Then list each correction: original → corrected, with a short reason in Japanese.
- Parts in [ ] are Japanese I could not say in English. Translate them naturally.
- Finally, give me 3 useful expressions related to this topic, with example sentences.

Diary:
` },
  ];

  const DEFAULT_SETTINGS = {
    categories: [
      { id: 'research', name: '研究', color: '#2a78d6', dark: '#3987e5' },
      { id: 'english', name: '英語', color: '#eb6834', dark: '#d95926' },
      { id: 'exercise', name: '運動', color: '#1baf7a', dark: '#199e70' },
      { id: 'life', name: '私生活', color: '#eda100', dark: '#c98500' },
      { id: 'rest', name: '休息・自由時間', color: '#e87ba4', dark: '#d55181' },
    ],
    researchKinds: ['実験・測定', 'データ分析', '論文執筆', '文献調査', '学会準備', 'ミーティング', 'その他'],
    englishSkills: ['スピーキング', 'リスニング', '語彙', 'ライティング', 'リーディング'],
    englishScenes: ['日常', '旅行', '研究', '大学案内', '野球'],
    exerciseTypes: ['筋力トレーニング', 'ランニング', 'ウォーキング', 'ストレッチ', '野球', 'その他'],
    habits: [
      { id: 'h_wake', name: '決めた時刻に起きた', active: true },
      { id: 'h_meal', name: '3食とった', active: true },
      { id: 'h_screen', name: '就寝前のスマホを控えた', active: true },
    ],
    prompts: DEFAULT_PROMPTS,
    chatgptUrl: 'https://chatgpt.com/',
    weeklyTargets: { research: 1200, english: 210, exerciseCount: 3 }, // 分・分・回（ホームの目安表示用）
    lastBackupAt: null,
    theme: 'auto',
  };

  const emptyData = () => ({
    schema: SCHEMA,
    createdAt: DM.nowISO(),
    updatedAt: DM.nowISO(),
    settings: structuredClone(DEFAULT_SETTINGS),
    events: [],     // 予定 {id,date,start,end,title,cat,projectId,note,status,logId}
    tasks: [],      // タスク {id,title,cat,priority,date,due,projectId,kind,estMin,note,done,doneAt,createdAt}
    logs: [],       // 実施時間の記録 {id,date,cat,minutes,start,sub,projectId,note,output,rpe,scene,eventId,createdAt}
    projects: [],   // 研究プロジェクト {id,name,goal,deadline,status,progress,note,createdAt}
    goals: [],      // 目標 {id,period:'week'|'month',key,title,metric,target,manualDone,createdAt}
    phrases: [],    // 表現・単語 {id,phrase,meaning,example,scene,weak,box,due,createdAt,lastReviewed}
    enDiary: [],    // 英語日記 {id,date,text,corrected,memo,scene,createdAt,updatedAt}
    transcripts: [], // 書き写し {id,date,source,text,memo,minutes,skill,logId,createdAt,updatedAt}
    talkTopics: [],  // 会話ネタ（ChatGPT用プロンプト） {id,title,prompt,sources:[{type,id}],practicedAt,createdAt}
    talkSessions: [], // 会話練習の評価 {id,date,topicId,minutes,logId,report:{topics,scores,utterances,errors,japaneseUsed,expressions,good,next,summary},createdAt}
    days: {},       // 日ごとの振り返り date -> {diary,good,improve,score,restDay,habits:{id:true}}
    conditions: {}, // date -> {physFatigue,mentalFatigue,stress,focus,motivation,mood,sleepQuality,bed,wake,sleepMin,note,recordedAt}
    weekly: {},     // 週の振り返り weekKey -> {good,improve,next,research,updatedAt}
  });

  // 古いデータ構造を新しい構造へ変換する。キーは「変換前のschema番号」。
  const MIGRATIONS = {
    // 0: (d) => { ...; d.schema = 1; return d; },
  };

  // 欠けているキーを既定値で補う（設定項目を追加したときに古いデータでも動くように）
  function normalize(d) {
    const base = emptyData();
    for (const k of Object.keys(base)) if (d[k] == null) d[k] = base[k];
    for (const k of Object.keys(DEFAULT_SETTINGS)) if (d.settings[k] == null) d.settings[k] = structuredClone(DEFAULT_SETTINGS[k]);
    for (const k of ['events', 'tasks', 'logs', 'projects', 'goals', 'phrases', 'enDiary', 'transcripts', 'talkTopics', 'talkSessions']) if (!Array.isArray(d[k])) d[k] = [];
    return d;
  }

  function migrate(d) {
    let v = Number(d.schema || 0);
    if (v > SCHEMA) throw new Error(`このデータ（schema ${v}）はこのアプリ（schema ${SCHEMA}）より新しい版で作られています。アプリを更新してください。`);
    while (v < SCHEMA) {
      const fn = MIGRATIONS[v];
      d = fn ? fn(d) : d;
      v += 1; d.schema = v;
    }
    return normalize(d);
  }

  let data = null;
  let storageOK = true;
  const listeners = [];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? migrate(JSON.parse(raw)) : emptyData();
    } catch (e) {
      console.error(e);
      storageOK = false;
      data = emptyData();
      DM.storeError = e.message || String(e);
    }
    return data;
  }

  function save() {
    data.updatedAt = DM.nowISO();
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      snapshotDaily();
      return true;
    } catch (e) {
      storageOK = false;
      DM.toast && DM.toast('保存できませんでした（容量不足またはプライベートブラウズの可能性）。すぐにエクスポートしてください。', { error: true });
      return false;
    }
  }

  // 1日1回、直近3日分のスナップショットを残す（誤操作からの復元用）
  function snapshotDaily() {
    try {
      const snaps = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]');
      const t = DM.today();
      if (snaps[0] && snaps[0].date === t) return;
      snaps.unshift({ date: t, at: DM.nowISO(), json: JSON.stringify(data) });
      localStorage.setItem(SNAP_KEY, JSON.stringify(snaps.slice(0, 3)));
    } catch { /* 容量不足時はスナップショットを諦める */ }
  }
  function snapshots() { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); } catch { return []; } }

  // 変更はすべて commit() を通す。fn の中で data を書き換える。
  function commit(fn) {
    fn(data);
    save();
    for (const l of listeners) l();
  }
  const onChange = (fn) => listeners.push(fn);

  // ---------- 汎用 CRUD（配列コレクション） ----------
  function upsert(col, item) {
    commit((d) => {
      const i = d[col].findIndex((x) => x.id === item.id);
      if (i >= 0) d[col][i] = { ...d[col][i], ...item, updatedAt: DM.nowISO() };
      else d[col].push({ createdAt: DM.nowISO(), ...item });
    });
    return item.id;
  }
  // 削除は直前の状態を返すので「元に戻す」に使える
  function remove(col, id) {
    const before = JSON.stringify(data);
    commit((d) => { d[col] = d[col].filter((x) => x.id !== id); });
    return before;
  }
  function restoreJSON(json) {
    data = migrate(JSON.parse(json));
    save();
    for (const l of listeners) l();
  }

  // ---------- エクスポート / インポート ----------
  function exportJSON() {
    return JSON.stringify({ app: 'DAYMARK LIFE', appVersion: APP_VERSION, exportedAt: DM.nowISO(), data }, null, 2);
  }
  function parseImport(text) {
    const o = JSON.parse(text);
    const d = o && o.data ? o.data : o;
    if (!d || typeof d !== 'object' || !('settings' in d) || !('logs' in d)) throw new Error('DAYMARK LIFE のバックアップ形式ではありません。');
    return migrate(d);
  }
  function importData(d) {
    try { localStorage.setItem('daymark.beforeImport', JSON.stringify(data)); } catch { /* ignore */ }
    data = d;
    save();
    for (const l of listeners) l();
  }
  function resetAll() {
    try { localStorage.setItem('daymark.beforeImport', JSON.stringify(data)); } catch { /* ignore */ }
    data = emptyData();
    save();
    for (const l of listeners) l();
  }
  const usageBytes = () => { try { return (localStorage.getItem(KEY) || '').length * 2; } catch { return 0; } };

  DM.store = {
    KEY, SCHEMA, APP_VERSION, DEFAULT_SETTINGS, DEFAULT_PROMPTS,
    load, save, commit, onChange, upsert, remove, restoreJSON, snapshots,
    exportJSON, parseImport, importData, resetAll, usageBytes,
    get data() { return data; },
    get ok() { return storageOK; },
  };
})(window.DM);
