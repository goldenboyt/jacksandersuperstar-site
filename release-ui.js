(() => {
  const platforms = window.SuperstarCatalog.platforms;

  function releaseUrl(release) {
    return new URL(`/${release.page}`, location.origin).href;
  }

  function brandTitle(element, release) {
    const artwork = {album:'brand-logo.png', cybertruck:'cybertruck-title.png', brainstorm:'brainstorm-title.png'};
    if (artwork[release.image]) {
      const image = document.createElement('img');
      image.src = `assets/${artwork[release.image]}`; image.alt = release.title;
      image.className = 'release-title-art'; element.replaceChildren(image);
    } else {
      element.textContent = release.title;
      if (release.image === 'prodigy' || release.image === 'designer') element.classList.add('title-papyrus');
      if (release.image === 'designer') element.classList.add('title-designer');
      if (release.image === 'cats') element.classList.add('title-cooper');
    }
  }

  function streamingLinks(release, prefix) {
    const available = platforms.filter(platform => release[platform.key]);
    let primary = available.filter(platform => ['apple', 'spotify'].includes(platform.key));
    if (!primary.length) primary = available.slice(0, 1);
    const extra = available.filter(platform => !primary.includes(platform));
    const fragment = document.createDocumentFragment();
    function link(platform) {
      const anchor = document.createElement('a');
      anchor.href = release[platform.key]; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      anchor.className = `button ${platform.key === 'apple' ? 'button-red' : 'button-black'}`;
      anchor.textContent = platform.label; return anchor;
    }
    primary.forEach(platform => fragment.append(link(platform)));
    if (extra.length) {
      const toggle = document.createElement('button');
      toggle.className = 'button streaming-more'; toggle.type = 'button'; toggle.textContent = '+';
      toggle.setAttribute('aria-label', 'More streaming services'); toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', `${prefix}-streaming-extra`);
      const panel = document.createElement('div');
      panel.id = `${prefix}-streaming-extra`; panel.className = 'streaming-extra'; panel.hidden = true;
      extra.forEach(platform => panel.append(link(platform)));
      fragment.append(toggle, panel);
    }
    return fragment;
  }

  function releaseSharing(release, {pageLink = true, nativeShare = false} = {}) {
    const area = document.createElement('div'); area.className = 'release-share';
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'button release-share-button'; button.textContent = 'copy link';
    button.setAttribute('aria-label', `Copy link to ${release.title}`);
    const status = document.createElement('span'); status.className = 'release-share-status';
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const fallback = document.createElement('input'); fallback.type = 'url'; fallback.readOnly = true;
    fallback.className = 'release-share-url'; fallback.hidden = true; fallback.value = releaseUrl(release);
    fallback.setAttribute('aria-label', `Link to ${release.title}`);
    button.addEventListener('click', async () => {
      button.disabled = true; status.textContent = '';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(fallback.value); fallback.hidden = true; status.textContent = 'link copied';
      } catch {
        fallback.hidden = false; fallback.focus(); fallback.select(); status.textContent = 'Select and copy this link.';
      } finally { button.disabled = false; }
    });
    area.append(button);
    if (nativeShare && navigator.share) {
      const share = document.createElement('button'); share.type = 'button';
      share.className = 'button release-share-button'; share.textContent = 'share';
      share.addEventListener('click', async () => {
        try { await navigator.share({title:release.title, url:releaseUrl(release)}); }
        catch (error) { if (error.name !== 'AbortError') button.click(); }
      });
      area.append(share);
    }
    if (pageLink) {
      const anchor = document.createElement('a'); anchor.className = 'release-page-link';
      anchor.href = releaseUrl(release); anchor.textContent = 'release page';
      anchor.insertAdjacentHTML('beforeend', '<svg class="release-link-arrow" viewBox="0 0 24 24" aria-hidden="true" width="14" height="14"><path d="M6 18 18 6M6 6h12v12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>');
      area.append(anchor);
    }
    area.append(status, fallback); return area;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.streaming-more'); if (!button) return;
    const panel = document.getElementById(button.getAttribute('aria-controls')); if (!panel) return;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    button.setAttribute('aria-label', expanded ? 'More streaming services' : 'Hide extra streaming services');
    button.textContent = expanded ? '+' : '−'; panel.hidden = expanded;
  });

  window.SuperstarReleaseUI = {releaseUrl, brandTitle, streamingLinks, releaseSharing};
})();
