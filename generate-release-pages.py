from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parent
catalog = json.loads((ROOT / 'release-data.js').read_text().split(' = ', 1)[1].rstrip().removesuffix(';'))
releases, platforms = catalog['releases'], catalog['platforms']
ORIGIN = 'https://jacksandersuperstar.com'


def esc(value):
    return html.escape(str(value), quote=True)


def title_markup(release):
    artwork = {'album':'brand-logo.png', 'cybertruck':'cybertruck-title.png', 'brainstorm':'brainstorm-title.png'}
    if release['image'] in artwork:
        return f'<img class="release-title-art" src="assets/{artwork[release["image"]]}" alt="{esc(release["title"])}">'
    return esc(release['title'])


def title_class(release):
    return {'prodigy':'title-papyrus', 'designer':'title-papyrus title-designer', 'cats':'title-cooper'}.get(release['image'], '')


def streaming_markup(release):
    available = [p for p in platforms if release.get(p['key'])]
    primary = [p for p in available if p['key'] in ('apple', 'spotify')] or available[:1]
    extra = [p for p in available if p not in primary]
    def link(p):
        color = 'red' if p['key'] == 'apple' else 'black'
        return f'<a class="button button-{color}" href="{esc(release[p["key"]])}" target="_blank" rel="noopener noreferrer">{esc(p["label"])}</a>'
    markup = ''.join(link(p) for p in primary)
    if extra:
        markup += '<button class="button streaming-more" type="button" aria-label="More streaming services" aria-expanded="false" aria-controls="release-page-streaming-extra">+</button><div class="streaming-extra" id="release-page-streaming-extra" hidden>'
        markup += ''.join(link(p) for p in extra) + '</div>'
    return markup


def card(release):
    return f'''<a class="release-card release-page-card" href="/{release['page']}" aria-label="View {esc(release['title'])}"><div><img src="assets/{release['image']}.webp" alt="{esc(release['title'])} cover" width="512" height="512" loading="lazy"><span class="card-plus" aria-hidden="true">+</span></div><h3 class="{title_class(release)}">{title_markup(release)}</h3><p>{release['type']} / {release['year']}</p></a>'''


def document(release=None):
    slug = release['page'] if release else 'release'
    title = release['title'] if release else 'the catalog'
    description = f'{title}. Music, streaming links, and the catalog.'
    image = f"{ORIGIN}/assets/{release['image']}.webp" if release else f'{ORIGIN}/assets/album.webp'
    page_title = f'{title} — #jacksandersuperstar®' if release and release['image'] != 'album' else '#jacksandersuperstar®'
    robots = '' if release else '<meta name="robots" content="noindex">'
    if release:
        track_count = len(release['tracks'])
        tracks = ''
        if track_count > 1:
            rows = ''.join(f'<li>{esc(track)}</li>' for track in release['tracks'])
            tracks = f'<details class="release-track-details"><summary>tracklist / {track_count} tracks</summary><ol class="release-page-tracklist">{rows}</ol></details>'
        notes = '<div class="release-page-notes"><a href="https://www.youtube.com/watch?v=a4_ZlWzaq2s" target="_blank" rel="noopener noreferrer">watch magic (tragic) ↗</a><a href="/#live">live in dallas ↗</a></div>' if release['image'] == 'album' else ''
        content = f'''<a class="release-back" href="/#music">← back to music</a>
<article class="release-page-layout" aria-labelledby="release-title">
<div class="release-page-art"><img class="release-page-cover" src="assets/{release['image']}.webp" alt="{esc(release['title'])} cover" width="1024" height="1024" fetchpriority="high"></div>
<div class="release-page-info"><p class="eyebrow red">{'out now' if release['image'] == 'album' else 'from the catalog'}</p><h1 id="release-title" class="dialog-release-title release-page-title {title_class(release)}">{title_markup(release)}</h1><p class="release-page-meta">{release['type']} / {esc(release['date'])} / {track_count} {'track' if track_count == 1 else 'tracks'}</p><nav class="release-page-streams" id="release-page-streams" aria-label="Listen to {esc(release['title'])}">{streaming_markup(release)}</nav><div id="release-page-sharing"></div>{tracks}{notes}</div>
</article>
<section class="release-more" aria-labelledby="more-music-title"><div class="release-more-heading"><h2 id="more-music-title">more music</h2><a href="/#music">the full catalog ↗</a></div><div class="release-page-catalog">{''.join(card(item) for item in releases if item['page'] != release['page'])}</div></section>'''
    else:
        content = f'<div class="release-index"><p class="eyebrow red">2020 — 2026</p><h1 class="release-index-title">the catalog</h1><div class="release-page-catalog">{"".join(card(item) for item in releases)}</div></div>'
    markup = f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#131313"><meta name="description" content="{esc(description)}">{robots}
