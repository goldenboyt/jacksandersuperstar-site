(() => {
  const audio = document.createElement('audio');
  audio.id = 'song-preview-audio'; audio.preload = 'none'; audio.hidden = true;
  document.body.append(audio);
  const status = document.createElement('span');
  status.className = 'song-preview-announcement'; status.setAttribute('role', 'status');
  document.body.append(status);
  let active = null, request = 0, frame = 0, serial = 0;
  const icon = '<svg class="song-preview-icon" viewBox="0 0 24 24" aria-hidden="true"><path class="song-preview-play" d="M8 5v14l12-7Z"/><path class="song-preview-pause" d="M6 5h4v14H6zm8 0h4v14h-4Z"/></svg>';
  const clock = value => `0:${String(Math.floor(value || 0)).padStart(2, '0')}`;
  const duration = () => Math.min(30, Number.isFinite(audio.duration) ? audio.duration : 30);

  function paint(item, state) {
    item.state = state;
    const playing = state === 'playing' || state === 'loading';
    item.button.classList.toggle('is-playing', playing);
    item.button.setAttribute('aria-pressed', String(playing));
    item.button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} preview of ${item.title}`);
    item.panel.hidden = state === 'idle';
    item.message.textContent = state === 'loading' ? 'loading preview' : state === 'error' ? 'preview unavailable — tap to retry' : '';
    item.progress.hidden = state === 'error'; item.time.hidden = state === 'error';
    if (state === 'idle') {
      item.progress.style.setProperty('--preview-progress', '0');
      item.progress.setAttribute('aria-valuenow', '0'); item.time.textContent = '';
    }
  }
  function stop() {
    request++; cancelAnimationFrame(frame); frame = 0;
    const old = active; active = null;
    audio.pause();
    if (audio.readyState) audio.currentTime = 0;
    if (old) paint(old, 'idle');
    status.textContent = '';
  }
  function progress() {
    if (!active) return;
    const length = duration(), position = Math.min(length, audio.currentTime || 0);
    if (position >= length && length > 0) { stop(); return; }
    active.progress.style.setProperty('--preview-progress', String(position / (length || 30)));
    const seconds = String(Math.floor(position)), total = String(length);
    if (active.progress.getAttribute('aria-valuemax') !== total) active.progress.setAttribute('aria-valuemax', total);
    if (active.progress.getAttribute('aria-valuenow') !== seconds) active.progress.setAttribute('aria-valuenow', seconds);
    const time = `${clock(position)} / ${clock(length)}`;
    if (active.time.textContent !== time) active.time.textContent = time;
  }
  function tick() {
    progress();
    if (active && !audio.paused) frame = requestAnimationFrame(tick);
    else frame = 0;
  }
  function quietOtherMedia() {
    document.querySelectorAll('audio, video').forEach(media => {
      if (media !== audio && !media.muted && media.volume > 0) media.pause();
    });
  }
  function toggle(item) {
    if (active === item && ['playing', 'loading'].includes(item.state)) {
      request++; audio.pause(); cancelAnimationFrame(frame); frame = 0;
      paint(item, 'paused'); status.textContent = `${item.title} preview paused`; return;
    }
    if (active !== item || item.state === 'error') {
      stop(); active = item; audio.src = item.url;
    }
    quietOtherMedia(); paint(item, 'loading'); progress();
    const pending = ++request;
    // Call play directly in the click handler so sound works on iOS and Safari.
    const playback = audio.play();
    playback?.catch(error => {
      if (pending !== request || active !== item || error.name === 'AbortError') return;
      cancelAnimationFrame(frame); frame = 0; paint(item, 'error');
      status.textContent = `The ${item.title} preview couldn't play. Try again or use a streaming link.`;
    });
  }
  function bind(button, release, index = 0) {
    const title = release.tracks[index], url = release.previews?.[index];
    const panel = document.createElement('span'); panel.className = 'song-preview-panel';
    panel.id = `song-preview-${++serial}`; panel.hidden = true;
    if (!url) return panel;
    button.classList.add('song-preview-button'); button.type = 'button';
    button.dataset.previewTrack = `${release.page}:${index}`;
    button.setAttribute('aria-controls', panel.id); button.insertAdjacentHTML('beforeend', icon);
    const bar = document.createElement('span'); bar.className = 'song-preview-progress';
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', `${title} preview progress`);
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '30'); bar.setAttribute('aria-valuenow', '0');
    const time = document.createElement('span'); time.className = 'song-preview-time'; time.setAttribute('aria-hidden', 'true');
    const message = document.createElement('span'); message.className = 'song-preview-message';
    panel.append(bar, time, message);
    const item = {button, panel, progress:bar, time, message, url, title, state:'idle'};
    paint(item, 'idle'); button.addEventListener('click', () => toggle(item));
    return panel;
  }
  function createTracklist(release, className = 'tracklist') {
    const list = document.createElement('ol'); list.className = className;
    list.setAttribute('aria-label', 'Songs — select a title to preview');
    release.tracks.forEach((title, index) => {
      const row = document.createElement('li'), content = document.createElement('div');
      content.className = 'song-preview-track';
      if (release.previews?.[index]) {
        const button = document.createElement('button'), name = document.createElement('span');
        name.className = 'song-preview-name'; name.textContent = title; button.append(name);
        const panel = bind(button, release, index); content.append(button, panel);
      } else content.textContent = title;
      row.append(content); list.append(row);
    });
    return list;
  }
  function bindTitle(title, release) {
    const button = document.createElement('button'); button.className = 'single-preview-title';
    button.append(...title.childNodes); title.append(button);
    return bind(button, release);
  }
  audio.addEventListener('playing', () => {
    if (!active) { audio.pause(); return; }
    quietOtherMedia(); paint(active, 'playing');
    status.textContent = `Playing ${active.title} preview`;
    cancelAnimationFrame(frame); tick();
  });
  audio.addEventListener('waiting', () => { if (active && !audio.paused) paint(active, 'loading'); });
  audio.addEventListener('pause', () => {
    cancelAnimationFrame(frame); frame = 0;
    if (active && audio.paused && active.state !== 'error') paint(active, 'paused');
  });
  audio.addEventListener('loadedmetadata', progress);
  audio.addEventListener('timeupdate', progress);
  audio.addEventListener('ended', stop);
  audio.addEventListener('error', () => {
    if (!active || !audio.error) return;
    cancelAnimationFrame(frame); frame = 0; paint(active, 'error');
    status.textContent = `The ${active.title} preview is unavailable. Try again or use a streaming link.`;
  });
  function otherSound(event) {
    const media = event.target;
    if (media !== audio && media instanceof HTMLMediaElement && !media.paused && !media.muted && media.volume > 0) stop();
  }
  document.addEventListener('play', otherSound, true);
  document.addEventListener('volumechange', otherSound, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.pause(); });
  window.addEventListener('pagehide', stop);
  window.SuperstarPreviews = {createTracklist, bindTitle, stop, stopWithin:root => { if (active && root.contains(active.button)) stop(); }};
})();
