(() => {
  const root = document.documentElement;
  // Restore the browser's saved position immediately before resuming smooth links.
  const scrollBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';
  window.addEventListener('pageshow', async () => {
    await document.fonts?.ready;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.style.scrollBehavior = scrollBehavior;
    }));
  }, { once: true });
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const address = new URL(location.href);
  const introKey = 'superstar:intro:last-shown';
  const cooldown = 60 * 60 * 1000;
  // Keep the cooldown across refreshes and tabs, with a session fallback.
  function introIsDue() {
    const now = Date.now();
    let lastShown = 0;
    for (const name of ['localStorage', 'sessionStorage']) {
      try {
        const saved = Number(window[name].getItem(introKey));
        if (Number.isFinite(saved) && saved > lastShown && saved <= now) lastShown = saved;
      } catch {}
    }
    return now - lastShown >= cooldown;
  }
  const play = introIsDue() && !reduced.matches && !navigator.connection?.saveData && !address.searchParams.has('release') && (!address.hash || address.hash === '#top');
  function rememberIntro() {
    for (const name of ['localStorage', 'sessionStorage']) {
      try { window[name].setItem(introKey, String(Date.now())); return; } catch {}
    }
  }
  if (play) root.classList.add('intro-pending');

  const pageLoaded = new Promise(resolve => {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve, { once: true });
  });
  let finished = false, ready = false, started = false, ceiling;
  const locked = [];
  function fitZoom() {
    const intro = document.getElementById('site-intro');
    if (!intro) return;
    const width = innerWidth, height = innerHeight;
    // Coordinates match the upper counter of the e in the original logo.
    const focus = { x: 1505, y: 103 };
    const scale = Math.min(width * .66, 760) / 1710;
    const left = (width - 1710 * scale) / 2;
    const top = (height - 657 * scale) / 2;
    const opening = { x: left + focus.x * scale, y: top + focus.y * scale };
    const anticipation = scale * .97;
    // A 14-unit circle fits inside the counter. Expand it past every corner.
    const through = (Math.hypot(width, height) / 2 + 16) / 14 * 1.15;
    const matrix = (size, x, y) => `matrix(${size},0,0,${size},${x},${y})`;
    intro.querySelector('.intro-stage').setAttribute('viewBox', `0 0 ${width} ${height}`);
    intro.style.setProperty('--intro-from', matrix(scale, left, top));
    intro.style.setProperty('--intro-anticipation', matrix(anticipation, opening.x - focus.x * anticipation, opening.y - focus.y * anticipation));
    intro.style.setProperty('--intro-through', matrix(through, width / 2 - focus.x * through, height / 2 - focus.y * through));
    intro.classList.add('intro-fitted');
  }
  function finish(immediate = false) {
    if (finished) return;
    finished = true;
    clearTimeout(ceiling);
    window.removeEventListener('resize', fitZoom);
    const intro = document.getElementById('site-intro');
    intro?.classList.add('intro-out');
    root.classList.remove('intro-pending', 'intro-revealing');
    document.body?.classList.add('hero-ready');
    if (immediate) document.body?.classList.add('intro-complete');
    locked.forEach(element => { element.inert = false; });
    document.dispatchEvent(new Event('superstar:intro-end'));
    intro?.remove();
  }

  async function start() {
    if (!play || finished || started || !ready || document.hidden) return;
    started = true;
    const intro = document.getElementById('site-intro');
    fitZoom();
    // Render the loaded homepage beneath the letter before opening the mask.
    document.body.classList.add('intro-complete');
    root.classList.add('intro-revealing');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 120));
    if (finished) return;
    intro.classList.add('intro-go');
    ceiling = setTimeout(() => finish(true), 2000);
  }
  document.addEventListener('DOMContentLoaded', async () => {
    const intro = document.getElementById('site-intro');
    if (!play || finished || !introIsDue()) { finish(true); intro?.remove(); return; }
    const logoElement = intro?.querySelector('.intro-logo');
    if (!logoElement) { finish(true); return; }
    intro.hidden = false;
    rememberIntro();
    document.querySelectorAll('.header, main, footer, .skip').forEach(element => {
      if (!element.inert) { element.inert = true; locked.push(element); }
    });
    fitZoom();
    window.addEventListener('resize', fitZoom);
    logoElement.addEventListener('animationend', event => {
      if (event.animationName === 'superstar-portal') finish();
    });
    intro.addEventListener('pointerdown', () => finish(true));
    const logo = new Image(); logo.src = 'assets/brand-logo.png';
    const decode = image => image.decode ? image.decode().catch(() => {}) : Promise.resolve();
    await Promise.all([
      pageLoaded,
      document.fonts?.ready,
      decode(logo),
      ...[...document.querySelectorAll('.hero img')].map(decode)
    ]);
    if (finished) return;
    if (!logo.naturalWidth) { finish(true); return; }
    ready = true;
    start();
  }, { once: true });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && root.classList.contains('intro-pending')) finish(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (started) finish(true); }
    else start();
  });
  reduced.addEventListener('change', () => { if (reduced.matches) finish(true); });
  window.addEventListener('pageshow', event => {
    if (event.persisted) { document.getElementById('site-intro')?.remove(); finish(true); }
  });
})();