<title>{esc(page_title)}</title><link rel="canonical" href="{ORIGIN}/{slug}">
<meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{ORIGIN}/{slug}"><meta property="og:image" content="{image}"><meta property="og:image:alt" content="{esc(title)} cover"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="favicon.svg" type="image/svg+xml"><link rel="preload" href="assets/{release['image'] if release else 'album'}.webp" as="image" fetchpriority="high">
<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="motion.css"><link rel="stylesheet" href="refinements.css"><link rel="stylesheet" href="release-branding.css"><link rel="stylesheet" href="site-motion.css"><link rel="stylesheet" href="reference-motion.css?v=24"><link rel="stylesheet" href="release-pages.css?v=1">
</head><body class="release-page intro-complete" data-release="{release['page'] if release else 'catalog'}">
<a class="skip" href="#release-content">Skip to release</a>
<header class="header scrolled" id="header"><a class="wordmark" href="/" aria-label="Home"><img src="assets/brand-logo.png" alt="#jacksandersuperstar®" width="3284" height="308"></a><nav class="desktop-nav" aria-label="Main navigation"><a href="/#music">music</a><a href="/#live">live</a><a href="/merch">merch</a><a href="/#soboda">soboda</a></nav><button class="menu-toggle" id="menu-open" aria-haspopup="dialog" aria-controls="menu" aria-expanded="false"><span class="menu-lines" aria-hidden="true"></span><span>menu</span></button></header>
<main class="release-page-main" id="release-content">{content}</main>
<footer><div class="footer-top"><a class="wordmark" href="/"><img src="assets/brand-logo.png" alt="#jacksandersuperstar®" width="3284" height="308"></a><a href="https://instagram.com/jack_sanderr" target="_blank" rel="noopener noreferrer">instagram</a><a href="/#music">back to music</a></div><div class="footer-bottom"><span>© 2026</span></div></footer>
<dialog class="menu-dialog" id="menu" aria-labelledby="menu-title"><div class="menu-head"><span id="menu-title" class="wordmark"><img src="assets/brand-logo.png" alt="#jacksandersuperstar®" width="3284" height="308"></span><button class="close-button" data-close="menu" aria-label="Close menu">close <span aria-hidden="true">×</span></button></div><nav aria-label="Expanded navigation"><a href="/#music"><span>01</span>music</a><a href="/#live"><span>02</span>live in dallas</a><a href="/merch"><span>03</span>merch</a><a href="/#soboda"><span>04</span>soboda</a></nav><div class="menu-footer"><a href="https://instagram.com/jack_sanderr" target="_blank" rel="noopener noreferrer">instagram</a></div></dialog>
<script src="assets/lenis.min.js" defer></script><script src="release-data.js?v=1" defer></script><script src="release-ui.js?v=1" defer></script><script src="release-page.js?v=2" defer></script><script src="site-motion.js?v=21" defer></script>
<script>window.va = window.va || function () {{ (window.vaq = window.vaq || []).push(arguments); }};</script><script defer src="/_vercel/insights/script.js"></script>
</body></html>
'''
    arrow = '<svg class="release-link-arrow" viewBox="0 0 24 24" aria-hidden="true" width="14" height="14"><path d="M6 18 18 6M6 6h12v12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>'
    return markup.replace(' ↗', ' ' + arrow)


for release in releases:
    (ROOT / f"{release['page']}.html").write_text(document(release))
(ROOT / 'release.html').write_text(document())
print(f'Generated {len(releases)} shareable release pages and the catalog.')
