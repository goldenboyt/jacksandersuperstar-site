(() => {
  // Isolated from the public catalog until the deluxe announcement is ready.
  const deluxe = {title:'#jacksandersuperstar (worldwide)', page:'deluxe'};
  const sharing = document.getElementById('release-page-sharing');
  sharing.append(window.SuperstarReleaseUI.releaseSharing(deluxe, {pageLink:false, nativeShare:true}));
  const original = window.SuperstarCatalog.releases.find(item => item.page === 'jacksandersuperstar');
  const details = document.getElementById('deluxe-tracks');
  if (!original || !window.SuperstarPreviews) return;
  const list = window.SuperstarPreviews.createTracklist(original, 'release-page-tracklist');
  list.setAttribute('aria-label', 'Original album tracks — select a title to preview');
  details.querySelector('.release-page-tracklist').replaceWith(list);
  details.addEventListener('toggle', () => { if (!details.open) window.SuperstarPreviews.stopWithin(details); });
})();
