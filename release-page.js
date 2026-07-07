function getReleaseSlugFromUrl() {
  const querySlug = new URLSearchParams(window.location.search).get("slug");
  if (querySlug) {
    return querySlug;
  }

  const segment = window.location.pathname.split("/").filter(Boolean).pop() || "";
  if (!segment || segment === "release") {
    return null;
  }

  return segment.replace(/\.html$/, "");
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("release-link");
  if (!container) {
    return;
  }

  const slug = getReleaseSlugFromUrl();
  const release = slug ? getReleaseBySlug(slug) : null;

  if (!release) {
    container.innerHTML = `<p class="release-link-not-found">not found</p>`;
    document.title = "not found — jack sander";
    return;
  }

  document.title = `${release.title} — jack sander`;
  container.innerHTML = renderReleaseLinkPage(release);
});
