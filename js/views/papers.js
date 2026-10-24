/* 研究：文献（読んだ論文の蓄積・引用文献の書き出し・一文要約・要約スライド作成）
 * - 書誌情報と要約はこの端末内にだけ保存する。
 * - 「DOIから自動入力」を押したときだけ、DOIをCrossref（api.crossref.org）に送って書誌情報を取得する。
 * - 要約はアプリでは生成しない。ChatGPT用の要約プロンプトをコピーし、返ってきた形式を貼り付けて取り込む（手入力も可）。
 * - スライドは同梱の PptxGenJS（js/vendor、MITライセンス）でこの端末内で作る。
 */
(function (DM) {
  const esc = DM.esc;
  const SUM = [['purpose', '目的'], ['participants', '対象'], ['methods', '方法'], ['results', '主な結果'], ['implications', '示唆']];
  const STATUS = { toread: '未読', reading: '読書中', read: '読了' };
  const BASIS = { full: '全文', abstract: '抄録のみ' };
  const papers = () => DM.store.data.papers;
  const selected = new Set();

  // ---------- 書誌情報 ----------
  const normDOI = (s) => String(s || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').trim();
  const parseAuthors = (text) => String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const i = l.indexOf(',');
    return i > 0 ? { family: l.slice(0, i).trim(), given: l.slice(i + 1).trim() } : { family: l, given: '' };
  });
  const authorsText = (a) => (a || []).map((x) => (x.given ? `${x.family}, ${x.given}` : x.family)).join('\n');
  const initials = (given) => given.split(/\s+/).filter(Boolean).map((part) => part.split('-').map((p) => (/^[A-Za-z]/.test(p) ? p[0].toUpperCase() + '.' : p)).join('-')).join(' ');
  const apaName = (x) => (x.given ? `${x.family}, ${initials(x.given)}` : x.family);
  function apaAuthors(list) {
    const n = list.map(apaName);
    if (!n.length) return '';
    if (n.length === 1) return n[0];
    if (n.length === 2) return `${n[0]}, & ${n[1]}`;
    if (n.length <= 20) return `${n.slice(0, -1).join(', ')}, & ${n[n.length - 1]}`;
    return `${n.slice(0, 19).join(', ')}, . . . ${n[n.length - 1]}`;
  }
  const endDot = (s) => (/[.?!。]$/.test(s) ? s : s + '.');
  // APA 第7版（雑誌論文）の形式。題目の大文字・小文字は入力どおり（自動で文頭大文字のみの形には変えない）。
  function apa(p) {
    const parts = [];
    const au = apaAuthors(p.authors || []);
    parts.push(au ? (/[\u3040-\u30ff\u4e00-\u9fff]$/.test(au) ? au : endDot(au)) : ''); // 日本語の著者名には英語式のピリオドをつけない
    parts.push(`(${p.year || 'n.d.'}).`);
    if (p.title) parts.push(endDot(p.title));
    let src = p.journal || '';
    if (p.volume) src += `${src ? ', ' : ''}${p.volume}`;
    if (p.issue) src += `(${p.issue})`;
    if (p.pages) src += `${src ? ', ' : ''}${p.pages.replace(/-/g, '–')}`;
    if (src) parts.push(src + '.');
    if (p.doi) parts.push(`https://doi.org/${p.doi}`);
    else if (p.url) parts.push(p.url);
    return parts.filter(Boolean).join(' ');
  }
  DM.apaCitation = apa;
  const shortRef = (p) => {
    const a = p.authors || [];
    const who = !a.length ? '' : a.length === 1 ? a[0].family : a.length === 2 ? `${a[0].family} & ${a[1].family}` : `${a[0].family} et al.`;
    return [who, p.year && `(${p.year})`, p.journal].filter(Boolean).join(' ');
  };
  function ris(list) {
    return list.map((p) => {
      const L = ['TY  - JOUR'];
      for (const a of p.authors || []) L.push(`AU  - ${a.given ? `${a.family}, ${a.given}` : a.family}`);
      if (p.title) L.push(`TI  - ${p.title}`);
      if (p.journal) L.push(`T2  - ${p.journal}`);
      if (p.year) L.push(`PY  - ${p.year}`);
      if (p.volume) L.push(`VL  - ${p.volume}`);
      if (p.issue) L.push(`IS  - ${p.issue}`);
      if (p.pages) { const [sp, ep] = p.pages.split(/[-–]/); L.push(`SP  - ${sp}`); if (ep) L.push(`EP  - ${ep}`); }
      if (p.doi) L.push(`DO  - ${p.doi}`);
      if (p.url || p.doi) L.push(`UR  - ${p.url || 'https://doi.org/' + p.doi}`);
      for (const t of p.tags || []) L.push(`KW  - ${t}`);
      L.push('ER  - ');
      return L.join('\r\n');
    }).join('\r\n\r\n') + '\r\n';
  }
  const link = (p) => (p.doi ? `https://doi.org/${p.doi}` : p.url || '');

  async function fetchCrossref(doi) {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: { Accept: 'application/json' } });
    if (res.status === 404) throw new Error('このDOIはCrossrefに登録されていません（DOIの誤り、またはJaLC等の別機関のDOIの可能性）。');
    if (!res.ok) throw new Error(`Crossrefから取得できませんでした（${res.status}）。`);
    const m = (await res.json()).message || {};
    const dp = (m.issued && m.issued['date-parts'] && m.issued['date-parts'][0]) || (m.published && m.published['date-parts'] && m.published['date-parts'][0]) || [];
    return {
      title: (m.title && m.title[0] || '').replace(/<[^>]+>/g, '').trim(),
      authors: (m.author || []).map((a) => ({ family: a.family || a.name || '', given: a.given || '' })).filter((a) => a.family),
      year: dp[0] ? String(dp[0]) : '',
      journal: (m['container-title'] && m['container-title'][0]) || '',
      volume: m.volume || '', issue: m.issue || '', pages: m.page || '',
      doi: m.DOI || doi, url: m.URL || '',
    };
  }

  // ---------- 入力フォーム ----------
  DM.editPaper = function (p = {}, preset = {}) {
    const isNew = !p.id;
    // preset は新規作成時の初期値、または貼り付けた要約（既存の値より優先）
    const v = { status: 'read', readDate: DM.today(), ...p, ...preset, authorsText: authorsText(p.authors || preset.authors), tagsText: (p.tags || []).join(', '), ...(p.summary || {}), ...(preset.summary || {}) };
    const projOpts = [{ value: '', label: '（なし）' }, ...DM.store.data.projects.filter((x) => x.status !== 'archived').map((x) => ({ value: x.id, label: x.name }))];
    const s = DM.openForm({
      title: isNew ? '文献を追加' : '文献を編集', values: v, autofocus: false,
      fields: [
        { key: 'doi', label: 'DOI（任意）', type: 'text', placeholder: '例：10.1519/00124278-200102000-00019' },
        { key: 'h_doi', type: 'html', html: `<div class="btn-row"><button type="button" class="btn small" data-doi-fetch>DOIから書誌情報を自動入力</button><span class="f-hint">押したときだけ、DOIをCrossrefに送信して取得します。</span></div><div class="f-hint" data-doi-msg></div>` },
        { key: 'url', label: 'リンク（DOIがない場合など・任意）', type: 'url', placeholder: 'https://' },
        { key: 'title', label: '題目', type: 'textarea', rows: 2, required: true },
        { key: 'authorsText', label: '著者（1行に1人「姓, 名」）', type: 'textarea', rows: 3, placeholder: 'Foster, Carl\nFlorhaug, Jessica A.' },
        { key: 'year', label: '発行年', type: 'text', half: true },
        { key: 'journal', label: '雑誌名', type: 'text', half: true },
        { key: 'volume', label: '巻', type: 'text', half: true },
        { key: 'issue', label: '号', type: 'text', half: true },
        { key: 'pages', label: 'ページ', type: 'text', placeholder: '109-115' },
        { key: 'projectId', label: '関連するプロジェクト', type: 'select', options: projOpts },
        { key: 'status', label: '状態', type: 'chips', options: Object.entries(STATUS).map(([value, label]) => ({ value, label })) },
        { key: 'readDate', label: '読んだ日', type: 'date', show: (x) => x.status === 'read' },
        { key: 'tagsText', label: 'タグ（カンマ区切り・任意）', type: 'text', placeholder: '投球, 疲労, レビュー' },
        { key: 'h_sum', type: 'html', html: '<div class="f-section">一文要約（論文に書かれている内容だけ）</div>' },
        { key: 'basis', label: '要約の根拠', type: 'chips', allowEmpty: true, options: Object.entries(BASIS).map(([value, label]) => ({ value, label })) },
        ...SUM.map(([k, l]) => ({ key: k, label: l, type: 'textarea', rows: 2 })),
        { key: 'note', label: '自分のメモ（自分の研究との関係など・任意）', type: 'textarea', rows: 3 },
      ],
      onSave: (x) => {
        const doi = normDOI(x.doi);
        if (isNew && doi && papers().some((y) => y.doi && y.doi.toLowerCase() === doi.toLowerCase())) return 'このDOIの文献はすでに登録されています';
        const item = {
          id: p.id || DM.uid('pa_'), doi, url: (x.url || '').trim(), title: x.title.trim(), authors: parseAuthors(x.authorsText),
          year: (x.year || '').trim(), journal: (x.journal || '').trim(), volume: (x.volume || '').trim(), issue: (x.issue || '').trim(), pages: (x.pages || '').trim(),
          projectId: x.projectId || '', status: x.status || 'toread', readDate: x.status === 'read' ? x.readDate || '' : '',
          tags: (x.tagsText || '').split(/[,、]/).map((t) => t.trim()).filter(Boolean), basis: x.basis || '',
          summary: Object.fromEntries(SUM.map(([k]) => [k, (x[k] || '').trim()])), note: x.note || '',
        };
        DM.store.upsert('papers', item);
        DM.toast(isNew ? '文献を追加しました' : '更新しました');
      },
      onDelete: isNew ? null : () => { selected.delete(p.id); DM.removeWithUndo('papers', p.id); },
    });
    const body = s.body;
    body.querySelector('[data-doi-fetch]').addEventListener('click', async () => {
      const msg = body.querySelector('[data-doi-msg]');
      const doi = normDOI(body.querySelector('[data-key="doi"]').value);
      if (!doi) { msg.textContent = 'DOIを入力してください。'; return; }
      msg.textContent = '取得中…';
      try {
        const m = await fetchCrossref(doi);
        const set = (k, val) => { const el = body.querySelector(`[data-key="${k}"]`); if (el && val) el.value = val; };
        set('doi', m.doi); set('title', m.title); set('authorsText', authorsText(m.authors)); set('year', m.year);
        set('journal', m.journal); set('volume', m.volume); set('issue', m.issue); set('pages', m.pages);
        msg.textContent = '書誌情報を入力しました。内容を確認してから保存してください。';
      } catch (e) {
        msg.textContent = e instanceof TypeError ? '通信できませんでした（オフライン、または接続が制限されています）。手入力してください。' : e.message;
      }
    });
    return s;
  };

  // ---------- 要約プロンプトと取り込み ----------
  const summaryPrompt = (p) => `以下の論文を読み、次の6項目をそれぞれ日本語の一文（目安60〜100字）で要約してください。

ルール：
- 論文に書かれている内容だけを使い、推測や一般論で補わない。
- 書かれていない項目は "記載なし" とする。
- 対象者数や主要な結果の数値は、論文の記載どおりに書く。
- 「implications（示唆）」は著者が論文中で述べている示唆・実践への応用を要約し、あなた自身の意見は入れない。
- 全文を読めた場合は basis を "full"、抄録しか読めなかった場合は "abstract" とする。
- 次の形式のJSONコードブロック1つだけで返答する。

\`\`\`json
{"title": "論文の題目（原題のまま）", "purpose": "目的", "participants": "対象", "methods": "方法", "results": "主な結果", "implications": "示唆", "basis": "full"}
\`\`\`

論文：${p.title || ''}${link(p) ? `\n${link(p)}` : ''}
（この下に論文のPDFを添付するか、本文または抄録を貼り付けて送信してください）
`;
  function parseSummary(text) {
    let t = String(text || '');
    const f = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (f) t = f[1];
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('JSONの { } が見つかりません。ChatGPTの返答のコードブロックをそのまま貼り付けてください。');
    let o;
    try { o = JSON.parse(t.slice(a, b + 1).replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')); } catch (e) { throw new Error('JSONとして読み取れませんでした（' + e.message + '）。'); }
    const s = Object.fromEntries(SUM.map(([k]) => [k, String(o[k] ?? '').trim().slice(0, 600)]));
    if (!SUM.some(([k]) => s[k])) throw new Error('要約の項目が見つかりません。要約用プロンプトへの返答か確認してください。');
    return { title: String(o.title || '').trim(), summary: s, basis: BASIS[o.basis] ? o.basis : '' };
  }
  DM.parsePaperSummary = parseSummary;
  function pasteSummary(p) {
    const s = DM.openSheet(`<div class="form">
      <p class="f-hint">要約用プロンプトへのChatGPTの返答（コードブロック）を貼り付けてください。読み込んだ内容は編集画面で確認・修正してから保存します。</p>
      <textarea id="ps_text" rows="8" class="prompt-edit" spellcheck="false"></textarea>
      <div class="form-error" hidden></div>
      <div class="btn-row end"><button type="button" class="btn" data-x>キャンセル</button><button type="button" class="btn primary" data-ok>読み込む</button></div></div>`, { title: '要約を貼り付け' });
    s.body.querySelector('[data-x]').onclick = s.close;
    s.body.querySelector('[data-ok]').onclick = () => {
      try {
        const r = parseSummary(s.body.querySelector('#ps_text').value);
        s.close();
        DM.editPaper(p, { summary: r.summary, basis: r.basis || p.basis, title: p.title || r.title });
      } catch (e) { const el = s.body.querySelector('.form-error'); el.textContent = e.message; el.hidden = false; }
    };
  }

  // ---------- スライド（.pptx） ----------
  function loadPptx() {
    if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    return new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = 'js/vendor/pptxgen.bundle.js';
      sc.onload = () => (window.PptxGenJS ? resolve(window.PptxGenJS) : reject(new Error('読み込めませんでした')));
      sc.onerror = () => reject(new Error('スライド作成用のファイルを読み込めませんでした（オフライン時は一度オンラインで開いてから再試行してください）。'));
      document.head.appendChild(sc);
    });
  }
  const C = { ink: '1D2128', muted: '6D727A', accent: '24497A', soft: 'E6ECF5', line: 'D3D0C8', empty: 'A0A3A8' };
  const FONT = 'Yu Gothic';
  function paperSlide(pptx, p) {
    const sl = pptx.addSlide();
    sl.background = { color: 'FFFFFF' };
    const proj = p.projectId && DM.model.project(p.projectId);
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: 0.12, fill: { color: C.accent }, line: { color: C.accent } });
    sl.addText(`文献要約${proj ? '　｜　' + proj.name : ''}`, { x: 0.5, y: 0.28, w: 12.3, h: 0.3, fontFace: FONT, fontSize: 11, color: C.muted });
    sl.addText(p.title || '（題目未入力）', { x: 0.5, y: 0.58, w: 12.3, h: 0.95, fontFace: FONT, fontSize: 20, bold: true, color: C.ink, valign: 'top', fit: 'shrink', margin: 0 });
    sl.addText(shortRef(p) || ' ', { x: 0.5, y: 1.55, w: 12.3, h: 0.3, fontFace: FONT, fontSize: 12, color: C.muted, margin: 0 });
    const rows = SUM.map(([k, l]) => {
      const txt = (p.summary && p.summary[k]) || '';
      return [
        { text: l, options: { bold: true, color: C.accent, fill: { color: C.soft }, align: 'center', valign: 'middle', fontSize: 14 } },
        { text: txt || '（未入力）', options: { color: txt ? C.ink : C.empty, valign: 'middle', fontSize: 14 } },
      ];
    });
    sl.addTable(rows, { x: 0.5, y: 2.0, w: 12.3, colW: [1.7, 10.6], rowH: 0.86, fontFace: FONT, border: { type: 'solid', pt: 0.75, color: C.line }, margin: [4, 10, 4, 10] });
    sl.addText(apa(p), { x: 0.5, y: 6.5, w: 12.3, h: 0.5, fontFace: FONT, fontSize: 9, color: C.muted, valign: 'top', fit: 'shrink', margin: 0,
      ...(link(p) ? { hyperlink: { url: link(p) } } : {}) });
    if (p.basis) sl.addText(`要約の根拠：${BASIS[p.basis]}`, { x: 0.5, y: 7.0, w: 12.3, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, margin: 0 });
  }
  function coverSlide(pptx, list, title) {
    const sl = pptx.addSlide();
    sl.background = { color: 'FFFFFF' };
    sl.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: C.accent }, line: { color: C.accent } });
    sl.addText(title, { x: 0.8, y: 1.0, w: 11.8, h: 1.0, fontFace: FONT, fontSize: 32, bold: true, color: C.ink, margin: 0 });
    sl.addText(`${DM.fmtDate(DM.today(), { year: true })}　｜　${list.length}編`, { x: 0.8, y: 2.0, w: 11.8, h: 0.4, fontFace: FONT, fontSize: 14, color: C.muted, margin: 0 });
    sl.addText(list.slice(0, 12).map((p, i) => ({ text: `${i + 1}. ${shortRef(p)}　${p.title}`, options: { breakLine: true } })),
      { x: 0.8, y: 2.8, w: 11.8, h: 4.2, fontFace: FONT, fontSize: 12, color: C.ink, valign: 'top', fit: 'shrink', paraSpaceAfter: 4, margin: 0 });
  }
  async function makeDeck(list, opt) {
    const Pptx = await loadPptx();
    const pptx = new Pptx();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = opt.title;
    if (opt.cover) coverSlide(pptx, list, opt.title);
    for (const p of list) paperSlide(pptx, p);
    if (opt.refs) {
      const sl = pptx.addSlide();
      sl.addText('引用文献', { x: 0.5, y: 0.4, w: 12.3, h: 0.6, fontFace: FONT, fontSize: 22, bold: true, color: C.ink, margin: 0 });
      sl.addText(list.map(apa).sort().map((t) => ({ text: t, options: { breakLine: true } })), { x: 0.5, y: 1.2, w: 12.3, h: 5.9, fontFace: FONT, fontSize: 11, color: C.ink, valign: 'top', fit: 'shrink', paraSpaceAfter: 6, margin: 0 });
    }
    await pptx.writeFile({ fileName: `文献要約_${DM.today().replace(/-/g, '')}.pptx` });
  }
  DM.makePaperDeck = makeDeck;

  // ---------- 画面 ----------
  function filtered(p) {
    const q = (p.q || '').toLowerCase(), st = p.st || '', pj = p.pj || '';
    const day = (x) => x.readDate || (x.createdAt || '').slice(0, 10);
    let list = papers().slice().sort((a, b) => day(b).localeCompare(day(a)) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (st) list = list.filter((x) => x.status === st);
    if (pj) list = list.filter((x) => x.projectId === pj);
    if (q) list = list.filter((x) => [x.title, x.journal, x.year, x.note, ...(x.tags || []), ...(x.authors || []).map((a) => a.family)].join(' ').toLowerCase().includes(q));
    return list;
  }
  DM.papersTab = function (p) {
    const st = p.st || '', pj = p.pj || '';
    const list = filtered(p);
    for (const id of [...selected]) if (!papers().some((x) => x.id === id)) selected.delete(id);
    const open = p.pid;
    const projects = DM.store.data.projects;
    return `<section class="card">
      <div class="card-head"><h2>文献 <span class="count">${papers().length}</span></h2><button type="button" class="btn small primary" data-act="paperAdd">＋ 文献を追加</button></div>
      <div class="toolbar wrap">
        <input type="search" placeholder="題目・著者・タグで検索" value="${esc(p.q || '')}" data-act-change="paq" aria-label="検索">
        <select data-act-change="past" aria-label="状態"><option value="">すべての状態</option>${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${k === st ? 'selected' : ''}>${l}</option>`).join('')}</select>
        ${projects.length ? `<select data-act-change="papj" aria-label="プロジェクト"><option value="">すべてのプロジェクト</option>${projects.map((x) => `<option value="${x.id}" ${x.id === pj ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>` : ''}
      </div>
      ${list.length ? `<div class="sel-bar"><label class="check"><input type="checkbox" data-act-change="paAll" ${list.every((x) => selected.has(x.id)) ? 'checked' : ''}> 表示中をすべて選択</label><span class="f-hint">${selected.size}件選択中</span></div>
      <div class="paper-list">${list.map((x) => {
        const filled = SUM.filter(([k]) => x.summary && x.summary[k]).length;
        const isOpen = open === x.id;
        return `<div class="paper ${isOpen ? 'open' : ''}">
          <input type="checkbox" class="paper-pick" data-act-change="paPick" data-id="${x.id}" ${selected.has(x.id) ? 'checked' : ''} aria-label="選択">
          <div class="paper-main">
            <button type="button" class="paper-head" data-act="paperOpen" data-id="${x.id}"><b>${esc(x.title)}</b>
              <span class="meta">${esc(shortRef(x))}${x.status ? `<span class="sep">·</span>${STATUS[x.status]}` : ''}<span class="sep">·</span>要約 ${filled}/5${x.basis ? `（${BASIS[x.basis]}）` : ''}${(x.tags || []).length ? `<span class="sep">·</span>${x.tags.map(esc).join(', ')}` : ''}</span></button>
            ${isOpen ? `<div class="paper-body">
              ${SUM.map(([k, l]) => `<div class="sum-row"><span class="label-s">${l}</span><span class="${x.summary && x.summary[k] ? '' : 'muted'}">${x.summary && x.summary[k] ? esc(x.summary[k]) : '未入力'}</span></div>`).join('')}
              ${x.note ? `<div class="sum-row"><span class="label-s">メモ</span><span>${DM.nl2br(x.note)}</span></div>` : ''}
              <div class="cite en-text">${esc(apa(x))}</div>
              <div class="btn-row">
                ${link(x) ? `<a class="btn small" href="${esc(link(x))}" target="_blank" rel="noopener">論文を開く ↗</a>` : ''}
                <button type="button" class="btn small" data-act="copy" data-text="${esc(apa(x))}">引用をコピー</button>
                <button type="button" class="btn small" data-act="copy" data-text="${esc(summaryPrompt(x))}">要約用プロンプトをコピー</button>
                <button type="button" class="btn small" data-act="paperPaste" data-id="${x.id}">要約を貼り付け</button>
                <button type="button" class="btn small ghost" data-act="paperEdit" data-id="${x.id}">編集</button>
              </div></div>` : ''}
          </div></div>`;
      }).join('')}</div>` : DM.empty(papers().length ? '条件に合う文献はありません。' : '読んだ論文を登録すると、引用文献リストの書き出しや要約スライドの作成ができます。')}
    </section>
    <section class="card">
      <h2>書き出し・スライド作成</h2>
      <p class="f-hint">${selected.size ? `選択中の${selected.size}件が対象です。` : '一覧のチェックで対象を選んでください（未選択のときは表示中の全件が対象）。'}</p>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="paperDeck">要約スライドを作成（.pptx）</button>
        <button type="button" class="btn" data-act="paperCopyRefs">引用文献リストをコピー（APA）</button>
        <button type="button" class="btn" data-act="paperRIS">RISで書き出し</button>
      </div>
      <label class="check"><input type="checkbox" id="pa_cover" checked> 表紙をつける</label>
      <label class="check"><input type="checkbox" id="pa_refs" checked> 最後に引用文献のスライドをつける</label>
      <p class="f-hint">スライドは1編1枚（題目、著者・年・雑誌、目的・対象・方法・主な結果・示唆、引用情報）。要約が未入力の項目は「（未入力）」と表示します。引用はAPA第7版の形式で、題目の大文字・小文字は入力どおりです。RISファイルはZotero・EndNote・Mendeleyに読み込めます。</p>
    </section>`;
  };

  // 対象：選択中の文献。未選択なら表示中（絞り込み後）の全件
  const targets = () => (selected.size ? papers().filter((x) => selected.has(x.id)) : filtered(DM.route().params));
  DM.actions.paperAdd = () => DM.editPaper();
  DM.actions.paperEdit = (el) => DM.editPaper(papers().find((x) => x.id === el.dataset.id));
  DM.actions.paperOpen = (el) => { const { params } = DM.route(); DM.setParams({ pid: params.pid === el.dataset.id ? '' : el.dataset.id }); };
  DM.actions.paperPaste = (el) => pasteSummary(papers().find((x) => x.id === el.dataset.id));
  DM.actions.paperCopyRefs = () => { const l = targets(); if (!l.length) return DM.toast('対象の文献がありません', { error: true }); DM.copyText(l.map(apa).sort().join('\n')); };
  DM.actions.paperRIS = () => { const l = targets(); if (!l.length) return DM.toast('対象の文献がありません', { error: true }); DM.download(`references_${DM.today().replace(/-/g, '')}.ris`, ris(l), 'application/x-research-info-systems'); };
  DM.actions.paperDeck = async (el) => {
    const l = targets();
    if (!l.length) return DM.toast('対象の文献がありません', { error: true });
    el.disabled = true; el.textContent = '作成中…';
    try {
      await makeDeck(l, { cover: document.getElementById('pa_cover').checked, refs: document.getElementById('pa_refs').checked, title: '文献まとめ' });
      DM.toast(`${l.length}編のスライドを作成しました`);
    } catch (e) { DM.toast('スライドを作成できませんでした：' + e.message, { error: true }); }
    finally { el.disabled = false; el.textContent = '要約スライドを作成（.pptx）'; }
  };
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act-change]'); if (!el) return;
    const a = el.dataset.actChange;
    if (a === 'paq') DM.setParams({ q: el.value });
    if (a === 'past') DM.setParams({ st: el.value });
    if (a === 'papj') DM.setParams({ pj: el.value });
    if (a === 'paPick') { if (el.checked) selected.add(el.dataset.id); else selected.delete(el.dataset.id); DM.render(); }
    if (a === 'paAll') {
      const ids = [...document.querySelectorAll('.paper-pick')].map((x) => x.dataset.id);
      for (const id of ids) { if (el.checked) selected.add(id); else selected.delete(id); }
      DM.render();
    }
  });
})(window.DM);
