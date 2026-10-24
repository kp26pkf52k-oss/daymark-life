/* DAYMARK LIFE — SVGグラフ（外部ライブラリなし）
 * 使い方：DM.charts.place(spec) が返すHTMLを画面に入れ、描画後に DM.charts.mount() を呼ぶ。
 * 実際の幅で描画するので、スマホでもPCでも文字の大きさが変わらない。
 * 記録のない日（null）は線をつながず、0として描かない。
 */
(function (DM) {
  const specs = new Map();
  let seq = 0;
  const esc = DM.esc;

  function place(spec) {
    const id = 'c' + (++seq);
    specs.set(id, spec);
    const h = spec.height || 180;
    const legend = spec.legend !== false && spec.series && spec.series.length > 1
      ? `<div class="legend">${spec.series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `${legend}<div class="chart" data-chart="${id}" style="height:${h}px" role="img" aria-label="${esc(spec.label || 'グラフ')}"></div>`;
  }

  function mount(root = document) {
    for (const el of root.querySelectorAll('.chart[data-chart]')) {
      const spec = specs.get(el.dataset.chart);
      if (!spec) continue;
      const w = Math.max(240, el.clientWidth || 320);
      const h = spec.height || 180;
      try { el.innerHTML = draw[spec.type](spec, w, h); } catch (e) { console.error(e); el.textContent = 'グラフを描画できませんでした'; }
    }
  }
  const reset = () => { specs.clear(); };

  // 切りのよい目盛り：刻み幅を 1・2・2.5・5 ×10^n から選ぶ
  function niceScale(v) {
    if (!(v > 0)) return { max: 1, ticks: 4 };
    const raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw);
    const ticks = Math.max(1, Math.ceil(v / step - 1e-9));
    return { max: step * ticks, ticks };
  }
  const niceMax = (v) => niceScale(v).max;
  const fmtTick = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

  function axes(w, h, m, yMin, yMax, ticks, unit) {
    if (yMin === 0) { const ns = niceScale(yMax); if (Math.abs(ns.max - yMax) < 1e-9) ticks = ns.ticks; }
    const span = yMax - yMin;
    if (Number.isInteger(span) && span >= 2 && span <= 6) ticks = span; // 1〜5点などの小さな整数の目盛り
    let s = '';
    for (let i = 0; i <= ticks; i++) {
      const v = yMin + ((yMax - yMin) * i) / ticks;
      const y = m.t + (h - m.t - m.b) * (1 - i / ticks);
      s += `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}"/>`;
      s += `<text class="tick" x="${m.l - 6}" y="${y + 4}" text-anchor="end">${fmtTick(v)}</text>`;
    }
    if (unit) s += `<text class="tick" x="${m.l + 4}" y="${m.t - 8}" text-anchor="start">${esc(unit)}</text>`;
    return s;
  }
  // 最新の日を必ず表示し、そこから等間隔にさかのぼってラベルを置く（重なり防止）
  function xLabels(labels, xAt, h, m, maxLabels) {
    const n = labels.length;
    const step = Math.max(1, Math.ceil(n / Math.max(1, maxLabels)));
    let s = '';
    labels.forEach((lb, i) => {
      if ((n - 1 - i) % step !== 0) return;
      s += `<text class="tick" x="${xAt(i)}" y="${h - m.b + 16}" text-anchor="middle">${esc(lb)}</text>`;
    });
    return s;
  }
  const tipAttr = (t) => `data-tip="${esc(t)}"`;

  const draw = {
    // spec: {labels, series:[{name,color,values}], yMin, yMax, unit, tipLabels, fmt}
    line(spec, w, h) {
      const m = { l: 38, r: 14, t: 24, b: 24 };
      const all = spec.series.flatMap((s) => s.values).filter((v) => v != null);
      if (!all.length) return `<div class="chart-empty">表示できる記録がありません</div>`;
      const yMin = spec.yMin ?? 0;
      const yMax = spec.yMax ?? niceMax(Math.max(...all));
      const n = spec.labels.length;
      const xAt = (i) => (n === 1 ? (m.l + w - m.r) / 2 : m.l + ((w - m.l - m.r) * i) / (n - 1));
      const yAt = (v) => m.t + (h - m.t - m.b) * (1 - (v - yMin) / (yMax - yMin || 1));
      let s = `<svg width="${w}" height="${h}">` + axes(w, h, m, yMin, yMax, 4, spec.unit);
      s += xLabels(spec.labels, xAt, h, m, Math.floor((w - m.l) / 46));
      for (const se of spec.series) {
        let path = '', pen = false;
        se.values.forEach((v, i) => {
          if (v == null) { pen = false; return; }
          path += `${pen ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`; pen = true;
        });
        s += `<path class="line" d="${path}" stroke="${se.color}"/>`;
        se.values.forEach((v, i) => {
          if (v == null) return;
          const prev = se.values[i - 1], next = se.values[i + 1];
          const isolated = prev == null && next == null;
          if (isolated || n <= 31) s += `<circle class="dot" cx="${xAt(i)}" cy="${yAt(v)}" r="${isolated ? 4 : 3}" fill="${se.color}"/>`;
        });
      }
      // ホバー用の列
      const colW = (w - m.l - m.r) / Math.max(1, n - 1);
      spec.labels.forEach((lb, i) => {
        const vals = spec.series.map((se) => `${se.name}: ${se.values[i] == null ? '記録なし' : (spec.fmt ? spec.fmt(se.values[i]) : se.values[i])}`).join('\n');
        const x0 = Math.max(m.l, xAt(i) - colW / 2);
        s += `<rect class="hit" x="${x0}" y="${m.t}" width="${Math.max(6, Math.min(colW, w - m.r - x0))}" height="${h - m.t - m.b}" ${tipAttr(`${(spec.tipLabels || spec.labels)[i]}\n${vals}`)}/>`;
      });
      return s + '</svg>';
    },

    // 積み上げ棒 spec: {labels, series:[{name,color,values}], unit, fmt, target}
    bar(spec, w, h) {
      const m = { l: 38, r: 14, t: 24, b: 24 };
      const n = spec.labels.length;
      const totals = spec.labels.map((_, i) => DM.sum(spec.series.map((se) => se.values[i] || 0)));
      const maxV = Math.max(...totals, spec.target || 0);
      if (!(maxV > 0)) return `<div class="chart-empty">この期間の記録はありません</div>`;
      const yMax = niceMax(maxV);
      const band = (w - m.l - m.r) / n;
      const bw = Math.max(3, Math.min(28, band * 0.62));
      const yAt = (v) => m.t + (h - m.t - m.b) * (1 - v / yMax);
      const xAt = (i) => m.l + band * i + band / 2;
      let s = `<svg width="${w}" height="${h}">` + axes(w, h, m, 0, yMax, 4, spec.unit);
      s += xLabels(spec.labels, xAt, h, m, Math.floor((w - m.l) / 40));
      spec.labels.forEach((lb, i) => {
        let acc = 0;
        const segs = spec.series.map((se) => ({ se, v: se.values[i] || 0 })).filter((x) => x.v > 0);
        segs.forEach((x, j) => {
          const y1 = yAt(acc), y2 = yAt(acc + x.v);
          const top = j === segs.length - 1;
          const hh = Math.max(1, y1 - y2 - (top ? 0 : 2));
          s += top
            ? `<path d="${roundTop(xAt(i) - bw / 2, y2, bw, hh, Math.min(4, bw / 2, hh))}" fill="${x.se.color}"/>`
            : `<rect x="${xAt(i) - bw / 2}" y="${y2 + 2}" width="${bw}" height="${hh}" fill="${x.se.color}"/>`;
          acc += x.v;
        });
        const vals = spec.series.filter((se) => (se.values[i] || 0) > 0).map((se) => `${se.name}: ${spec.fmt ? spec.fmt(se.values[i]) : se.values[i]}`);
        const tip = `${(spec.tipLabels || spec.labels)[i]}\n${vals.length ? vals.join('\n') + (spec.series.length > 1 ? `\n合計: ${spec.fmt ? spec.fmt(totals[i]) : totals[i]}` : '') : '記録なし'}`;
        s += `<rect class="hit" x="${m.l + band * i}" y="${m.t}" width="${band}" height="${h - m.t - m.b}" ${tipAttr(tip)}/>`;
      });
      if (spec.target) {
        const y = yAt(spec.target);
        s += `<line class="target" x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}"/><text class="tick" x="${w - m.r}" y="${y - 4}" text-anchor="end">目標 ${spec.fmt ? spec.fmt(spec.target) : spec.target}</text>`;
      }
      return s + '</svg>';
    },

    // 散布図 spec: {points:[{x,y,label}], xLabel, yLabel, xMin,xMax,yMin,yMax, color}
    scatter(spec, w, h) {
      const m = { l: 40, r: 12, t: 18, b: 34 };
      const P = spec.points;
      if (!P.length) return `<div class="chart-empty">対応する記録の組がありません</div>`;
      const xs = P.map((p) => p.x), ys = P.map((p) => p.y);
      const xMin = spec.xMin ?? Math.floor(Math.min(...xs)), xMax = spec.xMax ?? niceMax(Math.max(...xs));
      const yMin = spec.yMin ?? 0, yMax = spec.yMax ?? niceMax(Math.max(...ys));
      const xAt = (v) => m.l + (w - m.l - m.r) * ((v - xMin) / (xMax - xMin || 1));
      const yAt = (v) => m.t + (h - m.t - m.b) * (1 - (v - yMin) / (yMax - yMin || 1));
      let s = `<svg width="${w}" height="${h}">` + axes(w, h, m, yMin, yMax, 4, '');
      for (let i = 0; i <= 4; i++) {
        const v = xMin + ((xMax - xMin) * i) / 4;
        s += `<text class="tick" x="${xAt(v)}" y="${h - m.b + 15}" text-anchor="middle">${fmtTick(v)}</text>`;
      }
      s += `<text class="axis-title" x="${(m.l + w - m.r) / 2}" y="${h - 4}" text-anchor="middle">${esc(spec.xLabel)}</text>`;
      s += `<text class="axis-title" x="${m.l}" y="${m.t - 6}" text-anchor="start">${esc(spec.yLabel)}</text>`;
      for (const p of P) s += `<circle class="sdot" cx="${xAt(p.x)}" cy="${yAt(p.y)}" r="5" fill="${spec.color}" ${tipAttr(`${p.label}\n${spec.xLabel}: ${p.x}\n${spec.yLabel}: ${p.y}`)}/>`;
      return s + '</svg>';
    },

    // 1行の割合バー spec: {parts:[{name,color,value}], fmt}
    share(spec, w, h) {
      const total = DM.sum(spec.parts.map((p) => p.value));
      if (!total) return `<div class="chart-empty">この期間の記録はありません</div>`;
      let x = 0, s = `<svg width="${w}" height="${h}">`;
      const parts = spec.parts.filter((p) => p.value > 0);
      parts.forEach((p, i) => {
        const pw = (w * p.value) / total;
        const gap = i < parts.length - 1 ? 2 : 0;
        s += `<rect x="${x}" y="0" width="${Math.max(1, pw - gap)}" height="${h}" rx="${i === 0 || i === parts.length - 1 ? 4 : 0}" fill="${p.color}" ${tipAttr(`${p.name}: ${spec.fmt ? spec.fmt(p.value) : p.value}（${Math.round((p.value / total) * 100)}%）`)}/>`;
        x += pw;
      });
      return s + '</svg>';
    },

    // 日付ごとの実施マス spec: {days:[date], value:(d)=>number|null, max, color, fmt}
    heat(spec, w, h) {
      const days = spec.days;
      const cols = Math.ceil(days.length / 7);
      const first = (DM.dow(days[0]) + 6) % 7;
      const cell = Math.min(18, Math.floor((w - 24) / (cols + 1)) - 3);
      let s = `<svg width="${w}" height="${(cell + 3) * 7 + 4}">`;
      ['月', '', '水', '', '金', '', '日'].forEach((t, i) => { if (t) s += `<text class="tick" x="0" y="${i * (cell + 3) + cell - 3}">${t}</text>`; });
      days.forEach((d, i) => {
        const k = i + first, c = Math.floor(k / 7), r = k % 7;
        const v = spec.value(d);
        const op = v == null || v === 0 ? 0 : 0.3 + 0.7 * Math.min(1, v / (spec.max || 1));
        s += `<rect x="${20 + c * (cell + 3)}" y="${r * (cell + 3)}" width="${cell}" height="${cell}" rx="3" class="heat-bg"/>`;
        if (op) s += `<rect x="${20 + c * (cell + 3)}" y="${r * (cell + 3)}" width="${cell}" height="${cell}" rx="3" fill="${spec.color}" fill-opacity="${op.toFixed(2)}"/>`;
        s += `<rect class="hit" x="${20 + c * (cell + 3)}" y="${r * (cell + 3)}" width="${cell}" height="${cell}" ${tipAttr(`${DM.fmtDate(d)}\n${v ? (spec.fmt ? spec.fmt(v) : v) : '記録なし'}`)}/>`;
      });
      return s + '</svg>';
    },
  };
  function roundTop(x, y, w, h, r) {
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }

  // ---------- ツールチップ（マウス・タッチ共通） ----------
  let tipEl;
  function showTip(target, cx, cy) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tooltip'; document.body.appendChild(tipEl); }
    tipEl.innerHTML = esc(target.getAttribute('data-tip')).replace(/\n/g, '<br>');
    tipEl.hidden = false;
    const r = tipEl.getBoundingClientRect();
    let x = cx + 12, y = cy - r.height - 12;
    if (x + r.width > window.innerWidth - 8) x = cx - r.width - 12;
    if (x < 8) x = 8;
    if (y < 8) y = cy + 16;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  const hideTip = () => { if (tipEl) tipEl.hidden = true; };
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t && t.closest('.chart')) showTip(t, e.clientX, e.clientY); else if (e.pointerType === 'mouse') hideTip();
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t && t.closest('.chart')) showTip(t, e.clientX, e.clientY); else hideTip();
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => mount(), 150); });

  DM.charts = { place, mount, reset };
})(window.DM);
