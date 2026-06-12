const prodigyGeniusTracks = [
  "cybertruck",
  "omg",
  "cuntry",
  "swag",
  "designer",
  "luca's interlude",
  "soboda",
  "g33k3d",
  "leprechaun",
  "bb",
  "greasefire",
];

const releases = [
  {
    id: "jacksander-superstar",
    featured: true,
    title: "jacksander superstar",
    subtitle: "out july 15",
    coverHidden: true,
    mvShoot: "mv-shoot.html",
    liveInDallas: "live-in-dallas.html",
    tracks: [],
  },
  {
    id: "prodigy-genius",
    title: "prodigy genius",
    type: "album",
    date: "april 18, 2025",
    cover: "covers/prodigy-genius.jpg",
    apple: "https://music.apple.com/us/album/prodigy-genius/1807497988",
    spotify: "https://open.spotify.com/search/Prodigy%20Genius%20Jack%20Sander/albums",
    youtube: "https://www.youtube.com/playlist?list=PL0bEx_EOu-iBSMiRRqbVZ__gmXUxIKsR1",
    tracks: prodigyGeniusTracks,
  },
  {
    id: "cybertruck",
    title: "cybertruck",
    type: "single",
    date: "september 6, 2024",
    cover: "covers/cybertruck.jpg",
    apple: "https://music.apple.com/us/album/cybertruck-single/1763991815",
    spotify: "https://open.spotify.com/search/Cybertruck%20Jack%20Sander/albums",
    youtube: "https://www.youtube.com/watch?v=DV6aY2-8vew",
  },
  {
    id: "designer",
    title: "designer",
    type: "single",
    date: "may 3, 2024",
    cover: "covers/designer.jpg",
    apple: "https://music.apple.com/us/album/designer-single/1741535831",
    spotify: "https://open.spotify.com/search/Designer%20Jack%20Sander/albums",
    youtube: "https://www.youtube.com/watch?v=hsM1qfrtq28",
  },
  {
    id: "brainstorm",
    title: "brainstorm",
    type: "single",
    date: "january 21, 2022",
    cover: "covers/brainstorm.jpg",
    apple: "https://music.apple.com/us/album/brainstorm-single/1605574307",
    spotify: "https://open.spotify.com/search/Brainstorm%20Jack%20Sander/albums",
    youtube: "https://www.youtube.com/watch?v=F0gEt3vQ9LI",
  },
  {
    id: "cats-cash",
    title: "cat's cash",
    type: "single",
    date: "may 13, 2020",
    cover: "covers/cats-cash.jpg",
    soundcloud: "https://soundcloud.com/user-826121617/cats-cash-full",
  },
];

function releaseYear(release) {
  if (release.year) {
    return release.year;
  }

  const match = release.date?.match(/\d{4}/);
  return match ? match[0] : "";
}

function renderReleaseMeta(release) {
  const year = releaseYear(release);

  if (release.featured) {
    return release.subtitle;
  }

  return year ? `${release.type} · ${year}` : release.type;
}

function renderTracklist(tracks) {
  if (!tracks.length) {
    return `<p class="release-tracklist-empty">coming soon</p>`;
  }

  return `
    <ol class="release-tracklist">
      ${tracks.map((track) => `<li>${track}</li>`).join("")}
    </ol>
  `;
}

function renderTracklistButton(tracks) {
  return `
    <details class="release-subpanel">
      <summary class="stream-link stream-link--button">tracklist</summary>
      ${renderTracklist(tracks)}
    </details>
  `;
}

function renderCover(release) {
  if (release.coverHidden) {
    return `
      <span class="release-cover release-cover--mystery" aria-label="${release.title} cover — coming soon">
        <span class="release-cover-mystery-text">cover coming soon</span>
      </span>
    `;
  }

  return `
    <img
      class="release-cover"
      src="${release.cover}"
      alt="${release.title} cover"
      width="512"
      height="512"
      loading="lazy"
    />
  `;
}

function renderStreamingLinks(release) {
  const links = [
    release.apple && { label: "apple music", href: release.apple },
    release.spotify && { label: "spotify", href: release.spotify },
    release.youtube && { label: "youtube", href: release.youtube },
    release.soundcloud && { label: "soundcloud", href: release.soundcloud },
  ].filter(Boolean);

  return links
    .map(
      ({ label, href }) =>
        `<a class="stream-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`
    )
    .join("");
}

function renderFeaturedRelease(release, index) {
  return `
    <details class="release release--featured">
      <summary class="release-trigger">
        ${renderCover(release)}
        <span class="release-info">
          <img
            src="logo.png"
            alt="#jacksandersuperstar®"
            class="release-logo"
            width="3284"
            height="308"
          />
          <span class="release-meta">${renderReleaseMeta(release)}</span>
        </span>
      </summary>
      <div class="release-panel">
        ${renderTracklistButton(release.tracks)}
        <a class="stream-link" href="${release.mvShoot}">magic (tragic) music video</a>
        <a class="stream-link" href="${release.liveInDallas}">live in dallas</a>
      </div>
    </details>
  `;
}

function renderStreamingRelease(release, index) {
  const tracklistBlock = release.tracks ? renderTracklist(release.tracks) : "";

  return `
    <details class="release">
      <summary class="release-trigger">
        ${renderCover(release)}
        <span class="release-info">
          <span class="release-title">${release.title}</span>
          <span class="release-meta">${renderReleaseMeta(release)}</span>
        </span>
      </summary>
      <div class="release-links${release.tracks ? " release-links--with-tracklist" : ""}">
        ${renderStreamingLinks(release)}
        ${tracklistBlock}
      </div>
    </details>
  `;
}

function renderReleases() {
  const list = document.getElementById("releases-list");
  if (!list) {
    return;
  }

  list.innerHTML = releases
    .map((release, index) =>
      release.featured
        ? renderFeaturedRelease(release, index)
        : renderStreamingRelease(release, index)
    )
    .join("");

  list.querySelectorAll(".release").forEach((item) => {
    item.addEventListener("toggle", () => {
      if (!item.open) {
        return;
      }

      list.querySelectorAll(".release").forEach((other) => {
        if (other !== item) {
          other.removeAttribute("open");
        }
      });

      const panel = item.querySelector(".release-links, .release-panel");
      if (!panel) {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      window.setTimeout(() => {
        panel.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "nearest",
        });
      }, 350);
    });
  });

  list.querySelectorAll(".release-subpanel").forEach((subpanel) => {
    subpanel.addEventListener("toggle", (event) => {
      event.stopPropagation();
    });
  });
}

document.addEventListener("DOMContentLoaded", renderReleases);
