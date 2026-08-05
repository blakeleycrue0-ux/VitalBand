export function initNav() {
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const menuToggle = document.querySelector('[data-menu-open]');
  const menuPanel = document.getElementById('mobile-menu');
  const menuClose = document.querySelector('[data-menu-close]');

  const openMenu = () => {
    menuPanel?.classList.add('is-open');
    menuPanel?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const closeMenu = () => {
    menuPanel?.classList.remove('is-open');
    menuPanel?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  menuToggle?.addEventListener('click', openMenu);
  menuClose?.addEventListener('click', closeMenu);
  menuPanel?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));
}
