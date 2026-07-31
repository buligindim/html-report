(async function () {
  const $ = (s) => document.querySelector(s);
  const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h !== undefined) n.innerHTML = h; return n; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const load = async (p) => { const r = await fetch(p, { cache: 'no-store' }); if (!r.ok) throw new Error(p); return r.json(); };

  let summary, timeline, docs, archives = [];
  try {
    [summary, timeline, docs] = await Promise.all([
      load('./assets/data/case-summary.json'),
      load('./assets/data/timeline.json'),
      load('./assets/data/documents.json')
    ]);
  } catch (e) {
    document.querySelector('.main').prepend(el('div', 'callout warn', 'Не удалось загрузить данные. Страницу нужно открывать по http/https (GitHub Pages или локальный сервер), а не как файл с диска.'));
    return;
  }
  try { archives = await load('./assets/data/archives.json'); } catch (e) { archives = []; }

  const byId = Object.fromEntries(docs.map((d) => [d.id, d]));

  /* ---------- header ---------- */
  const p = summary.patient;
  $('#patient-name').textContent = p.fullName;
  $('#side-name').textContent = p.fullName;
  $('#side-case').textContent = p.caseId;
  $('#main-diagnosis').textContent = summary.mainDiagnosis;

  $('#hero-meta').innerHTML = [
    p.caseId, p.clinic, 'Лечащий врач: ' + p.attendingDoctor, 'Госпитализация: ' + p.hospitalization
  ].map((t) => `<span class="chip">${esc(t)}</span>`).join('');

  $('#kpi-grid').innerHTML = summary.kpi.map((k) => `
    <div class="kpi"><div class="k">${esc(k.label)}</div><div class="v">${esc(k.value)}</div><div class="h">${esc(k.hint)}</div></div>
  `).join('');

  $('#one-minute').innerHTML = summary.oneMinute.map((t) => `<li>${esc(t)}</li>`).join('');

  /* ---------- timeline ---------- */
  const catTag = { 'Травма': 'alert', 'Операция': 'alert', 'Диагностика': 'brand', 'Контроль': 'ok', 'Выписка': 'ok', 'План': 'warn', 'Анамнез': '' };
  $('#timeline-list').innerHTML = timeline.map((t) => {
    const links = (t.docs || []).filter((id) => byId[id]).map((id) =>
      `<a href="#doc-${id}">${esc(byId[id].type)} · ${esc(byId[id].date)}</a>`).join('');
    return `<div class="tl-item" data-cat="${esc(t.category)}">
      <div class="card">
        <div class="tl-head">
          <span class="tl-date">${esc(t.date)}</span>
          <span class="tag ${catTag[t.category] || ''}">${esc(t.category)}</span>
          <strong style="font-size:15px">${esc(t.title)}</strong>
        </div>
        <p>${esc(t.text)}</p>
        ${links ? `<div class="tl-links">${links}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  /* ---------- documents ---------- */
  const ext = (f) => (f.split('.').pop() || '').toUpperCase();
  const isPdf = (f) => /\.pdf$/i.test(f);
  const isImg = (f) => /\.(png|jpe?g|webp|gif)$/i.test(f);

  function docCard(d) {
    const previewable = isPdf(d.file) || isImg(d.file);
    return `<article class="doc" id="doc-${esc(d.id)}">
      <div class="doc-top">
        <div class="doc-icon">${esc(ext(d.file))}</div>
        <div class="doc-body">
          <div class="doc-title">${esc(d.title)}</div>
          <div class="doc-meta">
            <span><b>${esc(d.date)}</b></span>
            <span>${esc(d.side || '')}</span>
            <span>${esc(d.clinic || '')}</span>
            <span>${esc(d.doctor || '')}</span>
          </div>
          <p class="doc-desc">${esc(d.description)}</p>
          <div class="doc-tags">${(d.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
          <div class="doc-actions">
            ${previewable ? `<button class="btn" data-preview="${esc(d.id)}">Показать документ</button>` : ''}
            <a class="btn primary" href="${esc(d.file)}" download>Скачать оригинал</a>
            <a class="btn" href="${esc(d.file)}" target="_blank" rel="noopener">Открыть в новой вкладке</a>
          </div>
        </div>
      </div>
      <div class="doc-preview" data-preview-box="${esc(d.id)}"></div>
    </article>`;
  }

  const imaging = docs.filter((d) => d.section === 'imaging');
  const reports = docs.filter((d) => d.section === 'reports');
  const analysis = docs.filter((d) => d.section === 'analysis');

  $('#imaging-docs').innerHTML = imaging.map(docCard).join('');
  $('#report-docs').innerHTML = reports.map(docCard).join('');
  if (analysis.length) { $('#analysis-docs').innerHTML = analysis.map(docCard).join(''); $('#analysis-empty').style.display = 'none'; }

  /* filters */
  const types = ['Все', ...Array.from(new Set(imaging.map((d) => d.type)))];
  $('#imaging-filters').innerHTML = types.map((t, i) => `<button data-f="${esc(t)}" class="${i === 0 ? 'active' : ''}">${esc(t)}</button>`).join('');
  $('#imaging-filters').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $('#imaging-filters').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    const f = b.dataset.f;
    imaging.forEach((d) => {
      const node = document.getElementById('doc-' + d.id);
      if (node) node.style.display = (f === 'Все' || d.type === f) ? '' : 'none';
    });
  });

  /* preview toggle */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preview]'); if (!b) return;
    const id = b.dataset.preview;
    const d = byId[id];
    const box = document.querySelector(`[data-preview-box="${id}"]`);
    if (!box) return;
    if (box.classList.contains('open')) {
      box.classList.remove('open'); box.innerHTML = ''; b.textContent = 'Показать документ';
    } else {
      box.innerHTML = isPdf(d.file)
        ? `<iframe src="${d.file}#view=FitH" title="${esc(d.title)}"></iframe>`
        : `<img src="${d.file}" alt="${esc(d.title)}" style="width:100%;display:block">`;
      box.classList.add('open'); b.textContent = 'Скрыть документ';
    }
  });

  /* archives */
  const aUrl = (a) => a.url || a.file || '';
  const aExternal = (a) => /^https?:\/\//i.test(aUrl(a));
  const aIcon = (a) => (aExternal(a) ? (a.host === 'Яндекс.Диск' ? 'ЯД' : 'URL') : ext(aUrl(a)));

  if (archives.length) {
    $('#archives-empty').style.display = 'none';
    $('#archives').innerHTML = archives.map((a) => `<article class="doc"><div class="doc-top">
      <div class="doc-icon">${esc(aIcon(a))}</div>
      <div class="doc-body">
        <div class="doc-title">${esc(a.title)}</div>
        <div class="doc-meta"><span><b>${esc(a.date || '')}</b></span><span>${esc(a.side || '')}</span><span>${esc(a.size || '')}</span>${a.host ? `<span>${esc(a.host)}</span>` : ''}</div>
        <p class="doc-desc">${esc(a.description || '')}</p>
        ${(a.tags || []).length ? `<div class="doc-tags">${a.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="doc-actions">${aExternal(a)
          ? `<a class="btn primary" href="${esc(aUrl(a))}" target="_blank" rel="noopener">Скачать с ${esc(a.host || 'внешнего хранилища')}</a>`
          : `<a class="btn primary" href="${esc(aUrl(a))}" download>Скачать архив</a>`}</div>
      </div></div></article>`).join('');
  }

  /* questions */
  $('#questions-list').innerHTML = summary.questions.map((g) => `
    <div class="q-block"><h3>${esc(g.group)}</h3><ul class="q-list">${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
  `).join('');

  /* downloads */
  const all = [...docs.map((d) => ({ title: d.title, date: d.date, file: d.file, meta: `${d.type} · ${d.side || ''}` })),
               ...archives.map((a) => ({ title: a.title, date: a.date || '', file: aUrl(a), meta: `Архив исследования${a.size ? ' · ' + a.size : ''}${a.host ? ' · ' + a.host : ''}`, external: aExternal(a), host: a.host, icon: aIcon(a) }))];
  $('#download-list').innerHTML = all.map((d) => `<article class="doc"><div class="doc-top">
    <div class="doc-icon">${esc(d.icon || ext(d.file))}</div>
    <div class="doc-body">
      <div class="doc-title">${esc(d.title)}</div>
      <div class="doc-meta"><span><b>${esc(d.date)}</b></span><span>${esc(d.meta)}</span></div>
      <div class="doc-actions">${d.external
        ? `<a class="btn primary" href="${esc(d.file)}" target="_blank" rel="noopener">Скачать с ${esc(d.host || 'внешнего хранилища')}</a>`
        : `<a class="btn primary" href="${esc(d.file)}" download>Скачать</a><a class="btn" href="${esc(d.file)}" target="_blank" rel="noopener">Открыть</a>`}</div>
    </div></div></article>`).join('');

  /* scrollspy */
  const links = Array.from(document.querySelectorAll('.nav a'));
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  function syncSpy() {
    let current = sections[0];
    const line = 120;
    for (const s of sections) { if (s.getBoundingClientRect().top <= line) current = s; }
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = sections[sections.length - 1];
    links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + current.id));
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { syncSpy(); ticking = false; });
  }, { passive: true });
  syncSpy();
})();
