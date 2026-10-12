(() => {
  const releases = window.SuperstarCatalog.releases;
  const current = document.body.dataset.release;
  if (current === 'catalog') {
    const slug = new URL(location.href).searchParams.get('slug');
    const release = releases.find(item => item.aliases.includes(slug));
    if (release) location.replace(window.SuperstarReleaseUI.releaseUrl(release));
    return;
  }
  const release = releases.find(item => item.page === current);
  if (!release) return;
  if (release.type === 'single') {
    const title = document.getElementById('release-title');
    title.after(window.SuperstarPreviews.bindTitle(title, release));
  } else {
    const tracks = document.querySelector('.release-page-tracklist');
    tracks?.replaceWith(window.SuperstarPreviews.createTracklist(release, 'release-page-tracklist'));
    document.querySelector('.release-track-details')?.addEventListener('toggle', event => {
      if (!event.target.open) window.SuperstarPreviews.stopWithin(event.target);
    });
  }
  document.getElementById('release-page-streams').replaceChildren(window.SuperstarReleaseUI.streamingLinks(release, 'release-page'));
  document.getElementById('release-page-sharing').append(window.SuperstarReleaseUI.releaseSharing(release, {pageLink:false, nativeShare:true}));
})();
