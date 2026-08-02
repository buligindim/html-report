/* Лёгкий веб-вьюер медицинских изображений: имитация профессионального DICOM-просмотрщика
   на предконвертированных WebP-кадрах. */
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = (n) => String(n).padStart(4, '0');

  const ICON = {
    win: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/></svg>',
    zoom: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    full: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l10-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><rect x="7" y="5.5" width="3.4" height="13" rx="1"/><rect x="13.6" y="5.5" width="3.4" height="13" rx="1"/></svg>',
    reset: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/></svg>'
  };

  class Viewer {
    constructor(root, study) {
      this.root = root;
      this.study = study;
      this.si = 0;
      this.frame = 0;
      this.zoom = 1; this.panX = 0; this.panY = 0;
      this.bright = 100; this.contrast = 100;
      this.mode = 'scroll';
      this.playing = false;
      this.cache = new Map();
      this.render();
    }

    get series() { return this.study.series[this.si]; }

    render() {
      const s = this.series;
      const st = this.study;
      this.root.innerHTML = `
        <div class="mv">
          <div class="mv-head">
            <div class="mv-titles">
              <div class="mv-title">${esc(st.title)} <span class="mv-dot">·</span> ${esc(st.date)}</div>
              <div class="mv-sub"><span class="mv-badge">${esc(st.modality)}</span> ${esc(s.name)}${s.detail ? ` <span class="mv-dot">·</span> ${esc(s.detail)}` : ''} <span class="mv-dot">·</span> ${s.count} ${s.count === 1 ? 'кадр' : 'кадров'}</div>
            </div>
            <div class="mv-tools">
              <button class="mv-tool" data-act="win" title="Яркость и контраст (перетаскивание)">${ICON.win}</button>
              <button class="mv-tool" data-act="zoom" title="Масштаб (перетаскивание)">${ICON.zoom}</button>
              <button class="mv-tool" data-act="play" title="Кинопросмотр">${ICON.play}</button>
              <button class="mv-tool" data-act="reset" title="Сбросить настройки">${ICON.reset}</button>
              <button class="mv-tool" data-act="full" title="Во весь экран">${ICON.full}</button>
            </div>
          </div>
          ${st.series.length > 1 ? `<div class="mv-series">${st.series.map((x, i) =>
            `<button class="mv-chip${i === this.si ? ' active' : ''}" data-series="${i}">${esc(x.plane || x.name)} <span>${x.count}</span></button>`).join('')}</div>` : ''}
          <div class="mv-stage" tabindex="0">
            <div class="mv-canvas"><img class="mv-img" alt="${esc(st.title)}" draggable="false"></div>
            <div class="mv-ol mv-tl"><span class="mv-count"></span></div>
            <div class="mv-ol mv-bl"><span class="mv-wl"></span></div>
            <div class="mv-ol mv-tr"><span class="mv-hint">Прокрутка — листать срезы</span></div>
            ${st.modality === 'Рентген' ? '' : `<div class="mv-mark mv-a">A</div><div class="mv-mark mv-p">P</div>
            <div class="mv-mark mv-r">R</div><div class="mv-mark mv-l">L</div>`}
            <div class="mv-scale"><div class="mv-scale-bar"></div><span class="mv-scale-txt"></span></div>
            <div class="mv-load">Загрузка…</div>
          </div>
          <div class="mv-foot">
            <input class="mv-range" type="range" min="1" max="${s.count}" value="1">
            <div class="mv-note">Предпросмотр в сжатом качестве. Оригиналы DICOM — в разделе «Архивы КТ и МРТ».</div>
          </div>
        </div>`;

      this.img = this.root.querySelector('.mv-img');
      this.stage = this.root.querySelector('.mv-stage');
      this.range = this.root.querySelector('.mv-range');
      this.canvas = this.root.querySelector('.mv-canvas');
      this.bind();
      this.setFrame(0);
      this.preload();
    }

    url(i) { return `${this.series.dir}/${pad(i + 1)}.webp`; }

    preload() {
      const s = this.series;
      const step = Math.max(1, Math.floor(s.count / 24));
      for (let i = 0; i < s.count; i += step) { const im = new Image(); im.src = this.url(i); }
    }

    setFrame(i) {
      const s = this.series;
      this.frame = Math.max(0, Math.min(s.count - 1, i));
      this.img.src = this.url(this.frame);
      this.root.querySelector('.mv-count').textContent = `${this.frame + 1} / ${s.count}`;
      this.root.querySelector('.mv-wl').innerHTML = `WL: ${s.wl != null ? s.wl : '—'}<br>WW: ${s.ww != null ? s.ww : '—'}`;
      this.range.value = this.frame + 1;
      this.applyView();
      this.updateScale();
    }

    applyView() {
      this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      this.img.style.filter = `brightness(${this.bright}%) contrast(${this.contrast}%)`;
    }

    updateScale() {
      const s = this.series;
      const bar = this.root.querySelector('.mv-scale-bar');
      const txt = this.root.querySelector('.mv-scale-txt');
      if (!s.mmPerPx) { bar.style.display = 'none'; txt.textContent = ''; return; }
      const rendered = this.img.clientHeight || 380;
      const natural = this.img.naturalHeight || 512;
      const pxPerMm = (rendered / natural) * this.zoom / s.mmPerPx;
      let cm = 5;
      let px = pxPerMm * cm * 10;
      while (px > 180 && cm > 1) { cm -= 1; px = pxPerMm * cm * 10; }
      while (px < 40 && cm < 20) { cm += 1; px = pxPerMm * cm * 10; }
      bar.style.display = '';
      bar.style.height = Math.round(px) + 'px';
      txt.textContent = cm + ' см';
    }

    bind() {
      const stage = this.stage;
      this.img.addEventListener('load', () => {
        this.root.querySelector('.mv-load').style.display = 'none';
        this.updateScale();
      });

      stage.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (e.ctrlKey) { this.zoom = Math.min(6, Math.max(1, this.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); this.applyView(); this.updateScale(); return; }
        this.setFrame(this.frame + (e.deltaY > 0 ? 1 : -1));
      }, { passive: false });

      let drag = null;
      stage.addEventListener('pointerdown', (e) => {
        stage.focus({ preventScroll: true });
        stage.setPointerCapture(e.pointerId);
        drag = { x: e.clientX, y: e.clientY, f: this.frame, b: this.bright, c: this.contrast, z: this.zoom, px: this.panX, py: this.panY, alt: e.altKey || e.button === 2 || e.shiftKey };
      });
      stage.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (this.mode === 'win' || drag.alt) {
          this.bright = Math.max(20, Math.min(260, drag.b + dy * -0.4));
          this.contrast = Math.max(30, Math.min(320, drag.c + dx * 0.5));
          this.applyView();
        } else if (this.mode === 'zoom') {
          this.zoom = Math.min(6, Math.max(1, drag.z * (1 - dy / 260)));
          this.applyView(); this.updateScale();
        } else if (this.zoom > 1 && e.shiftKey) {
          this.panX = drag.px + dx; this.panY = drag.py + dy; this.applyView();
        } else {
          this.setFrame(drag.f + Math.round(dy / 6));
        }
      });
      const stop = () => { drag = null; };
      stage.addEventListener('pointerup', stop);
      stage.addEventListener('pointercancel', stop);
      stage.addEventListener('contextmenu', (e) => e.preventDefault());

      stage.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { this.setFrame(this.frame + 1); e.preventDefault(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { this.setFrame(this.frame - 1); e.preventDefault(); }
      });

      this.range.addEventListener('input', () => this.setFrame(parseInt(this.range.value, 10) - 1));

      this.root.querySelectorAll('[data-series]').forEach((b) => b.addEventListener('click', () => {
        this.si = parseInt(b.dataset.series, 10); this.frame = 0; this.zoom = 1; this.panX = this.panY = 0;
        this.bright = this.contrast = 100; this.render();
      }));

      this.root.querySelectorAll('.mv-tool').forEach((b) => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'reset') { this.zoom = 1; this.panX = this.panY = 0; this.bright = this.contrast = 100; this.mode = 'scroll'; this.applyView(); this.updateScale(); this.syncTools(); return; }
        if (act === 'full') { this.toggleFull(); return; }
        if (act === 'play') { this.togglePlay(); return; }
        this.mode = this.mode === act ? 'scroll' : act;
        this.syncTools();
      }));
      this.syncTools();
    }

    syncTools() {
      this.root.querySelectorAll('.mv-tool').forEach((b) => {
        b.classList.toggle('active', b.dataset.act === this.mode || (b.dataset.act === 'play' && this.playing));
      });
      const hint = { scroll: 'Прокрутка — листать срезы', win: 'Перетаскивание — яркость и контраст', zoom: 'Перетаскивание — масштаб' };
      const h = this.root.querySelector('.mv-hint');
      if (h) h.textContent = hint[this.mode] || hint.scroll;
    }

    togglePlay() {
      this.playing = !this.playing;
      const btn = this.root.querySelector('[data-act="play"]');
      btn.innerHTML = this.playing ? ICON.pause : ICON.play;
      if (this.timer) clearInterval(this.timer);
      if (this.playing) {
        this.timer = setInterval(() => {
          this.setFrame(this.frame + 1 >= this.series.count ? 0 : this.frame + 1);
        }, 90);
      }
      this.syncTools();
    }

    toggleFull() {
      const box = this.root.querySelector('.mv');
      if (!document.fullscreenElement) { box.requestFullscreen && box.requestFullscreen(); }
      else { document.exitFullscreen(); }
      setTimeout(() => this.updateScale(), 300);
    }
  }

  window.MedViewer = { create: (root, study) => new Viewer(root, study) };
})();
