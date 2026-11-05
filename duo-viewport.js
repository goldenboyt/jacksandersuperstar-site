(() => {
  // Site-owned viewport sizing for Safari's phone side strip. No userscript,
  // element rewriting, custom scrolling or browser-control overlay is installed.
  if (top !== self || !/iPhone/.test(navigator.userAgent) || /CriOS|FxiOS|EdgiOS/.test(navigator.userAgent) || !matchMedia('(pointer: coarse)').matches) return;
  const root = document.documentElement, tag = document.querySelector('meta[name="viewport"]');
  if (!tag || window.__duoWideLoaded) return;
  const original = tag.content, preferences = new Map(original.split(',').map(item => item.trim().split('=')));
  if (preferences.get('width') !== 'device-width') return;
  const key = 'superstar:duo-side-strip';
  let known = false, bounds = null, ours = '', frame = 0, lastShape = '';
  try { known = sessionStorage.getItem(key) === '1'; } catch {}
  window.SuperstarViewport = { bounds: () => bounds };

  function measure() {
    const view = window.visualViewport, shown = view?.width || innerWidth;
    const type = screen.orientation?.type || '', angle = screen.orientation?.angle ?? window.orientation ?? 0;
    const landscape = type ? type.startsWith('landscape') : Math.abs(angle) === 90;
    // A portrait window on the unfolded landscape screen is a split-view pane.
    if (landscape && shown < innerHeight) return null;
    const smaller = Math.min(screen.width, screen.height), larger = Math.max(screen.width, screen.height);
    const masked = outerHeight === innerHeight && [[320,568],[375,667],[390,844],[414,896]].some(([w,h]) => screen.width === w && screen.height === h);
    const previousPhoneWidth = new Map([[375,320],[390,375],[414,390]]).get(screen.width);
    const hiddenStrip = masked && ((!landscape && previousPhoneWidth && shown < previousPhoneWidth) || (landscape && known));
    const full = hiddenStrip ? shown + 84 : landscape ? larger : smaller;
    const gap = full - shown;
    if (gap < 40 || gap > 120 || (landscape && !known)) return null;
    // A small app window must retain its own origin, rather than use the screen's.
    if (!masked && outerWidth > 0 && Math.abs(outerWidth - full) > 2) return null;
    if (!landscape && !known) { known = true; try { sessionStorage.setItem(key, '1'); } catch {} }
    const left = landscape && (type === 'landscape-primary' || (!type && angle === 90)) ? gap : 0;
    return { width: shown, full, left, right: gap - left, height: Math.min(innerHeight, view?.height || innerHeight) };
  }

  function update() {
    frame = 0;
    const shape = [screen.width, screen.height, outerWidth, screen.orientation?.type, window.orientation].join(':');
    const resized = lastShape && shape !== lastShape;
    lastShape = shape;
    const scaled = Math.abs((window.visualViewport?.scale || 1) - 1) > .025;
    // Do not resize the layout around a pinch or the onscreen keyboard.
    if (!resized && (document.activeElement?.matches('input,textarea,[contenteditable=true]') || scaled)) return;
    if (window.__duoWideLoaded || (ours && tag.content !== ours)) return;
    // Folding can briefly retain the old viewport scale. Restore the device
    // viewport first, then accept the final geometry from Safari's resize event.
    const next = scaled ? null : measure(), before = JSON.stringify(bounds);
    bounds = next;
    if (next) {
      const values = new Map(preferences);
      values.set('width', String(Math.round(next.full)));
      values.set('height', String(Math.ceil(next.height)));
      values.set('initial-scale', '1');
      values.set('minimum-scale', '1');
      values.set('viewport-fit', 'cover');
      ours = [...values].map(([name,value]) => `${name}=${value}`).join(',');
      if (tag.content !== ours) tag.content = ours;
      root.classList.add('site-duo-strip');
      for (const [name,value] of Object.entries({width:next.width,left:next.left,right:next.right})) root.style.setProperty(`--site-visible-${name}`, `${value}px`);
      root.style.setProperty('--site-canvas-width', `${next.full}px`);
      root.style.setProperty('--site-visible-height', `${Math.ceil(next.height)}px`);
    } else {
      if (ours && tag.content === ours) tag.content = original;
      ours = '';
      root.classList.remove('site-duo-strip');
      for (const name of ['width','left','right']) root.style.removeProperty(`--site-visible-${name}`);
      root.style.removeProperty('--site-canvas-width');
      root.style.removeProperty('--site-visible-height');
    }
    if (JSON.stringify(bounds) !== before) document.dispatchEvent(new Event('superstar:viewport'));
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('pageshow', schedule);
  screen.orientation?.addEventListener('change', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  document.addEventListener('focusout', schedule);
  update();
})();
