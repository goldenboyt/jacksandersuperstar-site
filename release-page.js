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

function initReleaseLinkShare(release) {
  const button = document.getElementById("release-link-share");
  if (!button) {
    return;
  }

  const shareUrl = `${window.location.origin}/${getReleaseSlug(release)}`;
  const shareTitle = `${release.title} — jack sander`;

  button.addEventListener("click", async () => {
    const originalLabel = button.textContent;

    try {
      if (navigator.share) {
        await navigator.share({
          title: shareTitle,
          url: shareUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      button.textContent = "copied";
      window.setTimeout(() => {
        button.textContent = originalLabel;
      }, 2000);
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }

      button.textContent = "copy failed";
      window.setTimeout(() => {
        button.textContent = originalLabel;
      }, 2000);
    }
  });
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
  initReleaseLinkShare(release);
});
