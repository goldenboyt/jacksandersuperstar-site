document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("release-link");
  if (!container) {
    return;
  }

  const slug = new URLSearchParams(window.location.search).get("slug");
  const release = slug ? getReleaseBySlug(slug) : null;

  if (!release) {
    container.innerHTML = `<p class="release-link-not-found">not found</p>`;
    document.title = "not found — jack sander";
    return;
  }

  document.title = `${release.title} — jack sander`;
  container.innerHTML = renderReleaseLinkPage(release);
});
