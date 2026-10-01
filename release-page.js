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
  document.getElementById('release-page-streams').replaceChildren(window.SuperstarReleaseUI.streamingLinks(release, 'release-page'));
  document.getElementById('release-page-sharing').append(window.SuperstarReleaseUI.releaseSharing(release, {pageLink:false, nativeShare:true}));
})();
