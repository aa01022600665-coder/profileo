(() => {
  'use strict';
  const gallery = document.querySelector('.product-gallery');
  if (!gallery) return;
  const slides = [...gallery.querySelectorAll('.gallery-slide')];
  const dots = [...gallery.querySelectorAll('.gallery-dots button')];
  const play = gallery.querySelector('.gallery-play');
  const dialog = gallery.querySelector('.gallery-dialog');
  const expand = gallery.querySelector('.gallery-expand');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0;
  let automatic = !reducedMotion.matches;
  let hovered = false;
  let focused = false;
  let visible = true;
  let timer;

  function schedule() {
    clearTimeout(timer);
    if (automatic && !hovered && !focused && visible && !document.hidden && !dialog.open) {
      timer = setTimeout(() => show(index + 1), 6000);
    }
  }
  function show(next) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
      slide.setAttribute('aria-hidden', String(i !== index));
      if (i === index) dots[i].setAttribute('aria-current', 'true');
      else dots[i].removeAttribute('aria-current');
    });
    gallery.querySelector('.gallery-caption h2').textContent = slides[index].dataset.title;
    gallery.querySelector('.gallery-caption p').textContent = slides[index].dataset.description;
    gallery.querySelector('.gallery-index').textContent = `${String(index + 1).padStart(2, '0')} / 04`;
    schedule();
  }
  function updatePlayback() {
    play.setAttribute('aria-label', automatic ? 'Pause automatic slideshow' : 'Play automatic slideshow');
    play.querySelector('span').textContent = automatic ? 'Ⅱ' : '▷';
    gallery.querySelector('.gallery-slides').setAttribute('aria-live', automatic ? 'off' : 'polite');
    schedule();
  }
  function manual(next) {
    automatic = false;
    show(next);
    updatePlayback();
  }
  dots.forEach((dot, i) => dot.addEventListener('click', () => manual(i)));
  gallery.querySelector('.gallery-previous').addEventListener('click', () => manual(index - 1));
  gallery.querySelector('.gallery-next').addEventListener('click', () => manual(index + 1));
  play.addEventListener('click', () => {
    automatic = !automatic;
    updatePlayback();
  });
  gallery.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  gallery.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  gallery.addEventListener('focusin', () => { focused = true; schedule(); });
  gallery.addEventListener('focusout', event => {
    focused = gallery.contains(event.relatedTarget);
    schedule();
  });
  document.addEventListener('visibilitychange', schedule);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) automatic = false;
    updatePlayback();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }, { threshold: 0.2 }).observe(gallery);
  }
  if (typeof dialog.showModal === 'function') {
    expand.hidden = false;
    expand.addEventListener('click', () => {
      const image = slides[index].querySelector('img');
      const enlarged = dialog.querySelector('img');
      enlarged.src = image.src;
      enlarged.alt = image.alt;
      gallery.querySelector('#gallery-dialog-title').textContent = slides[index].dataset.title;
      dialog.showModal();
      document.body.classList.add('gallery-modal-open');
      schedule();
    });
    gallery.querySelector('.gallery-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('gallery-modal-open');
      schedule();
    });
  }
  gallery.querySelector('.gallery-controls').hidden = false;
  updatePlayback();
})();
