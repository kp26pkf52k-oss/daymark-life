/* DAYMARK LIFE — 共通UI部品（トースト・シート・フォーム・確認ダイアログ） */
(function (DM) {
  const esc = DM.esc;

  // ---------- トースト（「元に戻す」付き） ----------
  let toastTimer;
  DM.toast = function (msg, opt = {}) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.className = 'toast' + (opt.error ? ' error' : '');
    t.innerHTML = `<span>${esc(msg)}</span>${opt.undo ? '<button type="button" class="toast-btn">元に戻す</button>' : ''}`;
    t.hidden = false;
    if (opt.undo) t.querySelector('button').onclick = () => { opt.undo(); t.hidden = true; DM.toast('元に戻しました'); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, opt.undo ? 6000 : 2600);
  };

  // 削除して「元に戻す」を出す
  DM.removeWithUndo = function (col, id, label = '削除しました') {
    const before = DM.store.remove(col, id);
    DM.toast(label, { undo: () => DM.store.restoreJSON(before) });
  };

  // ---------- シート（モーダル） ----------
  let sheetStack = 0;
  function openSheet(html, opt = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(opt.title || '')}">
      <div class="sheet-head"><h2>${esc(opt.title || '')}</h2><button type="button" class="icon-btn" data-close aria-label="閉じる">✕</button></div>
      <div class="sheet-body">${html}</div></div>`;
    document.body.appendChild(wrap);
    sheetStack++;
    document.body.classList.add('no-scroll');
    const close = () => {
      wrap.remove(); sheetStack--;
      if (!sheetStack) document.body.classList.remove('no-scroll');
      document.removeEventListener('keydown', onKey);
      opt.onClose && opt.onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.querySelector('.sheet-backdrop').onclick = () => (opt.dirtyCheck && opt.dirtyCheck() ? DM.confirm('入力内容を破棄して閉じますか？').then((ok) => ok && close()) : close());
    wrap.querySelector('[data-close]').onclick = close;
    requestAnimationFrame(() => wrap.classList.add('open'));
    return { el: wrap, body: wrap.querySelector('.sheet-body'), close };
  }
  DM.openSheet = openSheet;

  DM.confirm = function (msg, opt = {}) {
    return new Promise((resolve) => {
      let done = false;
      const s = openSheet(`<p class="confirm-msg">${esc(msg)}</p><div class="btn-row end">
        <button type="button" class="btn" data-no>やめる</button>
        <button type="button" class="btn ${opt.danger ? 'danger' : 'primary'}" data-yes>${esc(opt.ok || 'OK')}</button></div>`,
      { title: opt.title || '確認', onClose: () => { if (!done) resolve(false); } });
      s.body.querySelector('[data-no]').onclick = () => { done = true; s.close(); resolve(false); };
      s.body.querySelector('[data-yes]').onclick = () => { done = true; s.close(); resolve(true); };
    });
  };

  // ---------- フォーム ----------
  const optList = (opts) => (opts || []).map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const QUICK_MIN = [15, 30, 45, 60, 90, 120];

  function fieldHTML(f, v) {
    const id = 'f_' + f.key;
    const lab = f.label ? `<label class="f-label" for="${id}">${esc(f.label)}${f.required ? ' <span class="req">必須</span>' : ''}</label>` : '';
    const hint = f.hint ? `<div class="f-hint">${f.hint}</div>` : '';
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    let input = '';
    switch (f.type) {
      case 'hidden': return `<input type="hidden" data-key="${f.key}" value="${esc(v ?? '')}">`;
      case 'html': return `<div class="field" data-field="${f.key}">${f.html}</div>`;
      case 'textarea':
        input = `<textarea id="${id}" data-key="${f.key}" rows="${f.rows || 3}"${ph}>${esc(v ?? '')}</textarea>`; break;
      case 'select':
        input = `<select id="${id}" data-key="${f.key}">${optList(f.options).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`; break;
      case 'chips':
        input = `<div class="chips" data-chips="${f.key}" role="radiogroup">${optList(f.options).map((o) => `<button type="button" class="chip ${String(o.value) === String(v ?? '') ? 'on' : ''}" data-v="${esc(o.value)}" role="radio" aria-checked="${String(o.value) === String(v ?? '')}">${o.dot ? `<i style="background:${o.dot}"></i>` : ''}${esc(o.label)}</button>`).join('')}</div>
          <input type="hidden" data-key="${f.key}" value="${esc(v ?? '')}" data-allow-empty="${f.allowEmpty ? 1 : 0}">`; break;
      case 'minutes':
        input = `<div class="min-input"><input id="${id}" type="number" inputmode="numeric" min="0" step="5" data-key="${f.key}" value="${esc(v ?? '')}"${ph}><span>分</span></div>
          <div class="chips small">${QUICK_MIN.map((m) => `<button type="button" class="chip" data-setmin="${f.key}" data-v="${m}">${m < 60 ? m + '分' : m / 60 + '時間'}</button>`).join('')}</div>`; break;
      case 'vas': {
        const set = v != null && v !== '';
        input = `<div class="vas ${set ? '' : 'unset'}" data-vas="${f.key}">
          <div class="vas-top"><span class="vas-val">${set ? v : '未入力'}</span><button type="button" class="link-btn" data-vasclear="${f.key}">クリア</button></div>
          <input id="${id}" type="range" min="0" max="100" step="1" value="${set ? v : 50}" aria-label="${esc(f.label)}">
          <div class="vas-anchors"><span>0：${esc(f.lo)}</span><span>100：${esc(f.hi)}</span></div>
          <input type="hidden" data-key="${f.key}" value="${set ? v : ''}"></div>`; break;
      }
      case 'rpe':
        input = `<div class="rpe" data-chips="${f.key}">${DM.model.RPE.map(([n, l]) => `<button type="button" class="chip rpe-chip ${String(n) === String(v ?? '') ? 'on' : ''}" data-v="${n}"><b>${n}</b>${l ? `<small>${l}</small>` : ''}</button>`).join('')}</div>
          <input type="hidden" data-key="${f.key}" value="${esc(v ?? '')}" data-allow-empty="1">`; break;
      case 'check':
        return `<div class="field" data-field="${f.key}"><label class="check"><input type="checkbox" data-key="${f.key}" ${v ? 'checked' : ''}> ${esc(f.label)}</label>${hint}</div>`;
      case 'number':
        input = `<input id="${id}" type="number" inputmode="decimal" data-key="${f.key}" value="${esc(v ?? '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="${f.step || 'any'}"${ph}>`; break;
      default:
        input = `<input id="${id}" type="${f.type || 'text'}" data-key="${f.key}" value="${esc(v ?? '')}"${ph} ${f.type === 'text' || !f.type ? 'autocomplete="off"' : f.type === 'password' ? 'autocomplete="off"' : ''}>`;
    }
    return `<div class="field ${f.half ? 'half' : ''}" data-field="${f.key}">${lab}${input}${hint}</div>`;
  }

  function readForm(root) {
    const o = {};
    for (const el of root.querySelectorAll('[data-key]')) {
      const k = el.dataset.key;
      if (el.type === 'checkbox') o[k] = el.checked;
      else if (el.type === 'number') o[k] = el.value === '' ? null : Number(el.value);
      else o[k] = el.value;
    }
    return o;
  }

  DM.openForm = function (cfg) {
    const values = cfg.values || {};
    const body = `<form class="form" novalidate>
      <div class="fields">${cfg.fields.map((f) => fieldHTML(f, values[f.key])).join('')}</div>
      <div class="form-error" hidden></div>
      <div class="btn-row">
        ${cfg.onDelete ? '<button type="button" class="btn danger ghost" data-del>削除</button>' : ''}
        <span class="spacer"></span>
        <button type="button" class="btn" data-cancel>キャンセル</button>
        <button type="submit" class="btn primary">${esc(cfg.saveLabel || '保存')}</button>
      </div></form>`;
    let initial;
    const s = DM.openSheet(body, { title: cfg.title, dirtyCheck: () => JSON.stringify(readForm(form)) !== initial });
    const form = s.body.querySelector('form');
    const applyShow = () => {
      const v = readForm(form);
      for (const f of cfg.fields) if (f.show) { const el = form.querySelector(`[data-field="${f.key}"]`); if (el) el.hidden = !f.show(v); }
      cfg.onInput && cfg.onInput(v, form);
    };
    form.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-chips] .chip');
      if (chip) {
        const g = chip.closest('[data-chips]');
        const hid = form.querySelector(`input[type=hidden][data-key="${g.dataset.chips}"]`);
        const was = chip.classList.contains('on');
        g.querySelectorAll('.chip').forEach((c) => { c.classList.remove('on'); c.setAttribute('aria-checked', 'false'); });
        if (was && hid.dataset.allowEmpty === '1') hid.value = '';
        else { chip.classList.add('on'); chip.setAttribute('aria-checked', 'true'); hid.value = chip.dataset.v; }
        applyShow(); return;
      }
      const sm = e.target.closest('[data-setmin]');
      if (sm) { form.querySelector(`[data-key="${sm.dataset.setmin}"]`).value = sm.dataset.v; applyShow(); return; }
      const vc = e.target.closest('[data-vasclear]');
      if (vc) {
        const box = form.querySelector(`[data-vas="${vc.dataset.vasclear}"]`);
        box.classList.add('unset'); box.querySelector('.vas-val').textContent = '未入力';
        box.querySelector('input[type=hidden]').value = ''; box.querySelector('input[type=range]').value = 50; return;
      }
      if (e.target.closest('[data-cancel]')) s.close();
      if (e.target.closest('[data-del]')) {
        DM.confirm(cfg.deleteMessage || 'この記録を削除しますか？', { danger: true, ok: '削除' }).then((ok) => { if (ok) { s.close(); cfg.onDelete(); } });
      }
    });
    form.addEventListener('input', (e) => {
      const box = e.target.closest('[data-vas]');
      if (box && e.target.type === 'range') {
        box.classList.remove('unset');
        box.querySelector('.vas-val').textContent = e.target.value;
        box.querySelector('input[type=hidden]').value = e.target.value;
      }
      applyShow();
    });
    form.addEventListener('change', applyShow);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = readForm(form);
      for (const f of cfg.fields) {
        const hidden = f.show && !f.show(v);
        if (f.required && !hidden && (v[f.key] == null || String(v[f.key]).trim() === '')) return showErr(`「${f.label}」を入力してください`);
      }
      const r = cfg.onSave(v);
      if (typeof r === 'string') return showErr(r);
      s.close();
    });
    const showErr = (m) => { const el = form.querySelector('.form-error'); el.textContent = m; el.hidden = false; };
    applyShow();
    initial = JSON.stringify(readForm(form));
    const first = form.querySelector('input[type=text],textarea');
    if (first && cfg.autofocus !== false && window.matchMedia('(pointer:fine)').matches) first.focus();
    return s;
  };

  // ---------- 小物 ----------
  DM.seg = (name, opts, cur) => `<div class="seg" role="tablist">${opts.map(([v, l]) => `<button type="button" role="tab" class="${v === cur ? 'on' : ''}" aria-selected="${v === cur}" data-seg="${name}" data-v="${v}">${esc(l)}</button>`).join('')}</div>`;
  DM.catDot = (id) => `<i class="dot" style="background:${DM.model.catColor(id)}"></i>`;
  DM.catOptions = () => DM.model.cats().map((c) => ({ value: c.id, label: c.name, dot: DM.model.catColor(c.id) }));
  DM.progress = (pct, color) => `<div class="bar-track"><div class="bar-fill" style="width:${DM.clamp(pct || 0, 0, 100)}%;${color ? `background:${color}` : ''}"></div></div>`;
  DM.empty = (msg, btn) => `<div class="empty"><p>${msg}</p>${btn || ''}</div>`;

  DM.copyText = async function (text) {
    try { await navigator.clipboard.writeText(text); DM.toast('コピーしました'); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
      DM.toast(ok ? 'コピーしました' : 'コピーできませんでした。長押しで選択してください', { error: !ok });
    }
  };
  DM.download = function (filename, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
})(window.DM);
