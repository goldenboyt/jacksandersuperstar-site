(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.getElementById('archive-dialog');
  const records = [...document.querySelectorAll('[data-archive-image]')];
  let current = 0, opener = null;
  function show(index) {
    current = (index + records.length) % records.length;
    const record = records[current];
    const image = document.getElementById('archive-dialog-image');
    image.src = record.dataset.archiveImage;
    image.alt = record.querySelector('img').alt;
    document.getElementById('archive-dialog-title').textContent = record.dataset.archiveTitle;
    document.getElementById('archive-dialog-caption').textContent = record.dataset.archiveCaption;
    document.getElementById('archive-position').textContent = `${current + 1} / ${records.length}`;
    dialog.scrollTop = 0;
  }
  records.forEach((record, index) => record.addEventListener('click', () => {
    opener = record; show(index); dialog.showModal();
  }));
  document.getElementById('archive-prev').addEventListener('click', () => show(current - 1));
  document.getElementById('archive-next').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); show(current + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => opener?.focus({ preventScroll: true }));

  if (!reduced.matches && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); reveal.unobserve(entry.target); }
    }), { threshold: .06 });
    document.querySelectorAll('.discovery-reveal').forEach(element => { element.classList.add('reveal-ready'); reveal.observe(element); });
  }
  const links = [...document.querySelectorAll('.discovery-nav a')];
  const sections = links.map(link => document.querySelector(link.hash));
  let tick = false;
  function update() {
    tick = false;
    let active = sections[0];
    sections.forEach(section => { if (section.getBoundingClientRect().top < innerHeight * .35) active = section; });
    links.forEach(link => { if (link.hash === '#' + active.id) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }
  window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update); update();
})();
