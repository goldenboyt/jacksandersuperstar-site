const jacksanderSuperstarTracks = [
  "magic (tragic)",
  "idgaf",
  "supervillan",
  "step on them (ft. o1sea)",
  "newports",
  "kill you",
  "shakesphere",
  "around the town",
  "coco's interlude (ft. coconut titty)",
  "spend it",
  "no wings (ft. lazer dim 700)",
  "sexy party",
  "fuk me",
  "breathe (ft. sk8star)",
  "#jacksandersuperstar",
];

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
    year: "2026",
    cover: "covers/jacksander-superstar.png",
    mvShoot: "mv-shoot.html",
    liveInDallas: "live-in-dallas.html",
    tracks: jacksanderSuperstarTracks,
  },
  {
    id: "prodigy-genius",
    title: "prodigy genius",
    papyrusTitle: "prodigy-genius",
    type: "album",
    date: "april 18, 2025",
    cover: "covers/prodigy-genius.jpg",
    apple: "https://music.apple.com/us/album/prodigy-genius/1807497988",
    spotify: "https://open.spotify.com/album/34xsZoIvBvUADQh4esp5WI",
    youtube: "https://www.youtube.com/playlist?list=PL0bEx_EOu-iBSMiRRqbVZ__gmXUxIKsR1",
    tracks: prodigyGeniusTracks,
  },
  {
    id: "cybertruck",
    title: "cybertruck",
    type: "single",
    date: "september 6, 2024",
    cover: "covers/cybertruck.jpg",
    titleLogo: "covers/Cybertrucklogo.svg.png",
    titleLogoClass: "release-title-logo--cybertruck",
    apple: "https://music.apple.com/us/album/cybertruck-single/1763991815",
    spotify: "https://open.spotify.com/album/7G8xrs0hsvWJkF6lqQLqCE",
    youtube: "https://www.youtube.com/watch?v=DV6aY2-8vew",
  },
  {
    id: "designer",
    title: "designer",
    papyrusTitle: "designer",
    type: "single",
    date: "may 3, 2024",
    cover: "covers/designer.jpg",
    apple: "https://music.apple.com/us/album/designer-single/1741535831",
    spotify: "https://open.spotify.com/album/7jD7ughrCDuo3lSd7wB5Si",
    youtube: "https://www.youtube.com/watch?v=hsM1qfrtq28",
  },
  {
    id: "brainstorm",
    title: "brainstorm",
    titleLogo: "covers/brainstormtxt.png",
    titleLogoClass: "release-title-logo--brainstorm",
    type: "single",
    date: "january 21, 2022",
    cover: "covers/brainstorm.jpg",
    apple: "https://music.apple.com/us/album/brainstorm-single/1605574307",
    spotify: "https://open.spotify.com/search/Brainstorm%20Jack%20Sander/albums",
    youtube: "https://www.youtube.com/watch?v=F0gEt3vQ9LI",
  },
  {
    id: "cats-cash",
    title: "cats cash",
    titleFont: "cooper-black",
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

function renderPapyrusTitle(variant) {
  if (variant === "designer") {
    return `
      <span class="release-title-papyrus release-title-papyrus--designer" aria-label="designer">
        designer
      </span>
    `;
  }

  return `
    <span class="release-title-papyrus release-title-papyrus--prodigy" aria-label="prodigy genius">
      prodigy genius
    </span>
  `;
}

function renderReleaseTitle(release) {
  if (release.titleLogo) {
    return renderTitleLogo(
      release.titleLogo,
      `${release.title} logo`,
      release.titleLogoClass
    );
  }

  if (release.papyrusTitle) {
    return renderPapyrusTitle(release.papyrusTitle);
  }

  if (release.titleFont === "cooper-black") {
    return `
      <span class="release-title-custom release-title-cooper" aria-label="${release.title}">
        ${release.title}
      </span>
    `;
  }

  if (release.titleFont === "futura-black") {
    return `
      <span class="release-title-custom release-title-futura" aria-label="${release.title}">
        ${release.title}
      </span>
    `;
  }

  return `<span class="release-title">${release.title}</span>`;
}

function renderTitleLogo(src, alt, extraClass = "") {
  const className = extraClass
    ? `release-title-logo ${extraClass}`
    : "release-title-logo";

  return `
    <img
      class="${className}"
      src="${src}"
      alt="${alt}"
      width="640"
      height="80"
      loading="lazy"
    />
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

function getStreamingPlatformLinks(release) {
  return [
    release.apple && { label: "apple music", href: release.apple, external: true },
    release.spotify && { label: "spotify", href: release.spotify, external: true },
    release.youtube && { label: "youtube", href: release.youtube, external: true },
    release.soundcloud && {
      label: "soundcloud",
      href: release.soundcloud,
      external: true,
    },
  ].filter(Boolean);
}

function renderLinkItems(links) {
  return links
    .map(({ label, href, external }) => {
      const externalAttrs = external
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";

      return `<a class="stream-link" href="${href}"${externalAttrs}>${label}</a>`;
    })
    .join("");
}

function renderStreamingLinks(release) {
  return renderLinkItems(getStreamingPlatformLinks(release));
}

function getReleaseLinkPageLinks(release) {
  return [
    ...getStreamingPlatformLinks(release),
    release.mvShoot && {
      label: "magic (tragic) music video",
      href: release.mvShoot,
      external: false,
    },
    release.liveInDallas && {
      label: "live in dallas",
      href: release.liveInDallas,
      external: false,
    },
  ].filter(Boolean);
}

function getReleaseSlug(release) {
  return release.id.replace(/-/g, "");
}

function getReleaseBySlug(slug) {
  return releases.find((release) => getReleaseSlug(release) === slug);
}

function getReleaseLinkDate(release) {
  return releaseYear(release);
}

function renderReleaseLinkTitle(release) {
  if (release.featured) {
    return `
      <img
        src="logo.png"
        alt="#jacksandersuperstar®"
        class="release-logo"
        width="3284"
        height="308"
      />
    `;
  }

  return renderReleaseTitle(release);
}

function renderReleaseLinkLinks(release) {
  return renderLinkItems(getReleaseLinkPageLinks(release));
}

function renderReleaseLinkPage(release) {
  return `
    <article class="release-link-card">
      <img
        class="release-link-cover"
        src="${release.cover}"
        alt="${release.title} cover"
        width="512"
        height="512"
      />
      <div class="release-link-info">
        ${renderReleaseLinkTitle(release)}
        <p class="release-link-meta">jack sander • ${getReleaseLinkDate(release)}</p>
        <nav class="release-link-streams" aria-label="streaming links">
          ${renderReleaseLinkLinks(release)}
        </nav>
        <button type="button" class="stream-link stream-link--button release-link-share" id="release-link-share">
          share
        </button>
      </div>
    </article>
  `;
}

function renderFeaturedRelease(release, index) {
  const tracklistBlock = release.tracks ? renderTracklist(release.tracks) : "";

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
      <div class="release-links release-links--with-tracklist">
        <a class="stream-link" href="${release.mvShoot}">magic (tragic) music video</a>
        <a class="stream-link" href="${release.liveInDallas}">live in dallas</a>
        ${tracklistBlock}
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
          ${renderReleaseTitle(release)}
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
}

document.addEventListener("DOMContentLoaded", renderReleases);
