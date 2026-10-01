(() => {
  const viewer = document.getElementById('soboda-viewer');
  const button = document.getElementById('soboda-spin');
  const reset = document.getElementById('soboda-reset');
  const status = document.getElementById('soboda-model-status');
  const views = [...document.querySelectorAll('[data-soboda-orbit]')];
  const controls = [button, reset, ...views].filter(Boolean);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (!viewer || !button) return;
  let requested = false, visible = false, ready = false, paused = reduced.matches;
  function clearView() { views.forEach(view => view.setAttribute('aria-pressed', 'false')); }
  function sync() {
    viewer.toggleAttribute('auto-rotate', ready && visible && !document.hidden && !paused && !document.querySelector('dialog[open]'));
    button.textContent = paused ? 'resume rotation' : 'pause rotation';
    button.setAttribute('aria-label', paused ? 'Resume Soboda rotation' : 'Pause Soboda rotation');
  }
  function fail() {
    ready = false; sync(); controls.forEach(control => { control.disabled = true; });
    viewer.hidden = true;
    document.getElementById('soboda-fallback-image').hidden = false;
    document.getElementById('soboda-model-fallback').hidden = false;
    status.hidden = false; status.textContent = 'The 3D specimen couldn’t load. Explore its images in the archive.';
  }
  async function load() {
    if (requested) return;
    requested = true;
    window.ModelViewerElement = { meshoptDecoderLocation: new URL('assets/soboda/meshopt-decoder.js', document.baseURI).href };
    try {
      await import('./assets/soboda/model-viewer.js');
      await customElements.whenDefined('model-viewer');
      viewer.src = viewer.dataset.src;
    } catch { fail(); }
  }
  viewer.addEventListener('load', () => {
    ready = true; status.hidden = true;
    controls.forEach(control => { control.disabled = false; }); setView('0deg 75deg auto'); sync();
  });
  viewer.addEventListener('error', fail);
  viewer.addEventListener('camera-change', event => {
    if (event.detail?.source === 'user-interaction') { paused = true; clearView(); sync(); }
  });
  button.addEventListener('click', () => { paused = !paused; clearView(); sync(); });
  function setView(orbit, resetRotation = true) {
    if (resetRotation) viewer.resetTurntableRotation();
    const dimensions = viewer.getDimensions();
    const aspect = viewer.clientWidth / viewer.clientHeight;
    const tangent = Math.tan(Math.PI / 12);
    const radius = Math.max(Math.max(dimensions.x, dimensions.z) / (2 * tangent * aspect * .86), dimensions.y / (2 * tangent * .75));
    viewer.cameraOrbit = orbit.split(' ').slice(0, 2).join(' ') + ' ' + radius + 'm';
    viewer.cameraTarget = 'auto auto auto'; viewer.fieldOfView = '30deg';
    if (reduced.matches) viewer.updateComplete.then(() => { if (ready) viewer.jumpCameraToGoal(); });
  }
  views.forEach(view => view.addEventListener('click', () => {
    paused = true; clearView(); view.setAttribute('aria-pressed', 'true');
    setView(view.dataset.sobodaOrbit); sync();
  }));
  reset?.addEventListener('click', () => {
    setView('0deg 75deg auto'); paused = reduced.matches; clearView(); sync();
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => {
    if (!ready) return;
    const orbit = viewer.getCameraOrbit();
    setView(`${orbit.theta}rad ${orbit.phi}rad auto`, false);
  }).observe(viewer);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', () => { paused = reduced.matches; sync(); });
  document.querySelectorAll('dialog').forEach(dialog => new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  if ('IntersectionObserver' in window) {
    const preload = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { load(); preload.disconnect(); }
    }, { rootMargin: '200px' });
    preload.observe(viewer);
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .05 }).observe(viewer);
  } else { visible = true; load(); }
  sync();
})();
