(() => {
  const root = document.documentElement;
  const key = 'superstar:theme';
  const valid = value => value === 'light' || value === 'dark';

  function savedTheme() {
    try {
      const value = localStorage.getItem(key);
      return valid(value) ? value : 'light';
    } catch {
      return root.dataset.theme === 'dark' ? 'dark' : 'light';
    }
  }

  function apply(theme) {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme));
    });
    const chrome = document.querySelector('meta[name="theme-color"]');
    if (chrome) chrome.content = theme === 'dark' ? '#111111' : '#ffffff';
  }

  // Runs in the head, before the page's styles and first paint.
  apply(savedTheme());

  function mount() {
    document.querySelectorAll('.menu-footer,.menu-list').forEach(menu => {
      if (menu.querySelector('.theme-picker')) return;
      const group = document.createElement('div');
      group.className = 'theme-picker';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Color theme');
      const label = document.createElement('span');
      label.className = 'theme-picker-label';
      label.textContent = 'appearance';
      label.setAttribute('aria-hidden', 'true');
      group.append(label);
      for (const theme of ['light', 'dark']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.themeChoice = theme;
        button.textContent = theme;
        button.setAttribute('aria-label', `${theme[0].toUpperCase() + theme.slice(1)} mode`);
        group.append(button);
      }
      if (menu.matches('ul,ol')) {
        const item = document.createElement('li');
        item.className = 'theme-menu-item';
        item.append(group);
        menu.append(item);
      } else menu.append(group);
    });
    apply(savedTheme());
  }

  document.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('[data-theme-choice]') : null;
    const theme = button?.dataset.themeChoice;
    if (!valid(theme)) return;
    apply(theme);
    try { localStorage.setItem(key, theme); } catch {}
  });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) apply(savedTheme());
  });
  window.addEventListener('pageshow', () => apply(savedTheme()));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
