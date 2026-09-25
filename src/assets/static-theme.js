// The navigation is expanded by default so every link works without JavaScript.
const menu = document.querySelector('.header-menu');
const button = document.querySelector('.menu-btn');
if (menu && button) {
  const mobile = window.matchMedia('(max-width: 999px)');
  function setOpen(open) {
    menu.classList.toggle('static-open', open);
    button.classList.toggle('opened', open);
    button.setAttribute('aria-expanded', String(open));
    menu.inert = mobile.matches && !open;
  }
  function resetMenu() {
    if (menu.contains(document.activeElement) && mobile.matches) button.focus();
    setOpen(false);
  }
  button.hidden = false;
  document.documentElement.classList.add('archive-js');
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobile.matches && button.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      button.focus();
    }
  });
  mobile.addEventListener('change', resetMenu);
  resetMenu();
}
