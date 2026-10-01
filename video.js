(() => {
  const stage = document.getElementById('music-video-stage');
  const video = document.getElementById('magic-preview-player');
  const toggle = document.getElementById('preview-toggle');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false, requested = false, userPaused = false, userStarted = false, failed = false;
  video.muted = true;

  function setToggle(paused) {
    toggle.setAttribute('aria-label', paused ? 'Play video preview' : 'Pause video preview');
    toggle.classList.toggle('is-paused', paused);
    toggle.firstElementChild.textContent = '';
  }
  function shouldPlay() {
    return visible && !document.hidden && !userPaused && !document.querySelector('dialog[open]') && (userStarted || (!preference.matches && !navigator.connection?.saveData));
  }
  function requestVideo() {
    if (requested || failed) return;
    requested = true;
    video.src = video.dataset.src;
    video.load();
  }
  function sync() {
    if (shouldPlay() && !failed) {
      requestVideo();
      const playing = video.play();
      if (playing?.catch) playing.catch(error => {
        if (error.name === 'NotAllowedError') { userPaused = true; setToggle(true); }
      });
    } else video.pause();
  }
  toggle.addEventListener('click', () => {
    if (failed) return;
    if (!video.paused) { userPaused = true; video.pause(); }
    else { userPaused = false; userStarted = true; sync(); }
  });
  video.addEventListener('playing', () => {
    if (!shouldPlay()) { video.pause(); return; }
    stage.classList.add('preview-playing'); setToggle(false);
  });
  video.addEventListener('pause', () => setToggle(true));
  video.addEventListener('error', () => {
    failed = true; video.pause(); stage.classList.remove('preview-playing'); toggle.hidden = true;
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .2 }).observe(stage);
  } else { visible = true; sync(); }
  document.addEventListener('visibilitychange', sync);
  preference.addEventListener('change', () => { userStarted = false; sync(); });
  navigator.connection?.addEventListener?.('change', sync);
  document.querySelectorAll('dialog').forEach(dialog => new MutationObserver(sync).observe(dialog, { attributes: true, attributeFilter: ['open'] }));
  window.addEventListener('pagehide', () => video.pause());
  window.addEventListener('pageshow', sync);
  setToggle(true); toggle.hidden = false;
})();
